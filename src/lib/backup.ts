import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { isCategoryId, isPatternId, isStyleId, getCategory } from './taxonomy';
import { SCHEMA_VERSION, type ItemColor, type WardrobeItem } from './types';

export const BACKUP_FORMAT = 1;

interface BackupItem extends Omit<WardrobeItem, 'image' | 'embedding'> {
  image: string;
  imageType: string;
  embedding: number[] | null;
}

interface BackupManifest {
  app: 'wardrobe-app';
  format: number;
  exportedAt: string;
  items: BackupItem[];
}

function extensionFor(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export async function exportBackup(items: WardrobeItem[]): Promise<Blob> {
  const files: Zippable = {};
  const manifestItems: BackupItem[] = [];
  for (const item of items) {
    const path = `images/${item.id}.${extensionFor(item.image.type)}`;
    files[path] = [new Uint8Array(await item.image.arrayBuffer()), { level: 0 }];
    manifestItems.push({
      ...item,
      image: path,
      imageType: item.image.type || 'image/jpeg',
      embedding: item.embedding ? Array.from(item.embedding, (v) => Math.round(v * 1e6) / 1e6) : null
    });
  }
  const manifest: BackupManifest = { app: 'wardrobe-app', format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), items: manifestItems };
  files['wardrobe.json'] = strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function validColors(value: unknown): ItemColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is ItemColor => !!c && typeof c.name === 'string' && typeof c.hex === 'string' && /^#[0-9a-f]{6}$/i.test(c.hex))
    .map((c) => ({ name: c.name, hex: c.hex, share: typeof c.share === 'number' ? c.share : 0 }))
    .slice(0, 5);
}

/** Validates one manifest record; returns an item or a human-readable error. */
export function parseBackupItem(raw: unknown, image: Uint8Array | undefined): WardrobeItem | string {
  if (!raw || typeof raw !== 'object') return 'record is not an object';
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  if (!id) return 'missing id';
  if (!isCategoryId(r.category)) return `${id}: unknown category`;
  if (!image || image.length === 0) return `${id}: missing image`;
  const embedding = Array.isArray(r.embedding) && r.embedding.every((v) => typeof v === 'number') ? Float32Array.from(r.embedding as number[]) : null;
  const category = getCategory(r.category);
  const warmth = r.warmth === 1 || r.warmth === 2 || r.warmth === 3 ? r.warmth : category.warmth;
  const formality = typeof r.formality === 'number' ? Math.max(1, Math.min(5, Math.round(r.formality))) : category.formality;
  const imageType = asString(r.imageType, 'image/jpeg');
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: asString(r.name, category.label),
    category: category.id,
    colors: validColors(r.colors),
    pattern: isPatternId(r.pattern) ? r.pattern : 'solid',
    styles: Array.isArray(r.styles) ? r.styles.filter(isStyleId) : [],
    warmth,
    formality,
    notes: asString(r.notes),
    image: new Blob([image.slice()], { type: imageType }),
    embedding,
    embeddingModel: embedding ? asString(r.embeddingModel) || null : null,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now()
  };
}

export async function readBackup(file: Blob): Promise<{ items: WardrobeItem[]; errors: string[] }> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error('This file is not a valid zip backup.');
  }
  const manifestBytes = files['wardrobe.json'];
  if (!manifestBytes) throw new Error('Backup is missing wardrobe.json.');
  let manifest: Partial<BackupManifest>;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes));
  } catch {
    throw new Error('wardrobe.json is not valid JSON.');
  }
  if (manifest.app !== 'wardrobe-app' || typeof manifest.format !== 'number') throw new Error('This is not a Wardrobe backup.');
  if (manifest.format > BACKUP_FORMAT) throw new Error('This backup was made by a newer version of the app.');
  if (!Array.isArray(manifest.items)) throw new Error('Backup has no item list.');

  const items: WardrobeItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of manifest.items) {
    const path = raw && typeof raw === 'object' ? asString((raw as { image?: unknown }).image) : '';
    const result = parseBackupItem(raw, path.startsWith('images/') ? files[path] : undefined);
    if (typeof result === 'string') errors.push(result);
    else if (seen.has(result.id)) errors.push(`${result.id}: duplicate id`);
    else {
      seen.add(result.id);
      items.push(result);
    }
  }
  return { items, errors };
}
