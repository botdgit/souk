import { Router, Response, Request } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /meetup-points
router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('meetup_points')
    .select('*')
    .order('name', { ascending: true })

  if (error) return res.status(500).json({ error: 'Failed to fetch meetup points' })

  return res.json({ meetupPoints: data })
})

export default router
