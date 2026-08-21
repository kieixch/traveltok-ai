import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-search-";

describe("Semantic search (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let projectId: string;
  let creatorId: string;
  let baliVideoId: string;
  let foodVideoId: string;

  const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;

  beforeAll(async () => {
    await deleteTestUsers(EMAIL_PREFIX);
    app = await createTestApp();

    const register = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Search User", email, password: "Password123" })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };
    const userId = register.body.data.user.id;

    const project = await prisma.project.create({
      data: { name: "Search E2E", createdById: userId },
    });
    projectId = project.id;

    const creator = await prisma.creator.create({
      data: {
        externalId: `search-creator-${Date.now()}`,
        username: `searchcreator${Date.now()}`,
        displayName: "Search Creator",
      },
    });
    creatorId = creator.id;

    const videos = [
      { caption: "Bali hidden gem beaches you must visit this year", location: "Bali" },
      { caption: "Street food tour in Yogyakarta under 50k", location: "Yogyakarta" },
      { caption: "Budget itinerary for a week in Lombok", location: "Lombok" },
    ];
    const createdVideoIds: string[] = [];
    for (const video of videos) {
      const created = await prisma.video.create({
        data: {
          externalId: `search-video-${Date.now()}-${Math.random()}`,
          creatorId: creator.id,
          projectId,
          caption: video.caption,
          description: video.caption,
          location: video.location,
          publishedAt: new Date(),
        },
      });
      createdVideoIds.push(created.id);
      await prisma.videoMetric.create({
        data: {
          videoId: created.id,
          views: 100_000,
          likes: 5_000,
          comments: 200,
          shares: 300,
          engagementRate: 0.05,
        },
      });
    }
    baliVideoId = createdVideoIds[0];
    foodVideoId = createdVideoIds[1];

    await prisma.contentIdea.create({
      data: {
        projectId,
        title: "A Bali travel vlog idea",
        topic: "Hidden Gems",
        destination: "Bali",
        hashtags: ["bali", "hidden"],
      },
    });
    await prisma.contentIdea.create({
      data: {
        projectId,
        title: "Street food eating challenge",
        topic: "Street Food",
        hashtags: ["streetfood", "kuliner"],
      },
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/index-embeddings`)
      .set(authHeaders)
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
    await deleteTestUsers(EMAIL_PREFIX);
    if (creatorId) {
      await prisma.creator.deleteMany({ where: { id: creatorId } });
    }
  });

  it("reports the indexed dataset via meta", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search/meta")
      .set(authHeaders)
      .query({ projectId })
      .expect(200);

    const data = res.body.data;
    expect(data.indexed).toBe(true);
    expect(data.videos).toBe(3);
    expect(data.ideas).toBe(2);
    expect(data.total).toBe(5);
    expect(data.model).toBe("mock-hash-embedding");
  });

  it("finds videos by semantic similarity and returns hydrated entities", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId, q: "bali beach holiday" })
      .expect(200);

    const hits = res.body.data as Array<{
      entityType: string;
      entityId: string;
      score: number;
      entity: { id: string; caption: string | null; views: number };
    }>;
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit.score).toBeGreaterThanOrEqual(0);
      expect(hit.score).toBeLessThanOrEqual(1);
      expect(hit.entity.id).toBeTruthy();
    }
    expect(hits.slice(0, 3).some((hit) => hit.entityId === baliVideoId)).toBe(true);
  });

  it("ranks the food-related video near the top for a food query", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId, q: "eating street food cheap" })
      .expect(200);

    const hits = res.body.data as Array<{ entityId: string }>;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.slice(0, 3).some((hit) => hit.entityId === foodVideoId)).toBe(true);
  });

  it("filters by entity type", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId, q: "bali", entityTypes: "IDEA" })
      .expect(200);

    const hits = res.body.data as Array<{ entityType: string }>;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.entityType === "IDEA")).toBe(true);
  });

  it("returns an empty result list for an empty project", async () => {
    const empty = await prisma.project.create({
      data: { name: "Empty Search", createdById: (await prisma.user.findFirst({
        where: { email },
      }))!.id },
    });
    try {
      const res = await request(app.getHttpServer())
        .get("/semantic-search")
        .set(authHeaders)
        .query({ projectId: empty.id, q: "anything" })
        .expect(200);
      expect(res.body.data).toEqual([]);
    } finally {
      await prisma.project.delete({ where: { id: empty.id } });
    }
  });

  it("rejects a query shorter than 2 characters", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId, q: "b" })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid entity type", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId, q: "bali", entityTypes: "MOVIE" })
      .expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for a project the user does not own", async () => {
    const res = await request(app.getHttpServer())
      .get("/semantic-search")
      .set(authHeaders)
      .query({ projectId: "00000000-0000-0000-0000-000000000000", q: "bali" })
      .expect(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("rejects unauthenticated search and indexing", async () => {
    await request(app.getHttpServer())
      .get("/semantic-search")
      .query({ projectId, q: "bali" })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/index-embeddings`)
      .expect(401);
  });
});
