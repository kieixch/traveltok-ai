-- AlterTable
ALTER TABLE "ContentIdea" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "caption" TEXT,
ADD COLUMN     "generatedBy" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "hashtags" TEXT[],
ADD COLUMN     "rawJson" JSONB,
ADD COLUMN     "script" TEXT,
ADD COLUMN     "scriptOutline" JSONB;

-- AlterTable
ALTER TABLE "ContentPlan" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "generatedBy" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "rawJson" JSONB;

-- AlterTable
ALTER TABLE "ContentPlanItem" ADD COLUMN     "generatedBy" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE INDEX "ContentIdea_generatedBy_idx" ON "ContentIdea"("generatedBy");
