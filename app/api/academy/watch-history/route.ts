import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_watch_history (
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
    const userId = searchParams.get('user_id');
    const courseId = searchParams.get('course_id');
    const lessonId = searchParams.get('lesson_id');

    let result;
    try {
      if (userId && lessonId) {
        result = await sql`SELECT id, data FROM academy_watch_history WHERE data->>'user_id' = ${userId} AND data->>'lesson_id' = ${lessonId} ORDER BY updated_at DESC`;
      } else if (userId && courseId) {
        result = await sql`SELECT id, data FROM academy_watch_history WHERE data->>'user_id' = ${userId} AND data->>'course_id' = ${courseId} ORDER BY updated_at DESC`;
      } else if (userId) {
        result = await sql`SELECT id, data FROM academy_watch_history WHERE data->>'user_id' = ${userId} ORDER BY updated_at DESC`;
      } else if (courseId) {
        result = await sql`SELECT id, data FROM academy_watch_history WHERE data->>'course_id' = ${courseId} ORDER BY updated_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM academy_watch_history ORDER BY updated_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyWatchHistory: Failed to fetch:', error);
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
      if (!data.watched_at) data.watched_at = new Date().toISOString();
      if (data.completed === undefined) data.completed = false;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_watch_history (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyWatchHistory: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_watch_history WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_watch_history WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyWatchHistory: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
