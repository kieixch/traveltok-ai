import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { ContentFormat } from "@traveltok/database";

export class GenerateContentIdeasDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;

  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
