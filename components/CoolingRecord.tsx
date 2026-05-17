"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Snowflake, X, Search, Thermometer, Clock, Camera, Building2,
  CheckCheck, Zap, Calendar, ShieldCheck, PenTool,
  Plus, Database, RefreshCw, Download, 
  CheckCircle2, Globe, MapPin, Package, History,
  Info, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Edit3, UserCheck, Loader2, Play,
  SlidersHorizontal, BarChart3, Activity, 
  CheckSquare, Square, Timer, ArrowRight,
  MoreVertical, FileText, Split, Eraser,
  ShieldAlert, ImageIcon, Check, ChevronsLeft, ChevronLeft, ChevronsRight, ClipboardCheck, MessageSquare,
  XCircle, ListChecks, Leaf, Beef,
  Wind,
  AlertCircle,
  AlertTriangle,
  QrCode,
  Waves,
  TrendingUp,
  Flame,
  TimerOff,
  PlusCircle,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import { CoolingRecordEntry, CoolingIssuedItem } from '../types';
import { useNotifications } from './NotificationContext';
import { compressImage } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { drawPdfHeader, resolveEntityLogoSrc } from '@/utils/pdfHeader';
import UnifiedPagination from './UnifiedPagination';

const COOLING_METHODS = ["Blast Chiller", "Ice Bath", "Cold Water Bath", "Ambient Air (Pre-cool)"];

const COOLING_DEPT_PERSONNEL: Record<string, { heads: string[]; staff: string[] }> = {
    'Main Kitchen': { heads: ['Chef Kumar', 'Sous Chef Ravi'], staff: ['Cook Ali', 'Cook Priya', 'Helper Sunil'] },
    'Cold Kitchen': { heads: ['Chef Deepak'], staff: ['Cook Meena', 'Cook Farhan'] },
    'Bakery': { heads: ['Pastry Chef Anita'], staff: ['Baker Rohit', 'Baker Sana'] },
    'Store Room': { heads: ['Store Manager Vijay'], staff: ['Store Asst. Rekha', 'Store Asst. Imran'] },
    'Receiving Bay': { heads: ['QA Lead Nisha'], staff: ['Inspector Ram', 'Inspector Lata'] },
    'General': { heads: ['Operations Manager'], staff: [] },
};
const CHILLER_IDS = ["BC-UNIT-01", "BC-UNIT-02", "BC-UNIT-03", "BC-MAIN-HALL"];
const PURPOSES = ["Reheating", "Cold Prep", "Service", "Portioning", "Storage", "Staff Meal", "Transfer"];

const statusColorMap: Record<string, string> = {
    'NOT_STARTED': 'bg-slate-100 text-slate-500 border-slate-200',
    'INITIAL': 'bg-blue-50 text-blue-700 border-blue-100',
    'STAGE_1': 'bg-orange-50 text-orange-700 border-orange-100',
    'COMPLETED': 'bg-emerald-50 text-emerald-700 border-emerald-100'
};

const isEntrySelectable = (e: CoolingRecordEntry) => 
    e.status === 'COMPLETED' && e.remainingQuantity === 0 && !e.isVerified;

interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Authorized Signature" }) => {
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
        ctx?.beginPath(); ctx?.moveTo(x, y);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx?.lineTo(x, y); ctx?.stroke();
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
        <div className="space-y-3 text-left">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                <button type="button" onClick={clear} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                </button>
            </div>
            <div className="w-full h-24 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas ref={canvasRef} width={500} height={96} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw} />
                {!initialData && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <span className="text-3xl font-black uppercase -rotate-6 select-none tracking-tighter">Verified Commit</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const TelemetryCell = ({ time, temp, image, user, sign, comments, label, isPending, isDisabled, onAction, colorClass = "text-indigo-600", method, vesselId }: any) => {
    if (isPending) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed min-h-[160px] relative overflow-hidden group">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 shadow-sm">
                    {isDisabled ? <Lock size={18} /> : <Clock size={18}/>}
                </div>
                {isDisabled ? (
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Locked</span>
                ) : (
                    <button onClick={onAction} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">Log {label}</button>
                )}
                {isDisabled && (
                    <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl">Complete Previous Step</div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm relative group min-h-[160px]">
             <div className="flex justify-between items-start">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    <span className="text-xs font-bold text-slate-700 font-mono mt-0.5">{new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-black ${colorClass} bg-slate-50 border border-slate-100`}>
                    {temp}°C
                </div>
             </div>

             {method && (
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/50 rounded border border-blue-100 w-fit">
                    {method === 'Blast Chiller' ? <Wind size={10} className="text-cyan-600"/> : <Snowflake size={10} className="text-blue-500"/>}
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tight truncate max-w-[100px]">{method} {vesselId ? `(${vesselId.split('-').pop()})` : ''}</span>
                 </div>
             )}

             {image && (
                 <div className="relative w-full h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group/img" onClick={() => window.open(image)}>
                     <img src={image} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Evidence" />
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-colors">
                         <ImageIcon size={16} className="text-white opacity-0 group-hover/img:opacity-100 drop-shadow-md" />
                     </div>
                 </div>
             )}

             {comments && (
                 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[9px] text-slate-500 italic leading-snug line-clamp-2" title={comments}>"{comments}"</p>
                 </div>
             )}

             <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between gap-2">
                 <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Operator</span>
                    <span className="text-[9px] font-black text-slate-700 truncate" title={user}>{user}</span>
                 </div>
                 {sign ? (
                     <div className="h-8 w-16 bg-slate-50 rounded border border-slate-100 p-0.5 flex items-center justify-center overflow-hidden">
                         <img src={sign} className="max-h-full max-w-full object-contain mix-blend-multiply opacity-80" alt="Sig" />
                     </div>
                 ) : (
                     <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100" title="No Signature">
                         <PenTool size={12} />
                     </div>
                 )}
             </div>
        </div>
    );
};

interface CoolingRecordProps {
  entries: CoolingRecordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CoolingRecordEntry[]>>;
  onIssueToReheating?: (coolEntry: CoolingRecordEntry, quantity: number) => void;
  entities?: any[];
  userRootId?: string | null;
}

const CoolingRecord: React.FC<CoolingRecordProps> = ({ entries, setEntries, onIssueToReheating, entities = [], userRootId }) => {
    const { addNotification } = useNotifications();
    const [searchTerm, setSearchTerm] = useState("");
    const [dashboardFilter, setDashboardFilter] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState<string>("");
    const [dateTo, setDateTo] = useState<string>("");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [activeModal, setActiveModal] = useState<'INITIAL' | 'STAGE_1' | 'FINAL' | 'VERIFY' | 'ISSUE' | 'BULK_VERIFY' | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<CoolingRecordEntry | null>(null);
    const [method, setMethod] = useState(COOLING_METHODS[0]);
    const [vessel, setVessel] = useState(CHILLER_IDS[0]);
    const [tempInput, setTempInput] = useState("");
    const [tempImg, setTempImg] = useState<string | null>(null);
    const [signature, setSignature] = useState("");
    const [stageComments, setStageComments] = useState("");
    const [verificationComments, setVerificationComments] = useState("");
    const [verificationSignature, setVerificationSignature] = useState("");
    const [stagedIssuances, setStagedIssuances] = useState<Array<{ id: string, quantity: string, purpose: string }>>([ { id: '1', quantity: "", purpose: PURPOSES[0] } ]);
    const [coolTempWarning, setCoolTempWarning] = useState<{ type: 'blast_low' | 'reheat' | 'discard'; temp: number } | null>(null);
    const cameraRef = useRef<HTMLInputElement>(null);
    const coolingTimersRef = useRef<Map<string, NodeJS.Timeout[]>>(new Map());

    const [docControlData] = useState<DocControlInfo>({
        docRef: 'COOL-RGST-03',
        version: '2.4',
        effectiveDate: new Date().toISOString().split('T')[0],
        approvedBy: 'Quality Assurance Director'
    });

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

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        return () => {
            coolingTimersRef.current.forEach(timers => timers.forEach(t => clearTimeout(t)));
            coolingTimersRef.current.clear();
        };
    }, []);

    const clearCoolingTimers = (uuid: string) => {
        const timers = coolingTimersRef.current.get(uuid);
        if (timers) {
            timers.forEach(t => clearTimeout(t));
            coolingTimersRef.current.delete(uuid);
        }
    };

    const scheduleCoolingNotifications = (entry: CoolingRecordEntry, selectedMethod: string) => {
        clearCoolingTimers(entry.uuid);
        const timers: NodeJS.Timeout[] = [];
        const productLabel = `${entry.productName} (${entry.batchNumber})`;

        if (selectedMethod === 'Blast Chiller') {
            const t30 = setTimeout(() => {
                addNotification({
                    type: 'COOLING_MONITOR',
                    title: 'Blast Chiller - 30 Min Temperature Check',
                    message: `30 minutes elapsed for ${productLabel}. Please check and record the intermediate temperature now.`,
                    department: entry.departmentName,
                    icon: 'alert',
                    severity: 'warning',
                    recipients: [entry.initiatedBy || 'Operator'],
                });
            }, 30 * 60 * 1000);
            timers.push(t30);

            const t60 = setTimeout(() => {
                addNotification({
                    type: 'COOLING_MONITOR',
                    title: 'Blast Chiller - 60 Min Temperature Check',
                    message: `60 minutes elapsed for ${productLabel}. Please check and record the temperature.`,
                    department: entry.departmentName,
                    icon: 'alert',
                    severity: 'warning',
                    recipients: [entry.initiatedBy || 'Operator'],
                });
            }, 60 * 60 * 1000);
            timers.push(t60);

            const t80 = setTimeout(() => {
                addNotification({
                    type: 'COOLING_FINAL',
                    title: 'Blast Chiller - FINAL CHECK (80 Min)',
                    message: `80 minutes elapsed for ${productLabel}. Final temperature check required. Close monitoring and complete the cooling process NOW.`,
                    department: entry.departmentName,
                    icon: 'shield',
                    severity: 'critical',
                    recipients: [entry.initiatedBy || 'Operator'],
                });
            }, 80 * 60 * 1000);
            timers.push(t80);

        } else if (selectedMethod === 'Ice Bath') {
            for (let h = 1; h <= 4; h++) {
                const tH = setTimeout(() => {
                    addNotification({
                        type: 'COOLING_MONITOR',
                        title: `Ice Bath - ${h} Hour Temperature Check`,
                        message: `${h} hour(s) elapsed for ${productLabel}. Please check and record the temperature.`,
                        department: entry.departmentName,
                        icon: 'alert',
                        severity: 'warning',
                        recipients: [entry.initiatedBy || 'Operator'],
                    });
                }, h * 60 * 60 * 1000);
                timers.push(tH);
            }

            const urgentStart = setTimeout(() => {
                let urgentCount = 0;
                const urgentInterval = setInterval(() => {
                    urgentCount++;
                    addNotification({
                        type: 'COOLING_FINAL',
                        title: 'Ice Bath - URGENT: Stop Cooling Process',
                        message: `4 hours exceeded for ${productLabel} (${urgentCount * 5} min over). Stop the cooling process and finalize the record immediately.`,
                        department: entry.departmentName,
                        icon: 'shield',
                        severity: 'critical',
                        recipients: [entry.initiatedBy || 'Operator'],
                    });
                    if (urgentCount >= 12) clearInterval(urgentInterval);
                }, 5 * 60 * 1000);
                timers.push(urgentInterval as unknown as NodeJS.Timeout);
            }, 4 * 60 * 60 * 1000);
            timers.push(urgentStart);
        }

        coolingTimersRef.current.set(entry.uuid, timers);
    };

    const stats = useMemo(() => {
        const total = entries.length;
        const avgDaily = (total / 7).toFixed(1); 
        return {
            pendingStart: entries.filter(e => e.status === 'NOT_STARTED').length,
            pendingMonitoring: entries.filter(e => e.status === 'INITIAL').length,
            pendingTerminal: entries.filter(e => e.status === 'STAGE_1').length,
            processActive: entries.filter(e => ['INITIAL', 'STAGE_1'].includes(e.status)).length,
            pendingSplit: entries.filter(e => e.status === 'COMPLETED' && e.remainingQuantity > 0).length,
            pendingVerification: entries.filter(e => e.status === 'COMPLETED' && e.remainingQuantity === 0 && !e.isVerified).length,
            completed: entries.filter(e => e.status === 'COMPLETED' && e.isVerified).length,
            avgDaily
        }
    }, [entries]);

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = e.productName.toLowerCase().includes(searchTerm.toLowerCase()) || e.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesDashboard = true;
            if (dashboardFilter) {
                if (dashboardFilter === 'pendingStart') matchesDashboard = e.status === 'NOT_STARTED';
                else if (dashboardFilter === 'pendingMonitoring') matchesDashboard = e.status === 'INITIAL';
                else if (dashboardFilter === 'pendingTerminal') matchesDashboard = e.status === 'STAGE_1';
                else if (dashboardFilter === 'incomplete') matchesDashboard = ['INITIAL', 'STAGE_1'].includes(e.status);
                else if (dashboardFilter === 'pendingSplit') matchesDashboard = e.status === 'COMPLETED' && e.remainingQuantity > 0;
                else if (dashboardFilter === 'pendingVerification') matchesDashboard = e.status === 'COMPLETED' && e.remainingQuantity === 0 && !e.isVerified;
                else if (dashboardFilter === 'completed') matchesDashboard = e.status === 'COMPLETED' && !!e.isVerified;
            }

            let matchesDate = true;
            const recordDateStr = e.startTime || e.cookingEndTime;
            if (recordDateStr) {
                const recordDate = new Date(recordDateStr);
                if (dateFrom) {
                    const fromDate = new Date(dateFrom);
                    const fromTime = fromDate.setHours(0,0,0,0);
                    if (recordDate.getTime() < fromTime) matchesDate = false;
                }
                if (dateTo && matchesDate) { 
                    const toDate = new Date(dateTo);
                    const toTime = toDate.setHours(23,59,59,999);
                    if (recordDate.getTime() > toTime) matchesDate = false;
                }
            }
            return matchesSearch && matchesDashboard && matchesDate;
        }).sort((a, b) => {
            const statusOrder = { 'INITIAL': 0, 'STAGE_1': 1, 'NOT_STARTED': 2, 'COMPLETED': 3 };
            return (statusOrder as any)[a.status] - (statusOrder as any)[b.status];
        });
    }, [entries, searchTerm, dashboardFilter, dateFrom, dateTo]);

    const totalItemsCount = filteredEntries.length;
    const totalPages = Math.ceil(totalItemsCount / rowsPerPage);
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredEntries.slice(start, start + rowsPerPage);
    }, [filteredEntries, currentPage, rowsPerPage]);

    const formatTimeDuration = (start: string | undefined, end?: string) => {
        if (!start) return '--:--';
        const sTime = new Date(start).getTime();
        const eTime = end ? new Date(end).getTime() : now;
        const diff = Math.max(0, eTime - sTime);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const hStr = hours > 0 ? `${hours}h ` : '';
        return `${hStr}${mins}m ${secs}s`;
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectableEntries = useMemo(() => filteredEntries.filter(isEntrySelectable), [filteredEntries]);
    const areAllSelectableSelected = selectableEntries.length > 0 && selectableEntries.every(e => selectedIds.has(e.uuid));

    const handleSelectAll = () => {
        if (areAllSelectableSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableEntries.map(e => e.uuid)));
        }
    };
    
    const openStageModal = (entry: CoolingRecordEntry, stage: typeof activeModal) => {
        setSelectedEntry(entry);
        setTempInput(""); setTempImg(null); setSignature(""); setStageComments("");
        setMethod(entry.method || COOLING_METHODS[0]);
        setVessel(entry.vesselId || CHILLER_IDS[0]);
        if (stage === 'ISSUE') setStagedIssuances([{ id: '1', quantity: "", purpose: PURPOSES[0] }]);
        if (stage === 'VERIFY') { setVerificationComments(""); setVerificationSignature(""); }
        setActiveModal(stage);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setTempImg(compressed); };
            reader.readAsDataURL(file);
        }
    };

    const commitStageUpdate = () => {
        if (activeModal === 'VERIFY' || activeModal === 'BULK_VERIFY') {
            const targetIds = activeModal === 'BULK_VERIFY' ? Array.from(selectedIds) : (selectedEntry ? [selectedEntry.uuid] : []);
            const timestamp = new Date().toISOString();
            
            setEntries(prev => prev.map(e => {
                if (targetIds.includes(e.uuid)) { 
                    return { 
                        ...e, 
                        isVerified: true, 
                        verifierName: 'QA Auditor', 
                        verificationDate: timestamp, 
                        verifierSignature: verificationSignature, 
                        verificationComments: verificationComments 
                    }; 
                }
                return e;
            }));

            if (activeModal === 'BULK_VERIFY') setSelectedIds(new Set());
            setActiveModal(null);
            setSelectedEntry(null);
            return;
        }

        if (!selectedEntry) return;
        const timestamp = new Date().toISOString();
        const temp = parseFloat(tempInput);

        const matchingEntry = entries.find(e => e.uuid === selectedEntry.uuid);
        if (!matchingEntry) return;

        const selectedMethod = activeModal === 'INITIAL' ? method : (matchingEntry.method || '');

        if (activeModal === 'INITIAL' && selectedMethod === 'Blast Chiller' && temp <= 65) {
            setCoolTempWarning({ type: 'blast_low', temp });
            return;
        }

        if (activeModal === 'STAGE_1' && selectedMethod === 'Ice Bath' && temp > 21) {
            setCoolTempWarning({ type: 'reheat', temp });
            return;
        }

        if (activeModal === 'FINAL' && selectedMethod === 'Ice Bath' && temp > 4) {
            setCoolTempWarning({ type: 'discard', temp });
            return;
        }

        const dept = matchingEntry.departmentName || 'General';
        const deptInfo = COOLING_DEPT_PERSONNEL[dept] || COOLING_DEPT_PERSONNEL['General'];
        const productLabel = `${matchingEntry.productName} (${matchingEntry.batchNumber})`;

        setEntries(prev => prev.map(e => {
            if (e.uuid !== selectedEntry.uuid) return e;
            
            if (activeModal === 'INITIAL') {
                return { ...e, status: 'INITIAL', method, vesselId: method === 'Blast Chiller' ? vessel : undefined, startTime: timestamp, initialTemp: temp, initialTempImg: tempImg || undefined, initiationSign: signature, initiatedBy: 'Chef Operator', operatorComments: stageComments, ambientLapse: formatTimeDuration(e.cookingEndTime, timestamp) };
            }
            
            if (activeModal === 'STAGE_1') {
                if (temp <= 4) {
                     return {
                        ...e,
                        status: 'COMPLETED',
                        stage1Time: timestamp,
                        stage1Temp: temp,
                        stage1TempImg: tempImg || undefined,
                        stage1Sign: signature,
                        stage1By: 'Chef Operator',
                        stage1Comments: (stageComments ? stageComments + " " : "") + "[Target Reached — ≤4°C]",
                        finalTime: timestamp,
                        finalTemp: temp,
                        finalTempImg: tempImg || undefined,
                        finalSign: signature,
                        finalBy: 'Chef Operator',
                        finalComments: "Cooling target (≤4°C) reached in Watch Stage. Process finalized.",
                        shelfLifeExpiry: new Date(new Date(timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString()
                     };
                }
                return { ...e, status: 'STAGE_1', stage1Time: timestamp, stage1Temp: temp, stage1TempImg: tempImg || undefined, stage1Sign: signature, stage1By: 'Chef Operator', stage1Comments: stageComments };
            }
            
            if (activeModal === 'FINAL') { 
                return { ...e, status: 'COMPLETED', finalTime: timestamp, finalTemp: temp, finalTempImg: tempImg || undefined, finalSign: signature, finalBy: 'Chef Operator', finalComments: stageComments, shelfLifeExpiry: new Date(new Date(timestamp).getTime() + 24 * 60 * 60 * 1000).toISOString() }; 
            }
            
            return e;
        }));

        if (activeModal === 'INITIAL') {
            addNotification({
                type: 'COOLING_INITIATED',
                title: 'Cooling Process Initiated',
                message: `Cooling initiated for ${productLabel} using ${method} method by Chef Operator. Department: ${dept}. Initial temp: ${temp}°C.`,
                department: dept,
                icon: 'info',
                severity: 'info',
                recipients: [...deptInfo.heads],
                senderName: 'Chef Operator',
            });
            scheduleCoolingNotifications(matchingEntry, method);
        } else if (activeModal === 'STAGE_1') {
            if (temp < 5) {
                clearCoolingTimers(matchingEntry.uuid);
                addNotification({
                    type: 'COOLING_MONITOR',
                    title: 'Cooling Completed - Target Reached',
                    message: `${productLabel} has reached ${temp}°C (≤4°C target) during monitoring. Cooling process auto-completed.`,
                    department: dept,
                    icon: 'alert',
                    severity: 'info',
                    recipients: [...deptInfo.heads, matchingEntry.initiatedBy || 'Operator'],
                });
            } else {
                addNotification({
                    type: 'COOLING_MONITOR',
                    title: 'Cooling Monitor Recorded',
                    message: `Monitor temperature ${temp}°C recorded for ${productLabel}. Cooling still in progress.`,
                    department: dept,
                    icon: 'alert',
                    severity: temp > 20 ? 'warning' : 'info',
                    recipients: [matchingEntry.initiatedBy || 'Operator'],
                });
            }
        } else if (activeModal === 'FINAL') {
            clearCoolingTimers(matchingEntry.uuid);
            addNotification({
                type: 'COOLING_FINAL',
                title: 'Cooling Process Completed',
                message: `Cooling completed for ${productLabel}. Final temperature: ${temp}°C. Process finalized by Chef Operator.`,
                department: dept,
                icon: 'shield',
                severity: 'info',
                recipients: [...deptInfo.heads, matchingEntry.initiatedBy || 'Operator'],
            });
        }
        
        setActiveModal(null); setSelectedEntry(null);
    };

    const handleIssueCooledFood = () => {
        if (!selectedEntry) return;
        const totalIssuing = stagedIssuances.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
        if (totalIssuing <= 0 || totalIssuing > selectedEntry.remainingQuantity) return;
        
        const newIssuedItems: CoolingIssuedItem[] = stagedIssuances.filter(i => parseFloat(i.quantity) > 0).map(i => ({ id: `iss-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, purpose: i.purpose, quantity: parseFloat(i.quantity), timestamp: new Date().toISOString(), user: 'HACCP Auditor' }));
        
        setEntries(prev => prev.map(e => { 
            if (e.uuid !== selectedEntry.uuid) return e; 
            return { ...e, remainingQuantity: e.remainingQuantity - totalIssuing, issued: [...(e.issued || []), ...newIssuedItems] }; 
        }));

        // Handshake Handoff Trigger
        stagedIssuances.forEach(iss => {
            if (iss.purpose === 'Reheating' && onIssueToReheating) {
                onIssueToReheating(selectedEntry, parseFloat(iss.quantity));
            }
        });

        setActiveModal(null); 
        setSelectedEntry(null); 
        setStagedIssuances([{ id: '1', quantity: "", purpose: PURPOSES[0] }]);
    };

    const buildCoolingQRUrl = (e: CoolingRecordEntry): string => {
        const data: Record<string, unknown> = {
            pn: e.productName, bn: e.batchNumber, md: e.mfgDate, ed: e.expDate,
            loc: e.locationName, dept: e.departmentName, unit: e.unitName, reg: e.regionName, corp: e.corporateName,
            ct: e.cookTemp, cet: e.cookingEndTime, ctl: e.cookingTimeLapse, cqt: e.cookingQty, cvs: e.cookingVessel,
            thm: e.thawingMethod, tst: e.thawStartTemp, tft: e.thawFinalTemp, mtq: e.motherThawQty,
            mt: e.method, vid: e.vesselId, qty: e.quantity, su: e.storedUnit,
            st: e.startTime, it: e.initialTemp, s1t: e.stage1Time, s1tp: e.stage1Temp,
            ft: e.finalTime, ftp: e.finalTemp, sle: e.shelfLifeExpiry,
            ib: e.initiatedBy, s1b: e.stage1By, fb: e.finalBy,
            oc: e.operatorComments, al: e.ambientLapse,
            vf: e.isVerified ? 1 : 0, status: e.status,
            vn: e.verifierName, vc: e.verificationComments, vd: e.verificationDate,
        };
        const base = btoa(JSON.stringify(data));
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return `${origin}/cool-record?d=${base}`;
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
            img.onload = () => { ctx?.drawImage(img, 0, 0); document.body.removeChild(container); resolve(canvas.toDataURL('image/png')); };
            img.onerror = () => { document.body.removeChild(container); resolve(''); };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
    };

    const generatePDFForEntries = async (targetEntries: CoolingRecordEntry[], filename: string) => {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 20, mr = 20, mt = 30, mb = 40;
        const cw = pw - ml - mr;
        let y = mt;
        let pageNum = 1;

        const securityId = `CERT-COOL-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const downloadTimestamp = new Date().toLocaleString();

        const colFractions = [0.10, 0.10, 0.12, 0.10, 0.10, 0.10, 0.12, 0.08, 0.18];
        const colWidths = colFractions.map(f => cw * f);
        const colX = [ml];
        for (let i = 1; i < 9; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
        const colHeaders = ['LOCATION', 'PRODUCT NODE', 'COOKING & THAWING', 'INITIAL DETAILS', 'INTERMEDIATE', 'TERMINAL DETAILS', 'SPLIT PORTFOLIO', 'QR PASSPORT', 'VERIFICATION'];

        const drawWatermark = () => {
            pdf.setTextColor(235, 238, 245);
            pdf.setFontSize(52);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 });
        };

        const drawFooter = (pn: number) => {
            const fy = ph - mb + 12;
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.5);
            pdf.line(ml, fy - 5, pw - mr, fy - 5);
            pdf.setFontSize(7);
            pdf.setTextColor(148, 163, 184);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`System Timestamp: ${downloadTimestamp}`, ml, fy + 2);
            pdf.text(`Electronic Integrity Hash: ${securityId}`, pw - mr, fy + 2, { align: 'right' });
            pdf.text(`Page ${pn}`, pw / 2, fy + 2, { align: 'center' });
        };

        const startNewPage = () => {
            drawFooter(pageNum);
            pdf.addPage();
            pageNum++;
            drawWatermark();
            y = mt;
        };

        const drawHeader = () => {
            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'COOLING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData, compact: true });
        };

        const drawTableHeader = () => {
            pdf.setFillColor(30, 41, 59);
            pdf.rect(ml, y, cw, 18, 'F');
            pdf.setFontSize(5);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            for (let i = 0; i < 9; i++) {
                pdf.text(colHeaders[i], colX[i] + 3, y + 12);
            }
            pdf.setDrawColor(100, 116, 139);
            pdf.setLineWidth(0.3);
            for (let i = 1; i < 9; i++) {
                pdf.line(colX[i], y + 3, colX[i], y + 15);
            }
            y += 18;
        };

        const drawTableRow = async (e: CoolingRecordEntry, rowIdx: number) => {
            const hasVerification = e.isVerified;
            const rowH = hasVerification ? 90 : 70;

            if (y + rowH > ph - mb) {
                startNewPage();
                drawTableHeader();
            }

            const ry = y;
            const bgColor = rowIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
            pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            pdf.rect(ml, ry, cw, rowH, 'F');

            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.3);
            pdf.line(ml, ry + rowH, pw - mr, ry + rowH);
            for (let i = 1; i < 9; i++) {
                pdf.line(colX[i], ry, colX[i], ry + rowH);
            }

            const cx = (i: number) => colX[i] + 3;

            // COL 0: LOCATION
            pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            const locLines = pdf.splitTextToSize(e.locationName || '', colWidths[0] - 6);
            pdf.text(locLines.slice(0, 2), cx(0), ry + 10);
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(e.departmentName || '', cx(0), ry + 22);
            pdf.setFontSize(5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(e.unitName || '', cx(0), ry + 30);
            pdf.setFontSize(4.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
            pdf.text(e.regionName || '', cx(0), ry + 38);
            pdf.setFontSize(4.5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
            pdf.text(e.corporateName || '', cx(0), ry + 46);

            // COL 1: PRODUCT NODE
            pdf.setFontSize(6.5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
            const prodLines = pdf.splitTextToSize(e.productName || '', colWidths[1] - 6);
            pdf.text(prodLines.slice(0, 2), cx(1), ry + 10);
            pdf.setFontSize(5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`BATCH: ${e.batchNumber}`, cx(1), ry + 24);
            pdf.setFontSize(5); pdf.setTextColor(16, 185, 129);
            pdf.text(`MFG: ${e.mfgDate || 'N/A'}`, cx(1), ry + 32);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`EXP: ${e.expDate || 'N/A'}`, cx(1), ry + 40);
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`Qty: ${e.quantity} ${e.storedUnit}`, cx(1), ry + 48);

            // COL 2: COOKING & THAWING TRACE
            pdf.setFontSize(5.5); pdf.setTextColor(225, 29, 72); pdf.setFont('helvetica', 'bold');
            pdf.text(`Cook Temp: ${e.cookTemp || '---'}°C`, cx(2), ry + 10);
            pdf.setFontSize(5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'normal');
            pdf.text(`Cook End: ${e.cookingEndTime ? new Date(e.cookingEndTime).toLocaleTimeString() : '---'}`, cx(2), ry + 18);
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139);
            pdf.text(`Lapse: ${e.cookingTimeLapse || '---'} | Qty: ${e.cookingQty || '---'} ${e.storedUnit}`, cx(2), ry + 26);
            if (e.cookingVessel) { pdf.text(`Vessel: ${e.cookingVessel}`, cx(2), ry + 33); }
            pdf.setDrawColor(200, 210, 225); pdf.setLineWidth(0.3);
            pdf.line(cx(2), ry + 36, cx(2) + colWidths[2] - 10, ry + 36);
            pdf.setFontSize(5); pdf.setTextColor(59, 130, 246); pdf.setFont('helvetica', 'bold');
            pdf.text(`Thaw: ${e.thawingMethod || 'N/A'}`, cx(2), ry + 42);
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`Mother: ${e.motherThawQty || '---'} ${e.motherThawUnit || e.storedUnit} | Start: ${e.thawStartTemp != null ? e.thawStartTemp + '°C' : '---'}`, cx(2), ry + 50);
            pdf.text(`Final: ${e.thawFinalTemp != null ? e.thawFinalTemp + '°C' : '---'}`, cx(2), ry + 58);

            // COL 3: INITIAL DETAILS
            pdf.setFontSize(5.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`Method: ${e.method || 'Pending'}`, cx(3), ry + 10);
            if (e.vesselId) { pdf.setFontSize(4.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal'); pdf.text(e.vesselId, cx(3), ry + 17); }
            pdf.setFontSize(10); pdf.setTextColor(225, 29, 72); pdf.setFont('helvetica', 'bold');
            pdf.text(`${e.initialTemp != null ? e.initialTemp + '°C' : '---'}`, cx(3), ry + 30);
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`${e.startTime ? new Date(e.startTime).toLocaleTimeString() : '---'}`, cx(3), ry + 38);
            pdf.setFontSize(5); pdf.setTextColor(148, 163, 184);
            pdf.text(`By: ${e.initiatedBy || 'N/A'}`, cx(3), ry + 46);
            if (e.ambientLapse) { pdf.setFontSize(4.5); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold'); pdf.text(`Ambient: ${e.ambientLapse}`, cx(3), ry + 54); }

            // COL 4: INTERMEDIATE (STAGE 1)
            if (e.stage1Temp != null) {
                pdf.setFontSize(5.5); pdf.setTextColor(59, 130, 246); pdf.setFont('helvetica', 'bold');
                pdf.text('STAGE 1 CHECK', cx(4), ry + 10);
                pdf.setFontSize(10); pdf.setTextColor(59, 130, 246); pdf.setFont('helvetica', 'bold');
                pdf.text(`${e.stage1Temp}°C`, cx(4), ry + 24);
                pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                pdf.text(`${e.stage1Time ? new Date(e.stage1Time).toLocaleTimeString() : '---'}`, cx(4), ry + 32);
                const s1Lapse = formatTimeDuration(e.startTime, e.stage1Time);
                pdf.setFontSize(4.5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
                pdf.text(`Lapse: ${s1Lapse}`, cx(4), ry + 40);
                pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text(`By: ${e.stage1By || 'N/A'}`, cx(4), ry + 48);
                if (e.stage1Comments) {
                    pdf.setFontSize(4.5); pdf.setTextColor(100, 116, 139);
                    const cmtLines = pdf.splitTextToSize(e.stage1Comments, colWidths[4] - 6);
                    pdf.text(cmtLines.slice(0, 2), cx(4), ry + 56);
                }
            } else {
                pdf.setFontSize(5.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text('Not recorded', cx(4), ry + 14);
            }

            // COL 5: TERMINAL DETAILS
            if (e.finalTemp != null) {
                pdf.setFontSize(5.5); pdf.setTextColor(16, 185, 129); pdf.setFont('helvetica', 'bold');
                pdf.text('FINAL CHECK', cx(5), ry + 10);
                pdf.setFontSize(10); pdf.setTextColor(16, 185, 129); pdf.setFont('helvetica', 'bold');
                pdf.text(`${e.finalTemp}°C`, cx(5), ry + 24);
                pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                pdf.text(`${e.finalTime ? new Date(e.finalTime).toLocaleTimeString() : '---'}`, cx(5), ry + 32);
                const totalLapse = formatTimeDuration(e.startTime, e.finalTime);
                pdf.setFontSize(4.5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
                pdf.text(`Total: ${totalLapse}`, cx(5), ry + 40);
                pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text(`By: ${e.finalBy || 'N/A'}`, cx(5), ry + 48);
                if (e.shelfLifeExpiry) {
                    pdf.setFontSize(4.5); pdf.setTextColor(225, 29, 72); pdf.setFont('helvetica', 'bold');
                    pdf.text(`Shelf: ${e.shelfLifeExpiry}`, cx(5), ry + 56);
                }
            } else {
                pdf.setFontSize(5.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text('Pending', cx(5), ry + 14);
            }

            // COL 6: SPLIT PORTFOLIO
            const issued = e.issued || [];
            let distY = ry + 10;
            if (issued.length > 0) {
                for (let ii = 0; ii < Math.min(issued.length, 5); ii++) {
                    pdf.setFontSize(5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
                    const purposeLines = pdf.splitTextToSize(issued[ii].purpose, colWidths[6] - 24);
                    pdf.text(purposeLines.slice(0, 1), cx(6), distY);
                    pdf.setTextColor(15, 23, 42);
                    pdf.text(`${issued[ii].quantity.toFixed(1)}`, cx(6) + colWidths[6] - 20, distY);
                    distY += 8;
                }
                const totalQty = Number(e.quantity) || 0;
                const distW = issued.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
                const rem = Math.max(0, totalQty - distW);
                pdf.setDrawColor(200, 210, 225); pdf.setLineWidth(0.3);
                pdf.line(cx(6), distY - 2, cx(6) + colWidths[6] - 10, distY - 2);
                pdf.setFontSize(5); pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(rem > 0 ? 225 : 5, rem > 0 ? 29 : 150, rem > 0 ? 72 : 105);
                pdf.text(`Rem: ${rem.toFixed(1)} ${e.storedUnit}`, cx(6), distY + 4);
            } else {
                pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text('No distribution', cx(6), distY);
            }

            // COL 7: QR PASSPORT
            const qrString = buildCoolingQRUrl(e);
            try {
                const qrDataUrl = await renderQRToCanvas(qrString);
                if (qrDataUrl) {
                    const qrSize = 34;
                    const qrX = cx(7) + (colWidths[7] - 6) / 2 - qrSize / 2;
                    pdf.addImage(qrDataUrl, 'PNG', qrX, ry + 4, qrSize, qrSize);
                    pdf.setFontSize(4);
                    pdf.setTextColor(148, 163, 184);
                    pdf.setFont('helvetica', 'bold');
                    const scanText = 'SCAN RECORD';
                    pdf.text(scanText, cx(7) + (colWidths[7] - 6) / 2 - pdf.getTextWidth(scanText) / 2, ry + qrSize + 8);
                }
            } catch {}

            // COL 8: VERIFICATION
            const authX = cx(8);
            const authW = colWidths[8] - 8;
            pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
            pdf.text('OPERATOR', authX, ry + 8);
            pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(e.initiatedBy || 'N/A', authX, ry + 16);

            if (e.initiationSign && e.initiationSign.startsWith('data:')) {
                try { pdf.addImage(e.initiationSign, e.initiationSign.includes('image/png') ? 'PNG' : 'JPEG', authX, ry + 18, Math.min(authW, 80), 10); } catch {}
            }

            let verY = ry + 32;
            if (hasVerification) {
                pdf.setFillColor(240, 253, 244);
                pdf.setDrawColor(187, 247, 208);
                pdf.setLineWidth(0.5);
                pdf.rect(authX - 2, verY, Math.min(authW + 4, 90), 12, 'FD');
                pdf.setFontSize(5); pdf.setTextColor(5, 150, 105); pdf.setFont('helvetica', 'bold');
                pdf.text('QA AUTHORIZED', authX + 2, verY + 5);
                pdf.setFontSize(6); pdf.setTextColor(6, 78, 59); pdf.setFont('helvetica', 'bold');
                pdf.text(e.verifierName || '', authX + 2, verY + 10);
                verY += 14;

                if (e.verifierSignature && e.verifierSignature.startsWith('data:')) {
                    try { pdf.addImage(e.verifierSignature, e.verifierSignature.includes('image/png') ? 'PNG' : 'JPEG', authX, verY, Math.min(authW, 80), 10); verY += 12; } catch {}
                }

                if (e.verificationComments) {
                    pdf.setFontSize(5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                    const cmtLines = pdf.splitTextToSize(e.verificationComments, authW);
                    pdf.text(cmtLines.slice(0, 3), authX, verY + 5);
                    verY += cmtLines.slice(0, 3).length * 5 + 3;
                }

                if (e.verificationDate) {
                    pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'bold');
                    const dateStr = new Date(e.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    pdf.text(dateStr, authX, verY + 5);
                }
            } else {
                pdf.setFontSize(6.5); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold');
                pdf.text('AWAITING AUTH', authX, verY + 6);
            }

            y += rowH;
        };

        drawWatermark();
        drawHeader();
        drawTableHeader();

        for (let ei = 0; ei < targetEntries.length; ei++) {
            await drawTableRow(targetEntries[ei], ei);
        }

        y += 16;
        if (y + 50 > ph - mb) {
            startNewPage();
        }
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        const sigW = (cw - 20) / 2;
        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml, y, sigW, 40, 'FD');
        pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
        pdf.text('COOLING PROCESS SIGNATURE', ml + 8, y + 12);
        pdf.setDrawColor(203, 213, 225);
        pdf.line(ml + 8, y + 32, ml + sigW - 8, y + 32);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml + sigW + 20, y, sigW, 40, 'FD');
        pdf.setTextColor(100, 116, 139);
        pdf.text('QA VERIFICATION AUTHORITY', ml + sigW + 28, y + 12);
        pdf.line(ml + sigW + 28, y + 32, pw - mr - 8, y + 32);

        drawFooter(pageNum);
        savePdfForPWA(pdf, filename);
    };

    const handleGlobalExportPDF = async () => {
        if (filteredEntries.length === 0) return;
        setIsGeneratingPDF(true);
        const filename = `Complete_Cooling_Registry_${new Date().toISOString().split('T')[0]}.pdf`;
        await generatePDFForEntries(filteredEntries, filename);
        setIsGeneratingPDF(false);
    };

    const handleExportSinglePDF = async (entry: CoolingRecordEntry) => {
        setIsGeneratingPDF(true);
        try {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ml = 40, mr = 40, mt = 40, mb = 50;
            const cw = pw - ml - mr;
            let y = mt;
            const securityId = `CERT-COOL-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
            const timestamp = new Date().toLocaleString();

            const toDataUrl = async (src: string): Promise<string> => {
                if (src.startsWith('data:')) return src;
                try {
                    const r = await fetch(src);
                    const b = await r.blob();
                    return new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(b); });
                } catch { return ''; }
            };

            const addWatermark = () => {
                pdf.setTextColor(235, 238, 245);
                pdf.setFontSize(52);
                pdf.setFont('helvetica', 'bold');
                pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 });
            };
            addWatermark();

            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'COOLING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData });

            pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`COOLING RECORD #${entry.batchNumber}`, ml, y);
            const statusColor: Record<string, number[]> = { 'COMPLETED': [5, 150, 105], 'INITIAL': [245, 158, 11], 'STAGE_1': [245, 158, 11], 'NOT_STARTED': [100, 116, 139] };
            const sc = statusColor[entry.status || 'COMPLETED'] || [100, 116, 139];
            pdf.setTextColor(sc[0], sc[1], sc[2]);
            pdf.setFontSize(9);
            pdf.text(entry.isVerified ? 'VERIFIED' : (entry.status || '').replace('_', ' ').toUpperCase(), pw - mr, y, { align: 'right' });
            y += 12;

            const sectionHeader = (title: string) => {
                if (y + 30 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 16, 'F');
                pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
                pdf.text(title, ml + 8, y + 11);
                y += 16;
            };

            const rowH = 16;
            const halfW = cw / 2;
            const drawRow = (label1: string, val1: string, label2?: string, val2?: string, valColor1?: number[], valColor2?: number[]) => {
                if (y + rowH > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
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

            const fmtDt = (d?: string) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'N/A';

            sectionHeader('UNIT DETAILS');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 3);
            drawRow('Location:', entry.locationName || 'N/A', 'Department:', entry.departmentName || 'N/A');
            drawRow('Unit:', entry.unitName || 'N/A', 'Region:', entry.regionName || 'N/A');
            drawRow('Corporate:', entry.corporateName || 'N/A');

            sectionHeader('PRODUCT INFORMATION');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 5);
            drawRow('Product Name:', entry.productName || '', '', '', [79, 70, 229]);
            drawRow('Batch Number:', entry.batchNumber || '');
            drawRow('Mfg Date:', entry.mfgDate || 'N/A', 'Exp Date:', entry.expDate || 'N/A', undefined, [225, 29, 72]);
            drawRow('Quantity:', `${entry.quantity} ${entry.storedUnit || ''}`, 'Stored Unit:', entry.storedUnit || 'N/A');
            drawRow('Remaining Qty:', `${entry.remainingQuantity} ${entry.storedUnit || ''}`, '', '', entry.remainingQuantity > 0 ? [225, 29, 72] : [5, 150, 105]);

            sectionHeader('COOKING & THAWING TRACE');
            const cookTraceRows = 6 + (entry.cookingQty ? 1 : 0) + (entry.cookingSplits?.length || 0) + (entry.motherThawQty ? 1 : 0) + (entry.sisterThawSplits?.length || 0);
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * Math.min(cookTraceRows, 6));
            drawRow('Cooking End Temp:', entry.cookTemp != null ? `${entry.cookTemp}°C` : 'N/A', 'Cooking End Time:', fmtDt(entry.cookingEndTime));
            drawRow('Cooking Time Lapse:', entry.cookingTimeLapse || 'N/A', 'Vessel:', entry.cookingVessel || 'N/A');
            if (entry.cookingQty) drawRow('Cooked Quantity:', `${entry.cookingQty} ${entry.storedUnit}`, '', '');
            if (entry.cookingSplits && entry.cookingSplits.length > 0) {
                entry.cookingSplits.forEach(sp => drawRow(`  → ${sp.purpose}:`, `${sp.quantity} ${entry.storedUnit}`, '', ''));
            }
            drawRow('Thawing Method:', entry.thawingMethod || 'N/A');
            drawRow('Thaw Start Temp:', entry.thawStartTemp != null ? `${entry.thawStartTemp}°C` : 'N/A', 'Thaw Final Temp:', entry.thawFinalTemp != null ? `${entry.thawFinalTemp}°C` : 'N/A');
            if (entry.motherThawQty) drawRow('Mother Thaw Qty:', `${entry.motherThawQty} ${entry.motherThawUnit || entry.storedUnit}`, 'This Split:', `${entry.quantity} ${entry.storedUnit}`);
            if (entry.sisterThawSplits && entry.sisterThawSplits.length > 0) {
                entry.sisterThawSplits.forEach(ss => drawRow(`  → ${ss.location}:`, `${ss.quantity} ${entry.storedUnit}`, '', ''));
            }
            drawRow('Thaw Start Time:', fmtDt(entry.thawStartTime), 'Thaw Completed:', fmtDt(entry.thawCompletedTime));

            sectionHeader('INITIAL COOLING STAGE');
            const hasInitComments = !!entry.operatorComments;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (4 + (hasInitComments ? 1 : 0)));
            drawRow('Method:', entry.method || 'N/A', 'Vessel ID:', entry.vesselId || 'N/A');
            drawRow('Initial Temp:', entry.initialTemp != null ? `${entry.initialTemp}°C` : 'N/A', 'Start Time:', fmtDt(entry.startTime));
            drawRow('Initiated By:', entry.initiatedBy || 'N/A', 'Ambient Lapse:', entry.ambientLapse || 'N/A');
            drawRow('Status:', 'RECORDED', '', '', [5, 150, 105]);
            if (hasInitComments) drawRow('Operator Comments:', entry.operatorComments || '');

            if (entry.initialTempImg && entry.initialTempImg.startsWith('data:')) {
                try {
                    const imgData = await toDataUrl(entry.initialTempImg);
                    if (imgData) {
                        if (y + 55 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Initial Temp Evidence:', ml + 8, y + 8);
                        pdf.addImage(imgData, imgData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 50, 40);
                        y += 55;
                    }
                } catch {}
            }

            if (entry.initiationSign && entry.initiationSign.startsWith('data:')) {
                try {
                    const sigData = await toDataUrl(entry.initiationSign);
                    if (sigData) {
                        if (y + 30 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Initiator Signature:', ml + 8, y + 8);
                        pdf.addImage(sigData, sigData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 80, 16);
                        y += 30;
                    }
                } catch {}
            }

            sectionHeader('INTERMEDIATE MONITORING (STAGE 1)');
            const hasS1Comments = !!entry.stage1Comments;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (3 + (hasS1Comments ? 1 : 0)));
            drawRow('Stage 1 Temp:', entry.stage1Temp != null ? `${entry.stage1Temp}°C` : 'N/A', 'Stage 1 Time:', fmtDt(entry.stage1Time));
            drawRow('Monitored By:', entry.stage1By || 'N/A');
            drawRow('Stage Status:', entry.stage1Time ? 'RECORDED' : 'PENDING', '', '', entry.stage1Time ? [5, 150, 105] : [245, 158, 11]);
            if (hasS1Comments) drawRow('Stage 1 Comments:', entry.stage1Comments || '');

            if (entry.stage1TempImg && entry.stage1TempImg.startsWith('data:')) {
                try {
                    const imgData = await toDataUrl(entry.stage1TempImg);
                    if (imgData) {
                        if (y + 55 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Stage 1 Temp Evidence:', ml + 8, y + 8);
                        pdf.addImage(imgData, imgData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 50, 40);
                        y += 55;
                    }
                } catch {}
            }

            if (entry.stage1Sign && entry.stage1Sign.startsWith('data:')) {
                try {
                    const sigData = await toDataUrl(entry.stage1Sign);
                    if (sigData) {
                        if (y + 30 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Stage 1 Signature:', ml + 8, y + 8);
                        pdf.addImage(sigData, sigData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 80, 16);
                        y += 30;
                    }
                } catch {}
            }

            sectionHeader('TERMINAL COOLING STAGE');
            const hasFinalComments = !!entry.finalComments;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (4 + (hasFinalComments ? 1 : 0)));
            drawRow('Final Temp:', entry.finalTemp != null ? `${entry.finalTemp}°C` : 'N/A', 'Final Time:', fmtDt(entry.finalTime), [225, 29, 72]);
            drawRow('Completed By:', entry.finalBy || 'N/A');
            drawRow('Shelf Life Expiry:', entry.shelfLifeExpiry || 'N/A', '', '', [225, 29, 72]);
            drawRow('Terminal Status:', entry.finalTime ? 'RECORDED' : 'PENDING', '', '', entry.finalTime ? [5, 150, 105] : [245, 158, 11]);
            if (hasFinalComments) drawRow('Final Comments:', entry.finalComments || '');

            if (entry.finalTempImg && entry.finalTempImg.startsWith('data:')) {
                try {
                    const imgData = await toDataUrl(entry.finalTempImg);
                    if (imgData) {
                        if (y + 55 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Final Temp Evidence:', ml + 8, y + 8);
                        pdf.addImage(imgData, imgData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 50, 40);
                        y += 55;
                    }
                } catch {}
            }

            if (entry.finalSign && entry.finalSign.startsWith('data:')) {
                try {
                    const sigData = await toDataUrl(entry.finalSign);
                    if (sigData) {
                        if (y + 30 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Terminal Signature:', ml + 8, y + 8);
                        pdf.addImage(sigData, sigData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 80, 16);
                        y += 30;
                    }
                } catch {}
            }

            const issuedItems = entry.issued || [];
            if (issuedItems.length > 0) {
                sectionHeader('DISTRIBUTION REGISTRY');
                pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (issuedItems.length + 1));
                for (const iss of issuedItems) {
                    drawRow('Purpose:', iss.purpose, 'Quantity:', `${iss.quantity.toFixed(1)} ${entry.storedUnit || ''}`);
                }
                const totalDist = issuedItems.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
                const remaining = Math.max(0, (Number(entry.quantity) || 0) - totalDist);
                drawRow('Remaining:', `${remaining.toFixed(1)} ${entry.storedUnit || ''}`, '', '', remaining > 0 ? [225, 29, 72] : [5, 150, 105]);
            }

            sectionHeader('AUTHORIZATION & VERIFICATION');
            const verRows = 2 + (entry.verificationComments ? 1 : 0) + (entry.verificationDate ? 1 : 0);
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * verRows + (entry.verifierSignature ? 30 : 0));
            drawRow('Verified By:', entry.isVerified ? (entry.verifierName || 'N/A') : 'PENDING', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
            drawRow('Verification Status:', entry.isVerified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
            if (entry.verificationComments) drawRow('Comments:', entry.verificationComments);
            if (entry.verificationDate) {
                drawRow('Verification Date:', fmtDt(entry.verificationDate));
            }
            if (entry.verifierSignature && entry.verifierSignature.startsWith('data:')) {
                try {
                    const vSig = await toDataUrl(entry.verifierSignature);
                    if (vSig) {
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Verifier Signature:', ml + 8, y + 8);
                        pdf.addImage(vSig, vSig.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 80, 16);
                    }
                } catch {}
                y += 30;
            }

            y += 6;
            sectionHeader('DIGITAL IDENTITY PASSPORT (QR CODE)');
            const qrString = buildCoolingQRUrl(entry);
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

            if (y + 60 > ph - mb) { y = mt; pdf.addPage(); addWatermark(); }

            pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
            const sigBoxW = (cw - 20) / 2;
            pdf.setFillColor(248, 250, 252);
            pdf.rect(ml, y, sigBoxW, 50, 'FD');
            pdf.setFontSize(7); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text('LEAD PRODUCTION SIGNATURE', ml + 8, y + 14);
            pdf.setDrawColor(203, 213, 225); pdf.line(ml + 8, y + 40, ml + sigBoxW - 8, y + 40);

            pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
            pdf.setFillColor(248, 250, 252);
            pdf.rect(ml + sigBoxW + 20, y, sigBoxW, 50, 'FD');
            pdf.setTextColor(15, 23, 42);
            pdf.text('QA VERIFICATION AUTHORITY', ml + sigBoxW + 28, y + 14);
            pdf.setDrawColor(203, 213, 225); pdf.line(ml + sigBoxW + 28, y + 40, pw - mr - 8, y + 40);

            const fy = ph - mb + 12;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.5);
            pdf.line(ml, fy - 5, pw - mr, fy - 5);
            pdf.setFontSize(7); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'bold');
            pdf.text(`System Timestamp: ${timestamp}`, ml, fy + 2);
            pdf.text(`Electronic Integrity Hash: ${securityId}`, pw - mr, fy + 2, { align: 'right' });
            pdf.text('Page 1', pw / 2, fy + 2, { align: 'center' });

            savePdfForPWA(pdf, `Cooling_Record_${entry.batchNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) { console.error('PDF generation error:', err); }
        setIsGeneratingPDF(false);
    };

    return (
        <div className="flex flex-col h-full gap-6 p-4 md:p-0">
            <div className="flex overflow-x-auto snap-x hide-scrollbar lg:grid lg:grid-cols-12 gap-3 lg:gap-4 items-stretch pb-3 lg:pb-0">
                <div className="snap-center shrink-0 w-[260px] md:w-auto lg:col-span-3 bg-white p-4 lg:p-5 rounded-2xl lg:rounded-[2.5rem] border border-slate-200/80 lg:border-slate-100 shadow-sm flex flex-col gap-3 lg:gap-4">
                    <div className="flex items-center gap-2.5 lg:gap-3 border-b border-slate-100 lg:border-slate-50 pb-2.5 lg:pb-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-orange-500 rounded-xl lg:rounded-2xl flex items-center justify-center text-white"><RefreshCw size={15} /></div>
                        <h4 className="text-[9px] lg:text-[10px] font-semibold lg:font-black text-slate-500 uppercase tracking-wider lg:tracking-widest">Thermal Cycle</h4>
                    </div>
                    <div className="flex justify-between items-center px-1 lg:px-2">
                        <button onClick={() => { setDashboardFilter('pendingStart'); setCurrentPage(1); }} className={`flex flex-col items-center gap-0.5 lg:gap-1 transition-all ${dashboardFilter === 'pendingStart' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}><Play size={14} fill={dashboardFilter === 'pendingStart' ? 'currentColor' : 'none'} /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">{stats.pendingStart}</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">Start</span></button>
                        <div className="h-7 lg:h-8 w-px bg-slate-100" /><button onClick={() => { setDashboardFilter('pendingMonitoring'); setCurrentPage(1); }} className={`flex flex-col items-center gap-0.5 lg:gap-1 transition-all ${dashboardFilter === 'pendingMonitoring' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}><Waves size={14} /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">{stats.pendingMonitoring}</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">Watch</span></button>
                        <div className="h-7 lg:h-8 w-px bg-slate-100" /><button onClick={() => { setDashboardFilter('pendingTerminal'); setCurrentPage(1); }} className={`flex flex-col items-center gap-0.5 lg:gap-1 transition-all ${dashboardFilter === 'pendingTerminal' ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}><Thermometer size={14} /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">{stats.pendingTerminal}</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">End</span></button>
                    </div>
                </div>
                <div className="snap-center shrink-0 w-[230px] md:w-auto lg:col-span-3 bg-white p-4 lg:p-5 rounded-2xl lg:rounded-[2.5rem] border border-slate-200/80 lg:border-slate-100 shadow-sm lg:shadow-xl flex flex-col gap-3 lg:gap-4">
                    <div className="flex items-center gap-2.5 lg:gap-3 border-b border-slate-100 lg:border-slate-50 pb-2.5 lg:pb-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-emerald-600 rounded-xl lg:rounded-2xl flex items-center justify-center text-white"><ShieldCheck size={15} /></div>
                        <h4 className="text-[9px] lg:text-[10px] font-semibold lg:font-black text-slate-500 uppercase tracking-wider lg:tracking-widest">Quality Audit</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 lg:gap-2 px-0.5 lg:px-1">
                        <button onClick={() => { setDashboardFilter('incomplete'); setCurrentPage(1); }} className={`flex flex-col items-center p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all ${dashboardFilter === 'incomplete' ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50'}`}>
                            <span className="text-sm font-bold lg:font-black text-slate-900 leading-none">{stats.processActive}</span>
                            <span className="text-[7px] font-semibold lg:font-black uppercase text-blue-600">Incomplete</span>
                        </button>
                        <button onClick={() => { setDashboardFilter('pendingSplit'); setCurrentPage(1); }} className={`flex flex-col items-center p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all ${dashboardFilter === 'pendingSplit' ? 'bg-purple-50 border border-purple-200' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50'}`}>
                            <span className="text-sm font-bold lg:font-black text-slate-900 leading-none">{stats.pendingSplit}</span>
                            <span className="text-[7px] font-semibold lg:font-black uppercase text-purple-600">Unsplit</span>
                        </button>
                        <button onClick={() => { setDashboardFilter('pendingVerification'); setCurrentPage(1); }} className={`flex flex-col items-center p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all ${dashboardFilter === 'pendingVerification' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50'}`}>
                            <span className="text-sm font-bold lg:font-black text-slate-900 leading-none">{stats.pendingVerification}</span>
                            <span className="text-[7px] font-semibold lg:font-black uppercase text-amber-600">Due</span>
                        </button>
                        <button onClick={() => { setDashboardFilter('completed'); setCurrentPage(1); }} className={`flex flex-col items-center p-1.5 lg:p-2 rounded-lg lg:rounded-xl transition-all ${dashboardFilter === 'completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 lg:bg-transparent hover:bg-slate-50'}`}>
                            <span className="text-sm font-bold lg:font-black text-slate-900 leading-none">{stats.completed}</span>
                            <span className="text-[7px] font-semibold lg:font-black uppercase text-emerald-600">Verified</span>
                        </button>
                    </div>
                </div>
                <div className="snap-center shrink-0 w-[260px] md:w-auto lg:col-span-4 bg-white p-4 lg:p-5 rounded-2xl lg:rounded-[2.5rem] border border-slate-200/80 lg:border-slate-100 shadow-sm flex flex-col gap-3 lg:gap-4">
                    <div className="flex items-center gap-2.5 lg:gap-3 border-b border-slate-100 lg:border-slate-50 pb-2.5 lg:pb-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-xl lg:rounded-2xl flex items-center justify-center text-white"><BarChart3 size={15} /></div>
                        <h4 className="text-[9px] lg:text-[10px] font-semibold lg:font-black text-slate-500 uppercase tracking-wider lg:tracking-widest">Performance</h4>
                    </div>
                    <div className="flex justify-around items-center px-1 lg:px-2">
                        <div className="flex flex-col items-center gap-0.5 lg:gap-1"><Zap size={14} className="text-indigo-500" /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">{stats.avgDaily}</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">Rec/Day</span></div>
                        <div className="h-7 lg:h-8 w-px bg-slate-100" /><div className="flex flex-col items-center gap-0.5 lg:gap-1"><AlertCircle size={14} className="text-rose-400" /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">0</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">Alerts</span></div>
                        <div className="h-7 lg:h-8 w-px bg-slate-100" /><div className="flex flex-col items-center gap-0.5 lg:gap-1"><TrendingUp size={14} className="text-emerald-500" /><span className="text-base lg:text-lg font-bold lg:font-black text-slate-900 leading-none">98%</span><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase text-slate-400">Comply</span></div>
                    </div>
                </div>
                <div className="snap-center shrink-0 w-[140px] lg:w-auto md:w-auto lg:col-span-2 flex flex-col gap-2 lg:gap-3">
                    <div className="flex flex-col lg:flex-row flex-1 gap-2">
                        <button onClick={handleGlobalExportPDF} disabled={isGeneratingPDF} className="flex-1 rounded-xl lg:rounded-[1.75rem] border bg-white border-slate-200/80 lg:border-slate-100 text-slate-400 hover:text-emerald-600 active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center gap-1 py-3 lg:py-0"><Download size={15} /><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase leading-none">Export</span></button>
                        <button onClick={() => { setSearchTerm(""); setDashboardFilter(null); setCurrentPage(1); }} className="flex-1 bg-white border border-slate-200/80 lg:border-slate-100 text-slate-400 rounded-xl lg:rounded-[1.75rem] hover:text-indigo-600 active:scale-95 flex flex-col items-center justify-center gap-1 py-3 lg:py-0"><RefreshCw size={15} /><span className="text-[7px] lg:text-[8px] font-semibold lg:font-black uppercase leading-none">Refresh</span></button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-2 md:p-4 rounded-xl lg:rounded-[2rem] border border-slate-200/80 lg:border-slate-200 shadow-sm flex flex-row items-center gap-2 mb-4 lg:mb-6 overflow-x-auto hide-scrollbar">
                <button onClick={handleSelectAll} disabled={selectableEntries.length === 0} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${areAllSelectableSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-400'} ${selectableEntries.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {areAllSelectableSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>
                <div className="relative group flex-1 min-w-[140px]">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Search..." className="w-full pl-9 pr-3 px-2 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-[10px] font-black outline-none focus:border-indigo-400" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-2 py-1.5 shadow-inner shrink-0">
                    <input type="date" className="bg-transparent text-[9px] font-bold text-slate-700 outline-none w-20 md:w-auto" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <span className="text-slate-300 text-[10px] font-bold">-</span>
                    <input type="date" className="bg-transparent text-[9px] font-bold text-slate-700 outline-none w-20 md:w-auto" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="ml-1 text-slate-400 hover:text-rose-500"><X size={12} /></button>}
                </div>
                {selectedIds.size > 0 && (
                     <button onClick={() => { setActiveModal('BULK_VERIFY'); setVerificationComments(""); setVerificationSignature(""); }} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 whitespace-nowrap">Verify ({selectedIds.size})</button>
                )}
            </div>

            <div className="flex flex-col gap-4 lg:gap-6">
                {paginatedEntries.length > 0 ? paginatedEntries.map((entry, idx) => {
                    const isNotStarted = entry.status === 'NOT_STARTED';
                    const isInitial = entry.status === 'INITIAL';
                    const isStage1 = entry.status === 'STAGE_1';
                    const isInProgress = isInitial || isStage1;
                    const isCompleted = entry.status === 'COMPLETED';
                    const isVerified = !!entry.isVerified;
                    const isSelected = selectedIds.has(entry.uuid);
                    const isMobileExpanded = expandedMobileId === entry.uuid;
                    const canSelect = isEntrySelectable(entry);
                    const qrData = JSON.stringify({ id: entry.uuid, product: entry.productName, batch: entry.batchNumber, status: entry.status, start: entry.startTime, final: entry.finalTime, verified: entry.isVerified });

                    return (
                        <div key={entry.uuid} className={`relative bg-white rounded-2xl lg:rounded-[2.5rem] border transition-all duration-300 flex flex-col lg:flex-row group overflow-hidden ${isInProgress ? 'border-orange-300 shadow-md lg:shadow-2xl lg:border-orange-400 lg:scale-[1.01]' : isSelected ? 'border-indigo-400 bg-indigo-50/5 shadow-md lg:border-indigo-600' : 'border-slate-200/80 lg:border-slate-100 shadow-sm hover:shadow-md hover:border-slate-300 lg:hover:border-orange-200'}`}>
                            {canSelect && (
                                <div className="absolute top-3 left-3 lg:top-4 lg:left-4 z-20" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => toggleSelection(entry.uuid)} className={`w-6 h-6 md:w-8 md:h-8 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-300 hover:border-indigo-300'}`}><Check size={14} strokeWidth={4} /></button>
                                </div>
                            )}
                            <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100 w-full">
                                <div className={`p-3.5 lg:p-8 lg:w-[12%] border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center bg-slate-50/30 ${canSelect ? 'pl-11 lg:pl-16' : ''}`}>
                                    <div className="hidden lg:flex flex-col gap-2">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shadow-md ${isInProgress ? 'bg-orange-600' : 'bg-slate-900'}`}>{((currentPage - 1) * rowsPerPage + idx + 1).toString().padStart(2, '0')}</div>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-wider ${statusColorMap[entry.status]}`}>{entry.status.replace('_', ' ')}</span>
                                        </div>
                                        <div className="space-y-0.5"><p className="text-[10px] font-black text-slate-800 uppercase truncate leading-none">{entry.locationName}</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate">{entry.departmentName}</p><div className="h-px bg-slate-200/50 my-1" /><p className="text-[9px] font-black text-slate-400 uppercase truncate leading-none">{entry.unitName}</p><p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest truncate">{entry.regionName}</p></div>
                                    </div>
                                    <div className="lg:hidden flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${isInProgress ? 'bg-orange-500' : 'bg-slate-800'}`}>{((currentPage - 1) * rowsPerPage + idx + 1).toString().padStart(2, '0')}</div>
                                            <div className="min-w-0">
                                                <h4 className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{entry.productName}</h4>
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{entry.unitName} · {entry.departmentName}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-semibold uppercase border shrink-0 ${statusColorMap[entry.status]}`}>{entry.status.replace('_', ' ')}</span>
                                    </div>
                                </div>
                                <div className="hidden lg:flex p-6 lg:w-[16%] flex-col justify-center gap-1.5"><div className="flex items-center gap-2 mb-1"><Package size={12} className="text-indigo-400" /><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Product Node</span></div><h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight line-clamp-2">{entry.productName}</h4><div className="flex flex-col gap-1 mt-2"><div className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="text-[8px] font-black text-slate-400 uppercase">Batch</span><span className="text-[10px] font-mono font-bold text-slate-600">{entry.batchNumber}</span></div><div className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="text-[8px] font-black text-slate-400 uppercase">Load</span><span className="text-[10px] font-black text-indigo-600">{entry.quantity} {entry.storedUnit}</span></div></div></div>
                                <div className="lg:hidden px-3.5 pb-1 pt-0">
                                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                                        <div className="flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-center">
                                            <span className="text-[7px] font-medium text-slate-400 uppercase block">Batch</span>
                                            <span className="text-[10px] font-semibold text-slate-700 font-mono">{entry.batchNumber}</span>
                                        </div>
                                        <div className="flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-center">
                                            <span className="text-[7px] font-medium text-slate-400 uppercase block">Load</span>
                                            <span className="text-[10px] font-semibold text-indigo-600">{entry.quantity} {entry.storedUnit}</span>
                                        </div>
                                        <div className="flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-center">
                                            <span className="text-[7px] font-medium text-slate-400 uppercase block">Cook</span>
                                            <span className="text-[10px] font-semibold text-rose-500">{entry.cookTemp}°C</span>
                                        </div>
                                        {isCompleted && (
                                            <div className="flex-1 bg-slate-50 rounded-lg px-2.5 py-1.5 text-center">
                                                <span className="text-[7px] font-medium text-slate-400 uppercase block">Left</span>
                                                <span className="text-[10px] font-semibold text-slate-700">{entry.remainingQuantity}/{entry.quantity}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="lg:hidden px-3.5 py-2.5 flex items-center gap-2 border-t border-slate-100">
                                    <div className="flex-1 flex gap-2">
                                        {isNotStarted && (<button onClick={() => openStageModal(entry, 'INITIAL')} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-[9px] font-semibold uppercase active:scale-95 flex items-center justify-center gap-1.5"><Play size={12} fill="currentColor" /> Start</button>)}
                                        {(isInitial || isStage1) && (<button onClick={() => openStageModal(entry, 'STAGE_1')} className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-[9px] font-semibold uppercase active:scale-95 flex items-center justify-center gap-1.5"><Timer size={12} /> Monitor</button>)}
                                        {isCompleted && (<>
                                            {entry.remainingQuantity === 0 && !isVerified ? (<button onClick={() => openStageModal(entry, 'VERIFY')} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-[9px] font-semibold uppercase active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"><ShieldCheck size={12} /> Verify</button>) : isVerified ? (<div className="flex-1 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-[9px] font-semibold uppercase flex items-center justify-center gap-1.5 whitespace-nowrap"><CheckCircle2 size={12} /> Verified</div>) : null}
                                            {entry.remainingQuantity > 0 && (<button onClick={() => openStageModal(entry, 'ISSUE')} className="py-2.5 px-3 bg-white border border-slate-200 text-slate-500 rounded-lg text-[9px] font-semibold uppercase active:scale-95 flex items-center justify-center gap-1.5"><Split size={12} /> Split</button>)}
                                        </>)}
                                        <button onClick={() => handleExportSinglePDF(entry)} className="py-2.5 px-3 bg-white border border-slate-200 text-slate-400 rounded-lg text-[9px] font-semibold uppercase active:scale-95 flex items-center justify-center"><Download size={12} /></button>
                                    </div>
                                    <button onClick={() => setExpandedMobileId(isMobileExpanded ? null : entry.uuid)} className={`w-9 h-9 flex shrink-0 items-center justify-center rounded-lg border transition-all ${isMobileExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}><ChevronDown size={20} className={`transition-transform duration-300 ${isMobileExpanded ? 'rotate-180' : ''}`} /></button></div>
                                <div className={`${isMobileExpanded ? 'block' : 'hidden lg:flex'} lg:contents`}>
                                    <div className="lg:hidden px-3.5 py-3 bg-slate-800 flex items-center gap-3">
                                        <div className="w-16 h-16 bg-white p-1 rounded-xl shrink-0 flex items-center justify-center"><QRCodeSVG value={qrData} size={56} level="H" includeMargin={false} /></div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">Product Registry</p>
                                            <p className="text-sm font-semibold text-white leading-tight mb-1">Digital ID</p>
                                            <span className="px-1.5 py-0.5 bg-indigo-600/80 text-white rounded text-[7px] font-medium uppercase">Scan to Audit</span>
                                        </div>
                                    </div>
                                    <div className="p-3.5 lg:p-4 lg:w-[20%] flex flex-col justify-center gap-3 border-b lg:border-b-0 border-slate-100 bg-slate-50/30 lg:bg-slate-50/20 text-[9px]">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 font-semibold lg:font-black text-slate-400 uppercase tracking-wider lg:tracking-widest border-b border-slate-200/80 pb-1 mb-1"><Flame size={10} className="text-orange-500" /> Cooking Trace</div>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                                <div className="flex flex-col"><span className="text-[8px] text-slate-400">Date</span><span className="font-bold text-slate-700">{new Date(entry.cookingEndTime).toLocaleDateString()}</span></div>
                                                <div className="flex flex-col text-right"><span className="text-[8px] text-slate-400">Time</span><span className="font-bold text-slate-700">{new Date(entry.cookingEndTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                                                <div className="flex flex-col"><span className="text-[8px] text-slate-400">Temp</span><span className="font-black text-rose-500">{entry.cookTemp}°C</span></div>
                                                <div className="flex flex-col text-right"><span className="text-[8px] text-slate-400">Lapse</span><span className="font-bold text-slate-600">{entry.cookingTimeLapse || 'N/A'}</span></div>
                                            </div>
                                            {entry.cookingQty != null && entry.cookingQty > 0 && (
                                                <div className="mt-1 bg-orange-50 border border-orange-100 rounded-lg p-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[8px] text-orange-500 font-bold uppercase">Cooked Qty</span>
                                                        <span className="font-black text-orange-700">{entry.cookingQty} {entry.storedUnit}</span>
                                                    </div>
                                                    {entry.cookingVessel && (
                                                        <div className="flex justify-between items-center mt-0.5">
                                                            <span className="text-[8px] text-slate-400">Vessel</span>
                                                            <span className="font-bold text-slate-600">{entry.cookingVessel}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {entry.cookingSplits && entry.cookingSplits.length > 0 && (
                                                <div className="mt-1 space-y-0.5">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Cooking Breakup</span>
                                                    {entry.cookingSplits.map((sp, si) => (
                                                        <div key={si} className="flex justify-between items-center bg-white border border-slate-100 rounded px-1.5 py-0.5">
                                                            <span className="text-[8px] font-bold text-slate-600 truncate max-w-[60%]">{sp.purpose}</span>
                                                            <span className="text-[8px] font-black text-orange-600">{sp.quantity} {entry.storedUnit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1 pt-1">
                                            <div className="flex items-center gap-1.5 font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-1 mb-1"><Snowflake size={10} className="text-blue-500" /> Thawing Trace</div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between"><span className="text-slate-500">Batch:</span> <span className="font-mono font-bold">{entry.batchNumber}</span></div>
                                                <div className="flex justify-between"><span className="text-slate-500">Method:</span> <span className="font-bold">{entry.thawingMethod || 'N/A'}</span></div>
                                                {entry.motherThawQty != null && entry.motherThawQty > 0 && (
                                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-1.5">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[8px] text-blue-500 font-bold uppercase">Mother Qty</span>
                                                            <span className="font-black text-blue-700">{entry.motherThawQty} {entry.motherThawUnit || entry.storedUnit}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-0.5">
                                                            <span className="text-[8px] text-slate-400">This Split</span>
                                                            <span className="font-bold text-indigo-600">{entry.quantity} {entry.storedUnit}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {entry.sisterThawSplits && entry.sisterThawSplits.length > 0 && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Sister Splits</span>
                                                        {entry.sisterThawSplits.map((ss, si) => (
                                                            <div key={si} className="flex justify-between items-center bg-white border border-slate-100 rounded px-1.5 py-0.5">
                                                                <span className="text-[8px] font-bold text-slate-600 truncate max-w-[60%]">{ss.location}</span>
                                                                <span className="text-[8px] font-black text-blue-600">{ss.quantity} {entry.storedUnit}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded border border-slate-100">
                                                    <div className="text-center border-r border-slate-100"><span className="block text-[7px] text-slate-400 uppercase">Start</span><span className="block font-bold">{entry.thawStartTemp ? `${entry.thawStartTemp}°C` : '-'}</span></div>
                                                    <div className="text-center"><span className="block text-[7px] text-slate-400 uppercase">Final</span><span className="block font-bold text-blue-600">{entry.thawFinalTemp ? `${entry.thawFinalTemp}°C` : '-'}</span></div>
                                                </div>
                                                <div className="flex justify-between text-[8px] text-slate-400"><span>MFD: {entry.mfgDate}</span><span>EXP: {entry.expDate}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* 1. INITIAL STAGE CELL */}
                                    <div className="p-0 lg:w-[13%] shrink-0 border-b lg:border-b-0 border-slate-100">
                                        <TelemetryCell 
                                            label="Initial" 
                                            time={entry.startTime} 
                                            temp={entry.initialTemp} 
                                            image={entry.initialTempImg} 
                                            user={entry.initiatedBy} 
                                            sign={entry.initiationSign} 
                                            comments={entry.operatorComments} 
                                            isPending={isNotStarted} 
                                            isDisabled={false} // Always allowed if pending
                                            onAction={() => openStageModal(entry, 'INITIAL')} 
                                            colorClass="text-rose-600" 
                                            method={entry.method} 
                                            vesselId={entry.vesselId} 
                                        />
                                    </div>
                                    
                                    {/* 2. WATCH STAGE CELL - DEACTIVATED IF INITIAL NOT STARTED */}
                                    <div className="p-0 lg:w-[13%] shrink-0 bg-slate-50/30 border-b lg:border-b-0 border-slate-100">
                                        <TelemetryCell 
                                            label="Watch" 
                                            time={entry.stage1Time} 
                                            temp={entry.stage1Temp} 
                                            image={entry.stage1TempImg} 
                                            user={entry.stage1By} 
                                            sign={entry.stage1Sign} 
                                            comments={entry.stage1Comments} 
                                            isPending={isNotStarted || isInitial} 
                                            isDisabled={isNotStarted} // Locked if Initial hasn't happened
                                            onAction={() => openStageModal(entry, 'STAGE_1')} 
                                            colorClass="text-orange-600" 
                                        />
                                    </div>
                                    
                                    {/* 3. TERMINAL STAGE CELL - DEACTIVATED IF WATCH NOT STARTED */}
                                    <div className="p-0 lg:w-[13%] shrink-0 border-b lg:border-b-0 border-slate-100">
                                        <TelemetryCell 
                                            label="Terminal" 
                                            time={entry.finalTime} 
                                            temp={entry.finalTemp} 
                                            image={entry.finalTempImg} 
                                            user={entry.finalBy} 
                                            sign={entry.finalSign} 
                                            comments={entry.finalComments} 
                                            isPending={isNotStarted || isInitial || isStage1} 
                                            isDisabled={isNotStarted || isInitial} // Locked if Initial/Watch haven't happened
                                            onAction={() => openStageModal(entry, 'FINAL')} 
                                            colorClass="text-emerald-700" 
                                        />
                                    </div>

                                    <div className="p-6 lg:w-[8%] flex flex-col justify-center gap-3 bg-slate-50/10 border-b lg:border-b-0 border-slate-100"><div className="space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar pr-1"><div className="flex justify-between items-center mb-1"><span className="text-[8px] font-black text-slate-300 uppercase">Portions</span><span className="text-[10px] font-black text-indigo-600">{entry.remainingQuantity}/{entry.quantity}</span></div>{entry.issued.map(iss => (<div key={iss.id} className="bg-white border border-slate-100 rounded-lg p-1.5 shadow-xs text-center"><span className="text-[9px] font-black text-slate-800">{iss.quantity} KG</span><div className="text-[7px] text-slate-400 uppercase truncate">{iss.purpose}</div></div>))}{entry.issued.length === 0 && <div className="text-[8px] text-slate-300 italic text-center py-2">No Issues</div>}</div>{isCompleted && entry.remainingQuantity > 0 && (<button onClick={() => openStageModal(entry, 'ISSUE')} className="w-full py-1.5 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase shadow-md active:scale-95"><Split size={10} className="inline mr-1"/> Split</button>)}</div>
                                    <div className="hidden lg:flex p-6 lg:w-[12%] flex-col justify-center items-center bg-white shrink-0 border-r border-slate-50"><div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col items-center gap-3 shadow-inner group/qr transition-all hover:bg-indigo-50 hover:border-indigo-200"><div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100"><QRCodeSVG value={qrData} size={64} level="H" includeMargin={false} /></div><div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/qr:text-indigo-600 transition-colors">Registry ID</p></div></div></div>
                                    <div className="p-4 lg:p-6 flex-1 flex flex-col justify-center lg:border-l border-slate-100">
                                        {isVerified ? (
                                            <div className="space-y-2 lg:space-y-3 animate-in zoom-in-95 duration-300 flex flex-col items-center lg:items-end">
                                                <div className="w-full bg-emerald-50 border border-emerald-200 lg:border-2 lg:border-emerald-500 rounded-xl lg:rounded-[2rem] p-3 lg:p-4 shadow-sm lg:shadow-xl flex items-center gap-3 lg:gap-4">
                                                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><ShieldCheck size={16} strokeWidth={3} /></div>
                                                    <div className="min-w-0">
                                                        <p className="text-[8px] lg:text-[9px] font-medium lg:font-black text-slate-400 uppercase tracking-wider lg:tracking-widest mb-0.5">Authorized</p>
                                                        <p className="text-[11px] lg:text-xs font-semibold lg:font-black text-slate-800 uppercase truncate">{entry.verifierName}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleExportSinglePDF(entry)} className="hidden lg:flex w-full py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest items-center justify-center gap-2 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"><Download size={14}/> Export PDF</button>
                                            </div>
                                        ) : isCompleted ? (
                                            entry.remainingQuantity === 0 ? (
                                                <div className="p-3.5 lg:p-5 text-center space-y-3 lg:space-y-4 bg-amber-50/50 border border-dashed border-amber-200 lg:border-2 rounded-xl lg:rounded-[2rem] w-full animate-in fade-in">
                                                    <ShieldAlert size={32} className="text-amber-500 mx-auto animate-pulse" />
                                                    <button onClick={() => openStageModal(entry, 'VERIFY')} className="w-full py-3.5 bg-amber-400 text-amber-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-amber-500 active:scale-95 transition-all">Authorize Log</button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-center opacity-40 grayscale py-10 scale-90">
                                                    <Split size={48} className="mb-4" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] max-w-[150px]">Portioning Pending for Authorization</p>
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-full flex items-center justify-center opacity-10 grayscale pointer-events-none scale-110"><ShieldAlert size={48} /></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="py-16 lg:py-24 text-center text-slate-300 border border-dashed border-slate-200 lg:border-2 rounded-2xl lg:rounded-[3rem] bg-white"><Package size={48} className="mx-auto mb-3 lg:mb-4 opacity-10" /><p className="text-xs lg:text-sm font-semibold lg:font-black uppercase tracking-widest">No Records Found</p></div>
                )}
            </div>

            <div className="bg-white border border-slate-200/80 lg:border-slate-200 shadow-sm rounded-xl lg:rounded-[2.5rem] mb-6 lg:mb-10 overflow-hidden">
                <UnifiedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItemsCount}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
                />
            </div>

            {/* MODALS */}
            {activeModal && activeModal !== 'VERIFY' && activeModal !== 'BULK_VERIFY' && activeModal !== 'ISSUE' && selectedEntry && (
                <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 h-[90vh] sm:h-auto sm:max-h-[90vh]">
                        <div className="sm:hidden w-full flex justify-center pt-3 pb-1 bg-indigo-600"><div className="w-12 h-1.5 bg-white/20 rounded-full" /></div>
                        <div className={`px-6 py-6 md:px-10 md:py-8 text-white flex justify-between items-center shrink-0 shadow-lg ${activeModal === 'FINAL' ? 'bg-emerald-600' : activeModal === 'STAGE_1' ? 'bg-orange-500' : 'bg-indigo-600'}`}>
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">{activeModal === 'INITIAL' ? <Play size={28} fill="currentColor" strokeWidth={3} /> : <Timer size={28} />}</div>
                                <div><h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">{activeModal === 'INITIAL' ? 'Start Cooling' : activeModal === 'STAGE_1' ? 'Watch Cycle' : 'End Cooling'}</h3><p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">Registry Node Sync Point</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} strokeWidth={3} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-slate-50/20 custom-scrollbar text-left pb-safe">
                            <div className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Process Item</p><h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">{selectedEntry.productName}</h4><div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50"><span className="text-[10px] font-mono font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">#{selectedEntry.batchNumber}</span><div className="flex items-center gap-1.5"><Thermometer size={14} className="text-rose-500"/><span className="text-xs font-black text-rose-600">{selectedEntry.cookTemp}°C <span className="text-[9px] font-bold text-slate-400">Cooked</span></span></div></div></div>
                            <div className="space-y-6">
                                {activeModal === 'INITIAL' && (
                                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cooling Strategy</label><select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-14 px-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-500 shadow-sm">{COOLING_METHODS.map(m => <option key={m}>{m}</option>)}</select></div>{method === 'Blast Chiller' && (<div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chiller Unit ID</label><select value={vessel} onChange={e => setVessel(e.target.value)} className="w-full h-14 px-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-500 shadow-sm">{CHILLER_IDS.map(v => <option key={v}>{v}</option>)}</select></div>)}</div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Thermometer size={14} className="text-rose-500" /> Core Temperature Reading (°C) <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1"><input autoFocus type="number" step="0.1" className="w-full h-16 md:h-20 bg-white border-2 border-slate-100 rounded-2xl text-4xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner text-center" placeholder="0.0" value={tempInput} onChange={e => { const v = e.target.value; if (v === '' || /^-?\d*\.?\d{0,1}$/.test(v)) setTempInput(v); }} /><span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">°C</span></div>
                                        <button type="button" onClick={() => cameraRef.current?.click()} className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all border-2 shrink-0 ${tempImg ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}><Camera size={28} /></button>
                                        <input type="file" ref={cameraRef} capture="environment" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </div>
                                    {tempImg && <div className="mt-2 relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-sm animate-in zoom-in-95"><img src={tempImg} className="w-full h-full object-cover" /><button type="button" onClick={() => setTempImg(null)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><X size={10} strokeWidth={4}/></button></div>}
                                    {activeModal === 'INITIAL' && method === 'Blast Chiller' && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-xl">
                                            <Wind size={14} className="text-cyan-600 shrink-0" />
                                            <span className="text-[10px] font-bold text-cyan-700">Standard: Initial temperature must be <span className="font-black">&gt; 65.0°C</span> — Cooling must complete within <span className="font-black">90 minutes</span></span>
                                        </div>
                                    )}
                                    {activeModal === 'INITIAL' && method === 'Ice Bath' && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                                            <Snowflake size={14} className="text-blue-600 shrink-0" />
                                            <span className="text-[10px] font-bold text-blue-700">Standard: Within first 2 hrs temp must be <span className="font-black">&lt; 21.0°C</span> — If ≤ 4.0°C, cooling is complete</span>
                                        </div>
                                    )}
                                    {activeModal === 'STAGE_1' && selectedEntry?.method === 'Ice Bath' && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                                            <AlertCircle size={14} className="text-amber-600 shrink-0" />
                                            <span className="text-[10px] font-bold text-amber-700">First 2-hour check: Temp must be <span className="font-black">≤ 21.0°C</span> — If ≤ 4.0°C, process auto-completes. If &gt; 21.0°C, <span className="font-black text-rose-600">REHEAT immediately</span></span>
                                        </div>
                                    )}
                                    {activeModal === 'STAGE_1' && selectedEntry?.method === 'Blast Chiller' && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-xl">
                                            <Wind size={14} className="text-cyan-600 shrink-0" />
                                            <span className="text-[10px] font-bold text-cyan-700">Blast Chiller: Cooling must complete within <span className="font-black">90 minutes</span> of start</span>
                                        </div>
                                    )}
                                    {activeModal === 'FINAL' && selectedEntry?.method === 'Ice Bath' && (
                                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                                            <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                            <span className="text-[10px] font-bold text-rose-700">Second 2-hour check: Temp must be <span className="font-black">≤ 4.0°C</span> — If &gt; 4.0°C, product must be <span className="font-black">DISCARDED</span></span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><MessageSquare size={14} className="text-indigo-500" /> Operational Remarks</label><textarea className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-indigo-400 outline-none resize-none h-24 shadow-inner" placeholder="Enter findings..." value={stageComments} onChange={e => setStageComments(e.target.value)} /></div>
                                <SignaturePad onSave={setSignature} label="Lead Operator Authority Signature" />
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe"><button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[11px] font-black uppercase text-slate-400 hover:text-rose-600 transition-all bg-slate-50 rounded-xl order-2 md:order-1">Discard</button><button disabled={!tempInput || !signature} onClick={commitStageUpdate} className={`px-16 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-[0.98] order-1 md:order-2 ${tempInput && signature ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-100 text-slate-200 cursor-not-allowed'}`}>Commit Telemetry</button></div>
                    </div>
                </div>
            )}

            {(activeModal === 'VERIFY' || activeModal === 'BULK_VERIFY') && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-emerald-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <ShieldCheck size={32} strokeWidth={3} />
                                <div><h3 className="text-xl font-black uppercase tracking-tight">Authority Verification</h3><p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1">Registry Validation Sync ({activeModal === 'BULK_VERIFY' ? selectedIds.size : '1'} Record)</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} strokeWidth={3} /></button>
                        </div>
                        <div className="p-10 space-y-8 bg-slate-50/20 text-left overflow-y-auto max-h-[60vh] custom-scrollbar">
                            {!selectedEntry && activeModal === 'BULK_VERIFY' && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {Array.from(selectedIds).map(id => {
                                        const e = entries.find(x => x.uuid === id);
                                        return <span key={id} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-800 uppercase shadow-sm">{e?.productName}</span>
                                    })}
                                </div>
                            )}
                            {selectedEntry && (
                                <div className="bg-white border-2 border-emerald-100 p-6 rounded-3xl shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Process Node</p>
                                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">{selectedEntry.productName}</h4>
                                    <p className="text-[10px] font-mono font-bold text-emerald-600 mt-2 uppercase bg-emerald-50 px-2 py-0.5 rounded w-fit">#{selectedEntry.batchNumber}</p>
                                </div>
                            )}
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verification Audit Notes</label><textarea className="w-full h-32 p-5 bg-white border-2 border-slate-100 rounded-3xl text-sm font-medium outline-none focus:border-emerald-500 shadow-inner resize-none transition-all" placeholder="Enter findings or feedback..." value={verificationComments} onChange={e => setVerificationComments(e.target.value)} /></div>
                            <SignaturePad onSave={setVerificationSignature} initialData={verificationSignature} label="QA Verifier Authority Signature" />
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 pb-safe"><button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest order-2 sm:order-1 transition-colors">Cancel</button><button disabled={!verificationSignature} onClick={commitStageUpdate} className={`px-16 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 order-1 sm:order-2 ${verificationSignature ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-100 text-slate-200 cursor-not-allowed'}`}>Finalize Authorization</button></div>
                    </div>
                </div>
            )}

            {activeModal === 'ISSUE' && selectedEntry && (
                <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 h-[90vh] sm:h-auto sm:max-h-[90vh]">
                        <div className="sm:hidden w-full flex justify-center pt-3 pb-1 bg-[#0f172a]"><div className="w-12 h-1.5 bg-white/20 rounded-full" /></div>
                        <div className="px-10 py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Split size={24}/></div>
                                <div><h3 className="text-xl font-black uppercase tracking-tight">Cooled Batch Assignment</h3><p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Split Purpose Logic</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} strokeWidth={3} /></button>
                        </div>
                        <div className="p-8 space-y-6 text-left flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
                            <div className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Production Registry</p>
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate leading-none">{selectedEntry.productName}</h4>
                                <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-100">
                                    <div><p className="text-[8px] font-black text-slate-400 uppercase">Available Weight</p><p className="text-xl font-black text-indigo-600">{selectedEntry.remainingQuantity.toFixed(1)} {selectedEntry.storedUnit}</p></div>
                                    <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">Total Intake</p><p className="text-sm font-bold text-slate-800">{selectedEntry.quantity} {selectedEntry.storedUnit}</p></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {stagedIssuances.map((s, idx) => (
                                    <div key={s.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 space-y-4 relative group/s animate-in slide-in-from-left-2">
                                        {stagedIssuances.length > 1 && <button onClick={() => setStagedIssuances(stagedIssuances.filter(x => x.id !== s.id))} className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Purpose</label><select className="w-full h-12 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:border-indigo-400 appearance-none cursor-pointer" value={s.purpose} onChange={e => setStagedIssuances(stagedIssuances.map(x => x.id === s.id ? { ...x, purpose: e.target.value } : x))}>{PURPOSES.map(p => <option key={p}>{p}</option>)}</select></div>
                                            <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity ({selectedEntry.storedUnit})</label><input type="number" step="0.1" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-indigo-500" placeholder="0.0" value={s.quantity} onChange={e => setStagedIssuances(stagedIssuances.map(x => x.id === s.id ? { ...x, quantity: e.target.value } : x))} /></div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => setStagedIssuances([...stagedIssuances, { id: Date.now().toString(), quantity: "", purpose: PURPOSES[0] }])} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-3xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest"><PlusCircle size={18} /> Add Another Distribution</button>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe"><button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest order-2 sm:order-1 transition-colors">Discard</button><button onClick={handleIssueCooledFood} className="px-16 py-4 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] order-1 md:order-2 flex items-center justify-center gap-3">Commit Portioning</button></div>
                    </div>
                </div>
            )}

            {coolTempWarning && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-2 animate-in zoom-in-95 ${coolTempWarning.type === 'discard' ? 'border-rose-300' : coolTempWarning.type === 'reheat' ? 'border-amber-300' : 'border-cyan-300'}`}>
                        <div className={`px-8 py-7 flex items-center gap-4 ${coolTempWarning.type === 'discard' ? 'bg-rose-600' : coolTempWarning.type === 'reheat' ? 'bg-amber-500' : 'bg-cyan-600'} text-white`}>
                            <div className="p-3 bg-white/20 rounded-2xl">
                                {coolTempWarning.type === 'discard' ? <XCircle size={28} strokeWidth={3} /> : coolTempWarning.type === 'reheat' ? <Flame size={28} strokeWidth={3} /> : <Wind size={28} strokeWidth={3} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    {coolTempWarning.type === 'blast_low' && 'Temperature Too Low'}
                                    {coolTempWarning.type === 'reheat' && 'Reheat Immediately'}
                                    {coolTempWarning.type === 'discard' && 'Product Must Be Discarded'}
                                </h3>
                                <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mt-0.5">Critical Food Safety Alert</p>
                            </div>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="flex items-center justify-center">
                                <div className={`text-5xl font-black ${coolTempWarning.type === 'discard' ? 'text-rose-600' : coolTempWarning.type === 'reheat' ? 'text-amber-600' : 'text-cyan-600'}`}>
                                    {coolTempWarning.temp.toFixed(1)}°C
                                </div>
                            </div>
                            <div className={`p-4 rounded-2xl text-sm font-bold leading-relaxed ${coolTempWarning.type === 'discard' ? 'bg-rose-50 text-rose-800 border border-rose-200' : coolTempWarning.type === 'reheat' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'}`}>
                                {coolTempWarning.type === 'blast_low' && (
                                    <>Blast Chiller initial temperature must be <span className="font-black">greater than 65.0°C</span>. The recorded temperature of {coolTempWarning.temp.toFixed(1)}°C does not meet the standard. Please ensure the product is above 65°C before starting the blast chilling process.</>
                                )}
                                {coolTempWarning.type === 'reheat' && (
                                    <>Ice Bath first 2-hour check shows temperature <span className="font-black">above 21.0°C</span>. The product at {coolTempWarning.temp.toFixed(1)}°C has failed to cool adequately. <span className="font-black text-rose-700">Product must be reheated immediately for consumption.</span> Do not continue the cooling process.</>
                                )}
                                {coolTempWarning.type === 'discard' && (
                                    <>Ice Bath second 2-hour check shows temperature <span className="font-black">above 4.0°C</span>. The product at {coolTempWarning.temp.toFixed(1)}°C has not reached the safe storage target within the allowed time. <span className="font-black">This product must be discarded immediately.</span> It cannot be served or stored.</>
                                )}
                            </div>
                            {selectedEntry && (
                                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <Package size={16} className="text-slate-400 shrink-0" />
                                    <div>
                                        <p className="text-xs font-black text-slate-800 uppercase truncate">{selectedEntry.productName}</p>
                                        <p className="text-[10px] font-mono text-slate-500">#{selectedEntry.batchNumber}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setCoolTempWarning(null)} className={`px-10 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all text-white ${coolTempWarning.type === 'discard' ? 'bg-rose-600 hover:bg-rose-700' : coolTempWarning.type === 'reheat' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                                Acknowledged
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoolingRecord;