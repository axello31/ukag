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
