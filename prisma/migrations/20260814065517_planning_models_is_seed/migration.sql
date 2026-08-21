-- AlterTable
ALTER TABLE "ContentIdea" ADD COLUMN     "isSeedData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContentPlan" ADD COLUMN     "isSeedData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ContentPlanItem" ADD COLUMN     "isSeedData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Trend" ADD COLUMN     "isSeedData" BOOLEAN NOT NULL DEFAULT false;
