import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { stripe, computeFees } from '../lib/stripe'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /orders — create order + PaymentIntent
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    listingId: z.string().uuid(),
    deliveryMethod: z.enum(['meetup', 'delivery']),
    meetupPointId: z.string().uuid().optional(),
    deliveryFeeAed: z.number().int().min(0).default(0),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { listingId, deliveryMethod, meetupPointId, deliveryFeeAed } = parsed.data

  // Fetch listing with seller info
  const { data: listing } = await supabase
    .from('listings')
    .select('*, seller:users(id, stripe_account_id, stripe_payouts_enabled)')
    .eq('id', listingId)
    .single()

  if (!listing) return res.status(404).json({ error: 'Listing not found' })
  if (listing.status !== 'active') return res.status(400).json({ error: 'Listing is not available' })
  if (listing.seller_id === req.userId) return res.status(400).json({ error: 'Cannot purchase own listing' })
  if (!listing.seller?.stripe_account_id || !listing.seller?.stripe_payouts_enabled) {
    return res.status(400).json({ error: 'Seller is not able to receive payments' })
  }

  const { serviceFee, total } = computeFees(listing.price_aed, deliveryFeeAed)

  // Create Stripe PaymentIntent with destination charge
  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'aed',
      application_fee_amount: serviceFee,
      transfer_data: {
        destination: listing.seller.stripe_account_id,
      },
      on_behalf_of: listing.seller.stripe_account_id,
      capture_method: 'automatic',
      metadata: {
        listingId,
        buyerId: req.userId!,
        sellerId: listing.seller_id,
      },
    }, {
      idempotencyKey: `order-${listingId}-${req.userId}`,
    })
  } catch (err: unknown) {
    console.error('Stripe PaymentIntent error:', err)
    return res.status(500).json({ error: 'Failed to create payment intent' })
  }

  // Mark listing as reserved
  const { error: reserveErr } = await supabase.from('listings').update({ status: 'reserved' }).eq('id', listingId)
  if (reserveErr) console.error('Failed to reserve listing:', reserveErr)

  // Create order record
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      listing_id: listingId,
      buyer_id: req.userId,
      seller_id: listing.seller_id,
      amount_aed: listing.price_aed,
      service_fee_aed: serviceFee,
      delivery_fee_aed: deliveryFeeAed,
      total_aed: total,
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending_payment',
      delivery_method: deliveryMethod,
      meetup_point_id: meetupPointId || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create order record:', error)
    // Cancel the PaymentIntent since DB insert failed
    try {
      await stripe.paymentIntents.cancel(paymentIntent.id)
    } catch (cancelErr) {
      console.error('Failed to cancel PaymentIntent after DB error:', cancelErr)
    }
    // Revert listing status
    await supabase.from('listings').update({ status: 'active' }).eq('id', listingId)
    return res.status(500).json({ error: 'Failed to create order' })
  }

  return res.status(201).json({
    order,
    clientSecret: paymentIntent.client_secret,
  })
})

// POST /orders/:id/confirm-delivery
router.post('/:id/confirm-delivery', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: order } = await supabase
    .from('orders')
    .select('*, listing:listings(seller_id), seller:users!orders_seller_id_fkey(stripe_account_id)')
    .eq('id', req.params.id)
    .single()

  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.buyer_id !== req.userId) return res.status(403).json({ error: 'Forbidden' })
  if (!['paid', 'shipped', 'delivered'].includes(order.status)) {
    return res.status(400).json({ error: 'Order cannot be confirmed in current state' })
  }
  if (!order.seller?.stripe_account_id) {
    return res.status(400).json({ error: 'Seller payment account not available' })
  }

  // Release funds to seller via transfer
  let transfer
  try {
    transfer = await stripe.transfers.create({
      amount: order.amount_aed, // seller receives item price (fee already taken via application_fee_amount)
      currency: 'aed',
      destination: order.seller.stripe_account_id,
      metadata: { orderId: order.id },
    }, {
      idempotencyKey: `transfer-${order.id}`,
    })
  } catch (err: unknown) {
    console.error('Stripe transfer error:', err)
    return res.status(500).json({ error: 'Failed to release payment to seller' })
  }

  const now = new Date().toISOString()

  const { error: orderUpdateErr } = await supabase.from('orders').update({
    status: 'completed',
    stripe_transfer_id: transfer.id,
    delivery_confirmed_at: now,
    payout_released_at: now,
  }).eq('id', order.id)

  if (orderUpdateErr) {
    console.error('Failed to update order status:', orderUpdateErr)
    return res.status(500).json({ error: 'Failed to update order' })
  }

  // Update listing to sold
  const { error: listingErr } = await supabase.from('listings').update({ status: 'sold' }).eq('id', order.listing_id)
  if (listingErr) console.error('Failed to mark listing as sold:', listingErr)

  // Create transaction records
  const { error: txnErr } = await supabase.from('transactions').insert([
    {
      user_id: order.seller_id,
      order_id: order.id,
      type: 'sale',
      amount_aed: order.amount_aed,
      stripe_reference: transfer.id,
      status: 'completed',
      description: `Sale completed`,
    },
    {
      user_id: order.buyer_id,
      order_id: order.id,
      type: 'purchase',
      amount_aed: -order.total_aed,
      stripe_reference: order.stripe_payment_intent_id,
      status: 'completed',
      description: `Purchase completed`,
    },
  ])
  if (txnErr) console.error('Failed to create transaction records:', txnErr)

  return res.json({ message: 'Delivery confirmed and payment released to seller' })
})

// GET /orders — user's order history
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { role = 'buyer', page = '1' } = req.query
  const pageNum = parseInt(String(page), 10)
  const limit = 20
  const offset = (pageNum - 1) * limit

  const field = role === 'seller' ? 'seller_id' : 'buyer_id'

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      listing:listings(id, title, images, price_aed),
      buyer:users!orders_buyer_id_fkey(id, display_name, avatar_url),
      seller:users!orders_seller_id_fkey(id, display_name, avatar_url)
    `)
    .eq(field, req.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: 'Failed to fetch orders' })

  return res.json({ orders: data, page: pageNum })
})

export default router
