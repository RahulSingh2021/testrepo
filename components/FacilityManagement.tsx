
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { compressImage } from '@/utils/imageCompression';
import { 
  Warehouse, 
  Wrench, 
  Droplets, 
  Calendar, 
  Thermometer, 
  Bug, 
  Plus, 
  Search, 
  ShieldCheck, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  History,
  Settings2,
  Info,
  ClipboardList,
  MapPin,
  Building,
  User,
  Zap,
  ArrowRight,
  MoreVertical,
  Edit3,
  Trash2,
  Power,
  Globe,
  Tag,
  Hammer,
  FileText,
  X,
  Save,
  Check,
  ShieldAlert,
  Wind,
  Droplet,
  Fingerprint,
  Cpu,
  Monitor,
  CalendarDays,
  Shield,
  ChevronDown,
  Hash,
  Download,
  Upload,
  FileUp,
  CheckCheck,
  AlertCircle,
  PlayCircle,
  Scale,
  Gauge,
  FileSignature,
  Binary,
  CalendarCheck,
  ArrowUpRight,
  Link,
  MonitorSmartphone,
  MousePointer2,
  PlusCircle,
  ChevronUp,
  Activity,
  Filter,
  RefreshCw,
  RotateCcw,
  Target,
  Maximize2,
  Eye,
  File,
  ClipboardCheck,
  XCircle,
  QrCode,
  Printer,
  Smartphone
} from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import CleaningChecklistModule from './CleaningChecklistModule';
import PreventiveMaintenanceModule from './PreventiveMaintenanceModule';
import ChecklistEditor from './ChecklistEditor';
import AuditChecklistPreview from './AuditChecklistPreview';
import type { FacilityEquipmentInfo } from './AuditChecklistPreview';
import type { ChecklistTemplate } from './AuditChecklistCreator';

export interface Equipment {
  id: string;
  name: string;
  idNumber: string;
  location: string;
  department: string;
  unit: string;
  regional: string;
  make: string;
  brand: string;
  
  // Cleaning
  cleaningChecklist: string;
  cleaningFrequencyValue: number;
  cleaningFrequencyUnit: 'Days' | 'Weeks' | 'Months' | 'Years';
  cleaningDay?: string; // Specific day for weekly schedules
  cleaningStartDate: string;
  
  // PM
  pmChecklist: string;
  pmFrequencyValue: number;
  pmFrequencyUnit: 'Days' | 'Weeks' | 'Months' | 'Years';
  pmDay?: string; // Specific day for PM schedules
  pmStartDate: string;
  
  // Calibration
  calibrationRequired: boolean;
  calibrationFrequencyValue: number;
  calibrationFrequencyUnit: 'Days' | 'Weeks' | 'Months' | 'Years';
  calibrationStartDate: string;

  monitoringActivity: string[]; 
  status: 'Active' | 'Inactive';
}

interface CalibrationDevice {
  id: string;
  name: string;
  serialNumber: string;
  type: 'Temperature' | 'Humidity' | 'Pressure' | 'Weight' | 'Timer';
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  certificateId: string;
  calibratedBy: string;
  // New Technical Specs
  workingRange: string;
  leastCount: string;
  calibrationRange: string;
  // State
  isActive: boolean;
  certificateUrl?: string;
  certificateFileName?: string;
  errorReported?: string;
}

interface CalibrationHistoryEntry {
  id: string;
  calibrationDate: string;
  expiryDate: string;
  certificateNumber: string;
  workingRange: string;
  calibrationRange: string;
  errorReported: string;
  leastCount: string;
  attachedPdfUrl?: string;
  attachedPdfName?: string;
  calibratedBy: string;
}

const REGIONAL_OPTIONS = ["North America", "EMEA", "APAC", "LATAM"];
const UNIT_OPTIONS = ["NYC Central Kitchen", "LA Logistics Unit", "London Hub", "Tokyo Plant", "Berlin HQ"];
const DEPT_OPTIONS = ["Kitchen", "Logistics", "Maintenance", "Storage", "Production"];
const LOCATION_OPTIONS = ["Main Prep Area", "Rear Loading", "Cold Room 1", "Hot Kitchen", "Packaging Line"];
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];



interface BreakdownSummaryEntry {
  id: string;
  date: string;
  action: string;
  status: 'Reported' | 'In Progress' | 'Resolved' | 'Pending Parts';
  cost: number;
  downtimeHours?: number;
}

interface CleaningScheduleEntry {
  id: string;
  date: string;
  status: 'completed' | 'missed' | 'verified' | 'upcoming';
  completedBy?: string;
  verifiedBy?: string;
  checklist: string;
  remarks?: string;
}

const generateCleaningHistory = (eq: Equipment): CleaningScheduleEntry[] => {
  const records: CleaningScheduleEntry[] = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  const val = eq.cleaningFrequencyValue || 1;
  const unit = eq.cleaningFrequencyUnit || 'Days';
  
  if (!eq.cleaningStartDate) return records;
  let anchorDate = new Date(eq.cleaningStartDate);
  if (isNaN(anchorDate.getTime())) return records;
  anchorDate.setHours(0,0,0,0);
  
  if (unit === 'Weeks' && eq.cleaningDay) {
    const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    const targetDay = dayMap[eq.cleaningDay];
    if (targetDay !== undefined) {
      const currentDay = anchorDate.getDay();
      const diff = (targetDay - currentDay + 7) % 7;
      anchorDate.setDate(anchorDate.getDate() + diff);
    }
  }
  
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  
  let cycleDate = new Date(anchorDate);
  let safety = 0;
  const operators = ['John D.', 'Maria S.', 'Ahmed K.', 'Lisa R.', 'Carlos M.'];
  const verifiers = ['Supervisor Chen', 'QA Lead Patel', 'Manager Wilson'];
  const remarksList = ['All areas cleaned thoroughly', 'Minor residue noted on edges', 'Deep cleaned per protocol', 'Sanitizer concentration verified', 'Equipment in good condition'];
  
  while (safety < 10000 && cycleDate <= sevenDaysAhead) {
    if (cycleDate >= ninetyDaysAgo) {
      const dateStr = cycleDate.toISOString().split('T')[0];
      const hash = (eq.id + dateStr).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
      
      let status: CleaningScheduleEntry['status'] = 'upcoming';
      if (cycleDate < today) {
        if (hash % 7 === 0) status = 'missed';
        else if (hash % 3 === 0) status = 'verified';
        else status = 'completed';
      } else if (cycleDate.getTime() === today.getTime()) {
        status = hash % 4 === 0 ? 'completed' : 'upcoming';
      }
      
      records.push({
        id: `csh-${eq.id}-${dateStr}`,
        date: dateStr,
        status,
        checklist: eq.cleaningChecklist,
        completedBy: (status === 'completed' || status === 'verified') ? operators[hash % operators.length] : undefined,
        verifiedBy: status === 'verified' ? verifiers[hash % verifiers.length] : undefined,
        remarks: (status === 'completed' || status === 'verified') ? remarksList[hash % remarksList.length] : (status === 'missed' ? 'Schedule not fulfilled' : undefined),
      });
    }
    
    switch (unit) {
      case 'Days': cycleDate.setDate(cycleDate.getDate() + val); break;
      case 'Weeks': cycleDate.setDate(cycleDate.getDate() + val * 7); break;
      case 'Months': cycleDate.setMonth(cycleDate.getMonth() + val); break;
      case 'Years': cycleDate.setFullYear(cycleDate.getFullYear() + val); break;
    }
    safety++;
  }
  
  return records.sort((a, b) => b.date.localeCompare(a.date));
};

const getCleaningStats = (eq: Equipment) => {
  const records = generateCleaningHistory(eq);
  const past = records.filter(r => r.status !== 'upcoming');
  return {
    completed: past.filter(r => r.status === 'completed' || r.status === 'verified').length,
    missed: past.filter(r => r.status === 'missed').length,
    total: past.length,
  };
};

// --- Custom Internal Components ---

const SearchableSelect = ({ label, options, value, onChange, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-white border-2 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-between cursor-pointer ${isOpen ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
      >
        <span className={value ? "text-slate-800" : "text-slate-300"}>{value || placeholder}</span>
        <ChevronDown size={14} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute z-[100] top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-50 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 w-3 h-3" />
              <input 
                autoFocus
                className="w-full pl-6 pr-2 py-1 text-[10px] bg-white border border-slate-200 rounded-md focus:outline-none" 
                placeholder="Filter..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((opt: string) => (
              <button 
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border-b border-slate-50 last:border-0 transition-colors uppercase"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Placeholder Views ---
const MaintenanceView = () => (
    <div className="p-20 text-center text-slate-400 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <Wrench size={48} className="mx-auto mb-4 opacity-20" />
        <p className="text-lg font-black uppercase tracking-widest text-slate-300">Maintenance Terminal</p>
        <p className="text-xs mt-3 uppercase font-bold tracking-widest">Preventive Maintenance Schedule & Logs</p>
    </div>
);

const CalibrationHub: React.FC<{ equipmentList: Equipment[] }> = ({ equipmentList }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [deviceMap, setDeviceMap] = useState<Record<string, CalibrationDevice[]>>({});
    
    // Modal & Upload State
    const [renewModal, setRenewModal] = useState<{ eqId: string, devId: string } | null>(null);
    const [renewForm, setRenewForm] = useState({ date: '', nextDate: '', certId: '' });
    
    // Sensor Add/Edit State
    const [sensorModal, setSensorModal] = useState<{ isOpen: boolean, eqId: string, sensor: CalibrationDevice | null } | null>(null);
    const [calibHistoryMap, setCalibHistoryMap] = useState<Record<string, CalibrationHistoryEntry[]>>({});
    const [historyModal, setHistoryModal] = useState<{ device: CalibrationDevice, entries: CalibrationHistoryEntry[] } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<{ eqId: string, devId: string } | null>(null);

    // Filter only equipment that requires calibration
    const calibrationAssets = useMemo(() => {
        return equipmentList
            .filter(e => e.calibrationRequired)
            .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.idNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [equipmentList, searchQuery]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpandedIds(next);
    };

    const getStatus = (device: CalibrationDevice) => {
        if (!device.isActive) return 'Inactive';
        const today = new Date();
        const next = new Date(device.nextCalibrationDate);
        const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'Expired';
        if (diffDays < 30) return 'Due Soon';
        return 'Valid';
    };

    const stats = useMemo(() => {
        let totalDevices = 0;
        let dueSoon = 0;
        let overdue = 0;
        
        calibrationAssets.forEach(asset => {
            const devices = deviceMap[asset.id] || [];
            totalDevices += devices.length;
            devices.forEach(d => {
                const status = getStatus(d);
                if (status === 'Due Soon') dueSoon++;
                if (status === 'Expired') overdue++;
            });
        });

        return { totalAssets: calibrationAssets.length, totalDevices, dueSoon, overdue };
    }, [calibrationAssets, deviceMap]);

    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'Valid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Expired': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'Due Soon': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'Inactive': return 'bg-slate-100 text-slate-400 border-slate-200 grayscale';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    const getDeviceIcon = (type: string) => {
        switch(type) {
            case 'Temperature': return <Thermometer size={16} />;
            case 'Humidity': return <Droplet size={16} />;
            case 'Pressure': return <Gauge size={16} />;
            case 'Weight': return <Scale size={16} />;
            case 'Timer': return <Clock size={16} />;
            default: return <Cpu size={16} />;
        }
    };

    // Actions
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadTarget) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const compressed = await compressImage(ev.target?.result as string);
            setDeviceMap(prev => ({
                ...prev,
                [uploadTarget.eqId]: prev[uploadTarget.eqId].map(d => 
                    d.id === uploadTarget.devId ? { ...d, certificateUrl: compressed, certificateFileName: file.name } : d
                )
            }));
            setUploadTarget(null);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
    };

    const triggerUpload = (eqId: string, devId: string) => {
        setUploadTarget({ eqId, devId });
        fileInputRef.current?.click();
    };

    const handleRenewSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!renewModal) return;
        const device = (deviceMap[renewModal.eqId] || []).find(d => d.id === renewModal.devId);
        if (device) {
            const histEntry: CalibrationHistoryEntry = {
                id: `ch-${Date.now()}`,
                calibrationDate: renewForm.date,
                expiryDate: renewForm.nextDate,
                certificateNumber: renewForm.certId || device.certificateId,
                workingRange: device.workingRange,
                calibrationRange: device.calibrationRange,
                errorReported: device.errorReported || 'N/A',
                leastCount: device.leastCount,
                calibratedBy: device.calibratedBy,
                attachedPdfUrl: device.certificateUrl,
                attachedPdfName: device.certificateFileName,
            };
            setCalibHistoryMap(prev => ({
                ...prev,
                [device.id]: [histEntry, ...(prev[device.id] || [])]
            }));
        }
        setDeviceMap(prev => ({
            ...prev,
            [renewModal.eqId]: prev[renewModal.eqId].map(d => 
                d.id === renewModal.devId ? { 
                    ...d, 
                    lastCalibrationDate: renewForm.date, 
                    nextCalibrationDate: renewForm.nextDate, 
                    certificateId: renewForm.certId 
                } : d
            )
        }));
        setRenewModal(null);
    };

    const openHistoryModal = (device: CalibrationDevice) => {
        const entries = calibHistoryMap[device.id] || [];
        setHistoryModal({ device, entries });
    };

    const handleSaveSensor = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!sensorModal) return;
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        
        const newDevice: CalibrationDevice = {
            id: sensorModal.sensor?.id || `dev-${Date.now()}`,
            name: data.name as string,
            serialNumber: data.serialNumber as string,
            type: data.type as any,
            workingRange: data.workingRange as string,
            leastCount: data.leastCount as string,
            calibrationRange: data.calibrationRange as string,
            lastCalibrationDate: data.lastCalibrationDate as string,
            nextCalibrationDate: data.nextCalibrationDate as string,
            calibratedBy: data.calibratedBy as string,
            certificateId: data.certificateId as string,
            isActive: true
        };

        setDeviceMap(prev => {
            const currentList = prev[sensorModal.eqId] || [];
            if (sensorModal.sensor) {
                // Edit Mode
                return {
                    ...prev,
                    [sensorModal.eqId]: currentList.map(d => d.id === sensorModal.sensor!.id ? { ...newDevice, isActive: d.isActive, certificateUrl: d.certificateUrl } : d)
                };
            } else {
                // Add Mode
                return {
                    ...prev,
                    [sensorModal.eqId]: [...currentList, newDevice]
                };
            }
        });
        setSensorModal(null);
    };

    const openRenewModal = (eqId: string, dev: CalibrationDevice) => {
        setRenewForm({ 
            date: new Date().toISOString().split('T')[0], 
            nextDate: dev.nextCalibrationDate, 
            certId: '' 
        });
        setRenewModal({ eqId, devId: dev.id });
    };

    const toggleDeviceStatus = (eqId: string, devId: string) => {
        setDeviceMap(prev => ({
            ...prev,
            [eqId]: prev[eqId].map(d => d.id === devId ? { ...d, isActive: !d.isActive } : d)
        }));
    };

    const deleteDevice = (eqId: string, devId: string) => {
        if (!confirm("Are you sure you want to remove this sensor?")) return;
        setDeviceMap(prev => ({
            ...prev,
            [eqId]: prev[eqId].filter(d => d.id !== devId)
        }));
    };

    const openAddSensor = (eqId: string) => {
        setSensorModal({ isOpen: true, eqId, sensor: null });
    };

    const openEditSensor = (eqId: string, sensor: CalibrationDevice) => {
        setSensorModal({ isOpen: true, eqId, sensor });
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500 px-4 md:px-0">
             <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.png" onChange={handleFileUpload} />

             {/* 1. Dashboard / KPI Header */}
             <div className="flex overflow-x-auto snap-x hide-scrollbar lg:grid lg:grid-cols-4 gap-4 pb-4 lg:pb-0">
                {[
                    { label: 'Monitored Assets', value: stats.totalAssets, icon: Target, color: 'bg-indigo-600', trend: null },
                    { label: 'Total Devices', value: stats.totalDevices, icon: MonitorSmartphone, color: 'bg-blue-500', trend: null },
                    { label: 'Due for Calib.', value: stats.dueSoon, icon: Clock, color: 'bg-amber-500', trend: stats.dueSoon > 0 ? -1 : 0 },
                    { label: 'Critical Alerts', value: stats.overdue, icon: ShieldAlert, color: 'bg-rose-500', trend: -5 },
                ].map((stat, i) => (
                    <div key={i} className="min-w-[240px] lg:min-w-0 snap-center shrink-0 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-xl transition-all">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
                        </div>
                        <div className={`p-4 ${stat.color} text-white rounded-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                            <stat.icon size={22} />
                        </div>
                    </div>
                ))}
             </div>

             {/* 2. Action Bar */}
             <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500" />
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-cyan-50 text-cyan-600 rounded-3xl shadow-inner border border-cyan-100">
                        <Settings2 size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Calibration Hub</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Activity size={12} className="text-cyan-500" /> Precision Instrument Registry
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative group w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-cyan-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search Equipment..." 
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-cyan-400 focus:bg-white transition-all shadow-inner uppercase tracking-wider"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-cyan-600 hover:border-cyan-200 transition-all shadow-sm active:scale-95">
                        <Filter size={20} />
                    </button>
                    <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm active:scale-95">
                        <RefreshCw size={20} />
                    </button>
                </div>
             </div>

             {/* 3. Main List (Cards) */}
             <div className="space-y-6">
                {calibrationAssets.map((asset, idx) => {
                    const devices = deviceMap[asset.id] || [];
                    const dueCount = devices.filter(d => getStatus(d) === 'Due Soon' || getStatus(d) === 'Expired').length;
                    const isExpanded = expandedIds.has(asset.id);
                    
                    return (
                        <div key={asset.id} className={`bg-white rounded-[1.5rem] md:rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden flex flex-col ${isExpanded ? 'border-cyan-400 shadow-2xl scale-[1.01]' : 'border-slate-100 shadow-sm hover:border-cyan-200'}`}>
                            
                            {/* Card Header Row */}
                            <div className="flex flex-col lg:flex-row items-stretch min-h-[140px]">
                                
                                {/* 3.1 Equipment Identity & Hierarchy */}
                                <div className="p-6 md:p-8 lg:w-[35%] border-b lg:border-b-0 lg:border-r border-slate-100 flex flex-col justify-center bg-white shrink-0">
                                    <div className="flex items-start gap-5">
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform ${dueCount > 0 ? 'bg-amber-500' : 'bg-indigo-600'}`}>
                                            <Wrench size={32} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex flex-wrap gap-2">
                                                <span>{asset.regional}</span> <ChevronRight size={10} />
                                                <span>{asset.unit}</span> <ChevronRight size={10} />
                                                <span className="text-indigo-600">{asset.department}</span>
                                            </div>
                                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-2">{asset.name}</h4>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                 <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    <Hash size={10} /> {asset.idNumber}
                                                 </span>
                                                 <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    <Tag size={10} /> {asset.brand} ({asset.make})
                                                 </span>
                                                 <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                    <MapPin size={10} /> {asset.location}
                                                 </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3.2 Metrics & Context */}
                                <div className="p-6 md:p-8 flex-1 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/10 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex flex-wrap gap-4 md:gap-8 justify-center md:justify-start w-full md:w-auto">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</span>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                <Calendar size={14} className="text-indigo-500"/>
                                                <span className="text-xs font-black text-slate-700 uppercase">Every {asset.calibrationFrequencyValue} {asset.calibrationFrequencyUnit}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Next Schedule</span>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                <Clock size={14} className="text-indigo-500"/>
                                                <span className="text-xs font-black text-slate-700 uppercase">{new Date(asset.calibrationStartDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-4 justify-center md:justify-end w-full md:w-auto">
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Connected Devices</p>
                                            <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{devices.length}</p>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200 hidden md:block" />
                                        <div className="text-left">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Status</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${dueCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                <span className={`text-sm font-black ${dueCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{dueCount > 0 ? 'Attention' : 'Compliant'}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => openAddSensor(asset.id)}
                                            className="ml-4 p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95"
                                            title="Add New Sensor"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* 3.3 Expand Action */}
                                <div className="p-6 md:p-8 lg:w-[120px] flex items-center justify-center bg-white shrink-0">
                                    <button 
                                        onClick={() => toggleExpand(asset.id)}
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all ${isExpanded ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-110' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:border-indigo-400'}`}
                                    >
                                        {isExpanded ? <ChevronUp size={24} strokeWidth={3} /> : <ChevronDown size={24} strokeWidth={3} />}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Sub-Cards (Devices) */}
                            {isExpanded && (
                                <div className="bg-slate-50/50 border-t border-slate-100 p-6 md:p-8 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                                            <MonitorSmartphone size={14} className="text-indigo-500" /> Attached Instruments Registry
                                        </h5>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {devices.map(device => {
                                            const status = getStatus(device);
                                            return (
                                                <div key={device.id} className={`group relative bg-white border-2 rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between ${!device.isActive ? 'border-slate-100 opacity-60 grayscale' : 'border-slate-100 hover:border-cyan-200 hover:shadow-lg'}`}>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-3 rounded-2xl ${status === 'Valid' ? 'bg-cyan-50 text-cyan-600 shadow-sm' : status === 'Inactive' ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-600 shadow-sm'}`}>
                                                                {getDeviceIcon(device.type)}
                                                            </div>
                                                            <div>
                                                                <h6 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1.5">{device.name}</h6>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{device.serialNumber}</span>
                                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getStatusStyle(status)}`}>
                                                                        {status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-4 mb-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Working Range</span>
                                                            <span className="text-[10px] font-black text-slate-600">{device.workingRange || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-0.5 border-l border-slate-100 pl-4">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Least Count</span>
                                                            <span className="text-[10px] font-black text-slate-600">{device.leastCount || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-0.5 border-l border-slate-100 pl-4">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Calib Range</span>
                                                            <span className="text-[10px] font-black text-slate-600">{device.calibrationRange || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                        <div className="flex gap-6 w-full sm:w-auto">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Next Due</span>
                                                                <span className={`text-[10px] font-black ${status === 'Expired' ? 'text-rose-600' : 'text-emerald-600'}`}>{device.nextCalibrationDate}</span>
                                                            </div>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Cert ID</span>
                                                                <span className="text-[10px] font-bold text-slate-600">{device.certificateId || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                        {device.certificateUrl && (
                                                            <button 
                                                                onClick={() => window.open(device.certificateUrl)}
                                                                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase hover:bg-blue-100 transition-colors"
                                                            >
                                                                <File size={12}/> {device.certificateFileName ? (device.certificateFileName.length > 8 ? device.certificateFileName.substring(0,8)+'...' : device.certificateFileName) : 'View PDF'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-slate-50 flex flex-wrap items-center justify-end gap-2 bg-slate-50/30 -mx-6 -mb-6 px-6 py-3 rounded-b-3xl">
                                                        <button 
                                                            onClick={() => openHistoryModal(device)}
                                                            title="Calibration History"
                                                            className="p-2 bg-white text-cyan-600 border border-cyan-100 rounded-xl hover:bg-cyan-50 shadow-sm transition-all flex items-center gap-1"
                                                        >
                                                            <History size={14} />
                                                            <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline">History</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => openEditSensor(asset.id, device)}
                                                            title="Edit Sensor Details"
                                                            disabled={!device.isActive}
                                                            className="p-2 bg-white text-slate-500 border border-slate-200 rounded-xl hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all disabled:opacity-50"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => triggerUpload(asset.id, device.id)}
                                                            title="Upload Certificate"
                                                            disabled={!device.isActive}
                                                            className="p-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-50 shadow-sm transition-all disabled:opacity-50"
                                                        >
                                                            <Upload size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => openRenewModal(asset.id, device)}
                                                            title="Renew Calibration"
                                                            disabled={!device.isActive}
                                                            className="p-2 bg-white text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-50 shadow-sm transition-all disabled:opacity-50"
                                                        >
                                                            <RefreshCw size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => toggleDeviceStatus(asset.id, device.id)}
                                                            title={device.isActive ? "Deactivate" : "Activate"}
                                                            className={`p-2 bg-white border rounded-xl shadow-sm transition-all ${device.isActive ? 'text-amber-500 border-amber-100 hover:bg-amber-50' : 'text-emerald-500 border-emerald-100 hover:bg-emerald-50'}`}
                                                        >
                                                            <Power size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => deleteDevice(asset.id, device.id)}
                                                            title="Remove Sensor"
                                                            className="p-2 bg-white text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-50 shadow-sm transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {calibrationAssets.length === 0 && (
                    <div className="p-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 shadow-inner">
                             <Search size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">No Calibration Assets Found</h3>
                        <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Try adjusting filters or add new equipment</p>
                    </div>
                )}
             </div>

             {/* RENEW MODAL */}
             {renewModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-slate-100">
                        <div className="flex items-center gap-4 mb-6 text-emerald-600">
                            <RefreshCw size={24} />
                            <h3 className="text-lg font-black uppercase tracking-tight">Renew Calibration</h3>
                        </div>
                        <form onSubmit={handleRenewSave} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Calib. Date</label>
                                <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 transition-all" value={renewForm.date} onChange={e => setRenewForm({...renewForm, date: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Next Due Date</label>
                                <input type="date" required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 transition-all" value={renewForm.nextDate} onChange={e => setRenewForm({...renewForm, nextDate: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Certificate ID</label>
                                <input type="text" placeholder="Enter ID..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 transition-all uppercase" value={renewForm.certId} onChange={e => setRenewForm({...renewForm, certId: e.target.value})} />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setRenewModal(null)} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-700 transition-all">Confirm Renewal</button>
                            </div>
                        </form>
                    </div>
                </div>
             )}

             {/* CALIBRATION HISTORY MODAL */}
             {historyModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 max-h-[90vh]">
                        <div className="px-8 py-6 bg-gradient-to-r from-cyan-600 to-blue-700 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/15 rounded-2xl shadow-lg backdrop-blur-sm"><History size={24}/></div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tight">Calibration History</h3>
                                    <p className="text-[10px] font-bold text-cyan-100 uppercase tracking-widest mt-0.5">{historyModal.device.name} — {historyModal.device.serialNumber}</p>
                                </div>
                            </div>
                            <button onClick={() => setHistoryModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
                        </div>
                        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
                            {historyModal.entries.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-inner">
                                        <History size={36} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-700 uppercase tracking-tight">No History Found</h4>
                                    <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Calibration records will appear here after renewals</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyModal.entries.map((entry, idx) => {
                                        const isLatest = idx === 0;
                                        const isExpired = new Date(entry.expiryDate) < new Date();
                                        return (
                                            <div key={entry.id} className={`relative border-2 rounded-2xl overflow-hidden transition-all ${isLatest ? 'border-cyan-200 shadow-lg' : 'border-slate-100 hover:border-slate-200'}`}>
                                                {isLatest && (
                                                    <div className="absolute top-3 right-3">
                                                        <span className="px-2.5 py-1 bg-cyan-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm">Latest</span>
                                                    </div>
                                                )}
                                                <div className={`px-5 py-3 flex items-center gap-3 ${isLatest ? 'bg-gradient-to-r from-cyan-50 to-blue-50' : 'bg-slate-50/50'}`}>
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black ${isLatest ? 'bg-cyan-500' : isExpired ? 'bg-rose-400' : 'bg-slate-400'}`}>
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calibrated:</span>
                                                            <span className="text-xs font-black text-slate-700">{new Date(entry.calibrationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                            <span className="text-slate-300 mx-1">→</span>
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expires:</span>
                                                            <span className={`text-xs font-black ${isExpired ? 'text-rose-600' : 'text-emerald-600'}`}>{new Date(entry.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                            {isExpired && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[7px] font-black uppercase rounded border border-rose-200">Expired</span>}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">By: {entry.calibratedBy}</div>
                                                    </div>
                                                </div>
                                                <div className="p-5">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Certificate No.</span>
                                                            <span className="text-[11px] font-black text-slate-700 font-mono bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{entry.certificateNumber}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Working Range</span>
                                                            <span className="text-[11px] font-bold text-slate-600">{entry.workingRange || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Calibration Range</span>
                                                            <span className="text-[11px] font-bold text-slate-600">{entry.calibrationRange || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Least Count</span>
                                                            <span className="text-[11px] font-bold text-slate-600">{entry.leastCount || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Error Reported</span>
                                                            <div className="flex items-center gap-2">
                                                                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                                                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{entry.errorReported || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Attached PDF</span>
                                                            {entry.attachedPdfUrl || entry.attachedPdfName ? (
                                                                <button
                                                                    onClick={() => entry.attachedPdfUrl && window.open(entry.attachedPdfUrl)}
                                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors border border-blue-100 w-fit"
                                                                >
                                                                    <File size={12} />
                                                                    {entry.attachedPdfName || 'View Certificate'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-[11px] text-slate-400 font-medium italic">No attachment</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{historyModal.entries.length} Record{historyModal.entries.length !== 1 ? 's' : ''}</span>
                            <button onClick={() => setHistoryModal(null)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-black transition-all active:scale-95">Close</button>
                        </div>
                    </div>
                </div>
             )}

             {/* SENSOR FORM MODAL (Add/Edit) */}
             {sensorModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[90vh] md:h-auto">
                         <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg"><Settings2 size={24}/></div>
                               <h3 className="text-xl font-black uppercase tracking-tight">{sensorModal.sensor ? 'Edit Sensor' : 'Add New Sensor'}</h3>
                            </div>
                            <button onClick={() => setSensorModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
                         </div>
                         <form onSubmit={handleSaveSensor} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Device Name</label>
                                    <input required name="name" defaultValue={sensorModal.sensor?.name} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" placeholder="e.g. Core Probe 1" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial Number</label>
                                    <input required name="serialNumber" defaultValue={sensorModal.sensor?.serialNumber} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none uppercase" placeholder="SN-XXXX" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Device Type</label>
                                    <select name="type" defaultValue={sensorModal.sensor?.type || 'Temperature'} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none cursor-pointer">
                                        <option value="Temperature">Temperature</option>
                                        <option value="Humidity">Humidity</option>
                                        <option value="Pressure">Pressure</option>
                                        <option value="Weight">Weight</option>
                                        <option value="Timer">Timer</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Working Range</label>
                                    <input name="workingRange" defaultValue={sensorModal.sensor?.workingRange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" placeholder="e.g. -40 to 100°C" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Least Count</label>
                                    <input name="leastCount" defaultValue={sensorModal.sensor?.leastCount} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" placeholder="e.g. 0.1°C" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calibrated Range</label>
                                    <input name="calibrationRange" defaultValue={sensorModal.sensor?.calibrationRange} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" placeholder="e.g. 0 to 80°C" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Calibration</label>
                                    <input required type="date" name="lastCalibrationDate" defaultValue={sensorModal.sensor?.lastCalibrationDate} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Next Due</label>
                                    <input required type="date" name="nextCalibrationDate" defaultValue={sensorModal.sensor?.nextCalibrationDate} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calibrated By (Agency)</label>
                                    <input name="calibratedBy" defaultValue={sensorModal.sensor?.calibratedBy} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none" placeholder="Lab Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Certificate ID</label>
                                    <input name="certificateId" defaultValue={sensorModal.sensor?.certificateId} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-indigo-500 outline-none uppercase" placeholder="CERT-XXXX" />
                                </div>
                            </div>
                            <div className="pt-6 flex gap-4 border-t border-slate-100">
                                <button type="button" onClick={() => setSensorModal(null)} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95">{sensorModal.sensor ? 'Update Sensor' : 'Register Sensor'}</button>
                            </div>
                         </form>
                    </div>
                </div>
             )}
        </div>
    );
};

const PestManagement = () => (
    <div className="p-20 text-center text-slate-400 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
        <Bug size={48} className="mx-auto mb-4 opacity-20" />
        <p className="text-lg font-black uppercase tracking-widest text-slate-300">Pest Control</p>
        <p className="text-xs mt-3 uppercase font-bold tracking-widest">Pest Management Activity Logs</p>
    </div>
);

// --- Main Component ---

const FACILITY_TABS = [
  { id: 'fac-equipment', label: 'Equipment List', icon: Warehouse },
  { id: 'fac-hygiene', label: 'Hygiene & Maintenance', icon: ClipboardCheck },
  { id: 'fac-cleaning', label: 'Cleaning Checklist', icon: Droplets },
  { id: 'fac-maintenance', label: 'Preventive Maintenance', icon: Wrench },
  { id: 'fac-calibration', label: 'Calibration', icon: Gauge },
  { id: 'fac-pest', label: 'Pest Management', icon: Bug },
] as const;

const FacilityManagement: React.FC<{ activeSubTab: string; departmentNames?: string[]; currentUnit?: string }> = ({ activeSubTab: externalSubTab, departmentNames = [], currentUnit }) => {
  const [internalTab, setInternalTab] = useState('fac-equipment');
  const activeSubTab = externalSubTab === 'facility' ? internalTab : externalSubTab;

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegional, setSelectedRegional] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [bulkStagedData, setBulkStagedData] = useState<Partial<Equipment>[]>([]);
  const [bulkRowEdits, setBulkRowEdits] = useState<Record<number, { location?: string; department?: string; checklist?: string }>>({});
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Equipment | null>(null);
  const [cleaningHistoryModal, setCleaningHistoryModal] = useState<{ eq: Equipment, records: CleaningScheduleEntry[] } | null>(null);
  const [cleaningChecklistModal, setCleaningChecklistModal] = useState<Equipment | null>(null);
  const [inlineChecklistEdit, setInlineChecklistEdit] = useState<{ eqId: string; type: 'hygiene' | 'maintenance' } | null>(null);
  const [inlineChecklistSearch, setInlineChecklistSearch] = useState('');
  const inlineChecklistRef = useRef<HTMLDivElement>(null);
  const [selectedChecklistPageName, setSelectedChecklistPageName] = useState<string | null>(null);
  const [facilityChecklistPreview, setFacilityChecklistPreview] = useState<ChecklistTemplate | null>(null);
  const [facilityEquipmentInfo, setFacilityEquipmentInfo] = useState<FacilityEquipmentInfo | null>(null);
  const [qrCodeModal, setQrCodeModal] = useState<Equipment | null>(null);

  const [facilityChecklists, setFacilityChecklists] = useState<ChecklistTemplate[]>([]);
  const facDbLoaded = useRef(false);
  const facSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const facChecklistsRef = useRef(facilityChecklists);
  facChecklistsRef.current = facilityChecklists;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch('/api/facility-checklists');
        if (cancelled) return;
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setFacilityChecklists(prev => {
              const dbMap = new Map(data.map((c: ChecklistTemplate) => [c.id, c]));
              const merged = data.map((c: ChecklistTemplate) => c);
              prev.forEach(c => { if (!dbMap.has(c.id)) merged.push(c); });
              return merged;
            });
          }
        }
      } catch (e) {
        console.error('Failed to load facility checklists:', e);
      }
      if (!cancelled) facDbLoaded.current = true;
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const saveFacilityChecklists = useCallback((items: ChecklistTemplate[]) => {
    if (!facDbLoaded.current) return;
    if (facSaveTimer.current) clearTimeout(facSaveTimer.current);
    facSaveTimer.current = setTimeout(() => {
      const valid = items.filter(i => i.id);
      if (valid.length === 0) return;
      const eqList = equipmentRef.current;
      const enriched = valid.map(cl => {
        const ids = cl.attachedEquipmentIds || [];
        const names = ids.map(id => eqList.find(eq => eq.id === id)?.name || id);
        return { ...cl, attachedEquipmentNames: names };
      });
      fetch('/api/facility-checklists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enriched),
      }).catch(e => console.error('Failed to save facility checklists:', e));
    }, 3000);
  }, []);

  useEffect(() => { saveFacilityChecklists(facilityChecklists); }, [facilityChecklists, saveFacilityChecklists]);

  useEffect(() => {
    const flushSave = (url: string, data: any[], enrichEquipNames?: boolean) => {
      const valid = data.filter((i: any) => i.id);
      if (valid.length === 0) return;
      let payload = valid;
      if (enrichEquipNames) {
        const eqList = equipmentRef.current;
        payload = valid.map((cl: any) => {
          const ids = cl.attachedEquipmentIds || [];
          const names = ids.map((id: string) => eqList.find((eq: any) => eq.id === id)?.name || id);
          return { ...cl, attachedEquipmentNames: names };
        });
      }
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    };
    const handleBeforeUnload = () => {
      flushSave('/api/facility-checklists', facChecklistsRef.current, true);
      flushSave('/api/facility-equipment', equipmentRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const eqDbLoaded = useRef(false);
  const eqSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let persistOnLoad: Equipment[] | null = null;
      try {
        const url = new URL('/api/facility-equipment', typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
        if (currentUnit) url.searchParams.set('unit', currentUnit);
        const resp = await fetch(url.toString());
        if (cancelled) return;
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            setEquipment(data as Equipment[]);
          }
        }
      } catch (e) {
        console.error('Failed to load facility equipment:', e);
      }
      if (!cancelled) {
        eqDbLoaded.current = true;
        if (persistOnLoad && persistOnLoad.length > 0) {
          const itemsWithUnit = persistOnLoad.map(eq => ({ ...eq, unit: currentUnit || eq.unit }));
          fetch('/api/facility-equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemsWithUnit),
          }).catch(() => {});
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUnit]);

  const saveEquipment = useCallback((items: Equipment[]) => {
    if (!eqDbLoaded.current) return;
    if (eqSaveTimer.current) clearTimeout(eqSaveTimer.current);
    eqSaveTimer.current = setTimeout(() => {
      const valid = items.filter(i => i.id);
      if (valid.length === 0) return;
      const itemsWithUnit = valid.map(eq => ({ ...eq, unit: eq.unit || currentUnit }));
      fetch('/api/facility-equipment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsWithUnit),
      }).catch(e => console.error('Failed to save facility equipment:', e));
    }, 3000);
  }, [currentUnit]);

  useEffect(() => { saveEquipment(equipment); }, [equipment, saveEquipment]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dynamicRegionalOptions = useMemo(() => {
    const vals = equipment.map(eq => eq.regional).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [equipment]);

  const dynamicUnitOptions = useMemo(() => {
    const vals = equipment.map(eq => eq.unit).filter(Boolean);
    return [...new Set(vals)].sort();
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.idNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRegional = selectedRegional === "" || eq.regional === selectedRegional;
      const matchesUnit = selectedUnit === "" || eq.unit === selectedUnit;
      
      return matchesSearch && matchesRegional && matchesUnit;
    });
  }, [equipment, searchTerm, selectedRegional, selectedUnit]);

  const getLinkedChecklists = useCallback((eqId: string, eq?: Equipment) => {
    const linked = facilityChecklists.filter(cl => cl.attachedEquipmentIds?.includes(eqId));
    let hygieneChecklist: typeof facilityChecklists[0] | null = linked[0] || null;
    let pmChecklist: typeof facilityChecklists[0] | null = linked[0] || null;
    if (!hygieneChecklist && eq?.cleaningChecklist) {
      hygieneChecklist = facilityChecklists.find(c => c.title === eq.cleaningChecklist) || null;
    }
    if (!pmChecklist && eq?.pmChecklist) {
      pmChecklist = facilityChecklists.find(c => c.title === eq.pmChecklist) || null;
    }
    return { hygieneChecklist, pmChecklist };
  }, [facilityChecklists]);

  const hygieneChecklistNames = useMemo(() => {
    return facilityChecklists.map(cl => cl.title);
  }, [facilityChecklists]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inlineChecklistRef.current && !inlineChecklistRef.current.contains(e.target as Node)) {
        setInlineChecklistEdit(null);
        setInlineChecklistSearch('');
      }
    };
    if (inlineChecklistEdit) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inlineChecklistEdit]);

  const handleInlineChecklistSelect = (eqId: string, type: 'hygiene' | 'maintenance', checklistTitle: string) => {
    const cl = facilityChecklists.find(c => c.title === checklistTitle);
    if (!cl) return;
    const cFreq = typeof cl.cleaningFrequency === 'object' && cl.cleaningFrequency ? cl.cleaningFrequency : null;
    const pFreq = typeof cl.pmFrequency === 'object' && cl.pmFrequency ? cl.pmFrequency : null;
    setEquipment(prev => prev.map(eq => {
      if (eq.id !== eqId) return eq;
      return {
        ...eq,
        cleaningChecklist: checklistTitle,
        pmChecklist: checklistTitle,
        ...(cFreq ? { cleaningFrequencyValue: cFreq.value, cleaningFrequencyUnit: cFreq.unit } : {}),
        ...(pFreq ? { pmFrequencyValue: pFreq.value, pmFrequencyUnit: pFreq.unit } : {}),
      };
    }));
    setFacilityChecklists(prev => prev.map(c => {
      const ids = c.attachedEquipmentIds || [];
      if (c.id === cl.id) {
        return ids.includes(eqId) ? c : { ...c, attachedEquipmentIds: [...ids, eqId] };
      }
      return ids.includes(eqId) ? { ...c, attachedEquipmentIds: ids.filter(id => id !== eqId) } : c;
    }));
    setInlineChecklistEdit(null);
    setInlineChecklistSearch('');
  };

  const handleSelectHygieneChecklist = (checklistTitle: string) => {
    if (!editForm) return;
    const cl = facilityChecklists.find(c => c.title === checklistTitle);
    if (cl) {
      const cFreq = typeof cl.cleaningFrequency === 'object' && cl.cleaningFrequency ? cl.cleaningFrequency : null;
      const pFreq = typeof cl.pmFrequency === 'object' && cl.pmFrequency ? cl.pmFrequency : null;
      setEditForm({
        ...editForm,
        cleaningChecklist: checklistTitle,
        pmChecklist: checklistTitle,
        ...(cFreq ? { cleaningFrequencyValue: cFreq.value, cleaningFrequencyUnit: cFreq.unit === 'Years' ? 'Months' : cFreq.unit as any } : {}),
        ...(pFreq ? { pmFrequencyValue: pFreq.value, pmFrequencyUnit: pFreq.unit === 'Years' ? 'Months' : pFreq.unit as any } : {}),
      });
      const eqId = editForm.id;
      setFacilityChecklists(prev => prev.map(c => {
        if (c.id === cl.id) {
          const ids = c.attachedEquipmentIds || [];
          return ids.includes(eqId) ? c : { ...c, attachedEquipmentIds: [...ids, eqId] };
        }
        return c;
      }));
    } else {
      setEditForm({ ...editForm, cleaningChecklist: checklistTitle, pmChecklist: checklistTitle });
    }
  };

  const handleUpdateEditForm = (field: keyof Equipment, value: any) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const toggleStatus = (id: string) => {
    setEquipment(prev => prev.map(eq => 
      eq.id === id ? { ...eq, status: eq.status === 'Active' ? 'Inactive' : 'Active' } : eq
    ));
  };

  const deleteEquipment = async (id: string) => {
    if (window.confirm("Permanently remove this asset from the registry?")) {
      const eq = equipment.find(e => e.id === id);
      try {
        const response = await fetch('/api/facility-equipment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, unit: eq?.unit || currentUnit }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete');
        }
        setEquipment(prev => prev.filter(e => e.id !== id));
      } catch (e) {
        console.error('Failed to delete equipment from DB:', e);
        alert('Failed to delete equipment. Please try again.');
      }
    }
  };

  const startInlineEdit = (eq: Equipment) => {
    setEditingId(eq.id);
    setEditForm({ ...eq });
  };

  const saveInlineEdit = () => {
    if (!editForm) return;
    setEquipment(prev => prev.map(eq => eq.id === editForm.id ? editForm : eq));
    setEditingId(null);
    setEditForm(null);
  };

  const toggleMonitoring = (activity: string) => {
    if (!editForm) return;
    const current = editForm.monitoringActivity;
    const next = current.includes(activity) ? current.filter(a => a !== activity) : [...current, activity];
    handleUpdateEditForm('monitoringActivity', next);
  };

  // --- Bulk Upload Handlers ---

  const handleDownloadSample = () => {
    const headers = "Equipment Name,Equipment Id Number,Location,Department,Make,Brand,Calibration (Yes/No),Checklist Name";
    const sampleRows = [
      `Walk-in Chiller,CH-001,Kitchen North,Production,ColdTech,Arctic-V1,Yes,${hygieneChecklistNames[0] || ''}`,
      `Convection Oven,OV-202,Bakery,Pastry,HeatStream,Master-Pro,No,${hygieneChecklistNames[1] || hygieneChecklistNames[0] || ''}`
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...sampleRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "facility_equipment_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== "");
      if (lines.length < 2) return;

      const staged: Partial<Equipment>[] = lines.slice(1).map((line, idx) => {
        const parts = line.split(',').map(p => p.trim());
        const rawLoc = parts[2] || "";
        const rawDept = parts[3] || "";
        const rawCal = (parts[6] || "").toLowerCase();
        const rawChecklist = parts[7] || "";
        
        // Logical soft-matching for boolean
        const calBool = rawCal === 'yes' || rawCal === 'y' || rawCal === 'true' || rawCal === '1';
        
        const now = new Date().toISOString().split('T')[0];

        return {
          id: `bulk-${Date.now()}-${idx}`,
          name: parts[0] || 'Unknown',
          idNumber: parts[1] || 'TBD',
          location: rawLoc,
          department: rawDept,
          make: parts[4] || 'TBD',
          brand: parts[5] || 'TBD',
          calibrationRequired: calBool,
          status: 'Active' as const,
          regional: dynamicRegionalOptions[0] || REGIONAL_OPTIONS[0],
          unit: dynamicUnitOptions[0] || UNIT_OPTIONS[0],
          
          cleaningChecklist: rawChecklist || hygieneChecklistNames[0] || '',
          cleaningFrequencyValue: 1,
          cleaningFrequencyUnit: 'Days',
          cleaningStartDate: now,
          
          pmChecklist: rawChecklist || hygieneChecklistNames[0] || '',
          pmFrequencyValue: 1,
          pmFrequencyUnit: 'Months',
          pmStartDate: now,
          
          calibrationFrequencyValue: 1,
          calibrationFrequencyUnit: 'Years',
          calibrationStartDate: now,
          
          monitoringActivity: []
        };
      });

      setBulkStagedData(staged);
      setIsBulkUploadModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const bulkMatchScore = (input: string, options: string[]): number => {
    if (!input) return 0;
    const norm = input.toLowerCase().trim();
    if (options.some(o => o.toLowerCase() === norm)) return 100;
    if (options.some(o => o.toLowerCase().includes(norm) || norm.includes(o.toLowerCase()))) return 60;
    return 0;
  };

  const bulkBestMatch = (input: string, options: string[]): string => {
    if (!input || options.length === 0) return options[0] ?? '';
    const norm = input.toLowerCase().trim();
    // 1. Exact match
    const exact = options.find(o => o.toLowerCase() === norm);
    if (exact) return exact;
    // 2. Starts-with
    const startsWith = options.find(o => o.toLowerCase().startsWith(norm) || norm.startsWith(o.toLowerCase()));
    if (startsWith) return startsWith;
    // 3. Contains (either direction)
    const contains = options.find(o => o.toLowerCase().includes(norm) || norm.includes(o.toLowerCase()));
    if (contains) return contains;
    // 4. Word overlap — find option with most words in common
    const inputWords = norm.split(/\W+/).filter(Boolean);
    let bestOption = options[0];
    let bestOverlap = 0;
    for (const o of options) {
      const optWords = o.toLowerCase().split(/\W+/).filter(Boolean);
      const overlap = inputWords.filter(w => optWords.some(ow => ow.includes(w) || w.includes(ow))).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; bestOption = o; }
    }
    if (bestOverlap > 0) return bestOption;
    // 5. Character-level similarity (bigram overlap)
    const bigrams = (s: string) => { const b: string[] = []; for (let i = 0; i < s.length - 1; i++) b.push(s.slice(i, i + 2)); return b; };
    const inputBigrams = bigrams(norm);
    let bestSim = -1;
    for (const o of options) {
      const oBigrams = bigrams(o.toLowerCase());
      const shared = inputBigrams.filter(b => oBigrams.includes(b)).length;
      const sim = (2 * shared) / (inputBigrams.length + oBigrams.length || 1);
      if (sim > bestSim) { bestSim = sim; bestOption = o; }
    }
    return bestOption;
  };

  const removeBulkRow = (idx: number) => {
    setBulkStagedData(prev => prev.filter((_, i) => i !== idx));
    setBulkRowEdits(prev => {
      const next: Record<number, { location?: string; department?: string; checklist?: string }> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  };

  const addBulkRow = () => {
    setBulkStagedData(prev => [...prev, { name: '', brand: '', make: '', location: '', department: '', cleaningChecklist: '' }]);
  };

  const drawStyledQrCard = (ctx: CanvasRenderingContext2D, qrCanvas: HTMLCanvasElement, x: number, y: number, cardW: number, cardH: number, isClean: boolean, eqName: string, checklistLabel: string, freqLabel: string) => {
    const headerColor = isClean ? '#2563eb' : '#ea580c';
    const accentColor = isClean ? '#1d4ed8' : '#c2410c';
    const bgColor = isClean ? '#eff6ff' : '#fff7ed';
    const HEADER_H = 52;
    const RADIUS = 20;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, RADIUS);
    ctx.clip();
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, cardW, cardH);
    ctx.fillStyle = headerColor;
    ctx.fillRect(x, y, cardW, HEADER_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px Arial, sans-serif';
    ctx.textAlign = 'left';
    const dotX = x + 16;
    const dotY = y + HEADER_H / 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText((isClean ? 'CLEANING' : 'MAINTENANCE').toUpperCase(), dotX + 14, dotY + 6);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, RADIUS);
    ctx.clip();

    const QR_SIZE = cardW * 0.7;
    const QR_X = x + (cardW - QR_SIZE) / 2;
    const QR_Y = y + HEADER_H + 20;
    const pad = 14;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(QR_X - pad, QR_Y - pad, QR_SIZE + pad * 2, QR_SIZE + pad * 2, 12);
    ctx.fill();
    ctx.stroke();
    ctx.drawImage(qrCanvas, QR_X, QR_Y, QR_SIZE, QR_SIZE);

    const INFO_Y = QR_Y + QR_SIZE + pad + 22;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    const nm = eqName.toUpperCase();
    ctx.fillText(nm.length > 24 ? nm.slice(0, 23) + '…' : nm, x + cardW / 2, INFO_Y);
    ctx.fillStyle = headerColor;
    ctx.font = 'bold 11px Arial, sans-serif';
    const cl = checklistLabel;
    ctx.fillText(cl.length > 28 ? cl.slice(0, 27) + '…' : cl, x + cardW / 2, INFO_Y + 20);

    if (freqLabel) {
      const pillW = ctx.measureText(freqLabel).width + 40;
      const pillH = 26;
      const pillX = x + (cardW - pillW) / 2;
      const pillY = INFO_Y + 30;
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.fillText('⏱ ' + freqLabel, x + cardW / 2, pillY + pillH / 2 + 4);
    }

    ctx.restore();

    ctx.strokeStyle = isClean ? '#bfdbfe' : '#fed7aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardW, cardH, RADIUS);
    ctx.stroke();
  };

  const downloadAllQRCodes = async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    for (const eq of equipment) {
      const cleanCanvas = document.getElementById(`bulk-qr-canvas-${eq.id}-cleaning`) as HTMLCanvasElement | null;
      const pmCanvas = document.getElementById(`bulk-qr-canvas-${eq.id}-maintenance`) as HTMLCanvasElement | null;
      if (!cleanCanvas && !pmCanvas) continue;

      const CARD_W = 320;
      const CARD_H = 440;
      const GAP = 40;
      const PAD = 40;
      const TOTAL_W = PAD + CARD_W + GAP + CARD_W + PAD;
      const TOTAL_H = PAD + CARD_H + PAD;

      const composite = document.createElement('canvas');
      composite.width = TOTAL_W;
      composite.height = TOTAL_H;
      const ctx = composite.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

      const cleanFreq = `Every ${eq.cleaningFrequencyValue || 1} ${eq.cleaningFrequencyUnit || 'Days'}`;
      const pmFreq = `Every ${eq.pmFrequencyValue || 1} ${eq.pmFrequencyUnit || 'Months'}`;
      const cleanChecklist = eq.cleaningChecklist || 'Standard Sanitization';
      const pmChecklist = eq.pmChecklist || 'Preventive Maintenance';

      if (cleanCanvas) {
        drawStyledQrCard(ctx, cleanCanvas, PAD, PAD, CARD_W, CARD_H, true, eq.name || 'Asset', cleanChecklist, cleanFreq);
      }
      if (pmCanvas) {
        drawStyledQrCard(ctx, pmCanvas, PAD + CARD_W + GAP, PAD, CARD_W, CARD_H, false, eq.name || 'Asset', pmChecklist, pmFreq);
      }

      const blob = await new Promise<Blob | null>(res => composite.toBlob(res, 'image/png'));
      if (blob) {
        const safeName = (eq.name || 'asset').replace(/[^a-zA-Z0-9_-]/g, '_');
        zip.file(`${safeName}_${eq.idNumber || eq.id}.png`, blob);
      }
    }
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'equipment_qr_codes.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitBulkUpload = () => {
    const finalized = bulkStagedData.map((item, idx) => {
      const edits = bulkRowEdits[idx] || {};
      const loc = edits.location ?? bulkBestMatch(item.location ?? '', LOCATION_OPTIONS);
      const dept = edits.department ?? bulkBestMatch(item.department ?? '', DEPT_OPTIONS);
      const rawCL = item.cleaningChecklist ?? '';
      const resolvedCL = edits.checklist ?? (hygieneChecklistNames.length > 0 ? bulkBestMatch(rawCL, hygieneChecklistNames) : rawCL);
      return { ...item, location: loc, department: dept, cleaningChecklist: resolvedCL, pmChecklist: resolvedCL } as Equipment;
    });

    setEquipment(prev => [...finalized, ...prev]);
    setIsBulkUploadModalOpen(false);
    setBulkStagedData([]);
    setBulkRowEdits({});
  };

  const handleAddNewSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const activities = [];
    if (formData.get('mon_temp')) activities.push('Temperature');
    if (formData.get('mon_hum')) activities.push('Humidity');

    const payload: Equipment = {
      id: `eq-${Date.now()}`,
      name: data.name as string,
      idNumber: data.idNumber as string,
      location: data.location as string,
      department: data.department as string,
      unit: data.unit as string,
      regional: data.regional as string,
      make: data.make as string,
      brand: data.brand as string,
      
      cleaningChecklist: '',
      cleaningFrequencyValue: 1,
      cleaningFrequencyUnit: 'Days' as const,
      cleaningDay: 'Monday',
      cleaningStartDate: new Date().toISOString().split('T')[0],
      
      pmChecklist: '',
      pmFrequencyValue: 1,
      pmFrequencyUnit: 'Days' as const,
      pmDay: 'Monday',
      pmStartDate: new Date().toISOString().split('T')[0],
      
      calibrationRequired: data.calibrationRequired === 'on',
      calibrationFrequencyValue: parseInt(data.calibrationFrequencyValue as string) || 1,
      calibrationFrequencyUnit: data.calibrationFrequencyUnit as any,
      calibrationStartDate: data.calibrationStartDate as string,
      
      monitoringActivity: activities,
      status: 'Active'
    };

    setEquipment(prev => [payload, ...prev]);
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {externalSubTab === 'facility' && (
        <div className="bg-white rounded-xl sm:rounded-[2.5rem] border border-slate-200 shadow-xl p-3 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <div className="flex flex-col gap-3 sm:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 z-10">
              <div className="p-2.5 sm:p-3.5 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shadow-inner border border-indigo-100 shrink-0">
                <ShieldCheck size={20} className="sm:block hidden" />
                <ShieldCheck size={16} className="sm:hidden" />
              </div>
              <div>
                <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Facility Hygiene</h2>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-1.5 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Equipment, Cleaning, Maintenance, Calibration & Pest Control</p>
              </div>
            </div>
            <div className="flex bg-slate-100/80 p-0.5 sm:p-1 rounded-lg sm:rounded-2xl border border-slate-200 shadow-inner w-full overflow-x-auto hide-scrollbar">
              {FACILITY_TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setInternalTab(tab.id)}
                    className={`px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1 sm:gap-2 flex-shrink-0 ${
                      internalTab === tab.id
                        ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={11} className="sm:block hidden" strokeWidth={2.5} />
                    <Icon size={10} className="sm:hidden" strokeWidth={2.5} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'fac-equipment' && (
        <div className="space-y-4 sm:space-y-8 animate-in fade-in duration-500">
            {/* Header and Search */}
            <div className="flex flex-col gap-3 sm:gap-6 mb-2 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                <div className="p-3 sm:p-4 bg-indigo-600 text-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl sm:shadow-indigo-100 sm:ring-4 sm:ring-white shrink-0">
                  <Warehouse size={22} className="sm:block hidden" />
                  <Warehouse size={18} className="sm:hidden" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Asset Fleet</h3>
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mt-1 sm:mt-2 flex items-center gap-1 sm:gap-2">
                    <ShieldCheck size={10} className="sm:block hidden text-emerald-500" /> <span className="hidden sm:inline">Infrastructure Maintenance Registry</span><span className="sm:hidden">Maintenance Registry</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
                <div className="relative group flex-1 sm:w-64 min-w-[200px] order-2 sm:order-1">
                  <Search className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search Asset, SKU..." 
                    className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border-2 border-slate-100 rounded-lg sm:rounded-2xl text-xs sm:text-sm font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2 flex-shrink-0">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => { handleFileUpload(e); setIsImportDrawerOpen(false); }} />
                    <button onClick={() => setIsImportDrawerOpen(true)} className="px-2.5 sm:px-5 py-2 sm:py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-2 hover:bg-indigo-50 transition-all active:scale-95 shadow-sm flex-shrink-0"><Upload size={12} className="sm:block hidden" strokeWidth={3} /> <span className="hidden sm:inline">Import CSV</span></button>
                    <button onClick={downloadAllQRCodes} disabled={equipment.length === 0} className="px-2.5 sm:px-5 py-2 sm:py-3 bg-white border-2 border-emerald-100 text-emerald-600 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-2 hover:bg-emerald-50 transition-all active:scale-95 shadow-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"><QrCode size={12} className="sm:block hidden" strokeWidth={3} /> <span className="hidden sm:inline">QR Codes</span><span className="sm:hidden"><QrCode size={12} strokeWidth={3}/></span></button>
                    {/* Filter icon button with popover */}
                    <div className="relative" ref={filterPopoverRef}>
                      <button
                        onClick={() => setIsFilterOpen(v => !v)}
                        className={`relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl border-2 transition-all active:scale-95 ${(selectedRegional || selectedUnit) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : isFilterOpen ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}`}
                        title="Location Filters"
                      >
                        <Filter size={15} strokeWidth={2.5} />
                        {(selectedRegional || selectedUnit) && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full text-[7px] font-black text-white flex items-center justify-center leading-none">
                            {[selectedRegional, selectedUnit].filter(Boolean).length}
                          </span>
                        )}
                      </button>
                      {isFilterOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-150">
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location Filter</span>
                              {(selectedRegional || selectedUnit) && (
                                <button onClick={() => { setSelectedRegional(''); setSelectedUnit(''); }} className="text-[8px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest">Reset All</button>
                              )}
                            </div>
                            <div className="p-4 space-y-4">
                              {/* Regional Hub */}
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Regional Hub</label>
                                <div className="flex gap-2">
                                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all">
                                    <Globe size={13} className="text-slate-400 shrink-0" />
                                    <select value={selectedRegional} onChange={e => setSelectedRegional(e.target.value)} className="flex-1 bg-transparent text-xs font-bold text-slate-800 uppercase focus:outline-none cursor-pointer">
                                      <option value="">All Regions</option>
                                      {dynamicRegionalOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                  </div>
                                  <button onClick={() => setSelectedRegional('')} disabled={!selectedRegional} className={`p-2.5 rounded-xl border transition-all ${selectedRegional ? 'bg-slate-100 border-slate-300 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50' : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'}`}>
                                    <RotateCcw size={13} />
                                  </button>
                                </div>
                              </div>
                              {/* Operational Unit */}
                              <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Operational Unit</label>
                                <div className="flex gap-2">
                                  <div className="flex items-center gap-2 flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 transition-all">
                                    <Warehouse size={13} className="text-slate-400 shrink-0" />
                                    <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="flex-1 bg-transparent text-xs font-bold text-slate-800 uppercase focus:outline-none cursor-pointer">
                                      <option value="">All Units</option>
                                      {dynamicUnitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                  </div>
                                  <button onClick={() => setSelectedUnit('')} disabled={!selectedUnit} className={`p-2.5 rounded-xl border transition-all ${selectedUnit ? 'bg-slate-100 border-slate-300 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50' : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'}`}>
                                    <RotateCcw size={13} />
                                  </button>
                                </div>
                              </div>
                              {/* Active tags */}
                              {(selectedRegional || selectedUnit) && (
                                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                                  {selectedRegional && <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-bold uppercase"><Globe size={9}/>{selectedRegional}</span>}
                                  {selectedUnit && <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[8px] font-bold uppercase"><Warehouse size={9}/>{selectedUnit}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="px-2.5 sm:px-6 py-2 sm:py-3 bg-slate-900 text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-1 sm:gap-2 flex-shrink-0"><Plus size={14} className="sm:block hidden" strokeWidth={3} /> <span className="hidden sm:inline">New Asset</span><Plus size={12} className="sm:hidden" strokeWidth={3} /></button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
                {filteredEquipment.map((eq, index) => {
                  const isEditing = editingId === eq.id;
                  const ef = isEditing && editForm ? editForm : null;

                  return (
                    <div key={eq.id} className={`relative bg-white rounded-2xl border transition-all duration-300 group ${isEditing ? 'border-2 border-indigo-400 shadow-xl shadow-indigo-100 bg-indigo-50/20' : eq.status === 'Inactive' ? 'opacity-60 border-slate-200 bg-slate-50/50' : 'border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/8'}`}>

                      {/* ═══ MOBILE VIEW (< md) ═══ */}
                      <div className="md:hidden flex flex-col border border-slate-100">
                        {/* Mobile Header Strip */}
                        <div className={`flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100`}>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${eq.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {eq.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 tracking-wider">#{eq.idNumber}</span>
                            {eq.calibrationRequired && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[8px] font-black uppercase flex items-center gap-1">
                                <ShieldAlert size={8} /> CAL
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mobile Main Content */}
                        <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100">
                          {/* Icon */}
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${ef ? 'bg-indigo-600 text-white' : eq.status === 'Active' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Wrench size={24} strokeWidth={1.8} />
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            {ef ? (
                              <div className="space-y-1.5">
                                <input value={ef.name} onChange={e => handleUpdateEditForm('name', e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-[13px] font-black uppercase focus:ring-2 focus:ring-indigo-400 outline-none" />
                                <div className="flex gap-1.5">
                                  <input value={ef.make} onChange={e => handleUpdateEditForm('make', e.target.value)} placeholder="Make" className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase focus:border-indigo-400 outline-none" />
                                  <input value={ef.brand} onChange={e => handleUpdateEditForm('brand', e.target.value)} placeholder="Brand" className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase focus:border-indigo-400 outline-none" />
                                </div>
                                <input value={ef.idNumber} onChange={e => handleUpdateEditForm('idNumber', e.target.value)} placeholder="ID #" className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-mono font-bold focus:border-indigo-400 outline-none" />
                              </div>
                            ) : (
                              <>
                                <h4 className="text-[15px] font-black text-indigo-700 uppercase tracking-tight leading-tight mb-0.5">{eq.name}</h4>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Building size={9} className="text-slate-400 shrink-0" />
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{eq.make}</span>
                                  {eq.brand && <span className="text-slate-300">·</span>}
                                  {eq.brand && <Tag size={9} className="text-slate-400 shrink-0" />}
                                  {eq.brand && <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{eq.brand}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {eq.brand && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-bold">{eq.brand}</span>}
                                  {eq.location && <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[8px] font-bold">{eq.location}</span>}
                                  {eq.department && <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[8px] font-bold">{eq.department}</span>}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Mobile Location Details — chips view or edit selects */}
                        {ef && (
                          <div className="px-4 py-3 border-b border-slate-100 grid grid-cols-2 gap-2">
                            {[
                              { label: 'Regional', field: 'regional', options: dynamicRegionalOptions.length > 0 ? dynamicRegionalOptions : REGIONAL_OPTIONS },
                              { label: 'Unit', field: 'unit', options: dynamicUnitOptions.length > 0 ? dynamicUnitOptions : UNIT_OPTIONS },
                              { label: 'Dept', field: 'department', options: DEPT_OPTIONS },
                              { label: 'Location', field: 'location', options: LOCATION_OPTIONS },
                            ].map(({ label, field, options }) => (
                              <div key={field} className="space-y-0.5">
                                <p className="text-[7px] font-black text-slate-400 uppercase ml-0.5">{label}</p>
                                <div className="relative">
                                  <select value={(ef as any)[field] || ''} onChange={e => handleUpdateEditForm(field, e.target.value)} className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-slate-700 pr-5 focus:border-indigo-400 outline-none">
                                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                  <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 overflow-x-auto hide-scrollbar ${ef ? 'hidden' : ''}`}>
                          {eq.regional && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                              <Globe size={10} className="text-slate-400" />
                              <span className="text-[7px] font-bold text-slate-600 uppercase whitespace-nowrap">{eq.regional}</span>
                            </div>
                          )}
                          {eq.unit && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                              <Warehouse size={10} className="text-slate-400" />
                              <span className="text-[7px] font-bold text-slate-600 uppercase whitespace-nowrap">{eq.unit}</span>
                            </div>
                          )}
                          {eq.department && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                              <Building size={10} className="text-slate-400" />
                              <span className="text-[7px] font-bold text-slate-600 uppercase whitespace-nowrap">{eq.department}</span>
                            </div>
                          )}
                          {eq.location && (
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                              <MapPin size={10} className="text-slate-400" />
                              <span className="text-[7px] font-bold text-slate-600 uppercase whitespace-nowrap">{eq.location}</span>
                            </div>
                          )}
                        </div>

                        {/* Mobile Action Buttons (horizontal row) */}
                        <div className="flex items-center gap-1.5 px-4 py-3 justify-center">
                          {ef ? (
                            <>
                              <button onClick={saveInlineEdit} className="flex-1 py-2.5 flex items-center justify-center gap-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-indigo-700 active:scale-95 transition-all shadow-md"><Check size={14} /> Save</button>
                              <button onClick={() => setEditingId(null)} className="flex-1 py-2.5 flex items-center justify-center bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wide hover:bg-slate-200 active:scale-95 transition-all">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setQrCodeModal(eq)} className="flex-1 py-2 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400 rounded-lg hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all active:scale-90" title="QR Code"><QrCode size={14} /></button>
                              <button onClick={() => startInlineEdit(eq)} className="flex-1 py-2 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all active:scale-90" title="Edit"><Edit3 size={14} /></button>
                              <button onClick={() => toggleStatus(eq.id)} className={`flex-1 py-2 flex items-center justify-center rounded-lg border transition-all active:scale-90 ${eq.status === 'Active' ? 'bg-slate-50 border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50' : 'bg-emerald-500 border-emerald-500 text-white'}`} title={eq.status === 'Active' ? 'Deactivate' : 'Activate'}><Power size={14} /></button>
                              <button onClick={() => deleteEquipment(eq.id)} className="flex-1 py-2 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-300 rounded-lg hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all active:scale-90" title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* ═══ DESKTOP VIEW (≥ md) ═══ */}
                      <div className="hidden md:flex items-center gap-4 px-6 py-4 border border-slate-100">

                        {/* Icon + Status */}
                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${eq.status === 'Active' ? 'bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Wrench size={20} strokeWidth={1.8} />
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${eq.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {eq.status}
                          </span>
                        </div>

                        {/* Equipment Details */}
                        <div className="flex-1 min-w-0">
                          {ef ? (
                            <div className="space-y-1.5">
                              <input value={ef.name} onChange={e => handleUpdateEditForm('name', e.target.value)} placeholder="Asset Name" className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-sm font-black uppercase focus:ring-2 focus:ring-indigo-400 outline-none" />
                              <div className="flex gap-1.5">
                                <input value={ef.make} onChange={e => handleUpdateEditForm('make', e.target.value)} placeholder="Make" className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase focus:border-indigo-400 outline-none" />
                                <input value={ef.brand} onChange={e => handleUpdateEditForm('brand', e.target.value)} placeholder="Brand" className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold uppercase focus:border-indigo-400 outline-none" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight group-hover:text-indigo-700 transition-colors mb-1">{eq.name}</h4>
                              <div className="flex items-center gap-2 mb-1.5 text-[8px] font-bold text-slate-500 uppercase">
                                <Building size={8} className="text-slate-400 shrink-0" />
                                <span>{eq.make}</span>
                                {eq.brand && <><span className="text-slate-300">·</span><Tag size={8} className="text-slate-400 shrink-0" /><span>{eq.brand}</span></>}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {eq.brand && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[7px] font-bold">{eq.brand}</span>}
                                {eq.location && <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 border border-slate-200 rounded text-[7px] font-bold">{eq.location}</span>}
                              </div>
                            </>
                          )}
                        </div>

                        {/* ID Badge */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          {ef ? (
                            <input value={ef.idNumber} onChange={e => handleUpdateEditForm('idNumber', e.target.value)} placeholder="ID #" className="w-20 px-2 py-1 bg-white border border-indigo-300 rounded text-[9px] font-mono font-bold text-center focus:ring-2 focus:ring-indigo-400 outline-none" />
                          ) : (
                            <span className="text-[7px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 tracking-wider">#{eq.idNumber}</span>
                          )}
                          {(ef ? ef.calibrationRequired : eq.calibrationRequired) && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[7px] font-black uppercase flex items-center gap-1">
                              <ShieldAlert size={8} /> CAL
                            </span>
                          )}
                        </div>

                        {/* Location Info */}
                        {ef ? (
                          <div className="grid grid-cols-2 gap-1 shrink-0 w-56">
                            {[
                              { label: 'Regional', field: 'regional', options: dynamicRegionalOptions.length > 0 ? dynamicRegionalOptions : REGIONAL_OPTIONS },
                              { label: 'Unit', field: 'unit', options: dynamicUnitOptions.length > 0 ? dynamicUnitOptions : UNIT_OPTIONS },
                              { label: 'Dept', field: 'department', options: DEPT_OPTIONS },
                              { label: 'Location', field: 'location', options: LOCATION_OPTIONS },
                            ].map(({ label, field, options }) => (
                              <div key={field} className="space-y-0.5">
                                <p className="text-[7px] font-black text-slate-400 uppercase ml-0.5">{label}</p>
                                <div className="relative">
                                  <select value={(ef as any)[field] || ''} onChange={e => handleUpdateEditForm(field, e.target.value)} className="w-full appearance-none bg-white border border-slate-200 rounded px-1.5 py-1 text-[8px] font-bold text-slate-700 pr-4 focus:border-indigo-400 outline-none">
                                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                  <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 shrink-0 text-[8px] font-bold text-slate-500 uppercase">
                            <div className="flex items-center gap-1">
                              <Globe size={8} className="text-indigo-400 shrink-0" />
                              <span className="truncate">{eq.regional}</span>
                              {eq.unit && <><span className="text-slate-300">·</span><span className="truncate max-w-[80px]">{eq.unit}</span></>}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin size={8} className="text-indigo-400 shrink-0" />
                              <span className="truncate">{eq.department}</span>
                              {eq.location && <><span className="text-slate-300">·</span><span className="truncate max-w-[80px]">{eq.location}</span></>}
                            </div>
                          </div>
                        )}

                        {/* Desktop Action Buttons (horizontal) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {ef ? (
                            <>
                              <button onClick={saveInlineEdit} className="p-2 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm active:scale-90" title="Save changes"><Check size={14} /></button>
                              <button onClick={() => setEditingId(null)} className="p-2 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-100 transition-all shadow-sm active:scale-90" title="Cancel"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setQrCodeModal(eq)} className="p-2 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm active:scale-90" title="QR Codes"><QrCode size={14} /></button>
                              <button onClick={() => startInlineEdit(eq)} className="p-2 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm active:scale-90" title="Edit"><Edit3 size={14} /></button>
                              <button onClick={() => toggleStatus(eq.id)} className={`p-2 flex items-center justify-center rounded-lg border transition-all shadow-sm active:scale-90 ${eq.status === 'Active' ? 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50' : 'bg-emerald-500 border-emerald-500 text-white'}`} title={eq.status === 'Active' ? 'Deactivate' : 'Activate'}><Power size={14} /></button>
                              <button onClick={() => deleteEquipment(eq.id)} className="p-2 flex items-center justify-center bg-white border border-slate-200 text-slate-300 rounded-lg hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm active:scale-90" title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>

                      </div>

                      {(() => {
                        const linked = getLinkedChecklists(eq.id, eq);
                        const cl = linked.hygieneChecklist;
                        const hFreq = cl && typeof cl.cleaningFrequency === 'object' && cl.cleaningFrequency ? cl.cleaningFrequency : null;
                        const pFreq = cl && typeof cl.pmFrequency === 'object' && cl.pmFrequency ? cl.pmFrequency : null;
                        const hResp = cl ? (Array.isArray(cl.cleaningResponsibility) ? cl.cleaningResponsibility : (cl.cleaningResponsibility ? [cl.cleaningResponsibility] : [])) : [];
                        const pResp = cl ? (Array.isArray(cl.pmResponsibility) ? cl.pmResponsibility : (cl.pmResponsibility ? [cl.pmResponsibility] : [])) : [];
                        const calDevices = [];
                        const breakdowns = [];
                        const activeBreakdowns = breakdowns.filter(b => b.status === 'Reported' || b.status === 'In Progress');
                        const resolvedBreakdowns = breakdowns.filter(b => b.status === 'Resolved');
                        const totalCost = breakdowns.reduce((sum, b) => sum + b.cost, 0);
                        const totalDowntime = breakdowns.reduce((sum, b) => sum + (b.downtimeHours || 0), 0);
                        const getCalStatus = (dev: CalibrationDevice) => { const today = new Date(); const next = new Date(dev.nextCalibrationDate); const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000); if (!dev.isActive) return { label: 'Inactive', style: 'bg-slate-100 text-slate-500 border-slate-200' }; if (diff < 0) return { label: 'Expired', style: 'bg-rose-50 text-rose-700 border-rose-200' }; if (diff < 30) return { label: 'Due Soon', style: 'bg-amber-50 text-amber-700 border-amber-200' }; return { label: 'Valid', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }; };

                        return (
                      <>
                      {/* Inline Edit — Calibration & Monitoring panel (only when editing) */}
                      {ef && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-2 border-indigo-200 bg-indigo-50/30">
                          <div className="p-4 border-b md:border-b-0 md:border-r border-indigo-100">
                            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Gauge size={10} /> Calibration</span>
                            <label className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer mb-2">
                              <span className="text-[8px] font-black text-slate-500 uppercase">Required</span>
                              <input type="checkbox" checked={ef.calibrationRequired} onChange={e => handleUpdateEditForm('calibrationRequired', e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600" />
                            </label>
                            {ef.calibrationRequired && (
                              <div className="space-y-1.5">
                                <div className="flex gap-1">
                                  <input type="number" min="1" value={ef.calibrationFrequencyValue} onChange={e => handleUpdateEditForm('calibrationFrequencyValue', parseInt(e.target.value))} className="w-1/2 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none" />
                                  <select value={ef.calibrationFrequencyUnit} onChange={e => handleUpdateEditForm('calibrationFrequencyUnit', e.target.value)} className="w-1/2 px-1 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold uppercase outline-none appearance-none"><option>Days</option><option>Weeks</option><option>Months</option><option>Years</option></select>
                                </div>
                                <div><label className="text-[7px] font-black uppercase text-slate-400 block mb-0.5">Start Date</label><input type="date" value={ef.calibrationStartDate} onChange={e => handleUpdateEditForm('calibrationStartDate', e.target.value)} className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none" /></div>
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Activity size={10} /> Monitoring</span>
                            <div className="space-y-2">
                              <button onClick={() => toggleMonitoring('Temperature')} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${ef.monitoringActivity.includes('Temperature') ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}><Thermometer size={12} /> Temperature</button>
                              <button onClick={() => toggleMonitoring('Humidity')} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${ef.monitoringActivity.includes('Humidity') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}><Droplet size={12} /> Humidity</button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col md:grid md:grid-cols-5 gap-2 p-3 md:p-4 border-t border-slate-100 bg-slate-50/30">
                        <div className="p-3 border border-blue-100 rounded-xl bg-white hover:border-blue-300 hover:shadow-md transition-all min-w-[220px] md:min-w-0 shrink-0 md:shrink">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5"><Droplets size={11} className="text-blue-600" /><span className="text-[8px] font-black text-blue-700 uppercase tracking-widest">Hygiene</span></div>
                              {cl && (
                                <div className="relative inline-block">
                                  <select value={cl.status || 'Active'} onChange={(e) => setFacilityChecklists(prev => prev.map(c => c.id === cl.id ? { ...c, status: e.target.value as any } : c))} className="appearance-none px-2.5 py-1 pr-6 text-[8px] font-bold border border-blue-300 rounded-lg bg-white text-blue-700 hover:border-blue-400 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-200">
                                    <option value="Inactive">Inactive</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Published">Published</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                                </div>
                              )}
                            </div>
                            <div className="relative flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg shrink-0 cursor-pointer hover:bg-blue-100 transition-colors" onDoubleClick={() => { setInlineChecklistEdit({ eqId: eq.id, type: 'hygiene' }); setInlineChecklistSearch(''); }} title="Double-click to change checklist">
                              <p className="text-[7px] font-bold text-slate-500 uppercase">Checklist:</p>
                              <p className="text-[8px] font-black text-slate-700 uppercase">{cl ? cl.title : eq.cleaningChecklist}</p>
                              {inlineChecklistEdit?.eqId === eq.id && inlineChecklistEdit?.type === 'hygiene' && (
                                <div ref={inlineChecklistRef} className="absolute top-full left-0 mt-1 w-[260px] bg-white border border-blue-200 rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                      <Search size={12} className="text-slate-400 shrink-0" />
                                      <input autoFocus type="text" value={inlineChecklistSearch} onChange={e => setInlineChecklistSearch(e.target.value)} placeholder="Search checklists..." className="w-full bg-transparent text-[10px] font-bold outline-none placeholder:text-slate-300 uppercase" onClick={e => e.stopPropagation()} />
                                      {inlineChecklistSearch && <button onClick={(e) => { e.stopPropagation(); setInlineChecklistSearch(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>}
                                    </div>
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {hygieneChecklistNames.filter(n => !inlineChecklistSearch || n.toLowerCase().includes(inlineChecklistSearch.toLowerCase())).length === 0 ? (
                                      <div className="px-3 py-4 text-[10px] font-bold text-slate-400 text-center uppercase">No checklists found</div>
                                    ) : hygieneChecklistNames.filter(n => !inlineChecklistSearch || n.toLowerCase().includes(inlineChecklistSearch.toLowerCase())).map(name => (
                                      <button key={name} onClick={(e) => { e.stopPropagation(); handleInlineChecklistSelect(eq.id, 'hygiene', name); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors border-b border-slate-50 ${name === (eq.cleaningChecklist || '') ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>{name}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {cl && cl.facilitySections && cl.facilitySections.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg shrink-0">
                                <p className="text-[7px] font-bold text-slate-500 uppercase">Sections:</p>
                                <div className="flex gap-0.5">{cl.facilitySections.slice(0, 2).map(s => <span key={s} className="px-1 py-0.5 bg-white text-blue-700 border border-blue-100 rounded text-[6px] font-bold">{s}</span>)}</div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg shrink-0">
                              <p className="text-[7px] font-bold text-slate-500 uppercase">Every</p>
                              <p className="text-[8px] font-black text-blue-700">{hFreq ? `${hFreq.value} ${hFreq.unit}` : `${eq.cleaningFrequencyValue} ${eq.cleaningFrequencyUnit}`}</p>
                            </div>
                            {hResp.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg shrink-0">
                                <p className="text-[7px] font-bold text-slate-500 uppercase">Assigned:</p>
                                <div className="flex gap-0.5">{hResp.slice(0, 2).map(d => <span key={d} className="px-1 py-0.5 bg-white text-blue-700 border border-blue-100 rounded text-[6px] font-black uppercase">{d}</span>)}</div>
                              </div>
                            )}
                            {(() => { const stats = getCleaningStats(eq); return (<div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg"><span className="flex items-center gap-0.5 text-[7px] font-black text-emerald-600"><CheckCircle2 size={8} />{stats.completed}</span><span className="flex items-center gap-0.5 text-[7px] font-black text-rose-500"><XCircle size={8} />{stats.missed}</span></div>); })()}
                            <div className="flex items-center gap-1">
                              <button onClick={() => {
                                const pageName = `${eq.name} Cleaning Checklist`;
                                const byPage = facilityChecklists.find(c => c.pages?.some(p => p.title === pageName));
                                const cl = facilityChecklists.find(c => c.title === eq.cleaningChecklist);
                                const hResp = cl ? (Array.isArray(cl.cleaningResponsibility) ? cl.cleaningResponsibility : (cl.cleaningResponsibility ? [cl.cleaningResponsibility as unknown as string] : [])) : [];
                                const eqInfo: FacilityEquipmentInfo = {
                                  name: eq.name, idNumber: eq.idNumber, location: eq.location, department: eq.department,
                                  make: eq.make, model: eq.brand || '', type: 'cleaning',
                                  frequency: `Every ${eq.cleaningFrequencyValue} ${eq.cleaningFrequencyUnit}`,
                                  day: eq.cleaningDay, startDate: eq.cleaningStartDate,
                                  responsibility: hResp,
                                };
                                setFacilityEquipmentInfo(eqInfo);
                                if (byPage) {
                                  setFacilityChecklistPreview({ ...byPage, pages: byPage.pages.filter(p => p.title === pageName) });
                                } else {
                                  const byEquip = facilityChecklists.find(c => c.attachedEquipmentIds?.includes(eq.id));
                                  const byTitle = facilityChecklists.find(c => c.title === eq.cleaningChecklist);
                                  const fallback = byEquip || byTitle;
                                  if (fallback) {
                                    const cleaningPage = fallback.pages.find(p => p.title?.toLowerCase().includes('clean') || p.title?.toLowerCase().includes('hygiene'));
                                    setFacilityChecklistPreview(cleaningPage ? { ...fallback, pages: [cleaningPage] } : fallback);
                                  }
                                }
                              }} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[6px] font-black uppercase hover:bg-blue-700 transition-all active:scale-95 shrink-0"><ClipboardCheck size={8} /> View</button>
                              <button onClick={() => { setSelectedChecklistPageName(`${eq.name} Cleaning Checklist`); setCleaningChecklistModal(eq); }} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[6px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95 shrink-0"><History size={8} /> History</button>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border border-orange-100 rounded-xl bg-white hover:border-orange-300 hover:shadow-md transition-all min-w-[200px] md:min-w-0 shrink-0 md:shrink">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5"><Hammer size={12} className="text-orange-600" /><span className="text-[8px] font-black text-orange-700 uppercase tracking-widest">Maintenance</span></div>
                              {cl && (
                                <div className="relative inline-block">
                                  <select value={cl.status || 'Active'} onChange={(e) => setFacilityChecklists(prev => prev.map(c => c.id === cl.id ? { ...c, status: e.target.value as any } : c))} className="appearance-none px-2.5 py-1 pr-6 text-[8px] font-bold border border-orange-300 rounded-lg bg-white text-orange-700 hover:border-orange-400 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-orange-200">
                                    <option value="Inactive">Inactive</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Published">Published</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-600 pointer-events-none" />
                                </div>
                              )}
                            </div>
                            <div className="relative flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded shrink-0 cursor-pointer hover:bg-orange-100 transition-colors" onDoubleClick={() => { setInlineChecklistEdit({ eqId: eq.id, type: 'maintenance' }); setInlineChecklistSearch(''); }} title="Double-click to change checklist">
                              <p className="text-[7px] font-bold text-slate-500 uppercase">Checklist:</p>
                              <p className="text-[7px] font-black text-slate-700 uppercase line-clamp-1">{cl ? cl.title : (eq.pmChecklist || 'Preventive Maintenance')}</p>
                              {inlineChecklistEdit?.eqId === eq.id && inlineChecklistEdit?.type === 'maintenance' && (
                                <div ref={inlineChecklistRef} className="absolute top-full left-0 mt-1 w-[260px] bg-white border border-orange-200 rounded-xl shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                      <Search size={12} className="text-slate-400 shrink-0" />
                                      <input autoFocus type="text" value={inlineChecklistSearch} onChange={e => setInlineChecklistSearch(e.target.value)} placeholder="Search checklists..." className="w-full bg-transparent text-[10px] font-bold outline-none placeholder:text-slate-300 uppercase" onClick={e => e.stopPropagation()} />
                                      {inlineChecklistSearch && <button onClick={(e) => { e.stopPropagation(); setInlineChecklistSearch(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>}
                                    </div>
                                  </div>
                                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {hygieneChecklistNames.filter(n => !inlineChecklistSearch || n.toLowerCase().includes(inlineChecklistSearch.toLowerCase())).length === 0 ? (
                                      <div className="px-3 py-4 text-[10px] font-bold text-slate-400 text-center uppercase">No checklists found</div>
                                    ) : hygieneChecklistNames.filter(n => !inlineChecklistSearch || n.toLowerCase().includes(inlineChecklistSearch.toLowerCase())).map(name => (
                                      <button key={name} onClick={(e) => { e.stopPropagation(); handleInlineChecklistSelect(eq.id, 'maintenance', name); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors border-b border-slate-50 ${name === (eq.pmChecklist || '') ? 'bg-orange-50 text-orange-700' : 'text-slate-700 hover:bg-slate-50'}`}>{name}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {cl && cl.facilitySections && cl.facilitySections.length > 0 && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded shrink-0">
                                <p className="text-[7px] font-bold text-slate-500 uppercase">Sections:</p>
                                <div className="flex gap-0.5">{cl.facilitySections.slice(0, 2).map(s => <span key={s} className="px-1 py-0.5 bg-white text-orange-700 border border-orange-100 rounded text-[6px] font-bold">{s}</span>)}</div>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded shrink-0">
                              <p className="text-[7px] font-bold text-slate-500 uppercase">Every</p>
                              <p className="text-[7px] font-black text-orange-700">{pFreq ? `${pFreq.value} ${pFreq.unit}` : `${eq.pmFrequencyValue} ${eq.pmFrequencyUnit}`}</p>
                            </div>
                            {cl && (
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 rounded shrink-0">
                                <p className="text-[7px] font-bold text-slate-500 uppercase">Q:</p>
                                <p className="text-[7px] font-black text-orange-700">{cl.pages ? cl.pages.reduce((sum, p) => sum + (p.questions ? p.questions.length : 0), 0) : 0}</p>
                              </div>
                            )}
                            {pResp.length > 0 && (
                              <div className="flex gap-0.5">{pResp.slice(0, 1).map(d => <span key={d} className="px-1 py-0.5 bg-orange-50 text-orange-700 border border-orange-100 rounded text-[6px] font-black uppercase">{d}</span>)}</div>
                            )}
                            <Activity size={10} className="text-orange-600" />
                            <div className="flex items-center gap-1">
                              <button onClick={() => {
                                const pageName = `${eq.name} PM Checklist`;
                                const byPage = facilityChecklists.find(c => c.pages?.some(p => p.title === pageName));
                                const clPm = facilityChecklists.find(c => c.title === eq.pmChecklist);
                                const pResp = clPm ? (Array.isArray(clPm.pmResponsibility) ? clPm.pmResponsibility : (clPm.pmResponsibility ? [clPm.pmResponsibility as unknown as string] : [])) : [];
                                const eqInfo: FacilityEquipmentInfo = {
                                  name: eq.name, idNumber: eq.idNumber, location: eq.location, department: eq.department,
                                  make: eq.make, model: eq.brand || '', type: 'maintenance',
                                  frequency: `Every ${eq.pmFrequencyValue} ${eq.pmFrequencyUnit}`,
                                  day: eq.pmDay, startDate: eq.pmStartDate,
                                  responsibility: pResp,
                                };
                                setFacilityEquipmentInfo(eqInfo);
                                if (byPage) {
                                  setFacilityChecklistPreview({ ...byPage, pages: byPage.pages.filter(p => p.title === pageName) });
                                } else {
                                  const byEquip = facilityChecklists.find(c => c.attachedEquipmentIds?.includes(eq.id));
                                  const byTitle = facilityChecklists.find(c => c.title === eq.pmChecklist);
                                  const fallback = byEquip || byTitle;
                                  if (fallback) {
                                    const pmPage = fallback.pages.find(p => p.title?.toLowerCase().includes('pm') || p.title?.toLowerCase().includes('maintenance') || p.title?.toLowerCase().includes('preventive'));
                                    setFacilityChecklistPreview(pmPage ? { ...fallback, pages: [pmPage] } : fallback);
                                  }
                                }
                              }} className="flex items-center justify-center gap-1 px-2 py-1 bg-orange-600 text-white rounded text-[6px] font-black uppercase hover:bg-orange-700 transition-all active:scale-95 shrink-0"><ClipboardCheck size={7} /> View</button>
                              <button onClick={() => { setSelectedChecklistPageName(`${eq.name} PM Checklist`); setCleaningChecklistModal(eq); }} className="flex items-center justify-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-[6px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95 shrink-0"><History size={7} /> History</button>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border border-amber-100 rounded-xl bg-white hover:border-amber-300 transition-all min-w-[160px] md:min-w-0 shrink-0 md:shrink">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 shrink-0"><Gauge size={10} className="text-amber-600" /><span className="text-[8px] font-black text-amber-700 uppercase">Calibration</span></div>
                            {eq.calibrationRequired ? (
                              <>
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded text-[6px] font-bold">
                                  <span className="text-slate-600">Every</span>
                                  <span className="text-amber-700 font-black">{eq.calibrationFrequencyValue} {eq.calibrationFrequencyUnit}</span>
                                </div>
                                {calDevices.length > 0 && <span className="text-[6px] font-bold text-amber-700">{calDevices.length} Sensor{calDevices.length > 1 ? 's' : ''}</span>}
                              </>
                            ) : <p className="text-[6px] text-slate-500 italic">N/A</p>}
                          </div>
                        </div>

                        <div className="p-3 border border-indigo-100 rounded-xl bg-white hover:border-indigo-300 transition-all min-w-[150px] md:min-w-0 shrink-0 md:shrink">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 shrink-0"><Activity size={10} className="text-indigo-600" /><span className="text-[8px] font-black text-indigo-700 uppercase">Monitoring</span></div>
                            {eq.monitoringActivity.length > 0 ? (
                              <div className="flex gap-1">
                                {eq.monitoringActivity.map(act => (
                                  <div key={act} className="flex items-center gap-0.5 px-1 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[6px] font-bold text-indigo-700">
                                    {act === 'Temperature' ? <Thermometer size={8} /> : <Droplet size={8} />}
                                  </div>
                                ))}
                              </div>
                            ) : <span className="text-[6px] text-slate-500 italic">Passive</span>}
                          </div>
                        </div>

                        <div className="p-3 border border-rose-100 rounded-xl bg-white hover:border-rose-300 transition-all min-w-[150px] md:min-w-0 shrink-0 md:shrink">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 shrink-0"><AlertTriangle size={10} className="text-rose-600" /><span className="text-[8px] font-black text-rose-700 uppercase">Breakdowns</span></div>
                            {breakdowns.length > 0 ? (
                              <>
                                {activeBreakdowns.length > 0 && <span className="px-1 py-0.5 bg-rose-50 border border-rose-200 rounded text-[6px] font-black text-rose-700 flex items-center gap-0.5"><Zap size={7} />{activeBreakdowns.length}</span>}
                                {resolvedBreakdowns.length > 0 && <span className="px-1 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[6px] font-black text-emerald-700 flex items-center gap-0.5"><CheckCircle2 size={7} />{resolvedBreakdowns.length}</span>}
                              </>
                            ) : <span className="text-[6px] font-bold text-emerald-700">None</span>}
                          </div>
                        </div>
                      </div>
                      </>
                        );
                      })()}
                      
                    </div>
                  );
                })}
            </div>
        </div>
      )}
      
      {activeSubTab === 'fac-hygiene' && (
        <ChecklistEditor
          protocols={[]}
          checklists={facilityChecklists}
          setChecklists={setFacilityChecklists}
          externalSync
          fixedPages={[
            { title: 'Hygiene Checklist' },
            { title: 'Preventive Maintenance' },
          ]}
          equipmentList={equipment.map(eq => ({ id: eq.id, name: eq.name, idNumber: eq.idNumber, department: eq.department, location: eq.location, unit: eq.unit, regional: eq.regional }))}
          departmentNames={departmentNames}
          onEquipmentLink={(checklistTitle, equipmentId, linked) => {
            setEquipment(prev => prev.map(eq => {
              if (eq.id !== equipmentId) return eq;
              if (linked) {
                const cl = facilityChecklists.find(c => c.title === checklistTitle);
                const cFreq = cl && typeof cl.cleaningFrequency === 'object' && cl.cleaningFrequency ? cl.cleaningFrequency : null;
                const pFreq = cl && typeof cl.pmFrequency === 'object' && cl.pmFrequency ? cl.pmFrequency : null;
                return {
                  ...eq,
                  cleaningChecklist: checklistTitle,
                  pmChecklist: checklistTitle,
                  ...(cFreq ? { cleaningFrequencyValue: cFreq.value, cleaningFrequencyUnit: cFreq.unit } : {}),
                  ...(pFreq ? { pmFrequencyValue: pFreq.value, pmFrequencyUnit: pFreq.unit } : {}),
                };
              } else {
                return { ...eq, cleaningChecklist: '', pmChecklist: '' };
              }
            }));
          }}
        />
      )}

      {/* ... Other Tabs ... */}
      {activeSubTab === 'fac-cleaning' && <CleaningChecklistModule equipmentList={equipment as any} facilityChecklists={facilityChecklists} />}
      {activeSubTab === 'fac-maintenance' && <PreventiveMaintenanceModule equipmentList={equipment as any} facilityChecklists={facilityChecklists} />}
      {activeSubTab === 'fac-calibration' && <CalibrationHub equipmentList={equipment} />}
      {activeSubTab === 'fac-pest' && <PestManagement />}

      {/* MODAL: ADD NEW ASSET */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"><Wrench size={24}/></div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Register New Asset</h3>
               </div>
               <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            
            <form id="asset-onboarding-form" onSubmit={handleAddNewSave} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-slate-50/30">
              
              <div className="space-y-6">
                 <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Fingerprint size={16} /> Asset Identification & Hierarchy
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label><input required name="name" className="w-full h-12 px-5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID #</label><input required name="idNumber" className="w-full h-12 px-5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-400 outline-none" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand</label><input name="brand" className="w-full h-12 px-5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold" /></div>
                    
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regional</label><select name="regional" className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase">{(dynamicRegionalOptions.length > 0 ? dynamicRegionalOptions : REGIONAL_OPTIONS).map(o => <option key={o}>{o}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</label><select name="unit" className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase">{(dynamicUnitOptions.length > 0 ? dynamicUnitOptions : UNIT_OPTIONS).map(o => <option key={o}>{o}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label><select name="department" className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase">{DEPT_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div>
                 </div>
              </div>

              {/* ... Calibration Section ... */}
              <div className="space-y-6">
                 <h4 className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Settings2 size={16} /> Technical Monitoring & Calibration
                 </h4>
                 <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform"><Cpu size={180} /></div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          <h5 className="text-[11px] font-black uppercase tracking-widest text-indigo-400 mb-6">Monitoring Parameters</h5>
                          <div className="flex gap-4">
                             <label className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl cursor-pointer"><input type="checkbox" name="mon_temp" className="w-5 h-5 rounded accent-indigo-50" /><span className="text-xs font-black uppercase">Temp</span></label>
                             <label className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 p-5 rounded-2xl cursor-pointer"><input type="checkbox" name="mon_hum" className="w-5 h-5 rounded accent-indigo-50" /><span className="text-xs font-black uppercase">Humidity</span></label>
                          </div>
                       </div>
                       <div className="space-y-8">
                          <h5 className="text-[11px] font-black uppercase tracking-widest text-orange-400 mb-6">Precision Control</h5>
                          <div className="flex flex-col gap-4">
                              <div className="flex items-center justify-between p-5 bg-white/5 border border-white/10 rounded-2xl">
                                 <span className="text-xs font-black uppercase">Calibration Required</span>
                                 <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="calibrationRequired" className="sr-only peer" />
                                    <div className="w-14 h-8 bg-white/10 rounded-full peer-checked:bg-emerald-500 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-6"></div>
                                 </label>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                   <div className="space-y-1">
                                       <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Every</label>
                                       <input type="number" name="calibrationFrequencyValue" min="1" defaultValue="1" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase text-white" />
                                   </div>
                                   <div className="space-y-1">
                                       <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Unit</label>
                                       <select name="calibrationFrequencyUnit" className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase text-white">
                                           <option className="text-slate-900" value="Days">Days</option>
                                           <option className="text-slate-900" value="Weeks">Weeks</option>
                                           <option className="text-slate-900" value="Months">Months</option>
                                           <option className="text-slate-900" value="Years">Years</option>
                                       </select>
                                   </div>
                              </div>
                              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label><input type="date" name="calibrationStartDate" className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold uppercase outline-none text-slate-900" /></div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </form>

            <div className="px-10 py-8 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
               <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-xs font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-all">Discard</button>
               <button type="submit" form="asset-onboarding-form" className="px-12 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                  <Save size={18}/> Commit Registry
               </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ... Bulk Modal same as before ... */}

      {cleaningHistoryModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
            <div className="px-8 md:px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 shrink-0"><History size={22}/></div>
                <div className="min-w-0">
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-tight truncate">Cleaning Schedule History</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{cleaningHistoryModal.eq.name} — {cleaningHistoryModal.eq.idNumber}</p>
                </div>
              </div>
              <button onClick={() => setCleaningHistoryModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all shrink-0"><X size={22}/></button>
            </div>
            
            <div className="px-6 md:px-10 py-5 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3">
              {(() => {
                const past = cleaningHistoryModal.records.filter(r => r.status !== 'upcoming');
                const completed = past.filter(r => r.status === 'completed' || r.status === 'verified').length;
                const verified = past.filter(r => r.status === 'verified').length;
                const missed = past.filter(r => r.status === 'missed').length;
                const upcoming = cleaningHistoryModal.records.filter(r => r.status === 'upcoming').length;
                const complianceRate = past.length > 0 ? Math.round((completed / past.length) * 100) : 0;
                return (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center"><CalendarCheck size={14} className="text-slate-600" /></div>
                      <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</p><p className="text-sm font-black text-slate-900">{past.length}</p></div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-100 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><CheckCircle2 size={14} className="text-emerald-600" /></div>
                      <div><p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Completed</p><p className="text-sm font-black text-emerald-700">{completed}</p></div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-indigo-100 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center"><ShieldCheck size={14} className="text-indigo-600" /></div>
                      <div><p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Verified</p><p className="text-sm font-black text-indigo-700">{verified}</p></div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-rose-100 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center"><XCircle size={14} className="text-rose-600" /></div>
                      <div><p className="text-[8px] font-black text-rose-600 uppercase tracking-widest">Missed</p><p className="text-sm font-black text-rose-700">{missed}</p></div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-100 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Clock size={14} className="text-blue-600" /></div>
                      <div><p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Upcoming</p><p className="text-sm font-black text-blue-700">{upcoming}</p></div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-100 rounded-2xl shadow-sm ml-auto">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center"><Activity size={14} className="text-amber-600" /></div>
                      <div><p className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Compliance</p><p className="text-sm font-black text-amber-700">{complianceRate}%</p></div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-slate-100">
                {cleaningHistoryModal.records.map((record) => {
                  const statusConfig: Record<string, { bg: string, text: string, icon: React.ReactNode, label: string }> = {
                    completed: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 size={14} />, label: 'Completed' },
                    verified: { bg: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700', icon: <ShieldCheck size={14} />, label: 'Verified' },
                    missed: { bg: 'bg-rose-50 border-rose-100', text: 'text-rose-700', icon: <XCircle size={14} />, label: 'Missed' },
                    upcoming: { bg: 'bg-blue-50 border-blue-100', text: 'text-blue-600', icon: <Clock size={14} />, label: 'Upcoming' },
                  };
                  const cfg = statusConfig[record.status] || statusConfig.upcoming;
                  
                  return (
                    <div key={record.id} className={`px-6 md:px-10 py-5 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/50 transition-colors ${record.status === 'missed' ? 'bg-rose-50/20' : ''}`}>
                      <div className={`w-3 h-3 rounded-full shrink-0 hidden md:block ${record.status === 'completed' || record.status === 'verified' ? 'bg-emerald-500' : record.status === 'missed' ? 'bg-rose-500' : 'bg-blue-400'}`} />
                      
                      <div className="flex items-center gap-3 md:w-[140px] shrink-0">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">{new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                        </div>
                      </div>
                      
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider w-fit ${cfg.bg} ${cfg.text}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate">{record.checklist}</p>
                        {record.remarks && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{record.remarks}</p>}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 md:gap-4 shrink-0">
                        {record.completedBy && (
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-600 uppercase">{record.completedBy}</span>
                          </div>
                        )}
                        {record.verifiedBy && (
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck size={11} className="text-indigo-500" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase">{record.verifiedBy}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cleaningHistoryModal.records.length === 0 && (
                  <div className="p-16 text-center">
                    <Droplets size={40} className="mx-auto mb-4 text-slate-200" />
                    <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No Cleaning Records Found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {qrCodeModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
            {/* Header */}
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-900/30 shrink-0"><QrCode size={22} /></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-tight truncate">Equipment QR Codes</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{qrCodeModal.name}</p>
                </div>
              </div>
              <button onClick={() => setQrCodeModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all shrink-0"><X size={22} /></button>
            </div>

            {/* Instructions */}
            <div className="px-8 pt-6 pb-2">
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                <Smartphone size={16} className="text-emerald-600 shrink-0" />
                <p className="text-[10px] font-bold text-emerald-700">Scan with phone camera to open checklist directly — no login required</p>
              </div>
            </div>

            {/* QR Code Cards */}
            <div className="p-8 grid grid-cols-2 gap-6">
              {(['cleaning', 'maintenance'] as const).map((type) => {
                const isClean = type === 'cleaning';
                const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${qrCodeModal.id}/${type}`;
                const checklistName = isClean ? qrCodeModal.cleaningChecklist : qrCodeModal.pmChecklist;
                const frequency = isClean
                  ? `Every ${qrCodeModal.cleaningFrequencyValue} ${qrCodeModal.cleaningFrequencyUnit}`
                  : `Every ${qrCodeModal.pmFrequencyValue} ${qrCodeModal.pmFrequencyUnit}`;

                const downloadQR = () => {
                  const qrCanvas = document.getElementById(`qr-canvas-${type}`) as HTMLCanvasElement;
                  if (!qrCanvas) return;
                  const W = 520, H = 700;
                  const c = document.createElement('canvas');
                  c.width = W; c.height = H;
                  const ctx = c.getContext('2d')!;
                  const headerColor = isClean ? '#2563eb' : '#ea580c';
                  const accentColor = isClean ? '#1d4ed8' : '#c2410c';
                  const HEADER_H = 150;
                  ctx.fillStyle = headerColor;
                  ctx.fillRect(0, 0, W, HEADER_H);
                  ctx.fillStyle = accentColor;
                  ctx.fillRect(0, HEADER_H - 24, W, 24);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 13px Arial, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.letterSpacing = '0.15em';
                  ctx.fillText('HACCP PRO', W / 2, 44);
                  ctx.font = 'bold 24px Arial, sans-serif';
                  ctx.letterSpacing = '0.1em';
                  ctx.fillText(isClean ? 'CLEANING' : 'MAINTENANCE', W / 2, 84);
                  ctx.font = '11px Arial, sans-serif';
                  ctx.fillStyle = 'rgba(255,255,255,0.7)';
                  ctx.letterSpacing = '0.05em';
                  ctx.fillText('SCAN TO OPEN CHECKLIST — NO LOGIN REQUIRED', W / 2, 116);
                  ctx.fillStyle = '#f8fafc';
                  ctx.fillRect(0, HEADER_H, W, H - HEADER_H);
                  const QR_SIZE = 340;
                  const QR_X = (W - QR_SIZE) / 2;
                  const QR_Y = HEADER_H + 28;
                  ctx.fillStyle = '#ffffff';
                  ctx.strokeStyle = '#e2e8f0';
                  ctx.lineWidth = 1.5;
                  const pad = 18;
                  ctx.beginPath();
                  ctx.roundRect(QR_X - pad, QR_Y - pad, QR_SIZE + pad * 2, QR_SIZE + pad * 2, 16);
                  ctx.fill();
                  ctx.stroke();
                  ctx.drawImage(qrCanvas, QR_X, QR_Y, QR_SIZE, QR_SIZE);
                  const INFO_Y = QR_Y + QR_SIZE + pad + 28;
                  ctx.fillStyle = '#0f172a';
                  ctx.font = 'bold 20px Arial, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.letterSpacing = '0.05em';
                  const nm = (qrCodeModal.name || '').toUpperCase();
                  ctx.fillText(nm.length > 30 ? nm.slice(0, 29) + '…' : nm, W / 2, INFO_Y);
                  ctx.fillStyle = headerColor;
                  ctx.font = 'bold 13px Arial, sans-serif';
                  ctx.letterSpacing = '0.08em';
                  const cl = checklistName || (isClean ? 'Cleaning Protocol' : 'PM Protocol');
                  ctx.fillText(cl.length > 36 ? cl.slice(0, 35) + '…' : cl, W / 2, INFO_Y + 26);
                  ctx.fillStyle = '#64748b';
                  ctx.font = '12px Arial, sans-serif';
                  ctx.letterSpacing = '0.03em';
                  const loc = [qrCodeModal.idNumber, qrCodeModal.location].filter(Boolean).join(' · ');
                  ctx.fillText(loc, W / 2, INFO_Y + 48);
                  ctx.fillStyle = accentColor;
                  ctx.font = 'bold 12px Arial, sans-serif';
                  ctx.fillText(frequency, W / 2, INFO_Y + 70);
                  const url = c.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${qrCodeModal.name.replace(/\s+/g, '_')}_${type}_qr.png`;
                  a.click();
                };

                return (
                  <div key={type} className={`rounded-2xl border overflow-hidden flex flex-col ${isClean ? 'border-blue-100' : 'border-orange-100'}`}>
                    <div className={`px-4 py-3 flex items-center gap-2 ${isClean ? 'bg-blue-600' : 'bg-orange-500'}`}>
                      <div className="w-2 h-2 bg-white/70 rounded-full" />
                      <p className="text-[9px] font-black text-white uppercase tracking-widest">{isClean ? 'Cleaning' : 'Maintenance'}</p>
                    </div>
                    <div className={`flex flex-col items-center p-4 gap-3 ${isClean ? 'bg-blue-50' : 'bg-orange-50'}`}>
                      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                        <QRCodeSVG value={scanUrl} size={120} level="M" />
                        <QRCodeCanvas id={`qr-canvas-${type}`} value={scanUrl} size={400} level="M" style={{ display: 'none' }} />
                      </div>
                      <div className="w-full text-center space-y-1.5">
                        <p className="text-[9px] font-black text-slate-800 uppercase leading-tight">{qrCodeModal.name}</p>
                        <p className={`text-[7px] font-bold ${isClean ? 'text-blue-600' : 'text-orange-600'}`}>{checklistName || (isClean ? 'Cleaning Protocol' : 'PM Protocol')}</p>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black ${isClean ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}`}>
                          <Clock size={9} />
                          {frequency}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  const cleanCanvas = document.getElementById('qr-canvas-cleaning') as HTMLCanvasElement;
                  const maintCanvas = document.getElementById('qr-canvas-maintenance') as HTMLCanvasElement;
                  const cleanDataUrl = cleanCanvas?.toDataURL('image/png') ?? '';
                  const maintDataUrl = maintCanvas?.toDataURL('image/png') ?? '';
                  const w = window.open('', '_blank');
                  if (!w) return;
                  w.document.write(`<!DOCTYPE html><html><head><title>${qrCodeModal.name} QR Codes</title>
                    <style>body{font-family:sans-serif;padding:32px;text-align:center} .cards{display:flex;gap:48px;justify-content:center;margin-top:24px} .card{text-align:center;border:1px solid #e2e8f0;border-radius:16px;padding:20px;min-width:180px} .label{font-weight:900;text-transform:uppercase;font-size:11px;letter-spacing:0.08em;margin-bottom:8px} .clean{color:#2563eb} .maint{color:#ea580c} img{width:180px;height:180px;display:block;margin:0 auto} p{font-size:10px;color:#64748b;margin-top:8px}</style>
                    </head><body>
                    <h2 style="margin:0;font-size:20px;font-weight:900;text-transform:uppercase">${qrCodeModal.name}</h2>
                    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8">${qrCodeModal.idNumber} · ${qrCodeModal.location}</p>
                    <div class="cards">
                      <div class="card"><p class="label clean">Cleaning</p><img src="${cleanDataUrl}" /><p>${qrCodeModal.cleaningChecklist || 'Cleaning Protocol'}</p></div>
                      <div class="card"><p class="label maint">Maintenance</p><img src="${maintDataUrl}" /><p>${qrCodeModal.pmChecklist || 'PM Protocol'}</p></div>
                    </div>
                    <script>window.onload=function(){window.print();}<\/script>
                  </body></html>`);
                  w.document.close();
                }}
                className="px-5 py-2.5 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-900 active:scale-95 transition-all flex items-center gap-2"
              >
                <Printer size={14} /> Print Both
              </button>
              <button onClick={() => setQrCodeModal(null)} className="px-5 py-2.5 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Drawer */}
      {isImportDrawerOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 border border-slate-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-[2.5rem] sm:rounded-t-[2.5rem]">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"><Upload size={22}/></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Import Equipment</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">CSV Bulk Upload</p>
                </div>
              </div>
              <button onClick={() => setIsImportDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={22}/></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl"><Download size={18}/></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">Step 1 — Download Template</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Get the CSV template with required column headers</p>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-3">Columns: Name, Brand, Make, Model, Serial, Location, Department, Status, Regional, Unit</p>
                <button onClick={handleDownloadSample} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-md">
                  <Download size={14}/> Download Sample CSV
                </button>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl"><FileUp size={18}/></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">Step 2 — Upload Your CSV</p>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Upload your filled CSV to review before importing</p>
                  </div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-md">
                  <FileUp size={14}/> Choose CSV File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Review Modal */}
      {isBulkUploadModalOpen && bulkStagedData.length > 0 && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl flex flex-col border border-slate-200 animate-in zoom-in-95" style={{ maxHeight: '90vh' }}>
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white rounded-t-[2.5rem] shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"><CheckCheck size={22}/></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Review Import</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{bulkStagedData.length} rows detected — verify location &amp; department</p>
                </div>
              </div>
              <button onClick={() => { setIsBulkUploadModalOpen(false); setBulkStagedData([]); setBulkRowEdits({}); }} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={22}/></button>
            </div>

            {/* Legend */}
            <div className="px-8 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-4 flex-wrap shrink-0">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Legend:</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black">Exact match</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black">Partial match</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[8px] font-black">No match — best option auto-suggested ★</span>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">#</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Brand / Make</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Location</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Department</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">Checklist Name</th>
                    <th className="px-4 py-3 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bulkStagedData.map((row, idx) => {
                    const rawLoc = row.location || '';
                    const rawDept = row.department || '';
                    const locScore = bulkMatchScore(rawLoc, LOCATION_OPTIONS);
                    const deptScore = bulkMatchScore(rawDept, DEPT_OPTIONS);
                    const suggestedLoc = bulkBestMatch(rawLoc, LOCATION_OPTIONS);
                    const suggestedDept = bulkBestMatch(rawDept, DEPT_OPTIONS);
                    const currentLoc = bulkRowEdits[idx]?.location ?? suggestedLoc;
                    const currentDept = bulkRowEdits[idx]?.department ?? suggestedDept;
                    const locChanged = bulkRowEdits[idx]?.location !== undefined;
                    const deptChanged = bulkRowEdits[idx]?.department !== undefined;
                    const scoreBadge = (score: number) =>
                      score === 100 ? 'bg-emerald-100 text-emerald-700' :
                      score >= 60 ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700';
                    const scoreLabel = (score: number) =>
                      score === 100 ? 'Exact match' : score >= 60 ? 'Partial match' : 'No match — suggested';
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 transition-colors ${locScore < 100 || deptScore < 100 ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3 text-[9px] font-black text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-[10px] font-black text-slate-800 uppercase">{row.name || '—'}</p>
                          {row.serialNumber && <p className="text-[8px] text-slate-400 mt-0.5">SN: {row.serialNumber}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[9px] font-bold text-slate-700">{row.brand || '—'}</p>
                          <p className="text-[8px] text-slate-400">{row.make || ''}</p>
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[7px] font-black ${scoreBadge(locScore)}`}>{scoreLabel(locScore)}</span>
                              {locScore < 100 && rawLoc && (
                                <span className="text-[7px] text-slate-400 font-bold">CSV: &quot;{rawLoc}&quot;</span>
                              )}
                              {locChanged && <span className="text-[7px] text-indigo-600 font-black">✏ Edited</span>}
                            </div>
                            <div className="relative">
                              <select
                                value={currentLoc}
                                onChange={e => setBulkRowEdits(prev => ({ ...prev, [idx]: { ...prev[idx], location: e.target.value } }))}
                                className={`w-full appearance-none bg-white border rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-slate-700 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${locScore < 100 && !locChanged ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                              >
                                {LOCATION_OPTIONS.map(o => <option key={o} value={o}>{o}{o === suggestedLoc && locScore < 100 ? ' ★ suggested' : ''}</option>)}
                              </select>
                              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 min-w-[200px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[7px] font-black ${scoreBadge(deptScore)}`}>{scoreLabel(deptScore)}</span>
                              {deptScore < 100 && rawDept && (
                                <span className="text-[7px] text-slate-400 font-bold">CSV: &quot;{rawDept}&quot;</span>
                              )}
                              {deptChanged && <span className="text-[7px] text-indigo-600 font-black">✏ Edited</span>}
                            </div>
                            <div className="relative">
                              <select
                                value={currentDept}
                                onChange={e => setBulkRowEdits(prev => ({ ...prev, [idx]: { ...prev[idx], department: e.target.value } }))}
                                className={`w-full appearance-none bg-white border rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-slate-700 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${deptScore < 100 && !deptChanged ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}
                              >
                                {DEPT_OPTIONS.map(o => <option key={o} value={o}>{o}{o === suggestedDept && deptScore < 100 ? ' ★ suggested' : ''}</option>)}
                              </select>
                              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </td>
                        {/* Checklist Name column */}
                        {(() => {
                          const rawCL = row.cleaningChecklist || '';
                          const score = hygieneChecklistNames.length > 0 ? bulkMatchScore(rawCL, hygieneChecklistNames) : 100;
                          const suggested = hygieneChecklistNames.length > 0 ? bulkBestMatch(rawCL, hygieneChecklistNames) : rawCL;
                          const current = bulkRowEdits[idx]?.checklist ?? suggested;
                          const changed = bulkRowEdits[idx]?.checklist !== undefined;
                          const matched = facilityChecklists.find(c => c.title === current);
                          const questions = matched?.pages?.reduce((s, p) => s + (p.questions?.length || 0), 0) ?? null;
                          return (
                            <td className="px-4 py-3 min-w-[200px]">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Droplets size={9} className="text-indigo-500" />
                                  <Wrench size={9} className="text-orange-400" />
                                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Checklist</span>
                                  {score < 100 && rawCL && <span className="text-[7px] text-slate-400 font-bold">CSV: &quot;{rawCL}&quot;</span>}
                                  {changed && <span className="text-[7px] text-indigo-600 font-black">✏ Edited</span>}
                                </div>
                                <div className="relative">
                                  <select
                                    value={current}
                                    onChange={e => setBulkRowEdits(prev => ({ ...prev, [idx]: { ...prev[idx], checklist: e.target.value } }))}
                                    className={`w-full appearance-none bg-white border rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-slate-700 pr-6 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${score < 100 && !changed ? 'border-amber-300 bg-amber-50' : 'border-indigo-200'}`}
                                  >
                                    {hygieneChecklistNames.length === 0 ? <option value="">No checklists in database</option> : hygieneChecklistNames.map(o => <option key={o} value={o}>{o}{o === suggested && score < 100 ? ' ★' : ''}</option>)}
                                  </select>
                                  <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                {questions !== null && (
                                  <p className="text-[7px] text-indigo-600 font-bold">{questions} questions · {matched?.pages?.length || 0} sections</p>
                                )}
                                <p className="text-[7px] text-slate-400">Applied to cleaning &amp; PM</p>
                              </div>
                            </td>
                          );
                        })()}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5 items-center">
                            <button
                              onClick={() => addBulkRow()}
                              className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all active:scale-90"
                              title="Add row below"
                            >
                              <Plus size={12} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => removeBulkRow(idx)}
                              className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-500 hover:bg-rose-100 transition-all active:scale-90"
                              title="Remove this row"
                            >
                              <Trash2 size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] flex items-center justify-between gap-4 shrink-0">
              <div>
                {(() => {
                  const suggested = bulkStagedData.filter((row, idx) => {
                    const locScore = bulkMatchScore(row.location ?? '', LOCATION_OPTIONS);
                    const deptScore = bulkMatchScore(row.department ?? '', DEPT_OPTIONS);
                    const locEdited = bulkRowEdits[idx]?.location !== undefined;
                    const deptEdited = bulkRowEdits[idx]?.department !== undefined;
                    return (locScore < 100 && !locEdited) || (deptScore < 100 && !deptEdited);
                  }).length;
                  return suggested > 0 ? (
                    <p className="text-[9px] font-black text-amber-600 uppercase"><AlertCircle size={11} className="inline mr-1" />{suggested} row{suggested > 1 ? 's' : ''} with auto-suggested values — please verify</p>
                  ) : (
                    <p className="text-[9px] font-black text-emerald-600 uppercase"><CheckCircle2 size={11} className="inline mr-1" />All rows confirmed</p>
                  );
                })()}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setIsBulkUploadModalOpen(false); setBulkStagedData([]); setBulkRowEdits({}); }} className="px-5 py-2.5 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-all">Cancel</button>
                <button onClick={commitBulkUpload} className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                  <CheckCheck size={14}/> Import {bulkStagedData.length} Assets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cleaningChecklistModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`p-3 rounded-2xl shadow-lg shrink-0 ${selectedChecklistPageName?.includes('PM') ? 'bg-orange-600 shadow-orange-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}><ClipboardCheck size={22}/></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-tight truncate">{selectedChecklistPageName?.includes('PM') ? 'Maintenance Schedule' : 'Cleaning Schedule'}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">{cleaningChecklistModal.name}</p>
                </div>
              </div>
              <button onClick={() => { setCleaningChecklistModal(null); setSelectedChecklistPageName(null); }} className="p-2 hover:bg-white/10 rounded-full transition-all shrink-0"><X size={22}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-300px)]">
              {selectedChecklistPageName && (() => {
                const relatedChecklist = facilityChecklists.find(c => c.pages?.some(p => p.title === selectedChecklistPageName));
                const selectedPage = relatedChecklist?.pages?.find(p => p.title === selectedChecklistPageName);
                
                return selectedPage ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <h4 className="text-sm font-black text-slate-900 uppercase mb-3">{selectedChecklistPageName}</h4>
                      <p className="text-[9px] font-bold text-slate-600 uppercase mb-4">{selectedPage.questions?.length || 0} Questions</p>
                      
                      <div className="space-y-2">
                        {selectedPage.questions && selectedPage.questions.map((q, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-2.5 border border-blue-100">
                            <p className="text-[9px] font-bold text-slate-700">{idx + 1}. {q.text || q}</p>
                            {typeof q === 'object' && q.answerSet && (
                              <p className="text-[8px] text-slate-500 mt-1">Type: {q.answerSet}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-[9px] font-bold text-slate-500 text-center">{selectedChecklistPageName}</p>
                  </div>
                );
              })()}
              
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl"><Droplets size={18} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">{cleaningChecklistModal.cleaningChecklist}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Assigned Protocol</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Frequency</p>
                    <p className="text-xs font-black text-slate-800 uppercase">Every {cleaningChecklistModal.cleaningFrequencyValue} {cleaningChecklistModal.cleaningFrequencyUnit}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Start Date</p>
                    <p className="text-xs font-black text-slate-800 uppercase">{cleaningChecklistModal.cleaningStartDate}</p>
                  </div>
                  {cleaningChecklistModal.cleaningDay && (
                    <div className="bg-white rounded-xl p-3 border border-blue-100 col-span-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Scheduled Day</p>
                      <p className="text-xs font-black text-slate-800 uppercase">{cleaningChecklistModal.cleaningDay}</p>
                    </div>
                  )}
                </div>
              </div>

              {(() => {
                const stats = getCleaningStats(cleaningChecklistModal);
                const complianceRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-emerald-700">{stats.completed}</p>
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">Completed</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-rose-700">{stats.missed}</p>
                      <p className="text-[8px] font-black text-rose-600 uppercase tracking-widest mt-1">Missed</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                      <p className="text-2xl font-black text-amber-700">{complianceRate}%</p>
                      <p className="text-[8px] font-black text-amber-600 uppercase tracking-widest mt-1">Compliance</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  const eq = cleaningChecklistModal;
                  setCleaningChecklistModal(null);
                  const records = generateCleaningHistory(eq);
                  setCleaningHistoryModal({ eq, records });
                }}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
              >
                <History size={14} /> View Full History
              </button>
              <button onClick={() => setCleaningChecklistModal(null)} className="px-5 py-2.5 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-all">Close</button>
            </div>
          </div>
        </div>
      )}

      <div aria-hidden="true" className="hidden">
        {equipment.map(eq => {
          const cleanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${eq.id}/cleaning`;
          const pmUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${eq.id}/maintenance`;
          return <React.Fragment key={eq.id}>
            <QRCodeCanvas id={`bulk-qr-canvas-${eq.id}-cleaning`} value={cleanUrl} size={400} level="M" />
            <QRCodeCanvas id={`bulk-qr-canvas-${eq.id}-maintenance`} value={pmUrl} size={400} level="M" />
          </React.Fragment>;
        })}
      </div>

      {facilityChecklistPreview && (
        <div className="fixed inset-0 z-[200] bg-white animate-in fade-in duration-200">
          <AuditChecklistPreview
            template={facilityChecklistPreview}
            onClose={() => { setFacilityChecklistPreview(null); setFacilityEquipmentInfo(null); }}
            draftKey={`facility-${facilityChecklistPreview.id}`}
            trialMode={true}
            equipmentInfo={facilityEquipmentInfo || undefined}
          />
        </div>
      )}
    </div>
  );
};

export default FacilityManagement;
