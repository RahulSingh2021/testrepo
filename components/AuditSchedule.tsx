
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  CalendarRange, 
  ChevronDown, 
  ChevronRight,
  ChevronUp, 
  Plus,
  Calendar,
  Search,
  ClipboardList,
  X,
  User,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Layers,
  LayoutGrid,
  Check,
  Trash2,
  MoreVertical,
  Users,
  CalendarDays,
  Copy,
  AlertTriangle,
  Download,
  ExternalLink,
  Repeat,
  Play,
  Eye,
  Award,
  FileText,
  RefreshCw,
  Hash,
  FileDigit,
  FileSignature,
  Lock,
  Unlock,
  History,
  Save,
  Gavel,
  Settings2,
  Shield,
  Activity,
  BarChart3,
  PieChart,
  Target,
  ArrowRight,
  FileSpreadsheet,
  File,
  ImageIcon,
  PenTool,
  ShieldCheck,
  Droplets,
  GitCommit,
  Box,
  AlertCircle,
  Globe,
  Settings,
  CalendarClock,
  Zap,
  Send,
  StickyNote,
  TrendingUp,
  Flag,
  CircleDot,
  Mail,
  SendHorizontal,
  Pencil
} from 'lucide-react';
import { Entity, HierarchyScope, MandatoryProtocol, AuthorityLevel } from '../types';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { useNotifications } from './NotificationContext';

// --- Types ---

type PeriodFrequency = 'Monthly' | 'Quarterly' | 'Half Yearly' | 'Yearly' | 'Biennial';
type AuditStatus = 'Scheduled' | 'In Progress' | 'Report Drafted' | 'Pending Review' | 'Completed' | 'Closed';
type PeriodStatus = 'DRAFT' | 'PUBLISHED';
type PillarStatus = 'Compliant' | 'Due Soon' | 'Overdue' | 'NA';

interface MandatoryPillar {
    id: string;
    type: 'FSMS' | 'GMP' | 'TRACE' | 'GLASS' | 'OTHER';
    label: string;
    frequency: string;
    lastDate: string;
    nextDue: string;
    status: PillarStatus;
    level: AuthorityLevel;
    effectiveDate: string;
}

interface LocationAssignment {
    locationName: string;
    assignedAuditors: string[];
}

interface CrossDeptAudit {
    id: string;
    departments: string[];
    scope: string; 
    startDate: string;
    endDate: string;
    checklist: string;
    auditTeam: string[];
    locationAssignments?: LocationAssignment[];
    status: AuditStatus;
    score?: number;
    recurring?: string;
    isUnannounced?: boolean; 
    isFollowUp?: boolean;
    createdAt?: string;
    priority?: 'High' | 'Medium' | 'Low';
    reviewer?: string;
    reviewRequired?: boolean;
}

interface AuditPeriod {
    id: string;
    protocolId: string;
    // Stable identifier ({level}|{entityId}|{name-lower}) so periods survive
    // a protocol row being re-seeded with a fresh id (task #165).
    protocolKey?: string;
    frequency: PeriodFrequency;
    startDate: string;
    endDate: string;
    audits: CrossDeptAudit[];
    isExpanded?: boolean;
    status: PeriodStatus;
    notes?: string;
}

// Build a stable key for a MandatoryProtocol so periods can be matched even
// when the underlying protocol row's `id` changes (sync re-seed, delete + re-add,
// scope flip). Keep this in sync with AuditPeriod.protocolKey.
const makeProtocolKey = (p: { level?: string; entityId?: string; name?: string }): string =>
    `${p.level || ''}|${p.entityId || ''}|${(p.name || '').toLowerCase().trim()}`;

interface UnitScheduleData {
    unitId: string;
    unitName: string;
    regionId: string;
    corpId: string;
    region: string;
    periods: AuditPeriod[];
    isExpanded?: boolean;
}

interface LocationAuditAssignment {
  locationId: string;
  locationName: string;
  department: string;
  assignedTeam: string[];
  status: 'Scheduled' | 'In Progress' | 'Completed';
  startedAt?: string;
  completedAt?: string;
  score?: number;
  notes?: string;
}

interface ScheduledAudit {
  id: string;
  unitId: string;
  checklistId: string;
  checklistTitle: string;
  scheduledDate: string;
  dueDate: string;
  locations: LocationAuditAssignment[];
  overallStatus: 'Scheduled' | 'In Progress' | 'Completed';
  createdAt: string;
  notes?: string;
}

export type { UnitScheduleData, ScheduledAudit as AuditScheduleAudit };

interface AuditScheduleProps {
  entities?: Entity[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  protocols: MandatoryProtocol[];
  setProtocols: React.Dispatch<React.SetStateAction<MandatoryProtocol[]>>;
  checklistNames?: string[];
  checklistTemplates?: { id: string; title: string; pages: { id: string; title: string }[] }[];
  directAssignChecklists?: { id: string; title: string; department: string; frequency: string }[];
  onDirectAssign?: (checklist: any) => void;
  onPublishAudits?: (tasks: { id: string; title: string; unitName: string; department: string; auditorName: string; scheduledDate: string; endDate: string; checklistName: string; reviewer?: string; reviewRequired?: boolean; isCombinedAudit?: boolean; }[]) => void;
  externalUnits?: UnitScheduleData[];
  setExternalUnits?: React.Dispatch<React.SetStateAction<UnitScheduleData[]>>;
  externalScheduledAudits?: ScheduledAudit[];
  setExternalScheduledAudits?: React.Dispatch<React.SetStateAction<ScheduledAudit[]>>;
  departmentLocations?: Record<string, string[]>;
  onImmediateSave?: () => void;
}

// --- Constants ---
const FREQUENCIES: PeriodFrequency[] = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'Biennial'];
const DEPARTMENTS = ["Main Kitchen", "Housekeeping", "Engineering", "Front Office", "F&B Service", "Security", "Stores", "HR"];

const PillarIcon = ({ label, size = 16, className = "", strokeWidth = 2 }: { label: string, size?: number, className?: string, strokeWidth?: number }) => {
    const l = label.toLowerCase();
    if (l.includes('fsms')) return <ShieldCheck size={size} className={className} strokeWidth={strokeWidth} />;
    if (l.includes('gmp') || l.includes('ghp')) return <Droplets size={size} className={className} strokeWidth={strokeWidth} />;
    if (l.includes('trace')) return <GitCommit size={size} className={className} strokeWidth={strokeWidth} />;
    if (l.includes('glass')) return <Box size={size} className={className} strokeWidth={strokeWidth} />;
    return <FileText size={size} className={className} strokeWidth={strokeWidth} />;
};

const getPillarColor = (status: PillarStatus) => {
    switch (status) {
        case 'Compliant': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
        case 'Due Soon': return 'text-amber-500 bg-amber-50 border-amber-100';
        case 'Overdue': return 'text-rose-500 bg-rose-50 border-rose-100';
        case 'NA': return 'text-slate-300 bg-slate-50 border-slate-100';
        default: return 'text-slate-400 bg-slate-50 border-slate-100';
    }
};

const MultiSelectDropdown = ({ options, selected, onChange, placeholder = "Select...", renderOptionMeta }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
        }
    }, [isOpen]);
    const filteredOptions = options.filter((opt: string) => opt.toLowerCase().includes(search.toLowerCase()));
    const toggleOption = (opt: string) => {
        if (selected.includes(opt)) onChange(selected.filter((s: string) => s !== opt));
        else onChange([...selected, opt]);
    };
    return (
        <div className="relative" ref={containerRef}>
            <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)} className={`w-full min-h-[48px] px-4 py-2.5 bg-slate-50 border-2 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${isOpen ? 'border-indigo-400 bg-white ring-4 ring-indigo-50/50' : 'border-slate-100 hover:border-slate-200 shadow-inner'}`}>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 pr-2">
                    {selected.length > 0 ? selected.map((s: string) => (
                        <span key={s} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                            {s} <button onClick={(e) => { e.stopPropagation(); toggleOption(s); }}><X size={10} /></button>
                        </span>
                    )) : <span className="text-xs font-bold text-slate-300 italic">{placeholder}</span>}
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="fixed bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}>
                    <div className="p-2 border-b border-slate-50">
                        <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={14} /><input autoFocus className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:border-indigo-500" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.map((opt: string) => (
                            <div key={opt} onClick={() => toggleOption(opt)} className={`px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700 ${selected.includes(opt) ? 'bg-indigo-50 text-indigo-700' : ''}`}>
                                <div className="flex items-center gap-2">{opt}{renderOptionMeta && renderOptionMeta(opt)}</div>
                                {selected.includes(opt) && <Check size={14} />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const AuditSchedule: React.FC<AuditScheduleProps> = ({ entities = [], currentScope = 'super-admin', userRootId, protocols, setProtocols, checklistNames, checklistTemplates = [], directAssignChecklists = [], onDirectAssign, onPublishAudits, externalUnits, setExternalUnits, externalScheduledAudits, setExternalScheduledAudits, departmentLocations = {}, onImmediateSave }) => {
    const CHECKLISTS = checklistNames || [];
    const [internalUnits, setInternalUnits] = useState<UnitScheduleData[]>([]);
    const units = externalUnits ?? internalUnits;
    const setUnits = setExternalUnits ?? setInternalUnits;

    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [manualFstMembers, setManualFstMembers] = useState<any[]>([]);
    const auditorDataLoaded = useRef(false);
    useEffect(() => {
        const timer = setTimeout(() => {
          if (auditorDataLoaded.current) return;
          auditorDataLoaded.current = true;
          fetch('/api/users').then(r => r.ok ? r.json() : { items: [] }).then(d => setAllUsers(d.items || [])).catch(() => {});
          fetch('/api/fst-members').then(r => r.ok ? r.json() : { items: [] }).then(d => setManualFstMembers(d.items || [])).catch(() => {});
        }, 1500);
        return () => clearTimeout(timer);
    }, []);
    
    const isDescendantOf = (ancestorId: string, potentialDescendantId: string): boolean => {
        let current = entities.find(e => e.id === potentialDescendantId);
        while (current) {
            if (current.id === ancestorId) return true;
            if (!current.parentId) break;
            current = entities.find(e => e.id === current?.parentId);
        }
        return false;
    };

    useEffect(() => {
        const allUnitEntities = entities.filter(e => e.type === 'unit');
        setUnits(prev => {
            const existingIds = new Set(prev.map(u => u.unitId));
            const updated = prev.map(u => {
                const ent = allUnitEntities.find(e => e.id === u.unitId);
                if (!ent) return u;
                const region = entities.find(e => e.id === ent.parentId);
                return { ...u, unitName: ent.name, regionId: region?.id || u.regionId, region: region?.name || u.region };
            });
            const added = allUnitEntities.filter(u => !existingIds.has(u.id)).map(u => {
                const region = entities.find(e => e.id === u.parentId);
                const corp = region ? entities.find(e => e.id === region.parentId) : undefined;
                return { unitId: u.id, unitName: u.name, regionId: region?.id || '', corpId: corp?.id || '', region: region?.name || '', isExpanded: false, periods: [] };
            });
            const merged = [...updated, ...added];
            const seen = new Set<string>();
            return merged.filter(u => {
                if (seen.has(u.unitId)) return false;
                seen.add(u.unitId);
                return true;
            });
        });
    }, [entities, setUnits]);

    // Backfill `protocolKey` on legacy periods loaded from DB so they keep matching
    // their pillar tab even after the underlying protocol id is regenerated (task #165).
    // Idempotent: only writes when something will change, so re-runs on dataset
    // replacement (impersonation switch) are safe.
    useEffect(() => {
        if (!protocols.length || !units.length) return;
        const needsBackfill = units.some(u => u.periods?.some(p => !p.protocolKey));
        if (!needsBackfill) return;
        // Pre-compute applicable protocols per unit so we can recover periods whose
        // `protocolId` no longer exists (re-seed drift) by adopting the sole applicable
        // mandate of the right level when there is exactly one candidate.
        const applicableByUnit = new Map<string, MandatoryProtocol[]>();
        units.forEach(u => {
            const list = protocols.filter(p => {
                if (p.level === 'UNIT') return p.entityId === u.unitId;
                if (p.level === 'REGIONAL') return p.entityId === u.regionId;
                if (p.level === 'CORPORATE') return !!p.entityId && isDescendantOf(p.entityId, u.unitId);
                return false;
            });
            applicableByUnit.set(u.unitId, list);
        });
        setUnits(prev => prev.map(u => {
            const applicable = applicableByUnit.get(u.unitId) || [];
            return {
                ...u,
                periods: (u.periods || []).map(p => {
                    if (p.protocolKey) return p;
                    const direct = protocols.find(pr => pr.id === p.protocolId);
                    if (direct) return { ...p, protocolKey: makeProtocolKey(direct) };
                    // Drift recovery: if the unit has exactly one applicable mandate, adopt it
                    // so previously-scheduled periods reappear under the correct pillar tab.
                    if (applicable.length === 1) {
                        const sole = applicable[0];
                        return { ...p, protocolId: sole.id, protocolKey: makeProtocolKey(sole) };
                    }
                    return p;
                })
            };
        }));
    }, [protocols, units, setUnits, entities]);

    const [searchTerm, setSearchTerm] = useState("");
    const [modalMode, setModalMode] = useState<'PERIOD' | 'AUDIT' | 'VIEW_REPORT' | 'MANAGE_PROTOCOLS' | 'ADD_PROTOCOL' | 'SCHEDULE_LOCATION' | 'PUBLISH_CONFIRM' | null>(null);
    const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
    const [activePeriodId, setActivePeriodId] = useState<string | null>(null);
    const [selectedAudit, setSelectedAudit] = useState<CrossDeptAudit | null>(null);
    const [editingAuditId, setEditingAuditId] = useState<string | null>(null);

    // Track active Audit Type tab per unit
    const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

    const [periodForm, setPeriodForm] = useState({ frequency: 'Monthly' as PeriodFrequency, startDate: '', endDate: '' });
    const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
    const [auditForm, setAuditForm] = useState({ departments: [] as string[], scope: '', startDate: '', endDate: '', checklist: '', auditTeam: [] as string[], locationAssignments: [] as LocationAssignment[], recurring: 'None', isUnannounced: false, isFollowUp: false, priority: 'Medium' as 'High' | 'Medium' | 'Low', auditLevel: 'department' as 'department' | 'location', deptLevels: {} as Record<string, 'department' | 'location'>, reviewer: '', reviewRequired: true });
    const [expandedLocEntries, setExpandedLocEntries] = useState<Set<string>>(new Set());

    const getFstAuditorsForEntity = useCallback((entityId: string | null): string[] => {
        const FST_ROLES = ['food safety team leader', 'food safety team', 'food safety coordinator'];
        const fstUsers = allUsers.filter(u => {
            if ((u.Status || '').toLowerCase() !== 'active' && u.Status) return false;
            const role = (u.Role || '').toLowerCase();
            return FST_ROLES.some(r => role.includes(r));
        });
        if (fstUsers.length === 0) return [];
        if (!entityId) return [];

        let entity = entities.find(e => e.id === entityId);
        if (!entity) return [];

        if (entity.type === 'department' || entity.type === 'user') {
            const parent = entities.find(e => e.id === entity!.parentId);
            if (parent) entity = parent;
        }

        const scopedUnitNames = new Set<string>();
        if (entity.type === 'unit') {
            if (entity.name?.trim()) scopedUnitNames.add(entity.name.trim().toLowerCase());
        } else if (entity.type === 'regional') {
            entities.filter(e => e.type === 'unit' && e.parentId === entity!.id).forEach(e => {
                if (e.name?.trim()) scopedUnitNames.add(e.name.trim().toLowerCase());
            });
        } else if (entity.type === 'corporate') {
            entities.filter(e => e.type === 'unit' && isDescendantOf(entity!.id, e.id)).forEach(e => {
                if (e.name?.trim()) scopedUnitNames.add(e.name.trim().toLowerCase());
            });
        }

        if (scopedUnitNames.size === 0) return [];

        const filtered = fstUsers.filter(u => {
            const empUnit = (u.Unit || '').trim().toLowerCase();
            return empUnit && scopedUnitNames.has(empUnit);
        });

        return filtered.map(u => u.Name || u.name || '').filter(Boolean);
    }, [allUsers, entities]);

    const getManualFstNamesForEntity = useCallback((entityId: string | null): string[] => {
        if (!entityId || manualFstMembers.length === 0) return [];
        let entity = entities.find(e => e.id === entityId);
        if (!entity) return [];
        if (entity.type === 'department' || entity.type === 'user') {
            const parent = entities.find(e => e.id === entity!.parentId);
            if (parent) entity = parent;
        }
        const scopedUnitIds = new Set<string>();
        if (entity.type === 'unit') {
            scopedUnitIds.add(entity.id);
        } else if (entity.type === 'regional') {
            entities.filter(e => e.type === 'unit' && e.parentId === entity!.id).forEach(e => scopedUnitIds.add(e.id));
        } else if (entity.type === 'corporate') {
            entities.filter(e => e.type === 'unit' && isDescendantOf(entity!.id, e.id)).forEach(e => scopedUnitIds.add(e.id));
        }
        return manualFstMembers
            .filter(m => m.status === 'Active' && m.unitId && scopedUnitIds.has(m.unitId))
            .map(m => m.name)
            .filter(Boolean);
    }, [manualFstMembers, entities]);

    const getHaccpTaggedAuditorNames = useCallback((): string[] => {
        const tagRecords = manualFstMembers.filter((m: any) => m._isTagRecord && m.haccpTeamTag && m.name);
        const manualTagged = manualFstMembers.filter((m: any) => !m._isTagRecord && m.haccpTeamTag && m.name && m.status === 'Active');
        return [...tagRecords, ...manualTagged].map((m: any) => m.name).filter(Boolean);
    }, [manualFstMembers]);

    const AVAILABLE_AUDITORS = useMemo(() => {
        let auditors: string[];
        if (!activeUnitId) {
            auditors = userRootId ? getFstAuditorsForEntity(userRootId) : [];
        } else {
            auditors = getFstAuditorsForEntity(activeUnitId);
        }
        const manualNames = getManualFstNamesForEntity(activeUnitId || userRootId || null);
        const taggedAuditors = getHaccpTaggedAuditorNames();
        const combined = Array.from(new Set([...auditors, ...manualNames, ...taggedAuditors]));
        return combined;
    }, [allUsers, manualFstMembers, activeUnitId, getFstAuditorsForEntity, getManualFstNamesForEntity, getHaccpTaggedAuditorNames, userRootId]);
    const [showWorkload, setShowWorkload] = useState(false);
    const [editingCycleNotes, setEditingCycleNotes] = useState<string | null>(null);
    const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);
    const [publishTarget, setPublishTarget] = useState<{ unitId: string; periodId: string } | null>(null);
    const [emailSending, setEmailSending] = useState(false);
    const { addNotification } = useNotifications();
    
    // Protocol Form
    const [protocolForm, setProtocolForm] = useState({ 
        name: '', 
        frequency: 'Monthly', 
        level: 'UNIT' as AuthorityLevel, 
        entityId: '', 
        effectiveDate: new Date().toISOString().split('T')[0] 
    });

    // Cross-Location Scheduling
    const [internalScheduledAudits, setInternalScheduledAudits] = useState<ScheduledAudit[]>([]);
    const scheduledAudits = externalScheduledAudits ?? internalScheduledAudits;
    const setScheduledAudits = setExternalScheduledAudits ?? setInternalScheduledAudits;
    const [schedulingUnitId, setSchedulingUnitId] = useState<string | null>(null);
    const [scheduleForm, setScheduleForm] = useState({
        checklist: '',
        scheduledDate: '',
        dueDate: '',
        notes: '',
        locations: [{ locationName: '', department: '', team: [] as string[], teamInput: '' }] as { locationName: string; department: string; team: string[]; teamInput: string }[],
    });
    const [completeDialog, setCompleteDialog] = useState<{ auditId: string; locationId: string; score: string; notes: string } | null>(null);

    // Dynamic Inheritance Logic
    const getUnitMandatoryPillars = (unit: UnitScheduleData): MandatoryPillar[] => {
        const applicable = protocols.filter(p => {
            if (p.level === 'UNIT') return p.entityId === unit.unitId;
            if (p.level === 'REGIONAL') return p.entityId === unit.regionId;
            if (p.level === 'CORPORATE') {
                if (!p.entityId) return false;
                return isDescendantOf(p.entityId, unit.unitId);
            }
            return false;
        });

        return applicable.map(p => {
            const pKey = makeProtocolKey(p);
            const isDone = unit.periods.some(per => (per.protocolId === p.id || (per.protocolKey && per.protocolKey === pKey)) && per.audits.some(a => a.status === 'Completed'));
            
            return {
                id: p.id,
                type: 'OTHER',
                label: p.name,
                frequency: p.frequency,
                lastDate: isDone ? '2025-04-10' : 'N/A',
                nextDue: isDone ? '2025-06-10' : 'Immediate',
                status: isDone ? 'Compliant' : 'Overdue',
                level: p.level,
                effectiveDate: p.effectiveDate
            };
        });
    };

    const scopedUnits = useMemo(() => {
        let filtered: UnitScheduleData[];
        if (currentScope === 'super-admin') filtered = units;
        else if (!userRootId) filtered = [];
        else filtered = units.filter(u => {
            if (currentScope === 'unit') return u.unitId === userRootId;
            if (currentScope === 'department' || currentScope === 'user') {
                const dept = entities.find(e => e.id === userRootId);
                return dept ? u.unitId === dept.parentId : false;
            }
            return isDescendantOf(userRootId, u.unitId);
        });
        const seen = new Set<string>();
        return filtered.filter(u => {
            if (seen.has(u.unitId)) return false;
            seen.add(u.unitId);
            return true;
        });
    }, [units, currentScope, userRootId, entities]);

    const kpiData = useMemo(() => {
        let totalScheduled = 0, totalCompleted = 0, totalOverdue = 0;
        let scoreSum = 0, scoreCount = 0;
        const today = new Date().toISOString().split('T')[0];
        scopedUnits.forEach(u => {
            u.periods.forEach(p => {
                p.audits.forEach(a => {
                    totalScheduled++;
                    if (a.status === 'Completed') {
                        totalCompleted++;
                        if (a.score !== undefined && !isNaN(a.score)) { scoreSum += a.score; scoreCount++; }
                    } else if (a.endDate && /^\d{4}-\d{2}-\d{2}$/.test(a.endDate) && a.endDate < today) {
                        totalOverdue++;
                    }
                });
            });
        });
        const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
        return { totalScheduled, totalCompleted, totalOverdue, avgScore, scoreCount };
    }, [scopedUnits]);

    const auditorWorkloadData = useMemo(() => {
        const map = new Map<string, { total: number; completed: number; scoreSum: number; scoreCount: number }>();
        scopedUnits.forEach(u => {
            u.periods.forEach(p => {
                p.audits.forEach(a => {
                    const auditors = a.locationAssignments && a.locationAssignments.length > 0
                        ? [...new Set(a.locationAssignments.flatMap(la => la.assignedAuditors))]
                        : a.auditTeam;
                    auditors.filter(n => n && n.trim()).forEach(name => {
                        const entry = map.get(name) || { total: 0, completed: 0, scoreSum: 0, scoreCount: 0 };
                        entry.total++;
                        if (a.status === 'Completed') {
                            entry.completed++;
                            if (a.score !== undefined) { entry.scoreSum += a.score; entry.scoreCount++; }
                        }
                        map.set(name, entry);
                    });
                });
            });
        });
        return Array.from(map.entries()).map(([name, d]) => ({
            name,
            total: d.total,
            completed: d.completed,
            pending: d.total - d.completed,
            avgScore: d.scoreCount > 0 ? Math.round(d.scoreSum / d.scoreCount) : null,
        }));
    }, [scopedUnits]);

    const isValidDate = (d: string | undefined) => d && /^\d{4}-\d{2}-\d{2}$/.test(d);

    const getUnitKpi = (unit: UnitScheduleData, unitPillars: MandatoryPillar[]) => {
        let total = 0, completed = 0;
        let scoreSum = 0, scoreCount = 0;
        let lastCompletedDate = '';
        let nearestDue = '';
        const today = new Date().toISOString().split('T')[0];
        unit.periods.forEach(p => {
            p.audits.forEach(a => {
                total++;
                if (a.status === 'Completed') {
                    completed++;
                    if (a.score !== undefined && !isNaN(a.score)) { scoreSum += a.score; scoreCount++; }
                    if (isValidDate(a.endDate) && a.endDate > lastCompletedDate) lastCompletedDate = a.endDate;
                } else {
                    if (isValidDate(a.endDate) && (!nearestDue || a.endDate < nearestDue)) nearestDue = a.endDate;
                }
            });
        });
        const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;
        const hasOverdue = unitPillars.some(p => p.status === 'Overdue');
        const hasDueSoon = unitPillars.some(p => p.status === 'Due Soon');
        let overdueDays = 0;
        if (nearestDue && nearestDue < today) {
            overdueDays = Math.floor((new Date(today).getTime() - new Date(nearestDue).getTime()) / 86400000);
        }
        let risk: 'High' | 'Medium' | 'Low' = 'Low';
        if (hasOverdue || (avgScore !== null && avgScore < 70)) risk = 'High';
        else if (hasDueSoon || (avgScore !== null && avgScore < 85)) risk = 'Medium';
        return { total, completed, avgScore, lastCompletedDate, nearestDue, overdueDays, risk };
    };

    const getUnitDepartmentLocations = (unitId: string, unitName?: string): Record<string, string[]> => {
        const unitEntity = entities.find(e => e.id === unitId)
            || (unitName ? entities.find(e => e.type === 'unit' && e.name && e.name.trim().toLowerCase() === unitName.trim().toLowerCase()) : undefined);
        if (unitEntity?.departmentLocations && Object.keys(unitEntity.departmentLocations).length > 0) {
            return unitEntity.departmentLocations;
        }
        return departmentLocations;
    };

    const buildLocationAssignments = (checklistTitle: string, level: 'department' | 'location', unitId?: string | null, deptLevels?: Record<string, 'department' | 'location'>): LocationAssignment[] => {
        const tmpl = checklistTemplates.find(t => t.title === checklistTitle);
        if (!tmpl || tmpl.pages.length === 0) return [];
        const unitLocs = unitId ? getUnitDepartmentLocations(unitId) : departmentLocations;
        const assignments: LocationAssignment[] = [];
        tmpl.pages.forEach(p => {
            const deptLevel = deptLevels?.[p.title] ?? level;
            if (deptLevel === 'location') {
                const locs = unitLocs[p.title];
                if (locs && locs.length > 0) {
                    locs.forEach(loc => {
                        assignments.push({ locationName: `${p.title} › ${loc}`, assignedAuditors: [] as string[] });
                    });
                } else {
                    assignments.push({ locationName: p.title, assignedAuditors: [] as string[] });
                }
            } else {
                assignments.push({ locationName: p.title, assignedAuditors: [] as string[] });
            }
        });
        return assignments;
    };

    const rebuildAssignmentsForDept = (deptName: string, newLevel: 'department' | 'location', currentAssignments: LocationAssignment[]): LocationAssignment[] => {
        const unitLocs = activeUnitId ? getUnitDepartmentLocations(activeUnitId) : departmentLocations;
        const otherAssignments = currentAssignments.filter(la => {
            const base = la.locationName.includes(' › ') ? la.locationName.split(' › ')[0] : la.locationName;
            return base !== deptName;
        });
        const newDeptAssignments: LocationAssignment[] = [];
        if (newLevel === 'location') {
            const locs = unitLocs[deptName];
            if (locs && locs.length > 0) {
                locs.forEach(loc => {
                    newDeptAssignments.push({ locationName: `${deptName} › ${loc}`, assignedAuditors: [] as string[] });
                });
            } else {
                newDeptAssignments.push({ locationName: deptName, assignedAuditors: [] as string[] });
            }
        } else {
            newDeptAssignments.push({ locationName: deptName, assignedAuditors: [] as string[] });
        }
        const tmpl = checklistTemplates.find(t => t.title === auditForm.checklist);
        if (!tmpl) return [...otherAssignments, ...newDeptAssignments];
        const pageOrder = tmpl.pages.map(p => p.title);
        const combined = [...otherAssignments, ...newDeptAssignments];
        combined.sort((a, b) => {
            const aBase = a.locationName.includes(' › ') ? a.locationName.split(' › ')[0] : a.locationName;
            const bBase = b.locationName.includes(' › ') ? b.locationName.split(' › ')[0] : b.locationName;
            return pageOrder.indexOf(aBase) - pageOrder.indexOf(bBase);
        });
        return combined;
    };

    const updateCycleNotes = (unitId: string, periodId: string, notes: string) => {
        setUnits(prev => prev.map(u => u.unitId === unitId ? { ...u, periods: u.periods.map(p => p.id === periodId ? { ...p, notes } : p) } : u));
    };

    const getNextCycleDates = (endDate: string, frequency: PeriodFrequency) => {
        const end = new Date(endDate + 'T00:00:00');
        const start = new Date(end);
        start.setDate(start.getDate() + 1);
        const next = new Date(start);
        switch (frequency) {
            case 'Monthly': next.setMonth(next.getMonth() + 1); break;
            case 'Quarterly': next.setMonth(next.getMonth() + 3); break;
            case 'Half Yearly': next.setMonth(next.getMonth() + 6); break;
            case 'Yearly': next.setFullYear(next.getFullYear() + 1); break;
            case 'Biennial': next.setFullYear(next.getFullYear() + 2); break;
        }
        next.setDate(next.getDate() - 1);
        return { startDate: start.toISOString().split('T')[0], endDate: next.toISOString().split('T')[0] };
    };

    const toggleUnitExpand = (unitId: string) => setUnits(prev => prev.map(u => u.unitId === unitId ? { ...u, isExpanded: !u.isExpanded } : u));
    const togglePeriodExpand = (unitId: string, periodId: string) => setUnits(prev => prev.map(u => u.unitId === unitId ? { ...u, periods: u.periods.map(p => p.id === periodId ? { ...p, isExpanded: !p.isExpanded } : p) } : u));
    
    const handleAddPeriod = () => {
        if (!activeUnitId || !periodForm.startDate) return;
        if (periodForm.endDate && periodForm.endDate < periodForm.startDate) {
            alert('End date cannot be earlier than start date.');
            return;
        }
        const currentPillarId = activeTabs[activeUnitId];
        if (!currentPillarId) return;
        const proto = protocols.find(p => p.id === currentPillarId);
        if (proto && !canScheduleForProtocol(proto.level)) return;

        if (editingPeriodId) {
            setUnits(prev => prev.map(u => u.unitId === activeUnitId ? {
                ...u,
                periods: u.periods.map(p => p.id === editingPeriodId ? {
                    ...p,
                    frequency: periodForm.frequency,
                    startDate: periodForm.startDate,
                    endDate: periodForm.endDate,
                } : p)
            } : u));
            setEditingPeriodId(null);
            setModalMode(null);
            return;
        }

        const newPeriod: AuditPeriod = { 
            id: `P-${Date.now()}`, 
            protocolId: currentPillarId,
            protocolKey: proto ? makeProtocolKey(proto) : undefined,
            frequency: periodForm.frequency, 
            startDate: periodForm.startDate, 
            endDate: periodForm.endDate, 
            audits: [], 
            isExpanded: true, 
            status: 'DRAFT' 
        };
        setUnits(prev => prev.map(u => u.unitId === activeUnitId ? { ...u, periods: [newPeriod, ...u.periods], isExpanded: true } : u));
        setModalMode(null);
        setTimeout(() => onImmediateSave?.(), 100);
    };

    const openEditPeriod = (unitId: string, period: AuditPeriod) => {
        setActiveUnitId(unitId);
        setEditingPeriodId(period.id);
        if (period.protocolId) setActiveTabs(prev => ({ ...prev, [unitId]: period.protocolId }));
        setPeriodForm({
            frequency: period.frequency,
            startDate: period.startDate,
            endDate: period.endDate,
        });
        setModalMode('PERIOD');
    };

    const getActivePeriod = (): AuditPeriod | null => {
        if (!activeUnitId || !activePeriodId) return null;
        const unit = units.find(u => u.unitId === activeUnitId);
        return unit?.periods.find(p => p.id === activePeriodId) || null;
    };

    const openAuditModal = (unitId: string, periodId: string) => {
        const unit = units.find(u => u.unitId === unitId);
        const period = unit?.periods.find(p => p.id === periodId);
        if (period) {
            const proto = protocols.find(p => p.id === period.protocolId);
            if (proto && !canScheduleForProtocol(proto.level)) return;
        }
        setActiveUnitId(unitId);
        setActivePeriodId(periodId);
        setAuditForm(prev => ({
            ...prev,
            departments: [],
            scope: '',
            startDate: period?.startDate || '',
            endDate: period?.endDate || '',
            checklist: '',
            auditTeam: [],
            locationAssignments: [],
            recurring: 'None',
            isUnannounced: false,
            isFollowUp: false,
            priority: 'Medium',
            auditLevel: 'department',
            deptLevels: {},
            reviewer: '',
            reviewRequired: true,
        }));
        setEditingAuditId(null);
        setModalMode('AUDIT');
    };

    const openEditAuditModal = (unitId: string, periodId: string, audit: CrossDeptAudit) => {
        const unit = units.find(u => u.unitId === unitId);
        const period = unit?.periods.find(p => p.id === periodId);
        if (period) {
            const proto = protocols.find(p => p.id === period.protocolId);
            if (proto && !canScheduleForProtocol(proto.level)) return;
        }
        setActiveUnitId(unitId);
        setActivePeriodId(periodId);
        const tmpl = checklistTemplates.find(t => t.title === audit.checklist);
        const restoredAssignments: LocationAssignment[] = audit.locationAssignments
            ? audit.locationAssignments
            : tmpl
                ? tmpl.pages.map(p => ({
                    locationName: p.title,
                    assignedAuditors: audit.departments.includes(p.title) ? [...audit.auditTeam] : [],
                }))
                : [];
        const inferredDeptLevels: Record<string, 'department' | 'location'> = {};
        if (tmpl && restoredAssignments.length > 0) {
            const pageNames = new Set(tmpl.pages.map(p => p.title));
            tmpl.pages.forEach(p => {
                const hasLocationEntry = restoredAssignments.some(la => la.locationName.startsWith(`${p.title} › `));
                inferredDeptLevels[p.title] = hasLocationEntry ? 'location' : 'department';
            });
        }
        const inferredLevel = Object.values(inferredDeptLevels).some(l => l === 'location') ? 'location' : 'department';
        setAuditForm({
            departments: audit.departments,
            scope: audit.scope,
            startDate: audit.startDate,
            endDate: audit.endDate,
            checklist: audit.checklist,
            auditTeam: audit.auditTeam,
            locationAssignments: restoredAssignments,
            recurring: audit.recurring || 'None',
            isUnannounced: audit.isUnannounced || false,
            isFollowUp: audit.isFollowUp || false,
            priority: audit.priority || 'Medium',
            auditLevel: inferredLevel as 'department' | 'location',
            deptLevels: inferredDeptLevels,
            reviewer: audit.reviewer || '',
            reviewRequired: audit.reviewRequired !== false,
        });
        setEditingAuditId(audit.id);
        setModalMode('AUDIT');
    };

    const handleDeleteAudit = (unitId: string, periodId: string, auditId: string) => {
        const unit = units.find(u => u.unitId === unitId);
        const period = unit?.periods.find(p => p.id === periodId);
        if (period) {
            const proto = protocols.find(p => p.id === period.protocolId);
            if (proto && !canScheduleForProtocol(proto.level)) return;
        }
        if (!confirm('Are you sure you want to delete this audit entry?')) return;
        setUnits(prev => prev.map(u => u.unitId === unitId
            ? { ...u, periods: u.periods.map(p => p.id === periodId ? { ...p, audits: p.audits.filter(a => a.id !== auditId) } : p) }
            : u
        ));
        setTimeout(() => onImmediateSave?.(), 100);
    };

    const handleDeletePeriod = (unitId: string, periodId: string) => {
        const unit = units.find(u => u.unitId === unitId);
        const period = unit?.periods.find(p => p.id === periodId);
        if (!period) return;
        const proto = protocols.find(p => p.id === period.protocolId);
        if (proto && !canScheduleForProtocol(proto.level)) return;
        if (period.audits && period.audits.length > 0) {
            if (!confirm('This cycle has scheduled audits. Deleting this cycle will remove it and all its audits. Continue?')) return;
        } else {
            if (!confirm('Are you sure you want to delete this audit cycle?')) return;
        }
        setUnits(prev => prev.map(u => u.unitId === unitId
            ? { ...u, periods: u.periods.filter(p => p.id !== periodId) }
            : u
        ));
        setTimeout(() => onImmediateSave?.(), 100);
    };

    const handleAddAudit = () => {
        if (!activeUnitId || !activePeriodId) return;
        const hasLocationAssignments = auditForm.locationAssignments.length > 0 && auditForm.locationAssignments.some(la => la.assignedAuditors.length > 0);
        if (!hasLocationAssignments && auditForm.departments.length === 0) { alert('Please assign at least one auditor to a location.'); return; }
        if (!auditForm.startDate || !auditForm.endDate) { alert('Both audit start and end dates are required.'); return; }
        if (auditForm.startDate > auditForm.endDate) { alert('Audit start date cannot be after end date.'); return; }
        const period = getActivePeriod();
        if (period) {
            if (period.startDate && auditForm.startDate < period.startDate) { alert(`Audit start date must be on or after cycle start (${period.startDate}).`); return; }
            if (period.endDate && auditForm.endDate > period.endDate) { alert(`Audit end date must be on or before cycle end (${period.endDate}).`); return; }
        }
        const allAuditors = hasLocationAssignments
            ? [...new Set(auditForm.locationAssignments.flatMap(la => la.assignedAuditors))]
            : auditForm.auditTeam;
        const allDepts = hasLocationAssignments
            ? auditForm.locationAssignments.filter(la => la.assignedAuditors.length > 0).map(la => la.locationName)
            : auditForm.departments;

        if (editingAuditId) {
            setUnits(prev => prev.map(u => u.unitId === activeUnitId ? { ...u, periods: u.periods.map(p => p.id === activePeriodId ? { ...p, audits: p.audits.map(a => a.id === editingAuditId ? {
                ...a,
                departments: allDepts,
                scope: auditForm.scope,
                startDate: auditForm.startDate,
                endDate: auditForm.endDate,
                checklist: auditForm.checklist,
                auditTeam: allAuditors,
                locationAssignments: hasLocationAssignments ? auditForm.locationAssignments.filter(la => la.assignedAuditors.length > 0) : undefined,
                isUnannounced: auditForm.isUnannounced,
                isFollowUp: auditForm.isFollowUp,
                priority: auditForm.priority,
                reviewer: auditForm.reviewer || undefined,
                reviewRequired: auditForm.reviewRequired,
            } : a) } : p) } : u));
            setEditingAuditId(null);
            setModalMode(null);
            setTimeout(() => onImmediateSave?.(), 100);
            return;
        }

        const newAudit: CrossDeptAudit = {
            id: `A-${Date.now()}`,
            departments: allDepts,
            scope: auditForm.scope,
            startDate: auditForm.startDate,
            endDate: auditForm.endDate,
            checklist: auditForm.checklist,
            auditTeam: allAuditors,
            locationAssignments: hasLocationAssignments ? auditForm.locationAssignments.filter(la => la.assignedAuditors.length > 0) : undefined,
            status: 'Scheduled',
            isUnannounced: auditForm.isUnannounced,
            createdAt: new Date().toISOString(),
            priority: auditForm.priority,
            reviewer: auditForm.reviewer || undefined,
            reviewRequired: auditForm.reviewRequired,
        };
        setUnits(prev => prev.map(u => u.unitId === activeUnitId ? { ...u, periods: u.periods.map(p => p.id === activePeriodId ? { ...p, audits: [...p.audits, newAudit] } : p) } : u));
        setModalMode(null);
        setTimeout(() => onImmediateSave?.(), 100);
    };

    const handleAddProtocol = () => {
        if (!protocolForm.name || !protocolForm.effectiveDate) {
            alert("Name and Effective Date are mandatory.");
            return;
        }

        let finalEntityId = protocolForm.entityId || userRootId || '';
        if (!finalEntityId) {
            alert("Please select an entity for this mandate.");
            return;
        }

        if (editingProtocolId) {
            setProtocols(prev => prev.map(p => p.id === editingProtocolId ? {
                ...p,
                name: protocolForm.name,
                frequency: protocolForm.frequency,
                level: protocolForm.level,
                entityId: finalEntityId,
                effectiveDate: protocolForm.effectiveDate
            } : p));
            setEditingProtocolId(null);
        } else {
            const newP: MandatoryProtocol = {
                id: `p-${Date.now()}`,
                name: protocolForm.name,
                frequency: protocolForm.frequency,
                level: protocolForm.level,
                entityId: finalEntityId,
                effectiveDate: protocolForm.effectiveDate
            };
            setProtocols(prev => [...prev, newP]);
        }
        
        setModalMode('MANAGE_PROTOCOLS');
        setProtocolForm({ name: '', frequency: 'Monthly', level: 'UNIT', entityId: '', effectiveDate: new Date().toISOString().split('T')[0] });
    };

    const openEditProtocol = (p: MandatoryProtocol) => {
        setEditingProtocolId(p.id);
        setProtocolForm({ name: p.name, frequency: p.frequency, level: p.level, entityId: p.entityId, effectiveDate: p.effectiveDate });
        setModalMode('ADD_PROTOCOL');
    };

    const handleDeleteProtocol = (id: string) => {
        if(confirm('Delete this mandatory mandate? This will reflect across all linked units.')) {
            setProtocols(prev => prev.filter(p => p.id !== id));
            fetch('/api/protocols', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            }).catch(e => console.error('Failed to delete protocol from DB:', e));
        }
    };

    const openReport = (audit: CrossDeptAudit) => {
        setSelectedAudit(audit);
        setModalMode('VIEW_REPORT');
    };

    const togglePeriodLock = (unitId: string, periodId: string) => {
      const unit = units.find(u => u.unitId === unitId);
      const period = unit?.periods.find(p => p.id === periodId);
      if (period) {
        const proto = protocols.find(p => p.id === period.protocolId);
        if (proto && !canScheduleForProtocol(proto.level)) return;
      }
      const isPublishing = period && period.status === 'DRAFT';

      if (isPublishing && period && period.audits.length > 0) {
        setPublishTarget({ unitId, periodId });
        setModalMode('PUBLISH_CONFIRM');
        return;
      }

      setUnits(prev => prev.map(u => {
          if (u.unitId !== unitId) return u;
          return {
              ...u,
              periods: u.periods.map(p => p.id === periodId ? { ...p, status: p.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT' } : p)
          };
      }));
      setTimeout(() => onImmediateSave?.(), 100);
    };

    const getPublishAuditorDetails = (unitId: string, periodId: string) => {
      const unit = units.find(u => u.unitId === unitId);
      const period = unit?.periods.find(p => p.id === periodId);
      if (!unit || !period) return [];
      const auditorMap = new Map<string, { audits: string[]; locations: string[]; startDate: string; endDate: string }>();
      period.audits.filter(a => a.status !== 'Completed').forEach(audit => {
        const auditLabel = audit.checklist || audit.scope || 'Audit';
        if (audit.locationAssignments && audit.locationAssignments.length > 0) {
          audit.locationAssignments.forEach(la => {
            la.assignedAuditors.forEach(name => {
              const entry = auditorMap.get(name) || { audits: [], locations: [], startDate: audit.startDate, endDate: audit.endDate };
              if (!entry.audits.includes(auditLabel)) entry.audits.push(auditLabel);
              if (!entry.locations.includes(la.locationName)) entry.locations.push(la.locationName);
              auditorMap.set(name, entry);
            });
          });
        } else {
          audit.auditTeam.forEach(name => {
            const entry = auditorMap.get(name) || { audits: [], locations: [], startDate: audit.startDate, endDate: audit.endDate };
            if (!entry.audits.includes(auditLabel)) entry.audits.push(auditLabel);
            entry.locations = [...new Set([...entry.locations, ...audit.departments])];
            auditorMap.set(name, entry);
          });
        }
      });
      return Array.from(auditorMap.entries()).map(([name, data]) => ({ name, ...data }));
    };

    const executePublishAndNotify = async () => {
      if (!publishTarget) return;
      const { unitId, periodId } = publishTarget;
      const unit = units.find(u => u.unitId === unitId);
      const period = unit?.periods.find(p => p.id === periodId);
      if (!unit || !period) return;

      setEmailSending(true);

      setUnits(prev => prev.map(u => {
        if (u.unitId !== unitId) return u;
        return { ...u, periods: u.periods.map(p => p.id === periodId ? { ...p, status: 'PUBLISHED' as PeriodStatus } : p) };
      }));

      if (onPublishAudits) {
        const tasks = period.audits
          .flatMap(audit => {
            const groupId = audit.id;
            if (audit.locationAssignments && audit.locationAssignments.length > 0) {
              const allAuditors = new Set<string>();
              const allAssigned = audit.locationAssignments.every(la => la.assignedAuditors.length > 0);
              audit.locationAssignments.forEach(la => {
                la.assignedAuditors.forEach(a => allAuditors.add(a));
              });
              const isSingleAuditorAllDepts = allAssigned && allAuditors.size === 1 && audit.locationAssignments.length > 1;

              if (isSingleAuditorAllDepts) {
                const auditorName = Array.from(allAuditors)[0];
                const allLocations = audit.locationAssignments.map(la => la.locationName);
                return [{
                  id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}-combined`,
                  title: audit.checklist || audit.scope,
                  unitName: unit.unitName,
                  department: allLocations.join(', '),
                  auditorName,
                  scheduledDate: audit.startDate,
                  endDate: audit.endDate,
                  checklistName: audit.checklist || audit.scope,
                  groupId,
                  assignedLocations: allLocations,
                  isCombinedAudit: true,
                  createdAt: audit.createdAt || new Date().toISOString(),
                  reviewer: audit.reviewer,
                  reviewRequired: audit.reviewRequired,
                }];
              }

              const perLocationTasks: { auditorName: string; locationName: string }[] = [];
              audit.locationAssignments.forEach(la => {
                la.assignedAuditors.forEach(auditor => {
                  perLocationTasks.push({ auditorName: auditor, locationName: la.locationName });
                });
              });
              return perLocationTasks.map(({ auditorName, locationName }) => ({
                id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}-${locationName.replace(/[^a-zA-Z0-9]/g, '-')}`,
                title: audit.checklist || audit.scope,
                unitName: unit.unitName,
                department: locationName,
                auditorName,
                scheduledDate: audit.startDate,
                endDate: audit.endDate,
                checklistName: audit.checklist || audit.scope,
                groupId,
                assignedLocations: [locationName],
                createdAt: audit.createdAt || new Date().toISOString(),
                reviewer: audit.reviewer,
                reviewRequired: audit.reviewRequired,
              }));
            }
            return audit.auditTeam.map(auditorName => ({
              id: `sched-${period.id}-${audit.id}-${auditorName.replace(/\s+/g, '-')}`,
              title: audit.checklist || audit.scope,
              unitName: unit.unitName,
              department: audit.departments.join(', '),
              auditorName,
              scheduledDate: audit.startDate,
              endDate: audit.endDate,
              checklistName: audit.checklist || audit.scope,
              groupId,
              assignedLocations: undefined as string[] | undefined,
              createdAt: audit.createdAt || new Date().toISOString(),
              reviewer: audit.reviewer,
              reviewRequired: audit.reviewRequired,
            }));
          });
        if (tasks.length > 0) onPublishAudits(tasks);
      }

      const auditorDetails = getPublishAuditorDetails(unitId, periodId);
      
      try {
        await fetch('/api/audit-email-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitName: unit.unitName,
            periodFrequency: period.frequency,
            periodStart: period.startDate,
            periodEnd: period.endDate,
            auditors: auditorDetails.map(a => ({
              name: a.name,
              audits: a.audits,
              locations: a.locations,
              startDate: a.startDate,
              endDate: a.endDate,
            })),
          }),
        });
      } catch (e) {
        // Email API call is best-effort
      }

      auditorDetails.forEach(auditor => {
        addNotification({
          type: 'AUDIT_PUBLISHED',
          title: 'Audit Assignment Published',
          message: `${auditor.name} has been assigned to audit "${auditor.audits.join(', ')}" at ${unit.unitName}. Audit window: ${period.startDate} to ${period.endDate}. Locations: ${auditor.locations.join(', ')}. Please navigate to My Audits to begin.`,
          icon: 'shield',
          severity: 'info',
          recipients: [auditor.name],
          senderName: 'Audit Scheduler',
        });
      });

      setEmailSending(false);
      setModalMode(null);
      setPublishTarget(null);
      setTimeout(() => onImmediateSave?.(), 100);
    };

    const handleTabChange = (unitId: string, protocolId: string) => {
        setActiveTabs(prev => ({ ...prev, [unitId]: protocolId }));
    };

    const handleInitiateCycleFromPillar = (unitId: string, pillar: MandatoryPillar) => {
        setActiveUnitId(unitId);
        setEditingPeriodId(null);
        setActiveTabs(prev => ({ ...prev, [unitId]: pillar.id }));
        setPeriodForm({
            ...periodForm,
            frequency: (pillar.frequency.split(' ')[0] as PeriodFrequency) || 'Monthly',
            startDate: new Date().toISOString().split('T')[0]
        });
        setModalMode('PERIOD');
    };

    // Cross-Location Scheduling handlers
    const getInitials = (name: string) => name.trim().split(/\s+/).map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2);

    const allLocationsComplete = (sa: ScheduledAudit) => sa.locations.length > 0 && sa.locations.every(l => l.status === 'Completed');

    const openScheduleModal = (unitId: string) => {
        setSchedulingUnitId(unitId);
        setScheduleForm({ checklist: '', scheduledDate: '', dueDate: '', notes: '', locations: [{ locationName: '', department: '', team: [], teamInput: '' }] });
        setModalMode('SCHEDULE_LOCATION');
    };

    const addScheduleLocation = () => {
        setScheduleForm(f => ({ ...f, locations: [...f.locations, { locationName: '', department: '', team: [], teamInput: '' }] }));
    };

    const removeScheduleLocation = (idx: number) => {
        setScheduleForm(f => ({ ...f, locations: f.locations.filter((_, i) => i !== idx) }));
    };

    const updateScheduleLocation = (idx: number, field: string, value: string) => {
        setScheduleForm(f => ({ ...f, locations: f.locations.map((l, i) => i === idx ? { ...l, [field]: value } : l) }));
    };

    const addScheduleTeamMember = (idx: number) => {
        const name = scheduleForm.locations[idx].teamInput.trim();
        if (!name || scheduleForm.locations[idx].team.includes(name)) return;
        setScheduleForm(f => ({ ...f, locations: f.locations.map((l, i) => i === idx ? { ...l, team: [...l.team, name], teamInput: '' } : l) }));
    };

    const removeScheduleTeamMember = (li: number, mi: number) => {
        setScheduleForm(f => ({ ...f, locations: f.locations.map((l, i) => i === li ? { ...l, team: l.team.filter((_, j) => j !== mi) } : l) }));
    };

    const handleCreateSchedule = () => {
        if (!schedulingUnitId || !scheduleForm.scheduledDate || !scheduleForm.dueDate) return;
        const validLocs = scheduleForm.locations.filter(l => l.locationName.trim());
        if (validLocs.length === 0) return;
        const sa: ScheduledAudit = {
            id: `SA-${Date.now()}`,
            unitId: schedulingUnitId,
            checklistId: scheduleForm.checklist || 'general',
            checklistTitle: scheduleForm.checklist || 'Cross-Location Audit',
            scheduledDate: scheduleForm.scheduledDate,
            dueDate: scheduleForm.dueDate,
            notes: scheduleForm.notes.trim() || undefined,
            overallStatus: 'Scheduled',
            createdAt: new Date().toISOString(),
            locations: validLocs.map((l, i) => ({
                locationId: `loc-${Date.now()}-${i}`,
                locationName: l.locationName.trim(),
                department: l.department.trim(),
                assignedTeam: l.team,
                status: 'Scheduled',
            })),
        };
        setScheduledAudits(prev => [sa, ...prev]);
        setModalMode(null);
        setSchedulingUnitId(null);
    };

    const updateLocationStatus = (auditId: string, locationId: string, patch: Partial<LocationAuditAssignment>) => {
        setScheduledAudits(prev => prev.map(sa => {
            if (sa.id !== auditId) return sa;
            const updated = sa.locations.map(l => l.locationId === locationId ? { ...l, ...patch } : l);
            const allDone = updated.every(l => l.status === 'Completed');
            const anyActive = updated.some(l => l.status === 'In Progress');
            return { ...sa, locations: updated, overallStatus: allDone ? 'Completed' : anyActive ? 'In Progress' : 'Scheduled' };
        }));
    };

    const handleBeginLocationAudit = (auditId: string, loc: LocationAuditAssignment) => {
        updateLocationStatus(auditId, loc.locationId, { status: 'In Progress', startedAt: new Date().toISOString() });
    };

    const handleConfirmComplete = () => {
        if (!completeDialog) return;
        const { auditId, locationId, score, notes } = completeDialog;
        updateLocationStatus(auditId, locationId, {
            status: 'Completed',
            completedAt: new Date().toISOString(),
            score: score ? parseInt(score, 10) : undefined,
            notes: notes.trim() || undefined,
        });
        setCompleteDialog(null);
    };

    const handleExportUnitReport = async (sa: ScheduledAudit) => {
        if (!allLocationsComplete(sa)) return;
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 40, mr = 40, mt = 40, mb = 40;
        const cw = pw - ml - mr;
        let pageNum = 1;
        const addFooter = (pn: number) => {
            const total = pdf.getNumberOfPages();
            pdf.setFontSize(7); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'normal');
            pdf.text('HACCP PRO Confidential — Generated ' + new Date().toLocaleDateString(), pw / 2, ph - 18, { align: 'center' });
            pdf.text(`${pn} / ${total}`, pw - mr, ph - 18, { align: 'right' });
        };
        pdf.setFillColor(15, 23, 42); pdf.rect(0, 0, pw, 120, 'F');
        pdf.setFontSize(22); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
        pdf.text('HACCP PRO', ml, 55);
        pdf.setFontSize(9); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
        pdf.text('FOOD SAFETY INTELLIGENCE', ml, 70);
        pdf.setFillColor(20, 184, 166); pdf.rect(0, 118, pw, 4, 'F');
        let y = 160;
        pdf.setFontSize(11); pdf.setTextColor(100, 116, 139); pdf.setFont('helvetica', 'bold');
        pdf.text('UNIT AUDIT REPORT', ml, y); y += 20;
        pdf.setFontSize(18); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
        const titleLines = pdf.splitTextToSize(sa.checklistTitle.toUpperCase(), cw);
        pdf.text(titleLines, ml, y); y += titleLines.length * 22 + 10;
        const metaRows = [['Scheduled Date', sa.scheduledDate], ['Due Date', sa.dueDate], ['Report Generated', new Date().toLocaleDateString()], ['Locations Audited', String(sa.locations.length)]];
        metaRows.forEach(([label, val]) => {
            pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 116, 139);
            pdf.text(label.toUpperCase(), ml, y);
            pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
            pdf.text(val, ml + 140, y); y += 16;
        });
        if (sa.notes) { y += 8; pdf.setFontSize(8); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(100, 116, 139); pdf.text('Notes: ' + sa.notes, ml, y); y += 16; }
        addFooter(pageNum);
        pdf.addPage(); pageNum++; y = mt;
        pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 20, 'F');
        pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
        pdf.text('LOCATIONS SUMMARY', ml + 8, y + 13); y += 20;
        const cols = [{ label: 'Location', x: ml + 4, w: 130 }, { label: 'Department', x: ml + 134, w: 100 }, { label: 'Team', x: ml + 234, w: 130 }, { label: 'Completed On', x: ml + 364, w: 90 }, { label: 'Score', x: ml + 454, w: 50 }];
        pdf.setFillColor(241, 245, 249); pdf.rect(ml, y, cw, 16, 'F');
        pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.rect(ml, y, cw, 16);
        pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'bold');
        cols.forEach(c => pdf.text(c.label, c.x, y + 11)); y += 16;
        sa.locations.forEach((loc, i) => {
            const rowH = 18;
            if (y + rowH > ph - mb) { addFooter(pageNum); pdf.addPage(); pageNum++; y = mt; }
            if (i % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(ml, y, cw, rowH, 'F'); }
            pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3); pdf.line(ml, y + rowH, ml + cw, y + rowH);
            pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
            pdf.text(pdf.splitTextToSize(loc.locationName, cols[0].w - 6)[0] || '', cols[0].x, y + 12);
            pdf.text(pdf.splitTextToSize(loc.department || '—', cols[1].w - 6)[0] || '', cols[1].x, y + 12);
            pdf.text(pdf.splitTextToSize(loc.assignedTeam.join(', ') || '—', cols[2].w - 6)[0] || '', cols[2].x, y + 12);
            pdf.text(loc.completedAt ? new Date(loc.completedAt).toLocaleDateString() : '—', cols[3].x, y + 12);
            if (loc.score !== undefined) {
                const sc = loc.score;
                const [r, g, b] = sc >= 90 ? [22, 163, 74] : sc >= 75 ? [217, 119, 6] : [220, 38, 38];
                pdf.setTextColor(r, g, b); pdf.setFont('helvetica', 'bold');
                pdf.text(`${sc}%`, cols[4].x, y + 12);
                pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal');
            } else { pdf.text('—', cols[4].x, y + 12); }
            y += rowH;
        });
        const allMembers = [...new Set(sa.locations.flatMap(l => l.assignedTeam))];
        if (allMembers.length > 0) {
            y += 24;
            if (y + 60 > ph - mb) { addFooter(pageNum); pdf.addPage(); pageNum++; y = mt; }
            pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 20, 'F');
            pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
            pdf.text('AUDIT TEAM ROSTER', ml + 8, y + 13); y += 28;
            const colW2 = cw / 2;
            allMembers.forEach((m, i) => {
                const cx = i % 2 === 0 ? ml : ml + colW2;
                if (i % 2 === 0 && i > 0) y += 16;
                if (i === 0 || i % 2 === 0) { if (y + 16 > ph - mb) { addFooter(pageNum); pdf.addPage(); pageNum++; y = mt; } }
                pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
                pdf.text(`• ${m}`, cx, y);
            });
        }
        addFooter(pageNum);
        const safeName = sa.checklistTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
        savePdfForPWA(pdf, `Unit_Audit_Report_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const canManageGlobalMandates = ['super-admin', 'corporate', 'regional', 'unit'].includes(currentScope);

    const findCorporateRoot = (entityId: string): string | null => {
        let current = entities.find(e => e.id === entityId);
        while (current) {
            if (current.type === 'corporate') return current.id;
            if (!current.parentId) break;
            current = entities.find(e => e.id === current?.parentId);
        }
        return null;
    };

    const isInSameCorporateTree = (entityId1: string, entityId2: string): boolean => {
        const root1 = findCorporateRoot(entityId1) || entityId1;
        const root2 = findCorporateRoot(entityId2) || entityId2;
        return root1 === root2;
    };

    const getVisibleProtocols = (): MandatoryProtocol[] => {
        return protocols.filter(p => {
            if (currentScope === 'super-admin') return true;
            if (!userRootId) return false;
            if (!isInSameCorporateTree(p.entityId, userRootId)) return false;
            if (p.level === 'CORPORATE') {
                return currentScope === 'corporate' || currentScope === 'regional' || currentScope === 'unit';
            }
            if (p.level === 'REGIONAL') {
                if (currentScope === 'corporate') return false;
                if (currentScope === 'regional') return p.entityId === userRootId;
                if (currentScope === 'unit') return isDescendantOf(p.entityId, userRootId);
                return false;
            }
            if (p.level === 'UNIT') {
                if (currentScope === 'corporate' || currentScope === 'regional') return false;
                return p.entityId === userRootId;
            }
            return false;
        });
    };

    const canEditProtocol = (p: MandatoryProtocol): boolean => {
        if (currentScope === 'super-admin') return true;
        if (!userRootId) return false;
        if (p.level === 'CORPORATE' && currentScope === 'corporate') return isInSameCorporateTree(p.entityId, userRootId);
        if (p.level === 'REGIONAL' && currentScope === 'regional') return p.entityId === userRootId;
        if (p.level === 'UNIT' && currentScope === 'unit') return p.entityId === userRootId;
        return false;
    };

    const getAllowedLevels = (): AuthorityLevel[] => {
        if (currentScope === 'super-admin') return ['CORPORATE', 'REGIONAL', 'UNIT'];
        if (currentScope === 'corporate') return ['CORPORATE'];
        if (currentScope === 'regional') return ['REGIONAL'];
        if (currentScope === 'unit') return ['UNIT'];
        return [];
    };

    const canScheduleForProtocol = (_protocolLevel: AuthorityLevel): boolean => {
        return true;
    };

    const getProtocolLevelForPeriod = (period: AuditPeriod): AuthorityLevel | null => {
        const proto = protocols.find(p => p.id === period.protocolId);
        return proto?.level || null;
    };

    const isReadOnlyPeriod = (period: AuditPeriod): boolean => {
        const level = getProtocolLevelForPeriod(period);
        if (!level) return false;
        return !canScheduleForProtocol(level);
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 animate-in fade-in duration-700">
            {/* Header / Action Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-200 shadow-lg sm:shadow-xl flex flex-col gap-4 sm:gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-gradient-to-b from-indigo-600 to-indigo-400" />
                <div className="flex items-center gap-3 sm:gap-5 z-10 w-full pl-2 sm:pl-0">
                    <div className="p-2.5 sm:p-4 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-3xl shadow-inner border border-indigo-100 shrink-0">
                        <ClipboardList className="w-5 h-5 sm:w-8 sm:h-8" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Audit Scheduler</h2>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-2 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Operational Oversight & Live Scores</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 z-10 w-full">
                    {canManageGlobalMandates && (
                        <button 
                            onClick={() => setModalMode('MANAGE_PROTOCOLS')}
                            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Gavel size={14} className="sm:w-4 sm:h-4" /> Manage Mandates
                        </button>
                    )}
                    <div className="relative group flex-1 sm:w-72 sm:flex-none">
                        <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        <input type="text" placeholder="Search units..." className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-slate-50 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-200 focus:ring-2 focus:ring-indigo-50 uppercase tracking-wider transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* KPI Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="p-1.5 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-lg sm:rounded-xl border border-indigo-100">
                            <CalendarDays className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">Total</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter">{kpiData.totalScheduled}</p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Scheduled</p>
                </div>
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="p-1.5 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg sm:rounded-xl border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">Done</span>
                    </div>
                    <div className="flex items-baseline gap-1 sm:gap-2">
                        <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tighter">{kpiData.totalCompleted}</p>
                        <span className="text-xs sm:text-sm font-bold text-slate-300">/ {kpiData.totalScheduled}</span>
                    </div>
                    <div className="mt-1.5 sm:mt-2 h-1 sm:h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${kpiData.totalScheduled > 0 ? (kpiData.totalCompleted / kpiData.totalScheduled) * 100 : 0}%` }} />
                    </div>
                </div>
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border ${kpiData.totalOverdue > 0 ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <AlertTriangle className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">Alert</span>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${kpiData.totalOverdue > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{kpiData.totalOverdue}</p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Overdue</p>
                </div>
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className={`p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border ${kpiData.avgScore >= 85 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : kpiData.avgScore >= 70 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            <TrendingUp className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <span className="text-[7px] sm:text-[8px] font-black text-slate-300 uppercase tracking-widest">Score</span>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${kpiData.scoreCount === 0 ? 'text-slate-300' : kpiData.avgScore >= 85 ? 'text-emerald-600' : kpiData.avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{kpiData.scoreCount > 0 ? `${kpiData.avgScore}%` : '—'}</p>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Avg Compliance</p>
                </div>
            </div>

            {/* Auditor Workload */}
            {auditorWorkloadData.length > 0 && (
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowWorkload(!showWorkload)}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors active:bg-slate-50"
                    >
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-violet-50 text-violet-600 rounded-lg sm:rounded-xl border border-violet-100">
                                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-black text-slate-600 uppercase tracking-widest">Auditor Workload</span>
                            <span className="text-[8px] sm:text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-violet-200">{auditorWorkloadData.length}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-slate-400 transition-transform duration-300" style={{ transform: showWorkload ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    {showWorkload && (
                        <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-1 border-t border-slate-100">
                            <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {auditorWorkloadData.map(aw => (
                                    <div key={aw.name} className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 p-3 sm:p-4 min-w-[170px] sm:min-w-[200px] flex-shrink-0">
                                        <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white text-[10px] sm:text-[11px] font-black flex items-center justify-center uppercase shadow-md">
                                                {aw.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-tight truncate">{aw.name}</p>
                                                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400">{aw.total} assigned</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Completion</span>
                                                <span className="text-[9px] sm:text-[10px] font-black text-slate-700">{aw.completed}/{aw.total}</span>
                                            </div>
                                            <div className="h-1 sm:h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${aw.total > 0 ? (aw.completed / aw.total) * 100 : 0}%` }} />
                                            </div>
                                            {aw.avgScore !== null && (
                                                <div className="flex justify-between items-center pt-0.5 sm:pt-1">
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">Avg Score</span>
                                                    <span className={`text-[9px] sm:text-[10px] font-black ${aw.avgScore >= 85 ? 'text-emerald-600' : aw.avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{aw.avgScore}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Units List */}
            <div className="flex flex-col gap-4 sm:gap-6">
                {scopedUnits.filter(u => u.unitName.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                    <div className="py-20 sm:py-40 text-center flex flex-col items-center justify-center bg-white rounded-2xl sm:rounded-[4rem] border-2 border-dashed border-slate-100">
                        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mb-5 sm:mb-8 text-slate-200 shadow-inner ring-4 sm:ring-8 ring-slate-50/50">
                            <Building2 className="w-8 h-8 sm:w-12 sm:h-12" strokeWidth={1.5} />
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black text-slate-800 uppercase tracking-tighter">No Units Found</h3>
                        <p className="text-slate-400 text-[11px] sm:text-xs mt-2 sm:mt-3 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] max-w-sm leading-relaxed px-6">
                            {searchTerm ? 'No units match your search. Try a different term.' : 'Add units to your organization hierarchy to begin scheduling audits.'}
                        </p>
                    </div>
                )}
                {scopedUnits.filter(u => u.unitName.toLowerCase().includes(searchTerm.toLowerCase())).map((unit) => {
                    const unitPillars = getUnitMandatoryPillars(unit);
                    const hasOverduePillar = unitPillars.some(p => p.status === 'Overdue');
                    const unitKpi = getUnitKpi(unit, unitPillars);
                    
                    const activeTabId = activeTabs[unit.unitId] || (unitPillars.length > 0 ? unitPillars[0].id : null);
                    const activePillar = unitPillars.find(p => p.id === activeTabId);
                    // Match periods by stable protocolKey too, so cycles survive a protocol id change (task #165).
                    const activeProto = protocols.find(p => p.id === activeTabId);
                    const activeProtoKey = activeProto ? makeProtocolKey(activeProto) : null;
                    const activePeriods = unit.periods.filter(p => p.protocolId === activeTabId || (activeProtoKey && p.protocolKey === activeProtoKey));
                    
                    return (
                        <div key={unit.unitId} className={`bg-white rounded-2xl sm:rounded-[2.5rem] border-2 transition-all duration-300 overflow-hidden ${unit.isExpanded ? 'border-indigo-500 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
                            <div className="p-4 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-3 sm:gap-0 active:bg-slate-50/50" onClick={() => toggleUnitExpand(unit.unitId)}>
                                <div className="flex items-center gap-3 sm:gap-6">
                                    <div className={`w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all shadow-inner border shrink-0 ${hasOverduePillar ? 'bg-rose-50 text-rose-500 border-rose-200 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                        <Building2 className="w-5 h-5 sm:w-8 sm:h-8" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                            <h3 className="text-sm sm:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">{unit.unitName}</h3>
                                            <div className="flex gap-1">
                                                {unitPillars.map((p, pidx) => (
                                                    <div key={p.id || pidx} title={`${p.label}: ${p.status}`} className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white shadow-sm ${p.status === 'Compliant' ? 'bg-emerald-500' : p.status === 'Due Soon' ? 'bg-amber-500' : p.status === 'Overdue' ? 'bg-rose-500 animate-pulse' : 'bg-slate-200'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1"><MapPin size={10} className="inline text-indigo-500 mr-1" /> {unit.region}</p>
                                        {/* Mobile-only KPI row */}
                                        <div className="flex items-center gap-2 mt-1.5 sm:hidden flex-wrap">
                                            {unitKpi.avgScore !== null && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${unitKpi.avgScore >= 85 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : unitKpi.avgScore >= 70 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{unitKpi.avgScore}%</span>
                                            )}
                                            {unitKpi.total > 0 && (
                                                <span className="text-[9px] font-bold text-slate-400"><CheckCircle2 size={9} className="inline text-emerald-500 mr-0.5" />{unitKpi.completed}/{unitKpi.total}</span>
                                            )}
                                            {unitKpi.nearestDue && unitKpi.overdueDays > 0 && (
                                                <span className="text-[9px] font-black text-rose-500">{unitKpi.overdueDays}d overdue</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden sm:flex items-center gap-3">
                                    {unitKpi.avgScore !== null && (
                                        <div className="hidden md:flex flex-col items-center" title={`Avg compliance score: ${unitKpi.avgScore}%`}>
                                            <div className={`w-11 h-11 rounded-full border-[3px] flex items-center justify-center ${unitKpi.avgScore >= 85 ? 'border-emerald-500 text-emerald-600' : unitKpi.avgScore >= 70 ? 'border-amber-500 text-amber-600' : 'border-rose-500 text-rose-600'}`}>
                                                <span className="text-[10px] font-black">{unitKpi.avgScore}%</span>
                                            </div>
                                        </div>
                                    )}
                                    {unitKpi.nearestDue && (
                                        <div className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase ${unitKpi.overdueDays > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`} title={unitKpi.overdueDays > 0 ? `Overdue by ${unitKpi.overdueDays} days` : `Next due: ${unitKpi.nearestDue}`}>
                                            <Clock size={10} />
                                            {unitKpi.overdueDays > 0 ? `${unitKpi.overdueDays}d overdue` : new Date(unitKpi.nearestDue + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </div>
                                    )}
                                    {unitKpi.lastCompletedDate && (
                                        <div className="hidden lg:flex items-center gap-1 text-[9px] font-bold text-slate-400" title={`Last audited: ${unitKpi.lastCompletedDate}`}>
                                            <History size={10} className="text-slate-300" />
                                            {new Date(unitKpi.lastCompletedDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </div>
                                    )}
                                    {unitKpi.total > 0 && (
                                        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black text-slate-500" title={`${unitKpi.completed} of ${unitKpi.total} audits completed`}>
                                            <CheckCircle2 size={10} className="text-emerald-500" />
                                            {unitKpi.completed}/{unitKpi.total}
                                        </div>
                                    )}
                                    <div className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase border ${unitKpi.risk === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' : unitKpi.risk === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                        <CircleDot className="w-2.5 h-2.5 sm:w-[10px] sm:h-[10px]" />
                                        <span className="hidden sm:inline">{unitKpi.risk}</span>
                                    </div>
                                    <div className={`p-1.5 sm:p-2 rounded-lg ${unit.isExpanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
                                        {unit.isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                                    </div>
                                </div>
                            </div>

                            {unit.isExpanded && (
                                <div className="p-4 sm:p-6 md:p-8 bg-slate-50/50 border-t border-slate-200 space-y-6 sm:space-y-10">

                                    {directAssignChecklists.length > 0 && (
                                        <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between px-1 sm:px-2">
                                                <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] flex items-center gap-1.5 sm:gap-2">
                                                    <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-600" /> Direct Assignment
                                                    <span className="text-[8px] sm:text-[9px] bg-violet-100 text-violet-700 font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-violet-200">{directAssignChecklists.length}</span>
                                                </h4>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                                                {directAssignChecklists.map(cl => (
                                                    <div key={cl.id} className="bg-white rounded-xl sm:rounded-2xl border-2 border-violet-100 p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-violet-300 hover:shadow-md transition-all group active:bg-violet-50/30">
                                                        <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-violet-50 text-violet-600 shrink-0 group-hover:bg-violet-100 transition-colors">
                                                            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[10px] sm:text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{cl.title}</p>
                                                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                                                <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-1 sm:px-1.5 py-0.5 rounded">{cl.department}</span>
                                                                <span className="text-[7px] sm:text-[8px] font-bold text-blue-500 uppercase bg-blue-50 px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5"><Clock size={7} className="sm:w-2 sm:h-2" /> {cl.frequency}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => { if (onDirectAssign) onDirectAssign(cl); }}
                                                            className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-violet-600 text-white rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-wider hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 active:scale-95 shrink-0 flex items-center gap-1 sm:gap-1.5"
                                                        >
                                                            <Send className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Assign
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* MANDATORY COMPLIANCE PILLAR MATRIX */}
                                    <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 sm:px-2">
                                            <h4 className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] flex items-center gap-1.5 sm:gap-2">
                                                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" /> Compliance Pillars
                                            </h4>
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                {hasOverduePillar && (
                                                    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[8px] sm:text-[9px] font-black uppercase animate-pulse">
                                                        <AlertTriangle className="w-2.5 h-2.5 sm:w-[10px] sm:h-[10px]" /> Critical Gap
                                                    </div>
                                                )}
                                                <button 
                                                    onClick={() => {
                                                        setActiveUnitId(unit.unitId);
                                                        setProtocolForm({ name: '', frequency: 'Monthly', level: 'UNIT', entityId: unit.unitId, effectiveDate: new Date().toISOString().split('T')[0] });
                                                        setModalMode('ADD_PROTOCOL');
                                                    }}
                                                    className="px-2.5 sm:px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-[8px] sm:text-[9px] font-black uppercase hover:text-indigo-600 hover:border-indigo-200 transition-all active:bg-indigo-50"
                                                >
                                                    + Add Mandate
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                                            {unitPillars.map((pillar, pidx) => (
                                                <div key={pillar.id || pidx} className={`bg-white p-5 rounded-3xl border-2 transition-all flex flex-col justify-between h-[185px] group hover:shadow-lg ${pillar.status === 'Overdue' ? 'border-rose-400 shadow-rose-50' : 'border-slate-100 shadow-sm'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2.5 rounded-xl border transition-all group-hover:scale-110 duration-300 ${getPillarColor(pillar.status)}`}>
                                                                <PillarIcon label={pillar.label} size={20} strokeWidth={2.5} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border w-fit ${pillar.level === 'CORPORATE' ? 'bg-indigo-600 text-white border-indigo-600' : pillar.level === 'REGIONAL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-900 text-white border-slate-900'}`}>
                                                                    {pillar.level}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border shadow-xs ${getPillarColor(pillar.status)}`}>
                                                            {pillar.status}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="mt-3">
                                                        <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">{pillar.label}</h5>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Freq: {pillar.frequency}</p>
                                                        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg w-fit">
                                                            <CalendarClock size={10} className="text-indigo-500" />
                                                            <span className="text-[8px] font-black text-slate-500 uppercase">Effective: {pillar.effectiveDate}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-end">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">Last Conducted</span>
                                                            <span className={`text-[10px] font-black font-mono leading-none ${pillar.status === 'Overdue' ? 'text-rose-600' : 'text-slate-600'}`}>{pillar.lastDate}</span>
                                                        </div>
                                                        {canScheduleForProtocol(pillar.level) ? (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleInitiateCycleFromPillar(unit.unitId, pillar); }}
                                                                className={`p-2 rounded-lg transition-all ${pillar.status === 'Overdue' ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                                                title={`Schedule ${pillar.label} Cycle`}
                                                            >
                                                                {pillar.status === 'Overdue' ? <AlertCircle size={14} strokeWidth={3} /> : <CalendarRange size={14} strokeWidth={3} />}
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[7px] font-bold uppercase border border-slate-100" title="Scheduled at unit level only">
                                                                <Eye size={12} className="inline mr-1" />View Only
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* DYNAMIC AUDIT PERIODS WITH TABS GROUPED BY AUDIT TYPE */}
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <CalendarRange size={14} className="text-indigo-600" /> Operational Audit Cycles
                                            </h4>
                                            
                                            {/* Audit Type Tab Bar */}
                                            <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto hide-scrollbar">
                                                {unitPillars.map(pillar => (
                                                    <button
                                                        key={pillar.id}
                                                        onClick={() => handleTabChange(unit.unitId, pillar.id)}
                                                        className={`
                                                            px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2
                                                            ${activeTabId === pillar.id 
                                                                ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
                                                                : 'text-slate-400 hover:text-slate-600'}
                                                        `}
                                                    >
                                                        <PillarIcon label={pillar.label} size={12} strokeWidth={3} />
                                                        {pillar.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            {activePeriods.length > 0 ? activePeriods.map((period) => (
                                                <div key={period.id} className="rounded-[2.5rem] border bg-white border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-slate-50 gap-4">
                                                        <div className="flex items-center gap-5 w-full md:w-auto">
                                                            <div className={`p-4 rounded-2xl shadow-inner ${period.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                                <Clock size={24} />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">{period.frequency} cycle Instance</h4>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${period.status === 'PUBLISHED' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                                        {period.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                                    Audit Window: {period.startDate} <span className="text-slate-300">→</span> {period.endDate}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setEditingCycleNotes(editingCycleNotes === period.id ? null : period.id); }}
                                                                className={`p-3 rounded-xl transition-all relative ${editingCycleNotes === period.id ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                                                                title="Cycle Notes"
                                                            >
                                                                <StickyNote size={18} />
                                                                {period.notes && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />}
                                                            </button>
                                                            {period.status === 'DRAFT' && !isReadOnlyPeriod(period) && (
                                                                <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); openEditPeriod(unit.unitId, period); }}
                                                                    className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                                                    title="Edit Cycle"
                                                                >
                                                                    <Pencil size={18} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeletePeriod(unit.unitId, period.id); }}
                                                                    className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                                    title="Delete Cycle"
                                                                >
                                                                    <Trash2 size={18} />
                                                                </button>
                                                                </>
                                                            )}
                                                            {isReadOnlyPeriod(period) ? (
                                                                <span className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-[9px] font-bold uppercase border border-slate-100 flex items-center gap-1.5">
                                                                    <Eye size={14} /> Status View
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => togglePeriodLock(unit.unitId, period.id)} className={`p-3 rounded-xl transition-all shadow-sm ${period.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`} title={period.status === 'PUBLISHED' ? 'Unlock to Edit' : 'Publish & Lock'}>
                                                                        {period.status === 'PUBLISHED' ? <Lock size={18}/> : <Unlock size={18}/>}
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => openAuditModal(unit.unitId, period.id)} 
                                                                        className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                                                                    >
                                                                        <Plus size={16} strokeWidth={3} /> Add Entry
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button 
                                                                onClick={() => togglePeriodExpand(unit.unitId, period.id)} 
                                                                className={`p-3 rounded-xl border transition-all ${period.isExpanded ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-white text-slate-400 border-slate-200'}`}
                                                            >
                                                                {period.isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {editingCycleNotes === period.id && (
                                                        <div className="px-6 py-4 bg-amber-50/50 border-b border-amber-100 animate-in slide-in-from-top-2 duration-200">
                                                            <div className="flex items-start gap-3">
                                                                <StickyNote size={16} className="text-amber-500 mt-1 shrink-0" />
                                                                {period.status === 'DRAFT' ? (
                                                                    <textarea
                                                                        className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-amber-400 resize-none placeholder:text-slate-300"
                                                                        rows={2}
                                                                        placeholder="Add notes for this cycle..."
                                                                        value={period.notes || ''}
                                                                        onChange={(e) => updateCycleNotes(unit.unitId, period.id, e.target.value)}
                                                                    />
                                                                ) : (
                                                                    <p className="text-xs text-slate-600 italic flex-1">{period.notes || 'No notes added.'}</p>
                                                                )}
                                                                <button onClick={() => setEditingCycleNotes(null)} className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><X size={14} /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {period.isExpanded && (
                                                        <div className="p-6 space-y-4 bg-slate-50/20">
                                                            {period.audits.length > 0 ? period.audits.map((audit) => (
                                                                <div key={audit.id} className={`bg-white rounded-3xl p-6 border shadow-sm flex flex-col md:flex-row items-center justify-between group relative overflow-hidden transition-all hover:border-indigo-300 hover:shadow-lg ${audit.priority === 'High' ? 'border-rose-200' : 'border-slate-200'}`}>
                                                                    <div className={`absolute left-0 top-0 bottom-0 transition-colors ${audit.priority === 'High' ? 'w-2 bg-rose-500' : audit.status === 'Completed' ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-indigo-500'}`} />
                                                                    
                                                                    <div className="flex-1 min-w-0 w-full md:w-auto">
                                                                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-xs ${audit.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                                                {audit.status}
                                                                            </span>
                                                                            {audit.priority && (
                                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border flex items-center gap-1 ${audit.priority === 'High' ? 'bg-rose-50 text-rose-600 border-rose-100' : audit.priority === 'Low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                                                    <Flag size={9} /> {audit.priority}
                                                                                </span>
                                                                            )}
                                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                                                                <Calendar size={12} className="text-indigo-400" />
                                                                                <span>{audit.startDate}</span>
                                                                            </div>
                                                                            {audit.createdAt && (
                                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300" title={`Created: ${new Date(audit.createdAt).toLocaleString()}`}>
                                                                                    <Clock size={10} className="text-slate-300" />
                                                                                    <span>Created {new Date(audit.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                                </div>
                                                                            )}
                                                                            {audit.isUnannounced && (
                                                                                <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[8px] font-black uppercase flex items-center gap-1 animate-pulse">
                                                                                    <Zap size={10} fill="currentColor" /> Unannounced
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <h4 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none mb-1 group-hover:text-indigo-600 transition-colors">{audit.checklist}</h4>
                                                                        {(audit.reviewer || audit.reviewRequired === false) && (
                                                                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                                                                {audit.reviewer && (
                                                                                    <span className="px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 rounded text-[8px] font-black uppercase flex items-center gap-1">
                                                                                        <Eye size={9} /> Reviewer: {audit.reviewer}
                                                                                    </span>
                                                                                )}
                                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 border ${audit.reviewRequired === false ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                                                    {audit.reviewRequired === false ? 'Final on Submit' : 'Review Required'}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {audit.locationAssignments && audit.locationAssignments.length > 0 ? (
                                                                            <div className="space-y-1.5 mt-1">
                                                                                {audit.locationAssignments.map(la => (
                                                                                    <div key={la.locationName} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">
                                                                                        <MapPin size={11} className="text-indigo-400 shrink-0" />
                                                                                        <span className="text-[9px] font-black text-slate-700 uppercase truncate min-w-[60px]">{la.locationName}</span>
                                                                                        <ChevronRight size={10} className="text-slate-300 shrink-0" />
                                                                                        <div className="flex items-center gap-1 flex-wrap flex-1">
                                                                                            {la.assignedAuditors.map(a => (
                                                                                                <span key={a} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-bold rounded border border-indigo-100 flex items-center gap-1">
                                                                                                    <Users size={8} />{a}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {audit.departments.map(d => (
                                                                                    <span key={d} className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase rounded-lg border border-slate-200">{d}</span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    <div className="flex items-center gap-8 w-full md:w-auto mt-6 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-8">
                                                                        {audit.status === 'Completed' ? (
                                                                            <div className="flex flex-col items-center md:items-end w-full md:w-auto gap-3">
                                                                                <div className={`flex items-baseline gap-2 ${audit.score && audit.score < 75 ? 'animate-bounce' : ''}`}>
                                                                                    <span className={`text-3xl font-black tracking-tighter ${audit.score && audit.score < 75 ? 'text-rose-500' : 'text-emerald-600'}`}>{audit.score}%</span>
                                                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Registry Sync</span>
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => openReport(audit)} 
                                                                                    className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95 group/btn ${audit.score && audit.score < 75 ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700' : 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'}`}
                                                                                >
                                                                                    <Eye size={16} className="transition-transform group-hover/btn:scale-110" /> 
                                                                                    <span>Review Evidence</span>
                                                                                </button>
                                                                                {!isReadOnlyPeriod(period) && <button onClick={() => openEditAuditModal(unit.unitId, period.id, audit)} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-indigo-100 transition-all text-[9px] font-black uppercase" title="Edit audit plan"><PenTool size={14}/> Edit Plan</button>}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
                                                                                <div className="flex -space-x-3 mb-1">
                                                                                    {audit.auditTeam.map((m, i) => (
                                                                                        <div key={i} className="w-10 h-10 rounded-full border-4 border-white bg-slate-900 text-white text-[10px] font-black flex items-center justify-center uppercase shadow-md" title={m}>
                                                                                            {m.charAt(0)}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                {!isReadOnlyPeriod(period) && (
                                                                                    <div className="flex gap-2">
                                                                                         <button onClick={() => openEditAuditModal(unit.unitId, period.id, audit)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl border border-transparent hover:border-indigo-100 transition-all" title="Edit audit plan"><PenTool size={18}/></button>
                                                                                         <button onClick={() => handleDeleteAudit(unit.unitId, period.id, audit.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-white rounded-xl border border-transparent hover:border-rose-100 transition-all" title="Delete audit"><Trash2 size={18}/></button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )) : (
                                                                <div className="p-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                                                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                                                        <History size={32} />
                                                                    </div>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active audits in this cycle</p>
                                                                    {!isReadOnlyPeriod(period) ? (
                                                                        <button 
                                                                            onClick={() => openAuditModal(unit.unitId, period.id)}
                                                                            className="mt-4 text-indigo-600 font-bold uppercase text-[9px] hover:underline"
                                                                        >
                                                                            + Initialize First Entry
                                                                        </button>
                                                                    ) : (
                                                                        <p className="mt-2 text-[9px] font-bold text-slate-300 uppercase">Audit scheduling is managed at unit level</p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {period.status === 'PUBLISHED' && period.audits.length > 0 && period.audits.every(a => a.status === 'Completed') && (
                                                                <div className={`${isReadOnlyPeriod(period) ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'} border rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-300`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2.5 rounded-xl ${isReadOnlyPeriod(period) ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                            {isReadOnlyPeriod(period) ? <CheckCircle2 size={18} /> : <RefreshCw size={18} />}
                                                                        </div>
                                                                        <div>
                                                                            <p className={`text-xs font-black uppercase tracking-tight ${isReadOnlyPeriod(period) ? 'text-emerald-800' : 'text-indigo-800'}`}>All audits completed</p>
                                                                            <p className={`text-[10px] font-bold ${isReadOnlyPeriod(period) ? 'text-emerald-500' : 'text-indigo-500'}`}>
                                                                                {isReadOnlyPeriod(period) ? 'Next cycle will be scheduled at unit level' : `Schedule next ${period.frequency.toLowerCase()} cycle?`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    {!isReadOnlyPeriod(period) && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const next = getNextCycleDates(period.endDate, period.frequency);
                                                                                setActiveUnitId(unit.unitId);
                                                                                setActiveTabs(prev => ({ ...prev, [unit.unitId]: period.protocolId }));
                                                                                setPeriodForm({ frequency: period.frequency, startDate: next.startDate, endDate: next.endDate });
                                                                                setModalMode('PERIOD');
                                                                            }}
                                                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95 shrink-0"
                                                                        >
                                                                            <CalendarRange size={14} /> Schedule Next Cycle
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )) : (
                                                <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 animate-in fade-in">
                                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-slate-50/50">
                                                        <PillarIcon label={activePillar?.label || 'General'} size={40} className="text-slate-200" />
                                                    </div>
                                                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">No {activePillar?.label} Records</h4>
                                                    <p className="text-slate-400 text-xs mt-2 font-medium uppercase tracking-widest max-w-sm leading-relaxed px-4">
                                                        The registry is currently empty for this audit type. Click the 'Schedule' button in the matrix above to initialize a new cycle.
                                                    </p>
                                                    {activePillar && canScheduleForProtocol(activePillar.level) ? (
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleInitiateCycleFromPillar(unit.unitId, activePillar as MandatoryPillar);
                                                            }} 
                                                            className="mt-8 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-3"
                                                        >
                                                            <Plus size={18} strokeWidth={3} /> Initialize {activePillar?.label} Cycle
                                                        </button>
                                                    ) : (
                                                        <p className="mt-4 text-[9px] font-bold text-slate-300 uppercase">Audit scheduling for this mandate is managed at unit level</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {false && (() => {
                                        const unitSchedules = scheduledAudits.filter(sa => sa.unitId === unit.unitId);
                                        const locStatusCfg = {
                                            'Scheduled':  { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
                                            'In Progress':{ bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-200',  dot: 'bg-blue-500'  },
                                            'Completed':  { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',dot:'bg-emerald-500'},
                                        } as const;
                                        const overallCfg = {
                                            'Scheduled':  'bg-slate-100 text-slate-600 border-slate-200',
                                            'In Progress':'bg-blue-50 text-blue-700 border-blue-200',
                                            'Completed':  'bg-emerald-50 text-emerald-700 border-emerald-200',
                                        } as const;
                                        return (
                                            <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                                                <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <Target size={14} className="text-teal-600" /> Cross-Location Audit Schedules
                                                        {unitSchedules.length > 0 && (
                                                            <span className="text-[9px] bg-teal-100 text-teal-700 font-bold px-2 py-0.5 rounded-full border border-teal-200">{unitSchedules.length}</span>
                                                        )}
                                                    </h4>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openScheduleModal(unit.unitId); }}
                                                        className="px-6 py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center gap-2 shadow-lg shadow-teal-200 active:scale-95"
                                                    >
                                                        <CalendarRange size={16} strokeWidth={3} /> Schedule Location Audit
                                                    </button>
                                                </div>

                                                {unitSchedules.length > 0 ? unitSchedules.map(sa => {
                                                    const completedCount = sa.locations.filter(l => l.status === 'Completed').length;
                                                    const allDone = allLocationsComplete(sa);
                                                    const pendingCount = sa.locations.length - completedCount;

                                                    return (
                                                        <div key={sa.id} className="rounded-[2.5rem] border bg-white border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="p-6 flex flex-col md:flex-row items-center justify-between border-b border-slate-100 gap-4">
                                                                <div className="flex items-center gap-5 w-full md:w-auto">
                                                                    <div className="p-4 rounded-2xl shadow-inner bg-teal-50 text-teal-600">
                                                                        <CalendarRange size={24} />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-3 flex-wrap">
                                                                            <h4 className="text-base font-black text-slate-800 uppercase tracking-tight truncate">{sa.checklistTitle}</h4>
                                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${overallCfg[sa.overallStatus]}`}>{sa.overallStatus}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                                                                            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                                                                                {sa.scheduledDate} <span className="text-slate-300">→</span> {sa.dueDate}
                                                                            </span>
                                                                            {sa.notes && <span className="text-[10px] text-slate-400 italic">"{sa.notes}"</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => setScheduledAudits(prev => prev.filter(s => s.id !== sa.id))}
                                                                    className="p-3 rounded-xl bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-white border border-transparent hover:border-rose-100 transition-all shrink-0">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>

                                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/20">
                                                                {sa.locations.map(loc => {
                                                                    const cfg = locStatusCfg[loc.status];
                                                                    return (
                                                                        <div key={loc.locationId} className={`bg-white rounded-3xl border-2 ${cfg.border} overflow-hidden transition-all hover:shadow-lg`}>
                                                                            <div className={`px-4 py-3 flex items-center justify-between ${cfg.bg}`}>
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{loc.locationName}</p>
                                                                                        {loc.department && <p className="text-[9px] text-slate-500 truncate">{loc.department}</p>}
                                                                                    </div>
                                                                                </div>
                                                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                                                    {loc.status}
                                                                                </span>
                                                                            </div>

                                                                            <div className="px-4 py-4 space-y-3">
                                                                                {loc.assignedTeam.length > 0 ? (
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {loc.assignedTeam.map((m, mi) => (
                                                                                            <span key={mi} title={m}
                                                                                                className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-[9px] font-black text-amber-700 cursor-default shadow-sm">
                                                                                                {getInitials(m)}
                                                                                            </span>
                                                                                        ))}
                                                                                        <span className="text-[9px] text-slate-400 self-center ml-1.5">
                                                                                            {loc.assignedTeam.length} auditor{loc.assignedTeam.length !== 1 ? 's' : ''}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <p className="text-[9px] text-slate-300 italic flex items-center gap-1"><Users size={10} /> No team assigned</p>
                                                                                )}

                                                                                {loc.completedAt && (
                                                                                    <p className="text-[9px] text-emerald-600 font-medium flex items-center gap-1">
                                                                                        <CheckCircle2 size={10} />
                                                                                        Completed {new Date(loc.completedAt).toLocaleDateString()}
                                                                                        {loc.score !== undefined && <span className="ml-1 font-black">— {loc.score}%</span>}
                                                                                    </p>
                                                                                )}

                                                                                <div className="flex gap-2 pt-1">
                                                                                    {(loc.status === 'Scheduled' || loc.status === 'In Progress') && (
                                                                                        <button onClick={() => handleBeginLocationAudit(sa.id, loc)}
                                                                                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors shadow-md">
                                                                                            <Play size={11} fill="currentColor" /> {loc.status === 'Scheduled' ? 'Begin Audit' : 'Continue'}
                                                                                        </button>
                                                                                    )}
                                                                                    {loc.status === 'In Progress' && (
                                                                                        <button onClick={() => setCompleteDialog({ auditId: sa.id, locationId: loc.locationId, score: '', notes: '' })}
                                                                                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-colors shadow-md">
                                                                                            <CheckCircle2 size={11} /> Mark Complete
                                                                                        </button>
                                                                                    )}
                                                                                    {loc.status === 'Completed' && (
                                                                                        <div className="flex-1 py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase flex items-center justify-center gap-1.5 border border-emerald-200">
                                                                                            <CheckCircle2 size={11} /> Audit Complete
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {sa.locations.map(l => (
                                                                            <div key={l.locationId} title={l.locationName}
                                                                                className={`w-2.5 h-2.5 rounded-full ${l.status === 'Completed' ? 'bg-emerald-500' : l.status === 'In Progress' ? 'bg-blue-400' : 'bg-slate-300'}`} />
                                                                        ))}
                                                                    </div>
                                                                    <span className="text-[11px] font-bold text-slate-600">
                                                                        {completedCount} / {sa.locations.length} location{sa.locations.length !== 1 ? 's' : ''} completed
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleExportUnitReport(sa)}
                                                                    disabled={!allDone}
                                                                    title={allDone ? 'Export consolidated unit report' : `Awaiting ${pendingCount} location${pendingCount !== 1 ? 's' : ''}`}
                                                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                                                                        allDone
                                                                            ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-200 active:scale-95'
                                                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    }`}>
                                                                    <Download size={14} />
                                                                    {allDone ? 'Export Unit Report' : `Awaiting ${pendingCount} location${pendingCount !== 1 ? 's' : ''}`}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="py-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                                                        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4 text-teal-300">
                                                            <MapPin size={32} />
                                                        </div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No cross-location audits scheduled for this unit</p>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openScheduleModal(unit.unitId); }}
                                                            className="mt-4 text-teal-600 font-bold uppercase text-[9px] hover:underline"
                                                        >
                                                            + Schedule First Location Audit
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {modalMode === 'PERIOD' && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black uppercase">{editingPeriodId ? 'Edit Cycle' : 'Schedule Cycle'}</h3><button onClick={() => { setEditingPeriodId(null); setModalMode(null); }}><X size={24}/></button></div>
                        <div className="space-y-4 text-left">
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Active Mandate</p>
                                <p className="text-sm font-black text-indigo-900 uppercase">
                                    {activeUnitId && activeTabs[activeUnitId] ? protocols.find(p => p.id === activeTabs[activeUnitId!])?.name : 'General'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Frequency</label>
                                <div className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                                    <span className="text-sm font-black text-slate-700 uppercase">{periodForm.frequency}</span>
                                    <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Fixed via Mandate Policy</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Start</label>
                                    <input type="date" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold" value={periodForm.startDate} onChange={e => {
                                        const newStart = e.target.value;
                                        setPeriodForm(prev => ({
                                            ...prev,
                                            startDate: newStart,
                                            endDate: prev.endDate && prev.endDate < newStart ? newStart : prev.endDate
                                        }));
                                    }} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">End</label>
                                    <input type="date" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold" value={periodForm.endDate} min={periodForm.startDate || undefined} onChange={e => setPeriodForm({...periodForm, endDate: e.target.value})} />
                                </div>
                            </div>
                            {periodForm.endDate && periodForm.startDate && periodForm.endDate < periodForm.startDate && (
                                <p className="text-[10px] font-bold text-rose-500 mt-1 ml-1">End date cannot be earlier than start date</p>
                            )}
                        </div>
                        <button onClick={handleAddPeriod} disabled={!!(periodForm.endDate && periodForm.startDate && periodForm.endDate < periodForm.startDate)} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-40 disabled:cursor-not-allowed">{editingPeriodId ? 'Update Cycle' : 'Create Cycle'}</button>
                    </div>
                </div>
            )}

            {modalMode === 'AUDIT' && (() => {
                const activePeriodData = getActivePeriod();
                const periodMin = activePeriodData?.startDate || '';
                const periodMax = activePeriodData?.endDate || '';
                return (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-lg animate-in zoom-in-95 max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black uppercase">{editingAuditId ? 'Edit Audit Plan' : 'Schedule Audit'}</h3><button onClick={() => { setEditingAuditId(null); setModalMode(null); }}><X size={24}/></button></div>
                        {periodMin && periodMax && (
                            <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                                <CalendarRange size={14} className="text-indigo-500 shrink-0" />
                                <p className="text-[10px] font-bold text-indigo-700">Cycle Window: <span className="font-black">{new Date(periodMin + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span> — <span className="font-black">{new Date(periodMax + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                            </div>
                        )}
                        <div className="space-y-4">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Checklist Template</label><select className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold" value={auditForm.checklist} onChange={e => {
                                const val = e.target.value;
                                const newAssignments = val ? buildLocationAssignments(val, 'department', activeUnitId) : [];
                                setAuditForm({...auditForm, checklist: val, departments: [], auditTeam: [], locationAssignments: newAssignments, deptLevels: {}, auditLevel: 'department'});
                            }}><option value="">Select...</option>{CHECKLISTS.map(c => <option key={c}>{c}</option>)}</select></div>

                            {auditForm.checklist && auditForm.locationAssignments.length > 0 && (() => {
                                const tmpl = checklistTemplates.find(t => t.title === auditForm.checklist);
                                if (!tmpl || tmpl.pages.length === 0) return null;
                                const unitLocs = activeUnitId ? getUnitDepartmentLocations(activeUnitId) : departmentLocations;

                                const deptGroups: { dept: string; hasLocations: boolean; assignments: { la: LocationAssignment; globalIdx: number }[] }[] = [];
                                tmpl.pages.forEach(p => {
                                    const deptLevel = auditForm.deptLevels[p.title] || 'department';
                                    const hasLocs = (unitLocs[p.title]?.length || 0) > 0;
                                    const matching = auditForm.locationAssignments
                                        .map((la, idx) => ({ la, globalIdx: idx }))
                                        .filter(({ la }) => {
                                            const base = la.locationName.includes(' › ') ? la.locationName.split(' › ')[0] : la.locationName;
                                            return base === p.title;
                                        });
                                    deptGroups.push({ dept: p.title, hasLocations: hasLocs, assignments: matching });
                                });

                                return (
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assign Auditors per Department</label>
                                        <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar">
                                            {deptGroups.map(group => {
                                                const deptLevel = auditForm.deptLevels[group.dept] || 'department';
                                                const isLocation = deptLevel === 'location';
                                                return (
                                                    <div key={group.dept} className={`border-2 rounded-2xl overflow-hidden ${isLocation ? 'border-teal-200' : 'border-slate-100'}`}>
                                                        <div className={`px-4 py-3 flex items-center justify-between ${isLocation ? 'bg-teal-50/50' : 'bg-slate-50/50'}`}>
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <Layers size={14} className={isLocation ? 'text-teal-500 shrink-0' : 'text-indigo-500 shrink-0'} />
                                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{group.dept}</span>
                                                                {group.assignments.filter(a => a.la.assignedAuditors.length > 0).length > 0 && (
                                                                    <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100 shrink-0">
                                                                        {group.assignments.filter(a => a.la.assignedAuditors.length > 0).length}/{group.assignments.length}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {isLocation && group.assignments.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const firstWithAuditors = group.assignments.find(a => a.la.assignedAuditors.length > 0);
                                                                            if (!firstWithAuditors) return;
                                                                            const updated = [...auditForm.locationAssignments];
                                                                            group.assignments.forEach(a => {
                                                                                updated[a.globalIdx] = { ...updated[a.globalIdx], assignedAuditors: [...firstWithAuditors.la.assignedAuditors] };
                                                                            });
                                                                            setAuditForm({...auditForm, locationAssignments: updated});
                                                                        }}
                                                                        className="px-2 py-1 bg-violet-50 text-violet-600 border border-violet-200 rounded-lg text-[7px] font-black uppercase tracking-wider hover:bg-violet-100 transition-all flex items-center gap-1"
                                                                        title={`Copy the first assigned team to all locations in ${group.dept}`}
                                                                    >
                                                                        <Copy size={9} /> Apply to All
                                                                    </button>
                                                                )}
                                                                {group.hasLocations && (
                                                                    <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newDeptLevels = { ...auditForm.deptLevels, [group.dept]: 'department' as const };
                                                                                const newAssignments = rebuildAssignmentsForDept(group.dept, 'department', auditForm.locationAssignments);
                                                                                setAuditForm({...auditForm, deptLevels: newDeptLevels, locationAssignments: newAssignments, auditLevel: Object.values(newDeptLevels).some(l => l === 'location') ? 'location' : 'department'});
                                                                            }}
                                                                            className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${!isLocation ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                        >
                                                                            <Layers size={9} /> Dept
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newDeptLevels = { ...auditForm.deptLevels, [group.dept]: 'location' as const };
                                                                                const newAssignments = rebuildAssignmentsForDept(group.dept, 'location', auditForm.locationAssignments);
                                                                                setAuditForm({...auditForm, deptLevels: newDeptLevels, locationAssignments: newAssignments, auditLevel: 'location'});
                                                                            }}
                                                                            className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${isLocation ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                        >
                                                                            <MapPin size={9} /> Loc
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 space-y-2">
                                                            {group.assignments.map(({ la, globalIdx }) => {
                                                                const isLocEntry = la.locationName.includes(' › ');
                                                                const locPart = isLocEntry ? la.locationName.split(' › ')[1] : '';
                                                                const locKey = `${group.dept}::${la.locationName}`;
                                                                const isExpanded = expandedLocEntries.has(locKey);
                                                                return (
                                                                    <div key={la.locationName} className={`rounded-xl p-2.5 ${isLocEntry ? 'bg-teal-50/40 border border-teal-100' : ''}`}>
                                                                        {isLocEntry && (
                                                                            <div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setExpandedLocEntries(prev => {
                                                                                        const next = new Set(prev);
                                                                                        next.has(locKey) ? next.delete(locKey) : next.add(locKey);
                                                                                        return next;
                                                                                    })}
                                                                                    className="w-full flex items-center gap-1.5 mb-1.5 group/loc"
                                                                                >
                                                                                    <ChevronRight size={10} className={`text-teal-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                                                    <MapPin size={10} className="text-teal-500 shrink-0" />
                                                                                    <span className="text-[10px] font-bold text-teal-700 truncate text-left">{locPart}</span>
                                                                                    {la.assignedAuditors.length > 0 && <span className="text-[8px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md ml-auto shrink-0">{la.assignedAuditors.length}</span>}
                                                                                </button>
                                                                                {isExpanded && (
                                                                                    <div className="ml-5 mb-2 flex items-center gap-1.5 bg-indigo-50/60 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                                                                                        <Layers size={10} className="text-indigo-500 shrink-0" />
                                                                                        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-tight">{group.dept}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        <MultiSelectDropdown
                                                                            options={AVAILABLE_AUDITORS}
                                                                            selected={la.assignedAuditors}
                                                                            onChange={(val: string[]) => {
                                                                                const updated = [...auditForm.locationAssignments];
                                                                                updated[globalIdx] = { ...updated[globalIdx], assignedAuditors: val };
                                                                                setAuditForm({...auditForm, locationAssignments: updated});
                                                                            }}
                                                                            placeholder="Assign auditor(s)..."
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {(() => {
                                            const totalAssigned = auditForm.locationAssignments.filter(la => la.assignedAuditors.length > 0).length;
                                            return <p className="text-[9px] font-bold text-slate-400 ml-1 mt-1">{totalAssigned} of {auditForm.locationAssignments.length} entries assigned</p>;
                                        })()}
                                    </div>
                                );
                            })()}

                            {auditForm.checklist && auditForm.locationAssignments.length === 0 && (
                                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-bold text-amber-700">No pages found in this checklist template. Use manual assignment below.</p>
                                </div>
                            )}

                            {auditForm.locationAssignments.length === 0 && (
                                <>
                                    <MultiSelectDropdown options={DEPARTMENTS} selected={auditForm.departments} onChange={(val: string[]) => setAuditForm({...auditForm, departments: val})} placeholder="Target Departments" />
                                    <MultiSelectDropdown options={AVAILABLE_AUDITORS} selected={auditForm.auditTeam} onChange={(val: string[]) => setAuditForm({...auditForm, auditTeam: val})} placeholder="Select Audit Team" />
                                </>
                            )}

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Priority Level</label>
                                <div className="flex bg-slate-50 p-1 rounded-2xl border-2 border-slate-100">
                                    {(['High', 'Medium', 'Low'] as const).map(lvl => (
                                        <button
                                            key={lvl}
                                            type="button"
                                            onClick={() => setAuditForm({...auditForm, priority: lvl})}
                                            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${auditForm.priority === lvl
                                                ? lvl === 'High' ? 'bg-rose-500 text-white shadow-md' : lvl === 'Low' ? 'bg-emerald-500 text-white shadow-md' : 'bg-amber-500 text-white shadow-md'
                                                : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                        >
                                            <Flag size={10} /> {lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Assigned Reviewer</label>
                                <select
                                    value={auditForm.reviewer}
                                    onChange={e => setAuditForm({...auditForm, reviewer: e.target.value})}
                                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold appearance-none"
                                >
                                    <option value="">No Reviewer (Auto-Complete)</option>
                                    {AVAILABLE_AUDITORS.filter(a => !auditForm.auditTeam.includes(a)).map(a => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                                <p className="text-[8px] text-slate-400 ml-1 mt-0.5">If assigned, completed audits go to reviewer before final release</p>
                                <div className="flex items-center gap-6 mt-3 ml-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="reviewRequired" checked={auditForm.reviewRequired === true} onChange={() => setAuditForm({...auditForm, reviewRequired: true})} className="accent-indigo-600" />
                                        <span className="text-[10px] font-bold text-slate-600">Review Required</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="reviewRequired" checked={auditForm.reviewRequired === false} onChange={() => setAuditForm({...auditForm, reviewRequired: false})} className="accent-indigo-600" />
                                        <span className="text-[10px] font-bold text-slate-600">No Review Required</span>
                                    </label>
                                </div>
                                <p className="text-[8px] ml-1 mt-1" style={{ color: auditForm.reviewRequired ? '#64748b' : '#16a34a' }}>
                                    {auditForm.reviewRequired ? 'Report will be submitted as Draft for reviewer approval' : 'Report will be finalized directly upon submission — no review step'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Audit Start</label><input type="date" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold" value={auditForm.startDate} min={periodMin} max={periodMax} onChange={e => setAuditForm({...auditForm, startDate: e.target.value})} /></div><div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Audit End</label><input type="date" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold" value={auditForm.endDate} min={periodMin || auditForm.startDate} max={periodMax} onChange={e => setAuditForm({...auditForm, endDate: e.target.value})} /></div></div>
                        </div>
                        <button onClick={handleAddAudit} className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">{editingAuditId ? 'Update Audit Plan' : 'Commit Schedule'}</button>
                    </div>
                </div>
                );
            })()}

            {modalMode === 'MANAGE_PROTOCOLS' && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95">
                        <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <Settings className="text-indigo-400" size={24} />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Mandate Configuration</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Define Hierarchical Mandatory Audits</p>
                                </div>
                            </div>
                            <button onClick={() => setModalMode(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={24}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
                            <div className="flex justify-between items-center mb-8">
                                <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Active System Mandates</h4>
                                <button 
                                    onClick={() => {
                                        const defaultLevel = currentScope === 'regional' ? 'REGIONAL' : currentScope === 'unit' ? 'UNIT' : 'CORPORATE';
                                        setProtocolForm({ name: '', frequency: 'Monthly', level: defaultLevel, entityId: userRootId || '', effectiveDate: new Date().toISOString().split('T')[0] });
                                        setModalMode('ADD_PROTOCOL');
                                    }}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                                >
                                    <Plus size={14} strokeWidth={3} /> Define New Mandate
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {getVisibleProtocols().map(p => {
                                    const editable = canEditProtocol(p);
                                    return (
                                    <div key={p.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm flex items-center justify-between group transition-all ${editable ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-100 opacity-80'}`}>
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${p.level === 'CORPORATE' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : p.level === 'REGIONAL' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                                {p.level === 'CORPORATE' ? <Globe size={20}/> : p.level === 'REGIONAL' ? <MapPin size={20}/> : <Building2 size={20}/>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-black text-slate-800 uppercase">{p.name}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${p.level === 'CORPORATE' ? 'bg-indigo-600 text-white border-indigo-600' : p.level === 'REGIONAL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-900 text-white border-slate-900'}`}>
                                                        {p.level}
                                                    </span>
                                                    {(() => {
                                                        const ent = entities.find(e => e.id === p.entityId);
                                                        return ent ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-slate-500 uppercase border border-slate-200 bg-slate-50">
                                                                {ent.name}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                    {!editable && (
                                                        <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-slate-400 uppercase border border-slate-200 bg-slate-50 flex items-center gap-0.5">
                                                            <Eye size={8} /> Read Only
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cycle: {p.frequency}</p>
                                                    <div className="w-px h-3 bg-slate-200" />
                                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1"><CalendarClock size={10}/> Start: {p.effectiveDate}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {editable && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openEditProtocol(p)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-indigo-600 rounded-xl transition-all" title="Edit mandate">
                                                    <PenTool size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteProtocol(p.id)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-rose-600 rounded-xl transition-all" title="Delete mandate">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-8 border-t bg-white flex justify-end">
                            <button onClick={() => setModalMode(null)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Close Dashboard</button>
                        </div>
                    </div>
                </div>
            )}

            {modalMode === 'ADD_PROTOCOL' && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-lg border border-slate-200 animate-in zoom-in-95">
                         <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">{editingProtocolId ? 'Edit Mandate' : 'Define Mandate'}</h3>
                            <button onClick={() => { setEditingProtocolId(null); setModalMode('MANAGE_PROTOCOLS'); }} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button>
                         </div>
                         <div className="space-y-6 text-left">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Protocol Authority Level</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                                    {getAllowedLevels().map(lvl => (
                                        <button 
                                            key={lvl}
                                            onClick={() => setProtocolForm({...protocolForm, level: lvl, entityId: userRootId || ''})}
                                            className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${protocolForm.level === lvl ? 'bg-white text-indigo-600 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apply To Entity</label>
                                <select
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 outline-none transition-all shadow-inner uppercase appearance-none"
                                    value={protocolForm.entityId}
                                    onChange={e => setProtocolForm({...protocolForm, entityId: e.target.value})}
                                >
                                    <option value="">Select Entity</option>
                                    {entities
                                        .filter(e => {
                                            const levelTypeMap: Record<string, string> = { CORPORATE: 'corporate', REGIONAL: 'regional', UNIT: 'unit' };
                                            const targetType = levelTypeMap[protocolForm.level];
                                            if (e.type !== targetType) return false;
                                            if (currentScope === 'super-admin') return true;
                                            if (!userRootId) return false;
                                            return e.id === userRootId || isDescendantOf(userRootId, e.id);
                                        })
                                        .map(e => {
                                            const parent = entities.find(p => p.id === e.parentId);
                                            const label = parent ? `${e.name} (${parent.name})` : e.name;
                                            return <option key={e.id} value={e.id}>{label}</option>;
                                        })
                                    }
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mandate Display Label</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-black focus:outline-none focus:border-indigo-500 outline-none transition-all shadow-inner uppercase"
                                    placeholder="e.g. INTERNAL FSMS"
                                    value={protocolForm.name}
                                    onChange={e => setProtocolForm({...protocolForm, name: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enforced Frequency</label>
                                    <select 
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase focus:border-indigo-500 outline-none shadow-sm cursor-pointer"
                                        value={protocolForm.frequency}
                                        onChange={e => setProtocolForm({...protocolForm, frequency: e.target.value})}
                                    >
                                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective From Date</label>
                                    <input 
                                        type="date"
                                        required
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold uppercase focus:border-indigo-500 outline-none shadow-sm cursor-pointer"
                                        value={protocolForm.effectiveDate}
                                        onChange={e => setProtocolForm({...protocolForm, effectiveDate: e.target.value})}
                                    />
                                </div>
                            </div>
                         </div>
                         <div className="flex gap-4 mt-10">
                            <button onClick={() => setModalMode('MANAGE_PROTOCOLS')} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all rounded-2xl hover:bg-slate-50">Cancel</button>
                            <button onClick={handleAddProtocol} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">Publish Mandate</button>
                         </div>
                    </div>
                </div>
            )}

            {modalMode === 'SCHEDULE_LOCATION' && schedulingUnitId && (
                <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
                    onClick={() => { setModalMode(null); setSchedulingUnitId(null); }}>
                    <div className="bg-white w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[88vh] border border-slate-200 overflow-hidden"
                        onClick={e => e.stopPropagation()}>

                        <div className="px-6 py-5 bg-gradient-to-r from-teal-600 to-emerald-600 flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                <CalendarRange size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Schedule Location Audit</h3>
                                <p className="text-[10px] text-teal-100 font-medium truncate">
                                    {units.find(u => u.unitId === schedulingUnitId)?.unitName || 'Unit'}
                                </p>
                            </div>
                            <button onClick={() => { setModalMode(null); setSchedulingUnitId(null); }} className="p-2 hover:bg-white/20 rounded-xl text-white/80 hover:text-white transition-colors shrink-0">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Checklist / Audit Type</label>
                                <select value={scheduleForm.checklist} onChange={e => setScheduleForm(f => ({ ...f, checklist: e.target.value }))}
                                    className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-teal-500 transition-all bg-slate-50">
                                    <option value="">Select checklist…</option>
                                    {CHECKLISTS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheduled Date <span className="text-red-500">*</span></label>
                                    <input type="date" value={scheduleForm.scheduledDate} onChange={e => setScheduleForm(f => ({ ...f, scheduledDate: e.target.value }))}
                                        className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-teal-500 transition-all bg-slate-50" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Due Date <span className="text-red-500">*</span></label>
                                    <input type="date" value={scheduleForm.dueDate} onChange={e => setScheduleForm(f => ({ ...f, dueDate: e.target.value }))}
                                        className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-teal-500 transition-all bg-slate-50" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (Optional)</label>
                                <input type="text" value={scheduleForm.notes} onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="Additional context or instructions…"
                                    className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm text-slate-700 outline-none focus:border-teal-500 transition-all bg-slate-50 placeholder:text-slate-300" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={14} className="text-teal-600" />
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Locations & Teams</span>
                                        <span className="text-[9px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded-full">
                                            {scheduleForm.locations.filter(l => l.locationName.trim()).length}
                                        </span>
                                    </div>
                                    <button onClick={addScheduleLocation}
                                        className="flex items-center gap-1.5 text-[10px] font-black text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-all">
                                        <Plus size={12} strokeWidth={3} /> Add Location
                                    </button>
                                </div>

                                {scheduleForm.locations.map((loc, idx) => (
                                    <div key={idx} className="bg-slate-50 border-2 border-slate-100 hover:border-teal-200 rounded-2xl p-4 space-y-3 transition-all">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">Location {idx + 1}</span>
                                            {scheduleForm.locations.length > 1 && (
                                                <button onClick={() => removeScheduleLocation(idx)} className="p-1 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-400 transition-colors">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">Location Name</label>
                                                <input type="text" list={`sched-locs-${idx}`} value={loc.locationName}
                                                    onChange={e => updateScheduleLocation(idx, 'locationName', e.target.value)}
                                                    placeholder="e.g. Main Kitchen"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-teal-500 bg-white transition-all" />
                                                <datalist id={`sched-locs-${idx}`}>
                                                    {DEPARTMENTS.map(d => <option key={d} value={d} />)}
                                                </datalist>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">Department</label>
                                                <input type="text" value={loc.department}
                                                    onChange={e => updateScheduleLocation(idx, 'department', e.target.value)}
                                                    placeholder="e.g. Food & Bev"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-teal-500 bg-white transition-all" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase">Assigned Team</label>
                                            <div className="flex gap-2">
                                                <input type="text" list={`sched-auditors-${idx}`} value={loc.teamInput}
                                                    onChange={e => updateScheduleLocation(idx, 'teamInput', e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScheduleTeamMember(idx); } }}
                                                    placeholder="Auditor name → Enter to add"
                                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-teal-500 bg-white transition-all" />
                                                <datalist id={`sched-auditors-${idx}`}>
                                                    {AVAILABLE_AUDITORS.map(a => <option key={a} value={a} />)}
                                                </datalist>
                                                <button onClick={() => addScheduleTeamMember(idx)}
                                                    className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors flex items-center gap-1">
                                                    <Plus size={12} strokeWidth={3} /> Add
                                                </button>
                                            </div>
                                            {loc.team.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {loc.team.map((m, mi) => (
                                                        <span key={mi} className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                                                            {m}
                                                            <button onClick={() => removeScheduleTeamMember(idx, mi)} className="text-amber-400 hover:text-amber-700 ml-0.5">
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
                            <button onClick={() => { setModalMode(null); setSchedulingUnitId(null); }} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleCreateSchedule}
                                disabled={!scheduleForm.scheduledDate || !scheduleForm.dueDate || !scheduleForm.locations.some(l => l.locationName.trim())}
                                className="flex-[2] py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-200">
                                <CalendarRange size={14} /> Create Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completeDialog && (
                <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={() => setCompleteDialog(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden animate-in zoom-in-95"
                        onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                                <CheckCircle2 size={18} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Complete Location Audit</h3>
                                <p className="text-[10px] text-emerald-100">Mark this location as audited</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score (Optional, 0–100)</label>
                                <input type="number" min="0" max="100" value={completeDialog.score}
                                    onChange={e => setCompleteDialog(d => d ? { ...d, score: e.target.value } : d)}
                                    placeholder="e.g. 92"
                                    className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 transition-all bg-slate-50" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completion Notes (Optional)</label>
                                <textarea value={completeDialog.notes} rows={3}
                                    onChange={e => setCompleteDialog(d => d ? { ...d, notes: e.target.value } : d)}
                                    placeholder="Any remarks or findings…"
                                    className="w-full px-3 py-2.5 border-2 border-slate-100 rounded-xl text-sm text-slate-700 outline-none focus:border-emerald-500 transition-all resize-none bg-slate-50 placeholder:text-slate-300" />
                            </div>
                        </div>
                        <div className="flex gap-3 px-5 pb-5">
                            <button onClick={() => setCompleteDialog(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleConfirmComplete}
                                className="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
                                <CheckCircle2 size={14} /> Confirm Complete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalMode === 'VIEW_REPORT' && selectedAudit && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200">
                        <div className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <div className={`p-3 rounded-2xl shadow-lg ${selectedAudit.score && selectedAudit.score < 75 ? 'bg-rose-50 shadow-rose-500/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}><FileText size={28} /></div>
                                <div><h3 className="text-xl font-black uppercase tracking-tight">Audit Findings Matrix</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registry Record #{selectedAudit.id}</p></div>
                            </div>
                            <button onClick={() => setModalMode(null)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={32}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-slate-50/30 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Final score</span>
                                    <span className={`text-4xl font-black ${selectedAudit.score && selectedAudit.score < 75 ? 'text-rose-500' : 'text-emerald-600'}`}>{selectedAudit.score}%</span>
                                    <span className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${selectedAudit.score && selectedAudit.score < 75 ? 'bg-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{selectedAudit.score && selectedAudit.score < 75 ? 'Grade D' : 'Grade A'}</span>
                                </div>
                                <div className="col-span-3 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Checklist</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedAudit.checklist}</p></div>
                                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Dates</p><p className="text-sm font-bold text-slate-700 uppercase">{selectedAudit.startDate} <span className="text-slate-300">to</span> {selectedAudit.endDate}</p></div>
                                    <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p><p className="text-sm font-black text-emerald-600 uppercase tracking-widest">{selectedAudit.status}</p></div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-1 flex items-center gap-2">
                                    <Target size={14} className="text-rose-500" /> Observation Registry
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex gap-5">
                                         <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 font-black shrink-0">01</div>
                                         <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2"><span className="text-xs font-black text-slate-700 uppercase tracking-tight">Compliance Point: 8.2.4</span><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-100 rounded text-[8px] font-black uppercase tracking-widest">Compliant</span></div>
                                            <p className="text-xs text-slate-500 leading-relaxed italic">"All CCP targets verified. Digital logs synchronized without deviation."</p>
                                         </div>
                                    </div>
                                    {selectedAudit.score && selectedAudit.score < 75 && (
                                      <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm flex gap-5 bg-rose-50/30">
                                         <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-100 flex items-center justify-center text-rose-500 font-black shrink-0">02</div>
                                         <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2"><span className="text-xs font-black text-rose-800 uppercase tracking-tight">Critical Violation: 8.5.2</span><span className="px-2 py-0.5 bg-rose-100 text-rose-700 border-rose-200 rounded text-[8px] font-black uppercase tracking-widest">Major NC</span></div>
                                            <p className="text-xs text-rose-600 leading-relaxed italic">"Failure to maintain temperature trail during peak load. Immediate corrective action required."</p>
                                         </div>
                                      </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><User size={16}/></div>
                                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lead Auditor Attestation</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{selectedAudit.auditTeam.join(', ')}</p></div>
                                    </div>
                                    <div className="w-full h-24 bg-white rounded-3xl border border-slate-200 p-2 flex items-center justify-center shadow-inner overflow-hidden">
                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=" alt="sign" className="max-h-full object-contain mix-blend-multiply opacity-80" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg"><PenTool size={16}/></div>
                                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Management Acknowledgement</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">Verified by Unit HOD</p></div>
                                    </div>
                                    <div className="w-full h-24 bg-white rounded-3xl border border-slate-200 p-2 flex items-center justify-center shadow-inner overflow-hidden">
                                        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=" alt="sign" className="max-h-full object-contain mix-blend-multiply opacity-80" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-10 py-8 bg-slate-900 border-t border-white/5 flex flex-col md:flex-row justify-between items-center shrink-0 pb-safe gap-4">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white/10 rounded-xl border border-white/10 shadow-inner"><Lock size={16} className="text-emerald-400" /></div>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-relaxed max-w-xs">Document integrity secured via Registry Protocol. ISO 22000 Tamper-evident vault active.</p>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                <button className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 hover:bg-indigo-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-3"><Download size={18} /> Download Registry Copy</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modalMode === 'PUBLISH_CONFIRM' && publishTarget && (() => {
                const auditorDetails = getPublishAuditorDetails(publishTarget.unitId, publishTarget.periodId);
                const targetUnit = units.find(u => u.unitId === publishTarget.unitId);
                const targetPeriod = targetUnit?.periods.find(p => p.id === publishTarget.periodId);
                return (
                    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-slate-200 animate-in zoom-in-95 overflow-hidden">
                            <div className="px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                                    <Mail size={24} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Publish & Notify Auditors</h3>
                                    <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-0.5">
                                        {targetUnit?.unitName} — {targetPeriod?.frequency} Cycle
                                    </p>
                                </div>
                            </div>

                            <div className="p-8 space-y-6 max-h-[55vh] overflow-y-auto">
                                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Send size={14} className="text-emerald-600" />
                                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Email Intimation Preview</p>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Publishing this cycle will send audit assignment intimations to <strong>{auditorDetails.length}</strong> auditor{auditorDetails.length !== 1 ? 's' : ''}. 
                                        Each auditor will receive details about their assigned audit, dates, and locations.
                                    </p>
                                </div>

                                {auditorDetails.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipients ({auditorDetails.length})</p>
                                        {auditorDetails.map((auditor, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black uppercase">
                                                        {auditor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{auditor.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold truncate">{auditor.audits.join(', ')}</p>
                                                    </div>
                                                    <Mail size={16} className="text-emerald-500 shrink-0" />
                                                </div>
                                                <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
                                                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
                                                        <Mail size={10} className="text-slate-400" />
                                                        <span>Email Preview</span>
                                                    </div>
                                                    <div className="border-l-2 border-indigo-300 pl-3 space-y-1">
                                                        <p className="text-[11px] font-black text-slate-700">Subject: Audit Assignment — {auditor.audits[0]}</p>
                                                        <p className="text-[10px] text-slate-500 leading-relaxed">
                                                            Dear {auditor.name.split(' ')[0]}, you have been assigned to conduct an audit for <strong>{auditor.audits.join(', ')}</strong> at <strong>{targetUnit?.unitName}</strong>.
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                                                                <Calendar size={8} /> {auditor.startDate} → {auditor.endDate}
                                                            </span>
                                                            {auditor.locations.length > 0 && (
                                                                <span className="text-[8px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100 flex items-center gap-1">
                                                                    <MapPin size={8} /> {auditor.locations.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-1">
                                                            Please navigate to <strong>My Audits</strong> tab to begin your audit. Contact your audit coordinator for any questions.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                                        <AlertTriangle size={20} className="text-amber-500 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-amber-700">No auditors assigned to pending audits in this cycle.</p>
                                        <p className="text-[10px] text-amber-500 mt-1">The cycle will be published without sending any email intimations.</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                                <button 
                                    onClick={() => { setModalMode(null); setPublishTarget(null); }}
                                    className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all rounded-2xl hover:bg-white border border-slate-200"
                                    disabled={emailSending}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={executePublishAndNotify}
                                    disabled={emailSending}
                                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {emailSending ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending Intimations...
                                        </>
                                    ) : (
                                        <>
                                            <SendHorizontal size={16} />
                                            Publish & Send Intimations
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default AuditSchedule;
