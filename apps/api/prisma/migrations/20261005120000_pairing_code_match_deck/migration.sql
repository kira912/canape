-- AlterTable
ALTER TABLE "DevicePairing" ADD COLUMN     "verificationCode" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MatchSession" ADD COLUMN     "deck" JSONB NOT NULL DEFAULT '[]';

