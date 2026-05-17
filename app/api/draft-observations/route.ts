import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

const ensureTable = async () => {
  await sql`CREATE TABLE IF NOT EXISTS draft_observations (
    id VARCHAR PRIMARY KEY,
    checklist_id VARCHAR NOT NULL,
    unit_id VARCHAR,
    comment_text TEXT DEFAULT '',
    location VARCHAR DEFAULT '',
    question_id VARCHAR DEFAULT '',
    question_text TEXT DEFAULT '',
    section_title TEXT DEFAULT '',
    is_offline_queued BOOLEAN DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  try {
    await sql`CREATE INDEX IF NOT EXISTS idx_draft_obs_checklist_unit ON draft_observations (checklist_id, unit_id)`;
  } catch {}
  try {
    await sql`ALTER TABLE draft_observations ADD COLUMN IF NOT EXISTS management_tag VARCHAR DEFAULT NULL`;
  } catch {}
};

export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const checklistId = req.nextUrl.searchParams.get('checklistId');
    const unitId = req.nextUrl.searchParams.get('unitId');

    if (!checklistId) {
      return NextResponse.json({ error: 'Missing checklistId' }, { status: 400 });
    }

    let rows;
    if (unitId) {
      rows = await sql`SELECT * FROM draft_observations WHERE checklist_id = ${checklistId} AND unit_id = ${unitId} ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM draft_observations WHERE checklist_id = ${checklistId} AND unit_id IS NULL ORDER BY created_at DESC`;
    }

    const drafts = (rows || []).map((r: any) => ({
      id: r.id,
      checklistId: r.checklist_id || '',
      unitId: r.unit_id || '',
      commentText: r.comment_text || '',
      commentImages: [],
      location: r.location || '',
      questionId: r.question_id || '',
      questionText: r.question_text || '',
      sectionTitle: r.section_title || '',
      createdAt: parseInt(r.created_at) || Date.now(),
      isOfflineQueued: r.is_offline_queued || false,
      managementTag: r.management_tag || undefined,
    }));

    return NextResponse.json(drafts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Failed to fetch draft observations:', error);
    return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable();
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      if (!item.id || !item.checklistId) continue;
      await sql`INSERT INTO draft_observations (id, checklist_id, unit_id, comment_text, location, question_id, question_text, section_title, is_offline_queued, created_at, updated_at, management_tag)
        VALUES (${item.id}, ${item.checklistId}, ${item.unitId || null}, ${item.commentText || ''}, ${item.location || ''}, ${item.questionId || ''}, ${item.questionText || ''}, ${item.sectionTitle || ''}, ${item.isOfflineQueued || false}, ${item.createdAt || Date.now()}, NOW(), ${item.managementTag || null})
        ON CONFLICT (id) DO UPDATE SET
          comment_text = ${item.commentText || ''},
          location = ${item.location || ''},
          question_id = ${item.questionId || ''},
          question_text = ${item.questionText || ''},
          section_title = ${item.sectionTitle || ''},
          is_offline_queued = ${item.isOfflineQueued || false},
          management_tag = ${item.managementTag || null},
          updated_at = NOW()`;
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error('Failed to save draft observation:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureTable();
    const { id, ids } = await req.json();

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await sql`DELETE FROM draft_observations WHERE id = ANY(${ids})`;
      await sql`DELETE FROM draft_images WHERE draft_id = ANY(${ids})`;
    } else if (id) {
      await sql`DELETE FROM draft_observations WHERE id = ${id}`;
      await sql`DELETE FROM draft_images WHERE draft_id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete draft observation:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
