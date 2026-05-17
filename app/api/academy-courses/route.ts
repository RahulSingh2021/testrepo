import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS academy_courses (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const rows = await sql`SELECT id, data FROM academy_courses ORDER BY updated_at DESC`;
    const items = rows.map((r: any) => ({
      id: r.id,
      title: r.data?.title || '',
      category: r.data?.categoryId || '',
      level: r.data?.level || '',
      status: r.data?.status || '',
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
