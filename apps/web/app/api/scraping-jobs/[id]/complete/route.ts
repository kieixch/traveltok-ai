import { NextRequest } from "next/server";
import { scrapingJobsService } from "@/lib/server/services/scraping-jobs.service";
import { jsonResponse, ok, unauthorized, toErrorResponse } from "@/lib/server/http";

interface ApifyWebhookPayload {
  eventData?: { actorRunId?: string; actorId?: string; run?: { id?: string } };
  actorRunId?: string;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.SCRAPE_WEBHOOK_SECRET;
  if (secret) {
    const token = request.nextUrl.searchParams.get("token");
    if (token !== secret) {
      return jsonResponse(401, unauthorized("Unauthorized"));
    }
  }

  const segments = request.nextUrl.pathname.split("/");
  const jobId = segments[3];
  try {
    let payload: ApifyWebhookPayload = {};
    try {
      payload = (await request.json()) as ApifyWebhookPayload;
    } catch {
      return jsonResponse(400, { success: false, message: "Invalid webhook payload", code: "BAD_REQUEST" });
    }
    const apifyRunId = payload.eventData?.actorRunId ?? payload.actorRunId;
    if (!apifyRunId) {
      return jsonResponse(400, { success: false, message: "Missing actorRunId", code: "BAD_REQUEST" });
    }
    const saved = await scrapingJobsService.completeFromWebhook(jobId, apifyRunId);
    return jsonResponse(200, ok({ completed: saved }));
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return jsonResponse(status, body);
  }
}