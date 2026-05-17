"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Lock, Eye, EyeOff, AlertCircle, CheckCheck, Loader2, ShieldAlert,
  ArrowRight, Link2, X, Search, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import ClosureFormModal, { type ClosureSavePayload } from '@/components/ClosureFormModal';
import {
  ObservationCard,
  MobileObservationCard,
  type ObservationItem,
} from '@/components/ObservationCards';

// ─── Image lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"><X size={20} /></button>
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-widest">{label}</div>
      <img src={url} alt={label} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ─── Searchable multi-select (mirrors registry's SearchableMultiSelect) ───────
function SearchableMultiSelect({
  label, values, onChange, options, placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);

  return (
    <div ref={ref} className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div
        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 cursor-pointer flex items-center justify-between gap-2 focus-within:border-indigo-400 transition-colors"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <span className={`text-xs font-bold truncate flex-1 ${values.length > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
          {values.length > 0 ? values.join(', ') : placeholder}
        </span>
        {values.length > 0 && (
          <span className="shrink-0 w-5 h-5 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">
            {values.length}
          </span>
        )}
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-[10] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-300"
                onClick={e => e.stopPropagation()}
              />
              {search && <button onClick={e => { e.stopPropagation(); setSearch(''); }} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>}
            </div>
          </div>
          {values.length > 0 && (
            <button onClick={e => { e.stopPropagation(); onChange([]); setSearch(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 uppercase tracking-wide border-b border-slate-50">
              Clear Selection
            </button>
          )}
          <div className="max-h-[180px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">No matches</div>
            ) : filtered.map(opt => (
              <button
                key={opt}
                onClick={e => { e.stopPropagation(); toggle(opt); }}
                className={`w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide flex items-center gap-2 transition-colors ${values.includes(opt) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${values.includes(opt) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                  {values.includes(opt) && <span className="block w-1.5 h-1.5 bg-white rounded-sm" />}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter state type ────────────────────────────────────────────────────────
type ShareFilters = {
  statuses: string[];
  departments: string[];
  locations: string[];
  responsibilities: string[];
  severities: string[];
};
const EMPTY_FILTERS: ShareFilters = { statuses: [], departments: [], locations: [], responsibilities: [], severities: [] };

// ─── Global filter modal (matches registry's AdvancedGlobalFilterModal) ───────
function ShareFilterModal({
  filters, onApply, onClose, observations,
}: {
  filters: ShareFilters;
  onApply: (f: ShareFilters) => void;
  onClose: () => void;
  observations: ObservationItem[];
}) {
  const [local, setLocal] = useState<ShareFilters>(filters);

  const distinct = (pick: (o: ObservationItem) => string | undefined | null) => {
    const set = new Set<string>();
    observations.forEach(o => { const v = (pick(o) || '').trim(); if (v) set.add(v); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };
  const deptOptions = useMemo(() => distinct(o => (o as any).departmentName || o.mainKitchen), [observations]);
  const locationOptions = useMemo(() => distinct(o => o.area), [observations]);
  const respOptions = useMemo(() => {
    const set = new Set<string>();
    observations.forEach(o => {
      if (o.mainKitchen) set.add(o.mainKitchen);
      (o.people || []).forEach(p => { if (p?.name) set.add(p.name); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [observations]);

  const toggleStatus = (s: string) => {
    const set = new Set(local.statuses);
    if (set.has(s)) set.delete(s); else set.add(s);
    setLocal(prev => ({ ...prev, statuses: Array.from(set) }));
  };

  const statusChips = [
    { key: 'OPEN',        label: 'Open',        bg: 'bg-rose-500',    text: 'text-white' },
    { key: 'IN_PROGRESS', label: 'In Progress',  bg: 'bg-blue-500',    text: 'text-white' },
    { key: 'RESOLVED',    label: 'Resolved',     bg: 'bg-emerald-500', text: 'text-white' },
  ];

  const activeCount = local.statuses.length + local.departments.length + local.locations.length + local.responsibilities.length + local.severities.length;

  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={backdropRef} className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}>
      <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 h-[88vh] sm:h-[85vh]">

        {/* Header */}
        <div className="px-5 sm:px-8 py-4 sm:py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <SlidersHorizontal size={22} />
            <div>
              <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">Global Registry Filter</h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                {activeCount} active · {observations.length} record{observations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={22} /></button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-8 space-y-6 bg-white overflow-y-auto flex-1 text-left">

          {/* Status chips */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusChips.map(c => {
                const active = local.statuses.includes(c.key);
                return (
                  <button key={c.key} type="button" onClick={() => toggleStatus(c.key)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${active ? `${c.bg} ${c.text} border-transparent shadow-md` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {c.label}
                  </button>
                );
              })}
              {local.statuses.length > 0 && (
                <button type="button" onClick={() => setLocal(prev => ({ ...prev, statuses: [] }))}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1">
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Multi-selects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative">
              <SearchableMultiSelect label="Department" values={local.departments} onChange={v => setLocal(prev => ({ ...prev, departments: v }))} options={deptOptions} placeholder="All departments…" />
            </div>
            <div className="relative">
              <SearchableMultiSelect label="Location" values={local.locations} onChange={v => setLocal(prev => ({ ...prev, locations: v }))} options={locationOptions} placeholder="All locations…" />
            </div>
            <div className="relative">
              <SearchableMultiSelect label="Responsibility" values={local.responsibilities} onChange={v => setLocal(prev => ({ ...prev, responsibilities: v }))} options={respOptions} placeholder="All responsibilities…" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Severity</label>
              <select
                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-black uppercase outline-none focus:border-indigo-500"
                value={local.severities[0] || ''}
                onChange={e => setLocal(prev => ({ ...prev, severities: e.target.value ? [e.target.value] : [] }))}
              >
                <option value="">Any severity</option>
                <option value="MINOR">Minor</option>
                <option value="MAJOR">Major</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-10 py-4 sm:py-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between sm:justify-end items-stretch sm:items-center gap-3 shrink-0">
          <button type="button" onClick={() => setLocal(EMPTY_FILTERS)}
            className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-slate-300 transition-all">
            Reset All
          </button>
          <button type="button" onClick={() => { onApply(local); onClose(); }}
            className="px-12 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ObsSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const [linkMeta, setLinkMeta] = useState<{ responsibility: string; label: string; requiresPassword: boolean; unitName: string } | null>(null);
  const [metaError, setMetaError] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');
  const [observations, setObservations] = useState<ObservationItem[] | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<ShareFilters>(EMPTY_FILTERS);
  const [showFilter, setShowFilter] = useState(false);

  // UI state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [closingObs, setClosingObs] = useState<ObservationItem | null>(null);
  const [closureError, setClosureError] = useState('');
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/obs-share?token=${token}`)
      .then(r => r.json())
      .then(async d => {
        if (d.error) { setMetaError(d.error); return; }
        const meta = { responsibility: d.responsibility, label: d.label, requiresPassword: d.requiresPassword !== false, unitName: d.unitName || '' };
        setLinkMeta(meta);
        if (!meta.requiresPassword) {
          try {
            const res = await fetch('/api/obs-share', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'verify', token, password: '' }),
            });
            const data = await res.json();
            if (res.ok) setObservations(data.observations || []);
            else setMetaError(data.error || 'Failed to load observations');
          } catch {
            setMetaError('Connection error. Please try again.');
          }
        }
      })
      .catch(() => setMetaError('Failed to load link'))
      .finally(() => setLoadingMeta(false));
  }, [token]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setVerifying(true);
    setAuthError('');
    try {
      const res = await fetch('/api/obs-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Incorrect password'); return; }
      setObservations(data.observations || []);
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCardClosed = (id: string, payload: ClosureSavePayload) => {
    const now = new Date();
    const timestamp = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDraft = !!payload.asDraft;
    setObservations(prev => prev ? prev.map(o => o.id === id ? {
      ...o,
      status: isDraft ? o.status : ('RESOLVED' as const),
      closureComments: payload.comments,
      ...(isDraft ? {} : { closureDate: now.toISOString() }),
      ...(payload.evidenceUrl ? { afterImage: payload.evidenceUrl } : {}),
      lastUpdate: timestamp,
      tracking: [
        ...(Array.isArray(o.tracking) ? o.tracking : []),
        { id: `t-share-${Date.now()}`, label: isDraft ? 'Closure draft saved via share link' : 'Closed via share link', user: payload.closedBy || 'Responsibility owner', timestamp, comments: payload.comments },
      ],
    } : o) : prev);
  };

  const submitClosure = async (obsId: string, payload: ClosureSavePayload) => {
    setClosureError('');
    try {
      const res = await fetch('/api/obs-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', token, password, observationId: obsId, comments: payload.comments, closedBy: payload.closedBy, evidenceUrl: payload.evidenceUrl, allEvidence: payload.allEvidence, asDraft: !!payload.asDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setClosureError(data?.error || 'Failed to save. Please try again.'); return; }
      handleCardClosed(obsId, payload);
      setClosingObs(null);
    } catch {
      setClosureError('Network error. Please try again.');
    }
  };

  const handleAction = (type: string, id: string) => {
    if (type === 'closure') {
      const obs = observations?.find(o => o.id === id);
      if (obs) { setClosureError(''); setClosingObs(obs); }
    }
  };

  // ── Derived filter data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!observations) return [];
    return observations.filter(obs => {
      const text = `${obs.observationText || obs.title || ''} ${obs.area || ''} ${obs.reportedBy || ''} ${obs.sop || ''} ${(obs.people || []).map(p => p.name).join(' ')} ${obs.mainKitchen || ''}`.toLowerCase();
      if (searchTerm && !text.includes(searchTerm.toLowerCase())) return false;
      if (appliedFilters.statuses.length > 0 && !appliedFilters.statuses.includes(obs.status)) return false;
      if (appliedFilters.severities.length > 0 && !appliedFilters.severities.includes(obs.severity)) return false;
      if (appliedFilters.departments.length > 0) {
        const dept = (obs as any).departmentName || obs.mainKitchen || '';
        if (!appliedFilters.departments.includes(dept)) return false;
      }
      if (appliedFilters.locations.length > 0 && !appliedFilters.locations.includes(obs.area || '')) return false;
      if (appliedFilters.responsibilities.length > 0) {
        const match = appliedFilters.responsibilities.some(r =>
          obs.mainKitchen === r || (Array.isArray(obs.people) && obs.people.some(p => p.name === r)));
        if (!match) return false;
      }
      return true;
    });
  }, [observations, searchTerm, appliedFilters]);

  const statusCounts = useMemo(() => observations
    ? { OPEN: observations.filter(o => o.status === 'OPEN').length, RESOLVED: observations.filter(o => o.status === 'RESOLVED').length, IN_PROGRESS: observations.filter(o => o.status === 'IN_PROGRESS').length }
    : null, [observations]);

  const activeFilterCount = appliedFilters.statuses.length + appliedFilters.departments.length + appliedFilters.locations.length + appliedFilters.responsibilities.length + appliedFilters.severities.length;
  const hasAnyFilter = !!(searchTerm || activeFilterCount > 0);

  // ── Loading / error / password screens ──────────────────────────────────
  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Link2 size={28} className="text-rose-500" />
          </div>
          <h1 className="text-xl font-black text-slate-800 mb-2">Invalid Link</h1>
          <p className="text-slate-500 text-sm">{metaError}</p>
        </div>
      </div>
    );
  }

  if (!observations) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-white/20">
              <ShieldAlert size={28} className="text-indigo-300" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">HACCP PRO</h1>
            <p className="text-indigo-300 text-sm mt-1 font-medium">Observation Registry — Shared View</p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <div className="mb-6">
              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Responsibility</span>
              <p className="text-lg font-black text-white mt-0.5">{linkMeta?.label || linkMeta?.responsibility}</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1.5">
                  <Lock size={10} className="inline mr-1" />Password to Access
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter access password..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-medium focus:outline-none focus:border-indigo-400 focus:bg-white/15 transition-all pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                    {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                {authError && (
                  <div className="flex items-center gap-2 mt-2 text-rose-300 text-xs font-bold animate-in fade-in">
                    <AlertCircle size={12} />{authError}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={verifying || !password.trim()}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-black text-sm rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
              >
                {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <><ArrowRight size={16} /> Access Observations</>}
              </button>
            </form>
          </div>

          <p className="text-center text-white/20 text-[10px] font-medium mt-6">
            Secured access · Review &amp; close observations · HACCP PRO
          </p>
        </div>
      </div>
    );
  }

  // ── Main observations view ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Sticky header */}
      <div className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <ShieldAlert size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">HACCP PRO · Shared View</p>
            <h1 className="text-sm font-black text-slate-800 truncate">
              {linkMeta?.label || linkMeta?.responsibility} — Observation Registry
              {linkMeta?.unitName ? <span className="ml-1 text-slate-400 font-bold">· {linkMeta.unitName}</span> : null}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[9px] font-black text-emerald-700 uppercase">
              <CheckCheck size={9} /> Review &amp; Close Access
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* Status summary cards — clicking toggles that status in filters */}
        {statusCounts && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Open',        count: statusCounts.OPEN,        bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-700',    filter: 'OPEN' },
              { label: 'Resolved',    count: statusCounts.RESOLVED,    bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', filter: 'RESOLVED' },
              { label: 'In Progress', count: statusCounts.IN_PROGRESS, bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    filter: 'IN_PROGRESS' },
            ].map(s => {
              const active = appliedFilters.statuses.includes(s.filter);
              return (
                <button
                  key={s.filter}
                  onClick={() => setAppliedFilters(prev => ({
                    ...prev,
                    statuses: active ? prev.statuses.filter(x => x !== s.filter) : [...prev.statuses, s.filter],
                  }))}
                  className={`rounded-2xl p-3 text-left transition-all border-2 ${active ? `${s.light} border-current ${s.text} shadow-md` : 'bg-white border-slate-100 hover:border-slate-200'}`}
                >
                  <p className={`text-[9px] font-black uppercase tracking-widest ${active ? '' : 'text-slate-400'}`}>{s.label}</p>
                  <p className={`text-2xl font-black mt-0.5 ${active ? '' : 'text-slate-800'}`}>{s.count}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Search bar + filter button row — matches registry toolbar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search title, location, reporter, SOP…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-400 shadow-sm"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter button — highlighted when filters are active */}
          <button
            onClick={() => setShowFilter(true)}
            className={`relative p-2.5 rounded-xl border transition-all shadow-sm active:scale-90 shrink-0 ${activeFilterCount > 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300'}`}
            title="Global Filter"
          >
            <SlidersHorizontal size={17} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white text-indigo-600 border border-indigo-200 rounded-full text-[9px] font-black flex items-center justify-center shadow">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear-all pill — visible when any filter is active */}
          {hasAnyFilter && (
            <button
              onClick={() => { setSearchTerm(''); setAppliedFilters(EMPTY_FILTERS); }}
              className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Active filter chips summary */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[
              ...appliedFilters.statuses.map(s => ({ key: `s-${s}`, label: s, color: 'bg-rose-50 text-rose-700 border-rose-200', remove: () => setAppliedFilters(prev => ({ ...prev, statuses: prev.statuses.filter(x => x !== s) })) })),
              ...appliedFilters.departments.map(d => ({ key: `d-${d}`, label: d, color: 'bg-violet-50 text-violet-700 border-violet-200', remove: () => setAppliedFilters(prev => ({ ...prev, departments: prev.departments.filter(x => x !== d) })) })),
              ...appliedFilters.locations.map(l => ({ key: `l-${l}`, label: l, color: 'bg-sky-50 text-sky-700 border-sky-200', remove: () => setAppliedFilters(prev => ({ ...prev, locations: prev.locations.filter(x => x !== l) })) })),
              ...appliedFilters.responsibilities.map(r => ({ key: `r-${r}`, label: r, color: 'bg-amber-50 text-amber-700 border-amber-200', remove: () => setAppliedFilters(prev => ({ ...prev, responsibilities: prev.responsibilities.filter(x => x !== r) })) })),
              ...appliedFilters.severities.map(sv => ({ key: `sv-${sv}`, label: sv, color: 'bg-orange-50 text-orange-700 border-orange-200', remove: () => setAppliedFilters(prev => ({ ...prev, severities: prev.severities.filter(x => x !== sv) })) })),
            ].map(chip => (
              <span key={chip.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${chip.color}`}>
                {chip.label}
                <button onClick={chip.remove} className="ml-0.5 hover:opacity-70"><X size={9} strokeWidth={3} /></button>
              </span>
            ))}
          </div>
        )}

        {/* Record count */}
        {observations && (
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filtered.length} / {observations.length} record{observations.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Observation cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-400 text-sm font-bold">No observations match your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(obs => (
              isMobile ? (
                <MobileObservationCard
                  key={obs.id}
                  obs={obs}
                  mode="public"
                  onAction={handleAction}
                  onSelect={() => {}}
                  isExpanded={expandedIds.has(obs.id)}
                  onToggleExpand={() => setExpandedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(obs.id)) next.delete(obs.id); else next.add(obs.id);
                    return next;
                  })}
                  onViewImage={(url, label) => setLightbox({ url, label })}
                />
              ) : (
                <ObservationCard
                  key={obs.id}
                  obs={obs}
                  mode="public"
                  onAction={handleAction}
                  onViewImage={(url, label) => setLightbox({ url, label })}
                />
              )
            ))}
          </div>
        )}
      </div>

      {/* Global filter modal */}
      {showFilter && observations && (
        <ShareFilterModal
          filters={appliedFilters}
          onApply={setAppliedFilters}
          onClose={() => setShowFilter(false)}
          observations={observations}
        />
      )}

      {/* Closure modal */}
      {closingObs && (
        <ClosureFormModal
          obs={closingObs}
          showCloserName
          externalError={closureError}
          onClose={() => { setClosingObs(null); setClosureError(''); }}
          onSave={(payload) => submitClosure(closingObs.id, payload)}
          onViewImage={(url, label) => setLightbox({ url, label })}
        />
      )}

      {/* Image lightbox */}
      {lightbox && (
        <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
