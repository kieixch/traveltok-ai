import { Test } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "@traveltok/database";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  let realHash: string;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwtMock = { signAsync: jest.fn() };

  const user = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    passwordHash: "",
    role: "USER" as const,
    isSeedData: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    realHash = await bcrypt.hash("Password123", 4);
    user.passwordHash = realHash;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe("register", () => {
    it("hashes the password and returns a token + safe user", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(user);
      jwtMock.signAsync.mockResolvedValue("signed-token");

      const result = await service.register({
        name: "Test User",
        email: "TEST@example.com",
        password: "Password123",
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "test@example.com" }),
        }),
      );
      const created = prismaMock.user.create.mock.calls[0][0].data;
      expect(created.passwordHash).not.toBe("Password123");
      expect(await bcrypt.compare("Password123", created.passwordHash)).toBe(true);
      expect(result.token).toBe("signed-token");
      expect(result.user).toEqual(
        expect.objectContaining({ id: "user-1", email: "test@example.com" }),
      );
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("rejects a duplicate email with ConflictException", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        service.register({
          name: "Test",
          email: "test@example.com",
          password: "Password123",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("returns a token for valid credentials", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);
      jwtMock.signAsync.mockResolvedValue("signed-token");

      const result = await service.login({
        email: "test@example.com",
        password: "Password123",
      });

      expect(result.token).toBe("signed-token");
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("throws UnauthorizedException for a wrong password", async () => {
      prismaMock.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ email: "test@example.com", password: "WrongPass1" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws UnauthorizedException for an unknown email", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "Password123" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
