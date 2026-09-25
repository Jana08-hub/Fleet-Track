-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DRIVER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'PENDING');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_TRIP', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_TRIP', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DELAYED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SPEED_LIMIT_EXCEEDED', 'VEHICLE_OFFLINE', 'GPS_UNAVAILABLE', 'GEOZONE_ENTRY', 'GEOZONE_EXIT', 'UNAUTHORIZED_MOVEMENT', 'LONG_STOP', 'MAINTENANCE_DUE', 'INSURANCE_EXPIRY', 'LICENSE_EXPIRY', 'TRIP_DELAY', 'FAILED_GPS_UPDATE', 'ACCOUNT_SECURITY');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "GeofenceEventType" AS ENUM ('GEOZONE_ENTRY', 'GEOZONE_EXIT', 'UNAUTHORIZED_MOVEMENT', 'LONG_STOP', 'SPEED_LIMIT_EXCEEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "accountApproved" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "passwordResetTokenHash" TEXT,
    "passwordResetExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "sentByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sentByAdminId" TEXT,
    "emailType" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturingYear" INTEGER NOT NULL,
    "fuelType" TEXT NOT NULL,
    "mileage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "insuranceExpiry" TIMESTAMP(3),
    "pollutionExpiry" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "emergencyContact" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "plannedStartTime" TIMESTAMP(3),
    "expectedArrivalTime" TIMESTAMP(3),
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "status" "TripStatus" NOT NULL DEFAULT 'PLANNED',
    "totalDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxSpeed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GPSLocation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "deviceTimestamp" TIMESTAMP(3),
    "serverTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSimulated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GPSLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radius" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT,
    "eventType" "GeofenceEventType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "tripId" TEXT,
    "alertType" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentMileage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextServiceDate" TIMESTAMP(3),
    "nextServiceMileage" DOUBLE PRECISION,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_emailType_idx" ON "EmailLog"("emailType");

-- CreateIndex
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_licenseNumber_key" ON "Driver"("licenseNumber");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE INDEX "VehicleAssignment_vehicleId_idx" ON "VehicleAssignment"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_driverId_idx" ON "VehicleAssignment"("driverId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_active_idx" ON "VehicleAssignment"("active");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_idx" ON "Trip"("vehicleId");

-- CreateIndex
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_createdAt_idx" ON "Trip"("createdAt");

-- CreateIndex
CREATE INDEX "GPSLocation_vehicleId_serverTimestamp_idx" ON "GPSLocation"("vehicleId", "serverTimestamp");

-- CreateIndex
CREATE INDEX "GPSLocation_tripId_serverTimestamp_idx" ON "GPSLocation"("tripId", "serverTimestamp");

-- CreateIndex
CREATE INDEX "GPSLocation_driverId_idx" ON "GPSLocation"("driverId");

-- CreateIndex
CREATE INDEX "Geofence_active_idx" ON "Geofence"("active");

-- CreateIndex
CREATE INDEX "GeofenceEvent_vehicleId_idx" ON "GeofenceEvent"("vehicleId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_geofenceId_idx" ON "GeofenceEvent"("geofenceId");

-- CreateIndex
CREATE INDEX "GeofenceEvent_occurredAt_idx" ON "GeofenceEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "Alert_vehicleId_idx" ON "Alert"("vehicleId");

-- CreateIndex
CREATE INDEX "Alert_alertType_idx" ON "Alert"("alertType");

-- CreateIndex
CREATE INDEX "Alert_isRead_idx" ON "Alert"("isRead");

-- CreateIndex
CREATE INDEX "Alert_isResolved_idx" ON "Alert"("isResolved");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleId_idx" ON "MaintenanceRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_serviceDate_idx" ON "MaintenanceRecord"("serviceDate");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_sentByAdminId_fkey" FOREIGN KEY ("sentByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentByAdminId_fkey" FOREIGN KEY ("sentByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GPSLocation" ADD CONSTRAINT "GPSLocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GPSLocation" ADD CONSTRAINT "GPSLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GPSLocation" ADD CONSTRAINT "GPSLocation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "Geofence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
