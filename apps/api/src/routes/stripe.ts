import { Router, Response, Request } from 'express'
import Stripe from 'stripe'
import { z } from 'zod'
import { stripe, MIN_PAYOUT_AED } from '../lib/stripe'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /stripe/onboard — Step 1: create Stripe Custom account
router.post('/onboard', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    dateOfBirth: z.object({
      day: z.number().int().min(1).max(31),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(1900).max(2005),
    }),
    phone: z.string().min(10),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { firstName, lastName, email, dateOfBirth, phone } = parsed.data

  // Check if account already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('stripe_account_id')
    .eq('id', req.userId)
    .single()

  if (existingUser?.stripe_account_id) {
    return res.status(400).json({ error: 'Stripe account already created' })
  }

  try {
    const account = await stripe.accounts.create({
      type: 'custom',
      country: 'AE',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        dob: dateOfBirth,
      },
      settings: {
        payouts: { schedule: { interval: 'manual' } },
      },
      tos_acceptance: { service_agreement: 'recipient' },
    })

    await supabase.from('users').update({
      stripe_account_id: account.id,
    }).eq('id', req.userId)

    return res.status(201).json({ accountId: account.id })
  } catch (err) {
    console.error('Stripe account creation failed:', err)
    return res.status(500).json({ error: 'Failed to create Stripe account' })
  }
})

// PATCH /stripe/onboard — Step 2: identity verification, Step 3: bank account
router.patch('/onboard', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_account_id) {
    return res.status(400).json({ error: 'No Stripe account found. Complete Step 1 first.' })
  }

  const schema = z.union([
    z.object({
      step: z.literal('identity'),
      frontFileId: z.string().startsWith('file_'),
      backFileId: z.string().startsWith('file_').optional(),
    }),
    z.object({
      step: z.literal('bank'),
      accountHolderName: z.string().min(1),
      iban: z.string().regex(/^AE\d{21}$/, 'Must be a valid UAE IBAN'),
    }),
  ])

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    if (parsed.data.step === 'identity') {
      const { frontFileId, backFileId } = parsed.data
      await stripe.accounts.update(user.stripe_account_id, {
        individual: {
          verification: {
            document: {
              front: frontFileId,
              back: backFileId,
            },
          },
        },
      })
      return res.json({ message: 'Identity document submitted' })
    }

    if (parsed.data.step === 'bank') {
      const { accountHolderName, iban } = parsed.data
      await stripe.accounts.createExternalAccount(user.stripe_account_id, {
        external_account: {
          object: 'bank_account' as const,
          country: 'AE',
          currency: 'aed',
          account_holder_name: accountHolderName,
          account_number: iban,
        },
      })
      return res.json({ message: 'Bank account added successfully' })
    }

    return res.status(400).json({ error: 'Invalid step' })
  } catch (err) {
    console.error('Stripe onboarding update failed:', err)
    return res.status(500).json({ error: 'Failed to update Stripe account' })
  }
})

// GET /stripe/account-status
router.get('/account-status', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled, is_verified')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_account_id) {
    return res.json({ onboarded: false, requirementsCurrentlyDue: [], payoutsEnabled: false })
  }

  try {
    const account = await stripe.accounts.retrieve(user.stripe_account_id)

    return res.json({
      accountId: user.stripe_account_id,
      onboarded: user.stripe_onboarding_complete,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
      requirementsEventuallyDue: account.requirements?.eventually_due ?? [],
    })
  } catch (err) {
    console.error('Stripe account status fetch failed:', err)
    return res.status(500).json({ error: 'Failed to fetch account status' })
  }
})

// POST /stripe/payout — request manual payout
router.post('/payout', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_payouts_enabled, stripe_onboarding_complete')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_onboarding_complete || !user?.stripe_payouts_enabled) {
    return res.status(403).json({ error: 'Payouts not enabled for this account' })
  }

  const schema = z.object({ amountAed: z.number().int().min(MIN_PAYOUT_AED).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  try {
    const balance = await stripe.balance.retrieve({ stripeAccount: user.stripe_account_id })
    const available = balance.available.find(b => b.currency === 'aed')

    if (!available || available.amount < MIN_PAYOUT_AED) {
      return res.status(400).json({
        error: `Minimum payout is AED ${MIN_PAYOUT_AED / 100}. Available: AED ${(available?.amount ?? 0) / 100}`,
      })
    }

    const amount = parsed.data.amountAed ?? available.amount

    const payout = await stripe.payouts.create(
      { amount, currency: 'aed' },
      { stripeAccount: user.stripe_account_id }
    )

    const { error: txnErr } = await supabase.from('transactions').insert({
      user_id: req.userId,
      type: 'payout',
      amount_aed: -amount,
      stripe_reference: payout.id,
      status: 'pending',
      description: 'Payout to bank account',
    })
    if (txnErr) console.error('Failed to record payout transaction:', txnErr)

    return res.json({ payout: { id: payout.id, amount, status: payout.status } })
  } catch (err) {
    console.error('Stripe payout failed:', err)
    return res.status(500).json({ error: 'Failed to process payout' })
  }
})

// POST /stripe/create-file — upload identity document to Stripe
router.post('/create-file', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    base64: z.string(),
    contentType: z.enum(['image/jpeg', 'image/png']),
    purpose: z.enum(['identity_document']).default('identity_document'),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_account_id) {
    return res.status(400).json({ error: 'No Stripe account found' })
  }

  try {
    const buffer = Buffer.from(parsed.data.base64, 'base64')
    const file = await stripe.files.create(
      {
        purpose: 'identity_document',
        file: {
          data: buffer,
          name: 'id_document',
          type: parsed.data.contentType,
        },
      },
      { stripeAccount: user.stripe_account_id }
    )

    return res.json({ fileId: file.id })
  } catch (err) {
    console.error('Stripe file upload failed:', err)
    return res.status(500).json({ error: 'Failed to upload identity document' })
  }
})

// POST /stripe/webhook — receive Stripe events
const webhookRouter = Router()

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).send('Server misconfigured')
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).send('Webhook Error')
  }

  // Idempotency: skip already-processed events
  const { data: existing } = await supabase
    .from('processed_events')
    .select('id')
    .eq('event_id', event.id)
    .single()

  if (existing) {
    return res.json({ received: true, duplicate: true })
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    console.error(`Error handling event ${event.type}:`, err)
    return res.status(500).json({ error: 'Event handling failed' })
  }

  // Mark as processed AFTER successful handling so failed events can be retried
  await supabase.from('processed_events').insert({ event_id: event.id, type: event.type })

  return res.json({ received: true })
})

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent
      const listingId = pi.metadata?.listingId
      const buyerId = pi.metadata?.buyerId
      const sellerId = pi.metadata?.sellerId

      if (!listingId || !buyerId || !sellerId) {
        console.warn('payment_intent.succeeded missing metadata fields, skipping', pi.id)
        break
      }

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('stripe_payment_intent_id', pi.id)
      if (orderErr) console.error('Failed to update order to paid:', orderErr)

      const { error: notifErr } = await supabase.from('notifications').insert([
        {
          user_id: sellerId,
          type: 'sale_confirmed',
          title: 'You have a new sale!',
          body: 'Payment received. Arrange handover with the buyer.',
          data: { listingId },
        },
        {
          user_id: buyerId,
          type: 'payment_confirmed',
          title: 'Payment confirmed',
          body: 'Your payment was successful. Arrange collection with the seller.',
          data: { listingId },
        },
      ])
      if (notifErr) console.error('Failed to insert payment notifications:', notifErr)
      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent

      const { error: cancelErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('stripe_payment_intent_id', pi.id)
      if (cancelErr) console.error('Failed to cancel order:', cancelErr)

      // Reactivate listing
      const listingId = pi.metadata?.listingId
      if (listingId) {
        const { error: reactivateErr } = await supabase
          .from('listings')
          .update({ status: 'active' })
          .eq('id', listingId)
        if (reactivateErr) console.error('Failed to reactivate listing:', reactivateErr)
      }

      const buyerId = pi.metadata?.buyerId
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          type: 'payment_failed',
          title: 'Payment failed',
          body: 'Your payment could not be processed. Please try again.',
          data: { paymentIntentId: pi.id },
        })
      }
      break
    }

    case 'account.updated': {
      const account = event.data.object as Stripe.Account
      const isComplete =
        (account.requirements?.currently_due?.length ?? 0) === 0 &&
        account.payouts_enabled

      const { error: accountErr } = await supabase
        .from('users')
        .update({
          stripe_onboarding_complete: isComplete,
          stripe_payouts_enabled: account.payouts_enabled ?? false,
          is_verified: account.individual?.verification?.status === 'verified',
        })
        .eq('stripe_account_id', account.id)
      if (accountErr) console.error('Failed to update user Stripe status:', accountErr)
      break
    }

    case 'transfer.created': {
      const transfer = event.data.object as Stripe.Transfer
      const orderId = transfer.metadata?.orderId
      if (orderId) {
        const { error: transferErr } = await supabase
          .from('orders')
          .update({ stripe_transfer_id: transfer.id })
          .eq('id', orderId)
        if (transferErr) console.error('Failed to record transfer on order:', transferErr)
      }
      break
    }

    case 'payout.paid': {
      const payout = event.data.object as Stripe.Payout
      const { error: payoutErr } = await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('stripe_reference', payout.id)
      if (payoutErr) console.error('Failed to mark payout transaction completed:', payoutErr)

      const { data: txn } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('stripe_reference', payout.id)
        .single()

      if (txn) {
        await supabase.from('notifications').insert({
          user_id: txn.user_id,
          type: 'payout_sent',
          title: 'Payout sent!',
          body: `AED ${payout.amount / 100} has been sent to your bank account.`,
          data: { payoutId: payout.id },
        })
      }
      break
    }

    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout
      const { error: failErr } = await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('stripe_reference', payout.id)
      if (failErr) console.error('Failed to mark payout transaction failed:', failErr)
      break
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute
      const paymentIntentId = typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id

      if (!paymentIntentId) break

      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id, seller_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single()

      if (order) {
        const { error: disputeErr } = await supabase
          .from('orders')
          .update({ status: 'disputed' })
          .eq('stripe_payment_intent_id', paymentIntentId)
        if (disputeErr) console.error('Failed to mark order as disputed:', disputeErr)

        await supabase.from('notifications').insert([
          {
            user_id: order.buyer_id,
            type: 'dispute_opened',
            title: 'Dispute opened',
            body: 'A dispute has been opened for your order. Our team will review it.',
            data: { disputeId: dispute.id },
          },
          {
            user_id: order.seller_id,
            type: 'dispute_opened',
            title: 'Dispute opened',
            body: 'A dispute has been opened for one of your orders.',
            data: { disputeId: dispute.id },
          },
        ])
      }
      break
    }

    default:
      break
  }
}

export { webhookRouter }
export default router
