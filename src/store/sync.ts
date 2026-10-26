import {
  eventFilePath,
  parseDeck,
  parseEvents,
  type AppEvent,
  type Card,
  type EventInput,
} from '../lib/schema';
import { newId } from '../lib/dates';
import { OfflineError, type FileContent, type Store } from './types';

/** Kalıcı anahtar-değer deposu (tarayıcıda IndexedDB, testte bellek) */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export type SyncState = 'hazir' | 'senkron' | 'cevrimdisi' | 'hata';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSync?: string;
  message?: string;
}

export interface Snapshot {
  cards: Card[];
  events: AppEvent[];
  problems: string[];
}

type ParsedFile = { cards?: Card[]; events?: AppEvent[]; errors: string[] };

/**
 * Önbellek + gönderim kuyruğu.
 * - Okuma: dosya listesini alır, yalnızca SHA'sı değişen dosyaları indirir.
 * - Yazma: olaylar önce kuyruğa (kalıcı) girer, sonra cihazın aylık dosyasına eklenir.
 * Çevrimdışıyken uygulama önbellekten çalışır, kuyruk bağlantı gelince boşalır.
 */
export class SyncEngine {
  private files: Record<string, FileContent> = {};
  private outbox: AppEvent[] = [];
  private parsed = new Map<string, ParsedFile>();
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;
  private snap: Snapshot | null = null;
  status: SyncStatus = { state: 'hazir', pending: 0 };

  constructor(
    private store: Store,
    readonly device: string,
    private kv: KV,
  ) {}

  private get keyFiles() {
    return `files:${this.store.id}`;
  }
  private get keyOutbox() {
    return `outbox:${this.store.id}`;
  }

  async init(): Promise<void> {
    this.files = (await this.kv.get<Record<string, FileContent>>(this.keyFiles)) ?? {};
    this.outbox = (await this.kv.get<AppEvent[]>(this.keyOutbox)) ?? [];
    this.status = { ...this.status, pending: this.outbox.length };
    this.emit();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(dataChanged = true) {
    if (dataChanged) this.snap = null;
    for (const fn of this.listeners) fn();
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch, pending: this.outbox.length };
    this.emit(false);
  }

  hasData(): boolean {
    return Object.keys(this.files).length > 0 || this.outbox.length > 0;
  }

  /** Önbellekteki dosyalar + kuyruktaki olaylar */
  snapshot(): Snapshot {
    if (this.snap) return this.snap;
    const cards: Card[] = [];
    const events: AppEvent[] = [];
    const problems: string[] = [];
    for (const [path, file] of Object.entries(this.files).sort(([a], [b]) => a.localeCompare(b))) {
      const key = `${path}@${file.sha}`;
      let p = this.parsed.get(key);
      if (!p) {
        if (path.startsWith('kartlar/')) {
          const r = parseDeck(file.content);
          p = { cards: r.cards, errors: r.errors };
        } else {
          const r = parseEvents(file.content);
          p = { events: r.events, errors: r.errors };
        }
        this.parsed.set(key, p);
      }
      if (p.cards) cards.push(...p.cards);
      if (p.events) events.push(...p.events);
      for (const e of p.errors) problems.push(`${path}: ${e}`);
    }
    events.push(...this.outbox);
    this.snap = { cards, events, problems };
    return this.snap;
  }

  /** Yeni olay: anında uygulamaya yansır, kuyruğa girer */
  record(input: EventInput): AppEvent {
    const event = { ...input, id: newId(), ts: new Date().toISOString(), device: this.device } as AppEvent;
    this.outbox.push(event);
    void this.kv.set(this.keyOutbox, this.outbox);
    this.status = { ...this.status, pending: this.outbox.length };
    this.emit();
    return event;
  }

  /** Önce kuyruğu gönderir, sonra uzak değişiklikleri çeker */
  sync(): Promise<void> {
    return this.exclusive(async () => {
      await this.doPush();
      await this.doPull();
    });
  }

  push(): Promise<void> {
    return this.exclusive(() => this.doPush());
  }

  private async exclusive(job: () => Promise<void>): Promise<void> {
    while (this.running) await this.running.catch(() => {});
    this.setStatus({ state: 'senkron', message: undefined });
    this.running = (async () => {
      try {
        await job();
        this.setStatus({ state: 'hazir', lastSync: new Date().toISOString(), message: undefined });
      } catch (e) {
        if (e instanceof OfflineError) this.setStatus({ state: 'cevrimdisi', message: e.message });
        else this.setStatus({ state: 'hata', message: (e as Error).message });
      }
    })();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  private async doPush(): Promise<void> {
    if (!this.outbox.length) return;
    const groups = new Map<string, AppEvent[]>();
    for (const e of this.outbox) {
      const path = eventFilePath(e.ts, e.device);
      const list = groups.get(path) ?? [];
      list.push(e);
      groups.set(path, list);
    }
    for (const [path, events] of groups) {
      const result = await this.store.append(path, events, this.files[path]);
      this.files[path] = result;
      const sent = new Set(events.map((e) => e.id));
      this.outbox = this.outbox.filter((e) => !sent.has(e.id));
      await this.kv.set(this.keyFiles, this.files);
      await this.kv.set(this.keyOutbox, this.outbox);
      this.emit();
    }
  }

  private async doPull(): Promise<void> {
    const remote = await this.store.list();
    let changed = false;
    const seen = new Set<string>();
    for (const f of remote) {
      seen.add(f.path);
      if (this.files[f.path]?.sha === f.sha) continue;
      const content = await this.store.read(f);
      this.files[f.path] = { sha: f.sha, content };
      changed = true;
    }
    for (const path of Object.keys(this.files)) {
      if (!seen.has(path)) {
        delete this.files[path];
        changed = true;
      }
    }
    if (changed) {
      await this.kv.set(this.keyFiles, this.files);
      this.emit();
    }
  }

  /** Ayarlar'daki "önbelleği temizle" için */
  async clearCache(): Promise<void> {
    this.files = {};
    this.parsed.clear();
    await this.kv.set(this.keyFiles, {});
    this.emit();
  }
}

export function memoryKV(): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      return structuredClone(data.get(key)) as T | undefined;
    },
    async set(key: string, value: unknown) {
      data.set(key, structuredClone(value));
    },
  };
}
