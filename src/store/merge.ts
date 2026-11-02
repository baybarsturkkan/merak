/** Satırın üst düzey olay kimliği. Okuma olaylarında iç içe `reading.id` de olduğu için düz arama yanlış alanı bulabilir. */
function lineId(line: string): string | undefined {
  try {
    const id = (JSON.parse(line) as { id?: unknown }).id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Var olan satırlara dokunmadan, henüz olmayan olayları JSONL dosyasının sonuna ekler */
export function mergeJsonl(existing: string, events: ReadonlyArray<{ id: string }>): string {
  const ids = new Set<string>();
  for (const line of existing.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const id = lineId(line);
    if (id) ids.add(id);
  }
  const fresh = events.filter((e) => !ids.has(e.id)).map((e) => JSON.stringify(e));
  if (!fresh.length) return existing;
  const head = existing.length && !existing.endsWith('\n') ? `${existing}\n` : existing;
  return `${head}${fresh.join('\n')}\n`;
}
