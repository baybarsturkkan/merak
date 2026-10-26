/**
 * npm run gorsel — kart görselleri için Wikimedia Commons aracı.
 *   npm run gorsel -- --ara "Selimiye Mosque"      Commons'ta ara: başlık, boyut, lisans, yazar
 *   npm run gorsel -- "File:Ad.jpg"                 karta yapıştırılacak hazır "image" nesnesi
 *   npm run gorsel -- "File:Ad.jpg" --yazar "Ad"    yazar bilgisi karışıksa elle ver
 *   npm run gorsel -- --eksik [alan]                görselsiz kartlar
 *   npm run gorsel -- --denetle                     tüm kart görsellerinin açıldığını denetle
 * Lisansı ve yazarı elle yazma: bu araç Commons'taki kayıttan alır.
 */
import { DOMAINS, IMAGE_HOST, type Card } from '../src/lib/schema';
import { loadVeri } from './veri';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'Merak/0.1 (https://github.com/baybarsturkkan/merak)';
const WIDTH = 960;
const args = process.argv.slice(2);

interface Info {
  title: string;
  width: number;
  height: number;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  url: string;
  descriptionurl: string;
  mime: string;
  license: string;
  artist: string;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Commons'taki yazar alanı serbest metindir; kısa bir ada indirger. Sonuç tuhafsa --yazar ile elle ver. */
function cleanArtist(raw: string): string {
  let s = stripHtml(raw)
    .replace(/\[\s*\d+\s*\]/g, '') // dipnot işaretleri
    .replace(/\(\s+[^)]*\s+\)/g, '') // "( Lucag )" gibi kullanıcı adları
    .replace(/^(user|map|photo|image|photograph|credit):\s*/i, '')
    .replace(/\s+,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || /^(unknown|anonymous|bilinmeyen|see above)/i.test(s)) return 'Bilinmeyen yazar';
  // "Ad Soyad (1868–1942), açıklama…" → "Ad Soyad"; "Phillip A. Harrington" gibi baş harfleri bölme
  const cut = s.search(/ \(|(?<=\p{L}{2})\. | Description:|, (a|an|the|uploader|photographer)\b/iu);
  if (cut > 2 && (s.length > 40 || /^ \(\d/.test(s.slice(cut)) || /^, photographer/i.test(s.slice(cut)))) {
    s = s.slice(0, cut).trim();
  }
  return s.length > 60 ? `${s.slice(0, 57).trim()}…` : s;
}

/** Commons lisans adları; tanınmayan bir lisans --zorla olmadan kabul edilmez */
function licenseLabel(raw: string): string | null {
  const s = stripHtml(raw);
  if (/^public domain$|^pd\b|no restrictions|kamu/i.test(s)) return 'Kamu malı';
  if (/^cc0/i.test(s)) return 'CC0';
  if (/^cc[ -]by/i.test(s)) return s.toUpperCase().replace(/^CC-/, 'CC ');
  if (/^(gfdl|fal|free art|attribution)/i.test(s)) return s;
  return null;
}

async function api(params: Record<string, string>): Promise<any> {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons yanıtı: ${res.status}`);
  return res.json();
}

const INFO_PARAMS = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: String(WIDTH),
  iiextmetadatafilter: 'Artist|LicenseShortName',
};

function toInfo(page: any): Info | null {
  const i = page?.imageinfo?.[0];
  if (!i) return null;
  return {
    title: page.title,
    width: i.width,
    height: i.height,
    thumburl: i.thumburl,
    thumbwidth: i.thumbwidth,
    thumbheight: i.thumbheight,
    url: i.url,
    descriptionurl: i.descriptionurl,
    mime: i.mime,
    license: i.extmetadata?.LicenseShortName?.value ?? '',
    artist: i.extmetadata?.Artist?.value ?? '',
  };
}

/** "File:Ad.jpg", "Ad.jpg" ya da Commons sayfa adresi → "File:Ad.jpg" */
function fileTitle(input: string): string {
  let s = input.trim();
  const m = s.match(/\/wiki\/(File:[^?#]+)/i);
  if (m) s = decodeURIComponent(m[1]);
  s = s.replace(/_/g, ' ');
  return /^(file|dosya):/i.test(s) ? s.replace(/^dosya:/i, 'File:') : `File:${s}`;
}

function stripQuery(u: string): string {
  const x = new URL(u);
  x.search = '';
  return x.toString();
}

async function search(q: string, n: number) {
  const j = await api({
    action: 'query',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${q} filetype:bitmap|drawing`,
    gsrlimit: String(n),
    ...INFO_PARAMS,
  });
  const pages: any[] = j.query?.pages ?? [];
  if (!pages.length) {
    console.log('Sonuç yok. Başka sözcüklerle (İngilizce çoğu zaman daha iyi) dene.');
    return;
  }
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of pages) {
    const i = toInfo(p);
    if (!i) continue;
    const lic = licenseLabel(i.license) ?? `? ${stripHtml(i.license)}`;
    console.log(`- ${i.title}`);
    console.log(`  ${i.width}×${i.height} · ${lic} · ${cleanArtist(i.artist)}`);
  }
  console.log('\nSeçtiğinin hazır nesnesi için: npm run gorsel -- "File:…"');
}

async function single(input: string) {
  const title = fileTitle(input);
  const j = await api({ action: 'query', titles: title, ...INFO_PARAMS });
  const page = j.query?.pages?.[0];
  const i = toInfo(page);
  if (!i) {
    console.error(`Bulunamadı: ${title}`);
    process.exit(1);
  }
  const lic = licenseLabel(i.license);
  if (!lic && !args.includes('--zorla')) {
    console.error(`Tanınmayan lisans: “${stripHtml(i.license)}”. Sayfayı kontrol et: ${i.descriptionurl}`);
    console.error('Özgür olduğundan eminsen --zorla ekle; değilse başka görsel seç.');
    process.exit(1);
  }
  const yi = args.indexOf('--yazar');
  const artist = yi >= 0 && args[yi + 1] ? args[yi + 1] : cleanArtist(i.artist);
  const src = stripQuery(i.thumburl ?? i.url);
  if (!IMAGE_HOST.test(src)) {
    console.error(`Beklenmeyen görsel adresi: ${src}`);
    process.exit(1);
  }
  const image = {
    src,
    page: i.descriptionurl,
    alt: '<görseli anlatan kısa açıklama; show "soru" ise cevabı söyleme>',
    credit: `${artist} · ${lic ?? stripHtml(i.license)}`,
    show: 'cevap',
    w: i.thumbwidth ?? i.width,
    h: i.thumbheight ?? i.height,
  };
  if (i.width < 500) console.error(`! Görsel küçük (${i.width}px); daha büyüğü varsa onu seç.`);
  console.log(JSON.stringify({ image }, null, 2));
}

function missing(which?: string) {
  const { cards } = loadVeri();
  const domains = which ? DOMAINS.filter((d) => d === which) : DOMAINS;
  if (!domains.length) {
    console.error(`Bilinmeyen alan: ${which}. Geçerli: ${DOMAINS.join(', ')}`);
    process.exit(1);
  }
  for (const d of domains) {
    const list = cards.filter((c) => c.domain === d);
    const without = list.filter((c) => !c.image);
    console.log(`\n## ${d} — ${list.length - without.length}/${list.length} görselli`);
    for (const c of without) console.log(`- ${c.id}: ${c.question} → ${c.answer}`);
  }
}

async function check() {
  const { cards } = loadVeri();
  const withImg = cards.filter((c): c is Card & { image: NonNullable<Card['image']> } => !!c.image);
  const bad: string[] = [];
  const seen = new Map<string, string>();
  let i = 0;
  // Wikimedia'yı yormamak için ikişer ikişer
  const queue = [...withImg];
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      i++;
      const prev = seen.get(c.image.src);
      if (prev) console.log(`  ! ${c.id}: aynı görsel ${prev} kartında da var`);
      seen.set(c.image.src, c.id);
      try {
        const res = await fetch(c.image.src, { headers: { 'User-Agent': UA } });
        await res.arrayBuffer();
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('image/')) bad.push(`${c.id}: ${res.status} ${type} ${c.image.src}`);
      } catch (e) {
        bad.push(`${c.id}: ${(e as Error).message} ${c.image.src}`);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  console.log(`${i} görsel denetlendi.`);
  if (bad.length) {
    console.error(`AÇILMAYAN GÖRSELLER (${bad.length}):`);
    for (const b of bad) console.error(`  ✗ ${b}`);
    process.exit(1);
  }
  console.log('✓ Tüm görseller açılıyor.');
}

async function main() {
  const ai = args.indexOf('--ara');
  if (ai >= 0) {
    const ni = args.indexOf('--n');
    return search(args[ai + 1] ?? '', ni >= 0 ? Number(args[ni + 1]) || 8 : 8);
  }
  const ei = args.indexOf('--eksik');
  if (ei >= 0) return missing(args[ei + 1]);
  if (args.includes('--denetle')) return check();
  const file = args.find((a, idx) => !a.startsWith('--') && args[idx - 1] !== '--yazar');
  if (file) return single(file);
  console.log(
    [
      'Kullanım:',
      '  npm run gorsel -- --ara "<arama>" [--n 8]',
      '  npm run gorsel -- "File:<ad>" [--yazar "<ad>"] [--zorla]',
      '  npm run gorsel -- --eksik [alan]',
      '  npm run gorsel -- --denetle',
    ].join('\n'),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
