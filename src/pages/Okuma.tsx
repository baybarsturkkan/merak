import { useState } from 'react';
import { useApp } from '../app/context';
import { localDateKey, monthLabel } from '../lib/dates';
import { newId } from '../lib/dates';
import { readingsThisWeek } from '../lib/stats';
import type { Reading } from '../lib/schema';
import type { ReadingView } from '../lib/state';
import { IconInfo } from '../components/Icons';

const KINDS: Array<{ v: Reading['kind']; label: string }> = [
  { v: 'kitap', label: 'Kitap' },
  { v: 'makale', label: 'Makale' },
  { v: 'podcast', label: 'Podcast' },
  { v: 'belgesel', label: 'Belgesel' },
  { v: 'video', label: 'Video' },
  { v: 'diger', label: 'Diğer' },
];

const kindLabel = (k: Reading['kind']) => KINDS.find((x) => x.v === k)?.label ?? k;

export function emptyDraft(): Reading {
  return { id: '', title: '', author: '', kind: 'makale', url: '', date: localDateKey(new Date()), notes: '' };
}

/** Formdan gelen okumayı kaydedilecek biçime getirir: boş alanları atar, kimlik üretir */
export function cleanReading(r: Reading): Reading {
  return {
    id: r.id || `okuma-${newId().slice(0, 10)}`,
    title: r.title.trim(),
    kind: r.kind,
    date: r.date,
    ...(r.author?.trim() ? { author: r.author.trim() } : {}),
    ...(r.url?.trim() ? { url: r.url.trim() } : {}),
    ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
    ...(r.guideId ? { guideId: r.guideId } : {}),
  };
}

export function Okuma() {
  const { data, record, now } = useApp();
  const [draft, setDraft] = useState<Reading | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!data) return null;

  const save = (r: Reading) => {
    const clean = cleanReading(r);
    record({ type: 'okuma', reading: clean });
    setDraft(null);
    setOpen(clean.id);
  };

  const groups = new Map<string, ReadingView[]>();
  for (const r of data.readings) {
    const k = r.date.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const week = readingsThisWeek(data.readings, now);
  const goal = data.settings.weeklyReadingGoal;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Okuma günlüğü</h1>
        <p>Okuma miktarı, zekâ ve okuma becerisi hesaba katıldığında bile genel bilgiyi öngörüyor.</p>
      </div>

      <div className="panel stack">
        <div className="spread">
          <div>
            <strong>Bu hafta {week} okuma</strong>
            <span className="muted"> · hedef {goal}</span>
          </div>
          {!draft && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(emptyDraft())}>
              Okuma ekle
            </button>
          )}
        </div>
        <div className="meter" aria-hidden>
          <span style={{ width: `${goal ? Math.min(100, (week / goal) * 100) : 0}%` }} />
        </div>
      </div>

      {draft && <ReadingForm draft={draft} onCancel={() => setDraft(null)} onSave={save} />}

      <div className="callout">
        <IconInfo />
        <span>
          Kart çıkarmak için bilgisayarda Claude Code’a <code>/okuma</code> yaz. Notların ne kadar zenginse kartlar o kadar
          iyi olur. Bağlantı verirsen Claude sayfayı da okur.
        </span>
      </div>

      {data.readings.length === 0 && !draft && (
        <div className="panel empty">
          <div className="big" aria-hidden>
            📚
          </div>
          <p>Henüz okuma yok. İlk makaleni ya da kitabını ekle.</p>
        </div>
      )}

      {[...groups].map(([month, items]) => (
        <section key={month} className="panel">
          <div className="panel-head">
            <h2>{monthLabel(month)}</h2>
            <span className="muted small">{items.length} okuma</span>
          </div>
          <div className="list">
            {items.map((r) => (
              <div key={r.id} className="list-item">
                <button
                  type="button"
                  className="item-head"
                  aria-expanded={open === r.id}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  <div>
                    <div className="item-title">{r.title}</div>
                    <div className="item-meta">
                      <span className="chip">{kindLabel(r.kind)}</span>
                      {r.author && <span className="muted small">{r.author}</span>}
                      <span className="muted small">{r.date.split('-').reverse().join('.')}</span>
                    </div>
                  </div>
                  {r.cardIds.length ? (
                    <span className="chip chip-good">{r.cardIds.length} kart</span>
                  ) : (
                    <span className="chip chip-accent">Kart bekliyor</span>
                  )}
                </button>
                {open === r.id && (
                  <ReadingDetail
                    reading={r}
                    onEdit={() => setDraft({ ...r })}
                    onDelete={() => {
                      if (confirm(`"${r.title}" günlükten silinsin mi? Kartları silinmez.`)) {
                        record({ type: 'okuma-sil', readingId: r.id });
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ReadingDetail({ reading, onEdit, onDelete }: { reading: ReadingView; onEdit: () => void; onDelete: () => void }) {
  const { data } = useApp();
  return (
    <div className="item-body">
      {reading.url && (
        <a href={reading.url} target="_blank" rel="noreferrer noopener" className="small">
          {reading.url}
        </a>
      )}
      {reading.notes ? <p style={{ whiteSpace: 'pre-wrap' }}>{reading.notes}</p> : <p className="muted small">Not yok.</p>}
      {reading.cardIds.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="prompt-label">Bu okumadan çıkan kartlar</span>
          <ul className="plain">
            {reading.cardIds.map((id) => {
              const c = data?.byId.get(id)?.card;
              return c ? <li key={id}>{c.question}</li> : null;
            })}
          </ul>
        </div>
      )}
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={onEdit}>
          Düzenle
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
          Sil
        </button>
      </div>
    </div>
  );
}

export function ReadingForm({
  draft,
  onSave,
  onCancel,
  heading,
}: {
  draft: Reading;
  onSave: (r: Reading) => void;
  onCancel: () => void;
  heading?: string;
}) {
  const [r, setR] = useState<Reading>(draft);
  const set = (patch: Partial<Reading>) => setR((x) => ({ ...x, ...patch }));
  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (r.title.trim()) onSave(r);
      }}
    >
      <h2>{heading ?? (draft.id ? 'Okumayı düzenle' : 'Yeni okuma')}</h2>
      <label className="field">
        Başlık
        <input type="text" required value={r.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
      </label>
      <div className="grid-2">
        <label className="field">
          Tür
          <select value={r.kind} onChange={(e) => set({ kind: e.target.value as Reading['kind'] })}>
            {KINDS.map((k) => (
              <option key={k.v} value={k.v}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tarih
          <input type="date" required value={r.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
      </div>
      <label className="field">
        Yazar / kaynak <span className="hint">isteğe bağlı</span>
        <input type="text" value={r.author ?? ''} onChange={(e) => set({ author: e.target.value })} />
      </label>
      <label className="field">
        Bağlantı <span className="hint">isteğe bağlı; Claude Code sayfayı okuyabilir</span>
        <input type="url" value={r.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
      </label>
      <label className="field">
        Aklında kalanlar
        <span className="hint">Önemli noktalar, şaşırdığın şeyler. Kartlar bunlardan çıkacak.</span>
        <textarea rows={5} value={r.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <div className="row">
        <button type="submit" className="btn btn-primary">
          Kaydet
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
