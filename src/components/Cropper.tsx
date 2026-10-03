import { useRef, useState, type PointerEvent } from 'react';
import type { CropRect } from '../lib/image';

type Mode = { kind: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'draw'; startX: number; startY: number; start: CropRect };

const MIN = 0.05;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function Cropper({ src, rect, onChange }: { src: string; rect: CropRect; onChange: (rect: CropRect) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  const point = (e: PointerEvent) => {
    const box = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - box.left) / box.width), y: clamp((e.clientY - box.top) / box.height) };
  };

  const begin = (requested: Mode['kind']) => (e: PointerEvent) => {
    e.stopPropagation();
    // A full-photo box can't move, so dragging inside it draws a new box instead.
    const kind = requested === 'move' && rect.w > 0.98 && rect.h > 0.98 ? 'draw' : requested;
    e.preventDefault();
    frame.current!.setPointerCapture(e.pointerId);
    const p = point(e);
    setMode({ kind, startX: p.x, startY: p.y, start: kind === 'draw' ? { x: p.x, y: p.y, w: 0, h: 0 } : rect });
  };

  const move = (e: PointerEvent) => {
    if (!mode) return;
    const p = point(e);
    const dx = p.x - mode.startX;
    const dy = p.y - mode.startY;
    const s = mode.start;
    let next: CropRect;
    switch (mode.kind) {
      case 'move':
        next = { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
        break;
      case 'draw':
        next = { x: Math.min(mode.startX, p.x), y: Math.min(mode.startY, p.y), w: Math.abs(dx), h: Math.abs(dy) };
        break;
      default: {
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;
        if (mode.kind.includes('w')) left = clamp(left + dx, 0, right - MIN);
        if (mode.kind.includes('e')) right = clamp(right + dx, left + MIN, 1);
        if (mode.kind.includes('n')) top = clamp(top + dy, 0, bottom - MIN);
        if (mode.kind.includes('s')) bottom = clamp(bottom + dy, top + MIN, 1);
        next = { x: left, y: top, w: right - left, h: bottom - top };
      }
    }
    onChange(next);
  };

  const end = () => {
    if (mode?.kind === 'draw' && (rect.w < MIN || rect.h < MIN)) onChange({ x: 0, y: 0, w: 1, h: 1 });
    setMode(null);
  };

  return (
    <div className="cropper" ref={frame} onPointerDown={begin('draw')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <img src={src} alt="Photo to crop" draggable={false} />
      <div className="crop-shade" style={{ clipPath: `polygon(0 0, 0 100%, ${rect.x * 100}% 100%, ${rect.x * 100}% ${rect.y * 100}%, ${(rect.x + rect.w) * 100}% ${rect.y * 100}%, ${(rect.x + rect.w) * 100}% ${(rect.y + rect.h) * 100}%, ${rect.x * 100}% ${(rect.y + rect.h) * 100}%, ${rect.x * 100}% 100%, 100% 100%, 100% 0)` }} />
      <div
        className="crop-box"
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
        onPointerDown={begin('move')}
      >
        {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
          <span key={h} className={`crop-handle ${h}`} onPointerDown={begin(h)} />
        ))}
      </div>
    </div>
  );
}
