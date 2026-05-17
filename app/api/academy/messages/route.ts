import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_messages (
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
    const conversationId = searchParams.get('conversation_id');

    let result;
    try {
      if (conversationId) {
        result = await sql`SELECT id, data FROM academy_messages WHERE data->>'conversation_id' = ${conversationId} ORDER BY created_at ASC`;
      } else if (userId && courseId) {
        result = await sql`SELECT id, data FROM academy_messages WHERE data->>'user_id' = ${userId} AND data->>'course_id' = ${courseId} ORDER BY created_at DESC`;
      } else if (userId) {
        result = await sql`SELECT id, data FROM academy_messages WHERE data->>'sender_id' = ${userId} OR data->>'recipient_id' = ${userId} ORDER BY created_at DESC`;
      } else if (courseId) {
        result = await sql`SELECT id, data FROM academy_messages WHERE data->>'course_id' = ${courseId} ORDER BY created_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM academy_messages ORDER BY created_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyMessages: Failed to fetch:', error);
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
      if (!data.sent_at) data.sent_at = new Date().toISOString();
      if (data.is_read === undefined) data.is_read = false;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_messages (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyMessages: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_messages WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_messages WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyMessages: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
