import { NextFunction, Request, Response } from 'express';

const DEFAULT_PROMPT_MAX = Number(process.env.PROMPT_MAX_LENGTH) || 2000;

export const sanitizePrompt = (maxLen = DEFAULT_PROMPT_MAX) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body && typeof req.body.prompt === 'string') {
    // trim and collapse whitespace
    let prompt = req.body.prompt.trim().replaceAll(/\s+/g, ' ');

    if (prompt.length > maxLen) {
      prompt = prompt.slice(0, maxLen);
    }

    req.body.prompt = prompt;
  }

  return next();
};

export default sanitizePrompt;
