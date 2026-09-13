import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";
import { errs, isString, minLength, maxLength, matches } from "@/lib/server/validate";

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const POST = route(async ({ body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.token, "token"),
    minLength(dto.token, 10, "token"),
    maxLength(dto.token, 512, "token"),
    isString(dto.password, "password"),
    minLength(dto.password, 8, "password"),
    maxLength(dto.password, 72, "password"),
    matches(
      dto.password,
      PASSWORD_RE,
      "password",
      "Password must contain at least one letter and one number",
    ),
  ]);
  return authService.resetPassword(
    String(dto.token),
    String(dto.password),
  );
}, { public: true });