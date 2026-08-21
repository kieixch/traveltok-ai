import { z } from "zod";
import {
  CONTENT_FORMATS,
  CTAS,
  HOOK_TYPES,
  SENTIMENTS,
} from "./types";

/**
 * zod v4 helpers. Everything is intentionally lenient: LLM output drifts, so
 * unknown enum values fall back to a safe default and empty strings become
 * `null` instead of corrupting the database.
 */
const nullableString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
  z.string().nullable(),
);

function enumOr<T extends readonly string[]>(
  values: T,
  fallback: T[number],
): z.ZodType<T[number]> {
  const list = values as unknown as [string, ...string[]];
  return z.preprocess(
    (value) =>
      typeof value === "string" && list.includes(value) ? value : fallback,
    z.enum(list) as z.ZodType<T[number]>,
  );
}

export const VideoClassificationSchema = z.object({
  topic: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Travel",
    z.string().min(1).max(120),
  ),
  subTopic: nullableString,
  destination: nullableString,
  contentFormat: enumOr(CONTENT_FORMATS, "OTHER"),
  hookType: enumOr(HOOK_TYPES, "OTHER"),
  hookText: nullableString,
  ctaType: nullableString,
  sentiment: enumOr(SENTIMENTS, "NEUTRAL"),
  targetAudience: nullableString,
  estimatedIntent: nullableString,
  aiScore: z.preprocess(
    (value) => {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return null;
      return Math.min(100, Math.max(0, Math.round(num * 10) / 10));
    },
    z.number().nullable(),
  ),
  summary: nullableString,
});

export type RawVideoClassification = z.infer<typeof VideoClassificationSchema>;

/** Thrown when the model returns something that fails validation. */
export class AIClassificationError extends Error {
  constructor(
    message: string,
    readonly issues: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "AIClassificationError";
  }
}

export function validateVideoClassification(raw: unknown): RawVideoClassification {
  const result = VideoClassificationSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AIClassificationError(
      `AI classification failed validation: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
      issues,
    );
  }
  return result.data;
}

// --- Phase 7: content ideation, scripts, captions, planner -------------------

const nullableShort = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : null,
  z.string().max(500).nullable(),
);

const optionalEnum = <T extends readonly string[]>(
  values: T,
): z.ZodType<T[number] | null> => {
  const list = values as unknown as [string, ...string[]];
  return z.preprocess(
    (value) =>
      typeof value === "string" && list.includes(value) ? value : null,
    z.enum(list).nullable() as z.ZodType<T[number] | null>,
  );
};

const clampedScore = z.preprocess(
  (value) => {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(num)) return 0;
    return Math.min(100, Math.max(0, Math.round(num * 10) / 10));
  },
  z.number(),
);

const hashtagsArray = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") continue;
      const tag = item.trim().replace(/^#/, "").toLowerCase();
      if (tag.length === 0 || seen.has(tag)) continue;
      seen.add(tag);
      cleaned.push(tag);
    }
    return cleaned.slice(0, 10);
  },
  z.array(z.string().min(1)),
);

export const ContentIdeaDraftSchema = z.object({
  title: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Untitled idea",
    z.string().min(1).max(100),
  ),
  topic: nullableShort,
  destination: nullableShort,
  format: enumOr(CONTENT_FORMATS, "OTHER"),
  hook: nullableShort,
  hookType: enumOr(HOOK_TYPES, "OTHER"),
  concept: nullableShort,
  targetAudience: nullableShort,
  cta: optionalEnum(CTAS),
  estimatedDuration: z.preprocess(
    (value) => {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return null;
      return Math.min(120, Math.max(15, Math.round(num)));
    },
    z.number().nullable(),
  ),
  opportunityScore: clampedScore,
  aiReasoning: nullableShort,
  hashtags: hashtagsArray,
});

export const ContentIdeaGenerationSchema = z
  .preprocess(
    (value) => (Array.isArray(value) ? value : null),
    z.array(ContentIdeaDraftSchema).max(20),
  )
  .default([]);

export const ScriptSectionSchema = z.object({
  section: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Scene",
    z.string().min(1).max(60),
  ),
  durationSeconds: z.preprocess(
    (value) => {
      const num = typeof value === "number" ? value : Number(value);
      return Number.isNaN(num) ? 10 : Math.max(1, Math.round(num));
    },
    z.number(),
  ),
  description: z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim() : "",
    z.string().min(1).max(300),
  ),
});

export const VideoScriptSchema = z.object({
  hook: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Watch this.",
    z.string().min(1).max(200),
  ),
  outline: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(ScriptSectionSchema).max(8),
  ),
  cta: enumOr(CTAS, "FOLLOW"),
  tone: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "energetic",
    z.string().min(1).max(80),
  ),
});

export const VideoCaptionSchema = z.object({
  caption: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "",
    z.string().min(1).max(2000),
  ),
  hashtags: hashtagsArray,
  cta: enumOr(CTAS, "FOLLOW"),
});

export const ContentPlanDraftItemSchema = z.object({
  contentIdeaId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "scheduledDate must be YYYY-MM-DD",
  }),
  title: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "Untitled post",
    z.string().min(1).max(200),
  ),
});

export const ContentPlanDraftSchema = z.object({
  title: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : "AI content plan",
    z.string().min(1).max(120),
  ),
  description: nullableShort,
  items: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(ContentPlanDraftItemSchema).max(60),
  ),
});

export type RawContentIdeaDraft = z.infer<typeof ContentIdeaDraftSchema>;
export type RawContentPlanDraft = z.infer<typeof ContentPlanDraftSchema>;
export type RawVideoScript = z.infer<typeof VideoScriptSchema>;
export type RawVideoCaption = z.infer<typeof VideoCaptionSchema>;

function validateWith(
  schema: z.ZodType,
  label: string,
  raw: unknown,
): unknown {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AIClassificationError(
      `${label} failed validation: ${issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
      issues,
    );
  }
  return result.data;
}

export function validateContentIdeaGeneration(raw: unknown): RawContentIdeaDraft[] {
  return validateWith(ContentIdeaGenerationSchema, "AI content idea generation", raw) as RawContentIdeaDraft[];
}

export function validateVideoScript(raw: unknown): RawVideoScript {
  return validateWith(VideoScriptSchema, "AI script generation", raw) as RawVideoScript;
}

export function validateVideoCaption(raw: unknown): RawVideoCaption {
  return validateWith(VideoCaptionSchema, "AI caption generation", raw) as RawVideoCaption;
}

export function validateContentPlanDraft(raw: unknown): RawContentPlanDraft {
  return validateWith(ContentPlanDraftSchema, "AI content planner", raw) as RawContentPlanDraft;
}
