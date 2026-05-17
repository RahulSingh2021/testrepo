"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EntityLite {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  email?: string;
}

interface LegacyRecipe {
  id: number;
  name?: string;
  unitName?: string;
  regionalName?: string;
  corporateName?: string;
  location?: string;
  _ownerId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entities: EntityLite[];
  // Called after a successful reassignment so the parent can refetch.
  onReassigned?: () => void;
}

const LegacyRecipesMigrator: React.FC<Props> = ({ open, onClose, entities, onReassigned }) => {
  const [rows, setRows] = useState<LegacyRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetEntityId, setTargetEntityId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const adminToken = (typeof window !== 'undefined' && window.localStorage.getItem('admin_session_token')) || '';

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setFlash(null);
    setError(null);
    setLoading(true);
    fetch('/api/recipes/reassign', { headers: { 'x-admin-token': adminToken } })
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 401 ? 'Unauthorized — sign in again as super-admin.' : `Failed to load (${r.status}).`);
          setRows([]); return;
        }
        const data = await r.json();
        setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => setError('Network error loading legacy recipes.'))
      .finally(() => setLoading(false));
  }, [open, adminToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.unitName || '').toLowerCase().includes(q) ||
      (r.location || '').toLowerCase().includes(q) ||
      (r.corporateName || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // Sorted entity options grouped by type for the assignment dropdown.
  const entityOptions = useMemo(() => {
    const sorted = [...(entities || [])].sort((a, b) => {
      const order = ['corporate', 'regional', 'unit', 'department', 'super-admin'];
      const ai = order.indexOf(a.type); const bi = order.indexOf(b.type);
      if (ai !== bi) return ai - bi;
      return (a.name || '').localeCompare(b.name || '');
    });
    return sorted;
  }, [entities]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  // Suggest the most likely target by matching the unitName of the first
  // selected row to an entity name (case-insensitive).
  const suggestTarget = () => {
    if (!selected.size) return;
    const first = rows.find(r => selected.has(r.id));
    if (!first) return;
    const want = (first.unitName || first.location || '').toLowerCase().trim();
    if (!want) return;
    const match = entityOptions.find(e => e.name.toLowerCase() === want);
    if (match) setTargetEntityId(match.id);
  };

  const reassign = async () => {
    if (!targetEntityId) { setError('Pick a target entity first.'); return; }
    if (selected.size === 0) { setError('Select at least one recipe.'); return; }
    const target = entityOptions.find(e => e.id === targetEntityId);
    if (!target) { setError('Target entity not found.'); return; }
    // Owner key precedence mirrors RecipeCalculation: prefer email, fall back
    // to entity id. This must match what the unit user passes when fetching,
    // otherwise the reassigned rows would still appear orphaned.
    const newOwner = (target.email && target.email.toLowerCase()) || target.id;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recipes/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ ids: Array.from(selected), newOwner }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? 'Unauthorized — sign in again as super-admin.' : `Reassign failed (${res.status}).`);
        return;
      }
      const j = await res.json();
      setFlash(`Reassigned ${j.count ?? selected.size} recipe(s) to ${target.name}.`);
      // Refresh local list so reassigned rows disappear from the legacy view.
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      onReassigned?.();
    } catch {
      setError('Network error during reassignment.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl max-h-[88vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b bg-amber-50">
          <div>
            <div className="text-sm font-black text-amber-900">Legacy Recipe Migrator</div>
            <div className="text-[11px] text-amber-700">
              Recipes still owned by the legacy <code className="bg-white/70 px-1 rounded">'unknown'</code> bucket. Assign each to its real entity so unit users see them again.
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center px-5 py-3 border-b bg-slate-50">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name / unit / location"
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg bg-white"
            />
          </div>
          <select
            value={targetEntityId}
            onChange={e => setTargetEntityId(e.target.value)}
            className="px-3 py-2 text-sm border rounded-lg bg-white min-w-[220px]"
          >
            <option value="">— Assign selected to entity —</option>
            {entityOptions.map(e => (
              <option key={e.id} value={e.id}>{e.type}: {e.name}</option>
            ))}
          </select>
          <button
            onClick={suggestTarget}
            disabled={selected.size === 0}
            className="px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-100 border rounded-lg disabled:opacity-40"
            title="Pick the entity whose name matches the selected recipe's unitName"
          >
            Suggest from name
          </button>
          <button
            onClick={reassign}
            disabled={busy || selected.size === 0 || !targetEntityId}
            className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40 flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Reassign {selected.size || ''}
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />{error}
          </div>
        )}
        {flash && (
          <div className="mx-5 mt-3 px-3 py-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />{flash}
          </div>
        )}

        <div className="flex-1 overflow-auto px-5 py-3">
          {loading ? (
            <div className="text-center text-sm text-slate-500 py-12 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading legacy recipes…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-12">
              No legacy recipes {search ? 'match your search' : 'remain — everything is properly owned'}.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white border-b">
                <tr className="text-left text-slate-600">
                  <th className="py-2 px-2 w-8">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="py-2 px-2">Recipe</th>
                  <th className="py-2 px-2">Unit Name</th>
                  <th className="py-2 px-2">Region</th>
                  <th className="py-2 px-2">Corporate</th>
                  <th className="py-2 px-2">Location</th>
                  <th className="py-2 px-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className={`border-b hover:bg-slate-50 ${selected.has(r.id) ? 'bg-amber-50' : ''}`}>
                    <td className="py-1.5 px-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                    <td className="py-1.5 px-2 font-semibold">{r.name || <span className="text-slate-400">(untitled)</span>}</td>
                    <td className="py-1.5 px-2">{r.unitName || ''}</td>
                    <td className="py-1.5 px-2">{r.regionalName || ''}</td>
                    <td className="py-1.5 px-2">{r.corporateName || ''}</td>
                    <td className="py-1.5 px-2">{r.location || ''}</td>
                    <td className="py-1.5 px-2 text-slate-400">{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-2 border-t bg-slate-50 text-[11px] text-slate-500">
          Tip: select rows belonging to one unit, click <em>Suggest from name</em> to pick the right entity, then <em>Reassign</em>. Repeat per unit.
        </div>
      </div>
    </div>
  );
};

export default LegacyRecipesMigrator;
