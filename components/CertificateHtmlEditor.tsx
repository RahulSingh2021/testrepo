'use client';
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Download, Code2, Eye, RotateCcw, Copy, Check,
  Columns, AlignLeft, Plus, Wand2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'haccppro_html_cert_v1';

const VARS = [
  { key: '{{name}}', label: 'Name', color: '#4f46e5' },
  { key: '{{topic}}', label: 'Topic', color: '#0891b2' },
  { key: '{{trainer}}', label: 'Trainer', color: '#059669' },
  { key: '{{date}}', label: 'Date', color: '#d97706' },
  { key: '{{timeFrom}}', label: 'From', color: '#7c3aed' },
  { key: '{{timeTo}}', label: 'To', color: '#db2777' },
  { key: '{{location}}', label: 'Location', color: '#dc2626' },
  { key: '{{certId}}', label: 'Cert ID', color: '#374151' },
  { key: '{{org}}', label: 'Organisation', color: '#1d4ed8' },
  { key: '{{designation}}', label: 'Designation', color: '#6b7280' },
  { key: '{{email}}', label: 'Email', color: '#0369a1' },
];

// ─── Default certificate HTML template ───────────────────────────────────────
function buildDefaultHtml(qrDataUrl: string): string {
  return `<div style="width:794px;height:562px;font-family:Georgia,serif;background:#ffffff;display:flex;overflow:hidden;position:relative;box-sizing:border-box;">

  <!-- Left sidebar -->
  <div style="width:80px;background:#004f52;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0;position:relative;">
    <!-- Seal -->
    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#b8860b,#ffd700,#b8860b);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.4);border:2px solid #ffd700;">
      <div style="text-align:center;line-height:1.2;">
        <div style="font-size:7px;font-weight:900;color:#004f52;letter-spacing:0.05em;font-family:Arial,sans-serif;">CERTIFIED</div>
        <div style="font-size:9px;font-weight:900;color:#004f52;letter-spacing:0.04em;font-family:Arial,sans-serif;">HACCP</div>
        <div style="font-size:6px;color:#004f52;font-family:Arial,sans-serif;">★ ★ ★</div>
        <div style="font-size:6px;font-weight:900;color:#004f52;letter-spacing:0.05em;font-family:Arial,sans-serif;">CERTIFIED</div>
      </div>
    </div>
    <!-- Ribbon tails -->
    <div style="margin-top:6px;display:flex;gap:4px;">
      <div style="width:8px;height:22px;background:#c0392b;border-radius:0 0 4px 4px;"></div>
      <div style="width:8px;height:22px;background:#c0392b;border-radius:0 0 4px 4px;"></div>
    </div>
    <!-- Vertical text -->
    <div style="position:absolute;bottom:24px;font-size:7px;font-weight:900;color:rgba(255,255,255,0.4);letter-spacing:0.25em;font-family:Arial,sans-serif;writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);">SAFE FOOD MITRA</div>
  </div>

  <!-- Main content -->
  <div style="flex:1;display:flex;flex-direction:column;min-width:0;">

    <!-- Gold banner -->
    <div style="background:linear-gradient(105deg,#a07800 0%,#c9a227 40%,#b8860b 70%,#8B6914 100%);padding:24px 32px 20px;display:flex;align-items:flex-start;justify-content:space-between;position:relative;flex-shrink:0;">
      <div>
        <div style="font-size:52px;font-weight:900;color:#ffffff;letter-spacing:0.12em;font-family:Georgia,serif;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,0.25);">CERTIFICATE</div>
        <div style="font-size:15px;font-weight:400;color:rgba(255,255,255,0.9);letter-spacing:0.35em;font-family:Arial,sans-serif;text-transform:uppercase;margin-top:4px;">OF ACHIEVEMENT</div>
      </div>
      <!-- Logo circle -->
      <div style="width:80px;height:80px;border-radius:50%;background:#ffffff;border:3px solid #004f52;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;margin-top:-4px;box-shadow:0 4px 16px rgba(0,0,0,0.2);">
        <div style="font-size:7px;font-weight:900;color:#004f52;text-align:center;letter-spacing:0.06em;line-height:1.4;font-family:Arial,sans-serif;">SAFE FOOD<br/>MITRA</div>
        <div style="font-size:16px;color:#a07800;margin:1px 0;">✦</div>
        <div style="font-size:7px;color:#004f52;letter-spacing:0.18em;font-family:Arial,sans-serif;">★ ★ ★</div>
      </div>
    </div>

    <!-- Teal accent bar -->
    <div style="background:#1a8f91;padding:10px 32px;color:#ffffff;font-size:14px;font-family:Georgia,serif;font-style:italic;letter-spacing:0.02em;flex-shrink:0;">
      This certificate is proudly presented to
    </div>

    <!-- Body -->
    <div style="flex:1;padding:20px 32px 14px;display:flex;flex-direction:column;justify-content:space-between;min-height:0;">
      <div>
        <!-- Name -->
        <div style="font-size:42px;font-weight:700;color:#1a1a1a;font-family:Georgia,serif;letter-spacing:0.02em;border-bottom:2px solid #a07800;padding-bottom:10px;margin-bottom:10px;line-height:1.15;">
          {{name}}
        </div>
        <!-- Designation & Org -->
        <div style="font-size:12px;color:#666;font-family:Arial,sans-serif;margin-bottom:10px;letter-spacing:0.04em;">
          {{designation}} &bull; {{org}}
        </div>
        <!-- Body text -->
        <div style="font-size:13px;color:#555;font-family:Arial,sans-serif;line-height:1.6;margin-bottom:8px;">
          for successfully completing the food safety training programme on
        </div>
        <!-- Topic -->
        <div style="font-size:18px;font-weight:700;color:#004f52;font-family:Georgia,serif;font-style:italic;margin-bottom:14px;">
          &ldquo;{{topic}}&rdquo;
        </div>
        <!-- Details grid -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          <div>
            <div style="font-size:8px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:2px;">Trainer</div>
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">{{trainer}}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:2px;">Date</div>
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">{{date}}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:2px;">Time</div>
            <div style="font-size:11px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">{{timeFrom}} – {{timeTo}}</div>
          </div>
          <div>
            <div style="font-size:8px;color:#aaa;font-family:Arial,sans-serif;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:2px;">Certificate No.</div>
            <div style="font-size:11px;font-weight:700;color:#004f52;font-family:Arial,sans-serif;">{{certId}}</div>
          </div>
        </div>
      </div>

      <!-- Footer row -->
      <div style="display:flex;align-items:flex-end;justify-content:space-between;padding-top:12px;border-top:1px solid #e5e7eb;margin-top:10px;">
        <!-- Signatory -->
        <div style="text-align:center;">
          <div style="font-size:13px;font-family:'Brush Script MT',cursive;color:#333;margin-bottom:3px;">Rashmi Kumari</div>
          <div style="width:130px;border-top:2px solid #1a1a1a;padding-top:5px;font-size:9px;color:#777;font-family:Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;">Authorized Signatory</div>
          <div style="font-size:10px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;margin-top:1px;">Director</div>
        </div>
        <!-- Issuer text -->
        <div style="text-align:center;flex:1;padding:0 20px;">
          <div style="font-size:9px;color:#999;font-family:Arial,sans-serif;letter-spacing:0.04em;line-height:1.5;">Issued by SafeFood Mitra Pvt. Ltd. Registered in India; CIN: U74910RJ2020PTC068494</div>
          <div style="font-size:8px;color:#bbb;font-family:Arial,sans-serif;margin-top:2px;">www.safefoodmitra.com &nbsp;|&nbsp; haccppro.in</div>
        </div>
        <!-- QR -->
        <div style="flex-shrink:0;">
          ${qrDataUrl
            ? `<img src="${qrDataUrl}" width="70" height="70" style="display:block;" />`
            : '<div style="width:70px;height:70px;background:#f3f4f6;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:8px;color:#aaa;">QR</div>'
          }
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveVars(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function loadHtml(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

function saveHtml(h: string) {
  try { localStorage.setItem(STORAGE_KEY, h); } catch {}
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  varValues: Record<string, string>;
  qrData: string;
  participantName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CertificateHtmlEditor({ varValues, qrData, participantName }: Props) {
  const [html, setHtml] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [view, setView] = useState<'split' | 'code' | 'preview'>('split');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  // Generate QR as data URL (once per qrData change)
  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(qrData, { width: 140, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(url => { if (!cancelled) setQrDataUrl(url); });
    });
    return () => { cancelled = true; };
  }, [qrData]);

  // Initialize HTML from localStorage or default (waits for QR)
  useEffect(() => {
    if (initialized) return;
    const saved = loadHtml();
    if (saved) {
      setHtml(saved);
      setInitialized(true);
    } else if (qrDataUrl) {
      setHtml(buildDefaultHtml(qrDataUrl));
      setInitialized(true);
    }
  }, [qrDataUrl, initialized]);

  // Auto-save
  useEffect(() => {
    if (!html) return;
    const t = setTimeout(() => saveHtml(html), 400);
    return () => clearTimeout(t);
  }, [html]);

  const resolvedHtml = useMemo(() => resolveVars(html, varValues), [html, varValues]);

  // Full document for iframe
  const iframeDoc = useMemo(() => `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#f1f5f9;display:flex;justify-content:center;padding:16px;}</style>
</head><body>${resolvedHtml}</body></html>`, [resolvedHtml]);

  // Insert var at cursor
  const insertVar = useCallback((key: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = html.slice(0, start) + key + html.slice(end);
    setHtml(next);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + key.length;
      ta.focus();
    }, 0);
  }, [html]);

  const copyHtml = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const resetToDefault = () => {
    if (!qrDataUrl) return;
    if (confirm('Reset to the default certificate template? Your current HTML will be lost.')) {
      const def = buildDefaultHtml(qrDataUrl);
      setHtml(def);
      saveHtml(def);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Render into a hidden div at 1:1 scale
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
      const inner = document.createElement('div');
      inner.innerHTML = resolvedHtml;
      container.appendChild(inner);
      document.body.appendChild(container);

      await new Promise(r => setTimeout(r, 120)); // let images paint
      const cvs = await html2canvas(inner.firstElementChild as HTMLElement || inner, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
        width: 794, height: 562,
      });
      document.body.removeChild(container);

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(cvs.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
      pdf.save(`Certificate_${participantName.replace(/\s+/g, '_')}.pdf`);
    } finally { setDownloading(false); }
  };

  const lineCount = html.split('\n').length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
          {([
            { id: 'split', icon: <Columns size={12} />, label: 'Split' },
            { id: 'code', icon: <Code2 size={12} />, label: 'Code' },
            { id: 'preview', icon: <Eye size={12} />, label: 'Preview' },
          ] as const).map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Variable chips */}
        <div className="flex flex-wrap gap-1 flex-1">
          {VARS.map(v => (
            <button key={v.key} onClick={() => insertVar(v.key)}
              style={{ borderColor: v.color, color: v.color }}
              className="px-2 py-0.5 rounded-lg text-[8px] font-black border bg-white hover:opacity-80 transition-all flex items-center gap-0.5 whitespace-nowrap">
              <Plus size={7} /> {v.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <button onClick={resetToDefault} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 text-[9px] font-black uppercase tracking-widest transition-all">
            <RotateCcw size={11} /> Reset
          </button>
          <button onClick={copyHtml} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={download} disabled={downloading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-60">
            <Download size={11} /> {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Main panels ──────────────────────────────────────────────────── */}
      <div className={`flex-1 flex gap-3 min-h-0 overflow-hidden`}>

        {/* Code panel */}
        {(view === 'split' || view === 'code') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2' : 'flex-1'} min-h-0`}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Code2 size={12} className="text-slate-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">HTML Editor</span>
              </div>
              <span className="text-[8px] text-slate-500 font-mono">{lineCount} lines</span>
            </div>
            <div className="flex-1 relative min-h-0">
              {/* Line numbers overlay */}
              <div className="absolute inset-0 flex overflow-hidden">
                {/* Line numbers */}
                <div className="bg-slate-900 text-slate-600 font-mono text-[10px] leading-5 py-3 px-2 select-none shrink-0 overflow-hidden" style={{ minWidth: 36 }}>
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i + 1}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={html}
                  onChange={e => setHtml(e.target.value)}
                  spellCheck={false}
                  className="flex-1 bg-slate-900 text-emerald-300 font-mono text-[11px] leading-5 p-3 resize-none focus:outline-none overflow-auto"
                  style={{ tabSize: 2, whiteSpace: 'pre' }}
                  placeholder="Write or paste your certificate HTML here…"
                />
              </div>
            </div>
          </div>
        )}

        {/* Preview panel */}
        {(view === 'split' || view === 'preview') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2' : 'flex-1'} min-h-0`}>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-t-xl border border-slate-200 border-b-0">
              <Eye size={12} className="text-slate-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Live Preview</span>
              <span className="text-[8px] text-slate-400 ml-auto">Updates instantly</span>
            </div>
            <div className="flex-1 border border-slate-200 rounded-b-xl overflow-hidden bg-slate-200">
              <iframe
                ref={previewFrameRef}
                srcDoc={iframeDoc}
                className="w-full h-full border-none"
                title="Certificate Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Helper note ──────────────────────────────────────────────────── */}
      <div className="text-[9px] text-slate-400 flex items-center gap-2">
        <Wand2 size={10} className="text-indigo-400 shrink-0" />
        Use <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{'{{name}}'}</span>, <span className="font-mono bg-slate-100 px-1 rounded text-slate-600">{'{{topic}}'}</span> etc. as placeholders — they are replaced with real values when generating the PDF. Click the chips above to insert at cursor.
        <span className="ml-auto text-slate-300">Auto-saved to browser</span>
      </div>
    </div>
  );
}
