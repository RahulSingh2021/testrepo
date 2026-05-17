import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { id, managementTag } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const rows = await sql`SELECT data FROM observations WHERE id = ${id}`;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data = { ...rows[0].data };
    if (managementTag) {
      data.managementTag = managementTag;
    } else {
      delete data.managementTag;
    }

    const jsonData = JSON.stringify(data);
    await sql`UPDATE observations SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${id}`;

    return NextResponse.json({ success: true, id, managementTag: managementTag || null });
  } catch (error) {
    console.error('Failed to update observation tag:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}
