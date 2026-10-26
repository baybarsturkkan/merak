import type { AppEvent } from '../lib/schema';

export interface RemoteFile {
  path: string;
  sha: string;
}

export interface FileContent {
  sha: string;
  content: string;
}

/** Veri deposuna erişim: GitHub (yayında) ya da yerel veri/ klasörü (geliştirmede) */
export interface Store {
  readonly kind: 'github' | 'local';
  /** Cache anahtarı: farklı depoların önbelleği karışmasın */
  readonly id: string;
  /** kartlar/*.json, rehber/*.json ve kayit/*.jsonl dosyaları */
  list(): Promise<RemoteFile[]>;
  read(file: RemoteFile): Promise<string>;
  /**
   * Olayları dosyanın sonuna ekler. Dosya bu arada değiştiyse yeniden okur,
   * olayları id'ye göre birleştirir ve tekrar dener.
   */
  append(path: string, events: AppEvent[], known?: FileContent): Promise<FileContent>;
}

export class AuthError extends Error {}
export class OfflineError extends Error {}
export class NotFoundError extends Error {}

export { mergeJsonl } from './merge';

export function b64encode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function isDataFile(path: string): boolean {
  return /^(kartlar|rehber)\/[^/]+\.json$/.test(path) || /^kayit\/[^/]+\.jsonl$/.test(path);
}
