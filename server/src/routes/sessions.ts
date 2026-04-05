import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../services/db'

const router = Router()

// Safe data URL MIME types
// We explicitly excluded text/html and text/javascript to prevent stored XSS.
const SAFE_DATA_URL_RE =
  /^data:(image\/(png|jpeg|gif|webp|svg\+xml)|application\/json)(;base64)?,/

// Zod schema for figure items
const figureSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  caption: z.string().default(''),
  width: z.number().optional(),
  height: z.number().optional(),
  type: z.enum(['image', 'diagram', 'json']).default('image'),
  dataUrl: z
    .string()
    .min(1)
    .refine((v) => SAFE_DATA_URL_RE.test(v), {
      message: 'dataUrl must be a safe image or JSON data URL',
    }),
})

// Zod schema for saving a session
const saveSessionSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number(),
  completedAt: z.number(),
  baseIdea: z.string().min(1),
  model: z.string().min(1),
  totalTokens: z.number().default(0),
  artifact: z.object({
    figures: z.array(figureSchema).default([]),
  }).passthrough(),
})

// GET /sessions — list without figures (lightweight)
router.get('/', (_req: Request, res: Response) => {
  const sessions = db
    .prepare(
      `SELECT id, started_at, completed_at, base_idea, model, total_tokens, artifact
       FROM sessions ORDER BY started_at DESC LIMIT 100`
    )
    .all() as Array<{
    id: string
    started_at: number
    completed_at: number
    base_idea: string
    model: string
    total_tokens: number
    artifact: string
  }>

  const result = sessions.map((row) => {
    const artifact = JSON.parse(row.artifact)
    // Attach figure metadata (without dataUrl) so client can show figure count
    const figureMeta = (
      db
        .prepare(
          `SELECT id, name, caption, width, height, type, sort_order
           FROM figures WHERE session_id = ? ORDER BY sort_order`
        )
        .all(row.id) as Array<{
        id: string
        name: string
        caption: string
        width: number
        height: number
        type: string
        sort_order: number
      }>
    ).map(({ sort_order: _so, ...f }) => f)

    return {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      baseIdea: row.base_idea,
      model: row.model,
      totalTokens: row.total_tokens,
      artifact: { ...artifact, figures: figureMeta },
    }
  })

  return res.json({ success: true, data: result })
})

// GET /sessions/:id — full session including figure dataUrls
router.get('/:id', (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(req.params.id) as
    | {
        id: string
        started_at: number
        completed_at: number
        base_idea: string
        model: string
        total_tokens: number
        artifact: string
      }
    | undefined

  if (!row) return res.status(404).json({ success: false, error: 'Session not found' })

  const artifact = JSON.parse(row.artifact)
  const figures = (
    db
      .prepare('SELECT * FROM figures WHERE session_id = ? ORDER BY sort_order')
      .all(row.id) as Array<{
      id: string
      name: string
      caption: string
      width: number
      height: number
      type: string
      data_url: string
      sort_order: number
    }>
  ).map(({ data_url, sort_order: _so, ...f }) => ({ ...f, dataUrl: data_url }))

  return res.json({
    success: true,
    data: {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      baseIdea: row.base_idea,
      model: row.model,
      totalTokens: row.total_tokens,
      artifact: { ...artifact, figures },
    },
  })
})

// POST /sessions — create or replace a session
router.post('/', (req: Request, res: Response) => {
  const parsed = saveSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input')
    return res.status(400).json({ success: false, error: 'Validation failed', fields })
  }

  const { id, startedAt, completedAt, baseIdea, model, totalTokens, artifact } = parsed.data
  const { figures, ...artifactWithoutFigures } = artifact

  db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO sessions
         (id, started_at, completed_at, base_idea, model, total_tokens, artifact)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, startedAt, completedAt, baseIdea, model, totalTokens, JSON.stringify(artifactWithoutFigures))

    db.prepare('DELETE FROM figures WHERE session_id = ?').run(id)

    const insertFigure = db.prepare(
      `INSERT INTO figures (id, session_id, name, caption, width, height, type, data_url, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    figures.forEach((f, i) => {
      insertFigure.run(f.id, id, f.name, f.caption, f.width ?? null, f.height ?? null, f.type, f.dataUrl, i)
    })
  })()

  return res.json({ success: true })
})

// DELETE /sessions/:id
router.delete('/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id)
  return res.json({ success: true })
})

// DELETE /sessions — clear all
router.delete('/', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM sessions').run()
  return res.json({ success: true })
})

export default router
