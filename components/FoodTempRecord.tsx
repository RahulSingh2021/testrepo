"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Snowflake, 
  ChevronDown, 
  ChevronUp, 
  Thermometer, 
  Clock, 
  User, 
  ShieldCheck, 
  PenTool, 
  Eraser, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  MapPin, 
  Building,
  X,
  History,
  ShieldAlert,
  Settings2,
  CheckCircle2,
  Timer,
  ClipboardCheck,
  Calendar,
  CheckCheck,
  Activity,
  LayoutGrid,
  Camera,
  MessageSquare,
  Edit3,
  ActivitySquare,
  TrendingUp,
  AlertCircle,
  UserCheck,
  Zap,
  Download,
  MoreVertical,
  Settings,
  XCircle,
  Square,
  CheckSquare,
  Check,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { EquipmentTempRecord, FoodTempLog } from '../types';
import { compressImage } from '@/utils/imageCompression';

// --- MOCK DATA ---

// --- Helper Functions ---
const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime12h = (minutes: number) => {
    let h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const getOperationalSlots = (start: string, end: string, count: number) => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    const totalDuration = endMins - startMins;
    const slotSize = totalDuration / count;
    
    const slots = [];
    for (let i = 0; i < count; i++) {
        const slotStart = startMins + (i * slotSize);
        slots.push({
            startMins: slotStart,
            windowEndMins: slotStart + 60,
            label: minutesToTime12h(slotStart)
        });
    }
    return slots;
};

// --- Sub-Components ---

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Authorized Auth" }) => {
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
            <div className="w-full h-32 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={128} 
                    className="w-full h-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                />
                {!initialData && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                        <span className="text-4xl font-black uppercase -rotate-6 select-none tracking-tighter">Sign to Verify</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatusChip = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        'Operational': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'Maintenance': 'bg-amber-50 text-amber-700 border-amber-100',
        'Alert': 'bg-rose-50 text-rose-700 border-rose-100'
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border tracking-wider ${colors[status] || 'bg-slate-50 text-slate-600'}`}>
            {status}
        </span>
    );
};

// --- Daily Row Component ---
interface DailyLogCardProps {
    equipmentId: string;
    date: string;
    logs: FoodTempLog[];
    targetRange: { min: number, max: number };
    workingHours: { start: string, end: string };
    mandatoryCount: number;
    selectedLogIds: Set<string>;
    onSelectLog: (logId: string) => void;
    onDailyVerify: (equipmentId: string, date: string, logIds: string[]) => void;
}

const DailyLogCard: React.FC<DailyLogCardProps> = ({ 
    equipmentId, date, logs, targetRange, workingHours, mandatoryCount,
    selectedLogIds, onSelectLog, onDailyVerify 
}) => {
    const unverifiedLogs = logs.filter(l => !l.isVerified);
    const unverifiedIds = unverifiedLogs.map(l => l.id);
    const isDayVerified = logs.every(l => l.isVerified);
    const verifiers = Array.from(new Set(logs.map(l => l.verifiedBy).filter(Boolean)));

    const slots = getOperationalSlots(workingHours.start, workingHours.end, mandatoryCount);
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;
    const currentMins = timeToMinutes(`${new Date().getHours()}:${new Date().getMinutes()}`);

    const areAllDailySelected = unverifiedIds.length > 0 && unverifiedIds.every(id => selectedLogIds.has(id));

    const toggleAllDaily = () => {
        unverifiedIds.forEach(id => {
            const currentlySelected = selectedLogIds.has(id);
            if (areAllDailySelected) {
                if (currentlySelected) onSelectLog(id);
            } else {
                if (!currentlySelected) onSelectLog(id);
            }
        });
    };

    return (
        <div className="mx-2 md:mx-6 mb-6 p-0.5 bg-slate-100 rounded-3xl animate-in slide-in-from-top-2 duration-300">
            <div className="bg-white rounded-[1.4rem] md:rounded-[2.3rem] shadow-sm border border-white flex flex-col items-stretch divide-y divide-slate-50">
                
                <div className="p-4 md:p-6 bg-slate-50/40 rounded-t-[1.4rem] md:rounded-t-[2.3rem] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {unverifiedIds.length > 0 && (
                            <button 
                                onClick={toggleAllDaily}
                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${areAllDailySelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}
                            >
                                {areAllDailySelected ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                        )}
                        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
                            <Calendar size={14} />
                        </div>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Entry Date</p>
                            <p className="text-xs font-black text-slate-800 leading-none">{date}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDayVerified ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[8px] font-black uppercase shadow-xs">
                                <ShieldCheck size={12} />
                                Verified
                            </div>
                        ) : (
                            <button 
                                onClick={() => onDailyVerify(equipmentId, date, unverifiedIds)}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                            >
                                <CheckCheck size={12} /> Verify Full Day
                            </button>
                        )}
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-2">{logs.length} Readings</span>
                    </div>
                </div>

                <div className="p-4 overflow-x-auto hide-scrollbar scroll-smooth snap-x">
                    <div className="flex flex-nowrap gap-3">
                        {logs.map((log) => {
                            const isViolating = log.temperature < targetRange.min || log.temperature > targetRange.max;
                            const isSelected = selectedLogIds.has(log.id);
                            
                            return (
                                <div key={log.id} className={`flex-shrink-0 snap-center w-[240px] bg-white border-2 rounded-3xl p-4 transition-all relative group/log ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-md' : isViolating ? 'border-rose-400 bg-rose-50/20' : 'border-slate-50 hover:border-indigo-200'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            {!log.isVerified && (
                                                <button 
                                                    onClick={() => onSelectLog(log.id)}
                                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}
                                                >
                                                    {isSelected && <Check size={12} strokeWidth={4} />}
                                                </button>
                                            )}
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px]">
                                                    <Clock size={12} /> {log.time}
                                                </div>
                                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Time</span>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded-xl font-mono font-black text-sm shadow-sm ${isViolating ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
                                            {log.temperature}°C
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-2xl p-3 mb-3 border border-slate-50 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 text-indigo-600 flex items-center justify-center font-black text-[10px] shrink-0">
                                            {log.recordedBy.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Operator</p>
                                            <p className="text-[10px] font-black text-slate-800 uppercase truncate leading-none">{log.recordedBy}</p>
                                        </div>
                                    </div>

                                    {log.isVerified && (
                                        <div className="bg-emerald-50/30 rounded-2xl p-3 mb-3 border border-emerald-100/50 flex items-center gap-3 animate-in fade-in zoom-in-95">
                                            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[8px] font-black text-emerald-800 uppercase leading-none mb-1">Verified</p>
                                                <p className="text-[9px] font-bold text-emerald-700 truncate leading-none uppercase">{log.verifiedBy}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center gap-2">
                                        {log.isVerified ? (
                                            <span className="text-[8px] font-black text-emerald-600 uppercase flex items-center gap-1">
                                                <CheckCircle2 size={10} /> Authorized
                                            </span>
                                        ) : (
                                            <span className="text-[8px] font-black text-amber-600 uppercase">Verification Due</span>
                                        )}
                                        <div className="flex gap-1">
                                            {!log.isVerified && <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg"><Edit3 size={12}/></button>}
                                            <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg"><Trash2 size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Module ---

const FoodTempRecord: React.FC = () => {
    const [equipment, setEquipment] = useState<EquipmentTempRecord[]>([]);
    const [mandatoryFrequency, setMandatoryFrequency] = useState(3);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['EQ-001']));
    const [activeModal, setActiveModal] = useState<'log' | 'verify' | 'protocol' | 'assetConfig' | 'BULK_VERIFY' | null>(null);
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentTempRecord | null>(null);

    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [tempInput, setTempInput] = useState("");
    const [operatorName, setOperatorName] = useState("Chef Alex");
    const [signature, setSignature] = useState("");
    const [comments, setComments] = useState("");
    const [tempImage, setTempImage] = useState<string | null>(null);

    const [opStart, setOpStart] = useState("08:00");
    const [opEnd, setOpEnd] = useState("20:00");

    const [verifierName, setVerifierName] = useState("QA Supervisor");
    const [verificationComments, setVerificationComments] = useState("");
    const [verificationSignature, setVerificationSignature] = useState("");
    const [targetLogIds, setTargetLogIds] = useState<{ equipmentId: string, logIds: string[] }[]>([]);

    // Selection State
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

    const cameraRef = useRef<HTMLInputElement>(null);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const filteredEquipment = useMemo(() => {
        return equipment.filter(eq => 
            eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.idNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            eq.location.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [equipment, searchTerm]);

    const allUnverifiedLogs = useMemo(() => {
        const unverified: { equipmentId: string, logId: string }[] = [];
        equipment.forEach(eq => {
            eq.logs.forEach(log => {
                if (!log.isVerified) unverified.push({ equipmentId: eq.id, logId: log.id });
            });
        });
        return unverified;
    }, [equipment]);

    const stats = useMemo(() => {
        const total = equipment.length;
        const alerts = equipment.filter(e => e.status === 'Alert').length;
        const dueVerify = allUnverifiedLogs.length;
        return { total, alerts, dueVerify };
    }, [equipment, allUnverifiedLogs]);

    const isGlobalSelectAll = allUnverifiedLogs.length > 0 && allUnverifiedLogs.every(u => selectedLogIds.has(u.logId));

    const handleGlobalSelectAll = () => {
        if (isGlobalSelectAll) {
            setSelectedLogIds(new Set());
        } else {
            const next = new Set<string>();
            allUnverifiedLogs.forEach(u => next.add(u.logId));
            setSelectedLogIds(next);
        }
    };

    const handleSelectLog = (logId: string) => {
        const next = new Set(selectedLogIds);
        if (next.has(logId)) next.delete(logId);
        else next.add(logId);
        setSelectedLogIds(next);
    };

    const handleBulkVerifySelected = () => {
        if (selectedLogIds.size === 0) return;
        
        const targets: { equipmentId: string, logIds: string[] }[] = [];
        equipment.forEach(eq => {
            const logsInSelection = eq.logs.filter(l => selectedLogIds.has(l.id)).map(l => l.id);
            if (logsInSelection.length > 0) {
                targets.push({ equipmentId: eq.id, logIds: logsInSelection });
            }
        });

        setTargetLogIds(targets);
        setVerifierName("QA Supervisor");
        setVerificationComments(`Bulk verification for ${selectedLogIds.size} records.`);
        setVerificationSignature("");
        setActiveModal('verify');
    };

    const filterLogsByDate = (logs: FoodTempLog[]) => {
        if (!dateFrom && !dateTo) return logs;
        return logs.filter(log => {
            const logDate = new Date(log.date);
            logDate.setHours(0,0,0,0);
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0,0,0,0);
                if (logDate < fromDate) return false;
            }
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23,59,59,999);
                if (logDate > toDate) return false;
            }
            return true;
        });
    };

    const handleDailyVerify = (eqId: string, date: string, logIds: string[]) => {
        if (logIds.length === 0) return;
        setTargetLogIds([{ equipmentId: eqId, logIds }]);
        setVerifierName("QA Supervisor");
        setVerificationComments(`Daily verification for ${date}`);
        setVerificationSignature("");
        setActiveModal('verify');
    };

    const handleAssetBulkVerify = (eq: EquipmentTempRecord) => {
        const unverifiedIds = eq.logs.filter(l => !l.isVerified).map(l => l.id);
        if (unverifiedIds.length === 0) return;

        setTargetLogIds([{ equipmentId: eq.id, logIds: unverifiedIds }]);
        setVerifierName("QA Supervisor");
        setVerificationComments(`Bulk verification for asset: ${eq.name}`);
        setVerificationSignature("");
        setActiveModal('verify');
    };

    const handleCommitVerification = (e: React.FormEvent) => {
        e.preventDefault();
        if (!verificationSignature || targetLogIds.length === 0) return;

        setEquipment(prev => prev.map(eq => {
            const targets = targetLogIds.find(t => t.equipmentId === eq.id);
            if (!targets) return eq;

            return {
                ...eq,
                logs: eq.logs.map(l => {
                    if (!targets.logIds.includes(l.id)) return l;
                    return {
                        ...l,
                        isVerified: true,
                        verifiedBy: verifierName,
                        verificationComments: verificationComments,
                        verificationSignature: verificationSignature,
                        verificationDate: new Date().toISOString()
                    };
                })
            };
        }));

        setActiveModal(null);
        setTargetLogIds([]);
        setSelectedLogIds(new Set()); // Clear selection after successful verification
        setVerificationSignature("");
        setVerificationComments("");
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setTempImage(compressed); };
            reader.readAsDataURL(file);
        }
    };

    const handleAddLog = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEquipment || !tempInput || !signature) return;

        const newLog: FoodTempLog = {
            id: `L-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: parseFloat(tempInput),
            recordedBy: operatorName,
            signature,
            tempImage: tempImage || undefined,
            comments: comments || undefined,
            isVerified: false
        };

        setEquipment(prev => prev.map(eq => {
            if (eq.id !== selectedEquipment.id) return eq;
            return { ...eq, logs: [...eq.logs, newLog] };
        }));

        setActiveModal(null);
        setSelectedEquipment(null);
        setTempInput("");
        setSignature("");
        setComments("");
        setTempImage(null);
    };

    const getUnitAnalytics = (eq: EquipmentTempRecord) => {
        const logs = eq.logs;
        if (logs.length === 0) return { avgDailyCount: 0, avgDailyTemp: 0, verifyDue: 0, completed: 0, missedDayCount: 0, missedTimeCount: 0 };
        const uniqueDays = Array.from(new Set(logs.map(l => l.date)));
        const avgDailyCount = (logs.length / uniqueDays.length).toFixed(1);
        const avgDailyTemp = (logs.reduce((acc, curr) => acc + curr.temperature, 0) / logs.length).toFixed(1);
        const verifyDue = logs.filter(l => !l.isVerified).length;
        const completed = logs.filter(l => l.isVerified).length;
        let missedTimeCount = 0;
        const workingHours = eq.workingHours || { start: '08:00', end: '20:00' };
        const slots = getOperationalSlots(workingHours.start, workingHours.end, mandatoryFrequency);
        const currentMins = timeToMinutes(`${new Date().getHours()}:${new Date().getMinutes()}`);
        const todayStr = new Date().toISOString().split('T')[0];
        uniqueDays.forEach(day => {
            const dayLogs = logs.filter(l => l.date === day);
            const isToday = day === todayStr;
            slots.forEach(slot => {
                const logInSlot = dayLogs.find(l => {
                    const lm = timeToMinutes(l.time.replace(/ AM| PM/g, ''));
                    return lm >= slot.startMins && lm <= slot.startMins + 360;
                });
                if (!logInSlot && (!isToday || (isToday && currentMins > slot.windowEndMins) )) missedTimeCount++;
            });
        });
        const missedDayCount = Math.max(0, 7 - uniqueDays.length);
        return { avgDailyCount, avgDailyTemp, verifyDue, completed, missedDayCount, missedTimeCount };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700 px-4 md:px-0">
            {/* COMPACT DASHBOARD & ACTION BAR */}
            <div className="bg-white p-4 md:p-5 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                
                {/* Dashboard Stats Integrated Inline for Mobile */}
                <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar w-full md:w-auto pb-1 md:pb-0">
                    {[
                        { label: 'Fleet', val: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: LayoutGrid },
                        { label: 'Alerts', val: stats.alerts, color: 'text-rose-600', bg: 'bg-rose-50', icon: ShieldAlert },
                        { label: 'Unverified', val: stats.dueVerify, color: 'text-amber-600', bg: 'bg-amber-50', icon: ClipboardCheck }
                    ].map((stat, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl shrink-0">
                            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                                <stat.icon size={16} />
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">{stat.label}</p>
                                <p className="text-sm font-black text-slate-900 leading-none">{stat.val}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* GLOBAL SELECTION TOOLS */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                            onClick={handleGlobalSelectAll}
                            className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all ${isGlobalSelectAll ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                            title="Select All Unverified"
                        >
                            {isGlobalSelectAll ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                        {selectedLogIds.size > 0 ? (
                            <button 
                                onClick={handleBulkVerifySelected}
                                className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 animate-in zoom-in"
                            >
                                <CheckCheck size={18} /> Verify ({selectedLogIds.size})
                            </button>
                        ) : (
                            <div className="relative group flex-1 sm:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600" size={18} />
                                <input type="text" placeholder="Locate Asset..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-xl text-[10px] font-black focus:outline-none focus:border-indigo-400 transition-all uppercase tracking-wider shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-2 py-1.5 shadow-inner hidden sm:flex">
                            <input type="date" className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-24 uppercase cursor-pointer" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            <span className="text-slate-300 font-bold">-</span>
                            <input type="date" className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-24 uppercase cursor-pointer" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN LIST */}
            <div className="space-y-6">
                {filteredEquipment.map((eq, idx) => {
                    const isExpanded = expandedIds.has(eq.id);
                    const displayLogs = filterLogsByDate(eq.logs);
                    const lastLog = displayLogs[displayLogs.length - 1]; 
                    const isViolating = lastLog && (lastLog.temperature < eq.targetRange.min || lastLog.temperature > eq.targetRange.max);
                    const analytics = getUnitAnalytics({ ...eq, logs: displayLogs });
                    const hasUnverifiedLogs = displayLogs.some(l => !l.isVerified);
                    const logsByDate = [...displayLogs].reverse().reduce((groups: Record<string, FoodTempLog[]>, log) => {
                        if (!groups[log.date]) groups[log.date] = [];
                        groups[log.date].push(log);
                        return groups;
                    }, {});

                    // Asset QR Data
                    const qrData = JSON.stringify({
                        id: eq.id,
                        name: eq.name,
                        num: eq.idNumber,
                        loc: eq.location,
                        type: eq.type,
                        range: eq.targetRange,
                        status: eq.status
                    });

                    return (
                        <div key={eq.id} className={`bg-white rounded-[2.5rem] md:rounded-[3rem] border-2 transition-all duration-300 flex flex-col group overflow-hidden ${isExpanded ? 'border-indigo-400 shadow-2xl' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                            
                            {/* Card Desktop/Mobile Row */}
                            <div className="flex flex-col lg:flex-row items-stretch min-h-[120px]">
                                
                                {/* Identity Block */}
                                <div className="p-6 md:p-8 lg:w-[28%] border-b lg:border-b-0 lg:border-r border-slate-50 flex items-center gap-4 md:gap-6 bg-white shrink-0">
                                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg ${eq.type === 'Chiller' ? 'bg-blue-600' : 'bg-indigo-950'}`}>
                                        <Snowflake size={28} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[8px] md:text-[10px] font-mono font-bold text-slate-400 uppercase truncate">#{eq.idNumber}</span>
                                            <StatusChip status={eq.status} />
                                        </div>
                                        <h3 className="text-base md:text-2xl font-black text-slate-800 uppercase tracking-tight truncate leading-none">{eq.name}</h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={10} className="text-indigo-400"/> {eq.location}</p>
                                            <div className="md:hidden flex-1" />
                                            {/* Log Button for Mobile immediate action */}
                                            <button onClick={() => { setSelectedEquipment(eq); setActiveModal('log'); }} className="md:hidden px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg active:scale-95">Log Reading</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Digital Passport Block */}
                                <div className="hidden lg:flex p-6 md:p-8 lg:w-[12%] flex-col justify-center items-center bg-white shrink-0 border-r border-slate-50">
                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col items-center gap-3 shadow-inner group/qr transition-all hover:bg-indigo-50 hover:border-indigo-200">
                                        <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                                            <QRCodeSVG value={qrData} size={56} level="H" includeMargin={false} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/qr:text-indigo-600 transition-colors">Asset ID</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics Cluster */}
                                <div className="p-6 md:p-8 flex-1 border-b lg:border-b-0 lg:border-r border-slate-50 bg-slate-50/10 flex flex-col md:flex-row items-center gap-6 overflow-x-auto hide-scrollbar">
                                    <div className="flex gap-4 sm:gap-8 shrink-0 w-full sm:w-auto">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Limit</span>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-black font-mono">
                                                <span className="text-slate-700">{eq.targetRange.min}°C</span>
                                                <div className="w-4 h-0.5 bg-slate-100" />
                                                <span className="text-slate-700">{eq.targetRange.max}°C</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Latest</span>
                                            <div className={`flex items-center justify-between px-4 py-2 rounded-xl border-2 shadow-md ${isViolating ? 'bg-rose-50 border-rose-600 animate-pulse' : 'bg-emerald-50 border-emerald-500'}`}>
                                                <span className={`text-xl font-black font-mono tracking-tighter ${isViolating ? 'text-rose-600' : 'text-emerald-700'}`}>{lastLog ? `${lastLog.temperature}°C` : '---'}</span>
                                                <div className="flex flex-col border-l border-current/20 pl-3 ml-3"><span className={`text-[7px] font-black uppercase ${isViolating ? 'text-rose-400' : 'text-emerald-400'}`}>Node</span><span className={`text-[10px] font-black tracking-tight ${isViolating ? 'text-rose-800' : 'text-emerald-800'}`}>{lastLog?.time || '--:--'}</span></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Responsive Analytics Grid */}
                                    <div className="grid grid-cols-3 gap-x-4 gap-y-3 flex-1 min-w-[280px]">
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Avg Daily</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-slate-800">{analytics.avgDailyCount}</span><ActivitySquare size={10} className="text-indigo-400" /></div></div>
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Avg Temp</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-slate-800">{analytics.avgDailyTemp}°C</span><TrendingUp size={10} className="text-indigo-400" /></div></div>
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Verify Due</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-amber-600">{analytics.verifyDue}</span><ClipboardCheck size={10} className="text-amber-500" /></div></div>
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Completed</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-emerald-600">{analytics.completed}</span><CheckCircle2 size={10} className="text-emerald-500" /></div></div>
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Missed Day</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-rose-600">{analytics.missedDayCount}</span><AlertCircle size={10} className="text-rose-400" /></div></div>
                                        <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gaps</span><div className="flex items-center gap-1 leading-none"><span className="text-xs font-black text-rose-600">{analytics.missedTimeCount}</span><Timer size={10} className="text-rose-400" /></div></div>
                                    </div>
                                </div>

                                {/* Expand/Action Area */}
                                <div className="p-6 md:p-8 lg:w-[280px] flex items-center justify-end gap-2 bg-white shrink-0 border-t md:border-t-0">
                                    <button onClick={() => toggleExpand(eq.id)} className={`flex-1 md:flex-none h-12 rounded-xl flex items-center justify-center border-2 transition-all gap-2 px-4 ${isExpanded ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-400'}`}>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{isExpanded ? 'Hide Logs' : 'View Logs'}</span>
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                    <div className="hidden md:flex gap-2">
                                        <button onClick={() => { setSelectedEquipment(eq); setActiveModal('log'); }} className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><PenTool size={18} /></button>
                                        {hasUnverifiedLogs && <button onClick={() => handleAssetBulkVerify(eq)} className="p-3 bg-emerald-600 text-white rounded-xl shadow-md"><ShieldCheck size={18} /></button>}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile QR Passport Section */}
                            {isExpanded && (
                                <div className="lg:hidden px-5 py-6 bg-slate-900 text-white flex items-center gap-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl" />
                                    <div className="w-24 h-24 bg-white p-1.5 rounded-2xl shadow-2xl relative z-10 shrink-0 flex items-center justify-center">
                                        <QRCodeSVG value={qrData} size={88} level="H" includeMargin={false} />
                                    </div>
                                    <div className="min-w-0 relative z-10">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1.5">Asset Identity Node</p>
                                        <p className="text-base font-black uppercase tracking-tight leading-none mb-2">Digital Equipment ID</p>
                                        <div className="flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[7px] font-black uppercase border border-indigo-500">Scan to Audit</span>
                                            <ShieldCheck size={12} className="text-emerald-400" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isExpanded && (
                                <div className="bg-slate-50/50 border-t border-slate-100 py-6 animate-in slide-in-from-top-4 duration-500">
                                    {Object.entries(logsByDate).map(([date, logs]) => (
                                        <DailyLogCard 
                                            key={date} 
                                            equipmentId={eq.id} 
                                            date={date} 
                                            logs={logs as FoodTempLog[]} 
                                            targetRange={eq.targetRange} 
                                            workingHours={eq.workingHours || { start: '08:00', end: '20:00' }} 
                                            mandatoryCount={mandatoryFrequency} 
                                            selectedLogIds={selectedLogIds}
                                            onSelectLog={handleSelectLog}
                                            onDailyVerify={handleDailyVerify} 
                                        />
                                    ))}
                                    {Object.keys(logsByDate).length === 0 && <div className="text-center py-10 text-slate-300 text-[10px] font-black uppercase tracking-widest italic">Node Registry Empty</div>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* BOTTOM SHEET MODALS FOR MOBILE */}
            {activeModal === 'log' && selectedEquipment && (
                <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
                        {/* Drag Handle Mobile */}
                        <div className="sm:hidden w-full flex justify-center pt-3 pb-1 bg-[#4f46e5]">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                        </div>
                        
                        <div className="px-6 py-6 md:px-10 md:py-8 bg-[#4f46e5] text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner"><Thermometer size={28} /></div>
                                <div><h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Record Temp</h3><p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1">Asset: {selectedEquipment.name}</p></div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} strokeWidth={3} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 bg-slate-50/20 custom-scrollbar text-left">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Activity size={14} className="text-indigo-500" /> Digital core reading</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input autoFocus type="number" step="0.1" className="w-full h-16 md:h-20 bg-white border-2 border-slate-100 rounded-2xl text-4xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner text-center" placeholder="0.0" value={tempInput} onChange={e => setTempInput(e.target.value)} />
                                        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-300">°C</span>
                                    </div>
                                    <button type="button" onClick={() => cameraRef.current?.click()} className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl transition-all border-2 flex items-center justify-center shrink-0 shadow-lg ${tempImage ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}><Camera size={28} /></button>
                                    <input type="file" ref={cameraRef} capture="environment" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                </div>
                                {tempImage && <div className="mt-2 relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-sm animate-in zoom-in-95"><img src={tempImage} className="w-full h-full object-cover" /><button onClick={() => setTempImage(null)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><X size={10} strokeWidth={4}/></button></div>}
                            </div>
                            <SignaturePad onSave={setSignature} label="Operator Auth Signature" />
                        </div>
                        
                        <div className="px-6 py-6 md:px-10 md:py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="w-full sm:flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-rose-600 tracking-[0.2em] transition-all bg-slate-50 rounded-xl">Discard</button>
                            <button disabled={!tempInput || !signature} onClick={handleAddLog} className={`w-full sm:flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] ${tempInput && signature ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 shadow-indigo-100' : 'bg-slate-100 text-slate-200 cursor-not-allowed'}`}>Commit Entry</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'verify' && targetLogIds.length > 0 && (
                <div className="fixed inset-0 z-[160] bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
                        <div className="sm:hidden w-full flex justify-center pt-3 pb-1 bg-emerald-600">
                            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                        </div>
                        
                        <div className="px-6 py-6 md:px-10 md:py-8 border-b border-slate-100 flex justify-between items-center bg-emerald-600 text-white shrink-0 shadow-lg">
                            <div className="flex items-center gap-4 md:gap-5">
                                <ShieldCheck size={32} className="text-white" />
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-none">Authorize Log</h3>
                                    <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1">Registry Sync Node ({targetLogIds.reduce((a,b)=>a+b.logIds.length, 0)} items)</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} strokeWidth={3} /></button>
                        </div>
                        
                        <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 overflow-y-auto flex-1 text-left pb-safe custom-scrollbar">
                            <div className="space-y-6">
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><UserCheck size={14} className="text-emerald-600" /> Lead Auditor</label><input className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-emerald-500 transition-all shadow-inner uppercase" value={verifierName} onChange={e => setVerifierName(e.target.value)} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><MessageSquare size={14} className="text-emerald-600" /> Audit Notes</label><textarea rows={3} className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold focus:border-emerald-500 outline-none shadow-inner resize-none" placeholder="Enter findings..." value={verificationComments} onChange={e => setVerificationComments(e.target.value)} /></div>
                                <SignaturePad onSave={setVerificationSignature} label="QA Verifier Signature" />
                            </div>
                        </div>
                        
                        <div className="px-6 py-6 md:px-10 md:py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row gap-4 shrink-0 pb-safe">
                            <button onClick={() => setActiveModal(null)} className="w-full sm:flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-rose-600 bg-slate-50 rounded-xl transition-all">Discard</button>
                            <button disabled={!verificationSignature} onClick={handleCommitVerification} className={`w-full sm:flex-1 py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95 ${verificationSignature ? 'hover:bg-emerald-700 shadow-emerald-100' : 'opacity-30'}`}>Finalize Sync</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodTempRecord;
