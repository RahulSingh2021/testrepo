import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Auto-fix orphan recipes when an entity gets renamed.
//
// Recipes carry snapshot location strings (corporateName / regionalName /
// unitName) — they do NOT reference entities by id. When a Corporate / Region /
// Unit is renamed in CorporateManagement, every recipe still holding the old
// snapshot becomes an orphan to the location filter (see `recipeLocationStatus`
// / `orphanRecipeIds` in components/RecipeCalculation.tsx).
//
// This endpoint lets the rename flow:
//   - GET ?field=corporateName|regionalName|unitName&oldName=X
//       → { count } of recipes that still snapshot the old name (preview the
//         prompt without mutating anything).
//   - POST { field, oldName, newName }
//       → bulk-update the snapshot string in `data` JSONB across every
//         affected recipe (regardless of owner — the corporate name lives in
//         per-recipe JSON, not in a per-user table). Returns the number of
//         rows updated.
//
// The bulk update is intentionally idempotent and scoped by exact-match on
// the snapshot string so we can never accidentally rewrite an unrelated
// recipe whose corporate happened to share a fragment of the old name.
//
// Implementation note: the JSONB key is selected via a hard-coded branch (we
// only support three fields) so we can use Neon's parameter-binding tagged
// templates everywhere — no string interpolation of caller-provided values
// reaches the SQL.

type Field = 'corporateName' | 'regionalName' | 'unitName';
const ALLOWED_FIELDS = new Set<Field>(['corporateName', 'regionalName', 'unitName']);

async function ensureRecipesTable() {
  await sql`CREATE TABLE IF NOT EXISTS recipes (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    owner_id TEXT DEFAULT 'super-admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

async function countByField(field: Field, oldName: string): Promise<number> {
  let rows: any[] = [];
  if (field === 'corporateName') {
    rows = await sql`SELECT COUNT(*)::int AS count FROM recipes WHERE data->>'corporateName' = ${oldName}`;
  } else if (field === 'regionalName') {
    rows = await sql`SELECT COUNT(*)::int AS count FROM recipes WHERE data->>'regionalName' = ${oldName}`;
  } else {
    rows = await sql`SELECT COUNT(*)::int AS count FROM recipes WHERE data->>'unitName' = ${oldName}`;
  }
  return Number(rows?.[0]?.count || 0);
}

async function renameField(field: Field, oldName: string, newName: string): Promise<number> {
  // Re-count first so we can return an accurate number even if the driver
  // doesn't surface UPDATE row counts on this connection.
  const before = await countByField(field, oldName);
  if (before === 0) return 0;

  if (field === 'corporateName') {
    await sql`UPDATE recipes
                 SET data = jsonb_set(data, ARRAY['corporateName'], to_jsonb(${newName}::text), false),
                     updated_at = NOW()
               WHERE data->>'corporateName' = ${oldName}`;
  } else if (field === 'regionalName') {
    await sql`UPDATE recipes
                 SET data = jsonb_set(data, ARRAY['regionalName'], to_jsonb(${newName}::text), false),
                     updated_at = NOW()
               WHERE data->>'regionalName' = ${oldName}`;
  } else {
    await sql`UPDATE recipes
                 SET data = jsonb_set(data, ARRAY['unitName'], to_jsonb(${newName}::text), false),
                     updated_at = NOW()
               WHERE data->>'unitName' = ${oldName}`;
  }
  return before;
}

export async function GET(request: NextRequest) {
  try {
    const field = request.nextUrl.searchParams.get('field') || '';
    const oldName = request.nextUrl.searchParams.get('oldName') || '';
    if (!ALLOWED_FIELDS.has(field as Field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }
    if (!oldName.trim()) {
      return NextResponse.json({ count: 0 });
    }
    await ensureRecipesTable();
    const count = await countByField(field as Field, oldName);
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to count recipes for rename:', error);
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const field = String(body?.field || '');
    const oldName = String(body?.oldName || '');
    const newName = String(body?.newName || '');
    if (!ALLOWED_FIELDS.has(field as Field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }
    if (!oldName.trim() || !newName.trim()) {
      return NextResponse.json({ error: 'oldName and newName are required' }, { status: 400 });
    }
    if (oldName === newName) {
      return NextResponse.json({ count: 0 });
    }
    await ensureRecipesTable();
    const count = await renameField(field as Field, oldName, newName);
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Failed to rename recipe locations:', error);
    return NextResponse.json({ error: 'Failed to rename' }, { status: 500 });
  }
}
