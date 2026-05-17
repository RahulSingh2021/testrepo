import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  ensureNewsKeywordsTable,
  clearGoogleNewsCache,
} from '../google-news/route';

// Admin-managed Google News keywords. Drives the Industry Trends
// column on the public home Live Intelligence Feed and the Industry
// Trends section of the public News tab. The Google News proxy at
// /api/academy/google-news reads this table directly; this route
// exposes admin CRUD plus a cache-bust endpoint for the "Refresh
// feed now" button.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Lang = 'en' | 'hi' | 'mix';

const normaliseLang = (v: unknown): Lang => {
  if (v === 'en' || v === 'hi') return v;
  return 'mix';
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    await ensureNewsKeywordsTable();
    let rows: any = null;
    try {
      rows = await sql`SELECT id, keyword, language, enabled, sort_order, created_at, updated_at,
                              last_fetched_at, last_result_count, last_error, last_error_at
                       FROM news_keywords
                       ORDER BY sort_order ASC, created_at ASC`;
    } catch {
      rows = null;
    }

    // Aggregate reader clicks per keyword by joining the article→keyword
    // map (populated when articles are fetched) against the click log.
    let clickRows: any[] = [];
    try {
      const result = await sql`SELECT m.keyword_id AS keyword_id, COUNT(c.id)::int AS clicks
                               FROM news_keyword_posts m
                               JOIN academy_news_clicks c
                                 ON c.post_id = m.post_id
                                AND c.feed_group = 'industry'
                               GROUP BY m.keyword_id`;
      clickRows = Array.isArray(result) ? result : [];
    } catch {
      clickRows = [];
    }
    const clicksByKeyword: Record<string, number> = {};
    for (const r of clickRows) {
      clicksByKeyword[String(r.keyword_id)] = Number(r.clicks || 0);
    }

    const items = Array.isArray(rows)
      ? rows.map((r: any) => ({
          id: String(r.id),
          keyword: String(r.keyword || ''),
          language: normaliseLang(r.language),
          enabled: r.enabled !== false,
          sort_order: Number(r.sort_order || 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
          last_fetched_at: r.last_fetched_at || null,
          last_result_count:
            r.last_result_count === null || r.last_result_count === undefined
              ? null
              : Number(r.last_result_count),
          last_error: r.last_error || null,
          last_error_at: r.last_error_at || null,
          click_count: clicksByKeyword[String(r.id)] || 0,
        }))
      : [];
    return NextResponse.json({ items });
  } catch (error) {
    console.error('NewsKeywords: GET failed', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);

  // Cache-bust shortcut for the admin "Refresh feed now" button.
  if (searchParams.get('refresh') === '1') {
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, refreshed: true });
  }

  try {
    await ensureNewsKeywordsTable();
    const body = await request.json();

    // Bulk reorder mode: { reorder: [{ id, sort_order }, ...] }
    if (Array.isArray(body?.reorder)) {
      for (const entry of body.reorder) {
        if (!entry || typeof entry.id !== 'string') continue;
        const order = Number(entry.sort_order);
        if (!Number.isFinite(order)) continue;
        await sql`UPDATE news_keywords SET sort_order = ${order}, updated_at = NOW()
                  WHERE id = ${entry.id}`;
      }
      clearGoogleNewsCache();
      return NextResponse.json({ success: true, count: body.reorder.length });
    }

    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((it: any) => it && typeof it === 'object');
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });

    let saved = 0;
    for (const item of items) {
      const id = typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `kw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const keyword = typeof item.keyword === 'string' ? item.keyword.trim() : '';
      if (!keyword) continue;
      const language = normaliseLang(item.language);
      const enabled = item.enabled !== false;
      const sortOrder = Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0;
      await sql`INSERT INTO news_keywords (id, keyword, language, enabled, sort_order, updated_at)
                VALUES (${id}, ${keyword}, ${language}, ${enabled}, ${sortOrder}, NOW())
                ON CONFLICT (id) DO UPDATE SET
                  keyword = EXCLUDED.keyword,
                  language = EXCLUDED.language,
                  enabled = EXCLUDED.enabled,
                  sort_order = EXCLUDED.sort_order,
                  updated_at = NOW()`;
      saved += 1;
    }
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, count: saved });
  } catch (error) {
    console.error('NewsKeywords: POST failed', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    await ensureNewsKeywordsTable();
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((s: any) => typeof s === 'string' && s.trim())
      : typeof body?.id === 'string' && body.id.trim()
        ? [body.id.trim()]
        : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
    }
    for (const id of ids) {
      await sql`DELETE FROM news_keywords WHERE id = ${id}`;
    }
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('NewsKeywords: DELETE failed', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
