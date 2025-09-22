// 原始对象: Qu 及其常量 Gu、Ju

import { Message } from "../types";

type ModelName =
  | "claude-sonnet-4-20250514"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-sonnet-20240620"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307";

const DEFAULT_MODEL: ModelName = "claude-3-5-sonnet-20241022";

// 原始对象: Gu
const MODEL_CONTEXT_WINDOWS: Record<ModelName, number> = {
  "claude-sonnet-4-20250514": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-5-sonnet-20240620": 200000,
  "claude-3-opus-20240229": 200000,
  "claude-3-sonnet-20240229": 200000,
  "claude-3-haiku-20240307": 200000,
};

// 原始对象: Ju
const MODEL_MAX_OUTPUT_TOKENS: Record<ModelName, number> = {
  "claude-sonnet-4-20250514": 8192,
  "claude-3-5-sonnet-20241022": 8192,
  "claude-3-5-sonnet-20240620": 8192,
  "claude-3-opus-20240229": 4096,
  "claude-3-sonnet-20240229": 4096,
  "claude-3-haiku-20240307": 4096,
};

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheTokens: number;
  contextWindow: number;
  percentUsed: number;
  percentRemaining: number;
  isWarning: boolean;
  isError: boolean;
}

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

class TokenManager {
  private model: ModelName;

  constructor(model: ModelName = DEFAULT_MODEL) {
    this.model = model;
  }

  setModel(model: ModelName): void {
    this.model = model;
  }

  getContextWindow(): number {
    return MODEL_CONTEXT_WINDOWS[this.model] || 200000;
  }

  getMaxOutputTokens(): number {
    return MODEL_MAX_OUTPUT_TOKENS[this.model] || 8192;
  }

  getEffectiveContextWindow(): number {
    return this.getContextWindow() - this.getMaxOutputTokens();
  }

  calculateMetricsFromMessages(messages: Message[]): TokenMetrics | null {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (
        message &&
        "role" in message &&
        message.role === "assistant" &&
        "usage" in message &&
        message.usage
      ) {
        return this.calculateMetricsFromUsage(message.usage);
      }
    }
    return null;
  }

  calculateMetricsFromUsage(usage: Usage): TokenMetrics {
    const inputTokensRaw = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    const cacheTokens = cacheCreationTokens + cacheReadTokens;
    const inputTokens = inputTokensRaw + cacheCreationTokens + cacheReadTokens;
    const totalTokens = inputTokens + outputTokens;
    const contextWindow = this.getEffectiveContextWindow();
    const percentUsed = Math.round((totalTokens / contextWindow) * 100);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      cacheTokens,
      contextWindow,
      percentUsed,
      percentRemaining: Math.max(0, 100 - percentUsed),
      isWarning: totalTokens >= contextWindow - 20000,
      isError: totalTokens >= contextWindow - 10000,
    };
  }

  getColorForPercentage(percentage: number): string {
    if (percentage > 30) {
      return "text-green-500";
    } else if (percentage > 10) {
      return "text-yellow-500";
    } else {
      return "text-red-500";
    }
  }

  formatTokenDisplay(metrics: TokenMetrics): string {
    return `Context: ${metrics.percentRemaining}% remaining`;
  }

  getDetailedBreakdown(metrics: TokenMetrics): string {
    return `${metrics.totalTokens.toLocaleString()} / ${metrics.contextWindow.toLocaleString()} tokens${
      metrics.cacheTokens > 0
        ? ` (${metrics.cacheTokens.toLocaleString()} cached)`
        : ""
    }`;
  }
}

export const tokenManager = new TokenManager();
