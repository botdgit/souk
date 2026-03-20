import { Router, Response } from 'express'
import { z } from 'zod'
import { generatePresignedUrl, generateKey, getPublicUrl } from '../lib/r2'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// POST /media/presign — generate pre-signed upload URL for Cloudflare R2
router.post('/presign', requireAuth, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    count: z.number().int().min(1).max(10).default(1),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { contentType, count } = parsed.data
  const results = []

  for (let i = 0; i < count; i++) {
    const key = generateKey(req.userId!, contentType)
    const uploadUrl = await generatePresignedUrl(key, contentType)
    const publicUrl = getPublicUrl(key)
    results.push({ key, uploadUrl, publicUrl })
  }

  return res.json({ uploads: results })
})

export default router
