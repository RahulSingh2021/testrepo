import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS supplier_submissions (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const unitId = request.nextUrl.searchParams.get('unitId');
    const unitIds = request.nextUrl.searchParams.get('unitIds');
    const supplierId = request.nextUrl.searchParams.get('supplierId');
    const status = request.nextUrl.searchParams.get('status');

    if (!unitId && !unitIds && !supplierId) {
      return NextResponse.json([], { status: 200 });
    }

    let rows = await sql`SELECT id, data FROM supplier_submissions ORDER BY updated_at DESC`;
    let records = (Array.isArray(rows) ? rows : []).map((r: any) => ({ id: r.id, ...r.data }));

    if (unitIds && unitIds !== '__all__') {
      const ids = unitIds.split(',').map(s => s.trim()).filter(Boolean);
      records = records.filter((r: any) => ids.includes(r.unitId));
    } else if (unitId) {
      records = records.filter((r: any) => r.unitId === unitId);
    }
    if (supplierId) {
      records = records.filter((r: any) => r.supplierId === supplierId);
    }
    if (status) {
      records = records.filter((r: any) => r.status === status);
    }

    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch supplier submissions:', error);
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

    for (const item of items) {
      const { id, ...data } = item;
      const jsonData = JSON.stringify(data);
      await sql`INSERT INTO supplier_submissions (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save supplier submission:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureTable();
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const rows = await sql`SELECT data FROM supplier_submissions WHERE id = ${id}`;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = rows[0].data;
    const merged = { ...existing, ...updates };
    const jsonData = JSON.stringify(merged);
    await sql`UPDATE supplier_submissions SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${id}`;

    return NextResponse.json({ success: true, data: { id, ...merged } });
  } catch (error) {
    console.error('Failed to update supplier submission:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { id } = await request.json();
    await sql`DELETE FROM supplier_submissions WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete supplier submission:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
