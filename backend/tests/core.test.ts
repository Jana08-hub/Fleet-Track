import { describe, it, expect } from 'vitest';
import { haversineKm, isValidLat, isValidLng, hashToken, generateVerificationToken } from '../src/utils/tokens.js';

describe('haversine', () => {
  it('calculates ~111km per degree latitude', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeGreaterThan(110);
    expect(haversineKm(0, 0, 1, 0)).toBeLessThan(112);
  });
});
describe('gps validation', () => {
  it('rejects out of range', () => {
    expect(isValidLat(91)).toBe(false);
    expect(isValidLng(200)).toBe(false);
    expect(isValidLat(20.5)).toBe(true);
  });
});
describe('tokens', () => {
  it('single-use hash roundtrip', () => {
    const { token, tokenHash } = generateVerificationToken();
    expect(hashToken(token)).toBe(tokenHash);
  });
});
