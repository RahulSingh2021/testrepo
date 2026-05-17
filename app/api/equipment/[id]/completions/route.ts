import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing equipment id' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const scanType = searchParams.get('type') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10) || 5, 20);

    let result;
    try {
      if (scanType) {
        result = await sql`
          SELECT id, data, updated_at FROM audit_reports
          WHERE type = 'report'
            AND data->>'equipmentId' = ${id}
            AND data->>'scanType' = ${scanType}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `;
      } else {
        result = await sql`
          SELECT id, data, updated_at FROM audit_reports
          WHERE type = 'report'
            AND data->>'equipmentId' = ${id}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `;
      }
    } catch {
      result = null;
    }

    const rows = Array.isArray(result) ? result : [];
    const completions = rows.map((r: any) => ({
      id: r.id,
      completedAt: r.updated_at,
      scanType: r.data?.scanType || scanType,
      checklistName: r.data?.checklistName || '',
      equipmentId: r.data?.equipmentId || id,
    }));

    return NextResponse.json(completions);
  } catch (error) {
    console.error('Failed to fetch equipment completions:', error);
    return NextResponse.json([], { status: 200 });
  }
}
