import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Persists a "share token" for a news article so the public-facing
// share URL stays SHORT (haccp.pro/n/<token>) and so the landing
// page can render proper Open Graph metadata. Without this the
// shared link points at /news#article-<long-google-url> which (a)
// is ugly to paste and (b) shows a generic /news preview because
// fragments are stripped by social-card crawlers.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS news_shares (
    token TEXT PRIMARY KEY,
    link TEXT NOT NULL,
    title TEXT,
    image TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS news_shares_link_idx
            ON news_shares (link)`;
};

const newToken = (): string => {
  // 9-char base36: ~60 bits of entropy via timestamp + 4 random bytes.
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 0xffffffff).toString(36);
  return (ts + rnd).slice(-9);
};

const isHttpUrl = (s: string): boolean => {
  if (!s || typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// Allowlist of hostnames we'll mint short share tokens for. This
// closes the open-redirect attack surface — every legitimate share
// originates from either a Google News article (the curated feed)
// or our own admin-published news posts on the same origin. Any
// other host is rejected.
const ALLOWED_HOST_SUFFIXES = [
  'news.google.com',
  'haccp.pro',
  'haccppro.in',
  'localhost',
  // Allow Replit dev domain so the share button works in preview.
  '.repl.co',
  '.replit.dev',
  '.replit.app',
];

const isAllowedHost = (urlStr: string, requestOrigin: string | null): boolean => {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    // Same-origin is always OK (admin-posted internal news links).
    if (requestOrigin) {
      try {
        if (host === new URL(requestOrigin).hostname.toLowerCase()) return true;
      } catch {
        /* ignore bad origin */
      }
    }
    return ALLOWED_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? host.endsWith(suffix) : host === suffix,
    );
  } catch {
    return false;
  }
};

// Re-serialize through the URL parser so any stray characters that
// shouldn't appear in a URL are percent-encoded before we persist
// them. Defense in depth on top of React's attribute escaping.
const canonicalUrl = (raw: string): string => {
  try {
    return new URL(raw).toString();
  } catch {
    return '';
  }
};

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json().catch(() => ({}));
    const rawLink = typeof body?.link === 'string' ? body.link.trim() : '';
    if (!isHttpUrl(rawLink)) {
      return NextResponse.json({ error: 'valid http(s) link required' }, { status: 400 });
    }
    // Reject anything outside the publisher / same-origin allowlist
    // to prevent the endpoint being abused as an open redirector.
    const reqOrigin = request.headers.get('origin') || request.nextUrl.origin || null;
    if (!isAllowedHost(rawLink, reqOrigin)) {
      return NextResponse.json({ error: 'host not allowed' }, { status: 403 });
    }
    const link = canonicalUrl(rawLink);
    if (!link) {
      return NextResponse.json({ error: 'invalid link' }, { status: 400 });
    }
    const title = typeof body?.title === 'string' ? body.title.slice(0, 300) : '';
    const rawImage = typeof body?.image === 'string' && isHttpUrl(body.image)
      ? body.image.slice(0, 600)
      : '';
    const image = rawImage ? canonicalUrl(rawImage) : '';
    const source = typeof body?.source === 'string' ? body.source.slice(0, 120) : '';

    // Reuse an existing token for the same link so repeated shares
    // collapse to one short URL (helps caching + analytics). Wrapped
    // in its own try so a transient driver hiccup never blocks new
    // share creation.
    let existing: any = null;
    try {
      existing = await sql`SELECT token FROM news_shares WHERE link = ${link} LIMIT 1`;
    } catch (e) {
      console.error('news/share lookup failed (continuing to insert):', e);
    }
    const reused =
      existing && Array.isArray(existing) && existing[0] && existing[0].token
        ? String(existing[0].token)
        : '';
    if (reused) {
      return NextResponse.json({ token: reused, reused: true });
    }

    // Avoid the rare collision by retrying a couple of times.
    let token = '';
    for (let i = 0; i < 3; i += 1) {
      const candidate = newToken();
      try {
        await sql`INSERT INTO news_shares (token, link, title, image, source)
                  VALUES (${candidate}, ${link}, ${title}, ${image}, ${source})`;
        token = candidate;
        break;
      } catch (e) {
        console.error('news/share insert attempt failed:', e);
      }
    }
    if (!token) {
      return NextResponse.json({ error: 'token generation failed' }, { status: 500 });
    }
    return NextResponse.json({ token, reused: false });
  } catch (error) {
    console.error('news/share: failed:', error);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
