import express, { Router, type Request, type Response } from 'express'
import AdmZip from 'adm-zip'
import { getDbPath, checkpointDb, restoreFromBuffer } from '../services/db'

const router = Router()

router.get('/export', (_req: Request, res: Response) => {
  checkpointDb()
  const stamp = new Date().toISOString().slice(0, 10)
  const zip = new AdmZip()
  zip.addLocalFile(getDbPath(), '', 'workbench.db')
  const buf = zip.toBuffer()
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="workbench-backup-${stamp}.zip"`)
  res.send(buf)
})

// ZIP magic bytes: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

router.post('/import', express.raw({ type: '*/*', limit: '100mb' }), (req: Request, res: Response) => {
  const buf = req.body as Buffer
  if (!Buffer.isBuffer(buf) || buf.length < 4) {
    return res.status(400).json({ success: false, error: 'No file data received' })
  }

  let dbBuf: Buffer
  if (buf.subarray(0, 4).equals(ZIP_MAGIC)) {
    const zip = new AdmZip(buf)
    const entry = zip.getEntry('workbench.db')
    if (!entry) {
      return res.status(400).json({ success: false, error: 'ZIP does not contain workbench.db' })
    }
    dbBuf = zip.readFile(entry) as Buffer
  } else {
    dbBuf = buf
  }

  restoreFromBuffer(dbBuf)
  return res.json({ success: true })
})

export default router
