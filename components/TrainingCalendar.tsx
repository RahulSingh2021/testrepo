"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  COUNTRY_CODE_OPTIONS,
  DEFAULT_WA_COUNTRY_CODE,
  resolveWaContact,
  type ResolvedWaContact,
} from '@/lib/countryDialingCodes';
import { 
  Calendar, Clock, Users, FileSpreadsheet, 
  Plus, RefreshCw, Search, Trash2, Edit, 
  X, Save, QrCode, UserCheck, ShieldCheck, Layers, CheckCircle2,
  ChevronDown, ChevronLeft, Check, Eye, MoreVertical,
  MapPin, Globe, ArrowRight, User as UserIcon,
  FileText, Activity, AlertCircle, Timer,
  FileUp, Layout, CalendarClock, Hash,
  Mail, Phone, User, IdCard, History,
  ChevronUp,
  UserPlus,
  UserMinus,
  Circle,
  Zap,
  RotateCcw,
  Lock,
  Unlock,
  Filter,
  FilterX,
  FilePlus,
  FileMinus,
  Building2,
  ListChecks,
  PieChart,
  ChevronRight,
  Loader2,
  Download,
  Briefcase,
  FileDown,
  Upload,
  Info,
  Link2,
  Copy,
  ClipboardList,
  Award,
  Image as ImgIcon,
  ExternalLink,
  Ticket,
  DollarSign,
  TrendingUp,
  Gift,
  MessageCircle,
  XCircle,
  CheckCircle,
  Send,
  Megaphone,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { openWhatsApp } from '@/utils/whatsapp';
import { HierarchyScope, Entity } from '../types';
import { EmployeeRecord } from './LearningManagement';
import CertificateModal, { CertParticipant, CertTraining, StudioCertificateRender, substituteVars } from './CertificateModal';
import { loadTemplates, DesignTemplate } from './CertificateStudio';

// --- Types & Interfaces ---

interface ParticipantData {
  employeeId: string;
  status: 'present' | 'absent' | 'neutral';
  addedAt: number;
}

interface Training {
  id: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  mode: 'Classroom' | 'Online' | 'Recorded' | 'Demo';
  topic: string;
  topicRemark?: string;
  subTopic: string;
  trainer: string;
  trainerScope: string;
  trainerQualification?: string;
  externalCompany?: string; 
  date: string;
  startTime: string;
  endTime: string;
  trainingHours?: number;
  location?: string;
  description?: string;
  participantsPresent: number;
  participantsAbsent: number;
  participantsNeutral: number;
  participantList: ParticipantData[]; 
  hasSheet: boolean;
  sheetUrl?: string; 
  uploadedDate?: string;
  isLocked: boolean;
  createdByEntityId: string;
  assignedUnits: string[];
  unitName?: string;
  thumbnailImage?: string;
  sampleCertTemplateId?: string;
  whatsappLink?: string;
  instagramLink?: string;
  linkedinLink?: string;
  meetingLink?: string;
  meetingLinkEmailedAt?: string;
  // Per-event auto-send settings for the meeting/joining link.
  // Defaults: ON / ON / 'both'. Persisted on training_calendar.data.
  autoSendMeetingLinkOnVerify?: boolean;
  autoSendMeetingLinkOnFreeRegister?: boolean;
  autoSendMeetingLinkChannels?: 'email' | 'whatsapp' | 'both';
  isActive?: boolean;
  linkClicks?: number;
  registrationExpiryDate?: string;
  upiId?: string;
  courseFee?: number;
  discount?: number;
  offerValidTill?: string;
  couponDiscount?: number;
  couponCommission?: number;
  thumbnailVersion?: number;
}

interface BulkEmployee {
  csvEmployeeId: string;
  csvEmployeeName: string;
  resolvedEmployeeId: string;
  resolvedEmployeeName: string;
  matchedRecord: EmployeeRecord | null;
  suggestedRecord: EmployeeRecord | null;
  matchPercent: number;
  department: string;
  unitName: string;
}

interface BulkSession {
  id: string;
  topic: string;
  trainer: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  unitNumber: string;
  regionalName: string;
  employees: BulkEmployee[];
}

const buildWaPrefillMessage = (name: string | null | undefined): string => {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  return `Hi ${firstName}, this is from SafeFood Mitra Training. `;
};

const withWaPrefill = (url: string | null | undefined, name: string | null | undefined): string | null => {
  if (!url) return null;
  // The URL may already contain a query string (e.g. whatsapp://send?phone=...),
  // so use & when appending the prefilled text.
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}text=${encodeURIComponent(buildWaPrefillMessage(name))}`;
};

const describeWaResolution = (
  resolution: ResolvedWaContact,
  registrantName?: string | null
): string => {
  const who = registrantName || 'learner';
  const base = `Open WhatsApp chat with ${who}`;
  if (!resolution.url) return base;
  if (resolution.invalid) {
    return `${base} — number doesn't match any known country format, please verify before messaging`;
  }
  switch (resolution.source) {
    case 'detected':
      return `${base} — auto-detected as +${resolution.code}${resolution.detectedCountry ? ` (${resolution.detectedCountry})` : ''} from number format`;
    case 'country':
      return `${base} — using +${resolution.code} from registrant country`;
    case 'region-default':
      return `${base} — using regional default +${resolution.code}`;
    case 'default':
      return `${base} — using admin default +${resolution.code}`;
    case 'explicit':
    default:
      return `${base} — using country code from the number`;
  }
};

const fuzzyMatch = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 100;
  if (al.includes(bl) || bl.includes(al)) return 85;
  const aWords = al.split(/\s+/);
  const bWords = bl.split(/\s+/);
  const matchedWords = aWords.filter(w => bWords.some(bw => bw === w || bw.includes(w) || w.includes(bw)));
  if (matchedWords.length > 0) return Math.round((matchedWords.length / Math.max(aWords.length, bWords.length)) * 80);
  let common = 0;
  for (let i = 0; i < Math.min(al.length, bl.length); i++) { if (al[i] === bl[i]) common++; }
  return Math.round((common / Math.max(al.length, bl.length)) * 60);
};

const findBestEmployeeMatch = (csvId: string, csvName: string, employees: EmployeeRecord[]): { matched: EmployeeRecord | null; suggested: EmployeeRecord | null; matchPct: number } => {
  const exactById = employees.find(e => e.ID === csvId);
  if (exactById) return { matched: exactById, suggested: null, matchPct: 100 };
  const exactByName = employees.find(e => e.Name?.toLowerCase() === csvName?.toLowerCase());
  if (exactByName) return { matched: exactByName, suggested: null, matchPct: 100 };
  let bestScore = 0;
  let bestMatch: EmployeeRecord | null = null;
  employees.forEach(e => {
    const nameScore = fuzzyMatch(csvName, e.Name || '');
    const idScore = fuzzyMatch(csvId, e.ID || '');
    const score = Math.max(nameScore, idScore);
    if (score > bestScore) { bestScore = score; bestMatch = e; }
  });
  if (bestScore >= 40) return { matched: null, suggested: bestMatch, matchPct: bestScore };
  return { matched: null, suggested: null, matchPct: 0 };
};

interface TrainingCalendarProps {
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities: Entity[];
  trainers: EmployeeRecord[];
  allEmployees: EmployeeRecord[];
  certTemplateEndpoint?: string;
}

const compressPdfInBackground = (file: File, maxSizeKB: number = 500): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.size <= maxSizeKB * 1024) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      resolve(dataUrl);
    };
    reader.readAsDataURL(file);
  });
};

// --- Sub-Components ---

const CsvReviewModal = ({ 
    stagedData, 
    allEmployees,
    onConfirm, 
    onCancel 
}: { 
    stagedData: any[], 
    allEmployees: EmployeeRecord[],
    onConfirm: (employees: EmployeeRecord[]) => void, 
    onCancel: () => void 
}) => {
    const [rows, setRows] = useState(stagedData);

    const processedRows = useMemo(() => {
        return rows.map(row => {
            const idMatch = allEmployees.find(e => e.ID === row['ID Number']);
            const nameMatch = allEmployees.find(e => e.Name.toLowerCase() === row['Name']?.toLowerCase());
            const match = idMatch || nameMatch;
            return {
                ...row,
                match,
                status: match ? 'Valid' : 'Identity Gap'
            };
        });
    }, [rows, allEmployees]);

    const validMatches = processedRows.filter(r => r.match).map(r => r.match!);

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-200 animate-in zoom-in-95 overflow-hidden text-left">
                <div className="px-10 py-8 bg-[#1e293b] text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <FileUp size={24} className="text-indigo-400" />
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">CSV Registry Review</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Cross-referencing {rows.length} records with Master Roster</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} strokeWidth={3} /></button>
                </div>

                <div className="flex-1 overflow-auto p-8 bg-slate-50 custom-scrollbar">
                    <div className="grid grid-cols-1 gap-3">
                        {processedRows.map((row, idx) => (
                            <div key={idx} className={`bg-white rounded-2xl border-2 p-5 flex items-center justify-between transition-all ${row.match ? 'border-slate-100 hover:border-indigo-200' : 'border-rose-100 bg-rose-50/30'}`}>
                                <div className="flex items-center gap-5">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${row.match ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">{row['Name'] || 'UNKNOWN'}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span>ID: {row['ID Number'] || 'N/A'}</span>
                                            <span className="text-slate-200">•</span>
                                            <span>Dept: {row['Department'] || 'N/A'}</span>
                                            <span className="text-slate-200">•</span>
                                            <span className="text-indigo-600">Unit: {row['Unit Name'] || 'UNSPECIFIED'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {row.match ? (
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest">Master Match</span>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1">{row.match.Unit}</p>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 uppercase tracking-widest">Orphan Node</span>
                                            <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase italic">Not in roster</p>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                    <div className="flex items-center gap-3 text-slate-400">
                        <Info size={18} className="text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Identified <span className="text-slate-900">{validMatches.length} valid nodes</span> to enroll</span>
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button onClick={onCancel} className="flex-1 sm:flex-none px-10 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">Discard</button>
                        <button 
                            disabled={validMatches.length === 0}
                            onClick={() => onConfirm(validMatches)}
                            className="flex-1 sm:flex-none px-16 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
                        >
                            Enroll Validated List
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SearchableSelect = ({ label, options, value, onChange, placeholder, required }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const filtered = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="flex flex-col gap-1 text-left" ref={dropdownRef}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 py-2 text-xs font-black uppercase flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'hover:border-slate-300'} shadow-inner`}
                >
                    <span className={value ? "text-slate-800" : "text-slate-300"}>{value || placeholder}</span>
                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-64">
                        <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    autoFocus
                                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-400 shadow-inner" 
                                    placeholder={`Search ${label}...`}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto p-1 custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map((opt: string) => (
                                    <button 
                                        key={opt}
                                        type="button"
                                        onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                                        className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-colors mb-0.5 hover:bg-indigo-50 ${value === opt ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
                                    >
                                        {opt}
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-[10px] text-slate-400 italic font-bold">No results found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarMultiSelect = ({ label, options, selected, onChange, placeholder }: {
  label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void; placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const toggle = (val: string) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border-2 rounded-2xl px-4 py-2.5 text-xs font-bold bg-white cursor-pointer flex items-center justify-between min-h-[44px] transition-all ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-200 shadow-inner'}`}
        >
          <div className="flex flex-wrap gap-1 flex-1 mr-2">
            {selected.length === 0 && <span className="text-slate-300 uppercase text-[10px] font-black">{placeholder || `All ${label}`}</span>}
            {selected.slice(0, 3).map(v => (
              <span key={v} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-100">
                {v.length > 14 ? v.slice(0, 14) + '…' : v}
                <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }} className="hover:text-red-500 transition-colors"><X size={8} /></button>
              </span>
            ))}
            {selected.length > 3 && <span className="text-[9px] font-black text-indigo-400 px-1">+{selected.length - 3}</span>}
          </div>
          <ChevronDown size={12} className={`text-slate-300 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in duration-100">
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input autoFocus className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400" placeholder={`Search ${label.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48 p-1">
              {filtered.length > 0 ? filtered.map(opt => (
                <button key={opt} type="button" onClick={() => toggle(opt)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-2 ${selected.includes(opt) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selected.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {selected.includes(opt) && <Check size={8} className="text-white" />}
                  </div>
                  {opt}
                </button>
              )) : <div className="px-3 py-4 text-[10px] text-slate-400 text-center italic">No matches</div>}
            </div>
            {selected.length > 0 && (
              <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                <button type="button" onClick={() => { onChange([]); setSearch(''); }} className="text-[9px] font-black text-red-500 hover:text-red-600 px-2 py-1 uppercase">Clear ({selected.length})</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MultiUnitSelector = ({ entities, selected, onChange, rootId, scope }: { entities: Entity[], selected: string[], onChange: (ids: string[]) => void, rootId: string, scope: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const hierarchy = useMemo(() => {
        let relevantRegions: Entity[] = [];
        if (scope === 'super-admin' || scope === 'corporate') {
            const corpId = scope === 'corporate' ? rootId : (entities.find(e => e.type === 'corporate')?.id || '');
            relevantRegions = entities.filter(e => e.type === 'regional' && e.parentId === corpId);
        } else if (scope === 'regional') {
            relevantRegions = entities.filter(e => e.id === rootId);
        }

        return relevantRegions.map(reg => ({
            ...reg,
            units: entities.filter(e => e.type === 'unit' && e.parentId === reg.id)
        })).filter(reg => reg.units.length > 0);
    }, [entities, rootId, scope]);

    const toggleUnit = (id: string) => {
        if (selected.includes(id)) onChange(selected.filter(i => i !== id));
        else onChange([...selected, id]);
    };

    const toggleRegion = (regionUnits: Entity[]) => {
        const regionIds = regionUnits.map(u => u.id);
        const allSelected = regionIds.every(id => selected.includes(id));
        if (allSelected) {
            onChange(selected.filter(id => !regionIds.includes(id)));
        } else {
            onChange([...new Set([...selected, ...regionIds])]);
        }
    };

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const selectedCount = selected.length;

    return (
        <div className="flex flex-col gap-1 w-full text-left" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">
                Target Entities (Multi-Unit Assignment) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className={`min-h-[56px] w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'hover:border-slate-300'} shadow-inner`}
                >
                    <div className="flex flex-wrap gap-1.5 flex-1 pr-2">
                        {selectedCount > 0 ? (
                            <>
                                <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-sm animate-in zoom-in">
                                    <Globe size={10} /> {selectedCount} Units Selected
                                </span>
                                {selectedCount <= 3 && selected.map(id => (
                                    <span key={id} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-bold uppercase truncate max-w-[120px]">
                                        {entities.find(u => u.id === id)?.name}
                                    </span>
                                ))}
                            </>
                        ) : <span className="text-slate-300 text-sm font-bold italic">Select destination units across regions...</span>}
                    </div>
                    <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-2 flex flex-col max-h-[400px]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Organizational Node Explorer</span>
                            <button onClick={() => onChange([])} className="text-[9px] font-black uppercase text-rose-500 hover:underline">Clear All</button>
                        </div>
                        <div className="overflow-y-auto p-4 custom-scrollbar space-y-6 text-left">
                            {hierarchy.map(reg => {
                                const regionUnitIds = reg.units.map(u => u.id);
                                const isRegionFull = regionUnitIds.every(id => selected.includes(id));
                                const isRegionPartial = !isRegionFull && regionUnitIds.some(id => selected.includes(id));

                                return (
                                    <div key={reg.id} className="space-y-3">
                                        <div 
                                            onClick={() => toggleRegion(reg.units)}
                                            className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-2 rounded-xl transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isRegionFull ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                                    {isRegionFull ? <Check size={12} strokeWidth={4} className="text-white" /> : isRegionPartial ? <div className="w-2 h-0.5 bg-indigo-400" /> : null}
                                                </div>
                                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{reg.name}</span>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{reg.units.length} Units</span>
                                        </div>
                                        <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {reg.units.map(unit => {
                                                const isSel = selected.includes(unit.id);
                                                return (
                                                    <div 
                                                        key={unit.id}
                                                        onClick={() => toggleUnit(unit.id)}
                                                        className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${isSel ? 'border-indigo-500 bg-indigo-50/50' : 'border-transparent bg-slate-50 hover:border-slate-200'}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                                            {isSel && <Check size={10} strokeWidth={4} className="text-white" />}
                                                        </div>
                                                        <span className={`text-[10px] font-bold uppercase truncate ${isSel ? 'text-indigo-900' : 'text-slate-600'}`}>{unit.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                             <button onClick={() => setIsOpen(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Confirm Selection</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const StaffSelectorDropdown = ({ employees, onAdd, existingIds }: { 
    employees: EmployeeRecord[], 
    onAdd: (selected: EmployeeRecord[]) => void,
    existingIds: string[]
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        return employees
            .filter(e => !existingIds.includes(e.id))
            .filter(e => e.Name.toLowerCase().includes(search.toLowerCase()) || e.ID.toLowerCase().includes(search.toLowerCase()));
    }, [employees, search, existingIds]);

    const handleToggle = (id: string) => {
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleCommit = () => {
        const toAdd = employees.filter(e => selected.includes(e.id));
        onAdd(toAdd);
        setSelected([]);
        setSearch("");
        setIsOpen(false);
    };

    const selectedNames = useMemo(() => {
        return employees.filter(e => selected.includes(e.id)).map(e => e.Name);
    }, [selected, employees]);

    return (
        <div className="flex flex-col lg:flex-row items-center gap-4 w-full md:w-auto text-left" ref={containerRef}>
            <div className="relative w-full md:w-auto">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="h-12 px-6 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest min-w-[280px] hover:border-indigo-400 transition-all shadow-inner"
                >
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-indigo-500" />
                        <span className={selected.length > 0 ? 'text-slate-900' : 'text-slate-400'}>
                            {selected.length > 0 ? `${selected.length} Selected` : 'Select Personnel...'}
                        </span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
                        <div className="p-3 border-b border-slate-50 bg-slate-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                                <input 
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-[10px] font-black outline-none focus:border-indigo-500 uppercase"
                                    placeholder="Search Name or ID..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 text-left">
                            {filtered.length > 0 ? filtered.map(emp => {
                                const isSel = selected.includes(emp.id);
                                return (
                                    <div 
                                        key={emp.id} 
                                        onClick={() => handleToggle(emp.id)}
                                        className={`px-4 py-3 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between group transition-colors ${isSel ? 'bg-indigo-50/50' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">{emp.Name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none truncate">{emp.ID} • {emp.Department}</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                            {isSel && <Check size={12} strokeWidth={4} />}
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="p-10 text-center text-slate-300 text-[10px] font-black uppercase">Zero Candidates</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {selected.length > 0 && (
                <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 animate-in slide-in-from-left-2">
                    <div className="flex -space-x-2">
                        {selected.slice(0, 3).map((uid) => (
                             <div key={uid} className="w-7 h-7 rounded-full border-2 border-white bg-indigo-600 flex items-center justify-center text-[9px] font-black text-white uppercase shadow-sm">
                                {employees.find(e => e.id === uid)?.Name.charAt(0)}
                             </div>
                        ))}
                    </div>
                    <div className="min-w-0">
                         <p className="text-[9px] font-black text-indigo-400 uppercase leading-none mb-1">Live Selection</p>
                         <p className="text-[11px] font-black text-indigo-800 truncate max-w-[150px]">
                            {selectedNames.join(", ")}
                         </p>
                    </div>
                    <button 
                        onClick={handleCommit}
                        className="ml-2 h-9 px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                    >
                        Enroll {selected.length}
                    </button>
                </div>
            )}
        </div>
    );
};

const StaffMemberRow: React.FC<{ 
    employee: EmployeeRecord, 
    status: 'present' | 'absent' | 'neutral',
    onStatusChange: (status: 'present' | 'absent' | 'neutral') => void,
    onRemove?: () => void,
    onCertificate?: () => void,
    onEmailCertificate?: () => void,
    emailingCert?: boolean,
    onWhatsAppCertificate?: () => void,
    whatsappingCert?: boolean,
}> = ({ employee, status, onStatusChange, onRemove, onCertificate, onEmailCertificate, emailingCert, onWhatsAppCertificate, whatsappingCert }) => {
    const initials = employee.Name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    return (
        <div className="flex flex-col lg:flex-row items-center gap-8 p-6 lg:p-8 border-b border-slate-100 last:border-0 hover:bg-indigo-50/20 transition-all group/row text-left">
            <div className="w-full lg:w-48 shrink-0">
                <h4 className="text-[13px] font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">{employee.Corporate}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-none mb-1">{employee.Regional}</p>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none truncate">{employee.Unit}</p>
            </div>

            <div className="w-16 h-16 rounded-full bg-[#dbeafe] border-2 border-white shadow-md flex items-center justify-center text-[#2563eb] font-black text-lg shrink-0 group-hover/row:scale-105 transition-transform">
                {initials}
            </div>

            <div className="flex-1 min-w-0 w-full">
                <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-2.5">{employee.Name}</h4>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                    <span className="flex items-center gap-1.5"><IdCard size={14} className="text-slate-300"/> ID: {employee.ID}</span>
                    <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-300"/> {employee.Gender}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-300"/> Joined: {employee.JoinedDate}</span>
                </div>
            </div>

            <div className="w-full lg:w-56 space-y-2 shrink-0">
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600 group/link cursor-pointer">
                    <div className="p-1.5 bg-white border border-slate-100 rounded-lg group-hover/link:border-indigo-200 group-hover/link:bg-indigo-50 transition-all">
                        <Mail size={12} className="text-slate-400 group-hover/link:text-indigo-600" />
                    </div>
                    <span className="truncate group-hover/link:text-indigo-600 transition-colors">{employee.Email}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600 group/link cursor-pointer">
                    <div className="p-1.5 bg-white border border-slate-100 rounded-lg group-hover/link:border-indigo-200 group-hover/link:bg-indigo-50 transition-all">
                        <Phone size={12} className="text-slate-400 group-hover/link:text-indigo-600" />
                    </div>
                    <span className="group-hover/link:text-indigo-600 transition-colors">{employee.Phone}</span>
                </div>
            </div>

            <div className="w-full lg:w-48 shrink-0 space-y-3">
                <div>
                    <h5 className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{employee.Department}</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{employee.Role}</p>
                </div>
            </div>

            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 lg:gap-4">
                <div className="space-y-2 w-full">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attendance Matrix</h5>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full">
                        {[
                            { id: 'present', label: 'Present', color: 'bg-emerald-600' },
                            { id: 'neutral', label: 'Neutral', color: 'bg-slate-600' },
                            { id: 'absent', label: 'Absent', color: 'bg-rose-600' }
                        ].map((btn) => (
                            <button 
                                key={btn.id}
                                onClick={() => onStatusChange(btn.id as any)}
                                className={`min-w-0 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all truncate ${status === btn.id ? `${btn.color} text-white shadow-md` : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {status === 'present' && onCertificate && (
                        <button
                            onClick={onCertificate}
                            title="Generate Certificate"
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                        >
                            <Award size={13} /> Certificate
                        </button>
                    )}
                    {status === 'present' && onEmailCertificate && employee.Email && (
                        <button
                            onClick={onEmailCertificate}
                            disabled={emailingCert}
                            title={`Email certificate to ${employee.Email}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white border border-amber-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-60 disabled:cursor-wait"
                        >
                            {emailingCert ? <><Loader2 size={13} className="animate-spin" /> Sending</> : <><Mail size={13} /> Email Cert</>}
                        </button>
                    )}
                    {status === 'present' && onWhatsAppCertificate && employee.Phone && (
                        <button
                            onClick={onWhatsAppCertificate}
                            disabled={whatsappingCert}
                            title={`Send certificate via WhatsApp to ${employee.Phone}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366] text-white border border-[#25D366] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[#1ebe57] transition-all disabled:opacity-60 disabled:cursor-wait"
                        >
                            {whatsappingCert ? <><Loader2 size={13} className="animate-spin" /> Sending</> : <>WA Cert</>}
                        </button>
                    )}
                    {onRemove && (
                        <button 
                            onClick={onRemove}
                            className="p-3 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover/row:opacity-100"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const CouponTrackerPanel: React.FC<{ email: string; onClose: () => void }> = ({ email, onClose }) => {
    const [coupons, setCoupons] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCoupon, setExpandedCoupon] = useState<string | null>(null);
    const [usages, setUsages] = useState<Record<string, any[]>>({});
    const [usageLoading, setUsageLoading] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        // BUG FIX: this endpoint requires admin auth via `x-admin-token`.
        // Without the header the API returns 401 and the panel renders
        // "No coupons found" — even though the same coupon shows up
        // correctly in the LMS Admin → User List Coupon Tracker (which
        // does send the token). Pass the token here so the two views
        // stay in sync.
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        fetch(`/api/academy/affiliate-coupons/track?email=${encodeURIComponent(email)}`, {
            headers: { 'x-admin-token': adminToken },
        })
            .then(r => r.json())
            .then(d => setCoupons(d.coupons || []))
            .catch(() => setCoupons([]))
            .finally(() => setLoading(false));
    }, [email]);

    const loadUsages = async (couponCode: string) => {
        if (usages[couponCode]) { setExpandedCoupon(expandedCoupon === couponCode ? null : couponCode); return; }
        setUsageLoading(couponCode);
        setExpandedCoupon(couponCode);
        try {
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const r = await fetch(`/api/academy/affiliate-coupons/track?coupon_code=${encodeURIComponent(couponCode)}`, {
                headers: { 'x-admin-token': adminToken },
            });
            const d = await r.json();
            setUsages(prev => ({ ...prev, [couponCode]: d.usages || [] }));
        } catch { setUsages(prev => ({ ...prev, [couponCode]: [] })); }
        setUsageLoading(null);
    };

    const fmtDate = (d: string | null) => d ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="mt-3 bg-gradient-to-br from-violet-50/80 to-indigo-50/60 border-2 border-violet-200 rounded-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between px-5 py-3 bg-violet-100/60 border-b border-violet-200">
                <div className="flex items-center gap-2">
                    <Ticket size={14} className="text-violet-600" />
                    <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Coupon Tracker</span>
                    <span className="px-2 py-0.5 bg-violet-200 text-violet-800 rounded-full text-[8px] font-black">{coupons.length}</span>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-violet-200 rounded-lg transition-colors"><X size={14} className="text-violet-500" /></button>
            </div>
            {loading ? (
                <div className="py-8 text-center"><Loader2 size={16} className="animate-spin text-violet-400 mx-auto" /></div>
            ) : coupons.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-slate-400 font-bold">No coupons found for this user</div>
            ) : (
                <div className="p-3 space-y-2">
                    {coupons.map((c: any) => (
                        <div key={c.id}>
                            <button
                                onClick={() => loadUsages(c.code)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${expandedCoupon === c.code ? 'bg-white border-violet-300 shadow-md' : 'bg-white/70 border-transparent hover:border-violet-200 hover:bg-white'}`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-black tracking-widest">{c.code}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{c.active ? 'Active' : 'Inactive'}</span>
                                    <ChevronDown size={12} className={`ml-auto text-violet-400 transition-transform ${expandedCoupon === c.code ? 'rotate-180' : ''}`} />
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[9px]">
                                    <div>
                                        <p className="font-black text-slate-400 uppercase tracking-widest mb-0.5">Training</p>
                                        <p className="font-bold text-slate-700 truncate">{c.sessionTitle}</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-400 uppercase tracking-widest mb-0.5">Generated</p>
                                        <p className="font-bold text-slate-700">{fmtDate(c.createdAt)}</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-400 uppercase tracking-widest mb-0.5">Discount / Earn</p>
                                        <p className="font-bold text-slate-700">₹{c.discountAmount.toLocaleString('en-IN')} / ₹{c.commissionAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-400 uppercase tracking-widest mb-0.5">Used / Max</p>
                                        <p className="font-bold text-slate-700">{c.currentUses} / {c.maxUses} <span className="text-emerald-600">(₹{c.totalCommissionEarned.toLocaleString('en-IN')} earned)</span></p>
                                    </div>
                                </div>
                            </button>
                            {expandedCoupon === c.code && (
                                <div className="ml-4 mt-1 mb-2 border-l-2 border-violet-200 pl-3 space-y-1">
                                    {usageLoading === c.code ? (
                                        <div className="py-4 text-center"><Loader2 size={14} className="animate-spin text-violet-300 mx-auto" /></div>
                                    ) : (usages[c.code] || []).length === 0 ? (
                                        <p className="py-3 text-[10px] text-slate-400 font-bold">No one has used this coupon yet</p>
                                    ) : (usages[c.code] || []).map((u: any, i: number) => (
                                        <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 hover:border-violet-200 transition-all">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[9px] font-black shrink-0">
                                                    {(u.enrolleeName || '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black text-slate-800 truncate">{u.enrolleeName}</p>
                                                    <p className="text-[9px] text-slate-400 truncate">{u.enrolleeEmail}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 text-[8px]">
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Reg Date</p>
                                                    <p className="font-bold text-slate-600">{fmtDate(u.registrationDate)}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Training Date</p>
                                                    <p className="font-bold text-slate-600">{fmtDate(u.trainingDate)}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Training</p>
                                                    <p className="font-bold text-slate-600 truncate">{u.trainingName}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Fees</p>
                                                    <p className="font-bold text-slate-600">₹{u.courseFee.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Discount</p>
                                                    <p className="font-bold text-violet-600">₹{u.couponDiscount.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-400 uppercase tracking-widest">Earned</p>
                                                    <p className="font-bold text-emerald-600">₹{u.commissionEarned.toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RegistrantPhoneCell: React.FC<{
    registrant: any;
    defaultWaCode?: string;
    regionDefaultWaCode?: string | null;
    onUpdateContact?: (id: string, next: { whatsapp?: string; mobile?: string }) => Promise<void> | void;
}> = ({ registrant: r, defaultWaCode, regionDefaultWaCode, onUpdateContact }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const open = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setDraft(r.whatsapp || r.mobile || '');
        setError(null);
        setEditing(true);
    };
    const save = async () => {
        if (!onUpdateContact || saving) return;
        const next = draft.trim();
        setSaving(true);
        setError(null);
        try {
            await onUpdateContact(r.id, { whatsapp: next, mobile: next });
            setEditing(false);
        } catch (err: any) {
            setError(err?.message?.slice(0, 60) || 'Save failed');
        } finally {
            setSaving(false);
        }
    };
    if (editing) {
        return (
            <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                    type="tel"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); save(); }
                        if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                    }}
                    disabled={saving}
                    placeholder="+91 98765 43210"
                    aria-label="WhatsApp / mobile number"
                    className="px-1.5 py-0.5 text-[10px] font-bold border border-violet-300 rounded outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200 w-40"
                />
                <button type="button" onClick={save} disabled={saving} title="Save" aria-label="Save phone number"
                    className="p-0.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50">
                    {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                </button>
                <button type="button" onClick={() => { if (!saving) setEditing(false); }} disabled={saving} title="Cancel" aria-label="Cancel editing"
                    className="p-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 disabled:opacity-50">
                    <X size={9} />
                </button>
                {error && <span className="text-[8px] font-bold text-rose-500 italic">{error}</span>}
            </span>
        );
    }
    const wa = resolveWaContact(r.whatsapp || r.mobile, { defaultCode: defaultWaCode, regionDefaultCode: regionDefaultWaCode, country: r.country });
    const tip = describeWaResolution(wa, r.name);
    const invalidTip = `Number doesn't match any known country format — click to fix it for ${r.name || 'this learner'}`;
    const warning = wa.invalid ? (
        onUpdateContact ? (
            <button type="button" onClick={open} title={invalidTip} aria-label={invalidTip}
                className="inline-flex items-center justify-center p-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer">
                <AlertCircle size={9} />
            </button>
        ) : (
            <span className="inline-flex items-center justify-center p-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300"
                title={`Number doesn't match any known country format — please verify before messaging ${r.name || 'this learner'}`}
                aria-label={invalidTip} role="img">
                <AlertCircle size={9} />
            </span>
        )
    ) : null;
    const editBtn = onUpdateContact ? (
        <button type="button" onClick={open}
            className="inline-flex items-center justify-center p-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
            title={`Edit phone for ${r.name || 'this learner'}`} aria-label="Edit phone number">
            <Edit size={9} />
        </button>
    ) : null;
    const groupSentBadge = r.groupLinkSentAt ? (
        <span
            title={`WhatsApp group link broadcast on ${new Date(r.groupLinkSentAt).toLocaleString('en-GB')}${r.groupLinkSentBy ? ` by ${r.groupLinkSentBy}` : ''}`}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300 text-[8px] font-black uppercase tracking-wider"
            aria-label={`Group link sent on ${new Date(r.groupLinkSentAt).toLocaleDateString('en-GB')}`}
        >
            <Send size={8} />
            Sent · {new Date(r.groupLinkSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
    ) : null;
    const meetingMailedBadge = r.meetingLinkEmailSentAt ? (
        <span
            title={`Meeting link emailed on ${new Date(r.meetingLinkEmailSentAt).toLocaleString('en-GB')}`}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-300 text-[8px] font-black uppercase tracking-wider"
            aria-label={`Meeting link emailed on ${new Date(r.meetingLinkEmailSentAt).toLocaleDateString('en-GB')}`}
        >
            <Mail size={8} />
            Mailed · {new Date(r.meetingLinkEmailSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
    ) : null;
    if (!wa.url) return <>{groupSentBadge}{meetingMailedBadge}{warning}{editBtn}</>;
    const waUrl = withWaPrefill(wa.url, r.name) || wa.url;
    return (
        <>
            {groupSentBadge}
            {meetingMailedBadge}
            {warning}
            {editBtn}
            {!wa.invalid && wa.source === 'detected' && wa.code && (
                <span className="text-[8px] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300" title={tip}>+{wa.code}?</span>
            )}
            <a href={waUrl} target="whatsapp_web" rel="noopener noreferrer" title={tip} aria-label={tip}
                className="inline-flex items-center justify-center p-0.5 rounded bg-[#25D366] hover:bg-[#1da851] text-white transition-colors"
                onClick={(e) => openWhatsApp(waUrl, e)}>
                <MessageCircle size={9} />
            </a>
        </>
    );
};

interface BatchMember { id: string; name: string; index: number }
const ExternalRegistrantRow: React.FC<{
    registrant: any;
    status: 'present' | 'absent' | 'neutral';
    onStatusChange: (status: 'present' | 'absent' | 'neutral') => void;
    onCertificate?: () => void;
    onEmailCertificate?: () => void;
    emailingCert?: boolean;
    onWhatsAppCertificate?: () => void;
    whatsappingCert?: boolean;
    onEmailMeetingLink?: () => void;
    emailingMeetingLink?: boolean;
    canEmailMeetingLink?: boolean;
    onPaymentVerify?: (id: string, paymentStatus: 'verified' | 'rejected') => void;
    onUpdateContact?: (id: string, next: { whatsapp?: string; mobile?: string }) => Promise<void> | void;
    defaultWaCode?: string;
    regionDefaultWaCode?: string | null;
    batchMembers?: BatchMember[];
}> = ({ registrant, status, onStatusChange, onCertificate, onEmailCertificate, emailingCert, onWhatsAppCertificate, whatsappingCert, onEmailMeetingLink, emailingMeetingLink, canEmailMeetingLink, onPaymentVerify, onUpdateContact, defaultWaCode, regionDefaultWaCode, batchMembers }) => {
    const initials = (registrant.name || '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
    const regDate = registrant.createdAt ? new Date(registrant.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const [showCouponTracker, setShowCouponTracker] = useState(false);
    const paymentStatus = registrant.paymentStatus || (registrant.paymentScreenshot ? 'pending' : null);

    const [resendingField, setResendingField] = useState<string | null>(null);
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const [editingPhone, setEditingPhone] = useState(false);
    const [phoneDraft, setPhoneDraft] = useState<string>('');
    const [savingPhone, setSavingPhone] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const openPhoneEditor = () => {
        setPhoneDraft(registrant.whatsapp || registrant.mobile || '');
        setPhoneError(null);
        setEditingPhone(true);
    };
    const savePhone = async () => {
        if (!onUpdateContact || savingPhone) return;
        const next = phoneDraft.trim();
        setSavingPhone(true);
        setPhoneError(null);
        try {
            await onUpdateContact(registrant.id, { whatsapp: next, mobile: next });
            setEditingPhone(false);
        } catch (err: any) {
            setPhoneError(err?.message?.slice(0, 80) || 'Save failed');
        } finally {
            setSavingPhone(false);
        }
    };
    const resendEmail = async (field: 'emailSentAt' | 'verificationEmailSentAt') => {
        if (resendingField) return;
        setResendingField(field);
        setResendMessage(null);
        try {
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const res = await fetch('/api/training-register/retry-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({ id: registrant.id, field }),
            });
            const data = await res.json().catch(() => ({}));
            const inner = data?.results?.[field];
            if (inner?.ok) {
                setResendMessage('Resent ✓');
            } else {
                setResendMessage(inner?.error?.slice(0, 60) || data?.error || 'Resend failed');
            }
        } catch (err: any) {
            setResendMessage(err?.message?.slice(0, 60) || 'Network error');
        } finally {
            setResendingField(null);
            setTimeout(() => setResendMessage(null), 6000);
        }
    };
    const emailGivenUp = !!registrant.emailSentAtGiveUpAt;
    const verificationGivenUp = !!registrant.verificationEmailSentAtGiveUpAt;
    const emailFailedNotSent = !!registrant.emailSentAtFailedAt && !registrant.emailSentAt;
    const verificationFailedNotSent = !!registrant.verificationEmailSentAtFailedAt && !registrant.verificationEmailSentAt;
    const canResendAny = emailFailedNotSent || verificationFailedNotSent;

    return (
        <div className="border-b border-violet-50 last:border-0 hover:bg-violet-50/30 transition-all group/row text-left bg-violet-50/10">
        <div className="flex flex-col lg:flex-row items-center gap-8 p-6 lg:p-8">
            <div className="w-full lg:w-48 shrink-0">
                <h4 className="text-[13px] font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">{registrant.instituteName || '—'}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] leading-none mb-1">{registrant.profession || '—'}</p>
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none truncate">{registrant.country || '—'}</p>
            </div>

            <div className="w-16 h-16 rounded-full bg-violet-100 border-2 border-white shadow-md flex items-center justify-center text-violet-600 font-black text-lg shrink-0 group-hover/row:scale-105 transition-transform">
                {initials}
            </div>

            <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-3 flex-wrap mb-2.5">
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate leading-none">{registrant.name}</h4>
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-600 rounded-lg text-[8px] font-black uppercase tracking-wider">Self-Registered</span>
                    {registrant.groupLinkSentAt && (
                        <span
                            title={`WhatsApp group link broadcast on ${new Date(registrant.groupLinkSentAt).toLocaleString('en-GB')}${registrant.groupLinkSentBy ? ` by ${registrant.groupLinkSentBy}` : ''}`}
                            className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        >
                            <Send size={9} className="shrink-0" />
                            Group Link · {new Date(registrant.groupLinkSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                    {registrant.meetingLinkEmailSentAt && (
                        <span
                            title={`Meeting link emailed on ${new Date(registrant.meetingLinkEmailSentAt).toLocaleString('en-GB')}`}
                            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        >
                            <Mail size={9} className="shrink-0" />
                            Meeting · {new Date(registrant.meetingLinkEmailSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                    {registrant.certificateEmailSentAt && (
                        <span
                            title={`Certificate emailed on ${new Date(registrant.certificateEmailSentAt).toLocaleString('en-GB')}`}
                            className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[8px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                        >
                            <Award size={9} className="shrink-0" />
                            Cert · {new Date(registrant.certificateEmailSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                    {(() => {
                        const size = Number(registrant.batchSize) || 0;
                        const idx  = Number(registrant.batchIndex) || 0;
                        if (size <= 1 || idx < 1) return null;
                        const others = (batchMembers || [])
                            .filter(m => m.id !== registrant.id)
                            .sort((a, b) => a.index - b.index);
                        const tooltipLines = [
                            registrant.batchId ? `Batch ID: ${registrant.batchId}` : 'Corporate batch booking',
                            ...(others.length > 0
                                ? ['Other participants in this batch:', ...others.map(o => `  ${o.index}. ${o.name}`)]
                                : []),
                        ];
                        return (
                            <span
                                title={tooltipLines.join('\n')}
                                className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
                            >
                                <Users size={9} /> Batch {idx}/{size}
                            </span>
                        );
                    })()}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><IdCard size={14} className="text-slate-300"/> External</span>
                    <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-300"/> {registrant.gender || '—'}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-300"/> Registered: {regDate}</span>
                </div>
            </div>

            <div className="w-full lg:w-56 space-y-2 shrink-0">
                {/* Email row with sent status */}
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <div className={`p-1.5 rounded-lg border transition-all ${registrant.emailSentAt ? 'bg-emerald-50 border-emerald-200' : emailGivenUp ? 'bg-rose-100 border-rose-300' : registrant.emailSentAtFailedAt ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                        <Mail size={12} className={registrant.emailSentAt ? 'text-emerald-500' : emailGivenUp ? 'text-rose-700' : registrant.emailSentAtFailedAt ? 'text-red-500' : 'text-slate-400'} />
                    </div>
                    <span className="truncate flex-1">{registrant.email || '—'}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                        {registrant.emailSentAt
                            ? <span title={`Registration email sent ${new Date(registrant.emailSentAt).toLocaleDateString('en-GB')}`}><CheckCircle size={13} className="text-emerald-500" /></span>
                            : emailGivenUp
                                ? <span title={`Email GAVE UP after ${registrant.emailSentAtAttempts || '?'} attempts — ${registrant.emailSentAtError?.message || 'unknown error'}`} className="px-1 py-0.5 bg-rose-600 text-white rounded text-[8px] font-black uppercase tracking-widest">Give Up</span>
                                : registrant.emailSentAtFailedAt
                                    ? <span title={`Email FAILED ${new Date(registrant.emailSentAtFailedAt).toLocaleString('en-GB')} — attempt ${registrant.emailSentAtAttempts || 1}/5${registrant.emailSentAtNextRetryAt ? ' — next retry ' + new Date(registrant.emailSentAtNextRetryAt).toLocaleString('en-GB') : ''} — ${registrant.emailSentAtError?.message || 'unknown error'}`}><XCircle size={13} className="text-red-500" /></span>
                                    : <span title="Registration email not yet sent"><XCircle size={13} className="text-slate-300" /></span>}
                        {registrant.verificationEmailSentAt
                            ? <span title={`Verification email sent ${new Date(registrant.verificationEmailSentAt).toLocaleDateString('en-GB')}`}><CheckCircle size={13} className="text-indigo-500" /></span>
                            : verificationGivenUp
                                ? <span title={`Verification email GAVE UP after ${registrant.verificationEmailSentAtAttempts || '?'} attempts — ${registrant.verificationEmailSentAtError?.message || 'unknown error'}`} className="px-1 py-0.5 bg-rose-600 text-white rounded text-[8px] font-black uppercase tracking-widest">Give Up</span>
                                : registrant.verificationEmailSentAtFailedAt
                                    ? <span title={`Verification email FAILED ${new Date(registrant.verificationEmailSentAtFailedAt).toLocaleString('en-GB')} — attempt ${registrant.verificationEmailSentAtAttempts || 1}/5${registrant.verificationEmailSentAtNextRetryAt ? ' — next retry ' + new Date(registrant.verificationEmailSentAtNextRetryAt).toLocaleString('en-GB') : ''} — ${registrant.verificationEmailSentAtError?.message || 'unknown error'}`}><XCircle size={13} className="text-red-500" /></span>
                                    : null}
                    </div>
                </div>
                {canResendAny && (
                    <div className="flex flex-col gap-1">
                        {emailFailedNotSent && (
                            <button
                                type="button"
                                onClick={() => resendEmail('emailSentAt')}
                                disabled={resendingField === 'emailSentAt'}
                                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border w-full ${emailGivenUp ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'} disabled:opacity-50`}
                                title={emailGivenUp ? 'Force resend after give-up' : 'Resend registration email'}
                            >
                                {resendingField === 'emailSentAt'
                                    ? <Loader2 size={10} className="animate-spin" />
                                    : <RefreshCw size={10} />}
                                {emailGivenUp ? 'Force Resend Reg' : 'Resend Reg Email'}
                            </button>
                        )}
                        {verificationFailedNotSent && (
                            <button
                                type="button"
                                onClick={() => resendEmail('verificationEmailSentAt')}
                                disabled={resendingField === 'verificationEmailSentAt'}
                                className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border w-full ${verificationGivenUp ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'} disabled:opacity-50`}
                                title={verificationGivenUp ? 'Force resend after give-up' : 'Resend payment-verified email'}
                            >
                                {resendingField === 'verificationEmailSentAt'
                                    ? <Loader2 size={10} className="animate-spin" />
                                    : <RefreshCw size={10} />}
                                {verificationGivenUp ? 'Force Resend Verif' : 'Resend Verif Email'}
                            </button>
                        )}
                        {resendMessage && (
                            <span className="text-[8px] font-bold text-slate-500 italic text-center">{resendMessage}</span>
                        )}
                    </div>
                )}
                {/* WhatsApp row with sent status */}
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <div className={`p-1.5 rounded-lg border transition-all ${registrant.whatsappSentAt ? 'bg-[#25D366]/10 border-[#25D366]/30' : 'bg-white border-slate-100'}`}>
                        <MessageCircle size={12} className={registrant.whatsappSentAt ? 'text-[#25D366]' : 'text-slate-400'} />
                    </div>
                    {editingPhone ? (
                        <span className="flex-1 flex items-center gap-1">
                            <input
                                type="tel"
                                autoFocus
                                value={phoneDraft}
                                onChange={(e) => setPhoneDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); savePhone(); }
                                    if (e.key === 'Escape') { e.preventDefault(); setEditingPhone(false); }
                                }}
                                disabled={savingPhone}
                                placeholder="+91 98765 43210"
                                aria-label="WhatsApp / mobile number"
                                className="flex-1 min-w-0 px-2 py-1 text-[11px] font-bold border-2 border-violet-200 rounded-lg outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                            />
                            <button
                                type="button"
                                onClick={savePhone}
                                disabled={savingPhone}
                                title="Save"
                                aria-label="Save phone number"
                                className="shrink-0 p-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                            >
                                {savingPhone ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => { if (!savingPhone) setEditingPhone(false); }}
                                disabled={savingPhone}
                                title="Cancel"
                                aria-label="Cancel editing"
                                className="shrink-0 p-1 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-600 disabled:opacity-50"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ) : (
                        <span className="flex-1">{registrant.whatsapp || registrant.mobile || '—'}</span>
                    )}
                    {!editingPhone && onUpdateContact && (() => {
                        const wa = resolveWaContact(registrant.whatsapp || registrant.mobile, { defaultCode: defaultWaCode, regionDefaultCode: regionDefaultWaCode, country: registrant.country });
                        const tip = describeWaResolution(wa, registrant.name);
                        const invalidTip = `Number doesn't match any known country format — click to fix it for ${registrant.name || 'this learner'}`;
                        const warning = wa.invalid ? (
                            <button
                                type="button"
                                onClick={openPhoneEditor}
                                className="shrink-0 inline-flex items-center justify-center p-1 rounded-md bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                                title={invalidTip}
                                aria-label={invalidTip}
                            >
                                <AlertCircle size={11} />
                            </button>
                        ) : null;
                        const editBtn = (
                            <button
                                type="button"
                                onClick={openPhoneEditor}
                                className="shrink-0 inline-flex items-center justify-center p-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
                                title={`Edit phone for ${registrant.name || 'this learner'}`}
                                aria-label="Edit phone number"
                            >
                                <Edit size={11} />
                            </button>
                        );
                        if (!wa.url) return <>{warning}{editBtn}</>;
                        const waUrl = withWaPrefill(wa.url, registrant.name) || wa.url;
                        return (
                            <>
                                {warning}
                                {editBtn}
                                {!wa.invalid && wa.source === 'detected' && wa.code && (
                                    <span
                                        className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300"
                                        title={tip}
                                    >+{wa.code}?</span>
                                )}
                                <a
                                    href={waUrl}
                                    target="whatsapp_web"
                                    rel="noopener noreferrer"
                                    title={tip}
                                    aria-label={tip}
                                    className="shrink-0 p-1 rounded-md bg-[#25D366] hover:bg-[#1da851] text-white transition-colors flex items-center justify-center"
                                    onClick={(e) => openWhatsApp(waUrl, e)}
                                >
                                    <MessageCircle size={11} />
                                </a>
                            </>
                        );
                    })()}
                    {!editingPhone && !onUpdateContact && (() => {
                        const wa = resolveWaContact(registrant.whatsapp || registrant.mobile, { defaultCode: defaultWaCode, regionDefaultCode: regionDefaultWaCode, country: registrant.country });
                        const tip = describeWaResolution(wa, registrant.name);
                        const invalidTip = `Number doesn't match any known country format — please verify before messaging ${registrant.name || 'this learner'}`;
                        const warning = wa.invalid ? (
                            <span
                                className="shrink-0 inline-flex items-center justify-center p-1 rounded-md bg-amber-100 text-amber-700 border border-amber-300"
                                title={invalidTip}
                                aria-label={invalidTip}
                                role="img"
                            >
                                <AlertCircle size={11} />
                            </span>
                        ) : null;
                        if (!wa.url) return warning;
                        const waUrl = withWaPrefill(wa.url, registrant.name) || wa.url;
                        return (
                            <>
                                {warning}
                                {!wa.invalid && wa.source === 'detected' && wa.code && (
                                    <span
                                        className="shrink-0 text-[8px] font-black px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300"
                                        title={tip}
                                    >+{wa.code}?</span>
                                )}
                                <a
                                    href={waUrl}
                                    target="whatsapp_web"
                                    rel="noopener noreferrer"
                                    title={tip}
                                    aria-label={tip}
                                    className="shrink-0 p-1 rounded-md bg-[#25D366] hover:bg-[#1da851] text-white transition-colors flex items-center justify-center"
                                    onClick={(e) => openWhatsApp(waUrl, e)}
                                >
                                    <MessageCircle size={11} />
                                </a>
                            </>
                        );
                    })()}
                    <div className="flex items-center gap-0.5 shrink-0">
                        {registrant.whatsappSentAt
                            ? <span title={`Registration WhatsApp sent ${new Date(registrant.whatsappSentAt).toLocaleDateString('en-GB')}`}><CheckCircle size={13} className="text-emerald-500" /></span>
                            : <span title="Registration WhatsApp not sent"><XCircle size={13} className="text-slate-300" /></span>}
                        {registrant.verificationWaSentAt
                            ? <span title={`Verification WhatsApp sent ${new Date(registrant.verificationWaSentAt).toLocaleDateString('en-GB')}`}><CheckCircle size={13} className="text-indigo-500" /></span>
                            : null}
                    </div>
                </div>
                {registrant.utrNumber && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-[9px] font-black uppercase tracking-widest w-full">
                        <Hash size={12} className="shrink-0" />
                        UTR: <span className="font-black tracking-[0.15em] select-all">{registrant.utrNumber}</span>
                    </div>
                )}
                {registrant.paymentScreenshot ? (
                    <div className="space-y-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                const win = window.open('', '_blank');
                                if (win) {
                                    win.document.write(`<!DOCTYPE html><html><head><title>Payment Proof – ${registrant.name}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px}img{max-width:100vw;max-height:100vh;object-fit:contain}p{color:#666;font:11px/1 sans-serif;text-transform:uppercase;letter-spacing:.1em}</style></head><body><img src="${registrant.paymentScreenshot}" alt="Payment proof"/><p>${registrant.name} · Payment Evidence · UTR: ${registrant.utrNumber || 'N/A'}</p></body></html>`);
                                    win.document.close();
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 hover:border-emerald-300 transition-all w-full"
                        >
                            <ImgIcon size={12} className="shrink-0" />
                            View Payment Proof
                            <ExternalLink size={10} className="ml-auto shrink-0 opacity-60" />
                        </button>
                        {paymentStatus && (
                            <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                    paymentStatus === 'verified' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                    paymentStatus === 'rejected' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                    'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {paymentStatus === 'verified' ? '✓ Verified' : paymentStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                                </span>
                                {paymentStatus !== 'verified' && onPaymentVerify && (
                                    <button onClick={() => onPaymentVerify(registrant.id, 'verified')}
                                        className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">
                                        Verify
                                    </button>
                                )}
                                {paymentStatus !== 'rejected' && onPaymentVerify && (
                                    <button onClick={() => onPaymentVerify(registrant.id, 'rejected')}
                                        className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
                                        Reject
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest w-full">
                        <ImgIcon size={12} className="shrink-0" />
                        No Payment Proof
                    </div>
                )}
            </div>

            <div className="w-full lg:w-48 shrink-0 space-y-3">
                <div>
                    <h5 className="text-[12px] font-black text-slate-800 uppercase tracking-tight leading-none mb-1">{registrant.designation || '—'}</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trainee</p>
                </div>
            </div>

            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3 lg:gap-4">
                <div className="space-y-2 w-full">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Attendance Matrix</h5>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner w-full">
                        {[
                            { id: 'present', label: 'Present', color: 'bg-emerald-600' },
                            { id: 'neutral', label: 'Neutral', color: 'bg-slate-600' },
                            { id: 'absent', label: 'Absent', color: 'bg-rose-600' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => onStatusChange(btn.id as any)}
                                className={`min-w-0 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all truncate ${status === btn.id ? `${btn.color} text-white shadow-md` : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>
                {status === 'present' && onCertificate && (
                    <button
                        onClick={onCertificate}
                        title="Generate Certificate"
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all mt-2 w-full justify-center"
                    >
                        <Award size={13} /> Certificate
                    </button>
                )}
                {status === 'present' && onEmailCertificate && registrant.email && (() => {
                    // Distinct color states so the admin can scan the list at
                    // a glance: amber-filled when not yet sent (action needed),
                    // green outlined when already sent (re-send if needed).
                    const alreadySent = !!registrant.certificateEmailSentAt;
                    const sentDate = alreadySent
                        ? new Date(registrant.certificateEmailSentAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '';
                    const cls = alreadySent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
                    return (
                        <button
                            onClick={onEmailCertificate}
                            disabled={emailingCert}
                            title={alreadySent
                                ? `Already emailed on ${new Date(registrant.certificateEmailSentAt!).toLocaleString('en-GB')}. Click to resend.`
                                : `Email certificate to ${registrant.email}`}
                            className={`flex items-center gap-1.5 px-3 py-2 ${cls} border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all mt-2 w-full justify-center disabled:opacity-60 disabled:cursor-wait`}
                        >
                            {emailingCert
                                ? <><Loader2 size={13} className="animate-spin" /> Sending</>
                                : alreadySent
                                    ? <><Check size={13} /> Sent · {sentDate} · Resend</>
                                    : <><Mail size={13} /> Email Cert</>
                            }
                        </button>
                    );
                })()}
                {status === 'present' && onWhatsAppCertificate && (registrant.whatsapp || registrant.mobile) && (() => {
                    // WhatsApp certificate send mirrors the email button above.
                    // Sent state shows the date so admins can quickly tell who
                    // received the document and resend if a participant lost it.
                    const alreadySent = !!registrant.certificateWhatsAppSentAt;
                    const sentDate = alreadySent
                        ? new Date(registrant.certificateWhatsAppSentAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '';
                    const cls = alreadySent
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-[#25D366] text-white border-[#25D366] hover:bg-[#1ebe57]';
                    const phoneShown = registrant.whatsapp || registrant.mobile;
                    return (
                        <button
                            onClick={onWhatsAppCertificate}
                            disabled={whatsappingCert}
                            title={alreadySent
                                ? `Already sent on WhatsApp on ${new Date(registrant.certificateWhatsAppSentAt!).toLocaleString('en-GB')}. Click to resend.`
                                : `Send certificate via WhatsApp to ${phoneShown}`}
                            className={`flex items-center gap-1.5 px-3 py-2 ${cls} border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all mt-2 w-full justify-center disabled:opacity-60 disabled:cursor-wait`}
                        >
                            {whatsappingCert
                                ? <><Loader2 size={13} className="animate-spin" /> Sending</>
                                : alreadySent
                                    ? <><Check size={13} /> WA · {sentDate} · Resend</>
                                    : <>WA Cert</>
                            }
                        </button>
                    );
                })()}
                {/* Single-recipient meeting-link send. Useful for late
                    registrants who joined after the bulk broadcast went
                    out — same link, same template, just one row at a time. */}
                {onEmailMeetingLink && registrant.email && canEmailMeetingLink && (
                    <button
                        onClick={onEmailMeetingLink}
                        disabled={!!emailingMeetingLink}
                        title={
                            registrant.meetingLinkEmailSentAt
                                ? `Meeting link last sent ${new Date(registrant.meetingLinkEmailSentAt).toLocaleString('en-GB')} — click to resend`
                                : `Send the joining link to ${registrant.email}`
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all mt-2 w-full justify-center disabled:opacity-60 disabled:cursor-wait ${
                            registrant.meetingLinkEmailSentAt
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                        }`}
                    >
                        {emailingMeetingLink
                            ? <><Loader2 size={13} className="animate-spin" /> Sending</>
                            : registrant.meetingLinkEmailSentAt
                                ? <><Mail size={13} /> Resend Link</>
                                : <><Mail size={13} /> Email Link</>}
                    </button>
                )}
                <button
                    onClick={() => setShowCouponTracker(!showCouponTracker)}
                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all mt-2 w-full justify-center ${showCouponTracker ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}`}
                >
                    <Ticket size={13} /> Track Coupon
                </button>
            </div>
        </div>
        {showCouponTracker && registrant.email && (
            <div className="px-6 lg:px-8 pb-4">
                <CouponTrackerPanel email={registrant.email} onClose={() => setShowCouponTracker(false)} />
            </div>
        )}
        </div>
    );
};

type BroadcastTemplate = { id: string; name: string; body: string; isDefault?: boolean };
const BROADCAST_TEMPLATE_LIB_KEY = 'groupLinkBroadcast:templates:v1';

const isBroadcastTemplateLike = (value: unknown): value is { id: string; name: string; body: string; isDefault?: unknown } => {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.body === 'string';
};

const loadBroadcastTemplates = (): BroadcastTemplate[] => {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(BROADCAST_TEMPLATE_LIB_KEY) : null;
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const valid: BroadcastTemplate[] = [];
        let defaultSeen = false;
        for (const entry of parsed) {
            if (!isBroadcastTemplateLike(entry)) continue;
            const isDefault = !defaultSeen && !!entry.isDefault;
            if (isDefault) defaultSeen = true;
            valid.push({ id: entry.id, name: entry.name, body: entry.body, isDefault });
        }
        return valid;
    } catch { return []; }
};

const persistBroadcastTemplates = (list: BroadcastTemplate[]) => {
    try { localStorage.setItem(BROADCAST_TEMPLATE_LIB_KEY, JSON.stringify(list)); } catch {}
};

interface SessionCardProps {
    training: Training;
    index: number;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onToggleActive: () => void;
    isManaged: boolean;
    onManageToggle: () => void;
    allEmployees: EmployeeRecord[];
    onUpdateParticipants: (id: string, participants: ParticipantData[]) => void;
    onUploadSheet: (id: string, url: string) => void;
    onRemoveSheet: (id: string) => void;
    currentUserEntityId: string | null;
    certTemplateEndpoint?: string;
    registrationCount: number;
    /** Aggregate of registrants whose `groupLinkSentAt` is set, fetched via
     *  `/api/training-register?counts=true`. Lets the card show the
     *  "X of Y invited" pill before the registrants panel is opened. */
    groupLinkSentCount: number;
    onUpdateThumbnail: (id: string, thumbnail: string, bumpVersion: boolean) => void;
    isFeatured: boolean;
    onToggleFeature: () => void;
    defaultWaCode?: string;
    regionDefaultWaCode?: string | null;
}

const SessionCard: React.FC<SessionCardProps> = ({ training, index, onEdit, onDelete, onDuplicate, onToggleActive, isManaged, onManageToggle, allEmployees, onUpdateParticipants, onUploadSheet, onRemoveSheet, currentUserEntityId, certTemplateEndpoint = '/api/cert-templates', registrationCount, groupLinkSentCount, onUpdateThumbnail, isFeatured, onToggleFeature, defaultWaCode, regionDefaultWaCode }) => {
    const [participantFilter, setParticipantFilter] = useState<'all' | 'present' | 'absent' | 'neutral'>('all');
    const [stagedCsvData, setStagedCsvData] = useState<any[] | null>(null);
    const [isCsvImporting, setIsCsvImporting] = useState(false);
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const [regCopied, setRegCopied] = useState(false);
    const [thumbSaving, setThumbSaving] = useState(false);
    const [thumbSaved, setThumbSaved]   = useState(false);
    const cardThumbRef = useRef<HTMLInputElement>(null);
    const [showRegistrants, setShowRegistrants] = useState(false);
    const [registrants, setRegistrants] = useState<any[]>([]);
    const [loadingReg, setLoadingReg] = useState(false);
    const [regRefreshKey, setRegRefreshKey] = useState(0);
    const [regAttendance, setRegAttendance] = useState<Record<string, 'present' | 'absent' | 'neutral'>>({});
    // "Show only un-invited" filter for the Trainee Registrations panel —
    // makes it one click for admins to spot who still hasn't been WhatsApp-invited.
    const [showOnlyUninvited, setShowOnlyUninvited] = useState(false);
    // Note: every cert open path (openCertForRegistrant, openCertForEmployee,
    // bulk download, bulk email, single email) reads `r.name` / `employee.Name`
    // fresh from the current registrants/allEmployees state at click time, so
    // a name correction made in the Training Calendar is automatically picked
    // up the next time a cert is generated — irrespective of whether the
    // selected studio template is published or still a draft.
    const [certTarget, setCertTarget] = useState<{ participant: CertParticipant; training: CertTraining } | null>(null);
    const [studioTemplates, setStudioTemplates] = useState<DesignTemplate[]>(() => loadTemplates().filter(t => t.published));
    const [selectedCertTemplateId, setSelectedCertTemplateId] = useState<string | null>(null);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);

    // ── "Promote on WhatsApp" — UTILITY-template fan-out to LMS user list ──
    // Sends the approved Meta template `training_session_scheduled` to every
    // user in `lms_users` who has a phone and hasn't opted out. Recipient
    // count is fetched live (dryRun) when the modal opens so admins can see
    // how big the blast will be before they click Send.
    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promoBusy, setPromoBusy] = useState(false);
    const [promoCount, setPromoCount] = useState<number | null>(null);
    const [promoBreakdown, setPromoBreakdown] = useState<{ lms: number; imported: number } | null>(null);
    // Per-audience totals so the segmented toggle can show counts inline
    // ("LMS users only · 728" / "LMS + imported leads · 4,331") before
    // the admin even clicks. Populated by two parallel dryRun fetches
    // when the modal opens.
    const [promoAudienceCounts, setPromoAudienceCounts] = useState<{ lms: number | null; lmsImported: number | null }>({ lms: null, lmsImported: null });
    // 'lms'           → only LMS-portal users (default — opted-in alerts)
    // 'lms+imported'  → also include manually-added / CSV-imported leads
    //                   from `marketing_participants`. Mirrors the bulk
    //                   multi-training "Promote Trainings" audience picker.
    const [promoAudience, setPromoAudience] = useState<'lms' | 'lms+imported'>('lms');
    const [promoCountLoading, setPromoCountLoading] = useState(false);
    const [promoResult, setPromoResult] = useState<{ attempted: number; succeeded: number; failed: number } | null>(null);
    const [promoError, setPromoError] = useState<string | null>(null);
    // Background-job state. Once the admin clicks Send we get a jobId back
    // immediately and start polling /api/whatsapp/training-promo?jobId=... so
    // the modal can show progress (and "Retry failed") instead of blocking
    // the request until every recipient has been dispatched.
    type PromoJobStatus = {
      id: string;
      status: string; // pending | running | completed | cancelled
      total: number;
      succeeded: number;
      failed: number;
      pending: number;
      sending: number;
      failedRecipients: Array<{ phone: string; name?: string; error?: string; attempts: number }>;
    };
    const [promoJob, setPromoJob] = useState<PromoJobStatus | null>(null);
    const [promoRetrying, setPromoRetrying] = useState(false);
    const [promoCancelling, setPromoCancelling] = useState(false);
    const promoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Past blasts history ────────────────────────────────────────────────
    // Surface a collapsible list of completed/cancelled jobs in the modal so
    // admins can audit prior blasts (timestamp, sent/failed totals, failed
    // recipients) without going to the DB. Loaded lazily when the modal
    // opens and refreshed whenever the active job completes.
    type PromoHistoryEntry = {
      id: string;
      status: string;
      total: number;
      succeeded: number;
      failed: number;
      createdAt: string;
      startedAt: string | null;
      completedAt: string | null;
      failedRecipients: Array<{ phone: string; name?: string; error?: string; attempts: number }>;
      failedRecipientsTotal?: number;
      failedRecipientsTruncated?: boolean;
    };
    const [promoHistory, setPromoHistory] = useState<PromoHistoryEntry[] | null>(null);
    const [promoHistoryLoading, setPromoHistoryLoading] = useState(false);
    const [promoHistoryOpen, setPromoHistoryOpen] = useState(false);
    const [promoHistoryExpanded, setPromoHistoryExpanded] = useState<Record<string, boolean>>({});
    // Per-row delete in flight — disables the X button so admins can't
    // double-click and double-delete during the round-trip.
    const [promoHistoryDeleting, setPromoHistoryDeleting] = useState<Record<string, boolean>>({});
    // Retention policy (auto-purge older than N days). null = disabled.
    // The draft mirrors what the user is typing in the input so we don't
    // hammer the API on every keystroke.
    const [promoRetentionDays, setPromoRetentionDays] = useState<number | null>(null);
    const [promoRetentionDraft, setPromoRetentionDraft] = useState<string>('');
    const [promoRetentionSaving, setPromoRetentionSaving] = useState(false);
    const [promoRetentionMessage, setPromoRetentionMessage] = useState<string | null>(null);

    const loadPromoHistory = useCallback(async () => {
      setPromoHistoryLoading(true);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch(
          `/api/whatsapp/training-promo?trainingId=${encodeURIComponent(training.id)}&history=1`,
          { headers: { 'x-admin-token': adminToken } },
        );
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.ok && Array.isArray(j.jobs)) {
          setPromoHistory(j.jobs as PromoHistoryEntry[]);
        } else {
          setPromoHistory([]);
        }
      } catch {
        setPromoHistory([]);
      } finally {
        setPromoHistoryLoading(false);
      }
    }, [training.id]);

    // Pull the current retention window. Done lazily when the modal opens
    // so it doesn't add latency to other unrelated calendar interactions.
    const loadPromoRetention = useCallback(async () => {
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo?settings=1', {
          headers: { 'x-admin-token': adminToken },
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.ok && j?.settings) {
          const days = j.settings.retentionDays;
          const value = days != null && Number.isFinite(Number(days)) ? Number(days) : null;
          setPromoRetentionDays(value);
          setPromoRetentionDraft(value != null ? String(value) : '');
        }
      } catch { /* non-fatal */ }
    }, []);

    // Delete a single past blast (with FK cascade on its recipient rows).
    // Confirms before firing so a misclick on the X icon can't nuke an
    // audit trail. Active jobs are refused server-side; the admin must
    // cancel first.
    const deletePromoHistoryRow = useCallback(async (jobId: string, when: string) => {
      const ok = typeof window !== 'undefined'
        ? window.confirm(
            `Delete this past blast (${when})?\n\nAll recipient phone-number rows for this blast will also be removed. This cannot be undone.`,
          )
        : true;
      if (!ok) return;
      setPromoHistoryDeleting(prev => ({ ...prev, [jobId]: true }));
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ action: 'delete', jobId }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          // Surface the server's reason inline rather than throwing — the
          // most useful failure mode is "cancel the blast first".
          if (typeof window !== 'undefined') {
            window.alert(j?.error || `Delete failed (HTTP ${res.status})`);
          }
          return;
        }
        // Optimistically drop from local state so the row vanishes
        // without waiting for a refetch.
        setPromoHistory(prev => (prev || []).filter(h => h.id !== jobId));
        setPromoHistoryExpanded(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      } catch (err: any) {
        if (typeof window !== 'undefined') {
          window.alert(err?.message || 'Delete failed');
        }
      } finally {
        setPromoHistoryDeleting(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }
    }, []);

    // Persist a new retention window. Empty / 0 disables auto-purge.
    const savePromoRetention = useCallback(async () => {
      setPromoRetentionSaving(true);
      setPromoRetentionMessage(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const trimmed = promoRetentionDraft.trim();
        const payload: any = { action: 'setSettings' };
        if (trimmed === '') {
          payload.retentionDays = null;
        } else {
          const n = Number(trimmed);
          if (!Number.isFinite(n) || n < 0 || n > 3650) {
            setPromoRetentionMessage('Enter a number between 0 and 3650 (0 disables auto-purge).');
            setPromoRetentionSaving(false);
            return;
          }
          payload.retentionDays = n;
        }
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoRetentionMessage(j?.error || `Save failed (HTTP ${res.status})`);
          return;
        }
        const days = j?.settings?.retentionDays;
        const value = days != null && Number.isFinite(Number(days)) ? Number(days) : null;
        setPromoRetentionDays(value);
        setPromoRetentionDraft(value != null ? String(value) : '');
        const purged = Number(j?.purged || 0);
        setPromoRetentionMessage(
          value == null
            ? 'Auto-purge disabled.'
            : `Saved. Auto-purging blasts older than ${value} day${value === 1 ? '' : 's'}.${purged > 0 ? ` Removed ${purged} now.` : ''}`,
        );
        // If the purge actually deleted some rows, refresh the visible
        // history so they disappear immediately.
        if (purged > 0) void loadPromoHistory();
      } catch (err: any) {
        setPromoRetentionMessage(err?.message || 'Save failed');
      } finally {
        setPromoRetentionSaving(false);
      }
    }, [promoRetentionDraft, loadPromoHistory]);

    // Format helpers used by the WhatsApp UTILITY template body. We do this
    // client-side so the API can stay generic and any future caller (mobile,
    // bulk script, etc.) can pass its own pre-formatted strings.
    const formatPromoDate = (iso?: string): string => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const day = d.getDate();
      const ord = (n: number) => {
        if (n >= 11 && n <= 13) return `${n}th`;
        switch (n % 10) { case 1: return `${n}st`; case 2: return `${n}nd`; case 3: return `${n}rd`; default: return `${n}th`; }
      };
      const month = d.toLocaleString('en-GB', { month: 'long' });
      return `${ord(day)} ${month} ${d.getFullYear()}`;
    };
    const formatPromoTime = (start?: string, end?: string): string => {
      // Trainings are stored in two different shapes depending on when the
      // record was created — old ones use plain "HH:mm" strings, newer ones
      // use full ISO datetimes like "2026-04-19T07:50". Handle both, plus
      // a defensive regex fallback for anything weird.
      const fmt = (t?: string): string => {
        if (!t) return '';
        const trimmed = t.trim();
        // ISO datetime path — only when it actually looks like one (has a
        // date prefix), so we don't accidentally pull garbage out of pure
        // "HH:mm" strings via the Date constructor.
        if (/^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(trimmed)) {
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) {
            const h24 = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = h24 >= 12 ? 'PM' : 'AM';
            const h = h24 % 12 || 12;
            return `${h}:${min} ${ampm}`;
          }
        }
        // Plain "HH:mm" or "H:mm" — first colon-pair anywhere in the string.
        const m = /(\d{1,2}):(\d{2})/.exec(trimmed);
        if (!m) return trimmed;
        let h = parseInt(m[1], 10);
        const min = m[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${min} ${ampm}`;
      };
      const s = fmt(start);
      const e = fmt(end);
      if (s && e) return s === e ? s : `${s} – ${e}`;
      return s || e || '';
    };
    const buildPromoPayload = () => {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://haccppro.in').replace(/\/$/, '');
      return {
        topic: training.topic || 'Training Session',
        date: formatPromoDate(training.date),
        time: formatPromoTime(training.startTime, training.endTime),
        registrationUrl: `${baseUrl}/training-register/${training.id}`,
        // Per-training thumbnail uploaded during calendar creation drives
        // the dynamic IMAGE header on training_session_scheduled. The send
        // route's resolveHeaderImageParam falls back to a placeholder if
        // this is empty so the send still succeeds.
        imageUrl: training.thumbnailImage,
      };
    };

    // Stops the background poller. Safe to call multiple times.
    const stopPromoPolling = useCallback(() => {
      if (promoPollRef.current) {
        clearInterval(promoPollRef.current);
        promoPollRef.current = null;
      }
    }, []);

    // Pull the latest job status from the server. When the worker reports
    // the job is done, we mirror the totals into `promoResult` (so the
    // existing "Blast complete" UI lights up) and stop polling.
    const fetchPromoJob = useCallback(async (jobId: string) => {
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch(`/api/whatsapp/training-promo?jobId=${encodeURIComponent(jobId)}`, {
          headers: { 'x-admin-token': adminToken },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false || !j?.job) return;
        const job: PromoJobStatus = j.job;
        setPromoJob(job);
        // 'completed' is fully terminal — no more rows will move.
        // 'cancelled' is *logically* terminal but the worker may still
        // be mid-dispatch on rows that were already in 'sending' when
        // cancel landed; their succeeded/failed counts can keep ticking
        // for a few seconds. Keep polling until those drain so the modal
        // doesn't freeze with stale numbers, then stop.
        const cancelledDraining = job.status === 'cancelled' && job.sending > 0;
        if ((job.status === 'completed' || job.status === 'cancelled') && !cancelledDraining) {
          setPromoResult({ attempted: job.total, succeeded: job.succeeded, failed: job.failed });
          setPromoBusy(false);
          stopPromoPolling();
          // Refresh the past-blasts list so the just-finished job appears
          // there immediately if the admin keeps the modal open.
          void loadPromoHistory();
        }
      } catch {
        // Transient poll failure — leave the loop running, the next tick
        // will try again.
      }
    }, [stopPromoPolling, loadPromoHistory]);

    const startPromoPolling = useCallback((jobId: string) => {
      stopPromoPolling();
      // Immediate fetch so the UI updates within a frame, then poll every
      // 2s until the job is finished.
      void fetchPromoJob(jobId);
      promoPollRef.current = setInterval(() => { void fetchPromoJob(jobId); }, 2000);
    }, [fetchPromoJob, stopPromoPolling]);

    // Stop polling if the component unmounts mid-blast.
    useEffect(() => () => stopPromoPolling(), [stopPromoPolling]);

    // Live-fetch the audience size for the chosen audience. Extracted so
    // it can be re-run whenever the admin flips the audience toggle in
    // the modal without re-opening it. Failures are surfaced inline.
    const fetchPromoCount = useCallback(async (audience: 'lms' | 'lms+imported') => {
      setPromoCountLoading(true);
      setPromoCount(null);
      setPromoBreakdown(null);
      setPromoError(null);
      const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
      try {
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({
            trainingId: training.id,
            training: buildPromoPayload(),
            dryRun: true,
            audience,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || 'Failed to load recipient count');
          setPromoCount(0);
        } else {
          const total = Number(j?.attempted) || 0;
          setPromoCount(total);
          if (j?.breakdown && typeof j.breakdown === 'object') {
            setPromoBreakdown({
              lms: Number(j.breakdown.lms) || 0,
              imported: Number(j.breakdown.imported) || 0,
            });
          }
          // Cache the count under the audience that produced it so the
          // toggle buttons can show both totals side-by-side without
          // re-fetching on every click.
          setPromoAudienceCounts(prev => ({
            ...prev,
            [audience === 'lms+imported' ? 'lmsImported' : 'lms']: total,
          }));
        }
      } catch (err: any) {
        setPromoError(err?.message || 'Failed to load recipient count');
        setPromoCount(0);
      } finally {
        setPromoCountLoading(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [training.id, training.topic, training.date, training.startTime, training.endTime]);

    const openPromoModal = useCallback(async () => {
      setShowPromoModal(true);
      setPromoCount(null);
      setPromoBreakdown(null);
      setPromoAudienceCounts({ lms: null, lmsImported: null });
      setPromoResult(null);
      setPromoError(null);
      setPromoJob(null);
      setPromoHistory(null);
      setPromoHistoryExpanded({});
      setPromoHistoryDeleting({});
      setPromoRetentionMessage(null);
      // Reset the audience to the safe default ('lms') every time the
      // modal opens so a previous session's "include imported" choice
      // doesn't silently widen the next blast.
      setPromoAudience('lms');
      // Kick off the past-blasts fetch + retention setting in parallel
      // with the dryRun counts. We fire both audience counts in parallel
      // so the toggle can render real numbers immediately — the admin
      // sees "LMS users only · 728" vs "LMS + imported leads · 4,331"
      // without having to flip the toggle to discover the second total.
      void loadPromoHistory();
      void loadPromoRetention();
      void fetchPromoCount('lms');
      void fetchPromoCount('lms+imported');
      const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
      // Resume an in-flight blast for this training, if one exists. This
      // lets the admin re-open the modal after a refresh and still see
      // live progress instead of a "ready to send" confirmation.
      try {
        const res = await fetch(`/api/whatsapp/training-promo?trainingId=${encodeURIComponent(training.id)}&active=1`, {
          headers: { 'x-admin-token': adminToken },
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.ok && j?.job) {
          setPromoJob(j.job);
          setPromoBusy(true);
          startPromoPolling(j.job.id);
        }
      } catch { /* non-fatal */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [training.id, training.topic, training.date, training.startTime, training.endTime, startPromoPolling]);

    const sendPromo = useCallback(async () => {
      setPromoBusy(true);
      setPromoError(null);
      setPromoResult(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        // Enqueue the blast — the server returns immediately with a jobId,
        // an in-process worker drains the recipients in the background, and
        // the modal polls for progress. This avoids the proxy timeout that
        // the old inline fan-out would hit on lists of a few hundred plus.
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({
            trainingId: training.id,
            training: buildPromoPayload(),
            audience: promoAudience,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || `Failed (${res.status})`);
          setPromoBusy(false);
          return;
        }
        if (!j?.jobId) {
          // Server reported "no eligible recipients" — finish immediately.
          setPromoResult({
            attempted: Number(j?.total) || 0,
            succeeded: 0,
            failed: 0,
          });
          setPromoBusy(false);
          return;
        }
        if (j?.job) setPromoJob(j.job);
        startPromoPolling(j.jobId);
      } catch (err: any) {
        setPromoError(err?.message || 'Send failed');
        setPromoBusy(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [training.id, training.topic, training.date, training.startTime, training.endTime, startPromoPolling, promoAudience]);

    const cancelPromoBlast = useCallback(async () => {
      if (!promoJob) return;
      // Confirm before halting — the action is irreversible for the
      // already-cancelled recipients and admins should not nuke a blast
      // by mis-clicking. window.confirm matches the rest of the
      // destructive-action prompts in this component.
      const stillPending = promoJob.pending;
      const inFlight = promoJob.sending;
      const ok = typeof window !== 'undefined'
        ? window.confirm(
            `Cancel this WhatsApp blast?\n\n${stillPending} pending recipient${stillPending === 1 ? '' : 's'} will NOT receive the message.${inFlight > 0 ? `\n\n${inFlight} message${inFlight === 1 ? ' is' : 's are'} already mid-send and may still complete.` : ''}\n\n${promoJob.succeeded} already sent will stay on record. This cannot be undone.`,
          )
        : true;
      if (!ok) return;
      setPromoCancelling(true);
      setPromoError(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ action: 'cancel', jobId: promoJob.id }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || `Cancel failed (${res.status})`);
          return;
        }
        // The server has flipped the job to 'cancelled' and any pending
        // recipients with it. Mirror that into local state immediately so
        // the UI flips out of the in-progress panel without waiting for
        // the next 2s poll. We deliberately do NOT stop polling here:
        // any rows that were already 'sending' when cancel landed may
        // still finish their HTTP round-trip, so `fetchPromoJob` keeps
        // running until `sending === 0` and only then freezes the
        // counters into `promoResult`.
        if (j?.job) {
          setPromoJob(j.job);
          if ((j.job.sending || 0) === 0) {
            setPromoResult({ attempted: j.job.total, succeeded: j.job.succeeded, failed: j.job.failed });
            setPromoBusy(false);
            stopPromoPolling();
          }
        }
      } catch (err: any) {
        setPromoError(err?.message || 'Cancel failed');
      } finally {
        setPromoCancelling(false);
      }
    }, [promoJob, stopPromoPolling]);

    const [promoResuming, setPromoResuming] = useState(false);
    const resumePromoBlast = useCallback(async () => {
      if (!promoJob) return;
      // Pairs with the Cancel button. Re-queues recipients that were
      // skipped at cancel time (status='cancelled') back to 'pending' on
      // the SAME job, so anyone already sent/failed is left alone.
      setPromoResuming(true);
      setPromoError(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ action: 'resume', jobId: promoJob.id }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || `Resume failed (${res.status})`);
          return;
        }
        // The worker has been re-kicked server-side. Flip back into the
        // in-progress UI and resume the existing polling so the admin
        // sees the resumed recipients drain through 'sent'/'failed'.
        setPromoBusy(true);
        setPromoResult(null);
        if (j?.job) setPromoJob(j.job);
        startPromoPolling(promoJob.id);
      } catch (err: any) {
        setPromoError(err?.message || 'Resume failed');
      } finally {
        setPromoResuming(false);
      }
    }, [promoJob, startPromoPolling]);

    // ── Re-blast missed users only ────────────────────────────────────────
    // Enqueues a fresh job containing only LMS recipients who are NOT in
    // the succeeded list of any prior job for this training. Server does
    // the actual subtraction (so the audience filter stays authoritative),
    // we just trigger it and pick up the returned jobId for live progress.
    const [promoReblastMissedBusy, setPromoReblastMissedBusy] = useState(false);
    const reblastMissedUsers = useCallback(async () => {
      if (promoReblastMissedBusy) return;
      const ok = typeof window !== 'undefined'
        ? window.confirm('Send the WhatsApp promo to every LMS user who has NOT already received it from a previous blast?')
        : true;
      if (!ok) return;
      setPromoReblastMissedBusy(true);
      setPromoError(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({
            action: 'reblast-missed',
            trainingId: training.id,
            training: buildPromoPayload(),
            audience: promoAudience,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || `Re-blast failed (${res.status})`);
          return;
        }
        if (!j?.jobId) {
          // Server reported "everyone already got it" (or nothing eligible).
          if (typeof window !== 'undefined') {
            window.alert(j?.message || 'No missed recipients to re-blast.');
          }
          // Refresh history so any state change is reflected.
          void loadPromoHistory();
          return;
        }
        // Mirror the standard send-flow: flip the modal into the live
        // progress panel and start polling the new job.
        setPromoBusy(true);
        setPromoResult(null);
        if (j?.job) setPromoJob(j.job);
        startPromoPolling(j.jobId);
      } catch (err: any) {
        setPromoError(err?.message || 'Re-blast failed');
      } finally {
        setPromoReblastMissedBusy(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promoReblastMissedBusy, training.id, training.topic, training.date, training.startTime, training.endTime, startPromoPolling, loadPromoHistory, promoAudience]);

    const retryPromoFailed = useCallback(async () => {
      if (!promoJob) return;
      setPromoRetrying(true);
      setPromoError(null);
      try {
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        const res = await fetch('/api/whatsapp/training-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
          body: JSON.stringify({ action: 'retry', jobId: promoJob.id }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j?.ok === false) {
          setPromoError(j?.error || `Retry failed (${res.status})`);
          return;
        }
        // The worker has been re-kicked server-side; flip back into the
        // in-progress UI and resume polling so the admin sees the retried
        // recipients move from "failed" → "sent" or back to "failed" with
        // the underlying error message updated.
        setPromoBusy(true);
        setPromoResult(null);
        if (j?.job) setPromoJob(j.job);
        startPromoPolling(promoJob.id);
      } catch (err: any) {
        setPromoError(err?.message || 'Retry failed');
      } finally {
        setPromoRetrying(false);
      }
    }, [promoJob, startPromoPolling]);

    const closePromoModal = useCallback(() => {
      stopPromoPolling();
      setShowPromoModal(false);
    }, [stopPromoPolling]);

    // ── Group-link broadcast modal (sequential wa.me opener) ─────────────────
    const DEFAULT_GROUP_BROADCAST_TEMPLATE = `Hi {firstName}, here is the WhatsApp group for {trainingTitle}: {groupLink}\n\nLooking forward to seeing you there!`;
    const groupBroadcastStorageKey = `groupLinkBroadcast:${training.id}`;
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMessage, setBroadcastMessage]     = useState<string>(DEFAULT_GROUP_BROADCAST_TEMPLATE);
    const [broadcastSelected, setBroadcastSelected]   = useState<Record<string, boolean>>({});
    const [broadcastSkipSent, setBroadcastSkipSent]   = useState(true);
    const [broadcastInProgress, setBroadcastInProgress] = useState(false);
    const [broadcastPaused, setBroadcastPaused]       = useState(false);
    const [broadcastIndex, setBroadcastIndex]         = useState(0);
    const [broadcastTotal, setBroadcastTotal]         = useState(0);
    const [broadcastNote, setBroadcastNote]           = useState<string | null>(null);
    const [broadcastTemplates, setBroadcastTemplates] = useState<BroadcastTemplate[]>([]);
    const [activeTemplateId, setActiveTemplateId]     = useState<string | null>(null);
    const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
    const [newTemplateName, setNewTemplateName]       = useState('');
    const broadcastCancelRef = useRef(false);
    const broadcastPauseRef  = useRef(false);

    // ── Email-meeting-link broadcast state ───────────────────────────────────
    const [showMeetingEmailModal, setShowMeetingEmailModal] = useState(false);
    const [meetingLinkDraft, setMeetingLinkDraft] = useState<string>(training.meetingLink || '');
    const [meetingNoteDraft, setMeetingNoteDraft] = useState<string>('');
    const [meetingOnlyUnsent, setMeetingOnlyUnsent] = useState(true);
    const [meetingChannels,   setMeetingChannels]   = useState<'email' | 'whatsapp' | 'both'>(
        (training.autoSendMeetingLinkChannels as 'email' | 'whatsapp' | 'both') || 'both',
    );
    const [meetingSending,    setMeetingSending]    = useState(false);
    const [meetingResult,     setMeetingResult]     = useState<null | {
        ok: boolean; sent: number; skipped: number; failed: number; considered: number; message?: string;
        successes?: Array<{ id: string; email: string; name: string }>;
        failures?:  Array<{ id: string; email?: string; name?: string; reason: string }>;
    }>(null);
    // Email open-tracking — populated by /api/email-track/list. We display
    // who opened the meeting-link email (and when) inside the broadcast modal.
    const [emailOpens, setEmailOpens] = useState<{
        loading: boolean;
        loaded:  boolean;
        error?:  string;
        totals:  { sent: number; opened: number; unopened: number };
        rows:    Array<{
            id: string; recipient_email: string; recipient_name: string | null;
            sent_at: string; first_opened_at: string | null; last_opened_at: string | null;
            open_count: number;
        }>;
    }>({ loading: false, loaded: false, totals: { sent: 0, opened: 0, unopened: 0 }, rows: [] });
    const fetchEmailOpens = useCallback(async () => {
        setEmailOpens(s => ({ ...s, loading: true, error: undefined }));
        try {
            const res = await fetch(
                `/api/email-track/list?sessionId=${encodeURIComponent(training.id)}&template=meeting_link_broadcast`,
                { credentials: 'include' },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success !== true) {
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            setEmailOpens({
                loading: false, loaded: true,
                totals: data.totals || { sent: 0, opened: 0, unopened: 0 },
                rows:   Array.isArray(data.rows) ? data.rows : [],
            });
        } catch (err: any) {
            setEmailOpens(s => ({ ...s, loading: false, loaded: true, error: err?.message?.slice(0, 200) || 'Failed to load opens.' }));
        }
    }, [training.id]);
    // Reactive admin-token presence so the "sign in required" banner updates
    // the moment a token is created via the inline mini-login below (no need
    // to close + reopen the dialog).
    const [hasAdminToken, setHasAdminToken] = useState<boolean>(false);
    const refreshAdminTokenFlag = () => {
        if (typeof window === 'undefined') return;
        setHasAdminToken(!!localStorage.getItem('admin_session_token'));
    };
    // Inline admin-login mini-form (shown when no admin token is present).
    const [inlineAdminEmail, setInlineAdminEmail]   = useState('');
    const [inlineAdminPwd,   setInlineAdminPwd]     = useState('');
    const [inlineAdminBusy,  setInlineAdminBusy]    = useState(false);
    const [inlineAdminErr,   setInlineAdminErr]     = useState<string | null>(null);
    const submitInlineAdminLogin = async () => {
        const em = inlineAdminEmail.trim().toLowerCase();
        const pw = inlineAdminPwd;
        if (!em || !pw) { setInlineAdminErr('Enter email and password.'); return; }
        setInlineAdminBusy(true);
        setInlineAdminErr(null);
        try {
            const res = await fetch('/api/auth/admin-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: em, password: pw }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok || !data?.token) {
                setInlineAdminErr(data?.error || `Sign-in failed (HTTP ${res.status}).`);
                return;
            }
            localStorage.setItem('admin_session_token', data.token);
            setInlineAdminPwd('');
            refreshAdminTokenFlag();
        } catch (err: any) {
            setInlineAdminErr(err?.message?.slice(0, 200) || 'Network error.');
        } finally {
            setInlineAdminBusy(false);
        }
    };
    useEffect(() => { setMeetingLinkDraft(training.meetingLink || ''); }, [training.meetingLink]);

    const openMeetingEmailModal = () => {
        setMeetingLinkDraft(training.meetingLink || '');
        setMeetingNoteDraft('');
        setMeetingOnlyUnsent(true);
        setMeetingResult(null);
        setInlineAdminErr(null);
        refreshAdminTokenFlag();
        // Only pull open-tracking stats if the admin is already signed in —
        // otherwise the request 401s and clutters the console. The Refresh
        // button inside the panel lets them load it once they sign in.
        const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('admin_session_token');
        if (hasToken) fetchEmailOpens();
        else          setEmailOpens({ loading: false, loaded: false, totals: { sent: 0, opened: 0, unopened: 0 }, rows: [] });
        setShowMeetingEmailModal(true);
    };
    const closeMeetingEmailModal = () => {
        if (meetingSending) return;
        setShowMeetingEmailModal(false);
    };
    const sendMeetingLinkBroadcast = async () => {
        const link = meetingLinkDraft.trim();
        if (!link) { setMeetingResult({ ok: false, sent: 0, skipped: 0, failed: 0, considered: 0, message: 'Add a meeting link first.' }); return; }
        if (!/^https?:\/\/\S+$/i.test(link)) { setMeetingResult({ ok: false, sent: 0, skipped: 0, failed: 0, considered: 0, message: 'Meeting link must start with http:// or https://' }); return; }
        // Pre-flight: this endpoint requires an admin session; surface a clear
        // message instead of letting the user click Send and get a raw 401.
        const preToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        if (!preToken) {
            setMeetingResult({
                ok: false, sent: 0, skipped: 0, failed: 0, considered: 0,
                message: 'You need to be signed in as an admin to send bulk emails. Please log in (Admin Login) and try again.',
            });
            return;
        }
        setMeetingSending(true);
        setMeetingResult(null);
        try {
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const res = await fetch('/api/training-register/broadcast-meeting-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    sessionId: training.id,
                    meetingLink: link,
                    customNote: meetingNoteDraft,
                    onlyUnsent: meetingOnlyUnsent,
                    channels:   meetingChannels,
                }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (!res.ok) {
                // Friendlier message for the most common failure (expired admin
                // session) — the raw "Unauthorized" string is confusing.
                const friendly = res.status === 401
                    ? 'Your admin session has expired. Please sign in again (Admin Login) and retry.'
                    : (data?.error || `Broadcast failed (HTTP ${res.status}).`);
                setMeetingResult({
                    ok: false, sent: 0, skipped: 0, failed: 0, considered: 0,
                    message: friendly,
                });
            } else {
                const totals = data?.totals || {};
                setMeetingResult({
                    ok: true,
                    sent:       Number(totals.sent || 0),
                    skipped:    Number(totals.skipped || 0),
                    failed:     Number(totals.failed || 0),
                    considered: Number(totals.considered || 0),
                    successes:  Array.isArray(data?.successes) ? data.successes : [],
                    failures:   Array.isArray(data?.failures)  ? data.failures  : [],
                });
                // Refresh registrants so the per-row "Meeting link emailed"
                // badge appears immediately after a successful broadcast.
                setRegRefreshKey(k => k + 1);
            }
        } catch (err: any) {
            setMeetingResult({
                ok: false, sent: 0, skipped: 0, failed: 0, considered: 0,
                message: err?.message?.slice(0, 200) || 'Network error.',
            });
        } finally {
            setMeetingSending(false);
        }
    };

    const activeTemplate = broadcastTemplates.find(t => t.id === activeTemplateId) || null;

    const applyTemplate = (id: string) => {
        const tpl = broadcastTemplates.find(t => t.id === id);
        if (!tpl) return;
        setActiveTemplateId(id);
        setBroadcastMessage(tpl.body);
    };

    const saveAsNewTemplate = () => {
        const name = newTemplateName.trim();
        if (!name) return;
        const id = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const next: BroadcastTemplate[] = [
            ...broadcastTemplates,
            { id, name, body: broadcastMessage, isDefault: broadcastTemplates.length === 0 },
        ];
        setBroadcastTemplates(next);
        persistBroadcastTemplates(next);
        setActiveTemplateId(id);
        setNewTemplateName('');
        setShowSaveTemplateForm(false);
    };

    const overwriteActiveTemplate = () => {
        if (!activeTemplate) return;
        const next = broadcastTemplates.map(t =>
            t.id === activeTemplate.id ? { ...t, body: broadcastMessage } : t
        );
        setBroadcastTemplates(next);
        persistBroadcastTemplates(next);
    };

    const toggleActiveTemplateAsDefault = () => {
        if (!activeTemplate) return;
        const wasDefault = !!activeTemplate.isDefault;
        const next = broadcastTemplates.map(t => ({
            ...t,
            isDefault: wasDefault ? false : t.id === activeTemplate.id,
        }));
        setBroadcastTemplates(next);
        persistBroadcastTemplates(next);
    };

    const deleteActiveTemplate = () => {
        if (!activeTemplate) return;
        const next = broadcastTemplates.filter(t => t.id !== activeTemplate.id);
        setBroadcastTemplates(next);
        persistBroadcastTemplates(next);
        setActiveTemplateId(null);
    };

    const markGroupLinkSentForRegistrant = useCallback(async (regId: string) => {
        try {
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const sentBy     = typeof window !== 'undefined' ? (localStorage.getItem('admin_user_name') || '') : '';
            const res = await fetch('/api/training-register', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({ id: regId, markGroupLinkSent: true, groupLinkSentBy: sentBy }),
            });
            if (!res.ok) return;
            const data = await res.json().catch(() => ({} as any));
            // Idempotent server: don't overwrite the persisted "first-sent"
            // timestamp on a no-op response — that would make the badge
            // show a newer date than what's actually stored.
            if (data?.noOp === true) return;
            const stamp = new Date().toISOString();
            setRegistrants(prev => prev.map(r => r.id === regId
                ? (r.groupLinkSentAt
                    ? r
                    : { ...r, groupLinkSentAt: stamp, ...(sentBy ? { groupLinkSentBy: sentBy } : {}) })
                : r));
        } catch { /* non-fatal — broadcast keeps going */ }
    }, []);

    const renderBroadcastMessage = (template: string, name: string, groupLink: string, trainingTitle: string): string => {
        const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
        return template
            .replace(/\{firstName\}/g, firstName)
            .replace(/\{name\}/g,      String(name || ''))
            .replace(/\{trainingTitle\}/g, trainingTitle)
            .replace(/\{groupLink\}/g,     groupLink);
    };

    // Recipients are all registrants whose phone resolves to a wa.me URL.
    // Invalid / missing numbers are surfaced separately so the admin can fix
    // them later without us silently dropping them.
    const broadcastRecipients = useMemo(() => {
        return registrants.map(r => {
            const wa = resolveWaContact(r.whatsapp || r.mobile, {
                defaultCode: defaultWaCode,
                regionDefaultCode: regionDefaultWaCode,
                country: r.country,
            });
            return {
                id: r.id,
                name: r.name || '(unnamed)',
                phone: r.whatsapp || r.mobile || '',
                waUrl: wa.url,
                invalid: wa.invalid === true,
                groupLinkSentAt: r.groupLinkSentAt || null,
            };
        });
    }, [registrants, defaultWaCode, regionDefaultWaCode]);

    const openBroadcastModal = () => {
        // Load the admin's saved template library and preselect the default
        // one if any. Otherwise fall back to whatever they last tweaked on
        // this session, then to the built-in default.
        const lib = loadBroadcastTemplates();
        setBroadcastTemplates(lib);
        const def = lib.find(t => t.isDefault);
        let sessionSaved: string | null = null;
        try { sessionSaved = localStorage.getItem(groupBroadcastStorageKey); } catch {}
        if (def) {
            setBroadcastMessage(def.body);
            setActiveTemplateId(def.id);
        } else if (sessionSaved) {
            setBroadcastMessage(sessionSaved);
            setActiveTemplateId(null);
        } else {
            setBroadcastMessage(DEFAULT_GROUP_BROADCAST_TEMPLATE);
            setActiveTemplateId(null);
        }
        setShowSaveTemplateForm(false);
        setNewTemplateName('');
        // Reset skip-sent to its safe default every time the modal opens so
        // an earlier session of toggling it off doesn't silently re-include
        // already-invited learners.
        setBroadcastSkipSent(true);
        // Default selection: every valid recipient that hasn't been broadcast
        // to yet.
        const next: Record<string, boolean> = {};
        for (const r of broadcastRecipients) {
            if (!r.waUrl || r.invalid) continue;
            if (r.groupLinkSentAt) continue;
            next[r.id] = true;
        }
        setBroadcastSelected(next);
        setBroadcastNote(null);
        setShowBroadcastModal(true);
    };

    const closeBroadcastModal = () => {
        if (broadcastInProgress) {
            broadcastCancelRef.current = true;
            setBroadcastInProgress(false);
        }
        setShowBroadcastModal(false);
    };

    const runBroadcast = async () => {
        if (!training.whatsappLink) {
            setBroadcastNote('No group link saved on this session — add one via Edit first.');
            return;
        }
        const groupLink = String(training.whatsappLink).trim();
        const targets = broadcastRecipients.filter(r =>
            broadcastSelected[r.id] && r.waUrl && !r.invalid
        );
        if (targets.length === 0) {
            setBroadcastNote('No valid recipients selected.');
            return;
        }
        // Persist whatever message tweak the admin made.
        try { localStorage.setItem(groupBroadcastStorageKey, broadcastMessage); } catch {}

        broadcastCancelRef.current = false;
        broadcastPauseRef.current  = false;
        setBroadcastPaused(false);
        setBroadcastInProgress(true);
        setBroadcastTotal(targets.length);
        setBroadcastIndex(0);
        setBroadcastNote(null);

        for (let i = 0; i < targets.length; i++) {
            // Cooperative pause loop: re-check every 200ms so resume feels snappy.
            while (broadcastPauseRef.current && !broadcastCancelRef.current) {
                await new Promise(res => setTimeout(res, 200));
            }
            if (broadcastCancelRef.current) break;

            const t = targets[i];
            setBroadcastIndex(i + 1);
            const text = renderBroadcastMessage(broadcastMessage, t.name, groupLink, training.topic || '');
            const finalUrl = `${t.waUrl}?text=${encodeURIComponent(text)}`;
            const w = window.open(finalUrl, '_blank');
            if (!w) {
                broadcastPauseRef.current = true;
                setBroadcastPaused(true);
                setBroadcastNote('Popup blocked. Please allow popups for this site, then click Resume.');
                // Hold here until user resumes / cancels.
                while (broadcastPauseRef.current && !broadcastCancelRef.current) {
                    await new Promise(res => setTimeout(res, 200));
                }
                if (broadcastCancelRef.current) break;
                // Retry once after resume — re-check cancel right after open
                // so a late Cancel click doesn't sneak an extra window past us.
                const retry = window.open(finalUrl, '_blank');
                if (broadcastCancelRef.current) break;
                if (!retry) {
                    setBroadcastNote(`Couldn't open chat for ${t.name}. Skipping.`);
                    continue;
                }
            }
            // Mark as sent (idempotent on the server).
            markGroupLinkSentForRegistrant(t.id);

            // Auto-advance: instead of blindly opening every chat with a 700ms
            // gap, wait for the admin to switch to WhatsApp (this tab loses
            // focus), tap Send, and switch back (this tab regains focus).
            // Then open the next chat. Pause / Cancel still interrupt.
            if (i < targets.length - 1) {
                setBroadcastNote(`Opened chat for ${t.name}. Tap Send in WhatsApp, then return to this tab — the next chat will open automatically.`);

                // Phase 1: wait until this tab loses focus / becomes hidden
                // (admin switched to the WhatsApp window).
                const lostFocus = async () => {
                    // If we're already hidden / unfocused, no need to wait.
                    if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) return;
                    await new Promise<void>(resolve => {
                        const cleanup = () => {
                            window.removeEventListener('blur', onChange);
                            document.removeEventListener('visibilitychange', onChange);
                            clearInterval(poll);
                            resolve();
                        };
                        const onChange = () => { if (document.hidden || !document.hasFocus()) cleanup(); };
                        window.addEventListener('blur', onChange);
                        document.addEventListener('visibilitychange', onChange);
                        // Safety poll — also resolves on Pause / Cancel.
                        const poll = setInterval(() => {
                            if (broadcastCancelRef.current || broadcastPauseRef.current) cleanup();
                            else if (document.hidden || !document.hasFocus()) cleanup();
                        }, 250);
                        // Hard cap: if the admin never leaves the tab within
                        // 30s (e.g. popup was blocked), fall through anyway.
                        setTimeout(cleanup, 30_000);
                    });
                };

                // Phase 2: wait until this tab regains focus (admin came back
                // after tapping Send in WhatsApp).
                const regainedFocus = async () => {
                    if (typeof document !== 'undefined' && !document.hidden && document.hasFocus()) return;
                    await new Promise<void>(resolve => {
                        const cleanup = () => {
                            window.removeEventListener('focus', onChange);
                            document.removeEventListener('visibilitychange', onChange);
                            clearInterval(poll);
                            resolve();
                        };
                        const onChange = () => { if (!document.hidden && document.hasFocus()) cleanup(); };
                        window.addEventListener('focus', onChange);
                        document.addEventListener('visibilitychange', onChange);
                        const poll = setInterval(() => {
                            if (broadcastCancelRef.current || broadcastPauseRef.current) cleanup();
                            else if (!document.hidden && document.hasFocus()) cleanup();
                        }, 250);
                    });
                };

                await lostFocus();
                if (broadcastCancelRef.current) break;
                if (broadcastPauseRef.current) continue;
                await regainedFocus();
                if (broadcastCancelRef.current) break;
                if (broadcastPauseRef.current) continue;

                // Tiny breather so the next window.open() isn't fired in the
                // exact same focus tick (some browsers swallow that).
                await new Promise(res => setTimeout(res, 350));
            }
        }
        setBroadcastInProgress(false);
        if (!broadcastCancelRef.current) {
            setBroadcastNote('All chats opened. Tap Send in the last WhatsApp window to finish.');
        }
    };

    useEffect(() => {
        fetch(certTemplateEndpoint)
            .then(r => r.ok ? r.json() : { items: [] })
            .then(d => {
                const all = (d.items || []) as DesignTemplate[];
                setStudioTemplates(all.filter(t => t.published));
            })
            .catch(() => {});
    }, []);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    
    const isCompleted = training.status === 'Completed';
    const isOngoing = training.status === 'Ongoing';
    const canModify = training.createdByEntityId === currentUserEntityId;
    const isOnTime = isCompleted && (() => {
        const trainingDate = new Date(training.date);
        const today = new Date();
        return trainingDate.getFullYear() === today.getFullYear() && trainingDate.getMonth() === today.getMonth() && trainingDate.getDate() === today.getDate();
    })();

    const statusStyles = {
        'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'Ongoing': 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
        'Upcoming': 'bg-amber-50 text-amber-700 border-amber-100'
    };

    const qrPayload = `TRAINING_AUTH_LOG\nID:${training.id}\nTOPIC:${training.topic}\nDATE:${training.date}\nTRAINER:${training.trainer}`;

    const sessionParticipants = useMemo(() => {
        const statusPriority: Record<string, number> = { 'neutral': 0, 'present': 1, 'absent': 2 };

        return (training.participantList || [])
            .map(p => ({
                employee: allEmployees.find(emp => emp.id === p.employeeId),
                status: p.status,
                addedAt: p.addedAt
            }))
            .filter(item => {
                const isValid = !!item.employee;
                if (!isValid) return false;
                if (participantFilter === 'all') return true;
                return item.status === participantFilter;
            })
            .sort((a, b) => {
                const priorityA = statusPriority[a.status];
                const priorityB = statusPriority[b.status];
                if (priorityA !== priorityB) return priorityA - priorityB;
                return b.addedAt - a.addedAt;
            });
    }, [allEmployees, training.participantList, participantFilter]);

    useEffect(() => {
        if (!showRegistrants && !isManaged) return;
        setLoadingReg(true);
        fetch(`/api/training-register?sessionId=${encodeURIComponent(training.id)}`)
            .then(r => r.ok ? r.json() : { items: [] })
            .then(d => {
                const items = d.items || [];
                setRegistrants(items);
                const map: Record<string, 'present' | 'absent' | 'neutral'> = {};
                for (const r of items) map[r.id] = r.attendanceStatus || 'neutral';
                setRegAttendance(map);
            })
            .catch(() => setRegistrants([]))
            .finally(() => setLoadingReg(false));
    }, [showRegistrants, isManaged, training.id, regRefreshKey]);

    const sessionShortCode = (id: string): string => {
        let h = 0;
        for (let i = 0; i < id.length; i++) h = Math.imul(31, h) + id.charCodeAt(i) | 0;
        return Math.abs(h).toString(36).padStart(6, '0').slice(0, 6);
    };
    const regUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${sessionShortCode(training.id)}` : `/r/${sessionShortCode(training.id)}`;

    const copyRegLink = () => {
        navigator.clipboard.writeText(regUrl);
        setRegCopied(true);
        setTimeout(() => setRegCopied(false), 2500);
    };

    const handleCardThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { alert('Image must be under 3 MB.'); return; }
        const reader = new FileReader();
        reader.onload = () => {
            setThumbSaving(true);
            onUpdateThumbnail(training.id, reader.result as string, true);
            setTimeout(() => { setThumbSaving(false); setThumbSaved(true); setTimeout(() => setThumbSaved(false), 2500); }, 900);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRefreshPreviewLink = () => {
        setThumbSaving(true);
        onUpdateThumbnail(training.id, training.thumbnailImage || '', true);
        setTimeout(() => { setThumbSaving(false); setThumbSaved(true); setTimeout(() => setThumbSaved(false), 2500); }, 900);
    };

    const handleAddParticipants = (newStaff: EmployeeRecord[]) => {
        const timestamp = Date.now();
        const nextList = [
            ...newStaff.map(s => ({ employeeId: s.id, status: 'neutral' as const, addedAt: timestamp })),
            ...(training.participantList || [])
        ];
        onUpdateParticipants(training.id, nextList);
    };

    const handleRemoveParticipant = (empId: string) => {
        if(confirm("Remove this staff member from the training session registry?")) {
            const nextList = (training.participantList || []).filter(p => p.employeeId !== empId);
            onUpdateParticipants(training.id, nextList);
        }
    };

    const handleStatusUpdate = (empId: string, nextStatus: 'present' | 'absent' | 'neutral') => {
        const nextList = (training.participantList || []).map(p => 
            p.employeeId === empId ? { ...p, status: nextStatus } : p
        );
        onUpdateParticipants(training.id, nextList);
    };

    const saveRegAttendance = (regId: string, status: 'present' | 'absent' | 'neutral') => {
        fetch('/api/training-register', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: regId, attendanceStatus: status }),
        }).catch(console.error);
    };

    const handleRegStatusChange = (regId: string, st: 'present' | 'absent' | 'neutral') => {
        setRegAttendance(prev => ({ ...prev, [regId]: st }));
        saveRegAttendance(regId, st);
    };

    const bulkMarkStatus = (targetStatus: 'present' | 'absent' | 'neutral') => {
        const nextList = (training.participantList || []).map(p => ({ ...p, status: targetStatus }));
        onUpdateParticipants(training.id, nextList);
        if (registrants.length > 0) {
            const newMap: Record<string, 'present' | 'absent' | 'neutral'> = {};
            for (const r of registrants) newMap[r.id] = targetStatus;
            setRegAttendance(newMap);
            registrants.forEach(r => saveRegAttendance(r.id, targetStatus));
        }
    };

    const commitAllAttendance = () => {
        registrants.forEach(r => {
            const st = regAttendance[r.id] || 'neutral';
            saveRegAttendance(r.id, st);
        });
    };

    const handleFilterAnalytics = (status: 'present' | 'absent' | 'neutral') => {
        if (participantFilter === status) {
            setParticipantFilter('all');
        } else {
            setParticipantFilter(status);
            if (!isManaged) onManageToggle();
        }
    };

    const certTraining: CertTraining = {
        topic: training.topic,
        subTopic: training.subTopic,
        trainer: training.trainer,
        trainerScope: training.trainerScope,
        externalCompany: training.externalCompany,
        date: training.date,
        startTime: training.startTime,
        endTime: training.endTime,
        location: training.location,
        mode: training.mode,
        trainingHours: training.trainingHours,
    };

    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [bulkProgress, setBulkProgress] = useState('');
    const [singleCertDownloading, setSingleCertDownloading] = useState(false);
    // Per-row "email cert in progress" tracking. Keyed by registrantId for
    // external registrants and employee.id for internal staff. Using a Set
    // (rather than a single boolean) lets the admin fire off several
    // certificate emails in parallel without one row blocking the others.
    const [activeEmailCertIds, setActiveEmailCertIds] = useState<Set<string>>(new Set());
    // Same per-row in-flight tracking as email cert sends but for the
    // WhatsApp document path. Kept as a separate set so an admin can
    // fire both channels for the same row without one disabling the other.
    const [activeWhatsAppCertIds, setActiveWhatsAppCertIds] = useState<Set<string>>(new Set());
    const markWhatsAppCertActive = (id: string) => {
        setActiveWhatsAppCertIds(prev => { const n = new Set(prev); n.add(id); return n; });
    };
    const clearWhatsAppCertActive = (id: string) => {
        setActiveWhatsAppCertIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    };
    const markEmailCertActive = (id: string) => {
        setActiveEmailCertIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };
    const clearEmailCertActive = (id: string) => {
        setActiveEmailCertIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };
    // Per-row "Email Link" loading state — keyed by registrant id so multiple
    // rows don't fight over a single global spinner.
    const [emailingMeetingLinkId, setEmailingMeetingLinkId] = useState<string | null>(null);
    const emailMeetingLinkToOne = async (registrant: any) => {
        if (emailingMeetingLinkId) return;
        const recipient = String(registrant?.email || '').trim();
        if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
            alert('This registrant has no valid email address on file.');
            return;
        }
        if (!String(training.meetingLink || '').trim()) {
            alert('No meeting link is saved on this session yet — open Edit and add one first.');
            return;
        }
        setEmailingMeetingLinkId(String(registrant.id));
        try {
            // Same admin-token header the bulk broadcast uses — without it
            // the API rejects the request with 401 and we show the misleading
            // "sign-in required" alert even after the user has signed in.
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const res = await fetch('/api/training-register/broadcast-meeting-link', {
                method:      'POST',
                credentials: 'include',
                headers:     { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    sessionId:     training.id,
                    registrantIds: [registrant.id],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success !== true) {
                if (res.status === 401 || res.status === 403) {
                    alert('Admin sign-in required. Open "Send Meeting Link" once to sign in, then try again.');
                } else {
                    alert(data?.error || `Send failed (HTTP ${res.status}).`);
                }
                return;
            }
            const sent = Number(data?.totals?.sent || 0);
            const failed = Number(data?.totals?.failed || 0);
            if (sent > 0) {
                // Reflect the new "sent at" stamp locally so the badge flips
                // to "Resend Link" without a full page refresh.
                const stamp = new Date().toISOString();
                setRegistrants(prev => prev.map((r: any) => r.id === registrant.id
                    ? { ...r, meetingLinkEmailSentAt: stamp, meetingLinkEmailLast: training.meetingLink }
                    : r));
                alert(`Meeting link emailed to ${recipient}.`);
            } else if (failed > 0) {
                const reason = data?.failures?.[0]?.reason || 'Unknown error';
                alert(`Send failed: ${reason}`);
            } else {
                alert('Nothing to send — the row may have been skipped (no email or duplicate address).');
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to email meeting link. Please try again.');
        } finally {
            setEmailingMeetingLinkId(null);
        }
    };
    const bulkRenderRef = useRef<HTMLDivElement>(null);

    // Build a certificate PDF for a participant and return both the jsPDF
    // instance (for save) and a base64 string (for emailing as attachment).
    // Centralised so download + email use exactly the same render pipeline.
    const buildCertificatePdf = async (participant: CertParticipant): Promise<{ pdf: any; base64: string; filename: string } | null> => {
        const tmpl = selectedCertTemplateId
            ? studioTemplates.find(t => t.id === selectedCertTemplateId)
            : studioTemplates[0];
        if (!tmpl) {
            setCertTarget({ participant, training: certTraining });
            return null;
        }
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');
        const base = `${participant.name}-${certTraining.topic}-${certTraining.date}`;
        let h = 0;
        for (let i = 0; i < base.length; i++) h = Math.imul(31, h) + base.charCodeAt(i) | 0;
        const certId = `SFM-${Math.abs(h).toString(36).toUpperCase().padStart(6, '0')}`;
        const fDate = new Date(certTraining.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const vars: Record<string, string> = {
            name: participant.name, topic: certTraining.topic, trainer: certTraining.trainer,
            date: fDate, timeFrom: certTraining.startTime, timeTo: certTraining.endTime,
            location: certTraining.location || '', certId,
            org: participant.organization || '', designation: participant.designation || participant.profession || '',
        };
        const qrData = JSON.stringify({ certId, participant: participant.name, course: certTraining.topic, date: certTraining.date, trainer: certTraining.trainer, verified: true });
        const container = bulkRenderRef.current;
        if (!container) return null;
        const root = (await import('react-dom/client')).createRoot(container);
        try {
            await new Promise<void>(resolve => {
                root.render(React.createElement(StudioCertificateRender, { template: tmpl, vars, qrData }));
                // Was 250ms — most of that is React commit + paint, which on
                // modern browsers settles in well under a frame. 80ms gives
                // a comfortable safety margin and shaves ~170ms per cert.
                setTimeout(resolve, 80);
            });
            // Scale was 4 (16x pixels). Bulk renders are PNG-encoded and
            // dropped into a 297mm A4 PDF; scale 2 keeps print quality but
            // cuts the html2canvas + toDataURL cost roughly 4x.
            const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
            pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
            const safe = participant.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
            const filename = `Certificate_${safe}.pdf`;
            // jsPDF's `output('datauristring')` includes a `data:application/pdf;base64,` prefix.
            // Strip it so callers always get a raw base64 string they can attach to email.
            const dataUri = pdf.output('datauristring') as string;
            const base64  = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
            return { pdf, base64, filename };
        } finally {
            root.unmount();
        }
    };

    const downloadCertDirect = async (participant: CertParticipant) => {
        if (singleCertDownloading || bulkDownloading) return;
        setSingleCertDownloading(true);
        try {
            const out = await buildCertificatePdf(participant);
            if (!out) return;
            out.pdf.save(out.filename);
        } catch (err) {
            console.error('Certificate download failed:', err);
            alert('Failed to generate certificate. Please try again.');
        } finally {
            setSingleCertDownloading(false);
        }
    };

    // Generate the certificate locally and email it to the participant as a
    // PDF attachment in a single click.
    const emailCertDirect = async (participant: CertParticipant & { keyId?: string }) => {
        // Block ONLY when bulk is running (which writes to the same registrants
        // state) — individual single-row sends can run in parallel.
        // We also block on bulkWhatsAppingCerts because both bulk paths
        // share the same offscreen `bulkRenderRef` for PDF rendering.
        if (bulkDownloading || bulkEmailingCerts || bulkWhatsAppingCerts) {
            alert('Please wait for the bulk operation to finish before emailing individual certificates.');
            return;
        }
        const recipient = String(participant.email || '').trim();
        if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
            alert('This participant has no valid email address on file.');
            return;
        }
        // Per-row in-flight key. Falls back to the recipient email so we still
        // dedupe rapid double-clicks even when no explicit id was passed.
        const rowKey = String(participant.keyId || (participant as any).registrantId || recipient);
        if (activeEmailCertIds.has(rowKey)) return; // already sending for this row
        markEmailCertActive(rowKey);
        try {
            const out = await buildCertificatePdf(participant);
            if (!out) return;
            // Send the admin-token header so the API doesn't 401 — same fix
            // as the meeting-link broadcast.
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const regId = (participant as any).registrantId || '';
            const res = await fetch('/api/training-register/email-certificate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    to:           recipient,
                    name:         participant.name,
                    sessionTitle: certTraining.topic,
                    sessionDate:  new Date(certTraining.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                    trainer:      certTraining.trainer,
                    pdfBase64:    out.base64,
                    pdfFilename:  out.filename,
                    registrantId: regId || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success !== true) {
                const msg = data?.error || `Email failed (HTTP ${res.status}).`;
                if (res.status === 401 || res.status === 403) {
                    alert('Admin sign-in required to email certificates. Please open "Send Meeting Link" once to sign in, then try again.');
                } else {
                    alert(msg);
                }
                return;
            }
            // Stamp the local registrant row so the "Cert · <date>" badge
            // shows up immediately without needing a refresh.
            if (regId) {
                const stamp = new Date().toISOString();
                setRegistrants(prev => prev.map((r: any) =>
                    r.id === regId ? { ...r, certificateEmailSentAt: stamp } : r,
                ));
            }
            alert(`Certificate emailed to ${recipient}.`);
        } catch (err: any) {
            console.error('Certificate email failed:', err);
            alert(err?.message || 'Failed to email certificate. Please try again.');
        } finally {
            clearEmailCertActive(rowKey);
        }
    };

    const openCertForEmployee = (employee: EmployeeRecord) => {
        downloadCertDirect({
            name: employee.Name,
            email: employee.Email,
            phone: employee.Phone,
            profession: employee.Department,
            designation: employee.Role,
            organization: employee.Corporate,
            gender: employee.Gender,
            isExternal: false,
        });
    };

    const openCertForRegistrant = (r: any) => {
        downloadCertDirect({
            name: r.name,
            email: r.email,
            phone: r.whatsapp,
            profession: r.profession,
            designation: r.designation,
            organization: r.instituteName,
            country: r.country,
            gender: r.gender,
            isExternal: true,
        });
    };

    const handleBulkDownload = async () => {
        const pubTemplates = studioTemplates;
        const tmpl = selectedCertTemplateId ? pubTemplates.find(t => t.id === selectedCertTemplateId) : pubTemplates[0];
        if (!tmpl) { alert('No published certificate template found. Please create and publish one in Certificate Studio first.'); return; }
        const presentParticipants = (training.participantList || []).filter(p => p.status === 'present');
        if (presentParticipants.length === 0) { alert('No present participants to generate certificates for.'); return; }
        setBulkDownloading(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            for (let i = 0; i < presentParticipants.length; i++) {
                const p = presentParticipants[i];
                const emp = allEmployees.find(e => e.id === p.employeeId);
                if (!emp) continue;
                setBulkProgress(`${i + 1}/${presentParticipants.length} - ${emp.Name}`);
                const certId = `CERT-${training.id}-${emp.id}`.toUpperCase();
                const fDate = new Date(training.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const vars: Record<string, string> = {
                    name: emp.Name, topic: training.topic, trainer: training.trainer,
                    date: fDate,
                    timeFrom: new Date(training.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    timeTo: new Date(training.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    location: training.location || '', certId,
                    org: emp.Corporate || '', designation: emp.Role || '',
                };
                const qrData = JSON.stringify({ certId, name: emp.Name, topic: training.topic, date: training.date, trainer: training.trainer, verified: true });

                const container = bulkRenderRef.current;
                if (!container) continue;
                const root = (await import('react-dom/client')).createRoot(container);
                await new Promise<void>(resolve => {
                    root.render(
                        React.createElement(StudioCertificateRender, { template: tmpl, vars, qrData })
                    );
                    setTimeout(resolve, 200);
                });

                const canvas = await html2canvas(container, { scale: 4, useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0, allowTaint: true });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
                const pdfBlob = pdf.output('arraybuffer');
                const safeName = emp.Name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_');
                zip.file(`${safeName}_${certId}.pdf`, pdfBlob);
                root.unmount();
            }
            setBulkProgress('Zipping...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificates_${training.topic.replace(/\s+/g, '_')}_${training.id}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Bulk cert download failed:', err);
            alert('Failed to generate bulk certificates. Please try again.');
        } finally {
            setBulkDownloading(false);
            setBulkProgress('');
        }
    };

    // Bulk-email certificates to every present external registrant who has a
    // valid email on file. Generates each PDF locally (same render pipeline
    // as the single-row "Email Cert" button) and POSTs it to the API. Each
    // success stamps the row's certificateEmailSentAt so the "Cert · <date>"
    // badge appears immediately and the admin can see at a glance who's been
    // mailed and who hasn't.
    const [bulkEmailingCerts, setBulkEmailingCerts] = useState(false);
    const [bulkEmailCertProgress, setBulkEmailCertProgress] = useState('');
    // Bulk WhatsApp certificate send progress — twin of the email pair above.
    // Kept separate so the two bulk operations can run independently and
    // the UI can show each one's progress in its own button label.
    const [bulkWhatsAppingCerts, setBulkWhatsAppingCerts] = useState(false);
    const [bulkWhatsAppCertProgress, setBulkWhatsAppCertProgress] = useState('');
    // Filters for the participants panel: name search + certificate
    // sent/not-sent. They apply to BOTH internal staff and external
    // registrants so an admin can scan one combined list per session.
    const [regNameFilter, setRegNameFilter] = useState('');
    const [regCertFilter, setRegCertFilter] = useState<'all' | 'sent' | 'not_sent'>('all');
    // Payment & email filters for the registrants toolbar.
    // Payment values mirror the persisted `paymentStatus` column on
    // training_registrations: 'verified' | 'rejected' | 'pending' (null
    // when no payment proof has been uploaded yet — surfaced as "none").
    // Email values look at `emailSentAt` (registration-confirmation
    // email): 'sent' when the timestamp exists, 'not_sent' otherwise.
    // Both default to 'all' so no list contents change until an admin
    // explicitly picks a filter — preserving the current view.
    const [regPaymentFilter, setRegPaymentFilter] = useState<'all' | 'verified' | 'rejected' | 'pending' | 'none'>('all');
    const [regEmailFilter,   setRegEmailFilter]   = useState<'all' | 'sent' | 'not_sent'>('all');
    // Mobile-app feel: collapsible sections inside the participants panel
    // so the screen reads as a list-of-lists instead of one long scroll.
    const [staffSectionOpen,    setStaffSectionOpen]    = useState(true);
    const [externalSectionOpen, setExternalSectionOpen] = useState(true);
    // Bulk handlers can be triggered from the action bar before the user
    // ever expands the trainee-registrations panel — in that case the local
    // `registrants` state is still empty (it's lazy-loaded by the effect
    // gated on `showRegistrants || isManaged`). Fetching on demand here so
    // the bulk Email/WhatsApp buttons "just work" from the closed card too.
    const ensureRegistrantsLoaded = async (): Promise<any[]> => {
        if (registrants && registrants.length > 0) return registrants;
        try {
            const r = await fetch(`/api/training-register?sessionId=${encodeURIComponent(training.id)}`);
            const d = r.ok ? await r.json() : { items: [] };
            const items = d.items || [];
            if (items.length > 0) {
                setRegistrants(items);
                const map: Record<string, 'present' | 'absent' | 'neutral'> = {};
                for (const row of items) map[row.id] = row.attendanceStatus || 'neutral';
                setRegAttendance(prev => ({ ...map, ...prev })); // local edits win
            }
            return items;
        } catch {
            return [];
        }
    };
    const handleBulkEmailCertificates = async () => {
        if (bulkEmailingCerts || bulkDownloading || singleCertDownloading) return;
        // Block when a WhatsApp bulk send is mid-flight — both paths share
        // the same offscreen `bulkRenderRef` for PDF rendering, so running
        // them concurrently would risk attaching the wrong PDF to a row.
        if (bulkWhatsAppingCerts) {
            alert('A bulk WhatsApp certificate send is already in progress. Please wait for it to finish first.');
            return;
        }
        // Reuse the same template-resolution logic as the bulk download so
        // both paths render identical certificates.
        const tmpl = selectedCertTemplateId
            ? studioTemplates.find(t => t.id === selectedCertTemplateId)
            : studioTemplates[0];
        if (!tmpl) {
            alert('No published certificate template found. Please create and publish one in Certificate Studio first.');
            return;
        }
        const sourceRegs = await ensureRegistrantsLoaded();
        const candidates = (sourceRegs || []).filter((r: any) => {
            const isPresent = (regAttendance[r.id] || r.attendanceStatus) === 'present';
            const email     = String(r.email || '').trim();
            const validMail = !!email && /^\S+@\S+\.\S+$/.test(email);
            return isPresent && validMail;
        });
        if (candidates.length === 0) {
            alert('No present registrants with a valid email address to send certificates to.');
            return;
        }
        const alreadySent = candidates.filter((r: any) => r.certificateEmailSentAt).length;
        const proceed = window.confirm(
            `Email certificates to ${candidates.length} present registrant${candidates.length === 1 ? '' : 's'}?` +
            (alreadySent > 0 ? `\n\nNote: ${alreadySent} of them already received a certificate — they will be re-sent.` : ''),
        );
        if (!proceed) return;

        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        if (!adminToken) {
            // Don't dead-end with an alert — open the same admin sign-in
            // panel that the "Send Meeting Link" button uses so they can
            // sign in right here and retry without leaving the screen.
            openMeetingEmailModal();
            return;
        }

        setBulkEmailingCerts(true);
        setBulkEmailCertProgress('Starting…');
        let sentCount = 0, failedCount = 0, doneCount = 0;
        const failures: string[] = [];
        // Pipeline: PDF rendering must stay serial (it shares the offscreen
        // bulkRenderRef DOM container) but uploads can overlap. Keeping up
        // to SEND_CONCURRENCY uploads in flight lets the next PDF render
        // while the previous certificate is being delivered by SMTP.
        const SEND_CONCURRENCY = 4;
        const inflight = new Set<Promise<void>>();
        try {
            for (let i = 0; i < candidates.length; i++) {
                const r = candidates[i];
                setBulkEmailCertProgress(`Rendering ${i + 1}/${candidates.length} · ${r.name || r.email}`);
                let out: { pdf: any; base64: string; filename: string } | null = null;
                try {
                    out = await buildCertificatePdf({
                        name:         r.name,
                        email:        r.email,
                        phone:        r.whatsapp,
                        profession:   r.profession,
                        designation:  r.designation,
                        organization: r.instituteName,
                        country:      r.country,
                        gender:       r.gender,
                        isExternal:   true,
                        registrantId: r.id,
                    } as any);
                } catch (renderErr: any) {
                    failedCount++; doneCount++;
                    failures.push(`${r.name}: ${renderErr?.message || 'PDF generation failed'}`);
                    continue;
                }
                if (!out) { failedCount++; doneCount++; failures.push(`${r.name}: PDF generation failed`); continue; }
                const built = out;
                while (inflight.size >= SEND_CONCURRENCY) {
                    await Promise.race(inflight);
                }
                const task = (async () => {
                    try {
                        const res = await fetch('/api/training-register/email-certificate', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                            body: JSON.stringify({
                                to:           r.email,
                                name:         r.name,
                                sessionTitle: training.topic,
                                sessionDate:  new Date(training.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                                trainer:      training.trainer,
                                pdfBase64:    built.base64,
                                pdfFilename:  built.filename,
                                registrantId: r.id,
                            }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success !== true) {
                            failedCount++;
                            failures.push(`${r.name}: ${data?.error || `HTTP ${res.status}`}`);
                            return;
                        }
                        sentCount++;
                        const stamp = new Date().toISOString();
                        setRegistrants(prev => prev.map((row: any) =>
                            row.id === r.id ? { ...row, certificateEmailSentAt: stamp } : row,
                        ));
                    } catch (innerErr: any) {
                        failedCount++;
                        failures.push(`${r.name}: ${innerErr?.message || 'unknown error'}`);
                    } finally {
                        doneCount++;
                        setBulkEmailCertProgress(`Sent ${doneCount}/${candidates.length}`);
                    }
                })();
                inflight.add(task);
                task.finally(() => inflight.delete(task));
            }
            await Promise.allSettled(Array.from(inflight));
            const summary =
                `Bulk certificate email complete.\n` +
                `Sent: ${sentCount}\n` +
                `Failed: ${failedCount}` +
                (failures.length > 0 ? `\n\nFailures:\n• ${failures.slice(0, 8).join('\n• ')}` + (failures.length > 8 ? `\n…and ${failures.length - 8} more.` : '') : '');
            alert(summary);
        } catch (err: any) {
            console.error('Bulk cert email failed:', err);
            alert(err?.message || 'Bulk certificate email failed. Please try again.');
        } finally {
            setBulkEmailingCerts(false);
            setBulkEmailCertProgress('');
        }
    };

    // Single-row WhatsApp cert send. Mirrors emailCertDirect but POSTs the
    // generated PDF to the WhatsApp document route. Phone fallback order:
    // explicit `whatsapp` → `mobile` → no-op with a clear admin alert.
    const whatsappCertDirect = async (participant: CertParticipant & { keyId?: string }) => {
        // Block on email bulk too — both share `bulkRenderRef`.
        if (bulkDownloading || bulkWhatsAppingCerts || bulkEmailingCerts) {
            alert('Please wait for the bulk operation to finish before sending individual WhatsApp certificates.');
            return;
        }
        const phoneRaw = String((participant as any).phone || (participant as any).whatsapp || (participant as any).mobile || '').trim();
        // Indian default: if the registrant only entered the 10-digit local
        // mobile (no country code), prepend 91 so Meta accepts it. Mirrors
        // lib/whatsappSendCore.ts#normalizePhone so the UI gate matches.
        let phone = phoneRaw.replace(/[^\d]/g, '');
        if (phone.length === 10) phone = `91${phone}`;
        if (!phone || phone.length < 10) {
            alert('This participant has no valid WhatsApp number on file.');
            return;
        }
        const rowKey = String(participant.keyId || (participant as any).registrantId || phone);
        if (activeWhatsAppCertIds.has(rowKey)) return;
        markWhatsAppCertActive(rowKey);
        try {
            const out = await buildCertificatePdf(participant);
            if (!out) return;
            const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
            const regId = (participant as any).registrantId || '';
            const res = await fetch('/api/training-register/whatsapp-certificate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                body: JSON.stringify({
                    to:           phone,
                    name:         participant.name,
                    sessionTitle: certTraining.topic,
                    sessionDate:  new Date(certTraining.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                    pdfBase64:    out.base64,
                    pdfFilename:  out.filename,
                    registrantId: regId || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data?.success !== true) {
                const msg = data?.error || `WhatsApp send failed (HTTP ${res.status}).`;
                if (res.status === 401 || res.status === 403) {
                    alert('Admin sign-in required to send WhatsApp certificates. Please open "Send Meeting Link" once to sign in, then try again.');
                } else {
                    alert(msg);
                }
                return;
            }
            if (regId) {
                const stamp = new Date().toISOString();
                setRegistrants(prev => prev.map((r: any) =>
                    r.id === regId ? { ...r, certificateWhatsAppSentAt: stamp } : r,
                ));
            }
            alert(`Certificate sent on WhatsApp to ${phone}.`);
        } catch (err: any) {
            console.error('WhatsApp cert send failed:', err);
            alert(err?.message || 'Failed to send certificate on WhatsApp. Please try again.');
        } finally {
            clearWhatsAppCertActive(rowKey);
        }
    };

    // Bulk WhatsApp certificate send. Twin of handleBulkEmailCertificates —
    // walks every present registrant with a usable phone number, generates
    // each PDF locally and POSTs it to the WhatsApp document route. Each
    // success stamps `certificateWhatsAppSentAt` so the green "WA · <date>"
    // badge appears immediately without needing a refresh.
    const handleBulkWhatsAppCertificates = async () => {
        if (bulkWhatsAppingCerts || bulkDownloading || singleCertDownloading) return;
        // Same reason as the email-bulk guard above: both bulk paths share
        // `bulkRenderRef` for PDF rendering and must not interleave.
        if (bulkEmailingCerts) {
            alert('A bulk email certificate send is already in progress. Please wait for it to finish first.');
            return;
        }
        const tmpl = selectedCertTemplateId
            ? studioTemplates.find(t => t.id === selectedCertTemplateId)
            : studioTemplates[0];
        if (!tmpl) {
            alert('No published certificate template found. Please create and publish one in Certificate Studio first.');
            return;
        }
        const sourceRegs = await ensureRegistrantsLoaded();
        const candidates = (sourceRegs || []).filter((r: any) => {
            const isPresent = (regAttendance[r.id] || r.attendanceStatus) === 'present';
            // Indian default: 10-digit local numbers are treated as +91XXXXXXXXXX.
            let phone = String(r.whatsapp || r.mobile || '').replace(/[^\d]/g, '');
            if (phone.length === 10) phone = `91${phone}`;
            return isPresent && phone.length >= 10;
        });
        if (candidates.length === 0) {
            alert('No present registrants with a valid WhatsApp number to send certificates to.');
            return;
        }
        const alreadySent = candidates.filter((r: any) => r.certificateWhatsAppSentAt).length;
        const proceed = window.confirm(
            `Send certificates on WhatsApp to ${candidates.length} present registrant${candidates.length === 1 ? '' : 's'}?` +
            (alreadySent > 0 ? `\n\nNote: ${alreadySent} of them already received it on WhatsApp — they will be re-sent.` : ''),
        );
        if (!proceed) return;
        const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
        if (!adminToken) {
            openMeetingEmailModal();
            return;
        }
        setBulkWhatsAppingCerts(true);
        setBulkWhatsAppCertProgress('Starting…');
        let sentCount = 0, failedCount = 0, doneCount = 0;
        const failures: string[] = [];
        // Same pipelining strategy as the email bulk: serial render, up to
        // SEND_CONCURRENCY Meta Cloud API uploads in flight at once.
        const SEND_CONCURRENCY = 4;
        const inflight = new Set<Promise<void>>();
        try {
            for (let i = 0; i < candidates.length; i++) {
                const r = candidates[i];
                setBulkWhatsAppCertProgress(`Rendering ${i + 1}/${candidates.length} · ${r.name || r.whatsapp}`);
                let out: { pdf: any; base64: string; filename: string } | null = null;
                try {
                    out = await buildCertificatePdf({
                        name:         r.name,
                        email:        r.email,
                        phone:        r.whatsapp,
                        profession:   r.profession,
                        designation:  r.designation,
                        organization: r.instituteName,
                        country:      r.country,
                        gender:       r.gender,
                        isExternal:   true,
                        registrantId: r.id,
                    } as any);
                } catch (renderErr: any) {
                    failedCount++; doneCount++;
                    failures.push(`${r.name}: ${renderErr?.message || 'PDF generation failed'}`);
                    continue;
                }
                if (!out) { failedCount++; doneCount++; failures.push(`${r.name}: PDF generation failed`); continue; }
                const built = out;
                let phone = String(r.whatsapp || r.mobile || '').replace(/[^\d]/g, '');
                if (phone.length === 10) phone = `91${phone}`;
                const phoneFinal = phone;
                while (inflight.size >= SEND_CONCURRENCY) {
                    await Promise.race(inflight);
                }
                const task = (async () => {
                    try {
                        const res = await fetch('/api/training-register/whatsapp-certificate', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
                            body: JSON.stringify({
                                to:           phoneFinal,
                                name:         r.name,
                                sessionTitle: training.topic,
                                sessionDate:  new Date(training.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                                pdfBase64:    built.base64,
                                pdfFilename:  built.filename,
                                registrantId: r.id,
                            }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success !== true) {
                            failedCount++;
                            failures.push(`${r.name}: ${data?.error || `HTTP ${res.status}`}`);
                            return;
                        }
                        sentCount++;
                        const stamp = new Date().toISOString();
                        setRegistrants(prev => prev.map((row: any) =>
                            row.id === r.id ? { ...row, certificateWhatsAppSentAt: stamp } : row,
                        ));
                    } catch (innerErr: any) {
                        failedCount++;
                        failures.push(`${r.name}: ${innerErr?.message || 'unknown error'}`);
                    } finally {
                        doneCount++;
                        setBulkWhatsAppCertProgress(`Sent ${doneCount}/${candidates.length}`);
                    }
                })();
                inflight.add(task);
                task.finally(() => inflight.delete(task));
            }
            await Promise.allSettled(Array.from(inflight));
            const summary =
                `Bulk WhatsApp certificate send complete.\n` +
                `Sent: ${sentCount}\n` +
                `Failed: ${failedCount}` +
                (failures.length > 0 ? `\n\nFailures:\n• ${failures.slice(0, 8).join('\n• ')}` + (failures.length > 8 ? `\n…and ${failures.length - 8} more.` : '') : '');
            alert(summary);
        } catch (err: any) {
            console.error('Bulk WhatsApp cert send failed:', err);
            alert(err?.message || 'Bulk WhatsApp certificate send failed. Please try again.');
        } finally {
            setBulkWhatsAppingCerts(false);
            setBulkWhatsAppCertProgress('');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setIsUploadingPdf(true);
        try {
            const dataUrl = await compressPdfInBackground(file);
            onUploadSheet(training.id, dataUrl);
        } catch (err) {
            console.error('PDF upload failed:', err);
        } finally {
            setIsUploadingPdf(false);
        }
    };

    // --- CSV Actions ---
    const downloadCsvTemplate = () => {
        const worksheet = XLSX.utils.json_to_sheet([{
            'Name': 'James Smith',
            'Department': 'Kitchen',
            'ID Number': 'EMP1001',
            'Unit Name': 'NYC Central Kitchen'
        }]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        XLSX.writeFile(workbook, "Participant_Import_Template.xlsx");
    };

    // Export every participant for this session as a multi-sheet Excel workbook:
    //   • "Internal Roster"  — staff added from the org directory.
    //   • "Self-Registered"  — public sign-ups via the registration page.
    //   • "Summary"          — totals and session metadata.
    // We deliberately flatten every captured field (contact, attendance,
    // payment, link-broadcast stamps) so downstream tooling can pivot freely.
    const exportParticipantsExcel = () => {
        const fmtDate = (v?: string | number | null) => {
            if (!v) return '';
            const d = new Date(v);
            return isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-GB');
        };
        const empById = new Map(allEmployees.map(e => [e.id, e]));

        // ── Sheet 1: Internal roster (training.participantList) ──────────────
        const internalRows = (training.participantList || []).map((p, i) => {
            const e = empById.get(p.employeeId);
            return {
                'S.No':         i + 1,
                'Source':       'Internal',
                'Employee ID':  e?.ID || p.employeeId,
                'Name':         e?.Name || '(unknown employee)',
                'Email':        e?.Email || '',
                'Phone':        e?.Phone || '',
                'Gender':       e?.Gender || '',
                'Department':   e?.Department || '',
                'Role':         e?.Role || '',
                'Category':     e?.Category || '',
                'Unit':         e?.Unit || '',
                'Regional':     e?.Regional || '',
                'Corporate':    e?.Corporate || '',
                'Food Handler': e?.FoodHandler || '',
                'Status':       e?.Status || '',
                'Attendance':   p.status,
                'Added At':     fmtDate(p.addedAt),
            };
        });

        // ── Sheet 2: External / self-registered ──────────────────────────────
        const externalRows = registrants.map((r, i) => ({
            'S.No':                 i + 1,
            'Source':               'Self-Registered',
            'Name':                 r.name || '',
            'Email':                r.email || '',
            'Phone / WhatsApp':     r.whatsapp || r.phone || '',
            'Country':              r.country || '',
            'Gender':               r.gender || '',
            'Profession':           r.profession || '',
            'Designation':          r.designation || '',
            'Institute / FBO':      r.instituteName || '',
            'Batch ID':             r.batchId || '',
            'Batch Index':          r.batchIndex || '',
            'Batch Size':           r.batchSize || '',
            'Payment Status':       r.paymentStatus || (training.upiId ? 'Pending' : 'N/A'),
            'UTR Number':           r.utrNumber || '',
            'Coupon Used':          r.couponCode || '',
            'Amount Paid':          r.amountPaid ?? '',
            'Payment Screenshot':   r.paymentImage ? 'Yes' : '',
            'Attendance':           r.attendanceStatus || regAttendance[r.id] || 'neutral',
            'Group Link Sent At':   fmtDate(r.groupLinkSentAt),
            'Group Link Sent By':   r.groupLinkSentBy || '',
            'Meeting Email Sent':   fmtDate(r.meetingLinkEmailSentAt),
            'Certificate Issued':   r.certificateIssuedAt ? fmtDate(r.certificateIssuedAt) : '',
            'Registered At':        fmtDate(r.createdAt || r.registeredAt),
            'Registrant ID':        r.id,
        }));

        // ── Sheet 3: Summary ─────────────────────────────────────────────────
        const presentInternal = internalRows.filter(r => r['Attendance'] === 'present').length;
        const absentInternal  = internalRows.filter(r => r['Attendance'] === 'absent').length;
        const presentExternal = externalRows.filter(r => r['Attendance'] === 'present').length;
        const absentExternal  = externalRows.filter(r => r['Attendance'] === 'absent').length;
        const summaryRows = [
            { Field: 'Session Topic',          Value: training.topic },
            { Field: 'Sub Topic',              Value: training.subTopic || '' },
            { Field: 'Date',                   Value: training.date },
            { Field: 'Start Time',             Value: training.startTime },
            { Field: 'End Time',               Value: training.endTime },
            { Field: 'Trainer',                Value: training.trainer },
            { Field: 'Mode',                   Value: training.mode },
            { Field: 'Status',                 Value: training.status },
            { Field: 'Internal Participants',  Value: internalRows.length },
            { Field: '   • Present',           Value: presentInternal },
            { Field: '   • Absent',            Value: absentInternal },
            { Field: 'Self-Registered',        Value: externalRows.length },
            { Field: '   • Present',           Value: presentExternal },
            { Field: '   • Absent',            Value: absentExternal },
            { Field: 'Total Participants',     Value: internalRows.length + externalRows.length },
            { Field: 'Exported At',            Value: new Date().toLocaleString('en-GB') },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows),                          'Summary');
        if (internalRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(internalRows), 'Internal Roster');
        if (externalRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(externalRows), 'Self-Registered');
        // Always include at least one data sheet to avoid an empty workbook.
        if (!internalRows.length && !externalRows.length) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: 'No participants yet.' }]), 'Participants');
        }

        const safeTopic = (training.topic || 'Session').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
        const datePart  = (training.date || new Date().toISOString().slice(0, 10));
        XLSX.writeFile(wb, `Participants_${safeTopic}_${datePart}.xlsx`);
    };

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsCsvImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const buffer = evt.target?.result as ArrayBuffer;
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            setStagedCsvData(data);
            setIsCsvImporting(false);
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    return (
        // `overflow-hidden` on the card root clips every inner
        // section (action-bar tinted background, registrants panel,
        // expanded sub-panels) to the rounded corners. Without it,
        // the action-bar's bg-slate-50/60 fill spilled past the
        // 2.5rem corner radius on the left/right edges, making the
        // buttons look like they were rendering OUTSIDE the card —
        // see the user-reported screenshot.
        <div className={`group relative bg-white rounded-[2.5rem] border-2 overflow-hidden transition-all duration-500 flex flex-col shadow-sm hover:shadow-2xl hover:-translate-y-1 text-left ${isCompleted ? 'border-slate-100 hover:border-emerald-400' : 'border-slate-100 hover:border-indigo-400'} ${isManaged ? 'ring-4 ring-indigo-50 border-indigo-500' : ''} ${training.isActive === false ? 'opacity-60 grayscale-[0.4] bg-slate-50 border-dashed' : ''}`}>
            
            <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100 w-full min-h-[140px]">
                
                <div className="p-6 lg:p-8 lg:w-[25%] flex flex-col justify-center bg-white shrink-0 relative group/col1 overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-500 ${isCompleted ? 'bg-emerald-600' : isOngoing ? 'bg-blue-600' : 'bg-slate-900'}`} />
                    <div className="flex items-start gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shrink-0 ${isCompleted ? 'bg-emerald-600' : isOngoing ? 'bg-blue-600' : 'bg-slate-900'}`}>
                            {index.toString().padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black uppercase text-[9px] border shadow-sm ${statusStyles[training.status]}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-500' : isOngoing ? 'bg-blue-500' : 'bg-amber-500'}`} />
                                    {training.status}
                                </span>
                                {isOnTime && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black uppercase text-[8px] border shadow-sm bg-teal-50 text-teal-700 border-teal-200">
                                        <CheckCircle2 size={10} className="text-teal-500" />
                                        On Time
                                    </span>
                                )}
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">#{training.id}</span>
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors truncate mb-1">{training.topic}</h3>
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                <Layers size={14} className="text-indigo-500 shrink-0" />
                                <span className="truncate">{training.subTopic}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-slate-50/20 shrink-0">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 group/item">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover/item:text-indigo-600 transition-all border border-slate-100"><UserCheck size={20} /></div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Assigned Trainer</p>
                                <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight">{training.trainer}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{training.trainerScope === 'External' ? training.externalCompany : training.trainerScope}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 group/item">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover/item:text-purple-600 transition-all border border-slate-100"><MapPin size={20} /></div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Deployment Venue</p>
                                <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight">{training.mode} • {training.location || 'Central Node'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-white shrink-0">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 group/item">
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 group-hover/item:text-orange-500 transition-all"><Calendar size={20} /></div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Cycle Date</p>
                                <p className="text-lg font-black text-slate-900 tracking-tighter uppercase">{new Date(training.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 group/item">
                            <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 group-hover/item:text-blue-500 transition-all"><Clock size={20} /></div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Operational Window</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-slate-700">{new Date(training.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                    <ArrowRight size={12} className="text-slate-300" />
                                    <span className="text-sm font-black text-slate-700">{new Date(training.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 lg:p-8 lg:w-[18%] flex flex-col justify-center bg-slate-50/20 shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center leading-none">Registry Analytics</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handleFilterAnalytics('present')}
                            className={`flex flex-col items-center p-3 rounded-2xl border transition-all group/metric ${participantFilter === 'present' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg scale-105' : 'bg-white border-slate-100 shadow-sm hover:border-emerald-200'}`}
                        >
                             <span className={`text-[14px] font-black mb-1 group-hover/metric:scale-110 transition-transform ${participantFilter === 'present' ? 'text-white' : 'text-emerald-600'}`}>{training.participantsPresent || 0}</span>
                             <span className={`text-[8px] font-black uppercase tracking-tighter ${participantFilter === 'present' ? 'text-emerald-100' : 'text-slate-300'}`}>Present</span>
                        </button>
                        <button 
                            onClick={() => handleFilterAnalytics('absent')}
                            className={`flex flex-col items-center p-3 rounded-2xl border transition-all group/metric ${participantFilter === 'absent' ? 'bg-rose-600 border-rose-600 text-white shadow-lg scale-105' : 'bg-white border-slate-100 shadow-sm hover:border-rose-200'}`}
                        >
                             <span className={`text-[14px] font-black mb-1 group-hover/metric:scale-110 transition-transform ${participantFilter === 'absent' ? 'text-white' : 'text-rose-600'}`}>{training.participantsAbsent}</span>
                             <span className={`text-[8px] font-black uppercase tracking-tighter ${participantFilter === 'absent' ? 'text-rose-100' : 'text-slate-300'}`}>Absent</span>
                        </button>
                        <button 
                            onClick={() => handleFilterAnalytics('neutral')}
                            className={`flex flex-col items-center p-3 rounded-2xl border transition-all group/metric ${participantFilter === 'neutral' ? 'bg-amber-500 border-amber-500 text-white shadow-lg scale-105' : 'bg-white border-slate-100 shadow-sm hover:border-amber-200'}`}
                            title="Total public registrations"
                        >
                             <span className={`text-[14px] font-black mb-1 group-hover/metric:scale-110 transition-transform ${participantFilter === 'neutral' ? 'text-white' : 'text-amber-500'}`}>{registrationCount}</span>
                             <span className={`text-[8px] font-black uppercase tracking-tighter ${participantFilter === 'neutral' ? 'text-amber-100' : 'text-slate-300'}`}>Wait</span>
                        </button>
                        <div className="flex flex-col items-center p-3 rounded-2xl border bg-white border-slate-100 shadow-sm" title="Total registration page visits">
                             <span className="text-[14px] font-black mb-1 text-violet-500">{training.linkClicks || 0}</span>
                             <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300">Clicks</span>
                        </div>
                    </div>
                    {(training.couponDiscount || training.couponCommission) ? (
                        <div className="mt-3 flex gap-2">
                            {training.couponDiscount ? (
                                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 border border-violet-100 rounded-xl" title="Coupon discount for users">
                                    <Gift size={11} className="text-violet-500 shrink-0" />
                                    <span className="text-[9px] font-black text-violet-600 truncate">₹{training.couponDiscount.toLocaleString('en-IN')} off</span>
                                </div>
                            ) : null}
                            {training.couponCommission ? (
                                <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl" title="Commission earned per coupon use">
                                    <TrendingUp size={11} className="text-emerald-500 shrink-0" />
                                    <span className="text-[9px] font-black text-emerald-600 truncate">₹{training.couponCommission.toLocaleString('en-IN')} earn</span>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="p-6 lg:p-8 flex-1 flex flex-col justify-center items-center gap-4 bg-white relative min-w-0 lg:min-w-[200px]">
                    <div className="flex items-center gap-3 w-full">
                        <div className="relative group/qr p-2 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner cursor-pointer hover:border-indigo-400 transition-all shrink-0">
                            <div className="bg-white p-1.5 rounded-xl shadow-sm">
                                <QRCodeSVG value={qrPayload} size={40} level="H" includeMargin={false} />
                            </div>
                            <div className="absolute -top-1.5 -right-1.5 p-1.5 bg-white rounded-full shadow-md scale-0 group-hover/qr:scale-100 transition-transform border border-slate-100"><QrCode size={12} className="text-indigo-600"/></div>
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter truncate">Ref: {training.uploadedDate || 'Sync Pending'}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                {isUploadingPdf ? (
                                    <span className="text-[10px] font-black uppercase flex items-center gap-1.5 text-amber-500">
                                        <Loader2 size={14} className="animate-spin" /> Compressing...
                                    </span>
                                ) : (
                                    <button 
                                        onClick={() => training.sheetUrl ? setShowPdfViewer(true) : null}
                                        disabled={!training.sheetUrl}
                                        className={`text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${training.sheetUrl ? 'text-indigo-600 hover:underline' : 'text-slate-300 cursor-not-allowed'}`}
                                    >
                                        <Eye size={14}/> View PDF
                                    </button>
                                )}
                                {canModify && training.sheetUrl && (
                                    <button 
                                        onClick={() => onRemoveSheet(training.id)}
                                        className="p-1 text-rose-300 hover:text-rose-600 transition-colors"
                                        title="Remove PDF"
                                    >
                                        <FileMinus size={12} />
                                    </button>
                                )}
                                {canModify && !training.sheetUrl && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-1 text-slate-300 hover:text-indigo-600 transition-colors"
                                        title="Upload PDF"
                                    >
                                        <FilePlus size={12} />
                                    </button>
                                )}
                                <input 
                                    ref={fileInputRef}
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                        </div>
                    </div>
                    {showPdfViewer && training.sheetUrl && (
                        <div 
                            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                            onClick={() => setShowPdfViewer(false)}
                        >
                            <div 
                                className="bg-white w-full max-w-4xl h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100"><FileText size={18} /></div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Training Material</h3>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{training.topic} — {training.subTopic}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={training.sheetUrl}
                                            download={`Training_${training.id}.pdf`}
                                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-1.5"
                                        >
                                            <Download size={13} /> Download
                                        </a>
                                        <button 
                                            onClick={() => setShowPdfViewer(false)} 
                                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 bg-slate-100">
                                    {training.sheetUrl.startsWith('data:') ? (
                                        <object
                                            data={training.sheetUrl}
                                            type="application/pdf"
                                            className="w-full h-full"
                                        >
                                            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                                                <FileText size={48} className="text-slate-300" />
                                                <p className="text-sm font-bold text-slate-500">PDF preview not supported in this browser</p>
                                                <a
                                                    href={training.sheetUrl}
                                                    download={`Training_${training.id}.pdf`}
                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase"
                                                >
                                                    Download PDF
                                                </a>
                                            </div>
                                        </object>
                                    ) : (
                                        <iframe
                                            src={training.sheetUrl}
                                            className="w-full h-full border-0"
                                            title={`PDF Viewer — ${training.topic}`}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <button 
                        onClick={onManageToggle}
                        className={`w-full py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isManaged ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-900 text-white hover:bg-black'}`}
                    >
                        {isManaged ? 'Close Terminal' : 'Manage Node'} 
                        <ArrowRight size={18} className={`transition-transform duration-500 ${isManaged ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Hidden file input for quick thumbnail upload */}
            <input ref={cardThumbRef} type="file" accept="image/*" className="hidden" onChange={handleCardThumbUpload} />

            {/* Full-width action bar.
                Previously this was `flex-nowrap overflow-x-auto` with
                a hidden scrollbar — admins reported buttons (Instagram,
                LinkedIn, Update Thumbnail, Refresh Preview, Set as
                Popup, Edit, Delete) appearing to "go off the right
                edge" because there was no visible scrollbar telling
                them they could scroll, especially on the published
                deployment where the hierarchy/scope chrome eats more
                horizontal room. Switched to `flex-wrap` so every
                action stays visible — the row simply grows in height
                when there are too many buttons to fit on one line. */}
            <div className="border-t border-slate-100 px-4 py-3 flex flex-row flex-wrap gap-2 bg-slate-50/60">
                <button onClick={copyRegLink}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${regCopied ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white border-violet-200 hover:border-violet-600'}`}
                    title="Copy Trainee Registration Link">
                    {regCopied ? <><Check size={13}/> Copied!</> : <><Link2 size={13}/> Reg Link</>}
                </button>
                <button
                    onClick={handleBulkDownload}
                    disabled={bulkDownloading}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${bulkDownloading ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-200 hover:border-emerald-600'}`}
                    title="Download all certificates for present participants">
                    {bulkDownloading ? <><Loader2 size={13} className="animate-spin" /> {bulkProgress || 'Generating...'}</> : <><Download size={13} /> Bulk Certs</>}
                </button>
                <button
                    onClick={handleBulkEmailCertificates}
                    disabled={bulkEmailingCerts || bulkDownloading}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${bulkEmailingCerts ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border-amber-200 hover:border-amber-600'}`}
                    title="Email certificates to every present registrant with an email on file">
                    {bulkEmailingCerts ? <><Loader2 size={13} className="animate-spin" /> {bulkEmailCertProgress || 'Sending…'}</> : <><Mail size={13} /> Email Certs</>}
                </button>
                <button
                    onClick={handleBulkWhatsAppCertificates}
                    disabled={bulkWhatsAppingCerts || bulkDownloading}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${bulkWhatsAppingCerts ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-[#25D366] text-white hover:bg-[#1f9c4d] border-[#25D366] hover:border-[#1f9c4d]'}`}
                    title="Send the certificate PDF on WhatsApp (Meta template) to every present registrant with a phone number on file">
                    {bulkWhatsAppingCerts ? (
                      <><Loader2 size={13} className="animate-spin" /> {bulkWhatsAppCertProgress || 'Sending…'}</>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.849L0 24l6.336-1.498A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.491-5.19-1.352l-.372-.22-3.763.889.944-3.657-.241-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                        WA Certs
                      </>
                    )}
                </button>
                <button
                    onClick={onToggleActive}
                    title={training.isActive ? 'Deactivate this training calendar entry — hides it from the public Live Training Calendar, course popup, news ribbon and share-page advert' : 'Activate this training calendar entry — makes it visible on the public Live Training Calendar, course popup, news ribbon and share-page advert'}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${training.isActive ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${training.isActive ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                    {training.isActive ? 'Session Active' : 'Session Inactive'}
                </button>
                {training.whatsappLink && (
                  <a href={training.whatsappLink} target="whatsapp_web" rel="noopener noreferrer" title="Open the WhatsApp group invite (admin only — this just opens chat.whatsapp.com so you can join the group yourself; it does NOT send anything to participants)" className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-all shadow-sm active:scale-90 text-[10px] font-black uppercase tracking-wider">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0 text-[#25D366]"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.849L0 24l6.336-1.498A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.491-5.19-1.352l-.372-.22-3.763.889.944-3.657-.241-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    Join Group
                  </a>
                )}
                {/* One-click broadcast — opens a guided sweep that pops the
                    group invite into every registrant's wa.me chat in turn. */}
                <button
                    type="button"
                    onClick={openBroadcastModal}
                    disabled={!training.whatsappLink}
                    title={training.whatsappLink
                      ? 'Send the WhatsApp group link to every registered participant in one guided sweep'
                      : 'Add a WhatsApp group link in Edit before broadcasting'}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all shadow-sm active:scale-90 text-[10px] font-black uppercase tracking-wider ${training.whatsappLink ? 'border-[#25D366]/30 bg-[#25D366]/10 hover:bg-[#25D366] hover:text-white text-[#25D366]' : 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                >
                    <Send size={13} className="shrink-0" /> Send Group Link
                </button>
                {/* Email the joining/meeting link to all registrants in one click. */}
                <button
                    type="button"
                    onClick={openMeetingEmailModal}
                    title="Broadcast the meeting / joining link by email and/or WhatsApp to every registered participant"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 transition-all shadow-sm active:scale-90 text-[10px] font-black uppercase tracking-wider"
                >
                    <Send size={13} className="shrink-0" /> Broadcast Meeting Link
                </button>
                {training.instagramLink && (
                  <a href={training.instagramLink} target="_blank" rel="noopener noreferrer" title="Instagram" className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-pink-200 bg-pink-50 hover:bg-gradient-to-br hover:from-[#f09433] hover:to-[#bc1888] hover:text-white text-pink-600 transition-all shadow-sm active:scale-90 text-[10px] font-black uppercase tracking-wider">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </a>
                )}
                {training.linkedinLink && (
                  <a href={training.linkedinLink} target="_blank" rel="noopener noreferrer" title="LinkedIn" className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#0A66C2]/30 bg-[#0A66C2]/10 hover:bg-[#0A66C2] hover:text-white text-[#0A66C2] transition-all shadow-sm active:scale-90 text-[10px] font-black uppercase tracking-wider">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </a>
                )}
                {/* Thumbnail quick-upload */}
                <button
                    onClick={() => cardThumbRef.current?.click()}
                    disabled={thumbSaving}
                    title={training.thumbnailImage ? 'Change social media thumbnail' : 'Upload social media thumbnail'}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${thumbSaved ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-600 hover:text-white hover:border-amber-600'} ${thumbSaving ? 'opacity-60' : ''}`}
                >
                    {thumbSaving ? <Loader2 size={13} className="animate-spin"/> : thumbSaved ? <Check size={13}/> : <ImgIcon size={13}/>}
                    {thumbSaving ? 'Saving…' : thumbSaved ? 'Saved!' : training.thumbnailImage ? 'Update Thumbnail' : 'Add Thumbnail'}
                </button>
                {/* Refresh preview link — bumps thumbnailVersion to bust WhatsApp cache */}
                {training.thumbnailImage && (
                    <button
                        onClick={handleRefreshPreviewLink}
                        disabled={thumbSaving}
                        title="Regenerate social preview link — forces WhatsApp/Instagram to re-fetch the thumbnail"
                        className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${thumbSaved ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-600 hover:text-white hover:border-slate-600'} ${thumbSaving ? 'opacity-60' : ''}`}
                    >
                        {thumbSaving ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
                        Refresh Preview
                    </button>
                )}
                <button
                    onClick={onToggleFeature}
                    title={isFeatured ? 'Remove from popup — no session will be featured' : 'Feature this session in the registration popup'}
                    className={`shrink-0 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-90 border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${isFeatured ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white hover:border-amber-500'}`}
                >
                    <Megaphone size={13} /> {isFeatured ? 'Featured Popup ✓' : 'Set as Popup'}
                </button>
                <button
                    onClick={openPromoModal}
                    title="Send a WhatsApp invite for this training to every opted-in LMS user with a phone number"
                    className="shrink-0 px-4 py-2.5 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366] hover:text-white rounded-xl transition-all shadow-sm active:scale-90 border border-[#25D366]/30 hover:border-[#25D366] flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"
                >
                    <Megaphone size={14}/> Promote on WhatsApp
                </button>
                <button onClick={onEdit} className="shrink-0 px-4 py-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90 border border-indigo-200 hover:border-indigo-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider" title="Edit Session"><Edit size={14}/> Edit</button>
                <button onClick={onDuplicate} className="shrink-0 px-4 py-2.5 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90 border border-sky-200 hover:border-sky-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider" title="Duplicate this session — creates an inactive copy with the same content but no registrants, ready for you to adjust the date and re-publish"><Copy size={14}/> Duplicate</button>
                {canModify && <button onClick={onDelete} className="shrink-0 p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-xs active:scale-90 border border-transparent hover:border-rose-100" title="Delete Session"><Trash2 size={14}/></button>}
            </div>

            {/* Trainee Registrations Panel */}
            <div className="border-t border-slate-100">
                <div
                    onClick={() => setShowRegistrants(p => !p)}
                    className="w-full flex items-center justify-between px-6 py-3 hover:bg-violet-50 transition-colors group cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-violet-700 transition-colors flex-wrap">
                        <ClipboardList size={14} />
                        Trainee Registrations
                        {registrants.length > 0 && (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black">{registrants.length}</span>
                        )}
                        {(() => {
                            // Prefer in-memory registrants when loaded so the pill
                            // refreshes instantly during a broadcast; otherwise fall
                            // back to the per-session aggregate so every card shows
                            // the indicator on first render without opening the panel.
                            const total     = registrants.length > 0 ? registrants.length : registrationCount;
                            const sentCount = registrants.length > 0
                                ? registrants.filter(r => !!r.groupLinkSentAt).length
                                : Math.min(groupLinkSentCount, total);
                            if (total === 0) return null;
                            const allSent = sentCount === total;
                            return (
                                <span
                                    title={allSent
                                        ? 'WhatsApp group link broadcast to every registrant'
                                        : `${total - sentCount} registrant${(total - sentCount) === 1 ? '' : 's'} still need the WhatsApp group link`}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${allSent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                                >
                                    <Send size={9} />
                                    Group link sent: {sentCount} of {total}
                                </span>
                            );
                        })()}
                    </div>
                    <div className="flex items-center gap-2">
                        {showRegistrants && (
                            <span
                                onClick={e => { e.stopPropagation(); setRegRefreshKey(k => k + 1); }}
                                role="button"
                                tabIndex={0}
                                title="Refresh registrations"
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-violet-100 hover:text-violet-600 transition-all cursor-pointer"
                            >
                                <RefreshCw size={11} className={loadingReg ? 'animate-spin' : ''} />
                            </span>
                        )}
                        <span
                            onClick={e => { e.stopPropagation(); copyRegLink(); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); copyRegLink(); } }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border cursor-pointer ${regCopied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100'}`}
                        >
                            {regCopied ? <><Check size={11}/> Copied!</> : <><Copy size={11}/> Copy Link</>}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${showRegistrants ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {showRegistrants && (
                    <div className="px-6 pb-5">
                        {loadingReg ? (
                            <div className="py-6 text-center">
                                <Loader2 size={18} className="animate-spin text-violet-400 mx-auto" />
                            </div>
                        ) : registrants.length === 0 ? (
                            <div className="py-6 text-center">
                                <ClipboardList size={28} className="text-slate-200 mx-auto mb-2" />
                                <p className="text-[11px] text-slate-400 font-bold">No registrations yet.</p>
                                <p className="text-[10px] text-slate-300 mt-1">Share the registration link so trainees can sign up.</p>
                            </div>
                        ) : (() => {
                            const uninvitedCount  = registrants.filter(r => !r.groupLinkSentAt).length;
                            const displayedRegistrants = showOnlyUninvited
                                ? registrants.filter(r => !r.groupLinkSentAt)
                                : registrants;
                            return (
                                <>
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => setShowOnlyUninvited(v => !v)}
                                            disabled={uninvitedCount === 0 && !showOnlyUninvited}
                                            title={showOnlyUninvited
                                                ? 'Showing only registrants who have not been broadcast the WhatsApp group link yet'
                                                : uninvitedCount === 0
                                                    ? 'Every registrant has already received the WhatsApp group link'
                                                    : `Show only the ${uninvitedCount} registrant${uninvitedCount === 1 ? '' : 's'} who haven't received the WhatsApp group link yet`}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${showOnlyUninvited
                                                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                : uninvitedCount === 0
                                                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                                        >
                                            <Filter size={10} />
                                            Show only un-invited
                                            <span className={`px-1.5 py-px rounded-full text-[8px] ${showOnlyUninvited ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                {uninvitedCount}
                                            </span>
                                            {showOnlyUninvited && <X size={10} strokeWidth={3} />}
                                        </button>
                                        {showOnlyUninvited && displayedRegistrants.length === 0 && (
                                            <span className="text-[10px] font-bold text-emerald-600">
                                                Every registrant has been invited.
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                        {displayedRegistrants.map((r: any, i: number) => (
                                    <div key={r.id || i} className="flex items-start gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                                            {(r.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-800 truncate">{r.name}</span>
                                                {r.profession && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-md">{r.profession}</span>
                                                )}
                                                {r.gender && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{r.gender}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                                {r.email && <span className="text-[10px] text-slate-400 truncate">{r.email}</span>}
                                                {(r.whatsapp || r.mobile) && <span className="text-[10px] text-slate-400">{r.whatsapp || r.mobile}</span>}
                                                <RegistrantPhoneCell
                                                    registrant={r}
                                                    defaultWaCode={defaultWaCode}
                                                    regionDefaultWaCode={regionDefaultWaCode}
                                                    onUpdateContact={async (regId, next) => {
                                                        const res = await fetch('/api/training-register', {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ id: regId, ...next }),
                                                        });
                                                        if (!res.ok) {
                                                            const data = await res.json().catch(() => ({}));
                                                            throw new Error(data?.error || 'Failed to update phone number');
                                                        }
                                                        setRegistrants(prev => prev.map(reg =>
                                                            reg.id === regId ? { ...reg, ...next } : reg
                                                        ));
                                                    }}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${r.emailSentAt ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : r.emailSentAtFailedAt ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                                    title={r.emailSentAt ? `Email sent ${new Date(r.emailSentAt).toLocaleDateString('en-GB')}` : r.emailSentAtFailedAt ? `Email FAILED ${new Date(r.emailSentAtFailedAt).toLocaleString('en-GB')} — ${r.emailSentAtError?.message || 'unknown error'}` : 'Email not yet sent'}>
                                                    <Mail size={8} />
                                                    {r.emailSentAt ? '✓' : r.emailSentAtFailedAt ? '!' : '✗'}
                                                </span>
                                                <span className={`flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${r.whatsappSentAt ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                                    title={r.whatsappSentAt ? `WhatsApp sent ${new Date(r.whatsappSentAt).toLocaleDateString('en-GB')}` : 'WhatsApp not sent'}>
                                                    <MessageCircle size={8} />
                                                    {r.whatsappSentAt ? '✓' : '✗'}
                                                </span>
                                                {r.verificationEmailSentAt && (
                                                    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200"
                                                        title={`Verification email sent ${new Date(r.verificationEmailSentAt).toLocaleDateString('en-GB')}`}>
                                                        <Send size={8} />✓
                                                    </span>
                                                )}
                                                {r.verificationWaSentAt && (
                                                    <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30"
                                                        title={`Verification WhatsApp sent ${new Date(r.verificationWaSentAt).toLocaleDateString('en-GB')}`}>
                                                        <Send size={8} />✓
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                                {r.instituteName && <span className="text-[10px] text-slate-400 font-semibold truncate">{r.instituteName}</span>}
                                                {r.country && <span className="text-[10px] text-slate-300">{r.country}</span>}
                                            </div>
                                        </div>
                                        <div className="text-[9px] text-slate-300 font-bold shrink-0 text-right">
                                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                                        </div>
                                    </div>
                                ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {isManaged && (
                <div className="w-full bg-white border-t-2 border-indigo-100 animate-in slide-in-from-top-6 duration-700">
                    <div className="px-10 py-8 bg-slate-50/80 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
                         <div className="flex items-center gap-6">
                            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><Users size={28} /></div>
                            <div className="min-w-0">
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">Participant Registry Ledger</h4>
                                <div className="flex items-center gap-2">
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Synchronization Node • Latest First Sort Enabled</p>
                                    {participantFilter !== 'all' && (
                                        <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase animate-in zoom-in">
                                            <span>Filtering by: {participantFilter}</span>
                                            <button onClick={() => setParticipantFilter('all')} className="hover:text-red-300">
                                                <X size={10} strokeWidth={4} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                         </div>
                         
                         <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto text-left">
                            <StaffSelectorDropdown 
                                employees={allEmployees} 
                                onAdd={handleAddParticipants}
                                existingIds={(training.participantList || []).map(p => p.employeeId)}
                            />

                            <div className="h-10 w-px bg-slate-200 hidden md:block mx-2" />
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => csvInputRef.current?.click()}
                                    className="px-4 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                                >
                                    {isCsvImporting ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />} 
                                    Import CSV
                                </button>
                                <input 
                                    type="file" 
                                    ref={csvInputRef} 
                                    className="hidden" 
                                    accept=".csv, .xlsx" 
                                    onChange={handleCsvUpload} 
                                />
                                {/* One-click full participant export — internal roster
                                    + external self-registrants on two sheets, with all
                                    captured fields (contact, attendance, payment, link
                                    delivery stamps). */}
                                <button
                                    onClick={() => exportParticipantsExcel()}
                                    className="px-4 py-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95"
                                    title="Download every participant (internal + self-registered) with all captured fields as an Excel workbook"
                                >
                                    <Download size={16} /> Export Excel
                                </button>
                                <button 
                                    onClick={downloadCsvTemplate}
                                    className="p-3 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl hover:text-indigo-600 hover:bg-white transition-all shadow-xs"
                                    title="Download CSV import template"
                                >
                                    <FileUp size={18} />
                                </button>
                            </div>

                            <div className="h-10 w-px bg-slate-200 hidden md:block mx-2" />
                            
                            <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200 shadow-inner">
                                <button 
                                    onClick={() => bulkMarkStatus('present')}
                                    className="px-3 py-2 bg-white rounded-xl text-[9px] font-black uppercase text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Mark All Present"
                                >
                                    <Zap size={12} fill="currentColor" /> All Pres.
                                </button>
                                <button 
                                    onClick={() => bulkMarkStatus('absent')}
                                    className="px-3 py-2 bg-white rounded-xl text-[9px] font-black uppercase text-rose-600 hover:bg-rose-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 mx-1"
                                    title="Mark All Absent"
                                >
                                    <X size={12} strokeWidth={3} /> All Abs.
                                </button>
                                <button 
                                    onClick={() => bulkMarkStatus('neutral')}
                                    className="px-3 py-2 bg-white rounded-xl text-[9px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Reset to Neutral"
                                >
                                    <RotateCcw size={12} strokeWidth={3} /> Reset
                                </button>
                            </div>
                         </div>

                         {studioTemplates.length > 0 && (
                            <div className="px-10 py-4 bg-amber-50/50 border-b border-amber-100 flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Award size={16} className="text-amber-600" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Certificate Template</span>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-amber-50 transition-all min-w-[220px] justify-between shadow-sm"
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            <Layers size={12} className="text-amber-500 shrink-0" />
                                            {selectedCertTemplateId
                                                ? studioTemplates.find(t => t.id === selectedCertTemplateId)?.name || 'Default'
                                                : studioTemplates[0]?.name || 'Default'}
                                        </span>
                                        <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                    </button>
                                    {showTemplatePicker && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowTemplatePicker(false)} />
                                            <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-xl py-1 w-72 max-h-60 overflow-y-auto">
                                                {studioTemplates.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => { setSelectedCertTemplateId(t.id); setShowTemplatePicker(false); }}
                                                        className={`w-full px-4 py-2.5 text-left text-[11px] font-bold hover:bg-slate-50 flex items-center gap-2 transition-all ${(selectedCertTemplateId || studioTemplates[0]?.id) === t.id ? 'text-amber-700 bg-amber-50' : 'text-slate-600'}`}
                                                    >
                                                        <Layers size={12} className="shrink-0" /> 
                                                        <span className="truncate">{t.name}</span>
                                                        <span className="ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[7px] font-black uppercase shrink-0">Published</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="text-[9px] text-amber-600/60 font-bold italic">Selected template will be used for all certificates in this session</span>
                            </div>
                         )}
                    </div>
                    
                    <div className="flex flex-col bg-white">
                        {sessionParticipants.length === 0 && registrants.length === 0 ? (
                            <div className="py-32 text-center flex flex-col items-center">
                                {participantFilter !== 'all' ? (
                                    <>
                                        <FilterX size={72} className="mb-8 text-slate-200 opacity-20" />
                                        <p className="text-lg font-black uppercase text-slate-300 tracking-[0.3em]">No {participantFilter} Nodes</p>
                                        <button 
                                            onClick={() => setParticipantFilter('all')}
                                            className="mt-4 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all"
                                        >
                                            Clear Result Filter
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Users size={72} className="mb-8 text-slate-200 opacity-20" />
                                        <p className="text-lg font-black uppercase text-slate-300 tracking-[0.3em]">Zero Active Nodes</p>
                                        <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-bold italic">Initialize registry by enrolling personnel from the catalog.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Mobile-style sticky search bar — applies to BOTH the
                                    internal staff list AND the external registrants list
                                    below, so admins can scan one combined panel per
                                    session. Sits at the top of the participants area
                                    and stays visible while scrolling. */}
                                {/* Redesigned filter toolbar.
                                    Three labeled chip groups (Payment, Email,
                                    Certificate) sit under the search input so
                                    admins can drill down on the published
                                    database with one tap each. Each group's
                                    active chip is colour-coded to match the
                                    badge it filters for (emerald = good /
                                    sent / verified, amber = pending /
                                    awaiting, rose = rejected, slate = no
                                    proof). Counts are shown in the section
                                    headers using live data from the
                                    registrants array so the admin always
                                    knows how many records the chip will
                                    match BEFORE clicking. */}
                                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-3 flex flex-col gap-3 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="relative flex-1 min-w-[200px]">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="search"
                                                value={regNameFilter}
                                                onChange={(e) => setRegNameFilter(e.target.value)}
                                                placeholder="Search participants by name, email, phone…"
                                                className="w-full pl-9 pr-3 py-2.5 text-[12px] font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:bg-white placeholder:text-slate-400 placeholder:font-medium placeholder:italic"
                                            />
                                        </div>
                                        {(regNameFilter
                                            || regCertFilter    !== 'all'
                                            || regPaymentFilter !== 'all'
                                            || regEmailFilter   !== 'all') && (
                                            <button
                                                onClick={() => {
                                                    setRegNameFilter('');
                                                    setRegCertFilter('all');
                                                    setRegPaymentFilter('all');
                                                    setRegEmailFilter('all');
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all shrink-0"
                                                title="Clear all filters"
                                            >
                                                <X size={11} strokeWidth={3} /> Clear All
                                            </button>
                                        )}
                                    </div>
                                    {(() => {
                                        // Count how many external registrants
                                        // would match each chip — these counts
                                        // help an admin decide whether a chip
                                        // is worth clicking (e.g. don't click
                                        // "Rejected" if the count is 0).
                                        const pVerified = registrants.filter(r => r.paymentStatus === 'verified').length;
                                        const pRejected = registrants.filter(r => r.paymentStatus === 'rejected').length;
                                        const pPending  = registrants.filter(r => r.paymentStatus === 'pending' || (r.paymentScreenshot && !r.paymentStatus)).length;
                                        const pNone     = registrants.filter(r => !r.paymentScreenshot && !r.paymentStatus).length;
                                        const eSent     = registrants.filter(r => !!r.emailSentAt).length;
                                        const eNotSent  = registrants.length - eSent;
                                        const cSent     = registrants.filter(r => !!r.certificateEmailSentAt).length;
                                        const cNotSent  = registrants.length - cSent;
                                        const groups = [
                                            {
                                                label: 'Payment',
                                                value: regPaymentFilter,
                                                setter: setRegPaymentFilter as (v: string) => void,
                                                opts: [
                                                    { id: 'all',      label: 'All',          count: registrants.length, tone: 'slate'   as const },
                                                    { id: 'verified', label: '✓ Verified',   count: pVerified,           tone: 'emerald' as const },
                                                    { id: 'pending',  label: '⏳ Pending',    count: pPending,            tone: 'amber'   as const },
                                                    { id: 'rejected', label: '✗ Rejected',   count: pRejected,           tone: 'rose'    as const },
                                                    { id: 'none',     label: '— No Proof',   count: pNone,               tone: 'slate'   as const },
                                                ],
                                            },
                                            {
                                                label: 'Reg. Email',
                                                value: regEmailFilter,
                                                setter: setRegEmailFilter as (v: string) => void,
                                                opts: [
                                                    { id: 'all',      label: 'All',          count: registrants.length, tone: 'slate'   as const },
                                                    { id: 'sent',     label: '✓ Sent',       count: eSent,               tone: 'emerald' as const },
                                                    { id: 'not_sent', label: '✗ Not Sent',   count: eNotSent,            tone: 'amber'   as const },
                                                ],
                                            },
                                            {
                                                label: 'Certificate',
                                                value: regCertFilter,
                                                setter: setRegCertFilter as (v: string) => void,
                                                opts: [
                                                    { id: 'all',      label: 'All',          count: registrants.length, tone: 'slate'   as const },
                                                    { id: 'sent',     label: '✓ Released',   count: cSent,               tone: 'emerald' as const },
                                                    { id: 'not_sent', label: '○ Pending',    count: cNotSent,            tone: 'amber'   as const },
                                                ],
                                            },
                                        ];
                                        // Tone → active/idle classNames. Kept
                                        // verbose so Tailwind's JIT picks up
                                        // every colour at build time.
                                        const toneActive: Record<string, string> = {
                                            slate:   'bg-slate-700 text-white border-slate-700',
                                            emerald: 'bg-emerald-500 text-white border-emerald-500',
                                            amber:   'bg-amber-500 text-white border-amber-500',
                                            rose:    'bg-rose-500 text-white border-rose-500',
                                        };
                                        const toneIdle: Record<string, string> = {
                                            slate:   'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
                                            emerald: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
                                            amber:   'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
                                            rose:    'bg-white text-rose-700 border-rose-200 hover:bg-rose-50',
                                        };
                                        return (
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5 sm:flex-wrap">
                                                {groups.map(group => (
                                                    <div key={group.label} className="flex flex-col gap-1.5 min-w-0">
                                                        <span className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400 pl-1">{group.label}</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.opts.map(opt => {
                                                                const active = group.value === opt.id;
                                                                const disabled = opt.id !== 'all' && opt.count === 0 && !active;
                                                                return (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        disabled={disabled}
                                                                        onClick={() => group.setter(opt.id)}
                                                                        title={disabled ? `No registrants match "${opt.label}"` : `Filter by ${group.label} → ${opt.label}`}
                                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${active ? toneActive[opt.tone] : toneIdle[opt.tone]} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                                    >
                                                                        <span>{opt.label}</span>
                                                                        <span className={`px-1.5 py-px rounded-full text-[8px] ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{opt.count}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                                {(() => {
                                    // Build filtered internal staff list — same name and
                                    // cert-status filters as the external registrants below.
                                    const nameQ = regNameFilter.trim().toLowerCase();
                                    const filteredStaff = sessionParticipants.filter(item => {
                                        const emp = item.employee!;
                                        // Internal staff have no per-row certificateEmailSentAt
                                        // tracking. Treat them as "not sent" (always) for the
                                        // cert filter — when admin filters by Sent, hide them;
                                        // when filtering by Not Sent, show them.
                                        if (regCertFilter === 'sent') return false;
                                        // Internal staff also never have payment proof or a
                                        // registration-confirmation email — those flows only
                                        // run for external public registrants. So if the admin
                                        // narrows by ANY non-'all' Payment or Reg.Email filter,
                                        // hide internal staff entirely (they would otherwise
                                        // pollute a "verified payments" or "email sent" view).
                                        if (regPaymentFilter !== 'all') return false;
                                        if (regEmailFilter   !== 'all') return false;
                                        if (!nameQ) return true;
                                        const hay = [emp.Name, emp.Email, emp.Phone, emp.Corporate, emp.Department, emp.Role]
                                            .map(v => String(v || '').toLowerCase())
                                            .join(' ');
                                        return hay.includes(nameQ);
                                    });
                                    return (
                                        <>
                                            {sessionParticipants.length > 0 && (
                                                <button
                                                    onClick={() => setStaffSectionOpen(s => !s)}
                                                    className="w-full flex items-center gap-3 px-5 py-3 bg-slate-50/80 border-y border-slate-200 hover:bg-slate-100 transition-colors text-left"
                                                >
                                                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${staffSectionOpen ? '' : '-rotate-90'}`} />
                                                    <Users size={13} className="text-slate-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Internal Staff</span>
                                                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[9px] font-black">{filteredStaff.length}{filteredStaff.length !== sessionParticipants.length ? ` / ${sessionParticipants.length}` : ''}</span>
                                                </button>
                                            )}
                                            {staffSectionOpen && filteredStaff.map(item => (
                                                <StaffMemberRow
                                                    key={item.employee!.id}
                                                    employee={item.employee!}
                                                    status={item.status as any}
                                                    onStatusChange={(st) => handleStatusUpdate(item.employee!.id, st)}
                                                    onRemove={() => handleRemoveParticipant(item.employee!.id)}
                                                    onCertificate={() => openCertForEmployee(item.employee!)}
                                                    onEmailCertificate={() => emailCertDirect({
                                                        name: item.employee!.Name,
                                                        email: item.employee!.Email,
                                                        phone: item.employee!.Phone,
                                                        profession: item.employee!.Department,
                                                        designation: item.employee!.Role,
                                                        organization: item.employee!.Corporate,
                                                        gender: item.employee!.Gender,
                                                        isExternal: false,
                                                        keyId: item.employee!.id,
                                                    })}
                                                    emailingCert={activeEmailCertIds.has(item.employee!.id)}
                                                    onWhatsAppCertificate={() => whatsappCertDirect({
                                                        name: item.employee!.Name,
                                                        email: item.employee!.Email,
                                                        phone: item.employee!.Phone,
                                                        profession: item.employee!.Department,
                                                        designation: item.employee!.Role,
                                                        organization: item.employee!.Corporate,
                                                        gender: item.employee!.Gender,
                                                        isExternal: false,
                                                        keyId: item.employee!.id,
                                                    })}
                                                    whatsappingCert={activeWhatsAppCertIds.has(item.employee!.id)}
                                                />
                                            ))}
                                        </>
                                    );
                                })()}
                                {registrants.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => setExternalSectionOpen(s => !s)}
                                            className="w-full flex items-center gap-3 px-5 py-3 bg-violet-50/60 border-y border-violet-100 hover:bg-violet-100/60 transition-colors text-left"
                                        >
                                            <ChevronDown size={14} className={`text-violet-500 transition-transform ${externalSectionOpen ? '' : '-rotate-90'}`} />
                                            <ClipboardList size={13} className="text-violet-500 shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-700">External Registrants</span>
                                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[9px] font-black">{registrants.length}</span>
                                            <span className="text-[9px] text-slate-400 font-bold hidden sm:inline">— Public sign-ups</span>
                                        </button>
                                        {externalSectionOpen && (loadingReg ? (
                                            <div className="py-10 text-center"><Loader2 size={18} className="animate-spin text-violet-400 mx-auto" /></div>
                                        ) : (() => {
                                            // Group registrants by batchId so each row's "Batch i/N"
                                            // pill can show a tooltip listing the other members.
                                            const batches = new Map<string, BatchMember[]>();
                                            for (const reg of registrants) {
                                                const bid = reg.batchId;
                                                if (!bid) continue;
                                                if (!batches.has(bid)) batches.set(bid, []);
                                                batches.get(bid)!.push({
                                                    id: reg.id,
                                                    name: reg.name || '(unnamed)',
                                                    index: Number(reg.batchIndex) || 0,
                                                });
                                            }
                                            // Apply name + cert-status filters before sorting so the
                                            // visible list always matches the toolbar selections.
                                            const nameQ = regNameFilter.trim().toLowerCase();
                                            const filteredRegistrants = registrants.filter((r: any) => {
                                                // "Sent" now means a certificate went out via either
                                                // channel (email or WhatsApp). Keeps the filter useful
                                                // for sessions where some attendees are reached on
                                                // WhatsApp only and never had an email on file.
                                                {
                                                    const certSent = !!(r.certificateEmailSentAt || r.certificateWhatsAppSentAt);
                                                    if (regCertFilter === 'sent'     && !certSent) return false;
                                                    if (regCertFilter === 'not_sent' &&  certSent) return false;
                                                }
                                                // Payment filter — derive the effective status the
                                                // same way the per-row badge does: persisted
                                                // paymentStatus wins; if absent but a screenshot
                                                // exists, treat as 'pending'; if neither exists,
                                                // treat as 'none' (no proof uploaded).
                                                if (regPaymentFilter !== 'all') {
                                                    const eff = r.paymentStatus
                                                        ? r.paymentStatus
                                                        : (r.paymentScreenshot ? 'pending' : 'none');
                                                    if (eff !== regPaymentFilter) return false;
                                                }
                                                // Reg-email filter — emailSentAt presence.
                                                if (regEmailFilter === 'sent'     && !r.emailSentAt) return false;
                                                if (regEmailFilter === 'not_sent' &&  r.emailSentAt) return false;
                                                if (!nameQ) return true;
                                                const hay = [r.name, r.email, r.whatsapp, r.instituteName, r.profession]
                                                    .map(v => String(v || '').toLowerCase())
                                                    .join(' ');
                                                return hay.includes(nameQ);
                                            });
                                            // Sort by lowercased name so duplicate registrants
                                            // (same person registered twice/thrice) sit next to
                                            // each other for easier review and dedup decisions.
                                            const sortedRegistrants = [...filteredRegistrants].sort((a: any, b: any) => {
                                                const an = String(a.name || '').trim().toLowerCase();
                                                const bn = String(b.name || '').trim().toLowerCase();
                                                if (an && bn && an !== bn) return an.localeCompare(bn);
                                                if (an && !bn) return -1;
                                                if (!an && bn) return 1;
                                                // Same name (or both empty): keep newest first
                                                // by createdAt to preserve a stable, predictable order.
                                                const at = new Date(a.createdAt || 0).getTime();
                                                const bt = new Date(b.createdAt || 0).getTime();
                                                return bt - at;
                                            });
                                            return sortedRegistrants.map((r: any) => (
                                            <ExternalRegistrantRow
                                                key={r.id}
                                                registrant={r}
                                                batchMembers={r.batchId ? batches.get(r.batchId) : undefined}
                                                defaultWaCode={defaultWaCode}
                                                regionDefaultWaCode={regionDefaultWaCode}
                                                status={regAttendance[r.id] || 'neutral'}
                                                onStatusChange={(st) => handleRegStatusChange(r.id, st)}
                                                onCertificate={() => openCertForRegistrant(r)}
                                                onEmailCertificate={() => emailCertDirect({
                                                    name: r.name,
                                                    email: r.email,
                                                    phone: r.whatsapp,
                                                    profession: r.profession,
                                                    designation: r.designation,
                                                    organization: r.instituteName,
                                                    country: r.country,
                                                    gender: r.gender,
                                                    isExternal: true,
                                                    // pass the registrant id so the API can stamp
                                                    // certificateEmailSentAt for audit / UI badges.
                                                    ...(r.id ? { registrantId: r.id } : {}),
                                                    keyId: r.id,
                                                } as any)}
                                                emailingCert={activeEmailCertIds.has(r.id)}
                                                onWhatsAppCertificate={() => whatsappCertDirect({
                                                    name: r.name,
                                                    email: r.email,
                                                    phone: r.whatsapp || r.mobile,
                                                    profession: r.profession,
                                                    designation: r.designation,
                                                    organization: r.instituteName,
                                                    country: r.country,
                                                    gender: r.gender,
                                                    isExternal: true,
                                                    ...(r.id ? { registrantId: r.id } : {}),
                                                    keyId: r.id,
                                                } as any)}
                                                whatsappingCert={activeWhatsAppCertIds.has(r.id)}
                                                onEmailMeetingLink={() => emailMeetingLinkToOne(r)}
                                                emailingMeetingLink={emailingMeetingLinkId === r.id}
                                                canEmailMeetingLink={!!String(training.meetingLink || '').trim()}
                                                onPaymentVerify={async (regId, pStatus) => {
                                                    // When a payment is rejected we also auto-mark the
                                                    // registrant as absent — they didn't pay, so they
                                                    // can't attend / earn a certificate. This keeps the
                                                    // "Absent" tally and bulk-cert filter in sync without
                                                    // a second click.
                                                    const patch: Record<string, unknown> = { id: regId, paymentStatus: pStatus };
                                                    if (pStatus === 'rejected') patch.attendanceStatus = 'absent';
                                                    let res: Response;
                                                    try {
                                                        res = await fetch('/api/training-register', {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify(patch),
                                                        });
                                                    } catch (e) {
                                                        alert('Could not reach the server to update payment status. Please check your connection and try again.');
                                                        return;
                                                    }
                                                    // Surface server-side rejections (most commonly the
                                                    // verify-gate 409 when the event has "auto-send meeting
                                                    // link on payment verify" ON but no valid meeting link
                                                    // configured). Without this, the UI used to optimistically
                                                    // flip to "Verified" but the DB never changed — so a
                                                    // page refresh "unverified" the registrant. Now we read
                                                    // the error message and only mutate local state on success.
                                                    if (!res.ok) {
                                                        let serverMsg = '';
                                                        try {
                                                            const data = await res.json();
                                                            serverMsg = data?.error || '';
                                                        } catch {}
                                                        alert(serverMsg || `Could not update payment status (HTTP ${res.status}). Please try again.`);
                                                        return;
                                                    }
                                                    setRegistrants(prev => prev.map(reg =>
                                                        reg.id === regId
                                                            ? { ...reg, paymentStatus: pStatus, ...(pStatus === 'rejected' ? { attendanceStatus: 'absent' } : {}) }
                                                            : reg
                                                    ));
                                                    if (pStatus === 'rejected') {
                                                        setRegAttendance(prev => ({ ...prev, [regId]: 'absent' }));
                                                    }
                                                }}
                                                onUpdateContact={async (regId, next) => {
                                                    const res = await fetch('/api/training-register', {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: regId, ...next }),
                                                    });
                                                    if (!res.ok) {
                                                        const data = await res.json().catch(() => ({}));
                                                        throw new Error(data?.error || 'Failed to update phone number');
                                                    }
                                                    setRegistrants(prev => prev.map(reg =>
                                                        reg.id === regId ? { ...reg, ...next } : reg
                                                    ));
                                                }}
                                            />
                                        ));
                                        })())}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    
                    <div className="px-10 py-10 bg-slate-50 border-t border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-5">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner border border-emerald-100"><ShieldCheck size={32} /></div>
                            <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] max-w-lg leading-relaxed text-left">
                                <span className="text-slate-900">Digital Assurance:</span> All participant identities are verified nodes against the <span className="text-indigo-600">Enterprise Asset Vault</span>. Immutable digital trail active for this session.
                            </p>
                        </div>
                        <div className="flex gap-4 w-full lg:w-auto">
                            <button className="flex-1 lg:flex-none px-12 py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95">
                                Batch Archive
                            </button>
                            <button 
                                onClick={commitAllAttendance}
                                className="flex-1 lg:flex-none px-20 py-4 bg-indigo-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.25em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
                            >
                               <Save size={20} strokeWidth={2.5} /> Commit Attendance
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={bulkRenderRef} style={{ position: 'fixed', left: -9999, top: -9999, width: 794, height: 562, overflow: 'hidden', pointerEvents: 'none' }} />

            {certTarget && (
                <CertificateModal
                    participant={certTarget.participant}
                    training={certTarget.training}
                    onClose={() => setCertTarget(null)}
                    preselectedTemplateId={selectedCertTemplateId || studioTemplates[0]?.id || null}
                />
            )}

            {/* CSV Review Modal */}
            {stagedCsvData && (
                <CsvReviewModal 
                    stagedData={stagedCsvData}
                    allEmployees={allEmployees}
                    onConfirm={(matches) => {
                        handleAddParticipants(matches);
                        setStagedCsvData(null);
                    }}
                    onCancel={() => setStagedCsvData(null)}
                />
            )}

            {/* Email Meeting-Link Broadcast Modal */}
            {showMeetingEmailModal && typeof document !== 'undefined' && createPortal(
                // Portalled to <body> so the modal isn't trapped inside an
                // ancestor that uses CSS transform/filter (which would break
                // `position: fixed` and push the dialog far below the viewport,
                // making it look like a "blank scrollable page").
                <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={closeMeetingEmailModal}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-4 p-6 border-b border-slate-100">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1 inline-flex items-center gap-1">
                                    <Send size={12} /> Broadcast Meeting Link
                                </div>
                                <h3 className="text-lg font-black text-slate-900 truncate">{training.topic}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Sends the joining link to every registrant via the channels you choose below.</p>
                            </div>
                            <button onClick={closeMeetingEmailModal} disabled={meetingSending} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-50" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Inline admin sign-in. Bulk email is admin-only, but rather
                                than send the user back to the main login screen we let them
                                sign in right here so they don't lose their composed message. */}
                            {!hasAdminToken && (
                                <div className="px-3 py-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                                    <div>
                                        <strong>Admin sign-in required.</strong> Bulk email is restricted to admins. Sign in below to continue — your draft is preserved.
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                            type="email"
                                            value={inlineAdminEmail}
                                            onChange={e => setInlineAdminEmail(e.target.value)}
                                            disabled={inlineAdminBusy}
                                            placeholder="Admin email"
                                            autoComplete="email"
                                            className="text-xs border border-rose-200 bg-white rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none disabled:bg-slate-50"
                                        />
                                        <input
                                            type="password"
                                            value={inlineAdminPwd}
                                            onChange={e => setInlineAdminPwd(e.target.value)}
                                            disabled={inlineAdminBusy}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitInlineAdminLogin(); } }}
                                            placeholder="Admin password"
                                            autoComplete="current-password"
                                            className="text-xs border border-rose-200 bg-white rounded-lg px-3 py-2 focus:border-rose-400 focus:outline-none disabled:bg-slate-50"
                                        />
                                    </div>
                                    {inlineAdminErr && (
                                        <div className="text-rose-700 text-[11px]">{inlineAdminErr}</div>
                                    )}
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={submitInlineAdminLogin}
                                            disabled={inlineAdminBusy || !inlineAdminEmail.trim() || !inlineAdminPwd}
                                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
                                        >
                                            {inlineAdminBusy ? 'Signing in…' : 'Sign in as admin'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {hasAdminToken && (
                                <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] inline-flex items-center gap-1.5">
                                    <CheckCircle size={12} /> <span>Admin session active — ready to send.</span>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Meeting / Joining Link</label>
                                <input
                                    type="url"
                                    value={meetingLinkDraft}
                                    onChange={e => setMeetingLinkDraft(e.target.value)}
                                    disabled={meetingSending}
                                    placeholder="https://meet.google.com/abc-defg-hij"
                                    className="w-full text-sm font-mono border-2 border-slate-200 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">If you change the link here, it will also be saved on the session.</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Optional note (added to the email)</label>
                                <textarea
                                    rows={3}
                                    value={meetingNoteDraft}
                                    onChange={e => setMeetingNoteDraft(e.target.value)}
                                    disabled={meetingSending}
                                    placeholder="e.g. Please join 5 minutes early. Camera on, mic muted."
                                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-400 focus:outline-none disabled:bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Channels</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['email', 'whatsapp', 'both'] as const).map(opt => {
                                        const active = meetingChannels === opt;
                                        const label  = opt === 'email' ? 'Email only' : opt === 'whatsapp' ? 'WhatsApp only' : 'Email + WhatsApp';
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setMeetingChannels(opt)}
                                                disabled={meetingSending}
                                                className={`px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${active ? 'border-indigo-500 bg-indigo-600 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'} disabled:opacity-50`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5">WhatsApp uses the approved <code>haccp_training_meeting_link</code> Utility template. Recipients with no email or no phone are skipped automatically for that channel.</p>
                            </div>

                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={meetingOnlyUnsent}
                                    onChange={e => setMeetingOnlyUnsent(e.target.checked)}
                                    disabled={meetingSending}
                                    className="rounded border-slate-300 text-indigo-600"
                                />
                                Skip registrants who already received the link on the chosen channel(s) (recommended for retries — only failed/new recipients are sent)
                            </label>

                            {/* Live preview of who will (and won't) get this email,
                                computed from current registrants + the "skip already
                                sent" toggle, so admins can verify before clicking Send. */}
                            {(() => {
                                const isValidEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e);
                                type Row = { id: string; name: string; email: string; reason?: 'no-email' | 'already-sent' | 'duplicate' | 'will-send' };
                                // Track first-occurrence of each address (case-insensitive)
                                // so any later registrant with the same email is flagged
                                // as a duplicate and won't be re-emailed by the server.
                                const seenEmails = new Set<string>();
                                const rows: Row[] = registrants.map(r => {
                                    const email = String(r.email || '').trim();
                                    const name  = String(r.name  || '(unnamed)').trim();
                                    if (!email || !isValidEmail(email)) return { id: String(r.id), name, email, reason: 'no-email' };
                                    if (meetingOnlyUnsent && r.meetingLinkEmailSentAt) return { id: String(r.id), name, email, reason: 'already-sent' };
                                    const key = email.toLowerCase();
                                    if (seenEmails.has(key)) return { id: String(r.id), name, email, reason: 'duplicate' };
                                    seenEmails.add(key);
                                    return { id: String(r.id), name, email, reason: 'will-send' };
                                });
                                const willSend    = rows.filter(r => r.reason === 'will-send');
                                const noEmail     = rows.filter(r => r.reason === 'no-email');
                                const alreadySent = rows.filter(r => r.reason === 'already-sent');
                                const duplicate   = rows.filter(r => r.reason === 'duplicate');

                                if (rows.length === 0) {
                                    return (
                                        <div className="px-3 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                            No registrants found for <strong>{training.topic}</strong> yet — nothing to email.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                                            <div className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                                Recipients
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold flex-wrap">
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                    {willSend.length} will receive
                                                </span>
                                                {alreadySent.length > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                                        {alreadySent.length} already sent
                                                    </span>
                                                )}
                                                {duplicate.length > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                                        {duplicate.length} duplicate
                                                    </span>
                                                )}
                                                {noEmail.length > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                        {noEmail.length} no email
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                            {rows.map(r => (
                                                <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-slate-800 truncate">{r.name}</div>
                                                        <div className={`truncate text-[11px] ${r.email ? 'text-slate-500 font-mono' : 'text-amber-600 italic'}`}>
                                                            {r.email || 'No email on file'}
                                                        </div>
                                                    </div>
                                                    {r.reason === 'will-send'    && (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">Will send</span>
                                                    )}
                                                    {r.reason === 'already-sent' && (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-wider">Already sent</span>
                                                    )}
                                                    {r.reason === 'duplicate'    && (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-wider" title="Same email already used by another registrant — only one email will be sent">Duplicate</span>
                                                    )}
                                                    {r.reason === 'no-email'     && (
                                                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider">Skipped</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
                                The email will go to every registrant of <strong>{training.topic}</strong> with a valid email address. Registrants without an email are skipped automatically.
                            </div>

                            {meetingResult && !meetingResult.ok && (
                                <div className="px-3 py-2 rounded-lg border text-xs bg-rose-50 border-rose-200 text-rose-900">
                                    {meetingResult.message || 'Broadcast failed.'}
                                </div>
                            )}

                            {meetingResult && meetingResult.ok && (() => {
                                // CSV download helper. Quotes every field and escapes
                                // embedded quotes per RFC4180 so messy reasons (with
                                // commas/newlines) don't corrupt the export.
                                const downloadCsv = (filename: string, rows: Array<Record<string, string>>) => {
                                    if (rows.length === 0) return;
                                    const headers = Object.keys(rows[0]);
                                    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                    const lines = [
                                        headers.map(esc).join(','),
                                        ...rows.map(r => headers.map(h => esc(r[h] ?? '')).join(',')),
                                    ];
                                    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                                    const url  = URL.createObjectURL(blob);
                                    const a    = document.createElement('a');
                                    a.href = url; a.download = filename;
                                    document.body.appendChild(a); a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                };
                                const safeTopic = (training.topic || 'Training').replace(/[^\w\-]+/g, '_');
                                const safeDate  = (training.date  || '').replace(/[^\w\-]+/g, '_');
                                const exportSent = () => downloadCsv(
                                    `MeetingLink_Sent_${safeTopic}_${safeDate}.csv`,
                                    (meetingResult.successes || []).map(s => ({
                                        Name: s.name || '', Email: s.email || '',
                                    })),
                                );
                                const exportFailed = () => downloadCsv(
                                    `MeetingLink_Failed_${safeTopic}_${safeDate}.csv`,
                                    (meetingResult.failures || []).map(f => ({
                                        Name: f.name || '', Email: f.email || '', Reason: f.reason || '',
                                    })),
                                );
                                return (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                                        <div className="px-3 py-2 bg-emerald-100/80 border-b border-emerald-200 flex items-center gap-2 flex-wrap">
                                            <CheckCircle size={14} className="text-emerald-700" />
                                            <strong className="text-emerald-900 text-xs">Broadcast complete.</strong>
                                            <span className="text-[11px] text-emerald-800">{meetingResult.sent} of {meetingResult.considered} registrants emailed.</span>
                                        </div>
                                        {/* Big at-a-glance counters */}
                                        <div className="grid grid-cols-3 gap-2 p-3">
                                            <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Sent</div>
                                                <div className="text-2xl font-black text-emerald-700 leading-tight">{meetingResult.sent}</div>
                                            </div>
                                            <div className="rounded-lg bg-white border border-rose-200 px-3 py-2 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-widest text-rose-700">Failed</div>
                                                <div className="text-2xl font-black text-rose-700 leading-tight">{meetingResult.failed}</div>
                                            </div>
                                            <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-center">
                                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">Skipped</div>
                                                <div className="text-2xl font-black text-slate-700 leading-tight">{meetingResult.skipped}</div>
                                            </div>
                                        </div>
                                        {/* Export buttons */}
                                        <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={exportSent}
                                                disabled={!meetingResult.successes || meetingResult.successes.length === 0}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
                                                title="Download a CSV of every registrant who received the meeting link"
                                            >
                                                <Download size={12} /> Export sent ({meetingResult.successes?.length || 0})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={exportFailed}
                                                disabled={!meetingResult.failures || meetingResult.failures.length === 0}
                                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-rose-200 disabled:text-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
                                                title="Download a CSV of every failed attempt with the reason"
                                            >
                                                <Download size={12} /> Export failed ({meetingResult.failures?.length || 0})
                                            </button>
                                        </div>
                                        {/* Compact failures preview so admins can spot patterns
                                            (e.g. wrong domain) without opening the CSV. */}
                                        {(meetingResult.failures && meetingResult.failures.length > 0) && (
                                            <div className="border-t border-emerald-200 bg-white">
                                                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 border-b border-rose-100">
                                                    Failed attempts
                                                </div>
                                                <div className="max-h-40 overflow-y-auto divide-y divide-rose-50">
                                                    {meetingResult.failures.slice(0, 50).map(f => (
                                                        <div key={f.id} className="px-3 py-1.5 text-[11px]">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-bold text-slate-800 truncate">{f.name || '(unnamed)'}</span>
                                                                <span className="font-mono text-slate-500 truncate">{f.email}</span>
                                                            </div>
                                                            <div className="text-rose-600 truncate">{f.reason}</div>
                                                        </div>
                                                    ))}
                                                    {meetingResult.failures.length > 50 && (
                                                        <div className="px-3 py-1.5 text-[10px] text-slate-500 italic">
                                                            …and {meetingResult.failures.length - 50} more — see the CSV for the full list.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Email Open Tracking — historical view of who opened
                                the meeting-link email for this session. Pixel-based,
                                so subject to the well-known caveats noted below. */}
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                                    <Mail size={13} className="text-slate-600" />
                                    <strong className="text-slate-900 text-xs">Email opens</strong>
                                    <span className="text-[11px] text-slate-500">
                                        {emailOpens.totals.opened} / {emailOpens.totals.sent} opened
                                    </span>
                                    <button
                                        type="button"
                                        onClick={fetchEmailOpens}
                                        disabled={emailOpens.loading}
                                        className="ml-auto px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                                        title="Reload open status"
                                    >
                                        {emailOpens.loading ? <><Loader2 size={11} className="animate-spin" /> Refreshing</> : <>Refresh</>}
                                    </button>
                                </div>
                                {emailOpens.error && (
                                    <div className="px-3 py-2 text-[11px] text-rose-700 bg-rose-50 border-b border-rose-100">
                                        {emailOpens.error}
                                    </div>
                                )}
                                {emailOpens.loaded && !emailOpens.error && emailOpens.rows.length === 0 && (
                                    <div className="px-3 py-3 text-[11px] text-slate-500 italic">
                                        No tracked emails yet for this session. Opens appear here after a broadcast is sent and recipients view the email.
                                    </div>
                                )}
                                {emailOpens.rows.length > 0 && (
                                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                        {emailOpens.rows.map(r => {
                                            const opened = r.open_count > 0;
                                            return (
                                                <div key={r.id} className="px-3 py-1.5 text-[11px] flex items-center gap-2">
                                                    <span className={`shrink-0 inline-flex items-center justify-center w-2 h-2 rounded-full ${opened ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    <span className="font-bold text-slate-800 truncate w-28 sm:w-36">{r.recipient_name || '(unnamed)'}</span>
                                                    <span className="font-mono text-slate-500 truncate flex-1">{r.recipient_email}</span>
                                                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${opened ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                        {opened
                                                            ? `Opened ${r.open_count}× · ${new Date(r.last_opened_at!).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                                                            : 'Not opened'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="px-3 py-2 text-[10px] text-slate-500 bg-slate-50 border-t border-slate-100">
                                    Tracking is pixel-based: numbers may under-report (when a client blocks images) or over-report (Apple Mail Privacy / image proxies pre-load the pixel). Treat as an indicator, not a guarantee.
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                            <button
                                onClick={closeMeetingEmailModal}
                                disabled={meetingSending}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs font-black uppercase tracking-wider"
                            >
                                {meetingResult?.ok ? 'Done' : 'Close'}
                            </button>
                            <button
                                onClick={sendMeetingLinkBroadcast}
                                disabled={meetingSending || !meetingLinkDraft.trim()}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2"
                            >
                                {meetingSending
                                    ? (<><Loader2 size={13} className="animate-spin" /> Broadcasting…</>)
                                    : (<><Send size={13} /> {meetingResult?.ok
                                        ? 'Broadcast Again'
                                        : (meetingChannels === 'whatsapp' ? 'Send via WhatsApp' : meetingChannels === 'email' ? 'Send via Email' : 'Send Email + WhatsApp')}</>)}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {/* WhatsApp Group-Link Broadcast Modal */}
            {showBroadcastModal && (() => {
                const validRecipients   = broadcastRecipients.filter(r => r.waUrl && !r.invalid);
                const invalidRecipients = broadcastRecipients.filter(r => !r.waUrl || r.invalid);
                const selectedCount     = validRecipients.filter(r => broadcastSelected[r.id]).length;
                const allSelected       = validRecipients.length > 0 && selectedCount === validRecipients.length;
                const toggleAll = () => {
                    const next: Record<string, boolean> = {};
                    if (!allSelected) {
                        for (const r of validRecipients) {
                            if (broadcastSkipSent && r.groupLinkSentAt) continue;
                            next[r.id] = true;
                        }
                    }
                    setBroadcastSelected(next);
                };
                return (
                    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeBroadcastModal}>
                        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between gap-4 p-6 border-b border-slate-100">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">WhatsApp Group Broadcast</div>
                                    <h3 className="text-lg font-black text-slate-900 truncate">{training.topic}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Sequentially opens each registrant's WhatsApp chat with the invite. You tap Send in each window.</p>
                                </div>
                                <button onClick={closeBroadcastModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-5">
                                {training.whatsappLink ? (
                                    <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Group Invite Link</div>
                                        <a href={training.whatsappLink} target="whatsapp_web" rel="noopener noreferrer" className="font-mono text-[11px] break-all underline decoration-dotted hover:text-emerald-700">
                                            {training.whatsappLink}
                                        </a>
                                    </div>
                                ) : (
                                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                        No WhatsApp group link is saved on this session. Edit the session and add one before broadcasting.
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Message Template</label>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <select
                                                value={activeTemplateId || ''}
                                                disabled={broadcastInProgress}
                                                onChange={e => {
                                                    const v = e.target.value;
                                                    if (!v) { setActiveTemplateId(null); return; }
                                                    applyTemplate(v);
                                                }}
                                                className="text-[11px] font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:border-emerald-400 focus:outline-none disabled:bg-slate-50"
                                            >
                                                <option value="">— Saved templates ({broadcastTemplates.length}) —</option>
                                                {broadcastTemplates.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name}{t.isDefault ? '  ★ default' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                disabled={broadcastInProgress}
                                                onClick={() => { setShowSaveTemplateForm(s => !s); setNewTemplateName(activeTemplate?.name || ''); }}
                                                className="text-[10px] font-black uppercase tracking-wider px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                                Save as template
                                            </button>
                                        </div>
                                    </div>
                                    {showSaveTemplateForm && (
                                        <div className="mb-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-wrap items-center gap-2">
                                            <input
                                                type="text"
                                                value={newTemplateName}
                                                onChange={e => setNewTemplateName(e.target.value)}
                                                placeholder='e.g. "Standard invite"'
                                                disabled={broadcastInProgress}
                                                className="flex-1 min-w-[180px] text-xs font-semibold border border-emerald-200 rounded-lg px-3 py-1.5 bg-white focus:border-emerald-400 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                disabled={broadcastInProgress || !newTemplateName.trim()}
                                                onClick={saveAsNewTemplate}
                                                className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
                                            >
                                                Save new
                                            </button>
                                            {activeTemplate && (
                                                <button
                                                    type="button"
                                                    disabled={broadcastInProgress}
                                                    onClick={() => { overwriteActiveTemplate(); setShowSaveTemplateForm(false); }}
                                                    className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                                                >
                                                    Overwrite "{activeTemplate.name}"
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setShowSaveTemplateForm(false); setNewTemplateName(''); }}
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 text-slate-500 hover:text-slate-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                    <textarea
                                        value={broadcastMessage}
                                        onChange={e => setBroadcastMessage(e.target.value)}
                                        rows={5}
                                        disabled={broadcastInProgress}
                                        className="w-full text-sm font-mono border border-slate-200 rounded-xl px-3 py-2 focus:border-emerald-400 focus:outline-none disabled:bg-slate-50"
                                    />
                                    <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
                                        <p className="text-[10px] text-slate-400">Variables: <code>{'{firstName}'}</code> · <code>{'{name}'}</code> · <code>{'{trainingTitle}'}</code> · <code>{'{groupLink}'}</code></p>
                                        {activeTemplate && (
                                            <div className="flex items-center gap-3">
                                                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!activeTemplate.isDefault}
                                                        disabled={broadcastInProgress}
                                                        onChange={toggleActiveTemplateAsDefault}
                                                        className="rounded border-slate-300 text-emerald-600"
                                                    />
                                                    Default template
                                                </label>
                                                <button
                                                    type="button"
                                                    disabled={broadcastInProgress}
                                                    onClick={deleteActiveTemplate}
                                                    className="text-[10px] font-black uppercase tracking-wider text-rose-600 hover:text-rose-700"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={broadcastSkipSent}
                                            disabled={broadcastInProgress}
                                            onChange={e => {
                                                const skip = e.target.checked;
                                                setBroadcastSkipSent(skip);
                                                setBroadcastSelected(prev => {
                                                    const next = { ...prev };
                                                    for (const r of validRecipients) {
                                                        if (!r.groupLinkSentAt) continue;
                                                        if (skip) delete next[r.id];
                                                        else      next[r.id] = true;
                                                    }
                                                    return next;
                                                });
                                            }}
                                            className="rounded border-slate-300 text-emerald-600"
                                        />
                                        Skip registrants already broadcast to
                                    </label>
                                    <button
                                        type="button"
                                        onClick={toggleAll}
                                        disabled={broadcastInProgress || validRecipients.length === 0}
                                        className="text-[11px] font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700 disabled:text-slate-300"
                                    >
                                        {allSelected ? 'Clear all' : 'Select all'}
                                    </button>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                                        <span>Recipients</span>
                                        <span>{selectedCount} selected · {validRecipients.length} reachable · {invalidRecipients.length} skipped</span>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                        {broadcastRecipients.length === 0 && (
                                            <div className="p-4 text-xs text-slate-500">No registrants for this session yet.</div>
                                        )}
                                        {validRecipients.map(r => {
                                            const checked = !!broadcastSelected[r.id];
                                            return (
                                                <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-emerald-50/40 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={broadcastInProgress}
                                                        onChange={e => setBroadcastSelected(prev => ({ ...prev, [r.id]: e.target.checked }))}
                                                        className="rounded border-slate-300 text-emerald-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-800 truncate">{r.name}</div>
                                                        <div className="text-[11px] text-slate-500 truncate">{r.phone}</div>
                                                    </div>
                                                    {r.groupLinkSentAt && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[9px] font-black uppercase tracking-wider">
                                                            Sent {new Date(r.groupLinkSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                        {/* Invalid / unreachable recipients are surfaced explicitly so admins
                                            know exactly who's being skipped and why — not buried in a count. */}
                                        {invalidRecipients.map(r => {
                                            const reason = !r.phone
                                                ? 'No WhatsApp / mobile number on file'
                                                : 'Number doesn\'t match a known country format';
                                            return (
                                                <div key={r.id} className="flex items-center gap-3 px-3 py-2 bg-amber-50/40 cursor-not-allowed opacity-80">
                                                    <input type="checkbox" checked={false} disabled className="rounded border-slate-300" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-slate-500 truncate line-through decoration-slate-300">{r.name}</div>
                                                        <div className="text-[11px] text-amber-700 truncate flex items-center gap-1">
                                                            <AlertCircle size={10} className="shrink-0" /> {reason}{r.phone ? ` · ${r.phone}` : ''}
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[9px] font-black uppercase tracking-wider">Skipped</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {broadcastInProgress && (
                                    <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                                        Opening chat {broadcastIndex} of {broadcastTotal}…{broadcastPaused ? ' Paused.' : ''}
                                    </div>
                                )}
                                {broadcastNote && (
                                    <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                                        {broadcastNote}
                                    </div>
                                )}
                            </div>

                            <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                                {!broadcastInProgress && (
                                    <>
                                        <button
                                            onClick={closeBroadcastModal}
                                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-black uppercase tracking-wider"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={runBroadcast}
                                            disabled={!training.whatsappLink || selectedCount === 0}
                                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2"
                                        >
                                            <Send size={13} /> Start Broadcast ({selectedCount})
                                        </button>
                                    </>
                                )}
                                {broadcastInProgress && (
                                    <>
                                        <button
                                            onClick={() => {
                                                broadcastPauseRef.current = !broadcastPauseRef.current;
                                                setBroadcastPaused(broadcastPauseRef.current);
                                            }}
                                            className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-black uppercase tracking-wider"
                                        >
                                            {broadcastPaused ? 'Resume' : 'Pause'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                broadcastCancelRef.current = true;
                                                broadcastPauseRef.current  = false;
                                                setBroadcastPaused(false);
                                            }}
                                            className="px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-black uppercase tracking-wider"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Promote on WhatsApp — confirm modal */}
            {showPromoModal && (() => {
                // Are we actively running a background blast (worker not yet
                // finished)? Drives both the progress UI and whether the
                // close button is allowed to short-circuit polling.
                // 'cancelled' is terminal just like 'completed', so the
                // in-progress UI (and the close-button warning) flips off.
                const isCancelled = !!promoJob && promoJob.status === 'cancelled';
                const inProgress = !!promoJob && promoJob.status !== 'completed' && !isCancelled;
                const processed = promoJob ? (promoJob.succeeded + promoJob.failed) : 0;
                const total = promoJob?.total ?? 0;
                const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
                const cancelledCount = promoJob ? Math.max(0, total - processed) : 0;
                if (typeof document === 'undefined') return null;
                // Portal-mount to <body> so the modal escapes any transformed /
                // filtered ancestor in the SessionCard tree (those create new
                // containing blocks and break `position: fixed`, causing the
                // modal to "fluctuate" and scroll with the page instead of
                // staying centered over the viewport).
                return createPortal(
                <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { if (!inProgress) closePromoModal(); }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 bg-gradient-to-r from-[#128C7E] to-[#25D366] text-white flex items-center gap-3 flex-shrink-0">
                            <Megaphone size={20} />
                            <div>
                                <div className="text-sm font-black uppercase tracking-wider">Promote on WhatsApp</div>
                                <div className="text-[11px] opacity-90 truncate max-w-md">{training.topic}</div>
                            </div>
                        </div>
                        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                            {/* Pre-send confirmation panel */}
                            {!promoJob && !promoResult && (() => {
                                const payload = buildPromoPayload();
                                const friendlyTime = payload.time || '—';
                                const friendlyDate = payload.date || '—';
                                const friendlyTopic = payload.topic;
                                return (
                                <>
                                    <div className="text-xs text-slate-600 leading-relaxed">
                                        Sends a WhatsApp invite to every LMS user with a phone number on file (opted-in). Large blasts run in the background — you can safely close this window and re-open it later to check progress.
                                    </div>

                                    {/* WhatsApp-style message preview — shows admins exactly what
                                        recipients will see, including the per-training thumbnail
                                        that becomes the template's IMAGE header. */}
                                    <div className="rounded-2xl bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect width=%2260%22 height=%2260%22 fill=%22%23ECE5DD%22/><circle cx=%2210%22 cy=%2210%22 r=%221%22 fill=%22%23dcd3c5%22/><circle cx=%2240%22 cy=%2230%22 r=%221%22 fill=%22%23dcd3c5%22/></svg>')] p-4 border border-slate-200">
                                        <div className="bg-white rounded-xl rounded-tl-sm shadow-sm overflow-hidden max-w-[88%] text-[12px]">
                                            {training.thumbnailImage ? (
                                                <div className="aspect-[16/10] bg-slate-100">
                                                    <img src={training.thumbnailImage} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="aspect-[16/10] bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 text-[11px] font-semibold">
                                                    No thumbnail set — a default image will be used
                                                </div>
                                            )}
                                            <div className="px-3 py-2.5 space-y-1 text-slate-800 leading-snug">
                                                <div>📣 <span className="font-semibold">Training Topic:</span> {friendlyTopic}</div>
                                                <div>📅 <span className="font-semibold">Date:</span> {friendlyDate}</div>
                                                <div>⏰ <span className="font-semibold">Time:</span> {friendlyTime}</div>
                                                <div className="pt-1">Tap below to confirm your enrolment:</div>
                                                <div className="text-emerald-700 break-all text-[11px]">{payload.registrationUrl}</div>
                                                <div className="pt-1 text-slate-600 text-[11px]">For help: 📞 +91-8239008202 · ✉ safefoodmitra@gmail.com</div>
                                            </div>
                                            <div className="border-t border-slate-100 px-3 py-2 text-center text-[#128C7E] font-semibold text-[12px] cursor-default select-none">
                                                🌐 Visit website
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-2 italic">Preview only — final message uses your approved Meta template.</div>
                                    </div>

                                    {/* Audience picker — mirrors the bulk multi-training
                                        promo so admins can include manually-added /
                                        CSV-imported leads (`marketing_participants`)
                                        in addition to the LMS user list. Switching
                                        the audience re-runs the dryRun count below
                                        so the recipient total stays accurate. */}
                                    {/* Audience toggle — solid green active state matches
                                        the rest of the WhatsApp/promo UI. Each button
                                        shows its own pre-fetched count so the admin can
                                        compare LMS-only vs LMS+imported reach at a
                                        glance and pick deliberately. */}
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Audience</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {([
                                                { v: 'lms' as const,           label: 'LMS users only',       countKey: 'lms' as const },
                                                { v: 'lms+imported' as const,  label: 'LMS + imported leads', countKey: 'lmsImported' as const },
                                            ]).map(opt => {
                                                const active = promoAudience === opt.v;
                                                const count = promoAudienceCounts[opt.countKey];
                                                return (
                                                    <button
                                                        key={opt.v}
                                                        type="button"
                                                        onClick={() => {
                                                            if (promoAudience === opt.v) return;
                                                            setPromoAudience(opt.v);
                                                            // Re-use cached count if we already have it (set during
                                                            // modal open); otherwise re-fetch.
                                                            if (count == null) void fetchPromoCount(opt.v);
                                                            else { setPromoCount(count); }
                                                        }}
                                                        disabled={promoCountLoading}
                                                        className={`px-3 py-2.5 rounded-lg text-center text-[11px] font-black transition-all border ${active
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                                            : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'} disabled:opacity-60`}
                                                    >
                                                        <div className="leading-tight">{opt.label}</div>
                                                        <div className={`text-[10px] font-mono mt-0.5 ${active ? 'text-emerald-100' : 'text-slate-400'}`}>
                                                            {count == null ? '…' : count.toLocaleString()}
                                                            {opt.v === 'lms+imported' && count != null && promoAudienceCounts.lms != null && (
                                                                <span> ({promoAudienceCounts.lms} + {Math.max(0, count - promoAudienceCounts.lms)})</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-lg">
                                            {promoCount === null ? <Loader2 size={20} className="animate-spin" /> : promoCount}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-black text-emerald-900">{promoCount === null ? 'Counting recipients…' : `${promoCount} recipient${promoCount === 1 ? '' : 's'}`}</div>
                                            <div className="text-[11px] text-emerald-700">
                                                {promoBreakdown && (promoBreakdown.lms > 0 || promoBreakdown.imported > 0)
                                                    ? `${promoBreakdown.lms} LMS${promoBreakdown.imported > 0 ? ` + ${promoBreakdown.imported} imported` : ''} · phone on file, minus opt-outs`
                                                    : 'Phone on file, minus opt-outs'}
                                            </div>
                                        </div>
                                    </div>
                                </>
                                );
                            })()}

                            {/* In-progress / completed progress panel */}
                            {promoJob && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className={`font-black uppercase tracking-wider ${isCancelled ? 'text-rose-700' : 'text-slate-700'}`}>
                                            {inProgress
                                                ? 'Sending in background…'
                                                : isCancelled
                                                    ? `Cancelled — ${cancelledCount} skipped`
                                                    : 'Blast complete'}
                                        </span>
                                        <span className="font-mono text-slate-600">{processed} / {total}</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${inProgress ? 'bg-emerald-500' : (isCancelled ? 'bg-rose-500' : (promoJob.failed > 0 ? 'bg-amber-500' : 'bg-emerald-600'))}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                        <div className="bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-center">
                                            <div className="font-black text-emerald-700 text-base">{promoJob.succeeded}</div>
                                            <div className="text-emerald-600 uppercase tracking-wider">Sent</div>
                                        </div>
                                        <div className="bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-center">
                                            <div className="font-black text-amber-700 text-base">{promoJob.failed}</div>
                                            <div className="text-amber-600 uppercase tracking-wider">Failed</div>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center">
                                            <div className="font-black text-slate-700 text-base">{promoJob.pending + promoJob.sending}</div>
                                            <div className="text-slate-500 uppercase tracking-wider">Pending</div>
                                        </div>
                                    </div>
                                    {promoJob.failedRecipients.length > 0 && (
                                        <div className="border border-rose-200 bg-rose-50 rounded-lg p-2 max-h-32 overflow-y-auto text-[11px] text-rose-800 space-y-1">
                                            <div className="font-black uppercase tracking-wider text-[10px] text-rose-700">Failed recipients</div>
                                            {promoJob.failedRecipients.slice(0, 50).map((r, i) => (
                                                <div key={`${r.phone}-${i}`} className="flex justify-between gap-2">
                                                    <span className="font-mono">{r.name ? `${r.name} · ` : ''}{r.phone}</span>
                                                    <span className="text-rose-600 truncate max-w-[55%]" title={r.error}>{r.error || 'failed'}</span>
                                                </div>
                                            ))}
                                            {promoJob.failedRecipients.length > 50 && (
                                                <div className="text-rose-500 italic">…and {promoJob.failedRecipients.length - 50} more</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {promoError && (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-lg">{promoError}</div>
                            )}

                            {/* Past blasts — collapsible audit list. Loaded
                              * lazily when the modal opens so admins can
                              * confirm prior blasts completed and inspect
                              * the failed-recipient roster without leaving
                              * the modal. The currently-active job (if any)
                              * is filtered out so it doesn't show twice. */}
                            {(() => {
                                const activeId = promoJob?.id;
                                const past = (promoHistory || []).filter(h => h.id !== activeId);
                                // Panel is always shown so the retention-policy
                                // input remains reachable even when this
                                // training has never had a blast — admins can
                                // set the global retention window from any
                                // training's modal.
                                return (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setPromoHistoryOpen(o => !o)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-black uppercase tracking-wider text-slate-700"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>Past blasts</span>
                                                {promoHistoryLoading ? (
                                                    <Loader2 size={12} className="animate-spin text-slate-500" />
                                                ) : (
                                                    <span className="font-mono normal-case text-[10px] text-slate-500">({past.length})</span>
                                                )}
                                            </span>
                                            <span className="text-slate-500 text-[10px]">{promoHistoryOpen ? '▲' : '▼'}</span>
                                        </button>
                                        {promoHistoryOpen && (
                                            <>
                                                {/* Retention policy: auto-purge any past blast (and
                                                  * its recipient phone-number rows) older than N days.
                                                  * Empty / 0 disables auto-purge. Saved value applies
                                                  * immediately and on every subsequent worker boot. */}
                                                <div className="px-3 py-2 bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-700">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold">Auto-purge older than</span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={3650}
                                                            step={1}
                                                            value={promoRetentionDraft}
                                                            onChange={e => setPromoRetentionDraft(e.target.value)}
                                                            placeholder="off"
                                                            className="w-20 px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                        />
                                                        <span>days</span>
                                                        <button
                                                            type="button"
                                                            onClick={savePromoRetention}
                                                            disabled={promoRetentionSaving || promoRetentionDraft.trim() === (promoRetentionDays != null ? String(promoRetentionDays) : '')}
                                                            className="px-2 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase disabled:opacity-50 flex items-center gap-1"
                                                        >
                                                            {promoRetentionSaving ? <Loader2 size={10} className="animate-spin" /> : null}
                                                            Save
                                                        </button>
                                                        <span className="text-[10px] text-slate-500">
                                                            {promoRetentionDays == null
                                                                ? 'currently disabled — blasts kept forever'
                                                                : `currently ${promoRetentionDays} day${promoRetentionDays === 1 ? '' : 's'}`}
                                                        </span>
                                                    </div>
                                                    {promoRetentionMessage && (
                                                        <div className="mt-1 text-[10px] text-slate-600">{promoRetentionMessage}</div>
                                                    )}
                                                </div>
                                            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                                {past.length === 0 && !promoHistoryLoading && (
                                                    <div className="px-3 py-3 text-[11px] text-slate-500 italic">No previous blasts.</div>
                                                )}
                                                {past.map((h) => {
                                                    const ts = h.completedAt || h.startedAt || h.createdAt;
                                                    const when = ts ? new Date(ts).toLocaleString() : '—';
                                                    const expanded = !!promoHistoryExpanded[h.id];
                                                    return (
                                                        <div key={h.id} className="px-3 py-2 text-[11px] text-slate-700">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="font-semibold text-slate-800 truncate">{when}</div>
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                                        {h.status} · {h.total} recipient{h.total === 1 ? '' : 's'}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-black">{h.succeeded} sent</span>
                                                                    <span className={`px-1.5 py-0.5 rounded border font-black ${h.failed > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>{h.failed} failed</span>
                                                                    {h.failed > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setPromoHistoryExpanded(prev => ({ ...prev, [h.id]: !prev[h.id] }))}
                                                                            className="px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase"
                                                                        >
                                                                            {expanded ? 'Hide' : 'Show'}
                                                                        </button>
                                                                    )}
                                                                    {/* Per-row delete: removes this blast and its
                                                                      * recipient phone-number rows (FK cascade) so
                                                                      * admins can prune the history panel. Confirms
                                                                      * before firing. Active jobs are filtered out
                                                                      * earlier so we never offer delete on those. */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => deletePromoHistoryRow(h.id, when)}
                                                                        disabled={!!promoHistoryDeleting[h.id]}
                                                                        title="Delete this past blast (and its recipient rows)"
                                                                        className="px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase disabled:opacity-50 flex items-center"
                                                                    >
                                                                        {promoHistoryDeleting[h.id]
                                                                            ? <Loader2 size={10} className="animate-spin" />
                                                                            : <Trash2 size={10} />}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {expanded && h.failedRecipients.length > 0 && (
                                                                <div className="mt-2 border border-rose-200 bg-rose-50 rounded-lg p-2 max-h-32 overflow-y-auto text-[11px] text-rose-800 space-y-1">
                                                                    {h.failedRecipients.map((r, i) => (
                                                                        <div key={`${h.id}-${r.phone}-${i}`} className="flex justify-between gap-2">
                                                                            <span className="font-mono">{r.name ? `${r.name} · ` : ''}{r.phone}</span>
                                                                            <span className="text-rose-600 truncate max-w-[55%]" title={r.error}>{r.error || 'failed'}</span>
                                                                        </div>
                                                                    ))}
                                                                    {h.failedRecipientsTruncated && (h.failedRecipientsTotal || 0) > h.failedRecipients.length && (
                                                                        <div className="text-rose-500 italic">…and {(h.failedRecipientsTotal || 0) - h.failedRecipients.length} more</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            </>
                                        )}
                                        {/* Re-blast missed users only — single button at the
                                          * bottom of the past-blasts panel. Enqueues a new job
                                          * targeting LMS recipients who are NOT in the succeeded
                                          * list of any prior job for this training, so admins can
                                          * follow up on a partial/cancelled blast or reach LMS
                                          * users who signed up after the original promo without
                                          * re-spamming people who already got the message. */}
                                        {promoHistoryOpen && past.length > 0 && !inProgress && (
                                            <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={reblastMissedUsers}
                                                    disabled={promoReblastMissedBusy}
                                                    className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#128C7E] text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                                    title="Send the promo to every LMS user who has NOT already received it from a previous blast"
                                                >
                                                    {promoReblastMissedBusy ? <Loader2 size={12} className="animate-spin" /> : <Megaphone size={12} />}
                                                    {promoReblastMissedBusy ? 'Re-blasting…' : 'Re-blast missed users only'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 flex-wrap">
                            <button
                                onClick={closePromoModal}
                                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-black uppercase tracking-wider"
                                title={inProgress ? 'The blast continues in the background — you can re-open this window any time to check progress.' : ''}
                            >
                                {inProgress ? 'Close (keeps running)' : (promoJob || promoResult ? 'Close' : 'Cancel')}
                            </button>
                            {/* Cancel-blast button: only while the worker is still
                                draining. Halts new sends; already-sent recipients
                                stay on record. */}
                            {inProgress && (
                                <button
                                    onClick={cancelPromoBlast}
                                    disabled={promoCancelling}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                    title="Stop the worker and skip remaining recipients"
                                >
                                    {promoCancelling ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                                    {promoCancelling ? 'Cancelling…' : 'Cancel blast'}
                                </button>
                            )}
                            {/* Resume button: only when the job was cancelled and
                                some recipients were skipped (cancelled bucket).
                                Re-queues those recipients on the same job so
                                already-sent recipients are not re-spammed.
                                We gate on `sending === 0` so any rows that
                                were mid-dispatch when cancel landed have
                                drained to sent/failed first — otherwise the
                                "N skipped" count would transiently include
                                in-flight rows and overstate the requeue. */}
                                {promoJob && isCancelled && promoJob.sending === 0 && (promoJob.total - promoJob.succeeded - promoJob.failed) > 0 && (
                                <button
                                    onClick={resumePromoBlast}
                                    disabled={promoResuming}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                    title="Re-queue the recipients that were skipped when this blast was cancelled"
                                >
                                    {promoResuming ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                                    Resume blast ({promoJob.total - promoJob.succeeded - promoJob.failed} skipped)
                                </button>
                            )}
                            {/* Retry button: only when the worker has finished and some recipients failed. */}
                            {promoJob && !inProgress && promoJob.failed > 0 && (
                                <button
                                    onClick={retryPromoFailed}
                                    disabled={promoRetrying}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                >
                                    {promoRetrying ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                                    Retry {promoJob.failed} failed
                                </button>
                            )}
                            {/* Send button: only before any job has been started. */}
                            {!promoJob && !promoResult && (
                                <button
                                    onClick={sendPromo}
                                    disabled={promoBusy || promoCount === null || promoCount === 0}
                                    className="px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                >
                                    {promoBusy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                                    {promoBusy ? 'Queuing…' : `Send to ${promoCount ?? 0}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                , document.body);
            })()}
        </div>
    );
};

// --- Main Calendar Component ---

export default function TrainingCalendar({ 
  currentScope = 'unit', 
  userRootId, 
  entities = [],
  trainers = [],
  allEmployees = [],
  certTemplateEndpoint = '/api/cert-templates'
}: TrainingCalendarProps) {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [regGroupLinkSentCounts, setRegGroupLinkSentCounts] = useState<Record<string, number>>({});
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isComprehensiveExporting, setIsComprehensiveExporting] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [managedSessionId, setManagedSessionId] = useState<string | null>(null);
  const [featuredPopupId, setFeaturedPopupId] = useState<string | null>(null);
  const [defaultWaCode, setDefaultWaCode] = useState<string>(DEFAULT_WA_COUNTRY_CODE);
  const [savingWaCode, setSavingWaCode] = useState(false);
  const [regionWaCodes, setRegionWaCodes] = useState<Record<string, string>>({});
  const [savingRegionWaCode, setSavingRegionWaCode] = useState<string | null>(null);
  const [showRegionWaPanel, setShowRegionWaPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [allDbTrainers, setAllDbTrainers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [calFilters, setCalFilters] = useState({
    topics: [] as string[],
    subTopics: [] as string[],
    trainers: [] as string[],
    modes: [] as string[],
    dateFrom: '',
    dateTo: '',
    activity: 'all' as 'all' | 'active' | 'inactive'
  });
  const [unitFocusFilter, setUnitFocusFilter] = useState<{ focusId: string; focusName: string } | null>(null);
  const [bulkCsvData, setBulkCsvData] = useState<any[] | null>(null);
  const [bulkSessions, setBulkSessions] = useState<BulkSession[] | null>(null);
  const bulkCsvRef = useRef<HTMLInputElement>(null);
  const [backfillCount, setBackfillCount] = useState<number>(0);
  const [backfillRunning, setBackfillRunning] = useState(false);

  const refreshBackfillCount = useCallback(async () => {
    try {
      const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
      if (!adminToken) { setBackfillCount(0); return; }
      const res = await fetch('/api/training-register/backfill?countOnly=1', {
        headers: { 'x-admin-token': adminToken },
      });
      if (!res.ok) { setBackfillCount(0); return; }
      const data = await res.json().catch(() => ({}));
      setBackfillCount(Number(data?.count) || 0);
    } catch {
      setBackfillCount(0);
    }
  }, []);

  // One-shot "process every pending backfill" used by the small dashboard
  // button. The modal flow below uses a different runBackfill that accepts
  // an explicit id list. Renamed to avoid the duplicate identifier that
  // crashed the build after the auto-retry/backfill tasks merged.
  const runBackfillAll = useCallback(async () => {
    if (backfillRunning) return;
    setBackfillRunning(true);
    try {
      const adminToken = typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '';
      if (!adminToken) return;
      const res = await fetch('/api/training-register/backfill', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data?.count === 'number') {
        setBackfillCount(data.count);
      } else {
        await refreshBackfillCount();
      }
    } catch {
      await refreshBackfillCount();
    } finally {
      setBackfillRunning(false);
    }
  }, [backfillRunning, refreshBackfillCount]);

  type BackfillItem = {
    id: string; sessionId: string; createdAt: string;
    name: string; email: string; whatsapp: string;
    sessionTitle: string; sessionDate: string; startTime: string; endTime: string;
    mode: string; location: string; trainer: string;
    utrNumber: string; template: string;
  };
  const [backfillItems, setBackfillItems] = useState<BackfillItem[] | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string>('');
  const [backfillSelected, setBackfillSelected] = useState<Set<string>>(new Set());
  const [backfillSending, setBackfillSending] = useState(false);
  const [backfillSendingId, setBackfillSendingId] = useState<string | null>(null);
  const [backfillSummary, setBackfillSummary] = useState<{ sent: number; failed: number; remaining: number } | null>(null);
  const [backfillMaxPerCall, setBackfillMaxPerCall] = useState(200);

  const adminToken = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('admin_session_token') || '';
  }, []);

  const loadBackfillCandidates = useCallback(async () => {
    setBackfillLoading(true);
    setBackfillError('');
    try {
      const res = await fetch('/api/training-register/backfill', {
        headers: { 'x-admin-token': adminToken() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBackfillError(err?.error || `Failed (${res.status})`);
        setBackfillItems([]);
        return;
      }
      const data = await res.json();
      const items: BackfillItem[] = data.items || [];
      setBackfillItems(items);
      setBackfillMaxPerCall(Number(data.maxPerCall) || 200);
      setBackfillSelected(new Set(items.map(i => i.id)));
    } catch (e: any) {
      setBackfillError(e?.message || 'Failed to load');
      setBackfillItems([]);
    } finally {
      setBackfillLoading(false);
    }
  }, [adminToken]);

  const runBackfill = useCallback(async (ids?: string[]) => {
    const targetIds = ids && ids.length > 0 ? ids : Array.from(backfillSelected);
    if (targetIds.length === 0) return;
    if (ids && ids.length === 1) setBackfillSendingId(ids[0]);
    else setBackfillSending(true);
    setBackfillError('');
    setBackfillSummary(null);
    try {
      const res = await fetch('/api/training-register/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken() },
        body: JSON.stringify({ ids: targetIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBackfillError(data?.error || `Failed (${res.status})`);
        return;
      }
      setBackfillSummary({ sent: Number(data.sent) || 0, failed: Number(data.failed) || 0, remaining: Number(data.remaining) || 0 });
      const sentIds = new Set<string>((data.results || []).filter((r: any) => r.ok).map((r: any) => String(r.id)));
      setBackfillItems(prev => prev ? prev.filter(i => !sentIds.has(i.id)) : prev);
      setBackfillSelected(prev => {
        const next = new Set(prev);
        sentIds.forEach(id => next.delete(id));
        return next;
      });
    } catch (e: any) {
      setBackfillError(e?.message || 'Failed to send');
    } finally {
      setBackfillSending(false);
      setBackfillSendingId(null);
    }
  }, [adminToken, backfillSelected]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('training_focus');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx?.focusType === 'unit' && ctx.focusId) {
          setUnitFocusFilter({ focusId: ctx.focusId, focusName: ctx.focusName || ctx.focusId });
        }
        sessionStorage.removeItem('training_focus');
      }
    } catch {}
  }, []);

  const canEdit = currentScope !== 'user';
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [trainersRes, calendarRes, settingsRes, waCodeRes, regionWaRes] = await Promise.all([
          fetch('/api/trainers'),
          fetch('/api/training-calendar'),
          fetch('/api/app-settings?key=featured_popup_session_id'),
          fetch('/api/app-settings?key=default_wa_country_code'),
          fetch('/api/app-settings?key=default_wa_country_codes_by_region'),
        ]);
        if (trainersRes.ok) {
          const tData = await trainersRes.json();
          setAllDbTrainers(tData.items || []);
        }
        if (calendarRes.ok) {
          const cData = await calendarRes.json();
          const dbItems = (cData.items || []) as Training[];
          setTrainings(dbItems.length > 0 ? dbItems : []);
        }
        if (settingsRes.ok) {
          const sData = await settingsRes.json();
          setFeaturedPopupId(sData.value || null);
        }
        if (waCodeRes.ok) {
          const wData = await waCodeRes.json();
          const code = String(wData.value || '').replace(/\D+/g, '');
          if (code) setDefaultWaCode(code);
        }
        if (regionWaRes.ok) {
          const rwData = await regionWaRes.json();
          const raw = String(rwData.value || '').trim();
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                const cleaned: Record<string, string> = {};
                for (const [k, v] of Object.entries(parsed)) {
                  const code = String(v ?? '').replace(/\D+/g, '');
                  if (k && code) cleaned[k] = code;
                }
                setRegionWaCodes(cleaned);
              }
            } catch {
              // ignore corrupt setting
            }
          }
        }
      } catch (err) {
        console.error('Failed to load training data:', err);
      } finally {
        setDbLoaded(true);
      }
      try {
        const rcRes = await fetch('/api/training-register?counts=true');
        if (rcRes.ok) {
          const rcData = await rcRes.json();
          setRegCounts(rcData.counts || {});
          setRegGroupLinkSentCounts(rcData.groupLinkSentCounts || {});
        }
      } catch {}
      refreshBackfillCount();
    };
    loadData();
  }, [refreshBackfillCount]);

  const persistTrainings = useCallback((data: Training[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/training-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (err) {
        console.error('Failed to save training calendar:', err);
      }
    }, 800);
  }, []);

  const findEntityById = (id: string | null | undefined) => entities.find(e => e.id === id);

  const isAncestorOf = (ancestorId: string | null | undefined, descendantId: string | null | undefined): boolean => {
    if (!ancestorId || !descendantId) return false;
    let current = findEntityById(descendantId);
    while (current) {
      if (current.parentId === ancestorId) return true;
      current = findEntityById(current.parentId);
    }
    return false;
  };

  const contextIds = useMemo(() => {
    const ids = { unitId: '', regionId: '', corpId: '' };
    if (!userRootId) return ids;

    let current = findEntityById(userRootId);
    while (current) {
      if (current.type === 'unit') ids.unitId = current.id;
      if (current.type === 'regional') ids.regionId = current.id;
      if (current.type === 'corporate') ids.corpId = current.id;
      current = findEntityById(current.parentId);
    }
    return ids;
  }, [entities, userRootId]);

  const targetCorporate = useMemo(() => {
    if (currentScope === 'super-admin') return entities.find(e => e.type === 'corporate');
    return entities.find(e => e.id === contextIds.corpId);
  }, [entities, currentScope, contextIds.corpId]);

  const sopTopicsData = useMemo(() => {
    if (!targetCorporate?.masterSops) return {};
    const data: Record<string, string[]> = {};
    targetCorporate.masterSops.forEach(sop => {
      data[sop.name] = sop.subTopics;
    });
    return data;
  }, [targetCorporate]);

  const scopeFilteredTrainings = useMemo(() => {
    return trainings.filter(t => {
      if (currentScope === 'super-admin') return true;
      if (t.createdByEntityId === userRootId) return true;
      if (t.assignedUnits.includes(userRootId || '')) return true;
      if (t.assignedUnits.some(uId => isAncestorOf(userRootId, uId))) return true;
      if (currentScope === 'corporate' || currentScope === 'regional') {
        return t.assignedUnits.some(uId => {
          let current = findEntityById(uId);
          while (current) {
            if (current.id === userRootId) return true;
            current = findEntityById(current.parentId);
          }
          return false;
        });
      }
      if (currentScope === 'unit' && userRootId) {
        return t.assignedUnits.includes(userRootId);
      }
      return false;
    });
  }, [trainings, userRootId, currentScope, entities]);

  const calFilterOptions = useMemo(() => {
    const topics = [...new Set(scopeFilteredTrainings.map(t => t.topic).filter(Boolean))].sort();
    const subTopics = [...new Set(scopeFilteredTrainings.map(t => t.subTopic).filter(Boolean))].sort();
    const trainerNames = [...new Set(scopeFilteredTrainings.map(t => t.trainer).filter(Boolean))].sort();
    const modes = [...new Set(scopeFilteredTrainings.map(t => t.mode).filter(Boolean))].sort();
    return { topics, subTopics, trainerNames, modes };
  }, [scopeFilteredTrainings]);

  const hasActiveCalFilters = calFilters.topics.length > 0 || calFilters.subTopics.length > 0 || calFilters.trainers.length > 0 || calFilters.modes.length > 0 || calFilters.dateFrom || calFilters.dateTo || calFilters.activity !== 'all' || !!unitFocusFilter;

  const visibleTrainings = useMemo(() => {
    let result = scopeFilteredTrainings;
    if (unitFocusFilter?.focusId) {
      const focusNameLow = (unitFocusFilter.focusName || '').trim().toLowerCase();
      result = result.filter(t =>
        t.assignedUnits?.includes(unitFocusFilter.focusId) ||
        t.createdByEntityId === unitFocusFilter.focusId ||
        (t.unitName && t.unitName.trim().toLowerCase() === focusNameLow)
      );
    }
    if (calFilters.topics.length > 0) result = result.filter(t => calFilters.topics.includes(t.topic));
    if (calFilters.subTopics.length > 0) result = result.filter(t => calFilters.subTopics.includes(t.subTopic));
    if (calFilters.trainers.length > 0) result = result.filter(t => calFilters.trainers.includes(t.trainer));
    if (calFilters.modes.length > 0) result = result.filter(t => calFilters.modes.includes(t.mode));
    if (calFilters.dateFrom) result = result.filter(t => t.date >= calFilters.dateFrom);
    if (calFilters.dateTo) result = result.filter(t => t.date <= calFilters.dateTo);
    if (calFilters.activity === 'active') result = result.filter(t => t.isActive !== false);
    else if (calFilters.activity === 'inactive') result = result.filter(t => t.isActive === false);
    return result;
  }, [scopeFilteredTrainings, calFilters, unitFocusFilter]);

  const subTopicSummary = useMemo(() => {
    const summary: Record<string, { topic: string, upcoming: number, ongoing: number, completed: number, total: number, participants: number }> = {};
    
    if (targetCorporate?.masterSops) {
        targetCorporate.masterSops.forEach(sop => {
            sop.subTopics.forEach(st => {
                summary[st] = { topic: sop.name, upcoming: 0, ongoing: 0, completed: 0, total: 0, participants: 0 };
            });
        });
    }

    visibleTrainings.forEach(t => {
        if (!summary[t.subTopic]) {
            summary[t.subTopic] = { topic: t.topic, upcoming: 0, ongoing: 0, completed: 0, total: 0, participants: 0 };
        }
        summary[t.subTopic].total++;
        if (t.status === 'Upcoming') summary[t.subTopic].upcoming++;
        if (t.status === 'Ongoing') summary[t.subTopic].ongoing++;
        if (t.status === 'Completed') summary[t.subTopic].completed++;
        summary[t.subTopic].participants += (t.participantsPresent || 0);
    });

    return Object.entries(summary)
        .filter(([, data]) => data.total > 0)
        .sort((a, b) => b[1].total - a[1].total);
  }, [visibleTrainings, targetCorporate]);

  const metrics = useMemo(() => ({
    total: visibleTrainings.length,
    upcoming: visibleTrainings.filter(t => t.status === 'Upcoming').length,
    ongoing: visibleTrainings.filter(t => t.status === 'Ongoing').length,
    completed: visibleTrainings.filter(t => t.status === 'Completed').length,
    participants: visibleTrainings.reduce((acc, curr) => acc + (curr.participantsPresent || 0), 0),
  }), [visibleTrainings]);

  const sanitizeSheetName = (name: string, usedNames?: Set<string>): string => {
    let s = (name || 'Sheet').replace(/[\\/*?\[\]:]/g, '').trim() || 'Sheet';
    if (s.length > 31) s = s.substring(0, 31);
    if (usedNames) {
      let final = s;
      let counter = 2;
      while (usedNames.has(final.toLowerCase())) {
        const suffix = ` (${counter})`;
        final = s.substring(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedNames.add(final.toLowerCase());
      s = final;
    }
    return s;
  };

  const buildTrainingRow = (t: Training, idx: number) => ({
    "S.No": idx + 1,
    "Status": t.status,
    "Mode": t.mode,
    "Topic": t.topic,
    "Sub Topic": t.subTopic || 'General',
    "Trainer": t.trainer,
    "Trainer Scope": t.trainerScope,
    "Date": t.date,
    "Start Time": new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    "End Time": new Date(t.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    "Training Hours": t.trainingHours || '',
    "Location": t.location || '',
    "Present": t.participantsPresent,
    "Absent": t.participantsAbsent,
  });

  const exportAllSessions = () => {
    const data = visibleTrainings.map((t, idx) => buildTrainingRow(t, idx));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All Sessions");
    XLSX.writeFile(workbook, `Training_All_Sessions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportComprehensive = async () => {
    setIsComprehensiveExporting(true);
    try {
      const fmt = (d: any) => {
        if (!d) return '';
        const date = new Date(d);
        return isNaN(date.getTime()) ? String(d) : date.toLocaleString('en-GB');
      };
      const sanitize = (name: string, used: Set<string>) => {
        let s = (name || 'Sheet').replace(/[\\/?*[\]:]/g, '_').slice(0, 28);
        let final = s, n = 1;
        while (used.has(final.toLowerCase())) { final = `${s.slice(0, 26)}_${n++}`; }
        used.add(final.toLowerCase());
        return final;
      };
      const usedSheetNames = new Set<string>();
      const wb = XLSX.utils.book_new();

      // Master sessions sheet
      const masterRows = visibleTrainings.map((t, idx) => buildTrainingRow(t, idx));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masterRows), sanitize('All Sessions', usedSheetNames));

      // Master payments roll-up across every session
      const allPayments: any[] = [];
      const allParticipants: any[] = [];

      for (let i = 0; i < visibleTrainings.length; i++) {
        const t = visibleTrainings[i];
        let regs: any[] = [];
        try {
          const r = await fetch(`/api/training-register?sessionId=${encodeURIComponent(t.id)}`);
          if (r.ok) {
            const d = await r.json();
            regs = d.items || [];
          }
        } catch {}

        // Internal roster from participantList
        const internalRows = (t.participantList || []).map((p: any, j: number) => {
          const e = allEmployees.find((x: any) => x.id === p.employeeId);
          return {
            'S.No': j + 1,
            'Source': 'Internal',
            'Name': e?.Name || '(unknown)',
            'Email': e?.Email || '',
            'Phone': e?.Phone || '',
            'Gender': e?.Gender || '',
            'Department': e?.Department || '',
            'Role': e?.Role || '',
            'Unit': e?.Unit || '',
            'Attendance': p.status || 'neutral',
            'Added At': fmt(p.addedAt),
          };
        });

        // External / self-registered with full payment info
        const externalRows = regs.map((r, j) => ({
          'S.No': internalRows.length + j + 1,
          'Source': 'Self-Registered',
          'Name': r.name || '',
          'Email': r.email || '',
          'Phone / WhatsApp': r.whatsapp || r.phone || '',
          'Country': r.country || '',
          'Gender': r.gender || '',
          'Profession': r.profession || '',
          'Designation': r.designation || '',
          'Institute / FBO': r.instituteName || '',
          'Batch ID': r.batchId || '',
          'Batch Index': r.batchIndex || '',
          'Batch Size': r.batchSize || '',
          'Payment Status': r.paymentStatus || (t.upiId ? 'Pending' : 'N/A'),
          'UTR Number': r.utrNumber || '',
          'Coupon Used': r.couponCode || '',
          'Amount Paid': r.amountPaid ?? '',
          'Payment Screenshot': r.paymentImage ? 'Yes' : '',
          'Attendance': r.attendanceStatus || 'neutral',
          'Group Link Sent': fmt(r.groupLinkSentAt),
          'Meeting Email Sent': fmt(r.meetingLinkEmailSentAt),
          'Certificate Issued': fmt(r.certificateIssuedAt),
          'Registered At': fmt(r.createdAt || r.registeredAt),
        }));

        const sheetRows = [...internalRows, ...externalRows];
        if (sheetRows.length === 0) sheetRows.push({ Note: 'No participants yet.' } as any);

        const sheetTitle = sanitize(`${i + 1}. ${t.topic || 'Session'}`, usedSheetNames);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), sheetTitle);

        // Roll into master rolls
        regs.forEach(r => {
          if (r.utrNumber || r.amountPaid || r.paymentStatus) {
            allPayments.push({
              'Training': t.topic,
              'Date': t.date,
              'Trainer': t.trainer,
              'Participant Name': r.name || '',
              'Email': r.email || '',
              'Phone': r.whatsapp || r.phone || '',
              'Payment Status': r.paymentStatus || 'Pending',
              'UTR Number': r.utrNumber || '',
              'Coupon': r.couponCode || '',
              'Amount Paid': r.amountPaid ?? '',
              'Screenshot Provided': r.paymentImage ? 'Yes' : 'No',
              'Registered At': fmt(r.createdAt || r.registeredAt),
            });
          }
        });
        [...internalRows, ...externalRows].forEach((row: any) => {
          if (row?.Note) return;
          allParticipants.push({
            'Training': t.topic,
            'Date': t.date,
            'Trainer': t.trainer,
            ...row,
          });
        });
      }

      // Insert payments + master participants near the start
      if (allPayments.length) {
        const ws = XLSX.utils.json_to_sheet(allPayments);
        XLSX.utils.book_append_sheet(wb, ws, sanitize('All Payments', usedSheetNames));
      }
      if (allParticipants.length) {
        const ws = XLSX.utils.json_to_sheet(allParticipants);
        XLSX.utils.book_append_sheet(wb, ws, sanitize('All Participants', usedSheetNames));
      }

      XLSX.writeFile(wb, `Training_Comprehensive_${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setIsComprehensiveExporting(false);
    }
  };

  const exportUnitWise = () => {
    const workbook = XLSX.utils.book_new();
    const unitMap = new Map<string, Training[]>();
    visibleTrainings.forEach(t => {
      const units = t.assignedUnits || [];
      if (units.length === 0) {
        if (!unitMap.has('Unassigned')) unitMap.set('Unassigned', []);
        unitMap.get('Unassigned')!.push(t);
      } else {
        units.forEach(uId => {
          const unitEntity = entities.find(e => e.id === uId);
          const unitName = unitEntity?.name || uId;
          if (!unitMap.has(unitName)) unitMap.set(unitName, []);
          unitMap.get(unitName)!.push(t);
        });
      }
    });
    const sortedUnits = [...unitMap.keys()].sort();
    if (sortedUnits.length === 0) {
      const data = visibleTrainings.map((t, idx) => buildTrainingRow(t, idx));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, ws, "All Units");
    } else {
      const usedNames = new Set<string>();
      sortedUnits.forEach(unitName => {
        const trainings = unitMap.get(unitName)!;
        const data = trainings.map((t, idx) => buildTrainingRow(t, idx));
        const ws = XLSX.utils.json_to_sheet(data);
        const sheetName = sanitizeSheetName(unitName, usedNames);
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      });
    }
    XLSX.writeFile(workbook, `Training_Unit_Wise_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportDepartmentWise = () => {
    const workbook = XLSX.utils.book_new();
    const deptMap = new Map<string, Training[]>();
    visibleTrainings.forEach(t => {
      const depts = new Set<string>();
      (t.participantList || []).forEach(p => {
        const emp = allEmployees.find(e => e.id === p.employeeId);
        if (emp?.Department) depts.add(emp.Department);
      });
      if (depts.size === 0) depts.add('Unassigned');
      depts.forEach(dept => {
        if (!deptMap.has(dept)) deptMap.set(dept, []);
        deptMap.get(dept)!.push(t);
      });
    });
    const sortedDepts = [...deptMap.keys()].sort();
    if (sortedDepts.length === 0) {
      const data = visibleTrainings.map((t, idx) => buildTrainingRow(t, idx));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, ws, "All Departments");
    } else {
      const usedNames = new Set<string>();
      sortedDepts.forEach(dept => {
        const trainings = deptMap.get(dept)!;
        const data = trainings.map((t, idx) => buildTrainingRow(t, idx));
        const ws = XLSX.utils.json_to_sheet(data);
        const sheetName = sanitizeSheetName(dept, usedNames);
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      });
    }
    XLSX.writeFile(workbook, `Training_Department_Wise_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportTopicWise = () => {
    const workbook = XLSX.utils.book_new();
    const topicMap = new Map<string, Training[]>();
    visibleTrainings.forEach(t => {
      const topic = t.topic || 'Untitled';
      if (!topicMap.has(topic)) topicMap.set(topic, []);
      topicMap.get(topic)!.push(t);
    });
    const sortedTopics = [...topicMap.keys()].sort();
    const usedNames = new Set<string>();
    sortedTopics.forEach(topic => {
      const trainings = topicMap.get(topic)!;
      const data = trainings.map((t, idx) => buildTrainingRow(t, idx));
      const ws = XLSX.utils.json_to_sheet(data);
      const sheetName = sanitizeSheetName(topic, usedNames);
      XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    });
    XLSX.writeFile(workbook, `Training_Topic_Wise_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      setTrainings(prev => {
        const updated = prev.filter(t => t.id !== id);
        return updated;
      });
      try {
        await fetch('/api/training-calendar', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [id] })
        });
      } catch (err) {
        console.error('Failed to delete from DB:', err);
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const source = trainings.find(t => t.id === id);
    if (!source) return;
    const newId = `T-${Date.now()}`;
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    // Strip per-instance state (registrants, attendance, sheets, sent flags)
    // but keep all content fields so the admin only has to adjust the
    // date / time before re-publishing.
    const {
      participantList: _pl,
      participantsPresent: _pp,
      participantsAbsent: _pa,
      participantsNeutral: _pn,
      hasSheet: _hs,
      sheetUrl: _su,
      uploadedDate: _ud,
      meetingLinkEmailedAt: _mle,
      linkClicks: _lc,
      isLocked: _il,
      ...content
    } = source;
    const dupe: Training = {
      ...content,
      id: newId,
      topic: `${source.topic} (Copy)`,
      isActive: false,
      isLocked: false,
      participantList: [],
      participantsPresent: 0,
      participantsAbsent: 0,
      participantsNeutral: 0,
      hasSheet: false,
      sheetUrl: undefined,
      uploadedDate: todayStr,
      meetingLinkEmailedAt: undefined,
      linkClicks: undefined,
    };
    setTrainings(prev => [dupe, ...prev]);
    try {
      await fetch('/api/training-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dupe),
      });
    } catch (err) {
      console.error('Failed to persist duplicated session:', err);
    }
    setEditingTraining(dupe);
    setActiveModal('trainingForm');
  };

  const handleToggleActive = async (id: string) => {
    let toggled: Training | undefined;
    setTrainings(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        toggled = { ...t, isActive: !t.isActive };
        return toggled;
      });
      return updated;
    });
    setTimeout(async () => {
      if (!toggled) return;
      try {
        await fetch('/api/training-calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toggled),
        });
      } catch {}
    }, 0);
  };

  const regionIdForEntity = useCallback((entityId: string | null | undefined): string | null => {
    if (!entityId) return null;
    let current = findEntityById(entityId);
    while (current) {
      if (current.type === 'regional') return current.id;
      current = findEntityById(current.parentId);
    }
    return null;
  }, [entities]);

  const regionIdForTraining = useCallback((training: Training): string | null => {
    for (const uId of training.assignedUnits || []) {
      const r = regionIdForEntity(uId);
      if (r) return r;
    }
    return regionIdForEntity(training.createdByEntityId);
  }, [regionIdForEntity]);

  const accessibleRegions = useMemo(() => {
    const all = entities.filter(e => e.type === 'regional');
    if (currentScope === 'super-admin') return all.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (currentScope === 'corporate' && contextIds.corpId) {
      return all.filter(e => e.parentId === contextIds.corpId).sort((a, b) => a.name.localeCompare(b.name));
    }
    if (currentScope === 'regional' && contextIds.regionId) {
      return all.filter(e => e.id === contextIds.regionId);
    }
    return [];
  }, [entities, currentScope, contextIds.corpId, contextIds.regionId]);

  const persistRegionWaCodes = async (next: Record<string, string>) => {
    try {
      await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'default_wa_country_codes_by_region', value: JSON.stringify(next) }),
      });
    } catch (err) {
      console.error('Failed to save per-region WhatsApp country codes:', err);
    }
  };

  const handleRegionWaCodeChange = async (regionId: string, code: string) => {
    const clean = code.replace(/\D+/g, '');
    setRegionWaCodes(prev => {
      const next = { ...prev };
      if (clean) next[regionId] = clean;
      else delete next[regionId];
      setSavingRegionWaCode(regionId);
      persistRegionWaCodes(next).finally(() => setSavingRegionWaCode(null));
      return next;
    });
  };

  const handleDefaultWaCodeChange = async (code: string) => {
    const clean = code.replace(/\D+/g, '') || DEFAULT_WA_COUNTRY_CODE;
    setDefaultWaCode(clean);
    setSavingWaCode(true);
    try {
      await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'default_wa_country_code', value: clean }),
      });
    } catch (err) {
      console.error('Failed to save default WhatsApp country code:', err);
    } finally {
      setSavingWaCode(false);
    }
  };

  const handleToggleFeature = async (id: string) => {
    const newFeaturedId = featuredPopupId === id ? null : id;
    setFeaturedPopupId(newFeaturedId);
    try {
      await fetch('/api/app-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'featured_popup_session_id', value: newFeaturedId || '' }),
      });
    } catch (err) {
      console.error('Failed to save featured popup session:', err);
    }
  };

  const handleSave = (payload: Training) => {
    setTrainings(prev => {
      const exists = prev.some(t => t.id === payload.id);
      let updated: Training[];
      if (exists) {
        updated = prev.map(t => t.id === payload.id ? payload : t);
      } else {
        updated = [payload, ...prev];
      }
      persistTrainings(updated);
      return updated;
    });
    setActiveModal(null);
    setEditingTraining(null);
  };

  const handleUpdateParticipants = (id: string, participants: ParticipantData[]) => {
      setTrainings(prev => {
          const updated = prev.map(t => {
              if (t.id !== id) return t;
              return {
                  ...t,
                  participantList: participants,
                  participantsNeutral: participants.filter(p => p.status === 'neutral').length,
                  participantsPresent: participants.filter(p => p.status === 'present').length,
                  participantsAbsent: participants.filter(p => p.status === 'absent').length,
              };
          });
          persistTrainings(updated);
          return updated;
      });
  };

  const handleUploadSheet = (id: string, url: string) => {
    setTrainings(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, sheetUrl: url, hasSheet: true, uploadedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : t);
      persistTrainings(updated);
      return updated;
    });
  };

  const handleRemoveSheet = (id: string) => {
    if(confirm("Permanently remove the digital training card for this session?")) {
        setTrainings(prev => {
          const updated = prev.map(t => t.id === id ? { ...t, sheetUrl: undefined, hasSheet: false, uploadedDate: undefined } : t);
          persistTrainings(updated);
          return updated;
        });
    }
  };

  const handleUpdateThumbnail = (id: string, thumbnail: string, bumpVersion: boolean) => {
    setTrainings(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          thumbnailImage: thumbnail || t.thumbnailImage,
          thumbnailVersion: bumpVersion ? ((t.thumbnailVersion || 0) + 1) : (t.thumbnailVersion || 0),
        };
      });
      persistTrainings(updated);
      return updated;
    });
  };

  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (json.length === 0) { alert('No data found in CSV.'); return; }
        const parsed = json.map(row => {
          const excelDateToISO = (val: any, fallback: string) => {
            if (!val && val !== 0) return fallback;
            if (typeof val === 'number') {
              const d = new Date(Math.round((val - 25569) * 86400 * 1000));
              return d.toISOString().split('T')[0];
            }
            const str = String(val).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.split('T')[0];
            const tryDate = new Date(str);
            return isNaN(tryDate.getTime()) ? fallback : tryDate.toISOString().split('T')[0];
          };
          const excelTimeToHHMM = (val: any) => {
            if (!val && val !== 0) return '';
            if (typeof val === 'number') {
              const totalMinutes = Math.round(val * 24 * 60);
              const h = Math.floor(totalMinutes / 60);
              const m = totalMinutes % 60;
              return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            }
            const str = String(val).trim();
            const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) return `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
            return '';
          };
          const employeeId = String(row['Employee ID'] || row['Employee Id'] || row['employee_id'] || row['ID Number'] || row['ID'] || '').trim();
          const employeeName = String(row['Employee Name'] || row['Name'] || row['employee_name'] || '').trim();
          const unitNumber = String(row['Unit Number'] || row['Unit'] || row['unit_number'] || '').trim();
          const regionalName = String(row['Regional Name'] || row['Regional'] || row['regional_name'] || '').trim();
          const topic = String(row['Training Topic Name'] || row['Topic'] || row['training_topic'] || '').trim();
          const trainer = String(row['Trainer Name'] || row['Trainer'] || row['trainer_name'] || '').trim();
          const startDate = excelDateToISO(row['Starting Date'] || row['Start Date'] || row['start_date'], '');
          const endDate = excelDateToISO(row['End Date'] || row['end_date'], startDate);
          const startTime = excelTimeToHHMM(row['Starting Time'] || row['Start Time'] || row['start_time']);
          const endTime = excelTimeToHHMM(row['End Time'] || row['end_time']);
          const venue = String(row['Delivery Venue'] || row['Venue'] || row['Location'] || row['venue'] || '').trim();
          return { employeeId, employeeName, unitNumber, regionalName, topic, trainer, startDate, endDate, startTime, endTime, venue };
        });
        setBulkCsvData(parsed);
        const sessionMap = new Map<string, { row: any; empRows: any[] }>();
        parsed.forEach(row => {
          const key = `${row.topic}||${row.trainer}||${row.startDate}||${row.startTime}||${row.endTime}`;
          if (!sessionMap.has(key)) sessionMap.set(key, { row, empRows: [] });
          sessionMap.get(key)!.empRows.push(row);
        });
        const sessions: BulkSession[] = [];
        sessionMap.forEach(({ row, empRows }, _key) => {
          const employees: BulkEmployee[] = empRows.map(er => {
            const { matched, suggested, matchPct } = findBestEmployeeMatch(er.employeeId, er.employeeName, allEmployees);
            const rec = matched || suggested;
            return {
              csvEmployeeId: er.employeeId,
              csvEmployeeName: er.employeeName,
              resolvedEmployeeId: matched ? (matched.ID || matched.id) : er.employeeId,
              resolvedEmployeeName: matched ? matched.Name : er.employeeName,
              matchedRecord: matched,
              suggestedRecord: suggested,
              matchPercent: matchPct,
              department: rec?.Department || '',
              unitName: rec?.Unit || er.unitNumber || '',
            };
          });
          sessions.push({
            id: `bs-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            topic: row.topic, trainer: row.trainer,
            startDate: row.startDate, endDate: row.endDate,
            startTime: row.startTime, endTime: row.endTime,
            venue: row.venue, unitNumber: row.unitNumber, regionalName: row.regionalName,
            employees,
          });
        });
        setBulkSessions(sessions);
      } catch (err) {
        console.error('CSV parse error:', err);
        alert('Failed to parse CSV file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadBulkCsvTemplate = () => {
    const headers = ['Employee ID', 'Employee Name', 'Unit Number', 'Regional Name', 'Training Topic Name', 'Trainer Name', 'Starting Date', 'End Date', 'Starting Time', 'End Time', 'Delivery Venue'];
    const sampleRows = [
      ['EMP-001', 'John Smith', 'Unit-A', 'North Region', 'Food Safety Basics', 'Jane Doe', '2025-04-15', '2025-04-15', '09:00', '11:00', 'Main Training Room'],
      ['EMP-002', 'Sarah Johnson', 'Unit-A', 'North Region', 'Food Safety Basics', 'Jane Doe', '2025-04-15', '2025-04-15', '09:00', '11:00', 'Main Training Room'],
      ['EMP-003', 'Mike Brown', 'Unit-B', 'South Region', 'HACCP Principles', 'Dr. Lee', '2025-04-16', '2025-04-16', '14:00', '16:00', 'Conference Hall B'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    const instrWs = XLSX.utils.aoa_to_sheet([
      ['Bulk Training Calendar Upload — Instructions'],
      [''],
      ['Column', 'Description', 'Required'],
      ['Employee ID', 'Unique employee identifier (e.g., EMP-001)', 'Yes'],
      ['Employee Name', 'Full name of the employee', 'Yes'],
      ['Unit Number', 'Unit/branch name the employee belongs to', 'Optional'],
      ['Regional Name', 'Regional group name', 'Optional'],
      ['Training Topic Name', 'Name of the training topic', 'Yes'],
      ['Trainer Name', 'Name of the trainer conducting the session', 'Yes'],
      ['Starting Date', 'Session date (YYYY-MM-DD)', 'Yes'],
      ['End Date', 'End date (YYYY-MM-DD), same as start for single-day', 'Yes'],
      ['Starting Time', 'Start time (HH:MM, 24h format)', 'Yes'],
      ['End Time', 'End time (HH:MM, 24h format)', 'Yes'],
      ['Delivery Venue', 'Training location', 'Optional'],
      [''],
      ['Notes:'],
      ['- Employees with same Topic + Trainer + Date + Time are grouped into one calendar card'],
      ['- Each employee is auto-added with PRESENT attendance status'],
      ['- Employee ID is matched against the employee master list for linking'],
    ]);
    instrWs['!cols'] = [{ wch: 22 }, { wch: 55 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Data');
    XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');
    XLSX.writeFile(wb, 'Bulk_Training_Calendar_Template.xlsx');
  };

  const handleBulkCsvCommit = () => {
    if (!bulkSessions || bulkSessions.length === 0) return;

    const newTrainings: Training[] = bulkSessions.map(session => {
      const participantList: ParticipantData[] = session.employees.map(emp => {
        const useRecord = emp.matchedRecord;
        return {
          employeeId: useRecord?.id || useRecord?.ID || emp.resolvedEmployeeId || emp.csvEmployeeId || `csv-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          status: 'present' as const,
          addedAt: Date.now(),
        };
      });

      const startTimeISO = session.startDate && session.startTime ? `${session.startDate}T${session.startTime}` : '';
      const endTimeISO = (session.endDate || session.startDate) && session.endTime ? `${session.endDate || session.startDate}T${session.endTime}` : '';
      let trainingHours = 0;
      if (startTimeISO && endTimeISO) {
        const diff = new Date(endTimeISO).getTime() - new Date(startTimeISO).getTime();
        if (diff > 0) trainingHours = parseFloat((diff / 3600000).toFixed(2));
      }

      return {
        id: `T-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        status: 'Upcoming' as const,
        mode: 'Classroom',
        topic: session.topic || 'Untitled',
        subTopic: '',
        trainer: session.trainer || '',
        trainerScope: 'Within Unit',
        date: session.startDate || new Date().toISOString().split('T')[0],
        startTime: startTimeISO,
        endTime: endTimeISO,
        trainingHours,
        location: session.venue || '',
        participantsPresent: participantList.length,
        participantsAbsent: 0,
        participantsNeutral: 0,
        participantList,
        hasSheet: false,
        isLocked: false,
        createdByEntityId: userRootId || 'system',
        assignedUnits: session.unitNumber ? [session.unitNumber] : (userRootId ? [userRootId] : []),
        unitName: session.unitNumber || undefined,
      } as Training;
    });

    setTrainings(prev => {
      const updated = [...newTrainings, ...prev];
      persistTrainings(updated);
      return updated;
    });
    setBulkCsvData(null);
    setBulkSessions(null);
  };

  const handleBulkSessionFieldChange = (sessionId: string, field: keyof BulkSession, value: string) => {
    setBulkSessions(prev => {
      if (!prev) return prev;
      return prev.map(s => s.id === sessionId ? { ...s, [field]: value } : s);
    });
  };

  const handleBulkEmployeeChange = (sessionId: string, empIdx: number, selectedEmp: EmployeeRecord) => {
    setBulkSessions(prev => {
      if (!prev) return prev;
      return prev.map(s => {
        if (s.id !== sessionId) return s;
        const newEmployees = [...s.employees];
        newEmployees[empIdx] = {
          ...newEmployees[empIdx],
          resolvedEmployeeId: selectedEmp.ID || selectedEmp.id,
          resolvedEmployeeName: selectedEmp.Name,
          matchedRecord: selectedEmp,
          suggestedRecord: null,
          matchPercent: 100,
          department: selectedEmp.Department || '',
          unitName: selectedEmp.Unit || '',
        };
        return { ...s, employees: newEmployees };
      });
    });
  };

  const handleAcceptSuggestion = (sessionId: string, empIdx: number) => {
    setBulkSessions(prev => {
      if (!prev) return prev;
      return prev.map(s => {
        if (s.id !== sessionId) return s;
        const emp = s.employees[empIdx];
        if (!emp.suggestedRecord) return s;
        const newEmployees = [...s.employees];
        newEmployees[empIdx] = {
          ...emp,
          resolvedEmployeeId: emp.suggestedRecord.ID || emp.suggestedRecord.id,
          resolvedEmployeeName: emp.suggestedRecord.Name,
          matchedRecord: emp.suggestedRecord,
          suggestedRecord: null,
          matchPercent: 100,
          department: emp.suggestedRecord.Department || '',
          unitName: emp.suggestedRecord.Unit || '',
        };
        return { ...s, employees: newEmployees };
      });
    });
  };

  const TrainingFormModal = () => {
    const [formData, setFormData] = useState({
      topic: editingTraining?.topic || '',
      subTopic: editingTraining?.subTopic || '',
      mode: editingTraining?.mode || '',
      topicRemark: editingTraining?.topicRemark || '',
      trainerScope: editingTraining?.trainerScope || 'Within Unit',
      trainer: editingTraining?.trainer || '',
      trainerQualification: editingTraining?.trainerQualification || '',
      externalCompany: editingTraining?.externalCompany || '',
      startTime: editingTraining?.startTime || '',
      endTime: editingTraining?.endTime || '',
      location: editingTraining?.location || '',
      description: editingTraining?.description || '',
      assignedUnits: editingTraining?.assignedUnits || (currentScope === 'unit' ? [userRootId || ''] : []),
      thumbnailImage: editingTraining?.thumbnailImage || '',
      sampleCertTemplateId: editingTraining?.sampleCertTemplateId || '',
      whatsappLink: editingTraining?.whatsappLink || '',
      instagramLink: editingTraining?.instagramLink || '',
      linkedinLink: editingTraining?.linkedinLink || '',
      meetingLink: editingTraining?.meetingLink || '',
      autoSendMeetingLinkOnVerify:       editingTraining?.autoSendMeetingLinkOnVerify       !== false,
      autoSendMeetingLinkOnFreeRegister: editingTraining?.autoSendMeetingLinkOnFreeRegister !== false,
      autoSendMeetingLinkChannels:       (editingTraining?.autoSendMeetingLinkChannels as 'email' | 'whatsapp' | 'both') || 'both',
      registrationExpiryDate: editingTraining?.registrationExpiryDate || '',
      upiId: editingTraining?.upiId || '',
      courseFee: editingTraining?.courseFee?.toString() || '',
      discount: editingTraining?.discount?.toString() || '',
      offerValidTill: editingTraining?.offerValidTill || '',
      couponDiscount: editingTraining?.couponDiscount?.toString() || '',
      couponCommission: editingTraining?.couponCommission?.toString() || '',
    });
    const thumbInputRef = useRef<HTMLInputElement>(null);
    const [availableCertTemplates, setAvailableCertTemplates] = useState<DesignTemplate[]>([]);
    const [academyCourses, setAcademyCourses] = useState<{ id: string; title: string; category?: string }[]>([]);
    useEffect(() => {
      fetch(certTemplateEndpoint).then(r => r.ok ? r.json() : { items: [] }).then(d => {
        setAvailableCertTemplates(((d.items || []) as DesignTemplate[]).filter(t => t.published));
      }).catch(() => {});
      fetch('/api/academy-courses').then(r => r.ok ? r.json() : { items: [] }).then(d => {
        setAcademyCourses(d.items || []);
      }).catch(() => {});
    }, [certTemplateEndpoint]);
    const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB'); return; }
      const reader = new FileReader();
      reader.onload = () => setFormData(f => ({ ...f, thumbnailImage: reader.result as string }));
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const allModules = useMemo(() => {
      const modules: { label: string; topic: string }[] = [];
      Object.entries(sopTopicsData).forEach(([topic, subs]) => {
        (subs || []).forEach(sub => modules.push({ label: sub, topic }));
      });
      return modules;
    }, [sopTopicsData]);

    const allModuleLabels = useMemo(() => 
      allModules.map(m => `${m.label} (${m.topic})`), [allModules]);

    const subTopicsList = useMemo(() => 
      formData.topic ? (sopTopicsData[formData.topic] || []) : [],
      [formData.topic, sopTopicsData]
    );

    const trainingHours = useMemo(() => {
      if (!formData.startTime || !formData.endTime) return null;
      const start = new Date(formData.startTime);
      const end = new Date(formData.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
      const diffMs = end.getTime() - start.getTime();
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.round((diffMs % 3600000) / 60000);
      return { hours, minutes, total: parseFloat((diffMs / 3600000).toFixed(2)) };
    }, [formData.startTime, formData.endTime]);

    const filteredTrainerOptions = useMemo(() => {
      const { unitId, regionId, corpId } = contextIds;
      const scope = formData.trainerScope;
      const source = allDbTrainers.length > 0 ? allDbTrainers : trainers.map(t => ({ Name: t.Name, Unit: t.Unit, Regional: t.Regional, Corporate: t.Corporate, Department: t.Department, ID: t.ID }));

      let filtered = source;
      if (scope === 'Within Unit') {
        if (unitId) {
          const uName = (findEntityById(unitId)?.name || '').trim().toLowerCase();
          filtered = source.filter(t => (t.Unit || '').trim().toLowerCase() === uName);
        }
      } else if (scope === 'Regional') {
        if (regionId) {
          const rName = (findEntityById(regionId)?.name || '').trim().toLowerCase();
          const regionUnitNames = new Set(
            entities.filter(e => e.type === 'unit' && e.parentId === regionId).map(e => (e.name || '').trim().toLowerCase())
          );
          filtered = source.filter(t => {
            const tUnit = (t.Unit || '').trim().toLowerCase();
            const tRegion = (t.Regional || '').trim().toLowerCase();
            return tRegion === rName || regionUnitNames.has(tUnit);
          });
        }
      } else if (scope === 'Corporate') {
        if (corpId) {
          const cName = (findEntityById(corpId)?.name || '').trim().toLowerCase();
          filtered = source.filter(t => (t.Corporate || '').trim().toLowerCase() === cName);
        }
      }

      return filtered.map(t => {
        const parts = [t.Name];
        if (t.Department) parts.push(t.Department);
        if (t.Unit) parts.push(t.Unit);
        if (t.ID) parts.push(t.ID);
        return { label: parts.join(' · '), value: t.Name };
      }).sort((a, b) => a.label.localeCompare(b.label));
    }, [formData.trainerScope, contextIds, trainers, allDbTrainers, entities]);

    const filteredTrainerNames = useMemo(() => filteredTrainerOptions.map(o => o.label), [filteredTrainerOptions]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if ((currentScope === 'corporate' || currentScope === 'regional') && formData.assignedUnits.length === 0) {
        alert("Please select at least one target unit.");
        return;
      }
      const payload: Training = {
        id: editingTraining?.id || `T-${Date.now()}`,
        status: editingTraining?.status || 'Upcoming',
        topic: formData.topic,
        subTopic: formData.subTopic,
        mode: formData.mode as any,
        topicRemark: formData.topicRemark,
        trainerScope: formData.trainerScope,
        trainer: formData.trainer,
        trainerQualification: formData.trainerQualification || undefined,
        externalCompany: formData.trainerScope === 'External' ? formData.externalCompany : undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        trainingHours: trainingHours?.total || 0,
        location: formData.location,
        description: formData.description,
        date: formData.startTime.split('T')[0] || new Date().toISOString().split('T')[0],
        participantsPresent: editingTraining?.participantsPresent || 0,
        participantsAbsent: editingTraining?.participantsAbsent || 0,
        participantsNeutral: editingTraining?.participantsNeutral || 0,
        participantList: editingTraining?.participantList || [],
        hasSheet: editingTraining?.hasSheet || false,
        sheetUrl: editingTraining?.sheetUrl,
        uploadedDate: editingTraining?.uploadedDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        isLocked: editingTraining?.isLocked || false,
        createdByEntityId: editingTraining?.createdByEntityId || userRootId || 'system',
        assignedUnits: formData.assignedUnits,
        thumbnailImage: formData.thumbnailImage || undefined,
        sampleCertTemplateId: formData.sampleCertTemplateId || undefined,
        whatsappLink: formData.whatsappLink || undefined,
        meetingLink: formData.meetingLink || undefined,
        autoSendMeetingLinkOnVerify:       formData.autoSendMeetingLinkOnVerify,
        autoSendMeetingLinkOnFreeRegister: formData.autoSendMeetingLinkOnFreeRegister,
        autoSendMeetingLinkChannels:       formData.autoSendMeetingLinkChannels,
        instagramLink: formData.instagramLink || undefined,
        linkedinLink: formData.linkedinLink || undefined,
        registrationExpiryDate: formData.registrationExpiryDate || undefined,
        upiId: formData.upiId || undefined,
        courseFee: formData.courseFee ? parseFloat(formData.courseFee) : undefined,
        couponDiscount: formData.couponDiscount ? parseFloat(formData.couponDiscount) : undefined,
        couponCommission: formData.couponCommission ? parseFloat(formData.couponCommission) : undefined,
        discount: formData.discount ? parseFloat(formData.discount) : undefined,
        offerValidTill: formData.offerValidTill || undefined,
      };
      handleSave(payload);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh] border border-slate-200 overflow-hidden">
          <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#0f172a] text-white shrink-0 shadow-lg text-left">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><CalendarClock size={24}/></div>
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">
                    {editingTraining ? 'Edit Session Profile' : 'Schedule New Training'}
                    </h3>
                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1.5">Operational Resource Mapping</p>
                </div>
            </div>
            <button 
              onClick={() => { setActiveModal(null); setEditingTraining(null); }} 
              className="p-2 hover:bg-white/10 rounded-full transition-all text-white active:scale-90"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          <form onSubmit={handleSubmit} id="training-form" className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10 bg-slate-50/20 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {(currentScope === 'corporate' || currentScope === 'regional') && (
                <div className="col-span-1 md:col-span-2 animate-in slide-in-from-top-2">
                   <MultiUnitSelector 
                      entities={entities} 
                      selected={formData.assignedUnits}
                      onChange={(ids) => setFormData({...formData, assignedUnits: ids})}
                      rootId={userRootId || ''}
                      scope={currentScope}
                   />
                </div>
              )}
              <div className="col-span-1 md:col-span-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Training Topic Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <select required className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black uppercase outline-none appearance-none cursor-pointer focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.topic} onChange={(e) => setFormData({ ...formData, topic: e.target.value, subTopic: e.target.value })}>
                      <option value="">Select Academy Course...</option>
                      {academyCourses.map(c => (
                        <option key={c.id} value={c.title}>{c.title}{c.category ? ` — ${c.category}` : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Delivery Mode <span className="text-red-500">*</span></label><div className="relative"><select required className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black uppercase outline-none appearance-none cursor-pointer focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.mode} onChange={(e) => setFormData({ ...formData, mode: e.target.value })}><option value="">Select Mode...</option><option value="Classroom">Classroom</option><option value="Online">Online</option><option value="Recorded">Recorded</option><option value="Demo">Demo</option></select><ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" /></div></div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Trainer Name <span className="text-red-500">*</span></label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
                  <input type="text" required className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all uppercase" value={formData.trainer} onChange={(e) => setFormData({ ...formData, trainer: e.target.value })} placeholder="Enter trainer full name..." />
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Trainer Qualification &amp; Experience</label>
                <textarea rows={3} className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all resize-none placeholder:text-slate-300" value={formData.trainerQualification} onChange={(e) => setFormData({ ...formData, trainerQualification: e.target.value })} placeholder="E.g. MSc Food Science, 10 years industry experience, certified HACCP auditor..." /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Cycle Start <span className="text-red-500">*</span></label><input type="datetime-local" required className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} /></div>
              <div className="flex flex-col gap-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Cycle End <span className="text-red-500">*</span></label><input type="datetime-local" required className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} /></div>
              {trainingHours && (
                <div className="col-span-1 md:col-span-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3">
                    <Timer size={18} className="text-indigo-500 shrink-0" />
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Training Duration</span>
                      <span className="text-lg font-black text-indigo-700">{trainingHours.hours}h {trainingHours.minutes > 0 ? `${trainingHours.minutes}m` : ''}</span>
                      <span className="text-[9px] font-bold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">{trainingHours.total} hrs total</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="col-span-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Logistics Node / Meeting URL</label><div className="relative group"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} /><input type="text" className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="E.G. ROOM 1 OR TEAMS URL..." /></div></div>
              <div className="col-span-1 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Technical Curriculum Summary</label><textarea rows={4} className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all resize-none placeholder:text-slate-300" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Detail the agenda, objectives, and prerequisites..." /></div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                  Online Meeting / Joining Link (Zoom, Meet, Teams…)
                </label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-500 shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-3 h-3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </span>
                  <input
                    type="url"
                    className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all"
                    value={formData.meetingLink}
                    onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                    placeholder="https://meet.google.com/abc-defg-hij  or  https://zoom.us/j/..."
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Saved on the session and used for one-tap "Broadcast Meeting Link" plus the auto-send on registration / payment-verify.</p>

                {/* Auto-send controls — fire the meeting link automatically on
                    payment-verify (paid path) and immediately on registration
                    (free path). When a toggle is ON the registration / verify
                    is BLOCKED if the meeting link above is empty, so admins
                    can't accidentally accept registrants for an event with no
                    joining link configured. */}
                <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Auto-send meeting link</div>
                    <label className="flex items-start gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!formData.autoSendMeetingLinkOnVerify}
                            onChange={e => setFormData({ ...formData, autoSendMeetingLinkOnVerify: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span>
                            <span className="block font-black text-slate-800">On payment verify (paid path)</span>
                            <span className="block text-[10px] font-medium text-slate-500 mt-0.5">When you click Verify on a paid registrant, send the link automatically. If ON and no link is set above, Verify will be blocked.</span>
                        </span>
                    </label>
                    <label className="flex items-start gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!formData.autoSendMeetingLinkOnFreeRegister}
                            onChange={e => setFormData({ ...formData, autoSendMeetingLinkOnFreeRegister: e.target.checked })}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span>
                            <span className="block font-black text-slate-800">On free registration</span>
                            <span className="block text-[10px] font-medium text-slate-500 mt-0.5">Free events: send the link the moment a participant registers. If ON and no link is set above, registration will be blocked.</span>
                        </span>
                    </label>
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 block">Channels (auto-send)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['email', 'whatsapp', 'both'] as const).map(opt => {
                                const active = formData.autoSendMeetingLinkChannels === opt;
                                const label  = opt === 'email' ? 'Email only' : opt === 'whatsapp' ? 'WhatsApp only' : 'Email + WhatsApp';
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, autoSendMeetingLinkChannels: opt })}
                                        className={`px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${active ? 'border-indigo-500 bg-indigo-600 text-white shadow' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Community & Social Links</label>
                <div className="space-y-3">
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366] shrink-0">
                      <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.524 5.849L0 24l6.336-1.498A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.655-.491-5.19-1.352l-.372-.22-3.763.889.944-3.657-.241-.381A9.945 9.945 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    </span>
                    <input type="url" className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 shadow-inner transition-all" value={formData.whatsappLink} onChange={e => setFormData({ ...formData, whatsappLink: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
                  </div>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] shrink-0">
                      <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    </span>
                    <input type="url" className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-[#E1306C] focus:ring-4 focus:ring-[#E1306C]/10 shadow-inner transition-all" value={formData.instagramLink} onChange={e => setFormData({ ...formData, instagramLink: e.target.value })} placeholder="https://www.instagram.com/..." />
                  </div>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-[#0A66C2] shrink-0">
                      <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    </span>
                    <input type="url" className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-xs font-black outline-none focus:border-[#0A66C2] focus:ring-4 focus:ring-[#0A66C2]/10 shadow-inner transition-all" value={formData.linkedinLink} onChange={e => setFormData({ ...formData, linkedinLink: e.target.value })} placeholder="https://www.linkedin.com/..." />
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/><path d="M9 12h6M12 9v6"/></svg>
                  UPI Payment (optional — for paid sessions)
                </label>
                <p className="text-[9px] text-slate-300 font-bold ml-1 mb-3 uppercase tracking-widest">Leave blank for free sessions. If filled, registrants see a Pay Now button with your UPI ID.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">UPI ID</label>
                    <input
                      type="text"
                      className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 shadow-inner transition-all"
                      value={formData.upiId}
                      onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                      placeholder="yourname@upi"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Course Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 shadow-inner transition-all"
                      value={formData.courseFee}
                      onChange={e => setFormData({ ...formData, courseFee: e.target.value })}
                      placeholder="e.g. 999"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 shadow-inner transition-all"
                      value={formData.discount}
                      onChange={e => setFormData({ ...formData, discount: e.target.value })}
                      placeholder="e.g. 200"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Offer Valid Till</label>
                    <input
                      type="date"
                      className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 shadow-inner transition-all"
                      value={formData.offerValidTill}
                      onChange={e => setFormData({ ...formData, offerValidTill: e.target.value })}
                    />
                  </div>
                </div>
                {formData.courseFee && formData.discount && parseFloat(formData.discount) > 0 && (
                  <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">After Discount:</span>
                    <span className="text-sm font-black text-slate-400 line-through">₹{parseFloat(formData.courseFee).toLocaleString('en-IN')}</span>
                    <span className="text-lg font-black text-emerald-700">₹{(parseFloat(formData.courseFee) - parseFloat(formData.discount)).toLocaleString('en-IN')}</span>
                    <span className="ml-auto px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase">Save ₹{parseFloat(formData.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}

                {/* Coupon / Affiliate settings */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-[9px] font-black text-violet-500 uppercase tracking-widest mb-3">Referral Coupon Settings (Affiliate)</p>
                  <p className="text-[9px] text-slate-300 font-bold mb-3">Each registrant automatically receives a unique referral coupon. Set how much discount their coupon gives to others, and how much they earn when someone uses it.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Coupon Discount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 shadow-inner transition-all"
                        value={formData.couponDiscount}
                        onChange={e => setFormData({ ...formData, couponDiscount: e.target.value })}
                        placeholder="e.g. 100"
                      />
                      <p className="text-[8px] text-slate-300 font-bold ml-1 mt-0.5">Discount given to new registrant using this coupon</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Commission Earned (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="w-full h-11 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 shadow-inner transition-all"
                        value={formData.couponCommission}
                        onChange={e => setFormData({ ...formData, couponCommission: e.target.value })}
                        placeholder="e.g. 50"
                      />
                      <p className="text-[8px] text-slate-300 font-bold ml-1 mt-0.5">Amount coupon owner earns per successful referral</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2">
                  <Clock size={12}/> Registration Link Expiry Date
                </label>
                <p className="text-[9px] text-slate-300 font-bold ml-1 mb-2 uppercase tracking-widest">After this date the form closes — only thumbnail &amp; social links shown</p>
                <input
                  type="date"
                  className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-50 shadow-inner transition-all"
                  value={formData.registrationExpiryDate}
                  onChange={e => setFormData({ ...formData, registrationExpiryDate: e.target.value })}
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2"><ImgIcon size={12}/> Training Thumbnail</label>
                <p className="text-[9px] text-slate-300 font-bold ml-1 mb-2 uppercase tracking-widest">Shown as preview image when sharing the registration link</p>
                <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbUpload} className="hidden" />
                {formData.thumbnailImage ? (
                  <div className="relative group w-full">
                    <img src={formData.thumbnailImage} alt="Thumbnail" className="w-full h-40 object-cover rounded-2xl border-2 border-slate-100 shadow-inner" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all rounded-2xl flex items-center justify-center gap-3">
                      <button type="button" onClick={() => thumbInputRef.current?.click()} className="px-4 py-2 bg-white text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-indigo-50 transition-all">Change</button>
                      <button type="button" onClick={() => setFormData(f => ({ ...f, thumbnailImage: '' }))} className="px-4 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-rose-600 transition-all">Remove</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => thumbInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-indigo-300 hover:text-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                    <Upload size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Upload Thumbnail Image</span>
                    <span className="text-[9px] font-bold text-slate-300">Max 2MB · JPG, PNG, WebP</span>
                  </button>
                )}
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 flex items-center gap-2"><Award size={12}/> Sample Certificate</label>
                <p className="text-[9px] text-slate-300 font-bold ml-1 mb-2 uppercase tracking-widest">Select a published certificate template to show as sample on registration page</p>
                <div className="relative">
                  <select className="w-full h-12 bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-black uppercase outline-none appearance-none cursor-pointer focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={formData.sampleCertTemplateId} onChange={e => setFormData({ ...formData, sampleCertTemplateId: e.target.value })}>
                    <option value="">No sample certificate</option>
                    {availableCertTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {availableCertTemplates.length === 0 && (
                  <p className="text-[9px] text-amber-500 font-bold ml-1 mt-1.5 uppercase tracking-widest">No published templates found — create and publish one in Certificate Studio first</p>
                )}
              </div>
            </div>
          </form>

          <div className="px-10 py-8 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3 pb-safe">
            <button type="button" onClick={() => { setActiveModal(null); setEditingTraining(null); }} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Discard</button>
            <button type="submit" form="training-form" className="px-16 py-4 bg-[#0f172a] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3"><Save size={18} /> {editingTraining ? 'Finalize Changes' : 'Register Session'}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 overflow-hidden relative text-left">
         <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
         <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[2rem] shadow-inner border border-indigo-100 ring-4 ring-white">
               <Calendar size={32} />
            </div>
            <div>
               <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">Session Registry</h2>
               <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                  <ShieldCheck size={12} className="text-emerald-500"/> Resource Allocation & Integrity Hub
               </p>
            </div>
         </div>

         <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="relative group w-full md:w-80">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search registry index..." 
                 className="pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black w-full focus:outline-none focus:ring-4 focus:ring-indigo-50/10 focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-inner uppercase tracking-wider"
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
               />
            </div>
            <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`p-4 border-2 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-2 relative ${showAdvancedFilters ? 'bg-indigo-600 border-indigo-600 text-white' : hasActiveCalFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100'}`}
                title="Advanced Filters"
            >
                <Filter size={22} />
                {hasActiveCalFilters && !showAdvancedFilters && <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white" />}
            </button>
            <button 
                onClick={() => setShowSummary(!showSummary)}
                className={`p-4 border-2 rounded-2xl transition-all shadow-sm active:scale-95 flex items-center gap-2 ${showSummary ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100'}`}
                title="Curriculum Summary"
            >
                <ListChecks size={22} />
            </button>
            <button onClick={() => setActiveModal('exportOptions')} className="p-4 border-2 border-slate-100 text-slate-400 bg-white rounded-2xl hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm active:scale-95" title="Download Excel">
               <FileSpreadsheet size={22} strokeWidth={2.5} />
            </button>
            {canEdit && (
              <>
                <div
                  className="relative px-3 py-2 border-2 border-slate-100 bg-white rounded-2xl flex items-center gap-2 shadow-sm"
                  title="Default country dialling code used when a stored phone number has no country prefix. Numbers that already include a country code are unchanged. Per-registrant country (when available) takes priority, then per-region default, then global default."
                >
                  <Globe size={16} strokeWidth={2.5} className="text-slate-400" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                      WhatsApp Default
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[11px] font-black text-slate-700 tabular-nums">+{defaultWaCode}</span>
                      <select
                        value={defaultWaCode}
                        disabled={savingWaCode}
                        onChange={(e) => handleDefaultWaCodeChange(e.target.value)}
                        className="text-[10px] font-bold text-slate-600 bg-transparent border-0 outline-none focus:ring-0 cursor-pointer disabled:opacity-50"
                        aria-label="Default WhatsApp country code"
                      >
                        {COUNTRY_CODE_OPTIONS.map(opt => (
                          <option key={`${opt.country}-${opt.code}`} value={opt.code}>
                            {opt.country} (+{opt.code})
                          </option>
                        ))}
                      </select>
                      {savingWaCode && <Loader2 size={10} className="animate-spin text-slate-400" />}
                    </div>
                  </div>
                  {accessibleRegions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRegionWaPanel(v => !v)}
                      className={`ml-1 text-[8px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded-lg border transition-colors ${showRegionWaPanel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'}`}
                      title="Set a per-region default that overrides the global default for sessions in that region"
                      aria-expanded={showRegionWaPanel}
                    >
                      Per-region
                      {Object.keys(regionWaCodes).length > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[14px] h-3.5 px-1 bg-indigo-100 text-indigo-700 rounded-full text-[8px] font-black tabular-nums">
                          {Object.keys(regionWaCodes).length}
                        </span>
                      )}
                    </button>
                  )}
                  {showRegionWaPanel && accessibleRegions.length > 0 && (
                    <div className="absolute z-30 top-full left-0 mt-2 w-[320px] max-h-[360px] overflow-y-auto bg-white border-2 border-slate-100 rounded-2xl shadow-2xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                          Per-region defaults
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowRegionWaPanel(false)}
                          className="text-slate-300 hover:text-slate-600"
                          aria-label="Close per-region panel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-snug mb-2">
                        Used when a session's region has no per-registrant country and the number lacks a prefix. Falls back to the global default ({`+${defaultWaCode}`}) when a region is left as "Use global". For sessions assigned to units across multiple regions, the first resolved region (in assigned-units order) is used.
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {accessibleRegions.map(reg => {
                          const current = regionWaCodes[reg.id] || '';
                          const saving = savingRegionWaCode === reg.id;
                          return (
                            <div key={reg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                              <span className="flex-1 text-[10px] font-black text-slate-700 truncate" title={reg.name}>
                                {reg.name}
                              </span>
                              <span className="text-[10px] font-black text-slate-400 tabular-nums w-10 text-right">
                                {current ? `+${current}` : '—'}
                              </span>
                              <select
                                value={current}
                                disabled={saving}
                                onChange={(e) => handleRegionWaCodeChange(reg.id, e.target.value)}
                                className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-1 py-0.5 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 cursor-pointer disabled:opacity-50"
                                aria-label={`WhatsApp country code for ${reg.name}`}
                              >
                                <option value="">Use global</option>
                                {COUNTRY_CODE_OPTIONS.map(opt => (
                                  <option key={`${opt.country}-${opt.code}`} value={opt.code}>
                                    {opt.country} (+{opt.code})
                                  </option>
                                ))}
                              </select>
                              {saving && <Loader2 size={10} className="animate-spin text-slate-400" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={runBackfillAll}
                  disabled={backfillRunning}
                  className={`relative px-5 py-3.5 border-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 transition-all shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-60 ${backfillCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100'}`}
                  title={backfillCount > 0 ? `${backfillCount} registration${backfillCount === 1 ? '' : 's'} missing email confirmation` : 'No pending email backfill'}
                >
                  <Mail size={16} strokeWidth={2.5} />
                  Email Backfill
                  {backfillCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-rose-600 text-white rounded-full text-[10px] font-black tabular-nums shadow-md ring-2 ring-white">
                      {backfillCount > 99 ? '99+' : backfillCount}
                    </span>
                  )}
                  {backfillRunning && <Loader2 size={14} className="animate-spin ml-0.5" />}
                </button>
                <button 
                  onClick={downloadBulkCsvTemplate}
                  className="p-4 border-2 border-slate-100 text-slate-400 bg-white rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
                  title="Download Bulk Upload Template"
                >
                  <FileDown size={22} strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => bulkCsvRef.current?.click()}
                  className="px-6 py-3.5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <Upload size={18} strokeWidth={2.5} /> Bulk Upload
                </button>
                <button
                  onClick={() => { setBackfillSummary(null); setActiveModal('emailBackfill'); loadBackfillCandidates(); }}
                  className="px-6 py-3.5 bg-white border-2 border-amber-100 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 hover:bg-amber-50 hover:border-amber-200 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  title="Find registrations missing a confirmation email and re-send"
                >
                  <Send size={18} strokeWidth={2.5} /> Email Backfill
                </button>
                <button 
                  onClick={() => { setEditingTraining(null); setActiveModal('trainingForm'); }}
                  className="px-8 py-3.5 bg-[#0f172a] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 whitespace-nowrap"
                >
                  <Plus size={20} strokeWidth={3} /> Schedule New
                </button>
              </>
            )}
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
         {[
           { label: 'Total Sessions', val: metrics.total, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
           { label: 'Upcoming Hub', val: metrics.upcoming, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
           { label: 'Ongoing Flow', val: metrics.ongoing, icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
           { label: 'Completed', val: metrics.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
           { label: 'Participants', val: metrics.participants, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
         ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-xl transition-all group text-left">
               <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0`}>
                  <stat.icon size={24} />
               </div>
               <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none mb-1.5 truncate">{stat.label}</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
               </div>
            </div>
         ))}
      </div>

      {showAdvancedFilters && (
        <div className="bg-white p-6 rounded-[2rem] border border-indigo-100 shadow-xl animate-in slide-in-from-top-4 duration-300 text-left">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg"><Filter size={18} /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">Advanced Filters</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Narrow down training sessions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveCalFilters && (
                <button onClick={() => { setCalFilters({ topics: [], subTopics: [], trainers: [], modes: [], dateFrom: '', dateTo: '', activity: 'all' }); setUnitFocusFilter(null); setCurrentPage(1); }} className="px-4 py-2 text-[9px] font-black uppercase text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center gap-1.5">
                  <FilterX size={14} /> Clear All
                </button>
              )}
              <button onClick={() => setShowAdvancedFilters(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"><X size={18} /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <CalendarMultiSelect label="Training Topic" options={calFilterOptions.topics} selected={calFilters.topics} onChange={(vals) => { setCalFilters(prev => ({ ...prev, topics: vals })); setCurrentPage(1); }} placeholder="All Topics" />
            <CalendarMultiSelect label="Sub-Topic / Module" options={calFilterOptions.subTopics} selected={calFilters.subTopics} onChange={(vals) => { setCalFilters(prev => ({ ...prev, subTopics: vals })); setCurrentPage(1); }} placeholder="All Modules" />
            <CalendarMultiSelect label="Trainer Name" options={calFilterOptions.trainerNames} selected={calFilters.trainers} onChange={(vals) => { setCalFilters(prev => ({ ...prev, trainers: vals })); setCurrentPage(1); }} placeholder="All Trainers" />
            <CalendarMultiSelect label="Training Mode" options={calFilterOptions.modes} selected={calFilters.modes} onChange={(vals) => { setCalFilters(prev => ({ ...prev, modes: vals })); setCurrentPage(1); }} placeholder="All Modes" />
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date From</label>
              <input type="date" className="w-full h-[44px] bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={calFilters.dateFrom} onChange={e => { setCalFilters(prev => ({ ...prev, dateFrom: e.target.value })); setCurrentPage(1); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date To</label>
              <input type="date" className="w-full h-[44px] bg-white border-2 border-slate-100 rounded-2xl px-4 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 shadow-inner transition-all" value={calFilters.dateTo} onChange={e => { setCalFilters(prev => ({ ...prev, dateTo: e.target.value })); setCurrentPage(1); }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Status</label>
              <div className="inline-flex h-[44px] p-1 bg-slate-100 border-2 border-slate-100 rounded-2xl shadow-inner">
                {([
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active only' },
                  { key: 'inactive', label: 'Inactive only' },
                ] as { key: 'all' | 'active' | 'inactive'; label: string }[]).map(opt => {
                  const selected = calFilters.activity === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => { setCalFilters(prev => ({ ...prev, activity: opt.key })); setCurrentPage(1); }}
                      className={`flex-1 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selected ? (opt.key === 'inactive' ? 'bg-slate-700 text-white shadow' : opt.key === 'active' ? 'bg-emerald-500 text-white shadow' : 'bg-indigo-600 text-white shadow') : 'text-slate-500 hover:text-slate-800'}`}
                      aria-pressed={selected}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {hasActiveCalFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <Activity size={12} className="text-indigo-500" />
              <span>{visibleTrainings.length} of {scopeFilteredTrainings.length} sessions match filters</span>
            </div>
          )}
        </div>
      )}

      {unitFocusFilter && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-[11px] font-bold text-indigo-700">
          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
          Filtered to unit: <span className="font-black">{unitFocusFilter.focusName}</span>
          <button onClick={() => { setUnitFocusFilter(null); setCurrentPage(1); }} className="ml-auto text-indigo-400 hover:text-indigo-700 transition-colors">✕</button>
        </div>
      )}

      {showSummary && (
          <div className="bg-white p-8 rounded-[3rem] border border-indigo-100 shadow-xl animate-in slide-in-from-top-4 duration-500 text-left">
              <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><PieChart size={24}/></div>
                  <div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Curriculum Analytics Summary</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Aggregate Training Footprint by Sub-Topic</p>
                  </div>
                  <button onClick={() => setShowSummary(false)} className="ml-auto p-2 hover:bg-slate-100 rounded-full text-slate-300"><X size={20}/></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-cols-4 gap-4">
                  {subTopicSummary.map(([st, data]) => (
                      <div key={st} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 hover:border-indigo-300 transition-all group relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-600 opacity-0 group-hover:opacity-5 transition-opacity rounded-bl-[3rem]" />
                          <div className="flex justify-between items-start mb-4">
                              <div className="min-w-0">
                                  <h4 className="text-sm font-black text-slate-800 uppercase truncate leading-none mb-1.5">{st}</h4>
                                  <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{data.topic}</p>
                              </div>
                              <div className="text-right">
                                  <span className="text-xl font-black text-slate-900">{data.total}</span>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Sessions</p>
                              </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                              <div className="text-center">
                                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Upcoming</p>
                                  <p className="text-xs font-black text-amber-600">{data.upcoming}</p>
                              </div>
                              <div className="text-center border-x border-slate-200">
                                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Ongoing</p>
                                  <p className="text-xs font-black text-blue-600">{data.ongoing}</p>
                              </div>
                              <div className="text-center">
                                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Comp.</p>
                                  <p className="text-xs font-black text-emerald-600">{data.completed}</p>
                              </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                  <Users size={12} className="text-purple-500" />
                                  <span className="text-[10px] font-black text-slate-700">{data.participants} <span className="text-slate-400 font-bold">Total</span></span>
                              </div>
                              <button className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-300 group-hover:text-indigo-600 transition-colors shadow-sm">
                                  <ArrowRight size={14} />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {(() => {
        const filteredRaw = visibleTrainings.filter(t => t.topic.toLowerCase().includes(search.toLowerCase()) || t.trainer.toLowerCase().includes(search.toLowerCase()));
        // Push deactivated sessions to the bottom of the admin list so
        // active sessions are always seen first. Order within each
        // partition is preserved so existing date sorting is intact.
        const filtered = [
          ...filteredRaw.filter(t => t.isActive !== false),
          ...filteredRaw.filter(t => t.isActive === false),
        ];
        const isSearchActive = search.trim().length > 0;
        const totalItems = filtered.length;
        const showAll = rowsPerPage === -1 || isSearchActive;
        const totalPages = showAll ? 1 : Math.ceil(totalItems / rowsPerPage);
        const safePage = Math.min(currentPage, totalPages || 1);
        const startIdx = showAll ? 0 : (safePage - 1) * rowsPerPage;
        const paginatedItems = showAll ? filtered : filtered.slice(startIdx, startIdx + rowsPerPage);
        const endIdx = Math.min(startIdx + paginatedItems.length, totalItems);

        return (
          <>
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rows per page:</span>
                <select
                  className="border rounded p-1"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>All</option>
                </select>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-xs font-medium text-slate-500">
                  {isSearchActive ? `${totalItems} results found` : showAll ? `${totalItems} sessions` : `${startIdx + 1}-${endIdx} of ${totalItems} sessions`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  disabled={safePage <= 1 || showAll}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium">Page {safePage} of {totalPages}</span>
                <button
                  disabled={safePage >= totalPages || showAll}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto overflow-visible">
              {paginatedItems.map((t, idx) => (
                <SessionCard 
                    key={t.id} 
                    training={t} 
                    index={startIdx + idx + 1}
                    onEdit={() => { setEditingTraining(t); setActiveModal('trainingForm'); }}
                    onDelete={() => handleDelete(t.id)}
                    onDuplicate={() => handleDuplicate(t.id)}
                    onToggleActive={() => handleToggleActive(t.id)}
                    registrationCount={regCounts[t.id] || 0}
                    groupLinkSentCount={regGroupLinkSentCounts[t.id] || 0}
                    isManaged={managedSessionId === t.id}
                    onManageToggle={() => setManagedSessionId(managedSessionId === t.id ? null : t.id)}
                    allEmployees={allEmployees}
                    onUpdateParticipants={handleUpdateParticipants}
                    onUploadSheet={handleUploadSheet}
                    onRemoveSheet={handleRemoveSheet}
                    onUpdateThumbnail={handleUpdateThumbnail}
                    currentUserEntityId={userRootId || null}
                    certTemplateEndpoint={certTemplateEndpoint}
                    isFeatured={featuredPopupId === t.id}
                    onToggleFeature={() => handleToggleFeature(t.id)}
                    defaultWaCode={defaultWaCode}
                    regionDefaultWaCode={(() => { const r = regionIdForTraining(t); return r ? (regionWaCodes[r] || null) : null; })()}
                />
              ))}
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Rows per page:</span>
                <select
                  className="border rounded p-1"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>All</option>
                </select>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-xs font-medium text-slate-500">
                  {isSearchActive ? `${totalItems} results found` : showAll ? `${totalItems} sessions` : `${startIdx + 1}-${endIdx} of ${totalItems} sessions`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  disabled={safePage <= 1 || showAll}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium">Page {safePage} of {totalPages}</span>
                <button
                  disabled={safePage >= totalPages || showAll}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {activeModal === 'exportOptions' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="px-8 pt-8 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Download Excel Report</h3>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
              </div>
              <p className="text-xs text-slate-400 mt-1">{visibleTrainings.length} sessions in current view</p>
            </div>
            <div className="p-6 space-y-3">
              <button
                onClick={() => { exportAllSessions(); setActiveModal(null); }}
                className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-indigo-200 flex items-center gap-4 transition-all group"
              >
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:bg-indigo-100 transition-all"><FileSpreadsheet size={22} /></div>
                <div>
                  <div className="font-bold text-sm text-slate-800">All Sessions</div>
                  <div className="text-[11px] text-slate-400">Single sheet with all training sessions</div>
                </div>
              </button>
              <button
                onClick={() => { exportUnitWise(); setActiveModal(null); }}
                className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-emerald-200 flex items-center gap-4 transition-all group"
              >
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-100 transition-all"><Building2 size={22} /></div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Unit Wise</div>
                  <div className="text-[11px] text-slate-400">Multiple sheets — one per unit name</div>
                </div>
              </button>
              <button
                onClick={() => { exportDepartmentWise(); setActiveModal(null); }}
                className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-purple-200 flex items-center gap-4 transition-all group"
              >
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600 group-hover:bg-purple-100 transition-all"><Briefcase size={22} /></div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Department Wise</div>
                  <div className="text-[11px] text-slate-400">Multiple sheets — one per department name</div>
                </div>
              </button>
              <button
                onClick={() => { exportTopicWise(); setActiveModal(null); }}
                className="w-full text-left p-4 border-2 border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-amber-200 flex items-center gap-4 transition-all group"
              >
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-100 transition-all"><Layers size={22} /></div>
                <div>
                  <div className="font-bold text-sm text-slate-800">Training Topic Wise</div>
                  <div className="text-[11px] text-slate-400">Multiple sheets — one per training topic name</div>
                </div>
              </button>
              <button
                disabled={isComprehensiveExporting}
                onClick={async () => { await exportComprehensive(); setActiveModal(null); }}
                className="w-full text-left p-4 border-2 border-rose-200 bg-rose-50/40 rounded-2xl hover:bg-rose-50 hover:border-rose-300 flex items-center gap-4 transition-all group disabled:opacity-60 disabled:cursor-wait"
              >
                <div className="p-3 bg-rose-100 rounded-xl text-rose-600 group-hover:bg-rose-200 transition-all"><FileSpreadsheet size={22} /></div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800">
                    Comprehensive (Participants & Payments)
                    {isComprehensiveExporting && <span className="ml-2 text-rose-600 text-[10px] font-semibold">PREPARING…</span>}
                  </div>
                  <div className="text-[11px] text-slate-500">One sheet per training with attendees, UTR, coupon, amount paid + master payment roll-up</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'trainingForm' && <TrainingFormModal />}

      {activeModal === 'emailBackfill' && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-slate-200 animate-in zoom-in-95 overflow-hidden text-left">
            <div className="px-6 sm:px-10 py-6 sm:py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl shadow-lg"><Send size={24} /></div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Confirmation Email Backfill</h3>
                  <p className="text-[10px] font-bold text-amber-200 uppercase mt-1 tracking-widest">
                    Future-session registrations that never received a confirmation email
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveModal(null); setBackfillItems(null); setBackfillSelected(new Set()); setBackfillSummary(null); setBackfillError(''); }}
                className="p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>

            <div className="px-6 sm:px-10 py-4 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 text-amber-800">
                <Info size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {backfillLoading
                    ? 'Scanning…'
                    : `${(backfillItems || []).length} registration(s) pending · max ${backfillMaxPerCall} sends per click`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadBackfillCandidates}
                  disabled={backfillLoading || backfillSending}
                  className="px-4 py-2 bg-white border-2 border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw size={12} className={backfillLoading ? 'animate-spin' : ''} /> Rescan
                </button>
                <button
                  onClick={() => runBackfill()}
                  disabled={backfillSending || backfillLoading || backfillSelected.size === 0}
                  className="px-5 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                  {backfillSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Resend selected ({Math.min(backfillSelected.size, backfillMaxPerCall)})
                </button>
              </div>
            </div>

            {backfillError && (
              <div className="px-6 sm:px-10 py-3 bg-red-50 border-b border-red-100 text-red-700 text-[11px] font-bold flex items-center gap-2 shrink-0">
                <AlertCircle size={14} /> {backfillError}
              </div>
            )}
            {backfillSummary && (
              <div className="px-6 sm:px-10 py-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-3 shrink-0">
                <CheckCircle size={14} />
                <span>Sent {backfillSummary.sent} · Failed {backfillSummary.failed}{backfillSummary.remaining > 0 ? ` · ${backfillSummary.remaining} more pending — click again to continue.` : ''}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50">
              {backfillLoading && (
                <div className="flex items-center justify-center h-full text-slate-400 gap-3 text-sm font-bold">
                  <Loader2 size={18} className="animate-spin" /> Scanning registrations…
                </div>
              )}
              {!backfillLoading && backfillItems && backfillItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <p className="text-sm font-black uppercase tracking-wider">All caught up</p>
                  <p className="text-[11px] font-bold text-slate-400">No future-session registrations are missing a confirmation email.</p>
                </div>
              )}
              {!backfillLoading && backfillItems && backfillItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={backfillSelected.size === backfillItems.length}
                      onChange={(e) => {
                        if (e.target.checked) setBackfillSelected(new Set(backfillItems.map(i => i.id)));
                        else setBackfillSelected(new Set());
                      }}
                      className="w-4 h-4 accent-amber-600 cursor-pointer"
                    />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Select all ({backfillSelected.size}/{backfillItems.length})
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {backfillItems.map((it) => {
                      const checked = backfillSelected.has(it.id);
                      const sending = backfillSendingId === it.id;
                      return (
                        <div key={it.id} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setBackfillSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(it.id)) next.delete(it.id); else next.add(it.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 accent-amber-600 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-800 truncate">{it.name || '—'}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${it.template === 'paid_registration_pending' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                {it.template === 'paid_registration_pending' ? 'Paid' : 'Free'}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
                              {it.email || '—'} {it.whatsapp ? `· ${it.whatsapp}` : ''}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                              {it.sessionTitle || it.sessionId} · {it.sessionDate || '—'}{it.startTime ? ` · ${it.startTime}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => runBackfill([it.id])}
                            disabled={backfillSending || !!backfillSendingId}
                            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                          >
                            {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Resend
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {bulkSessions && (() => {
        const totalEmployees = bulkSessions.reduce((s, bs) => s + bs.employees.length, 0);
        const matched100 = bulkSessions.reduce((s, bs) => s + bs.employees.filter(e => e.matchPercent === 100).length, 0);
        const overallMatchPct = totalEmployees > 0 ? Math.round((matched100 / totalEmployees) * 100) : 0;
        const existingTopics = [...new Set(trainings.map(t => t.topic).filter(Boolean))].sort();
        const trainerNames = [...new Set([...allDbTrainers.map(t => t.Name), ...trainers.map(t => t.Name)].filter(Boolean))].sort();
        return (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col border border-slate-200 animate-in zoom-in-95 overflow-hidden text-left">
              <div className="px-6 sm:px-10 py-6 sm:py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Upload size={24} /></div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Bulk Calendar Upload Review</h3>
                    <p className="text-[10px] font-bold text-indigo-200 uppercase mt-1 tracking-widest">{bulkSessions.length} session(s) · {totalEmployees} employee(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`text-2xl font-black ${overallMatchPct === 100 ? 'text-emerald-400' : overallMatchPct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{overallMatchPct}%</div>
                    <span className="text-[8px] font-bold text-indigo-300 uppercase tracking-widest">Data Match</span>
                  </div>
                  <button onClick={() => { setBulkCsvData(null); setBulkSessions(null); }} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} strokeWidth={3} /></button>
                </div>
              </div>

              {overallMatchPct < 100 && (
                <div className={`px-6 sm:px-10 py-3 flex items-center gap-3 text-[10px] font-bold shrink-0 ${overallMatchPct >= 70 ? 'bg-amber-50 text-amber-700 border-b border-amber-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
                  <AlertCircle size={14} />
                  <span>{totalEmployees - matched100} of {totalEmployees} employees need review. Use dropdowns to correct mismatched data or accept suggestions.</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
                {bulkSessions.map((session, idx) => {
                  const sessionMatchCount = session.employees.filter(e => e.matchPercent === 100).length;
                  const sessionMatchPct = session.employees.length > 0 ? Math.round((sessionMatchCount / session.employees.length) * 100) : 100;
                  return (
                    <div key={session.id} className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-visible">
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0">{idx + 1}</span>
                          <div className={`ml-auto px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1.5 ${sessionMatchPct === 100 ? 'bg-emerald-100 text-emerald-700' : sessionMatchPct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            <PieChart size={12} /> {sessionMatchPct}% Match
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          <div className="relative">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Training Topic</label>
                            <div className="relative">
                              <select value={session.topic} onChange={e => handleBulkSessionFieldChange(session.id, 'topic', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all pr-8">
                                <option value={session.topic}>{session.topic || 'Select Topic'}</option>
                                {existingTopics.filter(t => t !== session.topic).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                          <div className="relative">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Trainer</label>
                            <div className="relative">
                              <select value={session.trainer} onChange={e => handleBulkSessionFieldChange(session.id, 'trainer', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 appearance-none cursor-pointer hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all pr-8">
                                <option value={session.trainer}>{session.trainer || 'Select Trainer'}</option>
                                {trainerNames.filter(t => t !== session.trainer).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Venue</label>
                            <input type="text" value={session.venue} onChange={e => handleBulkSessionFieldChange(session.id, 'venue', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Venue" />
                          </div>
                          <div>
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Start Date</label>
                            <input type="date" value={session.startDate} onChange={e => handleBulkSessionFieldChange(session.id, 'startDate', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" />
                          </div>
                          <div>
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">End Date</label>
                            <input type="date" value={session.endDate} onChange={e => handleBulkSessionFieldChange(session.id, 'endDate', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">From</label>
                              <input type="time" value={session.startTime} onChange={e => handleBulkSessionFieldChange(session.id, 'startTime', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">To</label>
                              <input type="time" value={session.endTime} onChange={e => handleBulkSessionFieldChange(session.id, 'endTime', e.target.value)} className="w-full px-3 py-2 bg-white border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-800 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employees ({session.employees.length})</p>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[8px] font-bold">{sessionMatchCount} Matched</span>
                            {session.employees.length - sessionMatchCount > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[8px] font-bold">{session.employees.length - sessionMatchCount} Need Review</span>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {session.employees.map((emp, i) => (
                            <div key={i} className={`rounded-xl border-2 p-3 transition-all ${emp.matchPercent === 100 ? 'bg-emerald-50/40 border-emerald-100' : emp.matchPercent >= 40 ? 'bg-amber-50/40 border-amber-200' : 'bg-red-50/40 border-red-200'}`}>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${emp.matchPercent === 100 ? 'bg-emerald-500' : emp.matchPercent >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}>
                                    {emp.matchPercent === 100 ? <Check size={11} className="text-white" /> : <AlertCircle size={11} className="text-white" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="relative">
                                      <select
                                        value={emp.matchedRecord ? (emp.matchedRecord.ID || emp.matchedRecord.id) : ''}
                                        onChange={e => {
                                          const sel = allEmployees.find(ae => (ae.ID || ae.id) === e.target.value);
                                          if (sel) handleBulkEmployeeChange(session.id, i, sel);
                                        }}
                                        className={`w-full px-2.5 py-1.5 border-2 rounded-lg text-[10px] font-bold appearance-none cursor-pointer pr-7 transition-all ${emp.matchPercent === 100 ? 'border-emerald-200 bg-white text-emerald-800' : 'border-amber-300 bg-white text-amber-800 hover:border-indigo-400'}`}
                                      >
                                        <option value="">{emp.csvEmployeeName || emp.csvEmployeeId} (CSV)</option>
                                        {allEmployees.map(ae => <option key={ae.ID || ae.id} value={ae.ID || ae.id}>{ae.Name} — {ae.ID}{ae.Department ? ` · ${ae.Department}` : ''}</option>)}
                                      </select>
                                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500 flex items-center gap-1"><IdCard size={9} /> {emp.resolvedEmployeeId || emp.csvEmployeeId}</span>
                                  {emp.department && <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500 flex items-center gap-1"><Briefcase size={9} /> {emp.department}</span>}
                                  {emp.unitName && <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500 flex items-center gap-1"><Building2 size={9} /> {emp.unitName}</span>}
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black ${emp.matchPercent === 100 ? 'bg-emerald-100 text-emerald-700' : emp.matchPercent >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{emp.matchPercent}%</span>
                                </div>
                              </div>
                              {emp.matchPercent < 100 && emp.suggestedRecord && (
                                <div className="mt-2 ml-8 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                  <Zap size={11} className="text-indigo-500 shrink-0" />
                                  <span className="text-[9px] font-bold text-indigo-700">
                                    Suggested: <strong>{emp.suggestedRecord.Name}</strong> ({emp.suggestedRecord.ID}){emp.suggestedRecord.Department ? ` · ${emp.suggestedRecord.Department}` : ''}{emp.suggestedRecord.Unit ? ` · ${emp.suggestedRecord.Unit}` : ''}
                                  </span>
                                  <button onClick={() => handleAcceptSuggestion(session.id, i)} className="ml-auto px-3 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all active:scale-95">Accept</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 sm:px-8 py-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <Info size={14} className="text-slate-400" />
                  <p className="text-[10px] font-bold text-slate-500">All employees will be auto-marked as <span className="text-emerald-600 font-black">PRESENT</span> · Overall match: <span className={`font-black ${overallMatchPct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{overallMatchPct}%</span></p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setBulkCsvData(null); setBulkSessions(null); }} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                  <button onClick={handleBulkCsvCommit} className="px-10 py-3.5 bg-[#0f172a] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95 flex items-center gap-2"><CheckCircle2 size={16} /> Create {bulkSessions.length} Session(s)</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <input ref={bulkCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleBulkCsvUpload} />
    </div>
  );
}
