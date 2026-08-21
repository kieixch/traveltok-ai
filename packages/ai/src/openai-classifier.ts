import OpenAI from "openai";
import { buildVideoClassificationUserPrompt, VIDEO_CLASSIFIER_SYSTEM_PROMPT } from "./prompts";
import { VideoClassification, VideoClassificationInput } from "./types";
import { validateVideoClassification } from "./zod-schemas";

/**
 * Structured-output classifier backed by the OpenAI Chat Completions API.
 * Responses are validated with zod before being returned; a malformed reply
 * throws `AIClassificationError` (never writes to the database).
 */
export class OpenAIVideoClassifier {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async classify(input: VideoClassificationInput): Promise<VideoClassification> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VIDEO_CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: buildVideoClassificationUserPrompt(input) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `OpenAI returned invalid JSON: ${(error as Error).message}`,
      );
    }

    return validateVideoClassification(raw);
  }
}
