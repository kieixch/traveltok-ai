import type { NextRequest } from "next/server";
import { requireAuth, type AuthUser } from "./auth";
import { ok, toErrorResponse, jsonResponse, HttpError, unauthorized } from "./http";

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
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: Handler<P>,
  options: RouteOptions = {},
) {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response> => {
    try {
      const user = options.public
        ? (null as unknown as AuthUser)
        : await requireAuth(request);

      const params = (await context.params) as Record<string, string>;
      const query = request.nextUrl.searchParams;

      let body: unknown;
      try {
        body = request.body ? await request.json().catch(() => undefined) : undefined;
      } catch {
        body = undefined;
      }

      const data = await handler({ request, user, params, body, query } as RouteContext);
      return jsonResponse(200, ok(data));
    } catch (error) {
      const { status, body } = toErrorResponse(error);
      return jsonResponse(status, body);
    }
  };
}

export { HttpError, unauthorized };