import { describe, it, expect, afterEach } from 'vitest';
import { prisma } from '../src/utils/prisma.js';
import { haversineKm } from '../src/utils/tokens.js';
import { gpsSchema } from '../src/utils/validation.js';
import { checkGeofences } from '../src/services/geofence.js';
import { saveGpsPoint } from '../src/services/gps.js';
import { requireAdmin } from '../src/middleware/auth.js';
import { hashPassword } from '../src/utils/password.js';

const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const track = { users: [] as string[], vehicles: [] as string[], geofences: [] as string[], trips: [] as string[] };

async function cleanup() {
  for (const tripId of track.trips.splice(0)) {
    await prisma.gPSLocation.deleteMany({ where: { tripId } }).catch(() => {});
    await prisma.geofenceEvent.deleteMany({ where: { tripId } }).catch(() => {});
    await prisma.alert.deleteMany({ where: { tripId } }).catch(() => {});
    await prisma.trip.delete({ where: { id: tripId } }).catch(() => {});
  }
  for (const vid of track.vehicles.splice(0)) {
    await prisma.gPSLocation.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.geofenceEvent.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.alert.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.vehicleAssignment.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.maintenanceRecord.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.trip.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
    await prisma.vehicle.delete({ where: { id: vid } }).catch(() => {});
  }
  for (const gid of track.geofences.splice(0)) {
    await prisma.geofenceEvent.deleteMany({ where: { geofenceId: gid } }).catch(() => {});
    await prisma.geofence.delete({ where: { id: gid } }).catch(() => {});
  }
  for (const uid of track.users.splice(0)) {
    await prisma.driver.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.emailLog.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.user.delete({ where: { id: uid } }).catch(() => {});
  }
}
afterEach(cleanup);

async function makeDriver(tag: string) {
  const email = `fleet-test-${tag}-${stamp}@example.com`;
  const user = await prisma.user.create({
    data: { name: 'Fleet Tester', email, passwordHash: await hashPassword('TestPass@123'), role: 'DRIVER', emailVerified: true, accountApproved: true, accountStatus: 'ACTIVE' },
  });
  track.users.push(user.id);
  const driver = await prisma.driver.create({
    data: { userId: user.id, licenseNumber: `FL-LIC-${tag}-${stamp}`, licenseExpiry: new Date('2030-01-01'), phoneNumber: '+919000000001' },
  });
  return { user, driver };
}

async function makeVehicle(tag: string) {
  const v = await prisma.vehicle.create({
    data: { registrationNumber: `FT-${tag}-${stamp}`.slice(0, 30), vehicleType: 'Truck', brand: 'Test', model: 'T1', manufacturingYear: 2022, fuelType: 'Diesel' },
  });
  track.vehicles.push(v.id);
  return v;
}

describe('GPS coordinate validation (spec 6)', () => {
  it('accepts a valid fix', () => {
    const r = gpsSchema.safeParse({ vehicleId: 'v', latitude: 17.385, longitude: 78.4867, speed: 60 });
    expect(r.success).toBe(true);
  });
  it('rejects latitude outside -90..90', () => {
    expect(gpsSchema.safeParse({ vehicleId: 'v', latitude: 91, longitude: 0 }).success).toBe(false);
    expect(gpsSchema.safeParse({ vehicleId: 'v', latitude: -91, longitude: 0 }).success).toBe(false);
  });
  it('rejects longitude outside -180..180', () => {
    expect(gpsSchema.safeParse({ vehicleId: 'v', latitude: 0, longitude: 200 }).success).toBe(false);
  });
  it('rejects malformed coordinates', () => {
    expect(gpsSchema.safeParse({ vehicleId: 'v', latitude: 'x', longitude: 0 }).success).toBe(false);
    expect(gpsSchema.safeParse({ vehicleId: 'v', latitude: NaN, longitude: 0 }).success).toBe(false);
  });
});

describe('distance calculation (spec 8)', () => {
  it('haversine matches ~111.19km per degree at equator', () => {
    const d = haversineKm(0, 0, 0, 1);
    expect(d).toBeGreaterThan(111);
    expect(d).toBeLessThan(112);
  });
  it('zero distance for identical points', () => {
    expect(haversineKm(17.385, 78.4867, 17.385, 78.4867)).toBe(0);
  });
});

describe('geofence entry/exit (spec 9)', () => {
  it('emits ENTRY on first inside fix, EXIT on leaving, no duplicates', async () => {
    const { driver } = await makeDriver('geo');
    const v = await makeVehicle('GEO');
    const g = await prisma.geofence.create({ data: { name: `Test zone ${stamp}`, latitude: 17.385, longitude: 78.4867, radius: 500, active: true } });
    track.geofences.push(g.id);

    const e1 = await checkGeofences(v.id, null, 17.385, 78.4867);
    expect(e1.map((e) => e.eventType)).toContain('GEOZONE_ENTRY');

    const e2 = await checkGeofences(v.id, null, 17.385, 78.4867);
    expect(e2).toHaveLength(0);

    const e3 = await checkGeofences(v.id, null, 18.5, 79.5);
    expect(e3.map((e) => e.eventType)).toContain('GEOZONE_EXIT');
    void driver;
  });
});

describe('overspeed alert generation (spec 10)', () => {
  it('creates SPEED_LIMIT_EXCEEDED above 100 km/h and broadcasts point', async () => {
    const { driver } = await makeDriver('spd');
    const v = await makeVehicle('SPD');
    const { point, events } = await saveGpsPoint({
      vehicleId: v.id, driverId: driver.id, latitude: 17.385, longitude: 78.4867, speed: 120,
    });
    expect(point.vehicleId).toBe(v.id);
    expect(events).toBeDefined();
    const alert = await prisma.alert.findFirst({ where: { vehicleId: v.id, alertType: 'SPEED_LIMIT_EXCEEDED' }, orderBy: { createdAt: 'desc' } });
    expect(alert).toBeTruthy();
    expect(alert!.severity).toBe('HIGH');
  });
  it('no alert at normal speed', async () => {
    const { driver } = await makeDriver('ok');
    const v = await makeVehicle('OKV');
    await saveGpsPoint({ vehicleId: v.id, driverId: driver.id, latitude: 17.385, longitude: 78.4867, speed: 40 });
    const alert = await prisma.alert.findFirst({ where: { vehicleId: v.id } });
    expect(alert).toBeNull();
  });
});

describe('role-based authorization (spec 4)', () => {
  function mockRes() {
    const res: any = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };
    return res;
  }
  it('requireAdmin blocks DRIVER with 403', () => {
    const res = mockRes();
    let next = false;
    requireAdmin({ user: { id: 'x', role: 'DRIVER', email: 'd@x.com' } } as any, res, () => { next = true; });
    expect(next).toBe(false);
    expect(res.statusCode).toBe(403);
  });
  it('requireAdmin passes ADMIN through', () => {
    const res = mockRes();
    let next = false;
    requireAdmin({ user: { id: 'x', role: 'ADMIN', email: 'a@x.com' } } as any, res, () => { next = true; });
    expect(next).toBe(true);
  });
});

describe('trip lifecycle (spec 8)', () => {
  it('PLANNED → ACTIVE → COMPLETED with distance accounting', async () => {
    const { driver } = await makeDriver('trip');
    const v = await makeVehicle('TRIP');
    const t = await prisma.trip.create({ data: { vehicleId: v.id, driverId: driver.id, source: 'A', destination: 'B' } });
    track.trips.push(t.id);
    expect(t.status).toBe('PLANNED');

    const started = await prisma.trip.update({ where: { id: t.id }, data: { status: 'ACTIVE', actualStartTime: new Date() } });
    await prisma.vehicle.update({ where: { id: v.id }, data: { status: 'IN_TRIP' } });
    expect(started.status).toBe('ACTIVE');

    await saveGpsPoint({ vehicleId: v.id, driverId: driver.id, tripId: t.id, latitude: 17.385, longitude: 78.4867 });
    await saveGpsPoint({ vehicleId: v.id, driverId: driver.id, tripId: t.id, latitude: 17.395, longitude: 78.4867 });

    const pts = await prisma.gPSLocation.findMany({ where: { tripId: t.id }, orderBy: { serverTimestamp: 'asc' } });
    let dist = 0;
    for (let i = 1; i < pts.length; i++) dist += haversineKm(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude);
    expect(dist).toBeGreaterThan(0.5);

    const done = await prisma.trip.update({ where: { id: t.id }, data: { status: 'COMPLETED', actualEndTime: new Date(), totalDistance: dist } });
    await prisma.vehicle.update({ where: { id: v.id }, data: { status: 'ACTIVE' } });
    expect(done.status).toBe('COMPLETED');
    const vf = await prisma.vehicle.findUnique({ where: { id: v.id } });
    expect(vf!.status).toBe('ACTIVE');
  });
});
