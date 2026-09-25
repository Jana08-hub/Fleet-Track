import crypto from 'crypto';
import { createHash } from 'crypto';

export function generateVerificationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Haversine distance in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}
export function isValidLng(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
