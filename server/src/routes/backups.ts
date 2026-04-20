import express, { Router, type Request, type Response } from 'express'
import { getDbPath, checkpointDb, restoreFromBuffer } from '../services/db'

const router = Router()

router.get('/export', (_req: Request, res: Response) => {
  checkpointDb()
  const stamp = new Date().toISOString().slice(0, 10)
  res.download(getDbPath(), `workbench-backup-${stamp}.db`)
})

router.post('/import', express.raw({ type: 'application/octet-stream', limit: '100mb' }), (req: Request, res: Response) => {
  const buf = req.body as Buffer
  if (!Buffer.isBuffer(buf) || buf.length < 16) {
    return res.status(400).json({ success: false, error: 'No file data received' })
  }
  restoreFromBuffer(buf)
  return res.json({ success: true })
})

export default router
