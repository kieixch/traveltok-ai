import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { AIError, mapProviderError } from "./errors";
import {
  buildCaptionGeneratorUserPrompt,
  buildContentIdeaGeneratorUserPrompt,
  buildContentPlannerUserPrompt,
  buildProjectInsightsUserPrompt,
  buildScriptGeneratorUserPrompt,
  buildVideoClassificationUserPrompt,
  CAPTION_GENERATOR_SYSTEM_PROMPT,
  CONTENT_IDEA_GENERATOR_SYSTEM_PROMPT,
  CONTENT_PLANNER_SYSTEM_PROMPT,
  PROJECT_INSIGHTS_SYSTEM_PROMPT,
  SCRIPT_GENERATOR_SYSTEM_PROMPT,
  VIDEO_CLASSIFIER_SYSTEM_PROMPT,
  languageInstruction,
} from "./prompts";
import {
  validateContentIdeaGeneration,
  validateContentPlanDraft,
  validateVideoCaption,
  validateVideoClassification,
  validateVideoScript,
} from "./zod-schemas";
import {
  CaptionGeneratorInput,
  ContentFormat,
  ContentIdeaDraft,
  ContentIdeaGeneratorInput,
  ContentPlanDraft,
  ContentPlannerInput,
  CONTENT_FORMATS,
  HookType,
  HOOK_TYPES,
  ProjectInsight,
  ProjectInsightInput,
  ScriptGeneratorInput,
  VideoCaption,
  VideoClassification,
  VideoClassificationInput,
  VideoScript,
} from "./types";
import { unwrapIdeaBatch } from "./content-idea-generator";
import { sanitizeContentPlanDraft } from "./content-planner";
import {
  coerceInsights,
  ProjectInsightSchema,
} from "./project-insights";

function createGemini(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

function makeModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  temperature: number,
): GenerativeModel {
  return createGemini(apiKey).getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  });
}

/** Runs a JSON-mode completion and parses the response, reusing zod validation. */
async function geminiJson(
  model: GenerativeModel,
  userPrompt: string,
): Promise<unknown> {
  let result;
  try {
    result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });
  } catch (error) {
    throw mapProviderError(error);
  }
  const text = result.response.text();
  if (!text) {
    throw new AIError("AI_INVALID_RESPONSE", "Gemini returned an empty response");
  }
  try {
    return extractJsonValue(text);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(
      "AI_INVALID_RESPONSE",
      `Gemini returned invalid JSON: ${(error as Error).message}`,
    );
  }
}

/**
 * Parses the first complete JSON value from a model response, tolerating
 * trailing prose, markdown code fences and leading text. Thinking models may
 * append text after the JSON despite `responseMimeType: "application/json"`.
 */
function extractJsonValue(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = trimmed.search(/[[{]/);
  if (start === -1) {
    throw new AIError("AI_INVALID_RESPONSE", "Gemini returned no JSON value");
  }
  const open = trimmed[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }
  throw new AIError("AI_INVALID_RESPONSE", "Gemini returned unterminated JSON");
}

export class GeminiVideoClassifier {
  private readonly model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    this.model = makeModel(apiKey, modelName, VIDEO_CLASSIFIER_SYSTEM_PROMPT, 0);
  }

  async classify(input: VideoClassificationInput): Promise<VideoClassification> {
    const raw = await geminiJson(this.model, buildVideoClassificationUserPrompt(input));
    return validateVideoClassification(raw);
  }
}

export class GeminiScriptGenerator {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generate(input: ScriptGeneratorInput): Promise<VideoScript> {
    const model = makeModel(
      this.apiKey,
      this.modelName,
      SCRIPT_GENERATOR_SYSTEM_PROMPT + languageInstruction(input.language),
      0.7,
    );
    const raw = await geminiJson(model, buildScriptGeneratorUserPrompt(input));
    const parsed = validateVideoScript(raw);
    return {
      hook: parsed.hook,
      outline: parsed.outline,
      cta: parsed.cta,
      tone: parsed.tone,
    };
  }
}

export class GeminiCaptionGenerator {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generate(input: CaptionGeneratorInput): Promise<VideoCaption> {
    const model = makeModel(
      this.apiKey,
      this.modelName,
      CAPTION_GENERATOR_SYSTEM_PROMPT + languageInstruction(input.language),
      0.7,
    );
    const raw = await geminiJson(model, buildCaptionGeneratorUserPrompt(input));
    const parsed = validateVideoCaption(raw);
    return {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      cta: parsed.cta,
    };
  }
}

export class GeminiContentPlanner {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generate(input: ContentPlannerInput): Promise<ContentPlanDraft> {
    const model = makeModel(
      this.apiKey,
      this.modelName,
      CONTENT_PLANNER_SYSTEM_PROMPT + languageInstruction(input.language),
      0.3,
    );
    const raw = await geminiJson(
      model,
      buildContentPlannerUserPrompt({
        projectName: input.projectName,
        niche: input.niche,
        startDate: input.startDate.toISOString().slice(0, 10),
        endDate: input.endDate.toISOString().slice(0, 10),
        postsPerWeek: input.postsPerWeek,
        ideas: input.ideas.map((idea) => ({
          id: idea.id,
          title: idea.title,
          opportunityScore: idea.opportunityScore,
          format: idea.format,
        })),
        randomness: input.randomness,
      }),
    );
    return sanitizeContentPlanDraft(validateContentPlanDraft(raw), input);
  }
}

export class GeminiContentIdeaGenerator {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generate(input: ContentIdeaGeneratorInput): Promise<ContentIdeaDraft[]> {
    const model = makeModel(
      this.apiKey,
      this.modelName,
      CONTENT_IDEA_GENERATOR_SYSTEM_PROMPT + languageInstruction(input.language),
      0.8,
    );
    const raw = await geminiJson(model, buildContentIdeaGeneratorUserPrompt(input));
    const drafts = validateContentIdeaGeneration(unwrapIdeaBatch(raw));
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

export class GeminiProjectInsights {
  private readonly model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    this.model = makeModel(apiKey, modelName, PROJECT_INSIGHTS_SYSTEM_PROMPT, 0);
  }

  async generate(input: ProjectInsightInput): Promise<ProjectInsight> {
    const raw = await geminiJson(this.model, buildProjectInsightsUserPrompt(input));
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
