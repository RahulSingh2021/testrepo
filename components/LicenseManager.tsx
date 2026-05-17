"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar } from 'recharts';
import { 
  Search, RefreshCw, FileSpreadsheet, Settings, 
  Filter, ChevronDown, Hotel, Building, 
  CloudUpload, History, PlusCircle, MinusCircle, 
  Trash2, Download, X, Plus, ChevronRight, Save, Edit2, FileText,
  CheckSquare, Square, ListFilter, Table2, FileBarChart, Layers, 
  RefreshCcw, CheckCircle2, Lock, ChevronUp, Power, Eye, AlertTriangle, FileCheck,
  Check
} from 'lucide-react';
import { Entity, HierarchyScope, Category, SubCategory } from '../types';

// --- Utility Functions ---
const clsx = (...args: any[]) => args.filter(Boolean).join(' ');

interface SubSubVariation {
  isApplicable: boolean;
  date: string | null;
  fileName: string | null;
  licenseNumber?: string | null;
}

interface Metric {
  subId: string;
  name: string;
  isApplicable: boolean;
  date?: string | null;
  fileName?: string | null;
  licenseNumber?: string | null;
  isComplex?: boolean;
  variations?: Record<string, SubSubVariation>;
  activeSubSubId?: string;
  staff?: { total: number; valid: number };
  contract?: { total: number; valid: number };
  trainee?: { total: number; valid: number };
  totalHandlers?: number;
  validCerts?: number;
}

interface FilterState {
  corp: string;
  region: string;
  unit: string; 
  status: string;
  topic: string;
  subtopic: string;
  selectedUnitIds: string[]; 
}

// --- Logic Helpers ---

const calculateShelfLife = (mfgStr: string, expStr: string) => {
    if (!mfgStr || !expStr) return { days: 0, percentage: 0 };
    const mfgDateUTC = new Date(mfgStr + 'T00:00:00Z');
    const expDateUTC = new Date(expStr + 'T00:00:00Z');
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    
    if (isNaN(mfgDateUTC.getTime()) || isNaN(expDateUTC.getTime()) || expDateUTC < mfgDateUTC) return { days: -1, percentage: 0 };
    
    const totalShelfLife = (expDateUTC.getTime() - mfgDateUTC.getTime()) / 864e5;
    if (totalShelfLife <= 0) return { days: 0, percentage: 0 };
    
    const remainingDays = Math.ceil((expDateUTC.getTime() - todayUTC.getTime()) / 864e5);
    const percentage = (remainingDays / totalShelfLife) * 100;
    
    return { days: remainingDays, percentage: Math.max(0, Math.min(100, percentage)) };
};

const isAncestor = (ancestorId: string | undefined | null, descendantId: string | undefined | null, allEntities: Entity[]) => {
    if (!ancestorId || !descendantId) return false;
    let curr: Entity | undefined = allEntities.find(e => e.id === descendantId);
    while (curr) {
        if (curr.parentId === ancestorId) return true;
        curr = curr.parentId ? allEntities.find(e => e.id === curr!.parentId) : undefined;
    }
    return false;
};

const SCOPE_ORDER: Record<HierarchyScope, number> = { 'super-admin': 0, 'corporate': 1, 'regional': 2, 'unit': 3, 'department': 4, 'user': 5 };

const canViewItem = (item: { createdByScope: HierarchyScope, createdByEntityId?: string | null }, currentScope: HierarchyScope, userId: string | undefined | null, entities: Entity[]) => {
    if (SCOPE_ORDER[item.createdByScope] > SCOPE_ORDER[currentScope]) return false;
    if (currentScope === 'super-admin') return true;
    if (item.createdByScope === 'super-admin') return true;
    if (userId && item.createdByEntityId === userId) return true;
    if (userId && item.createdByEntityId && isAncestor(item.createdByEntityId, userId, entities)) return true;
    return SCOPE_ORDER[item.createdByScope] <= SCOPE_ORDER[currentScope];
};

const canEditItem = (item: { createdByScope: HierarchyScope, createdByEntityId?: string | null }, currentScope: HierarchyScope, userId: string | undefined | null) => {
    if (item.createdByScope === 'super-admin' && currentScope === 'super-admin') return true;
    if (item.createdByScope === currentScope && item.createdByEntityId === userId) return true;
    return false;
};

const canAddSubUnder = (parentItem: { createdByScope: HierarchyScope }, currentScope: HierarchyScope) => {
    return SCOPE_ORDER[parentItem.createdByScope] <= SCOPE_ORDER[currentScope];
};

const findAncestorByType = (u: Entity, type: string, allEntities: Entity[]): Entity | undefined => {
    if (!u.parentId) return undefined;
    const parent = allEntities.find(e => e.id === u.parentId);
    if (!parent) return undefined;
    if (parent.type === type) return parent;
    return findAncestorByType(parent, type, allEntities);
};

const getLicenseInfo = (unitId: string, subId: string, metricObj: any) => {
  if (!metricObj) return { num: 'N/A', expiry: '-', status: 'No Data', cls: 'bg-gray-400 text-white' };
  
  if (metricObj.isApplicable === false) return { num: 'N/A', expiry: '-', status: 'Inactive', cls: 'bg-slate-200 text-slate-500' };

  let data = metricObj;
  
  if (metricObj.isComplex && metricObj.variations) {
    const activeId = metricObj.activeSubSubId || Object.keys(metricObj.variations)[0];
    data = metricObj.variations[activeId];
    if (!data) return { num: 'N/A', expiry: '-', status: 'No Data', cls: 'bg-gray-400' };
    if (data.isApplicable === false) return { num: 'N/A', expiry: '-', status: 'Inactive', cls: 'bg-slate-200 text-slate-500' };
  }

  const licNumDisplay = data.licenseNumber || 'PENDING';

  const uploads = data.uploads as any[] | undefined;
  const latestUpload = uploads?.length ? uploads[uploads.length - 1] : null;

  if (latestUpload?.expiryDate) {
    const expiryDate = new Date(latestUpload.expiryDate);
    const now = new Date();
    const daysLeft = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    let status = 'Active', cls = 'bg-green-600 text-white';
    if (daysLeft < 0) { status = 'Expired'; cls = 'bg-red-600 text-white'; }
    else if (daysLeft < 60) { status = 'Expiring'; cls = 'bg-yellow-400 text-gray-900'; }
    return { num: latestUpload.licenseNumber || licNumDisplay, expiry: latestUpload.expiryDate, status, cls };
  }

  if (data.fileName && !data.date) return { num: licNumDisplay, expiry: '-', status: 'Pending Date', cls: 'bg-gray-500 text-white' };
  const dateStr = data.date;
  if (!dateStr && !data.fileName) return { num: '-', expiry: '-', status: 'Not Uploaded', cls: 'bg-gray-400 text-white' };
  
  if (!dateStr) return { num: licNumDisplay, expiry: '-', status: 'Missing Date', cls: 'bg-amber-50 text-white' };

  const issue = new Date(dateStr);
  const expiry = new Date(issue); 
  expiry.setFullYear(issue.getFullYear() + 1);
  const now = new Date();
  const daysLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  let status = 'Active', cls = 'bg-green-600 text-white';
  if (daysLeft < 0) { status = 'Expired'; cls = 'bg-red-600 text-white'; }
  else if (daysLeft < 60) { status = 'Expiring'; cls = 'bg-yellow-400 text-gray-900'; }
  
  return { num: licNumDisplay, expiry: expiry.toISOString().split('T')[0], status, cls };
};

const NON_COMPLIANT_STATUSES = new Set(['Expired', 'Not Uploaded', 'No Data', 'Missing Date', 'Pending Date']);

const getUnitComplianceStatus = (unit: Entity, schema: Category[]) => {
  if (unit.status !== 'active') return 'CLOSED';
  let unitStatus = 'COMPLIANCE';

  for (const cat of schema) {
    if (!cat.active) continue;
    const subs = cat.subs.filter(s => s.active);
    if (subs.length === 0) continue;
    const metrics = unit.metrics?.[cat.id] || [];
    let catHasAttention = false;
    let catHasPartial = false;

    subs.forEach(sub => {
      const m = metrics.find((x: Metric) => x.subId === sub.id);
      // Explicitly OFF → skip entirely
      if (m?.isApplicable === false) return;
      // No metric stored yet → treat as ON with no uploads = ATTENTION
      if (!m) { catHasAttention = true; return; }

      if (m.isComplex && m.variations) {
        const subSubs = sub.subSubs || [];
        if (subSubs.length > 0) {
          subSubs.forEach((ss: any) => {
            const v = m.variations?.[ss.id];
            if (v?.isApplicable === false) return;
            // variation not set yet → not uploaded
            if (!v || !(v.uploads?.length)) { catHasAttention = true; return; }
            const info = getLicenseInfo(unit.id, sub.id, { ...m, activeSubSubId: ss.id });
            if (NON_COMPLIANT_STATUSES.has(info.status)) catHasAttention = true;
            else if (info.status === 'Expiring') catHasPartial = true;
          });
        } else {
          Object.entries(m.variations).forEach(([ssId, v]: [string, any]) => {
            if (v.isApplicable === false) return;
            const info = getLicenseInfo(unit.id, sub.id, { ...m, activeSubSubId: ssId });
            if (NON_COMPLIANT_STATUSES.has(info.status)) catHasAttention = true;
            else if (info.status === 'Expiring') catHasPartial = true;
          });
        }
      } else {
        const info = getLicenseInfo(unit.id, sub.id, m);
        if (NON_COMPLIANT_STATUSES.has(info.status)) catHasAttention = true;
        else if (info.status === 'Expiring') catHasPartial = true;
      }
    });

    if (catHasAttention) return 'ATTENTION';
    if (catHasPartial) unitStatus = 'PARTIAL';
  }
  return unitStatus;
};

const formatStandardString = (info: any) => {
    if (info.status === 'Not Uploaded' || info.status === 'No Data') return `Not Uploaded (-)`;
    const num = info.num !== 'N/A' ? info.num : '-';
    return `${info.status} (${num})`;
};

const ScopeBadge = ({ scope }: { scope: HierarchyScope }) => {
    const config = {
        'super-admin': { label: 'A', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
        'corporate': { label: 'C', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
        'regional': { label: 'R', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
        'unit': { label: 'U', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
        'department': { label: 'D', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
        'user': { label: 'U', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    };
    const style = config[scope] || config['corporate'];
    return (
        <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black border ${style.bg} ${style.text} ${style.border}`} title={`Added by ${scope}`}>
            {style.label}
        </span>
    );
};

// --- Sub-Components ---

const UnitCellContent = ({ unit, corpName, regName, status }: { unit: Entity, corpName: string, regName: string, status: string }) => {
  const isCompliant = status === 'COMPLIANCE';
  const isAttention = status === 'ATTENTION';
  
  return (
    <div className="flex gap-3">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
            <Hotel className="text-blue-600 w-6 h-6" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
            <h4 className="font-bold text-sm text-[#0056b3] truncate leading-tight mb-0.5">{unit.name}</h4>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium mb-1">
               <Building size={10} className="text-slate-400" /> 
               <span className="truncate max-w-[140px]">{corpName} | {regName.replace('Division', '').trim()}</span>
            </div>
            <div className="text-[10px] text-slate-400 mb-1.5 font-mono">ID: {unit.id.substring(0,8).toUpperCase()}</div>
            <div className="flex gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${unit.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {unit.status === 'active' ? 'Active' : 'Inactive'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${isCompliant ? 'bg-green-600 text-white' : isAttention ? 'bg-red-600 text-white' : 'bg-amber-50 text-white'}`}>
                    {status}
                </span>
            </div>
        </div>
    </div>
  );
};

const ComplianceProgressBar = ({ validCount, expiringCount, expiredCount, notUploadedCount = 0 }: any) => {
    const total = validCount + expiringCount + expiredCount + notUploadedCount;
    if (total === 0) return null;

    const validPct = (validCount / total) * 100;
    const expiringPct = (expiringCount / total) * 100;
    const expiredPct = (expiredCount / total) * 100;
    const notUploadedPct = (notUploadedCount / total) * 100;
    const compliancePct = Math.round((validCount / total) * 100);
    const color = compliancePct >= 80 ? '#10b981' : compliancePct >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                    <div className="relative w-11 h-11 rounded-full bg-slate-50 flex items-center justify-center border-2" style={{ borderColor: color }}>
                        <span className="text-[9px] font-black" style={{ color }}>{compliancePct}%</span>
                    </div>
                </div>
                <div className="flex-1 space-y-1">
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                        {validCount > 0 && <div className="h-full bg-emerald-500 transition-all" style={{ width: `${validPct}%` }} />}
                        {expiringCount > 0 && <div className="h-full bg-amber-400 transition-all" style={{ width: `${expiringPct}%` }} />}
                        {expiredCount > 0 && <div className="h-full bg-red-500 transition-all" style={{ width: `${expiredPct}%` }} />}
                        {notUploadedCount > 0 && (
                            <div className="h-full transition-all" style={{ width: `${notUploadedPct}%`, background: 'repeating-linear-gradient(45deg, #94a3b8, #94a3b8 2px, #cbd5e1 2px, #cbd5e1 6px)' }} />
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-black">
                        {validCount > 0 && <span className="flex items-center gap-0.5 text-emerald-700"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"/>Valid {validCount}</span>}
                        {expiringCount > 0 && <span className="flex items-center gap-0.5 text-amber-600"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block"/>Expiring {expiringCount}</span>}
                        {expiredCount > 0 && <span className="flex items-center gap-0.5 text-red-700"><span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block"/>Expired {expiredCount}</span>}
                        {notUploadedCount > 0 && <span className="flex items-center gap-0.5 text-slate-500"><span className="w-1.5 h-1.5 rounded-full inline-block border border-slate-400" style={{ background: 'repeating-linear-gradient(45deg, #94a3b8, #94a3b8 1px, #e2e8f0 1px, #e2e8f0 3px)' }}/>Not Uploaded {notUploadedCount}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StandardCell = ({ unit, sub, metric, onUpdate, onOpenRenew, onOpenUpload, onOpenHistory }: any) => {
    const isApplicable = metric?.isApplicable !== false;
    const hasSubSubs = sub.subSubs && sub.subSubs.length > 0;

    if (!isApplicable) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <Power className="w-3 h-3 text-slate-300 mb-1" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">Not Required</span>
                <button onClick={() => onUpdate(undefined, { isApplicable: true })} className="mt-1 text-[9px] text-indigo-500 hover:underline font-bold uppercase">Enable</button>
            </div>
        );
    }

    const getUploadSummary = (data: any, isOn = true) => {
        const uploads = data?.uploads || [];
        let valid = 0, expired = 0, expiring = 0, notUploaded = 0;
        const now = new Date();
        if (isOn && uploads.length === 0) {
            notUploaded = 1;
        } else {
            uploads.forEach((u: any) => {
                if (!u.expiryDate) { notUploaded++; return; }
                const exp = new Date(u.expiryDate);
                const days = (exp.getTime() - now.getTime()) / (1000*60*60*24);
                if (days < 0) expired++;
                else if (days < 60) expiring++;
                else valid++;
            });
        }
        return { total: valid + expired + expiring + notUploaded, valid, expired, expiring, notUploaded };
    };

    if (!hasSubSubs) {
        const info = getLicenseInfo(unit.id, sub.id, metric);
        const summary = getUploadSummary(metric);
        return (
            <div className="bg-white rounded-lg p-1.5 space-y-1">
                <div className="flex justify-between items-center gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${info.cls}`}>{info.status}</span>
                    <div className="flex gap-0.5 shrink-0 items-center">
                        <button onClick={() => onOpenUpload(undefined)} className="p-0.5 text-blue-500 hover:text-blue-700" title="Upload"><Plus size={10}/></button>
                        <button onClick={() => onOpenHistory(undefined)} className="p-0.5 text-slate-400 hover:text-slate-600" title="History"><History size={10}/></button>
                        <button
                            onClick={() => onUpdate(undefined, { isApplicable: false })}
                            title="Turn OFF — excludes from analytics"
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5 transition-colors bg-emerald-500 text-white hover:bg-emerald-600"
                        >
                            <Power size={8} />ON
                        </button>
                    </div>
                </div>
                {summary.total > 0 && (
                    <ComplianceProgressBar validCount={summary.valid} expiringCount={summary.expiring} expiredCount={summary.expired} notUploadedCount={summary.notUploaded} />
                )}
            </div>
        );
    }

    return (
        <div className="w-full space-y-1">
            {/* Compact Sub-Topic Header */}
            <div className="flex items-center justify-between bg-slate-700 rounded px-2 py-1 gap-2 mb-1">
                <span className="text-[9px] font-bold text-white uppercase truncate flex-1">{sub.name}</span>
                <button
                    onClick={() => onUpdate(undefined, { isApplicable: !isApplicable })}
                    title={isApplicable ? "Deactivate" : "Activate"}
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5 transition-colors ${
                        isApplicable ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                >
                    <Power size={8} />
                    {isApplicable ? 'On' : 'Off'}
                </button>
            </div>

            {sub.subSubs.map((ss: any) => {
                const info = getLicenseInfo(unit.id, sub.id, ss.id ? { ...metric, activeSubSubId: ss.id } : metric);
                const varData = metric?.variations?.[ss.id] || null;
                const uploads = varData?.uploads || [];
                const isActive = varData?.isApplicable !== false;

                const summary = (() => {
                    let valid = 0, expired = 0, expiring = 0;
                    const now = new Date();
                    uploads.forEach((u: any) => {
                        if (!u.expiryDate) return;
                        const exp = new Date(u.expiryDate);
                        const days = (exp.getTime() - now.getTime()) / (1000*60*60*24);
                        if (days < 0) expired++;
                        else if (days < 60) expiring++;
                        else valid++;
                    });
                    return { total: uploads.length, valid, expired, expiring };
                })();

                return (
                    <div key={ss.id} className="border border-slate-100 rounded bg-white p-1.5 space-y-1">
                        {/* Row: name + status + upload btn */}
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold text-slate-700 uppercase truncate flex-1">{ss.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase ${info.cls}`}>{info.status}</span>
                                <button onClick={() => onOpenUpload(ss.id)} className="p-0.5 text-blue-500 hover:text-blue-700" title="Upload"><Plus size={9}/></button>
                            </div>
                        </div>
                        {!isActive ? (
                            <span className="text-[8px] text-slate-400 italic">Inactive</span>
                        ) : summary.total > 0 ? (
                            uploads.map((u: any, idx: number) => {
                                const isExp = u.expiryDate && new Date(u.expiryDate) < new Date();
                                const isExpiring = !isExp && u.expiryDate && (new Date(u.expiryDate).getTime() - new Date().getTime()) / (1000*60*60*24) < 60;
                                return (
                                    <div key={idx} className={`rounded px-1.5 py-1 text-[8px] border ${isExp ? 'bg-red-50 border-red-200 text-red-700' : isExpiring ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                        <div className="font-bold truncate">{u.licenseNumber || `Doc ${idx + 1}`}</div>
                                        <div className="flex gap-1 text-[7px] mt-0.5 text-slate-500">
                                            {u.generateDate && <span>Gen: {u.generateDate}</span>}
                                            {u.expiryDate && <span>Exp: {u.expiryDate}</span>}
                                        </div>
                                    </div>
                                );
                            })
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
};

const SummaryCell = ({ unit, catId, subs, metrics }: any) => {
    const getSubSummary = (sub: any) => {
        const m = (metrics || []).find((x: Metric) => x.subId === sub.id);
        // Explicitly turned OFF → skip
        if (m?.isApplicable === false) return { name: sub.name, total: 0, valid: 0, expired: 0, expiring: 0, notUploaded: 0, status: 'N/A', nearestExpiry: null as number | null };
        // No metric stored yet (never interacted) → treat as ON, not uploaded
        if (!m) {
            const slots = (sub.subSubs?.length > 0) ? sub.subSubs.length : 1;
            return { name: sub.name, total: slots, valid: 0, expired: 0, expiring: 0, notUploaded: slots, status: 'Not Uploaded', nearestExpiry: null as number | null };
        }
        
        const now = new Date();
        let valid = 0, expired = 0, expiring = 0, notUploaded = 0;
        let nearestExpiry: number | null = null;
        
        const processUpload = (uploads: any[]) => {
            if (!uploads.length) { notUploaded++; return; }
            uploads.forEach((u: any) => {
                if (!u.expiryDate) { notUploaded++; return; }
                const days = (new Date(u.expiryDate).getTime() - now.getTime()) / (1000*60*60*24);
                if (days < 0) expired++;
                else if (days < 60) { expiring++; if (nearestExpiry === null || days < nearestExpiry) nearestExpiry = days; }
                else { valid++; if (nearestExpiry === null || days < nearestExpiry) nearestExpiry = days; }
            });
        };

        if (sub.subSubs && sub.subSubs.length > 0) {
            sub.subSubs.forEach((ss: any) => { 
                const v = m.variations?.[ss.id];
                if (v?.isApplicable === false) return;
                processUpload(v?.uploads || []);
            });
        } else {
            processUpload(m.uploads || []);
        }
        
        const total = valid + expired + expiring + notUploaded;
        const status = total === 0 ? 'N/A' : notUploaded > 0 && valid === 0 && expired === 0 && expiring === 0 ? 'Not Uploaded' : expired > 0 ? 'Expired' : expiring > 0 ? 'Expiring' : 'Valid';
        return { name: sub.name, total, valid, expired, expiring, notUploaded, status, nearestExpiry };
    };

    const allSummaries = subs.map((sub: any) => getSubSummary(sub));
    const agg = allSummaries.reduce((acc: any, s: any) => ({
        valid: acc.valid + s.valid,
        expired: acc.expired + s.expired,
        expiring: acc.expiring + s.expiring,
        total: acc.total + s.total,
        na: acc.na + (s.status === 'N/A' ? 1 : 0),
        notUploaded: acc.notUploaded + s.notUploaded,
    }), { valid: 0, expired: 0, expiring: 0, total: 0, na: 0, notUploaded: 0 });

    const healthPct = agg.total > 0 ? Math.round((agg.valid / agg.total) * 100) : 0;
    const ringColor = healthPct >= 80 ? '#10b981' : healthPct >= 50 ? '#f59e0b' : '#ef4444';
    const hasData = agg.total > 0;
    const allNA = agg.na === allSummaries.length;

    return (
        <div className="min-w-[210px] space-y-2 p-1">
            {!allNA && (
            <div className="flex items-center gap-2.5">
                <div className="relative w-10 h-10 shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                        {hasData && <circle cx="18" cy="18" r="15" fill="none" stroke={ringColor} strokeWidth="3.5" strokeDasharray={`${healthPct * 0.942} 100`} strokeLinecap="round" />}
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black" style={{ color: hasData ? ringColor : '#94a3b8' }}>
                        {hasData ? `${healthPct}%` : '—'}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    {hasData && (
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                            {agg.valid > 0 && <div className="h-full bg-emerald-500 transition-all" style={{width: `${(agg.valid/agg.total)*100}%`}} />}
                            {agg.expiring > 0 && <div className="h-full bg-amber-400 transition-all" style={{width: `${(agg.expiring/agg.total)*100}%`}} />}
                            {agg.expired > 0 && <div className="h-full bg-red-500 transition-all" style={{width: `${(agg.expired/agg.total)*100}%`}} />}
                            {agg.notUploaded > 0 && <div className="h-full transition-all" style={{width: `${(agg.notUploaded/agg.total)*100}%`, background: 'repeating-linear-gradient(45deg,#94a3b8,#94a3b8 2px,#cbd5e1 2px,#cbd5e1 6px)'}} />}
                        </div>
                    )}
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                        {agg.valid > 0 && <span className="flex items-center gap-0.5 text-[8px] font-black text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{agg.valid}</span>}
                        {agg.expiring > 0 && <span className="flex items-center gap-0.5 text-[8px] font-black text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{agg.expiring}</span>}
                        {agg.expired > 0 && <span className="flex items-center gap-0.5 text-[8px] font-black text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{agg.expired}</span>}
                        {agg.notUploaded > 0 && <span className="flex items-center gap-0.5 text-[8px] font-bold text-slate-500"><span className="w-1.5 h-1.5 rounded-full border border-slate-400" style={{background:'repeating-linear-gradient(45deg,#94a3b8,#94a3b8 1px,#e2e8f0 1px,#e2e8f0 3px)'}} />{agg.notUploaded} not uploaded</span>}
                    </div>
                </div>
            </div>
            )}
            <div className="space-y-0.5">
                {allSummaries.map((s: any) => {
                    const barTotal = s.total;
                    const dotColor = s.status === 'N/A' ? 'bg-slate-300' : s.expired > 0 ? 'bg-red-500' : s.expiring > 0 ? 'bg-amber-400' : s.valid > 0 ? 'bg-emerald-500' : 'bg-slate-400';
                    return (
                        <div key={s.name} className="group/row rounded-md px-1.5 py-[3px] hover:bg-slate-50/80 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                                    <span className="text-[8px] font-black text-slate-600 uppercase truncate">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {s.status === 'N/A' ? (
                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md text-slate-400 bg-slate-100 border border-slate-200">N/A</span>
                                    ) : (<>
                                        {s.valid > 0 && <span className="text-[7px] font-black bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md border border-emerald-200">V-{s.valid}</span>}
                                        {s.expired > 0 && <span className="text-[7px] font-black bg-red-50 text-red-700 px-1.5 py-0.5 rounded-md border border-red-200">E-{s.expired}</span>}
                                        {s.expiring > 0 && <span className="text-[7px] font-black bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-200">Exp-{s.expiring}</span>}
                                        {s.notUploaded > 0 && s.valid === 0 && s.expired === 0 && s.expiring === 0 && <span className="text-[7px] font-black text-slate-500 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-md">Not Uploaded</span>}
                                    </>)}
                                </div>
                            </div>
                            {barTotal > 0 && (
                                <div className="w-full h-[3px] rounded-full bg-slate-100 overflow-hidden mt-[3px] flex">
                                    {s.valid > 0 && <div className="h-full bg-emerald-500" style={{width: `${(s.valid/barTotal)*100}%`}} />}
                                    {s.expiring > 0 && <div className="h-full bg-amber-400" style={{width: `${(s.expiring/barTotal)*100}%`}} />}
                                    {s.expired > 0 && <div className="h-full bg-red-500" style={{width: `${(s.expired/barTotal)*100}%`}} />}
                                    {s.notUploaded > 0 && <div className="h-full" style={{width: `${(s.notUploaded/barTotal)*100}%`, background:'repeating-linear-gradient(45deg,#94a3b8,#94a3b8 1px,#cbd5e1 1px,#cbd5e1 4px)'}} />}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const HierarchyFilter = ({ filters, setFilters, entities, onClose, currentScope, userRootId }: any) => {
    const availableCorps = useMemo(() => entities.filter((e: any) => e.type === 'corporate'), [entities]);
    const availableRegions = useMemo(() => entities.filter((e: any) => e.type === 'regional' && (!filters.corp || e.parentId === filters.corp)), [entities, filters.corp]);
    const availableUnits = useMemo(() => entities.filter((e: any) => e.type === 'unit' && (!filters.region || e.parentId === filters.region)), [entities, filters.region]);

    const toggleUnit = (id: string) => {
        const next = filters.selectedUnitIds.includes(id) 
            ? filters.selectedUnitIds.filter((u: string) => u !== id)
            : [...filters.selectedUnitIds, id];
        setFilters((prev: any) => ({ ...prev, selectedUnitIds: next }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corporate</label>
                    <select className="w-full border p-2 rounded-lg text-xs font-bold bg-slate-50" value={filters.corp} onChange={e => setFilters((p: any) => ({ ...p, corp: e.target.value, region: '', selectedUnitIds: [] }))}>
                        <option value="">All Corporations</option>
                        {availableCorps.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Region</label>
                    <select className="w-full border p-2 rounded-lg text-xs font-bold bg-slate-50" value={filters.region} onChange={e => setFilters((p: any) => ({ ...p, region: e.target.value, selectedUnitIds: [] }))}>
                        <option value="">All Regions</option>
                        {availableRegions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Individual Units ({filters.selectedUnitIds.length})</label>
                    <button onClick={() => setFilters((p: any) => ({ ...p, selectedUnitIds: [] }))} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Clear Selection</button>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50 p-2 grid grid-cols-2 gap-1 custom-scrollbar">
                    {availableUnits.map((u: any) => {
                        const isSel = filters.selectedUnitIds.includes(u.id);
                        return (
                            <button key={u.id} onClick={() => toggleUnit(u.id)} className={`text-left px-3 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${isSel ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-100 text-slate-600 hover:border-indigo-300'}`}>
                                <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSel ? 'bg-white border-white' : 'border-slate-300'}`}>
                                    {isSel && <Check size={10} className="text-indigo-600" strokeWidth={4} />}
                                </div>
                                <span className="truncate">{u.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            
            <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">Apply Hierarchy Map</button>
        </div>
    );
};

// --- Main Component ---

interface LicenseManagerProps {
  entities: Entity[];
  onUpdateEntity: (e: Entity) => void;
  currentScope: HierarchyScope;
  userRootId?: string | null;
  targetCorporateId?: string; 
  schema: Category[];
  setSchema: React.Dispatch<React.SetStateAction<Category[]>>;
}

const LicenseManager: React.FC<LicenseManagerProps> = ({ entities, onUpdateEntity, currentScope, userRootId, targetCorporateId, schema, setSchema }) => {
  const [filters, setFilters] = useState<FilterState>({ corp: '', region: '', unit: '', status: '', topic: '', subtopic: '', selectedUnitIds: [] });
  const [search, setSearch] = useState('');
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [expandedSubCols, setExpandedSubCols] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploadEntries, setUploadEntries] = useState<Array<{id: string; reportName: string; licenseNumber: string; generateDate: string; expiryDate: string; fileName: string; fileData: string; comments: string; file: File | null; collapsed: boolean}>>([]);
  const [collapsedExisting, setCollapsedExisting] = useState<Set<number>>(new Set());
  const [editingExistingIdx, setEditingExistingIdx] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getAncestorName = (u: Entity, type: string) => {
    if (!u.parentId) return 'N/A';
    const parent = entities.find(e => e.id === u.parentId);
    if (!parent) return 'N/A';
    if (parent.type === type) return parent.name;
    return getAncestorName(parent, type);
  };

  const filteredUnits = useMemo(() => {
    return entities.filter(u => {
      if(u.type !== 'unit') return false;
      
      // Explicit Hierarchy Scope Filtering
      if (targetCorporateId) {
          const corp = findAncestorByType(u, 'corporate', entities);
          if (corp?.id !== targetCorporateId) return false;
      } else if (currentScope === 'corporate' && userRootId) {
          const corp = findAncestorByType(u, 'corporate', entities);
          if (corp?.id !== userRootId) return false;
      } else if (currentScope === 'regional' && userRootId) {
          if (u.parentId !== userRootId) return false;
      } else if (currentScope === 'unit' && userRootId) {
          if (u.id !== userRootId) return false;
      } else if (currentScope === 'department' && userRootId) {
          const dept = entities.find(e => e.id === userRootId);
          if (dept?.parentId !== u.id) return false;
      } else if (currentScope === 'user' && userRootId) {
           const user = entities.find(e => e.id === userRootId);
           const dept = user?.parentId ? entities.find(e => e.id === user.parentId) : null;
           if (dept?.parentId !== u.id) return false;
      }

      const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      // Internal Hierarchy Filter (filters state)
      if (filters.selectedUnitIds.length > 0) {
        if (!filters.selectedUnitIds.includes(u.id)) return false;
      } else {
        if (filters.corp) {
            const corp = findAncestorByType(u, 'corporate', entities);
            if (corp?.id !== filters.corp) return false;
        }
        if (filters.region) {
            const reg = findAncestorByType(u, 'regional', entities);
            if (reg?.id !== filters.region) return false;
        }
      }

      if (filters.status) {
        const currentStatus = getUnitComplianceStatus(u, schema);
        if (currentStatus !== filters.status) return false;
      }
      return true;
    }).sort((a, b) => (Number(b.status === 'active') - Number(a.status === 'active')));
  }, [entities, search, filters, schema, currentScope, userRootId, targetCorporateId]);


  const analyticsData = useMemo(() => {
    const statusOf = (u: Entity) => getUnitComplianceStatus(u, schema);
    const statusCounts = { COMPLIANCE: 0, PARTIAL: 0, ATTENTION: 0, CLOSED: 0 } as Record<string, number>;
    filteredUnits.forEach(u => { const s = statusOf(u); if (s in statusCounts) statusCounts[s]++; });
    const activeUnits = filteredUnits.filter(u => u.status === 'active');
    const overallRate = activeUnits.length > 0 ? Math.round((statusCounts.COMPLIANCE / activeUnits.length) * 100) : 0;
    const expiringSoon = filteredUnits.filter(u => statusOf(u) === 'PARTIAL').length;

    const corpData = entities.filter(e => e.type === 'corporate').map(corp => {
      const corpUnits = filteredUnits.filter(u => findAncestorByType(u, 'corporate', entities)?.id === corp.id);
      if (!corpUnits.length) return null;
      const counts = { COMPLIANCE: 0, PARTIAL: 0, ATTENTION: 0, CLOSED: 0 } as Record<string, number>;
      corpUnits.forEach(u => { const s = statusOf(u); if (s in counts) counts[s]++; });
      const rate = corpUnits.length > 0 ? Math.round((counts.COMPLIANCE / corpUnits.length) * 100) : 0;
      return { id: corp.id, name: corp.name.length > 14 ? corp.name.slice(0, 14) + '…' : corp.name, fullName: corp.name, total: corpUnits.length, rate, ...counts };
    }).filter(Boolean) as any[];

    const regionData = entities.filter(e => e.type === 'regional').map(reg => {
      const regUnits = filteredUnits.filter(u => u.parentId === reg.id);
      if (!regUnits.length) return null;
      const counts = { Compliant: 0, Partial: 0, Attention: 0, Closed: 0 };
      regUnits.forEach(u => {
        const s = statusOf(u);
        if (s === 'COMPLIANCE') counts.Compliant++;
        else if (s === 'PARTIAL') counts.Partial++;
        else if (s === 'ATTENTION') counts.Attention++;
        else counts.Closed++;
      });
      return { id: reg.id, name: reg.name.length > 12 ? reg.name.slice(0, 12) + '…' : reg.name, fullName: reg.name, total: regUnits.length, ...counts };
    }).filter(Boolean) as any[];

    const processUploads = (data: any) => {
      if (!data || data.isApplicable === false) return null;
      const uploads = data.uploads as any[] | undefined;
      if (!uploads?.length) return 'notUploaded';
      const latest = uploads[uploads.length - 1];
      if (!latest?.expiryDate) return 'notUploaded';
      const days = (new Date(latest.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days < 0) return 'expired';
      if (days < 60) return 'expiring';
      return 'valid';
    };

    const topicData = schema.filter(cat => cat.active && canViewItem(cat, currentScope, userRootId, entities)).map(cat => {
      const activeSubs = cat.subs.filter(s => s.active && canViewItem(s, currentScope, userRootId, entities));
      let valid = 0, expiring = 0, expired = 0, notUploaded = 0;
      filteredUnits.forEach(u => {
        activeSubs.forEach(sub => {
          const m = (u.metrics?.[cat.id] || []).find((x: Metric) => x.subId === sub.id);
          // Explicitly OFF → skip
          if (m?.isApplicable === false) return;
          // No metric stored → ON by default, count slots as not uploaded
          if (!m) {
            notUploaded += (sub.subSubs?.length > 0) ? sub.subSubs.length : 1;
            return;
          }
          if (m.isComplex && m.variations) {
            const subSubs = sub.subSubs || [];
            if (subSubs.length > 0) {
              subSubs.forEach((ss: any) => {
                const v = m.variations?.[ss.id];
                if (v?.isApplicable === false) return;
                const r = processUploads(v);
                if (r === 'valid') valid++; else if (r === 'expiring') expiring++; else if (r === 'expired') expired++; else notUploaded++;
              });
            } else {
              Object.values(m.variations).forEach((v: any) => {
                const r = processUploads(v);
                if (r === 'valid') valid++; else if (r === 'expiring') expiring++; else if (r === 'expired') expired++; else notUploaded++;
              });
            }
          } else {
            const r = processUploads(m);
            if (r === 'valid') valid++; else if (r === 'expiring') expiring++; else if (r === 'expired') expired++; else if (r === 'notUploaded') notUploaded++;
          }
        });
      });
      const total = valid + expiring + expired + notUploaded;
      const rate = total > 0 ? Math.round((valid / total) * 100) : 0;
      return { id: cat.id, name: cat.name.length > 16 ? cat.name.slice(0, 16) + '…' : cat.name, fullName: cat.name, valid, expiring, expired, notUploaded, total, rate };
    }).filter(t => t.total > 0);

    const pieData = [
      { name: 'Compliant', value: statusCounts.COMPLIANCE, color: '#10b981', status: 'COMPLIANCE' },
      { name: 'Expiring Soon', value: statusCounts.PARTIAL, color: '#f59e0b', status: 'PARTIAL' },
      { name: 'Attention', value: statusCounts.ATTENTION, color: '#ef4444', status: 'ATTENTION' },
      { name: 'Closed', value: statusCounts.CLOSED, color: '#94a3b8', status: 'CLOSED' },
    ].filter(d => d.value > 0);

    // Unit-wise compliance data (for regional view)
    const unitData = filteredUnits.map(u => {
      const s = statusOf(u);
      const reg = findAncestorByType(u, 'regional', entities);
      return {
        id: u.id,
        name: u.name.length > 14 ? u.name.slice(0, 14) + '…' : u.name,
        fullName: u.name,
        regionName: reg?.name || '',
        Compliant: s === 'COMPLIANCE' ? 1 : 0,
        Partial: s === 'PARTIAL' ? 1 : 0,
        Attention: s === 'ATTENTION' ? 1 : 0,
        Closed: s === 'CLOSED' ? 1 : 0,
        status: s,
      };
    });

    return { overallRate, expiringSoon, statusCounts, corpData, regionData, topicData, pieData, unitData, totalUnits: filteredUnits.length, activeUnits: activeUnits.length };
  }, [filteredUnits, entities, schema, currentScope, userRootId]);

  const toggleCol = (id: string) => {
    const newSet = new Set(expandedCols);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedCols(newSet);
  };
  const toggleSubCol = (id: string) => {
    const newSet = new Set(expandedSubCols);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedSubCols(newSet);
  };

  const handleRefresh = () => {
    setFilters({ corp: '', region: '', unit: '', status: '', topic: '', subtopic: '', selectedUnitIds: [] });
    setSearch('');
  };

  const updateMetric = (unitId: string, catId: string, subId: string, newData: Partial<Metric>, subSubId?: string) => {
    const unit = entities.find(u => u.id === unitId);
    if(!unit) return;

    const newMetrics = { ...(unit.metrics || {}) };
    if (!newMetrics[catId]) newMetrics[catId] = [];

    let metricIndex = newMetrics[catId].findIndex((m: Metric) => m.subId === subId);
    
    if (metricIndex === -1) {
        const subDef = schema.find(c => c.id === catId)?.subs.find(s => s.id === subId);
        if(!subDef) return;
        
        const newM: Metric = { 
          subId, 
          name: subDef.name, 
          isApplicable: true,
          date: null,
          fileName: null 
        };

        if (subDef.subSubs && subDef.subSubs.length > 0) {
           newM.isComplex = true;
           newM.variations = {};
           newM.activeSubSubId = subSubId || subDef.subSubs[0].id;
           subDef.subSubs.forEach(ss => {
             if(newM.variations) newM.variations[ss.id] = { isApplicable: true, date: null, fileName: null };
           });
        }
        newMetrics[catId] = [...newMetrics[catId], newM];
        metricIndex = newMetrics[catId].length - 1;
    }

    const metric = { ...newMetrics[catId][metricIndex] };
    
    if (subSubId) {
        if (!metric.variations) {
             metric.variations = {};
             metric.isComplex = true;
        }
        
        if (!metric.variations[subSubId]) {
             metric.variations[subSubId] = { isApplicable: true, date: null, fileName: null };
        }
        
        metric.variations = {
          ...metric.variations,
          [subSubId]: { ...metric.variations[subSubId], ...newData }
        };
        
        if(newData.activeSubSubId) {
            metric.activeSubSubId = subSubId;
        }
    } else {
        Object.assign(metric, newData);
    }
    
    newMetrics[catId][metricIndex] = metric;
    onUpdateEntity({ ...unit, metrics: newMetrics });
  };

  const prepareCommonData = () => {
    if (filteredUnits.length === 0) {
      alert("No data available to export.");
      return null;
    }
    return filteredUnits;
  };

  const handleExportUnitDetail = () => {
    const units = prepareCommonData();
    if (!units) return;
    const exportData = units.map(unit => {
      const corpName = getAncestorName(unit, 'corporate');
      const regionName = getAncestorName(unit, 'regional');
      const complianceStatus = getUnitComplianceStatus(unit, schema);
      const row: Record<string, string | number> = { "Unit ID": unit.id, "Unit Name": unit.name, "Corporate": corpName, "Region": regionName, "Overall Status": complianceStatus };
      schema.forEach(cat => {
         if (!cat.active) return;
         cat.subs.forEach(sub => {
            const metric = (unit.metrics?.[cat.id] || []).find((x: Metric) => x.subId === sub.id);
            if (!metric || !metric.isApplicable) { row[`${cat.name} - ${sub.name}`] = "N/A"; } else {
               if (metric.isComplex && metric.variations) {
                  Object.entries(metric.variations).forEach(([varKey, varData]: [string, any]) => {
                     const ssInfo = getLicenseInfo(unit.id, sub.id, { ...metric, variations: undefined, ...varData, isComplex: false });
                     const ssName = sub.subSubs?.find(s => s.id === varKey)?.name || varKey;
                     row[`${cat.name} - ${sub.name} - ${ssName}`] = formatStandardString(ssInfo);
                  });
               } else {
                  const info = getLicenseInfo(unit.id, sub.id, metric);
                  row[`${cat.name} - ${sub.name}`] = formatStandardString(info);
               }
            }
         });
      });
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Unit Details");
    XLSX.writeFile(workbook, `Unit_Detail_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setExportMenuOpen(false);
  };

  const handleExportTopicSummary = () => {
    const units = prepareCommonData();
    if (!units) return;
    const summaryData = schema.map(cat => {
        if (!cat.active) return null;
        let totalUnits = 0; let compliantCount = 0; let attentionCount = 0; let naCount = 0;
        units.forEach(u => {
            if (u.status !== 'active') return;
            totalUnits++;
            let catStatus = 'COMPLIANCE';
            {
                const metrics = u.metrics?.[cat.id] || [];
                const hasAttention = metrics.some((m:Metric) => {
                    if(!m.isApplicable) return false;
                    const info = getLicenseInfo(u.id, m.subId, m);
                    return info.status === 'Expired' || info.status === 'Not Uploaded';
                });
                if (hasAttention) catStatus = 'ATTENTION';
            }
            if (catStatus === 'COMPLIANCE') compliantCount++; else if (catStatus === 'ATTENTION') attentionCount++; else naCount++;
        });
        return { "Topic Name": cat.name, "Total Active Units": totalUnits, "Compliant": compliantCount, "Attention Required": attentionCount, "Compliance %": totalUnits > 0 ? `${Math.round((compliantCount / totalUnits) * 100)}%` : '0%' };
    }).filter(Boolean);
    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Topic Summary");
    XLSX.writeFile(workbook, `Topic_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setExportMenuOpen(false);
  };

  const handleExportTopicMultiSheet = () => {
    const units = prepareCommonData();
    if (!units) return;
    const workbook = XLSX.utils.book_new();
    schema.forEach(cat => {
        if (!cat.active) return;
        const sheetData = units.map(unit => {
            const row: Record<string, any> = { "Unit ID": unit.id, "Unit Name": unit.name, "Region": getAncestorName(unit, 'regional'), "Overall Status": unit.status === 'active' ? getUnitComplianceStatus(unit, schema) : 'CLOSED' };
            {
                cat.subs.forEach(sub => {
                    const metric = (unit.metrics?.[cat.id] || []).find((x: Metric) => x.subId === sub.id);
                    if (!metric || !metric.isApplicable) { row[`${sub.name}`] = "N/A"; } else {
                        if (metric.isComplex && metric.variations) {
                            Object.entries(metric.variations).forEach(([varKey, varData]: [string, any]) => {
                               const ssInfo = getLicenseInfo(unit.id, sub.id, { ...metric, variations: undefined, ...varData, isComplex: false });
                               const ssName = sub.subSubs?.find(s => s.id === varKey)?.name || varKey;
                               row[`${sub.name} - ${ssName}`] = formatStandardString(ssInfo);
                            });
                        } else { const info = getLicenseInfo(unit.id, sub.id, metric); row[`${sub.name}`] = formatStandardString(info); }
                    }
                });
            }
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        const sheetName = cat.name.replace(/[\[\]\*\/\\\?]/g, '').substring(0, 31); 
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    XLSX.writeFile(workbook, `Topic_Wise_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setExportMenuOpen(false);
  };

  const getEditingItemData = () => {
    if (!editingItem) return {};
    const unit = entities.find(u => u.id === editingItem.unitId);
    const metricList = unit?.metrics?.[editingItem.catId] || [];
    const metric = metricList.find((m: any) => m.subId === editingItem.subId);
    
    let currentData = metric;
    if (editingItem.subSubId) {
        if (metric?.variations && metric.variations[editingItem.subSubId]) {
            currentData = metric.variations[editingItem.subSubId];
        } else if (metric && !metric.isComplex) {
            currentData = metric; 
        }
    }
    return currentData || {};
  };

  return (
    <div className="font-sans text-slate-800 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          
          {/* Mobile Row 1: Action Buttons (Scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 hide-scrollbar w-full md:w-auto">
            <button onClick={() => setActiveModal('schema')} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm whitespace-nowrap shrink-0">
              <Settings size={14} /> Config
            </button>
            
            <button onClick={() => setActiveModal('hierarchy')} className={clsx("flex items-center gap-2 border px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm whitespace-nowrap shrink-0", filters.selectedUnitIds.length > 0 || filters.corp || filters.region ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")}>
              <Filter size={14} /> Hierarchy Filter 
              {filters.selectedUnitIds.length > 0 && (
                  <span className="bg-blue-600 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full ml-1 shadow-sm">{filters.selectedUnitIds.length}</span>
              )}
            </button>

            <button onClick={() => setActiveModal('topic')} className={clsx("flex items-center gap-2 border px-3 py-2 rounded-lg text-xs font-bold transition shadow-sm whitespace-nowrap shrink-0", filters.topic ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50")}>
               <ListFilter size={14} /> Topics <span className={`w-2 h-2 rounded-full bg-blue-500 ${filters.topic ? 'block' : 'hidden'}`}></span>
            </button>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

          {/* Mobile Rows 2 & 3: Search and Actions */}
          <div className="flex flex-col md:flex-row items-center gap-3 flex-1 justify-end w-full md:w-auto">
            
            {/* Search Bar - Full width on mobile */}
            <div className="relative group w-full md:w-48 lg:w-64">
              <Search size={14} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Quick Unit Search..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status, Refresh, Export - Flex row on mobile */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select 
                className="flex-1 md:flex-none md:w-32 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white outline-none cursor-pointer hover:border-slate-300 transition-colors"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All Statuses</option>
                <option value="COMPLIANCE">Compliance</option>
                <option value="PARTIAL">Partial</option>
                <option value="ATTENTION">Attention</option>
                <option value="CLOSED">Closed</option>
              </select>

              <button onClick={handleRefresh} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold transition shrink-0" title="Reset Filters">
                <RefreshCw size={14} />
              </button>

              <div className="relative shrink-0" ref={dropdownRef}>
                <button 
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="flex items-center gap-2 bg-[#107c41] hover:bg-[#0b5c30] text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition shadow-md active:translate-y-0.5"
                >
                  <FileSpreadsheet size={14} /> <span className="hidden sm:inline">Export</span> <ChevronDown size={12} className={clsx("transition-transform", exportMenuOpen && "rotate-180")} />
                </button>
                {exportMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 p-1">
                        <div className="py-1">
                            <button onClick={handleExportUnitDetail} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 group transition-colors">
                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded group-hover:bg-blue-100"><Table2 size={16}/></div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-700">Unit Detail Report</span>
                                    <span className="block text-[9px] font-medium text-slate-400">Full detailed list</span>
                                </div>
                            </button>
                            <button onClick={handleExportTopicSummary} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 group transition-colors border-t border-slate-50">
                                <div className="p-1.5 bg-purple-50 text-purple-600 rounded group-hover:bg-purple-100"><FileBarChart size={16}/></div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-700">Topic Summary Report</span>
                                    <span className="block text-[9px] font-medium text-slate-400">High-level stats</span>
                                </div>
                            </button>
                            <button onClick={handleExportTopicMultiSheet} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 group transition-colors border-t border-slate-50">
                                <div className="p-1.5 bg-orange-50 text-orange-600 rounded group-hover:bg-orange-100"><Layers size={16}/></div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-700">Topic-wise (Multi-Sheet)</span>
                                    <span className="block text-[9px] font-medium text-slate-400">One sheet per topic</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- ANALYTICS DASHBOARD --- */}
      {(() => {
        const { overallRate, statusCounts, corpData, regionData, topicData, pieData, unitData, totalUnits, activeUnits, expiringSoon } = analyticsData;
        const isCorporateView = currentScope === 'super-admin' || currentScope === 'corporate';
        const isRegionalView = currentScope === 'regional';
        const isUnitView = currentScope === 'unit';

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs max-w-[220px]">
              <p className="font-bold text-slate-700 mb-1.5">{payload[0]?.payload?.fullName || label}</p>
              {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.fill || p.color }} className="font-semibold">{p.name}: {p.value}</p>
              ))}
            </div>
          );
        };
        const PieTooltip = ({ active, payload }: any) => {
          if (!active || !payload?.length) return null;
          const d = payload[0];
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
              <p className="font-bold" style={{ color: d.payload.color }}>{d.name}</p>
              <p className="text-slate-600">{d.value} units</p>
            </div>
          );
        };
        const ChartCard = ({ title, dot, children, hint, clearKey, onClear }: any) => (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full inline-block ${dot}`} />{title}
              {onClear && <button onClick={onClear} className="ml-auto text-[9px] text-slate-400 hover:text-red-500 font-bold">Clear</button>}
            </h3>
            {children}
            {hint && <p className="text-[9px] text-slate-400 text-center mt-1">{hint}</p>}
          </div>
        );
        const StackedRegionBar = ({ data, height = 160, onBarClick }: any) => (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} onClick={(d) => onBarClick && d?.activePayload?.[0]?.payload?.id && onBarClick(d.activePayload[0].payload.id)} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span>} />
              <Bar dataKey="Compliant" stackId="a" fill="#10b981" />
              <Bar dataKey="Partial" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Attention" stackId="a" fill="#ef4444" />
              <Bar dataKey="Closed" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
        const RateBar = ({ data, height = 200, labelKey = 'name', dataKey = 'rate', onBarClick }: any) => (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} onClick={(d) => onBarClick && d?.activePayload?.[0]?.payload?.id && onBarClick(d.activePayload[0].payload.id)} style={{ cursor: 'pointer' }} margin={{ bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={labelKey} tick={{ fontSize: 9, fontWeight: 700 }} angle={-45} textAnchor="end" height={100} />
              <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={dataKey} name="Compliance %" radius={[4, 4, 0, 0]}>
                {data.map((entry: any, index: number) => (
                  <Cell key={index} fill={entry[dataKey] >= 80 ? '#10b981' : entry[dataKey] >= 50 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

        // Compute unit-wise rate for bar chart (for regional view)
        const unitRateData = unitData.map((u: any) => ({
          ...u,
          rate: u.Compliant === 1 ? 100 : u.Attention === 1 ? 0 : u.Partial === 1 ? 50 : 0,
        }));

        return (
          <div className="space-y-4">
            {/* KPI Row — always shown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Units', value: totalUnits, sub: `${activeUnits} active`, color: 'from-blue-500 to-blue-600', icon: '🏢', onClick: () => setFilters(f => ({ ...f, status: '' })) },
                { label: 'Compliance Rate', value: `${overallRate}%`, sub: `${statusCounts.COMPLIANCE} fully compliant`, color: overallRate >= 80 ? 'from-emerald-500 to-emerald-600' : overallRate >= 50 ? 'from-amber-400 to-amber-500' : 'from-red-500 to-red-600', icon: overallRate >= 80 ? '✅' : overallRate >= 50 ? '⚠️' : '❌', onClick: () => setFilters(f => ({ ...f, status: 'COMPLIANCE' })) },
                { label: 'Needs Attention', value: statusCounts.ATTENTION, sub: 'expired or not uploaded', color: 'from-red-500 to-red-600', icon: '🚨', onClick: () => setFilters(f => ({ ...f, status: 'ATTENTION' })) },
                { label: 'Expiring Soon', value: expiringSoon, sub: 'within 60 days', color: 'from-amber-400 to-amber-500', icon: '⏰', onClick: () => setFilters(f => ({ ...f, status: 'PARTIAL' })) },
              ].map((kpi, i) => (
                <button key={i} onClick={kpi.onClick} className={`bg-gradient-to-br ${kpi.color} rounded-xl p-4 text-white text-left shadow-md hover:shadow-lg hover:scale-[1.02] transition-all`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-1">{kpi.label}</p>
                      <p className="text-2xl font-black">{kpi.value}</p>
                      <p className="text-[10px] text-white/70 mt-1">{kpi.sub}</p>
                    </div>
                    <span className="text-2xl opacity-80">{kpi.icon}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* CORPORATE VIEW: Overall Compliance + Regional Comparison */}
            {isCorporateView && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Overall Compliance Donut */}
                <ChartCard title="Overall Compliance" dot="bg-purple-500" clearKey={filters.status} onClear={filters.status ? () => setFilters(f => ({ ...f, status: '' })) : undefined} hint="Click segment to filter by status">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart onClick={(d: any) => { const status = d?.activePayload?.[0]?.payload?.status; if (status) setFilters(f => ({ ...f, status: f.status === status ? '' : status })); }} style={{ cursor: 'pointer' }}>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                          {pieData.map((entry: any, index: number) => (
                            <Cell key={index} fill={entry.color} stroke={filters.status === entry.status ? '#1e293b' : 'transparent'} strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs">No data</div>}
                </ChartCard>

                {/* Regional Comparison — stacked */}
                {regionData.length > 0 && (
                  <div className="lg:col-span-2">
                    <ChartCard title="Regional Compliance Comparison" dot="bg-indigo-500" onClear={filters.region ? () => setFilters(f => ({ ...f, region: '' })) : undefined} hint="Click bar to filter by region">
                      <StackedRegionBar data={regionData} height={180} onBarClick={(id: string) => setFilters(f => ({ ...f, region: id }))} />
                    </ChartCard>
                  </div>
                )}
              </div>
            )}

            {/* REGIONAL VIEW: Combined Corporate + Regional graph */}
            {isRegionalView && (corpData.length > 0 || regionData.length > 0) && (
              <ChartCard title="Corporate & Regional Compliance Comparison" dot="bg-blue-500">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[...corpData, ...regionData]} margin={{ bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rate" name="Compliance %" radius={[4, 4, 0, 0]}>
                      {[...corpData, ...regionData].map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* UNIT VIEW: Combined Corporate + Regional + Unit-wise graph */}
            {isUnitView && (corpData.length > 0 || regionData.length > 0 || unitRateData.length > 0) && (
              <ChartCard title="Corporate, Regional & Unit Compliance Comparison" dot="bg-purple-500">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[...corpData, ...regionData, ...unitRateData]} margin={{ bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rate" name="Compliance %" radius={[4, 4, 0, 0]}>
                      {[...corpData, ...regionData, ...unitRateData].map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* ALWAYS: Topic Compliance + Status pie (when not corporate/regional/unit specific) */}
            {!isCorporateView && !isRegionalView && !isUnitView && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Status Distribution" dot="bg-purple-500" onClear={filters.status ? () => setFilters(f => ({ ...f, status: '' })) : undefined} hint="Click segment to filter">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart onClick={(d: any) => { const s = d?.activePayload?.[0]?.payload?.status; if (s) setFilters(f => ({ ...f, status: f.status === s ? '' : s })); }} style={{ cursor: 'pointer' }}>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                          {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip content={<PieTooltip />} /><Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="h-[180px] flex items-center justify-center text-slate-400 text-xs">No data</div>}
                </ChartCard>
                {regionData.length > 0 && (
                  <ChartCard title="Regional Breakdown" dot="bg-indigo-500" hint="Click to filter">
                    <StackedRegionBar data={regionData} height={180} onBarClick={(id: string) => setFilters(f => ({ ...f, region: id }))} />
                  </ChartCard>
                )}
              </div>
            )}

            {/* Topic Compliance — always shown */}
            {topicData.length > 0 && (
              <ChartCard title="Topic Compliance Breakdown" dot="bg-orange-500" onClear={filters.topic ? () => setFilters(f => ({ ...f, topic: '', subtopic: '' })) : undefined} hint="Click bar to filter by topic">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicData} onClick={(d) => { if (d?.activePayload?.[0]?.payload?.id) setFilters(f => ({ ...f, topic: d.activePayload[0].payload.id, subtopic: '' })); }} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, fontWeight: 700 }}>{v}</span>} />
                    <Bar dataKey="valid" name="Valid" stackId="t" fill="#10b981" />
                    <Bar dataKey="expiring" name="Expiring" stackId="t" fill="#f59e0b" />
                    <Bar dataKey="expired" name="Expired" stackId="t" fill="#ef4444" />
                    <Bar dataKey="notUploaded" name="Not Uploaded" stackId="t" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Active Filters Summary */}
            {(filters.corp || filters.region || filters.status || filters.topic || filters.selectedUnitIds.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Filtered:</span>
                {filters.corp && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{analyticsData.corpData.find((c: any) => c.id === filters.corp)?.fullName || 'Corporate'}</span>}
                {filters.region && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">{analyticsData.regionData.find((r: any) => r.id === filters.region)?.fullName || 'Region'}</span>}
                {filters.status && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">{filters.status}</span>}
                {filters.topic && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold">{analyticsData.topicData.find((t: any) => t.id === filters.topic)?.fullName || 'Topic'}</span>}
                {filters.selectedUnitIds.length > 0 && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-bold">{filters.selectedUnitIds.length} unit{filters.selectedUnitIds.length > 1 ? 's' : ''}</span>}
                <button onClick={() => setFilters(f => ({ ...f, corp: '', region: '', status: '', topic: '', subtopic: '', selectedUnitIds: [] }))} className="text-xs text-red-500 hover:underline font-bold ml-auto">✕ Clear all</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- TOPIC SUMMARY CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {schema.filter(cat => cat.active && canViewItem(cat, currentScope, userRootId, entities)).map(cat => {
          const activeSubs = cat.subs.filter(s => s.active && canViewItem(s, currentScope, userRootId, entities));
          if (activeSubs.length === 0) return null;

          const subAnalytics = activeSubs.map(sub => {
            let worstStatus: 'valid' | 'expiring' | 'expired' | 'no-data' = 'no-data';
            let criticalDate: string | null = null;
            let earliestValidExpiry: string | null = null;
            let earliestExpiringDate: string | null = null;
            let earliestExpiredDate: string | null = null;
            let totalUploads = 0;
            let validCount = 0;
            let expiringCount = 0;
            let expiredCount = 0;

            filteredUnits.forEach(u => {
              if (u.status !== 'active') return;
              const metrics = u.metrics?.[cat.id] || [];
              const m = metrics.find((x: Metric) => x.subId === sub.id);
              if (!m || m.isApplicable === false) return;

              const processDate = (dateStr: string | null | undefined, isFromUpload: boolean) => {
                if (!dateStr) return;
                const expDate = new Date(dateStr);
                const now = new Date();
                const daysLeft = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                totalUploads++;

                if (daysLeft < 0) {
                  expiredCount++;
                  if (!earliestExpiredDate || dateStr < earliestExpiredDate) earliestExpiredDate = dateStr;
                } else if (daysLeft < 60) {
                  expiringCount++;
                  if (!earliestExpiringDate || dateStr < earliestExpiringDate) earliestExpiringDate = dateStr;
                } else {
                  validCount++;
                  if (!earliestValidExpiry || dateStr < earliestValidExpiry) earliestValidExpiry = dateStr;
                }
              };

              if (m.isComplex && m.variations) {
                Object.values(m.variations).forEach((v: any) => {
                  if (v.isApplicable === false) return;
                  const uploads = v.uploads as any[] | undefined;
                  if (uploads?.length) {
                    const latest = uploads[uploads.length - 1];
                    if (latest?.expiryDate) processDate(latest.expiryDate, true);
                  } else if (v.date) {
                    const issue = new Date(v.date);
                    const exp = new Date(issue); exp.setFullYear(issue.getFullYear() + 1);
                    processDate(exp.toISOString().split('T')[0], false);
                  }
                });
              } else {
                const uploads = (m as any).uploads as any[] | undefined;
                if (uploads?.length) {
                  const latest = uploads[uploads.length - 1];
                  if (latest?.expiryDate) processDate(latest.expiryDate, true);
                } else if (m.date) {
                  const issue = new Date(m.date);
                  const exp = new Date(issue); exp.setFullYear(issue.getFullYear() + 1);
                  processDate(exp.toISOString().split('T')[0], false);
                }
              }
            });

            if (expiredCount > 0) {
              worstStatus = 'expired';
              criticalDate = earliestExpiredDate;
            } else if (expiringCount > 0) {
              worstStatus = 'expiring';
              criticalDate = earliestExpiringDate;
            } else if (validCount > 0) {
              worstStatus = 'valid';
              criticalDate = earliestValidExpiry;
            }

            return { name: sub.name, id: sub.id, worstStatus, criticalDate, totalUploads, validCount, expiringCount, expiredCount };
          });

          const topicExpired = subAnalytics.reduce((s, a) => s + a.expiredCount, 0);
          const topicExpiring = subAnalytics.reduce((s, a) => s + a.expiringCount, 0);
          const topicValid = subAnalytics.reduce((s, a) => s + a.validCount, 0);
          const topicTotal = topicExpired + topicExpiring + topicValid;
          const complianceRate = topicTotal > 0 ? Math.round((topicValid / topicTotal) * 100) : 0;
          const topicStatus = topicExpired > 0 ? 'expired' : topicExpiring > 0 ? 'expiring' : topicValid > 0 ? 'valid' : 'no-data';

          const statusConfig = {
            expired: { border: 'border-red-200', bg: 'bg-red-50', accent: 'bg-red-500', text: 'text-red-700', label: 'EXPIRED', icon: <AlertTriangle size={14} className="text-red-500" /> },
            expiring: { border: 'border-amber-200', bg: 'bg-amber-50', accent: 'bg-amber-400', text: 'text-amber-700', label: 'DUE SOON', icon: <AlertTriangle size={14} className="text-amber-500" /> },
            valid: { border: 'border-emerald-200', bg: 'bg-emerald-50', accent: 'bg-emerald-500', text: 'text-emerald-700', label: 'COMPLIANT', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
            'no-data': { border: 'border-slate-200', bg: 'bg-slate-50', accent: 'bg-slate-300', text: 'text-slate-500', label: 'NO DATA', icon: <FileText size={14} className="text-slate-400" /> }
          };
          const cfg = statusConfig[topicStatus];

          return (
            <div key={cat.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  {cfg.icon}
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide truncate">{cat.name}</h3>
                </div>
                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${topicStatus === 'expired' ? 'bg-red-50 text-red-600 border border-red-200' : topicStatus === 'expiring' ? 'bg-amber-50 text-amber-600 border border-amber-200' : topicStatus === 'valid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>{cfg.label}</span>
              </div>

              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Compliance</span>
                  <span className="text-sm font-extrabold text-slate-800 ml-auto">{complianceRate}%</span>
                  <div className="flex gap-1.5 shrink-0">
                    {topicValid > 0 && <span className="text-[9px] font-extrabold bg-emerald-500 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{topicValid}</span>}
                    {topicExpiring > 0 && <span className="text-[9px] font-extrabold bg-amber-400 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{topicExpiring}</span>}
                    {topicExpired > 0 && <span className="text-[9px] font-extrabold bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{topicExpired}</span>}
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                  {topicTotal > 0 && (<>
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${(topicValid / topicTotal) * 100}%` }} />
                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${(topicExpiring / topicTotal) * 100}%` }} />
                    <div className="bg-red-500 h-full transition-all" style={{ width: `${(topicExpired / topicTotal) * 100}%` }} />
                  </>)}
                </div>
              </div>

              <div className="bg-white">
                {subAnalytics.map((sa, idx) => {
                  const subCfg = statusConfig[sa.worstStatus];
                  const formatDate = (d: string | null) => {
                    if (!d) return '-';
                    const date = new Date(d);
                    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  };
                  const daysUntil = (d: string | null) => {
                    if (!d) return null;
                    const days = Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return days;
                  };
                  const days = daysUntil(sa.criticalDate);
                  const totalSub = sa.validCount + sa.expiringCount + sa.expiredCount;

                  return (
                    <div key={sa.id} className={`px-5 py-3 flex items-start gap-3 ${idx < subAnalytics.length - 1 ? 'border-b border-slate-50' : ''}`}>
                      <div className={`w-2 h-2 rounded-full ${subCfg.accent} shrink-0 mt-1`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-slate-800 uppercase">{sa.name}</p>
                        {sa.worstStatus !== 'no-data' && sa.criticalDate ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[11px] font-semibold ${subCfg.text}`}>
                              {sa.worstStatus === 'expired' ? 'Expired' : sa.worstStatus === 'expiring' ? 'Due Soon' : 'Next Expiry'}: {formatDate(sa.criticalDate)}
                            </span>
                            {days !== null && (
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${days < 0 ? 'bg-red-100 text-red-600' : days < 60 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">No uploads</p>
                        )}
                      </div>
                      {totalSub > 0 && (
                        <div className="flex gap-1.5 shrink-0 mt-0.5">
                          {sa.validCount > 0 && <span className="text-[9px] font-extrabold bg-emerald-500 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{sa.validCount}</span>}
                          {sa.expiringCount > 0 && <span className="text-[9px] font-extrabold bg-amber-400 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{sa.expiringCount}</span>}
                          {sa.expiredCount > 0 && <span className="text-[9px] font-extrabold bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm">{sa.expiredCount}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[70vh]">
        <div className="overflow-y-auto overflow-x-auto relative custom-scrollbar flex-1">
          <table className="border-collapse table-auto w-max min-w-full">
            <thead className="bg-[#1e293b] text-white sticky top-0 z-20">
              {(() => {
                const getSubColCount = (sub: any) => {
                    const ssItems = (sub.subSubs || []).filter((ss: any) => ss);
                    if (ssItems.length === 0) return 1;
                    if (expandedSubCols.has(sub.id)) return Math.max(1, ssItems.length);
                    return 1;
                };
                const getTopicColCount = (cat: any, activeSubs: any[]) => {
                    const isExp = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                    if (!isExp) return 1;
                    if (activeSubs.length === 0) return 1;
                    return activeSubs.reduce((sum: number, s: any) => sum + getSubColCount(s), 0);
                };
                const hasAnySubSubRow = schema.some(cat => {
                    if (!cat.active) return false;
                    if (!canViewItem(cat, currentScope, userRootId, entities)) return false;
                    if (filters.topic && cat.id !== filters.topic) return false;
                    const isExp = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                    if (!isExp) return false;
                    const activeSubs = cat.subs.filter(s => s.active && (!filters.subtopic || s.id === filters.subtopic) && canViewItem(s, currentScope, userRootId, entities));
                    return activeSubs.some(s => (s.subSubs || []).length > 0 && expandedSubCols.has(s.id));
                });
                const headerRows = hasAnySubSubRow ? 3 : 2;
                return (
                  <>
                  <tr>
                    <th rowSpan={headerRows} className="sticky left-0 z-30 bg-[#1e293b] border-r border-slate-600 text-left p-2.5 min-w-[180px] w-[180px] text-xs font-black uppercase tracking-wider shadow-[4px_0_8px_rgba(0,0,0,0.15)]">Unit Details</th>
                    {schema.map(cat => {
                       if(!cat.active) return null;
                       if(!canViewItem(cat, currentScope, userRootId, entities)) return null;
                       if(filters.topic && cat.id !== filters.topic) return null;
                       const hasSubs = cat.subs.length > 0;
                       if(!hasSubs) return null;
                       const activeSubs = cat.subs.filter(s => s.active && (!filters.subtopic || s.id === filters.subtopic) && canViewItem(s, currentScope, userRootId, entities));
                       if(activeSubs.length === 0) return null;
                       const isExpanded = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                       const topicCols = getTopicColCount(cat, activeSubs);
                       return (
                         <th key={cat.id} colSpan={topicCols} onClick={() => toggleCol(cat.id)} className="cursor-pointer select-none bg-[#334155] hover:bg-[#475569] border-r border-slate-600 p-2 text-center whitespace-nowrap transition-colors text-xs font-bold uppercase min-w-[140px]">
                           <div className="flex items-center justify-center gap-2">
                               <ScopeBadge scope={cat.createdByScope} />
                               {cat.name} {isExpanded ? <MinusCircle size={12}/> : <PlusCircle size={12}/>}
                           </div>
                         </th>
                       );
                    })}
                  </tr>
                  <tr>
                     {schema.map(cat => {
                        if(!cat.active) return null;
                        if(!canViewItem(cat, currentScope, userRootId, entities)) return null;
                        if(filters.topic && cat.id !== filters.topic) return null;
                        const isExpanded = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                        const activeSubs = cat.subs.filter(s => s.active && (!filters.subtopic || s.id === filters.subtopic) && canViewItem(s, currentScope, userRootId, entities));
                        if(activeSubs.length === 0) return null;
                        if(!isExpanded) return <th key={`${cat.id}-summ`} rowSpan={hasAnySubSubRow ? 2 : 1} className="bg-[#f1f5f9] text-slate-600 border-r border-slate-300 p-2 text-xs font-bold uppercase min-w-[140px]">Summary</th>;
                        return activeSubs.map(sub => {
                            const ssItems = (sub.subSubs || []).filter((ss: any) => ss);
                            const isSubExp = expandedSubCols.has(sub.id) && ssItems.length > 0;
                            const subCols = getSubColCount(sub);
                            const needsRowSpan = !isSubExp && hasAnySubSubRow;
                            return (
                                <th key={sub.id} colSpan={subCols} rowSpan={needsRowSpan ? 2 : 1} onClick={ssItems.length > 0 ? () => toggleSubCol(sub.id) : undefined} className={`bg-[#1e293b] border-r border-slate-600 p-2 text-xs font-bold uppercase min-w-[140px] ${ssItems.length > 0 ? 'cursor-pointer hover:bg-[#334155] transition-colors' : ''}`}>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <ScopeBadge scope={sub.createdByScope} />
                                        {sub.name}
                                        {ssItems.length > 0 && (isSubExp ? <MinusCircle size={10} className="text-slate-400"/> : <PlusCircle size={10} className="text-slate-400"/>)}
                                    </div>
                                </th>
                            );
                        });
                     })}
                  </tr>
                  {hasAnySubSubRow && (
                  <tr>
                     {schema.map(cat => {
                        if(!cat.active) return null;
                        if(!canViewItem(cat, currentScope, userRootId, entities)) return null;
                        if(filters.topic && cat.id !== filters.topic) return null;
                        const isExpanded = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                        if(!isExpanded) return null;
                        const activeSubs = cat.subs.filter(s => s.active && (!filters.subtopic || s.id === filters.subtopic) && canViewItem(s, currentScope, userRootId, entities));
                        if(activeSubs.length === 0) return null;
                        return activeSubs.map(sub => {
                            const ssItems = (sub.subSubs || []).filter((ss: any) => ss);
                            const isSubExp = expandedSubCols.has(sub.id) && ssItems.length > 0;
                            if (!isSubExp) return null;
                            return ssItems.map((ss: any) => (
                                <th key={ss.id} className="bg-[#0f172a] border-r border-slate-700 p-1.5 text-xs font-bold uppercase min-w-[140px]">
                                    <div className="flex items-center justify-center gap-1">
                                        <ScopeBadge scope={sub.createdByScope} />
                                        {ss.name}
                                    </div>
                                </th>
                            ));
                        });
                     })}
                  </tr>
                  )}
                  </>
                );
              })()}
            </thead>
            <tbody>
              {filteredUnits.map(u => {
                const status = getUnitComplianceStatus(u, schema);
                const corpName = getAncestorName(u, 'corporate');
                const regName = getAncestorName(u, 'regional');

                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 p-2.5 shadow-[2px_0_5px_rgba(0,0,0,0.05)] align-top group-hover:bg-slate-50/80">
                      <UnitCellContent unit={u} corpName={corpName} regName={regName} status={status} />
                    </td>
                    {schema.map(cat => {
                        if(!cat.active) return null;
                        if(!canViewItem(cat, currentScope, userRootId, entities)) return null;

                        if(filters.topic && cat.id !== filters.topic) return null;
                        
                        const activeSubs = cat.subs.filter(s => s.active && (!filters.subtopic || s.id === filters.subtopic) && canViewItem(s, currentScope, userRootId, entities));
                        if(activeSubs.length === 0) return null;
                        const isExpanded = expandedCols.has(cat.id) || !!filters.topic || !!filters.subtopic;
                        
                        if (!isExpanded) {
                           return <td key={cat.id} className="border-b border-r border-slate-200 p-2 bg-[#f8fbff] align-top min-w-[140px]"><SummaryCell unit={u} catId={cat.id} subs={activeSubs} metrics={u.metrics?.[cat.id]} /></td>;
                        }
                        return activeSubs.map(sub => {
                           const m = (u.metrics?.[cat.id] || []).find((x: Metric) => x.subId === sub.id);
                           const ssItems = (sub.subSubs || []).filter((ss: any) => ss);
                           const isSubExp = expandedSubCols.has(sub.id) && ssItems.length > 0;
                           
                           if (isSubExp) {
                               return ssItems.map((ss: any) => {
                                   const varData = m?.variations?.[ss.id] || null;
                                   const info = getLicenseInfo(u.id, sub.id, ss.id ? { ...m, activeSubSubId: ss.id } : m);
                                   const uploads = varData?.uploads || [];
                                   const openPdf = (fileData: string) => { try { const bs = atob(fileData.split(',')[1]); const mt = fileData.split(',')[0].split(':')[1].split(';')[0]; const ab = new ArrayBuffer(bs.length); const ia = new Uint8Array(ab); for(let j=0;j<bs.length;j++) ia[j]=bs.charCodeAt(j); window.open(URL.createObjectURL(new Blob([ab], {type: mt})), '_blank'); } catch(e){} };
                                   const isVarActive = varData?.isApplicable !== false;
                                   return (
                                     <td key={`${sub.id}-${ss.id}`} className="border-b border-r border-slate-200 p-1.5 align-top bg-white group-hover:bg-slate-50/50 min-w-[140px]">
                                       <div className="space-y-1">
                                           {/* Status + Actions row */}
                                           <div className="flex items-center justify-between gap-1">
                                               <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isVarActive ? info.cls : 'bg-slate-100 text-slate-400'}`}>{isVarActive ? info.status : 'N/A'}</span>
                                               <div className="flex gap-0.5 shrink-0">
                                                   {isVarActive && <>
                                                   <button onClick={() => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId: ss.id, mode: 'upload'}); setUploadEntries([{id: Date.now().toString(), reportName: '', licenseNumber: '', generateDate: '', expiryDate: '', fileName: '', fileData: '', comments: '', file: null, collapsed: false}]); setActiveModal('renew'); }} className="p-0.5 text-blue-500 hover:text-blue-700 rounded" title="Upload"><Plus size={10}/></button>
                                                   <button onClick={() => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId: ss.id, mode: 'renew'}); setUploadEntries([{id: Date.now().toString(), reportName: '', licenseNumber: '', generateDate: '', expiryDate: '', fileName: '', fileData: '', comments: '', file: null, collapsed: false}]); setActiveModal('renew'); }} className="p-0.5 text-indigo-500 hover:text-indigo-700 rounded" title="Renew"><RefreshCw size={10}/></button>
                                                   <button onClick={() => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId: ss.id, mode: 'history'}); setActiveModal('history'); }} className="p-0.5 text-slate-400 hover:text-slate-600 rounded" title="History"><History size={10}/></button>
                                                   </>}
                                                   <button
                                                       onClick={() => updateMetric(u.id, cat.id, sub.id, { isApplicable: !isVarActive }, ss.id)}
                                                       title={isVarActive ? "Turn OFF — excludes from analytics" : "Turn ON — includes in analytics"}
                                                       className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-0.5 transition-colors ${
                                                           isVarActive
                                                               ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                               : 'bg-slate-300 text-slate-600 hover:bg-slate-400'
                                                       }`}
                                                   >
                                                       <Power size={8} />
                                                       {isVarActive ? 'ON' : 'OFF'}
                                                   </button>
                                               </div>
                                           </div>
                                           {/* Document cards — only shown when active */}
                                           {!isVarActive ? (
                                               <div className="text-[8px] text-slate-400 text-center py-2 italic bg-slate-50 rounded border border-dashed border-slate-200">Not counted in analytics</div>
                                           ) : uploads.length > 0 ? uploads.map((up: any, idx: number) => {
                                               const isExp = up.expiryDate && new Date(up.expiryDate) < new Date();
                                               const isExpiring = !isExp && up.expiryDate && (new Date(up.expiryDate).getTime() - new Date().getTime()) / (1000*60*60*24) < 60;
                                               return (
                                                   <div key={idx} className={`rounded px-1.5 py-1 border text-[9px] ${isExp ? 'bg-red-50 border-red-200' : isExpiring ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                                       <div className="font-bold text-slate-800 truncate">{up.licenseNumber || `Doc ${idx+1}`}</div>
                                                       <div className="flex gap-1.5 text-[8px] text-slate-500 mt-0.5">
                                                           {up.generateDate && <span>Gen: {up.generateDate}</span>}
                                                           {up.expiryDate && <span className={isExp ? 'text-red-600 font-bold' : ''}>{isExpiring ? '⏰' : ''} Exp: {up.expiryDate}</span>}
                                                       </div>
                                                       {up.fileName && (
                                                           <div className="mt-0.5">
                                                               {up.fileData ? <button onClick={() => openPdf(up.fileData)} className="text-blue-600 underline hover:text-blue-800 text-[8px] flex items-center gap-0.5 truncate"><FileText size={8}/>{up.fileName}</button> : <span className="flex items-center gap-0.5 text-[8px] truncate"><FileText size={8}/>{up.fileName}</span>}
                                                           </div>
                                                       )}
                                                   </div>
                                               );
                                           }) : (
                                               <div className="text-[8px] text-slate-400 text-center py-1 italic">No docs</div>
                                           )}
                                       </div>
                                     </td>
                                   );
                               });
                           }
                           
                           return (
                             <td key={sub.id} className="border-b border-r border-slate-200 p-2 align-top min-w-[200px] bg-white group-hover:bg-slate-50/50">
                               <StandardCell 
                                  unit={u} 
                                  sub={sub} 
                                  metric={m} 
                                  onUpdate={(subSubId: string, data: any) => updateMetric(u.id, cat.id, sub.id, data, subSubId)}
                                  onOpenRenew={(subSubId: string) => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId, mode: 'renew'}); setUploadEntries([{id: Date.now().toString(), reportName: '', licenseNumber: '', generateDate: '', expiryDate: '', fileName: '', fileData: '', comments: '', file: null, collapsed: false}]); setActiveModal('renew'); }}
                                  onOpenUpload={(subSubId: string) => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId, mode: 'upload'}); setUploadEntries([{id: Date.now().toString(), reportName: '', licenseNumber: '', generateDate: '', expiryDate: '', fileName: '', fileData: '', comments: '', file: null, collapsed: false}]); setActiveModal('renew'); }}
                                  onOpenHistory={(subSubId: string) => { setEditingItem({unitId: u.id, catId: cat.id, subId: sub.id, subSubId, mode: 'history'}); setActiveModal('history'); }}
                               />
                             </td>
                           );
                        });
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className={`bg-white rounded-3xl shadow-2xl w-full ${activeModal === 'history' || activeModal === 'hierarchy' ? 'max-w-5xl' : 'max-w-2xl'} overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]`}>
               <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-gradient-to-r from-slate-50 to-slate-100">
                   <div>
                       <h3 className="font-black text-slate-900 text-lg uppercase tracking-wider mb-1">
                           {activeModal === 'schema' ? 'License Configuration' : activeModal === 'renew' ? (() => {
                               const cat = schema.find(c => c.id === editingItem?.catId);
                               const sub = cat?.subs?.find((s: any) => s.id === editingItem?.subId);
                               const ss = editingItem?.subSubId ? (sub?.subSubs || []).find((s: any) => s.id === editingItem.subSubId) : null;
                               const parts = [cat?.name, sub?.name, ss?.name].filter(Boolean);
                               return parts.length > 0 ? parts.join(' • ') : 'Update License';
                           })() : activeModal === 'hierarchy' ? 'Hierarchy Filter' : activeModal === 'history' ? (() => {
                               const cat = schema.find(c => c.id === editingItem?.catId);
                               const sub = cat?.subs?.find((s: any) => s.id === editingItem?.subId);
                               const ss = editingItem?.subSubId ? (sub?.subSubs || []).find((s: any) => s.id === editingItem.subSubId) : null;
                               const parts = [cat?.name, sub?.name, ss?.name].filter(Boolean);
                               return parts.length > 0 ? `History: ${parts.join(' • ')}` : 'History';
                           })() : 'Details'}
                       </h3>
                       {activeModal === 'renew' && (
                           <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Upload and manage license documents</p>
                       )}
                   </div>
                   <button onClick={() => { setUploadEntries([]); setCollapsedExisting(new Set()); setEditingExistingIdx(null); setActiveModal(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors ml-4 shrink-0"><X size={20} className="text-slate-400"/></button>
               </div>
               <div className="p-8 overflow-y-auto flex-1">
                   {activeModal === 'schema' && <SchemaEditor schema={schema} setSchema={setSchema} currentScope={currentScope} userId={userRootId} entities={entities} />}
                   {activeModal === 'hierarchy' && <HierarchyFilter filters={filters} setFilters={setFilters} entities={entities} onClose={() => setActiveModal(null)} currentScope={currentScope} userRootId={userRootId} />}
                   {activeModal === 'topic' && (
                       <div className="space-y-4">
                           <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Topic</label>
                           <select className="w-full border p-2 rounded-lg text-sm font-bold bg-slate-50" value={filters.topic} onChange={e=>setFilters(p=>({...p, topic: e.target.value, subtopic:''}))}>
                               <option value="">All Topics</option>
                               {schema.filter(c => canViewItem(c, currentScope, userRootId, entities)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select></div>
                           <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Sub-Topic</label>
                           <select className="w-full border p-2 rounded-lg text-sm font-bold bg-slate-50" disabled={!filters.topic} value={filters.subtopic} onChange={e=>setFilters(p=>({...p, subtopic: e.target.value}))}>
                               <option value="">All Sub-Topics</option>
                               {schema.find(c=>c.id===filters.topic)?.subs.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                           </select></div>
                       </div>
                   )}
                   {activeModal === 'renew' && (() => {
                       const cat = schema.find(c => c.id === editingItem?.catId);
                       const sub = cat?.subs?.find((s: any) => s.id === editingItem?.subId);
                       const ss = editingItem?.subSubId ? (sub?.subSubs || []).find((s: any) => s.id === editingItem.subSubId) : null;
                       const displayName = ss?.name || sub?.name || 'License';
                       const currentData = getEditingItemData();
                       const existingUploads = currentData?.uploads || [];
                       const addEntry = () => setUploadEntries(prev => [...prev, { id: Date.now().toString(), reportName: '', licenseNumber: '', generateDate: '', expiryDate: '', fileName: '', fileData: '', comments: '', file: null, collapsed: false }]);
                       const updateEntry = (id: string, field: string, value: any) => setUploadEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
                       const removeEntry = (id: string) => setUploadEntries(prev => prev.filter(e => e.id !== id));
                       const toggleCollapse = (id: string) => setUploadEntries(prev => prev.map(e => e.id === id ? { ...e, collapsed: !e.collapsed } : e));
                       return (
                       <div className="space-y-6">
                           <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-200 flex justify-between items-center">
                               <div>
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit</div>
                                   <span className="text-sm font-black text-slate-800">{entities.find(u=>u.id===editingItem.unitId)?.name}</span>
                               </div>
                               <div className="text-right">
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Documents</div>
                                   <span className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-lg font-black">{existingUploads.length + uploadEntries.length}</span>
                               </div>
                           </div>
                           {existingUploads.length > 0 && (
                               <div className="space-y-3">
                                   <div className="flex items-center gap-2">
                                       <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                                       <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Previously Uploaded ({existingUploads.length})</div>
                                   </div>
                                   {existingUploads.map((u: any, i: number) => {
                                       const isCollapsed = collapsedExisting.has(i);
                                       const isEditing = editingExistingIdx === i;
                                       const updateExistingField = (field: string, value: string) => {
                                           const updated = [...existingUploads];
                                           updated[i] = { ...updated[i], [field]: value };
                                           updateMetric(editingItem.unitId, editingItem.catId, editingItem.subId, { uploads: updated, uploadCount: updated.length }, editingItem.subSubId);
                                       };
                                       return (
                                       <div key={i} className={`border rounded-lg text-xs overflow-hidden ${isEditing ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'}`}>
                                           <div className="flex justify-between items-center p-3 cursor-pointer" onClick={() => {
                                               if(!isEditing) setCollapsedExisting(prev => { const next = new Set(prev); if(next.has(i)) next.delete(i); else next.add(i); return next; });
                                           }}>
                                               <div className="flex items-center gap-2 flex-1 min-w-0">
                                                   <ChevronRight size={12} className={`${isEditing ? 'text-amber-600' : 'text-green-600'} shrink-0 transition-transform ${!isCollapsed || isEditing ? 'rotate-90' : ''}`}/>
                                                   <span className={`font-black truncate ${isEditing ? 'text-amber-800' : 'text-green-800'}`}>{u.reportName || `Document ${i+1}`}</span>
                                                   <span className={`text-[10px] ${isEditing ? 'text-amber-600' : 'text-green-600'}`}>#{u.licenseNumber || 'N/A'}</span>
                                               </div>
                                               <div className="flex items-center gap-2 shrink-0">
                                                   {u.expiryDate && <span className={`text-[9px] px-1.5 py-0.5 rounded ${isEditing ? 'text-amber-600 bg-amber-100' : 'text-green-600 bg-green-100'}`}>Exp: {u.expiryDate}</span>}
                                                   <button onClick={(e) => { e.stopPropagation(); if(isEditing) { setEditingExistingIdx(null); } else { setEditingExistingIdx(i); setCollapsedExisting(prev => { const next = new Set(prev); next.delete(i); return next; }); } }} className={`p-1 rounded transition-colors ${isEditing ? 'text-amber-600 hover:text-amber-800 bg-amber-100' : 'text-blue-500 hover:text-blue-700 bg-blue-50'}`} title={isEditing ? 'Done Editing' : 'Edit'}>{isEditing ? <Check size={12}/> : <Edit2 size={12}/>}</button>
                                                   <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this document?')) { const newUploads = existingUploads.filter((_: any, idx: number) => idx !== i); updateMetric(editingItem.unitId, editingItem.catId, editingItem.subId, { uploads: newUploads, uploadCount: newUploads.length }, editingItem.subSubId); if(isEditing) setEditingExistingIdx(null); } }} className="text-red-400 hover:text-red-600"><Trash2 size={12}/></button>
                                               </div>
                                           </div>
                                           {(!isCollapsed || isEditing) && (
                                               <div className={`px-3 pb-3 space-y-2 border-t pt-2 ${isEditing ? 'border-amber-200' : 'border-green-200'}`}>
                                                   {isEditing ? (<>
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Report Name</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" defaultValue={u.reportName || ''} onChange={e => updateExistingField('reportName', e.target.value)} placeholder="Enter report name" /></div>
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{displayName} Number</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" defaultValue={u.licenseNumber || ''} onChange={e => updateExistingField('licenseNumber', e.target.value)} placeholder={`Enter ${displayName} Number`} /></div>
                                                       <div className="grid grid-cols-2 gap-3">
                                                           <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generate Date</label><input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" defaultValue={u.generateDate || ''} onChange={e => updateExistingField('generateDate', e.target.value)} /></div>
                                                           <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date</label><input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" defaultValue={u.expiryDate || ''} onChange={e => updateExistingField('expiryDate', e.target.value)} /></div>
                                                       </div>
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Replace PDF</label><input type="file" accept=".pdf" className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white" onChange={e => { const f = e.target.files?.[0]; if(f) { updateExistingField('fileName', f.name); const reader = new FileReader(); reader.onload = () => updateExistingField('fileData', reader.result as string); reader.readAsDataURL(f); } }} /></div>
                                                       {u.fileName && <div className="text-amber-600 flex items-center gap-1 text-[10px]"><FileText size={10}/>Current: {u.fileName}</div>}
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comments</label><textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold resize-none" rows={2} defaultValue={u.comments || ''} onChange={e => updateExistingField('comments', e.target.value)} placeholder="Add notes..." /></div>
                                                   </>) : (<>
                                                       <div className="flex gap-3 flex-wrap">
                                                           {u.generateDate && <span className="text-green-600">Generated: {u.generateDate}</span>}
                                                           {u.expiryDate && <span className="text-green-600">Expires: {u.expiryDate}</span>}
                                                       </div>
                                                       {u.fileName && <div className="text-green-600 flex items-center gap-1">
                                                           <FileText size={10}/>
                                                           {u.fileData ? <button onClick={(e) => { e.stopPropagation(); const byteString = atob(u.fileData.split(',')[1]); const mimeType = u.fileData.split(',')[0].split(':')[1].split(';')[0]; const ab = new ArrayBuffer(byteString.length); const ia = new Uint8Array(ab); for(let j=0;j<byteString.length;j++) ia[j]=byteString.charCodeAt(j); const blob = new Blob([ab], {type: mimeType}); window.open(URL.createObjectURL(blob), '_blank'); }} className="underline hover:text-green-800 text-left">{u.fileName}</button> : <span>{u.fileName}</span>}
                                                       </div>}
                                                       {u.comments && <div className="text-green-700 italic mt-1">{u.comments}</div>}
                                                   </>)}
                                               </div>
                                           )}
                                       </div>
                                       );
                                   })}
                               </div>
                           )}
                           {uploadEntries.length > 0 && (
                               <div className="space-y-3">
                                   <div className="flex items-center gap-2">
                                       <div className="w-1 h-5 bg-blue-500 rounded-full" />
                                       <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">New Uploads ({uploadEntries.length})</div>
                                   </div>
                                   {uploadEntries.map((entry, idx) => (
                                       <div key={entry.id} className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden">
                                           <div className="flex justify-between items-center p-3 cursor-pointer" onClick={() => toggleCollapse(entry.id)}>
                                               <div className="flex items-center gap-2">
                                                   <ChevronRight size={12} className={`text-slate-400 transition-transform ${!entry.collapsed ? 'rotate-90' : ''}`}/>
                                                   <span className="text-[10px] font-black text-slate-500 uppercase">Document {existingUploads.length + idx + 1}</span>
                                                   {entry.reportName && <span className="text-[10px] font-bold text-slate-700">— {entry.reportName}</span>}
                                               </div>
                                               <div className="flex items-center gap-2">
                                                   {entry.fileName && <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"><FileText size={8} className="inline mr-0.5"/>{entry.fileName}</span>}
                                                   {uploadEntries.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }} className="text-red-400 hover:text-red-600"><Trash2 size={13}/></button>}
                                               </div>
                                           </div>
                                           {!entry.collapsed && (
                                               <div className="px-4 pb-4 space-y-3 border-t border-slate-200 pt-3">
                                                   <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Report Name</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" value={entry.reportName} onChange={e => updateEntry(entry.id, 'reportName', e.target.value)} placeholder="Enter report name" /></div>
                                                   <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{displayName} Number</label><input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" value={entry.licenseNumber} onChange={e => updateEntry(entry.id, 'licenseNumber', e.target.value)} placeholder={`Enter ${displayName} Number`} /></div>
                                                   <div className="grid grid-cols-2 gap-3">
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generate Date</label><input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" value={entry.generateDate} onChange={e => updateEntry(entry.id, 'generateDate', e.target.value)} /></div>
                                                       <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date</label><input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold" value={entry.expiryDate} onChange={e => updateEntry(entry.id, 'expiryDate', e.target.value)} /></div>
                                                   </div>
                                                   <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Upload PDF</label><input type="file" accept=".pdf" className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white" onChange={e => { const f = e.target.files?.[0]; if(f) { updateEntry(entry.id, 'file', f); updateEntry(entry.id, 'fileName', f.name); const reader = new FileReader(); reader.onload = () => updateEntry(entry.id, 'fileData', reader.result as string); reader.readAsDataURL(f); } }} /></div>
                                                   <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comments</label><textarea className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold resize-none" rows={2} value={entry.comments} onChange={e => updateEntry(entry.id, 'comments', e.target.value)} placeholder="Add notes..." /></div>
                                               </div>
                                           )}
                                       </div>
                                   ))}
                               </div>
                           )}
                           <button onClick={addEntry} className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-sm font-black text-blue-600 uppercase hover:border-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-2"><PlusCircle size={16}/>Add Another Document</button>
                           <div className="flex gap-3">
                               <button onClick={() => { setUploadEntries([]); setCollapsedExisting(new Set()); setEditingExistingIdx(null); setActiveModal(null); }} className="flex-1 py-3 border-2 border-slate-300 text-slate-600 rounded-xl text-sm font-black uppercase hover:bg-slate-100 transition">Cancel</button>
                               <button onClick={() => {
                                   const validEntries = uploadEntries.filter(e => e.reportName || e.licenseNumber || e.fileName || e.expiryDate);
                                   const newUploads = validEntries.map(e => ({
                                       reportName: e.reportName,
                                       licenseNumber: e.licenseNumber,
                                       generateDate: e.generateDate,
                                       expiryDate: e.expiryDate,
                                       fileName: e.fileName || (editingItem.mode === 'upload' ? 'manual-upload.pdf' : ''),
                                       fileData: e.fileData || '',
                                       comments: e.comments,
                                       uploadedAt: new Date().toISOString()
                                   }));
                                   const allUploads = [...existingUploads, ...newUploads];
                                   const latest = newUploads[newUploads.length - 1] || existingUploads[existingUploads.length - 1];
                                   const updates: any = {
                                       uploads: allUploads,
                                       uploadCount: allUploads.length,
                                       date: latest?.expiryDate || latest?.generateDate || new Date().toISOString(),
                                       licenseNumber: latest?.licenseNumber || '',
                                       fileName: latest?.fileName || '',
                                       comments: latest?.comments || ''
                                   };
                                   updateMetric(editingItem.unitId, editingItem.catId, editingItem.subId, updates, editingItem.subSubId);
                                   setUploadEntries([]);
                                   setActiveModal(null);
                               }} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-black uppercase shadow-lg transition">Save All Documents</button>
                           </div>
                       </div>
                       );
                   })()}
                   {activeModal === 'history' && (() => {
                       const current = getEditingItemData();
                       const uploads = current?.uploads || [];
                       return (
                       <div className="overflow-hidden rounded-lg border border-slate-200">
                            <table className="w-full text-left text-xs font-bold">
                                <thead className="bg-[#1e293b] text-white uppercase tracking-wider text-[11px]"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Report Name</th><th className="px-4 py-3">Number</th><th className="px-4 py-3">Generated</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Comments</th></tr></thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    {uploads.length > 0 ? uploads.map((u: any, i: number) => {
                                        const isExpired = u.expiryDate && new Date(u.expiryDate) < new Date();
                                        return (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-3 text-slate-900 font-black">{u.reportName || `Document ${i+1}`}</td>
                                                <td className="px-4 py-3 text-slate-900">{u.licenseNumber || 'N/A'}</td>
                                                <td className="px-4 py-3 text-slate-700">{u.generateDate || '-'}</td>
                                                <td className="px-4 py-3 text-slate-700">{u.expiryDate || '-'}</td>
                                                <td className="px-4 py-3"><span className={`${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-0.5 rounded text-[10px] uppercase`}>{isExpired ? 'Expired' : 'Active'}</span></td>
                                                <td className="px-4 py-3">{u.fileData ? <button onClick={() => { const byteString = atob(u.fileData.split(',')[1]); const mimeType = u.fileData.split(',')[0].split(':')[1].split(';')[0]; const ab = new ArrayBuffer(byteString.length); const ia = new Uint8Array(ab); for(let j=0;j<byteString.length;j++) ia[j]=byteString.charCodeAt(j); const blob = new Blob([ab], {type: mimeType}); window.open(URL.createObjectURL(blob), '_blank'); }} className="text-blue-600 underline hover:text-blue-800 flex items-center gap-1"><FileText size={11}/>{u.fileName}</button> : <span className="text-slate-400">{u.fileName || 'No File'}</span>}</td>
                                                <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">{u.comments || '-'}</td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No documents uploaded yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                       <button onClick={() => { setUploadEntries([]); setCollapsedExisting(new Set()); setEditingExistingIdx(null); setActiveModal(null); }} className="w-full py-2 border border-slate-300 text-slate-600 rounded-lg text-xs font-black uppercase hover:bg-slate-100 transition mt-3">Cancel</button>
                       </div>
                       );
                   })()}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-Components Implementation ---

function SchemaEditor({ schema, setSchema, currentScope, userId, entities }: { schema: Category[], setSchema: React.Dispatch<React.SetStateAction<Category[]>>, currentScope: HierarchyScope, userId: string | undefined | null, entities: Entity[] }) {
    const [newTopic, setNewTopic] = useState('');
    const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
    const [expandedSub, setExpandedSub] = useState<string | null>(null);
    const [editState, setEditState] = useState<{ type: 'topic' | 'sub' | 'subsub', id: string, parentIds: string[], value: string } | null>(null);
    const [inputValues, setInputValues] = useState<Record<string, string>>({});

    const updateInput = (key: string, val: string) => { setInputValues(prev => ({ ...prev, [key]: val })); };
    const getInputValue = (key: string) => inputValues[key] || '';

    const toggleTopic = (id: string) => {
        if (expandedTopic === id) { setExpandedTopic(null); } 
        else { setExpandedTopic(id); setExpandedSub(null); }
    };
    const toggleSub = (id: string) => {
        setExpandedSub(expandedSub === id ? null : id);
    };
    
    const addTopic = () => { 
        if(!newTopic.trim()) return; 
        const newTopicId = `cat-${Date.now()}`; 
        const newSubId = `sub-${Date.now()}`; 
        setSchema(prev => [...prev, { 
            id: newTopicId, 
            name: newTopic.trim(), 
            active: true, 
            createdByScope: currentScope,
            createdByEntityId: userId,
            subs: [{ 
                id: newSubId, 
                name: 'Overview', 
                active: true, 
                subSubs: [],
                createdByScope: currentScope,
                createdByEntityId: userId
            }] 
        }]); 
        setNewTopic(''); 
        setExpandedTopic(newTopicId);
        setExpandedSub(null);
    };

    const addSubTopic = (catId: string, name: string) => { 
        if(!name.trim()) return; 
        const newId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; 
        setSchema(prev => prev.map(cat => { 
            if (cat.id !== catId) return cat; 
            return { 
                ...cat, 
                subs: [...(cat.subs || []), { 
                    id: newId, 
                    name: name.trim(), 
                    active: true, 
                    subSubs: [],
                    createdByScope: currentScope,
                    createdByEntityId: userId
                }] 
            }; 
        })); 
    };
    
    const addSubSubTopic = (catId: string, subId: string, name: string) => { 
        if(!name.trim()) return; 
        const newId = `ss-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`; 
        setSchema(prev => prev.map(cat => { 
            if (cat.id !== catId) return cat; 
            return { 
                ...cat, 
                subs: cat.subs.map(sub => { 
                    if (sub.id !== subId) return sub; 
                    return { ...sub, subSubs: [...(sub.subSubs || []), { id: newId, name: name.trim() }] }; 
                }) 
            }; 
        })); 
    };
    
    const handleAddSubTopic = (catId: string) => { const key = `sub-${catId}`; const val = getInputValue(key); if(!val || !val.trim()) return; addSubTopic(catId, val); updateInput(key, ''); };
    const handleAddSubSubTopic = (catId: string, subId: string) => { const key = `ss-${subId}`; const val = getInputValue(key); if(!val || !val.trim()) return; addSubSubTopic(catId, subId, val); updateInput(key, ''); };
    const deleteTopic = (catId: string, catName: string) => { 
        if (!window.confirm(`Are you sure you want to delete the topic "${catName}" and all its sub-topics? This action cannot be undone.`)) return;
        setSchema(prev => prev.filter(c => c.id !== catId));
        if (expandedTopic === catId) { setExpandedTopic(null); setExpandedSub(null); }
    };
    const deleteSubTopic = (catId: string, subId: string, subName: string) => { 
        if (!window.confirm(`Are you sure you want to delete the sub-topic "${subName}"? This action cannot be undone.`)) return;
        setSchema(prev => prev.map(cat => { if (cat.id !== catId) return cat; return { ...cat, subs: cat.subs.filter(s => s.id !== subId) }; }));
        if (expandedSub === subId) setExpandedSub(null);
    };
    const deleteSubSubTopic = (catId: string, subId: string, ssId: string, ssName: string) => { 
        if (!window.confirm(`Are you sure you want to delete the sub-sub-topic "${ssName}"? This action cannot be undone.`)) return;
        setSchema(prev => prev.map(cat => { if (cat.id !== catId) return cat; return { ...cat, subs: cat.subs.map(sub => { if (sub.id !== subId) return sub; return { ...sub, subSubs: (sub.subSubs || []).filter(ss => ss.id !== ssId) }; }) }; })); 
    };
    const startEditing = (type: 'topic' | 'sub' | 'subsub', id: string, value: string, parentIds: string[] = []) => { setEditState({ type, id, value, parentIds }); };
    
    const saveEdit = () => { 
        if(!editState || !editState.value.trim()) return; 
        setSchema(prev => { 
            if(editState.type === 'topic') { return prev.map(c => c.id === editState.id ? { ...c, name: editState.value } : c); } 
            if(editState.type === 'sub') { const catId = editState.parentIds[0]; return prev.map(c => { if(c.id !== catId) return c; return { ...c, subs: c.subs.map(s => s.id === editState.id ? { ...s, name: editState.value } : s) }; }); } 
            if(editState.type === 'subsub') { const catId = editState.parentIds[0]; const subId = editState.parentIds[1]; return prev.map(c => { if(c.id !== catId) return c; return { ...c, subs: c.subs.map(s => { if(s.id !== subId) return s; return { ...s, subSubs: (s.subSubs || []).map(ss => ss.id === editState.id ? { ...ss, name: editState.value } : ss) }; }) }; }); } 
            return prev; 
        }); 
        setEditState(null); 
    };

    const visibleSchema = schema
        .map(c => ({ ...c, subs: c.subs || [] }))
        .filter(c => canViewItem(c, currentScope, userId, entities));

    return (
        <div className="space-y-2">
            <div className="flex gap-2 mb-4">
                <input value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="New Root Topic..." className="flex-1 border p-2 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" onKeyDown={e => e.key === 'Enter' && addTopic()}/>
                <button onClick={addTopic} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-black uppercase shadow-lg">+ Add</button>
            </div>
            
            {visibleSchema.map((cat) => {
                const canEditCat = canEditItem(cat, currentScope, userId);
                const canAddSub = canAddSubUnder(cat, currentScope);
                const isTopicOpen = expandedTopic === cat.id;
                const visibleSubs = cat.subs.filter(s => s.active && canViewItem(s, currentScope, userId, entities));
                return (
                    <div key={cat.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors ${isTopicOpen ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`} onClick={() => toggleTopic(cat.id)}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <ChevronRight size={14} className={`shrink-0 transition-transform duration-200 ${isTopicOpen ? 'rotate-90 text-white' : 'text-slate-400'}`} />
                                <ScopeBadge scope={cat.createdByScope} />
                                {editState?.id === cat.id ? (
                                    <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} onClick={e => e.stopPropagation()} className="border px-1.5 py-0.5 rounded text-sm font-bold text-slate-800 bg-white"/>
                                ) : (
                                    <span className="text-xs font-black uppercase tracking-tight truncate">{cat.name}</span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isTopicOpen ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{visibleSubs.length}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                {canEditCat && (
                                    <>
                                        <button onClick={() => startEditing('topic', cat.id, cat.name)} className={`p-1 rounded transition-colors ${isTopicOpen ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-blue-600'}`}><Edit2 size={12}/></button>
                                        <button onClick={() => deleteTopic(cat.id, cat.name)} className={`p-1 rounded transition-colors ${isTopicOpen ? 'text-white/60 hover:text-red-300' : 'text-slate-400 hover:text-red-500'}`}><Trash2 size={12}/></button>
                                    </>
                                )}
                            </div>
                        </div>
                        {isTopicOpen && (
                            <div className="bg-white border-t border-slate-200">
                                {visibleSubs.map(sub => {
                                    const canEditSub = canEditItem(sub, currentScope, userId);
                                    const canAddSubSub = canAddSubUnder(sub, currentScope);
                                    const isSubOpen = expandedSub === sub.id;
                                    const subSubCount = (sub.subSubs || []).length;
                                    return (
                                        <div key={sub.id} className="border-b border-slate-100 last:border-b-0">
                                            <div className={`flex items-center justify-between pl-7 pr-3 py-2 cursor-pointer transition-colors ${isSubOpen ? 'bg-indigo-50' : 'hover:bg-slate-50'}`} onClick={() => toggleSub(sub.id)}>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <ChevronRight size={12} className={`shrink-0 transition-transform duration-200 ${isSubOpen ? 'rotate-90 text-indigo-500' : 'text-slate-300'}`} />
                                                    <ScopeBadge scope={sub.createdByScope} />
                                                    {editState?.id === sub.id ? (
                                                        <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} onClick={e => e.stopPropagation()} className="border px-1 py-0.5 rounded text-xs font-bold"/>
                                                    ) : (
                                                        <span className="text-[11px] font-bold text-slate-700 uppercase truncate">{sub.name}</span>
                                                    )}
                                                    {subSubCount > 0 && <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full shrink-0">{subSubCount}</span>}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                    {canEditSub && (
                                                        <>
                                                            <button onClick={() => startEditing('sub', sub.id, sub.name, [cat.id])} className="p-1 text-slate-300 hover:text-blue-500"><Edit2 size={11}/></button>
                                                            <button onClick={() => deleteSubTopic(cat.id, sub.id, sub.name)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={11}/></button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {isSubOpen && (
                                                <div className="pl-14 pr-3 py-2 bg-slate-50/50 space-y-1.5">
                                                    {(sub.subSubs || []).map(ss => (
                                                        <div key={ss.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                            {editState?.id === ss.id ? (
                                                                <input autoFocus value={editState.value} onChange={e => setEditState({...editState, value: e.target.value})} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="border px-1 py-0.5 rounded text-[10px] font-bold"/>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{ss.name}</span>
                                                            )}
                                                            <div className="flex gap-0.5">
                                                                {canEditSub && (
                                                                    <>
                                                                        <button onClick={() => startEditing('subsub', ss.id, ss.name, [cat.id, sub.id])} className="p-0.5 text-slate-300 hover:text-blue-500"><Edit2 size={10}/></button>
                                                                        <button onClick={() => deleteSubSubTopic(cat.id, sub.id, ss.id, ss.name)} className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {canAddSubSub && (
                                                        <div className="flex gap-2 pt-1">
                                                            <input value={getInputValue(`ss-${sub.id}`)} onChange={e => updateInput(`ss-${sub.id}`, e.target.value)} placeholder="New Sub-Sub Topic..." className="flex-1 text-[10px] border border-dashed p-1.5 rounded bg-white" onKeyDown={e => e.key === 'Enter' && handleAddSubSubTopic(cat.id, sub.id)}/>
                                                            <button onClick={() => handleAddSubSubTopic(cat.id, sub.id)} className="text-indigo-600 font-bold text-[10px] uppercase px-2">Add</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {canAddSub && (
                                    <div className="flex gap-2 px-3 py-2.5 bg-slate-50 border-t border-slate-100">
                                        <input value={getInputValue(`sub-${cat.id}`)} onChange={e => updateInput(`sub-${cat.id}`, e.target.value)} placeholder="New Sub-Topic..." className="flex-1 text-xs border p-1.5 rounded-lg bg-white" onKeyDown={e => e.key === 'Enter' && handleAddSubTopic(cat.id)}/>
                                        <button onClick={() => handleAddSubTopic(cat.id)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">Add Sub</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default LicenseManager;