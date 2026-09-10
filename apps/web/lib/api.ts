import { getToken } from "./auth";
import type { ApiEnvelope, ApiErrorPayload } from "./types";

// Same-origin by default: the API runs as Next.js route handlers under /api.
// Set NEXT_PUBLIC_API_URL to point at a standalone API instead.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  query?: Record<string, string | number | undefined>;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token, query } = options;

  const sameOrigin = API_URL.startsWith("/");
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${API_URL}${path}`, sameOrigin ? origin : undefined);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const fetchTarget = sameOrigin ? `${url.pathname}${url.search}` : url.toString();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const resolvedToken = token === undefined ? getToken() : token;
  if (resolvedToken) headers.Authorization = `Bearer ${resolvedToken}`;

  let response: Response;
  try {
    response = await fetch(fetchTarget, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      `Cannot reach API at ${fetchTarget}. Is the backend running?`,
      0,
      "NETWORK_ERROR",
    );
  }

  const json = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorPayload
    | null;

  if (!response.ok || !json || !("success" in json) || json.success !== true) {
    const error = json as ApiErrorPayload | null;
    throw new ApiError(
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.code,
    );
  }

  return (json as ApiEnvelope<T>).data;
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}
