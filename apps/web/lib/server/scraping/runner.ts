import { getPrisma } from "@/lib/server/prisma";
import { createScraper } from "./scraper.factory";
import { persistResults } from "@/lib/server/services/scraping-jobs.service";

/**
 * Runs a scraping job to completion synchronously (mock data path or short
 * Apify runs). Mirrors the old worker's behavior; failures are persisted on
 * the job and rethrown.
 */
export async function runScrapingJob(scrapingJobId: string): Promise<{ processed: number }> {
  const job = await getPrisma().scrapingJob.findUnique({
    where: { id: scrapingJobId },
  });
  if (!job) {
    throw new Error(`Scraping job ${scrapingJobId} not found`);
  }
  if (job.status === "CANCELLED") {
    return { processed: 0 };
  }

  await getPrisma().scrapingJob.update({
    where: { id: scrapingJobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const scraper = createScraper();
    const result = await scraper.scrape({
      keyword: job.keyword,
      hashtag: job.hashtag,
      maxResults: job.maxResults ?? 20,
    });

    await persistResults(job.projectId, result.items);

    await getPrisma().scrapingJob.update({
      where: { id: scrapingJobId },
      data: {
        status: "COMPLETED",
        totalResults: result.items.length,
        processedResults: result.items.length,
        apifyRunId: result.apifyRunId ?? null,
        completedAt: new Date(),
      },
    });
    return { processed: result.items.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await getPrisma().scrapingJob.update({
      where: { id: scrapingJobId },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}