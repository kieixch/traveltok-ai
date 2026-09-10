import { route } from "@/lib/server/route";
import { aiRuntimeService } from "@/lib/server/services/ai-runtime.service";
import { type AIMode } from "@traveltok/ai";

export const PUT = route(async ({ user, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  return aiRuntimeService.setModel(
    user.userId,
    String(dto.provider) as AIMode,
    String(dto.model),
  );
});