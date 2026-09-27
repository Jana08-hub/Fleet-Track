import { prisma } from '../utils/prisma.js';
import { emitToAdmins } from '../socket.js';

/**
 * Daily expiry / maintenance sweep.
 * Creates one unresolved alert per overdue item (deduped by message match in last 24h).
 * Called from an interval in index.ts / combined.ts and manually via POST /api/admin/maintenance/check-due.
 */
export async function runDueChecks(now = new Date()) {
  const created: string[] = [];
  const since = new Date(now.getTime() - 24 * 3600 * 1000);

  async function alertOnce(key: { vehicleId?: string; driverId?: string; tripId?: string; alertType: any; message: string; severity: any }) {
    const dup = await prisma.alert.findFirst({
      where: { alertType: key.alertType, message: key.message, createdAt: { gte: since }, isResolved: false },
    });
    if (dup) return;
    const a = await prisma.alert.create({ data: { ...key } });
    emitToAdmins('new-alert', a);
    created.push(a.id);
  }

  // Vehicle insurance / pollution expiries (expired or within 7 days)
  const soon = new Date(now.getTime() + 7 * 86400000);
  const vehicles = await prisma.vehicle.findMany({
    where: { OR: [{ insuranceExpiry: { lte: soon } }, { pollutionExpiry: { lte: soon } }] },
  });
  for (const v of vehicles) {
    if (v.insuranceExpiry && v.insuranceExpiry <= soon) {
      await alertOnce({
        vehicleId: v.id, alertType: 'INSURANCE_EXPIRY',
        message: `Insurance ${v.insuranceExpiry < now ? 'expired' : 'expiring soon'} for ${v.registrationNumber}`,
        severity: v.insuranceExpiry < now ? 'HIGH' : 'MEDIUM',
      });
    }
    if (v.pollutionExpiry && v.pollutionExpiry <= soon) {
      await alertOnce({
        vehicleId: v.id, alertType: 'MAINTENANCE_DUE',
        message: `Pollution cert ${v.pollutionExpiry < now ? 'expired' : 'expiring soon'} for ${v.registrationNumber}`,
        severity: v.pollutionExpiry < now ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // Driver licence expiries
  const drivers = await prisma.driver.findMany({ where: { licenseExpiry: { lte: soon } }, include: { user: true } });
  for (const d of drivers) {
    await alertOnce({
      driverId: d.id, alertType: 'LICENSE_EXPIRY',
      message: `License ${d.licenseExpiry < now ? 'expired' : 'expiring soon'} for ${d.user.name} (${d.licenseNumber})`,
      severity: d.licenseExpiry < now ? 'HIGH' : 'MEDIUM',
    });
  }

  // Maintenance due within 7 days
  const due = await prisma.maintenanceRecord.findMany({ where: { nextServiceDate: { lte: soon } }, take: 200 });
  for (const m of due) {
    await alertOnce({
      vehicleId: m.vehicleId, alertType: 'MAINTENANCE_DUE',
      message: `Service due ${m.nextServiceDate!.toISOString().slice(0, 10)} (${m.serviceType})`,
      severity: 'MEDIUM',
    });
  }

  return { created: created.length };
}

let timer: NodeJS.Timeout | null = null;

/** Start 24h interval sweep (plus a delayed first run). No-op if already started. */
export function startDueChecks(intervalMs = 24 * 3600 * 1000) {
  if (timer) return;
  setTimeout(() => runDueChecks().catch((e) => console.error('due-check failed', e)), 60_000);
  timer = setInterval(() => runDueChecks().catch((e) => console.error('due-check failed', e)), intervalMs);
  if ((timer as any).unref) (timer as any).unref();
}
