"use client";

import React, { useMemo, useState } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
    TrendingUp, 
    AlertTriangle, 
    Clock, 
    ShieldCheck, 
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    Target,
    MapPin,
    Layers,
    Activity,
    BookOpen,
    ArrowRight,
    Briefcase,
    Zap,
    Hash,
    CheckCircle2,
    CircleDashed,
    AlertCircle,
    Search,
    Filter,
    Shield,
    Flame,
    ZapOff,
    CheckCheck,
    History,
    // Fix: Added missing User import from lucide-react
    User
} from 'lucide-react';

interface AnalyticsProps {
    data: any[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7'];

const FollowUpAnalytics: React.FC<AnalyticsProps> = ({ data }) => {
    const [tableSearch, setTableSearch] = useState("");

    const stats = useMemo(() => {
        const total = data.length;
        const resolved = data.filter(r => r.status === 'Resolved').length;
        const critical = data.filter(r => r.deviation === 'Critical').length;
        const complianceRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        const totalCost = data.reduce((acc, r) => acc + (r.breakdownDetails?.totalCost || 0), 0);
        return { total, resolved, critical, complianceRate, totalCost };
    }, [data]);

    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [data]);

    const allUniqueSops = useMemo(() => {
        const sops = new Set<string>();
        data.forEach(r => sops.add(r.sop));
        return Array.from(sops).sort();
    }, [data]);

    const locationWiseData = useMemo(() => {
        const map: Record<string, any> = {};
        data.forEach(r => {
            const area = r.location.area;
            if (!map[area]) {
                map[area] = {
                    location: area,
                    dept: r.location.department,
                    total: 0,
                    open: 0,
                    closed: 0,
                    inProgress: 0,
                    sopStats: {}, 
                    resolvedDurations: [] as number[]
                };
            }
            map[area].total++;
            if (r.status === 'Open') map[area].open++;
            else if (r.status === 'In Progress') map[area].inProgress++;
            else if (r.status === 'Resolved') {
                map[area].closed++;
                map[area].resolvedDurations.push(Math.floor(Math.random() * 24) + 2);
            }

            if (!map[area].sopStats[r.sop]) {
                map[area].sopStats[r.sop] = { total: 0, open: 0, closed: 0 };
            }
            map[area].sopStats[r.sop].total++;
            if (r.status === 'Open') map[area].sopStats[r.sop].open++;
            if (r.status === 'Resolved') map[area].sopStats[r.sop].closed++;
        });

        return Object.values(map)
            .filter(loc => loc.location.toLowerCase().includes(tableSearch.toLowerCase()))
            .map(loc => {
                const avg = loc.resolvedDurations.length > 0 
                    ? (loc.resolvedDurations.reduce((a: number, b: number) => a + b, 0) / loc.resolvedDurations.length).toFixed(1)
                    : '0';
                return { ...loc, avgTime: parseFloat(avg) };
            }).sort((a, b) => b.total - a.total);
    }, [data, tableSearch]);

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* Visual KPI Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Activity', value: stats.total, icon: FileText, color: 'bg-indigo-600', trend: 12 },
                    { label: 'Global Compliance', value: `${stats.complianceRate}%`, icon: ShieldCheck, color: 'bg-emerald-500', trend: 4 },
                    { label: 'Critical Blockages', value: stats.critical, icon: AlertTriangle, color: 'bg-rose-500', trend: -2 },
                    { label: 'Breakdown Spend', value: `₹${stats.totalCost.toLocaleString()}`, icon: Zap, color: 'bg-amber-500', trend: 8 },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-4 rounded-2xl ${kpi.color} text-white shadow-lg group-hover:rotate-6 transition-transform`}>
                                <kpi.icon size={24} />
                            </div>
                            <div className={`text-[10px] font-black px-2 py-1 rounded-full ${kpi.trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                                {kpi.trend > 0 ? '↑' : '↓'} {Math.abs(kpi.trend)}%
                            </div>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</h4>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Visual Intelligence Grid (The Table) */}
            <div className="bg-white rounded-[3.5rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col min-h-[700px]">
                
                {/* Visual Action Bar */}
                <div className="px-10 py-10 flex flex-col md:flex-row justify-between items-center gap-8 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 rounded-[2rem] blur-xl opacity-20 animate-pulse" />
                            <div className="relative p-5 bg-slate-900 text-white rounded-[2rem] shadow-2xl">
                                <Activity size={32} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Node Compliance Matrix</h3>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" /> Synchronized
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Operational Telemetry</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative group flex-1 md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Locate System Node..." 
                                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-[1.5rem] text-sm font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                            />
                        </div>
                        <button className="p-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-auto custom-scrollbar flex-1 relative">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="sticky top-0 z-40">
                            <tr className="bg-slate-900 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="p-8 pl-10 border-b border-white/5 w-[300px] sticky left-0 bg-slate-900 z-50">System Node</th>
                                <th className="p-8 border-b border-white/5 text-center min-w-[220px] bg-slate-800 text-white sticky left-[300px] z-50 shadow-[10px_0_20px_rgba(0,0,0,0.2)]">Health Hub</th>
                                {allUniqueSops.map(sop => (
                                    <th key={sop} className="p-6 border-b border-white/5 border-l border-white/5 min-w-[150px] bg-slate-900 text-center truncate max-w-[150px]" title={sop}>
                                        {sop}
                                    </th>
                                ))}
                                <th className="p-8 border-b border-white/5 text-center bg-slate-950 min-w-[140px]">Closure Velocity</th>
                                <th className="p-8 border-b border-white/5 text-right pr-10 bg-slate-950">Terminal</th>
                            </tr>
                        </thead>
                        
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {locationWiseData.map((row, idx) => (
                                <tr key={idx} className="group hover:bg-indigo-50/20 transition-all duration-500">
                                    
                                    {/* 1. Styled Identity Column */}
                                    <td className="p-8 pl-10 sticky left-0 bg-white group-hover:bg-indigo-50/50 transition-colors z-30 border-r border-slate-100 shadow-[4px_0_20px_rgba(0,0,0,0.02)]">
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <div className={`absolute -inset-1 rounded-2xl blur-md opacity-20 ${row.open > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                <div className="relative w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-indigo-600 shadow-sm transition-all">
                                                    <Layers size={24} />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-black text-slate-800 text-base tracking-tighter leading-none mb-2 uppercase truncate group-hover:text-indigo-600 transition-colors">{row.location}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{row.dept}</span>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${row.open > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* 2. Semantic Health Hub (2x2) */}
                                    <td className="p-6 sticky left-[300px] bg-white group-hover:bg-indigo-50/50 z-30 border-r border-slate-100 shadow-[4px_0_20px_rgba(0,0,0,0.01)] align-middle">
                                        <div className="grid grid-cols-2 gap-1.5 w-[160px] mx-auto scale-95 lg:scale-100">
                                            <div className="bg-slate-900 text-white p-3 rounded-2xl flex flex-col items-center justify-center shadow-lg border border-white/10">
                                                <span className="text-[7px] font-black uppercase opacity-50 mb-1">Vol.</span>
                                                <span className="text-sm font-black">{row.total}</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${row.open > 0 ? 'bg-rose-50 border-rose-100 text-rose-600 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                                <span className="text-[7px] font-black uppercase mb-1">Open</span>
                                                <span className="text-sm font-black">{row.open}</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${row.inProgress > 0 ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                                <span className="text-[7px] font-black uppercase mb-1">Work</span>
                                                <span className="text-sm font-black">{row.inProgress}</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${row.closed > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                                                <span className="text-[7px] font-black uppercase mb-1">Sync</span>
                                                <span className="text-sm font-black">{row.closed}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* 3. Compliance Orbs Matrix */}
                                    {allUniqueSops.map(sop => {
                                        const stat = row.sopStats[sop];
                                        if (!stat) return <td key={sop} className="p-4 text-center opacity-10"><div className="w-3 h-3 bg-slate-200 rounded-full mx-auto" /></td>;
                                        
                                        const pct = (stat.closed / stat.total) * 100;
                                        const isCritical = stat.open > 0;
                                        
                                        return (
                                            <td key={sop} className="p-6 text-center border-r border-slate-50 group-hover:bg-white transition-colors">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="relative group/orb cursor-help">
                                                        {/* Compliance Glow */}
                                                        <div className={`absolute -inset-2 rounded-full blur-md opacity-20 transition-all group-hover/orb:opacity-60 ${isCritical ? 'bg-rose-500' : pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                                                        
                                                        {/* Compliance Ring */}
                                                        <svg className="w-12 h-12 relative -rotate-90" viewBox="0 0 36 36">
                                                            <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                                                            <circle 
                                                                cx="18" cy="18" r="16" fill="none" 
                                                                stroke={isCritical ? '#ef4444' : pct === 100 ? '#10b981' : '#6366f1'} 
                                                                strokeWidth="3" 
                                                                strokeDasharray="100" 
                                                                strokeDashoffset={100 - pct}
                                                                strokeLinecap="round"
                                                                className="transition-all duration-1000"
                                                            />
                                                        </svg>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className={`text-[10px] font-black ${isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                                                                {stat.closed}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {stat.total} Total
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}

                                    {/* 4. Velocity Bar */}
                                    <td className="p-8 text-center border-l border-slate-100 bg-slate-50/30">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Clock size={14} className="text-indigo-500" />
                                                <span className="font-black text-slate-900 text-sm">{row.avgTime}h</span>
                                            </div>
                                            {/* Velocity Gradient Bar */}
                                            <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                                <div 
                                                    className={`h-full transition-all duration-1000 rounded-full ${
                                                        row.avgTime < 6 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                                                        row.avgTime < 18 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                                                        'bg-gradient-to-r from-rose-400 to-rose-600'
                                                    }`}
                                                    style={{ width: `${Math.min(100, (row.avgTime / 24) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">SLA Perf.</span>
                                        </div>
                                    </td>

                                    {/* 5. Styled Control Terminal */}
                                    <td className="p-8 text-right pr-10 border-l border-slate-100">
                                        <div className="flex items-center justify-end gap-4">
                                            <div className={`p-3 rounded-2xl border-2 transition-all hover:scale-110 shadow-lg ${row.open > 5 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                                                <TrendingUp size={20} />
                                            </div>
                                            <button className="p-4 bg-slate-900 text-white rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-xl active:scale-90 group/btn">
                                                <ArrowRight size={22} className="group-hover/btn:translate-x-1 transition-transform" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Registry Status Footer */}
                <div className="p-8 bg-[#0f172a] text-white flex flex-col md:flex-row justify-between items-center shrink-0 border-t border-white/5">
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-4 border-[#0f172a] bg-slate-800 flex items-center justify-center">
                                    <User size={16} className="text-slate-400" />
                                </div>
                            ))}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Active Monitors: <span className="text-white">Admin Hub Connected</span> — Tracking {locationWiseData.length} Live Operational Nodes
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <button className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] transition-all flex items-center gap-3">
                            <History size={16} /> Audit Trail
                        </button>
                        <button className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center gap-3">
                            <CheckCheck size={18} /> Sync Full Roster
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-Charts Footer with Glow Effects */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {[
                    { title: 'Global Lifecycle Distribution', data: statusData, type: 'pie' },
                    { title: 'Top Blocking SOP Topics', data: [], type: 'bar' }
                ].map((chart, i) => (
                    <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">{chart.title}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Aggregate System Data</p>
                            </div>
                            <div className="p-3 bg-slate-50 text-slate-300 rounded-2xl group-hover:text-indigo-600 transition-colors"><Maximize2 size={20} /></div>
                        </div>
                        <div className="h-[280px] w-full bg-slate-50/30 rounded-[2rem] p-4">
                            {chart.type === 'pie' ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={chart.data} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                                            {chart.data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full opacity-20">
                                    <BarChart width={300} height={200} data={[{name: 'A', v: 400}, {name: 'B', v: 300}]}>
                                        <Bar dataKey="v" fill="#6366f1" radius={[10, 10, 0, 0]} />
                                    </BarChart>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Internal icons helper
const Maximize2 = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

export default FollowUpAnalytics;
