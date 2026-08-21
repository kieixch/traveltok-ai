import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { AuthUser } from "../auth/types";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ScrapeProjectDto } from "./dto/scrape-project.dto";
import { IsOptional, IsString } from "class-validator";

class ListProjectsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProjectsQueryDto) {
    return this.projectsService.list(
      user.userId,
      query.page,
      query.pageSize,
      query.search,
    );
  }

  @Get(":id")
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projectsService.getById(user.userId, id);
  }

  @Post(":id/demo-data")
  addDemoData(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projectsService.addDemoData(user.userId, id);
  }

  @Post(":id/scrape")
  scrape(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ScrapeProjectDto,
  ) {
    return this.projectsService.scrape(user.userId, id, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projectsService.remove(user.userId, id);
  }
}
