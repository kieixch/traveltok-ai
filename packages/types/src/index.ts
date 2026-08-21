/**
 * Shared types for TravelTok AI.
 *
 * This package is type-only: it has no runtime code. Import types here from
 * both the API (apps/api) and the web app (apps/web) without duplicating them.
 */

// ---------------------------------------------------------------------------
// Domain enums (single source of truth = Prisma schema)
// ---------------------------------------------------------------------------

export type {
  Role,
  ScrapingJobStatus,
  ContentFormat,
  HookType,
  Sentiment,
  TrendType,
  ContentIdeaStatus,
  ContentPlanStatus,
  ContentPlanItemStatus,
} from "@traveltok/database";

// ---------------------------------------------------------------------------
// API response envelope
//
// Every endpoint responds with one of these shapes so the frontend can handle
// success/failure uniformly.
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

export type ServiceStatus = "up" | "down" | "not_configured";

export interface ServiceHealthCheck {
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthCheckResult {
  status: "ok" | "degraded";
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: ServiceHealthCheck;
    redis: ServiceHealthCheck;
  };
}
