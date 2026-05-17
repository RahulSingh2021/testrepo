'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Trash2, Copy, Type, Image as ImgIcon, QrCode, Layers,
  Save, ArrowLeft, Upload, Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, Download, CheckCircle2,
  Edit2, MoreVertical, Bookmark, RotateCcw, Square, Circle, Minus,
  Eye, ChevronUp, ChevronDown, Lock, Unlock, X, Palette,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const CANVAS_W = 794;
const CANVAS_H = 562;
const STORE_KEY = 'haccppro_cert_studio_v1';
const GALLERY_KEY = 'haccppro_cert_gallery_v1';

export type ElType = 'text' | 'image' | 'qr' | 'shape';

export interface DesignEl {
  id: string;
  type: ElType;
  x: number; y: number; w: number; h: number;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  src?: string;
  objectFit?: 'contain' | 'cover';
  borderRadius?: number;
  shapeType?: 'rect' | 'circle' | 'line';
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  locked?: boolean;
}

export interface DesignTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  bgImage?: string;
  bgColor: string;
  elements: DesignEl[];
}

interface GalleryImage {
  id: string; src: string; name: string; addedAt: string;
}

const TEMPLATE_VARS = [
  { key: '{{name}}', label: 'Name' },
  { key: '{{topic}}', label: 'Topic' },
  { key: '{{trainer}}', label: 'Trainer' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{timeFrom}}', label: 'From' },
  { key: '{{timeTo}}', label: 'To' },
  { key: '{{location}}', label: 'Location' },
  { key: '{{certId}}', label: 'Cert ID' },
  { key: '{{org}}', label: 'Organisation' },
  { key: '{{designation}}', label: 'Designation' },
];

const FONTS = ['Georgia', 'Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Palatino', 'Garamond'];

const uid = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const tid = () => `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function loadTemplates(): DesignTemplate[] {
  if (typeof window === 'undefined') return [];
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function cacheTemplates(t: DesignTemplate[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(t)); } catch {}
}
function cacheGallery(g: GalleryImage[]) {
  try { localStorage.setItem(GALLERY_KEY, JSON.stringify(g)); } catch {}
}

async function fetchTemplatesFromDB(): Promise<DesignTemplate[]> {
  try {
    const res = await fetch('/api/cert-templates');
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data.items || []) as DesignTemplate[];
    cacheTemplates(items);
    return items;
  } catch { return loadTemplates(); }
}

async function saveTemplateToDB(t: DesignTemplate): Promise<boolean> {
  try {
    const res = await fetch('/api/cert-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    if (!res.ok) { console.error('Save cert template failed:', res.status); return false; }
    return true;
  } catch (e) { console.error('Failed to save cert template:', e); return false; }
}

async function deleteTemplateFromDB(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/cert-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { console.error('Delete cert template failed:', res.status); return false; }
    return true;
  } catch (e) { console.error('Failed to delete cert template:', e); return false; }
}

async function fetchGalleryFromDB(): Promise<GalleryImage[]> {
  try {
    const res = await fetch('/api/cert-gallery');
    if (!res.ok) return [];
    const data = await res.json();
    const items = (data.items || []) as GalleryImage[];
    cacheGallery(items);
    return items;
  } catch {
    try { const r = localStorage.getItem(GALLERY_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  }
}

async function saveGalleryImageToDB(img: GalleryImage): Promise<boolean> {
  try {
    const res = await fetch('/api/cert-gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(img),
    });
    if (!res.ok) { console.error('Save gallery image failed:', res.status); return false; }
    return true;
  } catch (e) { console.error('Failed to save gallery image:', e); return false; }
}

async function deleteGalleryImageFromDB(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/cert-gallery', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { console.error('Delete gallery image failed:', res.status); return false; }
    return true;
  } catch (e) { console.error('Failed to delete gallery image:', e); return false; }
}

async function backfillLocalStorageToDB() {
  const localTemplates = loadTemplates();
  if (localTemplates.length > 0) {
    for (const t of localTemplates) {
      await saveTemplateToDB(t);
    }
  }
  try {
    const r = localStorage.getItem(GALLERY_KEY);
    const localGallery: GalleryImage[] = r ? JSON.parse(r) : [];
    for (const img of localGallery) {
      await saveGalleryImageToDB(img);
    }
  } catch {}
}

function EditableText({ value, onChange, style, multiline, editing }: {
  value: string; onChange: (v: string) => void; style?: React.CSSProperties; multiline?: boolean; editing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const wasEditing = useRef(false);
  const lastText = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const sel = window.getSelection();
      if (sel) { sel.selectAllChildren(ref.current); sel.collapseToEnd(); }
    }
    if (wasEditing.current && !editing && ref.current) {
      const text = ref.current.textContent ?? '';
      if (text !== lastText.current) {
        onChangeRef.current(text);
      }
    }
    wasEditing.current = !!editing;
  }, [editing]);
  const sync = () => {
    if (!composing.current) {
      const text = ref.current?.textContent ?? '';
      lastText.current = text;
      onChangeRef.current(text);
    }
  };
  return (
    <div
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onInput={sync}
      onBlur={sync}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; sync(); }}
      onKeyDown={e => { if (!multiline && e.key === 'Enter') e.preventDefault(); }}
      style={{ outline: 'none', cursor: editing ? 'text' : 'inherit', minHeight: '1em', wordBreak: 'break-word', pointerEvents: editing ? 'auto' : 'none', ...style }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALLERY VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function GalleryView({ templates, onNew, onEdit, onDelete, onPublish, onDuplicate }: {
  templates: DesignTemplate[];
  onNew: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
  onPublish: (id: string) => void; onDuplicate: (id: string) => void;
}) {
  const published = templates.filter(t => t.published);
  const drafts = templates.filter(t => !t.published);

  const TemplateCard = ({ t }: { t: DesignTemplate }) => {
    const [menu, setMenu] = useState(false);
    return (
      <div className="group bg-white rounded-2xl border-2 border-slate-100 hover:border-indigo-200 overflow-hidden transition-all hover:shadow-lg relative">
        <div
          className="h-40 bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={() => onEdit(t.id)}
          style={t.bgImage ? { backgroundImage: `url(${t.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: t.bgColor }}
        >
          {!t.bgImage && t.elements.length === 0 && (
            <div className="text-slate-300 text-center">
              <Square size={32} className="mx-auto mb-2" />
              <span className="text-[9px] font-black uppercase tracking-widest">Empty Canvas</span>
            </div>
          )}
          {t.elements.length > 0 && !t.bgImage && (
            <div className="text-[9px] text-slate-400 font-bold">{t.elements.length} elements</div>
          )}
        </div>
        <div className="p-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-800 truncate">{t.name}</span>
              {t.published && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[7px] font-black uppercase">Published</span>}
            </div>
            <div className="text-[8px] text-slate-400 mt-0.5">{new Date(t.updatedAt).toLocaleDateString()}</div>
          </div>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} aria-label="Template options" className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
              <MoreVertical size={14} className="text-slate-400" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white rounded-xl border border-slate-200 shadow-xl py-1 w-36">
                  <button onClick={() => { onEdit(t.id); setMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit2 size={11} /> Edit</button>
                  <button onClick={() => { onDuplicate(t.id); setMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Copy size={11} /> Duplicate</button>
                  <button onClick={() => { onPublish(t.id); setMenu(false); }} className="w-full px-3 py-2 text-left text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"><CheckCircle2 size={11} /> {t.published ? 'Unpublish' : 'Publish'}</button>
                  <button onClick={() => { if (confirm(`Delete "${t.name}"?`)) { onDelete(t.id); setMenu(false); } }} className="w-full px-3 py-2 text-left text-[10px] font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={11} /> Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Certificate Templates</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''} &middot; {published.length} published</p>
        </div>
        <button onClick={onNew} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
          <Plus size={14} /> New Template
        </button>
      </div>

      {published.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2"><CheckCircle2 size={12} /> Published</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {published.map(t => <TemplateCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Edit2 size={12} /> Drafts</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {drafts.map(t => <TemplateCard key={t.id} t={t} />)}
          </div>
        </div>
      )}

      {templates.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <Palette size={40} className="mx-auto mb-4 text-slate-200" />
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-2">No Certificate Templates</p>
          <p className="text-[11px] text-slate-400 mb-6">Create your first certificate template to get started</p>
          <button onClick={onNew} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
            <Plus size={14} className="inline mr-2" /> Create Template
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function EditorView({ template: initTemplate, gallery, onSave, onPublish, onBack, onGalleryUpdate }: {
  template: DesignTemplate;
  gallery: GalleryImage[];
  onSave: (t: DesignTemplate) => void;
  onPublish: (t: DesignTemplate) => void;
  onBack: () => void;
  onGalleryUpdate: (g: GalleryImage[]) => void;
}) {
  const [tmpl, setTmplRaw] = useState<DesignTemplate>(() => ({
    ...initTemplate,
    elements: initTemplate.elements.map(e => ({ ...e })),
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [leftTab, setLeftTab] = useState<'elements' | 'gallery'>('elements');
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ id: string; handle: string; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const elementsRef = useRef(tmpl.elements);
  const rafRef = useRef<number>(0);
  const tmplRef = useRef(tmpl);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onPublishRef = useRef(onPublish);
  onPublishRef.current = onPublish;
  const dirtyRef = useRef(false);

  const setTmpl = useCallback((updater: DesignTemplate | ((prev: DesignTemplate) => DesignTemplate)) => {
    const prev = tmplRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    tmplRef.current = next;
    elementsRef.current = next.elements;
    dirtyRef.current = true;
    setTmplRaw(next);
  }, []);

  const selected = tmpl.elements.find(e => e.id === selectedId) ?? null;

  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!dirtyRef.current) return;
    autoSaveTimer.current = setTimeout(() => {
      const cur = tmplRef.current;
      const updated: DesignTemplate = { ...cur, updatedAt: new Date().toISOString(), elements: cur.elements.map(el => ({ ...el })) };
      onSaveRef.current(updated);
      dirtyRef.current = false;
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmpl]);

  const updateEl = useCallback((id: string, patch: Partial<DesignEl>) => {
    setTmpl(prev => ({ ...prev, elements: prev.elements.map(e => e.id === id ? { ...e, ...patch } : e), updatedAt: new Date().toISOString() }));
  }, [setTmpl]);

  // ── Drag / Resize handlers (registered once) ─────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current && !resizeRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (dragRef.current) {
          const { id, sx, sy, ox, oy } = dragRef.current;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const scale = rect.width / CANVAS_W;
          const el = elementsRef.current.find(el => el.id === id);
          if (!el || el.locked) return;
          const nx = Math.max(0, Math.min(CANVAS_W - el.w, ox + (e.clientX - sx) / scale));
          const ny = Math.max(0, Math.min(CANVAS_H - el.h, oy + (e.clientY - sy) / scale));
          setTmpl(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, x: Math.round(nx), y: Math.round(ny) } : el) }));
        }
        if (resizeRef.current) {
          const { id, handle, sx, sy, ox, oy, ow, oh } = resizeRef.current;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;
          const scale = rect.width / CANVAS_W;
          const dx = (e.clientX - sx) / scale, dy = (e.clientY - sy) / scale;
          let nx = ox, ny = oy, nw = ow, nh = oh;
          if (handle.includes('e')) nw = Math.max(20, ow + dx);
          if (handle.includes('s')) nh = Math.max(20, oh + dy);
          if (handle.includes('w')) { nw = Math.max(20, ow - dx); nx = ox + ow - nw; }
          if (handle.includes('n')) { nh = Math.max(20, oh - dy); ny = oy + oh - nh; }
          setTmpl(prev => ({ ...prev, elements: prev.elements.map(el => el.id === id ? { ...el, x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) } : el) }));
        }
      });
    };
    const onUp = () => { dragRef.current = null; resizeRef.current = null; if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; } };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Element CRUD ───────────────────────────────────────────────────────────
  const addEl = (el: DesignEl) => {
    setTmpl(prev => ({ ...prev, elements: [...prev.elements, el], updatedAt: new Date().toISOString() }));
    setSelectedId(el.id);
  };

  const addText = (content = 'Click to edit') => addEl({ id: uid(), type: 'text', x: 60, y: 80, w: 350, h: 50, content, fontSize: 28, fontFamily: 'Georgia', color: '#1a1a1a', bold: false, italic: false, underline: false, align: 'center', lineHeight: 1.3, opacity: 1 });
  const addVar = (key: string) => addEl({ id: uid(), type: 'text', x: 100, y: 200, w: 400, h: 60, content: key, fontSize: 36, fontFamily: 'Georgia', color: '#1a1a1a', bold: true, italic: false, underline: false, align: 'center', lineHeight: 1.2, opacity: 1 });
  const addQr = () => addEl({ id: uid(), type: 'qr', x: CANVAS_W - 110, y: CANVAS_H - 110, w: 90, h: 90, opacity: 1 });
  const addShape = (shapeType: 'rect' | 'circle') => addEl({ id: uid(), type: 'shape', x: 100, y: 100, w: 200, h: 80, shapeType, bgColor: '#004f52', borderColor: 'transparent', borderWidth: 0, borderRadius: shapeType === 'circle' ? 999 : 8, opacity: 1 });
  const addLine = () => addEl({ id: uid(), type: 'shape', x: 100, y: 200, w: 300, h: 4, shapeType: 'line', bgColor: '#1a1a1a', borderColor: 'transparent', borderWidth: 0, borderRadius: 0, opacity: 1 });

  const addImgFromGallery = (src: string) => addEl({ id: uid(), type: 'image', x: 50, y: 50, w: 150, h: 150, src, objectFit: 'contain', borderRadius: 0, opacity: 1 });

  const deleteEl = (id: string) => { setTmpl(prev => ({ ...prev, elements: prev.elements.filter(e => e.id !== id) })); setSelectedId(null); setEditingTextId(null); };
  const duplicateEl = (id: string) => {
    const el = tmpl.elements.find(e => e.id === id);
    if (!el) return;
    const ne = { ...el, id: uid(), x: el.x + 12, y: el.y + 12 };
    setTmpl(prev => ({ ...prev, elements: [...prev.elements, ne] }));
    setSelectedId(ne.id);
  };

  const moveLayer = (id: string, dir: 'up' | 'down') => {
    setTmpl(prev => {
      const els = [...prev.elements];
      const i = els.findIndex(e => e.id === id);
      if (dir === 'up' && i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
      if (dir === 'down' && i > 0) [els[i], els[i - 1]] = [els[i - 1], els[i]];
      return { ...prev, elements: els };
    });
  };

  // ── Image uploads ────────────────────────────────────────────────────────────
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setTmpl(prev => ({ ...prev, bgImage: ev.target?.result as string, updatedAt: new Date().toISOString() }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      addEl({ id: uid(), type: 'image', x: 50, y: 50, w: 150, h: 150, src, objectFit: 'contain', borderRadius: 0, opacity: 1 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const newGallery = [...gallery];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        newGallery.push({ id: uid(), src: ev.target?.result as string, name: file.name, addedAt: new Date().toISOString() });
        onGalleryUpdate([...newGallery]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const deleteGalleryImg = (id: string) => {
    onGalleryUpdate(gallery.filter(g => g.id !== id));
  };

  const flushSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const cur = tmplRef.current;
    const updated: DesignTemplate = { ...cur, updatedAt: new Date().toISOString(), elements: cur.elements.map(el => ({ ...el })) };
    onSaveRef.current(updated);
    dirtyRef.current = false;
    return updated;
  }, []);

  // ── Save / Publish ─────────────────────────────────────────────────────────
  const handleSave = () => {
    const updated = flushSave();
    setTmpl(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handlePublish = () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    const cur = tmplRef.current;
    const updated: DesignTemplate = { ...cur, published: true, updatedAt: new Date().toISOString(), elements: cur.elements.map(el => ({ ...el })) };
    onPublishRef.current(updated);
    setTmpl(updated);
    dirtyRef.current = false;
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    const prev = selectedId;
    setSelectedId(null);
    try {
      await new Promise(r => setTimeout(r, 100));
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(canvasRef.current, { scale: 4, useCORS: true, backgroundColor: '#ffffff', logging: false, imageTimeout: 0, allowTaint: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
      pdf.save(`Template_${tmpl.name.replace(/\s+/g, '_')}.pdf`);
    } finally { setDownloading(false); setSelectedId(prev); }
  };

  // ── Render element ───────────────────────────────────────────────────────────
  const renderElement = (el: DesignEl) => {
    const isSel = selectedId === el.id;
    const elStyle: React.CSSProperties = {
      position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
      opacity: el.opacity ?? 1, cursor: el.locked ? 'not-allowed' : 'move',
      outline: isSel ? '2px solid #4f46e5' : 'none', outlineOffset: 1,
      userSelect: 'none', boxSizing: 'border-box',
    };

    const onDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (editingTextId === el.id) return;
      setSelectedId(el.id);
      setEditingTextId(null);
      if (el.locked) return;
      dragRef.current = { id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
    };

    const handles = isSel && !el.locked ? ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map(h => {
      const s: React.CSSProperties = { position: 'absolute', width: 8, height: 8, background: '#4f46e5', border: '1px solid #fff', borderRadius: 2, zIndex: 10, cursor: `${h}-resize` };
      if (h.includes('n') && !h.includes('e') && !h.includes('w')) Object.assign(s, { top: -4, left: '50%', transform: 'translateX(-50%)' });
      if (h === 'ne') Object.assign(s, { top: -4, right: -4 });
      if (h.includes('e') && !h.includes('n') && !h.includes('s')) Object.assign(s, { right: -4, top: '50%', transform: 'translateY(-50%)' });
      if (h === 'se') Object.assign(s, { bottom: -4, right: -4 });
      if (h.includes('s') && !h.includes('e') && !h.includes('w')) Object.assign(s, { bottom: -4, left: '50%', transform: 'translateX(-50%)' });
      if (h === 'sw') Object.assign(s, { bottom: -4, left: -4 });
      if (h.includes('w') && !h.includes('n') && !h.includes('s')) Object.assign(s, { left: -4, top: '50%', transform: 'translateY(-50%)' });
      if (h === 'nw') Object.assign(s, { top: -4, left: -4 });
      return <div key={h} style={s} onMouseDown={e2 => { e2.stopPropagation(); resizeRef.current = { id: el.id, handle: h, sx: e2.clientX, sy: e2.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h }; }} />;
    }) : null;

    if (el.type === 'text') {
      const isEditing = editingTextId === el.id;
      return (
        <div key={el.id} style={{ ...elStyle, cursor: isEditing ? 'text' : (el.locked ? 'not-allowed' : 'move') }}
          onMouseDown={onDown}
          onDoubleClick={e => { e.stopPropagation(); if (!el.locked) setEditingTextId(el.id); }}
        >
          {handles}
          <EditableText
            value={el.content || ''}
            onChange={v => updateEl(el.id, { content: v })}
            multiline
            editing={isEditing}
            style={{
              width: '100%', height: '100%', fontSize: el.fontSize, fontFamily: el.fontFamily,
              color: el.color, fontWeight: el.bold ? '700' : '400', fontStyle: el.italic ? 'italic' : 'normal',
              textDecoration: el.underline ? 'underline' : 'none', textAlign: el.align || 'left',
              lineHeight: el.lineHeight || 1.3, overflow: 'hidden',
            }}
          />
          {isSel && !isEditing && (
            <div style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 9, color: '#6366f1', fontWeight: 700, background: '#eef2ff', padding: '1px 6px', borderRadius: 4, pointerEvents: 'none' }}>
              Double-click to edit text
            </div>
          )}
        </div>
      );
    }

    if (el.type === 'image' && el.src) {
      return (
        <div key={el.id} style={elStyle} onMouseDown={onDown}>
          {handles}
          <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain', borderRadius: el.borderRadius || 0, pointerEvents: 'none', display: 'block' }} />
        </div>
      );
    }

    if (el.type === 'qr') {
      return (
        <div key={el.id} style={elStyle} onMouseDown={onDown}>
          {handles}
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <QRCodeSVG value="https://haccppro.in/verify/{{certId}}" size={Math.min(el.w, el.h)} />
          </div>
        </div>
      );
    }

    if (el.type === 'shape') {
      return (
        <div key={el.id} style={{ ...elStyle, background: el.bgColor, borderRadius: el.borderRadius || 0, border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : 'none' }} onMouseDown={onDown}>
          {handles}
        </div>
      );
    }
    return null;
  };

  // ── Properties panel ───────────────────────────────────────────────────────
  const PropsPanel = () => {
    if (!selected) return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-300">
        <Eye size={28} className="mb-3" />
        <p className="text-[10px] font-black uppercase tracking-widest">Select an element</p>
      </div>
    );

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 capitalize">{selected.type}</span>
          <div className="flex gap-1">
            <button onClick={() => updateEl(selected.id, { locked: !selected.locked })} aria-label={selected.locked ? 'Unlock element' : 'Lock element'} className="p-1 rounded bg-slate-100 hover:bg-slate-200 transition-all" title={selected.locked ? 'Unlock' : 'Lock'}>
              {selected.locked ? <Lock size={10} className="text-rose-500" /> : <Unlock size={10} className="text-slate-400" />}
            </button>
            <button onClick={() => moveLayer(selected.id, 'up')} aria-label="Bring layer forward" className="p-1 rounded bg-slate-100 hover:bg-slate-200 transition-all" title="Bring Forward"><ChevronUp size={10} /></button>
            <button onClick={() => moveLayer(selected.id, 'down')} aria-label="Send layer back" className="p-1 rounded bg-slate-100 hover:bg-slate-200 transition-all" title="Send Back"><ChevronDown size={10} /></button>
            <button onClick={() => duplicateEl(selected.id)} aria-label="Duplicate element" className="p-1 rounded bg-slate-100 hover:bg-slate-200 transition-all" title="Duplicate"><Copy size={10} /></button>
            <button onClick={() => deleteEl(selected.id)} aria-label="Delete element" className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-500 transition-all" title="Delete"><Trash2 size={10} /></button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(['x', 'y', 'w', 'h'] as const).map(k => (
            <div key={k}>
              <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">{k}</label>
              <input type="number" value={selected[k]} onChange={e => updateEl(selected.id, { [k]: Number(e.target.value) } as any)} className="w-full text-[10px] border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-300" />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Opacity</label>
          <input type="range" min={0.05} max={1} step={0.05} value={selected.opacity ?? 1} onChange={e => updateEl(selected.id, { opacity: Number(e.target.value) })} className="w-full accent-indigo-500" />
        </div>

        {selected.type === 'text' && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Font Size</label>
                <input type="number" min={8} max={120} value={selected.fontSize || 24} onChange={e => updateEl(selected.id, { fontSize: Number(e.target.value) })} className="w-full text-[10px] border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-300" />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Color</label>
                <input type="color" value={selected.color || '#1a1a1a'} onChange={e => updateEl(selected.id, { color: e.target.value })} className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Font Family</label>
              <select value={selected.fontFamily || 'Georgia'} onChange={e => updateEl(selected.id, { fontFamily: e.target.value })} className="w-full text-[10px] border border-slate-200 rounded-lg px-1.5 py-1 text-slate-700 focus:outline-none focus:border-indigo-300">
                {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Line Height</label>
              <input type="range" min={0.8} max={2.5} step={0.1} value={selected.lineHeight || 1.3} onChange={e => updateEl(selected.id, { lineHeight: Number(e.target.value) })} className="w-full accent-indigo-500" />
            </div>
            <div className="flex gap-1">
              <button onClick={() => updateEl(selected.id, { bold: !selected.bold })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black border transition-all ${selected.bold ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}><Bold size={11} className="mx-auto" /></button>
              <button onClick={() => updateEl(selected.id, { italic: !selected.italic })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black border transition-all ${selected.italic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}><Italic size={11} className="mx-auto" /></button>
              <button onClick={() => updateEl(selected.id, { underline: !selected.underline })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black border transition-all ${selected.underline ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}><UnderlineIcon size={11} className="mx-auto" /></button>
            </div>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map(a => {
                const I = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                return <button key={a} onClick={() => updateEl(selected.id, { align: a })} className={`flex-1 py-1.5 rounded-lg border text-[9px] transition-all ${selected.align === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}><I size={11} className="mx-auto" /></button>;
              })}
            </div>
          </>
        )}

        {selected.type === 'image' && (
          <>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Fit</label>
              <div className="flex gap-1">
                {(['contain', 'cover'] as const).map(f => (
                  <button key={f} onClick={() => updateEl(selected.id, { objectFit: f })} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-black capitalize transition-all ${selected.objectFit === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Radius</label>
              <input type="range" min={0} max={200} value={selected.borderRadius ?? 0} onChange={e => updateEl(selected.id, { borderRadius: Number(e.target.value) })} className="w-full accent-indigo-500" />
            </div>
          </>
        )}

        {selected.type === 'shape' && (
          <>
            {selected.shapeType === 'line' ? (
              <>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Color</label>
                  <input type="color" value={selected.bgColor || '#1a1a1a'} onChange={e => updateEl(selected.id, { bgColor: e.target.value })} className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Thickness ({selected.h}px)</label>
                  <input type="range" min={1} max={20} value={selected.h} onChange={e => updateEl(selected.id, { h: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Fill</label>
                    <input type="color" value={selected.bgColor || '#004f52'} onChange={e => updateEl(selected.id, { bgColor: e.target.value })} className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Border</label>
                    <input type="color" value={selected.borderColor || '#000000'} onChange={e => updateEl(selected.id, { borderColor: e.target.value })} className="w-full h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                  </div>
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Border Width</label>
                  <input type="range" min={0} max={10} value={selected.borderWidth ?? 0} onChange={e => updateEl(selected.id, { borderWidth: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Radius</label>
                  <input type="range" min={0} max={200} value={selected.borderRadius ?? 0} onChange={e => updateEl(selected.id, { borderRadius: Number(e.target.value) })} className="w-full accent-indigo-500" />
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { flushSave(); onBack(); }} aria-label="Back to templates" className="p-2 rounded-xl hover:bg-slate-100 transition-all"><ArrowLeft size={16} className="text-slate-500" /></button>
          <input
            type="text"
            value={tmpl.name}
            onChange={e => setTmpl(prev => ({ ...prev, name: e.target.value }))}
            className="text-sm font-black text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none px-1 py-0.5 transition-all"
          />
          {tmpl.published && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[7px] font-black uppercase">Published</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-slate-400">{tmpl.elements.length} elements</span>
          <button onClick={handleDownload} disabled={downloading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-60">
            <Download size={11} /> {downloading ? '…' : 'Preview PDF'}
          </button>
          <button onClick={handleSave} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            <Save size={11} /> {saved ? 'Saved!' : 'Save'}
          </button>
          <button onClick={handlePublish} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
            <CheckCircle2 size={11} /> {tmpl.published ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">

        {/* Left panel */}
        <div className="w-52 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex border-b border-slate-100">
            {(['elements', 'gallery'] as const).map(t => (
              <button key={t} onClick={() => setLeftTab(t)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${leftTab === t ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {leftTab === 'elements' && (
              <>
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Add Elements</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { icon: <Type size={14} />, label: 'Text', fn: () => addText() },
                    { icon: <ImgIcon size={14} />, label: 'Image', fn: () => imgInputRef.current?.click() },
                    { icon: <QrCode size={14} />, label: 'QR Code', fn: addQr },
                    { icon: <Square size={14} />, label: 'Rectangle', fn: () => addShape('rect') },
                    { icon: <Circle size={14} />, label: 'Circle', fn: () => addShape('circle') },
                    { icon: <Minus size={14} />, label: 'Line', fn: addLine },
                    { icon: <Upload size={14} />, label: 'BG Image', fn: () => bgInputRef.current?.click() },
                  ].map(({ icon, label, fn }) => (
                    <button key={label} onClick={fn} className="flex flex-col items-center gap-1 py-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50 transition-all text-slate-600 hover:text-indigo-700">
                      {icon}
                      <span className="text-[7px] font-black uppercase tracking-widest">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-3 mb-1">Template Variables</div>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATE_VARS.map(v => (
                    <button key={v.key} onClick={() => addVar(v.key)} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[7px] font-black hover:bg-indigo-100 transition-all flex items-center gap-0.5">
                      <Plus size={7} /> {v.label}
                    </button>
                  ))}
                </div>

                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-3 mb-1">Background</div>
                <div className="flex items-center gap-2">
                  <input type="color" value={tmpl.bgColor} onChange={e => setTmpl(prev => ({ ...prev, bgColor: e.target.value }))} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5" />
                  {tmpl.bgImage && (
                    <button onClick={() => setTmpl(prev => ({ ...prev, bgImage: undefined }))} className="text-[8px] text-rose-500 font-black hover:text-rose-700 flex items-center gap-1"><X size={8} /> Remove BG</button>
                  )}
                </div>
              </>
            )}

            {leftTab === 'gallery' && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Image Gallery</span>
                  <button onClick={() => galleryInputRef.current?.click()} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[7px] font-black hover:bg-indigo-100 transition-all flex items-center gap-1">
                    <Upload size={8} /> Upload
                  </button>
                </div>
                {gallery.length === 0 && (
                  <div className="text-center py-8 text-slate-300">
                    <ImgIcon size={24} className="mx-auto mb-2" />
                    <p className="text-[8px] font-black uppercase tracking-widest">No images yet</p>
                    <p className="text-[7px] mt-1">Upload images to reuse across templates</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  {gallery.map(img => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-100 bg-slate-50 aspect-square cursor-pointer hover:border-indigo-300 transition-all" onClick={() => addImgFromGallery(img.src)}>
                      <img src={img.src} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Plus size={16} className="text-white" />
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteGalleryImg(img.id); }} className="absolute top-1 right-1 p-0.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100">
                        <X size={10} className="text-rose-500" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                        <span className="text-[6px] text-white font-bold truncate block">{img.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Canvas with rulers */}
        <div className="flex-1 flex items-start justify-center overflow-auto bg-slate-200 rounded-2xl p-4 min-w-0">
          <div style={{ display: 'inline-flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Coordinate display */}
            <div className="flex items-center gap-3 mb-1">
              <div className="text-[9px] font-mono text-slate-400 bg-white/80 px-2 py-0.5 rounded" style={{ minWidth: 70 }}>
                {selected ? `X:${Math.round(selected.x)} Y:${Math.round(selected.y)}` : `${CANVAS_W}×${CANVAS_H}`}
              </div>
              {selected && (
                <>
                  <div className="text-[9px] font-mono text-slate-400 bg-white/80 px-2 py-0.5 rounded">
                    W:{Math.round(selected.w)} H:{Math.round(selected.h)}
                  </div>
                  <div className="text-[9px] font-mono text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded">
                    C:{Math.round(selected.x + selected.w / 2)},{Math.round(selected.y + selected.h / 2)}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: 'flex' }}>
              {/* Left ruler */}
              <div style={{ width: 20, height: CANVAS_H, position: 'relative', background: '#f8f9fa', borderRight: '1px solid #d1d5db', flexShrink: 0 }}>
                {Array.from({ length: Math.floor(CANVAS_H / 50) + 1 }, (_, i) => (
                  <React.Fragment key={i}>
                    <div style={{ position: 'absolute', top: i * 50, left: 0, width: '100%', height: 1, background: '#94a3b8' }} />
                    <span style={{ position: 'absolute', top: i * 50 + 2, left: 2, fontSize: 7, color: '#64748b', fontFamily: 'monospace', lineHeight: 1 }}>{i * 50}</span>
                  </React.Fragment>
                ))}
                {Array.from({ length: Math.floor(CANVAS_H / 10) }, (_, i) => (
                  <div key={`s${i}`} style={{ position: 'absolute', top: i * 10, right: 0, width: i % 5 === 0 ? '100%' : '40%', height: 1, background: i % 5 === 0 ? '#94a3b8' : '#cbd5e1' }} />
                ))}
                {selected && (
                  <>
                    <div style={{ position: 'absolute', top: selected.y, left: 0, width: '100%', height: 2, background: '#ef4444', zIndex: 5, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: selected.y + selected.h, left: 0, width: '100%', height: 1, background: '#ef444480', zIndex: 5, pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: selected.y + selected.h / 2, left: 0, width: '100%', height: 2, background: '#10b981', zIndex: 5, pointerEvents: 'none' }} />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Top ruler */}
                <div style={{ width: CANVAS_W, height: 20, position: 'relative', background: '#f8f9fa', borderBottom: '1px solid #d1d5db', flexShrink: 0 }}>
                  {Array.from({ length: Math.floor(CANVAS_W / 50) + 1 }, (_, i) => (
                    <React.Fragment key={i}>
                      <div style={{ position: 'absolute', left: i * 50, top: 0, width: 1, height: '100%', background: '#94a3b8' }} />
                      <span style={{ position: 'absolute', left: i * 50 + 2, top: 2, fontSize: 7, color: '#64748b', fontFamily: 'monospace', lineHeight: 1 }}>{i * 50}</span>
                    </React.Fragment>
                  ))}
                  {Array.from({ length: Math.floor(CANVAS_W / 10) }, (_, i) => (
                    <div key={`s${i}`} style={{ position: 'absolute', left: i * 10, bottom: 0, height: i % 5 === 0 ? '100%' : '40%', width: 1, background: i % 5 === 0 ? '#94a3b8' : '#cbd5e1' }} />
                  ))}
                  {selected && (
                    <>
                      <div style={{ position: 'absolute', left: selected.x, top: 0, height: '100%', width: 2, background: '#ef4444', zIndex: 5, pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: selected.x + selected.w, top: 0, height: '100%', width: 1, background: '#ef444480', zIndex: 5, pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', left: selected.x + selected.w / 2, top: 0, height: '100%', width: 2, background: '#10b981', zIndex: 5, pointerEvents: 'none' }} />
                    </>
                  )}
                </div>
                {/* Canvas */}
                <div
                  ref={canvasRef}
                  style={{
                    width: CANVAS_W, height: CANVAS_H, position: 'relative', flexShrink: 0,
                    background: tmpl.bgImage ? 'transparent' : tmpl.bgColor,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
                  }}
                  onMouseDown={e => { const t = e.target as HTMLElement; if (t === e.currentTarget || t.dataset.bgimg === '1') { setSelectedId(null); setEditingTextId(null); } }}
                >
                  {tmpl.bgImage && (
                    <img data-bgimg="1" src={tmpl.bgImage} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'auto', zIndex: 0 }} />
                  )}
                  {selected && (() => {
                    const selCx = selected.x + selected.w / 2;
                    const selCy = selected.y + selected.h / 2;
                    const guides: React.ReactNode[] = [];
                    guides.push(<div key="edge-l" style={{ position: 'absolute', left: selected.x, top: 0, width: 1, height: CANVAS_H, background: '#ef444440', zIndex: 50, pointerEvents: 'none' }} />);
                    guides.push(<div key="edge-r" style={{ position: 'absolute', left: selected.x + selected.w, top: 0, width: 1, height: CANVAS_H, background: '#ef444440', zIndex: 50, pointerEvents: 'none' }} />);
                    guides.push(<div key="edge-t" style={{ position: 'absolute', top: selected.y, left: 0, width: CANVAS_W, height: 1, background: '#ef444440', zIndex: 50, pointerEvents: 'none' }} />);
                    guides.push(<div key="edge-b" style={{ position: 'absolute', top: selected.y + selected.h, left: 0, width: CANVAS_W, height: 1, background: '#ef444440', zIndex: 50, pointerEvents: 'none' }} />);
                    guides.push(<div key="cx" style={{ position: 'absolute', left: selCx, top: 0, width: 1, height: CANVAS_H, background: '#10b98160', zIndex: 50, pointerEvents: 'none', borderLeft: '1px dashed #10b981' }} />);
                    guides.push(<div key="cy" style={{ position: 'absolute', top: selCy, left: 0, width: CANVAS_W, height: 1, background: '#10b98160', zIndex: 50, pointerEvents: 'none', borderTop: '1px dashed #10b981' }} />);
                    if (Math.abs(selCx - CANVAS_W / 2) < 5) {
                      guides.push(<div key="snap-cx" style={{ position: 'absolute', left: CANVAS_W / 2, top: 0, width: 2, height: CANVAS_H, background: '#f59e0b', zIndex: 51, pointerEvents: 'none' }} />);
                    }
                    if (Math.abs(selCy - CANVAS_H / 2) < 5) {
                      guides.push(<div key="snap-cy" style={{ position: 'absolute', top: CANVAS_H / 2, left: 0, width: CANVAS_W, height: 2, background: '#f59e0b', zIndex: 51, pointerEvents: 'none' }} />);
                    }
                    const others = tmpl.elements.filter(e => e.id !== selected.id);
                    const SNAP = 4;
                    others.forEach(o => {
                      const oCx = o.x + o.w / 2;
                      const oCy = o.y + o.h / 2;
                      if (Math.abs(selCx - oCx) < SNAP) guides.push(<div key={`acx-${o.id}`} style={{ position: 'absolute', left: oCx, top: 0, width: 1, height: CANVAS_H, background: '#8b5cf6', zIndex: 51, pointerEvents: 'none', borderLeft: '1px dashed #8b5cf6' }} />);
                      if (Math.abs(selCy - oCy) < SNAP) guides.push(<div key={`acy-${o.id}`} style={{ position: 'absolute', top: oCy, left: 0, width: CANVAS_W, height: 1, background: '#8b5cf6', zIndex: 51, pointerEvents: 'none', borderTop: '1px dashed #8b5cf6' }} />);
                      if (Math.abs(selected.x - o.x) < SNAP) guides.push(<div key={`al-${o.id}`} style={{ position: 'absolute', left: o.x, top: 0, width: 1, height: CANVAS_H, background: '#8b5cf680', zIndex: 51, pointerEvents: 'none' }} />);
                      if (Math.abs((selected.x + selected.w) - (o.x + o.w)) < SNAP) guides.push(<div key={`ar-${o.id}`} style={{ position: 'absolute', left: o.x + o.w, top: 0, width: 1, height: CANVAS_H, background: '#8b5cf680', zIndex: 51, pointerEvents: 'none' }} />);
                      if (Math.abs(selected.y - o.y) < SNAP) guides.push(<div key={`at-${o.id}`} style={{ position: 'absolute', top: o.y, left: 0, width: CANVAS_W, height: 1, background: '#8b5cf680', zIndex: 51, pointerEvents: 'none' }} />);
                      if (Math.abs((selected.y + selected.h) - (o.y + o.h)) < SNAP) guides.push(<div key={`ab-${o.id}`} style={{ position: 'absolute', top: o.y + o.h, left: 0, width: CANVAS_W, height: 1, background: '#8b5cf680', zIndex: 51, pointerEvents: 'none' }} />);
                    });
                    return guides;
                  })()}
                  {tmpl.elements.map(el => renderElement(el))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — Properties */}
        <div className="w-48 shrink-0 bg-white rounded-2xl border border-slate-100 p-3 overflow-y-auto">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">Properties</div>
          <PropsPanel />
        </div>
      </div>

      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
      <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default function CertificateStudio() {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let [t, g] = await Promise.all([fetchTemplatesFromDB(), fetchGalleryFromDB()]);
      if (cancelled) return;
      const localTemplates = loadTemplates();
      const localGalleryRaw = (() => { try { const r = localStorage.getItem(GALLERY_KEY); return r ? JSON.parse(r) as GalleryImage[] : []; } catch { return []; } })();
      if (t.length === 0 && (localTemplates.length > 0 || localGalleryRaw.length > 0)) {
        await backfillLocalStorageToDB();
        [t, g] = await Promise.all([fetchTemplatesFromDB(), fetchGalleryFromDB()]);
      }
      if (!cancelled) { setTemplates(t); setGallery(g); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { cacheTemplates(templates); }, [templates]);

  const createNew = () => {
    const t: DesignTemplate = {
      id: tid(), name: 'Untitled Certificate',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      published: false, bgColor: '#ffffff', elements: [],
    };
    setTemplates(prev => [t, ...prev]);
    saveTemplateToDB(t);
    setEditingId(t.id);
  };

  const duplicateTemplate = (id: string) => {
    const src = templates.find(t => t.id === id);
    if (!src) return;
    const t: DesignTemplate = { ...src, id: tid(), name: `${src.name} (Copy)`, published: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), elements: src.elements.map(e => ({ ...e, id: uid() })) };
    setTemplates(prev => [t, ...prev]);
    saveTemplateToDB(t);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    deleteTemplateFromDB(id);
  };

  const togglePublish = (id: string) => {
    setTemplates(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, published: !t.published, updatedAt: new Date().toISOString() } : t);
      const item = updated.find(t => t.id === id);
      if (item) saveTemplateToDB(item);
      return updated;
    });
  };

  const saveTemplate = useCallback((updated: DesignTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    saveTemplateToDB(updated);
  }, []);

  const publishTemplate = useCallback((updated: DesignTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    saveTemplateToDB(updated);
  }, []);

  const handleGalleryUpdate = (newGallery: GalleryImage[]) => {
    const added = newGallery.filter(g => !gallery.some(og => og.id === g.id));
    const removed = gallery.filter(g => !newGallery.some(ng => ng.id === g.id));
    setGallery(newGallery);
    cacheGallery(newGallery);
    added.forEach(img => saveGalleryImageToDB(img));
    removed.forEach(img => deleteGalleryImageFromDB(img.id));
  };

  const editing = editingId ? templates.find(t => t.id === editingId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
        <span className="ml-3 text-[11px] font-black uppercase tracking-widest text-slate-400">Loading Templates…</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{ height: '80vh' }} className="flex flex-col">
        <EditorView
          template={editing}
          gallery={gallery}
          onSave={saveTemplate}
          onPublish={publishTemplate}
          onBack={() => setEditingId(null)}
          onGalleryUpdate={handleGalleryUpdate}
        />
      </div>
    );
  }

  return <GalleryView templates={templates} onNew={createNew} onEdit={setEditingId} onDelete={deleteTemplate} onPublish={togglePublish} onDuplicate={duplicateTemplate} />;
}
