import "dotenv/config";
import { defineConfig } from "prisma/config";

// Real migrations require DATABASE_URL. `prisma generate` (root postinstall)
// does not connect, so fall back to a placeholder to keep `npm install` green
// on CI/Vercel where no .env exists yet.
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://traveltok:traveltok@localhost:5432/traveltok_ai?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
