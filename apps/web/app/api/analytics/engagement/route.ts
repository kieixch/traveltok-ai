import { route } from "@/lib/server/route";
import { analyticsService } from "@/lib/server/services/analytics.service";

const BUCKETS = ["day", "week", "month"] as const;

export const GET = route(async ({ query }) => {
  const bucketRaw = query.get("bucket");
  const bucket = BUCKETS.includes(bucketRaw as never)
    ? (bucketRaw as "day" | "week" | "month")
    : "day";
  const fromRaw = query.get("from");
  const toRaw = query.get("to");
  return analyticsService.engagement(
    query.get("projectId") ?? undefined,
    fromRaw && !Number.isNaN(Date.parse(fromRaw)) ? new Date(fromRaw) : undefined,
    toRaw && !Number.isNaN(Date.parse(toRaw)) ? new Date(toRaw) : undefined,
    bucket,
  );
});