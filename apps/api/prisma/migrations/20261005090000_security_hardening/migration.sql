-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "recoveryCodeHash" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_recoveryCodeHash_key" ON "Member"("recoveryCodeHash");

