import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";
import { errs, isEmail, isString, maxLength } from "@/lib/server/validate";

export const POST = route(async ({ request, body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.email, "email"),
    isEmail(dto.email, "email"),
    maxLength(dto.email, 255, "email"),
  ]);
  return authService.forgotPassword(
    String(dto.email),
    new URL(request.url).origin,
  );
}, { public: true });