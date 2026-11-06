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
const PATS: Pat[] = [
  { key: 'uNa', re: new RegExp(NB + '(?:na\\b|sodyum|sodium)'), urine: true },
  { key: 'uK', re: new RegExp(NB + '(?:k\\b|potasyum|potassium)'), urine: true },
  { key: 'uCl', re: new RegExp(NB + '(?:cl\\b|klor|chlor)'), urine: true },

  { key: 'pCO2', re: new RegExp(NB + 'p\\s*[av]?\\s*c\\s*[o0]\\s*2'), skip: /\(t\)/ },
  { key: 'pO2', re: new RegExp(NB + 'p\\s*[av]?\\s*[o0]\\s*2'), skip: /\(t\)|\(a|a\s*-\s*a|\/\s*f|p\s*50|ratio|oran/ },
  { key: 'pH', re: new RegExp(NB + 'ph(?![a-z])'), skip: /\(t\)/ },
  { key: 'HCO3', re: /hc[o0]\s*3|bikarbonat|bicarb/, low: /[,(\s]st\b|std|stand/ },
  { key: 'BE', re: new RegExp(NB + '(?:a?s?be(?![a-z])|c\\s*base|baz\\s*(?:fazla|a[cç])|base\\s*exc)'), low: /\(b\)|\bab?e\b/ },
  { key: 'COHb', re: /c\s*[o0]\s*hb|karboksi/ },
  { key: 'MetHb', re: /met\s*hb|methem/ },
  { key: 'sO2', re: new RegExp(NB + '(?:c?s\\s*[o0]\\s*2|[o0]2\\s*sat|satur)'), skip: /sp\s*[o0]2/ },
  { key: 'SpO2', re: /sp\s*[o0]\s*2/ },
  { key: 'FiO2', re: new RegExp(NB + '(?:f\\s*[i1l]\\s*[o0]\\s*2|f\\s*[o0]\\s*2\\s*\\(i\\))'), skip: /ratio|oran|\/|p\s*[o0]\s*2/ },
  { key: 'patm', re: new RegExp(NB + '(?:baro|atm(?![a-z])|atmosfer)') },
  { key: 'AGdirect', re: new RegExp(NB + '(?:an[i1]on\\s*gap|any[o0]n\\s*a[cç]|ag(?![a-z]))'), low: /k\s*\+/ },
  { key: 'Na', re: new RegExp(NB + '(?:c?na\\s*\\+?(?![a-z])|sodyum|sodium)') },
  { key: 'K', re: new RegExp(NB + '(?:c?k\\s*\\+|k(?![a-z/])|potasyum|potassium)') },
  { key: 'Cl', re: new RegExp(NB + '(?:c?cl\\s*-?(?![a-z])|klor|chlor)') },
  { key: 'iCa', re: new RegExp(NB + '(?:c?ca\\s*(?:2\\s*\\+|\\+\\s*\\+|2(?![0-9]))|i\\s*ca(?![a-z])|iyonize|ionized)'), skip: /\(7[.,]4\)/ },
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

const NUM = /(?:^|[^0-9a-z.,])(-?\d+(?:[.,]\d+)?)(?![0-9])/;

/** Tek satırdan en fazla bir değer */
export function parseLine(line: string): Found | null {
  const n = normalize(line);
  const isUrine = /idrar|urine|\bu\s*-\s*(?:na|k|cl)|spot/.test(n);
  let best: { p: Pat; at: number; end: number } | null = null;
  for (const p of PATS) {
    if (!!p.urine !== isUrine) continue;
    if (p.skip && p.skip.test(n)) continue;
    const m = p.re.exec(n);
    if (!m) continue;
    const at = m.index + (/^[^a-z0-9]/.test(m[0]) ? 1 : 0); // önündeki ayırıcıyı sayma
    if (!best || at < best.at) best = { p, at, end: m.index + m[0].length };
  }
  if (!best) return null;
  const rest = n.slice(best.end);
  const m = NUM.exec(rest);
  if (!m) return null;
  const key = best.p.key;
  let raw = m[1];
  if (raw.startsWith('-') && key !== 'BE' && key !== 'AGdirect') raw = raw.slice(1); // "HCO3-22" → tire etiketin parçası
  const ctx = rest.slice(0, (m.index || 0) + m[0].length + 24); // birim değerden önce de yazılmış olabilir
  const defUnit = key === 'bun' && /bun/.test(n.slice(best.at, best.end)) ? 1 : 0;
  const r = resolve(key, raw, unitFromText(key, ctx), defUnit);
  if (!r) return null;
  return { key, value: r.value, unitIdx: r.unitIdx, fixed: r.fixed, line: line.trim(), prio: best.p.low && best.p.low.test(n) ? 0 : 1 };
}

/** Birden fazla metin (fotoğraf) → anahtar başına tek değer. Yüksek öncelik, sonra ilk bulunan kazanır. */
export function parseTexts(texts: string[]): Found[] {
  const out = new Map<string, Found>();
  for (const t of texts) {
    for (const line of t.split(/\r?\n/)) {
      if (line.trim().length < 3) continue;
      const f = parseLine(line);
      if (!f) continue;
      const prev = out.get(f.key as string);
      if (!prev || f.prio > prev.prio) out.set(f.key as string, f);
    }
  }
  const order = ALL_FIELDS.map((f) => f.key);
  return [...out.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
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
