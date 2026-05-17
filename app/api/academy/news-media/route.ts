import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import {
  ensureNewsMediaTable,
  clearGoogleNewsCache,
} from '../google-news/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normaliseDomain = (raw: string): string => {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return v.replace(/^www\./, '').split('/')[0];
  }
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    await ensureNewsMediaTable();
    let rows: any = null;
    try {
      rows = await sql`SELECT id, name, domain, enabled, sort_order, created_at, updated_at
                       FROM news_media
                       ORDER BY sort_order ASC, created_at ASC`;
    } catch {
      rows = null;
    }
    const items = Array.isArray(rows)
      ? rows.map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ''),
          domain: String(r.domain || ''),
          enabled: r.enabled !== false,
          sort_order: Number(r.sort_order || 0),
          created_at: r.created_at,
          updated_at: r.updated_at,
        }))
      : [];
    return NextResponse.json({ items });
  } catch (error) {
    console.error('NewsMedia: GET failed', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('refresh') === '1') {
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, refreshed: true });
  }

  try {
    await ensureNewsMediaTable();
    const body = await request.json();

    if (Array.isArray(body?.reorder)) {
      for (const entry of body.reorder) {
        if (!entry || typeof entry.id !== 'string') continue;
        const order = Number(entry.sort_order);
        if (!Number.isFinite(order)) continue;
        await sql`UPDATE news_media SET sort_order = ${order}, updated_at = NOW()
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
        : `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const domain = normaliseDomain(item.domain || '');
      // A row must have at least a name OR a domain to be useful as a
      // filter. Reject blanks loudly so the admin form can show the
      // error rather than silently writing junk.
      if (!name && !domain) continue;
      const enabled = item.enabled !== false;
      const sortOrder = Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0;
      await sql`INSERT INTO news_media (id, name, domain, enabled, sort_order, updated_at)
                VALUES (${id}, ${name}, ${domain}, ${enabled}, ${sortOrder}, NOW())
                ON CONFLICT (id) DO UPDATE SET
                  name = EXCLUDED.name,
                  domain = EXCLUDED.domain,
                  enabled = EXCLUDED.enabled,
                  sort_order = EXCLUDED.sort_order,
                  updated_at = NOW()`;
      saved += 1;
    }
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, count: saved });
  } catch (error) {
    console.error('NewsMedia: POST failed', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = await requireAdminSession(request);
  if (unauthorized) return unauthorized;
  try {
    await ensureNewsMediaTable();
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
      await sql`DELETE FROM news_media WHERE id = ${id}`;
    }
    clearGoogleNewsCache();
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('NewsMedia: DELETE failed', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
