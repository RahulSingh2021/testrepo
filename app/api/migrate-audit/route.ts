import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    const taskRows = await sql`SELECT data FROM audit_tasks WHERE id = ${taskId}`;
    if (!Array.isArray(taskRows) || taskRows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    const task = taskRows[0].data;
    const checklistId = task.checklistId;

    if (!checklistId) return NextResponse.json({ error: 'No checklistId in task' }, { status: 400 });

    const clRows = await sql`SELECT data FROM audit_checklists WHERE id = ${checklistId}`;
    if (!Array.isArray(clRows) || clRows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }
    const checklist = clRows[0].data;

    const questionResponseMap: Record<string, any[]> = {};
    const allQuestions: any[] = [];
    for (const page of (checklist.pages || [])) {
      for (const section of (page.sections || [])) {
        for (const q of (section.questions || [])) {
          questionResponseMap[q.id] = q.responses || [];
          allQuestions.push(q);
        }
        for (const ss of (section.subSections || [])) {
          for (const q of (ss.questions || [])) {
            questionResponseMap[q.id] = q.responses || [];
            allQuestions.push(q);
          }
        }
      }
    }

    const taskQuestions = task.questions || [];
    const assignedLocations = task.assignedLocations || [];
    const isCombinedAudit = task.isCombinedAudit || false;

    const answers: Record<string, { selectedIndex: number | null; marks: number | null }> = {};
    const comments: Record<string, string> = {};

    const responseTextToIndex = (respText: string, responses: any[]): { selectedIndex: number | null; marks: number | null } => {
      if (!respText || !responses || responses.length === 0) {
        return { selectedIndex: null, marks: null };
      }
      const normalizedResp = respText.trim();
      for (let i = 0; i < responses.length; i++) {
        const rText = (responses[i].text || '').trim();
        if (rText.toLowerCase() === normalizedResp.toLowerCase()) {
          const score = responses[i].score;
          const marks = score === '' || score === null || score === undefined ? null : parseFloat(score);
          return { selectedIndex: i, marks };
        }
      }
      const mapping: Record<string, string[]> = {
        'yes': ['c', 'com', 'compliant'],
        'no': ['nc', 'non com', 'non-compliant', 'non compliant'],
        'c': ['yes', 'com', 'compliant'],
        'nc': ['no', 'non com', 'non-compliant'],
        'com': ['c', 'yes', 'compliant'],
        'non com': ['nc', 'no', 'non-compliant'],
        'n/a': ['na', 'not applicable'],
      };
      const lowResp = normalizedResp.toLowerCase();
      const alternatives = mapping[lowResp] || [];
      for (let i = 0; i < responses.length; i++) {
        const rText = (responses[i].text || '').trim().toLowerCase();
        if (alternatives.includes(rText)) {
          const score = responses[i].score;
          const marks = score === '' || score === null || score === undefined ? null : parseFloat(score);
          return { selectedIndex: i, marks };
        }
      }
      return { selectedIndex: 0, marks: null };
    };

    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const tq of taskQuestions) {
      const qId = tq.id;
      const response = tq.response;
      const findings = tq.findings;

      let matchedResponses = questionResponseMap[qId];

      if (!matchedResponses) {
        const qIdParts = qId.split('-');
        const qSuffix = qIdParts.slice(-3).join('-');
        for (const clQ of allQuestions) {
          if (clQ.id.endsWith(qSuffix)) {
            matchedResponses = clQ.responses || [];
            break;
          }
        }
      }

      if (!matchedResponses) {
        unmatchedCount++;
        continue;
      }

      matchedCount++;
      const { selectedIndex, marks } = responseTextToIndex(response, matchedResponses);

      for (const loc of assignedLocations) {
        const locKey = loc.replace(/ /g, '_');
        const answerKey = `${locKey}::${qId}`;
        answers[answerKey] = { selectedIndex, marks };
        if (findings) {
          comments[answerKey] = {
            entries: [{
              id: `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              text: findings,
              images: [],
              closureEvidence: [],
              closureComments: '',
              timestamp: new Date().toISOString(),
              createdAtMs: Date.now(),
              location: loc,
            }]
          };
        }
      }
    }

    const existingDraftRows = await sql`
      SELECT data FROM audit_reports 
      WHERE id = ${taskId} AND type = 'draft'
    `;
    const existingDraft = (Array.isArray(existingDraftRows) && existingDraftRows.length > 0) 
      ? existingDraftRows[0].data 
      : {};

    const applicability: Record<string, boolean> = existingDraft.applicability || {};
    if (Object.keys(applicability).length === 0) {
      for (const page of (checklist.pages || [])) {
        for (const section of (page.sections || [])) {
          applicability[section.id] = true;
          for (const ss of (section.subSections || [])) {
            applicability[ss.id] = true;
          }
        }
      }
    }

    const draft = {
      ...existingDraft,
      answers,
      comments,
      applicability,
      templateId: checklistId,
      checklistName: task.checklistName || checklist.title || '',
      unitName: task.unitName || '',
      auditState: 'running',
      currentStep: 'checklist',
      savedAt: Date.now(),
      auditStartTime: existingDraft.auditStartTime || Date.now(),
      totalPauseDuration: existingDraft.totalPauseDuration || 0,
      unitForm: existingDraft.unitForm || {},
      locationTags: existingDraft.locationTags || {},
      savedNotes: existingDraft.savedNotes || {},
      notesBestPractice: existingDraft.notesBestPractice || '',
      notesOpportunity: existingDraft.notesOpportunity || '',
      notesBPImages: existingDraft.notesBPImages || [],
      notesOFIImages: existingDraft.notesOFIImages || [],
      auditSignature: existingDraft.auditSignature || '',
      reviewerSignature: existingDraft.reviewerSignature || '',
      reviewerName: existingDraft.reviewerName || '',
      pageApplicability: existingDraft.pageApplicability || {},
      locationApplicability: existingDraft.locationApplicability || {},
      activeHeaderId: null,
      activeLocationTab: null,
      lockedLocation: null,
      scrollY: 0,
    };

    const jsonData = JSON.stringify(draft);

    await sql`INSERT INTO audit_reports (id, type, data, updated_at)
              VALUES (${taskId}, 'draft', ${jsonData}::jsonb, NOW())
              ON CONFLICT (id, type) DO UPDATE SET data = ${jsonData}::jsonb, updated_at = NOW()`;

    await sql`UPDATE audit_tasks 
              SET data = jsonb_set(data, '{status}', '"In Progress"'::jsonb),
                  updated_at = NOW()
              WHERE id = ${taskId}`;

    const totalMarks = Object.values(answers).reduce((sum: number, a: any) => sum + (a.marks || 0), 0);
    const answeredCount = Object.values(answers).filter((a: any) => a.selectedIndex !== null).length;

    console.log(`[migrate-audit] Migrated task ${taskId}: ${answeredCount} answers, ${totalMarks} total marks, ${matchedCount} matched, ${unmatchedCount} unmatched`);

    return NextResponse.json({ 
      success: true, 
      answeredCount,
      totalMarks,
      matchedQuestions: matchedCount,
      unmatchedQuestions: unmatchedCount,
      totalTaskQuestions: taskQuestions.length,
    });

  } catch (error) {
    console.error('[migrate-audit] Error:', error);
    return NextResponse.json({ error: 'Migration failed: ' + (error as Error).message }, { status: 500 });
  }
}
