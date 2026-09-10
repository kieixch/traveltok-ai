import { route } from "@/lib/server/route";
import { contentIdeasService } from "@/lib/server/services/content-ideas.service";
import { pageParams } from "@/lib/server/utils";

const STATUSES = ["IDEA", "DRAFT", "SCHEDULED", "USED", "ARCHIVED"] as const;

export const GET = route(async ({ query }) => {
  const { page, pageSize } = pageParams(query);
  const statusRaw = query.get("status");
  return contentIdeasService.list(page, pageSize, {
    projectId: query.get("projectId") ?? undefined,
    status: STATUSES.includes(statusRaw as never) ? (statusRaw as never) : undefined,
  });
});