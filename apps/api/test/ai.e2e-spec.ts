import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-ai-";

describe("AI engine (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let seedProjectId: string;
  let videoId: string;

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

    const video = await prisma.video.findFirst({
      where: { projectId: seedProjectId },
      select: { id: true },
    });
    if (!video) throw new Error("Seed video not found");
    videoId = video.id;

    const register = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "AI User", email, password: "Password123" })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };
  });

  afterAll(async () => {
    await app.close();
    await prisma.contentAnalysis.deleteMany({ where: { isSeedData: false } });
    await deleteTestUsers(EMAIL_PREFIX);
  });

  describe("Video classification", () => {
    it("classifies a video and stores a ContentAnalysis row", async () => {
      const res = await request(app.getHttpServer())
        .post(`/videos/${videoId}/analyze`)
        .set(authHeaders)
        .expect(201);

      const data = res.body.data;
      expect(data.videoId).toBe(videoId);
      expect(typeof data.topic).toBe("string");
      expect(data.analysisVersion).toBe("1");
      expect(data.model).toBe("mock-classifier");
      expect(data.rawJson).toBeDefined();
      expect(typeof data.aiScore).toBe("number");
    });

    it("appends a new analysis on repeat calls", async () => {
      await request(app.getHttpServer())
        .post(`/videos/${videoId}/analyze`)
        .set(authHeaders)
        .expect(201);

      const list = await request(app.getHttpServer())
        .get(`/videos/${videoId}/analyses`)
        .set(authHeaders)
        .query({ pageSize: 10 })
        .expect(200);

      expect(list.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it("lists analyses with the pagination envelope", async () => {
      const res = await request(app.getHttpServer())
        .get(`/videos/${videoId}/analyses`)
        .set(authHeaders)
        .query({ pageSize: 1 })
        .expect(200);

      expect(res.body.data).toMatchObject({ page: 1, pageSize: 1 });
      expect(res.body.data.items.length).toBe(1);
    });

    it("returns 404 for an unknown video", async () => {
      const res = await request(app.getHttpServer())
        .post(`/videos/00000000-0000-0000-0000-000000000000/analyze`)
        .set(authHeaders)
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("Project insights", () => {
    it("generates a structured strategy review for the seed project", async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${seedProjectId}/insights`)
        .set(authHeaders)
        .expect(200);

      const data = res.body.data;
      expect(typeof data.summary).toBe("string");
      expect(Array.isArray(data.strengths)).toBe(true);
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(typeof data.predictedBestFormat).toBe("string");
      expect(typeof data.predictedBestHook).toBe("string");
      expect(data.opportunity).toBeGreaterThanOrEqual(0);
      expect(data.opportunity).toBeLessThanOrEqual(100);
    });

    it("returns 404 for an unknown project", async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/00000000-0000-0000-0000-000000000000/insights`)
        .set(authHeaders)
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  it("rejects unauthenticated AI access", async () => {
    await request(app.getHttpServer())
      .post(`/videos/${videoId}/analyze`)
      .expect(401);
  });
});
