"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import ChecklistEditor from './ChecklistEditor';
import type { ChecklistTemplate } from './AuditChecklistCreator';
import type { HierarchyScope, Entity, MandatoryProtocol } from '../types';

interface RMChecklistModuleProps {
  entities?: Entity[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  userName?: string;
  departmentNames?: string[];
}

const RMChecklistModule: React.FC<RMChecklistModuleProps> = ({
  entities = [],
  currentScope,
  userRootId,
  userName,
  departmentNames = [],
}) => {
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  const getEntityHierarchy = useCallback((): string[] => {
    if (!userRootId) return [];
    const hierarchy: string[] = [userRootId];
    let current = entities.find(e => e.id === userRootId);
    while (current?.parentId) {
      hierarchy.push(current.parentId);
      current = entities.find(e => e.id === current!.parentId);
    }
    return hierarchy;
  }, [userRootId, entities]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let url = '/api/rm-checklists';
        if (userRootId) {
          const hierarchy = getEntityHierarchy();
          url = `/api/rm-checklists?entityId=${encodeURIComponent(userRootId)}&entityHierarchy=${encodeURIComponent(hierarchy.join(','))}`;
        }
        const resp = await fetch(url);
        if (!cancelled && resp.ok) {
          const data = await resp.json();
          setChecklists(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load RM checklists:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userRootId, getEntityHierarchy]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/rm-checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checklists),
        });
      } catch (err) {
        console.error('Failed to save RM checklists:', err);
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [checklists]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-sm font-medium">Loading RM Checklist Forms...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">Raw Material Checklist Form</h2>
          <p className="text-xs text-slate-500">Create and manage inspection checklists for raw materials</p>
        </div>
      </div>

      <ChecklistEditor
        protocols={[] as MandatoryProtocol[]}
        departmentNames={departmentNames}
        entities={entities}
        checklists={checklists}
        setChecklists={setChecklists}
        externalSync
        currentScope={currentScope}
        userRootId={userRootId}
        userName={userName}
        scheduledChecklistIds={new Set<string>()}
        directAssignChecklistIds={new Set<string>()}
        observationChecklistIds={new Set<string>()}
      />
    </div>
  );
};

export default RMChecklistModule;
