import { describe, expect, it } from 'vitest';
import { parseContext, suggestOutfits, validateOutfit } from './outfit';
import type { WardrobeItem } from './types';

let seq = 0;
function item(category: string, overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  seq += 1;
  return {
    id: `id-${seq}`,
    schemaVersion: 1,
    name: `${category} ${seq}`,
    category,
    colors: [{ name: 'black', hex: '#141416', share: 1 }],
    pattern: 'solid',
    styles: ['casual'],
    warmth: 2,
    formality: 2,
    notes: '',
    image: new Blob(['x']),
    embedding: null,
    embeddingModel: null,
    createdAt: seq,
    updatedAt: seq,
    ...overrides
  };
}

describe('parseContext', () => {
  it('understands the owner example prompt', () => {
    const ctx = parseContext('the vibe today is this jacket and its quite cool today');
    expect(ctx.temperature).toBe('cool');
    expect(ctx.mentionedCategories).toEqual(['jacket']);
  });

  it('reads explicit temperatures in C and F', () => {
    expect(parseContext('about 30°C and sunny').temperature).toBe('hot');
    expect(parseContext('40F outside').temperature).toBe('cold');
  });

  it('does not treat a "cool look" as weather', () => {
    expect(parseContext('a cool look for a party').temperature).toBeNull();
  });

  it('keeps t-shirt and shirt apart and handles plurals', () => {
    expect(parseContext('my favourite t-shirt').mentionedCategories).toEqual(['tshirt']);
    expect(parseContext('a shirt with boots').mentionedCategories).toEqual(['shirt', 'boots']);
    expect(parseContext('dress shoes for a wedding').mentionedCategories).toEqual(['dressshoes']);
  });

  it('detects rain and formality', () => {
    const ctx = parseContext('rainy job interview');
    expect(ctx.rain).toBe(true);
    expect(ctx.formality).toBe(4);
  });
});

describe('suggestOutfits', () => {
  const tee = item('tshirt', { warmth: 1 });
  const sweater = item('sweater', { warmth: 3 });
  const jeans = item('jeans');
  const shorts = item('shorts', { warmth: 1 });
  const sneakers = item('sneakers');
  const jacketA = item('jacket', { name: 'Denim jacket' });
  const jacketB = item('jacket', { name: 'Bomber jacket' });
  const coat = item('coat', { warmth: 3 });
  const inventory = [tee, sweater, jeans, shorts, sneakers, jacketA, jacketB, coat];

  it('only returns valid outfits made of inventory items', () => {
    const result = suggestOutfits({ prompt: 'cool day', promptEmbedding: null, anchorId: null, inventory });
    expect(result.outfits.length).toBeGreaterThan(0);
    for (const outfit of result.outfits) {
      expect(validateOutfit(outfit.itemIds, inventory)).toBe(true);
      expect(outfit.itemIds.every((id) => inventory.some((i) => i.id === id))).toBe(true);
    }
  });

  it('adds outerwear and avoids shorts when it is cool', () => {
    const [best] = suggestOutfits({ prompt: 'quite cool today', promptEmbedding: null, anchorId: null, inventory }).outfits;
    expect(best.itemIds).not.toContain(shorts.id);
    expect(best.itemIds.some((id) => [jacketA.id, jacketB.id, coat.id].includes(id))).toBe(true);
  });

  it('builds every outfit around the anchor', () => {
    const result = suggestOutfits({ prompt: 'this jacket', promptEmbedding: null, anchorId: jacketB.id, inventory });
    expect(result.outfits.every((o) => o.itemIds.includes(jacketB.id))).toBe(true);
    expect(result.outfits[0].reasons[0]).toContain('Bomber jacket');
  });

  it('restricts to a mentioned category when there is no anchor', () => {
    const result = suggestOutfits({ prompt: 'the vibe today is this jacket', promptEmbedding: null, anchorId: null, inventory });
    expect(result.outfits.every((o) => o.itemIds.some((id) => id === jacketA.id || id === jacketB.id))).toBe(true);
  });

  it('skips outerwear and prefers shorts in hot weather', () => {
    const [best] = suggestOutfits({ prompt: '32C heatwave', promptEmbedding: null, anchorId: null, inventory }).outfits;
    expect(best.itemIds).toContain(shorts.id);
    expect(best.itemIds.some((id) => [jacketA.id, jacketB.id, coat.id].includes(id))).toBe(false);
  });

  it('uses embeddings to rank items by vibe', () => {
    const a = item('tshirt', { name: 'A', embedding: Float32Array.from([1, 0]) });
    const b = item('tshirt', { name: 'B', embedding: Float32Array.from([0, 1]) });
    const pants = item('jeans', { embedding: Float32Array.from([0.5, 0.5]) });
    const result = suggestOutfits({ prompt: 'x', promptEmbedding: Float32Array.from([0, 1]), anchorId: null, inventory: [a, b, pants] });
    expect(result.outfits[0].itemIds).toContain(b.id);
  });

  it('explains what is missing instead of inventing items', () => {
    const result = suggestOutfits({ prompt: 'anything', promptEmbedding: null, anchorId: null, inventory: [tee, sneakers] });
    expect(result.outfits).toEqual([]);
    expect(result.warnings[0]).toMatch(/top and one bottom/);
  });
});

describe('validateOutfit', () => {
  it('rejects unknown ids, duplicates, and doubled slots', () => {
    const top = item('tshirt');
    const top2 = item('shirt');
    const bottom = item('jeans');
    const inv = [top, top2, bottom];
    expect(validateOutfit([top.id, bottom.id], inv)).toBe(true);
    expect(validateOutfit([top.id, 'ghost'], inv)).toBe(false);
    expect(validateOutfit([top.id, top.id, bottom.id], inv)).toBe(false);
    expect(validateOutfit([top.id, top2.id, bottom.id], inv)).toBe(false);
  });
});
