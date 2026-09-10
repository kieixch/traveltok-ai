import { route } from "@/lib/server/route";
import { semanticSearchService } from "@/lib/server/services/semantic-search.service";
import { EMBEDDING_ENTITY_TYPES } from "@/lib/server/services/embeddings.service";

export const GET = route(async ({ user, query }) => {
  const projectId = query.get("projectId");
  if (!projectId) {
    return [];
  }
  const entityTypesRaw = query.get("entityTypes");
  const requested = entityTypesRaw
    ? entityTypesRaw.split(",").filter(Boolean)
    : [];
  const entityTypes =
    requested.length > 0
      ? EMBEDDING_ENTITY_TYPES.filter((t) => requested.includes(t))
      : EMBEDDING_ENTITY_TYPES;
  const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 10) || 10));
  return semanticSearchService.search({
    userId: user.userId,
    projectId,
    query: query.get("q") ?? "",
    entityTypes: entityTypes.length > 0 ? entityTypes : EMBEDDING_ENTITY_TYPES,
    limit,
  });
});