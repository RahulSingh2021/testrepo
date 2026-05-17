"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Snowflake, Search, Filter, AlertTriangle,
  CheckCircle2, History, X,
  Thermometer, Clock, MapPin, Camera, Building2,
  CheckCheck, Zap, Calendar, ShieldCheck, Waves, PenTool,
  ChevronLeft, ChevronsLeft, ChevronsRight, FileDown,
  ClipboardList, ShieldAlert, Timer, ImageIcon, Eraser,
  Split, Warehouse, Info, Loader2, Play, Package,
  Globe, Check, Droplets, Microwave,
  ChevronRight, Hourglass, Lock,
  PlusCircle,
  Trash2,
  Download,
  CheckSquare,
  Square,
  TrendingUp,
  Activity,
  ZapOff,
  BarChart3,
  SlidersHorizontal,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  XCircle,
  QrCode,
  Save,
  User,
  Shield
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import { compressImage } from '@/utils/imageCompression';
import { drawPdfHeader, resolveEntityLogoSrc } from '@/utils/pdfHeader';
import UnifiedPagination from './UnifiedPagination';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { useNotifications } from './NotificationContext';

// --- Types ---

interface IssuedItem {
  id: string;
  location: string;
  quantity: number;
  timestamp: string;
}

type ThawMethod = 'Refrigerator' | 'Chilled water' | 'Microwave';

const MOCK_DEPTS = [
    "Main Kitchen", "Banquet Kitchen", "Bakery Section", "Pastry Section", 
    "Butchery", "Cold Kitchen", "Staff Cafeteria", "Production Line 1", 
    "Production Line 2", "Dispatch Area", "Satellite Kitchen", "Events Hall"
];

const THAW_DEPT_PERSONNEL: Record<string, { heads: string[]; staff: string[] }> = {
    'Main Kitchen': { heads: ['Chef Kumar', 'Sous Chef Ravi'], staff: ['Cook Ali', 'Cook Priya'] },
    'Cold Kitchen': { heads: ['Chef Deepak'], staff: ['Cook Meena', 'Cook Farhan'] },
    'Bakery Section': { heads: ['Pastry Chef Anita'], staff: ['Baker Rohit', 'Baker Sana'] },
    'Butchery': { heads: ['Head Butcher Raj'], staff: ['Butcher Asst. Karan'] },
    'Store Room': { heads: ['Store Manager Vijay'], staff: ['Store Asst. Rekha'] },
    'General': { heads: ['Operations Manager'], staff: [] },
};

const THAW_REMINDER_SCHEDULES: Record<ThawMethod, { intervals: number[]; labels: string[] }> = {
    'Refrigerator': {
        intervals: [2 * 3600000, 6 * 3600000, 12 * 3600000, 18 * 3600000, 24 * 3600000],
        labels: ['2 Hours', '6 Hours', '12 Hours', '18 Hours', '24 Hours (Max Duration)']
    },
    'Chilled water': {
        intervals: [30 * 60000, 60 * 60000, 90 * 60000, 120 * 60000],
        labels: ['30 Minutes', '1 Hour', '1.5 Hours', '2 Hours (Max Duration)']
    },
    'Microwave': {
        intervals: [5 * 60000, 10 * 60000, 15 * 60000],
        labels: ['5 Minutes', '10 Minutes', '15 Minutes (Max Duration)']
    }
};

interface ThawingRecordEntry {
  uuid: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  productName: string;
  batchNumber: string;
  mfgDate: string;
  expDate: string;
  supplierName: string;
  thawStartDate: string; 
  
  // Column 2 - Initiation
  thawMethod?: ThawMethod;
  thawStartTime?: string; 
  initialTemp?: number;
  initialTempImg?: string;
  waterTemp?: number;
  waterTempImg?: string;
  initiatedBy?: string;
  initiatedBySign?: string;
  initiationComments?: string;
  
  // Column 3 - Termination
  thawEndDate?: string;
  thawEndTime?: string; 
  finalTemp?: number;
  finalTempImg?: string;
  secondaryShelfLife?: string; 
  secondaryExpiry?: string;
  completedBy?: string;
  completedBySign?: string;
  completionComments?: string;
  totalQuantity: number;
  remainingQuantity: number;
  issued: IssuedItem[];

  // Column 5 - Verification
  isVerified: boolean;
  verifierName?: string;
  verificationComments?: string; 
  verifierSignature?: string; 
  verificationDate?: string;

  unitName: string;
  locationName: string;
  regionalName: string;
  departmentName: string;
}

// --- ISO 22000 Types ---
interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

// --- Helper Components ---

const SearchableDropdown = ({ options, value, onChange, placeholder }: { options: string[], value: string, onChange: (val: string) => void, placeholder: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-4 bg-white border-2 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
            >
                <span className={value ? "text-slate-800" : "text-slate-400"}>{value || placeholder}</span>
                <ChevronDown size={14} className="text-slate-400" />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50 bg-slate-50">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input
                                autoFocus
                                className="w-full pl-7 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-400"
                                placeholder="Search location..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? filteredOptions.map(opt => (
                            <div
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                                className="px-3 py-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                            >
                                {opt}
                            </div>
                        )) : <div className="px-3 py-2 text-[10px] text-slate-400 italic">No matches</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Digital Signature" }) => {
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
        const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
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
        <div className="space-y-2 text-left">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                <button type="button" onClick={clear} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                </button>
            </div>
            <div className="w-full h-24 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas ref={canvasRef} width={500} height={96} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw} />
            </div>
        </div>
    );
};

// --- Main ThawingRecord Component ---

interface ThawingRecordProps {
  entries: ThawingRecordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ThawingRecordEntry[]>>;
  onIssueToCooking?: (thawEntry: ThawingRecordEntry, quantity: number, location: string) => void;
  entities?: any[];
  userRootId?: string;
}

export default function ThawingRecord({ entries, setEntries, onIssueToCooking, entities = [], userRootId }: ThawingRecordProps) {
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [now, setNow] = useState(Date.now());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const thawTimersRef = useRef<Map<string, NodeJS.Timeout[]>>(new Map());

  const dynamicDepts = useMemo(() => {
    if (!userRootId || entities.length === 0) return MOCK_DEPTS;
    const getAggregated = (entId: string | undefined): string[] => {
      if (!entId) return [];
      const ent = entities.find((e: any) => e.id === entId);
      if (!ent) return [];
      return [...getAggregated(ent.parentId), ...(ent.masterDepartments || [])];
    };
    const depts = [...new Set(getAggregated(userRootId))];
    return depts.length > 0 ? depts : MOCK_DEPTS;
  }, [entities, userRootId]);

  const dynamicLocations = useMemo(() => {
    if (!userRootId || entities.length === 0) return [];
    const unit = entities.find((e: any) => e.id === userRootId);
    if (!unit) return [];
    const deptLocs = unit.departmentLocations || {};
    const deptSubLocs = unit.departmentSubLocations || {};
    const allLocs = new Set<string>();
    Object.values(deptLocs).forEach((locs: any) => {
      if (Array.isArray(locs)) locs.forEach((l: string) => allLocs.add(l));
    });
    Object.values(deptSubLocs).forEach((subs: any) => {
      if (Array.isArray(subs)) subs.forEach((s: string) => allLocs.add(s));
    });
    return Array.from(allLocs);
  }, [entities, userRootId]);

  const locationOptionsForDept = useMemo(() => {
    if (!userRootId || entities.length === 0) return dynamicDepts;
    const unit = entities.find((e: any) => e.id === userRootId);
    if (!unit) return dynamicDepts;
    const deptLocs = unit.departmentLocations || {};
    const deptSubLocs = unit.departmentSubLocations || {};
    const allLocs: string[] = [];
    for (const dept of dynamicDepts) {
      const locs = deptLocs[dept] || [];
      const subs = deptSubLocs[dept] || [];
      locs.forEach((l: string) => { if (!allLocs.includes(l)) allLocs.push(l); });
      subs.forEach((s: string) => { if (!allLocs.includes(s)) allLocs.push(s); });
    }
    return allLocs.length > 0 ? allLocs : dynamicDepts;
  }, [dynamicDepts, entities, userRootId]);

  // ISO 22000 Doc Control State
  const [docControlData] = useState<DocControlInfo>({
      docRef: 'THAW-RGST-22',
      version: '1.4',
      effectiveDate: new Date().toISOString().split('T')[0],
      approvedBy: 'Quality Assurance Director'
  });

  // Modal State
  const [activeModal, setActiveModal] = useState<'STEP1' | 'STEP2' | 'VERIFY' | 'BULK_VERIFY' | 'ISSUE' | 'MANUAL_ADD' | null>(null);
  const [manualForm, setManualForm] = useState({
    productName: '',
    batchNumber: '',
    mfgDate: '',
    expDate: '',
    supplierName: '',
    totalQuantity: '',
    departmentName: '',
    locationName: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<ThawingRecordEntry | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<any>({});
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const unitName = useMemo(() => {
    if (!entities?.length || !userRootId) return 'HACCP PRO ENTERPRISE SYSTEMS';
    const unit = entities.find((e: any) => e.id === userRootId);
    return unit?.name?.toUpperCase() || 'HACCP PRO ENTERPRISE SYSTEMS';
  }, [entities, userRootId]);

  const unitSubtitle = useMemo(() => {
    if (!entities?.length || !userRootId) return '';
    const unit = entities.find((e: any) => e.id === userRootId);
    if (!unit) return '';
    const parts: string[] = [];
    if (unit.address) parts.push(unit.address);
    else if (unit.location) parts.push(unit.location);
    const parent = unit.parentId ? entities.find((e: any) => e.id === unit.parentId) : null;
    if (parent?.name) parts.push(parent.name);
    return parts.join('  |  ');
  }, [entities, userRootId]);

  const logoSrc = useMemo(() => resolveEntityLogoSrc(entities, userRootId), [entities, userRootId]);

  const locationsForSelectedDept = useMemo(() => {
    if (!userRootId || entities.length === 0) return [];
    const unit = entities.find((e: any) => e.id === userRootId);
    if (!unit) return [];
    const dept = manualForm.departmentName;
    if (!dept) return [];
    const locs = (unit.departmentLocations || {})[dept] || [];
    const subs = (unit.departmentSubLocations || {})[dept] || [];
    return [...locs, ...subs];
  }, [entities, userRootId, manualForm.departmentName]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeLapseInternal = (start?: string, end?: string, currentNow?: number) => {
    if (!start) return '--:--';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : (currentNow || now);
    const diff = Math.max(0, endTime - startTime);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  };

  const clearThawTimers = (uuid: string) => {
      const timers = thawTimersRef.current.get(uuid);
      if (timers) { timers.forEach(t => clearTimeout(t)); thawTimersRef.current.delete(uuid); }
  };

  const scheduleThawReminders = (entry: ThawingRecordEntry, thawMethod: ThawMethod) => {
      clearThawTimers(entry.uuid);
      const schedule = THAW_REMINDER_SCHEDULES[thawMethod];
      if (!schedule) return;
      const timers: NodeJS.Timeout[] = [];
      const productLabel = `${entry.productName} (${entry.batchNumber})`;
      const dept = entry.departmentName || 'General';
      const deptInfo = THAW_DEPT_PERSONNEL[dept] || THAW_DEPT_PERSONNEL['General'];
      const isLast = (i: number) => i === schedule.intervals.length - 1;

      schedule.intervals.forEach((ms, i) => {
          const t = setTimeout(() => {
              addNotification({
                  type: 'THAWING_MONITOR',
                  title: `Thawing Reminder — ${schedule.labels[i]}`,
                  message: `${schedule.labels[i]} elapsed for ${productLabel} using ${thawMethod} method.${isLast(i) ? ' Maximum recommended duration reached. Please complete the thawing process and record the final temperature immediately.' : ' Please monitor the product temperature and condition.'}`,
                  department: dept,
                  icon: isLast(i) ? 'shield' : 'alert',
                  severity: isLast(i) ? 'critical' : 'warning',
                  recipients: [...deptInfo.heads, entry.initiatedBy || 'Operator'],
              });
          }, ms);
          timers.push(t);
      });
      thawTimersRef.current.set(entry.uuid, timers);
  };

  useEffect(() => {
      return () => {
          thawTimersRef.current.forEach((timers) => timers.forEach(t => clearTimeout(t)));
          thawTimersRef.current.clear();
      };
  }, []);

  const stats = useMemo(() => {
      const pending = entries.filter(e => e.status === 'PENDING').length;
      const inFlow = entries.filter(e => e.status === 'IN_PROGRESS').length;
      const dueAuth = entries.filter(e => e.status === 'COMPLETED' && !e.isVerified).length;
      const verified = entries.filter(e => e.isVerified).length;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const todayCount = entries.filter(e => e.thawStartDate === todayStr).length;
      const total = entries.length;
      const avgDay = (total / 7).toFixed(1);

      let totalLapse = 0;
      let lapseCount = 0;
      entries.forEach(e => {
          if (e.thawStartTime && e.thawEndTime) {
              const diff = new Date(e.thawEndTime).getTime() - new Date(e.thawStartTime).getTime();
              totalLapse += diff;
              lapseCount++;
          }
      });
      const avgLapseMs = lapseCount ? totalLapse / lapseCount : 0;
      const avgLapse = lapseCount 
          ? `${Math.floor(avgLapseMs / 3600000)}h ${Math.floor((avgLapseMs % 3600000) / 60000)}m` 
          : '---';

      return { pending, inFlow, dueAuth, verified, todayCount, total, avgDay, avgLapse };
  }, [entries]);

  const filteredEntries = useMemo(() => {
      let data = entries;
      if (statusFilter === 'PENDING') data = data.filter(e => e.status === 'PENDING');
      else if (statusFilter === 'IN_PROGRESS') data = data.filter(e => e.status === 'IN_PROGRESS');
      else if (statusFilter === 'DUE_AUTH') data = data.filter(e => e.status === 'COMPLETED' && !e.isVerified);
      else if (statusFilter === 'VERIFIED') data = data.filter(e => e.isVerified);

      if (dateFrom) {
        data = data.filter(e => new Date(e.thawStartDate) >= new Date(dateFrom));
      }
      if (dateTo) {
        data = data.filter(e => new Date(e.thawStartDate) <= new Date(dateTo));
      }

      return data.filter(e => e.productName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [entries, searchTerm, statusFilter, dateFrom, dateTo]);

  const paginatedEntries = useMemo(() => {
      const start = (currentPage - 1) * rowsPerPage;
      return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);

  const toggleCard = (id: string) => {
    const next = new Set(expandedCardIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedCardIds(next);
  };

  const handleOpenStep1 = (entry: ThawingRecordEntry) => {
      setSelectedEntry(entry);
      setFormData({
          thawMethod: 'Refrigerator',
          initialTemp: '',
          waterTemp: '',
          initiatedBy: 'Chef User',
          initiationComments: '',
          signature: ''
      });
      setActiveModal('STEP1');
  };

  const handleOpenStep2 = (entry: ThawingRecordEntry) => {
      setSelectedEntry(entry);
      setFormData({
          finalTemp: '',
          completedBy: 'Chef User',
          completionComments: '',
          signature: ''
      });
      setActiveModal('STEP2');
  };

  const handleOpenVerify = (entry: ThawingRecordEntry) => {
      setSelectedEntry(entry);
      setFormData({
          verifierName: 'QA Manager',
          verificationComments: '',
          signature: ''
      });
      setActiveModal('VERIFY');
  };

  const handleBulkVerifyOpen = () => {
      if (selectedIds.size === 0) return;
      setFormData({
          verifierName: 'QA Manager',
          verificationComments: 'Batch verification of thawing records.',
          signature: ''
      });
      setActiveModal('BULK_VERIFY');
  };

  const handleOpenIssue = (entry: ThawingRecordEntry) => {
      setSelectedEntry(entry);
      setFormData({
          splits: [{ id: Date.now(), location: '', quantity: '' }]
      });
      setActiveModal('ISSUE');
  };

  const handleManualAdd = () => {
    const { productName, batchNumber, totalQuantity } = manualForm;
    if (!productName.trim()) return;
    const qty = Math.max(0.01, parseFloat(totalQuantity) || 1);
    const newEntry: ThawingRecordEntry = {
      uuid: `thaw-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'PENDING',
      productName: productName.trim(),
      batchNumber: batchNumber.trim() || `BATCH-${Date.now().toString(36).toUpperCase()}`,
      mfgDate: manualForm.mfgDate || new Date().toISOString().split('T')[0],
      expDate: manualForm.expDate || '',
      supplierName: manualForm.supplierName.trim() || 'Manual Entry',
      thawStartDate: new Date().toISOString().split('T')[0],
      totalQuantity: qty,
      remainingQuantity: qty,
      issued: [],
      isVerified: false,
      unitName: '',
      locationName: manualForm.locationName || '',
      regionalName: '',
      departmentName: manualForm.departmentName || 'General',
    };
    setEntries(prev => [newEntry, ...prev]);
    setManualForm({ productName: '', batchNumber: '', mfgDate: '', expDate: '', supplierName: '', totalQuantity: '', departmentName: '', locationName: '' });
    setActiveModal(null);
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const compressed = await compressImage(ev.target?.result as string);
              setFormData((prev: any) => ({ ...prev, [field]: compressed }));
          };
          reader.readAsDataURL(file);
      }
      e.target.value = '';
  };

  const [tempWarning, setTempWarning] = useState<string | null>(null);

  const handleSubmitStep1 = () => {
      if (!selectedEntry) return;
      const rawTemp = formData.initialTemp?.toString().trim();
      if (!rawTemp) {
          setTempWarning('Starting core temperature is required.');
          return;
      }
      if (!rawTemp.includes('.')) {
          setTempWarning('Temperature must be entered in decimal format (e.g. -18.0, -20.5).');
          return;
      }
      const tempVal = parseFloat(rawTemp);
      if (isNaN(tempVal)) {
          setTempWarning('Please enter a valid temperature value.');
          return;
      }
      if (tempVal > -18) {
          if (!formData.initiationComments?.trim()) {
              setTempWarning('Remarks are mandatory when starting core temperature is above -18.0°C. Please provide an explanation.');
              return;
          }
      }
      setTempWarning(null);
      const nowIso = new Date().toISOString();
      const updatedEntry = {
          ...selectedEntry,
          status: 'IN_PROGRESS' as const,
          thawStartTime: nowIso,
          thawMethod: formData.thawMethod as ThawMethod,
          initialTemp: tempVal,
          initialTempImg: formData.initialTempImg,
          waterTemp: parseFloat(formData.waterTemp),
          waterTempImg: formData.waterTempImg,
          initiatedBy: formData.initiatedBy,
          initiatedBySign: formData.signature,
          initiationComments: formData.initiationComments
      };
      setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? updatedEntry : e));

      const dept = selectedEntry.departmentName || 'General';
      const deptInfo = THAW_DEPT_PERSONNEL[dept] || THAW_DEPT_PERSONNEL['General'];
      const productLabel = `${selectedEntry.productName} (${selectedEntry.batchNumber})`;
      addNotification({
          type: 'THAWING_STARTED',
          title: 'Thawing Process Started',
          message: `Thawing initiated for ${productLabel} using ${formData.thawMethod} method by ${formData.initiatedBy || 'Operator'}. Department: ${dept}. Initial temp: ${tempVal}°C.`,
          department: dept,
          icon: 'info',
          severity: 'info',
          recipients: [...deptInfo.heads],
          senderName: formData.initiatedBy || 'Operator',
      });
      scheduleThawReminders(updatedEntry, formData.thawMethod as ThawMethod);

      setActiveModal(null);
  };

  const [step2Warning, setStep2Warning] = useState<string | null>(null);

  const handleSubmitStep2 = () => {
      if (!selectedEntry) return;
      const rawTemp = formData.finalTemp?.toString().trim();
      if (!rawTemp) {
          setStep2Warning('Final core temperature is required.');
          return;
      }
      if (!rawTemp.includes('.')) {
          setStep2Warning('Temperature must be entered in decimal format (e.g. 4.0, 3.5).');
          return;
      }
      const tempVal = parseFloat(rawTemp);
      if (isNaN(tempVal)) {
          setStep2Warning('Please enter a valid temperature value.');
          return;
      }
      if (!formData.finalTempImg) {
          setStep2Warning('Temperature evidence image is mandatory. Please upload a photo.');
          return;
      }
      if (tempVal > 5) {
          if (!formData.completionComments?.trim()) {
              setStep2Warning('Remarks are mandatory when final temperature exceeds 5.0°C. Please provide an explanation.');
              return;
          }
      }
      setStep2Warning(null);
      const nowIso = new Date().toISOString();
      const shelfLifeDate = new Date(nowIso);
      shelfLifeDate.setDate(shelfLifeDate.getDate() + 1);
      
      setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? {
          ...e,
          status: 'COMPLETED',
          thawEndTime: nowIso,
          thawEndDate: nowIso.split('T')[0],
          finalTemp: tempVal,
          finalTempImg: formData.finalTempImg,
          completedBy: formData.completedBy,
          completedBySign: formData.signature,
          completionComments: formData.completionComments,
          secondaryShelfLife: '24 Hours',
          secondaryExpiry: shelfLifeDate.toISOString()
      } : e));

      clearThawTimers(selectedEntry.uuid);
      const dept = selectedEntry.departmentName || 'General';
      const deptInfo = THAW_DEPT_PERSONNEL[dept] || THAW_DEPT_PERSONNEL['General'];
      const productLabel = `${selectedEntry.productName} (${selectedEntry.batchNumber})`;
      const thawDuration = formatTimeLapseInternal(selectedEntry.thawStartTime, nowIso, new Date(nowIso).getTime());
      addNotification({
          type: 'THAWING_COMPLETED',
          title: 'Thawing Process Completed',
          message: `Thawing completed for ${productLabel}. Final temp: ${tempVal}°C. Duration: ${thawDuration}. Method: ${selectedEntry.thawMethod || 'N/A'}. Completed by ${formData.completedBy || 'Operator'}.${tempVal > 5 ? ' ⚠️ Final temperature exceeds 5.0°C standard.' : ''}`,
          department: dept,
          icon: tempVal > 5 ? 'alert' : 'check',
          severity: tempVal > 5 ? 'warning' : 'info',
          recipients: [...deptInfo.heads, selectedEntry.initiatedBy || 'Operator'],
          senderName: formData.completedBy || 'Operator',
      });

      setActiveModal(null);
  };

  const handleSubmitVerify = () => {
      if (!selectedEntry) return;
      setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? {
          ...e,
          isVerified: true,
          verifierName: formData.verifierName,
          verifierSignature: formData.signature,
          verificationComments: formData.verificationComments,
          verificationDate: new Date().toISOString()
      } : e));
      setActiveModal(null);
  };

  const handleSubmitBulkVerify = () => {
      const nowIso = new Date().toISOString();
      setEntries(prev => prev.map(e => {
          if (selectedIds.has(e.uuid) && e.status === 'COMPLETED' && !e.isVerified && e.remainingQuantity === 0) {
              return {
                  ...e,
                  isVerified: true,
                  verifierName: formData.verifierName,
                  verifierSignature: formData.signature,
                  verificationComments: formData.verificationComments,
                  verificationDate: nowIso
              };
          }
          return e;
      }));
      setSelectedIds(new Set());
      setActiveModal(null);
  };

  const handleSubmitIssue = () => {
      if (!selectedEntry) return;
      const splits = formData.splits || [];
      let totalSplitQty = 0;
      const validSplits: any[] = [];
      for (const split of splits) {
          const qty = parseFloat(split.quantity);
          if (!split.location) { alert("Please select a location for all entries."); return; }
          if (isNaN(qty) || qty <= 0) { alert("Please enter valid quantities."); return; }
          totalSplitQty += qty;
          validSplits.push({ location: split.location, quantity: qty });
      }
      if (totalSplitQty > selectedEntry.remainingQuantity) {
          alert(`Total split quantity (${totalSplitQty} KG) exceeds available quantity (${selectedEntry.remainingQuantity} KG).`);
          return;
      }
      const newItems: IssuedItem[] = validSplits.map(s => ({
          id: `iss-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          location: s.location,
          quantity: s.quantity,
          timestamp: new Date().toISOString()
      }));

      if (onIssueToCooking) {
          validSplits.forEach(s => {
              onIssueToCooking(selectedEntry, s.quantity, s.location);
          });
      }

      setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? {
          ...e,
          remainingQuantity: e.remainingQuantity - totalSplitQty,
          issued: [...e.issued, ...newItems]
      } : e));

      const dept = selectedEntry.departmentName || 'General';
      const deptInfo = THAW_DEPT_PERSONNEL[dept] || THAW_DEPT_PERSONNEL['General'];
      const productLabel = `${selectedEntry.productName} (${selectedEntry.batchNumber})`;
      const locationList = validSplits.map(s => `${s.quantity} KG → ${s.location}`).join(', ');
      addNotification({
          type: 'THAWING_ISSUED',
          title: 'Thawed Material Issued',
          message: `${totalSplitQty} KG of ${productLabel} issued to cooking. Distribution: ${locationList}. Remaining: ${(selectedEntry.remainingQuantity - totalSplitQty).toFixed(1)} KG.`,
          department: dept,
          icon: 'info',
          severity: 'info',
          recipients: [...deptInfo.heads, selectedEntry.completedBy || selectedEntry.initiatedBy || 'Operator'],
      });

      setActiveModal(null);
  };

  const updateSplitRow = (id: number, field: string, value: string) => {
      setFormData((prev: any) => ({
          ...prev,
          splits: prev.splits.map((s: any) => s.id === id ? { ...s, [field]: value } : s)
      }));
  };

  const addSplitRow = () => {
      setFormData((prev: any) => ({
          ...prev,
          splits: [...prev.splits, { id: Date.now() + Math.random(), location: '', quantity: '' }]
      }));
  };

  const removeSplitRow = (id: number) => {
      setFormData((prev: any) => ({
          ...prev,
          splits: prev.splits.filter((s: any) => s.id !== id)
      }));
  };

  const handleFilterClick = (filter: string) => {
      if (statusFilter === filter) setStatusFilter(null);
      else setStatusFilter(filter);
      setCurrentPage(1);
  };

  const handleRefresh = () => {
      setSearchTerm("");
      setStatusFilter(null);
      setDateFrom("");
      setDateTo("");
      setCurrentPage(1);
  };

  const buildThawingQRUrl = (e: ThawingRecordEntry): string => {
      const data: Record<string, unknown> = {
          pn: e.productName, bn: e.batchNumber, md: e.mfgDate, ed: e.expDate,
          vn: e.supplierName, loc: e.locationName, unit: e.unitName,
          reg: e.regionalName, dept: e.departmentName,
          tm: e.thawMethod || '', st: e.status,
          tst: e.thawStartTime || '', tet: e.thawEndTime || '',
          it: e.initialTemp !== undefined ? String(e.initialTemp) : '',
          ft: e.finalTemp !== undefined ? String(e.finalTemp) : '',
          wt: e.waterTemp !== undefined ? String(e.waterTemp) : '',
          ib: e.initiatedBy || '', cb: e.completedBy || '',
          ic: e.initiationComments || '', cc: e.completionComments || '',
          tq: String(e.totalQuantity), rq: String(e.remainingQuantity),
          sl: e.secondaryShelfLife || '', se: e.secondaryExpiry || '',
          vf: e.isVerified ? 1 : 0,
      };
      if (e.issued && e.issued.length > 0) data.iss = e.issued.map(i => `${i.location}:${i.quantity}`).join('|');
      if (e.verifierName) data.vrn = e.verifierName;
      if (e.verificationComments) data.vrc = e.verificationComments;
      if (e.verificationDate) data.vrd = e.verificationDate;
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      return `${baseUrl}/thaw-record?d=${encoded}`;
  };

  const renderQRToCanvas = (qrString: string): Promise<string> => {
      return new Promise((resolve) => {
          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.top = '-9999px';
          document.body.appendChild(container);
          container.innerHTML = renderToString(<QRCodeSVG value={qrString} size={400} level="L" />);
          const svgEl = container.querySelector('svg');
          if (!svgEl) { document.body.removeChild(container); resolve(''); return; }
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const canvas = document.createElement('canvas');
          canvas.width = 400; canvas.height = 400;
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => { ctx?.drawImage(img, 0, 0, 400, 400); const dataUrl = canvas.toDataURL('image/png'); document.body.removeChild(container); resolve(dataUrl); };
          img.onerror = () => { document.body.removeChild(container); resolve(''); };
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          img.src = URL.createObjectURL(svgBlob);
      });
  };

  // --- ISO 22000 PDF EXPORT (Native jsPDF Implementation) ---
  const handleExportSinglePDF = async (entry: ThawingRecordEntry) => {
    setIsGeneratingPDF(true);
    try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 40, mr = 40, mt = 40, mb = 50;
        const cw = pw - ml - mr;
        let y = mt;
        const securityId = `THAW-AUTH-${entry.uuid.substring(0, 8).toUpperCase()}`;
        const timestamp = new Date().toLocaleString();

        pdf.setTextColor(235, 238, 245);
        pdf.setFontSize(52);
        pdf.setFont('helvetica', 'bold');
        pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 });

        y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'THAWING RECORD', subtitle: unitSubtitle || undefined, logoSrc, docControlData });

        pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text(`THAWING RECORD #${entry.batchNumber}`, ml, y);
        const statusColor: Record<string, number[]> = { 'PENDING': [100, 116, 139], 'IN_PROGRESS': [245, 158, 11], 'COMPLETED': [5, 150, 105] };
        const sc = statusColor[entry.status] || [100, 116, 139];
        pdf.setTextColor(sc[0], sc[1], sc[2]);
        pdf.setFontSize(9);
        pdf.text(entry.status.toUpperCase(), pw - mr, y, { align: 'right' });
        y += 12;

        const rowH = 16;
        const halfW = cw / 2;

        const sectionHeader = (title: string) => {
            if (y + 20 > ph - mb) { pdf.addPage(); y = mt; }
            pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 16, 'F');
            pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
            pdf.text(title, ml + 8, y + 11);
            y += 16;
        };

        const drawRow = (label1: string, val1: string, label2?: string, val2?: string, valColor1?: number[], valColor2?: number[]) => {
            if (y + rowH > ph - mb) { pdf.addPage(); y = mt; }
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
            pdf.line(ml, y + rowH, ml + cw, y + rowH);
            if (label2) pdf.line(ml + halfW, y, ml + halfW, y + rowH);
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139);
            pdf.text(label1, ml + 8, y + 11);
            pdf.setFont('helvetica', 'bold');
            if (valColor1) pdf.setTextColor(valColor1[0], valColor1[1], valColor1[2]);
            else pdf.setTextColor(15, 23, 42);
            pdf.text(String(val1).substring(0, 45), ml + 100, y + 11);
            if (label2 && val2 !== undefined) {
                pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139);
                pdf.text(label2, ml + halfW + 8, y + 11);
                pdf.setFont('helvetica', 'bold');
                if (valColor2) pdf.setTextColor(valColor2[0], valColor2[1], valColor2[2]);
                else pdf.setTextColor(15, 23, 42);
                pdf.text(String(val2).substring(0, 45), ml + halfW + 100, y + 11);
            }
            y += rowH;
        };

        sectionHeader('UNIT DETAILS');
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 2);
        drawRow('Location:', entry.locationName, 'Department:', entry.departmentName);
        drawRow('Unit:', entry.unitName, 'Region:', entry.regionalName);

        sectionHeader('PRODUCT INFORMATION');
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 4);
        drawRow('Product Name:', entry.productName, '', '', [79, 70, 229]);
        drawRow('Vendor:', entry.supplierName, 'Batch Number:', entry.batchNumber);
        drawRow('MFG Date:', entry.mfgDate, 'EXP Date:', entry.expDate, undefined, [225, 29, 72]);
        drawRow('Total Quantity:', `${entry.totalQuantity} KG`, 'Remaining:', `${entry.remainingQuantity} KG`);

        sectionHeader('THAWING INITIATION');
        const initRows = 3 + (entry.thawMethod === 'Chilled water' ? 1 : 0) + (entry.initiationComments ? 1 : 0);
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * initRows);
        drawRow('Method:', entry.thawMethod || 'N/A', 'Start Time:', entry.thawStartTime ? new Date(entry.thawStartTime).toLocaleString() : '---');
        drawRow('Initial Temp:', entry.initialTemp !== undefined ? `${entry.initialTemp}°C` : '---', 'Initiated By:', entry.initiatedBy || '---', [225, 29, 72]);
        if (entry.thawMethod === 'Chilled water') {
            drawRow('Water Temp:', entry.waterTemp !== undefined ? `${entry.waterTemp}°C` : '---', '', '', [2, 132, 199]);
        }
        if (entry.initiationComments) {
            drawRow('Comments:', entry.initiationComments);
        }
        drawRow('', '');

        if (entry.initialTempImg && entry.initialTempImg.startsWith('data:')) {
            try {
                const imgFmt = entry.initialTempImg.includes('image/png') ? 'PNG' : 'JPEG';
                pdf.addImage(entry.initialTempImg, imgFmt, ml + 8, y + 2, 60, 50);
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                pdf.text('Initial Temp Evidence', ml + 8, y + 56);
            } catch {}
            if (entry.waterTempImg && entry.waterTempImg.startsWith('data:')) {
                try {
                    const imgFmt2 = entry.waterTempImg.includes('image/png') ? 'PNG' : 'JPEG';
                    pdf.addImage(entry.waterTempImg, imgFmt2, ml + 80, y + 2, 60, 50);
                    pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                    pdf.text('Water Temp Evidence', ml + 80, y + 56);
                } catch {}
            }
            y += 62;
        }

        if (entry.initiatedBySign && entry.initiatedBySign.startsWith('data:')) {
            try {
                pdf.addImage(entry.initiatedBySign, 'PNG', ml + 8, y + 2, 80, 30);
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                pdf.text('Initiation Signature', ml + 8, y + 36);
            } catch {}
            y += 40;
        }

        sectionHeader('THAWING TERMINATION');
        const termRows = 3 + (entry.completionComments ? 1 : 0);
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * termRows);
        drawRow('End Time:', entry.thawEndTime ? new Date(entry.thawEndTime).toLocaleString() : '---', 'Final Temp:', entry.finalTemp !== undefined ? `${entry.finalTemp}°C` : '---', undefined, [16, 185, 129]);
        drawRow('Secondary Shelf Life:', entry.secondaryShelfLife || '---', 'Secondary Expiry:', entry.secondaryExpiry ? new Date(entry.secondaryExpiry).toLocaleDateString() : '---');
        drawRow('Completed By:', entry.completedBy || '---');
        if (entry.completionComments) {
            drawRow('Comments:', entry.completionComments);
        }

        if (entry.finalTempImg && entry.finalTempImg.startsWith('data:')) {
            try {
                const imgFmt = entry.finalTempImg.includes('image/png') ? 'PNG' : 'JPEG';
                pdf.addImage(entry.finalTempImg, imgFmt, ml + 8, y + 2, 60, 50);
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                pdf.text('Final Temp Evidence', ml + 8, y + 56);
            } catch {}
            y += 62;
        }

        if (entry.completedBySign && entry.completedBySign.startsWith('data:')) {
            try {
                pdf.addImage(entry.completedBySign, 'PNG', ml + 8, y + 2, 80, 30);
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                pdf.text('Completion Signature', ml + 8, y + 36);
            } catch {}
            y += 40;
        }

        sectionHeader('DISTRIBUTION REGISTRY');
        if (entry.issued.length > 0) {
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
            pdf.rect(ml, y, cw, rowH * (entry.issued.length + 1));
            entry.issued.forEach(iss => {
                drawRow('Location:', iss.location, 'Quantity:', `${iss.quantity} KG`, [79, 70, 229]);
            });
            drawRow('Remaining Quantity:', `${entry.remainingQuantity} KG`, '', '', [225, 29, 72]);
        } else {
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH);
            drawRow('Status:', 'No distributions recorded', '', '', [148, 163, 184]);
        }

        sectionHeader('AUTHORIZATION & VERIFICATION');
        const authRows = 3 + (entry.verificationComments ? 1 : 0) + (entry.verificationDate ? 1 : 0);
        pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * authRows);
        drawRow('Verified By:', entry.isVerified ? (entry.verifierName || 'N/A') : 'PENDING', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
        drawRow('Verification Status:', entry.isVerified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
        drawRow('Record Status:', entry.status);
        if (entry.verificationComments) {
            drawRow('Comments:', entry.verificationComments);
        }
        if (entry.verificationDate) {
            const vDateStr = new Date(entry.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
            drawRow('Verification Date:', vDateStr);
        }

        if (entry.verifierSignature && entry.verifierSignature.startsWith('data:')) {
            try {
                pdf.addImage(entry.verifierSignature, 'PNG', ml + 8, y + 2, 80, 30);
                pdf.setFontSize(6); pdf.setTextColor(100, 116, 139);
                pdf.text('Verifier Signature', ml + 8, y + 36);
            } catch {}
            y += 40;
        }

        y += 6;
        sectionHeader('DIGITAL IDENTITY PASSPORT (QR CODE)');
        const qrString = buildThawingQRUrl(entry);
        try {
            const qrDataUrl = await renderQRToCanvas(qrString);
            if (qrDataUrl) {
                const qrS = 80;
                pdf.addImage(qrDataUrl, 'PNG', ml + 10, y + 6, qrS, qrS);
                pdf.setFontSize(8); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
                pdf.text('SCAN FOR COMPLETE', ml + qrS + 24, y + 30);
                pdf.text('DIGITAL RECORD', ml + qrS + 24, y + 42);
                pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                pdf.text(`Record Hash: ${securityId}`, ml + qrS + 24, y + 56);
            }
        } catch {}
        y += 82;

        if (y + 60 > ph - mb) { pdf.addPage(); y = mt; }
        pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
        const sigW = (cw - 20) / 2;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml, y, sigW, 50, 'FD');
        pdf.setFontSize(7); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text('REGISTRY PROCESS SIGNATURE', ml + 8, y + 14);
        pdf.setDrawColor(203, 213, 225); pdf.line(ml + 8, y + 40, ml + sigW - 8, y + 40);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml + sigW + 20, y, sigW, 50, 'FD');
        pdf.setFontSize(7); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text('VERIFICATION NODE AUTH', ml + sigW + 28, y + 14);
        pdf.setDrawColor(203, 213, 225); pdf.line(ml + sigW + 28, y + 40, ml + sigW + 20 + sigW - 8, y + 40);
        y += 60;

        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(148, 163, 184);
        pdf.text(`System Timestamp: ${timestamp}`, ml, ph - 30);
        pdf.text(`Electronic Integrity Hash: ${securityId}`, pw - mr, ph - 30, { align: 'right' });

        savePdfForPWA(pdf, `Thawing_Record_${entry.uuid.substring(0, 8)}.pdf`);
    } catch (err) {
        console.error("Single PDF Export failed", err);
    } finally {
        setIsGeneratingPDF(false);
    }
  };

  const handleExportPDFBulk = async () => {
    if (filteredEntries.length === 0) return;
    setIsGeneratingPDF(true);
    try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 30, mr = 30, mt = 30, mb = 40;
        const cw = pw - ml - mr;
        let y = mt;
        const securityId = `CERT-THAW-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const nowTimestamp = new Date().toLocaleString();
        const colWidths = [0.18, 0.18, 0.18, 0.16, 0.12, 0.18].map(w => w * cw);
        const colHeaders = ['PRODUCT DETAILS', 'THAWING INITIATION', 'THAWING TERMINATION', 'SPLIT PORTFOLIO', 'QR PASSPORT', 'VERIFICATION'];

        const qrCache: Record<string, string> = {};
        for (const e of filteredEntries) {
            const qrUrl = buildThawingQRUrl(e);
            try { qrCache[e.uuid] = await renderQRToCanvas(qrUrl); } catch { qrCache[e.uuid] = ''; }
        }

        const drawWatermark = () => {
            pdf.setTextColor(235, 238, 245);
            pdf.setFontSize(60);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 });
        };

        const drawHeader = () => {
            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'THAWING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData, compact: true });
        };

        const drawColHeaders = () => {
            pdf.setFillColor(30, 41, 59);
            pdf.rect(ml, y, cw, 16, 'F');
            pdf.setFontSize(6.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
            let cx = ml;
            colHeaders.forEach((h, i) => {
                pdf.text(h, cx + 6, y + 11);
                cx += colWidths[i];
            });
            y += 16;
        };

        drawWatermark();
        drawHeader();

        pdf.setFontSize(9); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text(`THAWING CONTROL REGISTRY  |  ${filteredEntries.length} Records  |  Generated: ${nowTimestamp}`, ml, y + 2);
        y += 10;

        drawColHeaders();

        for (let idx = 0; idx < filteredEntries.length; idx++) {
            const e = filteredEntries[idx];
            const rowH = e.isVerified ? 90 : 70;

            if (y + rowH > ph - mb) {
                const pageNum = pdf.getNumberOfPages();
                pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(148, 163, 184);
                pdf.text(`System Timestamp: ${nowTimestamp}`, ml, ph - 15);
                pdf.text(`Hash: ${securityId}`, pw / 2, ph - 15, { align: 'center' });
                pdf.text(`Page ${pageNum}`, pw - mr, ph - 15, { align: 'right' });
                pdf.addPage();
                y = mt;
                drawWatermark();
                drawColHeaders();
            }

            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
            let cx = ml;
            for (let c = 0; c <= colWidths.length; c++) {
                pdf.line(cx, y, cx, y + rowH);
                cx += (colWidths[c] || 0);
            }
            pdf.line(ml, y, ml + cw, y);
            pdf.line(ml, y + rowH, ml + cw, y + rowH);

            const truncText = (text: string, maxW: number, fontSize: number) => {
                pdf.setFontSize(fontSize);
                let t = text;
                while (pdf.getTextWidth(t) > maxW && t.length > 3) t = t.substring(0, t.length - 1);
                if (t.length < text.length) t += '..';
                return t;
            };

            let x0 = ml + 6;
            const w0 = colWidths[0] - 12;
            pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 23, 42);
            pdf.text(truncText(e.productName.toUpperCase(), w0, 7), x0, y + 10);
            pdf.setFontSize(6); pdf.setFont('courier', 'bold'); pdf.setTextColor(71, 85, 105);
            pdf.text(`BATCH: ${e.batchNumber}`, x0, y + 18);
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139);
            pdf.text(`Unit: ${e.unitName}`, x0, y + 26);
            pdf.text(`Region: ${e.regionalName}`, x0, y + 32);
            pdf.text(`Dept: ${e.departmentName}`, x0, y + 38);
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.setTextColor(15, 23, 42);
            pdf.text(`MFG: ${e.mfgDate}`, x0, y + 48);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`EXP: ${e.expDate}`, x0, y + 55);
            pdf.setTextColor(79, 70, 229); pdf.setFontSize(5.5);
            pdf.text(truncText(`VENDOR: ${e.supplierName}`, w0, 5.5), x0, y + 63);

            let x1 = ml + colWidths[0] + 6;
            const w1 = colWidths[1] - 12;
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 23, 42);
            pdf.text(`METHOD: ${e.thawMethod || 'N/A'}`, x1, y + 10);
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139);
            pdf.text(`START: ${e.thawStartTime ? new Date(e.thawStartTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---'}`, x1, y + 18);
            pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(225, 29, 72);
            pdf.text(`${e.initialTemp !== undefined ? e.initialTemp : '--'}°C`, x1, y + 32);
            let iy1 = 36;
            if (e.initialTempImg && e.initialTempImg.startsWith('data:')) {
                try { pdf.addImage(e.initialTempImg, e.initialTempImg.includes('image/png') ? 'PNG' : 'JPEG', x1, y + iy1, 25, 20); iy1 += 22; } catch {}
            }
            if (e.thawMethod === 'Chilled water') {
                pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(2, 132, 199);
                pdf.text(`WATER: ${e.waterTemp || '--'}°C`, x1, y + iy1); iy1 += 7;
            }
            pdf.setFontSize(5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(100, 116, 139);
            pdf.text(`By: ${e.initiatedBy || '---'}`, x1, y + iy1); iy1 += 6;
            if (e.initiatedBySign && e.initiatedBySign.startsWith('data:')) {
                try { pdf.addImage(e.initiatedBySign, 'PNG', x1, y + iy1, 40, 15); } catch {}
            }

            let x2 = ml + colWidths[0] + colWidths[1] + 6;
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139);
            pdf.text(`END: ${e.thawEndTime ? new Date(e.thawEndTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '---'}`, x2, y + 10);
            pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(16, 185, 129);
            pdf.text(`${e.finalTemp !== undefined ? e.finalTemp : '--'}°C`, x2, y + 24);
            let iy2 = 28;
            if (e.finalTempImg && e.finalTempImg.startsWith('data:')) {
                try { pdf.addImage(e.finalTempImg, e.finalTempImg.includes('image/png') ? 'PNG' : 'JPEG', x2, y + iy2, 25, 20); iy2 += 22; } catch {}
            }
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(79, 70, 229);
            pdf.text(`LIFE: ${e.secondaryShelfLife || '---'}`, x2, y + iy2); iy2 += 7;
            if (e.secondaryExpiry) {
                pdf.setFontSize(5); pdf.setTextColor(100, 116, 139);
                pdf.text(`Exp: ${new Date(e.secondaryExpiry).toLocaleDateString()}`, x2, y + iy2); iy2 += 7;
            }
            pdf.setFontSize(5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(100, 116, 139);
            pdf.text(`By: ${e.completedBy || '---'}`, x2, y + iy2); iy2 += 6;
            if (e.completedBySign && e.completedBySign.startsWith('data:')) {
                try { pdf.addImage(e.completedBySign, 'PNG', x2, y + iy2, 40, 15); } catch {}
            }

            let x3 = ml + colWidths[0] + colWidths[1] + colWidths[2] + 6;
            const w3 = colWidths[3] - 12;
            pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 23, 42);
            pdf.text(`TOTAL LOAD: ${e.totalQuantity} KG`, x3, y + 10);
            let iy3 = 18;
            if (e.issued.length > 0) {
                e.issued.forEach(iss => {
                    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(51, 65, 85);
                    pdf.text(truncText(iss.location, w3, 5.5), x3, y + iy3); iy3 += 6;
                    pdf.setTextColor(79, 70, 229);
                    pdf.text(`${iss.quantity} KG`, x3, y + iy3); iy3 += 7;
                });
            } else {
                pdf.setFontSize(5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(148, 163, 184);
                pdf.text('No distributions', x3, y + iy3); iy3 += 7;
            }
            pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(225, 29, 72);
            pdf.text(`REM: ${e.remainingQuantity} KG`, x3, y + Math.min(iy3 + 2, rowH - 8));

            let x4 = ml + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
            const w4 = colWidths[4];
            const qrImg = qrCache[e.uuid];
            if (qrImg) {
                const qrS = Math.min(40, w4 - 16);
                try { pdf.addImage(qrImg, 'PNG', x4 + (w4 - qrS) / 2, y + 8, qrS, qrS); } catch {}
                pdf.setFontSize(4.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'bold');
                pdf.text('SCAN FOR RECORD', x4 + w4 / 2, y + qrS + 14, { align: 'center' });
            }

            let x5 = ml + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 6;
            const w5 = colWidths[5] - 12;
            if (e.isVerified) {
                pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(5, 150, 105);
                pdf.text('QA AUTHORIZED', x5, y + 10);
                pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42);
                pdf.text(truncText(e.verifierName || 'N/A', w5, 6.5), x5, y + 19);
                if (e.verifierSignature && e.verifierSignature.startsWith('data:')) {
                    try { pdf.addImage(e.verifierSignature, 'PNG', x5, y + 22, 45, 18); } catch {}
                }
                if (e.verificationComments) {
                    pdf.setFontSize(5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(100, 116, 139);
                    const cmtLines = pdf.splitTextToSize(`"${e.verificationComments}"`, w5);
                    pdf.text(cmtLines.slice(0, 3), x5, y + 48);
                }
                if (e.verificationDate) {
                    pdf.setFontSize(5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
                    pdf.text(`Date: ${e.verificationDate.split('T')[0]}`, x5, y + rowH - 8);
                }
            } else {
                pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(245, 158, 11);
                pdf.text('AWAITING AUTH', x5, y + rowH / 2 + 3);
            }

            y += rowH;
        }

        y += 15;
        if (y + 55 > ph - mb) { pdf.addPage(); y = mt; drawWatermark(); }
        pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
        const sigW = (cw - 20) / 2;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml, y, sigW, 40, 'FD');
        pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text('REGISTRY PROCESS SIGNATURE', ml + 8, y + 12);
        pdf.setDrawColor(203, 213, 225); pdf.line(ml + 8, y + 32, ml + sigW - 8, y + 32);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml + sigW + 20, y, sigW, 40, 'FD');
        pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        pdf.text('VERIFICATION NODE AUTH', ml + sigW + 28, y + 12);
        pdf.setDrawColor(203, 213, 225); pdf.line(ml + sigW + 28, y + 32, ml + sigW + 20 + sigW - 8, y + 32);

        const totalPages = pdf.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            pdf.setPage(p);
            pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(148, 163, 184);
            pdf.text(`System Timestamp: ${nowTimestamp}`, ml, ph - 15);
            pdf.text(`Hash: ${securityId}`, pw / 2, ph - 15, { align: 'center' });
            pdf.text(`Page ${p} of ${totalPages}`, pw - mr, ph - 15, { align: 'right' });
        }

        savePdfForPWA(pdf, `Thawing_Audit_Registry_Bulk_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        console.error("Registry Export failed", err);
    } finally {
        setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
       {/* Dashboard Section */}
       <div className="flex flex-col lg:flex-row gap-4 mb-6">
         <div className="flex-1 w-full overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
             <div className="flex gap-4 min-w-max lg:min-w-0 lg:w-full">
                <div className="w-[85vw] md:w-[45vw] lg:w-auto lg:flex-1 bg-white px-6 py-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Activity size={20} className="text-indigo-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Process Lifecycle</h3>
                    </div>
                    <div className="flex justify-between items-end">
                        {[
                            { label: 'Pending', value: stats.pending, color: 'bg-slate-800', id: 'PENDING' },
                            { label: 'In Flow', value: stats.inFlow, color: 'bg-indigo-500', id: 'IN_PROGRESS' },
                            { label: 'Due Auth', value: stats.dueAuth, color: 'bg-amber-500', id: 'DUE_AUTH' },
                            { label: 'Verified', value: stats.verified, color: 'bg-emerald-500', id: 'VERIFIED' }
                        ].map((stat, i) => (
                            <div 
                                key={i} 
                                onClick={() => handleFilterClick(stat.id)}
                                className={`flex flex-col items-center cursor-pointer transition-all hover:scale-105 active:scale-95 px-3 py-1.5 rounded-lg ${statusFilter === stat.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}
                            >
                                <span className={`text-[9px] font-semibold uppercase tracking-wider mb-1 ${statusFilter === stat.id ? 'text-indigo-600' : 'text-slate-400'}`}>{stat.label}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xl font-extrabold text-slate-900">{stat.value}</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-[85vw] md:w-[45vw] lg:w-auto lg:flex-1 bg-white px-6 py-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <BarChart3 size={20} className="text-blue-600" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Registry Analytics</h3>
                    </div>
                    <div className="flex justify-between items-end">
                         {[
                            { label: 'Avg/Day', value: stats.avgDay, color: 'bg-blue-500' },
                            { label: 'Today', value: stats.todayCount, color: 'bg-purple-500' },
                            { label: 'Total', value: stats.total, color: 'bg-emerald-500' },
                            { label: 'Avg Lapse', value: stats.avgLapse, color: 'bg-slate-400' }
                        ].map((stat, i) => (
                            <div key={i} className="flex flex-col items-center px-3 py-1.5">
                                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xl font-extrabold text-slate-900">{stat.value}</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </div>

         <div className="flex flex-col gap-2.5 lg:w-auto w-full lg:items-end">
             <div className="flex items-center justify-end gap-2 w-full">
                 <button 
                    onClick={handleRefresh}
                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all active:scale-95"
                    title="Refresh"
                 >
                     <RefreshCw size={16} />
                 </button>
             </div>

             <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 w-full lg:w-auto justify-end">
                 <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
                 <input 
                     type="date" 
                     className="bg-transparent text-[10px] font-medium text-slate-600 outline-none w-[5.5rem] uppercase cursor-pointer"
                     placeholder="DD-MM-YYYY"
                     value={dateFrom}
                     onChange={(e) => setDateFrom(e.target.value)}
                 />
                 <span className="text-slate-300">-</span>
                 <input 
                     type="date" 
                     className="bg-transparent text-[10px] font-medium text-slate-600 outline-none w-[5.5rem] uppercase cursor-pointer"
                     placeholder="DD-MM-YYYY"
                     value={dateTo}
                     onChange={(e) => setDateTo(e.target.value)}
                 />
                 {(dateFrom || dateTo) && (
                     <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="ml-1 text-slate-400 hover:text-rose-500 transition-colors">
                         <XCircle size={14} />
                     </button>
                 )}
             </div>

             <div className="flex gap-2 w-full lg:w-auto items-center">
                 <div className="relative group flex-1 lg:w-56">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search products..." 
                      className="pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all placeholder:text-slate-300"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                 </div>

                 {selectedIds.size > 0 && (
                     <button 
                         onClick={handleBulkVerifyOpen}
                         className="px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider shadow-md shadow-emerald-200 active:scale-95 flex items-center justify-center gap-1.5 transition-all whitespace-nowrap animate-in zoom-in-95"
                     >
                         <ShieldCheck size={14} strokeWidth={3} /> Verify ({selectedIds.size})
                     </button>
                 )}

                 <button 
                    onClick={handleExportPDFBulk}
                    disabled={isGeneratingPDF}
                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all active:scale-95 shrink-0"
                 >
                     {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                 </button>
                 <button className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all active:scale-95 shrink-0">
                     <Calendar size={16} />
                 </button>
             </div>
         </div>
       </div>

       <div className="space-y-6">
          {paginatedEntries.map((row, idx) => (
             <ThawingCard 
                key={row.uuid}
                row={row}
                index={(currentPage - 1) * rowsPerPage + idx + 1}
                currentPage={currentPage}
                rowsPerPage={rowsPerPage}
                onStartStep1={handleOpenStep1}
                onCompleteThaw={handleOpenStep2}
                onVerify={handleOpenVerify}
                onIssue={handleOpenIssue}
                onDownload={() => handleExportSinglePDF(row)}
                isSelected={selectedIds.has(row.uuid)}
                onSelectToggle={() => {
                    const next = new Set(selectedIds);
                    if (next.has(row.uuid)) next.delete(row.uuid); else next.add(row.uuid);
                    setSelectedIds(next);
                }}
                isExpanded={expandedCardIds.has(row.uuid)}
                onToggleExpand={() => toggleCard(row.uuid)}
                now={now}
             />
          ))}
          {paginatedEntries.length === 0 && (
             <div className="p-12 text-center text-slate-400 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <p className="font-bold uppercase tracking-widest text-xs">No Active Thawing Records</p>
             </div>
          )}
       </div>

       <div className="bg-white border border-slate-200 rounded-[2rem] shadow-lg mt-6 mb-6 overflow-hidden">
           <UnifiedPagination
               currentPage={currentPage}
               totalPages={totalPages}
               totalItems={filteredEntries.length}
               rowsPerPage={rowsPerPage}
               onPageChange={setCurrentPage}
               onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
           />
       </div>

       {/* --- MODALS --- */}

       {/* Step 1 Modal */}
       {activeModal === 'STEP1' && selectedEntry && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Initiate Thawing</h3>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="space-y-4">
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</p>
                      <p className="text-sm font-bold text-slate-800">{selectedEntry.productName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{selectedEntry.batchNumber}</p>
                   </div>
                   
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Method</label>
                      <select 
                         className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold outline-none"
                         value={formData.thawMethod}
                         onChange={e => setFormData({...formData, thawMethod: e.target.value})}
                      >
                         <option value="Refrigerator">Refrigerator</option>
                         <option value="Chilled water">Chilled Water</option>
                         <option value="Microwave">Microwave</option>
                      </select>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Core Temp (°C) <span className="text-blue-400 font-bold normal-case">Standard: ≤ -18.0°C</span></label>
                         <div className="flex gap-2">
                            <input 
                               type="number" step="0.1"
                               className={`w-full p-3 bg-white border-2 rounded-xl text-xs font-bold outline-none transition-all ${formData.initialTemp && parseFloat(formData.initialTemp) > -18 ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}
                               placeholder="-18.0"
                               value={formData.initialTemp}
                               onChange={e => { setFormData({...formData, initialTemp: e.target.value}); setTempWarning(null); }}
                            />
                            <button className="p-3 bg-slate-100 rounded-xl text-slate-400 hover:text-blue-500" onClick={() => document.getElementById('step1-cam')?.click()}><Camera size={18}/></button>
                            <input type="file" id="step1-cam" hidden accept="image/*" capture="environment" onChange={e => handleCameraCapture(e, 'initialTempImg')} />
                         </div>
                         {formData.initialTemp && parseFloat(formData.initialTemp) > -18 && (
                             <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> Above standard (-18.0°C). Remarks required.</p>
                         )}
                         {formData.initialTempImg && (
                             <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border border-slate-200">
                                 <img src={formData.initialTempImg} className="w-full h-full object-cover" />
                             </div>
                         )}
                      </div>
                      
                      {formData.thawMethod === 'Chilled water' && (
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Water Temp (°C)</label>
                             <div className="flex gap-2">
                                <input 
                                   type="number" step="0.1"
                                   className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold outline-none"
                                   placeholder="0.0"
                                   value={formData.waterTemp}
                                   onChange={e => setFormData({...formData, waterTemp: e.target.value})}
                                />
                                <button className="p-3 bg-slate-100 rounded-xl text-slate-400 hover:text-blue-500" onClick={() => document.getElementById('step1-water-cam')?.click()}><Camera size={18}/></button>
                                <input type="file" id="step1-water-cam" hidden accept="image/*" capture="environment" onChange={e => handleCameraCapture(e, 'waterTempImg')} />
                             </div>
                             {formData.waterTempImg && (
                                <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border border-slate-200">
                                    <img src={formData.waterTempImg} className="w-full h-full object-cover" />
                                </div>
                             )}
                          </div>
                      )}
                   </div>

                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                           Remarks
                           {formData.initialTemp && parseFloat(formData.initialTemp) > -18 && (
                               <span className="text-rose-500 ml-1">* Required</span>
                           )}
                       </label>
                       <textarea
                           className={`w-full p-3 bg-white border-2 rounded-xl text-xs font-bold outline-none resize-none h-20 transition-all ${formData.initialTemp && parseFloat(formData.initialTemp) > -18 && !formData.initiationComments?.trim() ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}
                           placeholder={formData.initialTemp && parseFloat(formData.initialTemp) > -18 ? "Mandatory: Explain why starting temp is above -18.0°C..." : "Any remarks..."}
                           value={formData.initiationComments}
                           onChange={e => { setFormData({...formData, initiationComments: e.target.value}); setTempWarning(null); }}
                       />
                   </div>

                   <SignaturePad onSave={(s) => setFormData({...formData, signature: s})} label="Operator Signature" />
                </div>

                {tempWarning && (
                    <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-200">
                        <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black text-rose-700 uppercase tracking-tight">Validation Error</p>
                            <p className="text-[11px] font-bold text-rose-600 mt-1">{tempWarning}</p>
                        </div>
                        <button onClick={() => setTempWarning(null)} className="ml-auto shrink-0 text-rose-300 hover:text-rose-500"><X size={16} /></button>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                   <button onClick={() => { setActiveModal(null); setTempWarning(null); }} className="px-6 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleSubmitStep1} className="px-8 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-blue-700 transition-all">Start Thawing</button>
                </div>
             </div>
          </div>
       )}

       {/* Step 2 Modal */}
       {activeModal === 'STEP2' && selectedEntry && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Complete Process</h3>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="space-y-6">
                   <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                      <Clock size={24} className="text-emerald-500" />
                      <div>
                         <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Elapsed Time</p>
                         <p className="text-xl font-black text-emerald-900">
                             {(() => {
                                 const startTime = new Date(selectedEntry.thawStartTime!).getTime();
                                 const endTime = now;
                                 const diff = Math.max(0, endTime - startTime);
                                 const hours = Math.floor(diff / 3600000);
                                 const mins = Math.floor((diff % 3600000) / 60000);
                                 const secs = Math.floor((diff % 60000) / 1000);
                                 return `${hours}h ${mins}m ${secs}s`;
                             })()}
                         </p>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Final Core Temp (°C) <span className="text-blue-400 font-bold normal-case">Standard: &lt; 5.0°C</span></label>
                      <div className="flex gap-2">
                         <input 
                            type="number" step="0.1"
                            className={`w-full p-4 bg-white border-2 rounded-xl text-lg font-black outline-none transition-all ${formData.finalTemp && parseFloat(formData.finalTemp) > 5 ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}
                            placeholder="4.0"
                            value={formData.finalTemp}
                            onChange={e => { setFormData({...formData, finalTemp: e.target.value}); setStep2Warning(null); }}
                         />
                         <button className={`p-4 rounded-xl transition-all ${formData.finalTempImg ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-400 border-2 border-dashed border-rose-200 hover:border-rose-400'}`} onClick={() => document.getElementById('step2-cam')?.click()}><Camera size={24}/></button>
                         <input type="file" id="step2-cam" hidden accept="image/*" capture="environment" onChange={e => handleCameraCapture(e, 'finalTempImg')} />
                      </div>
                      {!formData.finalTempImg && (
                          <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> Photo evidence is mandatory.</p>
                      )}
                      {formData.finalTemp && parseFloat(formData.finalTemp) > 5 && (
                          <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> Above standard (5.0°C). Remarks required.</p>
                      )}
                      {formData.finalTempImg && <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border-2 border-emerald-200"><img src={formData.finalTempImg} className="w-full h-full object-cover" /></div>}
                   </div>
                   
                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                           Remarks
                           {formData.finalTemp && parseFloat(formData.finalTemp) > 5 && (
                               <span className="text-rose-500 ml-1">* Required</span>
                           )}
                       </label>
                       <textarea
                           className={`w-full p-3 bg-white border-2 rounded-xl text-xs font-bold outline-none resize-none h-20 transition-all ${formData.finalTemp && parseFloat(formData.finalTemp) > 5 && !formData.completionComments?.trim() ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}
                           placeholder={formData.finalTemp && parseFloat(formData.finalTemp) > 5 ? "Mandatory: Explain why final temp exceeds 5.0°C..." : "Any remarks..."}
                           value={formData.completionComments}
                           onChange={e => { setFormData({...formData, completionComments: e.target.value}); setStep2Warning(null); }}
                       />
                   </div>

                   <SignaturePad onSave={(s) => setFormData({...formData, signature: s})} label="Operator Signature" />
                </div>

                {step2Warning && (
                    <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-200">
                        <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black text-rose-700 uppercase tracking-tight">Validation Error</p>
                            <p className="text-[11px] font-bold text-rose-600 mt-1">{step2Warning}</p>
                        </div>
                        <button onClick={() => setStep2Warning(null)} className="ml-auto shrink-0 text-rose-300 hover:text-rose-500"><X size={16} /></button>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                   <button onClick={() => { setActiveModal(null); setStep2Warning(null); }} className="px-6 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleSubmitStep2} className="px-8 py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-emerald-700 transition-all">Complete</button>
                </div>
             </div>
          </div>
       )}

       {/* Verify Modal */}
       {activeModal === 'VERIFY' && selectedEntry && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">QA Verification</h3>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Comments</label>
                      <textarea 
                         className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none h-24 resize-none"
                         placeholder="Verification notes..."
                         value={formData.verificationComments}
                         onChange={e => setFormData({...formData, verificationComments: e.target.value})}
                      />
                   </div>
                   <SignaturePad onSave={(s) => setFormData({...formData, signature: s})} label="Verifier Signature" />
                </div>
                <div className="mt-8 flex justify-end gap-3">
                   <button onClick={() => setActiveModal(null)} className="px-6 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleSubmitVerify} className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Verify Record</button>
                </div>
             </div>
          </div>
       )}

       {/* Bulk Verify Modal */}
       {activeModal === 'BULK_VERIFY' && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                   <div className="flex items-center gap-3">
                       <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg"><ShieldCheck size={24} className="text-white"/></div>
                       <div>
                           <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Bulk Verification</h3>
                           <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Batch Authorizing {selectedIds.size} Records</p>
                       </div>
                   </div>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Verifier Name</label>
                      <input 
                         className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none"
                         value={formData.verifierName}
                         onChange={e => setFormData({...formData, verifierName: e.target.value})}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Comments</label>
                      <textarea 
                         className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none h-24 resize-none"
                         placeholder="Batch verification notes..."
                         value={formData.verificationComments}
                         onChange={e => setFormData({...formData, verificationComments: e.target.value})}
                      />
                   </div>
                   <SignaturePad onSave={(s) => setFormData({...formData, signature: s})} label="Verifier Signature" />
                </div>
                <div className="mt-8 flex justify-end gap-3">
                   <button onClick={() => setActiveModal(null)} className="px-6 py-3 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleSubmitBulkVerify} className="px-8 py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-emerald-700 transition-all">Verify All</button>
                </div>
             </div>
          </div>
       )}

       {/* Issue Modal */}
       {activeModal === 'ISSUE' && selectedEntry && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-200 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Issue / Split</h3>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1">
                   <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-black text-slate-500 uppercase">Available Registry</span>
                      <div className="text-right">
                          {(() => {
                              const totalIssuing = formData.splits?.reduce((acc: number, curr: any) => acc + (parseFloat(curr.quantity) || 0), 0) || 0;
                              const remaining = selectedEntry.remainingQuantity - totalIssuing;
                              const isOver = remaining < 0;
                              return (
                                <div className="flex flex-col">
                                    <span className={`text-lg font-black ${isOver ? 'text-rose-600' : 'text-indigo-600'}`}>{Math.max(0, remaining).toFixed(2)} KG</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Bgn: {selectedEntry.remainingQuantity} KG</span>
                                    {isOver && <span className="text-[8px] font-bold text-rose-500 mt-0.5">Exceeds available by {Math.abs(remaining).toFixed(2)} KG</span>}
                                </div>
                              );
                          })()}
                      </div>
                   </div>

                   <div className="space-y-4">
                       {formData.splits?.map((split: any, idx: number) => (
                           <div key={split.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2 relative group animate-in slide-in-from-left-2">
                               <div className="flex justify-between items-center mb-1">
                                   <span className="text-[10px] font-black text-slate-400 uppercase">Split #{idx + 1}</span>
                                   {formData.splits.length > 1 && (
                                       <button 
                                           onClick={() => removeSplitRow(split.id)}
                                           className="text-slate-300 hover:text-red-500 transition-colors"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   )}
                               </div>
                               <SearchableDropdown
                                   placeholder="Select Location..."
                                   options={locationOptionsForDept}
                                   value={split.location}
                                   onChange={(val) => updateSplitRow(split.id, 'location', val)}
                               />
                               <div className="relative">
                                   {(() => {
                                       const otherSplitsTotal = formData.splits?.filter((s: any) => s.id !== split.id).reduce((acc: number, s: any) => acc + (parseFloat(s.quantity) || 0), 0) || 0;
                                       const maxForThis = Math.max(0, selectedEntry.remainingQuantity - otherSplitsTotal);
                                       const currentVal = parseFloat(split.quantity) || 0;
                                       const isOver = currentVal > maxForThis;
                                       return (
                                           <>
                                               <input 
                                                 type="number" step="0.1" min="0" max={maxForThis}
                                                 className={`w-full p-3 bg-white border-2 rounded-xl text-sm font-bold outline-none transition-all ${isOver ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-slate-100'}`}
                                                 placeholder="Quantity"
                                                 value={split.quantity}
                                                 onChange={e => {
                                                     const val = parseFloat(e.target.value);
                                                     if (!isNaN(val) && val > maxForThis) {
                                                         updateSplitRow(split.id, 'quantity', maxForThis.toString());
                                                     } else {
                                                         updateSplitRow(split.id, 'quantity', e.target.value);
                                                     }
                                                 }}
                                               />
                                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">KG</span>
                                               {isOver && <p className="text-[8px] font-bold text-rose-500 mt-1">Exceeds available ({maxForThis.toFixed(1)} KG max)</p>}
                                           </>
                                       );
                                   })()}
                               </div>
                           </div>
                       ))}
                       <button 
                           onClick={addSplitRow}
                           className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest"
                       >
                           <PlusCircle size={16} /> Add Another Split
                       </button>
                   </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 shrink-0 pt-4 border-t border-slate-100">
                   <button onClick={() => setActiveModal(null)} className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleSubmitIssue} className="px-8 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-black transition-all">Confirm Split</button>
                </div>
             </div>
          </div>
       )}

       {activeModal === 'MANUAL_ADD' && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
             <div className="bg-white w-full sm:max-w-lg sm:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-slate-100 shrink-0">
                   <div className="flex items-center gap-3">
                       <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Package size={22} className="text-white"/></div>
                       <div>
                           <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">Add Product</h3>
                           <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Manual Thawing Entry</p>
                       </div>
                   </div>
                   <button onClick={() => setActiveModal(null)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 space-y-4 custom-scrollbar">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Product Name *</label>
                      <input className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-slate-300" placeholder="e.g. Chicken Breast, Lamb Leg, Fish Fillet..." value={manualForm.productName} onChange={e => setManualForm(p => ({ ...p, productName: e.target.value }))} />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Batch Number</label>
                         <input className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300" placeholder="Auto-generated if empty" value={manualForm.batchNumber} onChange={e => setManualForm(p => ({ ...p, batchNumber: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Quantity (KG)</label>
                         <input type="number" step="0.01" min="0" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300" placeholder="e.g. 5.0" value={manualForm.totalQuantity} onChange={e => setManualForm(p => ({ ...p, totalQuantity: e.target.value }))} />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Supplier Name</label>
                      <input className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300" placeholder="Supplier name (optional)" value={manualForm.supplierName} onChange={e => setManualForm(p => ({ ...p, supplierName: e.target.value }))} />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mfg Date</label>
                         <input type="date" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all text-slate-600" value={manualForm.mfgDate} onChange={e => setManualForm(p => ({ ...p, mfgDate: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Exp Date</label>
                         <input type="date" className="w-full p-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all text-slate-600" value={manualForm.expDate} onChange={e => setManualForm(p => ({ ...p, expDate: e.target.value }))} />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Department</label>
                      <SearchableDropdown options={dynamicDepts} value={manualForm.departmentName} onChange={val => setManualForm(p => ({ ...p, departmentName: val, locationName: '' }))} placeholder="Select department..." />
                   </div>
                   {locationsForSelectedDept.length > 0 && (
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Location</label>
                        <SearchableDropdown options={locationsForSelectedDept} value={manualForm.locationName} onChange={val => setManualForm(p => ({ ...p, locationName: val }))} placeholder="Select location..." />
                     </div>
                   )}
                </div>
                <div className="px-6 sm:px-8 py-5 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                   <button onClick={() => setActiveModal(null)} className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                   <button onClick={handleManualAdd} disabled={!manualForm.productName.trim()} className="px-8 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                      <Plus size={14} /> Add to Registry
                   </button>
                </div>
             </div>
          </div>
       )}

       <button
         onClick={() => setActiveModal('MANUAL_ADD')}
         className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100] w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-full shadow-2xl shadow-indigo-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
         title="Add Product Manually"
       >
         <Plus size={24} strokeWidth={3} />
       </button>
    </div>
  );
}

interface ThawingCardProps {
    row: ThawingRecordEntry;
    index: number;
    currentPage: number;
    rowsPerPage: number;
    onStartStep1: (entry: ThawingRecordEntry) => void;
    onCompleteThaw: (entry: ThawingRecordEntry) => void;
    onVerify: (entry: ThawingRecordEntry) => void;
    onIssue: (entry: ThawingRecordEntry) => void;
    onDownload: () => void;
    isSelected: boolean;
    onSelectToggle: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    now: number;
}

// --- ThawingCard Component ---
const ThawingCard: React.FC<ThawingCardProps> = ({ 
    row, index, currentPage, rowsPerPage,
    onStartStep1, onCompleteThaw, onVerify, onIssue, onDownload, isSelected, onSelectToggle, isExpanded, onToggleExpand, now
}) => {
    const isPending = row.status === 'PENDING';
    const isInProgress = row.status === 'IN_PROGRESS';
    const isCompleted = row.status === 'COMPLETED';
    const isVerified = row.isVerified;

    const formatTimeLapseInternal = (start?: string, end?: string) => {
        if (!start) return '--:--';
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : now;
        const diff = Math.max(0, endTime - startTime);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${hours}h ${mins}m ${secs}s`;
    };

    const getSLADuration = (method?: ThawMethod) => {
        if (method === 'Refrigerator') return 24 * 3600000;
        if (method === 'Chilled water') return 90 * 60000;
        if (method === 'Microwave') return 30 * 60000;
        return 0;
    };

    const slaDuration = getSLADuration(row.thawMethod);
    const elapsed = row.thawStartTime ? now - new Date(row.thawStartTime).getTime() : 0;
    const isSlaViolated = isInProgress && slaDuration > 0 && elapsed > slaDuration;

    // Simulated Production URL for the QR code
    const qrPayload = `https://haccppro.com/registry/thaw/${row.uuid}`;

    return (
        <>
            {/* DESKTOP VIEW */}
            <div className={`hidden lg:flex bg-white rounded-2xl border transition-all duration-300 flex-col lg:flex-row group overflow-hidden ${isInProgress ? 'border-blue-200 shadow-md ring-1 ring-blue-100' : isSelected ? 'border-indigo-400 shadow-md ring-1 ring-indigo-100' : 'border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'}`}>
                
                {/* Column 1: Identity */}
                <div className="p-5 lg:w-[20%] border-b lg:border-b-0 lg:border-r border-slate-100/80 flex flex-col bg-white shrink-0">
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold ${isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                {((currentPage - 1) * rowsPerPage + index).toString().padStart(2, '0')}
                            </div>
                            {!isVerified && isCompleted && row.remainingQuantity === 0 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'}`}
                                >
                                    {isSelected && <Check size={12} strokeWidth={4} />}
                                </button>
                            )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isInProgress ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            {row.status}
                        </span>
                    </div>
                    
                    <h4 className="text-sm font-semibold text-slate-800 leading-snug mb-1 group-hover:text-indigo-600 transition-colors truncate">{row.productName}</h4>
                    <p className="text-[10px] text-slate-400 mb-4 truncate">{row.unitName} · {row.locationName}</p>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-slate-50 p-2 rounded-lg">
                            <span className="text-[8px] font-medium text-slate-400 uppercase block">Registry ID</span>
                            <span className="text-[10px] font-semibold text-slate-700 font-mono truncate block">{row.batchNumber}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg text-right">
                            <span className="text-[8px] font-medium text-slate-400 uppercase block">Quantity</span>
                            <span className="text-[10px] font-semibold text-indigo-600 block">{row.totalQuantity} KG</span>
                        </div>
                    </div>

                    <div className="space-y-1 pt-3 border-t border-slate-100/80 mt-auto">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Calendar size={10} className="text-slate-300"/> MFG: <span className="text-slate-600">{row.mfgDate}</span></div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Clock size={10} className="text-slate-300"/> EXP: <span className="text-rose-500">{row.expDate}</span></div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Warehouse size={10} className="text-slate-300"/> <span className="text-slate-600 truncate">{row.supplierName}</span></div>
                    </div>
                </div>

                {/* Column 2: Step 1 - Initiation */}
                <div className={`p-5 lg:w-[22%] border-b lg:border-b-0 lg:border-r border-slate-100/80 flex flex-col shrink-0 ${isPending ? 'justify-center bg-slate-50/50' : 'bg-white'}`}>
                    {isPending ? (
                        <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center"><Play size={18} fill="currentColor" /></div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Initiation</p>
                                <p className="text-[9px] text-slate-400">Awaiting activation</p>
                            </div>
                            <button onClick={() => onStartStep1(row)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <Play size={12} fill="currentColor" /> Start Thawing
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 h-full flex flex-col">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100/80">
                                <div className="flex items-center gap-1.5">
                                    {row.thawMethod === 'Refrigerator' ? <Snowflake size={12} className="text-blue-400" /> : 
                                    row.thawMethod === 'Chilled water' ? <Droplets size={12} className="text-cyan-400" /> :
                                    <Microwave size={12} className="text-orange-400" />}
                                    <span className="text-[10px] font-medium text-slate-500">{row.thawMethod}</span>
                                </div>
                                {isSlaViolated && <span className="text-[8px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md animate-pulse">SLA Breach</span>}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2.5 rounded-lg">
                                    <span className="text-[8px] font-medium text-slate-400 uppercase block">Start</span>
                                    <span className="text-xs font-semibold text-slate-700 mt-0.5 block">{new Date(row.thawStartTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between">
                                    <div>
                                        <span className="text-[8px] font-medium text-slate-400 uppercase block">Core Temp</span>
                                        <span className="text-xs font-semibold text-rose-500 mt-0.5 block">{row.initialTemp}°C</span>
                                    </div>
                                    {row.initialTempImg && (
                                        <div onClick={() => window.open(row.initialTempImg)} className="w-8 h-8 rounded-md border border-slate-200 overflow-hidden cursor-pointer hover:border-indigo-400 transition-all shrink-0">
                                            <img src={row.initialTempImg} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>

                                {row.thawMethod === 'Chilled water' && (
                                    <div className="col-span-2 bg-cyan-50/60 p-2.5 rounded-lg border border-cyan-100/60 flex items-center justify-between">
                                        <div>
                                            <span className="text-[8px] font-medium text-cyan-500 uppercase block">Water Temp</span>
                                            <span className="text-xs font-semibold text-cyan-700">{row.waterTemp}°C</span>
                                        </div>
                                        {row.waterTempImg && (
                                            <div onClick={() => window.open(row.waterTempImg)} className="w-8 h-8 rounded-md border border-white overflow-hidden cursor-pointer hover:scale-105 transition-all shrink-0">
                                                <img src={row.waterTempImg} className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg p-2.5 mt-auto">
                                <div className="w-10 h-6 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                    {row.initiatedBySign ? <img src={row.initiatedBySign} className="max-h-full max-w-full object-contain" /> : <PenTool size={12} className="text-slate-300"/>}
                                </div>
                                <p className="text-[9px] font-medium text-slate-500 truncate">By: {row.initiatedBy}</p>
                            </div>

                            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-white transition-colors ${isSlaViolated ? 'bg-rose-500' : 'bg-slate-800'}`}>
                                <div className="flex items-center gap-1.5"><Clock size={12} className={isSlaViolated ? 'text-white' : 'text-slate-400'}/><span className="text-[9px] font-medium uppercase tracking-wider">Lapse</span></div>
                                <span className="text-sm font-bold font-mono">{formatTimeLapseInternal(row.thawStartTime, row.thawEndTime)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Column 3: Step 2 - Termination */}
                <div className={`p-5 lg:w-[20%] border-b lg:border-b-0 lg:border-r border-slate-100/80 flex flex-col justify-center shrink-0 ${!isCompleted ? 'bg-slate-50/30' : 'bg-white'}`}>
                    {isCompleted ? (
                        <div className="space-y-3 flex-1">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100/80">
                                <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500"/><span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Termination</span></div>
                                <span className="text-[10px] text-slate-500">{row.thawEndDate}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-2.5 rounded-lg">
                                    <span className="text-[8px] font-medium text-slate-400 uppercase block">End Time</span>
                                    <span className="text-xs font-semibold text-slate-700 mt-0.5 block">{new Date(row.thawEndTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="bg-emerald-50/60 p-2.5 rounded-lg flex items-center justify-between">
                                    <div>
                                        <span className="text-[8px] font-medium text-emerald-500 uppercase block">Final Temp</span>
                                        <span className="text-xs font-semibold text-emerald-700">{row.finalTemp}°C</span>
                                    </div>
                                    {row.finalTempImg && (
                                        <div onClick={() => window.open(row.finalTempImg)} className="w-8 h-8 rounded-md border border-white overflow-hidden cursor-pointer hover:border-emerald-400 transition-all shrink-0">
                                            <img src={row.finalTempImg} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-indigo-50/60 border border-indigo-100/60 p-3 rounded-lg">
                                <span className="text-[8px] font-medium text-indigo-400 uppercase block">Shelf Life</span>
                                <p className="text-sm font-semibold text-indigo-700 mt-0.5">{row.secondaryShelfLife}</p>
                                <p className="text-[8px] text-slate-400 mt-0.5 truncate">Exp: {row.secondaryExpiry?.split('T')[0]}</p>
                            </div>

                            <div className="flex items-center gap-2.5 bg-slate-50 rounded-lg p-2.5">
                                <div className="w-10 h-6 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                    {row.completedBySign ? <img src={row.completedBySign} className="max-h-full max-w-full object-contain" /> : <User size={12} className="text-slate-300"/>}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[8px] font-medium text-slate-400 uppercase">Finalized By</p>
                                    <p className="text-[10px] font-semibold text-slate-700 truncate">{row.completedBy}</p>
                                </div>
                            </div>
                        </div>
                    ) : isInProgress ? (
                        <div className="flex flex-col items-center justify-center text-center space-y-3 py-4">
                            <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                                <Hourglass size={18} />
                            </div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Step 1 Active</p>
                            <button onClick={() => onCompleteThaw(row)} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 size={12} /> Complete Thawing
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center opacity-20 py-8">
                            <Lock size={28}/>
                            <p className="text-[9px] font-medium uppercase mt-2 tracking-wider text-slate-400">Locked</p>
                        </div>
                    )}
                </div>

                {/* Column 4: Identity Passport (QR) */}
                <div className="p-5 lg:w-[13%] border-b lg:border-b-0 lg:border-r border-slate-100/80 flex flex-col justify-center items-center bg-white shrink-0">
                    <div className="flex flex-col items-center gap-2 group/qr">
                        <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                            <QRCodeSVG value={qrPayload} size={72} level="H" includeMargin={false} />
                        </div>
                        <div className="text-center">
                            <p className="text-[8px] font-medium text-slate-400 uppercase tracking-wider group-hover/qr:text-indigo-500 transition-colors">Digital ID</p>
                            <p className="text-[7px] text-slate-300 mt-0.5">Scan to Verify</p>
                        </div>
                    </div>
                </div>

                {/* Column 5: Verification & Actions */}
                <div className="p-5 flex flex-col justify-center bg-white lg:flex-1 gap-3">
                    <button 
                        onClick={onDownload} 
                        disabled={isPending}
                        className={`w-full py-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isPending ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100' : 'bg-slate-800 hover:bg-slate-900 text-white active:scale-[0.98]'}`}
                    >
                        <Download size={12} /> Download PDF
                    </button>

                    {row.issued.length > 0 && (
                        <div className="space-y-2">
                             <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                                <Split size={12} className="text-indigo-400" />
                                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Distribution</span>
                             </div>
                             <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                                {row.issued.map((item) => (
                                    <div key={item.id} className="bg-slate-50 px-2.5 py-1.5 rounded-lg flex justify-between items-center text-[10px]">
                                        <span className="font-medium text-slate-600 truncate">{item.location}</span>
                                        <span className="font-semibold text-indigo-600 shrink-0 ml-2">{item.quantity.toFixed(1)} KG</span>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {isVerified ? (
                        <div className="space-y-3">
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 w-full">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">{row.verifierName}</p>
                                        <p className="text-[8px] text-emerald-600 uppercase font-medium">Verified</p>
                                    </div>
                                </div>
                                <div className="h-12 w-full bg-white rounded-lg border border-emerald-100 p-1.5 mb-2.5 flex items-center justify-center overflow-hidden">
                                    {row.verifierSignature ? <img src={row.verifierSignature} className="max-h-full max-w-full object-contain" alt="verifier-sign" /> : <PenTool size={14} className="text-emerald-200" />}
                                </div>
                                <p className="text-[9px] text-slate-500 italic bg-white/60 p-2 rounded-lg">"{row.verificationComments || 'Record reviewed and synchronized.'}"</p>
                                <div className="mt-2 flex justify-between text-[8px] text-emerald-700 uppercase opacity-70"><span>Cert.</span><span>{row.verificationDate?.split('T')[0]}</span></div>
                            </div>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-medium text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95"><History size={12}/> History</button>
                        </div>
                    ) : isCompleted ? (
                        <div className="flex flex-col gap-3 justify-center">
                            {row.remainingQuantity > 0 ? (
                                <div className="p-4 text-center space-y-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto"><Split size={18} /></div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-blue-700 uppercase">Issue Required</p>
                                        <p className="text-[9px] text-blue-500 mt-0.5">{row.remainingQuantity.toFixed(1)} / {row.totalQuantity.toFixed(1)} KG</p>
                                    </div>
                                    <button onClick={() => onIssue(row)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        <Split size={12} /> Issue Portions
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 text-center space-y-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                                    <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mx-auto"><ShieldCheck size={18} /></div>
                                    <p className="text-[10px] font-semibold text-amber-700 uppercase">Ready for Authorization</p>
                                    <button onClick={() => onVerify(row)} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        <Zap size={12} className="fill-current" /> Authorize Log
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center py-8 opacity-15">
                            <ShieldAlert size={28} />
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE VIEW */}
            <div className="lg:hidden">
                <div className={`bg-white rounded-2xl border overflow-hidden mb-3 ${isInProgress ? 'border-blue-200 shadow-md' : isSelected ? 'border-indigo-400 shadow-md' : 'border-slate-200/80 shadow-sm'}`}>
                    {/* Card Header */}
                    <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                        {((currentPage - 1) * rowsPerPage + index).toString().padStart(2, '0')}
                                    </div>
                                    <h3 className="text-[14px] font-semibold text-slate-800 truncate leading-tight">{row.productName}</h3>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase shrink-0 ${isCompleted && isVerified ? 'bg-emerald-50 text-emerald-600' : isCompleted ? 'bg-emerald-50 text-emerald-600' : isInProgress ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {isVerified ? 'Verified' : row.status}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{row.batchNumber}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 truncate">{row.unitName} · {row.locationName} · {row.supplierName}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isCompleted && row.remainingQuantity === 0 && !isVerified && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSelectToggle(); }}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}
                                    >
                                        {isSelected && <Check size={10} strokeWidth={4} />}
                                    </button>
                                )}
                                <button onClick={onToggleExpand} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="px-4 pb-3 grid grid-cols-4 gap-1.5">
                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                            <Package size={11} className="text-slate-400 mb-0.5" />
                            <span className="text-[10px] font-semibold text-slate-700">{row.totalQuantity}</span>
                            <span className="text-[7px] font-medium text-slate-400 uppercase">KG</span>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                            <Thermometer size={11} className={`mb-0.5 ${row.thawStartTime && row.initialTemp != null ? 'text-rose-400' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-semibold text-slate-700">{row.thawStartTime && row.initialTemp != null ? `${row.initialTemp}°C` : '---'}</span>
                            <span className="text-[7px] font-medium text-slate-400 uppercase">Initial</span>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                            <Thermometer size={11} className={`mb-0.5 ${isCompleted && row.finalTemp != null ? 'text-emerald-400' : 'text-slate-300'}`} />
                            <span className="text-[10px] font-semibold text-slate-700">{isCompleted && row.finalTemp != null ? `${row.finalTemp}°C` : '---'}</span>
                            <span className="text-[7px] font-medium text-slate-400 uppercase">Final</span>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                            <Clock size={11} className="text-slate-300 mb-0.5" />
                            <span className="text-[10px] font-semibold text-slate-700 font-mono">{row.thawStartTime ? formatTimeLapseInternal(row.thawStartTime, row.thawEndTime) : '---'}</span>
                            <span className="text-[7px] font-medium text-slate-400 uppercase">Lapse</span>
                        </div>
                    </div>

                    {/* Live Timer */}
                    {isInProgress && (
                        <div className="mx-4 mb-2">
                            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-white ${isSlaViolated ? 'bg-rose-500 animate-pulse' : 'bg-slate-800'}`}>
                                <div className="flex items-center gap-1.5">
                                    <Clock size={12} className={isSlaViolated ? 'text-white' : 'text-slate-400'} />
                                    <span className="text-[9px] font-medium uppercase tracking-wider">Live</span>
                                </div>
                                <span className="text-sm font-bold font-mono">{formatTimeLapseInternal(row.thawStartTime, row.thawEndTime)}</span>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="px-4 pb-3 flex gap-2">
                        {isPending && (
                            <button onClick={() => onStartStep1(row)} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                                <Play size={11} fill="currentColor" /> Start Thawing
                            </button>
                        )}
                        {isInProgress && (
                            <button onClick={() => onCompleteThaw(row)} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                                <CheckCircle2 size={11} /> Complete
                            </button>
                        )}
                        {isCompleted && row.remainingQuantity > 0 && (
                            <button onClick={() => onIssue(row)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                                <Split size={11} /> Issue
                            </button>
                        )}
                        {isCompleted && row.remainingQuantity === 0 && !isVerified && (
                            <button onClick={() => onVerify(row)} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-[10px] font-semibold uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                                <ShieldCheck size={11} /> Authorize
                            </button>
                        )}
                        {!isPending && (
                            <button
                                onClick={onDownload}
                                className="py-2.5 px-3 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] bg-slate-50 border border-slate-200 text-slate-500"
                            >
                                <Download size={11} /> PDF
                            </button>
                        )}
                    </div>

                    {/* Expandable Details */}
                    <div className="border-t border-slate-100">
                        <button
                            onClick={onToggleExpand}
                            className="w-full flex items-center justify-center gap-1 py-2 text-[10px] font-medium text-slate-400 hover:text-indigo-500 transition-colors"
                        >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {isExpanded && (
                            <div className="px-4 pb-4 space-y-2.5 animate-in slide-in-from-top-2 duration-200">

                                {/* Product Details */}
                                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-1">Product Details</p>
                                    <div className="flex gap-4 text-[10px]">
                                        <span className="text-slate-400">Mfg: <span className="text-slate-600 font-medium">{row.mfgDate}</span></span>
                                        <span className="text-slate-400">Exp: <span className="text-rose-500 font-medium">{row.expDate}</span></span>
                                    </div>
                                </div>

                                {/* Initiation Section */}
                                {(isInProgress || isCompleted) && (
                                    <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Initiation</p>
                                            <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {row.thawMethod === 'Refrigerator' && <><Snowflake size={9} className="inline mr-0.5" />{row.thawMethod}</>}
                                                {row.thawMethod === 'Chilled water' && <><Droplets size={9} className="inline mr-0.5" />{row.thawMethod}</>}
                                                {row.thawMethod === 'Microwave' && <><Microwave size={9} className="inline mr-0.5" />{row.thawMethod}</>}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 rounded-md p-2">
                                                <span className="text-[8px] text-slate-400 uppercase block">Start</span>
                                                <span className="text-[10px] font-semibold text-slate-700 font-mono">{new Date(row.thawStartTime!).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="bg-slate-50 rounded-md p-2 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[8px] text-slate-400 uppercase block">Temp</span>
                                                    <span className="text-[10px] font-semibold text-rose-500">{row.initialTemp}°C</span>
                                                </div>
                                                {row.initialTempImg && (
                                                    <div onClick={() => window.open(row.initialTempImg)} className="w-7 h-7 rounded border border-slate-200 overflow-hidden cursor-pointer shrink-0">
                                                        <img src={row.initialTempImg} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {row.thawMethod === 'Chilled water' && row.waterTemp != null && (
                                            <div className="flex items-center justify-between bg-cyan-50/60 p-2 rounded-md border border-cyan-100/60">
                                                <div>
                                                    <span className="text-[8px] text-cyan-500 uppercase block">Water Temp</span>
                                                    <span className="text-[10px] font-semibold text-cyan-700">{row.waterTemp}°C</span>
                                                </div>
                                                {row.waterTempImg && (
                                                    <div onClick={() => window.open(row.waterTempImg)} className="w-7 h-7 rounded border border-white overflow-hidden cursor-pointer shrink-0">
                                                        <img src={row.waterTempImg} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                                            {row.initiatedBySign && (
                                                <div className="h-5 w-8 bg-slate-50 border border-slate-100 rounded p-0.5 shrink-0 overflow-hidden">
                                                    <img src={row.initiatedBySign} className="max-h-full max-w-full object-contain" />
                                                </div>
                                            )}
                                            <span className="text-[9px] text-slate-500 truncate">{row.initiatedBy}</span>
                                        </div>
                                        {row.initiationComments && (
                                            <p className="text-[9px] text-slate-400 italic">"{row.initiationComments}"</p>
                                        )}
                                    </div>
                                )}

                                {/* Termination Section */}
                                {isCompleted && (
                                    <div className="bg-white border border-slate-100 rounded-lg p-3 space-y-2">
                                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Termination</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-50 rounded-md p-2">
                                                <span className="text-[8px] text-slate-400 uppercase block">End</span>
                                                <span className="text-[10px] font-semibold text-slate-700 font-mono">{new Date(row.thawEndTime!).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className="bg-emerald-50/60 rounded-md p-2 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[8px] text-emerald-500 uppercase block">Temp</span>
                                                    <span className="text-[10px] font-semibold text-emerald-600">{row.finalTemp}°C</span>
                                                </div>
                                                {row.finalTempImg && (
                                                    <div onClick={() => window.open(row.finalTempImg)} className="w-7 h-7 rounded border border-white overflow-hidden cursor-pointer shrink-0">
                                                        <img src={row.finalTempImg} className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                                            {row.completedBySign && (
                                                <div className="h-5 w-8 bg-slate-50 border border-slate-100 rounded p-0.5 shrink-0 overflow-hidden">
                                                    <img src={row.completedBySign} className="max-h-full max-w-full object-contain" />
                                                </div>
                                            )}
                                            <span className="text-[9px] text-slate-500 truncate">{row.completedBy}</span>
                                        </div>
                                        {row.secondaryShelfLife && (
                                            <div className="bg-indigo-50/60 border border-indigo-100/60 p-2 rounded-md">
                                                <span className="text-[8px] text-indigo-400 uppercase block">Shelf Life</span>
                                                <span className="text-[10px] font-semibold text-indigo-700">{row.secondaryShelfLife}</span>
                                                {row.secondaryExpiry && <span className="text-[8px] text-slate-400 ml-1.5">Exp: {row.secondaryExpiry.split('T')[0]}</span>}
                                            </div>
                                        )}
                                        {row.completionComments && (
                                            <p className="text-[9px] text-slate-400 italic">"{row.completionComments}"</p>
                                        )}
                                    </div>
                                )}

                                {/* Distribution */}
                                {row.issued.length > 0 && (
                                    <div className="bg-slate-50 rounded-lg p-3">
                                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Distribution</p>
                                        <div className="space-y-1">
                                            {row.issued.map((item) => (
                                                <div key={item.id} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-md text-[10px]">
                                                    <span className="font-medium text-slate-600 truncate">{item.location}</span>
                                                    <span className="font-semibold text-indigo-600 shrink-0 ml-2">{item.quantity.toFixed(1)} KG</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-1.5 flex justify-between text-[9px] pt-1.5 border-t border-slate-200">
                                            <span className="text-slate-400">Remaining</span>
                                            <span className={`font-semibold ${row.remainingQuantity > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{row.remainingQuantity.toFixed(1)} KG</span>
                                        </div>
                                    </div>
                                )}

                                {/* Verification */}
                                {isVerified && (
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center shrink-0"><ShieldCheck size={12} /></div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-semibold text-slate-700 truncate">{row.verifierName}</p>
                                                <p className="text-[8px] text-emerald-500 font-medium">Verified</p>
                                            </div>
                                            {row.verifierSignature && (
                                                <div className="h-5 w-8 bg-white border border-emerald-100 rounded p-0.5 shrink-0 overflow-hidden">
                                                    <img src={row.verifierSignature} className="max-h-full max-w-full object-contain" />
                                                </div>
                                            )}
                                        </div>
                                        {row.verificationDate && (
                                            <p className="text-[9px] text-emerald-600">
                                                {new Date(row.verificationDate).toLocaleDateString()} · {new Date(row.verificationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        )}
                                        {row.verificationComments && (
                                            <p className="text-[9px] text-emerald-700 italic bg-white/50 p-1.5 rounded-lg border border-emerald-100">"{row.verificationComments}"</p>
                                        )}
                                    </div>
                                )}

                                {/* QR Code Section */}
                                <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl" />
                                    <div className="w-16 h-16 bg-white p-1 rounded-xl shadow-lg flex items-center justify-center border-2 border-indigo-500/20 shrink-0 relative z-10">
                                        <QRCodeSVG value={qrPayload} size={52} level="H" />
                                    </div>
                                    <div className="min-w-0 relative z-10">
                                        <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-[0.15em] mb-1">Registry Node</p>
                                        <p className="text-xs font-black uppercase tracking-tight leading-none mb-1.5">Digital Product ID</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[7px] font-bold border border-indigo-500 uppercase">Scan</span>
                                            <ShieldCheck size={10} className="text-emerald-400" />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
