"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { useNotifications } from './NotificationContext';
import type { Equipment } from './FacilityManagement';
import { 
  Star, 
  MapPin, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Eye,
  EyeOff, 
  History, 
  CheckCircle2, 
  Trash2, 
  XCircle, 
  Ban, 
  Wrench, 
  Edit2,
  Edit3, 
  LayoutTemplate,
  Layers, 
  Users, 
  Package, 
  Signal, 
  ArrowRight,
  MoreVertical,
  Calendar,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Save,
  Check,
  Loader2,
  ShieldAlert,
  CheckCheck,
  MessageSquare,
  Zap,
  ChevronDown,
  Hourglass,
  UserPlus,
  GitCommit,
  Camera,
  ImageIcon,
  Upload,
  FileSpreadsheet,
  FileDown,
  FileUp,
  AlertCircle,
  FileEdit,
  ExternalLink,
  AlertOctagon,
  Maximize2,
  Tag,
  Eraser,
  Repeat,
  User,
  Building,
  Send,
  BookOpen,
  Lock,
  SlidersHorizontal,
  Info,
  Target,
  FileText,
  BarChart3,
  RotateCcw,
  List,
  Share2,
  ArrowLeft,
  ClipboardList,
  Clipboard,
  ChevronUp,
  TrendingUp,
  Award,
  Droplets,
  Bug,
  Settings,
  Flag,
  Link2Off,
  Link2,
  Megaphone,
  KeyRound,
} from 'lucide-react';
import { Entity, HierarchyScope, AuditTask, AuditObservation } from '../types';
import { getEscalationContactsForResponsibility, type EscalationContact } from '../utils/escalationContacts';
import ComplaintFormModal, { PhotoEditor, CollageStudio, AuditQuestionOption } from './ComplaintFormModal';
import AddObservationModal from './AddObservationModal';
import UnifiedPagination from './UnifiedPagination';
import ObservationAnalytics from './ObservationAnalytics';
import { compressImage } from '@/utils/imageCompression';
import InlineRewriteButton from './InlineRewriteButton';
import { requestWhatsAppObservationConfirm } from './WhatsAppObservationHost';
import { autoSendObservationViaWhatsApp } from '../utils/whatsappAutoSend';
import { getPublicSiteUrl } from '../utils/publicSiteUrl';

import { handlePasteImages, pasteFromClipboard } from '@/utils/clipboardImages';
import ClosureFormModal, { compressImageForSave, makeFileHandlers } from './ClosureFormModal';

// Card primitives + shared types now live in ObservationCards.tsx so the
// public share-link recipient page can render the SAME visual cards as the
// internal registry. Keep all card UI changes there — both surfaces pick
// them up automatically.
import {
  ObservationCard,
  MobileObservationCard,
  ActionGrid,
  formatIST,
  formatISTDate,
  type ObservationItem,
  type TrackingStep,
  type BreakdownHistoryEntry,
  type MobileObservationCardProps,
} from './ObservationCards';

// Re-export ObservationItem so existing external importers
// (`import type { ObservationItem } from './ObservationRegistry'`) keep
// working without each having to be touched.
export type { ObservationItem } from './ObservationCards';

// --- Utilities ---

const compressImageFile = async (file: File): Promise<{ file: File, url: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      const compressed = await compressImage(dataUrl);
      resolve({ file, url: compressed });
    };
    reader.onerror = () => {
        resolve({ file, url: URL.createObjectURL(file) });
    };
  });
};

const fetchImage = async (url: string): Promise<ArrayBuffer | null> => { 
  try { 
    const response = await fetch(url); 
    const blob = await response.blob(); 
    return await blob.arrayBuffer(); 
  } catch (error) { 
    console.error("Failed to fetch image for excel export", error); 
    return null; 
  } 
};

// --- Types ---

// TrackingStep, BreakdownHistoryEntry, ObservationItem and the formatIST
// helpers all moved to components/ObservationCards.tsx (imported above) so
// the public share page renders against the same shape.

interface AdvancedFilterState {
    sops: string[];
    severities: string[];
    levels: string[];
    staff: string[];
    assets: string[];
    foodCategories: string[];
    regionals: string[];
    units: string[];
    departments: string[];
    locations: string[];
    responsibilities: string[];
    statuses: string[];
    createdFrom: string;
    createdTo: string;
    closureFrom: string;
    closureTo: string;
    inProgressFrom: string;
    inProgressTo: string;
    generalFrom: string;
    generalTo: string;
}

const INITIAL_ADV_FILTERS: AdvancedFilterState = {
    sops: [], severities: [], levels: [], staff: [], assets: [], foodCategories: [],
    regionals: [], units: [], departments: [], locations: [], responsibilities: [], statuses: [],
    createdFrom: '', createdTo: '', closureFrom: '', closureTo: '', 
    inProgressFrom: '', inProgressTo: '', generalFrom: '', generalTo: ''
};



// --- Sub-Components ---

const AnalyticNode = ({ label, value, onClick, isActive }: any) => (
    <div 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 group ${isActive ? 'relative' : ''}`}
    >
        <span className={`text-[8px] font-black uppercase tracking-tighter transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
            {label}
        </span>
        <span className={`text-sm font-black transition-transform group-hover:translate-x-0.5 ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>
            {value}
        </span>
    </div>
);

// Searchable multi-select. The checkbox list is hidden until the user
// clicks the search input (dropdown-style). Selected values show as
// removable chips above the trigger. Clicking outside closes the list.
const SearchableMultiSelect = ({ label, values, onChange, options, placeholder }: {
    label: string;
    values: string[];
    onChange: (next: string[]) => void;
    options: string[];
    placeholder: string;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    }, [options, search]);

    const toggle = (v: string) => {
        const set = new Set(values);
        if (set.has(v)) set.delete(v); else set.add(v);
        onChange(Array.from(set));
    };

    return (
        <div ref={wrapRef} className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                {values.length > 0 && (
                    <button type="button" onClick={() => { onChange([]); setOpen(false); }}
                        className="text-[9px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider flex items-center gap-1">
                        <X size={10} /> Clear ({values.length})
                    </button>
                )}
            </div>

            {/* Selected chips — always visible so user sees active selections */}
            {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50/40 rounded-xl border border-indigo-100">
                    {values.map(v => (
                        <span key={v} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-indigo-200 rounded-full text-[10px] font-black text-indigo-700 shadow-sm">
                            <span className="truncate max-w-[140px]">{v}</span>
                            <button type="button" onClick={() => toggle(v)} className="text-indigo-400 hover:text-rose-500 transition-colors"><X size={10} /></button>
                        </span>
                    ))}
                </div>
            )}

            {/* Search trigger + dropdown list */}
            <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onFocus={() => setOpen(true)}
                    placeholder={open ? 'Type to search…' : placeholder}
                    className={`w-full pl-8 pr-8 py-2.5 bg-slate-50 border-2 rounded-xl text-[11px] font-bold focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-medium cursor-pointer ${open ? 'border-indigo-400 bg-white' : 'border-slate-100'}`}
                />
                <button type="button" onClick={() => { setOpen(o => !o); setSearch(''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors">
                    <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180 text-indigo-400' : ''}`} />
                </button>

                {open && (
                    <div className="absolute z-[300] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-1 fade-in duration-150">
                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                            {filtered.length === 0 ? (
                                <div className="px-3 py-5 text-[10px] font-bold text-slate-400 text-center uppercase">No matches</div>
                            ) : (
                                filtered.map(opt => {
                                    const checked = values.includes(opt);
                                    return (
                                        <label key={opt} onMouseDown={e => e.preventDefault()}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-50 last:border-b-0 select-none ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                                            <input type="checkbox" checked={checked} onChange={() => toggle(opt)}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0" />
                                            <span className={`text-[11px] font-bold flex-1 truncate ${checked ? 'text-indigo-700' : 'text-slate-700'}`}>{opt}</span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AdvancedGlobalFilterModal = ({ onClose, onApply, currentFilters, totalRecords, hierarchicalFilteredReports }: { onClose: () => void, onApply: (filters: AdvancedFilterState) => void, currentFilters: AdvancedFilterState, totalRecords: number, hierarchicalFilteredReports: any[] }) => {
    const [localFilters, setLocalFilters] = useState<AdvancedFilterState>(currentFilters);

    // Build distinct, sorted option lists from the registry's observation
    // dataset so the dropdowns only show values that actually exist. We
    // accept the same loose "any" type the rest of this component uses.
    const distinct = (pick: (o: any) => string | undefined | null) => {
        const set = new Set<string>();
        (hierarchicalFilteredReports || []).forEach(o => { const v = (pick(o) || '').toString().trim(); if (v) set.add(v); });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    };
    const deptOptions = useMemo(() => distinct(o => o.departmentName || o.mainKitchen), [hierarchicalFilteredReports]);
    const locationOptions = useMemo(() => distinct(o => o.area), [hierarchicalFilteredReports]);
    const respOptions = useMemo(() => {
        const set = new Set<string>();
        (hierarchicalFilteredReports || []).forEach((o: any) => {
            if (o.mainKitchen) set.add(o.mainKitchen);
            (o.people || []).forEach((p: any) => { if (p?.name) set.add(p.name); });
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [hierarchicalFilteredReports]);

    const toggleStatus = (s: string) => {
        const set = new Set(localFilters.statuses || []);
        if (set.has(s)) set.delete(s); else set.add(s);
        setLocalFilters({ ...localFilters, statuses: Array.from(set) });
    };
    const statusChips: { key: string; label: string; activeBg: string; activeText: string }[] = [
        { key: 'OPEN', label: 'Open', activeBg: 'bg-rose-500', activeText: 'text-white' },
        { key: 'IN_PROGRESS', label: 'In Progress', activeBg: 'bg-blue-500', activeText: 'text-white' },
        { key: 'RESOLVED', label: 'Resolved', activeBg: 'bg-emerald-500', activeText: 'text-white' },
    ];

    const activeCount = (
        localFilters.departments.length + localFilters.locations.length +
        localFilters.responsibilities.length + localFilters.statuses.length +
        localFilters.severities.length + (localFilters.sops[0] ? 1 : 0)
    );

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[88vh] sm:h-[85vh]">
                <div className="px-5 sm:px-8 py-4 sm:py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <SlidersHorizontal size={22} />
                        <div>
                            <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">Global Registry Filter</h3>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mt-0.5">{activeCount} active &middot; {totalRecords} matching record{totalRecords !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={22}/></button>
                </div>
                <div className="p-5 sm:p-8 space-y-6 bg-white overflow-y-auto custom-scrollbar flex-1 text-left">
                    {/* Status — segmented chips. Quick toggle for the most common
                        filter the user reaches for. */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {statusChips.map(c => {
                                const active = (localFilters.statuses || []).includes(c.key);
                                return (
                                    <button key={c.key} type="button" onClick={() => toggleStatus(c.key)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${active ? `${c.activeBg} ${c.activeText} border-transparent shadow-md` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                        {c.label}
                                    </button>
                                );
                            })}
                            {(localFilters.statuses || []).length > 0 && (
                                <button type="button" onClick={() => setLocalFilters({ ...localFilters, statuses: [] })} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1">
                                    <X size={11} /> Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Hierarchy + responsibility — searchable multi-selects */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SearchableMultiSelect
                            label="Department"
                            values={localFilters.departments}
                            onChange={v => setLocalFilters({ ...localFilters, departments: v })}
                            options={deptOptions}
                            placeholder="Search departments..."
                        />
                        <SearchableMultiSelect
                            label="Location"
                            values={localFilters.locations}
                            onChange={v => setLocalFilters({ ...localFilters, locations: v })}
                            options={locationOptions}
                            placeholder="Search locations..."
                        />
                        <SearchableMultiSelect
                            label="Responsibility"
                            values={localFilters.responsibilities}
                            onChange={v => setLocalFilters({ ...localFilters, responsibilities: v })}
                            options={respOptions}
                            placeholder="Search responsibilities..."
                        />
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Keyword</label>
                                <input
                                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 placeholder:text-slate-300 placeholder:font-medium"
                                    value={localFilters.sops[0] || ""}
                                    onChange={e => setLocalFilters({ ...localFilters, sops: e.target.value ? [e.target.value] : [] })}
                                    placeholder="Search SOP..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Severity</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black uppercase outline-none focus:border-indigo-500"
                                    value={localFilters.severities[0] || ""}
                                    onChange={e => setLocalFilters({ ...localFilters, severities: e.target.value ? [e.target.value] : [] })}
                                >
                                    <option value="">Any</option>
                                    <option value="MINOR">Minor</option>
                                    <option value="MAJOR">Major</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-5 sm:px-10 py-4 sm:py-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between sm:justify-end items-stretch sm:items-center gap-3 shrink-0">
                    <button type="button" onClick={() => setLocalFilters(INITIAL_ADV_FILTERS)} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-slate-300 hover:text-slate-800 transition-all">Reset All</button>
                    <button type="button" onClick={() => onApply(localFilters)} className="px-12 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Apply Filters</button>
                </div>
            </div>
        </div>
    );
};

const SearchableSelect = ({ value, onChange, options, placeholder, className }: { value: string, onChange: (v: string) => void, options: string[], placeholder: string, className?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={ref} className={`relative ${className || ''}`}>
            <div
                className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-bold outline-none focus-within:border-indigo-400 uppercase cursor-pointer flex items-center justify-between gap-1"
                onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
            >
                <span className={`truncate ${value ? 'text-slate-800' : 'text-slate-400'}`}>{value || placeholder}</span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                            <Search size={12} className="text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-300 uppercase"
                                onClick={e => e.stopPropagation()}
                            />
                            {search && <button onClick={(e) => { e.stopPropagation(); setSearch(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>}
                        </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {value && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 uppercase tracking-wide border-b border-slate-50"
                            >
                                Clear Selection
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">No matches found</div>
                        ) : (
                            filtered.map(opt => (
                                <button
                                    key={opt}
                                    onClick={(e) => { e.stopPropagation(); onChange(opt); setSearch(''); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${opt === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    {opt}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const BulkUploadModal = ({ isOpen, onClose, onSave, availableLocations }: { isOpen: boolean, onClose: () => void, onSave: (loc: string, files: File[]) => void, availableLocations: string[] }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [location, setLocation] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-lg p-6">
                <div className="flex justify-between items-center mb-6 border-b pb-3 text-left"><h3 className="text-lg font-bold">Bulk Evidence Upload</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="space-y-4 text-left">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Location/Dept</label>
                    <SearchableSelect value={location} onChange={setLocation} options={availableLocations} placeholder="Select Location..." /></div>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"
                        onClick={() => inputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50'); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50'); }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50'); if (e.dataTransfer.files?.length) { const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (imageFiles.length > 0) setFiles(prev => [...prev, ...imageFiles]); } }}
                    >
                        <Upload size={32} className="text-slate-300 mb-2" /><span className="text-sm font-bold text-slate-500">Click or Drop Images Here</span>
                        <input type="file" id="bulk-upload-input" ref={inputRef} multiple accept="image/*" className="hidden" onChange={e => e.target.files && setFiles(prev => [...prev, ...Array.from(e.target.files!).filter(f => f.type.startsWith('image/'))])} />
                    </div>
                    {files.length > 0 && <div className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 flex items-center justify-between">{files.length} files selected <button onClick={(e) => { e.stopPropagation(); setFiles([]); }} className="text-indigo-400 hover:text-red-500"><X size={14}/></button></div>}
                    <button onClick={() => onSave(location, files)} disabled={!location || files.length === 0} className="w-full bg-indigo-600 text-white rounded-xl py-3.5 text-xs font-black uppercase tracking-widest disabled:opacity-30 shadow-lg hover:bg-indigo-700 transition-all">Upload to Registry</button>
                </div>
            </div>
        </div>
    );
};

const QuestionSearchSelect = ({ value, questions, onChange, placeholder }: { value: string, questions: AuditQuestionOption[], onChange: (questionId: string) => void, placeholder: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectedQ = questions.find(q => q.id === value);
    const filtered = search.trim() ? questions.filter(q => q.text.toLowerCase().includes(search.toLowerCase()) || q.sectionTitle.toLowerCase().includes(search.toLowerCase()) || (q.checklistName || '').toLowerCase().includes(search.toLowerCase())) : questions;

    return (
        <div ref={ref} className="relative">
            <div
                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[10px] font-medium outline-none focus-within:border-indigo-400 cursor-pointer flex items-center justify-between gap-1"
                onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
            >
                <span className={`truncate ${selectedQ ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>{selectedQ ? selectedQ.text : placeholder}</span>
                <ChevronDown size={12} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200 w-[min(100%,400px)]">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                            <Search size={12} className="text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search question, section, or checklist..."
                                className="w-full bg-transparent text-[10px] font-medium outline-none placeholder:text-slate-300"
                                onClick={e => e.stopPropagation()}
                            />
                            {search && <button onClick={(e) => { e.stopPropagation(); setSearch(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>}
                        </div>
                    </div>
                    <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                        {value && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 text-[9px] font-bold text-rose-500 hover:bg-rose-50 uppercase tracking-wide border-b border-slate-50"
                            >
                                Clear Selection
                            </button>
                        )}
                        {filtered.length === 0 ? (
                            <div className="px-3 py-6 text-[10px] font-bold text-slate-400 text-center">No questions match your search</div>
                        ) : (
                            filtered.slice(0, 50).map(q => (
                                <button
                                    key={q.id}
                                    onClick={(e) => { e.stopPropagation(); onChange(q.id); setSearch(''); setIsOpen(false); }}
                                    className={`w-full text-left px-3 py-2 transition-colors border-b border-slate-50 ${q.id === value ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                >
                                    <p className={`text-[10px] font-bold leading-snug line-clamp-2 ${q.id === value ? 'text-indigo-700' : 'text-slate-700'}`}>{q.text}</p>
                                    <div className="flex gap-1.5 mt-0.5">
                                        {q.sectionTitle && <span className="text-[7px] font-bold text-slate-400">{q.sectionTitle}</span>}
                                        {q.checklistName && <span className="text-[7px] font-bold text-indigo-400">&middot; {q.checklistName}</span>}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ReviewCsvModal = ({ stagedData, onCommit, onCancel, availableLocations, availableDepartments, availableSops, questions }: { stagedData: any[], onCommit: (rows: any[]) => void, onCancel: () => void, availableLocations: string[], availableDepartments: string[], availableSops: string[], questions?: AuditQuestionOption[] }) => {
    const [rows, setRows] = useState(stagedData);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const handleUpdate = (idx: number, field: string, value: string) => {
        const next = [...rows];
        next[idx] = { ...next[idx], [field]: value };
        setRows(next);
    };

    const handleQuestionSelect = (idx: number, questionId: string) => {
        const q = (questions || []).find(qq => qq.id === questionId);
        if (!q) return;
        const next = [...rows];
        next[idx] = { ...next[idx], questionId: q.id, questionText: q.text, sectionTitle: q.sectionTitle, checklistName: q.checklistName, sop: q.department || next[idx].sop };
        setRows(next);
    };

    const handleRemove = (idx: number) => {
        setRows(rows.filter((_, i) => i !== idx));
        if (expandedRow === idx) setExpandedRow(null);
        else if (expandedRow !== null && expandedRow > idx) setExpandedRow(expandedRow - 1);
    };

    const questionOptions = useMemo(() => {
        if (!questions || questions.length === 0) return [];
        const seen = new Set<string>();
        return questions.filter(q => {
            if (seen.has(q.text)) return false;
            seen.add(q.text);
            return true;
        });
    }, [questions]);

    const validCount = rows.filter(r => r.title || r.questionText).length;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col border border-slate-200 animate-in zoom-in-95 overflow-hidden">
                <div className="px-5 sm:px-10 py-5 sm:py-7 bg-[#1e293b] text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl"><FileUp size={20} /></div>
                        <div>
                            <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">Review Import Data</h3>
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mt-0.5">{rows.length} record{rows.length !== 1 ? 's' : ''} staged &middot; {validCount} valid</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={22}/></button>
                </div>

                <div className="flex-1 overflow-auto p-3 sm:p-5 bg-slate-50 custom-scrollbar space-y-3">
                    {rows.map((row, idx) => {
                        const isExpanded = expandedRow === idx;
                        return (
                            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-visible transition-all relative" style={{ zIndex: isExpanded ? 50 : 1 }}>
                                <div className="flex items-start gap-3 p-3 sm:p-4">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center shrink-0">
                                        {row.evidence ? <img src={row.evidence} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-1"><ImageIcon size={20}/><span className="text-[6px] font-bold uppercase">No Image</span></div>}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <input
                                            className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:border-indigo-400 outline-none uppercase placeholder:normal-case placeholder:text-slate-300"
                                            value={row.title}
                                            onChange={e => handleUpdate(idx, 'title', e.target.value)}
                                            placeholder="Observation title..."
                                        />
                                        <div className="flex gap-2 flex-wrap">
                                            <input
                                                type="date"
                                                className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[10px] font-bold focus:border-indigo-400 outline-none flex-shrink-0"
                                                value={row.date}
                                                onChange={e => handleUpdate(idx, 'date', e.target.value)}
                                            />
                                            <div className="flex-1 min-w-[120px]">
                                                <SearchableSelect value={row.location} onChange={v => handleUpdate(idx, 'location', v)} options={availableLocations} placeholder="Location..." />
                                            </div>
                                            <div className="flex-1 min-w-[100px]">
                                                <SearchableSelect value={row.responsibility} onChange={v => handleUpdate(idx, 'responsibility', v)} options={availableDepartments} placeholder="Department..." />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <button onClick={() => setExpandedRow(isExpanded ? null : idx)} className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`} title="More fields"><ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>
                                        <button onClick={() => handleRemove(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Remove"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0 border-t border-slate-50 space-y-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                                        <div>
                                            <label className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1 block ml-0.5">Linked Question</label>
                                            <QuestionSearchSelect
                                                value={row.questionId || ''}
                                                questions={questionOptions}
                                                onChange={(qId) => handleQuestionSelect(idx, qId)}
                                                placeholder="Search & select a question..."
                                            />
                                            {row.questionText && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {row.sectionTitle && <span className="text-[7px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">{row.sectionTitle}</span>}
                                                    {row.checklistName && <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">{row.checklistName}</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-0.5">SOP Reference</label>
                                                <SearchableSelect value={row.sop} onChange={v => handleUpdate(idx, 'sop', v)} options={availableSops} placeholder="Select SOP..." />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-0.5">Observation Notes</label>
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[10px] font-medium focus:border-indigo-400 outline-none placeholder:text-slate-300"
                                                    value={row.observationText || ''}
                                                    onChange={e => handleUpdate(idx, 'observationText', e.target.value)}
                                                    placeholder="Additional details..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {rows.length === 0 && (
                        <div className="py-20 text-center">
                            <FileUp size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-sm font-bold text-slate-400">No records to review</p>
                        </div>
                    )}
                </div>

                <div className="px-5 sm:px-10 py-4 sm:py-6 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                    <p className="text-[9px] font-bold text-slate-400 uppercase hidden sm:block">{rows.length} record{rows.length !== 1 ? 's' : ''} ready</p>
                    <div className="flex gap-2 sm:gap-3 ml-auto">
                        <button onClick={onCancel} className="px-6 sm:px-10 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Discard</button>
                        <button onClick={() => onCommit(rows)} disabled={rows.length === 0} className="px-8 sm:px-14 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-30 active:scale-95">Commit Import</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DeleteConfirmationModal = ({ id, onClose, onConfirm }: { id: string, onClose: () => void, onConfirm: () => void }) => (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-md p-6 text-left">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32}/></div>
            <h3 className="text-xl font-black text-center mb-2">Confirm Delete</h3>
            <p className="text-center text-slate-500 text-sm mb-6">Are you sure you want to permanently remove observation <strong>#{id}</strong>? This action is irreversible.</p>
            <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 border rounded-xl text-xs font-black uppercase">Cancel</button><button onClick={onConfirm} className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase">Delete Record</button></div>
        </div>
    </div>
);

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Signature Auth" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (initialData && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0);
                img.src = initialData;
            }
        }
    }, [initialData]);

    const startDrawing = (e: any) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) { compressImage(canvas.toDataURL()).then(compressed => onSave(compressed)); }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onSave('');
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                <button type="button" onClick={clear} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                </button>
            </div>
            <div className="w-full h-24 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={96} 
                    className="w-full h-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                />
            </div>
        </div>
    );
};


const StatusConsolidatedCard = ({ 
    title, 
    icon: Icon, 
    iconBg, 
    stats, 
    activeCategory, 
    activeMetric, 
    metric, 
    onFilterClick 
}: { 
    title: string, 
    icon: any, 
    iconBg: string, 
    stats: any, 
    activeCategory: string | null, 
    activeMetric: string | null, 
    metric: string, 
    onFilterClick: (cat: 'sent' | 'received' | 'all', metric: string) => void 
}) => {
    const getStatKey = (metric: string) => {
        if (metric === 'RESOLVED') return 'closed';
        if (metric === 'IN_PROGRESS') return 'inProgress';
        return 'open';
    };
    const key = getStatKey(metric);

    return (
        <div className={`lg:col-span-3 bg-white p-5 rounded-[2rem] border transition-all flex flex-col gap-5 shrink-0 snap-center min-w-[280px] md:flex-1 ${activeMetric === metric ? 'border-indigo-600 shadow-2xl ring-4 ring-indigo-50' : 'border-slate-100 shadow-xl shadow-slate-200/40'}`}>
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl ${iconBg} text-white flex items-center justify-center shadow-lg`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em] truncate">{title}</h3>
            </div>
            <div className="grid grid-cols-3 gap-y-4 gap-x-4">
                <AnalyticNode 
                    label="Sent" 
                    value={stats.sent[key]} 
                    onClick={() => onFilterClick('sent', metric)} 
                    isActive={activeCategory === 'sent' && activeMetric === metric} 
                />
                <AnalyticNode 
                    label="Received" 
                    value={stats.received[key]} 
                    onClick={() => onFilterClick('received', metric)} 
                    isActive={activeCategory === 'received' && activeMetric === metric} 
                />
                <AnalyticNode 
                    label="Unified" 
                    value={stats.all[key]} 
                    onClick={() => onFilterClick('all', metric)} 
                    isActive={activeCategory === 'all' && activeMetric === metric} 
                />
            </div>
        </div>
    );
};



// `makeFileHandlers` and `compressImageForSave` now live in
// components/ClosureFormModal.tsx and are imported above so the public
// share-link surface can reuse them. NonComplianceFormModal below still
// uses the imported `makeFileHandlers` unchanged.

// --- Closure Form Modal (Mirrors AddObservationModal layout, prefilled + locked) ---
// Matches the visual structure of the New Observation popup so users see the
// familiar form. The top context (Filters, Question) is prefilled and locked
// because those values belong to the original observation. The Tag Category
// chips are prefilled and locked too — closure shouldn't change classification.
// Editable fields: closure comments + closure evidence (camera/gallery/paste).
// Footer: Cancel / Draft (save without resolving) / Send (mark RESOLVED).


// --- Non-Compliance Form Modal (Same design as Closure) ---

const NonComplianceFormModal: React.FC<{
    obs: ObservationItem;
    onClose: () => void;
    onSave: (data: { findings: string; evidenceUrl: string | null; allEvidence: { url: string }[]; signature: string }) => void;
    onViewImage?: (url: string, label: string) => void;
}> = ({ obs, onClose, onSave, onViewImage }) => {
    const [findings, setFindings] = useState('');
    const [evidenceItems, setEvidenceItems] = useState<{ url: string; isCompressing?: boolean }[]>([]);
    const [collageImage, setCollageImage] = useState<string | null>(null);
    const [isCollageStudioOpen, setIsCollageStudioOpen] = useState(false);
    const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
    const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);
    const [sigData, setSigData] = useState('');
    const cameraCaptureRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [showMediaMenu, setShowMediaMenu] = useState(false);
    const mediaMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) setShowMediaMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const [isSaving, setIsSaving] = useState(false);

    const { processFiles, handleFileUpload, handleDrop } = makeFileHandlers(setEvidenceItems, setEditingPhotoIndex, setEditingPhoto, setIsDragging, setShowMediaMenu);

    const handleSaveCollage = (dataUrl: string, finalImages: string[]) => {
        setCollageImage(dataUrl);
        setEvidenceItems(finalImages.map(url => ({ url, isCompressing: false })));
        setIsCollageStudioOpen(false);
        setShowMediaMenu(false);
    };

    const handleRemoveCollage = () => { setCollageImage(null); };

    const handleSaveEditedPhoto = (editedUrl: string) => {
        if (editingPhotoIndex !== null) {
            setEvidenceItems(prev => prev.map((item, idx) => idx === editingPhotoIndex ? { ...item, url: editedUrl } : item));
            if (collageImage) setCollageImage(null);
        } else {
            setEvidenceItems(prev => [...prev, { url: editedUrl }]);
        }
        setEditingPhoto(null);
        setEditingPhotoIndex(null);
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const compressedEvidence = await Promise.all(evidenceItems.map(async (item) => ({ url: await compressImageForSave(item.url, 100) })));
            const compressedCollage = collageImage ? await compressImageForSave(collageImage, 100) : null;
            onSave({
                findings: findings || 'Non-compliance reported.',
                evidenceUrl: compressedCollage || (compressedEvidence.length > 0 ? compressedEvidence[0].url : null),
                allEvidence: compressedEvidence,
                signature: sigData
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col relative animate-in zoom-in-95 border border-slate-200 overflow-hidden max-h-[90vh]">
                {isDragging && (
                    <div className="absolute inset-0 z-[170] bg-rose-600/80 flex items-center justify-center text-white m-2 rounded-[2.5rem] pointer-events-none">
                        <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-2xl"><Upload size={24} /><span className="text-base font-black uppercase">Drop Images Here</span></div>
                    </div>
                )}

                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 text-left">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-lg"><ShieldAlert size={20} strokeWidth={3} /></div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Non-Compliance Log</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{obs.id} · {obs.sop}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
                </div>

                <div
                    className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-4"
                    onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; if (dragCounterRef.current === 1) setIsDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDragLeave={(e) => { e.preventDefault(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); } }}
                    onDrop={(e) => { dragCounterRef.current = 0; handleDrop(e); }}
                >
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3 mb-2">
                            {obs.thumbnail ? <img src={obs.thumbnail} className="w-12 h-12 rounded-xl object-cover border border-slate-200" alt="" /> : <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center"><Camera size={14} className="text-slate-300" /></div>}
                            <div className="min-w-0 flex-1 text-left">
                                <h4 className="text-xs font-black text-slate-700 uppercase truncate">{obs.observationText || obs.title}</h4>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{obs.area}{obs.people.length > 0 ? ` · ${obs.people.map(p => p.name).join(', ')}` : ''}</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative bg-slate-50 border-2 border-slate-100 rounded-[2rem] shadow-inner flex flex-col min-h-[300px]">
                        <div className="p-3 border-b border-slate-200/60 flex items-center justify-end gap-3 bg-white/50 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex gap-2 items-center">
                                <div className="relative" ref={mediaMenuRef}>
                                    <button type="button" onClick={() => setShowMediaMenu(!showMediaMenu)} className={`w-11 h-11 rounded-2xl flex items-center justify-center border-2 transition-all ${showMediaMenu ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-rose-400'}`}><Camera size={20}/></button>
                                    {showMediaMenu && (
                                        <div className="absolute top-full right-0 mt-3 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1 animate-in zoom-in-95 text-left z-50">
                                            <button onClick={() => { cameraCaptureRef.current?.click(); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl flex items-center gap-3 text-xs font-black uppercase text-slate-700 transition-colors"><Camera size={16}/> Camera</button>
                                            <button onClick={() => { galleryInputRef.current?.click(); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 rounded-xl flex items-center gap-3 text-xs font-black uppercase text-slate-700 transition-colors"><ImageIcon size={16}/> Gallery</button>
                                            <button onClick={() => { setShowMediaMenu(false); pasteFromClipboard((img) => setEvidenceItems(prev => [...prev, { url: img }])); }} className="w-full text-left px-4 py-3 hover:bg-sky-50 rounded-xl flex items-center gap-3 text-xs font-black uppercase text-sky-700 transition-colors"><Clipboard size={16}/> Paste Image</button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleSubmit} disabled={isSaving || !findings.trim() || !sigData} className="w-11 h-11 bg-rose-600 text-white rounded-2xl shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center disabled:opacity-40 disabled:scale-95">{isSaving ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}</button>
                            </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col gap-4 relative">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap gap-2">
                                    {collageImage ? (
                                        <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-4 border-rose-500 group cursor-zoom-in shadow-xl animate-in zoom-in" onClick={() => onViewImage?.(collageImage, 'Non-Compliance Collage')}>
                                            <img src={collageImage} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setIsCollageStudioOpen(true); }} className="p-1.5 bg-white rounded-lg text-rose-600 hover:scale-110 transition-transform" title="Edit Collage"><Edit2 size={16} strokeWidth={3} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleRemoveCollage(); }} className="p-1.5 bg-rose-500 rounded-lg text-white hover:scale-110 transition-transform" title="Remove Collage"><Trash2 size={16} strokeWidth={3} /></button>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-rose-600/90 text-white text-[8px] font-black text-center py-0.5 uppercase tracking-tighter">Collage Active</div>
                                        </div>
                                    ) : (
                                        evidenceItems.map((item, i) => (
                                            <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-rose-200 group cursor-zoom-in shadow-sm">
                                                <img src={item.url} className="w-full h-full object-cover" onClick={() => onViewImage?.(item.url, 'Non-Compliance Evidence')} />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingPhotoIndex(i); setEditingPhoto(item.url); }} className="p-1 bg-white rounded text-rose-600 hover:bg-rose-50" title="Edit Image"><Edit2 size={10} strokeWidth={3} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); setEvidenceItems(p => p.filter((_, idx) => idx !== i)); }} className="p-1 bg-rose-500 rounded text-white hover:bg-rose-600" title="Remove Image"><X size={10} strokeWidth={3}/></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {!collageImage && evidenceItems.length >= 2 && (
                                    <button type="button" onClick={() => setIsCollageStudioOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all w-fit shadow-sm animate-in fade-in">
                                        <LayoutTemplate size={14} />
                                        Create Multi-Photo Collage
                                    </button>
                                )}
                            </div>

                            <textarea
                                value={findings}
                                onChange={e => setFindings(e.target.value)}
                                onPaste={e => handlePasteImages(e, (img) => setEvidenceItems(prev => [...prev, { url: img }]))}
                                placeholder="Detail the persistent findings, non-compliance issues, and required corrective actions..."
                                className="flex-1 w-full bg-transparent text-sm font-medium focus:outline-none resize-none placeholder:text-slate-300 text-left min-h-[120px]"
                            />
                            <div className="flex justify-end mt-2">
                                <InlineRewriteButton
                                    text={findings}
                                    onSelect={(rewritten) => setFindings(rewritten)}
                                />
                            </div>
                        </div>
                    </div>

                    <SignaturePad onSave={setSigData} label="QA Verifier Signature" />
                </div>

                <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3 text-left">
                    <div className="p-2 bg-white rounded-lg border border-slate-200 text-rose-500 shadow-sm"><Info size={14}/></div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        Document persistent findings with evidence. Signature required. This creates a new follow-up observation.
                    </p>
                </div>

                <input ref={cameraCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />

                {isCollageStudioOpen && (
                    <CollageStudio
                        initialImages={evidenceItems.map(item => item.url)}
                        onSave={handleSaveCollage}
                        onClose={() => setIsCollageStudioOpen(false)}
                    />
                )}

                {editingPhoto && (
                    <PhotoEditor
                        imageUrl={editingPhoto}
                        onSave={handleSaveEditedPhoto}
                        onCancel={() => { setEditingPhoto(null); setEditingPhotoIndex(null); }}
                    />
                )}
            </div>
        </div>
    );
};

// --- ObservationRegistry ---

const DEPT_PERSONNEL: Record<string, { heads: string[]; staff: string[] }> = {
    'Main Kitchen': { heads: ['Chef Kumar', 'Sous Chef Ravi'], staff: ['Cook Ali', 'Cook Priya', 'Helper Sunil'] },
    'Cold Kitchen': { heads: ['Chef Deepak'], staff: ['Cook Meena', 'Cook Farhan'] },
    'Bakery': { heads: ['Pastry Chef Anita'], staff: ['Baker Rohit', 'Baker Sana'] },
    'Store Room': { heads: ['Store Manager Vijay'], staff: ['Store Asst. Rekha', 'Store Asst. Imran'] },
    'Receiving Bay': { heads: ['QA Lead Nisha'], staff: ['Inspector Ram', 'Inspector Lata'] },
    'Housekeeping': { heads: ['HK Manager Pooja'], staff: ['HK Lead Suresh', 'HK Staff Geeta'] },
    'General': { heads: ['Unit Manager'], staff: ['QA Auditor', 'Duty Manager'] },
};

interface QuestionStats {
    questionId: string;
    questionText: string;
    sectionTitle: string;
    checklistName: string;
    department: string;
    departments: string[];
    responsibility: string[];
    maxScore: number;
    obsCount: number;
    fullMarksCount: number;
    partialMarksCount: number;
    naCount: number;
    totalObtained: number;
    totalPossible: number;
    compliancePct: number;
    auditCount: number;
    observations: ObservationItem[];
    categories: string[];
    locations: string[];
    sops: string[];
    subSops: string[];
    isFollowUp: boolean;
}

interface ChecklistViewFilters {
    category: string;
    department: string;
    location: string;
    sop: string;
    subSop: string;
    responsibility: string;
}

export const ChecklistObservationView: React.FC<{
    data: ObservationItem[],
    auditQuestions?: AuditQuestionOption[],
    auditTasks?: AuditTask[],
    onViewImage?: (img: { url: string, label: string }) => void,
    questionTextRemap?: Record<string, string>,
    questionTextAliases?: Record<string, string[]>,
    onMarkRepeat?: (obs: ObservationItem) => void,
    fabZIndex?: string,
    modalZIndex?: string,
    fabBottom?: string,
}> = ({ data, auditQuestions = [], auditTasks = [], onViewImage, questionTextRemap = {}, questionTextAliases = {}, onMarkRepeat, fabZIndex = 'z-[60]', modalZIndex = 'z-[200]', fabBottom = 'bottom-6' }) => {
    // For obs grouping key building (used to normalize obs texts via merge aliases only)
    const resolveText = (t: string) => questionTextRemap[t] ?? t;
    // Get all aliased old texts for a given current question text (merge + split inheritance)
    const getAliasedTexts = (qText: string): string[] => questionTextAliases[qText] || [];
    const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null);
    const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
    const [selectedPolicyByChecklist, setSelectedPolicyByChecklist] = useState<Record<string, string | null>>({});
    const [selectedCategoryByChecklist, setSelectedCategoryByChecklist] = useState<Record<string, string | null>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<ChecklistViewFilters>({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [fullscreenImage, setFullscreenImage] = useState<{ url: string; label: string } | null>(null);
    const [showPolicyCards, setShowPolicyCards] = useState(true);
    const [showCategoryCards, setShowCategoryCards] = useState(true);

    const isInDateRange = useCallback((dateStr: string) => {
        if (!dateFrom && !dateTo) return true;
        if (!dateStr) return false;
        try {
            const d = new Date(dateStr).getTime();
            if (isNaN(d)) return false;
            if (dateFrom) { const from = new Date(dateFrom); from.setHours(0,0,0,0); if (d < from.getTime()) return false; }
            if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59,999); if (d > to.getTime()) return false; }
            return true;
        } catch { return false; }
    }, [dateFrom, dateTo]);

    const isTaskInDateRange = useCallback((task: AuditTask) => {
        if (!dateFrom && !dateTo) return true;
        const dateStr = task.endTime || task.startTime || task.scheduledDate || '';
        return isInDateRange(dateStr);
    }, [dateFrom, dateTo, isInDateRange]);

    const questionStatsMap = useMemo(() => {
        // Build obsMap with ORIGINAL questionTexts — alias lookup happens at query time
        const obsMap: Record<string, ObservationItem[]> = {};
        const seenObsIds = new Set<string>();
        const seenObsContentKeys = new Set<string>();
        data.filter(o => o.checklistName && o.questionText && isInDateRange(o.createdDate)).forEach(item => {
            if (seenObsIds.has(item.id)) return;
            seenObsIds.add(item.id);
            const origQText = item.questionText || 'General Observation';
            const contentKey = `${item.checklistName}::${origQText}::${(item.observationText || item.title || '').trim().toLowerCase()}`;
            if (seenObsContentKeys.has(contentKey)) return;
            seenObsContentKeys.add(contentKey);
            const key = `${item.checklistName}::${origQText}`;
            if (!obsMap[key]) obsMap[key] = [];
            obsMap[key].push(item);
        });

        // Return all obs for a question, including obs from ancestor/merged questions
        const getObsForQuestion = (clName: string, qText: string): ObservationItem[] => {
            const seen = new Set<string>();
            const items: ObservationItem[] = [];
            const addObs = (text: string) => {
                (obsMap[`${clName}::${text}`] || []).forEach(o => {
                    if (!seen.has(o.id)) { seen.add(o.id); items.push(o); }
                });
            };
            addObs(qText);
            // Merge aliases: old texts that were remapped to this new text
            Object.entries(questionTextRemap).filter(([, v]) => v === qText).forEach(([k]) => addObs(k));
            // Split/merge aliases from questionTextAliases: each old ancestor text
            getAliasedTexts(qText).forEach(addObs);
            return items;
        };

        const completedTasks = auditTasks.filter(t => t.status === 'Completed' && isTaskInDateRange(t));

        // Build taskObsByQuestion with ORIGINAL questionTexts
        const taskObsByQuestion: Record<string, { obtained: number; max: number; response: string; taskId: string }[]> = {};
        completedTasks.forEach(task => {
            (task.observations || []).forEach(obs => {
                const qText = obs.questionText || '';
                const clName = obs.checklistName || task.checklistName || task.title || '';
                const key = `${clName}::${qText}`;
                if (!taskObsByQuestion[key]) taskObsByQuestion[key] = [];
                taskObsByQuestion[key].push({
                    obtained: obs.marksObtained ?? 0,
                    max: obs.marksMax ?? 0,
                    response: obs.selectedResponse || '',
                    taskId: task.id
                });
            });
        });

        // Get task-obs for a question, unioning all ancestor texts
        const getTaskObsForQuestion = (clName: string, qText: string) => {
            const seen = new Set<string>();
            const items: { obtained: number; max: number; response: string; taskId: string }[] = [];
            const addTaskObs = (text: string) => {
                (taskObsByQuestion[`${clName}::${text}`] || []).forEach(o => {
                    const key = `${o.taskId}::${text}`;
                    if (!seen.has(key)) { seen.add(key); items.push(o); }
                });
            };
            addTaskObs(qText);
            Object.entries(questionTextRemap).filter(([, v]) => v === qText).forEach(([k]) => addTaskObs(k));
            getAliasedTexts(qText).forEach(addTaskObs);
            return items;
        };

        const auditCountByChecklist: Record<string, number> = {};
        completedTasks.forEach(task => {
            const clName = task.checklistName || task.title || '';
            auditCountByChecklist[clName] = (auditCountByChecklist[clName] || 0) + 1;
        });

        const statsMap: Record<string, Record<string, QuestionStats>> = {};

        auditQuestions.forEach(q => {
            const clName = q.checklistName || 'Checklist';
            const qText = q.text || 'Untitled';
            const key = `${clName}::${qText}`;
            if (!statsMap[clName]) statsMap[clName] = {};
            if (statsMap[clName][qText]) return;

            const obs = getObsForQuestion(clName, qText);
            const taskObs = getTaskObsForQuestion(clName, qText);
            const auditsDone = auditCountByChecklist[clName] || 0;

            let fullMarks = 0, partialMarks = 0, naMarks = 0;
            let totalObtained = 0, totalPossible = 0;

            const maxScore = Math.max(...(q.responses || []).map(r => parseFloat(r.score) || 0), 0);

            if (taskObs.length > 0) {
                taskObs.forEach(to => {
                    const resp = to.response.toLowerCase().trim();
                    if (resp === 'n/a' || resp === 'na' || resp === 'not applicable') {
                        naMarks++;
                    } else if (to.max > 0 && to.obtained >= to.max) {
                        fullMarks++;
                        totalObtained += to.obtained;
                        totalPossible += to.max;
                    } else {
                        partialMarks++;
                        totalObtained += to.obtained;
                        totalPossible += to.max;
                    }
                });
            }

            const auditsWithoutObs = auditsDone - taskObs.length;
            if (auditsWithoutObs > 0 && maxScore > 0) {
                fullMarks += auditsWithoutObs;
                totalObtained += auditsWithoutObs * maxScore;
                totalPossible += auditsWithoutObs * maxScore;
            }

            const compliancePct = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : (auditsDone > 0 ? 100 : 0);

            const obsCats = obs.map(o => o.categories?.[0]?.name).filter(Boolean) as string[];
            if (q.category) obsCats.push(q.category);
            const categories = [...new Set(obsCats)];
            const locations = [...new Set(obs.map(o => o.area).filter(Boolean))];
            const obsDepts = obs.map(o => o.departmentName || o.mainKitchen).filter(Boolean);
            if (q.department) obsDepts.push(q.department);
            const departments = [...new Set(obsDepts)];
            const secParts = (q.sectionTitle || '').split('>').map(s => s.trim());
            const sops = secParts[0] ? [secParts[0]] : [];
            const subSops = secParts[1] ? [secParts[1]] : [];

            statsMap[clName][qText] = {
                questionId: q.id,
                questionText: qText,
                sectionTitle: q.sectionTitle || 'General',
                checklistName: clName,
                department: q.department || '',
                departments,
                responsibility: q.responsibility || [],
                maxScore,
                obsCount: obs.length,
                fullMarksCount: fullMarks,
                partialMarksCount: partialMarks,
                naCount: naMarks,
                totalObtained,
                totalPossible,
                compliancePct,
                auditCount: auditsDone,
                observations: obs,
                categories,
                locations,
                sops,
                subSops,
                isFollowUp: q.isFollowUp || false
            };
        });

        Object.entries(obsMap).forEach(([key, obs]) => {
            const [clName, ...qParts] = key.split('::');
            const qText = qParts.join('::');
            if (!statsMap[clName]) statsMap[clName] = {};
            // Skip if already handled (by the question loop above, or if it's an old alias text)
            if (statsMap[clName][qText]) return;
            // Skip if this questionText is a known alias (will appear under a child question)
            const isAlias = Object.values(questionTextAliases).some(oldTexts => (oldTexts as string[]).includes(qText));
            if (isAlias) return;

            const taskObs = getTaskObsForQuestion(clName, qText);
            const auditsDone = auditCountByChecklist[clName] || 0;
            let fullMarks = 0, partialMarks = 0, naMarks = 0;
            let totalObtained = 0, totalPossible = 0;

            taskObs.forEach(to => {
                const resp = to.response.toLowerCase().trim();
                if (resp === 'n/a' || resp === 'na' || resp === 'not applicable') {
                    naMarks++;
                } else if (to.max > 0 && to.obtained >= to.max) {
                    fullMarks++;
                    totalObtained += to.obtained;
                    totalPossible += to.max;
                } else {
                    partialMarks++;
                    totalObtained += to.obtained;
                    totalPossible += to.max;
                }
            });

            const compliancePct = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : 0;
            const categories = [...new Set(obs.map(o => o.categories?.[0]?.name).filter(Boolean))] as string[];
            const locations = [...new Set(obs.map(o => o.area).filter(Boolean))];
            const departments2 = [...new Set(obs.map(o => o.departmentName || o.mainKitchen).filter(Boolean))];
            const secParts = (obs[0]?.sectionTitle || '').split('>').map(s => s.trim());

            statsMap[clName][qText] = {
                questionId: obs[0]?.id || key,
                questionText: qText,
                sectionTitle: obs[0]?.sectionTitle || 'General',
                checklistName: clName,
                department: obs[0]?.departmentName || '',
                departments: departments2,
                responsibility: obs[0]?.people?.map(p => p.name) || [],
                maxScore: obs[0]?.maxMarks || 0,
                obsCount: obs.length,
                fullMarksCount: fullMarks,
                partialMarksCount: partialMarks,
                naCount: naMarks,
                totalObtained,
                totalPossible,
                compliancePct,
                auditCount: auditsDone,
                observations: obs,
                categories,
                locations,
                sops: secParts[0] ? [secParts[0]] : [],
                subSops: secParts[1] ? [secParts[1]] : [],
                isFollowUp: false
            };
        });

        return statsMap;
    }, [data, auditQuestions, auditTasks, isInDateRange, isTaskInDateRange, questionTextRemap, questionTextAliases]);

    const filterOptions = useMemo(() => {
        const cats = new Set<string>();
        const depts = new Set<string>();
        const locs = new Set<string>();
        const sops = new Set<string>();
        const subSops = new Set<string>();
        const resps = new Set<string>();
        Object.values(questionStatsMap).forEach(questions => {
            Object.values(questions).forEach(q => {
                q.categories.forEach(c => cats.add(c));
                if (q.department) depts.add(q.department);
                q.departments.forEach(d => depts.add(d));
                q.locations.forEach(l => locs.add(l));
                q.sops.forEach(s => sops.add(s));
                q.subSops.forEach(s => subSops.add(s));
                q.responsibility.forEach(r => resps.add(r));
            });
        });
        return {
            categories: [...cats].sort(),
            departments: [...depts].sort(),
            locations: [...locs].sort(),
            sops: [...sops].sort(),
            subSops: [...subSops].sort(),
            responsibilities: [...resps].sort()
        };
    }, [questionStatsMap]);

    const filteredStatsMap = useMemo(() => {
        const filtered: Record<string, Record<string, QuestionStats>> = {};
        Object.entries(questionStatsMap).forEach(([clName, questions]) => {
            const fq: Record<string, QuestionStats> = {};
            Object.entries(questions).forEach(([qText, stats]) => {
                if (filters.category && !stats.categories.includes(filters.category)) return;
                if (filters.department && !stats.departments.includes(filters.department) && stats.department !== filters.department) return;
                if (filters.location && !stats.locations.includes(filters.location)) return;
                if (filters.sop && !stats.sops.includes(filters.sop)) return;
                if (filters.subSop && !stats.subSops.includes(filters.subSop)) return;
                if (filters.responsibility && !stats.responsibility.includes(filters.responsibility)) return;
                if (searchTerm.trim()) {
                    const term = searchTerm.toLowerCase();
                    if (!clName.toLowerCase().includes(term) && !qText.toLowerCase().includes(term) && !stats.sectionTitle.toLowerCase().includes(term) && !stats.department.toLowerCase().includes(term)) return;
                }
                fq[qText] = stats;
            });
            if (Object.keys(fq).length > 0) filtered[clName] = fq;
        });
        return filtered;
    }, [questionStatsMap, filters, searchTerm]);

    const checklistNames = Object.keys(filteredStatsMap).sort();
    const totalQuestions = Object.values(filteredStatsMap).reduce((sum, qs) => sum + Object.keys(qs).length, 0);
    const totalObs = Object.values(filteredStatsMap).reduce((sum, qs) => sum + Object.values(qs).reduce((s, q) => s + q.obsCount, 0), 0);
    const activeFilterCount = Object.values(filters).filter(v => v).length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

    const getComplianceColor = (pct: number) => {
        if (pct >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (pct >= 70) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-rose-600 bg-rose-50 border-rose-200';
    };

    const getComplianceBarColor = (pct: number) => {
        if (pct >= 90) return 'bg-emerald-500';
        if (pct >= 70) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-500 text-white';
            case 'MAJOR': return 'bg-amber-500 text-white';
            default: return 'bg-blue-500 text-white';
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-rose-50 text-rose-600 border-rose-200';
            case 'RESOLVED': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
            case 'IN_PROGRESS': return 'bg-blue-50 text-blue-600 border-blue-200';
            case 'PENDING_VERIFICATION': return 'bg-amber-50 text-amber-600 border-amber-200';
            default: return 'bg-slate-50 text-slate-600 border-slate-200';
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch { return dateStr; }
    };

    const SearchableFilterSelect: React.FC<{ label: string; value: string; options: string[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => {
        const [open, setOpen] = useState(false);
        const [search, setSearch] = useState('');
        const ref = useRef<HTMLDivElement>(null);
        useEffect(() => {
            const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
            document.addEventListener('mousedown', handler);
            return () => document.removeEventListener('mousedown', handler);
        }, []);
        const filtered = search.trim() ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;
        return (
            <div className="flex-1 min-w-[120px] relative" ref={ref}>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
                <button type="button" onClick={() => { setOpen(!open); setSearch(''); }} className={`w-full px-2 py-1.5 bg-white border rounded-lg text-[10px] font-bold text-left flex items-center justify-between gap-1 transition-all ${open ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-slate-200'} ${value ? 'text-slate-700' : 'text-slate-400'}`}>
                    <span className="truncate">{value || 'All'}</span>
                    <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 flex flex-col overflow-hidden">
                        <div className="p-1.5 border-b border-slate-100">
                            <div className="relative">
                                <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." autoFocus className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-indigo-300 placeholder:text-slate-300" />
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors ${!value ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>All</button>
                            {filtered.map(o => (
                                <button type="button" key={o} onClick={() => { onChange(o); setOpen(false); }} className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors truncate ${value === o ? 'bg-indigo-50 text-indigo-600' : 'text-slate-700 hover:bg-slate-50'}`}>{o}</button>
                            ))}
                            {filtered.length === 0 && <div className="px-3 py-2 text-[9px] text-slate-400 italic">No matches</div>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const [excelExporting, setExcelExporting] = useState(false);
    const [showExcelMenu, setShowExcelMenu] = useState(false);
    const excelMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) setShowExcelMenu(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allQuestionStats = useMemo(() => {
        const all: QuestionStats[] = [];
        Object.values(filteredStatsMap).forEach(qs => Object.values(qs).forEach(q => all.push(q)));
        return all;
    }, [filteredStatsMap]);

    const allObservations = useMemo(() => allQuestionStats.flatMap(q => q.observations), [allQuestionStats]);

    const categoryDashboard = useMemo(() => {
        const cats: Record<string, { count: number; obsCount: number; compliance: number }> = {};
        allQuestionStats.forEach(q => {
            const cat = q.sops[0] || q.sectionTitle || 'General';
            if (!cats[cat]) cats[cat] = { count: 0, obsCount: 0, compliance: 0 };
            cats[cat].count++;
            cats[cat].obsCount += q.obsCount;
        });
        Object.keys(cats).forEach(cat => {
            const catQuestions = allQuestionStats.filter(q => (q.sops[0] || q.sectionTitle || 'General') === cat);
            const totalObt = catQuestions.reduce((s, q) => s + q.totalObtained, 0);
            const totalPos = catQuestions.reduce((s, q) => s + q.totalPossible, 0);
            cats[cat].compliance = totalPos > 0 ? Math.round((totalObt / totalPos) * 100) : 100;
        });
        return Object.entries(cats).sort((a, b) => b[1].obsCount - a[1].obsCount);
    }, [allQuestionStats]);

    const handleChecklistExcelExport = async (format: string) => {
        setExcelExporting(true);
        setShowExcelMenu(false);
        try {
            const exportData = allObservations.filter(obs => (obs.observationText || obs.title || '').trim() !== '');
            if (exportData.length === 0 && format !== 'summary') {
                alert('No observation records to export.');
                setExcelExporting(false);
                return;
            }
            const workbook = new ExcelJS.Workbook();
            if (format === 'summary') {
                const ws = workbook.addWorksheet('Checklist Summary');
                ws.columns = [
                    { header: 'Checklist', key: 'checklist', width: 30 },
                    { header: 'Question', key: 'question', width: 50 },
                    { header: 'Section / SOP', key: 'section', width: 25 },
                    { header: 'Department', key: 'department', width: 20 },
                    { header: 'Observations', key: 'obsCount', width: 14 },
                    { header: 'Full Marks', key: 'fullMarks', width: 12 },
                    { header: 'Partial Marks', key: 'partialMarks', width: 14 },
                    { header: 'N/A', key: 'na', width: 8 },
                    { header: 'Compliance %', key: 'compliance', width: 14 },
                    { header: 'Audits Done', key: 'audits', width: 12 },
                    { header: 'Marks Obtained', key: 'obtained', width: 15 },
                    { header: 'Marks Possible', key: 'possible', width: 15 },
                    { header: 'Responsibility', key: 'responsibility', width: 25 },
                ];
                const hr = ws.getRow(1);
                hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                hr.alignment = { vertical: 'middle', horizontal: 'center' };
                hr.height = 30;
                allQuestionStats.sort((a, b) => b.obsCount - a.obsCount).forEach(q => {
                    const row = ws.addRow({
                        checklist: q.checklistName,
                        question: q.questionText,
                        section: q.sectionTitle,
                        department: q.department,
                        obsCount: q.obsCount,
                        fullMarks: q.fullMarksCount,
                        partialMarks: q.partialMarksCount,
                        na: q.naCount,
                        compliance: q.compliancePct,
                        audits: q.auditCount,
                        obtained: q.totalObtained,
                        possible: q.totalPossible,
                        responsibility: q.responsibility.join(', '),
                    });
                    row.alignment = { vertical: 'middle', wrapText: true };
                    const compCell = row.getCell('compliance');
                    if (q.compliancePct >= 90) compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    else if (q.compliancePct >= 70) compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                    else compCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                });
            } else {
                const getGroupKey = (obs: ObservationItem): string => {
                    switch (format) {
                        case 'dept': return obs.mainKitchen || 'General';
                        case 'area': return obs.area || 'Unassigned';
                        case 'sop': return obs.sop || 'General';
                        case 'checklist': return obs.checklistName || 'Unknown';
                        default: return 'All';
                    }
                };
                const buildSheet = (ws_name: string, items: ObservationItem[]) => {
                    const ws = workbook.addWorksheet(ws_name.slice(0, 31));
                    ws.columns = [
                        { header: 'ID', key: 'id', width: 15 }, { header: 'Date', key: 'date', width: 12 },
                        { header: 'Question', key: 'question', width: 45 }, { header: 'Observation', key: 'title', width: 45 },
                        { header: 'Status', key: 'status', width: 15 }, { header: 'Reporter', key: 'reportedBy', width: 20 },
                        { header: 'SOP', key: 'sop', width: 25 }, { header: 'Responsibility', key: 'responsibility', width: 25 },
                        { header: 'Location', key: 'area', width: 20 }, { header: 'Max Marks', key: 'maxMarks', width: 12 },
                        { header: 'Mark Loss', key: 'markLoss', width: 12 }, { header: 'Severity', key: 'severity', width: 12 },
                        { header: 'Level', key: 'level', width: 10 }, { header: 'Closure', key: 'closure', width: 40 },
                    ];
                    const hr = ws.getRow(1);
                    hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                    hr.alignment = { vertical: 'middle', horizontal: 'center' };
                    hr.height = 30;
                    items.forEach(obs => {
                        const row = ws.addRow({
                            id: obs.id, date: obs.createdDate, question: obs.questionText || '',
                            title: obs.observationText || obs.title, status: obs.status,
                            reportedBy: obs.reportedBy, sop: obs.sop,
                            responsibility: obs.people?.length > 0 ? obs.people.map(p => p.name).join(', ') : obs.mainKitchen,
                            area: obs.area, maxMarks: obs.maxMarks ?? '', markLoss: obs.potentialMarkLoss ?? '',
                            severity: obs.severity, level: obs.level, closure: obs.closureComments || 'N/A',
                        });
                        row.alignment = { vertical: 'middle', wrapText: true };
                    });
                };
                if (format === 'general') {
                    buildSheet('Checklist Export', exportData);
                } else {
                    const groups: Record<string, ObservationItem[]> = {};
                    exportData.forEach(obs => { const k = getGroupKey(obs); if (!groups[k]) groups[k] = []; groups[k].push(obs); });
                    Object.keys(groups).sort().forEach(k => buildSheet(k, groups[k]));
                }
            }
            const outBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Checklist_Export_${format}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Checklist Excel export failed', err);
        } finally {
            setExcelExporting(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 space-y-4 relative">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-slate-100/80 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner"><ClipboardList size={20} /></div>
                    <div>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Checklist Observation Map</h3>
                        <p className="text-[10px] text-slate-400 font-bold">{checklistNames.length} checklists &middot; {totalQuestions} questions &middot; {totalObs} observations</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input type="text" placeholder="Search checklists, questions..." className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-bold focus:outline-none focus:border-indigo-400 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="relative" ref={excelMenuRef}>
                        <button onClick={() => setShowExcelMenu(!showExcelMenu)} disabled={excelExporting} className={`p-2.5 rounded-xl border-2 transition-all ${excelExporting ? 'bg-emerald-100 border-emerald-200 text-emerald-500' : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'}`} title="Export Excel">
                            {excelExporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        </button>
                        {showExcelMenu && (
                            <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 p-1">
                                <div className="p-1 space-y-0.5">
                                    <button onClick={() => handleChecklistExcelExport('summary')} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-2"><BarChart3 size={12} /> Summary Report</button>
                                    {['general', 'dept', 'area', 'sop', 'checklist'].map(m => (
                                        <button key={m} onClick={() => handleChecklistExcelExport(m)} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">{m === 'checklist' ? 'Checklist' : m} wise format</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {activeFilterCount > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {filters.category && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-bold border border-indigo-100"><span className="truncate max-w-[80px]">{filters.category}</span><button onClick={() => setFilters(f => ({...f, category: ''}))} className="hover:text-indigo-800"><X size={9}/></button></span>}
                    {filters.department && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[9px] font-bold border border-violet-100"><span className="truncate max-w-[80px]">{filters.department}</span><button onClick={() => setFilters(f => ({...f, department: ''}))} className="hover:text-violet-800"><X size={9}/></button></span>}
                    {filters.location && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold border border-emerald-100"><span className="truncate max-w-[80px]">{filters.location}</span><button onClick={() => setFilters(f => ({...f, location: ''}))} className="hover:text-emerald-800"><X size={9}/></button></span>}
                    {filters.sop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-bold border border-amber-100"><span className="truncate max-w-[80px]">{filters.sop}</span><button onClick={() => setFilters(f => ({...f, sop: ''}))} className="hover:text-amber-800"><X size={9}/></button></span>}
                    {filters.subSop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-600 rounded-full text-[9px] font-bold border border-sky-100"><span className="truncate max-w-[80px]">{filters.subSop}</span><button onClick={() => setFilters(f => ({...f, subSop: ''}))} className="hover:text-sky-800"><X size={9}/></button></span>}
                    {filters.responsibility && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-bold border border-rose-100"><span className="truncate max-w-[80px]">{filters.responsibility}</span><button onClick={() => setFilters(f => ({...f, responsibility: ''}))} className="hover:text-rose-800"><X size={9}/></button></span>}
                    {dateFrom && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">From: {dateFrom}<button onClick={() => setDateFrom('')} className="hover:text-slate-800"><X size={9}/></button></span>}
                    {dateTo && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">To: {dateTo}<button onClick={() => setDateTo('')} className="hover:text-slate-800"><X size={9}/></button></span>}
                </div>
            )}
            </div>

            <button onClick={() => setShowFilters(true)} className={`fixed ${fabBottom} right-6 ${fabZIndex} p-3.5 rounded-2xl shadow-2xl border-2 transition-all active:scale-90 ${activeFilterCount > 0 ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`} title="Open Filters">
                <SlidersHorizontal size={20} />
                {activeFilterCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">{activeFilterCount}</span>}
            </button>

            {showFilters && (
                <div className={`fixed inset-0 ${modalZIndex} flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm`} onClick={() => setShowFilters(false)}>
                    <div className="bg-white w-full sm:w-[480px] sm:max-w-[95vw] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><SlidersHorizontal size={18} /></div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Filters</h3>
                                    <p className="text-[10px] text-slate-400 font-bold">{activeFilterCount > 0 ? `${activeFilterCount} active` : 'No filters applied'}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={18} className="text-slate-400" /></button>
                        </div>
                        <div className="px-5 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">From Date</label>
                                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">To Date</label>
                                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <SearchableFilterSelect label="Observation Category" value={filters.category} options={filterOptions.categories} onChange={v => setFilters(f => ({ ...f, category: v }))} />
                                <SearchableFilterSelect label="Department" value={filters.department} options={filterOptions.departments} onChange={v => setFilters(f => ({ ...f, department: v }))} />
                                <SearchableFilterSelect label="Location" value={filters.location} options={filterOptions.locations} onChange={v => setFilters(f => ({ ...f, location: v }))} />
                                <SearchableFilterSelect label="SOP" value={filters.sop} options={filterOptions.sops} onChange={v => setFilters(f => ({ ...f, sop: v }))} />
                                <SearchableFilterSelect label="Sub SOP" value={filters.subSop} options={filterOptions.subSops} onChange={v => setFilters(f => ({ ...f, subSop: v }))} />
                                <SearchableFilterSelect label="Responsibility" value={filters.responsibility} options={filterOptions.responsibilities} onChange={v => setFilters(f => ({ ...f, responsibility: v }))} />
                            </div>
                        </div>
                        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
                            {activeFilterCount > 0 && (
                                <button onClick={() => { setFilters({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' }); setDateFrom(''); setDateTo(''); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
                                    <RotateCcw size={12} /> Clear All
                                </button>
                            )}
                            <button onClick={() => setShowFilters(false)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {checklistNames.map(checklistName => {
                    const questions = filteredStatsMap[checklistName];
                    const sortedQuestions = Object.values(questions).sort((a, b) => {
                        if (a.isFollowUp && !b.isFollowUp) return -1;
                        if (!a.isFollowUp && b.isFollowUp) return 1;
                        const scoreA = (100 - a.compliancePct) + (a.obsCount * 2);
                        const scoreB = (100 - b.compliancePct) + (b.obsCount * 2);
                        return scoreB - scoreA;
                    });
                    const totalObsInChecklist = sortedQuestions.reduce((sum, q) => sum + q.obsCount, 0);
                    const isExpanded = expandedChecklist === checklistName;
                    const clAuditCount = sortedQuestions[0]?.auditCount || 0;
                    const clTotalObtained = sortedQuestions.reduce((s, q) => s + q.totalObtained, 0);
                    const clTotalPossible = sortedQuestions.reduce((s, q) => s + q.totalPossible, 0);
                    const clCompliance = clTotalPossible > 0 ? Math.round((clTotalObtained / clTotalPossible) * 100) : (clAuditCount > 0 ? 100 : 0);
                    const openCount = sortedQuestions.reduce((s, q) => s + q.observations.filter(o => o.status === 'OPEN').length, 0);
                    const resolvedCount = sortedQuestions.reduce((s, q) => s + q.observations.filter(o => o.status === 'RESOLVED').length, 0);

                    return (
                        <div key={checklistName} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <button onClick={() => setExpandedChecklist(isExpanded ? null : checklistName)} className="w-full flex items-center justify-between p-4 md:p-5 text-left group">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'}`}>
                                        <FileText size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-black text-slate-800 truncate">{checklistName}</h4>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{sortedQuestions.length} questions</span>
                                            <span className="text-[9px] text-slate-300">&middot;</span>
                                            <span className="text-[9px] font-bold text-slate-400">{totalObsInChecklist} observations</span>
                                            {clAuditCount > 0 && (<><span className="text-[9px] text-slate-300">&middot;</span><span className="text-[9px] font-bold text-indigo-500">{clAuditCount} audit{clAuditCount !== 1 ? 's' : ''}</span></>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {clAuditCount > 0 && (
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border ${getComplianceColor(clCompliance)}`}>
                                            {clCompliance}%
                                        </span>
                                    )}
                                    {openCount > 0 && <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[9px] font-black rounded-lg border border-rose-100">{openCount} Open</span>}
                                    {resolvedCount > 0 && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-lg border border-emerald-100">{resolvedCount} Closed</span>}
                                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {isExpanded && (() => {
                                    const selectedPolicy = selectedPolicyByChecklist[checklistName] || null;
                                    const selectedCategory = selectedCategoryByChecklist[checklistName] || null;
                                    const policyGroups: Record<string, { questions: typeof sortedQuestions; obsCount: number; compliance: number; subPolicies: Record<string, { questions: typeof sortedQuestions; obsCount: number }> }> = {};
                                    const categoryGroups: Record<string, { questions: typeof sortedQuestions; obsCount: number; compliance: number }> = {};
                                    sortedQuestions.forEach(q => {
                                        const secParts = (q.sops[0] || q.sectionTitle || 'General').split('>').map(s => s.trim());
                                        const policy = secParts[0] || 'General';
                                        const subPolicy = secParts[1] || '';
                                        if (!policyGroups[policy]) policyGroups[policy] = { questions: [], obsCount: 0, compliance: 0, subPolicies: {} };
                                        policyGroups[policy].questions.push(q);
                                        policyGroups[policy].obsCount += q.obsCount;
                                        if (subPolicy) {
                                            if (!policyGroups[policy].subPolicies[subPolicy]) policyGroups[policy].subPolicies[subPolicy] = { questions: [], obsCount: 0 };
                                            policyGroups[policy].subPolicies[subPolicy].questions.push(q);
                                            policyGroups[policy].subPolicies[subPolicy].obsCount += q.obsCount;
                                        }
                                        const cats = q.categories.length > 0 ? q.categories : ['Uncategorized'];
                                        cats.forEach(cat => {
                                            if (!categoryGroups[cat]) categoryGroups[cat] = { questions: [], obsCount: 0, compliance: 0 };
                                            categoryGroups[cat].questions.push(q);
                                            categoryGroups[cat].obsCount += q.obsCount;
                                        });
                                    });
                                    Object.keys(policyGroups).forEach(p => {
                                        const qs = policyGroups[p].questions;
                                        const totalObt = qs.reduce((s, q) => s + q.totalObtained, 0);
                                        const totalPos = qs.reduce((s, q) => s + q.totalPossible, 0);
                                        policyGroups[p].compliance = totalPos > 0 ? Math.round((totalObt / totalPos) * 100) : 100;
                                    });
                                    Object.keys(categoryGroups).forEach(c => {
                                        const qs = categoryGroups[c].questions;
                                        const totalObt = qs.reduce((s, q) => s + q.totalObtained, 0);
                                        const totalPos = qs.reduce((s, q) => s + q.totalPossible, 0);
                                        categoryGroups[c].compliance = totalPos > 0 ? Math.round((totalObt / totalPos) * 100) : 100;
                                    });
                                    const policyEntries = Object.entries(policyGroups).sort((a, b) => b[1].obsCount - a[1].obsCount);
                                    const categoryEntries = Object.entries(categoryGroups).sort((a, b) => b[1].obsCount - a[1].obsCount);
                                    let displayQuestions = sortedQuestions;
                                    if (selectedPolicy) displayQuestions = policyGroups[selectedPolicy]?.questions || [];
                                    if (selectedCategory) displayQuestions = displayQuestions.filter(q => (q.categories.length > 0 ? q.categories : ['Uncategorized']).includes(selectedCategory));
                                    const getCatIcon = (catLower: string) => {
                                        if (catLower.includes('hygiene') || catLower.includes('clean') || catLower.includes('sanit')) return <Droplets size={16} className="text-blue-500" />;
                                        if (catLower.includes('document') || catLower.includes('record') || catLower.includes('paper')) return <FileText size={16} className="text-violet-500" />;
                                        if (catLower.includes('maintenance') || catLower.includes('equip') || catLower.includes('repair')) return <Wrench size={16} className="text-orange-500" />;
                                        if (catLower.includes('process') || catLower.includes('procedure') || catLower.includes('production')) return <Settings size={16} className="text-slate-500" />;
                                        if (catLower.includes('training') || catLower.includes('staff')) return <Users size={16} className="text-teal-500" />;
                                        if (catLower.includes('pest') || catLower.includes('insect')) return <Bug size={16} className="text-rose-500" />;
                                        if (catLower.includes('safety') || catLower.includes('hazard') || catLower.includes('haccp')) return <ShieldCheck size={16} className="text-emerald-500" />;
                                        if (catLower.includes('storage') || catLower.includes('stock') || catLower.includes('material')) return <Package size={16} className="text-amber-500" />;
                                        if (catLower.includes('food') || catLower.includes('cook') || catLower.includes('kitchen')) return <ClipboardList size={16} className="text-red-500" />;
                                        if (catLower.includes('cold') || catLower.includes('temp') || catLower.includes('freez')) return <ClipboardList size={16} className="text-cyan-500" />;
                                        if (catLower.includes('personal') || catLower.includes('health')) return <ClipboardList size={16} className="text-pink-500" />;
                                        if (catLower.includes('supplier') || catLower.includes('vendor')) return <ClipboardList size={16} className="text-lime-500" />;
                                        if (catLower.includes('outside') || catLower.includes('catering')) return <ClipboardList size={16} className="text-yellow-500" />;
                                        return <ClipboardList size={16} className="text-indigo-500" />;
                                    };
                                    return (
                                <>
                                <div className="border-t border-slate-100 bg-white p-4 md:p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h5 className="text-xs font-black text-slate-600 uppercase tracking-widest">Policy Cards</h5>
                                            <p className="text-[9px] text-slate-400 font-semibold">{policyEntries.length} policies &middot; {sortedQuestions.length} questions &middot; {totalObsInChecklist} observations</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedPolicy && (
                                                <button onClick={() => setSelectedPolicyByChecklist(prev => ({ ...prev, [checklistName]: null }))} className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
                                                    <RotateCcw size={10} /> Clear
                                                </button>
                                            )}
                                            <button onClick={() => setShowPolicyCards(prev => !prev)} className={`p-1.5 rounded-lg border transition-all ${showPolicyCards ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`} title={showPolicyCards ? 'Hide Policy Cards' : 'Show Policy Cards'}>
                                                {showPolicyCards ? <Eye size={13} /> : <EyeOff size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                    {showPolicyCards && (
                                    <div className="overflow-x-auto -mx-1 px-1 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex gap-2.5 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-w-max md:min-w-0">
                                            {policyEntries.map(([policy, pData]) => {
                                                const isSelected = selectedPolicy === policy;
                                                return (
                                                    <div key={policy} className={`min-w-[170px] md:min-w-0 rounded-xl border p-3 transition-all flex-shrink-0 cursor-pointer ${isSelected ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 shadow-md' : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-200'}`}
                                                        onClick={() => setSelectedPolicyByChecklist(prev => ({ ...prev, [checklistName]: isSelected ? null : policy }))}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 shrink-0">{getCatIcon(policy.toLowerCase())}</div>
                                                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[90px]" title={policy}>{policy}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${getComplianceColor(pData.compliance)}`}>{pData.compliance}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <div>
                                                                <div className="text-lg font-black text-slate-800">{pData.questions.length}</div>
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Questions</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-sm font-black ${pData.obsCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{pData.obsCount}</div>
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Obs</div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${getComplianceBarColor(pData.compliance)}`} style={{ width: `${pData.compliance}%` }} />
                                                        </div>
                                                        {isSelected && Object.keys(pData.subPolicies).length > 0 && (
                                                            <div className="mt-3 pt-2 border-t border-indigo-100 space-y-1.5">
                                                                <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Sub-Policies</span>
                                                                {Object.entries(pData.subPolicies).sort((a, b) => b[1].obsCount - a[1].obsCount).map(([sub, sData]) => (
                                                                    <div key={sub} className="bg-white rounded-lg border border-indigo-100 p-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[9px] font-bold text-slate-700 truncate max-w-[120px]" title={sub}>{sub}</span>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[8px] font-bold text-slate-400">{sData.questions.length}Q</span>
                                                                                <span className={`text-[8px] font-black ${sData.obsCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{sData.obsCount} obs</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    )}
                                </div>

                                {categoryEntries.length > 0 && (
                                <div className="border-t border-slate-100 bg-white p-4 md:p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <h5 className="text-xs font-black text-violet-600 uppercase tracking-widest">Category Cards</h5>
                                            <p className="text-[9px] text-slate-400 font-semibold">{categoryEntries.length} categories</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedCategory && (
                                                <button onClick={() => setSelectedCategoryByChecklist(prev => ({ ...prev, [checklistName]: null }))} className="text-[9px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1 transition-colors">
                                                    <RotateCcw size={10} /> Clear
                                                </button>
                                            )}
                                            <button onClick={() => setShowCategoryCards(prev => !prev)} className={`p-1.5 rounded-lg border transition-all ${showCategoryCards ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`} title={showCategoryCards ? 'Hide Category Cards' : 'Show Category Cards'}>
                                                {showCategoryCards ? <Eye size={13} /> : <EyeOff size={13} />}
                                            </button>
                                        </div>
                                    </div>
                                    {showCategoryCards && (
                                    <div className="overflow-x-auto -mx-1 px-1 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="flex gap-2.5 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 min-w-max md:min-w-0">
                                            {categoryEntries.map(([cat, cData]) => {
                                                const isSelected = selectedCategory === cat;
                                                return (
                                                    <div key={cat} className={`min-w-[170px] md:min-w-0 rounded-xl border p-3 transition-all flex-shrink-0 cursor-pointer ${isSelected ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200 shadow-md' : 'bg-white border-slate-100 hover:shadow-md hover:border-slate-200'}`}
                                                        onClick={() => setSelectedCategoryByChecklist(prev => ({ ...prev, [checklistName]: isSelected ? null : cat }))}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="p-1.5 rounded-lg bg-violet-50 border border-violet-100 shrink-0">{getCatIcon(cat.toLowerCase())}</div>
                                                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[90px]" title={cat}>{cat}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${getComplianceColor(cData.compliance)}`}>{cData.compliance}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <div>
                                                                <div className="text-lg font-black text-slate-800">{cData.questions.length}</div>
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Questions</div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className={`text-sm font-black ${cData.obsCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{cData.obsCount}</div>
                                                                <div className="text-[8px] font-bold text-slate-400 uppercase">Obs</div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 w-full h-1.5 bg-violet-100 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${cData.compliance >= 90 ? 'bg-emerald-500' : cData.compliance >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${cData.compliance}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    )}
                                </div>
                                )}
                                <div className="border-t border-slate-100 bg-slate-50/50 p-3 md:p-4 space-y-2.5 animate-in slide-in-from-top-2 duration-300">
                                    {(selectedPolicy || selectedCategory) && (
                                        <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
                                            {selectedPolicy && (
                                                <>
                                                    <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100">{getCatIcon(selectedPolicy.toLowerCase())}</div>
                                                    <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">{selectedPolicy}</span>
                                                </>
                                            )}
                                            {selectedPolicy && selectedCategory && <span className="text-[9px] text-slate-300 font-bold">&rsaquo;</span>}
                                            {selectedCategory && (
                                                <>
                                                    <div className="p-1.5 rounded-lg bg-violet-50 border border-violet-100">{getCatIcon(selectedCategory.toLowerCase())}</div>
                                                    <span className="text-xs font-black text-violet-700 uppercase tracking-wider">{selectedCategory}</span>
                                                </>
                                            )}
                                            <span className="text-[9px] text-slate-400 font-bold">&middot; {displayQuestions.length} questions</span>
                                        </div>
                                    )}
                                    {displayQuestions.map(stats => {
                                        const qKey = `${checklistName}::${stats.questionText}`;
                                        const isQExpanded = expandedQuestion === qKey;
                                        const hasObs = stats.obsCount > 0;

                                        return (
                                            <div key={qKey} className={`bg-white rounded-xl border overflow-hidden transition-all ${hasObs ? 'border-slate-200' : 'border-slate-100'}`}>
                                                <button onClick={() => setExpandedQuestion(isQExpanded ? null : qKey)} className="w-full flex flex-col md:flex-row md:items-center justify-between p-3 md:p-4 text-left group gap-2">
                                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                        <div className={`w-1.5 h-8 rounded-full shrink-0 mt-0.5 ${stats.obsCount === 0 ? 'bg-emerald-400' : stats.observations.some(o => o.severity === 'CRITICAL') ? 'bg-red-500' : stats.observations.some(o => o.severity === 'MAJOR') ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-xs font-bold text-slate-700 line-clamp-2">{stats.questionText}</p>
                                                                {stats.isFollowUp && <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 text-[7px] font-black uppercase"><Flag size={7} /> Follow Up</span>}
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">{stats.sectionTitle}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-4 md:ml-2 flex-wrap justify-end">
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${stats.obsCount > 0 ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                                            {stats.obsCount} obs
                                                        </span>
                                                        {stats.auditCount > 0 && (
                                                            <>
                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] font-black" title="Full Marks">
                                                                    <CheckCircle2 size={8} className="inline mr-0.5" />{stats.fullMarksCount}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 text-[8px] font-black" title="Partial Marks">
                                                                    <AlertTriangle size={8} className="inline mr-0.5" />{stats.partialMarksCount}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[8px] font-black" title="N/A">
                                                                    N/A {stats.naCount}
                                                                </span>
                                                            </>
                                                        )}
                                                        {stats.auditCount > 0 && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${getComplianceColor(stats.compliancePct)}`}>
                                                                {stats.compliancePct}%
                                                            </span>
                                                        )}
                                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isQExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </button>

                                                {isQExpanded && (
                                                    <div className="border-t border-slate-100 p-3 md:p-4 animate-in slide-in-from-top-2 duration-200">
                                                        {stats.auditCount > 0 && (
                                                            <div className="mb-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-100 p-3">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Compliance</span>
                                                                    <span className={`text-sm font-black ${stats.compliancePct >= 90 ? 'text-emerald-600' : stats.compliancePct >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                        {stats.compliancePct}%
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                                                                    <div className={`h-full rounded-full transition-all ${getComplianceBarColor(stats.compliancePct)}`} style={{ width: `${stats.compliancePct}%` }} />
                                                                </div>
                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                                                    <div className="bg-white rounded-lg border border-slate-100 p-1.5">
                                                                        <div className="text-[8px] font-bold text-slate-400 uppercase">Audits</div>
                                                                        <div className="text-sm font-black text-indigo-600">{stats.auditCount}</div>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-emerald-100 p-1.5">
                                                                        <div className="text-[8px] font-bold text-emerald-400 uppercase">Full Marks</div>
                                                                        <div className="text-sm font-black text-emerald-600">{stats.fullMarksCount}</div>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-amber-100 p-1.5">
                                                                        <div className="text-[8px] font-bold text-amber-400 uppercase">Partial</div>
                                                                        <div className="text-sm font-black text-amber-600">{stats.partialMarksCount}</div>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg border border-slate-100 p-1.5">
                                                                        <div className="text-[8px] font-bold text-slate-400 uppercase">N/A</div>
                                                                        <div className="text-sm font-black text-slate-500">{stats.naCount}</div>
                                                                    </div>
                                                                </div>
                                                                {stats.totalPossible > 0 && (
                                                                    <div className="mt-2 text-[9px] text-slate-400 font-bold text-center">
                                                                        Total: {stats.totalObtained}/{stats.totalPossible} marks obtained
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {stats.obsCount === 0 ? (
                                                            <div className="text-center py-6">
                                                                <CheckCircle2 size={28} className="text-emerald-300 mx-auto mb-2" />
                                                                <p className="text-[10px] font-bold text-slate-400">No observations recorded for this question</p>
                                                                {stats.auditCount > 0 && <p className="text-[9px] text-emerald-500 font-bold mt-1">Full compliance across {stats.auditCount} audit{stats.auditCount !== 1 ? 's' : ''}</p>}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-row overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scrollbar-thin md:grid md:grid-cols-2 xl:grid-cols-3 md:overflow-x-visible md:pb-0">
                                                                {stats.observations.map(item => (
                                                                    <div key={item.id} className="min-w-[280px] max-w-[320px] flex-shrink-0 snap-start md:min-w-0 md:max-w-none md:flex-shrink bg-gradient-to-br from-white to-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group/card">
                                                                        {item.thumbnail && (
                                                                            <div className="relative h-48 md:h-52 bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setFullscreenImage({ url: item.thumbnail, label: item.observationText || item.title })}>
                                                                                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                                                                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${getSeverityStyle(item.severity)}`}>{item.severity}</span>
                                                                                    <span className="px-1.5 py-0.5 rounded bg-slate-900/70 text-white text-[8px] font-black">{item.level}</span>
                                                                                </div>
                                                                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                                                                    <span className="px-1.5 py-0.5 bg-black/50 backdrop-blur-sm text-white rounded text-[8px] font-mono font-bold">{item.id}</span>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setFullscreenImage({ url: item.thumbnail, label: item.observationText || item.title }); }} className="p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-lg hover:bg-black/70 transition-all">
                                                                                        <Maximize2 size={12} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {!item.thumbnail && (
                                                                            <div className="px-3 pt-3 flex items-center gap-1.5">
                                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${getSeverityStyle(item.severity)}`}>{item.severity}</span>
                                                                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[8px] font-black">{item.level}</span>
                                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-mono font-bold ml-auto">{item.id}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="p-3 space-y-2">
                                                                            <h5 className="text-xs font-black text-slate-800 line-clamp-2 leading-snug">{item.observationText || item.title}</h5>
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className={`px-1.5 py-0.5 rounded border text-[8px] font-black ${getStatusStyle(item.status)}`}>{item.status.replace('_', ' ')}</span>
                                                                                {onMarkRepeat && (
                                                                                    <button onClick={(e) => { e.stopPropagation(); onMarkRepeat(item); }} className="p-1 hover:bg-orange-50 rounded-lg transition-colors" title="Mark as Repeat">
                                                                                        <RotateCcw size={11} className="text-orange-500" />
                                                                                    </button>
                                                                                )}
                                                                                {item.isRepeat && <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200 text-[7px] font-black uppercase flex items-center gap-0.5"><RotateCcw size={7} /> Repeat</span>}
                                                                                {item.sop && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-100 text-[8px] font-bold truncate max-w-[120px]">{item.sop}</span>}
                                                                            </div>
                                                                            {item.isRepeat && item.repeatTrail && item.repeatTrail.length > 0 && (
                                                                                <div className="bg-orange-50 rounded-md border border-orange-100 px-2 py-1">
                                                                                    <p className="text-[7px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-0.5"><RotateCcw size={7} /> Since {item.repeatOriginalDate}</p>
                                                                                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                                                        {item.repeatTrail.map((t, ti) => (
                                                                                            <span key={ti} className="text-[7px] font-bold text-orange-700 bg-white border border-orange-200 px-1 py-0.5 rounded">{t.date}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <div className="space-y-1 pt-1 border-t border-slate-100">
                                                                                {item.area && (
                                                                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                                                                                        <MapPin size={10} className="text-slate-400 shrink-0" />
                                                                                        <span className="font-bold truncate">{item.area}</span>
                                                                                        {item.departmentName && <><span className="text-slate-300">&middot;</span><span className="font-bold truncate">{item.departmentName}</span></>}
                                                                                    </div>
                                                                                )}
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                                                                                        <Calendar size={10} className="text-slate-400 shrink-0" />
                                                                                        <span className="font-bold">{formatDate(item.createdDate)}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                                                                        <User size={10} className="text-slate-400 shrink-0" />
                                                                                        <span className="font-bold truncate max-w-[80px]">{item.reportedBy}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                </>
                                    );
                                })()}
                        </div>
                    );
                })}
            </div>

            {checklistNames.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    {searchTerm || activeFilterCount > 0 ? (
                        <>
                            <Search size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No results matching your filters</p>
                            <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setFilters({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' }); }} className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><RotateCcw size={12} /> Clear Filters</button>
                        </>
                    ) : (
                        <>
                            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-6"><ClipboardList size={48} className="text-slate-300" /></div>
                            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest mb-2">No Checklist Data</h3>
                            <p className="text-sm text-slate-400 max-w-md">Link checklist templates to the Observation Registry and complete audits to see question-level compliance data here.</p>
                        </>
                    )}
                </div>
            )}

            {fullscreenImage && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setFullscreenImage(null)}>
                    <div className="absolute top-4 right-4 flex items-center gap-3 z-[10000]">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-[10px] font-black uppercase tracking-widest max-w-xs truncate">{fullscreenImage.label}</div>
                        <button onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }} className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10"><X size={22} strokeWidth={3} /></button>
                    </div>
                    <div className="relative w-full h-full flex items-center justify-center p-6 md:p-16" onClick={(e) => e.stopPropagation()}>
                        <img src={fullscreenImage.url} className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5" alt={fullscreenImage.label} />
                    </div>
                </div>
            )}
        </div>
    );
};

// Human-friendly hours → "45m" / "5h" / "2d 4h". Used by the Notify
// Owners modal (and mirrored on the server in the same shape so the
// WhatsApp message reads the same as the screen).
function formatDurationHours(h: number): string {
  if (!Number.isFinite(h) || h < 0) return '—';
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m}m`;
  }
  if (h < 24) return `${Math.round(h)}h`;
  const days = Math.floor(h / 24);
  const remH = Math.round(h - days * 24);
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

// 4-digit OTP-style password used by the Notify Owners blast. Uses
// crypto.getRandomValues when available (avoids Math.random bias) and
// pads with leading zeros so the recipient always sees 4 characters.
function generateOtpPassword(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(arr[0] % 10000).padStart(4, '0');
  }
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

const ObservationRegistry: React.FC<{ entities: Entity[], currentScope: HierarchyScope, userRootId?: string | null, auditTasks?: AuditTask[] }> = ({ entities, currentScope, userRootId, auditTasks: externalAuditTasks = [] }) => {
    const { addNotification } = useNotifications();
    const [observations, setObservations] = useState<ObservationItem[]>([]);
    const [auditObsTagsLocal, setAuditObsTagsLocal] = useState<Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'>>(() => {
      try { return JSON.parse(localStorage.getItem('haccp_audit_obs_tags') || '{}'); } catch { return {}; }
    });
    const [dbLoaded, setDbLoaded] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isMockDataRef = useRef(false);
    const [availableStaff, setAvailableStaff] = useState<{id: string; name: string; unit: string; department: string; ticketId: string}[]>([]);
    const [fetchedAuditTasks, setFetchedAuditTasks] = useState<AuditTask[]>([]);

    const resolvedUnitId = useMemo(() => {
      if (!userRootId) return '';
      const target = entities.find(e => e.id === userRootId);
      if (!target) return '';
      if (target.type === 'unit') return target.id;
      if (target.type === 'department') {
        const parentUnit = entities.find(e => e.id === target.parentId && e.type === 'unit');
        return parentUnit?.id || '';
      }
      return '';
    }, [entities, userRootId]);

    useEffect(() => {
      const loadObservations = async (retries = 3) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const params = new URLSearchParams({ slim: '1' });
            if (resolvedUnitId) params.set('unitId', resolvedUnitId);
            const url = `/api/observations?${params.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              isMockDataRef.current = false;
              setObservations(data && data.length > 0 ? data : []);
              setDbLoaded(true);
              return;
            }
          } catch {}
          if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
        }
        isMockDataRef.current = false;
        setObservations([]);
        setDbLoaded(true);
      };
      loadObservations();
    }, [resolvedUnitId]);

    useEffect(() => {
      const loadAuditTasks = async () => {
        try {
          const res = await fetch('/api/audit-tasks');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setFetchedAuditTasks(data);
            }
          }
        } catch {}
      };
      loadAuditTasks();
    }, []);

    useEffect(() => {
      const loadStaff = async () => {
        try {
          const res = await fetch('/api/users');
          if (res.ok) {
            const data = await res.json();
            const items = data.items || data || [];
            setAvailableStaff(items.filter((e: any) => e.Name && e.Status !== 'Inactive').map((e: any) => ({
              id: e.id,
              name: e.Name || '',
              unit: e.Unit || '',
              department: e.Department || '',
              ticketId: e.ID || '',
            })));
          }
        } catch {}
      };
      loadStaff();
    }, []);

    const combinedAuditTasks = useMemo(() => {
      const taskMap = new Map<string, AuditTask>();
      fetchedAuditTasks.forEach(t => taskMap.set(t.id, t));
      externalAuditTasks.forEach(t => taskMap.set(t.id, t));
      return Array.from(taskMap.values());
    }, [fetchedAuditTasks, externalAuditTasks]);

    const registryCorporateEntity = useMemo(() => {
      const findCorporateAncestor = (entityId: string): typeof entities[0] | undefined => {
        let curr = entities.find(e => e.id === entityId);
        while (curr) {
          if (curr.type === 'corporate') return curr;
          curr = entities.find(e => e.id === curr?.parentId);
        }
        return undefined;
      };
      if (userRootId) {
        const ancestor = findCorporateAncestor(userRootId);
        if (ancestor) return ancestor;
      }
      return entities.find(e => e.type === 'corporate');
    }, [entities, userRootId]);

    const registryCorporateHierarchyIds = useMemo(() => {
      if (!registryCorporateEntity) return [];
      const ids: string[] = [];
      const collectDescendants = (parentId: string) => {
        ids.push(parentId);
        entities.filter(e => e.parentId === parentId).forEach(child => collectDescendants(child.id));
      };
      collectDescendants(registryCorporateEntity.id);
      return ids;
    }, [entities, registryCorporateEntity]);

    const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);

    useEffect(() => {
      const loadChecklists = async () => {
        try {
          const params = new URLSearchParams();
          if (registryCorporateEntity?.id) {
            params.set('entityId', registryCorporateEntity.id);
            if (registryCorporateHierarchyIds.length > 0) {
              params.set('entityHierarchy', registryCorporateHierarchyIds.join(','));
            }
          }
          const url = `/api/audit-checklists${params.toString() ? '?' + params.toString() : ''}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            setChecklistTemplates(Array.isArray(data) ? data : []);
          }
        } catch {}
      };
      loadChecklists();
    }, [registryCorporateEntity, registryCorporateHierarchyIds]);

    const deduplicatedChecklistTemplates = useMemo(() => {
      const nonFromMcl = new Set(
        checklistTemplates
          .filter((tmpl: any) => !String(tmpl.id || '').startsWith('from-mcl-'))
          .map((tmpl: any) => String(tmpl.id || ''))
      );
      return checklistTemplates.filter((tmpl: any) => {
        const id = String(tmpl.id || '');
        if (!id.startsWith('from-mcl-')) return true;
        const baseId = id.replace(/^from-mcl-/, '');
        return !nonFromMcl.has(baseId);
      });
    }, [checklistTemplates]);

    const linkedChecklistTemplates = useMemo(() =>
      deduplicatedChecklistTemplates.filter((tmpl: any) => tmpl.observationLinked === true),
    [deduplicatedChecklistTemplates]);

    // Build oldText → newText remap (MERGE only: one old → one new, for card display)
    const questionTextRemap = useMemo<Record<string, string>>(() => {
      const remap: Record<string, string> = {};
      deduplicatedChecklistTemplates.forEach((tmpl: any) => {
        const textAliases: Record<string, string[]> = tmpl.questionTextAliases || {};
        Object.entries(textAliases).forEach(([newText, oldTexts]) => {
          // Only remap when exactly one new question replaces old ones (merge pattern)
          // For split, multiple children share the same parent → keep parent text on card
          const hasMultipleChildrenForSameParent = (oldTexts as string[]).some(oldText =>
            Object.entries(textAliases).filter(([k]) => k !== newText).some(([, v]) => (v as string[]).includes(oldText))
          );
          if (!hasMultipleChildrenForSameParent) {
            (oldTexts as string[]).forEach(oldText => {
              if (oldText && oldText !== newText) remap[oldText] = newText;
            });
          }
        });
      });
      return remap;
    }, [deduplicatedChecklistTemplates]);

    // Build newText → [oldTexts] for the checklist-view alias lookup (covers BOTH merge and split)
    const allQuestionTextAliases = useMemo<Record<string, string[]>>(() => {
      const combined: Record<string, string[]> = {};
      deduplicatedChecklistTemplates.forEach((tmpl: any) => {
        const textAliases: Record<string, string[]> = tmpl.questionTextAliases || {};
        Object.entries(textAliases).forEach(([newText, oldTexts]) => {
          if (!combined[newText]) combined[newText] = [];
          (oldTexts as string[]).forEach(t => {
            if (t && t !== newText && !combined[newText].includes(t)) combined[newText].push(t);
          });
        });
      });
      return combined;
    }, [deduplicatedChecklistTemplates]);

    const resolveQText = (text: string | undefined) =>
      text ? (questionTextRemap[text] ?? text) : text;

    const obsTargetEntity = useMemo(() => { if (!userRootId) return entities.find(e => e.type === 'corporate'); return entities.find(e => e.id === userRootId); }, [entities, userRootId]);

    const effectiveDepartmentLocations = useMemo((): Record<string, string[]> => {
      const direct = userRootId ? entities.find(e => e.id === userRootId) : undefined;
      if (direct?.departmentLocations && Object.keys(direct.departmentLocations).length > 0) return direct.departmentLocations as Record<string, string[]>;
      if (direct?.type === 'department') {
        const pu = entities.find(e => e.id === direct.parentId && e.type === 'unit');
        if (pu?.departmentLocations && Object.keys(pu.departmentLocations).length > 0) return pu.departmentLocations as Record<string, string[]>;
      }
      const isAncestor = (ancestorId: string, nodeId: string): boolean => {
        let c = entities.find(e => e.id === nodeId);
        while (c) { if (c.id === ancestorId) return true; c = c.parentId ? entities.find(e => e.id === c!.parentId) : undefined; }
        return false;
      };
      const corp = direct?.type === 'corporate' ? direct : (direct ? (() => { let c = entities.find(e => e.id === direct.parentId); while (c) { if (c.type === 'corporate') return c; c = c.parentId ? entities.find(e => e.id === c.parentId) : undefined; } return undefined; })() : null) || entities.find(e => e.type === 'corporate');
      if (!corp) return {};
      const unitsWithLocs = entities.filter(e => e.type === 'unit' && e.departmentLocations && Object.keys(e.departmentLocations).length > 0 && isAncestor(corp.id, e.id));
      if (unitsWithLocs.length === 0) return {};
      if (unitsWithLocs.length === 1) return unitsWithLocs[0].departmentLocations as Record<string, string[]>;
      const merged: Record<string, string[]> = {};
      unitsWithLocs.forEach(u => { Object.entries(u.departmentLocations || {}).forEach(([dept, locs]) => { if (!merged[dept]) merged[dept] = []; (locs as string[]).forEach(l => { if (l && !merged[dept].includes(l)) merged[dept].push(l); }); }); });
      return merged;
    }, [entities, userRootId]);

    const mergedOldIdSet = useMemo(() => {
      const old = new Set<string>();
      const sourceTemplates = linkedChecklistTemplates.length > 0 ? linkedChecklistTemplates : deduplicatedChecklistTemplates;
      sourceTemplates.forEach((tmpl: any) => {
        const idAliases: Record<string, string[]> = tmpl.questionIdAliases || {};
        Object.values(idAliases).forEach((oldIds: any) => {
          (oldIds as string[]).forEach(id => { if (id) old.add(id); });
        });
      });
      return old;
    }, [linkedChecklistTemplates, deduplicatedChecklistTemplates]);

    const mergedOldTextSet = useMemo(() => {
      const old = new Set<string>();
      const sourceTemplates = linkedChecklistTemplates.length > 0 ? linkedChecklistTemplates : deduplicatedChecklistTemplates;
      sourceTemplates.forEach((tmpl: any) => {
        const txtAliases: Record<string, string[]> = tmpl.questionTextAliases || {};
        Object.values(txtAliases).forEach((oldTexts: any) => {
          (oldTexts as string[]).forEach(t => { if (t) old.add(t.toLowerCase().trim()); });
        });
      });
      return old;
    }, [linkedChecklistTemplates, deduplicatedChecklistTemplates]);

    const mergedSurvivorIdSet = useMemo(() => {
      const ids = new Set<string>();
      const sourceTemplates = linkedChecklistTemplates.length > 0 ? linkedChecklistTemplates : deduplicatedChecklistTemplates;
      sourceTemplates.forEach((tmpl: any) => {
        const idAliases: Record<string, string[]> = tmpl.questionIdAliases || {};
        Object.keys(idAliases).forEach(survivorId => { if (survivorId) ids.add(survivorId); });
      });
      return ids;
    }, [linkedChecklistTemplates, deduplicatedChecklistTemplates]);

    const isOldMergedQ = useCallback((q: { id: string; text?: string }) => {
      if (mergedOldIdSet.has(q.id)) return true;
      if (mergedSurvivorIdSet.has(q.id)) return false;
      if (q.text && mergedOldTextSet.has(q.text.toLowerCase().trim())) return true;
      return false;
    }, [mergedOldIdSet, mergedOldTextSet, mergedSurvivorIdSet]);

    const auditQuestionsList = useMemo((): AuditQuestionOption[] => {
      const sourceTemplates = linkedChecklistTemplates.length > 0 ? linkedChecklistTemplates : checklistTemplates;
      if (sourceTemplates.length === 0) return [];
      const qs: AuditQuestionOption[] = [];
      const seen = new Set<string>();
      const deptLocs = effectiveDepartmentLocations;
      const deptLocsMap = new Map<string, { dept: string; loc: string }[]>();
      Object.entries(deptLocs).forEach(([dept, locs]) => {
        const deptLower = dept.toLowerCase().trim();
        if (!deptLocsMap.has(deptLower)) deptLocsMap.set(deptLower, []);
        (locs || []).forEach(loc => deptLocsMap.get(deptLower)!.push({ dept, loc }));
      });
      const hasLocs = deptLocsMap.size > 0;
      sourceTemplates.forEach((tmpl: any) => {
        if (!tmpl.pages) return;
        const clId = tmpl.id || tmpl.title || '';
        tmpl.pages.forEach((page: any) => {
          const pageDept = page.title || 'Page';
          const pageDeptLower = pageDept.toLowerCase().trim();
          const matchingLocs = deptLocsMap.get(pageDeptLower) || [];
          (page.sections || []).forEach((sec: any) => {
            const addQ = (q: any, secTitle: string) => {
              if (!q.id) return;
              if (isOldMergedQ(q)) return;
              let addedVirtual = false;
              if (hasLocs && matchingLocs.length > 0) {
                matchingLocs.forEach(({ dept, loc }) => {
                  const locKey = loc.replace(/\s/g, '_');
                  const virtualPrefix = `${dept.replace(/\s/g, '_')}___${locKey}`;
                  const virtualId = `${virtualPrefix}::${q.id}`;
                  if (seen.has(virtualId)) return;
                  seen.add(virtualId);
                  addedVirtual = true;
                  qs.push({
                    id: virtualId,
                    text: q.text || 'Untitled',
                    sectionTitle: secTitle,
                    pageTitle: `${virtualPrefix}::${pageDept}`,
                    responses: (q.responses || []).map((r: any) => ({ text: r.text || '', score: r.score || '0', color: r.color || 'gray' })),
                    checklistName: tmpl.title || 'Checklist',
                    responsibility: q.responsibility || [],
                    checklistId: clId,
                    department: pageDept,
                    isFollowUp: q.isFollowUp || false,
                  });
                });
              }
              if (!addedVirtual && !seen.has(q.id)) {
                seen.add(q.id);
                qs.push({
                  id: q.id,
                  text: q.text || 'Untitled',
                  sectionTitle: secTitle,
                  pageTitle: pageDept,
                  responses: (q.responses || []).map((r: any) => ({ text: r.text || '', score: r.score || '0', color: r.color || 'gray' })),
                  checklistName: tmpl.title || 'Checklist',
                  responsibility: q.responsibility || [],
                  checklistId: clId,
                  department: q.department || tmpl.department || pageDept,
                  isFollowUp: q.isFollowUp || false,
                });
              }
            };
            (sec.questions || []).forEach((q: any) => addQ(q, sec.title || 'Section'));
            (sec.subSections || []).forEach((sub: any) => {
              (sub.questions || []).forEach((q: any) => addQ(q, `${sec.title || 'Section'} > ${sub.title || 'Sub'}`));
            });
          });
        });
      });
      return qs;
    }, [linkedChecklistTemplates, checklistTemplates, effectiveDepartmentLocations, isOldMergedQ]);

    const auditObservationItems = useMemo((): ObservationItem[] => {
      if (combinedAuditTasks.length === 0) return [];
      const items: ObservationItem[] = [];
      let globalIdx = 0;
      combinedAuditTasks.forEach(task => {
        if (!task.observations || task.observations.length === 0) return;
        task.observations.forEach((obs) => {
          globalIdx++;
          const idx = globalIdx;
          const riskToSeverity = (r?: string): 'MINOR' | 'MAJOR' | 'CRITICAL' => {
            if (r === 'Critical') return 'CRITICAL';
            if (r === 'High') return 'MAJOR';
            return 'MINOR';
          };
          const riskToLevel = (r?: string): 'L1' | 'L2' | 'L3' | 'L4' => {
            if (r === 'Critical') return 'L4';
            if (r === 'High') return 'L3';
            if (r === 'Medium') return 'L2';
            return 'L1';
          };
          const completedDate = task.endTime || task.startTime || new Date().toISOString();
          const auditDateStr = (() => {
            try {
              const d = new Date(completedDate);
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yy = String(d.getFullYear()).slice(-2);
              return `${dd}${mm}${yy}`;
            } catch { return '000000'; }
          })();
          const obsId = `IA-${auditDateStr}-${idx + 1}`;
          let unitEntity = entities.find(e => e.id === task.unitId);
          if (!unitEntity && task.unitName) {
            const nameNorm = task.unitName.trim().toLowerCase();
            unitEntity = entities.find(e => e.type === 'unit' && e.name?.trim().toLowerCase() === nameNorm);
          }
          const resolvedUnitId = unitEntity?.id || task.unitId;
          const regionalEntity = unitEntity?.parentId ? entities.find(e => e.id === unitEntity!.parentId) : undefined;
          items.push({
            id: obsId,
            title: obs.comment || obs.questionText,
            questionText: obs.questionText || undefined,
            sectionTitle: obs.sectionTitle || undefined,
            checklistName: obs.checklistName || task.title || undefined,
            sop: obs.sectionTitle || obs.checklistName || task.title || 'Internal Audit',
            severity: riskToSeverity(obs.risk),
            level: riskToLevel(obs.risk),
            mainKitchen: obs.responsibility?.length ? obs.responsibility[0] : (task.department?.split('›')[0]?.trim() || task.department || 'General'),
            area: obs.location || task.assignedLocations?.[0] || obs.pageTitle || 'Audit Area',
            hierarchy: task.unitName || '',
            closureComments: obs.closureComments || null,
            status: obs.closureStatus === 'Closed' ? 'RESOLVED' : 'OPEN',
            duration: '0d',
            followUpStatus: 'NOT DONE',
            followUpCount: 0,
            followUpDate: '',
            reportedBy: task.auditorName || 'Auditor',
            lastUpdate: completedDate,
            createdDate: completedDate,
            thumbnail: obs.images?.[0] || '',
            afterImage: obs.closureEvidence?.[0] || '',
            isStarred: false,
            people: [...new Set(obs.responsibility || [])].map(r => ({ name: r, impact: 0 })),
            assets: [],
            categories: obs.category ? [{ name: obs.category, impact: 0 }] : [],
            tracking: [
              { id: 'audit-reported', label: 'Reported via Audit', user: task.auditorName || 'Auditor', timestamp: completedDate, comments: `Score: ${obs.marksObtained ?? 0}/${obs.marksMax ?? 0}. Response: ${obs.selectedResponse || 'N/A'}` }
            ],
            unitId: resolvedUnitId,
            unitName: unitEntity?.name || task.unitName,
            regionalId: regionalEntity?.id || undefined,
            regionalName: regionalEntity?.name || undefined,
            departmentId: task.department?.split('›')[0]?.trim() || task.department || undefined,
            departmentName: task.department?.split('›')[0]?.trim() || task.department || undefined,
            allEvidence: (() => { const seen = new Set<string>(); return (obs.images || []).filter((url: string) => { if (!url || seen.has(url)) return false; seen.add(url); return true; }).map((url: string, i: number) => ({ id: `ev-${i}`, url, type: 'image' })); })(),
            isAuditSourced: true,
            auditTaskId: task.id,
            auditObsQuestionId: obs.questionId || undefined,
            potentialMarkLoss: (obs.marksMax != null && obs.marksObtained != null) ? Math.max(0, (obs.marksMax || 0) - (obs.marksObtained || 0)) : undefined,
            maxMarks: obs.marksMax != null ? obs.marksMax : undefined,
            managementTag: obs.managementTag || auditObsTagsLocal[obsId] || undefined,
          });
        });
      });
      return items;
    }, [combinedAuditTasks, entities, auditObsTagsLocal]);

    const mergedObservations = useMemo(() => {
      let merged: ObservationItem[];
      if (auditObservationItems.length === 0) {
        merged = observations;
      } else {
        const existingIds = new Set(observations.map(o => o.id));
        const newAuditObs = auditObservationItems.filter(ao => !existingIds.has(ao.id));
        merged = newAuditObs.length === 0 ? observations : [...observations, ...newAuditObs];
      }
      return [...merged].sort((a, b) => {
        const dateA = new Date(a.createdDate || 0).getTime();
        const dateB = new Date(b.createdDate || 0).getTime();
        return dateB - dateA;
      });
    }, [observations, auditObservationItems]);

    const scopedStaff = useMemo(() => {
      if (!userRootId || !entities.length) return availableStaff;
      let unitName = '';
      const target = entities.find(e => e.id === userRootId);
      if (!target) return availableStaff;
      if (target.type === 'unit') { unitName = target.name?.trim() || ''; }
      else if (target.type === 'department') { const parent = entities.find(e => e.id === target.parentId && e.type === 'unit'); unitName = parent?.name?.trim() || ''; }
      else { return availableStaff; }
      if (!unitName) return availableStaff;
      const filtered = availableStaff.filter(s => s.unit.trim().toLowerCase() === unitName.toLowerCase());
      return filtered.length > 0 ? filtered : availableStaff;
    }, [availableStaff, userRootId, entities]);

    const saveObservationToDb = useCallback(async (obs: ObservationItem, retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const payload = { ...obs };
          if (attempt > 0) {
            const slim: any = { ...payload };
            delete slim.thumbnail;
            delete slim.allEvidence;
            delete slim.afterImage;
            delete slim.closureEvidence;
            Object.assign(payload, slim);
          }
          const res = await fetch('/api/observations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) return true;
          console.error(`[saveObs] Attempt ${attempt + 1} failed with status ${res.status}`);
        } catch (e) {
          console.error(`[saveObs] Attempt ${attempt + 1} network error:`, e);
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
      console.error('[saveObs] All retries exhausted for obs:', obs.id);
      return false;
    }, []);

    const saveAllObservationsToDb = useCallback(async (obs: ObservationItem[]) => {
      try {
        const res = await fetch('/api/observations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obs),
        });
        if (!res.ok) {
          console.error('[saveAllObs] Failed with status:', res.status);
          for (const o of obs) await saveObservationToDb(o);
        }
      } catch (e) {
        console.error('[saveAllObs] Network error, trying individually:', e);
        for (const o of obs) await saveObservationToDb(o);
      }
    }, [saveObservationToDb]);

    const deleteObservationFromDb = useCallback(async (id: string) => {
      try {
        await fetch('/api/observations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
      } catch (e) {
        console.error('Failed to delete observation:', e);
      }
    }, []);

    const prevObsCountRef = useRef(0);
    useEffect(() => {
      if (!dbLoaded || observations.length === 0) return;
      if (isMockDataRef.current) {
        if (prevObsCountRef.current === 0) {
          prevObsCountRef.current = observations.length;
          return;
        }
        if (observations.length === prevObsCountRef.current) return;
        isMockDataRef.current = false;
      }
      prevObsCountRef.current = observations.length;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveAllObservationsToDb(observations);
      }, 3000);
      return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
    }, [observations, dbLoaded, saveAllObservationsToDb]);
    const [activeInternalTab, setActiveInternalTab] = useState<'records' | 'analytics' | 'checklist-view' | 'drafts' | 'management-focus' | 'easy-impactful' | 'ongoing' | 'untagged' | 'dept-contacts'>('records');
    const [drillDownFilter, setDrillDownFilter] = useState<{ type: string; value: string; label: string; statusFilter?: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showFollowUpOnly, setSearchFollowUpOnly] = useState(false);
    const [showBreakdownOnly, setShowBreakdownOnly] = useState(false);
    const [activeModal, setActiveModal] = useState<'LOG' | 'DELETE' | 'CLOSURE' | 'NEW' | 'EDIT' | 'EDIT_DRAFT' | 'BREAKDOWN' | 'VERIFY_BREAKDOWN' | 'STAFF_ACK' | 'ASSIGN' | 'REOPEN' | 'BULK_UPLOAD' | 'ADVANCED_FILTER' | 'CSV_REVIEW' | null>(null);
    const [breakdownMode, setBreakdownMode] = useState<'initiate' | 'update' | 'history'>('initiate');
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
    const [draftFetchedImages, setDraftFetchedImages] = useState<string[]>([]);
    const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
    const selectedObs = useMemo(() => observations.find(o => o.id === selectedObsId) || auditObservationItems.find(o => o.id === selectedObsId), [observations, auditObservationItems, selectedObsId]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [threadFilter, setThreadFilter] = useState<string | null>(null);
    const [actionFilter, setActionFilter] = useState<string>('');
    const [viewerImage, setViewerImage] = useState<{ url: string, label: string } | null>(null);
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(INITIAL_ADV_FILTERS);
    const [stagedCsvRows, setStagedCsvRows] = useState<any[]>([]);
    const [registryLockedLocation, setRegistryLockedLocation] = useState<string | null>(() => { try { return localStorage.getItem('haccp_registry_locked_location') || null; } catch { return null; } });
    const [persistence, setPersistence] = useState({ selections: { location: [] as string[], sop: [] as string[], asset: [] as string[], staff: [] as string[], category: [] as string[], responsibility: [] as string[] }, locks: { location: false, sop: false, asset: false, staff: false, category: false, responsibility: false } });
    const usageFrequencies = useMemo(() => { const freq: Record<string, Record<string, number>> = { location: {}, sop: {}, responsibility: {}, asset: {}, staff: {}, category: {} }; observations.forEach(o => { if (o.area) freq.location[o.area] = (freq.location[o.area] || 0) + 1; if (o.sop) freq.sop[o.sop] = (freq.sop[o.sop] || 0) + 1; if (o.mainKitchen) freq.responsibility[o.mainKitchen] = (freq.responsibility[o.mainKitchen] || 0) + 1; if (o.assets) o.assets.forEach(a => freq.asset[a.name] = (freq.asset[a.name] || 0) + 1); if (o.people) o.people.forEach(p => freq.staff[p.name] = (freq.staff[p.name] || 0) + 1); if (o.categories) o.categories.forEach(c => freq.category[c.name] = (freq.category[c.name] || 0) + 1); }); return freq; }, [observations]);
    const [dashFilter, setDashboardFilter] = useState<{ category: 'sent' | 'received' | 'all', metric: string } | null>(null);
    const [closureComments, setClosureComments] = useState("");
    const [closureSignature, setClosureSignature] = useState("");
    const [breakdownForm, setBreakdownForm] = useState({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' });
    const [assetSearch, setAssetSearch] = useState("");
    const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
    const [reopenFindings, setReopenFindings] = useState("");
    const [reopenEvidence, setReopenEvidence] = useState<string | null>(null);
    const [signature, setSignature] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const excelInputRef = useRef<HTMLInputElement>(null);
    const assetDropdownRef = useRef<HTMLDivElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
    const activeHeaderDropdownRef = useRef<HTMLDivElement>(null);
    const excelDropdownRef = useRef<HTMLDivElement>(null);
    const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<string | null>(null);
    const [isExcelDropdownOpen, setIsExcelDropdownOpen] = useState(false);

    // Share link state
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareLinks, setShareLinks] = useState<any[]>([]);
    const [shareLoadingLinks, setShareLoadingLinks] = useState(false);
    const [shareResponsibility, setShareResponsibility] = useState('');
    const [sharePassword, setSharePassword] = useState('');
    const [shareLabel, setShareLabel] = useState('');
    const [shareCreating, setShareCreating] = useState(false);
    const [shareError, setShareError] = useState('');
    const [shareCopiedToken, setShareCopiedToken] = useState('');
    const [shareShowPassword, setShareShowPassword] = useState(false);

    // Notify Owners (bulk WhatsApp blast) state. Each row in
    // `notifyRows` represents one responsibility group. The admin can:
    //   - toggle the row on/off,
    //   - override the auto-picked recipient list,
    //   - set a per-row password (or use the global default),
    //   - then click Send All to fan out via /api/whatsapp/observation-summary.
    type NotifyRow = {
      responsibility: string;
      label: string;
      openCount: number;
      // Total RESOLVED observations historically attributed to this
      // responsibility. Surfaced in the WhatsApp body so recipients can
      // see their closure progress alongside the pending count.
      closedCount: number;
      sample: string[]; // top 3 obs titles for the message body
      contacts: EscalationContact[];
      enabled: boolean;
      password: string;
      selectedPhones: Set<string>; // which contacts to message
      // Two ageing metrics, scoped to *this* responsibility only:
      //   avgOpenAgeHours  = mean (now - createdDate) for currently OPEN obs
      //   avgCloseTimeHours = mean (closureDate - createdDate) for past
      //                       RESOLVED obs (apples-to-apples per dept).
      // null when there is no historical closure data yet.
      avgOpenAgeHours: number;
      avgCloseTimeHours: number | null;
    };
    const [showNotifyModal, setShowNotifyModal] = useState(false);
    const [notifyRows, setNotifyRows] = useState<NotifyRow[]>([]);
    const [notifyMode, setNotifyMode] = useState<'template' | 'text'>('template');
    // When true, send links without an access password. The recipient
    // page detects this (server returns requiresPassword:false) and
    // skips the password prompt — they tap the link and land directly
    // on their observation list.
    // Default to open-access links (no password prompt) so recipients
    // can tap the WhatsApp link and land directly on their observation
    // list without typing an OTP. Admins can still re-enable per-blast
    // password protection by un-checking "Open access" in the modal.
    const [notifyNoPassword, setNotifyNoPassword] = useState(true);
    // Two template names — server picks per recipient based on how
    // many responsibilities that recipient owns (1 → single, 2+ →
    // multi). The single template keeps the original 5-variable body
    // shape; the multi template uses the new 3-variable body with the
    // server-built status block.
    const [notifySingleTemplateName, setNotifySingleTemplateName] = useState('observation_summary_v1');
    const [notifyMultiTemplateName, setNotifyMultiTemplateName] = useState('all_observation_summary_v1');
    const [notifyMessage, setNotifyMessage] = useState(
      '⚠️ Pending Observation Alert of {responsibility}\n\nYou have {count} open food-safety observations awaiting your action.\n\nAvg open age: {avgOpenAge}\nAvg closure time (historical): {avgCloseTime}\n\nPlease review and close them here: {link}\n\nAccess password: {password}\n\nThank you',
    );
    const [notifyIncludeName, setNotifyIncludeName] = useState(true);
    const [notifySending, setNotifySending] = useState(false);
    const [notifyResult, setNotifyResult] = useState<any>(null);
    const [notifyError, setNotifyError] = useState('');

    useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (activeHeaderDropdownRef.current && !activeHeaderDropdownRef.current.contains(event.target as Node)) setActiveHeaderDropdown(null); if (excelDropdownRef.current && !excelDropdownRef.current.contains(event.target as Node)) setIsExcelDropdownOpen(false); if (assetDropdownRef.current && !assetDropdownRef.current.contains(event.target as Node)) setIsAssetDropdownOpen(false); }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
    const targetEntity = useMemo(() => { if (!userRootId) return entities.find(e => e.type === 'corporate'); return entities.find(e => e.id === userRootId); }, [entities, userRootId]);
    const equipmentNames = useMemo(() => {
      const entity = targetEntity as (typeof targetEntity & { equipment?: Equipment[] });
      return (entity?.equipment?.map((e: Equipment) => e.name).filter(Boolean) || []) as string[];
    }, [targetEntity]);
    const filteredAssets = useMemo(() => equipmentNames.filter(a => a.toLowerCase().includes(assetSearch.toLowerCase())), [assetSearch, equipmentNames]);
    const targetCorporate = registryCorporateEntity;
    const availableSops = useMemo(() => targetCorporate?.masterSops?.map(s => s.name) || [], [targetCorporate]);
    const availableDepartments = useMemo(() => { const depts = targetCorporate?.masterDepartments || []; return depts.length > 0 ? depts : []; }, [targetCorporate]);
    const availableLocations = useMemo(() => { const locs = Object.values(effectiveDepartmentLocations).flat() as string[]; return locs.filter(l => l && l.trim()); }, [effectiveDepartmentLocations]);
    const registryCombinedLocations = useMemo(() => {
      const result: string[] = [];
      Object.entries(effectiveDepartmentLocations).forEach(([dept, locs]) => {
        (locs as string[]).forEach(loc => { if (loc && loc.trim()) result.push(`${dept} \u203A ${loc}`); });
      });
      return result;
    }, [effectiveDepartmentLocations]);
    const registryDepartmentLocations = useMemo(() => effectiveDepartmentLocations, [effectiveDepartmentLocations]);
    const locationDepartmentMap = useMemo(() => {
      const map: Record<string, string> = {};
      Object.entries(effectiveDepartmentLocations).forEach(([dept, locs]) => {
        (locs as string[]).forEach(loc => { if (loc && loc.trim()) map[loc] = dept; });
      });
      return map;
    }, [effectiveDepartmentLocations]);
    const isDescendant = (ancestorId: string, potentialDescendantId: string, allEntities: Entity[]) => { let current = allEntities.find(e => e.id === potentialDescendantId); while (current) { if (current.id === ancestorId) return true; current = allEntities.find(parent => parent.id === current?.parentId); } return false; };
    const unitIdToEntityId = useMemo(() => {
      const map = new Map<string, string>();
      entities.filter(e => e.type === 'unit' && e.name).forEach(e => {
        const slug = e.name!.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '-');
        map.set(slug, e.id);
      });
      return map;
    }, [entities]);
    const resolveUnitId = useCallback((rawId: string | undefined) => {
      if (!rawId) return rawId;
      if (entities.find(e => e.id === rawId)) return rawId;
      return unitIdToEntityId.get(rawId) || rawId;
    }, [entities, unitIdToEntityId]);
    const hierarchicalFilteredReports = useMemo(() => { if (currentScope === 'super-admin') return mergedObservations; if (!userRootId) return []; return mergedObservations.filter(report => { const rUnitId = resolveUnitId(report.unitId); if (!rUnitId && !report.regionalId) return currentScope === 'corporate' || currentScope === 'regional'; if (currentScope === 'unit') return rUnitId === userRootId; if (currentScope === 'corporate' || currentScope === 'regional') { if (!rUnitId) return true; return isDescendant(userRootId, rUnitId, entities); } if (currentScope === 'department') { const deptEntity = entities.find(e => e.id === userRootId); if (!deptEntity) return false; const parentUnit = entities.find(e => e.id === deptEntity.parentId); if (!parentUnit) return false; if (rUnitId !== parentUnit.id) return false; if (!report.departmentName) return true; const rDeptBase = report.departmentName.includes('›') ? report.departmentName.split('›')[0].trim() : report.departmentName.trim(); return rDeptBase.toLowerCase() === deptEntity.name.toLowerCase(); } if (currentScope === 'user') return report.reportedByUserId === userRootId || report.reportedBy === targetEntity?.name; return false; }); }, [mergedObservations, currentScope, userRootId, entities, targetEntity, resolveUnitId]);
    const calculateStats = (items: ObservationItem[]) => { return { open: items.filter(o => o.status === 'OPEN').length, closed: items.filter(o => o.status === 'RESOLVED').length, inProgress: items.filter(o => ['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(o.status)).length, repeated: items.filter(o => !!o.parentObservationId).length, followUps: items.reduce((acc, curr) => acc + curr.followUpCount, 0), breakdowns: items.filter(o => o.breakdownDetails?.isActive).length }; };
    const dashboardStats = useMemo(() => { const sent = hierarchicalFilteredReports.filter(o => o.reportedBy === 'Staff User' || o.reportedBy === 'Chef Alex'); const received = hierarchicalFilteredReports.filter(o => o.reportedBy !== 'Staff User' && o.reportedBy !== 'Chef Alex'); return { sent: calculateStats(sent), received: calculateStats(received), all: calculateStats(hierarchicalFilteredReports) }; }, [hierarchicalFilteredReports]);
    const _searchTokens = useMemo(() => searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0), [searchTerm]);
    const filteredObservations = useMemo(() => { return hierarchicalFilteredReports.filter(o => { if (o.status === 'DRAFT') return false; const matchesSearch = _searchTokens.length === 0 || (() => { const haystack = [o.title, o.id, o.questionText, o.sectionTitle, o.checklistName, o.observationText, o.sop, o.area, o.mainKitchen, o.departmentName, o.unitName].filter(Boolean).join(' ').toLowerCase(); return _searchTokens.every(tok => haystack.includes(tok)); })(); if (!matchesSearch) return false; if (threadFilter && o.id !== threadFilter && o.parentObservationId !== threadFilter) return false; if (showFollowUpOnly && !o.isStarred) return false; if (showBreakdownOnly && !o.breakdownDetails?.isActive) return false; if (dashFilter) { const isSent = o.reportedBy === 'Staff User' || o.reportedBy === 'Chef Alex'; if (dashFilter.category === 'sent' && !isSent) return false; if (dashFilter.category === 'received' && isSent) return false; const m = dashFilter.metric; if (m === 'OPEN' && o.status !== 'OPEN') return false; if (m === 'RESOLVED' && o.status !== 'RESOLVED') return false; if (m === 'IN_PROGRESS' && !['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(o.status)) return false; if (m === 'REPEATED' && !o.parentObservationId) return false; if (m === 'FOLLOWUP' && o.followUpCount === 0) return false; if (m === 'BREAKDOWN' && !o.breakdownDetails?.isActive) return false; } if (actionFilter) { if (actionFilter === 'Needs Acknowledgment' && o.status !== 'OPEN') return false; if (actionFilter === 'Needs Resolution' && o.status !== 'IN_PROGRESS' && o.status !== 'OPEN') return false; if (actionFilter === 'Needs Verification' && o.status !== 'PENDING_VERIFICATION') return false; if (actionFilter === 'Breakdown Active' && !o.breakdownDetails?.isActive) return false; if (actionFilter === 'Needs Follow Up' && o.followUpStatus === 'COMPLIANCE') return false; if (actionFilter === 'Not Linked to Question' && !!o.questionText) return false; if (actionFilter === 'Linked to Question' && !o.questionText) return false; } if (advFilters.sops.length > 0 && !advFilters.sops.includes(o.sop)) return false; if (advFilters.severities.length > 0 && !advFilters.severities.includes(o.severity)) return false; if (advFilters.levels.length > 0 && !advFilters.levels.includes(o.level)) return false; if (advFilters.staff.length > 0 && !o.people.some(p => advFilters.staff.includes(p.name))) return false; if (advFilters.assets.length > 0 && !o.assets.some(a => advFilters.assets.includes(a.name))) return false; if (advFilters.foodCategories.length > 0 && !o.categories.some(c => advFilters.foodCategories.includes(c.name))) return false; if (advFilters.regionals.length > 0 && o.regionalName && !advFilters.regionals.includes(o.regionalName)) return false; if (advFilters.units.length > 0 && o.unitName && !advFilters.units.includes(o.unitName)) return false; if (advFilters.departments.length > 0) { const deptCandidates = [o.departmentName, o.mainKitchen].filter(Boolean) as string[]; if (deptCandidates.length === 0 || !deptCandidates.some(d => advFilters.departments.includes(d))) return false; } if (advFilters.locations.length > 0 && !advFilters.locations.includes(o.area)) return false; if (advFilters.responsibilities.length > 0) { const respCandidates: string[] = []; if (o.mainKitchen) respCandidates.push(o.mainKitchen); (o.people || []).forEach((p: any) => { if (p?.name) respCandidates.push(p.name); }); if (respCandidates.length === 0 || !respCandidates.some(r => advFilters.responsibilities.includes(r))) return false; } if (advFilters.statuses && advFilters.statuses.length > 0) { const bucket = o.status === 'PENDING' || o.status === 'PENDING_VERIFICATION' ? 'IN_PROGRESS' : o.status; if (!advFilters.statuses.includes(bucket)) return false; } const checkDate = (dateStr: string | undefined, from: string, to: string) => { if (!dateStr) return false; const d = new Date(dateStr); if (from && d < new Date(from)) return false; if (to && d > new Date(to)) return false; return true; }; if ((advFilters.createdFrom || advFilters.createdTo) && !checkDate(o.createdDate, advFilters.createdFrom, advFilters.createdTo)) return false; const someTo = advFilters.closureTo; if ((advFilters.closureFrom || advFilters.closureTo) && !checkDate(o.closureDate, advFilters.closureFrom, someTo)) return false; if ((advFilters.inProgressFrom || advFilters.inProgressTo) && !checkDate(o.inProgressDate, advFilters.inProgressFrom, advFilters.inProgressTo)) return false; if ((advFilters.generalFrom || advFilters.generalTo) && !checkDate(o.createdDate, advFilters.generalFrom, advFilters.generalTo)) return false; if (drillDownFilter) { const df = drillDownFilter; if (df.type === 'status') { if (df.value === 'OPEN' && o.status !== 'OPEN') return false; if (df.value === 'RESOLVED' && o.status !== 'RESOLVED') return false; if (df.value === 'IN_PROGRESS' && !['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(o.status)) return false; if (df.value === 'ALL') { /* no filter */ } } if (df.type === 'employee' && o.reportedBy !== df.value) return false; if (df.type === 'department' && o.departmentName !== df.value && o.mainKitchen !== df.value) return false; if (df.type === 'location' && o.area !== df.value) return false; if (df.type === 'responsibility' && o.mainKitchen !== df.value) return false; if (df.type === 'sop' && o.sop !== df.value) return false; if (df.type === 'regional' && o.regionalName !== df.value) return false; if (df.type === 'unit' && o.unitName !== df.value) return false; if (df.type === 'month') { const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const rDate = new Date(o.createdDate); const rMonthName = monthNames[rDate.getMonth()]; if (rMonthName !== df.value) return false; } if (df.statusFilter && df.statusFilter !== 'ALL') { if (df.statusFilter === 'OPEN' && o.status !== 'OPEN') return false; if (df.statusFilter === 'RESOLVED' && o.status !== 'RESOLVED') return false; if (df.statusFilter === 'IN_PROGRESS' && !['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(o.status)) return false; } } return true; }); }, [hierarchicalFilteredReports, threadFilter, _searchTokens, showFollowUpOnly, showBreakdownOnly, actionFilter, dashFilter, advFilters, drillDownFilter]);
    const totalPagesCount = Math.ceil(filteredObservations.length / rowsPerPage);
    const paginatedObservations = useMemo(() => { const start = (currentPage - 1) * rowsPerPage; return filteredObservations.slice(start, start + rowsPerPage); }, [filteredObservations, currentPage, rowsPerPage]);
    // Apply merged question text remap so cards show updated question name after merge
    const remappedPaginatedObservations = useMemo(() =>
      paginatedObservations.map(obs => ({
        ...obs,
        questionText: obs.questionText ? (questionTextRemap[obs.questionText] ?? obs.questionText) : obs.questionText
      })), [paginatedObservations, questionTextRemap]);
    const handleBulkUploadSave = async (locationStr: string, files: File[]) => { setIsProcessing(true); const newObservations: ObservationItem[] = []; const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); for (let i = 0; i < files.length; i++) { const { url } = await compressImageFile(files[i]); const id = `OBS-BULK-${Date.now()}-${i}`; newObservations.push({ id, title: `Bulk Observation - ${locationStr}`, sop: 'General Inspection', severity: 'MINOR', level: 'L1', mainKitchen: 'General', area: locationStr, hierarchy: targetEntity?.name || 'Local Unit', closureComments: null, status: 'OPEN', duration: 'Just now', followUpStatus: 'NOT DONE', followUpCount: 0, followUpDate: timestamp.split(' ')[0], reportedBy: targetEntity?.name || 'Staff User', reportedByUserId: userRootId || undefined, lastUpdate: timestamp, createdDate: now.toISOString().split('T')[0], thumbnail: url, isStarred: false, people: [], assets: [], categories: [], tracking: [{ id: `t-bulk-${id}`, label: 'Reported (Bulk)', user: targetEntity?.name || 'Staff User', timestamp, comments: 'Imported via bulk uploader.' }], unitId: observationScopeContext.unitId || undefined, unitName: observationScopeContext.unitName || undefined, regionalId: observationScopeContext.regionalId || undefined, regionalName: observationScopeContext.regionalName || undefined, departmentId: 'General', departmentName: 'General' }); } setObservations(prev => [...newObservations, ...prev]); setIsProcessing(false); setActiveModal(null); };
    const confirmDelete = () => { if (!selectedObsId) return; const obsForDel = observations.find(o => o.id === selectedObsId) || auditObservationItems.find(ao => ao.id === selectedObsId); if (obsForDel?.isAuditSourced) { setActiveModal(null); return; } setIsProcessing(true); deleteObservationFromDb(selectedObsId); setTimeout(() => { setObservations(prev => prev.filter(o => o.id !== selectedObsId)); setIsProcessing(false); setActiveModal(null); setSelectedObsId(null); }, 500); };
    const toggleBulkSelect = (id: string) => { setBulkSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
    const toggleSelectAll = () => { const pageIds = paginatedObservations.map(o => o.id); const allSelected = pageIds.every(id => bulkSelectedIds.has(id)); setBulkSelectedIds(prev => { const next = new Set(prev); if (allSelected) pageIds.forEach(id => next.delete(id)); else pageIds.forEach(id => next.add(id)); return next; }); };
    const handleBulkDelete = () => { if (bulkSelectedIds.size === 0) return; const auditIds = new Set([...bulkSelectedIds].filter(id => { const o = observations.find(o => o.id === id) || auditObservationItems.find(ao => ao.id === id); return o?.isAuditSourced; })); const deletableIds = new Set([...bulkSelectedIds].filter(id => !auditIds.has(id))); if (deletableIds.size === 0) { alert('Audit observations cannot be deleted from here. Please manage them from the audit checklist.'); return; } const skippedMsg = auditIds.size > 0 ? ` (${auditIds.size} audit observation${auditIds.size !== 1 ? 's' : ''} skipped)` : ''; if (!confirm(`Delete ${deletableIds.size} observation(s)?${skippedMsg} This cannot be undone.`)) return; setIsProcessing(true); deletableIds.forEach(id => deleteObservationFromDb(id)); setTimeout(() => { setObservations(prev => prev.filter(o => !deletableIds.has(o.id))); setBulkSelectedIds(new Set()); setIsProcessing(false); }, 500); };
    const handleSaveBreakdown = () => { if (!selectedObsId || !breakdownForm.equipment || !breakdownForm.cause) return; const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const historyEntry: BreakdownHistoryEntry = { date: breakdownForm.date, user: 'Staff Operator', action: 'Breakdown Reported', comments: `Equipment: ${breakdownForm.equipment}. Cause: ${breakdownForm.cause}.` }; ensureInState(selectedObsId, o => ({ ...o, breakdownDetails: { isActive: true, status: 'active' as const, equipment: breakdownForm.equipment, rootCause: breakdownForm.cause, totalCost: 0, history: [historyEntry] }, tracking: [...o.tracking, { id: `t-bd-${Date.now()}`, label: 'Maintenance Logged', user: 'Staff Operator', timestamp, comments: `Asset failure reported for ${breakdownForm.equipment}.` }] })); setActiveModal(null); };
    const handleBreakdownUpdate = (isResolving: boolean) => { if (!selectedObsId || !selectedObs?.breakdownDetails) return; const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const costVal = parseFloat(breakdownForm.cost) || 0; const historyEntry: BreakdownHistoryEntry = { date: breakdownForm.date, user: 'Maintenance Team', action: isResolving ? 'Breakdown Resolved (Pending Verification)' : 'Service Update', comments: breakdownForm.action, cost: costVal }; ensureInState(selectedObsId, o => ({ ...o, breakdownDetails: { ...o.breakdownDetails!, status: (isResolving ? 'pending-verification' : 'active') as 'pending-verification' | 'active', totalCost: (o.breakdownDetails?.totalCost || 0) + costVal, history: [...(o.breakdownDetails?.history || []), historyEntry] }, tracking: [...o.tracking, { id: `t-bd-upd-${Date.now()}`, label: isResolving ? 'Maintenance Finished' : 'Maintenance Update', user: 'Maintenance Team', timestamp, comments: `Action: ${breakdownForm.action}. Cost: ₹${costVal}` }] })); setActiveModal(null); };
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setReopenEvidence(compressed); }; reader.readAsDataURL(file); } };
    const handleReopenSubmit = () => { if (!selectedObsId || !selectedObs || !signature || !reopenFindings) return; const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const newObs: ObservationItem = { ...selectedObs, id: `OBS-RE-${Date.now()}`, title: `FOLLOW UP: ${selectedObs.title}`, status: 'OPEN', createdDate: now.toISOString().split('T')[0], lastUpdate: timestamp, duration: 'Just now', parentObservationId: selectedObs.id, thumbnail: reopenEvidence || selectedObs.thumbnail, reportedBy: targetEntity?.name || 'QA Auditor', reportedByUserId: userRootId || undefined, tracking: [{ id: 'tr1', label: 'Reopened / New Report', user: targetEntity?.name || 'QA Auditor', timestamp, comments: reopenFindings }], isStarred: true }; setObservations(prev => { const hasInState = prev.some(o => o.id === selectedObsId); const base = hasInState ? prev : (() => { const ao = auditObservationItems.find(a => a.id === selectedObsId); return ao ? [ao, ...prev] : prev; })(); return [newObs, ...base.map(o => o.id === selectedObsId ? { ...o, linkedObservationId: newObs.id, tracking: [...o.tracking, { id: `t-re-${Date.now()}`, label: 'Non-Compliance Recorded', user: 'QA Auditor', timestamp, comments: 'Marked as persistent issue. New report created.' }] } : o)]; }); setActiveModal(null); setReopenFindings(""); setReopenEvidence(null); setSignature(""); };
    const handleDownloadBulkSample = async () => { setIsProcessing(true); try { const workbook = new ExcelJS.Workbook(); const worksheet = workbook.addWorksheet('Bulk Import Template'); worksheet.columns = [ { header: "Observation Date", key: "date", width: 15 }, { header: "Observation Title", key: "title", width: 35 }, { header: "SOP Name", key: "sop", width: 25 }, { header: "Evidence Image", key: "evidence", width: 25 }, { header: "Location Name", key: "location", width: 25 }, { header: "Responsibility Hub", key: "responsibility", width: 25 }, { header: "Observation Notes", key: "observationText", width: 35 } ]; const headerRow = worksheet.getRow(1); headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; headerRow.alignment = { vertical: 'middle', horizontal: 'center' }; headerRow.height = 30; const sampleRows = [ { date: "2025-05-18", title: "HYGIENE DEVIATION AT PREP STATION", sop: "Hygiene Maintenance Protocol", evidence: "", location: "Prep Area", responsibility: "Main Kitchen", observationText: "Cutting board not sanitized after raw chicken prep" }, { date: "2025-05-18", title: "COLD STORAGE TEMP DEVIATION", sop: "Cold Chain Management", evidence: "", location: "Walk-in Chiller", responsibility: "Storage", observationText: "Temperature recorded at 8°C, exceeds 4°C limit" }, { date: "2025-05-19", title: "HAND WASH STATION NON-COMPLIANCE", sop: "Personal Hygiene Protocol", evidence: "", location: "Service Counter", responsibility: "Front of House", observationText: "Soap dispenser empty at main hand wash station" } ]; sampleRows.forEach(rowData => { const row = worksheet.addRow(rowData); row.height = 30; row.alignment = { vertical: 'middle', horizontal: 'left' }; }); const instructionSheet = workbook.addWorksheet('Instructions'); instructionSheet.columns = [{ header: "Column", key: "col", width: 25 }, { header: "Description", key: "desc", width: 50 }, { header: "Required", key: "req", width: 12 }]; const instrHeader = instructionSheet.getRow(1); instrHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } }; instrHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; [{ col: "Observation Date", desc: "Date in YYYY-MM-DD format", req: "Yes" }, { col: "Observation Title", desc: "Short description of the observation", req: "Yes" }, { col: "SOP Name", desc: "Related Standard Operating Procedure", req: "No" }, { col: "Evidence Image", desc: "Leave blank — assign images in the review step", req: "No" }, { col: "Location Name", desc: "Where the observation was made", req: "Yes" }, { col: "Responsibility Hub", desc: "Department or responsible area", req: "No" }, { col: "Observation Notes", desc: "Detailed notes or additional context", req: "No" }].forEach(r => instructionSheet.addRow(r)); const outBuffer = await workbook.xlsx.writeBuffer(); triggerExcelDownload(outBuffer as ArrayBuffer, `Observation_Bulk_Import_Template.xlsx`); } catch (err) { console.error("Template creation failed", err); } finally { setIsProcessing(false); } };
    const handleApplyAdvancedFilters = (filters: AdvancedFilterState) => { setAdvFilters(filters); setActiveModal(null); setCurrentPage(1); };
    const handleViewImage = (url: string, label: string) => { setViewerImage({ url, label }); };
    const ensureInState = (id: string, updater: (o: ObservationItem) => ObservationItem) => { setObservations(prev => { const idx = prev.findIndex(o => o.id === id); if (idx >= 0) return prev.map(o => o.id === id ? updater(o) : o); const auditObs = auditObservationItems.find(ao => ao.id === id); if (auditObs) return [updater(auditObs), ...prev]; return prev; }); };
    const adoptAuditObs = (id: string) => { setObservations(prev => { if (prev.some(o => o.id === id)) return prev; const auditObs = auditObservationItems.find(ao => ao.id === id); if (auditObs) return [auditObs, ...prev]; return prev; }); };
    const handleAction = (type: string, id: string) => { const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); setSelectedObsId(id); switch (type) { case 'toggle-star': ensureInState(id, o => ({ ...o, isStarred: !o.isStarred })); break; case 'set-tag:management-focus': case 'set-tag:easy-impactful': case 'set-tag:ongoing': { const tag = type.split(':')[1] as 'management-focus' | 'easy-impactful' | 'ongoing'; const existingObs = observations.find(o => o.id === id) || auditObservationItems.find(ao => ao.id === id); const newTag = existingObs?.managementTag === tag ? undefined : tag; ensureInState(id, o => ({ ...o, managementTag: o.managementTag === tag ? undefined : tag })); const isAuditObs = existingObs?.isAuditSourced || id.startsWith('IA-'); if (isAuditObs) { const taskId = existingObs?.auditTaskId; const questionId = existingObs?.auditObsQuestionId; if (taskId && questionId) { fetch('/api/audit-tasks/observation-tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, questionId, managementTag: newTag || null }) }).catch(() => {}); } setAuditObsTagsLocal(prev => { const next = { ...prev }; if (newTag) { next[id] = newTag; } else { delete next[id]; } try { localStorage.setItem('haccp_audit_obs_tags', JSON.stringify(next)); } catch {} return next; }); } else { fetch('/api/observations/tag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, managementTag: newTag || null }) }).catch(() => {}); } break; } case 'delete': { const obsForDelete = observations.find(o => o.id === id) || auditObservationItems.find(ao => ao.id === id); if (obsForDelete?.isAuditSourced) return; setActiveModal('DELETE'); break; } case 'view-log': setActiveModal('LOG'); break; case 'closure': setClosureComments(""); setClosureSignature(""); setActiveModal('CLOSURE'); break; case 'staffAck': setActiveModal('STAFF_ACK'); break; case 'assign': setActiveModal('ASSIGN'); break; case 'not-compliance': setReopenFindings(""); setReopenEvidence(null); setSignature(""); setActiveModal('REOPEN'); break; case 'edit': setActiveModal('EDIT'); break; case 'compliance': ensureInState(id, o => ({ ...o, followUpStatus: 'COMPLIANCE', lastUpdate: timestamp, tracking: [...o.tracking, { id: `t-${Date.now()}`, label: 'Marked Compliant', user: 'QA Auditor', timestamp, comments: 'Verification complete. Target achieved.' }] })); break; case 'initiate-breakdown': setBreakdownForm({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' }); setAssetSearch(""); setBreakdownMode('initiate'); setActiveModal('BREAKDOWN'); break; case 'update-breakdown': setBreakdownMode('update'); setBreakdownForm({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' }); setActiveModal('BREAKDOWN'); break; case 'verify-breakdown': setActiveModal('VERIFY_BREAKDOWN'); break; case 'view-breakdown-history': setBreakdownMode('history'); setActiveModal('BREAKDOWN'); break; case 'reject': case 'hold': { const followUpType = type === 'reject' ? 'Not Done' : type === 'hold' ? 'N/A' : 'COMPLIANCE'; ensureInState(id, o => ({ ...o, followUpStatus: followUpType, followUpCount: (o.followUpCount || 0) + 1, followUpDate: timestamp, lastUpdate: timestamp, tracking: [...o.tracking, { id: `t-${Date.now()}`, label: `Follow Up: ${followUpType}`, user: 'QA Auditor', timestamp, comments: type === 'reject' ? 'Observation persists. Re-attendance required.' : 'Marked not applicable for this cycle.' }] })); if (type === 'reject') { const target = observations.find(o => o.id === id) || auditObservationItems.find(ao => ao.id === id); if (target) { /* SILENT auto-send via WhatsApp Cloud API. Popup code preserved for the new-observation share flow. We pass multiple candidate keys because audit-sourced observations may have responsibility on different fields. */ const hierarchyParts = (target.hierarchy || '').split(/\s*[>›]\s*/).filter(Boolean); autoSendObservationViaWhatsApp([{ kind: 'followup', maxLevel: Math.min(1 + ((target.followUpCount || 0) + 1), 3) /* Option B cumulative: 1st F/U → L1+L2, 2nd+ F/U → L1+L2+L3 */, observationText: (target as any).closureComments || target.title, location: target.area, mainKitchen: target.mainKitchen, responsibility: (target as any).departmentName || target.mainKitchen || target.area || '', candidateKeys: [...hierarchyParts, target.area, target.mainKitchen, (target as any).departmentName].filter(Boolean) as string[], status: 'OPEN', severity: target.severity, sop: target.sop, reportedBy: target.reportedBy, createdDate: target.createdDate, followUpCount: (target.followUpCount || 0) + 1, imageUrl: (() => { const t = target as any; if (t.images && t.images[0]) return t.images[0]; if (t.thumbnail) return t.thumbnail; if (Array.isArray(t.allEvidence) && t.allEvidence.length) { const e = t.allEvidence[0]; return typeof e === 'string' ? e : (e?.url || undefined); } return undefined; })(), }]).then((r) => { if (r.recipients.length === 0) { addNotification({ type: 'SYSTEM', severity: 'warning', icon: 'alert', title: 'No WhatsApp recipients', message: `No Escalation Matrix or Department contact found for: ${r.triedKeys.join(', ') || 'this observation'}. Check console for available keys.` }); } else if (r.succeeded > 0) { addNotification({ type: 'SYSTEM', severity: 'info', icon: 'check', title: 'WhatsApp follow-up sent', message: `Alert sent to ${r.succeeded}/${r.attempted} recipient(s) via Cloud API.` }); } else if (r.failed > 0) { addNotification({ type: 'SYSTEM', severity: 'critical', icon: 'alert', title: 'WhatsApp send failed', message: r.errors[0] || 'See console for details.' }); } }).catch(() => {}); } } break; } default: break; } };
    const observationScopeContext = useMemo(() => {
        if (!targetEntity) return { unitId: '', unitName: '', regionalId: '', regionalName: '', departmentName: '' };
        let unitEntity: Entity | undefined;
        let regionalEntity: Entity | undefined;
        if (targetEntity.type === 'unit') { unitEntity = targetEntity; }
        else if (targetEntity.type === 'department') { unitEntity = entities.find(e => e.id === targetEntity.parentId && e.type === 'unit'); }
        else if (targetEntity.type === 'regional') { return { unitId: '', unitName: '', regionalId: targetEntity.id, regionalName: targetEntity.name || '', departmentName: '' }; }
        else if (targetEntity.type === 'corporate') { return { unitId: '', unitName: '', regionalId: '', regionalName: '', departmentName: '' }; }
        if (unitEntity) {
            regionalEntity = entities.find(e => e.id === unitEntity!.parentId && e.type === 'regional');
            if (!regionalEntity) { let curr = entities.find(e => e.id === unitEntity!.parentId); while (curr) { if (curr.type === 'regional') { regionalEntity = curr; break; } curr = entities.find(e => e.id === curr?.parentId); } }
        }
        return { unitId: unitEntity?.id || '', unitName: unitEntity?.name || '', regionalId: regionalEntity?.id || '', regionalName: regionalEntity?.name || '', departmentName: targetEntity.type === 'department' ? targetEntity.name || '' : '' };
    }, [targetEntity, entities]);

    const handleNewObservationSave = (data: any) => { 
        const now = new Date(); 
        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
        const createdDate = now.toISOString().split('T')[0]; 
        
        let evidenceUrl = data.thumbnail || '';
        
        if (data.id) {
            ensureInState(data.id, o => ({ 
                ...o, 
                title: data.title, 
                sop: data.sop, 
                mainKitchen: data.responsibility || 'General', 
                area: data.location?.area || 'Unassigned', 
                thumbnail: evidenceUrl, 
                allEvidence: data.allEvidence,
                lastUpdate: timestamp, 
                people: (data.staffInvolved || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                assets: (data.assetId || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                categories: (data.foodCategory || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                tracking: [...o.tracking, { id: `t-edit-${Date.now()}`, label: 'Updated', user: 'Staff User', timestamp, comments: 'Record updated via editor terminal.' }] 
            })); 
        } else { 
            const id = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${observations.length + 101}`; 
            const responsibilityDept = data.responsibility || 'General';
            const newObs: ObservationItem = { 
                id, 
                title: data.title, 
                sop: data.sop, 
                questionText: data.questionText || undefined,
                sectionTitle: data.sectionTitle || undefined,
                checklistName: data.checklistName || undefined,
                severity: 'MINOR', 
                level: 'L1', 
                mainKitchen: responsibilityDept, 
                area: data.location?.area || 'Unassigned', 
                hierarchy: targetEntity?.name || 'Local Unit', 
                closureComments: null, 
                status: 'OPEN', 
                duration: 'Just now', 
                followUpStatus: 'NOT DONE', 
                followUpCount: 0, 
                followUpDate: timestamp.split(' ')[0], 
                reportedBy: targetEntity?.name || 'Staff User', 
                reportedByUserId: userRootId || undefined, 
                lastUpdate: timestamp, 
                createdDate: createdDate, 
                thumbnail: evidenceUrl, 
                allEvidence: data.allEvidence,
                isStarred: false, 
                people: (data.staffInvolved || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                assets: (data.assetId || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                categories: (data.foodCategory || []).map((name: string) => ({ name: name.toUpperCase(), impact: 0 })), 
                tracking: [{ id: 't1', label: 'Reported', user: targetEntity?.name || 'Staff User', timestamp, comments: 'Incident logged via Terminal.' }],
                unitId: observationScopeContext.unitId || undefined,
                unitName: observationScopeContext.unitName || undefined,
                regionalId: observationScopeContext.regionalId || undefined,
                regionalName: observationScopeContext.regionalName || undefined,
                departmentId: responsibilityDept,
                departmentName: responsibilityDept,
            }; 
            setObservations(prev => [newObs, ...prev]);
            /* SILENT WhatsApp auto-send for NEW observations — same recipient resolution as the X-button follow-up path: Escalation Matrix + static "always-CC" rules. Uses the approved 'new_observation' template (8 vars, IMAGE header). */
            { const hierarchyParts = (newObs.hierarchy || '').split(/\s*[>›]\s*/).filter(Boolean); autoSendObservationViaWhatsApp([{ kind: 'new', maxLevel: 1 /* Option B: initial save → L1 only */, observationText: newObs.title, location: newObs.area, mainKitchen: newObs.mainKitchen, responsibility: (newObs as any).departmentName || newObs.mainKitchen || newObs.area || '', candidateKeys: [...hierarchyParts, newObs.area, newObs.mainKitchen, (newObs as any).departmentName].filter(Boolean) as string[], status: newObs.status, severity: newObs.severity, sop: newObs.sop, reportedBy: newObs.reportedBy, createdDate: newObs.createdDate, imageUrl: newObs.thumbnail || (Array.isArray((newObs as any).allEvidence) && (newObs as any).allEvidence[0] ? (typeof (newObs as any).allEvidence[0] === 'string' ? (newObs as any).allEvidence[0] : (newObs as any).allEvidence[0]?.url) : undefined), }]).then((r) => { if (r.recipients.length === 0) { addNotification({ type: 'SYSTEM', severity: 'warning', icon: 'alert', title: 'No WhatsApp recipients', message: `New observation logged but no Escalation Matrix contact matched: ${r.triedKeys.join(', ') || 'this scope'}.` }); } else if (r.succeeded > 0) { addNotification({ type: 'SYSTEM', severity: 'info', icon: 'check', title: 'WhatsApp alert sent', message: `New observation alert sent to ${r.succeeded}/${r.attempted} recipient(s).` }); } else if (r.failed > 0) { addNotification({ type: 'SYSTEM', severity: 'critical', icon: 'alert', title: 'WhatsApp send failed', message: r.errors[0] || 'See console for details.' }); } }).catch(() => {}); }
            const dept = data.responsibility || 'General';
            const deptInfo = DEPT_PERSONNEL[dept] || DEPT_PERSONNEL['General'];
            const recipients = [...deptInfo.heads, ...deptInfo.staff];
            addNotification({
                type: 'NEW_OBSERVATION',
                title: 'New Observation Reported',
                message: `"${data.title || 'New Observation'}" has been logged under ${dept} department. SOP: ${data.sop || 'General'}. Location: ${data.location?.area || 'Unassigned'}.`,
                observationId: id,
                department: dept,
                icon: 'alert',
                severity: 'warning',
                recipients,
                senderName: 'Staff User',
            });
        } 
        if (data.persistence) setPersistence(data.persistence); 
        setActiveModal(null); 
    };
    const handleCsvCommit = async (finalRows: any[]) => { setIsProcessing(true); const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const newObs: ObservationItem[] = []; for (let i = 0; i < finalRows.length; i++) { const row = finalRows[i]; let thumbnail = row.evidence || ''; if (thumbnail && thumbnail.startsWith('data:image')) { try { thumbnail = await compressImage(thumbnail, { maxSizeBytes: 100 * 1024 }); } catch { } } if (!thumbnail) thumbnail = ''; newObs.push({ id: `OBS-CSV-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, title: row.title || row.questionText || 'Untitled Observation', questionText: row.questionText || undefined, sectionTitle: row.sectionTitle || undefined, checklistName: row.checklistName || undefined, observationText: row.observationText || undefined, sop: row.sop || 'General Inspection', severity: 'MINOR', level: 'L1', mainKitchen: row.responsibility || 'General', area: row.location || 'Unassigned', hierarchy: targetEntity?.name || 'Local Unit', closureComments: null, status: 'OPEN', duration: 'Just now', followUpStatus: 'NOT DONE', followUpCount: 0, followUpDate: timestamp.split(' ')[0], reportedBy: targetEntity?.name || 'CSV Import', reportedByUserId: userRootId || undefined, lastUpdate: timestamp, createdDate: row.date || now.toISOString().split('T')[0], thumbnail, isStarred: false, people: [], assets: [], categories: [], tracking: [{ id: `t-csv-${Date.now()}-${i}`, label: 'Reported (CSV)', user: targetEntity?.name || 'System', timestamp, comments: row.observationText || 'Record imported via data sync terminal.' }], unitId: observationScopeContext.unitId || undefined, unitName: observationScopeContext.unitName || undefined, regionalId: observationScopeContext.regionalId || undefined, regionalName: observationScopeContext.regionalName || undefined, departmentId: row.responsibility || 'General', departmentName: row.responsibility || 'General' }); } newObs.forEach(ni => saveObservationToDb(ni)); setObservations(prev => [...newObs, ...prev]); setIsProcessing(false); setActiveModal(null); setStagedCsvRows([]); };
    const handleExcelBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsProcessing(true); const reader = new FileReader(); reader.onload = async (event) => { const buffer = event.target?.result as ArrayBuffer; const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer); const worksheet = workbook.getWorksheet(1); if (!worksheet) { setIsProcessing(false); return; } const images = worksheet.getImages(); const rowImageMap: Record<number, string> = {}; for (const img of images) { const col = Math.floor(img.range.tl.col); if (col === 3 || col === 4) { const rowIdx = Math.floor(img.range.tl.row); const media = (workbook.model as any).media[img.imageId]; if (media && media.buffer) { const base64 = btoa(new Uint8Array(media.buffer).reduce((data: string, byte: number) => data + String.fromCharCode(byte), '')); const rawDataUrl = `data:image/${media.extension};base64,${base64}`; try { rowImageMap[rowIdx] = await compressImage(rawDataUrl, { maxSizeBytes: 100 * 1024 }); } catch { rowImageMap[rowIdx] = rawDataUrl; } } } } const rows: any[] = []; worksheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; const isExport = row.getCell(1).value?.toString().startsWith('OBS-'); const dateVal = (isExport ? row.getCell(2).value : row.getCell(1).value)?.toString() || ""; const titleVal = (isExport ? row.getCell(4).value : row.getCell(2).value)?.toString() || ""; if (!dateVal && !titleVal) return; rows.push({ date: dateVal, title: titleVal, sop: (isExport ? row.getCell(8).value : row.getCell(3).value)?.toString() || "", evidence: rowImageMap[row.number - 1] || "", location: (isExport ? row.getCell(10).value : row.getCell(5).value)?.toString() || "", responsibility: (isExport ? row.getCell(9).value : row.getCell(6).value)?.toString() || "", observationText: (isExport ? "" : (row.getCell(7).value?.toString() || "")) }); }); setStagedCsvRows(rows); setActiveModal('CSV_REVIEW'); setIsProcessing(false); }; reader.readAsArrayBuffer(file); e.target.value = ""; };
    const triggerExcelDownload = (buffer: ArrayBuffer, fileName: string) => {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        if (isPWA || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            const w = window.open(url, '_blank');
            if (!w) {
                const a = document.createElement("a"); a.href = url; a.download = fileName; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
            } else { setTimeout(() => URL.revokeObjectURL(url), 5000); }
        } else {
            const a = document.createElement("a"); a.href = url; a.download = fileName; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
        }
    };
    const buildExcelSheet = async (workbook: InstanceType<typeof ExcelJS.Workbook>, sheetName: string, data: ObservationItem[]) => {
        const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));
        worksheet.columns = [ { header: "Report ID", key: "id", width: 15 }, { header: "Date", key: "date", width: 12 }, { header: "Question", key: "question", width: 45 }, { header: "Observation Comments", key: "title", width: 45 }, { header: "Status", key: "status", width: 15 }, { header: "Evidence (Before)", key: "evidence_before", width: 20 }, { header: "Reporter", key: "reportedBy", width: 20 }, { header: "SOP Name", key: "sop", width: 25 }, { header: "Responsibility", key: "responsibility", width: 25 }, { header: "Location", key: "area", width: 20 }, { header: "Potential Marks", key: "maxMarks", width: 16 }, { header: "Observation Category", key: "obsCategory", width: 22 }, { header: "Potential Mark Loss", key: "potentialMarkLoss", width: 18 }, { header: "Severity", key: "severity", width: 12 }, { header: "Level", key: "level", width: 10 }, { header: "Evidence (After)", key: "evidence_after", width: 20 }, { header: "Closure Note", key: "closure", width: 40 }, { header: "Management Tag", key: "managementTag", width: 18 }, { header: "Repeat", key: "isRepeat", width: 10 }, { header: "Repeat Since", key: "repeatSince", width: 14 }, { header: "Repeat Trail", key: "repeatTrail", width: 30 } ];
        const headerRow = worksheet.getRow(1); headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } as const }; headerRow.fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } as const }; headerRow.alignment = { vertical: 'middle', horizontal: 'center' }; headerRow.height = 30;
        const imgPadding = 30000; const rowH = 90; const imgW = 100; const imgH = 80;
        for (let i = 0; i < data.length; i++) {
            const obs = data[i];
            const categoryStr = obs.categories && obs.categories.length > 0 ? obs.categories.map(c => c.name).join(', ') : (obs.sectionTitle || '');
            const tagLabel = obs.managementTag === 'management-focus' ? 'Mgmt Focus' : obs.managementTag === 'easy-impactful' ? 'Easy Impact' : obs.managementTag === 'ongoing' ? 'Ongoing' : '';
            const trailStr = obs.repeatTrail && obs.repeatTrail.length > 0 ? obs.repeatTrail.map((t: any) => t.date + (t.comment ? ': ' + t.comment : '')).join(' → ') : '';
            const row = worksheet.addRow({ id: obs.id, date: obs.createdDate, title: obs.observationText || obs.title, status: obs.status, evidence_before: '', reportedBy: obs.reportedBy, sop: obs.sop, responsibility: obs.people.length > 0 ? obs.people.map(p => p.name).join(', ') : obs.mainKitchen, area: obs.area, maxMarks: obs.maxMarks != null ? obs.maxMarks : '', obsCategory: categoryStr, potentialMarkLoss: obs.potentialMarkLoss != null ? obs.potentialMarkLoss : '', severity: obs.severity, level: obs.level, evidence_after: '', question: obs.questionText || '', closure: obs.closureComments || 'N/A', managementTag: tagLabel, isRepeat: obs.isRepeat ? 'Yes' : '', repeatSince: obs.repeatOriginalDate || '', repeatTrail: trailStr });
            row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
            const excelRow = row.number - 1;
            if (obs.thumbnail) { const buffer = await fetchImage(obs.thumbnail); if (buffer) { try { const imageId = workbook.addImage({ buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { nativeCol: 5, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch (e) { console.error("Img1 error", e); } } }
            if (obs.afterImage) { const buffer = await fetchImage(obs.afterImage); if (buffer) { try { const imageId = workbook.addImage({ buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { nativeCol: 15, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch (e) { console.error("Img2 error", e); } } }
        }
        return worksheet;
    };
    const handleExportExcel = async (format: string) => { setIsProcessing(true); try { let exportData = [...filteredObservations].filter(Boolean).filter(obs => (obs.observationText || obs.title || '').trim() !== ""); if (exportData.length === 0) { alert("No records found for the current filter. Export cancelled."); setIsProcessing(false); return; } const workbook = new ExcelJS.Workbook(); const getGroupKey = (obs: ObservationItem): string => { switch (format) { case 'dept': return obs.mainKitchen || 'General'; case 'area': return obs.area || 'Unassigned'; case 'sop': return obs.sop || 'General'; case 'employee': return obs.reportedBy || 'Unknown'; case 'level': return obs.level || 'L1'; default: return 'All'; } }; if (format === 'general') { await buildExcelSheet(workbook, 'Registry Export', exportData); } else { const groups: Record<string, ObservationItem[]> = {}; exportData.forEach(obs => { const key = getGroupKey(obs); if (!groups[key]) groups[key] = []; groups[key].push(obs); }); const sortedKeys = Object.keys(groups).sort(); for (const key of sortedKeys) { await buildExcelSheet(workbook, key, groups[key]); } } const outBuffer = await workbook.xlsx.writeBuffer(); const fileName = `Registry_Export_${format}_${new Date().toISOString().split('T')[0]}.xlsx`; triggerExcelDownload(outBuffer as ArrayBuffer, fileName); } catch (err) { console.error("Export failed", err); } finally { setIsProcessing(false); setIsExcelDropdownOpen(false); } };
    const handleDashboardFilter = (category: 'sent' | 'received' | 'all', metric: string) => { if (dashFilter?.category === category && dashFilter?.metric === metric) { setDashboardFilter(null); } else { setDashboardFilter({ category, metric }); } setCurrentPage(1); };

    // Share link helpers
    const shareResponsibilities = useMemo(() => {
        const s = new Set<string>();
        mergedObservations.forEach(o => {
            const dept = o.mainKitchen || o.departmentName || o.area;
            if (dept) s.add(dept);
        });
        availableDepartments.forEach((d: string) => s.add(d));
        return [...s].sort();
    }, [mergedObservations, availableDepartments]);

    const loadShareLinks = useCallback(async () => {
        setShareLoadingLinks(true);
        try {
            // Management endpoints on /api/obs-share require admin auth
            // (mint/list/rotate/delete). The recipient-facing endpoints
            // (verify, close) still authenticate on token+password.
            const adminToken = (typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '');
            const res = await fetch('/api/obs-share?list=1', { headers: { 'x-admin-token': adminToken } });
            const data = await res.json();
            setShareLinks(data.links || []);
        } catch { setShareLinks([]); } finally { setShareLoadingLinks(false); }
    }, []);

    const handleOpenShareModal = useCallback(() => {
        setShareError('');
        setShareResponsibility('');
        setSharePassword('');
        setShareLabel('');
        setShowShareModal(true);
        loadShareLinks();
    }, [loadShareLinks]);

    const handleCreateShareLink = useCallback(async () => {
        if (!shareResponsibility || !sharePassword) { setShareError('Please select a responsibility and enter a password.'); return; }
        setShareCreating(true);
        setShareError('');
        try {
            const adminToken = (typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '');
            // Unit-scope the share link to the admin's current unit. The
            // recipient will then only see observations from this unit
            // (e.g. Rambagh Palace Engineering owner does NOT see Jai
            // Mahal Engineering observations even though both share the
            // responsibility name "Engineering"). If the admin is at a
            // corporate/regional scope when minting, unitId will be
            // empty and the link falls back to the legacy cross-unit
            // behaviour — surfaced as a warning before submission.
            const unitId = observationScopeContext.unitId || '';
            const unitName = observationScopeContext.unitName || '';
            if (!unitId) {
                const proceed = window.confirm('You are not currently scoped to a unit, so this link will return observations from EVERY unit that has this responsibility. To create a unit-scoped link, switch your view to a specific unit first. Continue with a cross-unit link?');
                if (!proceed) { setShareCreating(false); return; }
            }
            const res = await fetch('/api/obs-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    action: 'create',
                    responsibility: shareResponsibility,
                    password: sharePassword,
                    label: shareLabel || shareResponsibility,
                    unitId,
                    unitName,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setShareError(data.error || 'Failed to create link'); return; }
            setSharePassword('');
            setShareLabel('');
            setShareResponsibility('');
            await loadShareLinks();
        } catch { setShareError('Network error. Please try again.'); } finally { setShareCreating(false); }
    }, [shareResponsibility, sharePassword, shareLabel, loadShareLinks, observationScopeContext]);

    const handleDeleteShareLink = useCallback(async (token: string) => {
        try {
            const adminToken = (typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '');
            await fetch(`/api/obs-share?token=${token}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
            setShareLinks(prev => prev.filter((l: any) => l.id !== token));
        } catch { /* silent */ }
    }, []);

    const handleCopyShareLink = useCallback((token: string) => {
        const url = `${getPublicSiteUrl()}/obs-share/${token}`;
        navigator.clipboard.writeText(url).then(() => {
            setShareCopiedToken(token);
            setTimeout(() => setShareCopiedToken(''), 2500);
        }).catch(() => {
            prompt('Copy this link:', url);
        });
    }, []);

    // Notify Owners — open modal, group OPEN observations by their
    // responsibility (mainKitchen | departmentName | area), pull the
    // escalation-matrix contacts for each, and pre-tick everyone. The
    // admin can prune rows / contacts and set a password before sending.
    const handleOpenNotifyModal = useCallback(() => {
        // Two passes over mergedObservations:
        //   openBuckets   — currently OPEN, used for the row + ageing metric
        //   closedBuckets — RESOLVED with timestamps, used for avg closure
        // Buckets are keyed by lower-cased responsibility so "Hot Kitchen"
        // and "hot kitchen" merge together.
        const responsibilityOf = (o: any): string =>
            (o.mainKitchen || o.departmentName || o.area || '').trim();
        const openBuckets = new Map<string, { responsibility: string; obs: any[] }>();
        const closedDurations = new Map<string, number[]>(); // hours, per responsibility
        const now = Date.now();
        // Treat a missing/garbage date as 0 contribution (skipped) rather
        // than poisoning the average with NaN.
        const parseMs = (v: any): number | null => {
            if (!v) return null;
            const t = new Date(v).getTime();
            return Number.isFinite(t) ? t : null;
        };

        mergedObservations.forEach((o: any) => {
            const responsibility = responsibilityOf(o);
            if (!responsibility) return;
            const key = responsibility.toLowerCase();
            const status = String(o.status || 'OPEN').toUpperCase();
            if (status === 'RESOLVED') {
                const created = parseMs(o.createdDate);
                const closed = parseMs(o.closureDate || o.lastUpdate);
                if (created && closed && closed >= created) {
                    const hrs = (closed - created) / (1000 * 60 * 60);
                    if (!closedDurations.has(key)) closedDurations.set(key, []);
                    closedDurations.get(key)!.push(hrs);
                }
            } else {
                if (!openBuckets.has(key)) openBuckets.set(key, { responsibility, obs: [] });
                openBuckets.get(key)!.obs.push(o);
            }
        });

        const avg = (arr: number[]): number => arr.reduce((s, n) => s + n, 0) / Math.max(1, arr.length);

        // Build the union of every responsibility we have either OPEN or
        // RESOLVED data for. All-closed responsibilities are kept (so
        // the consolidated WhatsApp message can render the appreciation
        // line for them) but default-disabled — admin opts in only when
        // they want the "thank you" delivered alongside another
        // recipient's pending items.
        const allKeys = new Set<string>([...openBuckets.keys(), ...closedDurations.keys()]);
        const rows: NotifyRow[] = Array.from(allKeys)
            .map((key) => {
                const bucket = openBuckets.get(key);
                const responsibility = bucket?.responsibility
                    ?? key.replace(/(^|\s)\S/g, (s) => s.toUpperCase()); // best-effort label
                const obs = bucket?.obs || [];
                const contacts = getEscalationContactsForResponsibility(responsibility, 2);
                const openAges = obs
                    .map((o: any) => parseMs(o.createdDate))
                    .filter((t: number | null): t is number => t !== null && t <= now)
                    .map((t: number) => (now - t) / (1000 * 60 * 60));
                const closures = closedDurations.get(key) || [];
                const openCount = obs.length;
                return {
                    responsibility,
                    label: responsibility,
                    openCount,
                    closedCount: closures.length,
                    sample: obs.slice(0, 3).map((o: any) => (o.observationText || o.title || '').toString().slice(0, 80)).filter(Boolean),
                    contacts,
                    // Default-enable rows with open items; default-disable
                    // all-closed rows so the modal stays focused on pending
                    // work. Admin can flip the checkbox to opt the
                    // appreciation block into the consolidated message.
                    enabled: contacts.length > 0 && openCount > 0,
                    password: generateOtpPassword(),
                    selectedPhones: new Set(contacts.map(c => c.phone)),
                    avgOpenAgeHours: openAges.length > 0 ? avg(openAges) : 0,
                    avgCloseTimeHours: closures.length > 0 ? avg(closures) : null,
                };
            })
            // Sort: open-bearing rows first (by openCount desc), then
            // all-closed rows last (alphabetical) so the modal feels
            // ordered.
            .sort((a, b) => {
                if (a.openCount !== b.openCount) return b.openCount - a.openCount;
                return a.label.localeCompare(b.label);
            });
        setNotifyRows(rows);
        setNotifyResult(null);
        setNotifyError('');
        setShowNotifyModal(true);
    }, [mergedObservations]);

    const updateNotifyRow = useCallback((idx: number, patch: Partial<NotifyRow>) => {
        setNotifyRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
    }, []);

    const toggleNotifyContact = useCallback((rowIdx: number, phone: string) => {
        setNotifyRows(prev => prev.map((r, i) => {
            if (i !== rowIdx) return r;
            const next = new Set(r.selectedPhones);
            if (next.has(phone)) next.delete(phone); else next.add(phone);
            return { ...r, selectedPhones: next };
        }));
    }, []);

    const regenerateAllOtps = useCallback(() => {
        // Mints a fresh OTP for every row. Useful if the admin wants to
        // invalidate previously-shown codes (e.g. closed the modal then
        // reopened it and wants new ones for security).
        setNotifyRows(prev => prev.map(r => ({ ...r, password: generateOtpPassword() })));
    }, []);
    const regenerateRowOtp = useCallback((idx: number) => {
        setNotifyRows(prev => prev.map((r, i) => i === idx ? { ...r, password: generateOtpPassword() } : r));
    }, []);

    const handleSendNotifyBlast = useCallback(async () => {
        setNotifyError('');
        const groups = notifyRows
            .filter(r => r.enabled)
            .map(r => ({
                responsibility: r.responsibility,
                label: r.label,
                // Open-access mode: send empty password → server stores
                // a null hash and the recipient skips the prompt.
                // Otherwise: row's pre-filled OTP (with safety fallback).
                password: notifyNoPassword ? '' : (r.password.trim() || generateOtpPassword()),
                openCount: r.openCount,
                closedCount: r.closedCount,
                sample: r.sample,
                // Server uses these to format {avgOpenAge}/{avgCloseTime}
                // placeholders (text mode) and template vars {{5}}/{{6}}.
                avgOpenAgeHours: r.avgOpenAgeHours,
                avgCloseTimeHours: r.avgCloseTimeHours,
                recipients: r.contacts
                    .filter(c => r.selectedPhones.has(c.phone))
                    .map(c => ({ phone: c.phone, name: c.name })),
            }))
            // Open-access mode skips the password check; password-mode
            // requires both a password and recipients. Either way at
            // least one recipient is mandatory.
            .filter(g => (notifyNoPassword || g.password) && g.recipients.length > 0);
        if (groups.length === 0) {
            setNotifyError(notifyNoPassword ? 'Pick at least one row with at least one recipient.' : 'Pick at least one row with a password and at least one recipient.');
            return;
        }
        setNotifySending(true);
        try {
            // The admin token isn't stored anywhere obvious in this
            // component — read it the same way LmsAdmin does.
            const adminToken = (typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '');
            const res = await fetch('/api/whatsapp/observation-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    groups,
                    mode: notifyMode,
                    singleTemplateName: notifySingleTemplateName,
                    multiTemplateName: notifyMultiTemplateName,
                    languageCode: 'en',
                    includeRecipientName: notifyIncludeName,
                    nameFallback: 'there',
                    messageTemplate: notifyMessage,
                    // Header variable {{1}} for the observation_summary_v1
                    // template — "Pending Observation Alert of <Unit Name>".
                    // Falls back to the corporate-/regional-level entity name
                    // when the user is scoped above unit, then to a generic
                    // "All Units" label so Meta never receives an empty var.
                    unitName: (
                        observationScopeContext.unitName
                        || observationScopeContext.regionalName
                        || targetEntity?.name
                        || 'All Units'
                    ),
                    // Unit-scope every minted token so recipients only see
                    // observations from the unit this blast was sent from.
                    // Empty string at corporate/regional scope keeps the
                    // legacy cross-unit behaviour (intentional).
                    scopeUnitId: observationScopeContext.unitId || '',
                    scopeUnitName: observationScopeContext.unitName || '',
                    baseUrl: getPublicSiteUrl(),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setNotifyError(data?.error || 'Failed to send. Make sure you are signed in as admin.');
                return;
            }
            setNotifyResult(data);
            // Refresh the share-links cache too — tokens were rotated.
            loadShareLinks();
            const sent = data?.totals?.sent || 0;
            const failed = data?.totals?.failed || 0;
            addNotification({
                type: 'SYSTEM',
                severity: failed > 0 ? 'warning' : 'info',
                icon: 'check',
                title: failed > 0 ? 'Notify Owners — partial' : 'Notify Owners sent',
                message: `${sent} message(s) delivered${failed > 0 ? `, ${failed} failed` : ''} across ${data?.totals?.groupCount || 0} responsibility group(s).`,
            });
        } catch {
            setNotifyError('Network error. Please try again.');
        } finally {
            setNotifySending(false);
        }
    }, [notifyRows, notifyMode, notifySingleTemplateName, notifyMultiTemplateName, notifyIncludeName, notifyMessage, notifyNoPassword, loadShareLinks, addNotification]);


    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700 text-left px-4 md:px-0 relative min-h-[80vh]">
            <div className="flex justify-center mb-4">
                <div className="flex overflow-x-auto hide-scrollbar bg-slate-100 p-1 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner gap-0.5 max-w-full">
                    <button onClick={() => setActiveInternalTab('records')} className={`shrink-0 px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-widest transition-all flex items-center gap-1.5 ${activeInternalTab === 'records' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}><List size={14}/> Records</button>
                    <button onClick={() => setActiveInternalTab('analytics')} className={`shrink-0 px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-widest transition-all flex items-center gap-1.5 ${activeInternalTab === 'analytics' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}><BarChart3 size={14}/> Analytics</button>
                    <button onClick={() => setActiveInternalTab('checklist-view')} className={`shrink-0 px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-widest transition-all flex items-center gap-1.5 ${activeInternalTab === 'checklist-view' ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}><ClipboardList size={14}/> Checklist</button>
                    <button onClick={() => setActiveInternalTab('drafts')} className={`relative shrink-0 px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-widest transition-all flex items-center gap-1.5 ${activeInternalTab === 'drafts' ? 'bg-white text-violet-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}>
                      <FileEdit size={14}/> Drafts
                      {(() => { const cnt = observations.filter(o => o.status === 'DRAFT').length; return cnt > 0 ? <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full text-[7px] font-black text-white flex items-center justify-center leading-none">{cnt}</span> : null; })()}
                    </button>
                    <div className="w-px bg-slate-200 mx-1 shrink-0 self-stretch" />
                    <button onClick={() => setActiveInternalTab('management-focus')} className={`shrink-0 px-3 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeInternalTab === 'management-focus' ? 'bg-white text-red-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-red-500'}`}>🔴 <span className="hidden sm:inline">Mgmt Focus</span><span className="sm:hidden">Mgmt</span> <span className="ml-0.5 text-[8px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded">{mergedObservations.filter(o => o.managementTag === 'management-focus').length}</span></button>
                    <button onClick={() => setActiveInternalTab('easy-impactful')} className={`shrink-0 px-3 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeInternalTab === 'easy-impactful' ? 'bg-white text-emerald-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-emerald-500'}`}>🟢 <span className="hidden sm:inline">Easy Impact</span><span className="sm:hidden">Easy</span> <span className="ml-0.5 text-[8px] font-black bg-emerald-100 text-emerald-600 px-1 py-0.5 rounded">{mergedObservations.filter(o => o.managementTag === 'easy-impactful').length}</span></button>
                    <button onClick={() => setActiveInternalTab('ongoing')} className={`shrink-0 px-3 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeInternalTab === 'ongoing' ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-blue-500'}`}>🔵 Ongoing <span className="ml-0.5 text-[8px] font-black bg-blue-100 text-blue-600 px-1 py-0.5 rounded">{mergedObservations.filter(o => o.managementTag === 'ongoing').length}</span></button>
                    <button onClick={() => setActiveInternalTab('untagged')} className={`shrink-0 px-3 md:px-5 py-2.5 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeInternalTab === 'untagged' ? 'bg-white text-slate-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}>⬜ Untagged <span className="ml-0.5 text-[8px] font-black bg-slate-200 text-slate-600 px-1 py-0.5 rounded">{mergedObservations.filter(o => !o.managementTag).length}</span></button>
                </div>
            </div>

            {activeInternalTab === 'records' ? (
                <>
                    {drillDownFilter && (
                        <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl px-4 py-3 mb-2 animate-in slide-in-from-top-3 duration-300">
                            <button onClick={() => { setDrillDownFilter(null); setActiveInternalTab('analytics'); }} className="p-2 bg-white rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"><ArrowLeft size={16} /></button>
                            <div className="flex-1 min-w-0">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Analytics Drill-Down</span>
                                <p className="text-sm font-black text-indigo-700 truncate">{drillDownFilter.label}</p>
                            </div>
                            <span className="text-xs font-black text-indigo-500 bg-white px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm">{filteredObservations.length} records</span>
                            <button onClick={() => setDrillDownFilter(null)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><X size={14} /></button>
                        </div>
                    )}
                    {/* Mobile Tools Bar - visible only on small screens */}
                    <div className="lg:hidden bg-white p-3 rounded-2xl border border-slate-100 shadow-lg relative overflow-visible z-20 mb-3">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 rounded-l-2xl" />
                        <div className="flex items-center gap-2 mb-2.5 pl-2">
                            <div className="relative group flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} /><input type="text" placeholder="Search records..." className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border-2 border-slate-50 rounded-xl text-[10px] font-black uppercase focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div>
                        </div>
                        <div className="flex items-center gap-1.5 pl-2 flex-wrap">
                            <div className="relative flex-1 min-w-[120px] max-w-[180px]" ref={activeHeaderDropdownRef}><button onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'actions' ? null : 'actions')} className={`w-full flex items-center justify-between px-2.5 py-2 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-sm ${actionFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'}`}><div className="flex items-center gap-1.5 truncate"><Zap className={`w-3 h-3 shrink-0 ${actionFilter ? 'fill-white text-white' : 'text-indigo-400'}`} /> <span className="truncate">{actionFilter ? actionFilter.split(' ')[0] : 'Quick Filter'}</span></div><ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${activeHeaderDropdown === 'actions' ? 'rotate-180' : ''}`} /></button>{activeHeaderDropdown === 'actions' && (<div className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1"> {[{ label: 'Needs Acknowledgment', icon: AlertOctagon, color: 'text-red-500' }, { label: 'Needs Resolution', icon: RefreshCw, color: 'text-blue-500' }, { label: 'Needs Verification', icon: ShieldCheck, color: 'text-yellow-600' }, { label: 'Needs Follow Up', icon: History, color: 'text-orange-500' }, { label: 'Breakdown Active', icon: Wrench, color: 'text-slate-700' }, { label: 'Repeat Problem', icon: GitCommit, color: 'text-purple-500' }, { label: 'Not Linked to Question', icon: Link2Off, color: 'text-amber-600' }, { label: 'Linked to Question', icon: Link2, color: 'text-emerald-600' }].map(item => (<button key={item.label} onClick={() => { setActionFilter(actionFilter === item.label ? '' : item.label); setActiveHeaderDropdown(null); }} className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${actionFilter === item.label ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><span>{item.label}</span></button>))} {actionFilter && (<button onClick={() => { setActionFilter(''); setActiveHeaderDropdown(null); }} className="w-full text-center py-2 text-[10px] font-black uppercase text-red-500 border-t border-slate-100 mt-1 hover:bg-red-50">Clear Action Filter</button>)}</div>)}</div>
                            <div className="flex gap-1 shrink-0 relative" ref={excelDropdownRef}><input type="file" ref={excelInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelBulkImport} /><button onClick={() => excelInputRef.current?.click()} className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all shadow-sm active:scale-90" title="Import from Excel"><FileUp size={16} strokeWidth={2.5} /></button><button onClick={() => setIsExcelDropdownOpen(!isExcelDropdownOpen)} className="p-2 bg-emerald-600 text-white rounded-lg transition-all shadow-lg hover:bg-emerald-700 active:scale-95" title="Export Excel"><FileSpreadsheet size={16} /></button>{isExcelDropdownOpen && (<div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 p-1"><div className="p-1 space-y-0.5">{['general', 'dept', 'area', 'sop', 'employee', 'level'].map((m) => (<button key={m} onClick={() => handleExportExcel(m as any)} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">{m} wise format</button>))} <button onClick={handleDownloadBulkSample} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors border-t border-slate-100 mt-1 flex items-center gap-2"><FileDown size={12} /> Download Sample</button></div></div>)}</div>
                            <button onClick={() => setActiveModal('BULK_UPLOAD')} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 transition-all shadow-sm active:scale-90 shrink-0" title="Bulk Evidence Upload"><Upload size={16} /></button>
                            <button onClick={() => setActiveModal('ADVANCED_FILTER')} className={`p-2 rounded-lg border transition-all shadow-sm active:scale-90 shrink-0 ${JSON.stringify(advFilters) !== JSON.stringify(INITIAL_ADV_FILTERS) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600'}`} title="Advanced Global Filter"><SlidersHorizontal size={16} /></button>
                            <button onClick={() => { setSearchTerm(''); setDashboardFilter(null); setActionFilter(''); setAdvFilters(INITIAL_ADV_FILTERS); }} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:text-rose-600 transition-all active:scale-90 shadow-inner shrink-0" title="Reset Filters"><RefreshCw size={16} /></button>
                            <button onClick={handleOpenShareModal} className="p-2 bg-violet-50 border border-violet-100 text-violet-600 rounded-lg hover:bg-violet-100 transition-all shadow-sm active:scale-90 shrink-0" title="Share Registry Link"><Share2 size={16} /></button>
                            <button onClick={handleOpenNotifyModal} className="p-2 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg hover:bg-amber-100 transition-all shadow-sm active:scale-90 shrink-0" title="Notify Responsibility Owners (WhatsApp)"><Megaphone size={16} /></button>
                        </div>
                    </div>

                    <div className="flex overflow-x-auto snap-x hide-scrollbar gap-4 pb-2 lg:grid lg:grid-cols-12 lg:overflow-visible items-stretch">
                        <StatusConsolidatedCard title="Open Registry" metric="OPEN" icon={AlertCircle} iconBg="bg-rose-500" stats={dashboardStats} activeCategory={dashFilter?.category || null} activeMetric={dashFilter?.metric || null} onFilterClick={handleDashboardFilter} />
                        <StatusConsolidatedCard title="Closed Registry" metric="RESOLVED" icon={CheckCircle2} iconBg="bg-emerald-500" stats={dashboardStats} activeCategory={dashFilter?.category || null} activeMetric={dashFilter?.metric || null} onFilterClick={handleDashboardFilter} />
                        <StatusConsolidatedCard title="Work In Progress" metric="IN_PROGRESS" icon={RefreshCw} iconBg="bg-blue-500" stats={dashboardStats} activeCategory={dashFilter?.category || null} activeMetric={dashFilter?.metric || null} onFilterClick={handleDashboardFilter} />
                        <div className="hidden lg:flex lg:col-span-3 bg-white p-4 lg:p-6 rounded-2xl lg:rounded-[2.5rem] border border-slate-100 shadow-xl flex-col justify-between gap-3 lg:gap-6 relative overflow-visible z-20 shrink-0 snap-center min-w-[280px] md:min-w-0 text-left">
                            <div className="absolute top-0 left-0 w-1.5 lg:w-2 h-full bg-indigo-600 rounded-l-2xl lg:rounded-l-[2.5rem]" />
                            <div className="flex items-center gap-1.5 flex-nowrap">
                                <div className="relative flex-1 min-w-0" ref={activeHeaderDropdownRef}><button onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'actions' ? null : 'actions')} className={`w-full flex items-center justify-between px-2.5 py-2 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-sm ${actionFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50'}`}><div className="flex items-center gap-1.5 truncate"><Zap className={`w-3 h-3 shrink-0 ${actionFilter ? 'fill-white text-white' : 'text-indigo-400'}`} /> <span className="truncate">{actionFilter ? actionFilter.split(' ')[0] : 'Quick Filter'}</span></div><ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${activeHeaderDropdown === 'actions' ? 'rotate-180' : ''}`} /></button>{activeHeaderDropdown === 'actions' && (<div className="absolute top-full left-0 mt-2 w-full min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-1"> {[{ label: 'Needs Acknowledgment', icon: AlertOctagon, color: 'text-red-500' }, { label: 'Needs Resolution', icon: RefreshCw, color: 'text-blue-500' }, { label: 'Needs Verification', icon: ShieldCheck, color: 'text-yellow-600' }, { label: 'Needs Follow Up', icon: History, color: 'text-orange-500' }, { label: 'Breakdown Active', icon: Wrench, color: 'text-slate-700' }, { label: 'Repeat Problem', icon: GitCommit, color: 'text-purple-500' }, { label: 'Not Linked to Question', icon: Link2Off, color: 'text-amber-600' }, { label: 'Linked to Question', icon: Link2, color: 'text-emerald-600' }].map(item => (<button key={item.label} onClick={() => { setActionFilter(actionFilter === item.label ? '' : item.label); setActiveHeaderDropdown(null); }} className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${actionFilter === item.label ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><span>{item.label}</span></button>))} {actionFilter && (<button onClick={() => { setActionFilter(''); setActiveHeaderDropdown(null); }} className="w-full text-center py-2 text-[10px] font-black uppercase text-red-500 border-t border-slate-100 mt-1 hover:bg-red-50">Clear Action Filter</button>)}</div>)}</div>
                                <button onClick={() => setActiveModal('BULK_UPLOAD')} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 transition-all shadow-sm active:scale-90 shrink-0" title="Bulk Evidence Upload"><Upload size={16} /></button>
                                <button onClick={() => setActiveModal('ADVANCED_FILTER')} className={`p-2 rounded-lg border transition-all shadow-sm active:scale-90 shrink-0 ${JSON.stringify(advFilters) !== JSON.stringify(INITIAL_ADV_FILTERS) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600'}`} title="Advanced Global Filter"><SlidersHorizontal size={16} /></button>
                                <button onClick={handleOpenShareModal} className="p-2 bg-violet-50 border border-violet-100 text-violet-600 rounded-lg hover:bg-violet-100 transition-all shadow-sm active:scale-90 shrink-0" title="Share Registry Link"><Share2 size={16} /></button>
                                <button onClick={handleOpenNotifyModal} className="p-2 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg hover:bg-amber-100 transition-all shadow-sm active:scale-90 shrink-0" title="Notify Responsibility Owners (WhatsApp)"><Megaphone size={16} /></button>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="flex gap-1 shrink-0 relative" ref={excelDropdownRef}><input type="file" ref={excelInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelBulkImport} /><button onClick={() => excelInputRef.current?.click()} className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all shadow-sm active:scale-90" title="Import from Excel"><FileUp size={16} strokeWidth={2.5} /></button><button onClick={() => setIsExcelDropdownOpen(!isExcelDropdownOpen)} className="p-2 bg-emerald-600 text-white rounded-lg transition-all shadow-lg hover:bg-emerald-700 active:scale-95" title="Export Excel"><FileSpreadsheet size={16} /></button>{isExcelDropdownOpen && (<div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 p-1"><div className="p-1 space-y-0.5">{['general', 'dept', 'area', 'sop', 'employee', 'level'].map((m) => (<button key={m} onClick={() => handleExportExcel(m as any)} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">{m} wise format</button>))} <button onClick={handleDownloadBulkSample} className="w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors border-t border-slate-100 mt-1 flex items-center gap-2"><FileDown size={12} /> Download Sample</button></div></div>)}</div>
                                <button onClick={() => { setSearchTerm(''); setDashboardFilter(null); setActionFilter(''); setAdvFilters(INITIAL_ADV_FILTERS); }} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:text-rose-600 transition-all active:scale-90 shadow-inner shrink-0" title="Reset Filters"><RefreshCw size={16} /></button>
                            </div>
                            <div className="flex items-center gap-2"><div className="relative group flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={14} /><input type="text" placeholder="Universal Record Search..." className="w-full pl-8 pr-3 py-2 bg-slate-50 border-2 border-slate-50 rounded-lg text-[9px] font-black uppercase focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div><button onClick={() => setActiveModal('NEW')} className="hidden md:flex px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest items-center justify-center gap-1.5 shadow-xl hover:bg-indigo-600 active:scale-95"><Plus size={13} strokeWidth={3} /> Add</button></div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 w-full">
                        {paginatedObservations.length > 0 && (
                        <div className="flex items-center gap-3 px-2 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input type="checkbox" checked={paginatedObservations.length > 0 && paginatedObservations.every(o => bulkSelectedIds.has(o.id))} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select All</span>
                            </label>
                            {bulkSelectedIds.size > 0 && (
                                <>
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{bulkSelectedIds.size} selected</span>
                                    <button onClick={handleBulkDelete} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 active:scale-95 transition-all shadow-md"><Trash2 size={12} /> Delete Selected</button>
                                </>
                            )}
                        </div>
                        )}
                        <div className="hidden lg:block w-full"><div className="flex flex-col gap-4 w-full">{remappedPaginatedObservations.map((obs) => (<ObservationCard key={obs.id} obs={obs} onAction={handleAction} onFilterThread={setThreadFilter} onViewImage={handleViewImage} isSelected={bulkSelectedIds.has(obs.id)} onToggleSelect={() => toggleBulkSelect(obs.id)} />))}</div></div>
                        <div className="lg:hidden space-y-3 px-1">{remappedPaginatedObservations.map((obs) => (<MobileObservationCard key={obs.id} obs={obs} onAction={handleAction} onSelect={(id) => handleAction('view-log', id)} isExpanded={expandedCardId === obs.id} onToggleExpand={() => setExpandedCardId(prev => prev === obs.id ? null : obs.id)} onViewImage={handleViewImage} onFilterThread={setThreadFilter} isSelected={bulkSelectedIds.has(obs.id)} onToggleSelect={() => toggleBulkSelect(obs.id)} />))}</div>
                        {paginatedObservations.length === 0 && (<div className="py-40 flex flex-col items-center justify-center text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-200 shadow-inner"><Activity size={64} className="text-slate-100 mb-6 opacity-20" /><h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Zero Index Matches</h3><p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-sm:leading-relaxed text-center px-4">Adjust your organization node filter or search parameters.</p></div>)}
                    </div>

                    <button onClick={() => setActiveModal('NEW')} className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-20 w-14 h-14 bg-violet-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 hover:bg-violet-700 transition-all z-[60] border-4 border-white" title="Record New Observation"><Plus className="w-7 h-7" strokeWidth={3} /></button>

                    {/* Floating Global Filter FAB — companion to the Add FAB.
                        Placed so the two never overlap: on mobile the Add
                        button is centred (left-1/2) and this one anchors to
                        the right edge; on sm+ the Add sits at right-20 and
                        this one moves further left (right-40) to leave a
                        clean gap. Indigo-tinted when filters are active so
                        the user can spot at a glance whether any are on. */}
                    {(() => {
                        const filterActive = JSON.stringify(advFilters) !== JSON.stringify(INITIAL_ADV_FILTERS);
                        const activeCount = advFilters.departments.length + advFilters.locations.length + advFilters.responsibilities.length + advFilters.statuses.length + advFilters.severities.length + (advFilters.sops[0] ? 1 : 0);
                        return (
                            <button
                                onClick={() => setActiveModal('ADVANCED_FILTER')}
                                title="Open Global Registry Filter"
                                className={`fixed bottom-6 right-6 sm:right-40 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-[60] border-4 border-white ${filterActive ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 border-slate-200'}`}
                            >
                                <SlidersHorizontal className="w-6 h-6" strokeWidth={2.5} />
                                {activeCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">{activeCount}</span>
                                )}
                            </button>
                        );
                    })()}
                    
                    <UnifiedPagination
                        currentPage={currentPage}
                        totalPages={totalPagesCount}
                        totalItems={filteredObservations.length}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setCurrentPage}
                        onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
                    />
                </>
            ) : activeInternalTab === 'analytics' ? (
                <div className="animate-in fade-in duration-500">
                    <ObservationAnalytics data={filteredObservations} currentScope={currentScope} onDrillDown={(filter) => { setDrillDownFilter(filter); setActiveInternalTab('records'); setCurrentPage(1); }} />
                </div>
            ) : activeInternalTab === 'checklist-view' ? (
                <ChecklistObservationView data={filteredObservations} auditQuestions={auditQuestionsList} auditTasks={combinedAuditTasks} onViewImage={handleViewImage} questionTextRemap={questionTextRemap} questionTextAliases={allQuestionTextAliases} />
            ) : activeInternalTab === 'drafts' ? (
                /* Drafts Tab */
                <div className="animate-in fade-in duration-300">
                    {(() => {
                        const draftItems = observations.filter(o => o.status === 'DRAFT');
                        if (draftItems.length === 0) return (
                            <div className="py-40 flex flex-col items-center justify-center text-center bg-white rounded-[4rem] border-2 border-dashed border-violet-100 shadow-inner">
                                <FileEdit size={64} className="text-violet-100 mb-6" />
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">No Drafts Saved</h3>
                                <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest">Use "Save as Draft" in the observation form to save work in progress.</p>
                                <button onClick={() => setActiveModal('NEW')} className="mt-8 px-6 py-3 bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-2"><Plus size={14} strokeWidth={3}/> New Observation</button>
                            </div>
                        );
                        return (
                            <>
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl"><FileEdit size={18} strokeWidth={2.5} /></div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Draft Observations</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{draftItems.length} unsent record{draftItems.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={async () => {
                                            for (const d of draftItems) {
                                                const promoted = { ...d, status: 'OPEN' as const };
                                                setObservations(prev => prev.map(o => o.id === d.id ? promoted : o));
                                                await saveObservationToDb(promoted);
                                            }
                                        }} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5" title="Submit all drafts"><Send size={12} strokeWidth={3}/> Submit All</button>
                                        <button onClick={async () => {
                                            try {
                                                const workbook = new ExcelJS.Workbook();
                                                await buildExcelSheet(workbook, 'Draft Observations', draftItems);
                                                const outBuffer = await workbook.xlsx.writeBuffer();
                                                triggerExcelDownload(outBuffer as ArrayBuffer, `Draft_Observations_${new Date().toISOString().split('T')[0]}.xlsx`);
                                            } catch (err) { console.error('Draft export failed', err); }
                                        }} className="p-2 bg-emerald-600 text-white rounded-xl shadow hover:bg-emerald-700 active:scale-95 transition-all" title="Export Drafts to Excel"><FileSpreadsheet size={14} /></button>
                                        <button onClick={() => setActiveModal('NEW')} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-1.5"><Plus size={12} strokeWidth={3}/> Add</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                                    {draftItems.map(draft => (
                                        <div key={draft.id} className="group relative bg-white rounded-2xl border border-violet-100 shadow-md overflow-hidden flex flex-col hover:border-violet-300 hover:shadow-lg transition-all duration-200">
                                            {/* Image */}
                                            <div className="relative aspect-square bg-slate-100 overflow-hidden">
                                                {draft.thumbnail ? (
                                                    <img src={draft.thumbnail} alt="Draft evidence" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                        <ImageIcon size={28} className="text-slate-200" />
                                                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">No Image</p>
                                                    </div>
                                                )}
                                                {/* Draft badge */}
                                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-violet-600 text-white rounded-full text-[7px] font-black uppercase tracking-widest shadow-md">Draft</div>
                                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch(`/api/observations?withImages=${encodeURIComponent(draft.id)}`);
                                                                const data = res.ok ? await res.json() : null;
                                                                const imgs: string[] = [];
                                                                if (data?.allEvidence) {
                                                                    for (const e of data.allEvidence) {
                                                                        if (typeof e === 'string' && e) imgs.push(e);
                                                                        else if (e && e.url) imgs.push(e.url);
                                                                    }
                                                                }
                                                                if (!imgs.length && data?.thumbnail) imgs.push(data.thumbnail);
                                                                setDraftFetchedImages(imgs);
                                                            } catch { setDraftFetchedImages([]); }
                                                            setEditingDraftId(draft.id);
                                                            setActiveModal('EDIT_DRAFT');
                                                        }}
                                                        className="p-1.5 bg-white/90 rounded-full text-violet-600 hover:bg-violet-50 shadow active:scale-90"
                                                        title="Edit draft"
                                                    ><Edit3 size={12} strokeWidth={3} /></button>
                                                    <button
                                                        onClick={() => { setObservations(prev => prev.filter(o => o.id !== draft.id)); deleteObservationFromDb(draft.id); }}
                                                        className="p-1.5 bg-white/90 rounded-full text-rose-500 hover:bg-rose-50 shadow active:scale-90"
                                                        title="Delete draft"
                                                    ><X size={12} strokeWidth={3} /></button>
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div className="p-2.5 flex flex-col gap-1.5 flex-1 overflow-hidden">
                                                <p className="text-[9px] font-black text-slate-800 uppercase leading-tight line-clamp-2">{draft.title || draft.questionText || 'Draft Observation'}</p>
                                                <div className="flex flex-col gap-1">
                                                    {draft.area && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">Location:</span><span className="truncate text-slate-700">{draft.area}</span></div>}
                                                    {draft.departmentName && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">Dept:</span><span className="truncate text-slate-700">{draft.departmentName}</span></div>}
                                                    {draft.unitName && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">Unit:</span><span className="truncate text-slate-700">{draft.unitName}</span></div>}
                                                    {draft.regionalName && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">Region:</span><span className="truncate text-slate-700">{draft.regionalName}</span></div>}
                                                    {draft.checklistName && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">List:</span><span className="truncate text-slate-700">{draft.checklistName}</span></div>}
                                                    {draft.sectionTitle && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">Section:</span><span className="truncate text-slate-700">{draft.sectionTitle}</span></div>}
                                                    {draft.sop && <div className="text-[7px] font-bold text-slate-600 flex items-start gap-1"><span className="font-black text-slate-400 shrink-0 w-12">SOP:</span><span className="truncate text-slate-700">{draft.sop}</span></div>}
                                                </div>
                                                {draft.managementTag && (
                                                    <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded-full text-[7px] font-black border ${draft.managementTag === 'management-focus' ? 'bg-red-100 text-red-700 border-red-300' : draft.managementTag === 'easy-impactful' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>{draft.managementTag === 'management-focus' ? '🔴 Mgmt Focus' : draft.managementTag === 'easy-impactful' ? '🟢 Easy Impact' : '🔵 Ongoing'}</span>
                                                )}
                                                <p className="text-[7px] font-bold text-violet-400 uppercase">{draft.createdDate}</p>
                                                {/* Promote to Open */}
                                                <button
                                                    onClick={() => { const promoted = { ...draft, status: 'OPEN' as const }; setObservations(prev => prev.map(o => o.id === draft.id ? promoted : o)); saveObservationToDb(promoted); }}
                                                    className="mt-auto w-full py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-700 text-[8px] font-black uppercase tracking-widest hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all active:scale-95 flex items-center justify-center gap-1"
                                                    title="Submit this draft as an open observation"
                                                ><Send size={9} /> Submit</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            ) : (['management-focus', 'easy-impactful', 'ongoing', 'untagged'] as const).includes(activeInternalTab as any) ? (
                <div className="animate-in fade-in duration-300">
                    {(() => {
                        const tagConfig = activeInternalTab === 'management-focus'
                            ? { label: 'Management Focus', emoji: '🔴', color: 'red', borderColor: 'border-red-100', bgColor: 'bg-red-50', textColor: 'text-red-600' }
                            : activeInternalTab === 'easy-impactful'
                            ? { label: 'Easy Impactful', emoji: '🟢', color: 'emerald', borderColor: 'border-emerald-100', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' }
                            : activeInternalTab === 'ongoing'
                            ? { label: 'Ongoing', emoji: '🔵', color: 'blue', borderColor: 'border-blue-100', bgColor: 'bg-blue-50', textColor: 'text-blue-600' }
                            : { label: 'Untagged', emoji: '⬜', color: 'slate', borderColor: 'border-slate-100', bgColor: 'bg-slate-50', textColor: 'text-slate-600' };
                        const taggedItems = activeInternalTab === 'untagged'
                            ? mergedObservations.filter(o => !o.managementTag && o.status !== 'DRAFT')
                            : mergedObservations.filter(o => o.managementTag === activeInternalTab && o.status !== 'DRAFT');
                        if (taggedItems.length === 0) return (
                            <div className={`py-40 flex flex-col items-center justify-center text-center bg-white rounded-[4rem] border-2 border-dashed ${tagConfig.borderColor} shadow-inner`}>
                                <span className="text-7xl mb-6">{tagConfig.emoji}</span>
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">No {tagConfig.label} Observations</h3>
                                <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest">Tag observations using the {tagConfig.emoji} buttons on each observation card.</p>
                            </div>
                        );
                        return (
                            <>
                                <div className="flex items-center gap-3 mb-4 px-1">
                                    <div className={`p-2.5 ${tagConfig.bgColor} ${tagConfig.textColor} rounded-xl`}><span className="text-lg">{tagConfig.emoji}</span></div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">{tagConfig.label}</h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{taggedItems.length} observation{taggedItems.length !== 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <div className="hidden lg:flex flex-col gap-4 w-full">
                                    {taggedItems.map(obs => <ObservationCard key={obs.id} obs={obs} onAction={handleAction} onFilterThread={setThreadFilter} onViewImage={handleViewImage} />)}
                                </div>
                                <div className="lg:hidden space-y-3 px-1">
                                    {taggedItems.map(obs => <MobileObservationCard key={obs.id} obs={obs} onAction={handleAction} onSelect={(id) => handleAction('view-log', id)} isExpanded={expandedCardId === obs.id} onToggleExpand={() => setExpandedCardId(prev => prev === obs.id ? null : obs.id)} onViewImage={handleViewImage} onFilterThread={setThreadFilter} />)}
                                </div>
                            </>
                        );
                    })()}
                </div>
            ) : null}

            {/* SHARED MODALS */}
            {activeModal === 'ADVANCED_FILTER' && (<AdvancedGlobalFilterModal onClose={() => setActiveModal(null)} onApply={handleApplyAdvancedFilters} currentFilters={advFilters} totalRecords={filteredObservations.length} hierarchicalFilteredReports={observations} />)}
            {activeModal === 'NEW' && <AddObservationModal questions={auditQuestionsList} locationOptions={availableLocations} auditLocationName={targetEntity?.name || ''} lockedLocation={registryLockedLocation} onLockLocation={(loc) => { setRegistryLockedLocation(loc); try { localStorage.setItem('haccp_registry_locked_location', loc); } catch {} }} onUnlockLocation={() => { setRegistryLockedLocation(null); try { localStorage.removeItem('haccp_registry_locked_location'); } catch {} }} departmentLocations={registryDepartmentLocations} combinedLocations={registryCombinedLocations} hideAnswerSet hideSaveAsDraft={false} onClose={() => setActiveModal(null)} onSave={(observations) => { const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const createdDate = now.toISOString().split('T')[0]; const newItems: ObservationItem[] = []; observations.forEach((obs, idx) => { const newObs: ObservationItem = { id: obs.id, title: obs.observationText || obs.questionText || obs.title || 'Observation', questionText: obs.questionText || undefined, sectionTitle: obs.sectionTitle || undefined, checklistName: obs.checklistName || undefined, observationText: obs.observationText || undefined, sop: obs.sop || '', severity: 'MINOR', level: 'L1', mainKitchen: (obs.responsibility && obs.responsibility.length > 0 ? obs.responsibility[0] : '') || obs.area || 'General', area: obs.area || 'Unassigned', hierarchy: targetEntity?.name || 'Local Unit', closureComments: null, status: 'OPEN', duration: 'Just now', followUpStatus: 'NOT DONE', followUpCount: 0, followUpDate: timestamp.split(' ')[0], reportedBy: targetEntity?.name || 'Staff User', reportedByUserId: userRootId || undefined, lastUpdate: timestamp, createdDate, thumbnail: obs.thumbnail || '', allEvidence: obs.allEvidence || [], isStarred: false, people: (obs.responsibility || []).map(r => ({ name: r, impact: 0 })), assets: [], categories: [], tracking: [{ id: `t-${Date.now()}-${idx}`, label: 'Reported', user: targetEntity?.name || 'Staff User', timestamp, comments: obs.observationText || 'Observation logged.' }], unitId: observationScopeContext.unitId || undefined, unitName: observationScopeContext.unitName || undefined, regionalId: observationScopeContext.regionalId || undefined, regionalName: observationScopeContext.regionalName || undefined, departmentId: obs.departmentName || 'General', departmentName: obs.departmentName || 'General', isAuditSourced: false, managementTag: obs.managementTag || undefined }; newItems.push(newObs); }); newItems.forEach(ni => saveObservationToDb(ni)); setObservations(prev => [...newItems, ...prev]); setActiveModal(null); }} onSaveAsDraft={(drafts) => { const now = new Date(); const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); const createdDate = now.toISOString().split('T')[0]; for (const draft of drafts) { const id = `DRAFT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; const newObs: ObservationItem = { id, title: draft.questionText || 'Draft Observation', questionText: draft.questionText || undefined, sectionTitle: draft.sectionTitle || undefined, sop: draft.sectionTitle || '', severity: 'MINOR', level: 'L1', mainKitchen: draft.location || 'General', area: draft.location || 'Unassigned', hierarchy: targetEntity?.name || 'Local Unit', closureComments: null, status: 'DRAFT', duration: 'Just now', followUpStatus: 'NOT DONE', followUpCount: 0, followUpDate: timestamp.split(' ')[0], reportedBy: targetEntity?.name || 'Staff User', reportedByUserId: userRootId || undefined, lastUpdate: timestamp, createdDate, thumbnail: draft.images[0] || '', allEvidence: [...draft.images], isStarred: false, people: [], assets: [], categories: [], tracking: [{ id: 't1', label: 'Draft Saved', user: targetEntity?.name || 'Staff User', timestamp, comments: draft.observationText || 'Saved as draft.' }], unitId: observationScopeContext.unitId || undefined, unitName: observationScopeContext.unitName || undefined, regionalId: observationScopeContext.regionalId || undefined, regionalName: observationScopeContext.regionalName || undefined, departmentId: 'General', departmentName: 'General', managementTag: draft.managementTag || undefined }; saveObservationToDb(newObs); setObservations(prev => [newObs, ...prev]); } setActiveInternalTab('drafts'); setActiveModal(null); }} />}
            {activeModal === 'EDIT' && selectedObsId && selectedObs && (() => {
                const matchedEditQ = selectedObs.questionText ? auditQuestionsList.find(q => q.text === selectedObs.questionText) : null;
                const storedSelAnswer = (selectedObs as any).selectedAnswer || '';
                const storedSelIdx = (selectedObs as any).selectedResponseIndex;
                let editAnswerIdx: number | null = typeof storedSelIdx === 'number' ? storedSelIdx : null;
                if (editAnswerIdx === null && storedSelAnswer && matchedEditQ) {
                    const foundIdx = matchedEditQ.responses.findIndex(r => r.text === storedSelAnswer);
                    if (foundIdx >= 0) editAnswerIdx = foundIdx;
                }
                const editData = {
                    questionId: matchedEditQ?.id || '',
                    location: selectedObs.area || '',
                    commentText: selectedObs.observationText || selectedObs.title || '',
                    commentImages: selectedObs.allEvidence && selectedObs.allEvidence.length > 0 ? [...selectedObs.allEvidence] : (selectedObs.thumbnail ? [selectedObs.thumbnail] : []),
                    selectedAnswerIndex: editAnswerIdx,
                    entryId: selectedObs.id,
                };
                return <AddObservationModal
                    questions={auditQuestionsList}
                    locationOptions={availableLocations}
                    auditLocationName={targetEntity?.name || ''}
                    departmentLocations={registryDepartmentLocations}
                    combinedLocations={registryCombinedLocations}
                    hideSaveAsDraft
                    editMode
                    editData={editData}
                    onClose={() => setActiveModal(null)}
                    onSave={(updatedObs) => {
                        const obs = updatedObs[0];
                        if (!obs) { setActiveModal(null); return; }
                        const now = new Date();
                        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const updated: ObservationItem = {
                            ...selectedObs,
                            title: obs.observationText || obs.questionText || obs.title || selectedObs.title,
                            questionText: obs.questionText || selectedObs.questionText,
                            sectionTitle: obs.sectionTitle || selectedObs.sectionTitle,
                            checklistName: obs.checklistName || selectedObs.checklistName,
                            observationText: obs.observationText || undefined,
                            sop: obs.sop || selectedObs.sop,
                            area: obs.area || selectedObs.area,
                            mainKitchen: (obs.responsibility && obs.responsibility.length > 0 ? obs.responsibility[0] : '') || selectedObs.mainKitchen,
                            thumbnail: obs.thumbnail || selectedObs.thumbnail,
                            allEvidence: obs.allEvidence && obs.allEvidence.length > 0 ? obs.allEvidence : selectedObs.allEvidence,
                            lastUpdate: timestamp,
                            tracking: [...selectedObs.tracking, { id: `t-edit-${Date.now()}`, label: 'Observation Updated', user: targetEntity?.name || 'Staff User', timestamp, comments: 'Record updated via observation editor.' }],
                        };
                        const withAnswer = updated as any;
                        if (obs.selectedAnswer !== undefined) withAnswer.selectedAnswer = obs.selectedAnswer;
                        if (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null) withAnswer.selectedResponseIndex = obs.selectedResponseIndex;
                        else if ((obs as any).selectedResponseIndex === undefined && (selectedObs as any).selectedResponseIndex !== undefined) withAnswer.selectedResponseIndex = (selectedObs as any).selectedResponseIndex;
                        saveObservationToDb(updated);
                        setObservations(prev => prev.map(o => o.id === selectedObsId ? updated : o));
                        setActiveModal(null);
                    }}
                />;
            })()}
            {activeModal === 'EDIT_DRAFT' && editingDraftId && (() => {
                const draftObs = observations.find(o => o.id === editingDraftId);
                if (!draftObs) return null;
                const matchedDraftQ = draftObs.questionText ? auditQuestionsList.find(q => q.text === draftObs.questionText) : null;
                const draftSelAnswer = (draftObs as any).selectedAnswer || '';
                const draftSelIdx = (draftObs as any).selectedResponseIndex;
                let draftAnswerIdx: number | null = typeof draftSelIdx === 'number' ? draftSelIdx : null;
                if (draftAnswerIdx === null && draftSelAnswer && matchedDraftQ) {
                    const fi = matchedDraftQ.responses.findIndex(r => r.text === draftSelAnswer);
                    if (fi >= 0) draftAnswerIdx = fi;
                }
                const editData = {
                    questionId: matchedDraftQ?.id || '',
                    location: draftObs.area || '',
                    commentText: draftObs.observationText || draftObs.title || '',
                    commentImages: draftFetchedImages.length > 0 ? [...draftFetchedImages] : (draftObs.allEvidence && draftObs.allEvidence.length > 0 ? [...draftObs.allEvidence] : (draftObs.thumbnail ? [draftObs.thumbnail] : [])),
                    selectedAnswerIndex: draftAnswerIdx,
                    entryId: draftObs.id,
                };
                return <AddObservationModal
                    questions={auditQuestionsList}
                    locationOptions={availableLocations}
                    auditLocationName={targetEntity?.name || ''}
                    departmentLocations={registryDepartmentLocations}
                    combinedLocations={registryCombinedLocations}
                    hideAnswerSet
                    hideSaveAsDraft={false}
                    editMode
                    editData={editData}
                    onClose={() => { setActiveModal(null); setEditingDraftId(null); setDraftFetchedImages([]); }}
                    onSave={(updatedObs) => {
                        const obs = updatedObs[0];
                        if (!obs) { setActiveModal(null); setEditingDraftId(null); setDraftFetchedImages([]); return; }
                        const now = new Date();
                        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const draftRef = observations.find(o => o.id === editingDraftId);
                        const updated: ObservationItem = {
                            ...(draftRef || {} as ObservationItem),
                            title: obs.observationText || obs.questionText || obs.title || draftRef?.title || 'Observation',
                            questionText: obs.questionText || draftRef?.questionText,
                            sectionTitle: obs.sectionTitle || draftRef?.sectionTitle,
                            checklistName: obs.checklistName || draftRef?.checklistName,
                            observationText: obs.observationText || undefined,
                            sop: obs.sop || draftRef?.sop || '',
                            area: obs.area || draftRef?.area || 'Unassigned',
                            mainKitchen: (obs.responsibility && obs.responsibility.length > 0 ? obs.responsibility[0] : '') || draftRef?.mainKitchen || 'General',
                            thumbnail: obs.thumbnail || draftRef?.thumbnail || '',
                            allEvidence: obs.allEvidence && obs.allEvidence.length > 0 ? obs.allEvidence : draftRef?.allEvidence || [],
                            lastUpdate: timestamp,
                            status: 'OPEN',
                            people: (obs.responsibility || []).map((r: string) => ({ name: r, impact: 0 })),
                            tracking: [...(draftRef?.tracking || []), { id: `t-send-${Date.now()}`, label: 'Sent from Draft', user: targetEntity?.name || 'Staff User', timestamp, comments: obs.observationText || 'Draft promoted to observation.' }],
                        };
                        const withAnswer = updated as any;
                        if (obs.selectedAnswer !== undefined) withAnswer.selectedAnswer = obs.selectedAnswer;
                        if (typeof obs.selectedResponseIndex === 'number') withAnswer.selectedResponseIndex = obs.selectedResponseIndex;
                        else if (typeof (draftRef as any)?.selectedResponseIndex === 'number') withAnswer.selectedResponseIndex = (draftRef as any).selectedResponseIndex;
                        saveObservationToDb(updated);
                        setObservations(prev => prev.map(o => o.id === editingDraftId ? updated : o));
                        setActiveModal(null);
                        setEditingDraftId(null);
                        setDraftFetchedImages([]);
                    }}
                    onSaveAsDraft={(drafts) => {
                        const d = drafts[0];
                        if (!d) { setActiveModal(null); setEditingDraftId(null); setDraftFetchedImages([]); return; }
                        const now = new Date();
                        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const draftRef = observations.find(o => o.id === editingDraftId);
                        const updatedDraft: ObservationItem = {
                            ...(draftRef || {} as ObservationItem),
                            title: d.questionText || d.observationText || draftRef?.title || 'Draft Observation',
                            questionText: d.questionText || draftRef?.questionText,
                            sectionTitle: d.sectionTitle || draftRef?.sectionTitle,
                            observationText: d.observationText || undefined,
                            area: d.location || draftRef?.area || 'Unassigned',
                            thumbnail: d.images[0] || draftRef?.thumbnail || '',
                            allEvidence: d.images.length > 0 ? [...d.images] : draftRef?.allEvidence || [],
                            lastUpdate: timestamp,
                            status: 'DRAFT',
                        };
                        saveObservationToDb(updatedDraft);
                        setObservations(prev => prev.map(o => o.id === editingDraftId ? updatedDraft : o));
                        setActiveModal(null);
                        setEditingDraftId(null);
                        setDraftFetchedImages([]);
                    }}
                />;
            })()}
            {activeModal === 'BULK_UPLOAD' && <BulkUploadModal isOpen={true} onClose={() => setActiveModal(null)} onSave={handleBulkUploadSave} availableLocations={availableLocations} />}
            {activeModal === 'CSV_REVIEW' && <ReviewCsvModal stagedData={stagedCsvRows} onCommit={handleCsvCommit} onCancel={() => { setStagedCsvRows([]); setActiveModal(null); }} availableLocations={availableLocations} availableDepartments={availableDepartments} availableSops={availableSops} questions={auditQuestionsList} />}
            
            {/* FORENSIC IMAGE VIEWER (Overlays current state) */}
            {viewerImage && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setViewerImage(null)}>
                    <div className="absolute top-6 right-6 flex items-center gap-4 z-[1010]"><div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white text-xs font-black uppercase tracking-widest">{viewerImage.label}</div><button onClick={(e) => { e.stopPropagation(); setViewerImage(null); }} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10 shadow-2xl"><X size={28} strokeWidth={3} /></button></div>
                    <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12 animate-in zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}><img src={viewerImage.url} className="max-w-full max-h-full object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5" alt="Viewer" /><div className="absolute bottom-10 left-1/2 -translate-y-1/2 w-full text-center"><p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">HACCP PRO FORENSIC IMAGE PROTOCOL</p></div></div>
                </div>
            )}

            {activeModal === 'DELETE' && selectedObsId && (
                <DeleteConfirmationModal id={selectedObsId} onClose={() => setActiveModal(null)} onConfirm={confirmDelete} />
            )}
            {activeModal === 'LOG' && selectedObs && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 text-left">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                        <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0 shadow-lg"><div className="flex items-center gap-4"><History size={24} className="text-indigo-400" /><div><h3 className="text-lg font-black uppercase tracking-tight">Observation Audit Trail</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report #{selectedObs.id}</p></div></div><button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} /></button></div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-slate-50/20">
                            <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                {selectedObs.tracking.map((step, idx) => (
                                    <div key={idx} className="relative"><div className="absolute -left-[19px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-indigo-600 shadow-sm" /><div className="flex justify-between items-start mb-2"><span className="text-xs font-black text-slate-800 uppercase tracking-tight">{step.label}</span><span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100 uppercase">{step.timestamp}</span></div><div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{step.comments}"</p><div className="mt-3 flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">U</div><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{step.user}</span></div></div></div>
                                ))}
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end"><button onClick={() => setActiveModal(null)} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Close Log</button></div>
                    </div>
                </div>
            )}
            {activeModal === 'BREAKDOWN' && selectedObs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 text-left">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-rose-600 text-white flex justify-between items-center shrink-0 shadow-lg"><div className="flex items-center gap-5"><Wrench size={32} /><div><h3 className="text-xl font-black uppercase tracking-tight">{breakdownMode === 'initiate' ? 'Log Maintenance' : breakdownMode === 'update' ? 'Update Service' : 'Service History'}</h3><p className="text-[10px] font-bold text-rose-100 uppercase tracking-widest mt-2">Asset Lifecycle Log</p></div></div><button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white active:scale-90"><X size={28} /></button></div>
                        <div className="p-10 space-y-6 bg-slate-50/20 overflow-y-auto custom-scrollbar flex-1 text-left">{breakdownMode === 'history' ? (() => {
                          const equipName = selectedObs.breakdownDetails?.equipment || '';
                          const matchedEquipment = undefined;
                          const relatedObservations = observations.filter(o => o.breakdownDetails?.equipment === equipName && o.id !== selectedObs.id);
                          return (
                          <div className="space-y-6">
                            {matchedEquipment && (
                              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-3 flex items-center gap-3">
                                  <Package size={16} className="text-white" />
                                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Equipment Details</span>
                                </div>
                                <div className="p-5 grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Name</span>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{matchedEquipment.name}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID Number</span>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{matchedEquipment.idNumber}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{matchedEquipment.location}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Department</span>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{matchedEquipment.department}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Make / Brand</span>
                                    <p className="text-sm font-bold text-slate-800 mt-0.5">{matchedEquipment.make} — {matchedEquipment.brand}</p>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase mt-0.5 ${matchedEquipment.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${matchedEquipment.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />{matchedEquipment.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {!matchedEquipment && equipName && (
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <Package size={20} className="text-slate-400" />
                                  <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Equipment</span>
                                    <p className="text-sm font-bold text-slate-800">{equipName}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <History size={14} className="text-rose-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Timeline</span>
                              </div>
                              {!selectedObs.breakdownDetails || selectedObs.breakdownDetails.history.length === 0 ? (
                                <div className="text-center text-slate-400 py-10 italic bg-white rounded-xl border border-slate-100">No history available</div>
                              ) : (
                                <div className="space-y-3">
                                  {selectedObs.breakdownDetails.history.map((h, i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-black text-slate-700">{h.action}</span>
                                        <span className="text-[10px] text-slate-400">{h.date}</span>
                                      </div>
                                      <p className="text-xs text-slate-600 mb-2">{h.comments}</p>
                                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                        <span>User: {h.user}</span>
                                        {h.cost !== undefined && <span>Cost: ₹{h.cost}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {relatedObservations.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle size={14} className="text-amber-500" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Related Observations ({relatedObservations.length})</span>
                                </div>
                                <div className="space-y-2">
                                  {relatedObservations.map(obs => (
                                    <div key={obs.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                                      <div className={`w-2 h-10 rounded-full flex-shrink-0 ${obs.status === 'RESOLVED' ? 'bg-emerald-500' : obs.status === 'OPEN' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-slate-700 truncate">{obs.observationText || obs.title}</span>
                                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${obs.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : obs.status === 'OPEN' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{obs.status}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-400 font-medium">
                                          <span>#{obs.id}</span>
                                          <span>{obs.createdDate}</span>
                                          <span>{obs.sop}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {relatedObservations.length === 0 && equipName && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <AlertTriangle size={14} className="text-amber-500" />
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Related Observations</span>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-100 p-6 text-center">
                                  <p className="text-xs text-slate-400 italic">No other observations linked to this equipment</p>
                                </div>
                              </div>
                            )}

                            <button onClick={() => setBreakdownMode('update')} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-colors">Back to Update</button>
                          </div>
                          );
                        })() : (<><div className="space-y-2 relative" ref={assetDropdownRef}><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Identity</label><div onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)} className={`w-full px-5 py-4 bg-white border-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${isAssetDropdownOpen ? 'border-rose-500 bg-white ring-4 ring-rose-50 shadow-md' : 'border-slate-100 hover:border-rose-200 shadow-sm'}`}><span className={`text-xs font-black uppercase ${breakdownForm.equipment ? 'text-slate-800' : 'text-slate-300'}`}>{breakdownForm.equipment || "CHOOSE ASSET..."}</span><ChevronDown size={18} className={`text-slate-300 transition-transform ${isAssetDropdownOpen ? 'rotate-180' : ''}`} /></div>{isAssetDropdownOpen && (<div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[230] shadow-2xl z-[230] overflow-hidden animate-in fade-in slide-in-from-top-2"><div className="p-3 border-b border-slate-100 bg-slate-50"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input autoFocus type="text" placeholder="Search asset registry..." className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-rose-500 uppercase" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} onClick={(e) => e.stopPropagation()} /></div></div><div className="max-h-48 overflow-y-auto custom-scrollbar p-1">{filteredAssets.map(asset => (<button key={asset} onClick={(e) => { e.stopPropagation(); setBreakdownForm({...breakdownForm, equipment: asset}); setIsAssetDropdownOpen(false); setAssetSearch(""); }} className="w-full text-left px-4 py-3 hover:bg-rose-50 rounded-xl text-xs font-black text-slate-600 uppercase flex justify-between items-center group transition-all">{asset}{breakdownForm.equipment === asset && <Check size={14} className="text-rose-600" strokeWidth={3} />}</button>))}{filteredAssets.length === 0 && (<div className="p-4 text-center text-[10px] text-slate-400 italic font-bold uppercase">No Assets Found</div>)}</div></div>)}</div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{breakdownMode === 'initiate' ? 'Root Failure Cause' : 'Maintenance Status'}</label><textarea className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500 resize-none shadow-inner transition-all placeholder:text-slate-300" placeholder="Detail the technical status..." value={breakdownMode === 'initiate' ? breakdownForm.cause : breakdownForm.action} onChange={e => breakdownMode === 'initiate' ? setBreakdownForm({...breakdownForm, cause: e.target.value}) : setBreakdownForm({...breakdownForm, action: e.target.value})} /></div>{breakdownMode === 'update' && (<div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maintenance Cost (₹)</label><input type="number" className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:border-rose-500 outline-none" value={breakdownForm.cost} onChange={e => setBreakdownForm({...breakdownForm, cost: e.target.value})} /></div>)}</>)}</div>
                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe"><button onClick={() => setActiveModal(null)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>{breakdownMode === 'initiate' ? (<button disabled={!breakdownForm.equipment || !breakdownForm.cause} onClick={handleSaveBreakdown} className={`px-12 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${breakdownForm.equipment && breakdownForm.cause ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>Confirm Breakdown</button>) : breakdownMode === 'update' ? (<><button onClick={() => handleBreakdownUpdate(false)} className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95">Post Update</button><button onClick={() => handleBreakdownUpdate(true)} className="px-8 py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"><CheckCircle2 size={18} strokeWidth={3} /> Resolve Breakdown</button></>) : (<button onClick={() => setActiveModal(null)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Close</button>)}</div>
                    </div>
                </div>
            )}
            {activeModal === 'CLOSURE' && selectedObsId && selectedObs && (
                <ClosureFormModal
                    obs={selectedObs}
                    onClose={() => setActiveModal(null)}
                    onSave={(data) => {
                        const now = new Date();
                        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isDraft = !!data.asDraft;
                        // Persist BOTH the primary thumbnail (`afterImage`) and
                        // the full list (`closureEvidence`) so the internal flow
                        // matches the share-link API's persistence contract.
                        // Without this, the two surfaces would store evidence
                        // differently and the closure detail view would diverge.
                        const closureEvidenceList = (data.allEvidence || []).map(e => ({ url: e.url }));
                        if (selectedObsId) ensureInState(selectedObsId, o => {
                            const updated = {
                                ...o,
                                // Only flip to RESOLVED on Send. Draft saves comments + evidence
                                // but keeps the original status so the user can finish later.
                                status: isDraft ? o.status : 'RESOLVED' as const,
                                closureComments: data.comments,
                                afterImage: data.evidenceUrl,
                                closureEvidence: closureEvidenceList.length > 0 ? closureEvidenceList : (o as any).closureEvidence,
                                lastUpdate: timestamp,
                                tracking: [...o.tracking, { id: `t-close-${Date.now()}`, label: isDraft ? 'Closure Draft Saved' : 'Closure Submitted', user: 'QA Auditor', timestamp, comments: data.comments }]
                            };
                            // Immediately persist to DB — the debounced bulk-save only
                            // fires on observations.length changes, so a pure status/
                            // evidence update would be lost on page reload without this.
                            saveObservationToDb(updated);
                            return updated;
                        });
                        if (!isDraft && selectedObs?.isAuditSourced && selectedObs.linkedObservationId) {
                            const linkedId = selectedObs.linkedObservationId;
                            setObservations(prev => prev.map(o => o.id === linkedId ? ({
                                ...o,
                                status: 'RESOLVED',
                                closureComments: data.comments,
                                afterImage: data.evidenceUrl,
                                closureEvidence: closureEvidenceList.length > 0 ? closureEvidenceList : (o as any).closureEvidence,
                                lastUpdate: timestamp,
                                tracking: [...o.tracking, { id: `t-close-sync-${Date.now()}`, label: 'Closure Synced from Registry', user: 'QA Auditor', timestamp, comments: data.comments }]
                            }) : o));
                        }
                        if (!isDraft && selectedObs) {
                            const dept = selectedObs.mainKitchen || 'General';
                            const deptInfo = DEPT_PERSONNEL[dept] || DEPT_PERSONNEL['General'];
                            const recipients = [selectedObs.reportedBy, ...deptInfo.heads];
                            addNotification({
                                type: 'OBSERVATION_CLOSED',
                                title: 'Observation Resolved',
                                message: `"${selectedObs.title}" (${selectedObs.id}) has been closed with corrective action. Department: ${dept}.`,
                                observationId: selectedObs.id,
                                department: dept,
                                icon: 'check',
                                severity: 'info',
                                recipients: [...new Set(recipients)],
                                senderName: 'QA Auditor',
                            });
                        }
                        setActiveModal(null);
                    }}
                    onViewImage={handleViewImage}
                />
            )}
            {activeModal === 'REOPEN' && selectedObsId && selectedObs && (
                <NonComplianceFormModal
                    obs={selectedObs}
                    onClose={() => setActiveModal(null)}
                    onSave={(data) => {
                        if (!selectedObsId || !selectedObs || !data.signature || !data.findings) return;
                        const now = new Date();
                        const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const newObs: ObservationItem = {
                            ...selectedObs,
                            id: `OBS-RE-${Date.now()}`,
                            title: `FOLLOW UP: ${selectedObs.title}`,
                            status: 'OPEN',
                            createdDate: now.toISOString().split('T')[0],
                            lastUpdate: timestamp,
                            duration: 'Just now',
                            parentObservationId: selectedObs.id,
                            thumbnail: data.evidenceUrl || selectedObs.thumbnail,
                            afterImage: undefined,
                            closureComments: null,
                            followUpStatus: 'NOT DONE',
                            followUpCount: 0,
                            tracking: [{ id: 'tr1', label: 'Reopened / New Report', user: 'QA Auditor', timestamp, comments: data.findings }],
                            isStarred: true
                        };
                        setObservations(prev => { const hasInState = prev.some(o => o.id === selectedObsId); const base = hasInState ? prev : (() => { const ao = auditObservationItems.find(a => a.id === selectedObsId); return ao ? [ao, ...prev] : prev; })(); return [newObs, ...base.map(o => o.id === selectedObsId ? { ...o, linkedObservationId: newObs.id, tracking: [...o.tracking, { id: `t-re-${Date.now()}`, label: 'Non-Compliance Recorded', user: 'QA Auditor', timestamp, comments: 'Marked as persistent issue. New report created.' }] } : o)]; });
                        const dept = selectedObs.mainKitchen || 'General';
                        const deptInfo = DEPT_PERSONNEL[dept] || DEPT_PERSONNEL['General'];
                        const recipients = [selectedObs.reportedBy, ...deptInfo.heads, ...deptInfo.staff];
                        addNotification({
                            type: 'NON_COMPLIANCE',
                            title: 'Non-Compliance Reported',
                            message: `Follow-up created for "${selectedObs.title}" (${selectedObs.id}). Persistent non-compliance documented under ${dept}.`,
                            observationId: newObs.id,
                            department: dept,
                            icon: 'shield',
                            severity: 'critical',
                            recipients: [...new Set(recipients)],
                            senderName: 'QA Auditor',
                        });
                        setActiveModal(null);
                    }}
                    onViewImage={handleViewImage}
                />
            )}

            {/* Share Link Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 shrink-0">
                            <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
                                <Share2 size={18} className="text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Share Registry Link</h2>
                                <p className="text-[10px] text-slate-400 font-medium">Generate a password-protected, responsibility-specific shareable link</p>
                            </div>
                            <button onClick={() => setShowShareModal(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"><X size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Create New Link */}
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Create New Link</p>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Responsibility *</label>
                                    <select
                                        value={shareResponsibility}
                                        onChange={e => setShareResponsibility(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-violet-400 transition-all"
                                    >
                                        <option value="">Select responsibility / department...</option>
                                        {shareResponsibilities.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Display Label <span className="text-slate-300 normal-case font-medium">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={shareLabel}
                                        onChange={e => setShareLabel(e.target.value)}
                                        placeholder="e.g. Kitchen Team View..."
                                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-violet-400 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Access Password *</label>
                                    <div className="relative">
                                        <input
                                            type={shareShowPassword ? 'text' : 'password'}
                                            value={sharePassword}
                                            onChange={e => setSharePassword(e.target.value)}
                                            placeholder="Set a password for this link..."
                                            className="w-full px-3 py-2.5 pr-10 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-violet-400 transition-all"
                                        />
                                        <button type="button" onClick={() => setShareShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {shareShowPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                {shareError && (
                                    <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 rounded-xl px-3 py-2">
                                        <AlertTriangle size={12} />{shareError}
                                    </div>
                                )}
                                <button
                                    onClick={handleCreateShareLink}
                                    disabled={shareCreating || !shareResponsibility || !sharePassword}
                                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {shareCreating ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Share2 size={14} /> Generate Link</>}
                                </button>
                            </div>

                            {/* Existing Links */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Shared Links</p>
                                    <button onClick={loadShareLinks} disabled={shareLoadingLinks} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all">
                                        <RefreshCw size={12} className={shareLoadingLinks ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                                {shareLoadingLinks ? (
                                    <div className="flex items-center justify-center py-8 text-slate-300">
                                        <Loader2 size={20} className="animate-spin" />
                                    </div>
                                ) : shareLinks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-xs font-medium">No shared links yet. Create one above.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {shareLinks.map((link: any) => {
                                            const url = `${getPublicSiteUrl()}/obs-share/${link.id}`;
                                            const isCopied = shareCopiedToken === link.id;
                                            return (
                                                <div key={link.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <Users size={14} className="text-violet-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 truncate">{link.label || link.responsibility}</p>
                                                        <p className="text-[9px] text-slate-400 truncate font-mono">/obs-share/{link.id.slice(0, 12)}…</p>
                                                        {link.createdAt && <p className="text-[9px] text-slate-300">{new Date(link.createdAt).toLocaleDateString()}</p>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleCopyShareLink(link.id)}
                                                        className={`p-2 rounded-xl transition-all shrink-0 ${isCopied ? 'bg-emerald-100 text-emerald-600' : 'bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-200'}`}
                                                        title={isCopied ? 'Copied!' : 'Copy link'}
                                                    >
                                                        {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                                                    </button>
                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shrink-0" title="Open link">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeleteShareLink(link.id)}
                                                        className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shrink-0"
                                                        title="Delete link"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notify Responsibility Owners — bulk WhatsApp blast.
                Server-side mints a fresh share token per group (rotates
                any prior token for the same responsibility), then sends
                each chosen recipient a personalised summary message
                with a deep link + the password chosen here. */}
            {showNotifyModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 shrink-0">
                            <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
                                <Megaphone size={18} className="text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Notify Responsibility Owners</h2>
                                <p className="text-[10px] text-slate-400 font-medium">Send a WhatsApp summary of open observations to each responsibility’s escalation contacts</p>
                            </div>
                            <button onClick={() => setShowNotifyModal(false)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"><X size={18} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Mode + template controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Send Mode</p>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => setNotifyMode('template')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${notifyMode === 'template' ? 'bg-amber-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:text-amber-600'}`}>Template</button>
                                        <button onClick={() => setNotifyMode('text')} className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${notifyMode === 'text' ? 'bg-amber-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-500 hover:text-amber-600'}`}>Free-form text</button>
                                    </div>
                                    <p className="text-[9px] text-slate-400 leading-snug">{notifyMode === 'template' ? 'Uses a Meta-approved template — works for cold contacts.' : 'Free-form text only delivers within the 24-hour window.'}</p>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Mode</p>
                                    <label className="flex items-start gap-2 cursor-pointer select-none p-2 bg-white border border-slate-200 rounded-xl hover:border-amber-400 transition-all">
                                        <input type="checkbox" checked={notifyNoPassword} onChange={e => setNotifyNoPassword(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-black text-slate-700">Open access (no password)</div>
                                            <div className="text-[9px] text-slate-400 leading-snug">Recipient taps the link and goes straight in. Easiest for them — but anyone the link is forwarded to can also access &amp; close observations.</div>
                                        </div>
                                    </label>
                                    {!notifyNoPassword && (
                                        <button onClick={regenerateAllOtps} className="w-full px-3 py-2 bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5"><RefreshCw size={11} /> Regenerate all OTPs</button>
                                    )}
                                </div>
                            </div>

                            {notifyMode === 'template' ? (
                                <div className="bg-slate-50 rounded-2xl p-3 space-y-3">
                                    <p className="text-[9px] text-slate-500 leading-snug">Server picks the template per recipient based on how many responsibilities they own. Single-resp recipients get the 5-variable layout; multi-resp recipients get the 3-variable consolidated layout.</p>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Single-responsibility template <span className="text-slate-400 font-normal normal-case">(used when recipient owns 1)</span></label>
                                        <input type="text" value={notifySingleTemplateName} onChange={e => setNotifySingleTemplateName(e.target.value)} placeholder="observation_summary_v1" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-400 transition-all" />
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed font-sans whitespace-pre-line">
{`*Pending Observation Alert of {{1}}*  (header)

*Responsibility:* {{1}}

You have *{{2}} open* food-safety observations awaiting your action.

*📊 Avg open age :* {{3}}
*⏱️ Avg closure time (historical)*: {{4}}

*Please review and close them here*: {{5}}

Thank you`}
                                        </div>
                                        <p className="text-[9px] text-slate-500 leading-snug">Body: {'{{1}}'} responsibility · {'{{2}}'} open count · {'{{3}}'} avg open age · {'{{4}}'} avg closure time · {'{{5}}'} share link.</p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Multi-responsibility template <span className="text-slate-400 font-normal normal-case">(used when recipient owns 2+)</span></label>
                                        <input type="text" value={notifyMultiTemplateName} onChange={e => setNotifyMultiTemplateName(e.target.value)} placeholder="all_observation_summary_v1" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-400 transition-all" />
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed font-sans whitespace-pre-line">
{`*Pending Observation Alert of {{1}}*  (header)

Hello {{1}},

Here is the current food-safety observation status:

{{2}}

📋 Please review and close pending items here:
{{3}}

Thank you`}
                                        </div>
                                        <p className="text-[9px] text-slate-500 leading-snug">Body: {'{{1}}'} recipient name · {'{{2}}'} multi-line status block (server-built, one entry per responsibility, with appreciation line when open=0) · {'{{3}}'} share link.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Message Body</label>
                                    <textarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} rows={6} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-400 transition-all resize-none" />
                                    <p className="text-[9px] text-slate-400 leading-snug">Placeholders: <code className="bg-white px-1 rounded">{'{name}'}</code> <code className="bg-white px-1 rounded">{'{count}'}</code> <code className="bg-white px-1 rounded">{'{link}'}</code> <code className="bg-white px-1 rounded">{'{password}'}</code> <code className="bg-white px-1 rounded">{'{responsibility}'}</code> <code className="bg-white px-1 rounded">{'{avgOpenAge}'}</code> <code className="bg-white px-1 rounded">{'{avgCloseTime}'}</code></p>
                                </div>
                            )}

                            {/* Per-row groups */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Responsibility Groups · Open Observations</p>
                                {notifyRows.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 rounded-2xl text-slate-400 text-xs font-medium">No open observations to notify on.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {notifyRows.map((row, idx) => (
                                            <div key={row.responsibility} className={`border rounded-2xl p-3 transition-all ${row.enabled ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input type="checkbox" checked={row.enabled} onChange={e => updateNotifyRow(idx, { enabled: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-black text-slate-800 truncate">{row.responsibility}</p>
                                                        <p className="text-[9px] text-slate-400">{row.openCount} open · {row.closedCount} closed · {row.contacts.length} contact(s) · {row.selectedPhones.size} selected</p>
                                                        {/* Ageing metrics — computed per responsibility.
                                                            Avg Open Age = how long the currently-open items
                                                            have been sitting; Avg Closure = historical
                                                            mean time-to-close for this same responsibility. */}
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[9px] font-bold">
                                                            <span className="text-rose-600">⏱ Avg open age: {formatDurationHours(row.avgOpenAgeHours)}</span>
                                                            <span className="text-emerald-600">✓ Avg closure: {row.avgCloseTimeHours == null ? 'no history' : formatDurationHours(row.avgCloseTimeHours)}</span>
                                                        </div>
                                                    </div>
                                                    {notifyNoPassword ? (
                                                        <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200" title="Open access — no password required">
                                                            <Link2 size={11} /> Open link
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1 shrink-0" title="OTP — sent to recipient in WhatsApp message">
                                                            <KeyRound size={12} className="text-slate-300" />
                                                            <input type="text" value={row.password} onChange={e => updateNotifyRow(idx, { password: e.target.value })} placeholder="OTP" className="w-20 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-mono font-bold tracking-wider text-amber-800 focus:outline-none focus:border-amber-400 transition-all" />
                                                            <button type="button" onClick={() => regenerateRowOtp(idx)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all" title="Regenerate this OTP"><RefreshCw size={11} /></button>
                                                        </div>
                                                    )}
                                                </div>
                                                {row.contacts.length === 0 ? (
                                                    <div className="ml-6 text-[10px] text-rose-500 font-bold flex items-center gap-1.5"><AlertTriangle size={11} /> No escalation contacts mapped — open the Escalation Matrix and assign at least one contact for "{row.responsibility}".</div>
                                                ) : (
                                                    <div className="ml-6 flex flex-wrap gap-1.5">
                                                        {row.contacts.map(c => {
                                                            const sel = row.selectedPhones.has(c.phone);
                                                            return (
                                                                <button key={c.userId + c.phone} onClick={() => toggleNotifyContact(idx, c.phone)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${sel ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-white border border-slate-200 text-slate-400 hover:text-amber-600'}`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${c.level === 1 ? 'bg-emerald-500' : c.level === 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                                                    {c.name} <span className="font-mono opacity-60">·{c.phone.slice(-4)}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {notifyError && (
                                <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 rounded-xl px-3 py-2">
                                    <AlertTriangle size={12} />{notifyError}
                                </div>
                            )}

                            {notifyResult && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1">
                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Send Result</p>
                                    <p className="text-xs font-bold text-emerald-800">{notifyResult.totals?.sent || 0} sent · {notifyResult.totals?.failed || 0} failed · {notifyResult.totals?.recipientCount || 0} recipient(s) across {notifyResult.totals?.groupCount || 0} group(s)</p>
                                    {Array.isArray(notifyResult.perRecipient) && notifyResult.perRecipient.some((r: any) => r?.error) && (
                                        <details className="mt-2"><summary className="text-[10px] font-bold text-emerald-700 cursor-pointer">Show failures</summary>
                                            <div className="mt-1 space-y-1 text-[10px] font-mono text-rose-700">
                                                {notifyResult.perRecipient.filter((r: any) => r?.error).map((r: any, i: number) => (
                                                    <div key={`${r.phone}-${i}`} className="space-y-0.5">
                                                        <div>{r.name || r.phone} · {(r.responsibilities || []).join(', ')} → {r.error}</div>
                                                        {r.hint && <div className="text-amber-700 pl-2">Hint: {r.hint}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                    {Array.isArray(notifyResult.skippedGroups) && notifyResult.skippedGroups.length > 0 && (
                                        <details className="mt-1"><summary className="text-[10px] font-bold text-amber-700 cursor-pointer">Show skipped groups</summary>
                                            <div className="mt-1 space-y-0.5 text-[10px] font-mono text-amber-700">
                                                {notifyResult.skippedGroups.map((g: any, i: number) => (
                                                    <div key={`skip-${i}`}>{g.responsibility || '(blank)'} → {g.error}</div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                            <p className="text-[9px] text-slate-400 font-medium">Tokens are minted server-side. Old links for the same responsibility are rotated.</p>
                            <button onClick={handleSendNotifyBlast} disabled={notifySending || notifyRows.filter(r => r.enabled).length === 0} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg flex items-center gap-2">
                                {notifySending ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send WhatsApp Blast</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ObservationRegistry;