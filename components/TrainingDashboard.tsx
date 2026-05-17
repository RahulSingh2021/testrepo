'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Cell
} from 'recharts';
import {
  Users, CheckCircle, AlertTriangle, Clock, Calendar, Award,
  TrendingUp, TrendingDown, ChevronRight, RefreshCw,
  UserCheck, MapPin, Zap, Activity, ArrowRight, Loader2, AlertCircle
} from 'lucide-react';
import { Entity, HierarchyScope } from '../types';
import { EmployeeRecord } from './LearningManagement';

interface TrainingSession {
  id: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  topic: string;
  subTopic: string;
  trainer: string;
  trainerScope: string;
  date: string;
  startTime: string;
  endTime: string;
  trainingHours?: number;
  location?: string;
  unitName?: string;
  participantsPresent: number;
  participantsAbsent: number;
  participantsNeutral: number;
  participantList: { employeeId: string; status: 'present' | 'absent' | 'neutral'; addedAt: number }[];
  createdByEntityId: string;
  assignedUnits: string[];
}

interface TrainerRecord {
  id: string;
  Name?: string;
  Unit?: string;
  Corporate?: string;
  Regional?: string;
  trainerCategory?: string;
  delivered_uniqueCourses?: number;
  delivered_participants?: number;
  delivered_hours?: number;
  effectivenessScore?: number;
  classPassRate?: number;
  isFSTL?: boolean;
  isTrainer?: boolean;
}

export interface TrainingFocusContext {
  focusType: 'unit' | 'trainer' | 'topic';
  focusId?: string;
  focusName?: string;
}

interface TrainingDashboardProps {
  entities?: Entity[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  employees?: EmployeeRecord[];
  onNavigate?: (subTab: string, context?: TrainingFocusContext) => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string): string {
  if (!key) return '';
  const [, m] = key.split('-');
  return MONTH_LABELS[parseInt(m, 10) - 1] || key;
}

function getDaysDiff(dateStr: string): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 9999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function parseSessionHours(s: TrainingSession): number {
  if (s.trainingHours && s.trainingHours > 0) return s.trainingHours;
  if (s.startTime && s.endTime) {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return diff > 0 ? diff : 0;
    }
  }
  return 0;
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const StatCard = ({
  label, value, sub, icon: Icon, color, trend, trendLabel, onClick, delta, borderColor
}: {
  label: string; value: string | number; sub?: string; icon: React.FC<any>; color: string;
  trend?: 'up' | 'down' | 'neutral'; trendLabel?: string; onClick?: () => void;
  delta?: number | null; borderColor?: string;
}) => (
  <div
    onClick={onClick}
    style={borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 3 } : undefined}
    className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col gap-3 ${onClick ? 'cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all active:scale-[0.98]' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      {(trendLabel || delta != null) && (
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
          {trend === 'up' ? <TrendingUp size={9} /> : trend === 'down' ? <TrendingDown size={9} /> : null}
          {trendLabel || (delta != null ? (delta > 0 ? `+${delta} vs prev 30d` : delta < 0 ? `${delta} vs prev 30d` : 'No change') : '')}
        </div>
      )}
    </div>
    <div>
      <div className="text-3xl font-black text-slate-900 leading-none mb-1">{value}</div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</div>
      {sub && <div className="text-[10px] font-bold text-slate-400 mt-1">{sub}</div>}
    </div>
  </div>
);

const SectionTitle = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">{children}</h3>
    {action}
  </div>
);

export default function TrainingDashboard({ entities = [], currentScope, userRootId, employees: propEmployees, onNavigate }: TrainingDashboardProps) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [trainers, setTrainers] = useState<TrainerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDescendantIds = useCallback((parentId: string): string[] => {
    const children = entities.filter(e => e.parentId === parentId);
    return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
  }, [entities]);

  const scopedUnitIds = useMemo((): Set<string> => {
    let scopedEntities: Entity[] = [];
    if (currentScope === 'unit' && userRootId) {
      scopedEntities = entities.filter(e => e.id === userRootId && e.type === 'unit');
    } else if (currentScope === 'department' && userRootId) {
      const dept = entities.find(e => e.id === userRootId);
      if (dept?.parentId) scopedEntities = entities.filter(e => e.id === dept.parentId && e.type === 'unit');
    } else if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
      const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
      scopedEntities = entities.filter(e => e.type === 'unit' && descendantIds.has(e.id));
    } else {
      scopedEntities = entities.filter(e => e.type === 'unit');
    }
    return new Set(scopedEntities.map(e => e.id));
  }, [entities, currentScope, userRootId, getDescendantIds]);

  const scopedUnits = useMemo((): Entity[] => {
    return entities.filter(e => e.type === 'unit' && scopedUnitIds.has(e.id));
  }, [entities, scopedUnitIds]);

  const scopedUnitNames = useMemo((): Set<string> => {
    return new Set(
      entities.filter(e => scopedUnitIds.has(e.id)).map(e => (e.name || '').trim().toLowerCase())
    );
  }, [entities, scopedUnitIds]);

  const isSessionInScope = useCallback((session: TrainingSession): boolean => {
    if (scopedUnitIds.size === 0) return true;
    if (session.assignedUnits?.some(uid => scopedUnitIds.has(uid))) return true;
    if (session.createdByEntityId && scopedUnitIds.has(session.createdByEntityId)) return true;
    if (session.unitName && scopedUnitNames.has(session.unitName.trim().toLowerCase())) return true;
    return false;
  }, [scopedUnitIds, scopedUnitNames]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [calRes, trRes] = await Promise.all([
          fetch('/api/training-calendar'),
          fetch('/api/trainers')
        ]);
        if (calRes.ok) {
          const d = await calRes.json();
          setSessions(d.items || []);
        }
        if (trRes.ok) {
          const d = await trRes.json();
          setTrainers((d.items || []).filter((t: TrainerRecord) => t.isTrainer !== false));
        }
      } catch {
        setError('Failed to load training data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const scopedSessions = useMemo(() => sessions.filter(isSessionInScope), [sessions, isSessionInScope]);
  const completedSessions = useMemo(() => scopedSessions.filter(s => s.status === 'Completed'), [scopedSessions]);
  const upcomingSessions = useMemo(() => scopedSessions.filter(s => s.status === 'Upcoming' || s.status === 'Ongoing'), [scopedSessions]);

  const scopedTrainers = useMemo(() => {
    const baseTrainers: TrainerRecord[] = propEmployees
      ? propEmployees.filter(e => e.isTrainer).map(e => ({
          id: e.id, Name: e.Name, Unit: e.Unit, Corporate: e.Corporate, Regional: e.Regional,
          trainerCategory: e.trainerCategory,
          delivered_uniqueCourses: e.delivered_uniqueCourses,
          delivered_participants: e.delivered_participants,
          delivered_hours: e.delivered_hours,
          effectivenessScore: e.effectivenessScore,
          classPassRate: e.classPassRate,
          isFSTL: e.isFSTL,
          isTrainer: true,
        }))
      : trainers;
    if (scopedUnitIds.size === 0) return baseTrainers;
    return baseTrainers.filter(t => {
      const tUnit = (t.Unit || '').trim().toLowerCase();
      return !tUnit || scopedUnitNames.has(tUnit);
    });
  }, [trainers, propEmployees, scopedUnitIds, scopedUnitNames]);

  const kpis = useMemo(() => {
    const now = new Date();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const cutCurrent = new Date(now.getTime() - ms30);
    const cutPrev = new Date(now.getTime() - 2 * ms30);

    const inWindow = (sess: TrainingSession, from: Date, to: Date) => {
      const d = new Date(sess.date || sess.startTime);
      return !isNaN(d.getTime()) && d >= from && d <= to;
    };

    const current30 = completedSessions.filter(s => inWindow(s, cutCurrent, now));
    const prev30 = completedSessions.filter(s => inWindow(s, cutPrev, cutCurrent));

    const calcRate = (arr: TrainingSession[]) => {
      const p = arr.reduce((s, x) => s + (x.participantsPresent || 0), 0);
      const a = arr.reduce((s, x) => s + (x.participantsAbsent || 0), 0);
      return p + a > 0 ? Math.round((p / (p + a)) * 100) : 0;
    };
    const calcUnique = (arr: TrainingSession[]) => {
      const set = new Set<string>();
      arr.forEach(s => s.participantList?.filter(p => p.status === 'present').forEach(p => set.add(p.employeeId)));
      return set.size;
    };
    const calcHours = (arr: TrainingSession[]) => arr.reduce((sum, s) => sum + parseSessionHours(s), 0);

    const totalPresent = completedSessions.reduce((s, sess) => s + (sess.participantsPresent || 0), 0);
    const totalAbsent = completedSessions.reduce((s, sess) => s + (sess.participantsAbsent || 0), 0);
    const attendanceRate = totalPresent + totalAbsent > 0
      ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100)
      : 0;

    const uniqueEmployees = calcUnique(completedSessions);
    const totalHours = calcHours(completedSessions);

    const deltaSessionsCount = current30.length - prev30.length;
    const deltaAttendanceRate = calcRate(current30) - calcRate(prev30);
    const deltaUniqueEmployees = calcUnique(current30) - calcUnique(prev30);
    const deltaHours = Math.round(calcHours(current30) - calcHours(prev30));

    const trainersCurrent30 = new Set(
      current30.filter(s => s.trainer).map(s => s.trainer)
    );
    const trainersPrev30 = new Set(
      prev30.filter(s => s.trainer).map(s => s.trainer)
    );
    const deltaTrainers = trainersCurrent30.size - trainersPrev30.size;

    const in31to60d = new Date(now.getTime() + ms30);
    const in60to90d = new Date(now.getTime() + 2 * ms30);
    const upcomingNext30 = upcomingSessions.filter(s => inWindow(s, now, in31to60d)).length;
    const upcomingNext60 = upcomingSessions.filter(s => inWindow(s, in31to60d, in60to90d)).length;
    const deltaUpcoming = upcomingNext30 - upcomingNext60;

    return {
      sessionsCount: completedSessions.length,
      attendanceRate,
      uniqueEmployees,
      totalHours,
      trainersCount: scopedTrainers.length,
      upcomingCount: upcomingSessions.length,
      deltaSessionsCount,
      deltaAttendanceRate,
      deltaUniqueEmployees,
      deltaHours,
      deltaTrainers,
      deltaUpcoming,
    };
  }, [completedSessions, upcomingSessions, scopedTrainers]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(mk => {
      const monthSessions = completedSessions.filter(s => getMonthKey(s.date || s.startTime) === mk);
      const present = monthSessions.reduce((sum, s) => sum + (s.participantsPresent || 0), 0);
      const absent = monthSessions.reduce((sum, s) => sum + (s.participantsAbsent || 0), 0);
      const rate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
      return { month: formatMonthLabel(mk), sessions: monthSessions.length, rate, present, absent };
    });
  }, [completedSessions]);

  const topicData = useMemo(() => {
    const map = new Map<string, { sessions: number; present: number; total: number }>();
    completedSessions.forEach(s => {
      const topic = s.topic || 'Other';
      const entry = map.get(topic) || { sessions: 0, present: 0, total: 0 };
      entry.sessions++;
      entry.present += s.participantsPresent || 0;
      entry.total += (s.participantsPresent || 0) + (s.participantsAbsent || 0);
      map.set(topic, entry);
    });
    return Array.from(map.entries())
      .map(([topic, d]) => ({ topic, sessions: d.sessions, rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0 }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [completedSessions]);

  const unitComplianceData = useMemo(() => {
    const unitNameLower = (unit: Entity) => (unit.name || '').trim().toLowerCase();
    return scopedUnits.map(unit => {
      const uNameLow = unitNameLower(unit);
      const unitSessions = completedSessions.filter(s =>
        s.assignedUnits?.includes(unit.id) ||
        s.createdByEntityId === unit.id ||
        (s.unitName && s.unitName.trim().toLowerCase() === uNameLow)
      );
      const present = unitSessions.reduce((sum, s) => sum + (s.participantsPresent || 0), 0);
      const absent = unitSessions.reduce((sum, s) => sum + (s.participantsAbsent || 0), 0);
      const rate = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
      const topics = new Set(unitSessions.map(s => s.topic)).size;
      const dates = unitSessions.map(s => s.date || s.startTime).filter(Boolean).sort();
      const lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
      const daysSince = lastDate ? getDaysDiff(lastDate) : 9999;
      const status: 'On Track' | 'Gap' | 'No Training' =
        daysSince <= 30 ? 'On Track' : daysSince <= 60 ? 'Gap' : 'No Training';
      return { unit, sessions: unitSessions.length, rate, topics, lastDate, daysSince, status };
    }).sort((a, b) => {
      const order = { 'No Training': 0, 'Gap': 1, 'On Track': 2 };
      return order[a.status] - order[b.status];
    });
  }, [scopedUnits, completedSessions]);

  const gapAlerts = useMemo(() => {
    const noTraining30 = unitComplianceData.filter(u => u.daysSince > 30);

    const catalogTopics = new Set<string>();
    entities.forEach(e => (e.masterSops || []).forEach(sop => { if (sop.name) catalogTopics.add(sop.name); }));
    const topicLastSeen = new Map<string, number>();
    completedSessions.forEach(s => {
      if (s.topic) {
        const days = getDaysDiff(s.date || s.startTime);
        const prev = topicLastSeen.get(s.topic) ?? Infinity;
        if (days < prev) topicLastSeen.set(s.topic, days);
      }
    });
    const staleTopics: string[] = [];
    catalogTopics.forEach(topic => {
      const daysSinceLastTraining = topicLastSeen.get(topic) ?? Infinity;
      if (daysSinceLastTraining > 60) staleTopics.push(topic);
    });

    const lowAttendanceUnits = unitComplianceData.filter(u => {
      const uNameLow = (u.unit.name || '').trim().toLowerCase();
      const unitSessions = completedSessions.filter(s =>
        s.assignedUnits?.includes(u.unit.id) ||
        s.createdByEntityId === u.unit.id ||
        (s.unitName && s.unitName.trim().toLowerCase() === uNameLow)
      );
      if (unitSessions.length === 0) return false;
      return unitSessions.every(s => {
        const total = (s.participantsPresent || 0) + (s.participantsAbsent || 0);
        return total > 0 && (s.participantsPresent || 0) / total < 0.5;
      });
    });

    return { noTraining30, staleTopics, lowAttendanceUnits };
  }, [unitComplianceData, completedSessions, entities]);

  const upcomingNext14 = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 14);
    return upcomingSessions
      .filter(s => {
        const d = new Date(s.date || s.startTime);
        return !isNaN(d.getTime()) && d >= now && d <= cutoff;
      })
      .sort((a, b) => new Date(a.date || a.startTime).getTime() - new Date(b.date || b.startTime).getTime())
      .slice(0, 8);
  }, [upcomingSessions]);

  const topicBarColor = (rate: number) => {
    if (rate >= 80) return '#10b981';
    if (rate >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading Training Dashboard</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Training Dashboard</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {scopedUnits.length > 0 ? `${scopedUnits.length} unit${scopedUnits.length !== 1 ? 's' : ''} in scope` : 'All units'} · {completedSessions.length} sessions conducted
          </p>
        </div>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Section A: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Sessions Conducted"
          value={kpis.sessionsCount}
          sub={`${upcomingSessions.length} upcoming`}
          icon={CheckCircle}
          color="bg-emerald-50 text-emerald-600"
          onClick={() => onNavigate?.('learning-calendar')}
          delta={kpis.deltaSessionsCount}
          trend={kpis.deltaSessionsCount > 0 ? 'up' : kpis.deltaSessionsCount < 0 ? 'down' : 'neutral'}
          borderColor={kpis.sessionsCount > 0 ? '#10b981' : '#ef4444'}
        />
        <StatCard
          label="Attendance Rate"
          value={`${kpis.attendanceRate}%`}
          sub="Overall present ÷ total"
          icon={Activity}
          color={kpis.attendanceRate >= 80 ? 'bg-emerald-50 text-emerald-600' : kpis.attendanceRate >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}
          trend={kpis.deltaAttendanceRate > 0 ? 'up' : kpis.deltaAttendanceRate < 0 ? 'down' : 'neutral'}
          delta={kpis.deltaAttendanceRate}
          borderColor={kpis.attendanceRate >= 80 ? '#10b981' : kpis.attendanceRate >= 50 ? '#f59e0b' : '#ef4444'}
        />
        <StatCard
          label="Employees Trained"
          value={kpis.uniqueEmployees}
          sub="Unique present attendees"
          icon={Users}
          color="bg-blue-50 text-blue-600"
          onClick={() => onNavigate?.('learning-tracker')}
          delta={kpis.deltaUniqueEmployees}
          trend={kpis.deltaUniqueEmployees > 0 ? 'up' : kpis.deltaUniqueEmployees < 0 ? 'down' : 'neutral'}
          borderColor={kpis.uniqueEmployees > 0 ? '#3b82f6' : '#94a3b8'}
        />
        <StatCard
          label="Training Hours"
          value={formatHours(kpis.totalHours)}
          sub="Total delivered"
          icon={Clock}
          color="bg-purple-50 text-purple-600"
          delta={kpis.deltaHours}
          trend={kpis.deltaHours > 0 ? 'up' : kpis.deltaHours < 0 ? 'down' : 'neutral'}
          borderColor={kpis.totalHours > 0 ? '#8b5cf6' : '#94a3b8'}
        />
        <StatCard
          label="Active Trainers"
          value={kpis.trainersCount}
          sub="In scope"
          icon={UserCheck}
          color="bg-indigo-50 text-indigo-600"
          onClick={() => onNavigate?.('learning-trainer', { focusType: 'trainer' })}
          delta={kpis.deltaTrainers}
          trend={kpis.deltaTrainers > 0 ? 'up' : kpis.deltaTrainers < 0 ? 'down' : 'neutral'}
          borderColor={kpis.trainersCount > 0 ? '#6366f1' : '#ef4444'}
        />
        <StatCard
          label="Upcoming Sessions"
          value={kpis.upcomingCount}
          sub="Scheduled ahead"
          icon={Calendar}
          color={kpis.upcomingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}
          onClick={() => onNavigate?.('learning-calendar', { focusType: 'topic' })}
          delta={kpis.deltaUpcoming}
          trend={kpis.deltaUpcoming > 0 ? 'up' : kpis.deltaUpcoming < 0 ? 'down' : 'neutral'}
          borderColor={kpis.upcomingCount > 0 ? '#f59e0b' : '#94a3b8'}
        />
      </div>

      {/* Section B: Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <SectionTitle>Monthly Session & Attendance Trend</SectionTitle>
          {monthlyData.some(d => d.sessions > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} unit="%" />
                <Tooltip
                  contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 12, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                />
                <Bar yAxisId="left" dataKey="sessions" name="Sessions" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="Attendance %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-300 text-xs font-bold uppercase">No completed sessions yet</div>
          )}
        </div>

        {/* Topic Coverage */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <SectionTitle>Topic Coverage</SectionTitle>
          {topicData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topicData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="topic" width={110} tick={{ fontSize: 10, fontWeight: 700, fill: '#334155' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 12, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                  formatter={(val: any, name: string) => [val, name === 'sessions' ? 'Sessions' : name]}
                />
                <Bar dataKey="sessions" name="sessions" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {topicData.map((entry, i) => (
                    <Cell key={i} fill={topicBarColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-300 text-xs font-bold uppercase">No topic data yet</div>
          )}
          <div className="flex items-center gap-4 mt-3 justify-end">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />≥80% attendance</span>
            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />50–79%</span>
            <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;50%</span>
          </div>
        </div>
      </div>

      {/* Section C: Unit-wise Compliance Table */}
      {unitComplianceData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <SectionTitle
              action={
                <button onClick={() => onNavigate?.('learning-calendar')} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800">
                  View Calendar <ChevronRight size={12} />
                </button>
              }
            >
              Unit-wise Training Compliance
            </SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sessions</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Attendance</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Topics</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Training</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {unitComplianceData.map(({ unit, sessions, rate, topics, lastDate, status }) => (
                  <tr
                    key={unit.id}
                    className="border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer transition-colors"
                    onClick={() => onNavigate?.('learning-calendar', { focusType: 'unit', focusId: unit.id, focusName: unit.name })}
                  >
                    <td className="px-5 py-3.5 font-bold text-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin size={11} className="text-slate-300 shrink-0" />
                        {unit.name}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center font-black text-slate-700">{sessions}</td>
                    <td className="px-4 py-3.5 text-center">
                      {sessions > 0 ? (
                        <span className={`font-black ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{rate}%</span>
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center font-black text-slate-700">{topics > 0 ? topics : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-bold whitespace-nowrap">{lastDate ? formatDate(lastDate) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest
                        ${status === 'On Track' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : status === 'Gap' ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {status === 'On Track' ? <CheckCircle size={9} /> : <AlertTriangle size={9} />}
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section D: Upcoming + Gap Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Upcoming Schedule */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <SectionTitle
            action={
              <button onClick={() => onNavigate?.('learning-calendar')} className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800">
                See All <ChevronRight size={12} />
              </button>
            }
          >
            Upcoming — Next 14 Days
          </SectionTitle>
          {upcomingNext14.length > 0 ? (
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {upcomingNext14.map(s => {
                const d = new Date(s.date || s.startTime);
                const isToday = getDaysDiff(s.date || s.startTime) === 0;
                const isTomorrow = getDaysDiff(s.date || s.startTime) === -1;
                const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatDate(s.date || s.startTime);
                const participantCount = (s.participantsPresent || 0) + (s.participantsAbsent || 0) + (s.participantsNeutral || 0) + (s.participantList?.length || 0);
                return (
                  <div key={s.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                    <div className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white font-black text-[10px] leading-tight
                      ${s.status === 'Ongoing' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                      <span>{String(isNaN(d.getTime()) ? '' : d.getDate()).padStart(2, '0')}</span>
                      <span className="text-[8px] uppercase">{isNaN(d.getTime()) ? '' : MONTH_LABELS[d.getMonth()]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {s.status === 'Ongoing' && (
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100 uppercase">Live</span>
                        )}
                        <span className="text-[11px] font-black text-slate-800 truncate">{s.topic}</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 truncate">{s.subTopic && `${s.subTopic} · `}{s.trainer}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-slate-400">{label}</span>
                        {s.location && <span className="text-[9px] font-bold text-slate-400">{s.location}</span>}
                        {participantCount > 0 && <span className="text-[9px] font-bold text-indigo-500">{participantCount} registered</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[120px] flex flex-col items-center justify-center text-slate-300">
              <Calendar size={24} className="mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">No sessions in the next 14 days</span>
            </div>
          )}
        </div>

        {/* Gap Alerts */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <SectionTitle>Gap Alerts</SectionTitle>
          <div className="space-y-4">
            {/* No Training in last 30 days */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">No Training — Last 30 Days</span>
              </div>
              {gapAlerts.noTraining30.length > 0 ? (
                <div className="space-y-1.5">
                  {gapAlerts.noTraining30.slice(0, 4).map(u => (
                    <div key={u.unit.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-[11px] font-bold text-red-800">{u.unit.name}</span>
                      <span className="text-[10px] font-black text-red-500">{u.daysSince > 999 ? 'Never' : `${u.daysSince}d ago`}</span>
                    </div>
                  ))}
                  {gapAlerts.noTraining30.length > 4 && (
                    <p className="text-[10px] font-bold text-red-400 pl-2">+{gapAlerts.noTraining30.length - 4} more</p>
                  )}
                </div>
              ) : (
                <p className="text-[10px] font-bold text-slate-400 pl-4">All units trained recently.</p>
              )}
            </div>

            {/* Topics not covered in 60 days */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Topics Stale — 60+ Days</span>
              </div>
              {gapAlerts.staleTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {gapAlerts.staleTopics.slice(0, 6).map(t => (
                    <span key={t} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100">{t}</span>
                  ))}
                  {gapAlerts.staleTopics.length > 6 && (
                    <span className="px-2.5 py-1 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full border border-slate-100">+{gapAlerts.staleTopics.length - 6} more</span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] font-bold text-slate-400 pl-4">All topics covered recently.</p>
              )}
            </div>

            {/* Low attendance units */}
            {gapAlerts.lowAttendanceUnits.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Low Attendance (&lt;50%)</span>
                </div>
                <div className="space-y-1.5">
                  {gapAlerts.lowAttendanceUnits.slice(0, 3).map(u => (
                    <div key={u.unit.id} className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="text-[11px] font-bold text-amber-800">{u.unit.name}</span>
                      <span className="text-[10px] font-black text-amber-500">{u.sessions} session{u.sessions !== 1 ? 's' : ''} all &lt;50%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gapAlerts.noTraining30.length === 0 && gapAlerts.staleTopics.length === 0 && gapAlerts.lowAttendanceUnits.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                <CheckCircle size={28} className="mb-2 text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">No active gaps detected</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section E: Trainer Performance Strip */}
      {scopedTrainers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <SectionTitle
            action={
              <button onClick={() => onNavigate?.('learning-trainer')} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                View All Trainers <ArrowRight size={11} />
              </button>
            }
          >
            Trainer Performance
          </SectionTitle>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {scopedTrainers.map(t => {
              const initials = (t.Name || 'T').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
              const isExternal = t.trainerCategory === 'External';
              const score = t.effectivenessScore || 0;
              return (
                <div
                  key={t.id}
                  onClick={() => onNavigate?.('learning-trainer', { focusType: 'trainer', focusId: t.id, focusName: t.Name })}
                  className="shrink-0 w-44 bg-slate-50 rounded-2xl border border-slate-100 p-4 cursor-pointer hover:border-indigo-200 hover:bg-white transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm
                      ${isExternal ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-slate-800 truncate leading-tight">{t.Name || 'Trainer'}</div>
                      <div className={`text-[9px] font-black uppercase tracking-widest ${isExternal ? 'text-purple-500' : 'text-indigo-500'}`}>
                        {t.trainerCategory || 'Internal'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-sm font-black text-slate-900">{t.delivered_uniqueCourses || 0}</div>
                      <div className="text-[8px] font-black text-slate-300 uppercase">Sessions</div>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{t.delivered_participants || 0}</div>
                      <div className="text-[8px] font-black text-slate-300 uppercase">Staff</div>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{t.delivered_hours || 0}h</div>
                      <div className="text-[8px] font-black text-slate-300 uppercase">Hours</div>
                    </div>
                  </div>
                  {score > 0 && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <Zap size={10} className={score >= 90 ? 'text-emerald-500' : score >= 80 ? 'text-blue-500' : 'text-amber-500'} />
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 90 ? 'bg-emerald-500' : score >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-black text-slate-500">{score}%</span>
                    </div>
                  )}
                  {t.isFSTL && (
                    <div className="mt-2 flex items-center gap-1">
                      <Award size={9} className="text-amber-500" />
                      <span className="text-[8px] font-black text-amber-600 uppercase">FSTL</span>
                    </div>
                  )}
                </div>
              );
            })}
            {scopedTrainers.length > 10 && (
              <div
                onClick={() => onNavigate?.('learning-trainer')}
                className="shrink-0 w-32 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all"
              >
                <span className="text-lg font-black text-slate-400">+{scopedTrainers.length - 10}</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">More</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
