-- AlterTable: add sourceVideoId to ContentIdea
ALTER TABLE "ContentIdea" ADD COLUMN IF NOT EXISTS "sourceVideoId" TEXT;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentIdea_sourceVideoId_fkey') THEN
    ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_sourceVideoId_fkey" FOREIGN KEY ("sourceVideoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentIdea_sourceVideoId_idx" ON "ContentIdea"("sourceVideoId");
