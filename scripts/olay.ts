/**
 * npm run olay — Claude Code'un olay günlüğüne kayıt eklemesi için.
 * id, ts ve device ("claude") otomatik eklenir; olay şemaya göre doğrulanır.
 *
 *   npm run olay -- '{"type":"okuma","reading":{"id":"okuma-kozmos","title":"Kozmos","kind":"kitap","date":"2026-10-26"}}'
 *   npm run olay -- '{"type":"isaret-cozuldu","cardId":"tarih-0003","note":"tarih düzeltildi"}'
 *   npm run olay -- --dosya olaylar.json      (tek olay ya da dizi)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { EventSchema, eventFilePath } from '../src/lib/schema';
import { newId } from '../src/lib/dates';
import { VERI, requireVeri } from './veri';

requireVeri();
const args = process.argv.slice(2);
const fi = args.indexOf('--dosya');
const raw = fi >= 0 ? readFileSync(args[fi + 1], 'utf8') : args.join(' ');
if (!raw.trim()) {
  console.error('Olay JSON’u ver: npm run olay -- \'{"type":"okuma", ...}\'');
  process.exit(1);
}

let input: unknown;
try {
  input = JSON.parse(raw);
} catch (e) {
  console.error(`JSON okunamadı: ${(e as Error).message}`);
  process.exit(1);
}

const items = Array.isArray(input) ? input : [input];
const lines: string[] = [];
let file = '';
for (const item of items) {
  const event = { id: newId(), ts: new Date().toISOString(), device: 'claude', ...(item as object) };
  const r = EventSchema.safeParse(event);
  if (!r.success) {
    console.error(`Geçersiz olay: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    process.exit(1);
  }
  file = eventFilePath(r.data.ts, 'claude');
  lines.push(JSON.stringify(r.data));
}

const target = path.join(VERI, file);
mkdirSync(path.dirname(target), { recursive: true });
const needsNewline = existsSync(target) && !readFileSync(target, 'utf8').endsWith('\n') && readFileSync(target, 'utf8').length > 0;
appendFileSync(target, `${needsNewline ? '\n' : ''}${lines.join('\n')}\n`, 'utf8');
console.log(`✓ ${lines.length} olay eklendi → ${path.relative(process.cwd(), target)}`);
