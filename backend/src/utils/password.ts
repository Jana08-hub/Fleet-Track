import bcrypt from 'bcryptjs';

// Cost factor: 12 in production (secure), lower in tests for speed.
// Override with BCRYPT_ROUNDS env (vitest sets 4).
export function bcryptRounds(): number {
  const n = Number(process.env.BCRYPT_ROUNDS || 12);
  return Number.isFinite(n) && n >= 4 && n <= 15 ? Math.floor(n) : 12;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, bcryptRounds());
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
