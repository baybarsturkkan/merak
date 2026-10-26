import { createStore, get, set } from 'idb-keyval';
import { slugDevice } from '../lib/schema';
import { GithubStore } from './github';
import { LocalStore } from './local';
import type { KV } from './sync';
import type { Store } from './types';

/** Cihaza özel bağlantı ayarları. Token yalnızca bu tarayıcıda kalır. */
export interface Connection {
  repo: string;
  token: string;
  device: string;
  branch?: string;
  /** Yalnızca geliştirmede: yerel veri/ klasörünü kullan */
  useLocal?: boolean;
}

const KEY = 'merak.baglanti';

export const DEFAULT_REPO = 'baybarsturkkan/merak-veri';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadConnection(): Connection {
  const fallback: Connection = {
    repo: DEFAULT_REPO,
    token: '',
    device: '',
    useLocal: import.meta.env.DEV,
  };
  let conn = fallback;
  try {
    const raw = safeStorage()?.getItem(KEY);
    if (raw) conn = { ...fallback, ...JSON.parse(raw) };
  } catch {
    /* bozuk kayıt: varsayılanla devam */
  }
  // Cihaz adı bir kez belirlenip saklanır; yoksa kayıt dosyası tarayıcıya göre değişebilirdi
  if (!conn.device) {
    conn = { ...conn, device: guessDeviceName() };
    saveConnection(conn);
  }
  return conn;
}

export function saveConnection(c: Connection): void {
  try {
    safeStorage()?.setItem(KEY, JSON.stringify(c));
  } catch {
    /* gizli sekmede depolama kapalı olabilir */
  }
}

export function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|Android.+Mobile/i.test(ua)) return 'telefon';
  if (/iPad|Android/i.test(ua)) return 'tablet';
  return 'bilgisayar';
}

export function deviceSlug(c: Connection): string {
  return slugDevice(c.device || guessDeviceName());
}

/** Bağlantı eksikse null döner (Ayarlar ekranı açılır) */
export function createDataStore(c: Connection): Store | null {
  if (import.meta.env.DEV && c.useLocal) return new LocalStore();
  if (!c.repo.includes('/') || !c.token) return null;
  return new GithubStore({ repo: c.repo.trim(), token: c.token.trim(), branch: c.branch });
}

const idb = createStore('merak', 'onbellek');

export const browserKV: KV = {
  get: <T,>(key: string) => get<T>(key, idb),
  set: (key: string, value: unknown) => set(key, value, idb),
};
