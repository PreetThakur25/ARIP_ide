export interface TokenEstimate {
  tokens: number;
  confidence: number; // 0.0 to 1.0 representation
}

export interface ITokenizer {
  countTokens(text: string): TokenEstimate;
}

export class TokenEstimationEngine {
  private static instance: TokenEstimationEngine;
  private tokenizers: Map<string, ITokenizer> = new Map();

  private constructor() {
    // Register tokenizers on initialization
    this.registerTokenizer('openai', new BPETokenizer('openai'));
    this.registerTokenizer('anthropic', new BPETokenizer('anthropic'));
    this.registerTokenizer('gemini', new HeuristicTokenizer('gemini'));
    this.registerTokenizer('llama', new HeuristicTokenizer('llama'));
    this.registerTokenizer('default', new HeuristicTokenizer('default'));
  }

  public static getInstance(): TokenEstimationEngine {
    if (!TokenEstimationEngine.instance) {
      TokenEstimationEngine.instance = new TokenEstimationEngine();
    }
    return TokenEstimationEngine.instance;
  }

  public registerTokenizer(name: string, tokenizer: ITokenizer): void {
    this.tokenizers.set(name.toLowerCase(), tokenizer);
  }

  public estimate(text: string, provider: string, _model: string): TokenEstimate {
    if (!text) {
      return { tokens: 0, confidence: 1.0 };
    }

    const providerKey = this.resolveProviderKey(provider);
    const tokenizer = this.tokenizers.get(providerKey) || this.tokenizers.get('default')!;
    
    return tokenizer.countTokens(text);
  }

  private resolveProviderKey(provider: string): string {
    const p = provider.toLowerCase();
    if (p.includes('copilot') || p.includes('openai') || p.includes('cursor')) {
      return 'openai';
    }
    if (p.includes('claude') || p.includes('anthropic') || p.includes('continue')) {
      return 'anthropic';
    }
    if (p.includes('gemini') || p.includes('google')) {
      return 'gemini';
    }
    if (p.includes('llama') || p.includes('meta') || p.includes('ollama')) {
      return 'llama';
    }
    return 'default';
  }
}

// Forward declarations to avoid cyclic imports
import { BPETokenizer } from './bpeTokenizer';
import { HeuristicTokenizer } from './heuristicTokenizer';
