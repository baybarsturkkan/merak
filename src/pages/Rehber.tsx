import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { findInLog, orderedItems, readingKind, sortGuides } from '../lib/guide';
import {
  GUIDE_AREA_LABELS,
  LEVEL_LABELS,
  LEVELS,
  SOURCE_KIND_LABELS,
  type Guide,
  type GuideArea,
  type GuideItem,
  type Reading,
  type SourceKind,
} from '../lib/schema';
import type { ReadingView } from '../lib/state';
import { IconCheck, IconInfo, IconSpark } from '../components/Icons';
import { ReadingForm, cleanReading, emptyDraft } from './Okuma';

const AREA_KEY = 'merak:rehber-alan';

function loadArea(): GuideArea | null {
  try {
    return (localStorage.getItem(AREA_KEY) as GuideArea | null) ?? null;
  } catch {
    return null;
  }
}

/** Bugün sayfasındaki öneriden gelince doğru alan açılsın */
export function rememberArea(a: GuideArea) {
  saveArea(a);
}

function saveArea(a: GuideArea) {
  try {
    localStorage.setItem(AREA_KEY, a);
  } catch {
    /* gizli pencere vb. */
  }
}

function dateLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Rehber() {
  const { data, guides, record } = useApp();
  const sorted = useMemo(() => sortGuides(guides), [guides]);
  const [area, setAreaState] = useState<GuideArea | null>(loadArea);
  const [kind, setKind] = useState<SourceKind | 'hepsi'>('hepsi');
  const [onlyTr, setOnlyTr] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ item: GuideItem; reading: Reading } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Telefonda seçili alan sekmesi yatay şeritte görünür olsun (sayfayı dikey kaydırmadan)
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.area-tab[aria-pressed="true"]');
    const strip = el?.parentElement;
    if (!el || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const a = el.getBoundingClientRect();
    const s = strip.getBoundingClientRect();
    strip.scrollLeft += a.left + a.width / 2 - (s.left + s.width / 2);
  }, [area, sorted.length, !!data]);

  if (!data) return null;

  if (sorted.length === 0) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Rehber</h1>
          <p>Alanlara göre seçilmiş kitaplar, podcast’ler, belgeseller ve dersler.</p>
        </div>
        <div className="panel empty">
          <div className="big" aria-hidden>
            🧭
          </div>
          <p>
            Rehber henüz hazırlanmamış. Bilgisayarda Claude Code’a <code>/rehber</code> yaz; alanlara göre kaynak araştırıp
            buraya eklesin.
          </p>
        </div>
      </div>
    );
  }

  const guide: Guide = sorted.find((g) => g.area === area) ?? sorted[0];
  const setArea = (a: GuideArea) => {
    setAreaState(a);
    saveArea(a);
    setOpen(null);
    setDraft(null);
    setSaved(null);
  };

  const items = orderedItems(guide);
  const kindsHere = [...new Set(guide.items.map((i) => i.kind))];
  const visible = items.filter(
    (i) => (kind === 'hepsi' || i.kind === kind) && (!onlyTr || i.lang === 'tr') && (!onlyFree || i.free),
  );
  const byId = new Map(guide.items.map((i) => [i.id, i]));
  const doneCount = guide.items.filter((i) => findInLog(i, data.readings)).length;

  const reveal = (id: string) => {
    setKind('hepsi');
    setOnlyTr(false);
    setOnlyFree(false);
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`kaynak-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const startLog = (item: GuideItem) => {
    setSaved(null);
    setDraft({
      item,
      reading: {
        ...emptyDraft(),
        title: item.title,
        author: item.author ?? '',
        kind: readingKind(item.kind),
        url: item.url ?? '',
        guideId: item.id,
      },
    });
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Rehber</h1>
        <p>
          Alanlara göre seçilmiş kitaplar, podcast’ler, belgeseller ve dersler. Popüler yazarlara ve dergilere aşinalık genel
          bilgiyi güçlü biçimde öngörüyor; geniş okumak, tek alanda derinleşmek kadar değerli.
        </p>
      </div>

      <nav className="area-tabs" aria-label="Alanlar">
        {sorted.map((g) => (
          <button
            key={g.area}
            type="button"
            className="area-tab"
            aria-pressed={g.area === guide.area}
            onClick={() => setArea(g.area)}
          >
            <span className={`dot d-${g.area}`} aria-hidden />
            {GUIDE_AREA_LABELS[g.area]}
            {g.area !== 'genel' && (data.domainCuriosity[g.area] ?? 0) >= 2.5 && (
              <IconSpark width={14} height={14} aria-label="Merakın yüksek olduğu alan" />
            )}
          </button>
        ))}
      </nav>

      <section className="panel stack">
        <div className="spread">
          <h2>{GUIDE_AREA_LABELS[guide.area]}</h2>
          <span className="muted small">
            {doneCount}/{guide.items.length} günlükte
          </span>
        </div>
        <p>{guide.intro}</p>
        <p className="muted small">
          {guide.items.length} kaynak · {guide.items.filter((i) => i.lang === 'tr').length} Türkçe ·{' '}
          {guide.items.filter((i) => i.free).length} ücretsiz · güncelleme {dateLabel(guide.updatedAt)}
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Yol haritası</h2>
          <span className="muted small">sırayla ilerle</span>
        </div>
        <ol className="roadmap">
          {guide.path.map((step, i) => (
            <li key={i} className="step">
              <span className="step-num" aria-hidden>
                {i + 1}
              </span>
              <div className="step-body">
                <strong>{step.title}</strong>
                <p className="muted small">{step.text}</p>
                {step.items.length > 0 && (
                  <div className="step-items">
                    {step.items.map((id) => {
                      const it = byId.get(id);
                      if (!it) return null;
                      const done = !!findInLog(it, data.readings);
                      return (
                        <button key={id} type="button" className={`step-item${done ? ' done' : ''}`} onClick={() => reveal(id)}>
                          {done && <IconCheck width={14} height={14} />}
                          {it.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel stack">
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <h2>Kaynaklar</h2>
          <span className="muted small">{visible.length} kaynak</span>
        </div>
        <div className="row">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SourceKind | 'hepsi')}
            aria-label="Tür"
            style={{ width: 'auto', minHeight: 36, padding: '6px 10px' }}
          >
            <option value="hepsi">Tüm türler</option>
            {kindsHere.map((k) => (
              <option key={k} value={k}>
                {SOURCE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <button type="button" className="toggle" aria-pressed={onlyTr} onClick={() => setOnlyTr((v) => !v)}>
            Türkçe
          </button>
          <button type="button" className="toggle" aria-pressed={onlyFree} onClick={() => setOnlyFree((v) => !v)}>
            Ücretsiz
          </button>
        </div>

        {visible.length === 0 && <p className="muted small">Bu filtrelere uyan kaynak yok.</p>}

        {LEVELS.map((level) => {
          const group = visible.filter((i) => i.level === level);
          if (!group.length) return null;
          return (
            <div key={level} className="stack" style={{ gap: 0 }}>
              <span className="prompt-label">{LEVEL_LABELS[level]}</span>
              <div className="list">
                {group.map((it) => (
                  <SourceRow
                    key={it.id}
                    item={it}
                    inLog={findInLog(it, data.readings)}
                    open={open === it.id}
                    onToggle={() => setOpen(open === it.id ? null : it.id)}
                    onLog={() => startLog(it)}
                    saved={saved === it.id}
                    form={
                      draft?.item.id === it.id ? (
                        <ReadingForm
                          heading="Günlüğe ekle"
                          draft={draft.reading}
                          onCancel={() => setDraft(null)}
                          onSave={(r) => {
                            record({ type: 'okuma', reading: cleanReading(r) });
                            setDraft(null);
                            setSaved(it.id);
                          }}
                        />
                      ) : null
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {guide.tips.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>İpuçları</h2>
          </div>
          <ul className="plain tips">
            {guide.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="callout">
        <IconInfo />
        <span>
          Bir kaynağı bitirince “Günlüğe ekle” de; Claude Code’da <code>/okuma</code> ondan kart çıkarır. Rehberi genişletmek ya
          da merakına göre yenilemek için <code>/rehber</code> yaz.
        </span>
      </div>
    </div>
  );
}

function SourceRow({
  item,
  inLog,
  open,
  onToggle,
  onLog,
  saved,
  form,
}: {
  item: GuideItem;
  inLog: ReadingView | undefined;
  open: boolean;
  onToggle: () => void;
  onLog: () => void;
  saved: boolean;
  form: ReactNode;
}) {
  return (
    <div className="list-item" id={`kaynak-${item.id}`}>
      <button type="button" className="item-head" aria-expanded={open} onClick={onToggle}>
        <div>
          <div className="item-title">{item.title}</div>
          {item.author && <div className="muted small">{item.author}</div>}
          <div className="item-meta">
            <span className="chip">{SOURCE_KIND_LABELS[item.kind]}</span>
            <span className={`chip${item.lang === 'tr' ? ' chip-accent' : ''}`}>{item.lang === 'tr' ? 'Türkçe' : 'İngilizce'}</span>
            {item.free && <span className="chip">Ücretsiz</span>}
            {inLog && (
              <span className="chip chip-good">
                <IconCheck width={12} height={12} /> Günlükte
              </span>
            )}
          </div>
        </div>
      </button>
      {open && (
        <div className="item-body">
          {item.original && <p className="muted small">Özgün adı: {item.original}</p>}
          <p>{item.why}</p>
          {item.size && <p className="muted small">{item.size}</p>}
          {saved && (
            <div className="callout callout-good">
              <IconCheck />
              <span>
                Günlüğe eklendi. Claude Code’da <code>/okuma</code> yazınca bu kaynaktan kart çıkarılır.
              </span>
            </div>
          )}
          {form ?? (
            <div className="row">
              {item.url && (
                <a className="btn btn-sm" href={item.url} target="_blank" rel="noreferrer noopener">
                  Aç ↗
                </a>
              )}
              {inLog ? (
                <span className="muted small">
                  {inLog.date.split('-').reverse().join('.')} tarihinde günlüğe eklendi
                  {inLog.cardIds.length ? ` · ${inLog.cardIds.length} kart` : ''}
                </span>
              ) : (
                <button type="button" className="btn btn-primary btn-sm" onClick={onLog}>
                  Bitirdim, günlüğe ekle
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
