import type { Worker } from 'tesseract.js';
import { rowsFromWords, type Word } from './ocr';

// Tesseract.js yalnızca ilk kullanımda yüklenir; tanıma tamamen tarayıcıda yapılır, görüntü hiçbir yere gönderilmez.
// iPhone Safari'nin bellek sınırı dar: tam çözünürlüklü foto hiçbir zaman bellekte tutulmaz, hemen küçültülür.

const MAX_SIDE = 1800;
const LOG = 'ukag_ocr_log';

/** Kısa tanı günlüğü — sayfa donup yenilenirse son adımlar görülebilsin */
export function log(msg: string) {
  try {
    const a: string[] = JSON.parse(localStorage.getItem(LOG) || '[]');
    a.push(`${new Date().toLocaleTimeString('tr-TR')} ${msg}`);
    localStorage.setItem(LOG, JSON.stringify(a.slice(-40)));
  } catch {
    /* depolama kapalı olabilir */
  }
}
export function readLog(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LOG) || '[]');
  } catch {
    return [];
  }
}

let workerP: Promise<Worker> | null = null;
let onProgress: ((p: number, status: string) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerP) {
    log('motor başlatılıyor');
    workerP = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, {
        logger: (m) => onProgress?.(m.progress, m.status),
      }),
    );
    workerP.catch((e) => {
      log('motor hatası: ' + e);
      workerP = null;
    });
  }
  return workerP;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, q));

/**
 * Fotoğrafı küçült ve OCR için hazırla (yön, gri ton, kontrast). Orijinal görüntü hemen bırakılır.
 * Dönüş: OCR'a verilecek küçük PNG ve listede gösterilecek minik önizleme.
 */
export async function shrink(file: Blob): Promise<{ blob: Blob; thumb: string }> {
  log(`foto ${Math.round(file.size / 1024)} KB çözülüyor`);
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  log(`foto ${bmp.width}×${bmp.height}`);
  const long = Math.max(bmp.width, bmp.height);
  const scale = long > MAX_SIDE ? MAX_SIDE / long : long < 1200 ? 1200 / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();

  const t = document.createElement('canvas');
  const ts = 112 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * ts);
  t.height = Math.round(c.height * ts);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  const thumb = t.toDataURL('image/jpeg', 0.7);
  t.width = t.height = 0;

  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    d[i] = g;
    hist[g | 0]++;
  }
  // %1–%99 aralığını 0–255'e ger (soluk ekran fotoğrafları için)
  const total = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  const span = Math.max(1, hi - lo);
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
    sum += v;
  }
  // Koyu zeminli ekran (açık yazı) → tersine çevir
  if (sum / total < 110) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
  ctx.putImageData(img, 0, 0);
  const blob = await toBlob(c, 'image/png');
  c.width = c.height = 0; // iOS canvas belleğini hemen bırak
  log(`hazır ${Math.round(blob.size / 1024)} KB`);
  return { blob, thumb };
}

export interface OcrOut {
  rows: string; // kelimelerden yeniden dizilmiş satırlar (sütunlu ekranlar için)
  text: string; // Tesseract'ın kendi satırları
}

export async function recognize(blob: Blob, progress: (p: number, status: string) => void): Promise<OcrOut> {
  onProgress = progress;
  const worker = await getWorker();
  log('okunuyor');
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 120000));
  try {
    const { data } = await Promise.race([worker.recognize(blob, {}, { text: true, blocks: true }), timeout]);
    const words: Word[] = [];
    for (const b of data.blocks || [])
      for (const p of b.paragraphs)
        for (const l of p.lines)
          for (const w of l.words) words.push({ text: w.text, ...w.bbox });
    log(`okundu, ${words.length} kelime`);
    return { rows: rowsFromWords(words), text: data.text };
  } finally {
    onProgress = null;
  }
}

/** Kuyruk boşalınca motoru kapat: iOS'ta bellek dolunca kamera açılmıyor / sayfa donuyor */
export async function release(): Promise<void> {
  const p = workerP;
  workerP = null;
  if (p) {
    log('motor kapatılıyor');
    await p.then((w) => w.terminate()).catch(() => undefined);
  }
}
