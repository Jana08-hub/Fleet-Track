import { prisma } from '../utils/prisma.js';
import { haversineKm } from '../utils/tokens.js';
import { saveGpsPoint } from './gps.js';

interface SimVehicle {
  vehicleId: string;
  driverId: string;
  registration: string;
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  bearing: number;
  speedKmh: number;
}

const TICK_MS = 3000;
const MAX_ROAM_KM = 12;

let timer: NodeJS.Timeout | null = null;
let fleet: SimVehicle[] = [];
let lastTickAt: string | null = null;
let tickCount = 0;

function step(v: SimVehicle, dtSec: number) {
  // gentle random turn, cruise speed 25–55 km/h
  v.bearing += (Math.random() - 0.5) * 50;
  v.speedKmh = Math.min(60, Math.max(20, v.speedKmh + (Math.random() - 0.5) * 8));
  // turn back toward origin if roaming too far
  if (haversineKm(v.lat, v.lng, v.originLat, v.originLng) > MAX_ROAM_KM) {
    const toOrigin = (Math.atan2(v.originLng - v.lng, v.originLat - v.lat) * 180) / Math.PI;
    v.bearing = toOrigin + (Math.random() - 0.5) * 30;
  }
  const distKm = (v.speedKmh * dtSec) / 3600;
  const rad = (v.bearing * Math.PI) / 180;
  v.lat += (distKm * Math.cos(rad)) / 111.32;
  v.lng += (distKm * Math.sin(rad)) / (111.32 * Math.cos((v.lat * Math.PI) / 180));
}

async function tick() {
  tickCount++;
  for (const v of fleet) {
    step(v, TICK_MS / 1000);
    try {
      await saveGpsPoint({
        vehicleId: v.vehicleId,
        driverId: v.driverId,
        latitude: v.lat,
        longitude: v.lng,
        accuracy: 8 + Math.random() * 10,
        speed: v.speedKmh,
        heading: ((v.bearing % 360) + 360) % 360,
        isSimulated: true,
      });
    } catch (e) {
      console.error('sim tick failed for', v.registration, e);
    }
  }
  lastTickAt = new Date().toISOString();
}

export async function startSimulation() {
  if (process.env.SIMULATION_ENABLED !== 'true') throw new Error('Simulation disabled (SIMULATION_ENABLED!=true)');
  if (timer) return status();
  const assignments = await prisma.vehicleAssignment.findMany({
    where: { active: true },
    include: { vehicle: true, driver: true },
    take: 10,
  });
  if (assignments.length === 0) throw new Error('No active vehicle assignments — assign a driver to a vehicle first');
  fleet = assignments.map((a, i) => {
    const baseLat = a.vehicle.lastLat ?? 17.385 + i * 0.02;
    const baseLng = a.vehicle.lastLng ?? 78.4867 + i * 0.02;
    return {
      vehicleId: a.vehicleId,
      driverId: a.driverId,
      registration: a.vehicle.registrationNumber,
      lat: baseLat,
      lng: baseLng,
      originLat: baseLat,
      originLng: baseLng,
      bearing: Math.random() * 360,
      speedKmh: 30 + Math.random() * 15,
    };
  });
  await tick();
  timer = setInterval(tick, TICK_MS);
  return status();
}

export function stopSimulation() {
  if (timer) clearInterval(timer);
  timer = null;
  return status();
}

export function status() {
  return {
    running: timer !== null,
    intervalMs: TICK_MS,
    vehicles: fleet.map((v) => ({ registration: v.registration, lat: v.lat, lng: v.lng, speedKmh: Math.round(v.speedKmh) })),
    tickCount,
    lastTickAt,
    demo: true as const,
    notice: 'DEMO DATA — simulated movement, not real GPS',
  };
}
