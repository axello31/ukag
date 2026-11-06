import { useEffect, useRef, useState } from 'react';

// Basit kırpma ekranı: köşelerden boyutlandır, içinden sürükle. Koordinatlar görüntüye göre 0–1.
export interface Rect { x: number; y: number; w: number; h: number }
type Drag = { mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; px: number; py: number; r: Rect };

const MIN = 0.08;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function Cropper({ url, index, total, onCrop, onRotate, onRemove }: {
  url: string; index: number; total: number; onCrop: (r: Rect | null) => void; onRotate: () => void; onRemove: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [r, setR] = useState<Rect>({ x: 0.04, y: 0.04, w: 0.92, h: 0.92 });
  const [box, setBox] = useState<DOMRect | null>(null);
  const drag = useRef<Drag | null>(null);

  // Görüntü değişince (yeni foto / döndürme) çerçeveyi sıfırla
  useEffect(() => setR({ x: 0.04, y: 0.04, w: 0.92, h: 0.92 }), [url]);
  useEffect(() => {
    const upd = () => imgRef.current && setBox(imgRef.current.getBoundingClientRect());
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const down = (mode: Drag['mode']) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, r };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !box) return;
    const dx = (e.clientX - d.px) / box.width;
    const dy = (e.clientY - d.py) / box.height;
    const o = d.r;
    let { x, y, w, h } = o;
    if (d.mode === 'move') {
      x = clamp(o.x + dx, 0, 1 - o.w);
      y = clamp(o.y + dy, 0, 1 - o.h);
    } else {
      if (d.mode === 'nw' || d.mode === 'sw') { x = clamp(o.x + dx, 0, o.x + o.w - MIN); w = o.x + o.w - x; }
      if (d.mode === 'ne' || d.mode === 'se') w = clamp(o.w + dx, MIN, 1 - o.x);
      if (d.mode === 'nw' || d.mode === 'ne') { y = clamp(o.y + dy, 0, o.y + o.h - MIN); h = o.y + o.h - y; }
      if (d.mode === 'sw' || d.mode === 'se') h = clamp(o.h + dy, MIN, 1 - o.y);
    }
    setR({ x, y, w, h });
  };
  const up = () => (drag.current = null);

  const st = box && imgRef.current
    ? (() => {
        const p = imgRef.current.parentElement!.getBoundingClientRect();
        return { left: box.left - p.left + r.x * box.width, top: box.top - p.top + r.y * box.height, width: r.w * box.width, height: r.h * box.height };
      })()
    : null;

  return (
    <div className="crop" role="dialog" aria-modal="true" aria-label="Fotoğrafı kırp">
      <div className="crop-top">
        <span>{total > 1 ? `Foto ${index}/${total} · ` : ''}Yalnızca <b>kan gazı tablosunu</b> çerçeveye alın</span>
      </div>
      <div className="crop-area" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img ref={imgRef} src={url} alt="" draggable={false} onLoad={(e) => setBox(e.currentTarget.getBoundingClientRect())} />
        {st && (
          <div className="crop-rect" style={st} onPointerDown={down('move')}>
            {(['nw', 'ne', 'sw', 'se'] as const).map((m) => <span key={m} className={`crop-h ${m}`} onPointerDown={down(m)} />)}
          </div>
        )}
      </div>
      <div className="crop-bar">
        <button className="crop-b" onClick={onRemove}>Çıkar</button>
        <button className="crop-b" onClick={onRotate}>↻ Döndür</button>
        <button className="crop-b" onClick={() => onCrop(null)}>Tamamı</button>
        <button className="crop-b primary" onClick={() => onCrop(r)}>Kırp ve oku</button>
      </div>
    </div>
  );
}
