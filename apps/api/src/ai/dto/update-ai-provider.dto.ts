import { IsIn } from "class-validator";

const VALID_PROVIDERS = ["mock", "openai", "gemini"] as const;

export class UpdateAiProviderDto {
  @IsIn(VALID_PROVIDERS, {
    message: "provider must be one of: mock, openai, gemini",
  })
  provider!: (typeof VALID_PROVIDERS)[number];
}
