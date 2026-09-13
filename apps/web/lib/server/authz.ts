import { Prisma } from "@traveltok/database";
import { getPrisma } from "@/lib/server/prisma";
import { notFound } from "@/lib/server/http";

/**
 * Verifies that a project exists and belongs to `userId`. Throws a 404
 * otherwise. Returns the project id.
 */
export async function requireOwnedProject(
  userId: string,
  projectId: string,
): Promise<string> {
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, createdById: userId },
    select: { id: true },
  });
  if (!project) {
    throw notFound("Project not found");
  }
  return project.id;
}

/**
 * Prisma `where` fragment scoping records to projects owned by `userId`.
 * Use when the caller did not provide a specific projectId.
 */
export function ownedProjectWhere(userId: string) {
  return { project: { createdById: userId } };
}

/**
 * Raw-SQL predicate limiting an aliased video table `v` to the caller's own
 * projects. Safe: `column` is an internal constant, `userId` is bound.
 */
export function ownedVideosSql(
  column: string,
  userId: string,
): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(`v.${column}`)} IN (SELECT p."id" FROM "Project" p WHERE p."createdById" = ${userId})`;
}

/** Raw-SQL predicate for an arbitrary qualified column scoped to owned projects. */
export function ownedProjectsSql(
  qualifier: string,
  column: string,
  userId: string,
): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(`${qualifier}.${column}`)} IN (SELECT p."id" FROM "Project" p WHERE p."createdById" = ${userId})`;
}