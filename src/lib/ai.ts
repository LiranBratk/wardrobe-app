import { MODEL_KEY, withImageEmbedder, withTextEmbedder, type ProgressReporter } from './clip';
import { getCachedLabelBank, setCachedLabelBank } from './db';
import { labelBankKey, labelPrompts, normalize, suggestTags, type LabelBank, type TagSuggestion } from './tagging';

export interface AnalysedImage {
  embedding: Float32Array;
  tags: TagSuggestion;
}

export async function ensureLabelBank(report: ProgressReporter): Promise<LabelBank> {
  const key = labelBankKey(MODEL_KEY);
  const cached = await getCachedLabelBank(key);
  if (cached) return cached;
  const prompts = labelPrompts();
  const bank = await withTextEmbedder(report, async (embed) => {
    report('Learning clothing labels (first run only)…');
    const all = await embed([...prompts.categories, ...prompts.patterns, ...prompts.styles, ...prompts.warmth]);
    const vectors = all.map(normalize);
    let offset = 0;
    const take = (n: number) => vectors.slice(offset, (offset += n));
    return {
      key,
      categories: take(prompts.categories.length),
      patterns: take(prompts.patterns.length),
      styles: take(prompts.styles.length),
      warmth: take(prompts.warmth.length)
    };
  });
  await setCachedLabelBank(bank);
  return bank;
}

/** Embeds and tags images one at a time with a single model load. */
export async function analyseImages(
  images: Blob[],
  report: ProgressReporter,
  onResult: (index: number, result: AnalysedImage) => void
): Promise<string> {
  const bank = await ensureLabelBank(report);
  return withImageEmbedder(report, async (embed, backend) => {
    for (let i = 0; i < images.length; i++) {
      report(`Tagging item ${i + 1} of ${images.length} (${backend})…`);
      const embedding = normalize(await embed(images[i]));
      onResult(i, { embedding, tags: suggestTags(embedding, bank) });
    }
    return backend;
  });
}

const promptCache = new Map<string, Float32Array>();

export async function embedPrompt(prompt: string, report: ProgressReporter): Promise<Float32Array> {
  const text = prompt.trim().toLowerCase();
  const cached = promptCache.get(text);
  if (cached) return cached;
  const [vector] = await withTextEmbedder(report, async (embed) => {
    report('Reading your vibe…');
    return embed([`a photo of clothes for ${text}`]);
  });
  const result = normalize(vector);
  promptCache.set(text, result);
  return result;
}

export { MODEL_KEY };
