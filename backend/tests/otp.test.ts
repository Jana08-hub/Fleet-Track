import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import crypto from 'crypto';
import { prisma } from '../src/utils/prisma.js';
import { requestRegistrationOtp, verifyRegistrationOtp } from '../src/services/otp.js';

const stamp = Date.now().toString(36);
const mkEmail = (n: string) => `otp-test-${n}-${stamp}@example.com`;
const createdEmails: string[] = [];

function codeHash(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function cleanup() {
  for (const email of createdEmails.splice(0)) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.driver.deleteMany({ where: { userId: u.id } });
      await prisma.emailLog.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.otpToken.deleteMany({ where: { email } });
    await prisma.emailLog.deleteMany({ where: { recipientEmail: email, userId: null } });
  }
}
afterEach(cleanup);

const details = (n: string, license: string) => ({
  name: 'OTP Tester',
  email: mkEmail(n),
  password: 'TestPass@123',
  phoneNumber: '+919000000009',
  licenseNumber: `OTP-LIC-${license}-${stamp}`,
  licenseExpiry: '2030-01-01',
});

describe('OTP registration', () => {
  it('requests an OTP and stores a hashed record + email log', async () => {
    const d = details('a', 'A1');
    createdEmails.push(d.email);
    const r = await requestRegistrationOtp(d);
    expect(r.message).toContain('6-digit code');
    const rec = await prisma.otpToken.findFirst({ where: { email: d.email, usedAt: null } });
    expect(rec).toBeTruthy();
    expect(rec!.otpHash).toHaveLength(64);
    expect(rec!.payload).toContain('passwordHash');
    expect(rec!.payload).not.toContain('TestPass@123');
    const log = await prisma.emailLog.findFirst({ where: { emailType: 'REGISTRATION_OTP' }, orderBy: { sentAt: 'desc' } });
    expect(log?.status).toBe('SENT');
    // EMAIL_REDIRECT_TO is set in this environment: mail lands in the admin inbox
    expect(log?.recipientEmail).toBe(process.env.EMAIL_REDIRECT_TO || d.email);
  });

  it('rejects an already-registered email with 409', async () => {
    const d = details('b', 'B1');
    d.email = 'admin@fleettrack.example';
    await expect(requestRegistrationOtp(d)).rejects.toMatchObject({ status: 409 });
  });

  it('enforces 60s resend cooldown with 429', async () => {
    const d = details('c', 'C1');
    createdEmails.push(d.email);
    await requestRegistrationOtp(d);
    await expect(requestRegistrationOtp(d)).rejects.toMatchObject({ status: 429 });
  });

  it('verifies a correct code and creates a verified driver account', async () => {
    const d = details('d', 'D1');
    createdEmails.push(d.email);
    await requestRegistrationOtp(d);
    // read the DB row and re-hash a KNOWN code by replacing it
    const code = '123456';
    await prisma.otpToken.updateMany({ where: { email: d.email, usedAt: null }, data: { otpHash: codeHash(code) } });
    const out = await verifyRegistrationOtp(d.email, code);
    expect(out.needsApproval).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: d.email }, include: { driverProfile: true } });
    expect(user?.emailVerified).toBe(true);
    expect(user?.role).toBe('DRIVER');
    expect(user?.accountApproved).toBe(false);
    expect(user?.driverProfile?.licenseNumber).toBe(d.licenseNumber);
  });

  it('rejects wrong codes, counts attempts, burns after 5', async () => {
    const d = details('e', 'E1');
    createdEmails.push(d.email);
    await requestRegistrationOtp(d);
    const code = '654321';
    await prisma.otpToken.updateMany({ where: { email: d.email, usedAt: null }, data: { otpHash: codeHash(code) } });
    await expect(verifyRegistrationOtp(d.email, '000000')).rejects.toMatchObject({ status: 400 });
    const rec = await prisma.otpToken.findFirst({ where: { email: d.email } });
    expect(rec?.attempts).toBe(1);
    for (let i = 0; i < 4; i++) {
      await verifyRegistrationOtp(d.email, '000000').catch((e) => e);
    }
    await expect(verifyRegistrationOtp(d.email, code)).rejects.toMatchObject({ status: 400 });
    const user = await prisma.user.findUnique({ where: { email: d.email } });
    expect(user).toBeNull();
  });

  it('rejects reuse of a consumed code', async () => {
    const d = details('f', 'F1');
    createdEmails.push(d.email);
    await requestRegistrationOtp(d);
    const code = '112233';
    await prisma.otpToken.updateMany({ where: { email: d.email, usedAt: null }, data: { otpHash: codeHash(code) } });
    await verifyRegistrationOtp(d.email, code);
    await expect(verifyRegistrationOtp(d.email, code)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects expired codes', async () => {
    const d = details('g', 'G1');
    createdEmails.push(d.email);
    await prisma.otpToken.create({
      data: { email: d.email, otpHash: codeHash('999999'), purpose: 'REGISTRATION', payload: '{}', expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(verifyRegistrationOtp(d.email, '999999')).rejects.toMatchObject({ status: 400 });
  });
});
