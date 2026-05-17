import { useEffect, useState } from 'react';

// Lazy, in-process memoised hook for fetching Google-scraped aliases
// and spell-corrections for an ingredient name. Backed by the
// /api/ingredient-aliases endpoint (which is itself DB-cached for ~1
// year), so calls are cheap after the first hit.
//
// The in-process map below dedupes simultaneous mounts within a single
// page session — without it, a list of 50 ingredient cards would all
// fire their own request even when several share the same name.

export interface IngredientAliasInfo {
  aliases: string[];
  corrected: string | null;
  loading: boolean;
}

const memo = new Map<string, { aliases: string[]; corrected: string | null }>();
const inflight = new Map<string, Promise<{ aliases: string[]; corrected: string | null }>>();

async function fetchAliases(name: string): Promise<{ aliases: string[]; corrected: string | null }> {
  const key = name.trim().toLowerCase();
  if (!key || key.length < 2) return { aliases: [], corrected: null };
  const hit = memo.get(key);
  if (hit) return hit;
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(`/api/ingredient-aliases?name=${encodeURIComponent(name.trim())}`);
        if (!res.ok) return { aliases: [], corrected: null };
        const json = await res.json();
        return {
          aliases: Array.isArray(json?.aliases) ? json.aliases.slice(0, 5) : [],
          corrected: typeof json?.corrected === 'string' && json.corrected.trim() ? json.corrected.trim() : null,
        };
      } catch {
        return { aliases: [], corrected: null };
      }
    })().then(result => {
      memo.set(key, result);
      inflight.delete(key);
      return result;
    });
    inflight.set(key, pending);
  }
  return pending;
}

export function useIngredientAliases(name: string | undefined | null): IngredientAliasInfo {
  const trimmed = (name || '').trim();
  const [state, setState] = useState<IngredientAliasInfo>(() => {
    const hit = memo.get(trimmed.toLowerCase());
    if (hit) return { ...hit, loading: false };
    return { aliases: [], corrected: null, loading: trimmed.length >= 2 };
  });

  useEffect(() => {
    let cancelled = false;
    if (!trimmed || trimmed.length < 2) {
      setState({ aliases: [], corrected: null, loading: false });
      return;
    }
    const hit = memo.get(trimmed.toLowerCase());
    if (hit) {
      setState({ ...hit, loading: false });
      return;
    }
    setState(s => ({ ...s, loading: true }));
    fetchAliases(trimmed).then(result => {
      if (cancelled) return;
      setState({ ...result, loading: false });
    });
    return () => { cancelled = true; };
  }, [trimmed]);

  return state;
}
