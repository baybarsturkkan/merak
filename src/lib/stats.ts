import { DOMAINS, type Domain, type ReviewEvent } from './schema';
import { cardPhase, type CardState, type Derived, type ReadingView } from './state';
import { addDays, localDateKey, startOfDay, startOfWeek } from './dates';

export interface Rate {
  n: number;
  success: number;
  rate: number | null;
}

function rate(n: number, success: number): Rate {
  return { n, success, rate: n ? success / n : null };
}

/** Hatırlandı sayılan not: Zorlandım, Bildim, Çok kolay */
export const recalled = (r: ReviewEvent) => r.rating >= 2;

/**
 * Gerçek hatırlama oranı: yalnızca hatırlama denemeleri (ön test değil),
 * her kart için o günün ilk denemesi sayılır. "Biliyorum" hissi değil, sonuç.
 */
export function trueRetention(
  reviews: ReviewEvent[],
  since: Date,
  filter: (r: ReviewEvent) => boolean = () => true,
): Rate {
  const seen = new Set<string>();
  let n = 0;
  let ok = 0;
  const from = since.getTime();
  for (const r of reviews) {
    if (r.phase !== 'tekrar' || new Date(r.ts).getTime() < from || !filter(r)) continue;
    const key = `${r.cardId}|${localDateKey(new Date(r.ts))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    n++;
    if (recalled(r)) ok++;
  }
  return rate(n, ok);
}

/** Kalibrasyon: "eminim" dediğinde gerçekte ne kadar doğru çıkıyorsun? */
export function calibration(reviews: ReviewEvent[], since?: Date): Array<{ confidence: 1 | 2 | 3 } & Rate> {
  const from = since?.getTime() ?? 0;
  const acc = { 1: [0, 0], 2: [0, 0], 3: [0, 0] } as Record<1 | 2 | 3, [number, number]>;
  for (const r of reviews) {
    if (!r.confidence || new Date(r.ts).getTime() < from) continue;
    acc[r.confidence][0]++;
    if (recalled(r)) acc[r.confidence][1]++;
  }
  return ([1, 2, 3] as const).map((c) => ({ confidence: c, ...rate(acc[c][0], acc[c][1]) }));
}

export interface DomainRow {
  domain: Domain;
  total: number;
  yeni: number;
  ogreniliyor: number;
  tekrar: number;
  olgun: number;
  suspended: number;
  recall30: Rate;
  curiosity: number | undefined;
}

export function domainBreakdown(d: Derived, now: Date): DomainRow[] {
  const since = addDays(now, -30);
  const domainOf = new Map(d.states.map((s) => [s.card.id, s.card.domain]));
  return DOMAINS.map((domain) => {
    const states = d.states.filter((s) => s.card.domain === domain);
    const row: DomainRow = {
      domain,
      total: states.length,
      yeni: 0,
      ogreniliyor: 0,
      tekrar: 0,
      olgun: 0,
      suspended: 0,
      recall30: trueRetention(d.reviews, since, (r) => domainOf.get(r.cardId) === domain),
      curiosity: d.domainCuriosity[domain],
    };
    for (const s of states) {
      if (s.suspended) row.suspended++;
      row[cardPhase(s)]++;
    }
    return row;
  });
}

/** Önümüzdeki günlerde vadesi gelecek kart sayısı; ilk gün gecikmişleri de içerir */
export function forecast(states: CardState[], now: Date, days = 14): Array<{ date: Date; count: number }> {
  const today = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i), count: 0 }));
  for (const s of states) {
    if (s.isNew || s.suspended) continue;
    const idx = Math.max(0, Math.floor((startOfDay(s.fsrs.due).getTime() - today.getTime()) / 86400000));
    if (idx < days) out[idx].count++;
  }
  return out;
}

/** Emin olup yanıldığın kartlar (en yeniden eskiye, kart başına bir kez) */
export function confidentErrors(reviews: ReviewEvent[], limit = 20): ReviewEvent[] {
  const seen = new Set<string>();
  const out: ReviewEvent[] = [];
  for (let i = reviews.length - 1; i >= 0 && out.length < limit; i--) {
    const r = reviews[i];
    if (r.confidence === 3 && r.rating === 1 && !seen.has(r.cardId)) {
      seen.add(r.cardId);
      out.push(r);
    }
  }
  return out;
}

/** Bugün ya da dün biten, arka arkaya çalışılan gün sayısı */
export function streak(reviews: ReviewEvent[], now: Date): number {
  const days = new Set(reviews.map((r) => localDateKey(new Date(r.ts))));
  let cursor = startOfDay(now);
  if (!days.has(localDateKey(cursor))) cursor = addDays(cursor, -1);
  let n = 0;
  while (days.has(localDateKey(cursor))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function readingsThisWeek(readings: ReadingView[], now: Date): number {
  const from = localDateKey(startOfWeek(now));
  const to = localDateKey(addDays(startOfWeek(now), 6));
  return readings.filter((r) => r.date >= from && r.date <= to).length;
}

export function readingsPerWeek(readings: ReadingView[], now: Date, weeks = 8): Array<{ start: Date; count: number }> {
  const thisWeek = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const from = localDateKey(start);
    const to = localDateKey(addDays(start, 6));
    return { start, count: readings.filter((r) => r.date >= from && r.date <= to).length };
  });
}

/** Günlük tekrar sayıları (son N gün) */
export function reviewsPerDay(reviews: ReviewEvent[], now: Date, days = 14): Array<{ date: Date; count: number }> {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const k = localDateKey(new Date(r.ts));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, count: counts.get(localDateKey(date)) ?? 0 };
  });
}

export function pendingReadings(readings: ReadingView[]): ReadingView[] {
  return readings.filter((r) => r.cardIds.length === 0);
}
