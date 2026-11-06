import type { Inputs } from './engine';
import { ALL_FIELDS } from './fields';

// Lab ekranı / cihaz çıktısı metninden değer ayıklama — OCR'dan bağımsız, saf fonksiyonlar.

export interface Found {
  key: keyof Inputs;
  value: number; // seçilen birimde
  unitIdx: number;
  line: string; // değerin okunduğu satır (kontrol için)
  fixed?: boolean; // ondalık / birim tahminle düzeltildi
  prio: number;
}

interface Pat {
  key: keyof Inputs;
  re: RegExp;
  skip?: RegExp; // satır bunu içeriyorsa bu anahtar için kullanılmaz
  low?: RegExp; // satır bunu içeriyorsa düşük öncelik (ör. standart HCO₃⁻)
  urine?: boolean;
}

// Sıra önemli: aynı konumda eşleşen iki etiketten öndeki kazanır.
const NB = '(?:^|[^a-z0-9])'; // kelime başı (rakamlar dahil)
const O2 = '(?:2|z(?![a-z]))'; // OCR "2"yi sık sık "z" okur (s0z, poz)
const PATS: Pat[] = [
  { key: 'uNa', re: new RegExp(NB + '(?:na\\b|sodyum|sodium)'), urine: true },
  { key: 'uK', re: new RegExp(NB + '(?:k\\b|potasyum|potassium)'), urine: true },
  { key: 'uCl', re: new RegExp(NB + '(?:cl\\b|klor|chlor)'), urine: true },

  { key: 'pCO2', re: new RegExp(NB + 'p\\s*[av]?\\s*c\\s*[o0]\\s*' + O2), skip: /\(t\)/ },
  { key: 'pO2', re: new RegExp(NB + 'p\\s*[av]?\\s*[o0]\\s*' + O2), skip: /\(t\)|\(a|a\s*-\s*a|\/\s*f|p\s*50|ratio|oran/ },
  { key: 'pH', re: new RegExp(NB + 'ph(?![a-z])'), skip: /\(t\)/ },
  { key: 'HCO3', re: /(?:hc|c[il1]c|h[o0])[o0]\s*3|bikarbonat|bicarb/, low: /[,(\s]st\b|std|stand/ },
  { key: 'BE', re: new RegExp(NB + '(?:a?s?be(?![a-z])|c\\s*base|baz\\s*(?:fazla|a[cç])|base\\s*exc)'), low: /\(b\)|\bab?e\b/ },
  { key: 'COHb', re: /c\s*[o0]\s*hb|karboksi/ },
  { key: 'MetHb', re: /met\s*hb|methem/ },
  { key: 'sO2', re: new RegExp(NB + '(?:c?s\\s*[o0]\\s*' + O2 + '|[o0]2\\s*sat|satur)'), skip: /sp\s*[o0]2/ },
  { key: 'SpO2', re: /sp\s*[o0]\s*2/ },
  { key: 'FiO2', re: new RegExp(NB + '(?:f\\s*[i1l]\\s*[o0]\\s*2|f\\s*[o0]\\s*2\\s*\\(i\\))'), skip: /ratio|oran|\/|p\s*[o0]\s*2/ },
  { key: 'patm', re: new RegExp(NB + '(?:baro|atm(?![a-z])|atmosfer)') },
  { key: 'AGdirect', re: new RegExp(NB + '(?:an[i1]on\\s*gap|any[o0]n\\s*a[cç]|ag(?![a-z]))'), low: /k\s*\+/ },
  { key: 'Na', re: new RegExp(NB + '(?:c?na\\s*\\+?(?![a-z])|sodyum|sodium)') },
  { key: 'K', re: new RegExp(NB + '(?:c?k\\s*\\+|k(?![a-z/])|potasyum|potassium)') },
  { key: 'Cl', re: new RegExp(NB + '(?:c?cl\\s*-?(?![a-z])|klor|chlor)') },
  { key: 'iCa', re: new RegExp(NB + '(?:c?ca\\s*(?:2\\s*\\+|\\+\\s*\\+|2(?![0-9]))|i\\s*ca(?![a-z])|ionized)|yoni[sz]e'), skip: /\(7[.,]4\)/ }, // ryonize = iyonize
  { key: 'lactate', re: new RegExp(NB + '(?:c?lac|lakt|lact)') },
  { key: 'glucose', re: new RegExp(NB + '(?:c?glu|gluk|glik)') },
  { key: 'ketone', re: /keton|ketone|b\s*-?\s*hb\b|bhb|hidroksib|hydroxyb/ },
  { key: 'albumin', re: new RegExp(NB + 'alb') },
  { key: 'bun', re: new RegExp(NB + '(?:bun(?![a-z])|ure(?:a)?(?![a-z]))') },
  { key: 'creatinine', re: new RegExp(NB + '(?:kreat|creat|crea(?![a-z]))') },
  { key: 'osmMeasured', re: new RegExp(NB + 'osm'), skip: /gap|acik|hesap|calc/ },
  { key: 'ethanol', re: /etanol|ethanol|alkol|alcohol|etoh/ },
  { key: 'Hb', re: new RegExp(NB + '(?:c?t\\s*hb|hb(?![a-z])|hgb|hemoglob|haemoglob)') },
];

// İç birimde kabul edilebilir aralık — OCR çöpünü ve kayık ondalığı ayıklamak için
const RANGE: Partial<Record<keyof Inputs, [number, number]>> = {
  pH: [6.5, 8], pCO2: [5, 200], pO2: [10, 700], HCO3: [1, 60], BE: [-40, 40], sO2: [10, 100], SpO2: [40, 100],
  FiO2: [21, 100], patm: [400, 800], Na: [90, 200], Cl: [50, 150], K: [1, 12], iCa: [0.3, 3], AGdirect: [-10, 60],
  lactate: [0, 30], glucose: [10, 2000], albumin: [0.5, 7], bun: [1, 300], creatinine: [0.1, 25], ketone: [0, 15],
  osmMeasured: [200, 500], ethanol: [0, 1000], Hb: [2, 25], COHb: [0, 80], MetHb: [0, 80], uNa: [0, 400], uK: [0, 400], uCl: [0, 400],
};

const FIELD = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));

export function normalize(s: string): string {
  return s
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/̇/g, '')
    .replace(/ı/g, 'i').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/₂/g, '2').replace(/₃/g, '3').replace(/[⁺]/g, '+').replace(/[⁻−–—]/g, '-').replace(/β/g, 'b')
    .replace(/[|]/g, ' ');
}

/** Satırın geri kalanındaki birim yazısına göre alan birimi */
function unitFromText(key: keyof Inputs, rest: string): number | undefined {
  const f = FIELD[key as string];
  if (!f || f.units.length < 2) return undefined;
  const idx = (pred: (u: string) => boolean) => {
    const i = f.units.findIndex((u) => pred(u.u.toLowerCase()));
    return i >= 0 ? i : undefined;
  };
  const cands: [RegExp, (u: string) => boolean][] = [
    [/kpa/, (u) => u === 'kpa'],
    [/mmhg/, (u) => u === 'mmhg'],
    [/[uµμ]\s*mol/, (u) => u.includes('µmol')],
    [/(?:^|[^uµμ])mmol/, (u) => u.includes('mmol')],
    [/mg\s*\/\s*d/, (u) => key !== 'bun' && u.includes('mg/dl')], // üre/BUN ayrımı etiketten
    [/(?:^|[^m])g\s*\/\s*l/, (u) => u === 'g/l'],
    [/(?:^|[^m])g\s*\/\s*d/, (u) => u === 'g/dl'],
  ];
  // Satırda ilk geçen birim kazanır (referans aralığında başka birim olabilir)
  let first: { at: number; pred: (u: string) => boolean } | null = null;
  for (const [re, pred] of cands) {
    const m = re.exec(rest);
    if (m && (!first || m.index < first.at)) first = { at: m.index, pred };
  }
  return first ? idx(first.pred) : undefined;
}

function plausible(key: keyof Inputs, v: number, unitIdx: number): boolean {
  const rg = RANGE[key];
  const f = FIELD[key as string];
  if (!rg || !f) return true;
  const x = f.units[unitIdx].toInt(v);
  return x >= rg[0] && x <= rg[1];
}

/** Okunan sayı + birim ipucundan en makul (değer, birim) çifti */
function resolve(key: keyof Inputs, raw: string, hint: number | undefined, defUnit: number): { value: number; unitIdx: number; fixed: boolean } | null {
  const v = Number(raw.replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  const f = FIELD[key as string];
  const nU = f ? f.units.length : 1;
  const order = [hint ?? defUnit, ...Array.from({ length: nU }, (_, i) => i).filter((i) => i !== (hint ?? defUnit))];
  // FiO2 0,21–1 → ondalık
  if (key === 'FiO2' && v > 0 && v <= 1) return { value: v, unitIdx: 1, fixed: false };
  // "06" → 0,6: baştaki sıfırdan sonra virgül düşmüş
  if (/^0\d+$/.test(raw)) {
    const w = Number('0.' + raw.slice(1));
    if (plausible(key, w, order[0])) return { value: w, unitIdx: order[0], fixed: true };
  }
  if (plausible(key, v, order[0])) return { value: v, unitIdx: order[0], fixed: false };
  // Virgül/nokta kaybolmuş olabilir (7312 → 7,312): sağdan ondalık eklemeyi dene
  if (/^-?\d{2,5}$/.test(raw)) {
    for (let d = 1; d < raw.replace('-', '').length; d++) {
      const w = v / 10 ** d;
      if (plausible(key, w, order[0])) return { value: Number(w.toFixed(d)), unitIdx: order[0], fixed: true };
    }
  }
  // Birim yazılmamışsa diğer birimleri dene (glukoz 7,8 → mmol/L)
  if (hint === undefined) for (const u of order.slice(1)) if (plausible(key, v, u)) return { value: v, unitIdx: u, fixed: true };
  return null;
}

const NUM = /(?:^|[^0-9a-z.,])(-?\d+(?:[.,]\d+)?)(?![0-9])/g;
// Tarih / saat (kümülatif LIS ekranları): 6.11.2026 · 06/11/26 · noktası düşmüş 611.2026 · 14:10(:22)
const REF = /\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?/g;
const DATE = /\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}|\d{1,4}[.,/-](?:19|20)\d\d(?![0-9])|\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?/g;

/** Tek satırdan en fazla bir değer */
export function parseLine(line: string): Found | null {
  const n = normalize(line);
  const isUrine = /idrar|urine|\bu\s*-\s*(?:na|k|cl)|spot/.test(n);
  const hits: { p: Pat; at: number; end: number }[] = [];
  for (const p of PATS) {
    if (!!p.urine !== isUrine) continue;
    if (p.skip && p.skip.test(n)) continue;
    const m = p.re.exec(n);
    if (!m) continue;
    const at = m.index + (/^[^a-z0-9]/.test(m[0]) ? 1 : 0); // önündeki ayırıcıyı sayma
    hits.push({ p, at, end: m.index + m[0].length });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.at - b.at); // kararlı sıralama: aynı konumda listede öndeki kalır
  // Kısa etiket (BE, K, Hb…) ile sayı arasında başka etiket varsa kısa olan muhtemelen çöp
  // (onay kutusu "BE" / "El" okunur): sayıya en yakın etiketi al
  let bi = 0;
  while (bi + 1 < hits.length && hits[bi].end - hits[bi].at <= 3) {
    const d = n.slice(hits[bi].end).search(/\d/);
    if (d < 0 || hits[bi + 1].at >= hits[bi].end + d) break;
    bi++;
  }
  const best = hits[bi];
  // Tarih/saat ve referans aralıkları ("3.4 - 5.5") değer sanılmasın
  const rest = n.slice(best.end).replace(DATE, ' ').replace(REF, ' ');
  const key = best.p.key;
  const defUnit = key === 'bun' && /bun/.test(n.slice(best.at, best.end)) ? 1 : 0;
  // İlk makul sayı alınır; ilki çöpse sonraki ikisine bakılır (tahmin olarak işaretlenir)
  const nums = [...rest.matchAll(NUM)].slice(0, 3);
  for (let i = 0; i < nums.length; i++) {
    const m = nums[i];
    let raw = m[1];
    if (raw.startsWith('-') && key !== 'BE' && key !== 'AGdirect') raw = raw.slice(1); // "HCO3-22" → tire etiketin parçası
    const ctx = rest.slice(0, (m.index || 0) + m[0].length + 24); // birim değerden önce de yazılmış olabilir
    const r = resolve(key, raw, unitFromText(key, ctx), defUnit);
    if (r) return { key, value: r.value, unitIdx: r.unitIdx, fixed: r.fixed || i > 0, line: line.trim(), prio: best.p.low && best.p.low.test(n) ? 0 : 1 };
  }
  return null;
}

/**
 * Birden fazla metin (fotoğraf × okuma geçişi) → anahtar başına tek değer.
 * Oylama: önce öncelik (ör. gerçek HCO₃⁻ > standart), sonra kaç metinde aynı değerin okunduğu, sonra ilk bulunan.
 */
export function parseTexts(texts: string[]): Found[] {
  const votes = new Map<string, Map<string, { f: Found; n: number; first: number }>>();
  let seq = 0;
  for (const t of texts) {
    const seen = new Set<string>(); // aynı metinde aynı değer bir kez oy verir
    for (const line of t.split(/\r?\n/)) {
      if (line.trim().length < 3) continue;
      const f = parseLine(line);
      if (!f) continue;
      const k = f.key as string;
      const vk = `${f.prio}|${f.value}|${f.unitIdx}`;
      if (seen.has(k + vk)) continue;
      seen.add(k + vk);
      if (!votes.has(k)) votes.set(k, new Map());
      const m = votes.get(k)!;
      const v = m.get(vk);
      if (v) v.n++;
      else m.set(vk, { f, n: 1, first: seq++ });
    }
  }
  const out: Found[] = [];
  for (const m of votes.values()) {
    const best = [...m.values()].sort((a, b) => b.f.prio - a.f.prio || b.n - a.n || a.first - b.first)[0];
    out.push(best.f);
  }
  const order = ALL_FIELDS.map((f) => f.key);
  return out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export interface Word { text: string; x0: number; y0: number; x1: number; y1: number }

/** Sütunlu ekranlarda etiket ve değeri aynı satıra toplamak için kelimeleri dikey konuma göre satırlara diz */
export function rowsFromWords(words: Word[]): string {
  const ws = words.filter((w) => w.text.trim()).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const rows: { cy: number; h: number; ws: Word[] }[] = [];
  for (const w of ws) {
    const cy = (w.y0 + w.y1) / 2;
    const h = w.y1 - w.y0;
    const r = rows.find((r) => Math.abs(r.cy - cy) < Math.max(r.h, h) * 0.5);
    if (r) {
      r.ws.push(w);
      r.cy = (r.cy * (r.ws.length - 1) + cy) / r.ws.length;
    } else rows.push({ cy, h, ws: [w] });
  }
  return rows
    .sort((a, b) => a.cy - b.cy)
    .map((r) => r.ws.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' '))
    .join('\n');
}
