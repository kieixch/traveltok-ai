import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";

export const GET = route(async ({ user }) => {
  return authService.me(user.userId);
});