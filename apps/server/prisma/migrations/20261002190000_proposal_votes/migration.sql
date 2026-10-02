-- AlterEnum
ALTER TYPE "ProposalOutcome" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "word_proposals" ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "proposal_votes" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "accept" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposal_votes_voterId_idx" ON "proposal_votes"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_votes_proposalId_voterId_key" ON "proposal_votes"("proposalId", "voterId");

-- AddForeignKey
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "word_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_votes" ADD CONSTRAINT "proposal_votes_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "game_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

