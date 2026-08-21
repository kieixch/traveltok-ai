import { Controller, Get, Param, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { VideosService } from "./videos.service";

class ListVideosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;
}

@Controller("videos")
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  list(@Query() query: ListVideosQueryDto) {
    return this.videosService.list(
      query.page,
      query.pageSize,
      query.sort ?? "scrapedAt",
      query.order,
      { projectId: query.projectId, search: query.search },
    );
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.videosService.getById(id);
  }
}
