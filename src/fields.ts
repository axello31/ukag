import type { Inputs } from './engine';

export interface Unit {
  u: string;
  toInt: (x: number) => number; // giriş birimi → iç birim
}

export interface Field {
  key: keyof Inputs;
  label: string;
  hint: string; // normal aralık (iç birimde)
  units: Unit[];
  step?: string;
  venLabel?: string;
}

const id = (x: number) => x;
const MMHG: Unit[] = [
  { u: 'mmHg', toInt: id },
  { u: 'kPa', toInt: (x) => x * 7.50062 },
];

export interface Group {
  id: string;
  title: string;
  fields: Field[];
}

export const GROUPS: Group[] = [
  {
    id: 'temel',
    title: 'Temel kan gazı',
    fields: [
      { key: 'pH', label: 'pH', hint: '7,35–7,45', units: [{ u: '', toInt: id }], step: '0.01' },
      { key: 'pCO2', label: 'pCO₂', venLabel: 'pvCO₂', hint: '35–45', units: MMHG },
      { key: 'HCO3', label: 'HCO₃⁻', hint: '22–26', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'BE', label: 'Baz fazlalığı (BE)', hint: '−2 / +2', units: [{ u: 'mmol/L', toInt: id }] },
    ],
  },
  {
    id: 'oksijen',
    title: 'Oksijenasyon',
    fields: [
      { key: 'pO2', label: 'pO₂', venLabel: 'pvO₂', hint: '80–100', units: MMHG },
      { key: 'sO2', label: 'sO₂ (gazda)', hint: '%95–98', units: [{ u: '%', toInt: id }] },
      { key: 'SpO2', label: 'SpO₂ (nabız oks.)', hint: '≥ %94', units: [{ u: '%', toInt: id }] },
      { key: 'FiO2', label: 'FiO₂', hint: 'oda havası 21', units: [{ u: '%', toInt: id }, { u: 'ondalık', toInt: (x) => x * 100 }] },
      { key: 'patm', label: 'Atmosfer basıncı', hint: 'deniz seviyesi 760', units: MMHG },
    ],
  },
  {
    id: 'elektrolit',
    title: 'Elektrolitler',
    fields: [
      { key: 'Na', label: 'Na⁺', hint: '135–145', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'Cl', label: 'Cl⁻', hint: '98–106', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'K', label: 'K⁺', hint: '3,5–5,0', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'iCa', label: 'İyonize Ca²⁺', hint: '1,15–1,30', units: [{ u: 'mmol/L', toInt: id }, { u: 'mg/dL', toInt: (x) => x / 4.008 }], step: '0.01' },
      { key: 'AGdirect', label: 'Anyon açığı (cihaz)', hint: 'Na/Cl yoksa', units: [{ u: 'mmol/L', toInt: id }] },
    ],
  },
  {
    id: 'metabolit',
    title: 'Metabolitler ve biyokimya',
    fields: [
      { key: 'lactate', label: 'Laktat', hint: '< 2', units: [{ u: 'mmol/L', toInt: id }, { u: 'mg/dL', toInt: (x) => x / 9.008 }] },
      { key: 'glucose', label: 'Glukoz', hint: '70–140', units: [{ u: 'mg/dL', toInt: id }, { u: 'mmol/L', toInt: (x) => x * 18.016 }] },
      { key: 'albumin', label: 'Albümin', hint: '3,5–5,0', units: [{ u: 'g/dL', toInt: id }, { u: 'g/L', toInt: (x) => x / 10 }] },
      { key: 'bun', label: 'Üre / BUN', hint: 'üre 15–45', units: [{ u: 'üre mg/dL', toInt: (x) => x / 2.14 }, { u: 'BUN mg/dL', toInt: id }, { u: 'üre mmol/L', toInt: (x) => x * 2.801 }] },
      { key: 'creatinine', label: 'Kreatinin', hint: '0,6–1,2', units: [{ u: 'mg/dL', toInt: id }, { u: 'µmol/L', toInt: (x) => x / 88.4 }], step: '0.01' },
      { key: 'ketone', label: 'Keton (β-HB)', hint: '< 0,6', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'osmMeasured', label: 'Ölçülen osmolalite', hint: '275–295', units: [{ u: 'mOsm/kg', toInt: id }] },
      { key: 'ethanol', label: 'Etanol', hint: '0', units: [{ u: 'mg/dL', toInt: id }, { u: 'mmol/L', toInt: (x) => x * 4.607 }, { u: 'promil', toInt: (x) => x * 100 }] },
    ],
  },
  {
    id: 'hemoks',
    title: 'Hemoksimetri',
    fields: [
      { key: 'Hb', label: 'Hemoglobin', hint: '12–17', units: [{ u: 'g/dL', toInt: id }, { u: 'g/L', toInt: (x) => x / 10 }, { u: 'mmol/L', toInt: (x) => x * 1.611 }] },
      { key: 'COHb', label: 'COHb', hint: '< %3 (sigara < 10)', units: [{ u: '%', toInt: id }] },
      { key: 'MetHb', label: 'MetHb', hint: '< %2', units: [{ u: '%', toInt: id }] },
    ],
  },
  {
    id: 'idrar',
    title: 'İdrar elektrolitleri',
    fields: [
      { key: 'uNa', label: 'İdrar Na⁺', hint: '', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'uK', label: 'İdrar K⁺', hint: '', units: [{ u: 'mmol/L', toInt: id }] },
      { key: 'uCl', label: 'İdrar Cl⁻', hint: '', units: [{ u: 'mmol/L', toInt: id }] },
    ],
  },
  {
    id: 'hasta',
    title: 'Hasta',
    fields: [
      { key: 'age', label: 'Yaş', hint: 'yıl', units: [{ u: 'yıl', toInt: id }] },
      { key: 'weight', label: 'Kilo', hint: 'bikarbonat açığı için', units: [{ u: 'kg', toInt: id }] },
    ],
  },
];

export const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);

/** Çıktıdaki ad → giriş alanı anahtarları (eksik veri listesinden alana atlamak için) */
export function fieldKeysFor(missingFields: string): (keyof Inputs)[] {
  const m: [RegExp, keyof Inputs][] = [
    [/pH/, 'pH'], [/pCO₂/, 'pCO2'], [/HCO₃/, 'HCO3'], [/PaO₂/, 'pO2'], [/SpO₂/, 'SpO2'], [/FiO₂/, 'FiO2'],
    [/^Na⁺|Na⁺,|, Na⁺/, 'Na'], [/Cl⁻/, 'Cl'], [/Albümin/, 'albumin'], [/Laktat/, 'lactate'], [/[Gg]lukoz/, 'glucose'],
    [/[Kk]eton/, 'ketone'], [/[Üü]re|BUN/, 'bun'], [/[Kk]reatinin/, 'creatinine'], [/osmolalite/, 'osmMeasured'],
    [/İdrar/, 'uNa'], [/Yaş/, 'age'],
  ];
  return m.filter(([r]) => r.test(missingFields)).map(([, k]) => k);
}
