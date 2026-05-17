import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import sql from '@/lib/db';
import {
  loadCachedThumbnails,
  prefetchGoogleNewsThumbnails,
  resolveAndCacheThumbnail,
} from '@/lib/newsThumbnail';

// ── Auto-save helpers ───────────────────────────────────────────────
// Every Google News item we surface is also persisted into
// academy_news_posts so super admins can manage it (deactivate,
// re-categorise, edit) without depending on the in-memory cache.
// IDs are derived from a canonical form of the article URL, so
// repeat pulls of the same article are idempotent and ON CONFLICT
// DO NOTHING preserves any admin edits (status='draft'/etc.).

const canonicaliseLink = (raw: string): string => {
  const v = (raw || '').trim();
  if (!v) return '';
  try {
    const u = new URL(v);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.hash = '';
    const drop = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gclid', 'fbclid', 'mc_cid', 'mc_eid',
    ];
    for (const k of drop) u.searchParams.delete(k);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    const search = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${path}${search ? `?${search}` : ''}`;
  } catch {
    return v.toLowerCase().replace(/\/+$/, '');
  }
};

const slugifyForAutoSave = (s: string): string =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);

// Module-level flag so we only run the idempotent CREATE TABLE once
// per process lifetime instead of on every request (the table is
// owned by the news-posts route — this is a defensive belt-and-braces
// in case auto-save races a fresh deploy where news-posts hasn't been
// hit yet).
let academyNewsPostsTableReady = false;
const ensureAcademyNewsPostsTable = async (): Promise<boolean> => {
  if (academyNewsPostsTableReady) return true;
  try {
    await sql`CREATE TABLE IF NOT EXISTS academy_news_posts (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    academyNewsPostsTableReady = true;
    return true;
  } catch (e) {
    console.error('google-news: ensure academy_news_posts failed', e);
    return false;
  }
};

// Build a stable id for an article from its canonicalised URL. Same
// algorithm used by autoSaveItems below; reused by the suppression
// query so admin Hide actions can cross-reference live items.
const idForLink = (link: string): string => {
  const canon = canonicaliseLink(link);
  if (!canon) return '';
  return `gnews-${createHash('sha1').update(canon).digest('hex').slice(0, 16)}`;
};

// Set of gnews-* ids that the admin has deactivated (status='draft').
// We use this to suppress those items from the live response so a
// Hide click in admin actually removes the card from the public
// Industry Trends column. Failure to load the set is treated as
// "no suppressions" so a transient DB blip never breaks the feed.
const loadDeactivatedAutoIds = async (): Promise<Set<string>> => {
  const out = new Set<string>();
  if (!(await ensureAcademyNewsPostsTable())) return out;
  try {
    const rows = (await sql`SELECT id FROM academy_news_posts
                            WHERE id LIKE 'gnews-%'
                              AND data->>'status' = 'draft'`) as any;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (r && r.id) out.add(String(r.id));
      }
    }
  } catch (e) {
    console.error('google-news: failed to load deactivated ids', e);
  }
  return out;
};

const autoSaveItems = async (items: NewsItem[]): Promise<void> => {
  if (!items || items.length === 0) return;
  if (!(await ensureAcademyNewsPostsTable())) return;
  const todayIso = new Date().toISOString().slice(0, 10);
  for (const it of items) {
    if (!it || !it.link || !it.title) continue;
    const id = idForLink(it.link);
    if (!id) continue;
    const hash = id.slice('gnews-'.length);
    const slug = slugifyForAutoSave(it.title) || `gnews-${hash}`;
    const publishedDate = (() => {
      const ts = it.published_on ? Date.parse(it.published_on) : NaN;
      if (Number.isNaN(ts)) return todayIso;
      return new Date(ts).toISOString().slice(0, 10);
    })();
    const nowIso = new Date().toISOString();
    const data = {
      slug,
      title: it.title,
      category: 'General',
      excerpt: it.excerpt || '',
      body: '',
      cover_image: it.image || '',
      published_on: publishedDate,
      read_minutes: 2,
      status: 'published',
      author: it.source || '',
      feed_group: 'industry',
      external_url: it.link,
      content_type: 'link',
      pinned: false,
      auto_saved: true,
      source: 'google_news',
      translations: {
        hi: { title: '', category: 'सामान्य', excerpt: '', body: '' },
      },
      created_at: nowIso,
      updated_at: nowIso,
    };
    try {
      // ON CONFLICT DO NOTHING preserves any admin edits (e.g. an
      // editor flipped status to 'draft' to deactivate this row).
      // Without this, every re-pull would clobber their changes.
      await sql`INSERT INTO academy_news_posts (id, data)
                VALUES (${id}, ${JSON.stringify(data)}::jsonb)
                ON CONFLICT (id) DO NOTHING`;
    } catch (e) {
      console.error('google-news: auto-save upsert failed', e);
    }
  }
};

// Live Google News RSS proxy for the public home Live Intelligence
// Feed (Industry Trends column) and the News tab. The set of search
// queries is admin-managed (see /api/academy/news-keywords) and
// stored in the news_keywords table. Each keyword can be tagged with
// a language preference (en / hi / mix) which controls whether the
// English locale, Hindi locale, or both are fetched. Results are
// cached in-memory for ten minutes per (query, hl) pair so repeat
// page loads don't hammer the upstream. The cache can be cleared on
// demand via clearGoogleNewsCache() (used by the admin "Refresh feed
// now" button).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  source_domain: string;
  image: string;
  published_on: string;
  excerpt: string;
}

interface CacheEntry {
  expires: number;
  items: NewsItem[];
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export const clearGoogleNewsCache = () => {
  cache.clear();
};

const decodeEntities = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

const pick = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
};

const cleanDescription = (raw: string, title: string, source: string): string => {
  if (!raw) return '';
  let text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) {
    text = text.slice(title.length).trim();
  }
  if (source) {
    const tail = new RegExp(`${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    text = text.replace(tail, '').trim();
  }
  text = text.replace(/^[-–—:|·•\s]+/, '').replace(/[-–—:|·•\s]+$/, '');
  if (text.length > 220) text = text.slice(0, 217).trimEnd() + '…';
  return text;
};

const pickSourceUrl = (block: string): string => {
  const m = block.match(/<source[^>]*url=["']([^"']+)["'][^>]*>/i);
  return m ? m[1] : '';
};

const domainFromUrl = (u: string): string => {
  if (!u) return '';
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const parseRss = (xml: string): NewsItem[] => {
  const items: NewsItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = pick(block, 'title');
    const link = pick(block, 'link');
    const pubDate = pick(block, 'pubDate');
    const source = pick(block, 'source');
    const sourceUrl = pickSourceUrl(block);
    const description = pick(block, 'description');
    if (!title || !link) continue;
    let isoDate = '';
    if (pubDate) {
      const ts = Date.parse(pubDate);
      if (!Number.isNaN(ts)) isoDate = new Date(ts).toISOString();
    }
    const domain = domainFromUrl(sourceUrl);
    const image = domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      : '';
    items.push({
      id: link,
      title,
      link,
      source: source || 'Google News',
      source_domain: domain,
      image,
      published_on: isoDate,
      excerpt: cleanDescription(description, title, source || ''),
    });
  }
  return items;
};

// The seed keywords mirror the previous hardcoded CURATED_QUERIES
// list so existing public behaviour is preserved on first run before
// an admin customises the list.
const SEED_KEYWORDS: Array<{ keyword: string; language: 'en' | 'hi' | 'mix' }> = [
  { keyword: 'food safety India', language: 'mix' },
  { keyword: 'food safety WHO', language: 'mix' },
  { keyword: 'Codex Alimentarius', language: 'mix' },
  { keyword: 'USFDA food safety', language: 'mix' },
  { keyword: 'Food Safety Magazine', language: 'mix' },
];

interface KeywordRow {
  id: string;
  keyword: string;
  language: 'en' | 'hi' | 'mix';
  enabled: boolean;
  sort_order: number;
}

// News-media whitelist row. When at least one media row is enabled,
// the proxy keeps only items whose source_domain matches one of the
// configured domains (or whose source name matches case-insensitive)
// so admins can scope the public feeds to a hand-picked set of
// publishers (e.g. Reuters, BBC, The Hindu) regardless of which
// keyword surfaced them. When zero media rows are enabled, the
// publisher filter is OFF and every result is allowed through.
export interface MediaRow {
  id: string;
  name: string;
  domain: string;
  enabled: boolean;
  sort_order: number;
}

export const ensureNewsKeywordsTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS news_keywords (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'mix',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Per-keyword fetch telemetry. Added incrementally so older
  // installs pick up the columns without a manual migration.
  try {
    await sql`ALTER TABLE news_keywords ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ`;
    await sql`ALTER TABLE news_keywords ADD COLUMN IF NOT EXISTS last_result_count INTEGER`;
    await sql`ALTER TABLE news_keywords ADD COLUMN IF NOT EXISTS last_error TEXT`;
    await sql`ALTER TABLE news_keywords ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ`;
  } catch (e) {
    console.error('news_keywords: failed to add stats columns', e);
  }
  // Mapping from a Google News article (post_id == link) to the
  // keyword(s) that surfaced it. Lets the admin tab attribute reader
  // clicks back to specific keywords by joining academy_news_clicks
  // against this table. Multiple keywords can legitimately surface
  // the same article, so the primary key is the (keyword, post) pair.
  try {
    await sql`CREATE TABLE IF NOT EXISTS news_keyword_posts (
      keyword_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (keyword_id, post_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS news_keyword_posts_post_idx
              ON news_keyword_posts (post_id)`;
  } catch (e) {
    console.error('news_keyword_posts: failed to ensure table', e);
  }
  // Seed exactly once on first-time bootstrap. We track that with a
  // separate metadata table so deleting every row in news_keywords
  // (an explicit admin action) does NOT silently reintroduce the
  // legacy seed queries on the next request.
  await sql`CREATE TABLE IF NOT EXISTS app_kv_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  let seededRows: any = null;
  try {
    seededRows = await sql`SELECT value FROM app_kv_meta WHERE key = 'news_keywords_seeded' LIMIT 1`;
  } catch {
    seededRows = null;
  }
  const alreadySeeded = Array.isArray(seededRows) && seededRows.length > 0;
  if (alreadySeeded) return;
  // Migration safety: if a previous build already seeded the table
  // (before the seeded-marker existed), don't seed again — just write
  // the marker so future calls short-circuit.
  let countRows: any = null;
  try {
    countRows = await sql`SELECT COUNT(*)::int AS n FROM news_keywords`;
  } catch {
    countRows = null;
  }
  const existingCount = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].n || 0) : 0;
  if (existingCount > 0) {
    try {
      await sql`INSERT INTO app_kv_meta (key, value, updated_at)
                VALUES ('news_keywords_seeded', '1', NOW())
                ON CONFLICT (key) DO UPDATE SET value = '1', updated_at = NOW()`;
    } catch {
      /* ignore */
    }
    return;
  }
  for (let i = 0; i < SEED_KEYWORDS.length; i++) {
    const seed = SEED_KEYWORDS[i];
    const id = `seed-${i + 1}-${Date.now()}`;
    try {
      await sql`INSERT INTO news_keywords (id, keyword, language, enabled, sort_order)
                VALUES (${id}, ${seed.keyword}, ${seed.language}, TRUE, ${i})`;
    } catch {
      /* ignore seed conflicts */
    }
  }
  try {
    await sql`INSERT INTO app_kv_meta (key, value, updated_at)
              VALUES ('news_keywords_seeded', '1', NOW())
              ON CONFLICT (key) DO UPDATE SET value = '1', updated_at = NOW()`;
  } catch {
    /* if the marker insert fails we'll retry on next call — harmless */
  }
};

// Per-request thumbnail enrichment. The persistent cache, fetcher,
// and og:image extractor live in `lib/newsThumbnail` so the
// promotion path can reuse them. This module just orchestrates the
// burst-with-budget pattern over the live feed items.
const THUMB_RESOLVE_BUDGET_MS = 3000;
const THUMB_CONCURRENCY = 5;

const runWithConcurrency = async <T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const workers: Promise<void>[] = [];
  const worker = async () => {
    while (true) {
      const idx = next++;
      if (idx >= tasks.length) return;
      results[idx] = await tasks[idx]();
    }
  };
  for (let i = 0; i < Math.min(limit, tasks.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
};

const applyThumbnails = async (items: NewsItem[]): Promise<void> => {
  if (items.length === 0) return;
  const links = items.map((it) => it.link).filter(Boolean);
  const cached = await loadCachedThumbnails(links);

  // Pin cache hits onto items immediately (overrides favicon).
  const misses: NewsItem[] = [];
  for (const it of items) {
    if (cached.has(it.link)) {
      const hit = cached.get(it.link);
      if (hit) it.image = hit;
      // null hit = previously resolved to nothing; keep favicon, skip refetch.
    } else {
      misses.push(it);
    }
  }
  if (misses.length === 0) return;

  // Deduplicate concurrent resolutions of the same link.
  const seen = new Set<string>();
  const targets = misses.filter((it) => {
    if (seen.has(it.link)) return false;
    seen.add(it.link);
    return true;
  });

  const resolveOne = async (it: NewsItem) => {
    const img = await resolveAndCacheThumbnail(it.link);
    if (img) it.image = img;
    return img;
  };

  const tasks = targets.map((it) => () => resolveOne(it));
  const allDone = runWithConcurrency(tasks, THUMB_CONCURRENCY);
  // Don't let a slow publisher hold up the response: race against
  // the outer budget and let stragglers finish in the background
  // (their results still hit the cache for the next request). Clear
  // the budget timer when allDone wins so we don't leak handles
  // under load.
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    budgetTimer = setTimeout(resolve, THUMB_RESOLVE_BUDGET_MS);
  });
  await Promise.race([allDone.then(() => {}), budget]);
  if (budgetTimer) clearTimeout(budgetTimer);
  // Detach the full run so background completions still persist.
  allDone.catch(() => {});
};

// Mirror of the keywords table for the publisher whitelist. The
// table is created on first read so a fresh deploy doesn't need a
// migration. We deliberately do NOT seed any rows — empty means
// "no publisher restriction" (everything passes), which matches
// the previous behaviour exactly.
export const ensureNewsMediaTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS news_media (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const normaliseDomain = (raw: string): string => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  // Accept full URLs OR bare hostnames; strip protocol, path, www.
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return v.replace(/^www\./, '').split('/')[0];
  }
};

export const loadEnabledMedia = async (): Promise<MediaRow[]> => {
  await ensureNewsMediaTable();
  let rows: any = null;
  try {
    rows = await sql`SELECT id, name, domain, enabled, sort_order
                     FROM news_media
                     WHERE enabled = TRUE
                     ORDER BY sort_order ASC, created_at ASC`;
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name || '').trim(),
    domain: normaliseDomain(r.domain || ''),
    enabled: r.enabled !== false,
    sort_order: Number(r.sort_order || 0),
  })).filter((r) => r.name.length > 0 || r.domain.length > 0);
};

const loadEnabledKeywords = async (): Promise<KeywordRow[]> => {
  await ensureNewsKeywordsTable();
  let rows: any = null;
  try {
    rows = await sql`SELECT id, keyword, language, enabled, sort_order
                     FROM news_keywords
                     WHERE enabled = TRUE
                     ORDER BY sort_order ASC, created_at ASC`;
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    id: String(r.id),
    keyword: String(r.keyword || '').trim(),
    language: r.language === 'en' || r.language === 'hi' ? r.language : 'mix',
    enabled: r.enabled !== false,
    sort_order: Number(r.sort_order || 0),
  })).filter((r) => r.keyword.length > 0);
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '8', 10) || 8));

  let keywords: KeywordRow[] = [];
  try {
    keywords = await loadEnabledKeywords();
  } catch (e) {
    console.error('google-news: failed to load admin keywords', e);
  }

  if (keywords.length === 0) {
    return NextResponse.json({
      items: [],
      cached: false,
      mixed: false,
      empty: true,
    });
  }

  const fetchOne = async (
    query: string,
    hl: 'en-IN' | 'hi-IN',
  ): Promise<{ items: NewsItem[]; cached: boolean; error?: string; freshlyFetched: boolean }> => {
    const cacheKey = `${query}|${hl}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      return { items: cached.items, cached: true, freshlyFetched: false };
    }
    const ceid = hl === 'hi-IN' ? 'IN:hi' : 'IN:en';
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query,
    )}&hl=${hl}&gl=IN&ceid=${ceid}`;
    // 15s gives Google News RSS enough headroom on production egress
    // (the original 6s budget tripped routinely with the generic
    // "This operation was aborted" error even when the upstream
    // would have responded a second or two later).
    const FETCH_TIMEOUT_MS = 15000;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    try {
      // Google News routinely 503's non-browser UAs from cloud egress
      // IPs (e.g. our deployment), so we present as a real Chrome
      // build and fall back to a public CORS proxy on 5xx so the
      // production server can still pull the feed when its egress IP
      // gets rate-limited.
      const BROWSER_UA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const fetchWithFallback = async (target: string): Promise<Response> => {
        const direct = await fetch(target, {
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          cache: 'no-store',
          signal: ac.signal,
        });
        if (direct.ok || direct.status < 500) return direct;
        // Public proxy fallback when Google blocks the deployment IP.
        const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
        return fetch(proxied, {
          headers: { 'User-Agent': BROWSER_UA },
          cache: 'no-store',
          signal: ac.signal,
        });
      };
      const upstream = await fetchWithFallback(url);
      if (!upstream.ok) {
        throw new Error(`Google News returned HTTP ${upstream.status}`);
      }
      const xml = await upstream.text();
      const items = parseRss(xml);
      // Best-effort: scrape Google News' HTML /search endpoint for
      // the same query to pull real publisher hero images out of the
      // base64 jslog blobs and persist them to news_thumbnail_cache.
      // This is the only reliable way to enrich Google News items
      // since the RSS feed only exposes publisher favicons and the
      // article intermediary pages don't expose og:image. Mutates
      // each item.image in place when a match is found, so the
      // first response already shows real images. We bound it with
      // its own timeout so a slow upstream doesn't hold up the
      // feed.
      // Race the per-query hero-image scrape against a tight budget
      // so it can in-flight populate items.image when fast, but never
      // delays the response when slow. Stragglers still finish in
      // the background and persist to news_thumbnail_cache for the
      // next request.
      const PREFETCH_RACE_MS = 2500;
      const prefetch = prefetchGoogleNewsThumbnails(query, hl, items).catch(
        (e) => {
          console.error(
            `google-news: thumbnail prefetch failed [${query}|${hl}]:`,
            e instanceof Error ? e.message : e,
          );
        },
      );
      await Promise.race([
        prefetch,
        new Promise<void>((resolve) => setTimeout(resolve, PREFETCH_RACE_MS)),
      ]);
      if (items.length > 0) {
        cache.set(cacheKey, { expires: now + CACHE_TTL_MS, items });
      }
      return { items, cached: false, freshlyFetched: true };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'fetch failed';
      // Translate the cryptic browser/Node abort message into a label
      // editors can actually act on. Anything else passes through so
      // upstream HTTP codes / DNS failures are still visible.
      const isAbort =
        (err as any)?.name === 'AbortError' ||
        /aborted/i.test(rawMsg);
      const msg = isAbort
        ? `Upstream timeout (Google News took >${FETCH_TIMEOUT_MS / 1000}s for ${hl})`
        : rawMsg;
      console.error(`google-news upstream failed [${query}|${hl}]:`, msg);
      const stale = cache.get(cacheKey);
      return {
        items: stale ? stale.items : [],
        cached: !!stale,
        // Suppress the persisted error when we still served cached
        // items — the editor sees the headline count it expects and
        // doesn't need a red banner for a transient blip.
        error: stale && stale.items.length > 0 ? undefined : msg,
        freshlyFetched: true,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Build the (query × locale) plan based on each keyword's own
  // language preference. We keep the per-keyword grouping so we can
  // record fetch telemetry (count, error, post mappings) per keyword
  // after the upstream calls resolve.
  let anyMixed = false;
  const perKeyword = keywords.map((kw) => {
    const locales: Array<'en-IN' | 'hi-IN'> =
      kw.language === 'en'
        ? ['en-IN']
        : kw.language === 'hi'
          ? ['hi-IN']
          : ['en-IN', 'hi-IN'];
    if (locales.length > 1) anyMixed = true;
    return {
      kw,
      promise: Promise.all(locales.map((hl) => fetchOne(kw.keyword, hl))),
    };
  });
  const grouped = await Promise.all(
    perKeyword.map(async (g) => ({ kw: g.kw, results: await g.promise })),
  );

  // Persist per-keyword telemetry (fire and forget). We only update
  // stats for keywords whose locales actually hit the upstream this
  // request — purely cached responses leave last_fetched_at alone so
  // it accurately reflects the time of the last live network call.
  const statsTasks: Promise<unknown>[] = [];
  for (const g of grouped) {
    const fresh = g.results.filter((r) => r.freshlyFetched);
    if (fresh.length === 0) continue;
    const totalCount = fresh.reduce((s, r) => s + r.items.length, 0);
    const errors = fresh.map((r) => r.error).filter((e): e is string => !!e);
    const errorMsg = errors.length > 0 ? errors.join(' | ').slice(0, 500) : null;
    statsTasks.push(
      (async () => {
        try {
          if (errorMsg) {
            await sql`UPDATE news_keywords
                      SET last_fetched_at = NOW(),
                          last_result_count = ${totalCount},
                          last_error = ${errorMsg},
                          last_error_at = NOW()
                      WHERE id = ${g.kw.id}`;
          } else {
            await sql`UPDATE news_keywords
                      SET last_fetched_at = NOW(),
                          last_result_count = ${totalCount},
                          last_error = NULL
                      WHERE id = ${g.kw.id}`;
          }
        } catch (e) {
          console.error('news_keywords: failed to record stats', e);
        }
      })(),
    );
    // Map every surfaced article back to this keyword so reader
    // clicks (recorded in academy_news_clicks by post_id) can be
    // attributed to keywords later via JOIN.
    for (const r of fresh) {
      for (const it of r.items) {
        const postId = it.link;
        statsTasks.push(
          (async () => {
            try {
              await sql`INSERT INTO news_keyword_posts (keyword_id, post_id, last_seen_at)
                        VALUES (${g.kw.id}, ${postId}, NOW())
                        ON CONFLICT (keyword_id, post_id)
                        DO UPDATE SET last_seen_at = NOW()`;
            } catch {
              /* best-effort */
            }
          })(),
        );
      }
    }
  }
  // Don't block the response on telemetry writes.
  Promise.all(statsTasks).catch(() => {});

  // Merge + dedupe by link, sort newest-first.
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  const results = grouped.flatMap((g) => g.results);
  for (const r of results) {
    for (const it of r.items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      merged.push(it);
    }
  }
  merged.sort((a, b) => {
    const ta = a.published_on ? Date.parse(a.published_on) : 0;
    const tb = b.published_on ? Date.parse(b.published_on) : 0;
    return tb - ta;
  });

  // Apply admin-managed publisher whitelist. Each enabled media row
  // contributes either a domain (matched against the article's source
  // domain — exact OR suffix so e.g. "bbc.com" matches "news.bbc.com")
  // or a publisher name (case-insensitive substring against the
  // article's `source` field). An item passes if it matches ANY
  // enabled media row. With zero enabled rows, the filter is OFF.
  let filtered = merged;
  let mediaApplied = false;
  let mediaCount = 0;
  let droppedByMedia = 0;
  try {
    const media = await loadEnabledMedia();
    mediaCount = media.length;
    if (media.length > 0) {
      mediaApplied = true;
      const domains = media.map((m) => m.domain).filter(Boolean);
      const names = media.map((m) => m.name.toLowerCase()).filter(Boolean);
      filtered = merged.filter((it) => {
        const itemDomain = (it.source_domain || '').toLowerCase();
        const itemSource = (it.source || '').toLowerCase();
        const domainHit = !!itemDomain && domains.some(
          (d) => itemDomain === d || itemDomain.endsWith(`.${d}`),
        );
        const nameHit = !!itemSource && names.some((n) => itemSource.includes(n));
        return domainHit || nameHit;
      });
      droppedByMedia = merged.length - filtered.length;
    }
  } catch (e) {
    console.error('google-news: failed to apply media whitelist', e);
  }

  // Suppress items whose corresponding auto-saved row was deactivated
  // by an admin (status='draft' on the gnews-{hash} row). Without
  // this, the Hide button in admin would only suppress the cached
  // copy in academy_news_posts — the live feed would still surface
  // the same article on the public Industry Trends column.
  const deactivatedIds = await loadDeactivatedAutoIds();
  const visiblePreLimit = deactivatedIds.size > 0
    ? filtered.filter((it) => !deactivatedIds.has(idForLink(it.link)))
    : filtered;
  const visible = visiblePreLimit.slice(0, limit);
  // Replace the publisher favicon with the real article hero image
  // (og:image) where we can resolve it within the budget. Cache hits
  // apply instantly; fresh resolutions race against a 3s budget and
  // any stragglers persist in the background for the next request.
  try {
    await applyThumbnails(visible);
  } catch (e) {
    console.error('google-news: thumbnail enrichment failed', e);
  }

  // Auto-persist every visible Google News item into academy_news_posts
  // so the super admin can curate them (deactivate / edit) without
  // chasing the in-memory cache. Fire-and-forget — never block the
  // response. ON CONFLICT DO NOTHING keeps admin edits intact.
  autoSaveItems(visible).catch((e) => {
    console.error('google-news: auto-save batch failed', e);
  });

  return NextResponse.json({
    items: visible,
    cached: results.length > 0 && results.every((r) => r.cached),
    mixed: anyMixed,
    keyword_count: keywords.length,
    media_applied: mediaApplied,
    media_count: mediaCount,
    dropped_by_media: droppedByMedia,
  });
}
