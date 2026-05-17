"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Trash2, Save, Send, ChevronDown, Search,
  Check, X, AlertTriangle, Download, Upload, RefreshCw, BookOpen,
  Table2, CheckCircle2, Clock, Filter, EyeOff, Eye, Users,
  CopyPlus, Layers2, Flag,
} from 'lucide-react';
import { ChecklistTemplate, QuestionNode, SectionNode, PageNode, SubSectionNode, ResponseSet } from './AuditChecklistCreator';

export interface DeptResponsibilityPair {
  department: string;
  responsibility: string;
}

export interface MasterChecklistRow {
  id: string;
  slNo: number;
  sopName: string;
  subSopName: string;
  question: string;
  standard: string;
  riskCategory: 'High' | 'Medium' | 'Low' | 'Critical' | '';
  category: string;
  deptResponsibility: DeptResponsibilityPair[];
  maxScore: number;
  rowStatus?: 'draft' | 'synced' | 'pending-sync';
  syncedSnapshot?: string;
  isInactive?: boolean;
  isFollowUp?: boolean;
  updatedAt?: string;
  checklistType?: string[];
  sectionName?: string;
  mergedFrom?: { question: string; id: string }[];
  responseSetId?: string;
}

export interface MasterChecklist {
  id: string;
  title: string;
  status: 'draft' | 'submitted';
  rows: MasterChecklistRow[];
  createdAt: string;
  updatedAt?: string;
  submittedAt?: string;
  createdByScope?: string;
  createdByEntityId?: string | null;
  linkedChecklistId?: string;
}

const RISK_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const RISK_COLORS: Record<string, string> = {
  Critical: 'bg-rose-100 text-rose-700 border-rose-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const newRow = (slNo: number): MasterChecklistRow => ({
  id: `mcr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  slNo,
  sopName: '',
  subSopName: '',
  question: '',
  standard: '',
  riskCategory: '',
  category: '',
  deptResponsibility: [{ department: '', responsibility: '' }],
  maxScore: 0,
  rowStatus: 'draft',
  checklistType: [],
  sectionName: '',
});

const convertChecklistToRows = (checklist: ChecklistTemplate): MasterChecklistRow[] => {
  // Use a map keyed by question text to merge same-question rows
  // (the same question may appear in multiple department-pages → stack dept/resp pairs on one row)
  const mergeMap = new Map<string, MasterChecklistRow>();
  let slNo = 1;

  const upsertRow = (row: MasterChecklistRow) => {
    const key = row.question.trim().toLowerCase();
    if (!key) {
      // Blank question: always its own row
      mergeMap.set(`blank-${row.id}`, row);
      return;
    }
    if (mergeMap.has(key)) {
      // Merge dept/resp pairs into existing row, dedup by department
      const existing = mergeMap.get(key)!;
      const seenDepts = new Set(existing.deptResponsibility.map(p => p.department));
      const newPairs = row.deptResponsibility.filter(p => p.department && !seenDepts.has(p.department));
      existing.deptResponsibility = [...existing.deptResponsibility, ...newPairs];
    } else {
      mergeMap.set(key, { ...row, slNo: slNo++ });
    }
  };

  for (const page of checklist.pages || []) {
    for (const section of page.sections || []) {
      for (const q of section.questions || []) {
        upsertRow({
          id: `mcr-sync-${q.id}-${Math.random().toString(36).slice(2, 5)}`,
          slNo: 0,
          sopName: section.title || '',
          subSopName: '',
          question: q.text || '',
          standard: q.requirement || '',
          riskCategory: (['Critical', 'High', 'Medium', 'Low'].includes(q.risk) ? q.risk : '') as MasterChecklistRow['riskCategory'],
          category: q.category || '',
          deptResponsibility: (Array.isArray(q.responsibility) && q.responsibility.length > 0)
            ? q.responsibility.map(r => ({ department: page.title || '', responsibility: r }))
            : [{ department: page.title || '', responsibility: '' }],
          maxScore: q.maxScore || 0,
          rowStatus: 'synced',
        });
      }
      for (const subSection of section.subSections || []) {
        for (const q of subSection.questions || []) {
          upsertRow({
            id: `mcr-sync-${q.id}-${Math.random().toString(36).slice(2, 5)}`,
            slNo: 0,
            sopName: section.title || '',
            subSopName: subSection.title || '',
            question: q.text || '',
            standard: q.requirement || '',
            riskCategory: (['Critical', 'High', 'Medium', 'Low'].includes(q.risk) ? q.risk : '') as MasterChecklistRow['riskCategory'],
            category: q.category || '',
            deptResponsibility: (Array.isArray(q.responsibility) && q.responsibility.length > 0)
              ? q.responsibility.map(r => ({ department: page.title || '', responsibility: r }))
              : [{ department: page.title || '', responsibility: '' }],
            maxScore: q.maxScore || 0,
            rowStatus: 'synced',
          });
        }
      }
    }
  }

  const result = Array.from(mergeMap.values()).map((r, i) => ({ ...r, slNo: i + 1 }));
  return result.length > 0 ? result : [newRow(1)];
};

const countChecklistQuestions = (checklist: ChecklistTemplate): number =>
  (checklist.pages || []).reduce((acc, p) =>
    acc + (p.sections || []).reduce((sa, s) =>
      sa + (s.questions?.length || 0) + ((s.subSections || []).reduce((ssa, ss) => ssa + (ss.questions?.length || 0), 0)), 0), 0);

interface SearchableDropdownProps {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  allowCustom?: boolean;
  className?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ value, options, placeholder = 'Select…', onChange, disabled, allowCustom, className }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(v => !v); setSearch(''); } }}
        className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs font-medium text-left transition-all ${disabled ? 'bg-transparent text-slate-300 cursor-default' : 'hover:bg-violet-50 focus:outline-none focus:ring-1 focus:ring-violet-400'} ${value ? 'text-slate-700' : 'text-slate-300'}`}
      >
        <span className="truncate flex-1">{value || placeholder}</span>
        {!disabled && <ChevronDown size={10} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0.5 z-[200] bg-white border border-slate-200 rounded-xl shadow-2xl min-w-[160px] max-w-[240px] overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">
              <Search size={10} className="text-slate-400 shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 text-[10px] bg-transparent outline-none text-slate-700 w-20"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="w-full px-3 py-1.5 text-left text-[10px] text-slate-400 hover:bg-slate-50 flex items-center gap-1.5 italic border-b border-slate-50">
                <X size={9} /> Clear
              </button>
            )}
            {filtered.length === 0 && !allowCustom && <p className="px-3 py-2 text-[10px] text-slate-400 italic">No matches</p>}
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full px-3 py-1.5 text-left text-[10px] hover:bg-violet-50 flex items-center gap-1.5 transition-colors ${value === opt ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-700'}`}
              >
                {value === opt && <Check size={9} className="text-violet-600 shrink-0" />}
                {opt}
              </button>
            ))}
            {allowCustom && search.trim() && !options.includes(search.trim()) && (
              <button type="button" onClick={() => { onChange(search.trim()); setOpen(false); }} className="w-full px-3 py-1.5 text-left text-[10px] text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 border-t border-slate-100">
                <Plus size={9} /> Add "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface MultiSelectDropdownProps {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ value, options, placeholder = 'Select…', onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt: string) => {
    const s = new Set(selected);
    s.has(opt) ? s.delete(opt) : s.add(opt);
    onChange([...s].join(', '));
  };

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(v => !v); setSearch(''); } }}
        className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs font-medium text-left transition-all ${disabled ? 'bg-transparent text-slate-300 cursor-default' : 'hover:bg-violet-50 focus:outline-none'} ${selected.length ? 'text-slate-700' : 'text-slate-300'}`}
      >
        <span className="truncate flex-1 text-[10px]">
          {selected.length === 0 ? placeholder : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`}
        </span>
        {!disabled && <ChevronDown size={10} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-0.5 z-[200] bg-white border border-slate-200 rounded-xl shadow-2xl min-w-[180px] max-w-[260px] overflow-hidden">
          <div className="p-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">
              <Search size={10} className="text-slate-400 shrink-0" />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="flex-1 text-[10px] bg-transparent outline-none text-slate-700 w-20" />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {selected.length > 0 && (
              <button type="button" onClick={() => { onChange(''); }} className="w-full px-3 py-1.5 text-left text-[10px] text-slate-400 hover:bg-slate-50 flex items-center gap-1.5 italic border-b border-slate-50">
                <X size={9} /> Clear all
              </button>
            )}
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`w-full px-3 py-1.5 text-left text-[10px] hover:bg-violet-50 flex items-center gap-1.5 transition-colors ${selected.includes(opt) ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-700'}`}
              >
                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${selected.includes(opt) ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                  {selected.includes(opt) && <Check size={8} className="text-white" />}
                </div>
                {opt}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-[10px] text-slate-400 italic">No matches</p>}
          </div>
          {selected.length > 0 && (
            <div className="p-1.5 border-t border-slate-100 flex flex-wrap gap-1">
              {selected.map(s => (
                <span key={s} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[8px] font-bold">
                  {s} <button type="button" onClick={() => toggle(s)} className="hover:text-rose-500"><X size={8} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface MasterChecklistTableProps {
  sopNames?: string[];
  sopSubTopics?: Record<string, string[]>;
  departmentNames?: string[];
  allCategories?: string[];
  currentScope?: string;
  userRootId?: string | null;
  userName?: string;
  onChecklistGenerated?: (checklist: ChecklistTemplate) => void;
  onRowSynced?: (checklist: ChecklistTemplate) => void;
  linkedChecklistId?: string;
  linkedChecklistTitle?: string;
  linkedChecklist?: ChecklistTemplate;
  responseSets?: ResponseSet[];
  entities?: Entity[];
  fixedPages?: { title: string }[];
}

const MasterChecklistTable: React.FC<MasterChecklistTableProps> = ({
  sopNames = [],
  sopSubTopics = {},
  departmentNames = [],
  allCategories = [],
  currentScope,
  userRootId,
  userName,
  onChecklistGenerated,
  onRowSynced,
  linkedChecklistId,
  linkedChecklistTitle,
  linkedChecklist,
  responseSets = [],
  entities = [],
  fixedPages,
}) => {
  const facilityNewRow = (slNo: number): MasterChecklistRow => {
    const base = newRow(slNo);
    if (fixedPages && fixedPages.length > 0) {
      base.deptResponsibility = [{ department: fixedPages[0].title, responsibility: '' }];
    }
    return base;
  };

  const [masterChecklists, setMasterChecklists] = useState<MasterChecklist[]>([]);
  const [activeMclId, setActiveMclId] = useState<string | null>(null);
  const [rows, setRows] = useState<MasterChecklistRow[]>([]);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingSlNo, setEditingSlNo] = useState<{ rowId: string; value: string } | null>(null);
  const [mergeModal, setMergeModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<'existing' | 'new'>('existing');
  const [mergeSelectedId, setMergeSelectedId] = useState('');
  const [mergeNewText, setMergeNewText] = useState('');
  const [mergeResponseSetId, setMergeResponseSetId] = useState<string>('');
  const [splitModal, setSplitModal] = useState<{ rowId: string; question: string } | null>(null);
  const [splitQuestions, setSplitQuestions] = useState<string[]>(['', '']);
  const [isLoading, setIsLoading] = useState(true);
  const [deptPickerOpen, setDeptPickerOpen] = useState<{rowId: string; pairIdx: number} | null>(null);
  const [deptPickerSel, setDeptPickerSel] = useState<string[]>([]);
  const [deptPickerSearch, setDeptPickerSearch] = useState('');
  const [deptPickerPos, setDeptPickerPos] = useState<{top: number; left: number}>({top: 0, left: 0});
  const deptPickerRef = useRef<HTMLDivElement>(null);
  const deptPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [filterPendingSync, setFilterPendingSync] = useState(false);
  const [filterMissingField, setFilterMissingField] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'live' | 'inactive' | 'edited'>('all');
  const [filterSop, setFilterSop] = useState('');
  const [filterSubSop, setFilterSubSop] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterResponsibility, setFilterResponsibility] = useState('');
  const [filterNoDept, setFilterNoDept] = useState(false);
  const [filterNoResp, setFilterNoResp] = useState(false);
  const [filterRepeat, setFilterRepeat] = useState(false);
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkSopName, setBulkSopName] = useState('');
  const [bulkSopRisk, setBulkSopRisk] = useState('');
  const [bulkSopMarks, setBulkSopMarks] = useState<number | ''>('');
  const [bulkSubSopName, setBulkSubSopName] = useState('');
  const [bulkSubSopRisk, setBulkSubSopRisk] = useState('');
  const [bulkSubSopMarks, setBulkSubSopMarks] = useState<number | ''>('');
  const [bulkDepts, setBulkDepts] = useState<string[]>([]);
  const [bulkResps, setBulkResps] = useState<string[]>([]);
  const [mclDropdownOpen, setMclDropdownOpen] = useState(false);
  const mclDropdownRef = useRef<HTMLDivElement>(null);
  const csvUploadRef = useRef<HTMLInputElement>(null);
  const hasAutoImported = useRef(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sections, setSections] = useState<string[]>([]);

  type ReviewStatus = 'new' | 'modified' | 'unchanged';
  type ReviewRowEntry = { row: MasterChecklistRow; status: ReviewStatus; changes: string[]; dbRow: MasterChecklistRow | null };
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRowEntry[]>([]);
  const [reviewIncluded, setReviewIncluded] = useState<Set<string>>(new Set());
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const categoryOptions = allCategories.length > 0 ? allCategories : ['Process', 'Hygiene', 'Maintenance', 'Training', 'Documentation'];

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadMasterChecklists = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/master-checklists');
      if (res.ok) {
        const data = await res.json();
        setMasterChecklists(data);
        if (data.length > 0 && !activeMclId) {
          if (linkedChecklistId) {
            // Form-embedded view: only auto-select the MCL linked to THIS checklist.
            // A new checklist with no linked MCL yet stays blank.
            // Primary match: by linkedChecklistId
            let linked: MasterChecklist | undefined = data.find((m: MasterChecklist) => m.linkedChecklistId === linkedChecklistId);
            // Retroactive fallback: MCLs saved before linkedChecklistId was persisted
            // Match by title prefix "MCL — <checklistTitle>" if only one candidate exists
            if (!linked && linkedChecklist?.title) {
              const expectedPrefix = `MCL — ${linkedChecklist.title}`;
              const candidates = data.filter((m: MasterChecklist) => !m.linkedChecklistId && m.title?.startsWith(expectedPrefix));
              if (candidates.length === 1) {
                linked = candidates[0];
                // Immediately stamp linkedChecklistId on the recovered MCL so future loads work
                try {
                  await fetch('/api/master-checklists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...linked, linkedChecklistId }),
                  });
                } catch { /* best-effort */ }
              }
            }
            if (linked) {
              setActiveMclId(linked.id);
              setTitle(linked.title || '');
              setRows((linked.rows || []).map((r: MasterChecklistRow, i: number) => migrateRow(r as MasterChecklistRow & Record<string, unknown>, i)));
            }
            // No linked MCL found → leave blank for new checklist.
          } else {
            // Library-wide view (no linkedChecklistId): auto-select the most recent MCL.
            const first = data[0];
            setActiveMclId(first.id);
            setTitle(first.title || '');
            setRows((first.rows || []).map((r: MasterChecklistRow, i: number) => migrateRow(r as MasterChecklistRow & Record<string, unknown>, i)));
          }
        }
      }
    } catch { }
    setIsLoading(false);
  }, [activeMclId, linkedChecklistId]);

  useEffect(() => { loadMasterChecklists(); }, []);

  // Auto-save: debounce 2 s after any row/title change while an active MCL exists
  useEffect(() => {
    if (!activeMclId || isLoading) return;
    setAutoSaveStatus('pending');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const resolvedRows = rows.map((r, i) => {
          const row = { ...r, slNo: i + 1 };
          if (row.rowStatus === 'synced' && row.syncedSnapshot) {
            try {
              const snap = JSON.parse(row.syncedSnapshot);
              const cur = { question: row.question, sopName: row.sopName, subSopName: row.subSopName, standard: row.standard, riskCategory: row.riskCategory, category: row.category, maxScore: row.maxScore, deptResponsibility: row.deptResponsibility };
              if (JSON.stringify(cur) !== JSON.stringify(snap)) return { ...row, rowStatus: 'pending-sync' as const };
            } catch { /* ignore */ }
          }
          return row;
        });
        const mcl: MasterChecklist = {
          id: activeMclId,
          title: title || 'Untitled Master Checklist',
          status: 'draft',
          rows: resolvedRows,
          createdAt: getCurrentMcl()?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByScope: currentScope,
          createdByEntityId: userRootId,
          ...(linkedChecklistId ? { linkedChecklistId } : {}),
        };
        const res = await fetch('/api/master-checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mcl),
        });
        if (res.ok) {
          setMasterChecklists(prev => prev.map(m => m.id === activeMclId ? mcl : m));
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2500);
        } else {
          setAutoSaveStatus('idle');
        }
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, title, activeMclId]);

  const importFromChecklist = useCallback(async (force = false) => {
    if (!linkedChecklist) return;
    const converted = convertChecklistToRows(linkedChecklist);
    const qCount = converted.filter(r => r.question.trim()).length;
    if (force && rows.some(r => r.question.trim())) {
      if (!window.confirm(`Replace all current rows with ${qCount} questions from "${linkedChecklist.title}"?`)) return;
    }
    const defaultTitle = `MCL — ${linkedChecklist.title || 'Checklist'}`;
    const numberedRows = converted.map((r, i) => ({ ...r, slNo: i + 1 }));
    if (!activeMclId) {
      const newMcl: MasterChecklist = {
        id: `mcl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: defaultTitle,
        status: 'draft',
        rows: numberedRows,
        createdAt: new Date().toISOString(),
        createdByScope: currentScope,
        createdByEntityId: userRootId,
        // CRITICAL: persist linkedChecklistId so this MCL is re-found on next load
        ...(linkedChecklistId ? { linkedChecklistId } : {}),
      };
      // Persist to DB immediately (don't rely on debounce — user may refresh before it fires)
      try {
        await fetch('/api/master-checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMcl),
        });
      } catch { /* best-effort; auto-save will retry */ }
      setMasterChecklists(prev => [newMcl, ...prev]);
      setActiveMclId(newMcl.id);
      setTitle(newMcl.title);
    } else {
      if (!title) setTitle(defaultTitle);
    }
    setRows(numberedRows);
    showToast(`Loaded ${qCount} question${qCount !== 1 ? 's' : ''} from checklist`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedChecklist, activeMclId, currentScope, userRootId, title, linkedChecklistId]);

  useEffect(() => {
    if (isLoading || !linkedChecklist || hasAutoImported.current) return;
    hasAutoImported.current = true;
    const hasContent = rows.some(r => r.question.trim());
    if (!hasContent) importFromChecklist(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mclDropdownRef.current && !mclDropdownRef.current.contains(e.target as Node)) setMclDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const migrateRow = (r: MasterChecklistRow & Record<string, unknown>, i: number): MasterChecklistRow => {
    const old = r as Record<string, unknown>;
    let deptResp = r.deptResponsibility;
    if (!deptResp || !Array.isArray(deptResp)) {
      const dept = (old.department as string) || '';
      const resp = (old.responsibility as string) || '';
      const depts = dept ? dept.split(',').map(d => d.trim()).filter(Boolean) : [];
      deptResp = depts.length > 0
        ? depts.map(d => ({ department: d, responsibility: resp }))
        : [{ department: dept, responsibility: resp }];
    }
    return { ...r, slNo: i + 1, deptResponsibility: deptResp };
  };

  const switchToMcl = (mcl: MasterChecklist) => {
    setActiveMclId(mcl.id);
    setTitle(mcl.title || '');
    setRows((mcl.rows || []).map((r, i) => migrateRow(r as MasterChecklistRow & Record<string, unknown>, i)));
    setSelectedRows(new Set());
    setFilterDept('');
    setFilterRisk('');
    setMclDropdownOpen(false);
  };

  const createNew = () => {
    const defaultTitle = linkedChecklistTitle ? `MCL — ${linkedChecklistTitle}` : 'New Master Checklist';
    const newMcl: MasterChecklist = {
      id: `mcl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: defaultTitle,
      status: 'draft',
      rows: [facilityNewRow(1)],
      createdAt: new Date().toISOString(),
      createdByScope: currentScope,
      createdByEntityId: userRootId,
    };
    setMasterChecklists(prev => [newMcl, ...prev]);
    switchToMcl(newMcl);
  };

  // Mark a synced row as edited immediately on any change, and stamp the update time
  const pendingStatus = (r: MasterChecklistRow) =>
    r.rowStatus === 'synced' ? ('pending-sync' as const) : (r.rowStatus ?? 'draft');
  const touch = (r: MasterChecklistRow) => ({ rowStatus: pendingStatus(r), updatedAt: new Date().toISOString() });

  // Format an ISO timestamp as "Today 6:30 PM", "Yesterday 6:30 PM", or "13 Mar 2026, 6:30 PM"
  const fmtTime = (iso?: string): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + time;
  };

  const updateRow = (rowId: string, field: keyof MasterChecklistRow, value: string | number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: value, ...touch(r) };
      if (field === 'sopName') updated.subSopName = '';
      return updated;
    }));
  };

  const updateDeptResp = (rowId: string, index: number, field: 'department' | 'responsibility', value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const pairs = [...r.deptResponsibility];
      const current = { ...pairs[index], [field]: value };
      if (field === 'department') {
        const prevPair = pairs[index - 1];
        const parentDeptEqualsResp = prevPair && prevPair.department === prevPair.responsibility;
        if (parentDeptEqualsResp || !current.responsibility) {
          current.responsibility = value;
        }
      }
      pairs[index] = current;
      return { ...r, deptResponsibility: pairs, ...touch(r) };
    }));
  };

  const addDeptResp = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const lastPair = r.deptResponsibility[r.deptResponsibility.length - 1];
      const newPair = { department: '', responsibility: lastPair?.responsibility || '' };
      return { ...r, deptResponsibility: [...r.deptResponsibility, newPair], ...touch(r) };
    }));
  };

  const removeDeptResp = (rowId: string, index: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const pairs = r.deptResponsibility.filter((_, i) => i !== index);
      return { ...r, deptResponsibility: pairs.length === 0 ? [{ department: '', responsibility: '' }] : pairs, ...touch(r) };
    }));
  };

  const openDeptPicker = (e: React.MouseEvent<HTMLButtonElement>, rowId: string, pairIdx: number, currentDept: string) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    deptPickerTriggerRef.current = btn;
    setDeptPickerPos({ top: rect.bottom + 4, left: rect.left });
    setDeptPickerOpen({ rowId, pairIdx });
    setDeptPickerSel(currentDept ? [currentDept] : []);
    setDeptPickerSearch('');
  };

  useEffect(() => {
    if (!deptPickerOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (deptPickerRef.current && !deptPickerRef.current.contains(e.target as Node)) {
        setDeptPickerOpen(null);
      }
    };
    const handleScroll = () => {
      if (!deptPickerTriggerRef.current) return;
      const rect = deptPickerTriggerRef.current.getBoundingClientRect();
      setDeptPickerPos({ top: rect.bottom + 4, left: rect.left });
    };
    document.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [deptPickerOpen]);

  // Compute departments already taken by other rows with the same question text
  const getPickerTakenDepts = (rowId: string): Set<string> => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return new Set();
    const qText = row.question.trim().toLowerCase();
    const taken = new Set<string>();
    rows.forEach(r => {
      if (r.id === rowId) return; // skip current row
      // same question = same dept is a duplicate
      if (r.question.trim().toLowerCase() === qText) {
        r.deptResponsibility.forEach(p => { if (p.department) taken.add(p.department); });
      }
    });
    return taken;
  };

  const applyDeptPicker = () => {
    if (!deptPickerOpen) return;
    const { rowId, pairIdx } = deptPickerOpen;
    setDeptPickerOpen(null);
    if (deptPickerSel.length === 0) return;

    // Strip out any departments already used by the same question in other rows
    const takenDepts = getPickerTakenDepts(rowId);
    const safeSel = deptPickerSel.filter(d => !takenDepts.has(d));
    if (safeSel.length === 0) return;

    if (safeSel.length === 1) {
      // Single dept: just update the pair's department field
      updateDeptResp(rowId, pairIdx, 'department', safeSel[0]);
      return;
    }

    // Multiple depts: stack all as pairs on the SAME row (no row explosion)
    setRows(prev => {
      const rowIdx = prev.findIndex(r => r.id === rowId);
      if (rowIdx === -1) return prev;
      const baseRow = prev[rowIdx];

      // Determine responsibility strategy from the pair being replaced
      const topPair = baseRow.deptResponsibility[pairIdx] ?? { department: '', responsibility: '' };
      const topDept = topPair.department || '';
      const topResp = topPair.responsibility || '';
      // If responsibility matches department (or is blank), each new pair inherits its own dept
      const respMatchesDept = !topResp || topResp === topDept;

      // Build replacement pairs for the selected depts
      const replacementPairs = safeSel.map(dept => ({
        department: dept,
        responsibility: respMatchesDept ? dept : topResp,
      }));

      // Splice: replace the pair at pairIdx with all selected depts
      const updatedPairs = [...baseRow.deptResponsibility];
      updatedPairs.splice(pairIdx, 1, ...replacementPairs);

      // Deduplicate by department (keep first occurrence)
      const seen = new Set<string>();
      const dedupedPairs = updatedPairs.filter(p => {
        if (!p.department) return true; // keep empty/blank pairs
        if (seen.has(p.department)) return false;
        seen.add(p.department);
        return true;
      });

      const result = [...prev];
      result[rowIdx] = { ...baseRow, deptResponsibility: dedupedPairs, ...touch(baseRow) };
      return result.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  // Split a row with multiple dept/resp pairs into N individual rows (one per pair)
  const splitIntoRows = (rowId: string) => {
    setRows(prev => {
      const rowIdx = prev.findIndex(r => r.id === rowId);
      if (rowIdx === -1) return prev;
      const baseRow = prev[rowIdx];
      if (baseRow.deptResponsibility.length <= 1) return prev;

      const ts = Date.now();
      const newRows: MasterChecklistRow[] = baseRow.deptResponsibility.map((pair, i) => ({
        ...baseRow,
        id: i === 0 ? baseRow.id : `${baseRow.id}-split-${ts}-${i}`,
        deptResponsibility: [pair],
        // First row keeps original ID — mark edited if it was live; new rows are always draft
        rowStatus: (i === 0 ? pendingStatus(baseRow) : 'draft') as MasterChecklistRow['rowStatus'],
        updatedAt: new Date().toISOString(),
        syncedSnapshot: i === 0 ? baseRow.syncedSnapshot : undefined,
      }));

      const result = [...prev];
      result.splice(rowIdx, 1, ...newRows);
      return result.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  // Copy dept/resp pairs from the nearest previous row that has at least one dept set
  const copyDeptRespFromPrevious = (rowId: string) => {
    setRows(prev => {
      const rowIdx = prev.findIndex(r => r.id === rowId);
      if (rowIdx <= 0) return prev; // no previous row
      // Walk backwards to find the nearest row with dept data
      let sourcePairs: DeptResponsibilityPair[] | null = null;
      for (let i = rowIdx - 1; i >= 0; i--) {
        const candidate = prev[i].deptResponsibility.filter(p => p.department || p.responsibility);
        if (candidate.length > 0) { sourcePairs = candidate; break; }
      }
      if (!sourcePairs) return prev;
      const target = prev[rowIdx];
      const updated = { ...target, deptResponsibility: sourcePairs.map(p => ({ ...p })), ...touch(target) };
      const result = [...prev];
      result[rowIdx] = updated;
      return result;
    });
  };

  const toggleInactive = (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    const becomingInactive = row && !row.isInactive;
    if (becomingInactive && linkedChecklist && onChecklistGenerated) {
      const removedPrefixes = [`q-sync-${rowId}-`, `q-mcl-${rowId}-`];
      const cleanPages = safeCleanPages(linkedChecklist.pages, qId =>
        removedPrefixes.some(pfx => qId.startsWith(pfx))
      );
      const updated: ChecklistTemplate = { ...linkedChecklist, pages: cleanPages };
      (updated as any)._removedQuestionPrefixes = removedPrefixes;
      onChecklistGenerated(updated);
    }
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, isInactive: !r.isInactive, ...touch(r) };
    }));
  };

  const toggleFollowUp = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, isFollowUp: !r.isFollowUp, ...touch(r) };
    }));
  };

  const applyBulkSop = () => {
    if (!bulkSopName) return;
    let count = 0;
    setRows(prev => prev.map(r => {
      if (r.sopName !== bulkSopName) return r;
      const updated = { ...r, ...touch(r) };
      if (bulkSopRisk) { updated.riskCategory = bulkSopRisk as MasterChecklistRow['riskCategory']; count++; }
      if (bulkSopMarks !== '') updated.maxScore = Number(bulkSopMarks);
      return updated;
    }));
    showToast(`Applied to all questions under "${bulkSopName}"`);
  };

  const applyBulkSubSop = () => {
    if (!bulkSubSopName) return;
    setRows(prev => prev.map(r => {
      if (r.subSopName !== bulkSubSopName) return r;
      const updated = { ...r, ...touch(r) };
      if (bulkSubSopRisk) updated.riskCategory = bulkSubSopRisk as MasterChecklistRow['riskCategory'];
      if (bulkSubSopMarks !== '') updated.maxScore = Number(bulkSubSopMarks);
      return updated;
    }));
    showToast(`Applied to all questions under "${bulkSubSopName}"`);
  };

  const applyBulkDeptResp = () => {
    if (!bulkSopName && !bulkSubSopName) return;
    if (bulkDepts.length === 0) return;

    // Smart pairing: names in both lists → self-pair (dept = resp = name)
    // Remaining unmatched depts × unmatched resps → cross-product
    const selfPairs: DeptResponsibilityPair[] = bulkDepts
      .filter(d => bulkResps.includes(d))
      .map(d => ({ department: d, responsibility: d }));
    const unmatchedDepts = bulkDepts.filter(d => !bulkResps.includes(d));
    const unmatchedResps = bulkResps.filter(r => !bulkDepts.includes(r));
    const crossPairs: DeptResponsibilityPair[] = unmatchedDepts.flatMap(d =>
      unmatchedResps.length > 0
        ? unmatchedResps.map(r => ({ department: d, responsibility: r }))
        : [{ department: d, responsibility: '' }]
    );
    const pairs: DeptResponsibilityPair[] = [...selfPairs, ...crossPairs];

    let count = 0;
    setRows(prev => prev.map(r => {
      const matchesSop = !bulkSopName || r.sopName === bulkSopName;
      const matchesSubSop = !bulkSubSopName || r.subSopName === bulkSubSopName;
      if (!matchesSop || !matchesSubSop) return r;
      count++;
      return { ...r, deptResponsibility: pairs, ...touch(r) };
    }));
    showToast(`Dept & Responsibility applied to ${count} question${count !== 1 ? 's' : ''} (${pairs.length} pair${pairs.length !== 1 ? 's' : ''} each)`);
  };

  // Pull the response type + options already in use by the linked checklist's questions.
  // If the checklist has no questions yet, fall back to the Compliant/Non-Compliant default.
  const getChecklistResponseTemplate = (
    checklist: ChecklistTemplate,
    maxScore: number,
    rSets?: ResponseSet[]
  ): { responseType: QuestionNode['responseType']; responses: QuestionNode['responses']; flaggedValue: string; responseSetId?: string } => {
    const target = Number(maxScore) || 0;

    const defaultTemplate = {
      responseType: 'multiple' as const,
      responses: [
        { id: 'r1', text: 'Compliant', score: String(target), color: 'green', isFlagged: false },
        { id: 'r2', text: 'Partially Compliant', score: String(Math.round(target / 2)), color: 'orange', isFlagged: true },
        { id: 'r3', text: 'Non-Compliant', score: '0', color: 'red', isFlagged: true },
        { id: 'r4', text: 'N/A', score: '/', color: 'gray', isFlagged: false },
      ],
      flaggedValue: 'Non-Compliant',
      responseSetId: undefined as string | undefined,
    };

    // ── PRIORITY 1 ── Corporate response sets (passed in from AuditChecklistCreator).
    // Find the set whose highest score exactly matches the row's maxScore.
    // This is the correct IHCL-style matching: score=6 → C-set, score=4 → Com-set, score=2 → Yes-set, etc.
    if (rSets && rSets.length > 0) {
      const exactSet = rSets.find(s => {
        const setMax = Math.max(...(s.responses || []).map(r => parseFloat(r.score) || 0));
        return setMax === target;
      });
      if (exactSet) {
        const responses = (exactSet.responses || []).map((r, idx) => ({ ...r, id: `r${idx + 1}` }));
        const flaggedResp = responses.find(r => r.isFlagged);
        return {
          responseType: 'multiple' as const,
          responses,
          flaggedValue: flaggedResp?.text || '',
          responseSetId: exactSet.id,
        };
      }
      // No exact match in response sets — scale the closest one proportionally
      const closestSet = rSets.reduce((best, s) => {
        const sMax = Math.max(...(s.responses || []).map(r => parseFloat(r.score) || 0));
        const bMax = Math.max(...(best.responses || []).map(r => parseFloat(r.score) || 0));
        return Math.abs(sMax - target) < Math.abs(bMax - target) ? s : best;
      });
      const csMax = Math.max(...(closestSet.responses || []).map(r => parseFloat(r.score) || 0), 1);
      const scaledFromSet = (closestSet.responses || []).map((r, idx) => ({
        ...r,
        id: `r${idx + 1}`,
        score: r.score === '/' ? '/' : String(Math.round(((parseFloat(r.score) || 0) / csMax) * target)),
      }));
      const flaggedFromSet = scaledFromSet.find(r => r.isFlagged);
      return {
        responseType: 'multiple' as const,
        responses: scaledFromSet,
        flaggedValue: flaggedFromSet?.text || '',
        responseSetId: closestSet.id,
      };
    }

    // ── PRIORITY 2 ── Existing questions in the linked checklist (no response sets configured).
    // Collect all questions from all pages/sections/sub-sections.
    const allQuestions: QuestionNode[] = [];
    checklist.pages?.forEach(page => {
      page.sections?.forEach(sec => {
        (sec.questions || []).forEach(q => allQuestions.push(q));
        (sec.subSections || []).forEach(sub => (sub.questions || []).forEach(q => allQuestions.push(q)));
      });
    });
    // Skip generic "Option 1/2" placeholders and questions with no real scores
    const isValidSample = (q: QuestionNode): boolean => {
      if (!q.responseType || !q.responses || q.responses.length === 0) return false;
      const hasRealLabels = q.responses.some(r => r.text && !/^option\s*\d+$/i.test(r.text.trim()) && r.text.trim().toLowerCase() !== 'n/a');
      const hasRealScores = q.responses.some(r => r.score && r.score !== '/' && parseFloat(r.score) > 0);
      return hasRealLabels && hasRealScores;
    };
    const validSamples = allQuestions.filter(isValidSample);
    if (validSamples.length === 0) return defaultTemplate;

    const cloneFromQ = (q: QuestionNode, tMax: number) => {
      const qMax = Math.max(...(q.responses || []).map(r => parseFloat(r.score) || 0), 1);
      return (q.responses || []).map((r, idx) => ({
        ...r,
        id: `r${idx + 1}`,
        score: r.score === '/' ? '/' : String(Math.round(((parseFloat(r.score) || 0) / qMax) * tMax)),
      }));
    };

    // Exact maxScore match in existing questions
    const exactQ = validSamples.find(q => Number(q.maxScore || 0) === target);
    if (exactQ) {
      const responses = cloneFromQ(exactQ, target);
      const flaggedResp = responses.find(r => r.isFlagged);
      return {
        responseType: exactQ.responseType,
        responses,
        flaggedValue: flaggedResp?.text || exactQ.responses?.find(r => r.isFlagged)?.text || '',
        responseSetId: exactQ.responseSetId,
      };
    }

    // Closest maxScore in existing questions with proportional scaling
    const closestQ = validSamples.reduce((best, q) =>
      Math.abs(Number(q.maxScore || 0) - target) < Math.abs(Number(best.maxScore || 0) - target) ? q : best
    );
    const scaledResponses = cloneFromQ(closestQ, target);
    const flaggedResp = scaledResponses.find(r => r.isFlagged);
    return {
      responseType: closestQ.responseType,
      responses: scaledResponses,
      flaggedValue: flaggedResp?.text || closestQ.responses?.find(r => r.isFlagged)?.text || '',
      responseSetId: closestQ.responseSetId,
    };
  };

  const placeRowInChecklist = (
    checklist: ChecklistTemplate,
    row: MasterChecklistRow,
    rSets: ResponseSet[]
  ): ChecklistTemplate => {
    const result: ChecklistTemplate = JSON.parse(JSON.stringify(checklist));
    const sopName = row.sopName || 'General';
    const subSopName = row.subSopName?.trim();
    const pairs = Array.isArray(row.deptResponsibility) && row.deptResponsibility.length > 0
      ? row.deptResponsibility : [{ department: 'General', responsibility: '' }];

    const rowPrefix = `q-sync-${row.id}-`;
    const mclPrefix = `q-mcl-${row.id}-`;
    result.pages.forEach(pg => {
      (pg.sections || []).forEach(sec => {
        sec.questions = (sec.questions || []).filter(q => q && !q.id.startsWith(rowPrefix) && !q.id.startsWith(mclPrefix));
        (sec.subSections || []).forEach(ss => {
          ss.questions = (ss.questions || []).filter(q => q && !q.id.startsWith(rowPrefix) && !q.id.startsWith(mclPrefix));
        });
      });
    });

    const pinnedSet = row.responseSetId && rSets.length > 0
      ? rSets.find(s => s.id === row.responseSetId) : null;

    const buildQ = (dept: string, responsibility: string): QuestionNode => {
      const ms = Number(row.maxScore) || 0;
      const tmpl = pinnedSet
        ? (() => {
            const pinnedMax = Math.max(...(pinnedSet.responses || []).map(r => parseFloat(r.score) || 0), 1);
            const resp = (pinnedSet.responses || []).map((r, idx) => ({
              ...r, id: `r${idx + 1}`,
              score: r.score === '/' ? '/' : String(Math.round(((parseFloat(r.score) || 0) / pinnedMax) * ms)),
            }));
            const flagged = resp.find(r => r.isFlagged);
            return { responseType: 'multiple' as const, responses: resp, isFlagged: !!flagged, flaggedValue: flagged?.text || '', responseSetId: pinnedSet.id };
          })()
        : (() => {
            const t = getChecklistResponseTemplate(result, ms, rSets.length > 0 ? rSets : undefined);
            return { responseType: t.responseType, responses: t.responses, isFlagged: !!t.flaggedValue, flaggedValue: t.flaggedValue, responseSetId: t.responseSetId };
          })();
      return {
        ...tmpl,
        id: `q-sync-${row.id}-${dept.replace(/\s+/g, '_')}-${(responsibility || 'none').replace(/\s+/g, '_')}`,
        text: row.question,
        requirement: row.standard || '',
        risk: (row.riskCategory === 'Critical' ? 'High' : ['Low', 'Medium', 'High'].includes(row.riskCategory) ? row.riskCategory : 'Low') as 'Low' | 'Medium' | 'High',
        category: row.category || '',
        isRequired: false,
        isMultipleSelection: false,
        maxScore: ms,
        logicRules: [],
        responsibility: responsibility ? [responsibility] : [],
        isFollowUp: row.isFollowUp || false,
      };
    };

    for (const pair of pairs) {
      const dept = pair.department || 'General';
      let page = result.pages.find(p => p.title === dept);
      if (!page) {
        page = { id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: dept, sections: [] };
        result.pages.push(page);
      }
      let section = page.sections.find(s => s.title === sopName);
      if (!section) {
        section = { id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: sopName, isApplicable: true, risk: 'Indiv.' as any, category: '', questions: [], subSections: [] };
        page.sections.push(section);
      }
      if (subSopName) {
        let subSection = (section.subSections || []).find(ss => ss.title === subSopName);
        if (!subSection) {
          subSection = { id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, title: subSopName, isApplicable: true, risk: 'Indiv.' as any, questions: [] };
          if (!section.subSections) section.subSections = [];
          section.subSections.push(subSection);
        }
        subSection.questions.push(buildQ(dept, pair.responsibility));
      } else {
        if (!section.questions) section.questions = [];
        section.questions.push(buildQ(dept, pair.responsibility));
      }
    }

    result.questionCount = result.pages.reduce(
      (acc, p) => acc + p.sections.reduce((sa, s) => sa + (s.questions?.length || 0) + ((s.subSections || []).reduce((ssa, ss) => ssa + (ss.questions?.length || 0), 0)), 0), 0
    );
    return result;
  };

  const syncRowToChecklist = (row: MasterChecklistRow) => {
    if (!linkedChecklist || (!onChecklistGenerated && !onRowSynced)) {
      showToast('No linked checklist to sync to', 'error');
      return;
    }
    if (!row.question.trim()) {
      showToast('Question text is required before syncing', 'error');
      return;
    }
    const updatedChecklist = placeRowInChecklist(linkedChecklist, row, responseSets);
    (updatedChecklist as any)._removedQuestionPrefixes = [
      `q-sync-${row.id}-`,
      `q-mcl-${row.id}-`,
    ];
    const syncCallback = onRowSynced ?? onChecklistGenerated;
    if (syncCallback) syncCallback(updatedChecklist);
    const pairs = row.deptResponsibility.length > 0 ? row.deptResponsibility : [{ department: 'General', responsibility: '' }];
    const sopName = row.sopName || 'General';
    const subSopName = row.subSopName?.trim();
    const snapshot = JSON.stringify({ question: row.question, sopName: row.sopName, subSopName: row.subSopName, standard: row.standard, riskCategory: row.riskCategory, category: row.category, maxScore: row.maxScore, deptResponsibility: row.deptResponsibility });
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, rowStatus: 'synced', syncedSnapshot: snapshot } : r));
    const deptNames = pairs.map(p => p.department || 'General').join(', ');
    showToast(`Synced to "${deptNames} › ${sopName}${subSopName ? ' › ' + subSopName : ''}"`);
  };

  const addRow = () => {
    setRows(prev => {
      return [facilityNewRow(1), ...prev].map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  const addRowsInBulk = (n: number) => {
    setRows(prev => {
      const newRows = Array.from({ length: n }, (_, i) => facilityNewRow(i + 1));
      return [...newRows, ...prev].map((r, i) => ({ ...r, slNo: i + 1 }));
    });
  };

  const deleteRows = (ids: string[]) => {
    if (linkedChecklist && onChecklistGenerated && ids.length > 0) {
      const removedPrefixes = ids.flatMap(rid => [`q-sync-${rid}-`, `q-mcl-${rid}-`]);
      const cleanPages = safeCleanPages(linkedChecklist.pages, qId =>
        removedPrefixes.some(pfx => qId.startsWith(pfx))
      );
      const updated: ChecklistTemplate = { ...linkedChecklist, pages: cleanPages };
      (updated as any)._removedQuestionPrefixes = removedPrefixes;
      onChecklistGenerated(updated);
    }
    setRows(prev => {
      const next = prev.filter(r => !ids.includes(r.id));
      return next.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
    setSelectedRows(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
  };

  const moveRowToPosition = (rowId: string, targetSlNo: number) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === rowId);
      if (idx === -1) return prev;
      const clamped = Math.max(1, Math.min(targetSlNo, prev.length));
      const targetIdx = clamped - 1;
      if (targetIdx === idx) return prev;
      const row = prev[idx];
      const without = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      without.splice(targetIdx, 0, row);
      return without.map((r, i) => ({ ...r, slNo: i + 1 }));
    });
    setEditingSlNo(null);
  };

  const openMergeModal = () => {
    if (selectedRows.size < 2) { showToast('Select at least 2 rows to merge', 'error'); return; }
    const selRows = rows.filter(r => selectedRows.has(r.id));
    setMergeSelectedId(selRows[0]?.id || '');
    setMergeTarget('existing');
    setMergeNewText('');
    setMergeResponseSetId(selRows[0]?.responseSetId || '');
    setMergeModal(true);
  };

  const safeQIds = (row: MasterChecklistRow): string[] => {
    const pairs = Array.isArray(row.deptResponsibility) && row.deptResponsibility.length > 0
      ? row.deptResponsibility
      : [{ department: 'General', responsibility: '' }];
    return pairs.map(p => {
      const dk = (p.department || 'General').replace(/\s+/g, '_');
      const rk = (p.responsibility || 'none').replace(/\s+/g, '_');
      return `q-mcl-${row.id}-${dk}-${rk}`;
    });
  };

  const getChecklistQIds = safeQIds;

  const safeCleanPages = (
    pages: any[] | undefined,
    shouldRemove: (qId: string) => boolean
  ): any[] => {
    if (!Array.isArray(pages)) return [];
    return pages.map(pg => ({
      ...pg,
      sections: Array.isArray(pg.sections) ? pg.sections.map((sec: any) => ({
        ...sec,
        questions: Array.isArray(sec.questions)
          ? sec.questions.filter((q: any) => {
              if (!q || typeof q.id !== 'string') return true;
              return !shouldRemove(q.id);
            })
          : [],
        subSections: Array.isArray(sec.subSections) ? sec.subSections.map((ss: any) => ({
          ...ss,
          questions: Array.isArray(ss.questions)
            ? ss.questions.filter((q: any) => {
                if (!q || typeof q.id !== 'string') return true;
                return !shouldRemove(q.id);
              })
            : [],
        })) : [],
      })) : [],
    }));
  };

  const buildIdAliases = (
    existing: Record<string, string[]> | undefined,
    survivorQIds: string[],
    removedQIds: string[]
  ): Record<string, string[]> => {
    const aliases: Record<string, string[]> = { ...(existing || {}) };
    for (const mqId of survivorQIds) {
      if (!aliases[mqId]) aliases[mqId] = [];
      for (const rqId of removedQIds) {
        if (!aliases[mqId].includes(rqId)) aliases[mqId].push(rqId);
        if (aliases[rqId]) {
          for (const oldId of aliases[rqId]) {
            if (!aliases[mqId].includes(oldId)) aliases[mqId].push(oldId);
          }
          delete aliases[rqId];
        }
      }
    }
    return aliases;
  };

  const buildTextAliases = (
    existing: Record<string, string[]> | undefined,
    survivorText: string,
    removedTexts: string[]
  ): Record<string, string[]> => {
    const aliases: Record<string, string[]> = { ...(existing || {}) };
    if (!survivorText) return aliases;
    if (!aliases[survivorText]) aliases[survivorText] = [];
    for (const oldText of removedTexts) {
      if (oldText && oldText !== survivorText) {
        if (!aliases[survivorText].includes(oldText)) aliases[survivorText].push(oldText);
        if (aliases[oldText]) {
          for (const t of aliases[oldText]) {
            if (!aliases[survivorText].includes(t)) aliases[survivorText].push(t);
          }
          delete aliases[oldText];
        }
      }
    }
    return aliases;
  };

  const saveMclToApi = async (newRows: MasterChecklistRow[]) => {
    if (!activeMclId) return;
    try {
      const mcl: MasterChecklist = {
        id: activeMclId,
        title: title || 'Untitled Master Checklist',
        status: 'draft',
        rows: newRows,
        createdAt: getCurrentMcl()?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByScope: currentScope,
        createdByEntityId: userRootId,
        ...(linkedChecklistId ? { linkedChecklistId } : {}),
      };
      await fetch('/api/master-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcl),
      });
      setMasterChecklists(prev => prev.map(m => m.id === activeMclId ? mcl : m));
    } catch (err) {
      console.error('[saveMclToApi] Save failed:', err);
    }
  };

  const executeMerge = async () => {
    try {
    const selIds = [...selectedRows];
    const selRows = rows.filter(r => selIds.includes(r.id));
    if (selRows.length < 2) {
      showToast('Select at least 2 questions to merge', 'error');
      return;
    }

    let survivorId: string;
    let survivorQuestion: string;
    let baseRow: MasterChecklistRow;

    if (mergeTarget === 'existing') {
      const targetRow = selRows.find(r => r.id === mergeSelectedId);
      if (!targetRow) { showToast('Please select a target question', 'error'); return; }
      if (!(targetRow.question || '').trim()) { showToast('Target question has no text', 'error'); return; }
      survivorId = targetRow.id;
      survivorQuestion = targetRow.question;
      baseRow = targetRow;
    } else {
      if (!mergeNewText.trim()) { showToast('Enter question text for the merged question', 'error'); return; }
      survivorId = `mcr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      survivorQuestion = mergeNewText.trim();
      baseRow = selRows[0];
    }

    const allDepts: DeptResponsibilityPair[] = [];
    const seenDepts = new Set<string>();
    for (const r of selRows) {
      for (const p of (Array.isArray(r.deptResponsibility) ? r.deptResponsibility : [])) {
        const key = `${p.department || ''}|||${p.responsibility || ''}`;
        if (!seenDepts.has(key)) { seenDepts.add(key); allDepts.push({ ...p }); }
      }
    }

    const hasSynced = selRows.some(r => r.rowStatus === 'synced');
    const hasPending = selRows.some(r => r.rowStatus === 'pending-sync');
    const mergedStatus: MasterChecklistRow['rowStatus'] =
      mergeTarget === 'existing' ? pendingStatus(baseRow)
      : (hasSynced || hasPending) ? 'pending-sync' : 'draft';

    const scores = selRows.map(r => (typeof r.maxScore === 'number' && !isNaN(r.maxScore)) ? r.maxScore : 0);

    const mergedFromEntries = selRows.map(r => ({ question: r.question, id: r.id }));

    const mergedRow: MasterChecklistRow = {
      id: survivorId,
      slNo: 0,
      question: survivorQuestion,
      sopName: baseRow.sopName || '',
      subSopName: baseRow.subSopName || '',
      standard: [...new Set(selRows.map(r => r.standard).filter(Boolean))].join('; '),
      riskCategory: (['Critical', 'High', 'Medium', 'Low'].find(level =>
        selRows.some(r => r.riskCategory === level)) as any) || '',
      category: baseRow.category || '',
      deptResponsibility: allDepts.length > 0 ? allDepts : [{ department: '', responsibility: '' }],
      maxScore: Math.max(...scores, 0),
      rowStatus: mergedStatus,
      mergedFrom: mergedFromEntries,
      responseSetId: mergeResponseSetId || undefined,
    };

    const removedIds = selIds.filter(id => id !== survivorId);

    const insertIdx = rows.findIndex(r => selIds.includes(r.id));
    const without = rows.filter(r => !selIds.includes(r.id));
    without.splice(insertIdx >= 0 ? insertIdx : 0, 0, mergedRow);
    const newRows = without.map((r, i) => ({ ...r, slNo: i + 1 }));

    setRows(newRows);
    setSelectedRows(new Set());
    setMergeModal(false);

    await saveMclToApi(newRows);

    try {
      if (linkedChecklist && onChecklistGenerated) {
        const survivorQIds = safeQIds(mergedRow);
        const removedQIds = removedIds.flatMap(rid => {
          const row = selRows.find(r => r.id === rid);
          return row ? safeQIds(row) : [];
        });

        const idAliases = buildIdAliases(linkedChecklist.questionIdAliases, survivorQIds, removedQIds);
        const removedTexts = removedIds
          .map(rid => selRows.find(r => r.id === rid)?.question || '')
          .filter(Boolean);
        const txtAliases = buildTextAliases(linkedChecklist.questionTextAliases, survivorQuestion, removedTexts);

        const removedPrefixes = removedIds.flatMap(rid => [`q-sync-${rid}-`, `q-mcl-${rid}-`]);
        const allOldAliasIds = new Set<string>();
        Object.values(idAliases).forEach((oldIds: string[]) => {
          oldIds.forEach(id => { if (id) allOldAliasIds.add(id); });
        });
        removedQIds.forEach(id => allOldAliasIds.add(id));
        const cleanPages = safeCleanPages(linkedChecklist.pages, qId =>
          removedPrefixes.some(pfx => qId.startsWith(pfx)) || allOldAliasIds.has(qId)
        );

        let updated: ChecklistTemplate = {
          ...linkedChecklist,
          pages: cleanPages,
          questionIdAliases: idAliases,
          questionTextAliases: Object.keys(txtAliases).length > 0 ? txtAliases : undefined,
        };

        if (mergedRow.question.trim()) {
          updated = placeRowInChecklist(updated, mergedRow, responseSets);
        }

        (updated as any)._removedQuestionPrefixes = removedPrefixes;

        onChecklistGenerated(updated);

        const snapshot = JSON.stringify({ question: mergedRow.question, sopName: mergedRow.sopName, subSopName: mergedRow.subSopName, standard: mergedRow.standard, riskCategory: mergedRow.riskCategory, category: mergedRow.category, maxScore: mergedRow.maxScore, deptResponsibility: mergedRow.deptResponsibility });
        setRows(prev => prev.map(r => r.id === mergedRow.id ? { ...r, rowStatus: 'synced', syncedSnapshot: snapshot } : r));
      }
    } catch (err) {
      console.error('Merge: linked checklist update failed (non-fatal):', err);
    }

    showToast(`Merged ${selRows.length} questions into one`);
    } catch (err) {
      console.error('[MERGE] ERROR:', err);
      showToast('Merge failed — check console for details', 'error');
    }
  };

  const openSplitModal = () => {
    if (selectedRows.size !== 1) { showToast('Select exactly 1 row to split', 'error'); return; }
    const rowId = [...selectedRows][0];
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    setSplitQuestions(['', '']);
    setSplitModal({ rowId: row.id, question: row.question });
  };

  const executeSplit = async () => {
    try {
    if (!splitModal) return;
    const parentRow = rows.find(r => r.id === splitModal.rowId);
    if (!parentRow) { showToast('Original question not found', 'error'); return; }
    const texts = splitQuestions.filter(t => t.trim());
    if (texts.length < 2) { showToast('Enter at least 2 question texts', 'error'); return; }

    const childRows: MasterChecklistRow[] = texts.map((text, idx) => ({
      id: `mcr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
      slNo: 0,
      question: text.trim(),
      sopName: parentRow.sopName,
      subSopName: parentRow.subSopName,
      standard: parentRow.standard,
      riskCategory: parentRow.riskCategory,
      category: parentRow.category,
      deptResponsibility: (Array.isArray(parentRow.deptResponsibility) ? parentRow.deptResponsibility : []).map(p => ({ ...p })),
      maxScore: parentRow.maxScore,
      rowStatus: parentRow.rowStatus === 'synced' ? 'pending-sync' as const : 'draft' as const,
    }));

    const capturedRowId = splitModal.rowId;

    const idx = rows.findIndex(r => r.id === capturedRowId);
    const without = rows.filter(r => r.id !== capturedRowId);
    without.splice(idx >= 0 ? idx : 0, 0, ...childRows);
    const newRows = without.map((r, i) => ({ ...r, slNo: i + 1 }));

    setRows(newRows);
    setSelectedRows(new Set());
    setSplitModal(null);

    await saveMclToApi(newRows);

    try {
      if (linkedChecklist && onChecklistGenerated) {
        const parentQIds = safeQIds(parentRow);

        const idAliases: Record<string, string[]> = { ...(linkedChecklist.questionIdAliases || {}) };
        for (const child of childRows) {
          const childQIds = safeQIds(child);
          for (const cqId of childQIds) {
            if (!idAliases[cqId]) idAliases[cqId] = [];
            for (const pqId of parentQIds) {
              if (!idAliases[cqId].includes(pqId)) idAliases[cqId].push(pqId);
              if (idAliases[pqId]) {
                for (const oldId of idAliases[pqId]) {
                  if (!idAliases[cqId].includes(oldId)) idAliases[cqId].push(oldId);
                }
              }
            }
          }
        }
        for (const pqId of parentQIds) delete idAliases[pqId];

        const txtAliases: Record<string, string[]> = { ...(linkedChecklist.questionTextAliases || {}) };
        const parentText = parentRow.question;
        if (parentText) {
          const inheritedTexts = [parentText, ...(txtAliases[parentText] || [])];
          for (const child of childRows) {
            if (!child.question) continue;
            if (!txtAliases[child.question]) txtAliases[child.question] = [];
            for (const t of inheritedTexts) {
              if (t !== child.question && !txtAliases[child.question].includes(t)) {
                txtAliases[child.question].push(t);
              }
            }
          }
          if (txtAliases[parentText] && !childRows.some(c => c.question === parentText)) {
            delete txtAliases[parentText];
          }
        }

        const parentPrefixes = [`q-sync-${capturedRowId}-`, `q-mcl-${capturedRowId}-`];
        const allOldSplitIds = new Set<string>();
        Object.values(idAliases).forEach((oldIds: string[]) => {
          oldIds.forEach(id => { if (id) allOldSplitIds.add(id); });
        });
        parentQIds.forEach(id => allOldSplitIds.add(id));
        const cleanPages = safeCleanPages(linkedChecklist.pages, qId =>
          parentPrefixes.some(pfx => qId.startsWith(pfx)) || allOldSplitIds.has(qId)
        );

        let updated: ChecklistTemplate = {
          ...linkedChecklist,
          pages: cleanPages,
          questionIdAliases: idAliases,
          questionTextAliases: Object.keys(txtAliases).length > 0 ? txtAliases : undefined,
        };

        for (const child of childRows) {
          if (child.question.trim()) {
            updated = placeRowInChecklist(updated, child, responseSets);
          }
        }

        (updated as any)._removedQuestionPrefixes = parentPrefixes;

        onChecklistGenerated(updated);

        const syncedChildIds = childRows.filter(c => c.question.trim()).map(c => c.id);
        if (syncedChildIds.length > 0) {
          setRows(prev => prev.map(r => {
            if (!syncedChildIds.includes(r.id)) return r;
            const snapshot = JSON.stringify({ question: r.question, sopName: r.sopName, subSopName: r.subSopName, standard: r.standard, riskCategory: r.riskCategory, category: r.category, maxScore: r.maxScore, deptResponsibility: r.deptResponsibility });
            return { ...r, rowStatus: 'synced' as const, syncedSnapshot: snapshot };
          }));
        }
      }
    } catch (err) {
      console.error('Split: linked checklist update failed (non-fatal):', err);
    }

    showToast(`Split into ${childRows.length} questions`);
    } catch (err) {
      console.error('[SPLIT] ERROR:', err);
      showToast('Split failed — check console for details', 'error');
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedRows(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r.id)));
    }
  };

  const getCurrentMcl = (): MasterChecklist | null => {
    return masterChecklists.find(m => m.id === activeMclId) || null;
  };

  const downloadSampleCsv = () => {
    let csv: string;
    let filename: string;
    if (fixedPages) {
      const headers = 'Question,Standard,SOP Name,Checklist Type,Section Name';
      const note = '# CHECKLIST TYPE: Use "Hygiene Checklist", "Preventive Maintenance", or both separated by semicolons (;)';
      const examples = [
        '"Is equipment surface cleaned and sanitized after each use?",ISO 22000 §8.2,"Equipment Cleaning SOP","Hygiene Checklist","Daily Equipment Checks"',
        '"Are cleaning agents stored safely and labelled correctly?",HACCP Pre-req 3,"Chemical Control SOP","Hygiene Checklist;Preventive Maintenance","Chemical Store"',
        '"Is preventive maintenance schedule followed for refrigeration units?",EN 378:2016,"Refrigeration PM SOP","Preventive Maintenance","Cold Room"',
      ];
      csv = [note, headers, ...examples].join('\n');
      filename = 'cleaning_master_checklist_sample.csv';
    } else {
      const headers = 'Question,SOPs Name,Sub SOPs Name,Standard,Risk Category,Category,Department,Responsibility,Max Score';
      const note = '# MULTI DEPT/RESP: Use semicolons (;) to separate multiple pairs. Position 1 in Department matches Position 1 in Responsibility.';
      const examples = [
        '"Is raw material storage temperature within range?",Cold Chain SOP,Temperature Control,ISO 22000:2018 §8.5,High,Hygiene,"Kitchen;Cold Store","QA Manager;Store Supervisor",10',
        '"Are cooking temperatures logged correctly?",Cooking SOP,Temperature Logging,HACCP CCP-1,Critical,Process,"Kitchen;Bakery","Head Chef;Bakery Supervisor",10',
        '"Is pest control inspection record up to date?",Pest Control SOP,,Pest Management Standard,Medium,Maintenance,Premises,Facility Manager,5',
      ];
      csv = [note, headers, ...examples].join('\n');
      filename = 'master_checklist_sample.csv';
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
      if (lines.length < 2) { showToast('CSV is empty or has no data rows', 'error'); return; }
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());

      const getCol = (row: string[], names: string[]): string => {
        for (const n of names) {
          const idx = headers.indexOf(n);
          if (idx !== -1) return (row[idx] || '').trim();
        }
        return '';
      };

      const VALID_CHECKLIST_TYPES = ['Hygiene Checklist', 'Preventive Maintenance'];
      const imported: MasterChecklistRow[] = [];
      let startSlNo = rows.length + 1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('#')) continue;
        const cols = parseCSVLine(lines[i]);
        const question = getCol(cols, ['question', 'question text', 'questiontext']);
        if (!question) continue;

        let riskCategory: MasterChecklistRow['riskCategory'] = '';
        let category = '';
        let deptResponsibility: { department: string; responsibility: string }[] = [{ department: '', responsibility: '' }];
        let maxScore = 0;
        let checklistType: string[] = [];
        let sectionName = '';

        if (fixedPages) {
          const clTypeRaw = getCol(cols, ['checklist type', 'checklisttype', 'type']);
          checklistType = clTypeRaw
            ? clTypeRaw.split(';').map(s => s.trim()).filter(s => VALID_CHECKLIST_TYPES.includes(s))
            : [];
          sectionName = getCol(cols, ['section name', 'sectionname', 'section']);
          deptResponsibility = [{ department: fixedPages[0]?.title || '', responsibility: '' }];
        } else {
          const riskRaw = getCol(cols, ['risk category', 'riskcategory', 'risk']).trim();
          riskCategory = (['Critical', 'High', 'Medium', 'Low'].includes(riskRaw) ? riskRaw : '') as MasterChecklistRow['riskCategory'];
          category = getCol(cols, ['category']);
          const deptRaw = getCol(cols, ['department', 'dept']);
          const respRaw = getCol(cols, ['responsibility']);
          const depts = deptRaw ? deptRaw.split(';').map(s => s.trim()) : [''];
          const resps = respRaw ? respRaw.split(';').map(s => s.trim()) : [''];
          deptResponsibility = depts.map((dept, di) => ({ department: dept, responsibility: resps[di] || resps[0] || '' }));
          maxScore = parseInt(getCol(cols, ['max score', 'maxscore', 'max marks', 'maxmarks']) || '0', 10) || 0;
        }

        imported.push({
          id: `mcr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
          slNo: startSlNo++,
          question,
          sopName: getCol(cols, ['sops name', 'sopname', 'sop name', 'sop']),
          subSopName: fixedPages ? '' : getCol(cols, ['sub sops name', 'subsopname', 'sub sop name', 'sub sop']),
          standard: getCol(cols, ['standard', 'requirement', 'standard/requirement']),
          riskCategory,
          category,
          deptResponsibility,
          maxScore,
          ...(fixedPages ? { checklistType, sectionName } : {}),
        });
      }
      if (imported.length === 0) { showToast('No valid rows found in CSV', 'error'); return; }
      setRows(prev => [...prev, ...imported].map((r, i) => ({ ...r, slNo: i + 1 })));
      showToast(`Imported ${imported.length} rows from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveDraft = async () => {
    if (!activeMclId) return;
    setIsSaving(true);

    // At save time: promote synced rows to pending-sync if their content changed vs snapshot
    const resolvedRows = rows.map((r, i) => {
      const row = { ...r, slNo: i + 1 };
      if (row.rowStatus === 'synced' && row.syncedSnapshot) {
        try {
          const snap = JSON.parse(row.syncedSnapshot);
          const cur = { question: row.question, sopName: row.sopName, subSopName: row.subSopName, standard: row.standard, riskCategory: row.riskCategory, category: row.category, maxScore: row.maxScore, deptResponsibility: row.deptResponsibility };
          if (JSON.stringify(cur) !== JSON.stringify(snap)) return { ...row, rowStatus: 'pending-sync' as const };
        } catch { /* ignore parse errors */ }
      }
      return row;
    });

    setRows(resolvedRows);

    const mcl: MasterChecklist = {
      id: activeMclId,
      title: title || 'Untitled Master Checklist',
      status: 'draft',
      rows: resolvedRows,
      createdAt: getCurrentMcl()?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByScope: currentScope,
      createdByEntityId: userRootId,
      ...(linkedChecklistId ? { linkedChecklistId } : {}),
    };
    try {
      const res = await fetch('/api/master-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mcl),
      });
      if (res.ok) {
        setMasterChecklists(prev => prev.map(m => m.id === activeMclId ? mcl : m));
        showToast('Draft saved successfully');
      } else {
        showToast('Failed to save draft', 'error');
      }
    } catch {
      showToast('Failed to save draft', 'error');
    }
    setIsSaving(false);
  };

  // Find the root corporate entity for proper scoping
  const getRootEntityId = (): string => {
    if (!userRootId || entities.length === 0) return userRootId || '';
    let current = entities.find(e => e.id === userRootId);
    while (current && current.parentId) {
      current = entities.find(e => e.id === current!.parentId);
    }
    return current ? current.id : userRootId || '';
  };

  const buildChecklist = (overrideRows?: MasterChecklistRow[]): ChecklistTemplate => {
    const validRows = overrideRows
      ? overrideRows.filter(r => r.question.trim() && !r.isInactive)
      : rows.filter(r => r.question.trim() && !r.isInactive);

    type ExpandedRow = MasterChecklistRow & { deptKey: string; respKey: string };

    const buildQuestion = (row: ExpandedRow, checklistRef?: ChecklistTemplate): QuestionNode => {
      const ms = Number(row.maxScore) || 0;
      const pinnedSet = row.responseSetId && responseSets.length > 0
        ? responseSets.find(s => s.id === row.responseSetId)
        : null;
      const tmpl = pinnedSet
        ? (() => {
            const pinnedMax = Math.max(...(pinnedSet.responses || []).map(r => parseFloat(r.score) || 0), 1);
            const resp = (pinnedSet.responses || []).map((r, idx) => ({
              ...r,
              id: `r${idx + 1}`,
              score: r.score === '/' ? '/' : String(Math.round(((parseFloat(r.score) || 0) / pinnedMax) * ms)),
            }));
            const flagged = resp.find(r => r.isFlagged);
            return { responseType: 'multiple' as const, responses: resp, flaggedValue: flagged?.text || '', responseSetId: pinnedSet.id };
          })()
        : checklistRef
        ? getChecklistResponseTemplate(checklistRef, ms, responseSets.length > 0 ? responseSets : undefined)
        : responseSets.length > 0
          ? (() => {
              const exactSet = responseSets.find(s => Math.max(...(s.responses || []).map(r => parseFloat(r.score) || 0)) === ms);
              const chosen = exactSet || responseSets[0];
              const chosenMax = Math.max(...(chosen.responses || []).map(r => parseFloat(r.score) || 0), 1);
              const resp = (chosen.responses || []).map((r, idx) => ({
                ...r,
                id: `r${idx + 1}`,
                score: r.score === '/' ? '/' : String(Math.round(((parseFloat(r.score) || 0) / chosenMax) * ms)),
              }));
              const flagged = resp.find(r => r.isFlagged);
              return { responseType: 'multiple' as const, responses: resp, flaggedValue: flagged?.text || '', responseSetId: chosen.id };
            })()
          : { responseType: 'multiple' as const, responses: [
              { id: 'r1', text: 'Compliant', score: String(ms), color: 'green', isFlagged: false },
              { id: 'r2', text: 'Partially Compliant', score: String(Math.round(ms / 2)), color: 'orange', isFlagged: true },
              { id: 'r3', text: 'Non-Compliant', score: '0', color: 'red', isFlagged: true },
              { id: 'r4', text: 'N/A', score: '/', color: 'gray', isFlagged: false },
            ], flaggedValue: 'Non-Compliant', responseSetId: undefined as string | undefined };
      return ({
        id: `q-mcl-${row.id}-${(row.deptKey || 'General').replace(/\s+/g, '_')}-${(row.respKey || 'none').replace(/\s+/g, '_')}`,
        text: row.question,
        requirement: row.standard,
        responseType: tmpl.responseType,
        responses: tmpl.responses,
        risk: (['Low', 'Medium', 'High'].includes(row.riskCategory) ? row.riskCategory : 'Low') as 'Low' | 'Medium' | 'High',
        category: row.category,
        isRequired: false,
        isMultipleSelection: false,
        isFlagged: !!tmpl.flaggedValue,
        flaggedValue: tmpl.flaggedValue,
        responseSetId: (tmpl as any).responseSetId,
        maxScore: row.maxScore || 0,
        logicRules: [],
        responsibility: row.respKey ? [row.respKey] : [],
      });
    };

    const expandedRows: ExpandedRow[] = [];
    validRows.forEach(row => {
      const pairs = row.deptResponsibility.length > 0 ? row.deptResponsibility : [{ department: 'General', responsibility: '' }];
      pairs.forEach(pair => expandedRows.push({ ...row, deptKey: pair.department || 'General', respKey: pair.responsibility || '' }));
    });

    const byDept: Record<string, ExpandedRow[]> = {};
    expandedRows.forEach(row => {
      if (!byDept[row.deptKey]) byDept[row.deptKey] = [];
      byDept[row.deptKey].push(row);
    });

    const pages: PageNode[] = Object.entries(byDept).map(([dept, deptRows]) => {
      const bySop: Record<string, typeof deptRows> = {};
      deptRows.forEach(row => {
        const sop = row.sopName.trim() || 'General';
        if (!bySop[sop]) bySop[sop] = [];
        bySop[sop].push(row);
      });

      const sections: SectionNode[] = Object.entries(bySop).map(([sop, sopRows]) => {
        const bySubSop: Record<string, typeof sopRows> = {};
        sopRows.forEach(row => {
          const sub = row.subSopName.trim() || '__direct__';
          if (!bySubSop[sub]) bySubSop[sub] = [];
          bySubSop[sub].push(row);
        });
        const hasSubSops = Object.keys(bySubSop).some(k => k !== '__direct__');

        if (hasSubSops) {
          const directRows = bySubSop['__direct__'] || [];
          const subSections: SubSectionNode[] = Object.entries(bySubSop)
            .filter(([k]) => k !== '__direct__')
            .map(([subSop, subRows]) => ({
              id: `ss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              title: subSop,
              isApplicable: true,
              risk: 'Indiv.' as const,
              questions: subRows.map(r => buildQuestion(r, linkedChecklist || undefined)),
            }));
          return {
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            title: sop,
            isApplicable: true,
            risk: 'Indiv.' as const,
            category: '',
            questions: directRows.map(r => buildQuestion(r, linkedChecklist || undefined)),
            subSections,
          };
        }
        return {
          id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title: sop,
          isApplicable: true,
          risk: 'Indiv.' as const,
          category: '',
          questions: sopRows.map(r => buildQuestion(r, linkedChecklist || undefined)),
          subSections: [],
        };
      });

      return {
        id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: dept,
        sections,
      };
    });

    const totalQ = validRows.length;
    const today = new Date().toISOString().split('T')[0];
    const deptList = Object.keys(byDept);
    const existingAliases = linkedChecklist?.questionIdAliases;
    const rootEntityId = getRootEntityId();
    return {
      id: linkedChecklistId ? `from-mcl-${linkedChecklistId}` : `from-mcl-${activeMclId}`,
      title: title || 'Master Checklist',
      department: deptList.length === 1 ? deptList[0] : 'Multiple Departments',
      frequency: 'Monthly',
      questionCount: totalQ,
      lastUpdated: today,
      createdDate: today,
      modifiedDate: today,
      status: 'Active',
      history: [],
      pages,
      createdByScope: currentScope,
      createdByEntityId: rootEntityId,
      createdByName: userName || 'Master Checklist',
      unitDetails: { companyName: '', repName: '', address: '', contact: '', email: '', manday: '', scope: '', dateFrom: '', dateTo: '', geotag: '', startTime: '' },
      ...(existingAliases && Object.keys(existingAliases).length > 0 ? { questionIdAliases: existingAliases } : {}),
      ...(linkedChecklist?.questionTextAliases && Object.keys(linkedChecklist.questionTextAliases).length > 0 ? { questionTextAliases: linkedChecklist.questionTextAliases } : {}),
    } as ChecklistTemplate;
  };

  const downloadMasterExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // Active (non-inactive, has question text) rows only for analytics sheets
    const activeRows = rows.filter(r => !r.isInactive && r.question.trim());

    const allDepts = [...new Set(activeRows.flatMap(r => r.deptResponsibility.map(p => p.department).filter(Boolean)))].sort();
    const allResps = [...new Set(activeRows.flatMap(r => r.deptResponsibility.map(p => p.responsibility).filter(Boolean)))].sort();
    const allSubSops = [...new Set(activeRows.map(r => r.subSopName).filter(Boolean))].sort();
    const allCategories = [...new Set(activeRows.map(r => r.category).filter(Boolean))].sort();
    const RISK_ORDER = ['Critical', 'High', 'Medium', 'Low'];

    const RISK_BG: Record<string, string>   = { Critical: 'FF7F1D1D', High: 'FFC2410C', Medium: 'FFD97706', Low: 'FF166534' };
    const RISK_FG: Record<string, string>   = { Critical: 'FFFFFFFF', High: 'FFFFFFFF', Medium: 'FFFFFFFF', Low: 'FFFFFFFF' };
    const HEADER_BG = 'FF1E3A5F'; // navy

    const thin = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };

    const styleHeader = (row: ExcelJS.Row, bg = HEADER_BG, fg = 'FFFFFFFF') => {
      row.height = 20;
      row.font = { bold: true, color: { argb: fg }, size: 10 };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      row.alignment = { vertical: 'middle', wrapText: false };
      row.eachCell({ includeEmpty: true }, c => { c.border = border; });
    };

    const styleDataRow = (row: ExcelJS.Row, altBg?: string) => {
      row.height = 16;
      if (altBg) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: altBg } };
      row.eachCell({ includeEmpty: true }, c => { c.border = border; });
    };

    const styleTotalRow = (row: ExcelJS.Row, bg = 'FFF1F5F9') => {
      row.height = 18;
      row.font = { bold: true, size: 10 };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      row.eachCell({ includeEmpty: true }, c => { c.border = border; });
    };

    const centerCells = (row: ExcelJS.Row, fromCol: number, toCol: number) => {
      for (let c = fromCol; c <= toCol; c++) {
        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    };

    const getRisk = (subSop: string) => activeRows.find(r => r.subSopName === subSop)?.riskCategory || '';

    // Pivot score: sum of maxScore for rows matching subSop + dept in deptResponsibility
    const pivotScore = (subSop: string, key: string, field: 'department' | 'responsibility'): number | null => {
      const matching = activeRows.filter(r =>
        r.subSopName === subSop && r.deptResponsibility.some(p => p[field] === key)
      );
      return matching.length === 0 ? null : matching.reduce((s, r) => s + (r.maxScore || 0), 0);
    };

    // Builds sheets 1 & 4 (pivot by dept or resp, grouped by risk level)
    const buildPivotSheet = (
      name: string, keys: string[], field: 'department' | 'responsibility',
      headerBg: string, totalBg: string
    ) => {
      const ws = wb.addWorksheet(name);
      const colHeaders = ['Sub SOP Name', 'Risk Category', ...keys.map(k => `${k}  Max Score`), 'Total'];
      styleHeader(ws.addRow(colHeaders), headerBg);

      const subSopsSorted = [...allSubSops].sort((a, b) => {
        const rA = RISK_ORDER.indexOf(getRisk(a)); const rB = RISK_ORDER.indexOf(getRisk(b));
        const ra = rA === -1 ? 99 : rA; const rb = rB === -1 ? 99 : rB;
        return ra !== rb ? ra - rb : a.localeCompare(b);
      });

      let currentRisk = '';
      const keyTotals = keys.map(() => 0);
      let grandTotal = 0;

      for (const subSop of subSopsSorted) {
        const risk = getRisk(subSop);

        if (risk !== currentRisk) {
          currentRisk = risk;
          const grpRow = ws.addRow([`  ${risk || 'Unclassified'} Risk`, '', ...keys.map(() => ''), '']);
          grpRow.height = 16;
          grpRow.font = { bold: true, color: { argb: RISK_FG[risk] || 'FFFFFFFF' }, size: 9 };
          grpRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RISK_BG[risk] || 'FF374151' } };
          grpRow.eachCell({ includeEmpty: true }, c => { c.border = border; });
          ws.mergeCells(grpRow.number, 1, grpRow.number, 2);
        }

        const scores = keys.map(k => pivotScore(subSop, k, field));
        const rowTotal = scores.reduce((s, v) => s + (v ?? 0), 0);
        grandTotal += rowTotal;
        scores.forEach((v, i) => { if (v !== null) keyTotals[i] += v; });

        const dr = ws.addRow([subSop, risk, ...scores.map(s => s === null ? 'NA' : s), rowTotal]);
        styleDataRow(dr);
        centerCells(dr, 3, 2 + keys.length + 1);
        for (let c = 3; c <= 2 + keys.length; c++) {
          if (dr.getCell(c).value === 'NA') dr.getCell(c).font = { color: { argb: 'FF9CA3AF' }, italic: true };
        }
      }

      const tr = ws.addRow(['Total', '', ...keyTotals, grandTotal]);
      styleTotalRow(tr, totalBg);
      centerCells(tr, 3, 2 + keys.length + 1);

      ws.columns = [{ width: 32 }, { width: 14 }, ...keys.map(() => ({ width: 22 })), { width: 12 }];
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    };

    // Builds sheet 2: Sub SOP view (alphabetical, no risk grouping)
    const buildSubSopSheet = () => {
      const ws = wb.addWorksheet('2. Sub SOP View');
      const colHeaders = ['Sub SOP Name', 'Risk Category', ...allDepts.map(d => `${d}  Max Score`), 'Total'];
      styleHeader(ws.addRow(colHeaders));

      const deptTotals = allDepts.map(() => 0);
      let grandTotal = 0;

      for (const subSop of allSubSops) {
        const risk = getRisk(subSop);
        const scores = allDepts.map(d => pivotScore(subSop, d, 'department'));
        const rowTotal = scores.reduce((s, v) => s + (v ?? 0), 0);
        grandTotal += rowTotal;
        scores.forEach((v, i) => { if (v !== null) deptTotals[i] += v; });

        const dr = ws.addRow([subSop, risk, ...scores.map(s => s === null ? 'NA' : s), rowTotal]);
        styleDataRow(dr);
        centerCells(dr, 3, 2 + allDepts.length + 1);
        for (let c = 3; c <= 2 + allDepts.length; c++) {
          if (dr.getCell(c).value === 'NA') dr.getCell(c).font = { color: { argb: 'FF9CA3AF' }, italic: true };
        }
      }

      const tr = ws.addRow(['Total', '', ...deptTotals, grandTotal]);
      styleTotalRow(tr);
      centerCells(tr, 3, 2 + allDepts.length + 1);

      ws.columns = [{ width: 32 }, { width: 14 }, ...allDepts.map(() => ({ width: 22 })), { width: 12 }];
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    };

    // Builds sheet 3: Category → Score → %
    const buildCategorySheet = () => {
      const ws = wb.addWorksheet('3. Category Score');
      styleHeader(ws.addRow(['Parameters', 'Score', '%']));

      let grandTotal = 0;
      const catScores = allCategories.map(cat => {
        const score = activeRows.filter(r => r.category === cat).reduce((s, r) => s + (r.maxScore || 0), 0);
        grandTotal += score;
        return { cat, score };
      });

      catScores.forEach(({ cat, score }) => {
        const pct = grandTotal > 0 ? Math.round((score / grandTotal) * 100) : 0;
        const dr = ws.addRow([cat, score, pct]);
        styleDataRow(dr);
        centerCells(dr, 2, 3);
      });

      const tr = ws.addRow(['', grandTotal, '']);
      styleTotalRow(tr);
      centerCells(tr, 2, 3);

      ws.columns = [{ width: 26 }, { width: 12 }, { width: 10 }];
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    };

    // Builds a question-list detail sheet (Sheet 5 + per-resp + per-dept)
    const buildDetailSheet = (wsName: string, detailRows: typeof activeRows, headerBg = HEADER_BG) => {
      const ws = wb.addWorksheet(wsName);
      const hdrs = ['Sl No', 'Question', 'SOP Name', 'Sub SOP Name', 'Standard', 'Risk Category', 'Category', 'Department', 'Responsibility', 'Max Score'];
      styleHeader(ws.addRow(hdrs), headerBg);

      detailRows.forEach((r, idx) => {
        const dept = r.deptResponsibility.map(p => p.department).filter(Boolean).join('; ');
        const resp = r.deptResponsibility.map(p => p.responsibility).filter(Boolean).join('; ');
        const dr = ws.addRow([idx + 1, r.question, r.sopName, r.subSopName, r.standard, r.riskCategory, r.category, dept, resp, r.maxScore || 0]);
        styleDataRow(dr, idx % 2 === 0 ? 'FFFAFAFA' : undefined);
        dr.getCell(1).alignment = { horizontal: 'center' };
        dr.getCell(10).alignment = { horizontal: 'center' };
      });

      ws.columns = [
        { width: 7 }, { width: 50 }, { width: 22 }, { width: 22 }, { width: 30 },
        { width: 14 }, { width: 16 }, { width: 22 }, { width: 22 }, { width: 12 },
      ];
      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    };

    // ── Build all sheets in order ─────────────────────────────────────
    buildPivotSheet('1. Risk Level View', allDepts, 'department', HEADER_BG, 'FFF1F5F9');
    buildSubSopSheet();
    buildCategorySheet();
    buildPivotSheet('4. Responsibility View', allResps, 'responsibility', 'FF4C1D95', 'FFF5F3FF');
    buildDetailSheet('5. Consolidated', activeRows);

    // Sheet 6+: per Responsibility
    allResps.forEach((resp, i) => {
      const respRows = activeRows.filter(r => r.deptResponsibility.some(p => p.responsibility === resp));
      const safe = resp.replace(/[*?:\\/\[\]]/g, '-').substring(0, 28);
      buildDetailSheet(`${6 + i}. ${safe}`, respRows, 'FF4C1D95');
    });

    // Then: per Department
    allDepts.forEach((dept, i) => {
      const deptRows = activeRows.filter(r => r.deptResponsibility.some(p => p.department === dept));
      const safe = dept.replace(/[*?:\\/\[\]]/g, '-').substring(0, 26);
      buildDetailSheet(`${6 + allResps.length + i}. ${safe}`, deptRows, 'FF1E3A5F');
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-checklist-${activeMclId || 'export'}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Excel downloaded — ${6 + allResps.length + allDepts.length} sheets`);
  };

  const handleOpenReview = async () => {
    if (!activeMclId) return;
    // Only operate on checkbox-selected rows that have question text
    const validRows = rows.filter(r => selectedRows.has(r.id) && r.question.trim());
    if (validRows.length === 0) {
      showToast(selectedRows.size > 0 ? 'Selected rows have no question text' : 'Select at least one row to bulk sync', 'error');
      return;
    }
    setIsLoadingReview(true);
    let savedRows: MasterChecklistRow[] = getCurrentMcl()?.rows || [];
    try {
      const res = await fetch('/api/master-checklists');
      if (res.ok) {
        const data = await res.json();
        const dbMcl = (data.masterChecklists || data || []).find((m: MasterChecklist) => m.id === activeMclId);
        if (dbMcl?.rows) savedRows = (dbMcl.rows as MasterChecklistRow[]).map(migrateRow);
      }
    } catch { }

    const fieldLabel: Record<string, string> = { sopName: 'SOP', subSopName: 'Sub SOP', standard: 'Standard', riskCategory: 'Risk', category: 'Category', maxScore: 'Max Score', deptResponsibility: 'Dept/Resp' };
    const compareFields = ['sopName', 'subSopName', 'standard', 'riskCategory', 'category', 'maxScore', 'deptResponsibility'] as const;

    const entries: Array<{ row: MasterChecklistRow; status: 'new'|'modified'|'unchanged'; changes: string[]; dbRow: MasterChecklistRow|null }> = validRows.map(row => {
      const dbRow = savedRows.find(d => d.question.trim().toLowerCase() === row.question.trim().toLowerCase()) || null;
      if (!dbRow) return { row, status: 'new', changes: [], dbRow: null };
      const changes: string[] = [];
      compareFields.forEach(f => {
        const a = JSON.stringify((row as any)[f]);
        const b = JSON.stringify((dbRow as any)[f]);
        if (a !== b) changes.push(fieldLabel[f] || f);
      });
      return { row, status: changes.length > 0 ? 'modified' : 'unchanged', changes, dbRow };
    });

    setReviewRows(entries);
    const defaultIncluded = new Set(entries.filter(e => e.status !== 'modified').map(e => e.row.id));
    setReviewIncluded(defaultIncluded);
    setIsLoadingReview(false);
    setShowReviewModal(true);
  };

  const handleFinalSubmit = async (overrideRows?: MasterChecklistRow[]) => {
    if (!activeMclId) return;
    const validRows = overrideRows || rows.filter(r => r.question.trim());
    if (validRows.length === 0) {
      showToast('Add at least one question before submitting', 'error');
      return;
    }

    const allDepts = new Set<string>();
    validRows.forEach(row => {
      const pairs = row.deptResponsibility.length > 0 ? row.deptResponsibility : [{ department: 'General', responsibility: '' }];
      pairs.forEach(p => allDepts.add(p.department || 'General'));
    });

    setIsSubmitting(true);
    try {
      const checklist = buildChecklist(validRows);
      const clRes = await fetch('/api/audit-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checklist),
      });
      if (!clRes.ok) throw new Error('Failed to save checklist');

      // Mark only the bulk-synced rows as 'synced'; leave all others at their current status
      const syncedIds = new Set(validRows.map(r => r.id));
      const updatedRows = rows.map((r, i) => {
        if (!syncedIds.has(r.id)) return { ...r, slNo: i + 1 };
        const snapshot = JSON.stringify({ question: r.question, sopName: r.sopName, subSopName: r.subSopName, standard: r.standard, riskCategory: r.riskCategory, category: r.category, maxScore: r.maxScore, deptResponsibility: r.deptResponsibility });
        return { ...r, slNo: i + 1, rowStatus: 'synced' as const, syncedSnapshot: snapshot };
      });
      const updatedMcl: MasterChecklist = {
        id: activeMclId,
        title: title || 'Untitled',
        status: 'draft',
        rows: updatedRows,
        createdAt: getCurrentMcl()?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByScope: currentScope,
        createdByEntityId: userRootId,
        ...(linkedChecklistId ? { linkedChecklistId } : {}),
      };
      await fetch('/api/master-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMcl),
      });
      setRows(updatedRows);
      setMasterChecklists(prev => prev.map(m => m.id === activeMclId ? updatedMcl : m));
      onChecklistGenerated?.(checklist);
      showToast(`Bulk synced — ${validRows.length} question${validRows.length !== 1 ? 's' : ''} across ${allDepts.size} dept(s)`);
      setShowReviewModal(false);
    } catch (e: any) {
      showToast(e.message || 'Submission failed', 'error');
    }
    setIsSubmitting(false);
  };

  const deleteMcl = async (id: string) => {
    if (!window.confirm('Delete this master checklist?')) return;
    try {
      await fetch('/api/master-checklists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const remaining = masterChecklists.filter(m => m.id !== id);
      setMasterChecklists(remaining);
      if (activeMclId === id) {
        if (remaining.length > 0) { switchToMcl(remaining[0]); }
        else { setActiveMclId(null); setTitle(''); setRows([]); }
      }
      showToast('Deleted');
    } catch { showToast('Delete failed', 'error'); }
  };

  type FieldKey = 'question' | 'standard' | 'sop' | 'subSop' | 'risk' | 'category' | 'marks' | 'department' | 'responsibility';
  const FACILITY_HIDDEN_FIELDS: Set<FieldKey> = new Set(['risk', 'category', 'marks', 'department', 'responsibility']);
  const FIELD_DEFS: { key: FieldKey; label: string; check: (r: MasterChecklistRow) => boolean; optional?: boolean }[] = [
    { key: 'question',      label: 'Question',      check: r => !r.question.trim() },
    { key: 'sop',           label: 'SOPs',          check: r => !r.sopName.trim() },
    { key: 'subSop',        label: 'Sub SOPs',      check: r => !r.subSopName.trim(), optional: true },
    { key: 'standard',      label: 'Standard',      check: r => !r.standard.trim(), optional: true },
    { key: 'risk',          label: 'Risk',          check: r => !r.riskCategory },
    { key: 'category',      label: 'Category',      check: r => !r.category.trim(), optional: true },
    { key: 'marks',         label: 'Marks',         check: r => !r.maxScore },
    { key: 'department',    label: 'Department',    check: r => r.deptResponsibility.every(p => !p.department.trim()) },
    { key: 'responsibility',label: 'Responsibility',check: r => r.deptResponsibility.every(p => !p.responsibility.trim()) },
  ];

  const getIncompleteFields = (r: MasterChecklistRow): string[] =>
    FIELD_DEFS.filter(f => !f.optional && f.check(r) && !(fixedPages && FACILITY_HIDDEN_FIELDS.has(f.key))).map(f => f.label);

  const incompleteRows = rows.filter(r => getIncompleteFields(r).length > 0);
  const emptyQuestionRows = rows.filter(r => !r.question.trim());
  const pendingSyncRows = rows.filter(r => r.rowStatus === 'pending-sync');

  // Repetitive question map: question text (lowercase) → count of rows with that text
  const repeatCountMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach(r => {
      const key = r.question.trim().toLowerCase();
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [rows]);
  const repeatQuestionCount = useMemo(() =>
    [...repeatCountMap.values()].filter(c => c > 1).reduce((sum, c) => sum + c, 0),
  [repeatCountMap]);

  // Dynamic option lists derived from current rows
  const sopOptions = [...new Set(rows.map(r => r.sopName).filter(Boolean))].sort();
  const subSopOptions = [...new Set(rows.filter(r => !filterSop || r.sopName === filterSop).map(r => r.subSopName).filter(Boolean))].sort();
  const hasUncategorized = rows.some(r => !r.category || !r.category.trim());
  const filterCategoryOptions = [...new Set(rows.map(r => r.category).filter(Boolean))].sort();
  const responsibilityOptions = [...new Set(rows.flatMap(r => r.deptResponsibility.map(p => p.responsibility)).filter(Boolean))].sort();

  const filteredRows = rows
    .filter(r => {
      // Bulk SOP / Sub SOP scope — selecting in the bulk bar narrows the table live
      if (bulkSopName && r.sopName !== bulkSopName) return false;
      if (bulkSubSopName && r.subSopName !== bulkSubSopName) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.question.toLowerCase().includes(q) && !r.standard.toLowerCase().includes(q)) return false;
      }
      if (filterDept && !r.deptResponsibility.some(p => p.department.toLowerCase().includes(filterDept.toLowerCase()))) return false;
      if (filterRisk && r.riskCategory !== filterRisk) return false;
      if (filterSop && r.sopName !== filterSop) return false;
      if (filterSubSop && r.subSopName !== filterSubSop) return false;
      if (filterCategory === '__uncategorized__' && r.category && r.category.trim()) return false;
      if (filterCategory && filterCategory !== '__uncategorized__' && r.category !== filterCategory) return false;
      if (filterResponsibility && !r.deptResponsibility.some(p => p.responsibility === filterResponsibility)) return false;
      if (filterNoDept && r.deptResponsibility.some(p => p.department.trim())) return false;
      if (filterNoResp && r.deptResponsibility.some(p => p.responsibility.trim())) return false;
      if (filterRepeat && (repeatCountMap.get(r.question.trim().toLowerCase()) ?? 0) < 2) return false;
      if (filterIncomplete && getIncompleteFields(r).length === 0) return false;
      if (filterPendingSync && r.rowStatus !== 'pending-sync') return false;
      if (filterMissingField) {
        const def = FIELD_DEFS.find(f => f.key === filterMissingField);
        if (def && !def.check(r)) return false;
      }
      if (filterStatus === 'draft') return (!r.rowStatus || r.rowStatus === 'draft') && !r.isInactive;
      if (filterStatus === 'live') return (r.rowStatus === 'synced') && !r.isInactive;
      if (filterStatus === 'inactive') return !!r.isInactive;
      if (filterStatus === 'edited') return r.rowStatus === 'pending-sync' && !r.isInactive;
      return true;
    })
    .sort((a, b) => {
      if (filterStatus !== 'all') return 0;
      if (a.isInactive && !b.isInactive) return 1;
      if (!a.isInactive && b.isInactive) return -1;
      return 0;
    });

  // fieldCounts from filteredRows so chips always reflect the current view
  const fieldCounts: Record<FieldKey, number> = {} as Record<FieldKey, number>;
  FIELD_DEFS.forEach(f => { fieldCounts[f.key] = filteredRows.filter(f.check).length; });

  const activeMcl = getCurrentMcl();
  const isSubmitted = false;

  const colClass = "px-2 py-1.5 border border-transparent focus:outline-none focus:border-violet-400 focus:bg-white rounded-lg text-xs font-medium text-slate-700 bg-transparent transition-all w-full min-w-0 placeholder:text-slate-300";
  const cellClass = "px-1 py-1 align-top";

  return (
    <>
    <div className="space-y-4 animate-in fade-in duration-300">
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold border animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success' ? 'bg-white text-emerald-700 border-emerald-200' : 'bg-white text-rose-600 border-rose-200'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
          {toast.msg}
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
              <Table2 size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Master Checklist</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                {linkedChecklistTitle ? `Linked to: ${linkedChecklistTitle}` : 'SOP-based audit question matrix'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Checklist selector */}
            <div className="relative" ref={mclDropdownRef}>
              <button
                onClick={() => setMclDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs font-bold text-white hover:bg-white/20 transition-all"
              >
                <BookOpen size={13} />
                {activeMcl ? (activeMcl.title.length > 22 ? activeMcl.title.slice(0, 22) + '…' : activeMcl.title) : 'Select Checklist'}
                <ChevronDown size={12} className={`transition-transform ${mclDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {mclDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl min-w-[240px] overflow-hidden">
                  {masterChecklists.length === 0 && <div className="px-4 py-3 text-xs text-slate-400 italic">No saved master checklists</div>}
                  {masterChecklists.map(mcl => (
                    <div key={mcl.id} className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors cursor-pointer ${activeMclId === mcl.id ? 'bg-indigo-50' : ''}`} onClick={() => switchToMcl(mcl)}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{mcl.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${mcl.status === 'submitted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{mcl.status}</span>
                          <span className="text-[9px] text-slate-400">{(mcl.rows || []).length} rows</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteMcl(mcl.id); }} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors ml-2"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={createNew} className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all">
              <Plus size={14} strokeWidth={3} /> New
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw size={18} className="animate-spin" /> Loading master checklists...
          </div>
        ) : !activeMclId ? (
          <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200"><Table2 size={32} className="text-slate-300" /></div>
            <div>
              <p className="text-sm font-black text-slate-600 uppercase tracking-wide">No Master Checklist Selected</p>
              <p className="text-xs text-slate-400 mt-1">
                {linkedChecklist ? `Import ${countChecklistQuestions(linkedChecklist)} questions from "${linkedChecklist.title}" to get started` : 'Create a new master checklist to get started'}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {linkedChecklist && (
                <button onClick={() => importFromChecklist(false)} className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-violet-700 transition-all shadow-lg shadow-violet-200">
                  <RefreshCw size={16} strokeWidth={3} /> Import from Checklist ({countChecklistQuestions(linkedChecklist)} Qs)
                </button>
              )}
              <button onClick={createNew} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-600 transition-all">
                <Plus size={16} strokeWidth={3} /> Create Blank
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-6 pt-5 pb-0 border-b border-slate-100">
              {/* Title row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      disabled={isSubmitted}
                      placeholder="Master Checklist Title..."
                      className="text-xl font-black text-slate-800 bg-transparent outline-none border-b-2 border-transparent focus:border-indigo-400 pb-0.5 placeholder:text-slate-300 disabled:opacity-60 min-w-0 max-w-md"
                    />
                    {activeMcl?.status === 'submitted' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full uppercase tracking-wider shrink-0">
                        <CheckCircle2 size={9} /> Submitted
                      </span>
                    )}
                    {activeMcl?.status === 'draft' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-amber-100 text-amber-700 border border-amber-300 rounded-full uppercase tracking-wider shrink-0">
                        <Clock size={9} /> Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {activeMcl?.updatedAt && (
                      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <Clock size={9} /> Last updated: {fmtTime(activeMcl.updatedAt)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-bold">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
                    {rows.filter(r => r.question.trim()).length > 0 && (
                      <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-0.5">
                        <Check size={8} /> {rows.filter(r => r.question.trim()).length} questions
                      </span>
                    )}
                    {repeatQuestionCount > 0 && (
                      <button
                        onClick={() => setFilterRepeat(f => !f)}
                        className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border transition-all ${filterRepeat ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'}`}
                        title="Click to filter repetitive questions"
                      >
                        <AlertTriangle size={9} /> {repeatQuestionCount} repeat{repeatQuestionCount !== 1 ? 's' : ''}
                      </button>
                    )}
                    {selectedRows.size > 0 && (
                      <button onClick={() => deleteRows([...selectedRows])} className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full uppercase tracking-wider hover:bg-rose-100 transition-colors">
                        <Trash2 size={9} /> Delete {selectedRows.size} selected
                      </button>
                    )}
                  </div>
                </div>
                {/* Action buttons row */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {/* Dept filter */}
                  <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                    <Filter size={10} className="text-slate-400 shrink-0" />
                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-[10px] font-semibold text-slate-600 bg-transparent outline-none cursor-pointer">
                      <option value="">All Depts</option>
                      {fixedPages
                        ? fixedPages.map(fp => <option key={fp.title} value={fp.title}>{fp.title}</option>)
                        : departmentNames.map(d => <option key={d} value={d}>{d}</option>)
                      }
                    </select>
                  </div>
                  {!fixedPages && (
                    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                      <AlertTriangle size={10} className="text-slate-400 shrink-0" />
                      <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="text-[10px] font-semibold text-slate-600 bg-transparent outline-none cursor-pointer">
                        <option value="">All Risks</option>
                        {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  {/* Sync from linked checklist */}
                  {linkedChecklist && !isSubmitted && (
                    <button
                      onClick={() => importFromChecklist(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-[10px] font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-all"
                      title={`Re-import ${countChecklistQuestions(linkedChecklist)} questions from "${linkedChecklist.title}"`}
                    >
                      <RefreshCw size={10} /> Sync Checklist ({countChecklistQuestions(linkedChecklist)} Qs)
                    </button>
                  )}
                  {/* Sample CSV */}
                  <button onClick={downloadSampleCsv} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-700 transition-all">
                    <Download size={10} /> Sample CSV
                  </button>
                  {/* Bulk Upload */}
                  {!isSubmitted && (
                    <>
                      <input ref={csvUploadRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
                      <button onClick={() => csvUploadRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-all">
                        <Upload size={10} /> Upload CSV
                      </button>
                    </>
                  )}
                  {/* Download Excel */}
                  {rows.length > 0 && (
                    <button onClick={downloadMasterExcel} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all" title="Download all rows as Excel">
                      <Download size={10} /> Download Excel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Universal Search Bar */}
            {rows.length > 0 && (
              <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
                <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border-2 bg-white transition-all ${searchQuery ? 'border-indigo-400 shadow-sm shadow-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <Search size={13} className={`shrink-0 ${searchQuery ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search question text or standard..."
                    className="flex-1 bg-transparent outline-none text-xs text-slate-700 placeholder:text-slate-400 font-medium"
                  />
                  {searchQuery ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {filteredRows.length} result{filteredRows.length !== 1 ? 's' : ''}
                      </span>
                      <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300 shrink-0">{rows.length} rows</span>
                  )}
                </div>
              </div>
            )}

            {/* Filter Strip + Bulk Edit toggle */}
            {rows.length > 0 && (
              <div className="px-5 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0 flex items-center gap-1">
                  <Filter size={9} /> Filter:
                </span>

                {/* SOP */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-semibold transition-all ${filterSop ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <select value={filterSop} onChange={e => { setFilterSop(e.target.value); setFilterSubSop(''); }} className="bg-transparent outline-none text-[9px] font-semibold cursor-pointer max-w-[90px]" style={{ color: 'inherit' }}>
                    <option value="">All SOPs</option>
                    {sopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {filterSop && <button onClick={() => { setFilterSop(''); setFilterSubSop(''); }} className="ml-0.5 opacity-70 hover:opacity-100 shrink-0"><X size={8} /></button>}
                </div>

                {/* Sub SOP */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-semibold transition-all ${filterSubSop ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                  <select value={filterSubSop} onChange={e => setFilterSubSop(e.target.value)} className="bg-transparent outline-none text-[9px] font-semibold cursor-pointer max-w-[90px]" style={{ color: 'inherit' }}>
                    <option value="">All Sub SOPs</option>
                    {subSopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {filterSubSop && <button onClick={() => setFilterSubSop('')} className="ml-0.5 opacity-70 hover:opacity-100 shrink-0"><X size={8} /></button>}
                </div>

                {!fixedPages && <>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-semibold transition-all ${filterCategory ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-transparent outline-none text-[9px] font-semibold cursor-pointer max-w-[90px]" style={{ color: 'inherit' }}>
                      <option value="">All Categories</option>
                      {filterCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      {hasUncategorized && <option value="__uncategorized__">Uncategorized</option>}
                    </select>
                    {filterCategory && <button onClick={() => setFilterCategory('')} className="ml-0.5 opacity-70 hover:opacity-100 shrink-0"><X size={8} /></button>}
                  </div>

                  <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] font-semibold transition-all ${filterResponsibility ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                    <select value={filterResponsibility} onChange={e => setFilterResponsibility(e.target.value)} className="bg-transparent outline-none text-[9px] font-semibold cursor-pointer max-w-[100px]" style={{ color: 'inherit' }}>
                      <option value="">All Responsibilities</option>
                      {responsibilityOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {filterResponsibility && <button onClick={() => setFilterResponsibility('')} className="ml-0.5 opacity-70 hover:opacity-100 shrink-0"><X size={8} /></button>}
                  </div>

                  <span className="text-slate-200 shrink-0">|</span>

                  <label className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer select-none text-[9px] font-semibold transition-all ${filterNoDept ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-600'}`}>
                    <input type="checkbox" checked={filterNoDept} onChange={e => { setFilterNoDept(e.target.checked); if (e.target.checked) setFilterResponsibility(''); }} className="hidden" />
                    <span className={`w-2.5 h-2.5 rounded border-2 flex items-center justify-center shrink-0 ${filterNoDept ? 'bg-white border-white' : 'border-slate-300'}`}>{filterNoDept && <Check size={7} className="text-rose-600" />}</span>
                    Dept Not Identified
                  </label>

                  <label className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer select-none text-[9px] font-semibold transition-all ${filterNoResp ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-600'}`}>
                    <input type="checkbox" checked={filterNoResp} onChange={e => { setFilterNoResp(e.target.checked); if (e.target.checked) setFilterResponsibility(''); }} className="hidden" />
                    <span className={`w-2.5 h-2.5 rounded border-2 flex items-center justify-center shrink-0 ${filterNoResp ? 'bg-white border-white' : 'border-slate-300'}`}>{filterNoResp && <Check size={7} className="text-rose-600" />}</span>
                    Resp. Not Identified
                  </label>
                </>}

                {repeatQuestionCount > 0 && (
                  <label className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer select-none text-[9px] font-semibold transition-all ${filterRepeat ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-400'}`}>
                    <input type="checkbox" checked={filterRepeat} onChange={e => setFilterRepeat(e.target.checked)} className="hidden" />
                    <AlertTriangle size={8} />
                    Repeats <span className={`px-1 rounded text-[8px] font-black ${filterRepeat ? 'bg-white/30' : 'bg-amber-100 text-amber-700'}`}>{repeatQuestionCount}</span>
                  </label>
                )}

                {(filterSop || filterSubSop || filterCategory || filterResponsibility || filterNoDept || filterNoResp || filterRepeat) && (
                  <>
                    <span className="text-[9px] text-indigo-500 font-bold">{filteredRows.length} match</span>
                    <button onClick={() => { setFilterSop(''); setFilterSubSop(''); setFilterCategory(''); setFilterResponsibility(''); setFilterNoDept(false); setFilterNoResp(false); setFilterRepeat(false); setSearchQuery(''); }} className="text-[9px] font-black text-slate-400 hover:text-rose-500 underline">Clear</button>
                  </>
                )}

                <div className="flex-1" />

                {/* Bulk Edit toggle */}
                {rows.length > 0 && !isSubmitted && !fixedPages && (
                  <button
                    onClick={() => setBulkPanelOpen(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[9px] font-bold transition-all shrink-0 ${bulkPanelOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                  >
                    <BookOpen size={9} /> Bulk Edit
                    <ChevronDown size={9} className={`transition-transform ${bulkPanelOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            )}

            {/* Bulk Edit Panel — collapsible */}
            {bulkPanelOpen && rows.length > 0 && !isSubmitted && !fixedPages && (() => {
              const bulkSubSopChoices = [...new Set(
                rows.filter(r => !bulkSopName || r.sopName === bulkSopName).map(r => r.subSopName).filter(Boolean)
              )].sort();
              const sopAffected = bulkSopName ? rows.filter(r => r.sopName === bulkSopName).length : 0;
              const subSopAffected = bulkSubSopName ? rows.filter(r => r.subSopName === bulkSubSopName).length : 0;

              return (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100/80">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-800 uppercase tracking-widest bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                      <BookOpen size={9} /> Bulk Risk &amp; Marks
                    </span>
                    <span className="text-[9px] text-amber-600">— set defaults for all questions under a SOP or Sub SOP</span>
                  </div>
                  <div className="flex items-start gap-4 flex-wrap">

                    {/* SOP block */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide">SOP:</span>
                      <select
                        value={bulkSopName}
                        onChange={e => { setBulkSopName(e.target.value); setBulkSubSopName(''); }}
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
                      >
                        <option value="">Select SOP…</option>
                        {sopOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select
                        value={bulkSopRisk}
                        onChange={e => setBulkSopRisk(e.target.value)}
                        disabled={!bulkSopName}
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400 disabled:opacity-40"
                      >
                        <option value="">Risk…</option>
                        {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={bulkSopMarks}
                        onChange={e => setBulkSopMarks(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!bulkSopName}
                        placeholder="Marks…"
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400 w-20 disabled:opacity-40"
                      />
                      <button
                        onClick={applyBulkSop}
                        disabled={!bulkSopName || (!bulkSopRisk && bulkSopMarks === '')}
                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={sopAffected ? `Will update ${sopAffected} question${sopAffected !== 1 ? 's' : ''} under "${bulkSopName}"` : ''}
                      >
                        <Check size={9} /> Apply{sopAffected > 0 ? ` (${sopAffected} Qs)` : ''}
                      </button>
                      {(bulkSopName || bulkSopRisk || bulkSopMarks !== '') && (
                        <button onClick={() => { setBulkSopName(''); setBulkSopRisk(''); setBulkSopMarks(''); }} className="text-[8px] text-slate-400 hover:text-slate-600 underline">clear</button>
                      )}
                    </div>

                    <span className="text-slate-300 self-center">|</span>

                    {/* Sub SOP block */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Sub SOP:</span>
                      <select
                        value={bulkSubSopName}
                        onChange={e => setBulkSubSopName(e.target.value)}
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
                      >
                        <option value="">Select Sub SOP…</option>
                        {bulkSubSopChoices.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select
                        value={bulkSubSopRisk}
                        onChange={e => setBulkSubSopRisk(e.target.value)}
                        disabled={!bulkSubSopName}
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400 disabled:opacity-40"
                      >
                        <option value="">Risk…</option>
                        {RISK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={bulkSubSopMarks}
                        onChange={e => setBulkSubSopMarks(e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!bulkSubSopName}
                        placeholder="Marks…"
                        className="text-[9px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400 w-20 disabled:opacity-40"
                      />
                      <button
                        onClick={applyBulkSubSop}
                        disabled={!bulkSubSopName || (!bulkSubSopRisk && bulkSubSopMarks === '')}
                        className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title={subSopAffected ? `Will update ${subSopAffected} question${subSopAffected !== 1 ? 's' : ''} under "${bulkSubSopName}"` : ''}
                      >
                        <Check size={9} /> Apply{subSopAffected > 0 ? ` (${subSopAffected} Qs)` : ''}
                      </button>
                      {(bulkSubSopName || bulkSubSopRisk || bulkSubSopMarks !== '') && (
                        <button onClick={() => { setBulkSubSopName(''); setBulkSubSopRisk(''); setBulkSubSopMarks(''); }} className="text-[8px] text-slate-400 hover:text-slate-600 underline">clear</button>
                      )}
                    </div>

                  </div>

                  {/* Divider */}
                  <div className="border-t border-amber-200 mt-3 pt-3">
                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-800 uppercase tracking-widest bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                        <Users size={9} /> Bulk Dept &amp; Responsibility
                      </span>
                      <span className="text-[9px] text-amber-600">— assign departments &amp; responsibility for all questions under selected SOP / Sub SOP</span>
                      {!bulkSopName && !bulkSubSopName && (
                        <span className="text-[9px] font-black text-rose-500 flex items-center gap-0.5">↑ Select a SOP or Sub SOP above first</span>
                      )}
                      {(bulkSopName || bulkSubSopName) && (
                        <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <Check size={8} /> Scoped to: {[bulkSopName, bulkSubSopName].filter(Boolean).join(' › ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-4 flex-wrap">
                      {/* Department multi-select chips */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Departments:</span>
                          {departmentNames.length > 0 && (
                            <>
                              <button
                                onClick={() => setBulkDepts(departmentNames)}
                                className="text-[8px] font-bold text-indigo-500 hover:text-indigo-700 underline"
                              >All</button>
                              {bulkDepts.length > 0 && (
                                <button
                                  onClick={() => setBulkDepts([])}
                                  className="text-[8px] font-bold text-slate-400 hover:text-slate-600 underline"
                                >Clear</button>
                              )}
                            </>
                          )}
                        </div>
                        {departmentNames.length === 0 ? (
                          <span className="text-[9px] text-slate-400 italic">No departments configured in entity settings</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-lg">
                            {departmentNames.map(d => {
                              const sel = bulkDepts.includes(d);
                              return (
                                <button
                                  key={d}
                                  onClick={() => setBulkDepts(prev => sel ? prev.filter(x => x !== d) : [...prev, d])}
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                    sel
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600'
                                  }`}
                                >
                                  {sel && <span className="mr-0.5">✓</span>}{d}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Responsibility multi-select chips */}
                      {(() => {
                        const respChipOptions = [...new Set([...responsibilityOptions, ...departmentNames])].sort();
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide">Responsibilities:</span>
                              {respChipOptions.length > 0 && (
                                <>
                                  <button onClick={() => setBulkResps(respChipOptions)} className="text-[8px] font-bold text-indigo-500 hover:text-indigo-700 underline">All</button>
                                  {bulkResps.length > 0 && (
                                    <button onClick={() => setBulkResps([])} className="text-[8px] font-bold text-slate-400 hover:text-slate-600 underline">Clear</button>
                                  )}
                                </>
                              )}
                            </div>
                            {respChipOptions.length === 0 ? (
                              <span className="text-[9px] text-slate-400 italic">No responsibility values found yet</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-lg">
                                {respChipOptions.map(r => {
                                  const sel = bulkResps.includes(r);
                                  const isAlsoADept = bulkDepts.includes(r);
                                  return (
                                    <button
                                      key={r}
                                      onClick={() => setBulkResps(prev => sel ? prev.filter(x => x !== r) : [...prev, r])}
                                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                                        sel
                                          ? isAlsoADept
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-violet-600 text-white border-violet-600'
                                          : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400 hover:text-violet-600'
                                      }`}
                                      title={isAlsoADept && sel ? 'Self-paired: this dept will be its own responsibility' : ''}
                                    >
                                      {sel && <span className="mr-0.5">{isAlsoADept ? '⇄' : '✓'}</span>}{r}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Pair preview + Apply */}
                      {(() => {
                        const selfPairsPreview = bulkDepts.filter(d => bulkResps.includes(d));
                        const unmatchedDeptsPreview = bulkDepts.filter(d => !bulkResps.includes(d));
                        const unmatchedRespsPreview = bulkResps.filter(r => !bulkDepts.includes(r));
                        const crossPreview = unmatchedDeptsPreview.flatMap(d =>
                          unmatchedRespsPreview.length > 0 ? unmatchedRespsPreview.map(r => ({ d, r })) : [{ d, r: '' }]
                        );
                        const totalPairs = selfPairsPreview.length + crossPreview.length;
                        return (
                          <div className="flex flex-col gap-1.5 justify-end self-end min-w-[160px]">
                            {totalPairs > 0 && (
                              <div className="bg-white/70 border border-slate-200 rounded-lg p-2 text-[9px] space-y-0.5">
                                <span className="font-black text-slate-600 block mb-1">Preview — {totalPairs} row{totalPairs !== 1 ? 's' : ''} per question:</span>
                                {selfPairsPreview.map(name => (
                                  <div key={name} className="flex items-center gap-1 text-emerald-700">
                                    <span className="font-bold">{name}</span>
                                    <span className="text-emerald-400">⇄</span>
                                    <span className="font-bold">{name}</span>
                                    <span className="text-[8px] text-emerald-500 ml-0.5">(self)</span>
                                  </div>
                                ))}
                                {crossPreview.map(({ d, r }, i) => (
                                  <div key={i} className="flex items-center gap-1 text-violet-700">
                                    <span className="font-bold">{d}</span>
                                    <span className="text-violet-400">→</span>
                                    <span className="font-bold">{r || <span className="italic text-slate-400">no resp</span>}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={applyBulkDeptResp}
                              disabled={(!bulkSopName && !bulkSubSopName) || bulkDepts.length === 0}
                              className="flex items-center gap-1 text-[9px] font-black px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed self-start"
                            >
                              <Check size={9} /> Apply Dept &amp; Resp{totalPairs > 0 ? ` (${totalPairs} rows)` : ''}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Status Filter Bar */}
            {rows.length > 0 && (() => {
              const counts = {
                all: rows.length,
                draft: rows.filter(r => (!r.rowStatus || r.rowStatus === 'draft') && !r.isInactive).length,
                live: rows.filter(r => r.rowStatus === 'synced' && !r.isInactive).length,
                edited: rows.filter(r => r.rowStatus === 'pending-sync' && !r.isInactive).length,
                inactive: rows.filter(r => !!r.isInactive).length,
              };
              const STATUS_TABS: { key: typeof filterStatus; label: string; count: number; inactiveClass: string; activeClass: string; dot: string }[] = [
                { key: 'all',      label: 'All',        count: counts.all,      inactiveClass: 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',            activeClass: 'bg-slate-800 text-white border-slate-800',     dot: 'bg-slate-400' },
                { key: 'draft',    label: 'Draft / New', count: counts.draft,   inactiveClass: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',               activeClass: 'bg-blue-600 text-white border-blue-600',       dot: 'bg-blue-400' },
                { key: 'live',     label: 'Live',       count: counts.live,     inactiveClass: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',      activeClass: 'bg-emerald-600 text-white border-emerald-600', dot: 'bg-emerald-400' },
                { key: 'edited',   label: 'Edited',     count: counts.edited,   inactiveClass: 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50',         activeClass: 'bg-orange-500 text-white border-orange-500',   dot: 'bg-orange-400' },
                { key: 'inactive', label: 'Inactive',   count: counts.inactive, inactiveClass: 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50',            activeClass: 'bg-slate-500 text-white border-slate-500',     dot: 'bg-slate-300' },
              ];
              return (
                <div className="px-5 py-1.5 bg-white border-b border-slate-100 flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-0.5 shrink-0">Show:</span>
                  {STATUS_TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterStatus(tab.key)}
                      className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${filterStatus === tab.key ? tab.activeClass : tab.inactiveClass}`}
                    >
                      <span className={`w-1 h-1 rounded-full shrink-0 ${filterStatus === tab.key ? 'bg-white/70' : tab.dot}`} />
                      {tab.label}
                      <span className={`px-1 rounded text-[8px] font-black ${filterStatus === tab.key ? 'bg-white/20' : 'text-slate-400'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Completion Summary Bar */}
            {rows.length > 0 && (
              <div className="px-5 py-2 bg-slate-50/40 border-b border-slate-100">
                {/* Header row */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertTriangle size={8} className="text-amber-500" /> Missing Field Counts
                    <span className="text-slate-300 font-normal normal-case tracking-normal text-[8px]">· click to filter</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {pendingSyncRows.length > 0 && (
                      <button
                        onClick={() => { setFilterPendingSync(v => !v); setFilterIncomplete(false); setFilterMissingField(null); }}
                        className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all ${filterPendingSync ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                      >
                        <RefreshCw size={8} /> {pendingSyncRows.length} edited after publish
                      </button>
                    )}
                    {(searchQuery || filterMissingField || filterIncomplete || filterPendingSync || filterStatus !== 'all' || filterSop || filterSubSop || filterCategory || filterResponsibility || filterNoDept || filterNoResp) && (
                      <button onClick={() => { setSearchQuery(''); setFilterMissingField(null); setFilterIncomplete(false); setFilterPendingSync(false); setFilterStatus('all'); setFilterSop(''); setFilterSubSop(''); setFilterCategory(''); setFilterResponsibility(''); setFilterNoDept(false); setFilterNoResp(false); }} className="text-[9px] font-black text-slate-400 hover:text-slate-600 underline">
                        Clear all filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Per-field chips grid */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Total */}
                  <span className="text-[9px] font-black text-slate-500 px-2 py-1 bg-white border border-slate-200 rounded-lg">
                    {rows.length} rows total
                  </span>
                  <span className="text-slate-200 font-light">|</span>

                  {FIELD_DEFS.filter(f => !(fixedPages && FACILITY_HIDDEN_FIELDS.has(f.key))).map(f => {
                    const count = fieldCounts[f.key];
                    const isActive = filterMissingField === f.key;
                    const isOptional = f.optional;
                    const isAllGood = count === 0;

                    return (
                      <button
                        key={f.key}
                        onClick={() => {
                          setFilterMissingField(isActive ? null : f.key);
                          setFilterIncomplete(false);
                          setFilterPendingSync(false);
                        }}
                        title={isAllGood ? `${f.label}: all filled` : `${count} row${count !== 1 ? 's' : ''} missing ${f.label} — click to filter`}
                        className={`flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg border transition-all ${
                          isActive
                            ? 'bg-rose-600 text-white border-rose-600'
                            : isAllGood
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default'
                            : isOptional
                            ? 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        disabled={isAllGood}
                      >
                        {isAllGood
                          ? <><Check size={8} /> {f.label}</>
                          : <>{count} {f.label}{isOptional ? <span className="opacity-50 ml-0.5">opt</span> : ''}</>
                        }
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick action bar */}
            <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              {/* Left: row actions */}
              <div className="flex items-center gap-1.5">
                {!isSubmitted && (
                  <>
                    <button onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all">
                      <Plus size={11} strokeWidth={3} /> Add Row
                    </button>
                    <button onClick={() => addRowsInBulk(5)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all">
                      <Plus size={11} strokeWidth={3} /> Add 5 Rows
                    </button>
                    {fixedPages && <button onClick={() => setShowAddSectionModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white hover:border-indigo-300 hover:text-indigo-600 transition-all">
                      <Plus size={11} strokeWidth={3} /> Add Section
                    </button>}
                  </>
                )}
                {selectedRows.size > 0 && (
                  <button onClick={() => deleteRows([...selectedRows])} className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-100 transition-all">
                    <Trash2 size={11} /> Delete {selectedRows.size}
                  </button>
                )}
                {selectedRows.size >= 2 && !isSubmitted && (
                  <button onClick={openMergeModal} className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg text-[10px] font-bold text-violet-600 hover:bg-violet-100 transition-all">
                    <Layers2 size={11} /> Merge {selectedRows.size}
                  </button>
                )}
                {selectedRows.size === 1 && !isSubmitted && (
                  <button onClick={openSplitModal} className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-600 hover:bg-amber-100 transition-all">
                    <CopyPlus size={11} /> Split
                  </button>
                )}
                <span className="text-[9px] text-slate-400 font-bold ml-1">{rows.filter(r => r.question.trim()).length} of {rows.length} have questions</span>
              </div>
              {/* Right: auto-save indicator + save + submit */}
              <div className="flex items-center gap-2">
                {/* Auto-save status pill */}
                {autoSaveStatus === 'pending' && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Unsaved
                  </span>
                )}
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <RefreshCw size={9} className="animate-spin" /> Saving…
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <Check size={9} /> Saved
                  </span>
                )}
                {!isSubmitted && (
                  <button onClick={saveDraft} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all disabled:opacity-50">
                    <Save size={11} /> {isSaving ? 'Saving…' : 'Save as Draft'}
                  </button>
                )}
                <button
                  onClick={handleOpenReview}
                  disabled={isLoadingReview || isSubmitting || selectedRows.size === 0}
                  title={selectedRows.size === 0 ? 'Select rows using the checkboxes to bulk sync them' : `Bulk sync ${selectedRows.size} selected row${selectedRows.size !== 1 ? 's' : ''} into the checklist`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {isLoadingReview
                    ? <><RefreshCw size={11} className="animate-spin" /> Reviewing…</>
                    : <><Send size={11} /> Bulk Sync{selectedRows.size > 0 ? ` (${selectedRows.size})` : ''}</>
                  }
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    {/* Col 1: # */}
                    <th className="px-3 py-3 w-12 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input type="checkbox" checked={selectedRows.size === rows.length && rows.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">#</span>
                      </div>
                    </th>
                    {/* Col 2: Question & Standard */}
                    <th className="px-3 py-3 w-80 min-w-[280px] text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Question <span className="text-slate-300 font-normal normal-case tracking-normal">· Standard below</span>
                    </th>
                    {fixedPages && <th className="px-3 py-3 w-40 min-w-[140px] text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Checklist Type
                    </th>}
                    {/* Col 3: SOP / Classification */}
                    <th className="px-3 py-3 w-56 min-w-[200px] text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      SOP / Classification
                    </th>
                    {!fixedPages && <th className="px-3 py-3 min-w-[260px] text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Department &amp; Responsibility
                    </th>}
                    {/* Col 5: Actions */}
                    <th className="px-3 py-3 w-24 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const subSopOptions = row.sopName && sopSubTopics[row.sopName] ? sopSubTopics[row.sopName] : [];
                    const riskColor = row.riskCategory ? (RISK_COLORS[row.riskCategory] || 'bg-slate-100 text-slate-500 border-slate-200') : 'bg-slate-100 text-slate-400 border-slate-200';
                    return (
                      <tr key={row.id} className={`border-b border-slate-100 transition-colors group ${row.isInactive ? 'opacity-50 bg-slate-50' : row.isFollowUp ? 'bg-amber-50/50 border-l-2 border-l-amber-400' : selectedRows.has(row.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50/40'}`}>

                        {/* Col 1: checkbox + number */}
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col items-center gap-2">
                            <input type="checkbox" checked={selectedRows.has(row.id)} onChange={() => toggleRowSelect(row.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            {editingSlNo && editingSlNo.rowId === row.id ? (
                              <input
                                type="number"
                                min={1}
                                max={rows.length}
                                autoFocus
                                value={editingSlNo.value}
                                onChange={e => setEditingSlNo({ rowId: row.id, value: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    const n = parseInt(editingSlNo.value, 10);
                                    if (!isNaN(n) && n !== row.slNo) moveRowToPosition(row.id, n);
                                    else setEditingSlNo(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingSlNo(null);
                                  }
                                }}
                                onBlur={() => {
                                  const n = parseInt(editingSlNo.value, 10);
                                  if (!isNaN(n) && n !== row.slNo) moveRowToPosition(row.id, n);
                                  else setEditingSlNo(null);
                                }}
                                className="w-10 text-center text-[10px] font-black text-indigo-600 border border-indigo-300 rounded bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            ) : (
                              <button
                                onClick={() => !isSubmitted && setEditingSlNo({ rowId: row.id, value: String(row.slNo) })}
                                disabled={isSubmitted}
                                title="Click to change position"
                                className="text-[10px] font-black text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded px-1.5 py-0.5 transition-colors cursor-pointer disabled:cursor-default disabled:hover:text-slate-300 disabled:hover:bg-transparent"
                              >
                                {row.slNo}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Col 2: Question + Standard stacked */}
                        <td className="px-3 py-3 align-top">
                          <div className="relative">
                            {row.isFollowUp && <span className="absolute -top-1 -left-1 z-10 inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500 text-white text-[7px] font-black uppercase shadow-sm"><Flag size={7} /> Follow Up</span>}
                            <textarea
                              value={row.question}
                              onChange={e => updateRow(row.id, 'question', e.target.value)}
                              disabled={isSubmitted}
                              placeholder="Enter audit question..."
                              rows={2}
                              className={`w-full px-2.5 py-2 border focus:outline-none focus:border-violet-400 focus:bg-white rounded-lg text-xs font-semibold text-slate-700 bg-transparent transition-all resize-none placeholder:text-slate-300 ${(repeatCountMap.get(row.question.trim().toLowerCase()) ?? 0) > 1 ? 'border-amber-300 bg-amber-50/40' : 'border-transparent'}`}
                            />
                          </div>
                          {(() => {
                            const rc = row.question.trim() ? (repeatCountMap.get(row.question.trim().toLowerCase()) ?? 0) : 0;
                            const badges: React.ReactNode[] = [];
                            if (rc > 1) {
                              badges.push(
                                <span key="repeat" className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wide">
                                  <AlertTriangle size={7} /> ×{rc} repeat
                                </span>
                              );
                            }
                            if (row.mergedFrom && row.mergedFrom.length > 0) {
                              badges.push(
                                <span key="merged" className="group/merge relative inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full uppercase tracking-wide cursor-help">
                                  <Layers2 size={7} /> merged ({row.mergedFrom.length})
                                  <span className="absolute left-0 top-full mt-1 z-50 hidden group-hover/merge:block w-64 bg-white border border-violet-200 rounded-lg shadow-xl p-2 normal-case tracking-normal">
                                    <span className="block text-[9px] font-bold text-violet-600 mb-1">Merged from:</span>
                                    {row.mergedFrom.map((mf, i) => (
                                      <span key={mf.id} className="block text-[9px] text-slate-600 font-medium py-0.5 border-b border-slate-50 last:border-0 truncate">
                                        {i + 1}. {mf.question || '(empty)'}
                                      </span>
                                    ))}
                                  </span>
                                </span>
                              );
                            }
                            return badges.length > 0 ? (
                              <div className="mt-1 flex items-center gap-1 flex-wrap">{badges}</div>
                            ) : null;
                          })()}
                          <div className="mt-1.5 flex items-start gap-1.5">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1.5 flex-shrink-0">Std:</span>
                            <input
                              value={row.standard}
                              onChange={e => updateRow(row.id, 'standard', e.target.value)}
                              disabled={isSubmitted}
                              placeholder="Compliance standard..."
                              className="flex-1 px-2 py-1 border border-transparent focus:outline-none focus:border-indigo-300 focus:bg-white rounded text-[10px] text-slate-500 bg-slate-50/60 transition-all placeholder:text-slate-300"
                            />
                          </div>
                        </td>

                        {fixedPages && <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap gap-1">
                              {['Hygiene Checklist', 'Preventive Maintenance'].map(type => (
                                <label key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-all text-[10px] font-medium text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={(row.checklistType || []).includes(type)}
                                    onChange={e => {
                                      const types = row.checklistType || [];
                                      if (e.target.checked) {
                                        updateRow(row.id, 'checklistType', [...types, type]);
                                      } else {
                                        updateRow(row.id, 'checklistType', types.filter(t => t !== type));
                                      }
                                    }}
                                    disabled={isSubmitted}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  {type.split(' ')[0]}
                                </label>
                              ))}
                            </div>
                          </div>
                        </td>}

                        {/* Col 3: SOP / Classification */}
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1.5">
                            {/* SOP */}
                            <SearchableDropdown
                              value={row.sopName}
                              options={sopNames}
                              placeholder="— SOP Name —"
                              onChange={v => updateRow(row.id, 'sopName', v)}
                              disabled={isSubmitted}
                              allowCustom
                            />
                            {/* Sub-SOP - hide in facility mode */}
                            {!fixedPages && (
                              row.sopName && subSopOptions.length > 0 ? (
                                <SearchableDropdown
                                  value={row.subSopName}
                                  options={subSopOptions}
                                  placeholder="Sub-SOP..."
                                  onChange={v => updateRow(row.id, 'subSopName', v)}
                                  disabled={isSubmitted}
                                  allowCustom
                                />
                              ) : (
                                <input
                                  value={row.subSopName}
                                  onChange={e => updateRow(row.id, 'subSopName', e.target.value)}
                                  disabled={isSubmitted || !row.sopName}
                                  placeholder={row.sopName ? 'Sub-SOP...' : '↑ Select SOP first'}
                                  className={`w-full px-2.5 py-1.5 border border-transparent focus:outline-none focus:border-violet-400 focus:bg-white rounded-lg text-xs font-medium text-slate-700 bg-transparent transition-all placeholder:text-slate-300 ${!row.sopName ? 'opacity-40 cursor-default' : ''}`}
                                />
                              )
                            )}
                            {!fixedPages && <>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <div className="flex-1 min-w-[80px]">
                                <SearchableDropdown
                                  value={row.riskCategory}
                                  options={RISK_OPTIONS}
                                  placeholder="Risk…"
                                  onChange={v => updateRow(row.id, 'riskCategory', v)}
                                  disabled={isSubmitted}
                                />
                              </div>
                              <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1 flex-shrink-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase">Sc</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.maxScore || ''}
                                  onChange={e => updateRow(row.id, 'maxScore', parseInt(e.target.value) || 0)}
                                  disabled={isSubmitted}
                                  placeholder="0"
                                  className="w-10 bg-transparent text-xs font-black text-indigo-700 text-center focus:outline-none"
                                />
                              </div>
                            </div>
                            <SearchableDropdown
                              value={row.category}
                              options={categoryOptions}
                              placeholder="Category..."
                              onChange={v => updateRow(row.id, 'category', v)}
                              disabled={isSubmitted}
                              allowCustom
                            />
                            </>}
                          </div>
                        </td>

                        {!fixedPages && <td className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Department</span>
                              <span className="flex-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Responsibility</span>
                              {row.deptResponsibility.length > 1 && <span className="w-4" />}
                              {!isSubmitted && filteredRows.findIndex(r => r.id === row.id) > 0 && (
                                <button
                                  onClick={() => copyDeptRespFromPrevious(row.id)}
                                  title="Copy dept & responsibility pairs from the previous question"
                                  className="flex items-center gap-0.5 text-[8px] font-bold text-violet-600 hover:text-violet-800 border border-violet-200 bg-violet-50 hover:bg-violet-100 px-1.5 py-0.5 rounded transition-all shrink-0"
                                >
                                  <CopyPlus size={9} /> Copy prev
                                </button>
                              )}
                            </div>
                            {row.deptResponsibility.map((pair, di) => (
                              <div key={di} className="flex items-center gap-1">
                                <div className="flex-1 min-w-0 relative">
                                  {isSubmitted ? (
                                    <span className="block w-full px-2 py-1.5 text-[10px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg truncate">
                                      {pair.department || '—'}
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        onClick={e => openDeptPicker(e, row.id, di, pair.department)}
                                        className="w-full flex items-center justify-between gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-700 hover:border-indigo-300 transition-all text-left"
                                      >
                                        <span className="truncate">{pair.department || <span className="text-slate-400 italic">Department…</span>}</span>
                                        <ChevronDown size={10} className="text-slate-400 shrink-0" />
                                      </button>
                                    </>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <SearchableDropdown
                                    value={pair.responsibility}
                                    options={departmentNames.length > 0 ? departmentNames : ['General']}
                                    placeholder="Responsibility…"
                                    onChange={v => updateDeptResp(row.id, di, 'responsibility', v)}
                                    disabled={isSubmitted}
                                    allowCustom
                                  />
                                </div>
                                {!isSubmitted && row.deptResponsibility.length > 1 && (
                                  <button onClick={() => removeDeptResp(row.id, di)} className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0" title="Remove">
                                    <X size={11} />
                                  </button>
                                )}
                              </div>
                            ))}
                            {!isSubmitted && (
                              <div className="flex items-center gap-2 mt-0.5">
                                <button onClick={() => addDeptResp(row.id)} className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors">
                                  <Plus size={10} /> Add row
                                </button>
                                {row.deptResponsibility.length > 1 && (
                                  <button
                                    onClick={() => splitIntoRows(row.id)}
                                    title="Split each dept/resp pair into its own question row"
                                    className="flex items-center gap-1 text-[9px] font-bold text-amber-600 hover:text-amber-800 border border-amber-200 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded transition-all"
                                  >
                                    <Layers2 size={10} /> Split into rows
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>}

                        {/* Col 5: Status + Actions */}
                        <td className="px-2 py-3 align-top">
                          <div className="flex flex-col items-center gap-2">
                            {/* Incomplete fields indicator */}
                            {(() => {
                              const missing = getIncompleteFields(row);
                              if (missing.length > 0) return (
                                <span title={`Missing: ${missing.join(', ')}`} className="inline-flex items-center gap-0.5 px-2 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[8px] font-black uppercase tracking-wide cursor-help">
                                  <AlertTriangle size={8} /> {missing.length} missing
                                </span>
                              );
                              return null;
                            })()}
                            {/* Inactive badge */}
                            {row.isInactive ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-slate-200 text-slate-500 border border-slate-300 rounded-lg text-[8px] font-black uppercase tracking-wide">
                                <EyeOff size={8} /> Inactive
                              </span>
                            ) : (
                              /* Status badge */
                              row.rowStatus === 'synced' ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[8px] font-black uppercase tracking-wide">
                                  <Check size={8} /> Live
                                </span>
                              ) : row.rowStatus === 'pending-sync' ? (
                                <span
                                  title="This question was published but has been edited since. Click Sync to update the checklist template. Live audit reports are NOT affected — they use their own saved snapshots."
                                  className="inline-flex items-center gap-0.5 px-2 py-1 bg-orange-50 text-orange-700 border border-orange-300 rounded-lg text-[8px] font-black uppercase tracking-wide cursor-help animate-pulse"
                                >
                                  <RefreshCw size={8} /> Edited
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-wide">
                                  <Clock size={8} /> Draft
                                </span>
                              )
                            )}
                            {/* Per-row last updated timestamp */}
                            {row.updatedAt && (
                              <span className="text-[8px] text-slate-400 font-medium leading-tight">
                                {fmtTime(row.updatedAt)}
                              </span>
                            )}
                            {!isSubmitted && !row.isInactive && (
                              <button
                                onClick={() => toggleFollowUp(row.id)}
                                title={row.isFollowUp ? 'Remove follow-up priority — question returns to normal sort order' : 'Mark as follow-up — question will be prioritized at the top of the checklist view'}
                                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
                                  row.isFollowUp
                                    ? 'bg-amber-500 text-white hover:bg-amber-600 ring-1 ring-amber-300'
                                    : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700 border border-slate-200'
                                }`}
                              >
                                {row.isFollowUp ? <><Flag size={8} /> Follow Up</> : <><Flag size={8} /> Follow Up</>}
                              </button>
                            )}
                            {/* Deactivate / Activate toggle — only for live questions */}
                            {!isSubmitted && (row.rowStatus === 'synced' || row.rowStatus === 'pending-sync' || row.isInactive) && (
                              <button
                                onClick={() => toggleInactive(row.id)}
                                title={row.isInactive ? 'Reactivate — question will appear in live checklist again' : 'Deactivate — question will be hidden from live checklist but kept here'}
                                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
                                  row.isInactive
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : 'bg-slate-200 text-slate-600 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 border border-slate-300'
                                }`}
                              >
                                {row.isInactive ? <><Eye size={8} /> Activate</> : <><EyeOff size={8} /> Deactivate</>}
                              </button>
                            )}
                            {/* Sync to checklist */}
                            {!isSubmitted && !row.isInactive && linkedChecklist && (onChecklistGenerated || onRowSynced) && (
                              <button
                                onClick={() => syncRowToChecklist(row)}
                                title={row.rowStatus === 'pending-sync'
                                  ? 'Re-sync: updates the checklist template only. Active audit reports are unaffected.'
                                  : 'Push this question into the checklist editor'}
                                className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wide transition-colors ${
                                  row.rowStatus === 'pending-sync'
                                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                                    : 'bg-violet-600 text-white hover:bg-violet-700'
                                }`}
                              >
                                <RefreshCw size={8} /> {row.rowStatus === 'pending-sync' ? 'Re-Sync' : 'Sync'}
                              </button>
                            )}
                            {/* Delete */}
                            <button onClick={() => deleteRows([row.id])} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-lg" title="Delete row">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm italic">
                        {rows.length === 0 ? 'No rows yet — add rows to get started' : 'No rows match your filters'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100">
              <p className="text-[9px] text-slate-400 leading-relaxed text-center">
                <span className="font-black text-slate-500">How it works:</span>
                {' '}Click any cell to edit · <span className="text-slate-500 font-bold">single-click</span> opens dropdowns. <span className="text-indigo-500 font-bold">Save as Draft</span> stores progress. Row <span className="text-violet-600 font-bold">Sync</span> pushes one question. Select rows with checkboxes then click <span className="text-violet-600 font-bold">Bulk Sync</span> to push selected questions.
                <br />
                Department → <span className="font-black text-slate-600">Page</span> · SOPs Name → <span className="font-black text-indigo-500">Section</span> · Sub SOPs → <span className="font-black text-violet-600">Sub-section</span>
                {linkedChecklistTitle && <>{' '}· <span className="text-emerald-600 font-black">Linked to: {linkedChecklistTitle}</span></>}
              </p>
            </div>
          </>
        )}
      </div>
    </div>

    {/* ── Review Modal ── */}
    {showReviewModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-violet-700 to-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Review Before Submission</h3>
              <p className="text-[10px] text-violet-200 mt-0.5">
                Compare with saved database · {reviewRows.filter(e => e.status === 'new').length} new · {reviewRows.filter(e => e.status === 'modified').length} modified · {reviewRows.filter(e => e.status === 'unchanged').length} unchanged
              </p>
            </div>
            <button onClick={() => setShowReviewModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all">
              <X size={16} />
            </button>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4 flex-wrap shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>New — not in database, will be added</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>Modified — differs from database · <span className="text-slate-500">tick to overwrite</span></span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>Unchanged — identical to database</span>
            <button onClick={() => { const all = new Set(reviewRows.map(e => e.row.id)); setReviewIncluded(all); }} className="ml-auto text-[10px] font-bold text-indigo-600 hover:underline">Select All</button>
            <button onClick={() => setReviewIncluded(new Set())} className="text-[10px] font-bold text-slate-400 hover:underline">Deselect All</button>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full min-w-[700px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 w-8 text-center text-slate-400 font-bold">✓</th>
                  <th className="px-3 py-2 w-8 text-center text-slate-400 font-bold">#</th>
                  <th className="px-3 py-2 text-slate-600 font-black">Question</th>
                  <th className="px-3 py-2 text-slate-600 font-black">Status</th>
                  <th className="px-3 py-2 text-slate-600 font-black">Current Value</th>
                  <th className="px-3 py-2 text-slate-600 font-black">Database Value</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((entry, idx) => {
                  const included = reviewIncluded.has(entry.row.id);
                  const statusColors = { new: 'bg-emerald-50 border-l-2 border-emerald-400', modified: 'bg-amber-50 border-l-2 border-amber-400', unchanged: 'bg-white border-l-2 border-transparent' };
                  const badgeColors = { new: 'bg-emerald-100 text-emerald-700 border-emerald-200', modified: 'bg-amber-100 text-amber-700 border-amber-200', unchanged: 'bg-slate-100 text-slate-500 border-slate-200' };
                  const deptRespLabel = (row: MasterChecklistRow) => row.deptResponsibility.map(p => `${p.department || '—'}/${p.responsibility || '—'}`).join('; ') || '—';
                  return (
                    <tr key={entry.row.id} className={`border-b border-slate-100 transition-colors ${statusColors[entry.status]} ${!included && entry.status === 'modified' ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => setReviewIncluded(prev => { const s = new Set(prev); s.has(entry.row.id) ? s.delete(entry.row.id) : s.add(entry.row.id); return s; })}
                          className="accent-violet-600 cursor-pointer"
                          disabled={entry.status === 'unchanged'}
                          title={entry.status === 'unchanged' ? 'Unchanged rows are always included' : entry.status === 'new' ? 'New rows are always included' : 'Toggle to overwrite database value'}
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                      <td className="px-3 py-2 align-top">
                        <p className="font-bold text-slate-800 leading-snug">{entry.row.question}</p>
                        {entry.status === 'modified' && entry.changes.length > 0 && (
                          <p className="text-[9px] text-amber-600 font-bold mt-0.5">Changed: {entry.changes.join(', ')}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded uppercase border ${badgeColors[entry.status]}`}>{entry.status}</span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="text-[10px] text-slate-700 space-y-0.5">
                          {entry.changes.includes('Dept/Resp') && <p><span className="font-bold text-slate-500">Dept/Resp:</span> {deptRespLabel(entry.row)}</p>}
                          {entry.changes.includes('SOP') && <p><span className="font-bold text-slate-500">SOP:</span> {entry.row.sopName || '—'}</p>}
                          {entry.changes.includes('Sub SOP') && <p><span className="font-bold text-slate-500">Sub SOP:</span> {entry.row.subSopName || '—'}</p>}
                          {entry.changes.includes('Risk') && <p><span className="font-bold text-slate-500">Risk:</span> {entry.row.riskCategory || '—'}</p>}
                          {entry.changes.includes('Max Score') && <p><span className="font-bold text-slate-500">Score:</span> {entry.row.maxScore}</p>}
                          {entry.changes.length === 0 && entry.status === 'new' && <p className="text-emerald-600 font-bold">New question</p>}
                          {entry.changes.length === 0 && entry.status === 'unchanged' && <p className="text-slate-400 italic">No changes</p>}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {entry.dbRow ? (
                          <div className="text-[10px] text-slate-500 space-y-0.5">
                            {entry.changes.includes('Dept/Resp') && <p><span className="font-bold">Dept/Resp:</span> {deptRespLabel(entry.dbRow)}</p>}
                            {entry.changes.includes('SOP') && <p><span className="font-bold">SOP:</span> {entry.dbRow.sopName || '—'}</p>}
                            {entry.changes.includes('Sub SOP') && <p><span className="font-bold">Sub SOP:</span> {entry.dbRow.subSopName || '—'}</p>}
                            {entry.changes.includes('Risk') && <p><span className="font-bold">Risk:</span> {entry.dbRow.riskCategory || '—'}</p>}
                            {entry.changes.includes('Max Score') && <p><span className="font-bold">Score:</span> {entry.dbRow.maxScore}</p>}
                            {entry.changes.length === 0 && <p className="text-slate-400 italic">Same</p>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">— not in database —</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
            <div className="text-[10px] text-slate-500">
              <span className="font-bold text-slate-700">{reviewIncluded.size + reviewRows.filter(e => e.status === 'unchanged' || e.status === 'new').length - [...reviewIncluded].filter(id => reviewRows.find(e => e.row.id === id && e.status === 'unchanged' || e.status === 'new')).length}</span> rows will be submitted
              {reviewRows.some(e => e.status === 'modified' && !reviewIncluded.has(e.row.id)) && (
                <span className="ml-2 text-amber-600 font-bold">· {reviewRows.filter(e => e.status === 'modified' && !reviewIncluded.has(e.row.id)).length} modified rows skipped (keeping database values)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider bg-white border-2 border-slate-200 text-slate-600 rounded-xl hover:border-slate-300 transition-all">
                Cancel
              </button>
              <button
                onClick={() => {
                  const rowsToSubmit = reviewRows
                    .filter(e => e.status === 'unchanged' || e.status === 'new' || reviewIncluded.has(e.row.id))
                    .map(e => e.row);
                  handleFinalSubmit(rowsToSubmit);
                }}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <><RefreshCw size={11} className="animate-spin" /> Syncing…</> : <><CheckCircle2 size={11} /> Confirm &amp; Bulk Sync</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* Fixed-position multi-select dept picker — rendered outside table to avoid overflow-hidden clipping */}
    {deptPickerOpen && (() => {
      const takenDepts = getPickerTakenDepts(deptPickerOpen.rowId);
      const availableDepts = departmentNames.filter(d => d.toLowerCase().includes(deptPickerSearch.toLowerCase()));
      const selectableCount = deptPickerSel.filter(d => !takenDepts.has(d)).length;
      return (
          <div
            ref={deptPickerRef}
            className="fixed z-[999] bg-white rounded-xl border border-slate-200 shadow-2xl w-64 flex flex-col"
            style={{ top: deptPickerPos.top, left: deptPickerPos.left, maxHeight: 320 }}
          >
            <div className="px-3 pt-3 pb-2 border-b border-slate-100">
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                Select departments — each creates a separate row
              </p>
              <input
                autoFocus
                value={deptPickerSearch}
                onChange={e => setDeptPickerSearch(e.target.value)}
                placeholder="Search departments…"
                className="w-full px-2 py-1 text-[10px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-300"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {availableDepts.map(dept => {
                const isTaken = takenDepts.has(dept);
                const isChecked = deptPickerSel.includes(dept);
                return (
                  <label
                    key={dept}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors ${isTaken ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                    title={isTaken ? 'Already used for this question' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isTaken}
                      onChange={() => {
                        if (isTaken) return;
                        setDeptPickerSel(prev =>
                          prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
                        );
                      }}
                      className="accent-indigo-600 w-3 h-3 disabled:cursor-not-allowed"
                    />
                    <span className={`text-[10px] font-semibold ${isTaken ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{dept}</span>
                    {isTaken && <span className="ml-auto text-[8px] font-bold text-rose-400 uppercase tracking-wide">Used</span>}
                  </label>
                );
              })}
              {availableDepts.length === 0 && (
                <p className="px-3 py-4 text-[10px] text-slate-400 italic text-center">No departments found</p>
              )}
            </div>
            <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-400">
                {selectableCount > 0
                  ? `${selectableCount} selected${selectableCount > 1 ? ` → ${selectableCount} rows` : ''}`
                  : takenDepts.size > 0
                    ? `${takenDepts.size} already used`
                    : '0 selected'}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDeptPickerOpen(null)}
                  className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={applyDeptPicker}
                  disabled={selectableCount === 0}
                  className="px-3 py-1 text-[9px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
      );
    })()}
    {mergeModal && (() => {
      const selRows = rows.filter(r => selectedRows.has(r.id));
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-[90%] max-w-[640px] max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Layers2 size={18} className="text-violet-600" /> Merge Questions</h3>
                <p className="text-xs text-slate-500 mt-1">Combine {selRows.length} selected questions into one. Observation history will transfer automatically.</p>
              </div>
              <button onClick={() => setMergeModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Selected Questions</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selRows.map(r => (
                    <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-black text-slate-300 w-5 text-center">{r.slNo}</span>
                      <span className="text-xs text-slate-700 flex-1 truncate">{r.question || '(empty)'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Merge Into</label>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setMergeTarget('existing')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${mergeTarget === 'existing' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500 hover:border-violet-200'}`}>
                    Existing Question
                  </button>
                  <button onClick={() => setMergeTarget('new')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${mergeTarget === 'new' ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-500 hover:border-violet-200'}`}>
                    New Question Text
                  </button>
                </div>
                {mergeTarget === 'existing' ? (
                  <div className="space-y-1.5">
                    {selRows.map(r => (
                      <label key={r.id} onClick={() => setMergeSelectedId(r.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${mergeSelectedId === r.id ? 'bg-violet-50 border-violet-300 ring-1 ring-violet-200' : 'bg-white border-slate-200 hover:border-violet-200'}`}>
                        <input type="radio" checked={mergeSelectedId === r.id} onChange={() => setMergeSelectedId(r.id)} className="accent-violet-600 w-3.5 h-3.5" />
                        <span className="text-xs text-slate-700 flex-1">{r.question || '(empty)'}</span>
                        <span className="text-[9px] text-slate-400">#{r.slNo}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={mergeNewText}
                    onChange={e => setMergeNewText(e.target.value)}
                    placeholder="Enter the merged question text..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 resize-none"
                  />
                )}
              </div>
              {responseSets.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Response Set</label>
                  <select
                    value={mergeResponseSetId}
                    onChange={e => setMergeResponseSetId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 bg-white"
                  >
                    <option value="">Auto (match by score)</option>
                    {responseSets.map(rs => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name || rs.id} — {(rs.responses || []).map(r => r.text).join(' / ')}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1">Choose which response options (Yes/No, Compliant/NC, etc.) the merged question will use in the audit checklist.</p>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                  <strong>What happens:</strong> All department/responsibility pairs will be combined. Standards will be merged. The highest risk level and max score will be kept. Observation history from all merged questions will transfer to the surviving question.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setMergeModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={executeMerge}
                disabled={mergeTarget === 'existing' ? !mergeSelectedId : !mergeNewText.trim()}
                className="px-5 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Layers2 size={12} /> Merge Questions
              </button>
            </div>
          </div>
        </div>
      );
    })()}

    {splitModal && (() => {
      const parentRow = rows.find(r => r.id === splitModal.rowId);
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-[90%] max-w-[640px] max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><CopyPlus size={18} className="text-amber-600" /> Split Question</h3>
                <p className="text-xs text-slate-500 mt-1">Split into multiple child questions. Observation history will copy to all children.</p>
              </div>
              <button onClick={() => setSplitModal(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 block">Original Question</label>
                <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs text-slate-700 font-medium">{splitModal.question || '(empty)'}</p>
                  {parentRow && <p className="text-[9px] text-slate-400 mt-1">{parentRow.sopName}{parentRow.subSopName ? ` > ${parentRow.subSopName}` : ''} | {parentRow.riskCategory || 'No Risk'} | Score: {parentRow.maxScore}</p>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Child Questions</label>
                  <button onClick={() => setSplitQuestions(prev => [...prev, ''])} className="text-[10px] font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus size={10} /> Add</button>
                </div>
                <div className="space-y-2">
                  {splitQuestions.map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[9px] font-black text-slate-300 mt-2.5 w-5 text-center">{i + 1}</span>
                      <textarea
                        value={text}
                        onChange={e => setSplitQuestions(prev => prev.map((t, j) => j === i ? e.target.value : t))}
                        placeholder={`Child question ${i + 1}...`}
                        rows={2}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
                      />
                      {splitQuestions.length > 2 && (
                        <button onClick={() => setSplitQuestions(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500 mt-2 p-0.5"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  <strong>What happens:</strong> The original question will be replaced with {splitQuestions.filter(t => t.trim()).length} child questions. Each child inherits the same SOP, risk, category, departments, and max score. Observation history from the original question will be available on all child questions.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setSplitModal(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
              <button
                onClick={executeSplit}
                disabled={splitQuestions.filter(t => t.trim()).length < 2}
                className="px-5 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CopyPlus size={12} /> Split into {splitQuestions.filter(t => t.trim()).length} Questions
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    {showAddSectionModal && (() => {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Add New Section</h3>
            </div>
            <div className="px-6 py-4">
              <input
                type="text"
                autoFocus
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                placeholder="Enter section name..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
              {sections.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-600 mb-2">Existing Sections:</p>
                  <div className="flex flex-wrap gap-2">
                    {sections.map(section => (
                      <span key={section} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium">
                        {section}
                        <button
                          onClick={() => setSections(sections.filter(s => s !== section))}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddSectionModal(false);
                  setNewSectionName('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newSectionName.trim()) {
                    setSections([...sections, newSectionName.trim()]);
                    setNewSectionName('');
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50"
                disabled={!newSectionName.trim()}
              >
                Add Section
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
};

export default MasterChecklistTable;
