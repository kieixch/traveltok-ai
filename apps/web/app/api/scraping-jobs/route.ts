import { route } from "@/lib/server/route";
import { scrapingJobsService } from "@/lib/server/services/scraping-jobs.service";
import { pageParams } from "@/lib/server/utils";
import { badRequest } from "@/lib/server/http";

const STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;

export const GET = route(async ({ user, query }) => {
  const { page, pageSize } = pageParams(query);
  const statusRaw = query.get("status");
  return scrapingJobsService.list(
    page,
    pageSize,
    {
      projectId: query.get("projectId") ?? undefined,
      status: STATUSES.includes(statusRaw as never) ? (statusRaw as never) : undefined,
    },
    user.userId,
  );
});

export const POST = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  if (!dto.projectId) {
    throw badRequest("projectId is required");
  }
  return scrapingJobsService.create(
    {
      projectId: String(dto.projectId),
      keyword: dto.keyword !== undefined ? String(dto.keyword) : undefined,
      hashtag: dto.hashtag !== undefined ? String(dto.hashtag) : undefined,
      maxResults: dto.maxResults !== undefined ? Number(dto.maxResults) : undefined,
    },
    user.userId,
  );
});