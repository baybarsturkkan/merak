/**
 * npm run kontrol — veri/kartlar altındaki desteleri denetler.
 * Hata varsa 1 ile çıkar. Claude Code kart ekledikten sonra bunu çalıştırır.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DOMAINS, parseDeck, type Card, type Domain } from '../src/lib/schema';
import { normalize } from '../src/lib/match';

const dir = path.resolve(process.argv[2] ?? 'veri/kartlar');
if (!existsSync(dir)) {
  console.error(`Klasör yok: ${dir}\nVeri deposunu klonla: git clone https://github.com/<kullanıcı>/merak-veri veri`);
  process.exit(1);
}

const errors: string[] = [];
const warnings: string[] = [];
const ids = new Map<string, string>();
const questions = new Map<string, string>();
const rows: Array<{ domain: string; total: number; hangisi: number; next: string }> = [];

// "19. yüzyıl" gibi sıra sayılarındaki nokta cümle sonu sayılmaz
const sentences = (s: string) => s.split(/(?<!\d)[.!?…](?:\s|$)/).filter((x) => x.trim().length > 0).length;

for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const domain = name.replace(/\.json$/, '');
  const file = path.join(dir, name);
  if (!(DOMAINS as readonly string[]).includes(domain)) {
    errors.push(`${name}: bilinmeyen alan. Geçerli alanlar: ${DOMAINS.join(', ')}`);
    continue;
  }
  const { cards, errors: parseErrors } = parseDeck(readFileSync(file, 'utf8'));
  for (const e of parseErrors) errors.push(`${name} ${e}`);

  let maxNum = 0;
  for (const c of cards as Card[]) {
    const where = `${name} ${c.id}`;
    if (c.domain !== (domain as Domain)) errors.push(`${where}: domain "${c.domain}" dosya adıyla uyuşmuyor`);
    if (ids.has(c.id)) errors.push(`${where}: kimlik ${ids.get(c.id)} içinde de var`);
    ids.set(c.id, name);
    maxNum = Math.max(maxNum, Number(c.id.slice(-4)));

    const q = normalize(c.question + ' ' + (c.context ?? ''));
    if (questions.has(q)) errors.push(`${where}: aynı soru ${questions.get(q)} içinde de var`);
    questions.set(q, c.id);

    if (c.type === 'hangisi' && c.accept) warnings.push(`${where}: hangisi kartında accept gereksiz`);
    if (c.type === 'soru' && c.options) errors.push(`${where}: soru kartında options olmamalı`);
    if (!c.context) warnings.push(`${where}: bağlam (context) yok; 1–3 cümlelik bağlam hatırlamayı güçlendirir`);
    if (c.context && sentences(c.context) > 3) warnings.push(`${where}: bağlam 3 cümleden uzun`);
    if (c.context && normalize(c.context).split(' ').length > 70) warnings.push(`${where}: bağlam çok uzun`);
    if (c.answer.length > 60) warnings.push(`${where}: cevap uzun (${c.answer.length} karakter); yazarak cevaplamak zorlaşır`);
    if (c.tags.length === 0) warnings.push(`${where}: etiket yok`);
    if (c.why.length < 40) warnings.push(`${where}: "neden" alanı çok kısa`);
  }
  rows.push({
    domain,
    total: cards.length,
    hangisi: cards.filter((c) => c.type === 'hangisi').length,
    next: `${domain}-${String(maxNum + 1).padStart(4, '0')}`,
  });
}

console.log('\nAlan              Kart  Hangisi  Sıradaki kimlik');
for (const r of rows) {
  console.log(`${r.domain.padEnd(17)} ${String(r.total).padStart(4)}  ${String(r.hangisi).padStart(7)}  ${r.next}`);
}
const total = rows.reduce((a, r) => a + r.total, 0);
console.log(`${'Toplam'.padEnd(17)} ${String(total).padStart(4)}\n`);

if (warnings.length) {
  console.log(`Uyarılar (${warnings.length}):`);
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log('');
}
if (errors.length) {
  console.error(`HATALAR (${errors.length}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('✓ Tüm desteler geçerli.');
