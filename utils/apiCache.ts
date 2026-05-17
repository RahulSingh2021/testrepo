type CacheEntry<T> = { data: T; timestamp: number; promise?: Promise<T> };

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 60_000;

export async function cachedFetch<T>(
  url: string,
  opts?: { ttl?: number; force?: boolean }
): Promise<T> {
  const ttl = opts?.ttl ?? DEFAULT_TTL;
  const existing = cache.get(url) as CacheEntry<T> | undefined;

  if (!opts?.force && existing) {
    if (existing.promise) return existing.promise;
    if (Date.now() - existing.timestamp < ttl) return existing.data;
  }

  const promise = fetch(url)
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as T;
      cache.set(url, { data, timestamp: Date.now() });
      return data;
    })
    .catch((err) => {
      cache.delete(url);
      throw err;
    });

  cache.set(url, { data: undefined as T, timestamp: Date.now(), promise });
  return promise;
}

export function invalidateCache(urlPattern?: string) {
  if (!urlPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPattern)) cache.delete(key);
  }
}
