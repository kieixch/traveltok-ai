import { IsIn, IsNotEmpty, IsString } from "class-validator";

const VALID_PROVIDERS = ["gemini"] as const;

export class UpdateAiModelDto {
  @IsIn(VALID_PROVIDERS, {
    message: "provider must be one of: gemini",
  })
  provider!: (typeof VALID_PROVIDERS)[number];

  @IsString()
  @IsNotEmpty()
  model!: string;
}
