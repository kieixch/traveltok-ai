import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContentFormat, ContentIdeaStatus } from "@traveltok/database";

export class CreateContentIdeaDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destination?: string;

  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hook?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  concept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetAudience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  estimatedDuration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  opportunityScore?: number;

  @IsOptional()
  @IsString()
  aiReasoning?: string;

  @IsOptional()
  @IsEnum(ContentIdeaStatus)
  status?: ContentIdeaStatus;
}
