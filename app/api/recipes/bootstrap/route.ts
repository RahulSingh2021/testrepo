import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { cache as usdaCache } from '@/app/api/nutrition/usda/route';
import { readNutritionCacheBulk } from '@/lib/nutritionCache';

// Single-payload bootstrap for Recipe Studio. Returns, in one response:
//   - `recipes`           : the user's scoped recipes (same shape & scope
//                           rules as /api/recipes)
//   - `masterIngredients` : the master ingredient catalogue, restricted to
//                           the union of ingredient IDs referenced by the
//                           returned recipes (so we don't ship the entire
//                           catalogue when only a handful are needed)
//   - `nutritionRefs`     : any pre-warmed external nutrition rows from
//                           the in-process USDA cache whose query key
//                           matches a referenced ingredient name — lets
//                           the client skip repeat external lookups
//
// Scope/multi-tenant semantics MUST stay identical to /api/recipes — the
// same query params (`owner`, `sharedTo`, `unitNames`, `locations`) are
// honoured here, including the legacy 'unknown' reclaim path.

async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS recipes (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    owner_id TEXT DEFAULT 'super-admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  try { await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT 'super-admin'`; } catch {}
  await sql`CREATE TABLE IF NOT EXISTS ingredients (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const owner = request.nextUrl.searchParams.get('owner');
    const sharedTo = request.nextUrl.searchParams.get('sharedTo');
    const splitParam = (raw: string | null): string[] =>
      (raw || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    // Always pass arrays (possibly empty). Neon's serverless driver mis-binds
    // a JS `null` against a `text[]` cast (it sends '' which Postgres
    // rejects as a malformed array literal). Empty arrays bind cleanly and
    // cardinality() > 0 gives us the same "skip when nothing was passed"
    // semantics the legacy IS NOT NULL guard was after.
    const unitNamesArr = splitParam(request.nextUrl.searchParams.get('unitNames'));
    const locationsArr = splitParam(request.nextUrl.searchParams.get('locations'));
    // See app/api/recipes/route.ts for the rationale — corporateNames keeps
    // the unitName/location reclaim safe across tenants.
    const corporateNamesArr = splitParam(request.nextUrl.searchParams.get('corporateNames'));

    // Single CTE-based query: scoped recipes plus the union of ingredient
    // rows they reference, returned in one round-trip. Because everything
    // happens inside one statement, the results are inherently atomic —
    // no chance of an ingredient being deleted between the recipe read
    // and the ingredient read.
    //
    // Scope filters mirror /api/recipes exactly. We pick one of four CTE
    // shapes in JS based on which params are present, mirroring the
    // legacy if/else if/else if/else structure. Branching in JS avoids
    // the parameterized `NULL::text IS NULL` checks that Neon's
    // serverless gateway does not always evaluate as expected.
    const buildCte = () => {
      if (owner && sharedTo) {
        return sql`
          WITH scoped_recipes AS (
            SELECT id, data, owner_id, created_at FROM recipes
            WHERE owner_id = ${owner}
               OR (data->'sharedWith') ? ${sharedTo}
               OR (
                 cardinality(${corporateNamesArr}::text[]) > 0
                 AND lower(btrim(COALESCE(data->>'corporateName',''))) = ANY(${corporateNamesArr}::text[])
                 AND (
                   (cardinality(${unitNamesArr}::text[]) > 0 AND lower(btrim(data->>'unitName')) = ANY(${unitNamesArr}::text[]))
                   OR
                   (cardinality(${locationsArr}::text[]) > 0 AND lower(btrim(data->>'location')) = ANY(${locationsArr}::text[]))
                 )
               )
               OR (
                 owner_id = 'unknown' AND COALESCE(data->>'corporateName','') = '' AND (
                   (cardinality(${unitNamesArr}::text[]) > 0 AND lower(btrim(data->>'unitName')) = ANY(${unitNamesArr}::text[]))
                   OR
                   (cardinality(${locationsArr}::text[]) > 0 AND lower(btrim(data->>'location')) = ANY(${locationsArr}::text[]))
                 )
               )
          ),
          referenced_ids AS (
            SELECT DISTINCT (jsonb_array_elements(data->'ingredients')->>'ingredientId')::bigint AS ing_id
            FROM scoped_recipes
            WHERE jsonb_typeof(data->'ingredients') = 'array'
          )
          SELECT 'recipe' AS kind, id::text AS id, data, owner_id, created_at FROM scoped_recipes
          UNION ALL
          SELECT 'ingredient' AS kind, i.id::text AS id, i.data, NULL::text AS owner_id, i.created_at
            FROM ingredients i JOIN referenced_ids r ON i.id = r.ing_id`;
      }
      if (owner) {
        return sql`
          WITH scoped_recipes AS (
            SELECT id, data, owner_id, created_at FROM recipes
            WHERE owner_id = ${owner}
               OR (
                 cardinality(${corporateNamesArr}::text[]) > 0
                 AND lower(btrim(COALESCE(data->>'corporateName',''))) = ANY(${corporateNamesArr}::text[])
                 AND (
                   (cardinality(${unitNamesArr}::text[]) > 0 AND lower(btrim(data->>'unitName')) = ANY(${unitNamesArr}::text[]))
                   OR
                   (cardinality(${locationsArr}::text[]) > 0 AND lower(btrim(data->>'location')) = ANY(${locationsArr}::text[]))
                 )
               )
               OR (
                 owner_id = 'unknown' AND COALESCE(data->>'corporateName','') = '' AND (
                   (cardinality(${unitNamesArr}::text[]) > 0 AND lower(btrim(data->>'unitName')) = ANY(${unitNamesArr}::text[]))
                   OR
                   (cardinality(${locationsArr}::text[]) > 0 AND lower(btrim(data->>'location')) = ANY(${locationsArr}::text[]))
                 )
               )
          ),
          referenced_ids AS (
            SELECT DISTINCT (jsonb_array_elements(data->'ingredients')->>'ingredientId')::bigint AS ing_id
            FROM scoped_recipes
            WHERE jsonb_typeof(data->'ingredients') = 'array'
          )
          SELECT 'recipe' AS kind, id::text AS id, data, owner_id, created_at FROM scoped_recipes
          UNION ALL
          SELECT 'ingredient' AS kind, i.id::text AS id, i.data, NULL::text AS owner_id, i.created_at
            FROM ingredients i JOIN referenced_ids r ON i.id = r.ing_id`;
      }
      if (sharedTo) {
        return sql`
          WITH scoped_recipes AS (
            SELECT id, data, owner_id, created_at FROM recipes WHERE (data->'sharedWith') ? ${sharedTo}
          ),
          referenced_ids AS (
            SELECT DISTINCT (jsonb_array_elements(data->'ingredients')->>'ingredientId')::bigint AS ing_id
            FROM scoped_recipes
            WHERE jsonb_typeof(data->'ingredients') = 'array'
          )
          SELECT 'recipe' AS kind, id::text AS id, data, owner_id, created_at FROM scoped_recipes
          UNION ALL
          SELECT 'ingredient' AS kind, i.id::text AS id, i.data, NULL::text AS owner_id, i.created_at
            FROM ingredients i JOIN referenced_ids r ON i.id = r.ing_id`;
      }
      return sql`
        WITH scoped_recipes AS (
          SELECT id, data, owner_id, created_at FROM recipes
        ),
        referenced_ids AS (
          SELECT DISTINCT (jsonb_array_elements(data->'ingredients')->>'ingredientId')::bigint AS ing_id
          FROM scoped_recipes
          WHERE jsonb_typeof(data->'ingredients') = 'array'
        )
        SELECT 'recipe' AS kind, id::text AS id, data, owner_id, created_at FROM scoped_recipes
        UNION ALL
        SELECT 'ingredient' AS kind, i.id::text AS id, i.data, NULL::text AS owner_id, i.created_at
          FROM ingredients i JOIN referenced_ids r ON i.id = r.ing_id`;
    };
    const rows: any[] = await buildCte();

    type Bucket = { row: any; ts: number };
    const recipeBuckets: Bucket[] = [];
    const ingredientBuckets: Bucket[] = [];
    for (const row of (rows || [])) {
      const ts = row.created_at ? new Date(row.created_at).getTime() : 0;
      if (row.kind === 'recipe') recipeBuckets.push({ row, ts });
      else if (row.kind === 'ingredient') ingredientBuckets.push({ row, ts });
    }
    // Match the legacy ORDER BY created_at DESC for both lists.
    recipeBuckets.sort((a, b) => b.ts - a.ts);
    ingredientBuckets.sort((a, b) => b.ts - a.ts);
    const recipes = recipeBuckets.map(({ row }) => ({ id: Number(row.id), _ownerId: row.owner_id, ...(row.data || {}) }));
    const masterIngredients = ingredientBuckets.map(({ row }) => ({ id: Number(row.id), ...(row.data || {}) }));

    // Step 3: pre-warm nutritionRefs from the persistent nutrition_cache
    // table, with the in-process USDA map as a same-invocation fast path.
    // We surface any cache entries whose query key (lowercased ingredient
    // name) matches a referenced ingredient name. This collapses the
    // per-ingredient on-demand round-trips that the Recipe Studio fires
    // when opening a recipe with red-flagged (incomplete-data) ingredients.
    const refIngredientNames = new Set<string>();
    for (const ing of masterIngredients) {
      const name = (ing?.name || '').toString().trim().toLowerCase();
      if (name) refIngredientNames.add(name);
    }
    const now = Date.now();
    const nutritionRefs: { source: 'USDA' | 'FSANZ'; query: string; foods: unknown[] }[] = [];
    const seen = new Set<string>(); // `${source}:${query}` dedupe key

    // First: in-process USDA map (same-Lambda hot rows the DB may not
    // have caught up with yet for very recent lookups).
    for (const name of refIngredientNames) {
      const hit = usdaCache.get(name);
      if (hit && hit.expiresAt > now) {
        nutritionRefs.push({ source: 'USDA', query: name, foods: hit.foods });
        seen.add(`USDA:${name}`);
      }
    }

    // Then: shared DB cache. Pulls every persisted (USDA / FSANZ) row
    // whose query matches a referenced ingredient name in a single
    // round-trip, so a brand-new browser tab gets every prewarm row
    // a teammate already paid the round-trip for.
    if (refIngredientNames.size > 0) {
      const dbRows = await readNutritionCacheBulk(Array.from(refIngredientNames));
      for (const row of dbRows) {
        const key = `${row.source}:${row.query}`;
        if (seen.has(key)) continue;
        seen.add(key);
        nutritionRefs.push({ source: row.source, query: row.query, foods: row.foods });
      }
    }

    const res = NextResponse.json({ recipes, masterIngredients, nutritionRefs });
    // Brief private cache so quick re-mounts in the same session (e.g.
    // tab switches) don't re-hit the DB. Per-user data → must be private.
    res.headers.set('Cache-Control', 'private, max-age=15');
    return res;
  } catch (error) {
    console.error('Failed to bootstrap recipe studio:', error);
    return NextResponse.json({ error: 'Failed to bootstrap' }, { status: 500 });
  }
}
