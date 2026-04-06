-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyShotsDate" TIMESTAMP(3),
ADD COLUMN     "dailyShotsSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxDailyShots" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{"campaigns":true,"quickSend":true,"multiInstance":false}',
ADD COLUMN     "totalShotsSent" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "role" SET DEFAULT 'USER';
