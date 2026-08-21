import {
  CONTENT_FORMATS,
  CTAS,
  HOOK_TYPES,
  ContentIdeaGeneratorInput,
  ProjectInsightInput,
  SENTIMENTS,
  VideoClassificationInput,
} from "./types";

export const VIDEO_CLASSIFIER_PROMPT_VERSION = "1";
export const PROJECT_INSIGHTS_PROMPT_VERSION = "1";
export const CONTENT_IDEA_GENERATOR_PROMPT_VERSION = "1";
export const SCRIPT_GENERATOR_PROMPT_VERSION = "1";
export const CAPTION_GENERATOR_PROMPT_VERSION = "1";
export const CONTENT_PLANNER_PROMPT_VERSION = "1";

/**
 * Extra instruction appended to a generation system prompt when a target
 * language is requested. Hashtags and structured values stay as-is.
 */
export function languageInstruction(language?: string): string {
  if (!language) return "";
  return `\n\nWrite ALL generated text (titles, hooks, concepts, captions, script sections, scene descriptions, tone, reasoning, summaries, and plan titles) in ${language}. Keep hashtags in their original form.`;
}

export const VIDEO_CLASSIFIER_SYSTEM_PROMPT = `You are an expert TikTok travel-content analyst.
Analyze the video metadata and return a single JSON object with EXACTLY these keys:
- "topic": concise topic label (max 80 chars), e.g. "Bali hidden beaches"
- "subTopic": narrower angle or null
- "destination": travel destination mentioned, or null
- "contentFormat": one of ${CONTENT_FORMATS.join(", ")}
- "hookType": one of ${HOOK_TYPES.join(", ")}
- "hookText": the hook/opening line extracted from the caption, or null
- "ctaType": the call-to-action (follow, comment, save, share, book, link in bio) or null
- "sentiment": one of ${SENTIMENTS.join(", ")}
- "targetAudience": who this is for, or null
- "estimatedIntent": viewer intent (planning, inspiration, booking, awareness) or null
- "aiScore": float 0-100 estimating viral potential based on engagement signals
- "summary": one or two sentences of actionable insight

Output ONLY valid JSON. No markdown, no extra text.`;

export function buildVideoClassificationUserPrompt(
  input: VideoClassificationInput,
): string {
  const lines = [
    `Caption: ${input.caption ?? "(none)"}`,
    `Description: ${input.description ?? "(none)"}`,
    `Location: ${input.location ?? "(none)"}`,
    `Hashtags: ${input.hashtags.join(", ") || "(none)"}`,
    `Creator: ${input.creatorUsername ?? "(unknown)"}`,
    `Duration (s): ${input.duration ?? "(unknown)"}`,
    `Views: ${input.views ?? "(unknown)"}`,
    `Likes: ${input.likes ?? "(unknown)"}`,
    `Comments: ${input.comments ?? "(unknown)"}`,
    `Engagement rate (%): ${input.engagementRate ?? "(unknown)"}`,
  ];
  return lines.join("\n");
}

export const PROJECT_INSIGHTS_SYSTEM_PROMPT = `You are a TikTok travel-content strategist.
Analyze the project metrics below and return a single JSON object with EXACTLY these keys:
- "summary": 2-3 sentence executive summary
- "strengths": array of 2-4 short strings describing what works
- "weaknesses": array of 2-4 short strings describing what is missing
- "recommendations": array of 3-5 concrete next actions
- "predictedBestFormat": one of ${CONTENT_FORMATS.join(", ")}
- "predictedBestHook": one of ${HOOK_TYPES.join(", ")}
- "opportunity": float 0-100 scoring overall growth opportunity

Output ONLY valid JSON. No markdown, no extra text.`;

export function buildProjectInsightsUserPrompt(
  input: ProjectInsightInput,
): string {
  const lines = [
    `Project: ${input.projectName}`,
    `Videos: ${input.videoCount}`,
    `Creators: ${input.creatorCount}`,
    `Total views: ${input.totalViews}`,
    `Avg engagement rate (%): ${input.avgEngagementRate ?? "(unknown)"}`,
    `Top creator: ${input.topCreator ?? "(unknown)"}`,
    `Top hashtags: ${input.topHashtags.join(", ") || "(none)"}`,
    `Analyzed period (days): ${input.periodDays}`,
  ];
  return lines.join("\n");
}

export const CONTENT_IDEA_GENERATOR_SYSTEM_PROMPT = `You are a TikTok travel-content ideation expert.
Given a project profile, produce fresh video ideas as a JSON array. Each element MUST have EXACTLY these keys:
- "title": catchy, concise video title (max 100 chars)
- "topic": one-line topic label (max 80 chars)
- "destination": travel destination mentioned, or null
- "format": one of ${CONTENT_FORMATS.join(", ")}
- "hook": the spoken/on-screen hook (max 160 chars)
- "hookType": one of ${HOOK_TYPES.join(", ")}
- "concept": 1-2 sentence execution concept (max 300 chars)
- "targetAudience": who this is for, or null
- "cta": one of ${CTAS.join(", ")} or null
- "estimatedDuration": integer seconds, 15-120
- "opportunityScore": float 0-100 reflecting trend + fit
- "aiReasoning": short justification (max 200 chars)
- "hashtags": array of 3-6 hashtag strings without the # symbol

Vary formats and angles across the batch. Output ONLY valid JSON. No markdown, no extra text.`;

export function buildContentIdeaGeneratorUserPrompt(
  input: ContentIdeaGeneratorInput,
): string {
  const lines = [
    `Project: ${input.projectName}`,
    `Niche: ${input.niche ?? "(none)"}`,
    `Top hashtags: ${input.topHashtags.join(", ") || "(none)"}`,
    `Top destinations: ${input.topDestinations.join(", ") || "(none)"}`,
    `Preferred formats: ${input.formatMix.join(", ") || "any"}`,
    `Number of ideas to generate: ${input.count}`,
    `Seed (for determinism): ${input.randomness}`,
  ];
  return lines.join("\n");
}

export const SCRIPT_GENERATOR_SYSTEM_PROMPT = `You are a TikTok travel-video scriptwriter.
Given a content idea, return a single JSON object with EXACTLY these keys:
- "hook": the opening line (max 160 chars)
- "outline": array of 3-5 scene objects, each with:
    - "section": short scene label (max 40 chars)
    - "durationSeconds": integer seconds
    - "description": what happens on screen / is spoken (max 250 chars)
- "cta": one of ${CTAS.join(", ")}
- "tone": short tone descriptor (max 60 chars)

Total outline duration should be 20-60 seconds. Output ONLY valid JSON. No markdown, no extra text.`;

export interface ScriptGeneratorUserPromptInput {
  ideaTitle: string;
  hook: string | null;
  format: string;
  topic: string | null;
  destination: string | null;
  targetAudience: string | null;
  cta: string | null;
  randomness: string;
}

export function buildScriptGeneratorUserPrompt(
  input: ScriptGeneratorUserPromptInput,
): string {
  const lines = [
    `Idea title: ${input.ideaTitle}`,
    `Hook: ${input.hook ?? "(none)"}`,
    `Format: ${input.format}`,
    `Topic: ${input.topic ?? "(none)"}`,
    `Destination: ${input.destination ?? "(none)"}`,
    `Target audience: ${input.targetAudience ?? "(unknown)"}`,
    `CTA: ${input.cta ?? "(none)"}`,
    `Seed (for determinism): ${input.randomness}`,
  ];
  return lines.join("\n");
}

export const CAPTION_GENERATOR_SYSTEM_PROMPT = `You are a TikTok travel-content caption writer.
Given a content idea, return a single JSON object with EXACTLY these keys:
- "caption": a 40-80 word caption with a strong hook line, a short story beat, and a gentle CTA (no hashtags inside)
- "hashtags": array of 4-8 relevant hashtag strings without the # symbol
- "cta": one of ${CTAS.join(", ")}

Output ONLY valid JSON. No markdown, no extra text.`;

export interface CaptionGeneratorUserPromptInput {
  ideaTitle: string;
  topic: string | null;
  destination: string | null;
  format: string;
  hook: string | null;
  cta: string | null;
  hashtags: string[];
  randomness: string;
}

export function buildCaptionGeneratorUserPrompt(
  input: CaptionGeneratorUserPromptInput,
): string {
  const lines = [
    `Idea title: ${input.ideaTitle}`,
    `Topic: ${input.topic ?? "(none)"}`,
    `Destination: ${input.destination ?? "(none)"}`,
    `Format: ${input.format}`,
    `Hook: ${input.hook ?? "(none)"}`,
    `CTA: ${input.cta ?? "(none)"}`,
    `Suggested hashtags: ${input.hashtags.join(", ") || "(none)"}`,
    `Seed (for determinism): ${input.randomness}`,
  ];
  return lines.join("\n");
}

export const CONTENT_PLANNER_SYSTEM_PROMPT = `You are a TikTok content strategist and scheduling planner.
Given a project, a date range, a posting cadence, and a pool of content ideas, build a publishing plan.
Return a single JSON object with EXACTLY these keys:
- "title": plan title (max 120 chars)
- "description": 1-2 sentence plan summary, or null
- "items": array of scheduled posts, each with:
    - "contentIdeaId": the id of the chosen idea (must be one of the provided ids)
    - "scheduledDate": ISO-8601 date (YYYY-MM-DD) within the provided range
    - "title": the post title

Use each idea at most once. Space posts evenly across the range. Output ONLY valid JSON. No markdown, no extra text.`;

export interface ContentPlannerUserPromptInput {
  projectName: string;
  niche: string | null;
  startDate: string;
  endDate: string;
  postsPerWeek: number;
  ideas: Array<{ id: string; title: string; opportunityScore: number | null; format: string | null }>;
  randomness: string;
}

export function buildContentPlannerUserPrompt(
  input: ContentPlannerUserPromptInput,
): string {
  const lines = [
    `Project: ${input.projectName}`,
    `Niche: ${input.niche ?? "(none)"}`,
    `Range: ${input.startDate} to ${input.endDate}`,
    `Posts per week: ${input.postsPerWeek}`,
    `Idea pool:`,
    ...input.ideas.map(
      (idea) =>
        `  - ${idea.id} | ${idea.title} | format=${idea.format ?? "any"} | opportunity=${idea.opportunityScore ?? "unknown"}`,
    ),
    `Seed (for determinism): ${input.randomness}`,
  ];
  return lines.join("\n");
}
