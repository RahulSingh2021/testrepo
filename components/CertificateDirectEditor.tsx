'use client';
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import type { CertParticipant, CertTraining, CertTemplate } from './CertificateModal';

// ─── Color presets ────────────────────────────────────────────────────────────
const PRESETS = [
  { name: 'Classic',   stripe: '#004f52', bannerFrom: '#a07800', bannerTo: '#b8860b', accent: '#1a8f91', text: '#004f52', underline: '#a07800' },
  { name: 'Navy',      stripe: '#1e2a4a', bannerFrom: '#1e3a5f', bannerTo: '#2c4a7c', accent: '#2563eb', text: '#1e3a5f', underline: '#2563eb' },
  { name: 'Forest',    stripe: '#14532d', bannerFrom: '#166534', bannerTo: '#15803d', accent: '#16a34a', text: '#14532d', underline: '#16a34a' },
  { name: 'Burgundy',  stripe: '#4a0d20', bannerFrom: '#7f1d1d', bannerTo: '#991b1b', accent: '#b91c1c', text: '#7f1d1d', underline: '#b91c1c' },
  { name: 'Royal',     stripe: '#3b0764', bannerFrom: '#581c87', bannerTo: '#6d28d9', accent: '#7c3aed', text: '#581c87', underline: '#7c3aed' },
  { name: 'Slate',     stripe: '#1e293b', bannerFrom: '#334155', bannerTo: '#475569', accent: '#64748b', text: '#1e293b', underline: '#64748b' },
];

// ─── Editable span (contenteditable, React-safe) ──────────────────────────────
function EditableSpan({
  value, onChange, style, className, multiline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const composing = useRef(false);

  // Sync external value only when not focused
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  const sync = () => {
    if (!composing.current) onChange(ref.current?.textContent ?? '');
  };

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={sync}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; sync(); }}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') e.preventDefault(); }}
      style={{
        outline: 'none',
        cursor: 'text',
        display: 'inline',
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        borderBottom: '1.5px dashed rgba(99,102,241,0)',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={e => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'rgba(99,102,241,0.6)'; }}
      onBlur={e => { (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'rgba(99,102,241,0)'; sync(); }}
      className={className}
    />
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface Props {
  participant: CertParticipant;
  training: CertTraining;
  certId: string;
  formattedDate: string;
  qrData: string;
  template: CertTemplate;
  onChange: <K extends keyof CertTemplate>(key: K, value: CertTemplate[K]) => void;
  certRef: React.RefObject<HTMLDivElement>;
  onDownload: () => Promise<void>;
  downloading: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CertificateDirectEditor({
  participant, training, certId, formattedDate, qrData,
  template, onChange, certRef, onDownload, downloading,
}: Props) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [activeHint, setActiveHint] = useState(true);

  // Hide the "click to edit" hint after first interaction
  useEffect(() => {
    const t = setTimeout(() => setActiveHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyPreset = (p: typeof PRESETS[0]) => {
    onChange('stripeColor', p.stripe);
    onChange('bannerFrom', p.bannerFrom);
    onChange('bannerTo', p.bannerTo);
    onChange('accentBarColor', p.accent);
    onChange('accentColor', p.text);
    onChange('nameUnderlineColor', p.underline);
  };

  const qrSize = 64;

  const qrEl = template.qrOnCert ? (
    <QRCodeSVG value={qrData} size={qrSize} />
  ) : null;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* ── Compact toolbar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-200">

        {/* Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Theme</span>
          {PRESETS.map(p => (
            <button
              key={p.name}
              title={p.name}
              onClick={() => applyPreset(p)}
              style={{ background: `linear-gradient(135deg,${p.bannerFrom},${p.stripe})` }}
              className="w-6 h-6 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
            />
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Custom colors */}
        <div className="flex items-center gap-2">
          {([
            ['Stripe',  'stripeColor'],
            ['Banner',  'bannerFrom'],
            ['Accent',  'accentBarColor'],
          ] as [string, keyof CertTemplate][]).map(([label, key]) => (
            <label key={key} className="flex items-center gap-1 cursor-pointer">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
              <input
                type="color"
                value={template[key] as string}
                onChange={e => onChange(key, e.target.value)}
                className="w-7 h-7 rounded-lg border border-slate-200 p-0.5 cursor-pointer"
              />
            </label>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Toggles */}
        <div className="flex items-center gap-2">
          {([
            ['Stripe', 'showStripe'],
            ['Logo', 'showLogo'],
            ['QR', 'qrOnCert'],
            ['Signature', 'showSignatory'],
          ] as [string, keyof CertTemplate][]).map(([label, key]) => (
            <button
              key={key}
              onClick={() => onChange(key, !template[key])}
              className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${template[key] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Logo upload */}
        <button onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest">
          <Upload size={11} /> Logo
        </button>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

        {/* Reset */}
        <button onClick={() => {
          applyPreset(PRESETS[0]);
          onChange('headerText', 'CERTIFICATE');
          onChange('subHeaderText', 'of Achievement');
          onChange('presentedText', 'This certificate is proudly presented to');
          onChange('bodyText', 'for successfully completing the food safety training programme on');
          onChange('orgName', 'SAFE FOOD MITRA');
          onChange('issuerText', 'Issued by HACCP Pro • Safe Food Mitra');
          onChange('websiteText', 'haccppro.in');
          onChange('signatureLabel', 'Authorized Signatory');
          onChange('nameSize', 40);
        }} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 hover:bg-slate-50 transition-all uppercase tracking-widest">
          <RotateCcw size={11} /> Reset
        </button>

        {/* Download */}
        <button onClick={onDownload} disabled={downloading} className="ml-auto flex items-center gap-1.5 px-5 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-60">
          <Download size={12} /> {downloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {/* ── Hint ─────────────────────────────────────────────────────── */}
      {activeHint && (
        <div className="text-center text-[10px] text-indigo-500 font-bold animate-pulse">
          ✏️ Click on any text on the certificate to edit it directly
        </div>
      )}

      {/* ── Certificate canvas ────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto flex items-start justify-center bg-slate-200 rounded-2xl p-4">
        <div
          ref={certRef}
          style={{
            width: 794, minHeight: 562,
            fontFamily: 'Georgia, serif',
            background: '#ffffff',
            display: 'flex',
            flexShrink: 0,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}
        >
          {/* Left stripe */}
          {template.showStripe && (
            <div style={{ width: 52, background: template.stripeColor, flexShrink: 0 }} />
          )}

          {/* Main */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

            {/* Banner */}
            <div style={{
              background: `linear-gradient(135deg, ${template.bannerFrom} 0%, ${template.bannerTo} 100%)`,
              padding: '26px 34px 22px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: '0.14em', lineHeight: 1, marginBottom: 7 }}>
                  <EditableSpan value={template.headerText} onChange={v => onChange('headerText', v)} style={{ fontSize: 46, fontWeight: 900, color: '#fff', letterSpacing: '0.14em' }} />
                </div>
                <div style={{ fontSize: 15, color: '#fff', letterSpacing: '0.3em', fontFamily: 'Arial,sans-serif', textTransform: 'uppercase' }}>
                  <EditableSpan value={template.subHeaderText} onChange={v => onChange('subHeaderText', v)} style={{ fontSize: 15, color: '#fff', letterSpacing: '0.3em', fontFamily: 'Arial,sans-serif' }} />
                </div>
              </div>
              {template.showLogo && (
                <div
                  style={{
                    width: 82, height: 82, borderRadius: '50%',
                    border: `3px solid ${template.stripeColor}`,
                    background: '#fff', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    marginTop: -2, overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  }}
                  title="Click to upload logo"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <>
                      <div style={{ fontSize: 7.5, fontWeight: 900, color: template.stripeColor, textAlign: 'center', letterSpacing: '0.08em', lineHeight: 1.5, textTransform: 'uppercase', fontFamily: 'Arial,sans-serif' }}>
                        <EditableSpan value={template.orgName} onChange={v => onChange('orgName', v)} style={{ fontSize: 7.5, fontWeight: 900, color: template.stripeColor, lineHeight: 1.5, fontFamily: 'Arial,sans-serif', textAlign: 'center', display: 'block', whiteSpace: 'pre-wrap', maxWidth: 62 }} />
                      </div>
                      <div style={{ fontSize: 16, color: template.bannerFrom, margin: '2px 0 1px' }}>✦</div>
                      <div style={{ fontSize: 7, color: template.stripeColor, letterSpacing: '0.2em', fontFamily: 'Arial,sans-serif' }}>★ ★ ★</div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Accent bar */}
            <div style={{ background: template.accentBarColor, padding: '10px 34px', flexShrink: 0 }}>
              <EditableSpan
                value={template.presentedText}
                onChange={v => onChange('presentedText', v)}
                style={{ fontSize: 14, color: '#fff', fontFamily: 'Georgia,serif', fontStyle: 'italic', letterSpacing: '0.02em' }}
              />
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '22px 34px 16px', display: 'flex', flexDirection: 'column' }}>

              {/* Name — auto-shrinks to fit so long names like
                  "DEENADAYALAN NATARAJAN" stay on one line instead of
                  wrapping into a clipped second row. */}
              {(() => {
                const AVAIL_W = 670;
                const CHAR_W_FACTOR = 0.58;
                const baseSize = template.nameSize;
                const nameLen = (participant.name || '').length;
                const estW = nameLen * baseSize * CHAR_W_FACTOR;
                const scale = estW > AVAIL_W ? Math.max(0.55, AVAIL_W / estW) : 1;
                const fittedSize = Math.max(18, Math.floor(baseSize * scale));
                return (
                  <div style={{
                    fontSize: fittedSize, fontWeight: 700, color: '#1a1a1a',
                    fontFamily: 'Georgia,serif', letterSpacing: '0.02em',
                    borderBottom: `2px solid ${template.nameUnderlineColor}`,
                    paddingBottom: 12, marginBottom: 10, lineHeight: 1.15,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {participant.name}
                  </div>
                );
              })()}

              {/* Designation */}
              {(participant.designation || participant.profession || participant.organization) && (
                <div style={{ fontSize: 12, color: '#666', fontFamily: 'Arial,sans-serif', marginBottom: 10, letterSpacing: '0.05em' }}>
                  {[participant.designation || participant.profession, participant.organization].filter(Boolean).join(' • ')}
                </div>
              )}

              {/* Body text */}
              <div style={{ fontSize: 13, color: '#555', fontFamily: 'Arial,sans-serif', marginBottom: 12, lineHeight: 1.6 }}>
                <EditableSpan
                  value={template.bodyText}
                  onChange={v => onChange('bodyText', v)}
                  multiline
                  style={{ fontSize: 13, color: '#555', fontFamily: 'Arial,sans-serif', lineHeight: 1.6 }}
                />
              </div>

              {/* Topic */}
              <div style={{ fontSize: 19, fontWeight: 700, color: template.accentColor, fontFamily: 'Georgia,serif', marginBottom: 18, letterSpacing: '0.01em', fontStyle: 'italic' }}>
                "{training.topic}"
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 'auto' }}>
                {[
                  { label: 'Trainer', value: training.trainer },
                  { label: 'Date', value: formattedDate },
                  { label: 'Time', value: `${training.startTime} – ${training.endTime}` },
                  { label: 'Certificate No.', value: certId },
                  ...(training.location ? [{ label: 'Location', value: training.location }] : []),
                  ...(training.trainingHours ? [{ label: 'Duration', value: `${training.trainingHours} hrs` }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 8, color: '#aaa', fontFamily: 'Arial,sans-serif', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: label === 'Certificate No.' ? template.accentColor : '#1a1a1a', fontFamily: 'Arial,sans-serif' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '12px 34px 20px', borderTop: '1px solid #e5e7eb' }}>
              {template.showSignatory ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 140, borderTop: '2px solid #1a1a1a', paddingTop: 7, fontSize: 9, color: '#777', fontFamily: 'Arial,sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    <EditableSpan value={template.signatureLabel} onChange={v => onChange('signatureLabel', v)} style={{ fontSize: 9, color: '#777', fontFamily: 'Arial,sans-serif', letterSpacing: '0.12em' }} />
                  </div>
                </div>
              ) : <div />}

              <div style={{ textAlign: 'center', flex: 1, padding: '0 16px' }}>
                <div style={{ fontSize: 10, color: '#999', fontFamily: 'Arial,sans-serif', letterSpacing: '0.04em' }}>
                  <EditableSpan value={template.issuerText} onChange={v => onChange('issuerText', v)} style={{ fontSize: 10, color: '#999', fontFamily: 'Arial,sans-serif' }} />
                </div>
                <div style={{ fontSize: 9, color: '#bbb', fontFamily: 'Arial,sans-serif', marginTop: 2 }}>
                  <EditableSpan value={template.websiteText} onChange={v => onChange('websiteText', v)} style={{ fontSize: 9, color: '#bbb', fontFamily: 'Arial,sans-serif' }} />
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                {template.qrOnCert ? qrEl : <div style={{ width: qrSize }} />}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Name size slider ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name Size</span>
        <input type="range" min={20} max={60} value={template.nameSize} onChange={e => onChange('nameSize', Number(e.target.value))} className="flex-1 accent-amber-600" />
        <span className="text-[10px] font-mono text-slate-500 w-6">{template.nameSize}</span>
      </div>
    </div>
  );
}
