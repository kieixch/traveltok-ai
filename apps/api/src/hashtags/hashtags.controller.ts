import { Controller, Get, Param, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { HashtagsService } from "./hashtags.service";

class TopHashtagsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  top?: number;
}

@Controller("hashtags")
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get()
  top(@Query() query: TopHashtagsQueryDto) {
    return this.hashtagsService.top(query.projectId, query.top ?? 20);
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.hashtagsService.getById(id);
  }
}
