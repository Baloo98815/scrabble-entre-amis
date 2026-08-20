-- AlterTable
ALTER TABLE "game_players" ALTER COLUMN "rack" DROP NOT NULL;

-- AlterTable
ALTER TABLE "games" ALTER COLUMN "boardState" DROP NOT NULL,
ALTER COLUMN "bagState" DROP NOT NULL;
