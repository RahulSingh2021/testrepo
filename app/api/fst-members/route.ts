import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS fst_members (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    let result;
    try { result = await sql`SELECT id, data FROM fst_members ORDER BY updated_at DESC`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to fetch fst_members:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS fst_members (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });

    for (const item of items) {
      const { id, ...data } = item;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO fst_members (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save fst_members:', error);
    return NextResponse.json({ error: 'Failed to save fst_members' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS fst_members (
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
      await sql`DELETE FROM fst_members WHERE id = ${String(id)}`;
    }
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('Failed to delete fst_members:', error);
    return NextResponse.json({ error: 'Failed to delete fst_members' }, { status: 500 });
  }
}
