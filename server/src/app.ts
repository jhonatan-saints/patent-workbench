import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import 'express-async-errors';
import dotenv from 'dotenv';
import { z } from 'zod';

import { generate, checkLLM } from './services/llm.service';
import logger from './logger';
import errorHandler from './middleware/errorHandler';
import { validateBody } from './middleware/validate';
import { sanitizePrompt } from './middleware/sanitize';

dotenv.config();

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';
const bodyLimit = process.env.BODY_LIMIT || '128kb';

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: bodyLimit }));
app.use(compression());

// Global rate limit
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_MAX) || 100,
  })
);

// Stricter rate limit for LLM endpoint
app.use(
  '/generate',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
  })
);

app.use(
  pinoHttp({
    logger,
  }) as any
);

/**
 * GET /status
 */
app.get('/status', async (req, res) => {
  const start = Date.now();
  const llmAvailable = await checkLLM();
  const latency = Date.now() - start;

  return res.json({
    success: true,
    data: {
      server: 'ok',
      llm: llmAvailable ? 'ok' : 'unavailable',
      latency,
    },
  });
});

/**
 * Schema
 */
const generateSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().optional(),
});

type GenerateBody = z.infer<typeof generateSchema>;

const llmResponseSchema = z.object({ response: z.string().min(0).optional() });

/**
 * POST /generate
 */
app.post(
  '/generate',
  validateBody(generateSchema),
  sanitizePrompt(),
  async (req, res) => {
    const { prompt, model } = req.body as GenerateBody;

    const result = await generate({ model: model || 'mistral', prompt });

    if (!result) {
      return res.status(502).json({ success: false, error: 'Failed to generate response' });
    }

    const parsed = llmResponseSchema.safeParse({ response: result });
    if (!parsed.success) {
      logger.warn({ parsed }, 'LLM returned invalid shape');
      return res.status(502).json({ success: false, error: 'Invalid response from LLM' });
    }

    return res.json({ success: true, data: parsed.data });
  }
);

// Error handler (sempre por último)
app.use(errorHandler);

export default app;