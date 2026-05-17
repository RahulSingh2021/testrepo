import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sanitizeNewsHtml } from '@/lib/sanitizeNewsHtml';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';
import {
  lookupCachedThumbnail,
  resolveAndCacheThumbnail,
} from '@/lib/newsThumbnail';

// A "real" cover image is anything that isn't an empty string and
// isn't the Google favicon placeholder we synthesise for Google News
// rows. Used when promoting an Industry Trends item — if the editor
// hasn't supplied a richer image, we'll try the thumbnail cache (and
// fall back to a one-shot on-demand resolution if the cache is cold).
const isMissingOrFavicon = (url: string): boolean => {
  if (!url) return true;
  return /^https?:\/\/www\.google\.com\/s2\/favicons/i.test(url);
};

// Tight budget for the synchronous on-demand resolution at promotion
// time. Slightly under the typical admin-save UX threshold so a slow
// publisher doesn't make the editor feel hung — if it still misses,
// we save with no cover_image and let the next live-feed request
// warm the cache (the editor can reopen and resave to pick it up).
const PROMOTE_RESOLVE_TIMEOUT_MS = 4000;

const resolveCoverFromExternalUrl = async (
  externalUrl: string,
): Promise<string> => {
  // 1) Cache hit (positive or negative) wins immediately.
  const cached = await lookupCachedThumbnail(externalUrl);
  if (cached === null) return ''; // negative cache: don't re-scrape
  if (cached) return cached;
  // 2) Cold cache → on-demand resolution within a short budget. The
  //    resolver writes the result (including null) back to the cache
  //    so subsequent saves and the live feed both benefit.
  return resolveAndCacheThumbnail(externalUrl, PROMOTE_RESOLVE_TIMEOUT_MS);
};

// JSONB-backed CRUD for "Food Safety News" posts surfaced on the
// public landing page and read at /news/<slug>. Mirrors the existing
// academy_* endpoints in shape. ?public=1 returns only published
// rows ordered by published_on desc; ?slug=foo returns a single
// published post by its slug (used by the /news/[slug] reader page).

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_news_posts (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const isPublic = searchParams.get('public') === '1' || !!slug;

    let result;
    try {
      result = await sql`SELECT id, data FROM academy_news_posts ORDER BY updated_at DESC`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    let items = rows.map((r: any) => ({ id: r.id, ...r.data }));

    if (isPublic) {
      items = items.filter((n: any) => (n.status || 'published') === 'published');
    }
    if (slug) {
      const hit = items.find((n: any) => (n.slug || '').toLowerCase() === slug.toLowerCase());
      return NextResponse.json({ item: hit || null });
    }
    if (isPublic) {
      items = items.sort((a: any, b: any) => {
        const da = a.published_on ? Date.parse(a.published_on) : 0;
        const db = b.published_on ? Date.parse(b.published_on) : 0;
        return db - da;
      });
    }
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyNewsPosts: Failed to fetch:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;
    await ensureTable();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });
    for (const item of items) {
      const { id, ...data } = item;
      if (typeof data.body === 'string' && data.body) {
        // Sanitise on save so a malicious draft can never reach storage with
        // <script>, event handlers, or other XSS payloads — even if a
        // future author bypasses the client-side renderer's sanitiser.
        data.body = sanitizeNewsHtml(data.body);
      }
      // Sanitise optional Hindi body too (mirrors the EN allowlist).
      if (data.translations && typeof data.translations === 'object') {
        const hi = (data.translations as any).hi;
        if (hi && typeof hi.body === 'string' && hi.body) {
          hi.body = sanitizeNewsHtml(hi.body);
        }
      }
      // Rewrite Google-Drive share links pasted into the cover URL
      // so the bytes actually load (otherwise Drive serves an HTML
      // viewer page that browsers can't render as an image).
      if (typeof data.cover_image === 'string' && data.cover_image) {
        data.cover_image = normalizeImageUrl(data.cover_image);
      }
      // Industry Trends override flow: when an admin promotes a
      // Google News item to a stored post, the cover_image will
      // either be empty or the publisher favicon. Try the
      // thumbnail cache first; fall back to a one-shot synchronous
      // resolution within a short budget. We never persist the
      // favicon for a promoted post — if both lookups fail we save
      // with an empty cover_image and let a future request warm
      // the cache.
      const externalUrl =
        typeof data.external_url === 'string' ? data.external_url.trim() : '';
      if (externalUrl) {
        const coverIsPlaceholder = isMissingOrFavicon(String(data.cover_image || ''));
        if (coverIsPlaceholder) {
          let resolved = '';
          try {
            resolved = await resolveCoverFromExternalUrl(externalUrl);
          } catch (e) {
            console.error('news-posts: thumbnail resolve failed', e);
          }
          // Strip the favicon placeholder regardless — saving the
          // real og:image when we have it, otherwise empty so the
          // card uses its tone-coloured gradient until the cache
          // catches up.
          data.cover_image = resolved || '';
        }
      }
      if (!data.created_at) data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_news_posts (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyNewsPosts: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const unauthorized = await requireAdminSession(request);
    if (unauthorized) return unauthorized;
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_news_posts WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_news_posts WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyNewsPosts: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
