import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { DatabaseModule } from "@traveltok/database";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";

/** Parses JWT_EXPIRES_IN like "7d", "12h", "30m" into seconds (default 7d). */
function expiresInSeconds(value: string | undefined): number {
  const match = /^(\d+)([smhdw])$/.exec(value ?? "");
  if (!match) return 7 * 24 * 60 * 60;
  const factor: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return Number(match[1]) * factor[match[2]];
}

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET is not set in the environment");
        }
        const isProduction = config.get<string>("NODE_ENV") === "production";
        if (secret.length < 32) {
          const message =
            "JWT_SECRET is weak (less than 32 characters) — generate a random " +
            "secret, e.g. `node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"`";
          if (isProduction) {
            throw new Error(message);
          }
          console.warn(`[auth] WARNING: ${message}`);
        }
        return {
          secret,
          signOptions: {
            expiresIn: expiresInSeconds(config.get<string>("JWT_EXPIRES_IN")),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
