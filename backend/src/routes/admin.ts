import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { sendVerificationEmail } from './auth.js';
import { sendMail } from '../email/mailer.js';
import { emailTemplates } from '../email/templates.js';
import { audit } from '../services/audit.js';

const r = Router();
r.use(requireAuth, requireAdmin);
const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, message: { error: 'Email rate limit exceeded' } });

r.get('/users', async (req, res) => {
  const q = String(req.query.q || '');
  const status = String(req.query.status || '');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const where: any = {};
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
  if (status === 'unverified') where.emailVerified = false;
  if (status === 'pending') where.accountApproved = false;
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { emailLogs: { orderBy: { sentAt: 'desc' }, take: 1 } } }),
  ]);
  res.json({ total, page, limit, users: users.map((u: any) => ({ ...u, passwordHash: undefined })) });
});

r.get('/users/unverified', async (_req, res) => {
  const users = await prisma.user.findMany({ where: { emailVerified: false }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ users: users.map((u: any) => ({ ...u, passwordHash: undefined })) });
});

r.get('/users/:id', async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id }, include: { emailLogs: { orderBy: { sentAt: 'desc' }, take: 20 }, driverProfile: true } });
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ ...u, passwordHash: undefined });
});

r.post('/users/:id/send-verification-email', emailLimiter, async (req: AuthRequest, res) => {
  try {
    await sendVerificationEmail(req.params.id, req.user!.id, false, req);
    res.json({ message: 'Verification email sent' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
r.post('/users/:id/resend-verification-email', emailLimiter, async (req: AuthRequest, res) => {
  try {
    await sendVerificationEmail(req.params.id, req.user!.id, true, req);
    res.json({ message: 'Verification email resent' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.patch('/users/:id/approve', async (req: AuthRequest, res) => {
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { accountApproved: true, accountStatus: 'ACTIVE' } });
  const t = emailTemplates.approval(u.name);
  let deliveredTo = u.email;
  try { deliveredTo = ((await sendMail(u.email, t.subject, t.html, t.text)) as any).deliveredTo || deliveredTo; } catch {}
  await prisma.emailLog.create({ data: { userId: u.id, sentByAdminId: req.user!.id, emailType: 'APPROVAL', recipientEmail: deliveredTo, status: 'SENT' } });
  await audit({ actorUserId: req.user!.id, action: 'APPROVE_USER', entityType: 'User', entityId: u.id, ipAddress: req.ip });
  res.json({ message: 'Approved' });
});

r.patch('/users/:id/reject', async (req: AuthRequest, res) => {
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { accountApproved: false, accountStatus: 'DISABLED' } });
  const t = emailTemplates.rejection(u.name);
  let deliveredTo = u.email;
  try { deliveredTo = ((await sendMail(u.email, t.subject, t.html, t.text)) as any).deliveredTo || deliveredTo; } catch {}
  await prisma.emailLog.create({ data: { userId: u.id, sentByAdminId: req.user!.id, emailType: 'REJECTION', recipientEmail: deliveredTo, status: 'SENT' } });  await audit({ actorUserId: req.user!.id, action: 'REJECT_USER', entityType: 'User', entityId: u.id, ipAddress: req.ip });
  res.json({ message: 'Rejected' });
});

r.patch('/users/:id/status', async (req: AuthRequest, res) => {
  const { status } = req.body as { status: 'ACTIVE' | 'DISABLED' };
  if (!['ACTIVE', 'DISABLED'].includes(status)) return res.status(400).json({ error: 'Bad status' });
  const u = await prisma.user.update({ where: { id: req.params.id }, data: { accountStatus: status } });
  const t = emailTemplates.statusChange(u.name, status === 'ACTIVE');
  let deliveredTo = u.email;
  try { deliveredTo = ((await sendMail(u.email, t.subject, t.html, t.text)) as any).deliveredTo || deliveredTo; } catch {}
  await prisma.emailLog.create({ data: { userId: u.id, sentByAdminId: req.user!.id, emailType: 'STATUS_CHANGE', recipientEmail: deliveredTo, status: 'SENT' } });
  await audit({ actorUserId: req.user!.id, action: 'STATUS_CHANGE', entityType: 'User', entityId: u.id, metadata: { status }, ipAddress: req.ip });
  res.json({ message: 'Status updated' });
});

r.get('/email-logs', async (req, res) => {
  const logs = await prisma.emailLog.findMany({ orderBy: { sentAt: 'desc' }, take: Math.min(200, Number(req.query.limit || 50)) });
  res.json({ logs });
});

r.get('/audit-logs', async (req, res) => {
  const action = req.query.action ? String(req.query.action) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && isNaN(+from)) || (to && isNaN(+to))) return res.status(400).json({ error: 'Bad from/to date' });
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const where: any = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
  ]);
  res.json({ logs, total, page, limit });
});

r.post('/users/bulk-approve', async (req: AuthRequest, res) => {
  const ids = (req.body?.ids || []) as string[];
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return res.status(400).json({ error: 'Provide 1–100 user ids' });
  }
  const result = await prisma.user.updateMany({ where: { id: { in: ids } }, data: { accountApproved: true, accountStatus: 'ACTIVE' } });
  await audit({ actorUserId: req.user!.id, action: 'BULK_APPROVE_USERS', entityType: 'User', metadata: { count: result.count }, ipAddress: req.ip });
  res.json({ approved: result.count });
});

r.post('/maintenance/check-due', async (_req, res) => {
  const { runDueChecks } = await import('../services/scheduler.js');
  res.json(await runDueChecks());
});

export default r;
