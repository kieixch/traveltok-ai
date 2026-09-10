import { Prisma } from "@traveltok/database";
import { AIClassificationError, AIError } from "@traveltok/ai";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
    this.details = details;
  }
}

export function badRequest(message = "Bad request"): HttpError {
  return new HttpError(400, message, "BAD_REQUEST");
}

export function unauthorized(message = "Authentication required"): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

export function conflict(message = "Conflict"): HttpError {
  return new HttpError(409, message, "CONFLICT");
}

export function validationFailed(messages: unknown[]): HttpError {
  return new HttpError(422, "Validation failed", "VALIDATION_ERROR", messages);
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && !(value instanceof Date)) {
    if (Array.isArray(value)) return value.map(normalize);
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) out[key] = normalize(obj[key]);
    return out;
  }
  return value;
}

export function ok<T>(data: T): { success: true; data: unknown } {
  return { success: true, data: normalize(data) };
}

const AI_ERROR_MESSAGES: Record<AIError["code"], string> = {
  AI_QUOTA_EXCEEDED:
    "Kuota AI (Gemini) harian telah habis. Coba lagi nanti atau pilih provider Mock di menu AI Engine untuk demo.",
  AI_RATE_LIMITED: "Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.",
  AI_INVALID_KEY: "Kunci API AI tidak valid. Periksa konfigurasi server.",
  AI_UNAVAILABLE: "Layanan AI sedang tidak tersedia. Coba lagi beberapa saat.",
  AI_INVALID_RESPONSE: "Respons AI tidak valid. Silakan coba lagi.",
};

const isValidationBody = (body: unknown): body is { message: unknown[] } =>
  typeof body === "object" &&
  body !== null &&
  Array.isArray((body as { message?: unknown }).message);

interface ErrorEnvelope extends Record<string, unknown> {
  success: false;
  message: string;
  code: string;
}

export function toErrorResponse(exception: unknown): {
  status: number;
  body: ErrorEnvelope;
} {
  let status = 500;
  let message = "Internal server error";
  let code = "INTERNAL_SERVER_ERROR";
  let details: unknown;

  if (exception instanceof HttpError) {
    status = exception.status;
    message = exception.message;
    code = exception.code;
    details = exception.details;
  } else if (exception instanceof Error && "status" in exception) {
    // Structural duck-typing for exceptions that carry a status.
    const err = exception as Error & { status?: number; code?: string };
    status = err.status ?? 500;
    message = err.message;
    code = err.code ?? `HTTP_${status}`;
  } else if (exception instanceof AIError) {
    status =
      exception.code === "AI_QUOTA_EXCEEDED" || exception.code === "AI_RATE_LIMITED"
        ? 429
        : 502;
    message = AI_ERROR_MESSAGES[exception.code];
    code = exception.code;
    details = exception.message;
  } else if (exception instanceof AIClassificationError) {
    status = 502;
    message = AI_ERROR_MESSAGES.AI_INVALID_RESPONSE;
    code = "AI_INVALID_RESPONSE";
    details = exception.issues;
  } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case "P2002":
        status = 409;
        message = "A record with these unique values already exists";
        code = "UNIQUE_CONSTRAINT_VIOLATION";
        details = exception.meta;
        break;
      case "P2025":
        status = 404;
        message = "Record not found";
        code = "RECORD_NOT_FOUND";
        break;
      case "P2003":
        status = 400;
        message = "Referenced record does not exist";
        code = "FOREIGN_KEY_VIOLATION";
        break;
      default:
        status = 400;
        message = "Database error";
        code = `DB_${exception.code}`;
    }
  } else if (exception instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    message = "Invalid query";
    code = "PRISMA_VALIDATION_ERROR";
  } else if (exception instanceof Error) {
    details = exception.message;
    message = "Terjadi kesalahan pada server. Silakan coba lagi.";
  }

  const envelope: ErrorEnvelope = { success: false, message, code };
  if (details !== undefined) envelope.details = details;
  return { status, body: envelope };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export { normalize };