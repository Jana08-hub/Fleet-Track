import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { vehicleSchema, driverSchema, tripSchema, gpsSchema, geofenceSchema, maintenanceSchema } from '../utils/validation.js';
import { saveGpsPoint } from '../services/gps.js';
import { haversineKm } from '../utils/tokens.js';
import { emitToAdmins } from '../socket.js';
import { audit } from '../services/audit.js';
import { hashPassword } from '../utils/password.js';

export const vehicles = Router();
vehicles.use(requireAuth);
vehicles.get('/', async (_req, res) => {
  res.json({ vehicles: await prisma.vehicle.findMany({ orderBy: { createdAt: 'desc' } }) });
});
vehicles.post('/', requireAdmin, validateBody(vehicleSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  const v = await prisma.vehicle.create({ data: { ...b, insuranceExpiry: b.insuranceExpiry ? new Date(b.insuranceExpiry) : undefined, pollutionExpiry: b.pollutionExpiry ? new Date(b.pollutionExpiry) : undefined } });
  await audit({ actorUserId: req.user!.id, action: 'CREATE_VEHICLE', entityType: 'Vehicle', entityId: v.id });
  res.status(201).json(v);
});
vehicles.get('/:id', async (req, res) => {
  const v = await prisma.vehicle.findUnique({ where: { id: req.params.id }, include: { trips: { orderBy: { createdAt: 'desc' }, take: 10 }, maintenance: { orderBy: { serviceDate: 'desc' }, take: 10 } } });
  if (!v) return res.status(404).json({ error: 'Not found' });
  res.json(v);
});
vehicles.patch('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const v = await prisma.vehicle.update({ where: { id: req.params.id }, data: req.body });
  await audit({ actorUserId: req.user!.id, action: 'UPDATE_VEHICLE', entityType: 'Vehicle', entityId: v.id });
  res.json(v);
});
vehicles.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  await prisma.vehicle.delete({ where: { id: req.params.id } });
  await audit({ actorUserId: req.user!.id, action: 'DELETE_VEHICLE', entityType: 'Vehicle', entityId: req.params.id });
  res.json({ message: 'Deleted' });
});

export const drivers = Router();
drivers.use(requireAuth);
drivers.get('/', async (_req, res) => {
  res.json({ drivers: await prisma.driver.findMany({ include: { user: { select: { id: true, name: true, email: true, emailVerified: true, accountApproved: true, accountStatus: true } } }, orderBy: { createdAt: 'desc' } }) });
});
drivers.post('/', requireAdmin, validateBody(driverSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  let userId = b.userId;
  if (!userId) {
    if (!b.email || !b.password || !b.name) return res.status(400).json({ error: 'name/email/password required to create driver user' });
    const u = await prisma.user.create({ data: { name: b.name, email: b.email, passwordHash: await hashPassword(b.password), role: 'DRIVER', emailVerified: false, accountApproved: true, accountStatus: 'PENDING' } });
    userId = u.id;
  }
  const d = await prisma.driver.create({ data: { userId, licenseNumber: b.licenseNumber, licenseExpiry: new Date(b.licenseExpiry), phoneNumber: b.phoneNumber, emergencyContact: b.emergencyContact } });
  await audit({ actorUserId: req.user!.id, action: 'CREATE_DRIVER', entityType: 'Driver', entityId: d.id });
  res.status(201).json(d);
});
drivers.get('/:id', async (req, res) => {
  const d = await prisma.driver.findUnique({ where: { id: req.params.id }, include: { user: true, trips: { orderBy: { createdAt: 'desc' }, take: 20 } } });
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(d);
});
drivers.patch('/:id', requireAdmin, async (req: AuthRequest, res) => {
  const d = await prisma.driver.update({ where: { id: req.params.id }, data: req.body });
  await audit({ actorUserId: req.user!.id, action: 'UPDATE_DRIVER', entityType: 'Driver', entityId: d.id });
  res.json(d);
});
drivers.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  await prisma.driver.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export const trips = Router();
trips.use(requireAuth);
trips.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  res.json({ trips: await prisma.trip.findMany({ where: status ? { status: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200, include: { vehicle: true, driver: { include: { user: true } } } }) });
});
trips.post('/', requireAdmin, validateBody(tripSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  const t = await prisma.trip.create({ data: { vehicleId: b.vehicleId, driverId: b.driverId, source: b.source, destination: b.destination, plannedStartTime: b.plannedStartTime ? new Date(b.plannedStartTime) : undefined, expectedArrivalTime: b.expectedArrivalTime ? new Date(b.expectedArrivalTime) : undefined } });
  await audit({ actorUserId: req.user!.id, action: 'CREATE_TRIP', entityType: 'Trip', entityId: t.id });
  emitToAdmins('trip-status-updated', t);
  res.status(201).json(t);
});
trips.get('/:id', async (req, res) => {
  const t = await prisma.trip.findUnique({ where: { id: req.params.id }, include: { vehicle: true, driver: { include: { user: true } }, gpsPoints: { orderBy: { serverTimestamp: 'asc' }, take: 1000 } } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});
async function guardTrip(req: AuthRequest, tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { driver: true } });
  if (!trip) return { error: 'Not found' as const };
  if (req.user!.role !== 'ADMIN') {
    const me = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!me || me.id !== trip.driverId) return { error: 'Forbidden: not your trip' as const };
  }
  return { trip };
}
trips.patch('/:id/start', async (req: AuthRequest, res) => {
  const g: any = await guardTrip(req, req.params.id);
  if (g.error) return res.status(g.error === 'Not found' ? 404 : 403).json({ error: g.error });
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'ACTIVE', actualStartTime: new Date() } });
  await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: 'IN_TRIP' } });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});
trips.patch('/:id/stop', async (req: AuthRequest, res) => {
  const g: any = await guardTrip(req, req.params.id);
  if (g.error) return res.status(g.error === 'Not found' ? 404 : 403).json({ error: g.error });
  const points = await prisma.gPSLocation.findMany({ where: { tripId: req.params.id }, orderBy: { serverTimestamp: 'asc' } });
  let dist = 0, max = 0, sum = 0;
  for (let i = 1; i < points.length; i++) dist += haversineKm(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
  for (const p of points) { if (p.speed && p.speed > max) max = p.speed; if (p.speed) sum += p.speed; }
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'COMPLETED', actualEndTime: new Date(), totalDistance: dist, maxSpeed: max, averageSpeed: points.length ? sum / points.length : 0 } });
  await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: 'ACTIVE', mileage: { increment: dist } } });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});
trips.patch('/:id/cancel', requireAdmin, async (req, res) => {
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});

export const gps = Router();
gps.use(requireAuth);
gps.post('/location', validateBody(gpsSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: b.vehicleId } });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  // Resolve driver: admin may submit any; driver only own profile
  let driverId: string;
  if (req.user!.role === 'ADMIN') {
    const active = await prisma.vehicleAssignment.findFirst({ where: { vehicleId: b.vehicleId, active: true } });
    const trip = b.tripId ? await prisma.trip.findUnique({ where: { id: b.tripId } }) : null;
    driverId = trip?.driverId || active?.driverId || '';
    if (!driverId) return res.status(400).json({ error: 'No driver assigned for vehicle' });
  } else {
    const me = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!me) return res.status(403).json({ error: 'No driver profile' });
    driverId = me.id;
    if (b.tripId) {
      const trip = await prisma.trip.findUnique({ where: { id: b.tripId } });
      if (!trip || trip.driverId !== me.id || trip.status !== 'ACTIVE') return res.status(403).json({ error: 'Unauthorized GPS submission for this trip' });
    }
  }
  if (b.accuracy && b.accuracy > 5000) return res.status(400).json({ error: 'Low GPS accuracy, update rejected' });
  const { point } = await saveGpsPoint({ ...b, driverId });
  res.status(201).json(point);
});
gps.get('/vehicles/:id/latest', async (req, res) => {
  const pt = await prisma.gPSLocation.findFirst({ where: { vehicleId: req.params.id }, orderBy: { serverTimestamp: 'desc' } });
  res.json(pt || null);
});
gps.get('/vehicles/:id/history', async (req, res) => {
  const pts = await prisma.gPSLocation.findMany({ where: { vehicleId: req.params.id }, orderBy: { serverTimestamp: 'desc' }, take: Math.min(1000, Number(req.query.limit || 200)) });
  res.json({ points: pts });
});

export const alerts = Router();
alerts.use(requireAuth);
alerts.get('/', async (req, res) => {
  const alertsList = await prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json({ alerts: alertsList });
});
alerts.patch('/:id/read', async (req, res) => {
  res.json(await prisma.alert.update({ where: { id: req.params.id }, data: { isRead: true } }));
});
alerts.patch('/:id/resolve', async (req, res) => {
  res.json(await prisma.alert.update({ where: { id: req.params.id }, data: { isResolved: true, resolvedAt: new Date() } }));
});

export const maintenance = Router();
maintenance.use(requireAuth);
maintenance.get('/', async (_req, res) => {
  res.json({ records: await prisma.maintenanceRecord.findMany({ orderBy: { serviceDate: 'desc' }, take: 200 }) });
});
maintenance.post('/', requireAdmin, validateBody(maintenanceSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  const rec = await prisma.maintenanceRecord.create({ data: { vehicleId: b.vehicleId, serviceType: b.serviceType, description: b.description, serviceDate: new Date(b.serviceDate), cost: b.cost || 0, currentMileage: b.currentMileage || 0, nextServiceDate: b.nextServiceDate ? new Date(b.nextServiceDate) : undefined, nextServiceMileage: b.nextServiceMileage, notes: b.notes, createdBy: req.user!.id } });
  res.status(201).json(rec);
});
maintenance.patch('/:id', requireAdmin, async (req, res) => {
  res.json(await prisma.maintenanceRecord.update({ where: { id: req.params.id }, data: req.body }));
});
maintenance.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.maintenanceRecord.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export const geofences = Router();
geofences.use(requireAuth, requireAdmin);
geofences.get('/', async (_req, res) => {
  res.json({ geofences: await prisma.geofence.findMany({ orderBy: { createdAt: 'desc' } }), events: await prisma.geofenceEvent.findMany({ orderBy: { occurredAt: 'desc' }, take: 100 }) });
});
geofences.post('/', validateBody(geofenceSchema), async (req, res) => {
  res.status(201).json(await prisma.geofence.create({ data: req.body }));
});
geofences.patch('/:id', async (req, res) => {
  res.json(await prisma.geofence.update({ where: { id: req.params.id }, data: req.body }));
});
geofences.delete('/:id', async (req, res) => {
  await prisma.geofence.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});
