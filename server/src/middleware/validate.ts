import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        error: errors,
      });
    }

    req.body = parsed.data;
    return next();
  };

export default validateBody;