import type { ItemColor } from './types';

type RGB = [number, number, number];
type Lab = [number, number, number];

interface NamedColor {
  name: string;
  rgb: RGB;
  neutral: boolean;
}

export const NAMED_COLORS: NamedColor[] = [
  { name: 'black', rgb: [20, 20, 22], neutral: true },
  { name: 'charcoal', rgb: [60, 62, 66], neutral: true },
  { name: 'grey', rgb: [128, 128, 128], neutral: true },
  { name: 'light grey', rgb: [196, 196, 196], neutral: true },
  { name: 'white', rgb: [244, 244, 240], neutral: true },
  { name: 'cream', rgb: [238, 228, 205], neutral: true },
  { name: 'beige', rgb: [210, 190, 160], neutral: true },
  { name: 'khaki', rgb: [175, 160, 115], neutral: true },
  { name: 'tan', rgb: [190, 145, 100], neutral: true },
  { name: 'brown', rgb: [110, 72, 45], neutral: true },
  { name: 'navy', rgb: [30, 40, 80], neutral: true },
  { name: 'denim', rgb: [75, 100, 140], neutral: true },
  { name: 'slate', rgb: [70, 90, 108], neutral: true },
  { name: 'light blue', rgb: [160, 195, 225], neutral: false },
  { name: 'blue', rgb: [40, 90, 190], neutral: false },
  { name: 'teal', rgb: [20, 120, 120], neutral: false },
  { name: 'green', rgb: [50, 140, 70], neutral: false },
  { name: 'olive', rgb: [100, 105, 50], neutral: true },
  { name: 'yellow', rgb: [235, 200, 50], neutral: false },
  { name: 'mustard', rgb: [200, 155, 40], neutral: false },
  { name: 'orange', rgb: [230, 120, 40], neutral: false },
  { name: 'red', rgb: [200, 35, 40], neutral: false },
  { name: 'burgundy', rgb: [110, 25, 40], neutral: false },
  { name: 'pink', rgb: [235, 160, 185], neutral: false },
  { name: 'purple', rgb: [110, 60, 150], neutral: false },
  { name: 'lavender', rgb: [185, 165, 215], neutral: false }
];

const namedLab = NAMED_COLORS.map((c) => ({ ...c, lab: rgbToLab(c.rgb) }));
const namedIndex = new Map(NAMED_COLORS.map((c) => [c.name, c]));

export const COLOR_NAMES = NAMED_COLORS.map((c) => c.name);

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDistance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function fromHex(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function nearestColorName(rgb: RGB): string {
  const lab = rgbToLab(rgb);
  let best = namedLab[0];
  let bestDistance = Infinity;
  for (const c of namedLab) {
    const d = labDistance(lab, c.lab);
    if (d < bestDistance) {
      bestDistance = d;
      best = c;
    }
  }
  return best.name;
}

export function isNeutralColor(name: string): boolean {
  return namedIndex.get(name)?.neutral ?? true;
}

export function colorHue(name: string): number | null {
  const c = namedIndex.get(name);
  if (!c || c.neutral) return null;
  const [r, g, b] = c.rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Estimates the garment's main colours from RGBA pixels. Pixels that resemble the photo border
 * (assumed to be background) are excluded unless that would discard almost everything.
 */
export function dominantColors(pixels: Uint8ClampedArray, width: number, height: number, maxColors = 3): ItemColor[] {
  const border: RGB[] = [];
  const all: RGB[] = [];
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.04));
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 6000)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 128) continue;
      const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (x < ring || y < ring || x >= width - ring || y >= height - ring) border.push(rgb);
      else all.push(rgb);
    }
  }
  if (all.length === 0) all.push(...border);
  if (all.length === 0) return [];

  let samples = all;
  if (border.length > 0) {
    const bg = rgbToLab([median(border.map((p) => p[0])), median(border.map((p) => p[1])), median(border.map((p) => p[2]))]);
    const foreground = all.filter((p) => labDistance(rgbToLab(p), bg) > 14);
    if (foreground.length >= all.length * 0.12) samples = foreground;
  }

  const labs = samples.map(rgbToLab);
  const k = Math.min(4, labs.length);
  const centers: Lab[] = [labs[Math.floor(labs.length / 2)]];
  while (centers.length < k) {
    let farIndex = 0;
    let farDistance = -1;
    labs.forEach((p, idx) => {
      const d = Math.min(...centers.map((c) => labDistance(p, c)));
      if (d > farDistance) {
        farDistance = d;
        farIndex = idx;
      }
    });
    centers.push(labs[farIndex]);
  }

  const assignment = new Array<number>(labs.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    labs.forEach((p, idx) => {
      let best = 0;
      let bestDistance = Infinity;
      centers.forEach((c, ci) => {
        const d = labDistance(p, c);
        if (d < bestDistance) {
          bestDistance = d;
          best = ci;
        }
      });
      assignment[idx] = best;
    });
    centers.forEach((_, ci) => {
      const members = labs.filter((_, idx) => assignment[idx] === ci);
      if (members.length === 0) return;
      centers[ci] = [0, 1, 2].map((ch) => members.reduce((sum, m) => sum + m[ch], 0) / members.length) as Lab;
    });
  }

  const clusters = centers.map((_, ci) => {
    const members = samples.filter((_, idx) => assignment[idx] === ci);
    const rgb = [0, 1, 2].map((ch) => (members.length ? members.reduce((s, m) => s + m[ch], 0) / members.length : 0)) as RGB;
    return { rgb, share: members.length / samples.length };
  });

  const byName = new Map<string, ItemColor>();
  for (const c of clusters.sort((a, b) => b.share - a.share)) {
    if (c.share < 0.08) continue;
    const name = nearestColorName(c.rgb);
    const existing = byName.get(name);
    if (existing) existing.share += c.share;
    else byName.set(name, { name, hex: toHex(c.rgb), share: c.share });
  }
  return [...byName.values()]
    .sort((a, b) => b.share - a.share)
    .slice(0, maxColors)
    .map((c) => ({ ...c, share: Math.round(c.share * 100) / 100 }));
}

/** Scores how well a set of primary colour names work together; roughly -1 (clash) to 1 (harmonious). */
export function colorHarmony(names: string[]): { score: number; note: string } {
  const accents = [...new Set(names.filter((n) => !isNeutralColor(n)))];
  if (accents.length === 0) return { score: 0.6, note: 'neutral palette' };
  if (accents.length === 1) return { score: 1, note: `${accents[0]} accent on neutrals` };
  const hues = accents.map(colorHue).filter((h): h is number => h !== null);
  if (accents.length === 2 && hues.length === 2) {
    const diff = Math.min(Math.abs(hues[0] - hues[1]), 360 - Math.abs(hues[0] - hues[1]));
    if (diff <= 45) return { score: 0.7, note: `analogous ${accents.join(' and ')}` };
    if (diff >= 150) return { score: 0.4, note: `contrasting ${accents.join(' and ')}` };
    return { score: -0.4, note: `${accents.join(' and ')} may compete` };
  }
  return { score: -0.8, note: `${accents.length} accent colours` };
}
