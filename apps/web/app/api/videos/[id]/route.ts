import { route } from "@/lib/server/route";
import { videosService } from "@/lib/server/services/videos.service";

export const GET = route(async ({ params }) => {
  return videosService.getById(params.id);
});