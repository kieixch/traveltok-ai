import { Type } from "class-transformer";
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { TrendType } from "@traveltok/database";

export class CreateTrendDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  keyword!: string;

  @IsOptional()
  @IsEnum(TrendType)
  type?: TrendType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  trendScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  growthRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  engagementScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  frequencyScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  recencyScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  opportunityScore?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodStart?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodEnd?: Date;
}
