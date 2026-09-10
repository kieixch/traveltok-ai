import { validationFailed } from "./http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FieldError {
  property: string;
  message: string;
}

export function validate(checks: FieldError[]): void {
  const errors = checks.filter((c) => c.message.length > 0);
  if (errors.length > 0) {
    validationFailed(errors.map((e) => e.message));
  }
}

export function errs(
  checks: FieldError[],
  throwOnError = true,
): FieldError[] {
  const errors = checks.filter((c) => c.message.length > 0);
  if (throwOnError && errors.length > 0) {
    validationFailed(errors.map((e) => e.message));
  }
  return errors;
}

function msg(result: boolean, property: string, rule: string, error?: string) {
  return result ? "" : error ?? `${property} must be valid (${rule})`;
}

export function isEmail(value: unknown, property = "email", error?: string): FieldError {
  return {
    property,
    message: msg(typeof value === "string" && EMAIL_RE.test(value), property, "email", error),
  };
}

export function isString(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(typeof value === "string", property, "string", error),
  };
}

export function minLength(
  value: unknown,
  min: number,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "string" && value.length >= min,
      property,
      `minLength:${min}`,
      error,
    ),
  };
}

export function maxLength(
  value: unknown,
  max: number,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "string" && value.length <= max,
      property,
      `maxLength:${max}`,
      error,
    ),
  };
}

export function matches(
  value: unknown,
  regex: RegExp,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "string" && regex.test(value),
      property,
      `matches:${regex}`,
      error,
    ),
  };
}

export function isInt(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "number" && Number.isInteger(value),
      property,
      "int",
      error,
    ),
  };
}

export function isNumber(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(typeof value === "number" && !Number.isNaN(value), property, "number", error),
  };
}

export function isBoolean(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(typeof value === "boolean", property, "boolean", error),
  };
}

export function isEnum(
  value: unknown,
  allowed: readonly string[],
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "string" && allowed.includes(value),
      property,
      `in:${allowed.join(",")}`,
      error,
    ),
  };
}

export function isISO8601(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  return {
    property,
    message: msg(
      typeof value === "string" && !Number.isNaN(Date.parse(value)),
      property,
      "iso8601",
      error,
    ),
  };
}

export function isUrl(
  value: unknown,
  property: string,
  error?: string,
): FieldError {
  let valid = typeof value === "string";
  if (valid) {
    try {
      const u = new URL(value as string);
      valid = u.protocol === "http:" || u.protocol === "https:";
    } catch {
      valid = false;
    }
  }
  return { property, message: msg(valid, property, "url", error) };
}

export function isOptionalObject(value: unknown, property: string): FieldError {
  if (value === undefined || value === null) return { property, message: "" };
  return {
    property,
    message: msg(typeof value === "object" && !Array.isArray(value), property, "object"),
  };
}

export function isOptionalArray(value: unknown, property: string): FieldError {
  if (value === undefined || value === null) return { property, message: "" };
  return { property, message: msg(Array.isArray(value), property, "array") };
}