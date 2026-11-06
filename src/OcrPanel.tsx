import { useEffect, useMemo, useRef, useState } from 'react';
import type { Inputs } from './engine';
import { ALL_FIELDS } from './fields';
import { parseTexts } from './ocr';
import type { OcrOut } from './ocrRun';

export interface Applied { key: keyof Inputs; value: string; unitIdx: number }

interface Photo { id: number; url: string; file: File; status: 'bekliyor' | 'okunuyor' | 'tamam' | 'hata'; p: number; msg: string; out?: OcrOut }
interface Edit { on: boolean; value: string; unitIdx: number }

const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));
const STATUS: Record<string, string> = {
  'loading tesseract core': 'OCR motoru yükleniyor',
  'initializing tesseract': 'OCR motoru başlatılıyor',
  'loading language traineddata': 'Dil verisi indiriliyor (yalnızca ilk sefer)',
  'initializing api': 'Hazırlanıyor',
  'recognizing text': 'Metin okunuyor',
};
let seq = 0;

export default function OcrPanel({ isVen, onApply, onClose }: { isVen: boolean; onApply: (a: Applied[]) => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const add = (fl: FileList | null) => {
    if (!fl) return;
    const ps = Array.from(fl).filter((f) => f.type.startsWith('image/')).map((file) => ({ id: ++seq, url: URL.createObjectURL(file), file, status: 'bekliyor' as const, p: 0, msg: 'Sırada' }));
    setPhotos((x) => [...x, ...ps]);
  };
  const patch = (id: number, p: Partial<Photo>) => setPhotos((x) => x.map((ph) => (ph.id === id ? { ...ph, ...p } : ph)));

  // Fotoğrafları sırayla oku
  useEffect(() => {
    if (photos.some((p) => p.status === 'okunuyor')) return;
    const next = photos.find((p) => p.status === 'bekliyor');
    if (!next) return;
    patch(next.id, { status: 'okunuyor', msg: 'Hazırlanıyor' });
    import('./ocrRun')
      .then(({ recognize }) => recognize(next.file, (p, s) => patch(next.id, { p, msg: STATUS[s] || 'Hazırlanıyor' })))
      .then((out) => patch(next.id, { status: 'tamam', out, p: 1, msg: 'Okundu' }))
      .catch((e) => {
        console.error(e);
        patch(next.id, { status: 'hata', msg: navigator.onLine ? 'Okunamadı' : 'İlk kullanımda internet gerekli' });
      });
  }, [photos]);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const found = useMemo(() => parseTexts(photos.flatMap((p) => (p.out ? [p.out.rows, p.out.text] : []))), [photos]);
  const ed = (k: string): Edit => {
    const f = found.find((x) => x.key === k)!;
    return edits[k] || { on: true, value: String(f.value).replace('.', ','), unitIdx: f.unitIdx };
  };
  const setEd = (k: string, e: Partial<Edit>) => setEdits((s) => ({ ...s, [k]: { ...ed(k), ...e } }));
  const busy = photos.some((p) => p.status === 'okunuyor' || p.status === 'bekliyor');
  const chosen = found.filter((f) => ed(f.key as string).on && ed(f.key as string).value.trim());
  const done = photos.filter((p) => p.status === 'tamam');

  const apply = () => {
    onApply(chosen.map((f) => ({ key: f.key, value: ed(f.key as string).value.trim(), unitIdx: ed(f.key as string).unitIdx })));
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal ocr" role="dialog" aria-modal="true" aria-label="Fotoğraftan oku" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>Fotoğraftan oku</h2>
          <button className="x" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        <div className="modal-b">
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <div className="ocr-actions">
            <button className="ocr-btn primary" onClick={() => camRef.current?.click()}>📷 {photos.length ? 'Bir foto daha çek' : 'Fotoğraf çek'}</button>
            <button className="ocr-btn" onClick={() => galRef.current?.click()}>🖼 Galeriden seç</button>
          </div>
          {!photos.length && (
            <ul className="ocr-tips">
              <li>Lab ekranını veya kan gazı cihazı çıktısını <b>dik açıyla, yakından ve parlamasız</b> çekin; değer tablosu kadraja tam sığsın.</li>
              <li>Değerler birden fazla ekrandaysa (gaz, elektrolit, biyokimya) her birini ayrı çekin; hepsi birleştirilir.</li>
              <li>Okuma <b>tamamen telefonunuzda</b> yapılır; fotoğraf hiçbir sunucuya gönderilmez. İlk kullanımda OCR dil verisi (~10 MB) bir kez indirilir.</li>
            </ul>
          )}

          {photos.length > 0 && (
            <div className="ocr-photos">
              {photos.map((p) => (
                <div key={p.id} className={`ocr-ph st-${p.status}`}>
                  <img src={p.url} alt="" />
                  <div className="ocr-ph-s">
                    <span>{p.msg}</span>
                    {p.status === 'okunuyor' && <span className="ocr-bar"><i style={{ width: `${Math.round(p.p * 100)}%` }} /></span>}
                  </div>
                  <button className="x" aria-label="Fotoğrafı çıkar" onClick={() => { URL.revokeObjectURL(p.url); setPhotos((x) => x.filter((y) => y.id !== p.id)); }} disabled={p.status === 'okunuyor'}>×</button>
                </div>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <>
              <h4>{found.length ? `Bulunan değerler (${found.length})` : 'Tanınan değer bulunamadı'}</h4>
              {found.length > 0 ? (
                <>
                  <p className="tiny warn-t">Her değeri fotoğrafla karşılaştırarak kontrol edin. Hatalıysa düzeltin veya işaretini kaldırın.</p>
                  <div className="ocr-list">
                    {found.map((f) => {
                      const k = f.key as string;
                      const fd = FIELD[k];
                      const e = ed(k);
                      const label = isVen && fd.venLabel ? fd.venLabel : fd.label;
                      return (
                        <div key={k} className={`ocr-row ${e.on ? '' : 'off'}`}>
                          <label className="ocr-chk"><input type="checkbox" checked={e.on} onChange={(x) => setEd(k, { on: x.target.checked })} /> <b>{label}</b></label>
                          <div className="field-in">
                            <input inputMode="decimal" value={e.value} onChange={(x) => setEd(k, { value: x.target.value })} aria-label={label} />
                            {fd.units.length > 1 ? (
                              <select className="unit" value={e.unitIdx} onChange={(x) => setEd(k, { unitIdx: Number(x.target.value) })} aria-label={`${label} birimi`}>
                                {fd.units.map((u, i) => <option key={u.u} value={i}>{u.u}</option>)}
                              </select>
                            ) : fd.units[0].u ? <span className="unit static">{fd.units[0].u}</span> : null}
                          </div>
                          <div className="ocr-src">
                            {f.fixed && <span className="ocr-guess" title="Ondalık nokta veya birim tahmin edildi">tahmin</span>}
                            <code>{f.line}</code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="muted">Daha yakından, dik açıyla ve parlamasız tekrar çekmeyi deneyin.</p>
              )}
              <details className="ocr-raw">
                <summary>Okunan ham metin</summary>
                {done.map((p, i) => <pre key={p.id}>{done.length > 1 ? `— Foto ${i + 1} —\n` : ''}{p.out!.text.trim() || '(boş)'}</pre>)}
              </details>
            </>
          )}
        </div>
        <div className="ocr-foot">
          <button className="ghost" onClick={onClose}>Vazgeç</button>
          <button className="ocr-btn primary" disabled={busy || !chosen.length} onClick={apply}>
            {busy ? 'Okunuyor…' : `Forma aktar${chosen.length ? ` (${chosen.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
