import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
  typescript: true,
})

export const PLATFORM_FEE_PERCENT = 5
export const MIN_PAYOUT_AED = 5000 // AED 50.00 in fils (minor units)

export function computeFees(priceAed: number, deliveryFeeAed = 0) {
  const serviceFee = Math.round(priceAed * (PLATFORM_FEE_PERCENT / 100))
  const total = priceAed + serviceFee + deliveryFeeAed
  return { priceAed, serviceFee, deliveryFeeAed, total }
}
