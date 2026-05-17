"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users, Plus, Trash2, Search, Download, Edit2, X, Check,
  BookOpen, GraduationCap, Shield,
  CheckCircle2, Clock, Link2, Copy, ExternalLink, Share2, MapPin,
  ChevronDown, ChevronUp, Award, Phone, Mail, Building2, Briefcase,
  Calendar, FileText, Loader2, Tag,
  Ticket, TrendingUp, Gift, ChevronRight, Hash,
  Megaphone, Send, AlertTriangle
} from 'lucide-react';
import TrainingCalendar from './TrainingCalendar';
import CertificateStudio from './CertificateStudio';
import AcademyAdmin from './AcademyAdmin';
import ParticipantsDatabase from './ParticipantsDatabase';
import PromoBlasts from './PromoBlasts';
import CertificateModal, { CertParticipant, CertTraining } from './CertificateModal';
import { HierarchyScope, Entity } from '../types';
import { COUNTRY_CODE_OPTIONS, COUNTRY_DIALING_CODES, DEFAULT_WA_COUNTRY_CODE } from '../lib/countryDialingCodes';

// ── Phone <-> (countryCode, digits) helpers ─────────────────────────────────
// Stored phone format we standardise on: "+<code><digits>" e.g. "+919876543210".
// On edit we have to round-trip arbitrary historical formats — "+91 98765 43210",
// "919876543210", "98765 43210", etc. — back into the (code, number) pair the
// form expects. We try the longest known dialing code first so e.g. "+9198..."
// isn't mis-split as code "9" (no such code, but defensive anyway).
const ALL_DIALING_CODES_DESC: string[] = Array
  .from(new Set(Object.values(COUNTRY_DIALING_CODES)))
  .sort((a, b) => b.length - a.length);

const splitPhone = (raw?: string | null): { code: string; number: string } => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return { code: DEFAULT_WA_COUNTRY_CODE, number: '' };
  for (const c of ALL_DIALING_CODES_DESC) {
    // Require at least 6 digits AFTER the code so we don't accidentally swallow
    // the leading digits of a bare 10-digit Indian number (e.g. "9123456789"
    // shouldn't be parsed as code "91" + "23456789").
    if (digits.startsWith(c) && digits.length - c.length >= 6 && digits.length > 10) {
      return { code: c, number: digits.slice(c.length) };
    }
  }
  return { code: DEFAULT_WA_COUNTRY_CODE, number: digits };
};

const joinPhone = (code: string, number: string): string => {
  const cleanCode = String(code || DEFAULT_WA_COUNTRY_CODE).replace(/\D/g, '') || DEFAULT_WA_COUNTRY_CODE;
  const cleanNum = String(number || '').replace(/\D/g, '');
  if (!cleanNum) return '';
  return `+${cleanCode}${cleanNum}`;
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface LmsUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  organization: string;
  department?: string;
  role: 'admin' | 'trainer' | 'learner';
  status: 'active' | 'inactive' | 'pending';
  joinedAt: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  lastActive?: string;
}

interface PortalLink {
  id: string;
  unitId: string;
  unitName: string;
  corporateName: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

interface LmsAdminProps {
  activeSubTab?: string;
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  entities?: Entity[];
  onSetSubTab?: (tab: string) => void;
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-violet-100 text-violet-700 border-violet-200',
  trainer: 'bg-blue-100 text-blue-700 border-blue-200',
  learner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
  pending:  'bg-amber-100 text-amber-700',
};

const EMPTY_FORM = {
  name: '', email: '', phone: '', countryCode: DEFAULT_WA_COUNTRY_CODE,
  organization: '', department: '',
  role: 'learner' as LmsUser['role'], status: 'active' as LmsUser['status'],
};

// ─── Portal Link Bar (identical to LearningManagement) ───────────────────────

const PortalLinkBar = ({
  currentScope, userRootId, entities,
}: {
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities: Entity[];
}) => {
  const [showModal, setShowModal] = useState(false);
  const [links, setLinks]         = useState<PortalLink[]>([]);
  const [loading, setLoading]     = useState(false);
  const [copiedId, setCopiedId]   = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [expiryDate, setExpiryDate]         = useState('');
  const [expiryTime, setExpiryTime]         = useState('23:59');
  const [creating, setCreating]             = useState(false);

  const scopedUnits = useMemo(() => {
    const getDescendantIds = (parentId: string): string[] => {
      const children = entities.filter(e => e.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    if (currentScope === 'unit' && userRootId) return entities.filter(e => e.id === userRootId && e.type === 'unit');
    if (currentScope === 'department' && userRootId) {
      const dept = entities.find(e => e.id === userRootId);
      if (dept?.parentId) return entities.filter(e => e.id === dept.parentId && e.type === 'unit');
      return [];
    }
    if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
      const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
      return entities.filter(e => e.type === 'unit' && descendantIds.has(e.id));
    }
    return entities.filter(e => e.type === 'unit');
  }, [entities, currentScope, userRootId]);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/training-portal?action=list');
      if (res.ok) {
        const data = await res.json();
        const unitIds = new Set(scopedUnits.map(u => u.id));
        setLinks((data.links || []).filter((l: PortalLink) => unitIds.has(l.unitId)));
      }
    } catch {}
    setLoading(false);
  }, [scopedUnits]);

  useEffect(() => { if (showModal) loadLinks(); }, [showModal, loadLinks]);

  const handleCreate = async () => {
    if (!selectedUnitId || !expiryDate) return;
    setCreating(true);
    try {
      const unit      = entities.find(e => e.id === selectedUnitId);
      const corporate = entities.find(e => e.type === 'corporate');
      const expiresAt = new Date(`${expiryDate}T${expiryTime}:00`).toISOString();
      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-link', unitId: selectedUnitId, unitName: unit?.name || 'Unit', corporateName: corporate?.name || '', expiresAt }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(prev => [data.link, ...prev]);
        setSelectedUnitId(''); setExpiryDate(''); setExpiryTime('23:59');
      }
    } catch {}
    setCreating(false);
  };

  const handleRevoke = async (token: string) => {
    if (!confirm('Revoke this link? It will stop working immediately.')) return;
    try {
      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-link', token }),
      });
      if (res.ok) setLinks(prev => prev.filter(l => l.id !== token));
    } catch {}
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/training-portal/${token}`);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired   = (expiresAt: string) => new Date(expiresAt) < new Date();
  const activeLinks = links.filter(l => !isExpired(l.expiresAt));

  return (
    <>
      <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-end gap-2 shrink-0">
        {activeLinks.length > 0 && (
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mr-2">
            {activeLinks.length} active link{activeLinks.length > 1 ? 's' : ''}
          </span>
        )}
        <button onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-1.5">
          <Share2 size={12} /> Portal Links
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl"><Link2 size={20} /></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Training Portal Links</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shareable unit-specific links with expiry</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 shrink-0">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Generate New Link</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}
                  className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none bg-white">
                  <option value="">Select Unit</option>
                  {scopedUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none w-40" />
                <input type="time" value={expiryTime} onChange={e => setExpiryTime(e.target.value)}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none w-32" />
                <button onClick={handleCreate} disabled={!selectedUnitId || !expiryDate || creating}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap">
                  <Plus size={14} /> Generate
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400 font-bold">Loading...</div>
              ) : links.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Link2 size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No portal links created yet</p>
                  <p className="text-[10px] text-slate-400 mt-1">Generate a link above to share with external trainers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map(link => {
                    const expired = isExpired(link.expiresAt);
                    const expDate = new Date(link.expiresAt);
                    return (
                      <div key={link.id} className={`rounded-2xl border-2 p-4 transition-all ${expired ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-indigo-100 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs font-black text-slate-800">
                                <MapPin size={12} className="text-indigo-500" /> {link.unitName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                {expired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                              <Clock size={10} />
                              <span>Expires: {expDate.toLocaleDateString()} {expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1 bg-slate-100 rounded-lg px-3 py-1.5">
                              <code className="text-[10px] font-bold text-slate-600 truncate flex-1">/training-portal/{link.id}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!expired && (
                              <>
                                <button onClick={() => copyLink(link.id)}
                                  className={`p-2 rounded-lg transition-all ${copiedId === link.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}`}>
                                  {copiedId === link.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                </button>
                                <button onClick={() => window.open(`/training-portal/${link.id}`, '_blank')}
                                  className="p-2 bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-all">
                                  <ExternalLink size={16} />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleRevoke(link.id)}
                              className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── New Coupon Cell ──────────────────────────────────────────────────────────

function NewCouponCell({ reg, sessionFee, onApplied }: { reg: any; sessionFee: number; onApplied: (regId: string, code: string, discount: number) => void }) {
  const [code, setCode]         = useState('');
  const [result, setResult]     = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [applied, setApplied]   = useState(false);

  const validate = async () => {
    if (!code.trim() || sessionFee <= 0) return;
    setLoading(true); setResult(null);
    try {
      const res = await fetch('/api/academy/affiliate-coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase(), course_price: sessionFee }),
      });
      const data = await res.json();
      setResult(data);
    } catch { setResult({ valid: false, error: 'Network error' }); }
    setLoading(false);
  };

  const apply = async () => {
    if (!result?.valid) return;
    setLoading(true);
    try {
      await fetch('/api/training-register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reg.id,
          couponCode: code.trim().toUpperCase(),
          couponDiscount: result.discount_amount || 0,
          couponOwnerId: result.owner_id || '',
        }),
      });
      setApplied(true);
      onApplied(reg.id, code.trim().toUpperCase(), result.discount_amount || 0);
    } catch {}
    setLoading(false);
  };

  if (applied || reg.couponCode) return <span className="text-[10px] text-slate-300 font-semibold italic">Applied</span>;

  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setResult(null); }}
          placeholder="CODE"
          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-bold uppercase outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-300 transition-all"
        />
        <button
          onClick={result?.valid ? apply : validate}
          disabled={!code.trim() || loading}
          className={`shrink-0 px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all disabled:opacity-40 flex items-center gap-1 whitespace-nowrap ${result?.valid ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : result?.valid ? <Check size={10} /> : null}
          {result?.valid ? 'Apply' : 'Check'}
        </button>
      </div>
      {result && !result.valid && (
        <span className="text-[9px] text-rose-500 font-bold">{result.error || 'Invalid code'}</span>
      )}
      {result?.valid && (
        <span className="text-[9px] text-emerald-600 font-bold">−₹{(result.discount_amount || 0).toLocaleString('en-IN')} off</span>
      )}
    </div>
  );
}

// ─── Coupon Tracker Panel ─────────────────────────────────────────────────────

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_session_token') || '';
}

const LmsCouponTrackerPanel: React.FC<{ email: string; onClose: () => void }> = ({ email, onClose }) => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCoupon, setExpandedCoupon] = useState<string | null>(null);
  const [usages, setUsages] = useState<Record<string, any[]>>({});
  const [usageLoading, setUsageLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/academy/affiliate-coupons/track?email=${encodeURIComponent(email)}`, {
      headers: { 'x-admin-token': getAdminToken() },
    })
      .then(r => r.json())
      .then(d => setCoupons(d.coupons || []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, [email]);

  const loadUsages = async (code: string) => {
    if (usages[code]) { setExpandedCoupon(expandedCoupon === code ? null : code); return; }
    setUsageLoading(code);
    setExpandedCoupon(code);
    try {
      const r = await fetch(`/api/academy/affiliate-coupons/track?coupon_code=${encodeURIComponent(code)}`, {
        headers: { 'x-admin-token': getAdminToken() },
      });
      const d = await r.json();
      setUsages(prev => ({ ...prev, [code]: d.usages || [] }));
    } catch { setUsages(prev => ({ ...prev, [code]: [] })); }
    setUsageLoading(null);
  };

  const fmt = (d: string | null) => d
    ? new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="mt-3 border-2 border-violet-200 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-50/80 to-indigo-50/60">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-violet-100/70 border-b border-violet-200">
        <div className="flex items-center gap-2">
          <Ticket size={13} className="text-violet-600" />
          <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">Coupon Tracker</span>
          {!loading && <span className="px-1.5 py-0.5 bg-violet-200 text-violet-800 rounded-full text-[8px] font-black">{coupons.length}</span>}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-violet-200 rounded-lg transition-colors">
          <X size={13} className="text-violet-500" />
        </button>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
      ) : coupons.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 font-bold">No coupons generated for this user yet.</div>
      ) : (
        <div className="p-3 space-y-2">
          {coupons.map((c: any) => (
            <div key={c.id}>
              {/* Coupon sub-card */}
              <button
                onClick={() => loadUsages(c.code)}
                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${expandedCoupon === c.code ? 'bg-white border-violet-300 shadow-md' : 'bg-white/70 border-transparent hover:border-violet-200 hover:bg-white'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-black tracking-widest">{c.code}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase ${c.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                  <ChevronDown size={11} className={`ml-auto text-violet-400 transition-transform ${expandedCoupon === c.code ? 'rotate-180' : ''}`} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                  <div>
                    <span className="font-black text-slate-400 uppercase tracking-widest">Training: </span>
                    <span className="font-bold text-slate-600 truncate">{c.sessionTitle}</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-400 uppercase tracking-widest">Generated: </span>
                    <span className="font-bold text-slate-600">{fmt(c.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gift size={9} className="text-violet-400 shrink-0" />
                    <span className="font-black text-violet-600">₹{c.discountAmount.toLocaleString('en-IN')} off others</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={9} className="text-emerald-500 shrink-0" />
                    <span className="font-black text-emerald-600">₹{c.commissionAmount.toLocaleString('en-IN')} / use</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-400 uppercase tracking-widest">Used: </span>
                    <span className="font-bold text-slate-700">{c.currentUses}/{c.maxUses}</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-400 uppercase tracking-widest">Total earned: </span>
                    <span className="font-black text-emerald-600">₹{c.totalCommissionEarned.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </button>

              {/* Expanded usage details */}
              {expandedCoupon === c.code && (
                <div className="ml-3 mt-1 border-l-2 border-violet-200 pl-3 space-y-1.5">
                  {usageLoading === c.code ? (
                    <div className="py-3 flex justify-center"><Loader2 size={13} className="animate-spin text-violet-300" /></div>
                  ) : (usages[c.code] || []).length === 0 ? (
                    <p className="py-3 text-[10px] text-slate-400 font-bold text-center">Nobody has used this coupon yet.</p>
                  ) : (usages[c.code] || []).map((u: any, i: number) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 hover:border-violet-200 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[8px] font-black shrink-0">
                          {(u.enrolleeName || '?').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-slate-800 truncate">{u.enrolleeName}</p>
                          <p className="text-[9px] text-slate-400 truncate">{u.enrolleeEmail}</p>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 shrink-0">+₹{u.commissionEarned.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[8px]">
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Reg Date</p><p className="font-bold text-slate-600">{fmt(u.registrationDate)}</p></div>
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Training Date</p><p className="font-bold text-slate-600">{fmt(u.trainingDate)}</p></div>
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Training</p><p className="font-bold text-slate-600 truncate">{u.trainingName}</p></div>
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Fees</p><p className="font-bold text-slate-600">₹{u.courseFee.toLocaleString('en-IN')}</p></div>
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Discount</p><p className="font-bold text-violet-600">₹{u.couponDiscount.toLocaleString('en-IN')}</p></div>
                        <div><p className="font-black text-slate-400 uppercase tracking-widest">Paid</p><p className="font-bold text-slate-700">₹{(u.courseFee - u.couponDiscount).toLocaleString('en-IN')}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LmsAdmin({
  activeSubTab = '',
  currentScope = 'super-admin' as HierarchyScope,
  userRootId,
  entities = [],
  onSetSubTab,
}: LmsAdminProps) {

  // ── LMS User list state ────────────────────────────────────────────────────
  const [users, setUsers]             = useState<LmsUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [internalTab, setInternalTab] = useState<'users' | 'overview' | 'certificates'>('users');
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal]     = useState(false);
  const [editingUser, setEditingUser] = useState<LmsUser | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [page, setPage]               = useState(1);

  // ── Enrollment expansion & certificate state ───────────────────────────────
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [couponTrackerUserId, setCouponTrackerUserId] = useState<string | null>(null);
  const [perPage, setPerPage] = useState(15);
  const [allRegistrations, setAllRegistrations] = useState<any[]>([]);
  const [allSessions, setAllSessions]         = useState<any[]>([]);
  const [regsLoading, setRegsLoading]         = useState(false);
  const [certTarget, setCertTarget]           = useState<{ participant: CertParticipant; training: CertTraining } | null>(null);

  // ── Multi-training WhatsApp digest state ──────────────────────────────────
  const [showPromoModal, setShowPromoModal]       = useState(false);
  const [promoSelected, setPromoSelected]         = useState<Set<string>>(new Set());
  const [promoAudience, setPromoAudience]         = useState<'lms' | 'lms+imported'>('lms+imported');
  // 'template' uses an approved Meta UTILITY template — reaches cold leads.
  // 'text' uses free-form text (24-hour customer-care window only).
  const [promoMode, setPromoMode]                 = useState<'template' | 'text'>('template');
  // Per-recipient template selection — server picks based on whether
  // we have a real name on file. Both templates carry an image header
  // (single URL set by the admin for the whole blast).
  const [promoNamedTemplateName, setPromoNamedTemplateName]     = useState('food_safety_training');
  const [promoUnnamedTemplateName, setPromoUnnamedTemplateName] = useState('calender_food_safety');
  const [promoHeaderImageUrl, setPromoHeaderImageUrl]           = useState('');
  // Upload UX state for the optional "Upload image" affordance next to
  // the Header Image URL field. Successful uploads auto-fill the URL;
  // admin can still paste/edit/clear the field manually.
  const [promoHeaderUploading, setPromoHeaderUploading] = useState(false);
  const [promoHeaderUploadError, setPromoHeaderUploadError] = useState('');
  const [promoHeaderImageBytes, setPromoHeaderImageBytes] = useState<number | null>(null);
  const [promoHeaderImageDims, setPromoHeaderImageDims] = useState<{ w: number; h: number } | null>(null);
  // 'idle' = no image yet; 'loading' = HEAD/metadata in flight;
  // 'resolved' = we have a definite answer (size known or known-unknown).
  const [promoHeaderMetaState, setPromoHeaderMetaState] = useState<'idle' | 'loading' | 'resolved'>('idle');
  // Tracks which URL the latest in-flight metadata lookup belongs to.
  // Used to discard stale async responses when the URL changes.
  const promoHeaderMetaUrlRef = useRef<string>('');
  const promoHeaderFileInputRef = useRef<HTMLInputElement | null>(null);
  const [promoRegistrationUrl, setPromoRegistrationUrl] = useState('');
  const [promoSupportPhone, setPromoSupportPhone] = useState('');
  const [promoSupportEmail, setPromoSupportEmail] = useState('');
  // Template body var {{1}} (multi-line trainings list)
  const [promoTrainingsList, setPromoTrainingsList] = useState('');
  const [promoListDirty, setPromoListDirty]         = useState(false);
  // Free-form text mode body
  const [promoMessage, setPromoMessage]             = useState('');
  const [promoMessageDirty, setPromoMessageDirty]   = useState(false);
  const [promoSending, setPromoSending]             = useState(false);
  const [promoCount, setPromoCount]                 = useState<{ total: number; lms: number; imported: number } | null>(null);
  // Per-recipient picker (search + select-all + per-row checkboxes).
  // `promoRecipients` is the full audience returned by the dryRun preview;
  // `promoExcluded` is the set of phones the admin has UNTICKED so they
  // won't be sent. Default = empty set (= send to everyone).
  const [promoRecipients, setPromoRecipients]       = useState<Array<{ phone: string; name: string; source: 'lms' | 'imported' }>>([]);
  const [promoExcluded, setPromoExcluded]           = useState<Set<string>>(new Set());
  const [promoRecipientSearch, setPromoRecipientSearch] = useState('');
  const [promoResult, setPromoResult]               = useState<any>(null);
  // Personalisation: when true, the template body has 4 vars and {{1}}
  // is the recipient's name. Empty / missing names fall back to
  // `promoNameFallback` server-side so Meta never sees an empty
  // variable (would otherwise hard-fail with error 132001).
  const [promoIncludeName, setPromoIncludeName]     = useState(false);
  const [promoNameFallback, setPromoNameFallback]   = useState('there');

  // ── Referral-usage digest WhatsApp blast (2-codes-only recipients) ────────
  const [showReferralDigestModal, setShowReferralDigestModal] = useState(false);
  const [referralDigestPreview, setReferralDigestPreview]     = useState<any>(null);
  const [referralDigestLoading, setReferralDigestLoading]     = useState(false);
  const [referralDigestSending, setReferralDigestSending]     = useState(false);
  const [referralDigestResult, setReferralDigestResult]       = useState<any>(null);
  const [referralDigestTrainings, setReferralDigestTrainings] = useState('');
  const [referralDigestTrainingsDirty, setReferralDigestTrainingsDirty] = useState(false);

  // ── Backfill personal coupons for previously verified registrations ───────
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult]   = useState<any>(null);
  const [showBackfillModal, setShowBackfillModal] = useState(false);

  const runBackfillCoupons = useCallback(async (dryRun: boolean) => {
    setBackfillRunning(true);
    setBackfillResult(null);
    try {
      const res = await fetch('/api/training-register/backfill-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ dryRun }),
      });
      const j = await res.json();
      setBackfillResult({ ...j, dryRun });
    } catch (err: any) {
      setBackfillResult({ ok: false, error: err?.message || 'Network error', dryRun });
    } finally {
      setBackfillRunning(false);
    }
  }, []);

  const openBackfillModal = useCallback(() => {
    setBackfillResult(null);
    setShowBackfillModal(true);
    runBackfillCoupons(true);
  }, [runBackfillCoupons]);

  // ── Purge wrongly-issued coupons (legacy fallback rows) ───────────────────
  // Two-step flow: first call returns a dry-run preview (count + sample), the
  // user confirms, second call actually deletes. Only coupons with zero usages
  // are removed; anything already redeemed is protected automatically.
  const [purgeRunning, setPurgeRunning] = useState(false);

  const runPurgeWrongCoupons = useCallback(async () => {
    if (purgeRunning) return;
    setPurgeRunning(true);
    try {
      // Dry-run to count + show sample.
      const dryRes = await fetch('/api/training-register/purge-wrong-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ dryRun: true }),
      });
      const dry = await dryRes.json();
      if (!dry?.ok) {
        alert(`Could not preview: ${dry?.error || 'Unknown error'}`);
        return;
      }
      const candidates = Number(dry.candidates) || 0;
      const protectedCount = Number(dry.protectedFromDelete) || 0;
      if (candidates === 0) {
        alert(`Nothing to purge.\n\nNo wrongly-issued coupons remain on sessions that have empty Coupon Discount / Commission Earned fields.${protectedCount ? `\n\n(${protectedCount} coupons skipped because they have already been redeemed.)` : ''}`);
        return;
      }
      const sampleLines = (dry.sample || []).slice(0, 5).map((s: any) =>
        `  • ${s.code}  —  ${s.ownerName || s.ownerEmail}  (${s.sessionTitle || '—'})`
      ).join('\n');
      const ok = window.confirm(
        `Purge ${candidates} wrongly-issued coupon${candidates === 1 ? '' : 's'}?\n\n` +
        `These were created by the old fallback (sessions with no Coupon Discount / Commission Earned set).\n` +
        (protectedCount ? `\n${protectedCount} coupon${protectedCount === 1 ? ' is' : 's are'} protected (already redeemed) and will NOT be touched.\n` : '') +
        `\nFirst few:\n${sampleLines}\n\nThis is permanent.`
      );
      if (!ok) return;

      const res = await fetch('/api/training-register/purge-wrong-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ dryRun: false }),
      });
      const j = await res.json();
      if (!j?.ok) {
        alert(`Purge failed: ${j?.error || 'Unknown error'}`);
        return;
      }
      alert(
        `Done.\n\n` +
        `Deleted coupons: ${j.deletedCoupons}\n` +
        `Cleaned registrations: ${j.cleanedRegistrations}\n` +
        `Protected (already redeemed): ${j.protectedFromDelete}` +
        (Array.isArray(j.errors) && j.errors.length > 0 ? `\n\n${j.errors.length} non-fatal error(s) — check server logs.` : '')
      );
      // Force a full reload so every panel (User List + Training Calendar
      // tracker) re-fetches and the deleted coupons disappear immediately.
      try { window.location.reload(); } catch {}
    } catch (err: any) {
      alert(`Purge failed: ${err?.message || 'Network error'}`);
    } finally {
      setPurgeRunning(false);
    }
  }, [purgeRunning]);

  // ── Calendar: employees / trainers ────────────────────────────────────────
  const [employees, setEmployees] = useState<any[]>([]);

  const scopedUnitNames = useMemo(() => {
    const getDescendantIds = (parentId: string): string[] => {
      const children = entities.filter(e => e.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
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
    return new Set(scopedEntities.filter(e => e.name?.trim()).map(e => e.name!.trim().toLowerCase()));
  }, [entities, currentScope, userRootId]);

  useEffect(() => {
    const isCalendar = activeSubTab === 'ladmin-calendar';
    if (!isCalendar) return;
    const load = async () => {
      try {
        const [usersRes, trainersRes] = await Promise.all([fetch('/api/users'), fetch('/api/trainers')]);
        const usersData   = usersRes.ok   ? await usersRes.json()   : { items: [] };
        const trainersData = trainersRes.ok ? await trainersRes.json() : { items: [] };
        const dbEmployees = (usersData.items || []) as any[];
        const dbTrainers  = (trainersData.items || []) as any[];
        const trainerMap  = new Map<string, any>();
        for (const t of dbTrainers) trainerMap.set(t.employeeId || t.id, t);
        const isScoped = scopedUnitNames.size > 0 &&
          ['unit', 'department', 'regional', 'corporate'].includes(currentScope);
        const filtered = dbEmployees.filter((emp: any) => {
          if (emp.Status !== 'Active') return false;
          if (isScoped) {
            const empUnit = (emp.Unit || '').trim().toLowerCase();
            return scopedUnitNames.has(empUnit);
          }
          return true;
        });
        const merged = filtered.map((emp: any) => {
          const trainerRecord = trainerMap.get(emp.id);
          if (trainerRecord) return { ...emp, isTrainer: true, ...trainerRecord };
          return emp;
        });
        setEmployees(merged);
      } catch (err) {
        console.error('LMS: failed to load employees for calendar', err);
      }
    };
    load();
  }, [activeSubTab, scopedUnitNames, currentScope]);

  const trainers = useMemo(() => employees.filter(e => e.isTrainer), [employees]);

  // ── LMS users fetch ────────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/lms');
      if (res.ok) { const data = await res.json(); setUsers(data.items || []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  useEffect(() => {
    const fetchRegsAndSessions = async () => {
      setRegsLoading(true);
      try {
        const [regRes, calRes] = await Promise.all([
          fetch('/api/training-register'),
          fetch('/api/training-calendar'),
        ]);
        const regData = regRes.ok ? await regRes.json() : { items: [] };
        const calData = calRes.ok ? await calRes.json() : { items: [] };
        setAllRegistrations(regData.items || []);
        setAllSessions(calData.items || []);
      } catch {}
      setRegsLoading(false);
    };
    fetchRegsAndSessions();
  }, []);

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const persistUsers = useCallback((updated: LmsUser[]) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await fetch('/api/lms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch {}
    }, 2000);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.organization.trim()) {
      alert('Name, Email and Organization are required.'); return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    // Combine the country-code dropdown with the phone digits before persisting,
    // so downstream consumers (WhatsApp promo, single-send, CSV export) all see
    // a fully-qualified "+<code><digits>" string regardless of what the admin
    // typed. countryCode itself is a UI-only field and isn't stored on the row.
    const { countryCode, ...formRest } = form as any;
    const persistedPhone = joinPhone(countryCode, formRest.phone);
    const formToSave = { ...formRest, phone: persistedPhone };
    let updated: LmsUser[];
    if (editingUser) {
      updated = users.map(u => u.id === editingUser.id ? { ...editingUser, ...formToSave } : u);
    } else {
      const newUser: LmsUser = { id: `lms-${Date.now()}`, ...formToSave, joinedAt: now, coursesEnrolled: 0, coursesCompleted: 0, lastActive: now };
      updated = [newUser, ...users];
    }
    setUsers(updated);
    persistUsers(updated);
    setShowModal(false); setEditingUser(null); setForm({ ...EMPTY_FORM }); setSaving(false);
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} user(s)? This cannot be undone.`)) return;
    try {
      await fetch('/api/lms', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
    } catch {}
    const updated = users.filter(u => !ids.includes(u.id));
    setUsers(updated); setSelectedIds(new Set());
  };

  const openEdit = (u: LmsUser) => {
    setEditingUser(u);
    const { code, number } = splitPhone(u.phone);
    setForm({ name: u.name, email: u.email, phone: number, countryCode: code, organization: u.organization, department: u.department || '', role: u.role, status: u.status });
    setShowModal(true);
  };

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.organization.toLowerCase().includes(q);
    return matchQ && (filterRole === 'all' || u.role === filterRole) && (filterStatus === 'all' || u.status === filterStatus);
  }), [users, search, filterRole, filterStatus]);

  const paginated  = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  const stats = useMemo(() => ({
    total:     users.length,
    active:    users.filter(u => u.status === 'active').length,
    trainers:  users.filter(u => u.role === 'trainer').length,
    learners:  users.filter(u => u.role === 'learner').length,
    enrolled:  users.reduce((s, u) => s + (u.coursesEnrolled || 0), 0),
    completed: users.reduce((s, u) => s + (u.coursesCompleted || 0), 0),
  }), [users]);

  const downloadCSV = () => {
    const headers = ['ID','Name','Email','Phone','Organization','Department','Role','Status','Joined','Enrolled','Completed'];
    const rows    = users.map(u => [u.id, u.name, u.email, u.phone||'', u.organization, u.department||'', u.role, u.status, u.joinedAt?.split('T')[0]||'', u.coursesEnrolled, u.coursesCompleted]);
    const csv     = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'lms_users.csv'; a.click();
  };

  const toggleSelect = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll    = () => setSelectedIds(prev => prev.size === paginated.length ? new Set() : new Set(paginated.map(u => u.id)));

  // ── Multi-training WhatsApp promo helpers ─────────────────────────────────
  // Active = `isActive !== false` AND date is today or in the future.
  const activeTrainings = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (allSessions || [])
      .filter((s: any) => s && s.isActive !== false && s.date)
      .filter((s: any) => {
        const d = new Date(s.date);
        return !isNaN(d.getTime()) && d >= today;
      })
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
  }, [allSessions]);

  // Builders for the 3 template body parameters {{1}}, {{2}}, {{3}}, plus
  // a free-form text variant for preview / 24-hour-window mode. Pure
  // functions of their inputs so we can recompute on every change unless
  // the admin has hand-edited the textarea.
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  // Card-style WhatsApp block per training. Mirrors the in-app
  // "Active Trainings" list (green check, title, date+time, trainer)
  // using WhatsApp-supported formatting (*bold* + emoji + line breaks).
  // Blank line between entries gives each training a clear "card" feel.
  const buildTrainingsList = useCallback((sel: Set<string>): string => {
    const blocks: string[] = [];
    for (const t of activeTrainings) {
      if (!sel.has(t.id)) continue;
      const time = [t.startTime, t.endTime].filter(Boolean).join(' – ');
      const lines: string[] = [];
      lines.push(`✅ *${t.topic || 'Training'}*`);
      const meta: string[] = [];
      if (t.date) meta.push(`📅 ${fmtDate(t.date)}`);
      if (time) meta.push(`🕒 ${time}`);
      if (meta.length) lines.push(`   ${meta.join('   ')}`);
      if (t.trainer) lines.push(`   👤 ${t.trainer}`);
      blocks.push(lines.join('\n'));
    }
    return blocks.join('\n\n').trim();
  }, [activeTrainings]);

  const contactLine = useMemo(() => {
    const bits = [
      promoSupportPhone.trim() && `📞 ${promoSupportPhone.trim()}`,
      promoSupportEmail.trim() && `✉️ ${promoSupportEmail.trim()}`,
    ].filter(Boolean);
    return bits.join('  ') || 'Reply to this message.';
  }, [promoSupportPhone, promoSupportEmail]);

  const buildPromoMessage = useCallback((sel: Set<string>): string => {
    const lines: string[] = ['Hello! 👋', '', 'Upcoming training sessions:', ''];
    const list = buildTrainingsList(sel);
    if (list) { lines.push(list); lines.push(''); }
    if (promoRegistrationUrl.trim()) { lines.push(`Register here: ${promoRegistrationUrl.trim()}`); lines.push(''); }
    lines.push('Need help?');
    lines.push(contactLine);
    return lines.join('\n').trim();
  }, [buildTrainingsList, promoRegistrationUrl, contactLine]);

  // Auto-rebuild whenever inputs change, unless the admin has typed.
  useEffect(() => {
    if (!showPromoModal) return;
    if (!promoListDirty) setPromoTrainingsList(buildTrainingsList(promoSelected));
    if (!promoMessageDirty) setPromoMessage(buildPromoMessage(promoSelected));
  }, [showPromoModal, promoSelected, buildTrainingsList, buildPromoMessage, promoListDirty, promoMessageDirty]);

  const openPromoModal = () => {
    const allIds = new Set(activeTrainings.map((t: any) => t.id));
    setPromoSelected(allIds);
    if (!promoRegistrationUrl) {
      setPromoRegistrationUrl(typeof window !== 'undefined' ? `${window.location.origin}/academy` : '');
    }
    setPromoListDirty(false);
    setPromoMessageDirty(false);
    setPromoCount(null);
    setPromoResult(null);
    setShowPromoModal(true);
  };

  const openReferralDigestModal = async () => {
    setReferralDigestPreview(null);
    setReferralDigestResult(null);
    setReferralDigestTrainings('');
    setReferralDigestTrainingsDirty(false);
    setShowReferralDigestModal(true);
    setReferralDigestLoading(true);
    try {
      const res = await fetch('/api/whatsapp/referral-usage-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ dryRun: true }),
      });
      const j = await res.json();
      setReferralDigestPreview(j);
      if (j?.trainingDetails) setReferralDigestTrainings(j.trainingDetails);
    } catch (err: any) {
      setReferralDigestPreview({ ok: false, error: err?.message || 'preview failed' });
    } finally {
      setReferralDigestLoading(false);
    }
  };

  const sendReferralDigest = async () => {
    if (!referralDigestPreview?.total) {
      alert('No eligible recipients.');
      return;
    }
    if (!confirm(`Send referral-usage WhatsApp digest to ${referralDigestPreview.total} recipient(s)?`)) return;
    setReferralDigestSending(true);
    setReferralDigestResult(null);
    try {
      const res = await fetch('/api/whatsapp/referral-usage-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({
          trainingDetails: referralDigestTrainingsDirty ? referralDigestTrainings : undefined,
        }),
      });
      const j = await res.json();
      setReferralDigestResult(j);
    } catch (err: any) {
      setReferralDigestResult({ ok: false, error: err?.message || 'send failed' });
    } finally {
      setReferralDigestSending(false);
    }
  };

  const togglePromoTraining = (id: string) => {
    setPromoSelected(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const fetchPromoAudienceCount = useCallback(async (audience: 'lms' | 'lms+imported') => {
    try {
      const res = await fetch('/api/whatsapp/multi-training-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: Array.from(promoSelected),
          audience,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setPromoCount({ total: j.total, lms: j.breakdown?.lms || 0, imported: j.breakdown?.imported || 0 });
        const list = Array.isArray(j.recipients) ? j.recipients : [];
        setPromoRecipients(list);
        // Drop excluded phones that are no longer in the audience (e.g.
        // admin switched audience source). Keeps the picker consistent.
        setPromoExcluded(prev => {
          const phones = new Set(list.map((r: any) => r.phone));
          const next = new Set<string>();
          prev.forEach(p => { if (phones.has(p)) next.add(p); });
          return next;
        });
      }
    } catch {}
  }, [promoSelected]);

  useEffect(() => {
    if (!showPromoModal) return;
    if (promoSelected.size === 0) { setPromoCount(null); return; }
    fetchPromoAudienceCount(promoAudience);
  }, [showPromoModal, promoAudience, promoSelected, fetchPromoAudienceCount]);

  const sendPromoBlast = async () => {
    if (promoSelected.size === 0) { alert('Pick at least one training.'); return; }
    if (promoMode === 'template') {
      if (!promoNamedTemplateName.trim() || !promoUnnamedTemplateName.trim()) {
        alert('Both template names (named & unnamed) are required.'); return;
      }
      if (!promoTrainingsList.trim()) { alert('Trainings list is empty.'); return; }
      if (!promoRegistrationUrl.trim()) { alert('Registration URL is required.'); return; }
      if (!promoHeaderImageUrl.trim()) { alert('Header image URL is required.'); return; }
    } else if (promoMessage.trim().length < 20) {
      alert('Message body looks too short.'); return;
    }
    const willSend = Math.max(0, (promoCount?.total ?? 0) - promoExcluded.size);
    const warning = promoMode === 'template'
      ? `Send to ${willSend} contacts using two image-header templates?\n\n• Recipients with a name on file → "${promoNamedTemplateName}" (3 body vars)\n• Recipients without a name → "${promoUnnamedTemplateName}" (2 body vars)\n\nBoth templates must be APPROVED in WhatsApp Manager with an image header. Otherwise every send will fail.${promoExcluded.size > 0 ? `\n\n${promoExcluded.size} recipient${promoExcluded.size === 1 ? '' : 's'} unticked and will be skipped.` : ''}`
      : `Send this free-form WhatsApp text to ${willSend} contacts?\n\nText messages only deliver to people inside the 24-hour WhatsApp customer-care window. Cold contacts will fail.${promoExcluded.size > 0 ? `\n\n${promoExcluded.size} recipient${promoExcluded.size === 1 ? '' : 's'} unticked and will be skipped.` : ''}`;
    if (!confirm(warning)) return;
    setPromoSending(true);
    setPromoResult(null);
    try {
      const res = await fetch('/api/whatsapp/multi-training-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: Array.from(promoSelected),
          audience: promoAudience,
          excludePhones: Array.from(promoExcluded),
          mode: promoMode,
          // template-mode payload — server branches per recipient.
          namedTemplateName: promoNamedTemplateName.trim(),
          unnamedTemplateName: promoUnnamedTemplateName.trim(),
          headerImageUrl: promoHeaderImageUrl.trim(),
          trainingsList: promoTrainingsList,
          registrationUrl: promoRegistrationUrl.trim(),
          // text-mode payload
          message: promoMessage,
        }),
      });
      const j = await res.json();
      setPromoResult(j);
    } catch (err: any) {
      setPromoResult({ ok: false, error: err?.message || 'Send failed' });
    } finally {
      setPromoSending(false);
    }
  };

  // ── Render: Academy sub-tabs ───────────────────────────────────────────────
  const academySubTabs = ['academy-dashboard', 'academy-courses', 'academy-categories', 'academy-curriculum', 'academy-quizzes', 'academy-students', 'academy-badges', 'academy-affiliates', 'academy-content', 'academy-news-keywords', 'academy-news-media', 'academy-tip-leads', 'academy-jobs', 'academy-whatsapp-inbox'];
  if (academySubTabs.includes(activeSubTab)) {
    return <AcademyAdmin activeSubTab={activeSubTab} onSetSubTab={onSetSubTab} />;
  }

  // ── Render: Participants Database (marketing roll-up) ─────────────────────
  if (activeSubTab === 'ladmin-participants') {
    return <ParticipantsDatabase />;
  }

  // ── Render: Promo Blasts history (multi-training WhatsApp blasts) ─────────
  if (activeSubTab === 'ladmin-promo-blasts') {
    return <PromoBlasts />;
  }

  // ── Render: Training Calendar ──────────────────────────────────────────────
  if (activeSubTab === 'ladmin-calendar') {
    return (
      <div className="flex flex-col h-full">
        <PortalLinkBar currentScope={currentScope} userRootId={userRootId} entities={entities} />
        <div className="flex-1 min-h-0">
          <TrainingCalendar
            currentScope={currentScope}
            userRootId={userRootId}
            entities={entities}
            trainers={trainers}
            allEmployees={employees}
          />
        </div>
      </div>
    );
  }

  // ── Render: User List / Overview ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">LMS Admin Panel</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Learning Management System · Super Admin</p>
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {([
              { key: 'overview', label: 'Overview' },
              { key: 'users',    label: 'User List' },
              { key: 'certificates', label: 'Certificates' },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setInternalTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${internalTab === t.key ? 'bg-white text-violet-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview */}
      {internalTab === 'overview' && (
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Total Users',  value: stats.total,     icon: Users,         color: 'text-slate-700',   bg: 'bg-slate-100'  },
              { label: 'Active',       value: stats.active,    icon: CheckCircle2,  color: 'text-green-700',   bg: 'bg-green-100'  },
              { label: 'Trainers',     value: stats.trainers,  icon: Shield,        color: 'text-blue-700',    bg: 'bg-blue-100'   },
              { label: 'Learners',     value: stats.learners,  icon: BookOpen,      color: 'text-emerald-700', bg: 'bg-emerald-100'},
              { label: 'Enrolled',     value: stats.enrolled,  icon: Clock,         color: 'text-amber-700',   bg: 'bg-amber-100'  },
              { label: 'Completed',    value: stats.completed, icon: GraduationCap, color: 'text-violet-700',  bg: 'bg-violet-100' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-2 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                  <s.icon size={18} className={s.color} />
                </div>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">Role Distribution</h2>
            {[
              { label: 'Admins',   count: users.filter(u => u.role === 'admin').length, color: 'bg-violet-500' },
              { label: 'Trainers', count: stats.trainers, color: 'bg-blue-500'   },
              { label: 'Learners', count: stats.learners, color: 'bg-emerald-500' },
            ].map(r => (
              <div key={r.label} className="mb-3">
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>{r.label}</span><span>{r.count}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full transition-all`}
                    style={{ width: stats.total > 0 ? `${(r.count / stats.total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User List */}
      {internalTab === 'users' && (
        <div className="p-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, email, org…"
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none" />
              </div>
              <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-400/30">
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="trainer">Trainer</option>
                <option value="learner">Learner</option>
              </select>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-400/30">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
              <div className="flex gap-2 ml-auto">
                {selectedIds.size > 0 && (
                  <button onClick={() => handleDelete([...selectedIds])}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-600 transition-colors">
                    <Trash2 size={13} /> Delete ({selectedIds.size})
                  </button>
                )}
                <button onClick={openPromoModal}
                  title="Send a single WhatsApp digest of all upcoming trainings to your LMS users (and optionally imported leads)"
                  className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors">
                  <Megaphone size={13} /> Promote Trainings
                </button>
                <button onClick={openReferralDigestModal}
                  title="WhatsApp digest to users with EXACTLY 2 valid referral codes (active, non-expired, with remaining usage)"
                  className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-amber-100 transition-colors">
                  <Megaphone size={13} /> Referral Digest
                </button>
                <button onClick={openBackfillModal}
                  title="Generate Refer & Earn coupons for previously paid + verified registrations that don't yet have one"
                  className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-rose-100 transition-colors">
                  <Gift size={13} /> Generate Past Coupons
                </button>
                <button onClick={runPurgeWrongCoupons} disabled={purgeRunning}
                  title="Delete Refer & Earn coupons that were auto-issued for sessions where Coupon Discount / Commission Earned were never set. Coupons that have already been redeemed are protected."
                  className="px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Trash2 size={13} /> {purgeRunning ? 'Purging…' : 'Purge Wrong Coupons'}
                </button>
                <button onClick={downloadCSV}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-colors">
                  <Download size={13} /> Export
                </button>
                <button onClick={() => { setEditingUser(null); setForm({ ...EMPTY_FORM }); setShowModal(true); }}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-black flex items-center gap-1.5 hover:bg-violet-700 transition-colors shadow-sm">
                  <Plus size={13} /> Add User
                </button>
              </div>
            </div>

            {/* Cards */}
            {loading ? (
              <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-violet-400" />
                <span>Loading users…</span>
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-20 text-center">
                <Users size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400">
                  {users.length === 0 ? 'No LMS users yet. Add your first user.' : 'No users match your filters.'}
                </p>
                {users.length === 0 && (
                  <button onClick={() => { setEditingUser(null); setForm({ ...EMPTY_FORM }); setShowModal(true); }}
                    className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg text-xs font-black hover:bg-violet-700 transition-colors">
                    + Add First User
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {paginated.map((u, idx) => {
                  const isExpanded = expandedUserId === u.id;
                  const userRegs = allRegistrations.filter(r =>
                    (r.email || r.data?.email || '').toLowerCase() === u.email.toLowerCase()
                  );
                  const initials = u.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

                  return (
                    <div key={u.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">

                      {/* User Card */}
                      <div className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Avatar + serial */}
                          <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-black text-slate-300">#{(page - 1) * perPage + idx + 1}</span>
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-md">
                              {initials}
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <h3 className="text-sm font-black text-slate-900">{u.name}</h3>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border capitalize ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[u.status]}`}>{u.status}</span>
                                </div>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                <button onClick={() => openEdit(u)} className="p-2 rounded-xl hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors" title="Edit">
                                  <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete([u.id])} className="p-2 rounded-xl hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Contact & org info */}
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Mail size={11} className="text-violet-400 shrink-0" />
                                <span className="truncate">{u.email}</span>
                              </div>
                              {u.phone && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Phone size={11} className="text-violet-400 shrink-0" />
                                  <span>{u.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Building2 size={11} className="text-violet-400 shrink-0" />
                                <span className="truncate font-semibold text-slate-700">{u.organization}</span>
                              </div>
                              {u.department && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Briefcase size={11} className="text-violet-400 shrink-0" />
                                  <span className="truncate">{u.department}</span>
                                </div>
                              )}
                            </div>

                            {/* Stats row */}
                            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={11} className="text-slate-400" />
                                <span className="text-slate-400 font-semibold">Joined:</span>
                                <span className="text-slate-600 font-bold">{u.joinedAt?.split('T')[0] || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <BookOpen size={11} className="text-indigo-400" />
                                <span className="text-slate-400 font-semibold">Enrolled:</span>
                                <span className="text-indigo-700 font-black">{u.coursesEnrolled || 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                <span className="text-slate-400 font-semibold">Completed:</span>
                                <span className={`font-black ${(u.coursesCompleted || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{u.coursesCompleted || 0}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <FileText size={11} className="text-amber-400" />
                                <span className="text-slate-400 font-semibold">Trainings:</span>
                                <span className="text-amber-700 font-black">{userRegs.length}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expand / Collapse + Coupon Tracker buttons */}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-violet-200 bg-violet-50 text-violet-600 text-[11px] font-black uppercase tracking-widest hover:bg-violet-100 transition-all"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            {isExpanded ? 'Hide Enrollments' : `View Course Enrollments (${userRegs.length})`}
                          </button>
                          <button
                            onClick={() => setCouponTrackerUserId(couponTrackerUserId === u.id ? null : u.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all shrink-0 ${
                              couponTrackerUserId === u.id
                                ? 'bg-violet-600 text-white border-violet-600'
                                : 'border-dashed border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100'
                            }`}
                          >
                            <Ticket size={13} />
                            Coupons
                          </button>
                        </div>
                        {/* Coupon Tracker Panel */}
                        {couponTrackerUserId === u.id && u.email && (
                          <LmsCouponTrackerPanel
                            email={u.email}
                            onClose={() => setCouponTrackerUserId(null)}
                          />
                        )}
                      </div>

                      {/* Enrollment Table */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/60">
                          {regsLoading ? (
                            <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                              <Loader2 size={16} className="animate-spin" /> Loading enrollments…
                            </div>
                          ) : userRegs.length === 0 ? (
                            <div className="py-8 text-center">
                              <BookOpen size={28} className="text-slate-200 mx-auto mb-2" />
                              <p className="text-xs font-bold text-slate-400">No training enrollments found for this user.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-white">
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider w-10">Sl No</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Topic Details</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Training Date</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Time</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Fees</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Discount</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Paid Amount</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Coupon Applied</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">New Coupon</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Certificate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {userRegs.map((reg: any, ri: number) => {
                                    const session = allSessions.find((s: any) => s.id === (reg.sessionId || reg.session_id));
                                    const topic   = reg.sessionTitle || session?.topic || '—';
                                    const subTopic = session?.subTopic || '';
                                    const dateRaw = reg.sessionDate || session?.date || '';
                                    const dateLabel = dateRaw
                                      ? new Date(dateRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                      : '—';
                                    const timeFrom = session?.startTime || '';
                                    const timeTo   = session?.endTime   || '';
                                    const timeLabel = timeFrom ? `${timeFrom}${timeTo ? ` – ${timeTo}` : ''}` : '—';
                                    const courseStatus = reg.attendanceStatus || 'Registered';
                                    const statusColor =
                                      courseStatus === 'Present'  ? 'bg-emerald-100 text-emerald-700' :
                                      courseStatus === 'Absent'   ? 'bg-rose-100 text-rose-600' :
                                      courseStatus === 'Completed' ? 'bg-blue-100 text-blue-700' :
                                      'bg-amber-100 text-amber-700';

                                    return (
                                      <tr key={reg.id} className={`border-b border-slate-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                        <td className="px-4 py-3 text-[10px] text-slate-400 font-bold text-center">{ri + 1}</td>
                                        <td className="px-4 py-3">
                                          <div className="font-bold text-slate-800 text-[11px]">{topic}</div>
                                          {subTopic && <div className="text-[10px] text-slate-400 mt-0.5">{subTopic}</div>}
                                          {session?.mode && (
                                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-600">{session.mode}</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-semibold text-slate-700 whitespace-nowrap">{dateLabel}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-600 whitespace-nowrap">{timeLabel}</td>
                                        {/* Fees */}
                                        <td className="px-4 py-3">
                                          {(() => {
                                            const sessionFee = session?.courseFee || 0;
                                            if (sessionFee > 0) return <span className="text-[11px] font-bold text-slate-700">₹{sessionFee.toLocaleString('en-IN')}</span>;
                                            return <span className="text-[10px] font-black text-emerald-600">Free</span>;
                                          })()}
                                        </td>
                                        {/* Discount */}
                                        <td className="px-4 py-3">
                                          {(() => {
                                            const sessionDiscount = session?.discount || 0;
                                            const couponDiscount  = Number(reg.couponDiscount) || 0;
                                            const total = sessionDiscount + couponDiscount;
                                            if (total > 0) {
                                              return (
                                                <div>
                                                  <span className="text-[11px] font-black text-rose-600">−₹{total.toLocaleString('en-IN')}</span>
                                                  {sessionDiscount > 0 && couponDiscount > 0 && (
                                                    <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                                      Session −₹{sessionDiscount.toLocaleString('en-IN')} · Coupon −₹{couponDiscount.toLocaleString('en-IN')}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }
                                            return <span className="text-[10px] text-slate-300 font-semibold">—</span>;
                                          })()}
                                        </td>
                                        {/* Paid Amount */}
                                        <td className="px-4 py-3">
                                          {(() => {
                                            const sessionFee     = session?.courseFee || 0;
                                            const couponDiscount = Number(reg.couponDiscount) || 0;
                                            const sessionDiscount = session?.discount || 0;
                                            if (sessionFee > 0) {
                                              const paid = Math.max(0, sessionFee - sessionDiscount - couponDiscount);
                                              return <span className="text-[11px] font-black text-emerald-700">₹{paid.toLocaleString('en-IN')}</span>;
                                            }
                                            return <span className="text-[10px] text-emerald-600 font-black">Free</span>;
                                          })()}
                                        </td>
                                        {/* Coupon Applied */}
                                        <td className="px-4 py-3">
                                          {reg.couponCode ? (
                                            <div>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                <Tag size={9} /> {reg.couponCode}
                                              </span>
                                              {reg.couponDiscount > 0 && (
                                                <div className="text-[9px] text-violet-500 font-semibold mt-0.5">−₹{Number(reg.couponDiscount).toLocaleString('en-IN')}</div>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-slate-300 font-semibold">—</span>
                                          )}
                                        </td>
                                        {/* New Coupon */}
                                        <td className="px-4 py-3">
                                          <NewCouponCell
                                            reg={reg}
                                            sessionFee={session?.courseFee || 0}
                                            onApplied={(regId, code, discount) => {
                                              setAllRegistrations(prev => prev.map(r =>
                                                r.id === regId
                                                  ? { ...r, couponCode: code, couponDiscount: discount }
                                                  : r
                                              ));
                                            }}
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusColor}`}>{courseStatus}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {session ? (
                                            <button
                                              onClick={() => {
                                                const participant: CertParticipant = {
                                                  name: u.name,
                                                  email: u.email,
                                                  phone: u.phone,
                                                  organization: u.organization,
                                                  profession: reg.profession || '',
                                                  designation: reg.designation || u.department || '',
                                                };
                                                const training: CertTraining = {
                                                  topic: session.topic || topic,
                                                  subTopic: session.subTopic || '',
                                                  trainer: session.trainer || '',
                                                  date: session.date || dateRaw,
                                                  startTime: session.startTime || '',
                                                  endTime: session.endTime || '',
                                                  location: session.location || '',
                                                  mode: session.mode || '',
                                                };
                                                setCertTarget({ participant, training });
                                              }}
                                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap"
                                            >
                                              <Award size={11} /> Certificate
                                            </button>
                                          ) : (
                                            <span className="text-[10px] text-slate-300 font-semibold">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap text-xs text-slate-500">
              {/* Left: count + per-page */}
              <div className="flex items-center gap-2">
                <span className="font-semibold">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-300">·</span>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  Show
                  <select
                    value={perPage}
                    onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                    className="border border-slate-200 rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                  >
                    {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  per page
                </label>
              </div>

              {/* Right: page buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  {/* Prev */}
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 transition-colors font-bold"
                  >‹</button>

                  {/* Page numbers — show at most 7 slots */}
                  {(() => {
                    const slots: (number | '…')[] = [];
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) slots.push(i);
                    } else {
                      slots.push(1);
                      if (page > 3) slots.push('…');
                      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) slots.push(i);
                      if (page < totalPages - 2) slots.push('…');
                      slots.push(totalPages);
                    }
                    return slots.map((s, i) =>
                      s === '…' ? (
                        <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-slate-300 font-bold">…</span>
                      ) : (
                        <button key={s} onClick={() => setPage(s as number)}
                          className={`w-7 h-7 rounded text-xs font-bold transition-colors ${s === page ? 'bg-violet-600 text-white' : 'hover:bg-slate-100 text-slate-500'}`}>
                          {s}
                        </button>
                      )
                    );
                  })()}

                  {/* Next */}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 rounded flex items-center justify-center disabled:opacity-30 hover:bg-slate-100 transition-colors font-bold"
                  >›</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {certTarget && (
        <CertificateModal
          participant={certTarget.participant}
          training={certTarget.training}
          onClose={() => setCertTarget(null)}
        />
      )}

      {/* Multi-training WhatsApp digest modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><Megaphone size={16} /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-800">Promote Trainings on WhatsApp</h2>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">One digest message — all upcoming sessions, common registration link, your contact details.</p>
                </div>
              </div>
              <button onClick={() => setShowPromoModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-6">
              {/* Left: trainings + audience + contact */}
              <div className="flex flex-col gap-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Trainings</label>
                    <div className="flex gap-2">
                      <button onClick={() => setPromoSelected(new Set(activeTrainings.map((t: any) => t.id)))}
                        className="text-[10px] font-bold text-emerald-700 hover:underline">Select all</button>
                      <button onClick={() => setPromoSelected(new Set())}
                        className="text-[10px] font-bold text-slate-500 hover:underline">Clear</button>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {activeTrainings.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        No active upcoming trainings found in the calendar.
                      </div>
                    ) : activeTrainings.map((t: any) => {
                      const checked = promoSelected.has(t.id);
                      const time = [t.startTime, t.endTime].filter(Boolean).join(' – ');
                      return (
                        <label key={t.id} className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-emerald-50/50 transition-colors ${checked ? 'bg-emerald-50' : ''}`}>
                          <input type="checkbox" checked={checked} onChange={() => togglePromoTraining(t.id)}
                            className="mt-0.5 accent-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{t.topic || 'Untitled'}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>📅 {t.date}</span>
                              {time && <span>⏰ {time}</span>}
                              {t.trainer && <span>👤 {t.trainer}</span>}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Audience</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: 'lms',           label: 'LMS users only' },
                      { v: 'lms+imported',  label: 'LMS + Imported leads' },
                    ] as const).map(opt => (
                      <button key={opt.v} onClick={() => setPromoAudience(opt.v)}
                        className={`px-3 py-2 rounded-lg text-[11px] font-bold border transition-all ${promoAudience === opt.v
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {promoCount && (
                    <p className="text-[10px] text-slate-500 mt-2">
                      Reaches <span className="font-bold text-emerald-700">{promoCount.total}</span> unique contacts
                      {' '}<span className="text-slate-400">({promoCount.lms} LMS{promoAudience === 'lms+imported' ? `, ${promoCount.imported} imported` : ''})</span>
                    </p>
                  )}
                </div>

                {/* Per-recipient picker — search, select all/none, untick anyone you don't want to message. */}
                {promoRecipients.length > 0 && (() => {
                  const q = promoRecipientSearch.trim().toLowerCase();
                  const filtered = q
                    ? promoRecipients.filter(r =>
                        r.phone.toLowerCase().includes(q) ||
                        (r.name || '').toLowerCase().includes(q) ||
                        r.source.toLowerCase().includes(q))
                    : promoRecipients;
                  const filteredPhones = filtered.map(r => r.phone);
                  const visibleSelected = filteredPhones.filter(p => !promoExcluded.has(p)).length;
                  const allVisibleSelected = filtered.length > 0 && visibleSelected === filtered.length;
                  const noneVisibleSelected = visibleSelected === 0;
                  const includedTotal = promoRecipients.length - promoExcluded.size;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Recipients <span className="text-emerald-700">({includedTotal} of {promoRecipients.length} will receive)</span>
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => {
                              setPromoExcluded(prev => {
                                const next = new Set(prev);
                                filteredPhones.forEach(p => next.delete(p));
                                return next;
                              });
                            }}
                            disabled={allVisibleSelected}
                            className="text-[10px] font-bold text-emerald-700 hover:underline disabled:text-slate-300 disabled:no-underline">
                            Select all{q ? ' (filtered)' : ''}
                          </button>
                          <button onClick={() => {
                              setPromoExcluded(prev => {
                                const next = new Set(prev);
                                filteredPhones.forEach(p => next.add(p));
                                return next;
                              });
                            }}
                            disabled={noneVisibleSelected}
                            className="text-[10px] font-bold text-slate-500 hover:underline disabled:text-slate-300 disabled:no-underline">
                            Clear{q ? ' (filtered)' : ''}
                          </button>
                        </div>
                      </div>
                      <input
                        value={promoRecipientSearch}
                        onChange={e => setPromoRecipientSearch(e.target.value)}
                        placeholder="Search by name, phone, or source…"
                        className="w-full px-3 py-2 mb-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                      <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                        {filtered.length === 0 ? (
                          <div className="p-4 text-center text-[11px] text-slate-400">No recipients match your search.</div>
                        ) : filtered.map(r => {
                          const included = !promoExcluded.has(r.phone);
                          return (
                            <label key={r.phone} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-emerald-50/50 transition-colors ${included ? '' : 'opacity-50'}`}>
                              <input type="checkbox" checked={included}
                                onChange={() => {
                                  setPromoExcluded(prev => {
                                    const next = new Set(prev);
                                    if (next.has(r.phone)) next.delete(r.phone);
                                    else next.add(r.phone);
                                    return next;
                                  });
                                }}
                                className="accent-emerald-600" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">{r.name || <span className="italic text-slate-400">No name</span>}</div>
                                <div className="text-[10px] text-slate-500 font-mono">+{r.phone}</div>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${r.source === 'lms' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {r.source}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {promoExcluded.size > 0 && (
                        <p className="text-[10px] text-amber-700 mt-1.5 font-semibold">
                          {promoExcluded.size} recipient{promoExcluded.size === 1 ? '' : 's'} unticked — they will be skipped on send.
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Common Registration URL</label>
                  <input value={promoRegistrationUrl}
                    onChange={e => { setPromoRegistrationUrl(e.target.value); setPromoMessageDirty(false); }}
                    placeholder="https://yourdomain.com/academy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Support Phone</label>
                    <input value={promoSupportPhone}
                      onChange={e => { setPromoSupportPhone(e.target.value); setPromoMessageDirty(false); }}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Support Email</label>
                    <input value={promoSupportEmail}
                      onChange={e => { setPromoSupportEmail(e.target.value); setPromoMessageDirty(false); }}
                      placeholder="hello@yourdomain.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                  </div>
                </div>
              </div>

              {/* Right: send mode + body */}
              <div className="flex flex-col">
                {/* Mode switch */}
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Send Mode</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([
                    { v: 'template', label: 'Meta Template', sub: 'Reaches cold leads' },
                    { v: 'text',     label: 'Free-form Text', sub: '24-hour window only' },
                  ] as const).map(opt => (
                    <button key={opt.v} onClick={() => setPromoMode(opt.v)}
                      className={`px-3 py-2 rounded-lg text-left border transition-all ${promoMode === opt.v
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                      <div className="text-[11px] font-bold">{opt.label}</div>
                      <div className={`text-[9px] mt-0.5 ${promoMode === opt.v ? 'text-emerald-50' : 'text-slate-400'}`}>{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {promoMode === 'template' ? (
                  <>
                    <div className="mb-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 text-[10px] text-emerald-800 leading-relaxed">
                      <div className="font-bold mb-0.5">Server picks the template per recipient:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Recipient with a name on file → <span className="font-mono font-bold">named</span> template (3 body vars, {'{{1}}'}=name)</li>
                        <li>Recipient without a name → <span className="font-mono font-bold">unnamed</span> template (2 body vars)</li>
                      </ul>
                      <div className="mt-1">Both templates use the same image header for this blast.</div>
                    </div>

                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Header Image URL <span className="text-rose-600 font-bold">*</span></label>
                    <div className="flex items-stretch gap-2">
                      <input value={promoHeaderImageUrl}
                        onChange={e => {
                          const v = e.target.value;
                          setPromoHeaderImageUrl(v);
                          setPromoHeaderImageBytes(null);
                          setPromoHeaderImageDims(null);
                          setPromoHeaderUploadError('');
                          setPromoHeaderMetaState(v.trim() ? 'loading' : 'idle');
                          // Invalidate any in-flight metadata lookup for the previous URL.
                          promoHeaderMetaUrlRef.current = '';
                        }}
                        placeholder="https://… (publicly reachable JPG/PNG) — or upload"
                        className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                      <input ref={promoHeaderFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          // Reset the input so the SAME filename can be re-picked later.
                          if (e.target) e.target.value = '';
                          if (!file) return;
                          setPromoHeaderUploadError('');
                          const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
                          if (!allowed.has((file.type || '').toLowerCase())) {
                            setPromoHeaderUploadError('Only JPG, PNG or WebP images are allowed.');
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            setPromoHeaderUploadError('Image is too large (max 5 MB).');
                            return;
                          }
                          try {
                            setPromoHeaderUploading(true);
                            const fd = new FormData();
                            fd.append('file', file);
                            const r = await fetch('/api/whatsapp/promo-header-images', {
                              method: 'POST',
                              headers: { 'x-admin-token': getAdminToken() },
                              body: fd,
                            });
                            const data = await r.json().catch(() => ({}));
                            if (!r.ok || !data?.url) {
                              throw new Error(data?.error || `Upload failed (HTTP ${r.status})`);
                            }
                            setPromoHeaderImageUrl(data.url);
                            setPromoHeaderImageBytes(file.size);
                            setPromoHeaderImageDims(null);
                            setPromoHeaderMetaState('resolved');
                            promoHeaderMetaUrlRef.current = data.url;
                          } catch (err: any) {
                            setPromoHeaderUploadError(err?.message || 'Upload failed.');
                          } finally {
                            setPromoHeaderUploading(false);
                          }
                        }} />
                      <button type="button"
                        disabled={promoHeaderUploading}
                        onClick={() => promoHeaderFileInputRef.current?.click()}
                        className="shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed">
                        {promoHeaderUploading ? 'Uploading…' : 'Upload image'}
                      </button>
                    </div>
                    {promoHeaderUploadError && (
                      <div className="mt-1 text-[10px] font-bold text-rose-600">{promoHeaderUploadError}</div>
                    )}
                    {promoHeaderImageUrl.trim() && (
                      <div className="mt-2 mb-3">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Preview</div>
                        <img
                          src={promoHeaderImageUrl}
                          alt="Header preview"
                          className="max-h-32 rounded-lg border border-slate-200 object-contain bg-slate-50"
                          onError={e => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = 'none';
                            const sib = img.nextElementSibling as HTMLElement | null;
                            if (sib) sib.style.display = 'flex';
                            setPromoHeaderMetaState('resolved');
                          }}
                          onLoad={e => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = '';
                            const sib = img.nextElementSibling as HTMLElement | null;
                            if (sib) sib.style.display = 'none';
                            const w = img.naturalWidth || 0;
                            const h = img.naturalHeight || 0;
                            if (w && h) setPromoHeaderImageDims({ w, h });
                            // For URLs where we don't already know the byte
                            // size (i.e. pasted external URLs), ask the
                            // server to look it up. The server avoids the
                            // CORS limits that block client-side HEAD on
                            // most third-party hosts and always returns a
                            // definite answer (number or null) so the UI
                            // can leave its "Loading…" state.
                            if (promoHeaderImageBytes == null) {
                              const url = promoHeaderImageUrl;
                              promoHeaderMetaUrlRef.current = url;
                              fetch(`/api/whatsapp/promo-header-images/metadata?url=${encodeURIComponent(url)}`,
                                { headers: { 'x-admin-token': getAdminToken() } })
                                .then(r => r.ok ? r.json() : { byteSize: null })
                                .catch(() => ({ byteSize: null }))
                                .then((data: any) => {
                                  // Discard if the URL changed while in flight.
                                  if (promoHeaderMetaUrlRef.current !== url) return;
                                  const n = typeof data?.byteSize === 'number' && Number.isFinite(data.byteSize) && data.byteSize > 0
                                    ? data.byteSize
                                    : null;
                                  if (n != null) setPromoHeaderImageBytes(n);
                                  setPromoHeaderMetaState('resolved');
                                });
                            } else {
                              setPromoHeaderMetaState('resolved');
                            }
                          }}
                        />
                        <div
                          style={{ display: 'none' }}
                          className="max-h-32 px-3 py-4 rounded-lg border border-dashed border-rose-200 bg-rose-50 text-[10px] text-rose-700 items-center"
                        >
                          Image could not be loaded from this URL.
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-600">
                          {promoHeaderImageDims && (
                            <span className="font-mono">{promoHeaderImageDims.w} × {promoHeaderImageDims.h}px</span>
                          )}
                          {promoHeaderImageBytes != null && (
                            <span className="font-mono">
                              {promoHeaderImageBytes >= 1024 * 1024
                                ? `${(promoHeaderImageBytes / (1024 * 1024)).toFixed(2)} MB`
                                : `${Math.max(1, Math.round(promoHeaderImageBytes / 1024))} KB`}
                            </span>
                          )}
                          {promoHeaderMetaState === 'resolved' && promoHeaderImageBytes == null && (
                            <span className="italic text-slate-400">Size unknown</span>
                          )}
                          {promoHeaderMetaState === 'loading' && !promoHeaderImageDims && (
                            <span className="italic text-slate-400">Loading file info…</span>
                          )}
                        </div>
                        {(() => {
                          const warnings: string[] = [];
                          if (promoHeaderImageDims) {
                            const { w, h } = promoHeaderImageDims;
                            if (w < 600 || h < 600) {
                              warnings.push(`Image is small (${w}×${h}px). WhatsApp recommends at least 800px on the long edge; below ~600px the header may look blurry or be rejected.`);
                            }
                            if (w > 0 && h > 0) {
                              const ratio = w / h;
                              if (ratio < 1.4 || ratio > 2.4) {
                                warnings.push(`Aspect ratio is ${ratio.toFixed(2)}:1. WhatsApp template image headers render best near 1.91:1 — this image will likely be cropped.`);
                              }
                            }
                          }
                          if (promoHeaderImageBytes != null && promoHeaderImageBytes > 5 * 1024 * 1024) {
                            warnings.push(`File is ${(promoHeaderImageBytes / (1024 * 1024)).toFixed(2)} MB. Meta caps template header images at 5 MB and will reject this at send time.`);
                          }
                          if (warnings.length === 0) return null;
                          return (
                            <div className="mt-1.5 space-y-1">
                              {warnings.map((msg, i) => (
                                <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                                  <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-600" />
                                  <span className="leading-snug">{msg}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="mt-1.5 flex items-center gap-2">
                          <button type="button"
                            disabled={promoHeaderUploading}
                            onClick={() => promoHeaderFileInputRef.current?.click()}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed">
                            {promoHeaderUploading ? 'Uploading…' : 'Replace'}
                          </button>
                          <button type="button"
                            onClick={() => {
                              setPromoHeaderImageUrl('');
                              setPromoHeaderImageBytes(null);
                              setPromoHeaderImageDims(null);
                              setPromoHeaderUploadError('');
                              setPromoHeaderMetaState('idle');
                              promoHeaderMetaUrlRef.current = '';
                            }}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                    {!promoHeaderImageUrl.trim() && <div className="mb-3" />}

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Named template</label>
                        <input value={promoNamedTemplateName}
                          onChange={e => setPromoNamedTemplateName(e.target.value)}
                          placeholder="food_safety_training"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                        <div className="text-[9px] text-slate-500 mt-0.5">Used when name is on file. Body: [name, registration, training details].</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Unnamed template</label>
                        <input value={promoUnnamedTemplateName}
                          onChange={e => setPromoUnnamedTemplateName(e.target.value)}
                          placeholder="calender_food_safety"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none" />
                        <div className="text-[9px] text-slate-500 mt-0.5">Used when no name. Body: [training details, registration].</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Training session details <span className="text-slate-400 font-normal normal-case">(named {'{{3}}'} · unnamed {'{{1}}'})</span></label>
                      {promoListDirty && (
                        <button onClick={() => { setPromoListDirty(false); setPromoTrainingsList(buildTrainingsList(promoSelected)); }}
                          className="text-[10px] font-bold text-emerald-700 hover:underline">Reset</button>
                      )}
                    </div>
                    <textarea value={promoTrainingsList}
                      onChange={e => { setPromoTrainingsList(e.target.value); setPromoListDirty(true); }}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono leading-relaxed whitespace-pre-wrap focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none resize-none mb-2" />

                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Registration details <span className="text-slate-400 font-normal normal-case">(named {'{{2}}'} · unnamed {'{{2}}'})</span></label>
                    <div className="px-3 py-2 mb-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 break-all">
                      {promoRegistrationUrl || <span className="italic text-slate-400">— set on the left —</span>}
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[10px] text-blue-800 leading-relaxed">
                      <div className="font-bold mb-1">Approved template bodies (image header + UTILITY, English):</div>
                      <div className="text-[9px] font-bold text-blue-900 uppercase tracking-wider mt-1 mb-0.5">Named — <span className="font-mono normal-case tracking-normal">{promoNamedTemplateName || 'food_safety_training'}</span></div>
                      <pre className="bg-white border border-blue-100 rounded-md p-2 text-[10px] font-mono whitespace-pre-wrap">{`*Dear {{1}},*

📘 Training Session Update

*📌 Training session details:*👇

{{3}}

✅ Registration details: {{2}}

📞 Phone: +91 8239 00 8202
📧 Email: safefoodmitra@gmail.com

Thank you!
SafeFood Mitra`}</pre>
                      <div className="text-[9px] font-bold text-blue-900 uppercase tracking-wider mt-2 mb-0.5">Unnamed — <span className="font-mono normal-case tracking-normal">{promoUnnamedTemplateName || 'calender_food_safety'}</span></div>
                      <pre className="bg-white border border-blue-100 rounded-md p-2 text-[10px] font-mono whitespace-pre-wrap">{`*📘 Training Session Update*

*📌 Training session details👇*:

{{1}}

*✅ Registration details:* {{2}}

📞 Phone: +91 8239 00 8202
📧 Email: safefoodmitra@gmail.com`}</pre>
                      <div className="mt-2">Once both are approved, sends will reach <b>every contact</b> — no 24-hour window restriction.</div>
                    </div>

                    {/* ── Live WhatsApp preview ────────────────────────────
                         Renders the two template bodies with the admin's
                         current trainings list + registration URL substituted
                         in, so they can see exactly how the message will look
                         on a real WhatsApp chat before pressing Send. */}
                    {(() => {
                      const sampleName = (promoRecipients.find(r => r.name && r.name.trim())?.name || promoNameFallback || 'there').trim();
                      const trainings  = promoTrainingsList.trim() || '— pick at least one training —';
                      const regUrl     = promoRegistrationUrl.trim() || '— set registration URL —';
                      const renderWa = (text: string) => {
                        const html = text
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
                        return { __html: html.replace(/\n/g, '<br/>') };
                      };
                      const namedBody = `*Dear ${sampleName},*\n\n📘 Training Session Update\n\n*📌 Training session details:*👇\n\n${trainings}\n\n✅ Registration details: ${regUrl}\n\n📞 Phone: +91 8239 00 8202\n📧 Email: safefoodmitra@gmail.com\n\nThank you!\nSafeFood Mitra`;
                      const unnamedBody = `*📘 Training Session Update*\n\n*📌 Training session details👇*:\n\n${trainings}\n\n*✅ Registration details:* ${regUrl}\n\n📞 Phone: +91 8239 00 8202\n📧 Email: safefoodmitra@gmail.com`;
                      const headerImg = promoHeaderImageUrl.trim();
                      return (
                        <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-200">
                          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Megaphone size={11} /> WhatsApp Preview <span className="text-emerald-600 font-semibold normal-case tracking-normal">(approximate — actual rendering depends on Meta)</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-1">Named template — recipient with name (sample: &quot;{sampleName}&quot;)</div>
                              <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] border border-emerald-200 p-3 max-w-md shadow-sm">
                                {headerImg && (<img src={headerImg} alt="header" className="w-full h-auto rounded-lg mb-2 border border-emerald-100 object-cover max-h-48" />)}
                                <div className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={renderWa(namedBody)} />
                                <div className="text-right text-[9px] text-slate-500 mt-1.5">11:42 AM ✓✓</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-emerald-700 uppercase tracking-wider mb-1">Unnamed template — recipient without name on file</div>
                              <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] border border-emerald-200 p-3 max-w-md shadow-sm">
                                {headerImg && (<img src={headerImg} alt="header" className="w-full h-auto rounded-lg mb-2 border border-emerald-100 object-cover max-h-48" />)}
                                <div className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words" dangerouslySetInnerHTML={renderWa(unnamedBody)} />
                                <div className="text-right text-[9px] text-slate-500 mt-1.5">11:42 AM ✓✓</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Free-form Message</label>
                      {promoMessageDirty && (
                        <button onClick={() => { setPromoMessageDirty(false); setPromoMessage(buildPromoMessage(promoSelected)); }}
                          className="text-[10px] font-bold text-emerald-700 hover:underline">Reset to suggestion</button>
                      )}
                    </div>
                    <textarea value={promoMessage}
                      onChange={e => { setPromoMessage(e.target.value); setPromoMessageDirty(true); }}
                      rows={16}
                      className="flex-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 outline-none resize-none" />
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
                      <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        Free-form text only delivers to contacts who messaged you within the last 24 hours. For cold leads, switch to <b>Meta Template</b> mode above.
                      </p>
                    </div>
                  </>
                )}

                {promoResult && (
                  <div className={`mt-3 p-3 rounded-xl text-[11px] border ${promoResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {promoResult.ok ? (
                      <>
                        <div className="font-bold">Done — sent to {promoResult.sent} of {promoResult.total} contacts.</div>
                        {promoResult.failed > 0 && (
                          <div className="mt-1">
                            {promoResult.failed} failed. First few: {(promoResult.failures || []).slice(0, 3).map((f: any) => `${f.phone} (${f.error})`).join('; ')}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="font-bold">{promoResult.error || 'Send failed.'}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <div className="text-[11px] text-slate-500">
                {promoSelected.size} training{promoSelected.size === 1 ? '' : 's'} selected
                {promoCount ? <> · {Math.max(0, promoCount.total - promoExcluded.size)} of {promoCount.total} recipient{promoCount.total === 1 ? '' : 's'} will receive</> : null}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPromoModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
                  Close
                </button>
                <button onClick={sendPromoBlast} disabled={promoSending || promoSelected.size === 0}
                  className="px-5 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {promoSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {promoSending ? 'Sending…' : 'Send to all'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Referral-usage digest modal */}
      {showReferralDigestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center"><Megaphone size={16} /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-800">Referral-Usage WhatsApp Digest</h2>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Sends to users with 1 or 2 valid referral codes (active, non-expired, with remaining usage).</p>
                </div>
              </div>
              <button onClick={() => setShowReferralDigestModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {referralDigestLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Loading eligible recipients…</div>
              ) : referralDigestPreview?.ok === false ? (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-bold">{referralDigestPreview.error || 'Failed to load preview.'}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Eligible recipients</div>
                      <div className="text-2xl font-black text-emerald-800 mt-1">{referralDigestPreview?.total ?? 0}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">have 1 or 2 valid codes + a phone number</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Skipped (no phone)</div>
                      <div className="text-2xl font-black text-amber-800 mt-1">{referralDigestPreview?.missingPhone ?? 0}</div>
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">qualify but have no usable phone on file</div>
                    </div>
                  </div>

                  {Array.isArray(referralDigestPreview?.recipients) && referralDigestPreview.recipients.length > 0 && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Preview recipients (first {Math.min(20, referralDigestPreview.recipients.length)})</label>
                      <div className="border border-slate-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {referralDigestPreview.recipients.slice(0, 20).map((r: any, i: number) => (
                          <div key={i} className="px-3 py-2 text-[11px] flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-700 truncate">{r.name}</div>
                              <div className="text-slate-400 font-semibold">{r.phone}</div>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">{(r.codes || []).join(', ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Training Details (template var {'{{10}}'})</label>
                      <button
                        onClick={() => { setReferralDigestTrainingsDirty(false); setReferralDigestTrainings(referralDigestPreview?.trainingDetails || ''); }}
                        className="text-[10px] font-bold text-amber-700 hover:underline">Reset to upcoming sessions</button>
                    </div>
                    <textarea
                      value={referralDigestTrainings}
                      onChange={(e) => { setReferralDigestTrainings(e.target.value); setReferralDigestTrainingsDirty(true); }}
                      rows={8}
                      className="w-full text-[11px] font-mono border border-slate-200 rounded-xl p-3 leading-relaxed focus:outline-none focus:border-amber-400"
                      placeholder="✅ *Topic*&#10;   📅 Date   🕒 Time&#10;   👤 Trainer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Auto-built from upcoming public sessions in your training calendar. Edit freely if you want a custom blurb.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600 leading-relaxed">
                    <b className="text-slate-700">Template:</b> <code className="font-mono">haccp_referral_usage_digest</code> · 10 body vars.
                    Must be <b>approved</b> in WhatsApp Manager (Utility category) before sends actually deliver. Until then every send will silently fail.
                  </div>

                  {/* ── WhatsApp preview using the first eligible recipient ── */}
                  {(() => {
                    const sample = (referralDigestPreview?.recipients || [])[0];
                    const sampleName = (sample?.name || 'Participant').trim();
                    const code1 = sample?.codes?.[0] || 'CODE1XXXX';
                    const code2 = sample?.codes?.[1] || 'CODE2XXXX';
                    const trainings = (referralDigestTrainings || '').trim() || '— upcoming sessions list —';
                    const body = `Dear ${sampleName},\n\nHere are your referral code usage details:\n\n🎟️ Code: ${code1}\n📊 Used Count: 0\n📌 Remaining Valid Usage: 5\n📅 Expiry Date: —\n\n🎟️ Code: ${code2}\n📊 Used Count: 0\n📌 Remaining Valid Usage: 5\n📅 Expiry Date: —\n\n📘 Training Details:\n${trainings}\n\nThese referral codes may be used during future training registrations or shared for training reference purposes.\n\n📞 Phone: +91 8239 00 8202\n📧 Email: safefoodmitra@gmail.com\n\nThank you!\nSafeFood Mitra`;
                    const html = body
                      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
                      .replace(/\n/g, '<br/>');
                    return (
                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-50/60 to-teal-50/40 border border-emerald-200">
                        <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Megaphone size={11} /> WhatsApp Preview
                          {sample
                            ? <span className="text-emerald-600 font-semibold normal-case tracking-normal">(based on first recipient)</span>
                            : <span className="text-emerald-600 font-semibold normal-case tracking-normal">(no eligible recipients yet — using placeholders)</span>}
                        </div>
                        <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] border border-emerald-200 p-3 shadow-sm">
                          <div className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{ __html: html }} />
                          <div className="text-right text-[9px] text-slate-500 mt-1.5">11:42 AM ✓✓</div>
                        </div>
                      </div>
                    );
                  })()}

                  {referralDigestResult && (
                    <div className={`p-3 rounded-xl text-[11px] border ${referralDigestResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {referralDigestResult.ok ? (
                        <>
                          <div className="font-bold">Done — sent to {referralDigestResult.sent} of {referralDigestResult.total} recipients.</div>
                          {referralDigestResult.failed > 0 && (
                            <div className="mt-1">
                              {referralDigestResult.failed} failed. First few: {(referralDigestResult.failures || []).slice(0, 3).map((f: any) => `${f.phone} (${f.error})`).join('; ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="font-bold">{referralDigestResult.error || 'Send failed.'}</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <div className="text-[11px] text-slate-500">
                {referralDigestPreview?.total ?? 0} eligible recipient{(referralDigestPreview?.total ?? 0) === 1 ? '' : 's'}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowReferralDigestModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
                  Close
                </button>
                <button onClick={sendReferralDigest} disabled={referralDigestSending || referralDigestLoading || !referralDigestPreview?.total}
                  className="px-5 py-2 rounded-lg text-xs font-black bg-amber-600 text-white flex items-center gap-1.5 hover:bg-amber-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {referralDigestSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {referralDigestSending ? 'Sending…' : `Send to ${referralDigestPreview?.total ?? 0}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backfill personal coupons modal — generates Refer & Earn coupons
          for previously paid + verified registrations that don't yet have one. */}
      {showBackfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-pink-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center"><Gift size={16} /></div>
                <div>
                  <h2 className="text-sm font-black text-slate-800">Generate Past Coupons</h2>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">For previously paid + verified registrations missing a Refer &amp; Earn coupon.</p>
                </div>
              </div>
              <button onClick={() => setShowBackfillModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 leading-relaxed">
                <div className="font-bold mb-1">What this does</div>
                Scans every <code className="font-mono bg-white px-1 rounded">training_registrations</code> row where
                <code className="font-mono bg-white px-1 rounded mx-1">paymentStatus = verified</code> but no personal coupon was issued,
                then auto-generates one using the same fallback chain used at registration + payment-verification time.
                Safe to re-run — duplicates are blocked at the DB level.
              </div>

              {backfillRunning && (
                <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> Working…</div>
              )}

              {!backfillRunning && backfillResult && backfillResult.ok === false && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 font-bold">
                  {backfillResult.error || 'Failed.'}
                </div>
              )}

              {!backfillRunning && backfillResult && backfillResult.ok && backfillResult.dryRun && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Candidates</div>
                      <div className="text-2xl font-black text-amber-800 mt-1">{backfillResult.candidates ?? 0}</div>
                      <div className="text-[10px] text-amber-700 font-semibold mt-0.5">verified registrations missing a coupon</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Will be issued</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">≤ {backfillResult.candidates ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">duplicates auto-skipped</div>
                    </div>
                  </div>

                  {Array.isArray(backfillResult.sample) && backfillResult.sample.length > 0 && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Preview (first {backfillResult.sample.length})</label>
                      <div className="border border-slate-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100">
                        {backfillResult.sample.map((r: any, i: number) => (
                          <div key={i} className="px-3 py-2 text-[11px]">
                            <div className="font-bold text-slate-700 truncate">{r.name || '— no name —'}</div>
                            <div className="text-slate-400 font-semibold truncate">{r.email}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {!backfillRunning && backfillResult && backfillResult.ok && !backfillResult.dryRun && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Issued</div>
                      <div className="text-2xl font-black text-emerald-800 mt-1">{backfillResult.issued ?? 0}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">brand-new coupons created</div>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <div className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Reused</div>
                      <div className="text-2xl font-black text-blue-800 mt-1">{backfillResult.reused ?? 0}</div>
                      <div className="text-[10px] text-blue-700 font-semibold mt-0.5">existing coupon attached to registration</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Skipped</div>
                      <div className="text-2xl font-black text-slate-800 mt-1">{backfillResult.skipped ?? 0}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-0.5">missing email / session</div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                      <div className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Errors</div>
                      <div className="text-2xl font-black text-rose-800 mt-1">{backfillResult.errors ?? 0}</div>
                      <div className="text-[10px] text-rose-700 font-semibold mt-0.5">see server logs</div>
                    </div>
                  </div>

                  {Array.isArray(backfillResult.sample) && backfillResult.sample.length > 0 && (
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Sample results</label>
                      <div className="border border-slate-200 rounded-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {backfillResult.sample.map((r: any, i: number) => (
                          <div key={i} className="px-3 py-2 text-[11px] flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-700 truncate">{r.email}</div>
                              {r.reason && <div className="text-rose-500 font-semibold text-[10px]">{r.reason}</div>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {r.code && <code className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">{r.code}</code>}
                              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                r.status === 'issued'  ? 'bg-emerald-100 text-emerald-700' :
                                r.status === 'reused'  ? 'bg-blue-100 text-blue-700' :
                                r.status === 'skipped' ? 'bg-slate-100 text-slate-500' :
                                'bg-rose-100 text-rose-700'
                              }`}>{r.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => runBackfillCoupons(true)} disabled={backfillRunning}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Refresh count
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowBackfillModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors">
                  Close
                </button>
                <button
                  onClick={() => {
                    const n = backfillResult?.candidates ?? 0;
                    if (backfillResult?.dryRun && n === 0) { alert('Nothing to backfill — every verified registration already has a coupon.'); return; }
                    if (!confirm(`Generate coupons for up to ${n} registration(s)? This is idempotent and safe to re-run.`)) return;
                    runBackfillCoupons(false);
                  }}
                  disabled={backfillRunning || (backfillResult?.dryRun && (backfillResult?.candidates ?? 0) === 0)}
                  className="px-5 py-2 rounded-lg text-xs font-black bg-rose-600 text-white flex items-center gap-1.5 hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {backfillRunning ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
                  {backfillRunning ? 'Working…' : 'Generate now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50">
              <div>
                <h2 className="text-sm font-black text-slate-800">{editingUser ? 'Edit LMS User' : 'Add LMS User'}</h2>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Learning Management System</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {[
                { label: 'Full Name *',       field: 'name',         type: 'text',  placeholder: 'e.g. Priya Sharma' },
                { label: 'Email Address *',   field: 'email',        type: 'email', placeholder: 'e.g. priya@example.com' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</label>
                  <input type={type} value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all" />
                </div>
              ))}
              {/* Phone: country-code dropdown (defaults to +91) + digits-only
                  number. We don't validate length here so admins can paste
                  partial entries; final normalisation happens on save. */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Phone</label>
                <div className="flex gap-2">
                  <select
                    value={form.countryCode}
                    onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))}
                    className="px-2 py-2.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all max-w-[145px]"
                    title="Country code"
                  >
                    {COUNTRY_CODE_OPTIONS.map(({ country, code }) => (
                      <option key={`${country}-${code}`} value={code}>+{code} · {country}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                    placeholder="e.g. 9876543210"
                    inputMode="numeric"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Defaults to +91 (India). Enter digits only — the country code is added automatically.
                </p>
              </div>
              {[
                { label: 'Organization *',    field: 'organization', type: 'text',  placeholder: 'e.g. Acme Foods Pvt Ltd' },
                { label: 'Department',        field: 'department',   type: 'text',  placeholder: 'e.g. Quality Assurance' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</label>
                  <input type={type} value={(form as any)[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as LmsUser['role'] }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none">
                    <option value="learner">Learner</option>
                    <option value="trainer">Trainer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LmsUser['status'] }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-400/30">
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg text-xs font-black hover:bg-violet-700 transition-colors disabled:opacity-60 shadow-sm">
                {saving ? 'Saving…' : editingUser ? 'Update User' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {internalTab === 'certificates' && (
        <div className="p-6">
          <CertificateStudio />
        </div>
      )}
    </div>
  );
}
