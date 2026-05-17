
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Search, Plus, Trash2, RefreshCw, FileDown, 
    X, Check, ChevronDown, ChevronLeft, ChevronRight,
    Building2, Tag, Calendar, Package, Factory, 
    Thermometer, Layers, Clock, Warehouse, Store,
    ArrowRight,
    Scale,
    AlertCircle
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { YieldProduct, YieldVariant, YieldStorage } from '../types';
import UnifiedPagination from './UnifiedPagination';

const YIELD_NAME_OPTIONS = ["Mutton keema", "Mutton Boneless", "Mutton Curry cut staff", "Mutton Curry Cut Guest", "Mutton Chop"];
const STORAGE_OPTIONS = ["Direct issue for cooking", "Stored in freezer", "Stored in chiller"];
const OUTLET_OPTIONS = ["Main Kitchen", "Bakery", "QSR"];

const INITIAL_DATA: YieldProduct[] = [
    { productName: "Glutamine", id: "100", vendorName: "PharmaSupply Co.", brandName: "NutriMax", receivingDate: "2025-08-20", batchNumber: "BATCH-00123", processingDate: "2025-08-21", expiryDate: "2027-08-20", tags: ["Wellness Holdings", "Asia-Pacific", "Recovery Labs"], uploadedBy: "David Chen", totalWeight: 500, balanceWeight: 200, lastUpdated: "2025-08-25T10:00:00.000Z", specificationName: "Glutamine Spec v1.0", variants: [{id: 11, yieldName: "Mutton keema", weight: 50, storage: [{type: "Stored in freezer", qty: 50}] }] },
    { productName: "Ashwagandha Extract", id: "101", vendorName: "Herbal Essence Ltd.", brandName: "KSM-66", receivingDate: "2025-08-18", batchNumber: "BATCH-AE-556", processingDate: "2025-08-19", expiryDate: "2026-08-18", tags: ["Herbal Essence Ltd.", "KSM-66"], uploadedBy: "Sarah Lee", totalWeight: 1000, balanceWeight: 850, lastUpdated: "2025-08-24T12:00:00.000Z", specificationName: "Ashwagandha Spec v2.1", variants: [{id: 12, yieldName: "Mutton Boneless", weight: 150, storage: [{type: "Stored in chiller", qty: 100}, {type: "Direct issue for cooking", qty: 50, outlet: "Main Kitchen"}] }] },
    { productName: "Omega-3 Fish Oil", id: "102", vendorName: "Ocean Nutrients", brandName: "MegaOmega", receivingDate: "2025-08-22", batchNumber: "BATCH-O3-987", processingDate: "2025-08-23", expiryDate: "2027-02-22", tags: ["Ocean Nutrients", "MegaOmega"], uploadedBy: "David Chen", totalWeight: 200, balanceWeight: 200, lastUpdated: "2025-08-23T09:00:00.000Z", specificationName: null, variants: [] },
    { productName: "Creatine Monohydrate", id: "103", vendorName: "Bulk Powders Inc.", brandName: "Creapure", receivingDate: "2025-08-15", batchNumber: "BATCH-CM-451", processingDate: "2025-08-16", expiryDate: "2028-08-15", tags: ["Bulk Powders Inc.", "Creapure"], uploadedBy: "Mike Johnson", totalWeight: 2500, balanceWeight: 1250, lastUpdated: "2025-08-22T14:00:00.000Z", specificationName: "Creatine Monohydrate Spec v2.1", variants: [{id: 13, yieldName: "Mutton Curry cut staff", weight: 750, storage: [] }, {id: 14, yieldName: "Mutton Curry Cut Guest", weight: 500, storage: [{type: "Direct issue for cooking", qty: 500, outlet: "QSR"}] }] },
];

const YieldRegister: React.FC = () => {
    const [products, setProducts] = useState<YieldProduct[]>(INITIAL_DATA);
    const [searchTerm, setSearchTerm] = useState("");
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Form States for adding new entries
    const [activeAddVariantProductId, setActiveAddVariantProductId] = useState<string | null>(null);
    const [newVariant, setNewVariant] = useState({ yieldName: '', weight: '' });
    
    const [activeAddStorageVariantId, setActiveAddStorageVariantId] = useState<number | null>(null);
    const [newStorage, setNewStorage] = useState({ type: '', qty: '', outlet: '' });

    // --- Calculations ---

    const recalculateBalance = (product: YieldProduct) => {
        const totalYield = product.variants.reduce((sum, v) => sum + v.weight, 0);
        return product.totalWeight - totalYield;
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // --- Handlers ---

    const handleAddVariant = (productId: string) => {
        if (!newVariant.yieldName || !newVariant.weight) return;
        const weightNum = parseFloat(newVariant.weight);
        
        setProducts(prev => prev.map(p => {
            if (p.id !== productId) return p;
            const currentTotal = p.variants.reduce((s, v) => s + v.weight, 0);
            if (currentTotal + weightNum > p.totalWeight) {
                alert("Weight exceeds received quantity limit.");
                return p;
            }
            const updated = {
                ...p,
                variants: [...p.variants, { id: Date.now(), yieldName: newVariant.yieldName, weight: weightNum, storage: [] }],
                lastUpdated: new Date().toISOString()
            };
            updated.balanceWeight = recalculateBalance(updated);
            return updated;
        }));
        setNewVariant({ yieldName: '', weight: '' });
        setActiveAddVariantProductId(null);
    };

    const handleRemoveVariant = (productId: string, variantId: number) => {
        if (!window.confirm("Remove this yield variant?")) return;
        setProducts(prev => prev.map(p => {
            if (p.id !== productId) return p;
            const updated = {
                ...p,
                variants: p.variants.filter(v => v.id !== variantId),
                lastUpdated: new Date().toISOString()
            };
            updated.balanceWeight = recalculateBalance(updated);
            return updated;
        }));
    };

    const handleAddStorage = (variantId: number) => {
        if (!newStorage.type || !newStorage.qty) return;
        const qtyNum = parseFloat(newStorage.qty);

        setProducts(prev => prev.map(p => {
            const variantIndex = p.variants.findIndex(v => v.id === variantId);
            if (variantIndex === -1) return p;

            const variant = p.variants[variantIndex];
            const currentStorageTotal = variant.storage.reduce((s, st) => s + st.qty, 0);
            
            if (currentStorageTotal + qtyNum > variant.weight) {
                alert("Storage quantity cannot exceed yield weight.");
                return p;
            }

            const updatedVariants = [...p.variants];
            updatedVariants[variantIndex] = {
                ...variant,
                storage: [...variant.storage, { type: newStorage.type, qty: qtyNum, outlet: newStorage.outlet }]
            };

            return { ...p, variants: updatedVariants, lastUpdated: new Date().toISOString() };
        }));

        setNewStorage({ type: '', qty: '', outlet: '' });
        setActiveAddStorageVariantId(null);
    };

    const handleRemoveStorage = (variantId: number, storageIndex: number) => {
        setProducts(prev => prev.map(p => {
            const variantIndex = p.variants.findIndex(v => v.id === variantId);
            if (variantIndex === -1) return p;

            const updatedVariants = [...p.variants];
            const variant = updatedVariants[variantIndex];
            updatedVariants[variantIndex] = {
                ...variant,
                storage: variant.storage.filter((_, i) => i !== storageIndex)
            };

            return { ...p, variants: updatedVariants, lastUpdated: new Date().toISOString() };
        }));
    };

    // --- Filter & Pagination ---

    const filteredData = useMemo(() => {
        const query = searchTerm.toLowerCase();
        return products.filter(p => 
            p.productName.toLowerCase().includes(query) ||
            p.vendorName.toLowerCase().includes(query) ||
            p.variants.some(v => v.yieldName.toLowerCase().includes(query))
        ).sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    }, [products, searchTerm]);

    const paginatedData = useMemo(() => {
        if (rowsPerPage === 0) return filteredData;
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    // Fix: Defined totalItems and totalPages to resolve reference errors in JSX
    const totalItems = filteredData.length;
    const totalPages = rowsPerPage === 0 ? 1 : Math.ceil(totalItems / rowsPerPage);

    // --- Export ---

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Yield Record');
        
        worksheet.columns = [
            { header: 'Product', key: 'product', width: 20 },
            { header: 'Vendor', key: 'vendor', width: 15 },
            { header: 'Yield Name', key: 'yield', width: 20 },
            { header: 'Weight (KG)', key: 'weight', width: 12 },
            { header: 'Storage', key: 'storage', width: 25 },
            { header: 'Qty', key: 'qty', width: 10 },
        ];

        filteredData.forEach(p => {
            if (p.variants.length === 0) {
                worksheet.addRow({ product: p.productName, vendor: p.vendorName });
            } else {
                p.variants.forEach(v => {
                    if (v.storage.length === 0) {
                        worksheet.addRow({ product: p.productName, vendor: p.vendorName, yield: v.yieldName, weight: v.weight });
                    } else {
                        v.storage.forEach(s => {
                            worksheet.addRow({ 
                                product: p.productName, 
                                vendor: p.vendorName, 
                                yield: v.yieldName, 
                                weight: v.weight, 
                                storage: s.type + (s.outlet ? ` (${s.outlet})` : ''), 
                                qty: s.qty 
                            });
                        });
                    }
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Yield_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-500">
            {/* Action Bar */}
            <div className="bg-white p-6 rounded-t-3xl border-b border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <Factory size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Yield & Production Registry</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Operational Material Breakdown</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by product or yield..." 
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner uppercase"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <button onClick={handleExport} className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all shadow-sm active:scale-95" title="Export to Excel">
                        <FileDown size={22} />
                    </button>
                    <button onClick={() => setProducts(INITIAL_DATA)} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 transition-all shadow-sm active:scale-95" title="Refresh">
                        <RefreshCw size={22} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="overflow-x-auto custom-scrollbar">
                {/* Desktop Table View */}
                <table className="hidden lg:table w-full text-left border-collapse min-w-[1200px]">
                    <thead className="bg-[#1e293b] text-white text-[10px] font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                        <tr>
                            <th className="p-6 w-16 text-center">#</th>
                            <th className="p-6 w-[280px]">Source Identity</th>
                            <th className="p-6 w-[320px]">Product Context</th>
                            <th className="p-6 w-[200px]">Stock Analytics</th>
                            <th className="p-6 w-[300px]">Yield Variants</th>
                            <th className="p-6">Final Storage</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {paginatedData.map((p, idx) => (
                            <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="p-6 text-center font-mono text-[10px] text-slate-400 font-bold">
                                    {(currentPage - 1) * rowsPerPage + idx + 1}
                                </td>
                                
                                {/* 1. Source Identity */}
                                <td className="p-6 align-top">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Building2 size={16}/></div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Partner</p>
                                                <p className="text-xs font-black text-slate-800 truncate uppercase">{p.vendorName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Tag size={16}/></div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Identity</p>
                                                <p className="text-xs font-black text-slate-800 truncate uppercase">{p.brandName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><Calendar size={16}/></div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Received</p>
                                                <p className="text-xs font-bold text-slate-600 uppercase">{formatDate(p.receivingDate)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 2. Product Details */}
                                <td className="p-6 align-top">
                                    <div className="flex flex-col h-full">
                                        <h3 className="text-lg font-black text-indigo-700 leading-none uppercase tracking-tight mb-2">{p.productName}</h3>
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {p.tags.map(t => (
                                                <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase border border-slate-200">{t}</span>
                                            ))}
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 shadow-inner">
                                            <div className="flex justify-between text-[10px]">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest">Registry ID</span>
                                                <span className="font-black text-slate-700 uppercase">{p.batchNumber}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest">Processed</span>
                                                <span className="font-bold text-slate-600 uppercase">{formatDate(p.processingDate)}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px]">
                                                <span className="font-bold text-slate-400 uppercase tracking-widest">Expires</span>
                                                <span className="font-black text-rose-600 uppercase">{formatDate(p.expiryDate)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 3. Stock Analytics */}
                                <td className="p-6 align-top bg-slate-50/30">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Total Intake</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-black text-slate-900 tracking-tighter">{p.totalWeight}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">KG</span>
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Available Registry</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-2xl font-black tracking-tighter ${p.balanceWeight > 0 ? 'text-indigo-600' : 'text-rose-500'}`}>{p.balanceWeight.toFixed(2)}</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">KG</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 4. Yield Variants */}
                                <td className="p-6 align-top border-x border-slate-100">
                                    <div className="space-y-4">
                                        {p.variants.map(v => (
                                            <div key={v.id} className="bg-white border-2 border-slate-100 rounded-2xl p-4 shadow-sm group/variant hover:border-indigo-200 transition-all">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none">{v.yieldName}</p>
                                                        <p className="text-[10px] font-black text-indigo-500 mt-1.5">{v.weight.toFixed(2)} KG</p>
                                                    </div>
                                                    <button onClick={() => handleRemoveVariant(p.id, v.id)} className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover/variant:opacity-100"><Trash2 size={16}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        {activeAddVariantProductId === p.id ? (
                                            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 shadow-xl animate-in zoom-in-95 space-y-3">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase">New Yield</span>
                                                    <button onClick={() => setActiveAddVariantProductId(null)}><X size={14}/></button>
                                                </div>
                                                <select 
                                                    className="w-full bg-slate-50 border rounded-xl p-2 text-xs font-bold outline-none uppercase"
                                                    value={newVariant.yieldName}
                                                    onChange={e => setNewVariant({...newVariant, yieldName: e.target.value})}
                                                >
                                                    <option value="">Select Part...</option>
                                                    {YIELD_NAME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                                <input 
                                                    type="number" step="0.01" placeholder="Weight KG" 
                                                    className="w-full bg-slate-50 border rounded-xl p-2 text-xs font-black outline-none"
                                                    value={newVariant.weight}
                                                    onChange={e => setNewVariant({...newVariant, weight: e.target.value})}
                                                />
                                                <button onClick={() => handleAddVariant(p.id)} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-black uppercase shadow-lg active:scale-95">Commit</button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => { setActiveAddVariantProductId(p.id); setActiveAddStorageVariantId(null); }} 
                                                className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-1 text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                                            >
                                                <Plus size={20} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Initialize Yield</span>
                                            </button>
                                        )}
                                    </div>
                                </td>

                                {/* 5. Final Storage */}
                                <td className="p-6 align-top">
                                    <div className="space-y-6">
                                        {p.variants.map(v => (
                                            <div key={v.id} className="space-y-3">
                                                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm" />
                                                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">{v.yieldName} Domain</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {v.storage.map((s, sIdx) => (
                                                        <div key={sIdx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center group/storage hover:shadow-md transition-shadow">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-bold text-slate-700 truncate leading-none mb-1.5">{s.type} {s.outlet && `(${s.outlet})`}</p>
                                                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 rounded uppercase border border-emerald-100 shadow-xs">{s.qty.toFixed(2)} KG</span>
                                                            </div>
                                                            <button onClick={() => handleRemoveStorage(v.id, sIdx)} className="p-1 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover/storage:opacity-100"><X size={14}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                {activeAddStorageVariantId === v.id ? (
                                                    <div className="bg-white border-2 border-emerald-200 rounded-[1.5rem] p-4 shadow-xl animate-in zoom-in-95 space-y-3">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase">Storage Link</span>
                                                            <button onClick={() => setActiveAddStorageVariantId(null)}><X size={14}/></button>
                                                        </div>
                                                        <select 
                                                            className="w-full bg-slate-50 border rounded-xl p-2 text-xs font-bold outline-none"
                                                            value={newStorage.type}
                                                            onChange={e => setNewStorage({...newStorage, type: e.target.value})}
                                                        >
                                                            <option value="">Strategy...</option>
                                                            {STORAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                        </select>
                                                        {newStorage.type === "Direct issue for cooking" && (
                                                            <select 
                                                                className="w-full bg-slate-50 border rounded-xl p-2 text-xs font-bold outline-none animate-in slide-in-from-top-1"
                                                                value={newStorage.outlet}
                                                                onChange={e => setNewStorage({...newStorage, outlet: e.target.value})}
                                                            >
                                                                <option value="">Outlet...</option>
                                                                {OUTLET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                            </select>
                                                        )}
                                                        <input 
                                                            type="number" step="0.01" placeholder="Quantity KG" 
                                                            className="w-full bg-slate-50 border rounded-xl p-2 text-xs font-black outline-none"
                                                            value={newStorage.qty}
                                                            onChange={e => setNewStorage({...newStorage, qty: e.target.value})}
                                                        />
                                                        <button onClick={() => handleAddStorage(v.id)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-black uppercase shadow-lg active:scale-95">Link Storage</button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => { setActiveAddStorageVariantId(v.id); setActiveAddVariantProductId(null); }} 
                                                        className="w-full py-2 bg-white border border-dashed border-slate-200 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:border-emerald-400 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <Store size={12} /> Assign Node
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {/* Mobile Card View */}
                <div className="lg:hidden flex flex-col gap-4 p-4">
                  {paginatedData.map((p) => (
                    <div key={p.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-6">
                        {/* Header Identity */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{p.productName}</h3>
                                <div className="flex flex-col mt-2 gap-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Building2 size={10}/> {p.vendorName}</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded w-fit">{p.batchNumber}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end text-right">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Balance</span>
                                <span className={`text-2xl font-black tracking-tighter ${p.balanceWeight > 0 ? 'text-indigo-600' : 'text-rose-500'}`}>{p.balanceWeight.toFixed(1)}</span>
                                <span className="text-[9px] font-bold text-slate-300">KG</span>
                            </div>
                        </div>

                        {/* Dates Grid */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                             <div className="flex flex-col">
                                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Received</span>
                                 <span className="text-xs font-bold text-slate-700">{formatDate(p.receivingDate)}</span>
                             </div>
                             <div className="flex flex-col">
                                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Expires</span>
                                 <span className="text-xs font-bold text-rose-600">{formatDate(p.expiryDate)}</span>
                             </div>
                             <div className="flex flex-col col-span-2 pt-2 border-t border-slate-200">
                                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Intake</span>
                                 <span className="text-sm font-black text-slate-900">{p.totalWeight} KG</span>
                             </div>
                        </div>

                        {/* Variants List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2"><Layers size={14}/> Yields</h4>
                                {activeAddVariantProductId !== p.id && (
                                    <button onClick={() => { setActiveAddVariantProductId(p.id); setActiveAddStorageVariantId(null); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"><Plus size={16}/></button>
                                )}
                            </div>
                            
                            {/* Add Variant Form Mobile */}
                            {activeAddVariantProductId === p.id && (
                                <div className="bg-indigo-50/50 border-2 border-indigo-100 rounded-2xl p-4 animate-in slide-in-from-top-2 space-y-3">
                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-indigo-500 uppercase">New Item</span><button onClick={() => setActiveAddVariantProductId(null)}><X size={14} className="text-slate-400"/></button></div>
                                    <select className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none" value={newVariant.yieldName} onChange={e => setNewVariant({...newVariant, yieldName: e.target.value})}>
                                        <option value="">Select Yield Type...</option>
                                        {YIELD_NAME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <input type="number" placeholder="Weight (KG)" className="w-full p-3 bg-white rounded-xl text-xs font-bold outline-none" value={newVariant.weight} onChange={e => setNewVariant({...newVariant, weight: e.target.value})} />
                                    <button onClick={() => handleAddVariant(p.id)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">Add Yield</button>
                                </div>
                            )}

                            {p.variants.map(v => (
                                <div key={v.id} className="border-2 border-slate-100 rounded-2xl p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-black text-slate-800 uppercase">{v.yieldName}</p>
                                            <p className="text-xs font-bold text-indigo-500">{v.weight} KG</p>
                                        </div>
                                        <button onClick={() => handleRemoveVariant(p.id, v.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={16}/></button>
                                    </div>
                                    
                                    {/* Storage List */}
                                    <div className="bg-slate-50 rounded-xl p-2 space-y-2">
                                        {v.storage.map((s, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold text-slate-700 truncate">{s.type}</p>
                                                    {s.outlet && <p className="text-[8px] font-bold text-slate-400">{s.outlet}</p>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{s.qty}</span>
                                                    <button onClick={() => handleRemoveStorage(v.id, idx)} className="text-slate-300 hover:text-rose-500"><X size={12}/></button>
                                                </div>
                                            </div>
                                        ))}
                                        {activeAddStorageVariantId === v.id ? (
                                            <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2 animate-in zoom-in-95">
                                                <div className="flex justify-between"><span className="text-[9px] font-black text-emerald-600 uppercase">Store</span><button onClick={() => setActiveAddStorageVariantId(null)}><X size={12}/></button></div>
                                                <select className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-bold outline-none" value={newStorage.type} onChange={e => setNewStorage({...newStorage, type: e.target.value})}>
                                                    <option value="">Type...</option>
                                                    {STORAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                </select>
                                                {newStorage.type === "Direct issue for cooking" && (
                                                    <select className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-bold outline-none" value={newStorage.outlet} onChange={e => setNewStorage({...newStorage, outlet: e.target.value})}>
                                                        <option value="">Outlet...</option>
                                                        {OUTLET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                                    </select>
                                                )}
                                                <input type="number" placeholder="Qty" className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-bold outline-none" value={newStorage.qty} onChange={e => setNewStorage({...newStorage, qty: e.target.value})} />
                                                <button onClick={() => handleAddStorage(v.id)} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">Save</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setActiveAddStorageVariantId(v.id); setActiveAddVariantProductId(null); }} className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-[10px] font-bold text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
                                                + Assign Storage
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                  ))}
                </div>
            </div>

            <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                rowsPerPage={rowsPerPage}
                onPageChange={setCurrentPage}
                onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
            />
        </div>
    );
};

export default YieldRegister;
