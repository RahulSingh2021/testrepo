
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Users,
  UserCog,
  Layers,
  Upload,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Filter,
  Trash2,
  History,
  Info,
  Calendar,
  IdCard,
  Mail,
  Phone,
  Utensils,
  X,
  Check,
  Search,
  ChevronDown,
  Cake,
  Clock,
  FileDown,
  ShieldAlert,
  Shield,
  Briefcase,
  Ban,
  Power,
  ArrowRightLeft,
  UserMinus,
  Building2,
  ShieldCheck,
  Merge,
  GitMerge,
  CheckCheck,
  Anchor,
  MoreVertical,
  ChevronUp,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight,
  ChevronsRight,
  ArrowDownToLine,
  UserPlus,
  User,
  Warehouse,
  MapPin
} from "lucide-react";
import { Entity, HierarchyScope } from "../types";
import { MOCK_ENTITIES } from "../constants";
import UnifiedPagination from "./UnifiedPagination";

// --- Utility: Tailwind Class Merger ---
function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

// --- Utility: Date Formatter ---
const formatDateTime = (date: Date | string) => {
  if (!date) return "N/A";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid Date";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return "Invalid Date";
  }
};

const formatDateOnly = (date: Date | string) => {
    if (!date) return "";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split('T')[0];
    } catch (e) {
      return "";
    }
};

// --- Utility: Jaro-Winkler Fuzzy Matching ---
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.length === 0 || str2.length === 0) return 0;
  if (str1 === str2) return 1;
  let m = 0;
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
  if (jaro > 0.7) {
    let l = 0;
    while (str1[l] === str2[l] && l < 4) l++;
    jaro = jaro + l * 0.1 * (1 - jaro);
  }
  return jaro;
}

// --- Types ---
type AccessLevel = 'Unit Admin' | 'Dept Head' | 'Staff';

type Employee = {
  id: string;
  Corporate: string;
  Regional: string;
  Unit: string;
  Name: string;
  ID: string;
  Gender: string;
  JoinedDate: string;
  BirthDate: string;
  Email: string;
  Phone: string;
  Department: string;
  Role: string;
  Category: string;
  FoodHandler: string;
  Status: "Active" | "Inactive";
  accessLevel: AccessLevel;
  inactiveComment?: string;
  lastUpdated: string;
  history: Array<{ date: string; action: string; details: string }>;
  similarity?: number;
  matchedWith?: { name: string; id: string; department: string };
};

// --- Constants ---
const PREDEFINED_OPTIONS: Record<string, string[]> = {
  Corporate: ["Acme Catering Group", "Global Tech Inc.", "Quantum Solutions"],
  Regional: ["North America Division", "EMEA", "APAC"],
  Unit: ["NYC Central Kitchen", "Main Branch", "Innovation Hub", "Support Center"],
  Department: ["Main Kitchen", "Housekeeping", "Engineering", "Front Office", "F&B Service", "Security", "Finance", "Human Resources", "Marketing", "IT Support", "Logistics", "Not Identified"],
  Category: ["Staff", "Management", "Trainee", "Contractor", "Intern", "Not Identified"],
  FoodHandler: ["Yes", "No", "Not Identified"],
  Role: ["Top Management", "Food Safety Team Leader", "Food Safety Team", "Food Safety Coordinator", "Developer", "Designer", "Analyst", "Manager", "Security", "Chef", "Sous Chef", "Steward", "Housekeeper", "Driver", "Not Identified"],
  Gender: ["Male", "Female", "Other", "Not Identified"],
};

const TAB_CATEGORIES = {
  permanent: ["Staff", "Management"],
  temporary: ["Trainee", "Contractor", "Intern"],
};

const INITIAL_FILTERS = {
    search: "",
    corporate: "",
    regional: "",
    unit: "",
    gender: [] as string[],
    role: [] as string[],
    department: [] as string[],
    category: [] as string[],
    foodHandler: [] as string[],
    status: [] as string[],
    dojFrom: "",
    dojTo: "",
    selectedIds: [] as string[],
};

// Helper to generate random date
const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
};

const generateMockData = (): Employee[] => {
  const names = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
    "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
    "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Margaret", "Anthony", "Betty", "Donald", "Sandra",
    "Mark", "Ashley", "Paul", "Dorothy", "Steven", "Kimberly", "Andrew", "Emily", "Kenneth", "Donna",
    "Joshua", "Michelle", "George", "Carol", "Kevin", "Amanda", "Brian", "Melissa", "Edward", "Deborah"
  ];
  const surnames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
    "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green"
  ];

  return Array.from({ length: 120 }).map((_, i) => {
    const corp = PREDEFINED_OPTIONS.Corporate[i % 3];
    const reg = PREDEFINED_OPTIONS.Regional[i % 3];
    const unit = PREDEFINED_OPTIONS.Unit[i % 4];
    const dept = PREDEFINED_OPTIONS.Department[i % PREDEFINED_OPTIONS.Department.length];
    const role = PREDEFINED_OPTIONS.Role[i % PREDEFINED_OPTIONS.Role.length];
    const cat = PREDEFINED_OPTIONS.Category[i % PREDEFINED_OPTIONS.Category.length];
    const gender = i % 4 === 0 ? "Female" : "Male";
    const name = `${names[i % names.length]} ${surnames[i % surnames.length]}`;
    
    let access: AccessLevel = 'Staff';
    if (role === 'Top Management' || role === 'Manager' || role === 'Food Safety Team Leader') {
       access = Math.random() > 0.5 ? 'Unit Admin' : 'Dept Head';
    }

    return {
      id: `EMP${1000 + i}`,
      Corporate: corp,
      Regional: reg,
      Unit: unit,
      Name: name,
      ID: `EMP${1000 + i}`,
      Gender: gender,
      JoinedDate: randomDate(new Date(2020, 0, 1), new Date()),
      BirthDate: randomDate(new Date(1980, 0, 1), new Date(2000, 0, 1)),
      Email: `${name.toLowerCase().replace(' ', '.')}@${corp.split(' ')[0].toLowerCase()}.com`,
      Phone: `555-01${String(i).padStart(2, '0')}`,
      Department: dept,
      Role: role,
      Category: cat,
      FoodHandler: ["Chef", "Sous Chef", "Steward", "Food Safety Team"].includes(role) ? "Yes" : "No",
      Status: Math.random() > 0.1 ? "Active" : "Inactive",
      accessLevel: access,
      lastUpdated: new Date().toISOString(),
      history: [{ date: new Date().toISOString(), action: "System Import", details: "Initial Migration" }],
    };
  });
};

const INITIAL_DATA: Employee[] = generateMockData();

// --- Sub-Components ---

interface BadgeProps { label: string, onRemove: () => void }
const Badge: React.FC<BadgeProps> = ({ label, onRemove }) => (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">{label}<button onClick={onRemove} className="hover:text-red-500 ml-1 font-bold">×</button></span>
);

const FilterTags = ({ filters, setFilters }: { filters: any, setFilters: any }) => {
    if (!filters) return null;
    const hasFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v);
    if (!hasFilters) return null;
    
    const removeFilter = (key: string, value?: string) => {
        if (value && Array.isArray(filters[key])) {
            setFilters((prev: any) => ({ ...prev, [key]: prev[key].filter((v: string) => v !== value) }));
        } else {
            setFilters((prev: any) => ({ ...prev, [key]: Array.isArray(prev[key]) ? [] : "" }));
        }
    };
    
    return (
        <div className="flex flex-wrap gap-2 px-6">
            {filters.corporate && <Badge label={`Corp: ${filters.corporate}`} onRemove={() => setFilters((p:any) => ({...p, corporate: ''}))} />}
            {filters.regional && <Badge label={`Reg: ${filters.regional}`} onRemove={() => setFilters((p:any) => ({...p, regional: ''}))} />}
            {filters.unit && <Badge label={`Unit: ${filters.unit}`} onRemove={() => setFilters((p:any) => ({...p, unit: ''}))} />}
            {(filters.role || []).map((r: string) => <Badge key={r} label={`Role: ${r}`} onRemove={() => removeFilter("role", r)} />)}
            {(filters.category || []).map((c: string) => <Badge key={c} label={`Cat: ${c}`} onRemove={() => removeFilter("category", c)} />)}
            {(filters.department || []).map((d: string) => <Badge key={d} label={`Dept: ${d}`} onRemove={() => removeFilter("department", d)} />)}
            {(filters.gender || []).map((g: string) => <Badge key={g} label={`Gender: ${g}`} onRemove={() => removeFilter("gender", g)} />)}
            {(filters.foodHandler || []).map((f: string) => <Badge key={f} label={`Food Handler: ${f}`} onRemove={() => removeFilter("foodHandler", f)} />)}
            {(filters.status || []).map((s: string) => <Badge key={s} label={`Status: ${s}`} onRemove={() => removeFilter("status", s)} />)}
            {filters.search && <Badge label={`Search: ${filters.search}`} onRemove={() => removeFilter("search")} />}
             <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-xs text-indigo-600 hover:underline">Clear All</button>
        </div>
    );
};

const SimpleFilterCheckbox = ({ options = [], selected = [], onChange, title }: { options: string[], selected: string[], onChange: (v: string[]) => void, title: string }) => {
    return (
        <div className="hidden group-hover:block absolute top-full left-0 z-20 w-56 bg-white shadow-xl border border-gray-200 rounded-lg p-3 mt-1">
             <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</h4>
             <div className="max-h-48 overflow-y-auto space-y-1">
                 {options.map(opt => (
                     <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 p-1 rounded cursor-pointer">
                         <input type="checkbox" checked={selected.includes(opt)} onChange={(e) => { if(e.target.checked) onChange([...selected, opt]); else onChange(selected.filter(s => s !== opt)); }} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                         {opt}
                     </label>
                 ))}
             </div>
        </div>
    );
};

const EditableCell = ({ field, value, type = "text", options, onUpdate, id, canEdit }: { field: string, value: string, type?: string, options?: string[], onUpdate: (id: string, f: string, v: string) => void, id: string, canEdit: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value || "");
    const inputRef = useRef<any>(null);
    
    useEffect(() => {
        setTempValue(value || "");
    }, [value]);

    useEffect(() => { if(isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);
    
    const save = () => { setIsEditing(false); if(tempValue !== value) onUpdate(id, field, tempValue); };
    
    if (isEditing && canEdit) {
        if (options) return <select ref={inputRef} value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={save} className="w-full text-xs p-1 border border-indigo-500 rounded bg-indigo-50">{options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
        return <input ref={inputRef} type={type} value={tempValue} onChange={e => setTempValue(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && save()} className="w-full text-xs p-1 border border-indigo-500 rounded bg-indigo-50"/>;
    }
    return <span onDoubleClick={() => canEdit && setIsEditing(true)} className={cn("rounded px-1 -ml-1 transition-colors truncate block max-w-full", !value && "text-red-300 bg-red-50 text-[10px]", canEdit && "cursor-pointer hover:bg-gray-100")} title={value || "Missing"}>{value || "Missing"}</span>;
};

// --- Bulk Sink Modal ---
const BulkSinkModal = ({ onClose, onExecute, selectedItems, allItems }: { onClose: () => void, onExecute: (targetId: string | null, newName?: string) => void, selectedItems: Employee[], allItems: Employee[] }) => {
    const [mode, setMode] = useState<'existing' | 'new'>('existing');
    const [targetId, setTargetId] = useState<string>("");
    const [newName, setNewName] = useState("");
    const [search, setSearch] = useState("");

    const targetCandidates = useMemo(() => {
        // Restricted to ONLY the selected items as per user request
        return selectedItems.filter(item => item.Name.toLowerCase().includes(search.toLowerCase()));
    }, [selectedItems, search]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300 h-[85vh]">
                <div className="px-10 py-8 bg-blue-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                    <div className="flex items-center gap-4">
                        <Merge size={32} />
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight leading-none">Employee Identity Sinking</h3>
                            <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-2">Merging {selectedItems.length} records into Master Profile</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={28} strokeWidth={3} /></button>
                </div>
                
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Current Selection Summary */}
                    <div className="w-[350px] bg-slate-50 border-r border-slate-200 p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Source Identities</h4>
                        <div className="space-y-3">
                            {selectedItems.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0 shadow-inner">
                                        <User size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{item.Name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">ID: {item.ID}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Master Selection / New Profile Creation */}
                    <div className="flex-1 flex flex-col p-10 space-y-10 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Consolidation Strategy</h4>
                            <div className="flex bg-slate-100 p-1.5 rounded-[2rem] border border-slate-200 shadow-inner">
                                <button onClick={() => setMode('existing')} className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'existing' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Merge Under Selected Name</button>
                                <button onClick={() => setMode('new')} className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${mode === 'new' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>New Consolidated Name</button>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            {mode === 'existing' ? (
                                <div className="space-y-6">
                                    {/* Source Summary Pills */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Choose the anchor from selection:</span>
                                            <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">{selectedItems.length} available</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedItems.map(item => (
                                                <div key={item.id} className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${targetId === item.id ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 shadow-sm'}`} onClick={() => setTargetId(item.id)}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${targetId === item.id ? 'bg-white shadow-[0_0_5px_white]' : 'bg-blue-500'}`} />
                                                    <span className="text-[10px] font-black uppercase tracking-tight">{item.Name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative group">
                                        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" />
                                        <input 
                                            placeholder="Search within selection..." 
                                            className="w-full pl-14 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-black focus:outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner uppercase"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {targetCandidates.map(item => (
                                            <button 
                                                key={item.id} 
                                                onClick={() => setTargetId(item.id)} 
                                                className={`w-full text-left p-5 rounded-3xl border-2 transition-all flex items-center justify-between group ${targetId === item.id ? 'bg-blue-50 border-blue-600 shadow-lg ring-4 ring-blue-50' : 'bg-white border-slate-100 hover:border-blue-200'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-2xl ${targetId === item.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'} transition-all`}>
                                                        <User size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1.5">{item.Name}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.ID} • {item.Unit}</p>
                                                    </div>
                                                </div>
                                                {targetId === item.id && <Check size={24} className="text-blue-600" strokeWidth={4} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in slide-in-from-top-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Identity Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="ENTER MASTER NAME..." 
                                        className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-xl font-black focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner uppercase"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                    />
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest px-2 italic">A fresh profile will be created. All selected nodes will be remapped and history will be sunk into this identity.</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 space-y-4 shrink-0">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2"><Anchor size={12}/> Synchronization Logic</h5>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                - Concatenates full audit trail from all sources.<br/>
                                - Retains primary metadata from target record.<br/>
                                - Archives redundant IDs.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-4 shrink-0">
                    <button onClick={onClose} className="px-10 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Discard</button>
                    <button 
                        disabled={mode === 'existing' ? !targetId : !newName.trim()}
                        onClick={() => onExecute(mode === 'existing' ? targetId : null, mode === 'new' ? newName : undefined)}
                        className="px-16 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center gap-3 disabled:opacity-30 disabled:grayscale"
                    >
                        <CheckCheck size={22} strokeWidth={3} /> Finalize Sync
                    </button>
                </div>
            </div>
        </div>
    );
};

interface EmployeeRowProps {
  employee: Employee;
  onUpdate: (id: string, field: string, val: string) => void;
  onStatusToggle: () => void;
  onViewHistory: () => void;
  onDelete: () => void;
  canManage: boolean;
  isSelected: boolean;
  onSelectToggle: () => void;
  categoryOptions?: string[];
  departmentOptions?: string[];
  roleOptions?: string[];
}

const EmployeeRow: React.FC<EmployeeRowProps> = ({ employee, onUpdate, onStatusToggle, onViewHistory, onDelete, canManage, isSelected, onSelectToggle, categoryOptions, departmentOptions, roleOptions }) => {
    const nameStr = (employee.Name || "Unknown").toString();
    const initials = nameStr.trim().length > 0 ? nameStr.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "U";

    return (
        <tr className={cn("group hover:bg-gray-50/50 transition-colors border-b border-gray-200 last:border-0", employee.Status === 'Inactive' && "opacity-60 bg-gray-50", isSelected && "bg-indigo-50/30")}>
            <td className="px-4 py-4 align-top w-12">
                {canManage && (
                    <button 
                        onClick={onSelectToggle}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 hover:border-indigo-400'}`}
                    >
                        {isSelected && <Check size={12} strokeWidth={4} />}
                    </button>
                )}
            </td>

            <td className="px-4 py-4 align-top w-48">
                <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-gray-900 text-sm">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Corporate" value={employee.Corporate} options={PREDEFINED_OPTIONS.Corporate} />
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Regional" value={employee.Regional} options={PREDEFINED_OPTIONS.Regional} />
                    </div>
                    <div className="text-xs text-gray-400">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Unit" value={employee.Unit} options={PREDEFINED_OPTIONS.Unit} />
                    </div>
                </div>
            </td>

            <td className="px-4 py-4 align-top min-w-[300px]">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 border-2 border-white shadow-sm">
                        {initials}
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                        <div className="font-bold text-gray-900 text-sm">
                            <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Name" value={employee.Name} />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                            <div className="flex items-center gap-1" title="Employee ID">
                                <IdCard className="w-3.5 h-3.5 text-gray-400" />
                                <span className="font-medium text-gray-700 tracking-tight">ID: {employee.ID}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Gender">
                                <UserCog className="w-3.5 h-3.5 text-gray-400" />
                                <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Gender" value={employee.Gender} options={PREDEFINED_OPTIONS.Gender} />
                            </div>
                            <div className="flex items-center gap-1" title="Joined Date">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <span className="flex items-center gap-1">Joined: <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="JoinedDate" value={formatDateOnly(employee.JoinedDate)} type="date" /></span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                           <Cake className="w-3.5 h-3.5 text-gray-400" />
                           <span className="flex items-center gap-1">Born: <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="BirthDate" value={formatDateOnly(employee.BirthDate)} type="date" /></span>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                           <History className="w-3 h-3" />
                           <span>Updated: {formatDateTime(employee.lastUpdated)}</span>
                        </div>
                    </div>
                </div>
            </td>

            <td className="px-4 py-4 align-top w-56">
                <div className="flex flex-col gap-1.5 pt-1">
                   <div className="flex items-center gap-2 text-xs text-gray-600 group/contact">
                      <Mail className="w-3.5 h-3.5 text-gray-400 group-hover/contact:text-indigo-500 transition-colors" />
                      <div className="truncate max-w-[180px]" title={employee.Email}>
                         <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Email" value={employee.Email} />
                      </div>
                   </div>
                   <div className="flex items-center gap-2 text-xs text-gray-600 group/contact">
                      <Phone className="w-3.5 h-3.5 text-gray-400 group-hover/contact:text-indigo-500 transition-colors" />
                      <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Phone" value={employee.Phone} />
                   </div>
                </div>
            </td>

            <td className="px-4 py-4 align-top w-48">
                 <div className="flex flex-col gap-0.5">
                    <div className="font-bold text-gray-900 text-sm">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Department" value={employee.Department} options={departmentOptions && departmentOptions.length > 0 ? departmentOptions : PREDEFINED_OPTIONS.Department} />
                    </div>
                    <div className="text-xs text-gray-600 font-medium">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Role" value={employee.Role} options={roleOptions && roleOptions.length > 0 ? roleOptions : PREDEFINED_OPTIONS.Role} />
                    </div>
                    <div className="mt-2">
                        {canManage ? (
                            <select 
                                value={employee.accessLevel}
                                onChange={(e) => onUpdate(employee.id, 'accessLevel', e.target.value)}
                                className={cn(
                                    "text-[10px] font-bold rounded border px-1.5 py-0.5 uppercase tracking-wide outline-none cursor-pointer hover:opacity-80 transition-all w-full",
                                    employee.accessLevel === 'Unit Admin' ? "bg-purple-100 text-purple-700 border-purple-200" :
                                    employee.accessLevel === 'Dept Head' ? "bg-blue-100 text-blue-700 border-blue-200" :
                                    "bg-slate-100 text-slate-700 border-slate-200"
                                )}
                            >
                                <option value="Staff">User Access</option>
                                <option value="Dept Head">Department Control</option>
                                <option value="Unit Admin">Unit Control</option>
                            </select>
                        ) : (
                            <>
                                {employee.accessLevel === 'Unit Admin' && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                        <ShieldAlert className="w-3 h-3" /> Unit Control
                                    </span>
                                )}
                                {employee.accessLevel === 'Dept Head' && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                        <Shield className="w-3 h-3" /> Dept Control
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                 </div>
            </td>

            <td className="px-4 py-4 align-top w-32">
                 <div className="flex flex-col gap-1">
                    <div className="font-bold text-gray-900 text-sm">
                        <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Category" value={employee.Category} options={categoryOptions && categoryOptions.length > 0 ? categoryOptions : PREDEFINED_OPTIONS.Category} />
                    </div>
                    <div className="text-[11px] text-gray-500 whitespace-nowrap">
                       Food Handler: <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="FoodHandler" value={employee.FoodHandler} options={PREDEFINED_OPTIONS.FoodHandler} />
                    </div>
                 </div>
            </td>

            <td className="px-4 py-4 align-middle text-right">
                 <div className="flex items-center justify-end gap-3">
                    {canManage ? (
                        <>
                            <button onClick={onStatusToggle} className={cn("relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none", employee.Status === 'Active' ? 'bg-green-500' : 'bg-gray-200')}>
                                <span className="sr-only">Use setting</span>
                                <span aria-hidden="true" className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", employee.Status === 'Active' ? 'translate-x-5' : 'translate-x-0')} />
                            </button>
                            <button onClick={onViewHistory} className="text-gray-400 hover:text-gray-600 transition-colors"><History className="w-5 h-5" /></button>
                            <button onClick={onDelete} className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                        </>
                    ) : (
                        <span className="text-[10px] text-slate-300 italic">Read Only</span>
                    )}
                 </div>
            </td>
        </tr>
    );
};

const MobileEmployeeCard: React.FC<EmployeeRowProps> = ({ employee, onUpdate, onStatusToggle, onViewHistory, onDelete, canManage, isSelected, onSelectToggle, categoryOptions, departmentOptions, roleOptions }) => {
    const nameStr = (employee.Name || "Unknown").toString();
    const initials = nameStr.trim().length > 0 ? nameStr.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "U";
    
    return (
        <div className={cn("bg-white p-4 rounded-xl shadow-sm border-2 flex flex-col gap-3", employee.Status === 'Inactive' && "opacity-70 bg-slate-50", isSelected ? "border-indigo-600" : "border-slate-100")}>
            <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                    {canManage && (
                        <button 
                            onClick={onSelectToggle}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 hover:border-indigo-400'}`}
                        >
                            {isSelected && <Check size={14} strokeWidth={4} />}
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                        {initials}
                    </div>
                    <div>
                        <div className="font-bold text-sm text-slate-900">
                            <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Name" value={employee.Name} />
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                            {employee.ID}
                        </div>
                    </div>
                </div>
                {canManage && (
                    <button onClick={onStatusToggle} className={cn("px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider", employee.Status === 'Active' ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500")}>
                        {employee.Status}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Role</span>
                    <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Role" value={employee.Role} options={roleOptions && roleOptions.length > 0 ? roleOptions : PREDEFINED_OPTIONS.Role} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Dept</span>
                    <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Department" value={employee.Department} options={departmentOptions && departmentOptions.length > 0 ? departmentOptions : PREDEFINED_OPTIONS.Department} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                    <Mail size={12} className="text-slate-400" />
                    <div className="truncate flex-1"><EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Email" value={employee.Email} /></div>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                    <Phone size={12} className="text-slate-400" />
                    <EditableCell canEdit={canManage} id={employee.id} onUpdate={onUpdate} field="Phone" value={employee.Phone} />
                </div>
            </div>

            {canManage && (
                <div className="flex justify-end gap-3 mt-1 pt-2 border-t border-slate-50">
                    <button onClick={onViewHistory} className="p-2 bg-slate-50 rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                        <History size={16} />
                    </button>
                    <button onClick={onDelete} className="p-2 bg-slate-50 rounded-full text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

interface ReviewRowProps {
    data: Employee;
    isMatched?: boolean;
    matchData?: { name: string; id: string; department: string };
    matchScore?: number;
    actions: React.ReactNode;
}

const ReviewRow: React.FC<ReviewRowProps> = ({ data, isMatched, matchData, matchScore, actions }) => {
    return (
        <tr className="hover:bg-gray-50/50 transition-colors text-xs text-gray-700 border-b border-gray-100 last:border-0">
            <td className="px-6 py-3 align-top">
                <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-indigo-900">{data.Corporate}</span>
                    <span className="text-gray-500">{data.Regional}</span>
                    <span className="text-gray-400">{data.Unit}</span>
                </div>
            </td>
            <td className="px-6 py-3 align-top">
                <div className="font-bold text-gray-900">{data.Name}</div>
                <div className="text-gray-500 font-mono text-[10px]">{data.ID}</div>
            </td>
            {isMatched && (
                <td className="px-6 py-3 align-top">
                    {matchData && (
                        <div className="flex flex-col bg-amber-50 p-2 rounded border border-amber-100">
                            <span className="font-bold text-amber-700 text-[9px] uppercase tracking-wider mb-1">Matched With</span>
                            <span className="font-bold text-gray-800 text-xs">{matchData.name}</span>
                            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5">
                                <span>{matchData.id}</span>
                                <span>{matchData.department}</span>
                            </div>
                        </div>
                    )}
                </td>
            )}
            <td className="px-6 py-3 align-top">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-gray-700 truncate max-w-[150px]" title={data.Email}>
                        <Mail className="w-3 h-3 text-gray-400" /> {data.Email}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                        <Phone className="w-3 h-3 text-gray-400" /> {data.Phone}
                    </div>
                </div>
            </td>
            <td className="px-6 py-3 align-top">
                <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-gray-700">{data.Department}</span>
                    <span className="text-gray-500">{data.Role}</span>
                </div>
            </td>
            <td className="px-6 py-3 align-top">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-wide">{data.Category}</span>
            </td>
            {isMatched && (
                <td className="px-6 py-3 align-top font-bold text-gray-800">
                    {matchScore ? (
                        <span className={cn("px-2 py-1 rounded text-xs", matchScore > 0.9 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                            {Math.round(matchScore * 100)}%
                        </span>
                    ) : '-'}
                </td>
            )}
            <td className="px-6 py-3 align-top text-right">
                {actions}
            </td>
        </tr>
    );
};

const NewEmployeeModal = ({ onClose, onSubmit, categoryOptions, departmentOptions, roleOptions }: { onClose: () => void, onSubmit: (data: any) => void, categoryOptions?: string[], departmentOptions?: string[], roleOptions?: string[] }) => {
    const [formData, setFormData] = useState<any>({});
    const handleChange = (k: string, v: string) => setFormData((prev: any) => ({...prev, [k]: v}));
    const catOpts = categoryOptions && categoryOptions.length > 0 ? categoryOptions : PREDEFINED_OPTIONS.Category;
    const deptOpts = departmentOptions && departmentOptions.length > 0 ? departmentOptions : PREDEFINED_OPTIONS.Department;
    const rlOpts = roleOptions && roleOptions.length > 0 ? roleOptions : PREDEFINED_OPTIONS.Role;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Add New Employee</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {["Corporate", "Regional", "Unit", "Name", "ID", "Email", "Phone"].map(field => (
                        <div key={field}><label className="block text-xs font-semibold text-gray-700 mb-1">{field}</label><input className="w-full border border-gray-300 rounded p-2 text-sm" onChange={e => handleChange(field, e.target.value)} placeholder={`Enter ${field}`}/></div>
                    ))}
                     {[ { k: "Department", opts: deptOpts }, { k: "Role", opts: rlOpts }, { k: "Category", opts: catOpts }, { k: "FoodHandler", opts: PREDEFINED_OPTIONS.FoodHandler }, { k: "Gender", opts: PREDEFINED_OPTIONS.Gender }, ].map(item => (
                        <div key={item.k}><label className="block text-xs font-semibold text-gray-700 mb-1">{item.k}</label><select className="w-full border border-gray-300 rounded p-2 text-sm" onChange={e => handleChange(item.k, e.target.value)}><option value="">Select...</option>{item.opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                     ))}
                     <div><label className="block text-xs font-semibold text-gray-700 mb-1">Joined Date</label><input type="date" className="w-full border border-gray-300 rounded p-2 text-sm" onChange={e => handleChange("JoinedDate", e.target.value)} /></div>
                     <div><label className="block text-xs font-semibold text-gray-700 mb-1">Birth Date</label><input type="date" className="w-full border border-gray-300 rounded p-2 text-sm" onChange={e => handleChange("BirthDate", e.target.value)} /></div>
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                    <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium" onClick={onClose}>Cancel</button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium" onClick={() => onSubmit(formData)}>Add Employee</button>
                </div>
            </div>
        </div>
    )
}

interface EmployeeManagementProps {
    entities?: Entity[];
    currentScope?: HierarchyScope;
    userRootId?: string | null;
}

// --- Main Component ---
export default function EmployeeManagement({ entities = MOCK_ENTITIES, currentScope = 'super-admin', userRootId }: EmployeeManagementProps) {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_DATA);
  const [view, setView] = useState<"dashboard" | "review">("dashboard");
  const [currentTab, setCurrentTab] = useState<"permanent" | "temporary" | "all">("permanent");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<string | null>(null);
  const headerDropdownRef = useRef<HTMLDivElement>(null);

  const [reviewData, setReviewData] = useState<{ matched: Employee[]; unique: Employee[]; }>({ matched: [], unique: [] });

  useEffect(() => {
    if (view === 'review' && reviewData.matched.length === 0 && reviewData.unique.length === 0) {
      setView('dashboard');
    }
  }, [reviewData, view]);

  const [activeModal, setActiveModal] = useState<"none" | "status" | "history" | "newEmployee" | "bulkSink" | "bulkDelete">("none");
  const [selectedRow, setSelectedRow] = useState<Employee | null>(null);
  const [modalInput, setModalInput] = useState(""); 
  
  const [deactivateType, setDeactivateType] = useState<'resigned' | 'transferred'>('resigned');
  const [targetUnitId, setTargetUnitId] = useState<string>('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);

  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const dbLoaded = useRef(false);
  const [dbReady, setDbReady] = useState(false);
  const userSaveQueue = useRef<Map<string, Employee>>(new Map());
  const userSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const flushUserSaves = useCallback(async () => {
    const queue = userSaveQueue.current;
    if (queue.size === 0) return;
    const batch = Array.from(queue.values());
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        batch.forEach(e => queue.delete(e.id));
      }
    } catch (err) {
      console.error('Failed to persist user updates, will retry:', err);
    }
  }, []);

  const scheduleUserSave = useCallback((items: Employee[]) => {
    items.forEach(emp => userSaveQueue.current.set(emp.id, emp));
    if (userSaveTimer.current) clearTimeout(userSaveTimer.current);
    userSaveTimer.current = setTimeout(flushUserSaves, 2000);
  }, [flushUserSaves]);

  const deleteUserFromDb = useCallback(async (id: string) => {
    try {
      await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error('Failed to delete user from DB:', err);
    }
  }, []);

  useEffect(() => {
    if (dbLoaded.current) return;
    dbLoaded.current = true;
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users');
        const json = await res.json();
        if (json.seeded && json.items?.length > 0) {
          setEmployees(json.items as Employee[]);
        } else {
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(INITIAL_DATA),
          });
        }
      } catch (err) {
        console.error('Failed to load users from DB, using fallback:', err);
      } finally {
        setDbReady(true);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => { flushUserSaves(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (userSaveTimer.current) clearTimeout(userSaveTimer.current);
      flushUserSaves();
    };
  }, [flushUserSaves]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerDropdownRef.current && !headerDropdownRef.current.contains(event.target as Node)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentUserEntity = useMemo(() => {
      if(!entities || !userRootId) return null;
      return entities.find(e => e.id === userRootId) || null;
  }, [entities, userRootId]);

  const hierarchyContext = useMemo(() => {
      const ctx: { corporate: string; regional: string; unit: string } = { corporate: '', regional: '', unit: '' };
      if (!currentUserEntity || !entities) return ctx;
      let ptr: Entity | undefined = currentUserEntity;
      while (ptr) {
        if (ptr.type === 'corporate') ctx.corporate = (ptr.name || '').trim();
        else if (ptr.type === 'regional') ctx.regional = (ptr.name || '').trim();
        else if (ptr.type === 'unit') ctx.unit = (ptr.name || '').trim();
        if (!ptr.parentId) break;
        ptr = entities.find(e => e.id === ptr!.parentId);
      }
      return ctx;
  }, [currentUserEntity, entities]);

  const inheritedCategories = useMemo(() => {
    const collect = (entId: string | undefined): { name: string; workforce: 'core' | 'extended' }[] => {
      if (!entId) return [];
      const ent = entities.find(e => e.id === entId);
      if (!ent) return [];
      const parentItems = collect(ent.parentId);
      const localItems = (ent.masterCategories || []).map(c => ({ name: c.name, workforce: c.workforce }));
      return [...parentItems, ...localItems];
    };
    const raw = currentUserEntity ? collect(currentUserEntity.id) : [];
    const seen = new Set<string>();
    return raw.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });
  }, [currentUserEntity, entities]);

  const dynamicCategoryNames = useMemo(() => {
    const base = inheritedCategories.length > 0 ? inheritedCategories.map(c => c.name) : PREDEFINED_OPTIONS.Category;
    return base.includes('Not Identified') ? base : [...base, 'Not Identified'];
  }, [inheritedCategories]);

  const coreCategoryNames = useMemo(() => inheritedCategories.filter(c => c.workforce === 'core').map(c => c.name), [inheritedCategories]);
  const extendedCategoryNames = useMemo(() => inheritedCategories.filter(c => c.workforce === 'extended').map(c => c.name), [inheritedCategories]);

  const dynamicDepartmentNames = useMemo(() => {
    const collect = (entId: string | undefined): string[] => {
      if (!entId) return [];
      const ent = entities.find(e => e.id === entId);
      if (!ent) return [];
      return [...collect(ent.parentId), ...(ent.masterDepartments || [])];
    };
    const raw = currentUserEntity ? collect(currentUserEntity.id) : [];
    const unique = [...new Set(raw)];
    const base = unique.length > 0 ? unique : PREDEFINED_OPTIONS.Department;
    return base.includes('Not Identified') ? base : [...base, 'Not Identified'];
  }, [currentUserEntity, entities]);

  const dynamicRoleNames = useMemo(() => {
    const collect = (entId: string | undefined): string[] => {
      if (!entId) return [];
      const ent = entities.find(e => e.id === entId);
      if (!ent) return [];
      return [...collect(ent.parentId), ...(ent.masterRoles || [])];
    };
    const raw = currentUserEntity ? collect(currentUserEntity.id) : [];
    const unique = [...new Set(raw)];
    const base = unique.length > 0 ? unique : PREDEFINED_OPTIONS.Role;
    return base.includes('Not Identified') ? base : [...base, 'Not Identified'];
  }, [currentUserEntity, entities]);

  const filterConstraints = useMemo(() => {
      const blocked = { corporate: null, regional: null, unit: null, department: null, user: null, blocked: false };
      
      if (currentScope === 'department' || currentScope === 'user') {
          return { ...blocked, blocked: true };
      }
      
      if (currentScope === 'super-admin') {
          if (!currentUserEntity || currentUserEntity.type === 'super-admin' || !currentUserEntity.type) {
              return { ...blocked, blocked: true };
          }
          const constraints: any = { blocked: false };
          const getAncestorName = (startEntity: any, type: string) => {
              let curr = startEntity;
              while(curr) {
                  if(curr.type === type) return curr.name?.trim() || null;
                  curr = entities?.find(e => e.id === curr.parentId) || null as any;
              }
              return null;
          };
          if (currentUserEntity.type === 'unit') {
              constraints.unit = currentUserEntity.name?.trim();
              constraints.regional = getAncestorName(currentUserEntity, 'regional');
              constraints.corporate = getAncestorName(currentUserEntity, 'corporate');
          } else if (currentUserEntity.type === 'regional') {
              constraints.regional = currentUserEntity.name?.trim();
              constraints.corporate = getAncestorName(currentUserEntity, 'corporate');
          } else if (currentUserEntity.type === 'corporate') {
              constraints.corporate = currentUserEntity.name?.trim();
          }
          return constraints;
      }
      
      if (!currentUserEntity) return { ...blocked, blocked: true };
      
      const constraints: any = { blocked: false };
      
      const getAncestor = (type: string) => {
          let curr = currentUserEntity;
          while(curr) {
              if(curr.type === type) return curr.name?.trim() || null;
              curr = entities?.find(e => e.id === curr.parentId) || null as any;
          }
          return null;
      };

      if (currentScope === 'corporate') {
          constraints.corporate = currentUserEntity.name?.trim();
      } else if (currentScope === 'regional') {
          constraints.regional = currentUserEntity.name?.trim();
          constraints.corporate = getAncestor('corporate');
      } else if (currentScope === 'unit') {
          constraints.unit = currentUserEntity.name?.trim();
          constraints.regional = getAncestor('regional');
          constraints.corporate = getAncestor('corporate');
      }
      return constraints;
  }, [currentScope, currentUserEntity, entities]);

  const scopeEmployees = useMemo(() => {
      if (!employees || filterConstraints.blocked) return [];
      let result = employees;
      if (filterConstraints.corporate) result = result.filter(e => (e.Corporate || '').trim() === filterConstraints.corporate);
      if (filterConstraints.regional) result = result.filter(e => (e.Regional || '').trim() === filterConstraints.regional);
      if (filterConstraints.unit) result = result.filter(e => (e.Unit || '').trim() === filterConstraints.unit);
      return result;
  }, [employees, filterConstraints]);

  // PEER UNIT LOGIC REFACTORED:
  // Instead of matching the 'Corporate' string (fragile), trace up from the 'Unit' identity (robust).
  const corporatePeerUnits = useMemo(() => {
      if (!selectedRow) return [];
      
      // 1. Locate the employee's current unit in the registry
      const currentUnitName = selectedRow.Unit.trim().toLowerCase();
      const unitEntity = entities.find(e => 
          e.type === 'unit' && e.name.trim().toLowerCase() === currentUnitName
      );

      // 2. Identify the true corporate root for this unit
      let corpEntity: Entity | undefined;
      let ptr = unitEntity;
      while (ptr) {
          if (ptr.type === 'corporate') {
              corpEntity = ptr;
              break;
          }
          ptr = entities.find(e => e.id === ptr?.parentId);
      }

      // 3. Fallback: If unit not found in tree, use corporate name string as a secondary search
      if (!corpEntity) {
          const rowCorp = selectedRow.Corporate?.trim().toLowerCase();
          corpEntity = entities.find(e => 
              e.type === 'corporate' && e.name.trim().toLowerCase() === rowCorp
          );
      }
      
      if (!corpEntity) return [];
      
      const corpId = corpEntity.id;

      // 4. Return all units sharing this corporate ID in their ancestry
      return entities.filter(e => {
          if (e.type !== 'unit') return false;
          // Exclude self
          if (e.name.trim().toLowerCase() === currentUnitName) return false;
          
          let current: Entity | undefined = e;
          while (current) {
              if (current.id === corpId) return true;
              current = entities.find(parent => parent.id === current?.parentId);
          }
          return false;
      });
  }, [selectedRow, entities]);

  const filteredPeerUnits = useMemo(() => {
    return corporatePeerUnits.filter(u => u.name.toLowerCase().includes(unitSearchQuery.toLowerCase()));
  }, [corporatePeerUnits, unitSearchQuery]);

  const uniqueCorporates = useMemo(() => [...new Set(scopeEmployees.map(e => (e.Corporate || '').trim()))].filter(Boolean).sort(), [scopeEmployees]);
  
  const availableRegionals = useMemo(() => {
      let filtered = scopeEmployees;
      if (filters.corporate) filtered = filtered.filter(e => (e.Corporate || '').trim() === filters.corporate);
      return [...new Set(filtered.map(e => (e.Regional || '').trim()))].filter(Boolean).sort();
  }, [scopeEmployees, filters.corporate]);

  const availableUnits = useMemo(() => {
      let filtered = scopeEmployees;
      if (filters.corporate) filtered = filtered.filter(e => (e.Corporate || '').trim() === filters.corporate);
      if (filters.regional) filtered = filtered.filter(e => (e.Regional || '').trim() === filters.regional);
      return [...new Set(filtered.map(e => (e.Unit || '').trim()))].filter(Boolean).sort();
  }, [scopeEmployees, filters.corporate, filters.regional]);

  const canManage = ['super-admin', 'corporate', 'regional', 'unit'].includes(currentScope);

  const handleDownloadSampleCsv = () => {
    const headers = "Corporate,Regional,Unit,Name,ID,Gender,JoinedDate,BirthDate,Email,Phone,Department,Role,Category,FoodHandler";
    const sampleRow = "Global Tech Inc.,North America,Main Branch,Michael Green,EMP005,Male,2020-09-05,1985-11-30,michael.g@example.com,555-0105,Security,Security,Contractor,No";
    const sampleRow2 = "Quantum Solutions,APAC,Support Center,Robert Brown,EMP003,Male,2021-06-20,1995-03-15,robert.b@example.com,555-0103,Kitchen,Food Safety Team,Staff,Yes";
    const csvContent = "data:text/csv;charset=utf-8," + [headers, sampleRow, sampleRow2].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "employee_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = (evt.target?.result as string).trim();
      const lines = content.split(/\r?\n/);
      if (lines.length < 2) return;
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      const newRecords: any[] = [];
      lines.slice(1).forEach((line, idx) => {
        if (!line.trim()) return;
        const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const record: any = {};
        headers.forEach((h, i) => (record[h] = values[i]));
        record.Name = record.Name || record.name || "";
        record.ID = record.ID || record.id || record["Ticket No"] || "";
        if (record.Name || record.ID) {
          newRecords.push({
            ...record,
            id: `temp-${Date.now()}-${idx}`,
            lastUpdated: new Date().toISOString(),
            history: [],
            Status: "Active",
            Corporate: (record.Corporate || hierarchyContext.corporate || '').trim(),
            Regional: (record.Regional || hierarchyContext.regional || '').trim(),
            Unit: (record.Unit || hierarchyContext.unit || '').trim(),
          });
        }
      });

      const matched: Employee[] = [];
      const unique: Employee[] = [];
      const hasUnitScope = !!filterConstraints.unit;
      const reviewPool = hasUnitScope
        ? employees.filter(e => (e.Unit || '').trim().toLowerCase() === filterConstraints.unit!.toLowerCase())
        : filterConstraints.regional
          ? employees.filter(e => (e.Regional || '').trim().toLowerCase() === filterConstraints.regional!.toLowerCase())
          : filterConstraints.corporate
            ? employees.filter(e => (e.Corporate || '').trim().toLowerCase() === filterConstraints.corporate!.toLowerCase())
            : employees;
      newRecords.forEach((newEmp) => {
        let bestMatch = { score: 0, details: null as any };
        reviewPool.forEach((exEmp) => {
          const nameSim = jaroWinkler(newEmp.Name?.toLowerCase(), exEmp.Name?.toLowerCase());
          const idSim = jaroWinkler(String(newEmp.ID), String(exEmp.ID));
          const score = Math.max(nameSim, idSim);
          if (score > 0.9 && score > bestMatch.score) bestMatch = { score, details: exEmp };
        });
        if (bestMatch.score > 0.9) {
          matched.push({ ...newEmp, similarity: bestMatch.score, matchedWith: { name: bestMatch.details.Name, id: bestMatch.details.ID, department: bestMatch.details.Department, unit: bestMatch.details.Unit } } as Employee);
        } else {
          unique.push(newEmp as Employee);
        }
      });
      setReviewData({ matched, unique });
      if (matched.length > 0 || unique.length > 0) {
        setView("review");
        showToast("CSV Processed. Please review data.");
      } else {
        showToast("No valid data found.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExportExcel = async () => {
    try {
        const XLSX = await import("xlsx");
        if (!XLSX) {
            showToast("Export module not available.");
            return;
        }
        const data = employees.map((emp) => ({ ...emp, history: JSON.stringify(emp.history) }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Employees");
        XLSX.writeFile(wb, "Employee_Roster.xlsx");
        showToast("Excel exported successfully.");
    } catch (err) {
        console.error("Export failed", err);
        showToast("Export failed. Check connection.");
    }
  };

  const showToast = (msg: string) => {
    setUpdateMsg(msg);
    setTimeout(() => setUpdateMsg(null), 4000);
  };

  const filteredEmployees = useMemo(() => {
    if (!employees || filterConstraints.blocked) return [];
    let result = [...employees].sort((a, b) => (a.Status === "Active" ? -1 : 1));
    
    if (filterConstraints.corporate) result = result.filter(e => (e.Corporate || '').trim() === filterConstraints.corporate);
    if (filterConstraints.regional) result = result.filter(e => (e.Regional || '').trim() === filterConstraints.regional);
    if (filterConstraints.unit) result = result.filter(e => (e.Unit || '').trim() === filterConstraints.unit);

    if (currentTab !== "all") {
      const tabNames = currentTab === 'permanent'
        ? (coreCategoryNames.length > 0 ? coreCategoryNames : TAB_CATEGORIES.permanent)
        : (extendedCategoryNames.length > 0 ? extendedCategoryNames : TAB_CATEGORIES.temporary);
      result = result.filter((emp) => tabNames.includes(emp.Category));
    }
    result = result.filter((emp) => {
      if (filters.search) {
        const s = filters.search.toLowerCase().trim();
        const nameMatch = (emp.Name || "").toLowerCase().includes(s);
        const idMatch = (emp.ID || "").toLowerCase().includes(s);
        if (!nameMatch && !idMatch) return false;
      }
      if (filters.corporate && (emp.Corporate || '').trim() !== filters.corporate) return false;
      if (filters.regional && (emp.Regional || '').trim() !== filters.regional) return false;
      if (filters.unit && (emp.Unit || '').trim() !== filters.unit) return false;

      const matchesWithNotIdentified = (val: string | undefined, selectedFilters: string[], knownOptions: string[]) => {
        if (!selectedFilters.length) return true;
        const v = (val || '').trim();
        if (selectedFilters.includes(v)) return true;
        if (selectedFilters.includes('Not Identified') && (!v || !knownOptions.includes(v))) return true;
        return false;
      };
      if (!matchesWithNotIdentified(emp.Gender, filters.gender, PREDEFINED_OPTIONS.Gender)) return false;
      if (!matchesWithNotIdentified(emp.Role, filters.role, dynamicRoleNames)) return false;
      if (!matchesWithNotIdentified(emp.Department, filters.department, dynamicDepartmentNames)) return false;
      if (!matchesWithNotIdentified(emp.Category, filters.category, dynamicCategoryNames)) return false;
      if (!matchesWithNotIdentified(emp.FoodHandler, filters.foodHandler, PREDEFINED_OPTIONS.FoodHandler)) return false;
      if (filters.status.length && !filters.status.includes(emp.Status)) return false;
      if (filters.dojFrom || filters.dojTo) {
          const joinDate = new Date(emp.JoinedDate);
          if (filters.dojFrom && joinDate < new Date(filters.dojFrom)) return false;
          if (filters.dojTo && joinDate > new Date(filters.dojTo)) return false;
      }
      return true;
    });
    return result;
  }, [employees, currentTab, filters, filterConstraints, currentUserEntity, dynamicRoleNames, dynamicDepartmentNames, dynamicCategoryNames, coreCategoryNames, extendedCategoryNames]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEmployees.slice(start, start + rowsPerPage);
  }, [filteredEmployees, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage);

  const counts = useMemo(() => {
    if (!employees || filterConstraints.blocked) return { permanent: 0, temporary: 0, all: 0 };
    const coreNames = coreCategoryNames.length > 0 ? coreCategoryNames : TAB_CATEGORIES.permanent;
    const extNames = extendedCategoryNames.length > 0 ? extendedCategoryNames : TAB_CATEGORIES.temporary;
    const perm = scopeEmployees.filter((e) => coreNames.includes(e.Category)).length;
    const temp = scopeEmployees.filter((e) => extNames.includes(e.Category)).length;
    return { permanent: perm, temporary: temp, all: scopeEmployees.length };
  }, [employees, filterConstraints, scopeEmployees]);

  const handleUpdateEmployee = (id: string, field: string, value: string) => {
    setEmployees((prev) => {
      const next = prev.map((emp) => {
        if (emp.id === id) {
          const oldVal = (emp as any)[field];
          if (oldVal !== value) {
            const newHistory = [{ date: new Date().toISOString(), action: "Edited", details: `${field}: ${oldVal} -> ${value}` }, ...(emp.history || [])];
            return { ...emp, [field]: value, history: newHistory, lastUpdated: new Date().toISOString() };
          }
        }
        return emp;
      });
      const updated = next.find(e => e.id === id);
      if (updated) scheduleUserSave([updated]);
      return next;
    });
  };

  const handleBulkSinkExecute = (targetId: string | null, newName?: string) => {
    const selectedList = employees.filter(e => filters.selectedIds.includes(e.id));
    if (selectedList.length === 0) return;

    const masterRecord = targetId ? employees.find(e => e.id === targetId) : null;
    const now = new Date().toISOString();
    
    // Concatenate history from all sources
    const allHistory = selectedList.flatMap(e => e.history || []);
    const mergedHistory = [
        { date: now, action: "Identity Sinking", details: `Merged ${selectedList.length} profiles into this master identity.` },
        ...allHistory
    ];

    const removedIds = filters.selectedIds.filter(id => id !== targetId);
    const toSave: Employee[] = [];

    setEmployees(prev => {
        const targetWasInSelection = targetId ? filters.selectedIds.includes(targetId) : false;

        let next = prev.filter(e => !filters.selectedIds.includes(e.id));
        
        if (targetId && masterRecord) {
            if (targetWasInSelection) {
                const updatedMaster = {
                    ...masterRecord,
                    history: [...mergedHistory, ...(masterRecord.history || [])],
                    lastUpdated: now
                };
                next = [updatedMaster, ...next];
                toSave.push(updatedMaster);
            } else {
                next = next.map(e => {
                    if (e.id !== targetId) return e;
                    const updated = {
                        ...e,
                        history: [...mergedHistory, ...(e.history || [])],
                        lastUpdated: now
                    };
                    toSave.push(updated);
                    return updated;
                });
            }
        } else if (newName) {
            const template = selectedList[0];
            const newEmp: Employee = {
                ...template,
                id: `EMP-MASTER-${Date.now()}`,
                Name: newName.toUpperCase(),
                ID: `ID-MASTER-${Date.now().toString().slice(-4)}`,
                history: mergedHistory,
                lastUpdated: now,
                Status: "Active" as const
            };
            next = [newEmp, ...next];
            toSave.push(newEmp);
        }

        return next;
    });

    if (toSave.length > 0) scheduleUserSave(toSave);
    removedIds.forEach(id => deleteUserFromDb(id));

    setFilters(p => ({ ...p, selectedIds: [] }));
    setActiveModal("none");
    showToast("Profile Consolidation Complete");
  };

  const handleBulkDelete = async () => {
    const idsToDelete = [...filters.selectedIds];
    const snapshot = employees.filter(e => idsToDelete.includes(e.id));
    setEmployees(prev => prev.filter(e => !idsToDelete.includes(e.id)));
    setFilters(p => ({ ...p, selectedIds: [] }));
    setActiveModal("none");
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) throw new Error('Server error');
      showToast(`${idsToDelete.length} record${idsToDelete.length > 1 ? 's' : ''} deleted`);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      setEmployees(prev => [...prev, ...snapshot]);
      showToast('Delete failed — records restored');
    }
  };

  const toggleSelectOne = (id: string) => {
    setFilters(prev => {
        const next = prev.selectedIds.includes(id) 
            ? prev.selectedIds.filter(i => i !== id) 
            : [...prev.selectedIds, id];
        return { ...prev, selectedIds: next };
    });
  };

  const confirmStatusChange = () => {
    if (!selectedRow) return;
    const isActivating = selectedRow.Status !== "Active";
    
    if (isActivating) {
        const updatedEmp = {
            ...selectedRow,
            Status: "Active" as const,
            history: [{ date: new Date().toISOString(), action: "Status: Active", details: "Manual activation" }, ...(selectedRow.history || [])],
            lastUpdated: new Date().toISOString(),
        };
        setEmployees((prev) => prev.map((emp) => emp.id === selectedRow.id ? updatedEmp : emp));
        scheduleUserSave([updatedEmp]);
        showToast(`Status changed to Active`);
        setActiveModal("none");
    } else {
        if (deactivateType === 'transferred') {
            if (!targetUnitId) {
                alert("Please select a target unit for transfer.");
                return;
            }
            const targetUnit = entities.find(e => e.id === targetUnitId);
            if (!targetUnit) return;

            const targetRegionEntity = entities.find(e => e.id === targetUnit.parentId);
            const targetRegion = targetRegionEntity?.name || 'Central';
            const targetCorporate = targetRegionEntity ? (entities.find(e => e.id === targetRegionEntity.parentId)?.name || selectedRow.Corporate) : selectedRow.Corporate;

            const originalId = selectedRow.id;
            const deactivatedEmp = {
                ...selectedRow,
                Status: "Inactive" as const,
                inactiveComment: `Transferred to ${targetUnit.name}`,
                history: [{ date: new Date().toISOString(), action: "Transferred Out", details: `Transferred to Unit: ${targetUnit.name}. Reason: ${modalInput || 'N/A'}` }, ...(selectedRow.history || [])],
                lastUpdated: new Date().toISOString()
            };
            const newEmpRecord: Employee = {
                ...selectedRow,
                id: `EMP-T-${Date.now()}`,
                Unit: targetUnit.name,
                Regional: targetRegion,
                Corporate: targetCorporate,
                Status: "Active" as const,
                JoinedDate: new Date().toISOString(),
                history: [{ date: new Date().toISOString(), action: "Transferred In", details: `Transferred from Unit: ${selectedRow.Unit}.` }],
                lastUpdated: new Date().toISOString()
            };
            setEmployees(prev => {
                const next = prev.map(emp => emp.id === originalId ? deactivatedEmp : emp);
                return [newEmpRecord, ...next];
            });
            scheduleUserSave([deactivatedEmp, newEmpRecord]);
            showToast(`Employee transferred to ${targetUnit.name}`);
        } else {
            const deactivatedEmp = {
                ...selectedRow,
                Status: "Inactive" as const,
                inactiveComment: modalInput,
                history: [{ date: new Date().toISOString(), action: `Status: Inactive (Resigned)`, details: modalInput || "Resignation" }, ...(selectedRow.history || [])],
                lastUpdated: new Date().toISOString(),
            };
            setEmployees((prev) => prev.map((emp) => emp.id === selectedRow.id ? deactivatedEmp : emp));
            scheduleUserSave([deactivatedEmp]);
            showToast(`Status changed to Inactive`);
        }
        setActiveModal("none");
        setModalInput("");
        setDeactivateType('resigned');
        setTargetUnitId('');
        setUnitSearchQuery('');
        setIsUnitDropdownOpen(false);
    }
  };

  const handleAddNewEmployee = (data: Partial<Employee>) => {
    const newEmp: Employee = {
        ...(data as Employee),
        id: `manual-${Date.now()}`,
        Status: 'Active' as const,
        history: [{ date: new Date().toISOString(), action: 'Created', details: 'Manual Entry' }],
        lastUpdated: new Date().toISOString(),
        Corporate: (data.Corporate || hierarchyContext.corporate || '').trim(), Regional: (data.Regional || hierarchyContext.regional || '').trim(), Unit: (data.Unit || hierarchyContext.unit || '').trim(), Name: data.Name || '', ID: data.ID || '', Gender: data.Gender || '', Email: data.Email || '', Phone: data.Phone || '', Department: data.Department || '', Role: data.Role || '', Category: data.Category || 'Staff', FoodHandler: data.FoodHandler || 'No', JoinedDate: data.JoinedDate || '', BirthDate: data.BirthDate || '', accessLevel: 'Staff'
    };
    setEmployees(prev => [newEmp, ...prev]);
    scheduleUserSave([newEmp]);
    showToast(`Added ${newEmp.Name}`);
    setActiveModal('none');
  };

  useEffect(() => { setCurrentPage(1); }, [filters, currentTab]);

  const toggleHeaderDropdown = (name: string) => {
    setActiveHeaderDropdown(prev => prev === name ? null : name);
  };

  const targetUnitName = useMemo(() => {
    const unit = entities.find(e => e.id === targetUnitId);
    return unit ? `${unit.name} (${unit.location})` : "SELECT DESTINATION UNIT...";
  }, [targetUnitId, entities]);

  if (filterConstraints.blocked) {
    const isLowerScope = currentScope === 'department' || currentScope === 'user';
    return (
      <div className="h-full bg-transparent font-sans">
        <div className="w-full bg-white rounded-xl shadow-lg overflow-hidden p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">
            {isLowerScope ? 'Access Restricted' : 'Select an Entity'}
          </h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md">
            {isLowerScope 
              ? 'Employee data is not accessible at the department or user level. Please contact your unit administrator for employee management.'
              : 'Please select a Corporate, Regional, or Unit entity from the hierarchy tree to view employee data.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-transparent font-sans">
      <div className="w-full flex flex-col gap-6">
        <div className={cn("w-full bg-white rounded-xl shadow-lg overflow-hidden transition-all", view === "dashboard" ? "block" : "hidden")}>
          <div className="flex gap-6 border-b border-gray-200 px-6 bg-gray-50/50 pt-2 overflow-x-auto hide-scrollbar">
            {[
              { id: "permanent", icon: Users, label: "Core Team", count: counts.permanent },
              { id: "temporary", icon: UserCog, label: "Extended Workforce", count: counts.temporary },
              { id: "all", icon: Layers, label: "All Records", count: counts.all },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setCurrentTab(tab.id as any); setCurrentPage(1); }}
                className={cn("flex items-center gap-2 px-2 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap", currentTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-indigo-600 hover:border-gray-300")}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className={cn("ml-1 px-2 py-0.5 rounded-full text-xs", currentTab === tab.id ? "bg-indigo-100 text-indigo-700" : "bg-gray-200 text-gray-700")}>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6 border-b border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Employee Roster</h1>
                    <p className="text-xs text-gray-500 mt-1">Last Updated: {formatDateTime(new Date())}</p>
                </div>
                {filters.selectedIds.length > 1 && (
                    <div className="flex items-center gap-2 animate-in zoom-in-95">
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">{filters.selectedIds.length} selected</span>
                        <button 
                            onClick={() => setActiveModal("bulkSink")}
                            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                        >
                            <Merge size={14} strokeWidth={3} /> Merge
                        </button>
                        <button 
                            onClick={() => setActiveModal("bulkDelete")}
                            className="px-5 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                        >
                            <Trash2 size={14} strokeWidth={3} /> Delete
                        </button>
                    </div>
                )}
            </div>
            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              <div className="relative w-full md:w-auto">
                 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                 <input 
                   type="text" 
                   placeholder="Universal Search..." 
                   value={filters.search}
                   onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                   className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                 />
              </div>


              <button onClick={() => { setFilters(INITIAL_FILTERS); showToast("Refreshed"); }} className="p-2.5 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-4 h-4" /></button>
              
              {canManage && (
                <>
                    <button className="hidden md:inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" onClick={handleDownloadSampleCsv}><FileDown className="w-4 h-4 mr-2" /> Sample CSV</button>
                    <button className="hidden md:inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50" onClick={handleExportExcel}><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</button>
                    <label className="hidden md:inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer"><Upload className="w-4 h-4 mr-2" /> Upload CSV<input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} /></label>
                    <button className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm flex-1 md:flex-none" onClick={() => setActiveModal("newEmployee")}><Plus className="w-4 h-4 mr-2" /> New Employee</button>
                </>
              )}
            </div>
          </div>

          {updateMsg && <div className="bg-indigo-50 text-indigo-700 px-6 py-3 text-sm font-medium text-center border-b border-indigo-100 animate-in fade-in">{updateMsg}</div>}

          <FilterTags filters={filters} setFilters={setFilters} />

          <div className="overflow-x-auto min-h-[400px]" ref={headerDropdownRef}>
            <table className="hidden md:table w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-200">
                  <th className="px-4 py-4 w-12">
                    {canManage && (
                        <button 
                            onClick={() => {
                                const allVisibleIds = paginatedData.map(e => e.id);
                                const allSelected = allVisibleIds.every(id => filters.selectedIds.includes(id));
                                setFilters(prev => ({
                                    ...prev,
                                    selectedIds: allSelected ? [] : allVisibleIds
                                }));
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${paginatedData.every(e => filters.selectedIds.includes(e.id)) && paginatedData.length > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300 hover:border-indigo-400'}`}
                        >
                            {paginatedData.every(e => filters.selectedIds.includes(e.id)) && paginatedData.length > 0 && <Check size={12} strokeWidth={4} />}
                        </button>
                    )}
                  </th>
                  <th className="px-4 py-4 relative">
                    <div onClick={() => toggleHeaderDropdown('hierarchy')} className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">Hierarchy <Filter className="w-3 h-3" /></div>
                    {activeHeaderDropdown === 'hierarchy' && (
                      <div className="absolute top-full left-0 z-20 w-72 bg-white shadow-xl border border-gray-200 rounded-lg p-4 mt-1 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                          <div>
                              <label className="text-xs font-semibold text-gray-700 block mb-1 flex items-center gap-1">Corporate {filterConstraints.corporate && <Shield size={10} className="text-slate-400" />}</label>
                              <select 
                                  className={`w-full text-xs border rounded p-1.5 outline-none ${filterConstraints.corporate ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500'}`}
                                  value={filterConstraints.corporate || filters.corporate}
                                  disabled={!!filterConstraints.corporate}
                                  onChange={(e) => setFilters(prev => ({...prev, corporate: e.target.value, regional: "", unit: ""}))}
                              >
                                  <option value="">All Corporates</option>
                                  {uniqueCorporates.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-semibold text-gray-700 block mb-1 flex items-center gap-1">Regional {filterConstraints.regional && <Shield size={10} className="text-slate-400" />}</label>
                              <select 
                                  className={`w-full text-xs border rounded p-1.5 outline-none ${filterConstraints.regional ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500'}`}
                                  value={filterConstraints.regional || filters.regional}
                                  disabled={!!filterConstraints.regional || (!filters.corporate && !filterConstraints.corporate && uniqueCorporates.length > 1)}
                                  onChange={(e) => setFilters(prev => ({...prev, regional: e.target.value, unit: ""}))}
                              >
                                  <option value="">All Regions</option>
                                  {availableRegionals.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-semibold text-gray-700 block mb-1 flex items-center gap-1">Unit {filterConstraints.unit && <Shield size={10} className="text-slate-400" />}</label>
                              <select 
                                  className={`w-full text-xs border rounded p-1.5 outline-none ${filterConstraints.unit ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-indigo-500'}`}
                                  value={filterConstraints.unit || filters.unit}
                                  disabled={!!filterConstraints.unit || (!filters.regional && !filterConstraints.regional && availableRegionals.length > 1)}
                                  onChange={(e) => setFilters(prev => ({...prev, unit: e.target.value}))}
                              >
                                  <option value="">All Units</option>
                                  {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                          </div>
                      </div>
                    )}
                  </th>
                  <th className="px-4 py-4 relative">
                    <div onClick={() => toggleHeaderDropdown('profile')} className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">Profile Info <Filter className="w-3 h-3" /></div>
                    {activeHeaderDropdown === 'profile' && (
                      <div className="absolute top-full left-0 z-20 w-80 bg-white shadow-xl border border-gray-200 rounded-lg p-4 mt-1 animate-in fade-in zoom-in-95 duration-200">
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Search Name/ID</label>
                                  <div className="relative">
                                      <input 
                                          type="text" 
                                          className="w-full text-sm border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                          placeholder="Search..." 
                                          value={filters.search} 
                                          autoFocus
                                          onChange={(e) => setFilters(prev => ({...prev, search: e.target.value}))}
                                      />
                                      {filters.search && (
                                          <div className="mt-2 max-h-40 overflow-y-auto border border-gray-100 rounded-lg bg-gray-50/50 divide-y divide-gray-100 shadow-inner">
                                              {employees.filter(e => {
                                                  const s = filters.search.toLowerCase().trim();
                                                  return e.Name.toLowerCase().includes(s) || e.ID.toLowerCase().includes(s);
                                              }).slice(0, 5).map(emp => (
                                                  <div 
                                                      key={emp.id} 
                                                      onClick={() => {
                                                        setFilters(prev => ({...prev, search: emp.Name}));
                                                        setActiveHeaderDropdown(null);
                                                      }}
                                                      className="p-2 hover:bg-white hover:shadow-sm cursor-pointer transition-all"
                                                  >
                                                      <div className="text-xs font-bold text-gray-800">{emp.Name}</div>
                                                      <div className="flex justify-between items-center text-[10px] text-gray-500 mt-0.5">
                                                          <span className="bg-white border border-gray-200 px-1.5 rounded">{emp.ID}</span>
                                                          <span className="text-indigo-600 font-medium">{emp.Department}</span>
                                                      </div>
                                                  </div>
                                              ))}
                                              {employees.length === 0 && <div className="p-2 text-xs text-center text-gray-400">No data</div>}
                                          </div>
                                      )}
                                  </div>
                              </div>
                              <div className="border-t pt-2">
                                  <label className="text-xs font-semibold text-gray-700 block mb-1">Gender</label>
                                  <div className="flex gap-4">
                                      {PREDEFINED_OPTIONS.Gender.map(g => (
                                          <label key={g} className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={filters.gender.includes(g)} onChange={(e) => setFilters(prev => ({...prev, gender: e.target.checked ? [...prev.gender, g] : prev.gender.filter(v => v !== g)}))} className="rounded text-indigo-600"/> {g}</label>
                                      ))}
                                  </div>
                              </div>
                              <div className="border-t pt-2"><label className="text-xs font-semibold text-gray-700 block mb-1">Date of Joining</label><div className="flex gap-2"><input type="date" className="w-full text-xs border-gray-300 rounded p-1" value={filters.dojFrom} onChange={e => setFilters({...filters, dojFrom: e.target.value})} /><input type="date" className="w-full text-xs border-gray-300 rounded p-1" value={filters.dojTo} onChange={e => setFilters({...filters, dojTo: e.target.value})} /></div></div>
                          </div>
                      </div>
                    )}
                  </th>
                  <th className="px-4 py-4">Contact</th>
                  <th className="px-4 py-4 relative">
                    <div onClick={() => toggleHeaderDropdown('roleResp')} className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">Role & Resp <Filter className="w-3 h-3" /></div>
                    {activeHeaderDropdown === 'roleResp' && (
                    <div className="absolute left-0 top-full z-20 w-72 bg-white shadow-xl border border-gray-200 rounded-lg p-3 mt-1 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Roles</span>
                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {dynamicRoleNames.map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input type="checkbox" checked={filters.role.includes(opt)} onChange={() => setFilters(prev => ({...prev, role: prev.role.includes(opt) ? prev.role.filter(v => v !== opt) : [...prev.role, opt]}))} className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Responsibility (Dept)</span>
                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {dynamicDepartmentNames.map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input type="checkbox" checked={filters.department.includes(opt)} onChange={() => setFilters(prev => ({...prev, department: prev.department.includes(opt) ? prev.department.filter(v => v !== opt) : [...prev.department, opt]}))} className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </th>
                  <th className="px-4 py-4 relative">
                    <div onClick={() => toggleHeaderDropdown('category')} className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">Category <Filter className="w-3 h-3" /></div>
                    {activeHeaderDropdown === 'category' && (
                    <div className="absolute left-0 top-full z-20 w-64 bg-white shadow-xl border border-gray-200 rounded-lg p-3 mt-1 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-3">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Category</span>
                          <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                            {dynamicCategoryNames.map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input type="checkbox" checked={filters.category.includes(opt)} onChange={() => setFilters(prev => ({...prev, category: prev.category.includes(opt) ? prev.category.filter(v => v !== opt) : [...prev.category, opt]}))} className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Food Handler</span>
                          <div className="space-y-1">
                            {PREDEFINED_OPTIONS.FoodHandler.map(opt => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 p-1 rounded">
                                <input type="checkbox" checked={filters.foodHandler.includes(opt)} onChange={() => setFilters(prev => ({...prev, foodHandler: prev.foodHandler.includes(opt) ? prev.foodHandler.filter(v => v !== opt) : [...prev.foodHandler, opt]}))} className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </th>
                  <th className="px-4 py-4 text-right relative">
                    <div onClick={() => toggleHeaderDropdown('actions')} className="flex items-center justify-end gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                        Actions <Filter className="w-3 h-3" />
                    </div>
                    {activeHeaderDropdown === 'actions' && (
                      <div className="absolute top-full right-0 z-20 w-40 bg-white shadow-xl border border-gray-200 rounded-lg p-3 mt-1 text-left animate-in fade-in zoom-in-95 duration-200">
                          <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">Filter Status</label>
                          <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                  <input type="checkbox" checked={filters.status.includes('Active')} onChange={(e) => setFilters(prev => ({...prev, status: e.target.checked ? [...prev.status, 'Active'] : prev.status.filter(s => s !== 'Active')}))} className="rounded text-green-600 focus:ring-green-500" />
                                  <span className="text-green-700 font-medium">Active</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                                  <input type="checkbox" checked={filters.status.includes('Inactive')} onChange={(e) => setFilters(prev => ({...prev, status: e.target.checked ? [...prev.status, 'Inactive'] : prev.status.filter(s => s !== 'Inactive')}))} className="rounded text-red-600 focus:ring-red-500" />
                                  <span className="text-red-700 font-medium">Inactive</span>
                              </label>
                          </div>
                      </div>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.length > 0 ? paginatedData.map((emp) => (
                  <EmployeeRow 
                    key={emp.id} 
                    employee={emp} 
                    onUpdate={handleUpdateEmployee} 
                    onStatusToggle={() => { setSelectedRow(emp); setActiveModal("status"); setModalInput(""); }} 
                    onViewHistory={() => { setSelectedRow(emp); setActiveModal("history"); }} 
                    onDelete={() => { setEmployees(prev => prev.filter(e => e.id !== emp.id)); deleteUserFromDb(emp.id); }}
                    canManage={canManage}
                    isSelected={filters.selectedIds.includes(emp.id)}
                    onSelectToggle={() => toggleSelectOne(emp.id)}
                    categoryOptions={dynamicCategoryNames}
                    departmentOptions={dynamicDepartmentNames}
                    roleOptions={dynamicRoleNames}
                  />
                )) : <tr><td colSpan={8} className="text-center py-8 text-gray-500 italic">No records found matching filters.</td></tr>}
              </tbody>
            </table>

            <div className="md:hidden space-y-4 p-1">
               {paginatedData.length > 0 ? paginatedData.map((emp) => (
                  <MobileEmployeeCard
                    key={emp.id}
                    employee={emp}
                    onUpdate={handleUpdateEmployee}
                    onStatusToggle={() => { setSelectedRow(emp); setActiveModal("status"); setModalInput(""); }}
                    onViewHistory={() => { setSelectedRow(emp); setActiveModal("history"); }}
                    onDelete={() => { setEmployees(prev => prev.filter(e => e.id !== emp.id)); deleteUserFromDb(emp.id); }}
                    canManage={canManage}
                    isSelected={filters.selectedIds.includes(emp.id)}
                    onSelectToggle={() => toggleSelectOne(emp.id)}
                    categoryOptions={dynamicCategoryNames}
                    departmentOptions={dynamicDepartmentNames}
                    roleOptions={dynamicRoleNames}
                  />
               )) : <div className="text-center py-8 text-gray-500 italic">No records found.</div>}
            </div>
          </div>

          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
          />
        </div>

        {view === "review" && canManage && (
             <div className="w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in">
                <div className="px-6 py-5 border-b border-gray-200 flex flex-col gap-1 bg-white">
                    <h2 className="text-xl font-bold text-gray-900 text-[#2563eb]">Review Uploaded Data</h2>
                    <p className="text-xs text-gray-500">Found {reviewData.matched.length} matched record(s) and {reviewData.unique.length} new record(s).{filterConstraints.unit ? ` Reviewed against "${filterConstraints.unit}" unit employees only.` : filterConstraints.regional ? ` Reviewed against "${filterConstraints.regional}" region employees only.` : filterConstraints.corporate ? ` Reviewed against "${filterConstraints.corporate}" corporate employees only.` : ''}</p>
                </div>

                <div className="bg-[#fffbeb]">
                    <div className="flex justify-between items-center px-6 py-3 border-b border-[#fef3c7]">
                        <h3 className="font-bold text-gray-800 text-sm">Matched Records (Potential Duplicates)</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setReviewData(prev => ({...prev, matched: []}))} className="text-[#dc2626] text-xs font-bold hover:underline px-3 py-1 flex items-center gap-1"><X size={12}/> Discard All</button>
                            <button className="text-gray-600 text-xs font-bold border border-gray-300 bg-white px-3 py-1 rounded hover:bg-gray-50 flex items-center gap-1"><Check size={12}/> Acknowledge All</button>
                        </div>
                    </div>
                    {reviewData.matched.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-bold text-gray-500 uppercase bg-[#fffbeb] border-b border-[#fef3c7]">
                                    <tr>
                                        <th className="px-6 py-3">Hierarchy</th>
                                        <th className="px-6 py-3">Employee Info</th>
                                        <th className="px-6 py-3">Match Details</th>
                                        <th className="px-6 py-3">Contact</th>
                                        <th className="px-6 py-3">Role & Responsibility</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3">Match %</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#fef3c7]">
                                    {reviewData.matched.map((emp, i) => (
                                        <ReviewRow 
                                            key={i} 
                                            data={emp} 
                                            isMatched 
                                            matchData={emp.matchedWith}
                                            matchScore={emp.similarity}
                                            actions={
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setReviewData(prev => ({...prev, matched: prev.matched.filter(m => m.id !== emp.id), unique: [...prev.unique, emp]}))} className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 shadow-sm" title="Add New"><Plus size={14}/></button>
                                                    <button onClick={() => setReviewData(prev => ({...prev, matched: prev.matched.filter(m => m.id !== emp.id)}))} className="w-6 h-6 rounded-full bg-[#ef4444] text-white flex items-center justify-center hover:bg-red-600 shadow-sm" title="Discard"><X size={14}/></button>
                                                </div>
                                            }
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400 text-xs italic">No matched records found.</div>
                    )}
                </div>

                <div className="bg-white border-t border-gray-200">
                    <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-800 text-sm">New Records to be Added</h3>
                        <div className="flex gap-3">
                            <button onClick={() => setReviewData(prev => ({...prev, unique: []}))} className="text-[#dc2626] text-xs font-bold hover:underline px-3 py-1 flex items-center gap-1"><X size={12}/> Discard All</button>
                            <button onClick={() => { setEmployees(prev => [...reviewData.unique, ...prev]); scheduleUserSave(reviewData.unique); setView("dashboard"); showToast(`Added ${reviewData.unique.length} new employees.`); }} className="bg-[#22c55e] text-white text-xs font-bold px-4 py-1.5 rounded hover:bg-green-600 flex items-center gap-1 shadow-sm"><Plus size={14}/> Add All New</button>
                        </div>
                    </div>
                    {reviewData.unique.length > 0 ? (
                        <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-left">
                                <thead className="text-[10px] font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3">Hierarchy</th>
                                        <th className="px-6 py-3">Employee Info</th>
                                        <th className="px-6 py-3">Contact</th>
                                        <th className="px-6 py-3">Role & Responsibility</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reviewData.unique.map((emp, i) => (
                                        <ReviewRow 
                                            key={i} 
                                            data={emp} 
                                            actions={
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setReviewData(prev => ({...prev, unique: prev.unique.filter((_, idx) => idx !== i)}))} className="w-6 h-6 rounded-full bg-[#ef4444] text-white flex items-center justify-center hover:bg-red-600 shadow-sm" title="Discard"><X size={14}/></button>
                                                </div>
                                            }
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400 text-xs italic">No new records found.</div>
                    )}
                </div>
             </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {activeModal === "bulkSink" && (
          <BulkSinkModal 
            selectedItems={employees.filter(e => filters.selectedIds.includes(e.id))}
            allItems={employees}
            onClose={() => setActiveModal("none")}
            onExecute={handleBulkSinkExecute}
          />
      )}

      {activeModal === "bulkDelete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md border border-slate-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-2xl bg-red-50 text-red-600 shadow-lg">
                <Trash2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">Bulk Delete</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{filters.selectedIds.length} record{filters.selectedIds.length > 1 ? 's' : ''} selected</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-6">
              <p className="text-xs font-bold text-red-700 mb-3">The following records will be permanently deleted:</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {employees.filter(e => filters.selectedIds.includes(e.id)).map(emp => (
                  <div key={emp.id} className="flex items-center gap-2 text-xs text-red-800 bg-white/70 px-3 py-1.5 rounded-lg">
                    <User size={12} className="shrink-0" />
                    <span className="font-bold truncate">{emp.Name}</span>
                    <span className="text-red-400 ml-auto shrink-0">{emp.ID}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveModal("none")}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === "status" && selectedRow && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-lg transform scale-100 border border-slate-100 overflow-visible">
                <div className="flex items-center gap-4 mb-6">
                    <div className={cn("p-3 rounded-2xl shadow-lg", selectedRow.Status === 'Active' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                        {selectedRow.Status === 'Active' ? <UserMinus size={24} /> : <Power size={24} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">
                            {selectedRow.Status === "Active" ? "Deactivate Account" : "Activate Account"}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{selectedRow.Name} ({selectedRow.ID})</p>
                    </div>
                </div>

                {selectedRow.Status === "Active" ? (
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lifecycle Change Trigger</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setDeactivateType('resigned')}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all group",
                                        deactivateType === 'resigned' ? "bg-white border-rose-500 shadow-md ring-4 ring-rose-50" : "bg-white border-transparent hover:border-slate-200"
                                    )}
                                >
                                    <Trash2 size={20} className={cn(deactivateType === 'resigned' ? "text-rose-600" : "text-slate-300")} />
                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", deactivateType === 'resigned' ? "text-rose-700" : "text-slate-400")}>Resigned</span>
                                </button>
                                <button 
                                    onClick={() => setDeactivateType('transferred')}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all group",
                                        deactivateType === 'transferred' ? "bg-white border-indigo-600 shadow-md ring-4 ring-indigo-50" : "bg-white border-transparent hover:border-slate-200"
                                    )}
                                >
                                    <ArrowRightLeft size={20} className={cn(deactivateType === 'transferred' ? "text-indigo-600" : "text-slate-300")} />
                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", deactivateType === 'transferred' ? "text-indigo-700" : "text-slate-400")}>Transferred</span>
                                </button>
                            </div>
                        </div>

                        {deactivateType === 'transferred' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 relative z-50">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Destination Unit Registry</label>
                                <div className="relative">
                                    <div 
                                        className="w-full pl-11 pr-10 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase flex items-center justify-between cursor-pointer transition-all hover:border-indigo-400 shadow-inner group"
                                        onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                                    >
                                        <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                                        <span className={targetUnitId ? "text-slate-800" : "text-slate-300"}>
                                            {targetUnitName}
                                        </span>
                                        <ChevronDown size={18} className={cn("text-slate-300 transition-transform", isUnitDropdownOpen && "rotate-180")} />
                                    </div>

                                    {isUnitDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input 
                                                        autoFocus
                                                        className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                                                        placeholder="Search all corporate units..."
                                                        value={unitSearchQuery}
                                                        onChange={(e) => setUnitSearchQuery(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                {filteredPeerUnits.length > 0 ? filteredPeerUnits.map(unit => (
                                                    <div 
                                                        key={unit.id}
                                                        className="px-4 py-3 hover:bg-indigo-50 rounded-xl cursor-pointer flex items-center justify-between group transition-colors"
                                                        onClick={() => {
                                                            setTargetUnitId(unit.id);
                                                            setIsUnitDropdownOpen(false);
                                                            setUnitSearchQuery('');
                                                        }}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-slate-700 uppercase tracking-tight truncate">{unit.name}</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                                                <MapPin size={8} /> {unit.location}
                                                            </div>
                                                        </div>
                                                        {targetUnitId === unit.id && <Check size={16} className="text-indigo-600" strokeWidth={3} />}
                                                    </div>
                                                )) : (
                                                    <div className="p-10 text-center text-slate-300 text-[10px] font-black uppercase">No Units Found</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Administrative Remarks</label>
                            <textarea 
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-rose-500 shadow-inner resize-none h-24" 
                                placeholder="Detail the transition reason for the audit trail..." 
                                value={modalInput} 
                                onChange={(e) => setModalInput(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                ) : (
                    <div className="py-6">
                        <div className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl text-center space-y-3 shadow-inner">
                            <ShieldCheck size={32} className="mx-auto text-emerald-600" />
                            <p className="text-sm font-bold text-emerald-800">Restore access for this identity node? The user will immediately be added to the Active registry.</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-3 mt-10">
                    <button className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-slate-50" onClick={() => { setActiveModal("none"); setDeactivateType('resigned'); setTargetUnitId(''); }}>Discard</button>
                    <button 
                        className={cn(
                            "flex-[2] py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95",
                            selectedRow.Status === 'Active' ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'
                        )} 
                        onClick={confirmStatusChange}
                    >
                        {selectedRow.Status === "Active" ? (deactivateType === 'transferred' ? 'Commit Transfer' : 'Finalize Exit') : 'Re-Authorize Access'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeModal === "history" && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><History className="w-5 h-5 text-indigo-600"/> History: {selectedRow.Name}</h2>
                <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                    {(!selectedRow.history || selectedRow.history.length === 0) ? <p className="text-gray-500 italic">No history found.</p> : selectedRow.history.map((h, i) => (
                        <div key={i} className="relative pl-6 border-l-2 border-indigo-200 pb-4 last:pb-0">
                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-600"></div>
                            <div className="text-xs text-gray-500 mb-1">{formatDateTime(h.date)}</div>
                            <div className="font-semibold text-sm text-gray-900">{h.action}</div>
                            <div className="text-sm text-gray-600">{h.details}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end"><button className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium" onClick={() => setActiveModal("none")}>Close</button></div>
            </div>
        </div>
      )}

      {activeModal === "newEmployee" && canManage && <NewEmployeeModal onClose={() => setActiveModal("none")} onSubmit={handleAddNewEmployee} categoryOptions={dynamicCategoryNames} departmentOptions={dynamicDepartmentNames} roleOptions={dynamicRoleNames} />}
    </div>
  );
}
