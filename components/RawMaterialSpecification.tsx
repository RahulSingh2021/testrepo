"use client";

import React, { useState, useMemo, useRef } from 'react';
import { 
    FileText, 
    Plus, 
    Link, 
    Search, 
    X, 
    Save, 
    ChevronRight, 
    Info, 
    Boxes,
    RefreshCw,
    Edit2,
    Trash2,
    Download,
    BookOpen,
    ChevronDown,
    Check,
    Loader2,
    FileDown,
    FileUp,
    Layout,
    Globe,
    ShieldCheck,
    Printer,
    FileSignature,
    Settings,
    MoreVertical
} from 'lucide-react';
import { RawMaterialSpecification as RawSpec, StockItem, SpecSection } from '../types';
import RichTextEditor from './RichTextEditor';
import * as mammoth from 'mammoth';
import * as docx from 'docx';

interface RawMaterialSpecificationProps {
    currentScope?: string;
    rawMaterials?: StockItem[];
}

const PREDEFINED_SECTIONS = [
    "a) Biological, chemical and physical characteristics",
    "b) Composition of formulated ingredients, including additives and processing aids",
    "c) Source (e.g. animal, mineral or vegetable)",
    "d) Place of origin (provenance)",
    "e) Method of production",
    "f) Method of packaging and delivery",
    "g) Storage conditions and shelf life",
    "h) Preparation and/or handling before use or processing",
    "i) Acceptance criteria related to food safety or specifications of purchased materials and ingredients appropriate to their intended use"
];

const RawMaterialSpecification: React.FC<RawMaterialSpecificationProps> = ({ rawMaterials = [] }) => {
    const [specifications, setSpecifications] = useState<RawSpec[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [selectedSpec, setSelectedSpec] = useState<RawSpec | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [matSearchTerm, setMatSearchTerm] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Editor Workspace State
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [docName, setDocName] = useState("");
    const [technicalFunctionName, setTechnicalFunctionName] = useState("");
    const [sections, setSections] = useState<SpecSection[]>([]);
    const [editingSopId, setEditingSopId] = useState<string | null>(null);
    const wordInputRef = useRef<HTMLInputElement>(null);

    const filteredSpecs = useMemo(() => {
        return specifications.filter(s => 
            s.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.linkedRawMaterialName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [specifications, searchTerm]);

    const filteredMaterials = useMemo(() => {
        return rawMaterials.filter(m => 
            m.name.toLowerCase().includes(matSearchTerm.toLowerCase()) ||
            m.sku.toLowerCase().includes(matSearchTerm.toLowerCase())
        );
    }, [rawMaterials, matSearchTerm]);

    // --- Action Handlers ---

    const handleCreateNew = () => {
        setEditingSopId(null);
        setDocName("");
        setTechnicalFunctionName("");
        const initialSections = PREDEFINED_SECTIONS.map((title, i) => ({
            id: `sec-${Date.now()}-${i}`,
            title,
            content: ''
        }));
        setSections(initialSections);
        setActiveSectionId(initialSections[0].id);
        setIsEditorOpen(true);
    };

    const handleEditSpec = (spec: RawSpec) => {
        setEditingSopId(spec.id);
        setDocName(spec.genericName);
        setTechnicalFunctionName(spec.technicalFunctionName || "");
        setSections(spec.sections);
        setActiveSectionId(spec.sections[0]?.id || null);
        setIsEditorOpen(true);
    };

    const handleUpdateSectionContent = (html: string) => {
        if (!activeSectionId) return;
        setSections(prev => prev.map(s => s.id === activeSectionId ? { ...s, content: html } : s));
    };

    const handleAddCustomSection = () => {
        const newId = `sec-custom-${Date.now()}`;
        const newSec = { id: newId, title: "New Requirement Section", content: "" };
        setSections(prev => [...prev, newSec]);
        setActiveSectionId(newId);
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
                handleUpdateSectionContent(result.value);
            } catch (err) {
                console.error("Word conversion error", err);
                alert("The system failed to parse the Word document. Please ensure it is a valid .docx file.");
            } finally {
                setIsProcessing(false);
                if (wordInputRef.current) wordInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportWord = async (spec: RawSpec) => {
        setIsProcessing(true);
        try {
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
            
            const children: any[] = [
                new Paragraph({
                    text: "TECHNICAL MATERIAL SPECIFICATION",
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Product Name: ", bold: true }),
                        new TextRun({ text: spec.genericName.toUpperCase() })
                    ],
                    spacing: { after: 200 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "Registry ID: ", bold: true }),
                        new TextRun({ text: spec.id })
                    ],
                    spacing: { after: 400 }
                })
            ];

            spec.sections.forEach(section => {
                if (section.content.trim() === "" || section.content === "<p><br></p>") return;
                
                children.push(new Paragraph({
                    text: section.title,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 }
                }));

                // Programmatic cleaning of HTML for docx injection
                const cleanText = section.content.replace(/<[^>]*>?/gm, ' ');
                children.push(new Paragraph({
                    text: cleanText,
                    spacing: { after: 200 }
                }));
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: children,
                }],
            });

            const blob = await Packer.toBlob(doc);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${spec.genericName.replace(/\s+/g, '_')}_Master.docx`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Word export failed", err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveRegistry = () => {
        if (!docName.trim()) {
            alert("Document Name is required for the Registry.");
            return;
        }

        const now = new Date().toISOString().split('T')[0];
        if (editingSopId) {
            setSpecifications(prev => prev.map(s => s.id === editingSopId ? {
                ...s,
                genericName: docName,
                technicalFunctionName: technicalFunctionName || undefined,
                sections: sections,
                updatedAt: now
            } : s));
        } else {
            const newSpec: RawSpec = {
                id: `SPEC-${Date.now()}`,
                genericName: docName,
                technicalFunctionName: technicalFunctionName || undefined,
                sections: sections,
                createdAt: now,
                updatedAt: now
            };
            setSpecifications(prev => [newSpec, ...prev]);
        }
        setIsEditorOpen(false);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-700">
            {/* 1. Header Command Bar */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[2rem] shadow-inner">
                        <BookOpen size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Technical Master</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                           <ShieldCheck size={12} className="text-indigo-500" /> Digital SOP Provisioning Suite
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative group flex-1 lg:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search Specification Archive..." 
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleCreateNew}
                        className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <Plus size={18} strokeWidth={3} /> Create Document
                    </button>
                </div>
            </div>

            {/* 2. Registry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSpecs.length > 0 ? filteredSpecs.map(spec => (
                    <div key={spec.id} className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all group flex flex-col justify-between min-h-[380px] relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform pointer-events-none">
                            <FileText size={160} />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg">DOC</div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">#{spec.id.slice(-6)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditSpec(spec)} className="p-2.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit2 size={16}/></button>
                                    <button onClick={() => setSpecifications(prev => prev.filter(s => s.id !== spec.id))} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-3 group-hover:text-indigo-600 transition-colors">{spec.genericName}</h3>
                            
                            {/* Metadata Badges */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {spec.technicalFunctionName && (
                                    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                                        🔧 {spec.technicalFunctionName}
                                    </span>
                                )}
                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest rounded-full">
                                    {spec.sections.filter(s => s.content.trim() !== '').length} Sections
                                </span>
                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest rounded-full">
                                    {new Date(spec.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><FileText size={14}/></div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Sections</p>
                                        <p className="text-[10px] font-black text-slate-700 uppercase">{spec.sections.filter(s => s.content.trim() !== '').length} Elements Populated</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 relative z-10 space-y-4">
                            <div className="flex flex-col gap-2">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Mapping</p>
                                {spec.linkedRawMaterialId ? (
                                    <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Boxes size={18} className="text-indigo-600 shrink-0" />
                                            <span className="text-xs font-black text-indigo-900 uppercase truncate">{spec.linkedRawMaterialName}</span>
                                        </div>
                                        <button onClick={() => { setSelectedSpec(spec); setIsLinkModalOpen(true); }} className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all"><RefreshCw size={14} /></button>
                                    </div>
                                ) : (
                                    <button onClick={() => { setSelectedSpec(spec); setIsLinkModalOpen(true); }} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                        <Link size={14} /> Map to Stock SKU
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleExportWord(spec)}
                                    className="flex-1 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <FileDown size={18} /> Word Master
                                </button>
                                <button className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-95" title="Export PDF"><Download size={20}/></button>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 shadow-inner">
                        <FileText size={64} className="text-slate-200 mb-6 opacity-20" />
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Empty Registry Node</h3>
                        <p className="text-slate-400 text-xs mt-3 font-medium uppercase tracking-widest max-w-xs leading-relaxed">
                            Initialize your technical database by creating a standard material specification profile.
                        </p>
                    </div>
                )}
            </div>

            {/* 3. "Online Word" Editor Modal */}
            {isEditorOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-200 w-full max-w-7xl h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-300 animate-in zoom-in-95 duration-300">
                        
                        {/* Editor Header Toolbar */}
                        <div className="px-10 py-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center shrink-0 shadow-2xl relative z-10 gap-4">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg ring-4 ring-indigo-500/20">
                                    <FileSignature size={24} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">Document Authoring Suite</h3>
                                    <div className="flex items-center gap-3">
                                        <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">ISO 22000 Functional Requirements</p>
                                        <div className="h-3 w-px bg-white/10" />
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1"><ShieldCheck size={12}/> Secure Protocol</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => wordInputRef.current?.click()}
                                    className="px-6 py-2.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-xl"
                                >
                                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                                    Import Word Document
                                </button>
                                <input type="file" ref={wordInputRef} className="hidden" accept=".docx" onChange={handleImportWord} />
                                <div className="h-8 w-px bg-white/10 mx-1" />
                                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"><X size={28} strokeWidth={2.5}/></button>
                            </div>
                        </div>

                        {/* Split Workspace */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Navigation Sidebar */}
                            <div className="w-80 bg-white border-r border-slate-300 flex flex-col p-6 gap-3 overflow-y-auto custom-scrollbar shadow-inner">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Document Tree</h4>
                                    <button onClick={handleAddCustomSection} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Plus size={14} strokeWidth={3} /></button>
                                </div>
                                <div className="space-y-1.5">
                                    {sections.map((section, idx) => (
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
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeSectionId === section.id ? 'bg-white' : 'bg-emerald-500'}`} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Main Document Canvas (A4 Simulated) */}
                            <div className="flex-1 bg-slate-200 overflow-y-auto custom-scrollbar flex flex-col items-center py-10 px-4">
                                <div className="w-full max-w-[210mm] space-y-3 mb-4">
                                    <input 
                                        placeholder="UNTITLED MATERIAL SPECIFICATION..."
                                        className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black uppercase focus:border-indigo-500 outline-none shadow-sm text-center"
                                        value={docName}
                                        onChange={e => setDocName(e.target.value)}
                                    />
                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Technical Function Name</label>
                                            <input 
                                                placeholder="Enter technical function name..."
                                                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-6 py-3 text-xs font-semibold focus:border-indigo-500 outline-none shadow-sm"
                                                value={technicalFunctionName}
                                                onChange={e => setTechnicalFunctionName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                {activeSectionId ? (
                                    <div className="w-full h-full flex flex-col items-center">
                                        <div className="w-full max-w-[210mm] bg-white border-b border-slate-200 flex justify-between items-center p-4 rounded-t-3xl shadow-sm z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Layout size={14}/></div>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sections.find(s => s.id === activeSectionId)?.title}</span>
                                            </div>
                                            <button 
                                                onClick={() => setSections(prev => prev.filter(s => s.id !== activeSectionId))}
                                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                        <div className="flex-1 w-full max-w-[210mm] relative">
                                            <RichTextEditor 
                                                isPageMode={true}
                                                value={sections.find(s => s.id === activeSectionId)?.content || ""}
                                                onChange={handleUpdateSectionContent}
                                                placeholder={`Populate technical requirement for: ${sections.find(s => s.id === activeSectionId)?.title}`}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20 gap-6 opacity-40 grayscale">
                                        <FileText size={80} />
                                        <h3 className="text-xl font-black uppercase tracking-widest">Select Node To Author</h3>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="px-10 py-8 bg-white border-t border-slate-300 flex justify-between items-center shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                             <div className="flex items-center gap-3 text-slate-400">
                                <Globe size={18} className="text-indigo-600" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Global Master Synchronization Active</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setIsEditorOpen(false)} className="px-10 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest">Cancel</button>
                                <button 
                                    onClick={handleSaveRegistry}
                                    className="px-20 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    <Save size={20} /> Publish to Master Registry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. SKU Linking Modal */}
            {isLinkModalOpen && selectedSpec && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 h-[75vh]">
                        <div className="px-8 py-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <Link size={24} />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">Map to Stock Asset</h3>
                                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1.5">Spec: {selectedSpec.genericName}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsLinkModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        
                        <div className="p-4 border-b border-slate-100 shrink-0">
                            <div className="relative group">
                                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input 
                                    type="text" 
                                    autoFocus
                                    placeholder="Filter Stock Registry..." 
                                    className="w-full pl-12 pr-4 py-3.5 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition-all bg-slate-50 focus:bg-white shadow-inner"
                                    value={matSearchTerm}
                                    onChange={(e) => setMatSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                            {filteredMaterials.length > 0 ? filteredMaterials.map(mat => (
                                <button 
                                    key={mat.id}
                                    onClick={() => {
                                        setSpecifications(prev => prev.map(s => s.id === selectedSpec.id ? { ...s, linkedRawMaterialId: mat.id, linkedRawMaterialName: mat.name } : s));
                                        setIsLinkModalOpen(false);
                                        setSelectedSpec(null);
                                        setMatSearchTerm("");
                                    }}
                                    className="w-full text-left p-6 hover:bg-slate-50 transition-all flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100 shadow-inner">
                                            <Boxes size={24} />
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-slate-800 uppercase tracking-tight leading-none mb-1.5">{mat.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded border">#{mat.sku}</span>
                                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active Stock Node</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                                </button>
                            )) : (
                                <div className="p-20 text-center text-slate-300 italic uppercase font-bold text-xs">
                                    No matching materials identified in stock registry
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RawMaterialSpecification;
