import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-analytics-";

describe("Analytics (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let seedProjectId: string;
  let userId: string;

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
      .send({ name: "Analytics User", email, password: "Password123" })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };
    userId = register.body.data.user.id;
  });

  afterAll(async () => {
    await app.close();
    await deleteTestUsers(EMAIL_PREFIX);
  });

  describe("Overview", () => {
    it("aggregates the seed project", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/overview")
        .set(authHeaders)
        .query({ projectId: seedProjectId })
        .expect(200);

      const data = res.body.data;
      expect(res.body.success).toBe(true);
      expect(data.videoCount).toBe(120);
      expect(data.creatorCount).toBe(25);
      expect(data.hashtagCount).toBeGreaterThanOrEqual(1);
      expect(data.totalViews).toBeGreaterThan(0);
      expect(data.totalLikes).toBeGreaterThan(0);
      expect(data.totalComments).toBeGreaterThan(0);
      expect(data.totalShares).toBeGreaterThan(0);
      expect(typeof data.totalSaves).toBe("number");
      expect(data.avgViews).toBeGreaterThan(0);
      expect(typeof data.avgEngagementRate).toBe("number");
      expect(typeof data.videosLast30d).toBe("number");
      expect(data.topVideo.id).toBeDefined();
      expect(data.topVideo.views).toBeGreaterThan(0);
      expect(data.topCreator.username).toBeDefined();
      expect(data.topCreator.videoCount).toBeGreaterThan(0);
    });

    it("returns zeroed stats for an empty project", async () => {
      const project = await prisma.project.create({
        data: { name: "Analytics Empty", createdById: userId },
      });
      try {
        const res = await request(app.getHttpServer())
          .get("/analytics/overview")
          .set(authHeaders)
          .query({ projectId: project.id })
          .expect(200);

        expect(res.body.data).toMatchObject({
          videoCount: 0,
          creatorCount: 0,
          hashtagCount: 0,
          totalViews: 0,
          avgViews: 0,
          avgEngagementRate: 0,
          topVideo: null,
          topCreator: null,
        });
      } finally {
        await prisma.project.delete({ where: { id: project.id } });
      }
    });
  });

  describe("Engagement", () => {
    it("returns a day-bucketed series over publishedAt", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/engagement")
        .set(authHeaders)
        .query({ projectId: seedProjectId, bucket: "day" })
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const row of res.body.data) {
        expect(typeof row.bucket).toBe("string");
        expect(row.count).toBeGreaterThan(0);
        expect(typeof row.views).toBe("number");
        expect(typeof row.likes).toBe("number");
        expect(typeof row.avgEngagementRate).toBe("number");
      }
      const buckets = res.body.data.map((r: { bucket: string }) => r.bucket);
      expect(buckets).toEqual([...buckets].sort());
    });

    it("supports week/month buckets and date filtering", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/engagement")
        .set(authHeaders)
        .query({
          projectId: seedProjectId,
          bucket: "month",
          from: "2020-01-01T00:00:00.000Z",
        })
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("rejects an invalid bucket", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/engagement")
        .set(authHeaders)
        .query({ projectId: seedProjectId, bucket: "year" })
        .expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Top creators", () => {
    it("ranks by followers by default", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/creators")
        .set(authHeaders)
        .query({ projectId: seedProjectId, sort: "followers", limit: 5 })
        .expect(200);

      expect(res.body.data.length).toBe(5);
      const followers = res.body.data.map((c: { followers: number | null }) => c.followers ?? 0);
      expect(followers).toEqual([...followers].sort((a, b) => b - a));
      for (const c of res.body.data) {
        expect(c.videoCount).toBeGreaterThan(0);
        expect(typeof c.totalViews).toBe("number");
        expect(typeof c.avgViews).toBe("number");
      }
    });

    it("ranks by total views", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/creators")
        .set(authHeaders)
        .query({ projectId: seedProjectId, sort: "views", limit: 10 })
        .expect(200);

      const views = res.body.data.map((c: { totalViews: number }) => c.totalViews);
      expect(views).toEqual([...views].sort((a, b) => b - a));
    });
  });

  describe("Hashtag performance", () => {
    it("ranks hashtags by video count", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/hashtags")
        .set(authHeaders)
        .query({ projectId: seedProjectId, limit: 5 })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      const counts = res.body.data.map((h: { videoCount: number }) => h.videoCount);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(typeof res.body.data[0].totalViews).toBe("number");
      expect(typeof res.body.data[0].avgEngagementRate).toBe("number");
    });
  });

  describe("Trend score", () => {
    it("scores a keyword against the scraped dataset", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/trend-score")
        .set(authHeaders)
        .query({ projectId: seedProjectId, keyword: "bali" })
        .expect(200);

      const data = res.body.data;
      expect(data.totalVideos).toBe(120);
      expect(data.matchingVideos).toBeGreaterThan(0);
      expect(data.matchingCreators).toBeGreaterThan(0);
      expect(typeof data.growthRate).toBe("number");
      for (const key of [
        "engagementScore",
        "frequencyScore",
        "recencyScore",
        "contentGapScore",
        "trendScore",
        "opportunityScore",
      ] as const) {
        expect(data[key]).toBeGreaterThanOrEqual(0);
        expect(data[key]).toBeLessThanOrEqual(100);
      }
    });

    it("scores an exact hashtag match", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/trend-score")
        .set(authHeaders)
        .query({ projectId: seedProjectId, hashtag: "traveltok" })
        .expect(200);

      expect(res.body.data.matchingVideos).toBeGreaterThan(0);
    });

    it("requires at least keyword or hashtag", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/trend-score")
        .set(authHeaders)
        .query({ projectId: seedProjectId })
        .expect(400);
      expect(res.body.code).toBe("BAD_REQUEST");
    });

    it("returns zeroed scores for an unknown keyword", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/trend-score")
        .set(authHeaders)
        .query({ projectId: seedProjectId, keyword: "zzz-nonexistent-qqq" })
        .expect(200);

      expect(res.body.data.matchingVideos).toBe(0);
      expect(res.body.data.trendScore).toBe(0);
      expect(res.body.data.opportunityScore).toBe(0);
    });
  });

  describe("Opportunities", () => {
    it("returns ranked opportunities for the seed project", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/opportunities")
        .set(authHeaders)
        .query({ projectId: seedProjectId, limit: 5 })
        .expect(200);

      const data = res.body.data;
      expect(data.length).toBeGreaterThan(0);
      expect(data.length).toBeLessThanOrEqual(5);

      const scores = data.map((o: { opportunityScore: number }) => o.opportunityScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));

      for (const o of data) {
        expect(["DESTINATION", "HASHTAG", "TOPIC", "FORMAT", "HOOK"]).toContain(o.type);
        expect(typeof o.label).toBe("string");
        expect(o.opportunityScore).toBeGreaterThanOrEqual(0);
        expect(o.opportunityScore).toBeLessThanOrEqual(100);
        expect(o.demandScore).toBeGreaterThanOrEqual(0);
        expect(o.demandScore).toBeLessThanOrEqual(1);
        expect(o.engagementScore).toBeGreaterThanOrEqual(0);
        expect(o.engagementScore).toBeLessThanOrEqual(1);
        expect(o.coverage).toBeGreaterThan(0);
        expect(typeof o.reasoning).toBe("string");
        expect(Array.isArray(o.topVideos)).toBe(true);
      }
    });

    it("returns an empty list for an empty project", async () => {
      const project = await prisma.project.create({
        data: { name: "Analytics Opp Empty", createdById: userId },
      });
      try {
        const res = await request(app.getHttpServer())
          .get("/analytics/opportunities")
          .set(authHeaders)
          .query({ projectId: project.id })
          .expect(200);
        expect(res.body.data).toEqual([]);
      } finally {
        await prisma.project.delete({ where: { id: project.id } });
      }
    });

    it("rejects an invalid limit", async () => {
      const res = await request(app.getHttpServer())
        .get("/analytics/opportunities")
        .set(authHeaders)
        .query({ projectId: seedProjectId, limit: 0 })
        .expect(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  it("rejects unauthenticated analytics access", async () => {
    await request(app.getHttpServer())
      .get("/analytics/overview")
      .query({ projectId: seedProjectId })
      .expect(401);
  });
});
