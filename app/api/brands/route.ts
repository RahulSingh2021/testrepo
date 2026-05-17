import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    corporate_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS brands_corporate_id_idx ON brands(corporate_id)`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const corporateId = searchParams.get('corporateId');

    const countResult = await sql`SELECT COUNT(*) as cnt FROM brands`;
    const count = parseInt((countResult as any[])[0]?.cnt || '0', 10);
    if (count === 0) return NextResponse.json([]);

    let rows;
    if (corporateId) {
      rows = await sql`SELECT id, corporate_id, data, updated_at FROM brands WHERE corporate_id = ${corporateId} ORDER BY updated_at DESC`;
    } else {
      rows = await sql`SELECT id, corporate_id, data, updated_at FROM brands ORDER BY updated_at DESC`;
    }
    // _updatedAt feeds the optimistic-save conflict detector (see POST).
    const records = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      corporateId: r.corporate_id,
      _updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      ...r.data,
    }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch brands:', error);
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
          const maxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM brands WHERE id = ANY(${ids})`;
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
        const { id, corporateId, _updatedAt, ...data } = item;
        const corpId = corporateId || null;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO brands (id, corporate_id, data, updated_at)
                  VALUES (${String(id)}, ${corpId}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, corporate_id = ${corpId}, updated_at = NOW()`;
      }));
    }
    const ids = items.map((i: any) => String(i.id));
    const newMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM brands WHERE id = ANY(${ids})`;
    const serverUpdatedAt = newMaxRow?.[0]?.max_updated_at
      ? new Date(newMaxRow[0].max_updated_at).toISOString()
      : new Date().toISOString();
    return NextResponse.json({ success: true, count: items.length, serverUpdatedAt });
  } catch (error) {
    console.error('Failed to save brands:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { id, clearAll, corporateId, ids } = body;
    
    if (clearAll === true) {
      const result = await sql`DELETE FROM brands RETURNING id`;
      const deletedCount = Array.isArray(result) ? result.length : 0;
      return NextResponse.json({ success: true, deletedCount, message: `Cleared ${deletedCount} brands` });
    }
    
    if (corporateId) {
      const result = await sql`DELETE FROM brands WHERE corporate_id = ${corporateId} RETURNING id`;
      const deletedCount = Array.isArray(result) ? result.length : 0;
      return NextResponse.json({ success: true, deletedCount });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      await sql`DELETE FROM brands WHERE id = ANY(${ids})`;
      return NextResponse.json({ success: true, deletedCount: ids.length });
    }
    
    if (!id) return NextResponse.json({ error: 'id, ids, clearAll or corporateId required' }, { status: 400 });
    
    await sql`DELETE FROM brands WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete brand(s):', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
