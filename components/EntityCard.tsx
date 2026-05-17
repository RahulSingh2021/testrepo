
"use client";

import React from 'react';
import { Building2, ArrowRight, Layers, LayoutGrid, Users as UsersIcon, ShieldCheck, MapPin } from 'lucide-react';
import { Entity } from '../types';

interface EntityCardProps {
  entity: Entity;
  onClick: () => void;
}

const EntityCard: React.FC<EntityCardProps> = ({ entity, onClick }) => {
  const isHighPerformance = entity.compliance >= 90;
  
  const renderCounts = () => {
    const counts: { label: string; val: number }[] = [];
    if (entity.regionCount) counts.push({ label: 'Regions', val: entity.regionCount });
    if (entity.unitCount) counts.push({ label: 'Units', val: entity.unitCount });
    if (entity.deptCount) counts.push({ label: 'Depts', val: entity.deptCount });
    if (entity.userCount) counts.push({ label: 'Staff', val: entity.userCount });
    
    if (counts.length === 0) return null;
    
    return (
      <div className="grid grid-cols-2 gap-3 mt-8">
        {counts.map((c, i) => (
          <div key={i} className="bg-slate-50/50 px-4 py-3 rounded-2xl border border-slate-100 flex flex-col gap-1 shadow-inner group-hover:bg-white group-hover:border-indigo-100 transition-all duration-500">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">{c.label}</span>
            <span className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{c.val}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative bg-white/90 backdrop-blur-md p-8 rounded-[3rem] border-2 transition-all duration-700 cursor-pointer group flex flex-col justify-between h-full min-h-[300px] overflow-hidden
        border-slate-100 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 active:scale-[0.98]
      `}
    >
      {/* Visual Background Blueprint Pattern */}
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000 pointer-events-none transform translate-x-12 -translate-y-12">
          {entity.type === 'corporate' && <Building2 size={240} />}
          {entity.type === 'regional' && <Layers size={240} />}
          {entity.type === 'unit' && <LayoutGrid size={240} />}
          {entity.type === 'department' && <UsersIcon size={240} />}
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-10">
          <div className="w-16 h-16 bg-slate-50 rounded-[1.75rem] flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all duration-700 shadow-inner group-hover:shadow-indigo-100/30 group-hover:rotate-6 border border-slate-100 group-hover:border-slate-900">
            {entity.type === 'corporate' && <Building2 size={32} />}
            {entity.type === 'regional' && <Layers size={32} />}
            {entity.type === 'unit' && <LayoutGrid size={32} />}
            {entity.type === 'department' && <UsersIcon size={32} />}
          </div>
          <div className={`
            px-4 py-2 rounded-full text-[10px] font-black shadow-lg border-2 border-white flex items-center gap-2 transition-all duration-700
            ${isHighPerformance ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-orange-500 text-white shadow-orange-100'}
          `}>
            <ShieldCheck size={14} />
            {entity.compliance}% <span className="opacity-60 ml-0.5 uppercase tracking-tighter font-bold">Health</span>
          </div>
        </div>
        
        <div className="space-y-1">
            <h4 className="font-black text-slate-900 text-2xl group-hover:text-indigo-600 transition-colors tracking-tighter leading-none mb-2 uppercase">
            {entity.name}
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <MapPin size={12} className="text-indigo-400" /> {entity.location}
            </div>
        </div>
        
        {renderCounts()}
      </div>

      <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${entity.issuesCount > 0 ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
            <span className={`text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${entity.issuesCount > 0 ? 'text-red-500' : 'text-slate-400 group-hover:text-slate-600'}`}>
              {entity.issuesCount > 0 ? `${entity.issuesCount} System Alerts` : 'Registry Secure'}
            </span>
        </div>
        <div className="w-14 h-14 rounded-[1.25rem] bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:translate-x-1 group-hover:shadow-xl group-hover:shadow-indigo-500/30 border border-slate-100 group-hover:border-indigo-600">
          <ArrowRight className="w-7 h-7 text-slate-300 group-hover:text-white" strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};

export default EntityCard;
