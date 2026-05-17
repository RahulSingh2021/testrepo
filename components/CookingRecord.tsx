"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Flame, X, Search, Thermometer, Clock, Camera, 
  CheckCheck, Zap, Calendar, ShieldCheck, PenTool, Snowflake,
  Split, Eraser, Eye, Check, Globe, Utensils, 
  Edit3, Trash2, GitPullRequest,
  Plus, Database, RefreshCw, Download, 
  Activity,
  History,
  Timer,
  CheckSquare, Square,
  Play,
  CheckCircle2,
  Info,
  Lock,
  XCircle,
  BarChart3,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  AlertTriangle,
  RotateCw,
  Save,
  ImageIcon,
  FileText,
  QrCode,
  Package,
  Trash,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  MinusCircle,
  Hourglass,
  Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import Logo from './Logo';
import UnifiedPagination from './UnifiedPagination';
import { CookingRecordEntry } from '../types';
import { compressImage } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { drawPdfHeader, resolveEntityLogoSrc } from '@/utils/pdfHeader';

// --- ISO 22000 Types ---
interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

interface CookingCardProps {
    entry: CookingRecordEntry;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    onVerification: () => void;
    openCookModal: () => void;
    handleCompleteCooking: () => void;
    onDownload: () => void;
    formatTimeLapse: (s: string, e?: string) => string;
    onSplit: () => void; 
    onSplitCooked: () => void;
    now: number;
}

// --- Constants ---
const OVEN_NUMBERS = ["OVEN-01", "OVEN-02", "OVEN-03", "OVEN-04", "RANGE-01", "GRILL-01"];
const COOKED_PURPOSES = ["Direct Serve", "Cooling"];

// --- Sub-Components ---

const AgingProgressBar: React.FC<{ startTime: string, now: number }> = ({ startTime, now }) => {
    const startMs = new Date(startTime).getTime();
    const elapsedMs = now - startMs;
    const totalMs = 24 * 60 * 60 * 1000;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const progress = Math.min(100, (elapsedMs / totalMs) * 100);
    
    const remainingHours = remainingMs / 3600000;
    
    let color = "bg-emerald-500";
    let textColor = "text-emerald-700";
    let label = "Safe to Use";

    if (remainingHours <= 0) {
        color = "bg-rose-600";
        textColor = "text-rose-700";
        label = "EXPIRED - DISCARD";
    } else if (remainingHours <= 2) {
        color = "bg-rose-500 animate-pulse";
        textColor = "text-rose-600 font-black";
        label = "CRITICAL: USE NOW";
    } else if (remainingHours <= 6) {
        color = "bg-amber-500";
        textColor = "text-amber-700 font-bold";
        label = "PRIORITY: 18H+ AGED";
    }

    return (
        <div className="space-y-1.5 w-full animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-1">
                <span className={`text-[8px] font-black uppercase tracking-widest ${textColor}`}>{label}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                    {remainingHours <= 0 ? '0h 0m' : `${Math.floor(remainingHours)}h ${Math.floor((remainingMs % 3600000) / 60000)}m`} Left
                </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                <div 
                    className={`h-full transition-all duration-1000 ${color}`} 
                    style={{ width: `${progress}%` }} 
                />
            </div>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
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

const CookingCard: React.FC<CookingCardProps> = ({ 
    entry, index, isSelected, onSelect,
    onVerification, openCookModal, handleCompleteCooking, onDownload, formatTimeLapse,
    onSplit, onSplitCooked, now
}) => {
    const isThawed = entry.status === 'THAWED';
    const isInProgress = entry.status === 'IN_PROGRESS';
    const isCompleted = entry.status === 'COMPLETED';
    const isVerified = entry.isVerified;

    const totalCookedWeight = Number(entry.cookingQuantity) || 0;
    const distributedWeight = (entry.issued || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
    const remainingToAssign = Math.max(0, totalCookedWeight - distributedWeight);
    const isFullyDistributed = isCompleted && remainingToAssign === 0 && totalCookedWeight > 0;

    const expiryTime = entry.thawCompletedTime ? new Date(entry.thawCompletedTime).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    const isExpired = isThawed && now > expiryTime;
    const [expanded, setExpanded] = useState(false);

    const borderColor = isThawed ? 'border-l-blue-500' : isInProgress ? 'border-l-orange-500' : isCompleted && isVerified ? 'border-l-emerald-500' : isCompleted ? 'border-l-amber-500' : 'border-l-slate-300';
    const displayTemp = entry.initialTemp || entry.thawFinalTemp;

    return (
        <div className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-300' : 'border-slate-200 shadow-sm hover:border-indigo-200'}`}>

            {/* ═══ MOBILE VIEW ═══ */}
            <div className="lg:hidden">
                <div className={`border-l-4 ${borderColor}`}>
                    {/* Header */}
                    <div className="p-4 pb-2 relative">
                        {isFullyDistributed && !isVerified && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                                className={`absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-10 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}
                            >
                                {isSelected && <Check size={10} strokeWidth={4} />}
                            </button>
                        )}
                        <div className="flex items-center justify-between gap-2 pr-7">
                            <h3 className="text-sm font-bold text-slate-800 truncate leading-tight">{entry.productName}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${isCompleted && isVerified ? 'bg-emerald-50 text-emerald-700' : isCompleted ? 'bg-amber-50 text-amber-700' : isInProgress ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                                {isVerified ? 'Verified' : entry.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 flex-wrap">
                            <Globe size={10} className="text-indigo-400 shrink-0" />
                            <span className="font-bold truncate">{entry.locationName}</span>
                            <span className="text-slate-300">·</span>
                            <span className="truncate">{entry.departmentName}</span>
                            <span className="text-slate-300">·</span>
                            <span className="truncate">{entry.unitName}</span>
                            {entry.regionName && <><span className="text-slate-300">·</span><span className="truncate">{entry.regionName}</span></>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{entry.batchNumber}</span>
                            {entry.sourceProductName && <span className="text-[10px] text-slate-400 truncate">· {entry.sourceProductName}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            {entry.mfgDate && <span className="text-[9px] text-slate-400"><span className="font-bold uppercase">Mfg:</span> {entry.mfgDate}</span>}
                            {entry.expDate && <span className="text-[9px] text-rose-500"><span className="font-bold uppercase">Exp:</span> {entry.expDate}</span>}
                        </div>
                    </div>

                    {/* Quick Metrics Row */}
                    <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                        <div className="bg-blue-50 rounded-xl p-2 flex flex-col items-center">
                            <Snowflake size={14} className="text-blue-500 mb-0.5" />
                            <span className="text-xs font-bold text-blue-700">{entry.availableThawedQty.toFixed(1)}</span>
                            <span className="text-[8px] text-blue-500 uppercase font-bold">{entry.storedUnit}</span>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-2 flex flex-col items-center">
                            <Thermometer size={14} className="text-rose-500 mb-0.5" />
                            <span className="text-xs font-bold text-rose-700">{displayTemp ? `${displayTemp}°C` : '---'}</span>
                            <span className="text-[8px] text-rose-500 uppercase font-bold">Temp</span>
                        </div>
                        <div className="bg-indigo-50 rounded-xl p-2 flex flex-col items-center">
                            {entry.cookStart ? (
                                <>
                                    <Clock size={14} className="text-indigo-500 mb-0.5" />
                                    <span className="text-[10px] font-bold text-indigo-700 font-mono">{formatTimeLapse(entry.cookStart, entry.cookCompleted)}</span>
                                    <span className="text-[8px] text-indigo-500 uppercase font-bold">Lapse</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} className="text-emerald-500 mb-0.5" />
                                    <span className="text-[10px] font-bold text-emerald-700">Ready</span>
                                    <span className="text-[8px] text-emerald-500 uppercase font-bold">Status</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Expandable Details */}
                    <div className="px-4">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-indigo-500 transition-colors"
                        >
                            {expanded ? 'Hide Details' : 'Show Details'}
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {expanded && (
                            <div className="pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                {/* Process Origin */}
                                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <History size={12} className="text-indigo-500" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Process Origin</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 truncate">{entry.sourceProductName}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {entry.category && <span className="text-[9px] bg-white px-1.5 py-0.5 rounded text-slate-500 border border-slate-100">{entry.category}</span>}
                                        {entry.brandName && <span className="text-[9px] bg-white px-1.5 py-0.5 rounded text-slate-500 border border-slate-100">{entry.brandName}</span>}
                                    </div>
                                </div>

                                {/* Thawing Info */}
                                <div className="bg-blue-50/50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Snowflake size={12} className="text-blue-500" />
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Thaw Audit</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <span className="text-[8px] text-slate-400 uppercase block">Method</span>
                                            <span className="text-[10px] font-bold text-slate-700">{entry.thawingMethod || '---'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 uppercase block">Final</span>
                                            <span className="text-[10px] font-bold text-blue-600">{entry.thawFinalTemp != null ? `${entry.thawFinalTemp}°C` : '---'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-slate-400 uppercase block">Pool</span>
                                            <span className="text-[10px] font-bold text-indigo-600">{entry.availableThawedQty.toFixed(1)} {entry.storedUnit}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Split Lineage */}
                                {(entry.parentName || (entry.splits && entry.splits.length > 0)) && (
                                    <div className="bg-slate-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <GitPullRequest size={12} className="text-indigo-500" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Split Lineage</span>
                                        </div>
                                        {entry.parentName && (
                                            <div className="bg-slate-800 text-white px-2.5 py-1.5 rounded-lg flex justify-between items-center text-[10px] mb-1.5">
                                                <span className="truncate font-bold">{entry.parentName}</span>
                                                <span className="font-bold shrink-0 ml-2">{(entry.parentAvailableQty || 0).toFixed(1)}</span>
                                            </div>
                                        )}
                                        {entry.splits && entry.splits.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {entry.splits.map((split, sidx) => (
                                                    <span key={sidx} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border ${split.childId === entry.uuid ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-100'}`}>
                                                        {split.name} <span className="text-indigo-500">{split.quantity.toFixed(1)}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Process Telemetry */}
                                {entry.cookStart && (
                                    <div className="bg-slate-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Activity size={12} className="text-indigo-500" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Process Telemetry</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <p className="text-[10px] font-mono font-bold text-slate-700">{formatTimeDisplay(entry.cookStart)}</p>
                                                <p className="text-[10px] text-slate-500">{entry.cookingVessel} · <span className="text-indigo-600 font-bold">{entry.initiatedBy}</span></p>
                                                {entry.initialTemp && <p className="text-[10px] font-bold text-rose-600">{entry.initialTemp}°C intake</p>}
                                            </div>
                                            {entry.initiatedBySign && (
                                                <div className="h-8 w-12 bg-white border border-slate-100 rounded-lg p-0.5 shrink-0 overflow-hidden">
                                                    <img src={entry.initiatedBySign} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                                </div>
                                            )}
                                        </div>
                                        {entry.cookComments && (
                                            <p className="mt-1.5 text-[9px] text-slate-500 italic bg-white/60 p-1.5 rounded-lg border border-slate-100">"{entry.cookComments}"</p>
                                        )}
                                    </div>
                                )}

                                {/* Distribution */}
                                {isCompleted && (entry.issued || []).length > 0 && (
                                    <div className="bg-slate-50 rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <Package size={12} className="text-indigo-500" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Distribution</span>
                                        </div>
                                        <div className="space-y-1">
                                            {entry.issued.map((iss, iidx) => (
                                                <div key={iidx} className="flex justify-between items-center bg-white px-2 py-1 rounded-lg border border-slate-100 text-[10px]">
                                                    <span className="font-bold text-indigo-600 uppercase truncate">{iss.purpose}</span>
                                                    <span className="font-bold text-slate-700">{iss.quantity.toFixed(1)} {entry.storedUnit}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-1.5 flex justify-between items-center text-[9px] pt-1.5 border-t border-slate-200">
                                            <span className="text-slate-400">Remaining</span>
                                            <span className={`font-bold ${remainingToAssign > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{remainingToAssign.toFixed(1)} {entry.storedUnit}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Aging Progress */}
                                {entry.thawCompletedTime && !isCompleted && (
                                    <AgingProgressBar startTime={entry.thawCompletedTime} now={now} />
                                )}

                                {/* Lapse Summary */}
                                {isCompleted && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-blue-50 p-2 rounded-xl text-center">
                                            <span className="text-[8px] font-bold text-blue-400 uppercase block">Thaw Lapse</span>
                                            <span className="text-[10px] font-bold text-blue-700 font-mono">{formatTimeLapse(entry.thawStartTime, entry.thawCompletedTime)}</span>
                                        </div>
                                        <div className="bg-indigo-50 p-2 rounded-xl text-center">
                                            <span className="text-[8px] font-bold text-indigo-400 uppercase block">Cook Lapse</span>
                                            <span className="text-[10px] font-bold text-indigo-700 font-mono">{formatTimeLapse(entry.cookStart, entry.cookCompleted)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Area */}
                    <div className="px-4 pb-4 pt-1">
                        {isThawed ? (
                            <div className="flex gap-2">
                                {isExpired ? (
                                    <button className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                        <Trash size={14} /> Dispose
                                    </button>
                                ) : (
                                    <button onClick={openCookModal} className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                        <Flame size={14} fill="currentColor" /> Initiate Cooking
                                    </button>
                                )}
                                <button onClick={onSplit} className="py-2.5 px-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold active:scale-95 transition-all flex items-center gap-1">
                                    <Split size={12} /> Split
                                </button>
                            </div>
                        ) : isInProgress ? (
                            (() => {
                                const cookElapsed = entry.cookStart ? (now - new Date(entry.cookStart).getTime()) / 1000 : 0;
                                return cookElapsed >= 15 ? (
                                    <button onClick={handleCompleteCooking} className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                        <Timer size={14} /> Complete Process
                                    </button>
                                ) : (
                                    <div className="w-full py-2.5 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                                        <Timer size={14} className="animate-spin" /> Cooking... {Math.ceil(15 - cookElapsed)}s
                                    </div>
                                );
                            })()
                        ) : isVerified ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-emerald-800 truncate">{entry.verifierName}</p>
                                        <p className="text-[8px] text-emerald-600 uppercase">Verified Authority</p>
                                    </div>
                                    {entry.verifierSignature && (
                                        <div className="h-7 w-10 bg-white/50 border border-emerald-100 rounded-lg p-0.5 shrink-0 overflow-hidden">
                                            <img src={entry.verifierSignature} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                        </div>
                                    )}
                                    <button onClick={onDownload} className="p-1.5 bg-white border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-50 active:scale-95 transition-all shrink-0">
                                        <Download size={14} />
                                    </button>
                                </div>
                                {entry.verificationDate && (
                                    <div className="flex items-center gap-2 text-[9px] text-emerald-700">
                                        <Calendar size={10} className="shrink-0" />
                                        <span className="font-bold">{new Date(entry.verificationDate).toLocaleDateString()}</span>
                                        <span className="text-emerald-500">·</span>
                                        <Clock size={10} className="shrink-0" />
                                        <span className="font-bold">{new Date(entry.verificationDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                )}
                                {entry.verificationComments && (
                                    <p className="text-[9px] text-emerald-700 italic bg-white/50 p-1.5 rounded-lg border border-emerald-100">"{entry.verificationComments}"</p>
                                )}
                            </div>
                        ) : !isFullyDistributed ? (
                            <button onClick={onSplitCooked} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 animate-pulse">
                                <Split size={14} strokeWidth={3} /> Assign Split {remainingToAssign.toFixed(1)} {entry.storedUnit}
                            </button>
                        ) : (
                            <button onClick={onVerification} className="w-full py-2.5 bg-amber-400 text-amber-900 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                <ShieldCheck size={14} strokeWidth={3} /> Authorize Log
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ DESKTOP VIEW — unchanged ═══ */}
            <div className="hidden lg:block">
                <div className="flex flex-row items-stretch divide-x divide-slate-100 w-full min-h-[220px]">
                    
                    {/* 1. IDENTITY BLOCK (13%) */}
                    <div className="p-6 lg:w-[13%] flex flex-col justify-center bg-slate-50/30 shrink-0 relative">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                        
                        {/* Bulk Selection Interface */}
                        {isFullyDistributed && !isVerified && (
                            <div className="absolute top-4 left-4 z-20">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-300 hover:border-indigo-400'}`}
                                >
                                    {isSelected && <Check size={12} strokeWidth={4} />}
                                </button>
                            </div>
                        )}

                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg ${isCompleted ? 'bg-emerald-600' : isInProgress ? 'bg-orange-600 animate-pulse' : 'bg-slate-900'}`}>
                                {index.toString().padStart(2, '0')}
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase border tracking-wider ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isInProgress ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                {entry.status}
                            </span>
                        </div>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight leading-tight mb-2 truncate">{entry.productName}</h3>
                        <div className="flex items-center gap-2 text-slate-400 text-[8px] font-black uppercase tracking-widest mb-4"><Globe size={10} className="text-indigo-400" /> {entry.unitName}</div>
                        <div className="bg-white border border-slate-100 p-2.5 rounded-xl flex flex-col gap-1 shadow-sm">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">Batch Registry</span>
                            <span className="text-[10px] font-black text-slate-800 font-mono tracking-tighter truncate">{entry.batchNumber}</span>
                        </div>
                    </div>

                    {/* 2. PROCESS ORIGIN & SPLIT LINEAGE (22%) - MERGED */}
                    <div className="p-6 lg:w-[22%] flex flex-col justify-center gap-4 shrink-0 bg-white">
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <History size={14} className="text-indigo-600" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Origin</span>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[11px] font-black text-slate-800 uppercase leading-none truncate">{entry.sourceProductName}</p>
                                    <div className="flex gap-3">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">MFG: {entry.mfgDate}</span>
                                        <span className="text-[8px] font-black text-rose-500 uppercase">EXP: {entry.expDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                    <GitPullRequest size={14} className="text-indigo-600" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Split Lineage</span>
                                </div>
                                <div className="max-h-[100px] overflow-y-auto custom-scrollbar space-y-2">
                                    {entry.parentName && (
                                        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center shadow-md animate-in slide-in-from-left-2">
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-slate-100 uppercase truncate leading-none mb-0.5">Mother Node</p>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase truncate leading-none">{entry.parentName}</p>
                                            </div>
                                            <span className="text-[10px] font-black text-white">{(entry.parentAvailableQty || 0).toFixed(1)}</span>
                                        </div>
                                    )}

                                    {entry.splits && entry.splits.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {entry.splits.map((split, sidx) => (
                                                <div key={sidx} className={`bg-slate-50 border p-2 rounded-xl flex justify-between items-center shadow-xs ${split.childId === entry.uuid ? 'border-indigo-600 ring-2 ring-indigo-50' : 'border-slate-100'}`}>
                                                    <p className="text-[9px] font-black text-slate-700 uppercase truncate max-w-[100px]">{split.name}</p>
                                                    <span className="text-[10px] font-black text-indigo-600">{split.quantity.toFixed(1)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : !entry.parentName && (
                                        <div className="text-center py-2 border border-dashed border-slate-100 rounded-xl">
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">No lineage split</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. THAWING TELEMETRY (10%) */}
                    <div className="p-6 lg:w-[10%] flex flex-col justify-center gap-3 shrink-0 bg-slate-50/20">
                         <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                            <Snowflake size={14} className="text-blue-500" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Thaw Audit</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Method</span>
                                <span className="text-[9px] font-bold text-slate-700">{entry.thawingMethod}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-100 shadow-xs">
                                <span className="text-[8px] font-black text-slate-400 uppercase">Final</span>
                                <span className="text-[10px] font-black text-blue-600">{entry.thawFinalTemp}°C</span>
                            </div>
                            <div className="bg-indigo-600 text-white p-2 rounded-xl flex justify-between items-center shadow-md">
                                <span className="text-[8px] font-black uppercase">Pool</span>
                                <span className="text-xs font-black">{entry.availableThawedQty.toFixed(1)} {entry.storedUnit}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. PROCESS TELEMETRY (20%) - INITIATOR DETAILS & LAPSES */}
                    <div className="p-6 lg:w-[20%] flex flex-col gap-4 shrink-0 bg-white">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Activity size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Process Telemetry</span>
                        </div>
                        
                        <div className="flex flex-col gap-4 flex-1">
                            {/* Initiation Node */}
                            {entry.cookStart ? (
                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 relative overflow-hidden group/init">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Intake</span>
                                        <span className="text-[11px] font-black text-rose-600">{entry.initialTemp}°C</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-800 font-mono">{formatTimeDisplay(entry.cookStart)}</p>
                                    
                                    <div className="flex items-center gap-2 mt-2">
                                        {entry.initialTempImg ? (
                                            <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden cursor-pointer" onClick={() => window.open(entry.initialTempImg)}>
                                                <img src={entry.initialTempImg} className="w-full h-full object-cover" />
                                            </div>
                                        ) : <div className="w-10 h-10 bg-slate-100 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><ImageIcon size={14}/></div>}
                                        
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase block leading-none">Vessel / Init</span>
                                            <span className="text-[9px] font-black text-slate-700 truncate block leading-tight">{entry.cookingVessel}</span>
                                            <span className="text-[9px] font-black text-indigo-600 truncate block leading-tight">{entry.initiatedBy}</span>
                                        </div>
                                        
                                        {entry.initiatedBySign && (
                                            <div className="h-8 w-12 bg-white/50 border border-slate-100 rounded-lg p-0.5 shrink-0 overflow-hidden shadow-xs">
                                                <img src={entry.initiatedBySign} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                            </div>
                                        )}
                                    </div>

                                    {entry.cookComments && (
                                        <div className="mt-2 p-1.5 bg-white/40 border border-slate-100 rounded-lg text-[8px] text-slate-500 italic leading-tight">
                                            "{entry.cookComments}"
                                        </div>
                                    )}
                                </div>
                            ) : <div className="h-full flex flex-col items-center justify-center p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl opacity-40"><Hourglass size={20} className="text-slate-300 mb-1"/><span className="text-[7px] font-black uppercase">Wait Init</span></div>}

                            {/* LAPSE SUMMARY - VISIBLE AFTER COMPLETION */}
                            {isCompleted && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                                    <div className="bg-blue-50 border border-blue-100 p-2.5 rounded-xl flex flex-col shadow-xs">
                                        <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest block mb-0.5 leading-none">Thaw Lapse</span>
                                        <span className="text-[11px] font-black text-blue-700 font-mono tracking-tighter leading-none">
                                            {formatTimeLapse(entry.thawStartTime, entry.thawCompletedTime)}
                                        </span>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl flex flex-col shadow-xs">
                                        <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5 leading-none">Cook Lapse</span>
                                        <span className="text-[11px] font-black text-indigo-700 font-mono tracking-tighter leading-none">
                                            {formatTimeLapse(entry.cookStart, entry.cookCompleted)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Active Lapse - Only during production */}
                            {isInProgress && (
                                <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10"><Clock size={40}/></div>
                                    <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1.5">Active Lapse</span>
                                    <span className="text-xl font-black font-mono tracking-tighter leading-none">{formatTimeLapse(entry.cookStart, entry.cookCompleted)}</span>
                                </div>
                            )}
                        </div>

                        {/* Aging Indicators (During Thaw Hold) */}
                        <div className="pt-2 flex flex-col gap-2">
                            {entry.thawCompletedTime && !isCompleted && (
                                 <AgingProgressBar startTime={entry.thawCompletedTime} now={now} />
                            )}
                            {(isThawed || isInProgress) && (
                                <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={12} className="text-blue-500" />
                                        <span className="text-[9px] font-black text-blue-700 uppercase tracking-tight">HACCP 24H Window</span>
                                    </div>
                                    <span className="text-[8px] font-black text-emerald-600 uppercase">Authorized</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 5. DISTRIBUTION SUMMARY (10%) */}
                    <div className={`p-6 lg:w-[10%] flex flex-col justify-center gap-2 shrink-0 bg-slate-50/10 ${!isCompleted ? 'opacity-20 pointer-events-none grayscale' : ''}`}>
                        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
                            <Package size={14} className="text-indigo-600" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Output Registry</span>
                        </div>
                        <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                            {isCompleted && (entry.issued || []).length > 0 ? (
                                entry.issued.map((iss, iidx) => (
                                    <div key={iidx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                                        <span className="text-[9px] font-black text-indigo-600 uppercase truncate max-w-[60px]">{iss.purpose}</span>
                                        <span className="text-[10px] font-black text-slate-800">{iss.quantity.toFixed(1)} {entry.storedUnit}</span>
                                    </div>
                                ))
                            ) : isCompleted ? (
                                <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
                                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Assigning...</span>
                                </div>
                            ) : null}
                        </div>
                        {isCompleted && (
                             <div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Pending</span>
                                <span className={`text-[11px] font-black ${remainingToAssign > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{remainingToAssign.toFixed(1)} {entry.storedUnit}</span>
                             </div>
                        )}
                    </div>

                    {/* 6. ACTIONS & VERIFICATION (25%) */}
                    <div className="p-6 md:p-8 lg:w-[25%] shrink-0 flex flex-col justify-center gap-4 bg-white relative overflow-hidden">
                        {isThawed ? (
                            <div className="flex flex-col gap-2 w-full">
                                {isExpired ? (
                                    <button className="w-full py-4 bg-rose-600 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Trash size={18} /> Mark for Disposal
                                    </button>
                                ) : (
                                    <button onClick={openCookModal} className="w-full py-4 bg-slate-900 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Flame size={18} fill="currentColor" /> Initiate Cooking
                                    </button>
                                )}
                                <button onClick={onSplit} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Split size={16} /> Split Thawed Batch
                                </button>
                            </div>
                        ) : isInProgress ? (
                            (() => {
                                const cookElapsedD = entry.cookStart ? (now - new Date(entry.cookStart).getTime()) / 1000 : 0;
                                return cookElapsedD >= 15 ? (
                                    <button onClick={handleCompleteCooking} className="w-full py-4 bg-orange-600 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <Timer size={18} /> Complete Process
                                    </button>
                                ) : (
                                    <div className="w-full py-4 bg-slate-100 text-slate-400 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                                        <Timer size={18} className="animate-spin" /> Cooking in progress... {Math.ceil(15 - cookElapsedD)}s
                                    </div>
                                );
                            })()
                        ) : isVerified ? (
                            <div className="flex flex-col gap-3 animate-in zoom-in-95 duration-300 flex flex-col items-center lg:items-end">
                                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden w-full max-w-[320px]">
                                    <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500 opacity-10 rounded-bl-[2rem]" />
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white shrink-0"><ShieldCheck size={24} strokeWidth={3} /></div>
                                        <div className="min-w-0 text-left">
                                            <p className="text-sm font-black text-slate-900 uppercase leading-tight truncate">{entry.verifierName}</p>
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1 italic">Verified Auth</p>
                                        </div>
                                    </div>
                                    <div className="h-16 w-full bg-white/50 rounded-2xl border border-emerald-100 p-2 mb-4 flex items-center justify-center shadow-inner overflow-hidden">
                                        {entry.verifierSignature ? <img src={entry.verifierSignature} className="max-h-full max-w-full object-contain" alt="verifier-sign" /> : <PenTool className="text-emerald-200" />}
                                    </div>
                                    <div className="p-4 bg-white/40 rounded-xl text-left"><p className="text-[9px] font-bold text-slate-600 leading-relaxed italic">"{entry.verificationComments || 'Record reviewed and synchronized.'}"</p></div>
                                    <div className="mt-4 flex justify-between items-center text-[8px] font-black text-emerald-800 uppercase px-1 opacity-60"><span>Process Cert.</span><span>{entry.verificationDate || '---'}</span></div>
                                </div>
                                <button onClick={onDownload} className="w-full py-3 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95">
                                    <Download size={14}/> Export Certificate
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 w-full">
                                {!isFullyDistributed ? (
                                    <button 
                                        onClick={onSplitCooked} 
                                        className="w-full py-4 bg-indigo-600 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse"
                                    >
                                        <Split size={18} strokeWidth={3} /> Assign Split {remainingToAssign.toFixed(1)} {entry.storedUnit}
                                    </button>
                                ) : (
                                    <button onClick={onVerification} className="w-full py-4 bg-amber-400 text-amber-900 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-amber-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <ShieldCheck size={18} strokeWidth={3} /> Authorize Log
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Helper ---
const formatTimeDisplay = (iso?: string) => {
    if (!iso) return "---";
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- Main Component ---

interface CookingRecordProps {
  entries: CookingRecordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<CookingRecordEntry[]>>;
  onIssueToCooling?: (cookEntry: CookingRecordEntry, quantity: number) => void;
  entities?: any[];
  userRootId?: string | null;
}

const CookingRecord: React.FC<CookingRecordProps> = ({ entries, setEntries, onIssueToCooling, entities = [], userRootId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'THAWED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [now, setNow] = useState(Date.now());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    // ISO 22000 Doc Control State
    const [docControlData] = useState<DocControlInfo>({
        docRef: 'COOK-RGST-42',
        version: '2.1',
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

    // UI state
    const [activeModal, setActiveModal] = useState<'COOK' | 'FINALIZE' | 'VERIFY' | 'SPLIT' | 'SPLIT_COOKED' | 'MANUAL_ENTRY' | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<CookingRecordEntry | null>(null);
    
    // Form state
    const [productNameInput, setProductNameInput] = useState("");
    const [tempInput, setTempInput] = useState("");
    const [cookedQtyInput, setCookedQtyInput] = useState("");
    const [tempImg, setTempImg] = useState<string | null>(null);
    const [vesselInput, setVesselInput] = useState(OVEN_NUMBERS[0]);
    const [signature, setSignature] = useState("");
    const [comments, setComments] = useState("");
    const [cookTempWarning, setCookTempWarning] = useState<string | null>(null);

    const [verificationComments, setVerificationComments] = useState("");
    const [verificationSignature, setVerificationSignature] = useState("");

    // Split state
    const [splitName, setSplitName] = useState("");
    const [splitQty, setSplitQty] = useState("");

    // Multi-split state for cooked food distribution
    const [stagedSplits, setStagedSplits] = useState<Array<{ id: string, quantity: string, purpose: string }>>([]);

    // Fixed: Corrected variable name from 'editingBrand' to 'editingEntryId' to fix Cannot find name 'editingBrand' error.
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

    // Manual entry form state
    const [manualProductName, setManualProductName] = useState("");
    const [manualBatchNumber, setManualBatchNumber] = useState("");
    const [manualCategory, setManualCategory] = useState("");
    const [manualBrandName, setManualBrandName] = useState("");
    const [manualMfgDate, setManualMfgDate] = useState("");
    const [manualExpDate, setManualExpDate] = useState("");
    const [manualCookStart, setManualCookStart] = useState("");
    const [manualCookEnd, setManualCookEnd] = useState("");
    const [manualInitialTemp, setManualInitialTemp] = useState("");
    const [manualFinalTemp, setManualFinalTemp] = useState("");
    const [manualCookingQty, setManualCookingQty] = useState("");
    const [manualUnit, setManualUnit] = useState("kg");

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTimeLapse = (start: string, end?: string) => {
        if (!start) return '--:--';
        const sTime = new Date(start).getTime();
        const eTime = end ? new Date(end).getTime() : now;
        const diff = Math.max(0, eTime - sTime);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${hours}h ${mins}m ${secs}s`;
    };

    const stats = useMemo(() => ({
        total: entries.length,
        thawed: entries.filter(e => e.status === 'THAWED').length,
        inProgress: entries.filter(e => e.status === 'IN_PROGRESS').length,
        completed: entries.filter(e => e.status === 'COMPLETED').length,
        verified: entries.filter(e => e.isVerified).length,
    }), [entries]);

    const buildCookingQRUrl = (e: CookingRecordEntry): string => {
        const data: Record<string, unknown> = {
            pn: e.productName, src: e.sourceProductName, cat: e.category, br: e.brandName,
            bn: e.batchNumber, md: e.mfgDate, ed: e.expDate,
            loc: e.locationName, dept: e.departmentName, unit: e.unitName, reg: e.regionName,
            thm: e.thawingMethod, tft: e.thawFinalTemp, tq: e.totalThawedQty, su: e.storedUnit,
            cs: e.cookStart, cc: e.cookCompleted,
            it: e.initialTemp, ft: e.finalTemp, cv: e.cookingVessel,
            ib: e.initiatedBy, cb: e.completedBy, cq: e.cookingQuantity,
            st: e.status, vf: e.isVerified ? 1 : 0,
        };
        if (e.issued && e.issued.length > 0) data.iss = e.issued.map(i => `${i.purpose}:${i.quantity}`).join('|');
        if (e.verifierName) data.vn = e.verifierName;
        if (e.verificationComments) data.vc = e.verificationComments;
        if (e.verificationDate) data.vd = e.verificationDate;
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/cook-record?d=${encoded}`;
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

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = e.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                e.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = activeFilter === 'ALL' || e.status === activeFilter;
            return matchesSearch && matchesFilter;
        });
    }, [entries, searchTerm, activeFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage));
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredEntries.slice(start, start + rowsPerPage);
    }, [filteredEntries, currentPage, rowsPerPage]);

    // Derived Selection State
    const selectableEntries = useMemo(() => {
        return filteredEntries.filter(e => {
            const totalWeight = Number(e.cookingQuantity) || 0;
            const distributedWeight = (e.issued || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
            const remainingToAssign = Math.max(0, totalWeight - distributedWeight);
            return e.status === 'COMPLETED' && remainingToAssign === 0 && totalWeight > 0 && !e.isVerified;
        });
    }, [filteredEntries]);

    const areAllSelected = useMemo(() => {
        return selectableEntries.length > 0 && selectableEntries.every(e => selectedIds.has(e.uuid));
    }, [selectableEntries, selectedIds]);

    const toggleSelectAll = () => {
        if (areAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(selectableEntries.map(e => e.uuid)));
        }
    };

    const toggleSelection = (uuid: string) => {
        const next = new Set(selectedIds);
        if (next.has(uuid)) next.delete(uuid);
        else next.add(uuid);
        setSelectedIds(next);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setTempImg(compressed); };
            reader.readAsDataURL(file);
        }
    };

    const handleInitiateCook = () => {
        if (!selectedEntry || !tempInput || !signature) return;
        const rawTemp = tempInput.trim();
        if (!rawTemp.includes('.')) {
            setCookTempWarning('Temperature must be entered in decimal format (e.g. 75.0, 82.5).');
            return;
        }
        const tempVal = parseFloat(rawTemp);
        if (isNaN(tempVal)) {
            setCookTempWarning('Please enter a valid temperature value.');
            return;
        }
        if (tempVal <= 75) {
            setCookTempWarning('Intake temperature must exceed 75.0°C. Product has not reached safe cooking temperature.');
            return;
        }
        setCookTempWarning(null);
        setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? {
            ...e,
            status: 'IN_PROGRESS',
            productName: productNameInput || e.productName,
            cookStart: new Date().toISOString(),
            initialTemp: tempVal,
            initialTempImg: tempImg || undefined,
            cookingVessel: vesselInput,
            initiatedBy: 'Chef Alex',
            initiatedBySign: signature,
            cookComments: comments
        } as CookingRecordEntry : e));
        setActiveModal(null);
        setTempImg(null);
    };

    const handleCompleteCooking = () => {
        const row = selectedEntry;
        if (!row) return;
        const stopTime = new Date().toISOString();
        setEntries(prev => prev.map(e => e.uuid === row.uuid ? { ...e, cookCompleted: stopTime } : e));
        setSelectedEntry({ ...row, cookCompleted: stopTime }); 
        setSignature(""); 
        setComments(""); 
        setCookedQtyInput(""); 
        setActiveModal('FINALIZE');
    };

    const handleFinalizeSubmit = () => {
        if (!selectedEntry || !cookedQtyInput) return;
        
        setEntries(prev => prev.map(e => e.uuid === selectedEntry.uuid ? {
            ...e,
            status: 'COMPLETED',
            cookingQuantity: parseFloat(cookedQtyInput),
            cookCompleted: new Date().toISOString(),
            completedBy: 'Chef Alex',
            completedBySign: '',
            cookComments: '',
            issued: [] 
        } as CookingRecordEntry : e));
        
        setActiveModal(null);
        setSelectedEntry(null);
        setTempImg(null);
        setCookedQtyInput("");
    };

    const commitVerify = () => {
        if (!verificationSignature) return;

        // Targets for verification: single selectedEntry OR bulk selectedIds
        const targetIds = selectedEntry ? [selectedEntry.uuid] : Array.from(selectedIds);

        if (targetIds.length === 0) return;

        setEntries((prev: CookingRecordEntry[]) => prev.map(e => {
            if (targetIds.includes(e.uuid)) {
                return {
                    ...e,
                    isVerified: true,
                    verifierName: 'Jane Smith (QA)',
                    verifierSignature: verificationSignature,
                    verificationComments: verificationComments,
                    verificationDate: new Date().toISOString()
                } as CookingRecordEntry;
            }
            return e;
        }));

        setActiveModal(null);
        setSelectedEntry(null);
        setSelectedIds(new Set());
        setVerificationSignature("");
        setVerificationComments("");
    };

    const handleSplitSubmit = () => {
        if (!selectedEntry || !splitName || !splitQty) return;
        const qty = parseFloat(splitQty);
        if (qty > selectedEntry.availableThawedQty) {
            alert("Split quantity cannot exceed available quantity.");
            return;
        }

        const timestamp = new Date().toISOString();
        const newChildId = `split-${Date.now()}`;
        
        const motherCurrentSplitTotal = (selectedEntry.splits?.reduce((a, b) => a + b.quantity, 0) || 0);
        const motherInitialLoadTotal = selectedEntry.totalThawedQty + motherCurrentSplitTotal;
        const parentNewAvailableQty = selectedEntry.availableThawedQty - qty;

        const newSplitRecord = {
            childId: newChildId,
            name: splitName.toUpperCase(),
            quantity: qty,
            timestamp: timestamp
        };

        const updatedSplitsList = [...(selectedEntry.splits || []), newSplitRecord];

        const newEntry: CookingRecordEntry = {
            ...selectedEntry,
            uuid: newChildId,
            productName: splitName.toUpperCase(),
            sourceProductName: selectedEntry.productName,
            parentName: selectedEntry.productName,
            parentTotalQty: motherInitialLoadTotal,
            parentAvailableQty: parentNewAvailableQty,
            totalThawedQty: qty,
            availableThawedQty: qty,
            cookingQuantity: 0,
            batchNumber: `${selectedEntry.batchNumber}-S${updatedSplitsList.length}`,
            status: 'THAWED',
            isVerified: false,
            cookStart: '',
            cookCompleted: '',
            initiatedBy: '',
            completedBy: '',
            issued: [],
            splits: updatedSplitsList 
        };

        setEntries(prev => {
            return prev.map(e => {
                if (e.uuid === selectedEntry.uuid) {
                    return {
                        ...e,
                        availableThawedQty: parentNewAvailableQty,
                        totalThawedQty: e.totalThawedQty - qty,
                        splits: updatedSplitsList
                    };
                }
                if (e.parentName === selectedEntry.productName && e.batchNumber.startsWith(selectedEntry.batchNumber)) {
                    return {
                        ...e,
                        parentAvailableQty: parentNewAvailableQty,
                        splits: updatedSplitsList
                    };
                }
                return e;
            }).concat(newEntry);
        });

        setActiveModal(null);
        setSplitName("");
        setSplitQty("");
    };

    const handleCookedSplitSubmit = () => {
        if (!selectedEntry) return;

        const totalToAssign = stagedSplits.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
        const currentIssued = (selectedEntry.issued || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
        const remainingToAssign = selectedEntry.cookingQuantity - currentIssued;

        if (totalToAssign > remainingToAssign) {
            alert(`Total distribution (${totalToAssign.toFixed(1)} ${selectedEntry.storedUnit}) exceeds remaining available quantity (${remainingToAssign.toFixed(1)} ${selectedEntry.storedUnit}).`);
            return;
        }

        const newIssuedItems = stagedSplits
            .filter(s => parseFloat(s.quantity) > 0)
            .map(s => ({
                id: `iss-ck-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                purpose: s.purpose,
                quantity: parseFloat(s.quantity),
                timestamp: new Date().toISOString()
            }));

        if (newIssuedItems.length === 0) return;

        setEntries(prev => prev.map(e => {
            if (e.uuid === selectedEntry.uuid) {
                return {
                    ...e,
                    issued: [...(e.issued || []), ...newIssuedItems]
                };
            }
            return e;
        }));

        // Trigger handoffs
        newIssuedItems.forEach(item => {
            if (item.purpose === 'Cooling' && onIssueToCooling) {
                onIssueToCooling(selectedEntry, item.quantity);
            }
        });

        setActiveModal(null);
        setSelectedEntry(null);
        setStagedSplits([]);
    };

    const addStagedSplit = () => {
        setStagedSplits(prev => [...prev, { id: Date.now().toString(), quantity: '', purpose: COOKED_PURPOSES[0] }]);
    };

    const removeStagedSplit = (id: string) => {
        if (stagedSplits.length <= 1) return;
        setStagedSplits(prev => prev.filter(s => s.id !== id));
    };

    const updateStagedSplit = (id: string, field: 'quantity' | 'purpose', value: string) => {
        setStagedSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const generatePDFForEntries = async (targetEntries: CookingRecordEntry[], filename: string) => {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 30, mr = 30, mt = 30, mb = 40;
        const cw = pw - ml - mr;
        let y = mt;
        let pageNum = 1;

        const securityId = `CERT-COOK-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        const downloadTimestamp = new Date().toLocaleString();

        const colFractions = [0.10, 0.12, 0.14, 0.09, 0.14, 0.10, 0.11, 0.20];
        const colWidths = colFractions.map(f => cw * f);
        const colX = [ml];
        for (let i = 1; i < 8; i++) colX.push(colX[i - 1] + colWidths[i - 1]);
        const colHeaders = ['UNIT DETAILS', 'PRODUCT INFO', 'MATERIAL ANALYSIS', 'THAWING', 'PROCESS TELEMETRY', 'DISTRIBUTION', 'QR PASSPORT', 'AUTHORIZATION'];

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
            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'COOKING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData, compact: true });
        };

        const drawTableHeader = () => {
            pdf.setFillColor(30, 41, 59);
            pdf.rect(ml, y, cw, 18, 'F');
            pdf.setFontSize(5.5);
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            for (let i = 0; i < 8; i++) {
                pdf.text(colHeaders[i], colX[i] + 4, y + 12);
            }
            pdf.setDrawColor(100, 116, 139);
            pdf.setLineWidth(0.3);
            for (let i = 1; i < 8; i++) {
                pdf.line(colX[i], y + 3, colX[i], y + 15);
            }
            y += 18;
        };

        const drawTableRow = async (e: CookingRecordEntry, rowIdx: number) => {
            const hasVerification = e.isVerified;
            const rowH = hasVerification ? 85 : 65;

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
            for (let i = 1; i < 8; i++) {
                pdf.line(colX[i], ry, colX[i], ry + rowH);
            }

            const cx = (i: number) => colX[i] + 4;

            // COL 0: UNIT DETAILS
            pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            const locLines = pdf.splitTextToSize(e.locationName || '', colWidths[0] - 8);
            pdf.text(locLines.slice(0, 2), cx(0), ry + 10);
            pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(e.departmentName || '', cx(0), ry + 22);
            pdf.setFontSize(5.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(e.unitName || '', cx(0), ry + 32);
            pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
            pdf.text(e.regionName || '', cx(0), ry + 40);

            // COL 1: PRODUCT INFO
            pdf.setFontSize(7); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
            const prodLines = pdf.splitTextToSize(e.productName || '', colWidths[1] - 8);
            pdf.text(prodLines.slice(0, 2), cx(1), ry + 10);
            pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`DATE: ${e.cookCompleted ? e.cookCompleted.split('T')[0] : 'PENDING'}`, cx(1), ry + 24);
            pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`TIME: ${e.cookCompleted ? new Date(e.cookCompleted).toLocaleTimeString() : '---'}`, cx(1), ry + 32);

            // COL 2: MATERIAL ANALYSIS
            pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            const srcLines = pdf.splitTextToSize(e.sourceProductName || '', colWidths[2] - 8);
            pdf.text(srcLines.slice(0, 2), cx(2), ry + 10);
            pdf.setFontSize(5.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(15, 23, 42);
            pdf.text(`BATCH: ${e.batchNumber}`, cx(2), ry + 22);
            pdf.setTextColor(16, 185, 129);
            pdf.text(`MFG: ${e.mfgDate || 'N/A'}`, cx(2), ry + 30);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`EXP: ${e.expDate || 'N/A'}`, cx(2), ry + 38);
            if (e.brandName) { pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal'); pdf.text(`Brand: ${e.brandName}`, cx(2), ry + 46); }
            if (e.category) { pdf.setFontSize(5); pdf.setTextColor(148, 163, 184); pdf.text(`Cat: ${e.category}`, cx(2), ry + 53); }

            // COL 3: THAWING
            pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(e.thawingMethod || 'N/A', cx(3), ry + 12);
            pdf.setFontSize(5.5); pdf.setTextColor(59, 130, 246); pdf.setFont('helvetica', 'bold');
            pdf.text(`${e.thawFinalTemp != null ? e.thawFinalTemp + '°C' : '---'}`, cx(3), ry + 22);
            pdf.setFontSize(6); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
            pdf.text(`${e.availableThawedQty?.toFixed(1) || '0.0'} ${e.storedUnit || ''}`, cx(3), ry + 32);

            // COL 4: PROCESS TELEMETRY
            pdf.setFontSize(11); pdf.setTextColor(225, 29, 72); pdf.setFont('helvetica', 'bold');
            pdf.text(`${e.initialTemp || '---'}°C`, cx(4), ry + 14);
            pdf.setFontSize(6); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`Final: ${e.finalTemp || '---'}°C`, cx(4), ry + 24);
            pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
            pdf.text(`Start: ${e.cookStart ? new Date(e.cookStart).toLocaleTimeString() : '---'}`, cx(4), ry + 32);
            pdf.text(`End: ${e.cookCompleted ? new Date(e.cookCompleted).toLocaleTimeString() : '---'}`, cx(4), ry + 39);
            if (e.cookingVessel) { pdf.setFontSize(5.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold'); pdf.text(e.cookingVessel, cx(4), ry + 47); }
            pdf.setFontSize(5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
            pdf.text(`Lapse: ${formatTimeLapse(e.cookStart, e.cookCompleted)}`, cx(4), ry + 55);

            // COL 5: DISTRIBUTION
            const issued = e.issued || [];
            let distY = ry + 10;
            if (issued.length > 0) {
                for (let ii = 0; ii < Math.min(issued.length, 4); ii++) {
                    pdf.setFontSize(5.5); pdf.setTextColor(79, 70, 229); pdf.setFont('helvetica', 'bold');
                    pdf.text(issued[ii].purpose, cx(5), distY);
                    pdf.setTextColor(15, 23, 42);
                    pdf.text(`${issued[ii].quantity.toFixed(1)}`, cx(5) + colWidths[5] - 24, distY);
                    distY += 8;
                }
                const totalCQ = Number(e.cookingQuantity) || 0;
                const distW = issued.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
                const rem = Math.max(0, totalCQ - distW);
                pdf.setFontSize(5); pdf.setTextColor(rem > 0 ? 225 : 5, rem > 0 ? 29 : 150, rem > 0 ? 72 : 105); pdf.setFont('helvetica', 'bold');
                pdf.text(`Rem: ${rem.toFixed(1)}`, cx(5), distY + 2);
            } else {
                pdf.setFontSize(5.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
                pdf.text('No distribution', cx(5), distY);
            }

            // COL 6: QR PASSPORT
            const qrString = buildCookingQRUrl(e);
            try {
                const qrDataUrl = await renderQRToCanvas(qrString);
                if (qrDataUrl) {
                    const qrSize = 36;
                    const qrX = cx(6) + (colWidths[6] - 8) / 2 - qrSize / 2;
                    pdf.addImage(qrDataUrl, 'PNG', qrX, ry + 4, qrSize, qrSize);
                    pdf.setFontSize(4.5);
                    pdf.setTextColor(148, 163, 184);
                    pdf.setFont('helvetica', 'bold');
                    const scanText = 'SCAN FOR RECORD';
                    pdf.text(scanText, cx(6) + (colWidths[6] - 8) / 2 - pdf.getTextWidth(scanText) / 2, ry + qrSize + 8);
                }
            } catch {}

            // COL 7: AUTHORIZATION
            const authX = cx(7);
            const authW = colWidths[7] - 10;
            pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
            pdf.text('OPERATOR', authX, ry + 8);
            pdf.setFontSize(6.5); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(e.initiatedBy || 'N/A', authX, ry + 16);

            if (e.initiatedBySign && e.initiatedBySign.startsWith('data:')) {
                try { pdf.addImage(e.initiatedBySign, e.initiatedBySign.includes('image/png') ? 'PNG' : 'JPEG', authX, ry + 18, Math.min(authW, 80), 10); } catch {}
            }

            let verY = ry + 32;
            if (hasVerification) {
                pdf.setFillColor(240, 253, 244);
                pdf.setDrawColor(187, 247, 208);
                pdf.setLineWidth(0.5);
                pdf.rect(authX - 2, verY, Math.min(authW + 4, 90), 12, 'FD');
                pdf.setFontSize(5.5); pdf.setTextColor(5, 150, 105); pdf.setFont('helvetica', 'bold');
                pdf.text('QA AUTHORIZED', authX + 2, verY + 5);
                pdf.setFontSize(6.5); pdf.setTextColor(6, 78, 59); pdf.setFont('helvetica', 'bold');
                pdf.text(e.verifierName || '', authX + 2, verY + 10);
                verY += 14;

                if (e.verifierSignature && e.verifierSignature.startsWith('data:')) {
                    try { pdf.addImage(e.verifierSignature, e.verifierSignature.includes('image/png') ? 'PNG' : 'JPEG', authX, verY, Math.min(authW, 80), 10); verY += 12; } catch {}
                }

                if (e.verificationComments) {
                    pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                    const cmtLines = pdf.splitTextToSize(e.verificationComments, authW);
                    pdf.text(cmtLines.slice(0, 3), authX, verY + 5);
                    verY += cmtLines.slice(0, 3).length * 5 + 3;
                }

                if (e.verificationDate) {
                    pdf.setFontSize(5.5); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'bold');
                    const dateStr = new Date(e.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                    pdf.text(dateStr, authX, verY + 5);
                }
            } else {
                pdf.setFontSize(7); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold');
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
        pdf.text('LEAD PRODUCTION SIGNATURE', ml + 8, y + 12);
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

    const handleExportGlobalPDF = async () => {
        if (filteredEntries.length === 0) return;
        setIsGeneratingPDF(true);
        const filename = `Complete_Cooking_Registry_${new Date().toISOString().split('T')[0]}.pdf`;
        await generatePDFForEntries(filteredEntries, filename);
        setIsGeneratingPDF(false);
    };

    const handleExportSinglePDF = async (entry: CookingRecordEntry) => {
        setIsGeneratingPDF(true);
        try {
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            const ml = 40, mr = 40, mt = 40, mb = 50;
            const cw = pw - ml - mr;
            let y = mt;
            const securityId = `CERT-COOK-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
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

            y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'COOKING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData });

            pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
            pdf.text(`COOKING RECORD #${entry.batchNumber}`, ml, y);
            const statusColor: Record<string, number[]> = { 'COMPLETED': [5, 150, 105], 'IN_PROGRESS': [245, 158, 11], 'THAWED': [59, 130, 246] };
            const sc = statusColor[entry.status || 'COMPLETED'] || [100, 116, 139];
            pdf.setTextColor(sc[0], sc[1], sc[2]);
            pdf.setFontSize(9);
            pdf.text(entry.isVerified ? 'VERIFIED' : (entry.status || '').toUpperCase(), pw - mr, y, { align: 'right' });
            y += 12;

            const sectionHeader = (title: string) => {
                if (y + 30 > ph - mb) { y = mt; pdf.addPage(); pdf.setTextColor(235, 238, 245); pdf.setFontSize(52); pdf.setFont('helvetica', 'bold'); pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 }); }
                pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 16, 'F');
                pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
                pdf.text(title, ml + 8, y + 11);
                y += 16;
            };

            const rowH = 16;
            const halfW = cw / 2;
            const drawRow = (label1: string, val1: string, label2?: string, val2?: string, valColor1?: number[], valColor2?: number[]) => {
                if (y + rowH > ph - mb) { y = mt; pdf.addPage(); pdf.setTextColor(235, 238, 245); pdf.setFontSize(52); pdf.setFont('helvetica', 'bold'); pdf.text('CONTROLLED RECORD', pw / 2, ph / 2, { align: 'center', angle: 30 }); }
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
            drawRow('Location:', entry.locationName || 'N/A', 'Department:', entry.departmentName || 'N/A');
            drawRow('Unit:', entry.unitName || 'N/A', 'Region:', entry.regionName || 'N/A');

            sectionHeader('PRODUCT INFORMATION');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 5);
            drawRow('Product Name:', entry.productName || '', '', '', [79, 70, 229]);
            drawRow('Source Material:', entry.sourceProductName || '');
            drawRow('Category:', entry.category || 'N/A', 'Brand:', entry.brandName || 'N/A');
            drawRow('Mfg Date:', entry.mfgDate || 'N/A', 'Exp Date:', entry.expDate || 'N/A', undefined, [225, 29, 72]);
            drawRow('Batch Number:', entry.batchNumber || '');

            sectionHeader('THAWING & MATERIAL PREP');
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 3);
            drawRow('Thawing Method:', entry.thawingMethod || 'N/A');
            drawRow('Thaw Final Temp:', entry.thawFinalTemp != null ? `${entry.thawFinalTemp}°C` : 'N/A');
            drawRow('Thawed Qty:', `${entry.availableThawedQty?.toFixed(1) || '0.0'}`, 'Stored Unit:', entry.storedUnit || 'N/A');

            sectionHeader('PROCESS TELEMETRY');
            const hasCookComments = !!entry.cookComments;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (5 + (hasCookComments ? 1 : 0)));
            drawRow('Cook Start:', entry.cookStart ? new Date(entry.cookStart).toLocaleString() : 'N/A', 'Cook Completed:', entry.cookCompleted ? new Date(entry.cookCompleted).toLocaleString() : 'N/A');
            drawRow('Initial Temp:', entry.initialTemp != null ? `${entry.initialTemp}°C` : 'N/A', 'Final Temp:', entry.finalTemp != null ? `${entry.finalTemp}°C` : 'N/A', [225, 29, 72]);
            drawRow('Cooking Vessel:', entry.cookingVessel || 'N/A');
            drawRow('Cooked Quantity:', `${entry.cookingQuantity || '0'} ${entry.storedUnit || ''}`, 'Cook Lapse:', formatTimeLapse(entry.cookStart, entry.cookCompleted));
            drawRow('Status:', entry.status || '', '', '', entry.status === 'COMPLETED' ? [5, 150, 105] : [245, 158, 11]);
            if (hasCookComments) { drawRow('Cook Comments:', entry.cookComments || ''); }

            sectionHeader('OPERATOR DETAILS');
            const opSigH = (entry.initiatedBySign || entry.completedBySign) ? 30 : 0;
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * 2 + opSigH);
            drawRow('Initiated By:', entry.initiatedBy || 'N/A', 'Completed By:', entry.completedBy || 'N/A');
            drawRow('Cook Lapse:', formatTimeLapse(entry.cookStart, entry.cookCompleted));
            if (entry.initiatedBySign && entry.initiatedBySign.startsWith('data:')) {
                try {
                    const sigData = await toDataUrl(entry.initiatedBySign);
                    if (sigData) {
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Initiator Signature:', ml + 8, y + 8);
                        pdf.addImage(sigData, sigData.includes('image/png') ? 'PNG' : 'JPEG', ml + 8, y + 10, 80, 16);
                    }
                } catch {}
            }
            if (entry.completedBySign && entry.completedBySign.startsWith('data:')) {
                try {
                    const sigData = await toDataUrl(entry.completedBySign);
                    if (sigData) {
                        pdf.setFontSize(6); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'normal');
                        pdf.text('Completion Signature:', ml + halfW + 8, y + 8);
                        pdf.addImage(sigData, sigData.includes('image/png') ? 'PNG' : 'JPEG', ml + halfW + 8, y + 10, 80, 16);
                    }
                } catch {}
            }
            y += opSigH;

            const issuedItems = entry.issued || [];
            if (issuedItems.length > 0) {
                sectionHeader('DISTRIBUTION REGISTRY');
                pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * (issuedItems.length + 1));
                for (const iss of issuedItems) {
                    drawRow('Purpose:', iss.purpose, 'Quantity:', `${iss.quantity.toFixed(1)} ${entry.storedUnit || ''}`);
                }
                const totalDist = issuedItems.reduce((a, c) => a + (Number(c.quantity) || 0), 0);
                const remaining = Math.max(0, (Number(entry.cookingQuantity) || 0) - totalDist);
                drawRow('Remaining:', `${remaining.toFixed(1)} ${entry.storedUnit || ''}`, '', '', remaining > 0 ? [225, 29, 72] : [5, 150, 105]);
            }

            sectionHeader('AUTHORIZATION & VERIFICATION');
            const verRows = 2 + (entry.verificationComments ? 1 : 0) + (entry.verificationDate ? 1 : 0);
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.rect(ml, y, cw, rowH * verRows + (entry.verifierSignature ? 30 : 0));
            drawRow('Verified By:', entry.isVerified ? (entry.verifierName || 'N/A') : 'PENDING', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
            drawRow('Verification Status:', entry.isVerified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION', '', '', entry.isVerified ? [5, 150, 105] : [245, 158, 11]);
            if (entry.verificationComments) { drawRow('Comments:', entry.verificationComments); }
            if (entry.verificationDate) {
                const vDateStr = new Date(entry.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
                drawRow('Verification Date:', vDateStr);
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
            const qrString = buildCookingQRUrl(entry);
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

            if (y + 60 > ph - mb) { y = mt; pdf.addPage(); }

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

            savePdfForPWA(pdf, `Cooking_Record_${entry.batchNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) { console.error('PDF generation error:', err); }
        setIsGeneratingPDF(false);
    };

    const handleBulkVerifyClick = () => {
        if (selectedIds.size === 0) return;
        setSelectedEntry(null); // Clear single entry to signal bulk mode
        setVerificationComments("");
        setVerificationSignature("");
        setActiveModal('VERIFY');
    };

    const handleAddManualEntry = () => {
        if (!manualProductName || !manualBatchNumber || !manualCookingQty) {
            alert("Please fill in product name, batch number, and cooked quantity");
            return;
        }

        const newEntry: CookingRecordEntry = {
            uuid: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            productName: manualProductName,
            batchNumber: manualBatchNumber,
            category: manualCategory,
            brandName: manualBrandName,
            mfgDate: manualMfgDate,
            expDate: manualExpDate,
            sourceProductName: '',
            thawingMethod: 'Manual Entry',
            thawFinalTemp: null,
            availableThawedQty: 0,
            totalThawedQty: 0,
            storedUnit: manualUnit,
            cookStart: manualCookStart || new Date().toISOString(),
            cookCompleted: manualCookEnd || new Date().toISOString(),
            initialTemp: manualInitialTemp ? parseFloat(manualInitialTemp) : null,
            finalTemp: manualFinalTemp ? parseFloat(manualFinalTemp) : null,
            cookingVessel: '',
            cookingQuantity: parseFloat(manualCookingQty),
            initiatedBy: 'Manual Entry',
            initiatedBySign: '',
            completedBy: 'Manual Entry',
            completedBySign: '',
            status: 'COMPLETED',
            isVerified: false,
            verifierName: '',
            verifierSignature: '',
            verificationComments: '',
            verificationDate: '',
            issued: [],
            cookComments: '',
            locationName: 'Not Specified',
            departmentName: 'Not Specified',
            unitName: 'Not Specified',
            regionName: 'Not Specified',
            createdAtMs: Date.now(),
        };

        setEntries(prev => [...prev, newEntry]);
        
        // Reset form
        setManualProductName("");
        setManualBatchNumber("");
        setManualCategory("");
        setManualBrandName("");
        setManualMfgDate("");
        setManualExpDate("");
        setManualCookStart("");
        setManualCookEnd("");
        setManualInitialTemp("");
        setManualFinalTemp("");
        setManualCookingQty("");
        setManualUnit("kg");
        setActiveModal(null);
    };

    return (
        <div className="flex flex-col h-full gap-6 p-4 md:p-0">
            {/* MOBILE STATS - Horizontal scrollable compact tiles */}
            <div className="lg:hidden">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-3xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
                            <Flame size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-tight">Cooking Registry</h2>
                            <p className="text-[9px] font-bold text-indigo-300/60 uppercase tracking-widest">Production Control</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { label: 'All', val: stats.total, color: 'bg-white/10', textColor: 'text-white', id: 'ALL' },
                            { label: 'Thawed', val: stats.thawed, color: 'bg-blue-500/20', textColor: 'text-blue-300', id: 'THAWED' },
                            { label: 'Active', val: stats.inProgress, color: 'bg-orange-500/20', textColor: 'text-orange-300', id: 'IN_PROGRESS' },
                            { label: 'Done', val: stats.completed, color: 'bg-emerald-500/20', textColor: 'text-emerald-300', id: 'COMPLETED' },
                        ].map((stat, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveFilter(stat.id as any)}
                                className={`p-3 rounded-2xl text-center transition-all active:scale-95 ${activeFilter === stat.id ? 'ring-2 ring-indigo-400 ' + stat.color : stat.color + ' opacity-70'}`}
                            >
                                <p className={`text-xl font-black leading-none ${stat.textColor}`}>{stat.val}</p>
                                <p className="text-[7px] font-black text-white/40 uppercase tracking-wider mt-1">{stat.label}</p>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-3 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-9 pr-3 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-400 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleExportGlobalPDF}
                        disabled={isGeneratingPDF}
                        className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    </button>
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkVerifyClick}
                            className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-lg flex items-center gap-1.5 animate-in zoom-in"
                        >
                            <ShieldCheck size={16} strokeWidth={3} /> {selectedIds.size}
                        </button>
                    )}
                </div>
            </div>

            {/* DESKTOP STATS */}
            <div className="hidden lg:grid grid-cols-5 gap-4">
                {[
                    { label: 'Registry Pool', val: stats.total, color: 'bg-slate-900', icon: Database, id: 'ALL' },
                    { label: 'Thawed Ready', val: stats.thawed, color: 'bg-blue-600', icon: Snowflake, id: 'THAWED' },
                    { label: 'Heat Induction', val: stats.inProgress, color: 'bg-orange-500', icon: Flame, id: 'IN_PROGRESS' },
                    { label: 'Cycle Finished', val: stats.completed, color: 'bg-emerald-600', icon: CheckCircle2, id: 'COMPLETED' },
                    { label: 'Verified Auth', val: stats.verified, color: 'bg-amber-50', icon: ShieldCheck, id: 'VERIFIED' }
                ].map((stat, i) => (
                    <button 
                        key={i} 
                        onClick={() => stat.id !== 'VERIFIED' && setActiveFilter(stat.id as any)}
                        className={`p-6 rounded-[2.5rem] border-2 transition-all text-left flex flex-col justify-between group active:scale-95 ${activeFilter === stat.id ? 'bg-white border-indigo-600 shadow-xl' : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'}`}
                    >
                        <div className={`w-10 h-10 rounded-xl ${stat.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                            <stat.icon size={20} />
                        </div>
                        <div className="mt-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
                        </div>
                    </button>
                ))}
            </div>

            {/* DESKTOP INTEGRATED ACTION CARD */}
            <div className="hidden lg:flex bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl flex-col lg:flex-row items-center justify-between gap-4 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
                    <button 
                        onClick={toggleSelectAll}
                        className={`p-3.5 rounded-2xl border-2 transition-all shadow-sm active:scale-95 ${areAllSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-100' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-400'}`}
                        title="Select All Eligible"
                    >
                        {areAllSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>

                    <div className="relative group w-full lg:w-[400px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by product or batch..." 
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[10px] font-black focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner uppercase tracking-wider"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                    {selectedIds.size > 0 && (
                        <button 
                            onClick={handleBulkVerifyClick}
                            className="px-6 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 animate-in zoom-in"
                        >
                            <ShieldCheck size={18} strokeWidth={3} /> Bulk Verify ({selectedIds.size})
                        </button>
                    )}
                    <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95" title="Filter Records">
                        <Filter size={20} />
                    </button>
                    <button 
                        onClick={handleExportGlobalPDF}
                        disabled={isGeneratingPDF}
                        className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                        title="Download Report"
                    >
                        {isGeneratingPDF ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                    </button>
                    <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-95" title="Refresh Registry">
                        <RefreshCw size={20} />
                    </button>
                    <div className="w-px h-8 bg-slate-200 mx-2 hidden lg:block" />
                    <button 
                        onClick={() => setActiveModal('MANUAL_ENTRY')} 
                        className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={18} strokeWidth={3} /> New Entry
                    </button>
                </div>
            </div>

            {/* MOBILE FLOATING ADD BUTTON */}
            <button 
                onClick={() => setActiveModal('MANUAL_ENTRY')}
                className="lg:hidden fixed bottom-6 right-6 z-40 w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all hover:bg-black"
                title="Add Manual Cooking Record"
            >
                <Plus size={28} strokeWidth={3} />
            </button>

            <div className="flex flex-col gap-4 lg:gap-6 pb-20 lg:pb-0">
                {paginatedEntries.map((row, idx) => (
                    <CookingCard 
                        key={row.uuid}
                        entry={row}
                        index={(currentPage - 1) * rowsPerPage + idx + 1}
                        isSelected={selectedIds.has(row.uuid)} 
                        onSelect={() => toggleSelection(row.uuid)}
                        onVerification={() => { 
                            setSelectedEntry(row); 
                            setVerificationSignature(""); 
                            setVerificationComments(""); 
                            setActiveModal('VERIFY'); 
                        }}
                        openCookModal={() => { setSelectedEntry(row); setProductNameInput(row.productName); setTempInput(""); setTempImg(null); setSignature(""); setComments(""); setActiveModal('COOK'); }}
                        handleCompleteCooking={() => { 
                            const stopTime = new Date().toISOString();
                            setEntries(prev => prev.map(e => e.uuid === row.uuid ? { ...e, cookCompleted: stopTime } : e));
                            setSelectedEntry({ ...row, cookCompleted: stopTime }); 
                            setSignature(""); 
                            setComments(""); 
                            setCookedQtyInput(""); 
                            setActiveModal('FINALIZE'); 
                        }}
                        onDownload={() => handleExportSinglePDF(row)}
                        formatTimeLapse={formatTimeLapse}
                        onSplit={() => { setSelectedEntry(row); setSplitName(""); setSplitQty(""); setActiveModal('SPLIT'); }}
                        onSplitCooked={() => { 
                            setSelectedEntry(row); 
                            const currentIssued = (row.issued || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
                            const remaining = Math.max(0, row.cookingQuantity - currentIssued);
                            setStagedSplits([{ id: '1', quantity: remaining > 0 ? remaining.toString() : '', purpose: COOKED_PURPOSES[0] }]); 
                            setActiveModal('SPLIT_COOKED'); 
                        }}
                        now={now}
                    />
                ))}
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
            <input type="file" ref={fileInputRef} capture="environment" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

            {/* SPLIT THAWED MODAL */}
            {activeModal === 'SPLIT' && selectedEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-indigo-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Split size={24}/></div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Split Thawed Batch</h3>
                                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Registry Sub-Division</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        <div className="p-10 space-y-6 text-left">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-2 shadow-inner">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Source</p>
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none truncate">{selectedEntry.productName}</h4>
                                <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-100">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Available Quantity</span>
                                    <span className="text-sm font-black text-indigo-600">{selectedEntry.availableThawedQty.toFixed(1)} {selectedEntry.storedUnit}</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Product Name <span className="text-red-500">*</span></label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="E.G. SHREE..."
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black uppercase focus:border-indigo-500 outline-none shadow-inner"
                                        value={splitName}
                                        onChange={e => setSplitName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Split Quantity ({selectedEntry.storedUnit}) <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            placeholder="0.0"
                                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xl font-black focus:border-indigo-500 outline-none shadow-inner"
                                            value={splitQty}
                                            onChange={e => setSplitQty(e.target.value)}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">{selectedEntry.storedUnit}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                            <button 
                                disabled={!splitName || !splitQty || parseFloat(splitQty) <= 0 || parseFloat(splitQty) > selectedEntry.availableThawedQty}
                                onClick={handleSplitSubmit} 
                                className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${splitName && splitQty ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                <CheckCircle2 size={18} strokeWidth={3} /> Confirm Split
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SPLIT COOKED MODAL */}
            {activeModal === 'SPLIT_COOKED' && selectedEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[85vh] md:h-auto max-h-[90vh]">
                        <div className="px-10 py-8 bg-[#0f172a] text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Split size={24}/></div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Cooked Batch Assignment</h3>
                                    <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Split Purpose Logic</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} strokeWidth={3} /></button>
                        </div>
                        <div className="p-8 space-y-6 text-left flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
                            {(() => {
                                const currentIssued = (selectedEntry.issued || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
                                const totalToAssign = stagedSplits.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
                                const remaining = Math.max(0, selectedEntry.cookingQuantity - currentIssued - totalToAssign);
                                return (
                                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><Package size={64}/></div>
                                        <div className="relative z-10 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Production Registry</p>
                                                <h4 className="text-xl font-black uppercase tracking-tight truncate leading-none">{selectedEntry.productName}</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                                <div>
                                                    <p className="text-[8px] font-black text-white/40 uppercase">Total Yield</p>
                                                    <p className="text-lg font-black text-indigo-400">{selectedEntry.cookingQuantity.toFixed(1)} {selectedEntry.storedUnit}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[8px] font-black text-white/40 uppercase">Unassigned</p>
                                                    <p className={`text-lg font-black ${remaining < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{remaining.toFixed(1)} {selectedEntry.storedUnit}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <GitPullRequest size={14} className="text-indigo-500" /> Distribution Breakdown
                                </h5>
                                
                                {stagedSplits.map((split, idx) => (
                                    <div key={split.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 space-y-4 relative group/s animate-in slide-in-from-left-2 relative group">
                                        {stagedSplits.length > 1 && (
                                            <button 
                                                onClick={() => removeStagedSplit(split.id)}
                                                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Purpose</label>
                                                <select 
                                                    className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-xl text-xs font-black uppercase focus:border-indigo-400 outline-none shadow-inner cursor-pointer transition-all"
                                                    value={split.purpose}
                                                    onChange={e => updateStagedSplit(split.id, 'purpose', e.target.value)}
                                                >
                                                    {COOKED_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity ({selectedEntry.storedUnit})</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        step="0.1"
                                                        placeholder="0.0"
                                                        className="w-full p-3 bg-slate-50 border-2 border-slate-50 rounded-2xl text-sm font-black focus:border-indigo-500 outline-none shadow-inner transition-all"
                                                        value={split.quantity}
                                                        onChange={e => updateStagedSplit(split.id, 'quantity', e.target.value)}
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">{selectedEntry.storedUnit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button 
                                    onClick={addStagedSplit}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-3xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest"
                                >
                                    <PlusCircle size={18} /> Add Another Distribution
                                </button>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 transition-colors">Discard</button>
                            <button 
                                onClick={handleCookedSplitSubmit} 
                                disabled={stagedSplits.some(s => !s.quantity || parseFloat(s.quantity) <= 0)}
                                className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${stagedSplits.every(s => s.quantity && parseFloat(s.quantity) > 0) ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                <CheckCircle2 size={18} strokeWidth={3} /> Commit Distribution
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* COOK MODAL */}
            {activeModal === 'COOK' && selectedEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[85vh] md:h-auto max-h-[90vh]">
                        <div className="px-10 py-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-5">
                                <Flame size={32} />
                                <div><h3 className="text-xl font-black uppercase tracking-tight">{editingEntryId ? 'Edit Identity' : 'Initiate Cooking'}</h3><p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-1">Heat Induction Registry</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        <div className="p-10 space-y-6 overflow-y-auto flex-1 text-left">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name <span className="text-red-500">*</span></label>
                                <input required value={productNameInput} onChange={e => setProductNameInput(e.target.value)} className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-black uppercase focus:border-indigo-500 outline-none shadow-inner" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cooking Vessel</label>
                                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase" value={vesselInput} onChange={e => setVesselInput(e.target.value)}>
                                    {OVEN_NUMBERS.map(o => <option key={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Intake Temp (°C) <span className="text-blue-400 font-bold normal-case">Standard: &gt; 75.0°C</span></label>
                                <div className="flex gap-2">
                                    <input type="number" step="0.1" autoFocus className={`w-full p-4 bg-white border-2 rounded-xl text-lg font-black outline-none shadow-inner transition-all ${tempInput && parseFloat(tempInput) <= 75 ? 'border-rose-300 bg-rose-50 focus:border-rose-400' : 'border-slate-100 focus:border-indigo-500'}`} placeholder="75.0" value={tempInput} onChange={e => { setTempInput(e.target.value); setCookTempWarning(null); }} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-4 rounded-xl transition-all shadow-sm ${tempImg ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300 hover:text-indigo-600'}`}>
                                        <Camera size={24}/>
                                    </button>
                                </div>
                                {tempInput && parseFloat(tempInput) <= 75 && (
                                    <p className="text-[9px] font-bold text-rose-500 flex items-center gap-1 ml-1"><AlertTriangle size={10} /> Below standard. Must exceed 75.0°C.</p>
                                )}
                                {tempImg && (
                                    <div className="mt-2 relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-sm animate-in zoom-in-95">
                                        <img src={tempImg} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setTempImg(null)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><X size={10} strokeWidth={4}/></button>
                                    </div>
                                )}
                            </div>
                            <SignaturePad onSave={setSignature} label="Operator Auth Signature" />
                        </div>

                        {cookTempWarning && (
                            <div className="mx-10 mb-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-200">
                                <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-black text-rose-700 uppercase tracking-tight">Validation Error</p>
                                    <p className="text-[11px] font-bold text-rose-600 mt-1">{cookTempWarning}</p>
                                </div>
                                <button onClick={() => setCookTempWarning(null)} className="ml-auto shrink-0 text-rose-300 hover:text-rose-500"><X size={16} /></button>
                            </div>
                        )}

                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => { setActiveModal(null); setCookTempWarning(null); }} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                            <button disabled={!tempInput || !signature || !productNameInput} onClick={handleInitiateCook} className={`px-12 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${tempInput && signature && productNameInput ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Start Cooking</button>
                        </div>
                    </div>
                </div>
            )}

            {/* FINALIZE MODAL */}
            {activeModal === 'FINALIZE' && selectedEntry && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[85vh] md:h-auto max-h-[90vh]">
                        <div className="px-10 py-8 bg-orange-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <Timer size={32} />
                                <div><h3 className="text-xl font-black uppercase tracking-tight text-white">Stop Process Timer</h3><p className="text-[10px] font-bold text-orange-100 uppercase tracking-widest mt-1">Finalize Production Cycle</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} strokeWidth={3} /></button>
                        </div>
                        <div className="p-10 space-y-6 overflow-y-auto flex-1 text-left">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-2 space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Summary</p>
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">{selectedEntry.productName}</h4>
                                <div className="flex gap-4 mt-2">
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Intake Temp</span><span className="text-sm font-black text-slate-700">{selectedEntry.initialTemp}°C</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-400 uppercase">Active Time</span><span className="text-sm font-black text-orange-600">{formatTimeLapse(selectedEntry.cookStart, selectedEntry.cookCompleted)}</span></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Cooked Weight ({selectedEntry.storedUnit})</label>
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-lg font-black outline-none focus:border-indigo-500 shadow-inner" 
                                        placeholder="0.0" 
                                        value={cookedQtyInput}
                                        onChange={e => setCookedQtyInput(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400">Cancel</button>
                            <button 
                                disabled={!cookedQtyInput} 
                                onClick={handleFinalizeSubmit} 
                                className={`px-12 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${cookedQtyInput ? 'bg-orange-600 text-white shadow-orange-100 hover:bg-orange-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                <CheckCircle2 size={18} strokeWidth={3} /> Stop Timer & Finalize
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'VERIFY' && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-emerald-600 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-4">
                                <ShieldCheck size={28} strokeWidth={3} />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">Authority Node Verification</h3>
                                    <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1">Registry Synchronization Node</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} strokeWidth={3} /></button>
                        </div>
                        <div className="p-10 space-y-8 bg-slate-50/20 text-left">
                            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-5">
                                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                    {selectedEntry ? <CheckCircle2 size={24}/> : <Layers size={24}/>}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">{selectedEntry ? 'Batch to Verify' : 'Bulk Verification'}</p>
                                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter truncate">
                                        {selectedEntry ? selectedEntry.productName : `${selectedIds.size} Records Selected`}
                                    </h4>
                                </div>
                            </div>
                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verification Audit Notes</label>
                                <textarea 
                                    className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-400 shadow-inner resize-none h-32" 
                                    placeholder="Enter findings for the selected batch..." 
                                    value={verificationComments} 
                                    onChange={e => setVerificationComments(e.target.value)} 
                                />
                            </div>
                            <SignaturePad onSave={setVerificationSignature} initialData={verificationSignature} label="QA Verifier Authority Signature" />
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-10 py-4 text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest order-2 sm:order-1 transition-colors">Cancel</button>
                            <button 
                                disabled={!verificationSignature} 
                                onClick={commitVerify} 
                                className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all order-1 sm:order-2 ${verificationSignature ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                            >
                                Finalize Authorization
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANUAL ENTRY MODAL */}
            {activeModal === 'MANUAL_ENTRY' && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
                        <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0 sticky top-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-700 rounded-2xl shadow-lg"><PlusCircle size={24}/></div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Add Manual Cooking Record</h3>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">Enter Historical or Ad-Hoc Cooking Data</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        <div className="p-10 space-y-6 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Shrimp Fry Mix"
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase focus:border-slate-900 outline-none shadow-inner"
                                        value={manualProductName}
                                        onChange={e => setManualProductName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. BATCH-2024-001"
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase focus:border-slate-900 outline-none shadow-inner"
                                        value={manualBatchNumber}
                                        onChange={e => setManualBatchNumber(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Seafood"
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase focus:border-slate-900 outline-none shadow-inner"
                                        value={manualCategory}
                                        onChange={e => setManualCategory(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Premium Foods"
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase focus:border-slate-900 outline-none shadow-inner"
                                        value={manualBrandName}
                                        onChange={e => setManualBrandName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mfg Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 outline-none shadow-inner"
                                        value={manualMfgDate}
                                        onChange={e => setManualMfgDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exp Date</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 outline-none shadow-inner"
                                        value={manualExpDate}
                                        onChange={e => setManualExpDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-6">
                                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">COOKING PROCESS</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Initial Temp (°C)</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            placeholder="75.0"
                                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-slate-900 outline-none shadow-inner"
                                            value={manualInitialTemp}
                                            onChange={e => setManualInitialTemp(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                            <button 
                                onClick={handleAddManualEntry} 
                                disabled={!manualProductName || !manualBatchNumber}
                                className={`px-12 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${manualProductName && manualBatchNumber ? 'bg-slate-900 text-white shadow-slate-100 hover:bg-black' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                <Plus size={16} className="inline mr-2" strokeWidth={3} /> Add Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CookingRecord;
