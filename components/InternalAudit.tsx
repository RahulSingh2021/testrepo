"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Shield, CalendarRange, ClipboardList, Zap } from 'lucide-react';
import { Entity, HierarchyScope, MandatoryProtocol, AuditTask } from '../types';
import AuditSchedule from './AuditSchedule';
import type { UnitScheduleData } from './AuditSchedule';
import ChecklistEditor from './ChecklistEditor';
import AuditorLaunchpad from './AuditorLaunchpad';
import type { ChecklistTemplate } from './AuditChecklistCreator';
import { flushAuditReportsToDb } from './AuditChecklistPreview';


export interface ScheduledAuditShared {
  id: string;
  unitId?: string;
  checklistId: string;
  checklistTitle: string;
  scheduledDate: string;
  dueDate: string;
  locations: {
    locationId: string;
    locationName: string;
    department: string;
    assignedTeam: string[];
    status: 'Scheduled' | 'In Progress' | 'Completed';
    startedAt?: string;
    completedAt?: string;
    score?: number;
    notes?: string;
  }[];
  overallStatus: 'Scheduled' | 'In Progress' | 'Completed';
  createdAt: string;
  notes?: string;
}

interface InternalAuditProps {
  entities: Entity[];
  currentScope: HierarchyScope;
  userRootId?: string | null;
  userName?: string;
  protocols: MandatoryProtocol[];
  setProtocols: React.Dispatch<React.SetStateAction<MandatoryProtocol[]>>;
  sopNames?: string[];
  sopSubTopics?: Record<string, string[]>;
  locationNames?: string[];
  departmentNames?: string[];
  departmentLocations?: Record<string, string[]>;
  onAuditTasksChange?: (tasks: AuditTask[]) => void;
}

const TABS = [
  { id: 'schedule', label: 'Schedule', icon: CalendarRange },
  { id: 'forms', label: 'Audit Forms', icon: ClipboardList },
  { id: 'audits', label: 'Audits', icon: Zap },
] as const;

type TabId = (typeof TABS)[number]['id'];

const InternalAudit: React.FC<InternalAuditProps> = ({
  entities, currentScope, userRootId, userName, protocols, setProtocols, sopNames = [], sopSubTopics = {}, locationNames = [], departmentNames = [], departmentLocations = {}, onAuditTasksChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [scheduledAudits, setScheduledAudits] = useState<ScheduledAuditShared[]>([]);
  const [completedAuditReports, setCompletedAuditReports] = useState<AuditTask[]>([]);
  const scheduledChecklistIds = useMemo(() =>
    new Set(checklists.filter(c => c.scheduledChecklist).map(c => c.id)),
  [checklists]);

  const directAssignChecklistIds = useMemo(() =>
    new Set(checklists.filter(c => c.directAssigned).map(c => c.id)),
  [checklists]);

  const [unitSchedules, setUnitSchedules] = useState<UnitScheduleData[]>([]);

  const scopeEntityIds = useMemo(() => {
    if (currentScope === 'super-admin' || !userRootId) return null;
    const getDescendantIds = (parentId: string): string[] => {
      const children = entities.filter(e => e.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    return new Set([userRootId, ...getDescendantIds(userRootId)]);
  }, [entities, currentScope, userRootId]);

  const scopeEntitySlugs = useMemo(() => {
    if (!scopeEntityIds) return null;
    const slugs = new Set<string>();
    scopeEntityIds.forEach(id => {
      slugs.add(id);
      const ent = entities.find(e => e.id === id);
      if (ent?.name) slugs.add(ent.name.toLowerCase().replace(/\s+/g, '-'));
    });
    slugs.add('direct');
    return slugs;
  }, [scopeEntityIds, entities]);

  const isInScope = useCallback((unitId: string) => {
    if (!scopeEntitySlugs || !unitId) return false;
    if (scopeEntitySlugs.has(unitId)) return true;
    const trimmed = unitId.replace(/-+$/, '');
    if (trimmed !== unitId && scopeEntitySlugs.has(trimmed)) return true;
    return false;
  }, [scopeEntitySlugs]);

  // Build entity hierarchy from userRootId up to corporate level (for fetching checklists)
  const getEntityHierarchy = useCallback((): string[] => {
    if (!userRootId) return [];
    const hierarchy: string[] = [userRootId];
    let current = entities.find(e => e.id === userRootId);
    while (current?.parentId) {
      hierarchy.push(current.parentId);
      current = entities.find(e => e.id === current!.parentId);
    }
    return hierarchy;
  }, [userRootId, entities]);

  const dbLoaded = useRef(false);
  const [dbReady, setDbReady] = useState(false);
  const initialLoadDone = useRef(false);
  const loadedRootRef = useRef<string | null>(null);
  const checklistSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unitScheduleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Run the DB load once per impersonated root. Re-firing on every entities
    // re-render races the 1500ms debounced save and wipes in-flight edits
    // (e.g. a freshly-scheduled audit period) — see task #165.
    const rootKey = userRootId || '__none__';
    if (loadedRootRef.current === rootKey) return;
    loadedRootRef.current = rootKey;
    let cancelled = false;
    const load = async () => {
      try {
        let checklistsUrl = '/api/audit-checklists';
        if (userRootId) {
          const hierarchy = getEntityHierarchy();
          checklistsUrl = `/api/audit-checklists?entityId=${encodeURIComponent(userRootId)}&entityHierarchy=${encodeURIComponent(hierarchy.join(','))}`;
        }
        const [clResp, saResp, atResp, usResp] = await Promise.all([
          fetch(checklistsUrl),
          fetch('/api/audit-schedules'),
          fetch('/api/audit-tasks?slim=1'),
          fetch('/api/audit-unit-schedules'),
        ]);
        if (cancelled) return;
        if (clResp.ok) {
          const clRes = await clResp.json();
          if (Array.isArray(clRes) && clRes.length > 0) {
            setChecklists(prev => {
              const dbMap = new Map(clRes.map((c: ChecklistTemplate) => [c.id, c]));
              const merged = clRes.map((c: ChecklistTemplate) => c);
              prev.forEach(c => {
                if (!dbMap.has(c.id)) merged.push(c);
              });
              return merged;
            });
          }
        }
        if (saResp.ok) {
          const saRes = await saResp.json();
          if (Array.isArray(saRes)) setScheduledAudits(saRes);
        }
        if (atResp.ok) {
          const atRes = await atResp.json();
          if (Array.isArray(atRes) && atRes.length > 0) setCompletedAuditReports(atRes);
        }
        if (usResp.ok) {
          const usRes = await usResp.json();
          // Honor the empty-array result so deletions persist across reloads.
          // Stale state was previously revived because of a length>0 short-circuit (task #165).
          if (Array.isArray(usRes)) setUnitSchedules(usRes);
        }
        if (cancelled) return;
      } catch (e) {
        console.error('Failed to load audit data from DB:', e);
      }
      if (!cancelled) {
        dbLoaded.current = true;
        initialLoadDone.current = true;
        setDbReady(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userRootId, getEntityHierarchy]);

  const doSave = useCallback((url: string, items: any[], idKey = 'id') => {
    const valid = items.filter(i => i[idKey]);
    if (valid.length === 0) return;
    const payload = idKey !== 'id' ? valid.map(u => ({ id: u[idKey], ...u })) : valid;
    fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(e => console.error(`Failed to save to ${url}:`, e));
  }, []);

  const saveChecklists = useCallback((items: ChecklistTemplate[]) => {
    if (!dbLoaded.current) return;
    if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
    checklistSaveTimer.current = setTimeout(() => doSave('/api/audit-checklists', items), 1500);
  }, [doSave]);

  const saveSchedules = useCallback((items: ScheduledAuditShared[]) => {
    if (!dbLoaded.current) return;
    if (scheduleSaveTimer.current) clearTimeout(scheduleSaveTimer.current);
    scheduleSaveTimer.current = setTimeout(() => doSave('/api/audit-schedules', items), 1500);
  }, [doSave]);

  const saveTasks = useCallback((items: AuditTask[]) => {
    if (!dbLoaded.current) return;
    if (taskSaveTimer.current) clearTimeout(taskSaveTimer.current);
    taskSaveTimer.current = setTimeout(() => doSave('/api/audit-tasks', items), 1500);
  }, [doSave]);

  const saveUnitSchedules = useCallback((items: UnitScheduleData[]) => {
    if (!dbLoaded.current) return;
    if (unitScheduleSaveTimer.current) clearTimeout(unitScheduleSaveTimer.current);
    unitScheduleSaveTimer.current = setTimeout(() => doSave('/api/audit-unit-schedules', items, 'unitId'), 1500);
  }, [doSave]);

  const flushAllAuditDataNow = useCallback(() => {
    if (!dbLoaded.current) return;
    if (unitScheduleSaveTimer.current) clearTimeout(unitScheduleSaveTimer.current);
    if (scheduleSaveTimer.current) clearTimeout(scheduleSaveTimer.current);
    if (taskSaveTimer.current) clearTimeout(taskSaveTimer.current);
    if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
    doSave('/api/audit-unit-schedules', unitSchedulesRef.current, 'unitId');
    doSave('/api/audit-schedules', scheduledAuditsRef.current);
    doSave('/api/audit-tasks', completedReportsRef.current);
    doSave('/api/audit-checklists', checklistsRef.current);
  }, [doSave]);

  useEffect(() => { saveChecklists(checklists); }, [checklists, saveChecklists]);
  useEffect(() => { saveSchedules(scheduledAudits); }, [scheduledAudits, saveSchedules]);
  useEffect(() => { saveTasks(completedAuditReports); }, [completedAuditReports, saveTasks]);

  const scopedCompletedReports = useMemo(() => {
    if (!scopeEntitySlugs) return [];
    return completedAuditReports.filter(t => isInScope(t.unitId));
  }, [completedAuditReports, scopeEntitySlugs, isInScope]);

  useEffect(() => {
    if (onAuditTasksChange) onAuditTasksChange(scopedCompletedReports);
  }, [scopedCompletedReports, onAuditTasksChange]);
  useEffect(() => { saveUnitSchedules(unitSchedules); }, [unitSchedules, saveUnitSchedules]);

  const checklistsRef = useRef(checklists);
  const scheduledAuditsRef = useRef(scheduledAudits);
  const completedReportsRef = useRef(completedAuditReports);
  const unitSchedulesRef = useRef(unitSchedules);
  checklistsRef.current = checklists;
  scheduledAuditsRef.current = scheduledAudits;
  completedReportsRef.current = completedAuditReports;
  unitSchedulesRef.current = unitSchedules;

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!dbLoaded.current) return;
      const flushSave = (url: string, items: any[], idKey = 'id') => {
        const valid = items.filter(i => i[idKey]);
        if (valid.length === 0) return;
        const payload = idKey !== 'id' ? valid.map(u => ({ id: u[idKey], ...u })) : valid;
        try { navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' })); } catch {
          fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
        }
      };
      flushSave('/api/audit-checklists', checklistsRef.current);
      flushSave('/api/audit-schedules', scheduledAuditsRef.current);
      flushSave('/api/audit-tasks', completedReportsRef.current);
      flushSave('/api/audit-unit-schedules', unitSchedulesRef.current, 'unitId');
      flushAuditReportsToDb();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
      if (scheduleSaveTimer.current) clearTimeout(scheduleSaveTimer.current);
      if (taskSaveTimer.current) clearTimeout(taskSaveTimer.current);
      if (unitScheduleSaveTimer.current) clearTimeout(unitScheduleSaveTimer.current);
      handleBeforeUnload();
    };
  }, []);


  const checklistNames = useMemo(() => checklists.map(c => c.title), [checklists]);
  const scheduledChecklistNames = useMemo(() =>
    checklists.filter(c => scheduledChecklistIds.has(c.id)).map(c => c.title),
  [checklists, scheduledChecklistIds]);
  const scheduledChecklistTemplates = useMemo(() =>
    checklists.filter(c => scheduledChecklistIds.has(c.id)).map(c => ({ id: c.id, title: c.title, pages: c.pages.map(p => ({ id: p.id, title: p.title })) })),
  [checklists, scheduledChecklistIds]);

  const toggleScheduledChecklist = useCallback((checklistId: string) => {
    setChecklists(prev => {
      const updated = prev.map(c =>
        c.id === checklistId ? { ...c, scheduledChecklist: !c.scheduledChecklist } : c
      );
      saveChecklists(updated);
      return updated;
    });
  }, [saveChecklists]);

  const toggleDirectAssignChecklist = useCallback((checklistId: string) => {
    setChecklists(prev => {
      const updated = prev.map(c =>
        c.id === checklistId ? { ...c, directAssigned: !c.directAssigned } : c
      );
      saveChecklists(updated);
      return updated;
    });
  }, [saveChecklists]);

  const observationChecklistIds = useMemo(() =>
    new Set(checklists.filter(c => c.observationLinked).map(c => c.id)),
  [checklists]);

  const toggleObservationChecklist = useCallback((checklistId: string) => {
    setChecklists(prev => {
      const updated = prev.map(c =>
        c.id === checklistId ? { ...c, observationLinked: !c.observationLinked } : c
      );
      saveChecklists(updated);
      return updated;
    });
  }, [saveChecklists]);

  const directAssignChecklists = useMemo(() =>
    checklists.filter(c => directAssignChecklistIds.has(c.id)),
  [checklists, directAssignChecklistIds]);

  const assignedTasks: AuditTask[] = useMemo(() => {
    if (!scopeEntitySlugs) return [];
    const tasks: AuditTask[] = [];
    scheduledAudits.forEach(sa => {
      sa.locations.forEach(loc => {
        loc.assignedTeam.forEach(auditorName => {
          tasks.push({
            id: `${sa.id}-${loc.locationId}-${auditorName.replace(/\s+/g, '-')}`,
            title: sa.checklistTitle,
            unitId: loc.locationId,
            unitName: loc.locationName,
            department: loc.department || 'General',
            auditorId: auditorName.toLowerCase().replace(/\s+/g, '-'),
            auditorName: auditorName,
            scheduledDate: sa.scheduledDate,
            status: loc.status === 'Completed' ? 'Completed' : loc.status === 'In Progress' ? 'In Progress' : 'Scheduled',
            progress: loc.status === 'Completed' ? 100 : loc.status === 'In Progress' ? 50 : 0,
            checklistId: sa.checklistId,
            checklistName: sa.checklistTitle,
            questions: [],
            startTime: loc.startedAt,
            endTime: loc.completedAt,
          });
        });
      });
    });
    return tasks;
  }, [scheduledAudits, scopeEntitySlugs]);

  const publishedScheduleTasks: AuditTask[] = useMemo(() => {
    const tasks: AuditTask[] = [];
    try {
    unitSchedules.forEach(unit => {
      if (!unit || !unit.periods) return;
      unit.periods.forEach(period => {
        if (!period || period.status !== 'PUBLISHED' || !period.audits) return;
        period.audits.forEach(audit => {
          if (!audit || !audit.id) return;
          const groupId = audit.id;
          const checklistName = audit.checklist || audit.scope || '';
          const matchedChecklist = checklists.find(c => c.title === checklistName);
          const checklistId = matchedChecklist?.id || (checklistName ? checklistName.toLowerCase().replace(/\s+/g, '-') : audit.id);

          if (audit.locationAssignments && audit.locationAssignments.length > 0) {
            const allAuditors = new Set<string>();
            const allAssigned = audit.locationAssignments.every(la => (la.assignedAuditors || []).length > 0);
            audit.locationAssignments.forEach(la => (la.assignedAuditors || []).forEach(a => allAuditors.add(a)));
            const isSingle = allAssigned && allAuditors.size === 1 && audit.locationAssignments.length > 1;

            if (isSingle) {
              const auditorName = Array.from(allAuditors)[0];
              const allLocs = audit.locationAssignments.map(la => la.locationName);
              tasks.push({
                id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}-combined`,
                title: checklistName,
                unitId: unit.unitId,
                unitName: unit.unitName,
                department: allLocs.join(', '),
                auditorId: auditorName.toLowerCase().replace(/\s+/g, '-'),
                auditorName,
                scheduledDate: audit.startDate || '',
                status: 'Scheduled',
                progress: 0,
                checklistId,
                checklistName,
                questions: [],
                groupId,
                assignedLocations: allLocs,
                isCombinedAudit: true,
                createdAt: audit.createdAt || new Date().toISOString(),
                reviewerName: audit.reviewer,
                reviewRequired: audit.reviewRequired !== false,
              });
            } else {
              audit.locationAssignments.forEach(la => {
                (la.assignedAuditors || []).forEach(auditorName => {
                  tasks.push({
                    id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}-${la.locationName.replace(/[^a-zA-Z0-9]/g, '-')}`,
                    title: checklistName,
                    unitId: unit.unitId,
                    unitName: unit.unitName,
                    department: la.locationName || '',
                    auditorId: auditorName.toLowerCase().replace(/\s+/g, '-'),
                    auditorName,
                    scheduledDate: audit.startDate || '',
                    status: 'Scheduled',
                    progress: 0,
                    checklistId,
                    checklistName,
                    questions: [],
                    groupId,
                    assignedLocations: [la.locationName],
                    createdAt: audit.createdAt || new Date().toISOString(),
                    reviewerName: audit.reviewer,
                    reviewRequired: audit.reviewRequired !== false,
                  });
                });
              });
            }
          } else {
            (audit.auditTeam || []).forEach(auditorName => {
              tasks.push({
                id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}`,
                title: checklistName,
                unitId: unit.unitId,
                unitName: unit.unitName,
                department: (audit.departments || []).join(', '),
                auditorId: auditorName.toLowerCase().replace(/\s+/g, '-'),
                auditorName,
                scheduledDate: audit.startDate || '',
                status: 'Scheduled',
                progress: 0,
                checklistId,
                checklistName,
                questions: [],
                groupId,
                createdAt: audit.createdAt || new Date().toISOString(),
                reviewerName: audit.reviewer,
                reviewRequired: audit.reviewRequired !== false,
              });
            });
          }
        });
      });
    });
    } catch (e) {
      console.error('Error generating tasks from published schedules:', e);
    }
    return tasks;
  }, [unitSchedules, checklists]);

  const allMyTasks = useMemo(() => {
    if (!scopeEntitySlugs) return [];
    const taskMap = new Map<string, AuditTask>();
    completedAuditReports.forEach(t => {
      if (isInScope(t.unitId)) taskMap.set(t.id, t);
    });
    assignedTasks.forEach(t => {
      if (!isInScope(t.unitId)) return;
      const existing = taskMap.get(t.id);
      if (!existing || (existing.status !== 'Completed' && existing.status !== 'In Progress' && existing.status !== 'Under Review' && existing.status !== 'Released')) {
        taskMap.set(t.id, t);
      }
    });
    publishedScheduleTasks.forEach(t => {
      if (!isInScope(t.unitId)) return;
      if (!taskMap.has(t.id)) taskMap.set(t.id, t);
    });
    return Array.from(taskMap.values());
  }, [assignedTasks, completedAuditReports, publishedScheduleTasks, scopeEntitySlugs, isInScope]);

  const scopedUnitSchedules = useMemo(() => {
    if (!scopeEntitySlugs) return [];
    return unitSchedules.filter(u => isInScope(u.unitId));
  }, [unitSchedules, scopeEntitySlugs, isInScope]);

  const scopedScheduledAudits = useMemo(() => {
    if (!scopeEntitySlugs) return [];
    return scheduledAudits.filter(sa =>
      (sa.unitId && isInScope(sa.unitId)) || sa.locations.some(loc => loc.locationId && isInScope(loc.locationId))
    );
  }, [scheduledAudits, scopeEntitySlugs, isInScope]);

  const scopedSetUnitSchedules = useCallback((updater: React.SetStateAction<UnitScheduleData[]>) => {
    setUnitSchedules(prev => {
      const scopedPrev = prev.filter(u => isInScope(u.unitId));
      const outOfScope = prev.filter(u => !isInScope(u.unitId));
      const newScoped = typeof updater === 'function' ? updater(scopedPrev) : updater;
      return [...outOfScope, ...newScoped];
    });
  }, [isInScope]);

  const scopedSetScheduledAudits = useCallback((updater: React.SetStateAction<ScheduledAuditShared[]>) => {
    setScheduledAudits(prev => {
      const checkScope = (sa: ScheduledAuditShared) => (sa.unitId && isInScope(sa.unitId)) || sa.locations.some(l => l.locationId && isInScope(l.locationId));
      const scopedPrev = prev.filter(checkScope);
      const outOfScope = prev.filter(sa => !checkScope(sa));
      const newScoped = typeof updater === 'function' ? updater(scopedPrev) : updater;
      return [...outOfScope, ...newScoped];
    });
  }, [isInScope]);

  const pendingReviewCount = useMemo(() => {
    return allMyTasks.filter(t => t.reviewerName === userName && t.status === 'Under Review').length;
  }, [allMyTasks, userName]);

  const handleDirectAssign = (checklist: ChecklistTemplate) => {
    const newTask: AuditTask = {
      id: `direct-${checklist.id}-${Date.now()}`,
      title: checklist.title,
      unitId: 'direct',
      unitName: 'Direct Assignment',
      department: checklist.department || 'Quality Assurance',
      auditorId: 'current-user',
      auditorName: 'Current User',
      scheduledDate: new Date().toISOString().split('T')[0],
      status: 'Scheduled',
      progress: 0,
      checklistId: checklist.id,
      checklistName: checklist.title,
      questions: [],
    };
    setCompletedAuditReports(prev => [newTask, ...prev]);
    setActiveTab('audits');
  };

  const handlePublishAudits = (tasks: { id: string; title: string; unitName: string; department: string; auditorName: string; scheduledDate: string; endDate: string; checklistName: string; groupId?: string; assignedLocations?: string[]; isCombinedAudit?: boolean; createdAt?: string; reviewer?: string; reviewRequired?: boolean }[]) => {
    const newTasks: AuditTask[] = tasks.map(t => {
      const matchedChecklist = checklists.find(c => c.title === t.checklistName);
      return {
        id: t.id,
        title: t.title,
        unitId: t.unitName.toLowerCase().replace(/\s+/g, '-'),
        unitName: t.unitName,
        department: t.department,
        auditorId: t.auditorName.toLowerCase().replace(/\s+/g, '-'),
        auditorName: t.auditorName,
        scheduledDate: t.scheduledDate,
        status: 'Scheduled' as const,
        progress: 0,
        checklistId: matchedChecklist?.id || t.checklistName.toLowerCase().replace(/\s+/g, '-'),
        checklistName: t.checklistName,
        questions: [],
        groupId: t.groupId,
        assignedLocations: t.assignedLocations,
        isCombinedAudit: t.isCombinedAudit,
        createdAt: t.createdAt || new Date().toISOString(),
        reviewerName: t.reviewer,
        reviewerId: t.reviewer ? t.reviewer.toLowerCase().replace(/\s+/g, '-') : undefined,
        reviewRequired: t.reviewRequired !== false,
      };
    });
    setCompletedAuditReports(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const unique = newTasks.filter(t => !existingIds.has(t.id));
      return [...unique, ...prev];
    });
    if (newTasks.length > 0) {
      fetch('/api/audit-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTasks),
      }).catch(e => console.error('Failed to save published tasks:', e));
    }
  };

  const handleLiveObservationsChange = React.useCallback((taskId: string, observations: import('../types').AuditObservation[]) => {
    setCompletedAuditReports(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx < 0) return prev;
      const existing = prev[idx];
      if (existing.observations === observations) return prev;
      const updated = [...prev];
      updated[idx] = { ...existing, observations };
      return updated;
    });
  }, []);

  const handleAuditComplete = (task: AuditTask) => {
    setCompletedAuditReports(prev => {
      const exists = prev.findIndex(t => t.id === task.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = task;
        return updated;
      }
      return [task, ...prev];
    });

    setScheduledAudits(prev => prev.map(sa => {
      const locMatch = sa.locations.find(l =>
        task.id.startsWith(`${sa.id}-${l.locationId}`)
      );
      if (!locMatch) return sa;
      const updatedLocations = sa.locations.map(l =>
        l.locationId === locMatch.locationId
          ? { ...l, status: 'Completed' as const, completedAt: new Date().toISOString().split('T')[0], score: task.score ?? task.progress }
          : l
      );
      const allDone = updatedLocations.every(l => l.status === 'Completed');
      return { ...sa, locations: updatedLocations, overallStatus: allDone ? 'Completed' : sa.overallStatus };
    }));

    if (task.groupId) {
      setCompletedAuditReports(latestReports => {
        const groupTasks = latestReports.filter(t => t.groupId === task.groupId);
        setUnitSchedules(prevUnits => prevUnits.map(unit => ({
          ...unit,
          periods: unit.periods.map(period => ({
            ...period,
            audits: period.audits.map(audit => {
              if (audit.id !== task.groupId) return audit;
              const allGroupTaskIds = new Set<string>();
              if (audit.locationAssignments && audit.locationAssignments.length > 0) {
                audit.locationAssignments.forEach(la => {
                  la.assignedAuditors.forEach(auditorName => {
                    allGroupTaskIds.add(`sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}-${la.locationName.replace(/[^a-zA-Z0-9]/g, '-')}`);
                  });
                });
              } else {
                audit.auditTeam.forEach(auditorName => {
                  allGroupTaskIds.add(`sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}`);
                });
              }
              const completedGroupTasks = groupTasks.filter(t => t.status === 'Completed' && allGroupTaskIds.has(t.id));
              const allDone = allGroupTaskIds.size > 0 && completedGroupTasks.length >= allGroupTaskIds.size;
              if (allDone) {
                const totalScore = completedGroupTasks.reduce((sum, t) => sum + (t.score ?? 0), 0);
                const avgScore = completedGroupTasks.length > 0 ? Math.round(totalScore / completedGroupTasks.length) : 0;
                return { ...audit, status: 'Completed', score: avgScore };
              }
              const anyStarted = groupTasks.some(t => t.status === 'In Progress' || t.status === 'Completed');
              if (anyStarted && audit.status === 'Scheduled') {
                return { ...audit, status: 'In Progress' };
              }
              return audit;
            }),
          })),
        })));
        return latestReports;
      });
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const isCompletedReport = completedAuditReports.some(t => t.id === taskId);
    if (isCompletedReport) {
      setCompletedAuditReports(prev => prev.filter(t => t.id !== taskId));
      try {
        await Promise.all([
          fetch('/api/audit-tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId }) }),
          fetch('/api/audit-reports', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: taskId }) }),
        ]);
      } catch {}
    } else {
      let matched = false;
      setScheduledAudits(prev => prev.map(sa => {
        const newLocations = sa.locations.map(loc => {
          const derivedId = `${sa.id}-${loc.locationId}-`;
          if (taskId.startsWith(derivedId)) {
            matched = true;
            const auditorSuffix = taskId.slice(derivedId.length);
            return { ...loc, assignedTeam: loc.assignedTeam.filter(name => name.replace(/\s+/g, '-') !== auditorSuffix) };
          }
          return loc;
        }).filter(loc => loc.assignedTeam.length > 0);
        if (newLocations.length !== sa.locations.length || newLocations.some((l, i) => l !== sa.locations[i])) {
          return newLocations.length > 0 ? { ...sa, locations: newLocations } : sa;
        }
        return sa;
      }).filter(sa => {
        const hasAssignments = sa.locations.some(l => l.assignedTeam.length > 0);
        return hasAssignments;
      }));
      if (!matched) {
        setCompletedAuditReports(prev => prev.filter(t => t.id !== taskId));
      }
    }
  };

  const handleTaskUpdate = (updatedTask: AuditTask) => {
    setCompletedAuditReports(prev => {
      const exists = prev.findIndex(t => t.id === updatedTask.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = updatedTask;
        return updated;
      }
      return [updatedTask, ...prev];
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-lg sm:shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-gradient-to-b from-violet-600 to-violet-400" />
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="flex items-center gap-3 sm:gap-4 z-10 pl-2 sm:pl-0">
            <div className="p-2.5 sm:p-3.5 bg-violet-50 text-violet-600 rounded-xl sm:rounded-2xl shadow-inner border border-violet-100 shrink-0">
              <Shield className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Internal Audit</h2>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-0.5">Schedule, Forms & Execution</p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-50/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-100 z-10 w-full overflow-x-auto hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all min-w-0 flex-1 sm:flex-none justify-center sm:justify-start ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                      : 'text-slate-500 hover:bg-white hover:text-violet-600 active:bg-white active:text-violet-600'
                  }`}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {tab.id === 'audits' && pendingReviewCount > 0 && (
                    <span className="ml-0.5 sm:ml-1 px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full min-w-[18px] text-center leading-none shrink-0">
                      {pendingReviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === 'schedule' && dbReady && (
        <AuditSchedule
          entities={entities}
          currentScope={currentScope}
          userRootId={userRootId}
          protocols={protocols}
          setProtocols={setProtocols}
          checklistNames={scheduledChecklistNames}
          checklistTemplates={scheduledChecklistTemplates}
          directAssignChecklists={directAssignChecklists}
          onDirectAssign={handleDirectAssign}
          onPublishAudits={handlePublishAudits}
          externalUnits={scopedUnitSchedules}
          setExternalUnits={scopedSetUnitSchedules}
          externalScheduledAudits={scopedScheduledAudits as any}
          setExternalScheduledAudits={scopedSetScheduledAudits as any}
          departmentLocations={departmentLocations}
          onImmediateSave={flushAllAuditDataNow}
        />
      )}
      {activeTab === 'schedule' && !dbReady && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading schedule data...</span>
          </div>
        </div>
      )}

      {activeTab === 'forms' && (
        <ChecklistEditor
          protocols={protocols}
          sopNames={sopNames}
          sopSubTopics={sopSubTopics}
          locationNames={locationNames}
          departmentNames={departmentNames}
          entities={entities}
          checklists={checklists}
          setChecklists={setChecklists}
          scheduledAudits={scopedScheduledAudits}
          setScheduledAudits={scopedSetScheduledAudits}
          externalSync
          onDirectAssign={handleDirectAssign}
          onSwitchToSchedule={() => setActiveTab('schedule')}
          scheduledChecklistIds={scheduledChecklistIds}
          onToggleSchedule={toggleScheduledChecklist}
          directAssignChecklistIds={directAssignChecklistIds}
          onToggleDirectAssign={toggleDirectAssignChecklist}
          observationChecklistIds={observationChecklistIds}
          onToggleObservationChecklist={toggleObservationChecklist}
          currentScope={currentScope}
          userRootId={userRootId}
          userName={userName}
        />
      )}

      {activeTab === 'audits' && (
        <AuditorLaunchpad
          currentScope={currentScope}
          userRootId={userRootId}
          userName={userName}
          entities={entities}
          assignedTasks={allMyTasks}
          checklistTemplates={checklists}
          onAuditComplete={handleAuditComplete}
          onLiveObservationsChange={handleLiveObservationsChange}
          onTaskDelete={handleTaskDelete}
          onTaskUpdate={handleTaskUpdate}
          departmentLocations={departmentLocations}
        />
      )}

    </div>
  );
};

export default InternalAudit;
