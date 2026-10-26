/** Betikler için ortak: veri/ klasörünü okur, durumu hesaplar */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseDeck, parseEvents, type AppEvent, type Card } from '../src/lib/schema';
import { derive, type Derived } from '../src/lib/state';

export const VERI = path.resolve(process.env.MERAK_VERI ?? 'veri');

export function requireVeri(): void {
  if (!existsSync(path.join(VERI, 'kartlar'))) {
    console.error(
      `Veri klasörü bulunamadı: ${VERI}\n` +
        'Özel veri deposunu klonla: git clone https://github.com/<kullanıcı>/merak-veri veri',
    );
    process.exit(1);
  }
}

export function loadVeri(): { cards: Card[]; events: AppEvent[]; data: Derived; problems: string[] } {
  requireVeri();
  const cards: Card[] = [];
  const events: AppEvent[] = [];
  const problems: string[] = [];
  for (const f of readdirSync(path.join(VERI, 'kartlar')).filter((x) => x.endsWith('.json'))) {
    const r = parseDeck(readFileSync(path.join(VERI, 'kartlar', f), 'utf8'));
    cards.push(...r.cards);
    problems.push(...r.errors.map((e) => `kartlar/${f}: ${e}`));
  }
  const kayit = path.join(VERI, 'kayit');
  if (existsSync(kayit)) {
    for (const f of readdirSync(kayit).filter((x) => x.endsWith('.jsonl'))) {
      const r = parseEvents(readFileSync(path.join(kayit, f), 'utf8'));
      events.push(...r.events);
      problems.push(...r.errors.map((e) => `kayit/${f}: ${e}`));
    }
  }
  return { cards, events, data: derive(cards, events), problems };
}
