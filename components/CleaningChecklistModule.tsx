
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Filter, UserCheck, 
  ChevronRight, ChevronDown, Clock, CheckCircle2, AlertTriangle, 
  ListCheck, Building, Calendar, Info, X, 
  History, PenTool,
  ShieldCheck, Plus, Layers, Hourglass, ClipboardCheck, Trash2, Edit3,
  Layout, Check, ImageIcon, CalendarDays, CalendarRange, CalendarClock,
  ArrowRight, ChevronLeft, MapPin, PlayCircle,
  ListFilter,
  Repeat,
  RotateCw,
  Tag,
  Camera,
  Eraser,
  Upload,
  User,
  MessageSquare,
  FileCheck,
  MoreVertical,
  MoveRight,
  Download,
  Calendar as CalendarIcon,
  Thermometer,
  ArrowRightLeft,
  ChevronsRight,
  Eye,
  Signature,
  CalendarCheck,
  Droplets,
  Globe
} from 'lucide-react';
import jsPDF from 'jspdf';
import { compressImage } from '@/utils/imageCompression';
import AuditChecklistPreview from './AuditChecklistPreview';
import type { AuditCloseResult } from './AuditChecklistPreview';

import type { ChecklistTemplate, PageNode, SectionNode, QuestionNode, ResponseOption } from './AuditChecklistCreator';

// --- Types ---
interface CleaningTask {
  id: string;
  corporateName: string;
  regionName: string;
  unitName: string;
  departmentName: string;
  equipmentName: string;
  equipmentIcon: string;
  equipmentId: string;
  make: string;
  location: string;
  scheduledDate: string; // YYYY-MM-DD
  validUntilDate?: string; // The start of the next cycle
  frequency: string;
  assignedDay: string;
  lastCleaned?: string;
  nextDue?: string;
  status: 'pending' | 'ongoing' | 'completed' | 'verified' | 'overdue' | 'scheduled';
  verificationStatus?: string;
  completedBy?: string;
  completionDate?: string;
  verifiedBy?: string;
  verificationDate?: string;
  checklistAnswers?: { yes: number; no: number; na: number };
  totalCheckpoints: number;
  responsibility: string;
  evidencePhotos?: string[];
  operatorSignature?: string;
  verificationComments?: string; 
  verificationSignature?: string; 
  // Reschedule Fields
  isRescheduled?: boolean;
  originalDate?: string;
  rescheduleReason?: string;
  isCarryOver?: boolean;
  daysOverdue?: number;
  checklistName?: string;
  questionAnswers?: Record<string, 'yes' | 'no' | 'na'>;
}

// Interface matching the Equipment from FacilityManagement
interface ConnectedEquipment {
  id: string;
  name: string;
  idNumber: string;
  location: string;
  department: string;
  unit: string;
  regional: string;
  make: string;
  brand: string;
  cleaningChecklist: string;
  cleaningFrequencyValue: number;
  cleaningFrequencyUnit: 'Days' | 'Weeks' | 'Months' | 'Years';
  cleaningDay?: string;
  cleaningStartDate: string; 
  status: 'Active' | 'Inactive';
}

interface CleaningChecklistModuleProps {
    equipmentList?: ConnectedEquipment[];
    facilityChecklists?: ChecklistTemplate[];
}

// --- Helper Functions ---

const toLocalISOString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return weekNo;
};

const getWeeksInMonth = (year: number, month: number) => {
  const weeks = new Set<number>();
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    weeks.add(getWeekNumber(date));
    date.setDate(date.getDate() + 1);
  }
  return Array.from(weeks).sort((a,b) => a-b);
};

const getDaysInWeek = (year: number, week: number) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
      
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ISOweekStart);
    d.setDate(ISOweekStart.getDate() + i);
    days.push(d);
  }
  return days;
};

const DAY_MAP: Record<string, number> = {
  "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAKES = ["Rational", "Hobart", "Electrolux", "True", "Vulcan", "Hoshizaki"];

const FREQUENCY_DAYS: Record<string, number> = {
  "Daily": 1,
  "Weekly": 7,
  "Monthly": 30,
  "Quarterly": 90,
  "Bi-Annually": 180,
  "Annually": 365
};

// --- Linked Data Generator with Advanced Logic ---
const generateTasksForRange = (equipmentList: ConnectedEquipment[], startDate: Date, endDate: Date, facilityChecklists?: ChecklistTemplate[]): CleaningTask[] => {
    const tasks: CleaningTask[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // Normalize range times
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);

    equipmentList.forEach(eq => {
        if (eq.status !== 'Active') return;
        if (!eq.cleaningStartDate) return;

        const val = eq.cleaningFrequencyValue || 1;
        const unit = eq.cleaningFrequencyUnit || 'Days';
        const preferredDayIdx = eq.cleaningDay ? DAY_MAP[eq.cleaningDay] : -1;

        // 1. Determine Initial Anchor Date
        let anchorDate = new Date(eq.cleaningStartDate);
        anchorDate.setHours(0,0,0,0);
        
        // If a specific day is required (Weeks), align the anchor
        if (unit === 'Weeks' && preferredDayIdx !== -1) {
            const startDay = anchorDate.getDay();
            let daysToAdd = preferredDayIdx - startDay;
            if (daysToAdd < 0) daysToAdd += 7;
            anchorDate.setDate(anchorDate.getDate() + daysToAdd);
        }

        // 2. Iterate through cycles to find all occurrences within [start, end]
        let cycleStart = new Date(anchorDate);
        let safetyCounter = 0;

        // Fast forward to near range start to avoid huge loops for old start dates
        // Only simple logic for 'Days'/'Weeks' optimization, else simple loop
        // (Keeping simple loop for reliability as frequency varies)

        while (safetyCounter < 5000) {
            // Determine Next Cycle Start (The end of current task window)
            let nextCycleStart = new Date(cycleStart);
            if (unit === 'Days') nextCycleStart.setDate(nextCycleStart.getDate() + val);
            if (unit === 'Weeks') nextCycleStart.setDate(nextCycleStart.getDate() + (val * 7));
            if (unit === 'Months') nextCycleStart.setMonth(nextCycleStart.getMonth() + val);
            if (unit === 'Years') nextCycleStart.setFullYear(nextCycleStart.getFullYear() + val);

            // Check overlap
            // We include the task if its Scheduled Date (cycleStart) is within the requested range
            if (cycleStart >= start && cycleStart <= end) {
                const scheduledDateStr = toLocalISOString(cycleStart);
                const isCarryOver = cycleStart < today;
                
                // Status Determination
                let status: CleaningTask['status'] = 'scheduled';
                if (cycleStart < today) status = 'overdue';
                else if (cycleStart.getTime() === today.getTime()) status = 'pending';
                else status = 'scheduled';

                const daysOverdue = (status === 'overdue' || (status === 'pending' && isCarryOver))
                    ? Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;

                const linkedChecklist = facilityChecklists?.find(c => c.title === eq.cleaningChecklist);
                const hygienePageQuestions = linkedChecklist?.pages?.[0]?.sections?.reduce((sum, s) => sum + (s.questions?.length || 0) + ((s as any).subSections || []).reduce((ss: number, sub: any) => ss + (sub.questions?.length || 0), 0), 0) || 0;
                const checkpointCount = hygienePageQuestions > 0 ? hygienePageQuestions : 5;

                tasks.push({
                    id: `task-${scheduledDateStr}-${eq.id}`,
                    corporateName: 'Acme Corp',
                    regionName: eq.regional,
                    unitName: eq.unit,
                    departmentName: eq.department,
                    equipmentName: eq.name,
                    equipmentIcon: 'Box',
                    equipmentId: eq.idNumber,
                    make: eq.make,
                    location: eq.location,
                    scheduledDate: scheduledDateStr,
                    validUntilDate: toLocalISOString(nextCycleStart),
                    frequency: `Every ${val} ${unit}${eq.cleaningDay ? ` on ${eq.cleaningDay}` : ''}`,
                    assignedDay: eq.cleaningDay || 'Dynamic',
                    status: status,
                    totalCheckpoints: checkpointCount,
                    responsibility: 'Staff',
                    isCarryOver: isCarryOver,
                    daysOverdue: daysOverdue,
                    checklistName: eq.cleaningChecklist || undefined,
                });
            }

            cycleStart = nextCycleStart;
            safetyCounter++;
            
            // Break if we are past the requested end range
            if (cycleStart > end) break;
        }
    });

    return tasks;
};

// --- Mock Data Generator for Standalone Mode ---
const generateMockTasks = (): CleaningTask[] => {
    const today = new Date();
    const dateStr = toLocalISOString(today);
    
    return [
      {
        id: 'mock-1',
        corporateName: 'Acme Corp',
        regionName: 'North America',
        unitName: 'NYC Central',
        departmentName: 'Kitchen',
        equipmentName: 'Deep Fryer 1',
        equipmentIcon: 'Box',
        equipmentId: 'EQ-DF-01',
        make: 'Vulcan',
        location: 'Hot Line',
        scheduledDate: dateStr,
        validUntilDate: dateStr,
        frequency: 'Daily',
        assignedDay: 'Daily',
        status: 'pending',
        totalCheckpoints: 8,
        responsibility: 'Line Cook',
        isCarryOver: false,
        daysOverdue: 0
      }
    ];
};

// --- Components ---

const SignaturePad: React.FC<{ onSave: (data: string) => void, onClear: () => void, initialData?: string, label?: string }> = ({ onSave, onClear, initialData, label }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Initial render of existing signature
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
        
        // Get correct coordinates
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
        
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            const canvas = canvasRef.current;
            if (canvas) { compressImage(canvas.toDataURL()).then(compressed => onSave(compressed)); }
        }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onClear();
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label || "Signature Auth"}</label>
                <button 
                  type="button" 
                  onClick={clear} 
                  className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1"
                >
                    <Eraser size={10} /> Reset
                </button>
            </div>
            <div className="w-full h-32 bg-slate-50 border-2 border-slate-200 border-dashed rounded-[1.5rem] relative overflow-hidden shadow-inner cursor-crosshair">
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
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!initialData && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <span className="text-3xl font-black uppercase -rotate-6 select-none tracking-tighter">Sign Here</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const DetailBadge = ({ label, value, icon: Icon, color = "text-slate-500" }: any) => (
    <div className="flex flex-col">
        <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{label}</span>
        <div className="flex items-center gap-1.5">
            {Icon && <Icon size={10} className="text-slate-300" />}
            <span className={`text-[10px] font-bold uppercase truncate ${color}`}>{value}</span>
        </div>
    </div>
);

const TaskCard: React.FC<{ task: CleaningTask, onAttend: () => void, onVerify: () => void, onHistory?: () => void, onReschedule?: () => void, viewDate?: string }> = ({ task, onAttend, onVerify, onHistory, onReschedule, viewDate }) => {
  const isVerified = task.status === 'verified';
  const isCompleted = task.status === 'completed';
  const isOverdue = task.status === 'overdue';
  const isScheduled = task.status === 'scheduled';
  const isPending = task.status === 'pending' || task.status === 'ongoing';
  
  // Logic from generator: task.isCarryOver is already calculated relative to the viewDate
  const isCarriedOver = task.isCarryOver;
  const daysOverdue = task.daysOverdue || 0;

  let statusColor = "border-slate-100 bg-white";
  let barColor = "bg-slate-300";
  let badgeColor = "bg-slate-100 text-slate-600";
  
  if (isVerified) { statusColor = "border-emerald-500 bg-emerald-50/10"; barColor = "bg-emerald-500"; badgeColor = "bg-emerald-100 text-emerald-700"; }
  else if (isCompleted) { statusColor = "border-blue-500 bg-blue-50/10"; barColor = "bg-blue-500"; badgeColor = "bg-blue-100 text-blue-700"; }
  else if (isOverdue || isCarriedOver) { statusColor = "border-rose-300 bg-rose-50/20"; barColor = "bg-rose-500"; badgeColor = "bg-rose-100 text-rose-700"; }
  else if (task.status === 'ongoing') { statusColor = "border-amber-400 bg-amber-50/20"; barColor = "bg-amber-500"; badgeColor = "bg-amber-100 text-amber-700"; }
  else if (isScheduled) { statusColor = "border-slate-200 bg-slate-50/50"; barColor = "bg-slate-400"; badgeColor = "bg-slate-200 text-slate-500"; }

  return (
    <div className={`relative bg-white rounded-xl md:rounded-[2rem] border transition-all duration-300 group overflow-hidden shadow-sm ${isVerified || isCompleted ? 'border-emerald-200 hover:border-emerald-400' : isOverdue || isCarriedOver ? 'border-rose-200 hover:border-rose-400 hover:shadow-md hover:shadow-rose-500/10' : 'border-slate-100 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10'}`}>
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl md:rounded-l-[2rem] ${barColor}`} />
      
      <div className="pl-4 md:pl-0 flex flex-col lg:flex-row items-stretch border-b border-slate-100">
        <div className="p-4 md:p-6 lg:flex-1 flex items-start gap-4 shrink-0">

          {/* Icon + Status */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-inner ${isVerified ? 'bg-emerald-50 text-emerald-600' : isOverdue || isCarriedOver ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
              <Droplets size={20} />
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wide border ${isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isCompleted ? 'bg-blue-50 text-blue-700 border-blue-100' : isOverdue || isCarriedOver ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
              {isCarriedOver ? 'Overdue' : task.status}
            </span>
          </div>

          {/* Main Info */}
          <div className="min-w-0 flex-1">
            {/* Badges row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[9px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">#{task.equipmentId}</span>
              <span className="text-[8px] font-bold text-slate-300 font-mono">MK:{task.make}</span>
            </div>

            {/* Equipment Name */}
            <h4 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight leading-snug group-hover:text-indigo-600 transition-colors mb-2">
              {task.equipmentName}
            </h4>

            {/* Location breadcrumb */}
            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase overflow-hidden mb-0.5">
              <Globe size={8} className="text-indigo-400 shrink-0" />
              <span className="truncate">{task.regionName} · {task.unitName}</span>
            </div>
            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase overflow-hidden">
              <MapPin size={8} className="text-indigo-400 shrink-0" />
              <span className="truncate">{task.departmentName} · {task.location}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            {onHistory && (
              <button onClick={(e) => { e.stopPropagation(); onHistory(); }} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-90" title="View History">
                <History size={14} />
              </button>
            )}
            {onReschedule && (isPending || isOverdue || isCarriedOver) && (
              <button onClick={(e) => { e.stopPropagation(); onReschedule(); }} className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm active:scale-90" title="Reschedule">
                <CalendarDays size={14} />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Schedule & Action Section */}
      <div className="bg-slate-50/50 px-4 md:px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Frequency</span>
            <span className="text-[9px] font-bold text-slate-700 uppercase">{task.frequency.split('Every ')[1] || task.frequency}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Scheduled</span>
            <span className={`text-[9px] font-bold uppercase ${isCarriedOver ? 'text-rose-700' : 'text-slate-700'}`}>{formatDateDisplay(task.scheduledDate)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Valid Until</span>
            <span className="text-[9px] font-bold text-slate-700 uppercase">{formatDateDisplay(task.validUntilDate)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Next Due</span>
            <span className="text-[9px] font-bold text-indigo-700 uppercase">{formatDateDisplay(task.nextDue)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full lg:w-auto">
          {isPending || isOverdue || isCarriedOver ? (
            <button 
              onClick={onAttend}
              className="flex-1 lg:flex-none px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-slate-800 flex items-center justify-center gap-1.5"
            >
              <PenTool size={12} /> <span className="hidden md:inline">{isCarriedOver ? 'Attend' : 'Start'}</span>
            </button>
          ) : isCompleted ? (
            <button 
              onClick={onVerify}
              className="flex-1 lg:flex-none px-4 py-2 bg-amber-400 text-amber-900 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-amber-500 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck size={12} /> <span className="hidden md:inline">Verify</span>
            </button>
          ) : isScheduled ? (
            <div className="flex-1 lg:flex-none px-4 py-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
               <Clock size={12} /> <span className="hidden md:inline">Scheduled</span>
            </div>
          ) : (
            <div className="flex-1 lg:flex-none px-4 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                <CheckCircle2 size={12} /> <span className="hidden md:inline">Verified</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Data Row: Evidence & Signatures (Shows only when data exists) */}
      {(isCompleted || isVerified) && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-5 flex flex-col gap-6 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Operator Section */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex items-center gap-3 border-b border-slate-50 pb-2">
                          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><User size={14} /></div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Cleaned By</p>
                              <p className="text-xs font-bold text-slate-800">{task.completedBy || 'Staff'}</p>
                          </div>
                          <span className="ml-auto text-[9px] font-mono text-slate-400">{task.completionDate ? new Date(task.completionDate).toLocaleDateString() : ''}</span>
                      </div>
                      
                      <div className="flex gap-4">
                          {task.operatorSignature ? (
                              <div className="flex-1 h-16 border border-slate-100 rounded-xl flex items-center justify-center bg-slate-50 p-1">
                                  <img src={task.operatorSignature} alt="Operator Sig" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                              </div>
                          ) : (
                              <div className="flex-1 h-16 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[10px] text-slate-300 italic">No Signature</div>
                          )}
                          
                          {task.evidencePhotos && task.evidencePhotos.length > 0 ? (
                              <div className="flex gap-2">
                                  {task.evidencePhotos.map((photo, idx) => (
                                      <div key={idx} className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:scale-110 transition-transform cursor-pointer" onClick={() => window.open(photo)}>
                                          <img src={photo} alt="evidence" className="w-full h-full object-cover" />
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="w-16 h-16 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                                  <ImageIcon size={18} />
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Verifier Section (Only if verified) */}
                  {isVerified && (
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex items-center gap-3 border-b border-emerald-100/50 pb-2">
                              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><FileCheck size={14} /></div>
                              <div>
                                  <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest leading-none mb-0.5">Verified By</p>
                                  <p className="text-xs font-bold text-emerald-900">{task.verifiedBy || 'Supervisor'}</p>
                              </div>
                              <span className="ml-auto text-[9px] font-mono text-emerald-600/60">{task.verificationDate ? new Date(task.verificationDate).toLocaleDateString() : ''}</span>
                          </div>

                          <div className="flex gap-4">
                              <div className="flex-1 space-y-1">
                                  <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-tight">Audit Remarks</p>
                                  <p className="text-[10px] text-emerald-700 italic leading-relaxed">"{task.verificationComments || 'Verified via protocol.'}"</p>
                              </div>
                              {task.verificationSignature ? (
                                  <div className="w-24 h-16 border border-emerald-100 rounded-xl flex items-center justify-center bg-white p-1 shadow-sm">
                                      <img src={task.verificationSignature} alt="Verifier Sig" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                  </div>
                              ) : (
                                  <div className="w-24 h-16 border border-dashed border-emerald-200 rounded-xl flex items-center justify-center text-[9px] text-emerald-400 italic">No Sig</div>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

const HistoryModal: React.FC<{ task: CleaningTask, onClose: () => void }> = ({ task, onClose }) => {
    // Generate some fake history data based on the current task
    const historyData = useMemo(() => {
        const history = [];
        const baseDate = new Date(task.scheduledDate);
        for (let i = 1; i <= 5; i++) {
            const date = new Date(baseDate);
            // Updated to use FREQUENCY_DAYS correctly from prop or scope if available
            // but since it's inside component, we'll use a simple fallback for mockup
            date.setDate(date.getDate() - (i * (task.frequency.includes('Daily') ? 1 : 7)));
            
            history.push({
                scheduled: date.toISOString().split('T')[0],
                cleaningDate: new Date(date.getTime() + 1000 * 60 * 60 * 15).toISOString(), // same day 3pm
                cleaner: 'John Smith',
                status: i === 1 && Math.random() > 0.5 ? 'COMPLETED' : 'VERIFIED',
                verifier: i === 1 && Math.random() > 0.5 ? undefined : 'Bob The Builder',
                verificationDate: i === 1 && Math.random() > 0.5 ? undefined : new Date(date.getTime() + 1000 * 60 * 60 * 38).toISOString(), // next day 2pm
                frequency: task.frequency.toLowerCase(),
                checklistStatus: 'N/A'
            });
        }
        return history;
    }, [task]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[80vh]">
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-white">
                    <div className="flex flex-col gap-1">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment Cleaning History</div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{task.equipmentName}</h2>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-emerald-200">ACTIVE</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                            <Download size={14} /> Download Report
                         </button>
                         <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                            <X size={20} />
                         </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 shrink-0">
                            {/* Placeholder for Thermometer icon as per image, though equipment icon varies */}
                            <Thermometer size={32} />
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                             <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Equipment ID</p>
                                <p className="text-sm font-bold text-slate-800">{task.equipmentId}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Make/Brand</p>
                                <p className="text-sm font-bold text-slate-800">{task.make || '--'}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                                <p className="text-sm font-bold text-slate-800">{task.location}</p>
                             </div>
                             <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Installation Date</p>
                                <p className="text-sm font-bold text-slate-800">--</p>
                             </div>
                        </div>
                    </div>
                </div>

                {/* History Table Section */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100">
                         <div className="flex items-center gap-2 text-indigo-600">
                             <History size={18} />
                             <h3 className="font-bold text-sm">Cleaning Schedule</h3>
                         </div>
                         <select className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 shadow-sm">
                             <option>All Time</option>
                             <option>Last 30 Days</option>
                             <option>Last 3 Months</option>
                         </select>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 border-b border-slate-200">Scheduled</th>
                                    <th className="px-6 py-3 border-b border-slate-200">Cleaning</th>
                                    <th className="px-6 py-3 border-b border-slate-200">Status</th>
                                    <th className="px-6 py-3 border-b border-slate-200">Verification</th>
                                    <th className="px-6 py-3 border-b border-slate-200 text-right">Checklist</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                                {historyData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{new Date(row.scheduled).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Frequency: {row.frequency}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{row.cleaner}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{new Date(row.cleaningDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${row.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {row.verifier ? (
                                                <>
                                                    <div className="font-bold text-slate-800">{row.verifier}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{new Date(row.verificationDate!).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                                                </>
                                            ) : (
                                                <span className="text-slate-300 italic text-xs">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-slate-400 text-xs font-medium">{row.checklistStatus}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors shadow-sm">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const CLEANING_METHODS: Record<string, { method: string; tools: string[]; chemicals: string[] }> = {
  'Standard Sanitization': { method: 'Wipe down all surfaces with sanitizer solution, rinse with clean water, dry with clean cloth', tools: ['Microfiber cloth', 'Spray bottle', 'Scrub brush', 'Bucket'], chemicals: ['Sanitizer solution (200ppm)', 'Clean water'] },
  'Deep Clean Master': { method: 'Disassemble removable parts, soak in degreaser, scrub all surfaces, rinse thoroughly, sanitize, air dry', tools: ['Wire brush', 'Scrub pads', 'Soak tray', 'Pressure washer', 'PPE gloves'], chemicals: ['Industrial degreaser', 'Sanitizer (400ppm)', 'Descaler'] },
  'Daily Surface Wipe': { method: 'Quick wipe of external surfaces and handles with sanitizer wipes, check for debris', tools: ['Sanitizer wipes', 'Dry cloth'], chemicals: ['Pre-soaked sanitizer wipes'] },
  'Bio-hazard Protocol': { method: 'Full PPE, contain area, apply biocide agent, scrub with designated brush, double rinse, UV sanitize', tools: ['PPE suit', 'Face shield', 'Biocide sprayer', 'UV lamp', 'Hazmat bag'], chemicals: ['Biocide agent', 'Bleach solution (1000ppm)', 'Neutralizer'] },
};

const CHECKLIST_ITEMS = [
  'Pre-clean inspection completed',
  'Loose debris and food particles removed',
  'Cleaning solution applied at correct concentration',
  'All surfaces scrubbed thoroughly',
  'Rinse completed with clean water',
  'Sanitizer applied and contact time met',
  'Equipment reassembled correctly',
  'Post-clean inspection passed',
  'Area left clean and organized',
  'Cleaning log signed and dated',
];

interface CleaningPlanRecord {
  date: string;
  status: 'completed' | 'verified' | 'missed' | 'upcoming';
  completedBy?: string;
  verifiedBy?: string;
  checklistAnswers?: Record<string, 'yes' | 'no' | 'na'>;
  evidencePhotos?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  comments?: string;
  operatorSignature?: string;
  verifierSignature?: string;
  completionTime?: string;
}

const generatePlanRecords = (eq: ConnectedEquipment): CleaningPlanRecord[] => {
  const records: CleaningPlanRecord[] = [];
  const today = new Date();
  today.setHours(0,0,0,0);
  const val = eq.cleaningFrequencyValue || 1;
  const unit = eq.cleaningFrequencyUnit || 'Days';
  
  let anchorDate = new Date(eq.cleaningStartDate);
  anchorDate.setHours(0,0,0,0);
  
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAhead = new Date(today);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  
  let cycleDate = new Date(anchorDate);
  let safety = 0;
  
  while (safety < 5000 && cycleDate <= sevenDaysAhead) {
    if (cycleDate >= thirtyDaysAgo) {
      const dateStr = toLocalISOString(cycleDate);
      const hash = (eq.id + dateStr).split('').reduce((a,b) => a + b.charCodeAt(0), 0);
      
      let status: CleaningPlanRecord['status'] = 'upcoming';
      if (cycleDate < today) {
        if (hash % 7 === 0) status = 'missed';
        else if (hash % 3 === 0) status = 'verified';
        else status = 'completed';
      } else if (cycleDate.getTime() === today.getTime()) {
        status = hash % 4 === 0 ? 'completed' : 'upcoming';
      }
      
      const answers: Record<string, 'yes' | 'no' | 'na'> = {};
      if (status === 'completed' || status === 'verified') {
        CHECKLIST_ITEMS.forEach((item, i) => {
          answers[item] = (hash + i) % 10 === 0 ? 'na' : (hash + i) % 15 === 0 ? 'no' : 'yes';
        });
      }
      
      records.push({
        date: dateStr,
        status,
        completedBy: (status === 'completed' || status === 'verified') ? (hash % 2 === 0 ? 'John S.' : 'Mary T.') : undefined,
        verifiedBy: status === 'verified' ? 'Manager A.' : undefined,
        checklistAnswers: (status === 'completed' || status === 'verified') ? answers : undefined,
        evidencePhotos: (status === 'completed' || status === 'verified') ? [] : undefined,
        comments: (status === 'completed' || status === 'verified') ? (hash % 3 === 0 ? 'All areas cleaned as per SOP. No issues found.' : hash % 5 === 0 ? 'Minor residue found near drain, extra scrub applied.' : 'Routine cleaning completed successfully.') : undefined,
        operatorSignature: (status === 'completed' || status === 'verified') ? 'signed' : undefined,
        verifierSignature: status === 'verified' ? 'signed' : undefined,
        completionTime: (status === 'completed' || status === 'verified') ? `${8 + (hash % 10)}:${String(hash % 60).padStart(2, '0')}` : undefined,
      });
    }
    
    let next = new Date(cycleDate);
    if (unit === 'Days') next.setDate(next.getDate() + val);
    else if (unit === 'Weeks') next.setDate(next.getDate() + (val * 7));
    else if (unit === 'Months') next.setMonth(next.getMonth() + val);
    else if (unit === 'Years') next.setFullYear(next.getFullYear() + val);
    cycleDate = next;
    safety++;
  }
  
  return records.sort((a, b) => b.date.localeCompare(a.date));
};

const CleaningChecklistModule: React.FC<CleaningChecklistModuleProps> = ({ equipmentList = [], facilityChecklists = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'plan'>('schedule');
  const [planExpandedIds, setPlanExpandedIds] = useState<Set<string>>(new Set());
  const [planRecordExpanded, setPlanRecordExpanded] = useState<string | null>(null);
  const [planSearch, setPlanSearch] = useState('');
  // State
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'completed' | 'ongoing'>('all');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  const [activeTask, setActiveTask] = useState<CleaningTask | null>(null);
  const [newScheduleDate, setNewScheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState(""); // Add reason state
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');


  // Verification State
  const [verifyComments, setVerifyComments] = useState("");
  const [verifySignature, setVerifySignature] = useState("");
  
  // View Mode: 'day' | 'week' | 'month'
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  // Time State
  const [now, setNow] = useState(new Date());
  
  // Navigation State
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(now));
  const [selectedDay, setSelectedDay] = useState<string>(toLocalISOString(now));

  // Load Initial Data based on view mode range
  useEffect(() => {
    let start: Date, end: Date;

    if (viewMode === 'day') {
        start = new Date(selectedDay);
        end = new Date(selectedDay);
    } else if (viewMode === 'week') {
        const days = getDaysInWeek(selectedYear, selectedWeek);
        start = days[0];
        end = days[6];
    } else { // month
        start = new Date(selectedYear, selectedMonth, 1);
        end = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
    }

    if (equipmentList && equipmentList.length > 0) {
        setTasks(generateTasksForRange(equipmentList, start, end, facilityChecklists));
    } else {
        setTasks(generateMockTasks()); 
    }
  }, [equipmentList, facilityChecklists, selectedDay, selectedWeek, selectedMonth, selectedYear, viewMode]);

  // Derived Navigation Options
  const availableYears = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const availableMonths = MONTHS; 
  const availableWeeks = useMemo(() => getWeeksInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const availableDays = useMemo(() => getDaysInWeek(selectedYear, selectedWeek), [selectedYear, selectedWeek]);

  // Auto-correction for hierarchy
  useEffect(() => {
      const weeksInMonth = getWeeksInMonth(selectedYear, selectedMonth);
      if (!weeksInMonth.includes(selectedWeek)) {
          setSelectedWeek(weeksInMonth[0]);
      }
  }, [selectedMonth, selectedYear]);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
      return tasks.filter(t => {
        const searchMatch = (t.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
         t.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         t.equipmentId.toLowerCase().includes(searchTerm.toLowerCase()));
        
        let statusMatch = true;
        if (statusFilter !== 'all') {
            if (statusFilter === 'completed') statusMatch = t.status === 'completed' || t.status === 'verified';
            else statusMatch = t.status === statusFilter;
        }

        return searchMatch && statusMatch;
      }).sort((a, b) => {
          // Sort by date so carried over tasks appear first (older dates first)
          return a.scheduledDate.localeCompare(b.scheduledDate);
      });
  }, [tasks, searchTerm, statusFilter]);

  // --- HANDLERS (Same as before) ---
  const [checklistPreviewTemplate, setChecklistPreviewTemplate] = useState<ChecklistTemplate | null>(null);

  const getLinkedChecklist = (task: CleaningTask): ChecklistTemplate | undefined => {
    if (!task.checklistName) return undefined;
    return facilityChecklists.find(c => c.title === task.checklistName);
  };

  const buildDefaultTemplate = (task: CleaningTask): ChecklistTemplate => {
    const yesNoNaResponses: ResponseOption[] = [
      { id: 'r-yes', text: 'Yes', color: '#16a34a', isFlagged: false, score: '1' },
      { id: 'r-no', text: 'No', color: '#dc2626', isFlagged: true, score: '0' },
      { id: 'r-na', text: 'N/A', color: '#94a3b8', isFlagged: false, score: '/' },
    ];
    const makeQ = (idx: number, text: string): QuestionNode => ({
      id: `dq-${task.id}-${idx}`,
      text,
      responseType: 'yes-no-na',
      responses: yesNoNaResponses,
      risk: 'Medium',
      category: 'Hygiene',
      requirement: '',
      isRequired: false,
      isMultipleSelection: false,
      isFlagged: false,
      flaggedValue: '',
      maxScore: 1,
      logicRules: [],
    });
    const defaultQuestions: QuestionNode[] = [
      makeQ(1, 'All exterior surfaces are free of dust, grease, and contaminants'),
      makeQ(2, 'Internal chambers / contact surfaces sanitized with approved cleaning agents'),
      makeQ(3, 'Seal integrity, gaskets and joints checked and found in optimal condition'),
      makeQ(4, 'All sensors, probes and instruments cleared of obstruction or residue'),
      makeQ(5, 'Drainage and waste disposal points are clear and functioning'),
      makeQ(6, 'Surrounding floor area is clean, dry, and free of hazards'),
      makeQ(7, 'Appropriate PPE was worn during the cleaning procedure'),
      makeQ(8, 'Chemical concentrations verified as per SOP specifications'),
    ];
    const sections: SectionNode[] = [
      { id: `ds-${task.id}-1`, title: 'Hygiene Inspection Points', isApplicable: true, risk: 'Med', category: 'Hygiene', questions: defaultQuestions },
    ];
    const pages: PageNode[] = [
      { id: `dp-${task.id}-1`, title: `${task.equipmentName} — Cleaning Checklist`, sections },
    ];
    return {
      id: `auto-cleaning-${task.id}`,
      title: `${task.equipmentName} — Cleaning Checklist`,
      pages,
      createdDate: new Date().toISOString(),
    };
  };

  const handleOpenAttendModal = (task: CleaningTask) => {
    const linkedChecklist = getLinkedChecklist(task);
    setActiveTask(task);
    if (linkedChecklist && linkedChecklist.pages?.length > 0 && linkedChecklist.pages.some(p => p.sections?.length > 0)) {
      setChecklistPreviewTemplate(linkedChecklist);
    } else {
      setChecklistPreviewTemplate(buildDefaultTemplate(task));
    }
  };

  const handleChecklistPreviewClose = (result?: AuditCloseResult) => {
    if (result?.submitted && activeTask) {
      const nowIso = new Date().toISOString();
      setTasks(prev => prev.map(t => {
        if (t.id === activeTask.id) {
          return {
            ...t,
            status: 'completed' as const,
            completedBy: 'Staff User',
            completionDate: nowIso,
            totalCheckpoints: result.scoreMax || t.totalCheckpoints,
            checklistAnswers: {
              yes: result.scoreObtained || 0,
              no: (result.scoreMax || 0) - (result.scoreObtained || 0),
              na: 0,
            },
          };
        }
        return t;
      }));
    }
    setChecklistPreviewTemplate(null);
    setActiveTask(null);
  };
  const handleOpenVerifyModal = (task: CleaningTask) => { setActiveTask(task); setVerifyComments(""); setVerifySignature(""); setIsVerifyModalOpen(true); };
  const handleOpenHistory = (task: CleaningTask) => { setActiveTask(task); setIsHistoryModalOpen(true); };
  const handleOpenReschedule = (task: CleaningTask) => { setActiveTask(task); setNewScheduleDate(task.scheduledDate); setRescheduleReason(""); setIsRescheduleModalOpen(true); };
  const confirmReschedule = () => { if (!activeTask || !newScheduleDate) return; setTasks(prev => prev.map(t => { if (t.id === activeTask.id) { return { ...t, originalDate: t.originalDate || t.scheduledDate, scheduledDate: newScheduleDate, status: 'pending', isRescheduled: true, rescheduleReason: rescheduleReason, isCarryOver: false, daysOverdue: 0 }; } return t; })); setIsRescheduleModalOpen(false); setActiveTask(null); };
  const handleVerifySubmit = () => { if (!activeTask || !verifySignature) { alert("Signature required to verify."); return; } setTasks(prev => prev.map(t => { if (t.id === activeTask.id) { return { ...t, status: 'verified', verifiedBy: 'Manager', verificationDate: new Date().toISOString(), verificationComments: verifyComments, verificationSignature: verifySignature }; } return t; })); setIsVerifyModalOpen(false); setVerifyComments(""); setVerifySignature(""); setActiveTask(null); };

  const generateFilledPDF = (record: CleaningPlanRecord, equipmentName: string, equipmentId: string, checklist: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 15;

    // Header
    doc.setFontSize(14);
    doc.text('HACCP PRO', margin, yPos);
    doc.setFontSize(10);
    doc.text('CLEANING CHECKLIST REPORT', pageWidth - margin - 50, yPos);
    yPos += 10;

    doc.setDrawColor(41, 128, 185);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Title
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text('CLEANING CHECKLIST COMPLETION REPORT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    doc.setTextColor(0, 0, 0);

    // General Information and Cleaning Details
    doc.setFontSize(11);
    doc.text('GENERAL INFORMATION', margin, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.text(`Equipment: ${equipmentName}`, margin, yPos);
    yPos += 5;
    doc.text(`Equipment ID: ${equipmentId}`, margin, yPos);
    yPos += 5;
    doc.text(`Checklist: ${checklist}`, margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.text('CLEANING DETAILS', pageWidth / 2 + 10, yPos - 13);
    doc.setFontSize(9);
    doc.text(`Date: ${new Date(record.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2 + 10, yPos - 8);
    doc.text(`Time: ${record.completionTime || 'N/A'}`, pageWidth / 2 + 10, yPos - 3);
    doc.text(`Cleaned By: ${record.completedBy || '--'}`, pageWidth / 2 + 10, yPos + 2);
    yPos += 8;

    // Status Badge
    const statusColor = record.status === 'verified' ? [52, 211, 153] : [59, 130, 246];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.rect(margin, yPos, 40, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(record.status === 'verified' ? 'VERIFIED' : 'COMPLETED', margin + 20, yPos + 5.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Checklist Summary
    if (record.checklistAnswers) {
      const answers = record.checklistAnswers;
      const yesCount = Object.values(answers).filter(a => a === 'yes').length;
      const noCount = Object.values(answers).filter(a => a === 'no').length;
      const naCount = Object.values(answers).filter(a => a === 'na').length;
      const total = Object.keys(answers).length;
      const percentage = total > 0 ? Math.round((yesCount / total) * 100) : 0;

      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text(`${percentage}%`, pageWidth / 2, yPos + 5, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.text('OVERALL COMPLETION', pageWidth / 2, yPos + 15, { align: 'center' });
      yPos += 22;

      doc.setFontSize(11);
      doc.text('RESPONSE SUMMARY', margin, yPos);
      yPos += 7;

      // Draw summary table manually
      const cellWidth = (pageWidth - 2 * margin) / 6;
      doc.setFillColor(209, 250, 229);
      doc.rect(margin, yPos, cellWidth, 8, 'F');
      doc.setFillColor(254, 226, 226);
      doc.rect(margin + cellWidth * 2, yPos, cellWidth, 8, 'F');
      doc.setFillColor(226, 232, 240);
      doc.rect(margin + cellWidth * 4, yPos, cellWidth, 8, 'F');
      
      doc.setFontSize(9);
      doc.text('Yes', margin + cellWidth / 2, yPos + 5, { align: 'center' });
      doc.text(yesCount.toString(), margin + cellWidth * 1.5, yPos + 5, { align: 'center' });
      doc.text('No', margin + cellWidth * 2.5, yPos + 5, { align: 'center' });
      doc.text(noCount.toString(), margin + cellWidth * 3.5, yPos + 5, { align: 'center' });
      doc.text('N/A', margin + cellWidth * 4.5, yPos + 5, { align: 'center' });
      doc.text(naCount.toString(), margin + cellWidth * 5.5, yPos + 5, { align: 'center' });
      
      yPos += 12;
    }

    yPos += 15;

    // Checklist Items
    if (record.checklistAnswers && Object.keys(record.checklistAnswers).length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFontSize(11);
      doc.text('CHECKLIST RESPONSES', margin, yPos);
      yPos += 7;

      const checklistRows = Object.entries(record.checklistAnswers).map(([item, answer], idx) => [
        (idx + 1).toString().padStart(2, '0'),
        item,
        answer === 'yes' ? 'YES' : answer === 'no' ? 'NO' : 'N/A',
      ]);

      // Draw header
      doc.setFillColor(41, 128, 185);
      doc.rect(margin, yPos, (pageWidth - 2 * margin) * 0.08, 7, 'F');
      doc.rect(margin + (pageWidth - 2 * margin) * 0.08, yPos, (pageWidth - 2 * margin) * 0.67, 7, 'F');
      doc.rect(margin + (pageWidth - 2 * margin) * 0.75, yPos, (pageWidth - 2 * margin) * 0.25, 7, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('#', margin + (pageWidth - 2 * margin) * 0.04, yPos + 4.5, { align: 'center' });
      doc.text('Item', margin + (pageWidth - 2 * margin) * 0.42, yPos + 4.5, { align: 'center' });
      doc.text('Response', margin + (pageWidth - 2 * margin) * 0.875, yPos + 4.5, { align: 'center' });
      
      yPos += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);

      // Draw rows
      checklistRows.forEach((row, idx) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 15;
        }
        doc.rect(margin, yPos, (pageWidth - 2 * margin) * 0.08, 6);
        doc.rect(margin + (pageWidth - 2 * margin) * 0.08, yPos, (pageWidth - 2 * margin) * 0.67, 6);
        doc.rect(margin + (pageWidth - 2 * margin) * 0.75, yPos, (pageWidth - 2 * margin) * 0.25, 6);
        
        doc.text(row[0], margin + (pageWidth - 2 * margin) * 0.04, yPos + 3.5, { align: 'center' });
        const wrappedItem = doc.splitTextToSize(row[1], (pageWidth - 2 * margin) * 0.6);
        doc.text(wrappedItem[0] || '', margin + (pageWidth - 2 * margin) * 0.09, yPos + 3.5);
        doc.text(row[2], margin + (pageWidth - 2 * margin) * 0.875, yPos + 3.5, { align: 'center' });
        
        yPos += 6;
      });

      yPos += 8;
    }

    // Comments
    if (record.comments) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 15;
      }
      doc.setFontSize(11);
      doc.text('COMMENTS', margin, yPos);
      yPos += 6;
      doc.setFontSize(9);
      const wrappedComments = doc.splitTextToSize(record.comments, pageWidth - 2 * margin);
      wrappedComments.forEach((line: string) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 15;
        }
        doc.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Evidence Photos - Before and After
    const hasBeforePhotos = record.beforePhotos && record.beforePhotos.length > 0;
    const hasAfterPhotos = record.afterPhotos && record.afterPhotos.length > 0;
    const hasGeneralPhotos = record.evidencePhotos && record.evidencePhotos.length > 0;

    if (hasBeforePhotos || hasAfterPhotos || hasGeneralPhotos) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 15;
      }
      doc.setFontSize(11);
      doc.text('EVIDENCE PHOTOS', margin, yPos);
      yPos += 10;

      // Before Photos
      if (hasBeforePhotos) {
        doc.setFontSize(10);
        doc.setTextColor(200, 100, 100);
        doc.text('BEFORE CLEANING', margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;

        record.beforePhotos!.forEach((photo, idx) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 15;
          }
          try {
            doc.addImage(photo, 'JPEG', margin, yPos, 85, 65);
            yPos += 70;
          } catch {
            yPos += 5;
          }
        });
        yPos += 5;
      }

      // After Photos
      if (hasAfterPhotos) {
        doc.setFontSize(10);
        doc.setTextColor(100, 200, 100);
        doc.text('AFTER CLEANING', margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;

        record.afterPhotos!.forEach((photo, idx) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 15;
          }
          try {
            doc.addImage(photo, 'JPEG', margin, yPos, 85, 65);
            yPos += 70;
          } catch {
            yPos += 5;
          }
        });
        yPos += 5;
      }

      // General Evidence Photos
      if (hasGeneralPhotos) {
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 200);
        doc.text('ADDITIONAL EVIDENCE', margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 8;

        record.evidencePhotos!.forEach((photo, idx) => {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 15;
          }
          try {
            doc.addImage(photo, 'JPEG', margin, yPos, 85, 65);
            yPos += 70;
          } catch {
            yPos += 5;
          }
        });
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    const pdfUrl = doc.output('dataurlstring');
    setPdfDataUrl(pdfUrl);
    setShowPdfModal(true);
  };

  // --- STATS CALCULATORS ---
  const getDayStats = (dateStr: string) => {
    // Current stats logic for Day view (works for selected day)
    // For Month/Week, we might want aggregate stats, but simplifying for now.
    return {
        active: tasks.filter(t => t.status === 'pending').length,
        missed: tasks.filter(t => t.status === 'overdue').length,
        ongoing: tasks.filter(t => t.status === 'ongoing').length,
        completed: tasks.filter(t => t.status === 'completed' || t.status === 'verified').length,
        total: tasks.length
    };
  };

  const currentStats = getDayStats(selectedDay);

  // --- Reschedule Helpers ---
  const getMaxRescheduleDate = (originalDateStr: string, frequency: string) => { const days = FREQUENCY_DAYS[frequency] || 7; const date = new Date(originalDateStr); date.setDate(date.getDate() + days); return toLocalISOString(date); };
  const maxRescheduleDate = activeTask ? getMaxRescheduleDate(activeTask.originalDate || activeTask.scheduledDate, activeTask.frequency) : "";

  const togglePlanExpand = (id: string) => {
    const next = new Set(planExpandedIds);
    if (next.has(id)) { next.delete(id); setPlanRecordExpanded(null); } else next.add(id);
    setPlanExpandedIds(next);
  };

  const planEquipmentData = useMemo(() => {
    const list = equipmentList.length > 0 ? equipmentList : [];
    return list.filter(eq => eq.status === 'Active').map(eq => {
      const records = generatePlanRecords(eq);
      const completed = records.filter(r => r.status === 'completed' || r.status === 'verified').length;
      const missed = records.filter(r => r.status === 'missed').length;
      const upcoming = records.filter(r => r.status === 'upcoming').length;
      const total = records.length;
      const compliance = total > 0 ? Math.round((completed / (completed + missed)) * 100) || 0 : 0;
      const methodInfo = CLEANING_METHODS[eq.cleaningChecklist] || CLEANING_METHODS['Standard Sanitization'];
      return { ...eq, records, completed, missed, upcoming, total, compliance, methodInfo };
    });
  }, [equipmentList]);

  const filteredPlanEquipment = useMemo(() => {
    if (!planSearch) return planEquipmentData;
    const term = planSearch.toLowerCase();
    return planEquipmentData.filter(eq =>
      eq.name.toLowerCase().includes(term) ||
      eq.idNumber.toLowerCase().includes(term) ||
      eq.location.toLowerCase().includes(term) ||
      eq.department.toLowerCase().includes(term)
    );
  }, [planEquipmentData, planSearch]);

  return (
    <div className="flex flex-col gap-6 pb-20 animate-in fade-in duration-500">
      
      {/* 1. Header Toolbar */}
      <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
        <div className="flex items-center gap-3 sm:gap-6 z-10">
          <div className="p-2.5 sm:p-4 bg-indigo-50 text-indigo-600 rounded-2xl sm:rounded-3xl shadow-inner border border-indigo-100 flex-shrink-0">
            <ClipboardCheck size={24} className="sm:block hidden" />
            <ClipboardCheck size={18} className="sm:hidden" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Cleaning Registry</h2>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-2 uppercase tracking-[0.15em] flex items-center gap-1 sm:gap-2">
              <ShieldCheck size={10} className="sm:block hidden text-indigo-500" /> <span className="hidden sm:inline">Digital Hygiene Performance Dashboard</span><span className="sm:hidden">Hygiene Dashboard</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 z-10">
          <div className="relative group flex-1 order-2 sm:order-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search Asset, Dept..." 
              className="w-full pl-10 pr-3 py-2.5 sm:py-3 bg-slate-50 border-2 border-slate-100 rounded-lg sm:rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner uppercase tracking-wider"
              value={activeSubTab === 'schedule' ? searchTerm : planSearch}
              onChange={e => activeSubTab === 'schedule' ? setSearchTerm(e.target.value) : setPlanSearch(e.target.value)}
            />
          </div>
          {activeSubTab === 'schedule' && (
            <button className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-900 text-white rounded-lg sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-600 active:scale-95 transition-all flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 order-1 sm:order-2 flex-shrink-0">
               <Plus size={14} strokeWidth={3} className="sm:block hidden" />
               <Plus size={12} strokeWidth={3} className="sm:hidden" />
               <span className="hidden sm:inline">New Task</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200 self-start overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('schedule')}
          className={`px-3 sm:px-5 lg:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 sm:gap-2 flex-shrink-0 ${activeSubTab === 'schedule' ? 'bg-white shadow-md text-indigo-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <CalendarDays size={12} className="sm:block hidden" /> <span className="hidden sm:inline">Cleaning Schedule</span><span className="sm:hidden">Schedule</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('plan')}
          className={`px-3 sm:px-5 lg:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 sm:gap-2 flex-shrink-0 ${activeSubTab === 'plan' ? 'bg-white shadow-md text-indigo-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <ListCheck size={12} className="sm:block hidden" /> <span className="hidden sm:inline">Cleaning Plan</span><span className="sm:hidden">Plan</span>
        </button>
      </div>

      {activeSubTab === 'schedule' && (
      <>
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-[2.5rem] p-2 sm:p-3 shadow-sm flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center overflow-hidden">
         
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto">
             <div className="flex items-center gap-1 p-1 sm:p-1.5 bg-slate-50/50 rounded-lg sm:rounded-2xl border border-slate-100 w-full sm:w-auto justify-between sm:justify-start">
                <div className="relative flex-1 sm:flex-none">
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value))}
                        className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-black rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-2 sm:py-3 pr-7 sm:pr-8 outline-none focus:border-indigo-500 cursor-pointer uppercase shadow-sm w-full sm:w-auto"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:block hidden" />
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:hidden" />
                </div>
                <div className="relative flex-1 sm:flex-none">
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(parseInt(e.target.value))}
                        className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-black rounded-lg sm:rounded-xl px-2.5 sm:px-4 py-2 sm:py-3 pr-7 sm:pr-8 outline-none focus:border-indigo-500 cursor-pointer uppercase shadow-sm w-full sm:w-auto"
                    >
                        {availableMonths.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:block hidden" />
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none sm:hidden" />
                </div>
             </div>

             <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-lg sm:rounded-2xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
                 {(['day', 'week', 'month'] as const).map(mode => (
                     <button 
                        key={mode} 
                        onClick={() => setViewMode(mode)}
                        className={`flex-1 sm:flex-none px-2.5 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex-shrink-0 ${viewMode === mode ? 'bg-white shadow-md text-indigo-600 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        {mode}
                     </button>
                 ))}
              </div>
         </div>
         
         <div className="h-10 w-px bg-slate-200 hidden lg:block" />

         <div className="flex-1 w-full overflow-x-auto hide-scrollbar flex items-center gap-6 px-2">
            {viewMode !== 'month' && (
                <div className="flex items-center gap-1 shrink-0">
                   {availableWeeks.map(wk => {
                      const isActive = selectedWeek === wk;
                      return (
                          <button 
                             key={wk}
                             onClick={() => setSelectedWeek(wk)}
                             className={`
                                 group flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all border
                                 ${isActive 
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-lg' 
                                    : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-50'
                                 }
                             `}
                          >
                             <span className="text-[10px] font-black uppercase tracking-wider mb-1">W{wk}</span>
                          </button>
                      );
                   })}
                </div>
            )}

            {viewMode === 'day' && (
                <>
                    <div className="w-px h-8 bg-slate-100 shrink-0" />
                    <div className="flex items-center gap-2">
                       {availableDays.map(d => {
                           const dStr = toLocalISOString(d);
                           const isSelected = selectedDay === dStr;
                           const isToday = dStr === toLocalISOString(now);
                           
                           return (
                               <button
                                  key={dStr}
                                  onClick={() => setSelectedDay(dStr)}
                                  className={`
                                    relative flex flex-col items-center justify-center w-14 h-16 rounded-2xl border-2 transition-all shrink-0
                                    ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-110 z-10' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}
                                  `}
                               >
                                  {isToday && !isSelected && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />}
                                  
                                  <span className="text-[8px] font-bold uppercase">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                  <span className="text-sm font-black">{d.getDate()}</span>
                               </button>
                           );
                       })}
                    </div>
                </>
            )}

            {viewMode === 'month' && (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200">
                    Viewing Full Month Schedule
                </div>
            )}

         </div>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {[
              { id: 'all', label: 'All Tasks', count: currentStats.total, color: 'bg-slate-800 text-white' },
              { id: 'pending', label: 'Pending', count: currentStats.active, color: 'bg-slate-200 text-slate-600' },
              { id: 'ongoing', label: 'Ongoing', count: currentStats.ongoing, color: 'bg-amber-100 text-amber-700' },
              { id: 'overdue', label: 'Missed', count: currentStats.missed, color: 'bg-rose-100 text-rose-700' },
              { id: 'completed', label: 'Completed', count: currentStats.completed, color: 'bg-emerald-100 text-emerald-700' },
          ].map(filter => (
              <button
                 key={filter.id}
                 onClick={() => setStatusFilter(filter.id as any)}
                 className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all shrink-0
                    ${statusFilter === filter.id 
                        ? 'border-indigo-600 ring-2 ring-indigo-100 scale-105 shadow-md ' + filter.color.replace('bg-slate-200', 'bg-slate-800 text-white')
                        : 'border-transparent hover:border-slate-200 bg-white shadow-sm text-slate-500'
                    }
                 `}
              >
                  <span className="text-[10px] font-black uppercase tracking-wider">{filter.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusFilter === filter.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                      {filter.count}
                  </span>
              </button>
          ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <ListFilter size={18} className="text-indigo-600" />
                {viewMode === 'day' ? `Schedule for ${new Date(selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}` : viewMode === 'week' ? `Schedule for Week ${selectedWeek}` : `Schedule for ${MONTHS[selectedMonth]} ${selectedYear}`}
            </h3>
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-slate-200">
                {filteredTasks.length} Visible
            </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
            {filteredTasks.length > 0 ? filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onAttend={() => handleOpenAttendModal(task)}
                  onVerify={() => handleOpenVerifyModal(task)}
                  onHistory={() => handleOpenHistory(task)}
                  onReschedule={() => handleOpenReschedule(task)}
                  viewDate={selectedDay}
                />
            )) : (
                <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <CalendarDays size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">No Tasks Found</h3>
                    <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-w-xs">
                        There are no cleaning assignments matching your filter for this period.
                    </p>
                </div>
            )}
        </div>
      </div>
      </>
      )}

      {activeSubTab === 'plan' && (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <ListCheck size={18} className="text-indigo-600" />
            Equipment Cleaning Plan
          </h3>
          <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-slate-200">
            {filteredPlanEquipment.length} Equipment
          </span>
        </div>

        {(() => {
          const totalCompleted = filteredPlanEquipment.reduce((s, eq) => s + eq.completed, 0);
          const totalMissed = filteredPlanEquipment.reduce((s, eq) => s + eq.missed, 0);
          const totalUpcoming = filteredPlanEquipment.reduce((s, eq) => s + eq.upcoming, 0);
          const totalAll = filteredPlanEquipment.reduce((s, eq) => s + eq.total, 0);
          const overallCompliance = totalAll > 0 ? Math.round((totalCompleted / (totalCompleted + totalMissed)) * 100) || 0 : 0;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tasks</div>
                <div className="text-2xl font-black text-slate-800">{totalAll}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Completed</div>
                <div className="text-2xl font-black text-emerald-700">{totalCompleted}</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Missed</div>
                <div className="text-2xl font-black text-rose-700">{totalMissed}</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 shadow-sm">
                <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Compliance</div>
                <div className="text-2xl font-black text-indigo-700">{overallCompliance}%</div>
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-4">
          {filteredPlanEquipment.length > 0 ? filteredPlanEquipment.map(eq => {
            const isExpanded = planExpandedIds.has(eq.id);
            const complianceColor = eq.compliance >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : eq.compliance >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200';
            const complianceBarColor = eq.compliance >= 80 ? 'bg-emerald-500' : eq.compliance >= 50 ? 'bg-amber-500' : 'bg-rose-500';
            return (
              <div key={eq.id} className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden hover:shadow-md transition-all">
                <button onClick={() => togglePlanExpand(eq.id)} className="w-full text-left p-5 lg:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                        <Eraser size={22} className="text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-base lg:text-lg font-black text-slate-800 uppercase tracking-tight truncate">{eq.name}</h4>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase">{eq.idNumber}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <MapPin size={11} className="text-slate-400" />
                            <span className="font-bold uppercase tracking-wider">{eq.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Building size={11} className="text-slate-400" />
                            <span className="font-bold uppercase tracking-wider">{eq.department}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Layers size={11} className="text-slate-400" />
                            <span className="font-bold uppercase tracking-wider">{eq.unit}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <ChevronsRight size={11} className="text-slate-400" />
                            <span className="font-bold uppercase tracking-wider">{eq.regional}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                            <Tag size={10} /> {eq.cleaningChecklist}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                            <Repeat size={10} /> Every {eq.cleaningFrequencyValue} {eq.cleaningFrequencyUnit}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg">
                            <User size={10} /> Staff Assigned
                          </span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded-lg">
                            <FileCheck size={10} /> {eq.methodInfo.method.split(',')[0]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 lg:gap-4 shrink-0 flex-wrap lg:flex-nowrap">
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <div>
                          <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Completed</div>
                          <div className="text-lg font-black text-emerald-700 leading-none">{eq.completed}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                        <AlertTriangle size={14} className="text-rose-500" />
                        <div>
                          <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Missed</div>
                          <div className="text-lg font-black text-rose-700 leading-none">{eq.missed}</div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${complianceColor}`}>
                        <ShieldCheck size={14} />
                        <div>
                          <div className="text-[8px] font-black uppercase tracking-widest opacity-80">Compliance</div>
                          <div className="text-lg font-black leading-none">{eq.compliance}%</div>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${complianceBarColor}`} style={{ width: `${eq.compliance}%` }} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 lg:p-6 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <History size={12} /> Date-wise Cleaning Records
                      </h5>
                      <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">{eq.records.length} Records</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {eq.records.map(rec => {
                        const statusConfig = rec.status === 'completed' ? { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2, label: 'Completed' }
                          : rec.status === 'verified' ? { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: ShieldCheck, label: 'Verified' }
                          : rec.status === 'missed' ? { bg: 'bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700', icon: AlertTriangle, label: 'Missed' }
                          : { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', icon: Clock, label: 'Upcoming' };
                        const StatusIcon = statusConfig.icon;
                        const yesCount = rec.checklistAnswers ? Object.values(rec.checklistAnswers).filter(v => v === 'yes').length : 0;
                        const noCount = rec.checklistAnswers ? Object.values(rec.checklistAnswers).filter(v => v === 'no').length : 0;
                        const naCount = rec.checklistAnswers ? Object.values(rec.checklistAnswers).filter(v => v === 'na').length : 0;
                        return (
                          <div key={rec.date} className={`rounded-xl border p-3 ${statusConfig.bg} transition-all hover:shadow-sm`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-slate-400" />
                                <span className="text-xs font-black text-slate-700">{new Date(rec.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                              </div>
                              <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${statusConfig.badge}`}>
                                <StatusIcon size={10} /> {statusConfig.label}
                              </span>
                            </div>
                            {(rec.status === 'completed' || rec.status === 'verified') && (
                              <div className="space-y-2 mt-2">
                                <div className="flex items-center gap-3 text-[10px] flex-wrap">
                                  <span className="font-bold text-slate-500 flex items-center gap-1"><User size={10} className="text-blue-500" /> <span className="text-slate-700">{rec.completedBy}</span></span>
                                  {rec.completionTime && <span className="font-bold text-slate-500 flex items-center gap-1"><Clock size={10} className="text-slate-400" /> <span className="text-slate-700">{rec.completionTime}</span></span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <CalendarCheck size={10} className="text-slate-400" />
                                  <span className="font-bold text-slate-500">{new Date(rec.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                {rec.operatorSignature && (
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    <Signature size={10} className="text-indigo-500" />
                                    <span className="font-bold text-indigo-600 uppercase">Signed</span>
                                  </div>
                                )}
                                {rec.checklistAnswers && (
                                  <div className="flex gap-2">
                                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Yes: {yesCount}</span>
                                    <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">No: {noCount}</span>
                                    <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">N/A: {naCount}</span>
                                  </div>
                                )}
                                {rec.comments && (
                                  <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-2">
                                    <MessageSquare size={9} className="inline mr-1" />{rec.comments}
                                  </p>
                                )}
                                {rec.verifiedBy && (
                                  <div className="text-[9px] font-bold text-blue-600 flex items-center gap-1 mt-1">
                                    <ShieldCheck size={10} /> Verified by {rec.verifiedBy}
                                  </div>
                                )}
                                <button
                                  onClick={() => generateFilledPDF(rec, eq.name, eq.idNumber, eq.cleaningChecklist)}
                                  className="w-full mt-2 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-indigo-600 uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-indigo-50 hover:border-indigo-200 transition-all active:scale-95"
                                >
                                  <Eye size={11} /> View PDF
                                </button>
                              </div>
                            )}
                            {rec.status === 'missed' && (
                              <p className="text-[10px] text-rose-500 font-medium mt-1 italic">Cleaning was not performed on this scheduled date.</p>
                            )}
                            {rec.status === 'upcoming' && (
                              <p className="text-[10px] text-slate-400 font-medium mt-1 italic">Scheduled — not yet due.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <ListCheck size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">No Equipment Found</h3>
              <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-w-xs">
                Add active equipment in Facility Management to see cleaning plans here.
              </p>
            </div>
          )}
        </div>
      </div>
      )}

      {checklistPreviewTemplate && activeTask && (
        <div className="fixed inset-0 z-[200] bg-white animate-in fade-in duration-200">
          <AuditChecklistPreview
            template={checklistPreviewTemplate}
            onClose={handleChecklistPreviewClose}
            draftKey={`cleaning-${activeTask.id}`}
            equipmentInfo={{
              name: activeTask.equipmentName,
              idNumber: activeTask.equipmentId,
              location: activeTask.location,
              department: activeTask.departmentName,
              make: activeTask.make,
              model: '',
              type: 'cleaning',
              frequency: activeTask.frequency,
              day: activeTask.assignedDay || undefined,
              startDate: activeTask.scheduledDate,
              responsibility: activeTask.responsibility ? [activeTask.responsibility] : [],
            }}
          />
        </div>
      )}


      {isVerifyModalOpen && activeTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
              <div className="px-10 py-8 bg-amber-500 text-white flex justify-between items-center shrink-0 shadow-lg">
                  <div className="flex items-center gap-4">
                    <UserCheck size={28} strokeWidth={3} />
                    <h3 className="text-xl font-black uppercase tracking-tight">Authorization Hub</h3>
                  </div>
                  <button onClick={() => setIsVerifyModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} /></button>
              </div>
              <div className="p-10 space-y-8">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verifying Node</p>
                     <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{activeTask.equipmentName}</p>
                     <p className="text-xs font-bold text-slate-500 uppercase">{activeTask.unitName}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verification Remarks</label>
                    <textarea 
                        className="w-full h-32 p-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-sm font-medium outline-none focus:border-amber-400 shadow-inner resize-none transition-all" 
                        placeholder="Enter findings or feedback..." 
                        value={verifyComments}
                        onChange={(e) => setVerifyComments(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    {/* Reused Signature Pad for Verification */}
                    <SignaturePad 
                        onSave={setVerifySignature} 
                        onClear={() => setVerifySignature("")} 
                        initialData={verifySignature}
                        label="Authority Signature" 
                    />
                  </div>
              </div>
              <div className="px-10 py-8 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                  <button onClick={() => setIsVerifyModalOpen(false)} className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                  <button 
                    disabled={!verifySignature}
                    onClick={handleVerifySubmit} 
                    className={`px-12 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${verifySignature ? 'bg-amber-500 text-white shadow-amber-100 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                  >
                    Verify & Sync
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && activeTask && (
        <HistoryModal task={activeTask} onClose={() => setIsHistoryModalOpen(false)} />
      )}

      {/* Reschedule Modal */}
      {isRescheduleModalOpen && activeTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <CalendarClock size={24} />
                        <h3 className="text-lg font-black uppercase tracking-tight">Reschedule Task</h3>
                    </div>
                    <button onClick={() => setIsRescheduleModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Date</p>
                        <p className="text-sm font-black text-slate-800">{activeTask.scheduledDate}</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Frequency: <span className="text-indigo-600">{activeTask.frequency}</span></p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Original: <span className="text-slate-600">{activeTask.originalDate || activeTask.scheduledDate}</span></p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Date</label>
                        <input 
                            type="date" 
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 shadow-inner"
                            value={newScheduleDate}
                            min={activeTask.scheduledDate}
                            max={maxRescheduleDate}
                            onChange={(e) => setNewScheduleDate(e.target.value)}
                        />
                        <p className="text-[9px] text-slate-400 italic px-1">
                            Must be within {FREQUENCY_DAYS[activeTask.frequency] || 7} days of original schedule ({maxRescheduleDate}).
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reschedule Reason</label>
                        <textarea 
                            className="w-full p-4 bg-white border-2 border-slate-100 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 shadow-inner resize-none h-20"
                            placeholder="Reason for changing date..."
                            value={rescheduleReason}
                            onChange={(e) => setRescheduleReason(e.target.value)}
                        />
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold leading-relaxed">Rescheduling will reset the task status to pending. This action is logged.</p>
                    </div>
                </div>
                <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <button onClick={() => setIsRescheduleModalOpen(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                    <button 
                        disabled={!newScheduleDate || !rescheduleReason}
                        onClick={confirmReschedule} 
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${!newScheduleDate || !rescheduleReason ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                        Confirm Change
                    </button>
                </div>
            </div>
        </div>
      )}


      {/* PDF Viewer Full Page */}
      {showPdfModal && pdfDataUrl && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in duration-200">
          <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0 shadow-lg">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20"><ClipboardCheck size={28} strokeWidth={2} /></div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight">Filled Cleaning Checklist</h3>
                <p className="text-slate-400 text-sm mt-1">View and download your complete cleaning report</p>
              </div>
            </div>
            <button onClick={() => setShowPdfModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} /></button>
          </div>

          <iframe
            src={pdfDataUrl}
            className="flex-1 w-full border-0"
            title="Filled Cleaning Checklist PDF"
          />

          <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center shrink-0 shadow-lg">
            <button
              onClick={() => setShowPdfModal(false)}
              className="px-6 py-2.5 text-[10px] font-black uppercase text-slate-500 tracking-widest hover:text-slate-700 transition-all"
            >
              Close
            </button>
            <a
              href={pdfDataUrl}
              download={`cleaning-report-${new Date().toISOString().split('T')[0]}.pdf`}
              className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download PDF
            </a>
          </div>
        </div>
      )}

    </div>
  );
};

export default CleaningChecklistModule;
