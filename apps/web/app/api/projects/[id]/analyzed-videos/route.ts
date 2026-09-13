import { route } from "@/lib/server/route";
import { getPrisma } from "@/lib/server/prisma";
import { requireOwnedProject } from "@/lib/server/authz";

export const GET = route(async ({ user, params }) => {
  const projectId = await requireOwnedProject(user.userId, params.id);
  const rows = await getPrisma().video.findMany({
    where: {
      projectId,
      isSeedData: false,
      analyses: { some: {} },
    },
    select: {
      id: true,
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          topic: true,
          destination: true,
          contentFormat: true,
          hookType: true,
          aiScore: true,
        },
      },
    },
  });
  return {
    analyzed: rows.map((row) => ({ videoId: row.id, ...(row.analyses[0] ?? {}) })),
  };
});