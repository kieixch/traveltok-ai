import {
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
} from "@google/generative-ai";

/**
 * Machine-readable classification of AI provider failures. The API layer maps
 * these to HTTP status codes + friendly messages; the web layer keys friendly
 * alerts off the same codes.
 */
export type AIErrorCode =
  | "AI_QUOTA_EXCEEDED"
  | "AI_RATE_LIMITED"
  | "AI_INVALID_KEY"
  | "AI_UNAVAILABLE"
  | "AI_INVALID_RESPONSE";

export class AIError extends Error {
  constructor(
    readonly code: AIErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AIError";
  }
}

/**
 * Translates a raw provider error into a typed AIError. Unknown errors are
 * passed through unchanged so domain errors (e.g. AIClassificationError) keep
 * their own handling.
 */
export function mapProviderError(error: unknown): Error {
  if (error instanceof GoogleGenerativeAIFetchError) {
    const status = error.status;
    if (status === 429) {
      return new AIError("AI_QUOTA_EXCEEDED", error.message);
    }
    if (status === 401 || status === 403) {
      return new AIError("AI_INVALID_KEY", error.message);
    }
    if (status === 400) {
      return new AIError("AI_INVALID_RESPONSE", error.message);
    }
    return new AIError("AI_UNAVAILABLE", error.message);
  }
  if (error instanceof GoogleGenerativeAIRequestInputError) {
    return new AIError("AI_INVALID_RESPONSE", error.message);
  }
  if (
    error instanceof Error &&
    (error.name === "TypeError" || error.name === "AbortError")
  ) {
    return new AIError("AI_UNAVAILABLE", error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
