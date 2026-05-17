// Shared optimistic-save manager for the Raw Materials, Brands and Suppliers
// registries. Mirrors the recipes pattern in components/RecipeCalculation.tsx:
//   * Tracks the last server `updated_at` we know about (per registry key)
//   * Sends it back on every POST as `x-known-updated-at`
//   * Treats HTTP 409 as a conflict (server has a newer version) and surfaces
//     a `Keep mine` / `Reload` choice to the user.
//   * Auto-retries transient errors with capped exponential backoff (2s/4s/8s).
//   * Exposes a manual retry from the badge.
//
// One module-level singleton keeps state per `key` (e.g. 'raw-materials',
// 'brands', 'suppliers') so the badge can render in any subtree without
// prop-drilling.

export type RegistrySaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface RegistrySaveState {
  status: RegistrySaveStatus;
  errorMsg: string | null;
  conflictServerAt: string | null;
  knownUpdatedAt: string | null;
}

type Listener = () => void;

interface PendingSave {
  endpoint: string;
  init: RequestInit; // built without conflict headers; manager injects them
  // Optional helper that returns the freshest payload at retry time so a
  // late retry persists current local edits, not the snapshot the failing
  // save was originally invoked with.
  getLatestBody?: () => unknown;
}

interface RegistryEntry {
  state: RegistrySaveState;
  listeners: Set<Listener>;
  pending: PendingSave | null;
  attempt: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  savedHideTimer: ReturnType<typeof setTimeout> | null;
  reloadHandler: (() => void | Promise<void>) | null;
}

const INITIAL_STATE: RegistrySaveState = {
  status: 'idle',
  errorMsg: null,
  conflictServerAt: null,
  knownUpdatedAt: null,
};

const registries = new Map<string, RegistryEntry>();

function getEntry(key: string): RegistryEntry {
  let e = registries.get(key);
  if (!e) {
    e = {
      state: { ...INITIAL_STATE },
      listeners: new Set(),
      pending: null,
      attempt: 0,
      retryTimer: null,
      savedHideTimer: null,
      reloadHandler: null,
    };
    registries.set(key, e);
  }
  return e;
}

function setState(key: string, patch: Partial<RegistrySaveState>) {
  const e = getEntry(key);
  e.state = { ...e.state, ...patch };
  for (const l of e.listeners) l();
}

function clearTimers(e: RegistryEntry) {
  if (e.retryTimer) { clearTimeout(e.retryTimer); e.retryTimer = null; }
  if (e.savedHideTimer) { clearTimeout(e.savedHideTimer); e.savedHideTimer = null; }
}

async function executePost(key: string, override: boolean): Promise<void> {
  const e = getEntry(key);
  const pending = e.pending;
  if (!pending) return;

  // Always re-derive the body from the freshest local state if the caller
  // provided a getter — protects late retries from persisting stale data.
  const body = pending.getLatestBody ? pending.getLatestBody() : (pending.init.body
    ? JSON.parse(typeof pending.init.body === 'string' ? pending.init.body : '[]')
    : undefined);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(pending.init.headers as Record<string, string> | undefined),
  };
  if (e.state.knownUpdatedAt) headers['x-known-updated-at'] = e.state.knownUpdatedAt;
  if (override) headers['x-allow-override'] = 'yes';

  setState(key, { status: 'saving', errorMsg: null });

  try {
    const res = await fetch(pending.endpoint, {
      ...pending.init,
      method: pending.init.method || 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      let serverUpdatedAt: string | null = null;
      try { serverUpdatedAt = (await res.json())?.serverUpdatedAt || null; } catch {}
      e.attempt = 0;
      setState(key, { status: 'conflict', conflictServerAt: serverUpdatedAt, errorMsg: null });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let serverUpdatedAt: string | null = null;
    try { serverUpdatedAt = (await res.json())?.serverUpdatedAt || null; } catch {}
    e.attempt = 0;
    e.pending = null;
    setState(key, {
      status: 'saved',
      errorMsg: null,
      conflictServerAt: null,
      knownUpdatedAt: serverUpdatedAt || e.state.knownUpdatedAt,
    });
    if (e.savedHideTimer) clearTimeout(e.savedHideTimer);
    e.savedHideTimer = setTimeout(() => {
      if (getEntry(key).state.status === 'saved') setState(key, { status: 'idle' });
    }, 2000);
  } catch (err: any) {
    const msg = err?.message || 'Network error';
    e.attempt += 1;
    setState(key, { status: 'error', errorMsg: msg });
    if (e.attempt < 3) {
      const delay = Math.min(8000, 2000 * Math.pow(2, e.attempt - 1));
      if (e.retryTimer) clearTimeout(e.retryTimer);
      e.retryTimer = setTimeout(() => { void executePost(key, false); }, delay);
    }
  }
}

export function postRegistry(
  key: string,
  endpoint: string,
  body: unknown,
  opts?: { method?: string; getLatestBody?: () => unknown },
): Promise<void> {
  const e = getEntry(key);
  clearTimers(e);
  e.attempt = 0;
  e.pending = {
    endpoint,
    init: {
      method: opts?.method || 'POST',
      body: JSON.stringify(body),
    },
    getLatestBody: opts?.getLatestBody,
  };
  return executePost(key, false);
}

export function retryRegistry(key: string): void {
  const e = getEntry(key);
  if (!e.pending) return;
  clearTimers(e);
  e.attempt = 0;
  void executePost(key, false);
}

export function keepLocalRegistry(key: string): void {
  const e = getEntry(key);
  if (!e.pending) return;
  clearTimers(e);
  e.attempt = 0;
  // Adopt the server's reported timestamp so the override POST passes the
  // optimistic guard cleanly (and any subsequent saves use the new baseline).
  if (e.state.conflictServerAt) {
    setState(key, { knownUpdatedAt: e.state.conflictServerAt });
  }
  void executePost(key, true);
}

export function reloadRegistry(key: string): void {
  const e = getEntry(key);
  clearTimers(e);
  e.attempt = 0;
  e.pending = null;
  setState(key, { status: 'idle', errorMsg: null, conflictServerAt: null });
  if (e.reloadHandler) void e.reloadHandler();
}

export function setReloadHandler(key: string, fn: (() => void | Promise<void>) | null): void {
  getEntry(key).reloadHandler = fn;
}

// Update the freshest server timestamp we know about. Called by the loader
// after fetching rows (walks `_updatedAt` per row and records the max), and
// also after cross-tab sync events. POSTs after this point will replay the
// new value as `x-known-updated-at` to dodge stale-conflict false positives.
export function noteServerUpdatedAt(key: string, iso: string | null | undefined): void {
  if (!iso) return;
  const e = getEntry(key);
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return;
  const prev = e.state.knownUpdatedAt ? new Date(e.state.knownUpdatedAt).getTime() : 0;
  if (t > prev) setState(key, { knownUpdatedAt: new Date(t).toISOString() });
}

export function noteMaxFromRecords(key: string, records: any[] | null | undefined): void {
  if (!Array.isArray(records)) return;
  let max = 0;
  for (const r of records) {
    const t = r && r._updatedAt ? new Date(r._updatedAt).getTime() : 0;
    if (Number.isFinite(t) && t > max) max = t;
  }
  if (max > 0) noteServerUpdatedAt(key, new Date(max).toISOString());
}

export function getRegistryState(key: string): RegistrySaveState {
  return getEntry(key).state;
}

export function subscribeRegistry(key: string, listener: Listener): () => void {
  const e = getEntry(key);
  e.listeners.add(listener);
  return () => { e.listeners.delete(listener); };
}
