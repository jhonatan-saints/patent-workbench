import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db from '../services/db'

const router = Router()

function tryParse<T = unknown>(s: string): T | undefined {
  try { return JSON.parse(s) as T } catch { return undefined }
}

// Safe data URL MIME types
// Allows any image/* subtype (covers BMP, TIFF, ICO, etc.) plus application/json.
// Explicitly excludes text/html and application/javascript to prevent stored XSS.
const SAFE_DATA_URL_RE =
  /^data:(image\/[a-zA-Z0-9.+_-]+|application\/json)(;[^,]*)?,/

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

const generatedOptionSchema = z.object({
  id: z.string(),
  index: z.number(),
  content: z.string(),
})

const stepInputStateSchema = z.object({
  moduleId: z.string().min(1),
  inputMode: z.enum(['auto', 'guided', 'manual']),
  guidedFields: z.record(z.string()).default({}),
  manualDraft: z.string().default(''),
  optionsByMode: z
    .object({
      auto: z.array(generatedOptionSchema).default([]),
      guided: z.array(generatedOptionSchema).default([]),
    })
    .optional(),
  status: z.enum(['pending', 'input', 'generating', 'selecting', 'done']).optional(),
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
  stepInputStates: z.array(stepInputStateSchema).optional(),
  figuresDraft: z.object({
    diagramNodes: z.array(z.unknown()).default([]),
    diagramEdges: z.array(z.unknown()).default([]),
    jsonText: z.string().default(''),
  }).optional(),
  lastPhase: z.enum(['input', 'working', 'figures', 'inventors', 'preview', 'review']).optional(),
  lastStepIndex: z.number().optional(),
  reviewResult: z.unknown().optional(),
})

// GET /sessions — list without figures (lightweight)
router.get('/', (_req: Request, res: Response) => {
  const sessions = db
    .prepare(
      `SELECT id, started_at, completed_at, base_idea, model, total_tokens, artifact, step_input_states, figures_draft, nav_state, review_result
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
    step_input_states: string | null
    figures_draft: string | null
    nav_state: string | null
    review_result: string | null
  }>

  // Batch-load all figure metadata in a single query instead of one per session
  const figuresBySession = new Map<string, Array<{ id: string; name: string; caption: string; width: number; height: number; type: string }>>()
  if (sessions.length > 0) {
    const placeholders = sessions.map(() => '?').join(',')
    const sessionIds = sessions.map((s) => s.id)
    const allFigures = db
      .prepare(
        `SELECT id, session_id, name, caption, width, height, type, sort_order
         FROM figures WHERE session_id IN (${placeholders}) ORDER BY sort_order`
      )
      .all(...sessionIds) as Array<{
      id: string
      session_id: string
      name: string
      caption: string
      width: number
      height: number
      type: string
      sort_order: number
    }>
    for (const { sort_order: _so, session_id, ...fig } of allFigures) {
      const arr = figuresBySession.get(session_id) ?? []
      arr.push(fig)
      figuresBySession.set(session_id, arr)
    }
  }

  const result = sessions.flatMap((row) => {
    const artifact = tryParse<Record<string, unknown>>(row.artifact)
    if (!artifact) return []
    return [{
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      baseIdea: row.base_idea,
      model: row.model,
      totalTokens: row.total_tokens,
      artifact: { ...artifact, figures: figuresBySession.get(row.id) ?? [] },
      stepInputStates: row.step_input_states ? tryParse(row.step_input_states) : undefined,
      figuresDraft: row.figures_draft ? tryParse(row.figures_draft) : undefined,
      ...(row.nav_state ? tryParse<{ lastPhase: string; lastStepIndex: number | null }>(row.nav_state) ?? {} : {}),
      reviewResult: row.review_result ? tryParse(row.review_result) : undefined,
    }]
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
        step_input_states: string | null
        figures_draft: string | null
        nav_state: string | null
        review_result: string | null
      }
    | undefined

  if (!row) return res.status(404).json({ success: false, error: 'Session not found' })

  let artifact: Record<string, unknown>
  try { artifact = JSON.parse(row.artifact) as Record<string, unknown> } catch {
    return res.status(500).json({ success: false, error: 'Corrupted session data' })
  }
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
      stepInputStates: row.step_input_states ? tryParse(row.step_input_states) : undefined,
      figuresDraft: row.figures_draft ? tryParse(row.figures_draft) : undefined,
      ...(row.nav_state ? tryParse<{ lastPhase: string; lastStepIndex: number | null }>(row.nav_state) ?? {} : {}),
      reviewResult: row.review_result ? tryParse(row.review_result) : undefined,
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

  const { id, startedAt, completedAt, baseIdea, model, totalTokens, artifact, stepInputStates, figuresDraft, lastPhase, lastStepIndex, reviewResult } = parsed.data
  const { figures, ...artifactWithoutFigures } = artifact

  db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO sessions
         (id, started_at, completed_at, base_idea, model, total_tokens, artifact, step_input_states, figures_draft, nav_state, review_result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, startedAt, completedAt, baseIdea, model, totalTokens,
      JSON.stringify(artifactWithoutFigures),
      stepInputStates ? JSON.stringify(stepInputStates) : null,
      figuresDraft ? JSON.stringify(figuresDraft) : null,
      lastPhase == null ? null : JSON.stringify({ lastPhase, lastStepIndex: lastStepIndex ?? null }),
      reviewResult ? JSON.stringify(reviewResult) : null,
    )

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
