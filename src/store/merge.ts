/** Var olan satırlara dokunmadan, henüz olmayan olayları JSONL dosyasının sonuna ekler */
export function mergeJsonl(existing: string, events: ReadonlyArray<{ id: string }>): string {
  const ids = new Set<string>();
  for (const line of existing.split(/\r?\n/)) {
    const m = line.match(/"id"\s*:\s*"([^"]+)"/);
    if (m) ids.add(m[1]);
  }
  const fresh = events.filter((e) => !ids.has(e.id)).map((e) => JSON.stringify(e));
  if (!fresh.length) return existing;
  const head = existing.length && !existing.endsWith('\n') ? `${existing}\n` : existing;
  return `${head}${fresh.join('\n')}\n`;
}
