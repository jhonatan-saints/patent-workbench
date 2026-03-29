import { randomUUID } from 'node:crypto'
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import 'express-async-errors'
import dotenv from 'dotenv'
import { z } from 'zod'
import { generate, checkLLM, listModels } from './services/llm.service'
import logger from './logger'
import errorHandler from './middleware/errorHandler'
import { validateBody } from './middleware/validate'
import { sanitizePrompt } from './middleware/sanitize'

dotenv.config()

const app = express()

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const bodyLimit = process.env.BODY_LIMIT || '128kb'


// ─── Security headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    hsts: { maxAge: 31536000 },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
)

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({ origin: corsOrigin }))

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: bodyLimit }))
app.use(compression())

// ─── Request ID ──────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.headers['x-request-id'] ??= randomUUID()
  next()
})

// ─── Rate limiting ───────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_MAX) || 100,
  })
)

app.use(
  '/generate',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
  })
)

// ─── Logging (sem body — dados confidenciais) ─────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.headers['x-request-id'],
          method: req.method,
          url: req.url,
        }
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        }
      },
    },
  }) as any
)

// ─── Schema ──────────────────────────────────────────────────────────────────
const generateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt too long'),
  model: z.string().optional(),
})

type GenerateBody = z.infer<typeof generateSchema>

const llmResponseSchema = z.object({
  response: z.string().min(0).optional(),
})

// ─── GET /models ──────────────────────────────────────────────────────────────
app.get('/models', async (_req: Request, res: Response) => {
  const models = await listModels()
  return res.json({ success: true, data: { models } })
})

// ─── GET /status ──────────────────────────────────────────────────────────────
app.get('/status', async (_req: Request, res: Response) => {
  const start = Date.now()
  const llmAvailable = await checkLLM()
  const latency = Date.now() - start

  return res.json({
    success: true,
    data: {
      server: 'ok',
      llm: llmAvailable ? 'ok' : 'unavailable',
      latency,
    },
  })
})

// ─── POST /generate ───────────────────────────────────────────────────────────
app.post(
  '/generate',
  validateBody(generateSchema),
  sanitizePrompt(),
  async (req: Request, res: Response) => {
    const { prompt, model } = req.body as GenerateBody

    const result = await generate({
      model: model || 'mistral',
      prompt,
    })

    if (!result) {
      return res.status(502).json({
        success: false,
        error: 'Failed to generate response',
      })
    }

    const parsed = llmResponseSchema.safeParse({ response: result.response })
    if (!parsed.success) {
      logger.warn({ requestId: req.headers['x-request-id'] }, 'LLM returned invalid shape')
      return res.status(502).json({
        success: false,
        error: 'Invalid response from LLM',
      })
    }

    return res.json({
      success: true,
      data: {
        ...parsed.data,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      },
    })
  }
)

// ─── Error handler (sempre por último) ───────────────────────────────────────
app.use(errorHandler)

export default app