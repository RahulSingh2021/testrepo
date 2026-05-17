"use client";

import React, { useState, useMemo } from 'react';
import { 
  Wrench, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Settings,
  Activity,
  History,
  Info,
  MapPin,
  Tag,
  Building,
  ArrowRight,
  ShieldCheck,
  Package,
  Calendar,
  LayoutGrid,
  PenTool,
  Save,
  Download,
  DollarSign,
  ShieldAlert,
  Hash,
  User,
  TrendingUp,
  TrendingDown,
  Zap,
  Timer,
  Eye,
  EyeOff,
  Layers,
  BarChart3,
  AlertCircle,
  ExternalLink,
  X,
  FileText,
  Camera,
  Star,
  MessageSquare
} from 'lucide-react';
import { Entity, HierarchyScope } from '../types';
import type { Equipment } from './FacilityManagement';

interface BreakdownEvent {
    id: string;
    date: string;
    action: string;
    technician: string;
    notes: string;
    cost: number;
    status: 'Reported' | 'In Progress' | 'Resolved' | 'Pending Parts';
    resolutionDate?: string;
    downtimeHours?: number;
}

interface EquipmentBreakdownData {
    equipmentId: string;
    breakdowns: BreakdownEvent[];
}

interface ObservationData {
    id: string;
    title: string;
    sop: string;
    severity: string;
    level: string;
    mainKitchen: string;
    area: string;
    hierarchy: string;
    status: string;
    duration: string;
    followUpStatus: string;
    followUpCount: number;
    followUpDate: string;
    reportedBy: string;
    lastUpdate: string;
    createdDate: string;
    closureDate?: string;
    thumbnail: string;
    afterImage?: string;
    isStarred: boolean;
    closureComments: string | null;
    tracking: { id: string; label: string; user: string; timestamp: string; comments: string }[];
    breakdownDetails?: {
        isActive: boolean;
        status: string;
        equipment?: string;
        rootCause?: string;
        totalCost: number;
        history: { date: string; user: string; action: string; comments: string; cost?: number }[];
    };
}


const SummaryCard = ({ label, value, color, icon: Icon, subtext }: any) => (
    <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 flex-1 min-w-[200px]">
        <div className={`p-3.5 ${color} text-white rounded-xl shadow-lg`}>
            <Icon size={20} />
        </div>
        <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
            <p className="text-xl font-black text-slate-900 tracking-tighter">{value}</p>
            {subtext && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{subtext}</p>}
        </div>
    </div>
);

const ObservationDetailModal: React.FC<{ obs: ObservationData; onClose: () => void }> = ({ obs, onClose }) => {
    const getSeverityStyle = (sev: string) => {
        switch (sev) {
            case 'CRITICAL': return 'bg-rose-600 text-white';
            case 'MAJOR': return 'bg-amber-500 text-white';
            case 'MINOR': return 'bg-sky-500 text-white';
            default: return 'bg-slate-500 text-white';
        }
    };
    const getObsStatusStyle = (status: string) => {
        switch (status) {
            case 'RESOLVED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'OPEN': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'PENDING': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'PENDING_VERIFICATION': return 'bg-purple-50 text-purple-700 border-purple-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6 flex justify-between items-start shrink-0">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="p-3 bg-white/10 rounded-xl shrink-0">
                            <FileText size={24} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase ${getSeverityStyle(obs.severity)}`}>{obs.severity}</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase border ${getObsStatusStyle(obs.status)}`}>{obs.status.replace('_', ' ')}</span>
                                <span className="text-[9px] font-bold text-white/50">#{obs.id}</span>
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight">{obs.title}</h3>
                            <p className="text-[10px] font-bold text-white/40 mt-1.5 uppercase tracking-widest">{obs.sop}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/70 hover:text-white shrink-0 ml-2">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Area</span>
                            <span className="text-xs font-bold text-slate-700">{obs.area}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Department</span>
                            <span className="text-xs font-bold text-slate-700">{obs.mainKitchen}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reported By</span>
                            <span className="text-xs font-bold text-slate-700">{obs.reportedBy}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Created</span>
                            <span className="text-xs font-bold text-slate-700">{obs.createdDate}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Duration</span>
                            <span className="text-xs font-bold text-slate-700">{obs.duration}</span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Follow-Up</span>
                            <span className="text-xs font-bold text-slate-700">{obs.followUpStatus} ({obs.followUpCount})</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hierarchy</span>
                        <span className="text-xs font-medium text-slate-600">{obs.hierarchy}</span>
                    </div>

                    {obs.thumbnail && (
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Evidence</span>
                            <div className="flex gap-3">
                                <div className="relative group">
                                    <img src={obs.thumbnail} alt="Before" className="w-28 h-20 object-cover rounded-xl border-2 border-slate-200" />
                                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[7px] font-black uppercase rounded">Before</span>
                                </div>
                                {obs.afterImage && (
                                    <div className="relative group">
                                        <img src={obs.afterImage} alt="After" className="w-28 h-20 object-cover rounded-xl border-2 border-emerald-200" />
                                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-emerald-600/80 text-white text-[7px] font-black uppercase rounded">After</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {obs.breakdownDetails && (
                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                            <div className="flex items-center gap-2 mb-3">
                                <Wrench size={14} className="text-rose-600" />
                                <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Breakdown Details</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[8px] font-black text-rose-400 uppercase block">Equipment</span>
                                    <span className="text-xs font-bold text-rose-800">{obs.breakdownDetails.equipment || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-[8px] font-black text-rose-400 uppercase block">Status</span>
                                    <span className="text-xs font-bold text-rose-800 capitalize">{obs.breakdownDetails.status}</span>
                                </div>
                                {obs.breakdownDetails.rootCause && (
                                    <div className="col-span-2">
                                        <span className="text-[8px] font-black text-rose-400 uppercase block">Root Cause</span>
                                        <span className="text-xs font-medium text-rose-700">{obs.breakdownDetails.rootCause}</span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-[8px] font-black text-rose-400 uppercase block">Total Cost</span>
                                    <span className="text-xs font-bold text-rose-800">₹{obs.breakdownDetails.totalCost.toLocaleString()}</span>
                                </div>
                            </div>
                            {obs.breakdownDetails.history.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-rose-200 space-y-2">
                                    <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Service Timeline</span>
                                    {obs.breakdownDetails.history.map((h, i) => (
                                        <div key={i} className="bg-white/80 p-3 rounded-lg border border-rose-100 text-xs">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-black text-slate-700">{h.action}</span>
                                                <span className="text-[10px] text-slate-400">{h.date}</span>
                                            </div>
                                            <p className="text-slate-500 text-[11px]">{h.comments}</p>
                                            <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400">
                                                <span>By: {h.user}</span>
                                                {h.cost !== undefined && <span>Cost: ₹{h.cost}</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {obs.closureComments && (
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Closure Notes</span>
                            </div>
                            <p className="text-xs text-emerald-700">{obs.closureComments}</p>
                            {obs.closureDate && <p className="text-[10px] text-emerald-500 mt-1">Closed: {obs.closureDate}</p>}
                        </div>
                    )}

                    {obs.tracking.length > 0 && (
                        <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Activity Log</span>
                            <div className="space-y-2">
                                {obs.tracking.map((t) => (
                                    <div key={t.id} className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-black text-slate-700">{t.label}</span>
                                                <span className="text-[9px] text-slate-400 shrink-0">{t.timestamp}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{t.comments}</p>
                                            <span className="text-[9px] text-slate-400 font-medium">By: {t.user}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        {obs.isStarred && <Star size={14} className="text-amber-500 fill-amber-400" />}
                        <span className="text-[9px] font-bold text-slate-400">Last Update: {obs.lastUpdate}</span>
                    </div>
                    <button onClick={onClose} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};


const BreakdownHistory: React.FC<{ entities: Entity[], currentScope: HierarchyScope, userRootId?: string | null }> = ({ entities, currentScope, userRootId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedObservation, setSelectedObservation] = useState<ObservationData | null>(null);
    const [expandedTrailing, setExpandedTrailing] = useState<Set<string>>(new Set());

    const equipmentWithBreakdowns = useMemo(() => {
        // TODO: Load equipment breakdowns from API instead of hardcoded data
        return [];
    }, []);

    const filteredEquipment = useMemo(() => {
        let data = equipmentWithBreakdowns;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            data = data.filter(eq =>
                eq.name.toLowerCase().includes(term) ||
                eq.idNumber.toLowerCase().includes(term) ||
                eq.location.toLowerCase().includes(term) ||
                eq.department.toLowerCase().includes(term)
            );
        }
        if (statusFilter === 'active') {
            data = data.filter(eq => eq.hasActiveBreakdown);
        } else if (statusFilter === 'clear') {
            data = data.filter(eq => !eq.hasActiveBreakdown);
        } else if (statusFilter === 'has-history') {
            data = data.filter(eq => eq.breakdownCount > 0);
        }
        return data;
    }, [equipmentWithBreakdowns, searchTerm, statusFilter]);

    const globalStats = useMemo(() => {
        const allBreakdowns = equipmentWithBreakdowns.flatMap(eq => eq.breakdowns);
        const totalCost = allBreakdowns.reduce((sum, b) => sum + b.cost, 0);
        const activeCount = allBreakdowns.filter(b => b.status !== 'Resolved').length;
        const resolved = allBreakdowns.filter(b => b.downtimeHours);
        const avgDowntime = resolved.length > 0
            ? (resolved.reduce((sum, b) => sum + (b.downtimeHours || 0), 0) / resolved.length).toFixed(1)
            : '0';
        const equipWithBreakdowns = equipmentWithBreakdowns.filter(eq => eq.breakdownCount > 0).length;
        const reliability = equipmentWithBreakdowns.length > 0
            ? Math.round(((equipmentWithBreakdowns.length - equipmentWithBreakdowns.filter(eq => eq.hasActiveBreakdown).length) / equipmentWithBreakdowns.length) * 100)
            : 100;
        return {
            totalBreakdowns: allBreakdowns.length,
            activeCount,
            totalCost,
            avgDowntime,
            equipWithBreakdowns,
            totalEquipment: equipmentWithBreakdowns.length,
            reliability,
        };
    }, [equipmentWithBreakdowns]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedIds(next);
    };

    const toggleTrailing = (bdId: string) => {
        const next = new Set(expandedTrailing);
        if (next.has(bdId)) next.delete(bdId); else next.add(bdId);
        setExpandedTrailing(next);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Pending Parts': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Reported': return 'bg-rose-50 text-rose-700 border-rose-200';
            default: return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case 'Resolved': return 'bg-emerald-500';
            case 'In Progress': return 'bg-blue-500 animate-pulse';
            case 'Pending Parts': return 'bg-amber-500 animate-pulse';
            case 'Reported': return 'bg-rose-500 animate-ping';
            default: return 'bg-slate-400';
        }
    };

    const getObsSeverityColor = (sev: string) => {
        switch (sev) {
            case 'CRITICAL': return 'bg-rose-500';
            case 'MAJOR': return 'bg-amber-500';
            case 'MINOR': return 'bg-sky-500';
            default: return 'bg-slate-400';
        }
    };

    const getObsStatusColor = (status: string) => {
        switch (status) {
            case 'RESOLVED': return 'bg-emerald-500';
            case 'OPEN': return 'bg-rose-500';
            case 'IN_PROGRESS': return 'bg-blue-500';
            case 'PENDING': return 'bg-amber-500';
            case 'PENDING_VERIFICATION': return 'bg-purple-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-20">
            <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-lg flex flex-col md:flex-row items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-600" />
                <div className="flex items-center gap-5 pl-4">
                    <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl shadow-inner border border-rose-100">
                        <Wrench size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Equipment Breakdown Registry</h2>
                        <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-[0.2em] flex items-center gap-2">
                           <ShieldAlert size={11} className="text-rose-500" /> Asset Maintenance & Downtime Tracker
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <div className="relative group flex-1 md:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-rose-500 transition-colors" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search equipment..." 
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-400 focus:bg-white transition-all uppercase tracking-wider"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-3 bg-white border-2 border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-600 focus:outline-none focus:border-rose-400 cursor-pointer"
                    >
                        <option value="all">All Equipment</option>
                        <option value="active">Active Issues</option>
                        <option value="clear">No Issues</option>
                        <option value="has-history">Has History</option>
                    </select>
                    <button className="px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <SummaryCard label="Total Breakdowns" value={globalStats.totalBreakdowns} color="bg-rose-500" icon={AlertTriangle} subtext={`Across ${globalStats.equipWithBreakdowns} equipment`} />
                <SummaryCard label="Active Issues" value={globalStats.activeCount} color="bg-amber-500" icon={AlertCircle} subtext={globalStats.activeCount === 0 ? 'All clear' : 'Needs attention'} />
                <SummaryCard label="Total Expense" value={`₹${globalStats.totalCost.toLocaleString()}`} color="bg-indigo-600" icon={DollarSign} subtext="Cumulative repair cost" />
                <SummaryCard label="Avg. Downtime" value={`${globalStats.avgDowntime}h`} color="bg-slate-700" icon={Clock} subtext="Mean time to repair" />
            </div>

            <div className="flex flex-col gap-4">
                {filteredEquipment.map(eq => {
                    const isExpanded = expandedIds.has(eq.id);
                    const hasBreakdowns = eq.breakdownCount > 0;

                    return (
                        <div key={eq.id} className={`bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isExpanded ? 'border-rose-400 shadow-xl' : 'border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md'}`}>
                            <div className="relative">
                                <div className={`absolute top-0 left-0 w-1 h-full ${eq.hasActiveBreakdown ? 'bg-rose-500 animate-pulse' : hasBreakdowns ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                
                                <div className="p-4 lg:p-5 pl-5 lg:pl-6">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                        <div className="flex items-center gap-4 lg:w-[30%] min-w-0">
                                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${eq.hasActiveBreakdown ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                                                <Package size={20} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight truncate">{eq.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Hash size={9} className="text-rose-400" />{eq.idNumber}
                                                    </span>
                                                    <span className="text-slate-200">|</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                        <MapPin size={9} className="text-indigo-400" />{eq.location}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 lg:gap-4 flex-wrap flex-1">
                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[90px]">
                                                <AlertTriangle size={13} className="text-rose-500" />
                                                <div>
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Breakdowns</div>
                                                    <div className="text-sm font-black text-slate-800">{eq.breakdownCount}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[100px]">
                                                <DollarSign size={13} className="text-indigo-500" />
                                                <div>
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Expenses</div>
                                                    <div className="text-sm font-black text-slate-800">₹{eq.totalCost.toLocaleString()}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[90px]">
                                                <Clock size={13} className="text-amber-500" />
                                                <div>
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Avg. Downtime</div>
                                                    <div className="text-sm font-black text-slate-800">{eq.avgDowntime > 0 ? `${eq.avgDowntime.toFixed(0)}h` : '—'}</div>
                                                </div>
                                            </div>
                                            {eq.daysSinceLast !== null && (
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 min-w-[90px]">
                                                    <Calendar size={13} className="text-emerald-500" />
                                                    <div>
                                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none">Days Since</div>
                                                        <div className="text-sm font-black text-slate-800">{eq.daysSinceLast}d</div>
                                                    </div>
                                                </div>
                                            )}
                                            {eq.hasActiveBreakdown && (
                                                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />Active Issue
                                                </span>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => toggleExpand(eq.id)}
                                            disabled={!hasBreakdowns}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shrink-0 ${
                                                !hasBreakdowns 
                                                    ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' 
                                                    : isExpanded 
                                                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' 
                                                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                                            }`}
                                        >
                                            {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                                            {!hasBreakdowns ? 'No History' : isExpanded ? 'Hide' : `Show (${eq.breakdownCount})`}
                                            {hasBreakdowns && (isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {isExpanded && hasBreakdowns && (
                                <div className="border-t border-slate-100 bg-slate-50/50">
                                    <div className="px-5 lg:px-6 pt-4 pb-2">
                                        <div className="flex items-center justify-between gap-2 mb-4">
                                            <div className="flex items-center gap-2">
                                                <History size={14} className="text-indigo-600" />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Breakdown Timeline — {eq.name}</span>
                                            </div>
                                            {eq.linkedObservations.length > 0 && (
                                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full text-[8px] font-black uppercase tracking-wider">
                                                    {eq.linkedObservations.length} Linked Observation{eq.linkedObservations.length !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-5 lg:px-6 pb-5 space-y-3">
                                        {eq.breakdowns.map((bd, idx) => {
                                            const isTrailingOpen = expandedTrailing.has(bd.id);
                                            const trailingObs = eq.linkedObservations.filter(obs => {
                                                const obsDate = new Date(obs.createdDate).getTime();
                                                const bdDate = new Date(bd.date).getTime();
                                                return Math.abs(obsDate - bdDate) <= 30 * 24 * 60 * 60 * 1000;
                                            });

                                            return (
                                                <div key={bd.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-black ${
                                                                bd.status === 'Resolved' ? 'bg-emerald-500' : bd.status === 'In Progress' ? 'bg-blue-500' : bd.status === 'Pending Parts' ? 'bg-amber-500' : 'bg-rose-500'
                                                            }`}>
                                                                {bd.status === 'Resolved' ? <CheckCircle2 size={14} /> : bd.status === 'In Progress' ? <Settings size={14} className="animate-spin" /> : bd.status === 'Pending Parts' ? <Package size={14} /> : <AlertTriangle size={14} />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{bd.action}</span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${getStatusStyle(bd.status)} flex items-center gap-1`}>
                                                                        <span className={`w-1 h-1 rounded-full ${getStatusDot(bd.status)}`} />
                                                                        {bd.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{bd.notes}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0">
                                                            <div className="flex flex-col items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 min-w-[60px]">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase">Date</span>
                                                                <span className="text-[10px] font-bold text-slate-700">{bd.date}</span>
                                                            </div>
                                                            {bd.downtimeHours && (
                                                                <div className="flex flex-col items-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100 min-w-[50px]">
                                                                    <span className="text-[7px] font-black text-amber-500 uppercase">Down</span>
                                                                    <span className="text-[10px] font-bold text-amber-700">{bd.downtimeHours}h</span>
                                                                </div>
                                                            )}
                                                            {bd.cost > 0 && (
                                                                <div className="flex flex-col items-center bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 min-w-[60px]">
                                                                    <span className="text-[7px] font-black text-indigo-500 uppercase">Cost</span>
                                                                    <span className="text-[10px] font-bold text-indigo-700">₹{bd.cost.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col items-center bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 min-w-[60px]">
                                                                <span className="text-[7px] font-black text-slate-400 uppercase">Tech</span>
                                                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">{bd.technician}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {bd.resolutionDate && (
                                                        <div className="px-4 py-2 bg-emerald-50/50 border-t border-slate-100 flex items-center gap-2">
                                                            <CheckCircle2 size={11} className="text-emerald-500" />
                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Resolved on {bd.resolutionDate}</span>
                                                        </div>
                                                    )}

                                                    {trailingObs.length > 0 && (
                                                        <div className="border-t border-slate-100">
                                                            <button
                                                                onClick={() => toggleTrailing(bd.id)}
                                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50/50 hover:bg-indigo-50 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <FileText size={12} className="text-indigo-500" />
                                                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                                                                        Observation Trail ({trailingObs.length})
                                                                    </span>
                                                                </div>
                                                                {isTrailingOpen ? <ChevronUp size={14} className="text-indigo-400" /> : <ChevronDown size={14} className="text-indigo-400" />}
                                                            </button>

                                                            {isTrailingOpen && (
                                                                <div className="px-4 pb-3 pt-1 space-y-2 bg-indigo-50/30">
                                                                    {trailingObs.map(obs => (
                                                                        <button
                                                                            key={obs.id}
                                                                            onClick={() => setSelectedObservation(obs)}
                                                                            className="w-full text-left bg-white p-3 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group cursor-pointer"
                                                                        >
                                                                            <div className="flex items-start gap-3">
                                                                                <div className={`w-2 h-full min-h-[40px] rounded-full flex-shrink-0 ${getObsStatusColor(obs.status)}`} />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                        <span className={`w-1.5 h-1.5 rounded-full ${getObsSeverityColor(obs.severity)}`} />
                                                                                        <span className="text-[11px] font-black text-slate-700 truncate flex-1">{obs.title}</span>
                                                                                        <ExternalLink size={12} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                                        <span className="text-[8px] font-black text-slate-400 uppercase">#{obs.id}</span>
                                                                                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                                                                                            obs.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : 
                                                                                            obs.status === 'OPEN' ? 'bg-rose-50 text-rose-600' : 
                                                                                            'bg-amber-50 text-amber-600'
                                                                                        }`}>{obs.status.replace('_', ' ')}</span>
                                                                                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                                                                                            obs.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : 
                                                                                            obs.severity === 'MAJOR' ? 'bg-amber-50 text-amber-600' : 
                                                                                            'bg-sky-50 text-sky-600'
                                                                                        }`}>{obs.severity}</span>
                                                                                        <span className="text-[8px] text-slate-400">{obs.createdDate}</span>
                                                                                        <span className="text-[8px] text-slate-400">{obs.sop}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="px-5 lg:px-6 pb-4">
                                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 size={14} className="text-slate-400" />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Equipment Summary</span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                                                    <span className="text-[9px] font-bold text-rose-300 uppercase">Incidents</span>
                                                    <span className="text-sm font-black text-white">{eq.breakdownCount}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                                                    <span className="text-[9px] font-bold text-indigo-300 uppercase">Total Cost</span>
                                                    <span className="text-sm font-black text-white">₹{eq.totalCost.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                                                    <span className="text-[9px] font-bold text-amber-300 uppercase">Avg Down</span>
                                                    <span className="text-sm font-black text-white">{eq.avgDowntime.toFixed(0)}h</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                                                    <span className="text-[9px] font-bold text-emerald-300 uppercase">Make</span>
                                                    <span className="text-sm font-black text-white">{eq.make}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredEquipment.length === 0 && (
                    <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                         <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5">
                            <Package size={36} className="text-slate-200" />
                         </div>
                         <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight">No Equipment Found</h3>
                         <p className="text-slate-400 text-xs mt-2 font-medium max-w-xs mx-auto">Adjust your search or filter criteria to view equipment breakdown history.</p>
                    </div>
                )}
            </div>

            {selectedObservation && (
                <ObservationDetailModal obs={selectedObservation} onClose={() => setSelectedObservation(null)} />
            )}
        </div>
    );
};

export default BreakdownHistory;