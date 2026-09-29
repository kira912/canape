-- CreateTable
CREATE TABLE "MatchSession" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSession_householdId_closedAt_idx" ON "MatchSession"("householdId", "closedAt");

-- CreateIndex
CREATE INDEX "MatchVote_sessionId_mediaType_tmdbId_idx" ON "MatchVote"("sessionId", "mediaType", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchVote_sessionId_memberId_mediaType_tmdbId_key" ON "MatchVote"("sessionId", "memberId", "mediaType", "tmdbId");

-- AddForeignKey
ALTER TABLE "MatchSession" ADD CONSTRAINT "MatchSession_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchVote" ADD CONSTRAINT "MatchVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchVote" ADD CONSTRAINT "MatchVote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
