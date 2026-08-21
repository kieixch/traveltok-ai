import { IsOptional, IsString, MaxLength } from "class-validator";

export class GenerateScriptDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
