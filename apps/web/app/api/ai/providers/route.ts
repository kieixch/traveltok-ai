import { route } from "@/lib/server/route";
import { aiRuntimeService } from "@/lib/server/services/ai-runtime.service";

export const GET = route(async ({ user }) => {
  return aiRuntimeService.providersInfo(user.userId);
});