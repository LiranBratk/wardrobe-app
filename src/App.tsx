import { useCallback, useEffect, useState } from 'react';
import { AddFlow } from './components/AddFlow';
import { Closet } from './components/Closet';
import { Outfits } from './components/Outfits';
import { Settings } from './components/Settings';
import { listItems } from './lib/db';
import type { WardrobeItem } from './lib/types';

type Tab = 'outfits' | 'closet' | 'add' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'outfits', label: 'Outfits', icon: '✦' },
  { id: 'closet', label: 'Closet', icon: '▦' },
  { id: 'add', label: 'Add', icon: '+' },
  { id: 'settings', label: 'Backup', icon: '⇅' }
];

function App() {
  const [items, setItems] = useState<WardrobeItem[] | null>(null);
  const [tab, setTab] = useState<Tab>('outfits');
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const reload = useCallback(async () => {
    try {
      setItems(await listItems());
    } catch (e) {
      console.error(e);
      setLoadError('Could not open on-device storage. Private Browsing blocks it; try a normal Safari tab or the Home Screen app.');
      setItems([]);
    }
  }, []);

  useEffect(() => {
    listItems()
      .then((loaded) => {
        setItems(loaded);
        if (!loaded.length) setTab('add');
      })
      .catch((e) => {
        console.error(e);
        setLoadError('Could not open on-device storage. Private Browsing blocks it; try a normal Safari tab or the Home Screen app.');
        setItems([]);
      });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>Wardrobe</span>
        </span>
        <span className="privacy-pill"><span /> On-device only</span>
      </header>

      <main className="page">
        {loadError && <p className="error">{loadError}</p>}
        {items === null ? (
          <p className="hint center">Opening your closet…</p>
        ) : (
          <>
            <div hidden={tab !== 'outfits'}>
              <Outfits items={items} onGoToAdd={() => setTab('add')} />
            </div>
            {tab === 'closet' && (
              <Closet
                items={items}
                onAdd={() => setTab('add')}
                onChanged={(item) => setItems((all) => (all ?? []).map((i) => (i.id === item.id ? item : i)))}
                onDeleted={(id) => setItems((all) => (all ?? []).filter((i) => i.id !== id))}
              />
            )}
            <div hidden={tab !== 'add'}>
              <AddFlow
                onSaved={(saved) => {
                  setItems((all) => [...saved, ...(all ?? [])]);
                  setToast(`Saved ${saved.length} item${saved.length === 1 ? '' : 's'}.`);
                  setTab('closet');
                }}
              />
            </div>
            {tab === 'settings' && <Settings items={items} onReplaceAll={reload} />}
          </>
        )}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
