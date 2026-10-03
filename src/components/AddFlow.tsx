import { useEffect, useState } from 'react';
import { analyseImages, MODEL_KEY } from '../lib/ai';
import { addItem, requestPersistentStorage } from '../lib/db';
import { cropImage, FULL_CROP, loadImage, type CropRect } from '../lib/image';
import { getCategory } from '../lib/taxonomy';
import type { TagSuggestion } from '../lib/tagging';
import type { WardrobeItem } from '../lib/types';
import { Cropper } from './Cropper';
import { autoName, ItemForm, type ItemFields } from './ItemForm';
import { ItemImage } from './media';

interface Draft {
  key: string;
  image: Blob;
  fields: ItemFields;
  embedding: Float32Array | null;
  suggestion: TagSuggestion | null;
}

type Step = 'pick' | 'crop' | 'tag' | 'review';

function defaultFields(colors: ItemFields['colors']): ItemFields {
  const category = 'tshirt';
  const cat = getCategory(category);
  return { name: autoName(category, colors), category, colors, pattern: 'solid', styles: ['casual'], warmth: cat.warmth, formality: cat.formality, notes: '' };
}

export function AddFlow({ onSaved }: { onSaved: (items: WardrobeItem[]) => void }) {
  const [step, setStep] = useState<Step>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photo, setPhoto] = useState<{ image: HTMLImageElement; url: string } | null>(null);
  const [rect, setRect] = useState<CropRect>(FULL_CROP);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (step !== 'crop' || !files[photoIndex]) return;
    let released = false;
    let release = () => {};
    setPhoto(null);
    setRect(FULL_CROP);
    loadImage(files[photoIndex])
      .then((loaded) => {
        release = loaded.release;
        if (released) loaded.release();
        else setPhoto({ image: loaded.image, url: loaded.image.src });
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      released = true;
      release();
    };
  }, [step, files, photoIndex]);

  const reset = () => {
    setStep('pick');
    setFiles([]);
    setPhotoIndex(0);
    setDrafts([]);
    setStatus('');
    setError('');
  };

  const nextPhoto = () => {
    if (photoIndex + 1 < files.length) setPhotoIndex(photoIndex + 1);
    else setStep(drafts.length ? 'tag' : 'pick');
  };

  const addCrop = async (advance: boolean) => {
    if (!photo) return;
    setBusy(true);
    try {
      const { blob, colors } = await cropImage(photo.image, rect);
      const draft: Draft = { key: `${Date.now()}-${Math.random()}`, image: blob, fields: defaultFields(colors), embedding: null, suggestion: null };
      setDrafts((d) => [...d, draft]);
      if (advance) {
        if (photoIndex + 1 < files.length) setPhotoIndex(photoIndex + 1);
        else setStep('tag');
      } else {
        setRect(FULL_CROP);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not crop this photo.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'tag') return;
    let cancelled = false;
    setError('');
    setStatus('Starting on-device tagging…');
    const pending = drafts.filter((d) => !d.suggestion);
    if (!pending.length) {
      setStep('review');
      return;
    }
    analyseImages(
      pending.map((d) => d.image),
      (m) => !cancelled && setStatus(m),
      (i, { embedding, tags }) => {
        const key = pending[i].key;
        setDrafts((all) =>
          all.map((d) =>
            d.key === key
              ? {
                  ...d,
                  embedding,
                  suggestion: tags,
                  fields: {
                    ...d.fields,
                    category: tags.category,
                    pattern: tags.pattern,
                    styles: tags.styles,
                    warmth: tags.warmth,
                    formality: tags.formality,
                    name: autoName(tags.category, d.fields.colors)
                  }
                }
              : d
          )
        );
      }
    )
      .then(() => !cancelled && setStep('review'))
      .catch((e: unknown) => {
        console.error(e);
        if (!cancelled) setError(`Auto-tagging failed (${e instanceof Error ? e.message : 'unknown error'}). You can tag these items by hand.`);
      });
    return () => {
      cancelled = true;
    };
    // Run when entering the tag step or retrying; drafts are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, attempt]);

  const saveAll = async () => {
    setBusy(true);
    setError('');
    try {
      const saved: WardrobeItem[] = [];
      for (const d of drafts) {
        saved.push(
          await addItem({
            ...d.fields,
            name: d.fields.name.trim() || autoName(d.fields.category, d.fields.colors),
            image: d.image,
            embedding: d.embedding,
            embeddingModel: d.embedding ? MODEL_KEY : null
          })
        );
      }
      await requestPersistentStorage().catch(() => null);
      onSaved(saved);
      reset();
    } catch (e) {
      setError(e instanceof Error ? `Saving failed: ${e.message}` : 'Saving failed.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'pick') {
    return (
      <section className="card">
        <p className="eyebrow">Add clothes</p>
        <h2>Photograph your wardrobe</h2>
        <p className="card-copy">
          Lay each garment flat or hang it against a plain wall. Pick several photos at once; you can crop more than one item from a
          photo. Photos never leave this phone.
        </p>
        <label className="photo-picker">
          <span className="upload-prompt">
            <span className="upload-icon" aria-hidden="true">+</span>
            <strong>Choose photos</strong>
            <span>Camera or photo library</span>
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (!picked.length) return;
              setFiles(picked);
              setPhotoIndex(0);
              setDrafts([]);
              setStep('crop');
            }}
          />
        </label>
        <p className="hint">First tagging run downloads ~120 MB of model files from Hugging Face. Use Wi-Fi.</p>
      </section>
    );
  }

  if (step === 'crop') {
    return (
      <section className="card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Photo {photoIndex + 1} of {files.length}</p>
            <h2>Frame one garment</h2>
          </div>
          <button className="text-button" type="button" onClick={reset}>Cancel</button>
        </div>
        <p className="card-copy">Drag a box around a single item, or keep the whole photo. Tight crops tag better.</p>
        {photo ? <Cropper src={photo.url} rect={rect} onChange={setRect} /> : <div className="cropper loading">Opening photo…</div>}
        {drafts.length > 0 && (
          <div className="draft-strip">
            {drafts.map((d) => <ItemImage key={d.key} blob={d.image} alt="Cropped item" />)}
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div className="button-stack">
          <button className="primary-button" type="button" disabled={!photo || busy} onClick={() => addCrop(true)}>
            {photoIndex + 1 < files.length ? 'Add item · next photo' : 'Add item · finish'} <span aria-hidden="true">→</span>
          </button>
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={!photo || busy} onClick={() => addCrop(false)}>
              Add & crop another here
            </button>
            <button className="secondary-button" type="button" disabled={busy} onClick={nextPhoto}>
              {photoIndex + 1 < files.length ? 'Skip photo' : drafts.length ? 'Done' : 'Skip'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (step === 'tag') {
    return (
      <section className="card">
        <p className="eyebrow">Tagging {drafts.length} item{drafts.length === 1 ? '' : 's'}</p>
        <h2>Recognising your clothes</h2>
        <div className="status-box" role="status" aria-live="polite">
          <span className={`status-indicator ${error ? '' : 'active'}`} />
          <p>{error || status}</p>
        </div>
        <div className="draft-strip">
          {drafts.map((d) => <ItemImage key={d.key} blob={d.image} alt="Item being tagged" className={d.suggestion ? '' : 'pending'} />)}
        </div>
        {error && (
          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
            <button className="primary-button" type="button" onClick={() => setStep('review')}>Tag by hand</button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="review">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Review {drafts.length} item{drafts.length === 1 ? '' : 's'}</p>
          <h2>Check the tags</h2>
        </div>
        <button className="text-button" type="button" onClick={reset}>Discard</button>
      </div>
      <p className="card-copy">Fix anything the model got wrong — better tags mean better outfits.</p>
      {drafts.map((d) => (
        <article className="card review-card" key={d.key}>
          <div className="review-head">
            <ItemImage blob={d.image} alt={d.fields.name} className="review-thumb" />
            <div>
              {d.suggestion ? (
                <p className="guess">
                  Model guess:{' '}
                  {d.suggestion.categoryScores.map((s) => `${getCategory(s.id).label} ${Math.round(s.score * 100)}%`).join(' · ')}
                </p>
              ) : (
                <p className="guess">Not auto-tagged. Outfit vibe matching will use your tags only.</p>
              )}
              <button className="text-button danger" type="button" onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}>
                Remove
              </button>
            </div>
          </div>
          <ItemForm
            idPrefix={d.key}
            value={d.fields}
            onChange={(fields) => setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, fields } : x)))}
          />
        </article>
      ))}
      {error && <p className="error">{error}</p>}
      <button className="primary-button sticky-action" type="button" disabled={busy || !drafts.length} onClick={saveAll}>
        {busy ? 'Saving…' : `Save ${drafts.length} item${drafts.length === 1 ? '' : 's'} to closet`} <span aria-hidden="true">✓</span>
      </button>
    </section>
  );
}
