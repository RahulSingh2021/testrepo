import { savePdfForPWA } from './pdfDownload';
import type { AuditTask } from '../types';
import type { ChecklistTemplate, QuestionNode, SectionNode } from '../components/AuditChecklistCreator';

interface CommentEntry {
  text?: string;
  images?: string[];
  closureComments?: string;
  closureEvidence?: string[];
  corrections?: Array<{ reason: string }>;
  timestamp?: string;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
  isRepeat?: boolean;
  repeatOriginalDate?: string;
  repeatTrail?: { date: string; comment: string }[];
  location?: string;
}

interface ReportData {
  answers: Record<string, { selectedIndex: number | null; marks: number | null }>;
  comments: Record<string, { entries?: CommentEntry[] }>;
  applicability: Record<string, boolean>;
  pageApplicability?: Record<string, boolean>;
  auditSignature?: string;
  reviewerSignature?: string;
  reviewerName?: string;
  savedNotes?: { bestPractice: string; opportunity: string; bestPracticeImages?: string[]; opportunityImages?: string[] };
  unitForm?: { companyName?: string; repName?: string; address?: string; scope?: string; dateFrom?: string; startTime?: string; geotag?: string };
  repeats?: Record<string, boolean>;
}

export interface ConsolidatedReportEntry {
  task: AuditTask;
  report: ReportData;
  template: ChecklistTemplate;
}

export interface ConsolidatedGroupInfo {
  checklistName: string;
  unitName: string;
  isDraft: boolean;
  auditorNames: string[];
  auditDate: string;
  auditStartDate?: string;
  auditEndDate?: string;
}

function _isAnswerNA(q: QuestionNode, ans: { selectedIndex: number | null; marks: number | null } | undefined): boolean {
  if (!ans || ans.selectedIndex === null) return false;
  const response = q.responses[ans.selectedIndex];
  if (!response) return false;
  return response.text.toLowerCase() === 'n/a' || response.text.toLowerCase() === 'na' || response.score === '/';
}

function _getQuestionMaxScore(q: QuestionNode): number {
  let best = 0;
  q.responses.forEach(r => {
    const isNA = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
    if (!isNA) {
      const v = parseFloat(r.score) || 0;
      if (v > best) best = v;
    }
  });
  return best;
}

function _stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function _allSecQs(sec: SectionNode): QuestionNode[] {
  return [...(sec.questions || []), ...((sec.subSections || []).flatMap(ss => ss.questions || []))];
}

function _fmtPct(obtained: number, max: number): string {
  if (max <= 0) return '0.0';
  return ((obtained / max) * 100).toFixed(1);
}

function _getRating(pct: number): string {
  return pct >= 90 ? 'Green' : pct >= 70 ? 'Yellow' : 'Red';
}

function _getRatingColor(pct: number): [number, number, number] {
  return pct >= 90 ? [22, 163, 74] : pct >= 70 ? [217, 119, 6] : [220, 38, 38];
}

interface AggBucket {
  questions: number;
  findings: number;
  repeats: number;
  earned: number;
  possible: number;
  na: number;
}

function _emptyBucket(): AggBucket {
  return { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0 };
}

export async function generateConsolidatedPdf(
  entries: ConsolidatedReportEntry[],
  groupInfo: ConsolidatedGroupInfo
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const ml = 40, mr = 40, mt = 40, mb = 50;
  const cw = pw - ml - mr;
  let y = mt;
  let pageNum = 1;

  const checkPage = (needed: number) => {
    if (y + needed > ph - mb) { pdf.addPage(); pageNum++; y = mt; return true; }
    return false;
  };

  const drawSectionHeader = (title: string, scorePct?: number, scoreObtained?: number, scoreMax?: number) => {
    checkPage(24);
    pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 20, 'F');
    pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
    pdf.text(title.toUpperCase(), ml + 8, y + 13);
    if (scorePct !== undefined) {
      const scoreLabel = scoreObtained !== undefined && scoreMax !== undefined
        ? `${scoreObtained}/${scoreMax} pts  (${scorePct}%)`
        : `${scorePct}%`;
      pdf.text(scoreLabel, ml + cw - 8, y + 13, { align: 'right' });
    }
    y += 24;
  };

  const summCols = [
    { label: 'Name', x: ml + 8, w: 155 },
    { label: 'Questions', x: ml + 170, w: 42, align: 'center' },
    { label: 'N/A', x: ml + 218, w: 30, align: 'center' },
    { label: 'Findings', x: ml + 253, w: 42, align: 'center' },
    { label: 'Repeat', x: ml + 300, w: 35, align: 'center' },
    { label: 'Repeat %', x: ml + 340, w: 35, align: 'center' },
    { label: 'Earned', x: ml + 385, w: 40, align: 'center' },
    { label: 'Possible', x: ml + 430, w: 40, align: 'center' },
    { label: 'Score', x: ml + cw - 8, w: 50, align: 'right' },
  ];

  const drawTableHeader = (cols: { label: string; x: number; w: number; align?: string }[]) => {
    checkPage(18);
    pdf.setFillColor(241, 245, 249); pdf.rect(ml, y, cw, 16, 'F');
    pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5);
    pdf.rect(ml, y, cw, 16);
    pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'bold');
    cols.forEach(col => {
      pdf.text(col.label, col.x, y + 11, { align: (col.align as any) || 'left' });
    });
    y += 16;
  };

  const drawTableRow = (cells: { text: string; x: number; w: number; align?: string; bold?: boolean; color?: [number, number, number] }[], rowH: number = 14, fillAlt?: boolean) => {
    checkPage(rowH);
    if (fillAlt) { pdf.setFillColor(248, 250, 252); pdf.rect(ml, y, cw, rowH, 'F'); }
    pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
    pdf.line(ml, y + rowH, ml + cw, y + rowH);
    cells.forEach(cell => {
      pdf.setFontSize(7.5); pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal');
      pdf.setTextColor(...(cell.color || [30, 41, 59]));
      const align = (cell.align as any) || 'left';
      const maxW = cell.w - 4;
      let displayText = cell.text;
      if (maxW > 0 && align === 'left') {
        while (pdf.getTextWidth(displayText) > maxW && displayText.length > 1) {
          displayText = displayText.slice(0, -1);
        }
        if (displayText.length < cell.text.length) displayText = displayText.slice(0, -1) + '…';
      }
      pdf.text(displayText, cell.x, y + rowH / 2 + 3, { align });
    });
    y += rowH;
  };

  const _makeSummRow = (label: string, b: AggBucket, bold: boolean, fillAlt?: boolean, rowH: number = 14, labelColor?: [number, number, number]) => {
    const pctNum = b.possible > 0 ? (b.earned / b.possible) * 100 : 0;
    const rPctStr = b.questions > 0 ? _fmtPct(b.repeats, b.questions) : '0.0';
    drawTableRow([
      { text: label, x: ml + 8, w: 155, bold, color: labelColor },
      { text: String(b.questions), x: ml + 170, w: 42, align: 'center', bold },
      { text: b.na > 0 ? String(b.na) : '—', x: ml + 218, w: 30, align: 'center', bold, color: b.na > 0 ? [148, 163, 184] : [200, 200, 200] },
      { text: String(b.findings), x: ml + 253, w: 42, align: 'center', bold },
      { text: String(b.repeats), x: ml + 300, w: 35, align: 'center', bold },
      { text: b.repeats > 0 ? `${rPctStr}%` : '—', x: ml + 340, w: 35, align: 'center', bold, color: b.repeats > 0 ? [225, 29, 72] : [150, 150, 150] },
      { text: String(b.earned), x: ml + 385, w: 40, align: 'center', bold },
      { text: String(b.possible), x: ml + 430, w: 40, align: 'center', bold },
      { text: `${_fmtPct(b.earned, b.possible)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: _getRatingColor(pctNum) },
    ], rowH, fillAlt);
  };

  const _drawOverallLine = (b: AggBucket) => {
    pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.8); pdf.line(ml, y, ml + cw, y);
    _makeSummRow('OVERALL', b, true, false, 18);
    y += 8;
  };

  let grandEarned = 0, grandPossible = 0;
  entries.forEach(({ report, template }) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) return;
          grandPossible += _getQuestionMaxScore(q);
          if (a && a.selectedIndex !== null) grandEarned += a.marks || 0;
        });
      });
    });
  });
  const overallPct = grandPossible > 0 ? (grandEarned / grandPossible) * 100 : 0;

  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pw, 100, 'F');
  pdf.setFontSize(24); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
  pdf.text('HACCP PRO', ml, 45);
  pdf.setFontSize(9); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
  pdf.text('FOOD SAFETY MANAGEMENT SYSTEM', ml, 60);
  pdf.setDrawColor(51, 65, 85); pdf.setLineWidth(1);
  pdf.line(ml, 75, pw - mr, 75);
  pdf.setFontSize(8); pdf.setTextColor(203, 213, 225);
  pdf.text(groupInfo.isDraft ? 'DRAFT CONSOLIDATED AUDIT REPORT' : 'FINAL CONSOLIDATED AUDIT REPORT', ml, 88);
  pdf.text(`REPORT ID: CAR-${Date.now().toString().slice(-8)}`, pw - mr, 88, { align: 'right' });
  if (groupInfo.isDraft) {
    pdf.setFontSize(11); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold');
    pdf.text('DRAFT', pw - mr - 60, 45);
    pdf.setDrawColor(245, 158, 11); pdf.setLineWidth(1);
    pdf.roundedRect(pw - mr - 72, 32, 52, 18, 3, 3, 'S');
  }
  y = 120;

  const drawInfoCard = (title: string, data: [string, string][], x: number, w: number) => {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    const cardH = data.length * 15 + 25;
    pdf.roundedRect(x, y, w, cardH, 3, 3, 'FD');
    pdf.setFontSize(9); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'bold');
    pdf.text(title.toUpperCase(), x + 10, y + 15);
    let iy = y + 30;
    data.forEach(([label, val]) => {
      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 116, 139);
      pdf.text(label + ':', x + 10, iy);
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
      const valW = w - 85;
      const lines = pdf.splitTextToSize(val || '—', valW);
      lines.forEach((line: string, li: number) => {
        pdf.text(line, x + 75, iy + li * 9);
      });
      iy += Math.max(15, lines.length * 9 + 2);
    });
    return cardH;
  };

  const firstReport = entries[0]?.report;
  const firstUnitForm = firstReport?.unitForm;
  const locationNames = entries.map(e => {
    const locs = e.task.assignedLocations;
    if (locs && locs.length > 0) return locs.join(', ');
    return e.task.department || '';
  });

  const infoLeft: [string, string][] = [
    ['Template', groupInfo.checklistName || 'Untitled Audit'],
    ['Company', firstUnitForm?.companyName || groupInfo.unitName || '—'],
    ['Locations', locationNames.join('; ') || '—'],
    ['Scope', firstUnitForm?.scope || '—'],
  ];

  const infoRight: [string, string][] = [
    ['Status', groupInfo.isDraft ? 'Draft' : 'Released'],
    ['Auditor(s)', groupInfo.auditorNames.join(', ') || '—'],
    ['Audit Date', groupInfo.auditDate || '—'],
    ['Locations', `${entries.length} location(s)`],
  ];

  const cardW = (cw - 15) / 2;
  const hL = drawInfoCard('General Information', infoLeft, ml, cardW);
  const hR = drawInfoCard('Audit Details', infoRight, ml + cardW + 15, cardW);
  y += Math.max(hL, hR) + 25;

  checkPage(80);
  const summaryX = ml;
  const summaryW = cw;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(summaryX, y, summaryW, 70, 4, 4, 'FD');
  const circleX = summaryX + 45;
  const circleY = y + 35;
  const [rc, gc, bc] = _getRatingColor(overallPct);
  pdf.setDrawColor(rc, gc, bc);
  pdf.setLineWidth(3);
  pdf.circle(circleX, circleY, 25, 'S');
  pdf.setFontSize(14); pdf.setTextColor(rc, gc, bc); pdf.setFont('helvetica', 'bold');
  pdf.text(`${_fmtPct(grandEarned, grandPossible)}%`, circleX, circleY + 5, { align: 'center' });
  pdf.setFontSize(11); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'bold');
  pdf.text('OVERALL AUDIT COMPLIANCE', summaryX + 90, y + 25);
  pdf.setFontSize(9); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Score: ${grandEarned} / ${grandPossible} points`, summaryX + 90, y + 42);
  const rating = _getRating(overallPct);
  pdf.setFillColor(rc, gc, bc);
  pdf.roundedRect(summaryX + 90, y + 48, 60, 14, 2, 2, 'F');
  pdf.setFontSize(8); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
  pdf.text(rating.toUpperCase(), summaryX + 120, y + 58, { align: 'center' });
  y += 95;

  const allBPTexts: string[] = [];
  const allBPImgs: string[] = [];
  const allOFITexts: string[] = [];
  const allOFIImgs: string[] = [];
  entries.forEach(({ report }) => {
    const sn = report.savedNotes;
    if (!sn) return;
    const bp = _stripHtmlToText(sn.bestPractice || '');
    if (bp) allBPTexts.push(bp);
    (sn.bestPracticeImages || []).forEach(img => allBPImgs.push(img));
    const ofi = _stripHtmlToText(sn.opportunity || '');
    if (ofi) allOFITexts.push(ofi);
    (sn.opportunityImages || []).forEach(img => allOFIImgs.push(img));
  });

  if (allBPTexts.length > 0 || allBPImgs.length > 0 || allOFITexts.length > 0 || allOFIImgs.length > 0) {
    checkPage(80);
    pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
    pdf.text('EXECUTIVE SUMMARY', ml, y);
    y += 15;

    if (allBPTexts.length > 0 || allBPImgs.length > 0) {
      const combinedBP = allBPTexts.join('\n\n');
      const bpLines = combinedBP ? pdf.splitTextToSize(combinedBP, cw - 30) : [];
      const textBoxH = bpLines.length * 10 + 25;
      checkPage(textBoxH);
      pdf.setFillColor(240, 253, 244); pdf.setDrawColor(187, 247, 208);
      pdf.roundedRect(ml, y, cw, textBoxH, 2, 2, 'FD');
      pdf.setFontSize(8.5); pdf.setTextColor(21, 128, 61); pdf.setFont('helvetica', 'bold');
      pdf.text('KEY STRENGTHS & BEST PRACTICES', ml + 10, y + 15);
      if (combinedBP) {
        pdf.setFontSize(8); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal');
        bpLines.forEach((l: string, i: number) => pdf.text(l, ml + 10, y + 28 + i * 10));
      }
      y += textBoxH + 5;
      if (allBPImgs.length > 0) {
        const imgSize = 65;
        const imgGap = 8;
        const maxPerRow = Math.min(3, Math.floor((cw - 20) / (imgSize + imgGap)));
        for (let idx = 0; idx < allBPImgs.length; idx++) {
          const col = idx % maxPerRow;
          if (col === 0) checkPage(imgSize + imgGap);
          const imgX = ml + 10 + col * (imgSize + imgGap);
          try { pdf.addImage(allBPImgs[idx], 'JPEG', imgX, y, imgSize, imgSize); } catch {}
          if (col === maxPerRow - 1 || idx === allBPImgs.length - 1) { y += imgSize + imgGap; }
        }
      }
      y += 5;
    }

    if (allOFITexts.length > 0 || allOFIImgs.length > 0) {
      const combinedOFI = allOFITexts.join('\n\n');
      const ofiLines = combinedOFI ? pdf.splitTextToSize(combinedOFI, cw - 30) : [];
      const textBoxH = ofiLines.length * 10 + 25;
      checkPage(textBoxH);
      pdf.setFillColor(255, 251, 235); pdf.setDrawColor(253, 230, 138);
      pdf.roundedRect(ml, y, cw, textBoxH, 2, 2, 'FD');
      pdf.setFontSize(8.5); pdf.setTextColor(180, 83, 9); pdf.setFont('helvetica', 'bold');
      pdf.text('AREAS FOR IMPROVEMENT', ml + 10, y + 15);
      if (combinedOFI) {
        pdf.setFontSize(8); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal');
        ofiLines.forEach((l: string, i: number) => pdf.text(l, ml + 10, y + 28 + i * 10));
      }
      y += textBoxH + 5;
      if (allOFIImgs.length > 0) {
        const imgSize = 65;
        const imgGap = 8;
        const maxPerRow = Math.min(3, Math.floor((cw - 20) / (imgSize + imgGap)));
        for (let idx = 0; idx < allOFIImgs.length; idx++) {
          const col = idx % maxPerRow;
          if (col === 0) checkPage(imgSize + imgGap);
          const imgX = ml + 10 + col * (imgSize + imgGap);
          try { pdf.addImage(allOFIImgs[idx], 'JPEG', imgX, y, imgSize, imgSize); } catch {}
          if (col === maxPerRow - 1 || idx === allOFIImgs.length - 1) { y += imgSize + imgGap; }
        }
      }
      y += 10;
    }
  }

  const respGroups: Record<string, AggBucket> = {};
  entries.forEach(({ report, template }) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const respList = (q.responsibility && q.responsibility.length > 0) ? q.responsibility : ['Unassigned'];
          respList.forEach(resp => {
            if (!respGroups[resp]) respGroups[resp] = _emptyBucket();
            const a = ans[q.id];
            if (_isAnswerNA(q, a)) { respGroups[resp].na++; return; }
            respGroups[resp].questions++;
            respGroups[resp].possible += _getQuestionMaxScore(q);
            if (reps[q.id]) respGroups[resp].repeats++;
            if (a && a.selectedIndex !== null) {
              respGroups[resp].earned += a.marks || 0;
              if ((a.marks || 0) < _getQuestionMaxScore(q)) respGroups[resp].findings++;
            }
          });
        });
      });
    });
  });

  if (Object.keys(respGroups).length > 0) {
    drawSectionHeader('Summary by Responsibility');
    const respSummCols = [...summCols];
    respSummCols[0] = { label: 'Responsibility', x: ml + 8, w: 155 };
    drawTableHeader(respSummCols);
    const respKeys = Object.keys(respGroups).sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b));
    const total = _emptyBucket();
    respKeys.forEach((resp, idx) => {
      const g = respGroups[resp];
      total.questions += g.questions; total.findings += g.findings; total.repeats += g.repeats;
      total.earned += g.earned; total.possible += g.possible; total.na += g.na;
      checkPage(16);
      _makeSummRow(resp, g, true, idx % 2 === 0, 16);
    });
    _drawOverallLine(total);
  }

  drawSectionHeader('Summary by Location');
  const locSummCols = [...summCols];
  locSummCols[0] = { label: 'Department / Location', x: ml + 8, w: 155 };
  drawTableHeader(locSummCols);
  const locTotal = _emptyBucket();
  entries.forEach(({ task, report, template }, idx) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    const b = _emptyBucket();
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) { b.na++; return; }
          b.questions++;
          b.possible += _getQuestionMaxScore(q);
          if (reps[q.id]) b.repeats++;
          if (a && a.selectedIndex !== null) {
            b.earned += a.marks || 0;
            if ((a.marks || 0) < _getQuestionMaxScore(q)) b.findings++;
          }
        });
      });
    });
    locTotal.questions += b.questions; locTotal.findings += b.findings; locTotal.repeats += b.repeats;
    locTotal.earned += b.earned; locTotal.possible += b.possible; locTotal.na += b.na;
    const locLabel = task.assignedLocations?.join(', ') || task.department || `Location ${idx + 1}`;
    checkPage(16);
    pdf.setFillColor(226, 232, 240); pdf.rect(ml, y, cw, 16, 'F');
    pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.rect(ml, y, cw, 16);
    _makeSummRow(locLabel.toUpperCase(), b, true, false, 16);
  });
  _drawOverallLine(locTotal);

  const sopAgg: Record<string, AggBucket & { subSops: Record<string, AggBucket> }> = {};
  entries.forEach(({ report, template }) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        const sopName = sec.title || 'Untitled Policy';
        if (!sopAgg[sopName]) sopAgg[sopName] = { ..._emptyBucket(), subSops: {} };
        const agg = sopAgg[sopName];
        sec.questions.forEach(q => {
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) { agg.na++; return; }
          agg.questions++;
          agg.possible += _getQuestionMaxScore(q);
          if (a && a.selectedIndex !== null) {
            agg.earned += a.marks || 0;
            if ((a.marks || 0) < _getQuestionMaxScore(q)) agg.findings++;
          }
          if (reps[q.id]) agg.repeats++;
        });
        (sec.subSections || []).forEach(sub => {
          const subName = sub.title || sub.subCategory || 'Untitled Sub-SOP';
          if (!agg.subSops[subName]) agg.subSops[subName] = _emptyBucket();
          const subAgg = agg.subSops[subName];
          sub.questions.forEach(q => {
            const a = ans[q.id];
            if (_isAnswerNA(q, a)) { agg.na++; subAgg.na++; return; }
            agg.questions++; subAgg.questions++;
            const mx = _getQuestionMaxScore(q);
            agg.possible += mx; subAgg.possible += mx;
            if (a && a.selectedIndex !== null) {
              const mk = a.marks || 0;
              agg.earned += mk; subAgg.earned += mk;
              if (mk < mx) { agg.findings++; subAgg.findings++; }
            }
            if (reps[q.id]) { agg.repeats++; subAgg.repeats++; }
          });
        });
      });
    });
  });

  if (Object.keys(sopAgg).length > 0) {
    drawSectionHeader('Summary by SOP');
    const sopSummCols = [...summCols];
    sopSummCols[0] = { label: 'SOP / Sub-SOP', x: ml + 8, w: 155 };
    drawTableHeader(sopSummCols);
    const sopTotal = _emptyBucket();
    const sopNames = Object.keys(sopAgg).sort((a, b) => a.localeCompare(b));
    sopNames.forEach(sopName => {
      const g = sopAgg[sopName];
      sopTotal.questions += g.questions; sopTotal.findings += g.findings; sopTotal.repeats += g.repeats;
      sopTotal.earned += g.earned; sopTotal.possible += g.possible; sopTotal.na += g.na;
      checkPage(16);
      pdf.setFillColor(226, 232, 240); pdf.rect(ml, y, cw, 16, 'F');
      pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.rect(ml, y, cw, 16);
      _makeSummRow(sopName.toUpperCase(), g, true, false, 16);
      const subNames = Object.keys(g.subSops).sort((a, b) => a.localeCompare(b));
      subNames.forEach((subName, subIdx) => {
        const s = g.subSops[subName];
        checkPage(14);
        _makeSummRow(`  ${subName}`, s, false, subIdx % 2 === 0, 14, [100, 116, 139]);
      });
    });
    _drawOverallLine(sopTotal);
  }

  const categoryGroups: Record<string, AggBucket> = {};
  entries.forEach(({ report, template }) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const cat = q.category || 'Uncategorized';
          if (!categoryGroups[cat]) categoryGroups[cat] = _emptyBucket();
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) { categoryGroups[cat].na++; return; }
          categoryGroups[cat].questions++;
          categoryGroups[cat].possible += _getQuestionMaxScore(q);
          if (reps[q.id]) categoryGroups[cat].repeats++;
          if (a && a.selectedIndex !== null) {
            categoryGroups[cat].earned += a.marks || 0;
            if ((a.marks || 0) < _getQuestionMaxScore(q)) categoryGroups[cat].findings++;
          }
        });
      });
    });
  });

  if (Object.keys(categoryGroups).length > 0) {
    drawSectionHeader('Summary by Category');
    const catSummCols = [...summCols];
    catSummCols[0] = { label: 'Category', x: ml + 8, w: 155 };
    drawTableHeader(catSummCols);
    const catKeys = Object.keys(categoryGroups).sort((a, b) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b));
    const catTotal = _emptyBucket();
    catKeys.forEach((cat, idx) => {
      const g = categoryGroups[cat];
      catTotal.questions += g.questions; catTotal.findings += g.findings; catTotal.repeats += g.repeats;
      catTotal.earned += g.earned; catTotal.possible += g.possible; catTotal.na += g.na;
      checkPage(16);
      _makeSummRow(cat, g, true, idx % 2 === 0, 16);
    });
    _drawOverallLine(catTotal);
  }

  const riskGroups: Record<string, AggBucket> = {};
  entries.forEach(({ report, template }) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const risk = q.risk || 'Untagged';
          if (!riskGroups[risk]) riskGroups[risk] = _emptyBucket();
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) { riskGroups[risk].na++; return; }
          riskGroups[risk].questions++;
          riskGroups[risk].possible += _getQuestionMaxScore(q);
          if (reps[q.id]) riskGroups[risk].repeats++;
          if (a && a.selectedIndex !== null) {
            riskGroups[risk].earned += a.marks || 0;
            if ((a.marks || 0) < _getQuestionMaxScore(q)) riskGroups[risk].findings++;
          }
        });
      });
    });
  });

  if (Object.keys(riskGroups).length > 0) {
    drawSectionHeader('Summary by Risk Level');
    const rlSummCols = [...summCols];
    rlSummCols[0] = { label: 'Risk Level', x: ml + 8, w: 155 };
    drawTableHeader(rlSummCols);
    const riskOrder = ['High', 'Medium', 'Med', 'Low', 'Untagged'];
    const rlTotal = _emptyBucket();
    let rlIdx = 0;
    riskOrder.forEach(risk => {
      const g = riskGroups[risk];
      if (!g) return;
      rlTotal.questions += g.questions; rlTotal.findings += g.findings; rlTotal.repeats += g.repeats;
      rlTotal.earned += g.earned; rlTotal.possible += g.possible; rlTotal.na += g.na;
      checkPage(16);
      _makeSummRow(risk === 'Untagged' ? 'Untagged' : `${risk} Risk`, g, true, rlIdx % 2 === 0, 16);
      rlIdx++;
    });
    _drawOverallLine(rlTotal);
  }

  entries.forEach(({ task, report, template }, entryIdx) => {
    const ans = report.answers || {};
    const appl = report.applicability || {};
    const reps = report.repeats || {};
    const cmts = report.comments || {};
    const locLabel = task.assignedLocations?.join(', ') || task.department || `Location ${entryIdx + 1}`;

    let entryEarned = 0, entryPossible = 0;
    template.pages.forEach(page => {
      page.sections.forEach(sec => {
        if (appl[sec.id] === false) return;
        _allSecQs(sec).forEach(q => {
          const a = ans[q.id];
          if (_isAnswerNA(q, a)) return;
          entryPossible += _getQuestionMaxScore(q);
          if (a && a.selectedIndex !== null) entryEarned += a.marks || 0;
        });
      });
    });
    const entryPct = entryPossible > 0 ? (entryEarned / entryPossible) * 100 : 0;

    checkPage(30);
    pdf.setFillColor(71, 85, 105); pdf.rect(ml, y, cw, 22, 'F');
    pdf.setFontSize(9.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
    pdf.text(locLabel.toUpperCase(), ml + 8, y + 14);
    pdf.text(`${entryEarned}/${entryPossible} pts (${_fmtPct(entryEarned, entryPossible)}%)`, ml + cw - 8, y + 14, { align: 'right' });
    y += 26;

    template.pages.forEach(page => {
      page.sections.forEach(section => {
        const isNA = appl[section.id] === false;
        let secEarned = 0, secPossible = 0;
        if (!isNA) {
          _allSecQs(section).forEach(q => {
            const a = ans[q.id];
            if (_isAnswerNA(q, a)) return;
            secPossible += _getQuestionMaxScore(q);
            if (a && a.selectedIndex !== null) secEarned += a.marks || 0;
          });
        }
        const secPctNum = secPossible > 0 ? (secEarned / secPossible) * 100 : 0;

        checkPage(40);
        const sectionLabel = section.subCategory ? `${section.title || 'Untitled Policy'} › ${section.subCategory}` : `${section.title || 'Untitled Policy'}`;
        drawSectionHeader(sectionLabel, isNA ? undefined : parseFloat(_fmtPct(secEarned, secPossible)), isNA ? undefined : secEarned, isNA ? undefined : secPossible);

        if (isNA) {
          checkPage(20);
          pdf.setFontSize(8); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'italic');
          pdf.text('This policy is marked as Not Applicable', ml + 8, y + 10);
          y += 20;
          return;
        }

        const QC1 = 185, QC_RESP = 60, QC_CAT = 55, QC2 = 110, QC3 = 52, QC4 = cw - 185 - 60 - 55 - 110 - 52;
        const QX1 = ml, QX_RESP = ml + QC1, QX_CAT = QX_RESP + QC_RESP, QX2 = QX_CAT + QC_CAT, QX3 = QX2 + QC2, QX4 = QX3 + QC3;
        const ROW_GAP = 4;
        const LINE_H = 11;
        const CELL_PAD_X = 7, CELL_PAD_TOP = 9;

        const drawQTableHeader = () => {
          checkPage(20);
          pdf.setFillColor(15, 23, 42); pdf.setDrawColor(15, 23, 42); pdf.setLineWidth(0.5);
          pdf.rect(QX1, y, QC1, 20, 'FD');
          pdf.rect(QX_RESP, y, QC_RESP, 20, 'FD');
          pdf.rect(QX_CAT, y, QC_CAT, 20, 'FD');
          pdf.rect(QX2, y, QC2, 20, 'FD');
          pdf.rect(QX3, y, QC3, 20, 'FD');
          pdf.rect(QX4, y, QC4, 20, 'FD');
          pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
          pdf.text('Question', QX1 + CELL_PAD_X, y + 13);
          pdf.text('Responsibility', QX_RESP + CELL_PAD_X, y + 13);
          pdf.text('Category', QX_CAT + CELL_PAD_X, y + 13);
          pdf.text('Observation', QX2 + CELL_PAD_X, y + 13);
          pdf.text('Earned', QX3 + QC3 / 2, y + 13, { align: 'center' });
          pdf.text('Possible', QX4 + QC4 / 2, y + 13, { align: 'center' });
          y += 20;
        };

        const sectionTitle = section.title || 'Untitled Policy';
        const redrawHeadersOnBreak = (needed: number) => {
          if (y + needed > ph - mb) {
            pdf.addPage(); pageNum++; y = mt;
            drawSectionHeader(`${sectionTitle} (cont.)`, isNA ? undefined : parseFloat(_fmtPct(secEarned, secPossible)), isNA ? undefined : secEarned, isNA ? undefined : secPossible);
            drawQTableHeader();
          }
        };

        const _drawQuestionsInPdf = (qs: QuestionNode[]) => {
          if (qs.length === 0) return;
          qs.forEach(q => {
            const a = ans[q.id];
            const qComment = cmts[q.id];
            const selectedResp = a?.selectedIndex !== null && a?.selectedIndex !== undefined ? q.responses[a.selectedIndex] : null;
            const qNA = _isAnswerNA(q, a);
            const earned = qNA ? 0 : (a?.marks || 0);
            const avail = qNA ? 0 : _getQuestionMaxScore(q);

            let obsLabel = '—';
            let obsColor: [number, number, number] = [150, 150, 150];
            const isFullMarks = selectedResp && !qNA && earned >= avail && avail > 0;
            if (selectedResp) {
              obsLabel = selectedResp.text || 'Answered';
              if (qNA) obsColor = [148, 163, 184];
              else if (earned >= avail && avail > 0) obsColor = [22, 163, 74];
              else if (earned > 0 && earned < avail) obsColor = [217, 119, 6];
              else if (earned === 0 && avail > 0) obsColor = [220, 38, 38];
              else obsColor = [30, 41, 59];
            }

            const allEntries = (qComment?.entries || []).map(e => ({
              ...e,
              text: e.text || '',
              images: e.images || [],
              closureEvidence: e.closureEvidence || [],
              closureComments: e.closureComments || '',
              timestamp: e.timestamp || '',
            })).filter(e => e.text?.trim() || (e.images && e.images.length > 0) || e.closureComments?.trim() || (e.closureEvidence && e.closureEvidence.length > 0));

            const boldPart = `(${q.risk} Risk) - `;
            const questionText = q.text || 'Untitled Question';
            const respText = (q.responsibility && q.responsibility.length > 0) ? q.responsibility.join(', ') : '—';
            const catText = q.category || '—';
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold');
            const prefW = pdf.getTextWidth(boldPart);
            const avail1stLine = QC1 - CELL_PAD_X * 2 - prefW;
            const fullLineW = QC1 - CELL_PAD_X * 2;
            pdf.setFont('helvetica', 'normal');
            const line1chunks = avail1stLine > 20 ? pdf.splitTextToSize(questionText, avail1stLine) : [];
            const firstLineQ = line1chunks.length > 0 ? line1chunks[0] : '';
            const remainingText = firstLineQ ? questionText.substring(firstLineQ.length).trim() : questionText;
            const remainingLines = remainingText ? pdf.splitTextToSize(remainingText, fullLineW) : [];
            const qTotalLines = avail1stLine > 20 ? (firstLineQ ? 1 + remainingLines.length : 1) : pdf.splitTextToSize(questionText, fullLineW).length + 1;

            const respLines = pdf.splitTextToSize(respText, QC_RESP - CELL_PAD_X * 2);
            const catLines = pdf.splitTextToSize(catText, QC_CAT - CELL_PAD_X * 2);
            const ansLines = pdf.splitTextToSize(obsLabel, QC2 - CELL_PAD_X * 2);
            const maxLines = Math.max(qTotalLines, ansLines.length, respLines.length, catLines.length);
            const rowH = Math.max(28, maxLines * LINE_H + CELL_PAD_TOP + 8);

            redrawHeadersOnBreak(rowH + ROW_GAP);

            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(20, 24, 35);
            pdf.setLineWidth(1.1);
            pdf.rect(QX1, y, QC1, rowH, 'FD');
            pdf.rect(QX_RESP, y, QC_RESP, rowH, 'FD');
            pdf.rect(QX_CAT, y, QC_CAT, rowH, 'FD');
            pdf.rect(QX2, y, QC2, rowH, 'FD');
            pdf.rect(QX3, y, QC3, rowH, 'FD');
            pdf.rect(QX4, y, QC4, rowH, 'FD');

            const textY = y + CELL_PAD_TOP;
            pdf.setFontSize(7.5); pdf.setTextColor(30, 41, 59);
            pdf.setFont('helvetica', 'bold');
            pdf.text(boldPart, QX1 + CELL_PAD_X, textY);

            pdf.setFont('helvetica', 'normal');
            if (avail1stLine > 20 && firstLineQ) {
              pdf.text(firstLineQ, QX1 + CELL_PAD_X + prefW, textY);
              remainingLines.forEach((l: string, li: number) => {
                pdf.text(l, QX1 + CELL_PAD_X, textY + (li + 1) * LINE_H);
              });
            } else {
              const fallbackLines = pdf.splitTextToSize(questionText, fullLineW);
              fallbackLines.forEach((l: string, li: number) => {
                pdf.text(l, QX1 + CELL_PAD_X, textY + LINE_H + li * LINE_H);
              });
            }

            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(71, 85, 105);
            respLines.forEach((l: string, li: number) => {
              pdf.text(l, QX_RESP + CELL_PAD_X, textY + li * LINE_H);
            });

            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(71, 85, 105);
            catLines.forEach((l: string, li: number) => {
              pdf.text(l, QX_CAT + CELL_PAD_X, textY + li * LINE_H);
            });

            if (reps[q.id]) {
              pdf.setFillColor(225, 29, 72);
              pdf.roundedRect(QX1 + CELL_PAD_X, y + rowH - 13, 32, 9, 1, 1, 'F');
              pdf.setFontSize(5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
              pdf.text('REPEAT', QX1 + CELL_PAD_X + 16, y + rowH - 6, { align: 'center' });
              const repeatEntry = allEntries.find(e => e.isRepeat);
              if (repeatEntry?.repeatOriginalDate) {
                pdf.setFontSize(5); pdf.setTextColor(194, 65, 12); pdf.setFont('helvetica', 'bold');
                pdf.text(`Since ${repeatEntry.repeatOriginalDate}`, QX1 + CELL_PAD_X + 35, y + rowH - 6);
              }
            }

            const numY = y + rowH / 2 + 3;
            const dotR = 3.5;
            const dotX = QX2 + CELL_PAD_X + dotR + 1;
            const dotY = numY - 1;
            pdf.setFillColor(...obsColor);
            pdf.circle(dotX, dotY, dotR, 'F');
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...obsColor);
            if (ansLines.length === 1) {
              pdf.text(ansLines[0], dotX + dotR + 4, numY);
            } else {
              const blockH = (ansLines.length - 1) * LINE_H;
              ansLines.forEach((l: string, li: number) => {
                pdf.text(l, dotX + dotR + 4, numY - blockH / 2 + li * LINE_H);
              });
            }

            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59);
            pdf.text(String(earned), QX3 + QC3 / 2, numY, { align: 'center' });
            pdf.text(String(avail), QX4 + QC4 / 2, numY, { align: 'center' });

            y += rowH + ROW_GAP;

            if (allEntries.length > 0) {
              const colCount = Math.min(allEntries.length, 2);
              const colW = cw / colCount;

              for (let rowStart = 0; rowStart < allEntries.length; rowStart += colCount) {
                const rowEntries = allEntries.slice(rowStart, rowStart + colCount);
                const commentLabel = isFullMarks ? 'Compliance Evidence:' : 'Opportunity for Improvement:';
                const commentLabelColor: [number, number, number] = isFullMarks ? [22, 163, 74] : [217, 119, 6];

                const colHeights: number[] = [];
                const colData = rowEntries.map((entry) => {
                  const textW = colW - 16;
                  const corrNote = (entry.corrections?.length ?? 0) > 0
                    ? `\n[Corrected: ${entry.corrections![entry.corrections!.length - 1].reason}]`
                    : '';
                  const displayText = entry.text?.trim() ? entry.text.trim() + corrNote : (corrNote ? corrNote.trim() : '');
                  const textLines = displayText ? pdf.splitTextToSize(displayText, textW) : [];
                  const closureLines = entry.closureComments?.trim() ? pdf.splitTextToSize(entry.closureComments.trim(), textW) : [];
                  const obsImgs = entry.images || [];
                  const closureImgs = entry.closureEvidence || [];
                  const hasObs = textLines.length > 0 || obsImgs.length > 0;
                  const hasClosure = closureLines.length > 0 || closureImgs.length > 0;

                  const thumbSize = Math.min(70, (colW - 24) / 2);
                  const thumbGap = 6;

                  let h = 18;
                  if (entry.managementTag) h += 12;
                  if (entry.isRepeat) {
                    h += 16;
                    if (entry.repeatTrail && entry.repeatTrail.length > 0) h += 10;
                  }
                  if (hasObs) {
                    h += 12;
                    h += textLines.length * 9;
                    if (obsImgs.length > 0) {
                      const imgRows = Math.ceil(obsImgs.length / 2);
                      h += imgRows * (thumbSize + thumbGap) + 4;
                    }
                  }
                  if (hasClosure) {
                    h += 12;
                    h += closureLines.length * 9;
                    if (closureImgs.length > 0) {
                      const imgRows = Math.ceil(closureImgs.length / 2);
                      h += imgRows * (thumbSize + thumbGap) + 4;
                    }
                  }
                  h += 4;
                  colHeights.push(h);
                  return { entry, textLines, closureLines, obsImgs, closureImgs, hasObs, hasClosure };
                });

                const entryRowH = Math.max(...colHeights);
                checkPage(Math.min(entryRowH, 140));

                y += 3;
                colData.forEach((col, ci) => {
                  const xBase = ml + ci * colW;
                  pdf.setFillColor(250, 251, 253);
                  pdf.setDrawColor(20, 24, 35); pdf.setLineWidth(1.1);
                  pdf.rect(xBase, y, colW, entryRowH, 'FD');

                  let cy = y + 4;
                  pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 116, 139);
                  const tsLabel = col.entry.timestamp ? new Date(col.entry.timestamp).toLocaleString() : '';
                  pdf.text(`#${rowStart + ci + 1}${tsLabel ? ` — ${tsLabel}` : ''}`, xBase + 6, cy + 5);
                  cy += 12;

                  if (col.entry.managementTag) {
                    const tagCfg = col.entry.managementTag === 'management-focus'
                      ? { label: 'MGMT FOCUS', text: [185, 28, 28] as [number, number, number], dot: [225, 29, 72] as [number, number, number] }
                      : col.entry.managementTag === 'easy-impactful'
                      ? { label: 'EASY IMPACT', text: [21, 128, 61] as [number, number, number], dot: [22, 163, 74] as [number, number, number] }
                      : { label: 'ONGOING', text: [29, 78, 216] as [number, number, number], dot: [37, 99, 235] as [number, number, number] };
                    pdf.setFillColor(...tagCfg.dot);
                    pdf.circle(xBase + 10, cy + 3.5, 2.5, 'F');
                    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...tagCfg.text);
                    pdf.text(tagCfg.label, xBase + 15, cy + 5);
                    cy += 12;
                  }

                  if (col.entry.isRepeat) {
                    const repeatBoxW = colW - 12;
                    const trailEntries = col.entry.repeatTrail || [];
                    let rptH = 12;
                    if (trailEntries.length > 0) rptH += 10;
                    pdf.setFillColor(255, 237, 213);
                    pdf.setDrawColor(251, 146, 60);
                    pdf.setLineWidth(0.5);
                    pdf.roundedRect(xBase + 6, cy, repeatBoxW, rptH, 1, 1, 'FD');
                    pdf.setFillColor(225, 29, 72);
                    pdf.roundedRect(xBase + 8, cy + 2, 30, 8, 1, 1, 'F');
                    pdf.setFontSize(5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
                    pdf.text('REPEAT', xBase + 23, cy + 7.5, { align: 'center' });
                    if (col.entry.repeatOriginalDate) {
                      pdf.setFontSize(5.5); pdf.setTextColor(194, 65, 12); pdf.setFont('helvetica', 'bold');
                      pdf.text(`Since ${col.entry.repeatOriginalDate}`, xBase + 42, cy + 7.5);
                    }
                    if (trailEntries.length > 0) {
                      pdf.setFontSize(5); pdf.setTextColor(154, 52, 18); pdf.setFont('helvetica', 'normal');
                      const trailText = trailEntries.map((t: any) => t.date).join(' \u2192 ');
                      const trailLines = pdf.splitTextToSize(`Trail: ${trailText}`, repeatBoxW - 8);
                      trailLines.forEach((line: string, li: number) => {
                        pdf.text(line, xBase + 8, cy + 17 + li * 7);
                      });
                    }
                    cy += rptH + 4;
                  }

                  const tSz = Math.min(70, (colW - 24) / 2);
                  const tGap = 6;

                  if (col.hasObs) {
                    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...commentLabelColor);
                    pdf.text(commentLabel, xBase + 6, cy + 4);
                    cy += 10;
                    if (col.textLines.length > 0) {
                      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
                      col.textLines.forEach((line: string) => {
                        pdf.text(line, xBase + 6, cy + 3);
                        cy += 9;
                      });
                    }
                    if (col.obsImgs.length > 0) {
                      cy += 2;
                      col.obsImgs.forEach((img: string, imgIdx: number) => {
                        const imgCol = imgIdx % 2;
                        if (imgCol === 0 && imgIdx > 0) cy += tSz + tGap;
                        const imgX = xBase + 6 + imgCol * (tSz + tGap);
                        try { pdf.addImage(img, 'JPEG', imgX, cy, tSz, tSz); } catch { }
                      });
                      cy += tSz + 4;
                    }
                  }
                  if (col.hasClosure) {
                    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(22, 163, 74);
                    pdf.text('Closure:', xBase + 6, cy + 4);
                    cy += 10;
                    if (col.closureLines.length > 0) {
                      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
                      col.closureLines.forEach((line: string) => {
                        pdf.text(line, xBase + 6, cy + 3);
                        cy += 9;
                      });
                    }
                    if (col.closureImgs.length > 0) {
                      cy += 2;
                      col.closureImgs.forEach((img: string, imgIdx: number) => {
                        const imgCol = imgIdx % 2;
                        if (imgCol === 0 && imgIdx > 0) cy += tSz + tGap;
                        const imgX = xBase + 6 + imgCol * (tSz + tGap);
                        try { pdf.addImage(img, 'JPEG', imgX, cy, tSz, tSz); } catch { }
                      });
                      cy += tSz + 4;
                    }
                  }
                });

                y += entryRowH + 4;
              }
            }
          });
        };

        if (section.questions.length > 0) {
          drawQTableHeader();
          _drawQuestionsInPdf(section.questions);
        }

        (section.subSections || []).forEach(subSec => {
          checkPage(20);
          pdf.setFillColor(139, 92, 246); pdf.rect(ml + 8, y, cw - 16, 16, 'F');
          pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
          pdf.text(`Sub-Category: ${subSec.title || 'Untitled'}${subSec.subCategory ? ` › ${subSec.subCategory}` : ''}`, ml + 16, y + 11);
          const subScore = { obtained: 0, max: 0 };
          subSec.questions.forEach(sq => {
            const sa = ans[sq.id]; const sqNA = _isAnswerNA(sq, sa);
            if (!sqNA) { subScore.max += _getQuestionMaxScore(sq); if (sa?.selectedIndex !== null) subScore.obtained += sa?.marks || 0; }
          });
          if (subScore.max > 0) {
            pdf.text(`${subScore.obtained}/${subScore.max} pts (${_fmtPct(subScore.obtained, subScore.max)}%)`, ml + cw - 16, y + 11, { align: 'right' });
          }
          y += 20;
          drawQTableHeader();
          _drawQuestionsInPdf(subSec.questions);
        });

        y += 6;
      });
    });
  });

  const totalPagesCount = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPagesCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'normal');
    pdf.text(`${i}/${totalPagesCount}`, pw / 2, ph - 20, { align: 'center' });
    pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
    pdf.line(ml, ph - 30, pw - mr, ph - 30);
    if (groupInfo.isDraft) {
      pdf.saveGraphicsState();
      const gState = new (pdf as any).GState({ opacity: 0.06 });
      pdf.setGState(gState);
      pdf.setFontSize(72); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold');
      pdf.text('DRAFT', pw / 2, ph / 2, { align: 'center', angle: 45 });
      pdf.restoreGraphicsState();
    }
  }

  const draftLabel = groupInfo.isDraft ? 'Draft' : 'Final';
  const safeName = groupInfo.checklistName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const fileName = `${safeName}_${draftLabel}_Consolidated_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  savePdfForPWA(pdf, fileName);
}
