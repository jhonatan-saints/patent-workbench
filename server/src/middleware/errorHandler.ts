import { NextFunction, Request, Response } from 'express';
import logger from '../logger';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path }, 'Unhandled error');

  const status = err?.status || 500;
  const message = err?.message || 'Internal server error';

  res.status(status).json({
    success: false,
    error: message,
  });
}

export default errorHandler;