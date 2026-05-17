import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS audit_reports (
    id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'report',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, type)
  )`;
};

export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const ids = searchParams.get('ids');
    const checklist = searchParams.get('checklist');
    const unit = searchParams.get('unit');
    const limit = searchParams.get('limit');

    let result;
    if (ids) {
      const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
      if (idList.length === 0) return NextResponse.json([]);
      if (type) {
        result = await sql`SELECT id, type, data FROM audit_reports WHERE id = ANY(${idList}) AND type = ${type}`;
      } else {
        result = await sql`SELECT id, type, data FROM audit_reports WHERE id = ANY(${idList})`;
      }
    } else if (checklist) {
      const lim = Math.min(parseInt(limit || '5', 10) || 5, 20);
      const reportType = type || 'report';
      if (unit) {
        result = await sql`SELECT id, type, data FROM audit_reports
          WHERE type = ${reportType}
            AND (data->>'checklistId' = ${checklist} OR data->>'templateId' = ${checklist} OR data->>'checklistName' = ${checklist})
            AND data->>'unitName' = ${unit}
          ORDER BY updated_at DESC LIMIT ${lim}`;
      } else {
        result = await sql`SELECT id, type, data FROM audit_reports
          WHERE type = ${reportType}
            AND (data->>'checklistId' = ${checklist} OR data->>'templateId' = ${checklist} OR data->>'checklistName' = ${checklist})
          ORDER BY updated_at DESC LIMIT ${lim}`;
      }
    } else if (type) {
      result = await sql`SELECT id, type, data FROM audit_reports WHERE type = ${type} ORDER BY updated_at DESC`;
    } else {
      result = await sql`SELECT id, type, data FROM audit_reports ORDER BY updated_at DESC`;
    }

    const rows = Array.isArray(result) ? result : [];
    return NextResponse.json(rows.map((r: any) => ({ id: r.id, type: r.type, data: r.data })));
  } catch (error) {
    console.error('Failed to fetch audit reports:', error);
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
      const answerCount = item.data?.answers ? Object.keys(item.data.answers).length : 0;
      const dataSize = JSON.stringify(item.data || {}).length;
      console.log(`[audit-reports] SAVE id=${item.id} type=${item.type} answers=${answerCount} dataSize=${dataSize}`);
    }

    await sql`CREATE TABLE IF NOT EXISTS audit_answer_hwm (
      report_id TEXT PRIMARY KEY,
      max_answers INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    const BATCH_SIZE = 20;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (item: any) => {
        const { id, type = 'report', data } = item;
        const incomingAnswerCount = data?.answers ? Object.keys(data.answers).filter((k: string) => {
          const a = data.answers[k];
          return a && a.selectedIndex !== null && a.selectedIndex !== undefined;
        }).length : 0;

        if (type === 'draft') {
          const existingRows = await sql`SELECT 
            (SELECT count(*) FROM jsonb_each(data->'answers') WHERE (value->>'selectedIndex') IS NOT NULL) as db_count
            FROM audit_reports WHERE id = ${String(id)} AND type = 'draft'`;
          const dbCount = (Array.isArray(existingRows) && existingRows.length > 0) ? parseInt(existingRows[0].db_count || '0') : 0;

          const hwmRows = await sql`SELECT max_answers FROM audit_answer_hwm WHERE report_id = ${String(id)}`;
          const hwm = (Array.isArray(hwmRows) && hwmRows.length > 0) ? parseInt(hwmRows[0].max_answers || '0') : 0;

          const peakCount = Math.max(dbCount, hwm);

          if (incomingAnswerCount > hwm) {
            await sql`INSERT INTO audit_answer_hwm (report_id, max_answers, updated_at)
                      VALUES (${String(id)}, ${incomingAnswerCount}, NOW())
                      ON CONFLICT (report_id) DO UPDATE SET max_answers = ${incomingAnswerCount}, updated_at = NOW()`;
          }

          if (peakCount > 10 && incomingAnswerCount < peakCount * 0.5) {
            console.log(`[audit-reports] BLOCKED save: incoming=${incomingAnswerCount}, dbCount=${dbCount}, hwm=${hwm} for ${id}`);
            return;
          }
        }

        const jsonData = JSON.stringify(data);
        await sql`INSERT INTO audit_reports (id, type, data, updated_at)
                  VALUES (${String(id)}, ${String(type)}, ${jsonData}::jsonb, NOW())
                  ON CONFLICT (id, type) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;
      }));
    }
    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save audit reports:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureTable();
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'strip-images') {
      const rows = await sql`SELECT id, type, data FROM audit_reports WHERE data->'comments' IS NOT NULL`;
      let stripped = 0;
      for (const row of rows) {
        const data = row.data;
        if (!data?.comments) continue;
        let changed = false;
        for (const qid of Object.keys(data.comments)) {
          const entries = data.comments[qid]?.entries;
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            if (Array.isArray(entry.images) && entry.images.length > 0) {
              entry.images = [];
              changed = true;
            }
            if (Array.isArray(entry.closureEvidence) && entry.closureEvidence.length > 0) {
              entry.closureEvidence = [];
              changed = true;
            }
          }
        }
        if (data.signatures) {
          if (data.signatures.auditor) { data.signatures.auditor = ''; changed = true; }
          if (data.signatures.auditee) { data.signatures.auditee = ''; changed = true; }
        }
        if (changed) {
          const jsonData = JSON.stringify(data);
          await sql`UPDATE audit_reports SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${row.id} AND type = ${row.type}`;
          stripped++;
        }
      }
      return NextResponse.json({ success: true, stripped, message: `Stripped images from ${stripped} audit reports` });
    }
    return NextResponse.json({ success: true, message: 'No action specified' });
  } catch (error) {
    console.error('PATCH audit-reports error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureTable();
    const { id, type } = await request.json();
    if (id && type) {
      await sql`DELETE FROM audit_reports WHERE id = ${id} AND type = ${type}`;
    } else if (id) {
      await sql`DELETE FROM audit_reports WHERE id = ${id}`;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete audit report:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
