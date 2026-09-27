import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/overview', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && isNaN(+from)) || (to && isNaN(+to))) return res.status(400).json({ error: 'Bad from/to date' });
  const vehicleId = req.query.vehicleId ? String(req.query.vehicleId) : undefined;
  const driverId = req.query.driverId ? String(req.query.driverId) : undefined;
  const tripWhere: any = {};
  if (from || to) tripWhere.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  if (vehicleId) tripWhere.vehicleId = vehicleId;
  if (driverId) tripWhere.driverId = driverId;
  const [vehicles, drivers, activeTrips, completedTrips, alerts, unverified, pending, maintenanceDue] = await Promise.all([
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.trip.count({ where: { status: 'ACTIVE', ...tripWhere } }),
    prisma.trip.count({ where: { status: 'COMPLETED', ...tripWhere } }),
    prisma.alert.count({ where: { isResolved: false } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { accountApproved: false } }),
    prisma.maintenanceRecord.count({ where: { nextServiceDate: { lte: new Date(Date.now() + 7 * 86400000) } } }),
  ]);
  const trips = await prisma.trip.findMany({ where: tripWhere, orderBy: { createdAt: 'desc' }, take: 500, select: { createdAt: true, totalDistance: true, status: true } });
  res.json({ vehicles, drivers, activeTrips, completedTrips, alerts, unverified, pending, maintenanceDue, recentTrips: trips });
});

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

r.get('/export/trips.csv', async (_req, res) => {
  const trips = await prisma.trip.findMany({ take: 1000, orderBy: { createdAt: 'desc' }, include: { vehicle: true, driver: { include: { user: true } } } });
  const rows = ['id,vehicle,driver,source,destination,status,distance_km,createdAt'];
  for (const t of trips) rows.push([t.id, t.vehicle.registrationNumber, t.driver.user.name, `"${t.source}"`, `"${t.destination}"`, t.status, t.totalDistance, t.createdAt.toISOString()].join(','));
  res.header('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

r.get('/export/alerts.csv', async (_req, res) => {
  const list = await prisma.alert.findMany({ take: 1000, orderBy: { createdAt: 'desc' } });
  const rows = ['id,alertType,severity,message,isRead,isResolved,createdAt'];
  for (const a of list) rows.push([a.id, a.alertType, a.severity, csvCell(a.message), a.isRead, a.isResolved, a.createdAt.toISOString()].join(','));
  res.header('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

r.get('/export/maintenance.csv', async (_req, res) => {
  const list = await prisma.maintenanceRecord.findMany({ take: 1000, orderBy: { serviceDate: 'desc' }, include: { vehicle: true } });
  const rows = ['id,vehicle,serviceType,serviceDate,cost,nextServiceDate'];
  for (const m of list) rows.push([m.id, m.vehicle.registrationNumber, csvCell(m.serviceType), m.serviceDate.toISOString(), m.cost, m.nextServiceDate?.toISOString() || ''].join(','));
  res.header('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

export default r;
