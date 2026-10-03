import { useEffect, useRef, useState } from 'react';
import type { RawImage as RawImageType, SamModel as SamModelType } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/slimsam-77-uniform';
const MODEL_REVISION = '5850ab45f587c112167512ffef949107115e26a0';

type Point = { x: number; y: number };
type Props = { image: File | null; imageUrl: string };

function SegmentationSpike({ image, imageUrl }: Props) {
  const imageElement = useRef<HTMLImageElement>(null);
  const resultUrl = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Choose a photo above, then tap the garment you want to isolate.');
  const [progress, setProgress] = useState<string | null>(null);
  const [backend, setBackend] = useState('');
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState('');

  useEffect(() => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    resultUrl.current = null;
    setPoint(null);
    setCutoutUrl('');
    setLoadMs(null);
    setInferenceMs(null);
    setBackend('');
    setStatus(image ? 'Tap the garment in the photo to generate a mask.' : 'Choose a photo above, then tap the garment you want to isolate.');
  }, [image, imageUrl]);

  useEffect(() => () => {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
  }, []);

  async function segmentAt(clientX: number, clientY: number) {
    const element = imageElement.current;
    if (!image || !element || busy) return;

    const rect = element.getBoundingClientRect();
    const x = Math.round(((clientX - rect.left) / rect.width) * element.naturalWidth);
    const y = Math.round(((clientY - rect.top) / rect.height) * element.naturalHeight);
    setPoint({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
    setCutoutUrl('');
    setBusy(true);
    setProgress(null);

    let model: SamModelType | null = null;
    try {
      const { AutoProcessor, RawImage, SamModel, SamProcessor, env } = await import('@huggingface/transformers');
      env.useBrowserCache = true;
      const rawImage = await RawImage.read(image) as RawImageType;
      const loadStartedAt = performance.now();
      setStatus('Loading the tap-to-select model and preparing the photo on this device…');

      const progress_callback = (event: { status?: string; progress?: number; file?: string }) => {
        if (event.status === 'progress' && typeof event.progress === 'number') {
          const filename = event.file?.split('/').pop();
          setProgress(`${filename ? `${filename}: ` : ''}${Math.round(event.progress)}%`);
        } else if (event.status === 'done') {
          setProgress(null);
        }
      };

      const loadedProcessor = await AutoProcessor.from_pretrained(MODEL_ID, {
        revision: MODEL_REVISION
      });
      if (!(loadedProcessor instanceof SamProcessor)) {
        throw new Error('The downloaded model did not provide a compatible SAM processor.');
      }
      const processor = loadedProcessor;

      const loadModel = async (device: 'webgpu' | 'wasm') => {
        const loadedModel = await SamModel.from_pretrained(MODEL_ID, {
          device,
          dtype: 'q8',
          revision: MODEL_REVISION,
          progress_callback
        });
        if (!(loadedModel instanceof SamModel)) {
          throw new Error('The downloaded model did not provide a compatible SAM model.');
        }
        return loadedModel;
      };

      if ('gpu' in navigator) {
        try {
          model = await loadModel('webgpu');
          setBackend('WebGPU');
        } catch (webgpuError) {
          console.warn('WebGPU segmentation loading failed; trying WASM.', webgpuError);
          setStatus('WebGPU was unavailable for segmentation. Trying the slower WASM fallback…');
          model = await loadModel('wasm');
          setBackend('WASM');
        }
      } else {
        model = await loadModel('wasm');
        setBackend('WASM');
      }

      const processedImage = await processor(rawImage);
      const imageEmbeddings = await model.get_image_embeddings({ pixel_values: processedImage.pixel_values });
      setLoadMs(Math.round(performance.now() - loadStartedAt));
      setStatus('Selecting the garment from your tap…');

      const inferenceStartedAt = performance.now();
      const prompt = await processor(rawImage, { input_points: [[[x, y]]] });
      const output = await model({ ...prompt, ...imageEmbeddings });
      const masks = await processor.post_process_masks(
        output.pred_masks,
        prompt.original_sizes,
        prompt.reshaped_input_sizes
      );
      const mask = masks[0];
      const width = mask.dims[3];
      const height = mask.dims[2];
      const planeSize = width * height;
      const maskIndex = output.iou_scores.data.reduce(
        (best: number, score: number, index: number, scores: ArrayLike<number>) =>
          score > scores[best] ? index : best,
        0
      );
      const alpha = new Uint8Array(planeSize);
      const maskOffset = maskIndex * planeSize;
      for (let index = 0; index < planeSize; index += 1) {
        alpha[index] = mask.data[maskOffset + index] ? 255 : 0;
      }

      const maskImage = new RawImage(alpha, width, height, 1);
      const cutout = rawImage.clone().rgba().putAlpha(maskImage);
      const blob = await cutout.toBlob('image/png');
      if (!blob) throw new Error('Could not create the transparent garment cutout.');

      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = URL.createObjectURL(blob);
      setCutoutUrl(resultUrl.current);
      setInferenceMs(Math.round(performance.now() - inferenceStartedAt));
      setStatus('Mask generated. Check whether it follows the garment cleanly.');
    } catch (error) {
      console.error('On-device segmentation failed.', error);
      setStatus(error instanceof Error ? `Segmentation failed: ${error.message}` : 'Segmentation failed with an unknown error.');
    } finally {
      if (model) {
        try {
          await model.dispose();
        } catch (error) {
          console.error('Could not release the segmentation model.', error);
          setStatus((currentStatus) =>
            `${currentStatus} The model could not be released cleanly; reload the page before another test.`
          );
        }
      }
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <section className="spike-card segmentation-card" aria-labelledby="segmentation-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Second device test</p>
          <h2 id="segmentation-title">Tap a garment to isolate it</h2>
        </div>
        <span className="step-badge">02 / 02</span>
      </div>
      <p className="card-copy">
        Uses SlimSAM with one positive point. The quantized model is about 14 MB and is fetched from Hugging Face on first use.
        Tap the garment itself; this is a segmentation test, not saved wardrobe data.
      </p>

      {imageUrl && image && (
        <button
          className="segment-target"
          type="button"
          onClick={(event) => void segmentAt(event.clientX, event.clientY)}
          disabled={busy}
          aria-label="Tap a point on the garment to segment it"
        >
          <img ref={imageElement} src={imageUrl} alt="Tap the garment to segment this photo" />
          {point && !cutoutUrl && (
            <span className="point-marker" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />
          )}
        </button>
      )}

      {cutoutUrl && (
        <div className="cutout-result">
          <img src={cutoutUrl} alt="Transparent cutout from the selected garment mask" />
          <span>Model-selected mask</span>
        </div>
      )}

      <div className="runtime-note">
        <span className="runtime-dot" />
        {'gpu' in navigator ? 'WebGPU will be tried first; WASM fallback is available.' : 'WebGPU not detected; will try WASM.'}
        {' '}Use Wi-Fi for the first download; the model is released after each tap to limit memory pressure.
      </div>
      <div className="status-box" role="status" aria-live="polite">
        <span className={`status-indicator ${busy ? 'active' : ''}`} />
        <div>
          <p>{status}</p>
          {progress && <small>{progress}</small>}
          {cutoutUrl && (
            <small>
              {backend} · load {loadMs === null ? '—' : `${(loadMs / 1000).toFixed(1)}s`} · prompt/inference {inferenceMs === null ? '—' : `${(inferenceMs / 1000).toFixed(1)}s`}
            </small>
          )}
        </div>
      </div>
    </section>
  );
}

export default SegmentationSpike;
