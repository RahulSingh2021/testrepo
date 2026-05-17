
"use client";

import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronRight, 
  ChevronDown, 
  FolderPlus, 
  FilePlus, 
  Layout, 
  Layers, 
  X, 
  Save, 
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  BookOpen,
  PlusCircle,
  PenTool,
  History,
  LayoutTemplate,
  Check,
  ShieldCheck,
  Clock,
  Eye,
  Printer,
  FileSearch,
  Maximize2,
  FileDown,
  Scaling,
  Binary,
  FileUp,
  Download,
  Loader2,
  Type as TypeIcon,
  Table as TableIcon,
  Grid3X3,
  Image as ImageIcon,
  QrCode,
  Tag,
  Settings,
  AppWindow,
  AlignLeft,
  Columns,
  StickyNote,
  UserCheck,
  Globe,
  Archive,
  ArrowRight,
  // Added missing imports
  LayoutGrid,
  Bold,
  Italic,
  List
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as docx from 'docx';
import * as mammoth from 'mammoth';
import { SopContent, SopSection } from '../types';
import RichTextEditor from './RichTextEditor';
import Logo from './Logo';
import { savePdfForPWA } from '@/utils/pdfDownload';

interface SubCard {
    id: string;
    name: string;
    description: string;
    content?: SopContent;
}

interface Card {
    id: string;
    name: string;
    subCards: SubCard[];
}

type RibbonTab = 'home' | 'insert' | 'layout' | 'review';

const DEFAULT_DOC_CONTENT: SopContent = {
  version: "1.0",
  lastReviewDate: new Date().toISOString().split('T')[0],
  sections: [
    { id: '1', title: '1. Executive Summary', content: "<p>This document establishes the <b>Standard Operating Procedure</b> for specialized operations.</p>" }
  ]
};

const SMART_TAGS = [
    { label: "Unit Name", tag: "{UNIT_NAME}", color: "bg-blue-100 text-blue-700" },
    { label: "Current Date", tag: "{DATE}", color: "bg-emerald-100 text-emerald-700" },
    { label: "Auditor ID", tag: "{AUDITOR_ID}", color: "bg-purple-100 text-purple-700" },
    { label: "Batch Ref", tag: "{BATCH_REF}", color: "bg-amber-100 text-amber-700" },
    { label: "Site Location", tag: "{LOCATION}", color: "bg-rose-100 text-rose-700" }
];

const DocumentCreator: React.FC = () => {
    const [cards, setCards] = useState<Card[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    
    // UI State
    const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
    const [isAddSubCardModalOpen, setIsAddSubCardModalOpen] = useState(false);
    const [isDocWorkspaceOpen, setIsDocWorkspaceOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
    
    // Active Selection
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [activeSubCardId, setActiveSubCardId] = useState<string | null>(null);
    const [workspaceView, setWorkspaceView] = useState<'edit' | 'preview'>('edit');
    
    // Forms
    const [newCardName, setNewCardName] = useState("");
    const [newSubCard, setNewSubCard] = useState({ name: '', description: '' });
    
    // Content Workspace
    const [workingContent, setWorkingContent] = useState<SopContent>(DEFAULT_DOC_CONTENT);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [pagePadding, setPagePadding] = useState<'narrow' | 'normal' | 'wide'>('normal');
    
    const editorCanvasRef = useRef<HTMLDivElement>(null);
    const wordInputRef = useRef<HTMLInputElement>(null);

    const activeSubCard = useMemo(() => {
        const card = cards.find(c => c.id === activeCardId);
        return card?.subCards.find(s => s.id === activeSubCardId);
    }, [cards, activeCardId, activeSubCardId]);

    const qrData = useMemo(() => {
        return JSON.stringify({
            id: activeSubCard?.id,
            name: activeSubCard?.name,
            version: workingContent.version,
            date: workingContent.lastReviewDate
        });
    }, [activeSubCard, workingContent]);

    // --- Core Logic ---

    const handleAddCard = () => {
        if (!newCardName.trim()) return;
        const newCard: Card = {
            id: `card-${Date.now()}`,
            name: newCardName.toUpperCase(),
            subCards: []
        };
        setCards([newCard, ...cards]);
        setNewCardName("");
        setIsAddCardModalOpen(false);
    };

    const handleAddSubCard = () => {
        if (!newSubCard.name.trim() || !activeCardId) return;
        setCards(prev => prev.map(card => {
            if (card.id !== activeCardId) return card;
            return {
                ...card,
                subCards: [...card.subCards, {
                    id: `sub-${Date.now()}`,
                    name: newSubCard.name,
                    description: newSubCard.description
                }]
            };
        }));
        setNewSubCard({ name: '', description: '' });
        setIsAddSubCardModalOpen(false);
    };

    // Added missing removeSubCard function
    const removeSubCard = (cardId: string, subId: string) => {
        if (!confirm("Permanently remove this sub-card component?")) return;
        setCards(prev => prev.map(c => {
            if (c.id !== cardId) return c;
            return { ...c, subCards: c.subCards.filter(s => s.id !== subId) };
        }));
    };

    const handleOpenWorkspace = (cardId: string, subCard: SubCard) => {
        setActiveCardId(cardId);
        setActiveSubCardId(subCard.id);
        const initialContent = subCard.content || {
            ...DEFAULT_DOC_CONTENT,
            lastReviewDate: new Date().toISOString().split('T')[0]
        };
        setWorkingContent(initialContent);
        setActiveSectionId(initialContent.sections[0]?.id || null);
        setWorkspaceView('edit');
        setActiveRibbonTab('home');
        setIsDocWorkspaceOpen(true);
    };

    const handleSaveWorkspace = () => {
        if (!activeCardId || !activeSubCardId) return;
        setCards(prev => prev.map(card => {
            if (card.id !== activeCardId) return card;
            return {
                ...card,
                subCards: card.subCards.map(sub => {
                    if (sub.id !== activeSubCardId) return sub;
                    return { ...sub, content: workingContent };
                })
            };
        }));
        setIsDocWorkspaceOpen(false);
    };

    // Added missing handleAddSection function
    const handleAddSection = () => {
        const newId = `sec-${Date.now()}`;
        const nextNum = workingContent.sections.length + 1;
        setWorkingContent({
            ...workingContent,
            sections: [
                ...workingContent.sections,
                { id: newId, title: `${nextNum}. New Section`, content: '' }
            ]
        });
        setActiveSectionId(newId);
    };

    // Added missing handleRemoveSection function
    const handleRemoveSection = (id: string) => {
        if (!confirm("Delete this document section?")) return;
        setWorkingContent({
            ...workingContent,
            sections: workingContent.sections.filter(s => s.id !== id)
        });
        if (activeSectionId === id) setActiveSectionId(null);
    };

    const handleUpdateSection = (id: string, field: keyof SopSection, value: string) => {
        setWorkingContent({
            ...workingContent,
            sections: workingContent.sections.map(s => s.id === id ? { ...s, [field]: value } : s)
        });
    };

    // Added missing handleUpdateSectionContent function
    const handleUpdateSectionContent = (html: string) => {
        if (activeSectionId) {
            handleUpdateSection(activeSectionId, 'content', html);
        }
    };

    const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeSectionId) return;
        setIsProcessing(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            try {
                const result = await (mammoth as any).convertToHtml({ arrayBuffer });
                handleUpdateSection(activeSectionId, 'content', result.value);
                alert("Word document parsed into current section.");
            } catch (err) {
                alert("Word parse error.");
            } finally {
                setIsProcessing(false);
                if (wordInputRef.current) wordInputRef.current.value = "";
            }
        };
        reader.readAsDataURL(file);
    };

    const handleExportPDF = async () => {
        if (!editorCanvasRef.current) return;
        setIsProcessing(true);
        try {
            const canvas = await html2canvas(editorCanvasRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: "#f1f3f4"
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }
            savePdfForPWA(pdf, `${activeSubCard?.name || 'Document'}.pdf`);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExportWord = async () => {
        setIsProcessing(true);
        try {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, SectionType } = docx;
            const docChildren: any[] = [
                new Paragraph({ text: "HACCP PRO MASTER ARTIFACT", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
                new Paragraph({ children: [new TextRun({ text: "Title: ", bold: true }), new TextRun({ text: activeSubCard?.name || 'Untitled' })], spacing: { after: 200 } })
            ];
            workingContent.sections.forEach(s => {
                if (s.content.trim() === "") return;
                docChildren.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }));
                const cleanText = s.content.replace(/<[^>]*>?/gm, ' ');
                docChildren.push(new Paragraph({ text: cleanText || "...", spacing: { after: 200 } }));
            });
            const doc = new Document({ sections: [{ properties: { type: SectionType.CONTINUOUS }, children: docChildren }] });
            const blob = await Packer.toBlob(doc);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeSubCard?.name || 'Document'}.docx`;
            a.click();
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const insertSmartTag = (tag: string) => {
        if (!activeSectionId) return;
        const currentContent = workingContent.sections.find(s => s.id === activeSectionId)?.content || "";
        const nextContent = currentContent + ` <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-bold text-xs">${tag}</span> `;
        handleUpdateSection(activeSectionId, 'content', nextContent);
    };

    const filteredCards = cards.filter(card => 
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.subCards.some(sub => sub.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1400px] mx-auto pb-20">
            {/* Standard Dashboard Header */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden text-left">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner border border-indigo-100">
                        <FolderPlus size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Document Creator</h2>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">Enterprise Standard Artifact Repository</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group flex-1 md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input type="text" placeholder="Filter registry..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase focus:outline-none focus:border-indigo-400 transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => setIsAddCardModalOpen(true)} className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"><Plus size={18} strokeWidth={3} /> Add Card</button>
                </div>
            </div>

            {/* Registry Grid */}
            <div className="grid grid-cols-1 gap-8">
                {filteredCards.map(card => (
                    <div key={card.id} className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col transition-all hover:border-indigo-300">
                        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Layers size={28} /></div>
                                <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{card.name}</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.subCards.length} Sub-cards Managed</p></div>
                            </div>
                            <button onClick={() => { setActiveCardId(card.id); setIsAddSubCardModalOpen(true); }} className="px-5 py-2.5 bg-white border-2 border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><Plus size={16} strokeWidth={3} /> Add Sub-card</button>
                        </div>
                        <div className="p-8 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {card.subCards.map(sub => (
                                <div key={sub.id} className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 relative group hover:border-indigo-300 hover:shadow-xl transition-all text-left flex flex-col justify-between min-h-[220px]">
                                    <div><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className={`p-2.5 rounded-xl transition-colors ${sub.content ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}><FileText size={20} /></div><div className="min-w-0"><h4 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate pr-4">{sub.name}</h4>{sub.content && <span className="flex items-center gap-1 text-[8px] font-black text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 mt-1 w-fit"><Check size={8} strokeWidth={4} /> Record Active</span>}</div></div><button onClick={() => removeSubCard(card.id, sub.id)} className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><X size={16}/></button></div><p className="text-xs text-slate-500 leading-relaxed italic line-clamp-3 mb-6">"{sub.description || 'No descriptive context provided.'}"</p></div>
                                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between"><div className="flex flex-col"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Digital ID</span><span className="text-[10px] font-mono font-bold text-slate-400 uppercase">#{sub.id.split('-').pop()?.substring(0,6)}</span></div><button onClick={() => handleOpenWorkspace(card.id, sub)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 ${sub.content ? 'bg-slate-900 text-white shadow-lg' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>{sub.content ? <Edit3 size={14} /> : <PenTool size={14} />}{sub.content ? 'Edit Doc' : 'Compose'}</button></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* --- THE OFFICE-STYLE DOCUMENT WORKSPACE --- */}
            {isDocWorkspaceOpen && activeSubCardId && (
                <div className="fixed inset-0 z-[300] bg-[#f1f3f4] flex flex-col animate-in fade-in duration-300 overflow-hidden">
                    
                    {/* 1. App Level Ribbon Header */}
                    <div className="bg-white border-b border-slate-200 shadow-sm relative z-40 shrink-0">
                        {/* Ribbon Top Strip */}
                        <div className="px-6 py-3 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-5">
                                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg"><Logo className="w-8 h-8" /></div>
                                <div className="min-w-0">
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5 truncate max-w-[250px]">{activeSubCard?.name}</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">HACCP PRO Writer • {workingContent.version} Node</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button onClick={handleSaveWorkspace} className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"><Save size={14}/> Publish & Close</button>
                                <button onClick={() => setIsDocWorkspaceOpen(false)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"><X size={24} strokeWidth={2.5}/></button>
                            </div>
                        </div>

                        {/* Ribbon Tabs */}
                        <div className="flex px-10 border-b border-slate-100 gap-1 bg-slate-50/50">
                            {[
                                { id: 'home', label: 'Home', icon: AppWindow },
                                { id: 'insert', label: 'Insert', icon: PlusCircle },
                                { id: 'layout', label: 'Layout', icon: LayoutGrid },
                                { id: 'review', label: 'Review', icon: ShieldCheck },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveRibbonTab(tab.id as RibbonTab)}
                                    className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeRibbonTab === tab.id ? 'bg-white border-indigo-600 text-indigo-600 shadow-[0_-4px_0_white]' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Ribbon Content Body */}
                        <div className="px-10 py-3 bg-white flex items-center gap-8 h-20 animate-in slide-in-from-top-1 duration-200">
                            {activeRibbonTab === 'home' && (
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2 border-r border-slate-100 pr-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-slate-300 uppercase">Text Style</span>
                                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 outline-none"><option>Normal Text</option><option>Heading 1</option><option>Heading 2</option><option>Title</option></select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 border-r border-slate-100 pr-6">
                                        <button className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><Bold size={16}/></button>
                                        <button className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><Italic size={16}/></button>
                                        <button className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><AlignLeft size={16}/></button>
                                        <button className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"><List size={16}/></button>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[8px] font-black text-slate-300 uppercase">Registry Sync</span>
                                        <button onClick={() => setWorkspaceView(workspaceView === 'edit' ? 'preview' : 'edit')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 transition-all text-[9px] font-black uppercase tracking-widest ${workspaceView === 'preview' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-400'}`}>{workspaceView === 'preview' ? <Eye size={12}/> : <Edit3 size={12}/>} {workspaceView === 'preview' ? 'Exit View' : 'Final Preview'}</button>
                                    </div>
                                </div>
                            )}

                            {activeRibbonTab === 'insert' && (
                                <div className="flex items-center gap-6">
                                    <div className="flex flex-col gap-2 items-center border-r border-slate-100 pr-6">
                                        <span className="text-[8px] font-black text-slate-300 uppercase">Assets</span>
                                        <div className="flex gap-2">
                                            <button className="flex flex-col items-center gap-1 group/btn"><div className="p-2 bg-slate-50 rounded-lg group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600 transition-colors"><TableIcon size={16}/></div><span className="text-[7px] font-black uppercase text-slate-400">Table</span></button>
                                            <button className="flex flex-col items-center gap-1 group/btn"><div className="p-2 bg-slate-50 rounded-lg group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600 transition-colors"><ImageIcon size={16}/></div><span className="text-[7px] font-black uppercase text-slate-400">Registry Img</span></button>
                                            <button className="flex flex-col items-center gap-1 group/btn"><div className="p-2 bg-slate-50 rounded-lg group-hover/btn:bg-indigo-50 group-hover/btn:text-indigo-600 transition-colors"><QrCode size={16}/></div><span className="text-[7px] font-black uppercase text-slate-400">QR ID</span></button>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1.5 min-w-[300px]">
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Smart Field Tags (Audit Autopopulate)</span>
                                        <div className="flex gap-2">
                                            {SMART_TAGS.map(t => (
                                                <button key={t.tag} onClick={() => insertSmartTag(t.tag)} className={`px-2 py-1 ${t.color} rounded border border-current/10 text-[8px] font-black uppercase hover:scale-105 transition-transform active:scale-95 shadow-sm`}>{t.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeRibbonTab === 'layout' && (
                                <div className="flex items-center gap-10">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[8px] font-black text-slate-300 uppercase mb-1">Canvas Padding</span>
                                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                                            {(['narrow', 'normal', 'wide'] as const).map(p => (
                                                <button key={p} onClick={() => setPagePadding(p)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${pagePadding === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{p}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[8px] font-black text-slate-300 uppercase mb-1">Architecture</span>
                                        <div className="flex gap-4">
                                            <button className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase"><Scaling size={16} className="text-indigo-500" /> A4 ISO Standard</button>
                                            <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase opacity-40 grayscale cursor-not-allowed"><Columns size={16} /> Multi-Column</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeRibbonTab === 'review' && (
                                <div className="flex items-center gap-8">
                                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-4">
                                        <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Author</p><p className="text-[10px] font-black text-slate-700 uppercase">Current Admin</p></div>
                                        <div className="w-px h-6 bg-slate-200" />
                                        <div><p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Last Sync</p><p className="text-[10px] font-black text-slate-700 uppercase">Just Now</p></div>
                                    </div>
                                    <button className="flex items-center gap-2 px-6 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase border border-emerald-200 shadow-sm"><UserCheck size={14}/> Request e-Auth</button>
                                    <button className="flex items-center gap-2 px-6 py-2 bg-white text-slate-400 rounded-xl text-[10px] font-black uppercase border border-slate-100"><History size={14}/> View History</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        
                        {/* 2. Navigation Pane (Document Map) */}
                        <div className="w-80 bg-white border-r border-slate-300 flex flex-col p-6 gap-3 overflow-y-auto custom-scrollbar shadow-inner shrink-0 text-left">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Navigation Pane</h4>
                                <div className="flex gap-1">
                                    <button onClick={() => wordInputRef.current?.click()} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Import Docx"><FileUp size={14} /></button>
                                    <button onClick={handleAddSection} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Add Section"><Plus size={14} strokeWidth={4} /></button>
                                </div>
                                <input type="file" ref={wordInputRef} className="hidden" accept=".docx" onChange={handleImportWord} />
                            </div>
                            <div className="space-y-1.5">
                                {workingContent.sections.map((section, idx) => (
                                    <button 
                                        key={section.id}
                                        onClick={() => setActiveSectionId(section.id)}
                                        className={`
                                            w-full text-left p-4 rounded-2xl transition-all border-2 flex items-center justify-between group
                                            ${activeSectionId === section.id 
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 ring-4 ring-indigo-50/50' 
                                                : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-slate-200'}
                                        `}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`text-[10px] font-black ${activeSectionId === section.id ? 'text-indigo-200' : 'text-slate-300'}`}>{(idx+1).toString().padStart(2, '0')}</span>
                                            <span className="text-[11px] font-black uppercase truncate pr-4 leading-snug">{section.title}</span>
                                        </div>
                                        {section.content.trim() !== '' && (
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeSectionId === section.id ? 'bg-white shadow-[0_0_8px_white]' : 'bg-emerald-500'}`} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Main A4 Workspace Canvas */}
                        <div className="flex-1 bg-slate-200 overflow-y-auto custom-scrollbar flex flex-col items-center py-12 px-6 relative">
                            
                            {/* Rulers (Visual Only Guide) */}
                            <div className="absolute top-0 left-0 right-0 h-6 bg-white border-b border-slate-200 z-10 hidden lg:flex items-center px-[30mm] overflow-hidden pointer-events-none opacity-50">
                                <div className="w-full h-full relative flex items-end">
                                    {Array.from({length: 44}).map((_, i) => (
                                        <div key={i} className="flex-1 border-l border-slate-200 h-2 flex flex-col justify-end">{i % 5 === 0 && <span className="text-[7px] text-slate-400 ml-1 leading-none">{i/2}</span>}</div>
                                    ))}
                                </div>
                            </div>

                            <div className="w-full max-w-[210mm] flex flex-col gap-4">
                                {workspaceView === 'edit' ? (
                                    activeSectionId ? (
                                        <div className="animate-in fade-in zoom-in-98 duration-500 flex flex-col items-center">
                                            <div className="w-full bg-slate-900 text-white flex justify-between items-center p-6 rounded-t-[2.5rem] shadow-2xl z-10 border-b border-white/5">
                                                <div className="flex items-center gap-5 flex-1">
                                                    <div className="p-3 bg-white/10 rounded-2xl text-indigo-400"><Edit3 size={20}/></div>
                                                    <input 
                                                        className="flex-1 bg-white/5 border border-white/10 focus:border-indigo-500/50 rounded-xl px-5 py-3 text-sm font-black uppercase tracking-tight text-white outline-none transition-all placeholder:text-white/20"
                                                        value={workingContent.sections.find(s => s.id === activeSectionId)?.title || ""}
                                                        onChange={e => handleUpdateSection(activeSectionId, 'title', e.target.value)}
                                                        placeholder="SECTION TITLE..."
                                                    />
                                                </div>
                                                <button onClick={() => handleRemoveSection(activeSectionId)} className="p-3 bg-white/5 text-white/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-white/5 ml-4"><Trash2 size={20}/></button>
                                            </div>
                                            
                                            {/* WRITER CANVAS */}
                                            <div className="w-full relative">
                                                <RichTextEditor 
                                                    isPageMode={true}
                                                    value={workingContent.sections.find(s => s.id === activeSectionId)?.content || ""}
                                                    onChange={handleUpdateSectionContent}
                                                    placeholder={`Begin technical writing for: ${workingContent.sections.find(s => s.id === activeSectionId)?.title}`}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-24 bg-white/40 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-slate-300 mt-20 opacity-50 grayscale">
                                            <FileText size={120} className="text-slate-400 mb-6" />
                                            <h3 className="text-2xl font-black uppercase tracking-[0.4em]">Navigation Node Unset</h3>
                                            <p className="text-sm font-bold uppercase tracking-widest text-slate-500 mt-2">Select a section from the Document Tree to initiate editing.</p>
                                        </div>
                                    )
                                ) : (
                                    /* PREVIEW MODE (A4 SIMULATED PDF) */
                                    <div ref={editorCanvasRef} className="flex flex-col gap-8 pb-32 items-center">
                                        <div className={`bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col min-h-[297mm] relative overflow-hidden text-left ${pagePadding === 'narrow' ? 'p-[10mm]' : pagePadding === 'wide' ? 'p-[35mm]' : 'p-[25mm]'}`}>
                                            
                                            {/* Official ISO Style Header */}
                                            <div className="border-b-4 border-slate-900 pb-8 mb-12 flex justify-between items-end relative z-10">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center shadow-2xl"><Logo className="w-14 h-14" /></div>
                                                    <div className="min-w-0">
                                                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">HACCP PRO ENTERPRISE</h1>
                                                        <p className="text-xs font-black text-indigo-600 uppercase tracking-widest leading-none">Global Standard Operating Controls</p>
                                                        <div className="flex items-center gap-3 mt-4">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Registry ID:</span>
                                                            <span className="text-[10px] font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">ART-{(activeSubCard?.id || '000').slice(-6).toUpperCase()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-1">Standardized Artifact</h2>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Issue Date: {workingContent.lastReviewDate}</p>
                                                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white rounded text-[10px] font-black uppercase tracking-widest">Ver v{workingContent.version}</div>
                                                </div>
                                            </div>

                                            {/* Document Body */}
                                            <div className="flex-1 relative z-10">
                                                <div className="mb-10 text-center">
                                                    <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tight border-y-2 border-slate-50 py-10 mb-12">{activeSubCard?.name}</h3>
                                                </div>
                                                <div className="space-y-14">
                                                    {workingContent.sections.map((section) => (
                                                        <div key={section.id} className="animate-in fade-in duration-700">
                                                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight border-b-2 border-slate-100 pb-3 mb-6 flex items-center gap-4">
                                                                <div className="w-1.5 h-7 bg-indigo-600 rounded-full" />
                                                                {section.title}
                                                            </h4>
                                                            <div className="prose prose-slate max-w-none text-base text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: section.content || '<p class="text-slate-300 italic uppercase font-black text-[11px] tracking-widest">Awaiting technical data entry.</p>' }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* ISO Sign-off Section */}
                                            <div className="mt-24 pt-8 border-t-2 border-slate-200 flex flex-col md:flex-row justify-between items-end gap-10 relative z-10">
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300"><PenTool size={28} /></div>
                                                        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-3">Electronic Authorization Node</p><div className="w-64 h-0.5 bg-slate-900 mb-2" /><p className="text-xs font-black text-slate-800 uppercase tracking-wide">Registry Verified: Current Admin</p></div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Verification Artifact</p>
                                                    <div className="flex items-center gap-8">
                                                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner"><QRCodeSVG value={qrData} size={80} level="M" /></div>
                                                        <div className="flex flex-col items-end"><span className="text-[12px] font-black text-slate-900 uppercase">ISO Artifact Ledger Node P.01</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1.5 italic">ENCRYPTED-IMMUTABLE-RECORD</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Modals */}
            {isAddCardModalOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 border border-slate-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Add Master Card</h3>
                            <button onClick={() => setIsAddCardModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Card Title</label>
                                <input autoFocus className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="E.G. OPERATIONS, SAFETY..." />
                            </div>
                            <button onClick={handleAddCard} disabled={!newCardName.trim()} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 disabled:opacity-30 active:scale-95 transition-all">Confirm Master Card</button>
                        </div>
                    </div>
                </div>
            )}

            {isAddSubCardModalOpen && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 border border-slate-200">
                        <div className="flex justify-between items-center mb-8"><h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">New Sub-card</h3><button onClick={() => setIsAddSubCardModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button></div>
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-card Label</label><input autoFocus className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black uppercase focus:border-indigo-500 outline-none transition-all shadow-inner" value={newSubCard.name} onChange={e => setNewSubCard({...newSubCard, name: e.target.value.toUpperCase()})} placeholder="E.G. PROCEDURE V1..." /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes</label><textarea className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-400 outline-none transition-all shadow-inner h-24 resize-none" value={newSubCard.description} onChange={e => setNewSubCard({...newSubCard, description: e.target.value})} placeholder="Purpose of this document..." /></div>
                            <button onClick={handleAddSubCard} disabled={!newSubCard.name.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 disabled:opacity-30 active:scale-95 transition-all">Confirm Component</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentCreator;
