import { route } from "@/lib/server/route";
import { contentIdeasService } from "@/lib/server/services/content-ideas.service";

export const GET = route(async ({ user, params }) => {
  return { ideas: await contentIdeasService.listForVideo(params.id, user.userId) };
});