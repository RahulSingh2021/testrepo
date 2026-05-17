"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  FileText,
  Search,
  MapPin,
  Building2,
  Users,
  ClipboardList,
  Calendar,
  PenTool,
  Send,
  RotateCcw,
  Layers,
  Award,
  MessageSquare,
  X,
  AlertTriangle,
  Download,
  Eraser,
  ChevronDown
} from 'lucide-react';
import { HierarchyScope, Entity, AuditTask, AuditTaskStatus } from '../types';
import type { ChecklistTemplate } from './AuditChecklistCreator';
import { generateConsolidatedPdf } from '@/utils/consolidatedPdf';
import AuditChecklistPreview, { hasDraftInStorage, getDraftInfo, AuditCloseResult, loadReportFromStorage, loadReportFromDb, saveReportToStorage } from './AuditChecklistPreview';
import { compressSignature } from '@/utils/imageCompression';

interface ConsolidatedGroup {
  groupId: string;
  checklistName: string;
  unitName: string;
  tasks: AuditTask[];
  totalLocations: number;
  completedLocations: number;
  allComplete: boolean;
  overallScore: number;
  overallObtained: number;
  overallMax: number;
  dueTasks: AuditTask[];
  scheduledDate: string;
  auditStartDate: string;
  auditEndDate: string;
}

interface ReviewAuditsProps {
  currentScope: HierarchyScope;
  userRootId: string;
  userName: string;
  entities: Entity[];
  tasks: AuditTask[];
  checklistTemplates?: ChecklistTemplate[];
  onTaskUpdate: (task: AuditTask) => void;
}

const buildTemplateFromTask = (task: AuditTask): ChecklistTemplate => {
  const questions = task.questions.map(q => ({
    id: q.id,
    text: q.text,
    responseType: 'yes-no-na',
    responses: [
      { text: 'Yes', color: '#22c55e', isFlagged: false, score: '10' },
      { text: 'No', color: '#ef4444', isFlagged: true, score: '0' },
      { text: 'N/A', color: '#94a3b8', isFlagged: false, score: '0' },
    ],
    risk: 'Medium' as const,
    category: '',
    requirement: q.clause || '',
    isRequired: true,
    isMultipleSelection: false,
    isFlagged: false,
    flaggedValue: '',
    maxScore: 10,
    logicRules: [],
  }));
  return {
    id: task.checklistId,
    title: task.checklistName,
    description: '',
    pages: [{
      id: 'p1',
      title: task.department || 'General',
      sections: [{
        id: 's1',
        title: 'Questions',
        isApplicable: true,
        risk: 'Medium' as any,
        category: 'General',
        questions,
      }],
    }],
    settings: { scoringMethod: 'weighted', passingScore: 80, requireSignature: true, requirePhoto: false, allowNotes: true },
    createdAt: task.createdAt || new Date().toISOString(),
    createdByScope: 'super-admin' as any,
    createdByEntityId: '',
    unitId: task.unitId,
  };
};

const ReviewAudits: React.FC<ReviewAuditsProps> = ({
  currentScope,
  userRootId,
  userName,
  entities,
  tasks,
  checklistTemplates = [],
  onTaskUpdate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [previewTemplate, setPreviewTemplate] = useState<ChecklistTemplate | null>(null);
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [autoDownload, setAutoDownload] = useState(false);
  const [sendBackModal, setSendBackModal] = useState<string | null>(null);
  const [sendBackNotes, setSendBackNotes] = useState('');
  const [releaseModal, setReleaseModal] = useState<AuditTask | null>(null);
  const [releaseSignature, setReleaseSignature] = useState('');
  const [releaseReviewerName, setReleaseReviewerName] = useState('');
  const releaseSigCanvasRef = useRef<HTMLCanvasElement>(null);

  const myReviewTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.reviewerName) return false;
      const isMyReview = t.reviewerName === userName;
      const isReviewable = t.status === 'Under Review' || t.status === 'Released';
      const matchesSearch = !searchTerm ||
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.checklistName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.auditorName.toLowerCase().includes(searchTerm.toLowerCase());
      return isMyReview && isReviewable && matchesSearch;
    });
  }, [tasks, userName, searchTerm]);

  const pendingReview = myReviewTasks.filter(t => t.status === 'Under Review');
  const releasedReports = myReviewTasks.filter(t => t.status === 'Released');

  const reviewGroupedData = useMemo(() => {
    const groupMap = new Map<string, AuditTask[]>();
    const ungrouped: AuditTask[] = [];
    myReviewTasks.forEach(t => {
      if (t.groupId) {
        const arr = groupMap.get(t.groupId) || [];
        arr.push(t);
        groupMap.set(t.groupId, arr);
      } else {
        ungrouped.push(t);
      }
    });
    const reviewGroupIds = new Set<string>();
    myReviewTasks.forEach(t => { if (t.groupId) reviewGroupIds.add(t.groupId); });
    const allGroupTasks = new Map<string, AuditTask[]>();
    reviewGroupIds.forEach(gid => {
      const allInGroup = tasks.filter(t => t.groupId === gid);
      allGroupTasks.set(gid, allInGroup);
    });
    const groups: ConsolidatedGroup[] = [];
    const soloFromGroups: AuditTask[] = [];
    groupMap.forEach((reviewTasks, gid) => {
      if (reviewTasks.length <= 1) {
        soloFromGroups.push(...reviewTasks);
        return;
      }
      const fullGroupTasks = allGroupTasks.get(gid) || reviewTasks;
      const finishedTasks = reviewTasks.filter(t => t.status === 'Released' || t.status === 'Under Review');
      const releasedTasks = reviewTasks.filter(t => t.status === 'Released');
      const totalLocations = fullGroupTasks.reduce((sum, t) => sum + (t.assignedLocations?.length || 1), 0);
      const completedLocations = releasedTasks.reduce((sum, t) => sum + (t.assignedLocations?.length || 1), 0);
      const overallObtained = finishedTasks.reduce((sum, t) => sum + (t.scoreObtained || 0), 0);
      const overallMax = finishedTasks.reduce((sum, t) => sum + (t.scoreMax || 0), 0);
      const overallScore = overallMax > 0 ? Math.round((overallObtained / overallMax) * 100) : 0;
      const dueTasks = fullGroupTasks.filter(t =>
        t.status !== 'Completed' && t.status !== 'Under Review' && t.status !== 'Released'
      );
      groups.push({
        groupId: gid,
        checklistName: reviewTasks[0].checklistName,
        unitName: reviewTasks[0].unitName,
        tasks: reviewTasks,
        totalLocations,
        completedLocations,
        allComplete: releasedTasks.length === reviewTasks.length,
        overallScore,
        overallObtained,
        overallMax,
        dueTasks,
        scheduledDate: fullGroupTasks.map(t => t.scheduledDate).filter(Boolean).sort()[0] || '',
        auditStartDate: (fullGroupTasks.map(t => t.startTime).filter(Boolean) as string[]).sort()[0] || '',
        auditEndDate: (fullGroupTasks.filter(t => t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released').map(t => t.endTime).filter(Boolean) as string[]).sort().reverse()[0] || '',
      });
    });
    groups.sort((a, b) => (a.allComplete ? 1 : 0) - (b.allComplete ? 1 : 0));
    const ungroupedPending = [...ungrouped, ...soloFromGroups].filter(t => t.status === 'Under Review');
    const ungroupedReleased = [...ungrouped, ...soloFromGroups].filter(t => t.status === 'Released');
    return { groups, ungroupedPending, ungroupedReleased };
  }, [myReviewTasks, tasks]);

  const getFilteredTemplate = (task: AuditTask): ChecklistTemplate | null => {
    const matchedTemplate = checklistTemplates.find(t => t.title === task.checklistName || t.id === task.checklistId);
    if (matchedTemplate) {
      if (task.assignedLocations && task.assignedLocations.length > 0) {
        const filteredPages = matchedTemplate.pages.filter(page =>
          task.assignedLocations!.some(loc => {
            const pageName = page.title;
            return loc === pageName || loc.startsWith(`${pageName} › `) || pageName.startsWith(`${loc} › `);
          })
        );
        if (filteredPages.length > 0) {
          return { ...matchedTemplate, pages: filteredPages };
        }
      }
      return matchedTemplate;
    }
    return buildTemplateFromTask(task);
  };

  const getFilteredTemplateForConsolidated = (task: AuditTask): ChecklistTemplate => {
    let template = checklistTemplates.find(c => c.id === task.checklistId || c.title === task.checklistName)
      || buildTemplateFromTask(task);
    if (task.assignedLocations && task.assignedLocations.length > 0) {
      const deptSet = new Set<string>();
      const locationLabels: string[] = [];
      task.assignedLocations.forEach(loc => {
        if (loc.includes(' › ')) {
          deptSet.add(loc.split(' › ')[0]);
          locationLabels.push(loc.split(' › ')[1]);
        } else {
          deptSet.add(loc);
          locationLabels.push(loc);
        }
      });
      const filteredPages = template.pages.filter(page => {
        const pTitle = (page.title || '').toLowerCase();
        return deptSet.has(page.title || '') || locationLabels.some(l => l.toLowerCase() === pTitle) ||
          task.assignedLocations!.some(loc => loc.toLowerCase() === pTitle || loc.startsWith(`${page.title} › `) || (page.title || '').startsWith(`${loc} › `));
      });
      if (filteredPages.length > 0) return { ...template, pages: filteredPages };
    }
    return template;
  };


  const openReviewAudit = (task: AuditTask) => {
    const template = getFilteredTemplate(task);
    if (template) {
      setReviewingTaskId(task.id);
      setPreviewTemplate(template);
      setAutoDownload(false);
    }
  };

  const downloadReport = (task: AuditTask) => {
    const template = getFilteredTemplate(task);
    if (template) {
      setReviewingTaskId(task.id);
      setPreviewTemplate(template);
      setAutoDownload(true);
    }
  };

  const handleDownloadConsolidatedPdf = async (group: ConsolidatedGroup, isPartial: boolean) => {
    const finishedStatuses: AuditTaskStatus[] = ['Released', 'Under Review'];
    const finishedTasks = group.tasks.filter(t => finishedStatuses.includes(t.status));
    if (finishedTasks.length === 0) {
      alert('No completed reports found. Reports are stored in your browser — if you cleared browser data, they may be lost.');
      return;
    }
    const entries: { task: AuditTask; report: any; template: ChecklistTemplate }[] = [];
    const missing: string[] = [];
    for (const task of finishedTasks) {
      let report = loadReportFromStorage(task.id);
      if (!report) report = await loadReportFromDb(task.id);
      if (!report) { missing.push(task.assignedLocations?.join(', ') || task.department || task.id); continue; }
      const template = getFilteredTemplateForConsolidated(task);
      entries.push({ task, report, template });
    }
    if (entries.length === 0) {
      alert(`No report data found for ${missing.length} location(s). Please ensure audit reports have been submitted.`);
      return;
    }
    if (missing.length > 0) {
      alert(`${missing.length} location(s) have no saved report data and will be skipped: ${missing.join(', ')}`);
    }
    const isDraft = !group.allComplete || isPartial;
    const auditorNames = [...new Set(finishedTasks.map(t => t.auditorName).filter(Boolean))];
    const dates = finishedTasks.map(t => t.scheduledDate).filter(Boolean).sort();
    await generateConsolidatedPdf(entries, {
      checklistName: group.checklistName,
      unitName: group.unitName,
      isDraft,
      auditorNames,
      auditDate: dates[0] || new Date().toISOString().slice(0, 10),
      auditStartDate: dates[0],
      auditEndDate: dates[dates.length - 1],
    });
  };

  const initSigCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (releaseModal && releaseSigCanvasRef.current) {
      initSigCanvas(releaseSigCanvasRef.current);
      setReleaseReviewerName(userName || '');
    }
  }, [releaseModal, initSigCanvas, userName]);

  const sigStartDrawing = (e: any, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const yy = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x * (canvas.width / rect.width), yy * (canvas.height / rect.height));
    (canvas as any)._drawing = true;
  };

  const sigDraw = (e: any, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !(canvas as any)._drawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const yy = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
    ctx.lineTo(x * (canvas.width / rect.width), yy * (canvas.height / rect.height));
    ctx.stroke();
  };

  const sigStopDrawing = async (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    (canvas as any)._drawing = false;
    const dataUrl = canvas.toDataURL('image/png');
    try {
      const compressed = await compressSignature(dataUrl);
      setReleaseSignature(compressed);
    } catch {
      setReleaseSignature(dataUrl);
    }
  };

  const sigClear = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setReleaseSignature('');
  };

  const handleReleaseWithSignature = () => {
    if (!releaseModal || !releaseSignature) return;
    const report = loadReportFromStorage(releaseModal.id);
    if (report) {
      report.reviewerSignature = releaseSignature;
      report.reviewerName = releaseReviewerName || userName;
      saveReportToStorage(releaseModal.id, report);
    }
    const updated: AuditTask = {
      ...releaseModal,
      status: 'Released',
      reviewedAt: new Date().toISOString(),
    };
    onTaskUpdate(updated);
    setReleaseModal(null);
    setReleaseSignature('');
    setReleaseReviewerName('');
  };

  const handleSendBack = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated: AuditTask = {
      ...task,
      status: 'In Progress' as AuditTaskStatus,
      reviewNotes: sendBackNotes || undefined,
      submittedForReviewAt: undefined,
    };
    onTaskUpdate(updated);
    setSendBackModal(null);
    setSendBackNotes('');
  };

  const handlePreviewClose = (result?: AuditCloseResult) => {
    if (reviewingTaskId && result?.submitted) {
      const task = tasks.find(t => t.id === reviewingTaskId);
      if (task) {
        const wasReleased = task.status === 'Released';
        const updated: AuditTask = {
          ...task,
          status: wasReleased ? 'Released' : task.status,
          score: result.scorePercent,
          scoreObtained: result.scoreObtained,
          scoreMax: result.scoreMax,
          lastEditedAt: new Date().toISOString(),
        };
        onTaskUpdate(updated);
      }
    }
    setPreviewTemplate(null);
    setReviewingTaskId(null);
    setAutoDownload(false);
  };

  if (previewTemplate) {
    return (
      <AuditChecklistPreview
        template={previewTemplate}
        onClose={handlePreviewClose}
        draftKey={reviewingTaskId || previewTemplate.id}
        autoTriggerDownload={autoDownload}
      />
    );
  }

  const renderTaskCard = (task: AuditTask, section: 'pending' | 'released') => {
    const isPending = section === 'pending';
    const scoreColor = (task.score ?? 0) >= 80 ? 'text-emerald-600' : (task.score ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600';

    return (
      <div key={task.id} className={`bg-white rounded-[2rem] md:rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden group shadow-sm hover:shadow-2xl ${isPending ? 'border-amber-300 bg-amber-50/5' : 'border-violet-300 bg-violet-50/5'}`}>
        <div className="hidden md:flex flex-row items-stretch divide-x divide-slate-100">
          <div className="p-6 w-[30%] flex items-start gap-5 relative shrink-0">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isPending ? 'bg-amber-500' : 'bg-violet-500'}`} />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-violet-100 text-violet-600'}`}>
              <ClipboardList size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                  {task.status}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-tight truncate mb-1">{task.title}</h3>
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
                <Users size={12} className="text-indigo-500" />
                Auditor: {task.auditorName}
              </div>
              {task.submittedForReviewAt && (
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300 mt-1">
                  <Send size={9} />
                  Submitted {new Date(task.submittedForReviewAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 w-[40%] flex flex-col gap-4 bg-slate-50/20 shrink-0">
            <div className="flex gap-6">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm"><Building2 size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Unit</p>
                  <p className="text-xs font-black text-slate-800 uppercase leading-snug">{task.unitName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm"><Clock size={18} /></div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Scheduled</p>
                  <p className="text-sm font-black text-slate-800 uppercase">
                    {new Date(task.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
            {task.assignedLocations && task.assignedLocations.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10} className="text-indigo-400" /> Location</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.assignedLocations.map(loc => (
                    <span key={loc} className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg border border-indigo-100 flex items-center gap-1.5">
                      <Layers size={9} className="text-indigo-400" />{loc}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-indigo-400" />
                <p className="text-[10px] font-bold text-slate-500 uppercase italic">{task.department}</p>
              </div>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-center items-center bg-white">
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className={`text-3xl font-black tracking-tighter ${scoreColor}`}>{task.score ?? 0}%</span>
                {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{task.scoreObtained}/{task.scoreMax} pts</span>
                )}
              </div>
              <div className="flex flex-col gap-2 w-full items-center">
                {isPending ? (
                  <>
                    <div className="flex gap-2 w-full lg:w-auto">
                      <button
                        onClick={() => openReviewAudit(task)}
                        className="flex-1 lg:flex-none px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5"
                      >
                        <PenTool size={12} /> Edit
                      </button>
                      <button
                        onClick={() => downloadReport(task)}
                        className="flex-1 lg:flex-none px-6 py-2.5 bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Download size={12} /> Download Draft
                      </button>
                    </div>
                    <div className="flex gap-2 w-full lg:w-auto">
                      <button
                        onClick={() => setReleaseModal(task)}
                        className="flex-1 lg:flex-none px-6 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={12} /> Release
                      </button>
                      <button
                        onClick={() => setSendBackModal(task.id)}
                        className="flex-1 lg:flex-none px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                      >
                        <RotateCcw size={12} /> Send Back
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => downloadReport(task)}
                      className="w-full lg:w-auto px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={14} /> Download Final Report
                    </button>
                    <button
                      onClick={() => openReviewAudit(task)}
                      className="w-full lg:w-auto px-6 py-2 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
                    >
                      <PenTool size={12} /> Edit Report
                    </button>
                  </>
                )}
              </div>
              {task.reviewedAt && (
                <span className="text-[8px] font-bold text-slate-300 italic">Released {new Date(task.reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              )}
              {task.lastEditedAt && (
                <span className="text-[8px] font-bold text-slate-300 italic">Last edited {new Date(task.lastEditedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden flex flex-col relative">
          <div className="p-5 flex justify-between items-start border-b border-slate-50 relative z-10">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-violet-100 text-violet-600'}`}>
                <ClipboardList size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isPending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                    {task.status}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight truncate leading-none">{task.title}</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1"><Users size={10} className="text-indigo-400" /> {task.auditorName}</p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-50/30 space-y-3 relative z-10">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit</p>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                  <Building2 size={12} className="text-indigo-500" /> {task.unitName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                <span className={`text-xl font-black tracking-tighter ${scoreColor}`}>{task.score ?? 0}%</span>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 flex flex-col gap-2 relative z-10">
            {isPending ? (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReviewAudit(task)}
                    className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-1.5"
                  >
                    <PenTool size={12} /> Edit
                  </button>
                  <button
                    onClick={() => downloadReport(task)}
                    className="flex-1 py-3 bg-slate-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download size={12} /> Draft
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setReleaseModal(task)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={12} /> Release
                  </button>
                  <button
                    onClick={() => setSendBackModal(task.id)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                  >
                    <RotateCcw size={12} /> Send Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => downloadReport(task)}
                  className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download Final Report
                </button>
                <button
                  onClick={() => openReviewAudit(task)}
                  className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
                >
                  <PenTool size={12} /> Edit Report
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-lg sm:shadow-xl flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-gradient-to-b from-violet-600 to-violet-400" />
        <div className="flex items-center gap-3 sm:gap-4 md:gap-6 z-10 pl-2 sm:pl-0">
          <div className="p-2.5 sm:p-3 md:p-4 bg-violet-50 text-violet-600 rounded-xl sm:rounded-3xl shadow-inner border border-violet-100">
            <Eye className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Review <span className="text-violet-600">Audits</span></h2>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 sm:mt-2 uppercase tracking-[0.15em] sm:tracking-[0.2em] flex items-center gap-1.5 sm:gap-2">
              <ShieldCheck size={10} className="sm:w-3 sm:h-3 text-emerald-500" /> Reviewer Dashboard
            </p>
          </div>
        </div>

        <div className="relative group w-full sm:w-80 z-10">
          <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          <input
            type="text"
            placeholder="Filter reviews..."
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider focus:outline-none focus:border-violet-200 focus:ring-2 focus:ring-violet-50 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-500 rounded-lg sm:rounded-xl"><Clock className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /></div>
            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">{pendingReview.length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="p-1.5 sm:p-2 bg-violet-50 text-violet-500 rounded-lg sm:rounded-xl"><CheckCircle2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /></div>
            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Released</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">{releasedReports.length}</p>
        </div>
        <div className="bg-white p-3 sm:p-4 md:p-5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-500 rounded-lg sm:rounded-xl"><Award className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /></div>
            <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter">{myReviewTasks.length}</p>
        </div>
      </div>

      {reviewGroupedData.groups.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl border border-indigo-100">
              <Layers size={16} />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
              Consolidated Audits ({reviewGroupedData.groups.length})
            </h3>
          </div>

          {reviewGroupedData.groups.map(group => {
            const isExpanded = expandedGroups[group.groupId] ?? false;
            const pendingInGroup = group.tasks.filter(t => t.status === 'Under Review');
            const releasedInGroup = group.tasks.filter(t => t.status === 'Released');
            const scoreRingColor = group.overallScore >= 80 ? '#16a34a' : group.overallScore >= 50 ? '#d97706' : '#dc2626';
            const scoreTextColor = group.overallScore >= 80 ? 'text-emerald-600' : group.overallScore >= 50 ? 'text-amber-600' : 'text-rose-600';
            const scoreBgColor = group.overallScore >= 80 ? 'bg-emerald-50 border-emerald-200' : group.overallScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
            const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

            return (
              <div key={group.groupId} className={`bg-white rounded-2xl sm:rounded-[2rem] border-2 overflow-hidden shadow-sm transition-all ${group.allComplete ? 'border-violet-200' : 'border-slate-200'}`}>
                <div
                  className={`px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 cursor-pointer ${group.allComplete ? 'bg-gradient-to-r from-violet-50/60 to-white' : 'bg-gradient-to-r from-indigo-50/40 to-white'}`}
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.groupId]: !isExpanded }))}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-5">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <svg width="60" height="60" viewBox="0 0 60 60" className="hidden md:block">
                          <circle cx="30" cy="30" r="26" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                          <circle cx="30" cy="30" r="26" fill="none" stroke={scoreRingColor} strokeWidth="4"
                            strokeDasharray={`${(group.overallScore / 100) * 163.36} 163.36`}
                            strokeLinecap="round" transform="rotate(-90 30 30)" className="transition-all duration-700" />
                        </svg>
                        <div className={`hidden md:flex absolute inset-0 items-center justify-center text-sm font-black ${scoreTextColor}`}>
                          {group.overallScore}%
                        </div>
                        <div className={`md:hidden w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${group.allComplete ? 'bg-violet-100 text-violet-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                          <span className={`px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg text-[7px] sm:text-[8px] font-black uppercase tracking-widest border ${group.allComplete ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                            {group.allComplete ? 'All Released' : `${releasedInGroup.length}/${group.tasks.length} Released`}
                          </span>
                          <span className="text-[7px] sm:text-[8px] font-bold text-slate-300 uppercase tracking-widest">{group.completedLocations}/{group.totalLocations} location{group.totalLocations !== 1 ? 's' : ''}</span>
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 uppercase tracking-tight truncate leading-tight">{group.checklistName}</h3>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <Building2 size={11} className="text-indigo-500" /> {group.unitName}
                          </span>
                          {group.overallMax > 0 && (
                            <>
                              <span className="text-slate-200">|</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{group.overallObtained}/{group.overallMax} pts</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {group.scheduledDate && (
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                              <Calendar size={8} className="text-slate-300" /> Scheduled: {fmtDate(group.scheduledDate)}
                            </span>
                          )}
                          {group.auditStartDate && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Start: {fmtDate(group.auditStartDate)}</span>
                            </>
                          )}
                          {group.auditEndDate && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-[8px] font-bold text-violet-400 uppercase tracking-wider">End: {fmtDate(group.auditEndDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                      <div className={`md:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border ${scoreBgColor}`}>
                        <span className={`text-lg font-black ${scoreTextColor}`}>{group.overallScore}%</span>
                      </div>
                      {group.allComplete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadConsolidatedPdf(group, false); }}
                          className="px-3 py-1.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-violet-700 transition-all shadow-sm"
                        >
                          <Download size={12} /> Consolidated Report
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [group.groupId]: !isExpanded })); }}
                        className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {!group.allComplete && releasedInGroup.length > 0 && (
                  <div className="border-t border-slate-100 px-5 md:px-8 py-2.5 bg-violet-50/30 flex items-center justify-between">
                    <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">{releasedInGroup.length}/{group.tasks.length} locations released</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadConsolidatedPdf(group, true); }}
                      className="px-3 py-1.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-violet-700 transition-all shadow-sm"
                    >
                      <Download size={12} /> Partial Report
                    </button>
                  </div>
                )}

                <div className="border-t border-slate-100">
                  <div className="divide-y divide-slate-50">
                    {group.tasks.map(task => {
                      const locLabel = task.assignedLocations?.join(', ') || task.department;
                      const taskScore = task.score ?? 0;
                      const isPending = task.status === 'Under Review';
                      const isReleased = task.status === 'Released';
                      const taskScoreColor = taskScore >= 80 ? 'text-emerald-600' : taskScore >= 50 ? 'text-amber-600' : 'text-rose-600';
                      const statusDot = isReleased ? 'bg-violet-500' : 'bg-amber-400';
                      const statusBadge = isReleased ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-amber-50 text-amber-600 border-amber-200';
                      const isTaskExpanded = expandedGroups[`task-${task.id}`] ?? false;

                      return (
                        <div key={task.id}>
                          <div
                            className={`flex items-center px-5 md:px-8 py-3 md:py-3.5 gap-3 md:gap-4 cursor-pointer transition-colors ${isPending ? 'bg-amber-50/15 hover:bg-amber-50/30' : 'hover:bg-slate-50/60'}`}
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [`task-${task.id}`]: !isTaskExpanded }))}
                          >
                            <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 ${statusDot}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] md:text-xs font-bold text-slate-700 truncate">{locLabel}</p>
                              <p className="text-[9px] md:text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <Users size={9} className="text-slate-300" /> {task.auditorName}
                                {isPending && task.submittedForReviewAt && (
                                  <><span className="text-slate-200 mx-0.5">·</span><span className="hidden md:inline">Submitted {new Date(task.submittedForReviewAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className="md:hidden">{new Date(task.submittedForReviewAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span></>
                                )}
                                {isReleased && task.reviewedAt && (
                                  <><span className="text-slate-200 mx-0.5">·</span><span className="hidden md:inline">Released {new Date(task.reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className="md:hidden">{new Date(task.reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span></>
                                )}
                              </p>
                            </div>
                            <span className={`hidden md:inline-flex px-2 py-0.5 rounded-md border text-[8px] font-black uppercase ${statusBadge}`}>{task.status}</span>
                            <span className={`text-sm font-black min-w-[36px] text-right ${isPending ? 'text-amber-500' : taskScoreColor}`}>{taskScore}%</span>
                            <ChevronDown size={14} className={`text-slate-300 shrink-0 transition-transform duration-200 ${isTaskExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          {isTaskExpanded && (
                            <div className="px-5 md:px-8 pb-3 pt-1 flex items-center gap-2 flex-wrap bg-slate-50/40">
                              <span className={`md:hidden px-2 py-0.5 rounded-md border text-[8px] font-black uppercase ${statusBadge}`}>{task.status}</span>
                              {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                <span className="text-[9px] font-bold text-slate-400">{task.scoreObtained}/{task.scoreMax} pts</span>
                              )}
                              <div className="ml-auto flex items-center gap-1.5">
                                {isPending && (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); openReviewAudit(task); }} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-800 transition-all shadow-sm">
                                      <Eye size={11} /> Review
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setReleaseModal(task); }} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-sm">
                                      <CheckCircle2 size={11} /> Release
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setSendBackModal(task.id); setSendBackNotes(''); }} className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-rose-600 transition-all shadow-sm">
                                      <RotateCcw size={11} /> Back
                                    </button>
                                  </>
                                )}
                                {isReleased && (
                                  <button onClick={(e) => { e.stopPropagation(); openReviewAudit(task); }} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-violet-700 transition-all shadow-sm">
                                    <PenTool size={11} /> Edit
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {group.dueTasks.length > 0 && (
                  <div className="border-t border-slate-100 px-5 md:px-8 py-3 bg-amber-50/30">
                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Clock size={10} className="text-amber-500" /> Due for Audit ({group.dueTasks.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.dueTasks.map(t => (
                        <span key={t.id} className="px-2.5 py-1 rounded-lg text-[8px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          {t.assignedLocations?.join(', ') || t.department}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {reviewGroupedData.ungroupedPending.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-500 rounded-xl border border-amber-100">
              <AlertTriangle size={16} />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Pending Review ({reviewGroupedData.ungroupedPending.length})</h3>
          </div>
          <div className="flex flex-col gap-5">
            {reviewGroupedData.ungroupedPending.map(task => renderTaskCard(task, 'pending'))}
          </div>
        </div>
      )}

      {reviewGroupedData.ungroupedReleased.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 text-violet-500 rounded-xl border border-violet-100">
              <CheckCircle2 size={16} />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Released Reports ({reviewGroupedData.ungroupedReleased.length})</h3>
          </div>
          <div className="flex flex-col gap-5">
            {reviewGroupedData.ungroupedReleased.map(task => renderTaskCard(task, 'released'))}
          </div>
        </div>
      )}

      {myReviewTasks.length === 0 && (
        <div className="py-32 text-center flex flex-col items-center justify-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-slate-200 shadow-inner ring-8 ring-slate-50/50">
            <Eye size={48} strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">No Reviews Assigned</h3>
          <p className="text-slate-400 text-xs mt-3 font-bold uppercase tracking-[0.3em] max-w-sm leading-relaxed">
            Audit reports assigned to you for review will appear here.
          </p>
        </div>
      )}

      {releaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Release Audit Report</h3>
                  <p className="text-[10px] text-slate-400">Sign below to finalize and release the report</p>
                </div>
              </div>
              <button onClick={() => { setReleaseModal(null); setReleaseSignature(''); setReleaseReviewerName(''); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-tight mb-1">{releaseModal.title}</h4>
                <p className="text-[10px] text-emerald-600 font-bold">Auditor: {releaseModal.auditorName} — Score: {releaseModal.score ?? 0}%</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewer Signature <span className="text-rose-500">*</span></label>
                  <button onClick={() => sigClear(releaseSigCanvasRef.current)} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                  </button>
                </div>
                <div className="w-full h-28 bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl relative overflow-hidden shadow-inner cursor-crosshair">
                  <canvas
                    ref={releaseSigCanvasRef}
                    width={500} height={112}
                    className="w-full h-full"
                    onMouseDown={(e) => sigStartDrawing(e, releaseSigCanvasRef.current)}
                    onMouseMove={(e) => sigDraw(e, releaseSigCanvasRef.current)}
                    onMouseUp={() => sigStopDrawing(releaseSigCanvasRef.current)}
                    onMouseLeave={() => sigStopDrawing(releaseSigCanvasRef.current)}
                    onTouchStart={(e) => sigStartDrawing(e, releaseSigCanvasRef.current)}
                    onTouchMove={(e) => sigDraw(e, releaseSigCanvasRef.current)}
                    onTouchEnd={() => sigStopDrawing(releaseSigCanvasRef.current)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reviewer Name</label>
                <input type="text" value={releaseReviewerName} onChange={(e) => setReleaseReviewerName(e.target.value)} placeholder="Enter reviewer's name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none transition-all" />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => { setReleaseModal(null); setReleaseSignature(''); setReleaseReviewerName(''); }} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReleaseWithSignature}
                disabled={!releaseSignature}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Sign & Release
              </button>
            </div>
          </div>
        </div>
      )}

      {sendBackModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <RotateCcw size={20} className="text-amber-400" />
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Send Back to Auditor</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Add optional revision notes</p>
                </div>
              </div>
              <button onClick={() => { setSendBackModal(null); setSendBackNotes(''); }} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Revision Notes</label>
                <textarea
                  value={sendBackNotes}
                  onChange={e => setSendBackNotes(e.target.value)}
                  placeholder="Describe what needs to be revised..."
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-medium resize-none h-32 focus:outline-none focus:border-violet-400 transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setSendBackModal(null); setSendBackNotes(''); }}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendBack(sendBackModal)}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={12} /> Send Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewAudits;
