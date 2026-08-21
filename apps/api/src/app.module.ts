import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { join } from "node:path";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { CreatorsModule } from "./creators/creators.module";
import { VideosModule } from "./videos/videos.module";
import { HashtagsModule } from "./hashtags/hashtags.module";
import { ScrapingJobsModule } from "./scraping-jobs/scraping-jobs.module";
import { ScrapingModule } from "./scraping/scraping.module";
import { TrendsModule } from "./trends/trends.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AiModule } from "./ai/ai.module";
import { SearchModule } from "./search/search.module";
import { ContentIdeasModule } from "./content-ideas/content-ideas.module";
import { ContentPlansModule } from "./content-plans/content-plans.module";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        // Root .env (canonical location in this monorepo).
        join(process.cwd(), "../../.env"),
        // Fallback: app-local .env.
        join(process.cwd(), ".env"),
      ],
    }),
    // Generous global rate limit; auth routes apply a stricter limit via
    // @Throttle. Setting RATE_LIMIT_DISABLED=true (used by the test suite)
    // registers no throttlers, so the guard lets every request through.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (config.get<string>("RATE_LIMIT_DISABLED") === "true") return [];
        return [
          {
            ttl: Number(config.get<string>("RATE_LIMIT_TTL_SECONDS") ?? 60) * 1000,
            limit: Number(config.get<string>("RATE_LIMIT_GLOBAL_LIMIT") ?? 300),
          },
        ];
      },
    }),
    HealthModule,
    AuthModule,
    ProjectsModule,
    CreatorsModule,
    VideosModule,
    HashtagsModule,
    ScrapingJobsModule,
    ScrapingModule,
    TrendsModule,
    AnalyticsModule,
    AiModule,
    SearchModule,
    ContentIdeasModule,
    ContentPlansModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
