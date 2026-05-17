"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Check, AlertTriangle, ChevronDown, ChevronRight, Image as ImageIcon, HelpCircle, Zap } from 'lucide-react';
import type { ChecklistTemplate, PageNode, SectionNode, QuestionNode, ResponseOption } from './AuditChecklistCreator';

interface AnswerState {
  [questionId: string]: { selectedIndex: number | null; marks: number | null; };
}

interface CommentEntry {
  id: string;
  text: string;
  images: string[];
  closureEvidence: string[];
  closureComments: string;
  timestamp: string;
  createdAtMs?: number;
  location?: string;
  isDraft?: boolean;
  savedToDb?: boolean;
}

interface CommentState {
  [questionId: string]: { entries: CommentEntry[] };
}

interface ParsedRow {
  question: string;
  department: string;
  location: string;
  marksDeducted: number;
  hasExplicitMarks: boolean;
  images: string[];
  observation: string;
  matchedQuestionId: string | null;
  matchedQuestionText: string | null;
  matchedPageTitle: string | null;
  matchedSectionTitle: string | null;
  matchScore: number;
  status: 'matched' | 'unmatched';
  autoMarked: boolean;
}

interface ExcelAuditImporterProps {
  template: ChecklistTemplate;
  onImport: (answers: AnswerState, comments: CommentState, matchSummary: { matched: number; unmatched: number; noDeduction: number }) => void;
  onClose: () => void;
  existingAnswers?: AnswerState;
  existingComments?: CommentState;
}

function normalizeText(t: string): string {
  return (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarityScore(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;

  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  let matchCount = 0;
  for (const wa of wordsA) {
    if (wa.length < 3) continue;
    if (wordsB.some(wb => wb === wa || wb.includes(wa) || wa.includes(wb))) matchCount++;
  }
  const relevantWordsA = wordsA.filter(w => w.length >= 3).length;
  if (relevantWordsA === 0) return 0;
  const score = matchCount / Math.max(relevantWordsA, wordsB.filter(w => w.length >= 3).length);

  if (nb.includes(na) || na.includes(nb)) return Math.max(score, 0.85);
  return score;
}

function getAllQuestions(template: ChecklistTemplate): Array<{ question: QuestionNode; page: PageNode; section: SectionNode }> {
  const result: Array<{ question: QuestionNode; page: PageNode; section: SectionNode }> = [];
  template.pages.forEach(page => {
    page.sections.forEach(section => {
      section.questions.forEach(q => result.push({ question: q, page, section }));
      (section.subSections || []).forEach(ss => {
        ss.questions.forEach(q => result.push({ question: q, page, section }));
      });
    });
  });
  return result;
}

function getQuestionMaxScore(q: QuestionNode): number {
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

function findBestResponseIndex(q: QuestionNode, marksDeducted: number): { index: number; marks: number } | null {
  const maxScore = getQuestionMaxScore(q);
  const targetScore = Math.max(0, maxScore - marksDeducted);

  let bestIdx = -1;
  let bestDiff = Infinity;
  let bestMarks = 0;

  q.responses.forEach((r, idx) => {
    const isNA = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
    if (isNA) return;
    const score = parseFloat(r.score) || 0;
    const diff = Math.abs(score - targetScore);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
      bestMarks = score;
    }
  });

  if (bestIdx >= 0) return { index: bestIdx, marks: bestMarks };

  const failIdx = q.responses.findIndex(r => {
    const t = r.text.toLowerCase();
    return t === 'no' || t === 'fail' || t === 'non-compliant' || t === 'nc';
  });
  if (failIdx >= 0) return { index: failIdx, marks: parseFloat(q.responses[failIdx].score) || 0 };

  const zeroIdx = q.responses.findIndex(r => (parseFloat(r.score) || 0) === 0 && r.score !== '/');
  if (zeroIdx >= 0) return { index: zeroIdx, marks: 0 };

  return null;
}

async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('No worksheet found');

  const imageMap = new Map<string, string[]>();
  const wsImages = (ws as any).getImages?.() || [];
  for (const img of wsImages) {
    try {
      const imageId = img.imageId;
      const wbImage = wb.getImage(parseInt(imageId));
      if (wbImage && wbImage.buffer) {
        const ext = wbImage.extension || 'png';
        let base64: string;
        if (typeof Buffer !== 'undefined') {
          base64 = Buffer.from(wbImage.buffer as ArrayBuffer).toString('base64');
        } else {
          const bytes = new Uint8Array(wbImage.buffer as ArrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          base64 = btoa(binary);
        }
        const dataUrl = `data:image/${ext};base64,${base64}`;

        const range = img.range;
        let row: number;
        if (range && typeof range.tl === 'object' && range.tl.nativeRow !== undefined) {
          row = range.tl.nativeRow + 1;
        } else if (range && typeof range.tl === 'object' && range.tl.row !== undefined) {
          row = Math.floor(range.tl.row) + 1;
        } else {
          continue;
        }
        const key = `row-${row}`;
        if (!imageMap.has(key)) imageMap.set(key, []);
        imageMap.get(key)!.push(dataUrl);
      }
    } catch {}
  }

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = normalizeText(String(cell.value || ''));
  });

  const findCol = (keywords: string[]): number => {
    for (const kw of keywords) {
      const idx = headers.findIndex(h => h.includes(kw));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const questionCol = findCol(['question', 'observation', 'finding', 'description', 'checklist item', 'item']);
  const deptCol = findCol(['department', 'dept', 'area']);
  const locationCol = findCol(['location', 'loc', 'zone', 'room', 'sub location']);
  const marksCol = findCol(['marks deducted', 'deducted', 'deduction', 'marks', 'penalty', 'score deducted']);
  const obsCol = findCol(['comment', 'remark', 'note', 'observation text', 'auditor comment', 'observation']);
  const imageCol = findCol(['image', 'photo', 'evidence', 'picture', 'attachment']);

  if (questionCol < 0) throw new Error('Could not find a "Question" column in the Excel file. Please ensure your header row contains "Question", "Observation", "Finding", or "Description".');

  const rows: ParsedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const getCellText = (colIdx: number): string => {
      if (colIdx < 0) return '';
      const cell = row.getCell(colIdx + 1);
      return String(cell.value || '').trim();
    };

    const question = getCellText(questionCol);
    if (!question) return;

    const department = getCellText(deptCol);
    const location = getCellText(locationCol);
    const marksRaw = getCellText(marksCol);
    const marksDeducted = parseFloat(marksRaw) || 0;
    const hasExplicitMarks = marksCol >= 0 && marksRaw.trim() !== '' && !isNaN(parseFloat(marksRaw));
    const observation = getCellText(obsCol);

    let images: string[] = [];
    const rowImages = imageMap.get(`row-${rowNumber}`);
    if (rowImages) images = rowImages;

    if (imageCol >= 0 && images.length === 0) {
      const imgVal = getCellText(imageCol);
      if (imgVal && imgVal.startsWith('data:image')) {
        images.push(imgVal);
      }
    }

    rows.push({
      question,
      department,
      location,
      marksDeducted,
      hasExplicitMarks,
      images,
      observation,
      matchedQuestionId: null,
      matchedQuestionText: null,
      matchedPageTitle: null,
      matchedSectionTitle: null,
      matchScore: 0,
      status: 'matched',
      autoMarked: false,
    });
  });

  return rows;
}

function deptMatch(rowDept: string, pageTitle: string, sectionTitle: string): boolean {
  if (!rowDept) return false;
  const nd = normalizeText(rowDept);
  return normalizeText(pageTitle).includes(nd) || normalizeText(sectionTitle).includes(nd);
}

function matchRowsToQuestions(rows: ParsedRow[], template: ChecklistTemplate): ParsedRow[] {
  const allQuestions = getAllQuestions(template);

  return rows.map(row => {
    let bestMatch: { question: QuestionNode; page: PageNode; section: SectionNode } | null = null;
    let bestScore = 0;
    let bestHasDept = false;

    for (const { question, page, section } of allQuestions) {
      const textScore = similarityScore(row.question, question.text);
      const hasDept = deptMatch(row.department, page.title, section.title);

      if (textScore < 0.35) continue;

      if (hasDept && !bestHasDept) {
        bestMatch = { question, page, section };
        bestScore = textScore;
        bestHasDept = true;
      } else if (hasDept === bestHasDept && textScore > bestScore) {
        bestMatch = { question, page, section };
        bestScore = textScore;
        bestHasDept = hasDept;
      }
    }

    const MATCH_THRESHOLD = 0.35;
    if (bestMatch && bestScore >= MATCH_THRESHOLD) {
      const maxScore = getQuestionMaxScore(bestMatch.question);
      const effectiveDeduction = row.hasExplicitMarks ? row.marksDeducted : maxScore;
      const autoMarked = !row.hasExplicitMarks || row.marksDeducted === 0;
      return {
        ...row,
        matchedQuestionId: bestMatch.question.id,
        matchedQuestionText: bestMatch.question.text,
        matchedPageTitle: bestMatch.page.title,
        matchedSectionTitle: bestMatch.section.title,
        matchScore: bestScore,
        status: 'matched' as const,
        marksDeducted: effectiveDeduction,
        autoMarked,
      };
    }

    return {
      ...row,
      status: 'unmatched' as const,
      matchScore: bestScore,
    };
  });
}

export default function ExcelAuditImporter({ template, onImport, onClose, existingAnswers, existingComments }: ExcelAuditImporterProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParsing(true);
    setError('');

    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        setError('No data rows found in the Excel file.');
        setParsing(false);
        return;
      }
      const matched = matchRowsToQuestions(rows, template);
      setParsedRows(matched);
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to parse Excel file');
    } finally {
      setParsing(false);
    }
  }, [template]);

  const handleImport = useCallback(() => {
    const newAnswers: AnswerState = { ...(existingAnswers || {}) };
    const newComments: CommentState = { ...(existingComments || {}) };
    let matched = 0;
    let unmatched = 0;

    const allQ = getAllQuestions(template);

    for (const row of parsedRows) {
      if (row.status === 'unmatched' || !row.matchedQuestionId) {
        unmatched++;
        continue;
      }

      const qInfo = allQ.find(q => q.question.id === row.matchedQuestionId);
      if (!qInfo) { unmatched++; continue; }

      const effectiveDeduction = row.hasExplicitMarks && row.marksDeducted > 0
        ? row.marksDeducted
        : getQuestionMaxScore(qInfo.question);

      const resp = findBestResponseIndex(qInfo.question, effectiveDeduction);
      if (!resp) { unmatched++; continue; }

      const existing = newAnswers[row.matchedQuestionId];
      if (!existing || existing.selectedIndex === null || existing.selectedIndex === undefined) {
        newAnswers[row.matchedQuestionId] = { selectedIndex: resp.index, marks: resp.marks };
      }
      matched++;

      const effectiveLocation = row.location || row.matchedPageTitle || '';
      const obsText = row.observation || (row.autoMarked ? 'Non-compliant finding' : `Marks deducted: ${row.marksDeducted}`);

      if (obsText || row.images.length > 0) {
        const existingEntries = newComments[row.matchedQuestionId]?.entries || [];
        const entry: CommentEntry = {
          id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: obsText,
          images: row.images,
          closureEvidence: [],
          closureComments: '',
          timestamp: new Date().toISOString(),
          createdAtMs: Date.now(),
          location: effectiveLocation,
          isDraft: false,
          savedToDb: true,
        };
        newComments[row.matchedQuestionId] = {
          entries: [...existingEntries, entry],
        };
      }
    }

    onImport(newAnswers, newComments, { matched, unmatched, noDeduction: 0 });
    setStep('done');
  }, [parsedRows, template, existingAnswers, existingComments, onImport]);

  const matchedCount = parsedRows.filter(r => r.status === 'matched').length;
  const autoMarkedCount = parsedRows.filter(r => r.status === 'matched' && r.autoMarked).length;
  const unmatchedCount = parsedRows.filter(r => r.status === 'unmatched').length;
  const withImages = parsedRows.filter(r => r.images.length > 0).length;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current) {
        fileRef.current.files = dt.files;
        fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="flex items-center gap-3 text-white">
            <FileSpreadsheet className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Import Audit Data from Excel</h2>
              <p className="text-xs text-white/70">Auto-fill answers from Excel with observations & images</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center hover:border-indigo-500 hover:bg-indigo-50/50 transition-all cursor-pointer"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <Upload className="w-12 h-12 mx-auto text-indigo-400 mb-3" />
                <p className="text-lg font-semibold text-slate-700">
                  {parsing ? 'Parsing Excel file...' : 'Drop Excel file here or click to browse'}
                </p>
                <p className="text-sm text-slate-500 mt-1">Supports .xlsx and .xls files</p>
                {fileName && <p className="text-sm text-indigo-600 mt-2 font-medium">{fileName}</p>}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium text-sm">Import Error</p>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" /> Expected Excel Format
                </h3>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>Your Excel file should have a header row with these columns:</p>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Question</strong> <span className="text-red-500">*</span> — checklist question text</div>
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Observation</strong> — auditor finding or comment</div>
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Location</strong> — zone/room <span className="text-slate-400">(auto-resolved if blank)</span></div>
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Department</strong> — helps match the right question</div>
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Marks Deducted</strong> — <span className="text-slate-400">optional, full deduction if blank</span></div>
                    <div className="bg-white px-3 py-1.5 rounded border text-xs"><strong>Image</strong> — embedded images in cells</div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                    <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>Matched questions are auto-marked <strong>non-compliant</strong> with full marks deducted. Location is auto-resolved from the department if not provided.</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownloadSample()}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" /> Download Sample Excel
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{matchedCount}</p>
                  <p className="text-xs text-emerald-600">Matched</p>
                </div>
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-violet-700">{autoMarkedCount}</p>
                  <p className="text-xs text-violet-600">Auto-Marked</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{unmatchedCount}</p>
                  <p className="text-xs text-red-600">Unmatched</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{withImages}</p>
                  <p className="text-xs text-blue-600">With Images</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 mb-2 flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                <span>Existing answers are preserved. Matched questions are auto-marked non-compliant with full deduction. Observations & images are always appended.</span>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {parsedRows.map((row, idx) => {
                  const hasExistingAnswer = row.matchedQuestionId && existingAnswers?.[row.matchedQuestionId]?.selectedIndex !== null && existingAnswers?.[row.matchedQuestionId]?.selectedIndex !== undefined;
                  return (
                  <div
                    key={idx}
                    className={`border rounded-lg overflow-hidden ${
                      row.status === 'matched' ? 'border-emerald-200 bg-emerald-50/30' :
                      'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/50"
                      onClick={() => setExpandedRows(prev => {
                        const next = new Set(prev);
                        next.has(idx) ? next.delete(idx) : next.add(idx);
                        return next;
                      })}
                    >
                      {expandedRows.has(idx) ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        row.status === 'matched' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{row.question}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {row.matchedPageTitle && (
                            <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]" title={`Dept: ${row.matchedPageTitle}`}>
                              {row.matchedPageTitle}
                            </span>
                          )}
                          {row.matchedSectionTitle && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={`Section: ${row.matchedSectionTitle}`}>
                              {row.matchedSectionTitle}
                            </span>
                          )}
                          {(row.location || row.matchedPageTitle) && (
                            <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={`Location: ${row.location || row.matchedPageTitle}`}>
                              {row.location || row.matchedPageTitle}
                            </span>
                          )}
                        </div>
                      </div>
                      {row.status === 'matched' && row.autoMarked && (
                        <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" /> Auto
                        </span>
                      )}
                      {row.status === 'matched' && !row.autoMarked && row.marksDeducted > 0 && (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0">-{row.marksDeducted}</span>
                      )}
                      {row.images.length > 0 && (
                        <span className="text-xs text-blue-600 flex-shrink-0"><ImageIcon className="w-3.5 h-3.5" /></span>
                      )}
                      {hasExistingAnswer && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 flex-shrink-0">Answered</span>
                      )}
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        row.status === 'matched' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.status === 'matched' ? `${Math.round(row.matchScore * 100)}% match` : 'No match'}
                      </span>
                    </div>
                    {expandedRows.has(idx) && (
                      <div className="px-4 pb-3 border-t border-slate-100 space-y-2 text-xs">
                        {row.matchedQuestionText && (
                          <div>
                            <span className="text-slate-500">Matched to:</span>
                            <span className="text-slate-700 ml-1">{row.matchedQuestionText}</span>
                          </div>
                        )}
                        {row.matchedPageTitle && (
                          <div>
                            <span className="text-slate-500">Page:</span>
                            <span className="text-slate-700 ml-1">{row.matchedPageTitle}</span>
                          </div>
                        )}
                        {row.department && (
                          <div>
                            <span className="text-slate-500">Department:</span>
                            <span className="text-slate-700 ml-1">{row.department}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Location:</span>
                          <span className="text-slate-700 ml-1">{row.location || row.matchedPageTitle || '—'}</span>
                          {!row.location && row.matchedPageTitle && <span className="text-violet-500 ml-1">(auto-resolved)</span>}
                        </div>
                        {row.status === 'matched' && (
                          <div>
                            <span className="text-slate-500">Deduction:</span>
                            <span className="text-slate-700 ml-1">
                              {row.autoMarked ? 'Full marks (auto)' : `${row.marksDeducted} marks`}
                            </span>
                          </div>
                        )}
                        {row.observation && (
                          <div>
                            <span className="text-slate-500">Observation:</span>
                            <span className="text-slate-700 ml-1">{row.observation}</span>
                          </div>
                        )}
                        {row.images.length > 0 && (
                          <div className="flex gap-2 mt-1">
                            {row.images.map((img, i) => (
                              <img key={i} src={img} alt="" className="w-16 h-16 object-cover rounded border" />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Import Complete!</h3>
              <p className="text-slate-600">
                {matchedCount} question{matchedCount !== 1 ? 's' : ''} auto-filled with answers.
                {unmatchedCount > 0 && ` ${unmatchedCount} could not be matched.`}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          {step === 'review' && (
            <>
              <button onClick={() => { setStep('upload'); setParsedRows([]); setFileName(''); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={matchedCount === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" /> Import {matchedCount} Answers
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors">
              Close
            </button>
          )}
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

async function handleDownloadSample() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Audit Data');

  ws.columns = [
    { header: 'Question', key: 'question', width: 52 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Location', key: 'location', width: 20 },
    { header: 'Observation', key: 'observation', width: 40 },
    { header: 'Image', key: 'image', width: 15 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

  ws.addRow({
    question: 'Is the hand washing station properly maintained?',
    department: 'Kitchen',
    location: 'Main Kitchen',
    observation: 'Soap dispenser empty, no paper towels available',
  });
  ws.addRow({
    question: 'Are food storage temperatures within safe range?',
    department: 'Storage',
    location: 'Cold Room 1',
    observation: 'Refrigerator temperature found at 12°C, above safe limit',
  });
  ws.addRow({
    question: 'Is pest control documentation up to date?',
    department: 'Admin',
    location: '',
    observation: 'Last inspection record missing for February',
  });
  ws.addRow({
    question: 'Are chilled food items covered and FIFO followed?',
    department: 'Food Production',
    location: 'Dawat',
    observation: 'Lemon not covered in the chiller',
  });

  const noteRow = ws.addRow(['NOTE: "Question" column is required. Location is auto-resolved from Department if left blank. Questions are auto-marked non-compliant on import.', '', '', '', '']);
  ws.mergeCells(`A${noteRow.number}:E${noteRow.number}`);
  noteRow.font = { italic: true, color: { argb: 'FF6366F1' }, size: 9 };
  noteRow.getCell('A').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit_import_sample.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
