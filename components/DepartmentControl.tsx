"use client";

import React, { useState, useMemo } from 'react';
import { 
  X, 
  ChevronRight, 
  Layout, 
  Unlock, 
  Lock, 
  RotateCcw, 
  Info, 
  Component,
  Check,
  Plus,
  Briefcase,
  MapPin,
  ShieldCheck,
  Users,
  Eye,
  Award,
  Repeat,
  UserPlus,
  User,
  Search,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { NavItem } from '../types';

interface DepartmentControlProps {
  onClose: () => void;
  navItems: NavItem[];
  unitName: string;
}

const STATIC_DEPTS = ["Main Kitchen", "Front Office", "F&B Service", "Housekeeping", "Engineering"];
const STATIC_ROLES = ["HOD", "EXECUTIVE", "ASSOCIATE", "STAFF"];
const MOCK_USERS = ["John Chef", "Sarah Mgr", "Alex Tech", "Maria Host", "Mike Cook"];

// Suggestion 4: Access Levels
enum AccessLevel {
  HIDDEN = 0,
  READ_ONLY = 1,
  FULL_ACCESS = 2
}

const DepartmentControl: React.FC<DepartmentControlProps> = ({ 
  onClose,
  navItems = [],
  unitName
}) => {
  const [activeModuleId, setActiveModuleId] = useState<string>(navItems[0]?.id || '');
  
  // Suggestion 4 State: tabId-deptName-roleName -> level
  const [accessLevels, setAccessLevels] = useState<Record<string, AccessLevel>>({});
  
  // Suggestion 1 State: tabId-deptName -> list of specific user names
  const [userOverrides, setUserOverrides] = useState<Record<string, string[]>>({});
  const [showUserSearch, setShowUserSearch] = useState<string | null>(null); // key: tabId-deptName
  const [userSearchText, setUserSearchText] = useState("");

  // Suggestion 2 State: tabId -> Required Certification name
  const [tabPrerequisites, setTabPrerequisites] = useState<Record<string, string>>({
    'record': 'Level 2 Food Safety',
    'inspection': 'Internal Auditor Cert'
  });

  // Suggestion 3 State: Simulation of Handover Mode
  const [isHandoverModeActive, setIsHandoverModeActive] = useState(false);

  const activeNavItem = navItems.find(item => item.id === activeModuleId);

  const cycleAccessLevel = (tabId: string, dept: string, role: string) => {
    const key = `${tabId}-${dept}-${role}`;
    setAccessLevels(prev => {
      const current = prev[key] ?? AccessLevel.FULL_ACCESS;
      const next = (current + 1) % 3;
      return { ...prev, [key]: next };
    });
  };

  const addUserOverride = (tabId: string, dept: string, userName: string) => {
    const key = `${tabId}-${dept}`;
    setUserOverrides(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), userName]
    }));
    setShowUserSearch(null);
    setUserSearchText("");
  };

  const removeUserOverride = (tabId: string, dept: string, userName: string) => {
    const key = `${tabId}-${dept}`;
    setUserOverrides(prev => ({
      ...prev,
      [key]: (prev[key] || []).filter(u => u !== userName)
    }));
  };

  const getPillStyle = (level: AccessLevel) => {
    switch (level) {
      case AccessLevel.HIDDEN:
        return "bg-slate-100 text-slate-400 border-slate-200 opacity-60";
      case AccessLevel.READ_ONLY:
        return "bg-sky-100 text-sky-700 border-sky-200 shadow-sm";
      case AccessLevel.FULL_ACCESS:
        default:
        return "bg-indigo-600 text-white border-indigo-600 shadow-md";
    }
  };

  const getPillIcon = (level: AccessLevel) => {
    switch (level) {
      case AccessLevel.HIDDEN: return <Lock size={10} />;
      case AccessLevel.READ_ONLY: return <Eye size={10} />;
      case AccessLevel.FULL_ACCESS: default: return <Unlock size={10} />;
    }
  };

  const filteredUsers = useMemo(() => 
    MOCK_USERS.filter(u => u.toLowerCase().includes(userSearchText.toLowerCase())),
  [userSearchText]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[1400px] h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-indigo-50/30">
            <div className="flex items-center gap-5">
                <div className="p-4 rounded-2xl shadow-sm bg-indigo-100 text-indigo-600">
                    <Component size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                        Granular Resource Control
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            User-Level Exceptions & ABAC Logic
                        </span>
                        <ChevronRight size={14} className="text-slate-300" />
                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
                            <MapPin size={10} className="text-indigo-500" />
                            <span className="text-xs font-black text-slate-700">{unitName}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {/* Suggestion 3: Global Handover Toggle */}
                <button 
                  onClick={() => setIsHandoverModeActive(!isHandoverModeActive)}
                  className={`text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 border ${isHandoverModeActive ? 'bg-amber-100 border-amber-300 text-amber-700 ring-4 ring-amber-50' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                    <Repeat size={14} className={isHandoverModeActive ? 'animate-spin-slow' : ''} />
                    Handover Mode: {isHandoverModeActive ? 'ACTIVE' : 'OFF'}
                </button>
                <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400">
                    <X size={24} strokeWidth={2.5} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-slate-50/50">
            
            {/* Sidebar Tabs */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 gap-2 overflow-y-auto custom-scrollbar">
                <div className="px-2 mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Module Registry</h3>
                </div>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveModuleId(item.id)}
                        className={`
                            flex items-center justify-between p-4 rounded-2xl transition-all group border-2
                            ${activeModuleId === item.id 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100' 
                                : 'bg-white text-slate-500 border-transparent hover:bg-slate-50 hover:border-slate-200'}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${activeModuleId === item.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400 group-hover:text-indigo-600'}`}>
                                <Layout size={18} />
                            </div>
                            <p className="font-black text-[11px] uppercase tracking-tight leading-none">{item.label}</p>
                        </div>
                        {activeModuleId === item.id && <ChevronRight size={18} />}
                    </button>
                ))}
            </div>

            {/* Access Grid */}
            <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-8">
                
                {activeNavItem ? (
                    <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-200/50 flex flex-col">
                        
                        <div className="px-10 py-8 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-[1.5rem]">
                                    <Layout size={28} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">
                                        {activeNavItem.label} Access Grid
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tiered Visibility & User Exceptions</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="flex flex-col items-end">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Protocol</span>
                                  <span className="text-xs font-black text-indigo-600 uppercase">ACL + ABAC Mode</span>
                               </div>
                               <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                                  <ShieldCheck size={20} />
                               </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-200">
                                    <tr>
                                        <th className="p-8 w-[25%]">Dashboard Node</th>
                                        {STATIC_DEPTS.map(dept => (
                                            <th key={dept} className="p-8 text-center border-l border-slate-200 min-w-[250px]">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Briefcase size={16} className="text-slate-300 mb-1" />
                                                    <span className="truncate max-w-[120px]">{dept}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* Sub-modules as Rows (Merging Main and Subs into rows for clarity) */}
                                    {[activeNavItem, ...(activeNavItem.subItems || [])].map((item: any, rowIdx: number) => {
                                        const isMain = rowIdx === 0;
                                        const reqCert = tabPrerequisites[item.id];
                                        
                                        return (
                                            <tr key={item.id} className={`${isMain ? 'bg-indigo-50/20' : 'hover:bg-slate-50'} transition-colors group/row`}>
                                                <td className="p-8">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${isMain ? 'bg-indigo-600 shadow-md ring-4 ring-indigo-100' : 'bg-slate-300 group-hover/row:bg-indigo-400'}`} />
                                                        <span className={`uppercase tracking-tight ${isMain ? 'font-black text-indigo-900 text-base' : 'font-bold text-slate-700 text-sm'}`}>
                                                            {item.label} {isMain && '(Main)'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Suggestion 2: Competency Requirement */}
                                                    {reqCert && (
                                                        <div className="mt-3 ml-6 flex items-center gap-2 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg w-fit animate-in fade-in duration-500">
                                                            <Award size={12} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Req: {reqCert}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                {STATIC_DEPTS.map(dept => {
                                                    const overrideKey = `${item.id}-${dept}`;
                                                    const overrides = userOverrides[overrideKey] || [];
                                                    const isSearching = showUserSearch === overrideKey;

                                                    return (
                                                        <td key={dept} className="p-6 border-l border-slate-100 align-top">
                                                            {/* Suggestion 4: Cycling Role Pills */}
                                                            <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                                                                {STATIC_ROLES.map(role => {
                                                                    const level = accessLevels[`${item.id}-${dept}-${role}`] ?? AccessLevel.FULL_ACCESS;
                                                                    return (
                                                                        <button
                                                                            key={role}
                                                                            onClick={() => cycleAccessLevel(item.id, dept, role)}
                                                                            className={`
                                                                                flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black transition-all border
                                                                                ${getPillStyle(level)}
                                                                                ${isHandoverModeActive ? 'ring-2 ring-amber-400 ring-offset-1' : ''}
                                                                            `}
                                                                            title={`Click to Cycle: Hidden -> View -> Full`}
                                                                        >
                                                                            {getPillIcon(level)}
                                                                            {role}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Suggestion 1: User Exceptions */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between border-b border-slate-50 pb-1 px-1">
                                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">User Exceptions</span>
                                                                    <button 
                                                                        onClick={() => setShowUserSearch(isSearching ? null : overrideKey)}
                                                                        className={`p-1 rounded-md transition-all ${isSearching ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                                                                    >
                                                                        {isSearching ? <X size={10} /> : <UserPlus size={10} />}
                                                                    </button>
                                                                </div>

                                                                {/* Inline User Search */}
                                                                {isSearching && (
                                                                    <div className="relative p-2 bg-slate-50 rounded-xl border border-slate-200 animate-in zoom-in-95">
                                                                        <input 
                                                                            autoFocus
                                                                            className="w-full text-[10px] font-bold p-1.5 rounded border border-slate-100 outline-none focus:border-indigo-400"
                                                                            placeholder="Find user..."
                                                                            value={userSearchText}
                                                                            onChange={(e) => setUserSearchText(e.target.value)}
                                                                        />
                                                                        <div className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                                                                            {filteredUsers.map(u => (
                                                                                <button 
                                                                                    key={u} 
                                                                                    onClick={() => addUserOverride(item.id, dept, u)}
                                                                                    className="w-full text-left p-1 text-[10px] font-bold text-slate-600 hover:bg-indigo-50 rounded"
                                                                                >
                                                                                    {u}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Exception Tags */}
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {overrides.map(userName => (
                                                                        <div key={userName} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-[9px] font-black shadow-sm group animate-in slide-in-from-left-2">
                                                                            <User size={10} />
                                                                            {userName}
                                                                            <button onClick={() => removeUserOverride(item.id, dept, userName)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-opacity">
                                                                                <X size={10} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {overrides.length === 0 && !isSearching && (
                                                                        <span className="text-[8px] text-slate-300 italic px-1">None defined</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
                        <Layout size={80} className="text-slate-200 mb-8" />
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Sync Configuration</h3>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest max-w-sm mt-4 leading-relaxed">Select a core system module from the registry to configure its departmental role handshake logic.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center shrink-0">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 text-slate-400">
                    <Info size={20} className="text-blue-500" />
                    <div className="flex flex-col">
                        <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Advanced Access Protocol</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            Pills: <span className="text-slate-900">Gray (Hidden)</span> → <span className="text-sky-600">Sky (Read)</span> → <span className="text-indigo-600">Indigo (Full)</span>
                        </p>
                    </div>
                </div>
                <div className="h-10 w-px bg-slate-100" />
                <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-lg ${isHandoverModeActive ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <Repeat size={16} />
                   </div>
                   <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                     {isHandoverModeActive ? 'Delegation Mode Overriding Hierarchy' : 'Standard Hierarchical Enforcement'}
                   </p>
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={onClose} className="px-16 py-4 rounded-[1.5rem] bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95">
                    Apply Advanced Logic
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentControl;