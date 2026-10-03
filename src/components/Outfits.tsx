import { useMemo, useState } from 'react';
import { embedPrompt } from '../lib/ai';
import { suggestOutfits, type OutfitResult } from '../lib/outfit';
import { getCategory, SLOT_LABELS } from '../lib/taxonomy';
import type { WardrobeItem } from '../lib/types';
import { ItemImage } from './media';

const EXAMPLES = [
  'The vibe today is this jacket and it’s quite cool today',
  'Cozy rainy day at home',
  'Smart casual office, 18°C',
  'Hot beach day, 31°C',
  'Date night dinner'
];

export function Outfits({ items, onGoToAdd }: { items: WardrobeItem[]; onGoToAdd: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickingAnchor, setPickingAnchor] = useState(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const anchor = anchorId ? byId.get(anchorId) ?? null : null;
  const hasEmbeddings = items.some((i) => i.embedding);

  const run = async (nextAnchor = anchorId) => {
    setBusy(true);
    setStatus('');
    let promptEmbedding: Float32Array | null = null;
    if (prompt.trim() && hasEmbeddings) {
      try {
        promptEmbedding = await embedPrompt(prompt, setStatus);
      } catch (e) {
        console.error(e);
        setStatus('Vibe model unavailable; using tags and weather only.');
      }
    }
    const next = suggestOutfits({ prompt, promptEmbedding, anchorId: nextAnchor, inventory: items });
    setResult(next);
    if (promptEmbedding) setStatus('');
    setBusy(false);
  };

  const chooseAnchor = (id: string | null) => {
    setAnchorId(id);
    setPickingAnchor(false);
    if (result) void run(id);
  };

  if (!items.length) {
    return (
      <section className="card empty">
        <p className="eyebrow">No clothes yet</p>
        <h2>Outfits come from your closet</h2>
        <p className="card-copy">Suggestions only ever use items you have added, so start by adding some clothes.</p>
        <button className="primary-button" type="button" onClick={onGoToAdd}>Add clothes <span aria-hidden="true">+</span></button>
      </section>
    );
  }

  const mentioned = result && !anchor ? result.context.mentionedCategories : [];
  const anchorCandidates = mentioned.length ? items.filter((i) => mentioned.includes(i.category)) : [];

  return (
    <section>
      <div className="card">
        <p className="eyebrow">What’s the vibe?</p>
        <h2>Describe today</h2>
        <textarea
          className="prompt"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. the vibe today is this jacket and it’s quite cool today"
        />
        <div className="chip-row scroll">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setPrompt(ex)}>{ex}</button>
          ))}
        </div>

        <div className="anchor-row">
          {anchor ? (
            <>
              <ItemImage blob={anchor.image} alt={anchor.name} className="anchor-thumb" />
              <span>Built around <strong>{anchor.name}</strong></span>
              <button className="text-button" type="button" onClick={() => chooseAnchor(null)}>Clear</button>
            </>
          ) : (
            <button className="text-button" type="button" onClick={() => setPickingAnchor((v) => !v)}>
              {pickingAnchor ? 'Hide items' : '+ Build around a specific item'}
            </button>
          )}
        </div>
        {pickingAnchor && <AnchorPicker items={items} onPick={chooseAnchor} />}

        <button className="primary-button" type="button" disabled={busy} onClick={() => run()}>
          {busy ? 'Thinking on this device…' : 'Suggest outfits'} <span aria-hidden="true">↗</span>
        </button>
        {status && <p className="hint">{status}</p>}
        {!hasEmbeddings && <p className="hint">Items aren’t auto-tagged yet, so vibe matching uses your tags and the weather words only.</p>}
      </div>

      {result && (
        <div className="results-list">
          {result.context.understood.length > 0 && (
            <div className="chip-row understood">
              <small>Understood:</small>
              {result.context.understood.map((u) => <span className="chip static" key={u}>{u}</span>)}
            </div>
          )}
          {anchorCandidates.length > 1 && (
            <div className="card subtle">
              <p className="card-copy">Which {getCategory(mentioned[0]).label.toLowerCase().split(' / ')[0]} did you mean? Tap one to build around it.</p>
              <AnchorPicker items={anchorCandidates} onPick={chooseAnchor} />
            </div>
          )}
          {result.warnings.map((w) => <p className="warning" key={w}>{w}</p>)}
          {result.outfits.map((outfit, n) => (
            <article className="card outfit" key={outfit.key}>
              <p className="eyebrow">Option {n + 1}</p>
              <div className="outfit-items">
                {outfit.itemIds.map((id) => {
                  const item = byId.get(id)!;
                  return (
                    <figure key={id}>
                      <ItemImage blob={item.image} alt={item.name} />
                      <figcaption>
                        <small>{SLOT_LABELS[getCategory(item.category).slot]}</small>
                        {item.name}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              <ul className="reasons">
                {outfit.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AnchorPicker({ items, onPick }: { items: WardrobeItem[]; onPick: (id: string) => void }) {
  return (
    <div className="anchor-picker">
      {items.map((i) => (
        <button type="button" key={i.id} onClick={() => onPick(i.id)} title={i.name}>
          <ItemImage blob={i.image} alt={i.name} />
          <span>{i.name}</span>
        </button>
      ))}
    </div>
  );
}
