import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS receiving_records (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const rows = await sql`SELECT id, data FROM receiving_records ORDER BY updated_at DESC`;
    const records = (Array.isArray(rows) ? rows : []).map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch receiving records:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS receiving_records (
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
        await sql`INSERT INTO receiving_records (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save receiving records:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM receiving_records WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete receiving record:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
