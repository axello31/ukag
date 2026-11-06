import type { Worker } from 'tesseract.js';
import { rowsFromWords, type Word } from './ocr';

// Tesseract.js yalnızca ilk kullanımda yüklenir; tanıma tamamen tarayıcıda yapılır, görüntü hiçbir yere gönderilmez.

let workerP: Promise<Worker> | null = null;
let onProgress: ((p: number, status: string) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerP) {
    workerP = import('tesseract.js').then(({ createWorker }) =>
      createWorker(['eng', 'tur'], 1, {
        logger: (m) => onProgress?.(m.progress, m.status),
      }),
    );
    workerP.catch(() => (workerP = null));
  }
  return workerP;
}

/** Fotoğrafı OCR için hazırla: yönü düzelt, ölçekle, gri tona çevir, kontrastı ger */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const long = Math.max(bmp.width, bmp.height);
  const scale = long > 2000 ? 2000 / long : long < 1200 ? 1200 / long : 1; // iPhone belleği için üst sınır
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
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
  return c;
}

export interface OcrOut {
  rows: string; // kelimelerden yeniden dizilmiş satırlar (sütunlu ekranlar için)
  text: string; // Tesseract'ın kendi satırları
}

export async function recognize(file: Blob, progress: (p: number, status: string) => void): Promise<OcrOut> {
  onProgress = progress;
  progress(0, 'hazırlanıyor');
  const [canvas, worker] = await Promise.all([prepare(file), getWorker()]);
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 120000));
  const { data } = await Promise.race([worker.recognize(canvas, {}, { text: true, blocks: true }), timeout]).finally(() => {
    canvas.width = canvas.height = 0; // görüntü belleğini hemen bırak
  });
  const words: Word[] = [];
  for (const b of data.blocks || [])
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const w of l.words) words.push({ text: w.text, ...w.bbox });
  onProgress = null;
  return { rows: rowsFromWords(words), text: data.text };
}

/** Kuyruk boşalınca motoru kapat: iOS'ta bellek dolunca kamera açılmıyor / sayfa donuyor */
export async function release(): Promise<void> {
  const p = workerP;
  workerP = null;
  if (p) await p.then((w) => w.terminate()).catch(() => undefined);
}
