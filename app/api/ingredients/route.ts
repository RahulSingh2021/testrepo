import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// Shape of an ingredient row body. Stored as JSONB, so additional fields
// round-trip transparently — but we declare the explicit contract for the
// fields the Recipe Studio relies on, including the optional `flag` used
// to mark manually-added "red-flagged" ingredients with incomplete data.
type IngredientBody = {
  id: number | string;
  // Server-only timestamp surfaced on GET for optimistic-conflict detection.
  // Stripped before persisting on POST so it never lands in JSONB storage.
  _updatedAt?: string | null;
  name: string;
  symbol?: string;
  keyword?: string;
  refrence?: string;
  allergen?: string;
  portion?: number;
  energy?: number;
  protein?: number;
  carb?: number;
  fat?: number;
  totalSugar?: number;
  addedSugar?: number;
  saturatedFat?: number;
  unsaturatedFat?: number;
  polyunsaturatedFat?: number;
  transFat?: number;
  fiber?: number;
  cholesterol?: number;
  sodium?: number;
  status?: 'active' | 'inactive';
  createdOn?: string;
  // Marks an ingredient that was added manually because the user couldn't
  // find a DB match. Cleared (set to null) once nutrition data is filled in.
  flag?: 'red' | null;
  [key: string]: unknown;
};

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS ingredients (
      id BIGINT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const rows = await sql`SELECT id, data, updated_at FROM ingredients ORDER BY created_at DESC`;
    if (!rows) {
      return NextResponse.json({ error: 'Database returned null' }, { status: 502 });
    }
    // _updatedAt feeds the optimistic-save conflict detector — the client
    // tracks the max it has seen and sends it back on POST so the server
    // can reject saves that would clobber a newer write from another tab/user.
    const ingredients = rows.map((r: any) => ({
      id: Number(r.id),
      _updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      ...r.data,
    }));
    return NextResponse.json(ingredients);
  } catch (error) {
    console.error('Failed to fetch ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Optimistic-save conflict guard. Clients track the max `updated_at`
    // they have seen and replay it here. If the DB has a newer max, a
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
          const maxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM ingredients`;
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
        const countResult = await sql`SELECT COUNT(*) as cnt FROM ingredients`;
        const currentCount = Number(countResult?.[0]?.cnt || 0);
        if (currentCount > 50) {
          return NextResponse.json({ error: 'Refusing to delete all: DB has ' + currentCount + ' items. Use DELETE endpoint instead.' }, { status: 400 });
        }
        await sql`DELETE FROM ingredients`;
        return NextResponse.json({ success: true, count: 0, serverUpdatedAt: new Date().toISOString() });
      }
      const validIds: number[] = [];
      const BATCH_SIZE = 20;
      for (let i = 0; i < body.length; i += BATCH_SIZE) {
        const batch = body.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (item: any) => {
          // Strip transient client-only fields before persisting.
          const { id, _updatedAt, ...data } = item;
          const numId = Math.round(Number(id));
          if (!Number.isFinite(numId)) return;
          validIds.push(numId);
          const jsonData = JSON.stringify(data);
          await sql`INSERT INTO ingredients (id, data, updated_at) VALUES (${numId}, ${jsonData}::jsonb, NOW())
                    ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
        }));
      }
      if (validIds.length > 0) {
        const idList = validIds.join(',');
        await sql.unsafe(`DELETE FROM ingredients WHERE id NOT IN (${idList})`);
      }
      const newMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM ingredients`;
      const serverUpdatedAt = newMaxRow?.[0]?.max_updated_at
        ? new Date(newMaxRow[0].max_updated_at).toISOString()
        : new Date().toISOString();
      return NextResponse.json({ success: true, count: validIds.length, serverUpdatedAt });
    }

    const ingredient = body as IngredientBody;
    const { id, _updatedAt, ...data } = ingredient;
    void _updatedAt;
    const numId = Math.round(Number(id));
    const jsonData = JSON.stringify(data);
    await sql`INSERT INTO ingredients (id, data, updated_at) VALUES (${numId}, ${jsonData}::jsonb, NOW())
              ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    const singleMaxRow = await sql`SELECT MAX(updated_at) AS max_updated_at FROM ingredients`;
    const serverUpdatedAt = singleMaxRow?.[0]?.max_updated_at
      ? new Date(singleMaxRow[0].max_updated_at).toISOString()
      : new Date().toISOString();
    return NextResponse.json({ success: true, id: numId, serverUpdatedAt });
  } catch (error) {
    console.error('Failed to save ingredient:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (Array.isArray(body?.ids)) {
      const numIds = body.ids.map((x: any) => Math.round(Number(x))).filter((n: number) => Number.isFinite(n));
      if (numIds.length === 0) return NextResponse.json({ success: true, deleted: 0 });
      const idList = numIds.join(',');
      await sql.unsafe(`DELETE FROM ingredients WHERE id IN (${idList})`);
      return NextResponse.json({ success: true, deleted: numIds.length });
    }
    const { id } = body;
    const numId = Math.round(Number(id));
    await sql`DELETE FROM ingredients WHERE id = ${numId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete ingredient:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
