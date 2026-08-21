export type AIMode = "mock" | "openai" | "gemini";

export const AI_MODES: AIMode[] = ["mock", "openai", "gemini"];

export interface ProviderConfig {
  apiKey?: string;
  model: string;
  /** Selectable models for this provider (Gemini). Empty for single-model providers. */
  models?: string[];
  baseUrl?: string;
  embeddingModel?: string;
}

export interface AIConfig {
  /** Effective default mode — the requested env mode when its key is present, else `mock`. */
  mode: AIMode;
  /** Providers that can actually run right now (mock always; a real provider only when its key is set). */
  availableProviders: AIMode[];
  openai: ProviderConfig;
  gemini: ProviderConfig;
}

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * Text-capable Gemini models that can generate JSON. Each model has its own
 * free-tier daily quota, so rotating models (via `GEMINI_MODELS`) keeps
 * generation working when one model hits its limit.
 */
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-pro-latest",
];

function parseModelList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  const models = raw
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  return models.length > 0 ? models : fallback;
}

/**
 * Reads AI configuration from the environment. A provider is only "available"
 * when its API key is present; requesting an unavailable provider degrades
 * gracefully to `mock`, mirroring the scraping pipeline.
 */
export function parseAIConfig(env: NodeJS.ProcessEnv): AIConfig {
  const openai = {
    apiKey: env.OPENAI_API_KEY?.trim() || undefined,
    model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    baseUrl: env.OPENAI_BASE_URL?.trim() || undefined,
    embeddingModel:
      env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBEDDING_MODEL,
  };
  const gemini = {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    models: parseModelList(env.GEMINI_MODELS, DEFAULT_GEMINI_MODELS),
    embeddingModel:
      env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_GEMINI_EMBEDDING_MODEL,
  };

  const availableProviders: AIMode[] = ["mock"];
  if (openai.apiKey) availableProviders.push("openai");
  if (gemini.apiKey) availableProviders.push("gemini");

  const requested = env.AI_MODE === "openai" || env.AI_MODE === "gemini" ? env.AI_MODE : "mock";
  const mode: AIMode = effectiveMode(availableProviders, requested);

  return { mode, availableProviders, openai, gemini };
}

/** Resolves a selected provider to a runnable mode (falls back to mock). */
export function effectiveMode(available: AIMode[], selected: AIMode): AIMode {
  return selected === "mock" || available.includes(selected) ? selected : "mock";
}

/** Human label for a runnable mode, e.g. for the `model` column of analyses. */
export function modeLabel(config: AIConfig, mode: AIMode, mockLabel: string): string {
  if (mode === "openai") return config.openai.model;
  if (mode === "gemini") return config.gemini.model;
  return mockLabel;
}
