import * as bcrypt from "bcryptjs";
import type { User } from "@traveltok/database";
import { conflict, notFound, unauthorized } from "@/lib/server/http";
import { signToken } from "@/lib/server/auth";
import { getPrisma } from "@/lib/server/prisma";

const BCRYPT_ROUNDS = 10;

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: SafeUser;
}

type SafeUser = Omit<User, "passwordHash">;

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw conflict("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "USER",
      },
    });

    return { token: await signToken(user), user: toSafeUser(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) {
      throw unauthorized("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw unauthorized("Invalid email or password");
    }

    return { token: await signToken(user), user: toSafeUser(user) };
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!user) {
      throw notFound("User not found");
    }
    return toSafeUser(user);
  }
}

export const authService = new AuthService();