// ÜKAG hesap motoru — saf fonksiyonlar, arayüzden bağımsız.
// Tüm değerler iç birimlerle gelir: mmHg, mmol/L, g/dL, mg/dL, %.

export type Sample = 'arter' | 'ven';
export type Chronicity = 'bilinmiyor' | 'akut' | 'kronik';
export type BP = 'bilinmiyor' | 'normotansif' | 'hipertansif';
export type DeltaMode = 'genis' | 'klasik';
export type Tone = 'ok' | 'info' | 'warn' | 'bad' | 'muted';

export interface Settings {
  normalAG: number; // mmol/L
  refAlbumin: number; // g/dL
  deltaMode: DeltaMode;
  venousCorrection: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  normalAG: 12,
  refAlbumin: 4.0,
  deltaMode: 'genis',
  venousCorrection: true,
};

export interface Inputs {
  sample: Sample;
  pH?: number;
  pCO2?: number;
  HCO3?: number;
  BE?: number;
  pO2?: number;
  sO2?: number;
  SpO2?: number;
  FiO2?: number; // %
  Na?: number;
  K?: number;
  Cl?: number;
  iCa?: number;
  AGdirect?: number;
  lactate?: number;
  glucose?: number; // mg/dL
  albumin?: number; // g/dL
  bun?: number; // mg/dL
  creatinine?: number; // mg/dL
  ketone?: number; // β-hidroksibütirat mmol/L
  osmMeasured?: number;
  ethanol?: number; // mg/dL
  Hb?: number;
  COHb?: number;
  MetHb?: number;
  uNa?: number;
  uK?: number;
  uCl?: number;
  age?: number;
  weight?: number;
  patm?: number;
  chronicity: Chronicity;
  bp: BP;
  shock: boolean;
  trauma: boolean;
  smoker: boolean;
}

export type DisorderKey = 'HAGMA' | 'NAGMA' | 'MA' | 'MAlk' | 'RAc' | 'RAlk' | 'hypox';
export type Role = 'primer' | 'eşlik eden' | 'mikst' | 'olası' | 'gizli';

export interface How {
  formula: string;
  calc?: string;
  note?: string;
  source?: string;
}

export interface Line {
  text: string;
  tone?: Tone;
  how?: How;
}

export interface Step {
  id: string;
  title: string;
  tone: Tone;
  lines: Line[];
}

export interface Disorder {
  key: DisorderKey;
  label: string;
  role: Role;
}

export interface Calc {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  how: How;
}

export interface Missing {
  fields: string;
  reason: string;
}

export interface Result {
  hasData: boolean;
  headline: string;
  disorders: Disorder[];
  steps: Step[];
  calcs: Calc[];
  missing: Missing[];
  alerts: Line[];
  respiratoryProcess: boolean;
  usedABG?: { pH: number; pCO2: number; HCO3: number; estimated: boolean };
}

// ---------- yardımcılar ----------
const has = (x: number | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
export const fmt = (x: number, d = 1) => {
  const s = x.toFixed(d);
  return (s === '-0' || /^-0\.0+$/.test(s) ? s.slice(1) : s).replace('.', ',');
};
const f2 = (x: number) => fmt(x, 2);
const f1 = (x: number) => fmt(x, 1);

// Venöz → tahmini arteriyel (Byrne 2014 meta-analizi; pCO2 farkı geniş aralıklı)
export const VENOUS = { dpH: 0.03, dpCO2: 4, dHCO3: 1 };

const SRC = {
  winter: 'Albert MS, Dell RB, Winters RW. Ann Intern Med 1967;66:312-22.',
  comp: 'Berend K, de Vries APJ, Gans ROB. N Engl J Med 2014;371:1434-45; Börekçi Ş, Umut S. Türk Toraks Derg 2011;12(Ek 1):5-9.',
  ag: 'Kraut JA, Madias NE. Clin J Am Soc Nephrol 2007;2:162-74.',
  figge: 'Figge J ve ark. Crit Care Med 1998;26:1807-10.',
  rastegar: 'Rastegar A. J Am Soc Nephrol 2007;18:2429-31.',
  hh: 'Henderson–Hasselbalch denklemi (pK 6,1; CO2 çözünürlüğü 0,03).',
  byrne: 'Byrne AL ve ark. Respirology 2014;19:168-75.',
  kelly: 'Kelly AM, Kerr D, Middleton P. J Emerg Med 2005;28:377-9.',
  osm: 'Kraut JA, Xing SX. Am J Kidney Dis 2011;58:480-4; Purssell RA ve ark. Ann Emerg Med 2001;38:653-9.',
  uag: 'Batlle DC ve ark. N Engl J Med 1988;318:594-9.',
  galla: 'Galla JH. J Am Soc Nephrol 2000;11:369-75.',
  aa: 'Alveol gaz denklemi; beklenen A-a = yaş/4 + 4.',
  sorbini: 'Sorbini CA ve ark. Respiration 1968;25:3-13.',
  ards: 'ARDS Definition Task Force (Berlin). JAMA 2012;307:2526-33.',
  ada: 'Umpierrez GE ve ark. Hyperglycemic crises in adults with diabetes: a consensus report. Diabetes Care 2024;47:1257-75.',
  atls: 'ATLS 10. baskı (2018) hemoraji sınıfları – baz açığı; Mutschler M ve ark. Crit Care 2013;17:R42.',
  bicar: 'Adrogué HJ, Madias NE. N Engl J Med 1998;338:26-34; Jaber S ve ark. (BICAR-ICU) Lancet 2018;392:31-40.',
};

// ---------- ana fonksiyon ----------
export function analyze(inp: Inputs, st: Settings = DEFAULT_SETTINGS): Result {
  const steps: Step[] = [];
  const calcs: Calc[] = [];
  const missing: Missing[] = [];
  const alerts: Line[] = [];
  const disorders: Disorder[] = [];
  const isVen = inp.sample === 'ven';

  const addDis = (key: DisorderKey, label: string, role: Role) => {
    const ex = disorders.find((d) => d.key === key);
    if (ex) {
      // daha kesin role yükselt
      const rank: Role[] = ['olası', 'gizli', 'eşlik eden', 'mikst', 'primer'];
      if (rank.indexOf(role) > rank.indexOf(ex.role)) ex.role = role;
      ex.label = label;
      return;
    }
    disorders.push({ key, label, role });
  };

  // ---------- 0) veri bütünlüğü ve türetme ----------
  let { pH, pCO2, HCO3 } = inp;
  const derived: string[] = [];
  if (!has(HCO3) && has(pH) && has(pCO2)) {
    HCO3 = 0.03 * pCO2 * Math.pow(10, pH - 6.1);
    derived.push('HCO3');
    calcs.push({
      label: 'HCO₃⁻ (hesaplanan)',
      value: f1(HCO3),
      unit: 'mmol/L',
      how: {
        formula: 'HCO₃⁻ = 0,03 × pCO₂ × 10^(pH − 6,1)',
        calc: `0,03 × ${f1(pCO2)} × 10^(${f2(pH)} − 6,1) = ${f1(HCO3)}`,
        note: 'HCO₃⁻ girilmediği için pH ve pCO₂’den türetildi.',
        source: SRC.hh,
      },
    });
  } else if (!has(pH) && has(pCO2) && has(HCO3)) {
    pH = 6.1 + Math.log10(HCO3 / (0.03 * pCO2));
    derived.push('pH');
    calcs.push({
      label: 'pH (hesaplanan)',
      value: f2(pH),
      how: {
        formula: 'pH = 6,1 + log₁₀(HCO₃⁻ / (0,03 × pCO₂))',
        calc: `6,1 + log₁₀(${f1(HCO3)} / (0,03 × ${f1(pCO2)})) = ${f2(pH)}`,
        note: 'pH girilmediği için türetildi; ölçülen pH her zaman tercih edilmelidir.',
        source: SRC.hh,
      },
    });
  } else if (!has(pCO2) && has(pH) && has(HCO3)) {
    pCO2 = HCO3 / (0.03 * Math.pow(10, pH - 6.1));
    derived.push('pCO2');
    calcs.push({
      label: 'pCO₂ (hesaplanan)',
      value: f1(pCO2),
      unit: 'mmHg',
      how: {
        formula: 'pCO₂ = HCO₃⁻ / (0,03 × 10^(pH − 6,1))',
        calc: `${f1(HCO3)} / (0,03 × 10^(${f2(pH)} − 6,1)) = ${f1(pCO2)}`,
        source: SRC.hh,
      },
    });
  }

  if (has(inp.pH) && has(inp.pCO2) && has(inp.HCO3)) {
    const hhHCO3 = 0.03 * inp.pCO2 * Math.pow(10, inp.pH - 6.1);
    const diff = inp.HCO3 - hhHCO3;
    const bad = Math.abs(diff) > 3 && Math.abs(diff) / hhHCO3 > 0.1;
    calcs.push({
      label: 'İç tutarlılık (H-H)',
      value: bad ? 'Tutarsız' : 'Tutarlı',
      tone: bad ? 'warn' : 'ok',
      how: {
        formula: 'Beklenen HCO₃⁻ = 0,03 × pCO₂ × 10^(pH − 6,1); girilen değerle fark > 3 mmol/L ve > %10 ise tutarsız',
        calc: `0,03 × ${f1(inp.pCO2)} × 10^(${f2(inp.pH)} − 6,1) = ${f1(hhHCO3)} (girilen ${f1(inp.HCO3)}, fark ${f1(diff)})`,
        note: 'Gaz cihazı HCO₃⁻’ü bu denklemle hesaplar; biyokimyadan girilen total CO₂ ~1–2 mmol/L farklı olabilir.',
        source: SRC.hh,
      },
    });
    if (bad)
      alerts.push({
        tone: 'warn',
        text: `pH, pCO₂ ve HCO₃⁻ birbiriyle tutarsız (H-H’ye göre beklenen HCO₃⁻ ${f1(hhHCO3)}). Giriş hatası, farklı zamanda alınmış örnek ya da biyokimya HCO₃⁻’ü olabilir — değerleri kontrol edin.`,
      });
  }

  if (has(pH) && (pH < 6.5 || pH > 8.0))
    alerts.push({ tone: 'bad', text: 'pH fizyolojik olarak olası aralığın dışında (6,5–8,0). Giriş hatası olabilir.' });

  // örnek tipi kontrolü
  if (!isVen && has(inp.pO2) && inp.pO2 < 40 && (!has(inp.sO2) || inp.sO2 < 75)) {
    alerts.push({
      tone: 'warn',
      text: 'Arter seçildi ama pO₂ < 40 mmHg' + (has(inp.sO2) ? ' ve sO₂ < %75' : '') + ': örnek venöz olabilir. Klinik (SpO₂) ile karşılaştırın, şüphede tekrarlayın.',
      how: {
        formula: 'Periferik ven kanında pO₂ genellikle < 40 mmHg (çoğu zaman < 30). pO₂ > 40 ve sO₂ > %75 ise arter kanı olasılığı yüksek.',
        source: 'Byrne AL ve ark. Respirology 2014;19:168-75 — arteriyel pO₂ venözden ortalama 36,9 mmHg yüksek.',
      },
    });
  }

  // ---------- 1) Oksijenasyon ----------
  const oxy: Line[] = [];
  let oxyTone: Tone = 'muted';
  if (isVen) {
    oxy.push({
      tone: 'info',
      text: 'Venöz pO₂ oksijenasyonu yansıtmaz; değerlendirme için SpO₂ veya arter kan gazı kullanılmalı.',
      how: { formula: 'Arteriyel pO₂ venözden ortalama 36,9 mmHg yüksek, aralık çok geniş (27–47).', source: SRC.byrne },
    });
    if (has(inp.SpO2)) {
      const low = inp.SpO2 < 90;
      oxy.push({ tone: low ? 'bad' : inp.SpO2 < 94 ? 'warn' : 'ok', text: `SpO₂ %${f1(inp.SpO2)}: ${low ? 'hipoksemi (< %90)' : inp.SpO2 < 94 ? 'sınırda (%90–94)' : 'yeterli'}.` });
      oxyTone = low ? 'bad' : 'ok';
      if (low) addDis('hypox', 'Hipoksemi (SpO₂)', 'eşlik eden');
    } else missing.push({ fields: 'SpO₂', reason: 'Venöz örnekte oksijenasyon yorumu için' });
  } else if (has(inp.pO2)) {
    const p = inp.pO2;
    const roomAir = !has(inp.FiO2) || inp.FiO2 <= 21.5;
    // Klinik olarak anlamlı hipoksemi / solunum yetmezliği eşiği 60 mmHg.
    // 60–79 normalin alt sınırının altındadır ama yaşlıda fizyolojik olabilir → bozukluk olarak sayılmaz.
    // ≥ 70 yaşta sağlıklı bireylerde normalin alt sınırı ≈ 60 mmHg ve yaşla daha fazla düşmez (Hardie 2004).
    const expAge = has(inp.age) ? 104.2 - 0.27 * inp.age : undefined;
    const ageOk = has(inp.age) && inp.age >= 70;
    let g = '';
    if (p >= 80) g = 'normal';
    else if (p >= 60)
      g = ageOk
        ? '70 yaş üstü için normal sınırlarda (bu yaşta normalin alt sınırı ≈ 60 mmHg)'
        : `hafif düşük (60–79)${expAge !== undefined ? ` — yaşına göre beklenen ~${fmt(expAge, 0)} mmHg` : ''}; hipoksemi eşiği 60 mmHg`;
    else if (p >= 40) g = 'hipoksemi';
    else g = 'ağır hipoksemi';
    const tone: Tone = p >= 80 || ageOk ? 'ok' : p >= 60 ? 'warn' : 'bad';
    oxyTone = tone;
    oxy.push({
      tone,
      text: `PaO₂ ${f1(p)} mmHg: ${g}${!roomAir ? ' (O₂ desteği altında — FiO₂ ile birlikte yorumlayın)' : ''}.`,
      how: {
        formula: 'Normal 80–100 · 60–79 hafif düşük · < 60 hipoksemi (solunum yetmezliği) · < 40 ağır hipoksemi (oda havasında)',
        note: 'Hipoksemi eşiği her yaşta 60 mmHg’dir: oksihemoglobin eğrisinin dikleştiği nokta (SaO₂ ≈ %90). 80 mmHg genç erişkinde normalin alt sınırıdır; PaO₂ yaşla düşer (≈ 104,2 − 0,27 × yaş). 70 yaş üstü sağlıklı bireylerde normalin alt sınırı erkekte 62, kadında 59,6 mmHg bulunmuş ve bu yaştan sonra yaşla değişmemiştir; bu nedenle ≥ 70 yaşta 60–79 normal kabul edilir.',
        source: 'Hardie JA ve ark. Chest 2004;125:2053-60; Sorbini CA ve ark. Respiration 1968;25:3-13; Börekçi Ş, Umut S. Türk Toraks Derg 2011;12(Ek 1):5-9.',
      },
    });
    if (p < 60) {
      const t2 = has(pCO2) && pCO2 > 45;
      oxy.push({ tone: 'bad', text: `PaO₂ < 60 mmHg: solunum yetmezliği — ${t2 ? 'Tip 2 (hiperkapnik)' : has(pCO2) ? 'Tip 1 (hipoksemik)' : 'tip için pCO₂ gerekli'}.` });
      addDis('hypox', t2 ? 'Hipoksemik + hiperkapnik solunum yetmezliği (Tip 2)' : 'Hipoksemik solunum yetmezliği (Tip 1)', 'eşlik eden');
    }
    if (has(inp.age)) {
      const exp = expAge!;
      calcs.push({
        label: 'Yaşa göre beklenen PaO₂',
        value: f1(exp),
        unit: 'mmHg',
        how: { formula: 'PaO₂ = 104,2 − 0,27 × yaş (oda havası, oturur)', calc: `104,2 − 0,27 × ${inp.age} = ${f1(exp)}`, note: 'Alternatif: 100 − yaş/3.', source: SRC.sorbini },
      });
    }
    if (has(inp.FiO2)) {
      const fi = inp.FiO2 / 100;
      const pf = p / fi;
      const pfTone: Tone = pf > 300 ? 'ok' : pf > 200 ? 'warn' : 'bad';
      calcs.push({
        label: 'PaO₂/FiO₂ (P/F)',
        value: fmt(pf, 0),
        tone: pfTone,
        how: {
          formula: 'P/F = PaO₂ / FiO₂ (ondalık)',
          calc: `${f1(p)} / ${f2(fi)} = ${fmt(pf, 0)}`,
          note: '> 300 normal · 201–300 hafif · 101–200 orta · ≤ 100 ağır oksijenasyon bozukluğu. ARDS tanısı için PEEP ≥ 5 cmH₂O, akut başlangıç ve bilateral opasite de gerekir.',
          source: SRC.ards,
        },
      });
      oxy.push({ tone: pfTone, text: `P/F oranı ${fmt(pf, 0)}: ${pf > 300 ? 'normal' : pf > 200 ? 'hafif' : pf > 100 ? 'orta' : 'ağır'} oksijenasyon bozukluğu düzeyi.` });
      if (has(pCO2)) {
        const patm = has(inp.patm) ? inp.patm : 760;
        const PAO2 = fi * (patm - 47) - pCO2 / 0.8;
        const aa = PAO2 - p;
        const expAA = has(inp.age) ? inp.age / 4 + 4 : undefined;
        const high = expAA !== undefined ? aa > expAA : aa > 15;
        calcs.push({
          label: 'A-a O₂ gradyanı',
          value: f1(aa),
          unit: 'mmHg',
          tone: high ? 'warn' : 'ok',
          how: {
            formula: 'PAO₂ = FiO₂ × (Patm − 47) − PaCO₂ / 0,8 ;  A-a = PAO₂ − PaO₂',
            calc: `PAO₂ = ${f2(fi)} × (${patm} − 47) − ${f1(pCO2)} / 0,8 = ${f1(PAO2)} ;  A-a = ${f1(PAO2)} − ${f1(p)} = ${f1(aa)}`,
            note: `Beklenen üst sınır ≈ yaş/4 + 4${expAA !== undefined ? ` = ${f1(expAA)}` : ' (yaş girilmedi; genel sınır 15 alındı)'}. Yüksek FiO₂’de gradyan doğal olarak büyür; yorum en iyi oda havasında yapılır.`,
            source: SRC.aa,
          },
        });
        if (p < 80) {
          oxy.push({
            tone: high ? 'warn' : 'info',
            text: high
              ? `A-a gradyanı artmış (${f1(aa)}): V/Q uyumsuzluğu, şant veya difüzyon bozukluğu düşündürür.`
              : `A-a gradyanı normal (${f1(aa)}): hipoksemi hipoventilasyon veya düşük inspire O₂ ile açıklanabilir.`,
          });
        }
      } else missing.push({ fields: 'pCO₂', reason: 'A-a gradyanı için' });
      if (!has(inp.age)) missing.push({ fields: 'Yaş', reason: 'Yaşa göre beklenen PaO₂ ve A-a sınırı için' });
    } else missing.push({ fields: 'FiO₂', reason: 'P/F oranı ve A-a gradyanı için (oda havası = %21)' });
    if (has(inp.sO2) && inp.sO2 < 90) oxy.push({ tone: 'bad', text: `SaO₂ %${f1(inp.sO2)} (< %90).` });
  } else {
    missing.push({ fields: 'PaO₂', reason: 'Oksijenasyon değerlendirmesi için' });
  }
  if (has(inp.COHb) || has(inp.MetHb)) {
    if (has(inp.COHb)) {
      const lim = inp.smoker ? 10 : 3;
      const hi = inp.COHb > lim;
      oxy.push({
        tone: inp.COHb >= 25 ? 'bad' : hi ? 'warn' : 'ok',
        text: `COHb %${f1(inp.COHb)}: ${hi ? 'artmış — CO zehirlenmesi açısından değerlendirin' : 'normal sınırda'}${inp.COHb >= 25 ? '; ≥ %25 (gebede ≥ %15) veya nörolojik bulgu varsa hiperbarik oksijen açısından danışın' : ''}. SpO₂ ve PaO₂ yanıltıcı biçimde normal olabilir.`,
        how: { formula: `Üst sınır: sigara içmeyen %3, içen %10 (bu hastada ${inp.smoker ? 'içen' : 'içmeyen'} seçili).`, source: 'Hampson NB ve ark. Am J Respir Crit Care Med 2012;186:1095-101.' },
      });
    }
    if (has(inp.MetHb)) {
      oxy.push({
        tone: inp.MetHb >= 20 ? 'bad' : inp.MetHb > 2 ? 'warn' : 'ok',
        text: `MetHb %${f1(inp.MetHb)}: ${inp.MetHb > 2 ? 'artmış' : 'normal'}${inp.MetHb >= 20 ? ' — semptomatik hastada (veya ≥ %30) metilen mavisi endikasyonu açısından değerlendirin' : ''}.`,
        how: { formula: 'Normal ≤ %2; ≥ %15 siyanoz; ≥ %20 semptomatik; ≥ %30 asemptomatik olsa da tedavi.', source: 'Wright RO ve ark. Ann Emerg Med 1999;34:646-56.' },
      });
    }
  }
  if (oxy.length) steps.push({ id: 'oxy', title: '1 · Oksijenasyon', tone: oxyTone, lines: oxy });

  // ---------- 2) Ventilasyon ----------
  const vent: Line[] = [];
  let ventTone: Tone = 'muted';
  if (has(pCO2)) {
    const raw = has(inp.pCO2) ? inp.pCO2 : pCO2;
    if (isVen) {
      if (raw <= 45) {
        vent.push({ tone: 'ok', text: `Venöz pCO₂ ${f1(raw)} mmHg (≤ 45): arteriyel hiperkapni büyük olasılıkla yok.`, how: { formula: 'Venöz pCO₂ ≤ 45 mmHg → arteriyel pCO₂ > 50 için duyarlılık %100, NPV %100 (KOAH’lı acil hastalarında).', source: SRC.kelly } });
        ventTone = 'ok';
      } else {
        vent.push({ tone: 'warn', text: `Venöz pCO₂ ${f1(raw)} mmHg (> 45): arteriyel hiperkapni olabilir, kesin değildir (özgüllük ~%47). Gerekirse AKG ile doğrulayın.`, how: { formula: 'Venöz pCO₂ arteriyelden ortalama ~4–5 mmHg yüksek; ancak fark −10,7 ile +2,4 mmHg arasında değişir.', source: `${SRC.kelly} ${SRC.byrne}` } });
        ventTone = 'warn';
      }
      if (inp.shock || (has(inp.lactate) && inp.lactate >= 4))
        vent.push({ tone: 'bad', text: 'Şok/hipoperfüzyonda venöz–arteriyel pCO₂ ve pH farkı belirgin artar; venöz değerlere güvenmeyin, AKG önerilir.' });
    } else {
      if (raw > 45) {
        vent.push({ tone: 'warn', text: `PaCO₂ ${f1(raw)} mmHg (> 45): hipoventilasyon / CO₂ retansiyonu.` });
        ventTone = 'warn';
      } else if (raw < 35) {
        vent.push({ tone: 'warn', text: `PaCO₂ ${f1(raw)} mmHg (< 35): hiperventilasyon.` });
        ventTone = 'warn';
      } else {
        vent.push({ tone: 'ok', text: `PaCO₂ ${f1(raw)} mmHg: normal ventilasyon (35–45).` });
        ventTone = 'ok';
      }
    }
    if (derived.includes('pCO2')) vent.push({ tone: 'muted', text: 'pCO₂ girilmedi, pH ve HCO₃⁻’ten hesaplandı.' });
  } else missing.push({ fields: 'pCO₂', reason: 'Ventilasyon değerlendirmesi için' });
  if (vent.length) steps.push({ id: 'vent', title: '2 · Ventilasyon', tone: ventTone, lines: vent });

  // ---------- 3) Asit-baz ----------
  const ab: Line[] = [];
  let respiratoryProcess = false;
  let usedABG: Result['usedABG'];
  let maPresent = false;
  const nAB = [pH, pCO2, HCO3].filter(has).length;

  if (has(pH) && has(pCO2) && has(HCO3)) {
    let a = { pH, pCO2, HCO3 };
    const estimated = isVen && st.venousCorrection;
    if (estimated) {
      a = { pH: pH + VENOUS.dpH, pCO2: pCO2 - VENOUS.dpCO2, HCO3: HCO3 - VENOUS.dHCO3 };
      ab.push({
        tone: 'info',
        text: `Venöz örnek: yorum tahmini arteriyel değerlerle yapıldı — pH ${f2(a.pH)}, pCO₂ ${f1(a.pCO2)}, HCO₃⁻ ${f1(a.HCO3)}.`,
        how: {
          formula: `Tahmini arteriyel pH = venöz pH + ${f2(VENOUS.dpH)} ; pCO₂ = venöz − ${VENOUS.dpCO2} ; HCO₃⁻ = venöz − ${VENOUS.dHCO3}`,
          calc: `pH ${f2(pH)} + 0,03 = ${f2(a.pH)} ; pCO₂ ${f1(pCO2)} − 4 = ${f1(a.pCO2)} ; HCO₃⁻ ${f1(HCO3)} − 1 = ${f1(a.HCO3)}`,
          note: 'pH ve HCO₃⁻ için uyum iyidir; pCO₂ düzeltmesi yaklaşıktır, solunumsal yorum düşük güvenlidir. Ayarlar’dan kapatılabilir.',
          source: SRC.byrne,
        },
      });
    }
    usedABG = { ...a, estimated };

    const acidemia = a.pH < 7.35;
    const alkalemia = a.pH > 7.45;
    const rAc = a.pCO2 > 45, rAl = a.pCO2 < 35, mAc = a.HCO3 < 22, mAl = a.HCO3 > 26;

    ab.push({
      tone: acidemia || alkalemia ? 'warn' : 'ok',
      text: `pH ${f2(a.pH)}: ${acidemia ? 'asidemi (< 7,35)' : alkalemia ? 'alkalemi (> 7,45)' : 'normal aralıkta (7,35–7,45)'}.`,
      how: { formula: 'Normal pH 7,35–7,45 · pCO₂ 35–45 mmHg · HCO₃⁻ 22–26 mmol/L', source: 'Berend K ve ark. N Engl J Med 2014;371:1434-45.' },
    });
    if (a.pH < 7.2) alerts.push({ tone: 'bad', text: `Ağır asidemi (pH ${f2(a.pH)}).` });
    if (a.pH > 7.6) alerts.push({ tone: 'bad', text: `Ağır alkalemi (pH ${f2(a.pH)}).` });

    // primer bozukluk(lar)
    type P = 'RAc' | 'RAl' | 'MA' | 'MAl';
    let prim: P[] = [];
    let mixedOpp = false;
    const side = a.pH < 7.4 ? 'asit' : a.pH > 7.4 ? 'alkali' : 'nötr';
    if (side === 'asit') {
      if (rAc) prim.push('RAc');
      if (mAc) prim.push('MA');
    } else if (side === 'alkali') {
      if (rAl) prim.push('RAl');
      if (mAl) prim.push('MAl');
    }
    if (!prim.length) {
      if (acidemia) prim = [(a.pCO2 - 40) / 5 >= (24 - a.HCO3) / 2 ? 'RAc' : 'MA'];
      else if (alkalemia) prim = [(40 - a.pCO2) / 5 >= (a.HCO3 - 24) / 2 ? 'RAl' : 'MAl'];
      else {
        // pH normal, pH'ın tarafında aday yok → anormal olanları al
        if (rAc) prim.push('RAc');
        if (rAl) prim.push('RAl');
        if (mAc) prim.push('MA');
        if (mAl) prim.push('MAl');
      }
    }
    if (!acidemia && !alkalemia && ((rAc && mAl) || (rAl && mAc))) mixedOpp = true;

    const ruleHow: How = {
      formula: 'pH’nın yönü ile pCO₂/HCO₃⁻ değişiminin yönü karşılaştırılır. Asidemide pCO₂↑ → solunumsal, HCO₃⁻↓ → metabolik; alkalemide pCO₂↓ → solunumsal, HCO₃⁻↑ → metabolik. pH normal ama pCO₂ ve HCO₃⁻ anormalse mikst bozukluk vardır (pH 7,40’ın hangi tarafındaysa o süreç baskındır).',
      source: 'Berend K ve ark. N Engl J Med 2014;371:1434-45; Aygencel G. Türk Kardiyol Dern Arş 2014;42:194-202.',
    };

    if (!prim.length) {
      ab.push({ tone: 'ok', text: 'pH, pCO₂ ve HCO₃⁻ normal aralıkta: belirgin primer asit-baz bozukluğu yok.', how: ruleHow });
    } else if (prim.length === 2 && !mixedOpp) {
      const acid = prim.includes('RAc');
      ab.push({
        tone: 'bad',
        text: acid
          ? 'pCO₂ yüksek VE HCO₃⁻ düşük: kombine solunumsal + metabolik asidoz (kompansasyon yok, iki süreç aynı yönde).'
          : 'pCO₂ düşük VE HCO₃⁻ yüksek: kombine solunumsal + metabolik alkaloz.',
        how: ruleHow,
      });
      if (acid) {
        addDis('RAc', 'Solunumsal asidoz', 'primer');
        addDis('MA', 'Metabolik asidoz', 'primer');
        respiratoryProcess = true;
        maPresent = true;
      } else {
        addDis('RAlk', 'Solunumsal alkaloz', 'primer');
        addDis('MAlk', 'Metabolik alkaloz', 'primer');
        respiratoryProcess = true;
      }
    } else {
      // tek primer (veya pH normal mikst → pH tarafındaki baskın)
      let p: P = prim[0];
      if (mixedOpp) {
        p = side === 'asit' ? (rAc ? 'RAc' : 'MA') : side === 'alkali' ? (rAl ? 'RAl' : 'MAl') : prim[0];
        ab.push({
          tone: 'warn',
          text: 'pH normal olduğu halde pCO₂ ve HCO₃⁻ anormal: mikst bozukluk olasılığı. Kompansasyon hesaplanarak kontrol ediliyor.',
          how: ruleHow,
        });
      }
      const role: Role = mixedOpp ? 'mikst' : 'primer';
      const names: Record<P, string> = { RAc: 'solunumsal asidoz', RAl: 'solunumsal alkaloz', MA: 'metabolik asidoz', MAl: 'metabolik alkaloz' };
      ab.push({ tone: 'warn', text: `Primer bozukluk: ${names[p]}.`, how: ruleHow });

      // ---- kompansasyon ----
      if (p === 'MA') {
        maPresent = true;
        addDis('MA', 'Metabolik asidoz', role);
        const exp = 1.5 * a.HCO3 + 8;
        const lo = exp - 2, hi = exp + 2;
        calcs.push({
          label: 'Beklenen pCO₂ (Winter)',
          value: `${f1(lo)}–${f1(hi)}`,
          unit: 'mmHg',
          how: { formula: 'Beklenen pCO₂ = 1,5 × HCO₃⁻ + 8 ± 2', calc: `1,5 × ${f1(a.HCO3)} + 8 = ${f1(exp)} → ${f1(lo)}–${f1(hi)}`, note: 'Pratik kontrol: beklenen pCO₂ ≈ pH’nın ondalıktan sonraki iki hanesi (ör. pH 7,26 → ~26).', source: SRC.winter },
        });
        if (a.pCO2 > hi) {
          ab.push({ tone: 'bad', text: `pCO₂ ${f1(a.pCO2)} > beklenen (${f1(lo)}–${f1(hi)}): eşlik eden solunumsal asidoz (yetersiz solunumsal kompansasyon — yorulma, depresyon?).` });
          addDis('RAc', 'Solunumsal asidoz', 'eşlik eden');
          respiratoryProcess = true;
        } else if (a.pCO2 < lo) {
          ab.push({ tone: 'warn', text: `pCO₂ ${f1(a.pCO2)} < beklenen (${f1(lo)}–${f1(hi)}): eşlik eden solunumsal alkaloz.` });
          addDis('RAlk', 'Solunumsal alkaloz', 'eşlik eden');
          respiratoryProcess = true;
        } else ab.push({ tone: 'ok', text: `pCO₂ ${f1(a.pCO2)} beklenen aralıkta (${f1(lo)}–${f1(hi)}): uygun solunumsal kompansasyon.` });
      } else if (p === 'MAl') {
        addDis('MAlk', 'Metabolik alkaloz', role);
        const d = a.HCO3 - 24;
        const lo = 40 + 0.6 * d - 2, hi = 40 + 0.7 * d + 2;
        calcs.push({
          label: 'Beklenen pCO₂ (met. alkaloz)',
          value: `${f1(lo)}–${f1(hi)}`,
          unit: 'mmHg',
          how: { formula: 'Her 1 mmol/L HCO₃⁻ artışı için pCO₂ 0,6–0,7 mmHg artar (± 2)', calc: `ΔHCO₃⁻ = ${f1(a.HCO3)} − 24 = ${f1(d)} → 40 + (0,6–0,7) × ${f1(d)} = ${f1(40 + 0.6 * d)}–${f1(40 + 0.7 * d)} (± 2)`, note: 'Alternatif: pCO₂ ≈ HCO₃⁻ + 15. Solunumsal kompansasyon nadiren 55 mmHg’yi aşar.', source: SRC.comp },
        });
        if (a.pCO2 > hi) {
          ab.push({ tone: 'bad', text: `pCO₂ ${f1(a.pCO2)} > beklenen (${f1(lo)}–${f1(hi)}): eşlik eden solunumsal asidoz.` });
          addDis('RAc', 'Solunumsal asidoz', mixedOpp ? 'mikst' : 'eşlik eden');
          respiratoryProcess = true;
        } else if (a.pCO2 < lo) {
          ab.push({ tone: 'warn', text: `pCO₂ ${f1(a.pCO2)} < beklenen (${f1(lo)}–${f1(hi)}): eşlik eden solunumsal alkaloz.` });
          addDis('RAlk', 'Solunumsal alkaloz', 'eşlik eden');
          respiratoryProcess = true;
        } else ab.push({ tone: 'ok', text: `pCO₂ ${f1(a.pCO2)} beklenen aralıkta: uygun solunumsal kompansasyon.` });
      } else {
        respiratoryProcess = true;
        const acid = p === 'RAc';
        const d = acid ? a.pCO2 - 40 : 40 - a.pCO2;
        const sgn = acid ? 1 : -1;
        const acuteH = 24 + sgn * (acid ? 0.1 : 0.2) * d;
        const chrA = 24 + sgn * (acid ? 0.3 : 0.4) * d;
        const chrB = 24 + sgn * (acid ? 0.4 : 0.5) * d;
        const chrLo = Math.min(chrA, chrB), chrHi = Math.max(chrA, chrB);
        const pHacute = 7.4 - sgn * 0.008 * d;
        const pHchr = 7.4 - sgn * 0.003 * d;
        addDis(acid ? 'RAc' : 'RAlk', acid ? 'Solunumsal asidoz' : 'Solunumsal alkaloz', role);
        calcs.push({
          label: `Beklenen HCO₃⁻ — akut`,
          value: `${f1(acuteH - 2)}–${f1(acuteH + 2)}`,
          unit: 'mmol/L',
          how: {
            formula: acid ? 'Akut: her 10 mmHg pCO₂ artışında HCO₃⁻ 1 mmol/L artar, pH 0,08 düşer' : 'Akut: her 10 mmHg pCO₂ azalışında HCO₃⁻ 2 mmol/L azalır, pH 0,08 artar',
            calc: `ΔpCO₂ = ${f1(d)} → HCO₃⁻ = 24 ${acid ? '+' : '−'} ${acid ? '1' : '2'} × ${f1(d)}/10 = ${f1(acuteH)} (± 2) ; beklenen pH ≈ ${f2(pHacute)}`,
            source: SRC.comp,
          },
        });
        calcs.push({
          label: `Beklenen HCO₃⁻ — kronik`,
          value: `${f1(chrLo - 2)}–${f1(chrHi + 2)}`,
          unit: 'mmol/L',
          how: {
            formula: acid ? 'Kronik (2–5 gün): her 10 mmHg pCO₂ artışında HCO₃⁻ 3–4 mmol/L artar, pH 0,03 düşer' : 'Kronik (2–5 gün): her 10 mmHg pCO₂ azalışında HCO₃⁻ 4–5 mmol/L azalır, pH 0,03 artar',
            calc: `HCO₃⁻ = 24 ${acid ? '+ (3–4)' : '− (4–5)'} × ${f1(d)}/10 = ${f1(chrLo)}–${f1(chrHi)} (± 2) ; beklenen pH ≈ ${f2(pHchr)}`,
            source: SRC.comp,
          },
        });
        const H = a.HCO3;
        const inAcute = Math.abs(H - acuteH) <= 2;
        const inChr = H >= chrLo - 2 && H <= chrHi + 2;
        // "metabolik asidoz tarafı" (asidozda düşük HCO3, alkalozda da düşük HCO3)
        const belowAll = acid ? H < acuteH - 2 : H < chrLo - 2;
        const aboveAll = acid ? H > chrHi + 2 : H > acuteH + 2;
        const between = !inAcute && !inChr && !belowAll && !aboveAll;
        const ch = inp.chronicity;
        if (belowAll) {
          ab.push({ tone: 'bad', text: `HCO₃⁻ ${f1(H)} beklenenden düşük: eşlik eden metabolik asidoz.` });
          addDis('MA', 'Metabolik asidoz', 'eşlik eden');
          maPresent = true;
        } else if (aboveAll) {
          ab.push({ tone: 'bad', text: `HCO₃⁻ ${f1(H)} beklenenden yüksek: eşlik eden metabolik alkaloz.` });
          addDis('MAlk', 'Metabolik alkaloz', mixedOpp ? 'mikst' : 'eşlik eden');
        } else if (ch === 'akut') {
          if (inAcute) ab.push({ tone: 'ok', text: `HCO₃⁻ ${f1(H)} akut süreçle uyumlu: akut ${acid ? 'solunumsal asidoz' : 'solunumsal alkaloz'}, ek metabolik bozukluk yok.` });
          else if (acid) {
            ab.push({ tone: 'warn', text: `Akut süreç seçildi, HCO₃⁻ ${f1(H)} akut beklenenden yüksek: eşlik eden metabolik alkaloz (ya da süreç sanıldığından uzun süreli).` });
            addDis('MAlk', 'Metabolik alkaloz', 'eşlik eden');
          } else {
            ab.push({ tone: 'warn', text: `Akut süreç seçildi, HCO₃⁻ ${f1(H)} akut beklenenden düşük: eşlik eden metabolik asidoz (ya da süreç sanıldığından uzun süreli).` });
            addDis('MA', 'Metabolik asidoz', 'eşlik eden');
            maPresent = true;
          }
        } else if (ch === 'kronik') {
          if (inChr) ab.push({ tone: 'ok', text: `HCO₃⁻ ${f1(H)} kronik süreçle uyumlu: kompanse kronik ${acid ? 'solunumsal asidoz' : 'solunumsal alkaloz'}.` });
          else if (acid) {
            ab.push({ tone: 'warn', text: `Kronik süreç seçildi, HCO₃⁻ ${f1(H)} kronik beklenenden düşük: kronik zemin üzerine akut kötüleşme veya eşlik eden metabolik asidoz.` });
            addDis('MA', 'Metabolik asidoz', 'olası');
          } else {
            ab.push({ tone: 'warn', text: `Kronik süreç seçildi, HCO₃⁻ ${f1(H)} kronik beklenenden yüksek: kompansasyon henüz tamamlanmamış ya da eşlik eden metabolik alkaloz.` });
            addDis('MAlk', 'Metabolik alkaloz', 'olası');
          }
        } else {
          // süre bilinmiyor
          if (inAcute && !inChr) ab.push({ tone: 'ok', text: `HCO₃⁻ ${f1(H)} akut süreçle uyumlu (akut ${acid ? 'solunumsal asidoz' : 'solunumsal alkaloz'}). Süreç kronikse eşlik eden metabolik ${acid ? 'asidoz' : 'alkaloz'} olurdu.` });
          else if (inChr && !inAcute) {
            ab.push({ tone: 'ok', text: `HCO₃⁻ ${f1(H)} kronik (kompanse) süreçle uyumlu. Süreç akutsa eşlik eden metabolik ${acid ? 'alkaloz' : 'asidoz'} vardır.` });
            addDis(acid ? 'MAlk' : 'MA', acid ? 'Metabolik alkaloz' : 'Metabolik asidoz', 'olası');
          } else if (inAcute && inChr) ab.push({ tone: 'ok', text: `HCO₃⁻ ${f1(H)} hem akut hem kronik beklenenle uyumlu (pCO₂ değişimi küçük).` });
          else if (between) {
            ab.push({ tone: 'warn', text: `HCO₃⁻ ${f1(H)} akut ile kronik beklenen arasında: kısmen kompanse / kronik üzerine akut süreç, ya da akut süreç + eşlik eden metabolik ${acid ? 'alkaloz' : 'asidoz'}.` });
            addDis(acid ? 'MAlk' : 'MA', acid ? 'Metabolik alkaloz' : 'Metabolik asidoz', 'olası');
          }
          ab.push({ tone: 'muted', text: 'Daha kesin yorum için klinik süreyi (akut / kronik) seçin.' });
        }
      }
    }
  } else {
    if (has(pH)) {
      const s = pH < 7.35 ? 'asidemi' : pH > 7.45 ? 'alkalemi' : 'normal pH';
      ab.push({ tone: pH < 7.35 || pH > 7.45 ? 'warn' : 'ok', text: `pH ${f2(pH)}: ${s}. Primer bozukluğu belirlemek için pCO₂ ve HCO₃⁻ gerekli.` });
    }
    if (nAB < 2) missing.push({ fields: 'pH, pCO₂, HCO₃⁻ (en az ikisi)', reason: 'Asit-baz yorumu için (üçüncüsü hesaplanır)' });
  }

  // BE
  if (has(inp.BE)) {
    const be = inp.BE;
    ab.push({
      tone: be < -2 || be > 2 ? 'warn' : 'ok',
      text: `Baz fazlalığı ${f1(be)} mmol/L: ${be < -2 ? 'metabolik asidoz yönünde' : be > 2 ? 'metabolik alkaloz yönünde' : 'normal (−2/+2)'}.`,
      how: { formula: 'BE < −2 → metabolik asidoz ; BE > +2 → metabolik alkaloz (bazı kaynaklarda ±2,5 veya ±3)', source: 'Berend K ve ark. N Engl J Med 2014;371:1434-45.' },
    });
    if (inp.trauma && be < -2) {
      const cls = be > -6 ? 'II (−2 ile −6)' : be > -10 ? 'III (−6 ile −10)' : 'IV (≤ −10)';
      ab.push({ tone: 'bad', text: `Travma: baz açığı ATLS hemoraji sınıfı ${cls} ile uyumlu — transfüzyon gereksinimi ve mortalite ile ilişkili.`, how: { formula: 'Sınıf I: 0 ile −2 · II: −2 ile −6 · III: −6 ile −10 · IV: ≤ −10 mmol/L', source: SRC.atls } });
    }
  }

  // ---------- Anyon açığı ----------
  const agLines: Line[] = [];
  const hRaw = has(inp.HCO3) ? inp.HCO3 : HCO3;
  let AG: number | undefined;
  let AGsrc = '';
  if (has(inp.Na) && has(inp.Cl) && has(hRaw)) {
    AG = inp.Na - (inp.Cl + hRaw);
    AGsrc = 'calc';
    calcs.push({
      label: 'Anyon açığı',
      value: f1(AG),
      unit: 'mmol/L',
      how: { formula: 'AA = Na⁺ − (Cl⁻ + HCO₃⁻)', calc: `${f1(inp.Na)} − (${f1(inp.Cl)} + ${f1(hRaw)}) = ${f1(AG)}`, note: `Normal ≈ ${st.normalAG} ± 4 mmol/L (laboratuvara göre değişir; Ayarlar’dan değiştirilebilir).`, source: SRC.ag },
    });
  } else if (has(inp.AGdirect)) {
    AG = inp.AGdirect;
    AGsrc = 'direct';
  }
  let AGc: number | undefined;
  if (has(AG)) {
    if (has(inp.albumin)) {
      AGc = AG + 2.5 * (st.refAlbumin - inp.albumin);
      calcs.push({
        label: 'Albümine göre düzeltilmiş AA',
        value: f1(AGc),
        unit: 'mmol/L',
        how: { formula: `Düzeltilmiş AA = AA + 2,5 × (${f1(st.refAlbumin)} − albümin [g/dL])`, calc: `${f1(AG)} + 2,5 × (${f1(st.refAlbumin)} − ${f1(inp.albumin)}) = ${f1(AGc)}`, note: 'Albümindeki her 1 g/dL düşüş AA’yı ~2,5 mmol/L azaltır. Referans albümin bazı kaynaklarda 4,4–4,5 g/dL (Ayarlar).', source: SRC.figge },
      });
    }
  }
  const agUse = has(AGc) ? AGc : AG;
  const agHi = st.normalAG + 4;
  let hagma = false;
  if (has(agUse) && has(hRaw)) {
    const label = has(AGc) ? 'Düzeltilmiş AA' : 'AA';
    const elevated = agUse > agHi;
    const border = !elevated && agUse > st.normalAG;
    agLines.push({
      tone: elevated ? 'bad' : border ? 'warn' : 'ok',
      text: `${label} ${f1(agUse)} mmol/L${AGsrc === 'direct' ? ' (girilen değer)' : ''}: ${elevated ? 'artmış' : border ? 'üst-normal / sınırda' : 'normal'}.`,
    });
    if (!has(inp.albumin)) {
      agLines.push({ tone: 'warn', text: 'Albümin girilmedi: hipoalbüminemi anyon açığını olduğundan düşük gösterir, artmış AA’lı asidoz gözden kaçabilir.' });
      missing.push({ fields: 'Albümin', reason: 'Anyon açığını düzeltmek için' });
    }
    if (elevated) {
      hagma = true;
      if (maPresent) {
        const ex = disorders.find((d) => d.key === 'MA');
        const role = ex ? ex.role : 'primer';
        disorders.splice(disorders.indexOf(ex!), ex ? 1 : 0);
        addDis('HAGMA', 'Artmış anyon açıklı metabolik asidoz', role);
      } else {
        addDis('HAGMA', 'Artmış anyon açıklı metabolik asidoz', 'gizli');
        agLines.push({ tone: 'bad', text: 'HCO₃⁻ düşük değil ama AA artmış: gizli artmış AA’lı metabolik asidoz — çoğunlukla eşlik eden metabolik alkaloz veya solunumsal süreç tarafından maskelenir.' });
      }
      // delta
      const dAG = agUse - st.normalAG;
      const dH = 24 - hRaw;
      const deltaGap = dAG - dH;
      if (dH <= 0.5) {
        agLines.push({ tone: 'bad', text: `AA artışına rağmen HCO₃⁻ düşmemiş (${f1(hRaw)}): eşlik eden metabolik alkaloz.` });
        addDis('MAlk', 'Metabolik alkaloz', 'eşlik eden');
      } else {
        const r = dAG / dH;
        const how: How = {
          formula: `Δ/Δ = (AA − ${st.normalAG}) / (24 − HCO₃⁻)`,
          calc: `(${f1(agUse)} − ${st.normalAG}) / (24 − ${f1(hRaw)}) = ${f1(dAG)} / ${f1(dH)} = ${f2(r)}`,
          note:
            st.deltaMode === 'genis'
              ? '< 0,4 hiperkloremik (normal AA’lı) asidoz baskın · 0,4–0,8 artmış + normal AA’lı asidoz birlikte · 0,8–2,0 saf artmış AA’lı asidoz (DKA’da ~1, laktikte ~1,6) · > 2 eşlik eden metabolik alkaloz veya önceden var olan kronik solunumsal asidoz. Ayarlar’dan klasik basit kurala geçilebilir.'
              : 'Klasik basit kural: ≈ 1 saf artmış AA’lı asidoz · < 1 eşlik eden hiperkloremik asidoz · > 1 eşlik eden metabolik alkaloz (± 0,2 tolerans uygulandı).',
          source: st.deltaMode === 'genis' ? SRC.rastegar : 'Aygencel G. Türk Kardiyol Dern Arş 2014;42:194-202; Börekçi Ş, Umut S. Türk Toraks Derg 2011;12(Ek 1):5-9.',
        };
        calcs.push({ label: 'Delta oranı (ΔAA/ΔHCO₃⁻)', value: f2(r), how });
        calcs.push({
          label: 'Delta açığı (ΔAA − ΔHCO₃⁻)',
          value: f1(deltaGap),
          unit: 'mmol/L',
          how: { formula: 'Delta açığı = (AA − normal AA) − (24 − HCO₃⁻)', calc: `${f1(dAG)} − ${f1(dH)} = ${f1(deltaGap)}`, note: '> +6 eşlik eden metabolik alkaloz · < −6 eşlik eden normal AA’lı asidoz · arası saf artmış AA’lı asidoz.', source: SRC.rastegar },
        });
        let lo: number, hi: number;
        if (st.deltaMode === 'genis') { lo = 0.8; hi = 2; } else { lo = 0.8; hi = 1.2; }
        if (st.deltaMode === 'genis' && r < 0.4) {
          agLines.push({ tone: 'bad', text: `Δ/Δ ${f2(r)} (< 0,4): normal AA’lı (hiperkloremik) asidoz baskın.`, how });
          addDis('NAGMA', 'Normal anyon açıklı (hiperkloremik) metabolik asidoz', 'eşlik eden');
        } else if (r < lo) {
          agLines.push({ tone: 'bad', text: `Δ/Δ ${f2(r)} (< ${f1(lo)}): artmış AA’lı asidoza eşlik eden normal AA’lı (hiperkloremik) asidoz.`, how });
          addDis('NAGMA', 'Normal anyon açıklı (hiperkloremik) metabolik asidoz', 'eşlik eden');
        } else if (r <= hi) {
          agLines.push({
            tone: 'ok',
            text: `Δ/Δ ${f2(r)}: saf artmış AA’lı metabolik asidoz ile uyumlu.${st.deltaMode === 'genis' && r > 1.2 ? ' (Klasik basit kurala göre > 1 eşlik eden metabolik alkaloz olarak yorumlanır; laktik asidozda oran ~1,6 olabilir — kusma/diüretik öyküsü varsa metabolik alkalozu düşünün.)' : ''}`,
            how,
          });
        } else {
          agLines.push({ tone: 'bad', text: `Δ/Δ ${f2(r)} (> ${f1(hi)}): eşlik eden metabolik alkaloz${st.deltaMode === 'genis' ? ' (veya önceden var olan kompanse kronik solunumsal asidoz)' : ''}.`, how });
          addDis('MAlk', 'Metabolik alkaloz', 'eşlik eden');
        }
        if (disorders.some((d) => d.key === 'RAc' || d.key === 'RAlk'))
          agLines.push({ tone: 'muted', text: 'Not: Solunumsal bozukluk varken başlangıç HCO₃⁻’ü 24 değildir; delta yorumu yaklaşık kabul edilmelidir.' });
      }
    } else if (maPresent) {
      const ex = disorders.find((d) => d.key === 'MA');
      if (ex) {
        ex.key = 'NAGMA';
        ex.label = 'Normal anyon açıklı (hiperkloremik) metabolik asidoz';
      }
      agLines.push({ tone: 'warn', text: 'Metabolik asidoz + normal AA: hiperkloremik (HCO₃⁻ kaybı veya asit atılım bozukluğu) asidoz.' });
      if (border && !has(inp.albumin)) agLines.push({ tone: 'warn', text: 'AA sınırda; albümin düşükse aslında artmış AA’lı asidoz olabilir.' });
    }
  } else if (maPresent || disorders.some((d) => d.key === 'MA')) {
    missing.push({ fields: 'Na⁺, Cl⁻', reason: 'Metabolik asidozu tiplendirmek (anyon açığı, delta oranı) için' });
    agLines.push({ tone: 'muted', text: 'Anyon açığı hesaplanamadı: metabolik asidozun tipi (artmış / normal AA) belirlenemiyor.' });
  } else if (has(hRaw) && (!has(inp.Na) || !has(inp.Cl))) {
    missing.push({ fields: 'Na⁺, Cl⁻', reason: 'Anyon açığı (gizli artmış AA’lı asidozu dışlamak) için' });
  }

  // ---------- ileri tetkik: HAGMA ----------
  if (hagma) {
    if (has(inp.lactate)) {
      agLines.push({ tone: inp.lactate >= 4 ? 'bad' : inp.lactate > 2 ? 'warn' : 'ok', text: `Laktat ${f1(inp.lactate)} mmol/L: ${inp.lactate > 2 ? 'laktik asidoz katkısı var' : 'laktik asidoz olası değil'}.` });
    } else missing.push({ fields: 'Laktat', reason: 'Artmış AA’lı asidozun nedeni (laktik asidoz) için' });
    if (!has(inp.ketone) && !has(inp.glucose)) missing.push({ fields: 'Glukoz, keton (β-HB)', reason: 'Ketoasidozu değerlendirmek için' });
    if (!has(inp.bun) && !has(inp.creatinine)) missing.push({ fields: 'Üre/BUN, kreatinin', reason: 'Üremik asidozu değerlendirmek için' });
  }

  // osmolar açık
  if (has(inp.Na) && has(inp.glucose) && has(inp.bun)) {
    const etoh = has(inp.ethanol) ? inp.ethanol / 3.7 : 0;
    const osmCalc = 2 * inp.Na + inp.glucose / 18 + inp.bun / 2.8 + etoh;
    calcs.push({
      label: 'Hesaplanan osmolalite',
      value: f1(osmCalc),
      unit: 'mOsm/kg',
      how: {
        formula: '2 × Na⁺ + glukoz/18 + BUN/2,8 (+ etanol/3,7) [mg/dL]',
        calc: `2 × ${f1(inp.Na)} + ${f1(inp.glucose)}/18 + ${f1(inp.bun)}/2,8${has(inp.ethanol) ? ` + ${f1(inp.ethanol)}/3,7` : ''} = ${f1(osmCalc)}`,
        note: 'Üre girildiyse BUN = üre / 2,14 olarak çevrildi.',
        source: SRC.osm,
      },
    });
    if (has(inp.osmMeasured)) {
      const og = inp.osmMeasured - osmCalc;
      calcs.push({
        label: 'Osmolar açık',
        value: f1(og),
        unit: 'mOsm/kg',
        tone: og > 20 ? 'bad' : og > 10 ? 'warn' : 'ok',
        how: { formula: 'Osmolar açık = ölçülen − hesaplanan osmolalite', calc: `${f1(inp.osmMeasured)} − ${f1(osmCalc)} = ${f1(og)}`, note: '< 10 normal · > 10 artmış · > 20 (artmış AA ile birlikte) toksik alkol (metanol, etilen glikol) için güçlü ipucu. Geç dönemde alkol metabolize olunca açık normale dönebilir; normal açık toksik alkolü dışlamaz.', source: SRC.osm },
      });
      agLines.push({ tone: og > 20 ? 'bad' : og > 10 ? 'warn' : 'ok', text: `Osmolar açık ${f1(og)} mOsm/kg${og > 10 && hagma ? ': artmış AA ile birlikte toksik alkol (metanol/etilen glikol) düşünün!' : og > 10 ? ': artmış' : ': normal'}.` });
    } else if (hagma) missing.push({ fields: 'Ölçülen osmolalite', reason: 'Osmolar açık (toksik alkol) için' });
  } else if (hagma && has(inp.osmMeasured)) {
    missing.push({ fields: 'Na⁺, glukoz, üre/BUN', reason: 'Osmolar açık hesabı için' });
  } else if (hagma) {
    missing.push({ fields: 'Ölçülen osmolalite + glukoz + üre/BUN', reason: 'Osmolar açık (toksik alkol taraması) için' });
  }

  // DKA kriterleri
  if (has(inp.ketone) || has(inp.glucose)) {
    const ket = has(inp.ketone) && inp.ketone >= 3;
    const glu = has(inp.glucose) && inp.glucose >= 200;
    const acid = (has(pH) && (usedABG ? usedABG.pH : pH) < 7.3) || (has(hRaw) && hRaw < 18);
    if (ket && acid) {
      agLines.push({
        tone: 'bad',
        text: `β-HB ≥ 3 mmol/L + asidoz${glu ? ' + glukoz ≥ 200 mg/dL' : ''}: diyabetik ketoasidoz kriterleri${glu ? '' : ' (glukoz < 200 ise öglisemik DKA — SGLT2 inhibitörü, gebelik, açlık?)'} ile uyumlu.`,
        how: { formula: 'DKA: glukoz ≥ 200 mg/dL (veya bilinen diyabet) + β-HB ≥ 3,0 mmol/L (veya idrar ketonu ≥ 2+) + pH < 7,30 ve/veya HCO₃⁻ < 18 mmol/L', source: SRC.ada },
      });
    } else if (glu && acid && !has(inp.ketone)) {
      agLines.push({ tone: 'warn', text: 'Hiperglisemi + asidoz: DKA için keton (β-HB) ölçün.' });
      missing.push({ fields: 'Keton (β-hidroksibütirat)', reason: 'DKA tanı kriterleri için' });
    }
  }

  // NAGMA ileri
  if (disorders.some((d) => d.key === 'NAGMA')) {
    if (has(inp.uNa) && has(inp.uK) && has(inp.uCl)) {
      const uag = inp.uNa + inp.uK - inp.uCl;
      calcs.push({
        label: 'İdrar anyon açığı',
        value: f1(uag),
        unit: 'mmol/L',
        how: { formula: 'İAA = idrar (Na⁺ + K⁺) − Cl⁻', calc: `${f1(inp.uNa)} + ${f1(inp.uK)} − ${f1(inp.uCl)} = ${f1(uag)}`, note: 'Negatif → böbrek NH₄⁺ atabiliyor: GİS kaybı (diyare) veya proksimal RTA. Pozitif → renal asit atılım bozukluğu: distal (tip 1) veya tip 4 RTA. Ketonüri, idrar pH > 6,5 veya hipovolemide güvenilmezdir.', source: SRC.uag },
      });
      agLines.push({ tone: 'info', text: `İdrar AA ${f1(uag)}: ${uag < 0 ? 'negatif → GİS kaynaklı HCO₃⁻ kaybı (diyare) olasılığı' : 'pozitif → renal kaynak (distal/tip 4 RTA) olasılığı'}.` });
    } else missing.push({ fields: 'İdrar Na⁺, K⁺, Cl⁻', reason: 'Normal AA’lı asidozda GİS / renal ayrımı için' });
  }

  // Metabolik alkaloz ileri
  if (disorders.some((d) => d.key === 'MAlk' && d.role !== 'olası')) {
    if (has(inp.uCl)) {
      const resp = inp.uCl < 20;
      agLines.push({
        tone: 'info',
        text: resp
          ? `İdrar Cl⁻ ${f1(inp.uCl)} (< 20): klora yanıtlı metabolik alkaloz — kusma, NG drenaj, geçmiş diüretik, posthiperkapni.`
          : `İdrar Cl⁻ ${f1(inp.uCl)} (≥ 20): klora dirençli — ${inp.bp === 'hipertansif' ? 'hipertansif: mineralokortikoid fazlalığı (Conn, Cushing, renal arter stenozu)' : inp.bp === 'normotansif' ? 'normotansif: aktif diüretik, Bartter/Gitelman, ağır hipokalemi' : 'tansiyon durumunu seçin (hipertansif → mineralokortikoid; normotansif → diüretik/Bartter/Gitelman)'}.`,
        how: { formula: 'İdrar Cl⁻ < 20 mmol/L → klora (serum fizyolojik) yanıtlı ; ≥ 20 → klora dirençli. Bazı kaynaklarda eşik 10 mmol/L olarak geçer.', source: SRC.galla },
      });
    } else missing.push({ fields: 'İdrar Cl⁻ (+ tansiyon durumu)', reason: 'Metabolik alkalozun nedenini ayırmak için' });
  }

  if (agLines.length) steps.push({ id: 'ag', title: '4 · Anyon açığı ve ileri değerlendirme', tone: hagma ? 'bad' : 'info', lines: agLines });
  if (ab.length) {
    const abTone: Tone = disorders.some((d) => d.key !== 'hypox') ? 'bad' : 'ok';
    steps.splice(steps.findIndex((s) => s.id === 'ag') === -1 ? steps.length : steps.findIndex((s) => s.id === 'ag'), 0, { id: 'ab', title: '3 · Asit-baz dengesi', tone: abTone, lines: ab });
  }

  // ---------- 5) Elektrolit/metabolit ----------
  const el: Line[] = [];
  if (has(inp.K)) {
    const k = inp.K;
    if (k >= 6.5) el.push({ tone: 'bad', text: `K⁺ ${f1(k)}: ağır hiperkalemi — EKG, acil tedavi.` });
    else if (k > 5.5) el.push({ tone: 'warn', text: `K⁺ ${f1(k)}: hiperkalemi${has(pH) && pH < 7.3 ? ' (asidoz K⁺’u hücre dışına kaydırır; asidoz düzelince düşecektir)' : ''}.` });
    else if (k < 2.5) el.push({ tone: 'bad', text: `K⁺ ${f1(k)}: ağır hipokalemi.` });
    else if (k < 3.5) el.push({ tone: 'warn', text: `K⁺ ${f1(k)}: hipokalemi${has(pH) && pH < 7.3 ? ' — asidozda düşük K⁺ total vücut açığının büyük olduğunu gösterir; insülin/bikarbonat öncesi yerine koyun' : ''}.` });
  }
  if (has(inp.Na)) {
    let na = inp.Na;
    let txt = '';
    if (has(inp.glucose) && inp.glucose > 100) {
      const c = inp.Na + 0.024 * (inp.glucose - 100);
      calcs.push({ label: 'Glukoza göre düzeltilmiş Na⁺', value: f1(c), unit: 'mmol/L', how: { formula: 'Düzeltilmiş Na⁺ = Na⁺ + 2,4 × (glukoz − 100) / 100', calc: `${f1(inp.Na)} + 0,024 × (${f1(inp.glucose)} − 100) = ${f1(c)}`, note: 'Katz katsayısı 1,6 kullanılırsa değer daha düşük çıkar.', source: 'Hillier TA ve ark. Am J Med 1999;106:399-403.' } });
      if (inp.glucose >= 200) { na = c; txt = ' (glukoza göre düzeltilmiş)'; }
    }
    if (na < 135) el.push({ tone: na < 125 ? 'bad' : 'warn', text: `Na⁺ ${f1(na)}${txt}: hiponatremi.` });
    else if (na > 145) el.push({ tone: na > 155 ? 'bad' : 'warn', text: `Na⁺ ${f1(na)}${txt}: hipernatremi.` });
  }
  if (has(inp.Cl) && has(inp.Na) && !has(AG)) {
    /* AA yoksa Cl tek başına yorumlanmaz */
  }
  if (has(inp.iCa)) {
    if (inp.iCa < 1.15) el.push({ tone: inp.iCa < 0.9 ? 'bad' : 'warn', text: `İyonize Ca ${fmt(inp.iCa, 2)} mmol/L: hipokalsemi${has(pH) && pH > 7.45 ? ' (alkalemi iyonize Ca’yı düşürür)' : ''}.` });
    else if (inp.iCa > 1.3) el.push({ tone: 'warn', text: `İyonize Ca ${fmt(inp.iCa, 2)} mmol/L: hiperkalsemi.` });
  }
  if (has(inp.glucose)) {
    if (inp.glucose < 70) el.push({ tone: 'bad', text: `Glukoz ${fmt(inp.glucose, 0)} mg/dL: hipoglisemi.` });
    else if (inp.glucose >= 250) el.push({ tone: 'warn', text: `Glukoz ${fmt(inp.glucose, 0)} mg/dL: belirgin hiperglisemi.` });
  }
  if (has(inp.lactate) && !hagma) {
    if (inp.lactate > 2) el.push({ tone: inp.lactate >= 4 ? 'bad' : 'warn', text: `Laktat ${f1(inp.lactate)} mmol/L: hiperlaktatemi${inp.lactate >= 4 ? ' (≥ 4: ağır, mortalite artışı ile ilişkili)' : ''}.`, how: { formula: 'Normal < 2 mmol/L · 2–4 orta · ≥ 4 ağır. Septik şok (Sepsis-3): vazopresör gereksinimi + laktat > 2.', source: 'Singer M ve ark. JAMA 2016;315:801-10.' } });
  }
  if (has(inp.Hb) && inp.Hb < 7) el.push({ tone: 'bad', text: `Hb ${f1(inp.Hb)} g/dL: ağır anemi (oksijen taşıma kapasitesi düşük — PaO₂ normal olsa bile).` });
  if (el.length) steps.push({ id: 'el', title: '5 · Elektrolit ve metabolitler', tone: el.some((l) => l.tone === 'bad') ? 'bad' : 'warn', lines: el });

  // bikarbonat açığı
  if (has(inp.weight) && has(hRaw) && hRaw < 22) {
    const target = 24;
    const def = 0.5 * inp.weight * (target - hRaw);
    calcs.push({
      label: 'Bikarbonat açığı (tahmini)',
      value: fmt(def, 0),
      unit: 'mmol',
      how: {
        formula: 'HCO₃⁻ açığı = 0,5 × kilo (kg) × (hedef HCO₃⁻ − ölçülen HCO₃⁻)',
        calc: `0,5 × ${fmt(inp.weight, 0)} × (${target} − ${f1(hRaw)}) = ${fmt(def, 0)} mmol`,
        note: 'Yalnızca kaba bir tahmindir; ağır asidozda bikarbonat dağılım hacmi % 50’nin üzerine çıkar. Bu bir tedavi önerisi değildir: rutin bikarbonat çoğu durumda yarar sağlamaz; BICAR-ICU’da yarar pH ≤ 7,20 + orta-ağır AKİ alt grubunda gösterilmiştir. Pratikte açığın yarısı verilip kan gazı tekrarlanır.',
        source: SRC.bicar,
      },
    });
  }

  // ---------- başlık ----------
  const order: DisorderKey[] = ['HAGMA', 'NAGMA', 'MA', 'MAlk', 'RAc', 'RAlk', 'hypox'];
  const roleOrder: Role[] = ['primer', 'mikst', 'gizli', 'eşlik eden', 'olası'];
  disorders.sort((x, y) => roleOrder.indexOf(x.role) - roleOrder.indexOf(y.role) || order.indexOf(x.key) - order.indexOf(y.key));
  const ab2 = disorders.filter((d) => d.key !== 'hypox' && d.role !== 'olası');
  let headline = '';
  if (usedABG) {
    if (!ab2.length) headline = 'Asit-baz dengesi normal sınırlarda';
    else {
      const qual = (d: Disorder) => {
        if (d.key === 'RAc' || d.key === 'RAlk') {
          const ch = inp.chronicity;
          return d.label + (d.role === 'primer' && ch !== 'bilinmiyor' ? ` (${ch})` : '');
        }
        return d.label;
      };
      headline = ab2.map((d, i) => (i === 0 ? qual(d) : qual(d).charAt(0).toLocaleLowerCase('tr') + qual(d).slice(1))).join(' + ');
    }
  } else if (has(pH)) headline = pH < 7.35 ? 'Asidemi — tip için pCO₂/HCO₃⁻ gerekli' : pH > 7.45 ? 'Alkalemi — tip için pCO₂/HCO₃⁻ gerekli' : 'pH normal';

  const hasData = Object.entries(inp).some(([k, v]) => typeof v === 'number' && !['patm'].includes(k));

  // tekrarlanan eksikleri birleştir
  const seen = new Set<string>();
  const missingU = missing.filter((m) => {
    const k = m.fields + '|' + m.reason;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { hasData, headline, disorders, steps, calcs, missing: missingU, alerts, respiratoryProcess, usedABG };
}
