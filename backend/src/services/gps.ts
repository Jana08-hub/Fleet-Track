import { prisma } from '../utils/prisma.js';
import { checkGeofences } from './geofence.js';
import { emitToAdmins } from '../socket.js';

export interface GpsInput {
  vehicleId: string;
  driverId: string;
  tripId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  deviceTimestamp?: string;
  isSimulated?: boolean;
}

/** Validate → store → geofence-check → broadcast. Shared by driver GPS API and the demo simulator. */
export async function saveGpsPoint(b: GpsInput) {
  const pt = await prisma.gPSLocation.create({
    data: {
      vehicleId: b.vehicleId,
      driverId: b.driverId,
      tripId: b.tripId,
      latitude: b.latitude,
      longitude: b.longitude,
      accuracy: b.accuracy,
      speed: b.speed,
      heading: b.heading,
      altitude: b.altitude,
      deviceTimestamp: b.deviceTimestamp ? new Date(b.deviceTimestamp) : undefined,
      isSimulated: !!b.isSimulated,
    },
  });
  await prisma.vehicle.update({
    where: { id: b.vehicleId },
    data: { lastLat: b.latitude, lastLng: b.longitude, lastSeenAt: new Date() },
  });
  const events = await checkGeofences(b.vehicleId, b.tripId || null, b.latitude, b.longitude);
  const payload = { ...pt, demo: !!b.isSimulated };
  emitToAdmins('vehicle-location-updated', payload);
  for (const e of events) emitToAdmins('geofence-event', e);
  if (b.speed && b.speed > 100) {
    const a = await prisma.alert.create({
      data: {
        vehicleId: b.vehicleId, driverId: b.driverId, tripId: b.tripId,
        alertType: 'SPEED_LIMIT_EXCEEDED',
        message: `Speed ${b.speed.toFixed(0)} km/h exceeds limit`,
        severity: 'HIGH',
      },
    });
    emitToAdmins('new-alert', a);
  }
  return { point: payload, events };
}
