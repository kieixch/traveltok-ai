import { route } from "@/lib/server/route";
import { trendsService } from "@/lib/server/services/trends.service";

export const GET = route(async ({ user, params }) => {
  return trendsService.getById(params.id, user.userId);
});