import { Router, Response } from 'express'
import { supabase } from '../lib/supabase'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

// GET /notifications
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { page = '1' } = req.query
  const pageNum = parseInt(String(page), 10)
  const limit = 30
  const offset = (pageNum - 1) * limit

  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: 'Failed to fetch notifications' })

  return res.json({ notifications: data, total: count, page: pageNum })
})

// POST /notifications/read-all
router.post('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', req.userId)
    .is('read_at', null)

  if (error) return res.status(500).json({ error: 'Failed to mark notifications as read' })

  return res.json({ message: 'All notifications marked as read' })
})

// PATCH /notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)

  if (error) return res.status(500).json({ error: 'Failed to mark notification as read' })

  return res.json({ message: 'Notification marked as read' })
})

export default router
