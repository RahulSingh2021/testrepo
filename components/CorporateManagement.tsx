"use client";

import React, { useState, useMemo, useRef } from "react";
import { compressImage } from '@/utils/imageCompression';
import * as XLSX from 'xlsx';
import {
  Building2,
  Globe,
  Plus,
  Pencil,
  Upload,
  User,
  Mail,
  MapPin,
  Phone,
  Ban,
  RefreshCcw,
  RefreshCw,
  Zap,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Image as ImageIcon,
  ShieldCheck,
  Briefcase,
  Users,
  LayoutGrid,
  LayoutDashboard,
  ShieldAlert,
  Lock,
  Trash,
  FileSpreadsheet,
  KeyRound,
  Bot,
  MessageCircle,
  Send,
  CalendarClock,
  Terminal,
  Play,
  Shield,
  CreditCard,
  Crown,
  Clock,
  Factory,
  IdCard,
  UserPlus,
  UserMinus,
  Search,
  ArrowRight,
  Settings,
  Component,
  GitBranch,
  Layers,
  ClipboardList,
  Tag
} from "lucide-react";
import { HierarchyScope, Entity, SubscriptionType, Category, IndustryType, EntityContact, NavItem, Employee } from "../types";
import { INDUSTRY_CONFIGS, SCOPE_CONFIG } from "../constants";
import EmployeeManagement from "./EmployeeManagement";
import EscalationMatrix from "./EscalationMatrix";
import NotificationSettings from "./NotificationSettings";
import FoodSafetyTeam from "./FoodSafetyTeam";
import DepartmentControl from "./DepartmentControl";

// --- 1. UTILS ---

const SUBSCRIPTION_DURATIONS: Record<SubscriptionType, number> = {
  trial: 7,
  basic: 30,
  advance: 180,
  pro: 365,
};

const PLANS: Record<SubscriptionType, { label: string; color: string; icon: React.ReactNode; price: string }> = {
  trial: { label: 'Free Trial', color: 'bg-slate-100 text-slate-600', icon: <Clock className="w-4 h-4"/>, price: '$0' },
  basic: { label: 'Basic', color: 'bg-blue-100 text-blue-700', icon: <Shield className="w-4 h-4"/>, price: '$99/mo' },
  advance: { label: 'Advance', color: 'bg-purple-100 text-purple-700', icon: <Zap className="w-4 h-4"/>, price: '$199/mo' },
  pro: { label: 'Pro', color: 'bg-emerald-100 text-emerald-700', icon: <Crown className="w-4 h-4"/>, price: '$399/mo' },
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const calculateDaysLeft = (endDateString?: string) => {
  if (!endDateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(endDateString);
  endDate.setHours(23, 59, 59, 999);
  return Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getEffectiveStatus = (unit: any) => {
  if (unit.status === "pending-approval") return "pending";
  if (unit.status === "inactive") return "inactive";
  const daysLeft = calculateDaysLeft(unit.subscriptionEndDate);
  if (daysLeft === null) return "active"; 
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "expiry-soon";
  return "active";
};

const getStatusText = (unit: any) => {
  const daysLeft = calculateDaysLeft(unit.subscriptionEndDate);
  const eff = getEffectiveStatus(unit);
  if (eff === "expired") return `Expired (${Math.abs(daysLeft || 0)} days ago)`;
  if (eff === "expiry-soon") return `${daysLeft} days left (Expires Soon!)`;
  if (eff === "pending") return "Awaiting Approval";
  if (eff === "inactive") return "Deactivated";
  return `${daysLeft} days left`;
};

// --- 2. GLOBAL STABLE SUB-COMPONENTS ---

const StatusBadge = ({ label, count }: { label: string; count: number }) => (
  <div className="px-2 py-1.5 border border-white/30 rounded text-[9px] font-black uppercase tracking-tighter bg-white/5 flex items-center gap-1.5 whitespace-nowrap">
    {label}: <span className="bg-white/10 px-1 rounded">{count}</span>
  </div>
);

const ManagementHeader = ({ title, subtitle, icon: Icon, color = "bg-blue-600" }: any) => (
  <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 relative z-10">
    <div className={`p-2 sm:p-2.5 ${color} text-white rounded-xl shadow-lg shadow-blue-500/20 shrink-0`}><Icon size={18} className="sm:w-5 sm:h-5" /></div>
    <div className="min-w-0">
      <h4 className="font-black text-slate-800 uppercase tracking-tight leading-none mb-0.5 sm:mb-1 text-xs sm:text-sm truncate">{title}</h4>
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{subtitle}</p>
    </div>
  </div>
);

const ScopeIdentityBadge = ({ scope }: { scope: HierarchyScope }) => {
  const labels: Record<string, string> = {
    'super-admin': 'SA',
    'corporate': 'C',
    'regional': 'R',
    'unit': 'U'
  };
  const colors: Record<string, string> = {
    'super-admin': 'bg-purple-100 text-purple-700 border-purple-200',
    'corporate': 'bg-blue-100 text-blue-700 border-blue-200',
    'regional': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'unit': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  return (
    <span className={`w-4 h-4 flex items-center justify-center rounded text-[8px] font-black border ${colors[scope] || 'bg-slate-100 text-slate-500'}`} title={`Added by ${SCOPE_CONFIG[scope]?.label || scope}`}>
      {labels[scope] || '?'}
    </span>
  );
};

const ContactInfoGrid = ({ contacts = [], title, onEdit, isSuperAdmin, entity }: { 
  contacts?: EntityContact[], 
  title: string, 
  onEdit?: (entity: any) => void,
  isSuperAdmin?: boolean,
  entity?: any
}) => {
  const displayContacts = (contacts && contacts.length > 0) 
    ? contacts 
    : [{
        name: entity?.contactPerson || 'N/A',
        role: 'Primary Contact',
        email: entity?.email || 'N/A',
        phone: entity?.phone || 'N/A'
    }];

  return (
    <div className="space-y-2 sm:space-y-3">
      <h5 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
        <Users size={14} className="text-indigo-500" /> {title}
      </h5>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {displayContacts.map((contact, idx) => (
          <div key={idx} className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex items-center justify-between mb-2 sm:mb-0">
              <span className="text-[8px] font-black px-2 py-0.5 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 uppercase sm:hidden">Contact #{idx + 1}</span>
              {isSuperAdmin && onEdit && (
                <button onClick={() => onEdit(entity)} className="p-1.5 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:absolute sm:top-3 sm:right-3">
                  <Pencil size={14} />
                </button>
              )}
            </div>
            <div className="space-y-2 sm:grid sm:grid-cols-4 sm:gap-4 sm:space-y-0">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Name & Role</span>
                <p className="text-xs font-black text-slate-800 flex items-center gap-2 truncate">
                  <User size={14} className="text-indigo-400 shrink-0" />
                  {contact.name}
                </p>
                <p className="text-[9px] font-bold text-slate-400 ml-5 truncate">{contact.role || 'Access Node'}</p>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Direct Line</span>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2 truncate">
                  <Phone size={14} className="text-indigo-400 shrink-0" />
                  {contact.phone}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Official Email</span>
                <p className="text-xs font-bold text-blue-600 flex items-center gap-2 truncate">
                  <Mail size={14} className="text-blue-400 shrink-0" />
                  {contact.email}
                </p>
              </div>
              <div className="hidden sm:flex justify-end items-center gap-2">
                <span className="text-[8px] font-black px-2 py-1 bg-slate-50 text-slate-400 rounded-lg border border-slate-100 uppercase">Contact #{idx + 1}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AutomationPanel = ({ entities, onClose }: { entities: Entity[], onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'license' | 'subscription'>('license');
  const [logs, setLogs] = useState<Array<{time: string, type: string, msg: string}>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (type: 'info' | 'email' | 'whatsapp' | 'success', msg: string) => {
    const time = new Date().toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'});
    setLogs(prev => [...prev, { time, type, msg }]);
    setTimeout(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, 10);
  };

  const runLicenseAutomation = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLogs([]);
    addLog("info", "Starting monthly license compliance check...");
    let step = 0;
    const interval = setInterval(() => {
      if (step === 0) {
          const corps = entities.filter(e => e.type === 'corporate');
          addLog("info", `Found ${corps.length} Corporate Entities.`);
          corps.forEach(c => {
              addLog("email", `[CORP] Report generated for ${c.name}. Sending to ${c.email || 'N/A'}`);
              if (c.phone) addLog("whatsapp", `[CORP] WhatsApp summary sent to ${c.phone}`);
          });
      } else if (step === 1) {
          const regions = entities.filter(e => e.type === 'regional');
          addLog("info", `Processing ${regions.length} Regional Offices...`);
          regions.forEach(r => {
              addLog("email", `[REGIONAL] Dashboard sent to ${r.name} (${r.email || 'N/A'})`);
              if (r.phone) addLog("whatsapp", `[REGIONAL] Alert sent to ${r.phone}`);
          });
      } else if (step === 2) {
          const units = entities.filter(e => e.type === 'unit');
          addLog("info", `Analyzing ${units.length} Units for compliance...`);
          units.forEach(u => {
              if (u.status === 'active') {
                  addLog("email", `[UNIT] Monthly Compliance Report sent to ${u.name} (${u.email})`);
              }
          });
      } else {
          addLog("success", "Batch processing complete. All notifications queued.");
          setIsProcessing(false);
          clearInterval(interval);
      }
      step++;
    }, 1000);
  };

  const runSubscriptionCheck = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLogs([]);
    addLog("info", "Scanning unit subscriptions for expiry...");

    setTimeout(() => {
        const units = entities.filter(e => e.type === 'unit');
        let alertCount = 0;
        units.forEach(u => {
            const daysLeft = calculateDaysLeft(u.subscriptionEndDate);
            if (daysLeft !== null && daysLeft <= 30) {
                alertCount++;
                const status = daysLeft < 0 ? "EXPIRED" : "EXPIRING SOON";
                addLog("email", `[ALERT] ${u.name}: Subscription ${status} (${Math.abs(daysLeft)} days). Emailing ${u.email}`);
                if (daysLeft <= 7 && u.phone) {
                    addLog("whatsapp", `[URGENT] WhatsApp sent to ${u.phone} regarding immediate renewal.`);
                }
            }
        });
        if (alertCount === 0) {
            addLog("success", "No units are currently near expiry.");
        } else {
            addLog("success", `Scan complete. Sent ${alertCount} renewal alerts.`);
        }
        setIsProcessing(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh] sm:h-[80vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2 bg-blue-50/20 rounded-lg border border-blue-500/30 shrink-0">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black uppercase tracking-tight truncate">Automation Control</h3>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-widest">Scheduled Tasks</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"><X size={20} /></button>
        </div>
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
            <div className="flex sm:flex-col sm:w-56 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 p-2 sm:p-4 gap-2 shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('license')}
                    className={`whitespace-nowrap text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 sm:gap-3 transition-all ${activeTab === 'license' ? 'bg-white border-slate-200 shadow-sm text-blue-600 border' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <FileSpreadsheet size={14} className="shrink-0" /> License Reports
                </button>
                <button 
                    onClick={() => setActiveTab('subscription')}
                    className={`whitespace-nowrap text-left px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-2 sm:gap-3 transition-all ${activeTab === 'subscription' ? 'bg-white border-slate-200 shadow-sm text-orange-600 border' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <ShieldAlert size={14} className="shrink-0" /> Subscription Watch
                </button>
            </div>
            <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
                <div className="mb-6 bg-white border border-slate-100 rounded-xl p-5 shadow-sm shrink-0">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                        {activeTab === 'license' ? <CalendarClock size={16} className="text-blue-500"/> : <CalendarClock size={16} className="text-orange-500"/>}
                        {activeTab === 'license' ? 'Monthly Schedule: 1st of Month' : 'Daily Schedule: 09:00 AM'}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        {activeTab === 'license' 
                            ? "Automatically generates compliance PDF dashboards for all entities. Sends summary emails to Unit Heads and detailed breakdown reports to Regional/Corporate managers via Email & WhatsApp."
                            : "Scans all Unit subscriptions. Triggers warning emails for accounts expiring within 30 days and critical alerts via WhatsApp for those expiring within 7 days."
                        }
                    </p>
                    <button 
                        onClick={activeTab === 'license' ? runLicenseAutomation : runSubscriptionCheck}
                        disabled={isProcessing}
                        className={`px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${isProcessing ? 'bg-slate-400 cursor-not-allowed' : activeTab === 'license' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                        {isProcessing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin"/> : <Play className="w-3.5 h-3.5 fill-current"/>}
                        {isProcessing ? 'Running Task...' : 'Run Automation Now'}
                    </button>
                </div>
                <div className="flex-1 flex flex-col bg-[#1e1e1e] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                    <div className="px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d] flex items-center gap-2">
                        <Terminal size={12} className="text-slate-400"/>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">System Logs</span>
                    </div>
                    <div ref={logContainerRef} className="flex-1 p-4 overflow-y-auto font-mono text-[11px] space-y-1.5 custom-scrollbar">
                        {logs.length === 0 ? (
                            <span className="text-slate-600 italic opacity-50">Waiting for trigger command...</span>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                                    <span className={`${
                                        log.type === 'email' ? 'text-blue-400' :
                                        log.type === 'whatsapp' ? 'text-green-400' :
                                        log.type === 'success' ? 'text-emerald-400 font-bold' :
                                        'text-slate-300'
                                    }`}>
                                        {log.type === 'email' && <Mail size={10} className="inline mr-1.5"/>}
                                        {log.type === 'whatsapp' && <MessageCircle size={10} className="inline mr-1.5"/>}
                                        {log.msg}
                                    </span>
                                </div>
                            ))
                        )}
                        {isProcessing && (
                            <div className="flex gap-2 items-center text-slate-500 mt-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Processing...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

interface UnitCardProps {
  unit: any;
  onEdit: (u: any) => void;
  onToggleStatus: (id: string) => void;
  onApprove?: (u: any) => void;
  onOpenPermissions?: (id: string) => void;
  onOpenDeptControl?: () => void;
  isSuperAdmin: boolean;
}

const UnitCard: React.FC<UnitCardProps> = ({
  unit,
  onEdit,
  onToggleStatus,
  onApprove,
  onOpenPermissions,
  onOpenDeptControl,
  isSuperAdmin
}) => {
  const eff = getEffectiveStatus(unit);
  let cardBg = "bg-white";
  let accentColor = "border-slate-200";
  let titleColor = "text-slate-800";
  let statusColor = "text-slate-600";
  if (eff === "expired" || unit.status === 'inactive') {
    cardBg = "bg-[#fff5f5]";
    accentColor = "border-[#ffa8a8]";
    titleColor = "text-[#e03131]";
    statusColor = "text-[#f03e3e]";
  } else if (eff === "expiry-soon") {
    cardBg = "bg-[#fff9db]";
    accentColor = "border-[#ffd43b]";
    titleColor = "text-[#f08c00]";
    statusColor = "text-[#f59f00]";
  } else if (eff === "pending") {
    cardBg = "bg-[#f8f9fa]";
    accentColor = "border-[#dee2e6]";
    titleColor = "text-[#495057]";
  }
  const badges: Record<string, string> = {
    pro: "bg-[#20c997] text-white",
    basic: "bg-[#4dabf7] text-white",
    trial: "bg-[#7950f2] text-white",
    pending: "bg-[#868e96] text-white"
  };
  const contacts: EntityContact[] = unit.additionalContacts && unit.additionalContacts.length > 0 
    ? unit.additionalContacts 
    : [{ name: unit.contactPerson || 'N/A', role: 'Primary Contact', email: unit.email || '', phone: unit.phone || '' }];
  return (
    <div className={`p-3 sm:p-4 rounded-xl sm:rounded-lg shadow-sm border-t-2 border-x border-b ${accentColor} ${cardBg} transition-all hover:shadow-md flex flex-col h-full relative group`}>
      <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h5 className={`font-black text-xs sm:text-[13px] tracking-tight truncate ${titleColor}`}>{unit.name}</h5>
          {unit.entityIdNum && <span className="text-[8px] sm:text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded shrink-0">{unit.entityIdNum}</span>}
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
          <button 
            onClick={(e) => { e.stopPropagation(); if (onOpenDeptControl) onOpenDeptControl(); }}
            className="px-2 py-1 border border-blue-200 rounded text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors" title="Department Control"
          >
            <Component size={10} />
          </button>
          {isSuperAdmin && (
            <>
              {onOpenPermissions && (
                <button onClick={() => onOpenPermissions(unit.id)} className="px-2 py-1 border border-indigo-200 rounded text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 transition-colors" title="Manage Permissions">
                  <Shield size={10} />
                </button>
              )}
              {eff !== 'pending' ? (
                <button onClick={() => onToggleStatus(unit.id)} className="px-2 py-1 border border-red-300 rounded text-[9px] font-black uppercase text-red-500 hover:bg-red-50 flex items-center gap-1 transition-colors">
                  <Ban size={10} />
                </button>
              ) : (
                <button onClick={() => onApprove?.(unit)} className="px-2 py-1 border border-green-500 rounded text-[9px] font-black uppercase text-green-600 hover:bg-green-50 flex items-center gap-1 transition-colors">
                  <Check size={10} />
                </button>
              )}
              <button onClick={() => onEdit(unit)} className="px-2 py-1 border border-orange-300 rounded text-[9px] font-black uppercase text-orange-500 hover:bg-orange-50 flex items-center gap-1 transition-colors">
                <Pencil size={10} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-3 mb-4">
        <div className="flex justify-between items-center mb-1">
           <div className="flex gap-2">
               <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${badges[eff === 'pending' ? 'pending' : (unit.subscriptionType || 'basic')]}`}>
                {eff === 'pending' ? 'PENDING' : unit.subscriptionType?.toUpperCase() || 'BASIC'}
               </span>
               <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                  <Factory size={8} className="text-slate-400" />
                  {INDUSTRY_CONFIGS[unit.industryType as IndustryType]?.label || 'General'}
               </span>
           </div>
        </div>
        {eff !== 'pending' && (
          <div className="text-[10px] space-y-1.5 pb-3 border-b border-dotted border-slate-300">
            <p className="font-bold text-slate-400">Expires: <span className="text-slate-800">{formatDate(unit.subscriptionEndDate)}</span></p>
            <p className="font-bold text-slate-400">Status: <span className={`font-black ${statusColor}`}>{getStatusText(unit)}</span></p>
          </div>
        )}
        <div className="space-y-3 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 flex items-center gap-1">
            <Users size={10} /> Node Access Contacts ({contacts.length})
          </p>
          {contacts.map((c, i) => (
            <div key={i} className="space-y-1 pb-2 border-b border-slate-50 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-700">
                <IdCard size={12} className="text-indigo-400 shrink-0" />
                <span className="truncate">{c.name}</span>
                <span className="text-[8px] text-slate-400 font-bold ml-auto">{c.role || 'User'}</span>
              </div>
              {c.email && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500">
                  <Mail size={12} className="shrink-0" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
              {c.phone && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500">
                  <Phone size={11} className="shrink-0 text-slate-400" />
                  <span>{c.phone}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {isSuperAdmin && (
        <div className="mt-auto pt-3 border-t border-slate-200 flex gap-1.5">
          {eff === 'expired' ? (
            <button onClick={() => onEdit(unit)} className="flex-1 py-1.5 bg-white border border-blue-400 rounded text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors">
              <RefreshCw size={10} /> Renew Expired
            </button>
          ) : eff !== 'pending' ? (
            <>
              <button onClick={() => onEdit(unit)} className="flex-1 py-1.5 bg-white border border-blue-400 rounded text-[9px] font-black uppercase text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors">
                <RefreshCcw size={10} /> Renew
              </button>
              <button onClick={() => onEdit(unit)} className="flex-1 py-1.5 bg-white border border-purple-400 rounded text-[9px] font-black uppercase text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-1 transition-colors">
                <Zap size={10} /> Upgrade
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

interface MasterItem {
  value: string;
  source: HierarchyScope;
}

interface MasterDataSectionProps {
  entity: Entity;
  entities: Entity[];
  title: string;
  color: string;
  icon: any;
  canEdit: boolean;
  newDept: string;
  setNewDept: (v: string) => void;
  newRole: string;
  setNewRole: (v: string) => void;
  newCategory: string;
  setNewCategory: (v: string) => void;
  newCategoryWorkforce: 'core' | 'extended';
  setNewCategoryWorkforce: (v: 'core' | 'extended') => void;
  onAdd: (id: string, type: 'department' | 'role' | 'category') => void;
  onRemove: (id: string, type: 'department' | 'role' | 'category', val: string) => void;
  onRename: (config: any) => void;
}

const MasterDataSection = ({ 
  entity, entities, title, color, icon: Icon, canEdit, 
  newDept, setNewDept, newRole, setNewRole, 
  newCategory, setNewCategory, newCategoryWorkforce, setNewCategoryWorkforce,
  onAdd, onRemove, onRename 
}: MasterDataSectionProps) => {
  const getInheritedItems = (entId: string | undefined, type: 'dept' | 'role'): MasterItem[] => {
    if (!entId) return [];
    const ent = entities.find(e => e.id === entId);
    if (!ent) return [];
    const parentItems = getInheritedItems(ent.parentId, type);
    const key = type === 'dept' ? 'masterDepartments' : 'masterRoles';
    const localItems: MasterItem[] = (ent[key] || []).map((v: string) => ({ value: v, source: ent.type }));
    return [...parentItems, ...localItems];
  };
  const getInheritedCategories = (entId: string | undefined): (MasterItem & { workforce: 'core' | 'extended' })[] => {
    if (!entId) return [];
    const ent = entities.find(e => e.id === entId);
    if (!ent) return [];
    const parentItems = getInheritedCategories(ent.parentId);
    const localItems = (ent.masterCategories || []).map(c => ({ value: c.name, source: ent.type as HierarchyScope, workforce: c.workforce }));
    return [...parentItems, ...localItems];
  };
  const allDepartments = useMemo(() => getInheritedItems(entity.id, 'dept'), [entity, entities]);
  const allRoles = useMemo(() => getInheritedItems(entity.id, 'role'), [entity, entities]);
  const allCategories = useMemo(() => getInheritedCategories(entity.id), [entity, entities]);
  const renderItemPill = (item: MasterItem, type: 'department' | 'role' | 'category') => {
    const isLocal = item.source === entity.type;
    return (
      <span key={`${item.source}-${item.value}`} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase shadow-sm transition-all ${isLocal ? 'bg-white text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-400 italic border-slate-200 opacity-80'}`}>
        {!isLocal && <Lock size={10} className="text-slate-400" />}
        <ScopeIdentityBadge scope={item.source} />
        <span className="max-w-[120px] truncate">{item.value}</span>
        {isLocal && canEdit && (
          <div className="flex gap-1.5 ml-1 border-l border-slate-100 pl-1.5">
            <button onClick={() => onRename({ isOpen: true, type, entityId: entity.id, oldValue: item.value })} className="text-slate-300 hover:text-blue-500"><Pencil size={12} /></button>
            <button onClick={() => onRemove(entity.id, type, item.value)} className="text-slate-300 hover:text-red-500"><X size={12} /></button>
          </div>
        )}
      </span>
    );
  };
  const renderCategoryPill = (item: MasterItem & { workforce: 'core' | 'extended' }) => {
    const isLocal = item.source === entity.type;
    const wfColor = item.workforce === 'core' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200';
    return (
      <span key={`${item.source}-${item.value}`} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase shadow-sm transition-all ${isLocal ? 'bg-white text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-400 italic border-slate-200 opacity-80'}`}>
        {!isLocal && <Lock size={10} className="text-slate-400" />}
        <ScopeIdentityBadge scope={item.source} />
        <span className="max-w-[100px] truncate">{item.value}</span>
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${wfColor}`}>{item.workforce === 'core' ? 'CORE' : 'EXT'}</span>
        {isLocal && canEdit && (
          <div className="flex gap-1.5 ml-1 border-l border-slate-100 pl-1.5">
            <button onClick={() => onRename({ isOpen: true, type: 'category', entityId: entity.id, oldValue: item.value })} className="text-slate-300 hover:text-blue-500"><Pencil size={12} /></button>
            <button onClick={() => onRemove(entity.id, 'category', item.value)} className="text-slate-300 hover:text-red-500"><X size={12} /></button>
          </div>
        )}
      </span>
    );
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm overflow-hidden relative mb-4 sm:mb-6">
      <ManagementHeader title={title} subtitle="Organizational Structure Definitions" icon={Icon} color={color} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 relative z-10">
          <div className="space-y-4">
            <h5 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Users size={14} className="text-blue-500" /> Departments</h5>
            {canEdit && (
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Add Dept" 
                  className="flex-1 px-3 py-2 bg-slate-50 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  value={newDept} onChange={e => setNewDept(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && onAdd(entity.id, 'department')}
                />
                <button onClick={() => onAdd(entity.id, 'department')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase active:scale-95 transition-all">Add</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 min-h-[60px]">
              {allDepartments.map(item => renderItemPill(item, 'department'))}
              {allDepartments.length === 0 && <p className="text-[10px] text-slate-400 italic m-auto">No departments defined.</p>}
            </div>
          </div>
          <div className="space-y-4">
            <h5 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Briefcase size={14} className="text-purple-500" /> Roles</h5>
            {canEdit && (
              <div className="flex gap-2">
                <input 
                  type="text" placeholder="Add Role" 
                  className="flex-1 px-3 py-2 bg-slate-50 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-purple-500/20 outline-none" 
                  value={newRole} onChange={e => setNewRole(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && onAdd(entity.id, 'role')}
                />
                <button onClick={() => onAdd(entity.id, 'role')} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-black uppercase active:scale-95 transition-all">Add</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 min-h-[60px]">
              {allRoles.map(item => renderItemPill(item, 'role'))}
              {allRoles.length === 0 && <p className="text-[10px] text-slate-400 italic m-auto">No roles defined.</p>}
            </div>
          </div>
          <div className="space-y-4">
            <h5 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Tag size={14} className="text-teal-500" /> Staff Categories</h5>
            {canEdit && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="Add Category" 
                    className="flex-1 px-3 py-2 bg-slate-50 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-teal-500/20 outline-none" 
                    value={newCategory} onChange={e => setNewCategory(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && onAdd(entity.id, 'category')}
                  />
                  <button onClick={() => onAdd(entity.id, 'category')} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-black uppercase active:scale-95 transition-all">Add</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setNewCategoryWorkforce('core')} className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${newCategoryWorkforce === 'core' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>Core Workforce</button>
                  <button onClick={() => setNewCategoryWorkforce('extended')} className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all ${newCategoryWorkforce === 'extended' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>Extended Workforce</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 min-h-[60px]">
              {allCategories.map(item => renderCategoryPill(item))}
              {allCategories.length === 0 && <p className="text-[10px] text-slate-400 italic m-auto">No staff categories defined.</p>}
            </div>
          </div>
      </div>
    </div>
  );
};


interface CorporateManagementProps {
  entities: Entity[];
  onEntityClick: (id: string) => void;
  onUpdateEntity: (entity: Entity) => void;
  onAddEntity: (entity: Entity) => void;
  onFlushEntitySaves?: () => Promise<void> | void;
  currentScope: HierarchyScope;
  activeSubTab?: string;
  userRootId?: string | null;
  licenseSchema: Category[];
  setLicenseSchema: React.Dispatch<React.SetStateAction<Category[]>>;
  onOpenPermissions?: (targetId?: string) => void;
  navItems: NavItem[];
  onUpdateNavConfig?: React.Dispatch<React.SetStateAction<NavItem[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
}

const CorporateManagement: React.FC<CorporateManagementProps> = ({ 
  entities, 
  onUpdateEntity, 
  onAddEntity,
  onFlushEntitySaves,
  currentScope,
  activeSubTab,
  userRootId,
  licenseSchema,
  setLicenseSchema,
  onOpenPermissions,
  navItems,
  onUpdateNavConfig,
  employees,
  setEmployees
}) => {
  if (activeSubTab === 'corp-users') {
    // Fixed: Type cast to any to allow passing employees and setEmployees props as EmployeeManagementProps is missing them in the truncated source.
    const EmpMgmt = EmployeeManagement as any;
    return <EmpMgmt employees={employees} setEmployees={setEmployees} entities={entities} currentScope={currentScope} userRootId={userRootId} />;
  }
  if (activeSubTab === 'corp-matrix') {
    return <EscalationMatrix navItems={navItems} onUpdateNavConfig={onUpdateNavConfig} currentScope={currentScope} entities={entities} onUpdateEntity={onUpdateEntity} userRootId={userRootId} employees={employees} />;
  }
  if (activeSubTab === 'corp-notifications') {
    return <NotificationSettings currentScope={currentScope} />;
  }
  if (activeSubTab === 'corp-food-safety-team') {
    return <FoodSafetyTeam entities={entities} currentScope={currentScope} userRootId={userRootId} />;
  }

  const isSuperAdmin = currentScope === 'super-admin';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutomationOpen, setIsAutomationOpen] = useState(false);
  const [isDeptControlOpen, setIsDeptControlOpen] = useState(false);
  const [deptControlUnit, setDeptControlUnit] = useState<string>("");

  const [modalType, setModalType] = useState<any>(null);
  const [editingEntity, setEditingEntity] = useState<any>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [uploadContext, setUploadContext] = useState<{ type: 'regional' | 'unit', parentId: string } | null>(null);
  type BulkUnitRow = { _rowId: string; unitName: string; unitIdNum: string; regionalName: string; subscriptionType: string; industryType: string; address: string; contactName: string; contactEmail: string; contactPhone: string; subscribedDate: string; _errors: string[]; };
  const [bulkRows, setBulkRows] = useState<BulkUnitRow[]>([]);
  const [bulkCorpId, setBulkCorpId] = useState<string | null>(null);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [formContacts, setFormContacts] = useState<EntityContact[]>([]);
  const [expandedCorpId, setExpandedCorpId] = useState<string | null>(null);
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());
  const [newDept, setNewDept] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryWorkforce, setNewCategoryWorkforce] = useState<'core' | 'extended'>('core');
  const [newLocation, setNewLocation] = useState("");
  const [newSubLocation, setNewSubLocation] = useState("");
  const [activeDeptForLocation, setActiveDeptForLocation] = useState<string | null>(null);
  const [activeAreaForPersonnel, setActiveAreaForPersonnel] = useState<string | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [expandedLocationDepts, setExpandedLocationDepts] = useState<Set<string>>(new Set());
  const [renameState, setRenameState] = useState<{
    isOpen: boolean;
    type: 'department' | 'role' | 'category' | 'location';
    entityId: string;
    oldValue: string;
    groupKey?: string; 
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // ---- Auto-fix orphan recipes when an entity gets renamed ----
  // Recipes carry SNAPSHOT location strings (corporateName / regionalName /
  // unitName) — they don't reference entities by id. Renaming a Corporate /
  // Region / Unit therefore silently orphans every recipe still holding the
  // old name. After a successful rename we ask the API how many recipes still
  // reference the old name, and if any do, prompt the admin with a one-click
  // "Update recipes too" option that bulk-renames the snapshot strings via
  // /api/recipes/rename-location.
  const [recipeRenamePrompt, setRecipeRenamePrompt] = useState<{
    field: 'corporateName' | 'regionalName' | 'unitName';
    typeLabel: string;
    oldName: string;
    newName: string;
    count: number;
  } | null>(null);
  const [recipeRenameBusy, setRecipeRenameBusy] = useState(false);
  const [recipeRenameToast, setRecipeRenameToast] = useState<string | null>(null);

  const ENTITY_TYPE_TO_RECIPE_FIELD: Record<string, 'corporateName' | 'regionalName' | 'unitName'> = {
    corporate: 'corporateName',
    regional: 'regionalName',
    unit: 'unitName',
  };

  const maybePromptRecipeRename = async (
    entityType: string,
    oldName: string,
    newName: string
  ) => {
    const field = ENTITY_TYPE_TO_RECIPE_FIELD[entityType];
    if (!field) return;
    const trimmedOld = (oldName || '').trim();
    const trimmedNew = (newName || '').trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;
    try {
      const resp = await fetch(
        `/api/recipes/rename-location?field=${encodeURIComponent(field)}&oldName=${encodeURIComponent(trimmedOld)}`
      );
      if (!resp.ok) return;
      const json = await resp.json().catch(() => ({}));
      const count = Number(json?.count || 0);
      if (count <= 0) return;
      const typeLabel = entityType === 'corporate' ? 'Corporate' : entityType === 'regional' ? 'Region' : 'Unit';
      setRecipeRenamePrompt({ field, typeLabel, oldName: trimmedOld, newName: trimmedNew, count });
    } catch (err) {
      // Silent failure — the existing orphan indicator in Recipe Studio still
      // catches anything we miss here.
      console.warn('Recipe-rename precheck failed:', err);
    }
  };

  const confirmRecipeRename = async () => {
    if (!recipeRenamePrompt || recipeRenameBusy) return;
    setRecipeRenameBusy(true);
    try {
      const resp = await fetch('/api/recipes/rename-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field: recipeRenamePrompt.field,
          oldName: recipeRenamePrompt.oldName,
          newName: recipeRenamePrompt.newName,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      // Only treat the rename as successful if the server actually returned
      // OK + a count field. A failing endpoint may still respond with JSON
      // (e.g. {error: ...}) — surfacing a fake "Updated N recipes" toast in
      // that case would be worse than no toast.
      if (!resp.ok || typeof json?.count !== 'number') {
        const msg = (json && (json.error || json.message)) || 'Failed to update recipes — please try again.';
        setRecipeRenameToast(String(msg));
        setTimeout(() => setRecipeRenameToast(null), 4500);
        // Keep the prompt open so the admin can retry without redoing the rename.
        return;
      }
      const count = Number(json.count);
      setRecipeRenameToast(
        `Updated ${count} recipe${count === 1 ? '' : 's'} to "${recipeRenamePrompt.newName}".`
      );
      setTimeout(() => setRecipeRenameToast(null), 4000);
      setRecipeRenamePrompt(null);
    } catch (err) {
      console.error('Failed to rename recipes:', err);
      setRecipeRenameToast('Failed to update recipes — please try again.');
      setTimeout(() => setRecipeRenameToast(null), 4500);
      // Network failure → keep the prompt open so a retry is one click away.
    } finally {
      setRecipeRenameBusy(false);
    }
  };

  const findAncestorIdByType = (entityId: string | null | undefined, type: HierarchyScope, allEntities: Entity[]): string | undefined => {
     if (!entityId) return undefined;
     const entity = allEntities.find(e => e.id === entityId);
     if (!entity) return undefined;
     if (entity.type === type) return entity.id;
     return findAncestorIdByType(entity.parentId, type, allEntities);
  };

  const nestUnitsWithChildren = (unitList: Entity[]) => {
    return unitList.map(unit => {
      const departments = entities
        .filter(e => e.type === 'department' && e.parentId === unit.id)
        .map(dept => ({
          ...dept,
          users: entities.filter(u => u.type === 'user' && u.parentId === dept.id)
        }));
      return { ...unit, departments };
    });
  };

  const nestedData = useMemo(() => {
    if (['regional', 'unit', 'department', 'user'].includes(currentScope)) return [];
    let allowedCorpIds: string[] = [];
    if (currentScope === 'super-admin') {
      allowedCorpIds = entities.filter(e => e.type === 'corporate').map(e => e.id);
    } else if (userRootId) {
       const corpId = findAncestorIdByType(userRootId, 'corporate', entities);
       if (corpId) allowedCorpIds = [corpId];
    }
    return entities
      .filter(e => e.type === 'corporate' && allowedCorpIds.includes(e.id))
      .map(corp => {
        const regionals = entities
          .filter(e => e.type === 'regional' && e.parentId === corp.id)
          .map(reg => ({
            ...reg,
            units: nestUnitsWithChildren(entities.filter(u => u.type === 'unit' && u.parentId === reg.id))
          }));
        return { ...corp, regionals };
      });
  }, [entities, currentScope, userRootId]);

  const activeRegion = useMemo(() => {
    if (currentScope !== 'regional' || !userRootId) return null;
    const region = entities.find(e => e.id === userRootId);
    if (!region) return null;
    const units = nestUnitsWithChildren(entities.filter(e => e.type === 'unit' && e.parentId === region.id));
    return { ...region, units };
  }, [entities, currentScope, userRootId]);

  const activeUnit = useMemo(() => {
    if (!['unit', 'department', 'user'].includes(currentScope) || !userRootId) return null;
    const unitId = findAncestorIdByType(userRootId, 'unit', entities);
    const unit = entities.find(e => e.id === unitId);
    if (!unit) return null;
    const departments = entities
      .filter(e => e.type === 'department' && e.parentId === unit.id)
      .map(dept => ({
        ...dept,
        users: entities.filter(u => u.type === 'user' && u.parentId === dept.id)
      }));
    return { ...unit, departments };
  }, [entities, currentScope, userRootId]);

  const ancestorChain = useMemo(() => {
    if (!userRootId || currentScope === 'super-admin') return {};
    const chain: Record<string, string> = {};
    let current = entities.find(e => e.id === userRootId);
    while (current) {
      chain[current.type] = current.name;
      if (!current.parentId) break;
      current = entities.find(e => e.id === current!.parentId);
    }
    return chain;
  }, [entities, userRootId, currentScope]);

  const getStats = (items: any[]) => {
    const s = { pending: 0, active: 0, expirySoon: 0, expired: 0 };
    items.forEach(u => {
      const eff = getEffectiveStatus(u);
      if (eff === 'pending') s.pending++;
      else if (eff === 'active') s.active++;
      else if (eff === 'expiry-soon') s.expirySoon++;
      else if (eff === 'expired' || u.status === 'inactive') s.expired++;
    });
    return s;
  };

  const unitEmployees = useMemo(() => {
    if (!activeUnit) return [];
    return employees.filter(e => e.Unit === activeUnit.name);
  }, [employees, activeUnit]);

  const filteredPersonnelOptions = useMemo(() => {
    if (!personnelSearch.trim()) return [];
    return unitEmployees.filter(emp => 
        emp.Name.toLowerCase().includes(personnelSearch.toLowerCase()) ||
        emp.Email?.toLowerCase().includes(personnelSearch.toLowerCase())
    ).slice(0, 5);
  }, [unitEmployees, personnelSearch]);

  const handleOpenModal = (type: any, parentId: string | null = null, entity: any = null) => {
    setModalType(type);
    setTargetParentId(parentId);
    setEditingEntity(entity);
    setLogoPreview(entity?.logoSrc || null);
    if (entity && entity.additionalContacts && entity.additionalContacts.length > 0) {
      setFormContacts([...entity.additionalContacts]);
    } else if (entity) {
      setFormContacts([{
        name: entity.contactPerson || '',
        role: 'Primary Contact',
        email: entity.email || '',
        phone: entity.phone || '',
        password: '' 
      }]);
    } else {
      setFormContacts([{ name: '', role: '', email: '', phone: '', password: '' }]);
    }
    setIsModalOpen(true);
  };

  const openDeptControl = (unitName: string) => {
    setDeptControlUnit(unitName);
    setIsDeptControlOpen(true);
  };

  const handleExportData = () => {};
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries()) as any;
    const activeParentId = editingEntity ? editingEntity.parentId : (targetParentId || data.regionalId);
    const validContacts = formContacts.filter(c => c.name.trim() !== '');
    let subscriptionEndDate = undefined;
    if (data.subscribedDate && data.subscriptionType) {
        const duration = SUBSCRIPTION_DURATIONS[data.subscriptionType as SubscriptionType] || 365;
        const startDate = new Date(data.subscribedDate);
        startDate.setDate(startDate.getDate() + duration);
        subscriptionEndDate = startDate.toISOString().split('T')[0];
    } else if (data.subscribedDate) {
        const startDate = new Date(data.subscribedDate);
        startDate.setFullYear(startDate.getFullYear() + 1);
        subscriptionEndDate = startDate.toISOString().split('T')[0];
    }
    const payload: any = {
      ...editingEntity,
      id: editingEntity?.id || `ent-${Date.now()}`,
      entityIdNum: data.entityIdNum,
      name: data.name,
      type: modalType,
      address: data.address,
      contactPerson: validContacts[0]?.name || '',
      email: validContacts[0]?.email || '',
      phone: validContacts[0]?.phone || '',
      additionalContacts: validContacts,
      description: data.description,
      status: editingEntity?.status || (modalType === 'unit' ? 'pending-approval' : 'active'),
      parentId: activeParentId,
      logoSrc: logoPreview,
      subscriptionType: data.subscriptionType,
      subscribedDate: data.subscribedDate,
      subscriptionEndDate: subscriptionEndDate,
      autoRenewal: data.autoRenewal === 'on', 
      industryType: data.industryType
    };
    if (editingEntity) onUpdateEntity(payload);
    else onAddEntity(payload);
    // Force-flush queued entity writes so the user's edits actually
    // hit the database immediately instead of waiting for the 1.5s
    // debounce (which can be lost if the user reloads or navigates).
    if (onFlushEntitySaves) {
      try { void onFlushEntitySaves(); } catch (err) { console.error('Entity flush failed:', err); }
    }
    setIsModalOpen(false);
    setLogoPreview(null);
    // After an edit, if the entity was a Corporate/Region/Unit and its name
    // changed, surface the orphan-recipe prompt. Fire-and-forget — the entity
    // save itself doesn't depend on the recipe-side check.
    if (editingEntity && editingEntity.name && editingEntity.name !== payload.name) {
      void maybePromptRecipeRename(payload.type, editingEntity.name, payload.name);
    }
  };
  const handleAddMasterData = (entityId: string, type: 'department' | 'role' | 'category') => {
    const ent = entities.find(e => e.id === entityId);
    if (!ent) return;
    if (type === 'category') {
      const val = newCategory.trim();
      if (!val) return;
      const currentList = ent.masterCategories || [];
      if (currentList.some(c => c.name === val)) {
        alert('Category already exists in this scope.');
        return;
      }
      onUpdateEntity({ ...ent, masterCategories: [...currentList, { name: val, workforce: newCategoryWorkforce }] });
      setNewCategory("");
      return;
    }
    const val = type === 'department' ? newDept.trim() : newRole.trim();
    if (!val) return;
    const key = type === 'department' ? 'masterDepartments' : 'masterRoles';
    const currentList = ent[key] || [];
    if (currentList.includes(val)) {
        alert('Item already exists in this scope.');
        return;
    }
    onUpdateEntity({ ...ent, [key]: [...currentList, val] });
    if (type === 'department') setNewDept("");
    else setNewRole("");
  };
  const handleRemoveMasterData = (entityId: string, type: 'department' | 'role' | 'category', value: string) => {
    const ent = entities.find(e => e.id === entityId);
    if (!ent) return;
    if (type === 'category') {
      const currentList = ent.masterCategories || [];
      onUpdateEntity({ ...ent, masterCategories: currentList.filter(c => c.name !== value) });
      return;
    }
    const key = type === 'department' ? 'masterDepartments' : 'masterRoles';
    const currentList = ent[key] || [];
    onUpdateEntity({ ...ent, [key]: currentList.filter((v: string) => v !== value) });
  };
  const handleAddLocation = (unitId: string, deptName: string) => {
    const unit = entities.find(u => u.id === unitId);
    if (!unit || !newLocation.trim()) return;
    const locs = unit.departmentLocations || {};
    const currentList = locs[deptName] || [];
    if (currentList.includes(newLocation.trim())) return;
    onUpdateEntity({ ...unit, departmentLocations: { ...locs, [deptName]: [...currentList, newLocation.trim()] } });
    setNewLocation("");
  };
  const handleRemoveLocation = (unitId: string, deptName: string, loc: string) => {
      const unit = entities.find(u => u.id === unitId);
      if (!unit) return;
      const locs = unit.departmentLocations || {};
      const currentList = locs[deptName] || [];
      const subLocs = { ...(unit.departmentSubLocations || {}) };
      const subKey = `${deptName}::${loc}`;
      delete subLocs[subKey];
      onUpdateEntity({ ...unit, departmentLocations: { ...locs, [deptName]: currentList.filter(l => l !== loc) }, departmentSubLocations: subLocs });
  };
  const handleAddSubLocation = (unitId: string, deptName: string, locName: string) => {
      const unit = entities.find(u => u.id === unitId);
      if (!unit || !newSubLocation.trim()) return;
      const subLocs = unit.departmentSubLocations || {};
      const key = `${deptName}::${locName}`;
      const currentList = subLocs[key] || [];
      if (currentList.includes(newSubLocation.trim())) return;
      onUpdateEntity({ ...unit, departmentSubLocations: { ...subLocs, [key]: [...currentList, newSubLocation.trim()] } });
      setNewSubLocation("");
  };
  const handleRemoveSubLocation = (unitId: string, deptName: string, locName: string, subLoc: string) => {
      const unit = entities.find(u => u.id === unitId);
      if (!unit) return;
      const subLocs = unit.departmentSubLocations || {};
      const key = `${deptName}::${locName}`;
      const currentList = subLocs[key] || [];
      onUpdateEntity({ ...unit, departmentSubLocations: { ...subLocs, [key]: currentList.filter(s => s !== subLoc) } });
  };

  const handleAssignPersonnel = (unitId: string, deptName: string, areaName: string, employeeId: string) => {
    const unit = entities.find(u => u.id === unitId);
    if (!unit) return;
    const assignments = unit.locationAssignments || {};
    const deptAssignments = assignments[deptName] || {};
    const areaPersonnel = deptAssignments[areaName] || [];
    if (areaPersonnel.includes(employeeId)) return;
    onUpdateEntity({ 
        ...unit, 
        locationAssignments: { 
            ...assignments, 
            [deptName]: { 
                ...deptAssignments, 
                [areaName]: [...areaPersonnel, employeeId] 
            } 
        } 
    });
    setPersonnelSearch("");
  };

  const handleUnassignPersonnel = (unitId: string, deptName: string, areaName: string, employeeId: string) => {
      const unit = entities.find(u => u.id === unitId);
      if (!unit) return;
      const assignments = unit.locationAssignments || {};
      const deptAssignments = assignments[deptName] || {};
      const areaPersonnel = deptAssignments[areaName] || [];
      onUpdateEntity({ 
          ...unit, 
          locationAssignments: { 
              ...assignments, 
              [deptName]: { 
                  ...deptAssignments, 
                  [areaName]: areaPersonnel.filter(id => id !== employeeId) 
              } 
          } 
      });
  };

  const handleRenameSave = () => {
    if (!renameState || !renameValue.trim()) return;
    const ent = entities.find(e => e.id === renameState.entityId);
    if (!ent) return;
    if (renameState.type === 'location' && renameState.groupKey) {
        const locs = ent.departmentLocations || {};
        const list = locs[renameState.groupKey] || [];
        onUpdateEntity({ ...ent, departmentLocations: { ...locs, [renameState.groupKey]: list.map(l => l === renameState.oldValue ? renameValue.trim() : l) } });
    } else if (renameState.type === 'category') {
        const list = ent.masterCategories || [];
        onUpdateEntity({ ...ent, masterCategories: list.map(c => c.name === renameState.oldValue ? { ...c, name: renameValue.trim() } : c) });
    } else {
        const key = renameState.type === 'department' ? 'masterDepartments' : 'masterRoles';
        const list = ent[key] || [];
        onUpdateEntity({ ...ent, [key]: list.map((v: string) => v === renameState.oldValue ? renameValue.trim() : v) });
    }
    setRenameState(null);
    setRenameValue("");
  };
  const renderRenameModal = () => {
    if (!renameState) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
        <div className="bg-white rounded-t-xl sm:rounded-xl p-4 sm:p-6 shadow-2xl w-full sm:max-w-sm">
          <h4 className="text-sm font-black uppercase text-slate-800 mb-4">Rename {renameState.type}</h4>
          <input autoFocus className="w-full border p-2 rounded-lg mb-4 text-sm font-bold" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameSave()} />
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 text-xs font-bold text-slate-500" onClick={() => setRenameState(null)}>Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase" onClick={handleRenameSave}>Update</button>
          </div>
        </div>
      </div>
    );
  };

  // Modal + toast for the auto-fix-orphan-recipes flow. Rendered alongside
  // every existing renderRenameModal() call site so it shows regardless of
  // which scope-specific return branch is active.
  const renderRecipeRenamePrompt = () => {
    return (
      <>
        {recipeRenamePrompt && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/50 sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl p-5 sm:p-6 shadow-2xl w-full sm:max-w-md">
              <h4 className="text-sm font-black uppercase text-slate-800 mb-2 flex items-center gap-2">
                <RefreshCcw size={14} className="text-amber-600" />
                Update recipes too?
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                <span className="font-bold text-slate-800">{recipeRenamePrompt.count}</span>{' '}
                recipe{recipeRenamePrompt.count === 1 ? '' : 's'} still reference the old{' '}
                {recipeRenamePrompt.typeLabel.toLowerCase()} name{' '}
                <span className="font-bold text-slate-800">"{recipeRenamePrompt.oldName}"</span>.
                Rename {recipeRenamePrompt.count === 1 ? 'it' : 'them'} to{' '}
                <span className="font-bold text-slate-800">"{recipeRenamePrompt.newName}"</span> so{' '}
                {recipeRenamePrompt.count === 1 ? 'it stays' : 'they stay'} filterable in Recipe Studio?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-xs font-bold text-slate-500 disabled:opacity-50"
                  onClick={() => setRecipeRenamePrompt(null)}
                  disabled={recipeRenameBusy}
                >
                  Skip
                </button>
                <button
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-black uppercase disabled:opacity-50"
                  onClick={confirmRecipeRename}
                  disabled={recipeRenameBusy}
                >
                  {recipeRenameBusy ? 'Updating…' : 'Update recipes too'}
                </button>
              </div>
            </div>
          </div>
        )}
        {recipeRenameToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-2xl">
            {recipeRenameToast}
          </div>
        )}
      </>
    );
  };
  const downloadBulkTemplate = () => {
    const headers = ['Unit Name','Unit ID','Regional Name','Subscription Plan','Industry','Address','Contact Name','Contact Email','Contact Phone','Start Date'];
    const example = ['Main Kitchen HQ','U-001','North Region','basic','hospitality','123 Street','John Smith','john@example.com','+44 7700 000000','2025-01-01'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Units Template');
    XLSX.writeFile(wb, 'bulk_units_template.xlsx');
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !uploadContext) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\/]+/g, '');
        const get = (row: any, ...keys: string[]) => {
          for (const k of keys) { const fk = Object.keys(row).find(rk => norm(rk) === norm(k)); if (fk !== undefined) return String(row[fk] || '').trim(); }
          return '';
        };
        const parsed: BulkUnitRow[] = json
          .map((row, i) => ({
            _rowId: `bulk-${Date.now()}-${i}`,
            unitName: get(row, 'Unit Name','unitname','name','Unit'),
            unitIdNum: get(row, 'Unit ID','unitid','id','entityIdNum'),
            regionalName: get(row, 'Regional Name','Regional','region','regionname'),
            subscriptionType: (get(row, 'Subscription Plan','subscription','subscriptionType','plan') || 'basic').toLowerCase(),
            industryType: (get(row, 'Industry','industryType','sector') || 'general').toLowerCase(),
            address: get(row, 'Address','address','location'),
            contactName: get(row, 'Contact Name','contactname','contactperson'),
            contactEmail: get(row, 'Contact Email','contactemail','email'),
            contactPhone: get(row, 'Contact Phone','contactphone','phone','mobile'),
            subscribedDate: get(row, 'Start Date','startdate','subscribedDate','date'),
            _errors: [],
          }))
          .filter(r => r.unitName.trim() !== '');
        setBulkRows(parsed);
        setBulkCorpId(uploadContext.parentId);
        setBulkReviewOpen(true);
      } catch { alert('Could not read file. Please use a valid CSV or Excel (.xlsx) file.'); }
    };
    reader.readAsBinaryString(f);
  };
  const renderBulkReviewModal = () => {
    if (!bulkReviewOpen) return null;
    const corp = entities.find(e => e.id === bulkCorpId);
    const regionals = entities.filter(e => e.type === 'regional' && e.parentId === bulkCorpId);
    const validSubTypes = ['trial','basic','advance','pro'];
    const validIndustries = Object.keys(INDUSTRY_CONFIGS);
    const validated = bulkRows.map(r => {
      const errs: string[] = [];
      if (!r.unitName.trim()) errs.push('Unit name required');
      if (r.regionalName && !regionals.find(reg => reg.name.toLowerCase() === r.regionalName.toLowerCase())) errs.push(`Regional "${r.regionalName}" not found`);
      if (!validSubTypes.includes(r.subscriptionType)) errs.push(`Invalid plan "${r.subscriptionType}"`);
      if (!validIndustries.includes(r.industryType)) errs.push(`Invalid industry "${r.industryType}"`);
      return { ...r, _errors: errs };
    });
    const validCount = validated.filter(r => r._errors.length === 0).length;
    const handleSubmit = () => {
      setBulkSubmitting(true);
      const today = new Date().toISOString().split('T')[0];
      validated.filter(r => r._errors.length === 0).forEach(row => {
        const reg = regionals.find(re => re.name.toLowerCase() === row.regionalName.toLowerCase());
        const sd = row.subscribedDate || today;
        const subType = (row.subscriptionType as SubscriptionType) || 'basic';
        const duration = SUBSCRIPTION_DURATIONS[subType] || 365;
        const endDt = new Date(sd); endDt.setDate(endDt.getDate() + duration);
        const payload: any = {
          id: `ent-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          type: 'unit', parentId: reg?.id || bulkCorpId,
          name: row.unitName, entityIdNum: row.unitIdNum,
          address: row.address, contactPerson: row.contactName,
          email: row.contactEmail, phone: row.contactPhone,
          status: 'pending-approval',
          subscriptionType: subType, subscribedDate: sd,
          subscriptionEndDate: endDt.toISOString().split('T')[0],
          industryType: row.industryType || 'general',
          additionalContacts: row.contactName ? [{ name: row.contactName, email: row.contactEmail, phone: row.contactPhone, role: 'Primary Contact', password: '' }] : [],
        };
        onAddEntity(payload);
      });
      setBulkReviewOpen(false); setBulkRows([]); setBulkCorpId(null); setBulkSubmitting(false);
    };
    const updateRow = (rowId: string, field: string, val: string) => setBulkRows(prev => prev.map(r => r._rowId === rowId ? { ...r, [field]: val } : r));
    const removeRow = (rowId: string) => setBulkRows(prev => prev.filter(r => r._rowId !== rowId));
    return (
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-6xl flex flex-col max-h-[95vh] sm:max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight flex items-center gap-2 truncate"><Upload size={14} className="text-blue-600 shrink-0" /> Bulk Upload Review</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Corporate: <span className="font-bold text-blue-700">{corp?.name}</span> · {validated.length} rows parsed · <span className={validCount === validated.length ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{validCount} valid</span>{validated.length - validCount > 0 && <span className="text-rose-500 font-bold"> · {validated.length - validCount} with errors</span>}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadBulkTemplate} className="px-3 py-1.5 text-[10px] font-black uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5"><FileSpreadsheet size={13} /> Template</button>
              <button onClick={() => { setBulkReviewOpen(false); setBulkRows([]); setBulkCorpId(null); }} className="p-2 hover:bg-slate-200 rounded-full"><X size={18} className="text-slate-500" /></button>
            </div>
          </div>
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  {['#','Unit Name *','Unit ID','Regional Name *','Plan','Industry','Address','Contact Name','Email','Phone','Start Date','Status',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-black text-slate-500 uppercase tracking-widest text-[9px] border-b border-slate-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validated.map((row, idx) => {
                  const hasErr = row._errors.length > 0;
                  return (
                    <tr key={row._rowId} className={`border-b border-slate-100 transition-colors ${hasErr ? 'bg-rose-50/60' : 'bg-white hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 text-slate-400 font-bold shrink-0">{idx + 1}</td>
                      <td className="px-2 py-1.5"><input value={row.unitName} onChange={e => updateRow(row._rowId,'unitName',e.target.value)} className={`w-36 px-2 py-1 rounded border text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400 ${!row.unitName ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} /></td>
                      <td className="px-2 py-1.5"><input value={row.unitIdNum} onChange={e => updateRow(row._rowId,'unitIdNum',e.target.value)} className="w-20 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5">
                        <select value={row.regionalName} onChange={e => updateRow(row._rowId,'regionalName',e.target.value)} className={`w-36 px-2 py-1 rounded border text-[11px] font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 ${row._errors.some(e => e.includes('Regional')) ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                          <option value="">— Select —</option>
                          {regionals.map(re => <option key={re.id} value={re.name}>{re.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5"><select value={row.subscriptionType} onChange={e => updateRow(row._rowId,'subscriptionType',e.target.value)} className="w-20 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400">{['trial','basic','advance','pro'].map(p=><option key={p} value={p}>{p}</option>)}</select></td>
                      <td className="px-2 py-1.5"><select value={row.industryType} onChange={e => updateRow(row._rowId,'industryType',e.target.value)} className="w-24 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400">{Object.entries(INDUSTRY_CONFIGS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></td>
                      <td className="px-2 py-1.5"><input value={row.address} onChange={e => updateRow(row._rowId,'address',e.target.value)} className="w-32 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5"><input value={row.contactName} onChange={e => updateRow(row._rowId,'contactName',e.target.value)} className="w-28 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5"><input value={row.contactEmail} onChange={e => updateRow(row._rowId,'contactEmail',e.target.value)} className="w-36 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5"><input value={row.contactPhone} onChange={e => updateRow(row._rowId,'contactPhone',e.target.value)} className="w-28 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-2 py-1.5"><input type="date" value={row.subscribedDate} onChange={e => updateRow(row._rowId,'subscribedDate',e.target.value)} className="w-32 px-2 py-1 rounded border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" /></td>
                      <td className="px-3 py-2 shrink-0">
                        {hasErr ? (
                          <div className="flex flex-col gap-0.5">{row._errors.map((er,i) => <span key={i} className="text-[9px] text-rose-600 font-bold bg-rose-100 px-1.5 py-0.5 rounded whitespace-nowrap">{er}</span>)}</div>
                        ) : (
                          <span className="text-[9px] text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check size={9} /> Valid</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5"><button onClick={() => removeRow(row._rowId)} className="p-1 text-slate-300 hover:text-rose-500 transition-colors rounded"><Trash size={13} /></button></td>
                    </tr>
                  );
                })}
                {validated.length === 0 && (
                  <tr><td colSpan={13} className="text-center py-12 text-slate-400 text-sm">No rows to review</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <p className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">{validCount}</span> of {validated.length} units will be created as <span className="font-bold text-amber-600">Pending Approval</span></p>
            <div className="flex gap-3">
              <button onClick={() => { setBulkReviewOpen(false); setBulkRows([]); setBulkCorpId(null); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-100">Cancel</button>
              <button onClick={handleSubmit} disabled={validCount === 0 || bulkSubmitting} className="px-6 py-2 bg-[#0077b6] text-white rounded-lg text-xs font-black uppercase shadow hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {bulkSubmitting ? <><Clock size={13} className="animate-spin" /> Saving…</> : <><Check size={13} /> Submit {validCount} Unit{validCount !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const renderModal = () => (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm sm:text-lg font-black text-slate-800 tracking-tight truncate">
            {editingEntity ? `Edit ${modalType === 'corporate' ? 'Corporate' : modalType === 'regional' ? 'Regional' : 'Unit'}` : `Add ${modalType === 'corporate' ? 'Corporate' : modalType === 'regional' ? 'Regional' : 'Unit'}`}
          </h3>
          <button onClick={() => { setIsModalOpen(false); setLogoPreview(null); }} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <form id="entityForm" onSubmit={handleSave} className="space-y-6">
            {modalType === 'corporate' && (
               <div className="flex justify-center mb-4">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                      {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover" alt="Logo" /> : <ImageIcon className="text-slate-400" />}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { const r = new FileReader(); r.onload = async () => { const compressed = await compressImage(r.result as string); setLogoPreview(compressed); }; r.readAsDataURL(f); }
                    }} />
                  </div>
               </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">ID Number</label>
                  <input name="entityIdNum" placeholder="e.g. C-001" defaultValue={editingEntity?.entityIdNum} className="w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Entity Name</label>
                  <input required name="name" defaultValue={editingEntity?.name} className="w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
              {modalType === 'corporate' && (
                <div className="sm:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Industry</label><select name="industryType" defaultValue={editingEntity?.industryType || 'general'} className="w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm font-bold">{Object.entries(INDUSTRY_CONFIGS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              )}
              <div className="sm:col-span-2"><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Address</label><input name="address" defaultValue={editingEntity?.address} className="w-full px-3 py-2.5 bg-slate-50 border rounded-lg text-sm font-bold" /></div>
            </div>
            {modalType === 'unit' && isSuperAdmin && (
                <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3 sm:space-y-4 animate-in slide-in-from-top-2">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <CreditCard size={14} className="text-emerald-600" /> Subscription & Billing
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Plan Tier</label>
                            <div className="relative">
                                <select name="subscriptionType" defaultValue={editingEntity?.subscriptionType || 'basic'} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none appearance-none">
                                    {Object.entries(PLANS).map(([k, v]) => (<option key={k} value={k}>{v.label} ({v.price})</option>))}
                                </select>
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Crown size={14} /></div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Industry Sector</label>
                            <select name="industryType" defaultValue={editingEntity?.industryType || 'general'} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none">
                                {Object.entries(INDUSTRY_CONFIGS).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                            <input type="date" name="subscribedDate" defaultValue={editingEntity?.subscribedDate} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold" />
                        </div>
                        <div className="flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 w-full hover:border-emerald-200 transition-colors">
                                <input type="checkbox" name="autoRenewal" defaultChecked={editingEntity?.autoRenewal} className="accent-emerald-600 w-4 h-4" />
                                <span className="text-xs font-bold text-slate-700">Auto-Renewal Enabled</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
               <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-2">
                     <Users size={14} className="text-blue-500" /> Key Contacts
                  </h4>
                  <button type="button" onClick={() => setFormContacts([...formContacts, { name: '', role: '', email: '', phone: '', password: '' }])} className="text-[10px] font-bold text-blue-600 bg-white border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition-colors">
                     + Add
                  </button>
               </div>
               <div className="space-y-3">
                  {formContacts.map((contact, idx) => (
                     <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                        <button type="button" onClick={() => setFormContacts(formContacts.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 z-10"><X size={14} /></button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2">
                           <input placeholder="Name" value={contact.name} onChange={e => { const n = [...formContacts]; n[idx].name = e.target.value; setFormContacts(n); }} className="w-full px-2.5 py-2 bg-slate-50 border rounded text-xs font-bold" />
                           <input placeholder="Role / Designation" value={contact.role} onChange={e => { const n = [...formContacts]; n[idx].role = e.target.value; setFormContacts(n); }} className="w-full px-2.5 py-2 bg-slate-50 border rounded text-xs" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                           <input placeholder="Email" value={contact.email} onChange={e => { const n = [...formContacts]; n[idx].email = e.target.value; setFormContacts(n); }} className="w-full px-2.5 py-2 bg-slate-50 border rounded text-xs" />
                           <input placeholder="Mobile" value={contact.phone} onChange={e => { const n = [...formContacts]; n[idx].phone = e.target.value; setFormContacts(n); }} className="w-full px-2.5 py-2 bg-slate-50 border rounded text-xs" />
                           <div className="relative">
                              <KeyRound size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input type="text" placeholder="Password" value={contact.password || ''} onChange={e => { const n = [...formContacts]; n[idx].password = e.target.value; setFormContacts(n); }} className="w-full pl-7 px-2.5 py-2 bg-slate-50 border rounded text-xs text-slate-600" />
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          </form>
        </div>
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button onClick={() => { setIsModalOpen(false); setLogoPreview(null); }} className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase hover:bg-slate-100 transition-colors text-center">Cancel</button>
          <button form="entityForm" type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-black uppercase shadow-lg hover:bg-slate-800 transition-colors active:scale-95 text-center">Save Details</button>
        </div>
      </div>
    </div>
  );
  const canEditMasterData = isSuperAdmin || currentScope === 'corporate' || currentScope === 'regional' || currentScope === 'unit';
  const getAllVisibleDepartments = (entity: Entity) => {
    const getAggregated = (entId: string | undefined): string[] => {
      if(!entId) return [];
      const ent = entities.find(e => e.id === entId);
      if(!ent) return [];
      return [...getAggregated(ent.parentId), ...(ent.masterDepartments || [])];
    };
    return [...new Set(getAggregated(entity.id))];
  };

  if (activeUnit) {
      return (
         <div className="space-y-3 sm:space-y-6 pb-20 p-2 sm:p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
             {isModalOpen && renderModal()}
             {renderRenameModal()}
             {renderRecipeRenamePrompt()}
             {isAutomationOpen && <AutomationPanel entities={entities} onClose={() => setIsAutomationOpen(false)} />}
             {isDeptControlOpen && <DepartmentControl navItems={navItems} onClose={() => setIsDeptControlOpen(false)} unitName={activeUnit.name} />}
             
             {Object.keys(ancestorChain).length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2.5 sm:py-3 flex items-center gap-1.5 sm:gap-2 flex-wrap overflow-x-auto">
                   <Lock size={11} className="text-slate-400 shrink-0" />
                   <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-widest shrink-0">Hierarchy</span>
                   {ancestorChain.corporate && <span className="text-[8px] sm:text-[9px] font-black uppercase bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-lg border border-blue-200 flex items-center gap-1 shrink-0"><Building2 size={9} /><span className="truncate max-w-[80px] sm:max-w-none">{ancestorChain.corporate}</span></span>}
                   {ancestorChain.corporate && ancestorChain.regional && <span className="text-slate-300 shrink-0">→</span>}
                   {ancestorChain.regional && <span className="text-[8px] sm:text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 px-1.5 sm:px-2 py-0.5 rounded-lg border border-indigo-200 flex items-center gap-1 shrink-0"><Globe size={9} /><span className="truncate max-w-[80px] sm:max-w-none">{ancestorChain.regional}</span></span>}
                   {ancestorChain.regional && <span className="text-slate-300 shrink-0">→</span>}
                   <span className="text-[8px] sm:text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-1.5 sm:px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 shrink-0"><LayoutGrid size={9} /><span className="truncate max-w-[80px] sm:max-w-none">{activeUnit.name}</span></span>
                   {ancestorChain.department && <>
                      <span className="text-slate-300 shrink-0">→</span>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase bg-orange-100 text-orange-700 px-1.5 sm:px-2 py-0.5 rounded-lg border border-orange-200 flex items-center gap-1 shrink-0"><Layers size={9} /><span className="truncate max-w-[80px] sm:max-w-none">{ancestorChain.department}</span></span>
                   </>}
                   {ancestorChain.user && <>
                      <span className="text-slate-300 shrink-0">→</span>
                      <span className="text-[8px] sm:text-[9px] font-black uppercase bg-slate-200 text-slate-700 px-1.5 sm:px-2 py-0.5 rounded-lg border border-slate-300 flex items-center gap-1 shrink-0"><Users size={9} /><span className="truncate max-w-[80px] sm:max-w-none">{ancestorChain.user}</span></span>
                   </>}
                </div>
             )}
             <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 sm:items-center sm:justify-between mb-3 sm:mb-0">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3"><LayoutGrid className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> <span className="truncate">{activeUnit.name}</span></h2>
                    <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5 sm:mt-1 uppercase tracking-widest truncate">{activeUnit.location}</p>
                  </div>
                  <button 
                    onClick={() => openDeptControl(activeUnit.name)}
                    className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shrink-0"
                  >
                    <Component size={16} /> Department Control
                  </button>
                </div>
                <div className="mt-3 sm:mt-4">
                  <UnitCard unit={activeUnit} onEdit={u => handleOpenModal('unit', null, u)} onToggleStatus={id => onUpdateEntity({...activeUnit, status: activeUnit.status === 'active' ? 'inactive' : 'active'})} onApprove={u => onUpdateEntity({...u, status: 'active'})} isSuperAdmin={isSuperAdmin} onOpenPermissions={onOpenPermissions} onOpenDeptControl={() => openDeptControl(activeUnit.name)} />
                </div>
             </div>

             {(activeUnit as any).departments && (activeUnit as any).departments.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-3xl p-3 sm:p-6 shadow-sm">
                   <ManagementHeader title="Department & User Hierarchy" subtitle="Department → User Structure" icon={Layers} color="bg-orange-500" />
                   <div className="space-y-2 mt-4">
                      {(activeUnit as any).departments.map((dept: any) => {
                         const isDeptExp = expandedDeptIds.has(dept.id);
                         const isLockedDept = currentScope === 'department' && ancestorChain.department === dept.name;
                         const isLockedUser = currentScope === 'user';
                         return (
                            <div key={dept.id} className={`rounded-xl border overflow-hidden ${isDeptExp ? 'border-orange-200 shadow-sm' : 'border-slate-200'} ${isLockedDept || isLockedUser ? 'ring-2 ring-orange-300' : ''}`}>
                               <button onClick={() => setExpandedDeptIds(prev => { const n = new Set(prev); n.has(dept.id) ? n.delete(dept.id) : n.add(dept.id); return n; })} className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-orange-50/50 transition-colors">
                                  <div className="flex items-center gap-3">
                                     <div className={`p-2 rounded-xl border ${isDeptExp ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-500 border-orange-200'}`}><Layers size={14} /></div>
                                     <div className="text-left">
                                        <span className="text-xs font-black text-slate-700 uppercase">{dept.name}</span>
                                        {dept.email && <p className="text-[9px] text-slate-400 font-bold">{dept.email}</p>}
                                     </div>
                                     {isLockedDept && <Lock size={10} className="text-orange-400" />}
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{dept.users?.length || 0} users</span>
                                     <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${dept.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{dept.status}</span>
                                     <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDeptExp ? 'rotate-180' : ''}`} />
                                  </div>
                               </button>
                               {isDeptExp && (
                                  <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50/50">
                                     {(dept.users || []).length > 0 ? dept.users.map((usr: any) => {
                                        const isCurrentUser = currentScope === 'user' && ancestorChain.user === usr.name;
                                        return (
                                           <div key={usr.id} className={`flex items-center justify-between px-3 py-2 bg-white rounded-lg border transition-colors ${isCurrentUser ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-100 hover:border-indigo-200'}`}>
                                              <div className="flex items-center gap-2.5">
                                                 <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px]">{usr.name?.charAt(0) || 'U'}</div>
                                                 <div>
                                                    <span className="text-[11px] font-black text-slate-700">{usr.name}</span>
                                                    {usr.email && <span className="text-[9px] text-slate-400 ml-2">{usr.email}</span>}
                                                 </div>
                                                 {isCurrentUser && <Lock size={10} className="text-indigo-400" />}
                                              </div>
                                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${usr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{usr.status}</span>
                                           </div>
                                        );
                                     }) : (
                                        <div className="text-[10px] text-slate-400 italic text-center py-3">No users assigned to this department</div>
                                     )}
                                  </div>
                               )}
                            </div>
                         );
                      })}
                   </div>
                </div>
             )}
             <MasterDataSection entity={activeUnit} entities={entities} title="Unit Local Definitions" color="bg-emerald-600" icon={ShieldAlert} canEdit={canEditMasterData} newDept={newDept} setNewDept={setNewDept} newRole={newRole} setNewRole={setNewRole} newCategory={newCategory} setNewCategory={setNewCategory} newCategoryWorkforce={newCategoryWorkforce} setNewCategoryWorkforce={setNewCategoryWorkforce} onAdd={handleAddMasterData} onRemove={handleRemoveMasterData} onRename={setRenameState} />
             
             {/* Precision Resource Mapping — Redesigned Tree Layout */}
             <div className="bg-white border border-slate-200 rounded-xl sm:rounded-3xl p-3 sm:p-6 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
                   <ManagementHeader title="Precision Resource Mapping" subtitle="Dept → Location → Sub-Location" icon={MapPin} color="bg-orange-500" />
                   <div className="flex items-center gap-3">
                      {(() => {
                         const allDepts = getAllVisibleDepartments(activeUnit);
                         const deptLocs = activeUnit.departmentLocations || {};
                         const totalLocs = Object.values(deptLocs).reduce((s, arr) => s + arr.length, 0);
                         const totalSubs = Object.values(activeUnit.departmentSubLocations || {}).reduce((s, arr) => s + arr.length, 0);
                         return (
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                               <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] sm:text-[9px] font-black uppercase">{allDepts.length} Depts</span>
                               <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-[8px] sm:text-[9px] font-black uppercase">{totalLocs} Locs</span>
                               {totalSubs > 0 && <span className="hidden sm:inline-flex px-2.5 py-1 bg-teal-50 text-teal-600 border border-teal-100 rounded-lg text-[9px] font-black uppercase">{totalSubs} Sub-Locs</span>}
                            </div>
                         );
                      })()}
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 max-h-[700px] overflow-y-auto custom-scrollbar">
                   {getAllVisibleDepartments(activeUnit).map((dept: string) => {
                      const deptLocations = activeUnit.departmentLocations?.[dept] || [];
                      const isExpanded = expandedLocationDepts.has(dept);
                      const totalStaff = deptLocations.reduce((sum, loc) => sum + (activeUnit.locationAssignments?.[dept]?.[loc] || []).length, 0);
                      const subLocCount = deptLocations.reduce((sum, loc) => sum + (activeUnit.departmentSubLocations?.[`${dept}::${loc}`] || []).length, 0);
                      return (
                         <div key={dept} className={`rounded-2xl border-2 transition-all overflow-hidden flex flex-col ${isExpanded ? 'border-indigo-200 shadow-md col-span-full' : 'border-slate-100 hover:border-slate-200'}`}>
                            <button
                               onClick={() => {
                                  setExpandedLocationDepts(prev => {
                                     const next = new Set(prev);
                                     if (next.has(dept)) { next.delete(dept); setActiveDeptForLocation(null); setActiveAreaForPersonnel(null); }
                                     else { next.add(dept); setActiveDeptForLocation(dept); }
                                     return next;
                                  });
                               }}
                               className={`w-full px-4 py-3 flex items-center justify-between transition-all ${isExpanded ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}
                            >
                               <div className="flex items-center gap-3 min-w-0">
                                  <div className={`p-2 rounded-xl border transition-all shrink-0 ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                     <Layers size={16} />
                                  </div>
                                  <div className="text-left min-w-0">
                                     <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">{dept}</p>
                                     <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                                           <MapPin size={8} className="text-orange-400" /> {deptLocations.length}
                                        </span>
                                        {subLocCount > 0 && (
                                           <span className="text-[8px] font-bold text-teal-500 uppercase flex items-center gap-0.5">
                                              <GitBranch size={8} /> {subLocCount}
                                           </span>
                                        )}
                                        {totalStaff > 0 && (
                                           <span className="text-[8px] font-bold text-indigo-500 uppercase flex items-center gap-0.5">
                                              <Users size={8} /> {totalStaff}
                                           </span>
                                        )}
                                     </div>
                                  </div>
                               </div>
                               <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {!isExpanded && deptLocations.length > 0 && (
                               <div className="px-3 pb-3 pt-1 bg-white flex-1">
                                  <div className="space-y-1.5">
                                     {deptLocations.map((loc: string) => {
                                        const subKey = `${dept}::${loc}`;
                                        const subLocs = activeUnit.departmentSubLocations?.[subKey] || [];
                                        const staffCount = (activeUnit.locationAssignments?.[dept]?.[loc] || []).length;
                                        return (
                                           <div key={loc} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                                              <div className="flex items-center justify-between">
                                                 <div className="flex items-center gap-1.5 min-w-0">
                                                    <MapPin size={10} className="text-orange-400 shrink-0" />
                                                    <span className="text-[9px] font-black text-slate-700 uppercase truncate">{loc}</span>
                                                 </div>
                                                 <div className="flex items-center gap-1 shrink-0">
                                                    {staffCount > 0 && <span className="text-[7px] font-bold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded">{staffCount}</span>}
                                                 </div>
                                              </div>
                                              {subLocs.length > 0 && (
                                                 <div className="flex flex-wrap gap-1 mt-1 pl-4">
                                                    {subLocs.map((sub: string) => (
                                                       <span key={sub} className="text-[7px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded">
                                                          {sub}
                                                       </span>
                                                    ))}
                                                 </div>
                                              )}
                                           </div>
                                        );
                                     })}
                                  </div>
                               </div>
                            )}
                            {!isExpanded && deptLocations.length === 0 && (
                               <div className="px-3 pb-3 pt-1 bg-white flex-1 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-amber-500 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase">No locations</span>
                               </div>
                            )}

                            {isExpanded && (
                               <div className="bg-slate-50/30 border-t border-slate-100 px-5 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                  <div className="flex gap-2 bg-white p-1 rounded-xl border-2 border-slate-100 focus-within:border-orange-400 transition-all shadow-sm">
                                     <input
                                        type="text"
                                        placeholder={`Add location to ${dept}...`}
                                        className="flex-1 px-3 py-2 bg-transparent text-xs font-bold outline-none"
                                        value={activeDeptForLocation === dept ? newLocation : ''}
                                        onChange={e => { setActiveDeptForLocation(dept); setNewLocation(e.target.value); }}
                                        onKeyDown={e => e.key === 'Enter' && handleAddLocation(activeUnit.id, dept)}
                                     />
                                     <button onClick={() => { setActiveDeptForLocation(dept); handleAddLocation(activeUnit.id, dept); }} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shrink-0">
                                        <Plus size={14} /> Add
                                     </button>
                                  </div>

                                  {deptLocations.length > 0 ? (
                                     <div className="space-y-3">
                                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 px-1">
                                           <MapPin size={10} className="text-orange-500" /> Locations ({deptLocations.length})
                                        </label>
                                        <div className="space-y-2">
                                           {deptLocations.map((loc: string) => {
                                              const subKey = `${dept}::${loc}`;
                                              const subLocs = activeUnit.departmentSubLocations?.[subKey] || [];
                                              const staffCount = (activeUnit.locationAssignments?.[dept]?.[loc] || []).length;
                                              const assignedIds = activeUnit.locationAssignments?.[dept]?.[loc] || [];
                                              return (
                                                 <div key={loc} className="bg-white border border-slate-100 rounded-xl p-3 group hover:border-orange-200 hover:shadow-sm transition-all">
                                                    <div className="flex items-center justify-between mb-1">
                                                       <div className="flex items-center gap-2 min-w-0">
                                                          <MapPin size={13} className="text-orange-400 shrink-0" />
                                                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{loc}</span>
                                                          {staffCount > 0 && <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">{staffCount} staff</span>}
                                                       </div>
                                                       <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                          <button onClick={() => setRenameState({ isOpen: true, type: 'location', entityId: activeUnit.id, oldValue: loc, groupKey: dept })} className="p-1 text-slate-300 hover:text-blue-500 rounded transition-colors" title="Rename"><Pencil size={11} /></button>
                                                          <button onClick={() => handleRemoveLocation(activeUnit.id, dept, loc)} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors" title="Remove"><X size={11} /></button>
                                                       </div>
                                                    </div>
                                                    {subLocs.length > 0 && (
                                                       <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                                                          {subLocs.map((sub: string) => (
                                                             <span key={sub} className="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md text-[9px] font-bold flex items-center gap-1 group/sub">
                                                                <GitBranch size={8} className="text-teal-400" />
                                                                {sub}
                                                                <button onClick={() => handleRemoveSubLocation(activeUnit.id, dept, loc, sub)} className="text-teal-300 hover:text-red-500 transition-colors opacity-0 group-hover/sub:opacity-100"><X size={9} /></button>
                                                             </span>
                                                          ))}
                                                       </div>
                                                    )}
                                                    {assignedIds.length > 0 && (
                                                       <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
                                                          {assignedIds.map((id: string) => {
                                                             const emp = employees.find(e => e.id === id);
                                                             if (!emp) return null;
                                                             return (
                                                                <span key={id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[8px] font-bold flex items-center gap-1 group/staff">
                                                                   <div className="w-4 h-4 rounded bg-slate-800 text-white flex items-center justify-center font-black text-[7px] shrink-0">{emp.Name.charAt(0)}</div>
                                                                   {emp.Name}
                                                                   <button onClick={() => handleUnassignPersonnel(activeUnit.id, dept, loc, id)} className="text-indigo-300 hover:text-red-500 transition-colors opacity-0 group-hover/staff:opacity-100"><X size={8} /></button>
                                                                </span>
                                                             );
                                                          })}
                                                       </div>
                                                    )}
                                                 </div>
                                              );
                                           })}
                                        </div>

                                        <div className="flex gap-2 items-center">
                                           <select
                                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-teal-400 transition-all"
                                              value={activeDeptForLocation === dept ? (activeAreaForPersonnel || '') : ''}
                                              onChange={e => { setActiveDeptForLocation(dept); setActiveAreaForPersonnel(e.target.value || null); }}
                                           >
                                              <option value="">Select location...</option>
                                              {deptLocations.map((loc: string) => <option key={loc} value={loc}>{loc}</option>)}
                                           </select>
                                           <input
                                              type="text"
                                              placeholder="Sub-location name..."
                                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-teal-400 transition-all"
                                              value={activeDeptForLocation === dept ? newSubLocation : ''}
                                              onChange={e => { setActiveDeptForLocation(dept); setNewSubLocation(e.target.value); }}
                                              onKeyDown={e => { if (e.key === 'Enter' && activeAreaForPersonnel) handleAddSubLocation(activeUnit.id, dept, activeAreaForPersonnel); }}
                                           />
                                           <button
                                              onClick={() => { if (activeAreaForPersonnel && activeDeptForLocation === dept) handleAddSubLocation(activeUnit.id, dept, activeAreaForPersonnel); }}
                                              className="px-2.5 py-1.5 bg-teal-500 text-white rounded-lg text-[9px] font-black uppercase active:scale-95 transition-all shrink-0 flex items-center gap-1"
                                           >
                                              <Plus size={12} /> Sub
                                           </button>
                                        </div>

                                        {deptLocations.length > 0 && (
                                           <div className="pt-3 border-t border-slate-100">
                                              <label className="text-[9px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1.5 px-1 mb-2">
                                                 <UserPlus size={10} /> Personnel Assignment
                                              </label>
                                              <div className="flex gap-2 items-center mb-3">
                                                 <select
                                                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-400 transition-all"
                                                    value={activeDeptForLocation === dept ? (activeAreaForPersonnel || '') : ''}
                                                    onChange={e => { setActiveDeptForLocation(dept); setActiveAreaForPersonnel(e.target.value || null); }}
                                                 >
                                                    <option value="">Select location...</option>
                                                    {deptLocations.map((loc: string) => <option key={loc} value={loc}>{loc}</option>)}
                                                 </select>
                                                 {activeAreaForPersonnel && activeDeptForLocation === dept && (
                                                    <div className="flex-1 relative">
                                                       <div className="relative group">
                                                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 group-focus-within:text-indigo-600" />
                                                          <input
                                                             type="text"
                                                             placeholder={`Search staff for ${activeAreaForPersonnel}...`}
                                                             className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:border-indigo-400 bg-white transition-all"
                                                             value={personnelSearch}
                                                             onChange={e => setPersonnelSearch(e.target.value)}
                                                          />
                                                       </div>
                                                       {filteredPersonnelOptions.length > 0 && (
                                                          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-40 overflow-y-auto">
                                                             {filteredPersonnelOptions.map(emp => (
                                                                <button
                                                                   key={emp.id}
                                                                   onClick={() => handleAssignPersonnel(activeUnit.id, dept, activeAreaForPersonnel!, emp.id)}
                                                                   className="w-full text-left p-2.5 hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex items-center gap-2.5 group transition-colors"
                                                                >
                                                                   <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] border border-indigo-100 shrink-0">{emp.Name.charAt(0)}</div>
                                                                   <div className="min-w-0 flex-1">
                                                                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{emp.Name}</p>
                                                                   </div>
                                                                   <UserPlus size={12} className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />
                                                                </button>
                                                             ))}
                                                          </div>
                                                       )}
                                                    </div>
                                                 )}
                                              </div>
                                           </div>
                                        )}
                                     </div>
                                  ) : (
                                     <div className="py-6 flex flex-col items-center justify-center text-center opacity-50">
                                        <MapPin size={24} className="text-slate-300 mb-1.5" />
                                        <p className="text-[10px] font-bold uppercase text-slate-400">No locations defined for {dept}</p>
                                     </div>
                                  )}
                               </div>
                            )}
                         </div>
                      );
                   })}
                   {getAllVisibleDepartments(activeUnit).length === 0 && (
                      <div className="col-span-full py-16 flex flex-col items-center justify-center text-center">
                         <Layers size={40} className="text-slate-200 mb-3" />
                         <p className="text-sm font-black text-slate-400 uppercase tracking-tight">No Departments Available</p>
                         <p className="text-[10px] font-bold text-slate-300 mt-1">Add departments via Master Data to begin mapping</p>
                      </div>
                   )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
                   <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shrink-0">
                      <ClipboardList size={14} />
                   </div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Locations defined here are available in the <span className="text-indigo-600 font-black">Internal Audit Schedule</span> tab for location-level auditor assignment
                   </p>
                </div>
             </div>
         </div>
      );
  }
  if (activeRegion) {
      const regStats = getStats(activeRegion.units);
      return (
        <div className="space-y-3 sm:space-y-6 pb-20 p-2 sm:p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
           {isModalOpen && renderModal()}
           {renderRenameModal()}
           {renderRecipeRenamePrompt()}
           {isAutomationOpen && <AutomationPanel entities={entities} onClose={() => setIsAutomationOpen(false)} />}
           <div className="bg-white p-3 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 sm:items-center sm:justify-between">
                <div className="min-w-0">
                   <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2 sm:gap-3 truncate"><Globe className="text-indigo-600 w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> <span className="truncate">{activeRegion.name}</span></h2>
                      {(activeRegion as any).entityIdNum && <span className="text-[10px] sm:text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold shrink-0">{(activeRegion as any).entityIdNum}</span>}
                   </div>
                   <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5 sm:mt-1 uppercase tracking-widest truncate">{activeRegion.address}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                   <div className="flex gap-1.5 bg-slate-50 p-1.5 sm:p-2 rounded-xl border">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white border rounded text-slate-600">Units: {activeRegion.units.length}</span>
                      <span className="text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-600 text-white rounded">Active: {regStats.active}</span>
                   </div>
                   {isSuperAdmin && <button onClick={() => handleOpenModal('unit', activeRegion.id)} className="w-full sm:w-auto bg-slate-900 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all text-center">+ Add Unit</button>}
                </div>
              </div>
           </div>
           <ContactInfoGrid title="Regional Office Management Contacts" contacts={activeRegion.additionalContacts} entity={activeRegion} onEdit={(e) => handleOpenModal('regional', null, e)} isSuperAdmin={isSuperAdmin} />
           <MasterDataSection entity={activeRegion} entities={entities} title="Regional Definitions" color="bg-indigo-600" icon={ShieldAlert} canEdit={canEditMasterData} newDept={newDept} setNewDept={setNewDept} newRole={newRole} setNewRole={setNewRole} newCategory={newCategory} setNewCategory={setNewCategory} newCategoryWorkforce={newCategoryWorkforce} setNewCategoryWorkforce={setNewCategoryWorkforce} onAdd={handleAddMasterData} onRemove={handleRemoveMasterData} onRename={setRenameState} />
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-8">
              {activeRegion.units.map((unit: any) => {
                 const isUnitExp = expandedUnitIds.has(unit.id);
                 const deptCount = unit.departments?.length || 0;
                 const userCount = (unit.departments || []).reduce((s: number, d: any) => s + (d.users?.length || 0), 0);
                 return (
                   <div key={unit.id} className={`rounded-xl border transition-all overflow-hidden ${isUnitExp ? 'border-emerald-200 shadow-md' : 'border-slate-200'}`}>
                      <div className="flex-1"><UnitCard unit={unit} onEdit={u => handleOpenModal('unit', null, u)} onToggleStatus={id => onUpdateEntity({...unit, status: unit.status === 'active' ? 'inactive' : 'active'})} onApprove={u => onUpdateEntity({...u, status: 'active'})} isSuperAdmin={isSuperAdmin} onOpenPermissions={onOpenPermissions} onOpenDeptControl={() => openDeptControl(unit.name)} /></div>
                      {(deptCount > 0 || isSuperAdmin) && (
                         <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
                            <button onClick={() => setExpandedUnitIds(prev => { const n = new Set(prev); n.has(unit.id) ? n.delete(unit.id) : n.add(unit.id); return n; })} className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-500 hover:text-emerald-600 transition-colors w-full">
                               <ChevronDown size={12} className={`transition-transform ${isUnitExp ? 'rotate-180' : ''}`} />
                               <Layers size={11} className="text-orange-400" />
                               {deptCount} Department{deptCount !== 1 ? 's' : ''} · {userCount} User{userCount !== 1 ? 's' : ''}
                            </button>
                         </div>
                      )}
                      {isUnitExp && (
                         <div className="bg-orange-50/30 border-t border-slate-100 px-4 py-3 space-y-2">
                            {isSuperAdmin && (
                               <button onClick={() => handleOpenModal('department' as any, unit.id)} className="text-[9px] font-black uppercase text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-2">
                                  <Plus size={12} /> Add Department
                               </button>
                            )}
                            {(unit.departments || []).map((dept: any) => {
                               const isDeptExp = expandedDeptIds.has(dept.id);
                               return (
                                  <div key={dept.id} className={`rounded-lg border overflow-hidden ${isDeptExp ? 'border-orange-200 bg-white shadow-sm' : 'border-slate-200 bg-white'}`}>
                                     <button onClick={() => setExpandedDeptIds(prev => { const n = new Set(prev); n.has(dept.id) ? n.delete(dept.id) : n.add(dept.id); return n; })} className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                           <div className="p-1 bg-orange-100 rounded"><Layers size={11} className="text-orange-500" /></div>
                                           <span className="text-[10px] font-black text-slate-700 uppercase">{dept.name}</span>
                                           {dept.email && <span className="text-[8px] text-slate-400 font-bold">{dept.email}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                           <span className="text-[8px] font-bold text-slate-400">{dept.users?.length || 0} users</span>
                                           <ChevronDown size={10} className={`text-slate-400 transition-transform ${isDeptExp ? 'rotate-180' : ''}`} />
                                        </div>
                                     </button>
                                     {isDeptExp && (
                                        <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/50">
                                           {isSuperAdmin && (
                                              <button onClick={() => handleOpenModal('user' as any, dept.id)} className="text-[8px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-1">
                                                 <Plus size={10} /> Add User
                                              </button>
                                           )}
                                           {(dept.users || []).length > 0 ? dept.users.map((usr: any) => (
                                              <div key={usr.id} className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                                                 <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[9px]">{usr.name?.charAt(0) || 'U'}</div>
                                                    <div>
                                                       <span className="text-[10px] font-black text-slate-700">{usr.name}</span>
                                                       {usr.email && <span className="text-[8px] text-slate-400 ml-2">{usr.email}</span>}
                                                    </div>
                                                 </div>
                                                 <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${usr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{usr.status}</span>
                                              </div>
                                           )) : (
                                              <div className="text-[9px] text-slate-400 italic text-center py-2">No users assigned</div>
                                           )}
                                        </div>
                                     )}
                                  </div>
                               );
                            })}
                            {deptCount === 0 && (
                               <div className="text-[9px] text-slate-400 italic text-center py-3">No departments defined</div>
                            )}
                         </div>
                      )}
                   </div>
                 );
              })}
           </div>
        </div>
      );
  }
  return (
      <div className="space-y-3 sm:space-y-6 animate-in fade-in duration-500 pb-20 p-2 sm:p-4 md:p-6 lg:p-8">
        <input type="file" accept=".csv,.xlsx,.xls" ref={csvInputRef} onChange={handleCsvFileChange} className="hidden" />
        {isModalOpen && renderModal()}
        {renderBulkReviewModal()}
        {renderRenameModal()}
        {renderRecipeRenamePrompt()}
        {isAutomationOpen && <AutomationPanel entities={entities} onClose={() => setIsAutomationOpen(false)} />}
        {isDeptControlOpen && <DepartmentControl navItems={navItems} onClose={() => setIsDeptControlOpen(false)} unitName={deptControlUnit} />}
        
        {isSuperAdmin && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
             <div className="flex gap-2">
                <button onClick={handleExportData} className="flex-1 sm:flex-none px-3 sm:px-5 py-2.5 bg-green-600 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 sm:gap-2"><FileSpreadsheet size={14} /> Export</button>
                <button onClick={() => setIsAutomationOpen(true)} className="flex-1 sm:flex-none px-3 sm:px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 sm:gap-2"><Bot size={14} /> Automation</button>
             </div>
             <button onClick={() => handleOpenModal('corporate')} className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-[#0077b6] text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 text-center">+ Add Corporate</button>
          </div>
        )}
        <div className="space-y-6">
          {nestedData.map(corp => {
            const corpStats = getStats(corp.regionals.flatMap((r:any) => r.units));
            const isCorpExpanded = expandedCorpId === corp.id;
            return (
              <details key={corp.id} open={isCorpExpanded} className="group bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden transition-all">
                <summary onClick={(e) => { e.preventDefault(); setExpandedCorpId(isCorpExpanded ? null : corp.id); setExpandedRegId(null); }} className="flex items-center justify-between list-none cursor-pointer bg-[#0077b6] text-white px-3 sm:px-6 py-3 sm:py-4 shadow-inner select-none">
                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
                    {corp.logoSrc ? <img src={corp.logoSrc} className="w-8 h-8 sm:w-10 sm:h-10 object-contain bg-white p-0.5 sm:p-1 rounded border border-white/20 shrink-0" alt="Logo" /> : <Building2 size={20} className="shrink-0 sm:w-6 sm:h-6" />}
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                           <span className="font-black text-sm sm:text-xl tracking-tight leading-none truncate">{corp.name}</span>
                           {corp.entityIdNum && <span className="text-[8px] sm:text-[10px] font-mono bg-white/20 px-1 sm:px-1.5 rounded shrink-0 hidden sm:inline">{corp.entityIdNum}</span>}
                        </div>
                        <span className="text-[8px] sm:text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-0.5 sm:mt-1 opacity-90 truncate">{INDUSTRY_CONFIGS[corp.industryType as IndustryType]?.label || 'Standard'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="hidden lg:flex gap-2 mr-4">
                      <StatusBadge label="Regions" count={corp.regionals.length} />
                      <StatusBadge label="Units" count={corpStats.active} />
                    </div>
                    {isSuperAdmin && (
                      <div className="hidden sm:flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleOpenModal('corporate', null, corp)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20"><Pencil size={14} /></button>
                        <button onClick={downloadBulkTemplate} className="px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 flex items-center gap-1.5" title="Download CSV template"><FileSpreadsheet size={12} /> CSV</button>
                        <button onClick={() => { setUploadContext({ type: 'unit', parentId: corp.id }); csvInputRef.current?.click(); }} className="px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 flex items-center gap-1.5"><Upload size={12} /> Bulk</button>
                        <button onClick={() => handleOpenModal('regional', corp.id)} className="px-3 py-1.5 bg-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/20">+ Regional</button>
                      </div>
                    )}
                    <ChevronDown className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 ${isCorpExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </summary>
                <div className="p-3 sm:p-6 bg-[#fcfdfe] border-t border-slate-100 space-y-4 sm:space-y-8 animate-in slide-in-from-top-2">
                  {isSuperAdmin && (
                    <div className="flex sm:hidden flex-wrap gap-2">
                      <button onClick={() => handleOpenModal('corporate', null, corp)} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 flex items-center justify-center gap-1.5"><Pencil size={12} /> Edit</button>
                      <button onClick={downloadBulkTemplate} className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-[10px] font-black uppercase text-emerald-600 flex items-center justify-center gap-1.5"><FileSpreadsheet size={12} /> CSV</button>
                      <button onClick={() => { setUploadContext({ type: 'unit', parentId: corp.id }); csvInputRef.current?.click(); }} className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-[10px] font-black uppercase text-blue-600 flex items-center justify-center gap-1.5"><Upload size={12} /> Bulk</button>
                      <button onClick={() => handleOpenModal('regional', corp.id)} className="flex-1 px-3 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5">+ Regional</button>
                    </div>
                  )}
                  <ContactInfoGrid title="Global HQ Contacts" contacts={corp.additionalContacts} entity={corp} onEdit={(e) => handleOpenModal('corporate', null, e)} isSuperAdmin={isSuperAdmin} />
                  <MasterDataSection entity={corp} entities={entities} title="Global Master Definitions" color="bg-blue-600" icon={ShieldCheck} canEdit={canEditMasterData} newDept={newDept} setNewDept={setNewDept} newRole={newRole} setNewRole={setNewRole} newCategory={newCategory} setNewCategory={setNewCategory} newCategoryWorkforce={newCategoryWorkforce} setNewCategoryWorkforce={setNewCategoryWorkforce} onAdd={handleAddMasterData} onRemove={handleRemoveMasterData} onRename={setRenameState} />
                  <div className="space-y-4">
                    {corp.regionals.map((reg:any) => {
                      const regStats = getStats(reg.units);
                      const isRegExpanded = expandedRegId === reg.id;
                      return (
                        <details key={reg.id} open={isRegExpanded} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                          <summary onClick={(e) => { e.preventDefault(); setExpandedRegId(isRegExpanded ? null : reg.id); }} className="flex items-center justify-between list-none cursor-pointer bg-[#457b9d] text-white px-3 sm:px-5 py-2.5 sm:py-3 select-none">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0"><Globe size={16} className="shrink-0" /> <span className="font-bold text-xs sm:text-sm truncate">{reg.name}</span>{reg.entityIdNum && <span className="text-[8px] sm:text-[9px] font-mono bg-white/20 px-1 sm:px-1.5 rounded shrink-0 hidden sm:inline">{reg.entityIdNum}</span>}</div>
                            <div className="flex items-center gap-2 shrink-0"><span className="hidden sm:block"><StatusBadge label="Units" count={reg.units.length} /></span><span className="sm:hidden text-[9px] font-black bg-white/10 px-1.5 py-0.5 rounded">{reg.units.length}</span><ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isRegExpanded ? 'rotate-180' : ''}`} /></div>
                          </summary>
                          <div className="p-3 sm:p-6 bg-slate-50/50 border-t border-slate-100 space-y-4 sm:space-y-6">
                             <ContactInfoGrid title="Regional Office Access Contacts" contacts={reg.additionalContacts} entity={reg} onEdit={(e) => handleOpenModal('regional', null, e)} isSuperAdmin={isSuperAdmin} />
                             <div className="flex flex-wrap justify-end items-center gap-2">
                                {isSuperAdmin && (
                                  <>
                                      <button onClick={downloadBulkTemplate} className="px-3 sm:px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg text-[10px] sm:text-xs font-black uppercase hover:bg-emerald-50 transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm" title="Download CSV template"><FileSpreadsheet size={13}/> CSV</button>
                                      <button onClick={() => { setUploadContext({ type: 'unit', parentId: reg.id }); csvInputRef.current?.click(); }} className="px-3 sm:px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-[10px] sm:text-xs font-black uppercase hover:bg-blue-50 transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm"><Upload size={13}/> Bulk</button>
                                      <button onClick={() => handleOpenModal('unit', reg.id)} className="px-3 sm:px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] sm:text-xs font-black uppercase shadow-md transition-all active:scale-95">+ Add Unit</button>
                                  </>
                                )}
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {reg.units.map((unit:any) => {
                                   const isUnitExp = expandedUnitIds.has(unit.id);
                                   const deptCount = unit.departments?.length || 0;
                                   const userCount = (unit.departments || []).reduce((s: number, d: any) => s + (d.users?.length || 0), 0);
                                   return (
                                     <div key={unit.id} className={`rounded-xl border transition-all overflow-hidden ${isUnitExp ? 'border-emerald-200 shadow-md' : 'border-slate-200'}`}>
                                        <div className="flex items-center gap-3">
                                           <div className="flex-1"><UnitCard unit={unit} onEdit={u => handleOpenModal('unit', null, u)} onToggleStatus={id => onUpdateEntity({...unit, status: unit.status === 'active' ? 'inactive' : 'active'})} onApprove={u => onUpdateEntity({...u, status: 'active'})} isSuperAdmin={isSuperAdmin} onOpenPermissions={onOpenPermissions} onOpenDeptControl={() => openDeptControl(unit.name)} /></div>
                                        </div>
                                        {(deptCount > 0 || isSuperAdmin) && (
                                           <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2">
                                              <button onClick={() => setExpandedUnitIds(prev => { const n = new Set(prev); n.has(unit.id) ? n.delete(unit.id) : n.add(unit.id); return n; })} className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-500 hover:text-emerald-600 transition-colors w-full">
                                                 <ChevronDown size={12} className={`transition-transform ${isUnitExp ? 'rotate-180' : ''}`} />
                                                 <Layers size={11} className="text-orange-400" />
                                                 {deptCount} Department{deptCount !== 1 ? 's' : ''} · {userCount} User{userCount !== 1 ? 's' : ''}
                                              </button>
                                           </div>
                                        )}
                                        {isUnitExp && (
                                           <div className="bg-orange-50/30 border-t border-slate-100 px-4 py-3 space-y-2">
                                              {isSuperAdmin && (
                                                 <button onClick={() => handleOpenModal('department' as any, unit.id)} className="text-[9px] font-black uppercase text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-2">
                                                    <Plus size={12} /> Add Department
                                                 </button>
                                              )}
                                              {(unit.departments || []).map((dept: any) => {
                                                 const isDeptExp = expandedDeptIds.has(dept.id);
                                                 return (
                                                    <div key={dept.id} className={`rounded-lg border overflow-hidden ${isDeptExp ? 'border-orange-200 bg-white shadow-sm' : 'border-slate-200 bg-white'}`}>
                                                       <button onClick={() => setExpandedDeptIds(prev => { const n = new Set(prev); n.has(dept.id) ? n.delete(dept.id) : n.add(dept.id); return n; })} className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50/50 transition-colors">
                                                          <div className="flex items-center gap-2">
                                                             <div className="p-1 bg-orange-100 rounded"><Layers size={11} className="text-orange-500" /></div>
                                                             <span className="text-[10px] font-black text-slate-700 uppercase">{dept.name}</span>
                                                             {dept.email && <span className="text-[8px] text-slate-400 font-bold">{dept.email}</span>}
                                                          </div>
                                                          <div className="flex items-center gap-2">
                                                             <span className="text-[8px] font-bold text-slate-400">{dept.users?.length || 0} users</span>
                                                             <ChevronDown size={10} className={`text-slate-400 transition-transform ${isDeptExp ? 'rotate-180' : ''}`} />
                                                          </div>
                                                       </button>
                                                       {isDeptExp && (
                                                          <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/50">
                                                             {isSuperAdmin && (
                                                                <button onClick={() => handleOpenModal('user' as any, dept.id)} className="text-[8px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mb-1">
                                                                   <Plus size={10} /> Add User
                                                                </button>
                                                             )}
                                                             {(dept.users || []).length > 0 ? dept.users.map((usr: any) => (
                                                                <div key={usr.id} className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors">
                                                                   <div className="flex items-center gap-2">
                                                                      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[9px]">{usr.name?.charAt(0) || 'U'}</div>
                                                                      <div>
                                                                         <span className="text-[10px] font-black text-slate-700">{usr.name}</span>
                                                                         {usr.email && <span className="text-[8px] text-slate-400 ml-2">{usr.email}</span>}
                                                                      </div>
                                                                   </div>
                                                                   <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${usr.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{usr.status}</span>
                                                                </div>
                                                             )) : (
                                                                <div className="text-[9px] text-slate-400 italic text-center py-2">No users assigned</div>
                                                             )}
                                                          </div>
                                                       )}
                                                    </div>
                                                 );
                                              })}
                                              {deptCount === 0 && (
                                                 <div className="text-[9px] text-slate-400 italic text-center py-3">No departments defined</div>
                                              )}
                                           </div>
                                        )}
                                     </div>
                                   );
                                })}
                             </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </div>
  );
};
export default CorporateManagement;