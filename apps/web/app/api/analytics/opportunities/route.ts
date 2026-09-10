import { route } from "@/lib/server/route";
import { opportunityService } from "@/lib/server/services/opportunity.service";

export const GET = route(async ({ query }) => {
  const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 10) || 10));
  return opportunityService.findOpportunities(
    query.get("projectId") ?? undefined,
    limit,
  );
});