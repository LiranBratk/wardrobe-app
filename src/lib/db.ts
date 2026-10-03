import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { SCHEMA_VERSION, type ItemDraft, type WardrobeItem } from './types';
import type { LabelBank } from './tagging';

interface WardrobeDB extends DBSchema {
  items: { key: string; value: WardrobeItem; indexes: { createdAt: number } };
  cache: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = 'wardrobe';
let dbPromise: Promise<IDBPDatabase<WardrobeDB>> | null = null;

function db() {
  dbPromise ??= openDB<WardrobeDB>(DB_NAME, 1, {
    upgrade(database) {
      const items = database.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('createdAt', 'createdAt');
      database.createObjectStore('cache', { keyPath: 'key' });
    }
  });
  return dbPromise;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listItems(): Promise<WardrobeItem[]> {
  const items = await (await db()).getAllFromIndex('items', 'createdAt');
  return items.reverse();
}

export async function addItem(draft: ItemDraft): Promise<WardrobeItem> {
  const now = Date.now();
  const item: WardrobeItem = { ...draft, id: newId(), schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now };
  await (await db()).put('items', item);
  return item;
}

export async function putItem(item: WardrobeItem): Promise<void> {
  await (await db()).put('items', item);
}

export async function updateItem(item: WardrobeItem): Promise<WardrobeItem> {
  const updated = { ...item, updatedAt: Date.now() };
  await (await db()).put('items', updated);
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  await (await db()).delete('items', id);
}

export async function clearItems(): Promise<void> {
  await (await db()).clear('items');
}

export async function getCachedLabelBank(key: string): Promise<LabelBank | null> {
  const entry = await (await db()).get('cache', 'labelBank');
  const bank = entry?.value as LabelBank | undefined;
  return bank && bank.key === key ? bank : null;
}

export async function setCachedLabelBank(bank: LabelBank): Promise<void> {
  await (await db()).put('cache', { key: 'labelBank', value: bank });
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}

export async function storageInfo(): Promise<{ persisted: boolean | null; usage: number | null; quota: number | null }> {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}
