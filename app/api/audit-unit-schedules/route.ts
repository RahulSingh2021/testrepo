import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS audit_unit_schedules (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    let result;
    try { result = await sql`SELECT id, data FROM audit_unit_schedules ORDER BY updated_at DESC`; } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch audit unit schedules:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = Array.isArray(body) ? body : [body];
    const items = raw.filter((item: any) => item && item.id);
    if (items.length === 0) return NextResponse.json({ success: true, count: 0 });
    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, ...data } = item;
        // Safety net (task #165): warn if an incoming row has fewer periods than what's in the DB,
        // so a future client-side regression that wipes scheduled audit cycles is easy to spot.
        try {
          const existing: any = await sql`SELECT data FROM audit_unit_schedules WHERE id = ${String(id)}`;
          const existingPeriods = Array.isArray(existing?.[0]?.data?.periods) ? existing[0].data.periods.length : 0;
          const incomingPeriods = Array.isArray((data as any).periods) ? (data as any).periods.length : 0;
          if (existingPeriods > 0 && incomingPeriods < existingPeriods) {
            console.warn(`[audit-unit-schedules] periods shrinking for unit ${id}: ${existingPeriods} -> ${incomingPeriods}`);
          }
        } catch {}
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO audit_unit_schedules (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save audit unit schedules:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM audit_unit_schedules WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete audit unit schedule:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
