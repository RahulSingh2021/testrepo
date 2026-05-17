import sql from '@/lib/db';

// Shared thumbnail resolver + Postgres cache for Google-News-sourced
// articles. Used both by the live feed (`/api/academy/google-news`)
// and by the Industry Trends promotion path (`/api/academy/news-posts`)
// so that a saved post keeps the real publisher hero image even after
// the in-memory cache expires.

export const THUMB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const THUMB_FETCH_TIMEOUT_MS = 6000;
// Search-HTML scrape budget. Google News' /search HTML is ~2.5 MB so
// the parse alone takes a few hundred ms; we keep it well under the
// outer 3s thumbnail budget.
export const GNEWS_SEARCH_SCRAPE_TIMEOUT_MS = 5000;

let thumbCacheReady: Promise<void> | null = null;
export const ensureThumbnailCacheTable = async (): Promise<void> => {
  if (!thumbCacheReady) {
    thumbCacheReady = (async () => {
      try {
        await sql`CREATE TABLE IF NOT EXISTS news_thumbnail_cache (
          article_url TEXT PRIMARY KEY,
          image_url TEXT,
          resolved_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ
        )`;
        // One-shot cleanup of the negative-cache rows seeded by an
        // earlier resolver build that couldn't see through Google
        // News intermediary pages. Without this, every Google News
        // article would stay stuck on a favicon for the full 7-day
        // TTL even after we shipped the search-HTML scraper. The
        // process-lifetime guard prevents this from running on
        // every request.
        try {
          await sql`DELETE FROM news_thumbnail_cache WHERE image_url IS NULL`;
        } catch (e) {
          console.error('news_thumbnail_cache: clear negatives failed', e);
        }
      } catch (e) {
        console.error('news_thumbnail_cache: failed to ensure table', e);
        thumbCacheReady = null;
      }
    })();
  }
  return thumbCacheReady;
};

export const loadCachedThumbnails = async (
  links: string[],
): Promise<Map<string, string | null>> => {
  const out = new Map<string, string | null>();
  if (links.length === 0) return out;
  await ensureThumbnailCacheTable();
  try {
    const rows: any = await sql`SELECT article_url, image_url, expires_at
                                FROM news_thumbnail_cache
                                WHERE article_url = ANY(${links}::text[])`;
    if (Array.isArray(rows)) {
      const now = Date.now();
      for (const r of rows) {
        const exp = r.expires_at ? new Date(r.expires_at).getTime() : 0;
        if (!exp || exp > now) {
          out.set(String(r.article_url), r.image_url ? String(r.image_url) : null);
        }
      }
    }
  } catch (e) {
    console.error('news_thumbnail_cache: bulk lookup failed', e);
  }
  return out;
};

export const lookupCachedThumbnail = async (link: string): Promise<string | null | undefined> => {
  if (!link) return undefined;
  const m = await loadCachedThumbnails([link]);
  return m.has(link) ? m.get(link)! : undefined;
};

export const persistThumbnail = async (
  link: string,
  image: string | null,
): Promise<void> => {
  await ensureThumbnailCacheTable();
  try {
    const expires = new Date(Date.now() + THUMB_TTL_MS).toISOString();
    await sql`INSERT INTO news_thumbnail_cache (article_url, image_url, resolved_at, expires_at)
              VALUES (${link}, ${image}, NOW(), ${expires})
              ON CONFLICT (article_url) DO UPDATE
                SET image_url = ${image},
                    resolved_at = NOW(),
                    expires_at = ${expires}`;
  } catch (e) {
    console.error('news_thumbnail_cache: persist failed', e);
  }
};

const absoluteImageUrl = (raw: string, base: string): string => {
  if (!raw) return '';
  const v = raw.trim();
  if (!v) return '';
  if (/^data:/i.test(v)) return '';
  try {
    return new URL(v, base).toString();
  } catch {
    return '';
  }
};

// Decode the limited set of HTML entities that show up in og:title / og:description
// content attributes. We don't pull in a full entity decoder because these
// strings come from <meta content="…"> which is generally already escaped
// to just &amp; / &quot; / &#39; / &lt; / &gt; / numeric refs.
const decodeMetaEntities = (s: string): string => {
  if (!s) return '';
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
};

export interface PageMetadata {
  title: string;
  description: string;
  image: string;
  publisher: string;
  finalUrl: string;
}

// Extract og:title / og:description / og:site_name from a parsed HTML <head>.
// Falls back to twitter:* and <title>/<meta name="description"> when og:* is
// absent. All values are entity-decoded and trimmed; never returns null.
export const extractPageMetadata = (html: string, finalUrl: string): PageMetadata => {
  const out: PageMetadata = { title: '', description: '', image: '', publisher: '', finalUrl };
  if (!html) return out;
  const head = html.slice(0, 200_000);

  // Walk every <meta> once and remember the best candidate per slot. og:* wins
  // over twitter:* wins over name="description" / name="title".
  const metaRe = /<meta\b[^>]+>/gi;
  let m: RegExpExecArray | null;
  const slots: Record<string, { priority: number; value: string }> = {};
  const consider = (slot: string, priority: number, value: string) => {
    const v = decodeMetaEntities(value);
    if (!v) return;
    const cur = slots[slot];
    if (!cur || priority < cur.priority) slots[slot] = { priority, value: v };
  };
  while ((m = metaRe.exec(head))) {
    const tag = m[0];
    const propMatch = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!propMatch || !contentMatch) continue;
    const key = propMatch[1].toLowerCase();
    const value = contentMatch[1];
    if (!value) continue;
    if (key === 'og:title') consider('title', 1, value);
    else if (key === 'twitter:title') consider('title', 2, value);
    else if (key === 'title') consider('title', 4, value);
    else if (key === 'og:description') consider('description', 1, value);
    else if (key === 'twitter:description') consider('description', 2, value);
    else if (key === 'description') consider('description', 3, value);
    else if (key === 'og:site_name') consider('publisher', 1, value);
    else if (key === 'application-name') consider('publisher', 3, value);
  }
  // <title> tag fallback — many news sites still ship better content here than og:title.
  if (!slots.title) {
    const tt = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tt) consider('title', 5, tt[1].replace(/\s+/g, ' '));
  }
  out.title = slots.title?.value || '';
  out.description = slots.description?.value || '';
  out.publisher = slots.publisher?.value || '';
  out.image = extractOgImage(html, finalUrl);
  // Many publishers append " | Site Name" or " - Site Name" to the og:title;
  // strip that suffix when we already know the publisher so the headline reads
  // cleanly inside our card.
  if (out.title && out.publisher) {
    const suffix = new RegExp('\\s*[\\|\\-–—·»]\\s*' + out.publisher.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\s*$', 'i');
    out.title = out.title.replace(suffix, '').trim();
  }
  return out;
};

export const extractOgImage = (html: string, finalUrl: string): string => {
  if (!html) return '';
  const head = html.slice(0, 200_000);
  const metaRe = /<meta\b[^>]+>/gi;
  let m: RegExpExecArray | null;
  const candidates: Array<{ priority: number; url: string }> = [];
  while ((m = metaRe.exec(head))) {
    const tag = m[0];
    const propMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (!propMatch || !contentMatch) continue;
    const key = propMatch[1].toLowerCase();
    const value = contentMatch[1];
    if (!value) continue;
    if (key === 'og:image' || key === 'og:image:url' || key === 'og:image:secure_url') {
      candidates.push({ priority: 1, url: value });
    } else if (key === 'twitter:image' || key === 'twitter:image:src') {
      candidates.push({ priority: 2, url: value });
    }
  }
  const linkRe = /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i;
  const linkTag = head.match(linkRe);
  if (linkTag) {
    const href = linkTag[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href) candidates.push({ priority: 3, url: href[1] });
  }
  candidates.sort((a, b) => a.priority - b.priority);
  for (const c of candidates) {
    const abs = absoluteImageUrl(c.url, finalUrl);
    if (abs) return abs;
  }
  // First sufficiently-large <img> as a last resort.
  const imgRe = /<img\b[^>]+>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(head))) {
    const tag = im[0];
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!src) continue;
    const url = src[1];
    if (/\bsprite|icon|logo|avatar|blank|pixel|1x1|spacer\b/i.test(url)) continue;
    const w = parseInt((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1] || '0', 10);
    const h = parseInt((tag.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1] || '0', 10);
    if (w >= 200 || h >= 200 || (w === 0 && h === 0)) {
      const abs = absoluteImageUrl(url, finalUrl);
      if (abs) return abs;
    }
  }
  return '';
};

const PRIVATE_HOST_RE =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|ip6-localhost|ip6-loopback)$/i;
const isBlockedHost = (host: string): boolean => {
  if (!host) return true;
  const h = host.toLowerCase();
  if (PRIVATE_HOST_RE.test(h)) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  if (h.startsWith('[') && h.endsWith(']')) {
    const v6 = h.slice(1, -1);
    if (v6 === '::1' || v6 === '::') return true;
    if (/^fe80:/i.test(v6)) return true;
    if (/^f[cd]/i.test(v6)) return true;
  }
  return false;
};

export const isSafeUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return !isBlockedHost(u.hostname);
  } catch {
    return false;
  }
};

// Google News article URLs look like
// `https://news.google.com/rss/articles/<id>?...` or
// `https://news.google.com/articles/<id>?...`. The `<id>` is a
// base64-ish token (always starts with `CBM`) that uniquely
// identifies the article inside Google News.
const GNEWS_HOST_RE = /^news\.google\.com$/i;
const GNEWS_ARTICLE_ID_RE = /\/articles\/([A-Za-z0-9_-]+)/;

export const articleIdFromGoogleNewsLink = (link: string): string => {
  if (!link) return '';
  try {
    const u = new URL(link);
    if (!GNEWS_HOST_RE.test(u.hostname)) return '';
    const m = u.pathname.match(GNEWS_ARTICLE_ID_RE);
    return m ? m[1] : '';
  } catch {
    return '';
  }
};

// Google News' RSS feed gives us only the publisher favicon. Its
// per-article intermediary page hides the real publisher URL behind
// a JS-driven `batchexecute` POST, which Google has been gating with
// HTTP/3 errors for many users since late 2024. The reliable path
// instead is to fetch the same query against the HTML `/search`
// endpoint — Google renders article cards there with the publisher's
// real hero image embedded as a base64-encoded blob inside the
// `jslog` attribute. We pull that out and key it by the article ID
// extracted above.
const GNEWS_THUMB_BLOCKLIST_RE =
  /\bsprite|icon|logo|favicon|avatar|blank|pixel|spacer|placeholder\b/i;

export interface GoogleNewsSearchThumbnails {
  byId: Map<string, string>;
}

export const scrapeGoogleNewsSearchThumbnails = async (
  query: string,
  hl: 'en-IN' | 'hi-IN',
  timeoutMs: number = GNEWS_SEARCH_SCRAPE_TIMEOUT_MS,
): Promise<GoogleNewsSearchThumbnails> => {
  const byId = new Map<string, string>();
  if (!query) return { byId };
  const ceid = hl === 'hi-IN' ? 'IN:hi' : 'IN:en';
  const url = `https://news.google.com/search?q=${encodeURIComponent(
    query,
  )}&hl=${hl}&gl=IN&ceid=${ceid}`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    let res = await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      cache: 'no-store',
      headers: browserHeaders,
    });
    // Production-egress fallback: Google News routinely 503s our
    // deployment IP, so when the direct call fails with a server
    // error we retry through a public CORS proxy that forwards the
    // raw upstream HTML from a different IP.
    if (!res.ok && res.status >= 500) {
      const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      res = await fetch(proxied, {
        method: 'GET',
        signal: ac.signal,
        cache: 'no-store',
        headers: browserHeaders,
      });
    }
    if (!res.ok) {
      console.error(
        `gnews-search: scrape failed for [${query}|${hl}] HTTP ${res.status}`,
      );
      return { byId };
    }
    const html = await res.text();
    // Each article card renders as a `c-wiz` element. The image
    // URL lives inside a base64 JSON blob in `jslog="93789; 3:<b64>;
    // track:..."` and the article ID lives a few hundred bytes
    // later in `jsdata="oM6qxc;CBMi<id>"`. We pair them up by
    // proximity (≤8 KB apart). Each ID typically appears twice in
    // the HTML; we keep the first non-empty image we see.
    const pairRe =
      /jslog="[^"]*?3:([A-Za-z0-9+/=_-]+);[\s\S]{0,8000}?jsdata="[^"]*?(CBMi[A-Za-z0-9_-]{30,})/g;
    let m: RegExpExecArray | null;
    while ((m = pairRe.exec(html))) {
      const id = m[2];
      if (byId.has(id)) continue;
      let payload: string;
      try {
        payload = Buffer.from(m[1], 'base64').toString('utf8');
      } catch {
        continue;
      }
      const imgs =
        payload.match(
          /https?:\/\/[^",\]\[\s]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^",\]\[\s]*)?/gi,
        ) || [];
      const real = imgs.find((u) => !GNEWS_THUMB_BLOCKLIST_RE.test(u));
      if (real) byId.set(id, real);
    }
    return { byId };
  } catch {
    return { byId };
  } finally {
    clearTimeout(tid);
  }
};

// Per-query prefetch: scrape the Google News search HTML for the
// given (query, hl), match the resolved hero images against the
// items we already parsed from the RSS feed, and persist the result
// to the shared thumbnail cache so subsequent reads (including the
// promotion path in `/api/academy/news-posts`) get the real image
// for free. Mutates `it.image` in place when a match is found so
// the very first response also shows real images.
export const prefetchGoogleNewsThumbnails = async (
  query: string,
  hl: 'en-IN' | 'hi-IN',
  items: Array<{ link: string; image: string }>,
): Promise<void> => {
  if (items.length === 0) return;
  const targets = items.filter((it) => articleIdFromGoogleNewsLink(it.link));
  if (targets.length === 0) return;
  const { byId } = await scrapeGoogleNewsSearchThumbnails(query, hl);
  if (byId.size === 0) return;
  const writes: Promise<void>[] = [];
  for (const it of targets) {
    const id = articleIdFromGoogleNewsLink(it.link);
    const img = id ? byId.get(id) : '';
    if (img) {
      it.image = img;
      writes.push(persistThumbnail(it.link, img));
    }
  }
  // Detach persistence so the caller doesn't pay for cache writes.
  Promise.all(writes).catch(() => {});
};

// Decode the publisher URL embedded in a Google News article ID.
// Article IDs are base64url-encoded protobuf payloads of the form:
//   tag(0x08)+len+payload  where the payload contains the publisher
//   URL prefixed by a varint length byte. The encoding has changed
//   over the years; this best-effort decoder finds an `http(s)://`
//   substring inside the decoded bytes and reads the length byte
//   immediately preceding it. Works for the bulk of CBMi… IDs we
//   see today; returns '' on any failure so callers can fall back.
export const decodeGoogleNewsPublisherUrl = (articleId: string): string => {
  if (!articleId) return '';
  try {
    const padded = articleId + '='.repeat((4 - (articleId.length % 4)) % 4);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64, 'base64');
    const bin = buf.toString('binary');
    let needle = bin.indexOf('https://');
    let proto = 'https://';
    if (needle < 0) {
      needle = bin.indexOf('http://');
      proto = 'http://';
    }
    if (needle < 1) return '';
    // Length byte is immediately before the URL. Two-byte varint
    // (high bit set) is supported for URLs >= 128 chars.
    let urlLen = buf[needle - 1];
    let lenStart = needle - 1;
    if (urlLen >= 0x80 && needle >= 2) {
      urlLen = (buf[needle - 1] & 0x7f) | (buf[needle - 2] << 7);
      lenStart = needle - 2;
    }
    if (urlLen < proto.length || urlLen > 2048) return '';
    const url = buf.toString('utf8', needle, needle + urlLen);
    if (!url.startsWith(proto)) return '';
    // Validate as a real URL with a public host.
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (isBlockedHost(u.hostname)) return '';
    void lenStart; // mark used for clarity
    return url;
  } catch {
    return '';
  }
};

export const resolveArticleThumbnail = async (
  link: string,
  timeoutMs: number = THUMB_FETCH_TIMEOUT_MS,
): Promise<string> => {
  if (!isSafeUrl(link)) return '';
  // Google News intermediary URLs are JS shells with no og:image,
  // BUT the article ID is a base64-encoded protobuf that contains
  // the real publisher URL. We decode it and fetch the publisher's
  // page directly — bypassing Google entirely (so this works even
  // when Google blocks our deployment IP). On decode failure we
  // bail so we don't waste the budget.
  const articleId = articleIdFromGoogleNewsLink(link);
  let resolveTarget = link;
  if (articleId) {
    const publisherUrl = decodeGoogleNewsPublisherUrl(articleId);
    if (!publisherUrl) return '';
    resolveTarget = publisherUrl;
  }
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let current = resolveTarget;
    let res: Response | null = null;
    for (let hop = 0; hop < 6; hop++) {
      const r = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ac.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (!loc) return '';
        let next: string;
        try {
          next = new URL(loc, current).toString();
        } catch {
          return '';
        }
        if (!isSafeUrl(next)) return '';
        current = next;
        continue;
      }
      res = r;
      break;
    }
    if (!res || !res.ok) return '';
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return '';
    const html = await res.text();
    return extractOgImage(html, current);
  } catch {
    return '';
  } finally {
    clearTimeout(tid);
  }
};

// Resolve-and-persist: writes the result (including null) to the
// cache so subsequent callers don't re-scrape. Returns the resolved
// URL or '' on any failure / non-HTML / blocked redirect.
export const resolveAndCacheThumbnail = async (
  link: string,
  timeoutMs?: number,
): Promise<string> => {
  const img = await resolveArticleThumbnail(link, timeoutMs);
  await persistThumbnail(link, img || null);
  return img;
};

// Full-metadata variant of resolveArticleThumbnail. Used by the Quick-add
// news-link admin flow so the editor only needs to paste the URL — we
// pre-fill headline / excerpt / thumbnail from the publisher page. Same
// SSRF + Google-News decoding rules as the thumbnail resolver. Also
// caches the resolved image so the admin save path doesn't re-scrape.
export const resolveArticleMetadata = async (
  link: string,
  timeoutMs: number = THUMB_FETCH_TIMEOUT_MS,
): Promise<PageMetadata> => {
  const empty: PageMetadata = { title: '', description: '', image: '', publisher: '', finalUrl: link };
  if (!isSafeUrl(link)) return empty;
  const articleId = articleIdFromGoogleNewsLink(link);
  let resolveTarget = link;
  if (articleId) {
    const publisherUrl = decodeGoogleNewsPublisherUrl(articleId);
    if (!publisherUrl) return empty;
    resolveTarget = publisherUrl;
  }
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), timeoutMs);
  try {
    let current = resolveTarget;
    let res: Response | null = null;
    for (let hop = 0; hop < 6; hop++) {
      const r = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: ac.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (!loc) return empty;
        let next: string;
        try { next = new URL(loc, current).toString(); } catch { return empty; }
        if (!isSafeUrl(next)) return empty;
        current = next;
        continue;
      }
      res = r;
      break;
    }
    if (!res || !res.ok) return empty;
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(ct)) return empty;
    const html = await res.text();
    const meta = extractPageMetadata(html, current);
    // Warm the thumbnail cache so a subsequent save doesn't re-scrape.
    if (meta.image) {
      try { await persistThumbnail(link, meta.image); } catch { /* best-effort */ }
    }
    return meta;
  } catch {
    return empty;
  } finally {
    clearTimeout(tid);
  }
};
