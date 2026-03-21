import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /users/:id — public profile
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const [userRes, listingsRes, reviewsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, avatar_url, bio, area, is_verified, rating_avg, rating_count, followers_count, created_at')
      .eq('id', id)
      .single(),
    supabase
      .from('listings')
      .select('id, title, images, price_aed, condition, category, status, created_at')
      .eq('seller_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('reviews')
      .select('rating, comment, created_at, reviewer:users!reviews_reviewer_id_fkey(id, display_name, avatar_url)')
      .eq('reviewee_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (userRes.error || !userRes.data) {
    return res.status(404).json({ error: 'User not found' })
  }

  return res.json({
    user: userRes.data,
    listings: listingsRes.data ?? [],
    reviews: reviewsRes.data ?? [],
  })
})

// GET /users/me — current user profile
router.get('/me/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.userId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'User not found' })

  return res.json({ user: data })
})

// PATCH /users/me — update profile
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    displayName: z.string().min(2).max(50).optional(),
    bio: z.string().max(200).optional(),
    area: z.string().max(100).optional(),
    avatarUrl: z.string().url().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const updates: Record<string, unknown> = {}
  if (parsed.data.displayName) updates.display_name = parsed.data.displayName
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio
  if (parsed.data.area) updates.area = parsed.data.area
  if (parsed.data.avatarUrl) updates.avatar_url = parsed.data.avatarUrl

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.userId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to update profile' })

  return res.json({ user: data })
})

// POST /users/:id/follow — toggle follow
router.post('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id: followingId } = req.params

  if (followingId === req.userId) {
    return res.status(400).json({ error: 'Cannot follow yourself' })
  }

  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', req.userId)
    .eq('following_id', followingId)
    .single()

  if (existing) {
    const { error: delError } = await supabase.from('follows').delete().eq('id', existing.id)
    if (delError) return res.status(500).json({ error: 'Failed to unfollow' })
    await supabase.rpc('decrement_followers', { user_id: followingId })
    return res.json({ following: false })
  }

  const { error: insertError } = await supabase.from('follows').insert({ follower_id: req.userId, following_id: followingId })
  if (insertError) return res.status(500).json({ error: 'Failed to follow' })
  await supabase.rpc('increment_followers', { user_id: followingId })

  return res.json({ following: true })
})

// POST /reviews
router.post('/reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    orderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { data: order } = await supabase
    .from('orders')
    .select('buyer_id, seller_id, status')
    .eq('id', parsed.data.orderId)
    .single()

  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.status !== 'completed') return res.status(400).json({ error: 'Can only review completed orders' })
  if (order.buyer_id !== req.userId && order.seller_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Check for existing review
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', parsed.data.orderId)
    .eq('reviewer_id', req.userId)
    .single()

  if (existingReview) return res.status(400).json({ error: 'Already reviewed this order' })

  const revieweeId = order.buyer_id === req.userId ? order.seller_id : order.buyer_id

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      order_id: parsed.data.orderId,
      reviewer_id: req.userId,
      reviewee_id: revieweeId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to submit review' })

  // Update user rating
  await supabase.rpc('update_user_rating', { user_id: revieweeId })

  return res.status(201).json({ review: data })
})

export default router
