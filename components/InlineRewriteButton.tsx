"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { generateRewriteOptions, offlineRewriteMulti, type RewriteOption } from '@/utils/aiRewrite';

const InlineRewriteButton = ({
  text,
  onSelect,
}: {
  text: string;
  onSelect: (rewritten: string) => void;
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [options, setOptions] = useState<RewriteOption[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closePanel = useCallback(() => {
    setShowPanel(false);
    setOptions([]);
  }, []);

  useEffect(() => {
    if (!showPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        closePanel();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showPanel, closePanel]);

  const handleGenerate = async () => {
    if (!text.trim() || isGenerating) return;
    setIsGenerating(true);
    setShowPanel(true);
    setOptions([]);
    try {
      const result = await generateRewriteOptions(text);
      setOptions(result);
    } catch {
      const fallback = offlineRewriteMulti(text);
      setOptions(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelect = (opt: string) => {
    onSelect(opt);
    closePanel();
  };

  const computePosition = () => {
    const btn = btnRef.current;
    if (!btn) return { bottom: 0, left: 0 };
    const rect = btn.getBoundingClientRect();
    const panelH = 340;
    const panelW = 320;
    let left = Math.min(rect.left, window.innerWidth - panelW - 8);
    left = Math.max(8, left);
    const spaceAbove = rect.top;
    if (spaceAbove >= panelH) {
      return { bottom: window.innerHeight - rect.top + 8, left, openUp: true };
    }
    return { top: rect.bottom + 8, left, openUp: false };
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleGenerate}
        disabled={!text.trim() || isGenerating}
        title="Rewrite with AI"
        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${showPanel ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-gray-200 text-amber-600 hover:border-amber-400 hover:bg-amber-50'} disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
      </button>
      {showPanel && typeof document !== 'undefined' && (() => {
        const pos = computePosition();
        return createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              ...(('bottom' in pos) ? { bottom: pos.bottom } : { top: (pos as any).top }),
              left: pos.left,
              width: 320,
              zIndex: 10050,
            }}
          >
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-left">
              <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  {isGenerating ? 'Rewriting with AI...' : 'Pick a style'}
                </p>
                {isGenerating && <Loader2 size={12} className="animate-spin text-amber-500" />}
              </div>
              <div className="p-2 max-h-[280px] overflow-y-auto space-y-1">
                {isGenerating ? (
                  <div className="space-y-2 p-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="animate-pulse rounded-xl p-3 bg-slate-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-md bg-slate-200" />
                          <div className="h-3 w-20 rounded bg-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full rounded bg-slate-200" />
                          <div className="h-2.5 w-4/5 rounded bg-slate-200" />
                          <div className="h-2.5 w-3/5 rounded bg-slate-100" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(opt.text)}
                    className="w-full text-left px-3 py-2.5 hover:bg-amber-50 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{opt.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 group-hover:text-amber-700">{opt.label}</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{opt.text}</p>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                <button onClick={() => { setShowPanel(false); setOptions([]); setIsGenerating(false); }} className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
};

export default InlineRewriteButton;
