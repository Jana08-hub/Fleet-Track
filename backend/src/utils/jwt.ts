import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES = '7d';

export interface JwtPayload {
  sub: string;
  role: 'ADMIN' | 'DRIVER';
  email: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
