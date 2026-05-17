// Per-user recent-searches history for the External nutrition lookup
// (NIN / Japan MEXT / Korea KFCT / UK CoFID / USDA / FSANZ).
//
// Stored in localStorage under a key scoped by logged-in user email + tenant
// scope so different users on the same browser profile don't see each
// other's history. The list is shared across every external-lookup entry
// point (Recipe Studio's red-flag panel and the recipe-row inline-swap
// popover) so a search from one place shows up in the other.
//
// Constraints:
//   * Most-recent first.
//   * Case-insensitive de-duplication (a re-search of the same term just
//     bumps it to the top instead of producing a second entry).
//   * Capped at MAX_RECENT entries — older entries fall off the end.
//   * Pure browser localStorage; no server sync (per task scope).

const MAX_RECENT = 25;
const KEY_PREFIX = 'haccpRecentExtIngSearches:v1:';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Build the localStorage key for a given user/scope. Falls back to an
 * "anon" bucket when neither identifier is available so anonymous /
 * pre-login states still work (and don't leak into a real user's bucket
 * later because the key changes the moment the user is identified).
 */
export function recentSearchesStorageKey(userEmail: string | undefined | null, currentScope: string | undefined | null): string {
  // Both user and tenant scope are part of the key so the same logged-in
  // email impersonating different tenant scopes (the Act-As feature) sees
  // an isolated history per scope, and switching the active scope can't
  // leak one tenant's recent searches into another.
  const owner = (userEmail || '').trim().toLowerCase() || 'anon';
  const scope = (currentScope || '').trim().toLowerCase() || 'noscope';
  return `${KEY_PREFIX}${owner}|${scope}`;
}

export function getRecentSearches(userEmail: string | undefined | null, currentScope: string | undefined | null): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(recentSearchesStorageKey(userEmail, currentScope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeRecentSearches(userEmail: string | undefined | null, currentScope: string | undefined | null, list: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(recentSearchesStorageKey(userEmail, currentScope), JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Quota / serialization failure — ignore; history is best-effort.
  }
}

/**
 * Record a successful search. Empty / whitespace-only queries are dropped.
 * Existing entries that match case-insensitively are removed and the new
 * entry is unshifted so the most-recent variant (preserving the user's
 * exact casing) wins.
 */
export function addRecentSearch(userEmail: string | undefined | null, currentScope: string | undefined | null, query: string): string[] {
  const trimmed = (query || '').trim();
  if (!trimmed) return getRecentSearches(userEmail, currentScope);
  const lower = trimmed.toLowerCase();
  const current = getRecentSearches(userEmail, currentScope);
  const filtered = current.filter(s => s.toLowerCase() !== lower);
  const next = [trimmed, ...filtered].slice(0, MAX_RECENT);
  writeRecentSearches(userEmail, currentScope, next);
  notifyListeners();
  return next;
}

export function removeRecentSearch(userEmail: string | undefined | null, currentScope: string | undefined | null, query: string): string[] {
  const lower = (query || '').trim().toLowerCase();
  if (!lower) return getRecentSearches(userEmail, currentScope);
  const next = getRecentSearches(userEmail, currentScope).filter(s => s.toLowerCase() !== lower);
  writeRecentSearches(userEmail, currentScope, next);
  notifyListeners();
  return next;
}

export function clearRecentSearches(userEmail: string | undefined | null, currentScope: string | undefined | null): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(recentSearchesStorageKey(userEmail, currentScope));
  } catch {
    // ignore
  }
  notifyListeners();
}

// In-process pub/sub so multiple mounted dropdowns (e.g. one in the
// red-flag panel, one in an inline-swap popover) re-render together when
// one of them mutates the list. localStorage 'storage' events only fire
// across tabs, not within the same document, hence this lightweight
// callback registry.
type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  for (const l of Array.from(listeners)) {
    try { l(); } catch { /* ignore */ }
  }
}

export function subscribeRecentSearches(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export const RECENT_SEARCHES_MAX = MAX_RECENT;
