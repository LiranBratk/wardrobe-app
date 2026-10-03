import { useEffect, useState } from 'react';
import { MODEL_KEY } from '../lib/ai';
import { exportBackup, readBackup } from '../lib/backup';
import { canUseWebGPU, MODEL_ID, withImageEmbedder } from '../lib/clip';
import { clearItems, putItem, requestPersistentStorage, storageInfo } from '../lib/db';
import { normalize } from '../lib/tagging';
import type { WardrobeItem } from '../lib/types';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'unknown';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Wardrobe backup' });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Settings({ items, onReplaceAll }: { items: WardrobeItem[]; onReplaceAll: () => Promise<void> }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof storageInfo>> | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const untagged = items.filter((i) => !i.embedding || i.embeddingModel !== MODEL_KEY);

  const refresh = () => storageInfo().then(setInfo).catch(() => setInfo(null));
  useEffect(() => {
    void refresh();
  }, [items.length]);

  const guard = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      console.error(e);
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const doExport = () =>
    guard(async () => {
      setMessage('Packing backup…');
      const blob = await exportBackup(items);
      await shareOrDownload(blob, `wardrobe-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      setMessage(`Backup of ${items.length} items ready (${formatBytes(blob.size)}).`);
    });

  const doImport = (file: File) =>
    guard(async () => {
      const { items: restored, errors } = await readBackup(file);
      const existing = new Set(items.map((i) => i.id));
      const overwrite = restored.filter((i) => existing.has(i.id)).length;
      const ok = confirm(
        `Import ${restored.length} items${overwrite ? ` (${overwrite} will replace existing items with the same ID)` : ''}?` +
          (errors.length ? `\n${errors.length} invalid records will be skipped.` : '')
      );
      if (!ok) return;
      for (const item of restored) await putItem(item);
      await onReplaceAll();
      setMessage(`Imported ${restored.length} items.${errors.length ? ` Skipped: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '…' : ''}` : ''}`);
    });

  const doAnalyse = () =>
    guard(async () => {
      await withImageEmbedder(setMessage, async (embed) => {
        for (let i = 0; i < untagged.length; i++) {
          setMessage(`Analysing ${i + 1} of ${untagged.length}…`);
          const embedding = normalize(await embed(untagged[i].image));
          await putItem({ ...untagged[i], embedding, embeddingModel: MODEL_KEY, updatedAt: Date.now() });
        }
      });
      await onReplaceAll();
      setMessage('All items analysed. Your tags were kept as-is.');
    });

  const doClear = () =>
    guard(async () => {
      if (!confirm(`Delete all ${items.length} items from this phone? Export a backup first if you want to keep them.`)) return;
      if (!confirm('Really delete everything? This cannot be undone.')) return;
      await clearItems();
      await onReplaceAll();
      setMessage('Closet cleared.');
    });

  return (
    <section className="settings">
      <div className="card">
        <p className="eyebrow">Backup</p>
        <h2>Keep a copy</h2>
        <p className="card-copy">
          Safari can clear website data if storage runs low or the app is unused for a long time. Export a zip to Files or iCloud Drive
          regularly; import it to restore or move to a new phone.
        </p>
        <div className="button-row">
          <button className="primary-button" type="button" disabled={busy || !items.length} onClick={doExport}>Export backup</button>
          <label className={`secondary-button file-button ${busy ? 'disabled' : ''}`}>
            Import backup
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void doImport(f);
              }}
            />
          </label>
        </div>
        {message && <p className="hint" role="status">{message}</p>}
      </div>

      <div className="card">
        <p className="eyebrow">This device</p>
        <dl className="facts">
          <dt>Items</dt><dd>{items.length}</dd>
          <dt>Storage used</dt><dd>{formatBytes(info?.usage ?? null)}{info?.quota ? ` of ${formatBytes(info.quota)}` : ''}</dd>
          <dt>Protected from eviction</dt>
          <dd>
            {info?.persisted ? 'Yes' : 'No'}
            {!info?.persisted && (
              <button className="text-button" type="button" onClick={() => requestPersistentStorage().then(refresh)}>Request</button>
            )}
          </dd>
          <dt>Model runtime</dt><dd>{canUseWebGPU ? 'WebGPU (WASM fallback)' : 'WASM'}</dd>
        </dl>
        <p className="hint">Adding the app to your Home Screen makes Safari far less likely to clear its data.</p>
        {untagged.length > 0 && (
          <button className="secondary-button" type="button" disabled={busy} onClick={doAnalyse}>
            Analyse {untagged.length} untagged item{untagged.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="card">
        <p className="eyebrow">About</p>
        <p className="card-copy">
          Open source (MIT). Everything runs on this phone: photos, tags, and outfit picks never leave it. The only network requests
          download the app and the <a href={`https://huggingface.co/${MODEL_ID}`} target="_blank" rel="noreferrer">CLIP model</a> from
          Hugging Face, which is licensed separately. <a href="https://github.com/LiranBratk/wardrobe-app" target="_blank" rel="noreferrer">Source code</a>.
        </p>
        <button className="secondary-button danger" type="button" disabled={busy || !items.length} onClick={doClear}>Delete all items</button>
      </div>
    </section>
  );
}
