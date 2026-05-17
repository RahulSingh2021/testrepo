"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    Download,
    CheckCircle2,
    // Add missing Info icon import
    Info
} from 'lucide-react';
import { StockItem, StockBatch, StockTransaction, Entity } from '../types';
import UnifiedPagination from './UnifiedPagination';

interface StockRegisterProps {
    inventory: StockItem[];
    setInventory: React.Dispatch<React.SetStateAction<StockItem[]>>;
    onIssue?: (data: any) => void;
    currentEntity?: Entity | null;
}

const DEPARTMENTS = [
    "Main Kitchen", "Banquet Kitchen", "Bakery Section", 
    "Pastry Section", "Butchery", "Cold Kitchen", "Staff Cafeteria"
];

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
                />
            </div>
        </div>
    );
};

const BatchListing: React.FC<{ batches: StockBatch[], unit: string }> = ({ batches, unit }) => {
    const active = batches.filter(b => b.qty > 0);
    if (active.length === 0) return <div className="text-[10px] text-slate-300 font-bold uppercase italic p-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">Terminal Zero</div>;
    
    return (
        <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
            {active.map(b => (
                <div key={b.id} className="group/item">
                    <div className="flex justify-between items-baseline text-[11px] font-black font-mono text-slate-700 group-hover/item:text-[#0099cc] transition-colors">
                        <span>{b.number} <span className="text-slate-300 font-bold">({b.locCode})</span></span>
                        <span>{b.qty.toFixed(2)} <span className="text-[9px] text-slate-400">{unit.toLowerCase()}</span></span>
                    </div>
                    <div className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em] mt-1">
                        MFG: {b.mfg} <span className="text-slate-200 mx-1.5">|</span> EXP: {b.exp}
                    </div>
                </div>
            ))}
        </div>
    );
};

const TransactionRow: React.FC<{ tx: StockTransaction, unit: string }> = ({ tx, unit }) => {
    const isIN = tx.type === 'IN';
    const fromLabel = isIN ? (tx.vendor || 'SUPPLIER') : (tx.location || 'STORAGE');
    const toLabel = isIN ? (tx.location || 'STORAGE') : (tx.issuedTo || 'INTERNAL');

    return (
        <div className="flex flex-col border-b border-slate-100 last:border-0 hover:bg-white/60 transition-all group/tx">
            <div className="py-4 px-10 flex items-center justify-between relative h-[80px]">
                <div className="flex flex-col items-center gap-2 z-10 w-28">
                    <div className={`w-11 h-11 rounded-2xl ${isIN ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-900 text-white shadow-lg'} flex items-center justify-center`}>
                        {isIN ? <Truck size={20} /> : <Warehouse size={20} />}
                    </div>
                    <div className="text-[9px] font-black text-slate-700 uppercase tracking-tighter leading-none text-center truncate w-full">{fromLabel}</div>
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
                    <div className={`w-11 h-11 rounded-2xl ${isIN ? 'bg-slate-900 text-white shadow-lg' : 'bg-blue-50 text-blue-600 border border-blue-100'} flex items-center justify-center`}>
                        {isIN ? <Warehouse size={20} /> : <Store size={20} />}
                    </div>
                    <div className="text-[9px] font-black text-slate-700 uppercase tracking-tighter leading-none text-center truncate w-full">{toLabel}</div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row border-t border-slate-100 bg-white/40">
                <div className="w-full lg:w-[22%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col gap-4 bg-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 text-slate-400 mb-2">
                                <Clock size={12} /> 
                                <span className="text-[10px] font-mono font-black uppercase">{tx.date}</span>
                            </div>
                            <h4 className="text-xs font-black text-[#0099cc] uppercase tracking-tight flex items-center gap-2">
                                {tx.reason}
                                {tx.thawing && (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                        <Snowflake size={8} /> Thawing
                                    </span>
                                )}
                            </h4>
                        </div>
                        {(tx as any).signature && (
                            <div className="w-16 h-8 bg-slate-50 border rounded p-1">
                                <img src={(tx as any).signature} className="max-h-full max-w-full object-contain" />
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
                            <MapPin size={10} /> {tx.location || 'CENTER NODE'}
                        </span>
                    </div>
                </div>

                <div className="w-full lg:w-[26%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
                    <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Opening Registry</span>
                        <span className="text-sm font-black text-slate-900">{tx.openingTotal.toFixed(2)}</span>
                    </div>
                    <BatchListing batches={tx.openingBatches} unit={unit} />
                </div>

                <div className="w-full lg:w-[26%] p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30">
                     <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-100">
                        <div className={`w-2 h-2 rounded-full ${isIN ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{isIN ? 'Entry Specifications' : 'Issuance Distribution'}</span>
                     </div>
                     <div className="space-y-3">
                        {tx.details.map((d, i) => (
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

const StockItemCard: React.FC<{ item: StockItem, index: number, isExpanded: boolean, onToggle: () => void, onIssueClick: () => void }> = ({ item, index, isExpanded, onToggle, onIssueClick }) => {
    const totalStock = item.batches.reduce((sum, b) => sum + b.qty, 0);
    const activeBatches = item.batches.filter(b => b.qty > 0);
    const sortedTransactions = [...item.transactions].reverse();

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden group animate-in fade-in transition-all hover:shadow-xl hover:border-[#0099cc]/30">
            <div className="flex flex-col lg:flex-row min-h-[100px]">
                <div className="p-6 lg:w-[25%] flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                        {index.toString().padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-2">{item.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-mono leading-none">{item.sku}</p>
                    </div>
                </div>

                <div className="p-6 lg:w-56 bg-slate-50/50 border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center shadow-inner">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1 leading-none">Total Registry Balance</span>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-black ${totalStock === 0 ? 'text-red-500' : 'text-slate-900'} tracking-tighter`}>{totalStock.toFixed(2)}</span>
                        <span className="text-[11px] font-black text-slate-300 uppercase">{item.unit}</span>
                    </div>
                </div>

                <div className="flex-1 p-6 relative flex items-center overflow-x-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
                    <div className="flex gap-8 w-full">
                        {activeBatches.length > 0 ? activeBatches.map((b, bidx) => (
                            <div key={b.id} className="min-w-[220px] flex flex-col gap-2 relative group/batch">
                                {bidx < activeBatches.length - 1 && <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-px h-10 bg-slate-100" />}
                                <div className="flex justify-between items-baseline border-b border-slate-50 pb-1">
                                    <span className="text-[12px] font-black text-slate-800 font-mono tracking-tighter uppercase">{b.number} <span className="text-slate-300 ml-1 text-[10px]">({b.locCode})</span></span>
                                    <span className="text-[14px] font-black text-[#0099cc] font-mono">{b.qty.toFixed(2)} <span className="text-[9px] text-slate-300 font-black uppercase">{item.unit}</span></span>
                                </div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex gap-3">
                                    <span className="flex items-center gap-1"><Clock size={10} /> MFG: {b.mfg}</span>
                                    <span className="text-slate-200">|</span>
                                    <span className="flex items-center gap-1 text-rose-400">EXP: {b.exp}</span>
                                </div>
                            </div>
                        )) : <div className="w-full text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">Telemetry Alert: Stock Depleted</div>}
                    </div>
                </div>

                <div className="p-6 lg:w-48 flex flex-col items-center justify-center gap-3 bg-white shrink-0 border-l border-slate-100">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onIssueClick(); }}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95 group/btn"
                     >
                        <MinusCircle size={14} className="group-hover/btn:text-white transition-colors" /> Issue Material
                     </button>
                     
                     <div className="w-full flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Context Loc</span>
                            <span className="text-[11px] font-black text-slate-700 uppercase truncate max-w-[100px] leading-none">{item.defaultLocation}</span>
                        </div>
                        <button 
                            onClick={onToggle}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${isExpanded ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-200'}`}
                        >
                            {isExpanded ? <ChevronUp size={20} strokeWidth={2.5} /> : <ChevronDown size={20} strokeWidth={2.5} />}
                        </button>
                     </div>
                </div>
            </div>

            {isExpanded && (
                <div className="bg-slate-50/30 border-t border-slate-100 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col">
                        {sortedTransactions.length > 0 ? sortedTransactions.map(tx => (
                            <TransactionRow key={tx.id} tx={tx} unit={item.unit} />
                        )) : (
                            <div className="p-12 text-center">
                                <Clock size={32} className="mx-auto mb-3 text-slate-200" />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No Transactional History Recorded</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const StockRegister: React.FC<StockRegisterProps> = ({ inventory, setInventory, onIssue, currentEntity }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Issue Form States
    const [selectedItemId, setSelectedItemId] = useState("");
    const [isItemLocked, setIsItemLocked] = useState(false);
    const [qty, setQty] = useState("");
    const [issuedTo, setIssuedTo] = useState("");
    const [comments, setComments] = useState("");
    const [signature, setSignature] = useState("");
    const [itemSearchText, setItemSearchText] = useState("");
    const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
    const [deptSearchText, setDeptSearchText] = useState("");
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

    // Receive Form States
    const [receiveForm, setReceiveForm] = useState({
        name: "",
        sku: "",
        batch: "",
        qty: "",
        mfg: "",
        exp: "",
        vendor: "",
        location: "MAIN STORAGE",
        unit: "KG"
    });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const deptDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsItemDropdownOpen(false);
            }
            if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
                setIsDeptDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [inventory, searchTerm]);

    const dropdownFilteredInventory = useMemo(() => {
        return inventory.filter(item => 
            item.name.toLowerCase().includes(itemSearchText.toLowerCase()) ||
            item.sku.toLowerCase().includes(itemSearchText.toLowerCase())
        );
    }, [inventory, itemSearchText]);

    const filteredDepts = useMemo(() => {
        return DEPARTMENTS.filter(d => 
            d.toLowerCase().includes(deptSearchText.toLowerCase())
        );
    }, [deptSearchText]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredInventory.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredInventory, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredInventory.length / rowsPerPage);

    const handleTransactionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = parseFloat(qty);
        if (!selectedItemId || !quantity || quantity <= 0 || !signature) return;

        setInventory(prev => {
            return prev.map(item => {
                if (item.id !== selectedItemId) return item;

                const openingTotal = item.batches.reduce((sum, b) => sum + b.qty, 0);
                const openingBatches = JSON.parse(JSON.stringify(item.batches));
                const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
                let details: any[] = [];
                let nextBatches = [...item.batches];

                if (quantity > openingTotal) { alert("Insufficient stock available for issuance."); return item; }
                
                const reason = 'PRODUCTION ISSUE';

                let remaining = quantity;
                nextBatches.sort((a,b) => a.exp.localeCompare(b.exp)); 
                
                nextBatches = nextBatches.map(batch => {
                    if (remaining <= 0 || batch.qty <= 0) return batch;
                    const take = Math.min(batch.qty, remaining);
                    details.push({ number: batch.number, qty: take, mfg: batch.mfg, exp: batch.exp });
                    remaining -= take;
                    return { ...batch, qty: batch.qty - take };
                });

                if (onIssue) {
                    onIssue({
                        productName: item.name,
                        unit: item.unit,
                        items: details,
                        issuedTo: issuedTo || 'Production',
                        location: item.defaultLocation,
                        unitName: currentEntity?.name || 'Unit Alpha'
                    });
                }

                const transaction: StockTransaction = { 
                    id: `t-${Date.now()}`, 
                    type: 'OUT', 
                    reason: reason, 
                    amount: quantity, 
                    date: now, 
                    location: item.defaultLocation, 
                    issuedTo: issuedTo || 'Kitchen Main',
                    thawing: false,
                    openingTotal, 
                    closingTotal: openingTotal - quantity, 
                    openingBatches, 
                    closingBatches: nextBatches, 
                    details, 
                    comments 
                };
                
                (transaction as any).signature = signature;

                return { ...item, batches: nextBatches, transactions: [...item.transactions, transaction] };
            });
        });

        setIsModalOpen(false);
        resetForm();
    };

    const handleReceiveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const quantity = parseFloat(receiveForm.qty);
        if (!receiveForm.name || !quantity || quantity <= 0) return;

        setInventory(prev => {
            const existingIndex = prev.findIndex(item => item.sku === receiveForm.sku || item.name.toLowerCase() === receiveForm.name.toLowerCase());
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            const newBatch: StockBatch = {
                id: `b-${Date.now()}`,
                number: receiveForm.batch,
                locCode: receiveForm.location.substring(0, 2).toUpperCase() + Math.floor(Math.random() * 99),
                qty: quantity,
                mfg: receiveForm.mfg,
                exp: receiveForm.exp,
                vendor: receiveForm.vendor
            };

            const transaction: StockTransaction = {
                id: `t-in-${Date.now()}`,
                type: 'IN',
                reason: 'PURCHASE RECEIPT',
                amount: quantity,
                date: now,
                location: receiveForm.location,
                vendor: receiveForm.vendor,
                openingTotal: 0,
                closingTotal: quantity,
                openingBatches: [],
                closingBatches: [newBatch],
                details: [{ number: newBatch.number, qty: quantity, mfg: newBatch.mfg, exp: newBatch.exp }]
            };

            if (existingIndex !== -1) {
                const existing = prev[existingIndex];
                const openingTotal = existing.batches.reduce((s, b) => s + b.qty, 0);
                const updated = {
                    ...existing,
                    batches: [...existing.batches, newBatch],
                    transactions: [...existing.transactions, {
                        ...transaction,
                        openingTotal,
                        closingTotal: openingTotal + quantity,
                        openingBatches: JSON.parse(JSON.stringify(existing.batches)),
                        closingBatches: [...existing.batches, newBatch]
                    }]
                };
                const next = [...prev];
                next[existingIndex] = updated;
                return next;
            } else {
                const newItem: StockItem = {
                    id: `item-${Date.now()}`,
                    name: receiveForm.name.toUpperCase(),
                    sku: receiveForm.sku || `SKU-${Date.now().toString().slice(-4)}`,
                    unit: receiveForm.unit,
                    defaultLocation: receiveForm.location,
                    batches: [newBatch],
                    transactions: [transaction]
                };
                return [newItem, ...prev];
            }
        });

        setIsReceiveModalOpen(false);
        setReceiveForm({ name: "", sku: "", batch: "", qty: "", mfg: "", exp: "", vendor: "", location: "MAIN STORAGE", unit: "KG" });
    };

    const resetForm = () => {
        setSelectedItemId("");
        setQty("");
        setIssuedTo("");
        setComments("");
        setSignature("");
        setItemSearchText("");
        setDeptSearchText("");
    };

    const openIssueModal = (itemId?: string) => {
        resetForm();
        if (itemId) {
            setSelectedItemId(itemId);
            setIsItemLocked(true);
        } else {
            setIsItemLocked(false);
        }
        setIsModalOpen(true);
    };

    const selectedItem = inventory.find(i => i.id === selectedItemId);
    const currentBalance = selectedItem ? selectedItem.batches.reduce((s, b) => s + b.qty, 0) : 0;
    const remainingAfterIssue = Math.max(0, currentBalance - (parseFloat(qty) || 0));

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] text-slate-900 overflow-hidden font-sans relative">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4 px-4 md:px-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0099cc] transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search Stock Records..." 
                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-[#0099cc] transition-all shadow-inner uppercase tracking-wider"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsReceiveModalOpen(true)}
                        className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 flex items-center gap-2"
                    >
                        <Upload size={14} strokeWidth={3} /> 
                        <span>Receive Stock</span>
                    </button>
                    <button 
                        onClick={() => openIssueModal()}
                        className="px-6 py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 shadow-xl active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={14} strokeWidth={3} /> 
                        <span>Issue Stock</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pb-24 md:pb-6 pr-1 px-4 md:px-0">
                {paginatedItems.map((item, idx) => (
                    <StockItemCard 
                        key={item.id} 
                        item={item} 
                        index={(currentPage - 1) * rowsPerPage + idx + 1}
                        isExpanded={expandedCardId === item.id}
                        onToggle={() => setExpandedCardId(expandedCardId === item.id ? null : item.id)}
                        onIssueClick={() => openIssueModal(item.id)}
                    />
                ))}
                {paginatedItems.length === 0 && (
                    <div className="p-20 text-center text-slate-400 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-widest">No stock records found</p>
                    </div>
                )}
            </div>

            {/* Mobile Floating Action Button */}
            <button 
                onClick={() => openIssueModal()}
                className="md:hidden fixed bottom-28 right-6 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-all z-40 border-4 border-white"
            >
                <Plus size={32} strokeWidth={3} />
            </button>

            <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredInventory.length}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
            />

            {/* RECEIVE MODAL */}
            {isReceiveModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[650px] rounded-t-[3rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 relative border border-slate-100 flex flex-col h-[90vh] md:h-auto max-h-[94vh]">
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Receive Material</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Intake Node</p>
                                </div>
                            </div>
                            <button onClick={() => setIsReceiveModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleReceiveSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                                    <input required placeholder="E.G. CHICKEN THIGH..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.name} onChange={e => setReceiveForm({...receiveForm, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU / Code</label>
                                    <input placeholder="E.G. SKU-001..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.sku} onChange={e => setReceiveForm({...receiveForm, sku: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number</label>
                                    <input required placeholder="BN-..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.batch} onChange={e => setReceiveForm({...receiveForm, batch: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                                    <div className="relative">
                                        <input required type="number" step="0.01" className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black outline-none focus:border-indigo-400 shadow-sm" value={receiveForm.qty} onChange={e => setReceiveForm({...receiveForm, qty: e.target.value})} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">KG</span>
                                    </div>
                                </div>
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                                    <input placeholder="E.G. FREEZER A" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.location} onChange={e => setReceiveForm({...receiveForm, location: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MFG Date</label>
                                    <input required type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.mfg} onChange={e => setReceiveForm({...receiveForm, mfg: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">EXP Date</label>
                                    <input required type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.exp} onChange={e => setReceiveForm({...receiveForm, exp: e.target.value})} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Supplier / Vendor</label>
                                <input placeholder="ENTER VENDOR NAME..." className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-indigo-400 shadow-inner" value={receiveForm.vendor} onChange={e => setReceiveForm({...receiveForm, vendor: e.target.value})} />
                            </div>

                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                                <Info size={16} className="text-emerald-600 mt-0.5" />
                                <p className="text-[10px] text-emerald-800 font-bold uppercase leading-relaxed">Incoming material will be registered as a new batch. If the product already exists, it will be aggregated under the same SKU profile.</p>
                            </div>
                        </form>

                        <div className="px-0 py-6 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button type="button" onClick={() => setIsReceiveModalOpen(false)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancel</button>
                            <button onClick={handleReceiveSubmit} className="px-16 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 size={18} /> Finalize Intake
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ISSUE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-[600px] rounded-t-[3rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-300 relative border border-slate-100 flex flex-col h-[90vh] md:h-auto">
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 text-[#0099cc] rounded-2xl flex items-center justify-center shadow-inner">
                                    <ClipboardList size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Material Issuance</h2>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Stock Allocation</p>
                                </div>
                            </div>
                            <button onClick={() => {setIsModalOpen(false); resetForm();}} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleTransactionSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-6">
                            <div className="space-y-2 relative" ref={dropdownRef}>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Select Material</label>
                                <div 
                                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none flex items-center justify-between transition-all shadow-inner ${isItemLocked ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-white hover:border-[#0099cc]'}`}
                                    onClick={() => !isItemLocked && setIsItemDropdownOpen(!isItemDropdownOpen)}
                                >
                                    <span className={selectedItemId ? "text-slate-800" : "text-slate-300"}>
                                        {selectedItem ? `${selectedItem.name} (${currentBalance.toFixed(2)} ${selectedItem.unit})` : "CHOOSE PRODUCT..."}
                                    </span>
                                    {!isItemLocked && <ChevronDown size={18} className={`text-slate-300 transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} />}
                                </div>

                                {isItemDropdownOpen && !isItemLocked && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input 
                                                    autoFocus
                                                    className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                                                    placeholder="Search product inventory..."
                                                    value={itemSearchText}
                                                    onChange={(e) => setItemSearchText(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                                            {dropdownFilteredInventory.map(item => {
                                                const total = item.batches.reduce((s,b)=>s+b.qty,0);
                                                return (
                                                    <div 
                                                        key={item.id}
                                                        className="px-4 py-3 hover:bg-indigo-50 rounded-xl cursor-pointer flex items-center justify-between group transition-colors"
                                                        onClick={() => {
                                                            setSelectedItemId(item.id);
                                                            setIsItemDropdownOpen(false);
                                                            setItemSearchText("");
                                                        }}
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">{item.name}</div>
                                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.sku}</div>
                                                        </div>
                                                        <div className="text-right shrink-0 ml-4">
                                                            <div className={`text-sm font-black ${total === 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{total.toFixed(1)}</div>
                                                            <div className="text-[8px] font-black text-slate-400 uppercase">{item.unit}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Issuance Qty</label>
                                    <div className="relative">
                                        <input 
                                            type="number" step="0.01" min="0.01" required 
                                            placeholder="0.00" 
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none focus:border-[#0099cc] focus:bg-white transition-all shadow-inner"
                                            value={qty}
                                            onChange={(e) => setQty(e.target.value)}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">{selectedItem?.unit || 'Unit'}</span>
                                    </div>
                                </div>
                                <div className="space-y-2 relative" ref={deptDropdownRef}>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Destination Dept</label>
                                    <div 
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-black text-slate-700 outline-none flex items-center justify-between cursor-pointer hover:bg-white hover:border-[#0099cc] transition-all shadow-inner"
                                        onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                                    >
                                        <span className={issuedTo ? "text-slate-800" : "text-slate-300"}>
                                            {issuedTo || "SELECT TARGET..."}
                                        </span>
                                        <ChevronDown size={18} className={`text-slate-300 transition-transform ${isDeptDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isDeptDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="p-4 bg-slate-50 border-b border-slate-100">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                    <input 
                                                        autoFocus
                                                        className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                                                        placeholder="Search department..."
                                                        value={deptSearchText}
                                                        onChange={(e) => setDeptSearchText(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar p-2">
                                                {filteredDepts.map(dept => (
                                                    <div 
                                                        key={dept}
                                                        className="px-4 py-3 hover:bg-indigo-50 rounded-xl cursor-pointer text-xs font-black text-slate-800 uppercase transition-colors"
                                                        onClick={() => {
                                                            setIssuedTo(dept);
                                                            setIsDeptDropdownOpen(false);
                                                            setDeptSearchText("");
                                                        }}
                                                    >
                                                        {dept}
                                                    </div>
                                                ))}
                                                {filteredDepts.length === 0 && (
                                                    <div className="px-4 py-3 text-xs text-slate-400 italic text-center">No departments match</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Real-time Balance Display */}
                            {selectedItem && (
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600">
                                            <ArrowRightLeftIcon size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Stock Projection</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-600">{currentBalance.toFixed(2)}</span>
                                                <ArrowRight size={10} className="text-slate-300" />
                                                <span className={`text-xs font-black ${remainingAfterIssue < 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {remainingAfterIssue.toFixed(2)}
                                                </span>
                                                <span className="text-[9px] font-black text-slate-300 uppercase">{selectedItem.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {remainingAfterIssue < 5 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl text-[9px] font-black uppercase border border-rose-200 animate-pulse">
                                            <AlertCircle size={12} /> Low Stock Alert
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Internal Reference Notes</label>
                                <textarea 
                                    rows={2} 
                                    placeholder="Add any specific context for this issuance..." 
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-medium text-slate-700 resize-none outline-none focus:border-[#0099cc] focus:bg-white shadow-inner"
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                />
                            </div>

                            <SignaturePad onSave={setSignature} initialData={signature} label="Verifier Authority Auth" />
                        </form>

                        <div className="px-0 py-6 border-t border-slate-100 bg-white flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button 
                                type="button" 
                                onClick={() => {setIsModalOpen(false); resetForm();}} 
                                className="w-full md:w-auto px-10 py-4 rounded-2xl font-black text-[11px] uppercase text-slate-500 hover:bg-slate-50 transition-colors tracking-widest"
                            >
                                Discard
                            </button>
                            <button 
                                onClick={handleTransactionSubmit}
                                disabled={!selectedItemId || !qty || !signature || !issuedTo}
                                className="w-full md:w-auto px-16 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl shadow-slate-200 hover:bg-black active:scale-95 transition-all tracking-[0.2em] disabled:opacity-30 disabled:grayscale"
                            >
                                Finalize Issue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ArrowRightLeftIcon = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
    </svg>
);

export default StockRegister;