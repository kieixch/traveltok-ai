import OpenAI from "openai";
import { AIConfig, AIMode } from "./config";
import {
  GeminiVideoClassifier,
  GeminiScriptGenerator,
  GeminiCaptionGenerator,
  GeminiContentPlanner,
  GeminiContentIdeaGenerator,
  GeminiProjectInsights,
} from "./gemini";
import { MockVideoClassifier } from "./mock-classifier";
import { OpenAIVideoClassifier } from "./openai-classifier";
import { VideoClassifier } from "./video-classifier";
import { MockScriptGenerator, OpenAIScriptGenerator, ScriptGenerator } from "./script-generator";
import { MockCaptionGenerator, OpenAICaptionGenerator, CaptionGenerator } from "./caption-generator";
import {
  MockContentIdeaGenerator,
  OpenAIContentIdeaGenerator,
  ContentIdeaGenerator,
} from "./content-idea-generator";
import { MockContentPlanner, OpenAIContentPlanner, ContentPlanner } from "./content-planner";
import { MockProjectInsights, OpenAIProjectInsights, InsightsGenerator } from "./project-insights";
import {
  MockEmbeddingGenerator,
  OpenAIEmbeddingGenerator,
  GeminiEmbeddingGenerator,
  EmbeddingGenerator,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
} from "./embedding";

export function createVideoClassifier(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): VideoClassifier {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiVideoClassifier(config.gemini.apiKey, model ?? config.gemini.model);
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIVideoClassifier(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockVideoClassifier();
}

export function createScriptGenerator(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): ScriptGenerator {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiScriptGenerator(config.gemini.apiKey, model ?? config.gemini.model);
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIScriptGenerator(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockScriptGenerator();
}

export function createCaptionGenerator(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): CaptionGenerator {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiCaptionGenerator(config.gemini.apiKey, model ?? config.gemini.model);
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAICaptionGenerator(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockCaptionGenerator();
}

export function createContentIdeaGenerator(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): ContentIdeaGenerator {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiContentIdeaGenerator(
      config.gemini.apiKey,
      model ?? config.gemini.model,
    );
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIContentIdeaGenerator(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockContentIdeaGenerator();
}

export function createContentPlanner(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): ContentPlanner {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiContentPlanner(config.gemini.apiKey, model ?? config.gemini.model);
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIContentPlanner(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockContentPlanner();
}

export function createInsightsGenerator(
  config: AIConfig,
  mode: AIMode = config.mode,
  model?: string,
): InsightsGenerator {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiProjectInsights(config.gemini.apiKey, model ?? config.gemini.model);
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIProjectInsights(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.model,
    );
  }
  return new MockProjectInsights();
}

/**
 * Picks the embedder matching the given (or server default) mode: Gemini when
 * available, otherwise OpenAI, otherwise the deterministic mock. The pgvector
 * column is `vector(3072)`, which matches `gemini-embedding-001`.
 */
export function createEmbeddingGenerator(
  config: AIConfig,
  mode: AIMode = config.mode,
): EmbeddingGenerator {
  if (mode === "gemini" && config.gemini.apiKey) {
    return new GeminiEmbeddingGenerator(
      config.gemini.apiKey,
      config.gemini.embeddingModel ?? DEFAULT_GEMINI_EMBEDDING_MODEL,
    );
  }
  if (mode === "openai" && config.openai.apiKey) {
    return new OpenAIEmbeddingGenerator(
      new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl }),
      config.openai.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
    );
  }
  return new MockEmbeddingGenerator();
}
