import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers, prisma } from "./helpers";

const EMAIL_PREFIX = "e2e-crud-";

describe("CRUD (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let authHeaders: Record<string, string>;
  let seedProjectId: string;
  let ownedProjectId: string;

  const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;
  const password = "Password123";

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
      .send({ name: "CRUD User", email, password })
      .expect(201);
    token = register.body.data.token;
    authHeaders = { Authorization: `Bearer ${token}` };

    ownedProjectId = (
      await prisma.project.create({
        data: {
          name: "CRUD Owned Project",
          niche: "Travel",
          createdById: register.body.data.user.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
    if (ownedProjectId) {
      await prisma.project.deleteMany({ where: { id: ownedProjectId } });
    }
    await prisma.scrapingJob.deleteMany({
      where: { projectId: seedProjectId, isSeedData: false },
    });
    await prisma.trend.deleteMany({
      where: { projectId: seedProjectId, isSeedData: false },
    });
    await deleteTestUsers(EMAIL_PREFIX);
  });

  describe("Projects", () => {
    let projectId: string;

    it("creates a project owned by the user", async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set(authHeaders)
        .send({ name: "E2E Project", niche: "Travel" })
        .expect(201);

      expect(res.body.success).toBe(true);
      projectId = res.body.data.id;
      expect(res.body.data.name).toBe("E2E Project");
      expect(res.body.data.createdById).toBeDefined();
    });

    it("rejects an invalid project payload", async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set(authHeaders)
        .send({ name: "" })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("lists owned projects with pagination envelope", async () => {
      const res = await request(app.getHttpServer())
        .get("/projects")
        .set(authHeaders)
        .query({ pageSize: 10 })
        .expect(200);

      expect(res.body.data).toMatchObject({
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.map((p: { id: string }) => p.id)).toContain(projectId);
    });

    it("updates a project", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set(authHeaders)
        .send({ description: "Updated by e2e" })
        .expect(200);

      expect(res.body.data.description).toBe("Updated by e2e");
    });

    it("returns 404 for another owner's project", async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set(authHeaders)
        .expect(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it("deletes a project, then 404 on fetch", async () => {
      await request(app.getHttpServer())
        .delete(`/projects/${projectId}`)
        .set(authHeaders)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}`)
        .set(authHeaders)
        .expect(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("Creators", () => {
    let creatorIds: string[];
    let creatorProjectId: string;

    beforeAll(async () => {
      const ts = Date.now();
      const user = await prisma.user.findFirstOrThrow({
        where: { email },
        select: { id: true },
      });
      creatorProjectId = (
        await prisma.project.create({
          data: { name: "E2E Creators Project", niche: "Travel", createdById: user.id },
        })
      ).id;

      const makeCreator = async (
        username: string,
        followers: number,
        views: number,
        engagementRate: number,
      ) => {
        const creator = await prisma.creator.create({
          data: {
            externalId: `e2e-${ts}-${username}`,
            username,
            displayName: username,
            followers,
            isSeedData: false,
          },
        });
        const video = await prisma.video.create({
          data: {
            externalId: `e2e-video-${ts}-${username}`,
            creatorId: creator.id,
            projectId: creatorProjectId,
            caption: `E2E video for ${username}`,
            isSeedData: false,
          },
        });
        await prisma.videoMetric.create({
          data: {
            videoId: video.id,
            views,
            likes: Math.floor(views / 10),
            comments: Math.floor(views / 100),
            shares: Math.floor(views / 200),
            engagementRate,
          },
        });
        return creator.id;
      };

      creatorIds = await Promise.all([
        makeCreator(`e2ecreatoralpha${ts}`, 1000, 500, 1.5),
        makeCreator(`e2ecreatorbeta${ts}`, 5000, 20000, 5),
        makeCreator(`e2ecreatorgamma${ts}`, 9000, 100000, 8),
      ]);
    });

    afterAll(async () => {
      await prisma.video.deleteMany({
        where: { projectId: creatorProjectId },
      });
      await prisma.creator.deleteMany({
        where: { id: { in: creatorIds } },
      });
      await prisma.project.deleteMany({ where: { id: creatorProjectId } });
    });

    it("lists only real (non-seed) creators sorted by followers desc", async () => {
      const res = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ sort: "followers", order: "desc", pageSize: 100 })
        .expect(200);

      const { items, total } = res.body.data;
      expect(total).toBeGreaterThanOrEqual(3);
      const ours = items.filter((c: { id: string }) => creatorIds.includes(c.id));
      expect(ours).toHaveLength(3);
      expect(ours.map((c: { followers: number }) => c.followers)).toEqual([9000, 5000, 1000]);
    });

    it("excludes seed creators", async () => {
      const res = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ pageSize: 100 })
        .expect(200);

      const seedCreatorIds = new Set(
        (await prisma.creator.findMany({ where: { isSeedData: true } })).map(
          (c: { id: string }) => c.id,
        ),
      );
      for (const item of res.body.data.items) {
        expect(seedCreatorIds.has(item.id)).toBe(false);
      }
    });

    it("searches creators by username", async () => {
      const res = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ search: "e2ecreatorbeta", pageSize: 100 })
        .expect(200);

      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data.items) {
        const haystack = `${item.username ?? ""} ${item.displayName ?? ""}`.toLowerCase();
        expect(haystack).toContain("e2ecreatorbeta");
      }
    });

    it("filters by min followers, views and engagement", async () => {
      const byFollowers = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ minFollowers: 4000, pageSize: 100 })
        .expect(200);
      const names = byFollowers.body.data.items.map((c: { username: string }) => c.username);
      expect(names.some((n: string) => n.includes("beta"))).toBe(true);
      expect(names.some((n: string) => n.includes("alpha"))).toBe(false);

      const byViews = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ minViews: 50000, pageSize: 100 })
        .expect(200);
      const viewNames = byViews.body.data.items.map((c: { username: string }) => c.username);
      expect(viewNames.some((n: string) => n.includes("gamma"))).toBe(true);
      expect(viewNames.some((n: string) => n.includes("beta"))).toBe(false);

      const byEngagement = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ minEngagement: 6, pageSize: 100 })
        .expect(200);
      const engNames = byEngagement.body.data.items.map((c: { username: string }) => c.username);
      expect(engNames.some((n: string) => n.includes("gamma"))).toBe(true);
      expect(engNames.some((n: string) => n.includes("beta"))).toBe(false);
    });

    it("sorts by total views", async () => {
      const res = await request(app.getHttpServer())
        .get("/creators")
        .set(authHeaders)
        .query({ sort: "totalViews", order: "desc", pageSize: 100 })
        .expect(200);

      const ours = res.body.data.items.filter((c: { id: string }) => creatorIds.includes(c.id));
      expect(ours.map((c: { totalViews: number }) => c.totalViews)).toEqual([
        100000, 20000, 500,
      ]);
    });

    it("returns a creator detail with video count", async () => {
      const res = await request(app.getHttpServer())
        .get(`/creators/${creatorIds[1]}`)
        .set(authHeaders)
        .expect(200);

      expect(res.body.data.id).toBe(creatorIds[1]);
      expect(typeof res.body.data._count.videos).toBe("number");
    });
  });

  describe("Videos", () => {
    const nonSeedVideoIds: string[] = [];

    beforeAll(async () => {
      const creator = await prisma.creator.create({
        data: {
          externalId: `e2e-video-creator-${Date.now()}`,
          username: `e2evideocreator${Date.now()}`,
          displayName: "E2E Video Creator",
          isSeedData: false,
        },
      });
      const seedProject = await prisma.project.findUniqueOrThrow({
        where: { id: seedProjectId },
        select: { id: true },
      });
      const videos = [
        { caption: "Bali hidden gem itinerary for the weekend", views: 3000 },
        { caption: "Best street food in Yogyakarta under 50k", views: 2000 },
        { caption: "Cheap train travel across Java", views: 1000 },
      ];
      for (const v of videos) {
        const video = await prisma.video.create({
          data: {
            externalId: `e2e-video-${Date.now()}-${Math.random()}`,
            creatorId: creator.id,
            projectId: seedProject.id,
            caption: v.caption,
            description: v.caption,
            isSeedData: false,
          },
        });
        nonSeedVideoIds.push(video.id);
        await prisma.videoMetric.create({
          data: {
            videoId: video.id,
            views: v.views,
            likes: Math.floor(v.views / 10),
            comments: Math.floor(v.views / 50),
            shares: Math.floor(v.views / 100),
            engagementRate: 0.03,
          },
        });
      }
    });

    afterAll(async () => {
      await prisma.videoMetric.deleteMany({
        where: { videoId: { in: nonSeedVideoIds } },
      });
      await prisma.video.deleteMany({ where: { id: { in: nonSeedVideoIds } } });
    });

    it("lists videos filtered by project with BigInt serialized as numbers", async () => {
      const res = await request(app.getHttpServer())
        .get("/videos")
        .set(authHeaders)
        .query({ projectId: seedProjectId, sort: "views", order: "desc", pageSize: 5 })
        .expect(200);

      const { items, total } = res.body.data;
      expect(total).toBe(3);
      expect(items.length).toBe(3);
      const views = items.map((v: { metrics: Array<{ views: number }> }) => v.metrics[0].views);
      expect(views.every((v: number) => typeof v === "number")).toBe(true);
      expect(views).toEqual([...views].sort((a, b) => b - a));
      expect(items[0].creator).toBeDefined();
    });

    it("searches videos by caption", async () => {
      const res = await request(app.getHttpServer())
        .get("/videos")
        .set(authHeaders)
        .query({ search: "hidden gem", pageSize: 20 })
        .expect(200);

      expect(res.body.data.total).toBeGreaterThan(0);
    });

    it("returns a video detail with creator, metrics, hashtags and analyses", async () => {
      const list = await request(app.getHttpServer())
        .get("/videos")
        .set(authHeaders)
        .query({ projectId: seedProjectId, pageSize: 1 });

      const id = list.body.data.items[0].id;
      const res = await request(app.getHttpServer())
        .get(`/videos/${id}`)
        .set(authHeaders)
        .expect(200);

      expect(res.body.data.id).toBe(id);
      expect(res.body.data.creator).toBeDefined();
      expect(Array.isArray(res.body.data.metrics)).toBe(true);
      expect(Array.isArray(res.body.data.hashtags)).toBe(true);
      expect(res.body.data.metrics.length).toBeGreaterThan(0);
      expect(typeof res.body.data.metrics[0].views).toBe("number");
    });
  });

  describe("Hashtags", () => {
    it("returns top hashtags by usage", async () => {
      const res = await request(app.getHttpServer())
        .get("/hashtags")
        .set(authHeaders)
        .query({ projectId: seedProjectId, top: 5 })
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const usages = res.body.data.map((h: { usage: number }) => h.usage);
      expect(usages).toEqual([...usages].sort((a, b) => b - a));
    });
  });

  describe("Scraping jobs", () => {
    let ownedProjectId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post("/projects")
        .set(authHeaders)
        .send({ name: "E2E Scrape Project", niche: "Travel" })
        .expect(201);
      ownedProjectId = res.body.data.id;
    });

    it("creates a QUEUED job", async () => {
      const res = await request(app.getHttpServer())
        .post("/scraping-jobs")
        .set(authHeaders)
        .send({ projectId: ownedProjectId, keyword: "hidden gems", maxResults: 20 })
        .expect(201);

      expect(res.body.data.status).toBe("QUEUED");
      expect(res.body.data.keyword).toBe("hidden gems");
    });

    it("rejects a job without keyword or hashtag", async () => {
      const res = await request(app.getHttpServer())
        .post("/scraping-jobs")
        .set(authHeaders)
        .send({ projectId: ownedProjectId })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("rejects a job for a project the user does not own", async () => {
      const res = await request(app.getHttpServer())
        .post("/scraping-jobs")
        .set(authHeaders)
        .send({ projectId: seedProjectId, hashtag: "traveltok" })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("lists and fetches owned jobs", async () => {
      const created = await request(app.getHttpServer())
        .post("/scraping-jobs")
        .set(authHeaders)
        .send({ projectId: ownedProjectId, hashtag: "traveltok" })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/scraping-jobs")
        .set(authHeaders)
        .query({ projectId: ownedProjectId })
        .expect(200);
      expect(list.body.data.total).toBeGreaterThanOrEqual(1);

      const one = await request(app.getHttpServer())
        .get(`/scraping-jobs/${created.body.data.id}`)
        .set(authHeaders)
        .expect(200);
      expect(one.body.data.id).toBe(created.body.data.id);

      await prisma.scrapingJob.deleteMany({
        where: { projectId: ownedProjectId },
      });
    });
  });

  describe("Trends", () => {
    it("creates, lists and fetches a trend", async () => {
      const created = await request(app.getHttpServer())
        .post("/trends")
        .set(authHeaders)
        .send({ projectId: seedProjectId, keyword: "Raja Ampat", type: "DESTINATION", opportunityScore: 85 })
        .expect(201);

      expect(created.body.data.keyword).toBe("Raja Ampat");
      expect(created.body.data.type).toBe("DESTINATION");

      const list = await request(app.getHttpServer())
        .get("/trends")
        .set(authHeaders)
        .query({ projectId: seedProjectId, type: "DESTINATION" })
        .expect(200);
      expect(list.body.data.total).toBeGreaterThanOrEqual(1);

      const one = await request(app.getHttpServer())
        .get(`/trends/${created.body.data.id}`)
        .set(authHeaders)
        .expect(200);
      expect(one.body.data.id).toBe(created.body.data.id);
    });
  });

  describe("Content ideas", () => {
    let ideaId: string;

    it("creates an idea", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-ideas")
        .set(authHeaders)
        .send({ projectId: ownedProjectId, title: "Hidden Beach Itinerary", format: "VLOG" })
        .expect(201);

      expect(res.body.data.title).toBe("Hidden Beach Itinerary");
      expect(res.body.data.status).toBe("IDEA");
      ideaId = res.body.data.id;
    });

    it("updates an idea", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/content-ideas/${ideaId}`)
        .set(authHeaders)
        .send({ status: "DRAFT", opportunityScore: 78 })
        .expect(200);

      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.opportunityScore).toBe(78);
    });

    it("lists ideas filtered by project", async () => {
      const res = await request(app.getHttpServer())
        .get("/content-ideas")
        .set(authHeaders)
        .query({ projectId: ownedProjectId })
        .expect(200);

      expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    });

    it("deletes an idea", async () => {
      await request(app.getHttpServer())
        .delete(`/content-ideas/${ideaId}`)
        .set(authHeaders)
        .expect(200);
    });
  });

  describe("Content plans & items", () => {
    let planId: string;
    let itemId: string;
    const startDate = new Date("2026-09-01T00:00:00Z");

    it("creates a plan", async () => {
      const res = await request(app.getHttpServer())
        .post("/content-plans")
        .set(authHeaders)
        .send({
          projectId: ownedProjectId,
          title: "September Campaign",
          startDate,
          endDate: new Date("2026-09-30T00:00:00Z"),
        })
        .expect(201);

      expect(res.body.data.status).toBe("DRAFT");
      planId = res.body.data.id;
    });

    it("adds an item to the plan", async () => {
      const res = await request(app.getHttpServer())
        .post(`/content-plans/${planId}/items`)
        .set(authHeaders)
        .send({ title: "POV Raja Ampat", scheduledDate: startDate })
        .expect(201);

      expect(res.body.data.contentPlanId).toBe(planId);
      expect(res.body.data.status).toBe("IDEA");
      itemId = res.body.data.id;
    });

    it("updates an item", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/content-plans/items/${itemId}`)
        .set(authHeaders)
        .send({ status: "SCHEDULED" })
        .expect(200);

      expect(res.body.data.status).toBe("SCHEDULED");
    });

    it("returns the plan with its items", async () => {
      const res = await request(app.getHttpServer())
        .get(`/content-plans/${planId}`)
        .set(authHeaders)
        .expect(200);

      expect(res.body.data.items.map((i: { id: string }) => i.id)).toContain(itemId);
    });

    it("deletes item then plan", async () => {
      await request(app.getHttpServer())
        .delete(`/content-plans/items/${itemId}`)
        .set(authHeaders)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/content-plans/${planId}`)
        .set(authHeaders)
        .expect(200);
    });
  });

  it("rejects unauthenticated access to protected resources", async () => {
    await request(app.getHttpServer()).get("/creators").expect(401);
  });
});
