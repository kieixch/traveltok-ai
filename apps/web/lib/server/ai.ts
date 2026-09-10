import { parseAIConfig, type AIConfig } from "@traveltok/ai";

const globalForConfig = globalThis as unknown as { aiConfig?: AIConfig };

export function getAIConfig(): AIConfig {
  if (!globalForConfig.aiConfig) {
    globalForConfig.aiConfig = parseAIConfig(process.env);
  }
  return globalForConfig.aiConfig;
}