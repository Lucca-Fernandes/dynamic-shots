-- DropIndex
DROP INDEX "Lead_status_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "delayMax" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "delayMin" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "mediaType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_campaignId_status_idx" ON "Lead"("campaignId", "status");
