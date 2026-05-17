
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { compressImage } from '@/utils/imageCompression';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { 
  Star, 
  AlertTriangle, 
  RefreshCw, 
  Upload, 
  Plus, 
  FileSpreadsheet, 
  Search, 
  Camera, 
  Play, 
  Eye, 
  X, 
  Edit, 
  UserPlus, 
  MessageSquare, 
  Trash2, 
  Flag, 
  User, 
  UserCheck, 
  CheckCircle2, 
  AlertOctagon,
  Calculator,
  MapPin,
  Clock,
  MoreHorizontal,
  Check,
  Filter,
  ChevronDown,
  Calendar,
  Layout,
  FileText,
  ImageIcon,
  DollarSign,
  PenTool,
  Layers,
  ShieldCheck,
  Hourglass,
  Ban,
  CheckCheck,
  ChevronUp,
  Maximize2,
  Info,
  List,
  Wrench, 
  History,
  XCircle, 
  Link as LinkIcon, 
  Repeat, 
  GitCommit, 
  CornerDownRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Signal,
  MessageCircle,
  Minimize2,
  Loader2,
  BookOpen,
  Building,
  Globe,
  Briefcase,
  ArrowRight,
  ShieldAlert,
  Users,
  Package,
  Hash,
  SlidersHorizontal,
  Zap,
  Factory,
  Save
} from 'lucide-react';
import ComplaintFormModal from './ComplaintFormModal';
import { Entity, HierarchyScope } from '../types';
import UnifiedPagination from './UnifiedPagination';

// --- Types ---

type ReportStatus = 'Resolved' | 'In Progress' | 'Open' | 'Pending Verification';
type DeviationLevel = 'Critical' | 'Major' | 'Minor';
type RiskLevel = 'High' | 'Medium' | 'Low';
type ReportType = 'general' | 'breakdown';

interface TrackingStep {
  id: string;
  label: string;
  user?: string;
  role?: string; 
  timestamp?: string;
  status: 'completed' | 'pending' | 'current';
  slaStatus?: 'on-time' | 'delayed' | 'risk' | 'critical';
  comments?: string;
}

interface BreakdownHistoryEntry {
  date: string;
  user: string;
  action: string; 
  comments: string;
  cost?: number;
  signature?: string; 
}

interface FollowUpInfo {
  count: number;
  lastDate: string;
  type: 'Not Done' | 'N/A' | 'Compliance';
}

interface ReportItem {
  id: string;
  title: string;
  sop: string;
  deviation: DeviationLevel;
  riskScore: number;
  riskLevel: RiskLevel;
  responsibility: string;
  responsibilityId?: string;
  
  unitId?: string;
  departmentId?: string;
  createdById?: string;

  staffInvolved?: string[];
  assetId?: string[];
  foodCategory?: string[];

  closureComments?: string;
  location: {
    zone: string;
    site: string;
    department: string;
    area: string;
  };
  status: ReportStatus;
  reportingDate: string;
  closureDate?: string;
  duration: string;
  tracking: TrackingStep[];
  evidence: {
    beforeType: 'image' | 'video';
    beforeUrl: string;
    afterType?: 'image' | 'video';
    afterUrl?: string;
  };
  isStarred: boolean;
  type: ReportType;
  
  followUpInfo?: FollowUpInfo;
  parentReportId?: string; 
  linkedReportId?: string; 
  
  breakdownDetails?: {
    isActive: boolean; 
    status: 'active' | 'pending-verification' | 'resolved';
    equipment?: string;
    rootCause?: string;
    tentativeDate?: string;
    totalCost: number;
    history: BreakdownHistoryEntry[];
  };
}

// --- Global Helpers ---

const getOrdinal = (n: number) => { 
  const s = ["th", "st", "nd", "rd"]; 
  const v = n % 100; 
  return s[(v - 20) % 10] || s[v] || s[0]; 
};

const getEscalationInfo = (report: ReportItem) => {
    if (report.riskScore >= 25) return { label: 'L4', color: 'bg-purple-100 text-purple-700 border-purple-200', title: 'Severe Risk' };
    if (report.deviation === 'Critical') return { label: 'L3', color: 'bg-red-100 text-red-700 border-red-200', title: 'Critical Risk' };
    if (report.deviation === 'Major') return { label: 'L2', color: 'bg-orange-100 text-orange-700 border-orange-200', title: 'Major Risk' };
    return { label: 'L1', color: 'bg-blue-100 text-blue-700 border-blue-200', title: 'Minor Risk' };
};

const renderItemWithCount = (arr: string[] | undefined, Icon: any, colorClass: string, freqMap: Record<string, number>) => {
    if (!arr || arr.length === 0) return null;
    const uniqueItems = Array.from(new Set(arr));

    return uniqueItems.map((name) => {
        const count = freqMap[name] || 0;
        return (
            <span key={name} className={`flex items-center gap-1 px-1.5 py-0.5 bg-white border rounded text-[9px] font-black uppercase ${colorClass}`}>
                <Icon size={10}/> {name} {count > 1 ? `(${count})` : ''}
            </span>
        );
    });
};


// --- Mock Data Generator ---

const generateExtraReports = (): ReportItem[] => {
  const extra: ReportItem[] = [];
  const statuses: ReportStatus[] = ['Open', 'Resolved', 'In Progress', 'Pending Verification'];
  const deviations: DeviationLevel[] = ['Minor', 'Major', 'Critical'];
  const depts = ['Main Kitchen', 'Housekeeping', 'Engineering', 'Front Office'];
  const areas = ['Prep Area', 'Cold Storage', 'Lobby', 'Loading Dock', 'Banquet Hall'];
  const sops = ['Food Handling', 'Personal Hygiene', 'Pest Control', 'Waste Management', 'Cleaning Schedule'];
  
  for (let i = 0; i < 125; i++) {
    const idNum = 100 + i;
    const status = statuses[i % 4];
    const isResolved = status === 'Resolved';
    
    extra.push({
      id: `20122025-${idNum}`,
      title: `${['Unclean surface found', 'Temperature fluctuation detected', 'Staff not wearing PPE', 'Equipment noise reported', 'Pest sighting reported'][i % 5]} in ${areas[i % 5]}`,
      sop: sops[i % 5],
      deviation: deviations[i % 3],
      riskScore: 5 + (i % 25),
      riskLevel: i % 3 === 0 ? 'Low' : i % 3 === 1 ? 'Medium' : 'High',
      responsibility: depts[i % 4],
      responsibilityId: `dept-${i % 4}`,
      unitId: 'unit-ny-kitchen',
      departmentId: `dept-${i % 4}`,
      createdById: 'user-system',
      staffInvolved: i % 4 === 0 ? ['Manager A', 'Staff X'] : undefined,
      assetId: i % 6 === 0 ? ['Asset #001'] : undefined,
      foodCategory: i % 5 === 0 ? ['Dairy'] : undefined,
      closureComments: isResolved ? 'Issue rectified immediately. Staff retrained.' : undefined,
      location: {
        zone: i % 2 === 0 ? 'North America' : 'EMEA',
        site: i % 2 === 0 ? 'NYC Central Kitchen' : 'Berlin Facility',
        department: depts[i % 4],
        area: areas[i % 5]
      },
      status: status,
      reportingDate: '2025-05-18',
      closureDate: isResolved ? '2025-05-19' : undefined,
      duration: `${i + 1}d 4h`,
      evidence: {
        beforeType: 'image',
        beforeUrl: `https://images.unsplash.com/photo-${['1584634731339-252c581abfc5', '1584269656462-2334cb2823c1', '1599696840432-8493c0429a34'][i % 3]}?q=80&w=200`,
      },
      tracking: [
        { id: `t-gen-${i}-1`, label: 'Reported', user: 'System', timestamp: '18-May 09:00', status: 'completed', slaStatus: 'on-time' },
        ...(isResolved ? [{ id: `t-gen-${i}-2`, label: 'Resolved', user: 'Auto-Bot', timestamp: '19-May 10:00', status: 'completed' as const }] : [])
      ],
      isStarred: i % 15 === 0,
      type: 'general',
      followUpInfo: i % 3 === 0 ? { count: (i % 5) + 1, lastDate: '2025-05-19 10:00', type: 'Not Done' } : undefined
    });
  }
  return extra;
};

export const INITIAL_REPORTS: ReportItem[] = [
  {
    id: '20122025-003',
    title: 'Numerous unattended food items found',
    sop: 'Food Handling',
    deviation: 'Major',
    riskScore: 15,
    riskLevel: 'Medium',
    responsibility: 'Main Kitchen',
    responsibilityId: 'dept-kitchen',
    unitId: 'unit-ny-kitchen',
    departmentId: 'dept-kitchen', 
    createdById: 'user-john',
    staffInvolved: ['Staff A', 'Supervisor B'],
    foodCategory: ['Poultry'],
    closureComments: 'Food items were secured in appropriate storage. The area was sanitized as per protocol.',
    location: {
      zone: 'North America',
      site: 'NYC Central Kitchen',
      department: 'Main Kitchen',
      area: 'Back Area'
    },
    status: 'Resolved',
    reportingDate: '2025-05-19',
    closureDate: '2025-05-20',
    duration: '1d 4h 15m total',
    evidence: {
      beforeType: 'image',
      beforeUrl: 'https://images.unsplash.com/photo-1584269656462-2334cb2823c1?q=80&w=200&auto=format&fit=crop',
      afterType: 'image',
      afterUrl: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?q=80&w=200&auto=format&fit=crop'
    },
    tracking: [
      { id: 't1', label: 'Reported', user: 'John Doe', role: 'Head Chef', timestamp: '19-May 10:30', status: 'completed', slaStatus: 'on-time', comments: 'Incident logged via mobile app.' },
      { id: 't2', label: 'Acknowledged', user: 'Rahul V.', role: 'Area Owner', timestamp: '19-May 14:30', status: 'completed', slaStatus: 'delayed', comments: 'Acknowledged delay due to shift change.' },
      { id: 't3', label: 'Action Taken', user: 'Ajay S.', role: 'Staff', timestamp: '19-May 15:05', status: 'completed', slaStatus: 'on-time', comments: 'Items moved to chiller.' },
      { id: 't4', label: 'Resolved', user: 'Ajay S.', role: 'Staff', timestamp: '20-May 14:45', status: 'completed', slaStatus: 'on-time', comments: 'Sanitization complete.' },
      { id: 't5', label: 'Verified', user: 'System', role: 'Auto', timestamp: '20-May 14:45', status: 'completed', slaStatus: 'on-time' }
    ],
    isStarred: true,
    type: 'general',
    followUpInfo: { count: 3, lastDate: '2025-05-20 14:45', type: 'Compliance' }
  },
  {
    id: '20122025-002',
    title: 'Faulty fire alarm panel flashing error',
    sop: 'Safety Equipment',
    deviation: 'Critical',
    riskScore: 25,
    riskLevel: 'High',
    responsibility: 'Engineering Team',
    responsibilityId: 'dept-eng-la', 
    unitId: 'unit-la-depot',
    departmentId: 'dept-eng-la',
    createdById: 'user-lucas',
    assetId: ['Device #X2'],
    closureComments: '',
    location: {
      zone: 'North America',
      site: 'LA Logistics Unit',
      department: 'Engineering',
      area: 'Hall 3'
    },
    status: 'In Progress',
    reportingDate: '2025-05-22',
    duration: '576d 20h 13m ago',
    evidence: {
      beforeType: 'image',
      beforeUrl: 'https://images.unsplash.com/photo-1599696840432-8493c0429a34?q=80&w=200&auto=format&fit=crop',
      afterType: 'video', 
      afterUrl: '' 
    },
    tracking: [
      { id: 't1', label: 'Reported', user: 'Lucas Sinclair', timestamp: '22-May 11:00', status: 'completed', slaStatus: 'on-time' },
      { id: 't2', label: 'Acknowledged', user: 'Rahul V.', timestamp: '22-May 11:05', status: 'completed', slaStatus: 'on-time' },
      { id: 't3', label: 'Assigned', user: 'Eng. Team', timestamp: '22-May 11:30', status: 'completed', slaStatus: 'on-time', comments: 'Assigned to specialized technician.' },
      { id: 't4', label: 'Action Taken', user: 'Eng. Team', timestamp: 'In Progress', status: 'current', slaStatus: 'critical', comments: 'Waiting for spare parts.' },
      { id: 't5', label: 'Verified', status: 'pending' }
    ],
    isStarred: false,
    type: 'breakdown',
    breakdownDetails: {
      isActive: true,
      status: 'active',
      equipment: 'Fire Alarm Panel #3',
      rootCause: 'Circuit board malfunction',
      totalCost: 0,
      history: [
        { date: '22-May 11:30', user: 'System', action: 'Initiated', comments: 'Initial diagnosis complete. Spare part ordered.', cost: 0 }
      ]
    }
  },
  ...generateExtraReports()
];

// --- Global Helpers ---

const fetchImage = async (url: string): Promise<ArrayBuffer | null> => { try { const response = await fetch(url); const blob = await response.blob(); return await blob.arrayBuffer(); } catch (error) { console.error("Failed to fetch image for excel export", error); return null; } };

// --- Multi-select Collapsible Block Component ---

interface CollapsibleFilterBlockProps {
  title: string;
  icon: React.ElementType;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  count?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const CollapsibleFilterBlock: React.FC<CollapsibleFilterBlockProps> = ({ title, icon: Icon, options, selected, onToggle, count = 0, isExpanded: externalIsExpanded, onToggleExpand }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(count > 0);
  const isOpen = externalIsExpanded !== undefined ? externalIsExpanded : internalIsOpen;
  const toggle = onToggleExpand !== undefined ? onToggleExpand : () => setInternalIsOpen(!internalIsOpen);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    return options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50/30">
      <button 
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className={`w-full flex items-center justify-between p-3 transition-colors ${isOpen ? 'bg-blue-50 text-blue-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={14} className={isOpen ? 'text-blue-600' : 'text-slate-400'} />
          <span className="text-[11px] font-black uppercase tracking-wider">{title}</span>
          {count > 0 && !isOpen && (
            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full shadow-sm ml-1 animate-in zoom-in-50">
              {count}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="bg-white border-t border-slate-100 animate-in slide-in-from-top-2">
          <div className="p-2 border-b border-slate-50 bg-slate-50/20">
            <div className="relative group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold outline-none focus:border-blue-400 transition-all placeholder:text-slate-300"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="p-2 space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <label key={opt} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors text-[11px] font-bold text-slate-600 group">
                <input 
                  type="checkbox" 
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" 
                />
                <span className="group-hover:text-slate-900 truncate">{opt}</span>
              </label>
            )) : (
              <div className="p-4 text-center text-[10px] text-slate-400 italic">No matches found for "{query}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Helper Components ---

const SummaryCard = ({ label, value, color, icon: Icon }: { label: string, value: string | number, color: string, icon: React.ElementType }) => (
  <div className={`p-4 rounded-xl shadow-sm text-white ${color} flex items-center justify-between min-w-[200px] snap-center shrink-0`}>
    <div>
      <p className="text-xs font-bold uppercase opacity-80">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
    <div className="bg-white/20 p-2 rounded-lg">
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

const EvidenceThumbnail = ({ url, type, label }: { url: string, type: 'image' | 'video', label: string }) => (
  <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex-shrink-0 cursor-pointer">
    {type === 'image' ? (
      <img src={url} alt={label} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        <Play className="w-6 h-6 text-white" />
      </div>
    )}
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
      <Eye className="w-4 h-4 text-white" />
    </div>
    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5">{label}</span>
  </div>
);

const StatusBadge = ({ status, duration, resolvedBy }: { status: ReportStatus, duration: string, resolvedBy?: string }) => {
  const styles = {
    'Resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'Open': 'bg-red-100 text-red-700 border-red-200',
    'Pending Verification': 'bg-yellow-100 text-yellow-700 border-yellow-200'
  };
  
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
      {status === 'Resolved' && resolvedBy && (
        <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded uppercase leading-none truncate max-w-full">
           By: {resolvedBy}
        </div>
      )}
      <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
        <Clock className="w-3 h-3" /> {duration}
      </span>
    </div>
  );
};

const TrackingStepper = ({ steps, title }: { steps: TrackingStep[], title?: string }) => {
  return (
    <div className="relative pl-2 py-1">
      {title && <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-1">{title}</div>}
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-4 mb-6 last:mb-0 relative group">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full z-10 border-2 border-white ring-1 ${
              step.status === 'completed' ? 'bg-green-50 ring-green-500' : 
              step.status === 'current' ? 'bg-blue-50 ring-blue-500 animate-pulse' : 'bg-slate-200 ring-slate-300'
            }`} />
            {idx < steps.length - 1 && <div className="w-0.5 h-full bg-slate-100 absolute top-3 bottom-[-24px] left-[5px] group-last:hidden" />}
          </div>
          <div className="flex-1 -mt-1">
            <div className="flex justify-between items-start mb-1">
              <span className={`text-xs font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{step.label}</span>
              {step.timestamp && <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{step.timestamp}</span>}
            </div>
            {step.user && (
                <div className="flex items-center gap-1.5 mb-1">
                   <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                      {step.user.charAt(0)}
                   </div>
                   <span className="text-10px font-semibold text-slate-600">{step.user} <span className="text-slate-400 font-normal">{step.role ? `(${step.role})` : ''}</span></span>
                </div>
            )}
            {step.comments && (
                <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                   "{step.comments}"
                </div>
            )}
            {step.slaStatus && step.slaStatus !== 'on-time' && step.status !== 'pending' && (
                <div className={`inline-flex mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    step.slaStatus === 'delayed' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 
                    step.slaStatus === 'critical' ? 'bg-red-50 text-red-600 border-red-100' : 
                    'bg-yellow-50 text-yellow-600 border-yellow-100'
                }`}>
                    {step.slaStatus}
                </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Action Grid Component ---
const ActionGrid = ({ report, onAction, isMobile = false }: { report: ReportItem, onAction: (type: string) => void, isMobile?: boolean }) => {
  const breakdownDetails = report.breakdownDetails;
  const breakdownStatus = breakdownDetails?.status;
  const isBreakdownActive = breakdownDetails?.isActive;
  const [showProcessMenu, setShowProcessMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setShowProcessMenu(false);
        }
    }
    if (showProcessMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProcessMenu]);

  const btnClass = isMobile 
    ? "w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95" 
    : "w-8 h-8 rounded-lg flex items-center justify-center transition-colors";
  const containerClass = isMobile ? "flex flex-wrap justify-between gap-3 w-full relative" : "grid grid-cols-4 gap-1.5 w-full max-w-[200px] relative";
  const iconClass = isMobile ? "w-5 h-5" : "w-4 h-4";
  const iconClassLg = isMobile ? "w-6 h-6" : "w-5 h-5";

  if (report.status === 'Resolved') {
    return (
      <div className={`flex gap-1.5 w-full justify-center ${isMobile ? 'gap-3 mt-2' : ''}`}>
        {report.type === 'breakdown' && (
           <button title="Breakdown History" onClick={() => onAction('view-breakdown-history')} className={`${btnClass} bg-green-50 border border-green-200 hover:bg-green-100`}><Wrench className={`${iconClass} text-green-600`} /></button>
        )}
        <button title="Mark Compliant" onClick={() => onAction('compliance')} className={`${btnClass} bg-green-50 text-green-700 border border-green-200 hover:bg-green-100`}><CheckCircle2 className={iconClass} /></button>
        <button title="Mark Non-Compliant" onClick={() => onAction('not-compliance')} className={`${btnClass} bg-red-50 text-red-700 border border-red-200 hover:bg-red-100`}><XCircle className={iconClass} /></button>
        <button title="Mark N/A" onClick={() => onAction('hold')} className={`${btnClass} bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100`}><Ban className={iconClass} /></button>
        <button title="View Activity Log" onClick={() => onAction('view-tracking')} className={`${btnClass} bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100`}><History className={iconClass} /></button>
        <button title="Delete Record" onClick={() => onAction('delete')} className={`${btnClass} bg-red-50 text-red-600 border border-red-200 hover:bg-red-100`}><Trash2 className={iconClass} /></button>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <button title="Not Done" onClick={() => onAction('reject')} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50 text-slate-700`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} rounded-full bg-red-500 flex items-center justify-center`}><X className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-white`} strokeWidth={3} /></div></button>
      <button title="Not Applicable" onClick={() => onAction('hold')} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50 text-slate-400`}><Ban className={iconClassLg} /></button>
      {!breakdownDetails ? (
        <button title="Mark as Breakdown" onClick={() => onAction('initiate-breakdown')} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-red-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-red-600 fill-current`} /></div></button>
      ) : (
        <>
            {breakdownStatus === 'active' && (<button title="Update Breakdown" onClick={() => onAction('update-breakdown')} className={`${btnClass} border border-blue-200 bg-blue-50 hover:bg-blue-100`}><Wrench className={`${iconClassLg} text-blue-600`} /></button>)}
            {breakdownStatus === 'pending-verification' && (<button title="Verify Closure" onClick={() => onAction('verify-breakdown')} className={`${btnClass} border border-yellow-200 bg-white hover:bg-yellow-50 animate-pulse`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-yellow-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-yellow-600 fill-current`} /></div></button>)}
            {(breakdownStatus === 'resolved' || !isBreakdownActive) && (<button title="View History" onClick={() => onAction('view-breakdown-history')} className={`${btnClass} border border-green-200 bg-white hover:bg-yellow-50`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-green-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-green-600 fill-current`} /></div></button>)}
        </>
      )}
      <button title="Edit" onClick={() => onAction('edit')} className={`${btnClass} border border-slate-200 bg-gray-50 hover:bg-gray-100 text-slate-700`}><Edit className={iconClass} /></button>
      <div className="relative" ref={menuRef}>
          <button onClick={() => setShowProcessMenu(!showProcessMenu)} className={`${btnClass} ${showProcessMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50'}`}><Layers className={iconClass} /></button>
          {showProcessMenu && (
              isMobile ? (
                <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowProcessMenu(false)}>
                    <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3"><h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Process Actions</h3><button onClick={() => setShowProcessMenu(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={16}/></button></div>
                        <div className="space-y-2">
                            <button onClick={() => { onAction('staffAck'); setShowProcessMenu(false); }} className="w-full flex items-center gap-3 p-4 bg-yellow-50 rounded-xl text-left text-sm font-bold text-yellow-700 hover:bg-yellow-100 active:scale-95 transition-all"><div className="p-2 bg-yellow-100 rounded-lg"><Hourglass size={18} /></div> Schedule Task</button>
                            <button onClick={() => { onAction('assign'); setShowProcessMenu(false); }} className="w-full flex items-center gap-3 p-4 bg-cyan-50 rounded-xl text-left text-sm font-bold text-cyan-700 hover:bg-cyan-100 active:scale-95 transition-all"><div className="p-2 bg-cyan-100 rounded-lg"><UserPlus size={18} /></div> Assign Member</button>
                            <button disabled={isBreakdownActive && breakdownStatus !== 'resolved'} onClick={() => { onAction('closure'); setShowProcessMenu(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl text-left text-sm font-bold transition-all active:scale-95 ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}><div className={`p-2 rounded-lg ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'bg-slate-100' : 'bg-green-100'}`}><CheckCheck size={18} /></div> Closure</button>
                        </div>
                    </div>
                </div>
              ) : (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1.5 z-50 animate-in fade-in zoom-in-95 origin-bottom-right">
                    <button onClick={() => { onAction('staffAck'); setShowProcessMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-yellow-50 rounded-lg text-left text-xs font-bold text-yellow-700 transition-colors w-full"><Hourglass size={14} /> Schedule</button>
                    <button onClick={() => { onAction('assign'); setShowProcessMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-cyan-50 rounded-lg text-left text-xs font-bold text-cyan-700 transition-colors w-full"><UserPlus size={14} /> Assign</button>
                    <button disabled={isBreakdownActive && breakdownStatus !== 'resolved'} onClick={() => { onAction('closure'); setShowProcessMenu(false); }} className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-colors w-full ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-green-50 text-green-700'}`}><CheckCheck size={14} /> Closure</button>
                </div>
              )
          )}
      </div>
      <button title="Delete Record" onClick={() => onAction('delete')} className={`${btnClass} bg-red-100 text-red-600 hover:bg-red-200 border border-red-200`}><Trash2 className={iconClass} /></button>
    </div>
  );
};

// --- Modals (Consolidated) ---

const DeleteConfirmationModal = ({ report, onClose, onConfirm }: { report: ReportItem, onClose: () => void, onConfirm: (id: string) => void }) => {
    const [isDeleting, setIsDeleting] = useState(false);
    
    const handleConfirm = () => {
        setIsDeleting(true);
        onConfirm(report.id);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-md overflow-hidden border border-red-100 animate-in zoom-in-95">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-red-50/50">
                        {isDeleting ? <Loader2 className="w-10 h-10 animate-spin" /> : <ShieldAlert size={40} />}
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Confirm Deletion</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                        You are about to permanently delete report <span className="font-black text-red-600">#{report.id}</span>. This action cannot be undone.
                    </p>
                </div>
                <div className="bg-slate-50 px-8 py-6 flex gap-3">
                    <button 
                        disabled={isDeleting}
                        onClick={onClose} 
                        className="flex-1 py-3 px-4 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-100 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={isDeleting}
                        onClick={handleConfirm} 
                        className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isDeleting ? 'Removing...' : 'Delete Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BulkUploadModal = ({ isOpen, onClose, onSave, availableLocations }: { isOpen: boolean, onClose: () => void, onSave: (loc: string, files: File[]) => void, availableLocations: string[] }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-3"><h3 className="text-lg font-bold">Bulk Evidence Upload</h3><button onClick={onClose}><X size={20}/></button></div>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Location/Dept</label>
          <select className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold bg-slate-50 focus:border-blue-500 outline-none" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">Select Location...</option>
            {availableLocations.map(l => <option key={l} value={l}>{l}</option>)}
          </select></div>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all" onClick={() => inputRef.current?.click()}>
             <Upload size={32} className="text-slate-300 mb-2" /><span className="text-sm font-bold text-slate-500">Drag & Drop or Click to Upload</span>
             <input type="file" ref={inputRef} multiple className="hidden" onChange={e => e.target.files && setFiles(Array.from(e.target.files))} />
          </div>
          {files.length > 0 && <div className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 flex items-center justify-between">{files.length} files selected <button onClick={(e) => { e.stopPropagation(); setFiles([]); }} className="text-blue-400 hover:text-red-500"><X size={14}/></button></div>}
          <button onClick={() => onSave(location, files)} disabled={!location || files.length === 0} className="w-full bg-blue-600 text-white rounded-xl py-3.5 text-xs font-black uppercase tracking-widest disabled:opacity-30 shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all">Upload to Database</button>
        </div>
      </div>
    </div>
  );
};

// --- Mobile Report Card Component ---
interface MobileReportCardProps {
  report: ReportItem;
  onAction: (type: string, payload?: any) => void;
  onSelect: () => void;
  lineage?: ReportItem[];
  isRepeat?: boolean;
  rootId?: string;
  distanceFromRoot?: number;
  onFilterThread?: (rootId: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  staffFreq: Record<string, number>;
  assetFreq: Record<string, number>;
  foodFreq: Record<string, number>;
}

const MobileReportCard: React.FC<MobileReportCardProps> = ({ report, onAction, onSelect, lineage, isRepeat, rootId, distanceFromRoot, onFilterThread, isExpanded, onToggleExpand, staffFreq, assetFreq, foodFreq }) => {
  const resolver = report.tracking.find(t => t.label === 'Resolved')?.user;
  const reporter = report.tracking[0]?.user || 'System';
  const lastUpdate = report.tracking[report.tracking.length-1]?.timestamp || 'N/A';
  const lastEvent = report.tracking[report.tracking.length-1];
  const isReopened = report.tracking.some(t => t.label.includes('Reopen'));
  const hasFollowUpNote = report.followUpInfo && report.followUpInfo.type !== 'Compliance';
  const isNegativeFollowUp = report.followUpInfo && (report.followUpInfo.type === 'Not Done' || report.followUpInfo.type === 'N/A');
  const showLatestComment = lastEvent?.comments && !report.closureComments && (report.status !== 'Resolved') && !isNegativeFollowUp;
  const lastFollowUpEvent = [...report.tracking].reverse().find(t => t.label.includes('Follow Up') || t.label === 'Compliance' || t.label === 'Not Done' || t.label === 'N/A');
  const followUpUser = lastFollowUpEvent?.user || 'System';
  const statusDate = report.status === 'Resolved' && report.closureDate ? `Resolved: ${new Date(report.closureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : `Reported: ${new Date(report.reportingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  const escInfo = getEscalationInfo(report);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 relative w-full overflow-hidden">
       <div className="px-4 pt-4 pb-2 flex justify-between items-start"><div className="flex flex-col gap-1.5"><div className="flex gap-2 flex-wrap"><div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border ${report.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : report.status === 'Open' ? 'bg-red-50 text-red-700 border-red-100' :'bg-blue-50 text-blue-700 border-blue-100'}`}>{report.status}</div>{isReopened && report.status !== 'Resolved' && (<div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-orange-100 text-orange-700 border border-orange-200 flex items-center gap-1"><Repeat size={10} /> Reopened</div>)}{report.type === 'breakdown' && (<div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-slate-900 text-white flex items-center gap-1"><Wrench size={10} /> Breakdown</div>)}{isRepeat && rootId && distanceFromRoot !== undefined && onFilterThread && (<button onClick={(e) => { e.stopPropagation(); onFilterThread(rootId); }} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border flex items-center gap-1 ${distanceFromRoot > 2 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}><GitCommit size={10} /> Ref: {rootId} • {distanceFromRoot}{getOrdinal(distanceFromRoot)}</button>)}</div><div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 px-0.5"><span>{statusDate}</span><span className="text-slate-300">•</span><span className="text-slate-500">{report.duration}</span></div></div><div className="flex items-center gap-1.5">
       <Star 
           onClick={(e) => { e.stopPropagation(); onAction('toggle-star'); }}
           className={`w-5 h-5 cursor-pointer transition-all active:scale-125 ${report.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} 
       /><span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{report.id}</span></div></div>
       <div className="px-4 pb-2"><h3 onClick={onSelect} className="text-lg font-black text-slate-800 leading-tight mb-2 mt-1 cursor-pointer active:text-blue-600 transition-colors line-clamp-2">{report.title}</h3><div className="flex flex-wrap gap-2"><span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 truncate max-w-[150px]">{report.sop}</span><span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${report.deviation === 'Critical' ? 'bg-red-50 border-red-100 text-red-600' : report.deviation === 'Major' ? 'bg-orange-50 border-orange-100 text-orange-600' :'bg-yellow-50 border-yellow-100 text-yellow-600'}`}>{report.deviation}</span><span title={escInfo.title} className={`px-2 py-1 rounded text-[10px] font-black uppercase border flex items-center gap-1 ${escInfo.color}`}><Signal size={10} /> {escInfo.label}</span></div></div>
       <div className="px-4 py-2 grid grid-cols-2 gap-2 overflow-hidden"><div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-50"><img src={report.evidence.beforeUrl} className="w-full h-full object-cover" alt="Before" /><div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Before</div></div>{report.evidence.afterUrl && (<div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-50">{report.evidence.afterType === 'video' ? (<div className="w-full h-full flex items-center justify-center bg-slate-800"><Play className="text-white w-8 h-8 opacity-80" /></div>) : (<img src={report.evidence.afterUrl} className="w-full h-full object-cover" alt="After" />)}<div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">After</div></div>)}</div>
        <div className="px-4 pb-4 mt-3">
          <div className="flex items-center justify-between gap-3 mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer active:bg-slate-100 transition-colors group select-none" onClick={onToggleExpand}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-white rounded-lg shadow-sm text-slate-400 shrink-0"><MapPin size={16} /></div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{report.location.department}</div>
                <div className="text-[10px] font-medium text-slate-500 mt-0.5 truncate">{report.location.area} • {report.location.site}</div>
              </div>
            </div>
            <div className={`p-1.5 rounded-full bg-white border border-slate-200 text-slate-400 transition-all duration-300 shrink-0 ${isExpanded ? 'rotate-180 text-blue-600 border-blue-200 shadow-sm' : 'rotate-0'}`}>
              <ChevronDown size={16} />
            </div>
          </div>
          
          {isExpanded && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              {(report.staffInvolved?.length || report.assetId?.length || report.foodCategory?.length) ? (
                <div className="mb-3 flex flex-wrap gap-2 p-2 bg-blue-50/30 rounded-xl border border-blue-100/50">
                  {renderItemWithCount(report.staffInvolved, Users, "border-blue-100 text-blue-700", staffFreq)}
                  {renderItemWithCount(report.assetId, Wrench, "border-orange-100 text-orange-700", assetFreq)}
                  {renderItemWithCount(report.foodCategory, Package, "border-emerald-100 text-emerald-700", foodFreq)}
                </div>
              ) : null}

              <div className="mb-3 bg-slate-50/50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10px]"><span className="font-bold text-slate-400 uppercase tracking-wider">Reported By</span><span className="font-bold text-slate-700">{reporter}</span></div>
                <div className="flex justify-between items-center text-[10px]"><span className="font-bold text-slate-400 uppercase tracking-wider">Last Update</span><span className="font-bold text-slate-700">{lastUpdate}</span></div>
                {resolver && (<div className="flex justify-between items-center text-[10px]"><span className="font-bold text-slate-400 uppercase tracking-wider">Resolved By</span><span className="font-bold text-emerald-600">{resolver}</span></div>)}
                <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="w-full mt-2 py-1.5 bg-white border border-slate-200 rounded text-slate-500 font-bold flex items-center justify-center gap-1.5 text-[10px] shadow-sm hover:text-blue-600 hover:border-blue-200 transition-colors"><History size={12} /> View Activity Log</button>
              </div>
              
              {report.followUpInfo && (<div className={`mb-3 p-3 rounded-xl border ${report.followUpInfo.type === 'Compliance' ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}><div className="flex justify-between items-center mb-2"><span className={`text-[10px] font-black uppercase tracking-widest ${report.followUpInfo.type === 'Compliance' ? 'text-emerald-700' : 'text-orange-700'}`}>{report.followUpInfo.type}</span><span className="text-[9px] font-bold bg-white/60 px-1.5 py-0.5 rounded text-slate-600">Attempt #{report.followUpInfo.count}</span></div><div className={`pt-2 mt-1 border-t flex justify-between items-center text-[10px] font-bold ${report.followUpInfo.type === 'Compliance' ? 'border-emerald-100 text-emerald-600' : 'border-orange-100 text-orange-600'}`}><span>By: {followUpUser}</span><span>{report.followUpInfo.lastDate.split(' ')[0]}</span></div></div>)}
              
              {showLatestComment && (<div className={`mb-4 rounded-xl p-3 border ${hasFollowUpNote ? 'bg-red-50 border-red-100' : 'bg-yellow-50 border-yellow-100'}`}><div className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${hasFollowUpNote ? 'text-red-400' : 'text-yellow-600'}`}>Latest Feedback</div><p className={`text-xs leading-relaxed italic ${hasFollowUpNote ? 'text-red-800' : 'text-slate-700'}`}>"{lastEvent.comments}"</p></div>)}
              
              {report.closureComments && (<div className="mb-4"><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Closure Note</div><p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-100 p-3 rounded-lg shadow-sm">{report.closureComments}</p></div>)}
            </div>
          )}
          
          <div className="pt-4 border-t border-slate-100">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Quick Actions</div>
            <ActionGrid report={report} onAction={(type) => onAction(type)} isMobile={true} />
          </div>
        </div>
    </div>
  )
}

// --- Main Component ---

interface FollowUpDashboardProps {
  availableSops?: string[];
  availableDepartments?: string[];
  availableLocations?: string[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  entities?: Entity[];
}

const FollowUpDashboard: React.FC<FollowUpDashboardProps> = ({ 
  availableSops = [], 
  availableDepartments = [],
  availableLocations = [],
  currentScope = 'super-admin',
  userRootId,
  entities = []
}) => {
  const [reports, setReports] = useState<ReportItem[]>(INITIAL_REPORTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFollowUpOnly, setShowFollowUpOnly] = useState(false);
  const [showBreakdownOnly, setShowBreakdownOnly] = useState(false);
  const [activeModal, setActiveModal] = useState<'bulkUpload' | 'newReport' | 'filter' | 'staffAck' | 'closure' | 'breakdown' | 'verification' | 'tracking' | 'reopenObservation' | 'deleteConfirm' | 'mobileFilters' | null>(null);
  const [breakdownMode, setBreakdownMode] = useState<'initiate' | 'update' | 'history'>('initiate');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<string | null>(null);
  const headerDropdownRef = useRef<HTMLDivElement>(null);
  
  // New State for specific Action Filter
  const [actionFilter, setActionFilter] = useState<string>('');
  
  // Breakdown Form State
  const [breakdownForm, setBreakdownForm] = useState({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' });
  const [equipSearch, setEquipSearch] = useState('');
  const [isEquipDropdownOpen, setIsEquipDropdownOpen] = useState(false);

  // Accordion State for Filters
  const [openFilterSection, setOpenFilterSection] = useState<string | null>(null);

  // Filter States
  const [detailFilters, setDetailFilters] = useState<{ 
      sops: string[], 
      risks: string[], 
      escalations: string[],
      staff: string[],
      assets: string[],
      foods: string[]
  }>({ 
      sops: [], 
      risks: [], 
      escalations: [],
      staff: [],
      assets: [],
      foods: []
  });
  const [locationFilters, setLocationFilters] = useState<{ regional: string[], unit: string[], department: string[], location: string[] }>({ regional: [], unit: [], department: [], location: [] });
  const [statusColumnFilters, setStatusColumnFilters] = useState<string[]>([]);
  const [followUpProfileFilters, setFollowUpProfileFilters] = useState<string[]>([]);
  const [followUpCountFilter, setFollowUpCountFilter] = useState<string>(''); 
  const [obsDateRange, setObsDateRange] = useState({ from: '', to: '' });
  const [closeDateRange, setCloseDateRange] = useState({ from: '', to: '' });

  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [tickerAlert, setTickerAlert] = useState<{type: 'breakdown' | 'verify' | 'success', message: string} | null>(null);
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(10);

  const filteredEquipment = [].filter(eq => eq.toLowerCase().includes(equipSearch.toLowerCase()));

  useEffect(() => { setCurrentPage(1); }, [searchTerm, showFollowUpOnly, showBreakdownOnly, filters, detailFilters, locationFilters, statusColumnFilters, followUpProfileFilters, followUpCountFilter, obsDateRange, closeDateRange, threadFilter, itemsPerPage, actionFilter]);

  const getIssueLineage = (currentId: string, allReports: ReportItem[]) => {
      const chain: ReportItem[] = [];
      let current = allReports.find(r => r.id === currentId);
      while(current) { chain.push(current); if(!current.parentReportId) break; current = allReports.find(r => r.id === currentId); current = allReports.find(r => r.id === current?.parentReportId); }
      return chain; 
  };

  const findAncestorByType = (entityId: string | null | undefined, type: HierarchyScope, allEntities: Entity[]): Entity | undefined => {
    if (!entityId) return undefined;
    const entity = allEntities.find(e => e.id === entityId);
    if (!entity) return undefined;
    if (entity.type === type) return entity;
    return findAncestorByType(entity.parentId, type, allEntities);
  };

  const isDescendant = (ancestorId: string, potentialDescendantId: string, allEntities: Entity[]) => {
      let current = allEntities.find(e => e.id === potentialDescendantId);
      while (current) {
          if (current.id === ancestorId) return true;
          current = allEntities.find(e => e.id === current?.parentId);
      }
      return false;
  };

  const handleAction = (type: string, reportId: string) => {
      setSelectedReportId(reportId);
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      const timestamp = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

      switch (type) {
        case 'toggle-star':
            setReports(prev => prev.map(r => r.id === reportId ? { ...r, isStarred: !r.isStarred } : r));
            break;
        case 'reject':
        case 'hold':
        case 'compliance': {
            const followUpType = type === 'reject' ? 'Not Done' : type === 'hold' ? 'N/A' : 'Compliance';
            const currentCount = report.followUpInfo?.count || 0;
            let actionComment = `Logged follow-up status as ${followUpType}.`;
            if (type === 'reject') actionComment = "Work Rejected: Issue persists or fix was inadequate.";
            
            setReports(prev => prev.map(r => r.id === reportId ? { 
                ...r, 
                followUpInfo: { type: followUpType, count: currentCount + 1, lastDate: timestamp }, 
                tracking: [...r.tracking, { 
                    id: `t-fup-${Date.now()}`, 
                    label: `Follow Up: ${followUpType}`, 
                    user: 'Auditor', 
                    timestamp, 
                    status: 'completed' as const, 
                    slaStatus: type === 'reject' ? 'critical' : 'on-time', 
                    comments: actionComment 
                }] 
            } : r));
            
            setTickerAlert({ type: 'success', message: `Follow-up status "${followUpType}" recorded.` });
            setTimeout(() => setTickerAlert(null), 3000);
            break;
        }
        case 'initiate-breakdown':
            setBreakdownForm({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' });
            setBreakdownMode('initiate');
            setActiveModal('breakdown');
            break;
        case 'update-breakdown':
            setBreakdownMode('update');
            setBreakdownForm({ equipment: '', cause: '', date: new Date().toISOString().split('T')[0], action: '', cost: '' });
            setActiveModal('breakdown');
            break;
        case 'verify-breakdown':
            setActiveModal('verification');
            break;
        case 'view-breakdown-history':
            setBreakdownMode('history');
            setActiveModal('breakdown');
            break;
        case 'closure':
            setActiveModal('closure');
            break;
        case 'staffAck':
            setActiveModal('staffAck');
            break;
        case 'not-compliance':
            setActiveModal('reopenObservation');
            break;
        case 'view-tracking':
            setActiveModal('tracking');
            break;
        case 'delete':
            setActiveModal('deleteConfirm');
            break;
        default:
            console.warn(`Unhandled action type: ${type}`);
            break;
      }
  };

  const handleSaveBreakdown = () => {
      if (!selectedReportId) return;
      setReports(prev => prev.map(r => {
          if (r.id !== selectedReportId) return r;
          
          const historyEntry: BreakdownHistoryEntry = {
              date: breakdownForm.date,
              user: 'Current User',
              action: 'Breakdown Reported',
              comments: `Cause: ${breakdownForm.cause}. Action: ${breakdownForm.action}`,
              cost: 0
          };

          return {
              ...r,
              type: 'breakdown',
              breakdownDetails: {
                  isActive: true,
                  status: 'active',
                  equipment: breakdownForm.equipment,
                  rootCause: breakdownForm.cause,
                  totalCost: 0,
                  history: r.breakdownDetails?.history ? [...r.breakdownDetails.history, historyEntry] : [historyEntry]
              },
               tracking: [...r.tracking, { 
                  id: `t-bd-${Date.now()}`, 
                  label: 'Breakdown Reported', 
                  user: 'Current User', 
                  timestamp: new Date().toLocaleString(), 
                  status: 'current', 
                  slaStatus: 'critical', 
                  comments: `Equipment: ${breakdownForm.equipment}. Cause: ${breakdownForm.cause}` 
              }]
          };
      }));
      setActiveModal(null);
      setTickerAlert({ type: 'breakdown', message: 'Breakdown status initiated successfully.' });
      setTimeout(() => setTickerAlert(null), 3000);
  };

  const handleBreakdownUpdate = (resolve: boolean) => {
    if (!selectedReportId) return;
    setReports(prev => prev.map(r => {
        if (r.id !== selectedReportId) return r;
        
        const costVal = parseFloat(breakdownForm.cost) || 0;
        const historyEntry: BreakdownHistoryEntry = {
            date: breakdownForm.date,
            user: 'Current User',
            action: resolve ? 'Breakdown Resolved (Pending Verification)' : 'Maintenance Update',
            comments: breakdownForm.action,
            cost: costVal
        };

        const currentTotalCost = r.breakdownDetails?.totalCost || 0;

        return {
            ...r,
            breakdownDetails: {
                ...r.breakdownDetails!,
                // If resolving, move to pending-verification. If not resolving (update), stay active.
                status: resolve ? 'pending-verification' : 'active',
                isActive: true, // Remains active until verified
                totalCost: currentTotalCost + costVal,
                history: [...(r.breakdownDetails?.history || []), historyEntry]
            },
            tracking: [...r.tracking, {
                id: `t-bd-${Date.now()}`,
                label: resolve ? 'Breakdown Pending Verification' : 'Maintenance Update',
                user: 'Current User',
                timestamp: new Date().toLocaleString(),
                status: 'current',
                slaStatus: resolve ? 'on-time' : 'critical',
                comments: `Action: ${breakdownForm.action}. Cost: ${costVal}`
            }]
        };
    }));
    setActiveModal(null);
    setTickerAlert({ 
        type: 'breakdown', 
        message: resolve ? 'Breakdown marked for verification.' : 'Maintenance update posted.' 
    });
    setTimeout(() => setTickerAlert(null), 3000);
  };

  const handleBreakdownVerification = () => {
      if (!selectedReportId) return;
      setReports(prev => prev.map(r => {
          if (r.id !== selectedReportId) return r;
          
          return {
              ...r,
              breakdownDetails: {
                  ...r.breakdownDetails!,
                  status: 'resolved',
                  isActive: false,
                  history: [...(r.breakdownDetails?.history || []), {
                      date: new Date().toISOString().split('T')[0],
                      user: 'QA Verifier',
                      action: 'Breakdown Verified',
                      comments: 'Repairs verified successful.',
                      cost: 0
                  }]
              },
              // Maybe update main report status too? Usually separate but related. 
              // Assuming Breakdown is a sub-status.
          };
      }));
      setActiveModal(null);
      setTickerAlert({ type: 'success', message: 'Breakdown Verified & Closed.' });
      setTimeout(() => setTickerAlert(null), 3000);
  };

  const confirmDeletion = (id: string) => {
    setReports(prev => {
        const next = prev.filter(r => r.id !== id);
        const effectiveItemsPerPage = itemsPerPage === 'All' ? Math.max(1, next.length) : itemsPerPage;
        const maxPages = Math.ceil(next.length / effectiveItemsPerPage);
        
        if (next.length > 0 && maxPages < currentPage) {
            setCurrentPage(Math.max(1, maxPages));
        }
        return next;
    });

    setTickerAlert({ type: 'success', message: `Report #${id} has been permanently deleted.` });
    setActiveModal(null);
    setSelectedReportId(null);
    setTimeout(() => setTickerAlert(null), 3500);
  };

  const handleReopenSubmit = (observation: string, imageFile: File | null) => {
      if (!selectedReportId) return;
      const originalReport = reports.find(r => r.id === selectedReportId);
      if (!originalReport) return;
      const imageUrl = imageFile ? URL.createObjectURL(imageFile) : 'https://images.unsplash.com/photo-1599696840432-8493c0429a34?q=80&w=200';
      const updatedOriginal = { ...originalReport, tracking: [...originalReport.tracking, { id: `t-${Date.now()}`, label: 'Reopened (New Report Created)', user: 'Auditor', timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), status: 'completed' as const, slaStatus: 'critical' as const, comments: `Marked Non-Compliant. Follow-up report created.` }], linkedReportId: `20122025-${reports.length + 1}` };
      
      const newReport: ReportItem = { 
          ...originalReport, 
          id: `20122025-${reports.length + 1}`, 
          title: observation, 
          status: 'Open', 
          reportingDate: new Date().toISOString().split('T')[0], 
          closureDate: undefined, 
          closureComments: undefined, 
          duration: 'Just now', 
          evidence: { beforeType: 'image', beforeUrl: imageUrl }, 
          tracking: [{ id: 't1', label: 'Reported (Reopen)', user: 'Auditor', timestamp: 'Just now', status: 'completed', slaStatus: 'critical', comments: `Follow up to Report #${originalReport.id}` }], 
          breakdownDetails: undefined, 
          type: 'general', 
          isStarred: false, 
          parentReportId: originalReport.id 
      };
      
      setReports(prev => [newReport, ...prev.map(r => r.id === selectedReportId ? updatedOriginal : r)]);
      setTickerAlert({ type: 'breakdown', message: 'Non-Compliance recorded. New follow-up observation created.' });
      setActiveModal(null);
      setTimeout(() => setTickerAlert(null), 4000);
  };

  const handleNewReportSave = (data: any) => { const id = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${reports.length + 1}`; const newReport: ReportItem = { ...data, id, riskScore: data.riskScore || 5, riskLevel: data.riskLevel || 'Minor', status: 'Open', reportingDate: new Date().toISOString().split('T')[0], duration: 'Just now', tracking: [{ id: 't1', label: 'Reported', user: 'Current User', timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), status: 'completed' as const, slaStatus: 'on-time' }], isStarred: false, type: data.type || 'general', createdById: userRootId || undefined, unitId: userRootId && entities.find(e => e.id === userRootId)?.type === 'unit' ? userRootId : undefined }; setReports(prev => [newReport, ...prev]); setActiveModal(null); setTickerAlert({ type: 'success', message: `Report #${id} created successfully.` }); setTimeout(() => setTickerAlert(null), 3000); };
  const handleSubmitClosure = (comments: string) => { if (!selectedReportId) return; const timestamp = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); setReports(prev => prev.map(r => r.id === selectedReportId ? { ...r, status: 'Resolved', closureDate: new Date().toISOString().split('T')[0], closureComments: comments, tracking: [...r.tracking, { id: `t-close-${Date.now()}`, label: 'Resolved', user: 'Current User', timestamp, status: 'completed' as const, comments }] } : r)); setActiveModal(null); setTickerAlert({ type: 'success', message: `Report #${selectedReportId} closed.` }); setTimeout(() => setTickerAlert(null), 3000); };

  const handleBulkUploadSave = async (locationStr: string, files: File[]) => {
    let parsedLocation = { zone: 'Default Zone', site: 'Default Site', department: 'General', area: locationStr || 'Unassigned Area' };
    const match = locationStr.match(/^(.*) \((.*)\)$/);
    if (match) { parsedLocation.area = match[1]; parsedLocation.department = match[2]; if (userRootId) { const unit = findAncestorByType(userRootId, 'unit', entities); if (unit) { parsedLocation.site = unit.name; const region = findAncestorByType(unit.id, 'regional', entities); if (region) parsedLocation.zone = region.name; } } }
    const newReports: ReportItem[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i]; const id = `${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${reports.length + i + 1}`;
        const reader = new FileReader(); const dataUrl = await new Promise<string>((resolve) => { reader.onload = async (e) => { const compressed = await compressImage(e.target?.result as string); resolve(compressed); }; reader.readAsDataURL(file); });
        newReports.push({ id, title: `Bulk Observation - ${parsedLocation.area}`, sop: 'General Observation', deviation: 'Minor', riskScore: 5, riskLevel: 'Low', responsibility: parsedLocation.department, unitId: userRootId && entities.find(e => e.id === userRootId)?.type === 'unit' ? userRootId : undefined, createdById: userRootId || undefined, location: parsedLocation, status: 'Open', reportingDate: new Date().toISOString().split('T')[0], duration: 'Just now', evidence: { beforeType: 'image', beforeUrl: dataUrl }, tracking: [{ id: `t1-${id}`, label: 'Reported (Bulk)', user: 'Current User', timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), status: 'completed', slaStatus: 'on-time' }], isStarred: false, type: 'general' });
    }
    setReports(prev => [...newReports, ...prev]); setTickerAlert({ type: 'success', message: `Successfully uploaded ${files.length} reports.` }); setTimeout(() => setTickerAlert(null), 4000);
  };

  const handleExportData = async () => {
    const workbook = new ExcelJS.Workbook(); const worksheet = workbook.addWorksheet("Follow Up Reports");
    worksheet.columns = [ { header: "Sl no", key: "sl_no", width: 8 }, { header: "Report id", key: "id", width: 15 }, { header: "Reported Date", key: "reportingDate", width: 15 }, { header: "Reported by", key: "reporter", width: 15 }, { header: "Status", key: "status", width: 15 }, { header: "Evidence (Before)", key: "evidence_before", width: 25 }, { header: "Title", key: "title", width: 30 }, { header: "Responsibility", key: "responsibility", width: 20 }, { header: "Department", key: "department", width: 20 }, { header: "Area", key: "area", width: 15 }, { header: "Site", key: "site", width: 15 }, { header: "Zone", key: "zone", width: 15 }, { header: "Evidence (After)", key: "evidence_after", width: 25 }, { header: "Closure comments", key: "closureComments", width: 30 }, { header: "Resolved By", key: "resolver", width: 15 }, { header: "Closure date", key: "closureDate", width: 15 }, { header: "Duration", key: "duration", width: 15 }, { header: "SOP", key: "sop", width: 20 }, { header: "Follow up status", key: "follow_up_status", width: 15 }, { header: "Follow up count", key: "follow_up_count", width: 10 }, { header: "Is breakdown", key: "is_breakdown", width: 10 }, { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, { header: "Deviation", key: "deviation", width: 15 }, { header: "Risk Level", key: "riskLevel", width: 15 }, { header: "Risk score", key: "riskScore", width: 10 }, { header: "Staff Involved", key: "staff", width: 20 }, { header: "Asset ID", key: "asset", width: 20 }, { header: "Food Category", key: "food", width: 20 } ];
    for (let i = 0; i < filteredReports.length; i++) {
        const report = filteredReports[i]; const reporter = report.tracking[0]?.user || 'System'; const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        const row = worksheet.addRow({ sl_no: i + 1, id: report.id, reportingDate: report.reportingDate, reporter: reporter, status: report.status, evidence_before: '', title: report.title, responsibility: report.responsibility, department: report.location.department, area: report.location.area, site: report.location.site, zone: report.location.zone, evidence_after: '', closureComments: report.closureComments || '', resolver: resolver, closureDate: report.closureDate || '', duration: report.duration, sop: report.sop, follow_up_status: report.followUpInfo?.type || 'N/A', follow_up_count: report.followUpInfo?.count || 0, is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', breakdown_cost: report.breakdownDetails?.totalCost || 0, deviation: report.deviation, riskLevel: report.riskLevel, riskScore: report.riskScore, staff: report.staffInvolved?.join(', ') || 'N/A', asset: report.assetId?.join(', ') || 'N/A', food: report.foodCategory?.join(', ') || 'N/A' });
        row.height = 100; 
        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') { const buffer = await fetchImage(report.evidence.beforeUrl); if (buffer) { const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' }); } }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') { const buffer = await fetchImage(report.evidence.afterUrl); if (buffer) { const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' }); } }
    }
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = window.URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `FollowUp_Report_${new Date().toISOString().split('T')[0]}.xlsx`; anchor.click(); window.URL.revokeObjectURL(url);
  };

  const handleExportMultiSheet = async () => {
    const workbook = new ExcelJS.Workbook();
    // Fix: Explicitly use Array.from<string> for proper type inference
    const uniqueResps: string[] = Array.from<string>(new Set(filteredReports.map(r => r.responsibility))).sort();

    if (uniqueResps.length === 0) {
      alert("No data available to export.");
      return;
    }

    for (const resp of uniqueResps) {
      const respData = filteredReports.filter(r => r.responsibility === resp);
      // Excel sheet name limit is 31 chars and cannot contain special chars
      const sheetName = resp.substring(0, 31).replace(/[\[\]\*\/\\\?]/g, ''); 
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = [ 
        { header: "Sl no", key: "sl_no", width: 8 }, 
        { header: "Report id", key: "id", width: 15 }, 
        { header: "Reported Date", key: "reportingDate", width: 15 }, 
        { header: "Reported by", key: "reporter", width: 15 }, 
        { header: "Status", key: "status", width: 15 }, 
        { header: "Evidence (Before)", key: "evidence_before", width: 25 }, 
        { header: "Title", key: "title", width: 30 }, 
        { header: "Responsibility", key: "responsibility", width: 20 }, 
        { header: "Department", key: "department", width: 20 }, 
        { header: "Area", key: "area", width: 15 }, 
        { header: "Site", key: "site", width: 15 }, 
        { header: "Zone", key: "zone", width: 15 }, 
        { header: "Evidence (After)", key: "evidence_after", width: 25 }, 
        { header: "Closure comments", key: "closureComments", width: 30 }, 
        { header: "Resolved By", key: "resolver", width: 15 }, 
        { header: "Closure date", key: "closureDate", width: 15 }, 
        { header: "Duration", key: "duration", width: 15 }, 
        { header: "SOP", key: "sop", width: 20 }, 
        { header: "Follow up status", key: "follow_up_status", width: 15 }, 
        { header: "Follow up count", key: "follow_up_count", width: 10 }, 
        { header: "Is breakdown", key: "is_breakdown", width: 10 }, 
        { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, 
        { header: "Deviation", key: "deviation", width: 15 }, 
        { header: "Risk Level", key: "riskLevel", width: 15 }, 
        { header: "Risk score", key: "riskScore", width: 10 }, 
        { header: "Staff Involved", key: "staff", width: 20 }, 
        { header: "Asset ID", key: "asset", width: 20 }, 
        { header: "Food Category", key: "food", width: 20 } 
      ];

      for (let i = 0; i < respData.length; i++) {
        const report = respData[i];
        const reporter = report.tracking[0]?.user || 'System';
        const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        
        const row = worksheet.addRow({ 
          sl_no: i + 1, 
          id: report.id, 
          reportingDate: report.reportingDate, 
          reporter: reporter, 
          status: report.status, 
          evidence_before: '', 
          title: report.title, 
          responsibility: report.responsibility, 
          department: report.location.department, 
          area: report.location.area, 
          site: report.location.site, 
          zone: report.location.zone, 
          evidence_after: '', 
          closureComments: report.closureComments || '', 
          resolver: resolver, 
          closureDate: report.closureDate || '', 
          duration: report.duration, 
          sop: report.sop, 
          follow_up_status: report.followUpInfo?.type || 'N/A', 
          follow_up_count: report.followUpInfo?.count || 0, 
          is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', 
          breakdown_cost: report.breakdownDetails?.totalCost || 0, 
          deviation: report.deviation, 
          riskLevel: report.riskLevel, 
          riskScore: report.riskScore, 
          staff: report.staffInvolved?.join(', ') || 'N/A', 
          asset: report.assetId?.join(', ') || 'N/A', 
          food: report.foodCategory?.join(', ') || 'N/A' 
        });
        row.height = 100;

        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') {
          const buffer = await fetchImage(report.evidence.beforeUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') {
          const buffer = await fetchImage(report.evidence.afterUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Responsibility_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportLocationMultiSheet = async () => {
    const workbook = new ExcelJS.Workbook();
    // Fix: Explicitly use Array.from<string> for proper type inference
    const uniqueLocations: string[] = Array.from<string>(new Set(filteredReports.map(r => r.location.area))).sort();

    if (uniqueLocations.length === 0) {
      alert("No data available to export.");
      return;
    }

    for (const loc of uniqueLocations) {
      const locData = filteredReports.filter(r => r.location.area === loc);
      // Excel sheet name limit is 31 chars and cannot contain special chars
      const sheetName = loc.substring(0, 31).replace(/[\[\]\*\/\\\?]/g, ''); 
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = [ 
        { header: "Sl no", key: "sl_no", width: 8 }, 
        { header: "Report id", key: "id", width: 15 }, 
        { header: "Reported Date", key: "reportingDate", width: 15 }, 
        { header: "Reported by", key: "reporter", width: 15 }, 
        { header: "Status", key: "status", width: 15 }, 
        { header: "Evidence (Before)", key: "evidence_before", width: 25 }, 
        { header: "Title", key: "title", width: 30 }, 
        { header: "Responsibility", key: "responsibility", width: 20 }, 
        { header: "Department", key: "department", width: 20 }, 
        { header: "Area", key: "area", width: 15 }, 
        { header: "Site", key: "site", width: 15 }, 
        { header: "Zone", key: "zone", width: 15 }, 
        { header: "Evidence (After)", key: "evidence_after", width: 25 }, 
        { header: "Closure comments", key: "closureComments", width: 30 }, 
        { header: "Resolved By", key: "resolver", width: 15 }, 
        { header: "Closure date", key: "closureDate", width: 15 }, 
        { header: "Duration", key: "duration", width: 15 }, 
        { header: "SOP", key: "sop", width: 20 }, 
        { header: "Follow up status", key: "follow_up_status", width: 15 }, 
        { header: "Follow up count", key: "follow_up_count", width: 10 }, 
        { header: "Is breakdown", key: "is_breakdown", width: 10 }, 
        { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, 
        { header: "Deviation", key: "deviation", width: 15 }, 
        { header: "Risk Level", key: "riskLevel", width: 15 }, 
        { header: "Risk score", key: "riskScore", width: 10 }, 
        { header: "Staff Involved", key: "staff", width: 20 }, 
        { header: "Asset ID", key: "asset", width: 20 }, 
        { header: "Food Category", key: "food", width: 20 } 
      ];

      for (let i = 0; i < locData.length; i++) {
        const report = locData[i];
        const reporter = report.tracking[0]?.user || 'System';
        const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        
        const row = worksheet.addRow({ 
          sl_no: i + 1, 
          id: report.id, 
          reportingDate: report.reportingDate, 
          reporter: reporter, 
          status: report.status, 
          evidence_before: '', 
          title: report.title, 
          responsibility: report.responsibility, 
          department: report.location.department, 
          area: report.location.area, 
          site: report.location.site, 
          zone: report.location.zone, 
          evidence_after: '', 
          closureComments: report.closureComments || '', 
          resolver: resolver, 
          closureDate: report.closureDate || '', 
          duration: report.duration, 
          sop: report.sop, 
          // Fix: correctly access followUpInfo property
          follow_up_status: report.followUpInfo?.type || 'N/A', 
          // Fix: correctly access followUpInfo property
          follow_up_count: report.followUpInfo?.count || 0, 
          is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', 
          breakdown_cost: report.breakdownDetails?.totalCost || 0, 
          deviation: report.deviation, 
          riskLevel: report.riskLevel, 
          riskScore: report.riskScore, 
          staff: report.staffInvolved?.join(', ') || 'N/A', 
          asset: report.assetId?.join(', ') || 'N/A', 
          food: report.foodCategory?.join(', ') || 'N/A' 
        });
        row.height = 100;

        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') {
          const buffer = await fetchImage(report.evidence.beforeUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') {
          const buffer = await fetchImage(report.evidence.afterUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Location_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportSopMultiSheet = async () => {
    const workbook = new ExcelJS.Workbook();
    // Fix: Explicitly use Array.from<string> for proper type inference
    const uniqueSops: string[] = Array.from<string>(new Set(filteredReports.map(r => r.sop))).sort();

    if (uniqueSops.length === 0) {
      alert("No data available to export.");
      return;
    }

    for (const sop of uniqueSops) {
      const sopData = filteredReports.filter(r => r.sop === sop);
      // Excel sheet name limit is 31 chars and cannot contain special chars
      const sheetName = sop.substring(0, 31).replace(/[\[\]\*\/\\\?]/g, ''); 
      const worksheet = workbook.addWorksheet(sheetName || 'SOP-General');

      worksheet.columns = [ 
        { header: "Sl no", key: "sl_no", width: 8 }, 
        { header: "Report id", key: "id", width: 15 }, 
        { header: "Reported Date", key: "reportingDate", width: 15 }, 
        { header: "Reported by", key: "reporter", width: 15 }, 
        { header: "Status", key: "status", width: 15 }, 
        { header: "Evidence (Before)", key: "evidence_before", width: 25 }, 
        { header: "Title", key: "title", width: 30 }, 
        { header: "Responsibility", key: "responsibility", width: 20 }, 
        { header: "Department", key: "department", width: 20 }, 
        { header: "Area", key: "area", width: 15 }, 
        { header: "Site", key: "site", width: 15 }, 
        { header: "Zone", key: "zone", width: 15 }, 
        { header: "Evidence (After)", key: "evidence_after", width: 25 }, 
        { header: "Closure comments", key: "closureComments", width: 30 }, 
        { header: "Resolved By", key: "resolver", width: 15 }, 
        { header: "Closure date", key: "closureDate", width: 15 }, 
        { header: "Duration", key: "duration", width: 15 }, 
        { header: "SOP", key: "sop", width: 20 }, 
        { header: "Follow up status", key: "follow_up_status", width: 15 }, 
        { header: "Follow up count", key: "follow_up_count", width: 10 }, 
        { header: "Is breakdown", key: "is_breakdown", width: 10 }, 
        { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, 
        { header: "Deviation", key: "deviation", width: 15 }, 
        { header: "Risk Level", key: "riskLevel", width: 15 }, 
        { header: "Risk score", key: "riskScore", width: 10 }, 
        { header: "Staff Involved", key: "staff", width: 20 }, 
        { header: "Asset ID", key: "asset", width: 20 }, 
        { header: "Food Category", key: "food", width: 20 } 
      ];

      for (let i = 0; i < sopData.length; i++) {
        const report = sopData[i];
        const reporter = report.tracking[0]?.user || 'System';
        const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        
        const row = worksheet.addRow({ 
          sl_no: i + 1, 
          id: report.id, 
          reportingDate: report.reportingDate, 
          reporter: reporter, 
          status: report.status, 
          evidence_before: '', 
          title: report.title, 
          responsibility: report.responsibility, 
          department: report.location.department, 
          area: report.location.area, 
          site: report.location.site, 
          zone: report.location.zone, 
          evidence_after: '', 
          closureComments: report.closureComments || '', 
          resolver: resolver, 
          closureDate: report.closureDate || '', 
          duration: report.duration, 
          sop: report.sop, 
          // Fix: correctly access followUpInfo property
          follow_up_status: report.followUpInfo?.type || 'N/A', 
          // Fix: correctly access followUpInfo property
          follow_up_count: report.followUpInfo?.count || 0, 
          is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', 
          breakdown_cost: report.breakdownDetails?.totalCost || 0, 
          deviation: report.deviation, 
          riskLevel: report.riskLevel, 
          riskScore: report.riskScore, 
          staff: report.staffInvolved?.join(', ') || 'N/A', 
          asset: report.assetId?.join(', ') || 'N/A', 
          food: report.foodCategory?.join(', ') || 'N/A' 
        });
        row.height = 100;

        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') {
          const buffer = await fetchImage(report.evidence.beforeUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') {
          const buffer = await fetchImage(report.evidence.afterUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `SOP_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportEscalationMultiSheet = async () => {
    const workbook = new ExcelJS.Workbook();
    const levels = ['L1', 'L2', 'L3', 'L4'];

    if (filteredReports.length === 0) {
      alert("No data available to export.");
      return;
    }

    for (const level of levels) {
      const levelData = filteredReports.filter(r => getEscalationInfo(r).label === level);
      if (levelData.length === 0) continue;

      const worksheet = workbook.addWorksheet(`${level} Level`);
      worksheet.columns = [ 
        { header: "Sl no", key: "sl_no", width: 8 }, 
        { header: "Report id", key: "id", width: 15 }, 
        { header: "Reported Date", key: "reportingDate", width: 15 }, 
        { header: "Reported by", key: "reporter", width: 15 }, 
        { header: "Status", key: "status", width: 15 }, 
        { header: "Evidence (Before)", key: "evidence_before", width: 25 }, 
        { header: "Title", key: "title", width: 30 }, 
        { header: "Responsibility", key: "responsibility", width: 20 }, 
        { header: "Department", key: "department", width: 20 }, 
        { header: "Area", key: "area", width: 15 }, 
        { header: "Site", key: "site", width: 15 }, 
        { header: "Zone", key: "zone", width: 15 }, 
        { header: "Evidence (After)", key: "evidence_after", width: 25 }, 
        { header: "Closure comments", key: "closureComments", width: 30 }, 
        { header: "Resolved By", key: "resolver", width: 15 }, 
        { header: "Closure date", key: "closureDate", width: 15 }, 
        { header: "Duration", key: "duration", width: 15 }, 
        { header: "SOP", key: "sop", width: 20 }, 
        { header: "Follow up status", key: "follow_up_status", width: 15 }, 
        { header: "Follow up count", key: "follow_up_count", width: 10 }, 
        { header: "Is breakdown", key: "is_breakdown", width: 10 }, 
        { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, 
        { header: "Deviation", key: "deviation", width: 15 }, 
        { header: "Risk Level", key: "riskLevel", width: 15 }, 
        { header: "Risk score", key: "riskScore", width: 10 }, 
        { header: "Staff Involved", key: "staff", width: 20 }, 
        { header: "Asset ID", key: "asset", width: 20 }, 
        { header: "Food Category", key: "food", width: 20 } 
      ];

      for (let i = 0; i < levelData.length; i++) {
        const report = levelData[i];
        const reporter = report.tracking[0]?.user || 'System';
        const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        
        const row = worksheet.addRow({ 
          sl_no: i + 1, 
          id: report.id, 
          reportingDate: report.reportingDate, 
          reporter: reporter, 
          status: report.status, 
          evidence_before: '', 
          title: report.title, 
          responsibility: report.responsibility, 
          department: report.location.department, 
          area: report.location.area, 
          site: report.location.site, 
          zone: report.location.zone, 
          evidence_after: '', 
          closureComments: report.closureComments || '', 
          resolver: resolver, 
          closureDate: report.closureDate || '', 
          duration: report.duration, 
          sop: report.sop, 
          // Fix: correctly access followUpInfo property
          follow_up_status: report.followUpInfo?.type || 'N/A', 
          // Fix: correctly access followUpInfo property
          follow_up_count: report.followUpInfo?.count || 0, 
          is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', 
          breakdown_cost: report.breakdownDetails?.totalCost || 0, 
          deviation: report.deviation, 
          riskLevel: report.riskLevel, 
          riskScore: report.riskScore, 
          staff: report.staffInvolved?.join(', ') || 'N/A', 
          asset: report.assetId?.join(', ') || 'N/A', 
          food: report.foodCategory?.join(', ') || 'N/A' 
        });
        row.height = 100;

        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') {
          const buffer = await fetchImage(report.evidence.beforeUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') {
          const buffer = await fetchImage(report.evidence.afterUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `L_Level_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportEmployeeMultiSheet = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Extract unique employee names from Reporter and Staff Involved
    const allNamesSet = new Set<string>();
    filteredReports.forEach(r => {
        const reporter = r.tracking[0]?.user;
        if (reporter) allNamesSet.add(reporter);
        r.staffInvolved?.forEach(name => allNamesSet.add(name));
    });
    const uniqueEmployees = Array.from(allNamesSet).sort();

    if (uniqueEmployees.length === 0) {
      alert("No data available to export.");
      return;
    }

    for (const name of uniqueEmployees) {
      // Filter reports where this employee is either the reporter or involved
      const empData = filteredReports.filter(r => 
        (r.tracking[0]?.user === name) || (r.staffInvolved?.includes(name))
      );
      
      if (empData.length === 0) continue;

      // Excel sheet name limit is 31 chars and cannot contain special chars
      const sheetName = name.substring(0, 31).replace(/[\[\]\*\/\\\?]/g, ''); 
      const worksheet = workbook.addWorksheet(sheetName || 'Staff-Log');

      worksheet.columns = [ 
        { header: "Sl no", key: "sl_no", width: 8 }, 
        { header: "Report id", key: "id", width: 15 }, 
        { header: "Reported Date", key: "reportingDate", width: 15 }, 
        { header: "Reported by", key: "reporter", width: 15 }, 
        { header: "Status", key: "status", width: 15 }, 
        { header: "Evidence (Before)", key: "evidence_before", width: 25 }, 
        { header: "Title", key: "title", width: 30 }, 
        { header: "Responsibility", key: "responsibility", width: 20 }, 
        { header: "Department", key: "department", width: 20 }, 
        { header: "Area", key: "area", width: 15 }, 
        { header: "Site", key: "site", width: 15 }, 
        { header: "Zone", key: "zone", width: 15 }, 
        { header: "Evidence (After)", key: "evidence_after", width: 25 }, 
        { header: "Closure comments", key: "closureComments", width: 30 }, 
        { header: "Resolved By", key: "resolver", width: 15 }, 
        { header: "Closure date", key: "closureDate", width: 15 }, 
        { header: "Duration", key: "duration", width: 15 }, 
        { header: "SOP", key: "sop", width: 20 }, 
        { header: "Follow up status", key: "follow_up_status", width: 15 }, 
        { header: "Follow up count", key: "follow_up_count", width: 10 }, 
        { header: "Is breakdown", key: "is_breakdown", width: 10 }, 
        { header: "Breakdown cost", key: "breakdown_cost", width: 15 }, 
        { header: "Deviation", key: "deviation", width: 15 }, 
        { header: "Risk Level", key: "riskLevel", width: 15 }, 
        { header: "Risk score", key: "riskScore", width: 10 }, 
        { header: "Staff Involved", key: "staff", width: 20 }, 
        { header: "Asset ID", key: "asset", width: 20 }, 
        { header: "Food Category", key: "food", width: 20 } 
      ];

      for (let i = 0; i < empData.length; i++) {
        const report = empData[i];
        const reporter = report.tracking[0]?.user || 'System';
        const resolver = report.tracking.find(t => t.label === 'Resolved')?.user || '';
        
        const row = worksheet.addRow({ 
          sl_no: i + 1, 
          id: report.id, 
          reportingDate: report.reportingDate, 
          reporter: reporter, 
          status: report.status, 
          evidence_before: '', 
          title: report.title, 
          responsibility: report.responsibility, 
          department: report.location.department, 
          area: report.location.area, 
          site: report.location.site, 
          zone: report.location.zone, 
          evidence_after: '', 
          closureComments: report.closureComments || '', 
          resolver: resolver, 
          closureDate: report.closureDate || '', 
          duration: report.duration, 
          sop: report.sop, 
          // Fix: correctly access followUpInfo property
          follow_up_status: report.followUpInfo?.type || 'N/A', 
          // Fix: correctly access followUpInfo property
          follow_up_count: report.followUpInfo?.count || 0, 
          is_breakdown: report.type === 'breakdown' ? 'Yes' : 'No', 
          breakdown_cost: report.breakdownDetails?.totalCost || 0, 
          deviation: report.deviation, 
          riskLevel: report.riskLevel, 
          riskScore: report.riskScore, 
          staff: report.staffInvolved?.join(', ') || 'N/A', 
          asset: report.assetId?.join(', ') || 'N/A', 
          food: report.foodCategory?.join(', ') || 'N/A' 
        });
        row.height = 100;

        if (report.evidence.beforeUrl && report.evidence.beforeType === 'image') {
          const buffer = await fetchImage(report.evidence.beforeUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 5, row: i + 1 } as any, br: { col: 6, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
        if (report.evidence.afterUrl && report.evidence.afterType === 'image') {
          const buffer = await fetchImage(report.evidence.afterUrl);
          if (buffer) {
            const imageId = workbook.addImage({ buffer: buffer, extension: 'jpeg' });
            worksheet.addImage(imageId, { tl: { col: 12, row: i + 1 } as any, br: { col: 13, row: i + 2 } as any, editAs: 'oneCell' });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Employee_Observation_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const hierarchicalFilteredReports = useMemo(() => {
    if (currentScope === 'super-admin') return reports;
    if (!userRootId) return [];
    return reports.filter(report => {
        if (!report.unitId && !report.departmentId && !report.createdById) return false;
        if (currentScope === 'corporate' || currentScope === 'regional') { if (!report.unitId) return false; const unitEntity = entities.find(e => e.id === report.unitId); if (!unitEntity) return false; return isDescendant(userRootId, unitEntity.id, entities); }
        if (currentScope === 'unit') return report.unitId === userRootId;
        if (currentScope === 'department') { if (report.departmentId === userRootId || report.responsibilityId === userRootId) return true; if (report.createdById) { const creator = entities.find(e => e.id === userRootId); if (creator && creator.parentId === userRootId) return true; } return false; }
        if (currentScope === 'user') { if (report.createdById === userRootId) return true; const userEntity = entities.find(e => e.id === userRootId); if (userEntity && (report.departmentId === userEntity.parentId || report.responsibilityId === userEntity.parentId)) return true; return false; }
        return false;
    });
  }, [reports, currentScope, userRootId, entities]);

  const filteredReports = useMemo(() => {
    const result = hierarchicalFilteredReports.filter(r => {
      const searchMatch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toLowerCase().includes(searchTerm.toLowerCase()) || r.location.area.toLowerCase().includes(searchTerm.toLowerCase());
      if (!searchMatch) return false;
      if (showFollowUpOnly && !r.isStarred) return false;
      if (showBreakdownOnly && r.type !== 'breakdown') return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.priority && r.deviation !== filters.priority) return false;
      
      // Detail Filters
      if (detailFilters.sops.length && !detailFilters.sops.includes(r.sop)) return false;
      if (detailFilters.risks.length && !detailFilters.risks.includes(r.deviation)) return false;
      if (detailFilters.escalations.length && !detailFilters.escalations.includes(getEscalationInfo(r).label)) return false;
      
      // Detail Specific Selection Filters
      if (detailFilters.staff.length && !detailFilters.staff.some(s => r.staffInvolved?.includes(s))) return false;
      if (detailFilters.assets.length && !detailFilters.assets.some(a => r.assetId?.includes(a))) return false;
      if (detailFilters.foods.length && !detailFilters.foods.some(f => r.foodCategory?.includes(f))) return false;

      // Location Filters
      if (locationFilters.regional.length && !locationFilters.regional.includes(r.location.zone)) return false;
      if (locationFilters.unit.length && !locationFilters.unit.includes(r.location.site)) return false;
      if (locationFilters.department.length && !locationFilters.department.includes(r.location.department)) return false;
      if (locationFilters.location.length && !locationFilters.location.includes(r.location.area)) return false;

      // Status Column Filters
      if (statusColumnFilters.length && !statusColumnFilters.includes(r.status)) return false;
      if (followUpProfileFilters.length && !followUpProfileFilters.includes(r.followUpInfo?.type || 'N/A')) return false;
      
      // Follow Up Count Filter
      if (followUpCountFilter) {
          const count = r.followUpInfo?.count || 0;
          if (followUpCountFilter.startsWith('>')) {
              if (count <= parseInt(followUpCountFilter.substring(1))) return false;
          } else if (followUpCountFilter.includes('-')) {
              const [min, max] = followUpCountFilter.split('-').map(Number);
              if (count < min || count > max) return false;
          } else {
              if (count !== parseInt(followUpCountFilter)) return false;
          }
      }

      // Date Filters
      if (obsDateRange.from && new Date(r.reportingDate) < new Date(obsDateRange.from)) return false;
      if (obsDateRange.to && new Date(r.reportingDate) > new Date(obsDateRange.to)) return false;
      if (closeDateRange.from && (!r.closureDate || new Date(r.closureDate) < new Date(closeDateRange.from))) return false;
      if (closeDateRange.to && (!r.closureDate || new Date(r.closureDate) > new Date(closeDateRange.to))) return false;

      // Action Based Filter
      if (actionFilter) {
          if (actionFilter === 'Needs Acknowledgment' && (r.status !== 'Open')) return false;
          if (actionFilter === 'Needs Resolution' && (r.status !== 'In Progress')) return false;
          if (actionFilter === 'Needs Verification' && (r.status !== 'Pending Verification')) return false;
          if (actionFilter === 'Breakdown Active' && (r.type !== 'breakdown' || r.status === 'Resolved')) return false;
          if (actionFilter === 'Needs Follow Up' && (!r.followUpInfo || r.followUpInfo.type === 'Compliance')) return false;
          if (actionFilter === 'Repeat Problem' && (getIssueLineage(r.id, reports).length <= 1)) return false;
      }

      if (threadFilter) { const root = getIssueLineage(r.id, reports)[getIssueLineage(r.id, reports).length-1].id; if (root !== threadFilter) return false; }
      return true;
    });
    const statusPriority: Record<string, number> = { 'Open': 1, 'In Progress': 2, 'Pending Verification': 3, 'Resolved': 4 };
    return result.sort((a, b) => { const scoreA = statusPriority[a.status] || 99; const scoreB = statusPriority[b.status] || 99; if (scoreA !== scoreB) return scoreA - scoreB; const dateA = new Date(a.reportingDate).getTime(); const dateB = new Date(b.reportingDate).getTime(); return dateB - dateA; });
  }, [hierarchicalFilteredReports, reports, searchTerm, showFollowUpOnly, showBreakdownOnly, filters, detailFilters, locationFilters, statusColumnFilters, followUpProfileFilters, followUpCountFilter, obsDateRange, closeDateRange, threadFilter, actionFilter]);

  const { staffFreq, assetFreq, foodFreq } = useMemo(() => {
    const sMap: Record<string, number> = {};
    const aMap: Record<string, number> = {};
    const fMap: Record<string, number> = {};
    
    filteredReports.forEach(r => {
        r.staffInvolved?.forEach(name => { sMap[name] = (sMap[name] || 0) + 1; });
        r.assetId?.forEach(id => { aMap[id] = (aMap[id] || 0) + 1; });
        r.foodCategory?.forEach(cat => { fMap[cat] = (fMap[cat] || 0) + 1; });
    });
    
    return { staffFreq: sMap, assetFreq: aMap, foodFreq: fMap };
  }, [filteredReports]);

  const totalItems = filteredReports.length;
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(totalItems / itemsPerPage);
  const paginatedReports = useMemo(() => { if (itemsPerPage === 'All') return filteredReports; const start = (currentPage - 1) * itemsPerPage; return filteredReports.slice(start, start + itemsPerPage); }, [filteredReports, currentPage, itemsPerPage]);
  
  const getSelectedReport = () => reports.find(r => r.id === selectedReportId);
  const toggleHeaderDropdown = (name: string) => { setActiveHeaderDropdown(prev => prev === name ? null : name); };

  const uniqueSops = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.sop))).sort(), [hierarchicalFilteredReports]);
  const uniqueSites = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.location.site))).sort(), [hierarchicalFilteredReports]);
  const uniqueRegions = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.location.zone))).sort(), [hierarchicalFilteredReports]);
  const uniqueDepts = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.location.department))).sort(), [hierarchicalFilteredReports]);
  const uniqueAreas = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.location.area))).sort(), [hierarchicalFilteredReports]);
  const uniqueReporters = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.map(r => r.tracking[0]?.user))).filter(Boolean).sort(), [hierarchicalFilteredReports]);
  
  const uniqueStaff = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.flatMap(r => r.staffInvolved || []))).sort(), [hierarchicalFilteredReports]);
  const uniqueAssets = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.flatMap(r => r.assetId || []))).sort(), [hierarchicalFilteredReports]);
  const uniqueFoods = useMemo(() => Array.from(new Set(hierarchicalFilteredReports.flatMap(r => r.foodCategory || []))).sort(), [hierarchicalFilteredReports]);

  const MobileFiltersModal = () => (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-0 animate-in fade-in duration-200">
        <div className="bg-white w-full h-[90vh] rounded-t-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <SlidersHorizontal size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Search & Filters</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apply criteria to results</p>
                    </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search ID, Title, Area..." 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-indigo-400 outline-none transition-all shadow-inner"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1">Report Details</h4>
                    <CollapsibleFilterBlock 
                      title="SOP Framework" 
                      icon={BookOpen} 
                      options={uniqueSops} 
                      selected={detailFilters.sops} 
                      onToggle={(sop) => setDetailFilters(prev => ({...prev, sops: prev.sops.includes(sop) ? prev.sops.filter(s => s !== sop) : [...prev.sops, sop]}))} 
                      count={detailFilters.sops.length} 
                      isExpanded={openFilterSection === "SOP"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "SOP" ? null : "SOP")}
                    />
                    <CollapsibleFilterBlock 
                      title="Deviation Level" 
                      icon={Signal} 
                      options={['Critical', 'Major', 'Minor']} 
                      selected={detailFilters.risks} 
                      onToggle={(d) => setDetailFilters(prev => ({...prev, risks: prev.risks.includes(d) ? prev.risks.filter(r => r !== d) : [...prev.risks, d]}))} 
                      count={detailFilters.risks.length} 
                      isExpanded={openFilterSection === "Deviation"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Deviation" ? null : "Deviation")}
                    />
                    <CollapsibleFilterBlock 
                      title="Staff Involved" 
                      icon={Users} 
                      options={uniqueStaff} 
                      selected={detailFilters.staff} 
                      onToggle={(s) => setDetailFilters(prev => ({...prev, staff: prev.staff.includes(s) ? prev.staff.filter(x => x !== s) : [...prev.staff, s]}))} 
                      count={detailFilters.staff.length} 
                      isExpanded={openFilterSection === "Staff"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Staff" ? null : "Staff")}
                    />
                    <CollapsibleFilterBlock 
                      title="Asset Filter" 
                      icon={Wrench} 
                      options={uniqueAssets} 
                      selected={detailFilters.assets} 
                      onToggle={(a) => setDetailFilters(prev => ({...prev, assets: prev.assets.includes(a) ? prev.assets.filter(x => x !== a) : [...prev.assets, a]}))} 
                      count={detailFilters.assets.length} 
                      isExpanded={openFilterSection === "Asset"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Asset" ? null : "Asset")}
                    />
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1">Hierarchy & Location</h4>
                    <CollapsibleFilterBlock 
                      title="Site / Unit" 
                      icon={Building} 
                      options={uniqueSites} 
                      selected={locationFilters.unit} 
                      onToggle={(site) => setLocationFilters(prev => ({...prev, unit: prev.unit.includes(site) ? prev.unit.filter(s => s !== site) : [...prev.unit, site]}))} 
                      count={locationFilters.unit.length} 
                      isExpanded={openFilterSection === "Site"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Site" ? null : "Site")}
                    />
                    <CollapsibleFilterBlock 
                      title="Department" 
                      icon={Briefcase} 
                      options={uniqueDepts} 
                      selected={locationFilters.department} 
                      onToggle={(dept) => setLocationFilters(prev => ({...prev, department: prev.department.includes(dept) ? prev.department.filter(d => d !== dept) : [...prev.department, dept]}))} 
                      count={locationFilters.department.length} 
                      isExpanded={openFilterSection === "Dept"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Dept" ? null : "Dept")}
                    />
                    <CollapsibleFilterBlock 
                      title="Area" 
                      icon={MapPin} 
                      options={uniqueAreas} 
                      selected={locationFilters.location} 
                      onToggle={(area) => setLocationFilters(prev => ({...prev, location: prev.location.includes(area) ? prev.location.filter(d => d !== area) : [...prev.location, area]}))} 
                      count={locationFilters.location.length} 
                      isExpanded={openFilterSection === "Area"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Area" ? null : "Area")}
                    />
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1">Status & Timeline</h4>
                    <CollapsibleFilterBlock 
                      title="Status" 
                      icon={ShieldCheck} 
                      options={['Open', 'In Progress', 'Pending Verification', 'Resolved']} 
                      selected={statusColumnFilters} 
                      onToggle={(st) => setStatusColumnFilters(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])} 
                      count={statusColumnFilters.length} 
                      isExpanded={openFilterSection === "Status"}
                      onToggleExpand={() => setOpenFilterSection(openFilterSection === "Status" ? null : "Status")}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Obs From</label>
                            <input type="date" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={obsDateRange.from} onChange={e=>setObsDateRange(p=>({...p, from:e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Obs To</label>
                            <input type="date" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={obsDateRange.to} onChange={e=>setObsDateRange(p=>({...p, to:e.target.value}))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Close From</label>
                            <input type="date" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={closeDateRange.from} onChange={e=>setCloseDateRange(p=>({...p, from:e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Close To</label>
                            <input type="date" className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold" value={closeDateRange.to} onChange={e=>setCloseDateRange(p=>({...p, to:e.target.value}))} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button onClick={() => { setDetailFilters({ sops: [], risks: [], escalations: [], staff: [], assets: [], foods: [] }); setLocationFilters({ regional: [], unit: [], department: [], location: [] }); setStatusColumnFilters([]); setCloseDateRange({from:'', to:''}); setObsDateRange({from:'', to:''}); setSearchTerm(''); setActionFilter(''); }} className="flex-1 py-4 border border-slate-200 bg-white rounded-2xl text-[11px] font-black uppercase text-slate-400 tracking-widest active:scale-95 transition-all">Reset All</button>
                <button onClick={() => setActiveModal(null)} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all">Show {totalItems} Results</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen pb-10 relative">
      {tickerAlert && (
         <div className={`fixed top-16 left-0 right-0 z-40 px-4 py-2 text-center text-xs font-black uppercase tracking-widest shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top-2 ${tickerAlert.type === 'breakdown' ? 'bg-red-600 text-white' : tickerAlert.type === 'verify' ? 'bg-yellow-400 text-yellow-900' : 'bg-green-600 text-white'}`}>{tickerAlert.type === 'breakdown' && <AlertTriangle className="w-4 h-4"/>}{tickerAlert.type === 'verify' && <UserCheck className="w-4 h-4"/>}{tickerAlert.type === 'success' && <CheckCircle2 className="w-4 h-4"/>}{tickerAlert.message}<button onClick={() => tickerAlert && setTickerAlert(null)} className="absolute right-4 hover:opacity-75"><X className="w-4 h-4"/></button></div>
      )}

      <div className="flex overflow-x-auto gap-4 mb-6 pb-2 snap-x hide-scrollbar lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 px-4 md:px-0">
        <SummaryCard label="Total Reports" value={filteredReports.length} color="bg-blue-500" icon={FileSpreadsheet} />
        <SummaryCard label="Critical Issues" value={filteredReports.filter(r => r.deviation === 'Critical').length} color="bg-rose-500" icon={AlertTriangle} />
        <SummaryCard label="Resolved Today" value={filteredReports.filter(r => r.status === 'Resolved').length} color="bg-emerald-500" icon={CheckCircle2} />
        <SummaryCard label="Avg. Resolution" value="14h 20m" color="bg-orange-400" icon={Clock} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sticky top-[112px] z-40 bg-white rounded-t-xl shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2"><Layout className="w-5 h-5 text-slate-400" /></h2>
            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
            
            {/* Desktop Search */}
            <div className="relative max-w-md w-full hidden md:block"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" /><input type="text" placeholder="Search reports..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
            {/* DESKTOP ONLY: ACTION FILTER AT THE TOP */}
            <div className="hidden md:flex relative" ref={headerDropdownRef}>
                <button 
                  onClick={() => toggleHeaderDropdown('globalActions')}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap ${actionFilter ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Zap className={`w-3.5 h-3.5 ${actionFilter ? 'fill-white text-white' : 'text-indigo-500'}`} /> 
                  Actions {actionFilter && `(${actionFilter.split(' ')[0]})`}
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeHeaderDropdown === 'globalActions' ? 'rotate-180' : ''}`} />
                </button>
                {activeHeaderDropdown === 'globalActions' && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-1">
                    {[
                      { label: 'Needs Acknowledgment', icon: AlertOctagon, color: 'text-red-500' },
                      { label: 'Needs Resolution', icon: RefreshCw, color: 'text-blue-500' },
                      { label: 'Needs Verification', icon: ShieldCheck, color: 'text-yellow-600' },
                      { label: 'Needs Follow Up', icon: History, color: 'text-orange-500' },
                      { label: 'Breakdown Active', icon: Wrench, color: 'text-slate-700' },
                      { label: 'Repeat Problem', icon: GitCommit, color: 'text-purple-500' },
                    ].map(item => (
                      <button 
                        key={item.label}
                        onClick={() => { setActionFilter(actionFilter === item.label ? '' : item.label); setActiveHeaderDropdown(null); }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${actionFilter === item.label ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-center gap-2">
                           <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                           <span>{item.label}</span>
                        </div>
                        {actionFilter === item.label && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </button>
                    ))}
                    {actionFilter && (
                      <button 
                        onClick={() => { setActionFilter(''); setActiveHeaderDropdown(null); }}
                        className="w-full text-center py-2 text-[10px] font-black uppercase text-red-500 border-t border-slate-100 mt-1 hover:bg-red-50"
                      >
                        Clear Action Filter
                      </button>
                    )}
                  </div>
                )}
            </div>

            {threadFilter && (<div className="flex items-center bg-orange-100 border border-orange-200 rounded-lg px-2 py-1.5 mr-2 animate-in fade-in"><span className="text-[10px] font-black text-orange-800 uppercase mr-2 flex items-center gap-1"><GitCommit className="w-3 h-3" /> Thread: {threadFilter}</span><button onClick={() => setThreadFilter(null)} className="hover:bg-orange-200 rounded-full p-0.5 text-orange-800"><X size={14} className="w-3 h-3"/></button></div>)}
            <button onClick={() => setActiveModal('bulkUpload')} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50"><Upload className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Bulk Upload</span></button>
            <button onClick={handleExportData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> <span className="hidden lg:inline">Excel</span></button>
            <button onClick={handleExportMultiSheet} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" /> <span className="hidden lg:inline">Excel 2</span></button>
            <button onClick={handleExportLocationMultiSheet} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5 text-orange-600" /> <span className="hidden lg:inline">Excel 3</span></button>
            <button onClick={handleExportSopMultiSheet} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" /> <span className="hidden lg:inline">Excel 4</span></button>
            {/* Multi Sheet Exports */}
            <button onClick={handleExportEmployeeMultiSheet} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50" title="Export Employee Wise Multi-Sheet">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" /> <span className="hidden lg:inline">Employee Sheet</span>
            </button>
            <button onClick={handleExportEscalationMultiSheet} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap bg-white border-slate-200 text-slate-600 hover:bg-slate-50" title="Export L-Level Wise Multi-Sheet">
              <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" /> <span className="hidden lg:inline">L Level Sheet</span>
            </button>
            <button onClick={() => setShowFollowUpOnly(!showFollowUpOnly)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap ${showFollowUpOnly ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Star className={`w-3.5 h-3.5 ${showFollowUpOnly ? 'fill-yellow-500 text-yellow-500' : 'text-slate-400'}`} /> <span className="hidden lg:inline">Follow Up</span></button>
            <button onClick={() => setShowBreakdownOnly(!showBreakdownOnly)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap ${showBreakdownOnly ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><AlertTriangle className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Breakdown</span></button>
            
            <button onClick={() => { setOpenFilterSection(null); setActiveModal('mobileFilters'); }} className="md:hidden flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-100 text-xs font-bold uppercase transition-colors shadow-sm active:scale-95">
                <Filter size={14} />
            </button>
            
            <button onClick={() => { setSearchTerm(''); setShowFollowUpOnly(false); setShowBreakdownOnly(false); setThreadFilter(null); setActionFilter(''); setDetailFilters({ sops: [], risks: [], escalations: [], staff: [], assets: [], foods: [] }); setLocationFilters({ regional: [], unit: [], department: [], location: [] }); setStatusColumnFilters([]); setFollowUpProfileFilters([]); setFollowUpCountFilter(''); setObsDateRange({from:'', to:''}); setCloseDateRange({from:'', to:''}); }} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-xs font-bold uppercase transition-colors shadow-sm whitespace-nowrap"><RefreshCw className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Refresh</span></button>
            <div className="h-6 w-px bg-slate-200 mx-1 hidden lg:block"></div>
            <button onClick={() => setActiveModal('newReport')} className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase transition-colors shadow-md shadow-blue-200 whitespace-nowrap"><Plus className="w-3.5 h-3.5" /> New Report</button>
          </div>
        </div>

        <div className="overflow-x-visible custom-scrollbar flex-1">
          <div className="min-w-full md:min-w-[1400px]">
            <div className="hidden md:block relative">
                <div className="grid grid-cols-[140px_280px_220px_200px_140px_1fr_180px] gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-50 uppercase tracking-wider sticky top-[176px] z-30 shadow-sm">
                  <div className="pl-2 flex items-center gap-2">Evidence</div>
                  <div className="relative">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleHeaderDropdown('details')}>
                      Details <Filter className={`w-3 h-3 ${detailFilters.sops.length || detailFilters.risks.length || detailFilters.escalations.length || detailFilters.staff.length || detailFilters.assets.length || detailFilters.foods.length ? 'text-blue-600 fill-current' : ''}`} />
                    </div>
                    {activeHeaderDropdown === 'details' && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                        <div className="space-y-1">
                          <CollapsibleFilterBlock 
                            title="SOP Framework" 
                            icon={BookOpen} 
                            options={uniqueSops} 
                            selected={detailFilters.sops} 
                            onToggle={(sop) => setDetailFilters(prev => ({...prev, sops: prev.sops.includes(sop) ? prev.sops.filter(s => s !== sop) : [...prev.sops, sop]}))} 
                            count={detailFilters.sops.length} 
                            isExpanded={openFilterSection === "SOP"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "SOP" ? null : "SOP")}
                          />
                          <CollapsibleFilterBlock 
                            title="Deviation Level" 
                            icon={Signal} 
                            options={['Critical', 'Major', 'Minor']} 
                            selected={detailFilters.risks} 
                            onToggle={(d) => setDetailFilters(prev => ({...prev, risks: prev.risks.includes(d) ? prev.risks.filter(r => r !== d) : [...prev.risks, d]}))} 
                            count={detailFilters.risks.length} 
                            isExpanded={openFilterSection === "Deviation"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Deviation" ? null : "Deviation")}
                          />
                          <CollapsibleFilterBlock 
                            title="Escalation Level" 
                            icon={AlertOctagon} 
                            options={['L1', 'L2', 'L3', 'L4']} 
                            selected={detailFilters.escalations} 
                            onToggle={(e) => setDetailFilters(prev => ({...prev, escalations: prev.escalations.includes(e) ? prev.escalations.filter(x => x !== e) : [...prev.escalations, e]}))} 
                            count={detailFilters.escalations.length} 
                            isExpanded={openFilterSection === "Escalation"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Escalation" ? null : "Escalation")}
                          />
                          <div className="border-t border-slate-100 my-1 pt-1">
                             <CollapsibleFilterBlock 
                                title="Staff Filter" 
                                icon={Users} 
                                options={uniqueStaff} 
                                selected={detailFilters.staff} 
                                onToggle={(s) => setDetailFilters(prev => ({...prev, staff: prev.staff.includes(s) ? prev.staff.filter(x => x !== s) : [...prev.staff, s]}))} 
                                count={detailFilters.staff.length} 
                                isExpanded={openFilterSection === "Staff"}
                                onToggleExpand={() => setOpenFilterSection(openFilterSection === "Staff" ? null : "Staff")}
                             />
                             <CollapsibleFilterBlock 
                                title="Asset Filter" 
                                icon={Wrench} 
                                options={uniqueAssets} 
                                selected={detailFilters.assets} 
                                onToggle={(a) => setDetailFilters(prev => ({...prev, assets: prev.assets.includes(a) ? prev.assets.filter(x => x !== a) : [...prev.assets, a]}))} 
                                count={detailFilters.assets.length} 
                                isExpanded={openFilterSection === "Asset"}
                                onToggleExpand={() => setOpenFilterSection(openFilterSection === "Asset" ? null : "Asset")}
                             />
                             <CollapsibleFilterBlock 
                                title="Food Category" 
                                icon={Package} 
                                options={uniqueFoods} 
                                selected={detailFilters.foods} 
                                onToggle={(f) => setDetailFilters(prev => ({...prev, foods: prev.foods.includes(f) ? prev.foods.filter(x => x !== f) : [...prev.foods, f]}))} 
                                count={detailFilters.foods.length} 
                                isExpanded={openFilterSection === "Food"}
                                onToggleExpand={() => setOpenFilterSection(openFilterSection === "Food" ? null : "Food")}
                             />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleHeaderDropdown('location')}>
                      Location <Filter className={`w-3 h-3 ${locationFilters.unit.length || locationFilters.department.length || locationFilters.regional.length || locationFilters.location.length ? 'text-blue-600 fill-current' : ''}`} />
                    </div>
                    {activeHeaderDropdown === 'location' && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                        <div className="space-y-1">
                          <CollapsibleFilterBlock 
                            title="Regional Office" 
                            icon={Globe} 
                            options={uniqueRegions} 
                            selected={locationFilters.regional} 
                            onToggle={(reg) => setLocationFilters(prev => ({...prev, regional: prev.regional.includes(reg) ? prev.regional.filter(s => s !== reg) : [...prev.regional, reg]}))} 
                            count={locationFilters.regional.length} 
                            isExpanded={openFilterSection === "Region"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Region" ? null : "Region")}
                          />
                          <CollapsibleFilterBlock 
                            title="Site / Unit" 
                            icon={Building} 
                            options={uniqueSites} 
                            selected={locationFilters.unit} 
                            onToggle={(site) => setLocationFilters(prev => ({...prev, unit: prev.unit.includes(site) ? prev.unit.filter(s => s !== site) : [...prev.unit, site]}))} 
                            count={locationFilters.unit.length} 
                            isExpanded={openFilterSection === "Site"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Site" ? null : "Site")}
                          />
                          <CollapsibleFilterBlock 
                            title="Department" 
                            icon={Briefcase} 
                            options={uniqueDepts} 
                            selected={locationFilters.department} 
                            onToggle={(dept) => setLocationFilters(prev => ({...prev, department: prev.department.includes(dept) ? prev.department.filter(d => d !== dept) : [...prev.department, dept]}))} 
                            count={locationFilters.department.length} 
                            isExpanded={openFilterSection === "Dept"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Dept" ? null : "Dept")}
                          />
                          <CollapsibleFilterBlock 
                            title="Location Area" 
                            icon={MapPin} 
                            options={uniqueAreas} 
                            selected={locationFilters.location} 
                            onToggle={(area) => setLocationFilters(prev => ({...prev, location: prev.location.includes(area) ? prev.location.filter(d => d !== area) : [...prev.location, area]}))} 
                            count={locationFilters.location.length} 
                            isExpanded={openFilterSection === "Area"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Area" ? null : "Area")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div>Closure comments</div>
                  <div className="relative">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleHeaderDropdown('status')}>
                      Current Status <Filter className={`w-3 h-3 ${statusColumnFilters.length || followUpProfileFilters.length || followUpCountFilter || obsDateRange.from || closeDateRange.from ? 'text-blue-600 fill-current' : ''}`} />
                    </div>
                    {activeHeaderDropdown === 'status' && (
                      <div className="absolute top-full left-0 mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-3">
                        <div className="space-y-3">
                          <CollapsibleFilterBlock 
                            title="Status Profile" 
                            icon={ShieldCheck} 
                            options={['Open', 'In Progress', 'Pending Verification', 'Resolved']} 
                            selected={statusColumnFilters} 
                            onToggle={(st) => setStatusColumnFilters(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])} 
                            count={statusColumnFilters.length} 
                            isExpanded={openFilterSection === "Status"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "Status" ? null : "Status")}
                          />
                          <CollapsibleFilterBlock 
                            title="Follow Up Profile" 
                            icon={History} 
                            options={['Compliance', 'Not Done', 'N/A']} 
                            selected={followUpProfileFilters} 
                            onToggle={(st) => setFollowUpProfileFilters(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st])} 
                            count={followUpProfileFilters.length} 
                            isExpanded={openFilterSection === "FollowUp"}
                            onToggleExpand={() => setOpenFilterSection(openFilterSection === "FollowUp" ? null : "FollowUp")}
                          />
                          
                          <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50">
                             <div className="flex items-center gap-2 mb-2">
                                <Hash size={14} className="text-blue-600" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Follow Up Count</span>
                             </div>
                             <select 
                                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 bg-white"
                                value={followUpCountFilter}
                                onChange={(e) => setFollowUpCountFilter(e.target.value)}
                             >
                                <option value="">All Counts</option>
                                <option value="0">None (0)</option>
                                <option value="1">1st Follow Up</option>
                                <option value="2">2nd Follow Up</option>
                                <option value="3">3rd Follow Up</option>
                                <option value="4">4th Follow Up</option>
                                <option value="5">5th Follow Up</option>
                                <option value="1-2">Range: 1 - 2</option>
                                <option value="3-5">Range: 3 - 5</option>
                                <option value=">5">Severe: &gt; 5</option>
                             </select>
                          </div>
                          
                          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                             <div className="flex items-center gap-2 mb-3">
                                <Calendar size={14} className="text-blue-600" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Observation Date</span>
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">From</label>
                                  <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" value={obsDateRange.from} onChange={e=>setObsDateRange(p=>({...p, from:e.target.value}))} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">To</label>
                                  <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400" value={obsDateRange.to} onChange={e=>setObsDateRange(p=>({...p, to:e.target.value}))} />
                                </div>
                             </div>
                          </div>

                          <div className="p-3 bg-emerald-50/30 rounded-xl border border-emerald-100/50">
                             <div className="flex items-center gap-2 mb-3">
                                <Calendar size={14} className="text-emerald-600" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">Closure Date</span>
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">From</label>
                                  <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-400" value={closeDateRange.from} onChange={e=>setCloseDateRange(p=>({...p, from:e.target.value}))} />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">To</label>
                                  <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-emerald-400" value={closeDateRange.to} onChange={e=>setCloseDateRange(p=>({...p, to:e.target.value}))} />
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => toggleHeaderDropdown('tracking')}>
                      Tracking <Filter className={`w-3 h-3 ${filters.priority ? 'text-blue-600 fill-current' : ''}`} />
                    </div>
                    {activeHeaderDropdown === 'tracking' && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-2">
                        <CollapsibleFilterBlock 
                          title="Assigned Auditor" 
                          icon={UserCheck} 
                          options={uniqueReporters} 
                          selected={[]} 
                          onToggle={() => {}} 
                          count={0} 
                        />
                      </div>
                    )}
                  </div>
                  {/* REMOVED ACTION HEADER TEXT FROM HERE ON DESKTOP AS PER REQUEST */}
                  <div className="text-right pr-2"></div>
                </div>
                
                <div className="divide-y divide-slate-100 bg-white">
                {paginatedReports.length > 0 ? (
                    paginatedReports.map((report) => {
                    const lineage = getIssueLineage(report.id, reports);
                    const isRepeat = lineage.length > 1;
                    const rootReport = lineage[lineage.length - 1];
                    const rootId = rootReport.id;
                    const distanceFromRoot = lineage.length - 1; 
                    const resolver = report.tracking.find(t => t.label === 'Resolved')?.user;
                    const lastFollowUpPerson = [...report.tracking].reverse().find(t => t.label.startsWith('Follow Up:'))?.user;
                    const escInfo = getEscalationInfo(report);
                    return (
                    <div key={report.id} className={`grid grid-cols-[140px_280px_220px_200px_140px_1fr_180px] gap-4 px-6 py-5 hover:bg-slate-50/50 transition-colors group items-start ${report.breakdownDetails?.isActive ? 'bg-red-50/30' : ''}`}>
                    <div className="flex flex-row gap-2"><div className=""><EvidenceThumbnail url={report.evidence.beforeUrl} type={report.evidence.beforeType} label="Before" />{report.evidence.afterUrl && <div className="mt-2"><EvidenceThumbnail url={report.evidence.afterUrl} type={report.evidence.afterType} label="After" /></div>}</div></div>
                    <div className="pr-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Star 
                            onClick={(e) => handleAction('toggle-star', report.id)}
                            className={`w-4 h-4 cursor-pointer transition-all active:scale-125 ${report.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 hover:text-yellow-400'}`} 
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{report.id}</span>
                        {report.type === 'breakdown' && <span className="text-[9px] font-black text-white bg-red-600 px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><Wrench className="w-3 h-3"/> Breakdown</span>}
                        {isRepeat && (<button onClick={(e) => { e.stopPropagation(); setThreadFilter(rootId); }} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 border cursor-pointer hover:opacity-80 transition-opacity ${distanceFromRoot > 2 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`} title="Click to filter by thread"><GitCommit className="w-3 h-3" /> Ref: {rootId} • {distanceFromRoot}{getOrdinal(distanceFromRoot)} Repeat</button>)}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight mb-2 group-hover:text-blue-700 transition-colors cursor-pointer" title={report.title}>{report.title}</h3>
                      
                      {isRepeat && (<div className="text-[10px] text-slate-400 mb-2 flex items-center gap-1.5 bg-slate-50 w-fit px-1.5 py-0.5 rounded border border-slate-100"><Clock className="w-3 h-3" /><span>Original: <span className="font-bold text-slate-600">{rootReport.reportingDate}</span></span></div>)}
                      <div className="flex flex-wrap gap-2 mb-2"><span className="inline-flex items-center px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] font-semibold text-slate-600">SOP: {report.sop}</span><span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${report.deviation === 'Critical' ? 'bg-rose-50 border-rose-100 text-rose-600' : report.deviation === 'Major' ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-yellow-50 border-yellow-100 text-yellow-600'}`}>{report.deviation}</span><span title={escInfo.title} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase border gap-1 ${escInfo.color}`}><Signal size={10} /> {escInfo.label}</span></div>

                      <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-slate-100">
                          <div className="flex flex-wrap gap-1">
                              {renderItemWithCount(report.staffInvolved, Users, "bg-blue-50 border-blue-100 text-blue-700", staffFreq)}
                          </div>
                          <div className="flex wrap gap-1">
                              {renderItemWithCount(report.assetId, Wrench, "bg-orange-50 border-orange-100 text-orange-700", assetFreq)}
                          </div>
                          <div className="flex wrap gap-1">
                              {renderItemWithCount(report.foodCategory, Package, "bg-emerald-50 border-emerald-100 text-emerald-700", foodFreq)}
                          </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 pr-4">
                        <div className="flex items-start gap-1.5 mb-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div className="text-xs font-medium text-slate-700"><span className="block font-bold text-slate-900">{report.location.department}</span><span className="block text-[11px] text-slate-500">{report.location.area}</span><span className="block text-[10px] text-slate-400 mt-0.5">{report.location.site} / {report.location.zone}</span></div>
                        </div>
                    </div>
                    <div><div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-h-[80px]">{report.closureComments ? <span className="line-clamp-4">{report.closureComments}</span> : <span className="text-slate-400 italic text-[11px]">No closure comments.</span>}</div></div>
                    <div><StatusBadge status={report.status} duration={report.duration} resolvedBy={resolver} />{report.followUpInfo && (<div className="mt-3 pt-2 border-t border-slate-100 animate-in slide-in-from-top-1"><span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase border mb-1.5 ${report.followUpInfo.type === 'Not Done' ? 'bg-red-50 text-red-700 border-red-100' : report.followUpInfo.type === 'N/A' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{report.followUpInfo.type}</span><div className="flex flex-col gap-0.5"><div className="flex items-center justify-between text-[9px] font-black text-slate-800"><span>{report.followUpInfo.count}{getOrdinal(report.followUpInfo.count)} FOLLOW UP</span></div>{lastFollowUpPerson && (<div className="text-[8px] font-bold text-blue-600 bg-blue-50/50 px-1 rounded truncate">By: {lastFollowUpPerson}</div>)}<div className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><Calendar size={10} /> {report.followUpInfo.lastDate.split(' ')[0]}</div></div></div>)}{report.breakdownDetails?.isActive && (<div className="mt-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded">Cost: ₹{report.breakdownDetails.totalCost}</div>)}</div>
                    <div className="flex flex-col justify-center h-full pl-2"><div className="text-[10px] text-slate-500 font-medium mb-1">Reported by: <span className="text-slate-800 font-bold">{report.tracking[0]?.user || 'System'}</span></div><div className="text-[10px] text-slate-400 font-medium mb-2">Last update: <span className="font-bold">{report.tracking[report.tracking.length-1]?.timestamp || 'N/A'}</span></div><button onClick={() => { setSelectedReportId(report.id); setActiveModal('tracking'); }} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all w-fit shadow-sm group"><History className="w-3.5 h-3.5 group-hover:text-blue-500" />View Log</button></div>
                    <div className="flex flex-col items-end gap-2 pr-2"><div className="flex items-start justify-end"><ActionGrid report={report} onAction={(type) => handleAction(type, report.id)} /></div></div>
                    </div> ); })
                ) : ( <div className="flex flex-col items-center justify-center p-12 text-slate-400"><FileText size={48} className="mb-4 opacity-50" /><p className="text-sm font-bold uppercase tracking-widest">No reports found for this scope</p></div> )}
                </div>
            </div>
              <div className="md:hidden space-y-4 p-4">{paginatedReports.map((report) => { const lineage = getIssueLineage(report.id, reports); const isRepeat = lineage.length > 1; const rootReport = lineage[lineage.length - 1]; const rootId = rootReport.id; const distanceFromRoot = lineage.length - 1; return ( <MobileReportCard key={report.id} report={report} onAction={(type) => handleAction(type, report.id)} onSelect={() => { setSelectedReportId(report.id); setActiveModal('tracking'); }} lineage={lineage} isRepeat={isRepeat} rootId={rootId} distanceFromRoot={distanceFromRoot} onFilterThread={(rid) => setThreadFilter(rid)} isExpanded={expandedCardId === report.id} onToggleExpand={() => setExpandedCardId(prev => prev === report.id ? null : report.id)} staffFreq={staffFreq} assetFreq={assetFreq} foodFreq={foodFreq} /> ); })}{paginatedReports.length === 0 && ( <div className="flex flex-col items-center justify-center p-12 text-slate-400"><FileText size={48} className="mb-4 opacity-50" /><p className="text-sm font-bold uppercase tracking-widest">No reports found</p></div> )}</div>
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                rowsPerPage={typeof itemsPerPage === 'number' ? itemsPerPage : totalItems}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
              />
              <div className="md:hidden pb-24"><button onClick={() => setActiveModal('newReport')} className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 border-4 border-white/20 backdrop-blur-sm"><Plus className="w-7 h-7" strokeWidth={2.5} /></button></div>
            </div>
          </div>
        </div>

      {activeModal === 'newReport' && ( <ComplaintFormModal availableSops={availableSops} availableDepartments={availableDepartments} availableLocations={availableLocations} onClose={() => setActiveModal(null)} onSave={handleNewReportSave} userId={userRootId} /> )}
      {activeModal === 'bulkUpload' && ( <BulkUploadModal isOpen={true} onClose={() => setActiveModal(null)} onSave={handleBulkUploadSave} availableLocations={availableLocations} /> )}
      {activeModal === 'mobileFilters' && <MobileFiltersModal />}
      {activeModal === 'staffAck' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-md overflow-hidden p-6"><h3 className="text-lg font-black uppercase mb-4">Schedule Task</h3><p className="text-sm text-slate-500 mb-6">Assign task to department staff?</p><div className="flex gap-3"><button onClick={() => setActiveModal(null)} className="flex-1 py-3 border rounded-xl text-xs font-black uppercase">Cancel</button><button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase">Confirm</button></div></div></div>}
      {activeModal === 'closure' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-md overflow-hidden p-6"><h3 className="text-lg font-black uppercase mb-4">Resolve Issue</h3><textarea id="closure-note" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 h-32 mb-4" placeholder="Closure comments..."></textarea><button onClick={() => handleSubmitClosure((document.getElementById('closure-note') as HTMLTextAreaElement).value)} className="w-full py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">Verify & Close</button></div></div>}
      {activeModal === 'deleteConfirm' && getSelectedReport() && ( <DeleteConfirmationModal report={getSelectedReport()!} onClose={() => setActiveModal(null)} onConfirm={confirmDeletion} /> )}
      {activeModal === 'tracking' && getSelectedReport() && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"><div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center"><div><h3 className="text-lg font-black uppercase">Activity Log</h3><p className="text-[10px] font-bold text-slate-400 uppercase">Report #{selectedReportId}</p></div><button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-slate-200 rounded-full"><X size={20}/></button></div><div className="p-6 overflow-y-auto custom-scrollbar flex-1"><TrackingStepper steps={getSelectedReport()!.tracking} /></div></div></div> )}
      {activeModal === 'reopenObservation' && ( <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-md overflow-hidden p-6"><h3 className="text-lg font-black text-red-600 uppercase mb-4">Non-Compliance Log</h3><textarea id="reopen-obs" className="w-full border rounded-xl p-3 text-sm font-bold bg-slate-50 h-24 mb-4" placeholder="Findings..."></textarea><button onClick={() => handleReopenSubmit((document.getElementById('reopen-obs') as HTMLTextAreaElement).value, null)} className="w-full py-3.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">Create Follow-Up</button></div></div> )}
      {activeModal === 'breakdown' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
             <div className="px-10 py-8 bg-red-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                <div className="flex items-center gap-5">
                   <Wrench size={32} />
                   <div>
                       <h3 className="text-2xl font-black uppercase tracking-tight leading-none">
                           {breakdownMode === 'initiate' ? 'Report Breakdown' : breakdownMode === 'update' ? 'Update Breakdown' : 'Breakdown History'}
                       </h3>
                       <p className="text-[10px] font-bold text-red-100 uppercase tracking-widest mt-2">Maintenance Incident Log</p>
                   </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} /></button>
             </div>
             
             <div className="p-10 space-y-6 bg-slate-50/20 overflow-y-auto custom-scrollbar flex-1">
                 
                 {breakdownMode === 'history' ? (
                     <div className="space-y-4">
                         {getSelectedReport()?.breakdownDetails?.history.length === 0 ? (
                             <div className="text-center text-slate-400 py-10 italic">No history available</div>
                         ) : (
                             getSelectedReport()?.breakdownDetails?.history.map((h, i) => (
                                 <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                     <div className="flex justify-between items-center mb-2">
                                         <span className="text-xs font-black text-slate-700">{h.action}</span>
                                         <span className="text-[10px] text-slate-400">{h.date}</span>
                                     </div>
                                     <p className="text-xs text-slate-600 mb-2">{h.comments}</p>
                                     <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                         <span>User: {h.user}</span>
                                         {h.cost !== undefined && <span>Cost: {h.cost}</span>}
                                     </div>
                                 </div>
                             ))
                         )}
                         <button onClick={() => setBreakdownMode('update')} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase hover:bg-slate-50">Back to Update</button>
                     </div>
                 ) : (
                     <>
                        {breakdownMode === 'update' && getSelectedReport()?.breakdownDetails && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                                 <div className="flex justify-between mb-1">
                                     <span className="text-[10px] font-bold text-slate-400 uppercase">Equipment</span>
                                     <button onClick={() => setBreakdownMode('history')} className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"><History size={12}/> View History</button>
                                 </div>
                                 <p className="font-black text-slate-700">{getSelectedReport()?.breakdownDetails?.equipment}</p>
                                 <p className="text-xs text-slate-500 mt-1">Issue: {getSelectedReport()?.breakdownDetails?.rootCause}</p>
                            </div>
                        )}

                        {breakdownMode === 'initiate' && (
                             <div className="space-y-2 relative" ref={headerDropdownRef}>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Equipment</label>
                                <div 
                                    onClick={() => setIsEquipDropdownOpen(!isEquipDropdownOpen)}
                                    className={`w-full px-5 py-4 bg-white border-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${isEquipDropdownOpen ? 'border-red-400 ring-4 ring-red-50' : 'border-slate-100 hover:border-slate-300'}`}
                                >
                                    <span className={`text-xs font-black uppercase ${breakdownForm.equipment ? 'text-slate-800' : 'text-slate-300'}`}>
                                        {breakdownForm.equipment || "CHOOSE ASSET..."}
                                    </span>
                                    <ChevronDown size={18} className={`text-slate-300 transition-transform ${isEquipDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isEquipDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                         <div className="p-3 border-b border-slate-50 bg-slate-50">
                                             <div className="relative">
                                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                 <input 
                                                     autoFocus
                                                     type="text" 
                                                     placeholder="Search equipment..." 
                                                     className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-red-400 uppercase"
                                                     value={equipSearch}
                                                     onChange={(e) => setEquipSearch(e.target.value)}
                                                 />
                                             </div>
                                         </div>
                                         <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                             {[].filter(eq => eq.toLowerCase().includes(equipSearch.toLowerCase())).map(eq => (
                                                 <button 
                                                     key={eq}
                                                     onClick={() => { setBreakdownForm({...breakdownForm, equipment: eq}); setIsEquipDropdownOpen(false); setEquipSearch(""); }}
                                                     className="w-full text-left px-4 py-3 hover:bg-red-50 rounded-xl text-xs font-bold text-slate-600 uppercase flex justify-between items-center group transition-all"
                                                 >
                                                     {eq}
                                                     {breakdownForm.equipment === eq && <Check size={14} className="text-red-500" strokeWidth={3} />}
                                                 </button>
                                             ))}
                                             {[].filter(eq => eq.toLowerCase().includes(equipSearch.toLowerCase())).length === 0 && (
                                                 <div className="p-4 text-center text-[10px] text-slate-400 italic font-bold uppercase">No Assets Found</div>
                                             )}
                                         </div>
                                    </div>
                                )}
                             </div>
                        )}
                        
                        {breakdownMode === 'initiate' && (
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Breakdown Cause</label>
                                 <textarea 
                                    className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-red-400 resize-none shadow-inner transition-all placeholder:text-slate-300"
                                    placeholder="Describe the failure..."
                                    value={breakdownForm.cause}
                                    onChange={(e) => setBreakdownForm({...breakdownForm, cause: e.target.value})}
                                 />
                             </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                                 <input 
                                    type="date"
                                    className="w-full h-14 px-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-red-400 shadow-inner uppercase cursor-pointer"
                                    value={breakdownForm.date}
                                    onChange={(e) => setBreakdownForm({...breakdownForm, date: e.target.value})}
                                 />
                             </div>
                             {breakdownMode === 'update' && (
                                 <div className="space-y-2">
                                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cost</label>
                                     <input 
                                        type="number"
                                        className="w-full h-14 px-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-red-400 shadow-inner uppercase"
                                        placeholder="0.00"
                                        value={breakdownForm.cost}
                                        onChange={(e) => setBreakdownForm({...breakdownForm, cost: e.target.value})}
                                    />
                                 </div>
                             )}
                        </div>

                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{breakdownMode === 'initiate' ? 'Immediate Action' : 'Corrective Action / Update'}</label>
                             <textarea 
                                className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-red-400 resize-none shadow-inner transition-all placeholder:text-slate-300"
                                placeholder="Steps taken..."
                                value={breakdownForm.action}
                                onChange={(e) => setBreakdownForm({...breakdownForm, action: e.target.value})}
                             />
                         </div>
                     </>
                 )}

             </div>

             <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                 <button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                 {breakdownMode === 'initiate' ? (
                     <button 
                        disabled={!breakdownForm.equipment || !breakdownForm.cause}
                        onClick={handleSaveBreakdown} 
                        className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${breakdownForm.equipment && breakdownForm.cause ? 'bg-red-600 text-white shadow-red-200 hover:bg-red-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                     >
                        <Save size={16} /> Save Record
                     </button>
                 ) : breakdownMode === 'update' ? (
                     <>
                        <button 
                            onClick={() => handleBreakdownUpdate(false)} 
                            className="px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all active:scale-95"
                        >
                            Post Update
                        </button>
                        <button 
                            onClick={() => handleBreakdownUpdate(true)} 
                            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <CheckCheck size={16} /> Resolve Breakdown
                        </button>
                     </>
                 ) : (
                     <button onClick={() => setActiveModal(null)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all">Close</button>
                 )}
             </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {activeModal === 'verification' && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                  <div className="px-10 py-8 bg-green-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                      <div className="flex items-center gap-5">
                          <ShieldCheck size={32} />
                          <div>
                              <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Verify Resolution</h3>
                              <p className="text-[10px] font-bold text-green-100 uppercase tracking-widest mt-2">Confirm Breakdown Closure</p>
                          </div>
                      </div>
                      <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} /></button>
                  </div>
                  
                  <div className="p-10 space-y-6 bg-slate-50/20 overflow-y-auto custom-scrollbar flex-1">
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                          Please verify that the breakdown for <strong>{getSelectedReport()?.breakdownDetails?.equipment}</strong> has been fully resolved and the equipment is operational.
                      </p>
                      
                      <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Verification Remarks</label>
                           <textarea 
                              className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-green-400 resize-none shadow-inner transition-all placeholder:text-slate-300"
                              placeholder="Enter verification notes..."
                           />
                       </div>
                  </div>

                  <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                       <button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest">Cancel</button>
                       <button 
                          onClick={handleBreakdownVerification} 
                          className="px-12 py-4 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                          <CheckCheck size={16} /> Verify & Close
                       </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default FollowUpDashboard;
