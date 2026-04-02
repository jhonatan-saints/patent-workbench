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
import { generate, checkLLM, listModels, getModelContextLength } from './services/llm.service'
import logger from './logger'
import errorHandler from './middleware/errorHandler'
import { validateBody } from './middleware/validate'
import { sanitizePrompt } from './middleware/sanitize'

dotenv.config()

const app = express()

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const bodyLimit = process.env.BODY_LIMIT || '512kb'
const promptSchemaMax = Number(process.env.PROMPT_MAX_LENGTH) || 64000
const defaultModel = process.env.DEFAULT_MODEL || 'mistral'
const generateRateWindowMs = Number(process.env.GENERATE_RATE_WINDOW_MS) || 60_000
const generateRateMax = Number(process.env.GENERATE_RATE_MAX) || 20

// M-1: Fail fast in production if CORS origin is not explicitly configured
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be set explicitly in production')
}


// H-3: trust reverse-proxy X-Forwarded-For only when explicitly configured
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

// M-3: explicit CSP directives instead of Helmet defaults
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // required by Mantine
        imgSrc: ["'self'", 'data:'],             // figures are data URLs
        connectSrc: ["'self'"],                  // API calls via same-origin proxy
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    hsts: { maxAge: 31536000 },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
  })
)

// CORS
app.use(cors({ origin: corsOrigin }))

// Body parsing
app.use(express.json({ limit: bodyLimit }))
app.use(compression())

// Request ID
app.use((req, _res, next) => {
  req.headers['x-request-id'] ??= randomUUID()
  next()
})

// Rate limiting
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_MAX) || 100,
  })
)

app.use(
  '/generate',
  rateLimit({
    windowMs: generateRateWindowMs,
    max: generateRateMax,
  })
)

// M-4: optional API key — only enforced when API_KEY env var is set
if (process.env.API_KEY) {
  app.use((req, res, next) => {
    if (req.headers['x-api-key'] !== process.env.API_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    return next()
  })
}

// Logging (without body or query params — sensitive data)
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // L-3: strip query string to avoid logging future token/key params
        const urlWithoutQuery = req.url?.split('?')[0] ?? req.url
        return {
          id: req.headers['x-request-id'],
          method: req.method,
          url: urlWithoutQuery,
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

// Schema
const generateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(promptSchemaMax, 'Prompt too long'),
  model: z.string().optional(),
})

type GenerateBody = z.infer<typeof generateSchema>

const llmResponseSchema = z.object({
  response: z.string().min(0).optional(),
})

// GET /models
app.get('/models', async (_req: Request, res: Response) => {
  const models = await listModels()
  return res.json({ success: true, data: { models } })
})

const modelNameSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9._:/-]+$/, 'Invalid model name'),
})

// GET /models/:name/context
app.get('/models/:name/context', async (req: Request, res: Response) => {
  const parsed = modelNameSchema.safeParse({ name: req.params.name })
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid model name' })
  }
  const contextLength = await getModelContextLength(parsed.data.name)
  return res.json({ success: true, data: { contextLength } })
})

// GET /status
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

// POST /generate
app.post(
  '/generate',
  validateBody(generateSchema),
  sanitizePrompt(),
  async (req: Request, res: Response) => {
    const { prompt, model } = req.body as GenerateBody

    // Abort Ollama immediately when the HTTP client disconnects (e.g. user clicks Stop)
    const clientController = new AbortController()
    req.on('close', () => clientController.abort())

    const result = await generate({
      model: model || defaultModel,
      prompt,
      signal: clientController.signal,
    })

    // Client disconnected — socket is gone, nothing to send
    if (clientController.signal.aborted) return

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

// Error handler (must be last middleware)
app.use(errorHandler)

export default app