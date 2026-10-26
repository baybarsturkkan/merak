import { describe, expect, it } from 'vitest';
import { derive, introducedToday, cardPhase } from '../src/lib/state';
import {
  buildSession,
  interleave,
  makeScheduler,
  mulberry32,
  pickNewCards,
  replay,
  requeue,
  State,
} from '../src/lib/srs';
import { matchAnswer, normalize } from '../src/lib/match';
import { calibration, confidentErrors, forecast, streak, trueRetention } from '../src/lib/stats';
import { CardSchema, eventFilePath, parseEvents, slugDevice } from '../src/lib/schema';
import { card, ev, review } from './helpers';

describe('FSRS yeniden oynatma', () => {
  it('tekrarı olmayan kart yenidir', () => {
    const d = derive([card('tarih-0001')], []);
    expect(d.states[0].isNew).toBe(true);
    expect(d.states[0].fsrs.state).toBe(State.New);
  });

  it('art arda "Bildim" kartı tekrara geçirir ve aralığı büyütür', () => {
    const f = makeScheduler(0.9);
    const c1 = replay(f, [review('x', '2026-10-01T10:00:00Z', 3)]);
    expect(c1.state).toBe(State.Learning);
    const c3 = replay(f, [
      review('x', '2026-10-01T10:00:00Z', 3),
      review('x', '2026-10-01T10:15:00Z', 3),
      review('x', '2026-10-05T10:00:00Z', 3),
    ]);
    expect(c3.state).toBe(State.Review);
    expect(c3.due.getTime()).toBeGreaterThan(new Date('2026-10-08T00:00:00Z').getTime());
  });

  it('aynı girdiyle her zaman aynı sonucu verir', () => {
    const rs = [review('x', '2026-10-01T10:00:00Z', 3), review('x', '2026-10-03T10:00:00Z', 4)];
    const a = replay(makeScheduler(0.9), rs);
    const b = replay(makeScheduler(0.9), rs);
    expect(a.due.toISOString()).toBe(b.due.toISOString());
  });

  it('"Bilemedim" sonrası kart yeniden öğrenmeye düşer', () => {
    const f = makeScheduler(0.9);
    const c = replay(f, [
      review('x', '2026-10-01T10:00:00Z', 3),
      review('x', '2026-10-01T10:15:00Z', 3),
      review('x', '2026-10-10T10:00:00Z', 1),
    ]);
    expect(c.state).toBe(State.Relearning);
    expect(c.lapses).toBe(1);
  });
});

describe('olaylardan durum', () => {
  it('iki cihazdan gelen olayları id ile birleştirir, sırayı zamana göre kurar', () => {
    const a = review('tarih-0001', '2026-10-01T10:00:00Z', 3, { device: 'telefon' });
    const b = review('tarih-0001', '2026-10-02T10:00:00Z', 3, { device: 'laptop' });
    const d = derive([card('tarih-0001')], [b, a, a]);
    expect(d.reviews.map((r) => r.id)).toEqual([a.id, b.id]);
    expect(d.states[0].reviews).toHaveLength(2);
  });

  it('askıya alma, işaret, okuma ve ayar olaylarını uygular', () => {
    const cards = [
      card('bilim-0001'),
      card('bilim-0002', { source: { readingId: 'r1' } }),
    ];
    const events = [
      ev('askiya-al', '2026-10-01T00:00:00Z', { cardId: 'bilim-0001' }),
      ev('isaret', '2026-10-01T00:01:00Z', { cardId: 'bilim-0002', note: 'tarih yanlış' }),
      ev('okuma', '2026-10-01T00:02:00Z', {
        reading: { id: 'r1', title: 'Kozmos', kind: 'kitap', date: '2026-10-01' },
      }),
      ev('okuma', '2026-10-01T00:03:00Z', {
        reading: { id: 'r2', title: 'Silinecek', kind: 'makale', date: '2026-10-01' },
      }),
      ev('okuma-sil', '2026-10-01T00:04:00Z', { readingId: 'r2' }),
      ev('ayar', '2026-10-01T00:05:00Z', { key: 'retention', value: 0.99 }),
      ev('ayar', '2026-10-01T00:06:00Z', { key: 'newPerDay', value: 15 }),
    ];
    const d = derive(cards, events);
    expect(d.byId.get('bilim-0001')!.suspended).toBe(true);
    expect(d.byId.get('bilim-0002')!.flag).toBe('tarih yanlış');
    expect(d.readings.map((r) => r.id)).toEqual(['r1']);
    expect(d.readings[0].cardIds).toEqual(['bilim-0002']);
    expect(d.settings.retention).toBe(0.97); // üst sınıra kırpılır
    expect(d.settings.newPerDay).toBe(15);
  });

  it('alan merakını ön test puanlarının ortalamasından hesaplar', () => {
    const d = derive(
      [card('sanat-0001'), card('sanat-0002'), card('tarih-0001')],
      [
        review('sanat-0001', '2026-10-01T10:00:00Z', 3, { phase: 'ontest', curiosity: 3 }),
        review('sanat-0002', '2026-10-01T10:01:00Z', 3, { phase: 'ontest', curiosity: 2 }),
        review('tarih-0001', '2026-10-01T10:02:00Z', 3, { phase: 'ontest', curiosity: 1 }),
      ],
    );
    expect(d.domainCuriosity.sanat).toBe(2.5);
    expect(d.domainCuriosity.tarih).toBe(1);
  });

  it('bugün tanıtılan yeni kartları sayar', () => {
    const now = new Date();
    const rs = [
      review('a', now.toISOString(), 3, { phase: 'ontest' }),
      review('a', now.toISOString(), 3, { phase: 'tekrar' }),
      review('b', '2020-01-01T00:00:00Z', 3, { phase: 'ontest' }),
    ];
    expect(introducedToday(rs, now)).toBe(1);
  });
});

describe('oturum', () => {
  const domains = ['tarih', 'bilim', 'sanat', 'felsefe'];
  const cards = domains.flatMap((d) => [1, 2, 3, 4, 5].map((i) => card(`${d}-000${i}`)));

  it('karma çalışma: mümkünse aynı alandan iki kart art arda gelmez', () => {
    const items = ['a', 'a', 'a', 'b', 'b', 'c', 'c', 'a'];
    const out = interleave(items, (x) => x);
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
  });

  it('vadesi gelenleri ve yeni kart hakkını birleştirir', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const events = [
      review('tarih-0001', '2026-10-01T10:00:00Z', 3, { phase: 'ontest' }),
      review('bilim-0001', '2026-10-01T10:00:00Z', 3, { phase: 'ontest' }),
    ];
    const d = derive(cards, events);
    const q = buildSession(d.states, {
      now,
      newRemaining: 4,
      domainCuriosity: {},
      rng: mulberry32(1),
    });
    expect(q.filter((x) => !x.isNew).map((x) => x.cardId).sort()).toEqual(['bilim-0001', 'tarih-0001']);
    expect(q.filter((x) => x.isNew)).toHaveLength(4);
    for (let i = 1; i < q.length; i++) expect(q[i].domain).not.toBe(q[i - 1].domain);
  });

  it('askıdaki kartları oturuma almaz', () => {
    const d = derive([card('tarih-0001')], [ev('askiya-al', '2026-10-01T00:00:00Z', { cardId: 'tarih-0001' })]);
    expect(buildSession(d.states, { now: new Date(), newRemaining: 5, domainCuriosity: {}, rng: mulberry32(1) })).toEqual([]);
  });

  it('okumadan çıkan kartlar yeni kart seçiminde önce gelir', () => {
    const withReading = [...cards, card('ekonomi-0001', { source: { readingId: 'r1' }, createdAt: '2026-10-15T00:00:00Z' })];
    const d = derive(withReading, []);
    const picked = pickNewCards(d.states.filter((s) => s.isNew), 3, {}, mulberry32(7));
    expect(picked[0].card.id).toBe('ekonomi-0001');
  });

  it('merakı yüksek alan daha sık seçilir ama diğer alanlar da gelir', () => {
    const many = domains.flatMap((d) => Array.from({ length: 300 }, (_, i) => card(`${d}-${String(i + 1).padStart(4, '0')}`)));
    const d = derive(many, []);
    const picked = pickNewCards(d.states, 400, { sanat: 3, tarih: 1, bilim: 1, felsefe: 1 }, mulberry32(42));
    const count = (dom: string) => picked.filter((s) => s.card.domain === dom).length;
    // Beklenen pay: 0.7 * 9/12 + 0.3 * 1/4 ≈ %60
    expect(count('sanat') / 400).toBeGreaterThan(0.5);
    expect(count('tarih')).toBeGreaterThan(20);
    expect(count('felsefe')).toBeGreaterThan(20);
  });

  it('"Bilemedim" denen kartı birkaç kart sonraya ekler', () => {
    expect(requeue(['a', 'b', 'c', 'd', 'e'], 0, 'a', 2)).toEqual(['a', 'b', 'c', 'a', 'd', 'e']);
    expect(requeue(['a', 'b'], 1, 'b', 4)).toEqual(['a', 'b', 'b']);
  });
});

describe('cevap eşleştirme', () => {
  it('Türkçe büyük/küçük harf ve aksanları katlar', () => {
    expect(normalize('İSTANBUL')).toBe('istanbul');
    expect(normalize('Işık')).toBe('isik');
    expect(normalize('  Çağdaş  Şiir! ')).toBe('cagdas siir');
  });

  it('tam, yakın, farklı ve boş sonuçlarını verir', () => {
    expect(matchAnswer('istanbul', 'İstanbul')).toBe('tam');
    expect(matchAnswer('Mustafa Kemal', 'Mustafa Kemal (Atatürk)')).toBe('tam');
    expect(matchAnswer('Dostoyevski', 'Dostoyevskiy')).toBe('yakin');
    expect(matchAnswer('sanırım 1453 yılında', '1453')).toBe('yakin');
    expect(matchAnswer('1071', '1453')).toBe('farkli');
    expect(matchAnswer('Paris', 'Londra')).toBe('farkli');
    expect(matchAnswer('   ', 'Londra')).toBe('bos');
    expect(matchAnswer('ottoman', 'Osmanlı', ['Ottoman'])).toBe('tam');
  });

  it('kısa cevaplarda yazım hatasını kabul etmez', () => {
    expect(matchAnswer('1454', '1453')).toBe('farkli');
  });
});

describe('istatistik', () => {
  it('gerçek hatırlama oranı yalnızca günün ilk hatırlama denemesini sayar', () => {
    const rs = [
      review('a', '2026-10-10T09:00:00Z', 1),
      review('a', '2026-10-10T09:05:00Z', 3), // aynı gün ikinci deneme: sayılmaz
      review('b', '2026-10-10T09:00:00Z', 3),
      review('c', '2026-10-10T09:00:00Z', 3, { phase: 'ontest' }), // ön test: sayılmaz
    ];
    const r = trueRetention(rs, new Date('2026-10-01T00:00:00Z'));
    expect(r.n).toBe(2);
    expect(r.rate).toBe(0.5);
  });

  it('kalibrasyon güven düzeyine göre doğruluğu hesaplar', () => {
    const rs = [
      review('a', '2026-10-10T09:00:00Z', 3, { confidence: 3 }),
      review('b', '2026-10-10T09:00:00Z', 1, { confidence: 3 }),
      review('c', '2026-10-10T09:00:00Z', 1, { confidence: 1 }),
    ];
    const cal = calibration(rs);
    expect(cal[2]).toMatchObject({ confidence: 3, n: 2, rate: 0.5 });
    expect(cal[0]).toMatchObject({ confidence: 1, n: 1, rate: 0 });
    expect(cal[1].rate).toBeNull();
  });

  it('emin olunan hataları kart başına bir kez listeler', () => {
    const rs = [
      review('a', '2026-10-10T09:00:00Z', 1, { confidence: 3 }),
      review('a', '2026-10-11T09:00:00Z', 1, { confidence: 3 }),
      review('b', '2026-10-11T09:00:00Z', 1, { confidence: 2 }),
    ];
    expect(confidentErrors(rs).map((r) => r.cardId)).toEqual(['a']);
  });

  it('seri bugün çalışılmadıysa dünden geriye sayar', () => {
    const now = new Date(2026, 9, 20, 12);
    const at = (day: number) => new Date(2026, 9, day, 10).toISOString();
    expect(streak([review('a', at(17), 3), review('a', at(18), 3), review('a', at(19), 3)], now)).toBe(3);
    expect(streak([review('a', at(17), 3)], now)).toBe(0);
  });

  it('tahmin, gecikmiş kartları bugüne koyar', () => {
    const d = derive([card('tarih-0001')], [review('tarih-0001', '2026-01-01T10:00:00Z', 3)]);
    const fc = forecast(d.states, new Date('2026-10-20T12:00:00Z'));
    expect(fc[0].count).toBe(1);
    expect(cardPhase(d.states[0])).toBe('ogreniliyor');
  });
});

describe('şema', () => {
  it('hangisi kartında cevap seçeneklerde olmalı', () => {
    const bad = CardSchema.safeParse(card('sanat-0001', { type: 'hangisi', options: ['A', 'B'], answer: 'C' }));
    expect(bad.success).toBe(false);
    const good = CardSchema.safeParse(card('sanat-0001', { type: 'hangisi', options: ['A', 'B'], answer: 'B' }));
    expect(good.success).toBe(true);
  });

  it('id alan adıyla başlamalı', () => {
    expect(CardSchema.safeParse(card('tarih-0001', { domain: 'bilim' })).success).toBe(false);
    expect(CardSchema.safeParse(card('siyaset-toplum-0001')).success).toBe(true);
  });

  it('bozuk olay satırlarını atlar', () => {
    const good = JSON.stringify(review('a', '2026-10-10T09:00:00Z', 3));
    const { events, errors } = parseEvents(`${good}\n{bozuk\n{"type":"yok"}\n`);
    expect(events).toHaveLength(1);
    expect(errors).toHaveLength(2);
  });

  it('dosya adı ve cihaz adı', () => {
    expect(slugDevice('Baybars Telefonu')).toBe('baybars-telefonu');
    expect(slugDevice('İş Bilgisayarı')).toBe('is-bilgisayari');
    expect(eventFilePath('2026-10-26T10:00:00Z', 'telefon')).toBe('kayit/2026-10-telefon.jsonl');
  });
});
