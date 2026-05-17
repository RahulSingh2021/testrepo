"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Star, 
  MapPin, 
  CheckCircle2, 
  Users, 
  Clock, 
  ShieldCheck, 
  TrendingUp,
  RefreshCw,
  MoreVertical,
  Check,
  Plus,
  ChevronUp,
  History,
  ArrowRight,
  BrainCircuit,
  Target,
  Info,
  Medal,
  Activity,
  Crown,
  FileBadge,
  Gavel,
  ShieldAlert,
  FileText,
  UserCheck,
  Eye,
  Download,
  Briefcase,
  ExternalLink,
  Shield,
  Loader2,
  Archive,
  Award,
  Building2,
  LayoutGrid,
  ChevronDown,
  X,
  Save,
  PlusCircle,
  XCircle,
  IdCard,
  Calendar,
  Timer,
  UserPlus
} from 'lucide-react';
import { HierarchyScope, Entity } from '../types';
import { EmployeeRecord } from './LearningManagement';

interface TrainerManagementProps {
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities?: Entity[];
  masterEmployees: EmployeeRecord[];
  setMasterEmployees: React.Dispatch<React.SetStateAction<EmployeeRecord[]>>;
}

const AUTHORIZED_SCOPE_OPTIONS = [
    "General Hygiene (PRP)",
    "CCP Monitoring",
    "OPRP Management",
    "Allergen Control",
    "Internal Audit Protocol",
    "Food Defense (TACCP)",
    "Food Fraud (VACCP)",
    "Microbiological Controls",
    "Chemical Handling",
    "Crisis Management"
];

// --- MultiSelect Component for Scopes ---
const MultiSelect = ({ label, options, selected, onToggle, placeholder = "Select scopes..." }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative space-y-2" ref={ref}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`min-h-[56px] w-full p-3 bg-slate-50 border-2 rounded-2xl flex flex-wrap gap-2 items-center cursor-pointer transition-all ${isOpen ? 'border-indigo-400 bg-white ring-4 ring-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200 shadow-inner'}`}
            >
                {selected.length > 0 ? selected.map((s: string) => (
                    <span key={s} className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5 shadow-sm animate-in zoom-in-50">
                        {s}
                        <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(selected.filter((i: string) => i !== s)); }}>
                            <X size={12} strokeWidth={3} />
                        </button>
                    </span>
                )) : <span className="text-sm font-bold text-slate-300 italic px-2">{placeholder}</span>}
                <div className="ml-auto pr-2 text-slate-300">
                    <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="absolute z-[100] top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-64">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                autoFocus
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-400 shadow-inner" 
                                placeholder="Filter scopes..." 
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                        {filtered.map((opt: string) => {
                            const isSel = selected.includes(opt);
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => onToggle(isSel ? selected.filter((i: string) => i !== opt) : [...selected, opt])}
                                    className={`w-full text-left px-5 py-3 rounded-xl text-[11px] font-black uppercase transition-colors mb-0.5 flex items-center justify-between group ${isSel ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                >
                                    {opt}
                                    {isSel && <Check size={14} strokeWidth={4} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-component for the training session card ---
const ConductedSessionCard: React.FC<{ session: any, index: number }> = ({ session, index }) => {
    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col lg:flex-row items-center gap-6 lg:gap-0 relative group hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-5 lg:w-[32%] shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-[#00966d] text-white flex items-center justify-center font-black text-sm shadow-lg shrink-0">
                    {index.toString().padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-[#e8f5f1] text-[#00966d] rounded-full text-[9px] font-black uppercase tracking-widest border border-[#00966d]/10">
                            <div className="w-1 h-1 rounded-full bg-[#00966d]" /> COMPLETED
                        </span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">#T-489</span>
                    </div>
                    <h4 className="text-[15px] font-black text-[#4f46e5] uppercase tracking-tight leading-none mb-1.5 truncate">{session.topic}</h4>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 lg:px-10 border-t lg:border-t-0 lg:border-l border-slate-100 py-4 lg:py-0 w-full lg:w-auto">
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 border border-slate-100 shadow-inner shrink-0">
                            <UserCheck size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Assigned Trainer</p>
                            <p className="text-xs font-black text-slate-800 uppercase truncate">{session.trainer}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 border border-slate-100 shadow-inner shrink-0">
                            <Calendar size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Session Date</p>
                            <p className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{session.date}</p>
                            <div className="flex items-center gap-1.5">
                                <Clock size={10} className="text-slate-400" />
                                <p className="text-[9px] font-bold text-slate-500 uppercase">{session.windowStart} - {session.windowEnd}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-slate-50 rounded-xl text-slate-400 border border-slate-100 shadow-inner shrink-0">
                            <Timer size={18} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Total Training Time</p>
                            <p className="text-sm font-black text-indigo-600 uppercase leading-none">{session.duration || '---'}</p>
                            <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 inline-block">Clock Hours</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 lg:w-[22%] bg-slate-50/40 rounded-3xl lg:rounded-none lg:rounded-r-3xl flex flex-col justify-center items-center shrink-0 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-slate-100">
                <div className="flex gap-2">
                    <div className="bg-white p-2 px-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center min-w-[64px]">
                        <span className="text-lg font-black text-[#00966d]">{session.present}</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase">Present</span>
                    </div>
                    <div className="bg-white p-2 px-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center min-w-[64px]">
                        <span className="text-lg font-black text-rose-600">{session.absent}</span>
                        <span className="text-[8px] font-black text-slate-300 uppercase">Absent</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TrainerRow: React.FC<{ trainer: EmployeeRecord, onEdit: () => void }> = ({ trainer, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const initials = trainer.Name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const isExternal = trainer.trainerCategory === 'External';

  // Mock data for the conducted sessions with duration added
  const mockSessions = [
      { topic: "Standard Food Handling", subTopic: "Personal Hygiene", trainer: trainer.Name, venue: "Classroom • Main Training Ro...", date: "Mar 31, 2025", windowStart: "03:00 PM", windowEnd: "04:00 PM", duration: "1h 00m", present: 3, absent: 1, wait: 1 },
      { topic: "HACCP Principles Level 1", subTopic: "CCP Monitoring", trainer: trainer.Name, venue: "Online • Terminal 4", date: "Apr 05, 2025", windowStart: "10:00 AM", windowEnd: "11:30 AM", duration: "1h 30m", present: 12, absent: 0, wait: 2 }
  ];
  
  const getSuccessColor = (score: number) => {
      if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200';
      return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  return (
    <div className={`flex flex-col transition-all duration-500`}>
        <div className={`bg-white rounded-[2rem] border-2 shadow-sm transition-all duration-500 overflow-hidden group ${isExpanded ? 'border-indigo-600 shadow-xl rounded-b-none' : 'border-slate-100 hover:shadow-xl hover:border-indigo-400'}`}>
            <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                
                {/* Checkbox Area */}
                <div className="p-6 lg:w-16 flex items-center justify-center bg-slate-50/30 shrink-0">
                    <div className="w-5 h-5 rounded border-2 border-slate-200 flex items-center justify-center bg-white group-hover:border-indigo-400 transition-all cursor-pointer">
                        <Check size={12} className="text-white opacity-0" strokeWidth={4} />
                    </div>
                </div>

                {/* 1. EMPLOYEE INFO & FSTL BADGE */}
                <div className="p-6 lg:p-8 lg:w-[28%] flex items-start gap-6 bg-white shrink-0 relative">
                    <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-500 ${isExpanded ? 'bg-indigo-600' : 'bg-slate-300 group-hover:bg-indigo-600'}`} />
                    <div className="relative">
                        <div className={`w-16 h-16 rounded-full border-2 border-white shadow-md flex items-center justify-center font-black text-xl shrink-0 group-hover:scale-105 transition-transform ${isExternal ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-600'}`}>
                            {initials}
                        </div>
                        {trainer.isFSTL && (
                            <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in-50" title="Food Safety Team Leader">
                                <Crown size={14} fill="currentColor" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none truncate">{trainer.Name}</h3>
                            {isExternal ? (
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded text-[8px] font-black uppercase tracking-widest shadow-xs">Consultant</span>
                            ) : (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[8px] font-black uppercase tracking-widest shadow-xs">Internal Staff</span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none truncate">
                            {trainer.Corporate} • {trainer.Regional}
                        </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <FileText size={14} className="text-slate-300" /> 
                                <span>{trainer.ID}</span>
                                <div className="w-px h-3 bg-slate-200 mx-1" />
                                <span className="truncate">{trainer.Email}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. AUTHORIZED SCOPE (Clause 5.3.2) */}
                <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-slate-50/20 shrink-0">
                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                        <Gavel size={16} className="text-indigo-500" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Scope</h4>
                    </div>
                    <div className="flex wrap gap-1.5">
                        {trainer.authorizedScope.length > 0 ? trainer.authorizedScope.map((scope, sidx) => (
                            <span key={sidx} className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border transition-all ${scope.includes('CCP') || scope.includes('Audit') ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs' : 'bg-white border-slate-200 text-slate-500'}`}>
                                {scope}
                            </span>
                        )) : <span className="text-[10px] font-bold text-slate-300 italic uppercase">Unmapped Node</span>}
                    </div>
                </div>

                {/* 3. PERFORMANCE & SUCCESS (Clause 7.2.f) */}
                <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-white shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg text-white"><Users size={18} /></div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Impact</h4>
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tight">High Performer</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <Star size={16} className="text-yellow-400 fill-current" />
                            <span className="text-sm font-black text-slate-900 tracking-tighter">{trainer.rating?.toFixed(1) || '4.6'}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400" title="Total Training Conducted"><LayoutGrid size={11} /> <span className="text-[8px] font-black uppercase">Count</span></div>
                            <p className="text-xs font-black text-slate-800 leading-none">{trainer.delivered_uniqueCourses}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400"><Clock size={11} /> <span className="text-[8px] font-black uppercase">Delivered</span></div>
                            <p className="text-xs font-black text-slate-800 leading-none">{trainer.delivered_hours}h</p>
                        </div>
                        <div className="space-y-1">
                             <div className="flex items-center gap-1.5 text-slate-400"><Medal size={11} className="text-indigo-500" /> <span className="text-[8px] font-black uppercase">Success</span></div>
                             <div className={`px-1.5 py-0.5 rounded-lg border text-[10px] font-black flex items-center justify-center w-fit ${getSuccessColor(trainer.effectivenessScore)}`}>
                                 {trainer.effectivenessScore}%
                             </div>
                        </div>
                    </div>
                </div>

                {/* 5. STATUS & ACTION HUB */}
                <div className="p-6 lg:p-8 flex-1 flex flex-col justify-center items-center bg-white">
                    <div className="w-full flex justify-between lg:justify-center items-center mb-6">
                        <div className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-700 border-2 border-emerald-100 rounded-full shadow-sm">
                            <CheckCircle2 size={16} />
                            <span className="text-xs font-black uppercase tracking-widest">Active</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full">
                        <button 
                            onClick={onEdit}
                            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-600 transition-all"
                        >
                            Edit Node
                        </button>
                        <button 
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xs flex items-center justify-center gap-2 ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white'}`}
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <History size={16} />}
                            {isExpanded ? 'Hide' : 'Audit'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* EXPANDED SECTION */}
        {isExpanded && (
            <div className="animate-in slide-in-from-top-4 duration-500">
                <div className="bg-slate-50/50 border-x-2 border-b-2 border-indigo-600 rounded-b-[2rem] p-8 space-y-8 shadow-inner">
                    
                    {/* EXTERNAL CONSULTANT SPECIFIC SECTION (ISO 7.1.6) */}
                    {isExternal && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-600 text-white rounded-xl shadow-lg">
                                        <Briefcase size={16} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">External Resource Credentials (ISO 7.1.6)</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Verification of External Consultant Competence & Approval</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:text-indigo-600 transition-colors"><FileText size={20}/></div>
                                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consultant CV</p><p className="text-xs font-black text-slate-800 uppercase">Validated Resume</p></div>
                                    </div>
                                    <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Download size={16}/></button>
                                </div>
                                <div className={`bg-white p-6 rounded-3xl border shadow-sm flex items-center justify-between group ${trainer.externalArtifacts?.companyApprovalAttached ? 'border-slate-200' : 'border-rose-200 bg-rose-50'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl transition-colors ${trainer.externalArtifacts?.companyApprovalAttached ? 'bg-slate-50 text-slate-400 group-hover:text-emerald-600' : 'bg-rose-100 text-rose-600'}`}><Building2 size={20}/></div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Company Approval</p>
                                            <p className={`text-xs font-black uppercase ${trainer.externalArtifacts?.companyApprovalAttached ? 'text-slate-800' : 'text-rose-600'}`}>
                                                {trainer.externalArtifacts?.companyApprovalAttached ? 'Official Authorization' : 'APPROVAL MISSING'}
                                            </p>
                                        </div>
                                    </div>
                                    {trainer.externalArtifacts?.companyApprovalAttached ? (
                                        <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Eye size={16}/></button>
                                    ) : (
                                        <button className="p-2 bg-rose-600 text-white rounded-lg animate-pulse"><Plus size={16}/></button>
                                    )}
                                </div>
                                <div className="bg-indigo-950 p-6 rounded-3xl border border-indigo-900 shadow-xl flex items-center gap-4">
                                    <div className="p-3 bg-white/10 text-indigo-400 rounded-2xl"><ShieldCheck size={20}/></div>
                                    <div><p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Compliance Status</p><p className="text-xs font-black text-white uppercase">Verified Node {trainer.externalArtifacts?.verifiedDate}</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AUTHORITY & ARTIFACTS SECTION (Clause 5.3.2) */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#0f172a] text-white rounded-xl shadow-lg">
                                    <FileBadge size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Authority Registry Node (Clause 5.3.2)</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Verification of Appointment Letters & Digital Warrants</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group/art transition-all hover:border-indigo-300">
                                <div className="flex justify-between items-start mb-4"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Appointment Letter</span><CheckCircle2 size={16} className="text-emerald-500" /></div>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl group/art:text-indigo-600 transition-colors"><FileText size={24}/></div>
                                    <div className="min-w-0"><p className="text-xs font-black text-slate-800 uppercase truncate">ISO-22000-AUTH-042</p></div>
                                </div>
                                <button className="w-full py-2 bg-slate-50 text-[9px] font-black text-indigo-600 uppercase rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">View Document</button>
                             </div>

                             <div className="lg:col-span-3 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group/scope">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-[4rem]" />
                                <div className="flex items-center gap-3 mb-4">
                                    <Target size={16} className="text-indigo-400" />
                                    <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Technical Training Scope Adherence</h5>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {trainer.authorizedScope.map((scope, sidx) => (
                                        <div key={sidx} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl group/tag hover:bg-white/10 transition-all">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight">{scope}</span>
                                            <Check size={10} className="text-emerald-500" />
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* EFFECTIVENESS AUDIT SECTION (Clause 7.2.f) */}
                    <div className="space-y-6 pt-4 border-t border-slate-200/50">
                        <div className="flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                                    <ShieldCheck size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Clause 7.2.f - Verification of Effectiveness</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Linking Instructional Action to Post-Training Competency</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group/eff">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/eff:scale-110 transition-transform"><UserCheck size={64}/></div>
                                <div className="flex justify-between items-start mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Pass Rate</span><span className="text-2xl font-black text-slate-900">{trainer.classPassRate}%</span></div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${trainer.classPassRate}%` }} /></div>
                             </div>

                             <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group/eff">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/eff:scale-110 transition-transform"><Activity size={64}/></div>
                                <div className="flex justify-between items-start mb-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg Competency Gain</span><span className="text-2xl font-black text-indigo-600">+{trainer.avgCompetencyGain.toFixed(1)}</span></div>
                                <div className="flex gap-1">{[1, 2, 3, 4, 5].map(dot => (<div key={dot} className={`flex-1 h-2 rounded-full ${dot <= Math.round(trainer.avgCompetencyGain * 2) ? 'bg-indigo-600' : 'bg-slate-100'}`} />))}</div>
                             </div>

                             <div className="bg-indigo-950 p-6 rounded-3xl border border-indigo-900 shadow-xl relative overflow-hidden group/eff">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/eff:scale-110 transition-transform"><Medal size={64} className="text-white"/></div>
                                <div className="flex justify-between items-start mb-4"><span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Success Index</span><span className="text-3xl font-black text-white">{trainer.effectivenessScore}%</span></div>
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="bg-indigo-400 h-full" style={{ width: `${trainer.effectivenessScore}%` }} /></div>
                             </div>
                        </div>
                    </div>

                    {/* HISTORY SUB-SECTION */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-4">
                            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg">
                                <History size={16} />
                            </div>
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Instructional Deployment History</h4>
                        </div>
                        <div className="flex flex-col gap-3">
                            {mockSessions.map((session, sidx) => (
                                <ConductedSessionCard key={sidx} session={session} index={sidx + 1} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const TrainerManagement: React.FC<TrainerManagementProps> = ({ 
  masterEmployees,
  setMasterEmployees,
  currentScope 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAuditorMode, setIsAuditorMode] = useState(false);
  const [highlightedTrainerId, setHighlightedTrainerId] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('training_focus');
      if (raw) {
        const ctx = JSON.parse(raw);
        if (ctx?.focusType === 'trainer' && ctx.focusId) {
          setHighlightedTrainerId(ctx.focusId);
        }
        sessionStorage.removeItem('training_focus');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (highlightedTrainerId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedTrainerId]);

  // Enrollment State
  const [enrollSearch, setEnrollSearch] = useState("");
  const [isEnrollDropdownOpen, setIsEnrollDropdownOpen] = useState(false);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const enrollRef = useRef<HTMLDivElement>(null);

  // Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<EmployeeRecord | null>(null);
  const [formData, setFormData] = useState<Partial<EmployeeRecord>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (enrollRef.current && !enrollRef.current.contains(event.target as Node)) {
            setIsEnrollDropdownOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trainers = useMemo(() => {
    return masterEmployees.filter(e => {
        if (!e.isTrainer) return false;
        if (isAuditorMode && !e.isCoreComplianceNode) return false;
        const matchesSearch = e.Name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             e.ID.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });
  }, [masterEmployees, searchTerm, isAuditorMode]);

  const nonTrainerStaff = useMemo(() => {
    return masterEmployees.filter(e => {
        if (e.isTrainer) return false;
        if (enrollSearch.length < 1) return true;
        const s = enrollSearch.toLowerCase();
        return e.Name.toLowerCase().includes(s) || e.ID.toLowerCase().includes(s);
    }).slice(0, 10);
  }, [masterEmployees, enrollSearch]);

  const handleEnrollStaff = async () => {
      if (tempSelectedIds.length === 0) return;

      const selectedEmps = masterEmployees.filter(e => tempSelectedIds.includes(e.id));
      const trainerRecords = selectedEmps.map(e => ({
        id: `trainer-${e.id}`,
        employeeId: e.id,
        Corporate: e.Corporate,
        Regional: e.Regional,
        Unit: e.Unit,
        Name: e.Name,
        ID: e.ID,
        Department: e.Department,
        authorizedScope: [],
        trainerCategory: 'Internal',
        fsmsRole: 'Assigned Trainer',
        lastUpdated: new Date().toISOString(),
        effectivenessScore: 85,
        classPassRate: 90,
        avgCompetencyGain: 1.2,
        delivered_uniqueCourses: 0,
        delivered_participants: 0,
        delivered_hours: 0,
        certifications: [],
        competencyScorecard: [],
        isFSTL: false,
        isCoreComplianceNode: false,
        avgDelivery: 0,
        selfLearning: 0,
        lastTrainedDate: ''
      }));

      try {
        const res = await fetch('/api/trainers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(trainerRecords)
        });
        if (!res.ok) throw new Error('Failed to save trainers');

        setMasterEmployees(prev => prev.map(e => {
          if (tempSelectedIds.includes(e.id)) {
            return {
              ...e,
              isTrainer: true,
              authorizedScope: [],
              trainerCategory: 'Internal' as const,
              fsmsRole: 'Assigned Trainer',
              lastUpdated: new Date().toISOString(),
              effectivenessScore: 85,
              classPassRate: 90,
              avgCompetencyGain: 1.2
            };
          }
          return e;
        }));

        setTempSelectedIds([]);
        setEnrollSearch("");
        setIsEnrollDropdownOpen(false);
        alert(`Trainer(s) enrolled and saved to database.`);
      } catch (err) {
        console.error('Failed to enroll trainers:', err);
        alert('Failed to save trainer enrollment. Please try again.');
      }
  };

  const handleToggleSelection = (id: string) => {
      setTempSelectedIds(prev => 
          prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
  };

  const handleOpenEditModal = (trainer: EmployeeRecord) => {
      setEditingTrainer(trainer);
      setFormData({ ...trainer });
      setIsModalOpen(true);
  };

  const handleSaveTrainer = async () => {
      if (!formData.Name || !formData.ID || !(formData as any).fsmsRole) {
          alert("Mandatory Fields: Name, ID, and FSMS Authority Role.");
          return;
      }

      const updatedTrainer = { ...editingTrainer, ...formData };
      const trainerRecord = {
        id: `trainer-${editingTrainer?.id}`,
        employeeId: editingTrainer?.id,
        Corporate: updatedTrainer.Corporate,
        Regional: updatedTrainer.Regional,
        Unit: updatedTrainer.Unit,
        Name: updatedTrainer.Name,
        ID: updatedTrainer.ID,
        Department: updatedTrainer.Department,
        authorizedScope: updatedTrainer.authorizedScope || [],
        trainerCategory: updatedTrainer.trainerCategory || 'Internal',
        fsmsRole: (updatedTrainer as any).fsmsRole || 'Assigned Trainer',
        lastUpdated: new Date().toISOString(),
        effectivenessScore: updatedTrainer.effectivenessScore || 0,
        classPassRate: updatedTrainer.classPassRate || 0,
        avgCompetencyGain: updatedTrainer.avgCompetencyGain || 0,
        delivered_uniqueCourses: updatedTrainer.delivered_uniqueCourses || 0,
        delivered_participants: updatedTrainer.delivered_participants || 0,
        delivered_hours: updatedTrainer.delivered_hours || 0,
        trainerQualification: updatedTrainer.trainerQualification,
        certifications: updatedTrainer.certifications || [],
        competencyScorecard: updatedTrainer.competencyScorecard || [],
        isFSTL: updatedTrainer.isFSTL || false,
        isCoreComplianceNode: updatedTrainer.isCoreComplianceNode || false,
        externalArtifacts: updatedTrainer.externalArtifacts,
        appointmentLetterUrl: updatedTrainer.appointmentLetterUrl,
        digitalWarrantId: updatedTrainer.digitalWarrantId,
        avgDelivery: updatedTrainer.avgDelivery || 0,
        selfLearning: updatedTrainer.selfLearning || 0,
        lastTrainedDate: updatedTrainer.lastTrainedDate || ''
      };

      try {
        const res = await fetch('/api/trainers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([trainerRecord])
        });
        if (!res.ok) throw new Error('Failed to save trainer');

        setMasterEmployees(prev => {
          return prev.map(e => e.id === editingTrainer?.id ? { ...e, ...formData } as EmployeeRecord : e);
        });
        setIsModalOpen(false);
      } catch (err) {
        console.error('Failed to save trainer:', err);
        alert('Failed to save trainer changes. Please try again.');
      }
  };

  const metrics = useMemo(() => ({
    total: trainers.length,
    active: trainers.filter(t => t.Status === 'Active').length,
    experts: trainers.filter(t => (t.rating || 0) >= 4.5).length,
    external: trainers.filter(t => t.trainerCategory === 'External').length,
    totalSessions: trainers.reduce((acc, t) => acc + (t.delivered_uniqueCourses || 0), 0)
  }), [trainers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 relative">
      
      {/* 1. Header Command Terminal */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative z-[50]">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 rounded-l-[2.5rem]" />
        <div className="flex items-center gap-6 z-10 w-full md:w-auto">
          <div className={`p-4 rounded-3xl shadow-inner border transition-all duration-500 ${isAuditorMode ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
            {isAuditorMode ? <ShieldCheck size={32} /> : <UserCheck size={32} />}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                {isAuditorMode ? 'External Audit View' : 'Trainer Registry'}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> ISO 22000 Clause 7.2 Evidence Hub
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full md:w-auto">
           {/* ENROLLMENT SEARCH & ADD INTERFACE */}
           <div className="relative group w-full md:w-[360px]" ref={enrollRef}>
              <div className="flex items-center bg-slate-100 rounded-2xl border-2 border-transparent focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-inner overflow-hidden">
                <div className="pl-4 text-slate-400">
                    <UserPlus size={18} />
                </div>
                <input 
                    type="text" 
                    placeholder="Enroll Staff by Name..." 
                    className="w-full pl-3 pr-10 py-3.5 bg-transparent text-xs font-black focus:outline-none uppercase tracking-wider"
                    value={enrollSearch}
                    onChange={e => { setEnrollSearch(e.target.value); setIsEnrollDropdownOpen(true); }}
                    onFocus={() => setIsEnrollDropdownOpen(true)}
                />
                {enrollSearch && (
                    <button onClick={() => setEnrollSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={14} />
                    </button>
                )}
              </div>

              {isEnrollDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
                      <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Select staff from User List</p>
                          {tempSelectedIds.length > 0 && (
                              <button 
                                onClick={handleEnrollStaff}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg animate-in zoom-in"
                              >
                                Enroll {tempSelectedIds.length}
                              </button>
                          )}
                      </div>
                      <div className="max-h-72 overflow-y-auto custom-scrollbar">
                          {nonTrainerStaff.length > 0 ? nonTrainerStaff.map(staff => {
                              const isSelected = tempSelectedIds.includes(staff.id);
                              return (
                                <button
                                    key={staff.id}
                                    onClick={() => handleToggleSelection(staff.id)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-4 group transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all border-2 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-400 border-white shadow-sm'}`}>
                                        {isSelected ? <Check size={16} strokeWidth={4} /> : staff.Name.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1.5">{staff.Name}</p>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[8px] font-mono bg-slate-100 px-1 rounded text-slate-500 font-bold">#{staff.ID}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{staff.Department} • {staff.Unit}</span>
                                        </div>
                                    </div>
                                </button>
                              );
                          }) : (
                            <div className="p-10 text-center text-slate-300 text-[10px] font-black uppercase italic">Registry node empty</div>
                          )}
                      </div>
                  </div>
              )}
           </div>

           <div className="h-10 w-px bg-slate-200 hidden md:block mx-1" />

           <div 
              onClick={() => setIsAuditorMode(!isAuditorMode)}
              className={`p-1.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-2 ${isAuditorMode ? 'bg-emerald-600 border-emerald-600 shadow-lg' : 'bg-slate-50 border-slate-200'}`}
           >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isAuditorMode ? 'bg-white text-emerald-600 rotate-0' : 'bg-slate-200 text-slate-400'}`}>
                    <Shield size={16} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest pr-2 ${isAuditorMode ? 'text-white' : 'text-slate-400'}`}>
                    {isAuditorMode ? 'Auditor Mode Active' : 'Auditor Mode'}
                </span>
           </div>

           <div className="relative group w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Filter Registry..." 
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase tracking-wider"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
      </div>

      {/* 2. Top Metric Cluster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
              { label: 'Registered Trainers', val: metrics.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Live Status', val: metrics.active, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'External Consultants', val: metrics.external, icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Cumulative Load', val: metrics.totalSessions, icon: LayoutGrid, color: 'text-blue-600', bg: 'bg-blue-50' }
          ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all cursor-default">
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">{stat.label}</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
                  </div>
                  <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                      <stat.icon size={22} />
                  </div>
              </div>
          ))}
      </div>

      {/* 3. Main Data Roster */}
      <div className="flex flex-col gap-6">
          {trainers.length > 0 ? trainers.map(trainer => (
              <div
                key={trainer.id}
                ref={trainer.id === highlightedTrainerId ? (el) => { (highlightedRef as React.MutableRefObject<HTMLDivElement | null>).current = el; } : undefined}
                className={trainer.id === highlightedTrainerId ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-[2rem] transition-all' : ''}
              >
                <TrainerRow trainer={trainer} onEdit={() => handleOpenEditModal(trainer)} />
              </div>
          )) : (
              <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 shadow-inner">
                      {isAuditorMode ? <ShieldCheck size={48} /> : <UserCheck size={48} />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                    {isAuditorMode ? 'No Core Requirements Identified' : 'Zero Registry Hits'}
                  </h3>
                  <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                      Search staff in the header to enroll new instructional nodes or promote from the <span className="text-indigo-600 underline cursor-pointer">Staff Management</span> terminal.
                  </p>
              </div>
          )}
      </div>

      {/* MODAL: EDIT TRAINER */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[90vh]">
                  <div className="px-10 py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0 shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><UserCheck size={28} /></div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Update Profile</h3>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">ISO 22000 Competence Registry Node</p>
                        </div>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white active:scale-90"><X size={28} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-slate-50/20 text-left">
                      {/* Identity Section */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2"><IdCard size={14}/> Identity & Hierarchy</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                <input 
                                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 shadow-inner uppercase" 
                                    placeholder="Enter Name..."
                                    value={formData.Name || ''}
                                    onChange={e => setFormData({...formData, Name: e.target.value})}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
                                <input 
                                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 shadow-inner uppercase" 
                                    placeholder="ID-XXXX"
                                    value={formData.ID || ''}
                                    onChange={e => setFormData({...formData, ID: e.target.value})}
                                />
                            </div>
                        </div>
                      </div>

                      {/* FSMS Authority Section */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2"><Gavel size={14}/> FSMS Authority (Clause 5.3)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructional Role</label>
                                <input 
                                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 shadow-inner uppercase text-indigo-600" 
                                    placeholder="e.g. Lead HACCP Trainer"
                                    value={(formData as any).fsmsRole || ''}
                                    onChange={e => setFormData({...formData, fsmsRole: e.target.value} as any)}
                                />
                            </div>
                            <div className="flex items-center gap-4 px-6 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                                <label className="flex items-center gap-4 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={formData.isFSTL || false}
                                        onChange={e => setFormData({...formData, isFSTL: e.target.checked})}
                                    />
                                    <div className="w-12 h-7 bg-slate-200 rounded-full peer-checked:bg-amber-500 transition-all relative after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-600 uppercase">FSTL Status</span>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Food Safety Team Leader</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        {/* THE AUTHORISED SCOPE SECTION */}
                        <div className="animate-in slide-in-from-top-2">
                            <MultiSelect 
                                label="Authorised Training Scope (Clause 5.3.2)" 
                                options={AUTHORIZED_SCOPE_OPTIONS}
                                selected={formData.authorizedScope || []}
                                onToggle={(vals: string[]) => setFormData({...formData, authorizedScope: vals})}
                                placeholder="Assign technical domains..."
                            />
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-2 ml-1 italic leading-relaxed">
                                Note: Scopes defined here represent the official authority granted to the trainer for instructional deployment within the FSMS framework.
                            </p>
                        </div>
                      </div>

                      {/* Qualification Section */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2"><Award size={14}/> Competency Evidence (Clause 7.2)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Highest Qualification</label>
                                <input 
                                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 shadow-inner uppercase" 
                                    placeholder="e.g. M.Sc Food Technology"
                                    value={(formData as any).qualification || ''}
                                    onChange={e => setFormData({...formData, qualification: e.target.value} as any)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Years of Exp.</label>
                                <input 
                                    type="number"
                                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 shadow-inner" 
                                    value={(formData as any).totalExperience || ''}
                                    onChange={e => setFormData({...formData, totalExperience: parseFloat(e.target.value)} as any)}
                                />
                            </div>
                        </div>
                      </div>
                  </div>

                  <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                    <button onClick={() => setIsModalOpen(false)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Discard</button>
                    <button 
                        onClick={handleSaveTrainer}
                        className="px-16 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        <CheckCircle2 size={20} /> Update Record
                    </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrainerManagement;