import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

// Captures Academy "Enrol Now" leads submitted from the public catalogue at
// /academy. POST is intentionally open so anyone can register, but it does
// strict input validation. GET returns lead PII so it must stay admin-only.
//
// UTM columns let the admin trace which traffic source (share link, printed
// QR, direct visit) actually converted into a lead — see the "Tips that
// converted" panel in components/AcademyAdmin.tsx.

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_public_enrolments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    course_title TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // UTM columns are added via ALTER so existing deployments keep their data
  // when the schema rolls forward.
  await sql`ALTER TABLE academy_public_enrolments ADD COLUMN IF NOT EXISTS utm_source TEXT`;
  await sql`ALTER TABLE academy_public_enrolments ADD COLUMN IF NOT EXISTS utm_medium TEXT`;
  await sql`ALTER TABLE academy_public_enrolments ADD COLUMN IF NOT EXISTS utm_campaign TEXT`;
  await sql`ALTER TABLE academy_public_enrolments ADD COLUMN IF NOT EXISTS utm_content TEXT`;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = {
  name: 200,
  email: 320,
  phone: 40,
  notes: 2000,
  course_id: 200,
  course_title: 500,
  utm: 200,
};

const trimStr = (v: any, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
};

export async function GET(request: NextRequest) {
  // Admin-only: lead rows contain PII (name, email, phone, notes).
  const auth = await requireAdminSession(request);
  if (auth) return auth;
  try {
    await ensureTable();
    const rows = await sql`SELECT id, course_id, course_title, name, email, phone, notes,
                                  utm_source, utm_medium, utm_campaign, utm_content,
                                  created_at
                           FROM academy_public_enrolments ORDER BY created_at DESC`;
    return NextResponse.json({ items: rows || [] });
  } catch (e) {
    console.error('PublicEnrolments: fetch failed', e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const course_id = trimStr(body.course_id, MAX.course_id);
    const name = trimStr(body.name, MAX.name);
    const emailRaw = trimStr(body.email, MAX.email);
    if (!course_id || !name || !emailRaw) {
      return NextResponse.json({ error: 'course_id, name and email are required' }, { status: 400 });
    }
    const email = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const course_title = trimStr(body.course_title, MAX.course_title) ?? null;
    const phone = trimStr(body.phone, MAX.phone) ?? null;
    const notes = trimStr(body.notes, MAX.notes) ?? null;
    const utm_source = trimStr(body.utm_source, MAX.utm) ?? null;
    const utm_medium = trimStr(body.utm_medium, MAX.utm) ?? null;
    const utm_campaign = trimStr(body.utm_campaign, MAX.utm) ?? null;
    const utm_content = trimStr(body.utm_content, MAX.utm) ?? null;

    const id = `pe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sql`INSERT INTO academy_public_enrolments
                (id, course_id, course_title, name, email, phone, notes,
                 utm_source, utm_medium, utm_campaign, utm_content)
              VALUES
                (${id}, ${course_id}, ${course_title}, ${name}, ${email}, ${phone}, ${notes},
                 ${utm_source}, ${utm_medium}, ${utm_campaign}, ${utm_content})`;
    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error('PublicEnrolments: save failed', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
