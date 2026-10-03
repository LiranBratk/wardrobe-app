import { COLOR_NAMES, NAMED_COLORS, toHex } from '../lib/color';
import { CATEGORIES, PATTERNS, SLOT_LABELS, STYLES, WARMTH_LABELS, getCategory, type PatternId, type StyleId } from '../lib/taxonomy';
import type { ItemColor } from '../lib/types';

export interface ItemFields {
  name: string;
  category: string;
  colors: ItemColor[];
  pattern: PatternId;
  styles: StyleId[];
  warmth: 1 | 2 | 3;
  formality: number;
  notes: string;
}

export function autoName(category: string, colors: ItemColor[]): string {
  const label = getCategory(category).label.split(' / ')[0];
  const color = colors[0]?.name;
  const text = color ? `${color} ${label.toLowerCase()}` : label;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const slotOrder = Object.keys(SLOT_LABELS) as (keyof typeof SLOT_LABELS)[];

export function ItemForm({ value, onChange, idPrefix }: { value: ItemFields; onChange: (next: ItemFields) => void; idPrefix: string }) {
  const set = (patch: Partial<ItemFields>) => {
    const next = { ...value, ...patch };
    if ((patch.category || patch.colors) && value.name === autoName(value.category, value.colors)) {
      next.name = autoName(next.category, next.colors);
    }
    onChange(next);
  };

  const toggleStyle = (id: StyleId) =>
    set({ styles: value.styles.includes(id) ? value.styles.filter((s) => s !== id) : [...value.styles, id] });

  const addColor = (name: string) => {
    if (!name || value.colors.some((c) => c.name === name)) return;
    const named = NAMED_COLORS.find((c) => c.name === name)!;
    set({ colors: [...value.colors, { name, hex: toHex(named.rgb), share: 0 }].slice(0, 4) });
  };

  return (
    <div className="item-form">
      <label className="field">
        <span>Name</span>
        <input id={`${idPrefix}-name`} value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} />
      </label>

      <label className="field">
        <span>Category</span>
        <select value={value.category} onChange={(e) => set({ category: e.target.value })}>
          {slotOrder.map((slot) => (
            <optgroup key={slot} label={SLOT_LABELS[slot]}>
              {CATEGORIES.filter((c) => c.slot === slot).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Colours <small>(first is main)</small></span>
        <div className="chip-row">
          {value.colors.map((c, i) => (
            <button
              type="button"
              key={c.name}
              className="chip color-chip"
              onClick={() => set({ colors: value.colors.filter((_, j) => j !== i) })}
              aria-label={`Remove ${c.name}`}
            >
              <i style={{ background: c.hex }} />
              {c.name} ×
            </button>
          ))}
          <select className="chip add-chip" value="" onChange={(e) => addColor(e.target.value)} aria-label="Add colour">
            <option value="">+ colour</option>
            {COLOR_NAMES.filter((n) => !value.colors.some((c) => c.name === n)).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <label className="field">
        <span>Pattern</span>
        <select value={value.pattern} onChange={(e) => set({ pattern: e.target.value as PatternId })}>
          {PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>

      <div className="field">
        <span>Style</span>
        <div className="chip-row">
          {STYLES.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`chip ${value.styles.includes(s.id) ? 'on' : ''}`}
              aria-pressed={value.styles.includes(s.id)}
              onClick={() => toggleStyle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-pair">
        <div className="field">
          <span>Warmth</span>
          <div className="segmented">
            {([1, 2, 3] as const).map((w) => (
              <button type="button" key={w} className={value.warmth === w ? 'on' : ''} onClick={() => set({ warmth: w })}>
                {WARMTH_LABELS[w]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Formality</span>
          <div className="segmented">
            {[1, 2, 3, 4, 5].map((f) => (
              <button type="button" key={f} className={value.formality === f ? 'on' : ''} onClick={() => set({ formality: f })}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="field">
        <span>Notes</span>
        <input value={value.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. oversized, linen, favourite" maxLength={200} />
      </label>
    </div>
  );
}
