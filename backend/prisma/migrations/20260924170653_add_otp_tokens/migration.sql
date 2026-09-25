-- CreateTable
CREATE TABLE "OtpToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "payload" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpToken_email_idx" ON "OtpToken"("email");

-- CreateIndex
CREATE INDEX "OtpToken_expiresAt_idx" ON "OtpToken"("expiresAt");
