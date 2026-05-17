"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Trash2, Plus, Edit, History, Search, 
  AlertCircle, Building2, ShieldCheck, 
  Clock, Package, ChevronDown, ChevronRight, ArrowRight, ArrowLeft,
  Eye, FileUp, X, Loader2, 
  CheckCircle2, FlaskConical, Boxes,
  Layers,
  Tag,
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Hash,
  ClipboardList,
  Edit3,
  Settings2,
  Lock,
  PlusCircle,
  Globe,
  Truck,
  Flame,
  Wheat,
  Beef,
  Droplet,
  Timer,
  Power,
  Camera,
  FileCheck,
  Calendar,
  ShieldAlert,
  Warehouse,
  ListPlus,
  Download,
  CheckCheck,
  MapPin,
  Upload,
  Settings as SettingsIcon,
  XCircle as RemoveIcon,
  FileSearch as ViewIcon,
  Merge,
  Calculator,
  FileText,
  Anchor,
  Ban,
  Sparkles,
  ZapOff,
  MoreVertical,
  MousePointer2,
  FileBadge,
  Shield,
  Thermometer,
  FileDigit,
  Filter,
  User,
  Activity,
  TrendingUp,
  Target,
  ArrowUpRight,
  ArrowDownToLine,
  ArrowDownRight,
  SlidersHorizontal,
  Eraser,
  Info,
  Image as ImageIcon,
  FileSpreadsheet,
  RefreshCw,
  Cpu,
  BrainCircuit,
  Save,
  ArrowLeftRight,
  FileWarning,
  LayoutGrid,
  Maximize2
} from 'lucide-react';
import { RawMaterial, MaterialBrand, CoaRecord, Entity, Brand, HierarchyScope, SupplierLink } from '../types';
import ExcelJS from 'exceljs';
import { GoogleGenAI } from "@google/genai";
import { compressImage } from '../utils/imageCompression';
import { postRegistry, setReloadHandler, noteMaxFromRecords } from '../utils/registrySave';
import RegistrySaveBadge from './RegistrySaveBadge';
import { CollageStudio, PhotoEditor } from './ComplaintFormModal';
import UnifiedPagination from './UnifiedPagination';

// --- Dashboard Component ---

const AnalyticChip = ({ 
    label, 
    value, 
    dotColor = "bg-slate-300", 
    onClick, 
    isActive 
}: { 
    label: string, 
    value: string, 
    dotColor?: string, 
    onClick?: () => void, 
    isActive?: boolean 
}) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-left transition-all duration-150 shrink-0 ${isActive ? 'bg-indigo-50 ring-1 ring-indigo-400 shadow-sm' : 'hover:bg-slate-50 active:scale-[0.97]'}`}
    >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-indigo-500' : dotColor}`} />
        <span className={`text-[10px] md:text-[11px] font-semibold tabular-nums ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>{value}</span>
        <span className={`text-[9px] md:text-[10px] uppercase tracking-wide ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>{label}</span>
    </button>
);

const DashStrip = ({ title, icon: Icon, iconBg, children }: { title: string, icon: any, iconBg: string, children?: React.ReactNode }) => (
    <div className="flex items-start gap-2 md:gap-3 bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm px-3 md:px-4 py-2.5 min-w-[72vw] sm:min-w-[52vw] md:min-w-0 snap-start shrink-0 md:shrink md:w-full">
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl ${iconBg} text-white flex items-center justify-center shrink-0 mt-0.5`}>
            <Icon size={13} className="md:w-[15px] md:h-[15px]" />
        </div>
        <div className="flex flex-col min-w-0 gap-1 flex-1">
            <span className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-[0.08em] leading-none">{title}</span>
            <div className="flex flex-wrap items-center gap-0.5 md:gap-1">
                {children}
            </div>
        </div>
    </div>
);

// --- Options Constants ---

const MOCK_GLOBAL_VENDORS = ["DAIRY PURE", "GLOBAL MEATS", "FARM FRESH", "OCEAN DELIGHT", "VITAL FOODS"];

const STORAGE_OPTIONS = [
  "Vegetarian food hot (≥ 65°C)",
  "Non-vegetarian food hot (≥ 70°C)",
  "Chilled Storage (≤ 5°C)",
  "Chilled & Frozen Combo (≤ 5°C / ≤ -18°C)",
  "Deep Frozen (≤ -18°C)",
  "Ambient; Refrigerate after opening",
  "Ambient Temperature",
  "Dual Chilled/Frozen Choice"
];

const SPECIAL_STORAGE_OPTIONS = [
  "None",
  "Store under refrigerator once open",
  "Protect from direct sunlight",
  "Store in airtight container",
  "Avoid moisture contact",
  "Keep away from strong odors"
];

const HANDLING_INSTRUCTIONS = [
  "Thawing & Cooking",
  "Thawing & RTE/RTS",
  "Thawing & Cold processing",
  "Others (Yes/No/NA)"
];

const ALLERGEN_OPTIONS = [
  'N/A', 'Celery', 'Cereals containing Gluten', 'Crustaceans', 'Eggs', 'Fish',
  'Lupin', 'Milk/Lactose', 'Molluscs', 'Mustard', 'Nuts (Tree Nuts)',
  'Peanuts', 'Sesame Seeds', 'Soybeans', 'Sulphur Dioxide/Sulphites'
];

const SPECIFICATION_CATALOG = [
  "Grade A Quality", "Organic Certified", "ISO 22000", "Non-GMO Project Verified", 
  "Gluten Free", "Halal Certified", "Kosher Certified", "Zero Trans Fat", 
  "HACCP Compliant", "FDA Approved", "EU Standard", "Low Sodium", 
  "No Artificial Colors", "Preservative Free", "High Protein Content"
];

const COA_STATUS_OPTIONS = ["Valid", "Expired", "Expiry Soon", "Not Attached"];

// --- Utility: Jaro-Winkler Fuzzy Matching ---
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  let m = 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.length === 0 || str2.length === 0) return 0;
  if (str1 === str2) return 1;
  let r = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  let rOrder = Math.max(str1.length, str2.length);
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

const getRiskStyles = (risk: string) => {
  switch (risk) {
    case 'High': return 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-100';
    case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-100';
    case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-100';
    case 'NA': return 'bg-slate-50 text-slate-400 border-slate-200 focus:ring-slate-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getCoaColor = (status: string) => {
  switch (status) {
    case 'Valid':
    case 'Compliant': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'Expired':
    case 'Non-Compliant': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'Pending':
    case 'Provisional': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

interface RawMaterialExtended extends RawMaterial {
  isActive?: boolean;
  specifications?: string[]; 
}

interface RawMaterialListProps {
  suppliers: any[];
  entities: Entity[];
  onUpdateEntity: (e: Entity) => void;
  userRootId?: string | null;
  currentScope: HierarchyScope;
  onMaterialsChange?: (materials: RawMaterialExtended[]) => void;
  listType?: 'ingredients' | 'fcm';
  masterBrands?: any[];
  onBrandsChange?: (brands: any[]) => void;
}

export const MOCK_MATERIALS: RawMaterialExtended[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `RM-${100 + i}`,
  name: i === 0 ? 'WHOLE MILK' : `MATERIAL BATCH ${String.fromCharCode(65 + (i % 26))}${i}`,
  organization: i % 2 === 0 ? 'NYC Central Kitchen' : 'LA Logistics Unit', 
  updatedOn: '2024-03-01',
  uploadedBy: 'System',
  accepted: false,
  risk: i % 4 === 0 ? 'High' : i % 4 === 1 ? 'Medium' : i % 4 === 2 ? 'Low' : 'NA',
  riskActive: true,
  yield: false,
  stockable: i % 3 === 0,
  vendors: ['DAIRY PURE'],
  specifications: i % 3 === 0 ? ["Grade A Quality", "ISO 22000"] : ["Gluten Free"],
  brands: [
    {
      id: `B-${1000 + i}`,
      name: i % 3 === 0 ? 'DairyPure Gold' : `Brand ${i}`, 
      status: 'Active',
      allergens: i % 3 === 0 ? 'Milk/Lactose' : i % 3 === 1 ? 'Soybeans, Gluten (Cereals)' : 'None',
      storage: 'Chilled Storage (≤ 5°C)',
      shelfLife: i % 2 === 0 ? '7 Days' : '6 Months',
      specialHandling: 'Thawing & Cooking',
      testingDate: '2024-02-15',
      coaStatus: i % 4 === 0 ? 'Expired' : 'Valid',
      coaRecords: [
        {
          id: `coa-${i}`,
          fileName: `coa_batch_${100 + i}.pdf`,
          batchNumber: `BN-992${i}`,
          manufacturingDate: '2024-01-01',
          testingDate: '2024-02-15',
          expiryDate: i % 4 === 0 ? '2023-01-01' : '2025-08-15', 
          uploadedBy: 'John Chef',
          uploadedAt: '2024-02-16'
        }
      ],
      lastReceived: '2024-02-28',
      vendor: 'DAIRY PURE',
      linkedSuppliers: [{ name: 'DAIRY PURE', status: 'Active' }],
      qtyAccRej: '100/0',
      formE: `E-${100 + i}`,
      reviewedOn: '2024-03-01',
      complianceStatus: 'Compliant',
      nextReview: '2024-04-01',
      openPoints: 0,
      auditTrail: [],
      dietaryType: i % 2 === 0 ? 'Veg' : 'Non-Veg',
      energy: i % 2 === 0 ? '45' : '0',
      image: i % 2 === 0 ? 'https://images.unsplash.com/photo-1628191010210-a59de33e5941?q=80&w=200' : undefined
    }
  ],
  isActive: true,
  createdByEntityId: i % 2 === 0 ? 'unit-ny-kitchen' : 'unit-la-depot',
  createdByScope: 'unit'
}));

const FCM_NAMES = [
  'FOOD GRADE PE FILM', 'ALUMINIUM FOIL WRAP', 'PP CONTAINER LID', 'SILICONE BAKING MAT', 'NITRILE GLOVES',
  'PET CLAMSHELL BOX', 'WAX PAPER SHEETS', 'HDPE CUTTING BOARD', 'STAINLESS STEEL TRAY', 'PARCHMENT LINER',
  'POLYCARBONATE JUG', 'NYLON SPATULA', 'MELAMINE PLATE', 'GLASS STORAGE JAR', 'LATEX FREE GLOVES',
  'CLING WRAP ROLL', 'BPA-FREE BOTTLE', 'FOAM TRAY INSERT', 'CARDBOARD PIZZA BOX', 'BAMBOO SKEWER',
  'PAPER CUP 8OZ', 'TIN CAN LINER', 'VACUUM POUCH ROLL', 'COMPOSTABLE BAG', 'CERAMIC BOWL'
];

export const MOCK_FCM_MATERIALS: RawMaterialExtended[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `FCM-${100 + i}`,
  name: FCM_NAMES[i],
  organization: i % 2 === 0 ? 'NYC Central Kitchen' : 'LA Logistics Unit',
  updatedOn: '2024-03-01',
  uploadedBy: 'System',
  accepted: false,
  risk: i % 4 === 0 ? 'High' : i % 4 === 1 ? 'Medium' : i % 4 === 2 ? 'Low' : 'NA',
  riskActive: true,
  yield: false,
  stockable: false,
  vendors: ['PACKWELL IND.'],
  specifications: i % 3 === 0 ? ["FDA 21 CFR 177", "EU 10/2011"] : ["Food Grade Cert"],
  brands: [
    {
      id: `FB-${2000 + i}`,
      name: i % 3 === 0 ? 'SafePack Pro' : `FCM Brand ${i}`,
      status: 'Active',
      allergens: 'N/A',
      storage: '',
      shelfLife: '3 Years',
      specialHandling: 'None',
      testingDate: '2024-02-15',
      coaStatus: i % 4 === 0 ? 'Expired' : 'Valid',
      coaRecords: [
        {
          id: `fcoa-${i}`,
          fileName: `fgc_fcm_${100 + i}.pdf`,
          batchNumber: `FBN-${3000 + i}`,
          manufacturingDate: '2024-01-01',
          testingDate: '2024-02-15',
          expiryDate: i % 4 === 0 ? '2023-01-01' : '2025-08-15',
          uploadedBy: 'QA Team',
          uploadedAt: '2024-02-16'
        }
      ],
      lastReceived: '2024-02-28',
      vendor: 'PACKWELL IND.',
      linkedSuppliers: [{ name: 'PACKWELL IND.', status: 'Active' }],
      qtyAccRej: '500/0',
      formE: `FE-${100 + i}`,
      reviewedOn: '2024-03-01',
      complianceStatus: 'Compliant',
      nextReview: '2024-04-01',
      openPoints: 0,
      auditTrail: [],
      dietaryType: undefined,
      energy: '0',
      image: i % 3 === 0 ? 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?q=80&w=200' : undefined
    }
  ],
  isActive: true,
  createdByEntityId: i % 2 === 0 ? 'unit-ny-kitchen' : 'unit-la-depot',
  createdByScope: 'unit'
}));

/**
 * Official FSSAI dietary indicator logos
 *  Veg      – green square border, green filled circle centre      (#00A651)
 *  Non-Veg  – maroon square border, maroon filled triangle centre  (#963232)
 */
const DietaryLogo = ({ type, size = "md" }: { type?: 'Veg' | 'Non-Veg', size?: 'sm' | 'md' | 'lg' }) => {
  if (!type) return null;
  const px  = size === 'sm' ? 12 : size === 'lg' ? 24 : 17;
  const bw  = size === 'sm' ? 1.5 : size === 'lg' ? 2.5 : 2;   // border stroke
  const pad = size === 'sm' ? 2 : size === 'lg' ? 4 : 3;        // inner padding

  if (type === 'Non-Veg') {
    return (
      <svg
        width={px} height={px} viewBox={`0 0 ${px} ${px}`}
        xmlns="http://www.w3.org/2000/svg" title="Non-Veg (FSSAI)"
        style={{ display: 'inline-block', flexShrink: 0 }}
      >
        {/* Square border */}
        <rect
          x={bw / 2} y={bw / 2}
          width={px - bw} height={px - bw}
          rx={bw * 0.5} ry={bw * 0.5}
          fill="white" stroke="#963232" strokeWidth={bw}
        />
        {/* Upward-pointing filled triangle */}
        <polygon
          points={`
            ${px / 2},${pad + bw}
            ${px - pad - bw},${px - pad - bw}
            ${pad + bw},${px - pad - bw}
          `}
          fill="#963232"
        />
      </svg>
    );
  }

  const r = (px - pad * 2 - bw * 2) / 2;
  const cx = px / 2, cy = px / 2;
  return (
    <svg
      width={px} height={px} viewBox={`0 0 ${px} ${px}`}
      xmlns="http://www.w3.org/2000/svg" title="Veg (FSSAI)"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {/* Square border */}
      <rect
        x={bw / 2} y={bw / 2}
        width={px - bw} height={px - bw}
        rx={bw * 0.5} ry={bw * 0.5}
        fill="white" stroke="#00A651" strokeWidth={bw}
      />
      {/* Filled circle */}
      <circle cx={cx} cy={cy} r={r} fill="#00A651" />
    </svg>
  );
};

const MultiSelect = ({ label, options, selected, onToggle, placeholder = "Select...", disabled = false, brandMetadata = {} }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const multiSelectRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => { if (multiSelectRef.current && !multiSelectRef.current.contains(event.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const filtered = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));
    const toggle = (val: string) => { if (disabled) return; if (selected.includes(val)) onToggle(selected.filter((i: string) => i !== val)); else onToggle([...selected, val]); };
    return (
        <div ref={multiSelectRef} className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">{label}</label>
            <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full min-h-[48px] bg-slate-50 border-2 rounded-2xl px-4 py-2 flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-indigo-400 bg-white ring-4 ring-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200 shadow-inner'}`}>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 pr-2">{selected.length > 0 ? selected.map((s: string) => (<span key={s} className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-sm animate-in zoom-in-50 whitespace-nowrap">{s} {!disabled && <button onClick={(e) => { e.stopPropagation(); toggle(s); }}><X size={10} strokeWidth={4} /></button>}</span>)) : <span className="text-xs font-bold text-slate-300 italic">{placeholder}</span>}</div>
                {!disabled && <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-[110] top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col">
                    <div className="p-3 border-b border-slate-100 bg-white"><div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 w-4 h-4" /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter list..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-[1.5rem] text-[13px] font-bold text-slate-800 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all" /></div></div>
                    <div className="max-h-[220px] overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                        {filtered.map((opt: string) => { 
                            const isSel = selected.includes(opt); 
                            const meta = brandMetadata[opt];
                            return (
                                <button key={opt} type="button" onClick={() => toggle(opt)} className={`w-full text-left px-5 py-4 rounded-xl flex items-center justify-between group transition-all ${isSel ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                                    <div className="min-w-0">
                                        <div className="font-black text-slate-800 text-[12px] uppercase tracking-tight pr-4">{opt}</div>
                                        {meta && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border uppercase ${meta.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {meta.status === 'Active' ? 'Master' : 'Unit request'}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[120px]">By: {meta.unitName}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>{isSel && <Check size={14} strokeWidth={4} />}</div>
                                </button>
                            ); 
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// Advanced Filtering Types and Components
interface AdvancedFilterState {
    productName: string;
    risk: string;
    vendorName: string;
    brandName: string;
    specification: string;
    
    // New Fields
    allergens: string[];
    storage: string[];
    handling: string[];
    shelfLifeMin: string;
    shelfLifeMax: string;
    hasNutrition: string; // 'yes' | 'no' | ''
    coaStatus: string[];
    hasImage: string; // 'yes' | 'no' | ''
    refrigerateAfterOpening: string; // 'yes' | 'no' | ''
    shelfLifeAfterOpening: string;   // 'yes' | 'no' | ''
    complianceStatus: string;        // 'yes' | 'no' | ''
}

const INITIAL_ADV_FILTERS: AdvancedFilterState = {
    productName: "",
    risk: "",
    vendorName: "",
    brandName: "",
    specification: "",
    allergens: [],
    storage: [],
    handling: [],
    shelfLifeMin: "",
    shelfLifeMax: "",
    hasNutrition: "",
    coaStatus: [],
    hasImage: "",
    refrigerateAfterOpening: "",
    shelfLifeAfterOpening: "",
    complianceStatus: ""
};

const AdvancedGlobalFilterModal = ({ 
    onClose, 
    onApply, 
    currentFilters, 
    totalRecords,
    brandMetadata 
}: { 
    onClose: () => void, 
    onApply: (filters: AdvancedFilterState) => void, 
    currentFilters: AdvancedFilterState, 
    totalRecords: number,
    brandMetadata?: any
}) => {
    const [localFilters, setLocalFilters] = useState<AdvancedFilterState>(currentFilters);

    const handleApply = () => {
        onApply(localFilters);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all placeholder:text-slate-400";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";
    const sectionHeadCls = "text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1.5 mb-3 border-b border-slate-100";

    return (
        <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95 h-[92vh] sm:h-auto sm:max-h-[90vh]">

                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <SlidersHorizontal size={16} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Filter Raw Materials</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">{totalRecords} matching records</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-600"><X size={18}/></button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">

                    {/* Section 1: Core */}
                    <div>
                        <p className={sectionHeadCls}>Core Identity</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Product Name</label>
                                <input
                                    className={fieldCls}
                                    value={localFilters.productName}
                                    onChange={e => setLocalFilters({...localFilters, productName: e.target.value})}
                                    placeholder="Search by name..."
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Risk Level</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.risk}
                                    onChange={e => setLocalFilters({...localFilters, risk: e.target.value})}
                                >
                                    <option value="">All risk levels</option>
                                    <option value="High">High Risk</option>
                                    <option value="Medium">Medium Risk</option>
                                    <option value="Low">Low Risk</option>
                                    <option value="NA">Not Identified</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Vendor</label>
                                <input
                                    className={fieldCls}
                                    value={localFilters.vendorName}
                                    onChange={e => setLocalFilters({...localFilters, vendorName: e.target.value})}
                                    placeholder="Search vendors..."
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Brand Name</label>
                                <input
                                    className={fieldCls}
                                    value={localFilters.brandName}
                                    onChange={e => setLocalFilters({...localFilters, brandName: e.target.value})}
                                    placeholder="Search brands..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Technical */}
                    <div>
                        <p className={sectionHeadCls}>Technical Attributes</p>
                        <div className="space-y-4">
                            <MultiSelect
                                label="Allergens (EU 14)"
                                options={ALLERGEN_OPTIONS}
                                selected={localFilters.allergens}
                                onToggle={(vals: string[]) => setLocalFilters({...localFilters, allergens: vals})}
                                placeholder="Select allergens..."
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <MultiSelect
                                    label="Storage Condition"
                                    options={STORAGE_OPTIONS}
                                    selected={localFilters.storage}
                                    onToggle={(vals: string[]) => setLocalFilters({...localFilters, storage: vals})}
                                    placeholder="Select storage..."
                                />
                                <MultiSelect
                                    label="Special Handling"
                                    options={HANDLING_INSTRUCTIONS}
                                    selected={localFilters.handling}
                                    onToggle={(vals: string[]) => setLocalFilters({...localFilters, handling: vals})}
                                    placeholder="Select instructions..."
                                />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className={labelCls}>Shelf Life — Min days</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 30"
                                        className={fieldCls}
                                        value={localFilters.shelfLifeMin}
                                        onChange={e => setLocalFilters({...localFilters, shelfLifeMin: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Max days</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 365"
                                        className={fieldCls}
                                        value={localFilters.shelfLifeMax}
                                        onChange={e => setLocalFilters({...localFilters, shelfLifeMax: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Specification</label>
                                    <input
                                        className={fieldCls}
                                        value={localFilters.specification}
                                        onChange={e => setLocalFilters({...localFilters, specification: e.target.value})}
                                        placeholder="e.g. Organic..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Compliance */}
                    <div>
                        <p className={sectionHeadCls}>Status & Compliance</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <MultiSelect
                                label="COA Status"
                                options={COA_STATUS_OPTIONS}
                                selected={localFilters.coaStatus}
                                onToggle={(vals: string[]) => setLocalFilters({...localFilters, coaStatus: vals})}
                                placeholder="Any status..."
                            />
                            <div>
                                <label className={labelCls}>Nutritional Data</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.hasNutrition}
                                    onChange={e => setLocalFilters({...localFilters, hasNutrition: e.target.value})}
                                >
                                    <option value="">All</option>
                                    <option value="yes">Available</option>
                                    <option value="no">Missing</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Brand Image</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.hasImage}
                                    onChange={e => setLocalFilters({...localFilters, hasImage: e.target.value})}
                                >
                                    <option value="">All</option>
                                    <option value="yes">Attached</option>
                                    <option value="no">Not attached</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Refrigerate After Opening</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.refrigerateAfterOpening}
                                    onChange={e => setLocalFilters({...localFilters, refrigerateAfterOpening: e.target.value})}
                                >
                                    <option value="">All</option>
                                    <option value="yes">Yes — Refrigerate</option>
                                    <option value="no">No — Not required</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Shelf Life After Opening</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.shelfLifeAfterOpening}
                                    onChange={e => setLocalFilters({...localFilters, shelfLifeAfterOpening: e.target.value})}
                                >
                                    <option value="">All</option>
                                    <option value="yes">Yes — Specified</option>
                                    <option value="no">No — Not specified</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Compliance Status</label>
                                <select
                                    className={fieldCls + " cursor-pointer"}
                                    value={localFilters.complianceStatus}
                                    onChange={e => setLocalFilters({...localFilters, complianceStatus: e.target.value})}
                                >
                                    <option value="">All</option>
                                    <option value="yes">Compliant</option>
                                    <option value="no">Not Compliant</option>
                                </select>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => setLocalFilters(INITIAL_ADV_FILTERS)}
                        className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors px-2 py-1.5"
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <CheckCheck size={15} /> Apply Filters
                    </button>
                </div>

            </div>
        </div>
    );
};

// --- NEW MODAL COMPONENTS ---

const CreateMaterialModal = ({ onClose, onSave, initialMaterial, existingMaterials = [], userRootId, listType = 'ingredients' }: { onClose: () => void, onSave: (data: any) => void, initialMaterial?: any, existingMaterials?: any[], currentScope?: any, userRootId?: string, listType?: 'ingredients' | 'fcm' }) => {
    const [form, setForm] = useState(initialMaterial || { name: '', risk: 'Low', stockable: false, yield: false });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [corpNotice, setCorpNotice] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Filtered suggestions: existing material names matching current input
    const suggestions = useMemo(() => {
        const q = (form.name || '').trim().toLowerCase();
        if (!q || !showSuggestions) return [];
        return (existingMaterials as any[])
            .map(m => m.name as string)
            .filter(n => n && n.toLowerCase().includes(q) && n.toLowerCase() !== q)
            .slice(0, 8);
    }, [form.name, existingMaterials, showSuggestions]);

    const checkDuplicate = (name: string) => {
        const trimmed = name.trim().toLowerCase();
        if (!trimmed) { setNameError(null); setCorpNotice(null); return; }
        const match = (existingMaterials as any[]).find(m => (m.name || '').trim().toLowerCase() === trimmed);
        if (!match) { setNameError(null); setCorpNotice(null); return; }
        const isOwnList = match.createdByEntityId && match.createdByEntityId === userRootId;
        if (isOwnList) {
            setNameError('This name already exists in your list. Please use a different name.');
            setCorpNotice(null);
        } else {
            setNameError(null);
            setCorpNotice('This name exists in the corporate list. It will be added separately to your unit list.');
        }
    };

    const handleNameChange = (val: string) => {
        setForm({ ...form, name: val });
        setShowSuggestions(true);
        checkDuplicate(val);
    };

    const handleSuggestionClick = (name: string) => {
        setForm({ ...form, name });
        setShowSuggestions(false);
        checkDuplicate(name);
        nameInputRef.current?.blur();
    };

    const handleSave = () => {
        if (!form.name.trim()) { setNameError('Name is required.'); return; }
        if (nameError) return;
        onSave(form);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{initialMaterial ? 'Edit Material' : (listType === 'fcm' ? 'New FCM Material' : 'New Material')}</h3>
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                        <input
                            ref={nameInputRef}
                            className={`w-full border p-2 rounded ${nameError ? 'border-rose-400 bg-rose-50' : corpNotice ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
                            value={form.name}
                            onChange={e => handleNameChange(e.target.value)}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            placeholder="Type to search existing materials…"
                            autoComplete="off"
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute z-10 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                                {suggestions.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                        onMouseDown={() => handleSuggestionClick(name)}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {nameError && (
                            <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                                <span>⚠</span> {nameError}
                            </p>
                        )}
                        {corpNotice && !nameError && (
                            <p className="mt-1 text-xs text-amber-700 flex items-center gap-1">
                                <span>ℹ</span> {corpNotice}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Risk</label>
                        <select className="w-full border border-slate-200 p-2 rounded" value={form.risk} onChange={e => setForm({...form, risk: e.target.value})}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="NA">NA</option>
                        </select>
                    </div>
                    {listType !== 'fcm' && <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <span className="text-sm font-bold text-slate-700">Yield</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">{form.yield ? 'Receiving data reflects in Yield tab' : 'No yield generation'}</p>
                            </div>
                            <button type="button" onClick={() => setForm({...form, yield: !form.yield})} className={`w-11 h-6 rounded-full relative transition-all border-2 ${form.yield ? 'bg-emerald-500 border-emerald-500' : 'bg-rose-200 border-rose-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-md absolute top-0.5 transition-all ${form.yield ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                        {form.yield && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 ml-4">
                                <div>
                                    <span className="text-sm font-bold text-slate-700">Stockable</span>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{form.stockable ? 'After yield → Stock Register' : 'After yield → Department Stock'}</p>
                                </div>
                                <button type="button" onClick={() => setForm({...form, stockable: !form.stockable})} className={`w-11 h-6 rounded-full relative transition-all border-2 ${form.stockable ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-200 border-slate-200'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md absolute top-0.5 transition-all ${form.stockable ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        )}
                    </div>}
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={!!nameError || !form.name.trim()}
                        className={`px-4 py-2 rounded text-sm font-bold text-white transition-colors ${nameError || !form.name.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

const BULK_CSV_COLUMNS = [
  'Raw Material Name',
  'Dietary Type',
  'Brand Name',
  'Supplier Name',
  'COA Status',
  'Allergen Information',
  'Storage Condition',
  'Risk Category',
  'Stockable',
  'Specifications',
  'Shelf Life',
  'Special Handling',
  'Calories (kcal / 100g)',
  'Protein (g / 100g)',
  'Fat (g / 100g)',
  'Carbohydrates (g / 100g)',
  'NIP Photos (URLs)'
] as const;
type BulkCsvColumn = typeof BULK_CSV_COLUMNS[number];

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { cur += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
    }
    result.push(cur.trim());
    return result;
}

interface BulkImportPartial {
    suggestedName: string;
    details: Record<BulkCsvColumn, string>;
}

interface BulkImportRow {
    id: string;
    originalName: string;
    suggestedName: string;
    status: 'clean' | 'conflict' | 'error';
    conflictWith?: RawMaterialExtended;
    resolution: 'none' | 'skip' | 'merge' | 'new';
    reason?: string;
    details: Record<BulkCsvColumn, string>;
}

const BulkUploadModal = ({ onClose, onSave, materials, suppliers = [], brands = [] }: { onClose: () => void, onSave: (rows: BulkImportPartial[]) => void, materials: RawMaterialExtended[], suppliers?: any[], brands?: any[] }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<'supplier' | 'upload' | 'review'>('supplier');
    const [reviewRows, setReviewRows] = useState<BulkImportRow[]>([]);
    const [activeTab, setActiveTab] = useState<'clean' | 'conflict' | 'error'>('clean');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [rowEdits, setRowEdits] = useState<Record<string, { brand?: string; supplier?: string; shelfLife?: string; storage?: string }>>({});
    const updateRowEdit = (rowId: string, field: 'brand' | 'supplier' | 'shelfLife' | 'storage', value: string) =>
        setRowEdits(prev => ({ ...prev, [rowId]: { ...prev[rowId], [field]: value } }));
    const activeSuppliers = useMemo(() => suppliers.filter(s => s.status === 'Active'), [suppliers]);
    const activeBrands = useMemo(() => brands.filter((b: any) => b.status === 'Active' || !b.status), [brands]);
    const filteredSuppliers = useMemo(() => {
      if (!supplierSearch.trim()) return activeSuppliers;
      return activeSuppliers.filter((s: any) => s.name?.toUpperCase().includes(supplierSearch.toUpperCase()));
    }, [activeSuppliers, supplierSearch]);
    const selectedSupplier = activeSuppliers.find((s: any) => s.id === selectedSupplierId);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                const data = lines.slice(1);
                processIncomingData(data);
            };
            reader.readAsText(selected);
        }
    };

    const processIncomingData = (dataLines: string[]) => {
        const rows: BulkImportRow[] = dataLines.map((line, idx) => {
            const id = `import-${idx}`;
            const cols = parseCsvLine(line);
            const rawName = (cols[0] || '').trim();
            const trimmedName = rawName.toUpperCase();

            const details = {} as Record<BulkCsvColumn, string>;
            BULK_CSV_COLUMNS.forEach((col, i) => {
                details[col] = (cols[i] || '').trim();
            });
            details['Raw Material Name'] = trimmedName;
            if (selectedSupplier && !details['Supplier Name']) {
                details['Supplier Name'] = selectedSupplier.name;
            }
            
            let conflictWith: RawMaterialExtended | undefined;
            let status: BulkImportRow['status'] = 'clean';
            let reason = '';

            conflictWith = materials.find(m => m.name.toUpperCase() === trimmedName);
            
            if (!conflictWith) {
                const bestMatch = materials.reduce((best, curr) => {
                    const score = jaroWinkler(curr.name, trimmedName);
                    return score > best.score ? { score, item: curr } : best;
                }, { score: 0, item: null as any });

                if (bestMatch.score > 0.92) {
                    conflictWith = bestMatch.item;
                    reason = `Phonetic match (${Math.round(bestMatch.score * 100)}%)`;
                }
            } else {
                reason = 'Exact name collision';
            }

            if (conflictWith) {
                status = 'conflict';
            } else if (!trimmedName) {
                status = 'error';
                reason = 'Missing mandatory name field';
            }

            return {
                id,
                originalName: rawName,
                suggestedName: trimmedName,
                status,
                conflictWith,
                resolution: status === 'clean' ? 'new' : 'none',
                reason,
                details
            };
        });

        setReviewRows(rows);
        setStep('review');
        if (rows.some(r => r.status === 'conflict')) setActiveTab('conflict');
        else if (rows.some(r => r.status === 'clean')) setActiveTab('clean');
        else setActiveTab('error');
    };

    const handleResolution = (rowId: string, resolution: BulkImportRow['resolution']) => {
        setReviewRows(prev => prev.map(r => r.id === rowId ? { ...r, resolution } : r));
    };

    const runAiStandardization = async () => {
        setIsAiProcessing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Standardize the following list of raw material names for an industrial kitchen. 
            Identify conceptual duplicates (e.g. 'Whole Milk 5L' and 'Milk Whole 5000ml'). 
            Return a JSON array of objects: { original: string, standardized: string, category: string }.
            
            Names: ${reviewRows.map(r => r.suggestedName).join(', ')}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    systemInstruction: "You are a master food safety and supply chain data hygiene specialist. You standardize technical names for ISO 22000 registries.",
                    responseMimeType: "application/json"
                }
            });

            const results = JSON.parse(response.text || '[]');
            setReviewRows(prev => prev.map(row => {
                const match = results.find((res: any) => res.original.toUpperCase() === row.suggestedName);
                if (match) {
                    return { ...row, suggestedName: match.standardized.toUpperCase() };
                }
                return row;
            }));
        } catch (error) {
            console.error("AI Analysis failed", error);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleImportCommit = () => {
        const toImport: BulkImportPartial[] = reviewRows
            .filter(r => (r.resolution === 'new' || r.resolution === 'merge') && r.status !== 'error')
            .map(r => {
                const edits = rowEdits[r.id] || {};
                const mergedDetails = { ...r.details } as Record<BulkCsvColumn, string>;
                if (edits.brand) mergedDetails['Brand Name'] = edits.brand;
                if (edits.supplier) mergedDetails['Supplier Name'] = edits.supplier;
                if (edits.shelfLife) mergedDetails['Shelf Life'] = edits.shelfLife;
                if (edits.storage) mergedDetails['Storage Condition'] = edits.storage;
                return { suggestedName: r.suggestedName, details: mergedDetails };
            });
        onSave(toImport);
        onClose();
    };

    const counts = {
        clean: reviewRows.filter(r => r.status === 'clean').length,
        conflict: reviewRows.filter(r => r.status === 'conflict').length,
        error: reviewRows.filter(r => r.status === 'error').length
    };

    return (
         <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className={`bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 ${step === 'review' ? 'w-[95vw] h-[90vh]' : 'w-full max-w-lg'}`}>
                {step === 'supplier' ? (
                    <div className="p-10">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-inner">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Select Supplier</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Step 1 of 3 — Link materials to a supplier</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:bg-slate-100 transition-all"><X size={20}/></button>
                        </div>

                        <div className="relative mb-6">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Supplier Name</label>
                            <div
                                className="flex items-center gap-2 border-2 border-slate-200 rounded-2xl px-4 py-3 bg-slate-50/50 hover:border-indigo-300 focus-within:border-indigo-400 transition-all cursor-pointer"
                                onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                            >
                                {selectedSupplier ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">{selectedSupplier.name?.charAt(0)}</div>
                                        <span className="text-sm font-bold text-slate-800">{selectedSupplier.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedSupplierId(''); setSupplierSearch(''); }} className="ml-auto p-1 hover:bg-slate-200 rounded-lg transition-all"><X size={14} className="text-slate-400" /></button>
                                    </div>
                                ) : (
                                    <input
                                        value={supplierSearch}
                                        onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                                        onClick={e => { e.stopPropagation(); setShowSupplierDropdown(true); }}
                                        placeholder="Search suppliers..."
                                        className="flex-1 bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-400"
                                    />
                                )}
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showSupplierDropdown ? 'rotate-180' : ''}`} />
                            </div>

                            {showSupplierDropdown && !selectedSupplier && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-2xl shadow-xl max-h-52 overflow-y-auto z-50">
                                    {filteredSuppliers.length > 0 ? filteredSuppliers.map((s: any) => (
                                        <button
                                            key={s.id}
                                            onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(''); setShowSupplierDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-all text-left border-b border-slate-50 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">{s.name?.charAt(0)}</div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                                                {s.serviceNature && <p className="text-[10px] font-bold text-slate-400 truncate">{s.serviceNature}</p>}
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="px-4 py-6 text-center">
                                            <p className="text-xs font-bold text-slate-400">No matching suppliers</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button onClick={() => { setSelectedSupplierId(''); setStep('upload'); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all">
                                Skip — No Supplier
                            </button>
                            <button
                                onClick={() => setStep('upload')}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center gap-2"
                            >
                                {selectedSupplier ? `Continue with ${selectedSupplier.name}` : 'Continue'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ) : step === 'upload' ? (
                    <div className="p-10">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                                    <Upload size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Bulk Import</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Step 2 of 3 — Upload CSV file</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
                        </div>
                        {selectedSupplier && (
                            <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <Truck size={14} className="text-emerald-600" />
                                <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">Supplier: {selectedSupplier.name}</span>
                                <button onClick={() => setStep('supplier')} className="ml-auto text-[10px] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-widest">Change</button>
                            </div>
                        )}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="group border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 rounded-[2.5rem] p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                        >
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileUp size={32} className="text-indigo-500" />
                            </div>
                            <p className="text-sm font-black text-slate-600 uppercase tracking-tight group-hover:text-indigo-700">Click to select CSV</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">17 columns: Name · Dietary Type · Brand · Supplier · COA Status · Allergens · Storage · Risk · Stockable · Specs · Shelf Life · Handling · Calories · Protein · Fat · Carbs · NIP Photos</p>
                            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
                        </div>
                        <button onClick={() => setStep('supplier')} className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-all flex items-center gap-1"><ArrowLeft size={12} /> Back to Supplier Selection</button>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Review Header */}
                        <div className="px-10 py-8 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center shrink-0 shadow-2xl relative">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-600/20">
                                    <ClipboardList size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tight">Registry Import Review</h3>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Multi-Vector Deduplication Engine</p>
                                        <div className="h-3 w-px bg-white/10" />
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={12}/> Pre-Validated</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={runAiStandardization}
                                    disabled={isAiProcessing}
                                    className="px-6 py-3 bg-white/10 border border-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white/20 transition-all disabled:opacity-50"
                                >
                                    {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16} className="text-indigo-400"/>}
                                    Gemini AI Analysis
                                </button>
                                <button onClick={() => setStep('upload')} className="px-6 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">Back to Upload</button>
                                <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50"><X size={24} /></button>
                            </div>
                        </div>

                        {/* Review Tabs */}
                        <div className="px-10 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 overflow-x-auto hide-scrollbar">
                            <div className="flex gap-1">
                                {[
                                    { id: 'clean', label: 'Clean', count: counts.clean, color: 'text-emerald-600 border-emerald-600', icon: CheckCircle2 },
                                    { id: 'conflict', label: 'Conflicts', count: counts.conflict, color: 'text-amber-600 border-amber-600', icon: AlertTriangle },
                                    { id: 'error', label: 'Errors', count: counts.error, color: 'text-rose-600 border-rose-600', icon: FileWarning }
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`px-8 py-5 text-[11px] font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-3 ${activeTab === tab.id ? tab.color : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <tab.icon size={16} />
                                        {tab.label}
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.id ? 'bg-slate-100' : 'bg-slate-50'}`}>{tab.count}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 pr-4">
                                <Info size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Resolving conflicts creates a Deduplication Audit Trail</span>
                            </div>
                        </div>

                        {/* Review Content */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
                            {reviewRows.filter(r => r.status === activeTab).length > 0 ? (
                                <div className="p-10 space-y-4">
                                    {reviewRows.filter(r => r.status === activeTab).map(row => (
                                        <div key={row.id} className={`bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden ${row.resolution === 'none' ? 'border-slate-100' : row.resolution === 'skip' ? 'border-rose-200 grayscale opacity-60' : 'border-indigo-400'}`}>
                                            <div className="flex flex-col lg:flex-row items-stretch">
                                                
                                                {/* Left Column: Incoming Data */}
                                                <div className="p-6 lg:w-[35%] flex items-start gap-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${row.status === 'clean' ? 'bg-emerald-50 text-emerald-600' : row.status === 'conflict' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        <FileUp size={24} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Incoming Identity</p>
                                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-2">{row.originalName}</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {row.suggestedName !== row.originalName && (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase border border-indigo-200 flex items-center gap-1 animate-in zoom-in">
                                                                    <Sparkles size={10} /> AI Standardized: {row.suggestedName}
                                                                </span>
                                                            )}
                                                            {row.reason && (
                                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${row.status === 'error' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                                    {row.reason}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {Object.keys(row.details).length > 1 && (
                                                            <div className="mt-3 overflow-x-auto hide-scrollbar rounded-xl border border-slate-100">
                                                                <table className="min-w-full text-[9px]">
                                                                    <thead><tr className="bg-slate-50">
                                                                        {BULK_CSV_COLUMNS.slice(1).map(col => (
                                                                            <th key={col} className="px-2.5 py-1.5 text-left font-black text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-100">{col}</th>
                                                                        ))}
                                                                    </tr></thead>
                                                                    <tbody><tr className="bg-white">
                                                                        {BULK_CSV_COLUMNS.slice(1).map(col => (
                                                                            <td key={col} className="px-2.5 py-1.5 text-slate-700 font-bold whitespace-nowrap">{row.details[col] || '—'}</td>
                                                                        ))}
                                                                    </tr></tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Middle Column: Diff / Registry Match */}
                                                <div className="p-6 flex-1 bg-slate-50/20 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-slate-100">
                                                    {row.status === 'conflict' && row.conflictWith ? (
                                                        <div className="flex items-center gap-8 px-4">
                                                            <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative group">
                                                                <div className="absolute top-2 right-2 text-slate-200 group-hover:text-indigo-500 transition-colors"><Info size={12}/></div>
                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Registry Identity Match</p>
                                                                <p className="text-sm font-black text-slate-800 uppercase truncate">{row.conflictWith.name}</p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border">ID: {row.conflictWith.id}</span>
                                                                    <span className="text-[9px] font-bold text-indigo-500 uppercase">{row.conflictWith.organization}</span>
                                                                </div>
                                                            </div>
                                                            <div className="shrink-0 flex items-center justify-center p-3 bg-white rounded-full shadow-md border border-slate-100 z-10">
                                                                <ArrowLeftRight size={20} className="text-indigo-600" />
                                                            </div>
                                                            <div className="flex-1 bg-indigo-50 p-4 rounded-2xl border border-indigo-200 shadow-sm">
                                                                <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Incoming Node</p>
                                                                <p className="text-sm font-black text-indigo-900 uppercase truncate">{row.suggestedName}</p>
                                                                <p className="text-[9px] font-bold text-indigo-500 mt-2 flex items-center gap-1"><Plus size={10}/> Cross-Unit Mapping Request</p>
                                                            </div>
                                                        </div>
                                                    ) : row.status === 'error' ? (
                                                        <div className="flex flex-col items-center justify-center py-4 gap-3 text-rose-500 bg-rose-50/50 rounded-2xl border border-rose-100">
                                                            <FileWarning size={32} strokeWidth={2.5}/>
                                                            <p className="text-xs font-black uppercase tracking-widest">{row.reason}</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center py-4 gap-3 text-emerald-500 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                                                            <CheckCircle2 size={32} strokeWidth={2.5}/>
                                                            <p className="text-xs font-black uppercase tracking-widest">Identified as Unique Registry Node</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right Column: Resolution HUB */}
                                                <div className="p-6 lg:w-[280px] bg-white flex flex-col justify-start gap-3 overflow-y-auto">
                                                    {row.status === 'conflict' ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button 
                                                                onClick={() => handleResolution(row.id, 'skip')}
                                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${row.resolution === 'skip' ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'border-slate-100 text-slate-400 hover:border-rose-400'}`}
                                                            >
                                                                Skip
                                                            </button>
                                                            <button 
                                                                onClick={() => handleResolution(row.id, 'merge')}
                                                                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${row.resolution === 'merge' ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'border-slate-100 text-slate-400 hover:border-indigo-400'}`}
                                                            >
                                                                Merge
                                                            </button>
                                                            <button 
                                                                onClick={() => handleResolution(row.id, 'new')}
                                                                className={`col-span-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${row.resolution === 'new' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'border-slate-100 text-slate-400 hover:border-slate-900'}`}
                                                            >
                                                                Import as New SKU
                                                            </button>
                                                        </div>
                                                    ) : row.status === 'error' ? (
                                                        <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Action Restricted</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Decision</span>
                                                                <span className="text-[10px] font-black text-emerald-800">ADD NEW</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => handleResolution(row.id, 'skip')}
                                                                className="text-[9px] font-black text-slate-300 uppercase hover:text-rose-500 transition-colors"
                                                            >
                                                                Ignore Item
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Inline Edit Panel — shown when row is actionable */}
                                                    {row.status !== 'error' && row.resolution !== 'skip' && (
                                                        <div className="mt-1 space-y-2 border-t border-slate-100 pt-3">
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Edit Details</p>
                                                            {/* Brand */}
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Brand</label>
                                                                <select
                                                                    value={rowEdits[row.id]?.brand ?? row.details['Brand Name'] ?? ''}
                                                                    onChange={e => updateRowEdit(row.id, 'brand', e.target.value)}
                                                                    className="mt-0.5 w-full text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400"
                                                                >
                                                                    <option value="">— Not Mapped —</option>
                                                                    {activeBrands.map((b: any) => (
                                                                        <option key={b.id} value={b.name}>{b.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {/* Supplier */}
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Supplier</label>
                                                                <select
                                                                    value={rowEdits[row.id]?.supplier ?? row.details['Supplier Name'] ?? ''}
                                                                    onChange={e => updateRowEdit(row.id, 'supplier', e.target.value)}
                                                                    className="mt-0.5 w-full text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400"
                                                                >
                                                                    <option value="">— Unassigned —</option>
                                                                    {activeSuppliers.map((s: any) => (
                                                                        <option key={s.id} value={s.name}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            {/* Shelf Life */}
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Shelf Life</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder={row.details['Shelf Life'] || 'e.g. 7 Days'}
                                                                    value={rowEdits[row.id]?.shelfLife ?? ''}
                                                                    onChange={e => updateRowEdit(row.id, 'shelfLife', e.target.value)}
                                                                    className="mt-0.5 w-full text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400 placeholder:text-slate-300"
                                                                />
                                                            </div>
                                                            {/* Storage Condition */}
                                                            <div>
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Storage Condition</label>
                                                                <select
                                                                    value={rowEdits[row.id]?.storage ?? row.details['Storage Condition'] ?? ''}
                                                                    onChange={e => updateRowEdit(row.id, 'storage', e.target.value)}
                                                                    className="mt-0.5 w-full text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-400"
                                                                >
                                                                    <option value="">— Select —</option>
                                                                    {STORAGE_OPTIONS.map(opt => (
                                                                        <option key={opt} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-40 flex flex-col items-center justify-center opacity-30 grayscale gap-4 text-slate-300">
                                    <Hash size={80} />
                                    <p className="text-2xl font-black uppercase tracking-[0.3em]">No items in queue</p>
                                </div>
                            )}
                        </div>

                        {/* Review Footer */}
                        <div className="px-10 py-8 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-900 text-white flex items-center justify-center text-[10px] font-black uppercase shadow-lg">
                                            {i === 1 ? <Target size={16}/> : i === 2 ? <Cpu size={16}/> : <ShieldCheck size={16}/>}
                                        </div>
                                    ))}
                                </div>
                                <div className="max-w-md">
                                    <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.15em] leading-relaxed">
                                        Summary: <span className="text-slate-900">{reviewRows.filter(r => r.resolution === 'new' || r.resolution === 'merge').length} items</span> staged for commit. All actions will be logged to the <span className="text-indigo-600">Enterprise Audit Log</span>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setStep('upload')} className="px-10 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest transition-all">Discard All</button>
                                <button 
                                    onClick={handleImportCommit}
                                    className="px-20 py-4 bg-indigo-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-4"
                                >
                                    <Save size={20} strokeWidth={2.5} /> Commit Verified Roster
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const BulkSinkModal = ({ onClose, onExecute, selectedItems }: { onClose: () => void, onExecute: (targetId: string | null, newName?: string) => void, selectedItems?: any, allItems?: any }) => {
    const [newName, setNewName] = useState("");
    return (
         <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Consolidate Materials</h3>
                <p className="text-sm text-slate-500 mb-4">Merging {selectedItems?.length} selected records.</p>
                <input className="w-full border p-2 rounded mb-4" placeholder="New Master Name (Optional)" value={newName} onChange={e => setNewName(e.target.value)} />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500">Cancel</button>
                    <button onClick={() => onExecute(null, newName)} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold">Merge</button>
                </div>
            </div>
        </div>
    );
};

const FOURTEEN_ALLERGENS = [
    'N/A', 'Celery', 'Cereals containing Gluten', 'Crustaceans', 'Eggs', 'Fish',
    'Lupin', 'Milk/Lactose', 'Molluscs', 'Mustard', 'Nuts (Tree Nuts)',
    'Peanuts', 'Sesame Seeds', 'Soybeans', 'Sulphur Dioxide/Sulphites'
];

const SPECIAL_HANDLING_OPTIONS = [
    'None', 'Thawing Required', 'Cooking Required', 'Thawing & Cooking',
    'Keep Frozen', 'Keep Refrigerated', 'Protect from Light',
    'Handle with Gloves', 'Do Not Freeze', 'Use Immediately After Opening',
    'Store in Airtight Container', 'Avoid Cross-Contamination'
];

const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder }: { label: string, options: string[], selected: string[], onChange: (v: string[]) => void, placeholder?: string }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
    return (
        <div ref={ref} className="relative">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
            <div onClick={() => setOpen(!open)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus-within:border-indigo-500 cursor-pointer min-h-[40px] flex flex-wrap gap-1 items-center">
                {selected.length === 0 && <span className="text-slate-400 text-xs">{placeholder || 'Select...'}</span>}
                {selected.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100">
                        {s}
                        <button onClick={e => { e.stopPropagation(); onChange(selected.filter(x => x !== s)); }} className="hover:text-rose-500"><X size={10}/></button>
                    </span>
                ))}
            </div>
            {open && (
                <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                            <Search size={14} className="text-slate-400 shrink-0" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." className="w-full bg-transparent text-xs font-bold outline-none" autoFocus />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-3">No matches</p>
                        ) : filtered.map(o => {
                            const isSelected = selected.includes(o);
                            return (
                                <button key={o} onClick={() => { if (isSelected) onChange(selected.filter(x => x !== o)); else onChange([...selected, o]); }} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                        {isSelected && <Check size={10} strokeWidth={3}/>}
                                    </div>
                                    {o}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const SearchableSelect = ({ label, options, value, onChange, placeholder }: { label: string, options: string[], value: string, onChange: (v: string) => void, placeholder?: string }) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const filtered = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
    return (
        <div ref={ref} className="relative">
            {label && <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">{label}</label>}
            <div
                onClick={() => { setOpen(!open); setQ(''); }}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus-within:border-indigo-400 cursor-pointer flex items-center justify-between gap-2 bg-slate-50 hover:bg-white transition-all"
            >
                <span className={value ? 'text-slate-800' : 'text-slate-400'}>{value || placeholder || 'Select...'}</span>
                <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
            {open && (
                <div className="absolute z-[300] top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                            <Search size={14} className="text-slate-400 shrink-0" />
                            <input
                                autoFocus
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                placeholder="Search..."
                                className="w-full bg-transparent text-sm font-semibold outline-none text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
                            />
                            {q && <button onClick={e => { e.stopPropagation(); setQ(''); }} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>}
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No matches</p>
                        ) : filtered.map(o => (
                            <button key={o} onClick={() => { onChange(o); setOpen(false); setQ(''); }} className={`w-full text-left px-3 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all border-b border-slate-50 last:border-0 ${value === o ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                {value === o && <Check size={14} className="text-indigo-600 shrink-0" strokeWidth={3}/>}
                                <span className={value === o ? '' : 'ml-5'}>{o}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface BrandFormData {
    id: string;
    name: string;
    allergens: string[];
    storage: string;
    shelfLife: string;
    specialHandling: string;
    dietaryType: string;
    energy: string;
    protein: string;
    fat: string;
    carb: string;
    images: string[];
    collageImage: string;
    nutritionPanelImages: string[];
    ingredientsLabelImages: string[];
    complianceStatus: 'Compliant' | 'Not Compliant' | 'Pending';
    comments: string;
    refrigeratedAfterOpening: boolean;
    shelfLifeAfterOpeningSpecified: boolean;
    shelfLifeAfterOpeningText: string;
}

const parseAllergens = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (val === 'None' || val === '-') return [];
    return val.split(',').map((s: string) => s.trim()).filter(Boolean);
};

const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
    });
};

const BrandSpecForm = ({ data, onChange, listType = 'ingredients' }: { data: BrandFormData, onChange: (d: BrandFormData) => void, listType?: 'ingredients' | 'fcm' }) => {
    const isFCM = listType === 'fcm';
    const imgRef = useRef<HTMLInputElement>(null);
    const camRef = useRef<HTMLInputElement>(null);
    const nipRef = useRef<HTMLInputElement>(null);
    const nipCamRef = useRef<HTMLInputElement>(null);
    const ingRef = useRef<HTMLInputElement>(null);
    const ingCamRef = useRef<HTMLInputElement>(null);
    const [showCollage, setShowCollage] = useState(false);
    const [viewingImg, setViewingImg] = useState<string | null>(null);
    // Per-serving toggle — stored values always in per-100g; this converts for display/input
    const [servingMode, setServingMode] = useState<'per100g' | 'perServing'>('per100g');
    const [servingGrams, setServingGrams] = useState('100');
    // Date calculator for shelf life
    const [calcMfd, setCalcMfd] = useState('');
    const [calcExp, setCalcExp] = useState('');

    const calcDays = useMemo(() => {
        if (!calcMfd || !calcExp) return null;
        const mfd = new Date(calcMfd);
        const exp = new Date(calcExp);
        if (isNaN(mfd.getTime()) || isNaN(exp.getTime())) return null;
        const diff = Math.round((exp.getTime() - mfd.getTime()) / 86400000) + 1;
        return diff > 0 ? diff : null;
    }, [calcMfd, calcExp]);

    const currentShelfUnit = useMemo(() => {
        const sl = (data.shelfLife || '').toLowerCase();
        if (sl === 'na' || sl === '-' || !sl) return 'NA';
        if (sl.includes('hour')) return 'Hours';
        if (sl.includes('day')) return 'Days';
        if (sl.includes('month')) return 'Months';
        if (sl.includes('year')) return 'Years';
        return isFCM ? 'Years' : 'Days';
    }, [data.shelfLife, isFCM]);

    const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const dataUrl = await readFileAsDataUrl(files[i]);
            const compressed = await compressImage(dataUrl);
            newImages.push(compressed);
        }
        onChange({ ...data, images: [...data.images, ...newImages] });
        e.target.value = '';
    };

    const handleNipImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const dataUrl = await readFileAsDataUrl(files[i]);
            const compressed = await compressImage(dataUrl);
            newImages.push(compressed);
        }
        onChange({ ...data, nutritionPanelImages: [...(data.nutritionPanelImages || []), ...newImages] });
        e.target.value = '';
    };

    const removeImage = (idx: number) => {
        const updated = data.images.filter((_, i) => i !== idx);
        onChange({ ...data, images: updated, collageImage: updated.length < 2 ? '' : data.collageImage });
    };

    const removeNipImage = (idx: number) => {
        const updated = (data.nutritionPanelImages || []).filter((_, i) => i !== idx);
        onChange({ ...data, nutritionPanelImages: updated });
    };

    const handleIngImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newImages: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const dataUrl = await readFileAsDataUrl(files[i]);
            const compressed = await compressImage(dataUrl);
            newImages.push(compressed);
        }
        onChange({ ...data, ingredientsLabelImages: [...(data.ingredientsLabelImages || []), ...newImages] });
        e.target.value = '';
    };

    const removeIngImage = (idx: number) => {
        const updated = (data.ingredientsLabelImages || []).filter((_, i) => i !== idx);
        onChange({ ...data, ingredientsLabelImages: updated });
    };

    const displayImage = data.collageImage || (data.images.length > 0 ? data.images[0] : '');
    const nipImages = data.nutritionPanelImages || [];
    const ingImages = data.ingredientsLabelImages || [];

    return (
        <div className="space-y-5">
            {/* ── Product Images ── */}
            <div>
                <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Photos</p>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => imgRef.current?.click()} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1 transition-all active:scale-95"><Upload size={11}/>Upload</button>
                        <button type="button" onClick={() => camRef.current?.click()} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-semibold border border-emerald-100 hover:bg-emerald-100 flex items-center gap-1 transition-all active:scale-95"><Camera size={11}/>Camera</button>
                        {data.images.length >= 2 && (
                            <button type="button" onClick={() => setShowCollage(true)} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-all active:scale-95 ${data.collageImage ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100'}`}>
                                <LayoutGrid size={11}/>{data.collageImage ? 'Edit Collage' : 'Collage'}
                            </button>
                        )}
                    </div>
                </div>
                <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImg} className="hidden" />
                <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handleImg} className="hidden" />

                {data.images.length === 0 ? (
                    <button type="button" onClick={() => imgRef.current?.click()} className="w-full h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-indigo-400 hover:border-indigo-300 transition-colors bg-slate-50">
                        <Camera size={22} />
                        <span className="text-[11px] font-semibold">Tap to add product photo</span>
                    </button>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {data.images.map((img, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 group cursor-pointer" onClick={() => setViewingImg(img)}>
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                {idx === 0 && data.collageImage && <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[9px] font-bold text-center py-0.5">Collage</div>}
                                <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(idx); }} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={10}/></button>
                            </div>
                        ))}
                        <button type="button" onClick={() => imgRef.current?.click()} className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:text-indigo-400 hover:border-indigo-300 transition-colors shrink-0">
                            <Plus size={18}/>
                        </button>
                    </div>
                )}
            </div>

            {/* ── Ingredients Label Photos ── */}
            {!isFCM && (
                <div>
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center">
                                <FileText size={11} className="text-emerald-600" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingredients Label</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => ingRef.current?.click()} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-semibold border border-emerald-100 hover:bg-emerald-100 flex items-center gap-1 transition-all active:scale-95"><Upload size={11}/>Upload</button>
                            <button type="button" onClick={() => ingCamRef.current?.click()} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[11px] font-semibold border border-emerald-100 hover:bg-emerald-100 flex items-center gap-1 transition-all active:scale-95"><Camera size={11}/>Camera</button>
                        </div>
                    </div>
                    <input ref={ingRef} type="file" accept="image/*" multiple onChange={handleIngImg} className="hidden" />
                    <input ref={ingCamRef} type="file" accept="image/*" capture="environment" onChange={handleIngImg} className="hidden" />

                    {ingImages.length === 0 ? (
                        <button type="button" onClick={() => ingCamRef.current?.click()} className="w-full h-16 rounded-xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center gap-1 text-emerald-300 hover:text-emerald-500 hover:border-emerald-400 transition-colors bg-emerald-50/40">
                            <Camera size={20} />
                            <span className="text-[11px] font-semibold text-emerald-400">Photograph the ingredients list label</span>
                        </button>
                    ) : (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {ingImages.map((img, idx) => (
                                <div key={idx} className="relative shrink-0 group cursor-pointer" onClick={() => setViewingImg(img)}>
                                    <div className="w-28 h-20 rounded-xl overflow-hidden border-2 border-emerald-200 bg-emerald-50">
                                        <img src={img} alt={`Ingredients label ${idx + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">ING {idx + 1}</div>
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeIngImage(idx); }} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={10}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => ingRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-emerald-200 flex items-center justify-center text-emerald-300 hover:text-emerald-400 hover:border-emerald-300 transition-colors shrink-0">
                                <Plus size={16}/>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Nutrition Facts Panel (NIP) ── */}
            {!isFCM && (
                <div>
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-amber-100 rounded-md flex items-center justify-center">
                                <FileText size={11} className="text-amber-600" />
                            </div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nutrition Facts Panel (NIP)</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => nipRef.current?.click()} className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-semibold border border-amber-100 hover:bg-amber-100 flex items-center gap-1 transition-all active:scale-95"><Upload size={11}/>Upload</button>
                            <button type="button" onClick={() => nipCamRef.current?.click()} className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[11px] font-semibold border border-amber-100 hover:bg-amber-100 flex items-center gap-1 transition-all active:scale-95"><Camera size={11}/>Scan</button>
                        </div>
                    </div>
                    <input ref={nipRef} type="file" accept="image/*" multiple onChange={handleNipImg} className="hidden" />
                    <input ref={nipCamRef} type="file" accept="image/*" capture="environment" onChange={handleNipImg} className="hidden" />

                    {nipImages.length === 0 ? (
                        <button type="button" onClick={() => nipCamRef.current?.click()} className="w-full h-20 rounded-xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center gap-1.5 text-amber-300 hover:text-amber-500 hover:border-amber-400 transition-colors bg-amber-50/40">
                            <Camera size={22} />
                            <span className="text-[11px] font-semibold text-amber-400">Photograph the nutrition panel label</span>
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {nipImages.map((img, idx) => (
                                    <div key={idx} className="relative shrink-0 group cursor-pointer" onClick={() => setViewingImg(img)}>
                                        <div className="w-28 h-20 rounded-xl overflow-hidden border-2 border-amber-200 bg-amber-50">
                                            <img src={img} alt={`NIP panel ${idx + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">NIP {idx + 1}</div>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); removeNipImage(idx); }} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X size={10}/></button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => nipCamRef.current?.click()} className="w-16 h-20 rounded-xl border-2 border-dashed border-amber-200 flex flex-col items-center justify-center gap-1 text-amber-300 hover:text-amber-500 hover:border-amber-400 transition-colors shrink-0 bg-amber-50/40">
                                    <Plus size={16}/>
                                    <span className="text-[9px] font-semibold">Add</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Brand Name & Dietary ── */}
            {isFCM ? (
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Brand Name</label>
                    <input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 transition-all bg-slate-50 focus:bg-white" />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Brand Name</label>
                        <input value={data.name} onChange={e => onChange({ ...data, name: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 transition-all bg-slate-50 focus:bg-white" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Dietary</label>
                        {/* FSSAI Veg / Non-Veg toggle */}
                        <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden h-[42px]">
                            {(['Veg', 'Non-Veg'] as const).map(opt => {
                                const isActive = data.dietaryType === opt;
                                const vegActive   = opt === 'Veg'     && isActive;
                                const nvegActive  = opt === 'Non-Veg' && isActive;
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onChange({ ...data, dietaryType: opt })}
                                        className={`flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider transition-all
                                            ${vegActive  ? 'bg-green-50  border-r border-green-200 text-[#00A651]' : ''}
                                            ${nvegActive ? 'bg-red-50   text-[#963232]' : ''}
                                            ${!isActive  ? 'bg-white text-slate-400 hover:bg-slate-50' : ''}
                                            ${opt === 'Veg' ? 'border-r border-slate-200' : ''}
                                        `}
                                    >
                                        <DietaryLogo type={opt} size="md" />
                                        <span>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Allergens ── */}
            {!isFCM && <MultiSelectDropdown label="Allergens (EU 14)" options={FOURTEEN_ALLERGENS} selected={data.allergens} onChange={a => onChange({ ...data, allergens: a })} placeholder="Select allergens..." />}

            {/* ── Storage & Shelf Life ── */}
            <div className={isFCM ? '' : 'grid grid-cols-2 gap-3'}>
                {!isFCM && (
                    <SearchableSelect
                        label="Storage"
                        options={STORAGE_OPTIONS}
                        value={data.storage}
                        onChange={v => onChange({ ...data, storage: v })}
                        placeholder="Select storage condition..."
                    />
                )}
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Shelf Life</label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            min="0"
                            value={(() => { const m = (data.shelfLife || '').match(/^(\d+)/); return m ? m[1] : ''; })()}
                            onChange={e => {
                                const unit = (data.shelfLife || '').replace(/^\d+\s*/, '') || (isFCM ? 'Years' : 'Days');
                                onChange({ ...data, shelfLife: e.target.value ? `${e.target.value} ${unit}` : 'NA' });
                            }}
                            className="w-20 border-2 border-slate-200 rounded-xl px-2.5 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 transition-all text-center bg-slate-50 focus:bg-white"
                            placeholder="0"
                        />
                        <select
                            value={(() => { const sl = (data.shelfLife || '').toLowerCase(); if (sl === 'na' || sl === '-' || !sl) return 'NA'; if (sl.includes('hour')) return 'Hours'; if (sl.includes('day')) return 'Days'; if (sl.includes('month')) return 'Months'; if (sl.includes('year')) return 'Years'; return isFCM ? 'Years' : 'Days'; })()}
                            onChange={e => {
                                if (e.target.value === 'NA') { onChange({ ...data, shelfLife: 'NA' }); return; }
                                const num = (data.shelfLife || '').match(/^(\d+)/);
                                onChange({ ...data, shelfLife: `${num ? num[1] : '0'} ${e.target.value}` });
                            }}
                            className="flex-1 border-2 border-slate-200 rounded-xl px-2.5 py-2.5 text-sm font-semibold outline-none focus:border-indigo-400 transition-all bg-slate-50 focus:bg-white"
                        >
                            <option value="NA">NA</option>
                            <option value="Hours">Hours</option>
                            <option value="Days">Days</option>
                            <option value="Months">Months</option>
                            <option value="Years">Years</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ── Date Calculator (only when unit is Days) ── */}
            {currentShelfUnit === 'Days' && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-indigo-600 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                        <p className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">Shelf Life Date Calculator</p>
                        <span className="ml-auto text-[9px] font-bold text-indigo-400 uppercase">Inclusive of both dates</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Mfg. Date</label>
                            <input
                                type="date"
                                value={calcMfd}
                                onChange={e => { setCalcMfd(e.target.value); }}
                                className="w-full px-3 py-2.5 bg-white border-2 border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all text-slate-700"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Exp. Date</label>
                            <input
                                type="date"
                                value={calcExp}
                                min={calcMfd}
                                onChange={e => { setCalcExp(e.target.value); }}
                                className="w-full px-3 py-2.5 bg-white border-2 border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all text-slate-700"
                            />
                        </div>
                    </div>
                    {calcDays !== null ? (
                        <div className="flex items-center gap-3 bg-white border border-indigo-200 rounded-xl px-4 py-3">
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Calculated Shelf Life</p>
                                <p className="text-2xl font-black text-indigo-700 leading-none mt-0.5">{calcDays} <span className="text-sm font-bold text-indigo-400">days</span></p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onChange({ ...data, shelfLife: `${calcDays} Days` })}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-sm whitespace-nowrap"
                            >
                                Use Value
                            </button>
                        </div>
                    ) : (calcMfd && calcExp) ? (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
                            <p className="text-[11px] font-bold text-rose-500">Expiry date must be after manufacturing date</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white/60 border border-indigo-100 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-indigo-400 font-medium">Enter both dates to calculate shelf life in days</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Refrigeration After Opening ── */}
            {!isFCM && (
                <div className="space-y-3">
                    {/* Q1: Refrigerated after opening? */}
                    <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Does it need to be refrigerated after opening?</p>
                        <div className="flex gap-3">
                            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${data.refrigeratedAfterOpening === true ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name={`refrig-${data.id}`}
                                    checked={data.refrigeratedAfterOpening === true}
                                    onChange={() => onChange({ ...data, refrigeratedAfterOpening: true })}
                                    className="accent-blue-600"
                                />
                                <span className="text-xs font-bold uppercase tracking-wide">Yes</span>
                            </label>
                            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all select-none ${data.refrigeratedAfterOpening === false ? 'bg-slate-50 border-slate-400 text-slate-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                                <input
                                    type="radio"
                                    name={`refrig-${data.id}`}
                                    checked={data.refrigeratedAfterOpening === false}
                                    onChange={() => onChange({ ...data, refrigeratedAfterOpening: false })}
                                    className="accent-slate-500"
                                />
                                <span className="text-xs font-bold uppercase tracking-wide">No</span>
                            </label>
                        </div>
                    </div>

                    {/* Q2: Shelf life after opening specified? */}
                    <div>
                        <label className={`flex items-start gap-3 cursor-pointer select-none group`}>
                            <div className="relative mt-0.5">
                                <input
                                    type="checkbox"
                                    checked={data.shelfLifeAfterOpeningSpecified}
                                    onChange={e => onChange({ ...data, shelfLifeAfterOpeningSpecified: e.target.checked, shelfLifeAfterOpeningText: e.target.checked ? data.shelfLifeAfterOpeningText : '' })}
                                    className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${data.shelfLifeAfterOpeningSpecified ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                    {data.shelfLifeAfterOpeningSpecified && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                            </div>
                            <span className="text-xs font-semibold text-slate-600 leading-snug">Is the shelf life after opening specified?</span>
                        </label>
                        {data.shelfLifeAfterOpeningSpecified && (
                            <div className="mt-2 ml-8">
                                <input
                                    type="text"
                                    value={data.shelfLifeAfterOpeningText}
                                    onChange={e => onChange({ ...data, shelfLifeAfterOpeningText: e.target.value })}
                                    placeholder="e.g. 3 days, 48 hours, 1 week…"
                                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-400 transition-colors"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Nutrition Values ── */}
            {!isFCM && (
                <div>
                    {/* Header row: label + per-100g / per-serving toggle */}
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Nutrition <span className="text-indigo-500">(per 100g stored)</span>
                        </label>
                        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                            <button
                                type="button"
                                onClick={() => setServingMode('per100g')}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${servingMode === 'per100g' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >Per 100g</button>
                            <button
                                type="button"
                                onClick={() => setServingMode('perServing')}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${servingMode === 'perServing' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >Per Serving</button>
                        </div>
                    </div>

                    {/* Serving size input — visible only in per-serving mode */}
                    {servingMode === 'perServing' && (
                        <div className="flex items-center gap-2 mb-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide whitespace-nowrap">Serving Size</span>
                            <input
                                type="number"
                                min="1"
                                value={servingGrams}
                                onChange={e => setServingGrams(e.target.value || '100')}
                                className="w-16 border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-center outline-none focus:border-indigo-400 bg-white"
                                placeholder="30"
                            />
                            <span className="text-[10px] font-bold text-indigo-400">g</span>
                            <span className="text-[9px] text-slate-400 ml-auto italic">auto-converts → /100g</span>
                        </div>
                    )}

                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { key: 'energy', label: 'Calories', color: 'text-orange-500', unit: 'kcal' },
                            { key: 'protein', label: 'Protein', color: 'text-emerald-500', unit: 'g' },
                            { key: 'fat', label: 'Fat', color: 'text-rose-500', unit: 'g' },
                            { key: 'carb', label: 'Carbs', color: 'text-blue-500', unit: 'g' },
                        ].map(({ key, label, color, unit }) => {
                            const storedPer100g = parseFloat((data as any)[key] || '0');
                            const sg = parseFloat(servingGrams || '100') || 100;
                            const displayVal = servingMode === 'perServing'
                                ? parseFloat((storedPer100g * sg / 100).toFixed(2)).toString()
                                : (data as any)[key];
                            return (
                                <div key={key} className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                                    <label className={`text-[10px] font-bold ${color} uppercase block mb-1`}>{label}</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={displayVal}
                                        onChange={e => {
                                            const inputVal = parseFloat(e.target.value || '0');
                                            const sg2 = parseFloat(servingGrams || '100') || 100;
                                            const per100g = servingMode === 'perServing'
                                                ? (inputVal * 100 / sg2).toFixed(2)
                                                : e.target.value;
                                            onChange({ ...data, [key]: per100g });
                                        }}
                                        className="w-full border border-slate-200 rounded-lg px-1 py-1.5 text-xs font-bold outline-none focus:border-indigo-400 text-center bg-white transition-all"
                                    />
                                    <span className="text-[9px] text-slate-400 font-medium">{unit}{servingMode === 'perServing' ? '/srv' : ''}</span>
                                </div>
                            );
                        })}
                    </div>
                    {servingMode === 'perServing' && (
                        <p className="text-[9px] text-slate-400 mt-1.5 text-center">
                            Stored as per 100g · Serving = {servingGrams}g
                        </p>
                    )}
                </div>
            )}

            {showCollage && data.images.length >= 2 && (
                <CollageStudio
                    initialImages={data.images}
                    onSave={(dataUrl, finalImages) => {
                        onChange({ ...data, collageImage: dataUrl, images: finalImages });
                        setShowCollage(false);
                    }}
                    onClose={() => setShowCollage(false)}
                />
            )}

            {viewingImg && (
                <div className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingImg(null)}>
                    <div className="relative max-w-sm w-full max-h-[85dvh]">
                        <img src={viewingImg} alt="" className="max-w-full max-h-[85dvh] rounded-2xl object-contain shadow-2xl" />
                        <button onClick={() => setViewingImg(null)} className="absolute -top-3 -right-3 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-600 hover:text-rose-500"><X size={18}/></button>
                    </div>
                </div>
            )}
        </div>
    );
};

const BrandOnboardModal = ({ onClose, onFinalize, availableBrands, initialCommittedBrand, listType = 'ingredients', onAddBrand }: { onClose: () => void, onFinalize: (brands: any[]) => void, availableBrands: any[], brandMetadata?: any, initialCommittedBrand?: any, listType?: 'ingredients' | 'fcm', onAddBrand?: (name: string) => void }) => {
    const isEditMode = !!initialCommittedBrand;
    const [brandSearch, setBrandSearch] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(!isEditMode);
    const dropRef = useRef<HTMLDivElement>(null);
    const [addManualOpen, setAddManualOpen] = useState(false);
    const [manualName, setManualName] = useState('');
    const [rmChecklists, setRmChecklists] = useState<any[]>([]);
    const [rmChecklistsLoaded, setRmChecklistsLoaded] = useState(false);
    const [auditAnswers, setAuditAnswers] = useState<Record<string, { answer: string; observation: string }>>({});

    useEffect(() => {
        fetch('/api/rm-checklists').then(r => r.json()).then(data => {
            setRmChecklists(Array.isArray(data) ? data : []);
            setRmChecklistsLoaded(true);
        }).catch(() => setRmChecklistsLoaded(true));
    }, []);

    const allAuditQuestions = useMemo(() => {
        const questions: { id: string; text: string; risk: string; category: string; maxScore: number; responses: any[] }[] = [];
        rmChecklists.forEach(tpl => {
            (tpl.pages || []).forEach((pg: any) => {
                (pg.sections || []).forEach((sec: any) => {
                    (sec.questions || []).forEach((q: any) => {
                        questions.push({ id: q.id, text: q.text, risk: q.risk || '', category: q.category || sec.category || '', maxScore: q.maxScore || 0, responses: q.responses || [] });
                    });
                    (sec.subSections || []).forEach((ss: any) => {
                        (ss.questions || []).forEach((q: any) => {
                            questions.push({ id: q.id, text: q.text, risk: q.risk || '', category: q.category || ss.subCategory || sec.category || '', maxScore: q.maxScore || 0, responses: q.responses || [] });
                        });
                    });
                });
            });
        });
        return questions;
    }, [rmChecklists]);

    const LS_KEY = `brand_onboard_draft_${isEditMode ? initialCommittedBrand?.id : 'new'}`;

    const initForm = (b: any): BrandFormData => {
        const existingImages: string[] = [];
        if (b.images && Array.isArray(b.images)) existingImages.push(...b.images);
        else if (b.image) existingImages.push(b.image);
        else if (b.logo) existingImages.push(b.logo);
        return {
            id: b.id || `NEW-${Date.now()}`,
            name: b.name || '',
            allergens: parseAllergens(b.allergens),
            storage: b.storage || STORAGE_OPTIONS[6],
            shelfLife: b.shelfLife || '6 Months',
            specialHandling: b.specialHandling || SPECIAL_HANDLING_OPTIONS[0],
            dietaryType: b.dietaryType || 'Veg',
            energy: b.energy || '0',
            protein: b.protein || '0',
            fat: b.fat || '0',
            carb: b.carb || '0',
            images: existingImages,
            collageImage: b.collageImage || '',
            nutritionPanelImages: Array.isArray(b.nutritionPanelImages) ? b.nutritionPanelImages : [],
            ingredientsLabelImages: Array.isArray(b.ingredientsLabelImages) ? b.ingredientsLabelImages : [],
            complianceStatus: (b.complianceStatus as any) || 'Pending',
            comments: b.comments || '',
            refrigeratedAfterOpening: b.refrigeratedAfterOpening ?? false,
            shelfLifeAfterOpeningSpecified: b.shelfLifeAfterOpeningSpecified ?? false,
            shelfLifeAfterOpeningText: b.shelfLifeAfterOpeningText || '',
        };
    };

    const [brandForms, setBrandForms] = useState<BrandFormData[]>(
        isEditMode ? [initForm(initialCommittedBrand)] : []
    );
    const [expandedBrand, setExpandedBrand] = useState<string | null>(isEditMode ? (initialCommittedBrand?.id || null) : null);
    const [modalComments, setModalComments] = useState<string>(isEditMode ? (initialCommittedBrand?.comments || '') : '');
    const [modalCompliance, setModalCompliance] = useState<'Compliant' | 'Not Compliant' | 'Pending'>(
        isEditMode ? (initialCommittedBrand?.complianceStatus || 'Pending') : 'Pending'
    );

    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const draft = JSON.parse(raw);
                if (!isEditMode && Array.isArray(draft?.brandForms) && draft.brandForms.length > 0) {
                    setBrandForms(draft.brandForms);
                }
                if (draft?.comments !== undefined) setModalComments(draft.comments);
                if (draft?.complianceStatus) setModalCompliance(draft.complianceStatus);
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify({ brandForms, comments: modalComments, complianceStatus: modalCompliance }));
        } catch {}
    }, [brandForms, modalComments, modalCompliance]);

    const toggleBrand = (b: any) => {
        const exists = brandForms.find(f => f.id === b.id);
        if (exists) {
            setBrandForms(prev => prev.filter(f => f.id !== b.id));
            if (expandedBrand === b.id) setExpandedBrand(null);
        } else {
            const newForm = initForm(b);
            setBrandForms(prev => [...prev, newForm]);
            setExpandedBrand(b.id);
            setDropdownOpen(false);
            setBrandSearch('');
        }
    };

    const updateForm = (id: string, data: BrandFormData) => {
        setBrandForms(prev => prev.map(f => f.id === id ? data : f));
    };

    const handleSave = () => {
        const output = brandForms.map(f => ({
            name: f.name,
            allergens: f.allergens.length > 0 ? f.allergens.join(', ') : 'None',
            storage: f.storage,
            shelfLife: f.shelfLife,
            specialHandling: f.specialHandling,
            dietaryType: f.dietaryType,
            energy: f.energy,
            protein: f.protein,
            fat: f.fat,
            carb: f.carb,
            image: f.collageImage || (f.images.length > 0 ? f.images[0] : ''),
            images: f.images,
            collageImage: f.collageImage,
            nutritionPanelImages: f.nutritionPanelImages,
            ingredientsLabelImages: f.ingredientsLabelImages,
            complianceStatus: modalCompliance,
            comments: modalComments,
            refrigeratedAfterOpening: f.refrigeratedAfterOpening,
            shelfLifeAfterOpeningSpecified: f.shelfLifeAfterOpeningSpecified,
            shelfLifeAfterOpeningText: f.shelfLifeAfterOpeningText,
        }));
        try { localStorage.removeItem(LS_KEY); } catch {}
        onFinalize(output);
        if (!isEditMode) onClose();
    };

    const filteredBrands = (availableBrands || []).filter((b: any) => b?.name?.toLowerCase().includes(brandSearch.toLowerCase()));
    const selectedIds = new Set(brandForms.map(f => f.id));

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 sm:slide-in-from-bottom-0" style={{ maxHeight: '92dvh' }}>

                {/* Compact header — only fixed element on mobile beside the button */}
                <div className="shrink-0">
                    <div className="sm:hidden flex justify-center pt-2 pb-0">
                        <div className="w-10 h-1 bg-slate-300 rounded-full" />
                    </div>
                    <div className="px-4 sm:px-6 pt-3 sm:pt-4 pb-2 sm:pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                                <Building2 size={15} className="text-indigo-600 sm:hidden" />
                                <Building2 size={18} className="text-indigo-600 hidden sm:block" />
                            </div>
                            <div>
                                <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800">{isEditMode ? 'Edit Brand Specifications' : 'Onboard Brands'}</h3>
                                <p className="text-[10px] sm:text-[11px] text-slate-400">{isEditMode ? brandForms[0]?.name : `${brandForms.length} brand${brandForms.length !== 1 ? 's' : ''} selected`}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all shrink-0"><X size={16}/></button>
                    </div>
                    <div className="mx-4 sm:mx-6 border-t border-slate-100" />
                </div>

                {/* Everything scrolls: search + brand list + comments + compliance */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-3 min-h-0 overscroll-contain">

                    {/* Brand search — inside scrollable area so keyboard doesn't clip it */}
                    {!isEditMode && (
                        <div className="pb-2 sm:pb-3" ref={dropRef}>
                            <div className={`w-full flex items-center gap-2.5 sm:gap-3 bg-white border-2 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-3 sm:py-3.5 transition-all ${dropdownOpen ? 'border-indigo-400 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                                <Search size={16} className={`shrink-0 transition-colors ${dropdownOpen ? 'text-indigo-400' : 'text-slate-400'}`} />
                                <input
                                    value={brandSearch}
                                    onChange={e => { setBrandSearch(e.target.value); setDropdownOpen(true); }}
                                    onFocus={() => setDropdownOpen(true)}
                                    placeholder="Search & select brands..."
                                    className="w-full bg-transparent text-sm font-semibold outline-none text-slate-800 placeholder:font-normal placeholder:text-slate-400"
                                />
                                {brandSearch && <button onClick={() => { setBrandSearch(''); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"><X size={15}/></button>}
                                {dropdownOpen
                                    ? <button onClick={() => { setDropdownOpen(false); setBrandSearch(''); }} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all shrink-0"><ChevronDown size={16} className="rotate-180" /></button>
                                    : <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                }
                            </div>
                            {brandForms.length > 0 && !dropdownOpen && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {brandForms.map(f => (
                                        <span key={f.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-semibold border border-indigo-100">
                                            {(f.collageImage || f.images.length > 0) && <img src={f.collageImage || f.images[0]} alt="" className="w-3.5 h-3.5 rounded object-cover" />}
                                            {f.name}
                                            <button onClick={() => toggleBrand({ id: f.id })} className="hover:text-rose-500 ml-0.5 transition-colors"><X size={10}/></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {!isEditMode && dropdownOpen ? (
                        /* ── Inline brand picker (no floating dropdown) ── */
                        <div className="space-y-0 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            {filteredBrands.length === 0 ? (
                                <div className="py-10 px-6 text-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Building2 size={20} className="text-slate-300" />
                                    </div>
                                    <p className="text-sm font-semibold text-slate-500 mb-3">{brandSearch ? 'No matching brands' : 'No brands available'}</p>
                                    {onAddBrand && !addManualOpen && (
                                        <button onClick={() => { setAddManualOpen(true); setManualName(brandSearch); }} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-sm font-semibold transition-all border border-indigo-100 active:scale-95">
                                            <PlusCircle size={16} /> Add Manually
                                        </button>
                                    )}
                                    {onAddBrand && addManualOpen && (
                                        <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
                                            <input autoFocus value={manualName} onChange={e => setManualName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && manualName.trim()) { onAddBrand(manualName.trim()); setManualName(''); setAddManualOpen(false); setBrandSearch(''); setDropdownOpen(false); } }} placeholder="Brand name..." className="flex-1 w-full border-2 border-slate-300 rounded-xl px-4 py-3 text-base sm:text-sm font-semibold outline-none focus:border-indigo-400 transition-all" />
                                            <button disabled={!manualName.trim()} onClick={() => { onAddBrand(manualName.trim()); setManualName(''); setAddManualOpen(false); setBrandSearch(''); setDropdownOpen(false); }} className="px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all disabled:opacity-40 active:scale-95"><Check size={18} /></button>
                                            <button onClick={() => { setAddManualOpen(false); setManualName(''); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all"><X size={18} /></button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} available</span>
                                        {brandForms.length > 0 && <span className="text-[11px] font-bold text-indigo-500">{brandForms.length} selected</span>}
                                    </div>
                                    {filteredBrands.map((b: any) => {
                                        const isSel = selectedIds.has(b.id);
                                        return (
                                            <button key={b.id} onClick={() => toggleBrand(b)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-slate-100 last:border-0 active:bg-indigo-100 ${isSel ? 'bg-indigo-50/80' : 'bg-white hover:bg-slate-50'}`}>
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                                    {isSel && <Check size={12} strokeWidth={3}/>}
                                                </div>
                                                <div className="w-10 h-10 rounded-xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50 shadow-sm">
                                                    {b.logo
                                                        ? <img src={b.logo} alt="" className="w-full h-full object-cover" />
                                                        : <span className="text-lg font-black text-slate-300 uppercase">{b.name?.charAt(0) || '?'}</span>
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`font-bold text-[15px] block truncate ${isSel ? 'text-indigo-700' : 'text-slate-800'}`}>{b.name}</span>
                                                    {b.addedByUnitName && <span className="text-xs text-slate-400 font-medium">{b.addedByUnitName}</span>}
                                                </div>
                                                {isSel && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    ) : brandForms.length === 0 && !isEditMode ? (
                        <div className="py-14 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Building2 size={28} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-semibold text-slate-400">Select brands from above</p>
                            <p className="text-xs text-slate-300 mt-1">Each brand can be configured individually</p>
                        </div>
                    ) : (
                    <div className="space-y-2.5">
                    {brandForms.map(f => {
                        const nipCount = (f.nutritionPanelImages || []).length;
                        const displayImg = f.collageImage || (f.images.length > 0 ? f.images[0] : '');
                        return (
                            <div key={f.id} className={`border rounded-2xl overflow-hidden transition-all ${expandedBrand === f.id ? 'border-indigo-300 shadow-md shadow-indigo-50' : 'border-slate-200'}`}>
                                {/* Sub-card header — collapsed view */}
                                <div>
                                    <button onClick={() => setExpandedBrand(expandedBrand === f.id ? null : f.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${expandedBrand === f.id ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                                        {/* Product image thumbnail */}
                                        <div className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden bg-slate-50 relative">
                                            {displayImg ? <img src={displayImg} alt="" className="w-full h-full object-cover" /> : <Building2 size={18} className="text-slate-300" />}
                                            {f.images.length > 1 && !f.collageImage && (
                                                <div className="absolute top-0.5 right-0.5 bg-indigo-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{f.images.length}</div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-slate-800">{f.name}</span>
                                                {f.dietaryType && (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${f.dietaryType === 'Veg' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{f.dietaryType}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {f.allergens.length > 0 && (
                                                    <span className="text-[11px] text-amber-600 font-medium">{f.allergens.length} allergen{f.allergens.length !== 1 ? 's' : ''}</span>
                                                )}
                                                {f.storage && <span className="text-[11px] text-slate-400 font-medium">{f.storage.split(' ').slice(0, 2).join(' ')}</span>}
                                                {f.shelfLife && f.shelfLife !== 'NA' && <span className="text-[11px] text-slate-400 font-medium">{f.shelfLife}</span>}
                                                {/* NIP badge */}
                                                {nipCount > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-semibold border border-amber-100">
                                                        <FileText size={9} /> NIP ×{nipCount}
                                                    </span>
                                                )}
                                                {f.images.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-semibold">
                                                        <Camera size={9} /> {f.images.length} photo{f.images.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronDown size={18} className={`text-slate-400 transition-transform shrink-0 ${expandedBrand === f.id ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* NIP preview strip — always show thumbnails when collapsed */}
                                    {nipCount > 0 && expandedBrand !== f.id && (
                                        <div className="px-4 py-2.5 bg-amber-50/30 border-t border-amber-100 flex gap-2 overflow-x-auto">
                                            {(f.nutritionPanelImages || []).slice(0, 6).map((img, i) => (
                                                <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border-2 border-amber-300 shrink-0 hover:shadow-md transition-all cursor-pointer" title={`NIP Panel ${i + 1}`}>
                                                    <img src={img} alt={`NIP ${i + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                            {nipCount > 6 && <div className="w-12 h-12 rounded-lg bg-amber-100 border-2 border-amber-300 flex items-center justify-center shrink-0 font-bold text-amber-700">+{nipCount - 6}</div>}
                                        </div>
                                    )}
                                </div>

                                {expandedBrand === f.id && (
                                    <div className="px-4 pb-5 pt-3 border-t border-slate-100 bg-white space-y-4">
                                        <BrandSpecForm data={f} onChange={(d) => updateForm(f.id, d)} listType={listType} />

                                        <div className="border-t border-slate-100 pt-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                                                <ClipboardList size={11} className="inline mr-1 -mt-0.5" />
                                                Audit Registry
                                            </label>
                                            {!rmChecklistsLoaded ? (
                                                <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> Loading...</div>
                                            ) : allAuditQuestions.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No RM checklist questions found. Create questions in the RM Checklist Form tab.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {allAuditQuestions.map((q, qi) => {
                                                        const ans = auditAnswers[q.id] || { answer: '', observation: '' };
                                                        const riskColor = q.risk === 'Critical' ? 'text-red-600 bg-red-50' : q.risk === 'High' ? 'text-orange-600 bg-orange-50' : q.risk === 'Medium' ? 'text-yellow-700 bg-yellow-50' : q.risk === 'Low' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-50';
                                                        const responseOptions = q.responses.length > 0
                                                            ? q.responses.map((r: any) => ({ label: r.label || r.text || r.value, value: r.value ?? r.label ?? r.text, color: (r.label || r.text || '').toLowerCase() }))
                                                            : [{ label: 'Yes', value: 'Yes', color: 'yes' }, { label: 'No', value: 'No', color: 'no' }, { label: 'N/A', value: 'N/A', color: 'n/a' }];
                                                        return (
                                                            <div key={q.id} className="border-l-[3px] border-green-400 rounded-lg bg-white p-3 shadow-sm">
                                                                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                                                    {q.risk && <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${riskColor}`}>{q.risk} Risk</span>}
                                                                    {q.category && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-50">{q.category}</span>}
                                                                    <span className="ml-auto text-[9px] text-slate-400 font-mono">{ans.answer ? (responseOptions.find((o: any) => o.value === ans.answer)?.label === 'Yes' ? q.maxScore : 0) : '--'}/{q.maxScore}</span>
                                                                </div>
                                                                <p className="text-xs text-slate-700 font-medium mb-2">{q.text}</p>
                                                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                                                    {responseOptions.map((opt: any) => {
                                                                        const isActive = ans.answer === opt.value;
                                                                        const c = opt.color.toLowerCase();
                                                                        const btnClass = c.includes('yes') || c.includes('good') || c.includes('satisfactory')
                                                                            ? (isActive ? 'bg-green-100 border-green-400 text-green-700 font-bold' : 'bg-green-50/50 border-slate-200 text-green-600 hover:bg-green-50')
                                                                            : c.includes('no') || c.includes('bad') || c.includes('unsatisfactory')
                                                                            ? (isActive ? 'bg-red-100 border-red-400 text-red-700 font-bold' : 'bg-red-50/30 border-slate-200 text-red-500 hover:bg-red-50')
                                                                            : c.includes('fair')
                                                                            ? (isActive ? 'bg-amber-100 border-amber-400 text-amber-700 font-bold' : 'bg-amber-50/30 border-slate-200 text-amber-600 hover:bg-amber-50')
                                                                            : (isActive ? 'bg-slate-200 border-slate-400 text-slate-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100');
                                                                        return (
                                                                            <button
                                                                                key={opt.value}
                                                                                onClick={() => setAuditAnswers(prev => ({ ...prev, [q.id]: { ...ans, answer: isActive ? '' : opt.value } }))}
                                                                                className={`px-2 py-2 text-[10px] font-bold rounded-lg border transition-all ${btnClass}`}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div>
                                                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                                                                        <FileText size={9} /> Observation
                                                                    </label>
                                                                    <textarea
                                                                        value={ans.observation}
                                                                        onChange={e => setAuditAnswers(prev => ({ ...prev, [q.id]: { ...ans, observation: e.target.value } }))}
                                                                        placeholder="Type your observation here..."
                                                                        rows={2}
                                                                        className="w-full px-2.5 py-2 text-[11px] border border-slate-200 rounded-lg bg-slate-50/50 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-200 resize-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                            </div>
                        );
                    })}
                    </div>
                    )}

                    {/* Comments + Compliance inside scrollable area so keyboard doesn't hide them */}
                    <div className="pt-3 pb-2 space-y-3 border-t border-slate-100 mt-3">
                        {/* Comments box */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Comments</label>
                            <textarea
                                value={modalComments}
                                onChange={e => setModalComments(e.target.value)}
                                placeholder="Add notes, remarks or observations…"
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-300 focus:outline-none focus:border-indigo-400 resize-none bg-slate-50 leading-relaxed"
                            />
                        </div>
                        {/* Compliance toggle */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Compliance Status</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setModalCompliance('Compliant')}
                                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${modalCompliance === 'Compliant' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500'}`}
                                >
                                    <Check size={13} strokeWidth={3} /> Compliant
                                </button>
                                <button
                                    onClick={() => setModalCompliance('Not Compliant')}
                                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${modalCompliance === 'Not Compliant' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-500'}`}
                                >
                                    <X size={13} strokeWidth={3} /> Not Compliant
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile inline action buttons — inside scroll so keyboard never covers them */}
                    <div className="sm:hidden mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2 pb-6">
                        <button
                            disabled={brandForms.length === 0}
                            onClick={handleSave}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Check size={16} />
                            {isEditMode ? 'Save Changes' : `Onboard ${brandForms.length > 0 ? `${brandForms.length} Brand${brandForms.length !== 1 ? 's' : ''}` : 'Brands'}`}
                        </button>
                        <button onClick={onClose} className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors text-center">
                            Cancel
                        </button>
                    </div>

                </div>

                {/* Desktop-only sticky footer */}
                <div className="hidden sm:flex border-t border-slate-100 px-6 pt-3 pb-5 shrink-0 bg-white flex-col gap-2">
                    <button
                        disabled={brandForms.length === 0}
                        onClick={handleSave}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Check size={17} />
                        {isEditMode ? 'Save Changes' : `Onboard ${brandForms.length > 0 ? `${brandForms.length} Brand${brandForms.length !== 1 ? 's' : ''}` : 'Brands'}`}
                    </button>
                    <button onClick={onClose} className="w-full py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors text-center">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

const CoaManagementModal = ({ onClose, material, onUpdateBrands, listType = 'ingredients' }: { onClose: () => void, material?: any, materials?: any, onUpdateBrands?: (brands: any[]) => void, listType?: 'ingredients' | 'fcm' }) => {
    const isFCM = listType === 'fcm';
    const certLabel = isFCM ? 'FGC' : 'COA';
    const [selectedBrandId, setSelectedBrandId] = useState<string>(material?.brands?.[0]?.id || '');
    const [newBatch, setNewBatch] = useState('');
    const [newMfg, setNewMfg] = useState('');
    const defaultExpiry = (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 3); return d.toISOString().split('T')[0]; })();
    const [newExp, setNewExp] = useState(isFCM ? defaultExpiry : '');
    const [expiryNum, setExpiryNum] = useState(isFCM ? '3' : '');
    const [expiryUnit, setExpiryUnit] = useState<'Years' | 'Months' | 'Days'>('Years');
    const [statusUpdate, setStatusUpdate] = useState('Valid');
    const [uploadedFileData, setUploadedFileData] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [viewingCoa, setViewingCoa] = useState<CoaRecord | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedBrand = material?.brands?.find((b: any) => b.id === selectedBrandId);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            setUploadedFileData(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const computeExpiryFromUnits = (num: string, unit: string) => {
        const n = parseInt(num) || 0;
        const d = new Date();
        if (unit === 'Years') d.setFullYear(d.getFullYear() + n);
        else if (unit === 'Months') d.setMonth(d.getMonth() + n);
        else d.setDate(d.getDate() + n);
        return d.toISOString().split('T')[0];
    };

    const handleAddRecord = () => {
        const effectiveExp = isFCM ? computeExpiryFromUnits(expiryNum, expiryUnit) : newExp;
        if (!selectedBrand || (!isFCM && !newBatch) || !effectiveExp) return;
        const newRecord: CoaRecord = {
            id: `coa-${Date.now()}`,
            fileName: uploadedFileName || `${certLabel}_${isFCM ? material?.name?.replace(/\s+/g, '_') : newBatch}.pdf`,
            batchNumber: isFCM ? '-' : newBatch,
            manufacturingDate: isFCM ? '-' : (newMfg || new Date().toISOString().split('T')[0]),
            testingDate: new Date().toISOString().split('T')[0],
            expiryDate: effectiveExp,
            uploadedBy: 'Current User',
            uploadedAt: new Date().toISOString().split('T')[0],
            fileData: uploadedFileData || undefined
        };
        const updatedBrands = material.brands.map((b: any) => 
            b.id === selectedBrandId 
                ? { ...b, coaRecords: [newRecord, ...(b.coaRecords || [])], coaStatus: statusUpdate, testingDate: new Date().toISOString().split('T')[0] }
                : b
        );
        if (onUpdateBrands) onUpdateBrands(updatedBrands);
        setNewBatch(''); setNewMfg(''); setNewExp(''); setExpiryNum(isFCM ? '3' : ''); setExpiryUnit('Years'); setUploadedFileData(null); setUploadedFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleUpdateStatus = (brandId: string, status: string) => {
        const updatedBrands = material.brands.map((b: any) =>
            b.id === brandId ? { ...b, coaStatus: status } : b
        );
        if (onUpdateBrands) onUpdateBrands(updatedBrands);
    };

    if (viewingCoa) {
        return (
            <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-4 flex items-center justify-between shrink-0">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight">{certLabel} Document</h3>
                            <p className="text-[10px] font-bold text-indigo-300 mt-0.5">{viewingCoa.fileName}</p>
                        </div>
                        <button onClick={() => setViewingCoa(null)} className="p-2 text-white/60 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        {viewingCoa.fileData ? (
                            viewingCoa.fileData.startsWith('data:image') ? (
                                <img src={viewingCoa.fileData} alt={viewingCoa.fileName} className="w-full rounded-xl shadow-lg" />
                            ) : viewingCoa.fileData.startsWith('data:application/pdf') ? (
                                <iframe src={viewingCoa.fileData} className="w-full h-[60vh] rounded-xl border" title={`${certLabel} PDF`} />
                            ) : (
                                <div className="text-center py-10">
                                    <FileText size={48} className="mx-auto mb-4 text-indigo-300" />
                                    <p className="text-sm font-bold text-slate-600 mb-3">File uploaded successfully</p>
                                    <a href={viewingCoa.fileData} download={viewingCoa.fileName} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase"><Download size={14}/> Download File</a>
                                </div>
                            )
                        ) : (
                            <div className="text-center py-10">
                                <FileText size={48} className="mx-auto mb-4 text-slate-200" />
                                <p className="text-sm font-bold text-slate-400">No file attached to this record</p>
                            </div>
                        )}
                        <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Record Details</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px]">
                                {!isFCM && <div><span className="text-slate-400 font-bold block">Batch #</span><span className="text-slate-800 font-black">{viewingCoa.batchNumber}</span></div>}
                                {!isFCM && <div><span className="text-slate-400 font-bold block">Mfg Date</span><span className="text-slate-800 font-black">{viewingCoa.manufacturingDate}</span></div>}
                                <div><span className="text-slate-400 font-bold block">Expiry Date</span><span className="text-slate-800 font-black">{viewingCoa.expiryDate}</span></div>
                                <div><span className="text-slate-400 font-bold block">Testing Date</span><span className="text-slate-800 font-black">{viewingCoa.testingDate}</span></div>
                                <div><span className="text-slate-400 font-bold block">Uploaded By</span><span className="text-slate-800 font-black">{viewingCoa.uploadedBy}</span></div>
                                <div><span className="text-slate-400 font-bold block">Uploaded At</span><span className="text-slate-800 font-black">{viewingCoa.uploadedAt}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="border-t px-6 py-3 flex justify-end shrink-0">
                        <button onClick={() => setViewingCoa(null)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Back</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
         <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">{certLabel} Management</h3>
                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-1">{material?.name || 'Material'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors"><X size={20}/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {material?.brands?.length > 0 && (
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Select Brand</label>
                            <div className="flex flex-wrap gap-2">
                                {material.brands.map((b: any) => (
                                    <button key={b.id} onClick={() => setSelectedBrandId(b.id)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${selectedBrandId === b.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                        {b.name}
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] ${b.coaStatus === 'Valid' ? 'bg-emerald-100 text-emerald-700' : b.coaStatus === 'Expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{b.coaStatus}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedBrand && (
                        <>
                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{certLabel} Status</span>
                                    <select value={selectedBrand.coaStatus} onChange={e => handleUpdateStatus(selectedBrandId, e.target.value)} className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500">
                                        <option value="Valid">Valid</option>
                                        <option value="Expired">Expired</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Not Attached">Not Attached</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                    <div className="bg-white rounded-xl p-3 border">
                                        <span className="text-slate-400 font-bold uppercase">Testing Date</span>
                                        <p className="text-slate-800 font-black mt-1">{selectedBrand.testingDate || '-'}</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3 border">
                                        <span className="text-slate-400 font-bold uppercase">Records</span>
                                        <p className="text-slate-800 font-black mt-1">{selectedBrand.coaRecords?.length || 0} files</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Add New {certLabel} Record</span>
                                <div className={`grid ${isFCM ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'} gap-3`}>
                                    {!isFCM && <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Batch Number*</label>
                                        <input value={newBatch} onChange={e => setNewBatch(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" placeholder="BN-001" />
                                    </div>}
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Status</label>
                                        <select value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500">
                                            <option value="Valid">Valid</option>
                                            <option value="Expired">Expired</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                    </div>
                                    {!isFCM && <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Manufacturing Date</label>
                                        <input type="date" value={newMfg} onChange={e => setNewMfg(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                    </div>}
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">{isFCM ? 'Validity Period (from Testing Date)*' : 'Expiry Date*'}</label>
                                        {isFCM ? (
                                            <div className="flex gap-1.5">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={expiryNum}
                                                    onChange={e => setExpiryNum(e.target.value)}
                                                    className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500 text-center"
                                                    placeholder="3"
                                                />
                                                <select 
                                                    value={expiryUnit}
                                                    onChange={e => setExpiryUnit(e.target.value as any)}
                                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                                                >
                                                    <option value="Days">Days</option>
                                                    <option value="Months">Months</option>
                                                    <option value="Years">Years</option>
                                                </select>
                                            </div>
                                        ) : (
                                            <input type="date" value={newExp} onChange={e => setNewExp(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Upload {certLabel} Document</label>
                                    <div className="flex items-center gap-3">
                                        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileUpload} className="hidden" />
                                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-xs font-bold text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all">
                                            <Upload size={16} />
                                            {uploadedFileName ? uploadedFileName : 'Choose file (PDF, Image, Doc)'}
                                        </button>
                                        {uploadedFileName && (
                                            <button onClick={() => { setUploadedFileData(null); setUploadedFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                                                <X size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <button onClick={handleAddRecord} disabled={isFCM ? !expiryNum : (!newBatch || !newExp)} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Plus size={14}/> Add {certLabel} Record</button>
                            </div>

                            {selectedBrand.coaRecords?.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{certLabel} History ({selectedBrand.coaRecords.length} Records)</span>
                                    {selectedBrand.coaRecords.map((rec: CoaRecord) => (
                                        <div key={rec.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-3 shadow-sm hover:border-indigo-200 transition-all group">
                                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                                                {rec.fileData ? <FileCheck size={18} className="text-indigo-500" /> : <FileText size={18} className="text-slate-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 truncate">{rec.fileName}</p>
                                                <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-400">
                                                    {!isFCM && <span>Batch: {rec.batchNumber}</span>}
                                                    <span>Exp: {rec.expiryDate}</span>
                                                    <span>By: {rec.uploadedBy}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setViewingCoa(rec)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all" title="View COA">
                                                    <Eye size={16}/>
                                                </button>
                                                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${new Date(rec.expiryDate) > new Date() ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                                    {new Date(rec.expiryDate) > new Date() ? 'Valid' : 'Expired'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="border-t border-slate-100 px-6 py-4 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Done</button>
                </div>
            </div>
        </div>
    );
};

const VendorAssignmentModal = ({ onClose, onAssign, existingSuppliers }: { onClose: () => void, onAssign: (supplier: { id?: string; name: string }) => void, existingSuppliers: Array<{ id?: string; name: string }> }) => {
    const [vendorSearch, setVendorSearch] = useState('');
    const [selectedVendors, setSelectedVendors] = useState<Array<{ id?: string; name: string }>>([]);

    const filteredSuppliers = existingSuppliers.filter(s => s.name.toLowerCase().includes(vendorSearch.toLowerCase()));

    const handleToggle = (sup: { id?: string; name: string }) => {
        setSelectedVendors(prev => prev.some(v => v.name === sup.name) ? prev.filter(v => v.name !== sup.name) : [...prev, sup]);
    };

    const handleAssignAll = () => {
        selectedVendors.forEach(v => onAssign(v));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">Assign Vendors</h3>
                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-1">Search & select vendors</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                <div className="px-4 pt-4 pb-2 shrink-0">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendors..." className="w-full bg-transparent text-sm font-bold outline-none text-slate-800" autoFocus />
                        {vendorSearch && <button onClick={() => setVendorSearch('')} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>}
                    </div>
                </div>
                {selectedVendors.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                        {selectedVendors.map(v => (
                            <span key={v.name} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-100">
                                {v.name}
                                <button onClick={() => setSelectedVendors(prev => prev.filter(x => x.name !== v.name))} className="hover:text-rose-500"><X size={10}/></button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-1">
                    {filteredSuppliers.length === 0 ? (
                        <div className="py-10 text-center text-slate-300">
                            <Truck size={32} className="mx-auto mb-3 opacity-40" />
                            <p className="text-xs font-bold">{vendorSearch ? 'No matching vendors' : 'No vendors available'}</p>
                        </div>
                    ) : filteredSuppliers.map(s => {
                        const isSelected = selectedVendors.some(v => v.name === s.name);
                        return (
                            <button key={s.id || s.name} onClick={() => handleToggle(s)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all border ${isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                    {isSelected && <Check size={12} strokeWidth={3}/>}
                                </div>
                                <div className="text-left">
                                    <p className="text-slate-800 font-bold text-sm">{s.name}</p>
                                    {s.id && <p className="text-[9px] text-slate-400 font-semibold">ID: {s.id.substring(0, 12)}...</p>}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="border-t border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-400">{selectedVendors.length} selected</span>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                        <button disabled={selectedVendors.length === 0} onClick={handleAssignAll} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">Assign {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const isDescendantRM = (ancestorId: string, potentialDescendantId: string, allEntities: Entity[]): boolean => {
  let current = allEntities.find(e => e.id === potentialDescendantId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = allEntities.find(parent => parent.id === current?.parentId);
  }
  return false;
};

const RawMaterialListInner: React.FC<RawMaterialListProps> = ({ suppliers, entities, onUpdateEntity, userRootId, currentScope, onMaterialsChange, listType = 'ingredients', masterBrands: masterBrandsProp = [], onBrandsChange }) => {
  const [materials, setMaterials] = useState<RawMaterialExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(10);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterialExtended | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkSinkModalOpen, setIsBulkSinkModalOpen] = useState(false);
  const [activeOnboardMaterialId, setActiveOnboardMaterialId] = useState<string | null>(null);
  const [editingCommittedBrand, setEditingCommittedBrand] = useState<{ materialId: string, brand: MaterialBrand } | null>(null);
  const [coaTarget, setCoaTarget] = useState<{ materialId: string } | null>(null);
  const [vendorTarget, setVendorTarget] = useState<{ materialId: string, brandId: string } | null>(null);
  const [isCreatingNewMaster, setIsCreatingNewMaster] = useState(false);
  const [isAdvFilterOpen, setIsAdvFilterOpen] = useState(false);
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(INITIAL_ADV_FILTERS);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [materialSource, setMaterialSource] = useState<'own' | 'other'>('own');
  const [showPushedOnly, setShowPushedOnly] = useState(false);

  const corporateEntityId = useMemo(() => {
    let curr = entities.find(e => e.id === userRootId);
    while (curr) { if (curr.type === 'corporate') return curr.id; curr = entities.find(e => e.id === curr?.parentId); }
    return entities.find(e => e.type === 'corporate')?.id || null;
  }, [entities, userRootId]);

  // Both save paths route through the shared registry-save manager so the
  // RegistrySaveBadge surfaces Saving / Saved / Save failed / Newer server
  // version state for raw-material edits — same UX as recipes/ingredients.
  const persistMaterial = async (m: RawMaterialExtended) => {
    const { id, ...data } = m;
    const payload = { id, _type: listType, _corporateId: corporateEntityId, _unitId: userRootId, ...data };
    await postRegistry('raw-materials', '/api/raw-materials', payload);
  };

  const persistMaterials = async (ms: RawMaterialExtended[]) => {
    const payload = ms.map(m => {
      const { id, ...data } = m;
      return { id, _type: listType, _corporateId: corporateEntityId, _unitId: userRootId, ...data };
    });
    await postRegistry('raw-materials', '/api/raw-materials', payload);
  };

  const [rmReloadNonce, setRmReloadNonce] = useState(0);

  useEffect(() => {
    // Allow the registry-save badge "Reload" button to refetch from server
    // and discard any in-memory edits.
    setReloadHandler('raw-materials', () => setRmReloadNonce(n => n + 1));
    return () => setReloadHandler('raw-materials', null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const corpParam = corporateEntityId ? `&corporateId=${encodeURIComponent(corporateEntityId)}` : '';
        const res = await fetch(`/api/raw-materials?type=${listType}${corpParam}`);
        const records = await res.json();
        if (!cancelled) {
          const allRecords = Array.isArray(records) ? records : [];
          // Capture the freshest server timestamp so subsequent saves can
          // do optimistic conflict detection.
          noteMaxFromRecords('raw-materials', allRecords);
          let filtered: any[];
          if (currentScope === 'super-admin') {
            filtered = allRecords;
          } else if (currentScope === 'unit' || currentScope === 'department') {
            if (corporateEntityId) {
              const inCorp = allRecords.filter((m: any) =>
                m.createdByEntityId && isDescendantRM(corporateEntityId, m.createdByEntityId, entities)
              );
              const dedup = new Map<string, any>();
              for (const m of inCorp) {
                const key = (m.name || '').trim().toUpperCase();
                const existing = dedup.get(key);
                if (!existing) { dedup.set(key, m); }
                else {
                  const isOwn = m.createdByEntityId === userRootId;
                  const isAdopted = (m.adoptedByUnitIds || []).includes(userRootId);
                  const existingIsOwn = existing.createdByEntityId === userRootId;
                  const existingIsAdopted = (existing.adoptedByUnitIds || []).includes(userRootId);
                  if ((isOwn && !existingIsOwn) || (isAdopted && !existingIsOwn && !existingIsAdopted)) {
                    dedup.set(key, m);
                  }
                }
              }
              filtered = Array.from(dedup.values());
            } else {
              filtered = allRecords.filter((m: any) => m.createdByEntityId === userRootId);
            }
          } else {
            const scoped = allRecords.filter((m: any) =>
              m.createdByEntityId && userRootId && isDescendantRM(userRootId, m.createdByEntityId, entities)
            );
            const dedup = new Map<string, any>();
            for (const m of scoped) {
              const key = (m.name || '').trim().toUpperCase();
              const existing = dedup.get(key);
              if (!existing) { dedup.set(key, m); }
              else if (m.createdByEntityId === userRootId && existing.createdByEntityId !== userRootId) { dedup.set(key, m); }
            }
            filtered = Array.from(dedup.values());
          }
          setMaterials(filtered);
        }
      } catch (err) {
        console.error('Failed to load raw materials:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listType, currentScope, userRootId, entities, corporateEntityId, rmReloadNonce]);

  useEffect(() => {
    if (onMaterialsChange) onMaterialsChange(materials);
  }, [materials, onMaterialsChange]);
  const [auditTarget, setAuditTarget] = useState<{ materialId: string, brand: MaterialBrand } | null>(null);
  
  // Dashboard Filter State
  const [dashFilter, setDashFilter] = useState<{ cat: string, val: string } | null>(null);

  const corporateEntity = useMemo(() => {
    let curr = entities.find(e => e.id === userRootId);
    while (curr) { if (curr.type === 'corporate') return curr; curr = entities.find(e => e.id === curr?.parentId); }
    return entities.find(e => e.type === 'corporate');
  }, [entities, userRootId]);

  const masterBrands = useMemo(() => corporateEntity?.masterBrands || [], [corporateEntity]);

  // Use the global brands prop (same source as Brand tab) with fallback to entity-stored brands.
  // super-admin sees all brands; corporate/regional/unit see only brands from their corporate
  // (the prop is already scoped at fetch time) filtered further to their unit context.
  const contextAwareBrands = useMemo(() => {
    const pool = masterBrandsProp.length > 0 ? masterBrandsProp : masterBrands;
    if (currentScope === 'super-admin') return pool;   // super-admin: all brands
    return pool.filter((b: any) => {
      if (b.addedByUnitId === userRootId) return true;
      if ((b.adoptedByUnitIds || []).includes(userRootId)) return true;
      if (b.status === 'Active') return true;
      return false;
    });
  }, [masterBrandsProp, masterBrands, userRootId, currentScope]);

  const handleAddManualBrand = (name: string) => {
    if (!corporateEntity || !name.trim()) return;
    const userEntity = entities.find(e => e.id === userRootId);
    const isCorporateAdmin = currentScope === 'corporate' || currentScope === 'super-admin';
    const newBrand: Brand = {
      id: `B-${Date.now()}`,
      name: name.trim(),
      description: 'Manually added',
      status: isCorporateAdmin ? 'Active' : 'Provisional',
      addedByUnitId: userEntity?.id || 'system',
      addedByUnitName: userEntity?.name || 'Unit',
      addedByUserName: userEntity?.contactPerson || 'Current User',
      createdAt: new Date().toISOString().split('T')[0]
    };
    onUpdateEntity({ ...corporateEntity, masterBrands: [newBrand, ...masterBrands] });
    if (onBrandsChange) {
      onBrandsChange([newBrand, ...masterBrandsProp]);
    }
    void postRegistry('brands', '/api/brands', { ...newBrand, corporateId: corporateEntity.id });
  };

  const brandMetadata = useMemo(() => {
    const meta: Record<string, { status: string, unitName: string }> = {};
    contextAwareBrands.forEach(b => {
        meta[b.name] = { status: b.status, unitName: b.addedByUnitName };
    });
    return meta;
  }, [contextAwareBrands]);

  const unitSuppliers = useMemo(() => {
    return suppliers.filter(s => s.status === 'Active');
  }, [suppliers]);

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedRows(newSet);
  };

  const toggleSelectItem = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedItems(newSet);
  };

  const updateMaterial = (id: string, updates: Partial<RawMaterialExtended>) => {
    setMaterials(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, ...updates } : m);
      const changed = updated.find(m => m.id === id);
      if (changed) persistMaterial(changed);
      return updated;
    });
  };

  const toggleBrandStatus = (materialId: string, brandId: string) => {
    setMaterials(prev => {
      const updated = prev.map(m => {
        if (m.id !== materialId) return m;
        return { ...m, brands: m.brands.map(b => b.id !== brandId ? b : { ...b, status: b.status === 'Active' ? 'Inactive' : 'Active' as any }) };
      });
      const changed = updated.find(m => m.id === materialId);
      if (changed) persistMaterial(changed);
      return updated;
    });
  };

  const toggleSupplierStatus = (materialId: string, brandId: string, supplierName: string) => {
    setMaterials(prev => {
      const updated = prev.map(m => {
        if (m.id !== materialId) return m;
        return { ...m, brands: m.brands.map(b => b.id !== brandId ? b : { ...b, linkedSuppliers: b.linkedSuppliers.map(s => s.name !== supplierName ? s : { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' as any }) }) };
      });
      const changed = updated.find(m => m.id === materialId);
      if (changed) persistMaterial(changed);
      return updated;
    });
  };

  const handleDeleteBrand = (materialId: string, brandId: string) => {
    if (!confirm('Remove this brand from the material?')) return;
    setMaterials(prev => {
      const updated = prev.map(m => {
        if (m.id !== materialId) return m;
        return { ...m, brands: m.brands.filter(b => b.id !== brandId) };
      });
      const changed = updated.find(m => m.id === materialId);
      if (changed) persistMaterial(changed);
      return updated;
    });
  };

  const handleDeleteSupplier = (materialId: string, brandId: string, supplierName: string) => {
    setMaterials(prev => {
      const updated = prev.map(m => {
        if (m.id !== materialId) return m;
        return { ...m, brands: m.brands.map(b => b.id !== brandId ? b : { ...b, linkedSuppliers: b.linkedSuppliers.filter(s => s.name !== supplierName) }) };
      });
      const changed = updated.find(m => m.id === materialId);
      if (changed) persistMaterial(changed);
      return updated;
    });
  };

  const handleVendorLink = (materialId: string, brandId: string, supplier: { id?: string; name: string }) => {
    setMaterials(prev => {
      const updated = prev.map(m => {
        if (m.id !== materialId) return m;
        return { ...m, brands: m.brands.map(b => b.id !== brandId ? b : { ...b, linkedSuppliers: [...b.linkedSuppliers.filter(s => s.name !== supplier.name), { id: supplier.id, name: supplier.name, status: 'Active' as const }] }) };
      });
      const changed = updated.find(m => m.id === materialId);
      if (changed) persistMaterial(changed);
      return updated;
    });
    setVendorTarget(null);
  };

  const handleAdoptMaterial = async (materialId: string) => {
    if (!userRootId) return;
    try {
      await fetch('/api/raw-materials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: materialId, unitId: userRootId }),
      });
      setMaterials(prev => prev.map(m => m.id === materialId
        ? { ...m, adoptedByUnitIds: [...((m as any).adoptedByUnitIds || []), userRootId] }
        : m
      ));
    } catch (err) {
      console.error('Failed to adopt material:', err);
    }
  };

  const handleUpdateMaterial = (data: any) => {
    if (editingMaterial?.id) {
      setMaterials(prev => {
        const updated = prev.map(m => m.id === editingMaterial.id ? { ...m, ...data, updatedOn: new Date().toISOString().split('T')[0] } : m);
        const changed = updated.find(m => m.id === editingMaterial.id);
        if (changed) persistMaterial(changed);
        return updated;
      });
    } else {
        const prefix = listType === 'fcm' ? 'FCM' : 'RM';
        const _now = new Date().toISOString().split('T')[0];
        const newRM: RawMaterialExtended = { id: `${prefix}-${Date.now()}`, ...data, organization: entities.find(e => e.id === userRootId)?.name || 'Central', createdOn: _now, updatedOn: _now, uploadedBy: 'Current User', riskActive: true, yield: data.yield ?? false, stockable: data.stockable ?? false, vendors: [], brands: [], isActive: true, createdByEntityId: userRootId || 'system', createdByScope: currentScope, specifications: [] };
        setMaterials(prev => [newRM, ...prev]);
        persistMaterial(newRM);
    }
    setEditingMaterial(null);
  };

  const handleBulkUploadCommit = (rows: BulkImportPartial[]) => {
    const prefix = listType === 'fcm' ? 'FCM' : 'RM';
    const today = new Date().toISOString().split('T')[0];
    const allBrandsPool = masterBrandsProp.length > 0 ? masterBrandsProp : masterBrands;
    const orgName = entities.find(e => e.id === userRootId)?.name || 'Central';

    const materialMap = new Map<string, { suggestedName: string; vendors: Set<string>; brandMap: Map<string, { details: Record<string, string>; suppliers: Map<string, { id?: string; name: string }> }> }>();

    for (const row of rows) {
      const d = row.details;
      const matKey = row.suggestedName.toUpperCase();
      const csvBrandName = (d['Brand Name'] || '').trim();
      const csvSupplierName = (d['Supplier Name'] || '').trim();
      const vendorName = csvSupplierName;

      if (!materialMap.has(matKey)) {
        materialMap.set(matKey, { suggestedName: row.suggestedName, vendors: new Set(), brandMap: new Map() });
      }
      const matEntry = materialMap.get(matKey)!;
      if (vendorName) matEntry.vendors.add(vendorName);

      const matchedBrand = csvBrandName
        ? allBrandsPool.find((b: any) => b.name?.toUpperCase() === csvBrandName.toUpperCase())
        : null;
      const resolvedBrandName = matchedBrand ? matchedBrand.name : csvBrandName.toUpperCase();
      const brandKey = (resolvedBrandName || matKey).toUpperCase();

      const hasBrandOrSupplier = csvBrandName || csvSupplierName;
      if (hasBrandOrSupplier) {
        if (!matEntry.brandMap.has(brandKey)) {
          matEntry.brandMap.set(brandKey, { details: d, suppliers: new Map() });
        }
        const brandEntry = matEntry.brandMap.get(brandKey)!;

        if (csvSupplierName) {
          const matchedSupplier = suppliers.find((s: any) => s.name?.toUpperCase() === csvSupplierName.toUpperCase());
          const supplierKey = (matchedSupplier?.name || csvSupplierName).toUpperCase();
          if (!brandEntry.suppliers.has(supplierKey)) {
            brandEntry.suppliers.set(supplierKey, {
              id: matchedSupplier?.id || undefined,
              name: matchedSupplier?.name || csvSupplierName.toUpperCase()
            });
          }
        }
      }
    }

    let idCounter = 0;
    const newRMs: RawMaterialExtended[] = [];

    materialMap.forEach((matEntry) => {
      const matBrands: MaterialBrand[] = [];

      matEntry.brandMap.forEach((brandEntry, brandKey) => {
        const d = brandEntry.details;
        const linkedSuppliers: { id?: string; name: string; status: 'Active' | 'Inactive' }[] = [];
        brandEntry.suppliers.forEach(sup => {
          linkedSuppliers.push({ id: sup.id, name: sup.name, status: 'Active' as const });
        });

        matBrands.push({
          id: `MB-${Date.now()}-${idCounter++}`,
          name: brandKey,
          status: 'Active',
          allergens: d['Allergen Information'] || '',
          storage: d['Storage Condition'] || '',
          shelfLife: d['Shelf Life'] || '',
          specialHandling: d['Special Handling'] || '',
          testingDate: '',
          coaStatus: (d['COA Status'] as any) || 'Not Attached',
          coaRecords: [],
          lastReceived: '',
          vendor: d['Supplier Name'] || '',
          linkedSuppliers,
          qtyAccRej: '',
          formE: '',
          reviewedOn: '',
          complianceStatus: 'Pending',
          nextReview: '',
          openPoints: 0,
          auditTrail: [],
          energy: d['Calories (kcal / 100g)'] || '',
          protein: d['Protein (g / 100g)'] || '',
          carb: d['Carbohydrates (g / 100g)'] || '',
          fat: d['Fat (g / 100g)'] || '',
          dietaryType: d['Dietary Type'] || '',
          nutritionPanelImages: d['NIP Photos (URLs)'] ? d['NIP Photos (URLs)'].split('\n').map((u: string) => u.trim()).filter(Boolean) : [],
        });
      });

      newRMs.push({
        id: `${prefix}-${Date.now()}-${idCounter++}`,
        name: matEntry.suggestedName.toUpperCase(),
        organization: orgName,
        createdOn: today,
        updatedOn: today,
        uploadedBy: 'Bulk Loader',
        accepted: false,
        risk: 'NA' as const,
        riskActive: true,
        yield: false,
        stockable: false,
        vendors: Array.from(matEntry.vendors),
        brands: matBrands,
        isActive: true,
        createdByEntityId: userRootId || 'system',
        createdByScope: currentScope,
        specifications: []
      });
    });

    setMaterials(prev => [...newRMs, ...prev]);
    persistMaterials(newRMs);
    setIsBulkModalOpen(false);
  };

  const handleAddNewBrandToMaterial = (queuedMappings: any[]) => {
    if (!activeOnboardMaterialId && !editingCommittedBrand) return;
    
    const matId = activeOnboardMaterialId || editingCommittedBrand?.materialId;
    if (!matId) return;

    if (editingCommittedBrand) {
        const updatedBrandData = queuedMappings[0];
        setMaterials(prev => {
            const updated = prev.map(m => {
                if (m.id !== matId) return m;
                return {
                    ...m,
                    brands: m.brands.map(b => b.id === editingCommittedBrand.brand.id ? { ...b, ...updatedBrandData } : b)
                };
            });
            const changed = updated.find(m => m.id === matId);
            if (changed) persistMaterial(changed);
            return updated;
        });
        setEditingCommittedBrand(null);
    } else {
        const defaultShelfLife = listType === 'fcm' ? '3 Years' : '6 Months';
        const newBrands: MaterialBrand[] = queuedMappings.map((m, idx) => ({ id: `B-${Date.now()}-${idx}-${Math.random().toString(36).substr(2,5)}`, name: m.name || 'Unknown', allergens: m.allergens || (listType === 'fcm' ? 'N/A' : 'None'), storage: m.storage || (listType === 'fcm' ? '' : 'Ambient Storage'), shelfLife: m.shelfLife || defaultShelfLife, dietaryType: m.dietaryType || (listType === 'fcm' ? undefined : 'Veg'), energy: m.energy || '0', protein: m.protein || '0', fat: m.fat || '0', carb: m.carb || '0', image: m.collageImage || m.image || m.logo || '', images: m.images || [], collageImage: m.collageImage || '', nutritionPanelImages: m.nutritionPanelImages || [], ingredientsLabelImages: m.ingredientsLabelImages || [], status: 'Active' as const, specialHandling: m.specialHandling || (listType === 'fcm' ? 'None' : '-'), testingDate: new Date().toISOString().split('T')[0], coaStatus: 'Pending', lastReceived: '-', vendor: 'UNASSIGNED', linkedSuppliers: [], qtyAccRej: '0/0', formE: '-', reviewedOn: '-', complianceStatus: 'Pending' as const, nextReview: '-', openPoints: 0, auditTrail: [] }));
        setMaterials(prev => {
            const updated = prev.map(m => m.id === matId ? { ...m, brands: [...newBrands, ...m.brands] } : m);
            const changed = updated.find(m => m.id === matId);
            if (changed) persistMaterial(changed);
            return updated;
        });
        setActiveOnboardMaterialId(null);
    }
  };

  const handleBulkSinkExecute = (targetId: string | null, newName?: string) => {
    const selectedList = materials.filter(m => selectedItems.has(m.id));
    if (selectedList.length === 0) return;

    // Logic Aggregation
    const riskPriority: Record<string, number> = { 'High': 4, 'Medium': 3, 'Low': 2, 'NA': 1 };
    let finalRisk: 'High' | 'Medium' | 'Low' | 'NA' = 'NA';
    let finalStockable = false;
    const allBrands: MaterialBrand[] = [];
    const allSpecs = new Set<string>();
    const allVendors = new Set<string>();

    selectedList.forEach(m => {
        if (riskPriority[m.risk] > riskPriority[finalRisk]) finalRisk = m.risk;
        if (m.stockable) finalStockable = true;
        
        m.brands.forEach(b => {
            if (!allBrands.some(existing => existing.name === b.name)) {
                allBrands.push(b);
            }
        });
        
        (m.specifications || []).forEach(s => allSpecs.add(s));
        (m.vendors || []).forEach(v => allVendors.add(v));
    });

    const now = new Date().toISOString().split('T')[0];

    let consolidatedItem: RawMaterialExtended | null = null;

    setMaterials(prev => {
        const remainingItems = prev.filter(m => !selectedItems.has(m.id));

        if (targetId) {
            const targetBase = selectedList.find(m => m.id === targetId) || prev.find(m => m.id === targetId);
            if (!targetBase) return prev;
            
            consolidatedItem = {
                ...targetBase,
                risk: finalRisk,
                stockable: finalStockable,
                brands: allBrands,
                specifications: Array.from(allSpecs),
                vendors: Array.from(allVendors),
                updatedOn: now,
                uploadedBy: 'Data Sync Hub'
            };
        } else if (newName) {
            const template = selectedList[0];
            consolidatedItem = {
                ...template,
                id: `RM-MASTER-${Date.now()}`,
                name: newName.toUpperCase(),
                organization: entities.find(e => e.id === userRootId)?.name || 'Corporate Registry',
                createdOn: now,
                updatedOn: now,
                uploadedBy: 'Registry Consolidation',
                accepted: false,
                risk: finalRisk,
                riskActive: true,
                yield: false,
                stockable: finalStockable,
                vendors: Array.from(allVendors),
                brands: allBrands,
                specifications: Array.from(allSpecs),
                isActive: true,
                createdByEntityId: userRootId || 'system',
                createdByScope: 'corporate'
            };
        } else {
            return prev;
        }

        return [consolidatedItem!, ...remainingItems];
    });

    if (consolidatedItem) {
      persistMaterial(consolidatedItem);
      selectedList.filter(m => m.id !== (consolidatedItem as RawMaterialExtended).id).forEach(m => {
        fetch('/api/raw-materials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) }).catch(() => {});
      });
    }

    setIsBulkSinkModalOpen(false);
    setSelectedItems(new Set());
    alert("Registry Synchronized: Selected SKU identities have been consolidated into the master profile.");
  };

  const hierarchyFilteredMaterials = useMemo(() => {
    if (currentScope === 'super-admin') return materials;
    // Super-admin global library: any row whose API-supplied
    // `_corporateId` is 'corp-acme' is part of the cross-corporate
    // global ingredient library and should be visible to every scope
    // regardless of who created it. The server-side merge already
    // injects these rows into non-corp-acme reads; this client filter
    // would otherwise drop them because `createdByEntityId` won't
    // descend from the viewer's corporate or unit. Partition them out
    // and re-attach after the per-scope hierarchy filter runs.
    const isGlobalLibraryRow = (m: any) => m && m._corporateId === 'corp-acme';
    const globalRows = materials.filter(isGlobalLibraryRow);
    const scopedSource = materials.filter(m => !isGlobalLibraryRow(m));
    const mergeAndDedup = (rows: RawMaterialExtended[]) => {
      const dedup = new Map<string, RawMaterialExtended>();
      const all = [...rows, ...globalRows];
      for (const m of all) {
        const key = (m.name || '').trim().toUpperCase();
        const existing = dedup.get(key);
        if (!existing) { dedup.set(key, m); continue; }
        // Prefer the viewer's own row over a global-library row of the
        // same name so any unit-level overrides keep winning.
        const isOwn = (m as any).createdByEntityId === userRootId;
        const existingIsOwn = (existing as any).createdByEntityId === userRootId;
        const existingIsGlobal = isGlobalLibraryRow(existing);
        if (isOwn && !existingIsOwn) dedup.set(key, m);
        else if (!isGlobalLibraryRow(m) && existingIsGlobal) dedup.set(key, m);
      }
      return Array.from(dedup.values());
    };
    if (currentScope === 'unit' || currentScope === 'department') {
      if (corporateEntityId) {
        const inCorp = scopedSource.filter(m =>
          (m as any).createdByEntityId && isDescendantRM(corporateEntityId, (m as any).createdByEntityId, entities)
        );
        return mergeAndDedup(inCorp);
      }
      const own = scopedSource.filter(m => (m as any).createdByEntityId === userRootId);
      return mergeAndDedup(own);
    }
    const scoped = scopedSource.filter(m =>
      (m as any).createdByEntityId && userRootId && isDescendantRM(userRootId, (m as any).createdByEntityId, entities)
    );
    return mergeAndDedup(scoped);
  }, [materials, currentScope, userRootId, entities, corporateEntityId]);

  const ownMaterialsCount = useMemo(() => {
    if (currentScope === 'super-admin' || currentScope === 'corporate' || currentScope === 'regional') return hierarchyFilteredMaterials.length;
    return hierarchyFilteredMaterials.filter(m => (m as any).createdByEntityId === userRootId || ((m as any).adoptedByUnitIds || []).includes(userRootId)).length;
  }, [hierarchyFilteredMaterials, currentScope, userRootId]);

  const otherMaterialsCount = useMemo(() => {
    if (currentScope === 'super-admin' || currentScope === 'corporate' || currentScope === 'regional') return 0;
    return hierarchyFilteredMaterials.filter(m => (m as any).createdByEntityId !== userRootId && !((m as any).adoptedByUnitIds || []).includes(userRootId)).length;
  }, [hierarchyFilteredMaterials, currentScope, userRootId]);

  const pushedMaterialsCount = useMemo(() => {
    if (currentScope === 'super-admin' || currentScope === 'corporate' || currentScope === 'regional') return 0;
    return hierarchyFilteredMaterials.filter(m => (m as any).createdByEntityId !== userRootId && ((m as any).adoptedByUnitIds || []).includes(userRootId)).length;
  }, [hierarchyFilteredMaterials, currentScope, userRootId]);

  const sourceFilteredMaterials = useMemo(() => {
    if (currentScope === 'super-admin' || currentScope === 'corporate' || currentScope === 'regional') return hierarchyFilteredMaterials;
    if (materialSource === 'own') {
      const ownList = hierarchyFilteredMaterials.filter(m => (m as any).createdByEntityId === userRootId || ((m as any).adoptedByUnitIds || []).includes(userRootId));
      if (showPushedOnly) return ownList.filter(m => (m as any).createdByEntityId !== userRootId);
      return ownList;
    }
    return hierarchyFilteredMaterials.filter(m => (m as any).createdByEntityId !== userRootId && !((m as any).adoptedByUnitIds || []).includes(userRootId));
  }, [hierarchyFilteredMaterials, materialSource, currentScope, userRootId, showPushedOnly]);

  const filteredMaterials = useMemo(() => {
    const searchLower = search.toLowerCase();
    return sourceFilteredMaterials.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchLower) || m.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;

        // Dashboard Filter
        if (dashFilter) {
            if (dashFilter.cat === 'coa') {
                const someValid = m.brands.some(b => b.coaStatus === 'Valid');
                const somePending = m.brands.some(b => b.coaStatus === 'Pending');
                const someExpired = m.brands.some(b => (b.coaRecords || []).some(r => new Date(r.expiryDate) < new Date()));
                if (dashFilter.val === 'Valid' && !someValid) return false;
                if (dashFilter.val === 'Pending' && !somePending) return false;
                if (dashFilter.val === 'Expired' && !someExpired) return false;
                if (dashFilter.val === 'Not Attached' && m.brands.every(b => !b.coaRecords || b.coaRecords.length === 0)) return false;
            }
            if (dashFilter.cat === 'risk') {
                if (m.risk !== dashFilter.val) return false;
            }
            if (dashFilter.cat === 'mapping') {
                if (dashFilter.val === 'Mapped' && m.brands.length === 0) return false;
                if (dashFilter.val === 'Not Mapped' && m.brands.length > 0) return false;
                if (dashFilter.val === 'No Visuals' && m.brands.every(b => !b.image)) return false;
            }
            if (dashFilter.cat === 'allergen') {
                const hasAllergens = m.brands.some(b => b.allergens && b.allergens !== 'None');
                if (dashFilter.val === 'Known' && !hasAllergens) return false;
                if (dashFilter.val === 'Zero' && hasAllergens) return false;
            }
            if (dashFilter.cat === 'storage') {
                if (!m.brands.some(b => b.storage === dashFilter.val)) return false;
            }
            if (dashFilter.cat === 'shelfLifeCat') {
                if (dashFilter.val === 'NA') {
                    if (!m.brands.every(b => { const sl = (b.shelfLife || '').trim().toLowerCase(); return !sl || sl === 'na' || sl === '-'; })) return false;
                } else {
                    if (!m.brands.some(b => (b.shelfLife || '').trim() === dashFilter.val)) return false;
                }
            }
            if (dashFilter.cat === 'handling') {
                if (dashFilter.val === 'None') {
                    if (!m.brands.every(b => !b.specialHandling || b.specialHandling === 'None' || b.specialHandling === '-')) return false;
                } else {
                    if (!m.brands.some(b => b.specialHandling === dashFilter.val)) return false;
                }
            }
        }

        // Advanced Global Filter
        if (advFilters.productName && !m.name.toLowerCase().includes(advFilters.productName.toLowerCase())) return false;
        if (advFilters.risk && !m.risk.toLowerCase().includes(advFilters.risk.toLowerCase())) return false;
        if (advFilters.vendorName && !m.vendors.some(v => v.toLowerCase().includes(advFilters.vendorName.toLowerCase()))) return false;
        if (advFilters.brandName && !m.brands.some(b => b.name.toLowerCase().includes(advFilters.brandName.toLowerCase()))) return false;
        if (advFilters.specification && !m.specifications?.some(s => s.toLowerCase().includes(advFilters.specification.toLowerCase()))) return false;

        // New Advanced Filters Logic
        if (advFilters.allergens.length > 0) {
            const hasAllergen = m.brands.some(b => 
                advFilters.allergens.some(a => (b.allergens || '').toLowerCase().includes(a.toLowerCase()))
            );
            if (!hasAllergen) return false;
        }

        if (advFilters.storage.length > 0) {
            const hasStorage = m.brands.some(b => 
                advFilters.storage.some(s => (b.storage || '').toLowerCase().includes(s.toLowerCase()))
            );
            if (!hasStorage) return false;
        }

        if (advFilters.handling.length > 0) {
            const hasHandling = m.brands.some(b => 
                advFilters.handling.some(h => (b.specialHandling || '').toLowerCase().includes(h.toLowerCase()))
            );
            if (!hasHandling) return false;
        }

        if (advFilters.coaStatus.length > 0) {
            const hasCoaStatus = m.brands.some(b => {
                 // Map UI status to logical check
                 if (advFilters.coaStatus.includes('Valid') && b.coaStatus === 'Valid') return true;
                 if (advFilters.coaStatus.includes('Pending') && b.coaStatus === 'Pending') return true;
                 if (advFilters.coaStatus.includes('Expired') && (b.coaRecords || []).some(r => new Date(r.expiryDate) < new Date())) return true;
                 if (advFilters.coaStatus.includes('Not Attached') && (!b.coaRecords || b.coaRecords.length === 0)) return true;
                 return false;
            });
            if (!hasCoaStatus) return false;
        }

        if (advFilters.hasNutrition) {
             const hasNutri = m.brands.some(b => {
                 const hasData = (b.energy && parseFloat(b.energy) > 0) || (b.protein && parseFloat(b.protein) > 0);
                 return hasData;
             });
             if (advFilters.hasNutrition === 'yes' && !hasNutri) return false;
             if (advFilters.hasNutrition === 'no' && hasNutri) return false;
        }

        if (advFilters.hasImage) {
             const hasImg = m.brands.some(b => !!b.image);
             if (advFilters.hasImage === 'yes' && !hasImg) return false;
             if (advFilters.hasImage === 'no' && hasImg) return false;
        }

        if (advFilters.refrigerateAfterOpening) {
            const val = m.brands.some(b => !!(b as any).refrigeratedAfterOpening);
            if (advFilters.refrigerateAfterOpening === 'yes' && !val) return false;
            if (advFilters.refrigerateAfterOpening === 'no' && val) return false;
        }

        if (advFilters.shelfLifeAfterOpening) {
            const val = m.brands.some(b => !!(b as any).shelfLifeAfterOpeningSpecified && (b as any).shelfLifeAfterOpeningText);
            if (advFilters.shelfLifeAfterOpening === 'yes' && !val) return false;
            if (advFilters.shelfLifeAfterOpening === 'no' && val) return false;
        }

        if (advFilters.complianceStatus) {
            const isCompliant = m.brands.some(b => (b as any).complianceStatus === 'Compliant');
            if (advFilters.complianceStatus === 'yes' && !isCompliant) return false;
            if (advFilters.complianceStatus === 'no' && isCompliant) return false;
        }

        if (advFilters.shelfLifeMin || advFilters.shelfLifeMax) {
            const min = advFilters.shelfLifeMin ? parseInt(advFilters.shelfLifeMin) : 0;
            const max = advFilters.shelfLifeMax ? parseInt(advFilters.shelfLifeMax) : Infinity;
            
            // Helper to parse shelf life days
            const getDays = (sl: string | undefined) => {
                if (!sl || sl === '-') return 0;
                const match = sl.match(/(\d+)\s*Days/i);
                return match ? parseInt(match[1]) : 0;
            };

            const inRange = m.brands.some(b => {
                const days = getDays(b.shelfLife);
                return days >= min && days <= max;
            });
            if (!inRange) return false;
        }

        return true;
    });
  }, [sourceFilteredMaterials, search, dashFilter, advFilters]);

  // Sort newest-first so freshly added/copied/imported ingredients land at
  // the top of the list. We try several keys in order:
  //   1. createdOn (set by every new add/import/merge path below)
  //   2. updatedOn (covers older rows that only ever got an updatedOn stamp)
  //   3. The trailing Date.now() suffix on prefixed IDs like
  //      "RM-1714000000000" / "FCM-1714000000000-3" / "RM-MASTER-...".
  //      We extract the longest run of digits (>=11 chars to skip the
  //      legacy "RM-101" / "FCM-101" seed-data IDs) so true millis-based
  //      IDs sort newest-first while seed rows fall to the bottom in a
  //      stable order.
  const sortedFilteredMaterials = useMemo(() => {
    const stamp = (m: any): string => {
      const c = (m?.createdOn || '').toString();
      if (c) return c;
      const u = (m?.updatedOn || '').toString();
      if (u) return u;
      return '';
    };
    const idMillis = (m: any): number => {
      const id = (m?.id ?? '').toString();
      // Match the longest digit run; require >= 11 digits so a Date.now()
      // millis (currently 13 digits) wins, but small seed IDs like "101"
      // are ignored.
      const matches = id.match(/\d{11,}/g);
      if (!matches || !matches.length) return 0;
      return Number(matches[matches.length - 1]) || 0;
    };
    return [...filteredMaterials].sort((a: any, b: any) => {
      const sa = stamp(a);
      const sb = stamp(b);
      if (sa && sb && sa !== sb) return sb.localeCompare(sa);
      if (sa && !sb) return -1;
      if (!sa && sb) return 1;
      return idMillis(b) - idMillis(a);
    });
  }, [filteredMaterials]);

  // Dynamic Dashboard Counts (based on active sub-tab)
  const dashCounts = useMemo(() => {
    const counts = {
        coa: { valid: 0, expired: 0, pending: 0, missing: 0 },
        risk: { high: 0, medium: 0, low: 0, na: 0 },
        mapping: { mapped: 0, unmapped: 0, visuals: 0, noVisuals: 0 },
        allergen: { known: 0, zero: 0 },
        storage: {} as Record<string, number>,
        shelfLife: {} as Record<string, number>,
        handling: {} as Record<string, number>
    };
    
    sourceFilteredMaterials.forEach(m => {
        if (m.brands.some(b => b.coaStatus === 'Valid')) counts.coa.valid++;
        if (m.brands.some(b => (b.coaRecords || []).some(r => new Date(r.expiryDate) < new Date()))) counts.coa.expired++;
        if (m.brands.some(b => b.coaStatus === 'Pending')) counts.coa.pending++;
        if (m.brands.every(b => !b.coaRecords || b.coaRecords.length === 0)) counts.coa.missing++;

        if (m.risk === 'High') counts.risk.high++;
        else if (m.risk === 'Medium') counts.risk.medium++;
        else if (m.risk === 'Low') counts.risk.low++;
        else counts.risk.na++;

        if (m.brands.length > 0) counts.mapping.mapped++; else counts.mapping.unmapped++;
        if (m.brands.some(b => b.image)) counts.mapping.visuals++; else counts.mapping.noVisuals++;

        if (m.brands.some(b => b.allergens && b.allergens !== 'None')) counts.allergen.known++;
        else counts.allergen.zero++;

        const storageSet = new Set<string>();
        const shelfLifeSet = new Set<string>();
        const handlingSet = new Set<string>();
        m.brands.forEach(b => {
            if (b.storage) storageSet.add(b.storage);
            if (b.shelfLife) {
                const sl = (b.shelfLife || '').trim();
                if (!sl || sl === '-' || sl.toLowerCase() === 'na') shelfLifeSet.add('NA');
                else shelfLifeSet.add(sl);
            }
            if (b.specialHandling && b.specialHandling !== 'None' && b.specialHandling !== '-') handlingSet.add(b.specialHandling);
        });
        storageSet.forEach(s => { counts.storage[s] = (counts.storage[s] || 0) + 1; });
        if (shelfLifeSet.size === 0) shelfLifeSet.add('NA');
        shelfLifeSet.forEach(s => { counts.shelfLife[s] = (counts.shelfLife[s] || 0) + 1; });
        if (handlingSet.size === 0) handlingSet.add('None');
        handlingSet.forEach(h => { counts.handling[h] = (counts.handling[h] || 0) + 1; });
    });

    return counts;
  }, [sourceFilteredMaterials]);

  const perPageNum = itemsPerPage === 'All' ? sortedFilteredMaterials.length : itemsPerPage;

  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * perPageNum;
    return sortedFilteredMaterials.slice(start, start + perPageNum);
  }, [sortedFilteredMaterials, currentPage, perPageNum]);

  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedFilteredMaterials.length / itemsPerPage);

  const toggleDashFilter = (cat: string, val: string) => {
    if (dashFilter?.cat === cat && dashFilter?.val === val) setDashFilter(null);
    else setDashFilter({ cat, val });
    setCurrentPage(1);
  };

  const hasActiveAdvFilters = useMemo(() => {
    return JSON.stringify(advFilters) !== JSON.stringify(INITIAL_ADV_FILTERS);
  }, [advFilters]);

  // --- EXCEL EXPORT LOGIC ---

  const fetchImageBuffer = async (url: string): Promise<{ buffer: ArrayBuffer; ext: 'jpeg' | 'png' } | null> => {
    try {
      if (url.startsWith('data:')) {
        const mime = url.split(';')[0].split(':')[1] || 'image/jpeg';
        const ext: 'jpeg' | 'png' = mime === 'image/png' ? 'png' : 'jpeg';
        const base64 = url.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return { buffer: bytes.buffer, ext };
      }
      const response = await fetch(url);
      const blob = await response.blob();
      const ext: 'jpeg' | 'png' = blob.type === 'image/png' ? 'png' : 'jpeg';
      return { buffer: await blob.arrayBuffer(), ext };
    } catch (error) {
      console.error("Failed to fetch image for excel export", error);
      return null;
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
        if (filteredMaterials.length === 0) {
            alert("No records found for the current filter. Export cancelled.");
            setIsExportingExcel(false);
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Raw Materials Registry");

        worksheet.columns = [
            { header: "Sl No", key: "sl_no", width: 8 },
            { header: "Dietary Type", key: "dietaryType", width: 14 },
            { header: "Raw Material Name", key: "name", width: 30 },
            { header: "Brand Image", key: "image", width: 22 },
            { header: "Brand Name", key: "brand", width: 22 },
            { header: "Supplier Name", key: "vendor", width: 22 },
            { header: "COA Status", key: "coaStatus", width: 14 },
            { header: "Allergen Information", key: "allergens", width: 30 },
            { header: "Storage Condition", key: "storage", width: 25 },
            { header: "Risk Category", key: "risk", width: 14 },
            { header: "Stockable", key: "stockable", width: 12 },
            { header: "Yield", key: "yield", width: 12 },
            { header: "Specifications", key: "spec", width: 35 },
            { header: "Shelf Life", key: "shelfLife", width: 14 },
            { header: "Special Handling", key: "instruction", width: 25 },
            { header: "Refrigerated After Opening", key: "refrigAfterOpen", width: 22 },
            { header: "Shelf Life After Opening", key: "shelfLifeAfterOpen", width: 22 },
            { header: "Calories (kcal / 100g)", key: "energy", width: 20 },
            { header: "Protein (g / 100g)", key: "protein", width: 18 },
            { header: "Fat (g / 100g)", key: "fat", width: 16 },
            { header: "Carbohydrates (g / 100g)", key: "carb", width: 22 },
            { header: "Total Sugar (g / 100g)", key: "totalSugar", width: 20 },
            { header: "Added Sugar (g / 100g)", key: "addedSugar", width: 20 },
            { header: "TSFA (g / 100g)", key: "saturatedFat", width: 18 },
            { header: "TMUFA (g / 100g)", key: "unsaturatedFat", width: 18 },
            { header: "TPUFA (g / 100g)", key: "polyunsaturatedFat", width: 18 },
            { header: "Trans Fat (g / 100g)", key: "transFat", width: 20 },
            { header: "Total Dietary Fiber (g / 100g)", key: "fiber", width: 24 },
            { header: "Cholesterol (mg / 100g)", key: "cholesterol", width: 22 },
            { header: "Sodium (mg / 100g)", key: "sodium", width: 20 },
            { header: "Ingredients Label", key: "ingredientsLabel", width: 28 },
            { header: "Nutrition Facts Panel", key: "nipPhotos", width: 28 },
            { header: "Compliance Status", key: "complianceStatus", width: 18 },
            { header: "Comments", key: "comments", width: 30 },
            { header: "Status", key: "status", width: 12 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;

        // Macro cols 18-21 — amber
        [18, 19, 20, 21].forEach(colNum => {
            const cell = headerRow.getCell(colNum);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        // Micro cols 22-29 — dark amber
        [22, 23, 24, 25, 26, 27, 28, 29].forEach(colNum => {
            const cell = headerRow.getCell(colNum);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        // Image + compliance cols 30-31 — dark brown / indigo
        [30, 31].forEach(colNum => {
            const cell = headerRow.getCell(colNum);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF78350F' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        [32, 33].forEach(colNum => {
            const cell = headerRow.getCell(colNum);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        const imgPadding = 30000;
        const imgW = 100;
        const imgH = 80;
        let slNo = 1;

        for (const item of filteredMaterials) {
            if (item.brands.length === 0) {
                const row = worksheet.addRow({
                    sl_no: slNo++,
                    dietaryType: 'N/A',
                    name: item.name,
                    image: '',
                    brand: 'NOT MAPPED',
                    vendor: 'UNASSIGNED',
                    coaStatus: 'N/A',
                    allergens: 'None',
                    storage: 'N/A',
                    risk: item.risk,
                    stockable: item.stockable ? 'Yes' : 'No',
                    yield: item.yield ? 'Yes' : 'No',
                    spec: (item.specifications || []).join(', ') || 'None',
                    shelfLife: '-',
                    instruction: '-',
                    refrigAfterOpen: '-',
                    shelfLifeAfterOpen: '-',
                    energy: '-',
                    protein: '-',
                    fat: '-',
                    carb: '-',
                    totalSugar: '-',
                    addedSugar: '-',
                    saturatedFat: '-',
                    unsaturatedFat: '-',
                    polyunsaturatedFat: '-',
                    transFat: '-',
                    fiber: '-',
                    cholesterol: '-',
                    sodium: '-',
                    ingredientsLabel: '-',
                    nipPhotos: '-',
                    complianceStatus: '-',
                    comments: '-',
                    status: item.isActive ? 'Active' : 'Inactive'
                });
                row.height = 90;
                row.alignment = { vertical: 'middle', wrapText: true };
            } else {
                for (const brand of item.brands) {
                    const refrigAfterOpen = (brand as any).refrigeratedAfterOpening === true ? 'Yes' : (brand as any).refrigeratedAfterOpening === false ? 'No' : '-';
                    const shelfLifeAfterOpen = (brand as any).shelfLifeAfterOpeningSpecified ? ((brand as any).shelfLifeAfterOpeningText || 'Specified') : '-';
                    const row = worksheet.addRow({
                        sl_no: slNo++,
                        dietaryType: brand.dietaryType || 'N/A',
                        name: item.name,
                        image: '',
                        brand: brand.name,
                        vendor: brand.vendor || 'UNASSIGNED',
                        coaStatus: brand.coaStatus,
                        allergens: (brand.allergens || 'None').split(',').map((a: string) => a.trim()).join('\n'),
                        storage: brand.storage || 'N/A',
                        risk: item.risk,
                        stockable: item.stockable ? 'Yes' : 'No',
                        yield: item.yield ? 'Yes' : 'No',
                        spec: (item.specifications || []).join(', ') || 'None',
                        shelfLife: brand.shelfLife || '-',
                        instruction: brand.specialHandling || '-',
                        refrigAfterOpen,
                        shelfLifeAfterOpen,
                        energy: brand.energy || 0,
                        protein: brand.protein || 0,
                        fat: brand.fat || 0,
                        carb: brand.carb || 0,
                        totalSugar: (brand as any).totalSugar ?? '-',
                        addedSugar: (brand as any).addedSugar ?? '-',
                        saturatedFat: (brand as any).saturatedFat ?? '-',
                        unsaturatedFat: (brand as any).unsaturatedFat ?? '-',
                        polyunsaturatedFat: (brand as any).polyunsaturatedFat ?? '-',
                        transFat: (brand as any).transFat ?? '-',
                        fiber: (brand as any).fiber ?? '-',
                        cholesterol: (brand as any).cholesterol ?? '-',
                        sodium: (brand as any).sodium ?? '-',
                        ingredientsLabel: '-',
                        nipPhotos: '-',
                        complianceStatus: (brand as any).complianceStatus || 'Pending',
                        comments: (brand as any).comments || '-',
                        status: brand.status
                    });
                    row.height = 90;
                    row.alignment = { vertical: 'middle', wrapText: true };

                    // Macro cols 18-21 — yellow highlight
                    (['energy','protein','fat','carb'] as const).forEach((key, i) => {
                        const cell = row.getCell(18 + i);
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
                        cell.font = { bold: true };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                    // Micro cols 22-29 — light amber highlight
                    for (let mc = 22; mc <= 29; mc++) {
                        const cell = row.getCell(mc);
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    }
                    // Image label cols 30-31
                    [30, 31].forEach(colNum => {
                        const cell = row.getCell(colNum);
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    });
                    const compCell = row.getCell(32);
                    const compStatus = (brand as any).complianceStatus || 'Pending';
                    compCell.font = { bold: true, color: { argb: compStatus === 'Compliant' ? 'FF16A34A' : compStatus === 'Not Compliant' ? 'FFDC2626' : 'FFD97706' } };
                    compCell.alignment = { vertical: 'middle', horizontal: 'center' };

                    const brandImg = brand.collageImage || brand.image || '';
                    if (brandImg) {
                        const imgData = await fetchImageBuffer(brandImg);
                        if (imgData) {
                            try {
                                const excelRow = row.number - 1;
                                const imageId = workbook.addImage({ buffer: imgData.buffer, extension: imgData.ext });
                                worksheet.addImage(imageId, {
                                    tl: { nativeCol: 3, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any,
                                    ext: { width: imgW, height: imgH },
                                    editAs: 'oneCell'
                                });
                            } catch (e) {
                                console.error("Brand image embedding failed", e);
                            }
                        }
                    }

                    const ingredientImages = (brand as any).ingredientsLabelImages || [];
                    if (ingredientImages.length > 0) {
                        row.getCell(30).value = ingredientImages.length > 1 ? `+${ingredientImages.length - 1} more` : '';
                        const ingData = await fetchImageBuffer(ingredientImages[0]);
                        if (ingData) {
                            try {
                                const excelRow = row.number - 1;
                                const ingId = workbook.addImage({ buffer: ingData.buffer, extension: ingData.ext });
                                worksheet.addImage(ingId, {
                                    tl: { nativeCol: 29, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any,
                                    ext: { width: imgW, height: imgH },
                                    editAs: 'oneCell'
                                });
                            } catch (e) {
                                console.error("Ingredients image embedding failed", e);
                            }
                        }
                    }

                    const nipImages = brand.nutritionPanelImages || [];
                    if (nipImages.length > 0) {
                        row.getCell(31).value = nipImages.length > 1 ? `+${nipImages.length - 1} more` : '';
                        const nipData = await fetchImageBuffer(nipImages[0]);
                        if (nipData) {
                            try {
                                const excelRow = row.number - 1;
                                const nipId = workbook.addImage({ buffer: nipData.buffer, extension: nipData.ext });
                                worksheet.addImage(nipId, {
                                    tl: { nativeCol: 30, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any,
                                    ext: { width: imgW, height: imgH },
                                    editAs: 'oneCell'
                                });
                            } catch (e) {
                                console.error("NIP image embedding failed", e);
                            }
                        }
                    }
                }
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `Raw_Material_Master_Registry_${new Date().toISOString().split('T')[0]}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Excel export failed", err);
    } finally {
        setIsExportingExcel(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const headers = [
      'Raw Material Name',
      'Dietary Type',
      'Brand Name',
      'Supplier Name',
      'COA Status',
      'Allergen Information',
      'Storage Condition',
      'Risk Category',
      'Stockable',
      'Specifications',
      'Shelf Life',
      'Special Handling',
      'Calories (kcal / 100g)',
      'Protein (g / 100g)',
      'Fat (g / 100g)',
      'Carbohydrates (g / 100g)',
      'Total Sugar (g / 100g)',
      'Added Sugar (g / 100g)',
      'TSFA (g / 100g)',
      'TMUFA (g / 100g)',
      'TPUFA (g / 100g)',
      'Trans Fat (g / 100g)',
      'Total Dietary Fiber (g / 100g)',
      'Cholesterol (mg / 100g)',
      'Sodium (mg / 100g)',
      'NIP Photos (URLs)'
    ].join(',') + '\n';
    const sampleRows = [
      'WHOLE MILK,Veg,AMUL,Fresh Dairy Co.,Attached,"Milk, Lactose",Chilled Storage (≤ 5°C),Medium Risk,Yes,Full cream milk,7 Days,Keep Refrigerated,65,3.3,4.8,3.6,4.7,0,2.8,1.7,0.1,0,0,14,40,https://example.com/milk_nip.jpg',
      'FROZEN CHICKEN BREAST,Non-Veg,SADIA,Poultry Hub LLC,Pending,None,Deep Frozen (≤ -18°C),High Risk,Yes,Individually frozen fillets,12 Months,Keep Frozen,110,23,0,1.5,0,0,0.4,0.6,0,0,0,85,75,',
      'EXTRA VIRGIN OLIVE OIL,Veg,BERTOLLI,Mediterranean Imports,Attached,None,Ambient Temperature,Low Risk,No,Cold pressed EVOO,24 Months,Protect from direct sunlight,884,0,0,100,0,0,14,73,1,0,0,0,2,',
      'ORGANIC TOMATOES,Veg,DEL MONTE,Farm Fresh Produce,Not Attached,None,Chilled Storage (≤ 5°C),Medium Risk,Yes,Grade A organic,5 Days,None,18,0.9,3.9,0.2,2.6,0,0,0,0,0,1.2,0,5,'
    ].join('\n');
    const blob = new Blob([headers + sampleRows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'raw_material_import_sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-20 px-2 sm:px-4 md:px-0 w-full overflow-hidden">
      
      {/* Compact Filter Dashboard */}
      <div className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory gap-1.5 md:grid md:grid-cols-2 xl:grid-cols-4 md:gap-2.5 mb-3 md:mb-4 md:overflow-visible pb-1.5 md:pb-0">
        <DashStrip title={`${listType === 'fcm' ? 'FGC' : 'COA'} Status`} icon={FileBadge} iconBg="bg-[#3b82f6]">
            <AnalyticChip onClick={() => toggleDashFilter('coa', 'Valid')} isActive={dashFilter?.cat === 'coa' && dashFilter?.val === 'Valid'} label="Valid" value={`${dashCounts.coa.valid}/${sourceFilteredMaterials.length}`} dotColor="bg-emerald-400" />
            <AnalyticChip onClick={() => toggleDashFilter('coa', 'Expired')} isActive={dashFilter?.cat === 'coa' && dashFilter?.val === 'Expired'} label="Expired" value={`${dashCounts.coa.expired}/${sourceFilteredMaterials.length}`} dotColor="bg-rose-400" />
            <AnalyticChip onClick={() => toggleDashFilter('coa', 'Pending')} isActive={dashFilter?.cat === 'coa' && dashFilter?.val === 'Pending'} label="Due" value={`${dashCounts.coa.pending}/${sourceFilteredMaterials.length}`} dotColor="bg-amber-400" />
            <AnalyticChip onClick={() => toggleDashFilter('coa', 'Not Attached')} isActive={dashFilter?.cat === 'coa' && dashFilter?.val === 'Not Attached'} label="Missing" value={`${dashCounts.coa.missing}/${sourceFilteredMaterials.length}`} dotColor="bg-slate-300" />
        </DashStrip>

        <DashStrip title="Risk Profile" icon={Shield} iconBg="bg-[#ef4444]">
            <AnalyticChip onClick={() => toggleDashFilter('risk', 'High')} isActive={dashFilter?.cat === 'risk' && dashFilter?.val === 'High'} label="High" value={`${dashCounts.risk.high}/${sourceFilteredMaterials.length}`} dotColor="bg-rose-400" />
            <AnalyticChip onClick={() => toggleDashFilter('risk', 'Medium')} isActive={dashFilter?.cat === 'risk' && dashFilter?.val === 'Medium'} label="Med" value={`${dashCounts.risk.medium}/${sourceFilteredMaterials.length}`} dotColor="bg-amber-400" />
            <AnalyticChip onClick={() => toggleDashFilter('risk', 'Low')} isActive={dashFilter?.cat === 'risk' && dashFilter?.val === 'Low'} label="Low" value={`${dashCounts.risk.low}/${sourceFilteredMaterials.length}`} dotColor="bg-emerald-400" />
            <AnalyticChip onClick={() => toggleDashFilter('risk', 'NA')} isActive={dashFilter?.cat === 'risk' && dashFilter?.val === 'NA'} label="N/A" value={`${dashCounts.risk.na}/${sourceFilteredMaterials.length}`} dotColor="bg-slate-300" />
        </DashStrip>

        <DashStrip title="Registry Mapping" icon={Layers} iconBg="bg-[#6366f1]">
            <AnalyticChip onClick={() => toggleDashFilter('mapping', 'Mapped')} isActive={dashFilter?.cat === 'mapping' && dashFilter?.val === 'Mapped'} label="Mapped" value={`${dashCounts.mapping.mapped}/${sourceFilteredMaterials.length}`} dotColor="bg-indigo-400" />
            <AnalyticChip onClick={() => toggleDashFilter('mapping', 'Visuals')} isActive={dashFilter?.cat === 'mapping' && dashFilter?.val === 'Visuals'} label="Visual" value={`${dashCounts.mapping.visuals}/${sourceFilteredMaterials.length}`} dotColor="bg-blue-400" />
            <AnalyticChip onClick={() => toggleDashFilter('mapping', 'Not Mapped')} isActive={dashFilter?.cat === 'mapping' && dashFilter?.val === 'Not Mapped'} label="Unmapped" value={`${dashCounts.mapping.unmapped}/${sourceFilteredMaterials.length}`} dotColor="bg-slate-300" />
            <AnalyticChip onClick={() => toggleDashFilter('mapping', 'No Visuals')} isActive={dashFilter?.cat === 'mapping' && dashFilter?.val === 'No Visuals'} label="No Vis" value={`${dashCounts.mapping.noVisuals}/${sourceFilteredMaterials.length}`} dotColor="bg-slate-300" />
        </DashStrip>

        {listType !== 'fcm' && <DashStrip title="Allergens" icon={FlaskConical} iconBg="bg-[#f97316]">
            <AnalyticChip onClick={() => toggleDashFilter('allergen', 'Known')} isActive={dashFilter?.cat === 'allergen' && dashFilter?.val === 'Known'} label="Known" value={`${dashCounts.allergen.known}/${sourceFilteredMaterials.length}`} dotColor="bg-rose-400" />
            <AnalyticChip onClick={() => toggleDashFilter('allergen', 'Zero')} isActive={dashFilter?.cat === 'allergen' && dashFilter?.val === 'Zero'} label="Zero" value={`${dashCounts.allergen.zero}/${sourceFilteredMaterials.length}`} dotColor="bg-emerald-400" />
        </DashStrip>}

        {listType !== 'fcm' && <DashStrip title="Storage" icon={Thermometer} iconBg="bg-[#0ea5e9]">
            {Object.entries(dashCounts.storage).length > 0 ? Object.entries(dashCounts.storage).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => (
                <AnalyticChip key={key} onClick={() => toggleDashFilter('storage', key)} isActive={dashFilter?.cat === 'storage' && dashFilter?.val === key} label={key.length > 14 ? key.substring(0, 12) + '…' : key} value={`${count}/${sourceFilteredMaterials.length}`} dotColor="bg-cyan-400" />
            )) : (
                <span className="text-[10px] text-slate-300 px-2">No data</span>
            )}
        </DashStrip>}

        <DashStrip title="Shelf Life" icon={Clock} iconBg="bg-[#8b5cf6]">
            {Object.entries(dashCounts.shelfLife).length > 0 ? Object.entries(dashCounts.shelfLife).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => {
                const sl = key.toLowerCase();
                const dot = key === 'NA' ? 'bg-slate-300' : sl.includes('hour') ? 'bg-rose-400' : sl.includes('day') ? 'bg-amber-400' : sl.includes('month') ? 'bg-blue-400' : sl.includes('year') ? 'bg-emerald-400' : 'bg-violet-400';
                return (
                    <AnalyticChip key={key} onClick={() => toggleDashFilter('shelfLifeCat', key)} isActive={dashFilter?.cat === 'shelfLifeCat' && dashFilter?.val === key} label={key === 'NA' ? 'N/A' : key} value={`${count}/${sourceFilteredMaterials.length}`} dotColor={dot} />
                );
            }) : (
                <span className="text-[10px] text-slate-300 px-2">No data</span>
            )}
        </DashStrip>

        {listType !== 'fcm' && <DashStrip title="Special Handling" icon={AlertTriangle} iconBg="bg-[#f59e0b]">
            {Object.entries(dashCounts.handling).length > 0 ? Object.entries(dashCounts.handling).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([key, count]) => (
                <AnalyticChip key={key} onClick={() => toggleDashFilter('handling', key)} isActive={dashFilter?.cat === 'handling' && dashFilter?.val === key} label={key.length > 14 ? key.substring(0, 12) + '…' : key} value={`${count}/${sourceFilteredMaterials.length}`} dotColor={key === 'None' ? 'bg-slate-300' : 'bg-amber-400'} />
            )) : (
                <span className="text-[10px] text-slate-300 px-2">No data</span>
            )}
        </DashStrip>}

        <DashStrip title="Tools" icon={SettingsIcon} iconBg="bg-[#0f172a]">
            <button 
                onClick={() => { setDashFilter(null); setAdvFilters(INITIAL_ADV_FILTERS); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all text-[10px] md:text-[11px] font-bold uppercase tracking-wide ${(dashFilter || hasActiveAdvFilters) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100'}`}
            >
                {(dashFilter || hasActiveAdvFilters) ? <><X size={11} className="shrink-0" /> Clear Filters</> : <><Filter size={11} className="shrink-0" /> Filter</>}
            </button>
        </DashStrip>
      </div>

      <div className="bg-white p-4 lg:p-6 rounded-2xl md:rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden relative">
         <div className="absolute top-0 left-0 w-1.5 md:w-2 h-full bg-indigo-600" />
         
         <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 lg:gap-6 min-w-0">
                <div className="p-2.5 lg:p-4 bg-indigo-50 text-indigo-600 rounded-xl lg:rounded-3xl shadow-inner border border-indigo-100 shrink-0">
                   <Boxes size={20} className="md:w-7 md:h-7 lg:w-8 lg:h-8" />
                </div>
                <div className="min-w-0">
                   <h2 className="text-base md:text-lg lg:text-2xl font-black text-slate-900 tracking-tight leading-none uppercase truncate">Material Catalog</h2>
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Background-save badge for raw-material edits — surfaces
                    the debounced /api/raw-materials lifecycle with conflict
                    resolution, mirrors the recipes/ingredients pattern. */}
                <RegistrySaveBadge registryKey="raw-materials" hideWhenIdle label="raw materials" />
                {selectedItems.size > 1 && (
                    <button 
                      onClick={() => setIsBulkSinkModalOpen(true)}
                      className="px-3 py-2 md:px-4 md:py-2.5 bg-blue-600 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg animate-in zoom-in-95"
                    >
                       <Merge size={14} strokeWidth={3} /> <span className="hidden md:inline">Bulk</span> Sink
                    </button>
                )}
                {/* Import CSV split-button — same row as refresh/filter */}
                <div className="relative flex rounded-xl border border-slate-200 shadow-sm overflow-visible">
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 md:px-4 py-2 md:py-2.5 text-indigo-600 bg-white text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap border-r border-slate-200 rounded-l-xl"
                  >
                    <FileUp size={14} /> <span className="hidden sm:inline">Import</span>
                  </button>
                  <button
                    onClick={() => setShowImportMenu(v => !v)}
                    className="flex items-center justify-center px-2 py-2 bg-white text-slate-400 hover:text-indigo-600 transition-all active:scale-95 rounded-r-xl"
                    title="Download sample template"
                  >
                    <ChevronDown size={12} strokeWidth={2.5} />
                  </button>
                  {showImportMenu && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowImportMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden min-w-[170px]">
                      <button
                        onClick={() => { handleDownloadSampleCsv(); setShowImportMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
                      >
                        <Download size={13} className="text-slate-400" /> Download Template
                      </button>
                      <button
                        onClick={() => { setIsBulkModalOpen(true); setShowImportMenu(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95 border-t border-slate-100"
                      >
                        <FileUp size={13} /> Upload CSV File
                      </button>
                    </div>
                    </>
                  )}
                </div>
                {/* Refresh filter data */}
                <button 
                    onClick={() => { setDashFilter(null); setAdvFilters(INITIAL_ADV_FILTERS); setSearch(''); }}
                    title="Reset filters"
                    className="p-2 md:p-2.5 border-2 border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 rounded-xl transition-all active:scale-95"
                >
                   <RefreshCw size={15} strokeWidth={2.5} />
                </button>
                {/* Advanced filter */}
                <button 
                    onClick={() => setIsAdvFilterOpen(true)}
                    className={`p-2 md:p-2.5 border-2 rounded-xl transition-all active:scale-95 ${hasActiveAdvFilters ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                   <SlidersHorizontal size={15} strokeWidth={2.5} />
                </button>
                <button 
                    onClick={handleExportExcel} 
                    disabled={isExportingExcel}
                    className="p-2 md:p-2.5 border-2 border-slate-100 text-slate-400 bg-white rounded-xl transition-all active:scale-95 disabled:opacity-50"
                >
                   {isExportingExcel ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                </button>
            </div>
         </div>

         <div className="flex items-center gap-2 mt-3">
            <div className="relative group flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={15} />
               <input 
                 type="text" 
                 placeholder="Search SKU..." 
                 className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-inner uppercase tracking-wider"
                 value={search}
                 onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
               />
            </div>
            {/* Add SKU — hidden on mobile; FAB handles it */}
            <button 
              onClick={() => setIsCreatingNewMaster(true)}
              className="hidden md:flex px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider items-center justify-center gap-1.5 transition-all shadow-xl active:scale-95 whitespace-nowrap"
            >
              <Plus size={15} strokeWidth={3} /> Add SKU
            </button>
         </div>
      </div>

      {(currentScope === 'unit' || currentScope === 'department') && otherMaterialsCount > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              <button
                  onClick={() => { setMaterialSource('own'); setShowPushedOnly(false); setCurrentPage(1); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${materialSource === 'own' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <Building2 size={12} /> My Unit <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${materialSource === 'own' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>{ownMaterialsCount}</span>
              </button>
              <button
                  onClick={() => { setMaterialSource('other'); setShowPushedOnly(false); setCurrentPage(1); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${materialSource === 'other' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <Globe size={12} /> Other Units <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${materialSource === 'other' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>{otherMaterialsCount}</span>
              </button>
          </div>
          {materialSource === 'own' && pushedMaterialsCount > 0 && (
            <button
                onClick={() => { setShowPushedOnly(prev => !prev); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 ${showPushedOnly ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-amber-300 text-amber-600 hover:bg-amber-50'}`}
            >
                <ArrowRight size={12} />
                {showPushedOnly ? 'Showing: Pushed from Other Units' : 'Filter: Pushed from Other Units'}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${showPushedOnly ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>{pushedMaterialsCount}</span>
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 text-center bg-white rounded-2xl md:rounded-[3rem] border-2 border-dashed border-slate-100">
            <Loader2 size={36} className="mx-auto mb-3 animate-spin text-indigo-400" />
            <p className="text-xs md:text-sm font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-slate-400">Loading materials…</p>
          </div>
        ) : (
        <>
        {paginatedMaterials.map((item, idx) => {
          const isOwnMaterial = (item as any).createdByEntityId === userRootId;
          const isAdopted = ((item as any).adoptedByUnitIds || []).includes(userRootId);
          const originUnit = !isOwnMaterial ? entities.find(e => e.id === (item as any).createdByEntityId) : null;
          return (
          <MaterialRow 
            key={item.id}
            item={item}
            serialNumber={idx + 1 + (currentPage - 1) * (itemsPerPage === 'All' ? 0 : (itemsPerPage as number))}
            isExpanded={expandedRows.has(item.id)}
            onToggle={() => toggleRow(item.id)}
            isSelected={selectedItems.has(item.id)}
            onSelectToggle={() => toggleSelectItem(item.id)}
            onUpdate={updateMaterial}
            onEdit={() => setEditingMaterial(item)}
            onCoa={() => setCoaTarget({ materialId: item.id })}
            onOnboard={() => setActiveOnboardMaterialId(item.id)}
            onMerge={() => { setSelectedItems(new Set([item.id])); setIsBulkSinkModalOpen(true); }}
            onEditBrand={(brand) => setEditingCommittedBrand({ materialId: item.id, brand })}
            onAudit={(brand) => setAuditTarget({ materialId: item.id, brand })}
            onToggleBrand={(bid) => toggleBrandStatus(item.id, bid)}
            onDeleteBrand={(bid) => handleDeleteBrand(item.id, bid)}
            onAddVendor={(bid) => setVendorTarget({ materialId: item.id, brandId: bid })}
            onToggleSupplier={(bid, sname) => toggleSupplierStatus(item.id, bid, sname)}
            onDeleteSupplier={(bid, sname) => handleDeleteSupplier(item.id, bid, sname)}
            listType={listType}
            originUnitName={originUnit?.name}
            isAdopted={isAdopted}
            onMigrate={!isOwnMaterial && !isAdopted && (currentScope === 'unit' || currentScope === 'department') ? () => handleAdoptMaterial(item.id) : undefined}
          />
          );
        })}
        {paginatedMaterials.length === 0 && (
            <div className="py-12 md:py-20 text-center text-slate-300 bg-white rounded-2xl md:rounded-[3rem] border-2 border-dashed border-slate-100">
                <Search size={36} className="mx-auto mb-3 opacity-10 md:w-12 md:h-12" />
                <p className="text-xs md:text-sm font-black uppercase tracking-[0.1em] md:tracking-[0.2em] px-4">No materials match your criteria</p>
                <button onClick={() => { setSearch(''); setDashFilter(null); setAdvFilters(INITIAL_ADV_FILTERS); }} className="mt-3 text-indigo-600 font-bold uppercase text-[10px] hover:underline active:scale-95">Reset All Filters</button>
            </div>
        )}
        </>
        )}

        {/* Mobile Floating Action Button (FAB) */}
        <div className="md:hidden fixed bottom-24 right-6 z-50">
            <button 
                onClick={() => setIsCreatingNewMaster(true)}
                className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all border-4 border-white"
            >
                <Plus size={32} strokeWidth={3} />
            </button>
        </div>
      </div>

      {isCreatingNewMaster && <CreateMaterialModal onClose={() => setIsCreatingNewMaster(false)} onSave={handleUpdateMaterial} existingMaterials={materials} currentScope={currentScope} userRootId={userRootId} listType={listType} />}
      {editingMaterial && <CreateMaterialModal initialMaterial={editingMaterial} onClose={() => setEditingMaterial(null)} onSave={handleUpdateMaterial} existingMaterials={materials} currentScope={currentScope} userRootId={userRootId} listType={listType} />}
      
      {isBulkModalOpen && (
          <BulkUploadModal 
            onClose={() => setIsBulkModalOpen(false)} 
            onSave={handleBulkUploadCommit} 
            materials={materials}
            suppliers={suppliers}
            brands={masterBrandsProp.length > 0 ? masterBrandsProp : masterBrands}
          />
      )}

      {isBulkSinkModalOpen && <BulkSinkModal selectedItems={materials.filter(m => selectedItems.has(m.id))} allItems={materials} onClose={() => setIsBulkSinkModalOpen(false)} onExecute={handleBulkSinkExecute} />}
      {activeOnboardMaterialId && <BrandOnboardModal availableBrands={contextAwareBrands} onClose={() => setActiveOnboardMaterialId(null)} onFinalize={handleAddNewBrandToMaterial} brandMetadata={brandMetadata} listType={listType} onAddBrand={handleAddManualBrand} />}
      {editingCommittedBrand && <BrandOnboardModal initialCommittedBrand={editingCommittedBrand.brand} availableBrands={contextAwareBrands} onClose={() => setEditingCommittedBrand(null)} onFinalize={handleAddNewBrandToMaterial} brandMetadata={brandMetadata} listType={listType} onAddBrand={handleAddManualBrand} />}
      {coaTarget && <CoaManagementModal material={materials.find(m => m.id === coaTarget.materialId)!} materials={materials} onClose={() => setCoaTarget(null)} onUpdateBrands={(brands) => updateMaterial(coaTarget.materialId, { brands })} listType={listType} />}
      {vendorTarget && <VendorAssignmentModal existingSuppliers={unitSuppliers.map(s => ({ id: s.id, name: s.name }))} onClose={() => setVendorTarget(null)} onAssign={(sup) => handleVendorLink(vendorTarget.materialId, vendorTarget.brandId, sup)} />}
      
      {auditTarget && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">Brand Audit Trail</h3>
                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-1">{auditTarget.brand.name}</p>
                    </div>
                    <button onClick={() => setAuditTarget(null)} className="p-2 text-white/60 hover:text-white transition-colors"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                            <p className={`text-sm font-black mt-1 ${auditTarget.brand.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}`}>{auditTarget.brand.status}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">COA Status</span>
                            <p className={`text-sm font-black mt-1 ${auditTarget.brand.coaStatus === 'Valid' ? 'text-emerald-600' : auditTarget.brand.coaStatus === 'Expired' ? 'text-rose-600' : 'text-amber-600'}`}>{auditTarget.brand.coaStatus}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Testing</span>
                            <p className="text-sm font-black text-slate-700 mt-1">{auditTarget.brand.testingDate || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Next Review</span>
                            <p className="text-sm font-black text-slate-700 mt-1">{auditTarget.brand.nextReview || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Last Received</span>
                            <p className="text-sm font-black text-slate-700 mt-1">{auditTarget.brand.lastReceived || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Compliance</span>
                            <p className={`text-sm font-black mt-1 ${auditTarget.brand.complianceStatus === 'Compliant' ? 'text-emerald-600' : 'text-amber-600'}`}>{auditTarget.brand.complianceStatus || '-'}</p>
                        </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specifications</span>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="flex justify-between"><span className="text-slate-400 font-bold">Allergens</span><span className="font-black text-slate-700">{auditTarget.brand.allergens || 'None'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400 font-bold">Storage</span><span className="font-black text-slate-700 truncate max-w-[120px]">{auditTarget.brand.storage || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400 font-bold">Shelf Life</span><span className="font-black text-slate-700">{auditTarget.brand.shelfLife || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-400 font-bold">Handling</span><span className="font-black text-slate-700">{auditTarget.brand.specialHandling || '-'}</span></div>
                        </div>
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Linked Vendors</span>
                        {auditTarget.brand.linkedSuppliers.length === 0 ? (
                            <p className="text-xs text-slate-300 font-bold">No vendors linked</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {auditTarget.brand.linkedSuppliers.map((s, i) => (
                                    <span key={i} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border ${s.status === 'Active' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200 line-through'}`}>{s.name}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">COA Records ({auditTarget.brand.coaRecords?.length || 0})</span>
                        {(auditTarget.brand.coaRecords || []).length === 0 ? (
                            <p className="text-xs text-slate-300 font-bold">No COA records</p>
                        ) : (
                            <div className="space-y-2">
                                {auditTarget.brand.coaRecords.map((rec: CoaRecord) => (
                                    <div key={rec.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 p-3">
                                        <FileText size={16} className="text-indigo-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-slate-700 truncate">{rec.fileName}</p>
                                            <p className="text-[9px] text-slate-400 font-bold">{isFCM ? '' : `Batch: ${rec.batchNumber} | `}Exp: {rec.expiryDate}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${new Date(rec.expiryDate) > new Date() ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {new Date(rec.expiryDate) > new Date() ? 'Valid' : 'Expired'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border border-slate-100 rounded-2xl p-4 space-y-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Qty Accepted / Rejected</span>
                        <p className="text-lg font-black text-slate-800">{auditTarget.brand.qtyAccRej || '0/0'}</p>
                    </div>
                </div>
                <div className="border-t border-slate-100 px-6 py-4 flex justify-end shrink-0">
                    <button onClick={() => setAuditTarget(null)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Close</button>
                </div>
            </div>
        </div>
      )}

      {isAdvFilterOpen && (
          <AdvancedGlobalFilterModal 
            onClose={() => setIsAdvFilterOpen(false)}
            onApply={(f) => { setAdvFilters(f); setIsAdvFilterOpen(false); setCurrentPage(1); }}
            currentFilters={advFilters}
            totalRecords={filteredMaterials.length}
            brandMetadata={brandMetadata}
          />
      )}
      
      {filteredMaterials.length > 0 && (
        <div className="mt-4 md:mt-8 rounded-2xl md:rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMaterials.length}
            rowsPerPage={perPageNum}
            onPageChange={setCurrentPage}
            onRowsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </div>
      )}
    </div>
  );
};

// ─── Document Scanner: math helpers ──────────────────────────────────────────
function solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
        }
        [M[col], M[maxRow]] = [M[maxRow], M[col]];
        if (Math.abs(M[col][col]) < 1e-10) continue;
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const f = M[row][col] / M[col][col];
            for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k];
        }
    }
    return M.map((row, i) => row[n] / row[i]);
}

function buildHomography(src: [number, number][], dst: [number, number][]): number[][] {
    const A: number[][] = [], b: number[] = [];
    for (let i = 0; i < 4; i++) {
        const [sx, sy] = src[i], [dx, dy] = dst[i];
        A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]); b.push(dx);
        A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]); b.push(dy);
    }
    const h = solveLinearSystem(A, b);
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

async function processDocumentScan(
    imageUrl: string,
    corners: { x: number; y: number }[],
    enhance: boolean
): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const [tl, tr, br, bl] = corners;
            const rawW = Math.max(
                Math.hypot(tr.x - tl.x, tr.y - tl.y),
                Math.hypot(br.x - bl.x, br.y - bl.y)
            );
            const rawH = Math.max(
                Math.hypot(bl.x - tl.x, bl.y - tl.y),
                Math.hypot(br.x - tr.x, br.y - tr.y)
            );
            const maxDim = 1600;
            const scale = Math.min(1, maxDim / Math.max(rawW, rawH));
            const outW = Math.max(1, Math.round(rawW * scale));
            const outH = Math.max(1, Math.round(rawH * scale));

            const srcPts: [number, number][] = [[tl.x, tl.y], [tr.x, tr.y], [br.x, br.y], [bl.x, bl.y]];
            const dstPts: [number, number][] = [[0, 0], [outW, 0], [outW, outH], [0, outH]];
            const H = buildHomography(dstPts, srcPts);

            const srcC = document.createElement('canvas');
            srcC.width = img.width; srcC.height = img.height;
            const srcCtx = srcC.getContext('2d')!;
            srcCtx.drawImage(img, 0, 0);
            const srcD = srcCtx.getImageData(0, 0, img.width, img.height).data;

            const outC = document.createElement('canvas');
            outC.width = outW; outC.height = outH;
            const outCtx = outC.getContext('2d')!;
            const outImg = outCtx.createImageData(outW, outH);
            const od = outImg.data;
            const iw = img.width, ih = img.height;

            const sample = (px: number, py: number, c: number) => {
                const x0 = Math.floor(px), y0 = Math.floor(py);
                const x1 = Math.min(x0 + 1, iw - 1), y1 = Math.min(y0 + 1, ih - 1);
                const fx = px - x0, fy = py - y0;
                const cx0 = Math.max(0, Math.min(iw - 1, x0));
                const cy0 = Math.max(0, Math.min(ih - 1, y0));
                const cx1 = Math.max(0, Math.min(iw - 1, x1));
                const cy1 = Math.max(0, Math.min(ih - 1, y1));
                return (1 - fx) * (1 - fy) * srcD[(cy0 * iw + cx0) * 4 + c]
                     + fx * (1 - fy) * srcD[(cy0 * iw + cx1) * 4 + c]
                     + (1 - fx) * fy * srcD[(cy1 * iw + cx0) * 4 + c]
                     + fx * fy * srcD[(cy1 * iw + cx1) * 4 + c];
            };

            for (let oy = 0; oy < outH; oy++) {
                for (let ox = 0; ox < outW; ox++) {
                    const ww = H[2][0] * ox + H[2][1] * oy + H[2][2];
                    const sx = (H[0][0] * ox + H[0][1] * oy + H[0][2]) / ww;
                    const sy = (H[1][0] * ox + H[1][1] * oy + H[1][2]) / ww;
                    const idx = (oy * outW + ox) * 4;
                    od[idx]     = sample(sx, sy, 0);
                    od[idx + 1] = sample(sx, sy, 1);
                    od[idx + 2] = sample(sx, sy, 2);
                    od[idx + 3] = 255;
                }
            }
            outCtx.putImageData(outImg, 0, 0);

            if (enhance) {
                const id2 = outCtx.getImageData(0, 0, outW, outH);
                const d2 = id2.data;
                let [minR, maxR, minG, maxG, minB, maxB] = [255, 0, 255, 0, 255, 0];
                for (let i = 0; i < d2.length; i += 4) {
                    if (d2[i]   < minR) minR = d2[i];   if (d2[i]   > maxR) maxR = d2[i];
                    if (d2[i+1] < minG) minG = d2[i+1]; if (d2[i+1] > maxG) maxG = d2[i+1];
                    if (d2[i+2] < minB) minB = d2[i+2]; if (d2[i+2] > maxB) maxB = d2[i+2];
                }
                const rR = maxR - minR || 1, gR = maxG - minG || 1, bR = maxB - minB || 1;
                for (let i = 0; i < d2.length; i += 4) {
                    d2[i]   = Math.round((d2[i]   - minR) / rR * 255);
                    d2[i+1] = Math.round((d2[i+1] - minG) / gR * 255);
                    d2[i+2] = Math.round((d2[i+2] - minB) / bR * 255);
                }
                // Unsharp mask (sharpen)
                const src2 = new Uint8ClampedArray(d2);
                const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
                for (let y = 1; y < outH - 1; y++) {
                    for (let x = 1; x < outW - 1; x++) {
                        for (let c = 0; c < 3; c++) {
                            let v = 0;
                            for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) {
                                v += src2[((y + ky) * outW + (x + kx)) * 4 + c] * k[(ky + 1) * 3 + (kx + 1)];
                            }
                            d2[(y * outW + x) * 4 + c] = Math.max(0, Math.min(255, v));
                        }
                    }
                }
                outCtx.putImageData(id2, 0, 0);
            }

            resolve(outC.toDataURL('image/jpeg', 0.92));
        };
        img.src = imageUrl;
    });
}

// ─── Document Scanner UI ──────────────────────────────────────────────────────
type Corner = { x: number; y: number };

const DocumentScanner: React.FC<{
    imageUrl: string;
    onDone: (scannedUrl: string) => void;
    onSkip: () => void;
}> = ({ imageUrl, onDone, onSkip }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgElRef = useRef<HTMLImageElement>(null);
    const [displayRect, setDisplayRect] = useState({ left: 0, top: 0, w: 1, h: 1 });
    const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
    const [corners, setCorners] = useState<Corner[]>([
        { x: 0.08, y: 0.08 }, { x: 0.92, y: 0.08 },
        { x: 0.92, y: 0.92 }, { x: 0.08, y: 0.92 },
    ]);
    const draggingIdx = useRef<number | null>(null);
    const [scanning, setScanning] = useState(false);
    const [enhance, setEnhance] = useState(true);

    const updateDisplayRect = () => {
        const img = imgElRef.current;
        if (!img) return;
        const r = img.getBoundingClientRect();
        const cr = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        setDisplayRect({ left: r.left - cr.left, top: r.top - cr.top, w: r.width, h: r.height });
    };

    useEffect(() => {
        updateDisplayRect();
        window.addEventListener('resize', updateDisplayRect);
        return () => window.removeEventListener('resize', updateDisplayRect);
    }, []);

    const getPos = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
        const cr = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const rawX = clientX - cr.left - displayRect.left;
        const rawY = clientY - cr.top - displayRect.top;
        return {
            x: Math.max(0, Math.min(1, rawX / displayRect.w)),
            y: Math.max(0, Math.min(1, rawY / displayRect.h)),
        };
    };

    const startDrag = (idx: number) => { draggingIdx.current = idx; };

    const onMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (draggingIdx.current === null) return;
        e.preventDefault();
        const pos = getPos(e);
        setCorners(prev => prev.map((c, i) => i === draggingIdx.current ? pos : c));
    };

    const endDrag = () => { draggingIdx.current = null; };

    const handleScan = async () => {
        setScanning(true);
        try {
            const iw = naturalSize.w, ih = naturalSize.h;
            const imgCorners = corners.map(c => ({ x: c.x * iw, y: c.y * ih }));
            const result = await processDocumentScan(imageUrl, imgCorners, enhance);
            onDone(result);
        } catch {
            onSkip();
        } finally {
            setScanning(false);
        }
    };

    const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];
    const CORNER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

    const pts = corners.map(c => `${c.x * displayRect.w},${c.y * displayRect.h}`).join(' ');

    return (
        <div className="fixed inset-0 z-[600] bg-black flex flex-col select-none">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
                <div>
                    <p className="text-white text-xs font-black uppercase tracking-wider">Document Scanner</p>
                    <p className="text-slate-400 text-[10px] font-bold mt-0.5">Drag corners to fit the document edge</p>
                </div>
                <button onClick={onSkip} className="px-3 py-1.5 bg-white/10 rounded-xl text-white text-[11px] font-bold active:scale-95 transition-transform">Skip</button>
            </div>

            {/* Image + Overlay */}
            <div
                ref={containerRef}
                className="flex-1 relative flex items-center justify-center overflow-hidden bg-black"
                onMouseMove={onMove}
                onMouseUp={endDrag}
                onTouchMove={onMove}
                onTouchEnd={endDrag}
            >
                <img
                    ref={imgElRef}
                    src={imageUrl}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    onLoad={(e) => {
                        const img = e.currentTarget;
                        setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                        updateDisplayRect();
                    }}
                    draggable={false}
                />

                {/* SVG overlay positioned over the image */}
                <svg
                    className="absolute pointer-events-none"
                    style={{ left: displayRect.left, top: displayRect.top, width: displayRect.w, height: displayRect.h }}
                >
                    <polygon points={pts} fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3" />
                    {corners.map((c, i) => (
                        <line
                            key={i}
                            x1={corners[i].x * displayRect.w}
                            y1={corners[i].y * displayRect.h}
                            x2={corners[(i + 1) % 4].x * displayRect.w}
                            y2={corners[(i + 1) % 4].y * displayRect.h}
                            stroke={CORNER_COLORS[i]}
                            strokeWidth="1.5"
                            opacity="0.5"
                        />
                    ))}
                </svg>

                {/* Draggable corner handles */}
                {corners.map((c, i) => (
                    <div
                        key={i}
                        className="absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow-xl border-2 cursor-grab active:cursor-grabbing active:scale-110 transition-transform touch-none"
                        style={{
                            left: displayRect.left + c.x * displayRect.w - 16,
                            top: displayRect.top + c.y * displayRect.h - 16,
                            backgroundColor: CORNER_COLORS[i],
                            borderColor: 'white',
                        }}
                        onMouseDown={(e) => { e.preventDefault(); startDrag(i); }}
                        onTouchStart={(e) => { e.preventDefault(); startDrag(i); }}
                    >
                        {CORNER_LABELS[i]}
                    </div>
                ))}
            </div>

            {/* Footer controls */}
            <div className="shrink-0 px-4 py-4 bg-black/80 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-slate-300 text-[11px] font-bold uppercase tracking-wide">Auto Enhance</span>
                    <button
                        onClick={() => setEnhance(v => !v)}
                        className={`w-11 h-6 rounded-full relative transition-all border ${enhance ? 'bg-indigo-500 border-indigo-400' : 'bg-white/10 border-white/20'}`}
                    >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enhance ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onSkip}
                        className="flex-1 py-3 bg-white/10 rounded-2xl text-white text-xs font-black uppercase active:scale-95 transition-transform border border-white/10"
                    >
                        Use Original
                    </button>
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        className="flex-[2] py-3 bg-indigo-600 rounded-2xl text-white text-xs font-black uppercase active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50"
                    >
                        {scanning ? <><Loader2 size={15} className="animate-spin"/> Scanning...</> : <><Camera size={15}/> Scan Document</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Brand Image Modal ────────────────────────────────────────────────────────
const BrandImageModal: React.FC<{
    brand: MaterialBrand;
    onClose: () => void;
    onSave: (images: string[], collageImage: string) => void;
}> = ({ brand, onClose, onSave }) => {
    const imgRef = useRef<HTMLInputElement>(null);
    const camRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState<string[]>(
        brand.images && brand.images.length > 0 ? brand.images : (brand.image ? [brand.image] : [])
    );
    const [collageImage, setCollageImage] = useState(brand.collageImage || '');
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [viewingIdx, setViewingIdx] = useState<number | null>(null);
    const [showCollage, setShowCollage] = useState(false);
    const [dirty, setDirty] = useState(false);
    // scan queue: raw data URLs waiting to be scanned one by one
    const [scanQueue, setScanQueue] = useState<string[]>([]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const rawUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const dataUrl = await readFileAsDataUrl(files[i]);
            rawUrls.push(dataUrl);
        }
        // Push to scan queue so DocumentScanner handles each one
        setScanQueue(prev => [...prev, ...rawUrls]);
        e.target.value = '';
    };

    const commitScannedImage = async (url: string) => {
        const compressed = await compressImage(url);
        setImages(prev => [...prev, compressed]);
        setDirty(true);
        setScanQueue(prev => prev.slice(1));
    };

    const removeImage = (idx: number) => {
        setImages(prev => {
            const updated = prev.filter((_, i) => i !== idx);
            if (updated.length < 2) setCollageImage('');
            return updated;
        });
        setDirty(true);
    };

    const handleSaveEdit = (editedUrl: string) => {
        if (editingIdx === null) return;
        setImages(prev => prev.map((img, i) => i === editingIdx ? editedUrl : img));
        if (collageImage && editingIdx === 0) setCollageImage('');
        setEditingIdx(null);
        setDirty(true);
    };

    // Show scanner for each queued raw image before adding to collection
    if (scanQueue.length > 0) {
        return (
            <DocumentScanner
                imageUrl={scanQueue[0]}
                onDone={(scannedUrl) => commitScannedImage(scannedUrl)}
                onSkip={() => commitScannedImage(scanQueue[0])}
            />
        );
    }

    if (editingIdx !== null && images[editingIdx]) {
        return (
            <PhotoEditor
                imageUrl={images[editingIdx]}
                onSave={handleSaveEdit}
                onCancel={() => setEditingIdx(null)}
            />
        );
    }

    if (showCollage && images.length >= 2) {
        return (
            <CollageStudio
                initialImages={images}
                onSave={(dataUrl: string) => { setCollageImage(dataUrl); setShowCollage(false); setDirty(true); }}
                onClose={() => setShowCollage(false)}
            />
        );
    }

    if (viewingIdx !== null) {
        return (
            <div className="fixed inset-0 z-[600] bg-black flex flex-col" onClick={() => setViewingIdx(null)}>
                <div className="flex items-center justify-between p-4 shrink-0">
                    <span className="text-white text-xs font-bold">{viewingIdx + 1} / {images.length}</span>
                    <button onClick={() => setViewingIdx(null)} className="p-2 text-white"><X size={22}/></button>
                </div>
                <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={e => e.stopPropagation()}>
                    <img src={images[viewingIdx]} alt="" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
                </div>
                <div className="shrink-0 flex justify-center gap-3 p-4">
                    <button disabled={viewingIdx === 0} onClick={e => { e.stopPropagation(); setViewingIdx(v => Math.max(0, (v ?? 0) - 1)); }} className="p-2 bg-white/20 rounded-xl text-white disabled:opacity-30"><ArrowLeft size={18}/></button>
                    <button onClick={e => { e.stopPropagation(); setEditingIdx(viewingIdx); setViewingIdx(null); }} className="px-4 py-2 bg-white/20 rounded-xl text-white text-xs font-black uppercase flex items-center gap-1.5"><Edit3 size={14}/> Edit</button>
                    <button disabled={viewingIdx === images.length - 1} onClick={e => { e.stopPropagation(); setViewingIdx(v => Math.min(images.length - 1, (v ?? 0) + 1)); }} className="p-2 bg-white/20 rounded-xl text-white disabled:opacity-30"><ArrowRight size={18}/></button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[500] bg-black/70 flex items-end justify-center" onClick={onClose}>
            <div className="bg-white w-full max-w-lg rounded-t-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{brand.name}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Product Images</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 active:text-rose-500 rounded-xl"><X size={18}/></button>
                </div>

                <div className="p-4 max-h-[60dvh] overflow-y-auto">
                    {images.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                            <ImageIcon size={44} className="mb-3 opacity-30"/>
                            <p className="text-xs font-bold uppercase tracking-wide">No images yet</p>
                            <p className="text-[10px] text-slate-400 mt-1">Use the buttons below to add photos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {images.map((img, i) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-100">
                                    <img src={i === 0 && collageImage ? collageImage : img} alt="" className="w-full h-full object-cover"/>
                                    {i === 0 && collageImage && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[8px] font-bold text-center py-0.5">COLLAGE</div>
                                    )}
                                    <div className="absolute top-1 right-1 flex gap-1">
                                        <button onClick={() => setViewingIdx(i)} className="p-1 bg-black/50 rounded-md text-white active:scale-90 transition-transform"><Maximize2 size={9}/></button>
                                        <button onClick={() => setEditingIdx(i)} className="p-1 bg-black/50 rounded-md text-white active:scale-90 transition-transform"><Edit3 size={9}/></button>
                                    </div>
                                    <button onClick={() => removeImage(i)} className="absolute bottom-1 right-1 p-1 bg-rose-500/80 rounded-md text-white active:scale-90 transition-transform"><X size={9}/></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <input ref={imgRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFile}/>
                    <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile}/>
                    <div className="flex gap-2">
                        <button onClick={() => camRef.current?.click()} className="flex-1 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase active:scale-95 transition-transform">
                            <Camera size={15}/> Camera
                        </button>
                        <button onClick={() => imgRef.current?.click()} className="flex-1 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase active:scale-95 transition-transform">
                            <Upload size={15}/> Upload
                        </button>
                        {images.length >= 2 && (
                            <button onClick={() => setShowCollage(true)} className={`flex-1 py-3 border rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase active:scale-95 transition-transform ${collageImage ? 'bg-violet-100 border-violet-200 text-violet-700' : 'bg-violet-50 border-violet-100 text-violet-600'}`}>
                                <LayoutGrid size={15}/> {collageImage ? 'Re-Collage' : 'Collage'}
                            </button>
                        )}
                    </div>
                </div>

                {dirty && (
                    <div className="px-4 pb-5 pt-3 border-t border-slate-100">
                        <button
                            onClick={() => onSave(images, collageImage)}
                            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase shadow-lg active:scale-95 transition-transform"
                        >
                            Save Images
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface MaterialRowProps {
    item: RawMaterialExtended;
    serialNumber: number;
    isExpanded: boolean;
    onToggle: () => void;
    onUpdate: (id: string, updates: Partial<RawMaterialExtended>) => void;
    onEdit: () => void;
    onCoa: () => void;
    onOnboard: () => void;
    onMerge: () => void;
    onEditBrand: (brand: MaterialBrand) => void;
    onAudit: (brand: MaterialBrand) => void;
    onToggleBrand: (brandId: string) => void;
    onDeleteBrand: (brandId: string) => void;
    onAddVendor: (brandId: string) => void;
    onToggleSupplier: (brandId: string, supplierName: string) => void;
    onDeleteSupplier: (brandId: string, supplierName: string) => void;
    isSelected: boolean;
    onSelectToggle: () => void;
    listType?: 'ingredients' | 'fcm';
    originUnitName?: string;
    isAdopted?: boolean;
    onMigrate?: () => void;
}

const MaterialRow: React.FC<MaterialRowProps> = ({ 
  item, isExpanded, onToggle, onUpdate, onEdit, onCoa, onOnboard, onMerge,
  onEditBrand, onAudit, onToggleBrand, onDeleteBrand, 
  onAddVendor, onToggleSupplier, onDeleteSupplier,
  isSelected, onSelectToggle, serialNumber, listType = 'ingredients',
  originUnitName, isAdopted, onMigrate,
}) => {
  const isFCM = listType === 'fcm';
  const certLabel = isFCM ? 'FGC' : 'COA';
  const isActuallyActive = item.isActive !== false;
  const [isSpecDropdownOpen, setIsSpecDropdownOpen] = useState(false);
  const [specSearch, setSpecSearch] = useState("");
  const specRef = useRef<HTMLDivElement>(null);
  const [brandImgModal, setBrandImgModal] = useState<MaterialBrand | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (specRef.current && !specRef.current.contains(event.target as Node)) setIsSpecDropdownOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSpecOptions = useMemo(() => {
      const currentSpecs = item.specifications || [];
      return SPECIFICATION_CATALOG.filter(s => 
          s.toLowerCase().includes(specSearch.toLowerCase()) && 
          !currentSpecs.includes(s)
      );
  }, [specSearch, item.specifications]);

  const consolidatedAllergens = useMemo(() => {
    const all = new Set<string>();
    item.brands.forEach(b => {
      if (b.allergens && b.allergens !== 'None') {
        b.allergens.split(', ').forEach(a => {
          const trimmed = a.trim();
          if (trimmed) all.add(trimmed);
        });
      }
    });
    return Array.from(all).sort().join(', ') || 'None';
  }, [item.brands]);

  const complianceRollup = useMemo(() => {
    if (!item.brands.length) return null;
    const statuses = item.brands.map((b: any) => b.complianceStatus || 'Pending');
    if (statuses.some(s => s === 'Not Compliant')) return 'Not Compliant';
    if (statuses.every(s => s === 'Compliant')) return 'Compliant';
    return 'Pending';
  }, [item.brands]);

  const handleAddSpec = (spec: string) => {
      const currentSpecs = item.specifications || [];
      onUpdate(item.id, { specifications: [...currentSpecs, spec] });
      setIsSpecDropdownOpen(false);
      setSpecSearch("");
  };

  const handleRemoveSpec = (spec: string) => {
      const currentSpecs = item.specifications || [];
      onUpdate(item.id, { specifications: currentSpecs.filter(s => s !== spec) });
  };

  const handleViewSpec = (spec: string) => {
      window.open(`https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf#name=${encodeURIComponent(spec)}`, '_blank');
  };

  const brandDietary = (brandId: string) => {
    return item.brands.find(b => b.id === brandId)?.dietaryType;
  };

  return (
    <>
    <div className={`bg-white rounded-2xl md:rounded-[2rem] border-2 transition-all duration-300 ${isExpanded ? 'border-indigo-500 shadow-2xl' : isSelected ? 'border-indigo-600 bg-indigo-50/10 shadow-lg' : 'border-slate-100 shadow-sm hover:border-indigo-200'} ${!isActuallyActive ? 'bg-slate-50 border-slate-200 shadow-none' : ''}`}>
      
      {/* DESKTOP ROW LAYOUT (MD+) */}
      <div className={`hidden md:flex flex-row items-center gap-4 lg:gap-8 p-4 lg:p-6 ${!isActuallyActive ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-start gap-3 shrink-0">
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-inner shrink-0">
                {serialNumber}
              </div>
              <button 
                onClick={onSelectToggle}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-300 hover:border-indigo-400'}`}
              >
                {isSelected && <Check size={14} strokeWidth={4} />}
              </button>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={onToggle} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-600 text-white rotate-90 shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                <ChevronRight size={20} />
              </button>
          </div>
        </div>

        <div className="flex items-center gap-4 min-w-[200px] w-[220px]">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border shrink-0 ${isActuallyActive ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-200 text-slate-400 border-slate-300'}`}>
            <Package size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-2">{item.name}</h3>
              {isActuallyActive && (
                <button onClick={onEdit} className="p-1 text-slate-300 hover:text-indigo-600 transition-colors shrink-0">
                  <Edit3 size={14} />
                </button>
              )}
            </div>
            {originUnitName && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">From {originUnitName}</span>
                {isAdopted && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Adopted</span>}
                {onMigrate && <button onClick={onMigrate} className="text-[8px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full active:scale-95 transition-all hover:bg-indigo-100">+ Migrate to My Unit</button>}
              </div>
            )}
            {complianceRollup && (
              <div className="mb-1.5">
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${complianceRollup === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : complianceRollup === 'Not Compliant' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {complianceRollup === 'Compliant' ? '✓ Compliant' : complianceRollup === 'Not Compliant' ? '✕ Not Compliant' : '⏳ Pending'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 overflow-hidden">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 truncate inline-flex items-center" title={item.organization}>
                  <MapPin size={8} className="mr-1" /> {item.organization}
               </span>
               <select 
                  value={item.risk}
                  onChange={(e) => onUpdate(item.id, { risk: e.target.value as any })}
                  className={`appearance-none px-1.5 py-0.5 rounded text-[8px] font-black uppercase border outline-none cursor-pointer transition-all ${getRiskStyles(item.risk)}`}
               >
                  <option value="NA">NA</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
               </select>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Layers size={11} className="text-indigo-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand Mappings & Allergens</span>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[32px] overflow-hidden">
              {item.brands.map(b => (
                <div key={b.id} className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all shadow-sm ${b.status === 'Inactive' ? 'bg-slate-50 border-slate-200 opacity-40 grayscale' : 'bg-white border-slate-100 hover:border-indigo-400'}`}>
                  <div className="relative shrink-0 cursor-pointer" onClick={() => onEditBrand(b)}>
                    {b.image ? <img src={b.image} className="w-5 h-5 rounded-lg object-cover ring-1 ring-slate-100" alt="Brand" /> : <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] font-black text-slate-400">?</div>}
                    {!isFCM && <div className="absolute -top-1.5 -right-1.5"><DietaryLogo type={brandDietary(b.id)} size="sm" /></div>}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight truncate max-w-[100px] ${b.status === 'Inactive' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {b.name}
                  </span>
                </div>
              ))}
              {item.brands.length === 0 && <span className="text-[10px] text-slate-300 italic uppercase">No identities mapped</span>}
            </div>
            {!isFCM && item.brands.length > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[8px] font-black uppercase border border-rose-100 flex items-center gap-1">
                  <FlaskConical size={10} /> Consolidated Allergens: {consolidatedAllergens}
                </div>
              </div>
            )}
        </div>

        {!isFCM && <div className="hidden lg:flex items-center gap-6 border-l border-slate-100 pl-6 shrink-0">
            <div className="flex flex-col gap-1.5 items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stockable</span>
                <button 
                    disabled={!isActuallyActive}
                    onClick={() => onUpdate(item.id, { stockable: !item.stockable })} 
                    className={`w-11 h-6 rounded-full relative transition-all border-2 flex items-center ${item.stockable ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-200 border-slate-200'} ${!isActuallyActive ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${item.stockable ? 'ml-6' : 'ml-0.5'}`} />
                </button>
                {item.yield && <span className={`text-[7px] font-bold uppercase leading-none ${item.stockable ? 'text-blue-500' : 'text-amber-500'}`}>{item.stockable ? 'Stock Reg.' : 'Dept Stock'}</span>}
            </div>
        </div>}

        <div className="hidden lg:flex flex-1 min-w-0 flex-col gap-2 relative border-l border-slate-100 pl-6" ref={specRef}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <SettingsIcon size={11} className="text-blue-500" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specifications</span>
                </div>
                <button onClick={() => setIsSpecDropdownOpen(!isSpecDropdownOpen)} className="text-[9px] font-black text-blue-600 uppercase hover:underline flex items-center gap-1"><Plus size={10}/> Add</button>
            </div>
            
            <div className="flex flex-wrap gap-2 min-h-[32px] content-start">
              {(item.specifications || []).map(spec => (
                <div key={spec} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[9px] font-black uppercase shadow-sm group/spec transition-all">
                  <span className="truncate max-w-[80px]" title={spec}>{spec}</span>
                  <div className="flex items-center gap-1 ml-1 pl-1 border-l border-blue-200">
                    <button onClick={() => handleViewSpec(spec)} className="hover:text-blue-900 transition-colors" title="View PDF">
                        <ViewIcon size={11} />
                    </button>
                    <button onClick={() => handleRemoveSpec(spec)} className="hover:text-red-500 transition-colors" title="Remove">
                        <RemoveIcon size={11} />
                    </button>
                  </div>
                </div>
              ))}
              {(item.specifications || []).length === 0 && <span className="text-[10px] text-slate-300 italic uppercase mt-1">No specs defined</span>}

              {isSpecDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-3 border-b border-slate-100 bg-slate-50">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Search Spec Library..." 
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-blue-400 transition-all shadow-inner"
                                value={specSearch}
                                onChange={(e) => setSpecSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {filteredSpecOptions.length > 0 ? filteredSpecOptions.map(opt => (
                            <button 
                                key={opt}
                                onClick={() => handleAddSpec(opt)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 text-[11px] font-bold text-slate-700 uppercase tracking-tight rounded-xl transition-all flex items-center justify-between group"
                            >
                                {opt}
                                <Plus size={14} className="text-slate-300 group-hover:text-blue-600 opacity-0 group-hover:opacity-100" />
                            </button>
                        )) : (
                            <div className="p-4 text-center text-[10px] text-slate-400 italic">No matches</div>
                        )}
                    </div>
                </div>
              )}
            </div>
        </div>

        <div className="flex items-center justify-end gap-3 pl-6 border-l border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
              {!isFCM && <><div className="flex flex-col items-center gap-1">
                 <span className={`text-[8px] font-black uppercase tracking-widest leading-none ${item.yield ? 'text-emerald-600' : 'text-rose-400'}`}>{item.yield ? 'Yield' : 'No Yield'}</span>
                 <button 
                    disabled={!isActuallyActive}
                    onClick={() => onUpdate(item.id, { yield: !item.yield, accepted: !item.yield })} 
                    className={`w-10 h-5 rounded-full relative transition-all border ${item.yield ? 'bg-emerald-500 border-emerald-600' : 'bg-rose-200 border-rose-300'} ${!isActuallyActive ? 'cursor-not-allowed opacity-50' : ''}`}
                 >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-all ${item.yield ? 'right-0.5' : 'left-0.5'}`} />
                 </button>
                 {item.yield && <span className={`text-[7px] font-bold uppercase leading-none ${item.stockable ? 'text-blue-500' : 'text-amber-500'}`}>{item.stockable ? '→ Stock' : '→ Dept'}</span>}
              </div>
              <div className="h-8 w-px bg-slate-100 mx-1" /></>}
              <div className="flex items-center gap-1.5">
                  <button disabled={!isActuallyActive} onClick={onMerge} className="p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0 active:scale-95" title="Sink identities"><Anchor size={18} /></button>
                  <button onClick={() => onUpdate(item.id, { isActive: !isActuallyActive })} className={`p-2.5 rounded-xl transition-all shadow-lg border shrink-0 ${isActuallyActive ? 'bg-white text-slate-400 border-slate-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50' : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-100'}`} title={isActuallyActive ? 'Deactivate' : 'Activate'}><Power size={18} /></button>
                  <button disabled={!isActuallyActive} onClick={onCoa} className={`p-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0 ${!isActuallyActive ? 'cursor-not-allowed opacity-30' : ''}`} title="COA Certificates"><FileCheck size={18}/></button>
                  <button disabled={!isActuallyActive} onClick={onOnboard} className={`p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 shrink-0 ${!isActuallyActive ? 'cursor-not-allowed opacity-30' : ''}`} title="Onboard Brand"><Plus size={18} strokeWidth={3} /></button>
              </div>
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT (MD:HIDDEN) */}
      <div className={`md:hidden relative ${!isActuallyActive ? 'opacity-60' : ''}`}>
         <div className="px-4 pt-4 pb-3 flex items-center justify-between">
             <div className="flex items-center gap-2.5">
                 <button 
                    onClick={onSelectToggle}
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}
                 >
                    {isSelected && <Check size={14} strokeWidth={4} />}
                 </button>
                 <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-400">
                    {serialNumber}
                 </div>
             </div>
             <div className="flex items-center gap-1">
                 {!isFCM && (
                   <div className="flex items-center gap-1 mr-1">
                     <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${item.yield ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                       {item.yield ? 'Yield' : 'No Yield'}
                     </span>
                     {item.yield && (
                       <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${item.stockable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                         {item.stockable ? 'Stock' : 'Dep'}
                       </span>
                     )}
                   </div>
                 )}
                 {isActuallyActive && <button onClick={onEdit} className="p-1.5 text-slate-300 active:text-indigo-600 rounded-lg"><Edit3 size={15}/></button>}
                 <button onClick={() => onUpdate(item.id, { isActive: !isActuallyActive })} className={`p-1.5 rounded-lg ${isActuallyActive ? 'text-slate-300' : 'text-emerald-500'}`}>
                    <Power size={15}/>
                 </button>
                 <button onClick={onToggle} className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'text-indigo-600' : 'text-slate-300'}`}>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}/>
                 </button>
             </div>
         </div>

         <div className="px-4 pb-3 flex items-center gap-3">
             <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${isActuallyActive ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                <Package size={22} />
             </div>
             <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-black text-slate-900 uppercase leading-tight truncate">{item.name}</h3>
                {originUnitName && (
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className="text-[7px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full">From {originUnitName}</span>
                    {isAdopted && <span className="text-[7px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full">Adopted</span>}
                    {onMigrate && <button onClick={onMigrate} className="text-[7px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded-full active:scale-95 transition-all hover:bg-indigo-100">+ Migrate</button>}
                  </div>
                )}
                {complianceRollup && (
                  <div className="mt-0.5">
                    <span className={`text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded-full border ${complianceRollup === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : complianceRollup === 'Not Compliant' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {complianceRollup === 'Compliant' ? '✓ Compliant' : complianceRollup === 'Not Compliant' ? '✕ Not Compliant' : '⏳ Pending'}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin size={9} className="text-indigo-400 shrink-0"/> {item.organization}
                    </span>
                    <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${getRiskStyles(item.risk)}`}>
                        {item.risk}
                    </div>
                </div>
             </div>
         </div>

         <div className="px-4 pb-3">
             <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                 <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Layers size={10}/> Brands ({item.brands.length})</span>
                     {item.brands.length > 0 && consolidatedAllergens !== 'None' && (
                         <span className="text-[8px] font-bold text-rose-500 flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                             <FlaskConical size={8}/> {consolidatedAllergens}
                         </span>
                     )}
                 </div>
                 <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
                     {item.brands.length > 0 ? item.brands.map(b => (
                         <span key={b.id} onClick={() => onEditBrand(b)} className={`whitespace-nowrap px-2.5 py-1.5 bg-white border rounded-xl text-[9px] font-bold shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${b.status === 'Inactive' ? 'border-slate-200 text-slate-400 opacity-50' : 'border-slate-200 text-slate-700'}`}>
                            {b.image
                              ? <img src={b.image} className="w-5 h-5 rounded-lg object-cover ring-1 ring-slate-100 shrink-0" alt="" />
                              : <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center text-[8px] font-black text-slate-400 shrink-0">?</div>}
                            {!isFCM && <DietaryLogo type={b.dietaryType as 'Veg' | 'Non-Veg'} size="sm" />}
                            {b.name}
                            {(b as any).complianceStatus && (
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(b as any).complianceStatus === 'Compliant' ? 'bg-emerald-500' : (b as any).complianceStatus === 'Not Compliant' ? 'bg-rose-500' : 'bg-amber-400'}`} title={(b as any).complianceStatus} />
                            )}
                         </span>
                     )) : <span className="text-[9px] text-slate-400 italic">No brands mapped</span>}
                 </div>
             </div>
         </div>


         {(item.specifications || []).length > 0 && (
             <div className="px-4 pb-3">
                 <div className="flex items-center gap-1.5 mb-1.5">
                     <SettingsIcon size={10} className="text-blue-500" />
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Specifications</span>
                 </div>
                 <div className="flex flex-wrap gap-1.5">
                     {(item.specifications || []).map(spec => (
                         <button 
                             key={spec} 
                             onClick={() => handleViewSpec(spec)}
                             className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[8px] font-bold uppercase truncate max-w-[140px] flex items-center gap-1 active:scale-95 active:bg-blue-100 transition-all"
                             title={spec}
                         >
                             <ViewIcon size={9} className="shrink-0" />
                             {spec}
                         </button>
                     ))}
                 </div>
             </div>
         )}

         <div className="px-4 pb-4 pt-1 border-t border-slate-100 mt-1">
             <div className="flex items-center gap-2">
                 <button disabled={!isActuallyActive} onClick={onCoa} className="flex-1 py-2.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40">
                     <FileCheck size={15} />
                     <span className="text-[9px] font-black uppercase">{certLabel}</span>
                 </button>
                 <button disabled={!isActuallyActive} onClick={onMerge} className="flex-1 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40">
                     <Anchor size={15} />
                     <span className="text-[9px] font-black uppercase">Sink</span>
                 </button>
                 <button disabled={!isActuallyActive} onClick={onOnboard} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40">
                     <Plus size={15} strokeWidth={3} />
                     <span className="text-[9px] font-black uppercase">Add Brand</span>
                 </button>
             </div>
         </div>
      </div>

      {isExpanded && (
        <div className={`px-4 lg:px-6 pb-8 pt-2 animate-in slide-in-from-top-4 duration-300 ${!isActuallyActive ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="bg-slate-50/50 rounded-3xl border border-slate-100 overflow-hidden shadow-inner">
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-[#1e293b] text-white text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 sticky left-0 bg-[#1e293b] z-10">Brand Identity</th>
                    <th className="px-6 py-4">{isFCM ? 'Shelf Life' : 'Technical Specs'}</th>
                    {!isFCM && <th className="px-6 py-4">Nutritional</th>}
                    <th className="px-6 py-4">Linked Vendors</th>
                    <th className="px-6 py-4">Status & Compliance</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/60 backdrop-blur-sm">
                  {item.brands.map((brand) => (
                    <tr key={brand.id} className={`hover:bg-white transition-colors group/row ${brand.status === 'Inactive' ? 'opacity-50 grayscale bg-slate-50/50' : ''}`}>
                      <td className="px-6 py-5 sticky left-0 bg-white group-hover/row:bg-white z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden group/img cursor-pointer" onClick={() => onEditBrand(brand)}>
                            {brand.image ? <img src={brand.image} alt="" className="w-full h-full object-cover"/> : <Building2 className="text-slate-300" size={24} />}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <Edit3 size={16} className="text-white" />
                            </div>
                            {!isFCM && <div className="absolute top-1 right-1"><DietaryLogo type={brandDietary(brand.id)} size="sm" /></div>}
                          </div>
                          <div className="min-w-0">
                            <h4 className={`text-sm font-black uppercase tracking-tight leading-none truncate ${brand.status === 'Inactive' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{brand.name}</h4>
                            <div className="mt-1.5 flex items-center gap-2">
                               <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${brand.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{brand.status}</span>
                               <span className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap">{brand.shelfLife}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex items-center gap-1.5 whitespace-nowrap"><Clock size={12} className="text-indigo-400"/><span className="text-slate-500 font-bold uppercase tracking-widest">Life:</span><span className="text-slate-700 font-black">{brand.shelfLife || '-'}</span></div>
                          {!isFCM && <div className="flex items-center gap-1.5 whitespace-nowrap"><Boxes size={12} className="text-indigo-400"/><span className="text-slate-500 font-bold uppercase tracking-widest">Store:</span><span className="text-slate-700 font-black truncate max-w-[120px]" title={brand.storage || '-'}>{brand.storage || '-'}</span></div>}
                          {!isFCM && <div className="flex items-center gap-1.5 whitespace-nowrap"><FlaskConical size={12} className="text-rose-400"/><span className="text-slate-500 font-bold uppercase tracking-widest">Allergen:</span><span className="text-rose-700 font-black truncate max-w-[120px]" title={brand.allergens || 'None'}>{brand.allergens || 'None'}</span></div>}
                          {!isFCM && (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${(brand as any).refrigeratedAfterOpening ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {(brand as any).refrigeratedAfterOpening ? '❄ Refrigerate after open' : 'No refrigeration needed'}
                              </span>
                            </div>
                          )}
                          {!isFCM && (brand as any).shelfLifeAfterOpeningSpecified && (brand as any).shelfLifeAfterOpeningText && (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <Clock size={11} className="text-amber-500 shrink-0"/>
                              <span className="text-slate-500 font-bold uppercase tracking-widest">After open:</span>
                              <span className="text-amber-700 font-black">{(brand as any).shelfLifeAfterOpeningText}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      {!isFCM && <td className="px-6 py-5">
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] whitespace-nowrap">
                            <div className="text-slate-400 font-bold">CAL: <span className="text-orange-600 font-black">{brand.energy || 0}</span></div>
                            <div className="text-slate-400 font-bold">PRO: <span className="text-emerald-600 font-black">{brand.protein || 0}</span></div>
                            <div className="text-slate-400 font-bold">FAT: <span className="text-rose-600 font-black">{brand.fat || 0}</span></div>
                            <div className="text-slate-400 font-bold">CRB: <span className="text-blue-600 font-black">{brand.carb || 0}</span></div>
                          </div>
                          {(brand.nutritionPanelImages || []).length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {(brand.nutritionPanelImages || []).slice(0, 4).map((img, i) => (
                                <div key={i} onClick={() => setLightboxImage(img)} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-amber-300 shrink-0 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" title={`NIP Panel ${i + 1} — click to enlarge`}>
                                  <img src={img} alt={`NIP ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                              {(brand.nutritionPanelImages || []).length > 4 && (
                                <div className="w-10 h-10 rounded-lg bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-[9px] font-black text-amber-700">
                                  +{(brand.nutritionPanelImages || []).length - 4}
                                </div>
                              )}
                            </div>
                          )}
                          {!(brand.nutritionPanelImages || []).length && (
                            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wide">No NIP</span>
                          )}
                          {/* Ingredients label strip */}
                          {(brand.ingredientsLabelImages || []).length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-emerald-100">
                              <span className="text-[7px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Ingredients Label</span>
                              <div className="flex gap-1 flex-wrap">
                                {(brand.ingredientsLabelImages || []).slice(0, 3).map((img, i) => (
                                  <div key={i} onClick={() => setLightboxImage(img)} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-emerald-300 shrink-0 shadow-sm cursor-zoom-in hover:scale-110 transition-transform" title={`Ingredients Label ${i + 1} — click to enlarge`}>
                                    <img src={img} alt={`ING ${i + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                                {(brand.ingredientsLabelImages || []).length > 3 && (
                                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center text-[9px] font-black text-emerald-700">
                                    +{(brand.ingredientsLabelImages || []).length - 3}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 max-w-[220px]">
                          {brand.linkedSuppliers.map((s, i) => (
                            <div key={i} className={`flex items-center gap-2 pl-2 pr-1 py-1 border rounded-xl text-[9px] font-black uppercase shadow-sm transition-all group/sup ${s.status === 'Inactive' ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 grayscale' : 'bg-white text-indigo-600 border-indigo-100 hover:border-indigo-300'}`}>
                              <Warehouse size={10} />
                              <span className={s.status === 'Inactive' ? 'line-through' : ''}>{s.name}</span>
                              <div className="flex items-center gap-1 border-l border-slate-100 pl-1 opacity-0 group-hover/sup:opacity-100 transition-opacity">
                                <button onClick={() => onToggleSupplier(brand.id, s.name)} className={`p-0.5 rounded ${s.status === 'Inactive' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-rose-500 hover:bg-rose-50'}`}>{s.status === 'Inactive' ? <Power size={10}/> : <ZapOff size={10}/>}</button>
                                <button onClick={() => onDeleteSupplier(brand.id, s.name)} className="p-0.5 rounded text-slate-300 hover:text-rose-600"><X size={10}/></button>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => onAddVendor(brand.id)} className="px-3 py-1 bg-white border border-dashed border-indigo-300 text-indigo-500 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"><Plus size={12}/> Add Vendor</button>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border shadow-sm w-fit ${getCoaColor(brand.coaStatus)}`}>{certLabel}: {brand.coaStatus}</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap"><Calendar size={12}/> Exp: <span className="text-slate-600 font-black">{brand.testingDate}</span></div>
                            {(brand as any).complianceStatus && (
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border shadow-sm w-fit ${(brand as any).complianceStatus === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (brand as any).complianceStatus === 'Not Compliant' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                {(brand as any).complianceStatus}
                              </span>
                            )}
                            {(brand as any).comments && (
                              <p className="text-[9px] text-slate-500 max-w-[180px] leading-relaxed italic truncate" title={(brand as any).comments}>{(brand as any).comments}</p>
                            )}
                          </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onEditBrand(brand)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm" title="Edit Specs"><Settings2 size={16}/></button>
                          <button onClick={() => onAudit(brand)} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm"><History size={16}/></button>
                          <button onClick={() => onToggleBrand(brand.id)} className={`p-2.5 rounded-xl transition-all shadow-sm border ${brand.status === 'Inactive' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{brand.status === 'Inactive' ? <Power size={16}/> : <ZapOff size={16}/>}</button>
                          <button onClick={() => onDeleteBrand(brand.id)} className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile/Tablet Brand Cards */}
            <div className="lg:hidden p-3 space-y-3">
               {item.brands.map((brand) => (
                 <div key={brand.id} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all ${brand.status === 'Inactive' ? 'opacity-50 grayscale' : ''}`}>
                    {/* Brand header: name on top, icon below name */}
                    <div className="p-3.5 pb-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight leading-tight">{brand.name}</h4>
                                {/* Veg / Non-Veg logo below name — visible in mobile same as desktop */}
                                {!isFCM && brand.dietaryType && (
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <DietaryLogo type={brand.dietaryType as 'Veg' | 'Non-Veg'} size="md" />
                                        <span className={`text-[8px] font-black uppercase ${brand.dietaryType === 'Veg' ? 'text-emerald-600' : 'text-amber-800'}`}>{brand.dietaryType}</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => onEditBrand(brand)} className="p-1.5 text-slate-300 active:text-indigo-600 shrink-0 -mt-0.5"><Settings2 size={16}/></button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            {/* Brand product image below name — opens BrandImageModal */}
                            <div
                                className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center relative overflow-hidden shrink-0 cursor-pointer group/bimg active:scale-95 transition-transform"
                                onClick={() => setBrandImgModal(brand)}
                                title="Tap to view/edit image"
                            >
                                {brand.image ? <img src={brand.image} alt="" className="w-full h-full object-cover" /> : <Building2 className="text-slate-300" size={16} />}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/bimg:opacity-100 transition-opacity">
                                    <Camera size={10} className="text-white" />
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${brand.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{brand.status}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">{brand.shelfLife}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${getCoaColor(brand.coaStatus)}`}>{brand.coaStatus}</span>
                                {(brand as any).complianceStatus && (
                                  <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${(brand as any).complianceStatus === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (brand as any).complianceStatus === 'Not Compliant' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {(brand as any).complianceStatus}
                                  </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {(brand as any).comments && (
                      <div className="px-3.5 pb-2 -mt-1">
                        <p className="text-[8px] text-slate-500 italic leading-relaxed bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">{(brand as any).comments}</p>
                      </div>
                    )}

                    <div className={`px-3.5 pb-3 ${isFCM ? '' : 'grid grid-cols-2 gap-2'}`}>
                        <div className="bg-slate-50 rounded-lg p-2.5 space-y-1.5 border border-slate-100/50">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">{isFCM ? 'Shelf Life' : 'Specs'}</span>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-600"><Clock size={9} className="text-indigo-400 shrink-0" /><span className="truncate">{brand.shelfLife || '-'}</span></div>
                                {!isFCM && <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-600"><Boxes size={9} className="text-indigo-400 shrink-0" /><span className="truncate">{(brand.storage || '-').split(' ').slice(0,2).join(' ')}</span></div>}
                                {!isFCM && <div className="flex items-start gap-1.5 text-[8px] font-bold text-rose-600"><FlaskConical size={9} className="text-rose-400 shrink-0 mt-0.5" /><span className="break-words">{brand.allergens || 'None'}</span></div>}
                                {!isFCM && (
                                  <div className="flex items-center gap-1.5 text-[8px] font-bold">
                                    <span className={`px-1 py-0.5 rounded text-[7px] font-black uppercase border ${(brand as any).refrigeratedAfterOpening ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                      {(brand as any).refrigeratedAfterOpening ? '❄ Refrigerate' : 'No refrigeration'}
                                    </span>
                                  </div>
                                )}
                                {!isFCM && (brand as any).shelfLifeAfterOpeningSpecified && (brand as any).shelfLifeAfterOpeningText && (
                                  <div className="flex items-center gap-1.5 text-[8px] font-bold text-amber-700">
                                    <Clock size={9} className="text-amber-500 shrink-0" /><span>After open: {(brand as any).shelfLifeAfterOpeningText}</span>
                                  </div>
                                )}
                            </div>
                        </div>
                        {!isFCM && <div className="space-y-2">
                          {/* Nutrition / NIP */}
                          <div className="bg-amber-50/60 rounded-lg p-2.5 space-y-1.5 border border-amber-100/80">
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Nutrition / 100g</span>
                                <button onClick={() => onEditBrand(brand)} className="text-[7px] font-black text-amber-600 flex items-center gap-0.5 active:scale-95 transition-transform" title="Upload NIP photo">
                                    <Camera size={8}/> NIP
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <div className="text-[8px] font-bold text-slate-400">Cal <span className="font-black text-orange-600">{brand.energy}</span></div>
                                <div className="text-[8px] font-bold text-slate-400">Pro <span className="font-black text-emerald-600">{brand.protein}</span></div>
                                <div className="text-[8px] font-bold text-slate-400">Fat <span className="font-black text-rose-600">{brand.fat}</span></div>
                                <div className="text-[8px] font-bold text-slate-400">Crb <span className="font-black text-blue-600">{brand.carb}</span></div>
                            </div>
                            {(brand.nutritionPanelImages || []).length > 0 ? (
                              <div className="flex gap-1 flex-wrap pt-0.5">
                                {(brand.nutritionPanelImages || []).map((img, i) => (
                                  <div key={i} className="w-8 h-8 rounded-md overflow-hidden border-2 border-amber-400 shrink-0 shadow-sm cursor-pointer active:scale-95 transition-transform" title={`NIP ${i + 1}`} onClick={() => onEditBrand(brand)}>
                                    <img src={img} alt={`NIP ${i + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button onClick={() => onEditBrand(brand)} className="flex items-center gap-1 text-[7px] font-bold text-amber-500 uppercase tracking-wide pt-0.5 active:scale-95 transition-transform"><Camera size={8}/>Upload NIP Photo</button>
                            )}
                          </div>
                          {/* Ingredients Label */}
                          <div className="bg-emerald-50/60 rounded-lg p-2.5 space-y-1.5 border border-emerald-100/80">
                            <div className="flex items-center justify-between">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Ingredients Label</span>
                                <button onClick={() => onEditBrand(brand)} className="text-[7px] font-black text-emerald-600 flex items-center gap-0.5 active:scale-95 transition-transform" title="Upload ingredients label photo">
                                    <Camera size={8}/> Label
                                </button>
                            </div>
                            {(brand.ingredientsLabelImages || []).length > 0 ? (
                              <div className="flex gap-1 flex-wrap pt-0.5">
                                {(brand.ingredientsLabelImages || []).map((img, i) => (
                                  <div key={i} className="w-8 h-8 rounded-md overflow-hidden border-2 border-emerald-400 shrink-0 shadow-sm cursor-pointer active:scale-95 transition-transform" title={`Ingredients Label ${i + 1}`} onClick={() => onEditBrand(brand)}>
                                    <img src={img} alt={`ING ${i + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <button onClick={() => onEditBrand(brand)} className="flex items-center gap-1 text-[7px] font-bold text-emerald-500 uppercase tracking-wide pt-0.5 active:scale-95 transition-transform"><Camera size={8}/>Upload Ingredients Label</button>
                            )}
                          </div>
                        </div>}
                    </div>

                    <div className="px-3.5 pb-3">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">Vendors</span>
                        <div className="flex flex-wrap gap-1.5">
                            {brand.linkedSuppliers.map((s, i) => (
                                <div key={i} className={`flex items-center gap-1 pl-2 pr-1 py-1 bg-white border rounded-lg text-[8px] font-black uppercase shadow-sm ${s.status === 'Inactive' ? 'text-slate-300 border-slate-100' : 'text-indigo-600 border-indigo-100'}`}>
                                    <Warehouse size={9}/> <span className={s.status === 'Inactive' ? 'line-through' : ''}>{s.name}</span>
                                    <div className="flex items-center ml-0.5 pl-1 border-l border-slate-100">
                                        <button onClick={() => onToggleSupplier(brand.id, s.name)} className={`p-0.5 rounded ${s.status === 'Inactive' ? 'text-emerald-500' : 'text-rose-400'}`}>{s.status === 'Inactive' ? <Power size={9}/> : <ZapOff size={9}/>}</button>
                                        <button onClick={() => onDeleteSupplier(brand.id, s.name)} className="p-0.5 rounded text-slate-300 active:text-rose-600"><X size={9}/></button>
                                    </div>
                                </div>
                            ))}
                            <button onClick={() => onAddVendor(brand.id)} className="px-2 py-1 bg-white border border-dashed border-indigo-200 text-indigo-500 rounded-lg text-[8px] font-black uppercase active:scale-95">+ Add</button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase">
                            <Calendar size={10}/> Exp: <span className="text-slate-600 font-black">{brand.testingDate}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <button onClick={() => onAudit(brand)} className="p-1.5 text-slate-400 active:text-indigo-600 rounded-lg"><History size={15}/></button>
                            <button onClick={() => onToggleBrand(brand.id)} className={`p-1.5 rounded-lg ${brand.status === 'Inactive' ? 'text-emerald-600' : 'text-rose-500'}`}>{brand.status === 'Inactive' ? <Power size={15}/> : <ZapOff size={15}/>}</button>
                            <button onClick={() => onDeleteBrand(brand.id)} className="p-1.5 text-slate-300 active:text-rose-600 rounded-lg"><Trash2 size={15}/></button>
                        </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>

    {brandImgModal && (
        <BrandImageModal
            brand={brandImgModal}
            onClose={() => setBrandImgModal(null)}
            onSave={(imgs, collage) => {
                const updatedBrands = item.brands.map(b =>
                    b.id === brandImgModal.id
                        ? { ...b, images: imgs, collageImage: collage, image: collage || imgs[0] || b.image }
                        : b
                );
                onUpdate(item.id, { brands: updatedBrands });
                setBrandImgModal(null);
            }}
        />
    )}

    {lightboxImage && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-3xl max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <img src={lightboxImage} alt="Enlarged view" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain" />
                <button onClick={() => setLightboxImage(null)} className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all">
                    <X size={18} />
                </button>
            </div>
        </div>
    )}
    </>
  );
};

const RMChecklistModuleLazy = React.lazy(() => import('./RMChecklistModule'));

const RawMaterialList: React.FC<Omit<RawMaterialListProps, 'listType'>> = (props) => {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'fcm' | 'rm-checklist'>('ingredients');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 md:px-4 pt-2 pb-0 bg-white border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${activeTab === 'ingredients' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-1.5">
            <FlaskConical size={14} />
            Ingredients
          </span>
        </button>
        <button
          onClick={() => setActiveTab('fcm')}
          className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${activeTab === 'fcm' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-1.5">
            <Package size={14} />
            Food Contact Material
          </span>
        </button>
        <button
          onClick={() => setActiveTab('rm-checklist')}
          className={`px-4 py-2.5 text-xs md:text-sm font-bold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${activeTab === 'rm-checklist' ? 'border-violet-600 text-violet-700 bg-violet-50/60' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <span className="flex items-center gap-1.5">
            <ClipboardList size={14} />
            RM Checklist Form
          </span>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'ingredients' ? (
          <RawMaterialListInner key="ingredients" {...props} listType="ingredients" />
        ) : activeTab === 'fcm' ? (
          <RawMaterialListInner key="fcm" {...props} listType="fcm" />
        ) : (
          <React.Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /><span className="ml-3 text-sm text-slate-400">Loading RM Checklist...</span></div>}>
            <RMChecklistModuleLazy entities={props.entities} currentScope={props.currentScope} userRootId={props.userRootId ?? undefined} />
          </React.Suspense>
        )}
      </div>
    </div>
  );
};

export default RawMaterialList;
