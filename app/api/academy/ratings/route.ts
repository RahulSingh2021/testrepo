import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_ratings (
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
    const courseId = searchParams.get('course_id');
    const userId = searchParams.get('user_id');

    let result;
    try {
      if (courseId && userId) {
        result = await sql`SELECT id, data FROM academy_ratings WHERE data->>'course_id' = ${courseId} AND data->>'user_id' = ${userId} ORDER BY updated_at DESC`;
      } else if (courseId) {
        result = await sql`SELECT id, data FROM academy_ratings WHERE data->>'course_id' = ${courseId} ORDER BY updated_at DESC`;
      } else if (userId) {
        result = await sql`SELECT id, data FROM academy_ratings WHERE data->>'user_id' = ${userId} ORDER BY updated_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM academy_ratings ORDER BY updated_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyRatings: Failed to fetch:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });
    for (const item of items) {
      const { id, ...data } = item;
      if (!data.rated_at) data.rated_at = new Date().toISOString();
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_ratings (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyRatings: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_ratings WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_ratings WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyRatings: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
