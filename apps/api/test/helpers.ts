import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "@traveltok/database";
import { AppModule } from "../src/app.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  return app;
}

export const prisma = new PrismaService();

export async function deleteTestUsers(emailPrefix: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
}
