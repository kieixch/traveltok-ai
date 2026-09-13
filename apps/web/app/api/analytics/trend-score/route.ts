import { route } from "@/lib/server/route";
import { trendScoreService } from "@/lib/server/services/trend-score.service";

export const GET = route(async ({ user, query }) => {
  const periodDaysRaw = query.get("periodDays");
  return trendScoreService.score({
    projectId: query.get("projectId") ?? undefined,
    keyword: query.get("keyword") ?? undefined,
    hashtag: query.get("hashtag") ?? undefined,
    periodDays:
      periodDaysRaw && !Number.isNaN(Number(periodDaysRaw))
        ? Number(periodDaysRaw)
        : undefined,
  }, user.userId);
});