import sql from '@/lib/db';

// Persistent cache for external nutrition lookups (USDA / FSANZ).
//
// The USDA proxy route also keeps a 5-minute in-process map for hot
// repeats inside a single Lambda invocation; this DB-backed cache adds
// a longer-lived layer that survives process restarts and — more
// importantly — is shared across users, so the Recipe Studio bootstrap
// can prewarm a brand-new browser tab with rows another user already
// fetched.
//
// Keyed by `(source, query_lower)`; `query_lower` is the lowercased
// trimmed query string (the same key the in-process map uses).

export type NutritionSource = 'USDA' | 'FSANZ';

// 30 days. External food-composition data is essentially static for
// these sources, so a long TTL is safe; a hard cap stops a stale row
// from persisting indefinitely if upstream renames a food.
export const DB_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let ensured = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureNutritionCacheTable(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS nutrition_cache (
      source TEXT NOT NULL,
      query TEXT NOT NULL,
      foods JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (source, query)
    )`;
    ensured = true;
  })();
  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }
}

// Bump whenever the upstream-parser shape or unit handling changes in a
// way that could leave previously-cached rows holding values inconsistent
// with what a fresh fetch would now return. Old rows stay in the table
// but become unreachable (different key), and TTL eventually evicts them.
// Current bump (v2): USDA proxy is now unit-aware (g vs mg vs kJ) and
// drops physically-impossible per-100 g values; pre-v2 rows could carry
// mis-scaled macros (the basmati-rice "8.89 g → 889" bug).
const CACHE_VERSION = 'v2';

function normaliseQuery(q: string): string {
  const base = (q || '').trim().toLowerCase();
  if (!base) return '';
  return `${CACHE_VERSION}:${base}`;
}

export interface NutritionCacheRow {
  source: NutritionSource;
  query: string;
  foods: unknown[];
  expiresAt: number;
}

/** Read a single cache row. Returns null on miss / expiry / error. */
export async function readNutritionCache(
  source: NutritionSource,
  query: string,
): Promise<NutritionCacheRow | null> {
  const key = normaliseQuery(query);
  if (!key) return null;
  try {
    await ensureNutritionCacheTable();
    const rows: any[] = await sql`
      SELECT source, query, foods, expires_at
      FROM nutrition_cache
      WHERE source = ${source} AND query = ${key} AND expires_at > NOW()
      LIMIT 1`;
    const row = rows?.[0];
    if (!row) return null;
    return {
      source: row.source,
      query: row.query,
      foods: Array.isArray(row.foods) ? row.foods : [],
      expiresAt: new Date(row.expires_at).getTime(),
    };
  } catch (e) {
    console.warn('readNutritionCache failed:', e);
    return null;
  }
}

/** Write-through: upsert the cached foods for (source, query). Best-effort. */
export async function writeNutritionCache(
  source: NutritionSource,
  query: string,
  foods: unknown[],
  ttlMs: number = DB_CACHE_TTL_MS,
): Promise<void> {
  const key = normaliseQuery(query);
  if (!key) return;
  if (!Array.isArray(foods)) return;
  try {
    await ensureNutritionCacheTable();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await sql`
      INSERT INTO nutrition_cache (source, query, foods, expires_at, updated_at)
      VALUES (${source}, ${key}, ${JSON.stringify(foods)}::jsonb, ${expiresAt}, NOW())
      ON CONFLICT (source, query) DO UPDATE
        SET foods = EXCLUDED.foods,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()`;
  } catch (e) {
    console.warn('writeNutritionCache failed:', e);
  }
}

/**
 * Bulk read — used by the Recipe Studio bootstrap to fetch every
 * cached row whose query matches one of the user's recipe ingredient
 * names in a single round-trip.
 */
export async function readNutritionCacheBulk(
  queries: string[],
): Promise<NutritionCacheRow[]> {
  const keys = Array.from(
    new Set(
      (queries || [])
        .map(q => normaliseQuery(q))
        .filter(Boolean),
    ),
  );
  if (keys.length === 0) return [];
  try {
    await ensureNutritionCacheTable();
    const rows: any[] = await sql`
      SELECT source, query, foods, expires_at
      FROM nutrition_cache
      WHERE query = ANY(${keys}::text[]) AND expires_at > NOW()`;
    return (rows || []).map(row => ({
      source: row.source,
      query: row.query,
      foods: Array.isArray(row.foods) ? row.foods : [],
      expiresAt: new Date(row.expires_at).getTime(),
    }));
  } catch (e) {
    console.warn('readNutritionCacheBulk failed:', e);
    return [];
  }
}
