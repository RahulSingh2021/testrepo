
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Award, 
  ShieldCheck, 
  Users, 
  Info, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  Filter,
  ArrowRight,
  Target,
  Zap,
  Wrench,
  Truck,
  Droplets,
  Flame,
  LayoutGrid,
  Activity,
  History,
  GraduationCap,
  Play,
  FileCheck,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Hourglass,
  Building2,
  Briefcase,
  Utensils,
  UserCheck,
  Shield,
  FileDigit,
  Globe,
  Clock,
  PlusCircle,
  Plus,
  ChevronRight,
  Sparkles,
  Link as LinkIcon,
  BrainCircuit,
  Terminal,
  Grid3X3,
  User,
  TrendingUp,
  CalendarClock,
  ZapOff,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  Package,
  Download,
  FileArchive,
  Loader2,
  Check
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Entity, HierarchyScope } from '../types';

// --- Types for Granular Mapping ---

interface RequiredTraining {
    id: string;
    name: string;
    isoClause: string;
    frequency: 'Monthly' | 'Quarterly' | 'Yearly' | 'Induction' | 'Mandatory Refresher';
    type: 'Universal' | 'Specialized' | 'Managerial' | 'Reactive';
    isAISuggested?: boolean;
    ncReference?: string;
    triggerReason?: string;
    isCoreIso?: boolean; // New flag for Auditor Mode
}

interface CategoryMapping {
    category: string; // Management, Staff, Contractor
    requiredTrainings: string[]; // IDs of RequiredTraining
}

interface DepartmentTNI {
    department: string;
    icon: any;
    color: string;
    description: string;
    mappings: CategoryMapping[];
}

interface StaffProficiency {
    name: string;
    role: string;
    skills: Record<string, number>; // Training ID -> Proficiency (0-5)
}

// --- ISO 22000 Training Catalog ---

const TRAINING_CATALOG: Record<string, RequiredTraining> = {
    'hygiene': { id: 'hygiene', name: 'Personal Hygiene & PPE', isoClause: '8.2.4', frequency: 'Monthly', type: 'Universal', isCoreIso: true },
    'haccp-basic': { id: 'haccp-basic', name: 'HACCP Principles', isoClause: '8.5.2', frequency: 'Yearly', type: 'Universal', isCoreIso: true },
    'haccp-adv': { id: 'haccp-adv', name: 'Advanced FSMS Planning', isoClause: '5.3.2', frequency: 'Yearly', type: 'Managerial', isCoreIso: true },
    'audit': { id: 'audit', name: 'Internal Audit Protocol', isoClause: '9.2', frequency: 'Yearly', type: 'Managerial', isCoreIso: true },
    'allergen': { id: 'allergen', name: 'Allergen Control (PRP)', isoClause: '8.2', frequency: 'Quarterly', type: 'Specialized', isCoreIso: true },
    'temp': { id: 'temp', name: 'Thermal Processing (CCP)', isoClause: '8.2.4.2', frequency: 'Quarterly', type: 'Specialized', isCoreIso: true },
    'chem': { id: 'chem', name: 'Chemical Safety & Titration', isoClause: '8.2.4.b', frequency: 'Quarterly', type: 'Specialized' },
    'calib': { id: 'calib', name: 'Calibration Awareness', isoClause: '7.1.5', frequency: 'Yearly', type: 'Specialized', isCoreIso: true },
    'pest': { id: 'pest', name: 'IPM Awareness', isoClause: '8.2.4.e', frequency: 'Yearly', type: 'Universal' },
    'defense': { id: 'defense', name: 'Food Defense/Fraud', isoClause: '8.2', frequency: 'Yearly', type: 'Managerial', isCoreIso: true },
    'refresher-ccp': { 
        id: 'refresher-ccp', 
        name: 'Mandatory Refresher: CCP Monitoring', 
        isoClause: '10.2', 
        frequency: 'Mandatory Refresher', 
        type: 'Reactive',
        isAISuggested: true,
        ncReference: 'NC-2024-05-18-CHILL',
        triggerReason: 'Triggered by 3 consecutive temperature deviations in Butchery Chiller Logs.',
        isCoreIso: true
    }
};

const DEPARTMENTAL_TNI: DepartmentTNI[] = [
    {
        department: "Butchery (Reactive)",
        icon: Flame,
        color: "bg-rose-600",
        description: "High-risk processing unit currently flagged by System Intelligence.",
        mappings: [
            { category: "Staff", requiredTrainings: ['hygiene', 'refresher-ccp'] },
            { category: "Management", requiredTrainings: ['haccp-adv', 'audit', 'refresher-ccp'] }
        ]
    },
    {
        department: "Main Kitchen",
        icon: Utensils,
        color: "bg-orange-600",
        description: "High-risk production nodes requiring strict CCP and PRP adherence.",
        mappings: [
            { category: "Management", requiredTrainings: ['haccp-adv', 'audit', 'defense', 'temp', 'hygiene'] },
            { category: "Permanent Staff", requiredTrainings: ['hygiene', 'haccp-basic', 'temp', 'allergen', 'pest'] },
            { category: "Contractors", requiredTrainings: ['hygiene', 'pest'] }
        ]
    },
    {
        department: "Engineering / Maintenance",
        icon: Wrench,
        color: "bg-blue-600",
        description: "Infrastructure support focusing on sanitary design and calibration.",
        mappings: [
            { category: "Management", requiredTrainings: ['haccp-adv', 'audit', 'calib'] },
            { category: "Permanent Staff", requiredTrainings: ['hygiene', 'calib', 'chem', 'haccp-basic'] },
            { category: "Contractors", requiredTrainings: ['hygiene', 'chem'] }
        ]
    },
    {
        department: "Stores & Receiving",
        icon: Truck,
        color: "bg-emerald-600",
        description: "Supply chain security, cold chain maintenance, and FIFO protocols.",
        mappings: [
            { category: "Management", requiredTrainings: ['haccp-adv', 'audit', 'defense'] },
            { category: "Permanent Staff", requiredTrainings: ['hygiene', 'haccp-basic', 'pest', 'defense'] },
            { category: "Contractors", requiredTrainings: ['hygiene'] }
        ]
    },
    {
        department: "Sanitation / Cleaning",
        icon: Droplets,
        color: "bg-cyan-600",
        description: "Chemical handling, titration, and biofilm elimination protocols.",
        mappings: [
            { category: "Management", requiredTrainings: ['audit', 'chem'] },
            { category: "Permanent Staff", requiredTrainings: ['hygiene', 'chem', 'pest'] },
            { category: "Contractors", requiredTrainings: ['hygiene', 'chem'] }
        ]
    }
];

// --- Mock Data for Heatmap ---
const MOCK_STAFF_PROFICIENCY: Record<string, StaffProficiency[]> = {
    "Main Kitchen": [
        { name: "John Doe", role: "Head Chef", skills: { 'hygiene': 5, 'haccp-basic': 5, 'haccp-adv': 4, 'temp': 5, 'allergen': 4, 'pest': 3 } },
        { name: "Sarah Connor", role: "Sous Chef", skills: { 'hygiene': 4, 'haccp-basic': 5, 'haccp-adv': 2, 'temp': 5, 'allergen': 5, 'pest': 4 } },
        { name: "Mike Ross", role: "CDP", skills: { 'hygiene': 5, 'haccp-basic': 3, 'haccp-adv': 1, 'temp': 4, 'allergen': 2, 'pest': 2 } },
        { name: "Alex Tech", role: "Commis I", skills: { 'hygiene': 3, 'haccp-basic': 2, 'haccp-adv': 0, 'temp': 2, 'allergen': 1, 'pest': 1 } },
        { name: "Maria Host", role: "Commis II", skills: { 'hygiene': 2, 'haccp-basic': 1, 'haccp-adv': 0, 'temp': 1, 'allergen': 1, 'pest': 1 } },
        { name: "Mike Cook", role: "Line Cook", skills: { 'hygiene': 4, 'haccp-basic': 2, 'haccp-adv': 0, 'temp': 3, 'allergen': 0, 'pest': 1 } },
    ],
    "Butchery (Reactive)": [
        { name: "James Smith", role: "Lead Butcher", skills: { 'hygiene': 5, 'refresher-ccp': 5, 'haccp-adv': 3, 'audit': 2 } },
        { name: "Robert Jones", role: "Butcher", skills: { 'hygiene': 4, 'refresher-ccp': 1, 'haccp-adv': 0, 'audit': 0 } },
        { name: "Patricia Wilson", role: "Junior Butcher", skills: { 'hygiene': 3, 'refresher-ccp': 0, 'haccp-adv': 0, 'audit': 0 } },
    ]
};

// --- Predictive Analytics Mock Data ---

const BURNDOWN_DATA = [
    { day: 'May 01', gaps: 42, projected: 42 },
    { day: 'May 05', gaps: 38, projected: 38 },
    { day: 'May 10', gaps: 31, projected: 31 },
    { day: 'May 15', gaps: 24, projected: 24 },
    { day: 'May 20', gaps: 18, projected: 18 },
    { day: 'May 25', gaps: null, projected: 12 },
    { day: 'May 30', gaps: null, projected: 5 },
    { day: 'Jun 05', gaps: null, projected: 0 },
];

const RISK_OF_EXPIRY = [
    { name: 'Personal Hygiene', percentage: 48, count: 12, risk: 'High' },
    { name: 'HACCP Principles', percentage: 42, count: 8, risk: 'High' },
    { name: 'Allergen Control', percentage: 25, count: 5, risk: 'Medium' },
    { name: 'Chemical Safety', percentage: 15, count: 3, risk: 'Low' },
];

const StaffCompetencyMapping: React.FC<{ entities: Entity[], currentScope: HierarchyScope, userRootId?: string | null }> = ({ entities, currentScope, userRootId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedDept, setExpandedDept] = useState<string | null>("Butchery (Reactive)");
    const [activeTab, setActiveTab] = useState<'mapping' | 'matrix' | 'heatmap' | 'verification'>('mapping');
    const [selectedHeatmapDept, setSelectedHeatmapDept] = useState<string>("Main Kitchen");
    const [showPredictive, setShowPredictive] = useState(true);
    
    // Suggestion 7 State: Auditor Mode
    const [isAuditorMode, setIsAuditorMode] = useState(false);
    const [isBundling, setIsBundling] = useState(false);

    const filteredTNI = useMemo(() => {
        let base = DEPARTMENTAL_TNI;
        
        // Filter logic for Auditor Mode (Only Core ISO requirements)
        if (isAuditorMode) {
            base = base.map(dept => ({
                ...dept,
                mappings: dept.mappings.map(map => ({
                    ...map,
                    requiredTrainings: map.requiredTrainings.filter(tid => TRAINING_CATALOG[tid].isCoreIso)
                })).filter(map => map.requiredTrainings.length > 0)
            })).filter(dept => dept.mappings.length > 0);
        }

        return base.filter(d => 
            d.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, isAuditorMode]);

    const reactiveGaps = useMemo(() => {
        return Object.values(TRAINING_CATALOG).filter(t => t.isAISuggested).length;
    }, []);

    const heatmapStaff = useMemo(() => {
        return MOCK_STAFF_PROFICIENCY[selectedHeatmapDept] || [];
    }, [selectedHeatmapDept]);

    const heatmapModules = useMemo(() => {
        const deptTni = filteredTNI.find(d => d.department === selectedHeatmapDept);
        if (!deptTni) return [];
        const allIds = new Set<string>();
        deptTni.mappings.forEach(m => m.requiredTrainings.forEach(id => allIds.add(id)));
        return Array.from(allIds).map(id => TRAINING_CATALOG[id]);
    }, [selectedHeatmapDept, filteredTNI]);

    const getProficiencyColor = (level: number) => {
        if (level === 0) return 'bg-rose-500 text-white';
        if (level === 1) return 'bg-indigo-100 text-indigo-900';
        if (level === 2) return 'bg-indigo-200 text-indigo-900';
        if (level === 3) return 'bg-indigo-400 text-white';
        if (level === 4) return 'bg-indigo-600 text-white';
        if (level === 5) return 'bg-indigo-900 text-white';
        return 'bg-slate-50 text-slate-300';
    };

    const getProficiencyLabel = (level: number) => {
        if (level === 0) return 'Gap';
        if (level === 1) return 'Novice';
        if (level === 2) return 'Beginner';
        if (level === 3) return 'Intermediate';
        if (level === 4) return 'Advanced';
        if (level === 5) return 'Expert';
        return 'N/A';
    };

    const handleGenerateBundle = () => {
        setIsBundling(true);
        setTimeout(() => {
            setIsBundling(false);
            alert("External Audit Evidence Bundle Prepared:\n1. Competency Matrix.zip\n2. Trainer Credentials.zip\n3. Verification Samples.zip\n\nReady for export.");
        }, 2000);
    };

    return (
        <div className={`space-y-8 animate-in fade-in duration-700 pb-20 relative ${isAuditorMode ? 'auditor-view' : ''}`}>
            
            {/* Suggestion 7: Auditor View Watermark Overlay */}
            {isAuditorMode && (
                <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden opacity-[0.03]">
                    <div className="text-[12rem] font-black text-slate-900 -rotate-45 whitespace-nowrap">
                        OFFICIAL AUDIT RECORD • ISO 22000
                    </div>
                </div>
            )}

            {/* Header Command Terminal */}
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-30" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full blur-[100px] opacity-20" />
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex items-center gap-6">
                        <div className={`p-5 rounded-[2rem] shadow-2xl transition-all duration-500 ring-4 ring-white/5 ${isAuditorMode ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
                            {isAuditorMode ? <ShieldCheck size={40} strokeWidth={2.5} /> : <GraduationCap size={40} strokeWidth={2.5} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">TNI <span className={isAuditorMode ? 'text-emerald-400' : 'text-indigo-400'}>Registry</span></h2>
                                {isAuditorMode && (
                                    <span className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                        Auditor Mode Active
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-full text-[10px] font-black text-indigo-200 uppercase tracking-widest backdrop-blur-md">
                                    <Globe size={12} className="text-emerald-400" /> ISO 22000 Clause 7.2
                                </span>
                                <div className="h-3 w-px bg-white/20" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Training Need Identification Hub</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 w-full lg:w-auto overflow-x-auto hide-scrollbar pb-2">
                        {/* Suggestion 7: Auditor Mode Toggle */}
                        <div 
                            onClick={() => setIsAuditorMode(!isAuditorMode)}
                            className={`p-5 rounded-[2.5rem] min-w-[240px] backdrop-blur-md relative group cursor-pointer transition-all border flex items-center justify-between gap-4 ${isAuditorMode ? 'bg-emerald-600 border-emerald-400 shadow-xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                        >
                            <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest block mb-1">Evidence Protocol</span>
                                <div className="text-2xl font-black text-white">{isAuditorMode ? 'Audit Ready' : 'One-Click'}</div>
                                <div className="text-[8px] font-bold uppercase mt-1 tracking-tighter opacity-80">Clause 7.2.f Verification Mode</div>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isAuditorMode ? 'bg-white text-emerald-600 shadow-inner' : 'bg-white/10 text-white'}`}>
                                <ShieldCheck size={24} className={isAuditorMode ? 'animate-bounce' : ''} />
                            </div>
                        </div>

                        {/* Toggle Predictive Insights */}
                        {!isAuditorMode && (
                            <button 
                                onClick={() => setShowPredictive(!showPredictive)}
                                className={`p-5 rounded-[2.5rem] min-w-[220px] backdrop-blur-md relative group transition-all border ${showPredictive ? 'bg-indigo-600 border-indigo-400 shadow-xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[9px] font-bold uppercase tracking-widest">System Intelligence</span>
                                    <TrendingUp size={14} className={showPredictive ? 'text-indigo-200' : 'text-indigo-400'} />
                                </div>
                                <div className="text-3xl font-black text-white">{showPredictive ? 'Active' : 'Show'}</div>
                                <div className="text-[8px] font-bold uppercase mt-1 tracking-tighter opacity-80">Predictive Compliance Radar</div>
                            </button>
                        )}

                        <div className="bg-white/5 border border-white/10 p-5 rounded-[2.5rem] min-w-[180px] backdrop-blur-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Execution</span>
                                <Activity size={14} className="text-emerald-400" />
                            </div>
                            <div className="text-3xl font-black text-white">91%</div>
                            <div className="text-[8px] font-bold text-emerald-400 uppercase mt-1 tracking-tighter">Global Adherence</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Suggestion 7: Auditor Evidence Toolbar */}
            {isAuditorMode && (
                <div className="bg-emerald-600 p-6 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl">
                            <FileArchive size={24} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">One-Click Evidence Bundle</h3>
                            <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1">Pre-validated ISO 22000:2018 Documentation Pack</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleGenerateBundle}
                        disabled={isBundling}
                        className={`px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${isBundling ? 'bg-white/50 cursor-wait' : 'bg-white text-emerald-700 hover:bg-emerald-50 shadow-emerald-700/20'}`}
                    >
                        {isBundling ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Compiling Node Registry...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Generate Evidence Bundle
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* PREDICTIVE ANALYTICS DASHBOARD */}
            {showPredictive && !isAuditorMode && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-top-4 duration-700">
                    
                    {/* Compliance Velocity & Burn-down */}
                    <div className="lg:col-span-7 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                            <Zap size={200} />
                        </div>
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Training Velocity</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Closure Rate: <span className="text-indigo-600">2.4 Gaps/Day</span></p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Target Compliance</p>
                                <span className="text-2xl font-black text-emerald-600 uppercase">Jun 05</span>
                            </div>
                        </div>

                        <div className="h-[240px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={BURNDOWN_DATA}>
                                    <defs>
                                        <linearGradient id="burndownGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 800, fill: '#94a3b8'}} />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 900, textTransform: 'uppercase', fontSize: '10px' }}
                                    />
                                    <Area type="monotone" dataKey="gaps" stroke="#4f46e5" strokeWidth={4} fill="url(#burndownGradient)" name="Actual Gaps" />
                                    <Area type="monotone" dataKey="projected" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="none" name="AI Projection" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Risk of Expiry Radar */}
                    <div className="lg:col-span-5 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-inner border border-rose-100">
                                <CalendarClock size={24} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Risk of Expiry</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Projected Certificate Churn (60 Days)</p>
                            </div>
                        </div>

                        <div className="space-y-4 flex-1">
                            {RISK_OF_EXPIRY.map((item, idx) => (
                                <div key={idx} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:bg-white hover:border-rose-200 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${item.risk === 'High' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                                                {item.percentage}%
                                            </div>
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.name}</span>
                                        </div>
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${item.risk === 'High' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {item.risk} Risk
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${item.risk === 'High' ? 'bg-rose-600' : 'bg-amber-500'}`} 
                                            style={{ width: `${item.percentage}%` }} 
                                        />
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.count} Personnel Impacted</span>
                                        <button className="text-[8px] font-black text-indigo-600 uppercase hover:underline">Schedule Refresher</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter and Control Strip */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto hide-scrollbar">
                    <button 
                        onClick={() => setActiveTab('mapping')} 
                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'mapping' ? (isAuditorMode ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-md border border-slate-200') : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Departmental Maps
                    </button>
                    <button 
                        onClick={() => setActiveTab('heatmap')} 
                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'heatmap' ? (isAuditorMode ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-md border border-slate-200') : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Skill Heatmap
                    </button>
                    <button 
                        onClick={() => setActiveTab('matrix')} 
                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'matrix' ? (isAuditorMode ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-md border border-slate-200') : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Full ISO Matrix
                    </button>
                    <button 
                        onClick={() => setActiveTab('verification')} 
                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'verification' ? (isAuditorMode ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-md border border-slate-200') : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Verification Logic
                    </button>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-80">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isAuditorMode ? 'text-emerald-400' : 'text-slate-400 group-focus-within:text-indigo-400'}`} />
                        <input 
                            type="text" 
                            placeholder="Search Node..." 
                            className={`w-full pl-12 pr-4 py-4 bg-white border-2 rounded-2xl text-xs font-black focus:outline-none transition-all shadow-inner uppercase tracking-wider text-slate-700 ${isAuditorMode ? 'focus:border-emerald-500 border-emerald-100' : 'focus:border-indigo-500 border-slate-100'}`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {activeTab === 'mapping' && (
                <div className="grid grid-cols-1 gap-6">
                    {filteredTNI.map((dept) => {
                        const Icon = dept.icon;
                        const isOpen = expandedDept === dept.department;
                        const isReactive = dept.department.includes('Reactive');

                        return (
                            <div key={dept.department} className={`bg-white rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${isOpen ? (isAuditorMode ? 'border-emerald-500 shadow-2xl' : isReactive ? 'border-rose-500 shadow-2xl scale-[1.01]' : 'border-indigo-500 shadow-2xl scale-[1.01]') : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                                {/* Card Header */}
                                <div 
                                    onClick={() => setExpandedDept(isOpen ? null : dept.department)}
                                    className="p-6 md:p-8 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className={`w-16 h-16 rounded-[1.75rem] text-white flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0 ${isAuditorMode ? 'bg-emerald-600' : dept.color}`}>
                                            <Icon size={32} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{dept.department}</h3>
                                                {isReactive && (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-[9px] font-black text-rose-600 uppercase tracking-widest animate-pulse">
                                                       <Sparkles size={12} /> System Reactive
                                                    </span>
                                                )}
                                                {isAuditorMode && (
                                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                                                       <ShieldCheck size={12} /> ISO Validated
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-slate-400 mt-2 italic">"{dept.description}"</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="hidden md:flex gap-2">
                                            {dept.mappings.map(m => (
                                                <span key={m.category} className="px-3 py-1 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-lg border border-slate-200">
                                                    {m.category}: {m.requiredTrainings.length}
                                                </span>
                                            ))}
                                        </div>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isOpen ? (isAuditorMode ? 'bg-emerald-600 text-white rotate-180' : isReactive ? 'bg-rose-600 text-white rotate-180' : 'bg-indigo-600 text-white rotate-180') : 'bg-slate-100 text-slate-400'}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Matrix */}
                                {isOpen && (
                                    <div className="bg-slate-50/50 border-t border-slate-100 p-8 animate-in slide-in-from-top-4 duration-500">
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                            {dept.mappings.map((map) => (
                                                <div key={map.category} className={`bg-white rounded-[2rem] border p-6 shadow-sm hover:shadow-md transition-shadow ${isAuditorMode ? 'border-emerald-100' : 'border-slate-200'}`}>
                                                    <div className="flex justify-between items-center mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-xl ${isAuditorMode ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}><Briefcase size={16}/></div>
                                                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{map.category}</h4>
                                                        </div>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${isAuditorMode ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>{map.requiredTrainings.length} Needs</span>
                                                    </div>
                                                    
                                                    <div className="space-y-3">
                                                        {map.requiredTrainings.map(tid => {
                                                            const train = TRAINING_CATALOG[tid];
                                                            return (
                                                                <div key={tid} className={`flex items-center justify-between p-3 border rounded-xl group/item transition-colors ${train.isAISuggested ? 'bg-rose-50 border-rose-100 hover:bg-rose-100' : isAuditorMode ? 'bg-white border-emerald-100 hover:border-emerald-400' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'}`}>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className={`text-[11px] font-bold uppercase truncate ${train.isAISuggested ? 'text-rose-900' : 'text-slate-700'}`}>{train.name}</p>
                                                                            {train.isAISuggested && (
                                                                                <div className="p-1 bg-rose-600 text-white rounded-md shadow-lg shadow-rose-200 animate-bounce">
                                                                                    <Sparkles size={10} fill="currentColor" />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 mt-1.5">
                                                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                                <Shield size={10} className={isAuditorMode ? "text-emerald-500" : "text-indigo-500"} /> Clause {train.isoClause} <span className="text-slate-200 mx-1">|</span> <Clock size={10} /> {train.frequency}
                                                                            </p>
                                                                            {train.isAISuggested && (
                                                                                <div className="flex flex-col gap-1 mt-1">
                                                                                    <p className="text-[9px] font-bold text-rose-600 italic">"{train.triggerReason}"</p>
                                                                                    <button className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline w-fit">
                                                                                        <LinkIcon size={10}/> View NC: {train.ncReference}
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {isAuditorMode ? (
                                                                        <button className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                                                                            <Download size={12} />
                                                                        </button>
                                                                    ) : (
                                                                        <button className={`p-1.5 rounded-lg transition-all ${train.isAISuggested ? 'bg-rose-600 text-white shadow-md' : 'text-slate-300 hover:text-indigo-600 hover:bg-white opacity-0 group-hover/item:opacity-100'}`}>
                                                                            {train.isAISuggested ? <Play size={12} fill="currentColor" /> : <PlusCircle size={16} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'heatmap' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 text-white rounded-2xl shadow-lg transition-colors duration-500 ${isAuditorMode ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                                <Grid3X3 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Proficiency Heatmap</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Visual Competency Matrix & Gap Identification</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Node:</label>
                            <select 
                                value={selectedHeatmapDept}
                                onChange={(e) => setSelectedHeatmapDept(e.target.value)}
                                className={`px-4 py-2.5 bg-slate-50 border-2 rounded-xl text-xs font-black uppercase outline-none transition-all shadow-inner ${isAuditorMode ? 'focus:border-emerald-400 border-emerald-50' : 'focus:border-indigo-400 border-slate-100'}`}
                            >
                                {filteredTNI.map(d => <option key={d.department} value={d.department}>{d.department}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className={`bg-white border rounded-[3rem] shadow-2xl overflow-hidden ${isAuditorMode ? 'border-emerald-100' : 'border-slate-200'}`}>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse border-spacing-0">
                                <thead>
                                    <tr className={isAuditorMode ? 'bg-emerald-950 text-white' : 'bg-slate-900 text-white'}>
                                        <th className={`p-6 sticky left-0 z-20 border-b border-white/5 w-[240px] shadow-[4px_0_10px_rgba(0,0,0,0.2)] ${isAuditorMode ? 'bg-emerald-950' : 'bg-slate-900'}`}>
                                            <div className="flex items-center gap-2">
                                                <User size={14} className={isAuditorMode ? 'text-emerald-400' : 'text-indigo-400'} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Staff Identification</span>
                                            </div>
                                        </th>
                                        {heatmapModules.map(mod => (
                                            <th key={mod.id} className="p-6 text-center border-b border-white/5 border-l border-white/5 min-w-[140px] group/h">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-[9px] font-black uppercase tracking-tighter opacity-50 group-hover/h:opacity-100 transition-opacity whitespace-nowrap">{mod.id}</span>
                                                    <span className="text-[10px] font-bold uppercase leading-tight line-clamp-2 h-8" title={mod.name}>{mod.name}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {heatmapStaff.map((staff, sIdx) => (
                                        <tr key={sIdx} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-6 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs shrink-0">{staff.name.charAt(0)}</div>
                                                    <div className="min-w-0">
                                                        <div className="font-black text-slate-800 text-sm uppercase tracking-tight truncate leading-none mb-1">{staff.name}</div>
                                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{staff.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            {heatmapModules.map(mod => {
                                                const level = staff.skills[mod.id] ?? -1;
                                                const isFailureRisk = heatmapStaff.filter(s => (s.skills[mod.id] ?? 0) >= 4).length === 1 && level >= 4;

                                                return (
                                                    <td key={mod.id} className="p-2 text-center border-r border-slate-50">
                                                        <div className="flex flex-col items-center gap-1.5 relative group/cell">
                                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm group-hover/cell:scale-110 ${getProficiencyColor(level)}`}>
                                                                <span className="text-lg font-black">{level === -1 ? '—' : level}</span>
                                                                {isFailureRisk && (
                                                                    <div className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-md text-amber-500" title="Single Point of Failure Risk">
                                                                        <AlertTriangle size={10} fill="currentColor" strokeWidth={3} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[7px] font-black uppercase text-slate-300 tracking-tighter opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                                                {getProficiencyLabel(level)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Heatmap Legend:</span>
                                    <div className="flex gap-1.5">
                                        {[0, 1, 2, 3, 4, 5].map(lvl => (
                                            <div key={lvl} className="flex items-center gap-1">
                                                <div className={`w-3 h-3 rounded-sm ${getProficiencyColor(lvl)}`} />
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">{lvl}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-6 w-px bg-slate-200" />
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={14} className="text-amber-500" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Single Point of Failure (SPOF) Detection Active</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-slate-50 transition-all">Print Matrix</button>
                                <button className={`px-8 py-2.5 text-white rounded-xl text-[10px] font-black uppercase shadow-lg transition-all active:scale-95 ${isAuditorMode ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'}`}>Analyze Gaps</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'matrix' && (
                <div className={`bg-white border rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 ${isAuditorMode ? 'border-emerald-100' : 'border-slate-200'}`}>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className={`${isAuditorMode ? 'bg-emerald-950' : 'bg-slate-900'} text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]`}>
                                    <th className="p-8 border-b border-white/5">Training Module</th>
                                    <th className="p-8 border-b border-white/5">ISO Clause</th>
                                    <th className="p-8 border-b border-white/5">Primary Frequency</th>
                                    <th className="p-8 border-b border-white/5">Type/Intelligence</th>
                                    <th className="p-8 border-b border-white/5 text-right">Reference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {Object.values(TRAINING_CATALOG)
                                    .filter(item => isAuditorMode ? item.isCoreIso : true)
                                    .map((item) => (
                                    <tr key={item.id} className={`group transition-all ${isAuditorMode ? 'hover:bg-emerald-50/20' : 'hover:bg-indigo-50/20'}`}>
                                        <td className="p-8">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${item.isAISuggested ? 'bg-rose-50 text-rose-600' : isAuditorMode ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    <GraduationCap size={20}/>
                                                </div>
                                                <span className={`text-sm font-black uppercase tracking-tight ${item.isAISuggested ? 'text-rose-700' : 'text-slate-800'}`}>{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase ${isAuditorMode ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                Clause {item.isoClause}
                                            </span>
                                        </td>
                                        <td className="p-8">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase">
                                                <Clock size={14} className={isAuditorMode ? 'text-emerald-500' : 'text-indigo-400'} /> {item.frequency}
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${item.isAISuggested ? 'bg-rose-600 text-white border-rose-500 shadow-md' : item.type === 'Universal' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                                    {item.isAISuggested ? 'AI RECTIFICATION' : item.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-8 text-right">
                                            <button className={`p-2 rounded-xl transition-all ${isAuditorMode ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}><FileDigit size={18}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'verification' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className={`${isAuditorMode ? 'bg-emerald-950' : 'bg-slate-900'} p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group`}>
                        <div className="absolute top-0 right-0 p-10 opacity-[0.05] group-hover:scale-110 transition-transform duration-1000"><Terminal size={200}/></div>
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className="p-4 bg-rose-600 rounded-[1.5rem] shadow-xl"><BrainCircuit size={28}/></div>
                            <div>
                                <h4 className="text-xl font-black uppercase tracking-tight">AI Reactive Logic</h4>
                                <p className="text-[9px] font-bold text-rose-300 uppercase tracking-widest mt-1">Closed-Loop Learning Integration</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-400 leading-relaxed italic relative z-10">
                            "The system monitors Digital Chiller Logs and Internal Audit NCs. If specific failure patterns are identified (e.g. 3 CCP temperature violations in 30 days), the system immediately generates a Mandatory Refresher task, overriding standard frequency schedules."
                        </p>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <button className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">View Logic Rules</button>
                            <button className="p-3 bg-rose-600 rounded-xl hover:bg-rose-500 transition-all"><ChevronRight size={18}/></button>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><History size={200}/></div>
                        <div className="flex items-center gap-4 mb-6 relative z-10">
                            <div className={`p-4 text-white rounded-[1.5rem] shadow-xl ${isAuditorMode ? 'bg-emerald-600' : 'bg-indigo-600'}`}><FileCheck size={28}/></div>
                            <div>
                                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Clause 7.2.f Compliance</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Verification of Effectiveness</p>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-500 leading-relaxed italic relative z-10">
                            "Organizations must evaluate the effectiveness of the training actions taken. Attendance is evidence of training; competency is evidence of skill. The system enforces a 30-day Post-Training Assessment cycle."
                        </p>
                        <div className="mt-8 flex items-center gap-3 relative z-10">
                            <button className={`px-6 py-3 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${isAuditorMode ? 'bg-emerald-700' : 'bg-slate-900 hover:bg-indigo-600'}`}>Audit Templates</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ISO Footer Note */}
            <div className={`p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 ${isAuditorMode ? 'bg-emerald-50 border border-emerald-100' : 'bg-indigo-50 border border-indigo-100'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg text-white ${isAuditorMode ? 'bg-emerald-600' : 'bg-indigo-600'}`}><Info size={20} /></div>
                    <p className={`text-[11px] font-bold uppercase tracking-widest leading-relaxed max-w-2xl ${isAuditorMode ? 'text-emerald-900' : 'text-indigo-900'}`}>
                        This matrix serves as primary documented evidence for Clause 7.2 (Competence) and Clause 10.2 (Corrective Action). Reactive logic ensures training is responsive to actual organizational performance.
                    </p>
                </div>
                <button className={`px-8 py-3 bg-white border-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${isAuditorMode ? 'border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>
                    Print Master Plan
                </button>
            </div>

        </div>
    );
}

export default StaffCompetencyMapping;
