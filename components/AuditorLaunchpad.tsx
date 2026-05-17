"use client";

import React, { useState, useMemo } from 'react';
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ChevronRight, 
  FileText, 
  Search,
  MapPin,
  Building2,
  Users,
  User,
  Target,
  ClipboardList,
  Zap,
  Calendar,
  MoreVertical,
  Archive,
  Eye,
  Award,
  Layers,
  Download,
  ChevronDown,
  PenTool,
  Send,
  RotateCcw,
  AlertTriangle,
  ImageIcon,
  MessageSquare,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { HierarchyScope, Entity, AuditTask, AuditTaskStatus, AuditObservation } from '../types';
import { generateConsolidatedPdf } from '@/utils/consolidatedPdf';
import type { ChecklistTemplate } from './AuditChecklistCreator';
import AuditChecklistPreview, { hasDraftInStorage, getDraftInfo, AuditCloseResult, loadReportFromStorage, loadReportFromDb, saveReportToStorage } from './AuditChecklistPreview';
import { compressSignature } from '@/utils/imageCompression';

interface AuditorLaunchpadProps {
  currentScope: HierarchyScope;
  userRootId?: string | null;
  userName?: string;
  entities: Entity[];
  assignedTasks?: AuditTask[];
  checklistTemplates?: ChecklistTemplate[];
  onAuditComplete?: (task: AuditTask) => void;
  onLiveObservationsChange?: (taskId: string, observations: import('../types').AuditObservation[]) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskUpdate?: (task: AuditTask) => void;
  departmentLocations?: Record<string, string[]>;
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
        category: 'General',
        requirement: q.clause || '',
        isRequired: true,
        isMultipleSelection: false,
        isFlagged: false,
        flaggedValue: 'No',
        maxScore: 10,
        logicRules: [],
    }));

    return {
        id: task.checklistId,
        title: task.checklistName,
        department: task.department,
        frequency: 'Ad-hoc',
        questionCount: questions.length,
        lastUpdated: new Date().toISOString().split('T')[0],
        status: 'Active',
        history: [],
        pages: [{
            id: `page-${task.checklistId}`,
            title: task.title,
            sections: [{
                id: `sec-${task.checklistId}`,
                title: task.department,
                isApplicable: true,
                risk: 'Med',
                category: 'General',
                questions,
            }],
        }],
        unitDetails: {
            companyName: task.unitName,
            repName: task.auditorName,
            address: '',
            contact: '',
            email: '',
            manday: '',
            scope: task.checklistName,
            dateFrom: task.scheduledDate,
            dateTo: '',
            geotag: '',
            startTime: task.startTime || '',
        },
    };
};

type ViewMode = 'active' | 'review' | 'history';

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
}

const AuditorLaunchpad: React.FC<AuditorLaunchpadProps> = ({ currentScope, userRootId, userName, entities, assignedTasks, checklistTemplates = [], onAuditComplete, onLiveObservationsChange, onTaskDelete, onTaskUpdate, departmentLocations = {} }) => {
    const [tasks, setTasks] = useState<AuditTask[]>(assignedTasks || []);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>('active');
    const showHistory = viewMode === 'history';
    const showReview = viewMode === 'review';
    const [previewTemplate, setPreviewTemplate] = useState<ChecklistTemplate | null>(null);
    const [auditingTaskId, setAuditingTaskId] = useState<string | null>(null);
    const [autoDownload, setAutoDownload] = useState(false);
    const [autoDownloadMode, setAutoDownloadMode] = useState<'combined' | 'per-department' | 'per-section' | 'per-location' | undefined>(undefined);
    const [downloadDropdownId, setDownloadDropdownId] = useState<string | null>(null);
    const downloadDropdownRef = React.useRef<HTMLDivElement>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [showReviewSignatureModal, setShowReviewSignatureModal] = useState<string | null>(null);
    const [reviewerSignature, setReviewerSignature] = useState('');
    const [reviewerNameInput, setReviewerNameInput] = useState(userName || '');
    const [sendBackTaskId, setSendBackTaskId] = useState<string | null>(null);
    const [sendBackNotes, setSendBackNotes] = useState('');
    const reviewSignatureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const reviewSignatureDrawing = React.useRef(false);

    React.useEffect(() => {
        if (!downloadDropdownId) return;
        const handler = (e: MouseEvent) => {
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target as Node)) {
                setDownloadDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [downloadDropdownId]);

    React.useEffect(() => {
        const incoming = assignedTasks || [];
        setTasks(prev => {
            const incomingIds = new Set(incoming.map(t => t.id));
            const localUpdates = prev.filter(t => !incomingIds.has(t.id) && (t.status === 'In Progress' || t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released'));
            const merged = incoming.map(t => {
                const existing = prev.find(pt => pt.id === t.id);
                if (!existing) return t;
                const localIsNewer = existing.status === 'Completed' || existing.status === 'Under Review' || existing.status === 'Released' || (existing.status === 'In Progress' && t.status === 'Scheduled');
                if (localIsNewer) {
                    return { ...t, ...existing };
                }
                const incomingIsComplete = t.status === 'Completed' || t.status === 'Released';
                if (incomingIsComplete) return t;
                return { ...t, status: existing.status === 'In Progress' ? existing.status : t.status, progress: Math.max(existing.progress, t.progress) };
            });
            return [...merged, ...localUpdates];
        });
    }, [assignedTasks]);

    const auditingTaskIdRef = React.useRef(auditingTaskId);
    auditingTaskIdRef.current = auditingTaskId;
    const onLiveObsRef = React.useRef(onLiveObservationsChange);
    onLiveObsRef.current = onLiveObservationsChange;

    const handleLiveObsChange = React.useCallback((obs: import('../types').AuditObservation[]) => {
        const taskId = auditingTaskIdRef.current;
        if (!taskId) return;
        setTasks(prev => {
            const existing = prev.find(t => t.id === taskId);
            if (!existing) return prev;
            if (existing.observations === obs) return prev;
            return prev.map(t => t.id === taskId ? { ...t, observations: obs } : t);
        });
        onLiveObsRef.current?.(taskId, obs);
    }, []);


    const myTasks = useMemo(() => {
        if (userRootId === 'super-admin' || currentScope === 'super-admin') {
            if (userName && userName !== 'Admin') {
                return tasks.filter(t => t.auditorName === userName);
            }
            return tasks;
        }
        if (currentScope === 'unit') {
            const unitEntity = entities.find(e => e.id === userRootId);
            if (unitEntity) {
                const unitSlug = unitEntity.name.toLowerCase().replace(/\s+/g, '-');
                return tasks.filter(t => t.unitId === userRootId || t.unitId === unitSlug || t.unitName === unitEntity.name || t.auditorName === userName);
            }
        }
        if (currentScope === 'department') {
            const deptEntity = entities.find(e => e.id === userRootId);
            if (deptEntity) {
                const parentUnit = entities.find(e => e.id === deptEntity.parentId);
                return tasks.filter(t => 
                    t.auditorName === userName ||
                    t.department.includes(deptEntity.name) ||
                    (parentUnit && (t.unitId === parentUnit.id || t.unitName === parentUnit.name))
                );
            }
        }
        return tasks.filter(t => t.auditorId === userRootId || t.auditorName === userName);
    }, [tasks, userRootId, userName, currentScope, entities]);

    const filteredTasks = useMemo(() => {
        const filtered = myTasks.filter(t => {
            const matchesSearch = (t.title || t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (t.unitName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 (t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const isFinished = t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released';
            const matchesToggle = showHistory ? isFinished : !isFinished;
            
            return matchesSearch && matchesToggle;
        });
        if (showHistory) {
            filtered.sort((a, b) => {
                const da = a.endTime ? new Date(a.endTime).getTime() : 0;
                const db = b.endTime ? new Date(b.endTime).getTime() : 0;
                return db - da;
            });
        }
        return filtered;
    }, [myTasks, searchTerm, showHistory]);

    const historyGroupedData = useMemo(() => {
        if (!showHistory) return { groups: [] as ConsolidatedGroup[], ungroupedTasks: [] as AuditTask[] };
        const matchesSearch = (t: AuditTask) =>
            (t.title || t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.unitName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const finishedTasks = myTasks.filter(t => {
            const isFinished = t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released';
            return isFinished && matchesSearch(t);
        });
        finishedTasks.sort((a, b) => {
            const da = a.endTime ? new Date(a.endTime).getTime() : 0;
            const db = b.endTime ? new Date(b.endTime).getTime() : 0;
            return db - da;
        });
        const finishedGroupIds = new Set<string>();
        finishedTasks.forEach(t => { if (t.groupId) finishedGroupIds.add(t.groupId); });
        const groupMap = new Map<string, AuditTask[]>();
        const ungrouped: AuditTask[] = [];
        finishedTasks.forEach(t => {
            if (t.groupId) {
                const arr = groupMap.get(t.groupId) || [];
                arr.push(t);
                groupMap.set(t.groupId, arr);
            } else {
                ungrouped.push(t);
            }
        });
        finishedGroupIds.forEach(gid => {
            myTasks.forEach(t => {
                if (t.groupId === gid && t.status !== 'Completed' && t.status !== 'Under Review' && t.status !== 'Released') {
                    const arr = groupMap.get(gid) || [];
                    if (!arr.find(x => x.id === t.id)) { arr.push(t); groupMap.set(gid, arr); }
                }
            });
        });
        const groups: ConsolidatedGroup[] = [];
        const soloFromGroups: AuditTask[] = [];
        groupMap.forEach((groupTasks, gid) => {
            if (groupTasks.length <= 1) {
                soloFromGroups.push(...groupTasks);
                return;
            }
            const completedTasks = groupTasks.filter(t => t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released');
            const totalLocations = groupTasks.reduce((sum, t) => sum + (t.assignedLocations?.length || 1), 0);
            const completedLocations = completedTasks.reduce((sum, t) => sum + (t.assignedLocations?.length || 1), 0);
            const overallObtained = completedTasks.reduce((sum, t) => sum + (t.scoreObtained || 0), 0);
            const overallMax = completedTasks.reduce((sum, t) => sum + (t.scoreMax || 0), 0);
            const overallScore = overallMax > 0 ? Math.round((overallObtained / overallMax) * 100) : 0;
            groups.push({
                groupId: gid,
                checklistName: groupTasks[0].checklistName,
                unitName: groupTasks[0].unitName,
                tasks: groupTasks,
                totalLocations,
                completedLocations,
                allComplete: completedTasks.length === groupTasks.length,
                overallScore,
                overallObtained,
                overallMax,
            });
        });
        groups.sort((a, b) => (a.allComplete ? 1 : 0) - (b.allComplete ? 1 : 0));
        return { groups, ungroupedTasks: [...ungrouped, ...soloFromGroups] };
    }, [myTasks, searchTerm, showHistory]);

    const reviewTasks = useMemo(() => {
        if (!showReview) return [];
        return tasks.filter(t => {
            const isReviewable = t.reviewerName === userName && (t.status === 'Under Review' || t.status === 'Released');
            if (!isReviewable) return false;
            const matchesSearch = (t.title || t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.unitName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.checklistName || '').toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [tasks, userName, searchTerm, showReview]);

    const pendingReviewCount = useMemo(() => {
        return tasks.filter(t => t.reviewerName === userName && t.status === 'Under Review').length;
    }, [tasks, userName]);

    const handleReleaseAudit = React.useCallback(async (taskId: string) => {
        const canvas = reviewSignatureCanvasRef.current;
        let sig = reviewerSignature;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const raw = canvas.toDataURL('image/png');
                try { sig = await compressSignature(raw); } catch { sig = raw; }
            }
        }
        if (!sig) { alert('Please provide your signature'); return; }
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const updated: AuditTask = { ...task, status: 'Released', reviewerSignature: sig, reviewerName: reviewerNameInput || userName || task.reviewerName, releasedAt: new Date().toISOString() };
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        onTaskUpdate?.(updated);
        let report = loadReportFromStorage(taskId);
        if (!report) report = await loadReportFromDb(taskId);
        if (report) {
            const updatedReport = { ...report, reviewerSignature: sig, reviewerName: reviewerNameInput || userName || task.reviewerName, auditState: 'submitted' as const };
            saveReportToStorage(taskId, updatedReport);
            try {
                await fetch('/api/audit-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ id: taskId, type: 'report', data: updatedReport }]) });
            } catch {}
        }
        setShowReviewSignatureModal(null);
        setReviewerSignature('');
        setTimeout(() => viewReport(updated, 'combined'), 300);
    }, [tasks, reviewerSignature, reviewerNameInput, userName, onTaskUpdate]);

    const handleSendBack = React.useCallback((taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const updated: AuditTask = { ...task, status: 'In Progress', reviewNotes: sendBackNotes, sentBackAt: new Date().toISOString() };
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        onTaskUpdate?.(updated);
        setSendBackTaskId(null);
        setSendBackNotes('');
    }, [tasks, sendBackNotes, onTaskUpdate]);

    const initReviewSignatureCanvas = React.useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        reviewSignatureCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const getPos = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            const touch = 'touches' in e ? e.touches[0] || e.changedTouches[0] : null;
            return { x: ((touch?.clientX || (e as MouseEvent).clientX) - rect.left) * (canvas.width / rect.width), y: ((touch?.clientY || (e as MouseEvent).clientY) - rect.top) * (canvas.height / rect.height) };
        };
        const start = (e: MouseEvent | TouchEvent) => { e.preventDefault(); reviewSignatureDrawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
        const move = (e: MouseEvent | TouchEvent) => { if (!reviewSignatureDrawing.current) return; e.preventDefault(); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
        const end = () => { reviewSignatureDrawing.current = false; setReviewerSignature(canvas.toDataURL('image/png')); };
        canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); canvas.addEventListener('mouseup', end); canvas.addEventListener('mouseleave', end);
        canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
    }, []);

    const getFilteredTemplate = (task: AuditTask): ChecklistTemplate => {
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
            // Compare case-/whitespace-insensitively. Department names on the
            // scheduled task and page titles on the checklist template often
            // come from different sources (entity tree vs hand-typed page
            // names), so a strict `Set.has(page.title)` match would drop every
            // page and the auditor would tap "Resume Audit" only to land on a
            // blank checklist — which looks like the button doesn't work.
            const norm = (s: string) => (s || '').trim().toLowerCase();
            const deptSetNorm = new Set(Array.from(deptSet).map(norm));
            const filteredPages = template.pages.filter(p => deptSetNorm.has(norm(p.title)));
            // If nothing matched (e.g. legacy task with departments the
            // checklist no longer publishes), fall back to the full template
            // so the auditor can still proceed instead of staring at a card
            // whose Resume button "does nothing".
            template = { ...template, pages: filteredPages.length > 0 ? filteredPages : template.pages };
            const locationStr = locationLabels.join(', ');
            const deptStr = Array.from(deptSet).join(', ');
            template = {
                ...template,
                unitDetails: {
                    ...template.unitDetails,
                    companyName: template.unitDetails?.companyName || task.unitName,
                    repName: template.unitDetails?.repName || task.auditorName,
                    scope: `${task.checklistName}${deptStr ? ` — ${deptStr}` : ''}${locationStr !== deptStr ? ` › ${locationStr}` : ''}`,
                    dateFrom: template.unitDetails?.dateFrom || task.scheduledDate,
                },
            };
        } else {
            template = {
                ...template,
                unitDetails: {
                    ...template.unitDetails,
                    companyName: template.unitDetails?.companyName || task.unitName,
                    repName: template.unitDetails?.repName || task.auditorName,
                    scope: template.unitDetails?.scope || `${task.checklistName}${task.department ? ` — ${task.department}` : ''}`,
                    dateFrom: template.unitDetails?.dateFrom || task.scheduledDate,
                },
            };
        }
        return template;
    };

    const launchAudit = (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const template = getFilteredTemplate(task);

        setAuditingTaskId(taskId);
        setPreviewTemplate(template);
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, status: 'In Progress' as AuditTaskStatus, startTime: t.startTime || new Date().toISOString() } : t
        ));
    };

    const viewReport = (task: AuditTask, mode?: 'combined' | 'per-department' | 'per-section' | 'per-location') => {
        const template = getFilteredTemplate(task);
        setAuditingTaskId(task.id);
        setPreviewTemplate(template);
        setAutoDownloadMode(mode);
        setAutoDownload(true);
        setDownloadDropdownId(null);
    };

    const handleDownloadConsolidatedPdf = async (group: { groupId: string; checklistName: string; unitName: string; tasks: AuditTask[]; allComplete: boolean }, isPartial: boolean) => {
        const finishedStatuses: AuditTaskStatus[] = ['Completed', 'Under Review', 'Released'];
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
            const template = getFilteredTemplate(task);
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

    const handlePreviewClose = (result?: AuditCloseResult) => {
        if (auditingTaskId) {
            if (result?.submitted) {
                const endTime = new Date().toISOString();
                let completedTaskForCallback: AuditTask | undefined;
                setTasks(prev => {
                    const currentTask = prev.find(t => t.id === auditingTaskId);
                    const wasReleased = currentTask?.status === 'Released';
                    const hasReviewer = currentTask?.reviewerName;
                    const reviewRequired = currentTask?.reviewRequired !== false;
                    const newStatus: AuditTaskStatus = wasReleased ? 'Released' : (hasReviewer && reviewRequired) ? 'Under Review' : 'Completed';
                    const taskLocation = currentTask?.assignedLocations?.join(', ') || currentTask?.department || '';
                    const enrichedObs = result.observations?.map(o => ({
                        ...o,
                        location: o.location || taskLocation,
                        department: o.department || currentTask?.department || '',
                    }));
                    const updated = prev.map(t =>
                        t.id === auditingTaskId ? { ...t, status: newStatus, endTime: wasReleased ? t.endTime : endTime, progress: 100, score: result.scorePercent, scoreObtained: result.scoreObtained, scoreMax: result.scoreMax, submittedForReviewAt: (!wasReleased && hasReviewer && reviewRequired) ? endTime : t.submittedForReviewAt, lastEditedAt: wasReleased ? endTime : undefined, observations: enrichedObs, questions: result.questions || t.questions } : t
                    );
                    completedTaskForCallback = updated.find(t => t.id === auditingTaskId);
                    return updated;
                });
                if (completedTaskForCallback && onAuditComplete) {
                    setTimeout(() => onAuditComplete(completedTaskForCallback!), 0);
                }
                setViewMode('history');
            } else {
                const draftExists = hasDraftInStorage(auditingTaskId);
                if (draftExists) {
                    setTasks(prev => prev.map(t =>
                        t.id === auditingTaskId ? { ...t, status: 'In Progress' as AuditTaskStatus } : t
                    ));
                }
            }
        }
        setPreviewTemplate(null);
        setAuditingTaskId(null);
        setAutoDownload(false);
        setAutoDownloadMode(undefined);
    };

    if (previewTemplate) {
        return (
            <AuditChecklistPreview
                template={previewTemplate}
                onClose={handlePreviewClose}
                draftKey={auditingTaskId || previewTemplate.id}
                autoTriggerDownload={autoDownload}
                autoDownloadMode={autoDownloadMode}
                reviewRequired={auditingTaskId ? tasks.find(t => t.id === auditingTaskId)?.reviewRequired : true}
                auditUnitId={
                    auditingTaskId
                        ? (() => {
                            const taskUnitId = tasks.find(t => t.id === auditingTaskId)?.unitId;
                            if (!taskUnitId) return undefined;
                            if (entities.find(e => e.id === taskUnitId)) return taskUnitId;
                            const taskUnitName = tasks.find(t => t.id === auditingTaskId)?.unitName;
                            if (taskUnitName) {
                              const resolved = entities.find(e => e.type === 'unit' && e.name && e.name.trim().toLowerCase() === taskUnitName.trim().toLowerCase());
                              if (resolved) return resolved.id;
                            }
                            return taskUnitId;
                          })()
                        : currentScope === 'unit'
                        ? userRootId || undefined
                        : currentScope === 'department'
                        ? entities.find(e => e.id === userRootId)?.parentId || undefined
                        : undefined
                }
                auditLocationName={
                    (() => {
                        if (auditingTaskId) {
                            const dept = tasks.find(t => t.id === auditingTaskId)?.department || '';
                            return dept ? (dept.includes('›') ? dept.split('›')[0].trim() : dept) : undefined;
                        }
                        if (currentScope === 'department') return entities.find(e => e.id === userRootId)?.name || undefined;
                        return undefined;
                    })()
                }
                auditUnitName={
                    auditingTaskId
                        ? tasks.find(t => t.id === auditingTaskId)?.unitName?.trim() || undefined
                        : currentScope === 'unit'
                        ? entities.find(e => e.id === userRootId)?.name?.trim() || undefined
                        : currentScope === 'department'
                        ? entities.find(e => e.id === entities.find(e2 => e2.id === userRootId)?.parentId)?.name?.trim() || undefined
                        : undefined
                }
                isCombinedAudit={auditingTaskId ? tasks.find(t => t.id === auditingTaskId)?.isCombinedAudit : undefined}
                combinedLocations={auditingTaskId ? tasks.find(t => t.id === auditingTaskId)?.assignedLocations : undefined}
                onObservationsChange={handleLiveObsChange}
                departmentLocations={(() => {
                    const task = auditingTaskId ? tasks.find(t => t.id === auditingTaskId) : null;
                    if (task) {
                        const unitEntity = task.unitId
                          ? (entities.find(e => e.id === task.unitId)
                            || entities.find(e => e.type === 'unit' && e.name && task.unitName && e.name.trim().toLowerCase() === task.unitName.trim().toLowerCase()))
                          : undefined;
                        if (unitEntity?.departmentLocations && Object.keys(unitEntity.departmentLocations).length > 0) {
                            return unitEntity.departmentLocations;
                        }
                    }
                    return departmentLocations;
                })()}
            />
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-700 pb-20">
            <div className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-lg sm:shadow-xl flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-gradient-to-b from-violet-600 to-violet-400" />
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6 z-10 pl-2 sm:pl-0">
                    <div className="p-2.5 sm:p-3 md:p-4 bg-violet-50 text-violet-600 rounded-xl sm:rounded-3xl shadow-inner border border-violet-100">
                        <Zap className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none"><span className="text-violet-600">Audits</span></h2>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 mt-1 sm:mt-2 uppercase tracking-[0.15em] sm:tracking-[0.2em] flex items-center gap-1.5 sm:gap-2">
                            <ShieldCheck size={10} className="sm:w-3 sm:h-3 text-emerald-500" /> Execute, Review & Track
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 z-10 w-full sm:w-auto">
                    <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => setViewMode('active')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'active' ? 'bg-white text-violet-600 shadow-md border border-slate-200' : 'text-slate-400'}`}
                        >
                            Active
                        </button>
                        <button 
                            onClick={() => setViewMode('review')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative ${viewMode === 'review' ? 'bg-white text-violet-600 shadow-md border border-slate-200' : 'text-slate-400'}`}
                        >
                            Review
                            {pendingReviewCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full min-w-[16px] text-center leading-none">
                                    {pendingReviewCount}
                                </span>
                            )}
                        </button>
                        <button 
                            onClick={() => setViewMode('history')}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-white text-violet-600 shadow-md border border-slate-200' : 'text-slate-400'}`}
                        >
                            History
                        </button>
                    </div>

                    <div className="relative group w-full sm:w-80">
                        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        <input 
                            type="text" 
                            placeholder="Filter audits..." 
                            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider focus:outline-none focus:border-violet-200 focus:ring-2 focus:ring-violet-50 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {showReview ? (
                <div className="space-y-4">
                    {reviewTasks.filter(t => t.status === 'Under Review').length > 0 && (
                        <div className="space-y-3">
                            {reviewTasks.filter(t => t.status === 'Under Review').map(task => {
                                const scoreColor = (task.score || 0) >= 80 ? 'text-emerald-600' : (task.score || 0) >= 50 ? 'text-amber-600' : 'text-rose-600';
                                const scoreBg = (task.score || 0) >= 80 ? 'bg-emerald-50 border-emerald-200' : (task.score || 0) >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
                                return (
                                    <div key={task.id} className="bg-white rounded-2xl border-2 border-amber-200 p-4 sm:p-5 shadow-sm">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                                    <Eye className="w-5 h-5 sm:w-6 sm:h-6" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">{task.checklistName || task.title}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <span className="flex items-center gap-1"><Building2 size={10} />{task.unitName}</span>
                                                        {task.department && <span className="flex items-center gap-1"><MapPin size={10} />{task.department}</span>}
                                                        <span className="flex items-center gap-1"><Users size={10} />{task.auditorName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {task.score !== undefined && (
                                                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${scoreBg} ${scoreColor}`}>{task.score}%</span>
                                                )}
                                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider">Pending Review</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                                            <button onClick={() => { const template = getFilteredTemplate(task); setAuditingTaskId(task.id); setPreviewTemplate(template); }} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-violet-700 transition-colors">
                                                <PenTool size={12} /> Edit / Review
                                            </button>
                                            <button onClick={() => setShowReviewSignatureModal(task.id)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-700 transition-colors">
                                                <Send size={12} /> Release
                                            </button>
                                            <button onClick={() => { setSendBackTaskId(task.id); setSendBackNotes(''); }} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-200 transition-colors">
                                                <RotateCcw size={12} /> Send Back
                                            </button>
                                            <button onClick={() => viewReport(task, 'combined')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-200 transition-colors">
                                                <Download size={12} /> Download
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {reviewTasks.filter(t => t.status === 'Released').length > 0 && (
                        <div className="space-y-3 mt-6">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Released</h3>
                            {reviewTasks.filter(t => t.status === 'Released').map(task => (
                                <div key={task.id} className="bg-white rounded-2xl border-2 border-emerald-200 p-4 sm:p-5 shadow-sm">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-black text-sm sm:text-base text-slate-900 truncate">{task.checklistName || task.title}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <span className="flex items-center gap-1"><Building2 size={10} />{task.unitName}</span>
                                                    <span className="flex items-center gap-1"><Users size={10} />{task.auditorName}</span>
                                                    {task.score !== undefined && <span className="text-emerald-600">{task.score}%</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">Released</span>
                                            <button onClick={() => viewReport(task, 'combined')} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-200 transition-colors">
                                                <Download size={12} /> Report
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {reviewTasks.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200 shadow-inner">
                                <Eye size={40} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">No Audits to Review</h3>
                            <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-[0.2em]">Audits assigned to you for review will appear here</p>
                        </div>
                    )}
                </div>
            ) : showHistory ? (
                <div className="flex flex-col gap-8">
                    {historyGroupedData.groups.length > 0 && historyGroupedData.groups.map(group => {
                        const isExpanded = expandedGroups[group.groupId] ?? false;
                        const progressPct = group.totalLocations > 0 ? Math.round((group.completedLocations / group.totalLocations) * 100) : 0;
                        const completedTasks = group.tasks.filter(t => t.status === 'Completed' || t.status === 'Under Review' || t.status === 'Released');
                        const pendingTasks = group.tasks.filter(t => t.status !== 'Completed' && t.status !== 'Under Review' && t.status !== 'Released');
                        const scoreRingColor = group.overallScore >= 80 ? '#16a34a' : group.overallScore >= 50 ? '#d97706' : '#dc2626';
                        const scoreTextColor = group.overallScore >= 80 ? 'text-emerald-600' : group.overallScore >= 50 ? 'text-amber-600' : 'text-rose-600';
                        const scoreBgColor = group.overallScore >= 80 ? 'bg-emerald-50 border-emerald-200' : group.overallScore >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
                        const scheduledDate = group.tasks.map(t => t.scheduledDate).filter(Boolean).sort()[0] || '';
                        const startDates = group.tasks.map(t => t.startTime).filter(Boolean) as string[];
                        const endDates = completedTasks.map(t => t.endTime).filter(Boolean) as string[];
                        const auditStartDate = startDates.sort()[0] || '';
                        const auditEndDate = endDates.sort().reverse()[0] || '';
                        const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        const dueTasks = pendingTasks;

                        return (
                            <div key={group.groupId} className={`bg-white rounded-2xl sm:rounded-[2rem] border-2 overflow-hidden shadow-sm transition-all ${group.allComplete ? 'border-emerald-200' : 'border-slate-200'}`}>
                                <div className={`px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 cursor-pointer ${group.allComplete ? 'bg-gradient-to-r from-emerald-50/60 to-white' : 'bg-gradient-to-r from-indigo-50/40 to-white'}`} onClick={() => setExpandedGroups(prev => ({ ...prev, [group.groupId]: !isExpanded }))}>
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-5">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
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
                                                <div className={`md:hidden w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${group.allComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                    <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                                                    <span className={`px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg text-[7px] sm:text-[8px] font-black uppercase tracking-widest border ${group.allComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                        {group.allComplete ? 'All Completed' : `${completedTasks.length}/${group.tasks.length} Done`}
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
                                                    {scheduledDate && (
                                                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                                                            <Calendar size={8} className="text-slate-300" /> Scheduled: {fmtDate(scheduledDate)}
                                                        </span>
                                                    )}
                                                    {auditStartDate && (
                                                        <>
                                                            <span className="text-slate-200">·</span>
                                                            <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Start: {fmtDate(auditStartDate)}</span>
                                                        </>
                                                    )}
                                                    {auditEndDate && (
                                                        <>
                                                            <span className="text-slate-200">·</span>
                                                            <span className="text-[8px] font-bold text-violet-400 uppercase tracking-wider">End: {fmtDate(auditEndDate)}</span>
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
                                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-sm"
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

                                {!group.allComplete && completedTasks.length > 0 && (
                                    <div className="border-t border-slate-100 px-5 md:px-8 py-2.5 bg-indigo-50/30 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{completedTasks.length}/{group.tasks.length} locations completed</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDownloadConsolidatedPdf(group, true); }}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-indigo-700 transition-all shadow-sm"
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
                                            const isComplete = task.status === 'Completed';
                                            const isUnderReview = task.status === 'Under Review';
                                            const isReleased = task.status === 'Released';
                                            const isInProg = task.status === 'In Progress';
                                            const isFinishedState = isComplete || isUnderReview || isReleased;
                                            const taskDraftKey = task.id;
                                            const draftInfo2 = !isFinishedState ? getDraftInfo(taskDraftKey) : null;
                                            const hasDraft2 = !!draftInfo2;
                                            const taskScoreColor = taskScore >= 80 ? 'text-emerald-600' : taskScore >= 50 ? 'text-amber-600' : 'text-rose-600';
                                            const statusDot = isComplete ? 'bg-emerald-500' : isUnderReview ? 'bg-amber-400' : isReleased ? 'bg-violet-500' : isInProg ? 'bg-indigo-500' : 'bg-slate-300';
                                            const statusBadge = isComplete ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : isUnderReview ? 'bg-amber-50 text-amber-600 border-amber-200' : isReleased ? 'bg-violet-50 text-violet-600 border-violet-200' : isInProg ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200';
                                            const isTaskExpanded = expandedGroups[`task-${task.id}`] ?? false;

                                            return (
                                                <div key={task.id}>
                                                    <div
                                                        className={`flex items-center px-5 md:px-8 py-3 md:py-3.5 gap-3 md:gap-4 cursor-pointer transition-colors ${isFinishedState ? 'hover:bg-slate-50/60' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}
                                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [`task-${task.id}`]: !isTaskExpanded }))}
                                                    >
                                                        <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full shrink-0 ${statusDot}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] md:text-xs font-bold text-slate-700 truncate">{locLabel}</p>
                                                            <p className="text-[9px] md:text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <Users size={9} className="text-slate-300" /> {task.auditorName}
                                                                {task.endTime && isFinishedState && (
                                                                    <><span className="text-slate-200 mx-0.5">·</span><span className="hidden md:inline">{new Date(task.endTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span><span className="md:hidden">{new Date(task.endTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span></>
                                                                )}
                                                                {(isUnderReview || isReleased) && task.reviewerName && (
                                                                    <><span className="text-slate-200 mx-0.5">·</span><Eye size={8} className="text-violet-400" /><span className="hidden md:inline text-violet-500">{task.reviewerName}</span></>
                                                                )}
                                                            </p>
                                                        </div>
                                                        <span className={`hidden md:inline-flex px-2 py-0.5 rounded-md border text-[8px] font-black uppercase ${statusBadge}`}>{task.status}</span>
                                                        {isFinishedState ? (
                                                            <span className={`text-sm font-black min-w-[36px] text-right ${taskScoreColor}`}>{taskScore}%</span>
                                                        ) : isInProg ? (
                                                            <span className="text-[10px] font-bold text-indigo-500 min-w-[36px] text-right">{task.progress}%</span>
                                                        ) : hasDraft2 ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-50 text-amber-500 border border-amber-200">Draft</span>
                                                        ) : null}
                                                        <ChevronDown size={14} className={`text-slate-300 shrink-0 transition-transform duration-200 ${isTaskExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                    {isTaskExpanded && (
                                                        <div className="px-5 md:px-8 pb-3 pt-1 flex items-center gap-2 flex-wrap bg-slate-50/40">
                                                            <span className={`md:hidden px-2 py-0.5 rounded-md border text-[8px] font-black uppercase ${statusBadge}`}>{task.status}</span>
                                                            {isFinishedState && task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                                                <span className="text-[9px] font-bold text-slate-400">{task.scoreObtained}/{task.scoreMax} pts</span>
                                                            )}
                                                            {task.lastEditedAt && (
                                                                <span className="text-[8px] font-bold text-slate-300 italic">Edited {new Date(task.lastEditedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                            )}
                                                            <div className="ml-auto flex items-center gap-1.5">
                                                                {isFinishedState ? (
                                                                    <>
                                                                        <div className="relative" ref={downloadDropdownId === task.id ? downloadDropdownRef : undefined}>
                                                                            <button onClick={(e) => { e.stopPropagation(); setDownloadDropdownId(downloadDropdownId === task.id ? null : task.id); }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${isReleased ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm' : 'bg-slate-700 text-white hover:bg-slate-800 shadow-sm'}`}>
                                                                                <Download size={11} /> {isReleased ? 'Final' : 'Draft'} <ChevronDown size={10} />
                                                                            </button>
                                                                            {downloadDropdownId === task.id && (
                                                                                <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 min-w-[200px] py-1">
                                                                                    <button onClick={(e) => { e.stopPropagation(); viewReport(task, 'combined'); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2 transition-colors font-bold">
                                                                                        <Layers size={12} className="text-violet-500" /> Combined Report
                                                                                    </button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); viewReport(task, 'per-department'); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors font-bold">
                                                                                        <Building2 size={12} className="text-indigo-500" /> Per Department
                                                                                    </button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); viewReport(task, 'per-section'); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2 transition-colors font-bold">
                                                                                        <FileText size={12} className="text-teal-500" /> Per Section
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <button onClick={(e) => { e.stopPropagation(); launchAudit(task.id); }} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-violet-700 transition-all shadow-sm">
                                                                            <PenTool size={11} /> Edit
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button onClick={(e) => { e.stopPropagation(); launchAudit(task.id); }} className={`px-4 py-1.5 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all ${isInProg ? 'bg-indigo-600 hover:bg-indigo-700' : hasDraft2 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-800 hover:bg-indigo-600'}`}>
                                                                        <Play size={11} fill="currentColor" /> {isInProg ? 'Resume' : hasDraft2 ? 'Resume' : 'Start'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isInProg && task.reviewNotes && (
                                                                <div className="w-full mt-1.5 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg">
                                                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-0.5 flex items-center gap-1"><RotateCcw size={9} /> Reviewer Feedback</p>
                                                                    <p className="text-[10px] text-rose-700 leading-relaxed">{task.reviewNotes}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {dueTasks.length > 0 && (
                                    <div className="border-t border-slate-100 px-5 md:px-8 py-3 bg-amber-50/30">
                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                            <Clock size={10} className="text-amber-500" /> Due for Audit ({dueTasks.length})
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {dueTasks.map(t => (
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

                    {historyGroupedData.ungroupedTasks.length > 0 && historyGroupedData.ungroupedTasks.map((task) => {
                        const isCompleted = task.status === 'Completed';
                        const isUnderReview2 = task.status === 'Under Review';
                        const isReleased2 = task.status === 'Released';
                        return (
                            <div key={task.id} className={`bg-white rounded-[2rem] md:rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden group shadow-sm hover:shadow-2xl ${isCompleted ? 'bg-emerald-50/10 border-emerald-200' : isUnderReview2 ? 'border-amber-300 bg-amber-50/10' : isReleased2 ? 'border-violet-300 bg-violet-50/10' : 'border-slate-100'}`}>
                                <div className="hidden md:flex flex-row items-stretch divide-x divide-slate-100">
                                    <div className="p-8 w-[30%] flex items-start gap-6 relative shrink-0">
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${isCompleted ? 'bg-emerald-500' : isUnderReview2 ? 'bg-amber-500' : isReleased2 ? 'bg-violet-500' : 'bg-violet-600'}`} />
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isUnderReview2 ? 'bg-amber-100 text-amber-600' : isReleased2 ? 'bg-violet-100 text-violet-600' : 'bg-violet-100 text-violet-600'}`}>
                                            <ClipboardList size={32} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isUnderReview2 ? 'bg-amber-50 text-amber-700 border-amber-100' : isReleased2 ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                                                    {task.status}
                                                </span>
                                                {(isUnderReview2 || isReleased2) && task.reviewerName && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-violet-50 text-violet-600 border border-violet-200 flex items-center gap-1">
                                                        <Eye size={9} /> {task.reviewerName}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight truncate mb-1.5">{task.title}</h3>
                                            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                                <FileText size={14} className="text-violet-500" />
                                                {task.checklistName}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-8 w-[45%] flex flex-col gap-5 bg-slate-50/20 shrink-0">
                                        <div className="flex gap-8">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm"><Building2 size={20} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</p>
                                                    <p className="text-xs font-black text-slate-800 uppercase leading-snug">{task.unitName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm"><Clock size={20} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled</p>
                                                    <p className="text-sm font-black text-slate-800 uppercase">
                                                        {new Date(task.scheduledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {task.assignedLocations && task.assignedLocations.length > 0 ? (
                                            <div className="space-y-1.5">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10} className="text-indigo-400" /> Department / Location</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {task.assignedLocations.map(loc => {
                                                        const hasSep = loc.includes(' › ');
                                                        const dept = hasSep ? loc.split(' › ')[0] : loc;
                                                        const locName = hasSep ? loc.split(' › ')[1] : null;
                                                        return (
                                                            <span key={loc} className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                                                <Layers size={9} className="text-indigo-400" />{dept}
                                                                {locName && (<><span className="text-indigo-300">›</span><MapPin size={9} className="text-teal-500" /><span className="text-teal-700">{locName}</span></>)}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Users size={10} className="text-violet-400" /> {task.auditorName}</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <MapPin size={12} className="text-indigo-400" />
                                                <p className="text-[10px] font-bold text-slate-500 uppercase italic">{task.department}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-8 flex-1 flex flex-col justify-center items-center bg-white">
                                        <div className="w-full flex flex-col items-center gap-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-3xl font-black tracking-tighter ${(task.score ?? 0) >= 80 ? 'text-emerald-600' : (task.score ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{task.score ?? 0}%</span>
                                                {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{task.scoreObtained}/{task.scoreMax} pts</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 w-full items-center">
                                                <div className="relative w-full lg:w-auto" ref={downloadDropdownId === task.id ? downloadDropdownRef : undefined}>
                                                    <button onClick={(e) => { e.stopPropagation(); setDownloadDropdownId(downloadDropdownId === task.id ? null : task.id); }} className={`w-full lg:w-auto px-10 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${isReleased2 ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' : isUnderReview2 ? 'bg-amber-500 shadow-amber-100 hover:bg-amber-600' : 'bg-slate-700 shadow-slate-100 hover:bg-slate-800'}`}>
                                                        <Download size={14} /> {isReleased2 ? 'Download Final' : 'Download Draft'} <ChevronDown size={12} />
                                                    </button>
                                                    {downloadDropdownId === task.id && (
                                                        <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 min-w-[220px] py-1 overflow-hidden">
                                                            <button onClick={() => viewReport(task, 'combined')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2.5 transition-colors">
                                                                <Layers size={14} className="text-violet-500" /> <span className="font-bold">Combined Report</span>
                                                            </button>
                                                            <button onClick={() => viewReport(task, 'per-department')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                                                <Building2 size={14} className="text-indigo-500" /> <span className="font-bold">Per Department</span>
                                                            </button>
                                                            <button onClick={() => viewReport(task, 'per-section')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2.5 transition-colors">
                                                                <FileText size={14} className="text-teal-500" /> <span className="font-bold">Per Section</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => launchAudit(task.id)} className="w-full lg:w-auto px-8 py-2.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                                                    <PenTool size={12} /> Edit Report
                                                </button>
                                            </div>
                                            {task.lastEditedAt && (
                                                <span className="text-[8px] font-bold text-slate-300 italic">Edited {new Date(task.lastEditedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="md:hidden flex flex-col relative">
                                    <div className="p-5 flex justify-between items-start border-b border-slate-50 relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isUnderReview2 ? 'bg-amber-100 text-amber-600' : 'bg-violet-100 text-violet-600'}`}>
                                                <ClipboardList size={24} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isUnderReview2 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                                                        {task.status}
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight truncate leading-none">{task.title}</h3>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-50/30 space-y-4 relative z-10">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Checklist</p>
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                                                    <FileText size={12} className="text-violet-500" /> {task.checklistName.length > 18 ? task.checklistName.slice(0, 18) + '...' : task.checklistName}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scheduled</p>
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                                                    <Calendar size={12} className="text-violet-500" /> {new Date(task.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-2xl border shadow-inner flex items-center justify-between ${(task.score ?? 0) >= 80 ? 'bg-emerald-50 border-emerald-200' : (task.score ?? 0) >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                                            <div className={`flex items-center gap-3 ${(task.score ?? 0) >= 80 ? 'text-emerald-700' : (task.score ?? 0) >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                                                <Award size={20} />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase tracking-widest">Score</span>
                                                    {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                                        <span className="text-[9px] font-bold opacity-70">{task.scoreObtained}/{task.scoreMax} pts</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-2xl font-black ${(task.score ?? 0) >= 80 ? 'text-emerald-600' : (task.score ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{task.score ?? 0}%</span>
                                        </div>
                                    </div>
                                    <div className="p-5 border-t border-slate-100 bg-white relative z-10">
                                        <button 
                                            onClick={() => isReleased2 ? launchAudit(task.id) : viewReport(task, 'combined')}
                                            className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${isCompleted ? 'bg-emerald-600 text-white' : isUnderReview2 ? 'bg-amber-500 text-white' : 'bg-violet-600 text-white'}`}
                                        >
                                            {isUnderReview2 ? (<><Download size={16} /> Download Report</>) : isReleased2 ? (<><PenTool size={16} /> Edit Report</>) : (<><Download size={16} /> Download Report</>)}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {historyGroupedData.groups.length === 0 && historyGroupedData.ungroupedTasks.length === 0 && (
                        <div className="py-40 text-center flex flex-col items-center justify-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-slate-200 shadow-inner ring-8 ring-slate-50/50">
                                <Archive size={48} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">No Completed Audits</h3>
                            <p className="text-slate-400 text-xs mt-3 font-bold uppercase tracking-[0.3em] max-w-sm leading-relaxed">
                                Completed audits will appear here after submission.
                            </p>
                            <button onClick={() => setViewMode('active')} className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-600 transition-all shadow-xl">View Active Audits</button>
                        </div>
                    )}
                </div>
            ) : (
            <div className="flex flex-col gap-6">
                {filteredTasks.length > 0 ? filteredTasks.map((task) => {
                    const isOverdue = task.status === 'Overdue';
                    const isInProgress = task.status === 'In Progress';
                    const isCompleted = task.status === 'Completed';
                    const isUnderReview2 = task.status === 'Under Review';
                    const isReleased2 = task.status === 'Released';
                    const isFinished2 = isCompleted || isUnderReview2 || isReleased2;
                    const taskDraftKey = task.id;
                    const draftInfo = !isFinished2 ? getDraftInfo(taskDraftKey) : null;
                    const hasDraft = !!draftInfo;
                    
                    return (
                        <div key={task.id} className={`bg-white rounded-[2rem] md:rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden group shadow-sm hover:shadow-2xl ${isCompleted ? 'bg-emerald-50/10 border-emerald-200' : isUnderReview2 ? 'border-amber-300 bg-amber-50/10' : isReleased2 ? 'border-violet-300 bg-violet-50/10' : isInProgress ? 'border-amber-400' : isOverdue ? 'border-rose-300' : 'border-slate-100 hover:border-violet-200'}`}>
                            
                            <div className="hidden md:flex flex-row items-stretch divide-x divide-slate-100">
                                
                                <div className="p-8 w-[30%] flex items-start gap-6 relative shrink-0">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-500 ${isCompleted ? 'bg-emerald-500' : isUnderReview2 ? 'bg-amber-500' : isReleased2 ? 'bg-violet-500' : isInProgress ? 'bg-amber-500' : isOverdue ? 'bg-rose-500' : 'bg-violet-600'}`} />
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform shadow-lg ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isUnderReview2 ? 'bg-amber-100 text-amber-600' : isReleased2 ? 'bg-violet-100 text-violet-600' : isInProgress ? 'bg-amber-100 text-amber-600' : isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-violet-100 text-violet-600'}`}>
                                        <ClipboardList size={32} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isUnderReview2 ? 'bg-amber-50 text-amber-700 border-amber-100' : isReleased2 ? 'bg-violet-50 text-violet-700 border-violet-100' : isInProgress ? 'bg-amber-50 text-amber-700 border-amber-100' : isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                                                    {task.status}
                                                </span>
                                                {(isUnderReview2 || isReleased2) && task.reviewerName && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase bg-violet-50 text-violet-600 border border-violet-200 flex items-center gap-1">
                                                        <Eye size={9} /> {task.reviewerName}
                                                    </span>
                                                )}
                                                {hasDraft && (
                                                    <span className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1" title={`Draft saved: ${draftInfo ? draftInfo.answeredCount : 0} questions answered`}>
                                                        <FileText size={9} /> Draft
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {isCompleted && <button className="p-2 text-slate-200 hover:text-slate-400" title="Archive"><Archive size={14}/></button>}
                                                {onTaskDelete && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete this ${isCompleted ? 'audit report' : 'planned audit'}? This action cannot be undone.`)) { onTaskDelete(task.id); } }}
                                                        className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight truncate mb-1.5 group-hover:text-violet-600 transition-colors">{task.title}</h3>
                                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <FileText size={14} className="text-violet-500" />
                                            {task.checklistName}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 w-[45%] flex flex-col gap-5 bg-slate-50/20 shrink-0">
                                    <div className="flex gap-8">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm group-hover:text-violet-600 transition-colors"><Building2 size={20} /></div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</p>
                                                <p className="text-xs font-black text-slate-800 uppercase leading-snug">{task.unitName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm group-hover:text-violet-600 transition-colors"><Clock size={20} /></div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled</p>
                                                <p className="text-sm font-black text-slate-800 uppercase">
                                                    {new Date(task.scheduledDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </p>
                                                {task.createdAt && (
                                                    <p className="text-[9px] font-bold text-slate-300 mt-0.5">Created {new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {task.assignedLocations && task.assignedLocations.length > 0 ? (
                                        <div className="space-y-1.5">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10} className="text-indigo-400" /> Department / Location</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {task.assignedLocations.map(loc => {
                                                    const hasSep = loc.includes(' › ');
                                                    const dept = hasSep ? loc.split(' › ')[0] : loc;
                                                    const locName = hasSep ? loc.split(' › ')[1] : null;
                                                    return (
                                                        <span key={loc} className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                                            <Layers size={9} className="text-indigo-400" />{dept}
                                                            {locName && (<><span className="text-indigo-300">›</span><MapPin size={9} className="text-teal-500" /><span className="text-teal-700">{locName}</span></>)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Users size={10} className="text-violet-400" /> {task.auditorName}</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <MapPin size={12} className="text-indigo-400" />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase italic">{task.department}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 flex-1 flex flex-col justify-center items-center bg-white">
                                    {isFinished2 ? (
                                        <div className="w-full flex flex-col items-center gap-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-3xl font-black tracking-tighter ${(task.score ?? 0) >= 80 ? 'text-emerald-600' : (task.score ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{task.score ?? 0}%</span>
                                                {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{task.scoreObtained}/{task.scoreMax} pts</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 w-full items-center">
                                                <div className="relative w-full lg:w-auto" ref={downloadDropdownId === task.id ? downloadDropdownRef : undefined}>
                                                    <button onClick={() => setDownloadDropdownId(downloadDropdownId === task.id ? null : task.id)} className={`w-full lg:w-auto px-10 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${isReleased2 ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' : isUnderReview2 ? 'bg-amber-500 shadow-amber-100 hover:bg-amber-600' : 'bg-slate-700 shadow-slate-100 hover:bg-slate-800'}`}>
                                                        <Download size={14} /> {isReleased2 ? 'Download Final' : 'Download Draft'} <ChevronDown size={12} />
                                                    </button>
                                                    {downloadDropdownId === task.id && (
                                                        <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 min-w-[220px] py-1 overflow-hidden">
                                                            <button onClick={() => viewReport(task, 'combined')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2.5 transition-colors">
                                                                <Layers size={14} className="text-violet-500" /> <span className="font-bold">Combined Report</span>
                                                            </button>
                                                            <button onClick={() => viewReport(task, 'per-department')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                                                <Building2 size={14} className="text-indigo-500" /> <span className="font-bold">Per Department</span>
                                                            </button>
                                                            <button onClick={() => viewReport(task, 'per-section')} className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-2.5 transition-colors">
                                                                <FileText size={14} className="text-teal-500" /> <span className="font-bold">Per Section</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => launchAudit(task.id)} className="w-full lg:w-auto px-8 py-2.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-violet-100 hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                                                    <PenTool size={12} /> Edit Report
                                                </button>
                                            </div>
                                            {task.lastEditedAt && (
                                                <span className="text-[8px] font-bold text-slate-300 italic">Edited {new Date(task.lastEditedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            )}
                                        </div>
                                    ) : isInProgress ? (
                                        <div className="w-full space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Progress</span>
                                                    <span className="text-2xl font-black text-violet-600 tracking-tighter">{task.progress}%</span>
                                                </div>
                                                <button 
                                                    onClick={() => launchAudit(task.id)}
                                                    className="px-8 py-3.5 bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-violet-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    Resume <ChevronRight size={14} strokeWidth={3} />
                                                </button>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                <div className="h-full bg-violet-600 transition-all duration-1000 shadow-[0_0_10px_rgba(124,58,237,0.5)]" style={{ width: `${task.progress}%` }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-2">
                                            <button 
                                                onClick={() => launchAudit(task.id)}
                                                className={`w-full px-12 py-5 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 group ${hasDraft ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-slate-900 hover:bg-violet-600'}`}
                                            >
                                                <Play size={20} fill="currentColor" className="group-hover:translate-x-0.5 transition-transform" /> 
                                                <span>{hasDraft ? 'Resume Audit' : 'Start Audit'}</span>
                                            </button>
                                            {hasDraft && draftInfo && (
                                                <p className="text-[9px] font-bold text-amber-500 text-center uppercase tracking-wider">
                                                    {draftInfo.answeredCount} question{draftInfo.answeredCount !== 1 ? 's' : ''} answered &bull; Saved {new Date(draftInfo.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="md:hidden flex flex-col relative">
                                {isCompleted && (
                                    <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
                                        <ShieldCheck size={140} className="rotate-12" />
                                    </div>
                                )}
                                <div className="p-5 flex justify-between items-start border-b border-slate-50 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isInProgress ? 'bg-amber-100 text-amber-600' : isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-violet-100 text-violet-600'}`}>
                                            <ClipboardList size={24} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isInProgress ? 'bg-amber-50 text-amber-700 border-amber-100' : isOverdue ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight truncate leading-none">{task.title}</h3>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 relative z-20">
                                        {onTaskDelete && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete this ${isCompleted ? 'audit report' : 'planned audit'}? This action cannot be undone.`)) { onTaskDelete(task.id); } }}
                                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <div className="p-2 bg-slate-50 rounded-xl text-slate-300">
                                            <MoreVertical size={16} />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 bg-slate-50/30 space-y-4 relative z-10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Checklist</p>
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                                                <FileText size={12} className="text-violet-500" /> {task.checklistName.length > 18 ? task.checklistName.slice(0, 18) + '...' : task.checklistName}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scheduled</p>
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase">
                                                <Calendar size={12} className="text-violet-500" /> {new Date(task.scheduledDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                            </div>
                                            {task.createdAt && (
                                                <p className="text-[8px] font-bold text-slate-300">Created {new Date(task.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</p>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                                <MapPin size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-slate-800 uppercase truncate leading-none mb-1">{task.unitName}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate flex items-center gap-1"><Users size={10} className="text-violet-400" /> {task.auditorName}</p>
                                            </div>
                                        </div>
                                        {task.assignedLocations && task.assignedLocations.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {task.assignedLocations.map(loc => {
                                                    const hasSep = loc.includes(' › ');
                                                    const dept = hasSep ? loc.split(' › ')[0] : loc;
                                                    const locName = hasSep ? loc.split(' › ')[1] : null;
                                                    return (
                                                        <span key={loc} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-bold rounded border border-indigo-100 flex items-center gap-0.5">
                                                            <Layers size={8} className="text-indigo-400" />{dept}
                                                            {locName && (<><span className="text-indigo-300 mx-0.5">›</span><MapPin size={8} className="text-teal-500" /><span className="text-teal-700">{locName}</span></>)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {isFinished2 ? (
                                        <div className={`p-4 rounded-2xl border shadow-inner flex items-center justify-between ${(task.score ?? 0) >= 80 ? 'bg-emerald-50 border-emerald-200' : (task.score ?? 0) >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                                            <div className={`flex items-center gap-3 ${(task.score ?? 0) >= 80 ? 'text-emerald-700' : (task.score ?? 0) >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                                                <Award size={20} />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black uppercase tracking-widest">Score</span>
                                                    {task.scoreObtained !== undefined && task.scoreMax !== undefined && (
                                                        <span className="text-[9px] font-bold opacity-70">{task.scoreObtained}/{task.scoreMax} pts</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`text-2xl font-black ${(task.score ?? 0) >= 80 ? 'text-emerald-600' : (task.score ?? 0) >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{task.score ?? 0}%</span>
                                        </div>
                                    ) : isInProgress && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[10px] font-black px-1">
                                                <span className="text-slate-400 uppercase tracking-widest">Progress</span>
                                                <span className="text-violet-600">{task.progress}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-600" style={{ width: `${task.progress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 border-t border-slate-100 bg-white relative z-10">
                                    <button 
                                        onClick={() => isFinished2 ? (isReleased2 ? launchAudit(task.id) : viewReport(task, 'combined')) : launchAudit(task.id)}
                                        className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${isCompleted ? 'bg-emerald-600 text-white shadow-emerald-100' : isUnderReview2 ? 'bg-amber-500 text-white shadow-amber-100' : isReleased2 ? 'bg-violet-600 text-white shadow-violet-100' : isInProgress ? 'bg-violet-600 text-white shadow-violet-100' : hasDraft ? 'bg-amber-600 text-white shadow-amber-100' : isOverdue ? 'bg-rose-600 text-white shadow-rose-100' : 'bg-slate-900 text-white shadow-slate-200'}`}
                                    >
                                        {isUnderReview2 ? (
                                            <><Eye size={16} /> View Report</>
                                        ) : isReleased2 ? (
                                            <><PenTool size={16} /> Edit Report</>
                                        ) : isCompleted ? (
                                            <><Eye size={16} /> View Report</>
                                        ) : isInProgress ? (
                                            <>Resume Audit <ChevronRight size={16} strokeWidth={3}/></>
                                        ) : hasDraft ? (
                                            <>Resume Audit <Play size={16} fill="currentColor" strokeWidth={3}/></>
                                        ) : (
                                            <>Start Audit <Play size={16} fill="currentColor" strokeWidth={3}/></>
                                        )}
                                    </button>
                                    {hasDraft && draftInfo && !isFinished2 && !isInProgress && (
                                        <p className="text-[8px] font-bold text-amber-500 text-center mt-2 uppercase tracking-wider px-2">
                                            {draftInfo.answeredCount} answered &bull; Saved {new Date(draftInfo.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                            </div>

                        </div>
                    );
                }) : (
                    <div className="col-span-full py-40 text-center flex flex-col items-center justify-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-slate-200 shadow-inner ring-8 ring-slate-50/50">
                            <Target size={48} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">No Active Audits</h3>
                        <p className="text-slate-400 text-xs mt-3 font-bold uppercase tracking-[0.3em] max-w-sm leading-relaxed">
                            Schedule an audit from the Audit Forms or Schedule tab to get started.
                        </p>
                    </div>
                )}
            </div>
            )}

            {showReviewSignatureModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReviewSignatureModal(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-tight">Release Audit</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Reviewer Name</label>
                                <input type="text" value={reviewerNameInput} onChange={e => setReviewerNameInput(e.target.value)} className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-violet-300" placeholder="Your name" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Signature</label>
                                <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                                    <canvas ref={initReviewSignatureCanvas} width={400} height={150} className="w-full touch-none cursor-crosshair" style={{ height: 120 }} />
                                </div>
                                <button onClick={() => { const c = reviewSignatureCanvasRef.current; if (c) { const ctx = c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, c.width, c.height); } setReviewerSignature(''); }} className="text-[9px] font-bold text-slate-400 mt-1 hover:text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                    Clear signature
                                </button>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button onClick={() => setShowReviewSignatureModal(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={() => handleReleaseAudit(showReviewSignatureModal)} disabled={!reviewerSignature} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                                    <Send size={12} /> Release
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {sendBackTaskId && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSendBackTaskId(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-tight">Send Back for Revision</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Notes for Auditor</label>
                                <textarea value={sendBackNotes} onChange={e => setSendBackNotes(e.target.value)} rows={4} className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-violet-300 resize-none" placeholder="Explain what needs to be corrected..." />
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button onClick={() => setSendBackTaskId(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={() => handleSendBack(sendBackTaskId)} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5">
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

export default AuditorLaunchpad;
