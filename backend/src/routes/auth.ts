import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma.js';
import { registerSchema, loginSchema, forgotSchema, resetSchema, profileSchema, requestOtpSchema, verifyOtpSchema } from '../utils/validation.js';
import { validateBody } from '../middleware/validate.js';
import { signJwt } from '../utils/jwt.js';
import { hashToken, generateVerificationToken } from '../utils/tokens.js';
import { sendMail } from '../email/mailer.js';
import { emailTemplates } from '../email/templates.js';
import { audit } from '../services/audit.js';
import { requestRegistrationOtp, verifyRegistrationOtp } from '../services/otp.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import crypto from 'crypto';

const r = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60 });

r.post('/register', authLimiter, validateBody(registerSchema), async (req, res) => {
  const { name, email, password, role } = req.body;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(200).json({ message: 'If this email is new, it is now pending verification and approval.' });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: role ?? 'DRIVER', emailVerified: false, accountApproved: false, accountStatus: 'PENDING' },
  });
  await audit({ action: 'USER_REGISTER', entityType: 'User', entityId: user.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  res.status(201).json({ message: 'Registered. Awaiting admin verification email and approval.', userId: user.id });
});

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// OTP registration: step 1 — user enters details, we email a 6-digit code
r.post('/register/request-otp', otpLimiter, validateBody(requestOtpSchema), async (req, res) => {
  try {
    res.status(200).json(await requestRegistrationOtp(req.body, req));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

// OTP registration: step 2 — code verified → driver user + account created
r.post('/register/verify-otp', otpLimiter, validateBody(verifyOtpSchema), async (req, res) => {
  try {
    res.status(201).json(await verifyRegistrationOtp(req.body.email, req.body.otp, req));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post('/login', authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.accountStatus === 'DISABLED') return res.status(403).json({ error: 'Account deactivated. Contact administrator.' });
  if (!user.emailVerified) return res.status(403).json({ error: 'Your email address has not been verified yet. Please check your email or contact the administrator.', code: 'EMAIL_NOT_VERIFIED' });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = signJwt({ sub: user.id, role: user.role as any, email: user.email });
  // Split deployment (Vercel frontend -> Render backend) is cross-site:
  // cookies need SameSite=None + Secure. Same-origin local dev keeps Lax.
  const crossSite = process.env.CROSS_SITE_AUTH === 'true';
  res.cookie('fleettrack_token', token, {
    httpOnly: true,
    secure: crossSite ? true : process.env.NODE_ENV === 'production',
    sameSite: crossSite ? 'none' : 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });
  await audit({ actorUserId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: req.ip });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

r.post('/logout', async (_req, res) => {
  res.clearCookie('fleettrack_token');
  res.json({ message: 'Logged out' });
});

r.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const rec = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return res.status(400).json({ error: 'Invalid or expired verification link.' });
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: rec.userId }, data: { emailVerified: true } }),
  ]);
  await audit({ action: 'EMAIL_VERIFIED', entityType: 'User', entityId: rec.userId });
  res.json({ message: 'Email verified. Awaiting administrator approval.' });
});

r.post('/forgot-password', authLimiter, validateBody(forgotSchema), async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // anti-enumeration: always succeed
  if (user) {
    const raw = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash: hashToken(raw), passwordResetExpires: new Date(Date.now() + 3600_000) } });
    const link = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${raw}`;
    const t = emailTemplates.passwordReset(user.name, link);
    try {
      const sent = await sendMail(user.email, t.subject, t.html, t.text);
      await prisma.emailLog.create({ data: { userId: user.id, emailType: 'PASSWORD_RESET', recipientEmail: (sent as any).deliveredTo || user.email, status: 'SENT', providerMessageId: (sent as any).messageId } });
    } catch (e: any) {
      await prisma.emailLog.create({ data: { userId: user.id, emailType: 'PASSWORD_RESET', recipientEmail: user.email, status: 'FAILED', errorMessage: String(e?.message || e) } });
    }
  }
  res.json({ message: 'If the email exists, a reset link was sent.' });
});

r.post('/reset-password', authLimiter, validateBody(resetSchema), async (req, res) => {
  const { token, password } = req.body;
  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash: hashToken(token) } });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) return res.status(400).json({ error: 'Invalid or expired token' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordResetTokenHash: null, passwordResetExpires: null } });
  res.json({ message: 'Password reset. Please log in.' });
});

r.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  const cookieToken = (req as any).cookies?.fleettrack_token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { verifyJwt } = await import('../utils/jwt.js');
    const p = verifyJwt(token);
    const user = await prisma.user.findUnique({ where: { id: p.sub }, include: { driverProfile: true } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, accountApproved: user.accountApproved, accountStatus: user.accountStatus, driverProfile: user.driverProfile });
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

r.patch('/me', validateBody(profileSchema), async (req, res) => {
  const header = req.headers.authorization;
  const cookieToken = (req as any).cookies?.fleettrack_token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { verifyJwt } = await import('../utils/jwt.js');
    const p = verifyJwt(token);
    const user = await prisma.user.findUnique({ where: { id: p.sub } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const { name, currentPassword, newPassword } = req.body as { name?: string; currentPassword?: string; newPassword?: string };
    const data: any = {};
    if (name && name !== user.name) data.name = name;
    if (newPassword) {
      if (!(await comparePassword(currentPassword!, user.passwordHash))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      data.passwordHash = await hashPassword(newPassword);
    }
    if (Object.keys(data).length === 0) return res.json({ message: 'Nothing to update' });
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    await audit({ actorUserId: user.id, action: newPassword ? 'CHANGE_PASSWORD' : 'UPDATE_PROFILE', entityType: 'User', entityId: user.id, ipAddress: req.ip });
    res.json({ message: 'Profile updated', name: updated.name });
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

// Admin sends verification email (also mounted under /api/admin by index.ts alias)
export async function sendVerificationEmail(userId: string, adminId: string, isResend: boolean, req: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const { token, tokenHash } = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 3600_000);
  await prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt, sentByAdminId: adminId } });
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const t = isResend ? emailTemplates.resend(user.name, link) : emailTemplates.verification(user.name, link);
  try {
    const sent = await sendMail(user.email, t.subject, t.html, t.text);
    await prisma.emailLog.create({ data: { userId, sentByAdminId: adminId, emailType: isResend ? 'VERIFICATION_RESEND' : 'VERIFICATION', recipientEmail: (sent as any).deliveredTo || user.email, status: 'SENT', providerMessageId: (sent as any).messageId } });
  } catch (e: any) {
    await prisma.emailLog.create({ data: { userId, sentByAdminId: adminId, emailType: 'VERIFICATION', recipientEmail: user.email, status: 'FAILED', errorMessage: String(e?.message || e) } });
    throw new Error('Email delivery failed');
  }
  await audit({ actorUserId: adminId, action: isResend ? 'RESEND_VERIFICATION' : 'SEND_VERIFICATION', entityType: 'User', entityId: userId, ipAddress: req?.ip });
  return link;
}

export default r;
