import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { z } from 'zod'

const router = Router()

const phoneSchema = z.object({
  phone: z.string().min(10).max(15),
})

const verifySchema = z.object({
  phone: z.string().min(10).max(15),
  token: z.string().length(6),
})

// POST /auth/phone-otp
router.post('/phone-otp', async (req: Request, res: Response) => {
  const parsed = phoneSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { phone } = parsed.data
  const { error } = await supabase.auth.signInWithOtp({ phone })

  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.json({ message: 'OTP sent successfully' })
})

// POST /auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { phone, token } = parsed.data
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  })

  if (error || !data.session) {
    return res.status(400).json({ error: error?.message || 'Verification failed' })
  }

  return res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user: {
      id: data.user?.id,
      phone: data.user?.phone,
    },
  })
})

// POST /auth/refresh
const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

router.post('/refresh', async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: parsed.data.refreshToken,
  })

  if (error || !data.session) {
    return res.status(401).json({ error: error?.message || 'Failed to refresh token' })
  }

  return res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  })
})

export default router
