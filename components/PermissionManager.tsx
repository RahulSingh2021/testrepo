
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Shield, 
  X, 
  ChevronRight, 
  Layout, 
  Lock, 
  Unlock,
  Save,
  RotateCcw,
  Info,
  Search,
  Building2,
  Globe,
  LayoutGrid,
  AlertCircle,
  ShieldOff,
  Settings2,
  Check,
  Briefcase,
  CreditCard
} from 'lucide-react';
import { HierarchyScope, NavItem, Entity, SubNavItem, IndustryType, SubscriptionType } from '../types';
import { SCOPE_CONFIG, INDUSTRY_CONFIGS, SUBSCRIPTION_HIERARCHY } from '../constants';

interface PermissionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  setNavItems: React.Dispatch<React.SetStateAction<NavItem[]>>;
  currentUserScope: HierarchyScope;
  entities: Entity[];
  targetEntityId: string | null;
}

/**
 * PERMISSION MANAGER (Visual Shell)
 * Functional code for updating state has been erased.
 * Design, layout, and visual components remain as a world-class UI shell.
 */
const PermissionManager: React.FC<PermissionManagerProps> = ({ 
  isOpen, 
  onClose, 
  navItems = [],
  currentUserScope,
  entities = [],
  targetEntityId
}) => {
  const manageableScopes = useMemo(() => {
    if (currentUserScope === 'super-admin') return ['corporate', 'regional', 'unit', 'department', 'user'] as HierarchyScope[];
    if (currentUserScope === 'corporate') return ['regional', 'unit', 'department', 'user'] as HierarchyScope[];
    if (currentUserScope === 'regional') return ['unit', 'department', 'user'] as HierarchyScope[];
    return [] as HierarchyScope[];
  }, [currentUserScope]);

  const [activeTab, setActiveTab] = useState<'roles' | 'entities'>(targetEntityId ? 'entities' : 'roles');
  const [activeScope, setActiveScope] = useState<HierarchyScope>(manageableScopes[0] || 'unit'); 
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(targetEntityId);
  const [entitySearch, setEntitySearch] = useState('');
  const [ruleConfigTarget, setRuleConfigTarget] = useState<any>(null);

  if (!isOpen) return null;

  const handleNoOp = () => { console.log("Visual Prototype Action Triggered"); };

  const filteredEntities = entities.filter(e => {
    if (targetEntityId) return e.id === targetEntityId;
    return e.name.toLowerCase().includes(entitySearch.toLowerCase());
  }).slice(0, 15);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20">
              <Shield size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Access Control Center</h2>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mt-1.5">
                {activeTab === 'roles' ? 'Default Hierarchical Permissions' : 'Entity-Specific Authorization'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white">
            <X size={28} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Nav Sidebar */}
          <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
            <div className="flex p-3 bg-slate-100/50 gap-2">
                <button onClick={() => setActiveTab('roles')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'roles' ? 'bg-white shadow-md text-indigo-600 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Global Roles</button>
                <button onClick={() => setActiveTab('entities')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'entities' ? 'bg-white shadow-md text-indigo-600 border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Overrides</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {activeTab === 'roles' ? (
                   manageableScopes.map(scope => (
                        <button key={scope} onClick={() => setActiveScope(scope)} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all group ${activeScope === scope ? 'bg-white border-2 border-indigo-600 shadow-lg text-indigo-900' : 'border-2 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}>
                            <span className="text-xs font-black uppercase tracking-wide">{SCOPE_CONFIG[scope]?.label || scope}</span>
                            {activeScope === scope && <ChevronRight size={16} className="text-indigo-600" />}
                        </button>
                    ))
                ) : (
                    <>
                        <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder="Filter entities..." className="w-full pl-10 pr-4 py-3 text-xs font-bold border border-slate-200 rounded-xl bg-white shadow-inner" value={entitySearch} onChange={e => setEntitySearch(e.target.value)} /></div>
                        {filteredEntities.map(e => (
                            <button key={e.id} onClick={() => setSelectedEntityId(e.id)} className={`w-full text-left px-4 py-4 rounded-2xl border transition-all flex items-center gap-4 ${selectedEntityId === e.id ? 'bg-white border-indigo-600 shadow-lg text-indigo-900' : 'border-transparent text-slate-500 hover:bg-white'}`}>
                                <div className={`p-2 rounded-lg ${selectedEntityId === e.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}><Building2 size={16}/></div>
                                <div className="min-w-0"><div className="text-xs font-black truncate uppercase">{e.name}</div><div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">{e.type}</div></div>
                            </button>
                        ))}
                    </>
                )}
            </div>
          </div>

          {/* Matrix Content */}
          <div className="flex-1 bg-slate-100/30 p-10 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-end border-b border-slate-200 pb-8 mb-4">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Feature Permissions Matrix</h3>
                        <p className="text-sm font-medium text-slate-400 mt-1">Status for: <span className="text-indigo-600 font-black">{activeTab === 'roles' ? (SCOPE_CONFIG[activeScope]?.label || activeScope) : (entities.find(e => e.id === selectedEntityId)?.name || 'Selection')}</span></p>
                    </div>
                    <button onClick={handleNoOp} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 flex items-center gap-2"><RotateCcw size={14}/> Reset to defaults</button>
                </div>

                <div className="space-y-4">
                    {navItems.map(item => (
                        <div key={item.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="px-8 py-6 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><Layout size={24}/></div>
                                    <div>
                                        <h4 className="font-black text-slate-800 uppercase tracking-wide">{item.label}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em]">Navigation Module</span>
                                            <button onClick={handleNoOp} className="p-1 hover:bg-slate-100 rounded text-slate-300 transition-colors"><Settings2 size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={true} onChange={handleNoOp} />
                                    <div className="w-14 h-8 bg-slate-200 rounded-full peer-checked:bg-emerald-500 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-6 shadow-inner"></div>
                                    <span className="ml-4 text-[11px] font-black uppercase text-emerald-600 tracking-widest w-16">Active</span>
                                </label>
                            </div>
                            
                            {item.subItems && (
                                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {item.subItems.map(sub => (
                                        <div key={sub.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
                                            <div>
                                                <div className="font-bold text-slate-700 text-xs">{sub.label}</div>
                                                <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Component Level</div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                <input type="checkbox" className="sr-only peer" checked={true} onChange={handleNoOp} />
                                                <div className="w-12 h-7 bg-slate-200 rounded-full peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>

        <div className="px-10 py-6 border-t border-slate-100 flex justify-between items-center bg-white shrink-0">
            <div className="flex items-center gap-3 text-slate-400">
                <Info size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Visual prototype mode enabled. Database hooks are suppressed.</span>
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-8 py-3 rounded-2xl text-[11px] font-black uppercase text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">Dismiss</button>
                <button onClick={handleNoOp} className="px-10 py-3 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3"><Save size={18}/> Commit Configuration</button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PermissionManager;
