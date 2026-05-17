"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Droplets, X, Search, Clock, Camera, Building2,
  CheckCheck, Zap, Calendar, ShieldCheck, PenTool,
  Plus, Database, RefreshCw, Download, 
  PlusCircle, AlertTriangle,
  ChevronRight,
  UserCheck,
  ImageIcon,
  MessageSquare,
  ClipboardCheck,
  Loader2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Package,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  Filter,
  BarChart3,
  Activity,
  History,
  Timer,
  CheckSquare, Square,
  Globe,
  ShieldAlert,
  Settings2,
  Trash2,
  Check,
  Briefcase,
  MapPin,
  Flame,
  FileDigit,
  Star,
  ZapOff,
  User,
  FlaskConical,
  Beaker,
  Thermometer,
  Eraser,
  CheckCircle2,
  Info,
  TimerOff,
  Layers,
  Hourglass,
  UserPlus,
  XCircle,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SanitizationRecordEntry, HierarchyScope, Entity } from '../types';
import UnifiedPagination from './UnifiedPagination';
import { compressImage } from '@/utils/imageCompression';

// --- Constants ---
const CATEGORIES = ["Fruits & Vegetable", "Egg"];
const MOCK_PRODUCTS: Record<string, string[]> = {
    "Fruits & Vegetable": ["Apple Red", "Carrots", "Romaine Lettuce", "Strawberries", "Cherry Tomatoes", "Bell Peppers", "Cucumber", "Broccoli", "Spinach"],
    "Egg": ["White Shell Eggs", "Brown Shell Eggs", "Quail Eggs", "Organic Farm Eggs"]
};
const CHEMICALS = ["Sodium Hypochlorite", "Peracetic Acid", "Organic Acid Sanitizer", "Chlorine Dioxide", "Veg-Wash Plus", "Sanitize-IT Gold", "Pure-Wash 500"];
const MOCK_UNITS = ["NYC Central Kitchen", "LA Logistics Unit", "Chicago Prep Hub", "Miami Distribution", "London Facility"];
const MOCK_DEPTS = ["Main Kitchen", "Cold Prep", "Receiving Bay", "Bulk Storage", "Packing Line"];

// --- Mock Data Generator ---
const generateDummyData = (): SanitizationRecordEntry[] => {
  const now = new Date();
  const records: SanitizationRecordEntry[] = [];
  
  // Sample 1: Completed & Verified
  records.push({
    uuid: `san-sample-1`,
    status: 'COMPLETED',
    isVerified: true,
    regional: 'North America',
    unit: 'NYC Central Kitchen',
    department: 'Main Kitchen',
    location: 'Prep Station 1',
    date: now.toISOString().split('T')[0],
    time: '08:30 AM',
    startTime: new Date(now.getTime() - 15 * 60000).toISOString(),
    endTime: new Date(now.getTime() - 10 * 60000).toISOString(),
    productName: 'Romaine Lettuce',
    categoryName: 'Fruits & Vegetable',
    chemicalName: 'Veg-Wash Plus',
    concentration: '50 ppm',
    contactTime: '5 mins',
    photos: ["https://images.unsplash.com/photo-1584269656462-2334cb2823c1?q=80&w=200&auto=format&fit=crop"],
    userName: 'Chef Mike',
    userSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
    userComments: 'Surface rinsed before sanitization. pH within range.',
    verifierName: 'Jane Smith (QA)',
    verifierSignature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
    verifierComments: 'Authenticated with test strip.',
    verificationDate: now.toISOString()
  });

  // Sample 2: In Progress Egg
  records.push({
    uuid: `san-sample-2`,
    status: 'IN_PROGRESS',
    isVerified: false,
    regional: 'North America',
    unit: 'NYC Central Kitchen',
    department: 'Receiving Bay',
    location: 'Intake Node 2',
    date: now.toISOString().split('T')[0],
    time: '10:15 AM',
    startTime: new Date(now.getTime() - 2 * 60000).toISOString(),
    productName: 'White Shell Eggs',
    categoryName: 'Egg',
    chemicalName: 'Chlorine Dioxide',
    concentration: '100 ppm',
    contactTime: '3 mins',
    photos: [],
    userName: 'Operator Sam',
    userComments: 'Standard intake wash.'
  });

  return records;
};

// --- Sub-Components ---

interface SearchSelectProps {
    label: string;
    options: string[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    icon?: React.ReactNode;
}

const SearchSelect: React.FC<SearchSelectProps> = ({ label, options, value, onChange, placeholder = "Search...", icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
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

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative space-y-2" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-5 py-4 bg-white border-2 rounded-[1.25rem] flex items-center justify-between cursor-pointer transition-all
                    ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-md' : 'border-slate-100 hover:border-indigo-300 shadow-sm'}
                `}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {icon && <div className="text-slate-300 group-hover:text-indigo-500 transition-colors">{icon}</div>}
                    <span className={`truncate text-sm font-black uppercase ${value ? 'text-slate-800' : 'text-slate-300 font-bold'}`}>
                        {value || placeholder}
                    </span>
                </div>
                <div className="ml-auto flex items-center">
                    <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-60">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Filter list..." 
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-400 shadow-inner uppercase"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(""); }}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase transition-colors mb-0.5 text-left hover:bg-indigo-50 ${value === opt ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
                                >
                                    <span>{opt}</span>
                                    {value === opt && <Check size={14} strokeWidth={4} />}
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <p className="text-xs text-slate-400 italic font-medium">No results found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

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
        const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
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

interface SanitizationRecordProps {
  currentScope?: HierarchyScope;
  activeEntity?: Entity | null;
}

const SanitizationRecord: React.FC<SanitizationRecordProps> = ({ 
    currentScope = 'unit', 
    activeEntity 
}) => {
    const [entries, setEntries] = useState<SanitizationRecordEntry[]>(generateDummyData());
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    // Date Filters
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Update time lapse
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Modal State
    const [activeModal, setActiveModal] = useState<'attend' | 'verify' | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<SanitizationRecordEntry | null>(null);

    // Form States
    const [formInput, setFormInput] = useState<any>({
        categoryName: "",
        productName: "",
        chemicalName: "",
        unit: "",
        department: "",
        concentration: "",
        contactTime: "5 mins",
        userComments: ""
    });
    const [signature, setSignature] = useState("");
    const [tempPhotos, setTempPhotos] = useState<string[]>([]);
    const cameraRef = useRef<HTMLInputElement>(null);

    const parseNumericValue = (str: string) => {
        const match = str.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    };

    const stats = useMemo(() => {
        const eggItems = entries.filter(e => e.categoryName === 'Egg');
        const vegItems = entries.filter(e => e.categoryName === 'Fruits & Vegetable');

        const calcAvg = (items: SanitizationRecordEntry[], field: 'concentration' | 'contactTime') => {
            if (items.length === 0) return "0";
            const sum = items.reduce((acc, curr) => acc + parseNumericValue(curr[field]), 0);
            return (sum / items.length).toFixed(1);
        };

        return {
            egg: {
                avgPerDay: (eggItems.length / 7).toFixed(1),
                avgConc: calcAvg(eggItems, 'concentration'),
                avgTime: calcAvg(eggItems, 'contactTime'),
                count: eggItems.length
            },
            veg: {
                avgPerDay: (vegItems.length / 7).toFixed(1),
                avgConc: calcAvg(vegItems, 'concentration'),
                avgTime: calcAvg(vegItems, 'contactTime'),
                count: vegItems.length
            },
            status: {
                inProgress: entries.filter(e => e.status === 'IN_PROGRESS').length,
                dueVerification: entries.filter(e => e.status === 'COMPLETED' && !e.isVerified).length,
                verified: entries.filter(e => e.isVerified).length
            }
        };
    }, [entries]);

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = e.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                e.chemicalName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = !filterCategory || e.categoryName === filterCategory;
            const matchesStatus = !filterStatus || 
                                 (filterStatus === 'IN_PROGRESS' && e.status === 'IN_PROGRESS') ||
                                 (filterStatus === 'DUE_VERIFICATION' && e.status === 'COMPLETED' && !e.isVerified) ||
                                 (filterStatus === 'VERIFIED' && e.isVerified);
            
            // Date Filter
            let matchesDate = true;
            if (dateFrom) {
                const d = new Date(dateFrom);
                d.setHours(0,0,0,0);
                matchesDate = matchesDate && new Date(e.date) >= d;
            }
            if (dateTo) {
                const d = new Date(dateTo);
                d.setHours(23,59,59,999);
                matchesDate = matchesDate && new Date(e.date) <= d;
            }

            return matchesSearch && matchesCat && matchesStatus && matchesDate;
        }).sort((a, b) => {
            const order = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
            return (order as any)[a.status] - (order as any)[b.status];
        });
    }, [entries, searchTerm, filterCategory, filterStatus, dateFrom, dateTo]);

    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredEntries.slice(start, start + rowsPerPage);
    }, [filteredEntries, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);

    const openAttendModal = () => {
        setFormInput({
            categoryName: CATEGORIES[0],
            productName: MOCK_PRODUCTS[CATEGORIES[0]][0],
            chemicalName: CHEMICALS[0],
            unit: activeEntity?.name || MOCK_UNITS[0],
            department: MOCK_DEPTS[0],
            concentration: "50 ppm", 
            contactTime: "5 mins",
            userComments: ""
        });
        setSignature("");
        setTempPhotos([]);
        setActiveModal('attend');
    };

    const commitAttend = () => {
        if (!signature || !formInput.productName) return;
        const nowIso = new Date();
        const newRecord: SanitizationRecordEntry = {
            uuid: `san-${Date.now()}`,
            status: 'IN_PROGRESS',
            isVerified: false,
            regional: activeEntity?.location || 'North America',
            unit: formInput.unit || activeEntity?.name || 'NYC Central Kitchen',
            department: formInput.department || 'Main Kitchen',
            location: 'Prep Station 1',
            date: nowIso.toISOString().split('T')[0],
            time: nowIso.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            startTime: nowIso.toISOString(),
            ...formInput,
            userName: 'Current Operator',
            userSignature: signature,
            photos: tempPhotos
        };
        setEntries(prev => [newRecord, ...prev]);
        setActiveModal(null);
    };

    const handleComplete = (uuid: string) => {
        setEntries(prev => prev.map(e => e.uuid === uuid ? {
            ...e,
            status: 'COMPLETED',
            endTime: new Date().toISOString()
        } : e));
    };

    const handleVerifyOpen = (entry: SanitizationRecordEntry) => {
        setSelectedEntry(entry);
        setFormInput({ verifierComments: '' });
        setSignature("");
        setActiveModal('verify');
    };

    const commitVerify = () => {
        if (!selectedEntry || !signature) return;
        setEntries((prev: SanitizationRecordEntry[]) => prev.map(e => e.uuid === selectedEntry.uuid ? {
            ...e,
            isVerified: true,
            verifierName: 'QA Auditor',
            verifierSignature: signature,
            verifierComments: formInput.verifierComments,
            verificationDate: new Date().toISOString()
        } : e));
        setActiveModal(null);
    };

    const formatLapse = (start?: string, end?: string) => {
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

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setTempPhotos(prev => [...prev, compressed]); };
            reader.readAsDataURL(file);
        }
    };

    const toggleFilter = (type: 'cat' | 'status', val: string) => {
        if (type === 'cat') {
            setFilterCategory(filterCategory === val ? null : val);
        } else {
            setFilterStatus(filterStatus === val ? null : val);
        }
        setCurrentPage(1);
    };

    const resetAllFilters = () => {
        setFilterCategory(null);
        setFilterStatus(null);
        setSearchTerm("");
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    };

    const handleExportPDF = async () => {
        if (filteredEntries.length === 0) return;
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF('l', 'pt', 'a4');
            doc.setFontSize(14);
            doc.text("Sanitization Process Registry", 40, 40);
            doc.setFontSize(10);
            doc.text(`Report Generated: ${new Date().toLocaleString()}`, 40, 60);
            
            let y = 100;
            paginatedEntries.forEach((entry, idx) => {
                if (y > 500) { doc.addPage(); y = 40; }
                doc.text(`${idx + 1}. ${entry.productName} | ${entry.status} | Date: ${entry.date}`, 40, y);
                y += 20;
            });

            doc.save(`Sanitization_Record_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("PDF generation failed", err);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 px-4 md:px-0 relative min-h-[80vh]">
            {/* Club Dashboard Header - KPIs + Actions on one line */}
            <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                
                {/* Horizontal Scrollable Metrics Container */}
                <div className="flex-1 flex overflow-x-auto gap-4 snap-x hide-scrollbar lg:overflow-visible items-stretch pb-1">
                    
                    {/* Block 1: Egg Analytics */}
                    <button 
                        onClick={() => toggleFilter('cat', 'Egg')}
                        className={`snap-center shrink-0 w-[280px] p-5 rounded-[2rem] border-2 transition-all flex flex-col gap-4 bg-white text-left ${filterCategory === 'Egg' ? 'border-amber-500 ring-4 ring-amber-50' : 'border-slate-100 shadow-sm hover:border-amber-200'}`}
                    >
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-lg"><PlusCircle size={18} /></div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {activeEntity ? activeEntity.name : 'Egg Registry'}
                            </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg/Day</span>
                                <span className="text-lg font-black text-slate-900">{stats.egg.avgPerDay}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg Conc.</span>
                                <span className="text-lg font-black text-amber-600">{stats.egg.avgConc} <span className="text-[8px]">ppm</span></span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg Time</span>
                                <span className="text-lg font-black text-indigo-600">{stats.egg.avgTime} <span className="text-[8px]">min</span></span>
                            </div>
                        </div>
                    </button>

                    {/* Block 2: Vegetable Analytics */}
                    <button 
                        onClick={() => toggleFilter('cat', 'Fruits & Vegetable')}
                        className={`snap-center shrink-0 w-[280px] p-5 rounded-[2rem] border-2 transition-all flex flex-col gap-4 bg-white text-left ${filterCategory === 'Fruits & Vegetable' ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-100 shadow-sm hover:border-emerald-200'}`}
                    >
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg"><CheckCircle2 size={18} /></div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {activeEntity ? activeEntity.name : 'Veg Registry'}
                            </h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg/Day</span>
                                <span className="text-lg font-black text-slate-900">{stats.veg.avgPerDay}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg Conc.</span>
                                <span className="text-lg font-black text-emerald-600">{stats.veg.avgConc} <span className="text-[8px]">ppm</span></span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1.5">Avg Time</span>
                                <span className="text-lg font-black text-indigo-600">{stats.veg.avgTime} <span className="text-[8px]">min</span></span>
                            </div>
                        </div>
                    </button>

                    {/* Block 3: Status Analytics */}
                    <div className="snap-center shrink-0 w-[300px] p-5 rounded-[2rem] border border-slate-100 shadow-xl bg-white flex flex-col gap-4">
                        <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><Activity size={18} /></div>
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Flow Sync</h4>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <button 
                                onClick={() => toggleFilter('status', 'IN_PROGRESS')}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all ${filterStatus === 'IN_PROGRESS' ? 'bg-orange-50 border border-orange-200' : 'hover:bg-slate-50'}`}
                            >
                                <span className="text-[8px] font-black text-slate-400 uppercase mb-1">In Process</span>
                                <span className="text-xl font-black text-orange-600">{stats.status.inProgress}</span>
                            </button>
                            <button 
                                onClick={() => toggleFilter('status', 'DUE_VERIFICATION')}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all ${filterStatus === 'DUE_VERIFICATION' ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'}`}
                            >
                                <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Due Verify</span>
                                <span className="text-xl font-black text-indigo-600">{stats.status.dueVerification}</span>
                            </button>
                            <button 
                                onClick={() => toggleFilter('status', 'VERIFIED')}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all ${filterStatus === 'VERIFIED' ? 'bg-emerald-50 border-emerald-500' : 'hover:bg-slate-50'}`}
                            >
                                <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Verified</span>
                                <span className="text-xl font-black text-emerald-600">{stats.status.verified}</span>
                            </button>
                        </div>
                    </div>

                    {/* Action Block Integrated into the same line */}
                    <div className="hidden lg:flex flex-col items-end gap-3 pl-6 border-l border-slate-200 shrink-0">
                        {/* Date Filters */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 shadow-inner">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Range:</span>
                            <input 
                                type="date" 
                                className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-24 uppercase cursor-pointer"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                            <span className="text-slate-300 font-bold">-</span>
                            <input 
                                type="date" 
                                className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-24 uppercase cursor-pointer"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                            {(dateFrom || dateTo) && (
                                <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="ml-1 text-slate-400 hover:text-rose-500 transition-colors">
                                    <XCircle size={14} />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {['unit', 'super-admin'].includes(currentScope) && (
                                <button onClick={openAttendModal} className="px-8 py-3 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-3">
                                    <PenTool size={18} strokeWidth={3} /> Attend Task
                                </button>
                            )}
                            <button onClick={handleExportPDF} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-[1.5rem] hover:text-emerald-600 transition-all shadow-sm active:scale-95">
                                <Download size={20} />
                            </button>
                            <button onClick={resetAllFilters} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-[1.5rem] hover:text-rose-600 transition-all shadow-sm active:scale-95">
                                <RefreshCw size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Actions: Floating UI as requested */}
            <div className="lg:hidden fixed bottom-24 right-6 z-[60] flex flex-col gap-3">
                <button 
                    onClick={resetAllFilters}
                    className="w-12 h-12 bg-white text-slate-400 rounded-full shadow-2xl border-2 border-slate-100 flex items-center justify-center active:rotate-180 transition-all duration-500"
                    title="Refresh Registry"
                >
                    <RefreshCw size={22} />
                </button>
                {['unit', 'super-admin'].includes(currentScope) && (
                    <button 
                        onClick={openAttendModal}
                        className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-600 transition-all active:scale-90 border-4 border-white"
                        title="New Sanitization Task"
                    >
                        <Plus size={32} strokeWidth={3} />
                    </button>
                )}
            </div>

            {/* Desktop-only Search Bar below dashboard for better focus */}
            <div className="hidden lg:block max-w-lg">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search product registry..." 
                        className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-3xl text-sm font-black focus:outline-none focus:border-indigo-500 transition-all shadow-inner uppercase tracking-wider"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
            </div>

            {/* Registry List - Exactly 6 Columns in a Single Row for Desktop */}
            <div className="flex flex-col gap-4">
                {paginatedEntries.map((entry, idx) => {
                    const isFlow = entry.status === 'IN_PROGRESS';
                    const isVerified = entry.isVerified;
                    const isComp = entry.status === 'COMPLETED';
                    const lapseTime = formatLapse(entry.startTime, entry.endTime);
                    
                    // Generate metadata for QR code
                    const qrData = JSON.stringify({
                        id: entry.uuid,
                        product: entry.productName,
                        category: entry.categoryName,
                        chemical: entry.chemicalName,
                        conc: entry.concentration,
                        date: entry.date,
                        operator: entry.userName,
                        verified: entry.isVerified
                    });

                    return (
                        <div 
                            key={entry.uuid} 
                            className={`
                                relative bg-white rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col lg:flex-row group overflow-hidden
                                ${isFlow ? 'border-orange-400 shadow-2xl scale-[1.01]' : isVerified ? 'border-emerald-100 shadow-sm' : 'border-slate-100 shadow-md'}
                            `}
                        >
                            {/* Column 1: Location Hub (Location, department unit, regional) */}
                            <div className="p-6 md:p-8 lg:w-[15%] border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center bg-slate-50/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-md ${isFlow ? 'bg-orange-500 animate-pulse text-white' : 'bg-slate-900 text-white'}`}>
                                        {(currentPage - 1) * rowsPerPage + idx + 1}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-wider w-fit ${isVerified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : isFlow ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                        {isVerified ? 'Verified' : entry.status}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none">{entry.unit}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em]">{entry.regional}</p>
                                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
                                        <MapPin size={10} className="text-indigo-400" />
                                        <span className="text-[9px] font-bold text-slate-500 uppercase truncate">{entry.department} • {entry.location}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Temporal Hub (Date, Time) */}
                            <div className="p-6 md:p-8 lg:w-[12%] border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center gap-3">
                                <div className="flex items-center gap-2.5">
                                    <Calendar size={14} className="text-slate-300" />
                                    <span className="text-sm font-black text-slate-800">{entry.date}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Clock size={14} className="text-slate-300" />
                                    <span className="text-sm font-black text-slate-800">{entry.time}</span>
                                </div>
                                {isFlow && (
                                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-100 animate-in zoom-in-95">
                                        <Timer size={14} className="animate-spin-slow" />
                                        <span className="text-[11px] font-black font-mono tracking-tight">{lapseTime}</span>
                                    </div>
                                )}
                            </div>

                            {/* Column 3: Material Identity (Product Name and category name) */}
                            <div className="p-6 md:p-8 lg:w-[15%] border-b lg:border-b-0 lg:border-r border-slate-100 flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl border-2 border-white shadow-md bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Package size={24} className="text-slate-300" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight truncate leading-tight mb-1">{entry.productName}</h4>
                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase border border-indigo-100 tracking-widest">{entry.categoryName}</span>
                                </div>
                            </div>

                            {/* Column 4: Process Hub (Chemical name, Concentration and contact Time, Photos) */}
                            <div className="p-6 md:p-8 lg:w-[15%] border-b lg:border-b-0 lg:border-r border-slate-100 flex items-center gap-6">
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Beaker size={14} className="text-blue-500 shrink-0" />
                                        <span className="text-[11px] font-black text-slate-700 uppercase truncate leading-none">{entry.chemicalName}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <div className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 flex flex-col">
                                            <span className="text-[7px] font-black text-slate-300 uppercase">Conc.</span>
                                            <span className="text-[10px] font-black text-indigo-600">{entry.concentration}</span>
                                        </div>
                                        <div className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100 flex flex-col">
                                            <span className="text-[7px] font-black text-slate-300 uppercase">Target</span>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.contactTime}</span>
                                        </div>
                                    </div>
                                </div>
                                {entry.photos.length > 0 && (
                                    <div className="w-14 h-14 rounded-2xl border-2 border-white shadow-md overflow-hidden shrink-0 cursor-pointer hover:scale-110 transition-transform">
                                        <img src={entry.photos[0]} className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>

                            {/* QR Column: Digital Passport */}
                            <div className="p-6 md:p-8 lg:w-[10%] border-b lg:border-b-0 lg:border-r border-slate-50 flex flex-col justify-center items-center bg-white shrink-0">
                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-3 flex flex-col items-center gap-2 shadow-inner group/qr transition-all hover:bg-indigo-50 hover:border-indigo-200">
                                    <div className="p-1.5 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <QRCodeSVG value={qrData} size={48} level="H" includeMargin={false} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] group-hover/qr:text-indigo-600 transition-colors">Registry ID</p>
                                    </div>
                                </div>
                            </div>

                            {/* Column 5: Operator Hub (User name, sign and comments box) */}
                            <div className="p-6 md:p-8 lg:w-[15%] border-b lg:border-b-0 lg:border-r border-slate-100 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                                    {entry.userSignature ? <img src={entry.userSignature} className="max-full max-w-full object-contain" /> : <User size={20} className="text-slate-200" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">{entry.userName}</p>
                                    <div className="relative group/comment">
                                        <p className="text-[9px] text-slate-400 italic line-clamp-2 leading-snug cursor-help" title={entry.userComments || 'No comments'}>
                                            "{entry.userComments || '---'}"
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Column 6: Auditor Hub (verification name, sign and comments box) */}
                            <div className="p-6 md:p-8 flex-1 bg-slate-50/50 flex flex-col justify-center">
                                {isVerified ? (
                                    <div className="flex items-center gap-4 w-full">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white shrink-0">
                                            <ShieldCheck size={24} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-emerald-800 uppercase tracking-tight truncate leading-none mb-1">{entry.verifierName}</p>
                                            <p className="text-[9px] text-slate-400 italic line-clamp-1 truncate" title={entry.verifierComments || 'Verified'}>"{entry.verifierComments || 'Log Synchronized'}"</p>
                                        </div>
                                        <button className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors shadow-sm"><History size={16}/></button>
                                    </div>
                                ) : isFlow ? (
                                    <button 
                                        onClick={() => handleComplete(entry.uuid)}
                                        className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <TimerOff size={16} /> End Session
                                    </button>
                                ) : isComp ? (
                                    <button 
                                        onClick={() => handleVerifyOpen(entry)}
                                        className="w-full py-4 bg-amber-400 text-amber-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-amber-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Zap size={16} fill="currentColor" /> Authorize Log
                                    </button>
                                ) : (
                                    <div className="text-[10px] font-black text-slate-300 uppercase text-center py-2 tracking-widest italic">Awaiting Initiation</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredEntries.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
            />

            {/* MODALS */}
            
            {activeModal === 'attend' && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300 h-[92vh] md:h-auto md:max-h-[94vh]">
                        <div className="px-10 py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <FlaskConical size={32} />
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Attend Sanitization</h3>
                                    <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-2">Initialize Lifecycle Node</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-50/20 custom-scrollbar text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Row 1: Category & Product */}
                                <SearchSelect 
                                    label="Product Category" 
                                    options={CATEGORIES} 
                                    value={formInput.categoryName} 
                                    onChange={(val) => setFormInput({
                                        ...formInput, 
                                        categoryName: val, 
                                        productName: MOCK_PRODUCTS[val][0],
                                        concentration: val === "Fruits & Vegetable" ? "50 ppm" : "100 ppm"
                                    })} 
                                    icon={<Layers size={18}/>}
                                />
                                <SearchSelect 
                                    label="Product Identity" 
                                    options={MOCK_PRODUCTS[formInput.categoryName || CATEGORIES[0]]} 
                                    value={formInput.productName} 
                                    onChange={(val) => setFormInput({...formInput, productName: val})} 
                                    icon={<Package size={18}/>}
                                />

                                {/* Row 2: Sanitizer & Hierarchy */}
                                <SearchSelect 
                                    label="Sanitizer Solution" 
                                    options={CHEMICALS} 
                                    value={formInput.chemicalName} 
                                    onChange={(val) => setFormInput({...formInput, chemicalName: val})} 
                                    icon={<Beaker size={18}/>}
                                />
                                <SearchSelect 
                                    label="Unit Context" 
                                    options={MOCK_UNITS} 
                                    value={formInput.unit} 
                                    onChange={(val) => setFormInput({...formInput, unit: val})} 
                                    icon={<Building2 size={18}/>}
                                />

                                {/* Row 3: Dept & Dynamic Concentration */}
                                <SearchSelect 
                                    label="Department Node" 
                                    options={MOCK_DEPTS} 
                                    value={formInput.department} 
                                    onChange={(val) => setFormInput({...formInput, department: val})} 
                                    icon={<Briefcase size={18}/>}
                                />

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Auto-Concentration Level</label>
                                    <div className="w-full h-14 px-5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center justify-between shadow-inner">
                                        <div className="flex items-center gap-3">
                                            <Thermometer size={18} className="text-indigo-600" />
                                            <span className="text-sm font-black text-indigo-900 uppercase">{formInput.concentration || 'TBD'}</span>
                                        </div>
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter">Standardized for {formInput.categoryName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational Evidence</label>
                                    <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
                                        {tempPhotos.map((p, i) => (
                                            <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm">
                                                <img src={p} className="w-full h-full object-cover" />
                                                <button onClick={() => setTempPhotos(tempPhotos.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10}/></button>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => cameraRef.current?.click()}
                                            className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                                        >
                                            <Camera size={20} />
                                            <span className="text-[8px] font-black uppercase">Proof</span>
                                        </button>
                                        <input type="file" ref={cameraRef} capture="environment" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Registry Commentary</label>
                                    <textarea 
                                        className="w-full h-24 p-5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-inner resize-none"
                                        value={formInput.userComments}
                                        onChange={e => setFormInput({...formInput, userComments: e.target.value})}
                                        placeholder="Add context for the audit trail..."
                                    />
                                </div>

                                <SignaturePad onSave={setSignature} label="Operator Authority Signature" />
                            </div>
                        </div>

                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest order-2 sm:order-1 transition-colors">Discard</button>
                            <button 
                                disabled={!signature || !formInput.productName} 
                                onClick={commitAttend} 
                                className={`px-16 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3 order-1 sm:order-2 ${signature && formInput.productName ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                <CheckCheck size={20} /> Save & Start Timer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'verify' && selectedEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-emerald-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-4">
                                <ShieldCheck size={28} strokeWidth={3} />
                                <h3 className="text-xl font-black uppercase tracking-tight leading-none">Authority Node Verification</h3>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        <div className="p-10 space-y-8 bg-slate-50/20 text-left">
                            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-5">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle2 size={24}/></div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Batch to Verify</p>
                                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter truncate">{selectedEntry.productName}</h4>
                                </div>
                            </div>
                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verification Audit Notes</label>
                                <textarea 
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-400 shadow-inner resize-none h-32" 
                                    placeholder="Enter findings for the selected batch..." 
                                    value={formInput.verifierComments} 
                                    onChange={e => setFormInput({...formInput, verifierComments: e.target.value})} 
                                />
                            </div>
                            <SignaturePad onSave={setSignature} label="QA Verifier Authority Signature" />
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setActiveModal(null)} className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Discard</button>
                            <button disabled={!signature} onClick={commitVerify} className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all ${signature ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>Authorize Log</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SanitizationRecord;
