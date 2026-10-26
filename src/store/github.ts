import type { AppEvent } from '../lib/schema';
import {
  AuthError,
  NotFoundError,
  OfflineError,
  b64decode,
  b64encode,
  isDataFile,
  mergeJsonl,
  type FileContent,
  type RemoteFile,
  type Store,
} from './types';

export interface GithubConfig {
  /** "kullanici/depo" */
  repo: string;
  token: string;
  branch?: string;
}

const API = 'https://api.github.com';

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

/**
 * GitHub REST API üzerinden veri deposu.
 * Okuma: Git Trees (tek istekte tüm SHA'lar) + Blobs. Yazma: Contents API (PUT).
 */
export class GithubStore implements Store {
  readonly kind = 'github' as const;
  readonly id: string;
  private branch?: string;
  private fetcher: typeof fetch;

  constructor(
    private cfg: GithubConfig,
    fetcher?: typeof fetch,
  ) {
    this.id = `github:${cfg.repo.toLowerCase()}`;
    this.branch = cfg.branch;
    this.fetcher = fetcher ?? ((...args) => fetch(...args));
  }

  private async api(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetcher(`${API}/repos/${this.cfg.repo}${path}`, {
        ...init,
        cache: 'no-store',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.cfg.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new OfflineError("GitHub'a ulaşılamadı");
    }
    if (res.status === 401) throw new AuthError("Token geçersiz ya da süresi dolmuş. Ayarlar'dan yenile.");
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error('GitHub istek sınırına ulaşıldı, biraz sonra tekrar dene.');
    }
    return res;
  }

  /** Bağlantıyı doğrular, varsayılan dalı öğrenir */
  async check(): Promise<{ branch: string; private: boolean; canWrite: boolean }> {
    const res = await this.api('');
    if (res.status === 404 || res.status === 403) {
      throw new NotFoundError("Depo bulunamadı ya da token'ın bu depoya erişimi yok.");
    }
    if (!res.ok) throw new Error(`GitHub yanıtı: ${res.status}`);
    const j = await res.json();
    this.branch = j.default_branch;
    return {
      branch: j.default_branch,
      private: !!j.private,
      canWrite: j.permissions ? !!j.permissions.push : true,
    };
  }

  private async getBranch(): Promise<string> {
    if (!this.branch) await this.check();
    return this.branch!;
  }

  async list(): Promise<RemoteFile[]> {
    const branch = await this.getBranch();
    const res = await this.api(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (res.status === 409 || res.status === 404) return []; // boş depo
    if (!res.ok) throw new Error(`Dosya listesi alınamadı: ${res.status}`);
    const j = (await res.json()) as { tree: Array<{ path: string; type: string; sha: string }> };
    return j.tree.filter((t) => t.type === 'blob' && isDataFile(t.path)).map((t) => ({ path: t.path, sha: t.sha }));
  }

  async read(file: RemoteFile): Promise<string> {
    const res = await this.api(`/git/blobs/${file.sha}`);
    if (!res.ok) throw new Error(`${file.path} okunamadı: ${res.status}`);
    const j = (await res.json()) as { content: string; encoding: string };
    return j.encoding === 'base64' ? b64decode(j.content) : j.content;
  }

  private async getFile(path: string): Promise<FileContent | null> {
    const branch = await this.getBranch();
    const res = await this.api(`/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${path} okunamadı: ${res.status}`);
    const j = (await res.json()) as { sha: string; content?: string; size: number };
    // 1 MB üstü dosyalarda content boş gelir; blob üzerinden oku
    const content = j.content ? b64decode(j.content) : j.size ? await this.read({ path, sha: j.sha }) : '';
    return { sha: j.sha, content };
  }

  async append(path: string, events: AppEvent[], known?: FileContent): Promise<FileContent> {
    const branch = await this.getBranch();
    let current: FileContent | null | undefined = known;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (current === undefined) current = await this.getFile(path);
      const before = current?.content ?? '';
      const next = mergeJsonl(before, events);
      if (current && next === before) return current;

      const device = events[0]?.device ?? 'cihaz';
      const res = await this.api(`/contents/${encodePath(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `kayıt: ${events.length} olay · ${device}`,
          content: b64encode(next),
          branch,
          ...(current ? { sha: current.sha } : {}),
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { content: { sha: string } };
        return { sha: j.content.sha, content: next };
      }
      if (res.status === 409 || res.status === 422) {
        current = undefined; // dosya değişmiş: yeniden oku, birleştir, tekrar dene
        continue;
      }
      if (res.status === 403 || res.status === 404) {
        throw new AuthError("Token'ın bu depoya yazma izni yok (Contents: Read and write gerekli).");
      }
      throw new Error(`Kayıt gönderilemedi: ${res.status}`);
    }
    throw new Error('Kayıt dosyası art arda değişti, sonra tekrar denenecek.');
  }
}
