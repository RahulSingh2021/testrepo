import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS audit_checklists (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const entityHierarchy = searchParams.get('entityHierarchy');
    
    let result;
    try {
      if (entityId) {
        let allowedIds: string[] = [entityId];
        if (entityHierarchy) {
          allowedIds = [...new Set(entityHierarchy.split(',').map(id => id.trim()).filter(Boolean))];
          if (allowedIds.length === 0) allowedIds = [entityId];
        }
        result = await sql`SELECT id, data FROM audit_checklists WHERE data->>'createdByEntityId' = ANY(${allowedIds}) OR data->>'createdByEntityId' IS NULL ORDER BY updated_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM audit_checklists ORDER BY updated_at DESC`;
      }
    } catch (e) {
      console.error('Failed to query audit checklists:', e);
      result = null;
    }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch audit checklists:', error);
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
        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO audit_checklists (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save audit checklists:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM audit_checklists WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete audit checklist:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
