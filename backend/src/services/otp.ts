import crypto from 'crypto';
import { hashPassword } from '../utils/password.js';
import { prisma } from '../utils/prisma.js';
import { sendMail } from '../email/mailer.js';
import { emailTemplates } from '../email/templates.js';
import { audit } from './audit.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export interface RegistrationDetails {
  name: string;
  email: string;
  password: string;
  phoneNumber: string;
  licenseNumber: string;
  licenseExpiry: string;
}

function otpHash(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Step 1: validate details, store hashed OTP, email the code. */
export async function requestRegistrationOtp(d: RegistrationDetails, req?: any) {
  const email = d.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err: any = new Error('An account with this email already exists. Please log in.');
    err.status = 409;
    throw err;
  }
  const licenseTaken = await prisma.driver.findUnique({ where: { licenseNumber: d.licenseNumber } });
  if (licenseTaken) {
    const err: any = new Error('This license number is already registered.');
    err.status = 409;
    throw err;
  }
  const recent = await prisma.otpToken.findFirst({
    where: { email, purpose: 'REGISTRATION', usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    const err: any = new Error(`Please wait ${Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000)}s before requesting a new code.`);
    err.status = 429;
    throw err;
  }
  // supersede older unused codes
  await prisma.otpToken.updateMany({ where: { email, purpose: 'REGISTRATION', usedAt: null }, data: { usedAt: new Date() } });

  const code = crypto.randomInt(100000, 1000000).toString();
  const payload = JSON.stringify({
    name: d.name,
    passwordHash: await hashPassword(d.password),
    phoneNumber: d.phoneNumber,
    licenseNumber: d.licenseNumber,
    licenseExpiry: d.licenseExpiry,
  });
  await prisma.otpToken.create({
    data: { email, otpHash: otpHash(code), purpose: 'REGISTRATION', payload, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  const t = emailTemplates.otp(d.name, code);
  try {
    const sent = await sendMail(email, t.subject, t.html, t.text);
    await prisma.emailLog.create({ data: { emailType: 'REGISTRATION_OTP', recipientEmail: (sent as any).deliveredTo || email, status: 'SENT', providerMessageId: (sent as any).messageId } });
  } catch (e: any) {
    await prisma.emailLog.create({ data: { emailType: 'REGISTRATION_OTP', recipientEmail: email, status: 'FAILED', errorMessage: String(e?.message || e) } });
    console.error(`[otp] send failed for ${email}:`, e?.message || e);
    throw new Error('Could not send the OTP email. Try again in a minute.');
  }
  await audit({ action: 'OTP_REQUESTED', entityType: 'User', metadata: { email }, ipAddress: req?.ip, userAgent: req?.headers?.['user-agent'] });
  return { message: `A 6-digit code was sent to ${email}. It expires in 10 minutes.` };
}

/** Step 2: verify code → create verified DRIVER user + driver profile + account. */
export async function verifyRegistrationOtp(emailRaw: string, codeRaw: string, req?: any) {
  const email = emailRaw.toLowerCase().trim();
  const code = codeRaw.trim();
  const rec = await prisma.otpToken.findFirst({
    where: { email, purpose: 'REGISTRATION', usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!rec) {
    const err: any = new Error('No valid code found. Request a new one.');
    err.status = 400;
    throw err;
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS || !safeEqual(otpHash(code), rec.otpHash)) {
    const attempts = await prisma.otpToken.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    if (attempts.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otpToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      const err: any = new Error('Too many wrong attempts. Request a new code.');
      err.status = 429;
      throw err;
    }
    const left = OTP_MAX_ATTEMPTS - attempts.attempts;
    const err: any = new Error(`Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.`);
    err.status = 400;
    throw err;
  }

  const payload = JSON.parse(rec.payload || '{}');
  if (await prisma.user.findUnique({ where: { email } })) {
    await prisma.otpToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    const err: any = new Error('An account with this email already exists. Please log in.');
    err.status = 409;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.otpToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
    const user = await tx.user.create({
      data: {
        name: payload.name, email, passwordHash: payload.passwordHash, role: 'DRIVER',
        emailVerified: true, accountApproved: true, accountStatus: 'ACTIVE',
      },
    });
    const driver = await tx.driver.create({
      data: {
        userId: user.id, licenseNumber: payload.licenseNumber,
        licenseExpiry: new Date(payload.licenseExpiry), phoneNumber: payload.phoneNumber, status: 'ACTIVE',
      },
    });
    await tx.emailLog.create({ data: { userId: user.id, emailType: 'REGISTRATION_OTP_VERIFIED', recipientEmail: email, status: 'SENT' } });
    return { user, driver };
  });

  await audit({ actorUserId: result.user.id, action: 'OTP_VERIFIED_DRIVER_CREATED', entityType: 'User', entityId: result.user.id, ipAddress: req?.ip, userAgent: req?.headers?.['user-agent'] });
  return {
    message: 'Email verified — your driver account is created and awaiting administrator approval.',
    userId: result.user.id,
    driverId: result.driver.id,
    needsApproval: true,
  };
}
