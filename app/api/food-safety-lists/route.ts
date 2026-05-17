import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS food_safety_lists (
    id TEXT PRIMARY KEY,
    scope TEXT,
    category TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS fsl_scope_cat_idx ON food_safety_lists(scope, category)`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const category = searchParams.get('category');

    let rows;
    if (scope && category) {
      rows = await sql`SELECT id, scope, category, data FROM food_safety_lists WHERE scope = ${scope} AND category = ${category} ORDER BY updated_at ASC`;
    } else if (scope) {
      rows = await sql`SELECT id, scope, category, data FROM food_safety_lists WHERE scope = ${scope} ORDER BY category, updated_at ASC`;
    } else {
      rows = await sql`SELECT id, scope, category, data FROM food_safety_lists ORDER BY category, updated_at ASC`;
    }

    const records = (Array.isArray(rows) ? rows : []).map((r: any) => ({
      id: r.id,
      scope: r.scope,
      category: r.category,
      ...r.data,
    }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch food safety lists:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id && item.category);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });

    const BATCH_SIZE = 30;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, scope, category, ...data } = item;
        const scopeVal = scope || null;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO food_safety_lists (id, scope, category, data, updated_at)
                  VALUES (${String(id)}, ${scopeVal}, ${String(category)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE
                    SET data = ${jsonData}::jsonb,
                        scope = ${scopeVal},
                        category = ${String(category)},
                        updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save food safety lists:', error);
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
      await sql`DELETE FROM food_safety_lists WHERE id = ${String(id)}`;
    }
    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Failed to delete food safety lists:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
