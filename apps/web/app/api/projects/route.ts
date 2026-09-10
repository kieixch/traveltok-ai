import { route } from "@/lib/server/route";
import { projectsService } from "@/lib/server/services/projects.service";
import { pageParams } from "@/lib/server/utils";
import { errs, isString, isOptionalObject, minLength, maxLength } from "@/lib/server/validate";

export const GET = route(async ({ user, query }) => {
  const { page, pageSize } = pageParams(query);
  return projectsService.list(user.userId, page, pageSize, query.get("search") ?? undefined);
});

export const POST = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.name, "name"),
    minLength(dto.name, 2, "name"),
    maxLength(dto.name, 120, "name"),
    isOptionalObject(dto.description, "description"),
    isOptionalObject(dto.niche, "niche"),
  ]);
  if (dto.description !== undefined && dto.description !== null) {
    errs([
      isString(dto.description, "description"),
      maxLength(dto.description as string, 500, "description"),
    ]);
  }
  if (dto.niche !== undefined && dto.niche !== null) {
    errs([
      isString(dto.niche, "niche"),
      maxLength(dto.niche as string, 120, "niche"),
    ]);
  }
  return projectsService.create(user.userId, {
    name: String(dto.name),
    description: dto.description === null ? undefined : (dto.description as string | undefined),
    niche: dto.niche === null ? undefined : (dto.niche as string | undefined),
  });
});