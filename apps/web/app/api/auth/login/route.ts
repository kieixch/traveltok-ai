import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";
import { errs, isEmail, isString, minLength, maxLength, matches } from "@/lib/server/validate";

export const POST = route(async ({ body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.email, "email"),
    isEmail(dto.email, "email"),
    maxLength(dto.email, 255, "email"),
    isString(dto.password, "password"),
    maxLength(dto.password, 72, "password"),
  ]);
  return authService.login({
    email: String(dto.email),
    password: String(dto.password),
  });
}, { public: true });