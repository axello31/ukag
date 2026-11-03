export interface InfoTab {
  id: string;
  title: string;
  blocks: { h?: string; p?: string; list?: string[] }[];
}

export const INFO: InfoTab[] = [
  {
    id: 'sistem',
    title: 'Sistematik okuma',
    blocks: [
      { p: 'ÜKAG, sunumdaki üç basamaklı sistematik yaklaşımı uygular:' },
      { h: '1 · Oksijenasyon', p: 'PaO₂, SaO₂; FiO₂ girilirse P/F oranı ve A-a gradyanı.' },
      { h: '2 · Ventilasyon', p: 'PaCO₂ > 45 hipoventilasyon, < 35 hiperventilasyon.' },
      {
        h: '3 · Asit-baz dengesi',
        list: [
          'Kural 1: pH ve/veya pCO₂ normal dışındaysa asit-baz bozukluğu vardır.',
          'Kural 2: İkisi de normal dışındaysa değişim yönleri primer bozukluğu belirler (pH↓ pCO₂↑ → solunumsal asidoz; pH↓ pCO₂↓ → metabolik asidoz).',
          'Kural 3: pH veya pCO₂’den biri normalse mikst bozukluk vardır.',
          'Kural 4: Primer metabolik bozuklukta beklenen pCO₂ hesaplanır; sapma eşlik eden solunumsal bozukluğu gösterir.',
          'Kural 5: Primer solunumsal bozuklukta akut/kronik beklenen HCO₃⁻ ve pH hesaplanır; sapma eşlik eden metabolik bozukluğu gösterir.',
          'Metabolik asidozda anyon açığı (albümine göre düzeltilmiş) ve artmışsa delta oranı hesaplanır.',
          'Son olarak elektrolit, laktat, glukoz, keton, osmolar açık ve idrar elektrolitleriyle neden aranır.',
        ],
      },
      { h: 'Hatırlatma', p: 'Kompansasyonda pCO₂ ve HCO₃⁻ her zaman aynı yönde hareket eder ve kompansasyon pH’ı hiçbir zaman normalin öbür tarafına geçirmez.' },
    ],
  },
  {
    id: 'ne-zaman',
    title: 'Ne zaman kullanılır',
    blocks: [
      {
        list: [
          'Asit-baz bozukluğu tanısı, izlemi ve tedaviye yanıtın değerlendirilmesi',
          'Solunum yetmezliği tanısı ve tipinin (hipoksemik / hiperkapnik) belirlenmesi',
          'Açıklanamayan nefes darlığı, bilinç değişikliği, şok, zehirlenme',
          'DKA, sepsis, böbrek yetmezliği, toksik alkol şüphesi',
        ],
      },
      { h: 'Arter mi, ven mi?', p: 'Venöz pH arteriyelden ortalama yalnızca ~0,03 düşüktür ve çoğu acil asit-baz kararı için yeterlidir. Venöz pCO₂ arteriyelin yerine geçmez, ama ≤ 45 mmHg ise arteriyel hiperkapniyi güvenle dışlar. Venöz pO₂ oksijenasyon hakkında bilgi vermez. Şokta venöz–arteriyel fark büyür; solunumsal komponentin hassas yorumu veya oksijenasyon gerekiyorsa arter kan gazı alın.' },
    ],
  },
  {
    id: 'tuzak',
    title: 'İpuçları ve tuzaklar',
    blocks: [
      {
        list: [
          'Hava kabarcığı pCO₂’yi düşürür, pO₂’yi oda havasına (~150 mmHg) doğru çeker.',
          'Oda ısısında > 30 dk bekleyen örnekte pO₂ düşer; > 30 dk bekleyecekse 0–4 °C’de saklayın.',
          'Lökositoz/trombositozda pO₂ örnekte hızla düşer (lökosit hırsızlığı) — hemen çalışın.',
          'Fazla heparin örneği sulandırır, pCO₂ ve HCO₃⁻’ü yalancı düşük gösterir.',
          'Arter seçip pO₂ < 40 ve sO₂ < %75 görürseniz örnek muhtemelen venözdür.',
          'Hipoalbüminemi anyon açığını maskeler: her 1 g/dL albümin düşüşü AA’yı ~2,5 azaltır.',
          'Normal pH bozukluk olmadığı anlamına gelmez — pCO₂ ve HCO₃⁻ anormalse mikst bozukluk arayın; AA artmışsa gizli asidoz vardır.',
          'Ağır astımda normal ya da yükselen pCO₂ yorulmayı gösterir.',
          'Osmolar açığın normal olması toksik alkol zehirlenmesini dışlamaz (geç dönem).',
          'Kompansasyon formülleri yetişkin, kararlı durum içindir; akut değişimde ve çocuklarda dikkat.',
          'Delta oranı yorumu yaklaşıktır; tek başına tanı koydurmaz, klinikle birlikte değerlendirin.',
        ],
      },
    ],
  },
  {
    id: 'adim',
    title: 'Sonraki adımlar',
    blocks: [
      {
        h: 'Kritik eylemler',
        list: [
          'Sonuç öykü ve klinikle uyuşmuyorsa örneği tekrarlayın (teknik hata, venöz örnek, gecikme).',
          'pH < 7,20 veya > 7,60, K⁺ < 2,5 veya > 6,5, laktat ≥ 4: acil müdahale ve yakın izlem.',
          'Hiperkapnik solunum yetmezliğinde NIV / entübasyon gereksinimini değerlendirin.',
          'Artmış AA’lı asidozda nedene yönelik: laktat, keton, böbrek fonksiyonu, osmolar açık, salisilat/parasetamol.',
          'Toksik alkol şüphesinde Ulusal Zehir Danışma Merkezi (114) ile görüşün.',
        ],
      },
      { h: 'Bikarbonat', p: 'Rutin bikarbonat tedavisi çoğu metabolik asidozda (özellikle laktik asidoz ve DKA’da) yarar sağlamaz. BICAR-ICU çalışmasında yarar pH ≤ 7,20 ve orta-ağır akut böbrek hasarı olan alt grupta gösterilmiştir. Sodyum kanal blokörü zehirlenmesi, ağır hiperkalemi ve bazı normal AA’lı asidozlar ayrı endikasyonlardır. Bikarbonat açığı hesabı yalnızca kaba bir yol göstericidir.' },
    ],
  },
  {
    id: 'kaynak',
    title: 'Kanıt ve kaynaklar',
    blocks: [
      { p: 'Temel içerik: Dr. Gökhan Aksel, “Kan Gazı Yorumlama” sunumu (Ümraniye EAH Acil Tıp). Eksik kısımlar aşağıdaki hakemli kaynaklardan tamamlanmıştır.' },
      {
        list: [
          'Berend K, de Vries APJ, Gans ROB. Physiological approach to assessment of acid-base disturbances. N Engl J Med 2014;371:1434-45.',
          'Albert MS, Dell RB, Winters RW. Quantitative displacement of acid-base equilibrium in metabolic acidosis. Ann Intern Med 1967;66:312-22.',
          'Kraut JA, Madias NE. Serum anion gap: its uses and limitations in clinical medicine. Clin J Am Soc Nephrol 2007;2:162-74.',
          'Figge J, Jabor A, Kazda A, Fencl V. Anion gap and hypoalbuminemia. Crit Care Med 1998;26:1807-10.',
          'Rastegar A. Use of the ΔAG/ΔHCO3− ratio in the diagnosis of mixed acid-base disorders. J Am Soc Nephrol 2007;18:2429-31.',
          'Byrne AL ve ark. Peripheral venous and arterial blood gas analysis in adults: are they comparable? Respirology 2014;19:168-75. doi:10.1111/resp.12225',
          'Kelly AM, Kerr D, Middleton P. Validation of venous pCO2 to screen for arterial hypercarbia in patients with COPD. J Emerg Med 2005;28:377-9. doi:10.1016/j.jemermed.2004.10.017',
          'Kelly AM, McAlpine R, Kyle E. Venous pH can safely replace arterial pH in the initial evaluation of patients in the emergency department. Emerg Med J 2001;18:340-2.',
          'Batlle DC ve ark. The use of the urinary anion gap in the diagnosis of hyperchloremic metabolic acidosis. N Engl J Med 1988;318:594-9.',
          'Galla JH. Metabolic alkalosis. J Am Soc Nephrol 2000;11:369-75.',
          'Kraut JA, Xing SX. Approach to the evaluation of a patient with an increased serum osmolal gap and high-anion-gap metabolic acidosis. Am J Kidney Dis 2011;58:480-4.',
          'Purssell RA ve ark. Derivation and validation of a formula to calculate the contribution of ethanol to the osmolal gap. Ann Emerg Med 2001;38:653-9.',
          'Umpierrez GE ve ark. Hyperglycemic crises in adults with diabetes: a consensus report. Diabetes Care 2024;47:1257-75.',
          'ARDS Definition Task Force. Acute respiratory distress syndrome: the Berlin Definition. JAMA 2012;307:2526-33.',
          'Jaber S ve ark. Sodium bicarbonate therapy for patients with severe metabolic acidaemia in the ICU (BICAR-ICU). Lancet 2018;392:31-40.',
          'Davis MD ve ark. AARC clinical practice guideline: blood gas analysis and hemoximetry: 2013. Respir Care 2013;58:1694-703.',
          'Börekçi Ş, Umut S. Arter kan gazı analizi, alma tekniği ve yorumlanması. Türk Toraks Derg 2011;12(Ek 1):5-9.',
          'Aygencel G. Interpretation of arterial blood gases. Türk Kardiyol Dern Arş 2014;42:194-202.',
          'Mehta AN, Emmett JB, Emmett M. GOLD MARK: an anion gap mnemonic for the 21st century. Lancet 2008;372:892.',
        ],
      },
    ],
  },
];
