import {
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  type AppEvent,
  type Card,
  type Domain,
  type Reading,
  type ReviewEvent,
  type Settings,
} from './schema';
import { makeScheduler, replay, State, type FSRS, type FsrsCard } from './srs';
import { localDateKey } from './dates';

export interface CardState {
  card: Card;
  fsrs: FsrsCard;
  reviews: ReviewEvent[];
  isNew: boolean;
  suspended: boolean;
  flag?: string;
  curiosity?: 1 | 2 | 3;
}

export interface ReadingView extends Reading {
  cardIds: string[];
  addedTs: string;
}

export interface Derived {
  states: CardState[];
  byId: Map<string, CardState>;
  /** Tüm tekrar olayları, zaman sırasıyla (silinmiş kartlarınkiler dahil) */
  reviews: ReviewEvent[];
  readings: ReadingView[];
  settings: Settings;
  scheduler: FSRS;
  domainCuriosity: Partial<Record<Domain, number>>;
}

function clamp(v: number, [lo, hi]: [number, number]): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sortEvents(events: AppEvent[]): AppEvent[] {
  const unique = new Map<string, AppEvent>();
  for (const e of events) if (!unique.has(e.id)) unique.set(e.id, e);
  return [...unique.values()].sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
}

/** Kartlar + olay günlüğü → uygulamanın tüm durumu */
export function derive(cards: Card[], events: AppEvent[]): Derived {
  const sorted = sortEvents(events);

  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const e of sorted) {
    if (e.type === 'ayar') settings[e.key] = clamp(e.value, SETTING_LIMITS[e.key]);
  }
  const scheduler = makeScheduler(settings.retention);

  const cardMap = new Map<string, Card>();
  for (const c of cards) if (!cardMap.has(c.id)) cardMap.set(c.id, c);

  const reviewsByCard = new Map<string, ReviewEvent[]>();
  const reviews: ReviewEvent[] = [];
  const suspended = new Set<string>();
  const flags = new Map<string, string>();
  const readings = new Map<string, ReadingView>();

  for (const e of sorted) {
    switch (e.type) {
      case 'tekrar': {
        reviews.push(e);
        const list = reviewsByCard.get(e.cardId) ?? [];
        list.push(e);
        reviewsByCard.set(e.cardId, list);
        break;
      }
      case 'askiya-al':
        suspended.add(e.cardId);
        break;
      case 'geri-al':
        suspended.delete(e.cardId);
        break;
      case 'isaret':
        flags.set(e.cardId, e.note);
        break;
      case 'isaret-cozuldu':
        flags.delete(e.cardId);
        break;
      case 'okuma': {
        const prev = readings.get(e.reading.id);
        readings.set(e.reading.id, { ...e.reading, cardIds: [], addedTs: prev?.addedTs ?? e.ts });
        break;
      }
      case 'okuma-sil':
        readings.delete(e.readingId);
        break;
      case 'ayar':
        break;
    }
  }

  const states: CardState[] = [];
  for (const card of cardMap.values()) {
    const rs = reviewsByCard.get(card.id) ?? [];
    const curiosity = [...rs].reverse().find((r) => r.curiosity)?.curiosity;
    const fsrsCard = replay(scheduler, rs);
    states.push({
      card,
      fsrs: fsrsCard,
      reviews: rs,
      isNew: rs.length === 0,
      suspended: suspended.has(card.id),
      flag: flags.get(card.id),
      curiosity,
    });
    const rid = card.source?.readingId;
    if (rid && readings.has(rid)) readings.get(rid)!.cardIds.push(card.id);
  }

  const curSum = new Map<Domain, { sum: number; n: number }>();
  for (const s of states) {
    if (!s.curiosity) continue;
    const c = curSum.get(s.card.domain) ?? { sum: 0, n: 0 };
    c.sum += s.curiosity;
    c.n++;
    curSum.set(s.card.domain, c);
  }
  const domainCuriosity: Partial<Record<Domain, number>> = {};
  for (const [d, { sum, n }] of curSum) domainCuriosity[d] = sum / n;

  return {
    states,
    byId: new Map(states.map((s) => [s.card.id, s])),
    reviews,
    readings: [...readings.values()].sort((a, b) => b.date.localeCompare(a.date) || b.addedTs.localeCompare(a.addedTs)),
    settings,
    scheduler,
    domainCuriosity,
  };
}

/** Bugün ilk kez gösterilen (ön testi yapılan) kart sayısı */
export function introducedToday(reviews: ReviewEvent[], now: Date): number {
  const today = localDateKey(now);
  const ids = new Set<string>();
  for (const r of reviews) {
    if (r.phase === 'ontest' && localDateKey(new Date(r.ts)) === today) ids.add(r.cardId);
  }
  return ids.size;
}

export type CardPhase = 'yeni' | 'ogreniliyor' | 'tekrar' | 'olgun';

/** Kartın durumu: olgun = kararlılığı 21 günü aşmış */
export function cardPhase(s: CardState): CardPhase {
  if (s.isNew) return 'yeni';
  if (s.fsrs.state === State.Learning || s.fsrs.state === State.Relearning) return 'ogreniliyor';
  return s.fsrs.stability >= 21 ? 'olgun' : 'tekrar';
}

export const PHASE_LABELS: Record<CardPhase, string> = {
  yeni: 'Yeni',
  ogreniliyor: 'Öğreniliyor',
  tekrar: 'Tekrarda',
  olgun: 'Olgun',
};
