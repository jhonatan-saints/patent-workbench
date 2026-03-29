import { NextFunction, Request, Response } from 'express'

const DEFAULT_PROMPT_MAX = Number(process.env.PROMPT_MAX_LENGTH) || 4000

const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /you are now/i,
  /act as (a |an )?/i,
  /system:/i,
  /\[system\]/i,
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
    let prompt = req.body.prompt.trim().replaceAll(/\s+/g, ' ')

    if (prompt.length > maxLen) {
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