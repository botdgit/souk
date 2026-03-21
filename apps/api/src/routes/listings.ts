import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { meili, LISTINGS_INDEX, indexListing, removeListing } from '../lib/meilisearch'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const CATEGORIES = ['designer', 'abayas', 'modest', 'streetwear', 'bags', 'shoes'] as const
const CONDITIONS = ['new_with_tags', 'like_new', 'excellent', 'good', 'fair'] as const

const listingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  category: z.enum(CATEGORIES),
  brand: z.string().max(50).optional(),
  size: z.string().max(20).optional(),
  condition: z.enum(CONDITIONS),
  priceAed: z.number().int().positive(),
  openToOffers: z.boolean().default(false),
  openToSwaps: z.boolean().default(false),
  area: z.string().max(100),
  images: z.array(z.object({
    url: z.string().url(),
    order: z.number().int().min(0),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
  })).min(1).max(10),
})

// GET /listings — search & filter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q, category, area, minPrice, maxPrice, condition, size, sort = 'newest', page = '1', limit = '20' } = req.query

    const pageNum = parseInt(String(page), 10)
    const limitNum = Math.min(parseInt(String(limit), 10), 50)
    const offset = (pageNum - 1) * limitNum

    if (q) {
      const filters: string[] = ['status = "active"']
      if (category) {
        if (!CATEGORIES.includes(String(category) as typeof CATEGORIES[number])) {
          return res.status(400).json({ error: 'Invalid category' })
        }
        filters.push(`category = "${category}"`)
      }
      if (area) {
        // Sanitize area: allow only alphanumeric, spaces, hyphens
        const sanitizedArea = String(area).replace(/[^a-zA-Z0-9 \-]/g, '')
        filters.push(`area = "${sanitizedArea}"`)
      }
      if (condition) {
        if (!CONDITIONS.includes(String(condition) as typeof CONDITIONS[number])) {
          return res.status(400).json({ error: 'Invalid condition' })
        }
        filters.push(`condition = "${condition}"`)
      }
      if (size) {
        const sanitizedSize = String(size).replace(/[^a-zA-Z0-9 \-/]/g, '')
        filters.push(`size = "${sanitizedSize}"`)
      }
      if (minPrice || maxPrice) {
        const min = minPrice ? parseInt(String(minPrice), 10) : 0
        const max = maxPrice ? parseInt(String(maxPrice), 10) : 99999999
        filters.push(`priceAed ${min} TO ${max}`)
      }

      const sortBy: string[] = []
      if (sort === 'price_asc') sortBy.push('priceAed:asc')
      else if (sort === 'price_desc') sortBy.push('priceAed:desc')
      else sortBy.push('createdAt:desc')

      const results = await meili.index(LISTINGS_INDEX).search(String(q), {
        filter: filters.join(' AND '),
        sort: sortBy,
        offset,
        limit: limitNum,
      })

      return res.json({ listings: results.hits, total: results.estimatedTotalHits, page: pageNum })
    }

    // Database query when no text search
    let query = supabase
      .from('listings')
      .select(`
        *,
        seller:users(id, display_name, avatar_url, is_verified, rating_avg, rating_count)
      `)
      .eq('status', 'active')

    if (category) query = query.eq('category', category)
    if (area) query = query.eq('area', area)
    if (condition) query = query.eq('condition', condition)
    if (size) query = query.eq('size', size)
    if (minPrice) query = query.gte('price_aed', parseInt(String(minPrice), 10))
    if (maxPrice) query = query.lte('price_aed', parseInt(String(maxPrice), 10))

    if (sort === 'price_asc') query = query.order('price_aed', { ascending: true })
    else if (sort === 'price_desc') query = query.order('price_aed', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    query = query.range(offset, offset + limitNum - 1)

    const { data, error, count } = await query
    if (error) throw error

    return res.json({ listings: data, total: count, page: pageNum })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

// GET /listings/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      seller:users(id, display_name, avatar_url, bio, area, is_verified, rating_avg, rating_count, followers_count, stripe_payouts_enabled)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return res.status(404).json({ error: 'Listing not found' })
  }

  return res.json({ listing: data })
})

// POST /listings
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = listingSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { title, description, category, brand, size, condition, priceAed, openToOffers, openToSwaps, area, images } = parsed.data

  // Check listing velocity (max 5 per hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count, error: countError } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', req.userId)
    .gte('created_at', oneHourAgo)

  if (countError) return res.status(500).json({ error: 'Failed to check listing velocity' })

  if ((count ?? 0) >= 5) {
    return res.status(429).json({ error: 'Maximum 5 listings per hour' })
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: req.userId,
      title,
      description,
      category,
      brand,
      size,
      condition,
      price_aed: priceAed,
      open_to_offers: openToOffers,
      open_to_swaps: openToSwaps,
      area,
      images,
      status: 'active',
    })
    .select(`*, seller:users(id, display_name, avatar_url, is_verified)`)
    .single()

  if (error) {
    console.error(error)
    return res.status(500).json({ error: 'Failed to create listing' })
  }

  // Index in Meilisearch
  await indexListing({
    id: data.id,
    title: data.title,
    description: data.description,
    category: data.category,
    brand: data.brand,
    size: data.size,
    condition: data.condition,
    priceAed: data.price_aed,
    area: data.area,
    status: data.status,
    sellerDisplayName: data.seller?.display_name,
    sellerVerified: data.seller?.is_verified ? 1 : 0,
    createdAt: data.created_at,
  }).catch(console.error)

  return res.status(201).json({ listing: data })
})

// PATCH /listings/:id
router.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  // Verify ownership
  const { data: existing } = await supabase
    .from('listings')
    .select('seller_id')
    .eq('id', id)
    .single()

  if (!existing || existing.seller_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const allowed = ['title', 'description', 'price_aed', 'open_to_offers', 'open_to_swaps', 'area', 'images']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to update listing' })

  await indexListing({ id: data.id, ...updates }).catch(console.error)

  return res.json({ listing: data })
})

// DELETE /listings/:id (soft delete)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const { data: existing } = await supabase
    .from('listings')
    .select('seller_id, status')
    .eq('id', id)
    .single()

  if (!existing || existing.seller_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (existing.status === 'sold') {
    return res.status(400).json({ error: 'Cannot delete a sold listing' })
  }

  const { error: archiveError } = await supabase.from('listings').update({ status: 'archived' }).eq('id', id)
  if (archiveError) return res.status(500).json({ error: 'Failed to archive listing' })

  await removeListing(id).catch(console.error)

  return res.status(204).send()
})

// POST /listings/:id/save
router.post('/:id/save', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params

  const { data: existing } = await supabase
    .from('saved_items')
    .select('id')
    .eq('user_id', req.userId)
    .eq('listing_id', id)
    .single()

  if (existing) {
    const { error: delError } = await supabase.from('saved_items').delete().eq('id', existing.id)
    if (delError) return res.status(500).json({ error: 'Failed to unsave listing' })
    return res.json({ saved: false })
  }

  const { error: saveError } = await supabase.from('saved_items').insert({ user_id: req.userId, listing_id: id })
  if (saveError) return res.status(500).json({ error: 'Failed to save listing' })
  return res.json({ saved: true })
})

// POST /listings/:id/offer
router.post('/:id/offer', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    amountAed: z.number().int().positive(),
    message: z.string().max(500).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { data: listing } = await supabase
    .from('listings')
    .select('seller_id, price_aed, open_to_offers, status')
    .eq('id', req.params.id)
    .single()

  if (!listing) return res.status(404).json({ error: 'Listing not found' })
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not active' })
  if (!listing.open_to_offers) return res.status(400).json({ error: 'Seller is not accepting offers' })
  if (listing.seller_id === req.userId) return res.status(400).json({ error: 'Cannot make offer on own listing' })

  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  const { data, error } = await supabase
    .from('offers')
    .insert({
      listing_id: req.params.id,
      buyer_id: req.userId,
      amount_aed: parsed.data.amountAed,
      message: parsed.data.message,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to submit offer' })

  return res.status(201).json({ offer: data })
})

// PATCH /offers/:offerId
router.patch('/:offerId/offer-response', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ action: z.enum(['accepted', 'declined']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { data: offer } = await supabase
    .from('offers')
    .select('*, listing:listings(seller_id)')
    .eq('id', req.params.offerId)
    .single()

  if (!offer) return res.status(404).json({ error: 'Offer not found' })
  if (offer.listing.seller_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })
  if (offer.status !== 'pending') return res.status(400).json({ error: 'Offer is no longer pending' })

  const { data, error } = await supabase
    .from('offers')
    .update({ status: parsed.data.action })
    .eq('id', req.params.offerId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: 'Failed to update offer' })

  return res.json({ offer: data })
})

export default router
