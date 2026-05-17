import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS facility_equipment (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const unitFilter = searchParams.get('unit');
    
    let result;
    try { result = await sql`SELECT id, data FROM facility_equipment ORDER BY updated_at DESC`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    
    let items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    
    if (unitFilter) {
      items = items.filter((item: any) => item.unit === unitFilter);
    }
    
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch facility equipment:', error);
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

    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, ...data } = item;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO facility_equipment (id, data, updated_at)
                  VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save facility equipment:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const id = body?.id;
    const unit = body?.unit;
    if (!id) return NextResponse.json({ error: 'Missing equipment id' }, { status: 400 });
    if (unit) {
      await sql`DELETE FROM facility_equipment WHERE id = ${String(id)} AND data->>'unit' = ${String(unit)}`;
    } else {
      await sql`DELETE FROM facility_equipment WHERE id = ${String(id)}`;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete facility equipment:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
