import type { PatternId, StyleId } from './taxonomy';

export const SCHEMA_VERSION = 1;

export interface ItemColor {
  hex: string;
  name: string;
  share: number;
}

export interface WardrobeItem {
  id: string;
  schemaVersion: number;
  name: string;
  category: string;
  colors: ItemColor[];
  pattern: PatternId;
  styles: StyleId[];
  warmth: 1 | 2 | 3;
  formality: number;
  notes: string;
  image: Blob;
  embedding: Float32Array | null;
  embeddingModel: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ItemDraft = Omit<WardrobeItem, 'id' | 'schemaVersion' | 'createdAt' | 'updatedAt'>;
