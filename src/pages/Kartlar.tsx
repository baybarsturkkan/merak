import { useMemo, useState } from 'react';
import { useApp } from '../app/context';
import { dueLabel, num, pct } from '../app/format';
import { DOMAINS, DOMAIN_LABELS, type Domain } from '../lib/schema';
import { cardPhase, PHASE_LABELS, type CardPhase, type CardState } from '../lib/state';
import { normalize } from '../lib/match';

type Filter = 'hepsi' | CardPhase | 'askida' | 'hatali';

const FILTERS: Array<{ v: Filter; label: string }> = [
  { v: 'hepsi', label: 'Tüm durumlar' },
  { v: 'yeni', label: 'Yeni' },
  { v: 'ogreniliyor', label: 'Öğreniliyor' },
  { v: 'tekrar', label: 'Tekrarda' },
  { v: 'olgun', label: 'Olgun' },
  { v: 'askida', label: 'Askıda' },
  { v: 'hatali', label: 'Hatalı işaretli' },
];

const PAGE = 60;

export function Kartlar() {
  const { data, now } = useApp();
  const [q, setQ] = useState('');
  const [domain, setDomain] = useState<Domain | 'hepsi'>('hepsi');
  const [filter, setFilter] = useState<Filter>('hepsi');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    if (!data) return [];
    const nq = normalize(q);
    return data.states
      .filter((s) => domain === 'hepsi' || s.card.domain === domain)
      .filter((s) => {
        if (filter === 'hepsi') return true;
        if (filter === 'askida') return s.suspended;
        if (filter === 'hatali') return !!s.flag;
        return cardPhase(s) === filter;
      })
      .filter((s) => {
        if (!nq) return true;
        const c = s.card;
        return normalize([c.question, c.answer, c.context ?? '', c.tags.join(' ')].join(' ')).includes(nq);
      })
      .sort((a, b) => a.card.id.localeCompare(b.card.id));
  }, [data, q, domain, filter]);

  if (!data) return null;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Kartlar</h1>
        <p>
          {num(data.states.length)} kart. Bildiğin kartları silmek yerine bırak: FSRS onları giderek seyrekleştirir.
        </p>
      </div>

      <div className="panel stack">
        <div className="filters">
          <input
            type="search"
            placeholder="Ara: soru, cevap, etiket…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            aria-label="Kartlarda ara"
          />
          <select value={domain} onChange={(e) => setDomain(e.target.value as Domain | 'hepsi')} aria-label="Alan">
            <option value="hepsi">Tüm alanlar</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Durum">
            {FILTERS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <p className="muted small">{num(list.length)} sonuç</p>

        <div className="list">
          {list.slice(0, limit).map((s) => (
            <CardRow key={s.card.id} s={s} now={now} open={open === s.card.id} onToggle={() => setOpen(open === s.card.id ? null : s.card.id)} />
          ))}
        </div>
        {list.length > limit && (
          <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
            Daha fazla göster
          </button>
        )}
      </div>
    </div>
  );
}

function CardRow({ s, now, open, onToggle }: { s: CardState; now: Date; open: boolean; onToggle: () => void }) {
  const { record, data } = useApp();
  const [note, setNote] = useState('');
  const [flagging, setFlagging] = useState(false);
  const phase = cardPhase(s);
  const c = s.card;
  const reading = c.source?.readingId ? data?.readings.find((r) => r.id === c.source?.readingId) : undefined;

  return (
    <div className="list-item">
      <button type="button" className="item-head" aria-expanded={open} onClick={onToggle}>
        <div>
          <div className="item-title">{c.question}</div>
          <div className="item-meta">
            <span className={`chip chip-domain d-${c.domain}`}>{DOMAIN_LABELS[c.domain]}</span>
            <span className={`chip${phase === 'olgun' ? ' chip-good' : phase === 'yeni' ? ' chip-accent' : ''}`}>
              {PHASE_LABELS[phase]}
            </span>
            {s.suspended && <span className="chip">Askıda</span>}
            {s.flag && <span className="chip chip-warn">Hatalı işaretli</span>}
            {!s.isNew && !s.suspended && <span className="muted small">{dueLabel(s.fsrs.due, now)}</span>}
          </div>
        </div>
      </button>
      {open && (
        <div className="item-body">
          {c.context && <p className="muted">{c.context}</p>}
          <p>
            <span className="muted">Cevap: </span>
            <strong>{c.answer}</strong>
          </p>
          {c.options && <p className="small muted">Seçenekler: {c.options.join(' · ')}</p>}
          <p className="small">
            <span className="muted">Neden: </span>
            {c.why}
          </p>
          <dl className="kv">
            {c.tags.length > 0 && (
              <>
                <dt>Etiketler</dt>
                <dd>{c.tags.join(', ')}</dd>
              </>
            )}
            {reading && (
              <>
                <dt>Okuma</dt>
                <dd>{reading.title}</dd>
              </>
            )}
            {c.source?.ref && (
              <>
                <dt>Kaynak</dt>
                <dd>{c.source.ref}</dd>
              </>
            )}
            {!s.isNew && (
              <>
                <dt>Tekrar</dt>
                <dd>
                  {s.reviews.length} kez · {s.fsrs.lapses} unutma
                </dd>
                <dt>Kararlılık</dt>
                <dd>{s.fsrs.stability.toFixed(1).replace('.', ',')} gün</dd>
                <dt>Hatırlanabilirlik</dt>
                <dd>{pct(data?.scheduler.get_retrievability(s.fsrs, now, false))}</dd>
                <dt>Sonraki</dt>
                <dd>{s.fsrs.due.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}</dd>
              </>
            )}
            {s.flag && (
              <>
                <dt>Hata notu</dt>
                <dd>{s.flag}</dd>
              </>
            )}
            <dt>Kimlik</dt>
            <dd>
              <code>{c.id}</code>
            </dd>
          </dl>
          {flagging ? (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                record({ type: 'isaret', cardId: c.id, note: note.trim() });
                setFlagging(false);
                setNote('');
              }}
            >
              <label className="field">
                Kartta ne yanlış?
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              </label>
              <div className="row">
                <button type="submit" className="btn btn-sm">
                  Bildir
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFlagging(false)}>
                  Vazgeç
                </button>
              </div>
            </form>
          ) : (
            <div className="row">
              {s.flag ? (
                <button type="button" className="btn btn-sm" onClick={() => record({ type: 'isaret-cozuldu', cardId: c.id })}>
                  İşareti kaldır
                </button>
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setFlagging(true)}>
                  Hata bildir
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => record({ type: s.suspended ? 'geri-al' : 'askiya-al', cardId: c.id })}
              >
                {s.suspended ? 'Askıdan al' : 'Askıya al'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
