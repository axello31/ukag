import { describe, it, expect } from 'vitest';
import { analyze, DEFAULT_SETTINGS, type Inputs } from './engine';
import { CASES } from './cases';

const base: Inputs = { sample: 'arter', chronicity: 'bilinmiyor', bp: 'bilinmiyor', shock: false, trauma: false, smoker: false };
const run = (v: Partial<Inputs>, s = DEFAULT_SETTINGS) => analyze({ ...base, ...v }, s);
const keys = (r: ReturnType<typeof run>) => r.disorders.map((d) => `${d.key}:${d.role}`);

describe('eğitim vakaları', () => {
  it('Vaka 1: saf HAGMA, uygun kompansasyon', () => {
    const r = run(CASES[0].values);
    expect(keys(r)).toEqual(['HAGMA:primer']);
    expect(r.calcs.find((c) => c.label.startsWith('Delta oranı'))!.value).toBe('0,92');
  });
  it('Vaka 2: solunumsal asidoz, kronikle uyumlu', () => {
    const r = run(CASES[1].values);
    expect(keys(r)).toContain('RAc:primer');
    expect(keys(r)).toContain('hypox:eşlik eden');
    expect(run({ ...CASES[1].values, chronicity: 'kronik' }).disorders.map((d) => d.key)).not.toContain('MAlk');
    expect(keys(run({ ...CASES[1].values, chronicity: 'akut' }))).toContain('MAlk:eşlik eden');
  });
  it('Vaka 3: venöz şüphesi uyarısı', () => {
    const r = run(CASES[2].values);
    expect(r.alerts.some((a) => a.text.includes('venöz olabilir'))).toBe(true);
    expect(keys(r)).toContain('RAc:primer');
  });
  it('Vaka 4: metabolik alkaloz, uygun kompansasyon', () => {
    expect(keys(run(CASES[3].values))).toEqual(['MAlk:primer']);
  });
  it('Vaka 5: solunumsal alkaloz + HAGMA; klasik modda + met. alkaloz', () => {
    const r = run(CASES[4].values);
    expect(keys(r)).toEqual(['RAlk:primer', 'HAGMA:eşlik eden']);
    const k = run(CASES[4].values, { ...DEFAULT_SETTINGS, deltaMode: 'klasik' });
    expect(keys(k)).toContain('MAlk:eşlik eden');
  });
  it('Vaka 6: mikst solunumsal asidoz + metabolik alkaloz', () => {
    const r = run(CASES[5].values);
    expect(r.disorders.map((d) => d.key).sort()).toEqual(['MAlk', 'RAc', 'hypox'].sort());
  });
});

describe('eksik veri ve türetme', () => {
  it('HCO3 yoksa hesaplar', () => {
    const r = run({ pH: 7.4, pCO2: 40 });
    expect(r.calcs[0].label).toContain('hesaplanan');
    expect(r.headline).toBe('Asit-baz dengesi normal sınırlarda');
  });
  it('Na/Cl yoksa metabolik asidoz tiplenemez ve eksik listelenir', () => {
    const r = run({ pH: 7.25, pCO2: 28, HCO3: 12 });
    expect(keys(r)).toEqual(['MA:primer']);
    expect(r.missing.some((m) => m.fields.includes('Na'))).toBe(true);
  });
  it('normal AA → NAGMA', () => {
    const r = run({ pH: 7.3, pCO2: 30, HCO3: 15, Na: 140, Cl: 115, albumin: 4 });
    expect(keys(r)).toEqual(['NAGMA:primer']);
  });
  it('normal pH + yüksek AA → gizli HAGMA + met alkaloz', () => {
    const r = run({ pH: 7.4, pCO2: 40, HCO3: 24, Na: 145, Cl: 95, albumin: 4 });
    expect(r.disorders.map((d) => d.key)).toEqual(expect.arrayContaining(['HAGMA', 'MAlk']));
  });
  it('venöz düzeltme', () => {
    const r = run({ sample: 'ven', pH: 7.35, pCO2: 46, HCO3: 25 });
    expect(r.usedABG!.pH).toBeCloseTo(7.38);
    expect(r.headline).toBe('Asit-baz dengesi normal sınırlarda');
  });
  it('pO2 60–79 bozukluk sayılmaz, < 60 sayılır', () => {
    expect(run({ pO2: 72, age: 75 }).steps[0].lines[0].tone).toBe('ok');
    expect(run({ pO2: 72, age: 40 }).steps[0].lines[0].tone).toBe('warn');
    expect(run({ pO2: 72, age: 40 }).disorders).toEqual([]);
    expect(run({ pO2: 58 }).disorders.map((d) => d.key)).toEqual(['hypox']);
  });
  it('kombine asidoz', () => {
    expect(keys(run({ pH: 7.1, pCO2: 55, HCO3: 16 }))).toEqual(['MA:primer', 'RAc:primer']);
  });
});
