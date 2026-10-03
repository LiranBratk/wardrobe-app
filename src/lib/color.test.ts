import { describe, expect, it } from 'vitest';
import { colorHarmony, dominantColors, nearestColorName } from './color';

function solidImage(width: number, height: number, fill: [number, number, number], inner?: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = inner && x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;
      const [r, g, b] = inside ? inner : fill;
      const i = (y * width + x) * 4;
      data.set([r, g, b, 255], i);
    }
  }
  return data;
}

describe('nearestColorName', () => {
  it('maps common garment colours', () => {
    expect(nearestColorName([18, 18, 20])).toBe('black');
    expect(nearestColorName([250, 250, 248])).toBe('white');
    expect(nearestColorName([28, 38, 78])).toBe('navy');
    expect(nearestColorName([205, 30, 35])).toBe('red');
  });
});

describe('dominantColors', () => {
  it('ignores a plain background that matches the border', () => {
    const pixels = solidImage(100, 100, [245, 245, 242], [30, 40, 80]);
    const colors = dominantColors(pixels, 100, 100);
    expect(colors[0].name).toBe('navy');
  });

  it('falls back to all pixels when the garment fills the frame', () => {
    const pixels = solidImage(60, 60, [200, 35, 40]);
    expect(dominantColors(pixels, 60, 60)[0].name).toBe('red');
  });
});

describe('colorHarmony', () => {
  it('prefers a single accent on neutrals over clashing accents', () => {
    expect(colorHarmony(['navy', 'white', 'red']).score).toBeGreaterThan(colorHarmony(['red', 'green', 'purple']).score);
    expect(colorHarmony(['black', 'grey']).note).toBe('neutral palette');
  });
});
