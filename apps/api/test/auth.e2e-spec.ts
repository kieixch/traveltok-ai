import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, deleteTestUsers } from "./helpers";

const EMAIL_PREFIX = "e2e-auth-";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  const email = `${EMAIL_PREFIX}${Date.now()}@test.local`;
  const password = "Password123";

  beforeAll(async () => {
    await deleteTestUsers(EMAIL_PREFIX);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await deleteTestUsers(EMAIL_PREFIX);
  });

  it("GET /health is public and keeps its own shape", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.status).toBeDefined();
    expect(res.body).not.toHaveProperty("success");
  });

  it("rejects a weak password with VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Test", email, password: "short" })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("registers a user and returns token + safe user", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Test User", email, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user).toMatchObject({ email, role: "USER" });
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email with CONFLICT", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ name: "Test User", email, password })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "WrongPass1" })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it("logs in and returns a token", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
  });

  it("GET /auth/me requires a token (401 without)", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("GET /auth/me returns the current user with a valid token", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password });

    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .expect(200);

    expect(res.body.data.email).toBe(email);
    expect(res.body.data).not.toHaveProperty("passwordHash");
  });
});
