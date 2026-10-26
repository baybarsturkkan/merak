import type { AppEvent } from '../lib/schema';
import { OfflineError, type FileContent, type RemoteFile, type Store } from './types';

/**
 * Geliştirme modu: Vite sunucusundaki ara katman (tools/veri-plugin.ts)
 * proje içindeki veri/ klasörünü okur ve yazar. Token gerekmez.
 */
export class LocalStore implements Store {
  readonly kind = 'local' as const;
  readonly id = 'local';

  constructor(private base = `${import.meta.env.BASE_URL}__veri`) {}

  private async req(path: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { cache: 'no-store', ...init });
    } catch {
      throw new OfflineError('Yerel sunucuya ulaşılamadı');
    }
    if (!res.ok) throw new Error(`Yerel veri hatası: ${res.status} ${await res.text()}`);
    return res;
  }

  async list(): Promise<RemoteFile[]> {
    return (await this.req('/list')).json();
  }

  async read(file: RemoteFile): Promise<string> {
    return (await this.req(`/file?path=${encodeURIComponent(file.path)}`)).text();
  }

  async append(path: string, events: AppEvent[]): Promise<FileContent> {
    const res = await this.req('/append', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, events }),
    });
    return res.json();
  }
}
