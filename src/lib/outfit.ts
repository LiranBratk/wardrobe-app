import { colorHarmony } from './color';
import { CATEGORIES, getCategory, STYLES, type Slot } from './taxonomy';
import { cosine } from './tagging';
import type { WardrobeItem } from './types';

export type TemperatureBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

export interface OutfitContext {
  temperature: TemperatureBand | null;
  rain: boolean;
  formality: number | null;
  mentionedCategories: string[];
  understood: string[];
}

export interface Outfit {
  key: string;
  itemIds: string[];
  score: number;
  reasons: string[];
}

export interface OutfitResult {
  outfits: Outfit[];
  context: OutfitContext;
  warnings: string[];
}

const TEMP_WORDS: [TemperatureBand, RegExp][] = [
  ['cold', /\b(cold|freezing|frosty|icy|snow(y|ing)?|winter)\b/],
  ['hot', /\b(hot|heat ?wave|scorching|sweltering|boiling|humid)\b/],
  ['cool', /\b(cool(?!\s+(vibe|look|outfit|style|fit))|chilly|crisp|brisk|breezy|windy|autumn(al)?)\b/],
  ['warm', /\b(warm|sunny|balmy|summer(y)?)\b/],
  ['mild', /\b(mild|spring|temperate)\b/]
];

const FORMALITY_WORDS: [number, RegExp][] = [
  [5, /\b(wedding|gala|black tie|formal|funeral|ceremony)\b/],
  [4, /\b(interview|business|meeting|presentation|conference|client)\b/],
  [3, /\b(office|work|date|dinner|smart|brunch|theat(er|re)|restaurant)\b/],
  [2, /\b(casual|errands?|coffee|shopping|friends|weekend|walk)\b/],
  [1, /\b(gym|workout|run(ning)?|hike|hiking|lazy|lounge|home|beach|cozy|cosy|comfy|sport(y)?)\b/]
];

export function temperatureFromCelsius(c: number): TemperatureBand {
  if (c >= 27) return 'hot';
  if (c >= 21) return 'warm';
  if (c >= 15) return 'mild';
  if (c >= 8) return 'cool';
  return 'cold';
}

export function parseContext(prompt: string): OutfitContext {
  const text = prompt.toLowerCase();
  const understood: string[] = [];
  let temperature: TemperatureBand | null = null;

  const degrees = /(-?\d{1,3})\s*(?:°\s*([cf])?|\s*deg(?:rees)?\s*([cf])?|([cf])\b)/.exec(text);
  if (degrees) {
    const value = Number(degrees[1]);
    const unit = degrees[2] ?? degrees[3] ?? degrees[4] ?? 'c';
    const celsius = unit === 'f' ? ((value - 32) * 5) / 9 : value;
    temperature = temperatureFromCelsius(celsius);
    understood.push(`${value}°${unit.toUpperCase()} → ${temperature}`);
  } else {
    for (const [band, re] of TEMP_WORDS) {
      if (re.test(text)) {
        temperature = band;
        understood.push(`${band} weather`);
        break;
      }
    }
  }

  const rain = /\b(rain(y|ing)?|drizzl(e|y|ing)|shower(s|y)?|storm(y)?|wet)\b/.test(text);
  if (rain) understood.push('rain');

  const levels = FORMALITY_WORDS.filter(([, re]) => re.test(text)).map(([level]) => level);
  const formality = levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null;
  if (formality !== null) understood.push(`formality ${formality}/5`);

  // Normalise "t-shirt" so the plain "shirt" keyword does not also match it.
  const garmentText = text.replace(/\bt-?shirt/g, 'tshirt').replace(/\bdress shoes?\b/g, 'dressshoes');
  const mentionedCategories = CATEGORIES.filter((c) =>
    c.keywords.some((k) => new RegExp(`\\b${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(e?s)?\\b`).test(garmentText))
  ).map((c) => c.id);
  if (mentionedCategories.length) understood.push(`mentions ${mentionedCategories.map((c) => getCategory(c).label.toLowerCase()).join(', ')}`);

  return { temperature, rain, formality, mentionedCategories, understood };
}

const TARGET_WARMTH: Record<TemperatureBand, number> = { hot: 1, warm: 1, mild: 2, cool: 2, cold: 3 };

function keywordScore(item: WardrobeItem, words: string[]): number {
  if (!words.length) return 0;
  const haystack = [
    item.name,
    item.notes,
    getCategory(item.category).label,
    ...item.colors.map((c) => c.name),
    ...item.styles.map((s) => STYLES.find((x) => x.id === s)?.label ?? s),
    item.pattern
  ]
    .join(' ')
    .toLowerCase();
  const hits = words.filter((w) => w.length > 2 && haystack.includes(w)).length;
  return Math.min(1, hits * 0.5);
}

function itemFit(item: WardrobeItem, ctx: OutfitContext): { score: number; note?: string } {
  const cat = getCategory(item.category);
  let score = 0;
  let note: string | undefined;
  if (ctx.temperature && cat.slot !== 'accessory') {
    const target = TARGET_WARMTH[ctx.temperature];
    score -= 0.6 * Math.abs(item.warmth - target);
    const exposed = ['shorts', 'sandals', 'skirt', 'tank'].includes(cat.id);
    if (exposed && ctx.temperature === 'cold') score -= 1.5;
    if (exposed && ctx.temperature === 'cool') score -= 0.8;
    if (cat.id === 'shorts' && (ctx.temperature === 'hot' || ctx.temperature === 'warm')) score += 0.3;
  }
  if (ctx.rain && cat.id === 'sandals') score -= 1;
  if (ctx.rain && cat.id === 'boots') {
    score += 0.4;
    note = 'boots for the rain';
  }
  if (ctx.formality !== null) score -= 0.5 * Math.abs(item.formality - ctx.formality);
  return { score, note };
}

function zScores(values: (number | null)[]): number[] {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return values.map(() => 0);
  const mean = present.reduce((a, b) => a + b, 0) / present.length;
  const sd = Math.sqrt(present.reduce((a, b) => a + (b - mean) ** 2, 0) / present.length) || 1;
  return values.map((v) => (v === null ? 0 : (v - mean) / sd));
}

function stdev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
}

export function validateOutfit(itemIds: string[], inventory: WardrobeItem[]): boolean {
  const byId = new Map(inventory.map((i) => [i.id, i]));
  if (new Set(itemIds).size !== itemIds.length) return false;
  const slots = new Map<Slot, number>();
  for (const id of itemIds) {
    const item = byId.get(id);
    if (!item) return false;
    const slot = getCategory(item.category).slot;
    slots.set(slot, (slots.get(slot) ?? 0) + 1);
  }
  const has = (s: Slot) => (slots.get(s) ?? 0) > 0;
  for (const [slot, count] of slots) if (slot !== 'accessory' && count > 1) return false;
  if (has('onepiece') && (has('top') || has('bottom'))) return false;
  return has('onepiece') || (has('top') && has('bottom'));
}

export interface SuggestOptions {
  prompt: string;
  promptEmbedding: Float32Array | null;
  anchorId: string | null;
  inventory: WardrobeItem[];
  limit?: number;
}

export function suggestOutfits({ prompt, promptEmbedding, anchorId, inventory, limit = 3 }: SuggestOptions): OutfitResult {
  const ctx = parseContext(prompt);
  const warnings: string[] = [];
  const anchor = anchorId ? inventory.find((i) => i.id === anchorId) ?? null : null;
  if (anchorId && !anchor) warnings.push('The selected anchor item no longer exists.');

  const words = prompt.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
  const raw = inventory.map((i) => (promptEmbedding && i.embedding ? cosine(i.embedding, promptEmbedding) : null));
  const z = zScores(raw);
  const scored = inventory.map((item, idx) => {
    const fit = itemFit(item, ctx);
    const vibe = z[idx] + keywordScore(item, words);
    return { item, slot: getCategory(item.category).slot, vibe, fit: fit.score, fitNote: fit.note, total: vibe + fit.score };
  });
  type Scored = (typeof scored)[number];
  const byId = new Map(scored.map((s) => [s.item.id, s]));

  const mentioned = anchor ? [] : ctx.mentionedCategories.filter((c) => inventory.some((i) => i.category === c));
  const mentionedSlots = new Set(mentioned.map((c) => getCategory(c).slot));
  const pool = (slot: Slot, n = 6): Scored[] => {
    if (anchor && getCategory(anchor.category).slot === slot) return [byId.get(anchor.id)!];
    let list = scored.filter((s) => s.slot === slot);
    if (mentionedSlots.has(slot)) list = list.filter((s) => mentioned.includes(s.item.category));
    return list.sort((a, b) => b.total - a.total).slice(0, n);
  };

  const tops = pool('top');
  const bottoms = pool('bottom');
  const onepieces = pool('onepiece');
  const shoes = pool('shoes');
  const outer = pool('outerwear');
  const accessories = pool('accessory', 3);

  const anchorSlot = anchor ? getCategory(anchor.category).slot : null;
  const useSeparates = anchorSlot !== 'onepiece' && !mentionedSlots.has('onepiece') && tops.length > 0 && bottoms.length > 0;
  const useOnepiece = anchorSlot !== 'top' && anchorSlot !== 'bottom' && !mentionedSlots.has('top') && !mentionedSlots.has('bottom') && onepieces.length > 0;
  if (!useSeparates && !useOnepiece) {
    warnings.push('Add at least one top and one bottom (or a dress/jumpsuit) to get outfit suggestions.');
    return { outfits: [], context: ctx, warnings };
  }
  if (!shoes.length) warnings.push('No shoes in your closet yet, so outfits skip shoes.');

  const forceOuter = anchorSlot === 'outerwear' || mentionedSlots.has('outerwear');
  const needOuter = forceOuter || ctx.temperature === 'cool' || ctx.temperature === 'cold' || ctx.rain;
  const banOuter = !forceOuter && ctx.temperature === 'hot';
  if (needOuter && !outer.length) warnings.push('No jackets or coats in your closet for this weather.');
  const outerOptions: (Scored | null)[] = banOuter ? [null] : needOuter && outer.length ? outer : [null, ...outer.slice(0, 3)];
  const forceAccessory = anchorSlot === 'accessory' || mentionedSlots.has('accessory');
  const accessoryOptions: (Scored | null)[] =
    forceAccessory && accessories.length ? accessories : [null, ...accessories.filter((a) => a.total > 0.6).slice(0, 1)];

  const bases: Scored[][] = [];
  if (useSeparates) for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  if (useOnepiece) for (const o of onepieces) bases.push([o]);

  const combos: { parts: Scored[]; score: number; harmonyNote: string }[] = [];
  for (const base of bases) {
    for (const s of shoes.length ? shoes : [null]) {
      for (const o of outerOptions) {
        for (const a of accessoryOptions) {
          const parts = [...base, s, o, a].filter((p): p is Scored => p !== null);
          const core = parts.filter((p) => p.slot !== 'accessory');
          const itemScore = core.reduce((sum, p) => sum + p.total, 0) / core.length;
          const harmony = colorHarmony(core.map((p) => p.item.colors[0]?.name ?? 'grey'));
          const patterns = core.filter((p) => p.item.pattern !== 'solid').length;
          const patternPenalty = Math.max(0, patterns - 1) * 0.5;
          const formalitySpread = stdev(core.map((p) => p.item.formality));
          let score = itemScore + harmony.score * 0.6 - patternPenalty - formalitySpread * 0.3;
          if (o && !needOuter && ctx.temperature === 'warm') score -= 0.5;
          if (a) score += 0.1;
          combos.push({ parts, score, harmonyNote: harmony.note });
        }
      }
    }
  }
  combos.sort((a, b) => b.score - a.score);

  const picked: typeof combos = [];
  for (const combo of combos) {
    const ids = new Set(combo.parts.map((p) => p.item.id));
    const distinct = picked.every((p) => {
      const shared = p.parts.filter((x) => ids.has(x.item.id)).length;
      return Math.max(p.parts.length, combo.parts.length) - shared >= (combo.parts.length <= 2 ? 1 : 2);
    });
    if (distinct) picked.push(combo);
    if (picked.length >= limit) break;
  }

  const outfits: Outfit[] = picked
    .map((combo) => {
      const reasons: string[] = [];
      if (anchor) reasons.push(`Built around your ${anchor.name}.`);
      const bestVibe = [...combo.parts].sort((a, b) => b.vibe - a.vibe)[0];
      if (prompt.trim() && bestVibe && bestVibe.vibe > 0.4 && bestVibe.item.id !== anchor?.id) {
        reasons.push(`${bestVibe.item.name} is the closest match to “${prompt.trim().slice(0, 60)}”.`);
      }
      const outerPart = combo.parts.find((p) => p.slot === 'outerwear');
      if (ctx.temperature === 'hot') reasons.push('Light pieces for hot weather.');
      else if (outerPart && (ctx.temperature === 'cool' || ctx.temperature === 'cold' || ctx.rain)) {
        reasons.push(`${outerPart.item.name} for ${ctx.rain ? 'the rain' : `${ctx.temperature} weather`}.`);
      }
      const fitNote = combo.parts.find((p) => p.fitNote)?.fitNote;
      if (fitNote) reasons.push(`Includes ${fitNote}.`);
      reasons.push(`Colours: ${combo.harmonyNote}.`);
      if (ctx.formality !== null) reasons.push(`Pitched at formality ${ctx.formality}/5.`);
      const itemIds = combo.parts.map((p) => p.item.id);
      return { key: itemIds.join('|'), itemIds, score: Math.round(combo.score * 100) / 100, reasons };
    })
    .filter((o) => validateOutfit(o.itemIds, inventory));

  return { outfits, context: ctx, warnings };
}
