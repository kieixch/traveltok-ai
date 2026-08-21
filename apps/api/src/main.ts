import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { buildCorsOrigins } from "./common/utils/cors-origins";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(process.env.API_PREFIX ?? "");

  // Security headers (X-Content-Type-Options, X-Frame-Options, CSP, ...).
  app.use(helmet());

  app.enableCors({
    origin: buildCorsOrigins(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  console.log(`TravelTok AI API listening on http://localhost:${port}`);
}

void bootstrap();
