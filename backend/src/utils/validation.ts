import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(100),
  role: z.enum(['ADMIN', 'DRIVER']).optional(),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const requestOtpSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(100),
  phoneNumber: z.string().min(6).max(20),
  licenseNumber: z.string().min(3).max(40),
  licenseExpiry: z.string().min(4).max(30),
});
export const verifyOtpSchema = z.object({
  email: z.string().email().max(160),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8).max(100) });
export const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  currentPassword: z.string().min(1).max(100).optional(),
  newPassword: z.string().min(8).max(100).optional(),
}).refine((d) => (d.newPassword ? !!d.currentPassword : true), { message: 'Current password required', path: ['currentPassword'] });

export const vehicleSchema = z.object({
  registrationNumber: z.string().min(2).max(30),
  vehicleType: z.string().min(2).max(40),
  brand: z.string().min(1).max(40),
  model: z.string().min(1).max(40),
  manufacturingYear: z.number().int().min(1990).max(2035),
  fuelType: z.string().min(2).max(20),
  mileage: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'IN_TRIP', 'MAINTENANCE', 'OFFLINE']).optional(),
  insuranceExpiry: z.string().optional(),
  pollutionExpiry: z.string().optional(),
});

export const driverSchema = z.object({
  userId: z.string().optional(),
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  licenseNumber: z.string().min(3).max(40),
  licenseExpiry: z.string(),
  phoneNumber: z.string().min(6).max(20),
  emergencyContact: z.string().max(20).optional(),
});

const tripStopSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  expectedArrivalTime: z.string().optional(),
});

export const tripSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().min(1).optional(),
  source: z.string().min(2).max(200),
  destination: z.string().min(2).max(200),
  startLatitude: z.number().min(-90).max(90).optional(),
  startLongitude: z.number().min(-180).max(180).optional(),
  destinationLatitude: z.number().min(-90).max(90).optional(),
  destinationLongitude: z.number().min(-180).max(180).optional(),
  purpose: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  plannedStartTime: z.string().optional(),
  expectedArrivalTime: z.string().optional(),
  stops: z.array(tripStopSchema).max(10).optional(),
});

export const gpsSchema = z.object({
  vehicleId: z.string().min(1),
  tripId: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
  speed: z.number().min(0).max(400).optional(),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().min(-1000).max(15000).optional(),
  deviceTimestamp: z.string().optional(),
  isSimulated: z.boolean().optional(),
});

export const geofenceSchema = z.object({
  name: z.string().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(10).max(100000),
  active: z.boolean().optional(),
});

export const maintenanceSchema = z.object({
  vehicleId: z.string().min(1),
  serviceType: z.string().min(2).max(80),
  description: z.string().min(2).max(1000),
  serviceDate: z.string(),
  cost: z.number().min(0).optional(),
  currentMileage: z.number().min(0).optional(),
  nextServiceDate: z.string().optional(),
  nextServiceMileage: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});
