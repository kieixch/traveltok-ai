import { Type } from "class-transformer";
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ContentFormat, ContentPlanItemStatus } from "@traveltok/database";

export class CreateContentPlanItemDto {
  @IsOptional()
  @IsString()
  contentIdeaId?: string;

  @Type(() => Date)
  @IsDate()
  scheduledDate!: Date;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hook?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  script?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hashtags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cta?: string;

  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @IsOptional()
  @IsEnum(ContentPlanItemStatus)
  status?: ContentPlanItemStatus;
}
