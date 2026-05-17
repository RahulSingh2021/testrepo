"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    Truck, 
    Plus, 
    Search, 
    ShieldCheck, 
    Clock, 
    CheckCheck, 
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Thermometer,
    X,
    CheckCircle2,
    User,
    Hash,
    PenTool,
    Package,
    ClipboardCheck,
    Signature,
    Camera,
    Check,
    Eraser,
    Trash2,
    Warehouse,
    ClipboardList,
    Shield as ShieldIcon,
    Timer,
    UserCheck,
    Loader2,
    Layers,
    Calendar,
    Globe,
    SlidersHorizontal,
    Activity,
    ChevronsLeft,
    ChevronsRight,
    GitPullRequest,
    Link as LinkIcon,
    CheckSquare,
    Info,
    Tag,
    Filter,
    FileText,
    Star,
    FileSearch,
    FileDigit,
    MapPin,
    AlertCircle,
    ImageIcon,
    Zap,
    Download,
    TrendingUp,
    FileUp,
    AlertTriangle,
    MoreVertical,
    Edit3,
    FileEdit,
    ExternalLink,
    Save,
    QrCode,
    MessageSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ReceivingEntry, Supplier, RawMaterial, MaterialBrand, Entity, HierarchyScope } from '../types';
import { renderToString } from 'react-dom/server';
import { compressImage } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { drawPdfHeader, resolveEntityLogoSrc } from '@/utils/pdfHeader';
import UnifiedPagination from './UnifiedPagination';
import PendingReviewTab from './PendingReviewTab';


// --- ISO 22000 Types ---
interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

// --- Global Helpers ---

const createEmptyMaterialItem = () => ({
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    materialName: "",
    brand: "",
    batchNo: "",
    mfgDate: "",
    expDate: "",
    orderedQty: "",
    receivedQty: "",
    unit: "KG",
    temperature: "",
    tempImage: null,
    coaFiles: [],
    selectedCoaId: null,
    hasCoa: false,
    discrepancyType: "Shortfall", 
    shortfallReason: "",
    correctiveAction: "",
    shelfLifeStr: "",
    storageType: "" 
});

const calculateShelfLife = (mfgDateStr: string, expiryDateStr: string) => {
    if (!mfgDateStr || !expiryDateStr) return { days: 0, hours: 0, percentage: 0 };
    const start = new Date(mfgDateStr + 'T00:00:00');
    const end = new Date(expiryDateStr + 'T23:59:59');
    const now = new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { days: -1, hours: 0, percentage: 0 };
    const totalMs = end.getTime() - start.getTime(); 
    const remainingMs = end.getTime() - now.getTime(); 
    if (remainingMs <= 0) return { days: 0, hours: 0, percentage: 0 };
    const days = Math.floor(remainingMs / (24 * 3600000));
    const hours = Math.floor((remainingMs % (24 * 3600000)) / 3600000);
    const percentage = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;
    return { days, hours, percentage };
};

const addDurationToDate = (startDateStr: string, shelfLifeStr: string): string => {
    if (!startDateStr || !shelfLifeStr || shelfLifeStr === '-' || shelfLifeStr === 'None') return '';
    try {
        const date = new Date(startDateStr + 'T00:00:00');
        if (isNaN(date.getTime())) return '';
        const daysMatch = shelfLifeStr.match(/(\d+)\s*Days/i);
        const hoursMatch = shelfLifeStr.match(/(\d+)\s*Hours/i);
        const days = daysMatch ? parseInt(daysMatch[1]) : 0;
        const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
        if (days === 0 && hours === 0) return '';
        date.setHours(date.getHours() + (days * 24) + hours);
        return date.toISOString().split('T')[0];
    } catch (e) { return ''; }
};

// --- Sub-Components ---

const SignaturePad: React.FC<{ onCapture: (data: string) => void, onClear: () => void, initialData?: string }> = ({ onCapture, onClear, initialData }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current?.querySelector('canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (initialData) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0);
            img.src = initialData;
        }
    }, [initialData]);

    const startDrawing = (e: any) => {
        setIsDrawing(true);
        const canvas = canvasRef.current?.querySelector('canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx?.beginPath(); ctx?.moveTo(x, y);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current?.querySelector('canvas');
        const ctx = canvas?.getContext('2d');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx?.lineTo(x, y); ctx?.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current?.querySelector('canvas');
        if (canvas) { compressImage(canvas.toDataURL()).then(compressed => onCapture(compressed)); }
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <PenTool size={12} /> Digital Signature
                </label>
                <button type="button" onClick={() => {
                    const canvas = canvasRef.current?.querySelector('canvas');
                    const ctx = canvas.getContext('2d');
                    if (canvas) ctx?.clearRect(0, 0, canvas.width, canvas.height);
                    onClear();
                }} className="text-[9px] font-black text-rose-500 hover:underline flex items-center gap-1"><Eraser size={10} /> Reset</button>
            </div>
            <div ref={canvasRef} className="w-full h-24 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas width={500} height={96} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw} />
                {!isDrawing && !initialData && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <span className="text-3xl font-black uppercase -rotate-12 select-none tracking-tighter">Sign to verify</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface SearchSelectProps {
    label: string;
    options: string[];
    value: string;
    onChange: (val: string) => void;
    icon?: React.ReactNode;
    placeholder?: string;
    required?: boolean;
    secondaryLabels?: Record<string, string>;
}

const SearchSelect: React.FC<SearchSelectProps> = ({ label, options, value, onChange, icon, placeholder, required, secondaryLabels }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(search.toLowerCase())), [options, search]);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    return (
        <div className="relative" ref={containerRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block mb-2">{label} {required && <span className="text-rose-500">*</span>}</label>
            <div onClick={() => setIsOpen(!isOpen)} className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black focus:outline-none flex justify-between items-center cursor-pointer hover:border-indigo-400 transition-all shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <div className="text-slate-300">{icon}</div>}
                    <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-300'}`}>{value || placeholder || `Select ${label}...`}</span>
                </div>
                <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:right-0 sm:bottom-auto mt-0 sm:mt-2 bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-bottom sm:slide-in-from-top-2 duration-150 flex flex-col max-h-[60vh] sm:max-h-72">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0">
                        <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input autoFocus className="w-full pl-8 pr-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-blue-400 shadow-inner" placeholder={`Search ${label.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} /></div>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                        {filtered.length > 0 ? filtered.map(opt => (
                            <div key={opt} onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }} className="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group transition-colors rounded-xl">
                                <div className="min-w-0 flex flex-col"><span className="text-xs font-black text-slate-800 uppercase group-hover:text-indigo-600 truncate">{opt}</span>{secondaryLabels?.[opt] && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate">{secondaryLabels[opt]}</span>}</div>
                                {value === opt && <Check size={14} className="text-indigo-600" />}
                            </div>
                        )) : <div className="px-5 py-4 text-center text-xs font-bold text-slate-300 uppercase">No results found</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ReceivingCardProps {
    entry: ReceivingEntry;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    isExpanded: boolean;
    onToggle: () => void;
    onVerify: () => void;
    onEdit: () => void;
    onDownload: () => void;
}

const ReceivingCard: React.FC<ReceivingCardProps> = ({ entry, index, isSelected, onSelect, isExpanded, onToggle, onVerify, onEdit, onDownload }) => {
    const bsl = calculateShelfLife(entry.mfgDate, entry.expDate);
    const statusColorMap = {
        'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'Partial': 'bg-amber-50 text-amber-700 border-amber-100',
        'Rejected': 'bg-rose-50 text-rose-700 border-rose-100'
    };

    const qrData = useMemo(() => {
        return `REC ID: ${entry.rec}\nBATCH: ${entry.batchNo}\nINV: ${entry.invoiceNo}\nPRODUCT: ${entry.materialName}\nBRAND: ${entry.brand}\nVENDOR: ${entry.vendor}\nQTY ORD: ${entry.orderedQty}\nQTY REC: ${entry.receivedQty}\nUNIT: ${entry.unit}\nTEMP: ${entry.temperature}°C\nCOND: ${entry.condition}\nQC: ${entry.qcStatus}\nSTATUS: ${entry.status}\nRECEIVER: ${entry.receiver}\nVERIFIED: ${entry.verified ? 'YES (' + entry.verifiedBy + ')' : 'PENDING'}`;
    }, [entry]);

    return (
        <div className={`bg-white rounded-[2.5rem] md:rounded-[3rem] border-2 transition-all duration-300 overflow-hidden ${isSelected ? 'border-indigo-600 bg-indigo-50/5 shadow-lg' : 'border-slate-100 hover:border-indigo-200 shadow-sm'} ${entry.verified ? 'opacity-90' : ''}`}>
            
            {/* Desktop Table View Layout */}
            <div className="hidden lg:grid lg:grid-cols-11 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-h-[140px]">
                <div className="p-4 flex flex-col justify-center gap-2 bg-slate-50/30">
                    <div className="flex items-center gap-2">
                        {!entry.verified && (
                            <button onClick={onSelect} className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'}`}>
                                {isSelected && <Check size={12} strokeWidth={4} />}
                            </button>
                        )}
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate leading-none">Unit Alpha</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <MapPin size={10} className="text-slate-300" />
                        <span className="truncate">North America</span>
                    </div>
                    <div className="mt-1 text-[8px] font-mono text-slate-300 font-bold">#{entry.rec}</div>
                </div>

                <div className="p-4 flex flex-col justify-center gap-2 bg-white">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-700"><Calendar size={10} className="text-indigo-400" /> {entry.date}</div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-700"><Clock size={10} className="text-indigo-400" /> {entry.time}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase truncate" title={entry.vendor}>{entry.vendor}</div>
                    <span className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase border ${statusColorMap[entry.status as keyof typeof statusColorMap] || 'bg-slate-50 text-slate-500'}`}>{entry.status}</span>
                </div>

                <div className="p-4 flex flex-col justify-center gap-1.5 bg-slate-50/20">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate leading-tight mb-0.5" title={entry.materialName}>{entry.materialName}</h4>
                    <div className="text-[9px] font-mono font-bold text-slate-400 truncate">Batch: {entry.batchNo}</div>
                    <div className="grid grid-cols-1 gap-0.5 text-[9px] text-slate-500"><div className="flex items-center gap-1">MFG: <span className="text-slate-700 font-bold">{entry.mfgDate}</span></div><div className="flex items-center gap-1">EXP: <span className="text-rose-600 font-bold">{entry.expDate}</span></div></div>
                    {bsl && bsl.days !== -1 && (<div className="text-[8px] font-black text-indigo-600 bg-white border border-indigo-100 px-1.5 py-0.5 rounded uppercase w-fit mt-0.5">Life: {bsl.days}d {bsl.hours}h</div>)}
                </div>

                <div className="p-4 flex flex-col justify-center items-center gap-1.5 bg-white">
                    <div className="w-16 h-16 border-2 border-slate-50 rounded-xl flex items-center justify-center p-1.5 shadow-inner bg-white">
                        <QRCodeSVG value={qrData} size={50} level="H" includeMargin={false} />
                    </div>
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Digital ID</span>
                </div>

                <div className="p-4 flex flex-col justify-center gap-2 bg-slate-50/20">
                    <div className="text-[9px] font-black text-slate-700 truncate leading-none mb-1">INV: {entry.invoiceNo}</div>
                    <div className="text-[8px] font-bold text-slate-400 truncate leading-none mb-2">PO: {entry.poNumber || 'N/A'}</div>
                    <div className="space-y-1">{[{ label: 'Invoice', status: entry.attachments.invoice }, { label: 'Form E', status: entry.attachments.formE }, { label: 'COA Cert', status: entry.attachments.coa }].map((doc, idx) => (<div key={idx} className="flex items-center justify-between gap-2"><span className="text-[8px] font-bold text-slate-400 uppercase">{doc.label}</span><div className="flex items-center gap-1"><span className={`text-[8px] font-black px-1 rounded uppercase ${doc.status ? 'text-emerald-600' : 'text-slate-300'}`}>{doc.status ? 'Yes' : 'No'}</span>{doc.status && <button className="p-0.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"><FileSearch size={10} /></button>}</div></div>))}</div>
                </div>

                <div className="p-4 flex flex-col justify-center gap-2 bg-white">
                    <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span className="text-[8px] font-black text-slate-400 uppercase">Ordered</span><span className="text-xs font-black text-slate-700">{entry.orderedQty} <span className="text-[8px] opacity-40">{entry.unit}</span></span></div>
                    <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100"><span className="text-[8px] font-black text-slate-400 uppercase">Accepted</span><span className={`text-xs font-black ${entry.status === 'Partial' ? 'text-amber-600' : 'text-emerald-600'}`}>{entry.receivedQty} <span className="text-[8px] opacity-40">{entry.unit}</span></span></div>
                </div>

                <div className="p-4 flex flex-col justify-center items-center gap-2 bg-slate-50/20">
                    <div className="flex flex-col items-center"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Temp</span><div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"><Thermometer size={10} className="text-blue-500" /><span className="text-xs font-black text-blue-700 font-mono leading-none">{entry.temperature}°C</span></div></div>
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center relative cursor-pointer hover:border-indigo-400 transition-all shadow-inner">{entry.tempImageSrc ? <img src={entry.tempImageSrc} className="w-full h-full object-cover" onClick={() => window.open(entry.tempImageSrc)} /> : <ImageIcon size={18} className="text-slate-200" />}</div>
                </div>

                <div className="p-4 flex flex-col justify-center items-center gap-2 bg-white">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Eval Score</span>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black border shadow-inner ${entry.vendorEval >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{entry.vendorEval}%</div>
                </div>

                <div className="p-4 flex flex-col justify-center gap-3 bg-slate-50/20">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-2">Receiver</span>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-inner"><User size={12} className="text-slate-300" /></div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[9px] font-black text-slate-800 uppercase truncate leading-none">{entry.receiver}</p>
                            </div>
                        </div>
                        {entry.receiverSignature && (
                            <div className="h-16 w-full bg-white rounded-xl border border-slate-100 p-1.5 flex items-center justify-center overflow-hidden shadow-xs">
                                <img src={entry.receiverSignature} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 flex flex-col justify-center items-center gap-3 bg-white">
                    {entry.verified ? (
                        <div className="space-y-3 w-full animate-in fade-in duration-300">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white shrink-0"><ShieldCheck size={16} /></div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-800 uppercase truncate leading-none mb-1">{entry.verifiedBy}</p>
                                        <span className="text-[7px] font-bold text-emerald-600 uppercase">Authorized</span>
                                    </div>
                                </div>
                                <button onClick={onDownload} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"><Download size={14}/></button>
                            </div>
                            {entry.signatureData && (
                                <div className="h-14 w-full bg-emerald-50 rounded-xl border border-emerald-100 p-1.5 flex items-center justify-center overflow-hidden">
                                    <img src={entry.signatureData} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                </div>
                            )}
                            {entry.verificationComments && (
                                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Comments</p>
                                    <p className="text-[9px] font-semibold text-slate-700 leading-relaxed">{entry.verificationComments}</p>
                                </div>
                            )}
                            {entry.verificationDate && (
                                <div className="flex items-center gap-1.5 text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                                    <Clock size={9} />
                                    {new Date(entry.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full">
                            <button onClick={onVerify} className="w-full py-2 bg-amber-400 text-amber-900 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-500 active:scale-95 transition-all flex items-center justify-center gap-1.5"><Zap size={10} fill="currentColor" /> Auth Log</button>
                            <div className="flex gap-1">
                                <button onClick={onEdit} className="flex-1 py-1.5 bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all text-center">Edit</button>
                                <button onClick={onDownload} className="p-1.5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg border border-transparent hover:border-slate-200 transition-all"><Download size={12}/></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden flex flex-col">
                <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3 min-w-0">
                        {!entry.verified && (
                            <button onClick={onSelect} className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white/10 border-white/20'}`}>
                                {isSelected && <Check size={12} strokeWidth={4} />}
                            </button>
                        )}
                        <div className="min-w-0">
                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block truncate">{entry.vendor}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] font-mono text-white/50">#{entry.rec}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${entry.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : entry.status === 'Partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>{entry.status}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={onDownload} className="p-1.5 bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"><Download size={14}/></button>
                        <button onClick={onEdit} className="p-1.5 bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"><FileEdit size={14} /></button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <Calendar size={11} className="text-slate-400" />
                        <span className="font-black text-slate-800">{entry.date}</span>
                        <span className="text-slate-300">|</span>
                        <Clock size={11} className="text-slate-400" />
                        <span className="font-black text-slate-800">{entry.time}</span>
                    </div>

                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase leading-tight">{entry.materialName}</h4>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase mt-0.5">{entry.brand}</p>
                    </div>

                    <button onClick={onToggle} className="w-full flex items-center justify-between py-2 px-3 bg-slate-100 rounded-xl border border-slate-200 active:scale-[0.98] transition-all">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Batch</span>
                            <span className="text-[10px] font-black text-slate-800 font-mono">{entry.batchNo}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Shelf Life</span>
                            <span className="text-[10px] font-black text-indigo-600">{bsl.days}d {bsl.hours}h</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Ordered</span>
                            <span className="text-xs font-black text-slate-800">{entry.orderedQty} <span className="text-[8px] text-slate-400">{entry.unit}</span></span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">Received</span>
                            <span className={`text-xs font-black ${entry.status === 'Partial' ? 'text-amber-600' : 'text-emerald-600'}`}>{entry.receivedQty} <span className="text-[8px] opacity-50">{entry.unit}</span></span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">MFG Date</span>
                            <span className="text-[10px] font-black text-slate-800">{entry.mfgDate}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                            <span className="text-[7px] font-black text-slate-400 uppercase block mb-1">EXP Date</span>
                            <span className="text-[10px] font-black text-rose-600">{entry.expDate}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-blue-50 rounded-xl p-2.5 border border-blue-100 flex items-center gap-2">
                            <Thermometer size={14} className="text-blue-500 shrink-0" />
                            <div>
                                <span className="text-[7px] font-black text-blue-400 uppercase block">Temperature</span>
                                <span className="text-sm font-black text-blue-700 font-mono">{entry.temperature}°C</span>
                            </div>
                        </div>
                        {entry.tempImageSrc && (
                            <div className="w-16 h-16 rounded-xl border-2 border-blue-100 overflow-hidden shrink-0 shadow-sm">
                                <img src={entry.tempImageSrc} className="w-full h-full object-cover" onClick={() => entry.tempImageSrc && window.open(entry.tempImageSrc)} />
                            </div>
                        )}
                        <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-black border shadow-inner ${(entry.vendorEval || 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>{entry.vendorEval}%</div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[7px] font-black text-slate-400 uppercase mr-1">Docs:</span>
                        {[{ label: 'INV', ok: entry.attachments.invoice }, { label: 'Form E', ok: entry.attachments.formE }, { label: 'COA', ok: entry.attachments.coa }].map((d, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${d.ok ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>{d.label}: {d.ok ? 'Yes' : 'No'}</span>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-[8px] text-slate-400">
                        <span className="font-black uppercase">INV: {entry.invoiceNo}</span>
                        {entry.poNumber && <><span className="text-slate-200">|</span><span className="font-black uppercase">PO: {entry.poNumber}</span></>}
                    </div>

                    {entry.correctiveAction && (
                        <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                            <span className="text-[7px] font-black text-amber-500 uppercase block mb-1">Corrective Action</span>
                            <p className="text-[10px] font-bold text-amber-800">{entry.correctiveAction}</p>
                        </div>
                    )}

                    <div className="bg-indigo-900 text-white rounded-2xl p-4 flex items-center gap-3 shadow-lg">
                        <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-inner shrink-0 flex items-center justify-center">
                            <QRCodeSVG value={qrData} size={48} level="H" includeMargin={false} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.15em]">Digital Identity Passport</p>
                            <p className="text-xs font-bold leading-tight mt-0.5">Complete Product Metadata</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-200 shrink-0"><User size={14} className="text-slate-300" /></div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[7px] font-black text-slate-400 uppercase block">Operator / Receiver</span>
                                <span className="text-[10px] font-black text-slate-800 uppercase truncate block">{entry.receiver}</span>
                            </div>
                        </div>
                        {entry.receiverSignature && (
                            <div className="h-14 w-full bg-white rounded-xl border border-slate-100 p-1.5 flex items-center justify-center overflow-hidden">
                                <img src={entry.receiverSignature} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                            </div>
                        )}
                    </div>
                    </div>
                    )}
                </div>

                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    {!entry.verified ? (
                        <div className="flex gap-2">
                            <button onClick={onVerify} className="flex-[2] py-3.5 bg-amber-400 text-amber-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <Zap size={12} fill="currentColor" /> Verify
                            </button>
                            <button onClick={onEdit} className="flex-1 py-3.5 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <FileEdit size={14} /> Edit
                            </button>
                        </div>
                    ) : (
                        <div className="w-full space-y-3">
                            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shrink-0"><ShieldCheck size={14} /></div>
                                    <div>
                                        <span className="text-[9px] font-black text-emerald-700 uppercase block">{entry.verifiedBy}</span>
                                        <span className="text-[7px] font-bold text-emerald-500">Authorized</span>
                                    </div>
                                </div>
                            </div>
                            {entry.signatureData && (
                                <div className="h-14 w-full bg-emerald-50 rounded-xl border border-emerald-100 p-1.5 flex items-center justify-center overflow-hidden">
                                    <img src={entry.signatureData} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                </div>
                            )}
                            {entry.verificationComments && (
                                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Comments</p>
                                    <p className="text-[9px] font-semibold text-slate-700 leading-relaxed">{entry.verificationComments}</p>
                                </div>
                            )}
                            {entry.verificationDate && (
                                <div className="flex items-center gap-1.5 text-[7px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                    <Clock size={9} />
                                    {new Date(entry.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

interface ReceivingRegisterProps {
  suppliers?: Supplier[];
  rawMaterials?: RawMaterial[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  entities?: Entity[];
}

const isDescendant = (ancestorId: string, potentialDescendantId: string, allEntities: Entity[]): boolean => {
  let current = allEntities.find(e => e.id === potentialDescendantId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = allEntities.find(parent => parent.id === current?.parentId);
  }
  return false;
};

const ReceivingRegister: React.FC<ReceivingRegisterProps> = ({ suppliers = [], rawMaterials: propRawMaterials = [], currentScope = 'unit', userRootId, entities = [] }) => {
    const rawMaterials = propRawMaterials;
    const [entries, setEntries] = useState<ReceivingEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [expandedMobileIds, setExpandedMobileIds] = useState<Set<string>>(new Set());
    const [activeFilterDropdown, setActiveFilterDropdown] = useState<'dates' | 'global' | 'status' | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [docFilter, setDocFilter] = useState<{ type: 'coa' | 'formE' | 'invoice', attached: boolean } | null>(null);
    const [dashStatFilter, setDashStatFilter] = useState<'rejections' | 'due' | 'completed' | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [activeRegisterTab, setActiveRegisterTab] = useState<'main' | 'pending-review'>('main');

    // --- ISO 22000 Doc Control State ---
    const [docControlData, setDocControlData] = useState<DocControlInfo>({
        docRef: 'REC-RGST-01',
        version: '4.2',
        effectiveDate: new Date().toISOString().split('T')[0],
        approvedBy: 'Quality Assurance Director'
    });
    const [isDocControlModalOpen, setIsDocControlModalOpen] = useState(false);
    const [tempDocControl, setTempDocControl] = useState<DocControlInfo>(docControlData);

    const dropdownRef = useRef<HTMLDivElement>(null);
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

    const [activeModalSection, setActiveModalSection] = useState<'artifacts' | 'vendorEval' | 'context' | 'authorization' | null>(null);
    const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

    const [dateFilters, setDateFilters] = useState({ receiving: { from: '', to: '' }, mfg: { from: '', to: '' }, exp: { from: '', to: '' } });
    const [globalSearch, setGlobalSearch] = useState({ product: '', vendor: '', brand: '', invoice: '', po: '', reportNo: '' });
    const [metricsFilters, setMetricsFilters] = useState({ status: 'All', tempRange: { from: '', to: '' } });

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setActiveFilterDropdown(null); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/receiving-records');
                if (!res.ok) throw new Error('fetch failed');
                const all: (ReceivingEntry & { unitId?: string })[] = await res.json();
                if (cancelled) return;
                const filtered = all.filter(record => {
                    if (!userRootId) return currentScope === 'super-admin';
                    const recUnit = (record as any).unitId;
                    if (!recUnit) return false;
                    if (currentScope === 'unit' || currentScope === 'department') return recUnit === userRootId || (entities.find(e => e.id === userRootId)?.parentId && recUnit === entities.find(e => e.id === userRootId)?.parentId);
                    if (currentScope === 'corporate' || currentScope === 'regional') return isDescendant(userRootId, recUnit, entities);
                    return false;
                });
                setEntries(filtered);
            } catch (err) {
                console.error('Failed to load receiving records:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userRootId, currentScope, entities]);

    const persistRecord = async (record: ReceivingEntry) => {
        try {
            await fetch('/api/receiving-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });
        } catch (err) {
            console.error('Failed to persist receiving record:', err);
        }
    };

    const persistRecords = async (records: ReceivingEntry[]) => {
        try {
            await fetch('/api/receiving-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(records),
            });
        } catch (err) {
            console.error('Failed to persist receiving records:', err);
        }
    };

    const deleteRecordFromDb = async (id: string) => {
        try {
            await fetch('/api/receiving-records', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
        } catch (err) {
            console.error('Failed to delete receiving record:', err);
        }
    };

    const summaryStats = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayEntries = entries.filter(e => e.date === todayStr);
        const totalMatCount = entries.length;
        
        return {
            todayIntake: todayEntries.length,
            avgDailyIntake: (entries.length / 30).toFixed(1),
            rejectedShortage: entries.filter(e => e.status === 'Rejected' || e.status === 'Partial').length,
            verificationDue: entries.filter(e => !e.verified).length,
            completed: entries.filter(e => e.verified).length,
            totalCoa: entries.filter(e => e.attachments.coa).length,
            totalFormE: entries.filter(e => e.attachments.formE).length,
            totalInvoice: entries.filter(e => e.attachments.invoice).length,
            totalCount: totalMatCount
        };
    }, [entries]);

    const [formData, setFormData] = useState<any>({
        vendor: "", invoiceNo: "", poNumber: "", 
        receiver: "Current Admin", signature: null, 
        invoiceFiles: [], formEFiles: [], coaFiles: [],
        evaluations: { vehicleHygiene: "Yes", tempMaintained: "Yes", personnelHygiene: "Yes", packagingIntegrity: "Yes", sealIntact: "Yes", deliverySchedule: "Yes" },
        items: [createEmptyMaterialItem()]
    });

    const toggleSelectAll = () => {
        const unverifiedVisibleIds = paginatedEntries.filter(e => !e.verified).map(e => e.id);
        if (selectedIds.size === unverifiedVisibleIds.length && unverifiedVisibleIds.length > 0) setSelectedIds(new Set());
        else setSelectedIds(new Set(unverifiedVisibleIds));
    };

    const toggleSelectOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkVerify = () => { if (selectedIds.size > 0) setVerificationModal({ isOpen: true, ids: Array.from(selectedIds), comments: '', signature: '' }); };

    const toggleMainSection = (section: 'artifacts' | 'vendorEval' | 'context' | 'authorization') => setActiveModalSection(activeModalSection === section ? null : section);
    const resetForm = () => {
        setFormData({ vendor: "", invoiceNo: "", poNumber: "", receiver: "Current Admin", signature: null, invoiceFiles: [], formEFiles: [], coaFiles: [], evaluations: { vehicleHygiene: "Yes", tempMaintained: "Yes", personnelHygiene: "Yes", packagingIntegrity: "Yes", sealIntact: "Yes", deliverySchedule: "Yes" }, items: [createEmptyMaterialItem()] });
        setExpandedItemIds(new Set()); setActiveModalSection(null); setEditingEntryId(null);
    };

    const handleUpdateItem = (id: string, field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, items: prev.items.map((item: any) => {
            if (item.id !== id) return item;
            const newItem = { ...item, [field]: value };
            if (field === 'materialName' || field === 'brand' || field === 'mfgDate') {
                const material = rawMaterials.find(rm => rm.name === newItem.materialName);
                if (material) {
                    const brand = material.brands.find(b => b.name === newItem.brand);
                    if (brand) {
                        if (brand.shelfLife && brand.shelfLife !== '-' && brand.shelfLife !== 'None') {
                            if (field === 'brand' || !newItem.shelfLifeStr) {
                                newItem.shelfLifeStr = brand.shelfLife;
                            }
                        }
                        newItem.storageType = brand.storage || "";
                    }
                    if (newItem.mfgDate && newItem.shelfLifeStr) {
                         const calculatedExp = addDurationToDate(newItem.mfgDate, newItem.shelfLifeStr);
                         if (calculatedExp) newItem.expDate = calculatedExp;
                    }
                }
            }
            return newItem;
        }) }));
    };

    const handleAddMaterialItem = () => { const newItem = createEmptyMaterialItem(); setFormData((prev: any) => ({ ...prev, items: [...prev.items, newItem] })); setExpandedItemIds(new Set([newItem.id])); };
    const handleRemoveMaterialItem = (id: string) => { if (formData.items.length <= 1) return; setFormData((prev: any) => ({ ...prev, items: prev.items.filter((item: any) => item.id !== id) })); };

    const [verificationModal, setVerificationModal] = useState<{ isOpen: boolean; ids: string[]; comments: string; signature: string; }>({ isOpen: false, ids: [], comments: '', signature: '' });

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const basicMatch = !searchTerm || [e.materialName, e.vendor, e.rec].some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
            if (!basicMatch) return false;
            const checkDate = (val: string, range: { from: string, to: string }) => {
                if (!range.from && !range.to) return true;
                const dateVal = new Date(val);
                if (range.from && dateVal < new Date(range.from)) return false;
                if (range.to && dateVal > new Date(range.to)) return false;
                return true;
            };
            if (!checkDate(e.date, dateFilters.receiving)) return false;
            if (globalSearch.product && !e.materialName.toLowerCase().includes(globalSearch.product.toLowerCase())) return false;
            if (metricsFilters.status !== 'All' && e.status !== metricsFilters.status) return false;
            
            if (docFilter) {
                if (docFilter.type === 'coa' && e.attachments.coa !== docFilter.attached) return false;
                if (docFilter.type === 'formE' && e.attachments.formE !== docFilter.attached) return false;
                if (docFilter.type === 'invoice' && e.attachments.invoice !== docFilter.attached) return false;
            }

            if (dashStatFilter) {
                if (dashStatFilter === 'rejections' && e.status !== 'Rejected' && e.status !== 'Partial') return false;
                if (dashStatFilter === 'due' && e.verified) return false;
                if (dashStatFilter === 'completed' && !e.verified) return false;
            }

            return true;
        });
    }, [entries, searchTerm, dateFilters, globalSearch, metricsFilters, docFilter, dashStatFilter]);

    const totalItemsCount = filteredEntries.length;
    const totalPages = Math.ceil(totalItemsCount / rowsPerPage);
    const paginatedEntries = useMemo(() => filteredEntries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage), [filteredEntries, currentPage, rowsPerPage]);

    const handleQuickSave = () => {
        if (formData.items.some((item: any) => !item.materialName || !item.brand)) return;
        const evals = formData.evaluations;
        const totalPoints = Object.keys(evals).length;
        const scorePoints = Object.values(evals).filter(v => v === 'Yes').length;
        const calculatedScore = Math.round((scorePoints / totalPoints) * 100);
        const now = new Date();
        const autoDate = now.toISOString().split('T')[0];
        const autoTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        
        if (editingEntryId) {
            const entry = entries.find(e => e.id === editingEntryId)!;
            const item = formData.items[0];
            const updatedEntry: ReceivingEntry = { 
                ...entry, 
                vendor: formData.vendor, 
                invoiceNo: formData.invoiceNo, 
                poNumber: formData.poNumber, 
                materialName: item.materialName, 
                brand: item.brand, 
                batchNo: item.batchNo, 
                orderedQty: Number(item.orderedQty), 
                receivedQty: Number(item.receivedQty), 
                unit: item.unit, 
                mfgDate: item.mfgDate, 
                expDate: item.expDate, 
                temperature: item.temperature, 
                status: (Number(item.receivedQty) >= Number(item.orderedQty)) ? 'Approved' : 'Partial', 
                discrepancyType: item.discrepancyType,
                rejectionRemarks: item.shortfallReason,
                correctiveAction: item.correctiveAction,
                tempImageSrc: item.tempImage || entry.tempImageSrc,
                vendorEval: calculatedScore,
                receiverSignature: formData.signature || entry.receiverSignature 
            };
            setEntries(prev => prev.map(e => e.id === editingEntryId ? updatedEntry : e));
            persistRecord(updatedEntry);
        } else {
            const effectiveUnitId = userRootId || '';
            const newEntries: ReceivingEntry[] = formData.items.map((item: any) => ({ 
                id: `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                rec: `REC-${Math.floor(Math.random() * 90000) + 10000}`, 
                date: autoDate, 
                time: autoTime, 
                materialName: item.materialName, 
                brand: item.brand, 
                vendor: formData.vendor, 
                invoiceNo: formData.invoiceNo, 
                poNumber: formData.poNumber, 
                batchNo: item.batchNo, 
                orderedQty: Number(item.orderedQty), 
                receivedQty: Number(item.receivedQty), 
                unit: item.unit, 
                mfgDate: item.mfgDate, 
                expDate: item.expDate, 
                temperature: item.temperature, 
                tempImageSrc: item.tempImage,
                condition: 'Good', 
                qcStatus: 'Verified', 
                status: (Number(item.receivedQty) >= Number(item.orderedQty)) ? 'Approved' : 'Partial', 
                discrepancyType: item.discrepancyType,
                rejectionRemarks: item.shortfallReason,
                correctiveAction: item.correctiveAction,
                receiver: formData.receiver, 
                receiverSignature: formData.signature,
                verified: false, 
                vendorEval: calculatedScore, 
                unitId: effectiveUnitId,
                attachments: { 
                    formE: formData.formEFiles.length > 0, 
                    invoice: !!formData.invoiceNo || formData.invoiceFiles.length > 0, 
                    coa: (item.coaFiles?.length || 0) > 0 || !!item.selectedCoaId
                } 
            }));
            setEntries(prev => [...newEntries, ...prev]);
            persistRecords(newEntries);
        }
        setIsModalOpen(false); resetForm();
    };

    const handleEdit = (entry: ReceivingEntry) => {
        setEditingEntryId(entry.id);
        setFormData({ 
            vendor: entry.vendor, 
            invoiceNo: entry.invoiceNo, 
            poNumber: entry.poNumber || "", 
            receiver: entry.receiver, 
            signature: entry.receiverSignature,
            items: [{ 
                id: `item-edit-${entry.id}`, 
                materialName: entry.materialName, 
                brand: entry.brand, 
                batchNo: entry.batchNo, 
                mfgDate: entry.mfgDate, 
                expDate: entry.expDate, 
                orderedQty: entry.orderedQty.toString(), 
                receivedQty: entry.receivedQty.toString(), 
                unit: entry.unit, 
                temperature: entry.temperature || "N/A",
                discrepancyType: entry.discrepancyType || "Shortfall",
                shortfallReason: entry.rejectionRemarks || "",
                correctiveAction: entry.correctiveAction || "",
                tempImage: entry.tempImageSrc || null
            }], 
            evaluations: { vehicleHygiene: "Yes", tempMaintained: "Yes", personnelHygiene: "Yes", packagingIntegrity: "Yes", sealIntact: "Yes", deliverySchedule: "Yes" } 
        });
        setActiveModalSection('context'); setIsModalOpen(true);
    };

    const handleVerifySubmit = () => {
        const { ids, signature } = verificationModal;
        if (!signature) { alert("Signature required."); return; }
        const verificationTimestamp = new Date().toISOString();
        const updatedRecords: ReceivingEntry[] = [];
        setEntries(prev => prev.map(e => {
            if (ids.includes(e.id)) {
                const updated = { ...e, verified: true, verifiedBy: 'QA Manager', signatureData: signature, verificationComments: verificationModal.comments, verificationDate: verificationTimestamp };
                updatedRecords.push(updated);
                return updated;
            }
            return e;
        }));
        if (updatedRecords.length > 0) persistRecords(updatedRecords);
        setVerificationModal({ isOpen: false, ids: [], comments: '', signature: '' });
        setSelectedIds(new Set());
    };

    const handleDocFilter = (type: 'coa' | 'formE' | 'invoice', attached: boolean) => {
        if (docFilter?.type === type && docFilter?.attached === attached) {
            setDocFilter(null);
        } else {
            setDocFilter({ type, attached });
        }
        setCurrentPage(1);
    };

    const handleDashStatFilter = (stat: 'rejections' | 'due' | 'completed' | null) => {
        if (dashStatFilter === stat) setDashStatFilter(null);
        else setDashStatFilter(stat);
        setCurrentPage(1);
    };

    const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const compressed = await compressImage(event.target?.result as string);
                handleUpdateItem(itemId, 'tempImage', compressed);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEditDocControl = () => {
        setTempDocControl({ ...docControlData });
        setIsDocControlModalOpen(true);
    };

    const handleSaveDocControl = () => {
        setDocControlData(tempDocControl);
        setIsDocControlModalOpen(false);
    };

    const buildRecordQRUrl = (e: ReceivingEntry): string => {
        const data: Record<string, unknown> = {
            r: e.rec, v: e.vendor, d: e.date, t: e.time,
            i: e.invoiceNo, m: e.materialName, br: e.brand, b: e.batchNo,
            md: e.mfgDate, ed: e.expDate,
            oq: e.orderedQty, rq: e.receivedQty, u: e.unit,
            tp: e.temperature, s: e.status,
            rc: e.receiver, vf: e.verified ? 1 : 0,
        };
        if (e.poNumber) data.po = e.poNumber;
        if (e.condition) data.cn = e.condition;
        if (e.qcStatus) data.qc = e.qcStatus;
        if (e.vendorEval) data.ve = e.vendorEval;
        if (e.verifiedBy) data.vb = e.verifiedBy;
        if (e.verificationComments) data.vc = e.verificationComments;
        if (e.verificationDate) data.vd = e.verificationDate;
        if (e.correctiveAction) data.ca = e.correctiveAction;
        if (e.rejectionRemarks) data.rr = e.rejectionRemarks;
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/record?d=${encoded}`;
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
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                ctx?.drawImage(img, 0, 0, 400, 400);
                const dataUrl = canvas.toDataURL('image/png');
                document.body.removeChild(container);
                resolve(dataUrl);
            };
            img.onerror = () => { document.body.removeChild(container); resolve(''); };
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            img.src = URL.createObjectURL(svgBlob);
        });
    };

    const generatePDFForEntries = async (targetEntries: ReceivingEntry[], filename: string) => {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 30, mr = 30, mt = 30, mb = 40;
        const cw = pw - ml - mr;
        let y = mt;
        let pageNum = 1;

        const securityId = `CERT-REC-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const downloadTimestamp = new Date().toLocaleString();

        const colWidths = [cw * 0.11, cw * 0.15, cw * 0.15, cw * 0.11, cw * 0.09, cw * 0.14, cw * 0.25];
        const colX = [ml];
        for (let i = 1; i < 7; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
        const colHeaders = ['UNIT DETAILS', 'REGISTRY IDENTITY', 'PRODUCT ANALYSIS', 'QUANTITIES', 'TELEMETRY', 'QR PASSPORT', 'AUTHORIZATION'];

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
            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'RAW MATERIAL RECEIVING REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData, compact: true });
        };

        const drawTableHeader = () => {
            pdf.setFillColor(30, 41, 59);
            pdf.rect(ml, y, cw, 18, 'F');
            pdf.setFontSize(6);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            for (let i = 0; i < 7; i++) {
                pdf.text(colHeaders[i], colX[i] + 5, y + 12);
            }
            pdf.setDrawColor(100, 116, 139);
            pdf.setLineWidth(0.3);
            for (let i = 1; i < 7; i++) {
                pdf.line(colX[i], y + 3, colX[i], y + 15);
            }
            y += 18;
        };

        const drawTableRow = async (e: ReceivingEntry, rowIdx: number) => {
            const hasTempImg = !!e.tempImageSrc;
            const hasVerification = e.verified;
            const rowH = (hasTempImg || hasVerification) ? 85 : 65;

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
            for (let i = 1; i < 7; i++) {
                pdf.line(colX[i], ry, colX[i], ry + rowH);
            }

            const cx = (i: number) => colX[i] + 5;
            const fs8 = () => { pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); };
            const fs7 = () => { pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); };
            const fs6 = () => { pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); };

            // COL 0: UNIT DETAILS
            fs6();
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text('DEPARTMENT', cx(0), ry + 10);
            pdf.setFontSize(6.5);
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Receiving', cx(0), ry + 18);

            pdf.setFontSize(5.5);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text('UNIT NAME', cx(0), ry + 28);
            pdf.setFontSize(6);
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Central Kitchen', cx(0), ry + 35);

            pdf.setFontSize(5.5);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text('REGIONAL', cx(0), ry + 45);
            pdf.setFontSize(6);
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'normal');
            pdf.text('Manhattan Hub', cx(0), ry + 52);

            pdf.setFontSize(5.5);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CORPORATE', cx(0), ry + 62);
            pdf.setFontSize(6);
            pdf.setTextColor(79, 70, 229);
            pdf.setFont('helvetica', 'bold');
            pdf.text('HACCP PRO', cx(0), ry + 69);

            // COL 1: REGISTRY IDENTITY
            fs8();
            pdf.setTextColor(15, 23, 42);
            const vendorLines = pdf.splitTextToSize(e.vendor, colWidths[1] - 12);
            pdf.text(vendorLines.slice(0, 2), cx(1), ry + 10);

            fs6();
            pdf.setTextColor(100, 116, 139);
            pdf.text(`${e.date} | ${e.time}`, cx(1), ry + 22);
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`INV: ${e.invoiceNo}`, cx(1), ry + 30);
            if (e.poNumber) { pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100, 116, 139); pdf.text(`PO: ${e.poNumber}`, cx(1), ry + 37); }

            const attY = e.poNumber ? ry + 44 : ry + 38;
            const attW = 28;
            const drawAttBadge = (label: string, attached: boolean, bx: number, by: number) => {
                if (attached) { pdf.setFillColor(220, 252, 231); pdf.setTextColor(5, 150, 105); }
                else { pdf.setFillColor(241, 245, 249); pdf.setTextColor(148, 163, 184); }
                pdf.roundedRect(bx, by, attW, 9, 2, 2, 'F');
                pdf.setFontSize(5); pdf.setFont('helvetica', 'bold');
                pdf.text(label, bx + 3, by + 6.5);
            };
            const att = e.attachments || { invoice: false, formE: false, coa: false };
            drawAttBadge(att.invoice ? 'INV \u2713' : 'INV \u2717', att.invoice, cx(1), attY);
            drawAttBadge(att.formE ? 'FRM E \u2713' : 'FRM E \u2717', att.formE, cx(1) + attW + 3, attY);
            drawAttBadge(att.coa ? 'COA \u2713' : 'COA \u2717', att.coa, cx(1), attY + 11);

            // COL 2: PRODUCT ANALYSIS
            fs8();
            pdf.setTextColor(79, 70, 229);
            const matLines = pdf.splitTextToSize(e.materialName, colWidths[2] - 12);
            pdf.text(matLines.slice(0, 2), cx(2), ry + 10);

            fs6();
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`BATCH: ${e.batchNo}`, cx(2), ry + 24);
            pdf.setTextColor(16, 185, 129);
            pdf.text(`MFG: ${e.mfgDate}`, cx(2), ry + 32);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`EXP: ${e.expDate}`, cx(2), ry + 40);
            if (e.brand) {
                pdf.setTextColor(148, 163, 184);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Brand: ${e.brand}`, cx(2), ry + 48);
            }

            // COL 3: QUANTITIES
            fs7();
            pdf.setTextColor(30, 41, 59);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`ORD: ${e.orderedQty} ${e.unit}`, cx(3), ry + 12);
            pdf.setTextColor(16, 185, 129);
            pdf.text(`ACC: ${e.receivedQty} ${e.unit}`, cx(3), ry + 22);
            if (e.rejectionRemarks) {
                pdf.setFontSize(5);
                pdf.setTextColor(225, 29, 72);
                const remLines = pdf.splitTextToSize(`REM: ${e.rejectionRemarks}`, colWidths[3] - 10);
                pdf.text(remLines.slice(0, 3), cx(3), ry + 32);
            }
            if (e.correctiveAction) {
                pdf.setFontSize(5);
                pdf.setTextColor(180, 83, 9);
                pdf.setFont('helvetica', 'bold');
                const caLines = pdf.splitTextToSize(`CA: ${e.correctiveAction}`, colWidths[3] - 10);
                pdf.text(caLines.slice(0, 2), cx(3), e.rejectionRemarks ? ry + 50 : ry + 32);
            }

            // COL 4: TELEMETRY
            pdf.setFontSize(12);
            pdf.setTextColor(59, 130, 246);
            pdf.setFont('helvetica', 'bold');
            const tempStr = `${e.temperature}°C`;
            pdf.text(tempStr, cx(4) + (colWidths[4] - 10) / 2 - pdf.getTextWidth(tempStr) / 2, ry + 16);
            pdf.setFontSize(6);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            const evalStr = `Eval: ${e.vendorEval}%`;
            pdf.text(evalStr, cx(4) + (colWidths[4] - 10) / 2 - pdf.getTextWidth(evalStr) / 2, ry + 26);
            if (e.condition) {
                pdf.setFontSize(5.5);
                const condStr = e.condition;
                pdf.text(condStr, cx(4) + (colWidths[4] - 10) / 2 - pdf.getTextWidth(condStr) / 2, ry + 34);
            }
            if (hasTempImg) {
                try {
                    let imgData = e.tempImageSrc!;
                    if (!imgData.startsWith('data:')) {
                        const imgResp = await fetch(imgData);
                        const blob = await imgResp.blob();
                        imgData = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                    }
                    const tImgSize = 26;
                    const tImgX = cx(4) + (colWidths[4] - 10) / 2 - tImgSize / 2;
                    const imgFmt = imgData.includes('data:image/png') ? 'PNG' : 'JPEG';
                    pdf.addImage(imgData, imgFmt, tImgX, ry + 38, tImgSize, tImgSize);
                } catch {}
            }

            // COL 5: QR PASSPORT
            const qrString = buildRecordQRUrl(e);
            try {
                const qrDataUrl = await renderQRToCanvas(qrString);
                if (qrDataUrl) {
                    const qrSize = 36;
                    const qrX = cx(5) + (colWidths[5] - 10) / 2 - qrSize / 2;
                    pdf.addImage(qrDataUrl, 'PNG', qrX, ry + 4, qrSize, qrSize);
                    pdf.setFontSize(4.5);
                    pdf.setTextColor(148, 163, 184);
                    pdf.setFont('helvetica', 'bold');
                    const scanText = 'SCAN FOR RECORD';
                    pdf.text(scanText, cx(5) + (colWidths[5] - 10) / 2 - pdf.getTextWidth(scanText) / 2, ry + qrSize + 8);
                }
            } catch {}

            // COL 6: AUTHORIZATION
            const authX = cx(6);
            const authW = colWidths[6] - 10;

            fs6();
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'bold');
            pdf.text('OPERATOR', authX, ry + 8);
            pdf.setFontSize(7);
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'bold');
            pdf.text(e.receiver || 'N/A', authX, ry + 16);

            if (e.receiverSignature) {
                try {
                    let opSigData = e.receiverSignature;
                    if (!opSigData.startsWith('data:')) {
                        const sigResp = await fetch(opSigData);
                        const sigBlob = await sigResp.blob();
                        opSigData = await new Promise<string>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(sigBlob); });
                    }
                    const sigFmt = opSigData.includes('data:image/png') ? 'PNG' : 'JPEG';
                    pdf.addImage(opSigData, sigFmt, authX, ry + 18, Math.min(authW, 80), 12);
                } catch {}
            }

            let verY = ry + 33;
            if (e.verified) {
                pdf.setFillColor(240, 253, 244);
                pdf.setDrawColor(187, 247, 208);
                pdf.setLineWidth(0.5);
                pdf.rect(authX - 2, verY, Math.min(authW + 4, 90), 12, 'FD');
                pdf.setFontSize(5.5);
                pdf.setTextColor(5, 150, 105);
                pdf.setFont('helvetica', 'bold');
                pdf.text('QA AUTHORIZED', authX + 2, verY + 5);
                pdf.setFontSize(6.5);
                pdf.setTextColor(6, 78, 59);
                pdf.setFont('helvetica', 'bold');
                pdf.text(e.verifiedBy || '', authX + 2, verY + 10);
                verY += 14;

                if (e.signatureData) {
                    try {
                        let vSigData = e.signatureData;
                        if (!vSigData.startsWith('data:')) {
                            const vResp = await fetch(vSigData);
                            const vBlob = await vResp.blob();
                            vSigData = await new Promise<string>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(vBlob); });
                        }
                        const vFmt = vSigData.includes('data:image/png') ? 'PNG' : 'JPEG';
                        pdf.addImage(vSigData, vFmt, authX, verY, Math.min(authW, 80), 10);
                        verY += 12;
                    } catch {}
                }

                if (e.verificationComments) {
                    pdf.setFontSize(5.5);
                    pdf.setTextColor(100, 116, 139);
                    pdf.setFont('helvetica', 'normal');
                    const cmtLines = pdf.splitTextToSize(e.verificationComments, authW);
                    pdf.text(cmtLines.slice(0, 3), authX, verY + 5);
                    verY += cmtLines.slice(0, 3).length * 5 + 3;
                }

                if (e.verificationDate) {
                    pdf.setFontSize(5.5);
                    pdf.setTextColor(148, 163, 184);
                    pdf.setFont('helvetica', 'bold');
                    const dateStr = new Date(e.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    pdf.text(dateStr, authX, verY + 5);
                }
            } else {
                pdf.setFontSize(7);
                pdf.setTextColor(245, 158, 11);
                pdf.setFont('helvetica', 'bold');
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
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'bold');
        pdf.text('REGISTRY INTAKE SIGNATURE', ml + 8, y + 12);
        pdf.setDrawColor(203, 213, 225);
        pdf.line(ml + 8, y + 32, ml + sigW - 8, y + 32);

        pdf.setFillColor(248, 250, 252);
        pdf.rect(ml + sigW + 20, y, sigW, 40, 'FD');
        pdf.setTextColor(100, 116, 139);
        pdf.text('AUDIT VERIFICATION NODE', ml + sigW + 28, y + 12);
        pdf.line(ml + sigW + 28, y + 32, pw - mr - 8, y + 32);

        drawFooter(pageNum);
        savePdfForPWA(pdf, filename);
    };

    const handleExportSinglePDF = async (entry: ReceivingEntry) => {
        setIsGeneratingPDF(true);
        try {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ml = 40, mr = 40, mt = 40, mb = 50;
            const cw = pw - ml - mr;
            let y = mt;
            const securityId = `CERT-REC-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
            const timestamp = new Date().toLocaleString();

            const toDataUrl = async (src: string): Promise<string> => {
                if (src.startsWith('data:')) return src;
                try {
                    const r = await fetch(src);
                    const b = await r.blob();
                    return new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(b); });
                } catch { return ''; }
            };

            pdf.setTextColor(235, 238, 245);
            pdf.setFontSize(52);
            pdf.setFont('helvetica', 'bold');
            pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 });

            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'RAW MATERIAL RECEIVING REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData });

            pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`RECEIVING RECORD #${entry.rec}`, ml, y);
            const statusColor: Record<string, number[]> = { 'Approved': [5, 150, 105], 'Rejected': [225, 29, 72], 'Partial': [245, 158, 11] };
            const sc = statusColor[entry.status || 'Approved'] || [100, 116, 139];
            pdf.setTextColor(sc[0], sc[1], sc[2]);
            pdf.setFontSize(9);
            pdf.text((entry.status || 'Approved').toUpperCase(), pw - mr, y, { align: 'right' });
            y += 12;

            const sectionHeader = (title: string) => {
                pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 16, 'F');
                pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
                pdf.text(title, ml + 8, y + 11);
                y += 16;
            };

            const rowH = 16;
            const halfW = cw / 2;
            const drawRow = (label1: string, val1: string, label2?: string, val2?: string, valColor1?: number[], valColor2?: number[]) => {
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
            drawRow('Department:', 'Receiving', 'Unit Name:', 'Central Kitchen');
            drawRow('Regional:', 'Manhattan Hub', 'Corporate:', 'HACCP PRO', undefined, [79, 70, 229]);

            sectionHeader('REGISTRY IDENTITY & VENDOR INFORMATION');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 3);
            drawRow('Vendor:', entry.vendor, 'Invoice No:', entry.invoiceNo);
            drawRow('Date:', entry.date, 'Time:', entry.time);
            drawRow('PO Number:', entry.poNumber || 'N/A', 'Record ID:', `#${entry.rec}`);

            sectionHeader('PRODUCT ANALYSIS & BATCH DETAILS');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 4);
            drawRow('Material Name:', entry.materialName, '', '', [79, 70, 229]);
            drawRow('Brand:', entry.brand, 'Batch No:', entry.batchNo);
            drawRow('Mfg Date:', entry.mfgDate, 'Exp Date:', entry.expDate, undefined, [225, 29, 72]);
            const expDt = new Date(entry.expDate);
            const now = new Date();
            const diffDays = Math.ceil((expDt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const shelfStr = diffDays > 0 ? `${Math.floor(diffDays / 30)} months ${diffDays % 30} days (${((diffDays / 365) * 100).toFixed(1)}%)` : `0 days 0 hours (0.0%)`;
            drawRow('Remaining Shelf Life:', shelfStr, '', '', diffDays <= 30 ? [225, 29, 72] : [5, 150, 105]);

            sectionHeader('QUANTITIES & DISCREPANCY');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH);
            drawRow('Ordered Qty:', `${entry.orderedQty} ${entry.unit}`, 'Received Qty:', `${entry.receivedQty} ${entry.unit}`);

            sectionHeader('TEMPERATURE & QUALITY CONTROL');
            const hasTempImage = !!entry.tempImageSrc;
            const tempImgBlockH = hasTempImage ? 70 : 0;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 2 + tempImgBlockH);
            drawRow('Temperature:', `${entry.temperature}°C`, 'Condition:', entry.condition || 'Good');
            const qcColor = entry.qcStatus === 'Rejected' ? [225, 29, 72] : [5, 150, 105];
            drawRow('QC Status:', entry.qcStatus || 'Verified', 'Vendor Eval:', `${entry.vendorEval || 0}%`, qcColor);
            if (hasTempImage) {
                try {
                    const tempImgData = await toDataUrl(entry.tempImageSrc!);
                    if (tempImgData) {
                        pdf.setFontSize(7); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Temperature Evidence Photo:', ml + 8, y + 10);
                        const imgFmt = tempImgData.includes('image/png') ? 'PNG' : 'JPEG';
                        pdf.addImage(tempImgData, imgFmt, ml + 8, y + 14, 60, 50);
                    }
                } catch {}
                y += tempImgBlockH;
            }

            sectionHeader('DOCUMENT ATTACHMENTS');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 2);
            const sAtt = entry.attachments || { invoice: false, formE: false, coa: false };
            const yes = [5, 150, 105], no = [225, 29, 72];
            drawRow('Invoice Copy:', sAtt.invoice ? 'YES' : 'NO', 'Form E:', sAtt.formE ? 'YES' : 'NO', sAtt.invoice ? yes : no, sAtt.formE ? yes : no);
            drawRow('COA Certificate:', sAtt.coa ? 'YES' : 'NO', '', '', sAtt.coa ? yes : no);

            sectionHeader('AUTHORIZATION & VERIFICATION');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
            const authRows = 3 + (entry.verificationComments ? 1 : 0) + (entry.verificationDate ? 1 : 0);
            pdf.rect(ml, y, cw, rowH * authRows);
            drawRow('Receiver / Operator:', entry.receiver || 'N/A');
            drawRow('Verified By:', entry.verified ? (entry.verifiedBy || 'N/A') : 'PENDING', '', '', entry.verified ? [5, 150, 105] : [245, 158, 11]);
            drawRow('Verification Status:', entry.verified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION', '', '', entry.verified ? [5, 150, 105] : [245, 158, 11]);
            if (entry.verificationComments) {
                drawRow('Comments:', entry.verificationComments);
            }
            if (entry.verificationDate) {
                const vDateStr = new Date(entry.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                drawRow('Verification Date:', vDateStr);
            }

            y += 6;
            sectionHeader('DIGITAL IDENTITY PASSPORT (QR CODE)');
            const qrString = buildRecordQRUrl(entry);
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

            pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
            const sigW = (cw - 20) / 2;
            pdf.setFillColor(248, 250, 252);
            pdf.rect(ml, y, sigW, 50, 'FD');
            pdf.setFontSize(7); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text('REGISTRY INTAKE SIGNATURE', ml + 8, y + 14);
            pdf.setDrawColor(203, 213, 225); pdf.line(ml + 8, y + 40, ml + sigW - 8, y + 40);
            if (entry.receiverSignature) {
                try {
                    const rSig = await toDataUrl(entry.receiverSignature);
                    if (rSig) pdf.addImage(rSig, rSig.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 18, sigW - 20, 18);
                } catch {}
            }

            pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
            pdf.setFillColor(248, 250, 252);
            pdf.rect(ml + sigW + 20, y, sigW, 50, 'FD');
            pdf.setTextColor(15, 23, 42);
            pdf.text('AUDIT VERIFICATION NODE', ml + sigW + 28, y + 14);
            pdf.setDrawColor(203, 213, 225); pdf.line(ml + sigW + 28, y + 40, pw - mr - 8, y + 40);
            if (entry.verified && entry.signatureData) {
                try {
                    const vSig = await toDataUrl(entry.signatureData);
                    if (vSig) pdf.addImage(vSig, vSig.includes('image/png') ? 'PNG' : 'JPEG', ml + sigW + 28, y + 18, sigW - 20, 18);
                } catch {}
            }

            const fy = ph - mb + 12;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.5);
            pdf.line(ml, fy - 5, pw - mr, fy - 5);
            pdf.setFontSize(7); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'bold');
            pdf.text(`System Timestamp: ${timestamp}`, ml, fy + 2);
            pdf.text(`Electronic Integrity Hash: ${securityId}`, pw - mr, fy + 2, { align: 'right' });
            pdf.text('Page 1', pw / 2, fy + 2, { align: 'center' });

            savePdfForPWA(pdf, `Receiving_Record_${entry.rec}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) { console.error('PDF generation error:', err); }
        setIsGeneratingPDF(false);
    };

    const handleExportPDF = async () => {
        if (filteredEntries.length === 0) return;
        setIsGeneratingPDF(true);
        const filename = `Complete_Product_Record_Registry_${new Date().toISOString().split('T')[0]}.pdf`;
        await generatePDFForEntries(filteredEntries, filename);
        setIsGeneratingPDF(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Loading receiving records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-[#f8fafc] text-slate-900 font-sans relative overflow-hidden">
            <div className="mb-8 px-4 md:px-0">
                <div className="relative overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 md:p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5 md:mb-7">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 md:p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10"><Truck size={18} className="md:w-6 md:h-6 text-white" /></div>
                                <div>
                                    <h2 className="text-xs md:text-sm font-black text-white uppercase tracking-[0.15em]">Receiving Registry</h2>
                                    <p className="text-[8px] md:text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">Product Intake Control</p>
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-2" ref={dropdownRef}>
                                <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="p-3 rounded-xl bg-white/10 backdrop-blur-sm text-white/60 hover:text-white hover:bg-white/20 border border-white/10 transition-all active:scale-95">{isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}</button>
                                <div className="relative">
                                    <button onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'dates' ? null : 'dates')} className={`p-3 rounded-xl border transition-all active:scale-95 ${activeFilterDropdown === 'dates' ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/10 backdrop-blur-sm text-white/60 hover:text-white hover:bg-white/20 border-white/10'}`}><Calendar size={18} /></button>
                                    {activeFilterDropdown === 'dates' && (
                                        <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[60] p-6 space-y-5 animate-in fade-in slide-in-from-top-2">
                                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><Calendar size={12} /> Timeline Filters</h4>
                                            <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-500 uppercase ml-1">Receiving Date</label><div className="flex gap-2"><input type="date" className="flex-1 p-2 bg-slate-50 border rounded-xl text-xs font-bold" value={dateFilters.receiving.from} onChange={e=>setDateFilters({...dateFilters, receiving:{...dateFilters.receiving, from: e.target.value}})}/><input type="date" className="flex-1 p-2 bg-slate-50 border rounded-xl text-xs font-bold" value={dateFilters.receiving.to} onChange={e=>setDateFilters({...dateFilters, receiving:{...dateFilters.receiving, to: e.target.value}})}/></div></div>
                                            <button onClick={() => setActiveFilterDropdown(null)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Apply</button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { setEditingEntryId(null); resetForm(); setIsModalOpen(true); }} className="px-6 py-3 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2.5"><Plus size={16} strokeWidth={3} /> Add Intake</button>
                            </div>
                        </div>

                        <div className="flex md:grid md:grid-cols-4 gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory pb-1 md:pb-0 hide-scrollbar">
                            <button onClick={() => handleDashStatFilter(null)} className={`group relative overflow-hidden rounded-2xl p-3.5 md:p-5 transition-all active:scale-[0.97] min-w-[130px] snap-center shrink-0 md:shrink md:min-w-0 ${dashStatFilter === null ? 'bg-white/15 ring-2 ring-white/30' : 'bg-white/[0.07] hover:bg-white/10'} backdrop-blur-sm border border-white/10`}>
                                <div className="flex items-center gap-2 mb-2.5 md:mb-3">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><Package size={13} className="md:w-4 md:h-4 text-blue-400" /></div>
                                    <span className="text-[7px] md:text-[8px] font-black text-white/50 uppercase tracking-widest">Today</span>
                                </div>
                                <p className="text-xl md:text-3xl font-black text-white leading-none">{summaryStats.todayIntake}</p>
                                <p className="text-[7px] md:text-[8px] font-bold text-white/30 uppercase mt-1 tracking-wider">Avg {summaryStats.avgDailyIntake}/day</p>
                            </button>

                            <button onClick={() => handleDashStatFilter('due')} className={`group relative overflow-hidden rounded-2xl p-3.5 md:p-5 transition-all active:scale-[0.97] min-w-[130px] snap-center shrink-0 md:shrink md:min-w-0 ${dashStatFilter === 'due' ? 'bg-amber-500/20 ring-2 ring-amber-400/40' : 'bg-white/[0.07] hover:bg-white/10'} backdrop-blur-sm border border-white/10`}>
                                <div className="flex items-center gap-2 mb-2.5 md:mb-3">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-500/20 flex items-center justify-center"><ShieldIcon size={13} className="md:w-4 md:h-4 text-amber-400" /></div>
                                    <span className="text-[7px] md:text-[8px] font-black text-white/50 uppercase tracking-widest">Pending</span>
                                </div>
                                <p className="text-xl md:text-3xl font-black text-amber-400 leading-none">{summaryStats.verificationDue}</p>
                                <p className="text-[7px] md:text-[8px] font-bold text-white/30 uppercase mt-1 tracking-wider">Due Verify</p>
                            </button>

                            <button onClick={() => handleDashStatFilter('completed')} className={`group relative overflow-hidden rounded-2xl p-3.5 md:p-5 transition-all active:scale-[0.97] min-w-[130px] snap-center shrink-0 md:shrink md:min-w-0 ${dashStatFilter === 'completed' ? 'bg-emerald-500/20 ring-2 ring-emerald-400/40' : 'bg-white/[0.07] hover:bg-white/10'} backdrop-blur-sm border border-white/10`}>
                                <div className="flex items-center gap-2 mb-2.5 md:mb-3">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 size={13} className="md:w-4 md:h-4 text-emerald-400" /></div>
                                    <span className="text-[7px] md:text-[8px] font-black text-white/50 uppercase tracking-widest">Verified</span>
                                </div>
                                <p className="text-xl md:text-3xl font-black text-emerald-400 leading-none">{summaryStats.completed}</p>
                                <p className="text-[7px] md:text-[8px] font-bold text-white/30 uppercase mt-1 tracking-wider">Completed</p>
                            </button>

                            <button onClick={() => handleDashStatFilter('rejections')} className={`group relative overflow-hidden rounded-2xl p-3.5 md:p-5 transition-all active:scale-[0.97] min-w-[130px] snap-center shrink-0 md:shrink md:min-w-0 ${dashStatFilter === 'rejections' ? 'bg-rose-500/20 ring-2 ring-rose-400/40' : 'bg-white/[0.07] hover:bg-white/10'} backdrop-blur-sm border border-white/10`}>
                                <div className="flex items-center gap-2 mb-2.5 md:mb-3">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-rose-500/20 flex items-center justify-center"><AlertTriangle size={13} className="md:w-4 md:h-4 text-rose-400" /></div>
                                    <span className="text-[7px] md:text-[8px] font-black text-white/50 uppercase tracking-widest">Rejected</span>
                                </div>
                                <p className="text-xl md:text-3xl font-black text-rose-400 leading-none">{summaryStats.rejectedShortage}</p>
                                <p className="text-[7px] md:text-[8px] font-bold text-white/30 uppercase mt-1 tracking-wider">Flagged</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 mb-6 px-4 md:px-0">
                <div className="flex items-center gap-2 bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm w-fit">
                    <button
                        onClick={() => setActiveRegisterTab('main')}
                        className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeRegisterTab === 'main'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <Truck size={14} /> Main Register
                    </button>
                    <button
                        onClick={() => setActiveRegisterTab('pending-review')}
                        className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeRegisterTab === 'pending-review'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <ClipboardList size={14} /> Pending Review
                    </button>
                </div>
            </div>

            {activeRegisterTab === 'pending-review' ? (
                <div className="px-4 md:px-0">
                    <PendingReviewTab
                        suppliers={suppliers}
                        rawMaterials={rawMaterials}
                        currentScope={currentScope}
                        userRootId={userRootId}
                        entities={entities}
                        onPromoteToRegister={(entry) => {
                            setEntries(prev => [entry, ...prev]);
                        }}
                    />
                </div>
            ) : (
            <>
            <div className="shrink-0 mb-8 px-4 md:px-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 relative z-10">
                        <button onClick={toggleSelectAll} className={`p-4 rounded-[1.5rem] border-2 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 ${selectedIds.size === paginatedEntries.filter(e => !e.verified && e.status === 'Approved').length && selectedIds.size > 0 ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-400'}`}>{selectedIds.size > 0 ? <CheckCheck size={22} strokeWidth={3} /> : <CheckSquare size={22} strokeWidth={2.5} />}</button>
                        {selectedIds.size > 0 && (<button onClick={handleBulkVerify} className="px-4 py-3 md:p-4 bg-emerald-600 text-white rounded-[1.5rem] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><ShieldCheck size={18} className="md:w-[22px] md:h-[22px]" strokeWidth={3} /><span className="text-[9px] md:text-[10px] font-black uppercase">Verify ({selectedIds.size})</span></button>)}
                    </div>
                    <div className="relative group flex-1 max-w-lg"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} /><input type="text" placeholder="Search product registry..." className="w-full pl-11 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black focus:outline-none focus:border-indigo-500 transition-all shadow-inner uppercase tracking-wider" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div>
                </div>
            </div>

            <div className="space-y-6 px-4 md:px-0">
                {paginatedEntries.length > 0 ? (
                    paginatedEntries.map((entry, idx) => (
                        <ReceivingCard 
                            key={entry.id} entry={entry} index={(currentPage - 1) * rowsPerPage + idx + 1}
                            isSelected={selectedIds.has(entry.id)} onSelect={() => toggleSelectOne(entry.id)}
                            isExpanded={expandedMobileIds.has(entry.id)} onToggle={() => { const n = new Set(expandedMobileIds); if(n.has(entry.id)) n.delete(entry.id); else n.add(entry.id); setExpandedMobileIds(n); }}
                            onVerify={() => setVerificationModal({ ...verificationModal, isOpen: true, ids: [entry.id] })} 
                            onEdit={() => handleEdit(entry)}
                            onDownload={() => handleExportSinglePDF(entry)}
                        />
                    ))
                ) : (
                    <div className="py-20 text-center text-slate-300"><Package size={64} className="mx-auto mb-4 opacity-10" /><p className="text-sm font-black uppercase tracking-[0.2em]">No entries found matching criteria</p></div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-lg mt-6 overflow-hidden">
                <UnifiedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItemsCount}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
                />
            </div>

            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 bg-gradient-to-t from-slate-100 via-slate-100/95 to-transparent pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <button onClick={handleExportPDF} disabled={isGeneratingPDF} className="p-4 bg-white text-slate-500 rounded-2xl shadow-lg border border-slate-200/80 active:scale-90 transition-all hover:text-indigo-600">{isGeneratingPDF ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}</button>
                    <button onClick={() => { setEditingEntryId(null); resetForm(); setIsModalOpen(true); }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.97] transition-all"><Plus size={18} strokeWidth={3} /><span className="text-[10px] font-black uppercase tracking-[0.15em]">Add Intake</span></button>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[850px] md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border-0 md:border border-slate-200 animate-in slide-in-from-bottom duration-300 h-[100dvh] md:h-auto md:max-h-[94vh]">
                        <div className="px-4 py-3 md:px-8 md:py-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-slate-900 md:bg-white">
                            <div className="flex items-center gap-3 md:gap-5">
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 rounded-xl text-white md:text-slate-400 md:bg-slate-50 md:border md:border-slate-200 active:scale-90"><ChevronLeft size={20} /></button>
                                <div>
                                    <h3 className="text-sm md:text-lg font-black uppercase tracking-tight text-white md:text-slate-800">{editingEntryId ? 'Edit Intake' : 'New Intake'}</h3>
                                    <p className="text-[8px] md:text-[9px] font-bold text-white/50 md:text-slate-400 uppercase tracking-widest mt-0.5">Material receiving log</p>
                                </div>
                            </div>
                            <button onClick={handleQuickSave} disabled={!formData.vendor || formData.items.some((item: any) => !item.materialName || !item.brand)} className="px-4 py-2 md:px-6 md:py-2.5 bg-indigo-600 md:bg-slate-900 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 disabled:opacity-40 flex items-center gap-1.5"><Save size={14} /> Save</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-slate-50 md:bg-slate-50/30 space-y-3 md:space-y-4">
                            <div className="bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
                                <div onClick={() => toggleMainSection('artifacts')} className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-all border-b border-slate-50"><div className="flex items-center gap-4 md:gap-5"><div className="p-2.5 md:p-3 bg-slate-900 text-white rounded-xl md:rounded-2xl shadow-lg"><ShieldIcon size={18} className="md:w-5 md:h-5" /></div><div><h4 className="text-[11px] md:text-xs font-black uppercase tracking-[0.15em] text-slate-800">Verification Artifacts</h4><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Shipment-wide documentation</p></div></div><div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-md transition-transform">{activeModalSection === 'artifacts' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div></div>
                                {activeModalSection === 'artifacts' && (
                                    <div className="p-4 md:p-8 space-y-4 md:space-y-5 animate-in slide-in-from-top-2 duration-300">
                                        <SearchSelect label="Verified Vendor" required options={suppliers?.map(s => s.name) || []} value={formData.vendor} onChange={(val) => setFormData({ ...formData, vendor: val })} icon={<Warehouse size={18} />} />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Invoice Number</label>
                                                <div className="flex items-stretch gap-2">
                                                    <input value={formData.invoiceNo} onChange={e => setFormData({...formData, invoiceNo: e.target.value})} className="flex-1 min-w-0 px-4 md:px-5 py-3 md:py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner uppercase" placeholder="INV-..." />
                                                    <label className={`shrink-0 w-12 md:w-14 flex flex-col items-center justify-center gap-0.5 rounded-2xl cursor-pointer transition-all active:scale-95 ${formData.invoiceFiles.length > 0 ? 'bg-indigo-50 border-2 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-2 border-dashed border-slate-200 text-slate-300 hover:border-indigo-400 hover:text-indigo-500'}`}>
                                                        <FileUp size={16} />
                                                        <span className="text-[7px] font-black uppercase leading-none">{formData.invoiceFiles.length > 0 ? `${formData.invoiceFiles.length}` : 'INV'}</span>
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); setFormData((prev: any) => ({...prev, invoiceFiles: [...prev.invoiceFiles, ...files]})); }} />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">PO Number</label>
                                                <div className="flex items-stretch gap-2">
                                                    <input value={formData.poNumber} onChange={e => setFormData({...formData, poNumber: e.target.value})} className="flex-1 min-w-0 px-4 md:px-5 py-3 md:py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner uppercase" placeholder="PO-..." />
                                                    <label className={`shrink-0 w-12 md:w-14 flex flex-col items-center justify-center gap-0.5 rounded-2xl cursor-pointer transition-all active:scale-95 ${formData.formEFiles.length > 0 ? 'bg-emerald-50 border-2 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-2 border-dashed border-slate-200 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'}`}>
                                                        <FileUp size={16} />
                                                        <span className="text-[7px] font-black uppercase leading-none">{formData.formEFiles.length > 0 ? `${formData.formEFiles.length}` : 'FRM E'}</span>
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); setFormData((prev: any) => ({...prev, formEFiles: [...prev.formEFiles, ...files]})); }} />
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
                                <div onClick={() => toggleMainSection('vendorEval')} className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-all border-b border-slate-50"><div className="flex items-center gap-4 md:gap-5"><div className="p-2.5 md:p-3 bg-emerald-600 text-white rounded-xl md:rounded-2xl shadow-lg"><ClipboardCheck size={18} className="md:w-5 md:h-5" /></div><div><h4 className="text-[11px] md:text-xs font-black uppercase tracking-[0.15em] text-slate-800">Vendor Evaluation</h4><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Delivery compliance checklist</p></div></div><div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-md transition-transform ${activeModalSection === 'vendorEval' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{activeModalSection === 'vendorEval' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div></div>
                                {activeModalSection === 'vendorEval' && (
                                    <div className="p-6 md:p-8 space-y-3 animate-in slide-in-from-top-2 duration-300">
                                        {[
                                            { key: 'vehicleHygiene', label: 'Vehicle Hygiene', desc: 'Delivery vehicle clean and pest-free' },
                                            { key: 'tempMaintained', label: 'Temperature Maintained', desc: 'Cold chain integrity during transport' },
                                            { key: 'personnelHygiene', label: 'Personnel Hygiene', desc: 'Delivery staff meets hygiene standards' },
                                            { key: 'packagingIntegrity', label: 'Packaging Integrity', desc: 'No damage, tampering or contamination' },
                                            { key: 'sealIntact', label: 'Seal Intact', desc: 'Security seals unbroken and verified' },
                                            { key: 'deliverySchedule', label: 'Delivery Schedule', desc: 'Arrived within agreed time window' }
                                        ].map(item => (
                                            <div key={item.key} className="flex items-center justify-between p-3 md:p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-slate-200 transition-all">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="text-[10px] md:text-xs font-black text-slate-800 uppercase tracking-tight">{item.label}</p>
                                                    <p className="text-[8px] md:text-[9px] font-bold text-slate-400 mt-0.5">{item.desc}</p>
                                                </div>
                                                <div className="flex gap-1.5 shrink-0">
                                                    {['Yes', 'No', 'N/A'].map(opt => (
                                                        <button key={opt} onClick={() => setFormData((prev: any) => ({ ...prev, evaluations: { ...prev.evaluations, [item.key]: opt } }))} className={`px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase transition-all ${formData.evaluations[item.key] === opt ? (opt === 'Yes' ? 'bg-emerald-600 text-white shadow-md' : opt === 'No' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-600 text-white shadow-md') : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'}`}>{opt}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Evaluation Score</span>
                                                <span className="text-sm font-black text-indigo-700">{Math.round((Object.values(formData.evaluations).filter((v: any) => v === 'Yes').length / Object.keys(formData.evaluations).length) * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
                                <div onClick={() => toggleMainSection('context')} className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-all border-b border-slate-50"><div className="flex items-center gap-4 md:gap-5"><div className="p-2.5 md:p-3 bg-blue-600 text-white rounded-xl md:rounded-2xl shadow-lg"><Package size={18} className="md:w-5 md:h-5" /></div><div><h4 className="text-[11px] md:text-xs font-black uppercase tracking-[0.15em] text-slate-800">Material Items</h4><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formData.items.length} item{formData.items.length > 1 ? 's' : ''} in this shipment</p></div></div><div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-md transition-transform ${activeModalSection === 'context' ? 'bg-blue-600' : 'bg-indigo-600'}`}>{activeModalSection === 'context' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div></div>
                                {activeModalSection === 'context' && (
                                    <div className="p-4 md:p-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        {formData.items.map((item: any, idx: number) => {
                                            const isItemExpanded = expandedItemIds.has(item.id);
                                            const selectedMaterial = rawMaterials.find(rm => rm.name === item.materialName);
                                            const brandOptions = selectedMaterial?.brands?.map(b => b.name) || [];
                                            return (
                                                <div key={item.id} className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                                                    <div onClick={() => { const n = new Set(expandedItemIds); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); setExpandedItemIds(n); }} className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/30 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center text-[10px] font-black shadow-md">{idx + 1}</div>
                                                            <div>
                                                                <p className="text-[10px] md:text-xs font-black text-slate-800 uppercase">{item.materialName || 'New Material'}</p>
                                                                <p className="text-[8px] font-bold text-slate-400 uppercase">{item.brand || 'Select brand'} {item.batchNo ? `• Batch: ${item.batchNo}` : ''}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {formData.items.length > 1 && <button onClick={(e) => { e.stopPropagation(); handleRemoveMaterialItem(item.id); }} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all"><Trash2 size={14} /></button>}
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform ${isItemExpanded ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</div>
                                                        </div>
                                                    </div>
                                                    {isItemExpanded && (
                                                        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top-2 duration-200">
                                                            <SearchSelect label="Material Name" required options={rawMaterials.map(rm => rm.name)} value={item.materialName} onChange={(val) => handleUpdateItem(item.id, 'materialName', val)} icon={<Layers size={16} />} />
                                                            <SearchSelect label="Brand" required options={brandOptions} value={item.brand} onChange={(val) => handleUpdateItem(item.id, 'brand', val)} icon={<Tag size={16} />} />
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Batch Number</label>
                                                                <input value={item.batchNo} onChange={e => handleUpdateItem(item.id, 'batchNo', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner uppercase" placeholder="BN-..." />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Ordered Qty</label>
                                                                    <input type="number" value={item.orderedQty} onChange={e => handleUpdateItem(item.id, 'orderedQty', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner" placeholder="0" />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Received Qty</label>
                                                                    <input type="number" value={item.receivedQty} onChange={e => handleUpdateItem(item.id, 'receivedQty', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner" placeholder="0" />
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Unit</label>
                                                                    <select value={item.unit} onChange={e => handleUpdateItem(item.id, 'unit', e.target.value)} className="w-full px-4 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner uppercase">
                                                                        {['KG', 'LTR', 'PCS', 'BOX', 'PKT', 'BTL', 'CAN', 'BAG', 'CTN', 'ROLL'].map(u => <option key={u} value={u}>{u}</option>)}
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Temperature °C</label>
                                                                    <input type="number" step="0.1" value={item.temperature} onChange={e => handleUpdateItem(item.id, 'temperature', e.target.value)} className="w-full px-4 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-blue-500 shadow-inner" placeholder="0.0" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Temperature Photo Evidence</label>
                                                                <div className="flex items-start gap-3">
                                                                    <label className="shrink-0 w-16 h-16 bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 transition-all active:scale-95">
                                                                        <Camera size={20} className="text-blue-500" />
                                                                        <span className="text-[7px] font-black text-blue-400 uppercase">Capture</span>
                                                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleCameraCapture(e, item.id)} />
                                                                    </label>
                                                                    {item.tempImage && (
                                                                        <div className="relative flex-1 max-w-[200px]">
                                                                            <img src={item.tempImage} className="w-full h-24 object-cover rounded-2xl border-2 border-blue-100 shadow-sm" />
                                                                            <button onClick={() => handleUpdateItem(item.id, 'tempImage', null)} className="absolute -top-1.5 -right-1.5 p-1 bg-white rounded-full shadow-md text-slate-400 hover:text-rose-500 border border-slate-200"><X size={10} /></button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Mfg Date</label>
                                                                    <input type="date" value={item.mfgDate} onChange={e => handleUpdateItem(item.id, 'mfgDate', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner" />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Exp Date</label>
                                                                    <input type="date" value={item.expDate} onChange={e => handleUpdateItem(item.id, 'expDate', e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner" />
                                                                </div>
                                                            </div>
                                                            {item.shelfLifeStr && (
                                                                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2">
                                                                    <Timer size={14} className="text-indigo-500" />
                                                                    <span className="text-[9px] font-black text-indigo-700 uppercase">Shelf Life: {item.shelfLifeStr}</span>
                                                                    {item.storageType && <span className="text-[8px] font-bold text-indigo-400 ml-auto uppercase">Storage: {item.storageType}</span>}
                                                                </div>
                                                            )}
                                                            {Number(item.receivedQty) > 0 && Number(item.orderedQty) > 0 && Number(item.receivedQty) < Number(item.orderedQty) && (
                                                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                                                                    <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-600" /><span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Quantity Discrepancy Detected</span></div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[8px] font-black text-amber-500 uppercase ml-1">Type</label>
                                                                            <select value={item.discrepancyType} onChange={e => handleUpdateItem(item.id, 'discrepancyType', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-[10px] font-black outline-none focus:border-amber-500">
                                                                                <option value="Shortfall">Shortfall</option><option value="Damage">Damage</option><option value="Quality Reject">Quality Reject</option><option value="Expiry Issue">Expiry Issue</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <label className="text-[8px] font-black text-amber-500 uppercase ml-1">Reason</label>
                                                                            <input value={item.shortfallReason} onChange={e => handleUpdateItem(item.id, 'shortfallReason', e.target.value)} className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl text-[10px] font-black outline-none focus:border-amber-500" placeholder="Describe..." />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Corrective Action</label>
                                                                <textarea value={item.correctiveAction || ''} onChange={e => handleUpdateItem(item.id, 'correctiveAction', e.target.value)} className="w-full px-4 py-3 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner resize-none" rows={2} placeholder="Describe corrective action taken (if any)..." />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">COA Certificate</label>
                                                                <label className={`flex items-center gap-3 p-3 md:p-3.5 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${(item.coaFiles?.length || 0) > 0 ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50/50 border-2 border-dashed border-slate-200 hover:border-blue-400'}`}>
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(item.coaFiles?.length || 0) > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-300'}`}><FileUp size={18} /></div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`text-[10px] font-black uppercase tracking-wide ${(item.coaFiles?.length || 0) > 0 ? 'text-blue-700' : 'text-slate-500'}`}>{(item.coaFiles?.length || 0) > 0 ? `${item.coaFiles.length} file(s) attached` : 'Upload COA'}</p>
                                                                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">Certificate of Analysis for this material</p>
                                                                    </div>
                                                                    {(item.coaFiles?.length || 0) > 0 && <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{item.coaFiles.length}</div>}
                                                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); handleUpdateItem(item.id, 'coaFiles', [...(item.coaFiles || []), ...files]); }} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {!editingEntryId && (
                                            <button onClick={handleAddMaterialItem} className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"><Plus size={16} /> Add Another Material</button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="bg-white border-2 border-slate-100 rounded-[1.5rem] md:rounded-[2rem] overflow-hidden shadow-sm">
                                <div onClick={() => toggleMainSection('authorization')} className="px-5 md:px-8 py-4 md:py-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-all border-b border-slate-50"><div className="flex items-center gap-4 md:gap-5"><div className="p-2.5 md:p-3 bg-amber-500 text-white rounded-xl md:rounded-2xl shadow-lg"><UserCheck size={18} className="md:w-5 md:h-5" /></div><div><h4 className="text-[11px] md:text-xs font-black uppercase tracking-[0.15em] text-slate-800">Authorization</h4><p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Receiver details & confirmation</p></div></div><div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-md transition-transform ${activeModalSection === 'authorization' ? 'bg-amber-500' : 'bg-indigo-600'}`}>{activeModalSection === 'authorization' ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div></div>
                                {activeModalSection === 'authorization' && (
                                    <div className="p-6 md:p-8 space-y-5 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Receiver Name</label>
                                            <input value={formData.receiver} onChange={e => setFormData({...formData, receiver: e.target.value})} className="w-full px-5 py-4 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-indigo-500 shadow-inner uppercase" placeholder="Enter receiver name..." />
                                        </div>
                                        <SignaturePad onCapture={(data) => setFormData({...formData, signature: data})} onClear={() => setFormData({...formData, signature: null})} initialData={formData.signature || undefined} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="hidden md:flex px-6 py-4 md:px-8 md:py-4 border-t border-slate-100 bg-white shrink-0 items-center justify-between gap-4">
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 py-3 border-2 border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                            <button onClick={handleQuickSave} disabled={!formData.vendor || formData.items.some((item: any) => !item.materialName || !item.brand)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><Save size={16} /> {editingEntryId ? 'Update Record' : 'Save Intake'}</button>
                        </div>
                    </div>
                </div>
            )}

            </>
            )}

            {verificationModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVerificationModal({ isOpen: false, ids: [], comments: '', signature: '' })} />
                    <div className="relative w-full md:max-w-lg bg-white md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90dvh] flex flex-col">
                        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest">QA Verification</h3>
                                <p className="text-[9px] font-bold text-white/50 mt-1 uppercase tracking-wider">{verificationModal.ids.length} record{verificationModal.ids.length > 1 ? 's' : ''} selected</p>
                            </div>
                            <button onClick={() => setVerificationModal({ isOpen: false, ids: [], comments: '', signature: '' })} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={12} /> Verification Comments</label>
                                <textarea value={verificationModal.comments} onChange={(e) => setVerificationModal({ ...verificationModal, comments: e.target.value })} placeholder="Enter verification notes, observations, or remarks..." rows={3} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 transition-all resize-none" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> Verification Date & Time</label>
                                <div className="px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs text-slate-800 font-bold">
                                    {new Date().toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                </div>
                            </div>

                            <SignaturePad onCapture={(data) => setVerificationModal({ ...verificationModal, signature: data })} onClear={() => setVerificationModal({ ...verificationModal, signature: '' })} initialData={verificationModal.signature || undefined} />

                            {verificationModal.signature && (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 size={14} />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Signature captured</span>
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4">
                            <button onClick={() => setVerificationModal({ isOpen: false, ids: [], comments: '', signature: '' })} className="px-6 py-3 border-2 border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all">Cancel</button>
                            <button onClick={handleVerifySubmit} disabled={!verificationModal.signature} className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><ShieldCheck size={16} /> Authorize</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceivingRegister;
