interface PricingTier {
  inputPer1k: number;
  outputPer1k: number;
}

export class CostEngine {
  // Configurable pricing table (USD per 1,000 tokens)
  private static readonly PRICING_TABLE: Record<string, PricingTier> = {
    'openai/gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
    'openai/gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
    'openai/gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
    'anthropic/claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
    'anthropic/claude-3-opus': { inputPer1k: 0.015, outputPer1k: 0.075 },
    'anthropic/claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
    'google/gemini-1.5-pro': { inputPer1k: 0.00125, outputPer1k: 0.00375 },
    'google/gemini-1.5-flash': { inputPer1k: 0.000075, outputPer1k: 0.0003 },
    'meta/llama-3-70b': { inputPer1k: 0.00059, outputPer1k: 0.00079 },
    'meta/llama-3-8b': { inputPer1k: 0.00005, outputPer1k: 0.00008 },
    'copilot/default': { inputPer1k: 0.002, outputPer1k: 0.006 }, // GitHub Copilot aggregated average
    'default': { inputPer1k: 0.0015, outputPer1k: 0.0045 }
  };

  public static calculate(
    promptTokens: number,
    completionTokens: number,
    provider: string,
    model: string
  ): number {
    const key = this.resolvePricingKey(provider, model);
    const pricing = this.PRICING_TABLE[key] || this.PRICING_TABLE['default'];

    const inputCost = (promptTokens / 1000) * pricing.inputPer1k;
    const outputCost = (completionTokens / 1000) * pricing.outputPer1k;

    // Return cost rounded to 6 decimal places
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  private static resolvePricingKey(provider: string, model: string): string {
    const p = provider.toLowerCase();
    const m = model.toLowerCase();

    if (p.includes('copilot')) {
      return 'copilot/default';
    }

    if (p.includes('openai') || m.includes('gpt')) {
      if (m.includes('4o')) { return 'openai/gpt-4o'; }
      if (m.includes('turbo')) {
        return m.includes('4') ? 'openai/gpt-4-turbo' : 'openai/gpt-3.5-turbo';
      }
      return 'openai/gpt-4o'; // Default OpenAI
    }

    if (p.includes('anthropic') || p.includes('claude') || m.includes('claude')) {
      if (m.includes('sonnet')) { return 'anthropic/claude-3-5-sonnet'; }
      if (m.includes('opus')) { return 'anthropic/claude-3-opus'; }
      if (m.includes('haiku')) { return 'anthropic/claude-3-haiku'; }
      return 'anthropic/claude-3-5-sonnet'; // Default Claude
    }

    if (p.includes('google') || p.includes('gemini') || m.includes('gemini')) {
      if (m.includes('pro')) { return 'google/gemini-1.5-pro'; }
      return 'google/gemini-1.5-flash';
    }

    if (p.includes('llama') || m.includes('llama')) {
      if (m.includes('70b')) { return 'meta/llama-3-70b'; }
      return 'meta/llama-3-8b';
    }

    return 'default';
  }
}
