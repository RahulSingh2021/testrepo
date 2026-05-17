"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  ImageIcon, Table as TableIcon, Link2, Unlink, Quote,
  Code, Undo2, Redo2, Heading1, Heading2, Heading3,
  Palette, Highlighter, Type, ChevronDown, X, Plus,
  Trash2, ArrowUpToLine, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine,
  MergeIcon, SplitIcon, Minus, MoreHorizontal,
  Rows2, Columns2, TableProperties
} from 'lucide-react';
import { compressImage } from '@/utils/imageCompression';

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  isPageMode?: boolean;
  minHeight?: string;
  // When provided, dropped/pasted/picked images are first compressed,
  // then handed to this callback which must persist the bytes somewhere
  // and return a stable URL. The editor inserts that URL as the <img>
  // src, so the article HTML never carries a data: URI. When omitted,
  // the editor falls back to embedding the compressed base64 (legacy
  // behaviour used by existing surfaces).
  onUploadImage?: (dataUrl: string, file?: File) => Promise<string>;
}

const FONT_COLORS = [
  '#000000', '#1f2937', '#374151', '#6b7280',
  '#dc2626', '#ea580c', '#d97706', '#ca8a04',
  '#16a34a', '#059669', '#0891b2', '#2563eb',
  '#4f46e5', '#7c3aed', '#c026d3', '#e11d48',
  '#ffffff', '#f3f4f6', '#fef2f2', '#fff7ed',
  '#fefce8', '#f0fdf4', '#ecfeff', '#eff6ff',
];

const BG_COLORS = [
  '#ffffff', '#fef2f2', '#fff7ed', '#fefce8',
  '#f0fdf4', '#ecfeff', '#eff6ff', '#f5f3ff',
  '#fdf2f8', '#f1f5f9', '#fef9c3', '#d1fae5',
  '#bae6fd', '#c7d2fe', '#e9d5ff', '#fbcfe8',
  '#fecaca', '#fed7aa', '#fde68a', '#bbf7d0',
  '#a5f3fc', '#93c5fd', '#a5b4fc', '#d8b4fe',
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Tahoma', value: 'Tahoma' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];

const ToolbarButton = ({ onClick, active, disabled, title, children, className = '' }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-md transition-all duration-150 ${
      active ? 'bg-indigo-100 text-indigo-700 shadow-sm' :
      disabled ? 'text-slate-300 cursor-not-allowed' :
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    } ${className}`}
  >
    {children}
  </button>
);

const ToolbarDivider = () => <div className="w-px h-6 bg-slate-200 mx-0.5 flex-shrink-0" />;

const ColorGrid = ({ colors, onSelect, activeColor }: { colors: string[]; onSelect: (c: string) => void; activeColor?: string }) => (
  <div className="grid grid-cols-8 gap-1 p-2">
    {colors.map(c => (
      <button
        key={c}
        onClick={() => onSelect(c)}
        className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
          activeColor === c ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'
        }`}
        style={{ backgroundColor: c }}
        title={c}
      />
    ))}
  </div>
);

const FontSizeExtension = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

const RichTextEditor: React.FC<RichTextEditorProps> = ({ label, value, onChange, placeholder, isPageMode = false, minHeight, onUploadImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFontColor, setShowFontColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const fontColorRef = useRef<HTMLDivElement>(null);
  const bgColorRef = useRef<HTMLDivElement>(null);
  const fontFamilyRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  // The editor's paste/drop handlers are baked in at construction time
  // and capture the closure of `addImage`. We stash the latest version on
  // a ref so the handlers can call into it without re-creating the editor.
  const addImageRef = useRef<((file: File) => Promise<void>) | null>(null);
  const onUploadImageRef = useRef(onUploadImage);
  useEffect(() => { onUploadImageRef.current = onUploadImage; }, [onUploadImage]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fontColorRef.current && !fontColorRef.current.contains(e.target as Node)) setShowFontColor(false);
      if (bgColorRef.current && !bgColorRef.current.contains(e.target as Node)) setShowBgColor(false);
      if (fontFamilyRef.current && !fontFamilyRef.current.contains(e.target as Node)) setShowFontFamily(false);
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) setShowFontSize(false);
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) setShowTableMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      FontSizeExtension,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true, handleWidth: 5, cellMinWidth: 50 }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
      FontFamily,
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: `outline-none prose prose-slate max-w-none ${minHeight ? '' : 'min-h-[300px]'} p-6 text-base leading-relaxed ${
          isPageMode ? 'page-a4 shadow-2xl ring-1 ring-slate-200 mb-20' : ''
        }`,
        style: minHeight ? `min-height: ${minHeight}` : undefined,
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !onUploadImageRef.current) return false;
        const files: File[] = [];
        for (let i = 0; i < items.length; i += 1) {
          const it = items[i];
          if (it.kind === 'file' && it.type.startsWith('image/')) {
            const f = it.getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => { addImageRef.current?.(f); });
        return true;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        if (!dt || !onUploadImageRef.current) return false;
        const files = Array.from(dt.files || []).filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => { addImageRef.current?.(f); });
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentContent = editor.getHTML();
      if (currentContent !== value) {
        editor.commands.setContent(value || '', false);
      }
    }
  }, [value, editor]);

  const insertImage = useCallback(async (compressedDataUrl: string, file?: File) => {
    if (!editor) return;
    let src = compressedDataUrl;
    if (onUploadImage) {
      try {
        src = await onUploadImage(compressedDataUrl, file);
      } catch (err) {
        // Strict mode: when an upload handler is wired up the caller has
        // explicitly opted out of inline data: URIs (e.g. news article
        // bodies), so on failure we surface the error and abort the insert
        // rather than silently embedding a multi-megabyte base64 blob.
        console.error('RichTextEditor: image upload failed; aborting insert', err);
        if (typeof window !== 'undefined') {
          window.alert('Image upload failed. Please check your connection and try again.');
        }
        return;
      }
    }
    editor.chain().focus().setImage({ src }).run();
  }, [editor, onUploadImage]);

  const addImage = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const compressed = await compressImage(file);
      await insertImage(compressed, file);
    } catch {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          await insertImage(e.target.result as string, file);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [editor, insertImage]);

  // Keep the ref pointed at the latest addImage so the editor's paste/drop
  // handlers (which were captured at construction time) stay current.
  useEffect(() => { addImageRef.current = addImage; }, [addImage]);

  // After every change, look for embedded data: image srcs (which can
  // sneak in via Word/Google Docs HTML paste) and swap them for stable
  // uploaded URLs so article HTML never carries gigantic base64 blobs.
  // We track which data URIs are mid-upload so we don't double-process,
  // and which have already failed so a flaky network doesn't make us
  // re-attempt the same upload on every keystroke.
  const inflightUploadsRef = useRef<Set<string>>(new Set());
  const failedUploadsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!editor || !onUploadImage) return;
    let cancelled = false;
    const sweep = async () => {
      const urlsToReplace: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') {
          const src: string = node.attrs?.src || '';
          if (
            src.startsWith('data:image/') &&
            !inflightUploadsRef.current.has(src) &&
            !failedUploadsRef.current.has(src)
          ) {
            urlsToReplace.push(src);
          }
        }
        return true;
      });
      for (const dataUrl of urlsToReplace) {
        if (cancelled) return;
        inflightUploadsRef.current.add(dataUrl);
        try {
          const newSrc = await onUploadImage(dataUrl);
          if (cancelled) return;
          // Walk the doc again and replace every node whose src matches.
          const tr = editor.state.tr;
          let changed = false;
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs?.src === dataUrl) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: newSrc });
              changed = true;
            }
            return true;
          });
          if (changed) editor.view.dispatch(tr);
        } catch (err) {
          console.error('RichTextEditor: pasted image upload failed', err);
          failedUploadsRef.current.add(dataUrl);
          if (typeof window !== 'undefined') {
            // One-time per failed image: tell the writer the pasted picture
            // could not be persisted so they can re-paste / re-upload manually
            // instead of silently shipping a multi-megabyte data: URI in the
            // article body.
            window.alert('A pasted image could not be uploaded and will be removed from the body. Please try inserting it again with the toolbar image button.');
          }
          // Strip the unresolved data: image from the document so the saved
          // article HTML never carries the base64 blob.
          const tr = editor.state.tr;
          let stripped = false;
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs?.src === dataUrl) {
              tr.delete(pos, pos + node.nodeSize);
              stripped = true;
              return false;
            }
            return true;
          });
          if (stripped) editor.view.dispatch(tr);
        } finally {
          inflightUploadsRef.current.delete(dataUrl);
        }
      }
    };
    const off = () => editor.off('update', sweep);
    editor.on('update', sweep);
    sweep();
    return () => { cancelled = true; off(); };
  }, [editor, onUploadImage]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [addImage]);

  const insertLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const setFontSize = useCallback((size: string) => {
    if (!editor) return;
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
    setShowFontSize(false);
  }, [editor]);

  if (!editor) return null;

  const closeAllDropdowns = () => {
    setShowFontColor(false);
    setShowBgColor(false);
    setShowFontFamily(false);
    setShowFontSize(false);
    setShowTableMenu(false);
  };

  return (
    <div className={`flex flex-col h-full ${isPageMode ? 'bg-transparent' : 'bg-white'} relative transition-colors duration-500`}>
      {label && <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 px-4 pt-4">{label}</label>}

      <div className={`flex flex-col flex-1 overflow-hidden ${isPageMode ? '' : 'border-2 border-slate-100 rounded-2xl mx-4 mb-4'} ${editor.isFocused && !isPageMode ? 'border-indigo-500 ring-4 ring-indigo-50' : ''}`}>
        {!isPageMode && (
          <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
            <div className="flex flex-wrap items-center gap-0.5 p-1.5 select-none overflow-x-auto hide-scrollbar">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                <Undo2 size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                <Redo2 size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <div ref={fontFamilyRef} className="relative">
                <button
                  onClick={() => { closeAllDropdowns(); setShowFontFamily(!showFontFamily); }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100 transition-colors min-w-[90px]"
                  title="Font Family"
                >
                  <Type size={13} />
                  <span className="truncate text-[11px]">
                    {FONT_FAMILIES.find(f => f.value && editor.isActive('textStyle', { fontFamily: f.value }))?.label || 'Font'}
                  </span>
                  <ChevronDown size={10} />
                </button>
                {showFontFamily && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-48 max-h-52 overflow-y-auto">
                    {FONT_FAMILIES.map(f => (
                      <button
                        key={f.value || 'default'}
                        onClick={() => {
                          if (f.value) editor.chain().focus().setFontFamily(f.value).run();
                          else editor.chain().focus().unsetFontFamily().run();
                          setShowFontFamily(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        style={{ fontFamily: f.value || 'inherit' }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={fontSizeRef} className="relative">
                <button
                  onClick={() => { closeAllDropdowns(); setShowFontSize(!showFontSize); }}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100 transition-colors min-w-[55px]"
                  title="Font Size"
                >
                  <span className="text-[11px]">
                    {editor.getAttributes('textStyle').fontSize || '16px'}
                  </span>
                  <ChevronDown size={10} />
                </button>
                {showFontSize && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-24 max-h-52 overflow-y-auto">
                    {FONT_SIZES.map(s => (
                      <button
                        key={s}
                        onClick={() => setFontSize(s)}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <ToolbarDivider />

              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                <Bold size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                <Italic size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                <UnderlineIcon size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                <Strikethrough size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <div ref={fontColorRef} className="relative">
                <ToolbarButton
                  onClick={() => { closeAllDropdowns(); setShowFontColor(!showFontColor); }}
                  active={showFontColor}
                  title="Text Color"
                >
                  <div className="flex flex-col items-center">
                    <Palette size={14} />
                    <div className="w-4 h-0.5 mt-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }} />
                  </div>
                </ToolbarButton>
                {showFontColor && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-56">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Text Color</div>
                    <ColorGrid colors={FONT_COLORS} onSelect={(c) => { editor.chain().focus().setColor(c).run(); setShowFontColor(false); }} activeColor={editor.getAttributes('textStyle').color} />
                    <button onClick={() => { editor.chain().focus().unsetColor().run(); setShowFontColor(false); }} className="w-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100">
                      Reset Color
                    </button>
                  </div>
                )}
              </div>

              <div ref={bgColorRef} className="relative">
                <ToolbarButton
                  onClick={() => { closeAllDropdowns(); setShowBgColor(!showBgColor); }}
                  active={showBgColor}
                  title="Highlight Color"
                >
                  <Highlighter size={15} />
                </ToolbarButton>
                {showBgColor && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-56">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Highlight Color</div>
                    <ColorGrid colors={BG_COLORS} onSelect={(c) => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowBgColor(false); }} />
                    <button onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowBgColor(false); }} className="w-full px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100">
                      Remove Highlight
                    </button>
                  </div>
                )}
              </div>

              <ToolbarDivider />

              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
                <Heading1 size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
                <Heading2 size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
                <Heading3 size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                <List size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
                <ListOrdered size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
                <Quote size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
                <Code size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
                <AlignLeft size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
                <AlignCenter size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
                <AlignRight size={15} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
                <AlignJustify size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <ToolbarButton onClick={insertLink} active={editor.isActive('link')} title="Insert Link">
                <Link2 size={15} />
              </ToolbarButton>
              {editor.isActive('link') && (
                <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
                  <Unlink size={15} />
                </ToolbarButton>
              )}
              <ToolbarButton onClick={handleImageUpload} title="Insert Image">
                <ImageIcon size={15} />
              </ToolbarButton>

              <ToolbarDivider />

              <div ref={tableMenuRef} className="relative">
                <ToolbarButton
                  onClick={() => { closeAllDropdowns(); setShowTableMenu(!showTableMenu); }}
                  active={showTableMenu || editor.isActive('table')}
                  title="Table"
                >
                  <TableIcon size={15} />
                </ToolbarButton>
                {showTableMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-52">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">Table</div>
                    {!editor.isActive('table') ? (
                      <div className="p-2">
                        <button
                          onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setShowTableMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                        >
                          <Plus size={14} /> Insert 3×3 Table
                        </button>
                        <button
                          onClick={() => { editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(); setShowTableMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                        >
                          <Plus size={14} /> Insert 2×2 Table
                        </button>
                        <button
                          onClick={() => { editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run(); setShowTableMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors"
                        >
                          <Plus size={14} /> Insert 4×4 Table
                        </button>
                      </div>
                    ) : (
                      <div className="p-1">
                        <button onClick={() => { editor.chain().focus().addRowBefore().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <ArrowUpToLine size={13} /> Add Row Above
                        </button>
                        <button onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <ArrowDownToLine size={13} /> Add Row Below
                        </button>
                        <button onClick={() => { editor.chain().focus().addColumnBefore().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <ArrowLeftToLine size={13} /> Add Column Left
                        </button>
                        <button onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <ArrowRightToLine size={13} /> Add Column Right
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Minus size={13} /> Delete Row
                        </button>
                        <button onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Minus size={13} /> Delete Column
                        </button>
                        <button onClick={() => { editor.chain().focus().mergeCells().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <Rows2 size={13} /> Merge Cells
                        </button>
                        <button onClick={() => { editor.chain().focus().splitCell().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <Columns2 size={13} /> Split Cell
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded transition-colors">
                          <TableProperties size={13} /> Toggle Header Row
                        </button>
                        <button onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} /> Delete Table
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ToolbarDivider />

              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
                <MoreHorizontal size={15} />
              </ToolbarButton>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageFileChange}
          className="hidden"
        />

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${isPageMode ? 'py-1 flex justify-center' : ''}`}>
          <EditorContent editor={editor} className="tiptap-editor h-full" />
        </div>
      </div>

      <style jsx global>{`
        .tiptap-editor .ProseMirror {
          outline: none;
        }
        .tiptap-editor .ProseMirror > * + * {
          margin-top: 0.5em;
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .tiptap-editor .ProseMirror h1 { font-size: 1.75em; font-weight: 700; color: #1e293b; margin: 1em 0 0.4em; }
        .tiptap-editor .ProseMirror h2 { font-size: 1.4em; font-weight: 600; color: #334155; margin: 0.8em 0 0.3em; }
        .tiptap-editor .ProseMirror h3 { font-size: 1.15em; font-weight: 600; color: #475569; margin: 0.7em 0 0.2em; }
        .tiptap-editor .ProseMirror ul, .tiptap-editor .ProseMirror ol { padding-left: 1.5em; }
        .tiptap-editor .ProseMirror ul { list-style-type: disc; }
        .tiptap-editor .ProseMirror ol { list-style-type: decimal; }
        .tiptap-editor .ProseMirror li { margin: 0.2em 0; }
        .tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid #6366f1;
          padding-left: 1em;
          margin: 0.8em 0;
          color: #64748b;
          font-style: italic;
        }
        .tiptap-editor .ProseMirror pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 1em;
          border-radius: 0.5em;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
          overflow-x: auto;
        }
        .tiptap-editor .ProseMirror code {
          background: #f1f5f9;
          padding: 0.15em 0.4em;
          border-radius: 0.25em;
          font-size: 0.9em;
          color: #e11d48;
        }
        .tiptap-editor .ProseMirror pre code {
          background: none;
          color: inherit;
          padding: 0;
        }
        .tiptap-editor .ProseMirror a {
          color: #4f46e5;
          text-decoration: underline;
          cursor: pointer;
        }
        .tiptap-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          margin: 0.5em 0;
          cursor: pointer;
        }
        .tiptap-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 3px solid #6366f1;
          outline-offset: 2px;
        }
        .tiptap-editor .ProseMirror hr {
          border: none;
          border-top: 2px solid #e2e8f0;
          margin: 1.5em 0;
        }
        .tiptap-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          table-layout: fixed;
          overflow: hidden;
        }
        .tiptap-editor .ProseMirror td,
        .tiptap-editor .ProseMirror th {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          min-width: 50px;
          vertical-align: top;
          position: relative;
        }
        .tiptap-editor .ProseMirror th {
          background-color: #f1f5f9;
          font-weight: 600;
          color: #334155;
        }
        .tiptap-editor .ProseMirror .selectedCell::after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(99, 102, 241, 0.1);
          pointer-events: none;
        }
        .tiptap-editor .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: -2px;
          width: 4px;
          background-color: #6366f1;
          pointer-events: none;
        }
        .tiptap-editor .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
        .tiptap-editor .ProseMirror mark {
          border-radius: 2px;
          padding: 0.1em 0.15em;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
