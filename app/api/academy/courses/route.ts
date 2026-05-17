import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS academy_courses (
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
    const categoryId = searchParams.get('category_id');
    const subCategoryId = searchParams.get('sub_category_id');
    const status = searchParams.get('status');
    const instructorId = searchParams.get('instructor_id');
    const search = searchParams.get('search');
    const level = searchParams.get('level');

    let result;
    try {
      result = await sql`SELECT id, data FROM academy_courses ORDER BY updated_at DESC`;
    } catch { result = null; }

    let rows = Array.isArray(result) ? result : [];
    let items = rows.map((r: any) => ({ id: r.id, ...r.data }));

    if (categoryId) {
      items = items.filter((item: any) => item.category_id === categoryId);
    }
    if (subCategoryId) {
      items = items.filter((item: any) => item.sub_category_id === subCategoryId);
    }
    if (status) {
      // Case-insensitive compare so legacy callers that ask for
      // "Active" / "Published" / etc. still match the lowercase
      // values the admin persists. Belt-and-braces against the
      // ribbon/floating-ad surfaces silently going empty.
      const wanted = String(status).toLowerCase();
      items = items.filter(
        (item: any) =>
          (item.status ? String(item.status).toLowerCase() : '') === wanted,
      );
    }
    if (instructorId) {
      items = items.filter((item: any) => item.instructor_id === instructorId);
    }
    if (level) {
      items = items.filter((item: any) => item.level === level);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((item: any) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.short_description && item.short_description.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('AcademyCourses: Failed to fetch:', error);
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
      if (!data.created_at) data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO academy_courses (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('AcademyCourses: Failed to save:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM academy_courses WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM academy_courses WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AcademyCourses: Failed to delete:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
