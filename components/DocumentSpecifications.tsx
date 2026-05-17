
"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  ChevronDown, 
  ChevronUp,
  FileUp, 
  Eye, 
  X,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  FileDigit,
  BookOpen,
  FolderOpen,
  ShieldCheck,
  Info,
  Clock,
  GripVertical,
  Table,
  Type,
  Download,
  Save,
  ArrowLeft,
  PlusCircle,
  MinusCircle,
  FileDown,
  Layers,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Check,
  Pencil
} from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Technical Function List types ---
interface TechSubCard {
  id: string;
  label: string;
}

interface TechFunction {
  id: string;
  name: string;
  description?: string;
  subCards: TechSubCard[];
}

// --- INS List types ---
interface InsSubCard {
  id: string;
  productName: string;
  maxLimit: string;
  comments: string;
}

interface InsEntry {
  id: string;
  name: string;
  description?: string;
  subCards: InsSubCard[];
}

// --- Generic Food Safety List types (Insecticides, Heavy Metal, NOTS, Micro, etc.) ---
interface FSRow {
  id: string;
  productName: string;
  maxLimit: string;
  comments: string;
}
interface FSEntry {
  id: string;
  name: string;
  description?: string;
  rows: FSRow[];
}

interface Sub3Card {
  id: string;
  label: string;
  fileName: string | null;
  fileUrl: string | null;
  lastUpdated: string;
  updatedAt?: string;
}

interface SubSubCard {
  id: string;
  label: string;
  fileName: string | null;
  fileUrl: string | null;
  lastUpdated: string;
  updatedAt?: string;
  subItems?: Sub3Card[];
}

interface SubCard {
  id: string;
  label: string;
  description?: string;
  fileName: string | null;
  fileUrl: string | null;
  lastUpdated: string;
  updatedAt?: string;
  subSubCards: SubSubCard[];
}

interface MainCard {
  id: string;
  title: string;
  description: string;
  iconColor: string;
  updatedAt?: string;
  subCards: SubCard[];
}

interface SpecTableCol {
  id: string;
  header: string;
}

interface SpecTableRow {
  id: string;
  cells: Record<string, string>;
}

interface SpecTableBlock {
  type: 'table';
  id: string;
  title: string;
  columns: SpecTableCol[];
  rows: SpecTableRow[];
  topRemarks: string;
  bottomRemarks: string;
}

interface SpecTextBlock {
  type: 'text';
  id: string;
  title: string;
  content: string;
  subNotes: { id: string; text: string }[];
}

type SpecBlock = SpecTableBlock | SpecTextBlock;

interface SpecSection {
  id: string;
  title: string;
  collapsed: boolean;
  blocks: SpecBlock[];
}

interface SpecFormData {
  materialName: string;
  mainCategory: string;
  subCategory: string;
  specificSubCategory: string;
  dietaryType: string;
  origin: string;
  sections: SpecSection[];
}

const CATEGORY_OPTIONS = ['Animal Origin', 'Plant Origin', 'Minerals', 'Additives', 'Processing Aids', 'Other'];

const INITIAL_GROUPS: MainCard[] = [];

const ICON_COLORS = ['bg-indigo-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-teal-600', 'bg-fuchsia-600'];

function getLatestDate(group: MainCard): string | null {
  const dates: string[] = [];
  if (group.updatedAt) dates.push(group.updatedAt);
  group.subCards.forEach(sc => {
    if (sc.updatedAt) dates.push(sc.updatedAt);
    if (sc.lastUpdated) dates.push(sc.lastUpdated);
    sc.subSubCards.forEach(ssc => {
      if (ssc.updatedAt) dates.push(ssc.updatedAt);
      if (ssc.lastUpdated) dates.push(ssc.lastUpdated);
    });
  });
  if (dates.length === 0) return null;
  return dates.sort().reverse()[0];
}

function formatDate(d: string | null): string {
  if (!d) return 'N/A';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}

const emptySpecForm = (): SpecFormData => ({
  materialName: '', mainCategory: '', subCategory: '', specificSubCategory: '',
  dietaryType: '', origin: '',
  sections: [{
    id: `sec-${Date.now()}`, title: 'General Characteristics', collapsed: false,
    blocks: [{
      type: 'table', id: `tb-${Date.now()}`, title: 'Parameter Table',
      columns: [
        { id: 'c1', header: 'Parameter' },
        { id: 'c2', header: 'Specification' },
        { id: 'c3', header: 'Test Method' }
      ],
      rows: [{ id: `r-${Date.now()}`, cells: { c1: '', c2: '', c3: '' } }],
      topRemarks: '', bottomRemarks: ''
    }]
  }]
});

const SpecCreatorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SpecFormData) => void;
  initialData?: SpecFormData;
  defaultMainCategory?: string;
  defaultSubCategory?: string;
  defaultSpecificSubCategory?: string;
}> = ({ isOpen, onClose, onSave, initialData, defaultMainCategory, defaultSubCategory, defaultSpecificSubCategory }) => {
  const [form, setForm] = useState<SpecFormData>(() => {
    const base = initialData || emptySpecForm();
    if (defaultMainCategory && !base.mainCategory) base.mainCategory = defaultMainCategory;
    if (defaultSubCategory && !base.subCategory) base.subCategory = defaultSubCategory;
    if (defaultSpecificSubCategory && !base.specificSubCategory) base.specificSubCategory = defaultSpecificSubCategory;
    return base;
  });

  useEffect(() => {
    if (isOpen) {
      const base = initialData || emptySpecForm();
      if (defaultMainCategory) base.mainCategory = defaultMainCategory;
      if (defaultSubCategory) base.subCategory = defaultSubCategory;
      if (defaultSpecificSubCategory) base.specificSubCategory = defaultSpecificSubCategory;
      setForm(base);
    }
  }, [isOpen, defaultMainCategory, defaultSubCategory, defaultSpecificSubCategory]);

  const updateSection = useCallback((secId: string, updates: Partial<SpecSection>) => {
    setForm(prev => ({ ...prev, sections: prev.sections.map(s => s.id === secId ? { ...s, ...updates } : s) }));
  }, []);

  const updateBlock = useCallback((secId: string, blockId: string, updates: Partial<SpecBlock>) => {
    setForm(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === secId ? {
        ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, ...updates } as SpecBlock : b)
      } : s)
    }));
  }, []);

  const addSection = () => {
    setForm(prev => ({
      ...prev,
      sections: [...prev.sections, { id: `sec-${Date.now()}`, title: 'New Section', collapsed: false, blocks: [] }]
    }));
  };

  const removeSection = (secId: string) => {
    if (!confirm('Remove this section?')) return;
    setForm(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== secId) }));
  };

  const addTableBlock = (secId: string) => {
    const block: SpecTableBlock = {
      type: 'table', id: `tb-${Date.now()}`, title: 'Table Block',
      columns: [{ id: `c-${Date.now()}`, header: 'Parameter' }, { id: `c-${Date.now() + 1}`, header: 'Specification' }],
      rows: [{ id: `r-${Date.now()}`, cells: {} }],
      topRemarks: '', bottomRemarks: ''
    };
    updateSection(secId, { blocks: [...(form.sections.find(s => s.id === secId)?.blocks || []), block] });
  };

  const addTextBlock = (secId: string) => {
    const block: SpecTextBlock = {
      type: 'text', id: `txt-${Date.now()}`, title: 'Text Block',
      content: '', subNotes: []
    };
    updateSection(secId, { blocks: [...(form.sections.find(s => s.id === secId)?.blocks || []), block] });
  };

  const removeBlock = (secId: string, blockId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    if (sec) updateSection(secId, { blocks: sec.blocks.filter(b => b.id !== blockId) });
  };

  const addTableColumn = (secId: string, blockId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTableBlock | undefined;
    if (!block) return;
    const colName = prompt('Column name:', 'New Column');
    if (!colName) return;
    const newColId = `c-${Date.now()}`;
    updateBlock(secId, blockId, { columns: [...block.columns, { id: newColId, header: colName }] });
  };

  const removeTableColumn = (secId: string, blockId: string, colId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTableBlock | undefined;
    if (!block || block.columns.length <= 1) { alert('Cannot remove the last column'); return; }
    if (!confirm('Delete this column?')) return;
    updateBlock(secId, blockId, {
      columns: block.columns.filter(c => c.id !== colId),
      rows: block.rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; })
    });
  };

  const addTableRow = (secId: string, blockId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTableBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, { rows: [...block.rows, { id: `r-${Date.now()}`, cells: {} }] });
  };

  const removeTableRow = (secId: string, blockId: string, rowId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTableBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, { rows: block.rows.filter(r => r.id !== rowId) });
  };

  const updateTableCell = (secId: string, blockId: string, rowId: string, colId: string, value: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTableBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, {
      rows: block.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)
    });
  };

  const addSubNote = (secId: string, blockId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTextBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, { subNotes: [...block.subNotes, { id: `sn-${Date.now()}`, text: '' }] });
  };

  const removeSubNote = (secId: string, blockId: string, noteId: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTextBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, { subNotes: block.subNotes.filter(n => n.id !== noteId) });
  };

  const updateSubNote = (secId: string, blockId: string, noteId: string, text: string) => {
    const sec = form.sections.find(s => s.id === secId);
    const block = sec?.blocks.find(b => b.id === blockId) as SpecTextBlock | undefined;
    if (!block) return;
    updateBlock(secId, blockId, { subNotes: block.subNotes.map(n => n.id === noteId ? { ...n, text } : n) });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-[#283593] to-[#5c6bc0] text-white px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg md:rounded-xl transition-all shrink-0"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-bold truncate">Specification Generator</h1>
            <p className="text-[8px] md:text-[10px] text-indigo-200 font-medium uppercase tracking-wider md:tracking-widest">Form Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button onClick={() => { onSave(form); onClose(); }} className="px-3 md:px-5 py-1.5 md:py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 md:gap-2 active:scale-95 transition-all shadow-lg">
            <Save size={14} /> <span className="hidden sm:inline">Save Spec</span><span className="sm:hidden">Save</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f9f9f9]">
        <div className="max-w-[1200px] mx-auto p-3 md:p-8">
          <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-6">
            <h2 className="text-[#283593] font-medium text-lg mb-4 pb-1 border-b-2 border-[#8e99f3]">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-3">
                <label className="block mb-2 font-medium text-sm text-slate-700">Material Name <span className="text-red-500">*</span></label>
                <input type="text" className="w-full p-3 border border-slate-200 rounded focus:border-[#5c6bc0] focus:ring-2 focus:ring-[#5c6bc0]/20 outline-none text-sm transition-all" value={form.materialName} onChange={e => setForm({ ...form, materialName: e.target.value })} placeholder="Enter material name..." />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">Main Category <span className="text-red-500">*</span></label>
                <select className="w-full p-3 border border-slate-200 rounded focus:border-[#5c6bc0] outline-none text-sm bg-white" value={form.mainCategory} onChange={e => setForm({ ...form, mainCategory: e.target.value })}>
                  <option value="">Select a category</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">Sub Category <span className="text-red-500">*</span></label>
                <input type="text" className="w-full p-3 border border-slate-200 rounded focus:border-[#5c6bc0] outline-none text-sm" value={form.subCategory} onChange={e => setForm({ ...form, subCategory: e.target.value })} placeholder="Sub category..." />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">Specific Sub Category</label>
                <input type="text" className="w-full p-3 border border-slate-200 rounded focus:border-[#5c6bc0] outline-none text-sm" value={form.specificSubCategory} onChange={e => setForm({ ...form, specificSubCategory: e.target.value })} placeholder="Specific sub category..." />
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">Dietary Type <span className="text-red-500">*</span></label>
                <div className="flex gap-5 mt-2">
                  {['Veg', 'Non-Veg'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="dietary" value={v} checked={form.dietaryType === v} onChange={e => setForm({ ...form, dietaryType: e.target.value })} className="accent-[#283593]" /> {v}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-2 font-medium text-sm text-slate-700">Origin <span className="text-red-500">*</span></label>
                <div className="flex gap-5 mt-2">
                  {['Animal', 'Plant', 'Mineral'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" name="origin" value={v} checked={form.origin === v} onChange={e => setForm({ ...form, origin: e.target.value })} className="accent-[#283593]" /> {v}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {form.sections.map((section, secIdx) => (
            <div key={section.id} className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer border-b-2 border-[#8e99f3] select-none"
                onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[#283593] font-medium text-base shrink-0">{secIdx + 1}.</span>
                  <input
                    type="text"
                    className="font-medium text-base text-[#283593] bg-transparent border-none outline-none flex-1 min-w-0"
                    value={section.title}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateSection(section.id, { title: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); removeSection(section.id); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all" title="Remove section"><Trash2 size={16} /></button>
                  <span className="text-[#5c6bc0] font-bold text-xl">{section.collapsed ? '+' : '−'}</span>
                </div>
              </div>

              {!section.collapsed && (
                <div className="p-6">
                  {section.blocks.map((block) => (
                    <div key={block.id} className="border border-slate-200 rounded p-4 mb-5 bg-[#fdfdfd]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-slate-300" />
                          {block.type === 'table' ? <Table size={16} className="text-[#5c6bc0]" /> : <Type size={16} className="text-[#5c6bc0]" />}
                          <input
                            type="text"
                            className="font-medium text-sm text-[#5c6bc0] bg-transparent border-none outline-none"
                            value={block.title}
                            onChange={e => updateBlock(section.id, block.id, { title: e.target.value })}
                          />
                        </div>
                        <button onClick={() => removeBlock(section.id, block.id)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded text-xs font-medium hover:bg-red-100 transition-all">Remove</button>
                      </div>

                      {block.type === 'table' && (() => {
                        const tb = block as SpecTableBlock;
                        return (
                          <div>
                            <div className="mb-3">
                              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                <input type="checkbox" checked={!!tb.topRemarks} onChange={e => updateBlock(section.id, block.id, { topRemarks: e.target.checked ? ' ' : '' })} className="accent-[#283593]" /> Top Remarks
                              </label>
                              {tb.topRemarks && (
                                <textarea className="w-full mt-1 p-2 border border-slate-200 rounded text-sm resize-y min-h-[50px] focus:border-[#5c6bc0] outline-none" value={tb.topRemarks} onChange={e => updateBlock(section.id, block.id, { topRemarks: e.target.value })} placeholder="Enter top remarks..." />
                              )}
                            </div>

                            <div className="overflow-x-auto mb-3">
                              <table className="w-full border-collapse text-sm">
                                <thead>
                                  <tr>
                                    {tb.columns.map(col => (
                                      <th key={col.id} className="bg-[#f5f5f5] p-2 text-left border-b border-slate-200 text-[#283593] font-semibold">
                                        <input
                                          type="text"
                                          className="bg-transparent border-none outline-none font-semibold text-[#283593] w-full"
                                          value={col.header}
                                          onChange={e => {
                                            const sec = form.sections.find(s => s.id === section.id);
                                            const blk = sec?.blocks.find(b => b.id === block.id) as SpecTableBlock;
                                            if (blk) updateBlock(section.id, block.id, { columns: blk.columns.map(c => c.id === col.id ? { ...c, header: e.target.value } : c) });
                                          }}
                                        />
                                        <button onClick={() => removeTableColumn(section.id, block.id, col.id)} className="text-[10px] text-red-400 hover:text-red-600 mt-1">✕ Del</button>
                                      </th>
                                    ))}
                                    <th className="bg-[#f5f5f5] p-2 w-20 text-center border-b border-slate-200 text-[#283593] font-semibold">
                                      <button onClick={() => addTableColumn(section.id, block.id)} className="text-[10px] text-[#283593] font-bold hover:underline">+ Col</button>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tb.rows.map(row => (
                                    <tr key={row.id} className="hover:bg-[rgba(92,107,192,0.05)]">
                                      {tb.columns.map(col => (
                                        <td key={col.id} className="p-2 border-b border-slate-100">
                                          <input
                                            type="text"
                                            className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-[#5c6bc0] outline-none"
                                            value={row.cells[col.id] || ''}
                                            onChange={e => updateTableCell(section.id, block.id, row.id, col.id, e.target.value)}
                                            placeholder={col.header}
                                          />
                                        </td>
                                      ))}
                                      <td className="p-2 border-b border-slate-100 text-center">
                                        <button onClick={() => removeTableRow(section.id, block.id, row.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">✕</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <button onClick={() => addTableRow(section.id, block.id)} className="px-3 py-1.5 bg-[#283593] text-white rounded text-xs font-medium hover:bg-[#5c6bc0] transition-all">+ Add Row</button>

                            <div className="mt-3">
                              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                <input type="checkbox" checked={!!tb.bottomRemarks} onChange={e => updateBlock(section.id, block.id, { bottomRemarks: e.target.checked ? ' ' : '' })} className="accent-[#283593]" /> Bottom Remarks
                              </label>
                              {tb.bottomRemarks && (
                                <textarea className="w-full mt-1 p-2 border border-slate-200 rounded text-sm resize-y min-h-[50px] focus:border-[#5c6bc0] outline-none" value={tb.bottomRemarks} onChange={e => updateBlock(section.id, block.id, { bottomRemarks: e.target.value })} placeholder="Enter bottom remarks..." />
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {block.type === 'text' && (() => {
                        const txt = block as SpecTextBlock;
                        return (
                          <div>
                            <textarea
                              className="w-full p-3 border border-slate-200 rounded text-sm resize-y min-h-[100px] focus:border-[#5c6bc0] outline-none mb-3"
                              value={txt.content}
                              onChange={e => updateBlock(section.id, block.id, { content: e.target.value })}
                              placeholder="Enter content text..."
                            />
                            {txt.subNotes.length > 0 && (
                              <div className="ml-5 border-l-2 border-[#8e99f3] pl-4 space-y-3 mb-3">
                                {txt.subNotes.map((note, ni) => (
                                  <div key={note.id} className="bg-[#fdfdff] border border-[#e8eaf6] rounded p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-xs text-[#5c6bc0] font-medium">Sub-Note {ni + 1}</label>
                                      <button onClick={() => removeSubNote(section.id, block.id, note.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                                    </div>
                                    <textarea
                                      className="w-full p-2 border border-slate-200 rounded text-sm resize-y min-h-[50px] focus:border-[#5c6bc0] outline-none"
                                      value={note.text}
                                      onChange={e => updateSubNote(section.id, block.id, note.id, e.target.value)}
                                      placeholder="Enter sub-note..."
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            <button onClick={() => addSubNote(section.id, block.id)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 transition-all">+ Add Sub-Note</button>
                          </div>
                        );
                      })()}
                    </div>
                  ))}

                  <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => addTableBlock(section.id)} className="px-4 py-2 bg-[#2196F3] text-white rounded text-xs font-medium hover:bg-[#1976D2] transition-all flex items-center gap-1.5"><Table size={14} /> Add Table Block</button>
                    <button onClick={() => addTextBlock(section.id)} className="px-4 py-2 bg-[#2196F3] text-white rounded text-xs font-medium hover:bg-[#1976D2] transition-all flex items-center gap-1.5"><Type size={14} /> Add Text Block</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="text-right mb-8">
            <button onClick={addSection} className="px-5 py-3 bg-[#757575] text-white rounded text-sm font-medium hover:bg-[#616161] transition-all">+ Add New Custom Section</button>
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <button onClick={() => { onSave(form); onClose(); }} className="px-6 py-3 bg-[#4caf50] text-white rounded text-sm font-medium hover:bg-[#43a047] transition-all flex items-center gap-2"><Save size={16} /> Save Specification</button>
            <button onClick={onClose} className="px-6 py-3 bg-[#f44336] text-white rounded text-sm font-medium hover:bg-[#e53935] transition-all">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BulkReviewRow {
  groupName: string;
  subCardName: string;
  subSubCardName: string;
  status: 'new' | 'duplicate-group' | 'duplicate-sub' | 'duplicate-subsub' | 'intra-duplicate';
  duplicateOf?: string;
  selected: boolean;
}

function normalizeForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const FOOD_SAFETY_TABS = [
  { key: 'food-additives', label: 'Food Additives' },
  { key: 'insecticides',   label: 'Insecticides' },
  { key: 'heavy-metal',    label: 'Heavy Metal' },
  { key: 'nots',           label: 'NOTS' },
  { key: 'micro',          label: 'Micro' },
  { key: 'processing-aids',label: 'Processing Aids (if any)' },
  { key: 'av',             label: 'AV' },
  { key: 'fss',            label: 'FSS(CT&R)' },
] as const;

const OTHER_FS_CATEGORIES = [
  { key: 'insecticides',    label: 'Insecticides'    },
  { key: 'heavy-metal',     label: 'Heavy Metal'     },
  { key: 'nots',            label: 'NOTS'            },
  { key: 'micro',           label: 'Micro'           },
  { key: 'processing-aids', label: 'Processing Aids' },
  { key: 'av',              label: 'AV'              },
  { key: 'fss',             label: 'FSS(CT&R)'       },
] as const;

const DocumentSpecifications: React.FC<{ activeSubTab: string; currentScope: string }> = ({ activeSubTab, currentScope }) => {
  const [groups, setGroups] = useState<MainCard[]>(INITIAL_GROUPS);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMainModalOpen, setIsMainModalOpen] = useState(false);
  const [activeMainCardId, setActiveMainCardId] = useState<string | null>(null);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isSubSubModalOpen, setIsSubSubModalOpen] = useState(false);
  const [activeSubCardId, setActiveSubCardId] = useState<string | null>(null);
  
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [expandedSubCardIds, setExpandedSubCardIds] = useState<Set<string>>(new Set());
  const [expandedSscIds, setExpandedSscIds] = useState<Set<string>>(new Set());
  const [groupFSTab, setGroupFSTab] = useState<Record<string, string>>({});
  const [subFSTab, setSubFSTab] = useState<Record<string, string>>({});
  const [sscFSTab, setSscFSTab] = useState<Record<string, string>>({});

  const [mainForm, setMainForm] = useState({ title: '', description: '' });
  const [subForm, setSubForm] = useState({ label: '', description: '' });
  const [subSubForm, setSubSubForm] = useState({ label: '' });
  const [isS3ModalOpen, setIsS3ModalOpen] = useState(false);
  const [activeS3ParentIds, setActiveS3ParentIds] = useState<{ groupId: string; subId: string; sscId: string } | null>(null);
  const [s3Form, setS3Form] = useState({ label: '' });
  const s3FileInputRef = useRef<HTMLInputElement>(null);
  const [s3UploadTarget, setS3UploadTarget] = useState<{ groupId: string; subId: string; sscId: string; s3Id: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const insFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  // --- Internal sub-tab state ---
  const [activeDocSubTab, setActiveDocSubTab] = useState<string>('doc-specs');

  // --- Generic Food Safety Lists state (Insecticides, Heavy Metal, NOTS, Micro, Processing Aids, AV, FSS) ---
  const [fsData, setFsData] = useState<Record<string, FSEntry[]>>({});
  const [expandedFsIds, setExpandedFsIds] = useState<Record<string, Set<string>>>({});
  const [isFsEntryModalOpen, setIsFsEntryModalOpen] = useState(false);
  const [fsModalCategory, setFsModalCategory] = useState('');
  const [fsEntryName, setFsEntryName] = useState('');
  const [fsEntryDescription, setFsEntryDescription] = useState('');
  const [addFsRowTarget, setAddFsRowTarget] = useState<{ cat: string; entryId: string } | null>(null);
  const [fsRowProduct, setFsRowProduct] = useState('');
  const [fsRowMaxLimit, setFsRowMaxLimit] = useState('');
  const [fsRowComments, setFsRowComments] = useState('');
  const [editingFsRow, setEditingFsRow] = useState<{ cat: string; entryId: string; rowId: string } | null>(null);
  const [fsRowEditForm, setFsRowEditForm] = useState({ productName: '', maxLimit: '', comments: '' });
  const [editFsEntryTarget, setEditFsEntryTarget] = useState<{ cat: string; id: string } | null>(null);
  const [editFsEntryForm, setEditFsEntryForm] = useState({ name: '', description: '' });

  // --- Technical Function List state ---
  const [techFunctions, setTechFunctions] = useState<TechFunction[]>([]);
  const [isTechFuncModalOpen, setIsTechFuncModalOpen] = useState(false);
  const [techFuncName, setTechFuncName] = useState('');
  const [techFuncDescription, setTechFuncDescription] = useState('');
  const [expandedTechFuncIds, setExpandedTechFuncIds] = useState<Set<string>>(new Set());
  const [addSubCardTargetId, setAddSubCardTargetId] = useState<string | null>(null);
  const [techSubCardLabel, setTechSubCardLabel] = useState('');
  const [editingTechSubCardId, setEditingTechSubCardId] = useState<{ funcId: string; cardId: string } | null>(null);
  const [techSubCardEditValue, setTechSubCardEditValue] = useState('');
  const [editTechFuncId, setEditTechFuncId] = useState<string | null>(null);
  const [editTechFuncForm, setEditTechFuncForm] = useState({ name: '', description: '' });

  // --- INS List state ---
  const [insEntries, setInsEntries] = useState<InsEntry[]>([]);
  const [isInsModalOpen, setIsInsModalOpen] = useState(false);
  const [insName, setInsName] = useState('');
  const [insDescription, setInsDescription] = useState('');
  const [expandedInsIds, setExpandedInsIds] = useState<Set<string>>(new Set());
  const [addInsSubTargetId, setAddInsSubTargetId] = useState<string | null>(null);
  const [insSubProduct, setInsSubProduct] = useState('');
  const [insSubMaxLimit, setInsSubMaxLimit] = useState('');
  const [insSubComments, setInsSubComments] = useState('');
  const [editingInsSubId, setEditingInsSubId] = useState<{ entryId: string; cardId: string } | null>(null);
  const [insSubEditForm, setInsSubEditForm] = useState({ productName: '', maxLimit: '', comments: '' });
  const [editInsId, setEditInsId] = useState<string | null>(null);
  const [editInsForm, setEditInsForm] = useState({ name: '', description: '' });

  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({ title: '', description: '' });
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubForm, setEditSubForm] = useState({ label: '', description: '' });

  const [specCreatorOpen, setSpecCreatorOpen] = useState(false);
  const [specCreatorTarget, setSpecCreatorTarget] = useState<{ groupId: string; subId: string; subSubId?: string } | null>(null);

  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [bulkReviewRows, setBulkReviewRows] = useState<BulkReviewRow[]>([]);

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [selectedSubIds, setSelectedSubIds] = useState<Set<string>>(new Set());
  const [selectedSubSubIds, setSelectedSubSubIds] = useState<Set<string>>(new Set());

  const totalSelected = selectedGroupIds.size + selectedSubIds.size + selectedSubSubIds.size;

  const [loadingFromDb, setLoadingFromDb] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);
  const isFsListsInitialLoad = useRef(true);
  const fsListsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const res = await fetch(`/api/document-specifications?scope=${encodeURIComponent(currentScope)}`);
        if (res.ok) {
          const records = await res.json();
          if (Array.isArray(records) && records.length > 0) {
            const loaded: MainCard[] = records.map((r: any) => ({
              id: r.id,
              title: r.title || '',
              description: r.description || '',
              iconColor: r.iconColor || ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
              updatedAt: r.updatedAt,
              subCards: (r.subCards || []).map((sc: any) => ({
                id: sc.id,
                label: sc.label || '',
                fileName: sc.fileName || null,
                fileUrl: sc.fileUrl || null,
                lastUpdated: sc.lastUpdated || '',
                updatedAt: sc.updatedAt,
                subSubCards: (sc.subSubCards || []).map((ssc: any) => ({
                  id: ssc.id,
                  label: ssc.label || '',
                  fileName: ssc.fileName || null,
                  fileUrl: ssc.fileUrl || null,
                  lastUpdated: ssc.lastUpdated || '',
                  updatedAt: ssc.updatedAt,
                  subItems: (ssc.subItems || []).map((si: any) => ({ id: si.id, label: si.label || '', fileName: si.fileName || null, fileUrl: si.fileUrl || null, lastUpdated: si.lastUpdated || '', updatedAt: si.updatedAt })),
                })),
              })),
            }));
            setGroups(loaded);
          }
        }
      } catch (err) {
        console.error('[DocSpec] Failed to load from DB:', err);
      } finally {
        setLoadingFromDb(false);
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      }
    };
    loadFromDb();
  }, [currentScope]);

  useEffect(() => {
    if (isInitialLoadRef.current || loadingFromDb) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = groups.map(g => ({
        id: g.id,
        scope: currentScope,
        title: g.title,
        description: g.description,
        iconColor: g.iconColor,
        updatedAt: g.updatedAt || new Date().toISOString(),
        subCards: g.subCards.map(sc => ({
          id: sc.id,
          label: sc.label,
          fileName: sc.fileName,
          fileUrl: sc.fileUrl && sc.fileUrl !== '#' ? null : sc.fileUrl,
          lastUpdated: sc.lastUpdated,
          updatedAt: sc.updatedAt,
          subSubCards: sc.subSubCards.map(ssc => ({
            id: ssc.id,
            label: ssc.label,
            fileName: ssc.fileName,
            fileUrl: ssc.fileUrl && ssc.fileUrl !== '#' ? null : ssc.fileUrl,
            lastUpdated: ssc.lastUpdated,
            updatedAt: ssc.updatedAt,
            subItems: (ssc.subItems || []).map(si => ({ id: si.id, label: si.label, fileName: si.fileName, fileUrl: si.fileUrl, lastUpdated: si.lastUpdated, updatedAt: si.updatedAt })),
          })),
        })),
      }));
      fetch('/api/document-specifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => console.error('[DocSpec] Failed to save:', err));
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [groups, currentScope, loadingFromDb]);

  // --- Food Safety Lists: load from DB ---
  useEffect(() => {
    const loadFsLists = async () => {
      try {
        const res = await fetch(`/api/food-safety-lists?scope=${encodeURIComponent(currentScope)}`);
        if (!res.ok) return;
        const records: any[] = await res.json();
        if (!Array.isArray(records) || records.length === 0) return;

        const byCategory: Record<string, any[]> = {};
        for (const r of records) {
          if (!r.category) continue;
          if (!byCategory[r.category]) byCategory[r.category] = [];
          byCategory[r.category].push(r);
        }

        if (byCategory['tech-functions']) {
          setTechFunctions(byCategory['tech-functions'].map((r: any) => ({
            id: r.id, name: r.name || '', description: r.description,
            subCards: (r.subCards || []).map((sc: any) => ({ id: sc.id, label: sc.label || '', description: sc.description })),
          })));
        }
        if (byCategory['ins-list']) {
          setInsEntries(byCategory['ins-list'].map((r: any) => ({
            id: r.id, name: r.name || '', description: r.description,
            subCards: (r.subCards || []).map((sc: any) => ({ id: sc.id, productName: sc.productName || '', maxLimit: sc.maxLimit || '', comments: sc.comments || '' })),
          })));
        }
        const newFsData: Record<string, FSEntry[]> = {};
        for (const c of OTHER_FS_CATEGORIES) {
          if (byCategory[c.key]) {
            newFsData[c.key] = byCategory[c.key].map((r: any) => ({
              id: r.id, name: r.name || '', description: r.description,
              rows: (r.rows || []).map((row: any) => ({ id: row.id, productName: row.productName || '', maxLimit: row.maxLimit || '', comments: row.comments || '' })),
            }));
          }
        }
        if (Object.keys(newFsData).length > 0) {
          setFsData(prev => ({ ...prev, ...newFsData }));
        }
      } catch (err) {
        console.error('[FsLists] Failed to load from DB:', err);
      } finally {
        setTimeout(() => { isFsListsInitialLoad.current = false; }, 600);
      }
    };
    loadFsLists();
  }, [currentScope]);

  // --- Food Safety Lists: save tech functions ---
  useEffect(() => {
    if (isFsListsInitialLoad.current) return;
    if (fsListsSaveTimerRef.current) clearTimeout(fsListsSaveTimerRef.current);
    fsListsSaveTimerRef.current = setTimeout(() => {
      const payload = techFunctions.map(f => ({
        id: f.id, scope: currentScope, category: 'tech-functions',
        name: f.name, description: f.description, subCards: f.subCards,
      }));
      if (payload.length > 0) {
        fetch('/api/food-safety-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .catch(err => console.error('[TechFunctions] Failed to save:', err));
      }
    }, 2000);
    return () => { if (fsListsSaveTimerRef.current) clearTimeout(fsListsSaveTimerRef.current); };
  }, [techFunctions, currentScope]);

  // --- Food Safety Lists: save INS entries ---
  useEffect(() => {
    if (isFsListsInitialLoad.current) return;
    const timer = setTimeout(() => {
      const payload = insEntries.map(e => ({
        id: e.id, scope: currentScope, category: 'ins-list',
        name: e.name, description: e.description, subCards: e.subCards,
      }));
      if (payload.length > 0) {
        fetch('/api/food-safety-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .catch(err => console.error('[INSList] Failed to save:', err));
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [insEntries, currentScope]);

  // --- Food Safety Lists: save all FS category data ---
  useEffect(() => {
    if (isFsListsInitialLoad.current) return;
    const timer = setTimeout(() => {
      const payload: any[] = [];
      for (const c of OTHER_FS_CATEGORIES) {
        const entries = fsData[c.key] || [];
        entries.forEach(e => payload.push({
          id: e.id, scope: currentScope, category: c.key,
          name: e.name, description: e.description, rows: e.rows,
        }));
      }
      if (payload.length > 0) {
        fetch('/api/food-safety-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .catch(err => console.error('[FSData] Failed to save:', err));
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [fsData, currentScope]);

  const toggleSelectGroup = (id: string) => {
    setSelectedGroupIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectSub = (id: string) => {
    setSelectedSubIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectSubSub = (id: string) => {
    setSelectedSubSubIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const selectAllInGroup = (group: MainCard) => {
    setSelectedSubIds(prev => {
      const n = new Set(prev);
      group.subCards.forEach(sc => n.add(sc.id));
      return n;
    });
    setSelectedSubSubIds(prev => {
      const n = new Set(prev);
      group.subCards.forEach(sc => sc.subSubCards.forEach(ssc => n.add(ssc.id)));
      return n;
    });
  };

  const deselectAllInGroup = (group: MainCard) => {
    setSelectedSubIds(prev => {
      const n = new Set(prev);
      group.subCards.forEach(sc => n.delete(sc.id));
      return n;
    });
    setSelectedSubSubIds(prev => {
      const n = new Set(prev);
      group.subCards.forEach(sc => sc.subSubCards.forEach(ssc => n.delete(ssc.id)));
      return n;
    });
  };

  const selectAllSubSubInSub = (sub: SubCard) => {
    setSelectedSubSubIds(prev => {
      const n = new Set(prev);
      sub.subSubCards.forEach(ssc => n.add(ssc.id));
      return n;
    });
  };

  const deselectAllSubSubInSub = (sub: SubCard) => {
    setSelectedSubSubIds(prev => {
      const n = new Set(prev);
      sub.subSubCards.forEach(ssc => n.delete(ssc.id));
      return n;
    });
  };

  const selectAll = () => {
    setSelectedGroupIds(new Set(groups.map(g => g.id)));
    setSelectedSubIds(new Set(groups.flatMap(g => g.subCards.map(sc => sc.id))));
    setSelectedSubSubIds(new Set(groups.flatMap(g => g.subCards.flatMap(sc => sc.subSubCards.map(ssc => ssc.id)))));
  };

  const deselectAll = () => {
    setSelectedGroupIds(new Set());
    setSelectedSubIds(new Set());
    setSelectedSubSubIds(new Set());
  };

  const handleBulkDelete = () => {
    if (totalSelected === 0) return;
    const parts: string[] = [];
    if (selectedGroupIds.size > 0) parts.push(`${selectedGroupIds.size} group(s)`);
    if (selectedSubIds.size > 0) parts.push(`${selectedSubIds.size} sub-card(s)`);
    if (selectedSubSubIds.size > 0) parts.push(`${selectedSubSubIds.size} sub-sub-card(s)`);
    if (!confirm(`Delete ${parts.join(', ')}? This cannot be undone.`)) return;

    const deletedGroupIds = [...selectedGroupIds];

    setGroups(prev => {
      let updated = prev.filter(g => !selectedGroupIds.has(g.id));
      updated = updated.map(g => ({
        ...g,
        subCards: g.subCards
          .filter(sc => !selectedSubIds.has(sc.id))
          .map(sc => ({
            ...sc,
            subSubCards: sc.subSubCards.filter(ssc => !selectedSubSubIds.has(ssc.id))
          }))
      }));
      return updated;
    });

    if (deletedGroupIds.length > 0) {
      fetch('/api/document-specifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deletedGroupIds }),
      }).catch(err => console.error('[DocSpec] Failed to delete from DB:', err));
    }

    deselectAll();
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.subCards.some(sc => sc.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sc.subSubCards.some(ssc => ssc.label.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
  }, [groups, searchTerm]);

  const toggleGroup = (id: string) => {
    if (expandedGroupIds.has(id)) {
      setExpandedGroupIds(new Set());
    } else {
      setExpandedGroupIds(new Set([id]));
      setExpandedSubCardIds(new Set());
    }
  };

  const toggleSubCard = (id: string) => {
    if (expandedSubCardIds.has(id)) {
      setExpandedSubCardIds(new Set());
    } else {
      setExpandedSubCardIds(new Set([id]));
    }
  };

  const handleAddMainCard = () => {
    if (!mainForm.title) return;
    const newId = `grp-${Date.now()}`;
    const now = new Date().toISOString();
    setGroups([...groups, { id: newId, title: mainForm.title, description: mainForm.description, iconColor: ICON_COLORS[groups.length % ICON_COLORS.length], updatedAt: now, subCards: [] }]);
    setExpandedGroupIds(new Set([newId]));
    setExpandedSubCardIds(new Set());
    setIsMainModalOpen(false);
    setMainForm({ title: '', description: '' });
  };

  const handleAddSubCard = () => {
    if (!subForm.label || !activeMainCardId) return;
    const now = new Date().toISOString();
    const newSub: SubCard = { id: `sc-${Date.now()}`, label: subForm.label, description: subForm.description || undefined, fileName: null, fileUrl: null, lastUpdated: now.split('T')[0], updatedAt: now, subSubCards: [] };
    setGroups(prev => prev.map(g => g.id === activeMainCardId ? { ...g, updatedAt: now, subCards: [...g.subCards, newSub] } : g));
    setIsSubModalOpen(false);
    setSubForm({ label: '', description: '' });
  };

  const handleAddSubSubCard = () => {
    if (!subSubForm.label || !activeMainCardId || !activeSubCardId) return;
    const now = new Date().toISOString();
    const newSubSub: SubSubCard = { id: `ssc-${Date.now()}`, label: subSubForm.label, fileName: null, fileUrl: null, lastUpdated: now.split('T')[0], updatedAt: now };
    setGroups(prev => prev.map(g => g.id === activeMainCardId ? {
      ...g, updatedAt: now, subCards: g.subCards.map(sc => sc.id === activeSubCardId ? { ...sc, updatedAt: now, subSubCards: [...sc.subSubCards, newSubSub] } : sc)
    } : g));
    setIsSubSubModalOpen(false);
    setSubSubForm({ label: '' });
  };

  const handleDeleteMain = (id: string) => {
    if (confirm("Delete this group and all its specifications?")) {
      setGroups(prev => prev.filter(g => g.id !== id));
      fetch('/api/document-specifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      }).catch(err => console.error('[DocSpec] Failed to delete from DB:', err));
    }
  };

  const handleDeleteSub = (groupId: string, subId: string) => {
    if (confirm("Remove this specification?")) {
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, subCards: g.subCards.filter(sc => sc.id !== subId) } : g));
    }
  };

  const handleDeleteSubSub = (groupId: string, subId: string, subSubId: string) => {
    if (confirm("Remove this sub-specification?")) {
      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g, subCards: g.subCards.map(sc => sc.id === subId ? { ...sc, subSubCards: sc.subSubCards.filter(ssc => ssc.id !== subSubId) } : sc)
      } : g));
    }
  };

  const handleAddSub3Card = () => {
    if (!activeS3ParentIds || !s3Form.label.trim()) return;
    const { groupId, subId, sscId } = activeS3ParentIds;
    const now = new Date().toISOString();
    const newItem: Sub3Card = { id: `s3-${Date.now()}`, label: s3Form.label.trim(), fileName: null, fileUrl: null, lastUpdated: now.split('T')[0], updatedAt: now };
    setGroups(prev => prev.map(g => g.id === groupId ? {
      ...g, subCards: g.subCards.map(sc => sc.id === subId ? {
        ...sc, subSubCards: sc.subSubCards.map(ssc => ssc.id === sscId ? {
          ...ssc, subItems: [...(ssc.subItems || []), newItem]
        } : ssc)
      } : sc)
    } : g));
    setS3Form({ label: '' });
    setIsS3ModalOpen(false);
  };

  const handleDeleteSub3Card = (groupId: string, subId: string, sscId: string, s3Id: string) => {
    if (!confirm("Remove this item?")) return;
    setGroups(prev => prev.map(g => g.id === groupId ? {
      ...g, subCards: g.subCards.map(sc => sc.id === subId ? {
        ...sc, subSubCards: sc.subSubCards.map(ssc => ssc.id === sscId ? {
          ...ssc, subItems: (ssc.subItems || []).filter(si => si.id !== s3Id)
        } : ssc)
      } : sc)
    } : g));
  };

  const handleS3FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && s3UploadTarget) {
      const { groupId, subId, sscId, s3Id } = s3UploadTarget;
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g, subCards: g.subCards.map(sc => sc.id === subId ? {
          ...sc, subSubCards: sc.subSubCards.map(ssc => ssc.id === sscId ? {
            ...ssc, subItems: (ssc.subItems || []).map(si => si.id === s3Id ? { ...si, fileName: file.name, fileUrl: URL.createObjectURL(file), lastUpdated: today, updatedAt: now } : si)
          } : ssc)
        } : sc)
      } : g));
    }
    if (s3FileInputRef.current) s3FileInputRef.current.value = '';
    setS3UploadTarget(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      setGroups(prev => prev.map(g => ({
        ...g,
        subCards: g.subCards.map(sc => {
          if (sc.id === uploadTarget) return { ...sc, fileName: file.name, fileUrl: URL.createObjectURL(file), lastUpdated: today, updatedAt: now };
          return { ...sc, subSubCards: sc.subSubCards.map(ssc => ssc.id === uploadTarget ? { ...ssc, fileName: file.name, fileUrl: URL.createObjectURL(file), lastUpdated: today, updatedAt: now } : ssc) };
        })
      })));
      setUploadTarget(null);
    }
  };

  const handleDownloadSampleCsv = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Group Name', 'Sub Card Name', 'Sub-Sub Card Name'],
      ['Operational Standards', 'Hygiene Protocol', 'Hand Washing Procedure'],
      ['Operational Standards', 'Hygiene Protocol', 'Surface Sanitization'],
      ['Operational Standards', 'Waste Management', ''],
      ['Product Specifications', 'Dairy Products', 'Milk Grade A'],
      ['Product Specifications', 'Dairy Products', 'Cheese Standards'],
      ['Quality Control', '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'specification_bulk_upload_template.xlsx');
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) { alert('File is empty or has no data rows.'); return; }

        const headerRow = rows[0].map(h => normalizeForCompare(String(h)));
        let groupCol = headerRow.indexOf('group name');
        let subCol = headerRow.indexOf('sub card name');
        let subSubCol = headerRow.indexOf('sub-sub card name');
        if (groupCol === -1) groupCol = 0;
        if (subCol === -1) subCol = 1;
        if (subSubCol === -1) subSubCol = 2;

        const existingGroupNames = new Set(groups.map(g => normalizeForCompare(g.title)));
        const existingSubNames = new Map<string, Set<string>>();
        const existingSubSubNames = new Map<string, Set<string>>();
        groups.forEach(g => {
          const gn = normalizeForCompare(g.title);
          const subSet = new Set<string>();
          g.subCards.forEach(sc => {
            const scn = normalizeForCompare(sc.label);
            subSet.add(scn);
            const sscSet = new Set<string>();
            sc.subSubCards.forEach(ssc => sscSet.add(normalizeForCompare(ssc.label)));
            existingSubSubNames.set(`${gn}||${scn}`, sscSet);
          });
          existingSubNames.set(gn, subSet);
        });

        const seenInBatch = new Set<string>();
        const reviewRows: BulkReviewRow[] = [];

        for (let i = 1; i < rows.length; i++) {
          const groupName = String(rows[i][groupCol] || '').trim();
          const subCardName = String(rows[i][subCol] || '').trim();
          const subSubCardName = String(rows[i][subSubCol] || '').trim();
          if (!groupName && !subCardName && !subSubCardName) continue;

          const gNorm = normalizeForCompare(groupName || '');
          const scNorm = normalizeForCompare(subCardName || '');
          const sscNorm = normalizeForCompare(subSubCardName || '');

          const batchKey = `${gNorm}||${scNorm}||${sscNorm}`;

          let status: BulkReviewRow['status'] = 'new';
          let duplicateOf = '';

          if (seenInBatch.has(batchKey)) {
            status = 'intra-duplicate';
            duplicateOf = 'Duplicate within this upload batch';
          } else if (subSubCardName && sscNorm) {
            const sscSet = existingSubSubNames.get(`${gNorm}||${scNorm}`);
            if (sscSet?.has(sscNorm)) {
              status = 'duplicate-subsub';
              duplicateOf = `Sub-sub card "${subSubCardName}" already exists under "${subCardName}"`;
            }
          } else if (subCardName && scNorm && !subSubCardName) {
            const subSet = existingSubNames.get(gNorm);
            if (subSet?.has(scNorm)) {
              status = 'duplicate-sub';
              duplicateOf = `Sub card "${subCardName}" already exists under "${groupName}"`;
            }
          } else if (groupName && !subCardName && !subSubCardName) {
            if (existingGroupNames.has(gNorm)) {
              status = 'duplicate-group';
              duplicateOf = `Group "${groupName}" already exists`;
            }
          }

          seenInBatch.add(batchKey);
          reviewRows.push({ groupName, subCardName, subSubCardName, status, duplicateOf, selected: status === 'new' });
        }

        setBulkReviewRows(reviewRows);
        setBulkReviewOpen(true);
      } catch (err) {
        alert('Failed to parse the uploaded file. Please use an Excel (.xlsx/.csv) file.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleBulkConfirm = () => {
    const selected = bulkReviewRows.filter(r => r.selected);
    if (selected.length === 0) { setBulkReviewOpen(false); return; }

    setGroups(prev => {
      let updated = [...prev];
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      for (const row of selected) {
        const gNorm = normalizeForCompare(row.groupName);
        let group = updated.find(g => normalizeForCompare(g.title) === gNorm);

        if (!group && row.groupName) {
          group = { id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: row.groupName, description: '', iconColor: ICON_COLORS[updated.length % ICON_COLORS.length], updatedAt: now, subCards: [] };
          updated.push(group);
        }

        if (!group) continue;

        if (row.subCardName) {
          const scNorm = normalizeForCompare(row.subCardName);
          let sub = group.subCards.find(sc => normalizeForCompare(sc.label) === scNorm);
          if (!sub) {
            sub = { id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: row.subCardName, fileName: null, fileUrl: null, lastUpdated: today, updatedAt: now, subSubCards: [] };
            group.subCards.push(sub);
          }

          if (row.subSubCardName) {
            const sscNorm = normalizeForCompare(row.subSubCardName);
            const existing = sub.subSubCards.find(ssc => normalizeForCompare(ssc.label) === sscNorm);
            if (!existing) {
              sub.subSubCards.push({ id: `ssc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: row.subSubCardName, fileName: null, fileUrl: null, lastUpdated: today, updatedAt: now });
            }
          }
        }
      }

      return updated;
    });

    setBulkReviewOpen(false);
    setBulkReviewRows([]);
  };

  // --- Technical Function List handlers ---
  const handleAddTechFunction = () => {
    const name = techFuncName.trim();
    if (!name) return;
    const newFunc: TechFunction = {
      id: `tf-${Date.now()}`,
      name,
      description: techFuncDescription.trim() || undefined,
      subCards: []
    };
    setTechFunctions(prev => [newFunc, ...prev]);
    setTechFuncName('');
    setTechFuncDescription('');
    setIsTechFuncModalOpen(false);
    setExpandedTechFuncIds(prev => new Set(prev).add(newFunc.id));
  };

  const handleDeleteTechFunction = (id: string) => {
    setTechFunctions(prev => prev.filter(f => f.id !== id));
    fetch('/api/food-safety-lists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) }).catch(console.error);
  };

  const handleSaveTechFuncEdit = () => {
    if (!editTechFuncId || !editTechFuncForm.name.trim()) return;
    setTechFunctions(prev => prev.map(f => f.id === editTechFuncId
      ? { ...f, name: editTechFuncForm.name.trim(), description: editTechFuncForm.description.trim() || undefined }
      : f));
    setEditTechFuncId(null);
  };

  const handleSaveGroupEdit = () => {
    if (!editGroupId || !editGroupForm.title.trim()) return;
    const now = new Date().toISOString();
    setGroups(prev => prev.map(g => g.id === editGroupId
      ? { ...g, title: editGroupForm.title.trim(), description: editGroupForm.description.trim(), updatedAt: now }
      : g));
    setEditGroupId(null);
  };

  const handleSaveSubEdit = () => {
    if (!editSubId || !editSubForm.label.trim()) return;
    const now = new Date().toISOString();
    setGroups(prev => prev.map(g => ({
      ...g,
      subCards: g.subCards.map(sc => sc.id === editSubId
        ? { ...sc, label: editSubForm.label.trim(), description: editSubForm.description.trim() || undefined, updatedAt: now }
        : sc)
    })));
    setEditSubId(null);
  };

  const handleAddTechSubCard = (funcId: string) => {
    const label = techSubCardLabel.trim();
    if (!label) return;
    setTechFunctions(prev => prev.map(f => f.id === funcId
      ? { ...f, subCards: [...f.subCards, { id: `tsc-${Date.now()}`, label }] }
      : f
    ));
    setTechSubCardLabel('');
    setAddSubCardTargetId(null);
  };

  const handleDeleteTechSubCard = (funcId: string, cardId: string) => {
    setTechFunctions(prev => prev.map(f => f.id === funcId
      ? { ...f, subCards: f.subCards.filter(sc => sc.id !== cardId) }
      : f
    ));
  };

  const handleSaveTechSubCardEdit = () => {
    if (!editingTechSubCardId) return;
    const { funcId, cardId } = editingTechSubCardId;
    const newLabel = techSubCardEditValue.trim();
    if (!newLabel) return;
    setTechFunctions(prev => prev.map(f => f.id === funcId
      ? { ...f, subCards: f.subCards.map(sc => sc.id === cardId ? { ...sc, label: newLabel } : sc) }
      : f
    ));
    setEditingTechSubCardId(null);
    setTechSubCardEditValue('');
  };

  const toggleTechFunc = (id: string) => {
    setExpandedTechFuncIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- INS List handlers ---
  const handleAddInsEntry = () => {
    const name = insName.trim();
    if (!name) return;
    const newEntry: InsEntry = {
      id: `ins-${Date.now()}`,
      name,
      description: insDescription.trim() || undefined,
      subCards: []
    };
    setInsEntries(prev => [newEntry, ...prev]);
    setInsName('');
    setInsDescription('');
    setIsInsModalOpen(false);
    setExpandedInsIds(prev => new Set(prev).add(newEntry.id));
  };

  const handleDeleteInsEntry = (id: string) => {
    setInsEntries(prev => prev.filter(e => e.id !== id));
    fetch('/api/food-safety-lists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) }).catch(console.error);
  };

  const handleSaveInsEdit = () => {
    if (!editInsId || !editInsForm.name.trim()) return;
    setInsEntries(prev => prev.map(e => e.id === editInsId
      ? { ...e, name: editInsForm.name.trim(), description: editInsForm.description.trim() || undefined }
      : e));
    setEditInsId(null);
  };

  const handleAddInsSubCard = (entryId: string) => {
    const productName = insSubProduct.trim();
    if (!productName) return;
    const newSub: InsSubCard = {
      id: `inssub-${Date.now()}`,
      productName,
      maxLimit: insSubMaxLimit.trim(),
      comments: insSubComments.trim(),
    };
    setInsEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, subCards: [...e.subCards, newSub] }
      : e));
    setInsSubProduct('');
    setInsSubMaxLimit('');
    setInsSubComments('');
    setAddInsSubTargetId(null);
  };

  const handleDeleteInsSubCard = (entryId: string, cardId: string) => {
    setInsEntries(prev => prev.map(e => e.id === entryId
      ? { ...e, subCards: e.subCards.filter(s => s.id !== cardId) }
      : e));
  };

  const handleSaveInsSubEdit = () => {
    if (!editingInsSubId || !insSubEditForm.productName.trim()) return;
    setInsEntries(prev => prev.map(e => e.id === editingInsSubId.entryId
      ? { ...e, subCards: e.subCards.map(s => s.id === editingInsSubId.cardId
          ? { ...s, productName: insSubEditForm.productName.trim(), maxLimit: insSubEditForm.maxLimit.trim(), comments: insSubEditForm.comments.trim() }
          : s) }
      : e));
    setEditingInsSubId(null);
    setInsSubEditForm({ productName: '', maxLimit: '', comments: '' });
  };

  const toggleInsEntry = (id: string) => {
    setExpandedInsIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDownloadInsSample = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['INS Number / Name', 'Description'],
      ['E100 – Curcumin', 'Natural yellow pigment from turmeric; used in dairy, confectionery'],
      ['INS 200 – Sorbic Acid', 'Antimicrobial preservative; effective against moulds and yeasts'],
      ['INS 330 – Citric Acid', 'Acidulant and antioxidant synergist; widely used in beverages'],
      ['E471 – Mono- and Diglycerides of Fatty Acids', 'Emulsifier derived from glycerol and fatty acids'],
      ['INS 415 – Xanthan Gum', 'Polysaccharide thickener and stabiliser'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws, 'INS Template');
    XLSX.writeFile(wb, 'ins_bulk_upload_template.xlsx');
  };

  const handleInsBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) { alert('File is empty or has no data rows.'); return; }

        const headerRow = rows[0].map(h => String(h).toLowerCase().trim());
        let nameCol = headerRow.findIndex(h => h.includes('ins') || h.includes('name') || h.includes('number'));
        let descCol = headerRow.findIndex(h => h.includes('desc'));
        if (nameCol === -1) nameCol = 0;
        if (descCol === -1) descCol = 1;

        const newEntries: InsEntry[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[nameCol] ?? '').trim();
          if (!name) continue;
          const description = descCol < row.length ? String(row[descCol] ?? '').trim() : '';
          newEntries.push({
            id: `ins-bulk-${Date.now()}-${i}`,
            name,
            description: description || undefined,
            subCards: []
          });
        }
        if (newEntries.length === 0) { alert('No valid INS entries found. Ensure column A has the INS Number / Name.'); return; }
        setInsEntries(prev => [...prev, ...newEntries]);
        alert(`✓ Imported ${newEntries.length} INS entr${newEntries.length !== 1 ? 'ies' : 'y'} successfully.`);
      } catch {
        alert('Failed to parse the file. Please use an Excel (.xlsx) or CSV file.');
      } finally {
        if (insFileInputRef.current) insFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (loadingFromDb) {
    return (
      <div className="flex flex-col items-center justify-center py-32 animate-in fade-in duration-300">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Specifications...</p>
      </div>
    );
  }

  // ── Generic Food Safety List handlers ──────────────────────────────────────
  const getFsEntries = (cat: string): FSEntry[] => fsData[cat] || [];
  const isFsExpanded = (cat: string, id: string) => (expandedFsIds[cat] || new Set()).has(id);

  const toggleFsEntry = (cat: string, id: string) => {
    setExpandedFsIds(prev => {
      const s = new Set(prev[cat] || []);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...prev, [cat]: s };
    });
  };
  const handleAddFsEntry = () => {
    const name = fsEntryName.trim();
    if (!name) return;
    const newEntry: FSEntry = { id: `fse-${Date.now()}`, name, description: fsEntryDescription.trim() || undefined, rows: [] };
    setFsData(prev => ({ ...prev, [fsModalCategory]: [...(prev[fsModalCategory] || []), newEntry] }));
    setFsEntryName(''); setFsEntryDescription(''); setIsFsEntryModalOpen(false);
  };
  const handleDeleteFsEntry = (cat: string, id: string) => {
    setFsData(prev => ({ ...prev, [cat]: (prev[cat] || []).filter(e => e.id !== id) }));
    fetch('/api/food-safety-lists', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) }).catch(console.error);
  };
  const handleSaveEditFsEntry = () => {
    if (!editFsEntryTarget || !editFsEntryForm.name.trim()) return;
    const { cat, id } = editFsEntryTarget;
    setFsData(prev => ({ ...prev, [cat]: (prev[cat] || []).map(e => e.id === id ? { ...e, name: editFsEntryForm.name.trim(), description: editFsEntryForm.description.trim() || undefined } : e) }));
    setEditFsEntryTarget(null);
  };
  const handleAddFsRow = () => {
    if (!addFsRowTarget || !fsRowProduct.trim()) return;
    const { cat, entryId } = addFsRowTarget;
    const newRow: FSRow = { id: `fsr-${Date.now()}`, productName: fsRowProduct.trim(), maxLimit: fsRowMaxLimit.trim(), comments: fsRowComments.trim() };
    setFsData(prev => ({ ...prev, [cat]: (prev[cat] || []).map(e => e.id === entryId ? { ...e, rows: [...e.rows, newRow] } : e) }));
    setFsRowProduct(''); setFsRowMaxLimit(''); setFsRowComments(''); setAddFsRowTarget(null);
  };
  const handleDeleteFsRow = (cat: string, entryId: string, rowId: string) => {
    setFsData(prev => ({ ...prev, [cat]: (prev[cat] || []).map(e => e.id === entryId ? { ...e, rows: e.rows.filter(r => r.id !== rowId) } : e) }));
  };
  const handleSaveFsRowEdit = () => {
    if (!editingFsRow || !fsRowEditForm.productName.trim()) return;
    const { cat, entryId, rowId } = editingFsRow;
    setFsData(prev => ({ ...prev, [cat]: (prev[cat] || []).map(e => e.id === entryId ? { ...e, rows: e.rows.map(r => r.id === rowId ? { ...r, ...fsRowEditForm } : r) } : e) }));
    setEditingFsRow(null); setFsRowEditForm({ productName: '', maxLimit: '', comments: '' });
  };

  // ── Generic Food Safety category tab renderer ───────────────────────────────
  const renderFSCategoryTab = (cat: string, label: string) => {
    const entries = getFsEntries(cat);
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        {/* Header bar */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <FileDigit size={20} />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">{label}</h3>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} defined</p>
            </div>
          </div>
          <button
            onClick={() => { setFsModalCategory(cat); setFsEntryName(''); setFsEntryDescription(''); setIsFsEntryModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md hover:bg-teal-700 active:scale-95 transition-all"
          >
            <Plus size={14} strokeWidth={3} /> Add Entry
          </button>
        </div>

        {/* Datalist for Product Name linked to Doc Specs */}
        <datalist id={`fs-product-list-${cat}`}>
          {groups.flatMap(g => [
            <option key={`g-${g.id}`} value={g.title} />,
            ...g.subCards.flatMap(s => [
              <option key={`s-${s.id}`} value={s.label} />,
              ...s.subSubCards.map(ssc => <option key={`ssc-${ssc.id}`} value={ssc.label} />)
            ])
          ])}
        </datalist>

        {/* Entry Cards */}
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <FileDigit size={48} className="text-slate-200 mb-4" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">No {label} entries yet</p>
            <p className="text-xs text-slate-300 mt-1">Click "Add Entry" to create one</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(entry => {
              const isExpandedEntry = isFsExpanded(cat, entry.id);
              const isAddingRow = addFsRowTarget?.cat === cat && addFsRowTarget?.entryId === entry.id;
              const isEditingThisEntry = editFsEntryTarget?.cat === cat && editFsEntryTarget?.id === entry.id;
              return (
                <div key={entry.id} className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${isExpandedEntry ? 'border-teal-300 shadow-lg' : 'border-slate-100 shadow-sm hover:border-teal-200'}`}>
                  {/* Card Header */}
                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-4 min-w-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => toggleFsEntry(cat, entry.id)}>
                        <div className={`p-2.5 rounded-xl shrink-0 ${isExpandedEntry ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-600'}`}>
                          <FileDigit size={18} />
                        </div>
                        <div className="min-w-0">
                          {isEditingThisEntry ? (
                            <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                className="px-2 py-1 text-sm font-bold border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                                value={editFsEntryForm.name}
                                onChange={e => setEditFsEntryForm(f => ({ ...f, name: e.target.value }))}
                              />
                              <input
                                className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white text-slate-500"
                                value={editFsEntryForm.description}
                                onChange={e => setEditFsEntryForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Description (optional)"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight leading-tight">{entry.name}</p>
                              {entry.description && <p className="text-[10px] md:text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">{entry.description}</p>}
                              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest mt-1">{entry.rows.length} row{entry.rows.length !== 1 ? 's' : ''}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isEditingThisEntry ? (
                          <>
                            <button onClick={() => handleSaveEditFsEntry()} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Check size={15} strokeWidth={3} /></button>
                            <button onClick={() => setEditFsEntryTarget(null)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"><X size={15} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setEditFsEntryTarget({ cat, id: entry.id }); setEditFsEntryForm({ name: entry.name, description: entry.description || '' }); }} className="p-2 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"><Pencil size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setAddFsRowTarget(isAddingRow ? null : { cat, entryId: entry.id }); if (!isExpandedEntry) toggleFsEntry(cat, entry.id); }} className="p-2 text-slate-300 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="Add row"><Plus size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFsEntry(cat, entry.id); }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                            <button onClick={() => toggleFsEntry(cat, entry.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all">
                              {isExpandedEntry ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Table + Add form */}
                  {isExpandedEntry && (
                    <div className="border-t border-slate-100 bg-teal-50/20 px-3 md:px-5 py-3 md:py-4">
                      {/* Inline add form */}
                      {isAddingRow && (
                        <div className="mb-3 p-3 bg-white rounded-xl border border-teal-200 shadow-sm animate-in fade-in duration-150">
                          <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest mb-2">New Row</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                            <input
                              autoFocus
                              list={`fs-product-list-${cat}`}
                              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-slate-300"
                              placeholder="Product Name *"
                              value={fsRowProduct}
                              onChange={e => setFsRowProduct(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Escape') { setAddFsRowTarget(null); setFsRowProduct(''); setFsRowMaxLimit(''); setFsRowComments(''); } }}
                            />
                            <input
                              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-slate-300"
                              placeholder="Maximum Limit"
                              value={fsRowMaxLimit}
                              onChange={e => setFsRowMaxLimit(e.target.value)}
                            />
                            <input
                              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-slate-300"
                              placeholder="Comments"
                              value={fsRowComments}
                              onChange={e => setFsRowComments(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddFsRow(); }}
                            />
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => { setAddFsRowTarget(null); setFsRowProduct(''); setFsRowMaxLimit(''); setFsRowComments(''); }} className="px-3 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-lg transition-all border border-slate-200 bg-white">Cancel</button>
                            <button onClick={handleAddFsRow} className="px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-all active:scale-95">Add Row</button>
                          </div>
                        </div>
                      )}

                      {/* Table */}
                      {entry.rows.length === 0 && !isAddingRow ? (
                        <div className="py-8 flex flex-col items-center gap-2 text-slate-300">
                          <FileText size={28} />
                          <p className="text-[10px] font-bold uppercase tracking-wider">No rows yet</p>
                          <button onClick={() => setAddFsRowTarget({ cat, entryId: entry.id })} className="text-[10px] font-bold text-teal-500 hover:text-teal-700 uppercase tracking-wide">+ Add first row</button>
                        </div>
                      ) : entry.rows.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-teal-50 border-b border-teal-100">
                                <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-wider w-10 text-center">Sl No</th>
                                <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-wider">Product Name</th>
                                <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-wider w-36">Maximum Limit</th>
                                <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-wider">Comments</th>
                                <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-teal-700 uppercase tracking-wider w-16 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.rows.map((row, idx) => {
                                const isEditingRow = editingFsRow?.cat === cat && editingFsRow?.entryId === entry.id && editingFsRow?.rowId === row.id;
                                return (
                                  <tr key={row.id} className={`border-b border-slate-50 transition-all ${isEditingRow ? 'bg-teal-50/60' : 'bg-white hover:bg-teal-50/30'}`}>
                                    <td className="px-3 py-2.5 text-[10px] font-black text-slate-300 text-center">{(idx + 1).toString().padStart(2, '0')}</td>
                                    <td className="px-3 py-2.5">
                                      {isEditingRow ? (
                                        <input autoFocus list={`fs-product-list-${cat}`} className="w-full px-2 py-1 text-xs border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={fsRowEditForm.productName} onChange={e => setFsRowEditForm(f => ({ ...f, productName: e.target.value }))} />
                                      ) : (
                                        <span className="text-xs font-semibold text-slate-700">{row.productName}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {isEditingRow ? (
                                        <input className="w-full px-2 py-1 text-xs border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={fsRowEditForm.maxLimit} onChange={e => setFsRowEditForm(f => ({ ...f, maxLimit: e.target.value }))} />
                                      ) : (
                                        <span className="text-xs text-slate-600">{row.maxLimit || <span className="text-slate-300">—</span>}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {isEditingRow ? (
                                        <input className="w-full px-2 py-1 text-xs border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" value={fsRowEditForm.comments} onChange={e => setFsRowEditForm(f => ({ ...f, comments: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleSaveFsRowEdit(); if (e.key === 'Escape') { setEditingFsRow(null); setFsRowEditForm({ productName: '', maxLimit: '', comments: '' }); } }} />
                                      ) : (
                                        <span className="text-xs text-slate-500">{row.comments || <span className="text-slate-300">—</span>}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-1 justify-center">
                                        {isEditingRow ? (
                                          <>
                                            <button onClick={handleSaveFsRowEdit} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Check size={13} strokeWidth={3} /></button>
                                            <button onClick={() => { setEditingFsRow(null); setFsRowEditForm({ productName: '', maxLimit: '', comments: '' }); }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"><X size={13} /></button>
                                          </>
                                        ) : (
                                          <>
                                            <button onClick={() => { setEditingFsRow({ cat, entryId: entry.id, rowId: row.id }); setFsRowEditForm({ productName: row.productName, maxLimit: row.maxLimit, comments: row.comments }); }} className="p-1.5 text-slate-300 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-all"><Pencil size={12} /></button>
                                            <button onClick={() => handleDeleteFsRow(cat, entry.id, row.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={12} /></button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Entry Modal */}
        {isFsEntryModalOpen && fsModalCategory === cat && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight mb-4">New {label} Entry</h2>
              <div className="space-y-3 mb-5">
                <input autoFocus className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300 placeholder:font-normal" placeholder="Entry name / INS number *" value={fsEntryName} onChange={e => setFsEntryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddFsEntry(); if (e.key === 'Escape') setIsFsEntryModalOpen(false); }} />
                <textarea rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300 resize-none" placeholder="Description (optional)" value={fsEntryDescription} onChange={e => setFsEntryDescription(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button onClick={() => setIsFsEntryModalOpen(false)} className="px-5 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold rounded-xl border border-slate-200 bg-white transition-all">Cancel</button>
                <button onClick={handleAddFsEntry} disabled={!fsEntryName.trim()} className="px-5 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">Create Entry</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFSTabs = (
    id: string,
    tabMap: Record<string, string>,
    setTabMap: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    compact = false
  ) => {
    const activeTab = tabMap[id] || FOOD_SAFETY_TABS[0].key;
    return (
      <div className={compact ? 'mt-2 pt-2 border-t border-slate-100' : 'mt-4 pt-4 border-t border-slate-100'}>
        <div className="flex flex-wrap gap-1 mb-2">
          {FOOD_SAFETY_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={(e) => { e.stopPropagation(); setTabMap(prev => ({ ...prev, [id]: tab.key })); }}
              className={`px-2 py-1 rounded-lg font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-teal-600 text-white text-[9px] md:text-[10px] shadow-sm'
                  : 'bg-slate-100 text-slate-500 text-[8px] md:text-[9px] hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 md:p-4 min-h-[56px] flex items-center justify-center border border-slate-100">
          <p className="text-[9px] md:text-[10px] text-slate-300 font-bold uppercase tracking-widest">
            {FOOD_SAFETY_TABS.find(t => t.key === activeTab)?.label} — no data recorded yet
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto px-0">
      <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileChange} />
      <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleBulkFileUpload} />
      <input type="file" ref={insFileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleInsBulkUpload} />
      <input type="file" ref={s3FileInputRef} className="hidden" accept="application/pdf" onChange={handleS3FileChange} />
      
      <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 md:w-2 h-full bg-indigo-600" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex items-center gap-3 md:gap-5 pl-2 md:pl-0">
            <div className="p-2.5 md:p-4 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-3xl shadow-inner border border-indigo-100"><BookOpen size={22} className="md:hidden" /><BookOpen size={32} className="hidden md:block" /></div>
            <div>
              <h2 className="text-base md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Doc Specifications</h2>
              <p className="text-[8px] md:text-[10px] font-bold text-slate-400 mt-1 md:mt-2 uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center gap-1.5 md:gap-2">
                <ShieldCheck size={10} className="text-emerald-500 md:hidden" /><ShieldCheck size={12} className="text-emerald-500 hidden md:block" /> Compliance Vault
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 z-10 w-full md:w-auto">
            <div className="relative group w-full md:w-64">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input type="text" placeholder="Search registry..." className="w-full pl-9 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase tracking-wider" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={handleDownloadSampleCsv} className="flex-1 md:flex-none px-3 md:px-4 py-2.5 md:py-3.5 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-[0.15em] shadow-lg hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2" title="Download sample Excel template">
                <Download size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Sample</span>
              </button>
              <button onClick={() => bulkFileInputRef.current?.click()} className="flex-1 md:flex-none px-3 md:px-4 py-2.5 md:py-3.5 bg-amber-500 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-[0.15em] shadow-lg hover:bg-amber-600 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2" title="Bulk import from Excel">
                <Upload size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Import</span>
              </button>
              <button onClick={() => setIsMainModalOpen(true)} className="flex-1 md:flex-none px-3 md:px-5 py-2.5 md:py-3.5 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-[0.2em] shadow-2xl hover:bg-indigo-600 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2">
                <Plus size={16} strokeWidth={3} /> <span className="hidden sm:inline">Add</span> Group
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Internal Sub-Tab Switcher ── */}
      <div className="overflow-x-auto pb-1 -mb-1">
        <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl p-1 shadow-sm w-max min-w-full">
          <button
            onClick={() => setActiveDocSubTab('doc-specs')}
            className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${activeDocSubTab === 'doc-specs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Doc Specifications
          </button>
          <button
            onClick={() => setActiveDocSubTab('tech-functions')}
            className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${activeDocSubTab === 'tech-functions' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Tech Functions
          </button>
          <button
            onClick={() => setActiveDocSubTab('ins-list')}
            className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${activeDocSubTab === 'ins-list' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            INS List
          </button>
          {OTHER_FS_CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveDocSubTab(c.key)}
              className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${activeDocSubTab === c.key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Technical Function List Tab ── */}
      {activeDocSubTab === 'tech-functions' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Header bar */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 text-violet-600 rounded-xl border border-violet-100">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">Technical Function List</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{techFunctions.length} function{techFunctions.length !== 1 ? 's' : ''} defined</p>
              </div>
            </div>
            <button
              onClick={() => { setTechFuncName(''); setIsTechFuncModalOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md hover:bg-violet-700 active:scale-95 transition-all"
            >
              <Plus size={14} strokeWidth={3} /> Add Function
            </button>
          </div>

          {/* Function Cards */}
          {techFunctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Layers size={48} className="text-slate-200 mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">No technical functions yet</p>
              <p className="text-xs text-slate-300 mt-1">Click "Add Function" to create one</p>
            </div>
          ) : (
            <div className="space-y-4">
              {techFunctions.map(func => {
                const isExpanded = expandedTechFuncIds.has(func.id);
                const isAddingSubCard = addSubCardTargetId === func.id;
                return (
                  <div key={func.id} className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${isExpanded ? 'border-violet-300 shadow-lg' : 'border-slate-100 shadow-sm hover:border-violet-200'}`}>
                    {/* Card Header */}
                    <div className="p-4 md:p-5 flex items-center gap-3">
                      <button
                        onClick={() => toggleTechFunc(func.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600'}`}>
                          <Layers size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-900 text-sm md:text-base uppercase tracking-tight">{func.name}</h4>
                          {func.description && <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">{func.description}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">{func.subCards.length} sub-item{func.subCards.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditTechFuncId(func.id); setEditTechFuncForm({ name: func.name, description: func.description || '' }); }}
                          className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                          title="Edit function"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setAddSubCardTargetId(isAddingSubCard ? null : func.id); setTechSubCardLabel(''); if (!isExpanded) toggleTechFunc(func.id); }}
                          className="p-2 text-violet-500 hover:bg-violet-50 rounded-lg transition-all"
                          title="Add sub-item"
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDeleteTechFunction(func.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete function"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button onClick={() => toggleTechFunc(func.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: Sub-cards + Add form */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 md:px-5 py-4 space-y-2">
                        {/* Add sub-card inline form */}
                        {isAddingSubCard && (
                          <div className="flex items-center gap-2 mb-3 p-3 bg-white rounded-xl border border-violet-200 shadow-sm animate-in fade-in duration-150">
                            <input
                              autoFocus
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                              placeholder="Enter sub-item name..."
                              value={techSubCardLabel}
                              onChange={e => setTechSubCardLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddTechSubCard(func.id); if (e.key === 'Escape') { setAddSubCardTargetId(null); setTechSubCardLabel(''); } }}
                            />
                            <button
                              onClick={() => handleAddTechSubCard(func.id)}
                              className="px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-all active:scale-95"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setAddSubCardTargetId(null); setTechSubCardLabel(''); }}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {/* Sub-cards list */}
                        {func.subCards.length === 0 ? (
                          <div className="py-6 flex flex-col items-center gap-2 text-slate-300">
                            <FileText size={28} />
                            <p className="text-[10px] font-bold uppercase tracking-wider">No sub-items yet</p>
                            <button
                              onClick={() => { setAddSubCardTargetId(func.id); setTechSubCardLabel(''); }}
                              className="text-[10px] font-bold text-violet-500 hover:text-violet-700 uppercase tracking-wide"
                            >
                              + Add first sub-item
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {func.subCards.map((sc, idx) => {
                              const isEditing = editingTechSubCardId?.funcId === func.id && editingTechSubCardId?.cardId === sc.id;
                              return (
                                <div key={sc.id} className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 px-3 py-2.5 shadow-sm group hover:border-violet-200 transition-all">
                                  <span className="text-[9px] font-black text-slate-300 w-5 text-center shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                                  {isEditing ? (
                                    <input
                                      autoFocus
                                      className="flex-1 px-2 py-1 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                                      value={techSubCardEditValue}
                                      onChange={e => setTechSubCardEditValue(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') handleSaveTechSubCardEdit(); if (e.key === 'Escape') { setEditingTechSubCardId(null); setTechSubCardEditValue(''); } }}
                                    />
                                  ) : (
                                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{sc.label}</span>
                                  )}
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {isEditing ? (
                                      <>
                                        <button onClick={handleSaveTechSubCardEdit} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Check size={13} strokeWidth={3} /></button>
                                        <button onClick={() => { setEditingTechSubCardId(null); setTechSubCardEditValue(''); }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all"><X size={13} /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => { setEditingTechSubCardId({ funcId: func.id, cardId: sc.id }); setTechSubCardEditValue(sc.label); }} className="p-1.5 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-all"><FileText size={13} /></button>
                                        <button onClick={() => handleDeleteTechSubCard(func.id, sc.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13} /></button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Technical Function Modal */}
          {isTechFuncModalOpen && (
            <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-50 rounded-lg text-violet-600"><Layers size={18} /></div>
                    <h3 className="text-sm font-bold text-slate-800">New Technical Function</h3>
                  </div>
                  <button onClick={() => setIsTechFuncModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Technical Function Name</label>
                    <input
                      autoFocus
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                      placeholder="e.g. Preservative, Emulsifier, Stabilizer..."
                      value={techFuncName}
                      onChange={e => setTechFuncName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setIsTechFuncModalOpen(false); }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all resize-none h-20"
                      placeholder="Describe what this technical function covers..."
                      value={techFuncDescription}
                      onChange={e => setTechFuncDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="px-6 pb-5 flex justify-end gap-3">
                  <button onClick={() => { setIsTechFuncModalOpen(false); setTechFuncName(''); setTechFuncDescription(''); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors">Cancel</button>
                  <button
                    onClick={handleAddTechFunction}
                    disabled={!techFuncName.trim()}
                    className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    Create Function
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INS List Tab ── */}
      {activeDocSubTab === 'ins-list' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Header bar */}
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <FileDigit size={20} />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">INS List</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">{insEntries.length} entr{insEntries.length !== 1 ? 'ies' : 'y'} defined</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadInsSample}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
                title="Download sample Excel template"
              >
                <Download size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Sample</span>
              </button>
              <button
                onClick={() => insFileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
                title="Bulk import from Excel or CSV"
              >
                <Upload size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Import</span>
              </button>
              <button
                onClick={() => { setInsName(''); setInsDescription(''); setIsInsModalOpen(true); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wide shadow-md hover:bg-amber-700 active:scale-95 transition-all"
              >
                <Plus size={14} strokeWidth={3} /> Add Entry
              </button>
            </div>
          </div>

          {/* INS Entry Cards */}
          {insEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <FileDigit size={48} className="text-slate-200 mb-4" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">No INS entries yet</p>
              <p className="text-xs text-slate-300 mt-1">Click "Add Entry" to create one</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Datalist: all Doc Spec names (group → sub-card → sub-sub-card) */}
              <datalist id="ins-product-list">
                {groups.flatMap(g => [
                  <option key={`g-${g.id}`} value={g.title} />,
                  ...g.subCards.flatMap(s => [
                    <option key={`s-${s.id}`} value={s.label} />,
                    ...s.subSubCards.map(ssc => <option key={`ssc-${ssc.id}`} value={ssc.label} />)
                  ])
                ])}
              </datalist>

              {insEntries.map(entry => {
                const isExpanded = expandedInsIds.has(entry.id);
                const isAddingSub = addInsSubTargetId === entry.id;
                return (
                  <div key={entry.id} className={`bg-white rounded-2xl border-2 transition-all overflow-hidden ${isExpanded ? 'border-amber-300 shadow-lg' : 'border-slate-100 shadow-sm hover:border-amber-200'}`}>
                    {/* Card Header */}
                    <div className="p-4 md:p-5 flex items-center gap-3">
                      <button
                        onClick={() => toggleInsEntry(entry.id)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isExpanded ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
                          <FileDigit size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-slate-900 text-sm md:text-base uppercase tracking-tight">{entry.name}</h4>
                          {entry.description && <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">{entry.description}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{entry.subCards.length} sub-item{entry.subCards.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditInsId(entry.id); setEditInsForm({ name: entry.name, description: entry.description || '' }); }}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                          title="Edit entry"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => { setAddInsSubTargetId(isAddingSub ? null : entry.id); setInsSubLabel(''); if (!isExpanded) toggleInsEntry(entry.id); }}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all"
                          title="Add sub-item"
                        >
                          <Plus size={16} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDeleteInsEntry(entry.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete entry"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button onClick={() => toggleInsEntry(entry.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-all">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: Table + Add form */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-amber-50/20 px-3 md:px-5 py-3 md:py-4">

                        {/* Inline add form */}
                        {isAddingSub && (
                          <div className="mb-3 p-3 bg-white rounded-xl border border-amber-200 shadow-sm animate-in fade-in duration-150">
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">New Row</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                              <input
                                autoFocus
                                list="ins-product-list"
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-300"
                                placeholder="Product Name *"
                                value={insSubProduct}
                                onChange={e => setInsSubProduct(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Escape') { setAddInsSubTargetId(null); setInsSubProduct(''); setInsSubMaxLimit(''); setInsSubComments(''); } }}
                              />
                              <input
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-300"
                                placeholder="Maximum Limit"
                                value={insSubMaxLimit}
                                onChange={e => setInsSubMaxLimit(e.target.value)}
                              />
                              <input
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-slate-300"
                                placeholder="Comments"
                                value={insSubComments}
                                onChange={e => setInsSubComments(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddInsSubCard(entry.id); }}
                              />
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => { setAddInsSubTargetId(null); setInsSubProduct(''); setInsSubMaxLimit(''); setInsSubComments(''); }} className="px-3 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold rounded-lg transition-all border border-slate-200 bg-white">Cancel</button>
                              <button onClick={() => handleAddInsSubCard(entry.id)} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-all active:scale-95">Add Row</button>
                            </div>
                          </div>
                        )}

                        {/* Table */}
                        {entry.subCards.length === 0 && !isAddingSub ? (
                          <div className="py-8 flex flex-col items-center gap-2 text-slate-300">
                            <FileText size={28} />
                            <p className="text-[10px] font-bold uppercase tracking-wider">No rows yet</p>
                            <button
                              onClick={() => { setAddInsSubTargetId(entry.id); }}
                              className="text-[10px] font-bold text-amber-500 hover:text-amber-700 uppercase tracking-wide"
                            >
                              + Add first row
                            </button>
                          </div>
                        ) : entry.subCards.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-amber-50 border-b border-amber-100">
                                  <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-wider w-10 text-center">Sl No</th>
                                  <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-wider">Product Name</th>
                                  <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-wider w-36">Maximum Limit</th>
                                  <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-wider">Comments</th>
                                  <th className="px-3 py-2.5 text-[9px] md:text-[10px] font-black text-amber-700 uppercase tracking-wider w-16 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.subCards.map((sc, idx) => {
                                  const isEditing = editingInsSubId?.entryId === entry.id && editingInsSubId?.cardId === sc.id;
                                  return (
                                    <tr key={sc.id} className={`border-b border-slate-50 transition-all ${isEditing ? 'bg-amber-50/60' : 'bg-white hover:bg-amber-50/30'}`}>
                                      <td className="px-3 py-2.5 text-[10px] font-black text-slate-300 text-center">{(idx + 1).toString().padStart(2, '0')}</td>
                                      <td className="px-3 py-2.5">
                                        {isEditing ? (
                                          <input
                                            autoFocus
                                            list="ins-product-list"
                                            className="w-full px-2 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                            value={insSubEditForm.productName}
                                            onChange={e => setInsSubEditForm(f => ({ ...f, productName: e.target.value }))}
                                          />
                                        ) : (
                                          <span className="text-xs font-semibold text-slate-700">{sc.productName}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        {isEditing ? (
                                          <input
                                            className="w-full px-2 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                            value={insSubEditForm.maxLimit}
                                            onChange={e => setInsSubEditForm(f => ({ ...f, maxLimit: e.target.value }))}
                                          />
                                        ) : (
                                          <span className="text-xs text-slate-600">{sc.maxLimit || <span className="text-slate-300">—</span>}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        {isEditing ? (
                                          <input
                                            className="w-full px-2 py-1 text-xs border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                                            value={insSubEditForm.comments}
                                            onChange={e => setInsSubEditForm(f => ({ ...f, comments: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveInsSubEdit(); if (e.key === 'Escape') { setEditingInsSubId(null); setInsSubEditForm({ productName: '', maxLimit: '', comments: '' }); } }}
                                          />
                                        ) : (
                                          <span className="text-xs text-slate-500">{sc.comments || <span className="text-slate-300">—</span>}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1 justify-center">
                                          {isEditing ? (
                                            <>
                                              <button onClick={handleSaveInsSubEdit} className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all" title="Save"><Check size={13} strokeWidth={3} /></button>
                                              <button onClick={() => { setEditingInsSubId(null); setInsSubEditForm({ productName: '', maxLimit: '', comments: '' }); }} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-all" title="Cancel"><X size={13} /></button>
                                            </>
                                          ) : (
                                            <>
                                              <button onClick={() => { setEditingInsSubId({ entryId: entry.id, cardId: sc.id }); setInsSubEditForm({ productName: sc.productName, maxLimit: sc.maxLimit, comments: sc.comments }); }} className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Edit"><Pencil size={12} /></button>
                                              <button onClick={() => handleDeleteInsSubCard(entry.id, sc.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete"><Trash2 size={12} /></button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add INS Entry Modal */}
          {isInsModalOpen && (
            <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><FileDigit size={18} /></div>
                    <h3 className="text-sm font-bold text-slate-800">New INS Entry</h3>
                  </div>
                  <button onClick={() => setIsInsModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">INS Number / Name</label>
                    <input
                      autoFocus
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                      placeholder="e.g. E100 – Curcumin, INS 330 – Citric Acid..."
                      value={insName}
                      onChange={e => setInsName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') setIsInsModalOpen(false); }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description <span className="text-slate-300 font-normal">(optional)</span></label>
                    <textarea
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none h-20"
                      placeholder="Describe the function, usage, or regulatory notes..."
                      value={insDescription}
                      onChange={e => setInsDescription(e.target.value)}
                    />
                  </div>
                </div>
                <div className="px-6 pb-5 flex justify-end gap-3">
                  <button onClick={() => { setIsInsModalOpen(false); setInsName(''); setInsDescription(''); }} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors">Cancel</button>
                  <button
                    onClick={handleAddInsEntry}
                    disabled={!insName.trim()}
                    className="px-5 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    Create Entry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Other Food Safety Category Tabs ── */}
      {OTHER_FS_CATEGORIES.map(c => activeDocSubTab === c.key && (
        <React.Fragment key={c.key}>
          {renderFSCategoryTab(c.key, c.label)}
        </React.Fragment>
      ))}

      {/* ── Doc Specifications Tab (original content) ── */}
      {activeDocSubTab === 'doc-specs' && <div className="grid grid-cols-1 gap-4 md:gap-8">
        {filteredGroups.map(group => {
          const isExpanded = expandedGroupIds.has(group.id);
          const isGroupSelected = selectedGroupIds.has(group.id);
          const allSubsSelected = group.subCards.length > 0 && group.subCards.every(sc => selectedSubIds.has(sc.id));
          const someSubsSelected = group.subCards.some(sc => selectedSubIds.has(sc.id) || sc.subSubCards.some(ssc => selectedSubSubIds.has(ssc.id)));
          const totalSubCards = group.subCards.length;
          const totalSubSubCards = group.subCards.reduce((sum, sc) => sum + sc.subSubCards.length, 0);
          const latestDate = getLatestDate(group);
          return (
            <div key={group.id} className={`bg-white rounded-2xl md:rounded-[3rem] border-2 transition-all duration-300 overflow-hidden flex flex-col group ${isGroupSelected ? 'border-rose-300 shadow-2xl ring-2 ring-rose-100' : isExpanded ? 'border-indigo-500 shadow-2xl' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
              <div className="p-4 md:p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-start gap-3 md:gap-5 mb-3 md:mb-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectGroup(group.id); }}
                    className={`w-5 h-5 md:w-6 md:h-6 rounded-md md:rounded-lg border-2 flex items-center justify-center shrink-0 transition-all mt-1 ${isGroupSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
                  >
                    {isGroupSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                  <div className="flex items-center gap-3 md:gap-5 cursor-pointer flex-1 min-w-0" onClick={() => toggleGroup(group.id)}>
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${group.iconColor} text-white flex items-center justify-center shadow-lg shrink-0`}><FolderOpen size={20} className="md:hidden" /><FolderOpen size={28} className="hidden md:block" /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1 md:mb-1.5 truncate">{group.title}</h3>
                      {group.description && <p className="text-[10px] md:text-xs text-slate-500 font-medium mb-1 md:mb-1.5 leading-relaxed">{group.description}</p>}
                      <div className="flex flex-wrap items-center gap-x-2 md:gap-x-4 gap-y-1 text-[8px] md:text-[9px] font-bold uppercase tracking-wider">
                        <span className="text-blue-600 bg-blue-50 px-1.5 md:px-2 py-0.5 rounded border border-blue-100">{totalSubCards} sub{totalSubCards !== 1 ? 's' : ''}</span>
                        <span className="text-violet-600 bg-violet-50 px-1.5 md:px-2 py-0.5 rounded border border-violet-100">{totalSubSubCards} sub-sub</span>
                        {latestDate && (
                          <span className="text-slate-400 flex items-center gap-1 hidden sm:flex"><Clock size={10} /> {formatDate(latestDate)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap mt-2 md:mt-0 pl-8 md:pl-0 md:justify-end">
                  {group.subCards.length > 0 && (
                    <button
                      onClick={() => allSubsSelected ? deselectAllInGroup(group) : selectAllInGroup(group)}
                      className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-wider transition-all border ${allSubsSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : someSubsSelected ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                      {allSubsSelected ? 'Desel' : 'Sel All'}
                    </button>
                  )}
                  <button onClick={() => { setActiveMainCardId(group.id); setIsSubModalOpen(true); }} className="px-2.5 md:px-4 py-1.5 md:py-2 bg-indigo-600 text-white rounded-lg md:rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-1.5 md:gap-2 text-[8px] md:text-[10px] font-black uppercase tracking-wide md:tracking-[0.1em]">
                    <Plus size={12} strokeWidth={3} /> Entry
                  </button>
                  <button onClick={() => toggleGroup(group.id)} className={`p-2 md:p-2.5 rounded-lg md:rounded-xl border transition-all flex items-center gap-1.5 md:gap-2 ${isExpanded ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-300 hover:text-indigo-600 shadow-sm'}`}>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">{isExpanded ? 'Collapse' : 'Show'}</span>
                    {isExpanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                  </button>
                  <button onClick={() => { setEditGroupId(group.id); setEditGroupForm({ title: group.title, description: group.description || '' }); }} className="p-2 md:p-2.5 bg-white text-slate-400 border border-slate-100 rounded-lg md:rounded-xl hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm" title="Edit group"><Pencil size={14} className="md:hidden" /><Pencil size={17} className="hidden md:block" /></button>
                  <button onClick={() => handleDeleteMain(group.id)} className="p-2 md:p-2.5 bg-white text-slate-300 border border-slate-100 rounded-lg md:rounded-xl hover:text-rose-600 hover:bg-rose-50 transition-all shadow-sm"><Trash2 size={16} className="md:hidden" /><Trash2 size={20} className="hidden md:block" /></button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-3 md:p-8 bg-white animate-in slide-in-from-top-4 duration-500">
                  {group.subCards.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      {group.subCards.map(sub => {
                        const isSubExpanded = expandedSubCardIds.has(sub.id);
                        const isSubSelected = selectedSubIds.has(sub.id);
                        const allSubSubsSelected = sub.subSubCards.length > 0 && sub.subSubCards.every(ssc => selectedSubSubIds.has(ssc.id));
                        const someSubSubsSelected = sub.subSubCards.some(ssc => selectedSubSubIds.has(ssc.id));
                        return (
                          <div key={sub.id} className={`border rounded-xl md:rounded-2xl overflow-hidden transition-all ${isSubSelected ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 hover:border-indigo-200'}`}>
                            <div className="bg-slate-50/50 p-3 md:p-5">
                              <div className="flex items-start gap-2 md:gap-4 min-w-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSelectSub(sub.id); }}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSubSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
                                >
                                  {isSubSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                </button>
                                <div className="flex items-center gap-2 md:gap-5 min-w-0 cursor-pointer flex-1" onClick={() => toggleSubCard(sub.id)}>
                                  <div className={`p-2 md:p-3.5 rounded-xl md:rounded-2xl shadow-sm shrink-0 ${sub.fileUrl ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}><FileText size={16} className="md:hidden" /><FileText size={22} className="hidden md:block" /></div>
                                <div className="min-w-0">
                                  <p className="text-xs md:text-base font-black text-slate-800 uppercase tracking-tight leading-tight mb-0.5 md:mb-1">{sub.label}</p>
                                  {sub.description && <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-relaxed mb-1 md:mb-2">{sub.description}</p>}
                                  <div className="flex flex-wrap items-center gap-x-2 md:gap-x-5 gap-y-1 text-[8px] md:text-[10px] font-bold text-slate-400">
                                    {sub.fileName ? (
                                      <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg border border-emerald-100"><CheckCircle2 size={10}/> <span className="truncate max-w-[80px] md:max-w-none">{sub.fileName}</span></span>
                                    ) : (
                                      <span className="text-rose-400 flex items-center gap-1 bg-rose-50 px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg border border-rose-100"><AlertCircle size={10}/> No PDF</span>
                                    )}
                                    <div className="hidden sm:flex items-center gap-1 opacity-70"><Clock size={10} className="text-slate-300" /><span>{sub.lastUpdated}</span></div>
                                    {sub.subSubCards.length > 0 && (
                                      <span className="text-indigo-600 flex items-center gap-1 bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg border border-indigo-100"><Layers size={10} /> {sub.subSubCards.length}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              </div>
                              <div className="flex items-center gap-1.5 md:gap-2 justify-end shrink-0 flex-wrap mt-2 md:mt-3 pl-7 md:pl-0">
                                {sub.subSubCards.length > 0 && (
                                  <button
                                    onClick={() => allSubSubsSelected ? deselectAllSubSubInSub(sub) : selectAllSubSubInSub(sub)}
                                    className={`px-2 py-1.5 md:px-2.5 md:py-2 rounded-lg md:rounded-xl text-[7px] md:text-[8px] font-black uppercase tracking-wider transition-all border ${allSubSubsSelected ? 'bg-violet-100 text-violet-700 border-violet-200' : someSubSubsSelected ? 'bg-violet-50 text-violet-600 border-violet-100' : 'bg-white text-slate-400 border-slate-200 hover:border-violet-300'}`}
                                  >
                                    {allSubSubsSelected ? '✓ Subs' : 'Sel'}
                                  </button>
                                )}
                                <button
                                  onClick={() => { setSpecCreatorTarget({ groupId: group.id, subId: sub.id }); setSpecCreatorOpen(true); }}
                                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2.5 bg-[#283593] text-white rounded-lg md:rounded-xl text-[7px] md:text-[9px] font-black uppercase tracking-wider hover:bg-[#5c6bc0] active:scale-95 transition-all shadow-lg"
                                >
                                  <FileText size={11} /> <span className="hidden sm:inline">Spec Creator</span><span className="sm:hidden">Spec</span>
                                </button>
                                <button
                                  onClick={() => { setActiveMainCardId(group.id); setActiveSubCardId(sub.id); setIsSubSubModalOpen(true); }}
                                  className="flex items-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2.5 bg-emerald-600 text-white rounded-lg md:rounded-xl text-[7px] md:text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                                >
                                  <PlusCircle size={11} /> <span className="hidden sm:inline">Sub-Item</span><span className="sm:hidden">Sub</span>
                                </button>
                                {sub.fileUrl && (
                                  <button onClick={() => window.open(sub.fileUrl!, '_blank')} className="p-1.5 md:p-2.5 bg-white border border-slate-200 rounded-lg md:rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm" title="View"><Eye size={14} /></button>
                                )}
                                <button
                                  onClick={() => { setUploadTarget(sub.id); fileInputRef.current?.click(); }}
                                  className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-4 py-1.5 md:py-2.5 rounded-lg md:rounded-xl text-[7px] md:text-[9px] font-black uppercase tracking-wider transition-all shadow-sm ${sub.fileUrl ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-700'}`}
                                >
                                  <FileUp size={12} /> <span className="hidden sm:inline">{sub.fileUrl ? 'Update' : 'Upload'}</span>
                                </button>
                                <button onClick={() => toggleSubCard(sub.id)} className="p-1.5 md:p-2.5 bg-white border border-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                                  {isSubExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                <button onClick={() => { setEditSubId(sub.id); setEditSubForm({ label: sub.label, description: sub.description || '' }); }} className="p-1.5 md:p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg md:rounded-xl transition-all" title="Edit specification"><Pencil size={13} /></button>
                                <button onClick={() => handleDeleteSub(group.id, sub.id)} className="p-1.5 md:p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg md:rounded-xl transition-all"><Trash2 size={14} /></button>
                              </div>
                            </div>

                            {isSubExpanded && (
                              <div className="px-3 pb-3 pt-2 md:px-5 md:pb-5 bg-white border-t border-slate-100">
                                {sub.subSubCards.length > 0 ? (
                                  <div className="ml-3 md:ml-8 border-l-2 border-indigo-100 pl-3 md:pl-5 space-y-2 md:space-y-3 mt-2 md:mt-3">
                                    {sub.subSubCards.map(ssc => {
                                      const isSSCSelected = selectedSubSubIds.has(ssc.id);
                                      const isSscExpanded = expandedSscIds.has(ssc.id);
                                      return (
                                      <div key={ssc.id} className={`border rounded-lg md:rounded-xl p-2.5 md:p-4 transition-all ${isSSCSelected ? 'bg-rose-50/40 border-rose-200' : 'bg-indigo-50/30 border-indigo-100'}`}>
                                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleSelectSubSub(ssc.id); }}
                                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSSCSelected ? 'bg-rose-500 border-rose-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
                                          >
                                            {isSSCSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                          </button>
                                          <div className={`p-1.5 md:p-2 rounded-md md:rounded-lg shrink-0 ${ssc.fileUrl ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}><FileText size={13} className="md:hidden" /><FileText size={16} className="hidden md:block" /></div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[11px] md:text-sm font-bold text-slate-700 uppercase tracking-tight truncate">{ssc.label}</p>
                                            <div className="flex items-center gap-2 md:gap-3 text-[8px] md:text-[9px] font-bold text-slate-400 mt-0.5 md:mt-1 flex-wrap">
                                              {ssc.fileName ? (
                                                <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50 px-1 md:px-1.5 py-0.5 rounded border border-emerald-100"><CheckCircle2 size={9}/> <span className="truncate max-w-[60px] md:max-w-none">{ssc.fileName}</span></span>
                                              ) : (
                                                <span className="text-slate-400">No file</span>
                                              )}
                                              {(ssc.subItems?.length ?? 0) > 0 && (
                                                <span className="text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">{ssc.subItems!.length} sub-item{ssc.subItems!.length !== 1 ? 's' : ''}</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 md:gap-1.5 shrink-0 flex-wrap justify-end mt-1.5 md:mt-0 pl-6 md:pl-0">
                                          <button
                                            onClick={() => { setSpecCreatorTarget({ groupId: group.id, subId: sub.id, subSubId: ssc.id }); setSpecCreatorOpen(true); }}
                                            className="flex items-center gap-1 px-2 md:px-2.5 py-1 md:py-1.5 bg-[#283593] text-white rounded-md md:rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-wider hover:bg-[#5c6bc0] active:scale-95 transition-all shadow-md"
                                          >
                                            <FileText size={10} /> Spec
                                          </button>
                                          <button
                                            onClick={() => { setActiveS3ParentIds({ groupId: group.id, subId: sub.id, sscId: ssc.id }); setS3Form({ label: '' }); setIsS3ModalOpen(true); }}
                                            className="flex items-center gap-1 px-2 md:px-2.5 py-1 md:py-1.5 bg-violet-600 text-white rounded-md md:rounded-lg text-[7px] md:text-[8px] font-black uppercase tracking-wider hover:bg-violet-700 active:scale-95 transition-all shadow-md"
                                          >
                                            <Plus size={9} /> Sub-Item
                                          </button>
                                          {ssc.fileUrl && (
                                            <button onClick={() => window.open(ssc.fileUrl!, '_blank')} className="p-1 md:p-1.5 bg-white border border-slate-200 rounded-md md:rounded-lg text-slate-400 hover:text-indigo-600 transition-all" title="View"><Eye size={12} /></button>
                                          )}
                                          <button onClick={() => { setUploadTarget(ssc.id); fileInputRef.current?.click(); }} className={`p-1 md:p-1.5 rounded-md md:rounded-lg text-[9px] font-bold uppercase transition-all ${ssc.fileUrl ? 'bg-white border border-slate-200 text-slate-500' : 'bg-indigo-600 text-white'}`}>
                                            <FileUp size={11} />
                                          </button>
                                          <button onClick={() => handleDeleteSubSub(group.id, sub.id, ssc.id)} className="p-1 md:p-1.5 text-slate-300 hover:text-rose-600 rounded-md md:rounded-lg transition-all"><Trash2 size={12} /></button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedSscIds(prev => { const n = new Set(prev); n.has(ssc.id) ? n.delete(ssc.id) : n.add(ssc.id); return n; }); }}
                                            className={`p-1 md:p-1.5 rounded-md md:rounded-lg transition-all border ${isSscExpanded ? 'bg-teal-600 text-white border-teal-600' : 'bg-white border-slate-200 text-slate-400 hover:text-teal-600 hover:border-teal-300'}`}
                                            title="Expand sub-items & food safety tabs"
                                          >
                                            {isSscExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                          </button>
                                        </div>
                                        {isSscExpanded && (
                                          <div className="mt-2 space-y-2">
                                            {/* Sub3 items */}
                                            {(ssc.subItems && ssc.subItems.length > 0) && (
                                              <div className="ml-3 border-l-2 border-violet-100 pl-3 space-y-1.5">
                                                {ssc.subItems.map(si => (
                                                  <div key={si.id} className="flex items-center gap-2 bg-violet-50/40 border border-violet-100 rounded-lg px-2.5 py-2">
                                                    <div className={`p-1 rounded shrink-0 ${si.fileUrl ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-300'}`}><FileText size={11} /></div>
                                                    <div className="min-w-0 flex-1">
                                                      <p className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-tight truncate">{si.label}</p>
                                                      {si.fileName ? (
                                                        <span className="text-[8px] text-emerald-600 flex items-center gap-0.5"><CheckCircle2 size={8}/> {si.fileName}</span>
                                                      ) : (
                                                        <span className="text-[8px] text-slate-400">No file</span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                      {si.fileUrl && <button onClick={() => window.open(si.fileUrl!, '_blank')} className="p-1 bg-white border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all"><Eye size={10} /></button>}
                                                      <button onClick={() => { setS3UploadTarget({ groupId: group.id, subId: sub.id, sscId: ssc.id, s3Id: si.id }); s3FileInputRef.current?.click(); }} className={`p-1 rounded text-[8px] transition-all ${si.fileUrl ? 'bg-white border border-slate-200 text-slate-500' : 'bg-violet-600 text-white'}`}><FileUp size={10} /></button>
                                                      <button onClick={() => handleDeleteSub3Card(group.id, sub.id, ssc.id, si.id)} className="p-1 text-slate-300 hover:text-rose-600 rounded transition-all"><Trash2 size={10} /></button>
                                                    </div>
                                                  </div>
                                                ))}
                                                <button
                                                  onClick={() => { setActiveS3ParentIds({ groupId: group.id, subId: sub.id, sscId: ssc.id }); setS3Form({ label: '' }); setIsS3ModalOpen(true); }}
                                                  className="text-[8px] font-black uppercase tracking-wider text-violet-500 hover:text-violet-700 flex items-center gap-1 mt-1"
                                                >
                                                  <Plus size={8} /> Add another sub-item
                                                </button>
                                              </div>
                                            )}
                                            {/* Food safety tabs */}
                                            {renderFSTabs(ssc.id, sscFSTab, setSscFSTab, true)}
                                          </div>
                                        )}
                                      </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="ml-3 md:ml-8 border-l-2 border-indigo-100 pl-3 md:pl-5 mt-2 md:mt-3">
                                    <div className="py-4 md:py-6 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-lg md:rounded-xl">
                                      <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">No sub-items yet</p>
                                      <button
                                        onClick={() => { setActiveMainCardId(group.id); setActiveSubCardId(sub.id); setIsSubSubModalOpen(true); }}
                                        className="mt-2 md:mt-3 px-3 md:px-4 py-1.5 md:py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                                      >
                                        + Add first sub-item
                                      </button>
                                    </div>
                                  </div>
                                )}
                                {/* Food safety tabs — sub-card level */}
                                <div className="mt-3 md:mt-4 px-1">
                                  {renderFSTabs(sub.id, subFSTab, setSubFSTab)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 md:py-16 text-center flex flex-col items-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-xl md:rounded-[2.5rem]">
                      <FileDigit size={32} className="text-slate-200 mb-3 md:mb-4 md:hidden" /><FileDigit size={40} className="text-slate-200 mb-4 hidden md:block" />
                      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest md:tracking-[0.3em]">No Specifications Yet</p>
                      <button onClick={() => { setActiveMainCardId(group.id); setIsSubModalOpen(true); }} className="mt-4 md:mt-6 px-5 md:px-8 py-2 md:py-3 bg-indigo-50 text-indigo-600 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100">
                        + Add first sub-card
                      </button>
                    </div>
                  )}
                  {/* Food safety tabs — group card level */}
                  <div className="mt-4 md:mt-6 pt-2">
                    {renderFSTabs(group.id, groupFSTab, setGroupFSTab)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {filteredGroups.length === 0 && (
          <div className="col-span-full py-24 md:py-48 text-center flex flex-col items-center justify-center bg-white rounded-2xl md:rounded-[4rem] border-2 border-dashed border-slate-100">
             <LayoutGrid size={40} className="text-slate-100 mb-4 md:hidden" /><LayoutGrid size={64} className="text-slate-100 mb-6 hidden md:block" />
             <h3 className="text-lg md:text-2xl font-black text-slate-800 uppercase tracking-tight">Empty Registry</h3>
             <p className="text-slate-400 text-xs md:text-sm mt-2 md:mt-3 font-medium uppercase tracking-widest max-w-sm leading-relaxed text-center px-4">
               No specification groups match your search.
             </p>
          </div>
        )}
      </div>}

      {isMainModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl p-5 md:p-8 w-full max-w-md animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200">
             <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
             <div className="flex justify-between items-center mb-5 md:mb-8">
                <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight">New Group</h3>
                <button onClick={() => setIsMainModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
             </div>
             <div className="space-y-4 md:space-y-6">
                <div className="space-y-1.5 md:space-y-2 text-left">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group Title</label>
                    <input autoFocus className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={mainForm.title} onChange={e => setMainForm({...mainForm, title: e.target.value})} placeholder="e.g. CORE PROCEDURES" />
                </div>
                <div className="space-y-1.5 md:space-y-2 text-left">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium outline-none focus:border-indigo-500 transition-all shadow-inner resize-none h-20 md:h-24" value={mainForm.description} onChange={e => setMainForm({...mainForm, description: e.target.value})} placeholder="Enter group purpose..." />
                </div>
                <button disabled={!mainForm.title} onClick={handleAddMainCard} className="w-full py-3 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-indigo-600 disabled:opacity-30 disabled:grayscale active:scale-95 transition-all">Create Group</button>
             </div>
          </div>
        </div>
      )}

      {isSubModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl p-5 md:p-8 w-full max-w-md animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200">
             <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
             <div className="flex justify-between items-start mb-5 md:mb-8 text-left gap-3">
                <div className="min-w-0">
                   <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">New Specification</h3>
                   <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 leading-relaxed break-words">Adding to {groups.find(g => g.id === activeMainCardId)?.title}</p>
                </div>
                <button onClick={() => setIsSubModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 shrink-0"><X size={18}/></button>
             </div>
             <div className="space-y-4 md:space-y-6">
                <div className="space-y-1.5 md:space-y-2 text-left">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Label</label>
                    <input autoFocus className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={subForm.label} onChange={e => setSubForm({...subForm, label: e.target.value})} placeholder="e.g. Hygiene v2.1" onKeyDown={e => { if (e.key === 'Enter' && subForm.label) handleAddSubCard(); }} />
                </div>
                <div className="space-y-1.5 md:space-y-2 text-left">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description <span className="text-slate-300 font-medium">(optional)</span></label>
                    <textarea className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:border-indigo-500 outline-none transition-all shadow-inner resize-none h-20 md:h-24" value={subForm.description} onChange={e => setSubForm({...subForm, description: e.target.value})} placeholder="Describe the scope or purpose of this specification…" />
                </div>
                <div className="p-3 md:p-4 bg-blue-50 border border-blue-100 rounded-xl md:rounded-2xl flex items-start gap-2 md:gap-3 text-left">
                   <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                   <p className="text-[9px] md:text-[10px] text-blue-800 font-bold uppercase leading-relaxed tracking-wide">Link a PDF or use the Spec Creator after creating this card.</p>
                </div>
                <button disabled={!subForm.label} onClick={handleAddSubCard} className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-30 active:scale-95 transition-all">Confirm</button>
             </div>
          </div>
        </div>
      )}

      {isSubSubModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl p-5 md:p-8 w-full max-w-md animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200">
             <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
             <div className="flex justify-between items-center mb-5 md:mb-8 text-left">
                <div>
                   <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">New Sub-Item</h3>
                   <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 truncate max-w-[220px] md:max-w-none">
                     Under {groups.find(g => g.id === activeMainCardId)?.subCards.find(sc => sc.id === activeSubCardId)?.label}
                   </p>
                </div>
                <button onClick={() => setIsSubSubModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
             </div>
             <div className="space-y-4 md:space-y-6">
                <div className="space-y-1.5 md:space-y-2 text-left">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-Item Label</label>
                    <input autoFocus className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={subSubForm.label} onChange={e => setSubSubForm({...subSubForm, label: e.target.value})} placeholder="e.g. Subsection A" />
                </div>
                <button disabled={!subSubForm.label} onClick={handleAddSubSubCard} className="w-full py-3 md:py-4 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-emerald-700 disabled:opacity-30 active:scale-95 transition-all">Create Sub-Item</button>
             </div>
          </div>
        </div>
      )}

      {/* Sub3 (Level 4) item modal */}
      {isS3ModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setIsS3ModalOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-md p-6 md:p-8 z-10" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
            <div className="flex justify-between items-center mb-5 md:mb-8 text-left">
              <div>
                <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">New Sub-Item (Level 4)</h3>
                {activeS3ParentIds && (
                  <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 truncate max-w-[220px] md:max-w-none">
                    Under {(() => {
                      const g = groups.find(g => g.id === activeS3ParentIds.groupId);
                      const sc = g?.subCards.find(sc => sc.id === activeS3ParentIds.subId);
                      const ssc = sc?.subSubCards.find(ssc => ssc.id === activeS3ParentIds.sscId);
                      return ssc?.label || 'sub-item';
                    })()}
                  </p>
                )}
              </div>
              <button onClick={() => setIsS3ModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-1.5 md:space-y-2 text-left">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Label</label>
                <input
                  autoFocus
                  className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-violet-500 outline-none transition-all shadow-inner"
                  value={s3Form.label}
                  onChange={e => setS3Form({ label: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSub3Card(); }}
                  placeholder="e.g. 4.1.1.1 Dried Fruits"
                />
              </div>
              <button
                disabled={!s3Form.label.trim()}
                onClick={handleAddSub3Card}
                className="w-full py-3 md:py-4 bg-violet-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-violet-700 disabled:opacity-30 active:scale-95 transition-all"
              >
                Create Sub-Item
              </button>
            </div>
          </div>
        </div>
      )}

      {totalSelected > 0 && (
        <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-[140] animate-in slide-in-from-bottom-4 duration-300 w-[calc(100%-2rem)] md:w-auto max-w-lg">
          <div className="bg-slate-900 text-white rounded-xl md:rounded-2xl shadow-2xl px-3 md:px-6 py-2.5 md:py-3.5 flex items-center gap-2 md:gap-4 border border-slate-700 flex-wrap justify-center">
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest text-slate-300">
              {totalSelected} sel
              {selectedGroupIds.size > 0 && <span className="ml-1 text-indigo-300">({selectedGroupIds.size}g)</span>}
              {selectedSubIds.size > 0 && <span className="ml-1 text-blue-300">({selectedSubIds.size}s)</span>}
              {selectedSubSubIds.size > 0 && <span className="ml-1 text-violet-300">({selectedSubSubIds.size}ss)</span>}
            </span>
            <div className="w-px h-5 md:h-6 bg-slate-600 hidden md:block" />
            <button onClick={selectAll} className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-700 text-white rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-wider hover:bg-slate-600 transition-all">All</button>
            <button onClick={deselectAll} className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-700 text-white rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-wider hover:bg-slate-600 transition-all">Clear</button>
            <button onClick={handleBulkDelete} className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-600 text-white rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-1.5 md:gap-2 shadow-lg">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}

      {bulkReviewOpen && (
        <div className="fixed inset-0 z-[160] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200 overflow-hidden">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 md:hidden" />
            <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 md:gap-3">
                  <FileSpreadsheet size={20} className="text-amber-500" /> Bulk Import
                </h3>
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider md:tracking-widest">
                  {bulkReviewRows.filter(r => r.status === 'new').length} new &bull; {bulkReviewRows.filter(r => r.status !== 'new').length} dup &bull; {bulkReviewRows.length} total
                </p>
              </div>
              <button onClick={() => { setBulkReviewOpen(false); setBulkReviewRows([]); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex gap-3 flex-wrap">
                <button onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: r.status === 'new' })))} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-100 transition-all">Select New Only</button>
                <button onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: true })))} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition-all">Select All</button>
                <button onClick={() => setBulkReviewRows(prev => prev.map(r => ({ ...r, selected: false })))} className="px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100 transition-all">Deselect All</button>
              </div>

              <div className="space-y-2">
                {bulkReviewRows.map((row, idx) => {
                  const isNew = row.status === 'new';
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                        row.selected
                          ? isNew ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
                          : 'bg-slate-50/30 border-slate-100 opacity-60'
                      }`}
                      onClick={() => setBulkReviewRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r))}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${row.selected ? isNew ? 'bg-emerald-500 border-emerald-500' : 'bg-amber-500 border-amber-500' : 'border-slate-300 bg-white'}`}>
                        {row.selected && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        {row.groupName && (
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px]">{row.groupName}</span>
                        )}
                        {row.subCardName && (
                          <>
                            <span className="text-slate-300 text-xs">&rsaquo;</span>
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px]">{row.subCardName}</span>
                          </>
                        )}
                        {row.subSubCardName && (
                          <>
                            <span className="text-slate-300 text-xs">&rsaquo;</span>
                            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px]">{row.subSubCardName}</span>
                          </>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isNew ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 uppercase tracking-wider">
                            <CheckCircle2 size={12} /> New
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase tracking-wider" title={row.duplicateOf}>
                            <AlertTriangle size={12} /> {row.status === 'intra-duplicate' ? 'Batch Dup' : 'Exists'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {bulkReviewRows.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm font-medium">No rows found in the uploaded file.</div>
              )}
            </div>

            <div className="p-3 md:p-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between shrink-0 gap-2">
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider md:tracking-widest">
                {bulkReviewRows.filter(r => r.selected).length}/{bulkReviewRows.length} selected
              </p>
              <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                <button onClick={() => { setBulkReviewOpen(false); setBulkReviewRows([]); }} className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                <button
                  onClick={handleBulkConfirm}
                  disabled={bulkReviewRows.filter(r => r.selected).length === 0}
                  className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 bg-emerald-600 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-wider md:tracking-widest shadow-lg hover:bg-emerald-700 disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-1.5 md:gap-2"
                >
                  <Upload size={13} /> Import ({bulkReviewRows.filter(r => r.selected).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SpecCreatorModal
        isOpen={specCreatorOpen}
        onClose={() => { setSpecCreatorOpen(false); setSpecCreatorTarget(null); }}
        onSave={(data) => {
          console.log('Spec saved:', data, 'Target:', specCreatorTarget);
        }}
        defaultMainCategory={specCreatorTarget ? groups.find(g => g.id === specCreatorTarget.groupId)?.title : undefined}
        defaultSubCategory={specCreatorTarget ? groups.find(g => g.id === specCreatorTarget.groupId)?.subCards.find(sc => sc.id === specCreatorTarget.subId)?.label : undefined}
        defaultSpecificSubCategory={specCreatorTarget?.subSubId ? groups.find(g => g.id === specCreatorTarget.groupId)?.subCards.find(sc => sc.id === specCreatorTarget.subId)?.subSubCards.find(ssc => ssc.id === specCreatorTarget.subSubId)?.label : undefined}
      />

      {/* ── Edit INS Entry Modal ── */}
      {editInsId && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Pencil size={16} /></div>
                <h3 className="text-sm font-bold text-slate-800">Edit INS Entry</h3>
              </div>
              <button onClick={() => setEditInsId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">INS Number / Name</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                  value={editInsForm.name}
                  onChange={e => setEditInsForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && editInsForm.name.trim()) handleSaveInsEdit(); if (e.key === 'Escape') setEditInsId(null); }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none h-20"
                  placeholder="Describe the function, usage, or regulatory notes..."
                  value={editInsForm.description}
                  onChange={e => setEditInsForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setEditInsId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors">Cancel</button>
              <button onClick={handleSaveInsEdit} disabled={!editInsForm.name.trim()} className="px-5 py-2 bg-amber-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Technical Function Modal ── */}
      {editTechFuncId && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-50 rounded-lg text-violet-600"><Pencil size={16} /></div>
                <h3 className="text-sm font-bold text-slate-800">Edit Technical Function</h3>
              </div>
              <button onClick={() => setEditTechFuncId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Technical Function Name</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                  value={editTechFuncForm.name}
                  onChange={e => setEditTechFuncForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && editTechFuncForm.name.trim()) handleSaveTechFuncEdit(); if (e.key === 'Escape') setEditTechFuncId(null); }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description <span className="text-slate-300 font-normal">(optional)</span></label>
                <textarea
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all resize-none h-20"
                  placeholder="Describe what this technical function covers..."
                  value={editTechFuncForm.description}
                  onChange={e => setEditTechFuncForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button onClick={() => setEditTechFuncId(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 font-semibold transition-colors">Cancel</button>
              <button onClick={handleSaveTechFuncEdit} disabled={!editTechFuncForm.name.trim()} className="px-5 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Specification Group Modal ── */}
      {editGroupId && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl p-5 md:p-8 w-full max-w-md animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
            <div className="flex justify-between items-center mb-5 md:mb-8 text-left">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><Pencil size={15} /></div>
                <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Edit Group</h3>
              </div>
              <button onClick={() => setEditGroupId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 shrink-0"><X size={18}/></button>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-1.5 md:space-y-2 text-left">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group Name</label>
                <input autoFocus className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={editGroupForm.title} onChange={e => setEditGroupForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === 'Escape') setEditGroupId(null); }} />
              </div>
              <div className="space-y-1.5 md:space-y-2 text-left">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description <span className="text-slate-300 font-medium">(optional)</span></label>
                <textarea className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:border-indigo-500 outline-none transition-all shadow-inner resize-none h-20 md:h-24" value={editGroupForm.description} onChange={e => setEditGroupForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the scope or purpose of this group…" />
              </div>
              <button disabled={!editGroupForm.title.trim()} onClick={handleSaveGroupEdit} className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-30 active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Sub-card Modal ── */}
      {editSubId && (
        <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-2xl md:rounded-[2.5rem] shadow-2xl p-5 md:p-8 w-full max-w-md animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-slate-200">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 md:hidden" />
            <div className="flex justify-between items-center mb-5 md:mb-8 text-left">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600"><Pencil size={15} /></div>
                <h3 className="text-base md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Edit Specification</h3>
              </div>
              <button onClick={() => setEditSubId(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 shrink-0"><X size={18}/></button>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-1.5 md:space-y-2 text-left">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Document Label</label>
                <input autoFocus className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={editSubForm.label} onChange={e => setEditSubForm(f => ({ ...f, label: e.target.value }))} onKeyDown={e => { if (e.key === 'Escape') setEditSubId(null); }} />
              </div>
              <div className="space-y-1.5 md:space-y-2 text-left">
                <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description <span className="text-slate-300 font-medium">(optional)</span></label>
                <textarea className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:border-indigo-500 outline-none transition-all shadow-inner resize-none h-20 md:h-24" value={editSubForm.description} onChange={e => setEditSubForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the scope or purpose of this specification…" />
              </div>
              <button disabled={!editSubForm.label.trim()} onClick={handleSaveSubEdit} className="w-full py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-30 active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSpecifications;
