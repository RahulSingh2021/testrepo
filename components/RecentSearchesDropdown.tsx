import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Clock, X, Trash2 } from 'lucide-react';
import {
  getRecentSearches,
  removeRecentSearch,
  clearRecentSearches,
  subscribeRecentSearches,
} from '@/utils/recentExternalSearches';

interface Props {
  userEmail: string | undefined | null;
  currentScope: string | undefined | null;
  // Current text in the search input. Used to filter the recent list as
  // the user types.
  query: string;
  // True when the dropdown should be visible (input is focused). Parent
  // controls visibility so it can also react to outside clicks / Esc.
  open: boolean;
  // Pick a recent term — should fill the input AND trigger the lookup
  // immediately (the parent owns both pieces of state).
  onPick: (term: string) => void;
  // Close request from the dropdown (Esc inside an item, "Clear all" tap
  // when list becomes empty, etc.). Parent decides whether to honour it.
  onClose?: () => void;
  // Compact size variant for tight popovers (inline-swap). Default sizing
  // matches the wider master-api-fill panel.
  size?: 'normal' | 'compact';
  // Optional className applied to the absolutely-positioned wrapper so
  // callers can tune positioning per host (e.g. top offset).
  className?: string;
}

const RecentSearchesDropdown: React.FC<Props> = ({
  userEmail,
  currentScope,
  query,
  open,
  onPick,
  onClose,
  size = 'normal',
  className = '',
}) => {
  const [items, setItems] = useState<string[]>(() => getRecentSearches(userEmail, currentScope));
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  // Reload from storage whenever the owner key changes or another mounted
  // dropdown mutates the list.
  useEffect(() => {
    setItems(getRecentSearches(userEmail, currentScope));
    const off = subscribeRecentSearches(() => {
      setItems(getRecentSearches(userEmail, currentScope));
    });
    return off;
  }, [userEmail, currentScope]);

  // Dismiss the dropdown when the user mousedowns outside of it AND
  // outside its anchoring input. The dropdown sits inside the input's
  // parent `.relative` wrapper, so we check the wrapper element to cover
  // both. Only attached while the dropdown is open to keep the listener
  // count bounded.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const anchor = wrap.parentElement; // the `.relative` containing the input
      if (wrap.contains(target)) return;
      if (anchor && anchor.contains(target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleRemove = useCallback((term: string) => {
    const next = removeRecentSearch(userEmail, currentScope, term);
    setItems(next);
  }, [userEmail, currentScope]);

  const handleClearAll = useCallback(() => {
    clearRecentSearches(userEmail, currentScope);
    setItems([]);
    onClose?.();
  }, [userEmail, currentScope, onClose]);

  const trimmedQuery = (query || '').trim().toLowerCase();
  const filtered = trimmedQuery
    ? items.filter(s => s.toLowerCase().includes(trimmedQuery))
    : items;

  // Reset / clamp the highlight whenever the visible list changes (filter
  // changed, new items loaded, or the dropdown was just opened).
  useEffect(() => {
    if (!open || filtered.length === 0) {
      setHighlightIndex(-1);
      return;
    }
    setHighlightIndex(prev => {
      if (prev < 0) return -1; // start with nothing highlighted; first ArrowDown picks index 0
      if (prev >= filtered.length) return filtered.length - 1;
      return prev;
    });
  }, [open, filtered.length]);

  // Keyboard navigation: Up/Down move the highlight, Enter picks the
  // highlighted recent term, Esc closes the dropdown without unfocusing
  // the input. Listener is attached at the document level (capture phase)
  // so it intercepts the input's own key handling — but only while the
  // dropdown is actually open with results.
  useEffect(() => {
    if (!open || filtered.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex(prev => {
          const next = prev < 0 ? 0 : (prev + 1) % filtered.length;
          requestAnimationFrame(() => itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex(prev => {
          const next = prev <= 0 ? filtered.length - 1 : prev - 1;
          requestAnimationFrame(() => itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }));
          return next;
        });
      } else if (e.key === 'Enter') {
        if (highlightIndex >= 0 && highlightIndex < filtered.length) {
          e.preventDefault();
          onPick(filtered[highlightIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, filtered, highlightIndex, onPick, onClose]);

  if (!open) return null;
  if (filtered.length === 0) return null;

  const isCompact = size === 'compact';

  return (
    <div
      ref={wrapperRef}
      className={`absolute z-[60] left-0 right-0 top-full mt-1 bg-white border border-violet-200 rounded-lg shadow-2xl overflow-hidden ${className}`}
      onMouseDown={(e) => {
        // Prevent the input's blur from firing before our click handlers
        // run — otherwise the dropdown would unmount before onPick.
        e.preventDefault();
      }}
    >
      <div className={`flex items-center justify-between ${isCompact ? 'px-2 py-1' : 'px-2.5 py-1.5'} bg-violet-50/70 border-b border-violet-100`}>
        <div className="flex items-center gap-1.5">
          <Clock className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-violet-600`} />
          <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} font-bold text-violet-700 uppercase tracking-wider`}>Recent searches</span>
        </div>
        <span className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} text-violet-500 font-medium`}>{filtered.length}</span>
      </div>
      <ul className={`${isCompact ? 'max-h-[180px]' : 'max-h-[240px]'} overflow-y-auto`}>
        {filtered.map((term, idx) => (
          <li
            key={term}
            ref={(el) => { itemRefs.current[idx] = el; }}
            onMouseEnter={() => setHighlightIndex(idx)}
            className={`flex items-center justify-between gap-1 transition-colors border-b border-violet-50 last:border-b-0 ${highlightIndex === idx ? 'bg-violet-100' : 'hover:bg-violet-50'}`}
          >
            <button
              type="button"
              onClick={() => onPick(term)}
              className={`flex-1 min-w-0 text-left ${isCompact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} text-slate-700 truncate`}
              title={`Search "${term}" again`}
            >
              {term}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleRemove(term); }}
              className={`flex-shrink-0 ${isCompact ? 'p-1 mr-0.5' : 'p-1 mr-1'} text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors`}
              title="Remove from history"
              aria-label={`Remove ${term} from recent searches`}
            >
              <X className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleClearAll}
        className={`w-full flex items-center justify-center gap-1 ${isCompact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1.5 text-[10px]'} font-semibold text-rose-600 hover:bg-rose-50 border-t border-violet-100 transition-colors`}
      >
        <Trash2 className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        Clear all
      </button>
    </div>
  );
};

export default RecentSearchesDropdown;
