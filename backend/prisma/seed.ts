import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Home base for the demo fleet (Hyderabad). Simulation roams around here.
const BASE_LAT = 17.385;
const BASE_LNG = 78.4867;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@fleettrack.example';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const hash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Fleet Admin', email, passwordHash: hash, role: 'ADMIN', emailVerified: true, accountApproved: true, accountStatus: 'ACTIVE' },
  });
  console.log('Seed admin:', admin.email);

  const vehicles: Array<[string, string, string, number, number]> = [
    ['DEMO-001', 'Truck', 'Tata Ace', BASE_LAT, BASE_LNG],
    ['DEMO-002', 'Van', 'Mahindra Bolero', BASE_LAT + 0.02, BASE_LNG + 0.015],
    ['DEMO-003', 'Car', 'Maruti Swift', BASE_LAT - 0.015, BASE_LNG - 0.02],
  ];
  for (const [reg, type, model, lat, lng] of vehicles) {
    const [brand, ...rest] = model.split(' ');
    await prisma.vehicle.upsert({
      where: { registrationNumber: reg },
      update: { lastLat: lat, lastLng: lng },
      create: {
        registrationNumber: reg, vehicleType: type, brand, model: rest.join(' ') || brand,
        manufacturingYear: 2022, fuelType: 'Diesel', status: 'ACTIVE', lastLat: lat, lastLng: lng,
      },
    });
    console.log('Seed vehicle:', reg);
  }

  // Demo driver (verified + approved so login works immediately)
  const driverEmail = 'driver@fleettrack.example';
  const driverUser = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      name: 'Demo Driver', email: driverEmail,
      passwordHash: await bcrypt.hash('Driver@12345', 12),
      role: 'DRIVER', emailVerified: true, accountApproved: true, accountStatus: 'ACTIVE',
    },
  });
  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id, licenseNumber: 'TS09-2020-0001234',
      licenseExpiry: new Date('2030-01-01'), phoneNumber: '+919000000001', status: 'ACTIVE',
    },
  });
  console.log('Seed driver:', driverEmail);

  // Assign the driver to DEMO-001 so GPS submissions + simulation resolve
  const v1 = await prisma.vehicle.findUnique({ where: { registrationNumber: 'DEMO-001' } });
  if (v1) {
    await prisma.vehicleAssignment.updateMany({ where: { vehicleId: v1.id, active: true }, data: { active: false, unassignedAt: new Date() } });
    const existing = await prisma.vehicleAssignment.findFirst({ where: { vehicleId: v1.id, driverId: driver.id, active: true } });
    if (!existing) await prisma.vehicleAssignment.create({ data: { vehicleId: v1.id, driverId: driver.id } });
    console.log('Seed assignment: driver -> DEMO-001');
  }

  // Demo geofence around the base so entry/exit events fire live
  const gf = await prisma.geofence.findFirst({ where: { name: 'Hyderabad Depot' } });
  if (!gf) {
    await prisma.geofence.create({ data: { name: 'Hyderabad Depot', latitude: BASE_LAT, longitude: BASE_LNG, radius: 1500, active: true } });
    console.log('Seed geofence: Hyderabad Depot');
  }
}

main().finally(() => prisma.$disconnect());
