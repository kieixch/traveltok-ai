import OpenAI from "openai";
import { CtaType, CaptionGeneratorInput, VideoCaption } from "./types";
import {
  buildCaptionGeneratorUserPrompt,
  CAPTION_GENERATOR_SYSTEM_PROMPT,
  languageInstruction,
} from "./prompts";
import { validateVideoCaption } from "./zod-schemas";
import { hash } from "./content-idea-generator";

export interface CaptionGenerator {
  generate(input: CaptionGeneratorInput): Promise<VideoCaption>;
}

const FORMAT_TAGS: Record<string, string> = {
  VLOG: "vlog",
  POV: "pov",
  LICKTILE: "listicle",
  TUTORIAL: "travelguide",
  REVIEW: "honestreview",
  STORYTELLING: "storytime",
  CINEMATIC: "cinematic",
  TALKING_HEAD: "traveltips",
  VOICE_OVER: "voiceover",
  BEFORE_AFTER: "beforeafter",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

/** Deterministic offline caption generator used when `AI_MODE=mock`. */
export class MockCaptionGenerator implements CaptionGenerator {
  async generate(input: CaptionGeneratorInput): Promise<VideoCaption> {
    const seed = hash(input.randomness);
    const destination = input.destination ?? "Indonesia";
    const hook = input.hook ?? `Trust me, ${destination} is not what you expect.`;
    const cta = (input.cta ?? "SAVE") as CtaType;

    const openers = [
      `Your next trip should start here.`,
      `This one goes straight to your saved folder.`,
      `If you only watch one ${input.format.toLowerCase()} travel video today, make it this one.`,
    ];
    const closers = [
      `Tag the friend who needs to see this.`,
      `Let me know in the comments which spot you'd visit first.`,
      `Share this with your travel group chat.`,
    ];

    const caption = `${openers[seed % openers.length]} ${hook} ${closers[seed % closers.length]}`;

    const hashtags: string[] = [];
    const push = (tag: string) => {
      const clean = slugify(tag);
      if (clean.length > 0 && !hashtags.includes(clean)) {
        hashtags.push(clean);
      }
    };

    push(destination);
    push(FORMAT_TAGS[input.format] ?? "traveltok");
    input.hashtags.slice(0, 4).forEach(push);
    push("traveltok");
    push("indonesia");

    return {
      caption,
      hashtags: hashtags.slice(0, 8),
      cta,
    };
  }
}

/** OpenAI-backed caption generator with structured output + validation. */
export class OpenAICaptionGenerator implements CaptionGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: CaptionGeneratorInput): Promise<VideoCaption> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CAPTION_GENERATOR_SYSTEM_PROMPT + languageInstruction(input.language) },
        {
          role: "user",
          content: buildCaptionGeneratorUserPrompt({
            ideaTitle: input.ideaTitle,
            topic: input.topic,
            destination: input.destination,
            format: input.format,
            hook: input.hook,
            cta: input.cta,
            hashtags: input.hashtags,
            randomness: input.randomness,
          }),
        },
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
      throw new Error(`OpenAI returned invalid JSON: ${(error as Error).message}`);
    }

    const parsed = validateVideoCaption(raw);
    return {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      cta: parsed.cta,
    };
  }
}
