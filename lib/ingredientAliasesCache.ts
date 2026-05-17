import sql from '@/lib/db';

// Persistent cache for Google-scraped ingredient aliases and spell
// corrections. Keyed by lowercased+trimmed ingredient name.
//
// We scrape Google's HTML search results page (no API key required) and
// extract two things:
//   1. A "Did you mean" / "Showing results for" correction (used when the
//      typed name is misspelled).
//   2. Up to 5 alias names mined from result snippets via simple
//      "also known as / also called / another name for" patterns.
//
// Scraping Google is inherently brittle — the markup changes without
// notice and rate-limiting / CAPTCHA can kick in. Every failure is
// swallowed and stored as an empty result so the UI doesn't keep
// re-firing. Bump CACHE_VERSION below if the parser is improved and
// you want to invalidate prior empty rows.

export const ALIAS_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // ~1 year

const CACHE_VERSION = 'v4';

let ensured = false;
let ensurePromise: Promise<void> | null = null;

export async function ensureIngredientAliasesTable(): Promise<void> {
  if (ensured) return;
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS ingredient_aliases_cache (
      name TEXT PRIMARY KEY,
      aliases JSONB NOT NULL,
      corrected TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    ensured = true;
  })();
  try {
    await ensurePromise;
  } finally {
    ensurePromise = null;
  }
}

function normaliseKey(name: string): string {
  const base = (name || '').trim().toLowerCase();
  if (!base) return '';
  return `${CACHE_VERSION}:${base}`;
}

export interface IngredientAliasRow {
  aliases: string[];
  corrected: string | null;
}

export async function readIngredientAliases(name: string): Promise<IngredientAliasRow | null> {
  const key = normaliseKey(name);
  if (!key) return null;
  try {
    await ensureIngredientAliasesTable();
    const rows: any[] = await sql`
      SELECT aliases, corrected
      FROM ingredient_aliases_cache
      WHERE name = ${key} AND expires_at > NOW()
      LIMIT 1`;
    const row = rows?.[0];
    if (!row) return null;
    return {
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
      corrected: row.corrected || null,
    };
  } catch (e) {
    console.warn('readIngredientAliases failed:', e);
    return null;
  }
}

export async function writeIngredientAliases(
  name: string,
  data: IngredientAliasRow,
  ttlMs: number = ALIAS_CACHE_TTL_MS,
): Promise<void> {
  const key = normaliseKey(name);
  if (!key) return;
  try {
    await ensureIngredientAliasesTable();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    await sql`
      INSERT INTO ingredient_aliases_cache (name, aliases, corrected, expires_at, updated_at)
      VALUES (${key}, ${JSON.stringify(data.aliases || [])}::jsonb, ${data.corrected || null}, ${expiresAt}, NOW())
      ON CONFLICT (name) DO UPDATE
        SET aliases = EXCLUDED.aliases,
            corrected = EXCLUDED.corrected,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()`;
  } catch (e) {
    console.warn('writeIngredientAliases failed:', e);
  }
}

// ---- Google scraper ---------------------------------------------------

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ''));
}

async function fetchGoogleSpellCorrection(original: string): Promise<string | null> {
  // Google's web /search endpoint requires JS execution and returns a
  // useless gate page to plain HTTP clients. The autocomplete endpoint
  // (used by the Firefox / Chrome address bars) doesn't, and its first
  // suggestion is reliably the spell-corrected term when the input is a
  // misspelling. e.g. "tumeric" → ["tumeric", ["turmeric", ...]].
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(`https://www.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(original)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': UA, 'Accept': 'application/json,text/javascript' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    const suggestions: string[] = Array.isArray(json?.[1]) ? json[1] : [];
    if (suggestions.length === 0) return null;
    const top = (suggestions[0] || '').toString().trim();
    const originalLc = original.trim().toLowerCase();
    if (!top) return null;
    if (top.toLowerCase() === originalLc) return null;
    // Only treat the first suggestion as a correction when it differs by
    // a small edit distance — otherwise it's just an autocomplete (the
    // user typed a real word that Google extended to a longer phrase).
    if (Math.abs(top.length - original.length) > 5) return null;
    if (top.toLowerCase().startsWith(originalLc) || originalLc.startsWith(top.toLowerCase())) return null;
    if (top.length > 40) return null;
    return top;
  } catch {
    return null;
  }
}

function extractAliases(text: string, original: string): string[] {
  const found = new Set<string>();
  const lc = (s: string) => s.toLowerCase().trim();
  const originalLc = lc(original);
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Patterns we mine for. Wikipedia leads also use a "X, or Y, is..."
  // structure (the second name is the binomial / alternate), so we
  // include that as a dedicated pattern keyed off the original name.
  const phraseRes: RegExp[] = [
    // "(also) known/called/referred to as Y, Z"
    /(?:(?:also|otherwise|commonly|sometimes)\s+)?(?:known|called|referred to)\s+as\s+([A-Za-z][A-Za-z0-9 ,'’\-/&]{2,200}?)(?=[.!?\n;()]|$)/gi,
    // "Another name for X is Y" / "Another Name for X: Y"
    /another name (?:for [^.:]{1,40})?(?:\s+is|:)\s+([A-Za-z][A-Za-z0-9 ,'’\-/&]{2,200}?)(?=[.!?\n;()]|$)/gi,
    // "synonyms: Y, Z", "aliases: Y", "locally known as Y"
    /(?:synonyms?[:\s]+|aliases?[:\s]+|locally (?:known|called) as)\s+([A-Za-z][A-Za-z0-9 ,'’\-/&]{2,200}?)(?=[.!?\n;()]|$)/gi,
    // "X, or Y, is …" / "X (also Y)" — common in Wikipedia leads.
    new RegExp(`${escaped}\\s*[,(]\\s*(?:or|also|aka)\\s+([A-Za-z][A-Za-z0-9 ,'’\\-/&]{2,160}?)(?=[,)]|\\s+is|\\s+are|\\s+was|\\s+were|\\s+\\(|$)`, 'gi'),
  ];

  for (const re of phraseRes) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const list = m[1];
      // Split on commas, " and ", " or ", slashes, semicolons
      const parts = list.split(/,| and | or |\/|;/i).map(p => p.trim()).filter(Boolean);
      for (const part of parts) {
        const cleaned = part
          .replace(/^(the|a|an)\s+/i, '')
          .replace(/[.,;:"]+$/g, '')
          .replace(/^["']+|["']+$/g, '')
          .trim();
        if (cleaned.length < 2 || cleaned.length > 50) continue;
        if (lc(cleaned) === originalLc) continue;
        // Skip if the original name is a substring of the candidate
        // (avoids "cilantro leaves" being surfaced as an alias of
        // "cilantro").
        if (lc(cleaned).includes(originalLc) || originalLc.includes(lc(cleaned))) continue;
        if (!/[A-Za-z]/.test(cleaned)) continue;
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount > 5) continue;
        if (/\b(is|are|was|were|has|have|the)\b/i.test(cleaned) && wordCount > 2) continue;
        // Reject snippet/title artefacts that slip past the verb check
        // (possessives, marketing words, recipe-blog cruft).
        if (/'s\s/i.test(cleaned)) continue;
        if (/\b(explained|guide|tips|benefits|recipe|identity|uses|review|story|introduction|overview|definition|meaning|wikipedia)\b/i.test(cleaned)) continue;
        // De-dupe case-insensitively
        if ([...found].some(f => lc(f) === lc(cleaned))) continue;
        found.add(cleaned);
        if (found.size >= 5) break;
      }
      if (found.size >= 5) break;
    }
    if (found.size >= 5) break;
  }

  return Array.from(found).slice(0, 5);
}

interface WikiSummary {
  title?: string;
  extract?: string;
  description?: string;
  type?: string;
}

async function fetchWikipediaSummary(name: string): Promise<WikiSummary | null> {
  // Wikipedia's REST summary endpoint follows redirects (so misspelled
  // titles resolve to the canonical name) and returns the lead-paragraph
  // extract in plain text — perfect for both spell-correction and alias
  // mining. No auth, no JS, generous rate limits for unauthenticated
  // requests.
  const slug = name.trim().replace(/\s+/g, '_');
  if (!slug) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'HACCP-PRO/1.0 (ingredient alias lookup)', 'Accept': 'application/json' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const json: any = await res.json().catch(() => null);
    if (!json || json.type === 'disambiguation') return null;
    return {
      title: json.title,
      extract: json.extract,
      description: json.description,
      type: json.type,
    };
  } catch {
    return null;
  }
}

function correctedFromWiki(summary: WikiSummary | null, original: string): string | null {
  if (!summary?.title) return null;
  const originalLc = original.trim().toLowerCase();
  const titleLc = summary.title.trim().toLowerCase();
  if (titleLc === originalLc) return null;
  // Only treat as a spell-correction if the redirect-resolved title is
  // close to the original. Otherwise it's just Wikipedia routing us to
  // a parent article (e.g. "ghee" → "Clarified butter") which is useful
  // info but not a "did you mean".
  if (Math.abs(titleLc.length - originalLc.length) > 6) return null;
  // Substring relationship is fine for short corrections like
  // "tumeric" → "Turmeric" (one is a transposition, not a substring).
  if (titleLc.includes(originalLc) || originalLc.includes(titleLc)) return null;
  if (summary.title.length > 60) return null;
  return summary.title;
}

function aliasesFromWiki(summary: WikiSummary | null, original: string): string[] {
  if (!summary?.extract) return [];
  // Wikipedia leads commonly use phrasings like:
  //   "X, also known as Y, …"
  //   "The leaves are known as cilantro"
  //   "X (also called Y or Z)"
  // The extractor below uses the same shared regex as the snippet
  // miner, but Wikipedia text is dense and clean so hit-rate is high.
  return extractAliases(summary.extract, original);
}

export async function scrapeGoogleAliases(name: string): Promise<IngredientAliasRow> {
  const trimmed = (name || '').trim();
  if (!trimmed) return { aliases: [], corrected: null };

  // Three parallel sources, each with its own timeout. Wikipedia is
  // primary (most reliable & generous to bots); Google autocomplete is
  // a tie-breaker for spellings Wikipedia doesn't redirect; DuckDuckGo
  // HTML occasionally adds a few more aliases when it's not throttling
  // us — its empty/throttled responses are ignored gracefully.
  const [wikiSummary, googleCorrection] = await Promise.all([
    fetchWikipediaSummary(trimmed),
    fetchGoogleSpellCorrection(trimmed),
  ]);

  const wikiAliases = aliasesFromWiki(wikiSummary, trimmed);
  const wikiCorrection = correctedFromWiki(wikiSummary, trimmed);

  const corrected = wikiCorrection || googleCorrection;
  const aliases = Array.from(new Set(wikiAliases)).slice(0, 5);

  return { aliases, corrected };
}
