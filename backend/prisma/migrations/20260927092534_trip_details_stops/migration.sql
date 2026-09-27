-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinationLatitude" DOUBLE PRECISION,
ADD COLUMN     "destinationLongitude" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "startLatitude" DOUBLE PRECISION,
ADD COLUMN     "startLongitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "expectedArrivalTime" TIMESTAMP(3),
    "stopOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripStop_tripId_stopOrder_idx" ON "TripStop"("tripId", "stopOrder");

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
