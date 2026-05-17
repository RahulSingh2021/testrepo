import { NextResponse } from 'next/server';
import sql from '@/lib/db';

function collectOldIds(data: any): Set<string> {
  const oldIds = new Set<string>();
  const idAliases: Record<string, string[]> = data?.questionIdAliases || {};
  Object.values(idAliases).forEach((arr: any) => {
    if (Array.isArray(arr)) arr.forEach((id: string) => { if (id) oldIds.add(id); });
  });
  return oldIds;
}

function stripOldQuestions(pages: any[], oldIds: Set<string>): { pages: any[]; removed: number } {
  let removed = 0;
  const cleaned = pages.map((pg: any) => ({
    ...pg,
    sections: Array.isArray(pg.sections) ? pg.sections.map((sec: any) => ({
      ...sec,
      questions: Array.isArray(sec.questions)
        ? sec.questions.filter((q: any) => {
            if (!q || typeof q.id !== 'string') return true;
            if (oldIds.has(q.id)) { removed++; return false; }
            return true;
          })
        : [],
      subSections: Array.isArray(sec.subSections) ? sec.subSections.map((ss: any) => ({
        ...ss,
        questions: Array.isArray(ss.questions)
          ? ss.questions.filter((q: any) => {
              if (!q || typeof q.id !== 'string') return true;
              if (oldIds.has(q.id)) { removed++; return false; }
              return true;
            })
          : [],
      })) : [],
    })) : [],
  }));
  return { pages: cleaned, removed };
}

export async function POST() {
  try {
    const rows = await sql`SELECT id, data FROM audit_checklists`;
    let totalRemoved = 0;
    let checklistsUpdated = 0;

    for (const row of rows) {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      if (!data || !Array.isArray(data.pages)) continue;

      const oldIds = collectOldIds(data);
      if (oldIds.size === 0) continue;

      const { pages, removed } = stripOldQuestions(data.pages, oldIds);
      if (removed === 0) continue;

      const updatedData = { ...data, pages };
      await sql`UPDATE audit_checklists SET data = ${JSON.stringify(updatedData)}::jsonb, updated_at = NOW() WHERE id = ${row.id}`;
      totalRemoved += removed;
      checklistsUpdated++;
    }

    return NextResponse.json({
      success: true,
      checklistsUpdated,
      totalQuestionsRemoved: totalRemoved,
    });
  } catch (err: any) {
    console.error('Cleanup merged questions error:', err);
    return NextResponse.json({ error: err.message || 'Cleanup failed' }, { status: 500 });
  }
}
