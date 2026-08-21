import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ScrapingJobStatus } from "@traveltok/database";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types";
import { ScrapingJobsService } from "./scraping-jobs.service";
import { CreateScrapingJobDto } from "./dto/create-scraping-job.dto";

class ListJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(ScrapingJobStatus)
  status?: ScrapingJobStatus;
}

@Controller("scraping-jobs")
export class ScrapingJobsController {
  constructor(private readonly scrapingJobsService: ScrapingJobsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScrapingJobDto) {
    return this.scrapingJobsService.create(dto, user.userId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListJobsQueryDto) {
    return this.scrapingJobsService.list(
      query.page,
      query.pageSize,
      {
        projectId: query.projectId,
        status: query.status,
      },
      user.userId,
    );
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.scrapingJobsService.getById(id, user.userId);
  }
}
