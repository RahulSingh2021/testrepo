"use client";

import React, { useState, useMemo } from 'react';
import { 
  CreditCard, 
  Check,
  X,
  Building2,
  ArrowRight,
  Unlock,
  Lock,
  RotateCcw,
  Info,
  ChevronDown,
  Layout,
  ChevronRight,
  Plus,
  Zap,
  Globe,
  Briefcase,
  Factory,
  // Fix: Added missing ShieldCheck import for line 506
  ShieldCheck
} from 'lucide-react';
import { HierarchyScope, NavItem, Entity, SubscriptionType, IndustryType, SubNavItem } from '../types';
import { INDUSTRY_CONFIGS } from '../constants';

const LOCAL_PLANS: Record<SubscriptionType, { label: string; color: string }> = {
  trial: { label: 'Free Trial', color: 'bg-slate-100 text-slate-600' },
  basic: { label: 'Basic', color: 'bg-blue-100 text-blue-700' },
  advance: { label: 'Advance', color: 'bg-purple-100 text-purple-700' },
  pro: { label: 'Pro', color: 'bg-emerald-100 text-emerald-700' },
};

interface SubscriptionManagementProps {
  currentScope: HierarchyScope;
  entities: Entity[];
  onUpdateEntity: (entity: Entity) => void;
  navItems: NavItem[];
  onUpdateNavConfig?: React.Dispatch<React.SetStateAction<NavItem[]>>;
  onClose?: () => void;
  targetEntityId?: string | null; 
}

const SubscriptionManagement: React.FC<SubscriptionManagementProps> = ({ 
  entities,
  navItems = [],
  onUpdateNavConfig,
  onClose,
  targetEntityId
}) => {
  const [activeModuleId, setActiveModuleId] = useState<string>(navItems[0]?.id || '');

  const targetEntity = useMemo(() => 
    entities.find(e => e.id === targetEntityId), 
  [entities, targetEntityId]);

  const activeNavItem = useMemo(() => 
    navItems.find(item => item.id === activeModuleId),
  [navItems, activeModuleId]);

  const handleGlobalTogglePlan = (plan: SubscriptionType, isParent: boolean, subItemId?: string) => {
      if (!onUpdateNavConfig || !activeNavItem) return;

      onUpdateNavConfig(prev => prev.map(item => {
          if (item.id !== activeModuleId) return item;

          if (isParent) {
              const currentlyAllowed = item.allowedSubscriptions || [];
              const isRemoving = currentlyAllowed.includes(plan);
              const nextAllowed = isRemoving 
                  ? currentlyAllowed.filter(p => p !== plan)
                  : [...currentlyAllowed, plan];

              return {
                  ...item,
                  allowedSubscriptions: nextAllowed,
                  subItems: (item.subItems || []).map(sub => {
                      if (isRemoving) {
                          return { ...sub, allowedSubscriptions: (sub.allowedSubscriptions || []).filter(p => p !== plan) };
                      }
                      return sub;
                  })
              };
          }

          return {
              ...item,
              subItems: (item.subItems || []).map(sub => {
                  if (sub.id === subItemId) {
                      const currentlyAllowed = sub.allowedSubscriptions || [];
                      const isRemoving = currentlyAllowed.includes(plan);
                      const parentAllows = (item.allowedSubscriptions || []).includes(plan);
                      if (!isRemoving && !parentAllows) {
                          alert(`Action Locked: Parent module "${item.label}" must enable the ${plan.toUpperCase()} tier first.`);
                          return sub;
                      }
                      const nextAllowed = isRemoving ? currentlyAllowed.filter(p => p !== plan) : [...currentlyAllowed, plan];
                      return { ...sub, allowedSubscriptions: nextAllowed };
                  }
                  return sub;
              })
          };
      }));
  };

  const handleGlobalToggleIndustry = (industry: IndustryType, isParent: boolean, subItemId?: string) => {
      if (!onUpdateNavConfig || !activeNavItem) return;

      onUpdateNavConfig(prev => prev.map(item => {
          if (item.id !== activeModuleId) return item;

          if (isParent) {
              const currentlyAllowed = item.allowedIndustries || [];
              const isRemoving = currentlyAllowed.includes(industry);
              const nextAllowed = isRemoving ? currentlyAllowed.filter(i => i !== industry) : [...currentlyAllowed, industry];

              return {
                  ...item,
                  allowedIndustries: nextAllowed,
                  subItems: (item.subItems || []).map(sub => {
                      if (isRemoving) {
                          return { ...sub, allowedIndustries: (sub.allowedIndustries || []).filter(i => i !== industry) };
                      }
                      return sub;
                  })
              };
          }

          return {
              ...item,
              subItems: (item.subItems || []).map(sub => {
                  if (sub.id === subItemId) {
                      const currentlyAllowed = sub.allowedIndustries || [];
                      const isRemoving = currentlyAllowed.includes(industry);
                      const parentAllows = (item.allowedIndustries || []).includes(industry);
                      if (!isRemoving && !parentAllows) {
                          alert(`Handshake Error: The parent module "${item.label}" does not support the ${industry.toUpperCase()} industry yet.`);
                          return sub;
                      }
                      const nextAllowed = isRemoving ? currentlyAllowed.filter(i => i !== industry) : [...currentlyAllowed, industry];
                      return { ...sub, allowedIndustries: nextAllowed };
                  }
                  return sub;
              })
          };
      }));
  };

  const handleEntityOverride = (isParent: boolean, subItemId: string | undefined, forceState: 'none' | 'allow' | 'deny') => {
      if (!targetEntity || !onUpdateNavConfig || !activeNavItem) return;

      onUpdateNavConfig(prev => prev.map(item => {
          if (item.id !== activeModuleId) return item;

          const updateItem = (target: NavItem | SubNavItem) => {
              let nextAllowed = (target.allowedEntityIds || []).filter(id => id !== targetEntity.id);
              let nextDenied = (target.deniedEntityIds || []).filter(id => id !== targetEntity.id);
              if (forceState === 'allow') nextAllowed.push(targetEntity.id);
              if (forceState === 'deny') nextDenied.push(targetEntity.id);
              return { ...target, allowedEntityIds: nextAllowed, deniedEntityIds: nextDenied };
          };

          if (isParent) return updateItem(item) as NavItem;
          return {
              ...item,
              subItems: (item.subItems || []).map(sub => sub.id === subItemId ? updateItem(sub) as SubNavItem : sub)
          };
      }));
  };

  const resetModuleOverrides = () => {
      if (!targetEntity || !onUpdateNavConfig || !activeNavItem) return;
      onUpdateNavConfig(prev => prev.map(item => {
          if (item.id !== activeModuleId) return item;
          return {
            ...item,
            allowedEntityIds: (item.allowedEntityIds || []).filter(id => id !== targetEntity.id),
            deniedEntityIds: (item.deniedEntityIds || []).filter(id => id !== targetEntity.id),
            subItems: (item.subItems || []).map(sub => ({
                ...sub,
                allowedEntityIds: (sub.allowedEntityIds || []).filter(id => id !== targetEntity.id),
                deniedEntityIds: (sub.deniedEntityIds || []).filter(id => id !== targetEntity.id)
            }))
          };
      }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        
        <div className={`px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 ${targetEntity ? 'bg-orange-50/50' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-5">
                <div className={`p-4 rounded-2xl shadow-sm ${targetEntity ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {targetEntity ? <Building2 size={28} /> : <CreditCard size={28} />}
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                        {targetEntity ? 'Unit Access Override' : 'Global Access Matrix'}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {targetEntity ? 'Entity Specific Permissions' : 'Core Plan & Industry Handshake Logic'}
                        </span>
                        {targetEntity && (
                           <>
                              <ArrowRight size={14} className="text-slate-300" />
                              <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                                <span className="text-xs font-black text-slate-700">{targetEntity.name}</span>
                                <div className="h-3 w-px bg-slate-200 mx-1" />
                                <span className={`${LOCAL_PLANS[targetEntity.subscriptionType || 'basic'].color} px-1.5 rounded text-[10px] font-black`}>
                                    {(targetEntity.subscriptionType || 'basic').toUpperCase()}
                                </span>
                              </div>
                           </>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {targetEntity && (
                    <button onClick={resetModuleOverrides} className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
                        <RotateCcw size={14} /> Reset Current Module
                    </button>
                )}
                {onClose && (
                    <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400">
                        <X size={24} strokeWidth={2.5} />
                    </button>
                )}
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50/50">
            
            {/* Sidebar Tabs: Purely Data Driven */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col p-4 gap-2 overflow-y-auto custom-scrollbar">
                <div className="px-4 py-2 mb-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Manage System Modules</h3>
                </div>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveModuleId(item.id)}
                        className={`
                            flex items-center justify-between p-4 rounded-2xl transition-all group
                            ${activeModuleId === item.id 
                                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 ring-4 ring-indigo-50' 
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${activeModuleId === item.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600'}`}>
                                <Layout size={18} />
                            </div>
                            <div className="text-left">
                                <p className="font-black text-xs uppercase tracking-tight leading-none">{item.label}</p>
                                <div className="flex gap-1 mt-1.5">
                                    {(item.allowedIndustries || []).slice(0, 3).map(ind => (
                                        <div key={ind} className={`w-1 h-1 rounded-full ${activeModuleId === item.id ? 'bg-white' : 'bg-indigo-400'}`} />
                                    ))}
                                    {(item.allowedIndustries || []).length > 3 && <span className="text-[7px] font-black opacity-50">+</span>}
                                </div>
                            </div>
                        </div>
                        {activeModuleId === item.id && <ChevronRight size={18} />}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
                
                {activeNavItem ? (
                    <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 flex flex-col">
                        
                        <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <Layout size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                                        {activeNavItem.label} Configuration Matrix
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Industry & Tier Logic</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-200">
                                    <tr>
                                        <th className="p-6 w-[35%]">Feature Logic</th>
                                        {targetEntity ? (
                                            <>
                                                <th className="p-6 text-center border-l border-slate-200">Tier Default</th>
                                                <th className="p-6 text-center border-l border-slate-200 w-64">Manual Control</th>
                                                <th className="p-6 text-center border-l border-slate-200 bg-slate-100">Final Result</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="p-6 text-center bg-slate-100/30 border-l border-slate-200">Trial</th>
                                                <th className="p-6 text-center bg-blue-50/20 text-blue-700 border-l border-slate-200">Basic</th>
                                                <th className="p-6 text-center bg-purple-50/20 text-purple-700 border-l border-slate-200">Advance</th>
                                                <th className="p-6 text-center bg-emerald-50/20 text-emerald-700 border-l border-slate-200">Pro</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* Parent Module Row */}
                                    <tr className="bg-indigo-50/30">
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-md ring-4 ring-indigo-100" />
                                                <span className="font-black text-indigo-900 text-sm uppercase tracking-tight">{activeNavItem.label} (Main)</span>
                                            </div>
                                            {!targetEntity && (
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-5">Module Industry Handshake</p>
                                                    <div className="flex flex-wrap gap-1.5 pl-5">
                                                        {Object.entries(INDUSTRY_CONFIGS).map(([key, config]) => (
                                                            <button 
                                                                key={key}
                                                                onClick={() => handleGlobalToggleIndustry(key as IndustryType, true)}
                                                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-all ${
                                                                    (activeNavItem.allowedIndustries || []).includes(key as IndustryType)
                                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-400'
                                                                }`}
                                                            >
                                                                {config.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        {targetEntity ? (
                                            <>
                                                <td className="p-6 text-center border-l border-slate-100">
                                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                                        (activeNavItem.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        {(activeNavItem.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? <Check size={12}/> : <X size={12}/>}
                                                        {(activeNavItem.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? 'Tiered' : 'Locked'}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center border-l border-slate-100">
                                                    <div className="flex justify-center gap-1">
                                                        {[
                                                            { state: 'allow' as const, label: 'ON', color: 'bg-green-600' },
                                                            { state: 'none' as const, label: 'Auto', color: 'bg-slate-100' },
                                                            { state: 'deny' as const, label: 'OFF', color: 'bg-red-600' }
                                                        ].map(btn => {
                                                            const isAllowed = (activeNavItem.allowedEntityIds || []).includes(targetEntity.id);
                                                            const isDenied = (activeNavItem.deniedEntityIds || []).includes(targetEntity.id);
                                                            const isSelected = btn.state === 'allow' ? isAllowed : 
                                                                              btn.state === 'deny' ? isDenied :
                                                                              (!isAllowed && !isDenied);
                                                            return (
                                                                <button key={btn.state} onClick={() => handleEntityOverride(true, undefined, btn.state)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isSelected ? `${btn.color} text-white shadow-lg` : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}>{btn.label}</button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="p-6 text-center border-l border-slate-100">
                                                    {(() => {
                                                        const globalAllowed = (activeNavItem.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic');
                                                        const finalState = (activeNavItem.allowedEntityIds || []).includes(targetEntity.id) || (globalAllowed && !(activeNavItem.deniedEntityIds || []).includes(targetEntity.id));
                                                        return (
                                                            <div className={`flex items-center justify-center gap-2.5 ${finalState ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                {finalState ? <Unlock size={18} /> : <Lock size={18} />}
                                                                <span className="font-black text-xs uppercase">{finalState ? 'Active' : 'Hidden'}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                            </>
                                        ) : (
                                            ['trial', 'basic', 'advance', 'pro'].map(plan => {
                                                const isAllowed = (activeNavItem.allowedSubscriptions || []).includes(plan as SubscriptionType);
                                                return (
                                                    <td key={plan} className="p-6 text-center border-l border-slate-100 cursor-pointer group/cell" onClick={() => handleGlobalTogglePlan(plan as SubscriptionType, true)}>
                                                        <div className={`w-9 h-9 mx-auto rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${isAllowed ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'border-slate-200 bg-white text-transparent group-hover/cell:border-indigo-300 group-hover/cell:text-indigo-200'}`}>
                                                            {isAllowed ? <Check size={18} strokeWidth={4} /> : <Plus size={18} />}
                                                        </div>
                                                    </td>
                                                );
                                            })
                                        )}
                                    </tr>

                                    {/* Sub-modules: Now with explicit industry controls */}
                                    {(activeNavItem.subItems || []).map((sub) => (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6 pl-12">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                    <span className="font-bold text-slate-700 text-sm">{sub.label}</span>
                                                </div>
                                                
                                                {/* Granular Sub-tab Industry Toggles */}
                                                {!targetEntity && (
                                                    <div className="mt-3 space-y-1.5">
                                                        <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] pl-4">Sector Handshake</p>
                                                        <div className="flex flex-wrap gap-1 pl-4">
                                                            {Object.entries(INDUSTRY_CONFIGS).map(([key, config]) => {
                                                                const isAllowed = (sub.allowedIndustries || []).includes(key as IndustryType);
                                                                const parentSupports = (activeNavItem.allowedIndustries || []).includes(key as IndustryType);
                                                                return (
                                                                    <button 
                                                                        key={key}
                                                                        disabled={!parentSupports}
                                                                        onClick={() => handleGlobalToggleIndustry(key as IndustryType, false, sub.id)}
                                                                        title={!parentSupports ? `Module must support ${config.label} first` : `Toggle ${config.label}`}
                                                                        className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase border transition-all ${
                                                                            isAllowed 
                                                                            ? 'bg-blue-600 border-blue-600 text-white' 
                                                                            : parentSupports 
                                                                                ? 'bg-white border-slate-200 text-slate-400 hover:border-blue-400'
                                                                                : 'bg-slate-50 border-transparent text-slate-200 opacity-40 cursor-not-allowed'
                                                                        }`}
                                                                    >
                                                                        {config.label.split(' ')[0]}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            {targetEntity ? (
                                                <>
                                                    <td className="p-6 text-center border-l border-slate-100">
                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                                            (sub.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                            {(sub.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? <Check size={12}/> : <X size={12}/>}
                                                            {(sub.allowedSubscriptions || []).includes(targetEntity.subscriptionType || 'basic') ? 'Available' : 'Restricted'}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-center border-l border-slate-100">
                                                        <div className="flex justify-center gap-1">
                                                            {[
                                                                { state: 'allow' as const, label: 'ON', color: 'bg-green-600' },
                                                                { state: 'none' as const, label: 'Auto', color: 'bg-slate-100' },
                                                                { state: 'deny' as const, label: 'OFF', color: 'bg-red-600' }
                                                            ].map(btn => {
                                                                const isAllowed = (sub.allowedEntityIds || []).includes(targetEntity.id);
                                                                const isDenied = (sub.deniedEntityIds || []).includes(targetEntity.id);
                                                                const isSelected = btn.state === 'allow' ? isAllowed : 
                                                                                  btn.state === 'deny' ? isDenied :
                                                                                  (!isAllowed && !isDenied);
                                                                return (
                                                                    <button key={btn.state} onClick={() => handleEntityOverride(false, sub.id, btn.state)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isSelected ? `${btn.color} text-white shadow-lg` : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}>{btn.label}</button>
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-center border-l border-slate-100">
                                                        {(() => {
                                                            const plan = targetEntity.subscriptionType || 'basic';
                                                            const finalState = (sub.allowedEntityIds || []).includes(targetEntity.id) || ((sub.allowedSubscriptions || []).includes(plan) && !(sub.deniedEntityIds || []).includes(targetEntity.id));
                                                            return (
                                                                <div className={`flex items-center justify-center gap-2.5 ${finalState ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                    {finalState ? <Unlock size={18} /> : <Lock size={18} />}
                                                                    <span className="font-black text-xs uppercase">{finalState ? 'Active' : 'Locked'}</span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </>
                                            ) : (
                                                ['trial', 'basic', 'advance', 'pro'].map(plan => {
                                                    const parentAllows = (activeNavItem.allowedSubscriptions || []).includes(plan as SubscriptionType);
                                                    const isSelfAllowed = (sub.allowedSubscriptions || []).includes(plan as SubscriptionType);
                                                    return (
                                                        <td key={plan} className={`p-6 text-center border-l border-slate-100 group/cell ${!parentAllows ? 'bg-slate-50/50' : 'cursor-pointer hover:bg-slate-50/50'}`} onClick={() => parentAllows && handleGlobalTogglePlan(plan as SubscriptionType, false, sub.id)}>
                                                            <div className={`w-8 h-8 mx-auto rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${isSelfAllowed ? 'bg-blue-600 border-blue-600 text-white shadow-md' : parentAllows ? 'border-slate-200 bg-white text-transparent group-hover/cell:border-blue-400 group-hover/cell:text-blue-200' : 'border-transparent text-slate-200 opacity-20'}`}>
                                                                {isSelfAllowed ? <Check size={16} strokeWidth={4} /> : !parentAllows ? <Lock size={12} /> : <Plus size={16} />}
                                                            </div>
                                                        </td>
                                                    );
                                                })
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                        <Layout size={64} className="text-slate-200 mb-6" />
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Access Control Synchronization</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest max-w-xs mt-3">Select a core system module to configure its handshake logic.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="px-8 py-6 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 text-slate-400">
                <ShieldCheck size={18} className="text-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                    Module Security: Sub-module industry access is inherited from parent settings.
                </p>
            </div>
            <div className="flex gap-4">
                <button onClick={onClose} className="px-12 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95">
                    Save Logic & Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;
