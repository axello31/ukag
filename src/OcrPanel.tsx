import { useEffect, useMemo, useRef, useState } from 'react';
import type { Inputs } from './engine';
import { ALL_FIELDS, flipSign } from './fields';
import { parseTexts } from './ocr';
import { log, readLog, type OcrOut } from './ocrRun';

export interface Applied { key: keyof Inputs; value: string; unitIdx: number }

interface Photo { id: number; file?: Blob; thumb?: string; status: 'bekliyor' | 'okunuyor' | 'tamam' | 'hata'; p: number; msg: string; out?: OcrOut }
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
  const galRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);

  const add = (fl: FileList | Blob[] | null) => {
    if (!fl) return;
    // Yalnızca dosya referansı tutulur; çözme/küçültme sırası gelince, tek tek yapılır
    const ps = Array.from(fl).filter((f) => f.type.startsWith('image/') || !f.type).map((file) => ({ id: ++seq, file, status: 'bekliyor' as const, p: 0, msg: 'Sırada' }));
    log(`${ps.length} foto eklendi`);
    setPhotos((x) => [...x, ...ps]);
  };
  const patch = (id: number, p: Partial<Photo>) => setPhotos((x) => x.map((ph) => (ph.id === id ? { ...ph, ...p } : ph)));

  // Fotoğrafları sırayla oku
  useEffect(() => {
    if (photos.some((p) => p.status === 'okunuyor')) return;
    const next = photos.find((p) => p.status === 'bekliyor');
    if (!next) return;
    const file = next.file!;
    patch(next.id, { status: 'okunuyor', msg: 'Foto küçültülüyor', file: undefined });
    let last = { p: -1, s: '' };
    const onProg = (p: number, s: string) => {
      // her ilerleme olayında yeniden çizme — telefonda arayüzü kilitliyor
      if (s === last.s && p - last.p < 0.1 && p < 1) return;
      last = { p, s };
      patch(next.id, { p, msg: STATUS[s] || 'Hazırlanıyor' });
    };
    import('./ocrRun')
      .then(async ({ shrink, recognize }) => {
        const { blob, thumb } = await shrink(file);
        patch(next.id, { thumb, msg: 'Hazırlanıyor' });
        return recognize(blob, onProg);
      })
      .then((out) => patch(next.id, { status: 'tamam', out, p: 1, msg: 'Okundu' }))
      .catch((e) => {
        console.error(e);
        log('hata: ' + e);
        patch(next.id, { status: 'hata', msg: navigator.onLine ? 'Okunamadı' : 'İlk kullanımda internet gerekli' });
      });
  }, [photos]);

  const busy = photos.some((p) => p.status === 'okunuyor' || p.status === 'bekliyor');
  useEffect(() => {
    if (!busy && photos.length) import('./ocrRun').then((m) => m.release());
  }, [busy, photos.length]);
  useEffect(() => () => void import('./ocrRun').then((m) => m.release()), []);

  const [prevLog] = useState(readLog);

  const doneKey = photos.filter((p) => p.out).map((p) => p.id).join(',');
  const found = useMemo(() => parseTexts(photos.flatMap((p) => p.out?.texts ?? [])), [doneKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const ed = (k: string): Edit => {
    const f = found.find((x) => x.key === k)!;
    return edits[k] || { on: true, value: String(f.value).replace('.', ','), unitIdx: f.unitIdx };
  };
  const setEd = (k: string, e: Partial<Edit>) => setEdits((s) => ({ ...s, [k]: { ...ed(k), ...e } }));
  const chosen = found.filter((f) => ed(f.key as string).on && ed(f.key as string).value.trim());
  const done = photos.filter((p) => p.status === 'tamam');

  const apply = () => {
    onApply(chosen.map((f) => ({ key: f.key, value: ed(f.key as string).value.trim(), unitIdx: ed(f.key as string).unitIdx })));
    onClose();
  };

  return (
    <>
    <div className="modal-bg ocr-bg" onClick={onClose}>
      <div className="modal ocr" role="dialog" aria-modal="true" aria-label="Fotoğraftan oku" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>Fotoğraftan oku</h2>
          <button className="x" onClick={onClose} aria-label="Kapat">×</button>
        </div>
        <div className="modal-b">
          <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <div className="ocr-actions">
            <button className="ocr-btn primary" onClick={() => galRef.current?.click()}>🖼 {photos.length ? 'Fotoğraf ekle' : 'Fotoğrafları seç'}</button>
          </div>
          {!photos.length && (
            <ul className="ocr-tips">
              <li>Önce telefonun <b>Kamera</b> uygulamasıyla ekranı çekin (birden fazla ekransa her birini ayrı), sonra buradan <b>hepsini birlikte seçin</b>; değerler birleştirilir.</li>
              <li>Ekrana <b>dik</b>, parlamasız ve tablo kadrajı dolduracak şekilde çekin. Monitörde dalgalı desen görürseniz telefonu biraz uzaklaştırın veya hafif açı verin.</li>
              <li>Okuma <b>tamamen telefonunuzda</b> yapılır; fotoğraf hiçbir sunucuya gönderilmez. İlk kullanımda OCR dil verisi (~5 MB) bir kez indirilir.</li>
            </ul>
          )}

          {photos.length > 0 && (
            <div className="ocr-photos">
              {photos.map((p) => (
                <div key={p.id} className={`ocr-ph st-${p.status}`}>
                  {p.thumb ? <img src={p.thumb} alt="" /> : <span className="ocr-ph-ph" aria-hidden>📷</span>}
                  <div className="ocr-ph-s">
                    <span>{p.msg}</span>
                    {p.status === 'okunuyor' && <span className="ocr-bar"><i style={{ width: `${Math.round(p.p * 100)}%` }} /></span>}
                  </div>
                  <button className="x" aria-label="Fotoğrafı çıkar" onClick={() => { setPhotos((x) => x.filter((y) => y.id !== p.id)); }} >×</button>
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
                            {fd.neg && <button type="button" className="sign" onClick={() => setEd(k, { value: flipSign(e.value) })} aria-label={`${label} işaretini değiştir`}>±</button>}
                            <input inputMode="decimal" value={e.value} onChange={(x) => setEd(k, { value: x.target.value })} aria-label={label} />
                            {fd.units.length > 1 ? (
                              <select className="unit" value={e.unitIdx} onChange={(x) => setEd(k, { unitIdx: Number(x.target.value) })} aria-label={`${label} birimi`}>
                                {fd.units.map((u, i) => <option key={u.u} value={i}>{u.u}</option>)}
                              </select>
                            ) : fd.units[0].u ? <span className="unit static">{fd.units[0].u}</span> : null}
                          </div>
                          <div className="ocr-src">
                            {f.fixed && <span className="ocr-guess" title="Okunan sayıda virgül/birim yoktu; makul aralığa göre düzeltildi (ör. 1167 → 116,7). Fotoğrafla karşılaştırın.">düzeltildi</span>}
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
          {prevLog.length > 0 && (
            <details className="ocr-raw">
              <summary>Tanı günlüğü</summary>
              <pre>{prevLog.join('\n')}</pre>
            </details>
          )}
        </div>
        <div className="ocr-foot">
          <button className="ghost" onClick={onClose}>Vazgeç</button>
          <button className="ocr-btn primary" disabled={!chosen.length} onClick={() => setConfirm(true)}>
            {busy && !chosen.length ? 'Okunuyor…' : `Forma aktar${chosen.length ? ` (${chosen.length})` : ''}`}
          </button>
        </div>
        {confirm && (
          <div className="ocr-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ocr-c-h">
            <div className="ocr-confirm-box">
              <h3 id="ocr-c-h">⚠ Değerleri kontrol edin</h3>
              <p>Fotoğraftan okunan değerler <b>hatalı olabilir</b>. Forma aktardıktan sonra her değeri lab ekranıyla karşılaştırın; hatalı aktarılmış veya eksik değerleri <b>elle düzeltin</b>.</p>
              <p className="tiny muted">Aktarılan alanlar formda sarı çerçeveyle işaretlenir.</p>
              <div className="ocr-confirm-b">
                <button className="ghost" onClick={() => setConfirm(false)}>Geri dön</button>
                <button className="ocr-btn primary" onClick={apply}>Anladım, aktar ({chosen.length})</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
