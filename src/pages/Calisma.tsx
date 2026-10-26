import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/context';
import { go } from '../app/router';
import { pct } from '../app/format';
import { DOMAIN_LABELS } from '../lib/schema';
import { introducedToday, type CardState } from '../lib/state';
import {
  buildSession,
  MAX_REPEATS_PER_SESSION,
  mulberry32,
  previewIntervals,
  REQUEUE_GAP,
  requeue,
  type FSRS,
  type QueueItem,
} from '../lib/srs';
import { matchAnswer, type MatchResult } from '../lib/match';
import { formatInterval } from '../lib/dates';
import { IconCheck, IconInfo, IconWarn, IconX } from '../components/Icons';

type Level = 1 | 2 | 3;
type Rating = 1 | 2 | 3 | 4;

interface Outcome {
  cardId: string;
  rating: Rating;
  isNew: boolean;
  confidence?: Level;
  curiosity?: Level;
  typed: string;
  ms: number;
}

const CURIOSITY = [
  { v: 1, label: 'Pek değil' },
  { v: 2, label: 'Biraz' },
  { v: 3, label: 'Çok' },
] as const;

const CONFIDENCE = [
  { v: 1, label: 'Tahmin' },
  { v: 2, label: 'Sanırım' },
  { v: 3, label: 'Eminim' },
] as const;

const GRADES: Array<{ v: Rating; label: string; cls?: string }> = [
  { v: 1, label: 'Bilemedim', cls: 'again' },
  { v: 2, label: 'Zorlandım' },
  { v: 3, label: 'Bildim' },
  { v: 4, label: 'Çok kolay' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function Calisma() {
  const { data, record, engine, loading } = useApp();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [repeats, setRepeats] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Outcome[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // İlk indirme bitmeden sıra kurulmasın (önbellek boşken kartlar henüz gelmemiştir)
    if (queue || !data || loading) return;
    const now = new Date();
    const remaining = Math.max(0, data.settings.newPerDay - introducedToday(data.reviews, now));
    setQueue(
      buildSession(data.states, {
        now,
        newRemaining: remaining,
        domainCuriosity: data.domainCuriosity,
        rng: mulberry32(now.getTime() >>> 0),
      }),
    );
  }, [data, queue, loading]);

  const done = !!queue && queue.length > 0 && index >= queue.length;
  useEffect(() => {
    if (done) void engine?.push();
  }, [done, engine]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const finish = () => {
    void engine?.push();
    go('bugun');
  };

  if (!data || !queue) return <div className="session"><p className="muted">Hazırlanıyor…</p></div>;

  if (queue.length === 0) return <NothingDue onExit={finish} />;
  if (done) return <Summary results={results} onExit={finish} />;

  const item = queue[index];
  const state = data.byId.get(item.cardId);

  const advance = () => setIndex((i) => i + 1);

  const onGrade = (o: Outcome) => {
    record({
      type: 'tekrar',
      cardId: o.cardId,
      rating: o.rating,
      phase: o.isNew ? 'ontest' : 'tekrar',
      ...(o.confidence ? { confidence: o.confidence } : {}),
      ...(o.curiosity ? { curiosity: o.curiosity } : {}),
      ...(o.typed.trim() ? { typed: o.typed.trim().slice(0, 300) } : {}),
      ms: o.ms,
    });
    setResults((r) => [...r, o]);
    const confidentError = o.rating === 1 && o.confidence === 3;
    if (o.rating === 1 && (repeats[o.cardId] ?? 0) < MAX_REPEATS_PER_SESSION) {
      setQueue(
        requeue(queue, index, { ...item, isNew: false }, confidentError ? REQUEUE_GAP.confidentError : REQUEUE_GAP.normal),
      );
      setRepeats((r) => ({ ...r, [o.cardId]: (r[o.cardId] ?? 0) + 1 }));
    }
    if (confidentError) setToast('Emin olduğun bir hataydı. Bu kart birazdan yeniden gelecek.');
    advance();
  };

  return (
    <div className="session">
      <div className="session-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={finish} aria-label="Oturumu bitir">
          <IconX width={18} height={18} /> Bitir
        </button>
        <div className="meter" aria-hidden>
          <span style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
        <span className="count">
          {index + 1} / {queue.length}
        </span>
      </div>

      {state ? (
        <CardRunner
          key={`${index}:${item.cardId}`}
          state={state}
          scheduler={data.scheduler}
          onGrade={onGrade}
          onFlag={(note) => {
            record({ type: 'isaret', cardId: item.cardId, note });
            setToast('Teşekkürler. Claude Code’da /kart-duzelt ile düzeltilecek.');
          }}
          onSuspend={() => {
            record({ type: 'askiya-al', cardId: item.cardId });
            setToast('Kart askıya alındı. Kartlar sayfasından geri alabilirsin.');
            advance();
          }}
        />
      ) : (
        <div className="study-card">
          <p>Bu kart artık destede yok.</p>
          <button type="button" className="btn" onClick={advance}>
            Geç
          </button>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function CardRunner({
  state,
  scheduler,
  onGrade,
  onFlag,
  onSuspend,
}: {
  state: CardState;
  scheduler: FSRS;
  onGrade: (o: Outcome) => void;
  onFlag: (note: string) => void;
  onSuspend: () => void;
}) {
  const { card, isNew } = state;
  const isChoice = card.type === 'hangisi';
  const [step, setStep] = useState<'soru' | 'cevap'>('soru');
  const [typed, setTyped] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [flagNote, setFlagNote] = useState('');
  const shownAt = useRef(Date.now());
  // Hızlı tuş basışlarında ve çift dokunuşta adım/not iki kez işlenmesin
  const stepRef = useRef<'soru' | 'cevap'>('soru');
  const gradedRef = useRef(false);
  const options = useMemo(() => (card.options ? shuffle(card.options) : []), [card.options]);
  const previews = useMemo(
    () => (step === 'cevap' ? previewIntervals(scheduler, state.fsrs, new Date()) : null),
    [step, scheduler, state.fsrs],
  );

  const match: MatchResult = isChoice
    ? choice === null
      ? 'bos'
      : choice === card.answer
        ? 'tam'
        : 'farkli'
    : matchAnswer(typed, card.answer, card.accept);
  const confidentMiss = !isNew && level === 3 && match === 'farkli';
  const suggested: Rating | null = match === 'tam' ? 3 : match === 'yakin' ? 3 : match === 'farkli' ? 1 : null;

  const reveal = (lvl: Level) => {
    if (stepRef.current !== 'soru' || (isChoice && !choice)) return;
    stepRef.current = 'cevap';
    setLevel(lvl);
    setStep('cevap');
  };

  const grade = (rating: Rating) => {
    if (stepRef.current !== 'cevap' || gradedRef.current) return;
    gradedRef.current = true;
    onGrade({
      cardId: card.id,
      rating,
      isNew,
      typed: isChoice ? (choice ?? '') : typed,
      ms: Date.now() - shownAt.current,
      ...(isNew ? { curiosity: level ?? undefined } : { confidence: level ?? undefined }),
    });
  };

  const gradeChoices: Array<{ v: Rating; label: string; cls?: string }> = isChoice
    ? match === 'tam'
      ? GRADES.slice(2)
      : [{ v: 1, label: 'Devam', cls: 'again' }]
    : GRADES;

  // Klavye: 1-3 güven/merak, cevaptan sonra 1-4 not
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') {
        if (e.key === 'Enter' && !e.shiftKey && t.tagName === 'TEXTAREA') {
          e.preventDefault();
          t.blur();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (stepRef.current === 'soru' && n >= 1 && n <= 3) {
        e.preventDefault(); // tuş, sonraki kartın kutusuna yazılmasın
        reveal(n as Level);
      } else if (stepRef.current === 'cevap' && n >= 1 && n <= 4) {
        e.preventDefault();
        const g = gradeChoices.find((x) => x.v === n) ?? (gradeChoices.length === 1 ? gradeChoices[0] : undefined);
        if (g) grade(g.v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const levels = isNew ? CURIOSITY : CONFIDENCE;

  return (
    <article className="study-card">
      <div className="row">
        <span className="chip">{DOMAIN_LABELS[card.domain]}</span>
        {isNew && <span className="chip chip-accent">Yeni kart</span>}
        {isChoice && <span className="chip">Hangisi?</span>}
        {state.flag && <span className="chip chip-warn">Hatalı işaretli</span>}
      </div>

      {card.context && <p className="context">{card.context}</p>}
      <h2 className={`question${step === 'cevap' ? ' small' : ''}`}>{card.question}</h2>

      {step === 'soru' && (
        <>
          {isNew && (
            <div className="callout callout-accent small">
              <IconInfo />
              <span>Önce tahmin et. Yanılsan bile, tahmin etmek cevabı daha iyi hatırlamanı sağlar.</span>
            </div>
          )}

          {isChoice ? (
            <div className="options" role="group" aria-label="Seçenekler">
              {options.map((o) => (
                <button
                  key={o}
                  type="button"
                  className="option"
                  aria-pressed={choice === o}
                  onClick={() => setChoice(o)}
                >
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <label className="field">
              {isNew ? 'Tahminin' : 'Cevabın'}
              <textarea
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                rows={2}
                placeholder={isNew ? 'Aklına ilk geleni yaz…' : 'Cevabı yaz ya da aklından söyle'}
                autoFocus={isNew && !('ontouchstart' in window)}
              />
            </label>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <span className="prompt-label">
              {isNew ? 'Cevabı ne kadar merak ediyorsun?' : 'Ne kadar eminsin?'}
              {!isNew && !isChoice && <span className="muted"> (yazmak zorunda değilsin)</span>}
            </span>
            <div className="choices">
              {levels.map((l) => (
                <button
                  key={l.v}
                  type="button"
                  className="choice"
                  disabled={isChoice && !choice}
                  onClick={() => reveal(l.v)}
                >
                  {l.label}
                  <small>Cevabı göster</small>
                </button>
              ))}
            </div>
            {isChoice && !choice && <p className="muted small">Önce bir seçenek seç.</p>}
          </div>
          <p className="kbd-hint">Kısayol: 1 · 2 · 3 {isChoice ? '' : '· yazarken Enter kutudan çıkar'}</p>
        </>
      )}

      {step === 'cevap' && (
        <>
          {isChoice ? (
            <div className="options">
              {options.map((o) => (
                <div
                  key={o}
                  className="option"
                  data-result={o === card.answer ? 'dogru' : o === choice ? 'yanlis' : undefined}
                >
                  {o === card.answer ? '✓ ' : o === choice ? '✗ ' : ''}
                  {o}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="answer-box">
                <span className="muted small">Doğru cevap</span>
                <span className="answer">{card.answer}</span>
              </div>
              <YourAnswer typed={typed} match={match} isNew={isNew} />
            </>
          )}

          {confidentMiss && (
            <div className="callout callout-warn" role="alert">
              <IconWarn />
              <span>
                <strong>Emin olduğun bir hata.</strong> Böyle hatalar düzeltildiğinde en iyi hatırlananlardır. Açıklamayı
                dikkatle oku.
              </span>
            </div>
          )}

          <details className="why" open={isNew || confidentMiss || match === 'farkli'}>
            <summary>Neden?</summary>
            <p>{card.why}</p>
          </details>

          <div className="stack" style={{ gap: 8 }}>
            <span className="prompt-label">
              {isChoice ? (match === 'tam' ? 'Doğru! Ne kadar kolaydı?' : 'Yanlış seçenek') : 'Ne kadar hatırladın?'}
            </span>
            <div className={`grades${gradeChoices.length === 2 ? ' two' : gradeChoices.length === 1 ? ' one' : ''}`}>
              {gradeChoices.map((g) => (
                <button
                  key={g.v}
                  type="button"
                  className={`grade ${g.cls ?? ''}${!isChoice && suggested === g.v ? ' suggested' : ''}`}
                  onClick={() => grade(g.v)}
                >
                  {g.label}
                  {previews && <small>{previews[g.v]}</small>}
                </button>
              ))}
            </div>
            <p className="kbd-hint">Kısayol: {gradeChoices.map((g) => g.v).join(' · ')}</p>
          </div>
        </>
      )}

      <div className="card-tools">
        {flagging ? (
          <form
            className="stack"
            style={{ width: '100%' }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!flagNote.trim()) return;
              onFlag(flagNote.trim());
              setFlagging(false);
              setFlagNote('');
            }}
          >
            <label className="field">
              Kartta ne yanlış?
              <textarea value={flagNote} onChange={(e) => setFlagNote(e.target.value)} rows={2} autoFocus />
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
          <>
            <button type="button" className="link-btn small" onClick={() => setFlagging(true)}>
              Hatalı mı?
            </button>
            <button type="button" className="link-btn small" onClick={onSuspend}>
              Askıya al
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function YourAnswer({ typed, match, isNew }: { typed: string; match: MatchResult; isNew: boolean }) {
  if (match === 'bos') {
    return <p className="muted small">{isNew ? 'Tahmin yazmadın.' : 'Aklından söyledin. Kendini dürüstçe notla.'}</p>;
  }
  const badge =
    match === 'tam' ? (
      <span className="chip chip-good">
        <IconCheck width={14} height={14} /> Eşleşiyor
      </span>
    ) : match === 'yakin' ? (
      <span className="chip chip-accent">≈ Yakın</span>
    ) : (
      <span className="chip chip-warn">✗ Farklı</span>
    );
  return (
    <div className="yours">
      <span className="muted small">{isNew ? 'Tahminin:' : 'Senin cevabın:'}</span>
      <span className="typed">{typed}</span>
      {badge}
    </div>
  );
}

function NothingDue({ onExit }: { onExit: () => void }) {
  const { data, now } = useApp();
  const next = data?.states
    .filter((s) => !s.isNew && !s.suspended && s.fsrs.due > now)
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())[0];
  return (
    <div className="session">
      <div className="study-card empty">
        <div className="big" aria-hidden>
          ☕
        </div>
        <h2>Şu an çalışılacak kart yok</h2>
        <p>
          {next
            ? `Sıradaki tekrar ${formatInterval(next.fsrs.due.getTime() - now.getTime())} sonra.`
            : 'Bugünkü yeni kart hakkını kullandın.'}{' '}
          Bu arada bir şey oku: genel kültürü en çok artıran şey okuma miktarı.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-primary" onClick={() => go('okuma')}>
            Okuma ekle
          </button>
          <button type="button" className="btn" onClick={onExit}>
            Bugün’e dön
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ results, onExit }: { results: Outcome[]; onExit: () => void }) {
  const { data } = useApp();
  const firstTry = new Map<string, Outcome>();
  for (const r of results) if (!firstTry.has(r.cardId)) firstTry.set(r.cardId, r);
  const recalls = [...firstTry.values()].filter((r) => !r.isNew);
  const ok = recalls.filter((r) => r.rating >= 2).length;
  const fresh = [...firstTry.values()].filter((r) => r.isNew).length;
  const confident = results.filter((r) => r.rating === 1 && r.confidence === 3);
  return (
    <div className="session">
      <div className="study-card">
        <div className="empty" style={{ padding: '8px 0 0' }}>
          <div className="big" aria-hidden>
            ✓
          </div>
          <h2>Oturum bitti</h2>
        </div>
        <div className="grid-2">
          <div className="tile">
            <span className="label">Hatırlama</span>
            <span className="value">{recalls.length ? pct(ok / recalls.length) : '—'}</span>
            <span className="note">
              {recalls.length ? `${ok}/${recalls.length} tekrar kartı` : 'tekrar kartı yoktu'}
            </span>
          </div>
          <div className="tile">
            <span className="label">Yeni öğrenilen</span>
            <span className="value">{fresh}</span>
            <span className="note">kart, ön testle</span>
          </div>
        </div>
        {confident.length > 0 && (
          <div className="stack">
            <h3>Emin olup yanıldıkların</h3>
            <p className="sub">Bunlar en iyi düzelen hatalardır; yakında yine sorulacaklar.</p>
            <ul className="plain">
              {confident.map((c, i) => {
                const card = data?.byId.get(c.cardId)?.card;
                return card ? (
                  <li key={i}>
                    {card.question} <strong>{card.answer}</strong>
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        )}
        <button type="button" className="btn btn-primary btn-big" onClick={onExit}>
          Bugün’e dön
        </button>
      </div>
    </div>
  );
}
