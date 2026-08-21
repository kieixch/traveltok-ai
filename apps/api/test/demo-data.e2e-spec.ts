import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-demo-";

describe("Demo data clone (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let ownProjectId: string;

  const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;

  beforeAll(async () => {
    await deleteTestUsers(EMAIL_PREFIX);
    app = await createTestApp();

    const register = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Demo User", email, password: "Password123" })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };

    const project = await request(app.getHttpServer())
      .post("/projects")
      .set(authHeaders)
      .send({ name: "Dashboard Demo Project" })
      .expect(201);
    ownProjectId = project.body.data.id;
  });

  afterAll(async () => {
    await app.close();
    if (ownProjectId) {
      await prisma.videoHashtag.deleteMany({
        where: { video: { projectId: ownProjectId } },
      });
      await prisma.videoMetric.deleteMany({
        where: { video: { projectId: ownProjectId } },
      });
      await prisma.video.deleteMany({ where: { projectId: ownProjectId } });
      await prisma.scrapingJob.deleteMany({ where: { projectId: ownProjectId } });
    }
    await deleteTestUsers(EMAIL_PREFIX);
  });

  it("clones the seed dataset into a user-owned project", async () => {
    const seed = await prisma.project.findFirstOrThrow({
      where: { isSeedData: true },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post(`/projects/${ownProjectId}/demo-data`)
      .set(authHeaders)
      .expect(201);

    const result = res.body.data;
    expect(result.videos).toBeGreaterThan(0);
    expect(result.metrics).toBeGreaterThan(0);
    expect(result.hashtagLinks).toBeGreaterThan(0);
    expect(result.scrapingJobs).toBeGreaterThan(0);
    expect(result.embeddings).toBeGreaterThan(0);

    const [seedVideos, seedMetrics, seedLinks, cloneVideos] = await Promise.all([
      prisma.video.count({ where: { projectId: seed.id } }),
      prisma.videoMetric.count({ where: { video: { projectId: seed.id } } }),
      prisma.videoHashtag.count({ where: { video: { projectId: seed.id } } }),
      prisma.video.count({ where: { projectId: ownProjectId } }),
    ]);
    expect(cloneVideos).toBe(seedVideos);
    expect(result.videos).toBe(seedVideos);
    expect(result.metrics).toBe(seedMetrics);
    expect(result.hashtagLinks).toBe(seedLinks);
  });

  it("is idempotent — a second call creates nothing new", async () => {
    const seed = await prisma.project.findFirstOrThrow({
      where: { isSeedData: true },
      select: { id: true },
    });
    const seedVideos = await prisma.video.count({ where: { projectId: seed.id } });

    const res = await request(app.getHttpServer())
      .post(`/projects/${ownProjectId}/demo-data`)
      .set(authHeaders)
      .expect(201);

    expect(res.body.data.videos).toBe(0);
    const cloneVideos = await prisma.video.count({ where: { projectId: ownProjectId } });
    expect(cloneVideos).toBe(seedVideos);
  });

  it("rejects demo-data for a project the user does not own", async () => {
    const seed = await prisma.project.findFirstOrThrow({
      where: { isSeedData: true },
      select: { id: true },
    });

    const res = await request(app.getHttpServer())
      .post(`/projects/${seed.id}/demo-data`)
      .set(authHeaders)
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns 401 without a token", async () => {
    await request(app.getHttpServer())
      .post(`/projects/${ownProjectId}/demo-data`)
      .expect(401);
  });
});
