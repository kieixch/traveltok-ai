import OpenAI from "openai";
import { CONTENT_FORMATS, HOOK_TYPES, ProjectInsight, ProjectInsightInput } from "./types";
import {
  buildProjectInsightsUserPrompt,
  PROJECT_INSIGHTS_SYSTEM_PROMPT,
} from "./prompts";
import { z } from "zod";

export const ProjectInsightSchema = z.object({
  summary: z.string().min(1).max(2000),
  strengths: z.array(z.string().max(200)).default([]),
  weaknesses: z.array(z.string().max(200)).default([]),
  recommendations: z.array(z.string().max(200)).default([]),
  predictedBestFormat: z.string(),
  predictedBestHook: z.string(),
  opportunity: z.preprocess(
    (value) => {
      const num = typeof value === "number" ? value : Number(value);
      return Number.isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    },
    z.number(),
  ),
});

export function coerceInsights<T extends readonly string[]>(
  values: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  const list = values as readonly string[];
  return typeof value === "string" && list.includes(value)
    ? (value as T[number])
    : fallback;
}

export interface InsightsGenerator {
  generate(input: ProjectInsightInput): Promise<ProjectInsight>;
}

/** Deterministic fallback insights for `AI_MODE=mock`. */
export class MockProjectInsights implements InsightsGenerator {
  async generate(input: ProjectInsightInput): Promise<ProjectInsight> {
    const engagement = input.avgEngagementRate ?? 0;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (input.videoCount >= 10) {
      strengths.push(`Consistent publishing with ${input.videoCount} scraped videos`);
    } else {
      weaknesses.push(`Only ${input.videoCount} videos tracked — increase coverage`);
      recommendations.push("Run more scraping jobs to expand the dataset");
    }
    if (engagement >= 5) {
      strengths.push(`Healthy average engagement of ${engagement.toFixed(1)}%`);
    } else {
      weaknesses.push(`Average engagement of ${engagement.toFixed(1)}% is below 5%`);
      recommendations.push("Audit hooks and CTAs — test question-style openers");
    }
    if (input.creatorCount >= 5) {
      strengths.push(`Diverse creator pool (${input.creatorCount} creators)`);
    } else {
      recommendations.push("Scrape additional creators to benchmark against competitors");
    }
    if (input.topHashtags.length > 0) {
      recommendations.push(`Double down on top hashtags: ${input.topHashtags.slice(0, 3).join(", ")}`);
    }
    recommendations.push(
      input.topCreator
        ? `Replicate the format of top creator "${input.topCreator}"`
        : "Identify and follow a top creator to emulate",
    );

    const opportunity = Math.min(
      100,
      Math.round((engagement * 12 + Math.min(input.creatorCount, 25) * 0.8 + input.videoCount / 10) * 10) / 10,
    );

    return {
      summary:
        `${input.projectName} tracked ${input.videoCount} videos across ${input.creatorCount} creators` +
        ` (${input.totalViews.toLocaleString()} total views).` +
        (engagement >= 5
          ? " Engagement is healthy and worth scaling."
          : " Engagement is below target — sharpen hooks and CTAs."),
      strengths,
      weaknesses,
      recommendations,
      predictedBestFormat: "VLOG",
      predictedBestHook: "QUESTION",
      opportunity,
    };
  }
}

/** OpenAI-backed insights generator with structured output + validation. */
export class OpenAIProjectInsights implements InsightsGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(input: ProjectInsightInput): Promise<ProjectInsight> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROJECT_INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: buildProjectInsightsUserPrompt(input) },
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

    const parsed = ProjectInsightSchema.parse(raw);
    return {
      summary: parsed.summary,
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      recommendations: parsed.recommendations,
      predictedBestFormat: coerceInsights(CONTENT_FORMATS, parsed.predictedBestFormat, "VLOG"),
      predictedBestHook: coerceInsights(HOOK_TYPES, parsed.predictedBestHook, "QUESTION"),
      opportunity: Math.min(100, Math.max(0, Math.round(parsed.opportunity * 10) / 10)),
    };
  }
}
