import { SetMetadata } from "@nestjs/common";
import { Role } from "@traveltok/database";

export const ROLES_KEY = "roles";

/** Restricts a route to one or more roles (enforced by RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
