import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { sanitizeNewsHtml } from '@/lib/sanitizeNewsHtml';
import { normalizeImageUrl } from '@/lib/normalizeImageUrl';

// JSONB-backed CRUD for the "Daily Food Safety Tips" surfaced on the
// public landing page. Mirrors the existing academy_* endpoints in
// shape: GET returns { items }, POST upserts one or many, DELETE
// removes by { id } or { ids: [] }. ?public=1 returns only published
// rows ordered by published_on desc; ?slug=foo returns a single
// published tip by its slug (used by the /tips/[slug] reader page).

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_safety_tips (
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
      result = await sql`SELECT id, data FROM academy_safety_tips ORDER BY updated_at DESC`;
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    let items = rows.map((r: any) => ({ id: r.id, ...r.data }));

    if (isPublic) {
      // Lenient public filter: only hide tips that are *explicitly*
      // marked as draft or archived. An admin who adds a tip in
      // production without picking a status, or with a legacy /
      // unrecognised status string, should still see their tip on
      // the public landing page — silently swallowing it because
      // the status field happened to be empty or capitalised
      // differently was the source of a real production bug where
      // a published tip never appeared on the home page.
      items = items.filter((t: any) => {
        const s = String(t.status || '').trim().toLowerCase();
        return s !== 'draft' && s !== 'archived';
      });
    }
    if (slug) {
      const hit = items.find((t: any) => (t.slug || '').toLowerCase() === slug.toLowerCase());
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
    console.error('AcademySafetyTips: Failed to fetch:', error);
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
      // Sanitise the rich-text body the same way news posts are
      // sanitised so a malicious draft can never reach storage with
      // <script>, event handlers, or other XSS payloads — even if a
      // future author bypasses the client-side renderer's sanitiser.
      if (typeof data.body === 'string' && data.body) {
        data.body = sanitizeNewsHtml(data.body);
      }
      // Sanitise the optional Hindi body too.
      if (data.translations && typeof data.translations === 'object') {
        const hi = (data.translations as any).hi;
        if (hi && typeof hi.body === 'string' && hi.body) {
          hi.body = sanitizeNewsHtml(hi.body);
        }
      }
      // Rewrite Google-Drive share links pasted into the cover URL
      // so the bytes actually load (Drive otherwise serves an HTML
      // viewer page that browsers can't render as an image). Same
      // treatment for the optional share-thumbnail (used in OpenGraph
      // / Twitter card previews) so social platforms get a real image.
      if (typeof data.cover_image === 'string' && data.cover_image) {
        data.cover_image = normalizeImageUrl(data.cover_image);
      }
      if (typeof data.share_image === 'string' && data.share_image) {
        data.share_image = normalizeImageUrl(data.share_image);
      }
      if (!data.created_at) data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_safety_tips (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademySafetyTips: Failed to save:', error);
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
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_safety_tips WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_safety_tips WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademySafetyTips: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
