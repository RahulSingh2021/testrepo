
"use client";

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Clock, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  FileText, 
  Download, 
  ArrowRight, 
  Thermometer, 
  Truck, 
  Warehouse, 
  Waves, 
  Flame, 
  Snowflake, 
  Utensils, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  History, 
  GitCommit,
  ZoomIn,
  Package,
  Layers,
  Activity,
  Share2,
  Printer,
  Barcode,
  RefreshCw,
  ShieldCheck,
  Building,
  ImageIcon
} from 'lucide-react';

// --- TYPES ---

type TraceStage = 'RECEIVING' | 'STORAGE' | 'THAWING' | 'COOKING' | 'COOLING' | 'REHEATING' | 'SERVICE';

interface TraceEvent {
  stage: TraceStage;
  date: string;
  time: string;
  location: string;
  operator: string;
  temperature?: number;
  criticalLimit?: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  evidenceUrl?: string;
}

interface ProductPassport {
  id: string; // The Trace ID / Batch ID
  productName: string;
  supplier: string;
  origin: string;
  currentStatus: 'Consumed' | 'In Stock' | 'In Process' | 'Disposed';
  riskLevel: 'High' | 'Medium' | 'Low';
  shelfLife: string;
  totalTimeInSystem: string;
  events: TraceEvent[];
}

// --- MOCK DATA ---

const MOCK_PASSPORTS: ProductPassport[] = [
  {
    id: "TRC-2025-001",
    productName: "GRILLED CHICKEN BREAST",
    supplier: "Quality Meats Ltd.",
    origin: "Batch #QM-882",
    currentStatus: "Consumed",
    riskLevel: "High",
    shelfLife: "Consumed",
    totalTimeInSystem: "2 Days 4 Hours",
    events: [
      {
        stage: "RECEIVING",
        date: "2025-05-20",
        time: "08:00 AM",
        location: "Loading Dock A",
        operator: "Mike Brown",
        temperature: 3.2,
        criticalLimit: "< 5°C",
        status: "PASS",
        details: "Received in good condition. Vehicle hygiene verified."
      },
      {
        stage: "STORAGE",
        date: "2025-05-20",
        time: "08:45 AM",
        location: "Walk-in Chiller 01",
        operator: "Mike Brown",
        temperature: 2.1,
        status: "PASS",
        details: "Stored on rack C2. FIFO tag applied."
      },
      {
        stage: "THAWING",
        date: "2025-05-21",
        time: "02:00 PM",
        location: "Prep Kitchen",
        operator: "Chef Alex",
        temperature: 4.0,
        criticalLimit: "< 5°C",
        status: "PASS",
        details: "Thawed in refrigerator over 24h. Core temp verified."
      },
      {
        stage: "COOKING",
        date: "2025-05-22",
        time: "11:00 AM",
        location: "Hot Line - Oven 2",
        operator: "Chef Alex",
        temperature: 78.5,
        criticalLimit: "> 75°C",
        status: "PASS",
        details: "Roasted to internal temp 78.5°C. Color and texture compliant."
      },
      {
        stage: "SERVICE",
        date: "2025-05-22",
        time: "12:30 PM",
        location: "Banquet Hall",
        operator: "Service Team",
        temperature: 68.0,
        criticalLimit: "> 65°C",
        status: "PASS",
        details: "Served at buffet. Hot holding maintained."
      }
    ]
  },
  {
    id: "TRC-2025-002",
    productName: "BEEF STEW (PRE-COOKED)",
    supplier: "Global Foods Inc.",
    origin: "Batch #GF-991",
    currentStatus: "In Stock",
    riskLevel: "High",
    shelfLife: "2 Days Remaining",
    totalTimeInSystem: "3 Days 10 Hours",
    events: [
      {
        stage: "RECEIVING",
        date: "2025-05-19",
        time: "07:30 AM",
        location: "Receiving Bay",
        operator: "Sarah Connor",
        temperature: -18.5,
        status: "PASS",
        details: "Frozen meat delivery. Hard frozen."
      },
      {
        stage: "COOKING",
        date: "2025-05-20",
        time: "09:00 AM",
        location: "Main Kitchen",
        operator: "Chef John",
        temperature: 82.0,
        status: "PASS",
        details: "Stew prepared. CCP met."
      },
      {
        stage: "COOLING",
        date: "2025-05-20",
        time: "11:00 AM",
        location: "Blast Chiller 1",
        operator: "Chef John",
        temperature: 3.5,
        criticalLimit: "60°C -> 5°C in 4h",
        status: "PASS",
        details: "Rapid cooling successful. Time taken: 90 mins."
      }
    ]
  },
  {
    id: "TRC-2025-003",
    productName: "VEGETABLE PASTA SALAD",
    supplier: "Fresh Farms",
    origin: "Batch #FF-202",
    currentStatus: "Disposed",
    riskLevel: "Medium",
    shelfLife: "Expired",
    totalTimeInSystem: "1 Day 2 Hours",
    events: [
      {
        stage: "RECEIVING",
        date: "2025-05-21",
        time: "06:00 AM",
        location: "Receiving Bay",
        operator: "Mike Brown",
        temperature: 8.0,
        criticalLimit: "< 5°C",
        status: "WARNING",
        details: "Received at marginal temperature. Accepted for immediate use."
      },
      {
        stage: "STORAGE",
        date: "2025-05-21",
        time: "06:15 AM",
        location: "Veg Fridge",
        operator: "Mike Brown",
        temperature: 4.5,
        status: "PASS",
        details: "Stored immediately to bring temp down."
      }
    ]
  }
];

// --- Sub-Components ---

const StageIcon = ({ stage }: { stage: TraceStage }) => {
  switch (stage) {
    case 'RECEIVING': return <Truck size={16} />;
    case 'STORAGE': return <Warehouse size={16} />;
    case 'THAWING': return <Waves size={16} />;
    case 'COOKING': return <Flame size={16} />;
    case 'COOLING': return <Snowflake size={16} />;
    case 'REHEATING': return <RefreshCw size={16} />;
    case 'SERVICE': return <Utensils size={16} />;
    default: return <Activity size={16} />;
  }
};

const StageColor = (stage: TraceStage) => {
    switch (stage) {
        case 'RECEIVING': return 'bg-slate-900 text-white';
        case 'STORAGE': return 'bg-slate-100 text-slate-600 border border-slate-200';
        case 'THAWING': return 'bg-blue-500 text-white shadow-lg shadow-blue-200';
        case 'COOKING': return 'bg-orange-500 text-white shadow-lg shadow-orange-200';
        case 'COOLING': return 'bg-cyan-500 text-white shadow-lg shadow-cyan-200';
        case 'REHEATING': return 'bg-purple-500 text-white shadow-lg shadow-purple-200';
        case 'SERVICE': return 'bg-emerald-500 text-white shadow-lg shadow-emerald-200';
        default: return 'bg-slate-200';
    }
};

const TraceabilityRegister: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [passports, setPassports] = useState<ProductPassport[]>(MOCK_PASSPORTS);
  const [expandedId, setExpandedId] = useState<string | null>(MOCK_PASSPORTS[0].id);

  const filteredPassports = useMemo(() => {
    return passports.filter(p => 
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.origin.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [passports, searchTerm]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500 px-4 md:px-0">
      
      {/* Header & Search */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
        <div className="flex items-center gap-5 z-10 w-full md:w-auto">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner border border-indigo-100">
            <GitCommit size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Traceability Hub</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500" /> Farm to Fork Genealogy
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto z-10">
          <div className="relative group flex-1 md:w-80">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
             <input 
               type="text" 
               placeholder="Trace by Batch ID, Product..." 
               className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner uppercase tracking-wider"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <button className="p-4 bg-white border-2 border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95">
             <Barcode size={20} />
          </button>
        </div>
      </div>

      {/* Main Timeline List */}
      <div className="flex flex-col gap-8">
        {filteredPassports.map((passport) => {
            const isExpanded = expandedId === passport.id;
            
            return (
                <div key={passport.id} className={`bg-white rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'border-indigo-500 shadow-2xl scale-[1.01]' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                    
                    {/* Passport Header */}
                    <div 
                        onClick={() => toggleExpand(passport.id)}
                        className="p-6 md:p-8 cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
                    >
                        {/* Identity */}
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shadow-inner shrink-0">
                                {passport.riskLevel === 'High' ? <AlertTriangle size={24} className="text-rose-500" /> : <Package size={24} />}
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 text-[9px] font-black uppercase tracking-widest">{passport.id}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border tracking-widest ${passport.currentStatus === 'Consumed' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                        {passport.currentStatus}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none">{passport.productName}</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-2">
                                    <Building size={12} /> {passport.supplier} <span className="text-slate-300">•</span> {passport.origin}
                                </p>
                            </div>
                        </div>

                        {/* Mini Timeline Preview (Desktop Only) */}
                        <div className="hidden lg:flex flex-1 mx-12 items-center relative h-12">
                            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
                            <div className="flex justify-between w-full z-10">
                                {passport.events.map((event, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-2 group">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all ${event.status === 'WARNING' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-500 group-hover:text-white'}`}>
                                            <div className="scale-75"><StageIcon stage={event.stage} /></div>
                                        </div>
                                        <span className="text-[8px] font-black uppercase text-slate-300 group-hover:text-indigo-500 transition-colors">{event.stage.substring(0,3)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button className="p-3 bg-white border-2 border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
                                <Printer size={20} />
                            </button>
                            <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-indigo-100 text-indigo-600' : ''}`}>
                                <ChevronDown size={20} />
                            </div>
                        </div>
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/30 p-6 md:p-10 animate-in slide-in-from-top-4 duration-500">
                            
                            {/* Summary Stats Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Time In System</p>
                                    <p className="text-sm font-black text-slate-800">{passport.totalTimeInSystem}</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Risk Profile</p>
                                    <p className={`text-sm font-black ${passport.riskLevel === 'High' ? 'text-rose-500' : 'text-emerald-500'}`}>{passport.riskLevel} Risk</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Touchpoints</p>
                                    <p className="text-sm font-black text-slate-800">{passport.events.length} Steps</p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Shelf Life</p>
                                    <p className="text-sm font-black text-indigo-600">{passport.shelfLife}</p>
                                </div>
                            </div>

                            {/* Detailed Timeline - Reverse Chronological (Top = Latest) */}
                            <div className="relative pl-4 md:pl-8 space-y-8 before:absolute before:top-4 before:bottom-4 before:left-[27px] md:before:left-[43px] before:w-0.5 before:bg-slate-200 before:content-['']">
                                {[...passport.events].reverse().map((event, idx) => (
                                    <div key={idx} className="relative flex flex-col md:flex-row gap-6 group">
                                        
                                        {/* Icon Node */}
                                        <div className={`absolute left-0 md:left-0 w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center border-4 border-slate-50 z-10 shadow-md transition-transform group-hover:scale-110 ${StageColor(event.stage)}`}>
                                            <StageIcon stage={event.stage} />
                                        </div>

                                        {/* Content Card */}
                                        <div className="ml-12 md:ml-20 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex-1 relative overflow-hidden">
                                            {event.status === 'WARNING' && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-400 opacity-10 rounded-bl-[4rem]" />}
                                            {event.status === 'FAIL' && <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500 opacity-10 rounded-bl-[4rem]" />}
                                            
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b border-slate-50 pb-3">
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{event.stage}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                                                        <MapPin size={10} /> {event.location}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{event.date}</p>
                                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{event.time}</p>
                                                    </div>
                                                    {event.status === 'PASS' && <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-full"><CheckCircle2 size={16} /></div>}
                                                    {event.status === 'WARNING' && <div className="bg-amber-50 text-amber-600 p-1.5 rounded-full"><AlertTriangle size={16} /></div>}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                                            <User size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Operator</p>
                                                            <p className="text-xs font-bold text-slate-700">{event.operator}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <p className="text-[10px] font-medium text-slate-600 italic leading-relaxed">"{event.details}"</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    {event.temperature !== undefined && (
                                                        <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                <Thermometer size={12} /> Temp Log
                                                            </span>
                                                            <div className="text-right">
                                                                <span className={`text-sm font-black ${event.status === 'PASS' ? 'text-emerald-600' : 'text-rose-500'}`}>{event.temperature}°C</span>
                                                                {event.criticalLimit && <p className="text-[8px] font-bold text-slate-400">Limit: {event.criticalLimit}</p>}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {event.evidenceUrl && (
                                                        <button className="w-full py-2 border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-500 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
                                                            <ImageIcon size={12} /> View Evidence
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    )}
                </div>
            );
        })}

        {filteredPassports.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <Search size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-black text-slate-300 uppercase tracking-[0.2em]">No Traceability Records Found</p>
            </div>
        )}
      </div>

    </div>
  );
};

export default TraceabilityRegister;
