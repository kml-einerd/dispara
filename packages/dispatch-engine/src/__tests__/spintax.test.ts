import { describe, it, expect } from 'vitest';
import {
  spinText,
  generateVariations,
  countVariations,
  applyAntiDetection,
} from '../spintax.js';

describe('spinText', () => {
  it('resolves simple {a|b|c} to one of the options', () => {
    const options = new Set<string>();
    for (let i = 0; i < 100; i++) {
      options.add(spinText('{a|b|c}'));
    }
    // Should only produce a, b, or c
    for (const val of options) {
      expect(['a', 'b', 'c']).toContain(val);
    }
    // With 100 iterations, should hit at least 2 options
    expect(options.size).toBeGreaterThanOrEqual(2);
  });

  it('handles nested {Hi|Hello {world|earth}}', () => {
    const options = new Set<string>();
    for (let i = 0; i < 200; i++) {
      options.add(spinText('{Hi|Hello {world|earth}}'));
    }
    const valid = ['Hi', 'Hello world', 'Hello earth'];
    for (const val of options) {
      expect(valid).toContain(val);
    }
    expect(options.size).toBeGreaterThanOrEqual(2);
  });

  it('handles empty options {|b|}', () => {
    const options = new Set<string>();
    for (let i = 0; i < 100; i++) {
      options.add(spinText('{|b|}'));
    }
    // Should produce '', 'b', or ''
    for (const val of options) {
      expect(['', 'b']).toContain(val);
    }
  });

  it('passes through text with no spintax', () => {
    const input = 'Hello world, no spintax here.';
    expect(spinText(input)).toBe(input);
  });

  it('handles unbalanced braces gracefully', () => {
    // Unmatched opening brace - should not throw
    const result1 = spinText('Hello {world');
    expect(typeof result1).toBe('string');

    // Unmatched closing brace - should not throw
    const result2 = spinText('Hello world}');
    expect(typeof result2).toBe('string');

    // Just braces
    const result3 = spinText('{}');
    expect(typeof result3).toBe('string');
  });
});

describe('generateVariations', () => {
  it('returns N unique strings', () => {
    const template = '{a|b|c} {x|y}';
    const variations = generateVariations(template, 5);
    expect(variations).toHaveLength(5);
    const unique = new Set(variations);
    expect(unique.size).toBe(5);
  });

  it('throws when N > possible variations', () => {
    const template = '{a|b}'; // only 2 possible
    expect(() => generateVariations(template, 3)).toThrow(
      /Cannot generate 3 unique variations/
    );
  });
});

describe('countVariations', () => {
  it('calculates correctly for simple template', () => {
    expect(countVariations('{a|b|c}')).toBe(3);
  });

  it('calculates correctly for multiple blocks', () => {
    // {a|b} {x|y} = 2 * 2 = 4
    expect(countVariations('{a|b} {x|y}')).toBe(4);
  });

  it('calculates correctly for nested template', () => {
    // {Hi|Hello {world|earth}} resolves innermost first:
    // {world|earth} → 2 substitutions → {Hi|Hello world} and {Hi|Hello earth}
    // Each outer block has 2 options → 2 + 2 = 4 total paths
    expect(countVariations('{Hi|Hello {world|earth}}')).toBe(4);
  });

  it('returns 1 for plain text (no spintax)', () => {
    expect(countVariations('Hello world')).toBe(1);
  });
});

describe('applyAntiDetection', () => {
  it('modifies text (is not identical to input) over many runs', () => {
    const input = 'Achei uma oferta incrível! Confira o preço barato...';
    let modified = false;
    for (let i = 0; i < 50; i++) {
      const result = applyAntiDetection(input);
      if (result !== input) {
        modified = true;
        break;
      }
    }
    expect(modified).toBe(true);
  });

  it('preserves semantic meaning (does not destroy content)', () => {
    const input = 'Achei uma oferta incrível!';
    const result = applyAntiDetection(input);
    // Result should still have some recognizable words
    // At minimum, it should not be empty
    expect(result.length).toBeGreaterThan(0);
    // Should still contain at least "uma" (not in synonym map)
    expect(result).toContain('uma');
  });

  it('inserts zero-width chars (\\u200B) in at least some runs', () => {
    const input = 'Teste de texto com varias palavras para anti deteccao';
    let foundZeroWidth = false;
    for (let i = 0; i < 100; i++) {
      const result = applyAntiDetection(input);
      if (result.includes('\u200B')) {
        foundZeroWidth = true;
        break;
      }
    }
    expect(foundZeroWidth).toBe(true);
  });
});
