import { CATEGORIES, PATTERNS, STYLES, getCategory, type PatternId, type StyleId } from './taxonomy';

export interface LabelBank {
  key: string;
  categories: Float32Array[];
  patterns: Float32Array[];
  styles: Float32Array[];
  warmth: Float32Array[];
}

export interface TagSuggestion {
  category: string;
  categoryScores: { id: string; score: number }[];
  pattern: PatternId;
  styles: StyleId[];
  warmth: 1 | 2 | 3;
  formality: number;
}

const LOGIT_SCALE = 100;

export const WARMTH_PROMPTS = ['a photo of a thin lightweight summer garment', 'a photo of a thick warm winter garment'];

export function labelPrompts() {
  return {
    categories: CATEGORIES.map((c) => `a photo of ${c.prompt}`),
    patterns: PATTERNS.map((p) => `a photo of ${p.prompt}`),
    styles: STYLES.map((s) => `a photo of ${s.prompt}`),
    warmth: WARMTH_PROMPTS
  };
}

export function labelBankKey(modelKey: string): string {
  return `${modelKey}:${JSON.stringify(labelPrompts())}`;
}

export function normalize(vector: ArrayLike<number>): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
  return out;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

export function softmaxScores(image: Float32Array, labels: Float32Array[]): number[] {
  const logits = labels.map((l) => cosine(image, l) * LOGIT_SCALE);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function suggestTags(image: Float32Array, bank: LabelBank): TagSuggestion {
  const catScores = softmaxScores(image, bank.categories)
    .map((score, i) => ({ id: CATEGORIES[i].id, score }))
    .sort((a, b) => b.score - a.score);
  const category = getCategory(catScores[0].id);

  const patternScores = softmaxScores(image, bank.patterns);
  const pattern = PATTERNS[patternScores.indexOf(Math.max(...patternScores))].id;

  const styleScores = softmaxScores(image, bank.styles)
    .map((score, i) => ({ style: STYLES[i], score }))
    .sort((a, b) => b.score - a.score);
  const styles = styleScores.filter((s, i) => i === 0 || (i === 1 && s.score >= 0.2)).map((s) => s.style);

  const [light, warm] = softmaxScores(image, bank.warmth);
  const warmth: 1 | 2 | 3 = light >= 0.75 ? 1 : warm >= 0.75 ? 3 : category.warmth;

  const styleFormality = styles.reduce((sum, s) => sum + s.formality, 0) / styles.length;
  const formality = Math.max(1, Math.min(5, Math.round((category.formality + styleFormality) / 2)));

  return {
    category: category.id,
    categoryScores: catScores.slice(0, 3),
    pattern,
    styles: styles.map((s) => s.id),
    warmth,
    formality
  };
}
