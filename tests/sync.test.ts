import { beforeEach, describe, expect, it } from 'vitest';
import { GithubStore } from '../src/store/github';
import { SyncEngine, memoryKV } from '../src/store/sync';
import { AuthError, b64decode, b64encode, mergeJsonl } from '../src/store/types';
import { card, review } from './helpers';

/** Bellekte çalışan küçük bir GitHub API taklidi */
class FakeGitHub {
  files = new Map<string, { sha: string; content: string }>();
  calls: string[] = [];
  token = 'gizli';
  private n = 0;

  put(path: string, content: string) {
    this.files.set(path, { sha: `sha${++this.n}`, content });
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const p = url.pathname.replace('/repos/ben/veri', '');
    this.calls.push(`${method} ${p}`);
    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (auth !== `Bearer ${this.token}`) return json(401, { message: 'Bad credentials' });

    if (p === '') return json(200, { default_branch: 'main', private: true, permissions: { push: true } });
    if (p.startsWith('/git/trees/')) {
      return json(200, { tree: [...this.files].map(([path, f]) => ({ path, type: 'blob', sha: f.sha })) });
    }
    if (p.startsWith('/git/blobs/')) {
      const sha = p.split('/').pop();
      const f = [...this.files.values()].find((x) => x.sha === sha);
      return f ? json(200, { content: b64encode(f.content), encoding: 'base64' }) : json(404, {});
    }
    if (p.startsWith('/contents/')) {
      const path = decodeURIComponent(p.slice('/contents/'.length));
      const f = this.files.get(path);
      if (method === 'GET') {
        return f ? json(200, { sha: f.sha, content: b64encode(f.content), size: f.content.length }) : json(404, {});
      }
      const body = JSON.parse(String(init!.body));
      if (f && !body.sha) return json(422, { message: 'sha wasn\'t supplied' });
      if (f && body.sha !== f.sha) return json(409, { message: 'conflict' });
      this.put(path, b64decode(body.content));
      return json(201, { content: { sha: this.files.get(path)!.sha } });
    }
    return json(404, {});
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('mergeJsonl', () => {
  it('var olan olayları tekrar eklemez, satır sonunu düzeltir', () => {
    const a = review('a', '2026-10-01T00:00:00Z', 3);
    const b = review('a', '2026-10-02T00:00:00Z', 3);
    const once = mergeJsonl(JSON.stringify(a), [a, b]);
    expect(once.trim().split('\n')).toHaveLength(2);
    expect(mergeJsonl(once, [a, b])).toBe(once);
  });

  it('Türkçe karakterleri base64 üzerinden bozmadan taşır', () => {
    const s = 'Çağdaş şiir — ığüşöç İĞÜŞÖÇ';
    expect(b64decode(b64encode(s))).toBe(s);
  });
});

describe('GitHub senkronu', () => {
  let gh: FakeGitHub;
  let store: GithubStore;

  beforeEach(() => {
    gh = new FakeGitHub();
    gh.put('kartlar/tarih.json', JSON.stringify([card('tarih-0001'), card('tarih-0002')]));
    gh.put('README.md', 'veri deposu');
    store = new GithubStore({ repo: 'ben/veri', token: 'gizli' }, gh.fetch);
  });

  it('kartları çeker, olayları cihaz dosyasına yazar', async () => {
    const engine = new SyncEngine(store, 'telefon', memoryKV());
    await engine.init();
    await engine.sync();
    expect(engine.snapshot().cards.map((c) => c.id)).toEqual(['tarih-0001', 'tarih-0002']);

    engine.record({ type: 'tekrar', cardId: 'tarih-0001', rating: 3, phase: 'ontest', curiosity: 2 });
    expect(engine.status.pending).toBe(1);
    await engine.sync();
    expect(engine.status.pending).toBe(0);
    expect(engine.status.state).toBe('hazir');

    const files = [...gh.files.keys()].filter((p) => p.startsWith('kayit/'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^kayit\/\d{4}-\d{2}-telefon\.jsonl$/);
    expect(engine.snapshot().events).toHaveLength(1);
  });

  it('değişmeyen dosyaları yeniden indirmez', async () => {
    const engine = new SyncEngine(store, 'telefon', memoryKV());
    await engine.init();
    await engine.sync();
    const blobsBefore = gh.calls.filter((c) => c.includes('/git/blobs/')).length;
    await engine.sync();
    const blobsAfter = gh.calls.filter((c) => c.includes('/git/blobs/')).length;
    expect(blobsAfter).toBe(blobsBefore);
    expect(blobsBefore).toBe(1); // README.md veri dosyası sayılmaz
  });

  it('dosya bu arada değiştiyse yeniden okur, birleştirir ve tekrar dener', async () => {
    const kv = memoryKV();
    const engine = new SyncEngine(store, 'telefon', kv);
    await engine.init();
    engine.record({ type: 'tekrar', cardId: 'tarih-0001', rating: 3, phase: 'ontest' });
    await engine.sync();

    // Başka bir sekme aynı dosyaya yazmış olsun
    const path = [...gh.files.keys()].find((p) => p.startsWith('kayit/'))!;
    const other = review('tarih-0002', new Date().toISOString(), 4, { device: 'telefon' });
    gh.put(path, gh.files.get(path)!.content + JSON.stringify(other) + '\n');

    engine.record({ type: 'tekrar', cardId: 'tarih-0001', rating: 3, phase: 'tekrar' });
    await engine.sync();
    expect(engine.status.pending).toBe(0);
    const lines = gh.files.get(path)!.content.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(gh.calls.some((c) => c.startsWith('GET /contents/'))).toBe(true);
  });

  it('iki cihaz kendi dosyalarına yazar, ikisi de diğerinin olaylarını görür', async () => {
    const phone = new SyncEngine(store, 'telefon', memoryKV());
    const laptop = new SyncEngine(store, 'laptop', memoryKV());
    await phone.init();
    await laptop.init();
    phone.record({ type: 'tekrar', cardId: 'tarih-0001', rating: 3, phase: 'ontest' });
    laptop.record({ type: 'tekrar', cardId: 'tarih-0002', rating: 2, phase: 'ontest' });
    await phone.sync();
    await laptop.sync();
    await phone.sync();
    expect(phone.snapshot().events).toHaveLength(2);
    expect(laptop.snapshot().events).toHaveLength(2);
  });

  it('çevrimdışıyken olaylar kuyrukta kalır ve kalıcıdır', async () => {
    const kv = memoryKV();
    const offline = new GithubStore({ repo: 'ben/veri', token: 'gizli' }, async () => {
      throw new TypeError('Failed to fetch');
    });
    const engine = new SyncEngine(offline, 'telefon', kv);
    await engine.init();
    engine.record({ type: 'tekrar', cardId: 'tarih-0001', rating: 3, phase: 'ontest' });
    await engine.sync();
    expect(engine.status.state).toBe('cevrimdisi');
    expect(engine.status.pending).toBe(1);

    // Uygulama yeniden açıldı, bağlantı geldi
    const back = new SyncEngine(new GithubStore({ repo: 'ben/veri', token: 'gizli' }, gh.fetch), 'telefon', kv);
    await back.init();
    expect(back.status.pending).toBe(1);
    await back.sync();
    expect(back.status.pending).toBe(0);
  });

  it('yanlış token anlaşılır bir hata verir', async () => {
    const bad = new GithubStore({ repo: 'ben/veri', token: 'yanlis' }, gh.fetch);
    await expect(bad.check()).rejects.toBeInstanceOf(AuthError);
    const engine = new SyncEngine(bad, 'telefon', memoryKV());
    await engine.init();
    await engine.sync();
    expect(engine.status.state).toBe('hata');
    expect(engine.status.message).toMatch(/Token/);
  });
});
