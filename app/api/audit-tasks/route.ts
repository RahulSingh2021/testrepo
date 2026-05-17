import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS audit_tasks (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const slim = request.nextUrl.searchParams.get('slim') === '1';
    let result;
    try {
      if (slim) {
        result = await sql`
          SELECT id,
            jsonb_build_object(
              'status', data->>'status',
              'title', data->>'title',
              'checklistId', data->>'checklistId',
              'checklistName', data->>'checklistName',
              'department', data->>'department',
              'scheduledDate', data->>'scheduledDate',
              'startTime', data->>'startTime',
              'endTime', data->>'endTime',
              'auditorName', data->>'auditorName',
              'auditorId', data->>'auditorId',
              'unitId', data->>'unitId',
              'unitName', data->>'unitName',
              'score', data->'score',
              'maxScore', data->'maxScore',
              'scoreObtained', data->'scoreObtained',
              'scoreMax', data->'scoreMax',
              'percentage', data->'percentage',
              'reviewerName', data->>'reviewerName',
              'reviewerId', data->>'reviewerId',
              'reviewRequired', data->'reviewRequired',
              'submittedForReviewAt', data->>'submittedForReviewAt',
              'groupId', data->>'groupId',
              'assignedLocations', data->'assignedLocations'
            ) as data
          FROM audit_tasks ORDER BY updated_at DESC`;
      } else {
        result = await sql`SELECT id, data FROM audit_tasks ORDER BY updated_at DESC`;
      }
    } catch { result = null; }
    const rows = Array.isArray(result) ? result : [];
    const items = rows.map((r: any) => ({ id: r.id, ...r.data }));
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch audit tasks:', error);
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
        await sql`INSERT INTO audit_tasks (id, data, updated_at) VALUES (${String(id)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save audit tasks:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    await sql`DELETE FROM audit_tasks WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete audit task:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
