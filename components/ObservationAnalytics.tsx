"use client";

import React, { useMemo, useState } from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    ComposedChart,
    Line,
    Cell,
    PieChart, 
    Pie,
    Radar, 
    RadarChart, 
    PolarGrid, 
    PolarAngleAxis, 
    PolarRadiusAxis, 
    LabelList
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
    User,
    List,
    // Added missing imports
    LayoutDashboard,
    Globe,
    Building,
    Building2,
    Eye,
    EyeOff,
    RefreshCw,
    Users,
    Award,
    Mail,
    Calendar,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { HierarchyScope } from '../types';

interface AnalyticsFilter {
    type: 'status' | 'employee' | 'department' | 'location' | 'responsibility' | 'sop' | 'regional' | 'unit' | 'month';
    value: string;
    label: string;
    statusFilter?: 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL';
}

interface AnalyticsProps {
    data: any[];
    currentScope: HierarchyScope;
    onDrillDown?: (filter: AnalyticsFilter) => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b', '#06b6d4'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Custom Components ---

const CustomAgeingTick = (props: any) => {
    const { x, y, payload } = props;
    const item = props.fullData?.[payload.index];
    if (!item) return <text x={x} y={y} fill="#64748b">{payload.value}</text>;

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-10} y={-10} textAnchor="end" fill="#1e293b" fontSize={11} fontWeight={900} className="uppercase tracking-tighter">
                {payload.value}
            </text>
            <text x={-10} y={4} textAnchor="end" fill="#f43f5e" fontSize={9} fontWeight={800} className="uppercase">
                Open: {item.totalOpen}
            </text>
            <text x={-10} y={16} textAnchor="end" fill="#94a3b8" fontSize={8} fontWeight={700} className="uppercase">
                Avg(C): {item.avgLapseClosed}h | Avg(P): {item.avgLapsePending}d
            </text>
        </g>
    );
};

const MobileAgeingTick = (props: any) => {
    const { x, y, payload } = props;
    const item = props.fullData?.[payload.index];
    if (!item) return <text x={x} y={y} fill="#64748b" fontSize={9}>{payload.value}</text>;
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={-5} y={-6} textAnchor="end" fill="#1e293b" fontSize={9} fontWeight={900} className="uppercase">
                {payload.value}
            </text>
            <text x={-5} y={6} textAnchor="end" fill="#f43f5e" fontSize={8} fontWeight={700}>
                Open: {item.totalOpen}
            </text>
        </g>
    );
};

const MobileMatrixView = ({ rows, headers, headerStats, onSopDrill, onHeaderDrill, onCellDrill, headerType }: {
    rows: { sop: string, metrics: { open: number, closed: number, inflow: number, lapse: string }[] }[],
    headers: string[],
    headerStats: (h: string) => { total: number, open: number, closed: number, work: number },
    onSopDrill: (sop: string) => void,
    onHeaderDrill: (header: string, status?: string) => void,
    onCellDrill: (header: string, sop: string, statType: string) => void,
    headerType: string
}) => {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    return (
        <div className="space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
                {headers.map(h => {
                    const s = headerStats(h);
                    return (
                        <button key={h} onClick={() => onHeaderDrill(h)} className="shrink-0 bg-slate-800 rounded-xl p-2.5 min-w-[110px] text-left border border-white/5 active:scale-95 transition-all">
                            <div className="text-[9px] font-black text-indigo-400 uppercase truncate mb-1.5">{h}</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                <div className="flex items-center justify-between"><span className="text-[7px] text-slate-500">Total</span><span className="text-[10px] font-black text-white">{s.total}</span></div>
                                <div className="flex items-center justify-between"><span className="text-[7px] text-slate-500">Open</span><span className="text-[10px] font-black text-rose-400">{s.open}</span></div>
                                <div className="flex items-center justify-between"><span className="text-[7px] text-slate-500">Closed</span><span className="text-[10px] font-black text-emerald-400">{s.closed}</span></div>
                                <div className="flex items-center justify-between"><span className="text-[7px] text-slate-500">WIP</span><span className="text-[10px] font-black text-blue-400">{s.work}</span></div>
                            </div>
                        </button>
                    );
                })}
            </div>
            <div className="space-y-1.5">
                {rows.map((row, idx) => (
                    <div key={idx} className="bg-slate-800/60 rounded-xl overflow-hidden border border-white/5">
                        <button onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)} className="w-full flex items-center justify-between p-3 text-left active:bg-white/5 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                                <BookOpen size={13} className="text-slate-500 shrink-0" />
                                <span className="text-[10px] font-black text-white uppercase truncate">{row.sop}</span>
                            </div>
                            <ChevronDown size={13} className={`text-slate-500 shrink-0 transition-transform duration-200 ${expandedIdx === idx ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedIdx === idx && (
                            <div className="px-3 pb-3 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                {row.metrics.map((m, midx) => (
                                    <div key={midx} className="bg-slate-700/40 rounded-lg p-2.5 active:bg-slate-700/60 transition-colors" onClick={() => onCellDrill(headers[midx], row.sop, 'total')}>
                                        <div className="text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-1.5 truncate">{headers[midx]}</div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            <div className="flex flex-col items-center bg-slate-800/60 rounded-md py-1" onClick={(e) => { e.stopPropagation(); onCellDrill(headers[midx], row.sop, 'open'); }}>
                                                <span className="text-[7px] text-slate-500 uppercase">Open</span>
                                                <span className="text-xs font-black text-rose-400">{m.open}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-slate-800/60 rounded-md py-1" onClick={(e) => { e.stopPropagation(); onCellDrill(headers[midx], row.sop, 'closed'); }}>
                                                <span className="text-[7px] text-slate-500 uppercase">Closed</span>
                                                <span className="text-xs font-black text-emerald-400">{m.closed}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-slate-800/60 rounded-md py-1" onClick={(e) => { e.stopPropagation(); onCellDrill(headers[midx], row.sop, 'inflow'); }}>
                                                <span className="text-[7px] text-slate-500 uppercase">Inflow</span>
                                                <span className="text-xs font-black text-orange-400">{m.inflow}</span>
                                            </div>
                                            <div className="flex flex-col items-center bg-slate-900/60 rounded-md py-1">
                                                <span className="text-[7px] text-slate-500 uppercase">Lapse</span>
                                                <span className="text-[10px] font-black text-white font-mono">{m.lapse}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const MatrixDataCard = ({ stats, onStatClick }: { stats: { open: number, closed: number, inflow: number, lapse: string }, onStatClick?: (statType: 'open' | 'closed' | 'inflow' | 'total') => void }) => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between h-full min-h-[110px] min-w-[120px]">
        <div className="flex justify-between items-start mb-2">
            <div className={`flex flex-col ${onStatClick ? 'cursor-pointer hover:bg-rose-50 -m-1 p-1 rounded-lg transition-colors' : ''}`} onClick={(e) => { e.stopPropagation(); onStatClick?.('open'); }}>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Open</span>
                <span className="text-sm font-black text-slate-900 leading-none">{stats.open}</span>
            </div>
            <div className={`flex flex-col items-end ${onStatClick ? 'cursor-pointer hover:bg-emerald-50 -m-1 p-1 rounded-lg transition-colors' : ''}`} onClick={(e) => { e.stopPropagation(); onStatClick?.('closed'); }}>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Closed</span>
                <span className="text-sm font-black text-emerald-500 leading-none">{stats.closed}</span>
            </div>
        </div>
        <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-50">
            <div className={`flex flex-col ${onStatClick ? 'cursor-pointer hover:bg-orange-50 -m-1 p-1 rounded-lg transition-colors' : ''}`} onClick={(e) => { e.stopPropagation(); onStatClick?.('inflow'); }}>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Inflow</span>
                <span className="text-xs font-black text-orange-500 leading-none">{stats.inflow}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-lg shadow-sm ${onStatClick ? 'cursor-pointer hover:bg-slate-800 transition-colors' : ''}`} onClick={(e) => { e.stopPropagation(); onStatClick?.('total'); }}>
                <span className="text-[8px] font-black text-indigo-400 uppercase leading-none">Lapse</span>
                <span className="text-[10px] font-black text-white leading-none font-mono">{stats.lapse}</span>
            </div>
        </div>
    </div>
);

const GranularAuditCard: React.FC<{ areaData: any, onDrillDown?: (filter: AnalyticsFilter) => void }> = ({ areaData, onDrillDown }) => {
    const { name, subTitle, status, score, time, closed, wip, open, radarData, maxVal } = areaData;
    const isCompliant = status === 'COMPLIANT';
    const total = closed + wip + open;

    const progressWidths = {
        closed: total > 0 ? (closed / total) * 100 : 0,
        wip: total > 0 ? (wip / total) * 100 : 0,
        open: total > 0 ? (open / total) * 100 : 0,
    };

    const radarColor = isCompliant ? "#10b981" : "#ef4444";

    return (
        <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-xl p-5 md:p-8 flex flex-col min-h-[420px] md:min-h-[520px] group transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer" onClick={() => onDrillDown?.({ type: 'responsibility', value: name, label: `Responsibility: ${name}` })}>
            <div className="flex justify-between items-start mb-4 md:mb-6">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-[#0f172a] rounded-xl flex items-center justify-center shadow-lg">
                        <ShieldCheck className="text-white w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-tight truncate max-w-[160px] md:max-w-[180px]">{name}</h4>
                        <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-1.5 truncate">{subTitle}</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${isCompliant ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                    {status}
                </span>
                <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock size={14} />
                    <span className="text-column-gap font-black uppercase">{time}</span>
                </div>
            </div>

            <div className="flex-1 h-[200px] md:h-[260px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis 
                            dataKey="subject" 
                            tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b', textTransform: 'uppercase' }} 
                        />
                        <PolarRadiusAxis 
                            angle={90} 
                            domain={[0, (maxVal || 10) * 1.1]} 
                            tick={false}
                            axisLine={false}
                        />
                        <Radar
                            name={name}
                            dataKey="count"
                            stroke={radarColor}
                            fill={radarColor}
                            fillOpacity={0.15}
                            strokeWidth={3}
                            animationDuration={1500}
                            border={{
                                r: 4,
                                fill: '#fff',
                                stroke: radarColor,
                                strokeWidth: 2
                            }}
                            onClick={(data: any) => { if (data?.subject) { const sopName = data.subject.replace(/\s*\(\d+\)$/, ''); onDrillDown?.({ type: 'sop', value: sopName, label: `${name} / SOP: ${sopName}` }); } }}
                            style={{ cursor: 'pointer' }}
                        >
                            <LabelList 
                                dataKey="count" 
                                position="top" 
                                offset={10}
                                style={{ 
                                    fontSize: '11px', 
                                    fontWeight: '900', 
                                    fill: '#1e293b',
                                    textAnchor: 'middle'
                                }} 
                            />
                        </Radar>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 space-y-4">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-xl font-black text-slate-900 tracking-tighter leading-none">{score}% SCORE</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{total} Total OBS</span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                    <div style={{ width: `${progressWidths.closed}%` }} className="h-full bg-emerald-500 transition-all duration-1000" />
                    <div style={{ width: `${progressWidths.wip}%` }} className="h-full bg-amber-400 transition-all duration-1000" />
                    <div style={{ width: `${progressWidths.open}%` }} className="h-full bg-rose-500 transition-all duration-1000" />
                </div>

                <div className="flex justify-between pt-2">
                    <div className="flex flex-col cursor-pointer hover:bg-emerald-50 rounded-lg p-1 -m-1 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: name, label: `${name} / Closed`, statusFilter: 'RESOLVED' }); }}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Closed</span>
                        <span className="text-xl font-black text-emerald-500 tracking-tighter">{closed}</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer hover:bg-amber-50 rounded-lg p-1 -m-1 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: name, label: `${name} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wip</span>
                        <span className="text-xl font-black text-amber-400 tracking-tighter">{wip}</span>
                    </div>
                    <div className="flex flex-col items-end cursor-pointer hover:bg-rose-50 rounded-lg p-1 -m-1 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: name, label: `${name} / Open`, statusFilter: 'OPEN' }); }}>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Open</span>
                        <span className="text-xl font-black text-rose-500 tracking-tighter">{open}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ObservationAnalytics: React.FC<AnalyticsProps> = ({ data, currentScope, onDrillDown }) => {
    const [ageingSlice, setAgeingSlice] = useState<'DEPARTMENT' | 'LOCATION' | 'RESPONSIBILITY'>('DEPARTMENT');
    const [isDeptMatrixExpanded, setIsDeptMatrixExpanded] = useState(false);
    const [isLocMatrixExpanded, setIsLocMatrixExpanded] = useState(false);
    const [isRespMatrixExpanded, setIsRespMatrixExpanded] = useState(false);
    const [isUnitMatrixExpanded, setIsUnitMatrixExpanded] = useState(true);
    const [isRegionalMatrixExpanded, setIsRegionalMatrixExpanded] = useState(true);

    const [activeRegionTab, setActiveRegionTab] = useState<'consolidated' | string>('consolidated');
    const [employeeSort, setEmployeeSort] = useState<'shared' | 'resolved'>('shared');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [isEmployeeExpanded, setIsEmployeeExpanded] = useState(true);

    // --- Data Extraction Helpers ---

    const uniqueRegionNames = useMemo((): string[] => {
        return Array.from(new Set<string>(data.map((r: any) => r.regionalName))).filter(Boolean).sort();
    }, [data]);

    const activeData = useMemo(() => {
        if (activeRegionTab === 'consolidated') return data;
        return data.filter((r: any) => r.regionalName === activeRegionTab);
    }, [data, activeRegionTab]);

    const stats = useMemo(() => {
        const total = activeData.length;
        const open = activeData.filter((r: any) => r.status === 'OPEN').length;
        const closed = activeData.filter((r: any) => r.status === 'RESOLVED').length;
        const inProgress = activeData.filter((r: any) => ['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(r.status)).length;
        const complianceRate = total > 0 ? Math.round((closed / total) * 100) : 0;
        return { total, open, closed, inProgress, complianceRate };
    }, [activeData]);

    const trendData = useMemo(() => {
        const months = new Array(6).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return { month: d.getMonth(), year: d.getFullYear(), name: MONTH_NAMES[d.getMonth()] };
        });

        return months.map(m => {
            const monthData = activeData.filter((r: any) => {
                const rDate = new Date(r.createdDate);
                return rDate.getMonth() === m.month && rDate.getFullYear() === m.year;
            });
            const total = monthData.length;
            const closed = monthData.filter((r: any) => r.status === 'RESOLVED').length;
            return {
                name: m.name,
                total,
                closure: total > 0 ? Math.round((closed / total) * 100) : 0
            };
        });
    }, [activeData]);

    const ageingCategories = useMemo((): string[] => {
        const mapped = activeData.map((r: any) => 
            ageingSlice === 'DEPARTMENT' ? (r.departmentName || r.mainKitchen) : 
            ageingSlice === 'LOCATION' ? r.area : 
            r.reportedBy
        ).filter(Boolean) as string[];
        return Array.from(new Set<string>(mapped)).sort();
    }, [activeData, ageingSlice]);

    const transformedAgeingData = useMemo(() => {
        const buckets = [
            { label: '0-24h', min: 0, max: 24, unit: 'hours' },
            { label: '1-7d', min: 1, max: 7, unit: 'days' },
            { label: '7-30d', min: 7, max: 30, unit: 'days' },
            { label: '>30d', min: 30, max: Infinity, unit: 'days' },
        ];

        return buckets.map(bucket => {
            const bucketData: any = { ageing: bucket.label };
            let totalOpen = 0;
            let totalLapseClosed = 0;
            let countClosed = 0;
            let totalLapsePending = 0;
            let countPending = 0;

            ageingCategories.forEach(cat => {
                const catItems = activeData.filter((r: any) => {
                    const rCat = ageingSlice === 'DEPARTMENT' ? (r.departmentName || r.mainKitchen) : 
                                 ageingSlice === 'LOCATION' ? r.area : 
                                 r.reportedBy;
                    if (rCat !== cat) return false;

                    const rDate = new Date(r.createdDate);
                    const now = new Date();
                    const diffHours = (now.getTime() - rDate.getTime()) / 3600000;
                    const diffDays = diffHours / 24;

                    if (bucket.unit === 'hours') {
                        return diffHours >= bucket.min && diffHours < bucket.max;
                    } else {
                        return diffDays >= bucket.min && diffDays < bucket.max;
                    }
                });

                bucketData[cat] = catItems.length;

                catItems.forEach((r: any) => {
                    if (r.status === 'RESOLVED') {
                        if (r.closureDate) {
                            const lapse = (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                            totalLapseClosed += lapse;
                            countClosed++;
                        }
                    } else {
                        totalOpen++;
                        const lapse = (new Date().getTime() - new Date(r.createdDate).getTime()) / 86400000;
                        totalLapsePending += lapse;
                        countPending++;
                    }
                });
            });

            bucketData.totalOpen = totalOpen;
            bucketData.avgLapseClosed = countClosed > 0 ? Math.round(totalLapseClosed / countClosed) : 0;
            bucketData.avgLapsePending = countPending > 0 ? Math.round(totalLapsePending / countPending) : 0;

            return bucketData;
        });
    }, [activeData, ageingSlice, ageingCategories]);

    const semanticData = useMemo(() => {
        const sopCounts: Record<string, number> = {};
        activeData.forEach((r: any) => {
            if (r.sop) {
                sopCounts[r.sop] = (sopCounts[r.sop] || 0) + 1;
            }
        });
        return Object.entries(sopCounts)
            .map(([name, val]) => ({ name, val, trend: val > 5 ? 'up' : 'stable' }))
            .sort((a, b) => b.val - a.val);
    }, [activeData]);

    const topSops = useMemo(() => semanticData.map(s => s.name), [semanticData]);

    // --- Dynamic Column Discovery ---
    const activeDepartments = useMemo(() => Array.from(new Set<string>(activeData.map((r: any) => r.departmentName || r.mainKitchen).filter(Boolean) as string[])).sort(), [activeData]);
    const activeResponsibilities = useMemo(() => Array.from(new Set<string>(activeData.map((r: any) => r.mainKitchen || r.responsibility).filter(Boolean) as string[])).sort(), [activeData]);
    const activeLocations = useMemo(() => Array.from(new Set<string>(activeData.map((r: any) => r.area).filter(Boolean) as string[])).sort(), [activeData]);
    const activeUnits = useMemo(() => Array.from(new Set<string>(activeData.map((r: any) => r.unitName).filter(Boolean) as string[])).sort(), [activeData]);

    // --- Common Stat Calculator for Matrix Headers ---
    const getAttributeHeaderStats = (name: string, key: 'departmentName' | 'mainKitchen' | 'area' | 'regionalName' | 'unitName') => {
        const items = activeData.filter((r: any) => r[key] === name || (key === 'departmentName' && r.mainKitchen === name));
        return {
            total: items.length,
            open: items.filter((r: any) => r.status === 'OPEN').length,
            closed: items.filter((r: any) => r.status === 'RESOLVED').length,
            work: items.filter((r: any) => ['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(r.status)).length
        };
    };

    const departmentPolicyMatrix = useMemo(() => {
        return topSops.map(sopName => {
            const deptMetrics = activeDepartments.map(dept => {
                const cellItems = activeData.filter((r: any) => (r.departmentName === dept || r.mainKitchen === dept) && r.sop === sopName);
                const open = cellItems.filter((r: any) => r.status !== 'RESOLVED').length;
                const closed = cellItems.filter((r: any) => r.status === 'RESOLVED').length;
                let totalLapse = 0;
                let resolvedCount = 0;
                cellItems.forEach((r: any) => {
                    if (r.createdDate && r.closureDate) {
                        totalLapse += (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                        resolvedCount++;
                    }
                });
                const avgLapse = resolvedCount > 0 ? (totalLapse / resolvedCount).toFixed(1) : '0.0';
                return { open, closed, inflow: 0, lapse: `${avgLapse}h` };
            });
            return { sop: sopName, metrics: deptMetrics };
        });
    }, [activeData, topSops, activeDepartments]);

    const responsibilityPolicyMatrix = useMemo(() => {
        return topSops.map(sopName => {
            const metrics = activeResponsibilities.map(resp => {
                const cellItems = activeData.filter((r: any) => (r.mainKitchen === resp || r.responsibility === resp) && r.sop === sopName);
                const open = cellItems.filter((r: any) => r.status !== 'RESOLVED').length;
                const closed = cellItems.filter((r: any) => r.status === 'RESOLVED').length;
                let totalLapse = 0;
                let resolvedCount = 0;
                cellItems.forEach((r: any) => {
                    if (r.createdDate && r.closureDate) {
                        totalLapse += (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                        resolvedCount++;
                    }
                });
                const avgLapse = resolvedCount > 0 ? (totalLapse / resolvedCount).toFixed(1) : '0.0';
                return { open, closed, inflow: 0, lapse: `${avgLapse}h` };
            });
            return { sop: sopName, metrics };
        });
    }, [activeData, topSops, activeResponsibilities]);

    const locationPolicyMatrix = useMemo(() => {
        return topSops.map(sopName => {
            const locMetrics = activeLocations.map(loc => {
                const cellItems = activeData.filter((r: any) => r.area === loc && r.sop === sopName);
                const open = cellItems.filter((r: any) => r.status !== 'RESOLVED').length;
                const closed = cellItems.filter((r: any) => r.status === 'RESOLVED').length;
                let totalLapse = 0;
                let resolvedCount = 0;
                cellItems.forEach((r: any) => {
                    if (r.createdDate && r.closureDate) {
                        totalLapse += (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                        resolvedCount++;
                    }
                });
                const avgLapse = resolvedCount > 0 ? (totalLapse / resolvedCount).toFixed(1) : '0.0';
                return { open, closed, inflow: 0, lapse: `${avgLapse}h` };
            });
            return { sop: sopName, metrics: locMetrics };
        });
    }, [activeData, topSops, activeLocations]);

    const regionalPolicyMatrix = useMemo(() => {
        if (activeRegionTab !== 'consolidated') return [];
        return topSops.map(sopName => {
            const metrics = uniqueRegionNames.map(reg => {
                const cellItems = data.filter((r: any) => r.regionalName === reg && r.sop === sopName);
                const open = cellItems.filter((r: any) => r.status !== 'RESOLVED').length;
                const closed = cellItems.filter((r: any) => r.status === 'RESOLVED').length;
                let totalLapse = 0;
                let resolvedCount = 0;
                cellItems.forEach((r: any) => {
                    if (r.createdDate && r.closureDate) {
                        totalLapse += (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                        resolvedCount++;
                    }
                });
                const avgLapse = resolvedCount > 0 ? (totalLapse / resolvedCount).toFixed(1) : '0.0';
                return { open, closed, inflow: 0, lapse: `${avgLapse}h` };
            });
            return { sop: sopName, metrics };
        });
    }, [data, topSops, uniqueRegionNames, activeRegionTab]);

    const unitPolicyMatrix = useMemo(() => {
        if (activeRegionTab === 'consolidated') return [];
        return topSops.map(sopName => {
            const metrics = activeUnits.map(unit => {
                const cellItems = activeData.filter((r: any) => r.unitName === unit && r.sop === sopName);
                const open = cellItems.filter((r: any) => r.status !== 'RESOLVED').length;
                const closed = cellItems.filter((r: any) => r.status === 'RESOLVED').length;
                let totalLapse = 0;
                let resolvedCount = 0;
                cellItems.forEach((r: any) => {
                    if (r.createdDate && r.closureDate) {
                        totalLapse += (new Date(r.closureDate).getTime() - new Date(r.createdDate).getTime()) / 3600000;
                        resolvedCount++;
                    }
                });
                const avgLapse = resolvedCount > 0 ? (totalLapse / resolvedCount).toFixed(1) : '0.0';
                return { open, closed, inflow: 0, lapse: `${avgLapse}h` };
            });
            return { sop: sopName, metrics };
        });
    }, [activeData, topSops, activeRegionTab, activeUnits]);

    const granularAuditData = useMemo(() => {
        const respCounts: Record<string, number> = {};
        activeData.forEach((r: any) => {
            const resp = r.mainKitchen || r.departmentName || r.responsibility;
            if (resp) respCounts[resp] = (respCounts[resp] || 0) + 1;
        });

        const topResponsibilities = Object.entries(respCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

        return topResponsibilities.map(respName => {
            const respItems = activeData.filter((r: any) => (r.mainKitchen === respName || r.departmentName === respName || r.responsibility === respName));
            const closed = respItems.filter((r: any) => r.status === 'RESOLVED').length;
            const wip = respItems.filter((r: any) => ['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(r.status)).length;
            const open = respItems.filter((r: any) => r.status === 'OPEN').length;
            const totalCount = respItems.length;
            const score = totalCount > 0 ? Math.round((closed / totalCount) * 100) : 0;

            const sopFreqForResp: Record<string, number> = {};
            respItems.forEach((r: any) => {
                const s = r.sop || "General Compliance";
                sopFreqForResp[s] = (sopFreqForResp[s] || 0) + 1;
            });

            const topPoliciesForResp = Object.entries(sopFreqForResp)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7);

            const radarData = topPoliciesForResp.map(([sopName, count]) => ({
                subject: `${sopName} (${count})`,
                count: count
            }));

            const maxVal = topPoliciesForResp.length > 0 ? Math.max(...topPoliciesForResp.map(p => p[1])) : 10;

            return {
                name: respName,
                subTitle: "RESPONSIBILITY NODE",
                status: score > 75 ? 'COMPLIANT' : 'URGENT',
                score,
                time: "REAL-TIME",
                closed,
                wip,
                open,
                radarData,
                maxVal
            };
        });
    }, [activeData]);

    const employeeData = useMemo(() => {
        const empMap: Record<string, { shared: number; resolved: number; regional: string; unit: string; department: string }> = {};
        activeData.forEach((r: any) => {
            const name = r.reportedBy;
            if (!name) return;
            if (!empMap[name]) {
                empMap[name] = { shared: 0, resolved: 0, regional: r.regionalName || '', unit: r.unitName || '', department: r.departmentName || r.mainKitchen || '' };
            }
            empMap[name].shared++;
            if (r.status === 'RESOLVED') empMap[name].resolved++;
        });
        let entries = Object.entries(empMap).map(([name, stats]) => ({ name, ...stats }));
        if (employeeSearch) {
            const q = employeeSearch.toLowerCase();
            entries = entries.filter(e => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.unit.toLowerCase().includes(q));
        }
        entries.sort((a, b) => employeeSort === 'shared' ? b.shared - a.shared : b.resolved - a.resolved);
        return entries;
    }, [activeData, employeeSort, employeeSearch]);

    const deptShare = useMemo(() => {
        const counts: Record<string, number> = {};
        activeData.forEach((r: any) => {
            const dept = r.departmentName || r.mainKitchen || 'General';
            counts[dept] = (counts[dept] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value], i) => ({
            name,
            value,
            color: COLORS[i % COLORS.length]
        })).sort((a,b) => b.value - a.value);
    }, [activeData]);

    const scopeRadarData = useMemo(() => {
        const RADAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

        if (currentScope === 'corporate' || currentScope === 'super-admin') {
            if (activeRegionTab === 'consolidated') {
                const units = Array.from(new Set<string>(activeData.map((r: any) => r.unitName).filter(Boolean) as string[])).sort();
                const sops = topSops.slice(0, 8);
                if (units.length === 0 || sops.length === 0) return null;

                const radarPoints = sops.map(sop => {
                    const point: any = { policy: sop.length > 20 ? sop.substring(0, 18) + '…' : sop, fullPolicy: sop };
                    units.forEach(unit => {
                        point[unit] = activeData.filter((r: any) => r.unitName === unit && r.sop === sop).length;
                    });
                    return point;
                });

                const maxVal = Math.max(...radarPoints.flatMap(p => units.map(u => p[u] || 0)), 1);

                return {
                    title: 'All Units vs Policy',
                    subtitle: 'Consolidated Corporate View',
                    icon: 'globe',
                    axes: units,
                    radarPoints,
                    maxVal,
                    colors: RADAR_COLORS,
                    drillType: 'unit' as const
                };
            } else {
                const units = Array.from(new Set<string>(activeData.map((r: any) => r.unitName).filter(Boolean) as string[])).sort();
                const sops = topSops.slice(0, 8);
                if (units.length === 0 || sops.length === 0) return null;

                const radarPoints = sops.map(sop => {
                    const point: any = { policy: sop.length > 20 ? sop.substring(0, 18) + '…' : sop, fullPolicy: sop };
                    units.forEach(unit => {
                        point[unit] = activeData.filter((r: any) => r.unitName === unit && r.sop === sop).length;
                    });
                    return point;
                });

                const maxVal = Math.max(...radarPoints.flatMap(p => units.map(u => p[u] || 0)), 1);

                return {
                    title: `Units under ${activeRegionTab} vs Policy`,
                    subtitle: `Regional View — ${activeRegionTab}`,
                    icon: 'building',
                    axes: units,
                    radarPoints,
                    maxVal,
                    colors: RADAR_COLORS,
                    drillType: 'unit' as const
                };
            }
        } else if (currentScope === 'regional') {
            const units = Array.from(new Set<string>(activeData.map((r: any) => r.unitName).filter(Boolean) as string[])).sort();
            const sops = topSops.slice(0, 8);
            if (units.length === 0 || sops.length === 0) return null;

            const radarPoints = sops.map(sop => {
                const point: any = { policy: sop.length > 20 ? sop.substring(0, 18) + '…' : sop, fullPolicy: sop };
                units.forEach(unit => {
                    point[unit] = activeData.filter((r: any) => r.unitName === unit && r.sop === sop).length;
                });
                return point;
            });

            const maxVal = Math.max(...radarPoints.flatMap(p => units.map(u => p[u] || 0)), 1);

            return {
                title: 'All Units vs Policy',
                subtitle: 'Regional Consolidated View',
                icon: 'building',
                axes: units,
                radarPoints,
                maxVal,
                colors: RADAR_COLORS,
                drillType: 'unit' as const
            };
        } else if (currentScope === 'unit') {
            const departments = Array.from(new Set<string>(activeData.map((r: any) => r.departmentName || r.mainKitchen).filter(Boolean) as string[])).sort();
            const sops = topSops.slice(0, 8);
            if (departments.length === 0 || sops.length === 0) return null;

            const radarPoints = sops.map(sop => {
                const point: any = { policy: sop.length > 20 ? sop.substring(0, 18) + '…' : sop, fullPolicy: sop };
                departments.forEach(dept => {
                    point[dept] = activeData.filter((r: any) => (r.departmentName === dept || r.mainKitchen === dept) && r.sop === sop).length;
                });
                return point;
            });

            const maxVal = Math.max(...radarPoints.flatMap(p => departments.map(d => p[d] || 0)), 1);

            return {
                title: 'All Departments vs Policy',
                subtitle: 'Unit Consolidated View',
                icon: 'building2',
                axes: departments,
                radarPoints,
                maxVal,
                colors: RADAR_COLORS,
                drillType: 'department' as const
            };
        }

        return null;
    }, [activeData, currentScope, activeRegionTab, topSops]);

    // UI Helpers
    const getUnitHeaderStats = (name: string) => {
        const unitItems = activeData.filter((r: any) => r.unitName === name || r.regionalName === name);
        return {
            total: unitItems.length,
            open: unitItems.filter((r: any) => r.status === 'OPEN').length,
            closed: unitItems.filter((r: any) => r.status === 'RESOLVED').length,
            work: unitItems.filter((r: any) => ['PENDING', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(r.status)).length
        };
    };

    return (
        <div className="space-y-6 md:space-y-12 pb-20 animate-in fade-in duration-700 text-left px-0 md:px-0">
            
            {/* 1. Global Navigation Tabs */}
            {(currentScope === 'corporate' || currentScope === 'super-admin') && (
                <div className="flex justify-center mb-4 md:mb-8">
                    <div className="flex bg-white p-1 md:p-1.5 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-xl overflow-x-auto hide-scrollbar max-w-full">
                        <button 
                            onClick={() => setActiveRegionTab('consolidated')}
                            className={`px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-3xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap ${activeRegionTab === 'consolidated' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutDashboard size={14}/> Consolidated
                        </button>
                        {uniqueRegionNames.map(reg => (
                            <button 
                                key={reg}
                                onClick={() => setActiveRegionTab(reg)}
                                className={`px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-3xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 md:gap-3 whitespace-nowrap ${activeRegionTab === reg ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Globe size={14}/> {reg}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Executive KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {[
                    { label: 'Total Observations', value: stats.total, icon: Layers, color: 'bg-slate-900', statusFilter: '' },
                    { label: 'Open Issues', value: stats.open, icon: AlertCircle, color: 'bg-rose-500', statusFilter: 'OPEN' },
                    { label: 'Closed Records', value: stats.closed, icon: CheckCircle2, color: 'bg-emerald-500', statusFilter: 'RESOLVED' },
                    { label: 'In-Progress Flow', value: stats.inProgress, icon: RefreshCw, color: 'bg-blue-500', statusFilter: 'IN_PROGRESS' },
                ].map((kpi, i) => (
                    <div 
                        key={i} 
                        onClick={() => onDrillDown?.({ type: 'status', value: kpi.statusFilter, label: kpi.label })}
                        className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer active:scale-[0.97]"
                    >
                        <div className="flex justify-between items-start mb-3 md:mb-6">
                            <div className={`p-2.5 md:p-4 rounded-xl md:rounded-2xl ${kpi.color} text-white shadow-lg group-hover:rotate-6 transition-transform`}>
                                <kpi.icon size={20} className="md:hidden" /><kpi.icon size={24} className="hidden md:block" />
                            </div>
                            {onDrillDown && <ArrowUpRight size={14} className="text-slate-200 group-hover:text-indigo-500 transition-colors mt-1 md:hidden" />}
                            {onDrillDown && <ArrowUpRight size={16} className="text-slate-200 group-hover:text-indigo-500 transition-colors mt-1 hidden md:block" />}
                        </div>
                        <h4 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] md:tracking-[0.2em] mb-0.5 md:mb-1 leading-tight">{kpi.label}</h4>
                        <div className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter">{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* 3. Specialized Matrix View */}
            {activeRegionTab === 'consolidated' ? (
                /* SOPs vs Regional Matrix for Consolidated Tab */
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2 gap-2">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><Globe size={16} className="md:hidden" /><Globe size={20} className="hidden md:block" /></div>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em] truncate">SOPs Vs Regional</h3>
                        </div>
                        <button 
                            onClick={() => setIsRegionalMatrixExpanded(!isRegionalMatrixExpanded)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${isRegionalMatrixExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isRegionalMatrixExpanded ? <><EyeOff size={12} /> <span className="hidden sm:inline">Hide</span></> : <><Eye size={12} /> <span className="hidden sm:inline">Show</span></>}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#0f172a] rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/5 transition-all duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50">
                                        <th className="p-8 w-[240px] border-b border-white/5 sticky left-0 bg-[#0f172a] z-20">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard SOP</span>
                                        </th>
                                        {uniqueRegionNames.map((reg: string) => {
                                            const hStats = getUnitHeaderStats(reg);
                                            return (
                                                <th key={reg} className="p-8 border-b border-white/5 text-center min-w-[200px] cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onDrillDown?.({ type: 'regional', value: reg, label: `Region: ${reg}` })}>
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl"><Globe size={20} /></div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] block mb-2 px-2">{reg}</span>
                                                            <div className="grid grid-cols-2 gap-1 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'regional', value: reg, label: `Region: ${reg} / All`, statusFilter: 'ALL' }); }}><span className="text-[7px] text-slate-400 uppercase">Total</span><span className="text-[10px] font-black text-white">{hStats.total}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'regional', value: reg, label: `Region: ${reg} / Open`, statusFilter: 'OPEN' }); }}><span className="text-[7px] text-slate-400 uppercase">Open</span><span className="text-[10px] font-black text-rose-500">{hStats.open}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'regional', value: reg, label: `Region: ${reg} / Closed`, statusFilter: 'RESOLVED' }); }}><span className="text-[7px] text-slate-400 uppercase">Closed</span><span className="text-[10px] font-black text-emerald-500">{hStats.closed}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'regional', value: reg, label: `Region: ${reg} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}><span className="text-[7px] text-slate-400 uppercase">Work</span><span className="text-[10px] font-black text-blue-400">{hStats.work}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                {isRegionalMatrixExpanded && (
                                    <tbody className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-500">
                                        {regionalPolicyMatrix.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-8 sticky left-0 bg-[#0f172a] z-10 cursor-pointer" onClick={() => onDrillDown?.({ type: 'sop', value: row.sop, label: `SOP: ${row.sop}` })}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><BookOpen size={24} /></div>
                                                        <span className="text-sm font-black text-white uppercase tracking-tight truncate leading-none">{row.sop}</span>
                                                    </div>
                                                </td>
                                                {row.metrics.map((metric: any, midx: number) => (
                                                    <td key={midx} className="p-4 border-l border-white/5">
                                                        <MatrixDataCard stats={metric} onStatClick={(statType) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; const statusLabels: Record<string, string> = { open: 'Open', closed: 'Closed', inflow: 'In Progress', total: 'All' }; onDrillDown?.({ type: 'regional', value: uniqueRegionNames[midx], label: `Region: ${uniqueRegionNames[midx]} / SOP: ${row.sop} / ${statusLabels[statType]}`, statusFilter: statusMap[statType] }); }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    {/* Mobile Card View */}
                    {isRegionalMatrixExpanded && (
                        <div className="md:hidden bg-[#0f172a] rounded-2xl shadow-2xl p-3 border border-white/5">
                            <MobileMatrixView
                                rows={regionalPolicyMatrix}
                                headers={uniqueRegionNames}
                                headerStats={(h) => getUnitHeaderStats(h)}
                                onSopDrill={(sop) => onDrillDown?.({ type: 'sop', value: sop, label: `SOP: ${sop}` })}
                                onHeaderDrill={(h) => onDrillDown?.({ type: 'regional', value: h, label: `Region: ${h}` })}
                                onCellDrill={(h, sop, st) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; onDrillDown?.({ type: 'regional', value: h, label: `Region: ${h} / SOP: ${sop}`, statusFilter: statusMap[st] || 'ALL' }); }}
                                headerType="regional"
                            />
                        </div>
                    )}
                </div>
            ) : (
                /* SOPs vs Unit Matrix for Region-Specific Tab */
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2 gap-2">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><Building size={16} className="md:hidden" /><Building size={20} className="hidden md:block" /></div>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em] truncate">SOPs Vs Unit</h3>
                        </div>
                        <button 
                            onClick={() => setIsUnitMatrixExpanded(!isUnitMatrixExpanded)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${isUnitMatrixExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isUnitMatrixExpanded ? <><EyeOff size={12} /> <span className="hidden sm:inline">Hide</span></> : <><Eye size={12} /> <span className="hidden sm:inline">Show</span></>}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#0f172a] rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/5 transition-all duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50">
                                        <th className="p-8 w-[240px] border-b border-white/5 sticky left-0 bg-[#0f172a] z-20">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard SOP</span>
                                        </th>
                                        {activeUnits.map((unit: string) => {
                                            const hStats = getUnitHeaderStats(unit);
                                            return (
                                                <th key={unit} className="p-8 border-b border-white/5 text-center min-w-[200px]">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl"><Building size={20} /></div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] block mb-2 px-2">{unit}</span>
                                                            <div className="grid grid-cols-2 gap-1 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'unit', value: unit, label: `Unit: ${unit} / All`, statusFilter: 'ALL' }); }}><span className="text-[7px] text-slate-400 uppercase">Total</span><span className="text-[10px] font-black text-white">{hStats.total}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'unit', value: unit, label: `Unit: ${unit} / Open`, statusFilter: 'OPEN' }); }}><span className="text-[7px] text-slate-400 uppercase">Open</span><span className="text-[10px] font-black text-rose-500">{hStats.open}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'unit', value: unit, label: `Unit: ${unit} / Closed`, statusFilter: 'RESOLVED' }); }}><span className="text-[7px] text-slate-400 uppercase">Closed</span><span className="text-[10px] font-black text-emerald-500">{hStats.closed}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'unit', value: unit, label: `Unit: ${unit} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}><span className="text-[7px] text-slate-400 uppercase">Work</span><span className="text-[10px] font-black text-blue-400">{hStats.work}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                {isUnitMatrixExpanded && (
                                    <tbody className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-500">
                                        {unitPolicyMatrix.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-8 sticky left-0 bg-[#0f172a] z-10 cursor-pointer" onClick={() => onDrillDown?.({ type: 'sop', value: row.sop, label: `SOP: ${row.sop}` })}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><BookOpen size={24} /></div>
                                                        <span className="text-sm font-black text-white uppercase tracking-tight truncate leading-none">{row.sop}</span>
                                                    </div>
                                                </td>
                                                {row.metrics.map((metric: any, midx: number) => (
                                                    <td key={midx} className="p-4 border-l border-white/5">
                                                        <MatrixDataCard stats={metric} onStatClick={(statType) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; const statusLabels: Record<string, string> = { open: 'Open', closed: 'Closed', inflow: 'In Progress', total: 'All' }; onDrillDown?.({ type: 'unit', value: activeUnits[midx], label: `Unit: ${activeUnits[midx]} / SOP: ${row.sop} / ${statusLabels[statType]}`, statusFilter: statusMap[statType] }); }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    {/* Mobile Card View */}
                    {isUnitMatrixExpanded && (
                        <div className="md:hidden bg-[#0f172a] rounded-2xl shadow-2xl p-3 border border-white/5">
                            <MobileMatrixView
                                rows={unitPolicyMatrix}
                                headers={activeUnits}
                                headerStats={(h) => getUnitHeaderStats(h)}
                                onSopDrill={(sop) => onDrillDown?.({ type: 'sop', value: sop, label: `SOP: ${sop}` })}
                                onHeaderDrill={(h) => onDrillDown?.({ type: 'unit', value: h, label: `Unit: ${h}` })}
                                onCellDrill={(h, sop, st) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; onDrillDown?.({ type: 'unit', value: h, label: `Unit: ${h} / SOP: ${sop}`, statusFilter: statusMap[st] || 'ALL' }); }}
                                headerType="unit"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 4. Hierarchical Attribute Matrices */}
            <div className="grid grid-cols-1 gap-6 md:gap-12">
                
                {/* SOPs vs Department Matrix */}
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2 gap-2">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><Building2 size={16} className="md:hidden" /><Building2 size={20} className="hidden md:block" /></div>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em] truncate">SOPs Vs Department</h3>
                        </div>
                        <button 
                            onClick={() => setIsDeptMatrixExpanded(!isDeptMatrixExpanded)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${isDeptMatrixExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isDeptMatrixExpanded ? <><EyeOff size={12} /> <span className="hidden sm:inline">Hide</span></> : <><Eye size={12} /> <span className="hidden sm:inline">Show</span></>}
                        </button>
                    </div>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#0f172a] rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/5 transition-all duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50">
                                        <th className="p-8 w-[240px] border-b border-white/5 sticky left-0 bg-[#0f172a] z-20">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard SOP</span>
                                        </th>
                                        {activeDepartments.map((dept: string) => {
                                            const hStats = getAttributeHeaderStats(dept, 'departmentName');
                                            return (
                                                <th key={dept} className="p-8 border-b border-white/5 text-center min-w-[200px]">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl"><Building2 size={20} /></div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] block mb-2 px-2">{dept}</span>
                                                            <div className="grid grid-cols-2 gap-1 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'department', value: dept, label: `Dept: ${dept} / All`, statusFilter: 'ALL' }); }}><span className="text-[7px] text-slate-400 uppercase">Total</span><span className="text-[10px] font-black text-white">{hStats.total}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'department', value: dept, label: `Dept: ${dept} / Open`, statusFilter: 'OPEN' }); }}><span className="text-[7px] text-slate-400 uppercase">Open</span><span className="text-[10px] font-black text-rose-500">{hStats.open}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'department', value: dept, label: `Dept: ${dept} / Closed`, statusFilter: 'RESOLVED' }); }}><span className="text-[7px] text-slate-400 uppercase">Closed</span><span className="text-[10px] font-black text-emerald-500">{hStats.closed}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'department', value: dept, label: `Dept: ${dept} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}><span className="text-[7px] text-slate-400 uppercase">Work</span><span className="text-[10px] font-black text-blue-400">{hStats.work}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                {isDeptMatrixExpanded && (
                                    <tbody className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-500">
                                        {departmentPolicyMatrix.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-8 sticky left-0 bg-[#0f172a] z-10 cursor-pointer" onClick={() => onDrillDown?.({ type: 'sop', value: row.sop, label: `SOP: ${row.sop}` })}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><BookOpen size={24} /></div>
                                                        <span className="text-sm font-black text-white uppercase tracking-tight truncate leading-none">{row.sop}</span>
                                                    </div>
                                                </td>
                                                {row.metrics.map((metric: any, midx: number) => (
                                                    <td key={midx} className="p-4 border-l border-white/5">
                                                        <MatrixDataCard stats={metric} onStatClick={(statType) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; const statusLabels: Record<string, string> = { open: 'Open', closed: 'Closed', inflow: 'In Progress', total: 'All' }; onDrillDown?.({ type: 'department', value: activeDepartments[midx], label: `Dept: ${activeDepartments[midx]} / SOP: ${row.sop} / ${statusLabels[statType]}`, statusFilter: statusMap[statType] }); }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    {/* Mobile Card View */}
                    {isDeptMatrixExpanded && (
                        <div className="md:hidden bg-[#0f172a] rounded-2xl shadow-2xl p-3 border border-white/5">
                            <MobileMatrixView
                                rows={departmentPolicyMatrix}
                                headers={activeDepartments}
                                headerStats={(h) => getAttributeHeaderStats(h, 'departmentName')}
                                onSopDrill={(sop) => onDrillDown?.({ type: 'sop', value: sop, label: `SOP: ${sop}` })}
                                onHeaderDrill={(h) => onDrillDown?.({ type: 'department', value: h, label: `Dept: ${h}` })}
                                onCellDrill={(h, sop, st) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; onDrillDown?.({ type: 'department', value: h, label: `Dept: ${h} / SOP: ${sop}`, statusFilter: statusMap[st] || 'ALL' }); }}
                                headerType="department"
                            />
                        </div>
                    )}
                </div>

                {/* SOPs vs Responsibility Matrix */}
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2 gap-2">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><ShieldCheck size={16} className="md:hidden" /><ShieldCheck size={20} className="hidden md:block" /></div>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em] truncate">SOPs Vs Responsibility</h3>
                        </div>
                        <button 
                            onClick={() => setIsRespMatrixExpanded(!isRespMatrixExpanded)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${isRespMatrixExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isRespMatrixExpanded ? <><EyeOff size={12} /> <span className="hidden sm:inline">Hide</span></> : <><Eye size={12} /> <span className="hidden sm:inline">Show</span></>}
                        </button>
                    </div>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#0f172a] rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/5 transition-all duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50">
                                        <th className="p-8 w-[240px] border-b border-white/5 sticky left-0 bg-[#0f172a] z-20">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard SOP</span>
                                        </th>
                                        {activeResponsibilities.map((resp: string) => {
                                            const hStats = getAttributeHeaderStats(resp, 'mainKitchen');
                                            return (
                                                <th key={resp} className="p-8 border-b border-white/5 text-center min-w-[200px]">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl"><ShieldCheck size={20} /></div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] block mb-2 px-2">{resp}</span>
                                                            <div className="grid grid-cols-2 gap-1 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: resp, label: `Responsibility: ${resp} / All`, statusFilter: 'ALL' }); }}><span className="text-[7px] text-slate-400 uppercase">Total</span><span className="text-[10px] font-black text-white">{hStats.total}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: resp, label: `Responsibility: ${resp} / Open`, statusFilter: 'OPEN' }); }}><span className="text-[7px] text-slate-400 uppercase">Open</span><span className="text-[10px] font-black text-rose-500">{hStats.open}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: resp, label: `Responsibility: ${resp} / Closed`, statusFilter: 'RESOLVED' }); }}><span className="text-[7px] text-slate-400 uppercase">Closed</span><span className="text-[10px] font-black text-emerald-500">{hStats.closed}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'responsibility', value: resp, label: `Responsibility: ${resp} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}><span className="text-[7px] text-slate-400 uppercase">Work</span><span className="text-[10px] font-black text-blue-400">{hStats.work}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                {isRespMatrixExpanded && (
                                    <tbody className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-500">
                                        {responsibilityPolicyMatrix.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-8 sticky left-0 bg-[#0f172a] z-10 cursor-pointer" onClick={() => onDrillDown?.({ type: 'sop', value: row.sop, label: `SOP: ${row.sop}` })}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><BookOpen size={24} /></div>
                                                        <span className="text-sm font-black text-white uppercase tracking-tight truncate leading-none">{row.sop}</span>
                                                    </div>
                                                </td>
                                                {row.metrics.map((metric: any, midx: number) => (
                                                    <td key={midx} className="p-4 border-l border-white/5">
                                                        <MatrixDataCard stats={metric} onStatClick={(statType) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; const statusLabels: Record<string, string> = { open: 'Open', closed: 'Closed', inflow: 'In Progress', total: 'All' }; onDrillDown?.({ type: 'responsibility', value: activeResponsibilities[midx], label: `Responsibility: ${activeResponsibilities[midx]} / SOP: ${row.sop} / ${statusLabels[statType]}`, statusFilter: statusMap[statType] }); }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    {/* Mobile Card View */}
                    {isRespMatrixExpanded && (
                        <div className="md:hidden bg-[#0f172a] rounded-2xl shadow-2xl p-3 border border-white/5">
                            <MobileMatrixView
                                rows={responsibilityPolicyMatrix}
                                headers={activeResponsibilities}
                                headerStats={(h) => getAttributeHeaderStats(h, 'mainKitchen')}
                                onSopDrill={(sop) => onDrillDown?.({ type: 'sop', value: sop, label: `SOP: ${sop}` })}
                                onHeaderDrill={(h) => onDrillDown?.({ type: 'responsibility', value: h, label: `Responsibility: ${h}` })}
                                onCellDrill={(h, sop, st) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; onDrillDown?.({ type: 'responsibility', value: h, label: `Resp: ${h} / SOP: ${sop}`, statusFilter: statusMap[st] || 'ALL' }); }}
                                headerType="responsibility"
                            />
                        </div>
                    )}
                </div>

                {/* SOPs vs Physical Location Matrix */}
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between px-2 gap-2">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><MapPin size={16} className="md:hidden" /><MapPin size={20} className="hidden md:block" /></div>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em] truncate">SOPs Vs Location</h3>
                        </div>
                        <button 
                            onClick={() => setIsLocMatrixExpanded(!isLocMatrixExpanded)}
                            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${isLocMatrixExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isLocMatrixExpanded ? <><EyeOff size={12} /> <span className="hidden sm:inline">Hide</span></> : <><Eye size={12} /> <span className="hidden sm:inline">Show</span></>}
                        </button>
                    </div>
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#0f172a] rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/5 transition-all duration-500">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50">
                                        <th className="p-8 w-[240px] border-b border-white/5 sticky left-0 bg-[#0f172a] z-20">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Standard SOP</span>
                                        </th>
                                        {activeLocations.map((loc: string) => {
                                            const hStats = getAttributeHeaderStats(loc, 'area');
                                            return (
                                                <th key={loc} className="p-8 border-b border-white/5 text-center min-w-[200px]">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl"><MapPin size={20} /></div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.1em] block mb-2 px-2">{loc}</span>
                                                            <div className="grid grid-cols-2 gap-1 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'location', value: loc, label: `Location: ${loc} / All`, statusFilter: 'ALL' }); }}><span className="text-[7px] text-slate-400 uppercase">Total</span><span className="text-[10px] font-black text-white">{hStats.total}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'location', value: loc, label: `Location: ${loc} / Open`, statusFilter: 'OPEN' }); }}><span className="text-[7px] text-slate-400 uppercase">Open</span><span className="text-[10px] font-black text-rose-500">{hStats.open}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'location', value: loc, label: `Location: ${loc} / Closed`, statusFilter: 'RESOLVED' }); }}><span className="text-[7px] text-slate-400 uppercase">Closed</span><span className="text-[10px] font-black text-emerald-500">{hStats.closed}</span></div>
                                                                <div className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-0.5 transition-colors" onClick={(e) => { e.stopPropagation(); onDrillDown?.({ type: 'location', value: loc, label: `Location: ${loc} / In Progress`, statusFilter: 'IN_PROGRESS' }); }}><span className="text-[7px] text-slate-400 uppercase">Work</span><span className="text-[10px] font-black text-blue-400">{hStats.work}</span></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                {isLocMatrixExpanded && (
                                    <tbody className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-500">
                                        {locationPolicyMatrix.map((row: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-8 sticky left-0 bg-[#0f172a] z-10 cursor-pointer" onClick={() => onDrillDown?.({ type: 'sop', value: row.sop, label: `SOP: ${row.sop}` })}>
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><BookOpen size={24} /></div>
                                                        <span className="text-sm font-black text-white uppercase tracking-tight truncate leading-none">{row.sop}</span>
                                                    </div>
                                                </td>
                                                {row.metrics.map((metric: any, midx: number) => (
                                                    <td key={midx} className="p-4 border-l border-white/5">
                                                        <MatrixDataCard stats={metric} onStatClick={(statType) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; const statusLabels: Record<string, string> = { open: 'Open', closed: 'Closed', inflow: 'In Progress', total: 'All' }; onDrillDown?.({ type: 'location', value: activeLocations[midx], label: `Location: ${activeLocations[midx]} / SOP: ${row.sop} / ${statusLabels[statType]}`, statusFilter: statusMap[statType] }); }} />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                    {/* Mobile Card View */}
                    {isLocMatrixExpanded && (
                        <div className="md:hidden bg-[#0f172a] rounded-2xl shadow-2xl p-3 border border-white/5">
                            <MobileMatrixView
                                rows={locationPolicyMatrix}
                                headers={activeLocations}
                                headerStats={(h) => getAttributeHeaderStats(h, 'area')}
                                onSopDrill={(sop) => onDrillDown?.({ type: 'sop', value: sop, label: `SOP: ${sop}` })}
                                onHeaderDrill={(h) => onDrillDown?.({ type: 'location', value: h, label: `Location: ${h}` })}
                                onCellDrill={(h, sop, st) => { const statusMap: Record<string, 'OPEN' | 'RESOLVED' | 'IN_PROGRESS' | 'ALL'> = { open: 'OPEN', closed: 'RESOLVED', inflow: 'IN_PROGRESS', total: 'ALL' }; onDrillDown?.({ type: 'location', value: h, label: `Location: ${h} / SOP: ${sop}`, statusFilter: statusMap[st] || 'ALL' }); }}
                                headerType="location"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 5. Charts & Analytics Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                {/* Observation Trend */}
                <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 md:mb-10">
                        <div className="flex items-center gap-2 md:gap-3">
                            <h3 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Observation Trend</h3>
                            <span className="bg-emerald-100 text-emerald-700 text-[9px] md:text-[10px] font-black uppercase px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg">Live</span>
                        </div>
                    </div>
                    <div className="h-[220px] md:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                                <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                                <Bar yAxisId="left" dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} cursor="pointer" onClick={(data: any) => { if (data?.name) { onDrillDown?.({ type: 'month', value: data.name, label: `Trend: ${data.name} / All Observations` }); } }} />
                                <Line yAxisId="right" type="monotone" dataKey="closure" stroke="#f59e0b" strokeWidth={4} dot={{ r: 6, fill: '#fff', stroke: '#f59e0b', strokeWidth: 3 }} activeDot={{ r: 8, cursor: 'pointer', onClick: (e: any, payload: any) => { if (payload?.payload?.name) { onDrillDown?.({ type: 'month', value: payload.payload.name, label: `Trend: ${payload.payload.name} / Closed`, statusFilter: 'RESOLVED' }); } } }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ageing Intelligence */}
                <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col relative overflow-hidden">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
                        <div className="flex items-center gap-2 md:gap-3">
                            <h3 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">Ageing Analytics</h3>
                            <span className="bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg">Advanced</span>
                        </div>
                        <div className="flex bg-slate-100 p-0.5 md:p-1 rounded-xl md:rounded-2xl border border-slate-200 shadow-inner">
                            {(['DEPARTMENT', 'LOCATION', 'RESPONSIBILITY'] as const).map(slice => (
                                <button key={slice} onClick={() => setAgeingSlice(slice)} className={`px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-wider md:tracking-widest transition-all ${ageingSlice === slice ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400'}`}>{slice === 'RESPONSIBILITY' ? 'RESP' : slice}</button>
                            ))}
                        </div>
                    </div>
                    {/* Desktop Chart */}
                    <div className="hidden md:block h-[350px] w-full mb-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={transformedAgeingData} layout="vertical" margin={{ left: 160 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="ageing" type="category" axisLine={false} tickLine={false} tick={<CustomAgeingTick fullData={transformedAgeingData} />} width={150} />
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                                {ageingCategories.map((cat, idx) => <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={COLORS[idx % COLORS.length]} barSize={40} cursor="pointer" onClick={(data: any) => { const filterType = ageingSlice === 'DEPARTMENT' ? 'department' : ageingSlice === 'LOCATION' ? 'location' : 'responsibility'; onDrillDown?.({ type: filterType as any, value: cat, label: `${ageingSlice}: ${cat} / Age: ${data?.ageing || ''}` }); }} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    {/* Mobile Chart */}
                    <div className="md:hidden w-full mb-4">
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={transformedAgeingData} layout="vertical" margin={{ left: 70, right: 8, top: 4, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="ageing" type="category" axisLine={false} tickLine={false} tick={<MobileAgeingTick fullData={transformedAgeingData} />} width={65} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }} />
                                    {ageingCategories.map((cat, idx) => <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={COLORS[idx % COLORS.length]} barSize={24} cursor="pointer" onClick={(data: any) => { const filterType = ageingSlice === 'DEPARTMENT' ? 'department' : ageingSlice === 'LOCATION' ? 'location' : 'responsibility'; onDrillDown?.({ type: filterType as any, value: cat, label: `${ageingSlice}: ${cat} / Age: ${data?.ageing || ''}` }); }} />)}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3 px-1">
                            {ageingCategories.map((cat, idx) => (
                                <span key={cat} className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase">
                                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    {cat.length > 12 ? cat.substring(0, 12) + '...' : cat}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Keyword Intelligence */}
                <div className="bg-white p-4 md:p-10 rounded-2xl md:rounded-[3.5rem] border border-slate-200 shadow-xl flex flex-col relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4 md:mb-10">
                        <div>
                            <h3 className="text-base md:text-2xl font-black text-slate-900 uppercase tracking-tight">Keyword Intelligence</h3>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider md:tracking-widest mt-0.5 md:mt-1">Analysis of Triggers</p>
                        </div>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-4 md:gap-10">
                        <div className="flex-1 h-[220px] md:h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={semanticData} layout="vertical" margin={{ left: 40 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontBold: true, fill: '#64748b' }} width={120} />
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '10px'}} />
                                    <Bar dataKey="val" radius={[0, 10, 10, 0]} barSize={24} cursor="pointer" onClick={(data: any) => { if (data?.name) { onDrillDown?.({ type: 'sop', value: data.name, label: `Keyword: ${data.name}` }); } }}>{semanticData.map((entry, index) => <Cell key={index} fill={entry.val > 10 ? '#ef4444' : '#6366f1'} />)}</Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Pie Reporting Share */}
                <div className="bg-[#0f172a] p-4 md:p-10 rounded-2xl md:rounded-[3.5rem] shadow-2xl flex flex-col relative overflow-hidden">
                    <div className="mb-4 md:mb-10 relative z-10">
                        <h3 className="text-base md:text-2xl font-black text-white uppercase tracking-tight leading-none mb-1 md:mb-2">Dept Reporting Share</h3>
                        <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider md:tracking-widest mt-1 md:mt-2">Volume by Vertical</p>
                    </div>
                    <div className="flex flex-col lg:flex-row items-center gap-6 md:gap-12 flex-1 relative z-10">
                        <div className="relative w-[200px] h-[200px] md:w-[280px] md:h-[280px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart><Pie data={deptShare} innerRadius={55} outerRadius={80} paddingAngle={8} dataKey="value">{deptShare.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie></PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-3xl font-black text-white leading-none">{activeData.length}</span><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Logs</span></div>
                        </div>
                        <div className="flex-1 space-y-6 w-full text-left max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {deptShare.map((dept, i) => (
                                <div key={i} className="group cursor-pointer" onClick={() => onDrillDown?.({ type: 'department', value: dept.name, label: `Department: ${dept.name}` })}>
                                    <div className="flex justify-between items-center mb-1.5"><div className="flex items-center gap-3 min-w-0"><div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }} /><span className="text-[11px] font-black text-slate-300 uppercase tracking-wide truncate group-hover:text-white transition-colors">{dept.name}</span></div><span className="text-[11px] font-black text-slate-500 whitespace-nowrap">{dept.value} OBS</span></div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full transition-all duration-1000" style={{ backgroundColor: dept.color, width: `${(dept.value / activeData.length) * 100}%` }} /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 6. Employee Performance Cards */}
            <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4 px-2">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><Users size={16} className="md:hidden" /><Users size={20} className="hidden md:block" /></div>
                        <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em]">Employee Performance</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={employeeSearch}
                                onChange={(e) => setEmployeeSearch(e.target.value)}
                                className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase focus:outline-none focus:border-indigo-400 transition-all shadow-sm w-[180px]"
                            />
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                            <button onClick={() => setEmployeeSort('shared')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${employeeSort === 'shared' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>By Shared</button>
                            <button onClick={() => setEmployeeSort('resolved')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${employeeSort === 'resolved' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>By Resolved</button>
                        </div>
                        <button
                            onClick={() => setIsEmployeeExpanded(!isEmployeeExpanded)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEmployeeExpanded ? 'bg-rose-50 text-rose-600 shadow-md border border-rose-100' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                        >
                            {isEmployeeExpanded ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                        </button>
                    </div>
                </div>

                {isEmployeeExpanded && (
                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-500">
                        {employeeData.length === 0 && (
                            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <Users size={40} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No employees found</p>
                            </div>
                        )}
                        {employeeData.map((emp, idx) => {
                            const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                            const total = emp.shared;
                            const resolveRate = total > 0 ? Math.round((emp.resolved / total) * 100) : 0;
                            const rank = idx + 1;

                            return (
                                <div 
                                    key={emp.name} 
                                    onClick={() => onDrillDown?.({ type: 'employee', value: emp.name, label: `Employee: ${emp.name}` })}
                                    className="bg-white rounded-2xl lg:rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all group px-4 py-3 md:px-6 md:py-4 cursor-pointer active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-3 md:gap-5">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm md:text-base font-black shadow-lg group-hover:scale-105 transition-transform">
                                                {initials}
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${resolveRate >= 70 ? 'bg-emerald-500' : resolveRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                            {rank <= 3 && (
                                                <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 border-white shadow-sm ${rank === 1 ? 'bg-amber-400 text-amber-900' : rank === 2 ? 'bg-slate-300 text-slate-700' : 'bg-orange-400 text-orange-900'}`}>
                                                    {rank}
                                                </div>
                                            )}
                                        </div>

                                        {/* Name + Role */}
                                        <div className="min-w-0 flex-shrink md:min-w-[160px]">
                                            <h4 className="text-sm md:text-base font-black text-slate-900 truncate leading-tight">{emp.name}</h4>
                                            <p className="text-[10px] md:text-[11px] font-bold text-indigo-500 uppercase tracking-wider truncate">{emp.department}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 hidden md:block">ID: EMP{(1000 + idx).toString().padStart(4, '0')}</p>
                                        </div>

                                        {/* Stats - Desktop */}
                                        <div className="hidden md:flex items-center gap-6 flex-1 justify-end">
                                            <div className="flex flex-col items-center px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 min-w-[90px]">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Shared</span>
                                                <span className="text-xl font-black text-indigo-600 leading-tight">{emp.shared}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 min-w-[90px]">
                                                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Resolved</span>
                                                <span className="text-xl font-black text-emerald-600 leading-tight">{emp.resolved}</span>
                                            </div>
                                            <div className="flex flex-col items-center min-w-[80px]">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rate</span>
                                                <span className={`text-xl font-black leading-tight ${resolveRate >= 70 ? 'text-emerald-500' : resolveRate >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>{resolveRate}%</span>
                                            </div>

                                            <div className="hidden lg:flex flex-col gap-1 text-right min-w-[160px]">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <Building size={12} className="text-slate-300" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[140px]">{emp.regional || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 justify-end">
                                                    <Building2 size={12} className="text-slate-300" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[140px]">{emp.unit || 'N/A'}</span>
                                                </div>
                                            </div>

                                            <div className="hidden lg:block">
                                                <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${resolveRate >= 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : resolveRate >= 40 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                                    {resolveRate >= 70 ? 'Top Performer' : resolveRate >= 40 ? 'Active' : 'Needs Attention'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stats - Mobile */}
                                        <div className="flex md:hidden items-center gap-2 ml-auto">
                                            <div className="flex flex-col items-center px-2.5 py-1.5 bg-indigo-50 rounded-lg">
                                                <span className="text-[7px] font-black text-indigo-400 uppercase">Shared</span>
                                                <span className="text-base font-black text-indigo-600 leading-tight">{emp.shared}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2.5 py-1.5 bg-emerald-50 rounded-lg">
                                                <span className="text-[7px] font-black text-emerald-400 uppercase">Resolved</span>
                                                <span className="text-base font-black text-emerald-600 leading-tight">{emp.resolved}</span>
                                            </div>
                                            <div className="flex flex-col items-center px-2 py-1.5">
                                                <span className="text-[7px] font-black text-slate-400 uppercase">Rate</span>
                                                <span className={`text-base font-black leading-tight ${resolveRate >= 70 ? 'text-emerald-500' : resolveRate >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>{resolveRate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {scopeRadarData && (
                <div className="space-y-4 md:space-y-6">
                    <div className="flex items-center gap-2 md:gap-4 px-2">
                        <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-inner shrink-0 ${scopeRadarData.icon === 'globe' ? 'bg-violet-50 text-violet-600' : scopeRadarData.icon === 'building' ? 'bg-cyan-50 text-cyan-600' : 'bg-teal-50 text-teal-600'}`}>
                            {scopeRadarData.icon === 'globe' ? <Globe size={16} className="md:hidden" /> : scopeRadarData.icon === 'building' ? <Building size={16} className="md:hidden" /> : <Building2 size={16} className="md:hidden" />}
                            {scopeRadarData.icon === 'globe' ? <Globe size={20} className="hidden md:block" /> : scopeRadarData.icon === 'building' ? <Building size={20} className="hidden md:block" /> : <Building2 size={20} className="hidden md:block" />}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em]">{scopeRadarData.title}</h3>
                            <p className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase tracking-widest">{scopeRadarData.subtitle}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 md:p-8">
                            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-4 md:mb-6">
                                {scopeRadarData.axes.map((axis, i) => (
                                    <button
                                        key={axis}
                                        onClick={() => onDrillDown?.({ type: scopeRadarData.drillType as any, value: axis, label: `${scopeRadarData.drillType === 'unit' ? 'Unit' : 'Department'}: ${axis}` })}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-wider border hover:shadow-md transition-all cursor-pointer"
                                        style={{ borderColor: scopeRadarData.colors[i % scopeRadarData.colors.length] + '40', color: scopeRadarData.colors[i % scopeRadarData.colors.length], backgroundColor: scopeRadarData.colors[i % scopeRadarData.colors.length] + '10' }}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: scopeRadarData.colors[i % scopeRadarData.colors.length] }} />
                                        {axis}
                                    </button>
                                ))}
                            </div>

                            <div className="w-full" style={{ height: Math.max(350, scopeRadarData.radarPoints.length * 30 + 100) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={scopeRadarData.radarPoints}>
                                        <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                                        <PolarAngleAxis
                                            dataKey="policy"
                                            tick={{ fill: '#475569', fontSize: 9, fontWeight: 800 }}
                                        />
                                        <PolarRadiusAxis
                                            angle={90}
                                            domain={[0, scopeRadarData.maxVal]}
                                            tick={{ fill: '#94a3b8', fontSize: 8 }}
                                            tickCount={5}
                                        />
                                        {scopeRadarData.axes.map((axis, i) => (
                                            <Radar
                                                key={axis}
                                                name={axis}
                                                dataKey={axis}
                                                stroke={scopeRadarData.colors[i % scopeRadarData.colors.length]}
                                                fill={scopeRadarData.colors[i % scopeRadarData.colors.length]}
                                                fillOpacity={0.08}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: scopeRadarData.colors[i % scopeRadarData.colors.length], strokeWidth: 0 }}
                                            />
                                        ))}
                                        <Legend
                                            wrapperStyle={{ fontSize: '10px', fontWeight: 900 }}
                                            iconType="circle"
                                            iconSize={8}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '16px', padding: '12px 16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                                            labelStyle={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                            itemStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700, padding: '2px 0' }}
                                            formatter={(value: any, name: string) => [`${value} observations`, name]}
                                            labelFormatter={(label: string) => {
                                                const point = scopeRadarData.radarPoints.find((p: any) => p.policy === label);
                                                return point?.fullPolicy || label;
                                            }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 bg-slate-50/50 px-4 md:px-8 py-3 md:py-4">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[500px]">
                                    <thead>
                                        <tr>
                                            <th className="pb-2 pr-4 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Policy / SOP</th>
                                            {scopeRadarData.axes.map((axis, i) => (
                                                <th key={axis} className="pb-2 px-2 text-center text-[8px] md:text-[9px] font-black uppercase tracking-wider" style={{ color: scopeRadarData.colors[i % scopeRadarData.colors.length] }}>{axis}</th>
                                            ))}
                                            <th className="pb-2 pl-2 text-center text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {scopeRadarData.radarPoints.map((point: any, pi: number) => {
                                            const rowTotal = scopeRadarData.axes.reduce((sum: number, a: string) => sum + (point[a] || 0), 0);
                                            return (
                                                <tr key={pi} className="hover:bg-white transition-colors">
                                                    <td className="py-2 pr-4 text-[9px] md:text-[10px] font-bold text-slate-700 max-w-[200px] truncate" title={point.fullPolicy}>{point.fullPolicy}</td>
                                                    {scopeRadarData.axes.map((axis: string, ai: number) => (
                                                        <td key={axis} className="py-2 px-2 text-center">
                                                            <span className={`inline-block min-w-[28px] px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] font-black ${point[axis] > 0 ? 'bg-slate-900 text-white' : 'text-slate-300'}`}>
                                                                {point[axis] || 0}
                                                            </span>
                                                        </td>
                                                    ))}
                                                    <td className="py-2 pl-2 text-center">
                                                        <span className="inline-block min-w-[28px] px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] font-black bg-indigo-50 text-indigo-700">{rowTotal}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. Granular Audit Records (Radar Cards) */}
            <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-2 md:gap-4 px-2">
                    <div className="p-1.5 md:p-2 bg-indigo-50 text-indigo-600 rounded-lg md:rounded-xl shadow-inner shrink-0"><List size={16} className="md:hidden" /><List size={20} className="hidden md:block" /></div>
                    <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider md:tracking-[0.25em]">Responsibility Audit Records</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {granularAuditData.map((area, idx) => (
                        <GranularAuditCard key={idx} areaData={area} onDrillDown={onDrillDown} />
                    ))}
                </div>
            </div>

            {/* System Integrity Footer */}
            <div className="p-5 md:p-10 bg-slate-900 rounded-2xl md:rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                <div className="flex items-center gap-4 md:gap-8 relative z-10">
                    <div className="p-3 md:p-5 bg-white/5 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-inner group cursor-pointer hover:bg-white/10 transition-all shrink-0">
                        <ShieldCheck size={24} className="text-indigo-400 group-hover:scale-110 transition-transform md:hidden" />
                        <ShieldCheck size={40} className="text-indigo-400 group-hover:scale-110 transition-transform hidden md:block" />
                    </div>
                    <div className="space-y-1 md:space-y-2 text-left">
                        <h5 className="text-sm md:text-xl font-black uppercase tracking-wider md:tracking-[0.4em] leading-none">Security Protocol</h5>
                        <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-wider md:tracking-widest max-w-lg leading-relaxed">
                            Analytics from <span className="text-indigo-400">Digital Immutable Logs</span>. 
                            <span className="hidden md:inline"> Data integrity verified via System Hash and ISO 22000 Authentication layer.</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-4 relative z-10 w-full md:w-auto">
                    <button className="flex-1 md:flex-none px-8 md:px-14 py-3 md:py-5 bg-indigo-600 hover:bg-indigo-50 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-4">
                        Synchronize <RefreshCw size={16} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ObservationAnalytics;