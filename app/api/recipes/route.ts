import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS recipes (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    owner_id TEXT DEFAULT 'super-admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  try { await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT 'super-admin'`; } catch {}
  await sql`CREATE TABLE IF NOT EXISTS recipes_backup (
    backup_id SERIAL PRIMARY KEY,
    backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
    owner_id TEXT,
    recipe_id BIGINT,
    data JSONB,
    reason TEXT DEFAULT 'pre-sync'
  )`;
}

async function snapshotRecipes(owner: string, reason: string) {
  const rows = await sql`SELECT id, data, owner_id FROM recipes WHERE owner_id = ${owner}`;
  if (rows.length === 0) return;
  for (const r of rows) {
    await sql`INSERT INTO recipes_backup (owner_id, recipe_id, data, reason)
              VALUES (${r.owner_id}, ${r.id}, ${JSON.stringify(r.data)}::jsonb, ${reason})`;
  }
  await sql`DELETE FROM recipes_backup
            WHERE backup_id NOT IN (
              SELECT backup_id FROM recipes_backup ORDER BY backup_timestamp DESC LIMIT 5000
            )`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const owner = request.nextUrl.searchParams.get('owner');
    // sharedTo lets a non-owner (e.g. a unit) also see recipes that the
    // super-admin has explicitly shared with their entity. The recipe's JSON
    // payload carries `sharedWith: string[]` (entity IDs).
    const sharedTo = request.nextUrl.searchParams.get('sharedTo');
    // ---- Legacy reclaim ----
    // Before per-entity owner keys existed, every non-super-admin login wrote
    // recipes with owner_id = 'unknown'. Those rows are still in the DB but
    // unreachable now that each unit has its own owner key. Callers can pass
    // `unitNames` (recipe.data->>'unitName') and/or `locations`
    // (recipe.data->>'location') as comma-separated, case-insensitive lists.
    // We return matching `'unknown'` rows in addition to the owner-matched
    // rows so a unit sees its legacy recipes again — without leaking another
    // unit's rows (different unitName / location strings).
    const splitParam = (raw: string | null): string[] =>
      (raw || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    // Always pass arrays (possibly empty). Neon's serverless driver mis-binds
    // a JS `null` against a `text[]` cast (it sends '' which Postgres rejects
    // as a malformed array literal), making the whole query throw — which
    // the outer try/catch then swallowed, returning [] and silently hiding
    // legacy 'unknown'-owner rows from units. cardinality(...) > 0 gives us
    // the same "skip when nothing was passed" semantics the legacy
    // IS NOT NULL guard was after, while binding cleanly with empty arrays.
    // (Pattern mirrors app/api/recipes/bootstrap/route.ts.)
    const unitNamesArr = splitParam(request.nextUrl.searchParams.get('unitNames'));
    const locationsArr = splitParam(request.nextUrl.searchParams.get('locations'));
    // corporateNames scopes the unitName/location reclaim path to recipes
    // whose stored corporateName actually belongs to the requesting user's
    // ancestor chain. This lets us return super-admin-authored recipes
    // tagged to a unit (the common case after a super-admin saves on a
    // unit's behalf) without leaking another corporate's recipes that
    // happen to share a unit name like "Main Kitchen".
    const corporateNamesArr = splitParam(request.nextUrl.searchParams.get('corporateNames'));

    let rows;
    if (owner && sharedTo) {
      rows = await sql`SELECT id, data, owner_id, updated_at FROM recipes
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
        ORDER BY created_at DESC`;
    } else if (owner) {
      rows = await sql`SELECT id, data, owner_id, updated_at FROM recipes
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
        ORDER BY created_at DESC`;
    } else if (sharedTo) {
      rows = await sql`SELECT id, data, owner_id, updated_at FROM recipes WHERE (data->'sharedWith') ? ${sharedTo} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT id, data, owner_id, updated_at FROM recipes ORDER BY created_at DESC`;
    }
    // _ownerId is surfaced so the client can tell apart recipes the current
    // user owns vs ones shared with them (drives the copy-on-write fork).
    // _updatedAt feeds the optimistic-save conflict detector — the client
    // tracks the max it has seen and sends it back on POST so the server
    // can reject saves that would clobber a newer write from another tab/user.
    const recipesOut = (rows || []).map((r: any) => ({
      id: Number(r.id),
      _ownerId: r.owner_id,
      _updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      ...r.data,
    }));
    return NextResponse.json(recipesOut);
  } catch (error) {
    console.error('Failed to fetch recipes:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const owner = request.nextUrl.searchParams.get('owner') || 'super-admin';

    // Optimistic-save conflict guard. Clients track the max `updated_at`
    // they have seen for this owner (from GET _updatedAt and prior POST
    // serverUpdatedAt) and replay it here. If the DB has a newer max, a
    // concurrent writer (e.g. another tab) updated us in between — refuse
    // the save and tell the client what the current server timestamp is so
    // it can prompt the user to keep-local-or-reload. The check is skipped
    // when the client explicitly opts to override with x-allow-override.
    const knownUpdatedAtRaw = request.headers.get('x-known-updated-at');
    const allowOverride = request.headers.get('x-allow-override') === 'yes';
    if (knownUpdatedAtRaw && !allowOverride) {
      try {
        const knownDate = new Date(knownUpdatedAtRaw);
        if (!Number.isNaN(knownDate.getTime())) {
          const maxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM recipes WHERE owner_id = ${owner}`;
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

    if (Array.isArray(body)) {
      if (body.length === 0) {
        // SAFETY: never let an empty-array POST wipe an owner's entire
        // catalog. A buggy client (or a transient load failure that left
        // the in-memory state as []) was previously able to delete every
        // recipe for an owner in one request — that's how ~500 recipes
        // disappeared from production. Require an explicit delete header
        // for the legitimate "clear everything" use case.
        const explicit = request.headers.get('x-allow-empty-wipe') === 'yes';
        if (!explicit) {
          console.warn('[recipes] Refused empty-array POST for owner', owner);
          return NextResponse.json({ success: true, count: 0, refused: 'empty-array-without-explicit-wipe-header' });
        }
        await sql`DELETE FROM recipes WHERE owner_id = ${owner}`;
        return NextResponse.json({ success: true, count: 0 });
      }
      const validIds: number[] = [];
      const BATCH_SIZE = 20;
      for (let i = 0; i < body.length; i += BATCH_SIZE) {
        const batch = body.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item: any) => {
          // Strip transient client-only fields before persisting.
          const { id, _ownerId, ...data } = item;
          const numId = Math.round(Number(id));
          if (!Number.isFinite(numId)) return;
          validIds.push(numId);
          const jsonData = JSON.stringify(data);
          // ON CONFLICT clause is GUARDED by owner_id so a unit can never
          // overwrite a recipe that belongs to someone else (e.g. a shared
          // super-admin recipe). If the row exists with a different owner,
          // the UPDATE silently no-ops.
          await sql`INSERT INTO recipes (id, data, owner_id, updated_at) VALUES (${numId}, ${jsonData}::jsonb, ${owner}, NOW())
                    ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()
                    WHERE recipes.owner_id = ${owner}`;
        }));
      }
      if (validIds.length > 0) {
        await snapshotRecipes(owner, 'pre-sync');
        const idList = validIds.join(',');
        await sql.unsafe(`DELETE FROM recipes WHERE owner_id = '${owner.replace(/'/g, "''")}' AND id NOT IN (${idList})`);
      }
      const newMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM recipes WHERE owner_id = ${owner}`;
      const serverUpdatedAt = newMaxRow?.[0]?.max_updated_at
        ? new Date(newMaxRow[0].max_updated_at).toISOString()
        : new Date().toISOString();
      return NextResponse.json({ success: true, count: validIds.length, serverUpdatedAt });
    }

    const { id, _ownerId, ...data } = body;
    const numId = Math.round(Number(id));
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO recipes (id, data, owner_id, updated_at) VALUES (${numId}, ${jsonData}::jsonb, ${owner}, NOW())
              ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()
              WHERE recipes.owner_id = ${owner}`;
    const singleMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM recipes WHERE owner_id = ${owner}`;
    const serverUpdatedAt = singleMaxRow?.[0]?.max_updated_at
      ? new Date(singleMaxRow[0].max_updated_at).toISOString()
      : new Date().toISOString();
    return NextResponse.json({ success: true, id: numId, serverUpdatedAt });
  } catch (error) {
    console.error('Failed to save recipe:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const numId = Math.round(Number(id));
    // Owner is read from the query param (matches the rest of the API). When
    // present, the delete is scoped to rows the requester owns so a unit
    // can't delete a shared super-admin recipe out from under them.
    const owner = request.nextUrl.searchParams.get('owner');
    if (owner) {
      await sql`DELETE FROM recipes WHERE id = ${numId} AND owner_id = ${owner}`;
    } else {
      await sql`DELETE FROM recipes WHERE id = ${numId}`;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
