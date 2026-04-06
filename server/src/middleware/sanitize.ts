import { NextFunction, Request, Response } from 'express'
import logger from '../logger'
import { getAppSettings } from '../services/db'

/**
 * Normalise text before injection detection to defeat Unicode substitution,
 * mixed-case tricks, and irregular whitespace.
 */
function normaliseForDetection(text: string): string {
  return text
    .normalize('NFKC')    // canonical Unicode decomposition (e.g. ｉｇｎｏｒｅ → ignore)
    .replaceAll(/\s+/g, ' ') // collapse all whitespace variants to a single space
    .toLowerCase()
}

const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/,
  /you are now/,
  /act as (a |an )?/,
  /jailbreak/,
  /disregard (all |previous |your )?/,
  /forget (all |previous |your )?instructions/,
  /new persona/,
  /bypass (your |all )?/,
  // Extended synonyms and common jailbreak idioms
  /override (all |your |previous )?instructions/,
  /pretend (you are|to be)/,
  /roleplay as/,
  /from now on (you are|ignore|disregard|forget)/,
  /your (new |updated )?instructions (are|is)/,
  /stop being a/,
  /system prompt/,
  /\[system\]/,
  /\bdan\b/,             // "Do Anything Now" jailbreak
  /developer mode/,
  /unrestricted mode/,
  /without restrictions/,
  /no restrictions/,
]

export const sanitizePrompt = () => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const maxLen = getAppSettings().prompt_max_length
  if (req.body && typeof req.body.prompt === 'string') {
    // Collapse runs of spaces/tabs — preserve newlines so structured prompts stay intact
    const prompt = req.body.prompt.trim().replaceAll(/ {2,}/g, ' ')

    // H-1: reject instead of silently truncating — truncation can hide injections near the limit
    if (prompt.length > maxLen) {
      logger.warn(
        { originalLength: prompt.length, maxLen, requestId: req.headers['x-request-id'] },
        'Prompt rejected: exceeds max length'
      )
      return res.status(400).json({
        success: false,
        error: 'Prompt exceeds maximum length',
      })
    }

    const normalised = normaliseForDetection(prompt)
    const hasInjection = INJECTION_PATTERNS.some((p) => p.test(normalised))
    if (hasInjection) {
      logger.warn(
        { requestId: req.headers['x-request-id'] },
        'Prompt rejected: injection pattern detected'
      )
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
