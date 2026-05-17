import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// JSONB-backed CRUD for the public Jobs board (components/JobsPage.tsx).
// ?public=1 returns only published rows ordered most-recent-first.
// POST/DELETE require an admin session token (mirrors news-posts).

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS jobs_posts (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

const FUNCTIONAL_AREAS = ['Quality', 'Production', 'Regulatory', 'R&D'] as const;
const EMPLOYMENTS = ['Full-time', 'Contract', 'Remote'] as const;

// Trim + dedupe a list of free-text strings (skills / requirements).
// Caps the array length so a malicious admin can't DoS the public page
// with a 10k-entry list.
const sanitizeStringList = (raw: any, maxItems = 30, maxLen = 200): string[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item || '').trim().slice(0, maxLen);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
};

// Pull the city out of a "City, State" / "City - State" string so the
// public page can offer a clean City filter without the admin having
// to type city + location twice.
const deriveCity = (location: string): string => {
  const first = location.split(/[,\-(]/)[0] || '';
  return first.trim().slice(0, 80);
};

const sanitizeJob = (raw: any) => {
  const out: any = {};
  out.title = String(raw.title || '').trim().slice(0, 200);
  out.company = String(raw.company || '').trim().slice(0, 200);
  out.location = String(raw.location || '').trim().slice(0, 200);
  out.city = String(raw.city || '').trim().slice(0, 80) || deriveCity(out.location);
  out.experience = String(raw.experience || '').trim().slice(0, 80);
  out.salary = String(raw.salary || '').trim().slice(0, 80);
  const employment = String(raw.employment || '').trim();
  out.employment = (EMPLOYMENTS as readonly string[]).includes(employment)
    ? employment
    : 'Full-time';
  const area = String(raw.area || '').trim();
  out.area = (FUNCTIONAL_AREAS as readonly string[]).includes(area)
    ? area
    : 'Quality';
  out.source = String(raw.source || '').trim().slice(0, 80);
  // Apply URL must be http(s) — anything else is rejected to avoid an
  // open-redirect / javascript: payload reaching the public page.
  const apply = String(raw.apply_url || '').trim();
  out.apply_url = /^https?:\/\//i.test(apply) ? apply : '';
  out.posted_on = raw.posted_on
    ? String(raw.posted_on)
    : new Date().toISOString();
  out.promoted = raw.promoted === true;
  // Lifecycle states:
  //   draft     – admin work-in-progress, never public
  //   pending   – submitted via the public "Post a Job" form, awaiting approval
  //   published – visible on /jobs
  //   inactive  – previously live, now deactivated (kept for history but hidden)
  out.status =
    raw.status === 'draft' || raw.status === 'pending' || raw.status === 'inactive'
      ? raw.status
      : 'published';
  // Long-form fields used by the new /jobs/[id] detail page. Description
  // is stored as plain text; the detail view renders it inside a styled
  // <pre> so newlines survive without us shipping a markdown parser.
  out.description = String(raw.description || '').trim().slice(0, 8000);
  out.requirements = sanitizeStringList(raw.requirements, 30, 300);
  out.skills = sanitizeStringList(raw.skills, 24, 60);
  // Submitter contact info — captured by the public "Post a Job" form so
  // the admin can follow up before approving. Never shown on the public
  // page. Optional, free-form, length-capped.
  out.submitter_name = String(raw.submitter_name || '').trim().slice(0, 120);
  out.submitter_email = String(raw.submitter_email || '').trim().slice(0, 200);
  out.submitter_phone = String(raw.submitter_phone || '').trim().slice(0, 40);
  out.submitted_at = raw.submitted_at ? String(raw.submitted_at) : '';
  return out;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === '1';
    let result;
    try {
      result = await sql`SELECT id, data FROM jobs_posts ORDER BY updated_at DESC`;
    } catch {
      result = null;
    }
    const rows = Array.isArray(result) ? result : [];
    let items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    if (isPublic) {
      items = items.filter((j: any) => (j.status || 'published') === 'published');
      items.sort((a: any, b: any) => {
        const da = a.posted_on ? Date.parse(a.posted_on) : 0;
        const db = b.posted_on ? Date.parse(b.posted_on) : 0;
        return db - da;
      });
    }
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Jobs: failed to fetch:', error);
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
    const items = raw
      .filter((it: any) => it && typeof it === 'object')
      .map((it: any) => ({
        id: String(it.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        ...sanitizeJob(it),
      }));
    if (items.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    for (const item of items) {
      const { id, ...data } = item;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO jobs_posts (id, data, updated_at)
                VALUES (${id}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE
                  SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Jobs: failed to save:', error);
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
      await Promise.all(
        body.ids.map((id: string) => sql`DELETE FROM jobs_posts WHERE id = ${String(id)}`),
      );
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await sql`DELETE FROM jobs_posts WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jobs: failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
