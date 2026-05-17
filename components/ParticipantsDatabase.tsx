'use client';

// ── LMS · Participants Database ─────────────────────────────────────────────
// Marketing-side roll-up of every LMS training participant + any externally
// imported contacts. Pulls from /api/marketing-participants which already
// merges training_registrations with manually-imported rows and de-dupes by
// (email, mobile).
//
// Three import modes mirror the recipe-calculator UX:
//   • Upload CSV   — file picker → parse → preview → insert
//   • Paste data   — textarea (CSV or TSV) → parse → preview → insert
//   • Download CSV — exports the current de-duped table
//
// Header aliases are forgiving so users can paste straight from Excel/Sheets
// without renaming columns first.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Search, Download, Upload, Clipboard, RefreshCw, Trash2,
  X as XIcon, Loader2, CheckCircle2, AlertCircle, FileText, FileDown, Filter, Mail,
} from 'lucide-react';
import BulkEmailComposer from './BulkEmailComposer';

interface ParticipantRow {
  id: string;
  source: 'training' | 'imported';
  addedDate: string;
  title: string;
  fullName: string;
  email: string;
  countryCode: string;
  mobile: string;
  profession: string;
  organisation: string;
  unsubscribed?: boolean;
}

interface ApiResponse {
  items: ParticipantRow[];
  counts: { total: number; fromTraining: number; imported: number };
}

// ── CSV / TSV parsing ───────────────────────────────────────────────────────
// Handles quoted fields containing commas and embedded newlines. Returns a
// 2-D array of strings with the header row at index 0.
const parseDelimited = (raw: string): string[][] => {
  const text = raw.replace(/\r\n|\r/g, '\n');
  // Sniff delimiter from the first line: prefer tab if present, else comma.
  const firstLine = text.split('\n', 1)[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  // Drop trailing empty rows.
  while (rows.length > 0 && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  return rows;
};

// Forgiving header→field map. Anything unrecognised is ignored.
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  'sl': 'sl', 'sl no': 'sl', 'sl no.': 'sl', 's no': 'sl', 'serial': 'sl', '#': 'sl',
  'added date': 'addedDate', 'date': 'addedDate', 'created at': 'addedDate', 'createdat': 'addedDate',
  'title': 'title', 'session title': 'title', 'session': 'title', 'batch': 'title', 'list': 'title', 'tag': 'title',
  'full name': 'fullName', 'name': 'fullName', 'fullname': 'fullName', 'participant name': 'fullName',
  'email': 'email', 'email id': 'email', 'email address': 'email', 'mail': 'email', 'e-mail': 'email',
  'country code': 'countryCode', 'country': 'countryCode', 'cc': 'countryCode', 'dial code': 'countryCode',
  'mobile': 'mobile', 'mobile number': 'mobile', 'mobile no': 'mobile', 'mobile no.': 'mobile',
  'phone': 'mobile', 'phone number': 'mobile', 'whatsapp': 'mobile', 'whatsapp number': 'mobile', 'contact': 'mobile',
  'profession': 'profession', 'role': 'profession', 'designation': 'profession', 'job title': 'profession',
  'organisation': 'organisation', 'organisation name': 'organisation',
  'organization': 'organisation', 'organization name': 'organisation',
  'company': 'organisation', 'company name': 'organisation',
  'institute': 'organisation', 'institute name': 'organisation', 'institution': 'organisation',
};

interface ImportRow {
  sl?: string;
  addedDate?: string;
  title?: string;
  fullName?: string;
  email?: string;
  countryCode?: string;
  mobile?: string;
  profession?: string;
  organisation?: string;
}

const normalizeHeader = (h: string): string =>
  h.toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();

// Split a raw mobile string into (countryCode, localNumber). Same heuristics
// as the server so the preview matches what will actually be inserted.
const splitPhoneClient = (raw: string): { code: string; local: string } => {
  const s = (raw || '').trim();
  if (!s) return { code: '', local: '' };
  const plus = s.match(/^\+(\d{1,4})[\s-]?(.*)$/);
  if (plus) return { code: `+${plus[1]}`, local: plus[2].replace(/\D/g, '') };
  const z00 = s.match(/^00(\d{1,4})[\s-]?(.*)$/);
  if (z00) return { code: `+${z00[1]}`, local: z00[2].replace(/\D/g, '') };
  return { code: '', local: s.replace(/\D/g, '') };
};

const rowsFromGrid = (grid: string[][]): { rows: ImportRow[]; unmatched: string[] } => {
  if (grid.length < 1) return { rows: [], unmatched: [] };
  const header = grid[0].map(h => normalizeHeader(h));
  const map: (keyof ImportRow | null)[] = header.map(h => HEADER_ALIASES[h] || null);
  const unmatched = header.filter((h, i) => h && !map[i]);
  const rows: ImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.every(c => c.trim() === '')) continue;
    const out: ImportRow = {};
    cells.forEach((cell, i) => {
      const field = map[i];
      if (!field) return;
      const v = cell.trim();
      if (!v) return;
      out[field] = v;
    });
    // If no countryCode column, attempt to split the mobile field.
    if (!out.countryCode && out.mobile) {
      const split = splitPhoneClient(out.mobile);
      if (split.code) { out.countryCode = split.code; out.mobile = split.local; }
    }
    rows.push(out);
  }
  return { rows, unmatched };
};

// CSV writer — quotes any cell containing comma, quote, or newline.
const toCsv = (header: string[], rows: (string | number)[][]): string => {
  const esc = (v: unknown): string => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [header.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
};

const downloadCsv = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function ParticipantsDatabase() {
  const [items, setItems] = useState<ParticipantRow[]>([]);
  const [counts, setCounts] = useState<ApiResponse['counts']>({ total: 0, fromTraining: 0, imported: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'training' | 'imported'>('all');

  // Modal state for the Upload / Paste sub-flow. `step` is 'input' until
  // the user previews, then 'confirm' after a successful parse.
  const [modal, setModal] = useState<null | 'upload' | 'paste'>(null);
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [submitting, setSubmitting] = useState(false);
  const [resultBanner, setResultBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [view, setView] = useState<'contacts' | 'bulk-email'>('contacts');
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/marketing-participants', {
        cache: 'no-store',
        headers: { 'x-admin-token': typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '' },
      });
      if (res.ok) {
        const data: ApiResponse = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
        setCounts(data.counts || { total: 0, fromTraining: 0, imported: 0 });
      }
    } catch (e) {
      console.error('participants reload failed', e);
    }
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(p => {
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.mobile.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.organisation.toLowerCase().includes(q) ||
        p.profession.toLowerCase().includes(q)
      );
    });
  }, [items, search, sourceFilter]);

  // ── Import flow ────────────────────────────────────────────────────────
  const openUpload = () => {
    setModal('upload');
    setStep('input');
    setPasteText('');
    setParseError(null);
    setPreviewRows([]);
    setUnmatchedHeaders([]);
    setTimeout(() => fileRef.current?.click(), 50);
  };
  const openPaste = () => {
    setModal('paste');
    setStep('input');
    setPasteText('');
    setParseError(null);
    setPreviewRows([]);
    setUnmatchedHeaders([]);
  };
  const closeModal = () => {
    setModal(null);
    setStep('input');
    setPasteText('');
    setParseError(null);
    setPreviewRows([]);
    setUnmatchedHeaders([]);
    setSubmitting(false);
  };

  const ingestText = (raw: string, contextLabel: string) => {
    setParseError(null);
    const trimmed = raw.trim();
    if (!trimmed) {
      setParseError(`No data found in ${contextLabel}.`);
      return;
    }
    const grid = parseDelimited(trimmed);
    if (grid.length < 2) {
      setParseError('Need a header row and at least one data row.');
      return;
    }
    const { rows, unmatched } = rowsFromGrid(grid);
    if (rows.length === 0) {
      setParseError('No data rows could be read. Check that your header row matches at least Full Name, Email, or Mobile.');
      return;
    }
    setPreviewRows(rows);
    setUnmatchedHeaders(unmatched);
    setStep('confirm');
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      ingestText(text, file.name);
    } catch (e) {
      setParseError('Could not read that file. Please try again with a CSV.');
    }
  };

  const handlePasteParse = () => ingestText(pasteText, 'the pasted text');

  const handleConfirmInsert = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/marketing-participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '',
        },
        body: JSON.stringify({ items: previewRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResultBanner({ kind: 'err', msg: data?.error || 'Could not save participants.' });
      } else {
        const parts = [
          `Imported ${data.inserted} new participant${data.inserted === 1 ? '' : 's'}`,
        ];
        if (data.updated)  parts.push(`${data.updated} updated (filled missing fields)`);
        if (data.skipped)  parts.push(`${data.skipped} skipped (duplicates / blank rows)`);
        setResultBanner({ kind: 'ok', msg: parts.join(' · ') + '.' });
        await reload();
      }
    } catch {
      setResultBanner({ kind: 'err', msg: 'Network error — please try again.' });
    }
    setSubmitting(false);
    closeModal();
    setTimeout(() => setResultBanner(null), 6000);
  };

  // ── Export ────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const header = [
      'Sl', 'Added Date', 'Title', 'Full Name', 'Email',
      'Country Code', 'Mobile', 'Profession', 'Organisation', 'Source',
    ];
    const rows = filtered.map((p, i) => [
      i + 1,
      new Date(p.addedDate).toISOString().slice(0, 10),
      p.title,
      p.fullName,
      p.email,
      p.countryCode,
      p.mobile,
      p.profession,
      p.organisation,
      p.source,
    ]);
    const csv = toCsv(header, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`participants-database-${stamp}.csv`, csv);
  };

  // Sample CSV — gives the user a ready-to-edit template with the exact
  // column names the importer recognises plus two illustrative rows.
  const handleDownloadSample = () => {
    const header = [
      'Title', 'Full Name', 'Email',
      'Country Code', 'Mobile', 'Profession', 'Organisation',
    ];
    const rows: (string | number)[][] = [
      ['Mr',  'Rahul Sharma',   'rahul.sharma@example.com', '+91', '9876543210', 'QA Manager',     'Acme Foods Pvt Ltd'],
      ['Ms',  'Priya Verma',    'priya.verma@example.com',  '+91', '9123456789', 'Food Safety Lead','Sunrise Bakery'],
    ];
    const csv = toCsv(header, rows);
    downloadCsv('participants-database-sample.csv', csv);
  };

  const handleDeleteImported = async (id: string) => {
    if (!confirm('Remove this imported contact from the marketing database?')) return;
    try {
      await fetch(`/api/marketing-participants?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': typeof window !== 'undefined' ? (localStorage.getItem('admin_session_token') || '') : '' },
      });
      await reload();
    } catch {
      alert('Could not delete. Please try again.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  // Bulk-email sub-view — full-page composer that reuses the same items
  // already loaded for the contacts table (no extra fetch).
  if (view === 'bulk-email') {
    return <BulkEmailComposer items={items} onBack={() => { setView('contacts'); reload(); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Participants Database</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Marketing · {counts.total.toLocaleString()} contacts
                {counts.fromTraining > 0 ? ` · ${counts.fromTraining} from LMS` : ''}
                {counts.imported > 0 ? ` · ${counts.imported} imported` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={reload} disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-50">
              {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Refresh
            </button>
            <button onClick={handleDownloadSample}
              title="Download a sample CSV with the columns the importer expects"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50">
              <FileDown size={13} /> Sample CSV
            </button>
            <button onClick={openUpload}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100">
              <Upload size={13} /> Upload CSV
            </button>
            <button onClick={openPaste}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100">
              <Clipboard size={13} /> Paste data
            </button>
            <button onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold shadow hover:shadow-md">
              <Download size={13} /> Download CSV
            </button>
            <button onClick={() => setView('bulk-email')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-br from-rose-600 to-orange-500 text-white text-xs font-bold shadow hover:shadow-md">
              <Mail size={13} /> Bulk Email
            </button>
          </div>
        </div>

        {/* Result banner */}
        {resultBanner && (
          <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${
            resultBanner.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}>
            {resultBanner.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {resultBanner.msg}
            <button onClick={() => setResultBanner(null)} className="ml-auto text-current opacity-70 hover:opacity-100">
              <XIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, mobile, organisation…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
          />
        </div>
        <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <Filter size={12} /> Source
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-1 gap-1">
          {(['all', 'training', 'imported'] as const).map(s => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                sourceFilter === s ? 'bg-white text-violet-700 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'
              }`}>
              {s === 'all' ? 'All' : s === 'training' ? 'LMS' : 'Imported'}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[11px] font-bold text-slate-400">
          Showing {filtered.length.toLocaleString()} of {items.length.toLocaleString()}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-indigo-500 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading participants…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                <Users size={26} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-700">No participants yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Upload a CSV, paste from a spreadsheet, or wait for trainees to register on the LMS.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Sl</th>
                    <th className="px-3 py-2.5 text-left">Added</th>
                    <th className="px-3 py-2.5 text-left">Title</th>
                    <th className="px-3 py-2.5 text-left">Full Name</th>
                    <th className="px-3 py-2.5 text-left">Email</th>
                    <th className="px-3 py-2.5 text-left">CC</th>
                    <th className="px-3 py-2.5 text-left">Mobile</th>
                    <th className="px-3 py-2.5 text-left">Profession</th>
                    <th className="px-3 py-2.5 text-left">Organisation</th>
                    <th className="px-3 py-2.5 text-left">Source</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-400 font-bold tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-500 font-semibold whitespace-nowrap">
                        {p.addedDate ? new Date(p.addedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-semibold max-w-[220px] truncate" title={p.title}>{p.title || '—'}</td>
                      <td className="px-3 py-2 text-slate-900 font-bold">{p.fullName || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{p.email || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{p.countryCode || '—'}</td>
                      <td className="px-3 py-2 text-slate-700 font-mono text-[11px]">{p.mobile || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{p.profession || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={p.organisation}>{p.organisation || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          p.source === 'training'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {p.source === 'training' ? 'LMS' : 'Imported'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {p.source === 'imported' && (
                          <button onClick={() => handleDeleteImported(p.id)} className="p-1 rounded hover:bg-rose-50 text-rose-400 hover:text-rose-600">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input — wired to the Upload CSV button */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />

      {/* Modal: Upload preview / Paste flow */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {modal === 'upload' ? <Upload size={16} className="text-indigo-600" /> : <Clipboard size={16} className="text-violet-600" />}
                <h3 className="text-sm font-black text-slate-800">
                  {step === 'input'
                    ? (modal === 'upload' ? 'Upload CSV file' : 'Paste from spreadsheet')
                    : `Confirm import — ${previewRows.length} row${previewRows.length === 1 ? '' : 's'}`}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <XIcon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {step === 'input' && modal === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                    <FileText size={32} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">Pick a CSV file</p>
                    <p className="text-[11px] text-slate-400 mt-1">Header row required. Common Excel/Google Sheets columns are detected automatically.</p>
                    <button onClick={() => fileRef.current?.click()} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
                      Choose file…
                    </button>
                  </div>
                  {parseError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2">
                      <AlertCircle size={14} /> {parseError}
                    </div>
                  )}
                </div>
              )}

              {step === 'input' && modal === 'paste' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Copy a range from Excel or Google Sheets (including the header row) and paste below. Both CSV and tab-separated formats work.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={`Full Name, Email, Mobile, Profession, Organisation\nJane Doe, jane@example.com, +91 9876543210, Consultant, Acme Foods`}
                    className="w-full h-56 p-3 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                  />
                  {parseError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2">
                      <AlertCircle size={14} /> {parseError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button onClick={closeModal} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                    <button onClick={handlePasteParse} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">Preview rows</button>
                  </div>
                </div>
              )}

              {step === 'confirm' && (
                <div className="space-y-3">
                  {unmatchedHeaders.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold px-3 py-2 rounded-lg">
                      Ignored unrecognised columns: {unmatchedHeaders.join(', ')}
                    </div>
                  )}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[9px] font-black sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left">#</th>
                          <th className="px-2 py-1.5 text-left">Title</th>
                          <th className="px-2 py-1.5 text-left">Name</th>
                          <th className="px-2 py-1.5 text-left">Email</th>
                          <th className="px-2 py-1.5 text-left">CC</th>
                          <th className="px-2 py-1.5 text-left">Mobile</th>
                          <th className="px-2 py-1.5 text-left">Profession</th>
                          <th className="px-2 py-1.5 text-left">Organisation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 200).map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-2 py-1 text-slate-400 font-bold tabular-nums">{i + 1}</td>
                            <td className="px-2 py-1 text-slate-600">{r.title || '—'}</td>
                            <td className="px-2 py-1 text-slate-900 font-bold">{r.fullName || '—'}</td>
                            <td className="px-2 py-1 text-slate-600 font-mono">{r.email || '—'}</td>
                            <td className="px-2 py-1 text-slate-500 font-mono">{r.countryCode || '—'}</td>
                            <td className="px-2 py-1 text-slate-700 font-mono">{r.mobile || '—'}</td>
                            <td className="px-2 py-1 text-slate-600">{r.profession || '—'}</td>
                            <td className="px-2 py-1 text-slate-600">{r.organisation || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewRows.length > 200 && (
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 border-t">
                        +{previewRows.length - 200} more rows will be imported (preview limited to first 200).
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-[11px] text-slate-500">
                      Duplicates (matching email or mobile) will be skipped automatically.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => { setStep('input'); setPreviewRows([]); }} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">Back</button>
                      <button onClick={handleConfirmInsert} disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold disabled:opacity-50 inline-flex items-center gap-1.5">
                        {submitting && <Loader2 size={12} className="animate-spin" />}
                        Import {previewRows.length} row{previewRows.length === 1 ? '' : 's'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
