-- CreateTable
CREATE TABLE "DevicePairing" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "memberId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevicePairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevicePairing_secretHash_key" ON "DevicePairing"("secretHash");

-- CreateIndex
CREATE INDEX "DevicePairing_expiresAt_idx" ON "DevicePairing"("expiresAt");

-- AddForeignKey
ALTER TABLE "DevicePairing" ADD CONSTRAINT "DevicePairing_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
