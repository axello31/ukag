import type { DisorderKey, Inputs, Result } from './engine';

export interface CauseGroup {
  name: string;
  items: string[];
}

export interface CauseSet {
  title: string;
  intro: string;
  mnemonic?: string;
  groups: CauseGroup[];
  workup: string[];
  sources: string[];
}

export const CAUSES: Record<DisorderKey, CauseSet> = {
  HAGMA: {
    title: 'Artmış anyon açıklı metabolik asidoz',
    intro: 'Ölçülmeyen bir asidin (laktat, keton, toksik alkol metaboliti, üremik anyonlar) birikimi. Klor normaldir; HCO₃⁻ bu asitleri tamponlarken tükenir.',
    mnemonic: 'CAT MUDPILES · GOLDMARK (Mehta 2008): Glikoller, 5-Oksoprolin, L-laktat, D-laktat, Metanol, Aspirin, Renal yetmezlik, Ketoasidoz',
    groups: [
      { name: 'Laktik asidoz — Tip A (doku hipoksisi)', items: ['Şok (septik, hipovolemik, kardiyojenik)', 'Ağır hipoksemi, ağır anemi', 'Karbonmonoksit zehirlenmesi', 'Siyanür zehirlenmesi (yangın dumanı, nitroprusid)', 'Mezenter iskemi, kompartman sendromu', 'Nöbet, aşırı kas aktivitesi'] },
      { name: 'Laktik asidoz — Tip B (hipoksi dışı)', items: ['Metformin', 'Karaciğer yetmezliği', 'Tiamin eksikliği', 'Malignite (lösemi, lenfoma)', 'Linezolid, propofol infüzyon sendromu, NRTİ', 'β-agonist (salbutamol) ve adrenalin', 'D-laktik asidoz (kısa barsak sendromu)'] },
      { name: 'Ketoasidoz', items: ['Diyabetik ketoasidoz', 'Öglisemik DKA (SGLT2 inhibitörü, gebelik)', 'Alkolik ketoasidoz', 'Açlık ketoasidozu'] },
      { name: 'Böbrek', items: ['Akut / ileri kronik böbrek yetmezliği (üremi)'] },
      { name: 'Toksik', items: ['Metanol', 'Etilen glikol', 'Salisilat (sıklıkla solunumsal alkaloz ile birlikte)', 'Propilen glikol (lorazepam, fenitoin taşıyıcısı)', 'Paraldehit', 'Toluen (erken; sonra normal AA)', 'İzoniazid', 'Demir', 'Teofilin', '5-oksoprolin (piroglutamik asit — kronik parasetamol)'] },
      { name: 'Diğer', items: ['Rabdomiyoliz', 'Doğumsal metabolizma hataları'] },
    ],
    workup: ['Laktat', 'Glukoz + kan ketonu (β-hidroksibütirat)', 'Üre/BUN, kreatinin', 'Ölçülen osmolalite → osmolar açık (toksik alkol)', 'Salisilat, parasetamol düzeyi; ilaç öyküsü (metformin, SGLT2-i)', 'CK (rabdomiyoliz)', 'Delta oranı → eşlik eden bozukluk'],
    sources: ['Kraut JA, Madias NE. Nat Rev Nephrol 2010;6:274-85.', 'Mehta AN, Emmett JB, Emmett M. Lancet 2008;372:892.', 'Kraut JA, Madias NE. N Engl J Med 2014;371:2309-19 (laktik asidoz).'],
  },
  NAGMA: {
    title: 'Normal anyon açıklı (hiperkloremik) metabolik asidoz',
    intro: 'HCO₃⁻ kaybı veya böbreğin asit atamaması; kaybedilen HCO₃⁻’ün yerini Cl⁻ alır, bu yüzden AA değişmez.',
    mnemonic: 'HARDASS: Hiperalimentasyon, Asetazolamid, RTA, Diyare, Addison, Spironolakton, Salin (serum fizyolojik)',
    groups: [
      { name: 'Gastrointestinal HCO₃⁻ kaybı (idrar AA negatif)', items: ['Diyare (en sık)', 'İleostomi, pankreatik/biliyer fistül veya drenaj', 'Üreterosigmoidostomi, ileal loop', 'Kolestiramin'] },
      { name: 'Renal (idrar AA pozitif)', items: ['Distal (tip 1) RTA', 'Tip 4 RTA (hipoaldosteronizm, hiperkalemi ile)', 'Erken kronik böbrek hastalığı', 'Adrenal yetmezlik', 'Spironolakton, amilorid, trimetoprim, kalsinörin inhibitörü'] },
      { name: 'Renal — proksimal kayıp', items: ['Proksimal (tip 2) RTA, Fanconi sendromu', 'Karbonik anhidraz inhibitörleri (asetazolamid, topiramat)'] },
      { name: 'İyatrojenik / diğer', items: ['Büyük hacim serum fizyolojik (dilüsyonel / hiperkloremik)', 'Total parenteral nütrisyon', 'DKA tedavisinin iyileşme fazı (ketonların idrarla kaybı)', 'Toluen (geç dönem)', 'HCl, amonyum klorür alımı'] },
    ],
    workup: ['İdrar Na⁺, K⁺, Cl⁻ → idrar anyon açığı', 'Serum K⁺ (tip 1–2’de düşük, tip 4’te yüksek)', 'İdrar pH', 'Verilen sıvı tipi/miktarı ve diyare öyküsü'],
    sources: ['Batlle DC ve ark. N Engl J Med 1988;318:594-9.', 'Kraut JA, Madias NE. Clin J Am Soc Nephrol 2007;2:162-74.', 'Berend K ve ark. N Engl J Med 2014;371:1434-45.'],
  },
  MA: {
    title: 'Metabolik asidoz (tipi belirlenemedi)',
    intro: 'Tipi belirlemek için anyon açığı gerekir: Na⁺ ve Cl⁻ girin (albümin varsa daha doğru). Aşağıda her iki grubun özeti var.',
    groups: [
      { name: 'Artmış AA’lı olasılıklar', items: ['Laktik asidoz (şok, sepsis, hipoksi, metformin)', 'Ketoasidoz (diyabetik, alkolik, açlık)', 'Böbrek yetmezliği', 'Toksik alkol (metanol, etilen glikol), salisilat'] },
      { name: 'Normal AA’lı olasılıklar', items: ['Diyare, GİS fistülleri', 'Renal tübüler asidoz', 'Büyük hacim serum fizyolojik', 'Karbonik anhidraz inhibitörleri'] },
    ],
    workup: ['Na⁺, Cl⁻ (ve albümin) → anyon açığı', 'Laktat, glukoz, keton, üre/kreatinin'],
    sources: ['Berend K ve ark. N Engl J Med 2014;371:1434-45.'],
  },
  MAlk: {
    title: 'Metabolik alkaloz',
    intro: 'Asit (H⁺) kaybı veya HCO₃⁻ kazanımı; kalıcı olması için böbreğin HCO₃⁻ atamaması gerekir (hacim/klor eksikliği, hipokalemi, mineralokortikoid fazlalığı).',
    groups: [
      { name: 'Klora yanıtlı (idrar Cl⁻ < 20 mmol/L)', items: ['Kusma', 'Nazogastrik drenaj', 'Geçmiş (kesilmiş) diüretik kullanımı', 'Posthiperkapni (kronik hiperkapninin hızlı düzeltilmesi)', 'Villöz adenom, konjenital klor diyaresi', 'Kistik fibrozis'] },
      { name: 'Klora dirençli — hipertansif', items: ['Primer hiperaldosteronizm (Conn)', 'Cushing sendromu', 'Renal arter stenozu / renovasküler hipertansiyon', 'Meyan kökü (glisirizin) tüketimi', 'Liddle sendromu'] },
      { name: 'Klora dirençli — normotansif', items: ['Aktif diüretik kullanımı (tiyazid, loop)', 'Bartter / Gitelman sendromu', 'Ağır hipokalemi, hipomagnezemi'] },
      { name: 'Alkali yüklenmesi', items: ['Bikarbonat tedavisi', 'Süt-alkali sendromu (kalsiyum karbonat)', 'Masif transfüzyon (sitrat)', 'Ketoasidoz/laktik asidoz sonrası rebound'] },
    ],
    workup: ['İdrar Cl⁻ (diüretik etkisinden bağımsız ayrım için)', 'Tansiyon / hacim durumu', 'Serum K⁺, Mg²⁺', 'Kusma, NG, diüretik öyküsü'],
    sources: ['Galla JH. J Am Soc Nephrol 2000;11:369-75.', 'Emmett M. Clin J Am Soc Nephrol 2020;15:1848-56.'],
  },
  RAc: {
    title: 'Solunumsal asidoz',
    intro: 'Alveoler hipoventilasyon → CO₂ retansiyonu. Akutta pH hızla düşer; böbrek kompansasyonu 2–5 günde tamamlanır.',
    groups: [
      { name: 'Santral (solunum merkezi baskılanması)', items: ['Opioid, benzodiazepin, barbitürat, alkol, propofol', 'İnme, kafa travması, SSS enfeksiyonu', 'Obezite hipoventilasyon sendromu, santral uyku apnesi', 'Kontrolsüz O₂ (KOAH’ta hiperoksiye bağlı hiperkapni)'] },
      { name: 'Nöromüsküler', items: ['Guillain-Barré, myastenia gravis', 'ALS, spinal kord yaralanması (yüksek servikal)', 'Botulizm, organofosfat', 'Ağır hipokalemi, hipofosfatemi', 'Nöromüsküler blokör etkisinin sürmesi'] },
      { name: 'Göğüs duvarı / plevra', items: ['Yelken göğüs (flail chest)', 'Ağır kifoskolyoz', 'Masif plevral efüzyon, pnömotoraks'] },
      { name: 'Havayolu / akciğer', items: ['KOAH alevlenmesi', 'Ağır astım atağı (normal/yüksek pCO₂ yorulma işaretidir!)', 'Üst havayolu obstrüksiyonu, yabancı cisim, laringospazm', 'Ağır pnömoni, akciğer ödemi, ARDS'] },
      { name: 'Mekanik ventilasyon', items: ['Yetersiz dakika ventilasyonu', 'Permisif hiperkapni stratejisi'] },
    ],
    workup: ['Bilinç (GKS), pupiller — toksidrom?', 'Solunum sayısı ve derinliği, solunum kas gücü', 'Akciğer grafisi', 'Kronik mi? (KOAH, OHS öyküsü; HCO₃⁻ kompansasyon düzeyi)'],
    sources: ['Epstein SK, Singh N. Respir Care 2001;46:366-83.', 'Berend K ve ark. N Engl J Med 2014;371:1434-45.'],
  },
  RAlk: {
    title: 'Solunumsal alkaloz',
    intro: 'Alveoler hiperventilasyon → pCO₂ düşer. Acilde en sık asit-baz bozukluklarından biri; altta ciddi bir neden (PE, sepsis, salisilat) olabilir.',
    groups: [
      { name: 'Hipoksemi kaynaklı', items: ['Pulmoner emboli', 'Pnömoni, akciğer ödemi', 'Yüksek irtifa', 'Ağır anemi'] },
      { name: 'Santral uyarı', items: ['Ağrı, anksiyete, panik atak', 'İnme, SSS enfeksiyonu, travma', 'Ateş'] },
      { name: 'İlaç / toksik', items: ['Salisilat (erken; çoğunlukla artmış AA’lı asidozla birlikte)', 'Progesteron, metilksantinler', 'Katekolaminler'] },
      { name: 'Sistemik', items: ['Sepsis (erken bulgu olabilir)', 'Karaciğer yetmezliği', 'Gebelik (fizyolojik)', 'Hipertiroidi'] },
      { name: 'Mekanik ventilasyon', items: ['Aşırı dakika ventilasyonu'] },
    ],
    workup: ['SpO₂ / PaO₂, A-a gradyanı', 'Ateş, sepsis bulguları, laktat', 'PE olasılığı (klinik skor, D-dimer, BT anjiyo)', 'Salisilat düzeyi (özellikle artmış AA ile birlikteyse)', 'Gebelik testi'],
    sources: ['Foster GT ve ark. Respir Care 2001;46:384-91.', 'Berend K ve ark. N Engl J Med 2014;371:1434-45.'],
  },
  hypox: {
    title: 'Hipoksemi',
    intro: 'Arteriyel oksijen düşüklüğü. A-a gradyanı mekanizmayı ayırmaya yardımcı olur.',
    groups: [
      { name: 'A-a gradyanı normal', items: ['Hipoventilasyon (pCO₂ yüksek): ilaç, SSS, nöromüsküler', 'Düşük inspire O₂ (yüksek irtifa, kapalı ortam)'] },
      { name: 'A-a gradyanı artmış — O₂ ile düzelir', items: ['V/Q uyumsuzluğu: KOAH, astım, pnömoni, PE, interstisyel hastalık'] },
      { name: 'A-a gradyanı artmış — O₂’ye dirençli', items: ['Şant: ARDS, lober pnömoni, atelektazi, akciğer ödemi', 'İntrakardiyak sağ-sol şant, hepatopulmoner sendrom'] },
      { name: 'Difüzyon bozukluğu', items: ['İnterstisyel akciğer hastalığı, eforla belirginleşen hipoksemi'] },
      { name: 'O₂ taşınma/kullanım bozukluğu (PaO₂ normal olabilir)', items: ['Karbonmonoksit (COHb)', 'Methemoglobinemi', 'Ağır anemi', 'Siyanür'] },
    ],
    workup: ['FiO₂ ile birlikte PaO₂ → P/F, A-a gradyanı', 'Akciğer grafisi / POCUS', 'Hemoksimetri (COHb, MetHb), Hb'],
    sources: ['Sarkar M, Niranjan N, Banyal PK. Lung India 2017;34:47-60.'],
  },
};

/** Hastanın girilen verilerine göre öne çıkan nedenler */
export function contextHints(key: DisorderKey, inp: Inputs, res: Result): string[] {
  const h: string[] = [];
  const pH = res.usedABG?.pH;
  if (key === 'HAGMA' || key === 'MA') {
    if (inp.lactate !== undefined && inp.lactate > 2) h.push(`Laktat ${inp.lactate} mmol/L → laktik asidoz${inp.shock ? ' (şok tablosu: Tip A)' : ''}.`);
    if (inp.ketone !== undefined && inp.ketone >= 3) h.push(`β-HB ${inp.ketone} mmol/L → ketoasidoz${inp.glucose !== undefined && inp.glucose < 250 ? ' (glukoz < 250: öglisemik DKA / alkolik / açlık?)' : ''}.`);
    else if (inp.glucose !== undefined && inp.glucose >= 250) h.push(`Glukoz ${inp.glucose} mg/dL → DKA olası; keton ölçün.`);
    if (inp.creatinine !== undefined && inp.creatinine >= 3) h.push(`Kreatinin ${inp.creatinine} mg/dL → üremik asidoz katkısı.`);
    if (inp.bun !== undefined && inp.bun >= 60) h.push(`BUN ${Math.round(inp.bun)} mg/dL → böbrek yetmezliği katkısı.`);
    const og = res.calcs.find((c) => c.label === 'Osmolar açık');
    if (og && parseFloat(og.value.replace(',', '.')) > 10) h.push(`Osmolar açık ${og.value} → metanol / etilen glikol düşünün (fomepizol, nefroloji/diyaliz, Zehir Danışma 114).`);
    if (inp.COHb !== undefined && inp.COHb > 10) h.push('COHb yüksek → CO ± siyanür (yangın dumanı) laktik asidozu.');
    if (res.disorders.some((d) => d.key === 'RAlk')) h.push('Eşlik eden solunumsal alkaloz → salisilat zehirlenmesi ve sepsis klasik olarak bu ikiliyi yapar.');
    if (inp.lactate === undefined) h.push('Laktat girilmedi — en sık neden laktik asidozdur, ölçün.');
  }
  if (key === 'NAGMA') {
    const uag = res.calcs.find((c) => c.label === 'İdrar anyon açığı');
    if (uag) h.push(parseFloat(uag.value.replace(',', '.')) < 0 ? 'İdrar AA negatif → diyare / GİS kaybı (veya proksimal RTA).' : 'İdrar AA pozitif → distal (tip 1) veya tip 4 RTA.');
    if (inp.K !== undefined && inp.K > 5.5) h.push(`K⁺ ${inp.K} yüksek → tip 4 RTA (hipoaldosteronizm), böbrek yetmezliği, ilaç (spironolakton, trimetoprim).`);
    if (inp.K !== undefined && inp.K < 3.5) h.push(`K⁺ ${inp.K} düşük → diyare, tip 1 veya tip 2 RTA.`);
  }
  if (key === 'MAlk') {
    if (inp.uCl !== undefined) h.push(inp.uCl < 20 ? 'İdrar Cl⁻ < 20 → klora yanıtlı: kusma, NG, geçmiş diüretik.' : `İdrar Cl⁻ ≥ 20 → klora dirençli${inp.bp === 'hipertansif' ? ' + hipertansif: mineralokortikoid fazlalığı' : inp.bp === 'normotansif' ? ' + normotansif: aktif diüretik, Bartter/Gitelman' : ''}.`);
    if (inp.K !== undefined && inp.K < 3.5) h.push(`Hipokalemi (K⁺ ${inp.K}) alkalozu sürdürür; yerine koyun.`);
    if (res.disorders.some((d) => d.key === 'RAc') && inp.chronicity === 'kronik') h.push('Kronik hiperkapni zemininde: posthiperkapnik alkaloz veya diüretik ilişkili olabilir.');
  }
  if (key === 'RAc') {
    if (inp.chronicity === 'kronik') h.push('Kronik süreç seçili → KOAH, obezite hipoventilasyon, nöromüsküler hastalık.');
    if (pH !== undefined && pH < 7.25 && inp.chronicity !== 'kronik') h.push('Akut ve belirgin asidemi → santral depresyon (ilaç/toksin), havayolu obstrüksiyonu, yorulan astım/KOAH; NIV/entübasyon gereksinimini değerlendirin.');
    if (res.disorders.some((d) => d.key === 'HAGMA' || d.key === 'MA')) h.push('Metabolik asidozla birlikte → solunum yorgunluğu veya kardiyopulmoner arrest riski; yakın izlem.');
  }
  if (key === 'RAlk') {
    if (res.disorders.some((d) => d.key === 'hypox')) h.push('Hipoksemi ile birlikte → PE, pnömoni, akciğer ödemi öncelikli.');
    if (res.disorders.some((d) => d.key === 'HAGMA')) h.push('Artmış AA’lı asidozla birlikte → salisilat ve sepsis!');
    if (inp.lactate !== undefined && inp.lactate > 2) h.push('Laktat yüksek → sepsis olasılığı.');
  }
  if (key === 'hypox') {
    const aa = res.calcs.find((c) => c.label === 'A-a O₂ gradyanı');
    if (aa) h.push(aa.tone === 'warn' ? 'A-a gradyanı artmış → parankimal / vasküler neden (V/Q, şant).' : 'A-a gradyanı normal → hipoventilasyon veya düşük FiO₂.');
    if (inp.COHb !== undefined && inp.COHb > 10) h.push('COHb artmış → doku hipoksisi PaO₂/SpO₂ ile yansımaz.');
  }
  return h;
}
