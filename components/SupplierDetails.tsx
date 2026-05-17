"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx'; // Kept if needed by other logic, but main export uses ExcelJS
import ExcelJS from 'exceljs'; // Added for advanced export
import { 
  Plus, History, AlertTriangle, 
  User, MapPin, Search, 
  Filter, FileText, Mail, Smartphone, 
  CheckCircle2, Truck, ShieldCheck, Warehouse, 
  ShieldAlert, Clock, FileCheck, 
  Power, X, Calendar as LucideCalendar,
  ExternalLink,
  Shield,
  RefreshCw,
  MessageSquare,
  Trash2,
  CheckCircle,
  Upload,
  Download,
  Fingerprint,
  Anchor,
  Check,
  Building2,
  Briefcase,
  Zap,
  CheckCheck,
  ClipboardCheck,
  TrendingUp,
  FileSignature,
  FileEdit,
  Trash,
  Save,
  FileUp,
  ChevronRight,
  ClipboardList,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronsRight,
  FileSpreadsheet,
  CalendarDays,
  Gavel,
  BellRing,
  CheckSquare,
  Repeat,
  Eye,
  PlusCircle,
  Edit2,
  Settings2,
  Cpu,
  Info,
  Loader2,
  Edit,
  Calendar,
  MoreHorizontal,
  Play,
  Package,
  Layers,
  CalendarClock,
  List,
  SlidersHorizontal,
  LayoutGrid,
  Ban,
  Globe,
  ArrowRight,
  Target,
  Share2,
  Copy,
  KeyRound,
  RefreshCcw
} from 'lucide-react';
import { Supplier, HierarchyScope, Entity } from '../types';
import UnifiedPagination from './UnifiedPagination';
import RegistrySaveBadge from './RegistrySaveBadge';
import ChecklistEditor from './ChecklistEditor';
import type { ChecklistTemplate } from './AuditChecklistCreator';

// --- Utility: Jaro-Winkler Fuzzy Matching ---
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  let m = 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.length === 0 || str2.length === 0) return 0;
  if (str1 === str2) return 1;
  let r = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  let s1M = new Array(str1.length).fill(false);
  let s2M = new Array(str2.length).fill(false);
  for (let i = 0; i < str1.length; i++) {
    let low = i >= r ? i - r : 0;
    let high = i + r <= str2.length ? i + r : str2.length - 1;
    for (let j = low; j <= high; j++) {
      if (!s2M[j] && str1[i] === str2[j]) {
        s1M[i] = true;
        s2M[j] = true;
        m++;
        break;
      }
    }
  }
  if (m === 0) return 0;
  let k = 0, t = 0;
  for (let i = 0; i < str1.length; i++) {
    if (s1M[i]) {
      while (!s2M[k]) k++;
      if (str1[i] !== s2[k]) t++;
      k++;
    }
  }
  t /= 2;
  let jaro = (m / str1.length + m / str2.length + (m - t) / m) / 3;
  let p = 0.1, l = 0;
  if (jaro > 0.7) {
    while (str1[l] === str2[l] && l < 4) l++;
    jaro = jaro + l * p * (1 - jaro);
  }
  return jaro;
}

// --- Options Constants ---
const SERVICE_NATURE_OPTIONS = [
  "Raw Ingredients",
  "Processed Food",
  "Packaging Material",
  "Cleaning Chemicals",
  "Pest Control Service",
  "Maintenance Service",
  "Logistics",
  "Manpower Supply",
  "Consultancy",
  "Lab Testing"
];

const CONTRACT_TYPE_OPTIONS = [
  "Corporate",
  "Unit",
  "No Contract"
];

const AUDIT_FREQUENCY_OPTIONS = [
  "Monthly",
  "Quarterly",
  "Half Yearly",
  "Yearly",
  "Once in Two Years",
  "NA"
];

const RISK_LEVELS = ["High", "Medium", "Low"];

// --- Advanced Filter Types ---
interface AdvancedFilters {
  // Tab 1: General Search
  region: string;
  unit: string;
  supplierName: string;
  serviceNature: string;
  minEvalScore: string;

  // Tab 2: Status & Class
  supplierStatus: string[];
  licenseStatus: string[];
  contractType: string[];
  contractStatus: string[];
  auditFreq: string[];
  auditStatus: string[];
  evalStatus: string[];

  // Tab 3: Dates
  contractStartFrom: string;
  contractStartTo: string;
  contractEndFrom: string;
  contractEndTo: string;
  licenseStartFrom: string; // Note: Typically mapped to issue date if available, or just ignored if data missing
  licenseStartTo: string;
  licenseEndFrom: string; // Mapped to fssaiExpiry
  licenseEndTo: string;
  auditDateFrom: string; // Mapped to lastAudit
  auditDateTo: string;
  evalDateFrom: string; // Mapped to lastEval
  evalDateTo: string;
}

const INITIAL_FILTERS: AdvancedFilters = {
  region: '', unit: '', supplierName: '', serviceNature: '', minEvalScore: '',
  supplierStatus: [], licenseStatus: [], contractType: [], contractStatus: [], auditFreq: [], auditStatus: [], evalStatus: [],
  contractStartFrom: '', contractStartTo: '', contractEndFrom: '', contractEndTo: '',
  licenseStartFrom: '', licenseStartTo: '', licenseEndFrom: '', licenseEndTo: '',
  auditDateFrom: '', auditDateTo: '', evalDateFrom: '', evalDateTo: ''
};

const getRiskStyles = (risk: string) => {
  switch (risk) {
    case 'High': return 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-100';
    case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-100';
    case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getCoaColor = (status: string) => {
  switch (status) {
    case 'Valid':
    case 'Compliant': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Expired':
    case 'Non-Compliant': return 'bg-rose-50 text-rose-700 border-rose-100';
    case 'Pending':
    case 'Provisional': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-100';
  }
};

// --- Helper Components ---

const SummaryCard = ({ label, value, color, icon: Icon, trend }: any) => (
  <div className="p-5 rounded-[2rem] border border-slate-100 shadow-sm bg-white flex items-center gap-4 hover:shadow-md transition-all group active:scale-95 h-full min-w-[240px] snap-center">
    <div className={`w-10 h-10 md:w-12 md:h-12 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
      <Icon size={18} className="text-white md:w-5 md:h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-lg md:text-2xl font-black text-slate-800 tracking-tighter truncate">{value}</p>
        {trend && (
            <span className={`text-[8px] md:text-[9px] font-black uppercase ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
        )}
      </div>
    </div>
  </div>
);

const MultiSelectDropdown = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder = "Select..."
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onChange: (val: string[]) => void,
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="relative group w-full" ref={containerRef}>
      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[38px] px-3 py-2 bg-white border rounded-xl text-[10px] font-bold cursor-pointer flex flex-wrap gap-1 items-center transition-all ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200 hover:border-indigo-200'}`}
      >
        {selected.length > 0 ? (
          selected.map(s => (
            <span key={s} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
              {s}
              <button onClick={(e) => { e.stopPropagation(); toggleOption(s); }} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))
        ) : (
          <span className="text-slate-400 italic">{placeholder}</span>
        )}
        <div className="ml-auto">
          <ChevronDown size={14} className="text-slate-300" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 max-h-40 flex flex-col">
           <div className="p-2 border-b border-slate-50 shrink-0">
             <input 
               autoFocus
               className="w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs outline-none focus:border-indigo-400"
               placeholder="Search..."
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>
           <div className="overflow-y-auto custom-scrollbar p-1">
             {filteredOptions.map(opt => (
               <div 
                 key={opt} 
                 onClick={() => toggleOption(opt)}
                 className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg transition-colors ${selected.includes(opt) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
               >
                 <span className="text-[10px] font-bold uppercase">{opt}</span>
                 {selected.includes(opt) && <Check size={12} />}
               </div>
             ))}
             {filteredOptions.length === 0 && <div className="p-3 text-center text-[10px] text-slate-400 italic">No matches</div>}
           </div>
        </div>
      )}
    </div>
  );
};

const HistoryModal = ({ 
    isOpen, 
    onClose, 
    title, 
    data, 
    type 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    title: string, 
    data: any[], 
    type: 'license' | 'contract' | 'audit' | 'eval' 
}) => {
    if (!isOpen) return null;

    // Use mock data if empty for demo
    const displayData = data && data.length > 0 ? data : [
        { date: '2024-01-15', updatedBy: 'System Admin', notes: 'Initial Record Created', status: 'Active', score: 85 },
        { date: '2023-01-10', updatedBy: 'John Doe', notes: 'Previous Cycle', status: 'Expired', score: 78 }
    ];

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <History size={20} />
                        <h3 className="text-lg font-black uppercase tracking-tight">{title} History</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={20} /></button>
                </div>
                <div className="p-0 overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-[10px] font-bold">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-widest sticky top-0">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Action By</th>
                                <th className="px-6 py-4">Details / Status</th>
                                {(type === 'audit' || type === 'eval') && <th className="px-6 py-4 text-right">Score</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700">
                            {displayData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">{row.date.split('T')[0]}</td>
                                    <td className="px-6 py-4">{row.updatedBy || row.auditor || row.evaluator || 'System'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span>{row.notes || row.licenseNo || row.contractNo || 'Routine Update'}</span>
                                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded w-fit border ${row.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                {row.status || 'Archived'}
                                            </span>
                                        </div>
                                    </td>
                                    {(type === 'audit' || type === 'eval') && (
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-sm font-black ${row.score >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{row.score}%</span>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- Bulk Upload Modal Component ---

interface ReviewItem extends Supplier {
    _status?: 'collision' | 'unique' | 'corporate_match';
    _matchName?: string;
}

const BulkSupplierUploadModal = ({ 
  onClose, 
  onSave, 
  currentScope, 
  userRootId,
  existingSuppliers
}: { 
  onClose: () => void, 
  onSave: (suppliers: Supplier[]) => void, 
  currentScope: HierarchyScope, 
  userRootId?: string | null,
  existingSuppliers: Supplier[]
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [reviewList, setReviewList] = useState<ReviewItem[]>([]);

  const handleDownloadSample = () => {
    const headers = "Name,ServiceNature,Email,Phone,Address,FSSAI,ContractNo,Type,Risk\n";
    const sampleRows = "Global Foods,Raw Ingredients,contact@global.com,9876543210,123 Market St,12345678901234,CONT-001,Corporate,Low\n" +
                       "Fresh Farms,Vegetables,sales@freshfarms.com,9876543211,456 Farm Rd,12345678901235,CONT-002,Unit,Medium";
    const blob = new Blob([headers + sampleRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier_import_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        const parsedList: Supplier[] = [];

        // Basic CSV parsing (skipping header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map(c => c.trim());
            if (cols.length < 2) continue;

            parsedList.push({
                id: `S-BULK-${Date.now()}-${i}`,
                name: cols[0]?.trim() || 'Unknown',
                serviceNature: cols[1]?.trim() || 'General',
                email: cols[2]?.trim() || '',
                phone: cols[3]?.trim() || '',
                address: cols[4]?.trim() || '',
                fssai: cols[5]?.trim() || '',
                fssaiStatus: 'Valid',
                contractNo: cols[6]?.trim() || '',
                type: cols[7]?.trim() || 'No Contract',
                risk: (cols[8]?.trim() as any) || 'Low',
                status: 'Active',
                uploadedBy: 'Bulk Import',
                updatedOn: new Date().toISOString().split('T')[0],
                accepted: true,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                uploadStatus: 'Bulk',
                totalItems: 0,
                auditScore: 0,
                auditMax: 100,
                auditFreq: 'Annually',
                lastAudit: 'N/A',
                ncClosed: 0,
                ncOpen: 0,
                evalScore: 0,
                evalTarget: 85,
                evalFreq: 'Annually',
                lastEval: 'N/A',
                complaints: 0,
                lastComplaint: 'N/A',
                locationPath: 'Global > Bulk Import',
                unitId: userRootId || undefined,
                licenseHistory: [],
                contractHistory: [],
                auditHistory: [],
                evalHistory: []
            });
        }

        const enrichedList: ReviewItem[] = parsedList.map(incoming => {
            const match = existingSuppliers.find(existing => {
                const nameMatch = existing.name.toLowerCase() === incoming.name.toLowerCase();
                const fssaiMatch = existing.fssai && incoming.fssai && existing.fssai === incoming.fssai;
                return nameMatch || fssaiMatch;
            });

            if (match) {
                 const isSameUnit = match.unitId === userRootId;
                 const isGlobal = !match.unitId || match.type.toLowerCase() === 'corporate';
                 
                 if (isSameUnit) {
                     return { ...incoming, _status: 'collision', _matchName: match.name };
                 } else if (isGlobal) {
                     return { ...incoming, _status: 'corporate_match', _matchName: match.name };
                 } else {
                     return { ...incoming, _status: 'unique' };
                 }
            } else {
                return { ...incoming, _status: 'unique' };
            }
        });
        
        // Sort collisions to the top
        enrichedList.sort((a, b) => {
            if (a._status === 'collision' && b._status !== 'collision') return -1;
            if (a._status !== 'collision' && b._status === 'collision') return 1;
            return 0;
        });

        setReviewList(enrichedList);
        setStep('review');
        setIsProcessing(false);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleConfirmImport = () => {
      // Strict filter: Do NOT allow 'collision' to pass.
      const validSuppliers = reviewList
        .filter(item => item._status === 'unique' || item._status === 'corporate_match')
        .map(({ _status, _matchName, ...s }) => ({
            ...s,
            type: 'Unit', // Force unit type for local records
            unitId: userRootId || undefined // Ensure tied to current unit
        }));
      
      if (validSuppliers.length === 0) {
          alert("No valid records available to import. Duplicate entries are blocked to prevent redundancy.");
          return;
      }

      onSave(validSuppliers);
      onClose();
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
      setReviewList(prev => prev.map(item => {
          if (item.id !== id) return item;
          
          const updatedItem = { ...item, [field]: value };
          
          // Re-validate collision logic dynamically on edit
          const match = existingSuppliers.find(existing => {
             const nameMatch = existing.name.toLowerCase() === updatedItem.name.toLowerCase();
             const fssaiMatch = existing.fssai && updatedItem.fssai && existing.fssai === updatedItem.fssai;
             return nameMatch || fssaiMatch;
          });

          if (match) {
                 const isSameUnit = match.unitId === userRootId;
                 const isGlobal = !match.unitId || match.type.toLowerCase() === 'corporate';
                 if (isSameUnit) {
                     return { ...updatedItem, _status: 'collision', _matchName: match.name };
                 } else if (isGlobal) {
                     return { ...updatedItem, _status: 'corporate_match', _matchName: match.name };
                 } else {
                     return { ...updatedItem, _status: 'unique', _matchName: undefined };
                 }
          }
          return { ...updatedItem, _status: 'unique', _matchName: undefined };
      }));
  };

  const handleDeleteItem = (id: string) => {
      setReviewList(prev => prev.filter(item => item.id !== id));
  };

  if (step === 'review') {
      const uniqueCount = reviewList.filter(i => i._status === 'unique').length;
      const corpMatchCount = reviewList.filter(i => i._status === 'corporate_match').length;
      const collisionCount = reviewList.length - uniqueCount - corpMatchCount;
      const totalValid = uniqueCount + corpMatchCount;

      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh]">
                {/* Header */}
                <div className="px-8 py-6 bg-[#1e293b] text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <Truck size={24} className="text-white/80" />
                        <h3 className="text-xl font-black uppercase tracking-tight">Registry Review Matrix</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                </div>

                {/* Summary / Action Bar */}
                <div className="px-8 py-5 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Onboarding Queue</h4>
                        <p className="text-lg font-black text-slate-800 uppercase leading-none">{reviewList.length} Partner Identities Found</p>
                    </div>
                    <div className="flex gap-3">
                         <button onClick={() => { setStep('upload'); setReviewList([]); }} className="px-6 py-3 border-2 border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all">Back to Upload</button>
                         <button 
                            onClick={handleConfirmImport} 
                            disabled={totalValid === 0}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center gap-2 ${totalValid > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                         >
                             <Check size={16} strokeWidth={3} /> Commit {totalValid} Valid Records {collisionCount > 0 && `(${collisionCount} Skipped)`}
                         </button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="bg-[#1e293b] text-white px-6 py-3 grid grid-cols-12 gap-4 text-[9px] font-black uppercase tracking-[0.1em] items-center shrink-0">
                     <div className="col-span-3">Identity & Validation</div>
                     <div className="col-span-3">Registry Detail</div>
                     <div className="col-span-3">Operational Category</div>
                     <div className="col-span-2">Risk Profile</div>
                     <div className="col-span-1 text-right">Decision</div>
                </div>

                {/* Review List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 p-6 space-y-3">
                    {reviewList.map((item, idx) => (
                        <div 
                            key={item.id} 
                            className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl border-2 transition-all ${
                                item._status === 'collision' ? 'bg-rose-50 border-rose-100 hover:border-rose-200' : 
                                item._status === 'corporate_match' ? 'bg-blue-50 border-blue-100 hover:border-blue-200' :
                                'bg-white border-slate-100 hover:border-indigo-100'
                            }`}
                        >
                            {/* Identity Column */}
                            <div className="col-span-3 flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                    item._status === 'collision' ? 'bg-rose-100 text-rose-700' : 
                                    item._status === 'corporate_match' ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-500'
                                }`}>
                                    {idx + 1}
                                </div>
                                <div className="min-w-0 w-full">
                                    <input 
                                        value={item.name}
                                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                                        className="text-sm font-black text-slate-900 uppercase truncate leading-tight mb-1.5 w-full bg-transparent border-b border-transparent focus:border-slate-300 outline-none"
                                    />
                                    {item._status === 'collision' ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-rose-600 bg-white border border-rose-200 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 uppercase">
                                                <Ban size={8} /> Duplicate: Will be Skipped
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 truncate uppercase" title={`Matching: ${item._matchName}`}>Match: {item._matchName}</span>
                                        </div>
                                    ) : item._status === 'corporate_match' ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-blue-600 bg-white border border-blue-200 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 uppercase">
                                                <Globe size={8} /> Corporate Registry Found
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 truncate uppercase" title={`Global: ${item._matchName}`}>Global: {item._matchName}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 uppercase">
                                            Unique Profile
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Registry Detail */}
                            <div className="col-span-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Smartphone size={12} className="text-slate-400 shrink-0" />
                                    <input 
                                        value={item.phone}
                                        onChange={(e) => handleUpdateItem(item.id, 'phone', e.target.value)}
                                        className="text-[10px] font-bold text-slate-600 font-mono bg-transparent border-b border-transparent focus:border-slate-300 outline-none w-full"
                                        placeholder="Phone"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail size={12} className="text-slate-400 shrink-0" />
                                    <input 
                                        value={item.email}
                                        onChange={(e) => handleUpdateItem(item.id, 'email', e.target.value)}
                                        className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-transparent focus:border-slate-300 outline-none w-full"
                                        placeholder="Email"
                                    />
                                </div>
                            </div>

                            {/* Operational Category */}
                            <div className="col-span-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Process Classification</span>
                                    <select 
                                        value={item.serviceNature}
                                        onChange={(e) => handleUpdateItem(item.id, 'serviceNature', e.target.value)}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-indigo-400 cursor-pointer"
                                    >
                                        {SERVICE_NATURE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Risk Profile */}
                            <div className="col-span-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Risk Tier</span>
                                    <select 
                                        value={item.risk}
                                        onChange={(e) => handleUpdateItem(item.id, 'risk', e.target.value)}
                                        className={`w-full p-2 border rounded-lg text-[10px] font-black uppercase outline-none cursor-pointer ${item.risk === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : item.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                                    >
                                        {RISK_LEVELS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Decision */}
                            <div className="col-span-1 text-right">
                                <button 
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-white rounded-xl transition-all"
                                    title="Reject / Remove"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {reviewList.length === 0 && (
                         <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                            <p className="text-xs font-black uppercase tracking-widest">No items in queue</p>
                         </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3 text-slate-500 shrink-0">
                    <ShieldAlert size={16} className="text-amber-500" />
                    <p className="text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                        Collisions (Pink) blocked. Corporate matches (Blue) saved as Unit records. Unique (White) added.
                    </p>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white p-8 rounded-[2.5rem] relative w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
            <button onClick={onClose} className="absolute top-5 right-6 p-2 bg-slate-50 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            
            <div className="mb-8">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                    <FileUp size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Bulk Import Partners</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Upload CSV to register multiple suppliers</p>
            </div>

            <div className="space-y-4">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                >
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload size={24} className="text-indigo-500" />
                    </div>
                    <p className="text-sm font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-700">Click to Upload CSV</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">or drag and drop file here</p>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept=".csv"
                        onChange={handleFileUpload}
                    />
                </div>

                <button 
                    onClick={handleDownloadSample}
                    className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm group"
                >
                    <Download size={16} className="group-hover:translate-y-0.5 transition-transform" /> Download Sample Template
                </button>
            </div>
            
            {isProcessing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 flex-col gap-3">
                    <Loader2 size={40} className="text-indigo-600 animate-spin" />
                    <p className="text-xs font-black uppercase text-indigo-900 tracking-widest">Processing Data...</p>
                </div>
            )}
        </div>
    </div>
  );
};

// --- Linked Materials & Brands Sub-Panel ---

interface LinkedMaterialsPanelProps {
  supplierId: string;
}

const LinkedMaterialsPanel: React.FC<LinkedMaterialsPanelProps> = ({ supplierId }) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [mRes, bRes] = await Promise.all([
          fetch('/api/raw-materials'),
          fetch('/api/brands'),
        ]);
        if (!cancelled) {
          const mData = mRes.ok ? await mRes.json() : [];
          const bData = bRes.ok ? await bRes.json() : [];
          const mArr: any[] = Array.isArray(mData) ? mData : (mData?.items ?? []);
          const bArr: any[] = Array.isArray(bData) ? bData : [];
          setMaterials(
            mArr.filter((m: any) =>
              Array.isArray(m.linkedSuppliers)
                ? m.linkedSuppliers.some((s: any) => (s?.id ?? s) === supplierId)
                : false
            )
          );
          setBrands(
            bArr.filter((b: any) =>
              Array.isArray(b.supplierIds)
                ? b.supplierIds.includes(supplierId)
                : false
            )
          );
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [supplierId]);

  if (loading) {
    return (
      <div className="px-8 pb-6 border-t border-slate-100">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest animate-pulse pt-4">Loading linked items…</p>
      </div>
    );
  }

  if (materials.length === 0 && brands.length === 0) {
    return (
      <div className="px-8 pb-6 border-t border-slate-100">
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest pt-4">No linked materials or brands found for this supplier.</p>
      </div>
    );
  }

  return (
    <div className="px-8 pb-6 border-t border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
        {materials.length > 0 && (
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center text-emerald-600 text-[8px]">RM</span>
              Linked Raw Materials ({materials.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {materials.map((m: any) => (
                <span key={m.id || m.name} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[9px] font-bold uppercase">
                  {m.name}
                  {m.type && <span className="text-[7px] text-emerald-400 font-black">· {m.type}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
        {brands.length > 0 && (
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-indigo-100 rounded-md flex items-center justify-center text-indigo-600 text-[8px]">BR</span>
              Linked Brands ({brands.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {brands.map((b: any) => (
                <span key={b.id || b.name} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[9px] font-bold uppercase">
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Supplier Details Component ---

interface SupplierDetailsProps {
  suppliers: Supplier[];
  onUpdateSupplier: (id: string, updates: Partial<Supplier>) => void;
  onAddSupplier: (newSupplier: Supplier) => void;
  onDeleteSupplier?: (id: string) => void;
  suppliersLoading?: boolean;
  persistSuppliers?: (arr: Supplier[]) => Promise<void>;
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities: Entity[];
}

function getDescendantEntityIds(entities: Entity[], rootId: string): Set<string> {
  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ids.add(current);
    entities.filter(e => e.parentId === current).forEach(child => queue.push(child.id));
  }
  return ids;
}

const SupplierDetails: React.FC<SupplierDetailsProps> = ({ 
    suppliers, 
    onUpdateSupplier, 
    onAddSupplier, 
    onDeleteSupplier,
    suppliersLoading,
    persistSuppliers,
    currentScope, 
    userRootId,
    entities 
}) => {
  const [search, setSearch] = useState('');
  const [activeHistoryType, setActiveHistoryType] = useState<'license' | 'contract' | 'audit' | 'eval' | null>(null);
  const [activeHistoryData, setActiveHistoryData] = useState<any[]>([]);
  const [activeHistoryTitle, setActiveHistoryTitle] = useState("");
  const [activeSupplierId, setActiveSupplierId] = useState<string | null>(null);
  
  // Track expanded cards on mobile
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filter State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'search' | 'props' | 'dates'>('search');
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>(INITIAL_FILTERS);

  // Missing State Declarations
  const [activeDocManagerSupplier, setActiveDocManagerSupplier] = useState<Supplier | null>(null);
  const [assessmentMenuId, setAssessmentMenuId] = useState<string | null>(null);

  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    type: 'license' | 'contract';
    mode: 'renew' | 'upload';
    supplierId: string;
    currentNumber: string;
    currentDate: string;
  } | null>(null);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Audit Planning State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  
  // Local list of defined audit rules
  const [auditRules, setAuditRules] = useState<{
      id: string;
      categories: string[];
      risks: string[];
      frequency: string;
  }[]>([]);

  // Current rule being built in the left column
  const [currentRule, setCurrentRule] = useState<{
      categories: string[];
      risks: string[];
      frequency: string;
  }>({
      categories: [],
      risks: [],
      frequency: 'Yearly'
  });
  
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [supplierSubTab, setSupplierSubTab] = useState<'registry' | 'vendor-checklist'>('registry');

  const [vendorChecklists, setVendorChecklists] = useState<ChecklistTemplate[]>([]);
  const vendorDbLoaded = useRef(false);
  const vendorSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vendorChecklistsRef = useRef(vendorChecklists);
  vendorChecklistsRef.current = vendorChecklists;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch('/api/vendor-checklists');
        if (cancelled) return;
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setVendorChecklists(prev => {
              const dbMap = new Map(data.map((c: ChecklistTemplate) => [c.id, c]));
              const merged = data.map((c: ChecklistTemplate) => c);
              prev.forEach(c => { if (!dbMap.has(c.id)) merged.push(c); });
              return merged;
            });
          }
        }
      } catch (e) {
        console.error('Failed to load vendor checklists:', e);
      }
      if (!cancelled) vendorDbLoaded.current = true;
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const saveVendorChecklists = useCallback((items: ChecklistTemplate[]) => {
    if (!vendorDbLoaded.current) return;
    if (vendorSaveTimer.current) clearTimeout(vendorSaveTimer.current);
    vendorSaveTimer.current = setTimeout(() => {
      const valid = items.filter(i => i.id);
      if (valid.length === 0) return;
      fetch('/api/vendor-checklists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valid),
      }).catch(e => console.error('Failed to save vendor checklists:', e));
    }, 3000);
  }, []);

  useEffect(() => { saveVendorChecklists(vendorChecklists); }, [vendorChecklists, saveVendorChecklists]);

  useEffect(() => {
    const flushSave = (url: string, data: any[]) => {
      const valid = data.filter((i: any) => i.id);
      if (valid.length === 0) return;
      const blob = new Blob([JSON.stringify(valid)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    };
    const handleBeforeUnload = () => {
      flushSave('/api/vendor-checklists', vendorChecklistsRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(10);

  useEffect(() => { setCurrentPage(1); }, [search, advFilters]);

  // Logic to determine status
  const getLicenseStatus = (date?: string): string => {
      if (!date) return 'Not Added';
      const d = new Date(date);
      const now = new Date();
      const diffTime = d.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'Expired';
      if (diffDays <= 30) return 'Expiry Soon';
      return 'Valid';
  };

  const getContractStatus = (date?: string): string => {
      if (!date || date === 'N/A') return 'Not Added';
      return getLicenseStatus(date); // Same logic
  };

  const getAuditStatus = (nextDate?: string): string => {
      if (!nextDate) return 'Pending';
      const d = new Date(nextDate);
      const now = new Date();
      if (d < now) return 'Pending'; // Or overdue
      return 'Completed'; // Simplified logic, really implies "Up to Date"
  };

  const getEvalStatus = (lastDate?: string): string => {
      return (lastDate && lastDate !== 'N/A') ? 'Done' : 'Not Done';
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sharePortalSupplierId, setSharePortalSupplierId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const scopeFilteredSuppliers = useMemo(() => {
    if (currentScope === 'super-admin') return suppliers;
    if (!userRootId) return [];
    if (currentScope === 'unit' || currentScope === 'department') {
      return suppliers.filter(s => s.unitId === userRootId);
    }
    const descendantIds = getDescendantEntityIds(entities, userRootId);
    return suppliers.filter(s => s.unitId && descendantIds.has(s.unitId));
  }, [suppliers, currentScope, userRootId, entities]);

  const filteredSuppliers = useMemo(() => {
    return scopeFilteredSuppliers.filter(s => {
      // 1. Basic Search
      const searchLower = search.toLowerCase();
      const matchesBasicSearch = s.name.toLowerCase().includes(searchLower) || 
                                 s.id.toLowerCase().includes(searchLower) ||
                                 s.locationPath.toLowerCase().includes(searchLower);
      if (!matchesBasicSearch) return false;

      // 2. Advanced Search Tab
      if (advFilters.region && !s.locationPath.toLowerCase().includes(advFilters.region.toLowerCase())) return false;
      if (advFilters.unit) {
          const unitName = entities.find(e => e.id === s.unitId)?.name || '';
          const pathHasUnit = s.locationPath.toLowerCase().includes(advFilters.unit.toLowerCase());
          const unitHasName = unitName.toLowerCase().includes(advFilters.unit.toLowerCase());
          if (!pathHasUnit && !unitHasName) return false;
      }
      if (advFilters.supplierName && !s.name.toLowerCase().includes(advFilters.supplierName.toLowerCase())) return false;
      if (advFilters.serviceNature && !s.serviceNature.toLowerCase().includes(advFilters.serviceNature.toLowerCase())) return false;
      if (advFilters.minEvalScore) {
          const min = parseInt(advFilters.minEvalScore);
          if (!isNaN(min) && s.evalScore < min) return false;
      }

      // 3. Properties Tab
      if (advFilters.supplierStatus.length > 0 && !advFilters.supplierStatus.includes(s.status)) return false;
      if (advFilters.contractType.length > 0 && !advFilters.contractType.includes(s.type)) return false;
      if (advFilters.auditFreq.length > 0 && !advFilters.auditFreq.includes(s.auditFreq)) return false;
      
      if (advFilters.licenseStatus.length > 0) {
          const status = getLicenseStatus(s.fssaiExpiry);
          if (!advFilters.licenseStatus.includes(status)) return false;
      }
      if (advFilters.contractStatus.length > 0) {
          const status = getContractStatus(s.endDate);
          if (!advFilters.contractStatus.includes(status)) return false;
      }
      if (advFilters.auditStatus.length > 0) {
          const status = getAuditStatus(s.nextAuditDate);
          if (!advFilters.auditStatus.includes(status)) return false;
      }
      if (advFilters.evalStatus.length > 0) {
          const status = getEvalStatus(s.lastEval);
          if (!advFilters.evalStatus.includes(status)) return false;
      }

      // 4. Dates Tab
      const checkDate = (dateStr: string | undefined, from: string, to: string) => {
          if (!dateStr || dateStr === 'N/A') return false;
          const d = new Date(dateStr);
          if (from && d < new Date(from)) return false;
          if (to && d > new Date(to)) return false;
          return true;
      };

      if ((advFilters.contractStartFrom || advFilters.contractStartTo) && !checkDate(s.startDate, advFilters.contractStartFrom, advFilters.contractStartTo)) return false;
      if ((advFilters.contractEndFrom || advFilters.contractEndTo) && !checkDate(s.endDate, advFilters.contractEndFrom, advFilters.contractEndTo)) return false;
      
      // Note: License Start is not in Supplier top level, skipping
      if ((advFilters.licenseEndFrom || advFilters.licenseEndTo) && !checkDate(s.fssaiExpiry, advFilters.licenseEndFrom, advFilters.licenseEndTo)) return false;
      
      // Audit Period usually implies "When was last audit" or "When is next". Prompt says "Audit Period", usually implies range of Last Audit.
      if ((advFilters.auditDateFrom || advFilters.auditDateTo) && !checkDate(s.lastAudit, advFilters.auditDateFrom, advFilters.auditDateTo)) return false;

      if ((advFilters.evalDateFrom || advFilters.evalDateTo) && !checkDate(s.lastEval, advFilters.evalDateFrom, advFilters.evalDateTo)) return false;

      return true;
    });
  }, [scopeFilteredSuppliers, search, advFilters, entities]);

  const stats = useMemo(() => ({
    total: filteredSuppliers.length,
    active: filteredSuppliers.filter(s => s.status === 'Active').length,
    overdue: filteredSuppliers.filter(s => s.nextAuditDate && new Date(s.nextAuditDate) < new Date()).length,
    thisMonth: filteredSuppliers.filter(s => s.nextAuditDate && new Date(s.nextAuditDate).getMonth() === new Date().getMonth()).length,
    complaints: filteredSuppliers.reduce((acc, curr) => acc + curr.complaints, 0)
  }), [filteredSuppliers]);

  const totalItemsCount = filteredSuppliers.length;
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(totalItemsCount / itemsPerPage);
  
  const paginatedSuppliers = useMemo(() => {
    if (itemsPerPage === 'All') return filteredSuppliers;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(start, start + itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  const handleUpdateSupplierField = (id: string, field: keyof Supplier, value: any) => {
      onUpdateSupplier(id, { [field]: value });
  };

  const openHistory = (supplier: Supplier, type: 'license' | 'contract' | 'audit' | 'eval') => {
      setActiveHistoryType(type);
      setActiveSupplierId(supplier.id);
      
      if (type === 'license') {
          setActiveHistoryTitle('License History');
          setActiveHistoryData(supplier.licenseHistory || []);
      } else if (type === 'contract') {
          setActiveHistoryTitle('Contract History');
          setActiveHistoryData(supplier.contractHistory || []);
      } else if (type === 'audit') {
          setActiveHistoryTitle('Audit History');
          setActiveHistoryData(supplier.auditHistory || []);
      } else if (type === 'eval') {
          setActiveHistoryTitle('Performance History');
          setActiveHistoryData(supplier.evalHistory || []);
      }
  };

  const handleDocumentAction = (supplier: Supplier, type: 'license' | 'contract', mode: 'renew' | 'upload') => {
      const currentNumber = type === 'license' ? supplier.fssai : supplier.contractNo;
      const currentDate = type === 'license' ? (supplier.fssaiExpiry || '') : (supplier.endDate || '');
      
      setDocumentModal({
          isOpen: true,
          type,
          mode,
          supplierId: supplier.id,
          currentNumber: currentNumber || '',
          currentDate: currentDate
      });
  };

  const handleDocumentSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!documentModal) return;

      const formData = new FormData(e.target as HTMLFormElement);
      const newNumber = formData.get('documentNumber') as string;
      const newDate = formData.get('expiryDate') as string;
      const newStartDate = formData.get('startDate') as string;

      const updates: Partial<Supplier> = {};
      if (documentModal.type === 'license') {
          updates.fssai = newNumber;
          updates.fssaiExpiry = newDate;
          updates.fssaiStatus = 'Valid';
      } else {
          updates.contractNo = newNumber;
          updates.endDate = newDate;
          updates.startDate = newStartDate;
      }

      onUpdateSupplier(documentModal.supplierId, updates);
      setDocumentModal(null);
      alert(`${documentModal.type === 'license' ? 'License' : 'Contract'} updated successfully!`);
  };

  // Missing Function Implementation
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
        onUpdateSupplier(editingSupplier.id, editingSupplier);
        setIsEditModalOpen(false);
        setEditingSupplier(null);
    }
  };

  const handleBulkOnboardCommit = (newSuppliers: Supplier[]) => {
    const safeSuppliers = newSuppliers.filter(newSup => {
         const isDuplicate = suppliers.some(existing => 
             existing.unitId === newSup.unitId && 
             (existing.name.toLowerCase() === newSup.name.toLowerCase() || 
             (existing.fssai && newSup.fssai && existing.fssai === newSup.fssai))
         );
         return !isDuplicate;
    });

    safeSuppliers.forEach(s => onAddSupplier(s));
    setIsBulkImportModalOpen(false);
  };
  
  const toggleCard = (id: string) => {
    const next = new Set(expandedCards);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedCards(next);
  };

  const calculateNextAuditDate = (freq: string) => {
      if (freq === 'NA') return 'N/A';
      const d = new Date();
      if (freq === 'Monthly') d.setMonth(d.getMonth() + 1);
      else if (freq === 'Quarterly') d.setMonth(d.getMonth() + 3);
      else if (freq === 'Half Yearly') d.setMonth(d.getMonth() + 6);
      else if (freq === 'Yearly') d.setFullYear(d.getFullYear() + 1);
      else if (freq === 'Once in Two Years') d.setFullYear(d.getFullYear() + 2);
      return d.toISOString().split('T')[0];
  };

  // 1. Add/Update Rule in Plan
  const handleAddAuditRule = () => {
      if (editingRuleId) {
          setAuditRules(prev => prev.map(r => r.id === editingRuleId ? {
              ...r,
              categories: currentRule.categories,
              risks: currentRule.risks,
              frequency: currentRule.frequency
          } : r));
          setEditingRuleId(null);
      } else {
          setAuditRules(prev => [...prev, { 
              id: `ar-${Date.now()}`, 
              categories: currentRule.categories,
              risks: currentRule.risks,
              frequency: currentRule.frequency
          }]);
      }
      // Reset form
      setCurrentRule({ categories: [], risks: [], frequency: 'Yearly' });
  };

  // 2. Remove Rule from Plan
  const handleRemoveAuditRule = (id: string) => {
      setAuditRules(prev => prev.filter(r => r.id !== id));
  };

  // 3. Edit Rule
  const handleEditRule = (rule: any) => {
      setCurrentRule({
          categories: rule.categories,
          risks: rule.risks,
          frequency: rule.frequency
      });
      setEditingRuleId(rule.id);
  };

  // 4. Calculate Impact (Suppliers affected by current rules)
  const impactedSuppliersCount = useMemo(() => {
      if (auditRules.length === 0) return 0;
      
      let count = 0;
      suppliers.forEach(s => {
          // Check if supplier matches any rule in the stack
          const matchingRule = auditRules.find(r => 
              (r.categories.length === 0 || r.categories.includes(s.type)) &&
              (r.risks.length === 0 || r.risks.includes(s.risk))
          );
          if (matchingRule) count++;
      });
      return count;
  }, [auditRules, suppliers]);

  // 5. Sync/Apply Plan
  const handleSyncAuditSchedule = () => {
      if (auditRules.length === 0) {
          alert("Please define at least one audit rule.");
          return;
      }

      let updatedCount = 0;
      scopeFilteredSuppliers.forEach(supplier => {
          // Logic: Apply rules in order. The last matching rule wins (standard overwrite behavior)
          // OR First match wins. Let's do first match wins for simplicity here.
          const rule = auditRules.find(r => 
              (r.categories.length === 0 || r.categories.includes(supplier.type)) &&
              (r.risks.length === 0 || r.risks.includes(supplier.risk))
          );

          if (rule) {
              const nextDate = calculateNextAuditDate(rule.frequency);
              onUpdateSupplier(supplier.id, {
                  auditFreq: rule.frequency,
                  nextAuditDate: nextDate
              });
              updatedCount++;
          }
      });

      alert(`Successfully updated audit schedules for ${updatedCount} suppliers based on defined protocols.`);
      setIsScheduleModalOpen(false);
      setAuditRules([]); // Reset plan
      setEditingRuleId(null);
  };

  const hasActiveFilters = useMemo(() => JSON.stringify(advFilters) !== JSON.stringify(INITIAL_FILTERS), [advFilters]);

  // --- Excel Export Handler ---
  const handleExportSupplierData = async () => {
    setIsDownloading(true);
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Supplier Details');

        // Define columns
        worksheet.columns = [
            { header: 'Hierarchy', key: 'hierarchy', width: 30 },
            { header: 'Supplier Name', key: 'name', width: 30 },
            { header: 'Supplier Status', key: 'status', width: 15 },
            { header: 'Data Updated On', key: 'updatedOn', width: 15 },
            { header: 'Uploaded By', key: 'uploadedBy', width: 20 },
            { header: 'Service Nature', key: 'serviceNature', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Address', key: 'address', width: 30 },
            { header: 'FSSAI Number', key: 'fssai', width: 20 },
            { header: 'License Status', key: 'fssaiStatus', width: 15 },
            { header: 'Approval Status', key: 'approvalStatus', width: 15 },
            { header: 'Contract Type', key: 'contractType', width: 15 },
            { header: 'Contract No', key: 'contractNo', width: 15 },
            { header: 'Contract Start Date', key: 'startDate', width: 15 },
            { header: 'Contract End Date', key: 'endDate', width: 15 },
            { header: 'Contract Validity Status', key: 'contractValidity', width: 20 },
            { header: 'Contract Upload Status', key: 'uploadStatus', width: 20 },
            { header: 'Risk Category', key: 'risk', width: 15 },
            { header: 'Items', key: 'items', width: 20 },
            { header: 'Total Items', key: 'totalItems', width: 10 },
            { header: 'Audit Score', key: 'auditScore', width: 10 },
            { header: 'Audit Frequency', key: 'auditFreq', width: 15 },
            { header: 'Last Audit Date', key: 'lastAudit', width: 15 },
            { header: 'Audit NCs', key: 'auditNCs', width: 10 },
            { header: 'Evaluation Score (%)', key: 'evalScore', width: 15 },
            { header: 'Evaluation Target (%)', key: 'evalTarget', width: 15 },
            { header: 'Evaluation Frequency', key: 'evalFreq', width: 15 },
            { header: 'Last Evaluation Date', key: 'lastEval', width: 15 },
            { header: 'Total Complains', key: 'complaints', width: 15 },
            { header: 'Last Complain Date', key: 'lastComplaint', width: 15 },
            { header: 'Overall Status', key: 'overallStatus', width: 15 },
        ];

        // Format Header
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        
        // Add Data
        filteredSuppliers.forEach(supplier => {
            const today = new Date();
            const endDate = supplier.endDate && supplier.endDate !== 'N/A' ? new Date(supplier.endDate) : null;
            let contractValidity = 'N/A';
            if (endDate) {
                if (endDate < today) contractValidity = 'Expired';
                else if ((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24) < 30) contractValidity = 'Expiring Soon';
                else contractValidity = 'Valid';
            }

            worksheet.addRow({
                hierarchy: supplier.locationPath,
                name: supplier.name,
                status: supplier.status,
                updatedOn: supplier.updatedOn,
                uploadedBy: supplier.uploadedBy,
                serviceNature: supplier.serviceNature,
                email: supplier.email,
                address: supplier.address,
                fssai: supplier.fssai,
                fssaiStatus: supplier.fssaiStatus,
                approvalStatus: supplier.accepted ? 'Approved' : 'Pending',
                contractType: supplier.type,
                contractNo: supplier.contractNo,
                startDate: supplier.startDate,
                endDate: supplier.endDate,
                contractValidity: contractValidity,
                uploadStatus: supplier.uploadStatus,
                risk: supplier.risk,
                items: supplier.serviceNature,
                totalItems: supplier.totalItems,
                auditScore: `${supplier.auditScore}/${supplier.auditMax}`,
                auditFreq: supplier.auditFreq,
                lastAudit: supplier.lastAudit,
                auditNCs: supplier.ncOpen,
                evalScore: supplier.evalScore,
                evalTarget: supplier.evalTarget,
                evalFreq: supplier.evalFreq,
                lastEval: supplier.lastEval,
                complaints: supplier.complaints,
                lastComplaint: supplier.lastComplaint,
                overallStatus: supplier.status
            });
        });

        // Write buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Supplier_Details_${new Date().toISOString().split('T')[0]}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Export Failed", error);
        alert("Failed to generate Excel report.");
    } finally {
        setIsDownloading(false);
    }
  };

  if (suppliersLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 animate-in fade-in">
        <Loader2 size={40} className="animate-spin text-indigo-500" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Supplier Registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative px-4 sm:px-0">

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Trash2 size={32} className="text-rose-500" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-2">Delete Supplier</h3>
            <p className="text-xs font-bold text-slate-400 mb-6">This action cannot be undone. The supplier record will be permanently removed from the database.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={() => { onDeleteSupplier?.(deleteConfirmId); setDeleteConfirmId(null); }} className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Portal Link Modal */}
      {sharePortalSupplierId && (() => {
        const shareSup = scopeFilteredSuppliers.find(s => s.id === sharePortalSupplierId);
        if (!shareSup) return null;
        const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/supplier-portal/${shareSup.id}` : '';
        const currentPin = shareSup.portalPin || '';

        const generatePin = () => {
          const newPin = Math.floor(1000 + Math.random() * 9000).toString();
          onUpdateSupplier(shareSup.id, { portalPin: newPin });
        };

        const copyLink = () => {
          navigator.clipboard.writeText(portalUrl).then(() => {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
          });
        };

        const copyPin = () => {
          navigator.clipboard.writeText(currentPin).then(() => {
            setCopiedPin(true);
            setTimeout(() => setCopiedPin(false), 2000);
          });
        };

        return (
          <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                    <Share2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white">Share Portal Link</h3>
                    <p className="text-[9px] font-bold text-white/50 uppercase tracking-wider mt-0.5 truncate max-w-[200px]">{shareSup.name}</p>
                  </div>
                </div>
                <button onClick={() => setSharePortalSupplierId(null)} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Portal URL */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Portal URL</label>
                  <div className="flex gap-2 items-center bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 pr-3">
                    <p className="flex-1 text-[10px] font-bold text-slate-700 break-all leading-relaxed">{portalUrl}</p>
                    <button
                      onClick={copyLink}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${copiedLink ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}
                    >
                      {copiedLink ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>

                {/* Portal PIN */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <KeyRound size={11} /> Portal PIN (Optional Protection)
                  </label>
                  {currentPin ? (
                    <div className="flex gap-2 items-center bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4">
                      <div className="flex-1 flex items-center gap-3">
                        <p className="text-3xl font-black tracking-[0.4em] text-slate-900">{currentPin}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={copyPin}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wide transition-all ${copiedPin ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
                        >
                          {copiedPin ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy PIN</>}
                        </button>
                        <button
                          onClick={generatePin}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 text-[9px] font-black uppercase tracking-wide transition-all"
                        >
                          <RefreshCcw size={12} /> Regenerate
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
                      <p className="text-[10px] font-bold text-slate-400">No PIN set — portal is accessible to anyone with the link.</p>
                      <button
                        onClick={generatePin}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-sm"
                      >
                        <KeyRound size={12} /> Generate PIN
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] text-slate-400 font-bold ml-1">Share the URL + PIN with your supplier contact via WhatsApp, Email, or SMS.</p>
                </div>

                <button
                  onClick={() => setSharePortalSupplierId(null)}
                  className="w-full py-3 border-2 border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {([
          { id: 'registry' as const, label: 'Supplier Registry', icon: Truck },
          { id: 'vendor-checklist' as const, label: 'Vendor Audit Checklist', icon: ClipboardCheck },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setSupplierSubTab(tab.id)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2 ${
              supplierSubTab === tab.id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {supplierSubTab === 'vendor-checklist' && (
        <ChecklistEditor
          protocols={[]}
          checklists={vendorChecklists}
          setChecklists={setVendorChecklists}
          externalSync
        />
      )}

      {supplierSubTab === 'registry' && <>
      {/* KPI Stats Grid - Mobile Scrollable */}
      <div className="flex overflow-x-auto snap-x hide-scrollbar gap-3 pb-4">
        <SummaryCard label="Unit Partners" value={stats.total} color="bg-indigo-600" icon={Warehouse} />
        <SummaryCard label="Operational" value={stats.active} color="bg-emerald-500" icon={CheckCircle2} />
        <SummaryCard label="Audit Overdue" value={stats.overdue} color="bg-rose-500" icon={ShieldAlert} />
        <SummaryCard label="Due This Month" value={stats.thisMonth} color="bg-amber-500" icon={LucideCalendar} />
        <SummaryCard label="Active Complaints" value={stats.complaints} color="bg-slate-800" icon={MessageSquare} />
      </div>

      {/* Main Filter & Action Bar */}
      <div className="bg-white p-5 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-emerald-600" />
        <div className="flex items-center gap-4 md:gap-6 w-full lg:w-auto">
          <div className="p-3 md:p-4 bg-emerald-50 text-emerald-600 rounded-2xl md:rounded-3xl shadow-inner border border-emerald-100 shrink-0">
            <Truck size={32} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none truncate">Supplier Registry</h2>
            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> Authorized Supply Chain Ecosystem
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative group w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search partner index..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-emerald-400 focus:bg-white transition-all shadow-inner uppercase"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar">
            <button
                onClick={() => setIsFilterModalOpen(true)}
                className={`flex-1 sm:flex-none px-4 py-3.5 border-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap ${hasActiveFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'}`}
            >
                <Filter size={18} /> {hasActiveFilters ? 'Active' : 'Filters'}
            </button>
            <button
                onClick={handleExportSupplierData}
                disabled={isDownloading}
                className="flex-1 sm:flex-none px-4 py-3.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap disabled:opacity-50"
            >
                {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                Download Excel
            </button>
            <button
                onClick={() => { 
                    setIsScheduleModalOpen(true); 
                    setAuditRules([]); // Reset plan on open
                    setCurrentRule({ categories: [], risks: [], frequency: 'Yearly' }); // Reset inputs
                    setEditingRuleId(null);
                }}
                className="flex-1 sm:flex-none px-4 py-3.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
                <CalendarClock size={18} /> Schedule Audit
            </button>
            <button 
              onClick={() => setIsBulkImportModalOpen(true)}
              className="flex-1 sm:flex-none px-6 py-3.5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
            >
              <FileUp size={18} strokeWidth={3} /> Bulk Import
            </button>
            <button 
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex-1 sm:flex-none px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={3} /> Add Single
            </button>
            {/* Background-save badge — surfaces the debounced /api/suppliers
                save lifecycle (Saving / Saved / Save failed / Newer server
                version), mirrors the recipes/ingredients pattern. */}
            <RegistrySaveBadge registryKey="suppliers" hideWhenIdle label="suppliers" />
          </div>
        </div>
      </div>

      {/* Supplier List - 5 Column Grid */}
      <div className="space-y-6">
        {paginatedSuppliers.map((supplier, index) => {
          const isActuallyActive = supplier.status === 'Active';
          const isSelected = selectedItems.has(supplier.id);
          const isAuditOverdue = supplier.nextAuditDate && new Date(supplier.nextAuditDate) < new Date();
          
          const isExpanded = expandedCards.has(supplier.id);

          // Context Resolution
          const linkedUnit = entities.find(e => e.id === supplier.unitId);
          const unitName = linkedUnit ? linkedUnit.name : 'Unknown Unit';
          const fullPath = supplier.locationPath || (linkedUnit ? `${unitName}` : 'Global');

          // Ensure material categories is an array
          const materials = supplier.serviceNature ? supplier.serviceNature.split(',').map(s => s.trim()) : [];

          return (
            <div key={supplier.id} className={`bg-white rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-indigo-600 bg-indigo-50/5 shadow-lg' : 'border-slate-100 shadow-sm hover:border-indigo-400/30'}`}>
                <div className="grid grid-cols-12 min-h-[220px] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    
                    {/* COLUMN 1: IDENTITY & LICENSE (Span 3) */}
                    <div className="col-span-12 lg:col-span-3 p-8 flex flex-col justify-between bg-white relative group/col1">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                        <div>
                             <div className="flex items-start justify-between mb-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none truncate max-w-[180px]">{supplier.name}</h3>
                                        <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border ${getRiskStyles(supplier.risk)}`}>{supplier.risk}</div>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">{fullPath}</p>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  {onDeleteSupplier && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(supplier.id); }}
                                      className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-400 hover:text-rose-600 hover:border-rose-400 transition-all shadow-sm opacity-0 group-hover/col1:opacity-100"
                                      title="Delete supplier"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                  <button 
                                      onClick={() => toggleCard(supplier.id)}
                                      className="lg:hidden p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                  >
                                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </button>
                                </div>
                             </div>

                             <div className="space-y-3">
                                 <div className="flex items-center gap-3 group/info">
                                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><User size={14}/></div>
                                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Contact</p><p className="text-[10px] font-bold text-slate-700 truncate">{supplier.uploadedBy}</p></div>
                                 </div>
                                 <div className="flex items-center gap-3 group/info">
                                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Smartphone size={14}/></div>
                                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Mobile</p><p className="text-[10px] font-bold text-slate-700 truncate">{supplier.phone}</p></div>
                                 </div>
                                 <div className="flex items-center gap-3 group/info">
                                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><MapPin size={14}/></div>
                                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase">Address</p><p className="text-[10px] font-bold text-slate-700 truncate leading-tight line-clamp-2">{supplier.address}</p></div>
                                 </div>
                             </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">FSSAI License</span>
                                <button onClick={() => openHistory(supplier, 'license')} className="text-[9px] font-black text-indigo-500 flex items-center gap-1 hover:underline"><History size={10}/> History</button>
                            </div>
                            <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border bg-slate-50 ${getCoaColor(supplier.fssaiStatus)}`}>
                                <div className="flex items-center gap-2"><ShieldCheck size={14} /> <span className="text-xs font-black">{supplier.fssai}</span></div>
                                <div className="flex gap-1">
                                    <button className="p-1.5 bg-white text-slate-400 rounded-lg hover:text-indigo-600 shadow-sm" title="View"><Eye size={12}/></button>
                                    <button onClick={() => handleDocumentAction(supplier, 'license', 'renew')} className="p-1.5 bg-white text-slate-400 rounded-lg hover:text-emerald-600 shadow-sm" title="Renew"><RefreshCw size={12}/></button>
                                    <button onClick={() => handleDocumentAction(supplier, 'license', 'upload')} className="p-1.5 bg-white text-slate-400 rounded-lg hover:text-blue-600 shadow-sm" title="Upload"><Upload size={12}/></button>
                                </div>
                            </div>
                            <p className="text-[8px] font-bold text-slate-400 text-right mt-1">Exp: {supplier.fssaiExpiry || 'N/A'}</p>
                        </div>
                    </div>

                    {/* COLUMN 2: CONTRACT & MATERIALS (Span 3) */}
                    <div className={`col-span-12 lg:col-span-3 p-8 bg-slate-50/20 flex flex-col justify-between ${isExpanded ? 'flex' : 'hidden lg:flex'}`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-indigo-600 mb-2">
                                <div className="flex items-center gap-2"><FileText size={16} /><h4 className="text-[10px] font-black uppercase tracking-widest">Contract Hub</h4></div>
                                <button onClick={() => openHistory(supplier, 'contract')} className="text-[9px] font-black text-slate-400 flex items-center gap-1 hover:text-indigo-600"><History size={10}/></button>
                            </div>
                            
                            <MultiSelectDropdown 
                                label="Material Supplied"
                                options={SERVICE_NATURE_OPTIONS}
                                selected={materials}
                                onChange={(vals) => handleUpdateSupplierField(supplier.id, 'serviceNature', vals.join(','))}
                            />

                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                                <div className="flex justify-between items-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Type</p>
                                    <p className="text-[10px] font-black text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded">{supplier.type}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase">Contract No</p>
                                    <p className="text-[10px] font-mono font-bold text-indigo-600">{supplier.contractNo}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-center">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">Start</p><p className="text-[9px] font-bold text-slate-700">{supplier.startDate}</p>
                                </div>
                                <div className="bg-white px-2 py-1.5 rounded-lg border border-slate-200 text-center">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">End</p><p className="text-[9px] font-bold text-slate-700">{supplier.endDate}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                             <button onClick={() => setActiveDocManagerSupplier(supplier)} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold uppercase text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm">View Copy</button>
                             <button onClick={() => handleDocumentAction(supplier, 'contract', 'renew')} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-indigo-700 transition-all shadow-md">Renew / Upload</button>
                        </div>
                    </div>

                    {/* COLUMN 3: AUDIT (Span 2) */}
                    <div className={`col-span-12 md:col-span-6 lg:col-span-2 p-8 bg-white flex flex-col justify-between ${isExpanded ? 'flex' : 'hidden lg:flex'}`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-rose-500 mb-2">
                                <div className="flex items-center gap-2"><ClipboardList size={16} /><h4 className="text-[10px] font-black uppercase tracking-widest">Audit Matrix</h4></div>
                                <button onClick={() => openHistory(supplier, 'audit')} className="text-[9px] font-black text-slate-400 flex items-center gap-1 hover:text-rose-500"><History size={10}/></button>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl font-black tracking-tighter ${supplier.auditScore >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{supplier.auditScore}</span>
                                <span className="text-[10px] font-bold text-slate-400">/ {supplier.auditMax}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 border-b border-slate-50 pb-1"><span>Freq</span><span>{supplier.auditFreq}</span></div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 border-b border-slate-50 pb-1"><span>Last</span><span>{supplier.lastAudit}</span></div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500"><span>Due</span><span className={isAuditOverdue ? 'text-rose-500 font-black' : ''}>{supplier.nextAuditDate || 'N/A'}</span></div>
                            </div>
                        </div>
                        <button className="mt-4 w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-100 transition-all flex items-center justify-center gap-2 shadow-sm border border-rose-100">
                            <Play size={12} fill="currentColor" /> Start Audit
                        </button>
                    </div>

                    {/* COLUMN 4: EVALUATION (Span 2) */}
                    <div className={`col-span-12 md:col-span-6 lg:col-span-2 p-8 bg-slate-50/20 flex flex-col justify-between ${isExpanded ? 'flex' : 'hidden lg:flex'}`}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-amber-500 mb-2">
                                <div className="flex items-center gap-2"><TrendingUp size={16} /><h4 className="text-[10px] font-black uppercase tracking-widest">Evaluation</h4></div>
                                <button onClick={() => openHistory(supplier, 'eval')} className="text-[9px] font-black text-slate-400 flex items-center gap-1 hover:text-amber-500"><History size={10}/></button>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black tracking-tighter text-slate-800">{supplier.evalScore}%</span>
                                <span className="text-[10px] font-bold text-slate-400">Target: {supplier.evalTarget}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 border-b border-slate-200 pb-1"><span>Freq</span><span>{supplier.evalFreq}</span></div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500"><span>Last</span><span>{supplier.lastEval}</span></div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-500 border-t border-slate-200 pt-1"><span>Next</span><span>2025-06-01</span></div>
                            </div>
                        </div>
                        <button className="mt-4 w-full py-2.5 bg-amber-50 text-amber-600 rounded-xl text-[9px] font-black uppercase hover:bg-amber-100 transition-all flex items-center justify-center gap-2 shadow-sm border border-amber-100">
                            <Play size={12} fill="currentColor" /> Start Eval
                        </button>
                    </div>

                    {/* COLUMN 5: ACTIONS (Span 2) */}
                    <div className={`col-span-12 md:col-span-12 lg:col-span-2 p-8 bg-white flex flex-col justify-center gap-3 lg:border-l border-slate-100 ${isExpanded ? 'flex' : 'hidden lg:flex'}`}>
                        <button 
                            onClick={() => handleUpdateSupplierField(supplier.id, 'status', isActuallyActive ? 'Inactive' : 'Active')} 
                            className={`w-full py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${isActuallyActive ? 'bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200' : 'bg-emerald-50 border-emerald-500 text-white'}`}
                        >
                            <Power size={14} /> {isActuallyActive ? 'Deactivate' : 'Activate'}
                        </button>
                        
                        <button 
                             onClick={() => setAssessmentMenuId(assessmentMenuId === supplier.id ? null : supplier.id)}
                             className="w-full py-3 bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-amber-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={14} /> Log Complain
                        </button>
                        
                        <button 
                             onClick={() => { setEditingSupplier(supplier); setIsEditModalOpen(true); }}
                             className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Edit size={14} /> Edit Profile
                        </button>

                        <button 
                             onClick={() => { setCopiedLink(false); setCopiedPin(false); setSharePortalSupplierId(supplier.id); }}
                             className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Share2 size={14} /> Share Portal
                        </button>
                    </div>

                </div>

                {/* Linked Materials & Brands — always visible on desktop, expand-only on mobile */}
                <div className={isExpanded ? 'block' : 'hidden lg:block'}>
                  <LinkedMaterialsPanel supplierId={supplier.id} />
                </div>
            </div>
          );
        })}

        {/* Mobile Floating Action Button (FAB) */}
        <div className="md:hidden fixed bottom-24 right-6 z-50">
            <button 
                onClick={() => setIsRegisterModalOpen(true)}
                className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all border-4 border-white"
            >
                <Plus size={32} strokeWidth={3} />
            </button>
        </div>
      </div>

      {totalItemsCount > 0 && (
        <div className="mt-8">
          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItemsCount}
            rowsPerPage={typeof itemsPerPage === 'number' ? itemsPerPage : totalItemsCount}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[85vh]">
                  <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-5">
                          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Filter size={24}/></div>
                          <div>
                              <h3 className="text-xl font-black uppercase tracking-tight">Advanced Filtering</h3>
                              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Refine Registry Search</p>
                          </div>
                      </div>
                      <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                  </div>
                  
                  <div className="flex border-b border-slate-100 bg-slate-50 px-10">
                      <button onClick={() => setActiveFilterTab('search')} className={`py-4 px-6 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeFilterTab === 'search' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>General Search</button>
                      <button onClick={() => setActiveFilterTab('props')} className={`py-4 px-6 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeFilterTab === 'props' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Status & Class</button>
                      <button onClick={() => setActiveFilterTab('dates')} className={`py-4 px-6 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${activeFilterTab === 'dates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Timeline & Dates</button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-white">
                      {activeFilterTab === 'search' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regional Scope</label>
                                  <input placeholder="Search Region..." value={advFilters.region} onChange={e => setAdvFilters({...advFilters, region: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 uppercase" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Node</label>
                                  <input placeholder="Search Unit..." value={advFilters.unit} onChange={e => setAdvFilters({...advFilters, unit: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 uppercase" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier Name</label>
                                  <input placeholder="Search Name..." value={advFilters.supplierName} onChange={e => setAdvFilters({...advFilters, supplierName: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 uppercase" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Service Nature</label>
                                  <input placeholder="e.g. Raw Material..." value={advFilters.serviceNature} onChange={e => setAdvFilters({...advFilters, serviceNature: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 uppercase" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min. Eval Score</label>
                                  <input type="number" placeholder="0 - 100" value={advFilters.minEvalScore} onChange={e => setAdvFilters({...advFilters, minEvalScore: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400" />
                              </div>
                          </div>
                      )}

                      {activeFilterTab === 'props' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              <MultiSelectDropdown label="Supplier Status" options={['Active', 'Inactive']} selected={advFilters.supplierStatus} onChange={v => setAdvFilters({...advFilters, supplierStatus: v})} />
                              <MultiSelectDropdown label="License Status" options={['Valid', 'Expired', 'Expiry Soon', 'Not Added']} selected={advFilters.licenseStatus} onChange={v => setAdvFilters({...advFilters, licenseStatus: v})} />
                              <MultiSelectDropdown label="Contract Type" options={CONTRACT_TYPE_OPTIONS} selected={advFilters.contractType} onChange={v => setAdvFilters({...advFilters, contractType: v})} />
                              <MultiSelectDropdown label="Contract Status" options={['Valid', 'Expired', 'Expiry Soon', 'Not Added']} selected={advFilters.contractStatus} onChange={v => setAdvFilters({...advFilters, contractStatus: v})} />
                              <MultiSelectDropdown label="Audit Frequency" options={AUDIT_FREQUENCY_OPTIONS} selected={advFilters.auditFreq} onChange={v => setAdvFilters({...advFilters, auditFreq: v})} />
                              <MultiSelectDropdown label="Audit Status" options={['Completed', 'Pending']} selected={advFilters.auditStatus} onChange={v => setAdvFilters({...advFilters, auditStatus: v})} />
                              <MultiSelectDropdown label="Eval Status" options={['Done', 'Not Done']} selected={advFilters.evalStatus} onChange={v => setAdvFilters({...advFilters, evalStatus: v})} />
                          </div>
                      )}

                      {activeFilterTab === 'dates' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Contract Start From</label><input type="date" value={advFilters.contractStartFrom} onChange={e => setAdvFilters({...advFilters, contractStartFrom: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Contract Start To</label><input type="date" value={advFilters.contractStartTo} onChange={e => setAdvFilters({...advFilters, contractStartTo: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Contract End From</label><input type="date" value={advFilters.contractEndFrom} onChange={e => setAdvFilters({...advFilters, contractEndFrom: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Contract End To</label><input type="date" value={advFilters.contractEndTo} onChange={e => setAdvFilters({...advFilters, contractEndTo: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">License Expiry From</label><input type="date" value={advFilters.licenseEndFrom} onChange={e => setAdvFilters({...advFilters, licenseEndFrom: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">License Expiry To</label><input type="date" value={advFilters.licenseEndTo} onChange={e => setAdvFilters({...advFilters, licenseEndTo: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Last Audit From</label><input type="date" value={advFilters.auditDateFrom} onChange={e => setAdvFilters({...advFilters, auditDateFrom: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Last Audit To</label><input type="date" value={advFilters.auditDateTo} onChange={e => setAdvFilters({...advFilters, auditDateTo: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold" /></div>
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 shrink-0">
                      <button onClick={() => setAdvFilters(INITIAL_FILTERS)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-all">Clear All</button>
                      <button onClick={() => setIsFilterModalOpen(false)} className="px-12 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Apply Filters</button>
                  </div>
              </div>
          </div>
      )}

      {/* ... (Keep existing Modals: Document, History, Edit, Bulk) ... */}
      
      {/* Schedule Audit Modal - REDESIGNED */}
      {isScheduleModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
             <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-[85vh] p-0 border border-slate-200 animate-in zoom-in-95 overflow-hidden flex flex-col">
                  {/* Modal Header */}
                  <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                       <div className="flex items-center gap-5">
                           <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><CalendarClock size={32}/></div>
                           <div>
                               <h3 className="text-2xl font-black uppercase tracking-tight">Vendor Audit Planner</h3>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure & Sync Audit Protocols</p>
                           </div>
                       </div>
                       <button onClick={() => setIsScheduleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                  </div>

                  <div className="flex flex-1 overflow-hidden">
                      {/* Left: Rule Definition */}
                      <div className="w-[350px] bg-slate-50 border-r border-slate-200 p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                           <div>
                               <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-4"><Settings2 size={14} className="text-indigo-500" /> Rule Definition</h4>
                               <div className="space-y-4">
                                   <div className="space-y-2">
                                        <MultiSelectDropdown 
                                            label="Vendor Category" 
                                            options={CONTRACT_TYPE_OPTIONS} 
                                            selected={currentRule.categories} 
                                            onChange={val => setCurrentRule({...currentRule, categories: val})}
                                            placeholder="Select Categories..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <MultiSelectDropdown 
                                            label="Risk Level" 
                                            options={RISK_LEVELS} 
                                            selected={currentRule.risks} 
                                            onChange={val => setCurrentRule({...currentRule, risks: val})}
                                            placeholder="Select Risks..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Audit Frequency</label>
                                        <select 
                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-400 outline-none shadow-sm cursor-pointer"
                                            value={currentRule.frequency}
                                            onChange={e => setCurrentRule({...currentRule, frequency: e.target.value})}
                                        >
                                            {AUDIT_FREQUENCY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                               </div>
                               
                               <button 
                                  onClick={handleAddAuditRule}
                                  className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                               >
                                  {editingRuleId ? <Edit size={16} /> : <PlusCircle size={16} />} 
                                  {editingRuleId ? 'Update Rule' : 'Save Rule to Plan'}
                               </button>
                           </div>
                           
                           <div className="p-5 bg-blue-100/50 border border-blue-200 rounded-2xl flex items-start gap-3">
                                <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Logic Guide</p>
                                    <p className="text-[10px] text-blue-700 leading-relaxed">
                                        Rules are applied in order. Define specific high-risk rules first. Empty criteria act as wildcards.
                                    </p>
                                </div>
                           </div>
                      </div>

                      {/* Right: Active Plan & Impact */}
                      <div className="flex-1 flex flex-col bg-white overflow-hidden">
                           <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                               <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                   <List className="text-indigo-500" size={14} /> Active Protocol Stack
                               </h4>
                               <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-slate-200">
                                   {auditRules.length} Rules Configured
                               </span>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-4 bg-slate-50/30">
                                {auditRules.length > 0 ? (
                                    auditRules.map((rule, idx) => (
                                        <div key={rule.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-300 transition-all">
                                            <div className="flex items-center gap-6">
                                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-xs">{idx + 1}</div>
                                                <div className="grid grid-cols-3 gap-8">
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rule.categories.length > 0 ? rule.categories.map(c => (
                                                                <span key={c} className="text-[9px] font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{c}</span>
                                                            )) : <span className="text-[9px] font-bold text-slate-400 italic">All Categories</span>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Profile</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {rule.risks.length > 0 ? rule.risks.map(r => (
                                                                <span key={r} className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${getRiskStyles(r)}`}>
                                                                    {r}
                                                                </span>
                                                            )) : <span className="text-[9px] font-bold text-slate-400 italic">All Risks</span>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Frequency</p>
                                                        <p className={`text-xs font-black uppercase ${rule.frequency === 'NA' ? 'text-slate-400' : 'text-indigo-600'}`}>{rule.frequency}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleEditRule(rule)}
                                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Edit Rule"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleRemoveAuditRule(rule.id)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Remove Rule"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                        <ClipboardList size={48} className="mb-4" />
                                        <p className="text-xs font-black uppercase tracking-widest">No rules defined yet</p>
                                    </div>
                                )}
                           </div>

                           {/* Footer Actions */}
                           <div className="p-8 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Target size={16}/></div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Impact Analysis</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            {impactedSuppliersCount} Suppliers in Scope
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsScheduleModalOpen(false)} className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all rounded-xl border border-slate-200">Cancel</button>
                                    <button 
                                        onClick={handleSyncAuditSchedule}
                                        disabled={auditRules.length === 0}
                                        className={`px-12 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center gap-3 active:scale-95 ${auditRules.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black'}`}
                                    >
                                        <RefreshCw size={18} /> Sync Audit Schedule
                                    </button>
                                </div>
                           </div>
                      </div>
                  </div>
             </div>
          </div>
      )}

      {/* Doc Manager & History Modal Shells (Consolidated Styling) */}
      {(activeDocManagerSupplier || activeHistoryType || isRegisterModalOpen || isBulkImportModalOpen || isEditModalOpen || documentModal) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className={`bg-white rounded-[3rem] shadow-2xl w-full ${isBulkImportModalOpen ? 'max-w-[1400px] h-[85vh]' : 'max-w-xl'} p-10 border border-slate-200 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]`}>
              
              {/* Document Modal Specific */}
              {documentModal ? (
                 <div className="flex flex-col h-full">
                     <div className="flex justify-between items-center mb-6">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><FileText size={24}/></div>
                             <div>
                                 <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">
                                     {documentModal.mode === 'renew' ? 'Renew' : 'Upload'} {documentModal.type === 'license' ? 'License' : 'Contract'}
                                 </h3>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Digital Record Update</p>
                             </div>
                         </div>
                         <button onClick={() => setDocumentModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                     </div>
                     <form onSubmit={handleDocumentSubmit} className="space-y-6">
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{documentModal.type === 'license' ? 'License Number' : 'Contract ID'}</label>
                             <input name="documentNumber" defaultValue={documentModal.currentNumber} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-400 shadow-inner" />
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                             <input type="date" name="startDate" required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-400 shadow-inner" />
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Expiry Date</label>
                             <input type="date" name="expiryDate" defaultValue={documentModal.currentDate} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-400 shadow-inner" />
                         </div>
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document File</label>
                             <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-white transition-colors cursor-pointer group">
                                 <Upload size={32} className="text-slate-300 group-hover:text-indigo-400 mb-2 transition-colors" />
                                 <span className="text-xs font-bold text-slate-400 uppercase">Click to Upload PDF/Image</span>
                                 <input type="file" name="file" className="hidden" />
                             </div>
                         </div>
                         <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95">Confirm Update</button>
                     </form>
                 </div>
              ) : 
              
              /* History Modal */
              activeHistoryType ? (
                  <HistoryModal 
                      isOpen={!!activeHistoryType} 
                      onClose={() => setActiveHistoryType(null)} 
                      title={activeHistoryTitle} 
                      data={activeHistoryData} 
                      type={activeHistoryType} 
                  />
              ) : 
              
              /* Edit Modal */
              isEditModalOpen && editingSupplier ? (
                  <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                                <Edit size={24} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                                Edit Partner Profile
                            </h3>
                        </div>
                        <button onClick={() => setIsEditModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-all"><X size={20}/></button>
                      </div>
                      
                      <form onSubmit={handleSaveEdit} className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Name</label>
                                <input 
                                    required
                                    value={editingSupplier.name} 
                                    onChange={e => setEditingSupplier({...editingSupplier, name: e.target.value.toUpperCase()})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-400 shadow-inner uppercase" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                <input 
                                    value={editingSupplier.email} 
                                    onChange={e => setEditingSupplier({...editingSupplier, email: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                                <input 
                                    value={editingSupplier.phone} 
                                    onChange={e => setEditingSupplier({...editingSupplier, phone: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                                <input 
                                    value={editingSupplier.address} 
                                    onChange={e => setEditingSupplier({...editingSupplier, address: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FSSAI License</label>
                                <input 
                                    value={editingSupplier.fssai} 
                                    onChange={e => setEditingSupplier({...editingSupplier, fssai: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner uppercase" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vendor Nature</label>
                                <select 
                                    value={editingSupplier.serviceNature} 
                                    onChange={e => setEditingSupplier({...editingSupplier, serviceNature: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner uppercase cursor-pointer" 
                                >
                                    {SERVICE_NATURE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Risk Level</label>
                                <select 
                                    value={editingSupplier.risk} 
                                    onChange={e => setEditingSupplier({...editingSupplier, risk: e.target.value as any})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner uppercase cursor-pointer" 
                                >
                                    {RISK_LEVELS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contract Type</label>
                                <select 
                                    value={editingSupplier.type} 
                                    onChange={e => setEditingSupplier({...editingSupplier, type: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-indigo-400 shadow-inner uppercase cursor-pointer" 
                                >
                                    {CONTRACT_TYPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                            <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                            <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Save Changes</button>
                        </div>
                      </form>
                  </div>
              ) : (
                  <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                              {activeDocManagerSupplier ? <FileUp size={24} /> : isBulkImportModalOpen ? <Truck size={24} /> : <PlusCircle size={24} />}
                          </div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                              {activeDocManagerSupplier ? 'Artifact Management' : isBulkImportModalOpen ? 'Bulk Registry Import' : 'Register New Partner'}
                          </h3>
                      </div>
                      <button onClick={() => { setActiveDocManagerSupplier(null); setIsRegisterModalOpen(false); setIsBulkImportModalOpen(false); }} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-all"><X size={20}/></button>
                  </div>
              )}

              {isBulkImportModalOpen ? (
                <BulkSupplierUploadModal 
                  currentScope={currentScope} 
                  userRootId={userRootId} 
                  onClose={() => setIsBulkImportModalOpen(false)} 
                  onSave={handleBulkOnboardCommit} 
                  existingSuppliers={suppliers}
                />
              ) : isRegisterModalOpen ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Identity</label>
                        <input id="new-v-name" placeholder="ENTER LEGAL NAME..." className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-black focus:outline-none focus:border-indigo-400 shadow-inner uppercase tracking-wider transition-all" />
                    </div>
                    <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-start gap-4">
                        <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-700 font-bold uppercase leading-relaxed tracking-wide">Initializing new partner node into the active unit ecosystem. All compliance data will be synced with the central repository.</p>
                    </div>
                    <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100">
                      <button onClick={() => { setIsRegisterModalOpen(false); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                      <button 
                        onClick={() => {
                            const name = (document.getElementById('new-v-name') as HTMLInputElement).value;
                            if (!name) return;
                            const newSup: Supplier = { 
                                id: `S-${Date.now()}`, 
                                name: name.toUpperCase(), 
                                risk: 'Low', 
                                serviceNature: 'Raw Ingredients', 
                                type: 'No Contract', 
                                status: 'Active', 
                                unitId: userRootId || undefined, 
                                uploadedBy: 'Administrator', 
                                email: '', phone: '', address: '', fssai: '', fssaiStatus: 'N/A',
                                updatedOn: new Date().toISOString().split('T')[0],
                                accepted: true, contractNo: 'N/A', startDate: 'N/A', endDate: 'N/A',
                                uploadStatus: 'Manual', totalItems: 0, auditScore: 0, auditMax: 100,
                                auditFreq: 'Annually', lastAudit: 'N/A', ncClosed: 0, ncOpen: 0,
                                evalScore: 0, evalTarget: 85, evalFreq: 'Annually', lastEval: 'N/A',
                                complaints: 0, lastComplaint: 'N/A', locationPath: 'Global > New Partner',
                                licenseHistory: [], contractHistory: [], auditHistory: [], evalHistory: []
                            };
                            onAddSupplier(newSup);
                            setIsRegisterModalOpen(false);
                        }} 
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <CheckCheck size={18} /> Finalize Registry
                      </button>
                    </div>
                </div>
              ) : !isEditModalOpen && !activeHistoryType && !documentModal && !isScheduleModalOpen && (
                <div className="flex flex-col flex-1">
                  <div className="py-10 text-center text-slate-300 bg-slate-50 rounded-3xl border border-dashed border-slate-200 mb-8">
                      <Database size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">Interface placeholder for {activeDocManagerSupplier?.name || 'Artifacts'}</p>
                  </div>
                  <div className="flex gap-4 mt-auto pt-6 border-t border-slate-100">
                    <button onClick={() => { setActiveDocManagerSupplier(null); }} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl transition-all">Dismiss</button>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}
      </>}
    </div>
  );
};

const Database = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
);

export default SupplierDetails;