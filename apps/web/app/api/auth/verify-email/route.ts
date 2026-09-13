import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";
import { errs, isString, minLength, maxLength } from "@/lib/server/validate";

export const POST = route(async ({ body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.token, "token"),
    minLength(dto.token, 10, "token"),
    maxLength(dto.token, 512, "token"),
  ]);
  return authService.verifyEmail(String(dto.token));
}, { public: true });