import { NextFunction, Request, Response } from 'express';
import logger from '../logger';

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path }, 'Unhandled error');

  const status = (err instanceof Error && 'status' in err && typeof (err as Error & { status: unknown }).status === 'number')
    ? (err as Error & { status: number }).status
    : 500;

  // Never expose internal error details for server errors — only return
  // the client-provided message for explicit 4xx validation errors.
  const message =
    status < 500 ? ((err instanceof Error && err.message) || 'Bad request') : 'Internal server error';

  res.status(status).json({
    success: false,
    error: message,
  });
}

export default errorHandler;