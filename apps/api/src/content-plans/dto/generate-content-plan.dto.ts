import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContentPlanStatus } from "@traveltok/database";

export class GenerateContentPlanDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  postsPerWeek?: number;

  @IsOptional()
  @IsEnum(ContentPlanStatus)
  status?: ContentPlanStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
