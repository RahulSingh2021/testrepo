import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { taskId, questionId, managementTag } = await request.json();
    if (!taskId || !questionId) {
      return NextResponse.json({ error: 'Missing taskId or questionId' }, { status: 400 });
    }

    const rows = await sql`SELECT data FROM audit_tasks WHERE id = ${taskId}`;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const data = { ...rows[0].data };
    if (Array.isArray(data.observations)) {
      data.observations = data.observations.map((obs: any) => {
        if (obs.questionId === questionId) {
          if (managementTag) {
            return { ...obs, managementTag };
          } else {
            const { managementTag: _removed, ...rest } = obs;
            return rest;
          }
        }
        return obs;
      });
    }

    const jsonData = JSON.stringify(data);
    await sql`UPDATE audit_tasks SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${taskId}`;

    return NextResponse.json({ success: true, taskId, questionId, managementTag: managementTag || null });
  } catch (error) {
    console.error('Failed to update audit observation tag:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}
