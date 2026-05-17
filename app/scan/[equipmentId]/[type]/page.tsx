'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertCircle, Loader2, QrCode, CheckCircle2, Clock, Calendar,
  RefreshCw, Lock, AlertTriangle, Play, RotateCcw, X, ChevronRight,
  FileText, Download, History,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AuditChecklistPreview from '@/components/AuditChecklistPreview';
import type { FacilityEquipmentInfo } from '@/components/AuditChecklistPreview';
import { computeScheduleState, formatRelativeDate, formatDateShort } from '@/lib/scheduleUtils';
import type { ScheduleState, ScheduleStatus } from '@/lib/scheduleUtils';

type ScanType = 'cleaning' | 'maintenance';

interface Equipment {
  id: string;
  name: string;
  idNumber: string;
  location: string;
  department: string;
  make: string;
  brand: string;
  cleaningChecklist: string;
  cleaningFrequencyValue: number;
  cleaningFrequencyUnit: string;
  cleaningDay?: string;
  cleaningStartDate: string;
  cleaningNextDueDate?: string;
  pmChecklist: string;
  pmFrequencyValue: number;
  pmFrequencyUnit: string;
  pmDay?: string;
  pmStartDate: string;
  pmNextDueDate?: string;
  status: string;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  pages: any[];
  attachedEquipmentIds?: string[];
  [key: string]: any;
}

interface Completion {
  id: string;
  completedAt: string;
  scanType: string;
  checklistName: string;
  equipmentId: string;
}

const STATUS_CONFIG: Record<ScheduleStatus, {
  label: string;
  sublabel: string;
  badgeBg: string;
  badgeText: string;
  icon: typeof AlertCircle;
  borderColor: string;
  progressColor: string;
  bgTint: string;
}> = {
  INACTIVE: {
    label: 'INACTIVE',
    sublabel: 'Equipment is disabled',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-600',
    icon: Lock,
    borderColor: 'border-slate-200',
    progressColor: 'bg-slate-400',
    bgTint: 'bg-slate-50',
  },
  NEVER_DONE: {
    label: 'FIRST RUN',
    sublabel: 'No previous records',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    icon: Play,
    borderColor: 'border-violet-200',
    progressColor: 'bg-violet-500',
    bgTint: 'bg-violet-50',
  },
  LOCKED: {
    label: 'TOO EARLY',
    sublabel: 'Minimum gap not reached',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    icon: Lock,
    borderColor: 'border-amber-200',
    progressColor: 'bg-amber-400',
    bgTint: 'bg-amber-50',
  },
  UPCOMING: {
    label: 'UPCOMING',
    sublabel: 'Checklist available early',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    icon: Clock,
    borderColor: 'border-blue-200',
    progressColor: 'bg-blue-500',
    bgTint: 'bg-blue-50',
  },
  DUE: {
    label: 'DUE NOW',
    sublabel: 'Recommended to do today',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    icon: CheckCircle2,
    borderColor: 'border-emerald-200',
    progressColor: 'bg-emerald-500',
    bgTint: 'bg-emerald-50',
  },
  OVERDUE: {
    label: 'OVERDUE',
    sublabel: 'Past the due date',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    icon: AlertTriangle,
    borderColor: 'border-red-200',
    progressColor: 'bg-red-500',
    bgTint: 'bg-red-50',
  },
};

export default function ScanPage() {
  const params = useParams();
  const equipmentId = params?.equipmentId as string;
  const type = params?.type as ScanType;

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [lastCompletion, setLastCompletion] = useState<Completion | null>(null);
  const [scheduleState, setScheduleState] = useState<ScheduleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyReport, setHistoryReport] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');

  const validType = type === 'cleaning' || type === 'maintenance';

  const load = useCallback(async () => {
    if (!equipmentId || !validType) {
      setError('Invalid QR code link. Please scan a valid equipment QR code.');
      setLoading(false);
      return;
    }
    try {
      const [eqRes, clRes, compRes] = await Promise.all([
        fetch(`/api/equipment/${encodeURIComponent(equipmentId)}`),
        fetch('/api/facility-checklists'),
        fetch(`/api/equipment/${encodeURIComponent(equipmentId)}/completions?type=${type}&limit=1`),
      ]);

      if (!eqRes.ok) {
        setError(eqRes.status === 404
          ? 'Equipment not found. Please ensure the QR code is up to date.'
          : 'Failed to load equipment data. Please try again.');
        setLoading(false);
        return;
      }

      const found: Equipment = await eqRes.json();
      setEquipment(found);

      const checklists: ChecklistTemplate[] = clRes.ok ? await clRes.json() : [];
      const checklistName = type === 'cleaning' ? found.cleaningChecklist : found.pmChecklist;

      const linked =
        checklists.find(c => c.title === checklistName) ||
        checklists.find(c => c.attachedEquipmentIds?.includes(found.id));

      if (!linked) {
        setError(`No ${type === 'cleaning' ? 'cleaning' : 'maintenance'} checklist is linked to this equipment. Please assign a checklist in the Facility Management module.`);
        setLoading(false);
        return;
      }

      setChecklist(linked);

      const completions: Completion[] = compRes.ok ? await compRes.json() : [];
      const latest = completions.length > 0 ? completions[0] : null;
      setLastCompletion(latest);

      const isClean = type === 'cleaning';
      const freqValue = isClean ? found.cleaningFrequencyValue : found.pmFrequencyValue;
      const freqUnit = isClean ? found.cleaningFrequencyUnit : found.pmFrequencyUnit;
      const startDate = isClean ? found.cleaningStartDate : found.pmStartDate;
      const rescheduledNextDue = isClean ? found.cleaningNextDueDate : found.pmNextDueDate;
      const isActive = found.status === 'active' || found.status === 'Active' || !found.status;

      const state = computeScheduleState(
        freqValue, freqUnit, startDate,
        latest?.completedAt || null,
        isActive,
        0.5,
        rescheduledNextDue || null
      );
      setScheduleState(state);
    } catch {
      setError('Failed to load checklist data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [equipmentId, type, validType]);

  useEffect(() => { load(); }, [load]);

  const handleReschedule = async () => {
    if (!rescheduleDate || !equipment) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      const field = type === 'cleaning' ? 'cleaningNextDueDate' : 'pmNextDueDate';
      const res = await fetch(`/api/equipment/${encodeURIComponent(equipment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: rescheduleDate }),
      });
      if (!res.ok) throw new Error('Failed to reschedule');
      setShowReschedule(false);
      setRescheduleDate('');
      setLoading(true);
      await load();
    } catch {
      setRescheduleError('Could not save reschedule. Please try again.');
    } finally {
      setRescheduling(false);
    }
  };

  const handleViewHistory = async () => {
    if (!lastCompletion) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/audit-reports?ids=${encodeURIComponent(lastCompletion.id)}&type=report`);
      const reports = res.ok ? await res.json() : [];
      if (reports.length > 0) {
        setHistoryReport(reports[0]);
        setShowHistory(true);
      }
    } catch {
      console.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewFilledChecklist = () => {
    if (!historyReport || !equipment) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 10;

    doc.setFontSize(16);
    doc.text('Cleaning Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    const reportData = historyReport.data || {};
    doc.text(`Equipment: ${equipment.name}`, 10, yPos);
    yPos += 6;
    doc.text(`ID: ${equipment.idNumber}`, 10, yPos);
    yPos += 6;
    doc.text(`Date: ${new Date(lastCompletion.completedAt).toLocaleDateString()}`, 10, yPos);
    yPos += 8;

    if (reportData.checklistName) {
      doc.text(`Checklist: ${reportData.checklistName}`, 10, yPos);
      yPos += 6;
    }

    const comments = reportData.comments || {};
    const images: string[] = [];
    Object.values(comments).forEach((q: any) => {
      if (q.entries) {
        q.entries.forEach((e: any) => {
          if (Array.isArray(e.images)) {
            images.push(...e.images);
          }
        });
      }
    });

    if (images.length > 0) {
      yPos += 4;
      doc.setFontSize(12);
      doc.text('Evidence Images:', 10, yPos);
      yPos += 8;

      images.forEach((imgData, idx) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = 10;
        }
        try {
          doc.addImage(imgData, 'JPEG', 10, yPos, 100, 100);
          yPos += 105;
        } catch {
          yPos += 5;
        }
      });
    }

    const pdfUrl = doc.output('dataurlstring');
    setPdfDataUrl(pdfUrl);
    setShowPdfViewer(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !equipment || !checklist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl border border-rose-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Checklist Not Found</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{error || 'No checklist linked to this equipment.'}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <QrCode className="w-4 h-4 text-slate-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scan a valid equipment QR code</p>
          </div>
        </div>
      </div>
    );
  }

  const isClean = type === 'cleaning';
  const frequency = isClean
    ? `Every ${equipment.cleaningFrequencyValue} ${equipment.cleaningFrequencyUnit}`
    : `Every ${equipment.pmFrequencyValue} ${equipment.pmFrequencyUnit}`;

  const equipmentInfo: FacilityEquipmentInfo = {
    name: equipment.name,
    idNumber: equipment.idNumber,
    location: equipment.location,
    department: equipment.department,
    make: equipment.make,
    model: equipment.brand || '',
    type: isClean ? 'cleaning' : 'maintenance',
    frequency,
    day: isClean ? equipment.cleaningDay : equipment.pmDay,
    startDate: isClean ? equipment.cleaningStartDate : equipment.pmStartDate,
    equipmentId: equipment.id,
  };

  if (started) {
    return (
      <div className="fixed inset-0 bg-white">
        <AuditChecklistPreview
          template={checklist}
          onClose={() => { setStarted(false); load(); }}
          draftKey={`scan-${equipment.id}-${type}`}
          equipmentInfo={equipmentInfo}
        />
      </div>
    );
  }

  const cfg = scheduleState ? STATUS_CONFIG[scheduleState.status] : STATUS_CONFIG['NEVER_DONE'];
  const StatusIcon = cfg.icon;
  const pct = scheduleState ? Math.min(scheduleState.percentElapsed * 100, 150) : 0;
  const barPct = Math.min(pct, 100);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 2);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">

        {/* Header */}
        <div className={`relative overflow-hidden px-6 py-5 ${isClean ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-700' : 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700'}`}>
          <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-black/10 rounded-full" />
          <div className="relative z-10">
            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20 mb-3">
              {isClean ? 'Cleaning & Hygiene' : 'Preventive Maintenance'}
            </span>
            <h1 className="text-xl font-black text-white uppercase tracking-tight leading-tight">{equipment.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-black text-white border border-white/20 font-mono">#{equipment.idNumber}</span>
              <span className="px-2 py-0.5 bg-white/15 rounded-full text-[9px] font-black text-white border border-white/20">{frequency}</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">

          {/* Schedule Status Card */}
          {scheduleState && (
            <div className={`rounded-2xl border ${cfg.borderColor} ${cfg.bgTint} overflow-hidden`}>
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-xl ${cfg.badgeBg}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${cfg.badgeText}`} />
                  </div>
                  <div>
                    <p className={`text-[9px] font-black uppercase tracking-widest ${cfg.badgeText}`}>{cfg.label}</p>
                    <p className="text-[8px] text-slate-400">{cfg.sublabel}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReschedule(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/70 border border-slate-200 text-[8px] font-black text-slate-500 uppercase tracking-widest hover:bg-white transition-all active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" /> Reschedule
                </button>
              </div>

              {/* Progress Bar */}
              <div className="px-4 pb-2">
                <div className="relative h-2 bg-white/80 rounded-full overflow-hidden border border-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${cfg.progressColor}`}
                    style={{ width: `${barPct}%` }}
                  />
                  {/* 50% marker */}
                  <div className="absolute top-0 bottom-0 w-px bg-slate-400/50" style={{ left: '50%' }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[7px] text-slate-400">Last done</span>
                  <span className="text-[7px] text-slate-400 font-bold">50%</span>
                  <span className="text-[7px] text-slate-400">Due date</span>
                </div>
              </div>

              {/* Schedule Details */}
              <div className="grid grid-cols-3 border-t border-slate-100/80">
                <div className="px-3 py-2.5 border-r border-slate-100/80">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />Last Done</p>
                  <p className="text-[10px] font-black text-slate-700 leading-tight">{formatRelativeDate(scheduleState.lastDoneDate)}</p>
                  {scheduleState.lastDoneDate && <p className="text-[7px] text-slate-400 mt-0.5">{formatDateShort(scheduleState.lastDoneDate)}</p>}
                </div>
                <div className="px-3 py-2.5 border-r border-slate-100/80">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Next Due</p>
                  {scheduleState.nextDueDate ? (
                    <>
                      <p className={`text-[10px] font-black leading-tight ${scheduleState.status === 'OVERDUE' ? 'text-red-600' : scheduleState.status === 'DUE' ? 'text-emerald-700' : 'text-slate-700'}`}>{formatRelativeDate(scheduleState.nextDueDate)}</p>
                      <p className="text-[7px] text-slate-400 mt-0.5">{formatDateShort(scheduleState.nextDueDate)}</p>
                    </>
                  ) : (
                    <p className="text-[10px] font-black text-slate-400">—</p>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" />Cycle</p>
                  <p className="text-[10px] font-black text-slate-700 leading-tight">{Math.round(barPct)}%</p>
                  <p className="text-[7px] text-slate-400 mt-0.5">{scheduleState.intervalDays}d interval</p>
                </div>
              </div>

              {/* Lock reason */}
              {scheduleState.status === 'LOCKED' && scheduleState.lockReason && (
                <div className="mx-3 mb-3 mt-0 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-amber-700 font-bold leading-snug">{scheduleState.lockReason}</p>
                  {scheduleState.daysUntilUnlocked != null && (
                    <p className="text-[9px] text-amber-600 mt-1">
                      Available in <span className="font-black">{scheduleState.daysUntilUnlocked} day{scheduleState.daysUntilUnlocked !== 1 ? 's' : ''}</span>
                    </p>
                  )}
                </div>
              )}

              {scheduleState.status === 'UPCOMING' && (
                <div className="mx-3 mb-3 mt-0 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-blue-700 font-bold leading-snug">
                    Early start allowed — more than 50% of the interval has passed.{' '}
                    {scheduleState.daysUntilDue != null && scheduleState.daysUntilDue > 0
                      ? `Due in ${scheduleState.daysUntilDue} day${scheduleState.daysUntilDue !== 1 ? 's' : ''}.`
                      : ''}
                  </p>
                </div>
              )}

              {scheduleState.status === 'OVERDUE' && (
                <div className="mx-3 mb-3 mt-0 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-red-700 font-bold leading-snug">
                    This checklist is overdue.{' '}
                    {scheduleState.daysUntilDue != null
                      ? `It was due ${Math.abs(scheduleState.daysUntilDue)} day${Math.abs(scheduleState.daysUntilDue) !== 1 ? 's' : ''} ago.`
                      : ''}
                    {' '}Please complete it as soon as possible.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Equipment Info */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex">
              <div className="flex-1 px-4 py-2.5 border-r border-slate-100">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                <p className="text-xs font-bold text-slate-800">{equipment.location || '—'}</p>
              </div>
              <div className="flex-1 px-4 py-2.5 border-r border-slate-100">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Dept</p>
                <p className="text-xs font-bold text-slate-800">{equipment.department || '—'}</p>
              </div>
              <div className="flex-1 px-4 py-2.5">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Make</p>
                <p className="text-xs font-bold text-slate-800">{equipment.make || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Start/History Button */}
        <div className="px-5 pb-5 space-y-2">
          {scheduleState && !scheduleState.canStart ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-100 border border-slate-200">
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {scheduleState.status === 'INACTIVE' ? 'Equipment Inactive' : 'Checklist Locked'}
                </span>
              </div>
              {scheduleState.status !== 'INACTIVE' && lastCompletion && (
                <button
                  onClick={handleViewHistory}
                  disabled={loadingHistory}
                  className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <History className="w-4 h-4" /> {loadingHistory ? 'Loading...' : 'Last Cleaning'}
                </button>
              )}
              {scheduleState.status !== 'INACTIVE' && !lastCompletion && (
                <button
                  onClick={() => setShowReschedule(true)}
                  className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Reschedule
                </button>
              )}
            </div>
          ) : scheduleState && (scheduleState.status === 'UPCOMING' || scheduleState.status === 'DUE') && lastCompletion ? (
            <div className="space-y-2">
              <button
                onClick={handleViewHistory}
                disabled={loadingHistory}
                className="w-full py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <History className="w-4 h-4" /> {loadingHistory ? 'Loading...' : 'Last Cleaning'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setStarted(true)}
              className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                scheduleState?.status === 'OVERDUE'
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                  : scheduleState?.status === 'DUE'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                    : isClean
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                      : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200'
              }`}
            >
              <Play className="w-4 h-4" />
              {scheduleState?.status === 'OVERDUE' ? 'Start Now (Overdue)' : 'Start Checklist'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {showReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className={`px-6 py-5 flex items-center justify-between ${isClean ? 'bg-gradient-to-r from-blue-500 to-cyan-600' : 'bg-gradient-to-r from-orange-500 to-amber-600'}`}>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Reschedule</h3>
                <p className="text-[9px] text-white/70 font-bold uppercase tracking-widest mt-0.5">{equipment.name}</p>
              </div>
              <button onClick={() => { setShowReschedule(false); setRescheduleDate(''); setRescheduleError(''); }} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Set Next Due Date</p>
                <p className="text-[10px] text-slate-500 mb-3 leading-snug">
                  This sets the new target date for the next {type === 'cleaning' ? 'cleaning' : 'maintenance'} cycle.
                  Future due dates will recalculate from this date.
                </p>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  min={minDateStr}
                  max={maxDateStr}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {rescheduleError && (
                  <p className="text-[10px] text-red-500 font-bold mt-2">{rescheduleError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReschedule(false); setRescheduleDate(''); setRescheduleError(''); }}
                  className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReschedule}
                  disabled={!rescheduleDate || rescheduling}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-1.5 ${
                    !rescheduleDate || rescheduling
                      ? 'bg-slate-300 cursor-not-allowed'
                      : isClean ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {rescheduling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {rescheduling ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && historyReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className={`px-6 py-5 flex items-center justify-between sticky top-0 ${isClean ? 'bg-gradient-to-r from-blue-500 to-cyan-600' : 'bg-gradient-to-r from-orange-500 to-amber-600'}`}>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Last Cleaning Report</h3>
                <p className="text-[9px] text-white/70 font-bold uppercase tracking-widest mt-0.5">{equipment?.name}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Date</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(lastCompletion.completedAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Time</p>
                  <p className="text-sm font-bold text-slate-800">{new Date(lastCompletion.completedAt).toLocaleTimeString()}</p>
                </div>
              </div>

              {historyReport.data?.checklistName && (
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Checklist</p>
                  <p className="text-sm font-bold text-slate-800">{historyReport.data.checklistName}</p>
                </div>
              )}

              {historyReport.data?.comments && Object.keys(historyReport.data.comments).length > 0 && (
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Evidence Images</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(() => {
                      const images: string[] = [];
                      Object.values(historyReport.data.comments).forEach((q: any) => {
                        if (q.entries) {
                          q.entries.forEach((e: any) => {
                            if (Array.isArray(e.images)) {
                              images.push(...e.images);
                            }
                          });
                        }
                      });
                      return images.map((img, idx) => (
                        <img key={idx} src={img} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded-lg border border-slate-200" />
                      ));
                    })()}
                  </div>
                </div>
              )}

              <button
                onClick={viewFilledChecklist}
                className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 ${
                  isClean ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                <FileText className="w-4 h-4" /> View Filled Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPdfViewer && pdfDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-900 text-white">
              <h3 className="text-sm font-black uppercase tracking-tight">Filled Cleaning Report</h3>
              <button onClick={() => setShowPdfViewer(false)} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-all">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <iframe
              src={pdfDataUrl}
              className="flex-1 w-full"
              title="Filled Checklist PDF"
            />
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex gap-2">
              <a
                href={pdfDataUrl}
                download={`cleaning-report-${new Date().toISOString().split('T')[0]}.pdf`}
                className="flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-slate-800 hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
