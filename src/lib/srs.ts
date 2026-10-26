import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  State,
  type Card as FsrsCard,
  type FSRS,
  type Grade as FsrsGrade,
} from 'ts-fsrs';
import type { Domain, ReviewEvent } from './schema';
import type { CardState } from './state';
import { formatInterval } from './dates';

export { State };
export type { FsrsCard, FSRS };

export function makeScheduler(retention: number): FSRS {
  return fsrs(
    generatorParameters({
      request_retention: retention,
      enable_fuzz: true,
      enable_short_term: true,
    }),
  );
}

/**
 * Bir kartın tüm tekrarlarını zaman sırasıyla FSRS'ten geçirir.
 * Durum dosyada tutulmaz; her yüklemede olaylardan yeniden hesaplanır.
 */
export function replay(f: FSRS, reviews: ReviewEvent[]): FsrsCard {
  if (reviews.length === 0) return createEmptyCard(new Date(0));
  let card = createEmptyCard(new Date(reviews[0].ts));
  let last = 0;
  for (const r of reviews) {
    // Cihaz saatleri farklıysa geriye giden zamanı ileri al
    const t = Math.max(new Date(r.ts).getTime(), last);
    last = t;
    card = f.next(card, new Date(t), r.rating as FsrsGrade).card;
  }
  return card;
}

/** Not düğmelerinde gösterilecek sonraki aralıklar */
export function previewIntervals(f: FSRS, card: FsrsCard, now: Date): Record<1 | 2 | 3 | 4, string> {
  const p = f.repeat(card, now);
  const out = {} as Record<1 | 2 | 3 | 4, string>;
  for (const g of [1, 2, 3, 4] as const) {
    out[g] = formatInterval(p[g as FsrsGrade].card.due.getTime() - now.getTime());
  }
  return out;
}

/** Tekrarlanabilir rastgelelik (testler ve kararlı oturumlar için) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Merakı yüksek alanlara giden yeni kart oranı; kalanı keşif (genişlik korunur) */
export const CURIOSITY_SHARE = 0.7;

/**
 * Yeni kart seçimi:
 * 1. Okumalardan çıkarılan kartlar önce gelir (kendi okuduğun şey).
 * 2. Kalan yerlerin yaklaşık %70'i merak puanına göre ağırlıklı (ağırlık = merak²),
 *    %30'u alanlar arasında eşit olasılıkla seçilir.
 * Alan içinde deste sırası korunur.
 */
export function pickNewCards(
  candidates: CardState[],
  n: number,
  domainCuriosity: Partial<Record<Domain, number>>,
  rng: () => number,
): CardState[] {
  if (n <= 0) return [];
  const order = (a: CardState, b: CardState) =>
    a.card.createdAt.localeCompare(b.card.createdAt) || a.card.id.localeCompare(b.card.id);

  const fromReadings = candidates.filter((s) => s.card.source?.readingId).sort(order);
  const picked = fromReadings.slice(0, n);
  if (picked.length >= n) return picked;

  const pools = new Map<Domain, CardState[]>();
  for (const s of candidates.filter((c) => !c.card.source?.readingId).sort(order)) {
    const list = pools.get(s.card.domain) ?? [];
    list.push(s);
    pools.set(s.card.domain, list);
  }

  while (picked.length < n && pools.size > 0) {
    const domains = [...pools.keys()];
    let chosen: Domain;
    if (rng() < CURIOSITY_SHARE) {
      const weights = domains.map((d) => (domainCuriosity[d] ?? 2) ** 2);
      const total = weights.reduce((a, b) => a + b, 0);
      let x = rng() * total;
      let i = 0;
      while (i < domains.length - 1 && x >= weights[i]) {
        x -= weights[i];
        i++;
      }
      chosen = domains[i];
    } else {
      chosen = domains[Math.floor(rng() * domains.length)];
    }
    const pool = pools.get(chosen)!;
    picked.push(pool.shift()!);
    if (pool.length === 0) pools.delete(chosen);
  }
  return picked;
}

/**
 * Karma çalışma: aynı alandan iki kart art arda gelmesin.
 * Her adımda, bir öncekinden farklı alandaki en öndeki öğe seçilir.
 */
export function interleave<T>(items: T[], key: (t: T) => string): T[] {
  const rest = [...items];
  const out: T[] = [];
  while (rest.length) {
    const prev = out.length ? key(out[out.length - 1]) : null;
    let idx = rest.findIndex((it) => key(it) !== prev);
    if (idx === -1) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

export interface QueueItem {
  cardId: string;
  domain: Domain;
  isNew: boolean;
}

export interface SessionOptions {
  now: Date;
  /** Bugün için kalan yeni kart hakkı */
  newRemaining: number;
  reviewLimit?: number;
  domainCuriosity: Partial<Record<Domain, number>>;
  rng: () => number;
}

/** Bugünkü oturum: vadesi gelen tekrarlar + merak ağırlıklı yeni kartlar, alanlar karışık */
export function buildSession(states: CardState[], opts: SessionOptions): QueueItem[] {
  const now = opts.now.getTime();
  const due = states
    .filter((s) => !s.isNew && !s.suspended && s.fsrs.due.getTime() <= now)
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime())
    .slice(0, opts.reviewLimit ?? 200);
  const fresh = pickNewCards(
    states.filter((s) => s.isNew && !s.suspended),
    opts.newRemaining,
    opts.domainCuriosity,
    opts.rng,
  );

  const toItem = (s: CardState): QueueItem => ({ cardId: s.card.id, domain: s.card.domain, isNew: s.isNew });
  const reviews = due.map(toItem);
  const news = fresh.map(toItem);

  // Yeni kartları tekrarların arasına eşit aralıklarla yerleştir
  const total = reviews.length + news.length;
  const newSlots = new Set(news.map((_, k) => Math.floor(((k + 0.5) * total) / news.length)));
  const merged: QueueItem[] = [];
  let r = 0;
  let n = 0;
  for (let i = 0; i < total; i++) {
    merged.push(newSlots.has(i) ? news[n++] : reviews[r++]);
  }
  return interleave(merged, (q) => q.domain);
}

/** "Bilemedim" denen kartı birkaç kart sonra yeniden sıraya ekler */
export function requeue<T>(queue: T[], currentIndex: number, item: T, gap: number): T[] {
  const q = [...queue];
  const pos = Math.min(q.length, currentIndex + 1 + gap);
  q.splice(pos, 0, item);
  return q;
}

/** Normal hata için ara, emin olunan hata için daha kısa ara */
export const REQUEUE_GAP = { normal: 4, confidentError: 2 } as const;
export const MAX_REPEATS_PER_SESSION = 3;
