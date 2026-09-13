import { route } from "@/lib/server/route";
import { creatorsService } from "@/lib/server/services/creators.service";

export const GET = route(async ({ user, params }) => {
  return creatorsService.getById(params.id, user.userId);
});