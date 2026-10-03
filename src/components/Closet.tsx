import { useMemo, useState } from 'react';
import { deleteItem, updateItem } from '../lib/db';
import { getCategory, SLOT_LABELS, type Slot } from '../lib/taxonomy';
import type { WardrobeItem } from '../lib/types';
import { ItemForm, type ItemFields } from './ItemForm';
import { ItemImage } from './media';

const FILTERS: (Slot | 'all')[] = ['all', 'top', 'bottom', 'onepiece', 'outerwear', 'shoes', 'accessory'];

export function Closet({
  items,
  onChanged,
  onDeleted,
  onAdd
}: {
  items: WardrobeItem[];
  onChanged: (item: WardrobeItem) => void;
  onDeleted: (id: string) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<Slot | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<WardrobeItem | null>(null);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of items) c.set(getCategory(i.category).slot, (c.get(getCategory(i.category).slot) ?? 0) + 1);
    return c;
  }, [items]);

  const visible = items.filter((i) => {
    if (filter !== 'all' && getCategory(i.category).slot !== filter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return [i.name, i.notes, getCategory(i.category).label, ...i.colors.map((c) => c.name)].join(' ').toLowerCase().includes(q);
  });

  if (!items.length) {
    return (
      <section className="card empty">
        <p className="eyebrow">Your closet is empty</p>
        <h2>Start with a few favourites</h2>
        <p className="card-copy">Add a handful of tops, bottoms, and shoes, then ask for an outfit.</p>
        <button className="primary-button" type="button" onClick={onAdd}>Add clothes <span aria-hidden="true">+</span></button>
      </section>
    );
  }

  return (
    <section>
      <div className="closet-tools">
        <input className="search" type="search" placeholder={`Search ${items.length} items`} value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chip-row scroll">
          {FILTERS.filter((f) => f === 'all' || counts.get(f)).map((f) => (
            <button key={f} type="button" className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : SLOT_LABELS[f]} <small>{f === 'all' ? items.length : counts.get(f)}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="grid">
        {visible.map((item) => (
          <button type="button" className="tile" key={item.id} onClick={() => setEditing(item)}>
            <ItemImage blob={item.image} alt={item.name} />
            <span className="tile-label">
              {item.colors[0] && <i style={{ background: item.colors[0].hex }} />}
              {item.name}
            </span>
          </button>
        ))}
      </div>
      {!visible.length && <p className="hint center">No items match.</p>}
      {editing && (
        <ItemSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            onChanged(saved);
            setEditing(null);
          }}
          onDeleted={(id) => {
            onDeleted(id);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function ItemSheet({
  item,
  onClose,
  onSaved,
  onDeleted
}: {
  item: WardrobeItem;
  onClose: () => void;
  onSaved: (item: WardrobeItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [fields, setFields] = useState<ItemFields>({
    name: item.name,
    category: item.category,
    colors: item.colors,
    pattern: item.pattern,
    styles: item.styles,
    warmth: item.warmth,
    formality: item.formality,
    notes: item.notes
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await updateItem({ ...item, ...fields, name: fields.name.trim() || item.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete “${item.name}” from your closet?`)) return;
    setBusy(true);
    try {
      await deleteItem(item.id);
      onDeleted(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Edit ${item.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="card-heading">
          <h2>Edit item</h2>
          <button className="text-button" type="button" onClick={onClose}>Close</button>
        </div>
        <ItemImage blob={item.image} alt={item.name} className="sheet-image" />
        {!item.embedding && <p className="hint">Not auto-tagged yet. Use Settings → “Analyse untagged items” to enable vibe matching.</p>}
        <ItemForm idPrefix={item.id} value={fields} onChange={setFields} />
        {error && <p className="error">{error}</p>}
        <div className="button-row">
          <button className="secondary-button danger" type="button" disabled={busy} onClick={remove}>Delete</button>
          <button className="primary-button" type="button" disabled={busy} onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
