const DAY = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Yerel saate göre YYYY-MM-DD */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Haftanın başı: pazartesi 00:00 (yerel) */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // pazartesi = 0
  return addDays(s, -dow);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

/** Aralığı kısa Türkçe metne çevirir: "10 dk", "3 gün", "2 ay" */
export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return '<1 dk';
  if (min < 60) return `${Math.round(min)} dk`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} sa`;
  const d = h / 24;
  if (d < 30) return `${Math.round(d)} gün`;
  const mo = d / 30.44;
  if (mo < 12) return `${Math.round(mo)} ay`;
  const y = d / 365.25;
  return `${y < 10 ? y.toFixed(1).replace('.', ',') : Math.round(y)} yıl`;
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTHS_LONG = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** "26 Eki" */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Ekim 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Olay kimliği; güvenli olmayan bağlamda (LAN üzerinden http) da çalışır */
export function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
