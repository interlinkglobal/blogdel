// Public, anonymous reads only. Never use this cache for authenticated data.
type Entry = { expires: number; pending: boolean; value: Promise<unknown> };
const entries = new Map<string, Entry>();
const MAX_ENTRIES = 200;
const MAX_KEY_LENGTH = 2048;

export function cachedPublic<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || key.length > MAX_KEY_LENGTH) {
    return Promise.resolve().then(load);
  }
  const now = Date.now();
  const existing = entries.get(key);
  // A slow read must not spawn duplicate database work when its result TTL elapses.
  if (existing && (existing.pending || existing.expires > now)) return existing.value as Promise<T>;
  if (existing) entries.delete(key);
  if (entries.size >= MAX_ENTRIES) {
    for (const [oldKey, entry] of entries) {
      if (!entry.pending && entry.expires <= now) entries.delete(oldKey);
    }
    // Evict completed data before active work. If all slots are busy, bypass
    // admission rather than growing memory or evicting an in-flight promise.
    if (entries.size >= MAX_ENTRIES) {
      const victim = [...entries].find(([, entry]) => !entry.pending);
      if (!victim) return Promise.resolve().then(load);
      entries.delete(victim[0]);
    }
  }
  const value = Promise.resolve().then(load);
  const entry: Entry = { expires: 0, pending: true, value };
  entries.set(key, entry);
  void value.then(() => {
    if (entries.get(key) === entry) {
      entry.pending = false;
      entry.expires = Date.now() + ttlMs;
    }
  }, () => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return value;
}

