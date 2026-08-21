import OpenAI from "openai";
import { z } from "zod";
import {
  CONTENT_FORMATS,
  ContentFormat,
  ContentIdeaDraft,
  ContentIdeaGeneratorInput,
  CtaType,
  HookType,
} from "./types";
import {
  buildContentIdeaGeneratorUserPrompt,
  CONTENT_IDEA_GENERATOR_SYSTEM_PROMPT,
  languageInstruction,
} from "./prompts";
import { validateContentIdeaGeneration } from "./zod-schemas";

export interface ContentIdeaGenerator {
  generate(input: ContentIdeaGeneratorInput): Promise<ContentIdeaDraft[]>;
}

export function hash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface Template {
  format: ContentFormat;
  hookType: HookType;
  title: (dest: string, hashtag: string) => string;
  hook: (dest: string, hashtag: string) => string;
  concept: (dest: string, hashtag: string) => string;
}

const TEMPLATES: Template[] = [
  {
    format: "LISTICLE",
    hookType: "LIST",
    title: (dest) => `5 ${cap(dest)} Spots That Feel Like a Dream`,
    hook: (dest) => `Number 3 is criminally underrated in ${dest} — save this list.`,
    concept: (dest) =>
      `A rapid-fire top-5 of underrated spots in ${dest} with quick b-roll cuts between each item.`,
  },
  {
    format: "TUTORIAL",
    hookType: "PROBLEM",
    title: (dest) => `How to Plan a 5-Day Trip to ${cap(dest)} on a Budget`,
    hook: (dest) => `Most people overspend their first day in ${dest} — here's how to avoid it.`,
    concept: (dest) =>
      `A step-by-step breakdown of a realistic ${dest} itinerary with transport, stay, and food budgets.`,
  },
  {
    format: "POV",
    hookType: "CURIOSITY",
    title: (dest) => `POV: You Wake Up in ${cap(dest)} at Sunrise`,
    hook: (dest) => `Imagine waking up to this view every morning in ${dest}.`,
    concept: (dest) =>
      `First-person cinematic POV taking the viewer from sunrise to first coffee in ${dest}.`,
  },
  {
    format: "REVIEW",
    hookType: "SHOCK",
    title: (dest) => `Is ${cap(dest)} Still Worth It in 2026? Honest Review`,
    hook: (dest) => `I spent a week in ${dest} and I almost didn't publish this.`,
    concept: (dest) =>
      `Balanced review of ${dest}: crowd levels, value for money, and what's secretly still amazing.`,
  },
  {
    format: "VLOG",
    hookType: "STORY",
    title: (dest) => `A Day in ${cap(dest)}: The Good, the Messy, and the Magic`,
    hook: (dest) => `This is the most honest 24 hours I spent in ${dest}.`,
    concept: (dest) =>
      `Real-time vlog covering the highs and lows of one full day in ${dest}.`,
  },
  {
    format: "STORYTELLING",
    hookType: "STORY",
    title: (dest) => `The Story Behind My Favorite Place in ${cap(dest)}`,
    hook: (dest) => `I almost skipped ${dest} — then this happened.`,
    concept: (dest) =>
      `A personal narrative about the memory that made ${dest} unforgettable, told over soft footage.`,
  },
  {
    format: "CINEMATIC",
    hookType: "DIRECT_STATEMENT",
    title: (dest) => `One Minute in ${cap(dest)} — No Talking, Just Vibes`,
    hook: (dest) => `Turn your sound on for ${dest}.`,
    concept: (dest) =>
      `Music-driven aerial and slow-motion montage selling the mood of ${dest} without narration.`,
  },
  {
    format: "TALKING_HEAD",
    hookType: "PROMISE",
    title: (dest) => `3 Things I Wish I Knew Before Visiting ${cap(dest)}`,
    hook: (dest) => `By the end of this video, you'll never make my ${dest} mistakes.`,
    concept: (dest) =>
      `Direct-to-camera advice segment covering practical lessons from a ${dest} trip.`,
  },
  {
    format: "BEFORE_AFTER",
    hookType: "CONTRAST",
    title: (dest) => `My ${cap(dest)} Trip: Before vs After I Found This Spot`,
    hook: (dest) => `One hour in ${dest} changed my whole trip.`,
    concept: (dest) =>
      `Split-screen transformation showing how discovering one spot upgraded the entire ${dest} experience.`,
  },
  {
    format: "VOICE_OVER",
    hookType: "CURIOSITY",
    title: (dest) => `Why Everyone Is Sleeping on ${cap(dest)} Right Now`,
    hook: (dest) => `This is the year ${dest} finally gets its moment.`,
    concept: (dest) =>
      `Narrated explainer on why ${dest} is trending now, backed by current stats and footage.`,
  },
  {
    format: "TUTORIAL",
    hookType: "LIST",
    title: (dest) => `The Ultimate ${cap(dest)} Packing Guide (5 Days)`,
    hook: (dest) => `Pack for ${dest} with these 5 essentials and nothing else.`,
    concept: (dest) =>
      `Visual packing checklist tailored to ${dest}'s weather and activities.`,
  },
  {
    format: "VLOG",
    hookType: "PROMISE",
    title: (dest) => `7 Days Solo in ${cap(dest)} — Everything You Need to Know`,
    hook: (dest) => `You can do ${dest} solo — here's the full week, unfiltered.`,
    concept: (dest) =>
      `Day-by-day solo travel vlog covering costs, safety, and highlights in ${dest}.`,
  },
];

function cap(value: string): string {
  return value
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

const CTAS: CtaType[] = ["FOLLOW", "SAVE", "COMMENT", "SHARE", "BOOK"];
const AUDIENCES = [
  "First-time visitors",
  "Budget travelers",
  "Solo travelers",
  "Food lovers",
  "Photographers",
  "Weekend explorers",
];

/** Deterministic offline idea generator used when `AI_MODE=mock`. */
export class MockContentIdeaGenerator implements ContentIdeaGenerator {
  async generate(input: ContentIdeaGeneratorInput): Promise<ContentIdeaDraft[]> {
    const count = Math.min(Math.max(1, input.count), 10);
    const destinations = input.topDestinations.length > 0
      ? input.topDestinations
      : ["indonesia", "bali", "yogyakarta", "labuan bajo", "nusa penida"];
    const hashtags = input.topHashtags.length > 0
      ? input.topHashtags
      : ["travelindonesia", "traveltok", "backpacker", "hiddenplaces"];
    const formats = input.formatMix.length > 0
      ? input.formatMix
      : ([...CONTENT_FORMATS] as ContentFormat[]);

    const formatSet = new Set(formats);
    const matchingTemplates = TEMPLATES.filter((template) =>
      formatSet.has(template.format),
    );
    const templatePool =
      matchingTemplates.length > 0 ? matchingTemplates : TEMPLATES;

    const seed = hash(input.randomness);
    const ideas: ContentIdeaDraft[] = [];

    for (let i = 0; i < count; i += 1) {
      const template = templatePool[(seed + i) % templatePool.length];
      const dest = destinations[(seed + i) % destinations.length];
      const hashtag = hashtags[(seed + i) % hashtags.length];
      const audience = AUDIENCES[(seed + i) % AUDIENCES.length];
      const cta = CTAS[(seed + i) % CTAS.length];
      const opportunityScore = Math.min(
        95,
        Math.max(45, 90 - i * 7 + ((seed + i) % 11)),
      );

      ideas.push({
        title: template.title(dest, hashtag),
        topic: `${cap(dest)} travel`,
        destination: cap(dest),
        format: template.format,
        hook: template.hook(dest, hashtag),
        hookType: template.hookType,
        concept: template.concept(dest, hashtag),
        targetAudience: audience,
        cta,
        estimatedDuration: [30, 45, 60][(seed + i) % 3],
        opportunityScore,
        aiReasoning: `High fit with trending topic "${hashtag}" and format strength in ${template.format.toLowerCase()}; opportunity ${opportunityScore.toFixed(0)}/100.`,
        hashtags: [hashtag, `travel${dest.replace(/\s+/g, "")}`.toLowerCase(), "traveltok"],
      });
    }

    return ideas;
  }
}

/** OpenAI-backed idea generator with structured output + validation. */
export class OpenAIContentIdeaGenerator implements ContentIdeaGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: ContentIdeaGeneratorInput): Promise<ContentIdeaDraft[]> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            CONTENT_IDEA_GENERATOR_SYSTEM_PROMPT +
            languageInstruction(input.language),
        },
        { role: "user", content: buildContentIdeaGeneratorUserPrompt(input) },
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

    const batch = unwrapIdeaBatch(raw);

    const drafts = validateContentIdeaGeneration(batch);
    return drafts.slice(0, input.count).map((draft) => ({
      title: draft.title,
      topic: draft.topic,
      destination: draft.destination,
      format: draft.format,
      hook: draft.hook,
      hookType: draft.hookType,
      concept: draft.concept,
      targetAudience: draft.targetAudience,
      cta: draft.cta,
      estimatedDuration: draft.estimatedDuration,
      opportunityScore: draft.opportunityScore,
      aiReasoning: draft.aiReasoning,
      hashtags: draft.hashtags,
    }));
  }
}

/** Accepts either a bare array or an object wrapping `{ ideas: [...] }`. */
export function unwrapIdeaBatch(raw: unknown): unknown {
  return z
    .object({ ideas: z.array(z.unknown()) })
    .safeParse(raw)
    .success
    ? (raw as { ideas: unknown[] }).ideas
    : raw;
}
