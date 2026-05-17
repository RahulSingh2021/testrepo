
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Monitor, Link2, Copy, CheckCircle2, X, Clock, Trash2, Plus, ExternalLink, MapPin, Share2, ChevronDown } from 'lucide-react';
import TrainerManagement from './TrainerManagement';
import StaffCompetencyMapping from './StaffCompetencyMapping';
import HierarchicalTrainingDashboard from './HierarchicalTrainingDashboard';
import TrainingCalendar from './TrainingCalendar';
import QuizCreator from './QuizCreator';
import LMCertificateStudio from './LMCertificateStudio';
import TrainingDashboard, { TrainingFocusContext } from './TrainingDashboard';
import AcademyStudentPortal from './AcademyStudentPortal';
import { HierarchyScope, Entity } from '../types';

// --- Shared Types ---
export interface Certification {
  name: string;
  date: string;
  status: string;
}

export interface CompetencyScore {
    domain: string;
    level: number; // 1-5 scale
    description: string;
}

export interface ExternalResourceArtifacts {
    cvAttached: boolean;
    companyApprovalAttached: boolean;
    verifiedDate?: string;
    consultantCompany?: string;
}

export interface EmployeeRecord {
  id: string; 
  Corporate: string;
  Regional: string;
  Unit: string;
  Name: string;
  ID: string; 
  Gender: string;
  JoinedDate: string;
  BirthDate: string;
  Email: string;
  Phone: string;
  Department: string;
  Role: string;
  Category: string;
  FoodHandler: string;
  Status: "Active" | "Inactive";
  isTrainer: boolean;
  delivered_uniqueCourses: number;
  delivered_participants: number;
  delivered_hours: number;
  trainerQualification?: string;
  trainerCategory?: 'Internal' | 'External'; // Clause 7.1.6
  externalArtifacts?: ExternalResourceArtifacts;
  isCoreComplianceNode?: boolean; // For Auditor "One-Click" Mode
  certifications: Certification[];
  competencyScorecard: CompetencyScore[]; 
  // ISO 22000 Clause 7.2.f Metrics
  effectivenessScore: number; 
  classPassRate: number; 
  avgCompetencyGain: number;
  // ISO 22000 Clause 5.3.2 Authority & Impartiality
  isFSTL: boolean; // Food Safety Team Leader
  authorizedScope: string[]; // e.g. ["PRP", "CCP", "OPRP"]
  appointmentLetterUrl?: string;
  digitalWarrantId?: string;
  
  performanceLevel?: string;
  rating?: number;
  departmentalReach?: number;
  avgHoursPerParticipant?: number;
  lastUpdated: string;
  avgDelivery: number;
  selfLearning: number;
  lastTrainedDate: string;
}

// ISO 22000 Domains for SME Tracking
const ISO_DOMAINS = [
    { key: 'haccp', label: 'HACCP Analysis', desc: 'Hazard identification and control point determination' },
    { key: 'prp', label: 'PRP Controls', desc: 'Prerequisite programs and sanitation' },
    { key: 'defense', label: 'Food Defense', desc: 'Vulnerability and threat assessment' },
    { key: 'audit', label: 'Internal Audit', desc: 'System verification and compliance' },
    { key: 'micro', label: 'Microbiology', desc: 'Pathogen control and lab protocols' }
];

const SCOPE_POOL = ["General Hygiene (PRP)", "CCP Monitoring", "OPRP Management", "Allergen Control", "Internal Audit", "Crisis Management"];

// --- Shared Generator ---
const generateMasterEmployeeList = (): EmployeeRecord[] => {
  const names = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
    "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen",
    "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Margaret", "Anthony", "Betty", "Donald", "Sandra"
  ];
  const surnames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"
  ];
  const depts = ["Main Kitchen", "Housekeeping", "Engineering", "Front Office", "F&B Service"];
  const roles = ["Manager", "Supervisor", "Associate", "Chef", "Specialist"];
  
  return Array.from({ length: 120 }).map((_, i) => {
    const isAcme = i % 2 === 0;
    const corp = isAcme ? "Acme Catering Group" : "PureFlow Dairy Corp";
    const reg = isAcme ? "North America Division" : "EMEA";
    const unit = isAcme ? (i % 4 === 0 ? "LA Logistics Unit" : "NYC Central Kitchen") : "Main Branch";
    const name = `${names[i % names.length]} ${surnames[i % surnames.length]}`;
    
    const isTrainer = i < 15;
    const isExternal = i > 0 && i < 4; // Mock first few as external

    return {
      id: `uuid-${i}`,
      Corporate: corp,
      Regional: reg,
      Unit: unit,
      Name: name,
      ID: `EMP${1000 + i}`,
      Gender: i % 3 === 0 ? "Female" : "Male",
      JoinedDate: "2021-05-23",
      BirthDate: "1993-05-30",
      Email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      Phone: `555-01${i}`,
      Department: depts[i % depts.length],
      Role: roles[i % roles.length],
      Category: "Staff",
      FoodHandler: i % 5 === 0 ? "Yes" : "No",
      Status: "Active",
      isTrainer: isTrainer, 
      delivered_uniqueCourses: isTrainer ? (i % 8) + 1 : 0,
      delivered_participants: i * 10 + 20,
      delivered_hours: i * 5 + 10,
      trainerQualification: isTrainer ? "Certified Expert" : undefined,
      trainerCategory: isTrainer ? (isExternal ? 'External' : 'Internal') : undefined,
      externalArtifacts: isExternal ? {
          cvAttached: true,
          companyApprovalAttached: i !== 2, // Mock one missing approval
          verifiedDate: "2024-01-10",
          consultantCompany: "GFSI Solutions Global"
      } : undefined,
      isCoreComplianceNode: isTrainer && (i % 2 === 0 || isExternal), // Core nodes for auditor mode
      certifications: isTrainer ? [{ name: 'Train the Trainer', date: '2023-11-10', status: 'Completed' }] : [],
      // ISO 22000 Scorecard Logic
      competencyScorecard: isTrainer ? ISO_DOMAINS.map(d => ({
          domain: d.label,
          level: Math.floor(Math.random() * 5) + 1,
          description: d.desc
      })) : [],
      // ISO 22000 Clause 7.2.f Logic
      effectivenessScore: isTrainer ? 75 + Math.floor(Math.random() * 20) : 0,
      classPassRate: isTrainer ? 85 + Math.floor(Math.random() * 14) : 0,
      avgCompetencyGain: isTrainer ? 0.8 + (Math.random() * 1.5) : 0,
      // ISO 22000 Clause 5.3.2 Logic
      isFSTL: isTrainer && i === 0, // Mark first trainer as FSTL
      authorizedScope: isTrainer ? SCOPE_POOL.slice(0, (i % 4) + 2) : [],
      appointmentLetterUrl: isTrainer ? "apt-2024-001.pdf" : undefined,
      digitalWarrantId: isTrainer ? `WNT-${2000 + i}` : undefined,
      lastUpdated: "2025-12-20T22:09:00",
      avgDelivery: isTrainer ? (Math.random() * 5) : 0,
      selfLearning: isTrainer ? Math.floor(Math.random() * 100) : 0,
      lastTrainedDate: isTrainer ? `2024-0${(i % 9) + 1}-15` : ""
    };
  });
};

interface PortalLink {
  id: string;
  unitId: string;
  unitName: string;
  corporateName: string;
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

const PortalLinkBar = ({ currentScope, userRootId, entities }: { currentScope: HierarchyScope; userRootId?: string | null; entities: Entity[] }) => {
  const [showModal, setShowModal] = useState(false);
  const [links, setLinks] = useState<PortalLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [expiryTime, setExpiryTime] = useState('23:59');
  const [creating, setCreating] = useState(false);

  const scopedUnits = useMemo(() => {
    const getDescendantIds = (parentId: string): string[] => {
      const children = entities.filter(e => e.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    if (currentScope === 'unit' && userRootId) {
      return entities.filter(e => e.id === userRootId && e.type === 'unit');
    }
    if (currentScope === 'department' && userRootId) {
      const dept = entities.find(e => e.id === userRootId);
      if (dept?.parentId) return entities.filter(e => e.id === dept.parentId && e.type === 'unit');
      return [];
    }
    if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
      const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
      return entities.filter(e => e.type === 'unit' && descendantIds.has(e.id));
    }
    return entities.filter(e => e.type === 'unit');
  }, [entities, currentScope, userRootId]);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training-portal?action=list`);
      if (res.ok) {
        const data = await res.json();
        const unitIds = new Set(scopedUnits.map(u => u.id));
        setLinks((data.links || []).filter((l: PortalLink) => unitIds.has(l.unitId)));
      }
    } catch { }
    setLoading(false);
  }, [scopedUnits]);

  useEffect(() => {
    if (showModal) loadLinks();
  }, [showModal, loadLinks]);

  const handleCreate = async () => {
    if (!selectedUnitId || !expiryDate) return;
    setCreating(true);
    try {
      const unit = entities.find(e => e.id === selectedUnitId);
      const corporate = entities.find(e => e.type === 'corporate');
      const expiresAt = new Date(`${expiryDate}T${expiryTime}:00`).toISOString();
      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-link',
          unitId: selectedUnitId,
          unitName: unit?.name || 'Unit',
          corporateName: corporate?.name || '',
          expiresAt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(prev => [data.link, ...prev]);
        setSelectedUnitId('');
        setExpiryDate('');
        setExpiryTime('23:59');
      }
    } catch { }
    setCreating(false);
  };

  const handleRevoke = async (token: string) => {
    if (!confirm('Revoke this link? It will stop working immediately.')) return;
    try {
      const res = await fetch('/api/training-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-link', token }),
      });
      if (res.ok) setLinks(prev => prev.filter(l => l.id !== token));
    } catch { }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/training-portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();
  const activeLinks = links.filter(l => !isExpired(l.expiresAt));

  return (
    <>
      <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-end gap-2 shrink-0">
        {activeLinks.length > 0 && (
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mr-2">{activeLinks.length} active link{activeLinks.length > 1 ? 's' : ''}</span>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-1.5"
        >
          <Share2 size={12} /> Portal Links
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Link2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Training Portal Links</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shareable unit-specific links with expiry</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="text-slate-400" /></button>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-b border-slate-100 shrink-0">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Generate New Link</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedUnitId}
                  onChange={e => setSelectedUnitId(e.target.value)}
                  className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none bg-white"
                >
                  <option value="">Select Unit</option>
                  {scopedUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none w-40"
                  placeholder="Expiry Date"
                />
                <input
                  type="time"
                  value={expiryTime}
                  onChange={e => setExpiryTime(e.target.value)}
                  className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:border-indigo-400 outline-none w-32"
                />
                <button
                  onClick={handleCreate}
                  disabled={!selectedUnitId || !expiryDate || creating}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus size={14} /> Generate
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-5">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400 font-bold">Loading...</div>
              ) : links.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Link2 size={28} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No portal links created yet</p>
                  <p className="text-[10px] text-slate-400 mt-1">Generate a link above to share with external trainers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map(link => {
                    const expired = isExpired(link.expiresAt);
                    const expDate = new Date(link.expiresAt);
                    return (
                      <div key={link.id} className={`rounded-2xl border-2 p-4 transition-all ${expired ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-indigo-100 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs font-black text-slate-800"><MapPin size={12} className="text-indigo-500" /> {link.unitName}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${expired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                                {expired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                              <Clock size={10} />
                              <span>Expires: {expDate.toLocaleDateString()} {expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1 bg-slate-100 rounded-lg px-3 py-1.5">
                              <code className="text-[10px] font-bold text-slate-600 truncate flex-1">/training-portal/{link.id}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!expired && (
                              <>
                                <button onClick={() => copyLink(link.id)} className={`p-2 rounded-lg transition-all ${copiedId === link.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'}`}>
                                  {copiedId === link.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                                </button>
                                <button onClick={() => window.open(`/training-portal/${link.id}`, '_blank')} className="p-2 bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-all">
                                  <ExternalLink size={16} />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleRevoke(link.id)} className="p-2 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface LearningManagementProps {
  activeSubTab: string;
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities?: Entity[];
  onSetSubTab?: (tab: string) => void;
}

const LearningManagement: React.FC<LearningManagementProps> = ({
  activeSubTab,
  currentScope,
  userRootId,
  entities = [],
  onSetSubTab,
}) => {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const scopedUnitNames = useMemo(() => {
    const getDescendantIds = (parentId: string): string[] => {
      const children = entities.filter(e => e.parentId === parentId);
      return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
    };
    let scopedEntities: Entity[] = [];
    if (currentScope === 'unit' && userRootId) {
      scopedEntities = entities.filter(e => e.id === userRootId && e.type === 'unit');
    } else if (currentScope === 'department' && userRootId) {
      const dept = entities.find(e => e.id === userRootId);
      if (dept?.parentId) scopedEntities = entities.filter(e => e.id === dept.parentId && e.type === 'unit');
    } else if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
      const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
      scopedEntities = entities.filter(e => e.type === 'unit' && descendantIds.has(e.id));
    } else {
      scopedEntities = entities.filter(e => e.type === 'unit');
    }
    return new Set(scopedEntities.filter(e => e.name?.trim()).map(e => e.name!.trim().toLowerCase()));
  }, [entities, currentScope, userRootId]);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const [usersRes, trainersRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/trainers')
        ]);
        const usersData = usersRes.ok ? await usersRes.json() : { items: [] };
        const trainersData = trainersRes.ok ? await trainersRes.json() : { items: [] };
        const dbEmployees = (usersData.items || []) as any[];
        const dbTrainers = (trainersData.items || []) as any[];

        const trainerMap = new Map<string, any>();
        for (const t of dbTrainers) {
          trainerMap.set(t.employeeId || t.id, t);
        }

        const isScoped = scopedUnitNames.size > 0 && (currentScope === 'unit' || currentScope === 'department' || currentScope === 'regional' || currentScope === 'corporate');
        const filtered = dbEmployees.filter((emp: any) => {
          if (emp.Status !== 'Active') return false;
          if (isScoped) {
            const empUnit = (emp.Unit || '').trim().toLowerCase();
            if (!empUnit || !scopedUnitNames.has(empUnit)) return false;
          }
          return true;
        });

        const mapped: EmployeeRecord[] = filtered.map((emp: any) => {
          const trainerData = trainerMap.get(emp.id);
          return {
            id: emp.id || `uuid-${Math.random().toString(36).slice(2)}`,
            Corporate: emp.Corporate || '',
            Regional: emp.Regional || '',
            Unit: emp.Unit || '',
            Name: emp.Name || 'Unknown',
            ID: emp.ID || '',
            Gender: emp.Gender || '',
            JoinedDate: emp.JoinedDate || '',
            BirthDate: emp.BirthDate || '',
            Email: emp.Email || '',
            Phone: emp.Phone || '',
            Department: emp.Department || '',
            Role: emp.Role || '',
            Category: emp.Category || '',
            FoodHandler: emp.FoodHandler || 'No',
            Status: emp.Status || 'Active',
            isTrainer: !!trainerData,
            delivered_uniqueCourses: trainerData?.delivered_uniqueCourses || 0,
            delivered_participants: trainerData?.delivered_participants || 0,
            delivered_hours: trainerData?.delivered_hours || 0,
            trainerQualification: trainerData?.trainerQualification,
            trainerCategory: trainerData?.trainerCategory || 'Internal',
            externalArtifacts: trainerData?.externalArtifacts,
            isCoreComplianceNode: trainerData?.isCoreComplianceNode || false,
            certifications: trainerData?.certifications || [],
            competencyScorecard: trainerData?.competencyScorecard || [],
            effectivenessScore: trainerData?.effectivenessScore || 0,
            classPassRate: trainerData?.classPassRate || 0,
            avgCompetencyGain: trainerData?.avgCompetencyGain || 0,
            isFSTL: trainerData?.isFSTL || false,
            authorizedScope: trainerData?.authorizedScope || [],
            appointmentLetterUrl: trainerData?.appointmentLetterUrl,
            digitalWarrantId: trainerData?.digitalWarrantId,
            lastUpdated: trainerData?.lastUpdated || new Date().toISOString(),
            avgDelivery: trainerData?.avgDelivery || 0,
            selfLearning: trainerData?.selfLearning || 0,
            lastTrainedDate: trainerData?.lastTrainedDate || '',
            fsmsRole: trainerData?.fsmsRole
          };
        });
        setEmployees(mapped);
      } catch (err) {
        console.error('Failed to load employees for trainer tab:', err);
        setEmployees([]);
      } finally {
        setIsLoaded(true);
      }
    };
    loadEmployees();
  }, [scopedUnitNames, currentScope]);

  const trainers = useMemo(() => employees.filter(e => e.isTrainer), [employees]);

  if (!isLoaded) return <div className="p-12 text-center text-indigo-600 font-bold">Initializing Learning Environment...</div>;

  if (activeSubTab === 'learning-dashboard') {
    const handleDashboardNavigate = (subTab: string, context?: TrainingFocusContext) => {
      if (context) {
        try { sessionStorage.setItem('training_focus', JSON.stringify(context)); } catch {}
      }
      onSetSubTab?.(subTab);
    };
    return (
      <TrainingDashboard
        entities={entities}
        currentScope={currentScope}
        userRootId={userRootId}
        employees={employees}
        onNavigate={handleDashboardNavigate}
      />
    );
  }

  if (activeSubTab === 'learning-trainer') {
    return (
      <TrainerManagement 
        currentScope={currentScope} 
        userRootId={userRootId} 
        entities={entities} 
        masterEmployees={employees}
        setMasterEmployees={setEmployees}
      />
    );
  }

  if (activeSubTab === 'learning-tni') {
    return (
      <StaffCompetencyMapping 
        entities={entities}
        currentScope={currentScope}
        userRootId={userRootId}
      />
    );
  }

  if (activeSubTab === 'learning-tracker') {
    return <HierarchicalTrainingDashboard entities={entities} currentScope={currentScope} userRootId={userRootId} />;
  }

  if (activeSubTab === 'learning-calendar') {
    return (
      <div className="flex flex-col h-full">
        <PortalLinkBar currentScope={currentScope} userRootId={userRootId} entities={entities} />
        <div className="flex-1 min-h-0">
          <TrainingCalendar 
            currentScope={currentScope} 
            userRootId={userRootId} 
            entities={entities} 
            trainers={trainers}
            allEmployees={employees}
            certTemplateEndpoint="/api/lm-cert-templates"
          />
        </div>
      </div>
    );
  }

  if (activeSubTab === 'learning-quiz') {
    return (
      <QuizCreator />
    );
  }

  if (activeSubTab === 'learning-certificates') {
    return (
      <div className="p-6">
        <LMCertificateStudio />
      </div>
    );
  }

  if (activeSubTab === 'learning-student-dashboard' || activeSubTab === 'learning-course-catalog') {
    const view = activeSubTab === 'learning-student-dashboard' ? 'dashboard' : 'catalog';
    return (
      <AcademyStudentPortal key={activeSubTab} initialView={view as 'dashboard' | 'catalog'} />
    );
  }

  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center p-12 bg-white rounded-[2rem] border border-dashed border-slate-200 animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
        <Monitor className="w-10 h-10 text-slate-300" />
      </div>
      <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase tracking-[0.1em]">Learning Module Interface</h2>
      <p className="text-slate-400 text-sm mt-3 max-w-sm font-medium uppercase tracking-widest">Select a valid sub-section from the navigation menu above to access specialized datasets.</p>
    </div>
  );
};

export default LearningManagement;
