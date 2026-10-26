/**
 * npm run ozet — Claude Code'un kart yazmadan önce okuduğu özet.
 *   npm run ozet                      genel özet, merak, bekleyen işler
 *   npm run ozet -- --sorular tarih   bir alandaki tüm sorular (yinelemeyi önlemek için)
 *   npm run ozet -- --sorular hepsi   tüm alanlardaki sorular
 */
import { DOMAINS, DOMAIN_LABELS, type Domain } from '../src/lib/schema';
import { cardPhase } from '../src/lib/state';
import { confidentErrors, pendingReadings, trueRetention } from '../src/lib/stats';
import { addDays } from '../src/lib/dates';
import { loadVeri } from './veri';

const { data, events, problems } = loadVeri();
const now = new Date();
const args = process.argv.slice(2);
const pct = (x: number | null) => (x === null ? '—' : `%${Math.round(x * 100)}`);

function nextId(domain: Domain): string {
  const nums = data.states.filter((s) => s.card.domain === domain).map((s) => Number(s.card.id.slice(-4)));
  return `${domain}-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
}

const qi = args.indexOf('--sorular');
if (qi >= 0) {
  const which = args[qi + 1] ?? 'hepsi';
  const domains = which === 'hepsi' ? DOMAINS : DOMAINS.filter((d) => d === which);
  if (!domains.length) {
    console.error(`Bilinmeyen alan: ${which}. Geçerli: ${DOMAINS.join(', ')}`);
    process.exit(1);
  }
  for (const d of domains) {
    console.log(`\n## ${DOMAIN_LABELS[d]} (${d}) — sıradaki kimlik: ${nextId(d)}`);
    for (const s of data.states.filter((x) => x.card.domain === d)) {
      console.log(`- ${s.card.id}: ${s.card.question} → ${s.card.answer}`);
    }
  }
  process.exit(0);
}

const r30 = trueRetention(data.reviews, addDays(now, -30));
const learned = data.states.filter((s) => !s.isNew).length;
const mature = data.states.filter((s) => cardPhase(s) === 'olgun').length;

console.log('# Merak özeti\n');
console.log(`- Kart: ${data.states.length} (öğrenilen ${learned}, olgun ${mature}, yeni ${data.states.length - learned})`);
console.log(`- Tekrar olayı: ${data.reviews.length} · son 30 gün gerçek hatırlama: ${pct(r30.rate)} (${r30.n} deneme, hedef ${pct(data.settings.retention)})`);
console.log(`- Okuma: ${data.readings.length} · ayarlar: günlük ${data.settings.newPerDay} yeni kart, haftalık ${data.settings.weeklyReadingGoal} okuma hedefi`);
if (problems.length) console.log(`- ⚠ Okunamayan satır: ${problems.length} (ilk: ${problems[0]})`);

console.log('\n## Alanlar (merak = yeni kartlarda verilen 1–3 puanın ortalaması)\n');
console.log('| Alan | Kart | Yeni | Merak | 30g hatırlama | Sıradaki kimlik |');
console.log('|---|---|---|---|---|---|');
const rows = DOMAINS.map((d) => {
  const st = data.states.filter((s) => s.card.domain === d);
  const ids = new Set(st.map((s) => s.card.id));
  return {
    d,
    total: st.length,
    fresh: st.filter((s) => s.isNew).length,
    cur: data.domainCuriosity[d],
    rec: trueRetention(data.reviews, addDays(now, -30), (r) => ids.has(r.cardId)),
  };
}).sort((a, b) => (b.cur ?? 0) - (a.cur ?? 0));
for (const r of rows) {
  console.log(
    `| ${DOMAIN_LABELS[r.d]} (${r.d}) | ${r.total} | ${r.fresh} | ${r.cur ? r.cur.toFixed(1) : '—'} | ${pct(r.rec.rate)} (${r.rec.n}) | ${nextId(r.d)} |`,
  );
}

const curious = data.states.filter((s) => s.curiosity === 3).slice(-12);
if (curious.length) {
  console.log('\n## En çok merak edilen son kartlar (yeni kart üretirken ipucu)\n');
  for (const s of curious) console.log(`- [${s.card.domain}] ${s.card.question} → ${s.card.answer}`);
}

const pending = pendingReadings(data.readings);
console.log(`\n## Kart bekleyen okumalar (${pending.length})\n`);
if (!pending.length) console.log('Yok.');
for (const r of pending) {
  console.log(`### ${r.title} — id: ${r.id}`);
  console.log(`- Tür: ${r.kind} · tarih: ${r.date}${r.author ? ` · yazar: ${r.author}` : ''}${r.url ? ` · bağlantı: ${r.url}` : ''}`);
  console.log(`- Notlar: ${r.notes ? r.notes.replace(/\n+/g, ' / ') : '(yok)'}`);
}

const flagged = data.states.filter((s) => s.flag);
console.log(`\n## Hatalı işaretli kartlar (${flagged.length})\n`);
if (!flagged.length) console.log('Yok.');
for (const s of flagged) {
  console.log(`- ${s.card.id} (kartlar/${s.card.domain}.json): “${s.flag}”`);
  console.log(`  Soru: ${s.card.question} → ${s.card.answer}`);
}

const errors = confidentErrors(data.reviews, 10);
console.log(`\n## Emin olup yanıldıkları (son ${errors.length})\n`);
if (!errors.length) console.log('Yok.');
for (const e of errors) {
  const c = data.byId.get(e.cardId)?.card;
  if (c) console.log(`- ${c.id}: ${c.question} → doğrusu “${c.answer}”${e.typed ? `, yazdığı “${e.typed}”` : ''}`);
}

const tags = new Map<string, number>();
for (const s of data.states) for (const t of s.card.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
console.log('\n## Etiketler\n');
console.log(
  [...tags]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t} (${n})`)
    .join(', '),
);
console.log(`\n(Son olay: ${events.length ? [...events].sort((a, b) => b.ts.localeCompare(a.ts))[0].ts : 'yok'})`);
