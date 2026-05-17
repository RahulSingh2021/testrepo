
"use client";

import React, { useState, useMemo, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  BookOpen,
  PlusCircle,
  X,
  Briefcase,
  FileDown,
  Save,
  ImageIcon,
  Type,
  Trash,
  LayoutTemplate,
  FileType2,
  Printer,
  ArrowRightLeft
} from 'lucide-react';
import { Entity, HierarchyScope, SopDefinition, SopContent, SopSection, SubTopicEntry } from '../types';
import RichTextEditor from './RichTextEditor';

interface SopManagementProps {
  entities: Entity[];
  onUpdateEntity: (entity: Entity) => void;
  currentScope: HierarchyScope;
  userRootId?: string | null;
}

const DEFAULT_SOP_CONTENT: SopContent = {
  version: "1.0",
  lastReviewDate: new Date().toISOString().split('T')[0],
  sections: [
    { id: '1', title: '1. Purpose', content: "To establish a standard procedure for..." },
    { id: '2', title: '2. Scope', content: "This procedure applies to all staff in..." },
    { id: '3', title: '3. Responsibilities', content: "<ul><li><b>Unit Manager:</b> Responsible for enforcement.</li><li><b>Staff:</b> Responsible for execution.</li></ul>" },
    { id: '4', title: '4. Procedure', content: "<ol><li>Step one...</li><li>Step two...</li></ol>" },
    { id: '5', title: '5. Monitoring', content: "Daily checks to be performed by..." },
    { id: '6', title: '6. Corrective Action', content: "If deviation is observed..." },
    { id: '7', title: '7. Verification', content: "Weekly verification by..." },
    { id: '8', title: '8. Records', content: "Log book reference..." }
  ]
};

const stripHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

interface ParsedBlock {
  type: 'paragraph' | 'heading' | 'list-item-bullet' | 'list-item-number' | 'table-row';
  text: string;
  runs?: TextRun[];
  bold?: boolean;
  italic?: boolean;
  indent?: number;
  cells?: string[];
}

const BLOCK_TAGS = new Set(['ul', 'ol', 'table', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);

const collectInlineRuns = (el: HTMLElement): TextRun[] => {
  const runs: TextRun[] = [];
  const walk = (node: Node, parentBold: boolean, parentItalic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) runs.push({ text: text.replace(/\s+/g, ' '), bold: parentBold || undefined, italic: parentItalic || undefined });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as HTMLElement;
    const tag = child.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag)) return;
    const isBold = parentBold || tag === 'b' || tag === 'strong' || child.style.fontWeight === 'bold';
    const isItalic = parentItalic || tag === 'i' || tag === 'em' || child.style.fontStyle === 'italic';
    child.childNodes.forEach(c => walk(c, isBold, isItalic));
  };
  el.childNodes.forEach(c => walk(c, false, false));
  return runs;
};

const runsToPlainText = (runs: TextRun[]): string => runs.map(r => r.text).join('').trim();

const parseHtmlToBlocks = (html: string): ParsedBlock[] => {
  const blocks: ParsedBlock[] = [];
  const div = document.createElement('div');
  div.innerHTML = html;

  const processNode = (node: Node, listType?: 'ul' | 'ol', listIndex?: { val: number }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      if (text) blocks.push({ type: 'paragraph', text, runs: [{ text }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'table') {
      const rows = el.querySelectorAll('tr');
      rows.forEach(row => {
        const cells: string[] = [];
        row.querySelectorAll('td, th').forEach(cell => {
          cells.push((cell.textContent || '').trim());
        });
        if (cells.length > 0) blocks.push({ type: 'table-row', text: '', cells });
      });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const idx = { val: 0 };
      el.childNodes.forEach(child => processNode(child, tag as 'ul' | 'ol', idx));
      return;
    }

    if (tag === 'li') {
      const runs = collectInlineRuns(el);
      const text = runsToPlainText(runs);
      if (listType === 'ol') {
        if (listIndex) listIndex.val++;
        blocks.push({ type: 'list-item-number', text, runs, indent: 1 });
      } else {
        blocks.push({ type: 'list-item-bullet', text, runs, indent: 1 });
      }
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childTag = (child as HTMLElement).tagName.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') {
            processNode(child, childTag as 'ul' | 'ol');
          }
        }
      });
      return;
    }

    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      const runs = collectInlineRuns(el);
      blocks.push({ type: 'heading', text: runsToPlainText(runs), runs, bold: true });
      return;
    }

    if (tag === 'br') {
      return;
    }

    if (tag === 'p' || tag === 'div' || tag === 'span' || tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em') {
      const hasBlockChildren = Array.from(el.children).some(c => BLOCK_TAGS.has(c.tagName.toLowerCase()));
      if (hasBlockChildren) {
        el.childNodes.forEach(child => processNode(child, listType, listIndex));
      } else {
        const runs = collectInlineRuns(el);
        const text = runsToPlainText(runs);
        if (text) {
          const allBold = runs.every(r => r.bold);
          const allItalic = runs.every(r => r.italic);
          blocks.push({ type: 'paragraph', text, runs, bold: allBold, italic: allItalic });
        }
      }
      return;
    }

    el.childNodes.forEach(child => processNode(child, listType, listIndex));
  };

  div.childNodes.forEach(child => processNode(child));
  return blocks;
};

const SopManagement: React.FC<SopManagementProps> = ({ 
  entities, 
  onUpdateEntity, 
  currentScope, 
  userRootId 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSopIds, setExpandedSopIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<SopDefinition | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [newSopName, setNewSopName] = useState('');
  const [newSubTopic, setNewSubTopic] = useState('');
  const [editingSubTopic, setEditingSubTopic] = useState<{ sopId: string; oldName: string; newName: string } | null>(null);
  const [moveSubTopicModal, setMoveSubTopicModal] = useState<{ fromSopId: string; entryName: string; entry: SubTopicEntry } | null>(null);
  const [sopContent, setSopContent] = useState<SopContent>(DEFAULT_SOP_CONTENT);
  const [activeTab, setActiveTab] = useState<'info' | 'content'>('info');

  const effectiveScope = currentScope as string;

  const findAncestorByType = (entityId: string | null | undefined, type: HierarchyScope, allEntities: Entity[]): Entity | undefined => {
    if (!entityId) return undefined;
    const entity = allEntities.find(e => e.id === entityId);
    if (!entity) return undefined;
    if (entity.type === type) return entity;
    return findAncestorByType(entity.parentId, type, allEntities);
  };

  const getAncestorIds = (entityId: string | null | undefined): Set<string> => {
    const ids = new Set<string>();
    if (!entityId) return ids;
    let current = entities.find(e => e.id === entityId);
    while (current) {
      ids.add(current.id);
      current = current.parentId ? entities.find(e => e.id === current!.parentId) : undefined;
    }
    return ids;
  };

  const getDescendantIds = (parentId: string): string[] => {
    const children = entities.filter(e => e.parentId === parentId);
    return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
  };

  const targetCorporate = useMemo(() => {
    return findAncestorByType(userRootId, 'corporate', entities);
  }, [entities, currentScope, userRootId]);

  const currentEntity = useMemo(() => {
    if (!userRootId) return undefined;
    return entities.find(e => e.id === userRootId);
  }, [entities, userRootId]);

  const scopeLabel = (scope: string) => {
    if (scope === 'corporate') return 'C';
    if (scope === 'regional') return 'R';
    if (scope === 'unit') return 'U';
    return scope[0]?.toUpperCase() || '?';
  };

  const scopeBadgeClass = (scope: string) => {
    if (scope === 'corporate') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (scope === 'regional') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (scope === 'unit') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const canCreateSop = ['corporate', 'regional', 'unit'].includes(effectiveScope);

  const canEditSop = (sop: SopDefinition) => {
    const sopScope = sop.createdByScope || 'corporate';
    if (effectiveScope === 'corporate' && sopScope === 'corporate') return true;
    if (effectiveScope === 'regional' && sopScope === 'regional' && sop.createdByEntityId === userRootId) return true;
    if (effectiveScope === 'unit' && sopScope === 'unit' && sop.createdByEntityId === userRootId) return true;
    return false;
  };

  const canDeleteSop = canEditSop;

  const canAddSubTopic = (sop: SopDefinition) => {
    return ['corporate', 'regional', 'unit'].includes(effectiveScope);
  };

  const canEditSubTopic = (sop: SopDefinition, entry: SubTopicEntry | undefined) => {
    if (!entry) {
      return effectiveScope === 'corporate';
    }
    if (effectiveScope === 'corporate' && entry.createdByScope === 'corporate') return true;
    if (effectiveScope === 'regional' && (entry.createdByScope === 'regional') && entry.createdByEntityId === userRootId) return true;
    if (effectiveScope === 'unit' && entry.createdByScope === 'unit' && entry.createdByEntityId === userRootId) return true;
    return false;
  };

  const canDeleteSubTopic = canEditSubTopic;

  const isVisible = (sop: SopDefinition): boolean => {
    const sopScope = sop.createdByScope || 'corporate';
    const sopEntityId = sop.createdByEntityId || targetCorporate?.id;

    if (sopScope === 'corporate') return true;

    if (sopScope === 'regional') {
      if (effectiveScope === 'corporate') return false;
      if (effectiveScope === 'regional') return sop.createdByEntityId === userRootId;
      const ancestorIds = getAncestorIds(userRootId);
      return !!sop.createdByEntityId && ancestorIds.has(sop.createdByEntityId);
    }

    if (sopScope === 'unit') {
      if (effectiveScope === 'corporate' || effectiveScope === 'regional') return false;
      if (effectiveScope === 'unit') return sop.createdByEntityId === userRootId;
      const ancestorIds = getAncestorIds(userRootId);
      return !!sop.createdByEntityId && ancestorIds.has(sop.createdByEntityId);
    }

    return true;
  };

  const allSops = useMemo(() => targetCorporate?.masterSops || [], [targetCorporate]);

  const visibleSops = useMemo(() => {
    return allSops.filter(sop => isVisible(sop));
  }, [allSops, effectiveScope, userRootId, entities]);

  const filteredSops = useMemo(() => {
    if (!searchTerm) return visibleSops;
    const lowerSearch = searchTerm.toLowerCase();
    return visibleSops.filter(sop => {
      const allSubNames = getSubTopicNames(sop);
      return sop.name.toLowerCase().includes(lowerSearch) || allSubNames.some(st => st.toLowerCase().includes(lowerSearch));
    });
  }, [visibleSops, searchTerm]);

  const getSubTopicNames = (sop: SopDefinition): string[] => {
    if (sop.subTopicEntries && sop.subTopicEntries.length > 0) {
      return sop.subTopicEntries.map(e => e.name);
    }
    return sop.subTopics || [];
  };

  const getSubTopicEntriesForDisplay = (sop: SopDefinition): SubTopicEntry[] => {
    if (sop.subTopicEntries && sop.subTopicEntries.length > 0) {
      return sop.subTopicEntries.filter(entry => {
        if (entry.createdByScope === 'corporate') return true;
        if (entry.createdByScope === 'regional') {
          if (effectiveScope === 'corporate') return false;
          if (effectiveScope === 'regional') return entry.createdByEntityId === userRootId;
          const ancestorIds = getAncestorIds(userRootId);
          return ancestorIds.has(entry.createdByEntityId);
        }
        if (entry.createdByScope === 'unit') {
          if (effectiveScope === 'corporate' || effectiveScope === 'regional') return false;
          if (effectiveScope === 'unit') return entry.createdByEntityId === userRootId;
          const ancestorIds = getAncestorIds(userRootId);
          return ancestorIds.has(entry.createdByEntityId);
        }
        return true;
      });
    }
    return (sop.subTopics || []).map(name => ({
      name,
      createdByScope: (sop.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
      createdByEntityId: sop.createdByEntityId || targetCorporate?.id || ''
    }));
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedSopIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedSopIds(newSet);
  };

  const getCreatorScope = (): 'corporate' | 'regional' | 'unit' => {
    if (effectiveScope === 'corporate') return 'corporate';
    if (effectiveScope === 'regional') return 'regional';
    return 'unit';
  };

  const handleSaveSop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCorporate || !newSopName.trim()) return;

    const currentSops = targetCorporate.masterSops || [];
    let updatedSops: SopDefinition[];

    if (editingSop) {
      updatedSops = currentSops.map(s => s.id === editingSop.id ? { ...s, name: newSopName, content: sopContent } : s);
    } else {
      const creatorScope = getCreatorScope();
      updatedSops = [...currentSops, {
        id: `sop-${Date.now()}`,
        name: newSopName,
        subTopics: [],
        subTopicEntries: [],
        content: sopContent,
        createdByScope: creatorScope,
        createdByEntityId: userRootId || targetCorporate.id
      }];
    }

    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
    setIsModalOpen(false);
    setNewSopName('');
    setSopContent(DEFAULT_SOP_CONTENT);
    setEditingSop(null);
  };

  const handleDeleteSop = (id: string) => {
    if (!targetCorporate || !window.confirm('Delete this SOP and all its sub-topics?')) return;
    const updatedSops = (targetCorporate.masterSops || []).filter(s => s.id !== id);
    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
  };

  const handleAddSubTopic = (sopId: string) => {
    if (!targetCorporate || !newSubTopic.trim()) return;
    const creatorScope = getCreatorScope();
    const updatedSops = (targetCorporate.masterSops || []).map(s => {
      if (s.id === sopId) {
        const existingEntries = s.subTopicEntries || s.subTopics.map(name => ({
          name,
          createdByScope: (s.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
          createdByEntityId: s.createdByEntityId || targetCorporate.id
        }));
        if (existingEntries.some(e => e.name.toLowerCase() === newSubTopic.trim().toLowerCase())) {
          alert('Sub-topic already exists');
          return s;
        }
        const newEntry: SubTopicEntry = {
          name: newSubTopic.trim(),
          createdByScope: creatorScope,
          createdByEntityId: userRootId || targetCorporate.id
        };
        const updatedEntries = [...existingEntries, newEntry];
        return {
          ...s,
          subTopics: updatedEntries.map(e => e.name),
          subTopicEntries: updatedEntries
        };
      }
      return s;
    });
    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
    setNewSubTopic('');
  };

  const handleEditSubTopic = (sopId: string, oldName: string, newName: string) => {
    if (!targetCorporate || !newName.trim()) return;
    const updatedSops = (targetCorporate.masterSops || []).map(s => {
      if (s.id === sopId) {
        const existingEntries = s.subTopicEntries || s.subTopics.map(name => ({
          name,
          createdByScope: (s.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
          createdByEntityId: s.createdByEntityId || targetCorporate.id
        }));
        const updatedEntries = existingEntries.map(e =>
          e.name === oldName ? { ...e, name: newName.trim() } : e
        );
        return {
          ...s,
          subTopics: updatedEntries.map(e => e.name),
          subTopicEntries: updatedEntries
        };
      }
      return s;
    });
    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
    setEditingSubTopic(null);
  };

  const handleDeleteSubTopic = (sopId: string, topicName: string) => {
    if (!targetCorporate || !window.confirm('Remove this sub-topic?')) return;
    const updatedSops = (targetCorporate.masterSops || []).map(s => {
      if (s.id === sopId) {
        const existingEntries = s.subTopicEntries || s.subTopics.map(name => ({
          name,
          createdByScope: (s.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
          createdByEntityId: s.createdByEntityId || targetCorporate.id
        }));
        const updatedEntries = existingEntries.filter(e => e.name !== topicName);
        return {
          ...s,
          subTopics: updatedEntries.map(e => e.name),
          subTopicEntries: updatedEntries
        };
      }
      return s;
    });
    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
  };

  const handleMoveSubTopic = (fromSopId: string, entryName: string, entry: SubTopicEntry, toSopId: string) => {
    if (!targetCorporate || fromSopId === toSopId) { setMoveSubTopicModal(null); return; }
    const allSops = targetCorporate.masterSops || [];
    const destSop = allSops.find(s => s.id === toSopId);
    if (destSop) {
      const destEntries = destSop.subTopicEntries || destSop.subTopics?.map(name => ({ name, createdByScope: 'corporate' as const, createdByEntityId: targetCorporate.id })) || [];
      if (destEntries.some(e => e.name.toLowerCase() === entryName.toLowerCase())) {
        alert('A sub-topic with that name already exists in the destination SOP.');
        return;
      }
    }
    const updatedSops = allSops.map(s => {
      if (s.id === fromSopId) {
        const existingEntries = s.subTopicEntries || s.subTopics.map(name => ({
          name,
          createdByScope: (s.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
          createdByEntityId: s.createdByEntityId || targetCorporate.id
        }));
        const updatedEntries = existingEntries.filter(e => e.name !== entryName);
        return { ...s, subTopics: updatedEntries.map(e => e.name), subTopicEntries: updatedEntries };
      }
      if (s.id === toSopId) {
        const existingEntries = s.subTopicEntries || s.subTopics.map(name => ({
          name,
          createdByScope: (s.createdByScope || 'corporate') as 'corporate' | 'regional' | 'unit',
          createdByEntityId: s.createdByEntityId || targetCorporate.id
        }));
        const updatedEntries = [...existingEntries, entry];
        return { ...s, subTopics: updatedEntries.map(e => e.name), subTopicEntries: updatedEntries };
      }
      return s;
    });
    onUpdateEntity({ ...targetCorporate, masterSops: updatedSops });
    setMoveSubTopicModal(null);
  };

  const handleAddSection = () => {
    const newId = Date.now().toString();
    const nextNum = (sopContent.sections?.length || 0) + 1;
    setSopContent({
        ...sopContent,
        sections: [
            ...(sopContent.sections || []),
            { id: newId, title: `${nextNum}. New Section`, content: '' }
        ]
    });
  };

  const handleUpdateSection = (id: string, field: keyof SopSection, value: string) => {
    setSopContent({
        ...sopContent,
        sections: (sopContent.sections || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  const handleRemoveSection = (id: string) => {
    if(!confirm('Delete this section?')) return;
    setSopContent({
        ...sopContent,
        sections: (sopContent.sections || []).filter(s => s.id !== id)
    });
  };

  const generateSOPPDF = async (sop: SopDefinition) => {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 20;
      const cw = pw - margin * 2;
      const footerH = 14;
      const bodyTop = margin + 12;
      const bodyBottom = ph - footerH - 4;
      let y = bodyTop;
      const corpName = targetCorporate?.name || 'Organization';
      const content = sop.content || DEFAULT_SOP_CONTENT;
      const sections = content.sections || [];

      const C = {
        primary: [45, 80, 140] as [number, number, number],
        primaryLight: [100, 140, 200] as [number, number, number],
        accent: [0, 102, 153] as [number, number, number],
        heading: [15, 30, 55] as [number, number, number],
        body: [40, 50, 65] as [number, number, number],
        muted: [130, 145, 165] as [number, number, number],
        faint: [190, 200, 215] as [number, number, number],
        border: [210, 218, 230] as [number, number, number],
        bgLight: [245, 247, 250] as [number, number, number],
        tableBg: [240, 243, 248] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
      };

      const drawPageFrame = () => {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.rect(margin - 2, margin - 2, cw + 4, ph - margin * 2 + 4);

        doc.setDrawColor(...C.primary);
        doc.setLineWidth(0.8);
        doc.line(margin, margin + 8, pw - margin, margin + 8);
        doc.setLineWidth(0.25);
        doc.line(margin, margin + 9.2, pw - margin, margin + 9.2);

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.primary);
        doc.text('HACCP PRO', margin, margin + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text('Food Safety Management System', margin + 20, margin + 5.5);

        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.text(`Document: ${sop.name.substring(0, 50)}`, pw - margin, margin + 5.5, { align: 'right' });
      };

      const drawFooter = (pageNum: number, totalPages: number) => {
        const fy = ph - footerH;
        doc.setDrawColor(...C.primary);
        doc.setLineWidth(0.25);
        doc.line(margin, fy, pw - margin, fy);
        doc.setLineWidth(0.8);
        doc.line(margin, fy + 0.8, pw - margin, fy + 0.8);

        doc.setFontSize(6);
        doc.setTextColor(...C.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(corpName, margin, fy + 6);
        doc.setFont('helvetica', 'italic');
        doc.text('Confidential \u2014 For authorized use only', pw / 2, fy + 6, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.primary);
        doc.text(`${pageNum} / ${totalPages}`, pw - margin, fy + 6, { align: 'right' });
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > bodyBottom) {
          doc.addPage();
          drawPageFrame();
          y = bodyTop;
        }
      };

      const wrapText = (text: string, maxW: number, fontSize: number): string[] => {
        doc.setFontSize(fontSize);
        return doc.splitTextToSize(text, maxW);
      };

      const drawInlineRuns = (runs: TextRun[] | undefined, fallbackText: string, x: number, currentY: number, maxW: number, fontSize: number): number => {
        if (!runs || runs.length === 0) {
          doc.setFontSize(fontSize);
          doc.setTextColor(...C.body);
          doc.setFont('helvetica', 'normal');
          const lines = wrapText(fallbackText, maxW, fontSize);
          let ly = currentY;
          lines.forEach(line => {
            ensureSpace(4.5);
            doc.text(line, x, ly);
            ly += 4.2;
          });
          return ly;
        }

        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.body);
        const fullText = runs.map(r => r.text).join('');
        const lines = doc.splitTextToSize(fullText, maxW);

        const runBoundaries: { start: number; end: number; run: TextRun }[] = [];
        let pos = 0;
        for (const run of runs) {
          runBoundaries.push({ start: pos, end: pos + run.text.length, run });
          pos += run.text.length;
        }

        let ly = currentY;
        let globalOffset = 0;

        lines.forEach((line: string) => {
          ensureSpace(4.5);
          let lx = x;
          const lineLen = line.length;
          let lineOffset = 0;

          while (lineOffset < lineLen) {
            const currentGlobal = globalOffset + lineOffset;
            const boundary = runBoundaries.find(b => currentGlobal >= b.start && currentGlobal < b.end);
            if (!boundary) {
              const rest = line.substring(lineOffset);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...C.body);
              doc.text(rest, lx, ly);
              lineOffset = lineLen;
              break;
            }

            const posInRun = currentGlobal - boundary.start;
            const availInRun = boundary.end - currentGlobal;
            const availInLine = lineLen - lineOffset;
            const chunkLen = Math.min(availInRun, availInLine);
            const chunk = line.substring(lineOffset, lineOffset + chunkLen);

            const r = boundary.run;
            doc.setFont('helvetica', r.bold && r.italic ? 'bolditalic' : r.bold ? 'bold' : r.italic ? 'italic' : 'normal');
            doc.setTextColor(...C.body);
            doc.text(chunk, lx, ly);
            lx += doc.getTextWidth(chunk);
            lineOffset += chunkLen;
          }

          globalOffset += lineLen;
          const nextInFull = fullText.charAt(globalOffset);
          if (nextInFull === ' ' || nextInFull === '\n') globalOffset++;

          ly += 4.2;
        });
        return ly;
      };

      drawPageFrame();

      y = margin + 14;

      const headerH = 22;
      const headerX = margin;
      const headerW = cw;
      doc.setFillColor(...C.heading);
      doc.rect(headerX, y, headerW, headerH, 'F');

      doc.setDrawColor(...C.primaryLight);
      doc.setLineWidth(0.6);
      doc.line(headerX, y, headerX + headerW, y);
      doc.line(headerX, y + headerH, headerX + headerW, y + headerH);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text('STANDARD OPERATING PROCEDURE', headerX + 5, y + 8);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 210);
      doc.text(corpName.toUpperCase(), headerX + 5, y + 15);

      const sopNameTrunc = sop.name.length > 40 ? sop.name.substring(0, 37) + '...' : sop.name;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(sopNameTrunc, headerX + headerW - 5, y + 8, { align: 'right' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 190, 210);
      doc.text(`Version ${content.version} | ${content.lastReviewDate}`, headerX + headerW - 5, y + 15, { align: 'right' });

      y += headerH + 3;

      const metaW = cw;
      const metaX = margin;
      const metaH = 14;
      doc.setFillColor(...C.bgLight);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.2);
      doc.rect(metaX, y, metaW, metaH, 'FD');

      doc.setDrawColor(...C.primary);
      doc.setLineWidth(0.8);
      doc.line(metaX, y, metaX + metaW, y);

      doc.setFontSize(7.5);
      const metaItems = [
        { label: 'Version', value: content.version },
        { label: 'Effective', value: content.lastReviewDate },
        { label: 'Status', value: 'Active' },
      ];
      const metaColW = metaW / metaItems.length;
      metaItems.forEach((item, i) => {
        const cx = metaX + i * metaColW + metaColW / 2;
        if (i > 0) {
          doc.setDrawColor(...C.border);
          doc.setLineWidth(0.15);
          doc.line(metaX + i * metaColW, y + 2, metaX + i * metaColW, y + metaH - 2);
        }
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.muted);
        doc.text(item.label, cx, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.heading);
        doc.text(item.value, cx, y + 10.5, { align: 'center' });
      });
      y += metaH + 4;

      const sigBlockW = cw / 3;
      const sigLabels = ['Prepared By', 'Reviewed By', 'Approved By'];
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.body);
      sigLabels.forEach((label, i) => {
        const bx = margin + i * sigBlockW;
        doc.text(label, bx + 2, y);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.15);
        doc.line(bx + 2, y + 3, bx + sigBlockW - 4, y + 3);
      });
      y += 12;

      sections.forEach((section, sIdx) => {
        ensureSpace(20);

        doc.setFillColor(...C.primary);
        doc.rect(margin, y, 1.2, 6, 'F');

        doc.setFontSize(11);
        doc.setTextColor(...C.heading);
        doc.setFont('helvetica', 'bold');
        const sectionTitleLines = wrapText(section.title, cw - 8, 11);
        doc.text(sectionTitleLines, margin + 5, y + 4.5);
        y += sectionTitleLines.length * 5.5 + 4;

        doc.setDrawColor(...C.accent);
        doc.setLineWidth(0.4);
        doc.line(margin + 5, y - 1, margin + 35, y - 1);
        y += 3;

        const blocks = parseHtmlToBlocks(section.content);

        if (blocks.length === 0) {
          const plainText = stripHtml(section.content).trim();
          if (plainText) {
            doc.setFontSize(9);
            doc.setTextColor(...C.body);
            doc.setFont('helvetica', 'normal');
            const lines = wrapText(plainText, cw - 12, 9);
            lines.forEach(line => {
              ensureSpace(5);
              doc.text(line, margin + 6, y);
              y += 4.2;
            });
          }
        } else {
          let numberedIdx = 0;
          let isFirstTableRow = true;
          let tableRowIdx = 0;

          blocks.forEach((block, bIdx) => {
            if (block.type !== 'table-row') { isFirstTableRow = true; tableRowIdx = 0; }

            if (block.type === 'table-row' && block.cells) {
              const cellCount = block.cells.length;
              const tableW = cw - 12;
              const cellW = tableW / cellCount;
              const cellPad = 2.5;
              const cellInnerW = cellW - cellPad * 2;
              doc.setFontSize(7.5);
              doc.setFont('helvetica', isFirstTableRow ? 'bold' : 'normal');
              const cellLineArrays = block.cells.map(cell => doc.splitTextToSize(cell, cellInnerW));
              const maxLines = Math.max(...cellLineArrays.map(l => l.length), 1);
              const rowH = maxLines * 3.8 + 4;
              ensureSpace(rowH);

              if (isFirstTableRow) {
                doc.setFillColor(...C.primary);
                doc.rect(margin + 6, y - 2, tableW, rowH, 'F');
                doc.setTextColor(...C.white);
              } else {
                const rowBg = (tableRowIdx % 2 === 1) ? C.bgLight : C.white;
                doc.setFillColor(...rowBg);
                doc.rect(margin + 6, y - 2, tableW, rowH, 'F');
                doc.setTextColor(...C.body);
              }

              doc.setDrawColor(...C.border);
              doc.setLineWidth(0.15);
              block.cells.forEach((cell, ci) => {
                const cellX = margin + 6 + ci * cellW;
                if (ci > 0) doc.line(cellX, y - 2, cellX, y - 2 + rowH);
                const cellLines = cellLineArrays[ci];
                cellLines.forEach((line: string, li: number) => {
                  doc.text(line, cellX + cellPad, y + 2 + li * 3.8);
                });
              });
              doc.line(margin + 6, y - 2 + rowH, margin + 6 + tableW, y - 2 + rowH);

              isFirstTableRow = false;
              tableRowIdx++;
              y += rowH;
              return;
            }

            if (block.type === 'heading') {
              ensureSpace(9);
              doc.setFontSize(9.5);
              doc.setTextColor(...C.heading);
              doc.setFont('helvetica', 'bold');
              doc.text(block.text, margin + 6, y);
              y += 5.5;
              return;
            }

            if (block.type === 'list-item-bullet') {
              const bulletX = margin + 10;
              const textX = margin + 15;
              const textW = cw - 21;

              if (block.runs && block.runs.length > 0) {
                ensureSpace(5);
                doc.setFillColor(...C.accent);
                doc.circle(bulletX, y - 0.8, 0.7, 'F');
                y = drawInlineRuns(block.runs, block.text, textX, y, textW, 9);
              } else {
                doc.setFontSize(9);
                doc.setTextColor(...C.body);
                doc.setFont('helvetica', 'normal');
                const lines = wrapText(block.text, textW, 9);
                lines.forEach((line, li) => {
                  ensureSpace(5);
                  if (li === 0) {
                    doc.setFillColor(...C.accent);
                    doc.circle(bulletX, y - 0.8, 0.7, 'F');
                  }
                  doc.text(line, textX, y);
                  y += 4.2;
                });
              }
              return;
            }

            if (block.type === 'list-item-number') {
              numberedIdx++;
              const numX = margin + 8;
              const textX = margin + 16;
              const textW = cw - 22;

              if (block.runs && block.runs.length > 0) {
                ensureSpace(5);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...C.primary);
                doc.text(`${numberedIdx}.`, numX, y);
                y = drawInlineRuns(block.runs, block.text, textX, y, textW, 9);
              } else {
                doc.setFontSize(9);
                doc.setTextColor(...C.body);
                doc.setFont('helvetica', 'normal');
                const lines = wrapText(block.text, textW, 9);
                lines.forEach((line, li) => {
                  ensureSpace(5);
                  if (li === 0) {
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...C.primary);
                    doc.text(`${numberedIdx}.`, numX, y);
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...C.body);
                  }
                  doc.text(line, textX, y);
                  y += 4.2;
                });
              }
              return;
            }

            if (block.runs && block.runs.length > 0 && block.runs.some(r => r.bold || r.italic)) {
              y = drawInlineRuns(block.runs, block.text, margin + 6, y, cw - 12, 9);
            } else {
              doc.setFontSize(9);
              doc.setTextColor(...C.body);
              doc.setFont('helvetica', block.bold ? 'bold' : block.italic ? 'italic' : 'normal');
              const lines = wrapText(block.text, cw - 12, 9);
              lines.forEach(line => {
                ensureSpace(5);
                doc.text(line, margin + 6, y);
                y += 4.2;
              });
            }
          });
        }

        y += 7;

        if (sIdx < sections.length - 1) {
          ensureSpace(6);
          doc.setDrawColor(...C.border);
          doc.setLineWidth(0.15);
          const lineCenter = pw / 2;
          doc.line(lineCenter - 30, y - 3, lineCenter + 30, y - 3);
          y += 2;
        }
      });

      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawFooter(p, totalPages);
      }

      doc.save(`${sop.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_SOP.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSOPWord = async (sop: SopDefinition) => {
    setIsGenerating(true);
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun: DocTextRun, HeadingLevel, AlignmentType, TableRow, TableCell, Table, WidthType, BorderStyle, Header, Footer, PageNumber, NumberFormat, Tab, TabStopType, TabStopPosition } = docx;

      const corpName = targetCorporate?.name || 'Organization';
      const content = sop.content || DEFAULT_SOP_CONTENT;
      const sections = content.sections || [];

      const headerParagraphs = [
        new Paragraph({
          children: [
            new DocTextRun({ text: 'STANDARD OPERATING PROCEDURE', bold: true, size: 18, font: 'Calibri', color: '1E3A5F' }),
            new DocTextRun({ text: '\t' }),
            new DocTextRun({ text: sop.name, bold: true, size: 16, font: 'Calibri', color: '2563EB' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [
            new DocTextRun({ text: corpName, size: 14, font: 'Calibri', color: '64748B', italics: true }),
            new DocTextRun({ text: '\t' }),
            new DocTextRun({ text: `Version ${content.version} | Effective Date: ${content.lastReviewDate}`, size: 14, font: 'Calibri', color: '64748B' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 0 },
        }),
      ];

      const footerParagraphs = [
        new Paragraph({
          children: [
            new DocTextRun({ text: 'HACCP PRO - Food Safety Management System', size: 14, font: 'Calibri', color: '94A3B8' }),
            new DocTextRun({ text: '\t' }),
            new DocTextRun({ text: 'Page ', size: 14, font: 'Calibri', color: '94A3B8' }),
            new DocTextRun({ children: [PageNumber.CURRENT], size: 14, font: 'Calibri', color: '94A3B8' }),
            new DocTextRun({ text: ' of ', size: 14, font: 'Calibri', color: '94A3B8' }),
            new DocTextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, font: 'Calibri', color: '94A3B8' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          border: { top: { color: 'E2E8F0', size: 3, style: BorderStyle.SINGLE, space: 4 } },
        }),
        new Paragraph({
          children: [
            new DocTextRun({ text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | Confidential - Internal Use Only`, size: 12, font: 'Calibri', color: 'CBD5E1' }),
          ],
        }),
      ];

      const docChildren: any[] = [];

      docChildren.push(
        new Paragraph({
          children: [new DocTextRun({ text: 'STANDARD OPERATING PROCEDURE', bold: true, size: 24, font: 'Calibri', color: '7888A0' })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 160 },
        }),
        new Paragraph({
          children: [new DocTextRun({ text: sop.name, bold: true, italics: true, size: 22, font: 'Calibri', color: '506BA0' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new DocTextRun({ text: corpName, italics: true, size: 16, font: 'Calibri', color: 'A0AFC3' }),
            new DocTextRun({ text: '\t' }),
            new DocTextRun({ text: `Version ${content.version} | Effective Date: ${content.lastReviewDate}`, size: 16, font: 'Calibri', color: 'A0AFC3' }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 100 },
        }),
      );

      const sigTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: ['Prepared By', 'Reviewed By', 'Approved By'].map(label =>
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                shading: { fill: 'F8FAFC' },
                children: [
                  new Paragraph({
                    children: [new DocTextRun({ text: label, bold: true, size: 18, font: 'Calibri', color: '64748B' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 80, after: 40 },
                  }),
                ],
              }),
            ),
          }),
          new TableRow({
            children: [1, 2, 3].map(() =>
              new TableCell({
                children: [
                  new Paragraph({ text: '', spacing: { before: 400, after: 100 } }),
                  new Paragraph({
                    children: [new DocTextRun({ text: '______________________________', size: 16, font: 'Calibri', color: 'CBD5E1' })],
                    alignment: AlignmentType.CENTER,
                  }),
                  new Paragraph({
                    children: [new DocTextRun({ text: 'Name / Date / Signature', size: 14, font: 'Calibri', color: '94A3B8' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 80 },
                  }),
                ],
              }),
            ),
          }),
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        },
      });
      docChildren.push(sigTable);
      docChildren.push(new Paragraph({ text: '', spacing: { before: 200, after: 100 } }));


      sections.forEach((section) => {
        docChildren.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 },
            run: { bold: true, size: 26, font: 'Calibri', color: '0F172A' },
          }),
        );

        const blocks = parseHtmlToBlocks(section.content);

        if (blocks.length === 0) {
          const plainText = stripHtml(section.content).trim();
          if (plainText) {
            docChildren.push(
              new Paragraph({
                children: [new DocTextRun({ text: plainText, size: 22, font: 'Calibri', color: '334155' })],
                spacing: { before: 60, after: 80 },
                alignment: AlignmentType.JUSTIFIED,
              }),
            );
          }
        } else {
          let numberedIdx = 0;
          blocks.forEach(block => {
            if (block.type === 'table-row' && block.cells) {
              const tableRow = new TableRow({
                children: block.cells.map(cell =>
                  new TableCell({
                    children: [new Paragraph({ children: [new DocTextRun({ text: cell, size: 18, font: 'Calibri', color: '334155' })] })],
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
                    },
                  }),
                ),
              });
              const singleRowTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [tableRow],
              });
              docChildren.push(singleRowTable);
              return;
            }

            if (block.type === 'heading') {
              docChildren.push(
                new Paragraph({
                  children: [new DocTextRun({ text: block.text, bold: true, size: 22, font: 'Calibri', color: '1E293B' })],
                  spacing: { before: 120, after: 60 },
                }),
              );
              return;
            }

            const toDocxRuns = (runs: TextRun[] | undefined, fallbackText: string, defaultBold?: boolean, defaultItalic?: boolean) => {
              if (runs && runs.length > 0) {
                return runs.map(r => new DocTextRun({ text: r.text, bold: r.bold || defaultBold, italics: r.italic || defaultItalic, size: 22, font: 'Calibri', color: '334155' }));
              }
              return [new DocTextRun({ text: fallbackText, bold: defaultBold, italics: defaultItalic, size: 22, font: 'Calibri', color: '334155' })];
            };

            if (block.type === 'list-item-bullet') {
              docChildren.push(
                new Paragraph({
                  children: toDocxRuns(block.runs, block.text),
                  bullet: { level: 0 },
                  spacing: { before: 40, after: 40 },
                  alignment: AlignmentType.JUSTIFIED,
                }),
              );
              return;
            }

            if (block.type === 'list-item-number') {
              numberedIdx++;
              const numPrefix = new DocTextRun({ text: `${numberedIdx}. `, bold: true, size: 22, font: 'Calibri', color: '334155' });
              docChildren.push(
                new Paragraph({
                  children: [numPrefix, ...toDocxRuns(block.runs, block.text)],
                  spacing: { before: 40, after: 40 },
                  indent: { left: 360 },
                  alignment: AlignmentType.JUSTIFIED,
                }),
              );
              return;
            }

            docChildren.push(
              new Paragraph({
                children: toDocxRuns(block.runs, block.text, block.bold, block.italic),
                spacing: { before: 60, after: 60 },
                alignment: AlignmentType.JUSTIFIED,
              }),
            );
          });
        }
      });

      const wordDoc = new Document({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 22, color: '334155' },
              paragraph: { spacing: { line: 340 } },
            },
            heading1: {
              run: { font: 'Calibri', size: 28, bold: true, color: '0F172A' },
              paragraph: { spacing: { before: 240, after: 120 } },
            },
            title: {
              run: { font: 'Calibri', size: 48, bold: true, color: '0F172A' },
            },
          },
        },
        sections: [{
          headers: { default: new Header({ children: headerParagraphs }) },
          footers: { default: new Footer({ children: footerParagraphs }) },
          properties: {
            page: {
              margin: { top: 1440, bottom: 1200, left: 1200, right: 1200 },
              pageNumbers: { start: 1 },
            },
          },
          children: docChildren,
        }],
      });

      const blob = await Packer.toBlob(wordDoc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sop.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_SOP.docx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Word generation failed:', e);
      alert('Failed to generate Word document');
    } finally {
      setIsGenerating(false);
    }
  };

  const openEditModal = (sop: SopDefinition | null) => {
    setEditingSop(sop);
    setNewSopName(sop ? sop.name : '');
    let initialContent = sop?.content || DEFAULT_SOP_CONTENT;
    if(!initialContent.sections) {
         initialContent = DEFAULT_SOP_CONTENT;
    }
    setSopContent(initialContent);
    setActiveTab('info');
    setIsModalOpen(true);
  };

  if (!targetCorporate) {
    return (
      <div className="p-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
        <p className="text-lg font-bold">No Corporate Context Found</p>
        <p className="text-sm mt-2">Please select a corporate entity to view SOPs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">Standard Operating Procedures</h2>
            <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Master Repository for {targetCorporate.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex gap-1.5 items-center shrink-0">
            <span className="w-6 h-6 rounded-md text-[9px] font-black flex items-center justify-center border bg-blue-100 text-blue-700 border-blue-200" title="Corporate">C</span>
            <span className="w-6 h-6 rounded-md text-[9px] font-black flex items-center justify-center border bg-purple-100 text-purple-700 border-purple-200" title="Regional">R</span>
            <span className="w-6 h-6 rounded-md text-[9px] font-black flex items-center justify-center border bg-amber-100 text-amber-700 border-amber-200" title="Unit">U</span>
          </div>
          <div className="relative group flex-1 md:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" placeholder="Search SOPs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-full md:w-64 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300" />
          </div>
          {canCreateSop && (
            <button onClick={() => openEditModal(null)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 shadow-xl active:scale-95"><Plus size={14} /> New SOP</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredSops.length > 0 ? filteredSops.map(sop => {
          const isExpanded = expandedSopIds.has(sop.id);
          const sopOrigin = sop.createdByScope || 'corporate';
          const displayEntries = getSubTopicEntriesForDisplay(sop);
          const isEditable = canEditSop(sop);
          const isDeletable = canDeleteSop(sop);
          return (
            <div key={sop.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
              <div onClick={() => toggleExpand(sop.id)} className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">{isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center border shrink-0 ${scopeBadgeClass(sopOrigin)}`} title={`Created by ${sopOrigin}`}>{scopeLabel(sopOrigin)}</span>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm tracking-tight">{sop.name}</h4>
                      <div className="flex gap-4 mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest"><span>{displayEntries.length} Training Sub-topics</span>{sop.content && <span>v{sop.content.version}</span>}</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => generateSOPPDF(sop)} disabled={isGenerating} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100 disabled:opacity-50" title="Download PDF">
                    <Printer size={16} />
                  </button>
                  <button onClick={() => generateSOPWord(sop)} disabled={isGenerating} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100 disabled:opacity-50" title="Download Word">
                    <FileType2 size={16} />
                  </button>
                  {isEditable && (
                    <button onClick={() => openEditModal(sop)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                  )}
                  {isDeletable && (
                    <button onClick={() => handleDeleteSop(sop.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
                  <div className="mt-4 space-y-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Briefcase size={12} className="text-blue-500" /> Training Sub-Topics</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {displayEntries.map((entry, i) => {
                        const entryEditable = canEditSubTopic(sop, entry);
                        const entryDeletable = canDeleteSubTopic(sop, entry);
                        const isEditingThis = editingSubTopic?.sopId === sop.id && editingSubTopic?.oldName === entry.name;
                        return (
                          <div key={i} className="group bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2 hover:bg-white hover:border-blue-200 transition-all shadow-sm">
                            <span className={`w-5 h-5 rounded text-[8px] font-black flex items-center justify-center border shrink-0 ${scopeBadgeClass(entry.createdByScope)}`} title={`Created by ${entry.createdByScope}`}>{scopeLabel(entry.createdByScope)}</span>
                            {isEditingThis ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingSubTopic.newName}
                                onChange={(e) => setEditingSubTopic({ ...editingSubTopic, newName: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSubTopic(sop.id, editingSubTopic.oldName, editingSubTopic.newName);
                                  if (e.key === 'Escape') setEditingSubTopic(null);
                                }}
                                onBlur={() => handleEditSubTopic(sop.id, editingSubTopic.oldName, editingSubTopic.newName)}
                                className="flex-1 text-xs font-bold text-slate-700 bg-white border border-blue-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            ) : (
                              <span className="flex-1 text-xs font-bold text-slate-700 truncate">{entry.name}</span>
                            )}
                            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(targetCorporate?.masterSops || []).length > 1 && (
                                <button onClick={() => setMoveSubTopicModal({ fromSopId: sop.id, entryName: entry.name, entry })} title="Move to another SOP" className="text-slate-300 hover:text-cyan-600 transition-colors p-0.5"><ArrowRightLeft size={12} /></button>
                              )}
                              {entryEditable && !isEditingThis && (
                                <button onClick={() => setEditingSubTopic({ sopId: sop.id, oldName: entry.name, newName: entry.name })} className="text-slate-300 hover:text-indigo-500 transition-colors p-0.5"><Edit2 size={12} /></button>
                              )}
                              {entryDeletable && (
                                <button onClick={() => handleDeleteSubTopic(sop.id, entry.name)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5"><X size={14} /></button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {canAddSubTopic(sop) && (
                        <div className="flex gap-2 bg-white p-1 rounded-xl border border-dashed border-slate-300 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                          <input type="text" placeholder="Add sub-topic..." value={newSubTopic} onChange={(e) => setNewSubTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubTopic(sop.id)} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-bold outline-none placeholder:text-slate-300" />
                          <button onClick={() => handleAddSubTopic(sop.id)} disabled={!newSubTopic.trim()} className="bg-slate-900 text-white p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all"><PlusCircle size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><FileText size={32} /></div><p className="text-sm font-bold uppercase tracking-widest">No SOPs found</p></div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"><h3 className="text-lg font-black text-slate-800 tracking-tight">{editingSop ? 'Edit SOP Document' : 'Create New SOP'}</h3><button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18} className="text-slate-500" /></button></div>
            <div className="px-8 py-2 bg-white border-b border-slate-100 flex gap-4 shrink-0"><button onClick={() => setActiveTab('info')} className={`py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>General Info</button><button onClick={() => setActiveTab('content')} className={`py-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Document Content</button></div>
            <form onSubmit={handleSaveSop} className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/30">
              {activeTab === 'info' && (
                  <div className="space-y-6">
                    <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">SOP Name</label><div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" /><input autoFocus required type="text" value={newSopName} onChange={(e) => setNewSopName(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-300" placeholder="e.g. Chemical Handling Procedures" /></div></div>
                    <div className="grid grid-cols-2 gap-6"><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Version</label><input value={sopContent.version} onChange={(e) => setSopContent({...sopContent, version: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400 transition-all" placeholder="1.0" /></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Review Date</label><input type="date" value={sopContent.lastReviewDate} onChange={(e) => setSopContent({...sopContent, lastReviewDate: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-400 transition-all" /></div></div>
                  </div>
              )}
              {activeTab === 'content' && (
                  <div className="space-y-8">
                      {(sopContent.sections || []).map((section) => (
                          <div key={section.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group/section transition-all hover:shadow-md">
                              <div className="flex justify-between items-center mb-4"><input value={section.title} onChange={(e) => handleUpdateSection(section.id, 'title', e.target.value)} className="text-sm font-black text-slate-800 uppercase tracking-tight w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none pb-1 transition-colors" placeholder="SECTION TITLE" /><button type="button" onClick={() => handleRemoveSection(section.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors rounded-full hover:bg-slate-50" title="Remove Section"><Trash2 size={16} /></button></div>
                              <div className="rounded-xl overflow-hidden"><RichTextEditor label="" value={section.content} onChange={(val) => handleUpdateSection(section.id, 'content', val)} /></div>
                          </div>
                      ))}
                      <button type="button" onClick={handleAddSection} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all group bg-white/50 hover:bg-white"><PlusCircle size={20} className="group-hover:scale-110 transition-transform" /><span className="text-xs font-black uppercase tracking-widest">Add New Section</span></button>
                  </div>
              )}
            </form>
            <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-colors">Cancel</button><button onClick={handleSaveSop} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2"><Save size={16} /> {editingSop ? 'Update Document' : 'Create SOP'}</button></div>
          </div>
        </div>
      )}

      {moveSubTopicModal && (() => {
        const allSops = (targetCorporate?.masterSops || []);
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setMoveSubTopicModal(null)}>
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-800">Move Sub-Topic</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">
                    &ldquo;{moveSubTopicModal.entryName.length > 45 ? moveSubTopicModal.entryName.slice(0, 45) + '…' : moveSubTopicModal.entryName}&rdquo;
                  </p>
                </div>
                <button onClick={() => setMoveSubTopicModal(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto max-h-[calc(80vh-90px)]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">Select destination SOP</p>
                <div className="space-y-2">
                  {allSops.map(sop => {
                    const isCurrent = sop.id === moveSubTopicModal.fromSopId;
                    const alreadyExists = (sop.subTopicEntries || sop.subTopics || []).some((e: SubTopicEntry | string) =>
                      (typeof e === 'string' ? e : e.name).toLowerCase() === moveSubTopicModal.entryName.toLowerCase()
                    ) && !isCurrent;
                    const disabled = isCurrent || alreadyExists;
                    return (
                      <button
                        key={sop.id}
                        disabled={disabled}
                        onClick={() => handleMoveSubTopic(moveSubTopicModal.fromSopId, moveSubTopicModal.entryName, moveSubTopicModal.entry, sop.id)}
                        className={`flex items-center gap-3 w-full p-3.5 rounded-xl border text-left transition-all ${
                          isCurrent
                            ? 'bg-slate-50 border-slate-200 opacity-50 cursor-default'
                            : alreadyExists
                              ? 'bg-amber-50 border-amber-200 opacity-60 cursor-not-allowed'
                              : 'bg-white border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isCurrent ? 'bg-slate-200' : 'bg-indigo-100'
                        }`}>
                          <BookOpen size={16} className={isCurrent ? 'text-slate-400' : 'text-indigo-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold truncate ${isCurrent ? 'text-slate-400' : 'text-slate-700'}`}>
                            {sop.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {(sop.subTopicEntries || sop.subTopics || []).length} sub-topic{(sop.subTopicEntries || sop.subTopics || []).length !== 1 ? 's' : ''}
                            {isCurrent && <span className="ml-1.5 text-indigo-500 font-bold">(current)</span>}
                            {alreadyExists && <span className="ml-1.5 text-amber-600 font-bold">(duplicate name)</span>}
                          </div>
                        </div>
                        {!disabled && <ArrowRightLeft size={14} className="text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SopManagement;
