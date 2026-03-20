import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import authRouter from './routes/auth'
import listingsRouter from './routes/listings'
import ordersRouter from './routes/orders'
import stripeRouter, { webhookRouter } from './routes/stripe'
import walletRouter from './routes/wallet'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'
import mediaRouter from './routes/media'
import notificationsRouter from './routes/notifications'

const app = express()
const PORT = process.env.PORT || 3000

// Webhook route needs raw body — must come before JSON middleware
app.use('/stripe/webhook', express.raw({ type: 'application/json' }), webhookRouter)

app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/v1', generalLimiter)
app.use('/api/v1/orders', sensitiveLimiter)
app.use('/api/v1/stripe/onboard', sensitiveLimiter)
app.use('/api/v1/stripe/payout', sensitiveLimiter)

// Routes
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/listings', listingsRouter)
app.use('/api/v1/orders', ordersRouter)
app.use('/api/v1/stripe', stripeRouter)
app.use('/api/v1/wallet', walletRouter)
app.use('/api/v1/conversations', messagesRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/media', mediaRouter)
app.use('/api/v1/notifications', notificationsRouter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Souk API running on port ${PORT}`)
})

export default app
