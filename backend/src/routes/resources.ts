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
vehicles.get('/:id/assignments', async (req, res) => {
  const list = await prisma.vehicleAssignment.findMany({
    where: { vehicleId: req.params.id }, orderBy: { assignedAt: 'desc' }, take: 20,
    include: { driver: { include: { user: { select: { name: true, email: true } } } } },
  });
  res.json({ assignments: list });
});
vehicles.post('/:id/assign', requireAdmin, async (req: AuthRequest, res) => {
  const { driverId } = req.body as { driverId?: string };
  if (!driverId) return res.status(400).json({ error: 'driverId required' });
  const [vehicle, driver] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: req.params.id } }),
    prisma.driver.findUnique({ where: { id: driverId } }),
  ]);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  await prisma.vehicleAssignment.updateMany({ where: { vehicleId: vehicle.id, active: true }, data: { active: false, unassignedAt: new Date() } });
  await prisma.vehicleAssignment.updateMany({ where: { driverId: driver.id, active: true }, data: { active: false, unassignedAt: new Date() } });
  const a = await prisma.vehicleAssignment.create({ data: { vehicleId: vehicle.id, driverId: driver.id } });
  await audit({ actorUserId: req.user!.id, action: 'ASSIGN_DRIVER', entityType: 'Vehicle', entityId: vehicle.id, metadata: { driverId } });
  res.status(201).json(a);
});
vehicles.delete('/:id/assign', requireAdmin, async (req: AuthRequest, res) => {
  await prisma.vehicleAssignment.updateMany({ where: { vehicleId: req.params.id, active: true }, data: { active: false, unassignedAt: new Date() } });
  await audit({ actorUserId: req.user!.id, action: 'UNASSIGN_DRIVER', entityType: 'Vehicle', entityId: req.params.id });
  res.json({ message: 'Unassigned' });
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
  const activeTrip = await prisma.trip.findFirst({ where: { driverId: req.params.id, status: { in: ['ACTIVE', 'DELAYED'] } }, select: { id: true } });
  if (activeTrip) return res.status(400).json({ error: 'Driver has an active trip — complete or cancel it first' });
  await prisma.driver.delete({ where: { id: req.params.id } });
  await audit({ actorUserId: req.user!.id, action: 'DELETE_DRIVER', entityType: 'Driver', entityId: req.params.id });
  res.json({ message: 'Deleted' });
});

export const trips = Router();
trips.use(requireAuth);
trips.get('/', async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const q = req.query.q ? String(req.query.q) : '';
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const where: any = {};
  if (status && status !== 'ALL') where.status = status as any;
  if (q) where.OR = [{ source: { contains: q, mode: 'insensitive' } }, { destination: { contains: q, mode: 'insensitive' } }];
  const [total, tripsList] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { vehicle: true, driver: { include: { user: true } }, stops: { orderBy: { stopOrder: 'asc' } } } }),
  ]);
  res.json({ trips: tripsList, total, page, limit });
});
trips.post('/', requireAuth, validateBody(tripSchema), async (req: AuthRequest, res) => {
  const b = req.body;
  // Drivers create trips for themselves; admins may assign any driver.
  let driverId = b.driverId as string | undefined;
  if (req.user!.role !== 'ADMIN') {
    const me = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!me) return res.status(403).json({ error: 'Driver profile not found' });
    driverId = me.id;
  }
  if (!driverId) return res.status(400).json({ error: 'driverId is required' });
  const vehicle = await prisma.vehicle.findUnique({ where: { id: b.vehicleId } });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  const plannedStart = b.plannedStartTime ? new Date(b.plannedStartTime) : undefined;
  const expectedArrival = b.expectedArrivalTime ? new Date(b.expectedArrivalTime) : undefined;
  if ((plannedStart && isNaN(+plannedStart)) || (expectedArrival && isNaN(+expectedArrival))) {
    return res.status(400).json({ error: 'Invalid start or arrival time' });
  }
  if (plannedStart && expectedArrival && expectedArrival <= plannedStart) {
    return res.status(400).json({ error: 'Expected arrival must be after the planned start' });
  }
  const stops = Array.isArray(b.stops) ? b.stops : [];
  for (const [i, s] of stops.entries()) {
    if (s.expectedArrivalTime && isNaN(+new Date(s.expectedArrivalTime))) {
      return res.status(400).json({ error: `Stop ${i + 1}: invalid expected arrival time` });
    }
  }
  const t = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({ data: {
      vehicleId: b.vehicleId, driverId, source: b.source, destination: b.destination,
      startLatitude: b.startLatitude, startLongitude: b.startLongitude,
      destinationLatitude: b.destinationLatitude, destinationLongitude: b.destinationLongitude,
      purpose: b.purpose || undefined, notes: b.notes || undefined,
      plannedStartTime: plannedStart, expectedArrivalTime: expectedArrival,
    } });
    if (stops.length) {
      await tx.tripStop.createMany({ data: stops.map((s: any, i: number) => ({
        tripId: created.id, name: s.name, address: s.address || undefined,
        latitude: s.latitude, longitude: s.longitude,
        expectedArrivalTime: s.expectedArrivalTime ? new Date(s.expectedArrivalTime) : undefined,
        stopOrder: i,
      })) });
    }
    return tx.trip.findUnique({ where: { id: created.id }, include: { vehicle: true, driver: { include: { user: true } }, stops: { orderBy: { stopOrder: 'asc' } } } });
  });
  await audit({ actorUserId: req.user!.id, action: 'CREATE_TRIP', entityType: 'Trip', entityId: t!.id });
  emitToAdmins('trip-status-updated', t);
  res.status(201).json(t);
});
trips.get('/:id', async (req, res) => {
  const t = await prisma.trip.findUnique({ where: { id: req.params.id }, include: { vehicle: true, driver: { include: { user: true } }, stops: { orderBy: { stopOrder: 'asc' } }, gpsPoints: { orderBy: { serverTimestamp: 'asc' }, take: 1000 } } });
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
  if (g.trip.status === 'ACTIVE') return res.status(400).json({ error: 'Trip is already active' });
  if (g.trip.status === 'COMPLETED' || g.trip.status === 'CANCELLED') {
    return res.status(400).json({ error: 'Trip already finished' });
  }
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'ACTIVE', actualStartTime: new Date() } });
  await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: 'IN_TRIP' } });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});
trips.patch('/:id/stop', async (req: AuthRequest, res) => {
  const g: any = await guardTrip(req, req.params.id);
  if (g.error) return res.status(g.error === 'Not found' ? 404 : 403).json({ error: g.error });
  if (g.trip.status !== 'ACTIVE' && g.trip.status !== 'DELAYED') {
    return res.status(400).json({ error: 'Only an active trip can be ended' });
  }
  const points = await prisma.gPSLocation.findMany({ where: { tripId: req.params.id }, orderBy: { serverTimestamp: 'asc' } });
  let dist = 0, max = 0, sum = 0;
  for (let i = 1; i < points.length; i++) dist += haversineKm(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
  for (const p of points) { if (p.speed && p.speed > max) max = p.speed; if (p.speed) sum += p.speed; }
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'COMPLETED', actualEndTime: new Date(), totalDistance: dist, maxSpeed: max, averageSpeed: points.length ? sum / points.length : 0 } });
  await prisma.vehicle.update({ where: { id: t.vehicleId }, data: { status: 'ACTIVE', mileage: { increment: dist } } });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});
trips.patch('/:id/cancel', requireAdmin, async (req: AuthRequest, res) => {
  const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  // Free the vehicle if it was held for this trip
  try {
    await prisma.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'ACTIVE' } });
  } catch {}
  await audit({ actorUserId: req.user!.id, action: 'CANCEL_TRIP', entityType: 'Trip', entityId: t.id });
  emitToAdmins('trip-status-updated', t);
  res.json(t);
});
trips.patch('/:id/delay', requireAdmin, async (req: AuthRequest, res) => {
  const existing = await prisma.trip.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
    return res.status(400).json({ error: 'Trip already finished' });
  }
  const t = await prisma.trip.update({ where: { id: req.params.id }, data: { status: 'DELAYED' } });
  const alert = await prisma.alert.create({
    data: {
      vehicleId: existing.vehicleId, driverId: existing.driverId, tripId: existing.id,
      alertType: 'TRIP_DELAY', message: `Trip ${existing.source} → ${existing.destination} marked delayed`,
      severity: 'MEDIUM',
    },
  });
  await audit({ actorUserId: req.user!.id, action: 'DELAY_TRIP', entityType: 'Trip', entityId: t.id });
  emitToAdmins('trip-status-updated', t);
  emitToAdmins('new-alert', alert);
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
      if (!trip || trip.driverId !== me.id || (trip.status !== 'ACTIVE' && trip.status !== 'DELAYED')) return res.status(403).json({ error: 'Unauthorized GPS submission for this trip' });
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
  const where: any = { vehicleId: req.params.id };
  if (req.query.tripId) where.tripId = String(req.query.tripId);
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  if ((from && isNaN(+from)) || (to && isNaN(+to))) return res.status(400).json({ error: 'Bad from/to date' });
  if (from || to) where.serverTimestamp = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const pts = await prisma.gPSLocation.findMany({ where, orderBy: { serverTimestamp: 'desc' }, take: Math.min(1000, Number(req.query.limit || 200)) });
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
geofences.get('/', async (req, res) => {
  const vehicleId = req.query.vehicleId ? String(req.query.vehicleId) : undefined;
  const activeOnly = String(req.query.activeOnly || '') === 'true';
  const eventWhere: any = {};
  if (vehicleId) eventWhere.vehicleId = vehicleId;
  const [geofencesList, events] = await Promise.all([
    prisma.geofence.findMany({ where: activeOnly ? { active: true } : {}, orderBy: { createdAt: 'desc' } }),
    prisma.geofenceEvent.findMany({
      where: eventWhere,
      orderBy: { occurredAt: 'desc' }, take: 100,
      include: { vehicle: { select: { registrationNumber: true } }, geofence: { select: { name: true } } },
    }),
  ]);
  res.json({ geofences: geofencesList, events });
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
