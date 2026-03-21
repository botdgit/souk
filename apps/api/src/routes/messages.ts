import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /conversations
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      listing:listings(id, title, images),
      buyer:users!conversations_buyer_id_fkey(id, display_name, avatar_url),
      seller:users!conversations_seller_id_fkey(id, display_name, avatar_url),
      last_message:messages(body, type, created_at)
    `)
    .or(`buyer_id.eq.${req.userId},seller_id.eq.${req.userId}`)
    .order('last_message_at', { ascending: false })

  if (error) return res.status(500).json({ error: 'Failed to fetch conversations' })

  return res.json({ conversations: data })
})

// GET /conversations/:id/messages
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params
  const { page = '1' } = req.query
  const pageNum = parseInt(String(page), 10)
  const limit = 50
  const offset = (pageNum - 1) * limit

  // Verify user is part of this conversation
  const { data: convo } = await supabase
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', id)
    .single()

  if (!convo || (convo.buyer_id !== req.userId && convo.seller_id !== req.userId)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data, error, count } = await supabase
    .from('messages')
    .select('*, sender:users(id, display_name, avatar_url)', { count: 'exact' })
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: 'Failed to fetch messages' })

  // Mark messages as read (best-effort, don't fail the request)
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', id)
    .neq('sender_id', req.userId)
    .is('read_at', null)
    .then(({ error: readErr }) => { if (readErr) console.error('Failed to mark messages read:', readErr) })

  // Reset unread count for current user
  const unreadField = convo.buyer_id === req.userId ? 'unread_count_buyer' : 'unread_count_seller'
  await supabase.from('conversations').update({ [unreadField]: 0 }).eq('id', id)
    .then(({ error: unreadErr }) => { if (unreadErr) console.error('Failed to reset unread count:', unreadErr) })

  return res.json({ messages: data?.reverse(), total: count, page: pageNum })
})

// POST /conversations/:id/messages
router.post('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    body: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
  }).refine(d => d.body || d.imageUrl, { message: 'Message must have body or image' })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { id } = req.params

  const { data: convo } = await supabase
    .from('conversations')
    .select('buyer_id, seller_id')
    .eq('id', id)
    .single()

  if (!convo || (convo.buyer_id !== req.userId && convo.seller_id !== req.userId)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: req.userId,
      body: parsed.data.body,
      image_url: parsed.data.imageUrl,
      type: parsed.data.imageUrl ? 'image' : 'text',
    })
    .select('*, sender:users(id, display_name, avatar_url)')
    .single()

  if (error) return res.status(500).json({ error: 'Failed to send message' })

  // Update conversation metadata
  const recipientId = convo.buyer_id === req.userId ? convo.seller_id : convo.buyer_id
  const unreadField = convo.buyer_id === recipientId ? 'unread_count_buyer' : 'unread_count_seller'

  await supabase.rpc('increment_unread', { conversation_id: id, field: unreadField })
    .then(({ error: unreadErr }) => { if (unreadErr) console.error('Failed to increment unread:', unreadErr) })
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id)
    .then(({ error: updateErr }) => { if (updateErr) console.error('Failed to update last_message_at:', updateErr) })

  return res.status(201).json({ message })
})

// POST /conversations — create or get conversation for listing
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ listingId: z.string().uuid() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { data: listing } = await supabase
    .from('listings')
    .select('seller_id')
    .eq('id', parsed.data.listingId)
    .single()

  if (!listing) return res.status(404).json({ error: 'Listing not found' })
  if (listing.seller_id === req.userId) {
    return res.status(400).json({ error: 'Cannot message yourself' })
  }

  // Find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('listing_id', parsed.data.listingId)
    .eq('buyer_id', req.userId)
    .single()

  if (existing) return res.json({ conversation: existing })

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      listing_id: parsed.data.listingId,
      buyer_id: req.userId,
      seller_id: listing.seller_id,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to create conversation' })

  return res.status(201).json({ conversation: data })
})

export default router
