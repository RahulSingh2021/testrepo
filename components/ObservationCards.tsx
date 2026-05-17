"use client";

// Shared observation card components used by BOTH the internal Observation
// Registry (admin mode) and the public share-link recipient page
// (public mode). Keeping them in one place is the whole point — any visual
// or layout change to the registry card automatically appears on every
// share link too, with zero extra work.
//
// Mode flag:
//   - 'admin'  (default) → full action surface: star, tag, edit, delete,
//     breakdown, schedule/assign/closure menu, share, view-log.
//   - 'public' → recipient-safe surface: only "Acknowledge & Close" plus
//     read-only image viewing and expand/collapse. Star, tag, edit, delete,
//     PDF, view-log, share-on-WhatsApp are all hidden.

import React, { useState, useEffect, useRef } from 'react';
import {
    Star, MapPin, Clock, Eye, History, CheckCircle2, Trash2, Ban, Wrench,
    Edit3, Layers, Users, Package, Signal, ChevronDown, Hourglass, UserPlus,
    GitCommit, Camera, AlertCircle, Maximize2, Repeat, User, Building, Send,
    BookOpen, MessageSquare, FileText, RotateCcw, Share2, ClipboardList,
    CheckCheck, X
} from 'lucide-react';

// --- Shared Types (moved here from ObservationRegistry so both consumers
// share a single source of truth) ---

export interface TrackingStep {
    id: string;
    label: string;
    user: string;
    timestamp: string;
    comments?: string;
}

export interface BreakdownHistoryEntry {
    date: string;
    user: string;
    action: string;
    comments: string;
    cost?: number;
}

export interface ObservationItem {
    id: string;
    title: string;
    sop: string;
    severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
    level: 'L1' | 'L2' | 'L3' | 'L4';
    mainKitchen: string;
    area: string;
    hierarchy: string;
    questionText?: string;
    sectionTitle?: string;
    checklistName?: string;
    closureComments: string | null;
    status: 'OPEN' | 'RESOLVED' | 'PENDING' | 'IN_PROGRESS' | 'PENDING_VERIFICATION' | 'DRAFT';
    duration: string;
    followUpStatus: 'NOT DONE' | 'COMPLIANCE' | 'N/A';
    followUpCount: number;
    followUpDate: string;
    reportedBy: string;
    reportedByUserId?: string;
    lastUpdate: string;
    createdDate: string;
    closureDate?: string;
    thumbnail: string;
    afterImage?: string;
    allEvidence?: any[];
    isStarred: boolean;
    people: { name: string; impact: number }[];
    assets: { name: string; impact: number }[];
    categories: { name: string; impact: number }[];
    tracking: TrackingStep[];
    managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
    parentObservationId?: string;
    linkedObservationId?: string;
    breakdownDetails?: {
        isActive: boolean;
        status: 'active' | 'pending-verification' | 'resolved';
        equipment?: string;
        rootCause?: string;
        totalCost: number;
        history: BreakdownHistoryEntry[];
    };
    regionalId?: string;
    unitId?: string;
    departmentId?: string;
    regionalName?: string;
    unitName?: string;
    departmentName?: string;
    inProgressDate?: string;
    isAuditSourced?: boolean;
    auditTaskId?: string;
    auditObsQuestionId?: string;
    observationText?: string;
    potentialMarkLoss?: number;
    maxMarks?: number;
    isRepeat?: boolean;
    repeatOriginalDate?: string;
    repeatTrail?: { date: string; comment: string }[];
    repeatSourceId?: string;
    selectedAnswer?: string;
    selectedResponseIndex?: number | null;
}

export type CardMode = 'admin' | 'public';

// --- Date formatting (Asia/Kolkata, IST) ---

const formatISTImpl = (dateStr: string | undefined, includeTime: boolean): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        if (includeTime) {
            return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
        }
        return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
};
export const formatIST = (dateStr: string | undefined): string => formatISTImpl(dateStr, true);
export const formatISTDate = (dateStr: string | undefined): string => formatISTImpl(dateStr, false);

// --- ActionGrid ---
//
// Renders the row of per-card action buttons. In 'public' mode the entire
// admin action surface (edit/delete/breakdown/star/etc.) collapses to a
// single "Acknowledge & Close" button, so a recipient on a shared link can
// only do what they're authorised to do server-side anyway.

export const ActionGrid: React.FC<{
    obs: ObservationItem;
    onAction: (type: string, id: string) => void;
    isMobile?: boolean;
    mode?: CardMode;
}> = ({ obs, onAction, isMobile = false, mode = 'admin' }) => {
    const breakdownDetails = obs.breakdownDetails;
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

    // PUBLIC MODE — recipient share-link surface. Show ONLY the close button
    // (action type 'closure' to match the admin handler the page wires up).
    // For already-resolved observations, show a passive badge so the
    // recipient sees state without being able to re-trigger anything.
    if (mode === 'public') {
        if (obs.status === 'RESOLVED') {
            return (
                <div className={`flex items-center justify-center gap-1.5 w-full ${isMobile ? 'mt-1' : ''}`}>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={12} /> Closed
                    </span>
                </div>
            );
        }
        return (
            <button
                onClick={() => onAction('closure', obs.id)}
                className={`w-full flex items-center justify-center gap-2 px-3 ${isMobile ? 'py-3 text-xs' : 'py-2 text-[11px]'} bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl transition-all active:scale-[0.99] shadow-sm`}
            >
                <CheckCheck size={isMobile ? 14 : 12} /> Acknowledge &amp; Close
            </button>
        );
    }

    const btnClass = isMobile
        ? "flex-1 min-w-0 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95"
        : "w-8 h-8 rounded-lg flex items-center justify-center transition-colors";
    const containerClass = isMobile ? "flex flex-nowrap gap-2 w-full relative" : "flex flex-wrap gap-1.5 w-full relative";
    const iconClass = isMobile ? "w-5 h-5" : "w-4 h-4";
    const iconClassLg = isMobile ? "w-6 h-6" : "w-5 h-5";

    if (obs.status === 'RESOLVED') {
        return (
            <div className={`flex flex-nowrap gap-1.5 w-full justify-center ${isMobile ? 'gap-2 mt-2' : ''}`}>
                {obs.breakdownDetails && (
                    <button title="Breakdown History" onClick={() => onAction('view-breakdown-history', obs.id)} className={`${btnClass} bg-green-50 border border-green-200 hover:bg-green-100`}><Wrench className={`${iconClass} text-green-600`} /></button>
                )}
                <button title="Mark Compliant" onClick={() => onAction('compliance', obs.id)} className={`${btnClass} bg-green-50 text-green-700 border border-green-200 hover:bg-green-100`}><CheckCircle2 className={iconClass} /></button>
                <button title="Reopen" onClick={() => onAction('not-compliance', obs.id)} className={`${btnClass} bg-red-50 text-red-700 border border-red-200 hover:bg-red-100`}><RotateCcw className={iconClass} /></button>
                <button title="Mark N/A" onClick={() => onAction('hold', obs.id)} className={`${btnClass} bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100`}><Ban className={iconClass} /></button>
                <button title="View Activity Log" onClick={() => onAction('view-log', obs.id)} className={`${btnClass} bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100`}><History className={iconClass} /></button>
                {!obs.isAuditSourced && <button title="Delete Record" onClick={() => onAction('delete', obs.id)} className={`${btnClass} bg-red-50 text-red-600 border border-red-200 hover:bg-red-100`}><Trash2 className={iconClass} /></button>}
            </div>
        );
    }

    return (
        <div className={containerClass}>
            <button title="Not Done" onClick={() => onAction('reject', obs.id)} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50 text-slate-700`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} rounded-full bg-red-500 flex items-center justify-center`}><X className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-white`} strokeWidth={3} /></div></button>
            <button title="Not Applicable" onClick={() => onAction('hold', obs.id)} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50 text-slate-400`}><Ban className={iconClassLg} /></button>
            {!breakdownDetails ? (
                <button title="Mark as Breakdown" onClick={() => onAction('initiate-breakdown', obs.id)} className={`${btnClass} border border-slate-200 bg-white hover:bg-slate-50`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-red-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-red-600 fill-current`} /></div></button>
            ) : (
                <>
                    {breakdownStatus === 'active' && (<button title="Update Breakdown" onClick={() => onAction('update-breakdown', obs.id)} className={`${btnClass} border border-blue-200 bg-blue-50 hover:bg-blue-100`}><Wrench className={`${iconClassLg} text-blue-600`} /></button>)}
                    {breakdownStatus === 'pending-verification' && (<button title="Verify Closure" onClick={() => onAction('verify-breakdown', obs.id)} className={`${btnClass} border border-yellow-200 bg-white hover:bg-yellow-50 animate-pulse`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-yellow-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-yellow-600 fill-current`} /></div></button>)}
                    {(breakdownStatus === 'resolved' || !isBreakdownActive) && (<button title="View History" onClick={() => onAction('view-breakdown-history', obs.id)} className={`${btnClass} border border-green-200 bg-white hover:bg-yellow-50`}><div className={`${isMobile ? 'w-7 h-7' : 'w-5 h-5'} bg-green-100 rounded flex items-center justify-center`}><Wrench className={`${iconClass} text-green-600 fill-current`} /></div></button>)}
                </>
            )}
            {!obs.isAuditSourced && <button title="Edit" onClick={() => onAction('edit', obs.id)} className={`${btnClass} border border-slate-200 bg-gray-50 hover:bg-gray-100 text-slate-700`}><Edit3 className={iconClass} /></button>}
            <div className="relative" ref={menuRef}>
                <button onClick={() => setShowProcessMenu(!showProcessMenu)} className={`${btnClass} ${showProcessMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50'}`}><Layers className={iconClass} /></button>
                {showProcessMenu && (
                    isMobile ? (
                        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setShowProcessMenu(false)}>
                            <div className="bg-white w-full rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3"><h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Process Actions</h3><button onClick={() => setShowProcessMenu(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={16} /></button></div>
                                <div className="space-y-2">
                                    <button onClick={() => { onAction('staffAck', obs.id); setShowProcessMenu(false); }} className="w-full flex items-center gap-3 p-4 bg-yellow-50 rounded-xl text-left text-sm font-bold text-yellow-700 hover:bg-yellow-100 active:scale-95 transition-all"><div className="p-2 bg-yellow-100 rounded-lg"><Hourglass size={18} /></div> Schedule Task</button>
                                    <button onClick={() => { onAction('assign', obs.id); setShowProcessMenu(false); }} className="w-full flex items-center gap-3 p-4 bg-cyan-50 rounded-xl text-left text-sm font-bold text-cyan-700 hover:bg-cyan-100 active:scale-95 transition-all"><div className="p-2 bg-cyan-100 rounded-lg"><UserPlus size={18} /></div> Assign Member</button>
                                    <button disabled={isBreakdownActive && breakdownStatus !== 'resolved'} onClick={() => { onAction('closure', obs.id); setShowProcessMenu(false); }} className={`w-full flex items-center gap-3 p-4 rounded-xl text-left text-sm font-bold transition-all active:scale-95 ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}><div className={`p-2 rounded-lg ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'bg-slate-100' : 'bg-green-100'}`}><CheckCheck size={18} /></div> Closure</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 p-2 flex flex-col gap-1.5 z-[200] animate-in fade-in zoom-in-95 origin-top-right">
                            <button onClick={() => { onAction('staffAck', obs.id); setShowProcessMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-yellow-50 rounded-lg text-left text-xs font-bold text-yellow-700 transition-colors w-full"><Hourglass size={14} /> Schedule</button>
                            <button onClick={() => { onAction('assign', obs.id); setShowProcessMenu(false); }} className="flex items-center gap-2 p-2 hover:bg-cyan-50 rounded-lg text-left text-xs font-bold text-cyan-700 transition-colors w-full"><UserPlus size={14} /> Assign</button>
                            <button disabled={isBreakdownActive && breakdownStatus !== 'resolved'} onClick={() => { onAction('closure', obs.id); setShowProcessMenu(false); }} className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-colors w-full ${isBreakdownActive && breakdownStatus !== 'resolved' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-green-50 text-green-700'}`}><CheckCheck size={14} /> Closure</button>
                        </div>
                    )
                )}
            </div>
            {!obs.isAuditSourced && <button title="Delete Record" onClick={() => onAction('delete', obs.id)} className={`${btnClass} bg-red-100 text-red-600 hover:bg-red-200 border border-red-200`}><Trash2 className={iconClass} /></button>}
        </div>
    );
};

// --- ObservationCard (desktop layout) ---

export const ObservationCard: React.FC<{
    obs: ObservationItem;
    onAction: (type: string, id: string) => void;
    onFilterThread?: (rootId: string) => void;
    onViewImage: (url: string, label: string) => void;
    onViewPdf?: (id: string) => void;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    mode?: CardMode;
}> = ({ obs, onAction, onFilterThread, onViewImage, isSelected, onToggleSelect, mode = 'admin' }) => {
    const isPublic = mode === 'public';
    const severityConfig = obs.severity === 'CRITICAL' ? { bg: 'bg-rose-500', text: 'text-white' } : obs.severity === 'MAJOR' ? { bg: 'bg-orange-500', text: 'text-white' } : { bg: 'bg-amber-400', text: 'text-amber-900' };
    const statusBg = obs.status === 'OPEN' ? 'bg-rose-50 text-rose-600 border-rose-100' : obs.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100';
    const followBg = obs.followUpStatus === 'COMPLIANCE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : obs.followUpStatus === 'N/A' ? 'bg-slate-50 text-slate-400 border-slate-100' : 'bg-rose-50 text-rose-500 border-rose-100';
    return (
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 group relative">
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl ${obs.status === 'OPEN' ? 'bg-gradient-to-b from-rose-500 to-rose-300' : obs.status === 'RESOLVED' ? 'bg-gradient-to-b from-emerald-500 to-emerald-300' : 'bg-gradient-to-b from-amber-500 to-amber-300'}`} />

            <div className="flex items-stretch w-full">

                {!isPublic && onToggleSelect && (
                    <div className="flex items-center pl-3 shrink-0">
                        <input type="checkbox" checked={!!isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </div>
                )}
                {/* Zone 1: Thumbnail */}
                <div className="relative shrink-0 flex items-center p-3 pl-3 gap-2">
                    {obs.thumbnail ? (
                        <div onClick={() => onViewImage(obs.thumbnail, 'Initial Evidence')} className="w-[180px] h-[180px] rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 relative group/img cursor-pointer hover:border-indigo-300 transition-all shrink-0">
                            <img src={obs.thumbnail} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Initial Evidence" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 flex items-end justify-center pb-1 transition-opacity">
                                <Maximize2 size={12} className="text-white drop-shadow-md" />
                            </div>
                            {obs.isAuditSourced && (
                                <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[6.5px] font-black text-center py-0.5 uppercase tracking-tight flex items-center justify-center gap-0.5">
                                    <ClipboardList size={7} /> Internal Audit
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-[180px] h-[180px] rounded-xl border border-slate-200/80 bg-slate-100 flex items-center justify-center shrink-0 relative overflow-hidden">
                            <Eye size={18} className="text-slate-300" />
                            {obs.isAuditSourced && (
                                <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[6.5px] font-black text-center py-0.5 uppercase tracking-tight flex items-center justify-center gap-0.5">
                                    <ClipboardList size={7} /> Internal Audit
                                </div>
                            )}
                        </div>
                    )}
                    {(obs.status === 'RESOLVED' || obs.status === 'PENDING_VERIFICATION') && obs.afterImage && (
                        <div onClick={() => onViewImage(obs.afterImage!, 'Closure Evidence')} className="w-[144px] h-[144px] rounded-xl overflow-hidden border border-emerald-200 bg-slate-50 relative group/img cursor-pointer hover:border-emerald-400 transition-all shrink-0">
                            <img src={obs.afterImage} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" alt="Closure Evidence" />
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 flex items-end justify-center pb-1 transition-opacity">
                                <Maximize2 size={12} className="text-white drop-shadow-md" />
                            </div>
                        </div>
                    )}
                    {!isPublic && (
                        <button onClick={() => onAction('toggle-star', obs.id)} className="absolute top-2 right-1 p-1 rounded-full hover:scale-110 transition-transform z-10">
                            <Star size={13} className={obs.isStarred ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-slate-300 hover:text-yellow-400"} />
                        </button>
                    )}
                </div>

                {/* Zone 2: Identity & Source */}
                <div className="flex-1 min-w-0 py-3.5 pr-3 flex flex-col justify-center text-left">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="bg-slate-800 text-slate-200 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider">{obs.id}</span>
                        <span className={`${severityConfig.bg} ${severityConfig.text} text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide`}>{obs.severity}</span>
                        <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{obs.level}</span>
                        {obs.breakdownDetails?.isActive && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[7px] font-black uppercase rounded-full flex items-center gap-0.5 border border-rose-200">
                                <Wrench size={7} /> BD
                            </span>
                        )}
                        {obs.isRepeat && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[7px] font-black uppercase rounded-full flex items-center gap-0.5 border border-orange-200">
                                <RotateCcw size={7} /> REPEAT
                            </span>
                        )}
                        {obs.parentObservationId && (
                            <button onClick={(e) => { e.stopPropagation(); onFilterThread?.(obs.parentObservationId!); }} className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[7px] font-black uppercase rounded-full flex items-center gap-0.5 border border-orange-200 hover:bg-orange-100 transition-colors">
                                <GitCommit size={7} /> {obs.parentObservationId.split('-').pop()}
                            </button>
                        )}
                        {(obs.departmentName || obs.mainKitchen) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-wide">
                                <Building size={8} /> {obs.departmentName || obs.mainKitchen}
                            </span>
                        )}
                    </div>
                    {obs.questionText && <p className="text-[9px] text-slate-400 font-semibold mb-0.5 truncate">Q: {obs.questionText}{obs.selectedAnswer ? <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] font-black uppercase border border-rose-200">Ans: {obs.selectedAnswer}</span> : null}</p>}
                    <h3 className="text-slate-800 text-[14px] font-extrabold tracking-tight leading-snug mb-1.5 truncate group-hover:text-indigo-600 transition-colors">{obs.observationText || obs.title}</h3>
                    <div className="flex items-center gap-2.5 text-[9.5px] text-slate-400 font-semibold mb-2">
                        <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <BookOpen size={9} className="text-indigo-400 shrink-0" />
                            {obs.isAuditSourced ? (
                                <span className="truncate">
                                    {obs.sectionTitle || obs.sop}
                                    {obs.checklistName && obs.sectionTitle && obs.checklistName !== obs.sectionTitle ? <span className="opacity-60 ml-0.5">({obs.checklistName})</span> : null}
                                </span>
                            ) : obs.sop}
                        </span>
                        <span className="text-slate-200">|</span>
                        <span className="flex items-center gap-1 truncate"><MapPin size={9} className="text-slate-400 shrink-0" /> {obs.people.length > 0 ? obs.people.map(p => p.name).join(', ') : obs.mainKitchen || obs.area}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {obs.people.slice(0, 2).map((p, i) => (
                            <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50/80 text-indigo-600 rounded-md text-[8px] font-bold uppercase">
                                <User size={7} /> {p.name}
                            </span>
                        ))}
                        {obs.people.length > 2 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-md text-[8px] font-bold">+{obs.people.length - 2}</span>}
                        {obs.assets.slice(0, 1).map((a, i) => (
                            <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50/80 text-orange-600 rounded-md text-[8px] font-bold uppercase">
                                <Package size={7} /> {a.name}
                            </span>
                        ))}
                        {obs.assets.length > 1 && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded-md text-[8px] font-bold">+{obs.assets.length - 1}</span>}
                    </div>
                    {!isPublic && (
                        <div className="flex items-center gap-1 mt-1">
                            {(['management-focus', 'easy-impactful', 'ongoing'] as const).map(tag => {
                                const cfg = tag === 'management-focus' ? { label: '🔴 Mgmt', active: 'bg-red-100 text-red-700 border-red-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' } : tag === 'easy-impactful' ? { label: '🟢 Easy', active: 'bg-emerald-100 text-emerald-700 border-emerald-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' } : { label: '🔵 Ongoing', active: 'bg-blue-100 text-blue-700 border-blue-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' };
                                const isActive = obs.managementTag === tag;
                                return <button key={tag} onClick={(e) => { e.stopPropagation(); onAction(`set-tag:${tag}`, obs.id); }} className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-all active:scale-95 ${isActive ? cfg.active : cfg.inactive}`}>{cfg.label}</button>;
                            })}
                        </div>
                    )}
                    {/* Public mode: show the active management tag as a passive badge so the
                        recipient sees mgmt prioritisation without being able to change it. */}
                    {isPublic && obs.managementTag && (
                        <div className="flex items-center gap-1 mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${obs.managementTag === 'management-focus' ? 'bg-red-100 text-red-700 border-red-300' : obs.managementTag === 'easy-impactful' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                                {obs.managementTag === 'management-focus' ? '🔴 Mgmt Focus' : obs.managementTag === 'easy-impactful' ? '🟢 Easy Impact' : '🔵 Ongoing'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Zone 3: Location & Closure (desktop only) */}
                <div className="hidden lg:flex flex-col justify-center gap-2 w-[170px] shrink-0 border-l border-slate-100 px-4">
                    <div>
                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Location</p>
                        <p className="text-[11.5px] font-extrabold text-slate-700 uppercase tracking-tight leading-none truncate">{obs.area}</p>
                        <p className="text-[9px] font-semibold text-slate-400 truncate mt-0.5">{obs.hierarchy || obs.unitName || ''}</p>
                    </div>
                    {obs.observationText && (
                        <div className="w-full bg-violet-50/60 border border-violet-100 rounded-lg px-2.5 py-1.5 mb-1">
                            <p className="text-[8.5px] text-violet-600 font-semibold leading-relaxed line-clamp-2">
                                <MessageSquare size={8} className="inline mr-1 text-violet-400" />{obs.observationText}
                            </p>
                        </div>
                    )}
                    <div className="w-full bg-slate-50/80 border border-slate-100 rounded-lg px-2.5 py-2 min-h-[28px]">
                        {obs.closureComments && (
                            <p className="text-[8.5px] text-slate-500 leading-relaxed line-clamp-3">
                                {obs.closureComments}
                            </p>
                        )}
                    </div>
                </div>

                {/* Zone 4: Status Indicators (desktop only) */}
                <div className="hidden lg:flex flex-col justify-center gap-2 w-[130px] shrink-0 border-l border-slate-100 px-4">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${statusBg} w-fit`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${obs.status === 'OPEN' ? 'bg-rose-500 animate-pulse' : obs.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider">{obs.status}</span>
                    </div>
                    <p className="text-[8.5px] font-medium text-slate-400 flex items-center gap-1"><Clock size={9} /> {obs.duration}</p>
                    <div className="h-px w-full bg-slate-100" />
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${followBg} w-fit`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${obs.followUpStatus === 'COMPLIANCE' ? 'bg-emerald-500' : obs.followUpStatus === 'N/A' ? 'bg-slate-300' : 'bg-rose-400'}`} />
                        <span className="text-[9px] font-black uppercase tracking-wider">{obs.followUpStatus}</span>
                    </div>
                    <p className="text-[8.5px] font-medium text-slate-400 flex items-center gap-1"><Repeat size={9} /> {obs.followUpCount}x · {obs.followUpDate}</p>
                </div>

                {/* Zone 5: Reporter & Actions */}
                <div className="flex flex-col justify-between shrink-0 border-l border-slate-100 py-3.5 px-4 gap-3 min-w-[150px]">
                    <div className="text-right">
                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">By</p>
                        <p className="text-[10px] text-slate-700 font-extrabold truncate max-w-[110px] leading-snug">{obs.reportedBy}</p>
                        <p className="text-[8.5px] text-indigo-500 font-semibold mt-0.5">{formatIST(obs.createdDate || obs.lastUpdate)}</p>
                    </div>
                    <ActionGrid obs={obs} onAction={onAction} mode={mode} />
                </div>

            </div>
        </div>
    );
};

// --- MobileObservationCard ---

export interface MobileObservationCardProps {
    obs: ObservationItem;
    onAction: (type: string, id: string) => void;
    onSelect: (id: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onViewImage: (url: string, label: string) => void;
    onViewPdf?: (id: string) => void;
    onFilterThread?: (rootId: string) => void;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    mode?: CardMode;
}

export const MobileObservationCard: React.FC<MobileObservationCardProps> = ({
    obs,
    onAction,
    onSelect,
    isExpanded,
    onToggleExpand,
    onViewImage,
    onFilterThread,
    isSelected,
    onToggleSelect,
    mode = 'admin',
}) => {
    const isPublic = mode === 'public';
    const cardRef = useRef<HTMLDivElement>(null);
    const isReopened = obs.tracking?.some(t => t.label.includes('Reopen')) || false;
    const createdDate = formatISTDate(obs.createdDate);
    const statusColor = obs.status === 'RESOLVED' ? 'emerald' : obs.status === 'OPEN' ? 'rose' : 'blue';
    const statusGradient = obs.status === 'RESOLVED' ? 'from-emerald-500 to-emerald-600' : obs.status === 'OPEN' ? 'from-rose-500 to-rose-600' : 'from-blue-500 to-blue-600';
    const severityIcon = obs.severity === 'CRITICAL' ? '🔴' : obs.severity === 'MAJOR' ? '🟠' : '🟡';

    // Lazy-load the WhatsApp confirm host so the public share-link bundle
    // doesn't pull in WhatsAppObservationHost / its localStorage helpers.
    // The share button only renders in admin mode anyway.
    const handleShare = async () => {
        const evidenceUrls: string[] = Array.isArray((obs as any).allEvidence)
            ? (obs as any).allEvidence.map((e: any) => (typeof e === 'string' ? e : e?.url)).filter(Boolean)
            : [];
        if (evidenceUrls.length === 0 && obs.thumbnail) evidenceUrls.push(obs.thumbnail);
        const mod = await import('./WhatsAppObservationHost');
        mod.requestWhatsAppObservationConfirm({
            observations: [{
                kind: 'new',
                id: obs.id,
                title: obs.title,
                questionText: (obs as any).questionText,
                observationText: (obs as any).observationText || obs.title,
                status: obs.status,
                severity: obs.severity,
                location: obs.area,
                mainKitchen: obs.mainKitchen,
                hierarchy: obs.hierarchy,
                sop: obs.sop,
                reportedBy: obs.reportedBy,
                createdDate: obs.createdDate,
                duration: obs.duration,
                followUpCount: obs.followUpCount || 0,
                responsibility: (obs as any).departmentName || '',
                images: evidenceUrls,
            }],
            unitName: obs.mainKitchen || '',
            auditorName: obs.reportedBy || 'Auditor',
        });
    };

    return (
        <div ref={cardRef} data-card-id={obs.id} className="bg-white rounded-[1.5rem] shadow-lg shadow-slate-200/60 border border-slate-100/80 relative w-full overflow-hidden text-left">
            <div className={`h-1.5 w-full bg-gradient-to-r ${statusGradient}`} />

            <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        {!isPublic && onToggleSelect && (
                            <input type="checkbox" checked={!!isSelected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0" />
                        )}
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${statusGradient} flex items-center justify-center shrink-0 shadow-md`}>
                            {obs.status === 'RESOLVED' ? <CheckCircle2 size={18} className="text-white" /> : obs.status === 'OPEN' ? <AlertCircle size={18} className="text-white" /> : <Clock size={18} className="text-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-wider text-${statusColor}-600`}>{obs.status === 'IN_PROGRESS' || obs.status === 'PENDING' || obs.status === 'PENDING_VERIFICATION' ? 'In Progress' : obs.status === 'RESOLVED' ? 'Resolved' : 'Open'}</span>
                                {isReopened && obs.status !== 'RESOLVED' && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600">Reopened</span>}
                                {obs.breakdownDetails?.isActive && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 text-white">Breakdown</span>}
                                {obs.isRepeat && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200 flex items-center gap-0.5"><RotateCcw size={7} /> Repeat</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{createdDate} · {obs.duration}</div>
                        </div>
                    </div>
                    {!isPublic && (
                        <div className="flex items-center gap-1 shrink-0 share-hide-on-capture">
                            <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 active:scale-90 active:bg-indigo-50 active:text-indigo-600 transition-all"><Share2 size={15} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onAction('toggle-star', obs.id); }} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 ${obs.isStarred ? 'bg-yellow-50' : 'bg-slate-50'}`}><Star size={15} className={obs.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} /></button>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 pb-2">
                {obs.questionText && <p className="text-[9px] text-slate-400 font-semibold mb-0.5 truncate">Q: {obs.questionText}{obs.selectedAnswer ? <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[8px] font-black uppercase border border-rose-200">Ans: {obs.selectedAnswer}</span> : null}</p>}
                <h3 onClick={() => onSelect(obs.id)} className="text-[15px] font-black text-slate-800 leading-snug line-clamp-2 uppercase tracking-tight cursor-pointer active:text-indigo-600 transition-colors">{obs.observationText || obs.title}</h3>
                {obs.parentObservationId && onFilterThread && (
                    <button onClick={(e) => { e.stopPropagation(); onFilterThread(obs.parentObservationId!); }} className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-50 text-orange-600 border border-orange-100 active:scale-95 transition-all">
                        <GitCommit size={10} /> Follow-up of {obs.parentObservationId.split('-').pop()}
                    </button>
                )}
                {obs.isRepeat && obs.repeatTrail && obs.repeatTrail.length > 0 && (
                    <div className="mt-1.5 bg-orange-50 rounded-lg border border-orange-100 p-2">
                        <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1"><RotateCcw size={8} /> Repeat Trail · Since {obs.repeatOriginalDate}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                            {obs.repeatTrail.map((t, ti) => (
                                <span key={ti} className="text-[8px] font-bold text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-md">{t.date}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-4 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-600">{severityIcon} {obs.severity}</span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-600"><Signal size={9} /> {obs.level}</span>
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-100 text-[9px] font-bold text-blue-600"><History size={9} /> {obs.followUpCount} F/U</span>
                    {(obs.departmentName || obs.mainKitchen) && <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-500"><Building size={9} /> {obs.departmentName || obs.mainKitchen}</span>}
                </div>
            </div>

            {!isPublic && (
                <div className="px-4 pb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {(['management-focus', 'easy-impactful', 'ongoing'] as const).map(tag => {
                            const cfg = tag === 'management-focus' ? { label: '🔴 Mgmt Focus', active: 'bg-red-100 text-red-700 border-red-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' } : tag === 'easy-impactful' ? { label: '🟢 Easy Impact', active: 'bg-emerald-100 text-emerald-700 border-emerald-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' } : { label: '🔵 Ongoing', active: 'bg-blue-100 text-blue-700 border-blue-300', inactive: 'bg-slate-50 text-slate-300 border-slate-100' };
                            const isActive = obs.managementTag === tag;
                            return <button key={tag} onClick={(e) => { e.stopPropagation(); onAction(`set-tag:${tag}`, obs.id); }} className={`px-2 py-1 rounded-full text-[9px] font-black border transition-all active:scale-95 ${isActive ? cfg.active : cfg.inactive}`}>{cfg.label}</button>;
                        })}
                    </div>
                </div>
            )}
            {isPublic && obs.managementTag && (
                <div className="px-4 pb-2">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-black border ${obs.managementTag === 'management-focus' ? 'bg-red-100 text-red-700 border-red-300' : obs.managementTag === 'easy-impactful' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                        {obs.managementTag === 'management-focus' ? '🔴 Mgmt Focus' : obs.managementTag === 'easy-impactful' ? '🟢 Easy Impact' : '🔵 Ongoing'}
                    </span>
                </div>
            )}

            <div className="px-4 pb-2">
                <div className="flex gap-2 items-start">
                    {obs.thumbnail ? (
                        <div onClick={() => onViewImage(obs.thumbnail, 'Initial Evidence')} className="relative w-40 h-40 rounded-xl overflow-hidden bg-slate-100 cursor-pointer active:scale-[0.96] transition-transform shrink-0 border border-slate-200/80">
                            <img src={obs.thumbnail} className="w-full h-full object-cover" alt="Before" />
                            <div className="absolute bottom-0 left-0 right-0 text-center" style={{ background: obs.isAuditSourced ? 'rgba(79,70,229,0.88)' : 'rgba(0,0,0,0.5)' }}>
                                <span className="text-[7px] font-black uppercase text-white">{obs.isAuditSourced ? 'Audit' : 'Before'}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-40 h-40 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80 flex items-center justify-center">
                            <Camera size={16} className="text-slate-300" />
                        </div>
                    )}
                    {obs.afterImage && (
                        <div onClick={() => onViewImage(obs.afterImage!, 'Closure Evidence')} className="relative w-32 h-32 rounded-xl overflow-hidden bg-slate-100 cursor-pointer active:scale-[0.96] transition-transform shrink-0 border border-emerald-200/80">
                            <img src={obs.afterImage} className="w-full h-full object-cover" alt="After" />
                            <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/60 text-center">
                                <span className="text-[7px] font-black uppercase text-white">After</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 pb-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 rounded-xl text-left">
                    <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0"><FileText size={13} className="text-indigo-500" /></div>
                    <span className="text-[10px] font-bold text-slate-600 truncate flex-1">
                        {obs.isAuditSourced ? (
                            <>
                                {obs.sectionTitle || obs.sop}
                                {obs.checklistName && obs.sectionTitle && obs.checklistName !== obs.sectionTitle ? <span className="text-slate-400 ml-0.5">({obs.checklistName})</span> : null}
                            </>
                        ) : obs.sop}
                    </span>
                </div>
            </div>

            <div className="px-4 py-2">
                <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50/80 rounded-xl active:bg-slate-100 transition-colors select-none" onClick={onToggleExpand}>
                    <div className="flex items-center gap-2.5 overflow-hidden text-left">
                        <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0"><MapPin size={13} className="text-rose-500" /></div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-700 truncate">{obs.area}</div>
                            <div className="text-[9px] text-slate-400 font-medium truncate">{obs.people.length > 0 ? obs.people.map(p => p.name).join(', ') : obs.mainKitchen || ''}</div>
                        </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 transition-transform duration-300 share-hide-on-capture ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={13} className="text-slate-400" /></div>
                </button>

                <div className={`${isExpanded ? 'block' : 'hidden'} mt-2 space-y-2 animate-in slide-in-from-top-2 duration-300 text-left share-expandable-content`}>
                    {(obs.people.length > 0 || obs.assets.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 px-1">
                            {obs.people.map((p, i) => (<span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-bold text-blue-700"><Users size={9} /> {p.name}</span>))}
                            {obs.assets.map((a, i) => (<span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 border border-orange-100 rounded-full text-[9px] font-bold text-orange-700"><Wrench size={9} /> {a.name}</span>))}
                        </div>
                    )}
                    <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reported By</span>
                            <span className="text-[10px] font-bold text-slate-700">{obs.reportedBy}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Last Update</span>
                            <span className="text-[10px] font-bold text-slate-700">{formatIST(obs.createdDate || obs.lastUpdate)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ID</span>
                            <span className="text-[10px] font-mono font-bold text-indigo-600">{obs.id}</span>
                        </div>
                        {isPublic && obs.closureComments && (
                            <div className="mt-2 pt-2 border-t border-slate-100">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Closure Comments</p>
                                <p className="text-[10px] text-slate-600 leading-relaxed">{obs.closureComments}</p>
                            </div>
                        )}
                    </div>
                    {!isPublic && (
                        <button onClick={() => onAction('view-log', obs.id)} className="w-full py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 font-bold flex items-center justify-center gap-1.5 text-[10px] active:scale-[0.98] transition-all share-hide-on-capture"><History size={12} /> View Full Activity Log</button>
                    )}
                </div>
            </div>

            <div className="px-4 pb-4 pt-1 share-hide-on-capture">
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100/80">
                    <ActionGrid obs={obs} onAction={onAction} isMobile={true} mode={mode} />
                </div>
            </div>
        </div>
    );
};
