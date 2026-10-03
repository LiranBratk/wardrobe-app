import { useEffect, useRef, useState } from 'react';
import SegmentationSpike from './SegmentationSpike';
import type {
  ZeroShotImageClassificationPipeline,
  ZeroShotImageClassificationOutput
} from '@huggingface/transformers';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
const MODEL_REVISION = 'd15189d7028b43f1d3e65039190477f6af591c2a';
const GARMENT_LABELS = [
  'T-shirt',
  'shirt or blouse',
  'sweater or cardigan',
  'jacket or coat',
  'pair of jeans',
  'trousers',
  'skirt',
  'dress',
  'pair of shorts',
  'pair of shoes',
  'handbag',
  'accessory'
];

type Classifier = InstanceType<typeof ZeroShotImageClassificationPipeline>;
type Prediction = ZeroShotImageClassificationOutput[number];

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('Choose a clothing photo to begin.');
  const [busy, setBusy] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [modelLoadMs, setModelLoadMs] = useState<number | null>(null);
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const [backend, setBackend] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const classifier = useRef<Classifier | null>(null);
  const canUseWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

  useEffect(() => {
    if (!image) {
      setImageUrl('');
      return;
    }

    const url = URL.createObjectURL(image);
    setImageUrl(url);
    setPredictions([]);
    setInferenceMs(null);
    setStatus('Photo selected. Ready to run the on-device tagging test.');
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function runTagging() {
    if (!image || busy) return;

    setBusy(true);
    setPredictions([]);
    setInferenceMs(null);
    setDownloadProgress(null);

    try {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.useBrowserCache = true;
      if (!classifier.current) {
        const loadStartedAt = performance.now();
        setStatus('Downloading the model if needed, then loading it on this device…');
        const progress_callback = (event: { status?: string; progress?: number; file?: string }) => {
          if (event.status === 'progress' && typeof event.progress === 'number') {
            const filename = event.file?.split('/').pop();
            setDownloadProgress(`${filename ? `${filename}: ` : ''}${Math.round(event.progress)}%`);
          } else if (event.status === 'done') {
            setDownloadProgress(null);
          }
        };

        if (canUseWebGPU) {
          try {
            classifier.current = await pipeline('zero-shot-image-classification', MODEL_ID, {
              device: 'webgpu',
              dtype: 'q4',
              revision: MODEL_REVISION,
              progress_callback
            });
            setBackend('WebGPU');
          } catch (webgpuError) {
            console.warn('WebGPU model loading failed; trying WASM.', webgpuError);
            setStatus('WebGPU was unavailable for this model. Trying the slower WASM fallback…');
            classifier.current = await pipeline('zero-shot-image-classification', MODEL_ID, {
              device: 'wasm',
              dtype: 'q4',
              revision: MODEL_REVISION,
              progress_callback
            });
            setBackend('WASM');
          }
        } else {
          classifier.current = await pipeline('zero-shot-image-classification', MODEL_ID, {
            device: 'wasm',
            dtype: 'q4',
            revision: MODEL_REVISION,
            progress_callback
          });
          setBackend('WASM');
        }
        setModelLoadMs(Math.round(performance.now() - loadStartedAt));
      }

      setStatus('Comparing the photo with clothing categories…');
      const inferenceStartedAt = performance.now();
      const output = await classifier.current(imageUrl, GARMENT_LABELS);
      setPredictions(output.slice(0, 5));
      setInferenceMs(Math.round(performance.now() - inferenceStartedAt));
      setStatus('Tagging complete. This is a technology spike, not saved wardrobe data.');
    } catch (error) {
      console.error('On-device tagging failed.', error);
      setStatus(error instanceof Error ? `Tagging failed: ${error.message}` : 'Tagging failed with an unknown error.');
    } finally {
      const loadedClassifier = classifier.current;
      classifier.current = null;
      if (loadedClassifier) {
        try {
          await loadedClassifier.dispose();
        } catch (error) {
          console.error('Could not release the on-device model.', error);
          setStatus((currentStatus) =>
            `${currentStatus} The model could not be released cleanly; reload the page before another test.`
          );
        }
      }
      setBusy(false);
      setDownloadProgress(null);
    }
  }

  return (
    <main className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Wardrobe home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>Wardrobe</span>
        </a>
        <span className="privacy-pill"><span /> On-device by default</span>
      </header>

      <section className="intro">
        <p className="eyebrow">A wardrobe that knows what you own</p>
        <h1>Get dressed like <em>yourself.</em></h1>
        <p className="lede">Save your real clothes, then find an outfit for your mood, plans, and the weather.</p>
      </section>

      <section className="spike-card" aria-labelledby="spike-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">First device test</p>
            <h2 id="spike-title">Try local clothing recognition</h2>
          </div>
          <span className="step-badge">01 / 02</span>
        </div>
        <p className="card-copy">
          Pick one clothing photo to test whether a vision model can run on this phone. The photo stays in this browser;
          about 190 MB of quantized model files are downloaded from Hugging Face on first use and cached by the browser.
        </p>

        <label className={`photo-picker ${imageUrl ? 'has-image' : ''}`}>
          {imageUrl ? (
            <img src={imageUrl} alt="Selected clothing to classify" />
          ) : (
            <span className="upload-prompt">
              <span className="upload-icon" aria-hidden="true">+</span>
              <strong>Choose a clothing photo</strong>
              <span>Use your camera or photo library</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="runtime-note">
          <span className="runtime-dot" />
          {canUseWebGPU ? 'WebGPU detected; WASM fallback is available.' : 'WebGPU not detected; will try WASM.'}
          {' '}Use Wi-Fi for the first download. The model is released after each test to limit memory pressure.
        </div>

        <button className="primary-button" type="button" onClick={runTagging} disabled={!image || busy}>
          {busy ? 'Running on this device…' : 'Test on-device tagging'}
          {!busy && <span aria-hidden="true">↗</span>}
        </button>

        <div className="status-box" role="status" aria-live="polite">
          <span className={`status-indicator ${busy ? 'active' : ''}`} />
          <div>
            <p>{status}</p>
            {downloadProgress && <small>{downloadProgress}</small>}
          </div>
        </div>

        {predictions.length > 0 && (
          <div className="results">
            <div className="results-heading">
              <strong>Closest categories</strong>
              <span>{backend} · load {modelLoadMs === null ? 'cached' : `${(modelLoadMs / 1000).toFixed(1)}s`} · infer {inferenceMs === null ? '—' : `${(inferenceMs / 1000).toFixed(1)}s`}</span>
            </div>
            {predictions.map(({ label, score }) => (
              <div className="prediction" key={label}>
                <span>{label}</span>
                <span>{(score * 100).toFixed(1)}%</span>
                <div className="score-track"><span style={{ width: `${Math.max(score * 100, 2)}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SegmentationSpike image={image} imageUrl={imageUrl} />

      <footer className="footnote">
        <span>LOCAL FIRST</span>
        <p>No account. No wardrobe uploads. Your clothes remain yours.</p>
      </footer>
    </main>
  );
}

export default App;
