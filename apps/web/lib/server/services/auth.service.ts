import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { User } from "@traveltok/database";
import { conflict, notFound, HttpError, unauthorized } from "@/lib/server/http";
import { signToken } from "@/lib/server/auth";
import { getPrisma } from "@/lib/server/prisma";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "@/lib/server/email";

const BCRYPT_ROUNDS = 10;
const VERIFY_TOKEN_HOURS = 24;
const RESET_TOKEN_HOURS = 1;

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

type SafeUser = Omit<
  User,
  "passwordHash" | "emailVerificationToken" | "emailVerificationExpires" | "passwordResetToken" | "passwordResetExpires"
>;

function toSafeUser(user: User): SafeUser {
  const safe: Record<string, unknown> = { ...user };
  delete safe.passwordHash;
  delete safe.emailVerificationToken;
  delete safe.emailVerificationExpires;
  delete safe.passwordResetToken;
  delete safe.passwordResetExpires;
  return safe as SafeUser;
}

function randomToken(): string {
  return randomBytes(32).toString("hex");
}

export class AuthService {
  /**
   * Creates the account but keeps it inactive until the user verifies their
   * email via the link we send them. Returns no session on purpose.
   */
  async register(input: RegisterInput, origin: string) {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw conflict("Email is already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const token = randomToken();
    const expires = new Date(Date.now() + VERIFY_TOKEN_HOURS * 3600_000);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: "USER",
        emailVerified: null,
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    });

    await this.trySendEmail(() =>
      sendVerificationEmail(
        user.email,
        `${origin}/verify-email?token=${encodeURIComponent(token)}`,
        VERIFY_TOKEN_HOURS,
      ),
    );

    return {
      requiresVerification: true,
      message: "Akun dibuat. Cek email kamu untuk memverifikasi alamat email.",
    };
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

    if (!user.emailVerified) {
      throw new HttpError(
        403,
        "Email belum diverifikasi. Cek inbox kamu atau kirim ulang tautan verifikasi.",
        "EMAIL_NOT_VERIFIED",
      );
    }

    return { token: await signToken(user), user: toSafeUser(user) };
  }

  async verifyEmail(token: string) {
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });
    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw unauthorized("Link verifikasi tidak valid atau sudah kedaluwarsa");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return { message: "Email terverifikasi. Kamu bisa masuk sekarang." };
  }

  async resendVerification(email: string, origin: string) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Never reveal whether the account exists.
    if (user && !user.emailVerified) {
      const token = randomToken();
      const expires = new Date(Date.now() + VERIFY_TOKEN_HOURS * 3600_000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: token,
          emailVerificationExpires: expires,
        },
      });
      await this.trySendEmail(() =>
        sendVerificationEmail(
          user.email,
          `${origin}/verify-email?token=${encodeURIComponent(token)}`,
          VERIFY_TOKEN_HOURS,
        ),
      );
    }
    return {
      message: "Jika email terdaftar, tautan verifikasi telah dikirim ulang.",
    };
  }

  async forgotPassword(email: string, origin: string) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    // Never reveal whether the account exists.
    if (user) {
      const token = randomToken();
      const expires = new Date(Date.now() + RESET_TOKEN_HOURS * 3600_000);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        },
      });
      await this.trySendEmail(() =>
        sendPasswordResetEmail(
          user.email,
          `${origin}/reset-password?token=${encodeURIComponent(token)}`,
          RESET_TOKEN_HOURS,
        ),
      );
    }
    return {
      message: "Jika email terdaftar, tautan reset password telah dikirim.",
    };
  }

  async resetPassword(token: string, password: string) {
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
    });
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw unauthorized("Link reset password tidak valid atau sudah kedaluwarsa");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return { message: "Password berhasil diubah. Silakan masuk." };
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await getPrisma().user.findUnique({ where: { id: userId } });
    if (!user) {
      throw notFound("User not found");
    }
    return toSafeUser(user);
  }

  /** Sends via email service; email failures should never block auth flows. */
  private async trySendEmail(send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (err) {
      console.error("[auth] failed to send email:", err);
    }
  }
}

export const authService = new AuthService();

export { randomToken };