import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, map } from "rxjs";

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

/**
 * Wraps every response in the shared ApiResponse envelope:
 * `{ success: true, data }`. Also converts Prisma `BigInt` values to JSON-safe
 * numbers (Prisma returns `BigInt` for e.g. `views`, which JSON cannot serialize).
 *
 * `/health` keeps its own response shape.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, { success: true; data: unknown }>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: true; data: unknown }> {
    const request = context.switchToHttp().getRequest();
    if (request.originalUrl?.startsWith("/health")) {
      return next.handle() as unknown as Observable<{ success: true; data: unknown }>;
    }
    return next.handle().pipe(
      map((data) => ({ success: true, data: normalize(data) })),
    );
  }
}
