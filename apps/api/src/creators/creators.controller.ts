import { Controller, Get, Param, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CreatorsService } from "./creators.service";

class ListCreatorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minFollowers?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minViews?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minEngagement?: number;
}

@Controller("creators")
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  list(@Query() query: ListCreatorsQueryDto) {
    return this.creatorsService.list(
      query.page,
      query.pageSize,
      query.sort ?? "followers",
      query.order,
      {
        search: query.search,
        projectId: query.projectId,
        minFollowers: query.minFollowers,
        minViews: query.minViews,
        minEngagement: query.minEngagement,
      },
    );
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.creatorsService.getById(id);
  }
}
