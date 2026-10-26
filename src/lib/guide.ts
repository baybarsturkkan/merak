import { GUIDE_AREAS, LEVELS, type Domain, type Guide, type GuideArea, type GuideItem, type Reading, type SourceKind } from './schema';
import { normalize } from './match';

/** Rehber türünü okuma günlüğünün türlerine çevirir (günlük şeması değişmez) */
export function readingKind(kind: SourceKind): Reading['kind'] {
  switch (kind) {
    case 'kitap':
    case 'makale':
    case 'podcast':
    case 'belgesel':
    case 'video':
      return kind;
    default:
      return 'diger';
  }
}

/** Kaynak günlükte var mı: rehber kimliğiyle ya da aynı başlıkla eklenmiş okuma */
export function findInLog<R extends Pick<Reading, 'title' | 'guideId'>>(item: GuideItem, readings: R[]): R | undefined {
  const t = normalize(item.title);
  return readings.find((r) => r.guideId === item.id || normalize(r.title) === t);
}

export function sortGuides(guides: Guide[]): Guide[] {
  return [...guides].sort((a, b) => GUIDE_AREAS.indexOf(a.area) - GUIDE_AREAS.indexOf(b.area));
}

/** Yol haritasındaki sıraya göre, sonra seviyeye göre sıralanmış kaynaklar */
export function orderedItems(guide: Guide): GuideItem[] {
  const rank = new Map<string, number>();
  guide.path.forEach((step, i) => step.items.forEach((id, j) => rank.has(id) || rank.set(id, i * 100 + j)));
  return [...guide.items].sort(
    (a, b) =>
      (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6) || LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level),
  );
}

/** “Ne okusam?” önerisinde öne çıkan türler: bitirilip günlüğe eklenebilen kaynaklar */
const READABLE = new Set<SourceKind>(['kitap', 'makale', 'podcast', 'belgesel']);

/**
 * Bugün sayfası için tek bir öneri: merakı en yüksek alanın rehberinden,
 * günlükte olmayan ilk başlangıç kaynağı. Merak verisi yoksa "Her alandan" rehberi.
 */
export function suggestItem(
  guides: Guide[],
  readings: Array<Pick<Reading, 'title' | 'guideId'>>,
  curiosity: Partial<Record<Domain, number>>,
): { guide: Guide; item: GuideItem } | undefined {
  const score = (a: GuideArea) => (a === 'genel' ? 0 : (curiosity[a] ?? -1));
  const byInterest = [...guides].sort((a, b) => score(b.area) - score(a.area) || GUIDE_AREAS.indexOf(a.area) - GUIDE_AREAS.indexOf(b.area));
  for (const guide of byInterest) {
    const open = orderedItems(guide).filter((i) => !findInLog(i, readings));
    const item =
      open.find((i) => i.level === 'baslangic' && READABLE.has(i.kind)) ??
      open.find((i) => i.level === 'baslangic') ??
      open[0];
    if (item) return { guide, item };
  }
  return undefined;
}
