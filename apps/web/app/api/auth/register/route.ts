import { route } from "@/lib/server/route";
import { authService } from "@/lib/server/services/auth.service";
import { errs, isEmail, isString, minLength, maxLength, matches } from "@/lib/server/validate";

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const POST = route(async ({ body }) => {
  const dto = (body ?? {}) as Record<string, unknown>;
  errs([
    isString(dto.name, "name"),
    minLength(dto.name, 2, "name"),
    maxLength(dto.name, 120, "name"),
    isString(dto.email, "email"),
    isEmail(dto.email, "email"),
    maxLength(dto.email, 255, "email"),
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
  return authService.register({
    name: String(dto.name),
    email: String(dto.email),
    password: String(dto.password),
  });
}, { public: true });