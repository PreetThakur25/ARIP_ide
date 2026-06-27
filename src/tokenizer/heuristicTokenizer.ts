import { ITokenizer, TokenEstimate } from './tokenizerAbstraction';

export class HeuristicTokenizer implements ITokenizer {
  private type: string;

  constructor(type: string) {
    this.type = type;
  }

  public countTokens(text: string): TokenEstimate {
    if (!text || text.trim() === '') {
      return { tokens: 0, confidence: 1.0 };
    }

    const totalChars = text.length;
    
    // Count specific occurrences that increase token count in code
    const bracketsAndOperators = (text.match(/[{}\[\]()+\-*/%=&|^!~<>:;?,.]/g) || []).length;
    const whitespaces = (text.match(/\s/g) || []).length;
    const words = (text.match(/[a-zA-Z0-9]+/g) || []).length;

    let tokenGuess = 0;

    if (this.type === 'gemini') {
      // Gemini has a slightly larger context vocabulary, averages ~4.0 chars per token in code
      tokenGuess = Math.ceil(totalChars / 4.0) + Math.ceil(bracketsAndOperators / 2);
    } else if (this.type === 'llama') {
      // Llama tokenizer treats spaces and code symbols with higher token divisions
      tokenGuess = Math.ceil(words * 1.1) + bracketsAndOperators + Math.ceil(whitespaces / 3);
    } else {
      // Fallback standard code tokenizer
      tokenGuess = Math.ceil((totalChars - whitespaces) / 3.4) + Math.ceil(whitespaces / 4) + Math.ceil(bracketsAndOperators / 2);
    }

    // Ensure we return at least 1 token if there was content
    tokenGuess = Math.max(1, tokenGuess);

    return {
      tokens: tokenGuess,
      confidence: 0.75 // Lower confidence due to heuristic nature
    };
  }
}
