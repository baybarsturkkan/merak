import { z } from 'zod';

/** Kartların ait olduğu alanlar. Dosya adları da bunlardır: kartlar/<alan>.json */
export const DOMAINS = [
  'tarih',
  'siyaset-toplum',
  'bilim',
  'teknoloji',
  'sanat',
  'edebiyat',
  'muzik-sinema',
  'cografya',
  'felsefe',
  'ekonomi',
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  tarih: 'Tarih',
  'siyaset-toplum': 'Siyaset ve toplum',
  bilim: 'Bilim',
  teknoloji: 'Teknoloji',
  sanat: 'Sanat',
  edebiyat: 'Edebiyat',
  'muzik-sinema': 'Müzik ve sinema',
  cografya: 'Coğrafya',
  felsefe: 'Felsefe',
  ekonomi: 'Ekonomi',
};

export const CardSchema = z
  .object({
    id: z.string().regex(/^[a-z]+(-[a-z]+)*-\d{4}$/, 'id biçimi: <alan>-0001'),
    type: z.enum(['soru', 'hangisi']),
    domain: z.enum(DOMAINS),
    tags: z.array(z.string()).default([]),
    /** Soruyla birlikte gösterilen 1–3 cümlelik bağlam */
    context: z.string().optional(),
    question: z.string().min(5),
    answer: z.string().min(1),
    /** Yazılan cevabı kontrol ederken kabul edilen başka yazımlar */
    accept: z.array(z.string()).optional(),
    /** "Neden?" alanı: bilginin neden doğru olduğu ya da neden önemli olduğu */
    why: z.string().min(10),
    /** Yalnızca "hangisi" kartlarında: 2–4 seçenek, cevap bunlardan biri */
    options: z.array(z.string()).min(2).max(4).optional(),
    source: z
      .object({
        readingId: z.string().optional(),
        ref: z.string().optional(),
      })
      .optional(),
    createdAt: z.string(),
    createdBy: z.enum(['seed', 'claude', 'kullanici']),
  })
  .superRefine((c, ctx) => {
    if (!c.id.startsWith(`${c.domain}-`)) {
      ctx.addIssue({ code: 'custom', message: `id "${c.id}" alan adıyla (${c.domain}) başlamalı` });
    }
    if (c.type === 'hangisi') {
      if (!c.options) {
        ctx.addIssue({ code: 'custom', message: 'hangisi kartında options zorunlu' });
      } else if (!c.options.includes(c.answer)) {
        ctx.addIssue({ code: 'custom', message: 'hangisi kartında answer, options içinde olmalı' });
      }
    }
  });

export type Card = z.infer<typeof CardSchema>;

export const DeckFileSchema = z.array(CardSchema);

/* ---------- Olaylar (kayit/<YYYY-MM>-<cihaz>.jsonl) ---------- */

const base = {
  id: z.string().min(6),
  ts: z.string(), // ISO 8601
  device: z.string(),
};

export const Grade = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const OneToThree = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const ReviewEventSchema = z.object({
  ...base,
  type: z.literal('tekrar'),
  cardId: z.string(),
  /** FSRS notu: 1 Bilemedim, 2 Zorlandım, 3 Bildim, 4 Çok kolay */
  rating: Grade,
  /** ontest: kartın ilk gösterimi (önce tahmin), tekrar: hatırlama denemesi */
  phase: z.enum(['ontest', 'tekrar']),
  /** Cevaptan önce verilen güven: 1 tahmin, 2 sanırım, 3 eminim */
  confidence: OneToThree.optional(),
  /** Soruyu görünce verilen merak puanı */
  curiosity: OneToThree.optional(),
  typed: z.string().optional(),
  ms: z.number().optional(),
});

export const ReadingSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  author: z.string().optional(),
  kind: z.enum(['kitap', 'makale', 'podcast', 'belgesel', 'video', 'diger']),
  url: z.string().optional(),
  /** YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export type Reading = z.infer<typeof ReadingSchema>;

export const SETTING_KEYS = ['retention', 'newPerDay', 'weeklyReadingGoal'] as const;

export const EventSchema = z.discriminatedUnion('type', [
  ReviewEventSchema,
  z.object({ ...base, type: z.literal('isaret'), cardId: z.string(), note: z.string() }),
  z.object({ ...base, type: z.literal('isaret-cozuldu'), cardId: z.string(), note: z.string().optional() }),
  z.object({ ...base, type: z.literal('askiya-al'), cardId: z.string() }),
  z.object({ ...base, type: z.literal('geri-al'), cardId: z.string() }),
  z.object({ ...base, type: z.literal('okuma'), reading: ReadingSchema }),
  z.object({ ...base, type: z.literal('okuma-sil'), readingId: z.string() }),
  z.object({ ...base, type: z.literal('ayar'), key: z.enum(SETTING_KEYS), value: z.number() }),
]);

export type AppEvent = z.infer<typeof EventSchema>;
export type ReviewEvent = z.infer<typeof ReviewEventSchema>;
export type EventType = AppEvent['type'];

/** Olayı id/ts/device olmadan tarif eden yardımcı tip */
export type EventInput = AppEvent extends infer E
  ? E extends AppEvent
    ? Omit<E, 'id' | 'ts' | 'device'>
    : never
  : never;

export interface Settings {
  retention: number;
  newPerDay: number;
  weeklyReadingGoal: number;
}

export const DEFAULT_SETTINGS: Settings = {
  retention: 0.9,
  newPerDay: 10,
  weeklyReadingGoal: 3,
};

export const SETTING_LIMITS: Record<keyof Settings, [number, number]> = {
  retention: [0.8, 0.97],
  newPerDay: [0, 50],
  weeklyReadingGoal: [0, 30],
};

/** Olay günlüğü dosya adı: kayit/2026-10-telefon.jsonl */
export function eventFilePath(ts: string, device: string): string {
  return `kayit/${ts.slice(0, 7)}-${device}.jsonl`;
}

export function slugDevice(name: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return (
    name
      .toLocaleLowerCase('tr-TR')
      .replace(/[çğıöşü]/g, (ch) => map[ch] ?? ch)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'cihaz'
  );
}

/** Kart dosyalarını ve olay dosyalarını ayrıştırır; bozuk satırları atlayıp sayar. */
export function parseDeck(text: string): { cards: Card[]; errors: string[] } {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { cards: [], errors: [`JSON okunamadı: ${(e as Error).message}`] };
  }
  if (!Array.isArray(raw)) return { cards: [], errors: ['Kart dosyası bir dizi olmalı'] };
  const cards: Card[] = [];
  raw.forEach((item, i) => {
    const r = CardSchema.safeParse(item);
    if (r.success) cards.push(r.data);
    else errors.push(`#${i} (${(item as { id?: string })?.id ?? '?'}): ${r.error.issues.map((x) => x.message).join('; ')}`);
  });
  return { cards, errors };
}

export function parseEvents(text: string): { events: AppEvent[]; errors: string[] } {
  const events: AppEvent[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const r = EventSchema.safeParse(JSON.parse(line));
      if (r.success) events.push(r.data);
      else errors.push(`satır ${i + 1}: ${r.error.issues.map((x) => x.message).join('; ')}`);
    } catch {
      errors.push(`satır ${i + 1}: JSON okunamadı`);
    }
  });
  return { events, errors };
}
