'use client';
import React, { useRef, useState, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import { X, Download, Award, QrCode, Palette, Layers, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CertificateDirectEditor from './CertificateDirectEditor';
import { loadTemplates, DesignTemplate, DesignEl } from './CertificateStudio';

/**
 * Auto-shrinks a text block so substituted variables (esp. long participant
 * names like "DEENADAYALAN NATARAJAN") fit on a single line inside the
 * studio template's fixed-height/width box instead of wrapping and getting
 * clipped by the parent's `overflow: hidden`.
 *
 * Strategy: render at the configured `baseFontSize`, then in a layout
 * effect compare the inner content's scrollWidth/scrollHeight against the
 * box's clientWidth/clientHeight. If it overflows, iteratively shrink
 * the font-size (down to 40 % of the configured size as a floor) until it
 * fits. Recomputed whenever the content, dimensions, or base size change
 * so each registrant's name is sized independently.
 */
function AutoFitText({
  children, baseFontSize, style, allowWrap,
}: {
  children: React.ReactNode;
  baseFontSize: number;
  style: React.CSSProperties;
  allowWrap: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(baseFontSize);

  useLayoutEffect(() => {
    setFontSize(baseFontSize);
  }, [baseFontSize, children, style.width, style.height]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const minSize = Math.max(6, baseFontSize * 0.4);
    let size = baseFontSize;
    inner.style.fontSize = `${size}px`;
    let guard = 0;
    while (
      guard++ < 80 &&
      size > minSize &&
      (inner.scrollWidth > box.clientWidth + 1 || inner.scrollHeight > box.clientHeight + 1)
    ) {
      size = Math.max(minSize, size - 1);
      inner.style.fontSize = `${size}px`;
    }
    if (size !== fontSize) setFontSize(size);
  });

  return (
    <div ref={boxRef} style={{ ...style, overflow: 'hidden' }}>
      <div
        ref={innerRef}
        style={{
          fontSize,
          whiteSpace: allowWrap ? 'normal' : 'nowrap',
          wordBreak: allowWrap ? 'break-word' : 'normal',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'inherit',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export interface CertParticipant {
  name: string;
  email?: string;
  phone?: string;
  profession?: string;
  designation?: string;
  organization?: string;
  country?: string;
  gender?: string;
  isExternal?: boolean;
}

export interface CertTraining {
  topic: string;
  subTopic?: string;
  trainer: string;
  trainerScope?: string;
  externalCompany?: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  mode?: string;
  trainingHours?: number;
}

export interface CertTemplate {
  stripeColor: string;
  bannerFrom: string;
  bannerTo: string;
  accentBarColor: string;
  accentColor: string;
  nameUnderlineColor: string;
  showStripe: boolean;
  showLogo: boolean;
  qrOnCert: boolean;
  qrPosition: 'bottom-right' | 'bottom-left' | 'bottom-center';
  showSignatory: boolean;
  headerText: string;
  subHeaderText: string;
  presentedText: string;
  bodyText: string;
  orgName: string;
  websiteText: string;
  issuerText: string;
  signatureLabel: string;
  nameSize: number;
}

export const DEFAULT_TEMPLATE: CertTemplate = {
  stripeColor: '#004f52',
  bannerFrom: '#a07800',
  bannerTo: '#b8860b',
  accentBarColor: '#1a8f91',
  accentColor: '#004f52',
  nameUnderlineColor: '#a07800',
  showStripe: true,
  showLogo: true,
  qrOnCert: true,
  qrPosition: 'bottom-right',
  showSignatory: true,
  headerText: 'CERTIFICATE',
  subHeaderText: 'of Achievement',
  presentedText: 'This certificate is proudly presented to',
  bodyText: 'for successfully completing the food safety training programme on',
  orgName: 'SAFE FOOD MITRA',
  websiteText: 'haccppro.in',
  issuerText: 'Issued by HACCP Pro • Safe Food Mitra',
  signatureLabel: 'Authorized Signatory',
  nameSize: 40,
};

const STORAGE_KEY = 'haccppro_cert_template_v2';

function loadTemplate(): CertTemplate {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_TEMPLATE, ...JSON.parse(raw) } : DEFAULT_TEMPLATE;
  } catch { return DEFAULT_TEMPLATE; }
}

function saveTemplate(t: CertTemplate) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {}
}

export function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export function StudioCertificateRender({ template: tmpl, vars, qrData, refProp }: {
  template: DesignTemplate; vars: Record<string, string>; qrData: string;
  refProp?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={refProp}
      style={{
        width: 794, height: 562, position: 'relative', flexShrink: 0,
        background: tmpl.bgImage ? 'transparent' : tmpl.bgColor,
        fontFamily: 'Georgia, serif', overflow: 'hidden',
      }}
    >
      {tmpl.bgImage && (
        <img src={tmpl.bgImage} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
      )}
      {tmpl.elements.map(el => {
        const style: React.CSSProperties = {
          position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
          opacity: el.opacity ?? 1, boxSizing: 'border-box', overflow: 'hidden',
        };
        if (el.type === 'text') {
          const content = substituteVars(el.content || '', vars);
          // If the template field references the participant name, force
          // single-line layout so long names shrink instead of wrapping
          // and getting clipped by the parent's overflow:hidden. All other
          // text fields keep normal wrapping but still auto-shrink to fit.
          const referencesName = /\{\{\s*name\s*\}\}/i.test(el.content || '');
          return (
            <AutoFitText
              key={el.id}
              baseFontSize={el.fontSize}
              allowWrap={!referencesName}
              style={{
                ...style,
                fontFamily: el.fontFamily,
                color: el.color,
                fontWeight: el.bold ? '700' : '400',
                fontStyle: el.italic ? 'italic' : 'normal',
                textDecoration: el.underline ? 'underline' : 'none',
                textAlign: el.align || 'left',
                lineHeight: el.lineHeight || 1.3,
              }}
            >
              {content}
            </AutoFitText>
          );
        }
        if (el.type === 'image' && el.src) {
          return (
            <div key={el.id} style={style}>
              <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain', borderRadius: el.borderRadius || 0, display: 'block' }} />
            </div>
          );
        }
        if (el.type === 'qr') {
          return (
            <div key={el.id} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QRCodeSVG value={qrData} size={Math.min(el.w, el.h)} />
            </div>
          );
        }
        if (el.type === 'shape') {
          return (
            <div key={el.id} style={{ ...style, background: el.bgColor, borderRadius: el.borderRadius || 0, border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : 'none' }} />
          );
        }
        return null;
      })}
    </div>
  );
}

const CertificateRender = React.memo(function CertificateRender({
  participant, training, certId, formattedDate, qrData, template, refProp,
}: {
  participant: CertParticipant; training: CertTraining;
  certId: string; formattedDate: string; qrData: string;
  template: CertTemplate; refProp?: React.RefObject<HTMLDivElement>;
}) {
  const qrSize = 68;
  const details = [
    { label: 'Trainer', value: training.trainer },
    { label: 'Date', value: formattedDate },
    { label: 'Time From', value: training.startTime },
    { label: 'Time To', value: training.endTime },
    ...(training.location ? [{ label: 'Location', value: training.location }] : []),
    ...(training.mode ? [{ label: 'Mode', value: training.mode }] : []),
    ...(training.trainingHours ? [{ label: 'Duration', value: `${training.trainingHours} hrs` }] : []),
    { label: 'Certificate No.', value: certId },
  ];
  const qrEl = template.qrOnCert ? <QRCodeSVG value={qrData} size={qrSize} /> : null;

  return (
    <div ref={refProp} style={{ width: '794px', minHeight: '562px', fontFamily: 'Georgia, serif', background: '#ffffff', display: 'flex', flexShrink: 0 }}>
      {template.showStripe && <div style={{ width: '52px', background: template.stripeColor, flexShrink: 0 }} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: `linear-gradient(135deg, ${template.bannerFrom} 0%, ${template.bannerTo} 100%)`, padding: '28px 36px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '46px', fontWeight: '900', color: '#ffffff', letterSpacing: '0.14em', fontFamily: 'Georgia, serif', lineHeight: 1, marginBottom: '7px' }}>{template.headerText}</div>
            <div style={{ fontSize: '15px', fontWeight: '400', color: '#ffffff', letterSpacing: '0.3em', fontFamily: 'Arial, sans-serif', textTransform: 'uppercase' }}>{template.subHeaderText}</div>
          </div>
          {template.showLogo && (
            <div style={{ width: '82px', height: '82px', borderRadius: '50%', border: `3px solid ${template.stripeColor}`, background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '-2px' }}>
              <div style={{ fontSize: '7.5px', fontWeight: '900', color: template.stripeColor, textAlign: 'center', letterSpacing: '0.08em', lineHeight: 1.5, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>{template.orgName.split(' ').slice(0, 2).join('\n') || template.orgName}</div>
              <div style={{ fontSize: '16px', color: template.bannerFrom, margin: '2px 0 1px' }}>✦</div>
              <div style={{ fontSize: '7px', color: template.stripeColor, letterSpacing: '0.2em', fontFamily: 'Arial, sans-serif' }}>★ ★ ★</div>
            </div>
          )}
        </div>
        <div style={{ background: template.accentBarColor, padding: '11px 36px', color: '#ffffff', fontSize: '14px', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{template.presentedText}</div>
        <div style={{ flex: 1, padding: '26px 36px 18px', display: 'flex', flexDirection: 'column' }}>
          {(() => {
            // Auto-shrink the name so long names (e.g. "DEENADAYALAN
            // NATARAJAN") stay on a single line instead of wrapping and
            // getting clipped by the underline / next element. The
            // available width is ~670px (794px page − 52px stripe −
            // 2×36px horizontal padding); Georgia bold averages ~0.58×
            // fontSize per character. Floor at 55 % of the configured
            // size so it never becomes illegibly small.
            const AVAIL_W = 670;
            const CHAR_W_FACTOR = 0.58;
            const baseSize = template.nameSize;
            const len = Math.max(1, participant.name.length);
            const fitSize = AVAIL_W / (len * CHAR_W_FACTOR);
            const effSize = Math.max(baseSize * 0.55, Math.min(baseSize, fitSize));
            return (
              <div
                style={{
                  fontSize: `${effSize}px`,
                  fontWeight: '700',
                  color: '#1a1a1a',
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.02em',
                  borderBottom: `2px solid ${template.nameUnderlineColor}`,
                  paddingBottom: '14px',
                  marginBottom: '14px',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {participant.name}
              </div>
            );
          })()}
          {(participant.designation || participant.profession || participant.organization) && (
            <div style={{ fontSize: '12px', color: '#666', fontFamily: 'Arial, sans-serif', marginBottom: '10px', letterSpacing: '0.05em' }}>{[participant.designation || participant.profession, participant.organization].filter(Boolean).join(' • ')}</div>
          )}
          <div style={{ fontSize: '13px', color: '#555', fontFamily: 'Arial, sans-serif', marginBottom: '14px', lineHeight: 1.6 }}>{template.bodyText}</div>
          <div style={{ fontSize: '19px', fontWeight: '700', color: template.accentColor, fontFamily: 'Georgia, serif', marginBottom: '22px', letterSpacing: '0.01em', fontStyle: 'italic' }}>"{training.topic}"</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginTop: 'auto' }}>
            {details.map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: '8.5px', color: '#aaa', fontFamily: 'Arial, sans-serif', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: label === 'Certificate No.' ? template.accentColor : '#1a1a1a', fontFamily: 'Arial, sans-serif' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '14px 36px 22px', borderTop: '1px solid #e5e7eb' }}>
          {template.showSignatory ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '150px', borderTop: '2px solid #1a1a1a', paddingTop: '7px', fontSize: '9px', color: '#777', fontFamily: 'Arial, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{template.signatureLabel}</div>
            </div>
          ) : <div />}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#999', fontFamily: 'Arial, sans-serif', letterSpacing: '0.05em' }}>{template.issuerText}</div>
            <div style={{ fontSize: '9px', color: '#bbb', fontFamily: 'Arial, sans-serif', marginTop: '2px' }}>{template.websiteText}</div>
          </div>
          {template.qrOnCert && template.qrPosition === 'bottom-right' ? qrEl : <div style={{ width: `${qrSize}px` }} />}
        </div>
        {template.qrOnCert && template.qrPosition === 'bottom-center' && <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '18px' }}>{qrEl}</div>}
        {template.qrOnCert && template.qrPosition === 'bottom-left' && <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0 36px 18px' }}>{qrEl}</div>}
      </div>
    </div>
  );
});

interface Props {
  participant: CertParticipant;
  training: CertTraining;
  onClose: () => void;
  preselectedTemplateId?: string | null;
}

export default function CertificateModal({ participant, training, onClose, preselectedTemplateId }: Props) {
  const certRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<'certificate' | 'qrcard' | 'design'>('certificate');
  const [downloading, setDownloading] = useState(false);
  const [template, setTemplate] = useState<CertTemplate>(loadTemplate);

  const [studioTemplates, setStudioTemplates] = useState<DesignTemplate[]>(() => loadTemplates().filter(t => t.published));
  const [selectedStudioId, setSelectedStudioId] = useState<string | null>(preselectedTemplateId ?? null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetch('/api/cert-templates')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => {
        const all = (d.items || []) as DesignTemplate[];
        setStudioTemplates(all.filter(t => t.published));
      })
      .catch(() => {});
  }, []);

  const selectedStudio = useMemo(() => {
    if (selectedStudioId) {
      return studioTemplates.find(t => t.id === selectedStudioId) ?? null;
    }
    if (preselectedTemplateId) {
      return studioTemplates.find(t => t.id === preselectedTemplateId) ?? null;
    }
    return studioTemplates.length > 0 ? studioTemplates[0] : null;
  }, [selectedStudioId, preselectedTemplateId, studioTemplates]);

  const useStudio = selectedStudio !== null;

  const updateT = useCallback(<K extends keyof CertTemplate>(key: K, value: CertTemplate[K]) => {
    setTemplate(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => saveTemplate(template), 400);
    return () => clearTimeout(t);
  }, [template]);

  const certId = useMemo(() => {
    const base = `${participant.name}-${training.topic}-${training.date}`;
    let h = 0;
    for (let i = 0; i < base.length; i++) h = Math.imul(31, h) + base.charCodeAt(i) | 0;
    return `SFM-${Math.abs(h).toString(36).toUpperCase().padStart(6, '0')}`;
  }, [participant.name, training.topic, training.date]);

  const formattedDate = useMemo(() =>
    training.date ? new Date(training.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
  [training.date]);

  const qrData = useMemo(() => JSON.stringify({
    certId, participant: participant.name,
    organization: participant.organization || participant.profession || '',
    course: training.topic, trainer: training.trainer,
    date: formattedDate, timeFrom: training.startTime, timeTo: training.endTime,
    location: training.location || '',
    issuedBy: template.issuerText,
    verify: `https://${template.websiteText}/verify/${certId}`,
  }), [certId, participant.name, participant.organization, participant.profession,
      training.topic, training.trainer, formattedDate, training.startTime, training.endTime,
      training.location, template.issuerText, template.websiteText]);

  const templateVars = useMemo<Record<string, string>>(() => ({
    name: participant.name,
    topic: training.topic,
    trainer: training.trainer,
    date: formattedDate,
    timeFrom: training.startTime,
    timeTo: training.endTime,
    location: training.location || '',
    certId,
    org: participant.organization || '',
    designation: participant.designation || participant.profession || '',
  }), [participant, training, formattedDate, certId]);

  const certProps = { participant, training, certId, formattedDate, qrData, template };

  const downloadCertificate = async () => {
    const target = useStudio ? studioRef.current : certRef.current;
    if (!target) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(target, { scale: 4, useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`Certificate_${participant.name.replace(/\s+/g, '_')}.pdf`);
    } finally { setDownloading(false); }
  };

  const downloadQRCard = async () => {
    if (!qrRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(qrRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `QRCard_${participant.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally { setDownloading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white rounded-3xl w-full shadow-2xl my-auto transition-all ${tab === 'design' ? 'max-w-[1060px]' : 'max-w-5xl'}`}>

        <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Award size={20} className="text-amber-600" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Certificate Generator</h2>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">Present</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {([
                { id: 'certificate', label: 'Certificate', icon: <Award size={10} /> },
                { id: 'qrcard',     label: 'QR Card',     icon: <QrCode size={10} /> },
                ...(!useStudio ? [{ id: 'design' as const, label: 'Design', icon: <Palette size={10} /> }] : []),
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-6">

          {tab === 'certificate' && (
            <>
              {studioTemplates.length > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Template:</span>
                  <div className="relative">
                    <button
                      onClick={() => setShowPicker(!showPicker)}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all min-w-[200px] justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Layers size={12} className="text-indigo-500" />
                        {selectedStudio ? selectedStudio.name : 'Default Template'}
                      </span>
                      <ChevronDown size={12} className="text-slate-400" />
                    </button>
                    {showPicker && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                        <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-xl py-1 w-64 max-h-60 overflow-y-auto">
                          <button
                            onClick={() => { setSelectedStudioId(null); setShowPicker(false); }}
                            className={`w-full px-4 py-2.5 text-left text-[11px] font-bold hover:bg-slate-50 flex items-center gap-2 transition-all ${!selectedStudioId && !useStudio ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                          >
                            <Award size={12} /> Default Template
                          </button>
                          {studioTemplates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => { setSelectedStudioId(t.id); setShowPicker(false); }}
                              className={`w-full px-4 py-2.5 text-left text-[11px] font-bold hover:bg-slate-50 flex items-center gap-2 transition-all ${selectedStudioId === t.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                            >
                              <Layers size={12} /> {t.name}
                              <span className="ml-auto px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[7px] font-black uppercase">Published</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-x-auto pb-2 rounded-2xl border border-slate-100 bg-slate-50">
                <div className="p-3">
                  {useStudio && selectedStudio ? (
                    <StudioCertificateRender
                      template={selectedStudio}
                      vars={templateVars}
                      qrData={qrData}
                      refProp={studioRef as React.RefObject<HTMLDivElement>}
                    />
                  ) : (
                    <CertificateRender {...certProps} refProp={certRef} />
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                {!useStudio && (
                  <button onClick={() => setTab('design')} className="flex items-center gap-2 px-5 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                    <Palette size={14} /> Edit Design
                  </button>
                )}
                <button onClick={downloadCertificate} disabled={downloading} className="flex-1 py-3 bg-amber-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  <Download size={15} /> {downloading ? 'Generating PDF…' : 'Download Certificate (PDF)'}
                </button>
              </div>
            </>
          )}

          {tab === 'qrcard' && (
            <>
              <div className="flex justify-center py-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div ref={qrRef} style={{ width: '360px', background: '#ffffff', borderRadius: '16px', border: `2px solid ${template.stripeColor}`, overflow: 'hidden', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
                  <div style={{ background: template.stripeColor, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '8px', color: '#bef', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '5px' }}>{template.orgName}</div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#ffffff', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>Training<br />Certificate</div>
                    </div>
                    <div style={{ background: template.bannerFrom, borderRadius: '8px', padding: '6px 12px', fontSize: '9px', fontWeight: '900', color: '#ffffff', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2px' }}>✓ PRESENT</div>
                  </div>
                  <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '5px' }}>Participant</div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#1a1a1a', lineHeight: 1.2, marginBottom: '4px' }}>{participant.name}</div>
                    {(participant.designation || participant.profession) && <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>{participant.designation || participant.profession}</div>}
                    {participant.organization && <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{participant.organization}</div>}
                  </div>
                  <div style={{ padding: '14px 22px', borderBottom: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '8px' }}>Training Details</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: template.accentColor, marginBottom: '12px', lineHeight: 1.3 }}>{training.topic}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { label: 'Trainer', value: training.trainer },
                        { label: 'Date', value: formattedDate },
                        { label: 'Time From', value: training.startTime },
                        { label: 'Time To', value: training.endTime },
                        ...(training.location ? [{ label: 'Location', value: training.location }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} style={label === 'Location' || label === 'Trainer' ? { gridColumn: '1 / -1' } : {}}>
                          <div style={{ fontSize: '8px', color: '#bbb', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#333', marginTop: '2px' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '8px', color: '#bbb', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '5px' }}>Certificate ID</div>
                      <div style={{ fontSize: '13px', fontWeight: '900', color: template.accentColor, letterSpacing: '0.08em' }}>{certId}</div>
                      <div style={{ fontSize: '8px', color: '#ccc', marginTop: '5px' }}>Scan QR to verify</div>
                      <div style={{ fontSize: '8px', color: '#ccc', marginTop: '2px' }}>{template.websiteText}</div>
                    </div>
                    <QRCodeSVG value={qrData} size={90} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                {!useStudio && (
                  <button onClick={() => setTab('design')} className="flex items-center gap-2 px-5 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                    <Palette size={14} /> Edit Design
                  </button>
                )}
                <button onClick={downloadQRCard} disabled={downloading} className="flex-1 py-3 bg-teal-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-teal-800 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  <Download size={15} /> {downloading ? 'Generating…' : 'Download QR Card (PNG)'}
                </button>
              </div>
            </>
          )}

          {tab === 'design' && !useStudio && (
            <div style={{ height: '82vh' }} className="flex flex-col">
              <CertificateDirectEditor
                participant={participant}
                training={training}
                certId={certId}
                formattedDate={formattedDate}
                qrData={qrData}
                template={template}
                onChange={updateT}
                certRef={certRef}
                onDownload={downloadCertificate}
                downloading={downloading}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
