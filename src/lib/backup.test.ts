import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { exportBackup, readBackup } from './backup';
import type { WardrobeItem } from './types';

const sample: WardrobeItem = {
  id: 'abc',
  schemaVersion: 1,
  name: 'Navy jacket',
  category: 'jacket',
  colors: [{ name: 'navy', hex: '#1e2850', share: 0.8 }],
  pattern: 'solid',
  styles: ['casual', 'smart'],
  warmth: 2,
  formality: 3,
  notes: 'favourite',
  image: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }),
  embedding: Float32Array.from([0.1, -0.2, 0.3]),
  embeddingModel: 'model@rev',
  createdAt: 1,
  updatedAt: 2
};

describe('backup', () => {
  it('round-trips items, images, and embeddings', async () => {
    const zip = await exportBackup([sample]);
    const { items, errors } = await readBackup(zip);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    const [restored] = items;
    expect(restored.name).toBe('Navy jacket');
    expect(restored.styles).toEqual(['casual', 'smart']);
    expect(Array.from(restored.embedding!)).toEqual(Array.from(sample.embedding!).map((v) => Math.fround(v)));
    expect(new Uint8Array(await restored.image.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('rejects non-backups and reports bad records', async () => {
    await expect(readBackup(new Blob(['nope']))).rejects.toThrow(/zip/);
    const manifest = {
      app: 'wardrobe-app',
      format: 1,
      items: [
        { id: 'a', category: 'not-a-category', image: 'images/a.jpg' },
        { id: 'b', category: 'jeans', image: 'images/missing.jpg' },
        { id: 'c', category: 'jeans', image: 'images/c.jpg', styles: ['casual', 'bogus'], warmth: 9 }
      ]
    };
    const zip = zipSync({ 'wardrobe.json': strToU8(JSON.stringify(manifest)), 'images/c.jpg': new Uint8Array([9]) });
    const { items, errors } = await readBackup(new Blob([zip]));
    expect(items.map((i) => i.id)).toEqual(['c']);
    expect(items[0].styles).toEqual(['casual']);
    expect(items[0].warmth).toBe(2);
    expect(errors).toHaveLength(2);
  });
});
