import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, DEFAULT_SETTINGS, type BP, type Chronicity, type DisorderKey, type How, type Inputs, type Line, type Sample, type Settings } from './engine';
import { GROUPS, ALL_FIELDS, fieldKeysFor, type Field } from './fields';
import { CAUSES, contextHints } from './causes';
import { CASES } from './cases';
import { INFO } from './info';

type Modal = { t: 'causes'; key: DisorderKey } | { t: 'info'; tab: string } | { t: 'settings' } | null;

const LS = 'ukag_prefs_v1';
function loadPrefs(): { units: Record<string, number>; settings: Settings; open: Record<string, boolean> } {
  try {
    const p = JSON.parse(localStorage.getItem(LS) || '{}');
    return { units: p.units || {}, settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) }, open: p.open || {} };
  } catch {
    return { units: {}, settings: DEFAULT_SETTINGS, open: {} };
  }
}

const parseNum = (s: string | undefined) => {
  if (s === undefined) return undefined;
  const t = s.trim().replace(',', '.');
  if (t === '' || t === '-' || t === '.') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};

const ROLE_TXT: Record<string, string> = { primer: 'Primer', 'eşlik eden': 'Eşlik eden', mikst: 'Mikst', olası: 'Olası', gizli: 'Gizli' };
const KIND: Record<DisorderKey, 'acid' | 'alk' | 'oxy'> = { HAGMA: 'acid', NAGMA: 'acid', MA: 'acid', RAc: 'acid', MAlk: 'alk', RAlk: 'alk', hypox: 'oxy' };

function HowBox({ how }: { how: How }) {
  return (
    <details className="how">
      <summary>Nasıl hesaplandı?</summary>
      <div className="how-body">
        <div className="how-row"><span>Formül</span><code>{how.formula}</code></div>
        {how.calc && <div className="how-row"><span>Bu hastada</span><code>{how.calc}</code></div>}
        {how.note && <p className="how-note">{how.note}</p>}
        {how.source && <p className="how-src">Kaynak: {how.source}</p>}
      </div>
    </details>
  );
}

function LineView({ l }: { l: Line }) {
  return (
    <li className={`line tone-${l.tone || 'info'}`}>
      <span className="dot" aria-hidden />
      <div>
        <div>{l.text}</div>
        {l.how && <HowBox how={l.how} />}
      </div>
    </li>
  );
}

export default function App() {
  const prefs = useMemo(loadPrefs, []);
  const [sample, setSample] = useState<Sample | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [units, setUnits] = useState<Record<string, number>>(prefs.units);
  const [chronicity, setChron] = useState<Chronicity>('bilinmiyor');
  const [bp, setBp] = useState<BP>('bilinmiyor');
  const [flags, setFlags] = useState({ shock: false, trauma: false, smoker: false });
  const [settings, setSettings] = useState<Settings>(prefs.settings);
  const [open, setOpen] = useState<Record<string, boolean>>({ temel: true, oksijen: true, elektrolit: true, ...prefs.open });
  const [modal, setModal] = useState<Modal>(null);
  const [caseInfo, setCaseInfo] = useState<string | null>(null);
  const resRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify({ units, settings, open }));
    } catch {
      /* depolama kapalı olabilir */
    }
  }, [units, settings, open]);

  useEffect(() => {
    // ?vaka=1..6 → eğitim vakasını yükle (eğitimde link paylaşımı için)
    const n = Number(new URLSearchParams(window.location.search).get('vaka'));
    if (n >= 1 && n <= CASES.length) loadCase(n - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setModal(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const inputs: Inputs | null = useMemo(() => {
    if (!sample) return null;
    const o: Inputs = { sample, chronicity, bp, ...flags };
    for (const f of ALL_FIELDS) {
      const n = parseNum(vals[f.key as string]);
      if (n === undefined) continue;
      const u = f.units[units[f.key as string] || 0] || f.units[0];
      (o as unknown as Record<string, number>)[f.key as string] = u.toInt(n);
    }
    return o;
  }, [sample, vals, units, chronicity, bp, flags]);

  const res = useMemo(() => (inputs ? analyze(inputs, settings) : null), [inputs, settings]);

  const setVal = (k: string, v: string) => setVals((s) => ({ ...s, [k]: v }));
  const loadCase = (i: number) => {
    const c = CASES[i];
    const v: Record<string, string> = {};
    const u: Record<string, number> = { ...units };
    for (const [k, val] of Object.entries(c.values)) {
      if (typeof val === 'number') {
        v[k] = String(val).replace('.', ',');
        u[k] = 0;
      }
    }
    setSample(c.values.sample || 'arter');
    setVals(v);
    setUnits(u);
    setChron('bilinmiyor');
    setBp('bilinmiyor');
    setFlags({ shock: false, trauma: false, smoker: false });
    setCaseInfo(`${c.name}: ${c.story} — Beklenen yorum: ${c.answer}`);
    setOpen((o) => ({ ...o, temel: true, oksijen: true, elektrolit: true }));
  };
  const clearAll = () => {
    setVals({});
    setChron('bilinmiyor');
    setBp('bilinmiyor');
    setFlags({ shock: false, trauma: false, smoker: false });
    setCaseInfo(null);
  };
  const goHome = () => {
    clearAll();
    setModal(null);
    setSample(null);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    window.scrollTo({ top: 0 });
  };
  const focusField = (keys: (keyof Inputs)[]) => {
    const k = keys[0] as string | undefined;
    if (!k) return;
    const g = GROUPS.find((gr) => gr.fields.some((f) => f.key === k));
    if (g) setOpen((o) => ({ ...o, [g.id]: true }));
    setTimeout(() => {
      const el = document.getElementById('f-' + k) as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 60);
  };

  const filledCount = (gid: string) => GROUPS.find((g) => g.id === gid)!.fields.filter((f) => parseNum(vals[f.key as string]) !== undefined).length;

  // ---------- örnek seçimi ekranı ----------
  if (!sample) {
    return (
      <div className="app">
        <Header onHome={goHome} onInfo={() => setModal({ t: 'info', tab: 'sistem' })} onSettings={() => setModal({ t: 'settings' })} />
        <main className="pick">
          <h1>Kan gazı örneği</h1>
          <p className="muted">Yorumlamaya başlamak için örneğin tipini seçin.</p>
          <div className="pick-grid">
            <button className="pick-btn arter" onClick={() => setSample('arter')}>
              <span className="pick-ico">A</span>
              <strong>Arter</strong>
              <small>Oksijenasyon, ventilasyon ve asit-baz tam değerlendirme</small>
            </button>
            <button className="pick-btn ven" onClick={() => setSample('ven')}>
              <span className="pick-ico">V</span>
              <strong>Ven</strong>
              <small>pH ve HCO₃⁻ güvenilir; pCO₂ tarama amaçlı; pO₂ yorumlanmaz</small>
            </button>
          </div>
          <div className="cases">
            <span className="muted">Eğitim amaçlı örnek vakalar</span>
            <div className="case-row">
              {CASES.map((c, i) => (
                <button key={c.name} className="chip-btn" onClick={() => loadCase(i)}>{c.name}</button>
              ))}
            </div>
          </div>
        </main>
        <Footer />
        {modal && <ModalView modal={modal} setModal={setModal} settings={settings} setSettings={setSettings} inputs={null} res={null} />}
      </div>
    );
  }

  const isVen = sample === 'ven';

  return (
    <div className="app">
      <Header onHome={goHome} onInfo={() => setModal({ t: 'info', tab: 'sistem' })} onSettings={() => setModal({ t: 'settings' })} />
      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Örnek tipi">
          <button role="radio" aria-checked={!isVen} className={!isVen ? 'on arter' : ''} onClick={() => setSample('arter')}>Arter</button>
          <button role="radio" aria-checked={isVen} className={isVen ? 'on ven' : ''} onClick={() => setSample('ven')}>Ven</button>
        </div>
        <select className="case-sel" value="" onChange={(e) => e.target.value !== '' && loadCase(Number(e.target.value))} aria-label="Örnek vaka">
          <option value="">Örnek vaka…</option>
          {CASES.map((c, i) => <option key={c.name} value={i}>{c.name} — {c.story}</option>)}
        </select>
        <button className="ghost" onClick={clearAll}>Temizle</button>
      </div>
      {caseInfo && <div className="case-info"><span>{caseInfo}</span><button className="x" onClick={() => setCaseInfo(null)} aria-label="Kapat">×</button></div>}

      <div className="layout">
        <section className="inputs" aria-label="Değerler">
          {GROUPS.map((g) => {
            const n = filledCount(g.id);
            const isOpen = !!open[g.id];
            return (
              <div key={g.id} className={`card group ${isOpen ? 'open' : ''}`}>
                <button className="group-h" onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))} aria-expanded={isOpen}>
                  <span>{g.title}</span>
                  <span className="group-meta">{n > 0 && <span className="badge">{n}</span>}<span className="chev" aria-hidden>▾</span></span>
                </button>
                {isOpen && (
                  <div className="fields">
                    {g.fields.map((f) => (
                      <FieldInput key={f.key as string} f={f} isVen={isVen} value={vals[f.key as string] || ''} unitIdx={units[f.key as string] || 0}
                        onChange={(v) => setVal(f.key as string, v)} onUnit={(i) => setUnits((u) => ({ ...u, [f.key as string]: i }))} />
                    ))}
                    {g.id === 'oksijen' && isVen && <p className="field-note">Venöz örnekte pvO₂ oksijenasyon yorumunda kullanılmaz; SpO₂ girin.</p>}
                  </div>
                )}
              </div>
            );
          })}
          <div className="card group open">
            <div className="group-h static"><span>Klinik bağlam</span></div>
            <div className="ctx">
              <label className="ctx-row"><span>Solunumsal sürecin süresi</span>
                <select value={chronicity} onChange={(e) => setChron(e.target.value as Chronicity)}>
                  <option value="bilinmiyor">Bilinmiyor</option>
                  <option value="akut">Akut (&lt; 24–48 saat)</option>
                  <option value="kronik">Kronik (&gt; 3–5 gün; KOAH vb.)</option>
                </select>
              </label>
              <label className="ctx-row"><span>Tansiyon / hacim</span>
                <select value={bp} onChange={(e) => setBp(e.target.value as BP)}>
                  <option value="bilinmiyor">Bilinmiyor</option>
                  <option value="normotansif">Normotansif</option>
                  <option value="hipertansif">Hipertansif</option>
                </select>
              </label>
              <div className="checks">
                <label><input type="checkbox" checked={flags.shock} onChange={(e) => setFlags({ ...flags, shock: e.target.checked })} /> Şok / hipoperfüzyon</label>
                <label><input type="checkbox" checked={flags.trauma} onChange={(e) => setFlags({ ...flags, trauma: e.target.checked })} /> Travma hastası</label>
                <label><input type="checkbox" checked={flags.smoker} onChange={(e) => setFlags({ ...flags, smoker: e.target.checked })} /> Sigara içiyor</label>
              </div>
            </div>
          </div>
        </section>

        <section className="results" ref={resRef} aria-label="Sonuç" aria-live="polite">
          {res && inputs && <Results res={res} inputs={inputs} chronicity={chronicity} setChron={setChron} onCauses={(k) => setModal({ t: 'causes', key: k })} onFocus={focusField} onInfo={(tab) => setModal({ t: 'info', tab })} />}
        </section>
      </div>
      {res?.hasData && (
        <button className="to-res" onClick={() => resRef.current?.scrollIntoView({ behavior: 'smooth' })}>Sonuca git ↓</button>
      )}
      <Footer />
      {modal && <ModalView modal={modal} setModal={setModal} settings={settings} setSettings={setSettings} inputs={inputs} res={res} />}
    </div>
  );
}

function Header({ onHome, onInfo, onSettings }: { onHome: () => void; onInfo: () => void; onSettings: () => void }) {
  return (
    <header className="hdr">
      <a className="brand" href="./" onClick={(e) => { e.preventDefault(); onHome(); }} aria-label="ÜKAG ana sayfa">
        <span className="logo-tile"><img src="./logo-240.png" alt="Ümraniye Acil logosu" /></span>
        <div>
          <div className="brand-name">ÜKAG</div>
          <div className="brand-sub">Ümraniye Kan Gazı · yorumlama asistanı</div>
        </div>
      </a>
      <nav className="hdr-actions">
        <button className="icon-btn" onClick={onInfo} aria-label="Bilgi ve kaynaklar">ⓘ<span> Bilgi</span></button>
        <button className="icon-btn" onClick={onSettings} aria-label="Ayarlar">⚙<span> Ayarlar</span></button>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="ftr">
      <p>ÜKAG bir klinik karar destek aracıdır; klinik değerlendirmenin ve hekim yargısının yerini tutmaz. Hesaplamalar yetişkin hastalar içindir.</p>
      <p>İçerik: Dr. Gökhan Aksel — Ümraniye EAH Acil Tıp · Kaynaklar için “Bilgi”.</p>
    </footer>
  );
}

function FieldInput({ f, isVen, value, unitIdx, onChange, onUnit }: { f: Field; isVen: boolean; value: string; unitIdx: number; onChange: (v: string) => void; onUnit: (i: number) => void }) {
  const label = isVen && f.venLabel ? f.venLabel : f.label;
  const id = 'f-' + (f.key as string);
  const multi = f.units.length > 1;
  const bad = value.trim() !== '' && parseNum(value) === undefined;
  return (
    <div className={`field ${bad ? 'bad' : ''} ${value ? 'filled' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-in">
        <input id={id} inputMode="decimal" autoComplete="off" value={value} placeholder={f.hint} onChange={(e) => onChange(e.target.value)} />
        {multi ? (
          <select className="unit" value={unitIdx} onChange={(e) => onUnit(Number(e.target.value))} aria-label={`${label} birimi`}>
            {f.units.map((u, i) => <option key={u.u} value={i}>{u.u}</option>)}
          </select>
        ) : f.units[0].u ? <span className="unit static">{f.units[0].u}</span> : null}
      </div>
    </div>
  );
}

function Results({ res, inputs, chronicity, setChron, onCauses, onFocus, onInfo }: {
  res: NonNullable<ReturnType<typeof analyze>>; inputs: Inputs; chronicity: Chronicity; setChron: (c: Chronicity) => void;
  onCauses: (k: DisorderKey) => void; onFocus: (k: (keyof Inputs)[]) => void; onInfo: (tab: string) => void;
}) {
  if (!res.hasData) {
    return (
      <div className="card empty">
        <h2>Değerleri girin</h2>
        <p className="muted">Sonuç siz yazdıkça güncellenir. Eksik değerlerle de elde olanla yorum yapılır; daha kesin sonuç için neyin gerektiği ayrıca listelenir.</p>
        <p className="muted">En az: <b>pH, pCO₂, HCO₃⁻</b> (ikisi yeterli). Metabolik asidozun tipi için <b>Na⁺, Cl⁻, albümin</b>.</p>
        <button className="link" onClick={() => onInfo('sistem')}>Sistematik okuma adımları →</button>
      </div>
    );
  }
  const main = res.disorders;
  const firm = main.filter((d) => d.key !== 'hypox' && d.role !== 'olası');
  const hasAcid = firm.some((d) => KIND[d.key] === 'acid');
  const hasAlk = firm.some((d) => KIND[d.key] === 'alk');
  const heroKind = !res.usedABG ? 'neutral' : hasAcid && hasAlk ? 'mixed' : hasAcid ? 'acid' : hasAlk ? 'alk' : 'normal';
  const u = res.usedABG;
  const fmtN = (x: number, d: number) => x.toFixed(d).replace('.', ',');
  return (
    <>
      <div className={`hero hero-${heroKind}`}>
        <div className="hero-k">{inputs.sample === 'ven' ? 'Venöz kan gazı' : 'Arter kan gazı'} · Sonuç</div>
        <h2 className="hero-h">{res.headline || 'Yorum için temel değerler eksik'}</h2>
        {u && (
          <div className="hero-vals">
            <span><small>pH</small>{fmtN(u.pH, 2)}</span>
            <span><small>pCO₂</small>{fmtN(u.pCO2, 1)}</span>
            <span><small>HCO₃⁻</small>{fmtN(u.HCO3, 1)}</span>
            {u.estimated && <em>tahmini arteriyel</em>}
          </div>
        )}
        {main.length > 0 && (
          <div className="hero-dis">
            {main.map((d) => (
              <button key={d.key} className={`hdis ${KIND[d.key]} role-${d.role.replace(' ', '-')}`} onClick={() => onCauses(d.key)}>
                <span className="hdis-role">{ROLE_TXT[d.role]}</span>
                <span className="hdis-label">{d.label}</span>
                <span className="hdis-go">Nedenler ›</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {res.respiratoryProcess && (
        <div className="card chron">
          <span>Solunumsal süreç saptandı — süresi:</span>
          <div className="seg small" role="radiogroup" aria-label="Süre">
            {(['akut', 'kronik', 'bilinmiyor'] as Chronicity[]).map((c) => (
              <button key={c} role="radio" aria-checked={chronicity === c} className={chronicity === c ? 'on' : ''} onClick={() => setChron(c)}>
                {c === 'akut' ? 'Akut' : c === 'kronik' ? 'Kronik' : 'Bilinmiyor'}
              </button>
            ))}
          </div>
        </div>
      )}

      {res.alerts.length > 0 && (
        <div className="alerts">
          {res.alerts.map((a, i) => (
            <div key={i} className={`alert tone-${a.tone}`}>
              <strong>{a.tone === 'bad' ? '⚠ ' : '! '}</strong>{a.text}
              {a.how && <HowBox how={a.how} />}
            </div>
          ))}
        </div>
      )}

      {res.missing.length > 0 && (
        <details className="card missing">
          <summary>
            <b>Daha kesin yorum için {res.missing.length} veri eksik</b>
            <span>{Array.from(new Set(res.missing.map((m) => m.fields))).slice(0, 3).join(' · ')}{res.missing.length > 3 ? ' …' : ''}</span>
          </summary>
          <ul>
            {res.missing.map((m, i) => {
              const keys = fieldKeysFor(m.fields);
              return (
                <li key={i}>
                  <button className="miss-btn" onClick={() => onFocus(keys)} disabled={!keys.length}>
                    <b>{m.fields}</b> <span>girin — {m.reason}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {res.steps.length > 0 && <div className="sec-label">Adım adım değerlendirme</div>}
      {res.steps.map((s) => (
        <div key={s.id} className={`card step tone-${s.tone}`}>
          <h3>{s.title}</h3>
          <ul className="lines">{s.lines.map((l, i) => <LineView key={i} l={l} />)}</ul>
        </div>
      ))}

      {res.calcs.length > 0 && (
        <details className="card calc-box">
          <summary><b>Hesaplamalar</b> <span className="badge">{res.calcs.length}</span></summary>
          <div className="calcs">
            {res.calcs.map((c, i) => (
              <div key={i} className={`calc tone-${c.tone || 'info'}`}>
                <div className="calc-top">
                  <span className="calc-l">{c.label}</span>
                  <span className="calc-v">{c.value}{c.unit && <small> {c.unit}</small>}</span>
                </div>
                <HowBox how={c.how} />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function ModalView({ modal, setModal, settings, setSettings, inputs, res }: {
  modal: NonNullable<Modal>; setModal: (m: Modal) => void; settings: Settings; setSettings: (s: Settings) => void; inputs: Inputs | null; res: ReturnType<typeof analyze> | null;
}) {
  const close = () => setModal(null);
  let title = '';
  let body: JSX.Element | null = null;
  if (modal.t === 'causes') {
    const c = CAUSES[modal.key];
    const hints = inputs && res ? contextHints(modal.key, inputs, res) : [];
    title = c.title;
    body = (
      <>
        <p>{c.intro}</p>
        {hints.length > 0 && (
          <div className="hints">
            <h4>Bu hastanın verilerine göre öne çıkanlar</h4>
            <ul>{hints.map((h, i) => <li key={i}>{h}</li>)}</ul>
          </div>
        )}
        {c.mnemonic && <p className="mnem">{c.mnemonic}</p>}
        <div className="cause-groups">
          {c.groups.map((g) => (
            <div key={g.name} className="cause-g">
              <h4>{g.name}</h4>
              <ul>{g.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
        <h4>Önerilen ek tetkikler</h4>
        <ul className="workup">{c.workup.map((w) => <li key={w}>{w}</li>)}</ul>
        <p className="how-src">Kaynak: {c.sources.join(' · ')}</p>
      </>
    );
  } else if (modal.t === 'info') {
    title = 'Bilgi';
    const tab = INFO.find((t) => t.id === modal.tab) || INFO[0];
    body = (
      <>
        <div className="tabs" role="tablist">
          {INFO.map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === tab.id} className={t.id === tab.id ? 'on' : ''} onClick={() => setModal({ t: 'info', tab: t.id })}>{t.title}</button>
          ))}
        </div>
        {tab.blocks.map((b, i) => (
          <div key={i} className="info-b">
            {b.h && <h4>{b.h}</h4>}
            {b.p && <p>{b.p}</p>}
            {b.list && <ul>{b.list.map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>
        ))}
      </>
    );
  } else {
    title = 'Ayarlar';
    body = (
      <div className="settings">
        <label className="ctx-row"><span>Normal anyon açığı (mmol/L)</span>
          <input inputMode="decimal" value={String(settings.normalAG)} onChange={(e) => { const n = parseNum(e.target.value); if (n !== undefined) setSettings({ ...settings, normalAG: n }); }} />
        </label>
        <p className="tiny muted">Klasik değer 12 ± 4. İyon seçici elektrotlu yeni cihazlarda laboratuvarınızın referansını kullanın. “Artmış” eşiği = normal + 4.</p>
        <label className="ctx-row"><span>Referans albümin (g/dL)</span>
          <select value={String(settings.refAlbumin)} onChange={(e) => setSettings({ ...settings, refAlbumin: Number(e.target.value) })}>
            <option value="4">4,0 (yaygın kullanım)</option>
            <option value="4.4">4,4 (Figge 1998)</option>
            <option value="4.5">4,5 (bazı Türkçe kaynaklar)</option>
          </select>
        </label>
        <label className="ctx-row"><span>Delta oranı yorumu</span>
          <select value={settings.deltaMode} onChange={(e) => setSettings({ ...settings, deltaMode: e.target.value as Settings['deltaMode'] })}>
            <option value="genis">Genişletilmiş (Rastegar: &lt;0,4 / 0,4–0,8 / 0,8–2 / &gt;2)</option>
            <option value="klasik">Klasik basit kural (≈1 / &lt;1 / &gt;1)</option>
          </select>
        </label>
        <label className="check-row"><input type="checkbox" checked={settings.venousCorrection} onChange={(e) => setSettings({ ...settings, venousCorrection: e.target.checked })} />
          Venöz örnekte tahmini arteriyel değere çevir (pH +0,03 · pCO₂ −4 · HCO₃⁻ −1)</label>
        <button className="ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>Varsayılanlara dön</button>
      </div>
    );
  }
  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="x" onClick={close} aria-label="Kapat">×</button>
        </div>
        <div className="modal-b">{body}</div>
      </div>
    </div>
  );
}
