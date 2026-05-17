import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS raw_materials (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'ingredients',
    corporate_id TEXT,
    unit_id TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS corporate_id TEXT`;
  await sql`ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS unit_id TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS rm_corp_type_idx ON raw_materials(corporate_id, type)`;
  await sql`CREATE INDEX IF NOT EXISTS rm_unit_idx ON raw_materials(unit_id)`;
};

// Super-admin scope. Ingredients written under this corporate_id act as a
// global library that every other scope (corporate / regional / unit) reads
// in addition to its own ingredients — including units created in the
// future. This way a brand-new unit can run the CSV ingredient matcher on
// day one without first re-importing the master list. Saves are unchanged:
// super-admin still writes to corp-acme, units still write to their own
// scope; only the read path merges.
const SUPER_ADMIN_SCOPE = 'corp-acme';

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type');
    const corporateId = searchParams.get('corporateId');

    let rows;
    if (corporateId && type) {
      // For ingredients only, merge the super-admin global library into the
      // requested scope's result. Other raw material types (food contact
      // materials, etc.) keep strict per-scope isolation.
      if (type === 'ingredients' && corporateId !== SUPER_ADMIN_SCOPE) {
        rows = await sql`SELECT id, type, corporate_id, unit_id, data, updated_at
                         FROM raw_materials
                         WHERE type = ${type}
                           AND (corporate_id = ${corporateId} OR corporate_id = ${SUPER_ADMIN_SCOPE})
                         ORDER BY (corporate_id = ${corporateId}) DESC, updated_at DESC`;
      } else {
        rows = await sql`SELECT id, type, corporate_id, unit_id, data, updated_at FROM raw_materials WHERE corporate_id = ${corporateId} AND type = ${type} ORDER BY updated_at DESC`;
      }
    } else if (corporateId) {
      rows = await sql`SELECT id, type, corporate_id, unit_id, data, updated_at FROM raw_materials WHERE corporate_id = ${corporateId} ORDER BY updated_at DESC`;
    } else if (type) {
      rows = await sql`SELECT id, type, corporate_id, unit_id, data, updated_at FROM raw_materials WHERE type = ${type} ORDER BY updated_at DESC`;
    } else {
      rows = await sql`SELECT id, type, corporate_id, unit_id, data, updated_at FROM raw_materials ORDER BY updated_at DESC`;
    }

    // De-duplicate by id, keeping the unit-owned row when both a unit-owned
    // and a super-admin-owned row share an id (the ORDER BY above puts the
    // unit-owned row first so the seen-set wins). This protects any local
    // override or copy-on-write a unit may have made.
    const seen = new Set<string>();
    const deduped = (Array.isArray(rows) ? rows : []).filter((r: any) => {
      const key = String(r.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // _updatedAt feeds the optimistic-save conflict detector — the client
    // tracks the max it has seen and replays it on POST so the server can
    // refuse writes that would clobber a newer concurrent edit.
    const records = deduped.map((r: any) => ({
      id: r.id,
      _corporateId: r.corporate_id,
      _unitId: r.unit_id,
      _updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      ...r.data,
    }));
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch raw materials:', error);
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
    // The client replays the max `updated_at` it has seen; if any of the
    // rows we're about to overwrite has been touched since, refuse the
    // write and tell the client what the current server timestamp is so
    // it can prompt keep-local-or-reload.
    const knownUpdatedAtRaw = request.headers.get('x-known-updated-at');
    const allowOverride = request.headers.get('x-allow-override') === 'yes';
    if (knownUpdatedAtRaw && !allowOverride) {
      try {
        const knownDate = new Date(knownUpdatedAtRaw);
        if (!Number.isNaN(knownDate.getTime())) {
          const ids = items.map((i: any) => String(i.id));
          const maxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM raw_materials WHERE id = ANY(${ids})`;
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

    // Pre-fetch existing corporate_ids for the rows we're about to write
    // so we can refuse cross-scope overwrites of the super-admin global
    // ingredient library. Without this guard, a unit user who pulled a
    // corp-acme ingredient via the merged read could re-POST it under
    // their own corporate_id and silently take ownership of the global
    // row (the COALESCE on UPDATE would replace corp-acme with the
    // unit's id). Skip the guard entirely when the caller is corp-acme.
    const allIds = items.map((i: any) => String(i.id));
    const existingRows = allIds.length > 0
      ? await sql`SELECT id, corporate_id FROM raw_materials WHERE id = ANY(${allIds})`
      : [];
    const existingCorpById = new Map<string, string | null>();
    for (const r of (existingRows as any[])) existingCorpById.set(String(r.id), r.corporate_id ?? null);

    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, _type, _corporateId, _unitId, _updatedAt, ...data } = item;
        const materialType = _type || 'ingredients';
        const incomingCorpId = _corporateId || null;
        const unitIdVal = _unitId || null;
        // Refuse to mutate super-admin global rows from a different
        // scope. The merged read makes corp-acme ingredients visible to
        // every unit; this guard makes the visibility read-only for
        // non-super-admin callers (super-admin still saves to corp-acme
        // because their incomingCorpId === SUPER_ADMIN_SCOPE).
        const existingCorp = existingCorpById.get(String(id)) ?? null;
        if (existingCorp === SUPER_ADMIN_SCOPE && incomingCorpId && incomingCorpId !== SUPER_ADMIN_SCOPE) {
          return;
        }
        const corpId = incomingCorpId;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO raw_materials (id, type, corporate_id, unit_id, data, updated_at)
                  VALUES (${String(id)}, ${materialType}, ${corpId}, ${unitIdVal}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE
                    SET data = ${jsonData}::jsonb,
                        type = ${materialType},
                        corporate_id = COALESCE(${corpId}, raw_materials.corporate_id),
                        unit_id = COALESCE(${unitIdVal}, raw_materials.unit_id),
                        updated_at = NOW()`;
      }));
    }
    const ids = items.map((i: any) => String(i.id));
    const newMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM raw_materials WHERE id = ANY(${ids})`;
    const serverUpdatedAt = newMaxRow?.[0]?.max_updated_at
      ? new Date(newMaxRow[0].max_updated_at).toISOString()
      : new Date().toISOString();
    return NextResponse.json({ success: true, count: items.length, serverUpdatedAt });
  } catch (error) {
    console.error('Failed to save raw materials:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureTable();
    const { id, unitId } = await request.json();
    if (!id || !unitId) return NextResponse.json({ error: 'id and unitId required' }, { status: 400 });
    await sql`UPDATE raw_materials
              SET data = jsonb_set(
                data,
                '{adoptedByUnitIds}',
                COALESCE(data->'adoptedByUnitIds', '[]'::jsonb) || ${JSON.stringify([unitId])}::jsonb
              ),
              updated_at = NOW()
              WHERE id = ${id}
              AND NOT (COALESCE(data->'adoptedByUnitIds', '[]'::jsonb) @> ${JSON.stringify([unitId])}::jsonb)`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to adopt material:', error);
    return NextResponse.json({ error: 'Failed to adopt' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { id } = await request.json();
    await sql`DELETE FROM raw_materials WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete raw material:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
