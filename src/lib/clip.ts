import type { PreTrainedModel, Processor, PreTrainedTokenizer, Tensor } from '@huggingface/transformers';

export const MODEL_ID = 'Xenova/clip-vit-base-patch32';
export const MODEL_REVISION = 'd15189d7028b43f1d3e65039190477f6af591c2a';
export const MODEL_KEY = `${MODEL_ID}@${MODEL_REVISION}`;

export type ProgressReporter = (message: string) => void;
export type ImageEmbedder = (image: Blob) => Promise<Float32Array>;
export type TextEmbedder = (texts: string[]) => Promise<Float32Array[]>;

export const canUseWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
const WEBGPU_FAILED_KEY = 'wardrobe:webgpu-failed';

/**
 * Transformers.js chains session creation, so one failed WebGPU session poisons later loads until reload.
 * Only try WebGPU when an adapter exists and it has not failed on this device before.
 */
async function shouldTryWebGPU(): Promise<boolean> {
  if (!canUseWebGPU || localStorage.getItem(WEBGPU_FAILED_KEY)) return false;
  try {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

async function loadLibrary() {
  const lib = await import('@huggingface/transformers');
  lib.env.allowLocalModels = false;
  lib.env.useBrowserCache = true;
  return lib;
}

function progressCallback(report: ProgressReporter, what: string) {
  return (event: { status?: string; progress?: number; file?: string }) => {
    if (event.status === 'progress' && typeof event.progress === 'number') {
      const file = event.file?.split('/').pop() ?? '';
      report(`Downloading ${what} ${file} ${Math.round(event.progress)}%`);
    } else if (event.status === 'ready') {
      report(`Loaded ${what}.`);
    }
  };
}

function rows(tensor: Tensor): Float32Array[] {
  const [count, width] = tensor.dims;
  const data = tensor.data as Float32Array;
  return Array.from({ length: count }, (_, i) => Float32Array.from(data.subarray(i * width, (i + 1) * width)));
}

/** Loads the CLIP image encoder, runs `work`, and always releases the model to keep Safari memory low. */
export async function withImageEmbedder<T>(report: ProgressReporter, work: (embed: ImageEmbedder, backend: string) => Promise<T>): Promise<T> {
  const lib = await loadLibrary();
  report('Preparing the on-device image model…');
  const processor: Processor = await lib.AutoProcessor.from_pretrained(MODEL_ID, { revision: MODEL_REVISION });
  let model: PreTrainedModel;
  let backend = 'WASM';
  const options = { revision: MODEL_REVISION, dtype: 'q4' as const, progress_callback: progressCallback(report, 'image model') };
  if (await shouldTryWebGPU()) {
    try {
      model = await lib.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { ...options, device: 'webgpu' });
      backend = 'WebGPU';
    } catch (error) {
      console.warn('WebGPU image model failed; falling back to WASM.', error);
      localStorage.setItem(WEBGPU_FAILED_KEY, String(Date.now()));
      try {
        model = await lib.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { ...options, device: 'wasm' });
      } catch (fallbackError) {
        console.error(fallbackError);
        throw new Error('WebGPU failed on this device. Close and reopen the app to use the slower WASM mode.');
      }
    }
  } else {
    model = await lib.CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { ...options, device: 'wasm' });
  }

  try {
    return await work(async (blob) => {
      const image = await lib.RawImage.fromBlob(blob);
      const inputs = await processor(image);
      const { image_embeds } = await model(inputs);
      return rows(image_embeds)[0];
    }, backend);
  } finally {
    await model.dispose().catch((error: unknown) => console.error('Could not release the image model.', error));
  }
}

/** Loads the CLIP text encoder (WASM, int8), runs `work`, then releases it. */
export async function withTextEmbedder<T>(report: ProgressReporter, work: (embed: TextEmbedder) => Promise<T>): Promise<T> {
  const lib = await loadLibrary();
  report('Preparing the on-device text model…');
  const tokenizer: PreTrainedTokenizer = await lib.AutoTokenizer.from_pretrained(MODEL_ID, { revision: MODEL_REVISION });
  const model = await lib.CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
    revision: MODEL_REVISION,
    dtype: 'q8',
    device: 'wasm',
    progress_callback: progressCallback(report, 'text model')
  });
  try {
    return await work(async (texts) => {
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += 16) {
        const inputs = tokenizer(texts.slice(i, i + 16), { padding: true, truncation: true });
        const { text_embeds } = await model(inputs);
        out.push(...rows(text_embeds));
      }
      return out;
    });
  } finally {
    await model.dispose().catch((error: unknown) => console.error('Could not release the text model.', error));
  }
}
