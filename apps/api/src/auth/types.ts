import { Role } from "@traveltok/database";

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
