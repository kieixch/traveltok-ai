import { route } from "@/lib/server/route";
import { scrapingJobsService } from "@/lib/server/services/scraping-jobs.service";

export const GET = route(async ({ user, params }) => {
  return scrapingJobsService.getById(params.id, user.userId);
});