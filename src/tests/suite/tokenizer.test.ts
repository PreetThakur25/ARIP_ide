import * as assert from 'assert';
import { TokenEstimationEngine } from '../../tokenizer/tokenizerAbstraction';

suite('Tokenizer Test Suite', () => {
  test('OpenAI Tokenizer Code Counting Heuristic', () => {
    const engine = TokenEstimationEngine.getInstance();
    
    // Sample JS code block
    const code = 'const x = 5;\nfunction test() {\n    return x;\n}';
    
    // Estimate using OpenAI
    const estimate = engine.estimate(code, 'openai', 'gpt-4o');
    
    assert.strictEqual(typeof estimate.tokens, 'number');
    assert.strictEqual(estimate.tokens > 5, true);
    assert.strictEqual(estimate.confidence >= 0.85, true);
  });

  test('Gemini Fallback Calculations', () => {
    const engine = TokenEstimationEngine.getInstance();
    const code = 'const hello = "world";';

    const estimate = engine.estimate(code, 'gemini', 'gemini-1.5-pro');
    
    assert.strictEqual(typeof estimate.tokens, 'number');
    assert.strictEqual(estimate.tokens > 0, true);
    assert.strictEqual(estimate.confidence, 0.75);
  });

  test('Empty string token estimation', () => {
    const engine = TokenEstimationEngine.getInstance();
    const estimate = engine.estimate('', 'openai', 'gpt-4o');
    assert.strictEqual(estimate.tokens, 0);
    assert.strictEqual(estimate.confidence, 1.0);
  });
});
