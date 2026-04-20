import { Router, type Request, type Response } from 'express'
import { listBackups, createBackup, restoreFromBackup, deleteBackup } from '../services/db'

const router = Router()

const FILENAME_RE = /^workbench-[\d-]+\.db$/

router.get('/', (_req: Request, res: Response) => {
  return res.json({ success: true, data: { backups: listBackups() } })
})

router.post('/', (_req: Request, res: Response) => {
  const filename = createBackup()
  return res.json({ success: true, data: { filename } })
})

router.post('/:filename/restore', (req: Request, res: Response) => {
  const { filename } = req.params
  if (!filename || !FILENAME_RE.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' })
  }
  restoreFromBackup(filename)
  return res.json({ success: true })
})

router.delete('/:filename', (req: Request, res: Response) => {
  const { filename } = req.params
  if (!filename || !FILENAME_RE.test(filename)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' })
  }
  deleteBackup(filename)
  return res.json({ success: true })
})

export default router
