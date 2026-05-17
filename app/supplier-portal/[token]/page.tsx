"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Truck, Package, FileUp, Calendar, Hash, Check,
  ChevronDown, Search, X, Loader2, CheckCircle2,
  AlertCircle, Layers, Tag, Lock, ShieldCheck,
  Plus, Upload, Download, ClipboardList, Clock,
  CheckCheck, XCircle, ChevronRight, Boxes, Factory,
  CalendarDays, TriangleAlert, FileText, Pencil, Trash2,
  CheckSquare, Square, Send
} from 'lucide-react';

interface SupplierInfo {
  id: string;
  name: string;
  unitId: string;
  unitName: string;
  requiresPin: boolean;
}

interface MaterialOption {
  name: string;
  brands: { name: string }[];
}

interface SubmissionForm {
  materialName: string;
  brand: string;
  batchNo: string;
  quantity: string;
  unit: string;
  expectedDeliveryDate: string;
  mfgDate: string;
  expiryDate: string;
  coaFile: File | null;
  invoiceFile: File | null;
  formEFile: File | null;
}

const UNIT_OPTIONS = ['KG', 'LTR', 'PCS', 'BOX', 'PKT', 'BTL', 'CAN', 'BAG', 'CTN', 'ROLL'];

const CSV_HEADERS = ['materialName', 'brand', 'batchNo', 'quantity', 'unit', 'expectedDeliveryDate', 'mfgDate', 'expiryDate'];

type PortalTab = 'add' | 'bulk' | null;

const PortalSearchSelect: React.FC<{
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
}> = ({ label, options, value, onChange, icon, placeholder, required }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => options.filter(o => o.toLowerCase().includes(search.toLowerCase())), [options, search]);

  return (
    <div className="relative">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block mb-2">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black cursor-pointer hover:border-indigo-400 transition-all shadow-sm flex justify-between items-center"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {icon && <div className="text-slate-300">{icon}</div>}
          <span className={`truncate ${value ? 'text-slate-900' : 'text-slate-300'}`}>
            {value || placeholder || `Select ${label}...`}
          </span>
        </div>
        <ChevronDown size={18} className={`text-slate-300 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-2xl z-[200] overflow-hidden flex flex-col max-h-72">
          <div className="p-3 border-b border-slate-100 bg-slate-50/80 sticky top-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                autoFocus
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-blue-400 shadow-inner"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1 flex-1">
            {filtered.length > 0 ? filtered.map(opt => (
              <div
                key={opt}
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                className="px-5 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between group transition-colors rounded-xl"
              >
                <span className="text-xs font-black text-slate-800 uppercase group-hover:text-indigo-600 truncate">{opt}</span>
                {value === opt && <Check size={14} className="text-indigo-600" />}
              </div>
            )) : (
              <div className="px-5 py-4 text-center text-xs font-bold text-slate-300 uppercase">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DateField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  icon?: React.ReactNode;
}> = ({ label, value, onChange, required, icon }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    <div className="relative">
      {icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</div>}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full ${icon ? 'pl-10' : 'pl-5'} pr-5 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black outline-none focus:border-indigo-500 shadow-sm`}
      />
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={10} /> },
    approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCheck size={10} /> },
    rejected: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: <XCircle size={10} /> },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border shrink-0 ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
};

export default function SupplierPortalPage() {
  const params = useParams();
  const token = (params?.token as string) || '';

  const [supplierInfo, setSupplierInfo] = useState<SupplierInfo | null>(null);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastSubmissions, setPastSubmissions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<PortalTab>(null);
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set());

  const [pinVerified, setPinVerified] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [submitSuccess, setSubmitSuccess] = useState<'single' | 'bulk' | null>(null);
  const [submitCount, setSubmitCount] = useState(0);

  const [form, setForm] = useState<SubmissionForm>({
    materialName: '', brand: '', batchNo: '', quantity: '',
    unit: 'KG', expectedDeliveryDate: '', mfgDate: '', expiryDate: '',
    coaFile: null, invoiceFile: null, formEFile: null,
  });

  // Bulk upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  // Bulk batch fields
  const [bulkDeliveryDate, setBulkDeliveryDate] = useState('');
  const [bulkPoNumber, setBulkPoNumber] = useState('');
  const [bulkInvoiceFile, setBulkInvoiceFile] = useState<File | null>(null);
  const [bulkFormEFile, setBulkFormEFile] = useState<File | null>(null);
  const bulkInvoiceRef = useRef<HTMLInputElement>(null);
  const bulkFormERef = useRef<HTMLInputElement>(null);
  const [bulkStep, setBulkStep] = useState<'docs' | 'upload' | 'review'>('docs');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const loadData = async () => {
      try {
        const res = await fetch(`/api/supplier-portal?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'Invalid supplier portal link. Please contact your administrator.');
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        setSupplierInfo(data.supplier);
        setMaterials(data.materials || []);
        setPastSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      } catch (err) {
        setError('Failed to load portal data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [token]);

  const brandOptions = useMemo(() => {
    const mat = materials.find(m => m.name === form.materialName);
    return mat?.brands?.map(b => b.name) || [];
  }, [materials, form.materialName]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const buildSubmission = async (f: SubmissionForm, info: SupplierInfo) => ({
    id: `SS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    unitId: info.unitId,
    supplierId: info.id,
    supplierName: info.name,
    materialName: f.materialName,
    brand: f.brand,
    batchNo: f.batchNo,
    quantity: Number(f.quantity),
    unit: f.unit,
    expectedDeliveryDate: f.expectedDeliveryDate,
    mfgDate: f.mfgDate || undefined,
    expiryDate: f.expiryDate || undefined,
    status: 'pending',
    coaFile: f.coaFile ? await fileToBase64(f.coaFile) : null,
    invoiceFile: f.invoiceFile ? await fileToBase64(f.invoiceFile) : null,
    formEFile: f.formEFile ? await fileToBase64(f.formEFile) : null,
    submittedAt: new Date().toISOString(),
  });

  const handleSubmit = async () => {
    if (!supplierInfo || !form.materialName || !form.brand || !form.quantity || !form.expectedDeliveryDate) return;
    if (Number(form.quantity) <= 0) { alert('Quantity must be greater than zero.'); return; }
    setIsSubmitting(true);
    try {
      const submission = await buildSubmission(form, supplierInfo);
      const res = await fetch('/api/supplier-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setPastSubmissions(prev => [{ ...submission }, ...prev]);
      setSubmitSuccess('single');
      setSubmitCount(1);
      setActiveTab(null);
      setForm({ materialName: '', brand: '', batchNo: '', quantity: '', unit: 'KG', expectedDeliveryDate: '', mfgDate: '', expiryDate: '', coaFile: null, invoiceFile: null, formEFile: null });
    } catch {
      alert('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async () => {
    if (!supplierInfo || pinSubmitting) return;
    setPinSubmitting(true);
    setPinError(false);
    try {
      const res = await fetch('/api/supplier-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin: pinInput }),
      });
      if (!res.ok) { setPinError(true); return; }
      const data = await res.json();
      setMaterials(data.materials || []);
      setPastSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
      setPinVerified(true);
    } catch {
      setPinError(true);
    } finally {
      setPinSubmitting(false);
    }
  };

  const downloadCsvTemplate = () => {
    const rows = [
      CSV_HEADERS.join(','),
      'Chicken Breast,BrandA,BN-001,50,KG,2026-04-01,2026-03-01,2026-06-01',
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier_portal_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) { setCsvError('CSV must have at least one data row.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['materialname', 'brand', 'quantity', 'unit', 'expecteddeliverydate'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length > 0) { setCsvError(`Missing required columns: ${missing.join(', ')}`); return; }
    const rows = lines.slice(1).map((line, i) => {
      const vals = line.split(',').map(v => v.trim());
      const obj: any = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
      return {
        row: i + 2,
        materialName: obj['materialname'] || obj['materialName'] || '',
        brand: obj['brand'] || '',
        batchNo: obj['batchno'] || obj['batchNo'] || '',
        quantity: obj['quantity'] || '',
        unit: obj['unit'] || 'KG',
        expectedDeliveryDate: obj['expecteddeliverydate'] || obj['expectedDeliveryDate'] || '',
        mfgDate: obj['mfgdate'] || obj['mfgDate'] || '',
        expiryDate: obj['expirydate'] || obj['expiryDate'] || '',
        _error: !obj['materialname'] && !obj['materialName'] ? 'Missing material name' : !obj['quantity'] ? 'Missing quantity' : '',
      };
    });
    setCsvError(null);
    setCsvRows(rows);
  };

  const handleCsvFile = (file: File) => {
    setCsvFile(file);
    setCsvRows([]);
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = e => parseCsv(e.target?.result as string);
    reader.readAsText(file);
  };

  const submitBulkRows = async (indices: number[]) => {
    if (!supplierInfo || indices.length === 0) return;
    const rowsToSubmit = indices.map(i => csvRows[i]).filter(r => r && !r._error && r.materialName && r.quantity);
    if (rowsToSubmit.length === 0) { alert('No valid rows to submit.'); return; }
    setIsBulkSubmitting(true);
    try {
      const invoiceBase64 = bulkInvoiceFile ? await fileToBase64(bulkInvoiceFile) : null;
      const formEBase64 = bulkFormEFile ? await fileToBase64(bulkFormEFile) : null;
      const submissions = rowsToSubmit.map(r => ({
        id: `SS-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        unitId: supplierInfo.unitId,
        supplierId: supplierInfo.id,
        supplierName: supplierInfo.name,
        materialName: r.materialName,
        brand: r.brand,
        batchNo: r.batchNo,
        quantity: Number(r.quantity),
        unit: r.unit || 'KG',
        expectedDeliveryDate: bulkDeliveryDate || r.expectedDeliveryDate,
        poNumber: bulkPoNumber || undefined,
        mfgDate: r.mfgDate || undefined,
        expiryDate: r.expiryDate || undefined,
        status: 'pending',
        coaFile: null,
        invoiceFile: invoiceBase64,
        formEFile: formEBase64,
        submittedAt: new Date().toISOString(),
      }));
      for (const sub of submissions) {
        await fetch('/api/supplier-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        });
      }
      setPastSubmissions(prev => [...submissions, ...prev]);
      const remaining = csvRows.filter((_, i) => !indices.includes(i));
      setCsvRows(remaining);
      setSelectedRows(new Set());
      setEditingRowIdx(null);
      if (remaining.length === 0) {
        closeBulkModal();
        setSubmitSuccess('bulk');
        setSubmitCount(submissions.length);
      }
    } catch {
      alert('Bulk submission failed. Please try again.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleBulkSubmitAll = () => {
    const allIndices = csvRows.map((_, i) => i);
    submitBulkRows(allIndices);
  };

  const handleBulkSubmitSelected = () => {
    submitBulkRows(Array.from(selectedRows));
  };

  const removeRows = (indices: number[]) => {
    setCsvRows(prev => prev.filter((_, i) => !indices.includes(i)));
    setSelectedRows(new Set());
    setEditingRowIdx(null);
  };

  const updateRow = (idx: number, field: string, value: string) => {
    setCsvRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      updated._error = !updated.materialName ? 'Missing material name' : !updated.quantity ? 'Missing quantity' : '';
      return updated;
    }));
  };

  const toggleRowSelection = (idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === csvRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(csvRows.map((_, i) => i)));
    }
  };

  const openBulkModal = () => {
    setBulkModalOpen(true);
    setBulkStep('docs');
  };

  const closeBulkModal = () => {
    setBulkModalOpen(false);
    setBulkStep('docs');
    setCsvFile(null);
    setCsvRows([]);
    setCsvError(null);
    setBulkDeliveryDate('');
    setBulkPoNumber('');
    setBulkInvoiceFile(null);
    setBulkFormEFile(null);
    setSelectedRows(new Set());
    setEditingRowIdx(null);
  };

  // Group submissions by delivery date — must be before any early returns (Rules of Hooks)
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pastSubmissions.forEach(sub => {
      const key = sub.expectedDeliveryDate || 'No Date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sub);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'No Date') return 1;
      if (b === 'No Date') return -1;
      return new Date(b).getTime() - new Date(a).getTime();
    });
  }, [pastSubmissions]);

  const toggleDateGroup = (key: string) => {
    setExpandedDateGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Portal Error</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (supplierInfo && supplierInfo.requiresPin && !pinVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden">
          <div className="bg-slate-900 px-8 py-7 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
              <Lock size={26} className="text-white" />
            </div>
            <h1 className="text-sm font-black uppercase tracking-widest text-white">Supplier Portal</h1>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mt-1">{supplierInfo.name}</p>
          </div>
          <div className="px-8 py-8 space-y-6">
            <div className="text-center">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-1">Enter Portal PIN</h2>
              <p className="text-[10px] font-bold text-slate-400">Enter the 4-digit PIN provided by your contact</p>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false); }}
                onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
                placeholder="• • • •"
                className={`w-full text-center px-5 py-5 text-2xl font-black tracking-[1em] border-2 rounded-2xl outline-none transition-all ${
                  pinError ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-slate-200 focus:border-indigo-500 text-slate-900'
                }`}
                autoFocus
              />
              {pinError && <p className="text-center text-[10px] font-black text-rose-500 uppercase tracking-wide">Incorrect PIN. Please try again.</p>}
            </div>
            <button
              onClick={handlePinSubmit}
              disabled={pinInput.length !== 4 || pinSubmitting}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {pinSubmitting ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <><ShieldCheck size={16} /> Unlock Portal</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = pastSubmissions.filter(s => s.status === 'pending').length;
  const approvedCount = pastSubmissions.filter(s => s.status === 'approved').length;
  const rejectedCount = pastSubmissions.filter(s => s.status === 'rejected').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest leading-none">Supplier Portal</h1>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mt-1">{supplierInfo?.name}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-right">
            <div>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Deliveries</p>
              <p className="text-lg font-black text-white leading-none">{pastSubmissions.length}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Pending</p>
              <p className="text-lg font-black text-amber-400 leading-none">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Banner */}
      {submitSuccess && (
        <div className="bg-emerald-600 text-white px-6 py-3 flex items-center justify-between max-w-3xl mx-auto mt-4 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} />
            <p className="text-xs font-black uppercase tracking-wide">
              {submitSuccess === 'bulk'
                ? `${submitCount} deliveries submitted successfully!`
                : 'Delivery details submitted for review'}
            </p>
          </div>
          <button onClick={() => setSubmitSuccess(null)} className="p-1 hover:bg-white/20 rounded-lg transition-all">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* My Submissions header + action tabs */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">My Submissions</h2>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">{pastSubmissions.length} total · {pendingCount} pending</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'add' ? null : 'add')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border ${
                activeTab === 'add'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {activeTab === 'add' ? <X size={13} /> : <Plus size={13} />}
              Add Delivery
            </button>
            <button
              onClick={openBulkModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all border bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
            >
              <Upload size={13} />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* ── ADD DELIVERY TAB ── */}
        {activeTab === 'add' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <Package size={16} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">New Delivery Submission</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Pre-arrival material details</p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Material & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PortalSearchSelect
                  label="Material Name"
                  required
                  options={materials.map(m => m.name)}
                  value={form.materialName}
                  onChange={val => setForm(prev => ({ ...prev, materialName: val, brand: '' }))}
                  icon={<Layers size={16} />}
                />
                <PortalSearchSelect
                  label="Brand"
                  required
                  options={brandOptions}
                  value={form.brand}
                  onChange={val => setForm(prev => ({ ...prev, brand: val }))}
                  icon={<Tag size={16} />}
                />
              </div>

              {/* Batch + Qty + UOM */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1 space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">Batch / Lot No.</label>
                  <input
                    value={form.batchNo}
                    onChange={e => setForm(prev => ({ ...prev, batchNo: e.target.value }))}
                    className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black outline-none focus:border-indigo-500 shadow-sm uppercase"
                    placeholder="BN-..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">Qty <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-4 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black outline-none focus:border-indigo-500 shadow-sm"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">UOM</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3 py-4 bg-white border-2 border-slate-100 rounded-3xl text-xs font-black outline-none focus:border-indigo-500 shadow-sm"
                  >
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DateField label="Mfg. Date" value={form.mfgDate} onChange={v => setForm(prev => ({ ...prev, mfgDate: v }))} icon={<Factory size={14} />} />
                <DateField label="Expiry Date" value={form.expiryDate} onChange={v => setForm(prev => ({ ...prev, expiryDate: v }))} icon={<TriangleAlert size={14} />} />
                <DateField label="Expected Delivery" value={form.expectedDeliveryDate} onChange={v => setForm(prev => ({ ...prev, expectedDeliveryDate: v }))} required icon={<CalendarDays size={14} />} />
              </div>

              {/* Documents */}
              <div className="space-y-3 pt-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Document Uploads</p>
                {[
                  { key: 'coaFile' as const, label: 'Certificate of Analysis (COA)', desc: 'PDF / Image' },
                  { key: 'invoiceFile' as const, label: 'Invoice', desc: 'PDF / Image' },
                  { key: 'formEFile' as const, label: 'Form E', desc: 'PDF / Image' },
                ].map(doc => (
                  <label
                    key={doc.key}
                    className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${
                      form[doc.key] ? 'bg-blue-50 border-2 border-blue-200' : 'bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${form[doc.key] ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-300'}`}>
                      <FileUp size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-black uppercase tracking-wide truncate ${form[doc.key] ? 'text-blue-700' : 'text-slate-500'}`}>
                        {form[doc.key] ? (form[doc.key] as File).name : doc.label}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 mt-0.5">{doc.desc}</p>
                    </div>
                    {form[doc.key] && (
                      <button onClick={e => { e.preventDefault(); e.stopPropagation(); setForm(prev => ({ ...prev, [doc.key]: null })); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all shrink-0">
                        <X size={13} />
                      </button>
                    )}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const file = e.target.files?.[0] || null; setForm(prev => ({ ...prev, [doc.key]: file })); }} />
                  </label>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.materialName || !form.brand || !form.quantity || !form.expectedDeliveryDate}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" /> Submitting...</> : <><Check size={15} /> Submit Delivery Details</>}
              </button>
            </div>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 pt-8">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl relative">
              {/* Modal header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-3xl z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Upload size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-800">Bulk Upload</h2>
                    <div className="flex gap-2 mt-1">
                      {(['docs', 'upload', 'review'] as const).map((s, si) => (
                        <span key={s} className={`text-[8px] font-black uppercase tracking-wide ${bulkStep === s ? 'text-indigo-600' : 'text-slate-300'}`}>
                          {si > 0 && <span className="mx-1">→</span>}
                          {s === 'docs' ? 'Delivery Info' : s === 'upload' ? 'Upload CSV' : 'Review'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={closeBulkModal} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              {/* Step 1 — Delivery Info */}
              {bulkStep === 'docs' && (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block mb-2">
                        Delivery Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={bulkDeliveryDate}
                        onChange={e => setBulkDeliveryDate(e.target.value)}
                        className="w-full px-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-800 outline-none focus:border-indigo-400 transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block mb-2">
                        PO Number
                      </label>
                      <input
                        type="text"
                        value={bulkPoNumber}
                        onChange={e => setBulkPoNumber(e.target.value)}
                        placeholder="e.g. PO-2024-0042"
                        className="w-full px-4 py-3.5 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black text-slate-800 outline-none focus:border-indigo-400 transition-all shadow-sm placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                  {/* Invoice */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block mb-2">Invoice</label>
                    <label
                      className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 border-dashed ${
                        bulkInvoiceFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'
                      }`}
                      onClick={() => bulkInvoiceRef.current?.click()}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bulkInvoiceFile ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                        <FileUp size={18} />
                      </div>
                      {bulkInvoiceFile ? (
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-indigo-700 uppercase truncate">{bulkInvoiceFile.name}</p>
                          <p className="text-[9px] font-bold text-indigo-400 mt-0.5">{(bulkInvoiceFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-500 uppercase">Click to upload invoice</p>
                          <p className="text-[9px] font-bold text-slate-300 mt-0.5">PDF, JPG or PNG accepted</p>
                        </div>
                      )}
                      {bulkInvoiceFile && (
                        <button type="button" onClick={e => { e.stopPropagation(); setBulkInvoiceFile(null); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <input ref={bulkInvoiceRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkInvoiceFile(f); e.target.value = ''; }} />
                  </div>
                  {/* Form E */}
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 block mb-2">Form E</label>
                    <label
                      className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 border-dashed ${
                        bulkFormEFile ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-violet-400 hover:bg-violet-50/30'
                      }`}
                      onClick={() => bulkFormERef.current?.click()}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bulkFormEFile ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-300'}`}>
                        <FileUp size={18} />
                      </div>
                      {bulkFormEFile ? (
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-violet-700 uppercase truncate">{bulkFormEFile.name}</p>
                          <p className="text-[9px] font-bold text-violet-400 mt-0.5">{(bulkFormEFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <p className="text-xs font-black text-slate-500 uppercase">Click to upload Form E</p>
                          <p className="text-[9px] font-bold text-slate-300 mt-0.5">PDF, JPG or PNG accepted</p>
                        </div>
                      )}
                      {bulkFormEFile && (
                        <button type="button" onClick={e => { e.stopPropagation(); setBulkFormEFile(null); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all shrink-0">
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <input ref={bulkFormERef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setBulkFormEFile(f); e.target.value = ''; }} />
                  </div>
                  {/* Continue */}
                  <button
                    onClick={() => setBulkStep('upload')}
                    disabled={!bulkDeliveryDate}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                  >
                    Continue to Upload <ChevronRight size={15} />
                  </button>
                </div>
              )}

              {/* Step 2 — Upload CSV */}
              {bulkStep === 'upload' && (
                <div className="p-6 space-y-5">
                  {/* Summary of docs */}
                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap gap-4 text-[9px] font-black uppercase">
                    <span className="text-indigo-600"><CalendarDays size={11} className="inline mr-1" />{bulkDeliveryDate}</span>
                    {bulkPoNumber && <span className="text-slate-600"><FileText size={11} className="inline mr-1" />PO: {bulkPoNumber}</span>}
                    {bulkInvoiceFile && <span className="text-blue-600"><FileUp size={11} className="inline mr-1" />Invoice ✓</span>}
                    {bulkFormEFile && <span className="text-violet-600"><FileUp size={11} className="inline mr-1" />Form E ✓</span>}
                  </div>
                  {/* Template download */}
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Download the CSV template, fill it in, then upload below</p>
                    <button
                      onClick={downloadCsvTemplate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm"
                    >
                      <Download size={12} /> Template
                    </button>
                  </div>
                  {/* CSV drop zone */}
                  <label
                    className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl cursor-pointer transition-all border-2 border-dashed ${
                      csvFile ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30'
                    }`}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${csvFile ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                      <FileUp size={22} />
                    </div>
                    {csvFile ? (
                      <div className="text-center">
                        <p className="text-xs font-black text-indigo-700 uppercase">{csvFile.name}</p>
                        <p className="text-[9px] font-bold text-indigo-400 mt-0.5">{csvRows.length} rows parsed</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-black text-slate-500 uppercase">Click to select CSV file</p>
                        <p className="text-[9px] font-bold text-slate-300 mt-0.5">Only .csv files accepted</p>
                      </div>
                    )}
                  </label>
                  <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { handleCsvFile(f); setBulkStep('review'); } e.target.value = ''; }} />
                  {csvError && (
                    <div className="flex items-center gap-2 p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <AlertCircle size={14} className="text-rose-500 shrink-0" />
                      <p className="text-[10px] font-bold text-rose-600">{csvError}</p>
                    </div>
                  )}
                  <button onClick={() => setBulkStep('docs')} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">
                    ← Back to Delivery Info
                  </button>
                </div>
              )}

              {/* Step 3 — Review */}
              {bulkStep === 'review' && (
                <div>
                  {/* Toolbar */}
                  <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        {csvRows.length} Rows
                        {selectedRows.size > 0 && <span className="text-indigo-600 ml-2">· {selectedRows.size} selected</span>}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {csvRows.filter(r => !r._error).length} valid · <span className="text-rose-500">{csvRows.filter(r => r._error).length} errors</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase hover:bg-slate-50 transition-all"
                      >
                        {selectedRows.size === csvRows.length ? <CheckSquare size={12} className="text-indigo-600" /> : <Square size={12} />}
                        {selectedRows.size === csvRows.length ? 'Deselect All' : 'Select All'}
                      </button>
                      {selectedRows.size > 0 && (
                        <>
                          <button
                            onClick={handleBulkSubmitSelected}
                            disabled={isBulkSubmitting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-700 transition-all disabled:opacity-40"
                          >
                            <Send size={11} /> Submit {selectedRows.size}
                          </button>
                          <button
                            onClick={() => removeRows(Array.from(selectedRows))}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-100 text-rose-600 rounded-lg text-[9px] font-black uppercase hover:bg-rose-200 transition-all"
                          >
                            <Trash2 size={11} /> Remove {selectedRows.size}
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleBulkSubmitAll}
                        disabled={isBulkSubmitting || csvRows.filter(r => !r._error).length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase hover:bg-black transition-all disabled:opacity-40"
                      >
                        {isBulkSubmitting ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                        Submit All
                      </button>
                    </div>
                  </div>
                  {/* Review table */}
                  <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-[9px] font-bold">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 w-8">
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                              {selectedRows.size === csvRows.length ? <CheckSquare size={13} /> : <Square size={13} />}
                            </button>
                          </th>
                          {['#', 'Material', 'Brand', 'Batch', 'Qty', 'UOM', 'Delivery', 'Mfg', 'Expiry', 'Status', 'Actions'].map(h => (
                            <th key={h} className="px-2 py-3 text-left font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {csvRows.map((r, i) => {
                          const isEditing = editingRowIdx === i;
                          return (
                            <tr key={i} className={`${r._error ? 'bg-rose-50/50' : selectedRows.has(i) ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'} transition-colors`}>
                              <td className="px-3 py-2.5">
                                <button onClick={() => toggleRowSelection(i)} className="text-slate-400 hover:text-indigo-600">
                                  {selectedRows.has(i) ? <CheckSquare size={13} className="text-indigo-600" /> : <Square size={13} />}
                                </button>
                              </td>
                              <td className="px-2 py-2.5 text-slate-400 font-black">{i + 1}</td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <input value={r.materialName} onChange={e => updateRow(i, 'materialName', e.target.value)} className="w-24 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" />
                                ) : (
                                  <span className="font-black text-slate-900 uppercase max-w-[100px] truncate block">{r.materialName || <span className="text-rose-400">—</span>}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <input value={r.brand} onChange={e => updateRow(i, 'brand', e.target.value)} className="w-20 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" />
                                ) : (
                                  <span className="text-slate-600 uppercase">{r.brand || '—'}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <input value={r.batchNo} onChange={e => updateRow(i, 'batchNo', e.target.value)} className="w-16 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" />
                                ) : (
                                  <span className="text-slate-500">{r.batchNo || '—'}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <input type="number" value={r.quantity} onChange={e => updateRow(i, 'quantity', e.target.value)} className="w-14 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" />
                                ) : (
                                  <span className="font-black text-indigo-600">{r.quantity}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <select value={r.unit} onChange={e => updateRow(i, 'unit', e.target.value)} className="w-14 px-1 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none">
                                    {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                                  </select>
                                ) : (
                                  <span className="text-slate-500 uppercase">{r.unit}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5">
                                {isEditing ? (
                                  <input type="date" value={r.expectedDeliveryDate} onChange={e => updateRow(i, 'expectedDeliveryDate', e.target.value)} className="w-28 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" />
                                ) : (
                                  <span className="text-slate-500">{r.expectedDeliveryDate || '—'}</span>
                                )}
                              </td>
                              <td className="px-2 py-2.5 text-slate-500">{isEditing ? <input type="date" value={r.mfgDate} onChange={e => updateRow(i, 'mfgDate', e.target.value)} className="w-28 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" /> : (r.mfgDate || '—')}</td>
                              <td className="px-2 py-2.5 text-slate-500">{isEditing ? <input type="date" value={r.expiryDate} onChange={e => updateRow(i, 'expiryDate', e.target.value)} className="w-28 px-2 py-1.5 border border-indigo-300 rounded-lg text-[9px] font-black outline-none" /> : (r.expiryDate || '—')}</td>
                              <td className="px-2 py-2.5">
                                {r._error
                                  ? <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">{r._error}</span>
                                  : <Check size={12} className="text-emerald-500" />
                                }
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setEditingRowIdx(isEditing ? null : i)}
                                    className={`p-1.5 rounded-lg transition-all ${isEditing ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    title={isEditing ? 'Done editing' : 'Edit row'}
                                  >
                                    {isEditing ? <Check size={12} /> : <Pencil size={12} />}
                                  </button>
                                  <button
                                    onClick={() => submitBulkRows([i])}
                                    disabled={!!r._error || isBulkSubmitting}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Submit this row"
                                  >
                                    <Send size={12} />
                                  </button>
                                  <button
                                    onClick={() => removeRows([i])}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Remove row"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Bottom bar */}
                  <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
                    <button onClick={() => { setBulkStep('upload'); setCsvFile(null); setCsvRows([]); setSelectedRows(new Set()); }} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">
                      ← Upload Different File
                    </button>
                    <p className="text-[8px] font-bold text-slate-300 uppercase">
                      {csvRows.filter(r => !r._error).length} valid of {csvRows.length} rows
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBMISSIONS LIST (always visible, grouped by delivery date) ── */}
        <div className="space-y-4 mt-6">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: pastSubmissions.length, cls: 'text-slate-800', bg: 'bg-white' },
              { label: 'Pending', value: pendingCount, cls: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Approved', value: approvedCount, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-slate-100 shadow-sm text-center`}>
                <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {pastSubmissions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center">
              <Truck size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No submissions yet</p>
              <button onClick={() => setActiveTab('add')} className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all inline-flex items-center gap-2">
                <Plus size={12} /> Add First Delivery
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByDate.map(([dateKey, items]) => {
                const isExpanded = expandedDateGroups.has(dateKey);
                const groupPending = items.filter(s => s.status === 'pending').length;
                const groupApproved = items.filter(s => s.status === 'approved').length;
                const groupRejected = items.filter(s => s.status === 'rejected').length;
                // Use shared doc fields from first item in group (bulk uploads share these)
                const firstItem = items[0];
                const invoiceRef = firstItem?.invoiceRef || firstItem?.invoiceFile;
                const formERef = firstItem?.formEFile;
                const poNumber = firstItem?.poNumber;
                const formattedDate = dateKey !== 'No Date'
                  ? new Date(dateKey).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                  : 'No Date';

                return (
                  <div key={dateKey} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Card header — clickable to expand/collapse */}
                    <button
                      onClick={() => toggleDateGroup(dateKey)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                    >
                      {/* Date badge */}
                      <div className="w-11 h-11 bg-indigo-50 rounded-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8px] font-black text-indigo-400 uppercase leading-none">
                          {dateKey !== 'No Date' ? new Date(dateKey).toLocaleDateString('en-GB', { month: 'short' }) : '—'}
                        </span>
                        <span className="text-base font-black text-indigo-700 leading-none">
                          {dateKey !== 'No Date' ? new Date(dateKey).getDate() : '?'}
                        </span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{formattedDate}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{items.length} product{items.length !== 1 ? 's' : ''}</span>
                          {groupPending > 0 && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[8px] font-black uppercase">{groupPending} pending</span>}
                          {groupApproved > 0 && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase">{groupApproved} approved</span>}
                          {groupRejected > 0 && <span className="px-1.5 py-0.5 bg-rose-50 text-rose-500 rounded-md text-[8px] font-black uppercase">{groupRejected} rejected</span>}
                        </div>
                      </div>
                      {/* Chevron */}
                      <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Doc metadata row */}
                    <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/60 flex flex-wrap gap-3">
                      {poNumber ? (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-600 uppercase">
                          <FileText size={10} className="text-slate-400" /> PO: {poNumber}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-300 uppercase">
                          <FileText size={10} /> No PO
                        </span>
                      )}
                      {invoiceRef ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-indigo-100 transition-colors">
                          <FileText size={10} /> Invoice
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-300 uppercase">
                          <FileText size={10} /> No Invoice
                        </span>
                      )}
                      {formERef ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-violet-600 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-violet-100 transition-colors">
                          <FileText size={10} /> Form E
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-300 uppercase">
                          <FileText size={10} /> No Form E
                        </span>
                      )}
                    </div>

                    {/* Expanded: product sub-cards */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {items.map((sub: any, idx: number) => (
                          <div key={sub.id || idx} className={`px-5 py-3.5 ${sub.status === 'rejected' ? 'bg-rose-50/30' : 'hover:bg-slate-50/40'} transition-colors`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                sub.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                                sub.status === 'rejected' ? 'bg-rose-100 text-rose-500' : 'bg-amber-50 text-amber-500'
                              }`}>
                                <Package size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[10px] font-black text-slate-900 uppercase truncate">{sub.materialName}</p>
                                  <StatusBadge status={sub.status} />
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {sub.brand && (
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{sub.brand}</span>
                                  )}
                                  {sub.batchNo && (
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">· {sub.batchNo}</span>
                                  )}
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-indigo-500 uppercase">
                                    <Boxes size={8} /> {sub.quantity} {sub.unit}
                                  </span>
                                  {sub.mfgDate && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-slate-400 uppercase">
                                      <Factory size={8} /> Mfg: {sub.mfgDate}
                                    </span>
                                  )}
                                  {sub.expiryDate && (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-rose-400 uppercase">
                                      <TriangleAlert size={8} /> Exp: {sub.expiryDate}
                                    </span>
                                  )}
                                </div>
                                {sub.status === 'rejected' && sub.reviewerComments && (
                                  <p className="mt-1 text-[8px] font-bold text-rose-500 italic">{sub.reviewerComments}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
