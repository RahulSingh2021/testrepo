import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET() {
  try {
    await ensureTable();
    const count = await sql`SELECT COUNT(*)::int as cnt FROM suppliers`;
    const total = count?.[0]?.cnt ?? 0;
    if (total === 0) return NextResponse.json([]);
    const rows = await sql`SELECT id, data, updated_at FROM suppliers ORDER BY updated_at DESC`;
    // _updatedAt feeds the optimistic-save conflict detector (see POST).
    const records = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      _updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      ...r.data,
    }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch suppliers:', error);
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

    // Optimistic-save conflict guard scoped to the rows being written.
    const knownUpdatedAtRaw = request.headers.get('x-known-updated-at');
    const allowOverride = request.headers.get('x-allow-override') === 'yes';
    if (knownUpdatedAtRaw && !allowOverride) {
      try {
        const knownDate = new Date(knownUpdatedAtRaw);
        if (!Number.isNaN(knownDate.getTime())) {
          const ids = items.map((i: any) => String(i.id));
          const maxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM suppliers WHERE id = ANY(${ids})`;
          const serverMax = maxRow?.[0]?.max_updated_at ? new Date(maxRow[0].max_updated_at) : null;
          if (serverMax && serverMax.getTime() > knownDate.getTime() + 50) {
            return NextResponse.json(
              { error: 'conflict', serverUpdatedAt: serverMax.toISOString() },
              { status: 409 }
            );
          }
        }
      } catch {}
    }

    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, _updatedAt, ...data } = item;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO suppliers (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    const ids = items.map((i: any) => String(i.id));
    const newMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM suppliers WHERE id = ANY(${ids})`;
    const serverUpdatedAt = newMaxRow?.[0]?.max_updated_at
      ? new Date(newMaxRow[0].max_updated_at).toISOString()
      : new Date().toISOString();
    return NextResponse.json({ success: true, count: items.length, serverUpdatedAt });
  } catch (error) {
    console.error('Failed to save suppliers:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { id } = await request.json();
    await sql`DELETE FROM suppliers WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
