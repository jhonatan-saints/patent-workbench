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
  llmTimeoutMs: z.number().int().min(5_000).max(86_400_000),
  numOptions: z.number().int().min(1).max(5),
  ollamaUrl: z.string().url('Invalid Ollama URL').max(512),
  promptMaxLength: z.number().int().min(1_000).max(200_000),
  shutdownTimeoutMs: z.number().int().min(1_000).max(86_400_000),
  logLevel: z.enum(LOG_LEVELS),
  apiKey: z.string().max(256).optional(),
})

const SETTINGS_DEFAULTS = {
  defaultModel: 'qwen2.5:7b',
  llmTimeoutMs: 300_000,
  numOptions: 3,
  ollamaUrl: 'http://localhost:11434',
  promptMaxLength: 16_000,
  shutdownTimeoutMs: 3_600_000,
  logLevel: 'info' as const,
  apiKey: undefined as string | undefined,
}

function rowToResponse(row: ReturnType<typeof getAppSettings>) {
  return {
    defaultModel: row.default_model,
    llmTimeoutMs: row.llm_timeout_ms,
    numOptions: row.num_options,
    ollamaUrl: row.ollama_url,
    promptMaxLength: row.prompt_max_length,
    shutdownTimeoutMs: row.shutdown_timeout_ms,
    logLevel: row.log_level,
    apiKey: row.api_key ?? undefined,
  }
}

// GET /settings — return current settings
router.get('/', (_req: Request, res: Response) => {
  return res.json({ success: true, data: rowToResponse(getAppSettings()) })
})

// PUT /settings — update settings
router.put('/', (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input')
    return res.status(400).json({ success: false, error: 'Validation failed', fields })
  }

  const { defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel, apiKey } = parsed.data

  db.prepare(
    `UPDATE app_settings
     SET default_model = ?, llm_timeout_ms = ?, num_options = ?, ollama_url = ?,
         prompt_max_length = ?, shutdown_timeout_ms = ?, log_level = ?, api_key = ?
     WHERE id = 1`
  ).run(defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel, apiKey ?? null)

  logger.level = logLevel

  return res.json({ success: true, data: parsed.data })
})

// POST /settings/reset — restore factory defaults
router.post('/reset', (_req: Request, res: Response) => {
  const { defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel } = SETTINGS_DEFAULTS
  db.prepare(
    `UPDATE app_settings
     SET default_model = ?, llm_timeout_ms = ?, num_options = ?, ollama_url = ?,
         prompt_max_length = ?, shutdown_timeout_ms = ?, log_level = ?, api_key = NULL
     WHERE id = 1`
  ).run(defaultModel, llmTimeoutMs, numOptions, ollamaUrl, promptMaxLength, shutdownTimeoutMs, logLevel)
  logger.level = logLevel
  return res.json({ success: true, data: SETTINGS_DEFAULTS })
})

export default router
