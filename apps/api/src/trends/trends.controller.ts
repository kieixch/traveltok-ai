import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";
import { TrendType } from "@traveltok/database";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { TrendsService } from "./trends.service";
import { CreateTrendDto } from "./dto/create-trend.dto";

class ListTrendsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(TrendType)
  type?: TrendType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;
}

@Controller("trends")
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Post()
  create(@Body() dto: CreateTrendDto) {
    return this.trendsService.create(dto);
  }

  @Get()
  list(@Query() query: ListTrendsQueryDto) {
    return this.trendsService.list(query.page, query.pageSize, {
      projectId: query.projectId,
      type: query.type,
      from: query.from,
    });
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.trendsService.getById(id);
  }
}
