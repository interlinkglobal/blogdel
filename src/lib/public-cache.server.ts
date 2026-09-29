// A short per-instance cache coalesces concurrent public reads. It is deliberately
// bounded: Vercel instances do not share memory and publication remains visible
// after the TTL even when a warm instance survives for a long time.
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cachedPublic<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = entries.get(key);
  if (existing && existing.expires > now) return existing.value as Promise<T>;

  if (entries.size >= 200) {
    for (const [oldKey, entry] of entries) {
      if (entry.expires <= now) entries.delete(oldKey);
    }
    if (entries.size >= 200) entries.delete(entries.keys().next().value!);
  }

  const value = Promise.resolve().then(load);
  entries.set(key, { expires: now + ttlMs, value });
  void value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}
