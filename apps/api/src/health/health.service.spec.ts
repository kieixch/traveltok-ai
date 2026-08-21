import { Test } from "@nestjs/testing";
import { PrismaService } from "@traveltok/database";
import { RedisService } from "../redis/redis.service";
import { HealthService } from "./health.service";

jest.mock("@traveltok/database", () => ({
  PrismaService: class MockPrismaService {},
}));

describe("HealthService", () => {
  let service: HealthService;
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };

  const realRedisUrl = process.env.REDIS_URL;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (realRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = realRedisUrl;
    }
  });

  it("reports ok when database and redis are up", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redis.ping.mockResolvedValue("PONG");
    process.env.REDIS_URL = "redis://localhost:6379";

    const result = await service.check();

    expect(result.status).toBe("ok");
    expect(result.checks.database.status).toBe("up");
    expect(result.checks.redis.status).toBe("up");
    expect(result.checks.database.latencyMs).toEqual(expect.any(Number));
    expect(result.timestamp).toEqual(expect.any(String));
    expect(result.environment).toEqual(expect.any(String));
  });

  it("reports degraded when the database is down", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
    redis.ping.mockResolvedValue("PONG");
    process.env.REDIS_URL = "redis://localhost:6379";

    const result = await service.check();

    expect(result.status).toBe("degraded");
    expect(result.checks.database.status).toBe("down");
    expect(result.checks.database.message).toContain("connection refused");
    expect(result.checks.redis.status).toBe("up");
  });

  it("reports degraded when redis is not configured", async () => {
    prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    delete process.env.REDIS_URL;

    const result = await service.check();

    expect(result.status).toBe("degraded");
    expect(result.checks.database.status).toBe("up");
    expect(result.checks.redis.status).toBe("not_configured");
  });
});
