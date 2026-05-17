import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAdminSession } from '@/lib/adminAuth';
import { requireStudentSession } from '@/lib/studentAuth';

// Fields the PATCH endpoint is allowed to mutate. Anything else in the
// patch payload is silently dropped — this keeps the endpoint scoped to
// self-serve preferences and prevents a caller from rewriting arbitrary
// JSONB keys (name, phone, role, etc) by abusing the merge primitive.
const PATCHABLE_FIELDS = new Set<string>([
  'receiveTrainingAlerts',
]);

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS lms_users (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const idFilter    = searchParams.get('id');
    const phoneFilter = searchParams.get('phone');

    let result;
    try {
      if (idFilter) {
        result = await sql`SELECT id, data FROM lms_users WHERE id = ${idFilter} LIMIT 1`;
      } else if (phoneFilter) {
        // strip non-digits and match last 10 digits against stored phone
        const digits = phoneFilter.replace(/\D/g, '').slice(-10);
        result = await sql`SELECT id, data FROM lms_users
          WHERE regexp_replace(data->>'phone', '[^0-9]', '', 'g') LIKE ${'%' + digits}
          LIMIT 5`;
      } else {
        result = await sql`SELECT id, data FROM lms_users ORDER BY updated_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('LMS: Failed to fetch users:', error);
    return NextResponse.json({ items: [] }, { status: 200 });
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
        const { id, ...data } = item;
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO lms_users (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('LMS: Failed to save users:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// PATCH lets a user update their own LMS preferences without blowing
// away the rest of the JSONB record. Today the only field the
// student-facing UI flips is `receiveTrainingAlerts` (the WhatsApp
// promo opt-out enforced by /api/whatsapp/training-promo).
//
// Authorization: caller must present EITHER a valid admin session
// (x-admin-token, used by the LMS admin UI) OR a valid student
// session (x-student-token) whose user_id matches the target row.
// Without this, anyone could mutate any LMS user's preferences just
// by guessing/iterating IDs.
//
// Field allowlist: only keys in PATCHABLE_FIELDS survive the merge,
// so even an authorized caller can't use this endpoint to rewrite
// name/phone/role/etc.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = body?.id;
    const patch = body?.patch;
    if (!id || !patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return NextResponse.json(
        { error: 'id and patch (object) are required' },
        { status: 400 },
      );
    }

    // AuthN/AuthZ: caller is authorized if EITHER credential validates.
    // We try each independently and only fail when both are missing or
    // both fail — this avoids the footgun where a stale admin token in
    // localStorage would block an otherwise-valid student session (or
    // vice versa).
    const hasAdminToken = !!request.headers.get('x-admin-token');
    const hasStudentToken = !!request.headers.get('x-student-token');
    if (!hasAdminToken && !hasStudentToken) {
      return NextResponse.json(
        { error: 'Unauthorized: admin or student session token required' },
        { status: 401 },
      );
    }
    let authorized = false;
    if (hasAdminToken) {
      const adminErr = await requireAdminSession(request);
      if (!adminErr) authorized = true;
    }
    if (!authorized && hasStudentToken) {
      const studentRes = await requireStudentSession(request, String(id));
      if (!('error' in studentRes)) authorized = true;
    }
    if (!authorized) {
      return NextResponse.json(
        { error: 'Unauthorized: no valid admin or student session for this user' },
        { status: 401 },
      );
    }

    // Allowlist filter — silently drop any disallowed keys so the
    // endpoint can't be used to rewrite arbitrary JSONB fields.
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (PATCHABLE_FIELDS.has(k)) filtered[k] = v;
    }
    if (Object.keys(filtered).length === 0) {
      return NextResponse.json(
        { error: `patch contained no allowed fields (allowed: ${Array.from(PATCHABLE_FIELDS).join(', ')})` },
        { status: 400 },
      );
    }

    await ensureTable();
    const patchJson = JSON.stringify(filtered);
    const result: any = await sql`UPDATE lms_users
      SET data = COALESCE(data, '{}'::jsonb) || ${patchJson}::jsonb,
          updated_at = NOW()
      WHERE id = ${String(id)}
      RETURNING id, data`;
    const row = Array.isArray(result) ? result[0] : null;
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, item: { id: row.id, ...row.data } });
  } catch (error) {
    console.error('LMS: Failed to patch user:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    if (body.ids && Array.isArray(body.ids)) {
      await Promise.all(body.ids.map((id: string) => sql`DELETE FROM lms_users WHERE id = ${String(id)}`));
      return NextResponse.json({ success: true, count: body.ids.length });
    }
    const { id } = body;
    await sql`DELETE FROM lms_users WHERE id = ${String(id)}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LMS: Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
