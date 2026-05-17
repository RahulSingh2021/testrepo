import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await sql`SELECT id, data FROM observations WHERE id = ${id}`;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ id: rows[0].id, ...rows[0].data });
  } catch (error) {
    console.error('Failed to fetch observation:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
