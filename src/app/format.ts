import { daysBetween, formatInterval } from '../lib/dates';

/** Türkçede yüzde işareti başa gelir: %87 */
export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  return `%${(x * 100).toFixed(digits).replace('.', ',')}`;
}

export function num(n: number): string {
  return n.toLocaleString('tr-TR');
}

/** Vadeyi okunur kılar: "gecikmiş", "bugün", "yarın", "5 gün sonra", "3 ay sonra" */
export function dueLabel(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return 'şimdi';
  const days = daysBetween(now, due);
  if (days === 0) return `${formatInterval(ms)} sonra`;
  if (days === 1) return 'yarın';
  return `${formatInterval(ms)} sonra`;
}

export function plural(n: number, word: string): string {
  return `${num(n)} ${word}`;
}
