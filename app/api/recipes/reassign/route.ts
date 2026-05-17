import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;
  try {
    // Returns every recipe currently owned by the legacy 'unknown' bucket so
    // a super-admin can hand-assign them to the correct entity. Capped to a
    // generous bound to avoid pathological responses.
    const rows = await sql`SELECT id, data, owner_id FROM recipes
      WHERE owner_id = 'unknown' ORDER BY created_at DESC LIMIT 5000`;
    const out = (rows || []).map((r: any) => ({ id: Number(r.id), _ownerId: r.owner_id, ...r.data }));
    return NextResponse.json(out);
  } catch (error) {
    console.error('Failed to list unknown recipes:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;
  try {
    const body = await request.json();
    const ids: number[] = Array.isArray(body?.ids) ? body.ids.map((n: any) => Math.round(Number(n))).filter((n: number) => Number.isFinite(n)) : [];
    const newOwner: string = typeof body?.newOwner === 'string' ? body.newOwner.trim() : '';
    if (!newOwner) return NextResponse.json({ error: 'newOwner required' }, { status: 400 });
    if (ids.length === 0) return NextResponse.json({ success: true, count: 0 });
    // Only reassign rows currently in the legacy bucket — never silently
    // overwrite a row that already belongs to a real owner.
    const idList = ids.join(',');
    const safeOwner = newOwner.replace(/'/g, "''");
    const result: any = await sql.unsafe(
      `UPDATE recipes SET owner_id = '${safeOwner}', updated_at = NOW() WHERE owner_id = 'unknown' AND id IN (${idList})`
    );
    const count = (result && (result.count ?? result.rowCount)) || 0;
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to reassign recipes:', error);
    return NextResponse.json({ error: 'Failed to reassign' }, { status: 500 });
  }
}
