import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS master_checklists (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET() {
  try {
    await ensureTable();
    let result;
    try { result = await sql`SELECT id, data FROM master_checklists ORDER BY updated_at DESC`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch master checklists:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });
    await Promise.all(items.map(async (item: any) => {
      const { id, ...data } = item;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO master_checklists (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }));
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save master checklists:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { id } = await request.json();
    await sql`DELETE FROM master_checklists WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete master checklist:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
