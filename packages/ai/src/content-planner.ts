import OpenAI from "openai";
import {
  ContentPlanDraft,
  ContentPlannerInput,
  PlannerIdea,
} from "./types";
import {
  buildContentPlannerUserPrompt,
  CONTENT_PLANNER_SYSTEM_PROMPT,
  languageInstruction,
} from "./prompts";
import { validateContentPlanDraft } from "./zod-schemas";
import { hash } from "./content-idea-generator";

export interface ContentPlanner {
  generate(input: ContentPlannerInput): Promise<ContentPlanDraft>;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDiffMs(start: Date, end: Date): number {
  return Math.max(0, end.getTime() - start.getTime());
}

/** Deterministic offline planner used when `AI_MODE=mock`. */
export class MockContentPlanner implements ContentPlanner {
  async generate(input: ContentPlannerInput): Promise<ContentPlanDraft> {
    const seed = hash(input.randomness);
    const pool = [...input.ideas].sort((a, b) =>
      (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0),
    );

    const rangeMs = dayDiffMs(input.startDate, input.endDate);
    const rangeDays = rangeMs > 0 ? Math.floor(rangeMs / 86400000) + 1 : 1;
    const weeks = Math.max(1, rangeDays / 7);
    const slots = Math.min(
      pool.length,
      Math.max(1, Math.round(weeks * input.postsPerWeek)),
      60,
    );

    const chosen: PlannerIdea[] = pool.slice(0, slots);
    const items: ContentPlanDraft["items"] = chosen.map((idea, index) => {
      const scheduledDate =
        slots === 1
          ? input.startDate
          : new Date(
              input.startDate.getTime() +
                Math.round((index * rangeMs) / (slots - 1)),
            );
      return {
        contentIdeaId: idea.id,
        scheduledDate: toISODate(scheduledDate),
        title: idea.title,
      };
    });

    const weeksInPlan = Math.max(1, Math.ceil(rangeDays / 7));
    return {
      title: `${input.projectName} — AI publishing plan`,
      description: `Automatically scheduled ${items.length} posts across ${weeksInPlan} week(s) (${input.postsPerWeek} post(s) per week), prioritizing the highest-opportunity ideas.`,
      items,
    };
  }
}

/** OpenAI-backed planner with structured output + validation. */
export class OpenAIContentPlanner implements ContentPlanner {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: ContentPlannerInput): Promise<ContentPlanDraft> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONTENT_PLANNER_SYSTEM_PROMPT + languageInstruction(input.language) },
        {
          role: "user",
          content: buildContentPlannerUserPrompt({
            projectName: input.projectName,
            niche: input.niche,
            startDate: toISODate(input.startDate),
            endDate: toISODate(input.endDate),
            postsPerWeek: input.postsPerWeek,
            ideas: input.ideas.map((idea) => ({
              id: idea.id,
              title: idea.title,
              opportunityScore: idea.opportunityScore,
              format: idea.format,
            })),
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

    const parsed = validateContentPlanDraft(raw);
    return sanitizeContentPlanDraft(parsed, input);
  }
}

/**
 * Post-processes model output: drops items referencing unknown idea ids,
 * duplicate ideas, or dates outside the requested range.
 */
export function sanitizeContentPlanDraft(
  parsed: ReturnType<typeof validateContentPlanDraft>,
  input: ContentPlannerInput,
): ContentPlanDraft {
  const allowedIds = new Set(input.ideas.map((idea) => idea.id));
  const usedIds = new Set<string>();
  const validDates = (date: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date >= toISODate(input.startDate) &&
    date <= toISODate(input.endDate);

  const items = parsed.items
    .filter((item) => allowedIds.has(item.contentIdeaId))
    .filter((item) => {
      if (usedIds.has(item.contentIdeaId)) return false;
      usedIds.add(item.contentIdeaId);
      return true;
    })
    .filter((item) => validDates(item.scheduledDate))
    .map((item) => ({
      contentIdeaId: item.contentIdeaId,
      scheduledDate: item.scheduledDate,
      title: item.title,
    }));

  return {
    title: parsed.title,
    description: parsed.description,
    items,
  };
}
