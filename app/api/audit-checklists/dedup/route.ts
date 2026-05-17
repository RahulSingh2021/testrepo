import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const checklistId = body.checklistId;
    const dryRun = body.dryRun !== false;

    if (!checklistId) {
      return NextResponse.json({ error: 'checklistId required' }, { status: 400 });
    }

    const rows = await sql`SELECT id, data FROM audit_checklists WHERE id = ${checklistId}`;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const checklist = rows[0].data;
    let totalRemoved = 0;
    const removedDetails: { page: string; section: string; subsection?: string; questionId: string; questionText: string }[] = [];

    const deduplicateQuestions = (questions: any[], pageName: string, sectionName: string, subsectionName?: string) => {
      const seen = new Map<string, any>();
      const deduped: any[] = [];

      for (const q of questions) {
        const textKey = (q.text || '').toLowerCase().trim();
        if (!textKey) {
          deduped.push(q);
          continue;
        }

        if (seen.has(textKey)) {
          totalRemoved++;
          removedDetails.push({
            page: pageName,
            section: sectionName,
            subsection: subsectionName,
            questionId: q.id,
            questionText: q.text?.substring(0, 80) + (q.text?.length > 80 ? '...' : ''),
          });
        } else {
          seen.set(textKey, q);
          deduped.push(q);
        }
      }
      return deduped;
    };

    const updatedPages = (checklist.pages || []).map((page: any) => ({
      ...page,
      sections: (page.sections || []).map((section: any) => ({
        ...section,
        questions: deduplicateQuestions(
          section.questions || [],
          page.title || page.id,
          section.title || section.id
        ),
        subSections: (section.subSections || []).map((ss: any) => ({
          ...ss,
          questions: deduplicateQuestions(
            ss.questions || [],
            page.title || page.id,
            section.title || section.id,
            ss.title || ss.id
          ),
        })),
      })),
    }));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        checklistId,
        totalRemoved,
        removedDetails: removedDetails.slice(0, 50),
        totalRemovedFull: removedDetails.length,
      });
    }

    const updatedData = { ...checklist, pages: updatedPages };
    const jsonData = JSON.stringify(updatedData);
    await sql`UPDATE audit_checklists SET data = ${jsonData}::jsonb, updated_at = NOW() WHERE id = ${checklistId}`;

    return NextResponse.json({
      success: true,
      checklistId,
      totalRemoved,
      removedDetails: removedDetails.slice(0, 50),
    });
  } catch (error) {
    console.error('Dedup failed:', error);
    return NextResponse.json({ error: 'Dedup failed' }, { status: 500 });
  }
}
