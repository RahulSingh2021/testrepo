"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, Search, Plus, Play, Edit, History, CheckCircle2, 
  AlertTriangle, Clock, ChevronDown, ChevronUp, FileText, X, 
  Calendar, BarChart3, ArrowRight, Eye, FileDown, CalendarPlus,
  MapPin, Users, Trash2, Download, Send, CalendarRange, Crosshair,
  Wrench, Droplets, Settings2, Link, User, MoreVertical, Save, Check, FileSpreadsheet,
} from 'lucide-react';
import { MandatoryProtocol, HierarchyScope, Entity } from '../types';
import AuditChecklistCreator, { ChecklistTemplate } from './AuditChecklistCreator';
import AuditChecklistPreview from './AuditChecklistPreview';
import UnifiedPagination from './UnifiedPagination';
import MasterChecklistTable, { MasterChecklist } from './MasterChecklistTable';

const SCOPE_HIERARCHY: HierarchyScope[] = ['super-admin', 'corporate', 'regional', 'unit', 'department', 'user'];
const getScopeLevel = (s?: string): number => {
  const idx = SCOPE_HIERARCHY.indexOf(s as HierarchyScope);
  return idx === -1 ? 999 : idx;
};
const SCOPE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin', 'corporate': 'Corporate', 'regional': 'Regional',
  'unit': 'Unit', 'department': 'Department', 'user': 'User',
};

interface LocationAuditAssignment {
  locationId: string;
  locationName: string;
  department: string;
  assignedTeam: string[];
  status: 'Scheduled' | 'In Progress' | 'Completed';
  startedAt?: string;
  completedAt?: string;
  score?: number;
  notes?: string;
}

interface ScheduledAudit {
  id: string;
  checklistId: string;
  checklistTitle: string;
  scheduledDate: string;
  dueDate: string;
  locations: LocationAuditAssignment[];
  overallStatus: 'Scheduled' | 'In Progress' | 'Completed';
  createdAt: string;
  notes?: string;
}

interface ScheduleFormLocation {
  locationName: string;
  department: string;
  team: string[];
  teamInput: string;
}

const ScoreBadge = ({ score, status }: { score: number, status: string }) => {
  const isCompleted = status === 'Completed';
  if (!isCompleted) return <span className="text-xs font-bold text-slate-400">--</span>;
  const color = score >= 90 ? 'text-emerald-600' : score >= 75 ? 'text-blue-600' : 'text-rose-600';
  return (
    <div className="flex flex-col items-end">
      <span className={`text-sm font-black ${color}`}>{score}%</span>
      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Audit Score</span>
    </div>
  );
};

const StatusPill = ({ status }: { status: 'Scheduled' | 'In Progress' | 'Completed' }) => {
  const styles = status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${styles}`}>{status}</span>;
};

const TeamChip = ({ name, onRemove }: { name: string; onRemove?: () => void }) => {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-bold" title={name}>
      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-[7px] font-black">{initials}</span>
      {name}
      {onRemove && <button onClick={onRemove} className="ml-0.5 hover:text-rose-600"><X size={10} /></button>}
    </span>
  );
};

interface ChecklistEditorProps {
    protocols: MandatoryProtocol[];
    sopNames?: string[];
    sopSubTopics?: Record<string, string[]>;
    locationNames?: string[];
    departmentNames?: string[];
    entities?: Entity[];
    checklists?: ChecklistTemplate[];
    setChecklists?: React.Dispatch<React.SetStateAction<ChecklistTemplate[]>>;
    scheduledAudits?: ScheduledAudit[];
    setScheduledAudits?: React.Dispatch<React.SetStateAction<ScheduledAudit[]>>;
    externalSync?: boolean;
    onDirectAssign?: (checklist: ChecklistTemplate) => void;
    onSwitchToSchedule?: () => void;
    scheduledChecklistIds?: Set<string>;
    onToggleSchedule?: (checklistId: string) => void;
    directAssignChecklistIds?: Set<string>;
    onToggleDirectAssign?: (checklistId: string) => void;
    observationChecklistIds?: Set<string>;
    onToggleObservationChecklist?: (checklistId: string) => void;
    currentScope?: HierarchyScope;
    userRootId?: string | null;
    userName?: string;
    fixedPages?: { title: string }[];
    equipmentList?: { id: string; name: string; idNumber: string; department?: string; location?: string; unit?: string; regional?: string }[];
    onEquipmentLink?: (checklistTitle: string, equipmentId: string, linked: boolean) => void;
}

const ChecklistEditor: React.FC<ChecklistEditorProps> = ({ protocols = [], sopNames = [], sopSubTopics = {}, locationNames = [], departmentNames = [], entities = [], onDirectAssign, onSwitchToSchedule, scheduledChecklistIds, onToggleSchedule, directAssignChecklistIds, onToggleDirectAssign, observationChecklistIds, onToggleObservationChecklist, currentScope, userRootId, userName: editorUserName, fixedPages, equipmentList = [], onEquipmentLink, ...externalProps }) => {
  const [internalChecklists, setInternalChecklists] = useState<ChecklistTemplate[]>([]);
  const checklists = externalProps.externalSync && externalProps.checklists ? externalProps.checklists : internalChecklists;
  const setChecklists = externalProps.externalSync && externalProps.setChecklists ? externalProps.setChecklists : setInternalChecklists;

  const [internalScheduledAudits, setInternalScheduledAudits] = useState<ScheduledAudit[]>([]);
  const scheduledAudits = externalProps.externalSync && externalProps.scheduledAudits !== undefined ? externalProps.scheduledAudits : internalScheduledAudits;
  const setScheduledAudits = externalProps.externalSync && externalProps.setScheduledAudits ? externalProps.setScheduledAudits : setInternalScheduledAudits;

  const [allMcls, setAllMcls] = useState<MasterChecklist[]>([]);
  useEffect(() => {
    fetch('/api/master-checklists').then(r => r.ok ? r.json() : []).then(data => setAllMcls(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistTemplate | null>(null);
  const [newChecklist, setNewChecklist] = useState({ title: '', department: 'General', frequency: 'Monthly' });
  const [previewingChecklist, setPreviewingChecklist] = useState<ChecklistTemplate | null>(null);
  const [downloadingChecklist, setDownloadingChecklist] = useState<ChecklistTemplate | null>(null);
  const [excelDownloadingChecklist, setExcelDownloadingChecklist] = useState<ChecklistTemplate | null>(null);
  const [excelLocationDownloadingChecklist, setExcelLocationDownloadingChecklist] = useState<ChecklistTemplate | null>(null);
  const [downloadDropdownId, setDownloadDropdownId] = useState<string | null>(null);

  const [schedulingChecklist, setSchedulingChecklist] = useState<ChecklistTemplate | null>(null);
  const [planDropdownId, setPlanDropdownId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ scheduledDate: '', dueDate: '', notes: '', locations: [{ locationName: '', department: '', team: [] as string[], teamInput: '' }] as ScheduleFormLocation[] });
  const [completeDialog, setCompleteDialog] = useState<{ saId: string; locId: string; score: string; notes: string } | null>(null);
  const [scheduledAuditsCollapsed, setScheduledAuditsCollapsed] = useState(false);
  const [respDropdownId, setRespDropdownId] = useState<string | null>(null);
  const [respDropdownField, setRespDropdownField] = useState<'cleaning' | 'pm'>('cleaning');
  const [respSearch, setRespSearch] = useState('');
  const [facilitySections, setFacilitySections] = useState<string[]>([]);
  const [showAddSectionInput, setShowAddSectionInput] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    if (!fixedPages) return;
    const allSections = new Set<string>();
    checklists.forEach(cl => {
      if (cl.facilitySections) cl.facilitySections.forEach(s => allSections.add(s));
      cl.pages?.forEach(p => p.sections?.forEach(s => {
        if (s.title && s.title !== 'New Section') allSections.add(s.title);
      }));
    });
    if (allSections.size > 0 && facilitySections.length === 0) {
      setFacilitySections(Array.from(allSections));
    }
  }, [fixedPages, checklists.length]);

  const allLocationsComplete = (sa: ScheduledAudit) => sa.locations.length > 0 && sa.locations.every(l => l.status === 'Completed');

  const getChecklistStats = (checklist: ChecklistTemplate) => {
    const allQuestions = checklist.pages.flatMap(p => p.sections.flatMap(s => {
      const direct = s.questions || [];
      const fromSubs = (s.subSections || []).flatMap(ss => ss.questions || []);
      return [...direct, ...fromSubs];
    }));
    const totalQuestions = allQuestions.length;
    const highRisk = allQuestions.filter(q => q.risk === 'High').length;
    const mediumRisk = allQuestions.filter(q => q.risk === 'Medium').length;
    const lowRisk = allQuestions.filter(q => q.risk === 'Low').length;
    const totalPossibleScore = allQuestions.reduce((sum, q) => sum + (q.maxScore || 0), 0);
    return { totalQuestions, highRisk, mediumRisk, lowRisk, totalPossibleScore };
  };

  useEffect(() => {
    if (externalProps.externalSync) return;
    setChecklists(prev => {
      const synced = protocols.map(p => {
          const existing = prev.find(c => c.id === p.id);
          if (existing) {
              return { ...existing, title: p.name, frequency: p.frequency, lastUpdated: p.effectiveDate };
          }
          
          let initialHistory: any[] = [];
          if (p.id === 'm1') {
              initialHistory = [
                  { id: "H-101", auditDate: "2025-05-20", auditor: "John Doe", score: 98, status: "Completed", findings: 0 },
                  { id: "H-102", auditDate: "2025-05-19", auditor: "Jane Smith", score: 85, status: "Completed", findings: 3 }
              ];
          }

          return {
              id: p.id, title: p.name, department: "Quality Assurance",
              frequency: p.frequency, questionCount: p.id === 'm1' ? 45 : 0,
              lastUpdated: p.effectiveDate, status: 'Active' as const,
              history: initialHistory, pages: [],
              createdByScope: p.level === 'CORPORATE' ? 'corporate' : p.level === 'REGIONAL' ? 'regional' : 'unit',
              createdByEntityId: p.entityId || null,
              createdByName: 'System Protocol',
              unitDetails: { companyName: '', repName: '', address: '', contact: '', email: '', manday: '', scope: '', dateFrom: '', dateTo: '', geotag: '', startTime: '' }
          };
      });

      const localOnly = prev.filter(c => !protocols.some(p => p.id === c.id));
      return [...synced, ...localOnly];
    });
  }, [protocols, externalProps.externalSync]);

  const isAncestorOf = useMemo(() => {
    return (ancestorId: string, descendantId: string): boolean => {
      let cur = entities.find(e => e.id === descendantId);
      while (cur?.parentId) {
        if (cur.parentId === ancestorId) return true;
        cur = entities.find(e => e.id === cur!.parentId);
      }
      return false;
    };
  }, [entities]);

  const visibleChecklists = useMemo(() => {
    if (!currentScope) return checklists;
    const myLevel = getScopeLevel(currentScope);
    return checklists.filter(c => {
      if (!c.createdByScope) return currentScope === 'super-admin';
      if (c.createdByScope === 'super-admin') return currentScope === 'super-admin';
      const creatorLevel = getScopeLevel(c.createdByScope);
      if (currentScope === 'super-admin') return true;
      const isSystemProtocol = c.createdByName === 'System Protocol';
      if (creatorLevel < myLevel) {
        if (c.createdByScope === 'corporate' && c.createdByEntityId && userRootId) {
          return isAncestorOf(c.createdByEntityId, userRootId);
        }
        if (isSystemProtocol && !c.createdByEntityId) return true;
        if (c.createdByEntityId && userRootId) {
          return isAncestorOf(c.createdByEntityId, userRootId);
        }
        return false;
      }
      if (creatorLevel === myLevel) {
        if (isSystemProtocol && !c.createdByEntityId) return true;
        if (c.createdByEntityId && userRootId) return c.createdByEntityId === userRootId;
        return false;
      }
      return false;
    });
  }, [checklists, currentScope, userRootId, entities, isAncestorOf]);

  const isChecklistReadOnly = (checklist: ChecklistTemplate): boolean => {
    if (!currentScope || currentScope === 'super-admin') return false;
    if (!checklist.createdByScope) return false;
    const myLevel = getScopeLevel(currentScope);
    const creatorLevel = getScopeLevel(checklist.createdByScope);
    // Same level but different entity → read-only (can't edit others' at same level)
    if (creatorLevel === myLevel && checklist.createdByEntityId && userRootId && checklist.createdByEntityId !== userRootId) return true;
    // Creator is higher level than me → always read-only (corporate checklists can't be edited by units)
    if (creatorLevel < myLevel) return true;
    // Creator is lower level (impossible in normal hierarchy, but block anyway)
    if (creatorLevel > myLevel) return true;
    return false;
  };

  const canDeleteChecklist = (checklist: ChecklistTemplate): boolean => {
    if (currentScope === 'super-admin') return true;
    if (!checklist.createdByScope) return false;
    const myLevel = getScopeLevel(currentScope);
    const creatorLevel = getScopeLevel(checklist.createdByScope);
    // Only creator at same level and same entity can delete
    if (creatorLevel === myLevel && checklist.createdByEntityId && userRootId) {
      return checklist.createdByEntityId === userRootId;
    }
    // Higher level created it → units cannot delete corporate checklists
    return false;
  };

  const filteredChecklists = useMemo(() => {
    return visibleChecklists.filter(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [visibleChecklists, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredChecklists.length / rowsPerPage));
  const paginatedChecklists = filteredChecklists.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const [hygieneMetaModal, setHygieneMetaModal] = useState<ChecklistTemplate | null>(null);
  const [equipPickerOpen, setEquipPickerOpen] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteChecklist = (id: string) => {
    setChecklists(prev => prev.filter(c => c.id !== id));
    setDeleteConfirmId(null);
    if (expandedId === id) setExpandedId(null);
    fetch('/api/audit-checklists', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(e => console.error('Failed to delete checklist from DB:', e));
  };

  const handleCreate = () => {
    if(!newChecklist.title) return;
    const ts = Date.now();
    const now = new Date().toISOString().split('T')[0];
    const makeDefaultQuestion = (pageIdx: number, secIdx: number) => ({
      id: `q-${ts}-${pageIdx}-${secIdx}`, text: '', responseType: 'multiple' as any,
      responses: [
        { id: `r-${ts}-${pageIdx}-${secIdx}-1`, text: 'Yes', score: '1', isDefault: false },
        { id: `r-${ts}-${pageIdx}-${secIdx}-2`, text: 'No', score: '0', isDefault: false },
        { id: `r-${ts}-${pageIdx}-${secIdx}-3`, text: 'N/A', score: '/', isDefault: false },
      ],
      risk: 'Low' as any, requirement: '', isRequired: false,
      isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
      maxScore: 0, logicRules: [],
    });
    const initialPages = fixedPages ? fixedPages.map((fp, i) => {
      const sectionNames = facilitySections.length > 0 ? facilitySections : ['New Section'];
      return {
        id: `p-${ts}-${i}`,
        title: fp.title,
        sections: sectionNames.map((secName, si) => ({
          id: `s-${ts}-${i}-${si}`, title: secName, isApplicable: true,
          risk: 'Indiv.' as any, category: '',
          questions: [makeDefaultQuestion(i, si)],
        })),
      };
    }) : [];
    const newItem: ChecklistTemplate = {
        id: `CL-${Date.now()}`, title: newChecklist.title,
        department: newChecklist.department, frequency: newChecklist.frequency,
        questionCount: 0, lastUpdated: now,
        status: 'Draft', history: [], pages: initialPages,
        createdByScope: currentScope || 'super-admin',
        createdByEntityId: userRootId || null,
        createdByName: editorUserName || 'System',
        unitDetails: { companyName: '', repName: '', address: '', contact: '', email: '', manday: '', scope: '', dateFrom: '', dateTo: '', geotag: '', startTime: '' },
        ...(fixedPages ? { createdDate: now, modifiedDate: now, attachedEquipmentIds: [], attachedEquipmentNames: [], facilitySections: [...facilitySections], cleaningResponsibility: [] as string[], cleaningFrequency: { value: 0, unit: 'Days' as const }, pmResponsibility: [] as string[], pmFrequency: { value: 0, unit: 'Days' as const } } : {}),
    };
    setChecklists([newItem, ...checklists]);
    setIsCreateModalOpen(false);
    setEditingChecklist(newItem);
  };

  const updateChecklistMeta = (id: string, updates: Partial<ChecklistTemplate>) => {
    const now = new Date().toISOString().split('T')[0];
    setChecklists(prev => prev.map(c => c.id === id ? { ...c, ...updates, modifiedDate: now, lastUpdated: now } : c));
  };

  const handleSaveCreator = (updated: ChecklistTemplate, silent?: boolean) => {
    const now = new Date().toISOString().split('T')[0];
    const final = fixedPages ? { ...updated, modifiedDate: now, lastUpdated: now } : updated;
    setChecklists(prev => prev.map(c => c.id === final.id ? final : c));
    if (!silent) {
      setEditingChecklist(null);
      alert("Protocol synchronized with unit registry.");
    }
  };

  const handleSaveCreatorNow = (updated: ChecklistTemplate) => {
    const now = new Date().toISOString().split('T')[0];
    const final = fixedPages ? { ...updated, modifiedDate: now, lastUpdated: now } : updated;
    setChecklists(prev => prev.map(c => c.id === final.id ? final : c));
    fetch('/api/audit-checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([final]),
    }).catch(e => console.error('Failed to immediately save checklist after question delete:', e));
  };

  const openScheduleModal = (checklist: ChecklistTemplate) => {
    setSchedulingChecklist(checklist);
    setScheduleForm({ scheduledDate: '', dueDate: '', notes: '', locations: [{ locationName: '', department: '', team: [], teamInput: '' }] });
  };

  const addScheduleLocation = () => {
    setScheduleForm(f => ({ ...f, locations: [...f.locations, { locationName: '', department: '', team: [], teamInput: '' }] }));
  };

  const removeScheduleLocation = (idx: number) => {
    setScheduleForm(f => ({ ...f, locations: f.locations.filter((_, i) => i !== idx) }));
  };

  const updateScheduleLocation = (idx: number, field: keyof ScheduleFormLocation, value: string) => {
    setScheduleForm(f => ({ ...f, locations: f.locations.map((loc, i) => i === idx ? { ...loc, [field]: value } : loc) }));
  };

  const addTeamMember = (locIdx: number) => {
    setScheduleForm(f => {
      const locs = [...f.locations];
      const loc = { ...locs[locIdx] };
      const name = loc.teamInput.trim();
      if (name && !loc.team.includes(name)) {
        loc.team = [...loc.team, name];
        loc.teamInput = '';
      }
      locs[locIdx] = loc;
      return { ...f, locations: locs };
    });
  };

  const removeTeamMember = (locIdx: number, memberIdx: number) => {
    setScheduleForm(f => {
      const locs = [...f.locations];
      const loc = { ...locs[locIdx] };
      loc.team = loc.team.filter((_, i) => i !== memberIdx);
      locs[locIdx] = loc;
      return { ...f, locations: locs };
    });
  };

  const handleCreateSchedule = () => {
    if (!schedulingChecklist || !scheduleForm.scheduledDate) return;
    const validLocations = scheduleForm.locations.filter(l => l.locationName.trim());
    if (validLocations.length === 0) return;

    const sa: ScheduledAudit = {
      id: `SA-${Date.now()}`,
      checklistId: schedulingChecklist.id,
      checklistTitle: schedulingChecklist.title,
      scheduledDate: scheduleForm.scheduledDate,
      dueDate: scheduleForm.dueDate,
      locations: validLocations.map((l, i) => ({
        locationId: `LOC-${Date.now()}-${i}`,
        locationName: l.locationName.trim(),
        department: l.department.trim(),
        assignedTeam: l.team,
        status: 'Scheduled' as const,
      })),
      overallStatus: 'Scheduled',
      createdAt: new Date().toISOString().split('T')[0],
      notes: scheduleForm.notes.trim() || undefined,
    };

    setScheduledAudits(prev => [sa, ...prev]);
    setSchedulingChecklist(null);
  };

  const beginLocationAudit = (saId: string, locId: string) => {
    let checklistId: string | null = null;
    setScheduledAudits(prev => prev.map(sa => {
      if (sa.id !== saId) return sa;
      checklistId = sa.checklistId;
      const locations = sa.locations.map(l => l.locationId === locId ? { ...l, status: 'In Progress' as const, startedAt: new Date().toISOString() } : l);
      const hasInProgress = locations.some(l => l.status === 'In Progress');
      return { ...sa, locations, overallStatus: hasInProgress ? 'In Progress' : sa.overallStatus };
    }));
    if (checklistId) {
      const cl = checklists.find(c => c.id === checklistId);
      if (cl) setPreviewingChecklist(cl);
    }
  };

  const handleConfirmComplete = () => {
    if (!completeDialog) return;
    const { saId, locId, score, notes } = completeDialog;
    setScheduledAudits(prev => prev.map(sa => {
      if (sa.id !== saId) return sa;
      const locations = sa.locations.map(l => l.locationId === locId ? {
        ...l,
        status: 'Completed' as const,
        completedAt: new Date().toISOString().split('T')[0],
        score: score ? parseInt(score) : undefined,
        notes: notes.trim() || undefined,
      } : l);
      const allDone = locations.every(l => l.status === 'Completed');
      return { ...sa, locations, overallStatus: allDone ? 'Completed' : sa.overallStatus };
    }));
    setCompleteDialog(null);
  };

  const deleteScheduledAudit = (saId: string) => {
    if (!confirm('Delete this scheduled audit? This action cannot be undone.')) return;
    setScheduledAudits(prev => prev.filter(sa => sa.id !== saId));
    fetch('/api/audit-schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saId }) }).catch(() => {});
  };

  const deleteHistoryEntry = async (checklistId: string, entryId: string) => {
    if (!confirm('Delete this audit record from history? This action cannot be undone.')) return;
    const prevChecklists = checklists;
    setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, history: c.history.filter((h: any) => h.id !== entryId) } : c));
    try {
      await Promise.all([
        fetch('/api/audit-reports', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entryId }) }),
        fetch('/api/audit-tasks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entryId }) }),
      ]);
    } catch {
      setChecklists(prevChecklists);
      alert('Failed to delete from server. The record has been restored.');
    }
  };

  const handleExportUnitReport = async (sa: ScheduledAudit) => {
    if (!allLocationsComplete(sa)) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const today = new Date().toISOString().split('T')[0];

    const addFooter = () => {
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageH - 14, pageW, 14, 'F');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`HACCP PRO Confidential — Generated ${today}`, pageW / 2, pageH - 7, { align: 'center' });
        doc.text(`Page ${i} / ${totalPages}`, pageW - 15, pageH - 7, { align: 'right' });
      }
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 100, 'F');
    doc.setFillColor(20, 184, 166);
    doc.rect(0, 100, pageW, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.text('HACCP PRO', pageW / 2, 40, { align: 'center' });
    doc.setFontSize(14);
    doc.text('UNIT AUDIT REPORT', pageW / 2, 55, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text(sa.checklistTitle, pageW / 2, 70, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Scheduled: ${sa.scheduledDate}  |  Due: ${sa.dueDate || 'N/A'}  |  Generated: ${today}`, pageW / 2, 82, { align: 'center' });

    doc.addPage();
    let y = 20;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.text('Locations Summary', 15, y);
    y += 10;

    const colX = [15, 55, 90, 130, 160];
    const colHeaders = ['Location', 'Department', 'Team', 'Completed', 'Score'];

    doc.setFillColor(15, 23, 42);
    doc.rect(15, y - 5, pageW - 30, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    colHeaders.forEach((h, i) => doc.text(h, colX[i], y));
    y += 8;

    sa.locations.forEach((loc, idx) => {
      if (y > pageH - 30) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y - 5, pageW - 30, 8, 'F');
      }
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.text(loc.locationName.slice(0, 20), colX[0], y);
      doc.text((loc.department || '-').slice(0, 18), colX[1], y);
      doc.text(loc.assignedTeam.length > 0 ? loc.assignedTeam.join(', ').slice(0, 20) : '-', colX[2], y);
      doc.text(loc.completedAt || '-', colX[3], y);

      if (loc.score !== undefined) {
        if (loc.score >= 90) doc.setTextColor(5, 150, 105);
        else if (loc.score >= 75) doc.setTextColor(217, 119, 6);
        else doc.setTextColor(225, 29, 72);
        doc.text(`${loc.score}%`, colX[4], y);
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('-', colX[4], y);
      }
      y += 8;
    });

    y += 10;
    if (y > pageH - 50) { doc.addPage(); y = 20; }
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.text('Audit Team Roster', 15, y);
    y += 8;

    const allMembers = Array.from(new Set(sa.locations.flatMap(l => l.assignedTeam)));
    const half = Math.ceil(allMembers.length / 2);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    allMembers.forEach((member, i) => {
      if (y > pageH - 20) { doc.addPage(); y = 20; }
      const xPos = i % 2 === 0 ? 20 : pageW / 2 + 5;
      if (i % 2 === 0 && i > 0) y += 6;
      if (i === 0) y += 0;
      doc.text(`• ${member}`, xPos, y);
    });

    addFooter();
    doc.save(`Unit_Audit_Report_${sa.checklistTitle.replace(/\s+/g, '_')}_${today}.pdf`);
  };

  const canCreateSchedule = scheduleForm.scheduledDate && scheduleForm.locations.some(l => l.locationName.trim());

  if (editingChecklist) {
    return (
      <AuditChecklistCreator 
        checklist={editingChecklist} 
        onSave={handleSaveCreator}
        onSaveNow={handleSaveCreatorNow}
        onCancel={() => setEditingChecklist(null)}
        sopNames={sopNames}
        sopSubTopics={sopSubTopics}
        locationNames={locationNames}
        departmentNames={departmentNames}
        fixedPages={fixedPages}
        entities={entities}
        currentScope={currentScope}
        userRootId={userRootId}
        userName={editorUserName}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 pb-20 animate-in fade-in duration-500 text-left">
      {/* Premium dark header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />
        <div className="absolute -top-28 -right-28 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,white 0,white 1px,transparent 1px,transparent 44px),repeating-linear-gradient(90deg,white 0,white 1px,transparent 1px,transparent 44px)' }} />

        <div className="relative p-5 sm:p-8 flex flex-col gap-5 sm:gap-6">
          {/* Title row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="p-3 sm:p-3.5 bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/10 shadow-inner shrink-0">
                <ClipboardList className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight uppercase leading-none">Audit Forms</h2>
                <p className="text-[9px] sm:text-[11px] font-semibold text-indigo-300/80 uppercase tracking-[0.2em] mt-1">Checklist Repository &amp; History</p>
              </div>
            </div>
            {/* Live stats pills */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 border border-white/10 rounded-full backdrop-blur-sm">
                <span className="text-[9px] font-black text-white/50 uppercase tracking-wider">Total</span>
                <span className="text-[11px] font-black text-white">{checklists.length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-400/25 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-[9px] font-black text-emerald-300 uppercase tracking-wider">Active</span>
                <span className="text-[11px] font-black text-emerald-100">{checklists.filter(c => c.status === 'Active').length}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-400/25 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[9px] font-black text-amber-300 uppercase tracking-wider">Draft</span>
                <span className="text-[11px] font-black text-amber-100">{checklists.filter(c => c.status === 'Draft').length}</span>
              </div>
            </div>
          </div>

          {/* Search + action buttons */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-300 transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <input
                type="text"
                placeholder="Search templates..."
                className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-white/8 border border-white/10 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold text-white placeholder:text-white/25 focus:outline-none focus:border-indigo-400/50 focus:bg-white/12 transition-all tracking-wide backdrop-blur-sm"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-all text-white/60"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              )}
            </div>
            {fixedPages && (
              <button
                onClick={() => setShowAddSectionInput(!showAddSectionInput)}
                className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white/10 hover:bg-white/18 border border-white/15 text-white rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto backdrop-blur-sm"
              >
                <Plus size={14} strokeWidth={3} /> Add Section
              </button>
            )}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-5 sm:px-7 py-3 sm:py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] shadow-lg shadow-indigo-950/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto"
            >
              <Plus size={15} strokeWidth={3} /> Create Checklist
            </button>
          </div>
        </div>
      </div>

      {fixedPages && showAddSectionInput && (
        <div className="flex flex-col gap-3 p-4 sm:p-5 bg-white border border-indigo-200 rounded-2xl shadow-sm">
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Add Facility Section</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter section name..."
              autoFocus
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newSectionName.trim()) {
                  if (!facilitySections.includes(newSectionName.trim())) {
                    setFacilitySections(prev => [...prev, newSectionName.trim()]);
                  }
                  setNewSectionName('');
                }
              }}
              className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all"
            />
            <button
              onClick={() => {
                if (newSectionName.trim() && !facilitySections.includes(newSectionName.trim())) {
                  setFacilitySections(prev => [...prev, newSectionName.trim()]);
                }
                setNewSectionName('');
              }}
              disabled={!newSectionName.trim()}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-indigo-200"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddSectionInput(false); setNewSectionName(''); }}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X size={16} />
            </button>
          </div>
          {facilitySections.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {facilitySections.map(section => (
                <span key={section} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  {section}
                  <button
                    onClick={() => setFacilitySections(prev => prev.filter(s => s !== section))}
                    className="text-indigo-300 hover:text-rose-500 transition-colors ml-0.5"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}


      <div className="flex flex-col gap-3 sm:gap-4">
          {paginatedChecklists.map((checklist) => {
              const isExpanded = expandedId === checklist.id;
              const stats = getChecklistStats(checklist);
              const readOnly = isChecklistReadOnly(checklist);
              const linkedMcl = allMcls.find(m => m.linkedChecklistId === checklist.id);
              const mclStats = linkedMcl ? {
                draft: linkedMcl.rows.filter(r => !r.isInactive && r.rowStatus === 'draft').length,
                edited: linkedMcl.rows.filter(r => !r.isInactive && r.rowStatus === 'pending-sync').length,
                live: linkedMcl.rows.filter(r => !r.isInactive && r.rowStatus === 'synced').length,
              } : null;
              const attachedEquipNames = fixedPages && checklist.attachedEquipmentIds?.length
                ? checklist.attachedEquipmentIds.map(eId => equipmentList.find(eq => eq.id === eId)).filter(Boolean)
                : [];
              return (
                  <div key={checklist.id} className={`bg-white rounded-2xl sm:rounded-[2rem] border-2 transition-all duration-300 flex flex-col group ${(planDropdownId === checklist.id || downloadDropdownId === checklist.id || equipPickerOpen === checklist.id || respDropdownId === checklist.id) ? 'overflow-visible z-30' : 'overflow-hidden'} ${isExpanded ? 'border-indigo-500 shadow-xl' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                      <div className="p-3.5 sm:p-5 flex flex-col gap-3.5 sm:gap-5">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 sm:gap-6">
                          <div className="flex items-center gap-3 sm:gap-5 lg:w-[35%] shrink-0 text-left">
                              <div className={`w-11 h-11 sm:w-16 sm:h-16 border rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner shrink-0 transition-colors ${fixedPages ? 'bg-teal-50 border-teal-200 text-teal-600 group-hover:bg-teal-100' : 'bg-slate-50 border-slate-200 text-indigo-500 group-hover:bg-indigo-50 group-hover:border-indigo-100'}`}>
                                  {fixedPages ? <ClipboardList className="w-5 h-5 sm:w-7 sm:h-7" /> : <FileText className="w-5 h-5 sm:w-7 sm:h-7" />}
                              </div>
                              <div className="min-w-0">
                                  <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight leading-tight truncate pr-2 sm:pr-4">{checklist.title}</h3>
                                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                                      <span className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-slate-100 text-slate-500 text-[8px] sm:text-[9px] font-bold uppercase border border-slate-200">{checklist.department}</span>
                                      <span className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-blue-50 text-blue-600 text-[8px] sm:text-[9px] font-bold uppercase border border-blue-100 flex items-center gap-0.5 sm:gap-1"><Clock size={8} className="sm:w-[10px] sm:h-[10px]" /> {checklist.frequency}</span>
                                      <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                                        {(['Active', 'Draft', 'Inactive'] as const).map((s) => {
                                          const isSelected = (checklist.status || 'Draft') === s;
                                          const colorMap = {
                                            Active: isSelected ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-400 hover:text-emerald-600',
                                            Draft: isSelected ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-slate-400 hover:text-amber-600',
                                            Inactive: isSelected ? 'bg-slate-500 text-white border-slate-500' : 'bg-white text-slate-400 hover:text-slate-600',
                                          };
                                          return (
                                            <button
                                              key={s}
                                              type="button"
                                              onClick={() => updateChecklistMeta(checklist.id, { status: s })}
                                              className={`px-1.5 sm:px-2 py-0.5 text-[7px] sm:text-[8px] font-black uppercase transition-all border-r last:border-r-0 border-slate-200 ${colorMap[s]}`}
                                            >
                                              {s}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {checklist.createdByScope && !fixedPages && <span className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[8px] sm:text-[9px] font-bold uppercase border ${readOnly ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-violet-50 text-violet-600 border-violet-100'}`}>{SCOPE_LABELS[checklist.createdByScope] || checklist.createdByScope}{readOnly ? ' · Read Only' : ''}</span>}
                                  </div>
                              </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-6 lg:w-auto shrink-0 border-l-0 sm:border-l border-slate-100 pl-0 sm:pl-6 lg:border-l-0 lg:pl-0 text-left">
                              <div className="flex flex-col">
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Questions</span>
                                <div className="flex items-center gap-1.5 sm:gap-2"><BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300" /><span className="text-xs sm:text-sm font-black text-slate-800">{stats.totalQuestions}</span></div>
                              </div>
                              <div className="h-6 sm:h-8 w-px bg-slate-100 hidden sm:block" />
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <div className="flex flex-col items-center">
                                  <span className="text-[7px] sm:text-[8px] font-black text-rose-400 uppercase tracking-widest mb-0.5">High</span>
                                  <span className="text-[10px] sm:text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5">{stats.highRisk}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[7px] sm:text-[8px] font-black text-amber-400 uppercase tracking-widest mb-0.5">Med</span>
                                  <span className="text-[10px] sm:text-xs font-black text-amber-600 bg-amber-50 border border-amber-100 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5">{stats.mediumRisk}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[7px] sm:text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Low</span>
                                  <span className="text-[10px] sm:text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md sm:rounded-lg px-1.5 sm:px-2 py-0.5">{stats.lowRisk}</span>
                                </div>
                              </div>
                              <div className="h-6 sm:h-8 w-px bg-slate-100 hidden sm:block" />
                              <div className="flex flex-col">
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Max Score</span>
                                <div className="flex items-center gap-2"><span className="text-xs sm:text-sm font-black text-indigo-600">{stats.totalPossibleScore}</span></div>
                              </div>
                              {!fixedPages && <>
                              <div className="h-6 sm:h-8 w-px bg-slate-100 hidden sm:block" />
                              <div className="flex flex-col">
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Updated</span>
                                <div className="flex items-center gap-1.5 sm:gap-2"><Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300" /><span className="text-[10px] sm:text-xs font-black text-slate-800">{checklist.lastUpdated}</span></div>
                              </div>
                              </>}
                              {mclStats && <>
                              <div className="h-6 sm:h-8 w-px bg-slate-100 hidden sm:block" />
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">MCL Status</span>
                                <div className="flex items-center gap-1.5">
                                  {mclStats.live > 0 && (
                                    <span title="Live questions" className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-1.5 py-0.5 flex items-center gap-0.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-0.5" />
                                      {mclStats.live} Live
                                    </span>
                                  )}
                                  {mclStats.edited > 0 && (
                                    <span title="Live with pending edits" className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-0.5 flex items-center gap-0.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5" />
                                      {mclStats.edited} Edited
                                    </span>
                                  )}
                                  {mclStats.draft > 0 && (
                                    <span title="Draft (not yet live)" className="text-[9px] font-black text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5 flex items-center gap-0.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 mr-0.5" />
                                      {mclStats.draft} Draft
                                    </span>
                                  )}
                                  {(mclStats.live + mclStats.edited + mclStats.draft) === 0 && (
                                    <span className="text-[9px] font-black text-slate-400 italic">No rows</span>
                                  )}
                                </div>
                              </div>
                              </>}
                          </div>
                        </div>

                        {fixedPages && (
                          <div className="border-t border-slate-100 pt-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-left">
                              <div className="relative col-span-2 md:col-span-4 lg:col-span-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Equipment</span>
                                <button
                                  onClick={() => setEquipPickerOpen(equipPickerOpen === checklist.id ? null : checklist.id)}
                                  className="w-full flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:border-teal-300 transition-all text-left"
                                >
                                  <Link size={12} className="text-teal-500 shrink-0" />
                                  <span className="truncate">{attachedEquipNames.length > 0 ? `${attachedEquipNames.length} linked` : 'Attach...'}</span>
                                </button>
                                {equipPickerOpen === checklist.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setEquipPickerOpen(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-2xl w-72 max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 sticky top-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Equipment</p>
                                      </div>
                                      {equipmentList.length === 0 ? (
                                        <p className="px-3 py-4 text-xs text-slate-400 text-center italic">No equipment available</p>
                                      ) : equipmentList.filter(eq => {
                                        const isLinkedHere = checklist.attachedEquipmentIds?.includes(eq.id);
                                        if (isLinkedHere) return true;
                                        const linkedElsewhere = checklists.some(p => p.id !== checklist.id && p.attachedEquipmentIds?.includes(eq.id));
                                        return !linkedElsewhere;
                                      }).map(eq => {
                                        const isLinked = checklist.attachedEquipmentIds?.includes(eq.id);
                                        return (
                                          <button key={eq.id} onClick={() => {
                                            const cur = checklist.attachedEquipmentIds || [];
                                            const willLink = !isLinked;
                                            const next = isLinked ? cur.filter(id => id !== eq.id) : [...cur, eq.id];
                                            updateChecklistMeta(checklist.id, { attachedEquipmentIds: next });
                                            if (willLink) {
                                              checklists.forEach(p => {
                                                if (p.id !== checklist.id && p.attachedEquipmentIds?.includes(eq.id)) {
                                                  updateChecklistMeta(p.id, { attachedEquipmentIds: p.attachedEquipmentIds.filter(id => id !== eq.id) });
                                                }
                                              });
                                            }
                                            onEquipmentLink?.(checklist.title, eq.id, willLink);
                                          }} className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-all ${isLinked ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isLinked ? 'border-teal-600 bg-teal-600' : 'border-slate-300'}`}>
                                              {isLinked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-bold text-slate-800 truncate">{eq.name}</p>
                                              <p className="text-[9px] text-slate-400">{eq.idNumber}</p>
                                              {(eq.department || eq.location || eq.unit || eq.regional) && (
                                                <p className="text-[8px] text-slate-400 truncate mt-0.5">
                                                  {[eq.department, eq.location, eq.unit, eq.regional].filter(Boolean).join(' · ')}
                                                </p>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                                {attachedEquipNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {attachedEquipNames.map((eq: any) => (
                                      <span key={eq.id} className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[8px] font-bold uppercase truncate max-w-[120px]" title={eq.name}>{eq.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="relative">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cleaning Resp.</span>
                                <button
                                  type="button"
                                  onClick={() => { setRespDropdownId(respDropdownId === checklist.id && respDropdownField === 'cleaning' ? null : checklist.id); setRespDropdownField('cleaning'); setRespSearch(''); }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none hover:border-teal-400 transition-all text-left flex items-center justify-between gap-1 min-h-[36px]"
                                >
                                  <span className="truncate">{(Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : (checklist.cleaningResponsibility ? [checklist.cleaningResponsibility] : [])).length > 0 ? (Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : [checklist.cleaningResponsibility]).join(', ') : '—'}</span>
                                  <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                </button>
                                {(Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : (checklist.cleaningResponsibility ? [checklist.cleaningResponsibility] : [])).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : [checklist.cleaningResponsibility]).map(d => (
                                      <span key={d} className="px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded text-[8px] font-bold flex items-center gap-1">
                                        {d}
                                        <button type="button" onClick={() => { const current = Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : (checklist.cleaningResponsibility ? [checklist.cleaningResponsibility] : []); updateChecklistMeta(checklist.id, { cleaningResponsibility: current.filter(x => x !== d) }); }} className="hover:text-red-500"><X size={8} /></button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {respDropdownId === checklist.id && respDropdownField === 'cleaning' && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setRespDropdownId(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl w-56 max-h-52 overflow-hidden">
                                      <div className="p-2 border-b border-slate-100">
                                        <div className="relative">
                                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                          <input type="text" value={respSearch} onChange={e => setRespSearch(e.target.value)} placeholder="Search departments..." className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-teal-400" autoFocus />
                                        </div>
                                      </div>
                                      <div className="overflow-y-auto max-h-36">
                                        {departmentNames.filter(d => d.toLowerCase().includes(respSearch.toLowerCase())).map(dept => {
                                          const current = Array.isArray(checklist.cleaningResponsibility) ? checklist.cleaningResponsibility : (checklist.cleaningResponsibility ? [checklist.cleaningResponsibility] : []);
                                          const isSelected = current.includes(dept);
                                          return (
                                            <button key={dept} type="button" onClick={() => { const updated = isSelected ? current.filter(x => x !== dept) : [...current, dept]; updateChecklistMeta(checklist.id, { cleaningResponsibility: updated }); }} className={`w-full px-3 py-2 text-left text-[10px] font-bold flex items-center gap-2 transition-colors ${isSelected ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                                                {isSelected && <Check size={9} className="text-white" />}
                                              </div>
                                              {dept}
                                            </button>
                                          );
                                        })}
                                        {departmentNames.filter(d => d.toLowerCase().includes(respSearch.toLowerCase())).length === 0 && (
                                          <p className="px-3 py-3 text-[9px] text-slate-400 italic text-center">No departments found</p>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cleaning Freq.</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number" min="0"
                                    value={typeof checklist.cleaningFrequency === 'object' && checklist.cleaningFrequency ? checklist.cleaningFrequency.value || '' : ''}
                                    onChange={e => updateChecklistMeta(checklist.id, { cleaningFrequency: { value: parseInt(e.target.value) || 0, unit: (typeof checklist.cleaningFrequency === 'object' && checklist.cleaningFrequency ? checklist.cleaningFrequency.unit : 'Days') as 'Days' | 'Months' | 'Years' } })}
                                    placeholder="0"
                                    className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-teal-400 transition-all text-center"
                                  />
                                  <select
                                    value={typeof checklist.cleaningFrequency === 'object' && checklist.cleaningFrequency ? checklist.cleaningFrequency.unit : 'Days'}
                                    onChange={e => updateChecklistMeta(checklist.id, { cleaningFrequency: { value: typeof checklist.cleaningFrequency === 'object' && checklist.cleaningFrequency ? checklist.cleaningFrequency.value : 0, unit: e.target.value as 'Days' | 'Months' | 'Years' } })}
                                    className="flex-1 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-teal-400 transition-all cursor-pointer"
                                  >
                                    <option value="Days">Days</option>
                                    <option value="Months">Months</option>
                                    <option value="Years">Years</option>
                                  </select>
                                </div>
                              </div>
                              <div className="relative">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">PM Resp.</span>
                                <button
                                  type="button"
                                  onClick={() => { setRespDropdownId(respDropdownId === checklist.id && respDropdownField === 'pm' ? null : checklist.id); setRespDropdownField('pm'); setRespSearch(''); }}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none hover:border-teal-400 transition-all text-left flex items-center justify-between gap-1 min-h-[36px]"
                                >
                                  <span className="truncate">{(Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : (checklist.pmResponsibility ? [checklist.pmResponsibility] : [])).length > 0 ? (Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : [checklist.pmResponsibility]).join(', ') : '—'}</span>
                                  <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                </button>
                                {(Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : (checklist.pmResponsibility ? [checklist.pmResponsibility] : [])).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : [checklist.pmResponsibility]).map(d => (
                                      <span key={d} className="px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded text-[8px] font-bold flex items-center gap-1">
                                        {d}
                                        <button type="button" onClick={() => { const current = Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : (checklist.pmResponsibility ? [checklist.pmResponsibility] : []); updateChecklistMeta(checklist.id, { pmResponsibility: current.filter(x => x !== d) }); }} className="hover:text-red-500"><X size={8} /></button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {respDropdownId === checklist.id && respDropdownField === 'pm' && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setRespDropdownId(null)} />
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-xl w-56 max-h-52 overflow-hidden">
                                      <div className="p-2 border-b border-slate-100">
                                        <div className="relative">
                                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                          <input type="text" value={respSearch} onChange={e => setRespSearch(e.target.value)} placeholder="Search departments..." className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-teal-400" autoFocus />
                                        </div>
                                      </div>
                                      <div className="overflow-y-auto max-h-36">
                                        {departmentNames.filter(d => d.toLowerCase().includes(respSearch.toLowerCase())).map(dept => {
                                          const current = Array.isArray(checklist.pmResponsibility) ? checklist.pmResponsibility : (checklist.pmResponsibility ? [checklist.pmResponsibility] : []);
                                          const isSelected = current.includes(dept);
                                          return (
                                            <button key={dept} type="button" onClick={() => { const updated = isSelected ? current.filter(x => x !== dept) : [...current, dept]; updateChecklistMeta(checklist.id, { pmResponsibility: updated }); }} className={`w-full px-3 py-2 text-left text-[10px] font-bold flex items-center gap-2 transition-colors ${isSelected ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-300'}`}>
                                                {isSelected && <Check size={9} className="text-white" />}
                                              </div>
                                              {dept}
                                            </button>
                                          );
                                        })}
                                        {departmentNames.filter(d => d.toLowerCase().includes(respSearch.toLowerCase())).length === 0 && (
                                          <p className="px-3 py-3 text-[9px] text-slate-400 italic text-center">No departments found</p>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">PM Freq.</span>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number" min="0"
                                    value={typeof checklist.pmFrequency === 'object' && checklist.pmFrequency ? checklist.pmFrequency.value || '' : ''}
                                    onChange={e => updateChecklistMeta(checklist.id, { pmFrequency: { value: parseInt(e.target.value) || 0, unit: (typeof checklist.pmFrequency === 'object' && checklist.pmFrequency ? checklist.pmFrequency.unit : 'Days') as 'Days' | 'Months' | 'Years' } })}
                                    placeholder="0"
                                    className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-teal-400 transition-all text-center"
                                  />
                                  <select
                                    value={typeof checklist.pmFrequency === 'object' && checklist.pmFrequency ? checklist.pmFrequency.unit : 'Days'}
                                    onChange={e => updateChecklistMeta(checklist.id, { pmFrequency: { value: typeof checklist.pmFrequency === 'object' && checklist.pmFrequency ? checklist.pmFrequency.value : 0, unit: e.target.value as 'Days' | 'Months' | 'Years' } })}
                                    className="flex-1 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:border-teal-400 transition-all cursor-pointer"
                                  >
                                    <option value="Days">Days</option>
                                    <option value="Months">Months</option>
                                    <option value="Years">Years</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Created</span>
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                  <Calendar size={12} className="text-slate-300" />
                                  <span className="text-[10px] font-bold text-slate-600">{checklist.createdDate || '—'}</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modified</span>
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                  <Calendar size={12} className="text-slate-300" />
                                  <span className="text-[10px] font-bold text-slate-600">{checklist.modifiedDate || '—'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                          <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 w-full lg:w-auto px-3.5 sm:px-5 pb-3.5 sm:pb-5 flex-wrap">
                              {!readOnly && <button onClick={() => setEditingChecklist(checklist)} className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-slate-200 text-slate-500 text-[9px] sm:text-[10px] font-black uppercase hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-1.5 sm:gap-2"><Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Edit</button>}
                              {canDeleteChecklist(checklist) && (
                                deleteConfirmId === checklist.id ? (
                                  <div className="flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                    <span className="text-[10px] font-bold text-rose-600">Delete?</span>
                                    <button onClick={() => handleDeleteChecklist(checklist.id)} className="px-3 py-2 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 transition-all">Yes</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-50 transition-all">No</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirmId(checklist.id)} className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-400 text-[10px] font-black uppercase hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2"><Trash2 size={14} /> Delete</button>
                                )
                              )}
                              {(onToggleSchedule || onToggleDirectAssign) && <div className="relative">
                                <button
                                  onClick={() => setPlanDropdownId(planDropdownId === checklist.id ? null : checklist.id)}
                                  className="px-4 py-2.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 text-[10px] font-black uppercase hover:bg-violet-100 transition-all flex items-center gap-2"
                                >
                                  <Crosshair size={14} /> Plan
                                </button>
                                {planDropdownId === checklist.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setPlanDropdownId(null)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign Audit</p>
                                      </div>
                                      {(() => {
                                        const isDirectSelected = directAssignChecklistIds?.has(checklist.id) ?? false;
                                        return (
                                          <button
                                            onClick={() => { if (onToggleDirectAssign) onToggleDirectAssign(checklist.id); }}
                                            className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all text-left group hover:bg-violet-50 cursor-pointer ${isDirectSelected ? 'bg-violet-50/50' : ''}`}
                                          >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isDirectSelected ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white'}`}>
                                              {isDirectSelected && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                              )}
                                            </div>
                                            <div className={`p-2 rounded-xl shrink-0 transition-colors ${isDirectSelected ? 'bg-violet-200 text-violet-700' : 'bg-violet-100 text-violet-600 group-hover:bg-violet-200'}`}>
                                              <Send size={16} />
                                            </div>
                                            <div className="flex-1">
                                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Send to My Audits</p>
                                              <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                {isDirectSelected ? 'Click to remove from queue' : 'Select to queue for direct assignment'}
                                              </p>
                                            </div>
                                            {isDirectSelected && (
                                              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full text-[8px] font-black uppercase shrink-0">Queued</span>
                                            )}
                                          </button>
                                        );
                                      })()}
                                      <div className="h-px bg-slate-100 mx-3" />
                                      {(() => {
                                        const isSelected = scheduledChecklistIds?.has(checklist.id) ?? false;
                                        return (
                                          <button
                                            onClick={() => { if (onToggleSchedule) onToggleSchedule(checklist.id); }}
                                            className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all text-left group hover:bg-teal-50 cursor-pointer ${isSelected ? 'bg-teal-50/50' : ''}`}
                                          >
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'}`}>
                                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                            </div>
                                            <div className={`p-2 rounded-xl shrink-0 transition-colors ${isSelected ? 'bg-teal-200 text-teal-700' : 'bg-teal-100 text-teal-600 group-hover:bg-teal-200'}`}>
                                              <CalendarRange size={16} />
                                            </div>
                                            <div className="flex-1">
                                              <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Schedule via Audit Cycle</p>
                                              <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                {isSelected ? 'Click to remove from schedule templates' : 'Select to add to schedule templates'}
                                              </p>
                                            </div>
                                            {isSelected && (
                                              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 border border-teal-200 rounded-full text-[8px] font-black uppercase shrink-0">Active</span>
                                            )}
                                          </button>
                                        );
                                      })()}
                                      {scheduledChecklistIds?.has(checklist.id) && (
                                        <>
                                          <div className="h-px bg-slate-100 mx-3" />
                                          <button
                                            onClick={() => { if (onSwitchToSchedule) onSwitchToSchedule(); setPlanDropdownId(null); }}
                                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-teal-50/50 transition-all text-left group"
                                          >
                                            <div className="w-5 h-5 shrink-0" />
                                            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-500 shrink-0">
                                              <ArrowRight size={14} />
                                            </div>
                                            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Go to Schedule Tab</p>
                                          </button>
                                        </>
                                      )}
                                      {onToggleObservationChecklist && (() => {
                                        const isObsLinked = observationChecklistIds?.has(checklist.id) ?? false;
                                        const isCorporateLocked = checklist.createdByScope === 'corporate' && currentScope !== 'corporate' && currentScope !== 'super-admin';
                                        const isLocked = isObsLinked && isCorporateLocked;
                                        return (
                                          <>
                                            <div className="h-px bg-slate-100 mx-3" />
                                            <button
                                              onClick={() => { if (!isLocked) onToggleObservationChecklist(checklist.id); }}
                                              disabled={isLocked}
                                              className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all text-left group ${isLocked ? 'opacity-60 cursor-not-allowed' : isObsLinked ? 'bg-rose-50/50 cursor-pointer hover:bg-rose-50' : 'hover:bg-rose-50 cursor-pointer'}`}
                                            >
                                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isObsLinked ? 'border-rose-500 bg-rose-500' : 'border-slate-300 bg-white'}`}>
                                                {isObsLinked && (
                                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                              </div>
                                              <div className={`p-2 rounded-xl shrink-0 transition-colors ${isObsLinked ? 'bg-rose-200 text-rose-700' : 'bg-rose-100 text-rose-600 group-hover:bg-rose-200'}`}>
                                                <ClipboardList size={16} />
                                              </div>
                                              <div className="flex-1">
                                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Use in Observation Registry</p>
                                                <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                  {isLocked ? 'Linked by Corporate — cannot be changed' : isObsLinked ? 'Click to unlink from observation registry' : 'Auto-add questions to observation form'}
                                                </p>
                                              </div>
                                              {isObsLinked && (
                                                <span className={`px-2 py-0.5 border rounded-full text-[8px] font-black uppercase shrink-0 ${isCorporateLocked ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                                                  {isCorporateLocked ? 'Locked' : 'Active'}
                                                </span>
                                              )}
                                            </button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </>
                                )}
                              </div>}
                              <button onClick={() => setPreviewingChecklist(checklist)} className="px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95"><Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Preview</button>
                              <div className="relative">
                                <button onClick={() => setDownloadDropdownId(downloadDropdownId === checklist.id ? null : checklist.id)} className="px-3 sm:px-4 py-2 sm:py-2.5 bg-cyan-600 text-white rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase hover:bg-cyan-700 shadow-lg shadow-cyan-200 transition-all flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95"><FileDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Download <ChevronDown size={10} className="sm:w-3 sm:h-3" /></button>
                                {downloadDropdownId === checklist.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setDownloadDropdownId(null)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden min-w-[220px]">
                                      <button onClick={() => { setDownloadDropdownId(null); setDownloadingChecklist(checklist); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><FileText size={16} className="text-rose-500" /></div>
                                        <div><p className="text-[11px] font-bold text-slate-700">PDF</p><p className="text-[10px] text-slate-400">Download as PDF document</p></div>
                                      </button>
                                      <div className="h-px bg-slate-100" />
                                      <button onClick={() => { setDownloadDropdownId(null); setExcelDownloadingChecklist(checklist); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><FileSpreadsheet size={16} className="text-emerald-500" /></div>
                                        <div><p className="text-[11px] font-bold text-slate-700">Excel (Department-wise)</p><p className="text-[10px] text-slate-400">Sheet per department + consolidated</p></div>
                                      </button>
                                      <div className="h-px bg-slate-100" />
                                      <button onClick={() => { setDownloadDropdownId(null); setExcelLocationDownloadingChecklist(checklist); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><MapPin size={16} className="text-amber-500" /></div>
                                        <div><p className="text-[11px] font-bold text-slate-700">Excel (Location-wise)</p><p className="text-[10px] text-slate-400">Sheet per location/area + consolidated</p></div>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="w-px h-8 bg-slate-200 mx-1" />
                              <button onClick={() => setExpandedId(isExpanded ? null : checklist.id)} className={`p-2.5 rounded-xl border transition-all ${isExpanded ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'}`}>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                          </div>

                      {isExpanded && (
                          <div className="bg-slate-50 border-t border-slate-100 p-6 animate-in slide-in-from-top-2 text-left">
                              <div className="flex items-center gap-3 mb-4"><History size={16} className="text-slate-400" /><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Recent Audit History</h4></div>
                              {checklist.history.length > 0 ? (
                                  <div className="space-y-3">
                                      {checklist.history.map(entry => (
                                          <div key={entry.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition-all">
                                              <div className="flex items-center gap-4"><div className={`p-2 rounded-lg ${entry.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{entry.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}</div><div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-800">{entry.auditDate}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${entry.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{entry.status}</span></div><p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">Auditor: {entry.auditor}</p></div></div>
                                              <div className="flex items-center gap-6 border-t sm:border-t-0 border-slate-50 pt-3 sm:pt-0">{entry.findings > 0 ? <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 px-3 py-1 rounded-lg border border-rose-100"><AlertTriangle size={12} /><span className="text-[10px] font-black uppercase">{entry.findings} Issues</span></div> : <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100"><CheckCircle2 size={12} /> <span className="text-[10px] font-black uppercase">Clean</span></div>}<div className="text-right min-w-[60px]"><ScoreBadge score={entry.score} status={entry.status} /></div><button className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">Report <ArrowRight size={12} /></button><button onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(checklist.id, entry.id); }} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Delete this record"><Trash2 size={14} /></button></div>
                                          </div>
                                      ))}
                                  </div>
                              ) : <div className="py-8 text-center bg-white rounded-xl border border-dashed border-slate-200"><p className="text-xs text-slate-400 italic">No history recorded.</p></div>}
                          </div>
                      )}
                  </div>
              );
          })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <UnifiedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredChecklists.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
        />
      </div>

      {scheduledAudits.length > 0 && (
        <div className="space-y-4">
          <button onClick={() => setScheduledAuditsCollapsed(!scheduledAuditsCollapsed)} className="flex items-center gap-3 group">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100"><CalendarPlus size={18} /></div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Scheduled Audits</h3>
            <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 text-[10px] font-black rounded-lg border border-teal-200">{scheduledAudits.length}</span>
            {scheduledAuditsCollapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
          </button>

          {!scheduledAuditsCollapsed && scheduledAudits.map(sa => {
            const completedCount = sa.locations.filter(l => l.status === 'Completed').length;
            const totalCount = sa.locations.length;
            const allDone = allLocationsComplete(sa);
            const remaining = totalCount - completedCount;

            return (
              <div key={sa.id} className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-lg border border-indigo-100 truncate max-w-[200px]">{sa.checklistTitle}</span>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={11} /> {sa.scheduledDate} {sa.dueDate && `→ ${sa.dueDate}`}</span>
                    <StatusPill status={sa.overallStatus} />
                  </div>
                  <button onClick={() => deleteScheduledAudit(sa.id)} className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all self-end sm:self-auto"><Trash2 size={16} /></button>
                </div>

                {sa.notes && <p className="text-[10px] italic text-slate-400 -mt-2 pl-1">{sa.notes}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sa.locations.map(loc => (
                    <div key={loc.locationId} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 hover:border-teal-200 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-teal-500 shrink-0" />
                            <span className="text-sm font-black text-slate-800 leading-tight">{loc.locationName}</span>
                          </div>
                          {loc.department && <span className="text-[9px] font-bold text-slate-400 uppercase ml-4">{loc.department}</span>}
                        </div>
                        <StatusPill status={loc.status} />
                      </div>

                      {loc.completedAt && <p className="text-[9px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={10} /> Completed {loc.completedAt}</p>}

                      {loc.assignedTeam.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {loc.assignedTeam.map((m, mi) => <TeamChip key={mi} name={m} />)}
                        </div>
                      )}

                      {loc.score !== undefined && (
                        <div className="text-right">
                          <span className={`text-sm font-black ${loc.score >= 90 ? 'text-emerald-600' : loc.score >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>{loc.score}%</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        {(loc.status === 'Scheduled' || loc.status === 'In Progress') && (
                          <button onClick={() => beginLocationAudit(sa.id, loc.locationId)} className="flex-1 px-3 py-2 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-violet-700 shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                            <Play size={11} /> {loc.status === 'Scheduled' ? 'Begin Audit' : 'Continue'}
                          </button>
                        )}
                        {loc.status === 'In Progress' && (
                          <button onClick={() => setCompleteDialog({ saId: sa.id, locId: loc.locationId, score: '', notes: '' })} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                            <CheckCircle2 size={11} /> Mark Complete
                          </button>
                        )}
                        {loc.status === 'Completed' && (
                          <span className="flex-1 text-center text-[9px] font-black text-emerald-600 uppercase py-2">Audit Complete</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {sa.locations.map((l, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full ${l.status === 'Completed' ? 'bg-emerald-500' : l.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-500">{completedCount} / {totalCount} locations completed</span>
                  </div>
                  <button
                    onClick={() => handleExportUnitReport(sa)}
                    disabled={!allDone}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 ${allDone ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-200' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'}`}
                    title={!allDone ? `Awaiting ${remaining} location(s)` : 'Export consolidated report'}
                  >
                    <Download size={14} /> Export Unit Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isCreateModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 text-left">
                  <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">New Checklist</h3><button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button></div>
                  <div className="space-y-5">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Template Title</label><input autoFocus className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all shadow-inner" placeholder="e.g. Opening Checks" value={newChecklist.title} onChange={e => setNewChecklist({...newChecklist, title: e.target.value})} /></div>
                  </div>
                  <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100"><button onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button><button onClick={handleCreate} className="flex-[2] py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Create Template</button></div>
              </div>
          </div>
      )}

      {schedulingChecklist && (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSchedulingChecklist(null)}>
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[88vh] border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100"><CalendarPlus size={20} /></div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Schedule Audit</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate max-w-[250px]">{schedulingChecklist.title}</p>
                </div>
              </div>
              <button onClick={() => setSchedulingChecklist(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Scheduled Date *</label>
                  <input type="date" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-teal-400 transition-all" value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(f => ({ ...f, scheduledDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date</label>
                  <input type="date" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-teal-400 transition-all" value={scheduleForm.dueDate} onChange={e => setScheduleForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes (optional)</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-teal-400 transition-all" placeholder="Any additional context..." value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Locations & Teams</label>
                  <button onClick={addScheduleLocation} className="text-[10px] font-black text-teal-600 hover:text-teal-700 flex items-center gap-1"><Plus size={12} /> Add Location</button>
                </div>

                {scheduleForm.locations.map((loc, locIdx) => (
                  <div key={locIdx} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Location {locIdx + 1}</span>
                      {scheduleForm.locations.length > 1 && (
                        <button onClick={() => removeScheduleLocation(locIdx)} className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"><Trash2 size={13} /></button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-1">Location Name *</label>
                        <input list={`locations-${locIdx}`} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-400 transition-all" placeholder="e.g. NY Kitchen 1" value={loc.locationName} onChange={e => updateScheduleLocation(locIdx, 'locationName', e.target.value)} />
                        <datalist id={`locations-${locIdx}`}>
                          {locationNames.map((n, i) => <option key={i} value={n} />)}
                        </datalist>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 ml-1">Department</label>
                        <input className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-400 transition-all" placeholder="e.g. Quality Assurance" value={loc.department} onChange={e => updateScheduleLocation(locIdx, 'department', e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 ml-1">Team Members</label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-teal-400 transition-all"
                          placeholder="Add auditor name..."
                          value={loc.teamInput}
                          onChange={e => updateScheduleLocation(locIdx, 'teamInput', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTeamMember(locIdx); } }}
                        />
                        <button onClick={() => addTeamMember(locIdx)} className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase border border-amber-200 hover:bg-amber-200 transition-all">Add</button>
                      </div>
                      {loc.team.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {loc.team.map((m, mi) => <TeamChip key={mi} name={m} onRemove={() => removeTeamMember(locIdx, mi)} />)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => setSchedulingChecklist(null)} className="flex-1 py-3.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button
                onClick={handleCreateSchedule}
                disabled={!canCreateSchedule}
                className={`flex-[2] py-3.5 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all ${canCreateSchedule ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
              >
                Create Schedule
              </button>
            </div>
          </div>
        </div>
      )}


      {completeDialog && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setCompleteDialog(null)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 border border-emerald-200 animate-in zoom-in-95 text-left" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100"><CheckCircle2 size={20} /></div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Complete Location</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Score (0–100, optional)</label>
                <input type="number" min={0} max={100} className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 transition-all" placeholder="e.g. 92" value={completeDialog.score} onChange={e => setCompleteDialog(d => d ? { ...d, score: e.target.value } : null)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes (optional)</label>
                <input type="text" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 transition-all" placeholder="Completion notes..." value={completeDialog.notes} onChange={e => setCompleteDialog(d => d ? { ...d, notes: e.target.value } : null)} />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
              <button onClick={() => setCompleteDialog(null)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
              <button onClick={handleConfirmComplete} className="flex-[2] py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95">Confirm Complete</button>
            </div>
          </div>
        </div>
      )}

      {previewingChecklist && (
        <AuditChecklistPreview
          template={previewingChecklist}
          onClose={() => setPreviewingChecklist(null)}
          draftKey={previewingChecklist.id}
          trialMode={true}
        />
      )}

      {downloadingChecklist && (
        <AuditChecklistPreview
          template={downloadingChecklist}
          onClose={() => setDownloadingChecklist(null)}
          autoTriggerDownload={true}
        />
      )}

      {excelDownloadingChecklist && (
        <AuditChecklistPreview
          template={excelDownloadingChecklist}
          onClose={() => setExcelDownloadingChecklist(null)}
          autoTriggerExcelDownload={true}
        />
      )}

      {excelLocationDownloadingChecklist && (
        <AuditChecklistPreview
          template={excelLocationDownloadingChecklist}
          onClose={() => setExcelLocationDownloadingChecklist(null)}
          autoTriggerExcelLocationDownload={true}
        />
      )}
    </div>
  );
};

export default ChecklistEditor;
