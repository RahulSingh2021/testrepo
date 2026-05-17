import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

async function ensureTable() {
  await sql`CREATE TABLE IF NOT EXISTS facility_equipment (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}

const RESCHEDULE_ALLOWLIST = [
  'cleaningStartDate',
  'pmStartDate',
  'cleaningNextDueDate',
  'pmNextDueDate',
] as const;
type RescheduleField = typeof RESCHEDULE_ALLOWLIST[number];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing equipment id' }, { status: 400 });

    await ensureTable();

    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid body: must be an object' }, { status: 400 });
    }

    const updates: Partial<Record<RescheduleField, string | null>> = {};
    for (const key of Object.keys(body)) {
      if (!(RESCHEDULE_ALLOWLIST as readonly string[]).includes(key)) {
        return NextResponse.json({ error: `Field '${key}' is not allowed` }, { status: 400 });
      }
      const val = body[key];
      if (val !== null && (typeof val !== 'string' || !ISO_DATE_RE.test(val))) {
        return NextResponse.json({ error: `Field '${key}' must be a date string (YYYY-MM-DD) or null` }, { status: 400 });
      }
      updates[key as RescheduleField] = val;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    let existing;
    try {
      existing = await sql`SELECT id, data FROM facility_equipment WHERE id = ${id} LIMIT 1`;
    } catch {
      existing = null;
    }
    const rows = Array.isArray(existing) ? existing : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const row = rows[0] as { id: string; data: Record<string, unknown> };
    const merged = { ...row.data, ...updates };
    const jsonData = JSON.stringify(merged);

    await sql`UPDATE facility_equipment SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ id, ...merged });
  } catch (error) {
    console.error('Failed to patch equipment:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing equipment id' }, { status: 400 });

    await ensureTable();

    let result;
    try {
      result = await sql`SELECT id, data FROM facility_equipment WHERE id = ${id} LIMIT 1`;
    } catch {
      result = null;
    }

    const rows = Array.isArray(result) ? result : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const row = rows[0] as { id: string; data: Record<string, unknown> };
    return NextResponse.json({ id: row.id, ...row.data });
  } catch (error) {
    console.error('Failed to fetch equipment by id:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
