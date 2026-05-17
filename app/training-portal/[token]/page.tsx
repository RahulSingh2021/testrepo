'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Clock, Plus, Save, Trash2, X, Loader2, CheckCircle2,
  AlertTriangle, GraduationCap, MapPin, User, BookOpen, Monitor,
  Users, ChevronDown, FileText, Lock, ArrowLeft, Search,
  Layers, RefreshCw, ChevronLeft, ChevronRight, UserCheck,
  ArrowRight, Edit, Filter
} from 'lucide-react';

interface PortalSession {
  id: string;
  topic: string;
  topicRemark?: string;
  subTopic: string;
  trainer: string;
  trainerScope: string;
  date: string;
  startTime: string;
  endTime: string;
  trainingHours?: number;
  mode: 'Classroom' | 'Online' | 'Recorded' | 'Demo';
  location?: string;
  description?: string;
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  participantsPresent: number;
  participantsAbsent: number;
  participantsNeutral: number;
  participantList: any[];
  hasSheet: boolean;
  isLocked: boolean;
  createdByEntityId: string;
  assignedUnits: string[];
  portalToken?: string;
  createdViaPortal?: boolean;
}

interface LinkData {
  id: string;
  unitId: string;
  unitName: string;
  corporateName: string;
  expiresAt: string;
  createdAt: string;
}

const TOPICS = [
  'HACCP Principles', 'Food Safety Basics', 'Personal Hygiene', 'Cross-Contamination Prevention',
  'Temperature Control', 'Allergen Management', 'Cleaning & Sanitation', 'Pest Control',
  'Waste Management', 'Chemical Safety', 'Equipment Handling', 'Emergency Procedures',
  'Fire Safety', 'First Aid', 'Customer Service', 'Service Excellence', 'Other'
];

const MODES = ['Classroom', 'Online', 'Recorded', 'Demo'] as const;

export default function TrainingPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = React.use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [sessions, setSessions] = useState<PortalSession[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSession, setEditingSession] = useState<PortalSession | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [form, setForm] = useState({
    topic: '', topicRemark: '', subTopic: '', trainer: '', trainerScope: 'Internal',
    date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00',
    mode: 'Classroom' as typeof MODES[number], location: '', description: '',
    status: 'Upcoming' as 'Upcoming' | 'Ongoing' | 'Completed',
  });

  useEffect(() => {
    loadPortal();
  }, [token]);

  const loadPortal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training-portal?token=${token}`);
      if (res.status === 410) { setExpired(true); setLoading(false); return; }
      if (!res.ok) { setError('Invalid or expired link'); setLoading(false); return; }
      const data = await res.json();
      if (!data.valid) { setError('Invalid link'); setLoading(false); return; }
      setLinkData(data.link);
      setSessions(data.sessions || []);
    } catch { setError('Failed to load portal'); }
    setLoading(false);
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const resetForm = () => {
    setForm({
      topic: '', topicRemark: '', subTopic: '', trainer: '', trainerScope: 'Internal',
      date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00',
      mode: 'Classroom', location: '', description: '', status: 'Upcoming',
    });
    setEditingSession(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic || !form.trainer || !form.date) {
      showToast('Please fill in Topic, Trainer, and Date', 'error');
      return;
    }

    setSaving(true);
    try {
      const start = form.startTime.split(':').map(Number);
      const end = form.endTime.split(':').map(Number);
      const hours = Math.max(0.5, ((end[0] * 60 + end[1]) - (start[0] * 60 + start[1])) / 60);

      const session: any = {
        ...form,
        trainingHours: Math.round(hours * 10) / 10,
        participantsPresent: 0,
        participantsAbsent: 0,
        participantsNeutral: 0,
        participantList: [],
        hasSheet: false,
        isLocked: false,
      };

      if (editingSession) {
        session.id = editingSession.id;
      }

      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-session', token, session }),
      });

      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || 'Failed to save', 'error');
        setSaving(false);
        return;
      }

      const result = await res.json();
      if (editingSession) {
        setSessions(prev => prev.map(s => s.id === editingSession.id ? { ...session, id: editingSession.id } : s));
      } else {
        setSessions(prev => [{ ...session, id: result.sessionId }, ...prev]);
      }

      showToast(editingSession ? 'Session updated' : 'Session created', 'success');
      resetForm();
      setShowForm(false);
    } catch { showToast('Failed to save session', 'error'); }
    setSaving(false);
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session?')) return;
    try {
      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-session', token, sessionId }),
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        showToast('Session deleted', 'success');
      } else {
        const d = await res.json();
        showToast(d.error || 'Cannot delete', 'error');
      }
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleEdit = (session: PortalSession) => {
    setForm({
      topic: session.topic || '',
      topicRemark: session.topicRemark || '',
      subTopic: session.subTopic || '',
      trainer: session.trainer || '',
      trainerScope: session.trainerScope || 'Internal',
      date: session.date || new Date().toISOString().split('T')[0],
      startTime: session.startTime || '09:00',
      endTime: session.endTime || '10:00',
      mode: session.mode || 'Classroom',
      location: session.location || '',
      description: session.description || '',
      status: session.status || 'Upcoming',
    });
    setEditingSession(session);
    setShowForm(true);
  };

  const expiresIn = useMemo(() => {
    if (!linkData) return '';
    const diff = new Date(linkData.expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m remaining`;
  }, [linkData]);

  const metrics = useMemo(() => {
    const total = sessions.length;
    const upcoming = sessions.filter(s => s.status === 'Upcoming').length;
    const ongoing = sessions.filter(s => s.status === 'Ongoing').length;
    const completed = sessions.filter(s => s.status === 'Completed').length;
    const participants = sessions.reduce((sum, s) => sum + s.participantsPresent + s.participantsAbsent + s.participantsNeutral, 0);
    return { total, upcoming, ongoing, completed, participants };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.topic.toLowerCase().includes(q) ||
        s.trainer.toLowerCase().includes(q) ||
        (s.subTopic && s.subTopic.toLowerCase().includes(q)) ||
        (s.location && s.location.toLowerCase().includes(q))
      );
    }
    return result;
  }, [sessions, search, statusFilter]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    } catch { return dateStr; }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Training Portal...</p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Link Expired</h2>
          <p className="text-sm text-slate-500">This training portal link has expired. Please contact your administrator for a new link.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Invalid Link</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const totalItems = filteredSessions.length;
  const isSearchActive = search.trim().length > 0;
  const showAll = rowsPerPage === -1 || isSearchActive;
  const totalPages = showAll ? 1 : Math.ceil(totalItems / rowsPerPage);
  const safePage = Math.min(currentPage, totalPages || 1);
  const startIdx = showAll ? 0 : (safePage - 1) * rowsPerPage;
  const paginatedItems = showAll ? filteredSessions : filteredSessions.slice(startIdx, startIdx + rowsPerPage);
  const endIdx = Math.min(startIdx + paginatedItems.length, totalItems);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 pb-20">
      <div className="space-y-10 max-w-[1600px] mx-auto px-4 md:px-8 py-8">

        <div className="bg-white p-6 rounded-[3rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 overflow-hidden relative text-left">
          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
          <div className="flex items-center gap-6">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[2rem] shadow-inner border border-indigo-100 ring-4 ring-white">
              <Calendar size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">Session Registry</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                <MapPin size={12} className="text-emerald-500" /> {linkData?.unitName}
                {linkData?.corporateName && (
                  <><span className="text-slate-200 mx-1">|</span>{linkData.corporateName}</>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${expiresIn === 'Expired' ? 'bg-rose-600/10 text-rose-600' : 'bg-emerald-600/10 text-emerald-600'}`}>
              <Clock size={12} className="inline mr-1.5" />{expiresIn}
            </div>
            <div className="relative group w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search registry index..."
                className="pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black w-full focus:outline-none focus:ring-4 focus:ring-indigo-50/10 focus:border-indigo-400 transition-all placeholder:text-slate-300 shadow-inner uppercase tracking-wider"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-8 py-3.5 bg-[#0f172a] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 whitespace-nowrap"
            >
              <Plus size={20} strokeWidth={3} /> Schedule New
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { label: 'Total Sessions', val: metrics.total, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50', filter: null },
            { label: 'Upcoming Hub', val: metrics.upcoming, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', filter: 'Upcoming' },
            { label: 'Ongoing Flow', val: metrics.ongoing, icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', filter: 'Ongoing' },
            { label: 'Completed', val: metrics.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'Completed' },
            { label: 'Participants', val: metrics.participants, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', filter: null },
          ].map((stat, i) => (
            <button
              key={i}
              onClick={() => { if (stat.filter !== undefined) { setStatusFilter(statusFilter === stat.filter ? null : stat.filter); setCurrentPage(1); } }}
              className={`bg-white p-6 rounded-[2.5rem] border shadow-sm flex items-center gap-5 hover:shadow-xl transition-all group text-left ${statusFilter === stat.filter && stat.filter ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100'}`}
            >
              <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-6 transition-transform shrink-0`}>
                <stat.icon size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] leading-none mb-1.5 truncate">{stat.label}</p>
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Rows per page:</span>
            <select
              className="border rounded p-1"
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>All</option>
            </select>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-xs font-medium text-slate-500">
              {isSearchActive ? `${totalItems} results found` : showAll ? `${totalItems} sessions` : `${startIdx + 1}-${endIdx} of ${totalItems} sessions`}
            </span>
            {statusFilter && (
              <button onClick={() => { setStatusFilter(null); setCurrentPage(1); }} className="ml-2 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase flex items-center gap-1">
                {statusFilter} <X size={10} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              disabled={safePage <= 1 || showAll}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium">Page {safePage} of {totalPages}</span>
            <button
              disabled={safePage >= totalPages || showAll}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {paginatedItems.length === 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar size={40} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">
              {search || statusFilter ? 'No Matching Sessions' : 'No Training Sessions Yet'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {search || statusFilter ? 'Try adjusting your search or filters.' : 'Create your first training session to get started.'}
            </p>
            {!search && !statusFilter && (
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <Plus size={16} /> Create Session
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto overflow-visible">
          {paginatedItems.map((session, idx) => {
            const statusStyles: Record<string, string> = {
              'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-100',
              'Ongoing': 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
              'Upcoming': 'bg-amber-50 text-amber-700 border-amber-100'
            };

            return (
              <div key={session.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl transition-all group">
                <div className="flex flex-col lg:flex-row items-stretch">
                  <div className="p-6 lg:p-8 lg:w-[28%] flex items-start gap-6 bg-white relative group">
                    <div className="shrink-0 w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
                      <span className="text-xl font-black">{String(startIdx + idx + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${statusStyles[session.status] || statusStyles['Upcoming']}`}>
                          {session.status}
                        </span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono">#{session.id.slice(-8)}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors truncate mb-1">{session.topic === 'Other' ? session.topicRemark || session.topic : session.topic}</h3>
                      {session.subTopic && (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          <Layers size={14} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{session.subTopic}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-slate-50/20 shrink-0">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 group/item">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover/item:text-indigo-600 transition-all border border-slate-100"><UserCheck size={20} /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Assigned Trainer</p>
                          <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight">{session.trainer}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{session.trainerScope}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 group/item">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover/item:text-purple-600 transition-all border border-slate-100"><MapPin size={20} /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Deployment Venue</p>
                          <p className="text-sm font-black text-slate-800 uppercase truncate leading-tight">{session.mode} &bull; {session.location || 'Central N...'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 lg:p-8 lg:w-[22%] flex flex-col justify-center bg-white shrink-0">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 group/item">
                        <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 group-hover/item:text-orange-500 transition-all"><Calendar size={20} /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Cycle Date</p>
                          <p className="text-lg font-black text-slate-900 tracking-tighter uppercase">{formatDate(session.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4 group/item">
                        <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 group-hover/item:text-blue-500 transition-all"><Clock size={20} /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Operational Window</p>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-700">{formatTime(session.startTime)}</span>
                            <ArrowRight size={12} className="text-slate-300" />
                            <span className="text-sm font-black text-slate-700">{formatTime(session.endTime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 lg:p-8 lg:w-[12%] flex flex-col justify-center bg-slate-50/20 shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center leading-none">Registry Analytics</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center p-3 rounded-2xl border bg-white border-slate-100 shadow-sm">
                        <span className="text-[14px] font-black mb-1 text-emerald-600">{session.participantsPresent}</span>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300">Present</span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-2xl border bg-white border-slate-100 shadow-sm">
                        <span className="text-[14px] font-black mb-1 text-rose-600">{session.participantsAbsent}</span>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300">Absent</span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-2xl border bg-white border-slate-100 shadow-sm">
                        <span className="text-[14px] font-black mb-1 text-amber-500">{session.participantsNeutral}</span>
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-300">Wait</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 lg:p-8 flex-1 flex flex-col justify-center items-center gap-4 bg-white relative min-w-0 lg:min-w-[150px]">
                    <div className="flex items-center gap-3 w-full justify-end shrink-0">
                      <button onClick={() => handleEdit(session)} className="px-5 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-90 border border-indigo-200 hover:border-indigo-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-wider z-10">
                        <Edit size={16}/> Edit
                      </button>
                      <button onClick={() => handleDelete(session.id)} className="p-3 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-xs active:scale-90 border border-transparent hover:border-rose-100 z-10">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    {session.trainingHours && (
                      <div className="text-center">
                        <p className="text-2xl font-black text-indigo-600 tracking-tighter">{session.trainingHours}h</p>
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Duration</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalItems > 0 && (
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Rows per page:</span>
              <select
                className="border rounded p-1"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
              <span className="text-slate-300 mx-1">|</span>
              <span className="text-xs font-medium text-slate-500">
                {isSearchActive ? `${totalItems} results found` : showAll ? `${totalItems} sessions` : `${startIdx + 1}-${endIdx} of ${totalItems} sessions`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                disabled={safePage <= 1 || showAll}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">Page {safePage} of {totalPages}</span>
              <button
                disabled={safePage >= totalPages || showAll}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">{editingSession ? 'Edit Session' : 'New Training Session'}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{linkData?.unitName}</p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Topic *</label>
                <select value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all bg-white">
                  <option value="">Select Topic</option>
                  {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.topic === 'Other' && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Custom Topic</label>
                  <input value={form.topicRemark} onChange={e => setForm({ ...form, topicRemark: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" placeholder="Enter custom topic" />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Sub-Topic</label>
                <input value={form.subTopic} onChange={e => setForm({ ...form, subTopic: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" placeholder="Enter sub-topic" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Trainer Name *</label>
                  <input value={form.trainer} onChange={e => setForm({ ...form, trainer: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" placeholder="Trainer name" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Trainer Type</label>
                  <select value={form.trainerScope} onChange={e => setForm({ ...form, trainerScope: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all bg-white">
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Date *</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Start Time</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">End Time</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Mode</label>
                  <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as any })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all bg-white">
                    {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all bg-white">
                    <option value="Upcoming">Upcoming</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all" placeholder="Training venue" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-400 outline-none transition-all resize-none" placeholder="Brief description of training content..." />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-widest transition-all">Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingSession ? 'Update Session' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-4 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
