import { Router, Request, Response } from 'express'
import { z } from 'zod'
import db, { getAppSettings } from '../services/db'
import logger from '../logger'

const router = Router()

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const

const settingsSchema = z.object({
  defaultModel: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9._:/-]+$/, 'Invalid model name'),
  llmTimeoutMs: z.number().int().min(5_000).max(600_000),
  numOptions: z.number().int().min(1).max(5),
  ollamaUrl: z.string().url('Invalid Ollama URL').max(512),
  promptMaxLength: z.number().int().min(1_000).max(200_000),
  shutdownTimeoutMs: z.number().int().min(1_000).max(86_400_000),
  logLevel: z.enum(LOG_LEVELS),
})

// GET /settings — return current settings
router.get('/', (_req: Request, res: Response) => {
  const row = getAppSettings()
  return res.json({
    success: true,
    data: {
      defaultModel: row.default_model,
      llmTimeoutMs: row.llm_timeout_ms,
      numOptions: row.num_options,
      ollamaUrl: row.ollama_url,
      promptMaxLength: row.prompt_max_length,
      shutdownTimeoutMs: row.shutdown_timeout_ms,
      logLevel: row.log_level,
    },
  })
})

// PUT /settings — update settings
router.put('/', (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input')
    return res.status(400).json({ success: false, error: 'Validation failed', fields })
  }

  const { defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel } = parsed.data

  db.prepare(
    `UPDATE app_settings
     SET default_model = ?, llm_timeout_ms = ?, num_options = ?, ollama_url = ?,
         prompt_max_length = ?, shutdown_timeout_ms = ?, log_level = ?
     WHERE id = 1`
  ).run(defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel)

  // Apply log level change immediately — no restart needed
  logger.level = logLevel

  return res.json({
    success: true,
    data: parsed.data,
  })
})

export default router
