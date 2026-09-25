import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

r.get('/overview', async (req, res) => {
  const [vehicles, drivers, activeTrips, completedTrips, alerts, unverified, pending, maintenanceDue] = await Promise.all([
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.trip.count({ where: { status: 'ACTIVE' } }),
    prisma.trip.count({ where: { status: 'COMPLETED' } }),
    prisma.alert.count({ where: { isResolved: false } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { accountApproved: false } }),
    prisma.maintenanceRecord.count({ where: { nextServiceDate: { lte: new Date(Date.now() + 7 * 86400000) } } }),
  ]);
  const trips = await prisma.trip.findMany({ orderBy: { createdAt: 'desc' }, take: 500, select: { createdAt: true, totalDistance: true, status: true } });
  res.json({ vehicles, drivers, activeTrips, completedTrips, alerts, unverified, pending, maintenanceDue, recentTrips: trips });
});

r.get('/export/trips.csv', async (_req, res) => {
  const trips = await prisma.trip.findMany({ take: 1000, orderBy: { createdAt: 'desc' }, include: { vehicle: true, driver: { include: { user: true } } } });
  const rows = ['id,vehicle,driver,source,destination,status,distance_km,createdAt'];
  for (const t of trips) rows.push([t.id, t.vehicle.registrationNumber, t.driver.user.name, `"${t.source}"`, `"${t.destination}"`, t.status, t.totalDistance, t.createdAt.toISOString()].join(','));
  res.header('Content-Type', 'text/csv');
  res.send(rows.join('\n'));
});

export default r;
