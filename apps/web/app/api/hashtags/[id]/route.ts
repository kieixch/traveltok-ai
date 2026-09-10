import { route } from "@/lib/server/route";
import { hashtagsService } from "@/lib/server/services/hashtags.service";

export const GET = route(async ({ params }) => {
  return hashtagsService.getById(params.id);
});