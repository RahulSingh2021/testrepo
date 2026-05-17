import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Allowlist of fields safe to expose to unauthenticated visitors on the
// public landing page. The internal training_calendar row may contain
// participant lists, internal entity IDs, meeting links, etc. that must
// never leak. When the request includes ?public=1, the response is
// filtered to active sessions only and these fields only.
const PUBLIC_FIELDS = [
  'topic',
  'subTopic',
  'description',
  'thumbnailImage',
  'status',
  'mode',
  'date',
  'startTime',
  'endTime',
  'trainingHours',
  'location',
  'trainer',
  'courseFee',
  'discount',
  'offerValidTill',
  'isActive',
  'registrationExpiryDate',
] as const;

export async function GET(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS training_calendar (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    let result;
    try { result = await sql`SELECT id, data FROM training_calendar ORDER BY updated_at DESC`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const isPublic = request.nextUrl.searchParams.get('public') === '1';
    if (isPublic) {
      // Public mode: only sessions the admin hasn't explicitly
      // disabled (isActive === false), with allowlisted fields.
      // The previous strict `=== true` check silently hid every
      // session whose admin record didn't have the flag set,
      // causing the public homepage to render the empty
      // "No live trainings scheduled" state even when valid
      // sessions existed in the DB. The frontend filter in
      // components/AcademyPublicHome.tsx mirrors this convention.
      const all = rows.map((r: any) => ({ id: r.id, ...r.data }));
      const items = all
        .filter((item: any) => item && item.isActive !== false)
        .map((item: any) => {
          const safe: Record<string, any> = { id: item.id };
          for (const k of PUBLIC_FIELDS) {
            if (item[k] !== undefined) safe[k] = item[k];
          }
          return safe;
        });
      // Also surface the lowercased topic/subTopic of every session
      // the admin has DEACTIVATED so the public news-page widgets
      // (FloatingCourses popup + CourseRibbon marquee) can suppress
      // matching academy_courses entries. Without this, deactivating
      // a training in the LMS calendar correctly removes it from the
      // training feed but the matching course in the academy_courses
      // table keeps appearing in the popup — the admin's "off"
      // toggle leaks. Names only (no fees/dates), so still safe to
      // expose to anonymous visitors.
      const deactivatedTitles = Array.from(
        new Set(
          all
            .filter((item: any) => item && item.isActive === false)
            .flatMap((item: any) => [item.topic, item.subTopic])
            .filter(
              (s: any): s is string =>
                typeof s === 'string' && s.trim().length > 0,
            )
            .map((s: string) => s.trim().toLowerCase()),
        ),
      );
      return NextResponse.json({ items, deactivatedTitles });
    }
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to fetch training calendar:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS training_calendar (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });

    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, ...data } = item;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO training_calendar (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save training calendar:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS training_calendar (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const { ids } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }
    for (const id of ids) {
      await sql`DELETE FROM training_calendar WHERE id = ${String(id)}`;
    }
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('Failed to delete training calendar:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
