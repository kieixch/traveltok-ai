import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "@traveltok/database";
import { AIClassificationError, AIError } from "@traveltok/ai";

const isValidationBody = (body: unknown): body is { message: unknown[] } =>
  typeof body === "object" &&
  body !== null &&
  Array.isArray((body as { message?: unknown }).message);

const AI_ERROR_MESSAGES: Record<AIError["code"], string> = {
  AI_QUOTA_EXCEEDED:
    "Kuota AI (Gemini) harian telah habis. Coba lagi nanti atau pilih provider Mock di menu AI Engine untuk demo.",
  AI_RATE_LIMITED:
    "Terlalu banyak permintaan AI. Tunggu sebentar lalu coba lagi.",
  AI_INVALID_KEY:
    "Kunci API AI tidak valid. Periksa konfigurasi server.",
  AI_UNAVAILABLE:
    "Layanan AI sedang tidak tersedia. Coba lagi beberapa saat.",
  AI_INVALID_RESPONSE:
    "Respons AI tidak valid. Silakan coba lagi.",
};

/**
 * Maps every exception to the shared error envelope:
 * `{ success: false, message, code, details? }`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let code = "INTERNAL_SERVER_ERROR";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "string") {
        message = body;
        code = `HTTP_${status}`;
      } else if (isValidationBody(body)) {
        details = body.message;
        message = "Validation failed";
        code = "VALIDATION_ERROR";
      } else {
        const err = body as { message?: string; error?: string };
        message = err.message ?? exception.message;
        code = (err.error ?? `HTTP_${status}`)
          .toUpperCase()
          .replace(/\s+/g, "_");
      }
    } else if (exception instanceof AIError) {
      status =
        exception.code === "AI_QUOTA_EXCEEDED" ||
        exception.code === "AI_RATE_LIMITED"
          ? HttpStatus.TOO_MANY_REQUESTS
          : HttpStatus.BAD_GATEWAY;
      message = AI_ERROR_MESSAGES[exception.code];
      code = exception.code;
      details = exception.message;
    } else if (exception instanceof AIClassificationError) {
      status = HttpStatus.BAD_GATEWAY;
      message = AI_ERROR_MESSAGES.AI_INVALID_RESPONSE;
      code = "AI_INVALID_RESPONSE";
      details = exception.issues;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          status = HttpStatus.CONFLICT;
          message = "A record with these unique values already exists";
          code = "UNIQUE_CONSTRAINT_VIOLATION";
          details = exception.meta;
          break;
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          message = "Record not found";
          code = "RECORD_NOT_FOUND";
          break;
        case "P2003":
          status = HttpStatus.BAD_REQUEST;
          message = "Referenced record does not exist";
          code = "FOREIGN_KEY_VIOLATION";
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = "Database error";
          code = `DB_${exception.code}`;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = "Invalid query";
      code = "PRISMA_VALIDATION_ERROR";
    } else if (exception instanceof Error) {
      // Never leak internal/raw error text to the client. The original message
      // is kept in `details` for server-side debugging.
      details = exception.message;
      message = "Terjadi kesalahan pada server. Silakan coba lagi.";
    }

    const envelope: Record<string, unknown> = {
      success: false,
      message,
      code,
    };
    if (details !== undefined) envelope.details = details;

    response.status(status).json(envelope);
  }
}
