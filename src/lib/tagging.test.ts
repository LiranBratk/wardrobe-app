import { describe, expect, it } from 'vitest';
import { CATEGORIES, PATTERNS, STYLES } from './taxonomy';
import { suggestTags, type LabelBank } from './tagging';

function oneHot(size: number, index: number): Float32Array {
  const v = new Float32Array(size);
  v[index] = 1;
  return v;
}

describe('suggestTags', () => {
  it('picks the closest label in each group', () => {
    const dims = 64;
    const shortsIndex = CATEGORIES.findIndex((c) => c.id === 'shorts');
    const bank: LabelBank = {
      key: 'test',
      categories: CATEGORIES.map((_, i) => oneHot(dims, i)),
      patterns: PATTERNS.map((_, i) => oneHot(dims, 30 + i)),
      styles: STYLES.map((_, i) => oneHot(dims, 40 + i)),
      warmth: [oneHot(dims, 50), oneHot(dims, 51)]
    };
    const image = new Float32Array(dims);
    image[shortsIndex] = 1;
    image[30 + 1] = 0.3;
    image[40 + 3] = 0.4;
    image[50] = 0.5;
    const tags = suggestTags(image, bank);
    expect(tags.category).toBe('shorts');
    expect(tags.pattern).toBe('striped');
    expect(tags.styles[0]).toBe('sporty');
    expect(tags.warmth).toBe(1);
    expect(tags.formality).toBeGreaterThanOrEqual(1);
  });
});
