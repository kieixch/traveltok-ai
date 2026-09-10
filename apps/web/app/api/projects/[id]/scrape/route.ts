import { route } from "@/lib/server/route";
import { projectsService } from "@/lib/server/services/projects.service";
import { isInt, isNumber, errs, isOptionalObject } from "@/lib/server/validate";

export const POST = route(async ({ user, params, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([isOptionalObject(dto, "body")]);
  return projectsService.scrape(user.userId, params.id, {
    ...(dto.keyword !== undefined && dto.keyword !== null
      ? { keyword: String(dto.keyword) }
      : {}),
    ...(dto.hashtag !== undefined && dto.hashtag !== null
      ? { hashtag: String(dto.hashtag) }
      : {}),
    ...(dto.maxResults !== undefined && dto.maxResults !== null
      ? { maxResults: Number(dto.maxResults) }
      : {}),
  });
});