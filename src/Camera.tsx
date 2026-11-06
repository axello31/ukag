import { useEffect, useRef, useState } from 'react';
import { log } from './ocrRun';

// Uygulama içi kamera (getUserMedia). iOS'ta ana ekrana eklenmiş uygulamada sistemin
// kamera/dosya seçicisinden dönünce sayfa donabiliyor; bu yol seçiciyi hiç açmaz.

export const canUseCamera = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export default function Camera({ count, onShot, onDone, onFail }: { count: number; onShot: (b: Blob) => void; onDone: () => void; onFail: (msg: string) => void }) {
  const vRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let dead = false;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } } })
      .then((s) => {
        if (dead) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = vRef.current!;
        v.srcObject = s;
        return v.play().then(() => {
          log(`kamera ${v.videoWidth}×${v.videoHeight}`);
          setReady(true);
        });
      })
      .catch((e) => {
        log('kamera hatası: ' + e);
        onFail(e?.name === 'NotAllowedError' ? 'Kamera izni verilmedi. Ayarlardan izin verin veya Galeriden seç’i kullanın.' : 'Kamera açılamadı; Galeriden seç’i kullanın.');
      });
    return () => {
      dead = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shoot = () => {
    const v = vRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      c.width = c.height = 0;
      if (b) onShot(b);
    }, 'image/jpeg', 0.92);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  };

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Kamera">
      <video ref={vRef} playsInline muted autoPlay />
      {flash && <div className="cam-flash" />}
      {!ready && <div className="cam-wait">Kamera açılıyor…</div>}
      <div className="cam-hint">Tabloyu kadraja sığdırın, dik ve parlamasız tutun</div>
      <div className="cam-bar">
        <span className="cam-n">{count > 0 ? `${count} foto` : ''}</span>
        <button className="cam-shutter" onClick={shoot} disabled={!ready} aria-label="Fotoğraf çek" />
        <button className="cam-done" onClick={onDone}>{count > 0 ? 'Bitti' : 'Kapat'}</button>
      </div>
    </div>
  );
}
