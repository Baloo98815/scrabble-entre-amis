-- CreateEnum
CREATE TYPE "ProposalOutcome" AS ENUM ('ACCEPTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "moves" ADD COLUMN     "isBingo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bonus_clicks" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_proposals" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "outcome" "ProposalOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_clicks_toPlayerId_idx" ON "bonus_clicks"("toPlayerId");

-- CreateIndex
CREATE INDEX "bonus_clicks_fromPlayerId_idx" ON "bonus_clicks"("fromPlayerId");

-- CreateIndex
CREATE INDEX "word_proposals_proposerId_idx" ON "word_proposals"("proposerId");

-- AddForeignKey
ALTER TABLE "bonus_clicks" ADD CONSTRAINT "bonus_clicks_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_clicks" ADD CONSTRAINT "bonus_clicks_fromPlayerId_fkey" FOREIGN KEY ("fromPlayerId") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_clicks" ADD CONSTRAINT "bonus_clicks_toPlayerId_fkey" FOREIGN KEY ("toPlayerId") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_proposals" ADD CONSTRAINT "word_proposals_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_proposals" ADD CONSTRAINT "word_proposals_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill : coups passés où les 7 lettres du chevalet ont été posées d'un coup.
UPDATE "moves" SET "isBingo" = true
WHERE "type" = 'PLACE' AND "tilesPlaced" IS NOT NULL AND jsonb_array_length("tilesPlaced"::jsonb) = 7;
