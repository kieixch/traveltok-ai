import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-gen-";

describe("Content generation (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let seedProjectId: string;
  let ownProjectId: string;

  const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;

  beforeAll(async () => {
    await deleteTestUsers(EMAIL_PREFIX);
    app = await createTestApp();

    const seedProject = await prisma.project.findFirst({
      where: { isSeedData: true },
      select: { id: true },
    });
    if (!seedProject) throw new Error("Seed project not found — run npm run db:seed");
    seedProjectId = seedProject.id;

    const register = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Generation User", email, password: "Password123" })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };

    const project = await request(app.getHttpServer())
      .post("/projects")
      .set(authHeaders)
      .send({ name: "Empty Gen Project" })
      .expect(201);
    ownProjectId = project.body.data.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.contentPlan.deleteMany({
      where: { isSeedData: false, generatedBy: "AI" },
    });
    await prisma.contentIdea.deleteMany({
      where: { isSeedData: false, generatedBy: "AI" },
    });
    await deleteTestUsers(EMAIL_PREFIX);
  });

  describe("AI content idea generation", () => {
    let ideaIds: string[] = [];

    it("generates 5 ideas by default and persists them", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-ideas/generate")
        .set(authHeaders)
        .send({ projectId: seedProjectId })
        .expect(201);

      expect(res.body.data.generatedBy).toBe("AI");
      expect(res.body.data.model).toBe("mock-idea-generator");
      const ideas = res.body.data.ideas;
      expect(Array.isArray(ideas)).toBe(true);
      expect(ideas.length).toBe(5);
      ideaIds = ideas.map((idea: { id: string }) => idea.id);
      for (const idea of ideas) {
        expect(idea.generatedBy).toBe("AI");
        expect(idea.title.length).toBeGreaterThan(0);
        expect(idea.opportunityScore).toBeGreaterThanOrEqual(0);
        expect(idea.opportunityScore).toBeLessThanOrEqual(100);
        expect(Array.isArray(idea.hashtags)).toBe(true);
      }
    });

    it("honors an explicit count and format", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-ideas/generate")
        .set(authHeaders)
        .send({ projectId: seedProjectId, count: 2, format: "TUTORIAL" })
        .expect(201);

      const ideas = res.body.data.ideas;
      expect(ideas.length).toBe(2);
      for (const idea of ideas) {
        expect(idea.format).toBe("TUTORIAL");
      }
    });

    it("returns 404 for an unknown project", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-ideas/generate")
        .set(authHeaders)
        .send({ projectId: "00000000-0000-0000-0000-000000000000" })
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("generates a script for a generated idea", async () => {
      const res = await request(app.getHttpServer())
        .post(`/content-ideas/${ideaIds[0]}/generate-script`)
        .set(authHeaders)
        .expect(201);

      const idea = res.body.data;
      expect(idea.script.length).toBeGreaterThan(0);
      expect(idea.script).toContain("HOOK:");
      expect(Array.isArray(idea.scriptOutline)).toBe(true);
      expect(idea.scriptOutline.length).toBeGreaterThan(0);
      expect(idea.aiModel).toBe("mock-script-generator");
    });

    it("generates a caption for a generated idea", async () => {
      const res = await request(app.getHttpServer())
        .post(`/content-ideas/${ideaIds[0]}/generate-caption`)
        .set(authHeaders)
        .expect(201);

      const idea = res.body.data;
      expect(idea.caption.length).toBeGreaterThan(0);
      expect(Array.isArray(idea.hashtags)).toBe(true);
      expect(idea.hashtags.length).toBeGreaterThan(0);
      expect(idea.aiModel).toBe("mock-caption-generator");
    });

    it("returns 404 for a missing idea on script/caption generation", async () => {
      for (const path of ["generate-script", "generate-caption"]) {
        const res = await request(app.getHttpServer())
          .post(`/content-ideas/00000000-0000-0000-0000-000000000000/${path}`)
          .set(authHeaders)
          .expect(404);
        expect(res.body.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("AI content plan generation", () => {
    it("schedules a plan with items for a project that has ideas", async () => {
      const startDate = "2026-08-17T00:00:00.000Z";
      const endDate = "2026-08-30T00:00:00.000Z";

      const res = await request(app.getHttpServer())
        .post("/content-plans/generate")
        .set(authHeaders)
        .send({ projectId: seedProjectId, startDate, endDate, postsPerWeek: 3 })
        .expect(201);

      const plan = res.body.data;
      expect(plan.generatedBy).toBe("AI");
      expect(plan.aiModel).toBe("mock-content-planner");
      expect(plan.items.length).toBeGreaterThan(0);
      expect(plan.items.length).toBeLessThanOrEqual(30);

      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      for (const item of plan.items) {
        expect(item.generatedBy).toBe("AI");
        expect(item.status).toBe("SCHEDULED");
        const scheduled = new Date(item.scheduledDate).getTime();
        expect(scheduled).toBeGreaterThanOrEqual(start);
        expect(scheduled).toBeLessThanOrEqual(end);
        expect(item.contentIdeaId).toBeTruthy();
      }
    });

    it("rejects a plan when the date range is inverted", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-plans/generate")
        .set(authHeaders)
        .send({
          projectId: seedProjectId,
          startDate: "2026-08-30T00:00:00.000Z",
          endDate: "2026-08-17T00:00:00.000Z",
        })
        .expect(400);
      expect(res.body.code).toBe("BAD_REQUEST");
    });

    it("rejects a plan when the project has no ideas", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-plans/generate")
        .set(authHeaders)
        .send({
          projectId: ownProjectId,
          startDate: "2026-08-17T00:00:00.000Z",
          endDate: "2026-08-30T00:00:00.000Z",
        })
        .expect(400);
      expect(res.body.code).toBe("BAD_REQUEST");
    });

    it("returns 404 for an unknown project", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-plans/generate")
        .set(authHeaders)
        .send({
          projectId: "00000000-0000-0000-0000-000000000000",
          startDate: "2026-08-17T00:00:00.000Z",
          endDate: "2026-08-30T00:00:00.000Z",
        })
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  it("rejects unauthenticated generation", async () => {
    await request(app.getHttpServer())
      .post("/content-ideas/generate")
      .send({ projectId: seedProjectId })
      .expect(401);
  });
});
