import { describe, expect, it } from 'vitest';
import { findInLog, orderedItems, readingKind, suggestItem } from '../src/lib/guide';
import { parseGuide, type Guide, type GuideItem } from '../src/lib/schema';
import { SyncEngine, memoryKV } from '../src/store/sync';
import { isDataFile, type Store } from '../src/store/types';

function item(id: string, extra: Partial<GuideItem> = {}): GuideItem {
  return {
    id,
    title: `Kaynak ${id}`,
    kind: 'kitap',
    level: 'baslangic',
    lang: 'tr',
    why: 'Bu kaynak test için yazılmış bir açıklamadır.',
    ...extra,
  };
}

function guide(area: Guide['area'], items: GuideItem[], pathIds: string[] = []): Guide {
  return {
    area,
    updatedAt: '2026-10-26',
    intro: 'Bu alana nasıl girileceğini anlatan kısa bir giriş.',
    path: [{ title: 'Başla', text: 'İlk adım', items: pathIds }],
    tips: [],
    items,
  };
}

describe('parseGuide', () => {
  it('geçerli rehberi okur, eksik alanlarda hata verir', () => {
    const g = guide('tarih', [item('tarih-k01')], ['tarih-k01']);
    expect(parseGuide(JSON.stringify(g)).guide?.items).toHaveLength(1);

    const bad = { ...g, items: [{ ...item('tarih-k01'), kind: 'roman' }] };
    expect(parseGuide(JSON.stringify(bad)).errors.length).toBeGreaterThan(0);
    expect(parseGuide('{').errors[0]).toMatch(/JSON/);
  });

  it('kimlik biçimini denetler', () => {
    const g = guide('tarih', [item('tarih-1')]);
    expect(parseGuide(JSON.stringify(g)).guide).toBeUndefined();
  });
});

describe('rehber yardımcıları', () => {
  it('kaynak türünü okuma türüne çevirir', () => {
    expect(readingKind('podcast')).toBe('podcast');
    expect(readingKind('kurs')).toBe('diger');
    expect(readingKind('dergi')).toBe('diger');
  });

  it('günlükteki kaynağı kimlikten ya da başlıktan bulur', () => {
    const it1 = item('tarih-k01', { title: 'İpek Yolu' });
    expect(findInLog(it1, [{ title: 'başka', guideId: 'tarih-k01' }])).toBeTruthy();
    expect(findInLog(it1, [{ title: 'ipek yolu' }])).toBeTruthy();
    expect(findInLog(it1, [{ title: 'İpek' }])).toBeUndefined();
  });

  it('yol haritası sırasını önce koyar', () => {
    const g = guide('tarih', [item('tarih-k01', { level: 'ileri' }), item('tarih-k02'), item('tarih-k03')], ['tarih-k03', 'tarih-k01']);
    expect(orderedItems(g).map((i) => i.id)).toEqual(['tarih-k03', 'tarih-k01', 'tarih-k02']);
  });

  it('merakı en yüksek alandan, günlükte olmayan başlangıç kaynağını önerir', () => {
    const guides = [
      guide('genel', [item('genel-k01')]),
      guide('tarih', [item('tarih-k01')]),
      guide('bilim', [item('bilim-k01', { level: 'orta' }), item('bilim-k02')], ['bilim-k01', 'bilim-k02']),
    ];
    expect(suggestItem(guides, [], {})?.guide.area).toBe('genel');
    const s = suggestItem(guides, [], { bilim: 3, tarih: 2 });
    expect(s?.item.id).toBe('bilim-k02');
    const s2 = suggestItem(guides, [{ title: 'x', guideId: 'bilim-k02' }, { title: 'y', guideId: 'bilim-k01' }], { bilim: 3, tarih: 2 });
    expect(s2?.item.id).toBe('tarih-k01');
  });

  it('öneride site ve kurs yerine kitabı öne alır', () => {
    const g = guide('cografya', [item('cografya-k01', { kind: 'site' }), item('cografya-k02')], ['cografya-k01', 'cografya-k02']);
    expect(suggestItem([g], [], { cografya: 3 })?.item.id).toBe('cografya-k02');
  });
});

describe('senkron', () => {
  it('rehber dosyalarını veri dosyası sayar ve anlık görüntüye koyar', async () => {
    expect(isDataFile('rehber/tarih.json')).toBe(true);
    expect(isDataFile('rehber/alt/tarih.json')).toBe(false);

    const g = guide('tarih', [item('tarih-k01')]);
    const files = new Map([
      ['rehber/tarih.json', JSON.stringify(g)],
      ['rehber/bilim.json', '{ bozuk'],
    ]);
    const store: Store = {
      kind: 'local',
      id: 'test',
      list: async () => [...files.keys()].map((path) => ({ path, sha: path })),
      read: async (f) => files.get(f.path)!,
      append: async () => ({ sha: 'x', content: '' }),
    };
    const engine = new SyncEngine(store, 'test', memoryKV());
    await engine.init();
    await engine.sync();
    const snap = engine.snapshot();
    expect(snap.guides.map((x) => x.area)).toEqual(['tarih']);
    expect(snap.problems.some((p) => p.startsWith('rehber/bilim.json'))).toBe(true);
  });
});
