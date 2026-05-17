import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS document_specifications (
    id TEXT PRIMARY KEY,
    scope TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS doc_specs_scope_idx ON document_specifications(scope)`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');

    const countResult = await sql`SELECT COUNT(*) as cnt FROM document_specifications`;
    const count = parseInt((countResult as any[])?.[0]?.cnt || '0', 10);
    if (count === 0) return NextResponse.json([]);

    let rows;
    if (scope) {
      rows = await sql`SELECT id, scope, data FROM document_specifications WHERE scope = ${scope} ORDER BY updated_at DESC`;
    } else {
      rows = await sql`SELECT id, scope, data FROM document_specifications ORDER BY updated_at DESC`;
    }
    const records = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      scope: r.scope,
      ...r.data,
    }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch document specifications:', error);
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
        const { id, scope, ...data } = item;
        const scopeVal = scope || null;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO document_specifications (id, scope, data, updated_at)
                  VALUES (${String(id)}, ${scopeVal}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, scope = ${scopeVal}, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save document specifications:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { ids } = await request.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }
    for (const id of ids) {
      await sql`DELETE FROM document_specifications WHERE id = ${String(id)}`;
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Failed to delete document specifications:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
