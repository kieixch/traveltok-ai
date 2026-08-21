import { Type } from "class-transformer";
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class ProjectScopeQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;
}

export class EngagementQueryDto extends ProjectScopeQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsIn(["day", "week", "month"])
  bucket?: "day" | "week" | "month";
}

export class CreatorsQueryDto extends ProjectScopeQueryDto {
  @IsOptional()
  @IsIn(["followers", "engagement", "views"])
  sort?: "followers" | "engagement" | "views";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class HashtagsQueryDto extends ProjectScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class TrendScoreQueryDto extends ProjectScopeQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  hashtag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  periodDays?: number;
}

export class OpportunitiesQueryDto extends ProjectScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
