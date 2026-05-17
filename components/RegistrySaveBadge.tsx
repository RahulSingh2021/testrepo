'use client';

import React, { useSyncExternalStore } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import {
  getRegistryState,
  subscribeRegistry,
  retryRegistry,
  keepLocalRegistry,
  reloadRegistry,
} from '@/utils/registrySave';

interface RegistrySaveBadgeProps {
  registryKey: string;
  // Hide the badge entirely when there's nothing to show. Otherwise renders
  // an empty placeholder of the same min-height to keep the layout stable.
  hideWhenIdle?: boolean;
  className?: string;
  label?: string; // optional noun shown in tooltips, e.g. "raw materials"
}

export const RegistrySaveBadge: React.FC<RegistrySaveBadgeProps> = ({
  registryKey,
  hideWhenIdle = false,
  className = '',
  label = 'changes',
}) => {
  const state = useSyncExternalStore(
    React.useCallback((cb) => subscribeRegistry(registryKey, cb), [registryKey]),
    () => getRegistryState(registryKey),
    () => getRegistryState(registryKey),
  );

  if (hideWhenIdle && state.status === 'idle') return null;

  return (
    <div className={`flex items-center min-h-[26px] ${className}`}>
      {state.status === 'saving' && (
        <span
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 border border-sky-200 rounded-lg text-[10px] font-semibold text-sky-700"
          title={`Saving your latest ${label} to the server`}
        >
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Saving…
        </span>
      )}
      {state.status === 'saved' && (
        <span
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-semibold text-emerald-700"
          title={`All ${label} saved to the server`}
        >
          <Check className="w-3 h-3" />
          Saved
        </span>
      )}
      {state.status === 'error' && (
        <button
          onClick={() => retryRegistry(registryKey)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
          title={state.errorMsg ? `Save failed: ${state.errorMsg}. Click to retry.` : 'Save failed. Click to retry.'}
        >
          <RotateCcw className="w-3 h-3" />
          Save failed — Retry
        </button>
      )}
      {state.status === 'conflict' && (
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] font-semibold text-amber-800">
          Newer server version
          <button
            onClick={() => keepLocalRegistry(registryKey)}
            className="ml-1 px-1.5 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
            title={`Overwrite the server with your local ${label}`}
          >
            Keep mine
          </button>
          <button
            onClick={() => reloadRegistry(registryKey)}
            className="px-1.5 py-0.5 bg-white border border-amber-300 text-amber-800 rounded hover:bg-amber-100 transition-colors"
            title={`Discard local edits and reload ${label} from server`}
          >
            Reload
          </button>
        </span>
      )}
    </div>
  );
};

export default RegistrySaveBadge;
