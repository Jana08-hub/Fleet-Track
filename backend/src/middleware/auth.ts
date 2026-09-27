import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

export interface AuthRequest extends Request {
  user?: { id: string; role: 'ADMIN' | 'DRIVER'; email: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const cookieToken = (req as any).cookies?.fleettrack_token;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const payload = verifyJwt(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.accountStatus === 'DISABLED') return res.status(401).json({ error: 'Account disabled' });
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Your email address has not been verified yet. Please check your email or contact the administrator.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    req.user = { id: user.id, role: user.role as any, email: user.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid session' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
}
