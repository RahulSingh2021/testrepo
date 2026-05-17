import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { syncDevDataToDb } from '@/lib/sync-to-db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await syncDevDataToDb();

    let result;
    try { result = await sql`SELECT id, data FROM entities ORDER BY updated_at DESC`; } catch { result = null; }
    let rows = Array.isArray(result) ? result : [];

    if (rows.length === 0) {
      return NextResponse.json({ items: [], seeded: false });
    }
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items, seeded: true });
  } catch (error) {
    console.error('Failed to fetch entities:', error);
    return NextResponse.json({ items: [], seeded: false }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
        await sql`INSERT INTO entities (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save entities:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM entities WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete entity:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
