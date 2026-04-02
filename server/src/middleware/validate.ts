import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      // M-2: return only field names — not Zod messages — to avoid leaking schema internals
      const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input');

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fields,
      });
    }

    req.body = parsed.data;
    return next();
  };

export default validateBody;