import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return res.status(400).json({ error: 'Validation failed', details: r.error.flatten() });
    req.body = r.data;
    next();
  };
}
