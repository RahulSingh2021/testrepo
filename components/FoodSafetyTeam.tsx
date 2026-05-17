"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  ChevronUp, 
  ChevronDown, 
  Mail, 
  Phone, 
  GraduationCap, 
  X, 
  Star, 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  AlertCircle, 
  Award, 
  Users, 
  Check, 
  FileBadge, 
  Info, 
  Save, 
  Edit3, 
  History, 
  Archive, 
  Download, 
  Search, 
  Filter, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  UserPlus,
  Trash2
} from 'lucide-react';
import { Entity, HierarchyScope, Employee } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Logo from './Logo';
import { renderToString } from 'react-dom/server';
import { savePdfForPWA } from '@/utils/pdfDownload';

// --- ISO 22000 Definitions ---
const ISO_TOOLTIPS = {
    fsmsRole: "The specific authority and responsibility assigned within the Food Safety Management System (e.g., FSTL, Internal Auditor) as per ISO 22000 Clause 5.3.",
    domain: "The specific area of technical or scientific knowledge (e.g., Microbiology, Engineering) this member contributes to the HACCP study.",
    appointment: "Formal documented evidence (Clause 5.3.2) assigning the FSMS responsibilities and authority to this individual.",
    assessment: "Evidence of competence (Clause 7.2). The date the member's food safety skills and training were last evaluated.",
    meeting: "Evidence of internal communication (Clause 7.4). Date of the last Food Safety Team meeting attended to review the system.",
    deputy: "The designated substitute authorized to perform these duties during absence to ensure FSMS continuity.",
    docControl: "Mandatory Document Control information (Clause 7.5.3) to ensure the team list is current, authorized, and identifiable."
};

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group/tooltip relative inline-flex items-center ml-1.5 align-middle cursor-help z-10">
    <Info size={12} className="text-slate-400 hover:text-indigo-500 transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-[10px] font-medium rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none shadow-xl text-center leading-relaxed">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);

interface Certificate {
    id: string;
    name: string;
    url: string;
    expiry?: string;
}

type HaccpTeamTag = 'Regional HACCP Team' | 'Corporate HACCP Team' | '';

interface TeamMember {
  id: string;
  unitId: string;
  name: string;
  designation: string;
  fsmsRole: string;
  isFSTL: boolean;
  department: string;
  domain: string;
  employmentType: 'Internal' | 'External';
  email: string;
  mobile: string;
  totalExperience: number;
  employeeId?: string;
  qualification: string;
  appointmentLetterUrl?: string;
  certificates: Certificate[];
  trainings: string[];
  lastCompetencyAssessmentDate?: string;
  lastMeetingAttended?: string;
  deputyId?: string;
  deputyName?: string;
  lastUpdated?: string;
  status: 'Active' | 'Archived';
  exitDate?: string;
  replacedBy?: string;
  _sourceEmployeeId?: string;
  haccpTeamTag?: HaccpTeamTag;
  additionalDepartments?: string[];
}

interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

interface FoodSafetyTeamProps {
  entities: Entity[];
  currentScope: HierarchyScope;
  userRootId?: string | null;
}

const DOMAINS = [
    "Quality Assurance & Microbiology",
    "Engineering & Utilities",
    "Production & Processing",
    "Supply Chain & Procurement",
    "Sanitation & Hygiene",
    "Regulatory Affairs"
];

const SKILL_MATRIX_COLS = ["HACCP L3", "Internal Audit", "VACCP/TACCP", "Allergen Mgmt", "Food Microbiology"];

const FS_ROLES = ['Food Safety Team Leader', 'Food Safety Team'];

const mapEmployeeToTeamMember = (emp: Employee, unitEntity: Entity | undefined): TeamMember => {
    const isFSTL = emp.Role?.trim().toLowerCase() === 'food safety team leader';
    const unitId = unitEntity?.id || '';
    return {
        id: `emp-${emp.id}`,
        unitId,
        name: emp.Name || 'Unknown',
        designation: emp.Role || '',
        fsmsRole: isFSTL ? 'Food Safety Team Leader (FSTL)' : 'Food Safety Team Member',
        isFSTL,
        department: emp.Department || 'General',
        domain: emp.Department || DOMAINS[0],
        employmentType: 'Internal',
        email: emp.Email || '',
        mobile: emp.Phone || '',
        totalExperience: 0,
        employeeId: emp.ID || '',
        qualification: '',
        certificates: [],
        trainings: [],
        lastUpdated: emp.lastUpdated,
        status: emp.Status === 'Active' ? 'Active' : 'Archived',
        _sourceEmployeeId: emp.id
    };
};

const DeptMultiSelect: React.FC<{
    memberId: string;
    allDepartments: string[];
    selected: string[];
    coreDept: string;
    onChange: (deps: string[]) => void;
}> = ({ memberId, allDepartments, selected, coreDept, onChange }) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const available = allDepartments.filter(d => d !== coreDept);
    const filtered = searchTerm.trim()
        ? available.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()))
        : available;

    const toggle = (dept: string) => {
        if (selected.includes(dept)) {
            onChange(selected.filter(d => d !== dept));
        } else {
            onChange([...selected, dept]);
        }
    };

    return (
        <div className="space-y-1.5">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((dept, i) => (
                        <span key={i} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                            {dept}
                            <button type="button" onClick={() => onChange(selected.filter((_, idx) => idx !== i))} className="text-sky-400 hover:text-rose-500"><X size={8} /></button>
                        </span>
                    ))}
                </div>
            )}
            <div className="relative" ref={dropdownRef}>
                <div
                    className="text-[9px] border border-slate-200 rounded px-2 py-1.5 w-full bg-white font-bold cursor-pointer flex items-center gap-1 hover:border-indigo-300 transition-colors"
                    onClick={() => setOpen(!open)}
                >
                    <Search size={10} className="text-slate-300 shrink-0" />
                    <input
                        type="text"
                        className="flex-1 outline-none bg-transparent text-[9px] font-bold"
                        placeholder="Search & select departments..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); if (!open) setOpen(true); }}
                        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                    />
                    <ChevronDown size={10} className={`text-slate-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
                {open && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-2 text-[9px] text-slate-400 italic">No departments found</div>
                        ) : (
                            filtered.map(dept => {
                                const isSelected = selected.includes(dept);
                                return (
                                    <button
                                        key={dept}
                                        type="button"
                                        onClick={() => toggle(dept)}
                                        className={`w-full text-left px-3 py-1.5 text-[9px] font-bold flex items-center gap-2 transition-colors ${isSelected ? 'bg-sky-50 text-sky-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-sky-600 border-sky-600' : 'border-slate-300'}`}>
                                            {isSelected && <Check size={8} className="text-white" />}
                                        </div>
                                        <span className="truncate uppercase tracking-wide">{dept}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const FoodSafetyTeam: React.FC<FoodSafetyTeamProps> = ({ entities, currentScope, userRootId }) => {
    const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
    const [showHistory, setShowHistory] = useState(false);
    const [matrixViewUnits, setMatrixViewUnits] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
    
    const [docControlData, setDocControlData] = useState<Record<string, DocControlInfo>>({
        'default': {
            docRef: 'FSMS-REC-005',
            version: '1.0',
            effectiveDate: new Date().toISOString().split('T')[0],
            approvedBy: 'Plant Manager'
        }
    });
    
    const [isDocControlModalOpen, setIsDocControlModalOpen] = useState(false);
    const [editingDocControlUnitId, setEditingDocControlUnitId] = useState<string | null>(null);
    const [tempDocControl, setTempDocControl] = useState<DocControlInfo>({ docRef: '', version: '', effectiveDate: '', approvedBy: '' });

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [manualOverrides, setManualOverrides] = useState<Record<string, Partial<TeamMember>>>({});
    const [crossUnitAssignments, setCrossUnitAssignments] = useState<Record<string, string[]>>({});
    const [assignToUnitsModal, setAssignToUnitsModal] = useState<{ member: TeamMember; selectedUnits: Set<string> } | null>(null);
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [addMemberForm, setAddMemberForm] = useState({
        name: '',
        designation: '',
        teamType: 'Internal' as 'Internal' | 'External',
        fsmsRole: 'Food Safety Team Member' as string,
        department: '',
        domain: DOMAINS[0],
        email: '',
        mobile: '',
        qualification: '',
        totalExperience: 0,
        unitId: '' as string
    });

    const resolveUnitForEmployee = useCallback((emp: Employee): Entity | undefined => {
        return entities.find(e => e.type === 'unit' && e.name?.trim() === emp.Unit?.trim());
    }, [entities]);

    const allDepartmentNames = useMemo(() => {
        const getDescendantIdsForDepts = (parentId: string): string[] => {
            const children = entities.filter(e => e.parentId === parentId);
            return children.flatMap(c => [c.id, ...getDescendantIdsForDepts(c.id)]);
        };
        let scopedEntityIds: Set<string>;
        if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
            scopedEntityIds = new Set([userRootId, ...getDescendantIdsForDepts(userRootId)]);
        } else if (currentScope === 'unit' && userRootId) {
            scopedEntityIds = new Set([userRootId, ...getDescendantIdsForDepts(userRootId)]);
        } else if (currentScope === 'department' && userRootId) {
            const dept = entities.find(e => e.id === userRootId);
            const parentUnit = dept?.parentId;
            scopedEntityIds = parentUnit ? new Set([parentUnit, ...getDescendantIdsForDepts(parentUnit)]) : new Set([userRootId]);
        } else {
            scopedEntityIds = new Set(entities.map(e => e.id));
        }
        const deptEntities = entities.filter(e => e.type === 'department' && e.name?.trim() && scopedEntityIds.has(e.id));
        const deptNames = new Set(deptEntities.map(e => e.name!.trim()));
        return Array.from(deptNames).sort();
    }, [entities, currentScope, userRootId]);

    const scopedUnitIds = useMemo(() => {
        const getDescendantIds = (parentId: string): string[] => {
            const children = entities.filter(e => e.parentId === parentId);
            return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
        };

        let scopedIds: Set<string>;
        if (currentScope === 'unit' && userRootId) {
            scopedIds = new Set(entities.filter(e => e.id === userRootId && e.type === 'unit').map(e => e.id));
        } else if (currentScope === 'department' && userRootId) {
            const dept = entities.find(e => e.id === userRootId);
            scopedIds = new Set(dept?.parentId ? entities.filter(e => e.id === dept.parentId && e.type === 'unit').map(e => e.id) : []);
        } else if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
            const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
            scopedIds = new Set(entities.filter(e => e.type === 'unit' && descendantIds.has(e.id)).map(e => e.id));
        } else {
            scopedIds = new Set(entities.filter(e => e.type === 'unit').map(e => e.id));
        }
        return scopedIds;
    }, [entities, currentScope, userRootId]);

    const scopedUnitNameMap = useMemo(() => {
        const map = new Map<string, string>();
        entities.filter(e => e.type === 'unit' && scopedUnitIds.has(e.id) && e.name?.trim()).forEach(e => {
            map.set(e.name!.trim().toLowerCase(), e.id);
        });
        return map;
    }, [entities, scopedUnitIds]);

    useEffect(() => {
        const loadEmployees = async () => {
            setIsLoadingEmployees(true);
            try {
                const res = await fetch('/api/users');
                if (!res.ok) throw new Error('Failed to load users');
                const data = await res.json();
                const allEmployees: Employee[] = data.items || [];

                const isScoped = scopedUnitIds.size > 0 && (currentScope === 'unit' || currentScope === 'department' || currentScope === 'regional' || currentScope === 'corporate');
                const fsEmployees = allEmployees.filter(emp => {
                    if (emp.Status !== 'Active') return false;
                    if (!FS_ROLES.some(r => emp.Role?.trim().toLowerCase() === r.toLowerCase())) return false;
                    if (isScoped) {
                        const empUnit = (emp.Unit || '').trim().toLowerCase();
                        if (!empUnit || !scopedUnitNameMap.has(empUnit)) return false;
                    }
                    return true;
                });

                const mapped = fsEmployees.map(emp => {
                    const unitEntity = resolveUnitForEmployee(emp);
                    const member = mapEmployeeToTeamMember(emp, unitEntity);
                    if (!member.unitId) {
                        member.unitId = '__unassigned__';
                    }
                    const overrides = manualOverrides[member.id];
                    if (overrides) {
                        return { ...member, ...overrides } as TeamMember;
                    }
                    return member;
                });

                setTeamMembers(prev => {
                    const manualMembers = prev.filter(m => !m.id.startsWith('emp-'));
                    const mergedIds = new Set(mapped.map(m => m.id));
                    const keptManual = manualMembers.filter(m => !mergedIds.has(m.id));
                    return [...mapped, ...keptManual];
                });
            } catch (err) {
                console.error('Failed to load food safety team data:', err);
            } finally {
                setIsLoadingEmployees(false);
            }
        };
        loadEmployees();
    }, [entities, resolveUnitForEmployee, scopedUnitIds, scopedUnitNameMap, currentScope]);

    useEffect(() => {
        const loadManualMembers = async () => {
            try {
                const res = await fetch('/api/fst-members');
                if (!res.ok) return;
                const data = await res.json();
                const allItems: any[] = data.items || [];
                const tagRecords = allItems.filter((item: any) => item._isTagRecord);
                const tagMap = new Map<string, HaccpTeamTag>();
                tagRecords.forEach((t: any) => {
                    if (t.tagSourceId && t.haccpTeamTag) tagMap.set(t.tagSourceId, t.haccpTeamTag as HaccpTeamTag);
                });
                const crossUnitRecords = allItems.filter((item: any) => item._isCrossUnitAssignment);
                const cuMap: Record<string, string[]> = {};
                crossUnitRecords.forEach((r: any) => {
                    if (r.sourceId && r.assignedUnitIds) cuMap[r.sourceId] = r.assignedUnitIds;
                });
                setCrossUnitAssignments(cuMap);
                const manualItems: TeamMember[] = allItems.filter((item: any) => {
                    if (item._isTagRecord) return false;
                    if (item._isCrossUnitAssignment) return false;
                    if (!item.unitId) return true;
                    return scopedUnitIds.has(item.unitId);
                });
                setTeamMembers(prev => {
                    const syncedMembers = prev.filter(m => m.id.startsWith('emp-')).map(m => {
                        const tag = tagMap.get(m.id);
                        return tag ? { ...m, haccpTeamTag: tag } : m;
                    });
                    const existingManualIds = new Set(manualItems.map(m => m.id));
                    const keptOtherManual = prev.filter(m => !m.id.startsWith('emp-') && !existingManualIds.has(m.id) && !m.id.startsWith('manual-'));
                    return [...syncedMembers, ...manualItems, ...keptOtherManual];
                });
            } catch (err) {
                console.error('Failed to load manual FST members:', err);
            }
        };
        loadManualMembers();
    }, [scopedUnitIds]);

    const handleAddMember = async () => {
        if (!addMemberForm.name.trim()) return;
        const unitId = addMemberForm.unitId || (filteredUnits.length > 0 ? filteredUnits.find(u => u.id !== '__unassigned__')?.id || '' : '');
        const newMember: TeamMember = {
            id: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            unitId,
            name: addMemberForm.name.trim(),
            designation: addMemberForm.designation.trim(),
            fsmsRole: addMemberForm.fsmsRole,
            isFSTL: addMemberForm.fsmsRole.toLowerCase().includes('leader'),
            department: addMemberForm.department.trim(),
            domain: addMemberForm.domain,
            employmentType: addMemberForm.teamType,
            email: addMemberForm.email.trim(),
            mobile: addMemberForm.mobile.trim(),
            totalExperience: addMemberForm.totalExperience,
            qualification: addMemberForm.qualification.trim(),
            certificates: [],
            trainings: [],
            status: 'Active'
        };

        setTeamMembers(prev => [...prev, newMember]);
        setIsAddMemberModalOpen(false);
        setAddMemberForm({ name: '', designation: '', teamType: 'Internal', fsmsRole: 'Food Safety Team Member', department: '', domain: DOMAINS[0], email: '', mobile: '', qualification: '', totalExperience: 0, unitId: '' });

        try {
            await fetch('/api/fst-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMember)
            });
        } catch (err) {
            console.error('Failed to persist manual FST member:', err);
        }
    };

    const handleDeleteManualMember = async (memberId: string) => {
        setTeamMembers(prev => prev.filter(m => m.id !== memberId));
        try {
            await fetch('/api/fst-members', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: [memberId] })
            });
        } catch (err) {
            console.error('Failed to delete manual FST member:', err);
        }
    };

    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
    const [inlineEditData, setInlineEditData] = useState<Partial<TeamMember>>({});

    const handleInlineEdit = (member: TeamMember) => {
        setInlineEditingId(member.id);
        setInlineEditData({ ...member });
    };

    const handleInlineSave = () => {
        if (!inlineEditingId) return;
        setTeamMembers(prev => prev.map(m => m.id === inlineEditingId ? { ...m, ...inlineEditData } as TeamMember : m));
        if (inlineEditingId.startsWith('emp-')) {
            setManualOverrides(prev => ({
                ...prev,
                [inlineEditingId]: {
                    ...(prev[inlineEditingId] || {}),
                    qualification: inlineEditData.qualification,
                    totalExperience: inlineEditData.totalExperience,
                    deputyName: inlineEditData.deputyName,
                    deputyId: inlineEditData.deputyId,
                    lastMeetingAttended: inlineEditData.lastMeetingAttended,
                    lastCompetencyAssessmentDate: inlineEditData.lastCompetencyAssessmentDate,
                    employmentType: inlineEditData.employmentType,
                    haccpTeamTag: inlineEditData.haccpTeamTag,
                    department: inlineEditData.department,
                    additionalDepartments: inlineEditData.additionalDepartments,
                }
            }));
        }
        if (inlineEditingId.startsWith('manual-')) {
            const updatedMember = teamMembers.find(m => m.id === inlineEditingId);
            if (updatedMember) {
                const merged = { ...updatedMember, ...inlineEditData };
                fetch('/api/fst-members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(merged)
                }).catch(err => console.error('Failed to persist manual FST member edit:', err));
            }
        }
        setInlineEditingId(null);
        setInlineEditData({});
    };

    const handleInlineCancel = () => {
        setInlineEditingId(null);
        setInlineEditData({});
    };

    const handleToggleHaccpTag = async (member: TeamMember, tag: HaccpTeamTag) => {
        const newTag = member.haccpTeamTag === tag ? '' : tag;
        setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, haccpTeamTag: newTag } : m));
        if (member.id.startsWith('emp-')) {
            setManualOverrides(prev => ({
                ...prev,
                [member.id]: { ...(prev[member.id] || {}), haccpTeamTag: newTag }
            }));
        }
        if (member.id.startsWith('manual-')) {
            try {
                await fetch('/api/fst-members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...member, haccpTeamTag: newTag })
                });
            } catch (err) {
                console.error('Failed to persist HACCP team tag:', err);
            }
        }
        try {
            await fetch('/api/fst-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: `tag-${member.id}`, tagSourceId: member.id, name: member.name, unitId: member.unitId, haccpTeamTag: newTag, status: 'Active', _isTagRecord: true })
            });
        } catch (err) {
            console.error('Failed to persist tag record:', err);
        }
    };

    const isUpperScope = currentScope === 'regional' || currentScope === 'corporate';
    const defaultTagForScope: HaccpTeamTag = currentScope === 'corporate' ? 'Corporate HACCP Team' : 'Regional HACCP Team';

    const openAssignToUnitsModal = (member: TeamMember) => {
        const existing = crossUnitAssignments[member.id] || [];
        const selected = new Set(existing);
        setAssignToUnitsModal({ member, selectedUnits: selected });
    };

    const handleSaveCrossUnitAssignment = async () => {
        if (!assignToUnitsModal) return;
        const { member, selectedUnits } = assignToUnitsModal;
        const unitIds = Array.from(selectedUnits);
        setCrossUnitAssignments(prev => ({ ...prev, [member.id]: unitIds }));
        setAssignToUnitsModal(null);
        try {
            await fetch('/api/fst-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `crossunit-${member.id}`,
                    sourceId: member.id,
                    name: member.name,
                    assignedUnitIds: unitIds,
                    _isCrossUnitAssignment: true,
                    status: 'Active'
                })
            });
        } catch (err) {
            console.error('Failed to persist cross-unit assignment:', err);
        }
    };

    const getCrossUnitMembersForUnit = useCallback((unitId: string): TeamMember[] => {
        const result: TeamMember[] = [];
        Object.entries(crossUnitAssignments).forEach(([sourceId, assignedUnits]) => {
            if (assignedUnits.includes(unitId)) {
                const source = teamMembers.find(m => m.id === sourceId);
                if (source && source.unitId !== unitId && source.status === 'Active') {
                    result.push({ ...source, unitId, id: `xunit-${source.id}-${unitId}`, _sourceEmployeeId: source._sourceEmployeeId || source.id } as TeamMember);
                }
            }
        });
        return result;
    }, [crossUnitAssignments, teamMembers]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedUnitIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedUnitIds(next);
    };

    const handleEditDocControl = (unitId: string) => {
        setEditingDocControlUnitId(unitId);
        const currentData = docControlData[unitId] || docControlData['default'];
        setTempDocControl({ ...currentData });
        setIsDocControlModalOpen(true);
    };

    const handleSaveDocControl = () => {
        if (editingDocControlUnitId) {
            setDocControlData(prev => ({
                ...prev,
                [editingDocControlUnitId]: tempDocControl
            }));
            setIsDocControlModalOpen(false);
            setEditingDocControlUnitId(null);
        }
    };

    const filteredUnits = useMemo(() => {
        let units: Entity[];
        if (currentScope === 'unit' && userRootId) {
            units = entities.filter(e => e.id === userRootId && e.type === 'unit');
        } else if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
            units = entities.filter(e => e.type === 'unit' && scopedUnitIds.has(e.id));
        } else if (currentScope === 'department' && userRootId) {
            units = entities.filter(e => e.type === 'unit' && scopedUnitIds.has(e.id));
        } else {
            units = entities.filter(e => e.type === 'unit');
        }
        const unitIdSet = new Set(units.map(u => u.id));
        const unassignedMembers = teamMembers.filter(m => m.status === 'Active' && m.unitId && !unitIdSet.has(m.unitId) && scopedUnitIds.has(m.unitId));
        if (unassignedMembers.length > 0) {
            const hasUnassigned = units.some(u => u.id === '__unassigned__');
            if (!hasUnassigned) {
                units = [...units, { id: '__unassigned__', name: 'Unassigned Members', type: 'unit', location: 'No unit mapped', parentId: '', industry: 'general' as any } as Entity];
            }
        }
        return units;
    }, [entities, currentScope, userRootId, teamMembers, scopedUnitIds]);

    const isCertExpired = (dateStr?: string) => dateStr ? new Date(dateStr) < new Date() : false;

    const globalStats = useMemo(() => {
        const totalUnits = filteredUnits.length;
        const assignedFSTLCount = filteredUnits.filter(u => 
            teamMembers.some(m => m.unitId === u.id && m.status === 'Active' && m.isFSTL)
        ).length;
        
        const activeMembers = teamMembers.filter(m => m.status === 'Active');
        const compliantCount = activeMembers.filter(m => {
            const hasExpiredCerts = m.certificates.some(c => isCertExpired(c.expiry));
            const assessmentDue = !m.lastCompetencyAssessmentDate || (new Date().getTime() - new Date(m.lastCompetencyAssessmentDate).getTime() > 365 * 24 * 60 * 60 * 1000);
            return !hasExpiredCerts && !assessmentDue;
        }).length;

        return {
            fstlAssignedCount: assignedFSTLCount,
            fstlMissingCount: Math.max(0, totalUnits - assignedFSTLCount),
            compliantTeamCount: compliantCount,
            nonCompliantTeamCount: activeMembers.length - compliantCount
        };
    }, [filteredUnits, teamMembers]);

    // --- ISO 22000 PDF EXPORT RE-IMPLEMENTATION (PROFESSIONAL CONTROLLED FORMAT) ---
    const handleExportPDF = async (targetUnitId?: string) => {
        setIsGeneratingPDF(true);
        const securityId = `CERT-FST-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        const printArea = document.createElement('div');
        printArea.style.position = 'fixed';
        printArea.style.top = '-9999px';
        printArea.style.left = '0';
        printArea.style.width = '1000px'; 
        printArea.style.backgroundColor = 'white';
        printArea.style.padding = '0';
        printArea.style.fontFamily = 'Arial, Helvetica, sans-serif';
        printArea.style.color = '#1e293b';

        const unitsToExport = targetUnitId ? filteredUnits.filter(u => u.id === targetUnitId) : filteredUnits;
        const now = new Date();
        const downloadTimestamp = now.toLocaleString();

        let htmlContent = '';

        unitsToExport.forEach((unit, unitIdx) => {
            const members = teamMembers.filter(m => m.unitId === unit.id && m.status === 'Active');
            if (members.length === 0) return;

            const docInfo = docControlData[unit.id] || docControlData['default'];
            const fstl = members.find(m => m.isFSTL);

            // Calculate competency coverage for this unit
            const domainCoverage = DOMAINS.map(d => ({
                name: d,
                covered: members.some(m => m.domain === d)
            }));

            htmlContent += `
                <div style="padding: 50px; page-break-after: always; min-height: 1400px; display: flex; flex-direction: column; position: relative; background: #fff;">
                    
                    <!-- WATERMARK (ISO COMPLIANCE) -->
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 100px; font-weight: 900; color: rgba(226, 232, 240, 0.4); pointer-events: none; text-transform: uppercase; z-index: 0; white-space: nowrap;">Controlled Record</div>

                    <!-- CONTROLLED HEADER (ISO 7.5.2) -->
                    <div style="border: 2px solid #1e293b; margin-bottom: 25px; position: relative; z-index: 10; background: #fff;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="width: 20%; padding: 15px; border-right: 2px solid #1e293b; text-align: center;">
                                    <div style="width: 70px; height: 70px; margin: 0 auto;">
                                        ${renderToString(<Logo className="w-16 h-16" />)}
                                    </div>
                                </td>
                                <td style="width: 50%; padding: 15px; border-right: 2px solid #1e293b;">
                                    <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; color: #0f172a;">${entities.find(e => e.type === 'corporate')?.name || 'HACCP PRO SYSTEMS'}</div>
                                    <div style="font-size: 14px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Food Safety Team Registry (ISO 22:2018)</div>
                                    <div style="font-size: 11px; margin-top: 8px; font-weight: 600; color: #64748b;">Unit Node: ${unit.name} | Location: ${unit.location}</div>
                                </td>
                                <td style="width: 30%; padding: 0;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-weight: 700;">
                                        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; background: #f8fafc; color: #64748b;">Doc Ref:</td><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b;">${docInfo.docRef}</td></tr>
                                        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; background: #f8fafc; color: #64748b;">Revision:</td><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b;">v${docInfo.version}</td></tr>
                                        <tr><td style="padding: 6px 12px; background: #f8fafc; color: #64748b;">Effective:</td><td style="padding: 6px 12px;">${docInfo.effectiveDate}</td></tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <!-- EXECUTIVE SUMMARY OF COMPETENCE (ISO 7.2) -->
                    <div style="margin-bottom: 30px; position: relative; z-index: 10;">
                        <h4 style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #475569; margin-bottom: 10px; border-left: 4px solid #4f46e5; padding-left: 10px;">Executive Summary: Resource Competency Coverage</h4>
                        <div style="display: grid; grid-template-cols: repeat(3, 1fr); gap: 10px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                            ${domainCoverage.map(d => `
                                <div style="display: flex; align-items: center; gap: 8px; font-size: 9px; font-weight: 700;">
                                    <div style="width: 12px; height: 12px; border-radius: 3px; background: ${d.covered ? '#10b981' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; color: white;">${d.covered ? '✓' : ''}</div>
                                    <span style="color: ${d.covered ? '#0f172a' : '#94a3b8'};">${d.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- TEAM REGISTER -->
                    <div style="flex: 1; position: relative; z-index: 10;">
                        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                            <thead>
                                <tr style="background: #1e293b; color: white; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;">
                                    <th style="padding: 15px; text-align: left; border-right: 1px solid rgba(255,255,255,0.1);">Team Member</th>
                                    <th style="padding: 15px; text-align: left; border-right: 1px solid rgba(255,255,255,0.1);">FSMS Authority (Clause 5.3)</th>
                                    <th style="padding: 15px; text-align: left; border-right: 1px solid rgba(255,255,255,0.1);">Knowledge Domain</th>
                                    <th style="padding: 15px; text-align: left; border-right: 1px solid rgba(255,255,255,0.1);">Competency Evidence</th>
                                    <th style="padding: 15px; text-align: left;">Assigned Deputy</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${members.map(m => `
                                    <tr style="font-size: 10px; border-bottom: 1px solid #e2e8f0; background: #fff;">
                                        <td style="padding: 15px; border-right: 1px solid #e2e8f0;">
                                            <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${m.name} ${m.isFSTL ? '<span style="color: #f59e0b; margin-left: 4px;">★</span>' : ''}</div>
                                            <div style="font-size: 8px; color: #64748b; margin-top: 4px; text-transform: uppercase; font-weight: 700;">${m.designation} (${m.department})</div>
                                            <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">Exp: ${m.totalExperience} Yrs</div>
                                        </td>
                                        <td style="padding: 15px; border-right: 1px solid #e2e8f0; font-weight: 800; color: #4f46e5;">${m.fsmsRole}</td>
                                        <td style="padding: 15px; border-right: 1px solid #e2e8f0;">
                                            <div style="font-weight: 700; color: #334155;">${m.domain}</div>
                                        </td>
                                        <td style="padding: 15px; border-right: 1px solid #e2e8f0;">
                                            <div style="font-weight: 700; color: #0f172a;">${m.qualification}</div>
                                            <div style="font-size: 8px; color: #64748b; margin-top: 6px; line-height: 1.4;">
                                                ${m.certificates.map(c => `<div style="display: flex; align-items: center; gap: 4px;"><span style="color: #4f46e5;">•</span> ${c.name}</div>`).join('')}
                                            </div>
                                        </td>
                                        <td style="padding: 15px; font-weight: 600; color: #475569;">${m.deputyName || 'No substitute assigned'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- AUTHORIZATION & FOOTER -->
                    <div style="margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 20px; position: relative; z-index: 10;">
                        <div style="display: flex; gap: 30px; margin-bottom: 25px;">
                            <div style="flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background: #f8fafc;">
                                <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px;">Prepared & Signed (FSTL)</div>
                                <div style="display: flex; align-items: flex-end; gap: 15px;">
                                    <div style="border-bottom: 1px solid #cbd5e1; flex: 1; height: 30px;"></div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 12px; font-weight: 900;">${fstl?.name || '---'}</div>
                                        <div style="font-size: 10px; color: #475569;">Food Safety Team Leader</div>
                                    </div>
                                </div>
                            </div>
                            <div style="flex: 1; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; background: #f8fafc;">
                                <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px;">Approved & Validated (Authority)</div>
                                <div style="display: flex; align-items: flex-end; gap: 15px;">
                                    <div style="border-bottom: 1px solid #cbd5e1; flex: 1; height: 30px;"></div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 12px; font-weight: 900;">${docInfo.approvedBy}</div>
                                        <div style="font-size: 10px; color: #475569;">Management Representative</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style="background: #fff1f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 15px;">
                            <div style="font-size: 11px; font-weight: 900; color: #e11d48; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 2px;">Uncontrolled Copy When Printed</div>
                            <div style="font-size: 9px; color: #be123c; font-weight: 600;">Document authenticity must be verified against the Master Digital Registry on the HACCP PRO Platform.</div>
                        </div>

                        <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                            <div>Gen. Timestamp: ${downloadTimestamp}</div>
                            <div>System integrity ID: ${securityId}</div>
                            <div>Page ${unitIdx + 1} of ${unitsToExport.length}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        printArea.innerHTML = htmlContent;
        document.body.appendChild(printArea);

        try {
            const canvas = await html2canvas(printArea, { 
                scale: 3, // High resolution
                useCORS: true, 
                backgroundColor: '#ffffff',
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Calculate how many pages the canvas spans based on our HTML structure
            // In our case, we used page-break-after, but html2canvas captures one giant image.
            // A better way is to iterate pages, but for this refactor we slice for high-res output.
            
            const totalCanvasHeight = canvas.height;
            const singlePageCanvasHeight = (pdfHeight * canvas.width) / pdfWidth;
            let currentCanvasY = 0;

            while (currentCanvasY < totalCanvasHeight) {
                if (currentCanvasY > 0) pdf.addPage();
                
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = Math.min(singlePageCanvasHeight, totalCanvasHeight - currentCanvasY);
                
                const ctx = pageCanvas.getContext('2d');
                ctx?.drawImage(canvas, 0, currentCanvasY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
                
                pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, (pageCanvas.height * pdfWidth) / canvas.width);
                currentCanvasY += singlePageCanvasHeight;
            }

            savePdfForPWA(pdf, `ISO_22000_Food_Safety_Team_Registry_${now.toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("Registry Export failed", err);
            alert("Digital Registry Export failed. Critical System Error.");
        } finally {
            document.body.removeChild(printArea);
            setIsGeneratingPDF(false);
        }
    };

    const totalFsMembers = teamMembers.filter(m => m.status === 'Active').length;
    const linkedFromUserList = teamMembers.filter(m => m._sourceEmployeeId).length;

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {isLoadingEmployees && (
                <div className="flex items-center justify-center py-8 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="text-sm font-bold text-slate-500">Loading Food Safety Team from User List...</span>
                </div>
            )}
            {/* Dashboard Ribbon */}
            <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
                 <div className="flex items-center gap-5">
                     <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                         <ShieldCheck size={32} />
                     </div>
                     <div>
                         <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Food Safety Team</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ISO 22000 Registry Hub</p>
                         {linkedFromUserList > 0 && (
                             <p className="text-[9px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                                 <UserCheck size={10} /> {linkedFromUserList} member{linkedFromUserList !== 1 ? 's' : ''} linked from User List
                             </p>
                         )}
                     </div>
                 </div>

                 <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-0 justify-center">
                     <div className="flex flex-col items-center bg-slate-50 rounded-2xl p-3 border border-slate-100">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">FSTL Coverage</span>
                         <div className="flex items-center gap-3">
                             <span className="text-sm font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> {globalStats.fstlAssignedCount} Assigned</span>
                             <div className="h-4 w-px bg-slate-200" />
                             <span className="text-sm font-bold text-rose-500 flex items-center gap-1"><X size={12}/> {globalStats.fstlMissingCount} Gap</span>
                         </div>
                     </div>
                     <div className="flex flex-col items-center bg-slate-50 rounded-2xl p-3 border border-slate-100">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Personnel Adherence</span>
                         <div className="flex items-center gap-3">
                             <span className="text-sm font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> {globalStats.compliantTeamCount} Compliant</span>
                             <div className="h-4 w-px bg-slate-200" />
                             <span className="text-sm font-bold text-rose-500 flex items-center gap-1"><X size={12}/> {globalStats.nonCompliantTeamCount} Incomplete</span>
                         </div>
                     </div>
                 </div>

                 <div className="flex items-center gap-3 pr-4">
                     <div className="relative group w-full md:w-64">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                         <input type="text" placeholder="Search Member..." className="pl-9 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 w-full transition-all shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                     </div>
                     <button onClick={() => { setAddMemberForm(f => ({ ...f, unitId: filteredUnits.find(u => u.id !== '__unassigned__')?.id || '' })); setIsAddMemberModalOpen(true); }} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg transition-all active:scale-95 flex items-center gap-1.5">
                        <UserPlus size={18} />
                     </button>
                     <button onClick={() => handleExportPDF()} disabled={isGeneratingPDF} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-indigo-600 shadow-sm disabled:opacity-50 transition-all active:scale-95">
                        {isGeneratingPDF ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                     </button>
                 </div>
            </div>

            {!isLoadingEmployees && teamMembers.length === 0 && (
                <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-4"><Users size={28} className="text-slate-400" /></div>
                    <h3 className="text-lg font-black text-slate-700 uppercase tracking-tight mb-2">No Food Safety Team Members Found</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">Assign employees the role <span className="font-bold text-indigo-600">"Food Safety Team Leader"</span> or <span className="font-bold text-indigo-600">"Food Safety Team"</span> in the User List to populate this registry automatically.</p>
                </div>
            )}

            {/* Units List */}
            <div className="space-y-6">
                {filteredUnits.map(unit => {
                    const isExpanded = expandedUnitIds.has(unit.id);
                    const isMatrixView = matrixViewUnits.has(unit.id);
                    const directMembers = unit.id === '__unassigned__'
                        ? teamMembers.filter(m => !m.unitId || !entities.some(e => e.type === 'unit' && e.id === m.unitId))
                        : teamMembers.filter(m => m.unitId === unit.id);
                    const crossMembers = unit.id !== '__unassigned__' ? getCrossUnitMembersForUnit(unit.id) : [];
                    const existingIds = new Set(directMembers.map(m => m.id));
                    const allMembers = [...directMembers, ...crossMembers.filter(cm => !existingIds.has(cm.id))];
                    if ((currentScope === 'regional' || currentScope === 'corporate') && allMembers.filter(m => m.status === 'Active').length === 0) return null;
                    let displayMembers = allMembers.filter(m => showHistory ? true : m.status === 'Active');
                    displayMembers = displayMembers.sort((a, b) => {
                        if (a.isFSTL && !b.isFSTL) return -1;
                        if (!a.isFSTL && b.isFSTL) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    if (searchTerm) {
                        displayMembers = displayMembers.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.designation.toLowerCase().includes(searchTerm.toLowerCase()));
                    }
                    const activeMembers = allMembers.filter(m => m.status === 'Active');
                    const hasFSTL = activeMembers.some(m => m.isFSTL);
                    const expiredCertsCount = activeMembers.reduce((acc, m) => acc + m.certificates.filter(c => isCertExpired(c.expiry)).length, 0);
                    const assessmentsDueCount = activeMembers.filter(m => !m.lastCompetencyAssessmentDate || (new Date().getTime() - new Date(m.lastCompetencyAssessmentDate).getTime() > 365 * 24 * 60 * 60 * 1000)).length;
                    const docInfo = docControlData[unit.id] || docControlData['default'];

                    return (
                        <div key={unit.id} className={`bg-white rounded-[2rem] border-2 transition-all duration-300 overflow-hidden flex flex-col ${isExpanded ? 'border-indigo-500 shadow-xl' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                            <div className="p-6 md:p-8 flex flex-col cursor-pointer bg-slate-50/30 hover:bg-slate-50 transition-colors gap-6" onClick={() => toggleExpand(unit.id)}>
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm shrink-0"><Building2 size={28} /></div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{unit.name}</h3>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={12} className="text-indigo-500" /> {unit.location}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                        <div className="flex -space-x-2 mr-2">
                                            {activeMembers.slice(0,4).map(m => (<div key={m.id} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">{m.name.charAt(0)}</div>))}
                                            {activeMembers.length > 4 && <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">+{activeMembers.length - 4}</div>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); handleExportPDF(unit.id); }} disabled={isGeneratingPDF} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-indigo-600 shadow-sm active:scale-95 transition-all"><Download size={18} /></button>
                                            <div className={`p-3 rounded-xl border transition-all ${isExpanded ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-white text-slate-400 border-slate-200'}`}>{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                     <div className="flex flex-col items-center md:items-start"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Team</span><div className="flex items-center gap-2"><span className="text-lg font-black text-slate-900">{activeMembers.length}</span><Users size={14} className="text-indigo-400" /></div></div>
                                     <div className="flex flex-col items-center md:items-start"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">FSTL Status</span><div className="flex items-center gap-2"><span className={`text-sm font-black uppercase ${hasFSTL ? 'text-emerald-600' : 'text-rose-500'}`}>{hasFSTL ? 'Assigned' : 'Missing'}</span>{hasFSTL ? <CheckCircle2 size={14} className="text-emerald-500"/> : <AlertCircle size={14} className="text-rose-500"/>}</div></div>
                                     <div className="flex flex-col items-center md:items-start"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expired Certs</span><div className="flex items-center gap-2"><span className={`text-lg font-black ${expiredCertsCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{expiredCertsCount}</span>{expiredCertsCount > 0 && <AlertTriangle size={14} className="text-rose-500" />}</div></div>
                                     <div className="flex flex-col items-center md:items-start"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Assessments Due</span><div className="flex items-center gap-2"><span className={`text-lg font-black ${assessmentsDueCount > 0 ? 'text-amber-500' : 'text-slate-900'}`}>{assessmentsDueCount}</span><Award size={14} className={assessmentsDueCount > 0 ? 'text-amber-400' : 'text-slate-300'} /></div></div>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-6 md:p-8 border-t border-slate-100 bg-white space-y-6 animate-in slide-in-from-top-2">
                                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                                             <button onClick={() => { const s = new Set(matrixViewUnits); s.delete(unit.id); setMatrixViewUnits(s); }} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isMatrixView ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>List View</button>
                                             <button onClick={() => { const s = new Set(matrixViewUnits); s.add(unit.id); setMatrixViewUnits(s); }} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isMatrixView ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Matrix View</button>
                                        </div>
                                        <button onClick={() => setShowHistory(!showHistory)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${showHistory ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}><History size={14} /> {showHistory ? 'Hide History' : 'Show History'}</button>
                                    </div>

                                    <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={16} /></div>
                                            <div>
                                                <div className="flex items-center gap-2"><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Document Control</h4><InfoTooltip text={ISO_TOOLTIPS.docControl} /></div>
                                                <div className="flex gap-4 text-[10px] font-mono font-bold text-slate-700 mt-0.5"><span>Ref: {docInfo.docRef}</span><span>Ver: {docInfo.version}</span><span>Date: {docInfo.effectiveDate}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Approved By:</span><span className="text-[10px] font-black text-slate-800 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{docInfo.approvedBy}</span></div>
                                            <button onClick={() => handleEditDocControl(unit.id)} className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"><Edit3 size={14}/></button>
                                        </div>
                                    </div>

                                    {isMatrixView ? (
                                        <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-2xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50"><tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-200"><th className="p-4 w-[200px]">Team Member</th>{SKILL_MATRIX_COLS.map(skill => (<th key={skill} className="p-4 text-center border-l border-slate-100">{skill}</th>))}</tr></thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {displayMembers.map(member => (
                                                        <tr key={member.id} className="hover:bg-indigo-50/30 transition-colors">
                                                            <td className="p-4 bg-white sticky left-0 z-10"><div className="font-bold text-slate-800 text-xs">{member.name}</div><div className="text-[9px] text-slate-400 uppercase">{member.designation}</div></td>
                                                            {SKILL_MATRIX_COLS.map(skill => {
                                                                const hasSkill = member.trainings.includes(skill) || member.certificates.some(c => c.name.includes(skill));
                                                                return (<td key={skill} className="p-4 text-center border-l border-slate-100">{hasSkill ? (<div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm"><Check size={14} strokeWidth={3} /></div>) : (<div className="w-1.5 h-1.5 bg-slate-200 rounded-full mx-auto" />)}</td>);
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-[#1e293b] text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em]"><div className="col-span-4">Role & Identity</div><div className="col-span-3">Competency & Evidence</div><div className="col-span-3">Engagement Status</div><div className="col-span-2 text-right">Actions</div></div>
                                            {displayMembers.map((member) => {
                                                const isArchived = member.status === 'Archived';
                                                const isInlineEditing = inlineEditingId === member.id;
                                                const isSynced = !!member._sourceEmployeeId;
                                                const ed = isInlineEditing ? inlineEditData : member;
                                                return (
                                                <div key={member.id} className={`group relative bg-white border-2 rounded-3xl p-5 hover:shadow-xl transition-all duration-300 ${isArchived ? 'opacity-70 grayscale bg-slate-50 border-slate-200' : member.isFSTL ? 'border-amber-200 shadow-md bg-amber-50/20' : 'border-slate-100 hover:border-indigo-100'}`}>
                                                    {member.isFSTL && !isArchived && (<div className="absolute -top-3 left-6 bg-amber-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-1"><Star size={10} fill="currentColor"/> Team Leader (FSTL)</div>)}
                                                    {isArchived && (<div className="absolute -top-3 left-6 bg-slate-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-1"><Archive size={10} /> Archived: {member.exitDate}</div>)}
                                                    {isSynced && !isArchived && (<div className={`absolute -top-3 ${member.isFSTL ? 'left-52' : 'left-6'} bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1`}><Users size={9} /> Synced from User List</div>)}
                                                    {member.id.startsWith('manual-') && !isArchived && (<div className={`absolute -top-3 ${member.isFSTL ? 'left-52' : 'left-6'} bg-indigo-500 text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1`}><UserPlus size={9} /> Manually Added</div>)}
                                                    {member.haccpTeamTag && !isArchived && (<div className="absolute -top-3 right-6 bg-violet-600 text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1"><ShieldCheck size={9} /> {member.haccpTeamTag} &middot; Auditor</div>)}
                                                    {member.id.startsWith('xunit-') && !isArchived && (<div className="absolute -top-3 right-6 bg-sky-600 text-white px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1"><Building2 size={9} /> Cross-Unit Assignment</div>)}
                                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                                                        <div className="lg:col-span-4 flex items-start gap-4"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black border-2 shadow-sm shrink-0 ${member.isFSTL ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{member.name.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 mb-1"><h4 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{member.name}</h4>{isInlineEditing ? (<select className="text-[8px] font-bold border border-slate-200 rounded px-1.5 py-0.5 bg-white" value={ed.employmentType || 'Internal'} onChange={e => setInlineEditData({...inlineEditData, employmentType: e.target.value as any})}><option value="Internal">Internal</option><option value="External">External</option></select>) : (<span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${member.employmentType === 'External' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{member.employmentType}</span>)}</div><div className="flex items-center gap-1"><p className="text-[10px] font-bold text-indigo-600 uppercase truncate">{member.fsmsRole}</p><InfoTooltip text={ISO_TOOLTIPS.fsmsRole} /></div><p className="text-[9px] font-medium text-slate-400 uppercase truncate mt-0.5">{member.designation} • {member.department}</p><div className="mt-2 flex gap-3 text-[9px] text-slate-500"><span className="flex items-center gap-1 truncate"><Mail size={10}/> {member.email || 'N/A'}</span><span className="flex items-center gap-1 truncate"><Phone size={10}/> {member.mobile || 'N/A'}</span></div></div></div>
                                                        <div className="lg:col-span-3 space-y-3">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Core Department</span>
                                                                {isInlineEditing ? (
                                                                    <div className="relative">
                                                                        <input type="text" list={`dept-list-${member.id}`} className="text-[9px] border border-slate-200 rounded px-2 py-1.5 w-full bg-white font-bold" placeholder="Search department..." value={ed.department || ''} onChange={e => setInlineEditData({...inlineEditData, department: e.target.value})} />
                                                                        <datalist id={`dept-list-${member.id}`}>{allDepartmentNames.map(d => <option key={d} value={d} />)}</datalist>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">{member.department || 'N/A'}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Additional Responsibilities</span>
                                                                {isInlineEditing ? (
                                                                    <DeptMultiSelect
                                                                        memberId={member.id}
                                                                        allDepartments={allDepartmentNames}
                                                                        selected={ed.additionalDepartments || []}
                                                                        coreDept={ed.department || ''}
                                                                        onChange={(deps) => setInlineEditData({...inlineEditData, additionalDepartments: deps})}
                                                                    />
                                                                ) : (
                                                                    (member.additionalDepartments && member.additionalDepartments.length > 0) ? (
                                                                        <div className="flex flex-wrap gap-1">{member.additionalDepartments.map((dept, i) => (
                                                                            <span key={i} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">{dept}</span>
                                                                        ))}</div>
                                                                    ) : (<span className="text-[9px] text-slate-400 italic">None assigned</span>)
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Domain & Qualification <InfoTooltip text={ISO_TOOLTIPS.domain} /></span>
                                                                <span className="text-[10px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit">{member.domain}</span>
                                                                {isInlineEditing ? (
                                                                    <div className="flex gap-2 items-center"><GraduationCap size={10} className="text-slate-400 shrink-0"/><input type="text" className="text-[9px] border border-slate-200 rounded px-2 py-1 w-24 bg-white font-bold" placeholder="Qualification" value={ed.qualification || ''} onChange={e => setInlineEditData({...inlineEditData, qualification: e.target.value})} /><input type="number" className="text-[9px] border border-slate-200 rounded px-2 py-1 w-16 bg-white font-bold" placeholder="Yrs" value={ed.totalExperience || ''} onChange={e => setInlineEditData({...inlineEditData, totalExperience: parseFloat(e.target.value) || 0})} /><span className="text-[9px] text-slate-400">Yrs</span></div>
                                                                ) : (
                                                                    <span className="text-[9px] text-slate-500 truncate"><GraduationCap size={10} className="inline mr-1"/>{member.qualification || 'N/A'} &bull; {member.totalExperience} Yrs</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Certificates ({member.certificates.length})</span>
                                                                <div className="flex flex-wrap gap-2">{member.certificates.map(cert => (
                                                                    <span key={cert.id} className={`text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${isCertExpired(cert.expiry) ? 'text-white bg-rose-600' : 'text-blue-600 bg-blue-50 border-blue-100'}`}><FileBadge size={10}/> {cert.name}</span>
                                                                ))}</div>
                                                            </div>
                                                        </div>
                                                        <div className={`lg:col-span-3 space-y-3 p-2 rounded-xl transition-all`}>
                                                            {isInlineEditing ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2"><UserCheck size={12} className="text-emerald-500 shrink-0"/><span className="text-[9px] font-bold text-slate-500 w-16 shrink-0">Meeting:</span><input type="date" className="text-[9px] border border-slate-200 rounded px-2 py-1 bg-white font-bold flex-1" value={ed.lastMeetingAttended || ''} onChange={e => setInlineEditData({...inlineEditData, lastMeetingAttended: e.target.value})} /></div>
                                                                    <div className="flex items-center gap-2"><Award size={12} className="text-slate-400 shrink-0"/><span className="text-[9px] font-bold text-slate-500 w-16 shrink-0">Assess:</span><input type="date" className="text-[9px] border border-slate-200 rounded px-2 py-1 bg-white font-bold flex-1" value={ed.lastCompetencyAssessmentDate || ''} onChange={e => setInlineEditData({...inlineEditData, lastCompetencyAssessmentDate: e.target.value})} /></div>
                                                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100"><span className="text-[8px] font-black text-slate-400 uppercase w-16 shrink-0">Deputy:</span><select className="text-[9px] border border-slate-200 rounded px-2 py-1 bg-white font-bold flex-1" value={ed.deputyId || ''} onChange={e => { const dep = teamMembers.find(m => m.id === e.target.value); setInlineEditData({...inlineEditData, deputyId: e.target.value, deputyName: dep?.name || ''}); }}><option value="">None</option>{teamMembers.filter(m => m.unitId === member.unitId && m.status === 'Active' && m.id !== member.id).map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</select></div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className={`flex items-center gap-2 text-[10px] font-bold text-emerald-700`}><UserCheck size={12}/>Meeting: {member.lastMeetingAttended || 'Never'}</div>
                                                                        <div className="text-[10px] font-bold text-slate-600 flex items-center gap-2"><Award size={12} className="text-slate-400"/> Assessment: {member.lastCompetencyAssessmentDate || 'Pending'}</div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 pt-1 border-t border-slate-100/50"><span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Deputy: <span className="text-slate-600 font-bold">{member.deputyName || 'None'}</span></span></div>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div className="lg:col-span-2 flex flex-col items-end gap-2">{isArchived ? (<div className="text-[9px] font-bold text-slate-400 italic">Exited: {member.exitDate}</div>) : isInlineEditing ? (<div className="flex gap-2"><button onClick={handleInlineSave} className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all"><Save size={16} /></button><button onClick={handleInlineCancel} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"><X size={16} /></button></div>) : (<><div className="flex gap-2">{!member.id.startsWith('xunit-') && <button onClick={() => handleInlineEdit(member)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"><Edit3 size={16} /></button>}{member.id.startsWith('manual-') && (<button onClick={() => handleDeleteManualMember(member.id)} className="p-2.5 bg-rose-50 text-rose-400 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={16} /></button>)}</div>{isUpperScope && !isArchived && !member.id.startsWith('xunit-') && (<div className="flex flex-col gap-1.5"><button onClick={() => handleToggleHaccpTag(member, defaultTagForScope)} className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border shadow-sm ${member.haccpTeamTag ? 'bg-violet-600 text-white border-violet-700 hover:bg-violet-700' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-400 hover:text-violet-600'}`}><ShieldCheck size={11} />{member.haccpTeamTag ? 'Auditor' : 'Mark as Auditor'}</button><button onClick={() => openAssignToUnitsModal(member)} className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 border shadow-sm ${(crossUnitAssignments[member.id] || []).length > 0 ? 'bg-sky-600 text-white border-sky-700 hover:bg-sky-700' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-400 hover:text-sky-600'}`}><Building2 size={11} />Assign to Units{(crossUnitAssignments[member.id] || []).length > 0 && ` (${(crossUnitAssignments[member.id] || []).length})`}</button></div>)}</>)}</div>
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {/* MODAL SECTION: DOC CONTROL */}
            {isDocControlModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">Document Control</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ISO 22000 Clause 7.5.3</p></div><button onClick={() => setIsDocControlModalOpen(false)} className="p-2 bg-slate-50 rounded-full"><X size={20}/></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Doc Reference</label><input className="w-full border rounded-lg p-3 text-sm font-bold bg-slate-50 font-mono" value={tempDocControl.docRef} onChange={e => setTempDocControl({...tempDocControl, docRef: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Version</label><input className="w-full border rounded-lg p-3 text-sm font-bold bg-slate-50" value={tempDocControl.version} onChange={e => setTempDocControl({...tempDocControl, version: e.target.value})} /></div><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Effective Date</label><input type="date" className="w-full border rounded-lg p-3 text-sm font-bold bg-slate-50" value={tempDocControl.effectiveDate} onChange={e => setTempDocControl({...tempDocControl, effectiveDate: e.target.value})} /></div></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Approved By</label><input className="w-full border rounded-lg p-3 text-sm font-bold bg-slate-50" value={tempDocControl.approvedBy} onChange={e => setTempDocControl({...tempDocControl, approvedBy: e.target.value})} /></div>
                        </div>
                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t"><button onClick={() => setIsDocControlModalOpen(false)} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider">Cancel</button><button onClick={handleSaveDocControl} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><Save size={16} /> Update Control</button></div>
                    </div>
                </div>
            )}

            {isAddMemberModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 max-w-xl w-full shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight flex items-center gap-3"><UserPlus size={24} className="text-indigo-600" /> Add Team Member</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Food Safety Team — Manual Entry</p>
                            </div>
                            <button onClick={() => setIsAddMemberModalOpen(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
                        </div>

                        <div className="mb-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Team Type</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                <button onClick={() => setAddMemberForm(f => ({ ...f, teamType: 'Internal' }))} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${addMemberForm.teamType === 'Internal' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <Users size={14} /> Internal Team
                                </button>
                                <button onClick={() => setAddMemberForm(f => ({ ...f, teamType: 'External' }))} className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${addMemberForm.teamType === 'External' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <UserPlus size={14} /> External Team
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name *</label>
                                    <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="Enter full name" value={addMemberForm.name} onChange={e => setAddMemberForm(f => ({ ...f, name: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Designation</label>
                                    <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="e.g., Quality Manager" value={addMemberForm.designation} onChange={e => setAddMemberForm(f => ({ ...f, designation: e.target.value }))} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">FSMS Role</label>
                                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" value={addMemberForm.fsmsRole} onChange={e => setAddMemberForm(f => ({ ...f, fsmsRole: e.target.value }))}>
                                        <option value="Food Safety Team Member">Food Safety Team Member</option>
                                        <option value="Food Safety Team Leader (FSTL)">Food Safety Team Leader (FSTL)</option>
                                        <option value="Food Safety Coordinator">Food Safety Coordinator</option>
                                        <option value="Internal Auditor">Internal Auditor</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Department</label>
                                    <input list="add-member-dept-list" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="Search department..." value={addMemberForm.department} onChange={e => setAddMemberForm(f => ({ ...f, department: e.target.value }))} />
                                    <datalist id="add-member-dept-list">{allDepartmentNames.map(d => <option key={d} value={d} />)}</datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Domain</label>
                                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" value={addMemberForm.domain} onChange={e => setAddMemberForm(f => ({ ...f, domain: e.target.value }))}>
                                        {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assign to Unit</label>
                                    <select className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" value={addMemberForm.unitId} onChange={e => setAddMemberForm(f => ({ ...f, unitId: e.target.value }))}>
                                        {filteredUnits.filter(u => u.id !== '__unassigned__').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                                    <input type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="email@example.com" value={addMemberForm.email} onChange={e => setAddMemberForm(f => ({ ...f, email: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile</label>
                                    <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="+1234567890" value={addMemberForm.mobile} onChange={e => setAddMemberForm(f => ({ ...f, mobile: e.target.value }))} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qualification</label>
                                    <input className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="e.g., M.Sc Food Science" value={addMemberForm.qualification} onChange={e => setAddMemberForm(f => ({ ...f, qualification: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Experience (Years)</label>
                                    <input type="number" min="0" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-bold bg-white focus:border-indigo-400 outline-none transition-all" placeholder="0" value={addMemberForm.totalExperience || ''} onChange={e => setAddMemberForm(f => ({ ...f, totalExperience: parseFloat(e.target.value) || 0 }))} />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
                            <button onClick={() => setIsAddMemberModalOpen(false)} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 transition-all">Cancel</button>
                            <button onClick={handleAddMember} disabled={!addMemberForm.name.trim()} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Plus size={16} /> Add Member
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {assignToUnitsModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight flex items-center gap-3"><Building2 size={22} className="text-sky-600" /> Assign to Units</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{assignToUnitsModal.member.name}</p>
                                <p className="text-[9px] font-medium text-slate-400 mt-0.5">Home Unit: {entities.find(e => e.id === assignToUnitsModal.member.unitId)?.name || 'Unknown'}</p>
                            </div>
                            <button onClick={() => setAssignToUnitsModal(null)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><X size={20} /></button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Select additional units where this member should appear as a team member.</p>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                            {filteredUnits.filter(u => u.id !== '__unassigned__' && u.id !== assignToUnitsModal.member.unitId).map(unit => {
                                const isSelected = assignToUnitsModal.selectedUnits.has(unit.id);
                                return (
                                    <label key={unit.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? 'border-sky-500 bg-sky-50' : 'border-slate-100 hover:border-sky-200 bg-white'}`}>
                                        <input type="checkbox" checked={isSelected} onChange={() => {
                                            setAssignToUnitsModal(prev => {
                                                if (!prev) return null;
                                                const next = new Set(prev.selectedUnits);
                                                if (next.has(unit.id)) next.delete(unit.id); else next.add(unit.id);
                                                return { ...prev, selectedUnits: next };
                                            });
                                        }} className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 accent-sky-600" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-slate-800 uppercase truncate">{unit.name}</div>
                                            <div className="text-[9px] text-slate-400 font-medium truncate">{unit.location}</div>
                                        </div>
                                        {isSelected && <div className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center shrink-0"><Check size={14} strokeWidth={3} /></div>}
                                    </label>
                                );
                            })}
                        </div>
                        <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400">{assignToUnitsModal.selectedUnits.size} unit{assignToUnitsModal.selectedUnits.size !== 1 ? 's' : ''} selected</span>
                            <div className="flex gap-3">
                                <button onClick={() => setAssignToUnitsModal(null)} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 transition-all">Cancel</button>
                                <button onClick={handleSaveCrossUnitAssignment} className="px-8 py-3 bg-sky-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-sky-700 transition-all flex items-center gap-2">
                                    <Check size={16} /> Save Assignment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodSafetyTeam;
