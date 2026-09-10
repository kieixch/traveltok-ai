import { route } from "@/lib/server/route";
import { embeddingsService } from "@/lib/server/services/embeddings.service";

export const POST = route(async ({ user, params }) => {
  return embeddingsService.indexProject(user.userId, params.id);
});