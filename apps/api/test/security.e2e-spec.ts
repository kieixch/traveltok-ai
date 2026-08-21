import type { INestApplication, ValidationPipeOptions } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import helmet from "helmet";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { buildCorsOrigins } from "../src/common/utils/cors-origins";
import { deleteTestUsers } from "./helpers";

// This worker process opts back into rate limiting and a restricted CORS
// policy. Other e2e workers keep RATE_LIMIT_DISABLED=true from setup-e2e.ts.
process.env.RATE_LIMIT_DISABLED = "false";
process.env.CORS_ORIGINS = "http://localhost:3000";

const EMAIL_PREFIX = "e2e-security-";

describe("Security hardening (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    await deleteTestUsers(EMAIL_PREFIX);
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Replicate the bootstrap() wiring from src/main.ts (must be added
    // BEFORE init so the middleware participates in the request pipeline).
    app.use(helmet());
    app.enableCors({ origin: buildCorsOrigins(), credentials: true });
    const pipeOptions: ValidationPipeOptions = {
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    };
    app.useGlobalPipes(new ValidationPipe(pipeOptions));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await deleteTestUsers(EMAIL_PREFIX);
  });

  it("serves helmet security headers", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["x-download-options"]).toBe("noopen");
    expect(res.headers["content-security-policy"]).toBeTruthy();
    expect(res.headers["referrer-policy"]).toBeTruthy();
  });

  it("reflects an allow-listed CORS origin on preflight", async () => {
    const res = await request(app.getHttpServer())
      .options("/health")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .expect(204);

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rejects a CORS origin that is not allow-listed", async () => {
    const res = await request(app.getHttpServer())
      .options("/health")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "GET");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never exposes the password hash on authenticated responses", async () => {
    const register = await request(app.getHttpServer())
      .post("/auth/register")
      .send({
        name: "Sec Hash",
        email: `${EMAIL_PREFIX}${Date.now()}@test.local`,
        password: "Password123",
      })
      .expect(201);

    expect(register.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(register.body.data)).not.toContain("$2");
  });

  it("leaves non-auth endpoints on the generous global limit", async () => {
    for (let i = 0; i < 15; i += 1) {
      await request(app.getHttpServer()).get("/health").expect(200);
    }
  });

  it("rate-limits auth endpoints (429 after the auth limit)", async () => {
    const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;
    await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Sec User", email, password: "Password123" })
      .expect(201);

    let saw429 = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, password: "wrong-password" });
      if (res.status === 429) {
        saw429 = true;
        expect(res.body.success).toBe(false);
        break;
      }
      expect(res.status).toBe(401);
    }
    expect(saw429).toBe(true);
  });
});
