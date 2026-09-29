-- CreateTable
CREATE TABLE "Watched" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watched_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Watched_householdId_idx" ON "Watched"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Watched_memberId_mediaType_tmdbId_key" ON "Watched"("memberId", "mediaType", "tmdbId");

-- AddForeignKey
ALTER TABLE "Watched" ADD CONSTRAINT "Watched_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watched" ADD CONSTRAINT "Watched_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
