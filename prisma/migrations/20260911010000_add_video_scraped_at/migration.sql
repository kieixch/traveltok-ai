-- AlterTable
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "scrapedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_projectId_scrapedAt_idx" ON "Video"("projectId", "scrapedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Video_scrapedAt_idx" ON "Video"("scrapedAt");