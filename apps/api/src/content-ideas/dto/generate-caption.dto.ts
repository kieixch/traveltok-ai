import { IsOptional, IsString, MaxLength } from "class-validator";

export class GenerateCaptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
