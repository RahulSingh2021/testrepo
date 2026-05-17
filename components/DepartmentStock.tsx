
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { compressImage } from '@/utils/imageCompression';
import { 
    Package, 
    Plus, 
    ChevronDown, 
    ChevronUp, 
    ChevronLeft, 
    ChevronRight,
    ClipboardList,
    Truck,
    Store,
    Warehouse,
    ArrowRight,
    MapPin,
    Clock,
    Upload,
    Snowflake,
    X,
    Search,
    Filter,
    PenTool,
    Eraser,
    Check,
    AlertCircle,
    MinusCircle,
    CheckCircle2,
    History as HistoryIcon,
    TrendingUp,
    AlertTriangle,
    ShieldCheck,
    Info,
    ArrowRightLeft
} from 'lucide-react';
import { DeptStockItem, DeptStockBatch, DeptStockTransaction, Entity } from '../types';
import UnifiedPagination from './UnifiedPagination';

interface DepartmentStockProps {
    deptStock: DeptStockItem[];
    setDeptStock: React.Dispatch<React.SetStateAction<DeptStockItem[]>>;
    onPullForThawing?: (deptItem: DeptStockItem, pullQty: number, signature: string, details: any[]) => void;
}

// --- Sub-Components ---

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Staff Authorization" }) => {
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

const BatchListing: React.FC<{ batches: DeptStockBatch[], unit: string }> = ({ batches, unit }) => {
    const active = (batches || []).filter(b => b.quantity > 0);
    if (active.length === 0) return <div className="text-[10px] text-slate-300 font-bold uppercase italic p-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">Registry Depleted</div>;
    
    return (
        <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            {active.map(b => (
                <div key={b.id} className="group/item">
                    <div className="flex justify-between items-baseline text-[11px] font-black font-mono text-slate-700 group-hover/item:text-indigo-600 transition-colors">
                        <span>{b.number} <span className="text-slate-300 font-bold">({b.location})</span></span>
                        <span>{b.quantity.toFixed(2)} <span className="text-[9px] text-slate-400">{unit.toLowerCase()}</span></span>
                    </div>
                    <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em] mt-1">
                        MFG: {b.mfgDate} <span className="text-slate-200 mx-1.5">|</span> EXP: {b.expDate}
                    </div>
                </div>
            ))}
        </div>
    );
};

const TransactionRow: React.FC<{ tx: DeptStockTransaction, unit: string }> = ({ tx, unit }) => {
    const isIN = tx.type === 'IN';

    return (
        <div className="flex flex-col border-b border-slate-100 last:border-0 hover:bg-white/60 transition-all group/tx">
            {/* Header: Horizontal Handshake Flow */}
            <div className="py-4 px-10 flex items-center justify-between relative h-[80px]">
                <div className="flex flex-col items-center gap-2 z-10 w-28">
                    <div className={`w-11 h-11 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center justify-center`}>
                        <Warehouse size={20} />
                    </div>
                    <div className="text-[9px] font-black text-slate-700 uppercase tracking-tighter leading-none text-center truncate w-full">{tx.sourceNode}</div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center relative px-6 mx-6">
                    <div className="absolute top-[22px] left-0 w-full h-px bg-slate-200 z-0" />
                    <div className={`relative z-10 border-2 px-5 py-1.5 rounded-full text-[11px] font-black shadow-xl mb-1 bg-white ${isIN ? 'text-emerald-600 border-emerald-100' : 'text-rose-600 border-rose-100'}`}>
                        {isIN ? '+' : '-'} {tx.amount.toFixed(2)} {unit}
                    </div>
                    <div className="bg-white px-2 relative z-10 text-slate-300">
                        <ArrowRight size={14} strokeWidth={3} />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 z-10 w-28">
                    <div className={`w-11 h-11 rounded-2xl ${isIN ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-blue-50 text-blue-600 border border-blue-100'} flex items-center justify-center shadow-sm`}>
                        {isIN ? <Store size={20} /> : <Snowflake size={20} />}
                    </div>
                    <div className="text-[9px] font-black text-slate-700 uppercase tracking-tighter leading-none text-center truncate w-full">{tx.destinationNode}</div>
                </div>
            </div>

            {/* Body: 3-Column Ledger */}
            <div className="flex flex-col lg:flex-row border-t border-slate-100 bg-white/40">
                {/* Meta Column */}
                <div className="w-full lg:w-[22%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col gap-4 bg-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                <Clock size={12} /> 
                                <span className="text-[10px] font-mono font-black uppercase">{tx.date}</span>
                            </div>
                            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-tight flex items-center gap-2">
                                {tx.reason}
                            </h4>
                        </div>
                        {tx.signature && (
                            <div className="w-16 h-8 bg-slate-50 border rounded p-1">
                                <img src={tx.signature} className="w-full h-full object-contain mix-blend-multiply opacity-80" />
                            </div>
                        )}
                    </div>
                    {tx.comments && (
                        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[10px] text-amber-900 font-bold italic leading-relaxed">
                            "{tx.comments}"
                        </div>
                    )}
                    <div className="mt-auto">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit border border-slate-200">
                            <MapPin size={10} /> UNIT REGISTRY
                        </span>
                    </div>
                </div>

                {/* Ledger Column 1: Opening Registry */}
                <div className="w-full lg:w-[26%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Opening Registry</span>
                        <span className="text-sm font-black text-slate-900">{tx.openingTotal.toFixed(2)}</span>
                    </div>
                    <BatchListing batches={tx.openingBatches} unit={unit} />
                </div>

                {/* Ledger Column 2: Distribution/Issue */}
                <div className="w-full lg:w-[26%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30">
                     <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-100">
                        <div className={`w-2 h-2 rounded-full ${isIN ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{isIN ? 'Handshake Receipt' : 'Issuance Distribution'}</span>
                     </div>
                     <div className="space-y-3">
                        {(tx.details || []).map((d, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow group/detail">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                         <p className="text-11px font-black text-slate-800 uppercase tracking-tight font-mono">{d.number}</p>
                                         <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-1.5 flex gap-2">
                                            <span>MFG: {d.mfg}</span>
                                            <span>EXP: {d.exp}</span>
                                         </div>
                                    </div>
                                    <span className={`text-[13px] font-black font-mono ${isIN ? 'text-emerald-600' : 'text-rose-600'}`}>
                                       {isIN ? '+' : '-'} {d.qty.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                     </div>
                </div>

                {/* Ledger Column 3: Closing Registry */}
                <div className="w-full lg:w-[26%] p-6 relative bg-white">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Closing Registry</span>
                        <span className="text-sm font-black text-slate-900">{tx.closingTotal.toFixed(2)}</span>
                    </div>
                    <BatchListing batches={tx.closingBatches} unit={unit} />
                </div>
            </div>
        </div>
    );
};

// --- Main Components ---

const DepartmentStock: React.FC<DepartmentStockProps> = ({ deptStock, setDeptStock, onPullForThawing }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [expandedProductNames, setExpandedProductNames] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);
    
    // Thawing Form Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DeptStockItem | null>(null);
    const [pullQty, setPullQty] = useState("");
    const [signature, setSignature] = useState("");
    const [comments, setComments] = useState("");

    const filteredGroups = useMemo(() => {
        const s = searchTerm.toLowerCase();
        return (deptStock || []).filter(item => 
            (item.name?.toLowerCase() || "").includes(s) ||
            (item.batches || []).some(b => (b.number?.toLowerCase() || "").includes(s))
        );
    }, [deptStock, searchTerm]);

    const paginatedGroups = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredGroups.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredGroups, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredGroups.length / rowsPerPage);

    const toggleExpand = (name: string) => {
        const next = new Set(expandedProductNames);
        if (next.has(name)) next.delete(name); else next.add(name);
        setExpandedProductNames(next);
    };

    const handlePullSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = parseFloat(pullQty);
        if (!selectedItem || !quantity || quantity <= 0 || !signature) return;

        let syncDetails: any[] = [];

        setDeptStock(prev => {
            return prev.map(item => {
                if (item.id !== selectedItem.id) return item;

                const openingTotal = (item.batches || []).reduce((sum, b) => sum + (b.quantity || 0), 0);
                const openingBatches = JSON.parse(JSON.stringify(item.batches || []));
                const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
                let details: any[] = [];
                let nextBatches = [...(item.batches || [])];

                if (quantity > openingTotal) { 
                    alert("Insufficient departmental stock available for thawing."); 
                    return item; 
                }

                // FEFO LOGIC (First Expired First Out)
                let remaining = quantity;
                nextBatches.sort((a,b) => (a.expDate || "").localeCompare(b.expDate || "")); 
                
                nextBatches = nextBatches.map(batch => {
                    if (remaining <= 0 || (batch.quantity || 0) <= 0) return batch;
                    const take = Math.min(batch.quantity, remaining);
                    details.push({ 
                        number: batch.number, 
                        qty: take, 
                        mfg: batch.mfgDate, 
                        exp: batch.expDate,
                        rec: batch.receivingDate,
                        location: batch.location
                    });
                    remaining -= take;
                    return { ...batch, quantity: batch.quantity - take };
                });

                syncDetails = details;

                const transaction: DeptStockTransaction = { 
                    id: `t-out-${Date.now()}`, 
                    type: 'OUT', 
                    reason: 'THAWING CYCLE INITIATION', 
                    amount: quantity, 
                    date: nowStr, 
                    sourceNode: 'Department Storage',
                    destinationNode: 'Thawing Unit',
                    openingTotal, 
                    closingTotal: openingTotal - quantity, 
                    openingBatches, 
                    closingBatches: nextBatches, 
                    details,
                    signature,
                    comments
                };

                return { ...item, batches: nextBatches, transactions: [...(item.transactions || []), transaction] };
            });
        });

        if (onPullForThawing && syncDetails.length > 0) {
            onPullForThawing(selectedItem, quantity, signature, syncDetails);
        }

        setIsModalOpen(false);
        setSelectedItem(null);
        setPullQty("");
        setSignature("");
        setComments("");
    };

    const stats = useMemo(() => {
        const totalSKUs = filteredGroups.length;
        const totalWeight = (deptStock || []).reduce((acc, curr) => acc + (curr.batches || []).reduce((sum, b) => sum + (b.quantity || 0), 0), 0);
        const nearExpiry = (deptStock || []).filter(item => {
            return (item.batches || []).some(b => {
                if ((b.quantity || 0) <= 0 || !b.expDate) return false;
                const exp = new Date(b.expDate);
                const diff = (exp.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                return diff <= 7;
            });
        }).length;
        return { totalSKUs, totalWeight, nearExpiry };
    }, [filteredGroups, deptStock]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-700 p-1">
            
            {/* KPI RIBBON */}
            <div className="flex overflow-x-auto gap-4 snap-x hide-scrollbar pb-1">
                {[
                    { label: 'Registry Fleet', val: stats.totalSKUs, color: 'bg-indigo-600', icon: Package },
                    { label: 'Dept Load', val: `${stats.totalWeight.toFixed(1)} KG`, color: 'bg-emerald-500', icon: TrendingUp },
                    { label: 'Expiry Risk', val: stats.nearExpiry, color: 'bg-rose-500', icon: AlertTriangle }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 min-w-[240px] snap-center shrink-0">
                        <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0`}>
                            <stat.icon size={22} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-2xl font-black text-slate-800 tracking-tighter">{stat.val}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ACTION BAR */}
            <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                <div className="flex items-center gap-5 z-10">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner border border-indigo-100">
                        <Store size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Dept Stock Ledger</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                            <ShieldCheck size={12} className="text-emerald-500" /> Functional Mirror of Master Registry
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full md:w-auto">
                    <div className="relative group w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Filter registry..." 
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase tracking-wider"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 transition-all shadow-sm active:scale-95">
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* LEDGER LIST */}
            <div className="space-y-4">
                {paginatedGroups.map((item, idx) => {
                    const isExpanded = expandedProductNames.has(item.name);
                    const currentActualBalance = (item.batches || []).reduce((acc, curr) => acc + (curr.quantity || 0), 0);

                    return (
                        <div key={item.id} className={`bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden group/card hover:shadow-xl hover:border-indigo-200 transition-all`}>
                            <div className="flex flex-col lg:flex-row min-h-[100px]">
                                <div className="p-6 lg:w-[25%] flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                                        {(idx + 1 + (currentPage - 1) * rowsPerPage).toString().padStart(2, '0')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-2">{item.name}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">{(item.batches || []).length} Managed Batches</p>
                                    </div>
                                </div>

                                <div className="p-6 lg:w-56 bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center shadow-inner">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 leading-none">Actual Balance</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-3xl font-black ${currentActualBalance === 0 ? 'text-slate-300' : 'text-slate-900'} tracking-tighter transition-colors`}>{currentActualBalance.toFixed(2)}</span>
                                        <span className="text-[11px] font-black text-slate-300 uppercase">{item.unit}</span>
                                    </div>
                                </div>

                                <div className="flex-1 p-6 relative flex items-center overflow-x-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
                                    <div className="flex gap-8 w-full">
                                        {(item.batches || []).filter(b => b.quantity > 0).slice(0, 3).map((batch, bidx) => (
                                            <div key={batch.id} className="min-w-[200px] flex flex-col gap-2 relative group/batch">
                                                <div className="flex justify-between items-baseline border-b border-slate-50 pb-1">
                                                    <span className="text-[12px] font-black text-slate-800 font-mono tracking-tighter uppercase">{batch.number}</span>
                                                    <span className="text-[14px] font-black text-indigo-500 font-mono">{(batch.quantity || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex gap-3">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {batch.expDate}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {(item.batches || []).filter(b => b.quantity > 0).length > 3 && (
                                            <div className="flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                +{(item.batches || []).filter(b => b.quantity > 0).length - 3} More
                                            </div>
                                        )}
                                        {(item.batches || []).filter(b => b.quantity > 0).length === 0 && (
                                            <div className="w-full text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Telemetry Alert: Stock Exhausted</div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6 lg:w-48 flex flex-col items-center justify-center gap-3 bg-white shrink-0">
                                     <button 
                                        disabled={currentActualBalance === 0}
                                        onClick={() => { setSelectedItem(item); setPullQty(currentActualBalance.toString()); setIsModalOpen(true); }}
                                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale"
                                     >
                                        <Snowflake size={14} /> Pull for Thawing
                                     </button>
                                     <button 
                                        onClick={() => toggleExpand(item.name)}
                                        className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isExpanded ? 'bg-slate-900 text-white shadow-indigo-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                                     >
                                        {isExpanded ? <ChevronUp size={14} /> : <HistoryIcon size={14} />}
                                        {isExpanded ? 'Close Ledger' : 'View Ledger'}
                                     </button>
                                </div>
                            </div>

                            {/* LEDGER EXPANDED VIEW */}
                            {isExpanded && (
                                <div className="bg-slate-50/30 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex flex-col">
                                        {[...(item.transactions || [])].reverse().map(tx => (
                                            <TransactionRow 
                                                key={tx.id} 
                                                tx={tx} 
                                                unit={item.unit} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {paginatedGroups.length === 0 && (
                    <div className="py-40 flex flex-col items-center justify-center text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 text-slate-200 shadow-inner">
                            <Store size={48} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Zero Registry Data</h3>
                        <p className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-[0.25em] max-w-sm leading-loose">
                            Functional nodes will populate once material is issued from the <span className="text-indigo-600 underline">Master Stock Register</span>.
                        </p>
                    </div>
                )}
            </div>

            <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredGroups.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
            />

            {/* THAWING PULL MODAL */}
            {isModalOpen && selectedItem && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[600px] rounded-t-[3rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 relative border border-slate-100 flex flex-col h-[90vh] md:h-auto">
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <Snowflake size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thawing Induction</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Process Initiation (FEFO)</p>
                                </div>
                            </div>
                            <button onClick={() => {setIsModalOpen(false); setSelectedItem(null);}} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handlePullSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8 pb-6 text-left">
                            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-2 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><Package size={64}/></div>
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Source Material Registry</p>
                                <h4 className="text-xl font-black uppercase tracking-tight">{selectedItem.name}</h4>
                                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                                    <div>
                                        <p className="text-[8px] font-black text-white/40 uppercase">Total Available</p>
                                        <p className="text-lg font-black text-indigo-400">{(selectedItem.batches || []).reduce((s,b)=>s+(b.quantity || 0), 0).toFixed(2)} {selectedItem.unit}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-white/40 uppercase">FEFO Rule</p>
                                        <p className="text-xs font-bold text-emerald-400 uppercase">Oldest Expiring First</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Transfer Quantity ({selectedItem.unit})</label>
                                <div className="relative">
                                    <input 
                                        autoFocus
                                        type="number" step="0.01" min="0.01" max={(selectedItem.batches || []).reduce((s,b)=>s+(b.quantity || 0), 0)} required 
                                        placeholder="0.00" 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-3xl font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner text-center"
                                        value={pullQty}
                                        onChange={(e) => setPullQty(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Audit Notes</label>
                                <textarea 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 resize-none h-20"
                                    placeholder="Enter reasoning for pull..."
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex items-start gap-4">
                                <Info size={20} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-700 font-bold uppercase leading-relaxed tracking-wide">
                                    This action generates an <span className="font-black">OUT</span> transaction in the department ledger and a <span className="font-black">PENDING</span> record in the Thawing Registry.
                                </p>
                            </div>

                            <SignaturePad onSave={setSignature} initialData={signature} label="Auth Node Commitment" />
                        </form>

                        <div className="px-0 py-6 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button 
                                type="button" 
                                onClick={() => {setIsModalOpen(false); setSelectedItem(null);}} 
                                className="w-full md:w-auto px-10 py-4 rounded-2xl font-black text-[11px] uppercase text-slate-500 hover:bg-slate-50 transition-colors tracking-widest"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={handlePullSubmit}
                                disabled={!pullQty || parseFloat(pullQty) <= 0 || parseFloat(pullQty) > (selectedItem.batches || []).reduce((s,b)=>s+(b.quantity || 0), 0) || !signature}
                                className="w-full md:w-auto px-16 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <CheckCircle2 size={20} strokeWidth={3} /> Finalize Induction
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentStock;
