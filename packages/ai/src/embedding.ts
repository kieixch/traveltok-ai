import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import OpenAI from "openai";
import { AIError, mapProviderError } from "./errors";

/**
 * Target dimension of the pgvector `vector` column and of mock embeddings.
 * 3072 matches `gemini-embedding-001` (the primary embedder).
 */
export const EMBEDDING_DIMENSION = 3072;
/** OpenAI embeddings are fixed at 1536 dims regardless of the column. */
export const OPENAI_EMBEDDING_DIMENSION = 1536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const MOCK_EMBEDDING_MODEL = "mock-hash-embedding";

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimension: number;
}

export interface EmbeddingGenerator {
  /** Embed free text into a fixed-size vector (unit length in mock mode). */
  embed(text: string): Promise<EmbeddingResult>;
}

/** FNV-1a hash — deterministic, stable across runs and processes. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** Stable 32-bit token hash (positive for even hash, negative for odd). */
function tokenHash(token: string): number {
  const h = fnv1a(token);
  return (h & 1) === 0 ? h : -h;
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return norm > 0 ? vector.map((x) => x / norm) : vector;
}

/**
 * Deterministic hashed bag-of-tokens embedding. Words that appear in the text
 * land on stable dimensions, so texts sharing vocabulary are close in cosine
 * distance. Good enough for demos without an OpenAI key.
 */
export class MockEmbeddingGenerator implements EmbeddingGenerator {
  async embed(text: string): Promise<EmbeddingResult> {
    const tokens =
      text
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.map((token) => token.trim())
        .filter((token) => token.length > 0) ?? [];

    const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
    for (const token of tokens) {
      const h = tokenHash(token);
      const index = Math.abs(h) % EMBEDDING_DIMENSION;
      vector[index] += h < 0 ? -1 : 1;
    }

    return {
      vector: normalize(vector),
      model: MOCK_EMBEDDING_MODEL,
      dimension: EMBEDDING_DIMENSION,
    };
  }
}

/** OpenAI embeddings via `text-embedding-3-small` (1536 dims). */
export class OpenAIEmbeddingGenerator implements EmbeddingGenerator {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: [text.slice(0, 8000)],
      dimensions: OPENAI_EMBEDDING_DIMENSION,
    });
    const vector = response.data[0]?.embedding;
    if (!vector) {
      throw new Error("OpenAI embeddings returned an empty result");
    }
    return {
      vector,
      model: this.model,
      dimension: vector.length,
    };
  }
}

/** Gemini embeddings via `gemini-embedding-001` (3072 dims). */
export class GeminiEmbeddingGenerator implements EmbeddingGenerator {
  private readonly model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    this.model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
  }

  async embed(text: string): Promise<EmbeddingResult> {
    let response;
    try {
      response = await this.model.embedContent({
        content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      });
    } catch (error) {
      throw mapProviderError(error);
    }
    const vector = response.embedding.values;
    if (!vector || vector.length === 0) {
      throw new AIError("AI_INVALID_RESPONSE", "Gemini embeddings returned an empty result");
    }
    return {
      vector: Array.from(vector),
      model: this.model.model,
      dimension: vector.length,
    };
  }
}

/** Serialize a vector into a pgvector literal, e.g. `[0.1,0.2,...]`. */
export function vectorToLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
