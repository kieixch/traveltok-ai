import type { NextRequest } from "next/server";
import { requireAuth, type AuthUser } from "./auth";
import {
  ok,
  toErrorResponse,
  jsonResponse,
  HttpError,
  unauthorized,
} from "./http";
import { isRetryableDbError, resetPrisma } from "./prisma";

export interface RouteContext {
  request: NextRequest;
  user: AuthUser;
  params: Record<string, string>;
  body: unknown;
  query: URLSearchParams;
}

type Handler<P = Record<string, string>> = (ctx: RouteContext) => Promise<unknown>;

interface RouteOptions {
  /** Endpoints that need no auth (login/register/health/webhook). */
  public?: boolean;
}

/**
 * Wraps a route handler: requires auth (unless public), parses params/body,
 * wraps success data in `{ success: true, data }` and maps errors to the
 * shared error envelope — mirroring the old NestJS guards/filter/interceptor.
 *
 * Read-only requests are retried once when the DB pool fails on a cold start
 * (stale idle connection). The pool is recreated before the second attempt, so
 * a single transient failure no longer surfaces as a "database error" to the
 * user.
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
  options: RouteOptions = {},
) {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response> => {
    const handle = async (): Promise<[unknown, unknown]> => {
      try {
        const user = options.public
          ? (null as unknown as AuthUser)
          : await requireAuth(request);

        const params = (await context.params) as Record<string, string>;
        const query = request.nextUrl.searchParams;

        let body: unknown;
        try {
          body = request.body
            ? await request.json().catch(() => undefined)
            : undefined;
        } catch {
          body = undefined;
        }

        const data = await handler({ request, user, params, body, query } as RouteContext);
        return [data, null];
      } catch (error) {
        return [null, error];
      }
    };

    let [data, error] = await handle();

    const idempotent =
      request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS";
    if (idempotent && error && isRetryableDbError(error)) {
      await resetPrisma();
      [data, error] = await handle();
    }

    if (error) {
      const { status, body } = toErrorResponse(error);
      return jsonResponse(status, body);
    }
    return jsonResponse(200, ok(data));
  };
}

export { HttpError, unauthorized };