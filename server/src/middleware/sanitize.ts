import { NextFunction, Request, Response } from 'express'
import logger from '../logger'

const DEFAULT_PROMPT_MAX = Number(process.env.PROMPT_MAX_LENGTH) || 16000

const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /you are now/i,
  /act as (a |an )?/i,
  /jailbreak/i,
  /disregard (all |previous |your )?/i,
  /forget (all |previous |your )?instructions/i,
  /new persona/i,
  /bypass (your |all )?/i,
]

export const sanitizePrompt = (maxLen = DEFAULT_PROMPT_MAX) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body && typeof req.body.prompt === 'string') {
    // Collapse only runs of spaces/tabs — preserve newlines so structured prompts stay intact
    let prompt = req.body.prompt.trim().replaceAll(/ {2,}/g, ' ')

    if (prompt.length > maxLen) {
      logger.warn(
        { originalLength: prompt.length, maxLen, requestId: req.headers['x-request-id'] },
        'Prompt truncated to max length'
      )
      prompt = prompt.slice(0, maxLen)
    }

    const hasInjection = INJECTION_PATTERNS.some((p) => p.test(prompt))
    if (hasInjection) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prompt content',
      })
    }

    req.body.prompt = prompt
  }
  return next()
}

export default sanitizePrompt