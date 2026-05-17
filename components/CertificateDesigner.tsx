'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Trash2, QrCode, Type, Upload, RotateCcw,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Image as ImgIcon,
  Download, Plus, Copy, Layers, Move,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 794;
const CANVAS_H = 562;
const STORAGE_KEY = 'haccppro_canvas_design_v2';

// ─── Types ────────────────────────────────────────────────────────────────────
type ElType = 'text' | 'qr' | 'image';

interface CanvasEl {
  id: string;
  type: ElType;
  x: number; y: number; w: number; h: number;
  content?: string;
  fontSize?: number; color?: string; bold?: boolean; italic?: boolean;
  align?: 'left' | 'center' | 'right'; fontFamily?: string; opacity?: number;
  src?: string; borderRadius?: number;
}

interface CanvasDesign {
  bgImage?: string; bgColor: string; elements: CanvasEl[];
}

// ─── Template variables ───────────────────────────────────────────────────────
const VARS = [
  { key: '{{name}}', label: 'Participant Name' },
  { key: '{{topic}}', label: 'Training Topic' },
  { key: '{{trainer}}', label: 'Trainer' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{timeFrom}}', label: 'Time From' },
  { key: '{{timeTo}}', label: 'Time To' },
  { key: '{{location}}', label: 'Location' },
  { key: '{{certId}}', label: 'Certificate ID' },
  { key: '{{org}}', label: 'Organisation' },
  { key: '{{designation}}', label: 'Designation' },
  { key: '{{email}}', label: 'Email' },
];

const FONTS = ['Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

function loadDesign(): CanvasDesign {
  if (typeof window === 'undefined') return { bgColor: '#ffffff', elements: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { bgColor: '#ffffff', elements: [] };
  } catch { return { bgColor: '#ffffff', elements: [] }; }
}
function saveDesign(d: CanvasDesign) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
}

function resolveText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface DesignerProps {
  varValues: Record<string, string>;
  qrData: string;
  participantName: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CertificateDesigner({ varValues, qrData, participantName }: DesignerProps) {
  const [design, setDesign] = useState<CanvasDesign>(loadDesign);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  // Resize state
  const resizeRef = useRef<{ id: string; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  // Keep a stable ref to elements so the global mouse handler never needs to re-register
  const elementsRef = useRef<CanvasEl[]>(design.elements);

  const selected = design.elements.find(e => e.id === selectedId) ?? null;

  // Sync elements ref on every design change (no extra renders)
  useEffect(() => { elementsRef.current = design.elements; }, [design.elements]);

  // Auto-save
  useEffect(() => {
    const t = setTimeout(() => saveDesign(design), 300);
    return () => clearTimeout(t);
  }, [design]);

  const updateDesign = useCallback((fn: (d: CanvasDesign) => CanvasDesign) => {
    setDesign(prev => fn({ ...prev, elements: [...prev.elements] }));
  }, []);

  const updateEl = useCallback((id: string, patch: Partial<CanvasEl>) => {
    setDesign(prev => ({
      ...prev,
      elements: prev.elements.map(e => e.id === id ? { ...e, ...patch } : e),
    }));
  }, []);

  // ── Mouse move / up (global) — registered ONCE, reads from refs ──────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { id, startX, startY, origX, origY } = dragRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = rect.width / CANVAS_W;
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        // Read current dimensions from stable ref — no stale closure
        const el = elementsRef.current.find(el => el.id === id);
        if (!el) return;
        const newX = Math.max(0, Math.min(CANVAS_W - el.w, origX + dx));
        const newY = Math.max(0, Math.min(CANVAS_H - el.h, origY + dy));
        setDesign(prev => ({
          ...prev,
          elements: prev.elements.map(e => e.id === id ? { ...e, x: Math.round(newX), y: Math.round(newY) } : e),
        }));
      }
      if (resizeRef.current) {
        const { id, handle, startX, startY, origX, origY, origW, origH } = resizeRef.current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = rect.width / CANVAS_W;
        const dx = (e.clientX - startX) / scale;
        const dy = (e.clientY - startY) / scale;
        let nx = origX, ny = origY, nw = origW, nh = origH;
        if (handle.includes('e')) nw = Math.max(20, origW + dx);
        if (handle.includes('s')) nh = Math.max(20, origH + dy);
        if (handle.includes('w')) { nw = Math.max(20, origW - dx); nx = origX + origW - nw; }
        if (handle.includes('n')) { nh = Math.max(20, origH - dy); ny = origY + origH - nh; }
        setDesign(prev => ({
          ...prev,
          elements: prev.elements.map(e => e.id === id ? { ...e, x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) } : e),
        }));
      }
    };
    const onUp = () => { dragRef.current = null; resizeRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — reads elements from elementsRef, not closure

  // ── Add elements ─────────────────────────────────────────────────────────────
  const addText = (content = 'Click to edit text') => {
    const el: CanvasEl = { id: uid(), type: 'text', x: 60, y: 60, w: 300, h: 50, content, fontSize: 24, color: '#1a1a1a', bold: false, italic: false, align: 'left', fontFamily: 'Georgia', opacity: 1 };
    updateDesign(d => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const addVar = (key: string) => {
    const el: CanvasEl = { id: uid(), type: 'text', x: 60, y: 60, w: 400, h: 60, content: key, fontSize: 32, color: '#1a1a1a', bold: true, italic: false, align: 'left', fontFamily: 'Georgia', opacity: 1 };
    updateDesign(d => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const addQr = () => {
    const el: CanvasEl = { id: uid(), type: 'qr', x: 680, y: 460, w: 90, h: 90, opacity: 1 };
    updateDesign(d => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const deleteEl = (id: string) => {
    updateDesign(d => ({ ...d, elements: d.elements.filter(e => e.id !== id) }));
    setSelectedId(null);
  };

  const duplicateEl = (id: string) => {
    const el = design.elements.find(e => e.id === id);
    if (!el) return;
    const newEl = { ...el, id: uid(), x: el.x + 10, y: el.y + 10 };
    updateDesign(d => ({ ...d, elements: [...d.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const moveLayer = (id: string, dir: 'up' | 'down') => {
    setDesign(prev => {
      const els = [...prev.elements];
      const idx = els.findIndex(e => e.id === id);
      if (dir === 'up' && idx < els.length - 1) { [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]]; }
      if (dir === 'down' && idx > 0) { [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]]; }
      return { ...prev, elements: els };
    });
  };

  // ── Image upload helpers ─────────────────────────────────────────────────────
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => updateDesign(d => ({ ...d, bgImage: ev.target?.result as string }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const el: CanvasEl = { id: uid(), type: 'image', x: 50, y: 50, w: 150, h: 150, src, opacity: 1, borderRadius: 0 };
      updateDesign(d => ({ ...d, elements: [...d.elements, el] }));
      setSelectedId(el.id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Download ─────────────────────────────────────────────────────────────────
  const download = async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(canvasRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210);
      pdf.save(`Certificate_${participantName.replace(/\s+/g, '_')}.pdf`);
    } finally { setDownloading(false); }
  };

  // ── Element rendering ─────────────────────────────────────────────────────────
  const renderEl = (el: CanvasEl, editing = true) => {
    const isSelected = editing && selectedId === el.id;

    const onElMouseDown = (e: React.MouseEvent) => {
      if (!editing) return;
      e.stopPropagation();
      setSelectedId(el.id);
      dragRef.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
    };

    const handles = isSelected ? ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(h => {
      const hStyle: React.CSSProperties = {
        position: 'absolute', width: 8, height: 8, background: '#2563eb', border: '1px solid #fff',
        borderRadius: 2, zIndex: 10, cursor: `${h}-resize`,
        ...( h.includes('n') && !h.includes('e') && !h.includes('w') ? { top: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
        ...( h === 'ne' ? { top: -4, right: -4 } : {}),
        ...( h.includes('e') && !h.includes('n') && !h.includes('s') ? { right: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
        ...( h === 'se' ? { bottom: -4, right: -4 } : {}),
        ...( h.includes('s') && !h.includes('e') && !h.includes('w') ? { bottom: -4, left: '50%', transform: 'translateX(-50%)' } : {}),
        ...( h === 'sw' ? { bottom: -4, left: -4 } : {}),
        ...( h.includes('w') && !h.includes('n') && !h.includes('s') ? { left: -4, top: '50%', transform: 'translateY(-50%)' } : {}),
        ...( h === 'nw' ? { top: -4, left: -4 } : {}),
      };
      return (
        <div
          key={h}
          style={hStyle}
          onMouseDown={e2 => {
            e2.stopPropagation();
            resizeRef.current = { id: el.id, handle: h, startX: e2.clientX, startY: e2.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h };
          }}
        />
      );
    }) : null;

    const elStyle: React.CSSProperties = {
      position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
      opacity: el.opacity ?? 1,
      cursor: editing ? 'move' : 'default',
      boxSizing: 'border-box',
      outline: isSelected ? '2px solid #2563eb' : 'none',
      outlineOffset: 2,
      userSelect: 'none',
    };

    if (el.type === 'text') {
      const displayText = resolveText(el.content || '', varValues);
      return (
        <div key={el.id} style={elStyle} onMouseDown={onElMouseDown}>
          {handles}
          <div style={{
            width: '100%', height: '100%',
            fontSize: el.fontSize, color: el.color,
            fontWeight: el.bold ? '700' : '400',
            fontStyle: el.italic ? 'italic' : 'normal',
            textAlign: el.align || 'left',
            fontFamily: el.fontFamily || 'Georgia',
            lineHeight: 1.25, wordBreak: 'break-word', overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            {displayText}
          </div>
          {isSelected && editing && (
            <div style={{ position: 'absolute', top: -28, left: 0, background: '#2563eb', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', fontFamily: 'Arial' }}>
              {el.content}
            </div>
          )}
        </div>
      );
    }

    if (el.type === 'qr') {
      return (
        <div key={el.id} style={elStyle} onMouseDown={onElMouseDown}>
          {handles}
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <QRCodeSVG value={qrData} size={el.w} />
          </div>
        </div>
      );
    }

    if (el.type === 'image' && el.src) {
      return (
        <div key={el.id} style={elStyle} onMouseDown={onElMouseDown}>
          {handles}
          <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: el.borderRadius || 0, pointerEvents: 'none', display: 'block' }} />
        </div>
      );
    }

    return null;
  };

  // ── Property panel ──────────────────────────────────────────────────────────
  const PropPanel = () => {
    if (!selected) return (
      <div className="text-center py-12 text-slate-400">
        <Move size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-[11px] font-bold uppercase tracking-widest">Select an element</p>
        <p className="text-[10px] mt-1">to edit its properties</p>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 capitalize">{selected.type} Element</span>
          <div className="flex gap-1">
            <button onClick={() => moveLayer(selected.id, 'down')} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all" title="Send backward"><Layers size={12} /></button>
            <button onClick={() => duplicateEl(selected.id)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all" title="Duplicate"><Copy size={12} /></button>
            <button onClick={() => deleteEl(selected.id)} className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 transition-all" title="Delete"><Trash2 size={12} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[['X', 'x'], ['Y', 'y'], ['W', 'w'], ['H', 'h']].map(([label, key]) => (
            <div key={key}>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{label}</label>
              <input
                type="number"
                value={(selected as any)[key]}
                onChange={e => updateEl(selected.id, { [key]: Number(e.target.value) } as any)}
                className="w-full text-[11px] border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-300"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Opacity</label>
          <input type="range" min={0.1} max={1} step={0.05} value={selected.opacity ?? 1} onChange={e => updateEl(selected.id, { opacity: Number(e.target.value) })} className="w-full accent-indigo-600" />
        </div>

        {selected.type === 'text' && (
          <>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Content / Variable</label>
              <textarea
                value={selected.content || ''}
                onChange={e => updateEl(selected.id, { content: e.target.value })}
                rows={2}
                className="w-full text-[11px] border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-300 resize-none"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {VARS.map(v => (
                  <button
                    key={v.key}
                    onClick={() => updateEl(selected.id, { content: v.key })}
                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[8px] font-black hover:bg-indigo-100 transition-all"
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Font Size</label>
                <input type="number" min={8} max={120} value={selected.fontSize || 24} onChange={e => updateEl(selected.id, { fontSize: Number(e.target.value) })} className="w-full text-[11px] border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-300" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={selected.color || '#1a1a1a'} onChange={e => updateEl(selected.id, { color: e.target.value })} className="w-9 h-9 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5" />
                  <span className="text-[9px] text-slate-400 font-mono">{selected.color}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Font</label>
              <select value={selected.fontFamily || 'Georgia'} onChange={e => updateEl(selected.id, { fontFamily: e.target.value })} className="w-full text-[11px] border border-slate-200 rounded-xl px-2 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-300">
                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={() => updateEl(selected.id, { bold: !selected.bold })} className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 ${selected.bold ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                <Bold size={12} /> Bold
              </button>
              <button onClick={() => updateEl(selected.id, { italic: !selected.italic })} className={`flex-1 py-2 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-1 ${selected.italic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                <Italic size={12} /> Italic
              </button>
            </div>

            <div className="flex gap-2">
              {(['left', 'center', 'right'] as const).map(a => {
                const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                return (
                  <button key={a} onClick={() => updateEl(selected.id, { align: a })} className={`flex-1 py-2 rounded-xl border text-[10px] font-black transition-all flex items-center justify-center ${selected.align === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                    <Icon size={13} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {selected.type === 'image' && (
          <>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Corner Radius</label>
              <input type="range" min={0} max={200} value={selected.borderRadius ?? 0} onChange={e => updateEl(selected.id, { borderRadius: Number(e.target.value) })} className="w-full accent-indigo-600" />
            </div>
            <button onClick={() => imgInputRef.current?.click()} className="w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
              <Upload size={12} /> Replace Image
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-4 h-full">
      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Add Elements</div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => addText('Custom text')} className="flex flex-col items-center gap-1.5 py-3 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700">
            <Type size={18} />
            <span className="text-[9px] font-black uppercase tracking-widest">Text</span>
          </button>
          <button onClick={addQr} className="flex flex-col items-center gap-1.5 py-3 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700">
            <QrCode size={18} />
            <span className="text-[9px] font-black uppercase tracking-widest">QR Code</span>
          </button>
          <button onClick={() => imgInputRef.current?.click()} className="flex flex-col items-center gap-1.5 py-3 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700">
            <ImgIcon size={18} />
            <span className="text-[9px] font-black uppercase tracking-widest">Image</span>
          </button>
          <button onClick={() => bgInputRef.current?.click()} className="flex flex-col items-center gap-1.5 py-3 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700">
            <Upload size={18} />
            <span className="text-[9px] font-black uppercase tracking-widest">Background</span>
          </button>
        </div>

        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Quick Add Field</div>
          <div className="flex flex-wrap gap-1">
            {VARS.map(v => (
              <button key={v.key} onClick={() => addVar(v.key)} className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[8px] font-black hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all flex items-center gap-1">
                <Plus size={8} /> {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Background Color</div>
          <div className="flex items-center gap-2">
            <input type="color" value={design.bgColor} onChange={e => updateDesign(d => ({ ...d, bgColor: e.target.value }))} className="w-10 h-10 rounded-xl border-2 border-slate-200 cursor-pointer p-0.5" />
            {design.bgImage && (
              <button onClick={() => updateDesign(d => ({ ...d, bgImage: undefined }))} className="text-[9px] text-rose-500 font-black hover:text-rose-700 transition-all flex items-center gap-1">
                <RotateCcw size={10} /> Remove BG Image
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Properties</div>
          <div className="max-h-[340px] overflow-y-auto pr-1">
            <PropPanel />
          </div>
        </div>

        <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Canvas — A4 Landscape</span>
            <span className="text-[9px] text-slate-400">{CANVAS_W}×{CANVAS_H}px</span>
            {design.elements.length > 0 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[8px] font-black">{design.elements.length} elements</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { if (confirm('Clear all elements and background?')) { updateDesign(() => ({ bgColor: '#ffffff', elements: [] })); setSelectedId(null); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 text-[9px] font-black uppercase tracking-widest transition-all"
            >
              <RotateCcw size={11} /> Reset
            </button>
            <button onClick={download} disabled={downloading} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-60">
              <Download size={11} /> {downloading ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 bg-slate-200 rounded-2xl p-4 flex items-start justify-center">
          <div style={{ transform: 'scale(1)', transformOrigin: 'top center' }}>
            <div
              ref={canvasRef}
              style={{
                width: CANVAS_W, height: CANVAS_H,
                position: 'relative',
                background: design.bgImage
                  ? `url(${design.bgImage}) center/cover no-repeat`
                  : design.bgColor,
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
                overflow: 'hidden',
                cursor: 'default',
                flexShrink: 0,
              }}
              onMouseDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
            >
              {design.elements.map(el => renderEl(el, true))}
            </div>
          </div>
        </div>

        {design.elements.length === 0 && (
          <div className="text-center text-slate-400 text-[11px] font-bold py-1">
            Upload a background template then add elements on top — drag to position, click to edit
          </div>
        )}
      </div>
    </div>
  );
}
