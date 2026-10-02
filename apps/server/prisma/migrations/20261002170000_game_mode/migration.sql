-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLASSIC', 'SCRABBULLSHIT');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "extraWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mode" "GameMode" NOT NULL DEFAULT 'CLASSIC';
