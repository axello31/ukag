import type { Inputs } from './engine';

// Sunumdaki (Dr. G. Aksel, AKG yorumlama) vakalar — değerler iç birimlerde
export interface Case {
  name: string;
  story: string;
  answer: string;
  values: Partial<Inputs>;
}

export const CASES: Case[] = [
  { name: 'Vaka 1', story: '42 yaş erkek.', answer: 'Normoksemi; artmış AA’lı metabolik asidoz, uygun solunumsal kompansasyon, Δ/Δ ≈ 1 (saf).', values: { sample: 'arter', pH: 7.26, pCO2: 28, pO2: 107, HCO3: 12, sO2: 97, Na: 139, Cl: 104, age: 42 } },
  { name: 'Vaka 2', story: '45 yaş erkek, nefes darlığı.', answer: 'Hipoksemi; solunumsal asidoz — kronikse kompanse, akutsa eşlik eden metabolik alkaloz.', values: { sample: 'arter', pH: 7.34, pCO2: 60, pO2: 57, HCO3: 31, age: 45 } },
  { name: 'Vaka 3', story: 'Evinde baygın bulunan kadın.', answer: 'pO₂ 39 / sO₂ %62: örnek venöz olabilir! Solunumsal asidoz; akutsa + metabolik alkaloz, kronikse henüz tam kompanse değil.', values: { sample: 'arter', pH: 7.21, pCO2: 86, pO2: 39, HCO3: 34.8, sO2: 62 } },
  { name: 'Vaka 4', story: '65 yaş kadın.', answer: 'Metabolik alkaloz, uygun solunumsal kompansasyon.', values: { sample: 'arter', pH: 7.48, pCO2: 43.6, HCO3: 31.5, BE: 4.5, age: 65 } },
  { name: 'Vaka 5', story: 'AA 35 mEq/L.', answer: 'Solunumsal alkaloz + artmış AA’lı metabolik asidoz; Δ/Δ 1,53 (sunum: > 1 → + metabolik alkaloz).', values: { sample: 'arter', pH: 7.46, pCO2: 20, HCO3: 9, AGdirect: 35 } },
  { name: 'Vaka 6', story: '53 yaş erkek, KOAH + kalp yetersizliği, nefes darlığı.', answer: 'Hipoksemi; pH normal ama mikst: solunumsal asidoz + metabolik alkaloz.', values: { sample: 'arter', pH: 7.43, pCO2: 78, HCO3: 50, pO2: 51, sO2: 88, age: 53 } },
];
