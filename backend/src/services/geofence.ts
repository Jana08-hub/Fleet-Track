import { prisma } from '../utils/prisma.js';
import { haversineKm } from '../utils/tokens.js';

/** Evaluate circular geofences for a new GPS point. Returns created events. */
export async function checkGeofences(vehicleId: string, tripId: string | null, lat: number, lng: number) {
  const fences = await prisma.geofence.findMany({ where: { active: true } });
  const out = [];
  for (const f of fences) {
    const distKm = haversineKm(lat, lng, f.latitude, f.longitude);
    const inside = distKm * 1000 <= f.radius;
    // Simple stateless rule: fetch last event for this pair to detect transitions
    const last = await prisma.geofenceEvent.findFirst({
      where: { vehicleId, geofenceId: f.id }, orderBy: { occurredAt: 'desc' },
    });
    const wasInside = last?.eventType === 'GEOZONE_ENTRY';
    if (inside && !wasInside) {
      out.push(await prisma.geofenceEvent.create({
        data: { geofenceId: f.id, vehicleId, tripId, eventType: 'GEOZONE_ENTRY', latitude: lat, longitude: lng },
      }));
    } else if (!inside && wasInside) {
      out.push(await prisma.geofenceEvent.create({
        data: { geofenceId: f.id, vehicleId, tripId, eventType: 'GEOZONE_EXIT', latitude: lat, longitude: lng },
      }));
    }
  }
  return out;
}
