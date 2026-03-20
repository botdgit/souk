import { Router, Response } from 'express'
import { stripe } from '../lib/stripe'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /wallet
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('users')
    .select('stripe_account_id, stripe_payouts_enabled, stripe_onboarding_complete')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_account_id) {
    return res.json({
      available: 0,
      pending: 0,
      currency: 'aed',
      payoutsEnabled: false,
      onboarded: false,
    })
  }

  let available = 0
  let pending = 0

  try {
    const balance = await stripe.balance.retrieve({ stripeAccount: user.stripe_account_id })
    available = balance.available.find(b => b.currency === 'aed')?.amount ?? 0
    pending = balance.pending.find(b => b.currency === 'aed')?.amount ?? 0
  } catch (err) {
    console.error('Failed to fetch Stripe balance:', err)
  }

  return res.json({
    available,
    pending,
    currency: 'aed',
    payoutsEnabled: user.stripe_payouts_enabled,
    onboarded: user.stripe_onboarding_complete,
  })
})

// GET /wallet/transactions
router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = parseInt(String(page), 10)
  const limitNum = Math.min(parseInt(String(limit), 10), 50)
  const offset = (pageNum - 1) * limitNum

  const { data, error, count } = await supabase
    .from('transactions')
    .select('*, order:orders(id, listing_id)', { count: 'exact' })
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  if (error) return res.status(500).json({ error: 'Failed to fetch transactions' })

  return res.json({ transactions: data, total: count, page: pageNum })
})

export default router
