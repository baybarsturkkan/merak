/**
 * Yazılan cevabı doğru cevapla karşılaştırır. Sonuç yalnızca ipucudur;
 * notu her zaman kullanıcı verir.
 */

const FOLD: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
  é: 'e',
  è: 'e',
  á: 'a',
  à: 'a',
  ó: 'o',
  í: 'i',
  ú: 'u',
  ñ: 'n',
  ä: 'a',
};

export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFC')
    .replace(/[çğıöşüâîûéèáàóíúñä]/g, (ch) => FOLD[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** "Mustafa Kemal (Atatürk)" → ["Mustafa Kemal (Atatürk)", "Mustafa Kemal"] */
function variants(answer: string): string[] {
  const out = [answer];
  const noParen = answer.replace(/\([^)]*\)/g, ' ').trim();
  if (noParen && noParen !== answer) out.push(noParen);
  for (const part of answer.split(/\s*(?:\/|;| ya da | veya )\s*/)) {
    if (part && part !== answer) out.push(part);
  }
  return out;
}

export type MatchResult = 'tam' | 'yakin' | 'farkli' | 'bos';

export function matchAnswer(typed: string, answer: string, accept: string[] = []): MatchResult {
  const t = normalize(typed);
  if (!t) return 'bos';
  const candidates = [...variants(answer), ...accept].map(normalize).filter(Boolean);

  for (const c of candidates) if (c === t) return 'tam';

  for (const c of candidates) {
    const tolerance = c.length <= 4 ? 0 : c.length <= 8 ? 1 : Math.floor(c.length * 0.2);
    if (tolerance > 0 && levenshtein(t, c) <= tolerance) return 'yakin';
  }

  // Cevap, yazılanın içinde tam kelimeler olarak geçiyorsa ("sanırım 1453 yılında" ⊃ "1453")
  const tWords = ` ${t} `;
  for (const c of candidates) {
    if (c.length >= 3 && tWords.includes(` ${c} `)) return 'yakin';
  }
  // Yazılan, uzun cevabın önemli bir kısmını kapsıyorsa
  for (const c of candidates) {
    if (t.length >= 4 && ` ${c} `.includes(` ${t} `) && t.length / c.length >= 0.5) return 'yakin';
  }
  return 'farkli';
}
