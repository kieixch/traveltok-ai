import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@traveltok/database";
import {
  AI_MODES,
  AIConfig,
  AIMode,
  effectiveMode,
} from "@traveltok/ai";
import { AI_CONFIG } from "./ai.constants";

export interface AiProviderInfo {
  value: AIMode;
  label: string;
  /** Currently selected model for this provider (config default unless the user chose one). */
  model: string;
  /** Selectable models for this provider (empty for providers without a model choice). */
  models: string[];
  available: boolean;
}

export interface AiProvidersInfo {
  current: AIMode;
  providers: AiProviderInfo[];
}

const PROVIDER_LABELS: Record<AIMode, string> = {
  mock: "Auto (server default)",
  openai: "OpenAI",
  gemini: "Google Gemini",
};

/**
 * Resolves the effective AI provider and model per user. Each user has an
 * `aiProvider` preference (`mock` = follow the server default) plus an optional
 * `aiModel` (used for providers with several selectable models, e.g. Gemini).
 */
@Injectable()
export class AiRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_CONFIG) private readonly config: AIConfig,
  ) {}

  /** Effective runnable mode for a user's stored preference. */
  async modeFor(userId: string): Promise<AIMode> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.resolveMode(toAIMode(user.aiProvider));
  }

  /** Model to run for the given (effective) mode: the user's stored model when valid. */
  async modelFor(userId: string, provider: AIMode): Promise<string> {
    if (provider === "mock") {
      return "Deterministic offline heuristics";
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiModel: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const config = provider === "gemini" ? this.config.gemini : this.config.openai;
    if (
      provider === "gemini" &&
      user.aiModel &&
      config.models?.includes(user.aiModel)
    ) {
      return user.aiModel;
    }
    return config.model;
  }

  /** Lists all known providers with availability, selectable models and the user's selection. */
  async providersInfo(userId: string): Promise<AiProvidersInfo> {
    return this.providersInfoFor(userId);
  }

  /** Persists a user's AI provider preference (validated against availability). */
  async setProvider(userId: string, provider: AIMode): Promise<AiProvidersInfo> {
    if (!AI_MODES.includes(provider)) {
      throw new BadRequestException(`Unknown AI provider: ${provider}`);
    }
    if (provider !== "mock" && !this.config.availableProviders.includes(provider)) {
      throw new BadRequestException(
        `${PROVIDER_LABELS[provider]} is not configured — add its API key to .env first`,
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { aiProvider: provider },
    });
    return this.providersInfoFor(userId);
  }

  /** Persists a user's model choice for a provider (validated against the available models). */
  async setModel(userId: string, provider: AIMode, model: string): Promise<AiProvidersInfo> {
    if (provider !== "gemini") {
      throw new BadRequestException(
        "Model selection is only available for Google Gemini",
      );
    }
    if (!this.config.availableProviders.includes("gemini")) {
      throw new BadRequestException(
        `${PROVIDER_LABELS.gemini} is not configured — add its API key to .env first`,
      );
    }
    const models = this.config.gemini.models ?? [this.config.gemini.model];
    if (!models.includes(model)) {
      throw new BadRequestException(
        `Unknown Gemini model: ${model}. Choose from: ${models.join(", ")}`,
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { aiModel: model },
    });
    return this.providersInfoFor(userId);
  }

  private async providersInfoFor(userId: string): Promise<AiProvidersInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { aiProvider: true, aiModel: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const stored = toAIMode(user.aiProvider);
    const geminiModels = this.config.gemini.models ?? [this.config.gemini.model];
    const currentModelFor = (mode: AIMode): string => {
      if (mode === "gemini") {
        return user.aiModel && geminiModels.includes(user.aiModel)
          ? user.aiModel
          : this.config.gemini.model;
      }
      if (mode === "openai") return this.config.openai.model;
      return "Deterministic offline heuristics";
    };
    return {
      current: stored,
      providers: AI_MODES.map((mode) => ({
        value: mode,
        label: PROVIDER_LABELS[mode],
        model: currentModelFor(mode),
        models: mode === "gemini" ? geminiModels : [],
        available: mode === "mock" || this.config.availableProviders.includes(mode),
      })),
    };
  }

  /** `mock` = no explicit choice → follow the server default (AI_MODE). */
  private resolveMode(stored: AIMode): AIMode {
    if (stored === "mock") {
      return effectiveMode(this.config.availableProviders, this.config.mode);
    }
    return effectiveMode(this.config.availableProviders, stored);
  }
}

function toAIMode(value: string): AIMode {
  return value === "openai" || value === "gemini" ? value : "mock";
}
