import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthRequest extends Request {
  userId?: string
  userEmail?: string
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  req.userId = data.user.id
  req.userEmail = data.user.email
  next()
}

export async function requireOnboarded(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthenticated' })
    return
  }

  const { data: user } = await supabase
    .from('users')
    .select('stripe_onboarding_complete')
    .eq('id', req.userId)
    .single()

  if (!user?.stripe_onboarding_complete) {
    res.status(403).json({ error: 'Stripe seller onboarding not complete' })
    return
  }

  next()
}
