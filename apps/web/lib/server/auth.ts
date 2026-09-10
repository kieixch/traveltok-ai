import { jwtVerify, SignJWT } from "jose";
import type { Role, User } from "@traveltok/database";
import { unauthorized } from "./http";

export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

function jwtConfig(): { secret: Uint8Array; expiresInSeconds: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set in the environment");
  }
  return {
    secret: new TextEncoder().encode(secret),
    expiresInSeconds: expiresInSeconds(process.env.JWT_EXPIRES_IN),
  };
}

/** Parses JWT_EXPIRES_IN like "7d", "12h", "30m" into seconds (default 7d). */
function expiresInSeconds(value: string | undefined): number {
  const match = /^(\d+)([smhdw])$/.exec(value ?? "");
  if (!match) return 7 * 24 * 60 * 60;
  const factor: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return Number(match[1]) * factor[match[2]];
}

export async function signToken(user: Pick<User, "id" | "email" | "role">): Promise<string> {
  const { secret, expiresInSeconds: exp } = jwtConfig();
  const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + exp)
    .sign(secret);
}

/** Verifies a Bearer token from an Authorization header. */
export async function requireAuth(request: Request): Promise<AuthUser> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) {
    throw unauthorized("Authentication required");
  }

  const { secret } = jwtConfig();
  try {
    const { payload } = await jwtVerify(token, secret);
    const user: AuthUser = {
      userId: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
    };
    if (!user.userId || !user.email || !user.role) {
      throw new Error("missing claims");
    }
    return user;
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}