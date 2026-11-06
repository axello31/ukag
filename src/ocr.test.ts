import { describe, expect, it } from 'vitest';
import { parseLine, parseTexts, rowsFromWords } from './ocr';

const get = (text: string) => Object.fromEntries(parseTexts([text]).map((f) => [f.key, { v: f.value, u: f.unitIdx, fixed: !!f.fixed }]));

describe('lab metninden değer ayıklama', () => {
  it('Radiometer ABL çıktısı', () => {
    const r = get(`Blood Gas Values
pH 7.312 [7.350 - 7.450]
pCO2 45.2 mmHg [35.0 - 48.0]
pO2 85.0 mmHg [83.0 - 108]
pH(T) 7.320
pCO2(T) 44.1 mmHg
Oximetry Values
ctHb 13.5 g/dL
sO2 97.0 %
FO2Hb 95.1 %
FCOHb 1.2 %
FMetHb 0.5 %
Electrolyte Values
cK+ 4.1 mmol/L
cNa+ 138 mmol/L
cCa2+ 1.18 mmol/L
cCl- 102 mmol/L
Metabolite Values
cGlu 120 mg/dL
cLac 2.3 mmol/L
Acid Base Status
cBase(Ecf)c -3.2 mmol/L
cHCO3-(P,st)c 21.0 mmol/L
cHCO3-(P)c 22.1 mmol/L
Anion Gap,K+c 18.0 mmol/L
Anion Gapc 13.9 mmol/L
pO2(A)T 100 mmHg
FO2(I) 21.0 %`);
    expect(r.pH.v).toBe(7.312);
    expect(r.pCO2.v).toBe(45.2);
    expect(r.pO2.v).toBe(85);
    expect(r.Hb.v).toBe(13.5);
    expect(r.sO2.v).toBe(97);
    expect(r.COHb.v).toBe(1.2);
    expect(r.MetHb.v).toBe(0.5);
    expect(r.K.v).toBe(4.1);
    expect(r.Na.v).toBe(138);
    expect(r.iCa.v).toBe(1.18);
    expect(r.Cl.v).toBe(102);
    expect(r.glucose).toEqual({ v: 120, u: 0, fixed: false });
    expect(r.lactate.v).toBe(2.3);
    expect(r.BE.v).toBe(-3.2);
    expect(r.HCO3.v).toBe(22.1); // standart değil gerçek HCO₃⁻
    expect(r.AGdirect.v).toBe(13.9); // K'sız
    expect(r.FiO2.v).toBe(21);
  });

  it('Siemens / Türkçe LIS ekranı, virgül ondalık ve birimler', () => {
    const r = get(`PH 7,21
PCO2 11,5 kPa
PO2 7,3 kPa
HCO3act 34,8 mmol/L
HCO3std 30,1 mmol/L
BE(ecf) 8,2
Ca++ 1,10
Sodyum (Na) 141 mmol/L 136-145
Potasyum (K) 3,2 mmol/L
Klor (Cl) 95 mmol/L
Glukoz 7,8 mmol/L
Laktat 4,5 mmol/L
Albümin 32 g/L 35-52
Üre 64 mg/dL 17-43
Kreatinin 1,45 mg/dL
O2SAT 62,0 %`);
    expect(r.pH.v).toBe(7.21);
    expect(r.pCO2).toEqual({ v: 11.5, u: 1, fixed: false });
    expect(r.pO2.u).toBe(1);
    expect(r.HCO3.v).toBe(34.8);
    expect(r.BE.v).toBe(8.2);
    expect(r.iCa.v).toBe(1.1);
    expect(r.Na.v).toBe(141);
    expect(r.K.v).toBe(3.2);
    expect(r.Cl.v).toBe(95);
    expect(r.glucose.u).toBe(1);
    expect(r.lactate.v).toBe(4.5);
    expect(r.albumin).toEqual({ v: 32, u: 1, fixed: false });
    expect(r.bun).toEqual({ v: 64, u: 0, fixed: false });
    expect(r.creatinine.v).toBe(1.45);
    expect(r.sO2.v).toBe(62);
  });

  it('OCR hataları: kayıp nokta, 0/O karışması, alt simge', () => {
    expect(parseLine('pH 7312')).toMatchObject({ key: 'pH', value: 7.312, fixed: true });
    expect(parseLine('pC02 38 mmHg')).toMatchObject({ key: 'pCO2', value: 38 });
    expect(parseLine('HCO₃⁻ 24')).toMatchObject({ key: 'HCO3', value: 24 });
    expect(parseLine('K+ 41 mmol/L')).toMatchObject({ key: 'K', value: 4.1, fixed: true });
    expect(parseLine('BUN 30 mg/dL')).toMatchObject({ key: 'bun', unitIdx: 1 });
    expect(parseLine('İdrar Na 20')).toMatchObject({ key: 'uNa', value: 20 });
    expect(parseLine('Temp 37.0 °C')).toBeNull();
    expect(parseLine('pO2/FIO2 400')).toBeNull();
  });

  it('sütunlu ekran: kelimeleri satırlara dizer', () => {
    const t = rowsFromWords([
      { text: 'pH', x0: 10, y0: 10, x1: 30, y1: 22 },
      { text: 'Na+', x0: 10, y0: 40, x1: 40, y1: 52 },
      { text: '7.40', x0: 200, y0: 11, x1: 240, y1: 23 },
      { text: '140', x0: 200, y0: 41, x1: 230, y1: 53 },
    ]);
    expect(t).toBe('pH 7.40\nNa+ 140');
    expect(get(t)).toMatchObject({ pH: { v: 7.4 }, Na: { v: 140 } });
  });

  it('birden fazla foto birleşir', () => {
    const r = parseTexts(['pH 7.30\npCO2 30', 'Na 140\nCl 100\npH 7.50']);
    expect(r.find((f) => f.key === 'pH')!.value).toBe(7.3);
    expect(r.map((f) => f.key)).toEqual(['pH', 'pCO2', 'Na', 'Cl']);
  });
});

describe('birim yazılıysa ondalık düzeltme birim değişikliğinden önce gelir', () => {
  it('Laktat 34 mmol/L → 3,4 mmol/L', () => {
    expect(parseLine('Laktat 34 mmol/L 05-22')).toMatchObject({ key: 'lactate', value: 3.4, unitIdx: 0, fixed: true });
    expect(parseLine('Glukoz 7,8')).toMatchObject({ key: 'glucose', value: 7.8, unitIdx: 1, fixed: true });
  });
});

describe('tarih ve saat değer sanılmaz', () => {
  it('kümülatif LIS satırları', () => {
    expect(parseLine('Hb 6.11.2026 14:10 6.11.20')).toBeNull();
    expect(parseLine('Hemoglobin 6.11.2026 14:10 12,4 g/dL')).toMatchObject({ key: 'Hb', value: 12.4 });
    expect(parseLine('pO2 06/11/26 14:10:22 78 mmHg')).toMatchObject({ key: 'pO2', value: 78 });
  });
});

describe('bozuk tarih ve düşmüş virgül', () => {
  it('noktası düşmüş tarih, 06 → 0,6', () => {
    expect(parseLine('Laktat 611.2026 14:10 2,1 mmolL')).toMatchObject({ key: 'lactate', value: 2.1 });
    expect(parseLine('MetHb 611.2026 14:10 06 mmolL')).toMatchObject({ key: 'MetHb', value: 0.6, fixed: true });
    expect(parseLine('Ca++ 611.2026 14:10 1,14 mmoliL')).toMatchObject({ key: 'iCa', value: 1.14 });
  });
  it('ilk sayı çöpse sonrakine bakar', () => {
    expect(parseLine('Na 0 138 mmol/L')).toMatchObject({ key: 'Na', value: 138, fixed: true });
  });
});

describe('gerçek LIS ekranı fotoğraflarındaki OCR hataları', () => {
  it('referans aralığı değer sanılmaz', () => {
    expect(parseLine('Arteriyel kanda potasyum mmol/L 3.4-5.5')).toBeNull();
    expect(parseLine('Arteriyel kanda methemoglobin ell | | % 0-15')).toBeNull();
    expect(parseLine('Arteriyel kanda potasyum 4.23 mmol/L 3.4 - 5.5')).toMatchObject({ value: 4.23 });
  });
  it('bozuk etiketler', () => {
    expect(parseLine('CE cic03(0 11.8 Flt')).toMatchObject({ key: 'HCO3', value: 11.8 });
    expect(parseLine('0 [soz 38 | % 95-99')).toMatchObject({ key: 'sO2', value: 38 });
    expect(parseLine('Arteriyel kanda ryonize kalsiy 0.89 mmol/L 1.12-1.32')).toMatchObject({ key: 'iCa', value: 0.89 });
  });
  it('onay kutusu "BE" okunursa sonraki etiket alınır', () => {
    expect(parseLine('BE  pco2m 24.0 el | mmHg')).toMatchObject({ key: 'pCO2', value: 24 });
    expect(parseLine('Anion Gap,K+c 18.0 mmol/L')).toMatchObject({ key: 'AGdirect' });
  });
  it('oylama: çoğunluk kazanır', () => {
    const r = parseTexts(['pH 7.48', 'pH 7.34', 'pH 7.34']);
    expect(r[0].value).toBe(7.34);
  });
});

describe('iPhone fotoğraflarındaki hatalar (15:05)', () => {
  it('hasta başlığı satırı değer vermez', () => {
    expect(parseLine('| a Craveeis 56 il, 1 ay, gin, Boy/k D0 1 Em, i')).toBeNull();
  });
  it('birimden sonraki sayı referanstır', () => {
    expect(parseLine('I tHb g/dL 12 d75')).toBeNull();
    expect(parseLine('[E] s02 % 95599')).toBeNull();
    expect(parseLine('sO2 38 % 95 - 99')).toMatchObject({ key: 'sO2', value: 38 });
    expect(parseLine('Glukoz (mg/dL) 120')).toMatchObject({ key: 'glucose', value: 120 });
  });
  it('pH tam sayı olamaz, satır ortasındaki kısa etiket çöptür', () => {
    expect(parseLine('pH / 7 1850017. /50')).toBeNull();
    expect(parseLine('Gel li Hi fet EER LH CL ea HERG Hs snd ol BE mpi 12')).toBeNull();
  });
  it('aynı değer doğrudan da okunduysa "düzeltildi" sayılmaz', () => {
    const r = parseTexts(['Arteriyel kanda sodyum 1167 mmol/L', 'Arteriyel kanda sodyum 116.7 mmol/L']);
    expect(r[0]).toMatchObject({ value: 116.7, fixed: false });
  });
});

it('uzun Türkçe etiket satır ortasında da tanınır', () => {
  expect(parseLine('YA | | Arteriyel kanda glukoz 70 mg/dL 70 - 105')).toMatchObject({ key: 'glucose', value: 70 });
});

describe('PaddleOCR çıktısı (gerçek fotoğraf satırları)', () => {
  it('parantez içi sayı değer değildir; hemogram bölümü okunmaz', () => {
    const r = parseTexts([`ABE -12.9 mmol/L
SBE -13.9 mmol/L
CHC03(6) 11.8 mmol/L
HCO3-std 13.5
Tam Kan (Hemogram)
Tetkik Ad Tetkk Sonucu Birim Bekenen Dege
PH 7.48 7.350-7.450`]);
    expect(Object.fromEntries(r.map((f) => [f.key, f.value]))).toEqual({ HCO3: 11.8, BE: -13.9 });
  });
  it('kan gazı ekranı', () => {
    const r = parseTexts([`PH 7.34 7.350-7.450
PCO2 22.4 mmHg 35-48
PO2 29.2 mmHg 83-108
PCO2(T） 22.4 mmHg
Hct 15
tHb 5 g/dL 12 -17.5
s02 38 95-99
FO2Hb 37.2 94.0-98.0
tBi 12.7 mg/dL
PH(T) 7.34
p50c 34.3 mmHg
ABE -12.9 mmol/L
SBE -13.9 mmol/L
dHCO3(p） 11.8 mmol/L`]);
    expect(Object.fromEntries(r.map((f) => [f.key, f.value]))).toEqual({ pH: 7.34, pCO2: 22.4, HCO3: 11.8, BE: -13.9, pO2: 29.2, sO2: 38, Hb: 5 });
  });
});

it('parantezi düşmüş sıcaklık düzeltmeli satırlar atlanır', () => {
  expect(parseLine('PO2T 29.2 mmHg')).toBeNull();
  expect(parseLine('PCO2T 22.4 mmHg')).toBeNull();
  expect(parseLine('PHT 7.34')).toBeNull();
  expect(parseLine('PO2 29.2 mmHg 83-108')).toMatchObject({ key: 'pO2', value: 29.2 });
});

it('"s" yerine "$" okunan sO2', () => {
  expect(parseLine('$02 38 95-99')).toMatchObject({ key: 'sO2', value: 38 });
});
