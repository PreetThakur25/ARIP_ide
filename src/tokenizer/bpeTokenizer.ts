import { ITokenizer, TokenEstimate } from './tokenizerAbstraction';

export class BPETokenizer implements ITokenizer {
  private provider: string;

  constructor(provider: string) {
    this.provider = provider;
  }

  public countTokens(text: string): TokenEstimate {
    if (!text || text.trim() === '') {
      return { tokens: 0, confidence: 1.0 };
    }

    // Modern BPE tokenization regex (GPT-4 / Claude like splitting)
    const regex = /'s|'t|'re|'ve|'m|'ll|'d| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\a-zA-Z0-9]+|\s+(?!\S)|\s+/g;
    const matches = text.match(regex) || [];

    let totalTokens = 0;

    for (const match of matches) {
      // 1. Indentation logic: count multiple tabs/spaces
      if (/^\s+$/.test(match)) {
        const spaces = match.length;
        if (match.includes('\t')) {
          totalTokens += match.split('\t').length - 1;
        } else {
          // Typically 4 spaces = 1 token, remainder counts as 1
          totalTokens += Math.max(1, Math.ceil(spaces / 4));
        }
        continue;
      }

      const cleanMatch = match.trim();
      if (cleanMatch === '') {
        totalTokens += 1;
        continue;
      }

      // 2. Keywords logic: common TS/JS/Python keywords are usually 1 token
      const commonKeywords = /^(function|const|let|var|return|import|export|class|interface|type|default|from|public|private|protected|async|await|if|else|for|while|switch|case|break|continue|null|undefined|true|false|void|this|new|throw|try|catch|finally)$/;
      if (commonKeywords.test(cleanMatch)) {
        totalTokens += 1;
        continue;
      }

      // 3. Length-based BPE subdivision: words are split into sub-tokens
      const len = cleanMatch.length;
      if (len <= 4) {
        totalTokens += 1;
      } else if (len <= 8) {
        totalTokens += 2;
      } else {
        // Source code identifiers are longer, estimate ~3.5 chars per token
        totalTokens += Math.ceil(len / 3.5);
      }
    }

    // Slightly adjust confidence based on the complexity of the text
    const confidence = this.provider === 'openai' ? 0.90 : 0.85;

    return {
      tokens: totalTokens,
      confidence
    };
  }
}
