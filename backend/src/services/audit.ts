import { prisma } from '../utils/prisma.js';

export async function audit(opts: {
  actorUserId?: string; action: string; entityType: string; entityId?: string;
  metadata?: unknown; ipAddress?: string; userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: opts.actorUserId, action: opts.action, entityType: opts.entityType,
        entityId: opts.entityId, metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
        ipAddress: opts.ipAddress, userAgent: opts.userAgent,
      },
    });
  } catch (e) {
    console.error('audit failed', e);
  }
}
