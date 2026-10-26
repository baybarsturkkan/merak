import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { mergeJsonl } from '../src/store/merge.ts';
type AppEvent = { id: string };

/**
 * Geliştirme sunucusunda veri/ klasörünü GitHub deposu gibi sunar.
 * Yalnızca `vite` (serve) modunda çalışır; yayına girmez.
 */
export function veriPlugin(dir = 'veri'): Plugin {
  const root = path.resolve(dir);
  const sha = (s: string) => createHash('sha1').update(s).digest('hex');
  const readable = /^(kartlar\/[\w.-]+\.json|kayit\/[\w.-]+\.jsonl)$/;
  const writable = /^kayit\/[\w.-]+\.jsonl$/;

  async function listFiles() {
    const out: Array<{ path: string; sha: string }> = [];
    for (const sub of ['kartlar', 'kayit']) {
      let names: string[] = [];
      try {
        names = await fs.readdir(path.join(root, sub));
      } catch {
        continue;
      }
      for (const name of names.sort()) {
        const rel = `${sub}/${name}`;
        if (!readable.test(rel)) continue;
        const content = await fs.readFile(path.join(root, rel), 'utf8');
        out.push({ path: rel, sha: sha(content) });
      }
    }
    return out;
  }

  return {
    name: 'merak-veri',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const m = url.pathname.match(/\/__veri\/(list|file|append)$/);
        if (!m) return next();
        const send = (code: number, body: unknown, type = 'application/json') => {
          res.statusCode = code;
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          res.setHeader('Cache-Control', 'no-store');
          res.end(typeof body === 'string' ? body : JSON.stringify(body));
        };
        try {
          if (m[1] === 'list') return send(200, await listFiles());
          if (m[1] === 'file') {
            const rel = url.searchParams.get('path') ?? '';
            if (!readable.test(rel)) return send(400, 'geçersiz yol', 'text/plain');
            return send(200, await fs.readFile(path.join(root, rel), 'utf8'), 'text/plain');
          }
          if (m[1] === 'append' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) body += chunk;
            const { path: rel, events } = JSON.parse(body) as { path: string; events: AppEvent[] };
            if (!writable.test(rel)) return send(400, 'geçersiz yol', 'text/plain');
            const file = path.join(root, rel);
            await fs.mkdir(path.dirname(file), { recursive: true });
            const before = await fs.readFile(file, 'utf8').catch(() => '');
            const after = mergeJsonl(before, events);
            if (after !== before) {
              const tmp = `${file}.tmp`;
              await fs.writeFile(tmp, after, 'utf8');
              await fs.rename(tmp, file);
            }
            return send(200, { sha: sha(after), content: after });
          }
          return send(405, 'desteklenmiyor', 'text/plain');
        } catch (e) {
          return send(500, (e as Error).message, 'text/plain');
        }
      });
    },
  };
}
