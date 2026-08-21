-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ScrapingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('POV', 'VLOG', 'LISTICLE', 'TUTORIAL', 'REVIEW', 'STORYTELLING', 'CINEMATIC', 'TALKING_HEAD', 'VOICE_OVER', 'BEFORE_AFTER', 'OTHER');

-- CreateEnum
CREATE TYPE "HookType" AS ENUM ('QUESTION', 'CURIOSITY', 'SHOCK', 'PROBLEM', 'PROMISE', 'LIST', 'STORY', 'CONTRAST', 'DIRECT_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED');

-- CreateEnum
CREATE TYPE "TrendType" AS ENUM ('TOPIC', 'HASHTAG', 'DESTINATION', 'FORMAT', 'HOOK');

-- CreateEnum
CREATE TYPE "ContentIdeaStatus" AS ENUM ('IDEA', 'DRAFT', 'SCHEDULED', 'USED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentPlanItemStatus" AS ENUM ('IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "niche" TEXT,
    "createdById" TEXT NOT NULL,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT,
    "hashtag" TEXT,
    "maxResults" INTEGER,
    "status" "ScrapingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "apifyRunId" TEXT,
    "totalResults" INTEGER,
    "processedResults" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "profileUrl" TEXT,
    "avatarUrl" TEXT,
    "followers" INTEGER,
    "following" INTEGER,
    "totalLikes" BIGINT,
    "videoCount" INTEGER,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "duration" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "musicName" TEXT,
    "location" TEXT,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMetric" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "views" BIGINT NOT NULL,
    "likes" BIGINT NOT NULL,
    "comments" BIGINT NOT NULL,
    "shares" BIGINT NOT NULL,
    "saves" BIGINT,
    "engagementRate" DOUBLE PRECISION,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VideoMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoHashtag" (
    "videoId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,

    CONSTRAINT "VideoHashtag_pkey" PRIMARY KEY ("videoId","hashtagId")
);

-- CreateTable
CREATE TABLE "ContentAnalysis" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "topic" TEXT,
    "subTopic" TEXT,
    "destination" TEXT,
    "contentFormat" "ContentFormat",
    "hookType" "HookType",
    "hookText" TEXT,
    "ctaType" TEXT,
    "sentiment" "Sentiment",
    "targetAudience" TEXT,
    "estimatedIntent" TEXT,
    "aiScore" DOUBLE PRECISION,
    "analysisVersion" TEXT NOT NULL DEFAULT '1',
    "model" TEXT,
    "rawJson" JSONB,
    "isSeedData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" "TrendType" NOT NULL,
    "trendScore" DOUBLE PRECISION,
    "growthRate" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,
    "frequencyScore" DOUBLE PRECISION,
    "recencyScore" DOUBLE PRECISION,
    "opportunityScore" DOUBLE PRECISION,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "destination" TEXT,
    "format" "ContentFormat",
    "hook" TEXT,
    "concept" TEXT,
    "targetAudience" TEXT,
    "cta" TEXT,
    "estimatedDuration" INTEGER,
    "opportunityScore" DOUBLE PRECISION,
    "aiReasoning" TEXT,
    "status" "ContentIdeaStatus" NOT NULL DEFAULT 'IDEA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ContentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPlanItem" (
    "id" TEXT NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "contentIdeaId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "script" TEXT,
    "caption" TEXT,
    "hashtags" TEXT,
    "cta" TEXT,
    "format" "ContentFormat",
    "status" "ContentPlanItemStatus" NOT NULL DEFAULT 'IDEA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "ScrapingJob_projectId_idx" ON "ScrapingJob"("projectId");

-- CreateIndex
CREATE INDEX "ScrapingJob_status_idx" ON "ScrapingJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_externalId_key" ON "Creator"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_externalId_key" ON "Video"("externalId");

-- CreateIndex
CREATE INDEX "Video_externalId_idx" ON "Video"("externalId");

-- CreateIndex
CREATE INDEX "Video_creatorId_idx" ON "Video"("creatorId");

-- CreateIndex
CREATE INDEX "Video_projectId_idx" ON "Video"("projectId");

-- CreateIndex
CREATE INDEX "Video_projectId_publishedAt_idx" ON "Video"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "Video_publishedAt_idx" ON "Video"("publishedAt");

-- CreateIndex
CREATE INDEX "VideoMetric_videoId_idx" ON "VideoMetric"("videoId");

-- CreateIndex
CREATE INDEX "VideoMetric_collectedAt_idx" ON "VideoMetric"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoMetric_videoId_collectedAt_key" ON "VideoMetric"("videoId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_normalizedName_key" ON "Hashtag"("normalizedName");

-- CreateIndex
CREATE INDEX "Hashtag_name_idx" ON "Hashtag"("name");

-- CreateIndex
CREATE INDEX "VideoHashtag_hashtagId_idx" ON "VideoHashtag"("hashtagId");

-- CreateIndex
CREATE INDEX "ContentAnalysis_videoId_idx" ON "ContentAnalysis"("videoId");

-- CreateIndex
CREATE INDEX "ContentAnalysis_topic_idx" ON "ContentAnalysis"("topic");

-- CreateIndex
CREATE INDEX "ContentAnalysis_contentFormat_idx" ON "ContentAnalysis"("contentFormat");

-- CreateIndex
CREATE INDEX "ContentAnalysis_destination_idx" ON "ContentAnalysis"("destination");

-- CreateIndex
CREATE INDEX "Trend_projectId_idx" ON "Trend"("projectId");

-- CreateIndex
CREATE INDEX "Trend_keyword_idx" ON "Trend"("keyword");

-- CreateIndex
CREATE INDEX "Trend_periodStart_idx" ON "Trend"("periodStart");

-- CreateIndex
CREATE INDEX "ContentIdea_projectId_idx" ON "ContentIdea"("projectId");

-- CreateIndex
CREATE INDEX "ContentIdea_status_idx" ON "ContentIdea"("status");

-- CreateIndex
CREATE INDEX "ContentPlan_projectId_idx" ON "ContentPlan"("projectId");

-- CreateIndex
CREATE INDEX "ContentPlanItem_contentPlanId_idx" ON "ContentPlanItem"("contentPlanId");

-- CreateIndex
CREATE INDEX "ContentPlanItem_scheduledDate_idx" ON "ContentPlanItem"("scheduledDate");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMetric" ADD CONSTRAINT "VideoMetric_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoHashtag" ADD CONSTRAINT "VideoHashtag_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoHashtag" ADD CONSTRAINT "VideoHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAnalysis" ADD CONSTRAINT "ContentAnalysis_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlan" ADD CONSTRAINT "ContentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "ContentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPlanItem" ADD CONSTRAINT "ContentPlanItem_contentIdeaId_fkey" FOREIGN KEY ("contentIdeaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;
