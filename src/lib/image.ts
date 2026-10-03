import { dominantColors } from './color';
import type { ItemColor } from './types';

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export function loadImage(source: Blob): Promise<{ image: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This photo could not be opened.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), type, quality)
  );
}

/** Crops a normalised rectangle from the photo, downsizes it, and returns a JPEG plus its dominant colours. */
export async function cropImage(image: HTMLImageElement, rect: CropRect, maxEdge = 640): Promise<{ blob: Blob; colors: ItemColor[] }> {
  const sx = Math.round(rect.x * image.naturalWidth);
  const sy = Math.round(rect.y * image.naturalHeight);
  const sw = Math.max(1, Math.round(rect.w * image.naturalWidth));
  const sh = Math.max(1, Math.round(rect.h * image.naturalHeight));
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const colors = dominantColors(data, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  canvas.width = 0;
  canvas.height = 0;
  return { blob, colors };
}
