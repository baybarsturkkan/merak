import type { AppEvent, Card, Domain, ReviewEvent } from '../src/lib/schema';

let seq = 0;

export function card(id: string, extra: Partial<Card> = {}): Card {
  const domain = (extra.domain ?? id.replace(/-\d{4}$/, '')) as Domain;
  return {
    id,
    type: 'soru',
    domain,
    tags: [],
    question: `Soru ${id}?`,
    answer: `Cevap ${id}`,
    why: 'Çünkü bu bir test kartı.',
    createdAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'seed',
    ...extra,
  };
}

export function review(cardId: string, ts: string, rating: 1 | 2 | 3 | 4, extra: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: `ev${String(++seq).padStart(6, '0')}`,
    ts,
    device: 'test',
    type: 'tekrar',
    cardId,
    rating,
    phase: 'tekrar',
    ...extra,
  };
}

export function ev<T extends AppEvent['type']>(type: T, ts: string, fields: Record<string, unknown>): AppEvent {
  return { id: `ev${String(++seq).padStart(6, '0')}`, ts, device: 'test', type, ...fields } as AppEvent;
}
