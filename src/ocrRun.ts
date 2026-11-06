import { rowsFromWords, type Word } from './ocr';

// PaddleOCR (PP-OCRv4, ONNX) yalnızca ilk kullanımda yüklenir; tanıma tamamen tarayıcıda yapılır,
// görüntü hiçbir yere gönderilmez. Monitör fotoğraflarında (moiré, renkli zemin) Tesseract'tan çok daha isabetli.
// iPhone Safari'nin bellek sınırı dar: tam çözünürlüklü foto hiçbir zaman bellekte tutulmaz, hemen küçültülür.

const MAX_SIDE = 2048;
const MODELS = 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1.4.2/assets/';
const ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
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

type Engine = { detect: (url: string) => Promise<{ texts: { text: string; box?: number[][] }[] }> };
let engineP: Promise<Engine> | null = null;

function getEngine(): Promise<Engine> {
  if (!engineP) {
    log('motor yükleniyor');
    engineP = Promise.all([import('onnxruntime-web'), import('@gutenye/ocr-browser')]).then(async ([ort, { default: Ocr }]) => {
      ort.env.wasm.wasmPaths = ORT_WASM;
      ort.env.wasm.numThreads = 1; // iOS'ta SharedArrayBuffer yok
      const e = await Ocr.create({
        models: {
          detectionPath: MODELS + 'ch_PP-OCRv4_det_infer.onnx',
          recognitionPath: MODELS + 'ch_PP-OCRv4_rec_infer.onnx',
          dictionaryPath: MODELS + 'ppocr_keys_v1.txt',
        },
      });
      log('motor hazır');
      return e as unknown as Engine;
    });
    engineP.catch((e) => {
      log('motor hatası: ' + e);
      engineP = null;
    });
  }
  return engineP;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, q));

/**
 * Fotoğrafı küçült (yön düzeltilir). Orijinal görüntü hemen bırakılır.
 * Dönüş: OCR'a verilecek küçük JPEG ve listede gösterilecek minik önizleme.
 */
export async function shrink(file: Blob): Promise<{ blob: Blob; thumb: string }> {
  log(`foto ${Math.round(file.size / 1024)} KB çözülüyor`);
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  log(`foto ${bmp.width}×${bmp.height}`);
  const long = Math.max(bmp.width, bmp.height);
  const scale = long > MAX_SIDE ? MAX_SIDE / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();

  const t = document.createElement('canvas');
  const ts = 112 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * ts);
  t.height = Math.round(c.height * ts);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  const thumb = t.toDataURL('image/jpeg', 0.7);
  t.width = t.height = 0;

  const blob = await toBlob(c, 'image/jpeg', 0.92);
  c.width = c.height = 0; // iOS canvas belleğini hemen bırak
  log(`hazır ${Math.round(blob.size / 1024)} KB`);
  return { blob, thumb };
}

export interface OcrOut {
  texts: string[]; // satırlara dizilmiş metin (etiket · değer · birim aynı satırda)
  text: string; // gösterim için
}

export async function recognize(blob: Blob, progress: (p: number, status: string) => void): Promise<OcrOut> {
  progress(0.1, engineP ? 'hazırlanıyor' : 'model');
  const engine = await getEngine();
  progress(0.4, 'okunuyor');
  const url = URL.createObjectURL(blob);
  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 180000));
  try {
    const t0 = Date.now();
    const r = await Promise.race([engine.detect(url), timeout]);
    // PaddleOCR her hücreyi ayrı kutu olarak verir; kutuları satırlara dizip etiket ile değeri yan yana getir
    const words: Word[] = r.texts
      .filter((l) => l.box && l.text.trim())
      .map((l) => {
        const xs = l.box!.map((p) => p[0]);
        const ys = l.box!.map((p) => p[1]);
        return { text: l.text, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
      });
    log(`okundu: ${words.length} kutu, ${Date.now() - t0} ms`);
    const rows = rowsFromWords(words);
    return { texts: [rows], text: rows };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Panel kapanınca motoru bırak (model ~50 MB bellek tutar) */
export async function release(): Promise<void> {
  if (engineP) log('motor bırakıldı');
  engineP = null;
}
