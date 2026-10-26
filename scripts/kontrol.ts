/**
 * npm run kontrol — veri/kartlar altındaki desteleri ve veri/rehber altındaki rehberleri denetler.
 * Hata varsa 1 ile çıkar. Claude Code kart ekledikten sonra bunu çalıştırır.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DOMAINS, GUIDE_AREAS, parseDeck, parseGuide, type Card, type Domain } from '../src/lib/schema';
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
const rows: Array<{ domain: string; total: number; hangisi: number; gorsel: number; next: string }> = [];

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
    if (c.image) {
      const img = c.image;
      if (img.alt.startsWith('<')) errors.push(`${where}: görselin alt metni yazılmamış`);
      if (img.show === 'soru') {
        const ans = normalize(c.answer);
        if (ans.length > 2 && normalize(img.alt).includes(ans)) {
          warnings.push(`${where}: görsel soruyla geliyor ama alt metni cevabı içeriyor`);
        }
        if (c.context && ans.length > 2 && normalize(c.context).includes(ans)) {
          warnings.push(`${where}: tanıma kartının bağlamı cevabı içeriyor`);
        }
        if (!/(^|[\s“"])(bu|şu|buradaki|görseldeki|resimdeki|fotoğraftaki|tablodaki)(?=[\s,?’'”]|$)/i.test(c.question)) {
          warnings.push(`${where}: görsel soruyla geliyor ama soru görsele değinmiyor (“Bu tablo…”, “Bu yapı…”)`);
        }
      }
    }
  }
  rows.push({
    domain,
    total: cards.length,
    hangisi: cards.filter((c) => c.type === 'hangisi').length,
    gorsel: cards.filter((c) => c.image).length,
    next: `${domain}-${String(maxNum + 1).padStart(4, '0')}`,
  });
}

// ---------- Rehberler ----------
const guideDir = path.join(path.dirname(dir), 'rehber');
const guideRows: Array<{ area: string; items: number; steps: number; tr: number; next: string }> = [];
if (existsSync(guideDir)) {
  const guideIds = new Map<string, string>();
  for (const name of readdirSync(guideDir).filter((f) => f.endsWith('.json')).sort()) {
    const area = name.replace(/\.json$/, '');
    const where = `rehber/${name}`;
    if (!(GUIDE_AREAS as readonly string[]).includes(area)) {
      errors.push(`${where}: bilinmeyen alan. Geçerli: ${GUIDE_AREAS.join(', ')}`);
      continue;
    }
    const { guide, errors: ge } = parseGuide(readFileSync(path.join(guideDir, name), 'utf8'));
    for (const e of ge) errors.push(`${where} ${e}`);
    if (!guide) continue;
    if (guide.area !== area) errors.push(`${where}: area "${guide.area}" dosya adıyla uyuşmuyor`);
    const local = new Set<string>();
    const titles = new Set<string>();
    let maxNum = 0;
    for (const it of guide.items) {
      if (!it.id.startsWith(`${area}-k`)) errors.push(`${where} ${it.id}: kimlik "${area}-k" ile başlamalı`);
      if (guideIds.has(it.id)) errors.push(`${where} ${it.id}: kimlik ${guideIds.get(it.id)} içinde de var`);
      guideIds.set(it.id, name);
      local.add(it.id);
      maxNum = Math.max(maxNum, Number(it.id.split('-k').pop()));
      const t = normalize(it.title);
      if (titles.has(t)) errors.push(`${where} ${it.id}: aynı başlık iki kez`);
      titles.add(t);
      if (it.why.length > 420) warnings.push(`${where} ${it.id}: "why" uzun (${it.why.length} karakter)`);
      if (it.free && !it.url) warnings.push(`${where} ${it.id}: ücretsiz kaynak için bağlantı yok`);
    }
    for (const step of guide.path) {
      for (const id of step.items) {
        if (!local.has(id)) errors.push(`${where}: yol adımı "${step.title}" bilinmeyen kaynağa bağlı: ${id}`);
      }
    }
    guideRows.push({
      area,
      items: guide.items.length,
      steps: guide.path.length,
      tr: guide.items.filter((i) => i.lang === 'tr').length,
      next: `${area}-k${String(maxNum + 1).padStart(2, '0')}`,
    });
  }
}

console.log('\nAlan              Kart  Hangisi  Görsel  Sıradaki kimlik');
for (const r of rows) {
  console.log(
    `${r.domain.padEnd(17)} ${String(r.total).padStart(4)}  ${String(r.hangisi).padStart(7)}  ${String(r.gorsel).padStart(6)}  ${r.next}`,
  );
}
const total = rows.reduce((a, r) => a + r.total, 0);
const totalImg = rows.reduce((a, r) => a + r.gorsel, 0);
console.log(`${'Toplam'.padEnd(17)} ${String(total).padStart(4)}  ${''.padStart(7)}  ${String(totalImg).padStart(6)}\n`);

if (guideRows.length) {
  console.log('Rehber            Kaynak  Türkçe  Adım  Sıradaki kimlik');
  for (const r of guideRows) {
    console.log(
      `${r.area.padEnd(17)} ${String(r.items).padStart(6)}  ${String(r.tr).padStart(6)}  ${String(r.steps).padStart(4)}  ${r.next}`,
    );
  }
  console.log('');
}

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
console.log(guideRows.length ? '✓ Tüm desteler ve rehberler geçerli.' : '✓ Tüm desteler geçerli.');
