
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Filter, Calendar, ChevronLeft, ChevronRight, Download, RefreshCw,
  Users, CheckCircle, XCircle, AlertTriangle, Info,
  Search, ChevronDown, MinusCircle, PlusCircle,
  FileText, Save, Clock, ArrowRight, Paperclip, Eye, X,
  Briefcase, MapPin, Globe, Building, Award, UserCheck, Utensils, User,
  LayoutGrid, List, ChevronUp, BarChart3
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { Entity, HierarchyScope, Employee } from '../types';

// --- TYPES ---

interface SessionHistory {
  date: string;
  score: number;
  type: string;
  remarks: string;
  url?: string;
}

interface TrainingSession {
  name: string;
  attended: number; // 0 or 1
  total: number;
  actualHours: number;
  targetHours: number;
  date: string;
  targetCompetency: number;
  actualCompetency: number;
  history?: SessionHistory[];
  certificateUrl?: string;
}

interface EmployeeMetrics {
  [topic: string]: TrainingSession[];
}

interface SummaryStats {
  employees: number;
  metrics: EmployeeMetrics;
}

interface HierarchyNode {
  id: string;
  name: string;
  type: 'corporate' | 'region' | 'unit' | 'department' | 'employee';
  status?: string;
  role?: string;
  joiningDate?: string;
  employeeIdNum?: string;
  category?: string;
  foodHandler?: string;
  metrics?: EmployeeMetrics;
  children?: HierarchyNode[];
  parent?: HierarchyNode | null; 
  summary?: SummaryStats;
  path?: string[];
}

interface FilterState {
  employees: string[];
  hierarchy: { region: string[]; unit: string[]; department: string[]; role: string[]; category: string[] };
  topics: { topic: string[]; subtopic: string[]; proficiency: string };
  dates: { trainingFrom: string; trainingTo: string; joiningFrom: string; joiningTo: string };
  foodHandler: string;
  attendanceStatus: string;
  searchTerm: string;
}

// --- STATIC DATA CONFIG ---

const FOOD_HANDLER_ROLES = ['Commis Chef', 'Waiter', 'Stewarding'];
const FALLBACK_TRAINING_CATALOG: Record<string, string[]> = {
  "HACCP": ['Type A', 'Type B', 'Type C', 'Type D'],
  "Safety": ['Fire Drills', 'First Aid', 'Evacuation Procedures'],
  "Service": ['Guest Interaction', 'Complaint Handling']
};

interface TrainingDashboardProps {
  entities?: Entity[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
}

// --- HELPER FUNCTIONS ---

const convertDecimalToHMS = (d: number) => {
  const h = Math.floor(d);
  const m = Math.floor((d * 60) % 60);
  const s = Math.floor((d * 3600) % 60);
  return `${String(h).padStart(3, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const calculateRowSummary = (metrics: EmployeeMetrics | undefined) => {
  if (!metrics) return { status: 'NA', statusClass: 'bg-gray-400', sessions: 0, hours: 0, score: 0 };
  
  const allSessions = Object.values(metrics).flat();
  const attended = allSessions.filter(s => s.attended);
  
  const status = attended.length === allSessions.length ? 'Attended' : attended.length > 0 ? 'Partially' : 'Not Attended';
  const statusClass = status === 'Attended' ? 'bg-green-500' : status === 'Partially' ? 'bg-yellow-500' : 'bg-red-500';
  
  const hours = attended.reduce((acc, curr) => acc + curr.actualHours, 0);
  const totalScore = attended.reduce((acc, curr) => acc + curr.actualCompetency, 0);
  const avgScore = attended.length ? (totalScore / attended.length).toFixed(1) : 0;

  return { status, statusClass, sessions: attended.length, hours, score: avgScore };
};

const getHeatmapColor = (score: number) => {
  if (score >= 4.5) return 'bg-emerald-500 text-white';
  if (score >= 3.5) return 'bg-lime-400 text-slate-800';
  if (score >= 2.5) return 'bg-yellow-400 text-slate-800';
  if (score >= 1) return 'bg-orange-400 text-white';
  return 'bg-red-100 text-red-400'; // Not attended or very low
};

const MultiSelectDropdown = ({ label, options, selected, onChange, placeholder }: {
  label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void; placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  return (
    <div className="space-y-1" ref={ref}>
      <label className="text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full border rounded-lg p-2.5 text-sm bg-white cursor-pointer flex items-center justify-between min-h-[42px] transition-all ${isOpen ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <div className="flex flex-wrap gap-1 flex-1 mr-2">
            {selected.length === 0 && <span className="text-slate-400">{placeholder || `All ${label}`}</span>}
            {selected.map(v => (
              <span key={v} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">
                {v.length > 18 ? v.slice(0, 18) + '...' : v}
                <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }} className="hover:text-red-500 transition-colors"><X size={10} /></button>
              </span>
            ))}
          </div>
          <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] overflow-hidden animate-in fade-in duration-100">
            <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  autoFocus
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-400"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-48 p-1">
              {filtered.length > 0 ? filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors flex items-center gap-2 ${selected.includes(opt) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                    {selected.includes(opt) && <CheckCircle size={10} className="text-white" />}
                  </div>
                  {opt}
                </button>
              )) : <div className="px-3 py-4 text-xs text-slate-400 text-center">No matches</div>}
            </div>
            {selected.length > 0 && (
              <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                <button type="button" onClick={() => { onChange([]); setSearch(''); }} className="text-[10px] font-bold text-red-500 hover:text-red-600 px-2 py-1">Clear All ({selected.length})</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT ---

export default function HierarchicalTrainingDashboard({ entities = [], currentScope, userRootId }: TrainingDashboardProps) {
  // -- State --
  const [rawData, setRawData] = useState<HierarchyNode[]>([]);
  const [viewData, setViewData] = useState<HierarchyNode[]>([]);
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ currentPage: 1, rowsPerPage: 20 });
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  // View States
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [mobileExpandedEmp, setMobileExpandedEmp] = useState<string | null>(null);

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    employees: [],
    hierarchy: { region: [], unit: [], department: [], role: [], category: [] },
    topics: { topic: [], subtopic: [], proficiency: '' },
    dates: { trainingFrom: '', trainingTo: '', joiningFrom: '', joiningTo: '' },
    foodHandler: '',
    attendanceStatus: '',
    searchTerm: ''
  });

  // Modals State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<HierarchyNode | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [newScore, setNewScore] = useState<number>(0);
  const [newScoreType, setNewScoreType] = useState("Assessment");

  const trainingCatalog = useMemo<Record<string, string[]>>(() => {
    const getAncestors = (entityId: string): Entity[] => {
      const result: Entity[] = [];
      let current = entities.find(e => e.id === entityId);
      while (current) {
        result.push(current);
        current = current.parentId ? entities.find(e => e.id === current!.parentId) : undefined;
      }
      return result;
    };

    let sopSource: Entity | undefined;
    if (userRootId) {
      const ancestors = getAncestors(userRootId);
      sopSource = ancestors.find(e => e.type === 'corporate' && e.masterSops && e.masterSops.length > 0);
    }
    if (!sopSource) {
      sopSource = entities.find(e => e.type === 'corporate' && e.masterSops && e.masterSops.length > 0);
    }

    if (sopSource?.masterSops && sopSource.masterSops.length > 0) {
      const catalog: Record<string, string[]> = {};
      sopSource.masterSops.forEach(sop => {
        if (sop.name) {
          catalog[sop.name] = sop.subTopics && sop.subTopics.length > 0
            ? sop.subTopics
            : [sop.name];
        }
      });
      if (Object.keys(catalog).length > 0) return catalog;
    }
    return FALLBACK_TRAINING_CATALOG;
  }, [entities, userRootId]);

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
      if (dept?.parentId) {
        scopedEntities = entities.filter(e => e.id === dept.parentId && e.type === 'unit');
      }
    } else if ((currentScope === 'regional' || currentScope === 'corporate') && userRootId) {
      const descendantIds = new Set([userRootId, ...getDescendantIds(userRootId)]);
      scopedEntities = entities.filter(e => e.type === 'unit' && descendantIds.has(e.id));
    } else {
      scopedEntities = entities.filter(e => e.type === 'unit');
    }
    return new Map<string, string>(
      scopedEntities.filter(e => e.name?.trim()).map(e => [e.name!.trim().toLowerCase(), e.id])
    );
  }, [entities, currentScope, userRootId]);
  
  // -- Data Loading --

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingEmployees(true);
      try {
        const [usersRes, calendarRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/training-calendar')
        ]);
        if (!usersRes.ok) throw new Error('Failed to load users');
        const data = await usersRes.json();
        const allEmployees: Employee[] = data.items || [];

        interface CalendarSession {
          id: string;
          topic: string;
          subTopic: string;
          date: string;
          startTime: string;
          endTime: string;
          trainingHours?: number;
          trainer: string;
          status: string;
          participantList: { employeeId: string; status: 'present' | 'absent' | 'neutral'; addedAt: number }[];
          createdByEntityId: string;
          assignedUnits: string[];
        }
        let calendarSessions: CalendarSession[] = [];
        if (calendarRes.ok) {
          const calData = await calendarRes.json();
          calendarSessions = calData.items || [];
        }

        const empCalendarMap = new Map<string, { topic: string; subTopic: string; date: string; hours: number; trainer: string; status: string }[]>();
        calendarSessions.forEach(session => {
          if (!session.participantList) return;
          const hours = session.trainingHours || 0;
          session.participantList.forEach(p => {
            if (p.status === 'present') {
              if (!empCalendarMap.has(p.employeeId)) empCalendarMap.set(p.employeeId, []);
              empCalendarMap.get(p.employeeId)!.push({
                topic: session.topic,
                subTopic: session.subTopic,
                date: session.date || session.startTime,
                hours,
                trainer: session.trainer,
                status: session.status
              });
            }
          });
        });

        const isScoped = scopedUnitNames.size > 0 && (currentScope === 'unit' || currentScope === 'department' || currentScope === 'regional' || currentScope === 'corporate');
        const scopedEmployees = allEmployees.filter(emp => {
          if (emp.Status !== 'Active') return false;
          if (isScoped) {
            const empUnit = (emp.Unit || '').trim().toLowerCase();
            if (!empUnit || !scopedUnitNames.has(empUnit)) return false;
          }
          return true;
        });

        if (scopedEmployees.length > 0) {
          const deptGroups: Record<string, Record<string, Employee[]>> = {};
          scopedEmployees.forEach(emp => {
            const unitName = (emp.Unit || 'Unknown Unit').trim();
            const deptName = (emp.Department || 'General').trim();
            if (!deptGroups[unitName]) deptGroups[unitName] = {};
            if (!deptGroups[unitName][deptName]) deptGroups[unitName][deptName] = [];
            deptGroups[unitName][deptName].push(emp);
          });

          const findAncestors = (entityId: string): Entity[] => {
            const ancestors: Entity[] = [];
            let current = entities.find(e => e.id === entityId);
            while (current) {
              ancestors.unshift(current);
              current = current.parentId ? entities.find(e => e.id === current!.parentId) : undefined;
            }
            return ancestors;
          };

          const unitNodes: HierarchyNode[] = Object.entries(deptGroups).map(([unitName, depts]) => {
            const unitEntity = entities.find(e => e.type === 'unit' && e.name?.trim().toLowerCase() === unitName.trim().toLowerCase());
            const ancestors = unitEntity ? findAncestors(unitEntity.id) : [];
            const corpName = ancestors.find(a => a.type === 'corporate')?.name || '';
            const regName = ancestors.find(a => a.type === 'regional')?.name || '';

            const deptNodes: HierarchyNode[] = Object.entries(depts).map(([deptName, emps]) => {
              const empNodes: HierarchyNode[] = emps.map(emp => {
                const metrics: EmployeeMetrics = {};
                const empAttendance = empCalendarMap.get(emp.id) || [];

                Object.keys(trainingCatalog).forEach(topic => {
                  metrics[topic] = trainingCatalog[topic].map(sub => {
                    const matchingSessions = empAttendance.filter(a => {
                      const topicMatch = (a.topic || '').trim().toLowerCase() === topic.trim().toLowerCase();
                      const subMatch = (a.subTopic || '').trim().toLowerCase() === sub.trim().toLowerCase();
                      return topicMatch && subMatch;
                    });

                    const attended = matchingSessions.length > 0 ? 1 : 0;
                    const totalHours = matchingSessions.reduce((sum, s) => sum + (s.hours || 0), 0);
                    const latestDate = matchingSessions.length > 0
                      ? [...matchingSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
                      : '';

                    return {
                      name: sub,
                      attended,
                      total: 1,
                      actualHours: totalHours,
                      targetHours: 2,
                      date: latestDate,
                      targetCompetency: 4,
                      actualCompetency: attended ? 3 : 0,
                      history: matchingSessions.map(s => ({
                        date: s.date,
                        score: 3,
                        type: 'Calendar Sync',
                        remarks: `Attended session with ${s.trainer}`
                      }))
                    };
                  });
                });

                return {
                  id: `emp-${emp.id}`,
                  name: emp.Name || 'Unknown',
                  type: 'employee' as const,
                  status: emp.Status || 'Active',
                  role: emp.Role || '',
                  joiningDate: emp.JoinedDate || '',
                  employeeIdNum: emp.ID || '',
                  category: emp.Category || '',
                  foodHandler: emp.FoodHandler || '',
                  metrics,
                  path: [corpName, regName, unitName, deptName].filter(Boolean),
                  summary: { employees: 1, metrics }
                };
              });
              return { id: `dept-${deptName}`, name: deptName, type: 'department' as const, children: empNodes };
            });
            return { id: unitEntity?.id || `unit-${unitName}`, name: unitName, type: 'unit' as const, children: deptNodes };
          });

          const buildHierarchyTree = (): HierarchyNode[] => {
            const corpGroups: Record<string, Record<string, HierarchyNode[]>> = {};
            unitNodes.forEach(uNode => {
              const unitEntity = entities.find(e => e.type === 'unit' && e.name?.trim().toLowerCase() === uNode.name.trim().toLowerCase());
              const ancestors = unitEntity ? findAncestors(unitEntity.id) : [];
              const corp = ancestors.find(a => a.type === 'corporate');
              const reg = ancestors.find(a => a.type === 'regional');
              const corpKey = corp?.id || 'corp';
              const regKey = reg?.id || 'reg';
              if (!corpGroups[corpKey]) corpGroups[corpKey] = {};
              if (!corpGroups[corpKey][regKey]) corpGroups[corpKey][regKey] = [];
              corpGroups[corpKey][regKey].push(uNode);
            });

            return Object.entries(corpGroups).map(([corpId, regions]) => {
              const corpEntity = entities.find(e => e.id === corpId);
              return {
                id: corpId,
                name: corpEntity?.name || 'Corporate',
                type: 'corporate' as const,
                children: Object.entries(regions).map(([regId, units]) => {
                  const regEntity = entities.find(e => e.id === regId);
                  return {
                    id: regId,
                    name: regEntity?.name || 'Region',
                    type: 'region' as const,
                    children: units
                  };
                })
              };
            });
          };

          setRawData(buildHierarchyTree());
        } else {
          setRawData([]);
        }
      } catch (err) {
        console.error('Failed to load training data:', err);
        setRawData([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    loadData();
  }, [lastRefreshed, entities, scopedUnitNames, currentScope, trainingCatalog]);

  // Extract unique hierarchy options for filters
  const hierarchyOptions = useMemo(() => {
    const regions = new Set<string>();
    const units = new Set<string>();
    const depts = new Set<string>();
    const roles = new Set<string>();
    const categories = new Set<string>();

    const traverse = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'region') regions.add(node.name);
        if (node.type === 'unit') units.add(node.name);
        if (node.type === 'department') depts.add(node.name);
        if (node.type === 'employee') {
          if (node.role) roles.add(node.role);
          if (node.category) categories.add(node.category);
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(rawData);

    return {
      regions: Array.from(regions).sort(),
      units: Array.from(units).sort(),
      departments: Array.from(depts).sort(),
      roles: Array.from(roles).sort(),
      categories: Array.from(categories).sort()
    };
  }, [rawData]);

  // Flatten tree to list for table
  const flattenData = (nodes: HierarchyNode[], parents: string[] = []): HierarchyNode[] => {
    let result: HierarchyNode[] = [];
    nodes.forEach(node => {
      if (node.type === 'employee') {
        result.push({ ...node, path: parents });
      } else if (node.children) {
        result = result.concat(flattenData(node.children, [...parents, node.name]));
      }
    });
    return result;
  };

  // Process Data (Filter & Sort)
  useEffect(() => {
    let flat = flattenData(rawData);

    // Apply search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      flat = flat.filter(e =>
        (e.name || '').toLowerCase().includes(term) ||
        (e.employeeIdNum || '').toLowerCase().includes(term)
      );
    }

    // Apply Filters
    if (filters.foodHandler) {
      flat = flat.filter(e => {
        const isFH = (e.foodHandler || '').toLowerCase() === 'yes' || FOOD_HANDLER_ROLES.includes(e.role || '');
        return filters.foodHandler === 'yes' ? isFH : !isFH;
      });
    }

    if (filters.hierarchy.role.length > 0) {
      flat = flat.filter(e => filters.hierarchy.role.includes(e.role || ''));
    }

    if (filters.hierarchy.category.length > 0) {
      flat = flat.filter(e => filters.hierarchy.category.includes(e.category || ''));
    }
    
    // Add additional hierarchy filtering
    if (filters.hierarchy.region.length > 0) {
        flat = flat.filter(e => e.path?.some(p => filters.hierarchy.region.includes(p)));
    }
    if (filters.hierarchy.unit.length > 0) {
        flat = flat.filter(e => e.path?.some(p => filters.hierarchy.unit.includes(p)));
    }
    if (filters.hierarchy.department.length > 0) {
        flat = flat.filter(e => e.path?.some(p => filters.hierarchy.department.includes(p)));
    }

    // Date Filters
    if (filters.dates.joiningFrom) {
        flat = flat.filter(e => e.joiningDate && e.joiningDate >= filters.dates.joiningFrom);
    }
    if (filters.dates.joiningTo) {
        flat = flat.filter(e => e.joiningDate && e.joiningDate <= filters.dates.joiningTo);
    }
    
    if (filters.dates.trainingFrom || filters.dates.trainingTo) {
        const tFrom = filters.dates.trainingFrom;
        const tTo = filters.dates.trainingTo;
        
        flat = flat.filter(e => {
            if (!e.metrics) return false;
            // Check if ANY session in ANY topic matches the range
            return Object.values(e.metrics).some(sessions => 
                sessions.some(s => {
                    const sDate = s.date.split('T')[0];
                    if (tFrom && sDate < tFrom) return false;
                    if (tTo && sDate > tTo) return false;
                    return true;
                })
            );
        });
    }

    // Attendance Status Filter
    if (filters.attendanceStatus) {
        flat = flat.filter(e => {
            const { status } = calculateRowSummary(e.metrics);
            if (filters.attendanceStatus === 'attended') return status === 'Attended';
            if (filters.attendanceStatus === 'partially') return status === 'Partially';
            if (filters.attendanceStatus === 'not_attended') return status === 'Not Attended';
            return true;
        });
    }
    
    // Sort
    flat.sort((a, b) => (a.status === 'Active' ? -1 : 1));

    setViewData(flat);
  }, [rawData, filters]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (pagination.rowsPerPage === -1) return viewData;
    const start = (pagination.currentPage - 1) * pagination.rowsPerPage;
    return viewData.slice(start, start + pagination.rowsPerPage);
  }, [viewData, pagination]);

  const totalPages = pagination.rowsPerPage === -1 ? 1 : Math.ceil(viewData.length / pagination.rowsPerPage);
  
  // Stats Calculation
  const fhCount = viewData.filter(e => (e.foodHandler || '').toLowerCase() === 'yes' || FOOD_HANDLER_ROLES.includes(e.role || '')).length;
  const nonFhCount = viewData.length - fhCount;

  // -- Actions --

  const handleUpdateScore = (empId: string, topicKey: string, subName: string, score: number, type: string) => {
    setRawData(prev => {
        const updateNode = (nodes: HierarchyNode[]): HierarchyNode[] => {
            return nodes.map(node => {
                if (node.id === empId && node.metrics) {
                    const topicMetrics = node.metrics[topicKey] || [];
                    const updatedTopicMetrics = topicMetrics.map(session => {
                        if (session.name === subName) {
                            const newHistory: SessionHistory = {
                                date: new Date().toISOString(),
                                score: score,
                                type: type,
                                remarks: `Updated manually by supervisor.`
                            };
                            return {
                                ...session,
                                actualCompetency: score,
                                history: [newHistory, ...(session.history || [])]
                            };
                        }
                        return session;
                    });
                    return { ...node, metrics: { ...node.metrics, [topicKey]: updatedTopicMetrics } };
                } else if (node.children) {
                    return { ...node, children: updateNode(node.children) };
                }
                return node;
            });
        };
        return updateNode(prev);
    });
    setActiveModal(null);
  };

  const openCompetencyManager = (emp: HierarchyNode, metricKey: string) => {
    setSelectedEmployee(emp);
    setSelectedMetric(metricKey);
    const [topic, sub] = metricKey.split(':');
    const session = emp.metrics?.[topic]?.find(s => s.name === sub);
    setNewScore(session?.actualCompetency || 0);
    setNewScoreType("Assessment");
    setActiveModal('competency');
  };

  const downloadPDF = (elementId: string, filename: string) => {
    const input = document.getElementById(elementId);
    if (input) {
      html2canvas(input, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        savePdfForPWA(pdf, filename);
      });
    }
  };

  const exportAttendanceExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Attendance Report');

    const catalog = getCatalog();
    const sortedTopics = Object.keys(catalog).sort();
    const subTopicColumns: { sub: string; topic: string }[] = [];
    sortedTopics.forEach(topic => {
      (catalog[topic] || []).forEach(sub => {
        subTopicColumns.push({ sub, topic });
      });
    });

    const fixedHeaders = ['S.No.', 'Corporate', 'Regional', 'Unit', 'Department', 'Employee ID', 'Employee Name', 'Role', 'Food Handler', 'Status', 'Joined Date'];
    const subHeaders = subTopicColumns.map(c => `${c.sub} (${c.topic})`);
    const allHeaders = [...fixedHeaders, ...subHeaders];

    const headerRow = ws.addRow(allHeaders);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    const formatDate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      } catch { return dateStr; }
    };

    viewData.forEach((emp, idx) => {
      const pathParts = emp.path || [];
      const corporate = pathParts[0] || '';
      const regional = pathParts.length > 1 ? pathParts[1] : '';
      const unit = pathParts.length > 2 ? pathParts[2] : '';
      const deptFromPath = pathParts.length > 3 ? pathParts[3] : '';

      const rowData: (string | number)[] = [
        idx + 1,
        corporate,
        regional,
        unit,
        deptFromPath || (emp as any).department || '',
        emp.employeeIdNum || '',
        emp.name || '',
        emp.role || '',
        (emp.foodHandler || '').toLowerCase() === 'yes' || FOOD_HANDLER_ROLES.includes(emp.role || '') ? 'Yes' : 'No',
        emp.status || '',
        formatDate(emp.joiningDate || '')
      ];

      subTopicColumns.forEach(col => {
        const sessions = emp.metrics?.[col.topic];
        const session = sessions?.find(s => s.name === col.sub);
        if (session && session.attended > 0 && session.date) {
          rowData.push(formatDate(session.date));
        } else {
          rowData.push('Not Attended');
        }
      });

      const dataRow = ws.addRow(rowData);
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        }
        if (colNumber > fixedHeaders.length) {
          const val = String(cell.value);
          if (val === 'Not Attended') {
            cell.font = { size: 9, color: { argb: 'FFCC0000' } };
          } else {
            cell.font = { size: 9, color: { argb: 'FF006600' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          }
        }
      });
    });

    ws.columns.forEach((col, i) => {
      if (i < fixedHeaders.length) {
        col.width = i === 0 ? 6 : i === 6 ? 25 : 15;
      } else {
        col.width = 18;
      }
    });

    const getColLetter = (n: number): string => {
      let s = '';
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
      return s;
    };
    ws.autoFilter = { from: 'A1', to: `${getColLetter(allHeaders.length - 1)}1` };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Dates_Report_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSummaryExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Competency Summary');

    const catalog = getCatalog();
    const sortedTopics = Object.keys(catalog).sort();
    const subTopicColumns: { sub: string; topic: string }[] = [];
    sortedTopics.forEach(topic => {
      (catalog[topic] || []).forEach(sub => {
        subTopicColumns.push({ sub, topic });
      });
    });

    const fixedHeaders = ['S.No.', 'Employee ID', 'Employee Name', 'Role', 'Category', 'Status', 'Sessions', 'Total Hours'];
    const subHeaders = subTopicColumns.map(c => `${c.sub} (${c.topic})`);
    const allHeaders = [...fixedHeaders, ...subHeaders];

    const headerRow = ws.addRow(allHeaders);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    viewData.forEach((emp, idx) => {
      const summary = calculateRowSummary(emp.metrics);
      const rowData: (string | number)[] = [
        idx + 1, emp.employeeIdNum || '', emp.name || '', emp.role || '', emp.category || '', emp.status || '', summary.sessions, summary.hours
      ];
      subTopicColumns.forEach(col => {
        const session = emp.metrics?.[col.topic]?.find(s => s.name === col.sub);
        rowData.push(session ? session.actualCompetency.toFixed(1) : '0');
      });
      const dataRow = ws.addRow(rowData);
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    ws.columns.forEach((col, i) => { col.width = i === 0 ? 6 : i === 2 ? 25 : 15; });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Competency_Summary_Report_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sanitizeSheetName = (name: string, usedNames: Set<string>): string => {
    let s = (name || 'Sheet').replace(/[\\/*?\[\]:]/g, '').trim() || 'Sheet';
    if (s.length > 31) s = s.substring(0, 31);
    let final = s;
    let counter = 2;
    while (usedNames.has(final.toLowerCase())) {
      const suffix = ` (${counter})`;
      final = s.substring(0, 31 - suffix.length) + suffix;
      counter++;
    }
    usedNames.add(final.toLowerCase());
    return final;
  };

  const buildAttendanceSheet = (
    ws: any,
    emps: HierarchyNode[],
    subTopicColumns: { sub: string; topic: string }[],
    fixedHeaders: string[]
  ) => {
    const allHeaders = [...fixedHeaders, ...subTopicColumns.map(c => `${c.sub} (${c.topic})`)];
    const headerRow = ws.addRow(allHeaders);
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    const formatDate = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      } catch { return dateStr; }
    };

    emps.forEach((emp, idx) => {
      const pathParts = emp.path || [];
      const rowData: (string | number)[] = [
        idx + 1,
        pathParts[0] || '',
        pathParts.length > 1 ? pathParts[1] : '',
        pathParts.length > 2 ? pathParts[2] : '',
        pathParts.length > 3 ? pathParts[3] : '',
        emp.employeeIdNum || '',
        emp.name || '',
        emp.role || '',
        (emp.foodHandler || '').toLowerCase() === 'yes' || FOOD_HANDLER_ROLES.includes(emp.role || '') ? 'Yes' : 'No',
        emp.status || '',
        formatDate(emp.joiningDate || '')
      ];
      subTopicColumns.forEach(col => {
        const session = emp.metrics?.[col.topic]?.find(s => s.name === col.sub);
        if (session && session.attended > 0 && session.date) {
          rowData.push(formatDate(session.date));
        } else {
          rowData.push('Not Attended');
        }
      });
      const dataRow = ws.addRow(rowData);
      dataRow.eachCell((cell: any, colNumber: number) => {
        cell.font = { size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        }
        if (colNumber > fixedHeaders.length) {
          const val = String(cell.value);
          if (val === 'Not Attended') {
            cell.font = { size: 9, color: { argb: 'FFCC0000' } };
          } else {
            cell.font = { size: 9, color: { argb: 'FF006600' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          }
        }
      });
    });

    ws.columns.forEach((col: any, i: number) => {
      if (i < fixedHeaders.length) {
        col.width = i === 0 ? 6 : i === 6 ? 25 : 15;
      } else {
        col.width = 18;
      }
    });
  };

  const exportUnitWiseExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const catalog = getCatalog();
    const sortedTopics = Object.keys(catalog).sort();
    const subTopicColumns: { sub: string; topic: string }[] = [];
    sortedTopics.forEach(topic => (catalog[topic] || []).forEach(sub => subTopicColumns.push({ sub, topic })));
    const fixedHeaders = ['S.No.', 'Corporate', 'Regional', 'Unit', 'Department', 'Employee ID', 'Employee Name', 'Role', 'Food Handler', 'Status', 'Joined Date'];

    const unitMap = new Map<string, HierarchyNode[]>();
    viewData.forEach(emp => {
      const unitName = (emp.path && emp.path.length > 2 ? emp.path[2] : '') || 'Unassigned';
      if (!unitMap.has(unitName)) unitMap.set(unitName, []);
      unitMap.get(unitName)!.push(emp);
    });

    const usedNames = new Set<string>();
    [...unitMap.keys()].sort().forEach(unitName => {
      const sheetName = sanitizeSheetName(unitName, usedNames);
      const ws = workbook.addWorksheet(sheetName);
      buildAttendanceSheet(ws, unitMap.get(unitName)!, subTopicColumns, fixedHeaders);
    });

    if (workbook.worksheets.length === 0) {
      const ws = workbook.addWorksheet('No Data');
      ws.addRow(['No employee data available for current filters.']);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Unit_Wise_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportDepartmentWiseExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const catalog = getCatalog();
    const sortedTopics = Object.keys(catalog).sort();
    const subTopicColumns: { sub: string; topic: string }[] = [];
    sortedTopics.forEach(topic => (catalog[topic] || []).forEach(sub => subTopicColumns.push({ sub, topic })));
    const fixedHeaders = ['S.No.', 'Corporate', 'Regional', 'Unit', 'Department', 'Employee ID', 'Employee Name', 'Role', 'Food Handler', 'Status', 'Joined Date'];

    const deptMap = new Map<string, HierarchyNode[]>();
    viewData.forEach(emp => {
      const deptName = (emp.path && emp.path.length > 3 ? emp.path[3] : '') || 'Unassigned';
      if (!deptMap.has(deptName)) deptMap.set(deptName, []);
      deptMap.get(deptName)!.push(emp);
    });

    const usedNames = new Set<string>();
    [...deptMap.keys()].sort().forEach(dept => {
      const sheetName = sanitizeSheetName(dept, usedNames);
      const ws = workbook.addWorksheet(sheetName);
      buildAttendanceSheet(ws, deptMap.get(dept)!, subTopicColumns, fixedHeaders);
    });

    if (workbook.worksheets.length === 0) {
      const ws = workbook.addWorksheet('No Data');
      ws.addRow(['No employee data available for current filters.']);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Department_Wise_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportTopicWiseExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const catalog = getCatalog();
    const sortedTopics = Object.keys(catalog).sort();
    const fixedHeaders = ['S.No.', 'Corporate', 'Regional', 'Unit', 'Department', 'Employee ID', 'Employee Name', 'Role', 'Food Handler', 'Status', 'Joined Date'];

    const usedNames = new Set<string>();
    sortedTopics.forEach(topic => {
      const topicSubs = (catalog[topic] || []);
      const subTopicColumns = topicSubs.map(sub => ({ sub, topic }));
      const sheetName = sanitizeSheetName(topic, usedNames);
      const ws = workbook.addWorksheet(sheetName);
      buildAttendanceSheet(ws, viewData, subTopicColumns, fixedHeaders);
    });

    if (workbook.worksheets.length === 0) {
      const ws = workbook.addWorksheet('No Data');
      ws.addRow(['No training topic data available.']);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Topic_Wise_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // -- Render Helpers --

  const getCatalog = () => {
    const { topic, subtopic } = filters.topics;
    let catalog: Record<string, string[]> = {};
    
    Object.keys(trainingCatalog).forEach(t => {
      if (topic.length > 0 && !topic.includes(t)) return;
      const subs = trainingCatalog[t].filter(s => subtopic.length === 0 || subtopic.includes(s));
      if (subs.length > 0) catalog[t] = subs;
    });
    return catalog;
  };

  // --- SUB-COMPONENTS (Modals) ---

  const PeriodFilterModal = () => {
    const [localDates, setLocalDates] = useState({ ...filters.dates });
    
    const applyAndClose = () => {
      setFilters(prev => ({ ...prev, dates: localDates }));
      setActiveModal(null);
    };
    
    const clearAll = () => {
      const empty = { trainingFrom: '', trainingTo: '', joiningFrom: '', joiningTo: '' };
      setLocalDates(empty);
      setFilters(prev => ({ ...prev, dates: empty }));
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] animate-in zoom-in-95">
          <div className="flex justify-between items-center p-4 border-b bg-slate-50 rounded-t-lg">
            <h3 className="font-semibold text-lg text-slate-700">Period Filters</h3>
            <button onClick={() => { setFilters(prev => ({ ...prev, dates: localDates })); setActiveModal(null); }} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            <div className="space-y-6 text-slate-700">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-sm text-slate-800">Training Period</div>
                <div className="p-4 space-y-4 bg-white">
                  <div className="flex items-center gap-4">
                    <label className="w-12 text-sm font-medium text-slate-500">From:</label>
                    <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500" value={localDates.trainingFrom} onChange={e => setLocalDates(prev => ({...prev, trainingFrom: e.target.value}))} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-12 text-sm font-medium text-slate-500">To:</label>
                    <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500" value={localDates.trainingTo} onChange={e => setLocalDates(prev => ({...prev, trainingTo: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 font-bold text-sm text-slate-800">Joining Period</div>
                <div className="p-4 space-y-4 bg-white">
                  <div className="flex items-center gap-4">
                    <label className="w-12 text-sm font-medium text-slate-500">From:</label>
                    <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500" value={localDates.joiningFrom} onChange={e => setLocalDates(prev => ({...prev, joiningFrom: e.target.value}))} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="w-12 text-sm font-medium text-slate-500">To:</label>
                    <input type="date" className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500" value={localDates.joiningTo} onChange={e => setLocalDates(prev => ({...prev, joiningTo: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={clearAll} className="px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors">Clear All</button>
                <button onClick={applyAndClose} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">Apply & Close</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const Modal = ({ title, onClose, children, maxWidth = 'max-w-2xl' }: any) => (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh] animate-in zoom-in-95`}>
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 rounded-t-lg">
          <h3 className="font-semibold text-lg text-slate-700">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );

  const CompetencyManager = () => {
    if (!selectedEmployee) return null;
    const [topicKey, subName] = selectedMetric.split(':');
    const sessions = selectedEmployee.metrics?.[topicKey]?.filter(s => s.name === subName) || [];
    const latest = sessions[0]; 
    
    return (
      <Modal title="Manage Competency Score" onClose={() => setActiveModal(null)} maxWidth="max-w-3xl">
        <div className="bg-slate-50 p-4 rounded border mb-6">
          <h4 className="text-blue-700 font-semibold mb-2">Update Score</h4>
          <p className="text-sm text-gray-600 mb-4">Employee: <strong>{selectedEmployee.name}</strong> | Topic: <strong>{selectedMetric}</strong></p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
               <label className="block text-xs font-bold mb-1">New Score (0-5)</label>
               <select className="w-full p-2 border rounded" value={newScore} onChange={e => setNewScore(Number(e.target.value))}>
                 {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
               </select>
            </div>
            <div>
               <label className="block text-xs font-bold mb-1">Evidence Type</label>
               <select className="w-full p-2 border rounded" value={newScoreType} onChange={e => setNewScoreType(e.target.value)}>
                 <option>Certificate</option>
                 <option>Assessment</option>
                 <option>Observation</option>
               </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => handleUpdateScore(selectedEmployee.id, topicKey, subName, newScore, newScoreType)} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700 transition-colors">
               <Save size={16} /> Update Score
            </button>
          </div>
        </div>
        
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2"><Clock size={16} /> History</h4>
          <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 sticky top-0">
                <tr><th className="p-2">Date</th><th className="p-2">Score</th><th className="p-2">Type</th><th className="p-2">Remarks</th></tr>
                </thead>
                <tbody>
                {latest?.history?.map((h, i) => (
                    <tr key={i} className="border-b">
                    <td className="p-2">{new Date(h.date).toLocaleDateString()}</td>
                    <td className="p-2"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">{h.score}</span></td>
                    <td className="p-2">{h.type}</td>
                    <td className="p-2 text-gray-500">{h.remarks}</td>
                    </tr>
                ))}
                {!latest?.history?.length && <tr><td colSpan={4} className="p-4 text-center text-gray-400">No history found</td></tr>}
                </tbody>
            </table>
          </div>
        </div>
      </Modal>
    );
  };

  const TrainingCard = () => {
    if (!selectedEmployee) return null;
    const summary = calculateRowSummary(selectedEmployee.metrics);

    return (
      <Modal title="Training Card" onClose={() => setActiveModal(null)} maxWidth="max-w-4xl">
        <div id="training-card-print-area" className="bg-white p-8 text-slate-800 font-sans relative">
           <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
              <span className="text-9xl font-bold -rotate-45">TRAINING</span>
           </div>

           <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-8 relative z-10">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">TRAINING RECORD</h1>
                <p className="text-slate-500 mt-1">Comprehensive training history & certifications</p>
              </div>
              <div className="text-right text-xs bg-slate-50 p-3 rounded border border-slate-100">
                <div className="mb-1"><span className="font-semibold text-slate-600">ID:</span> {selectedEmployee.employeeIdNum}</div>
                <div><span className="font-semibold text-slate-600">Generated:</span> {new Date().toLocaleDateString()}</div>
              </div>
           </div>

           <div className="grid grid-cols-[120px_1fr] gap-8 mb-8 bg-slate-50 p-6 rounded-lg border border-slate-200 relative z-10">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-2xl shadow-sm">
                {selectedEmployee.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
                 <div><span className="block text-xs font-bold text-slate-500 uppercase">Name</span> <span className="font-semibold text-slate-800 text-lg">{selectedEmployee.name}</span></div>
                 <div><span className="block text-xs font-bold text-slate-500 uppercase">Role</span> <span className="font-medium text-slate-800">{selectedEmployee.role}</span></div>
                 <div><span className="block text-xs font-bold text-slate-500 uppercase">Joined</span> <span className="font-medium text-slate-800">{selectedEmployee.joiningDate}</span></div>
                 <div><span className="block text-xs font-bold text-slate-500 uppercase">Status</span> <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${selectedEmployee.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedEmployee.status}</span></div>
              </div>
           </div>

           <div className="grid grid-cols-4 gap-4 mb-8 relative z-10">
              <div className="p-4 border rounded bg-white shadow-sm">
                 <div className="text-xs font-bold text-slate-500 uppercase mb-1">Total Sessions</div>
                 <div className="text-2xl font-bold text-indigo-600">{summary.sessions}</div>
              </div>
              <div className="p-4 border rounded bg-white shadow-sm">
                 <div className="text-xs font-bold text-slate-500 uppercase mb-1">Hours</div>
                 <div className="text-2xl font-bold text-indigo-600">{convertDecimalToHMS(summary.hours)}</div>
              </div>
              <div className="p-4 border rounded bg-white shadow-sm">
                 <div className="text-xs font-bold text-slate-500 uppercase mb-1">Avg Score</div>
                 <div className="text-2xl font-bold text-indigo-600">{summary.score}</div>
              </div>
              <div className="p-4 border rounded bg-white shadow-sm">
                 <div className="text-xs font-bold text-slate-500 uppercase mb-1">Status</div>
                 <div className={`text-lg font-bold ${summary.status === 'Attended' ? 'text-green-600' : 'text-orange-500'}`}>{summary.status}</div>
              </div>
           </div>

           <div className="mb-8 relative z-10">
             <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Briefcase size={20} className="text-indigo-500"/> Training History</h3>
             <table className="w-full text-sm border-collapse">
               <thead>
                 <tr className="bg-indigo-600 text-white">
                   <th className="p-3 text-left rounded-tl-lg">Topic</th>
                   <th className="p-3 text-left">Date</th>
                   <th className="p-3 text-left">Hrs</th>
                   <th className="p-3 text-left">Score</th>
                   <th className="p-3 text-left rounded-tr-lg">Status</th>
                 </tr>
               </thead>
               <tbody>
                  {Object.entries(selectedEmployee.metrics || ({} as EmployeeMetrics)).map(([topic, sessions]) => 
                     (sessions as TrainingSession[]).map((s, i) => (
                       <tr key={`${topic}-${i}`} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="p-3 font-medium">
                            <span className="block text-slate-800">{s.name}</span>
                            <span className="text-xs text-slate-500">{topic}</span>
                          </td>
                          <td className="p-3 text-slate-600">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="p-3 text-slate-600">{s.actualHours.toFixed(1)}</td>
                          <td className="p-3"><span className="font-bold text-indigo-600">{s.actualCompetency}</span><span className="text-slate-400 text-xs">/5</span></td>
                          <td className="p-3">
                             {s.attended ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Completed</span> : <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs">Pending</span>}
                          </td>
                       </tr>
                     ))
                  )}
               </tbody>
             </table>
           </div>

           <div className="grid grid-cols-2 gap-16 mt-12 pt-8 border-t relative z-10">
              <div>
                <div className="text-xs text-slate-500 mb-8">Employee Signature</div>
                <div className="border-b border-slate-300"></div>
                <div className="mt-2 font-semibold text-sm">{selectedEmployee.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-8">Manager Approval</div>
                <div className="border-b border-slate-300 relative">
                   <div className="absolute bottom-1 right-0 border-2 border-indigo-600 text-indigo-600 rounded px-2 py-1 text-[10px] font-bold rotate-[-12deg] opacity-70">
                      APPROVED
                   </div>
                </div>
                <div className="mt-2 font-semibold text-sm">HR Department</div>
              </div>
           </div>
        </div>
        <div className="p-4 bg-gray-50 flex justify-end gap-2 border-t">
           <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Close</button>
           <button onClick={() => downloadPDF('training-card-print-area', `Training_Card_${selectedEmployee.id}.pdf`)} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 flex items-center gap-2">
             <Download size={16} /> Download PDF
           </button>
        </div>
      </Modal>
    );
  };

  // --- MAIN RENDER ---

  const catalog = getCatalog();
  const sortedTopics = Object.keys(catalog).sort();

  return (
    <div className="min-h-screen font-sans text-slate-800 bg-[#f4f7f6] p-4 md:p-6">
      <div className="w-full mx-auto">

        {/* CONTROLS */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center justify-center">
            <div className="flex gap-2 flex-wrap justify-center items-center">
              {/* Heatmap Toggle */}
              <button 
                  onClick={() => setIsHeatmapMode(!isHeatmapMode)}
                  className={`px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2 transition-colors border ${isHeatmapMode ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  title={isHeatmapMode ? "Switch to Detail View" : "Switch to Heatmap View"}
              >
                  {isHeatmapMode ? <LayoutGrid size={16} /> : <List size={16} />}
                  <span className="hidden sm:inline">{isHeatmapMode ? 'Heatmap Active' : 'Detail View'}</span>
              </button>

              <button onClick={() => setActiveModal('hierarchyFilter')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2 transition-colors">
                <Users size={16} /> Hierarchy Filters
              </button>
              
              <button onClick={() => setActiveModal('topicFilter')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2 transition-colors">
                 <Filter size={16} /> Topic Filters
              </button>
              
              <button onClick={() => setActiveModal('periodFilter')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2 transition-colors">
                 <Calendar size={16} /> Period Filters
              </button>

              {/* Food Handler Filter & Stats */}
              <div className="flex items-center gap-4 border-l border-slate-200 pl-4 ml-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Food Handler:</label>
                  <select 
                    className="p-2 border rounded text-sm bg-gray-50 outline-none focus:border-blue-500 transition-all"
                    value={filters.foodHandler}
                    onChange={(e) => setFilters(prev => ({...prev, foodHandler: e.target.value}))}
                  >
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5" title="Total Filtered Employees">
                      <Users size={14} className="text-slate-400"/> 
                      <span className="font-bold">{viewData.length}</span>
                  </div>
                  <div className="w-px h-3 bg-slate-300"></div>
                  <div className="flex items-center gap-1.5 text-orange-600" title="Food Handlers">
                      <Utensils size={14} /> 
                      <span className="font-bold">{fhCount}</span>
                  </div>
                  <div className="w-px h-3 bg-slate-300"></div>
                  <div className="flex items-center gap-1.5 text-blue-600" title="Non-Food Handlers">
                      <User size={14} /> 
                      <span className="font-bold">{nonFhCount}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-l pl-4 ml-2">
                 <label className="text-xs font-bold text-gray-500 uppercase">Status:</label>
                 <select 
                    className="p-2 border rounded text-sm bg-gray-50"
                    value={filters.attendanceStatus}
                    onChange={(e) => setFilters(prev => ({...prev, attendanceStatus: e.target.value}))}
                 >
                   <option value="">All</option>
                   <option value="attended">Attended</option>
                   <option value="partially">Partially</option>
                   <option value="not_attended">Not Attended</option>
                 </select>
              </div>

            </div>

            <div className="flex-grow"></div>

            <div className="flex gap-2 items-center">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search name / ID..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-48 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all placeholder:text-slate-300"
                />
                {filters.searchTerm && (
                  <button onClick={() => setFilters(prev => ({ ...prev, searchTerm: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"><X size={14} /></button>
                )}
              </div>
              <div className="text-sm text-gray-500 mr-2 hidden lg:block">
                 <span className="font-bold">{paginatedData.length}</span> Visible
              </div>
              <button onClick={() => {
                setFilters({
                  employees: [],
                  hierarchy: { region: [], unit: [], department: [], role: [], category: [] },
                  topics: { topic: [], subtopic: [], proficiency: '' },
                  dates: { trainingFrom: '', trainingTo: '', joiningFrom: '', joiningTo: '' },
                  foodHandler: '',
                  attendanceStatus: '',
                  searchTerm: ''
                });
                setLastRefreshed(new Date());
              }} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded shadow-sm transition-colors" title="Refresh & Clear Filters">
                 <RefreshCw size={16} />
              </button>
              <button onClick={() => setActiveModal('download')} className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded shadow-sm text-sm font-medium flex items-center gap-2 transition-colors">
                 <Download size={16} /> Download
              </button>
            </div>
        </div>

        {/* MOBILE CARD VIEW (Visible only on small screens) */}
        <div className="block md:hidden space-y-4 mb-8">
            {paginatedData.map(emp => {
               const summary = calculateRowSummary(emp.metrics);
               const isExpanded = mobileExpandedEmp === emp.id;
               
               return (
                   <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                       <div 
                         className="p-4 flex items-start justify-between cursor-pointer active:bg-slate-50"
                         onClick={() => setMobileExpandedEmp(isExpanded ? null : emp.id)}
                       >
                           <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-slate-800">{emp.name}</h3>
                                  {((emp.foodHandler || '').toLowerCase() === 'yes' || FOOD_HANDLER_ROLES.includes(emp.role || '')) && <span className="text-[8px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200">FH</span>}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold text-white ${emp.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}>{emp.status}</span>
                               </div>
                               <p className="text-xs text-slate-500">{emp.role} • {emp.employeeIdNum}{emp.category ? ` • ${emp.category}` : ''}</p>
                           </div>
                           <div className="flex items-center gap-2">
                               <div className="flex flex-col items-end">
                                   <span className={`text-[10px] font-black uppercase ${summary.statusClass.replace('bg-', 'text-')}`}>{summary.status}</span>
                                   <span className="text-[10px] text-slate-400 font-bold">{summary.score} Avg</span>
                               </div>
                               {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                           </div>
                       </div>
                       
                       {isExpanded && (
                           <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4 animate-in slide-in-from-top-2">
                               <button 
                                 onClick={() => { setSelectedEmployee(emp); setActiveModal('card'); }} 
                                 className="w-full py-2 bg-white border border-slate-200 text-blue-600 font-bold text-xs rounded-lg shadow-sm mb-2"
                               >
                                  View Full Training Card
                               </button>

                               {sortedTopics.map(topic => {
                                  if (!catalog[topic]) return null;
                                  return (
                                    <div key={topic} className="space-y-2">
                                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{topic}</h4>
                                       <div className="grid grid-cols-1 gap-2">
                                          {catalog[topic].map(sub => {
                                             const session = emp.metrics?.[topic]?.find(s => s.name === sub);
                                             if (!session) return null;
                                             
                                             return (
                                                <div key={sub} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                                                   <span className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{sub}</span>
                                                   <div className="flex items-center gap-2">
                                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${session.attended ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                         {session.attended ? 'Done' : 'Miss'}
                                                      </span>
                                                      <span 
                                                        onClick={(e) => { e.stopPropagation(); openCompetencyManager(emp, `${topic}:${sub}`); }}
                                                        className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold text-white cursor-pointer ${getHeatmapColor(session.actualCompetency)}`}
                                                      >
                                                         {session.actualCompetency}
                                                      </span>
                                                   </div>
                                                </div>
                                             );
                                          })}
                                       </div>
                                    </div>
                                  );
                               })}
                           </div>
                       )}
                   </div>
               );
            })}
        </div>

        {/* TABLE (Hidden on mobile, visible on tablet+) */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead className="bg-slate-700 text-white text-sm uppercase sticky top-0 z-20">
                <tr>
                   <th rowSpan={2} className="p-4 text-left min-w-[300px] sticky left-0 bg-slate-700 z-30 border-r border-slate-600 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">
                     Staff Details
                   </th>
                   {sortedTopics.map(topic => (
                     <th 
                        key={topic} 
                        colSpan={expandedCols.has(topic) ? catalog[topic].length : 1} 
                        className="p-3 text-center border-r border-slate-600 cursor-pointer hover:bg-slate-600 transition-colors group select-none"
                        onClick={() => {
                          const newSet = new Set(expandedCols);
                          if(newSet.has(topic)) newSet.delete(topic); else newSet.add(topic);
                          setExpandedCols(newSet);
                        }}
                      >
                       <div className="flex items-center justify-center gap-2">
                         {topic}
                         {expandedCols.has(topic) ? <MinusCircle size={14}/> : <PlusCircle size={14}/>}
                       </div>
                     </th>
                   ))}
                </tr>
                <tr>
                   {sortedTopics.map(topic => {
                     if(!expandedCols.has(topic)) return <th key={`${topic}-sum`} className="p-2 bg-slate-800 border-r border-slate-600 text-xs min-w-[180px]">Summary</th>;
                     return catalog[topic].map(sub => (
                       <th key={sub} className="p-2 bg-slate-800 border-r border-slate-600 text-xs font-normal min-w-[200px] normal-case">{sub}</th>
                     ));
                   })}
                </tr>
              </thead>
              <tbody className="text-sm">
                {paginatedData.map((emp) => {
                  const summary = calculateRowSummary(emp.metrics);
                  const isFH = FOOD_HANDLER_ROLES.includes(emp.role || '');

                  const isFHSynced = (emp.foodHandler || '').toLowerCase() === 'yes';
                  const pathDisplay = (() => {
                    if (!emp.path) return '';
                    const parts = emp.path.filter((p: any) => p !== 'Corporate HQ' && p);
                    if (currentScope === 'unit' || currentScope === 'department') {
                      const regPart = parts.length >= 2 ? parts[0] : '';
                      const unitPart = parts.length >= 2 ? parts[1] : parts[0] || '';
                      return [regPart, unitPart].filter(Boolean).join(' > ');
                    }
                    if (currentScope === 'regional') {
                      return parts[0] || '';
                    }
                    return parts.join(' > ');
                  })();

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
                      <td className="p-0 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                         <div className="p-4">
                           <div className="flex items-center gap-2 mb-2">
                              <span className="font-bold text-blue-700 text-base">{emp.name}</span>
                              {(isFH || isFHSynced) && <span title="Food Handler" className="text-[8px] font-bold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200">FH</span>}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold text-white ${emp.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}>{emp.status}</span>
                              <button onClick={() => { setSelectedEmployee(emp); setActiveModal('card'); }} className="ml-auto bg-blue-100 text-blue-700 px-2 py-1 rounded-xs hover:bg-blue-200 transition-colors">View Card</button>
                           </div>
                           <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                              <span>{emp.employeeIdNum}</span>
                              {emp.category && <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">{emp.category}</span>}
                           </div>
                           {pathDisplay && <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1"><MapPin size={10} className="text-slate-300" />{pathDisplay}</div>}
                           <div className="text-xs text-gray-600 border-t pt-2 mt-1 leading-relaxed">
                              <span className="font-semibold">Role:</span> {emp.role} | <span className="font-semibold">Joined:</span> {emp.joiningDate}
                           </div>
                           <div className="flex gap-2 mt-2 text-xs font-medium flex-wrap">
                              <span className={`px-2 py-1 rounded text-white ${summary.statusClass}`}>{summary.status}</span>
                              <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">Sess: {summary.sessions}</span>
                              <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">Hrs: {summary.hours.toFixed(1)}</span>
                           </div>
                         </div>
                      </td>

                      {sortedTopics.map(topic => {
                         const subtopics = catalog[topic];
                         const isExpanded = expandedCols.has(topic);
                         
                         if (!isExpanded) {
                           const topicSessions = emp.metrics?.[topic] || [];
                           
                           // --- HEATMAP MODE CELL (COLLAPSED) ---
                           if (isHeatmapMode) {
                              const avgScore = topicSessions.length > 0 
                                ? topicSessions.reduce((acc, s) => acc + s.actualCompetency, 0) / topicSessions.length 
                                : 0;
                              const displayScore = avgScore > 0 ? avgScore.toFixed(1) : '-';
                              const colorClass = getHeatmapColor(avgScore);
                              
                              return (
                                <td key={topic} className={`p-0 border-r border-slate-200 text-center align-middle ${colorClass} hover:opacity-90 transition-opacity`}>
                                   <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                                      <span className="text-lg font-black">{displayScore}</span>
                                      <span className="text-[10px] font-medium uppercase opacity-80">Avg</span>
                                   </div>
                                </td>
                              );
                           }

                           // --- STANDARD MODE CELL (COLLAPSED) ---
                           const attended = topicSessions.filter(s => s.attended).length;
                           const total = subtopics.length; 
                           const statusColor = attended === total ? 'text-green-600' : attended > 0 ? 'text-orange-500' : 'text-red-500';
                           const statusIcon = attended === total ? CheckCircle : attended > 0 ? AlertTriangle : XCircle;
                           const Icon = statusIcon;
                           
                           const actualCompSum = topicSessions.reduce((sum, s) => sum + s.actualCompetency, 0);
                           const targetCompSum = topicSessions.reduce((sum, s) => sum + s.targetCompetency, 0);
                           const pct = targetCompSum ? Math.round((actualCompSum / targetCompSum) * 100) : 0;

                           return (
                             <td key={topic} className="p-3 border-r border-slate-200 align-top bg-slate-50/50">
                                <div className={`flex items-center gap-1 mb-2 font-bold ${statusColor}`}>
                                   <Icon size={14} /> <span>{attended === total ? 'Attended' : attended > 0 ? 'Partial' : 'Missed'}</span>
                                </div>
                                <div className="text-xs text-gray-600 space-y-1 mb-3">
                                   <div className="flex items-center gap-2"><CheckCircle size={12}/> {attended} / {total} Topics</div>
                                   <div className="flex items-center gap-2"><Clock size={12}/> {topicSessions.reduce((acc,s)=>acc+s.actualHours,0).toFixed(1)} Hrs</div>
                                </div>
                                <div className="border-t pt-2">
                                  <div className="flex justify-between text-xs mb-1 font-semibold"><span>Competency</span> <span>{pct}%</span></div>
                                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                     <div style={{width: `${pct}%`}} className="h-full bg-blue-500"></div>
                                  </div>
                                </div>
                             </td>
                           );
                         }

                         // --- EXPANDED CELLS ---
                         return subtopics.map(sub => {
                           const session = emp.metrics?.[topic]?.find(s => s.name === sub);
                           
                           // --- HEATMAP MODE CELL (EXPANDED) ---
                           if (isHeatmapMode) {
                              const score = session ? session.actualCompetency : 0;
                              const colorClass = getHeatmapColor(score);
                              return (
                                <td key={sub} className={`p-0 border-r border-slate-200 text-center align-middle ${colorClass} hover:opacity-90 cursor-pointer`} onClick={() => session && openCompetencyManager(emp, `${topic}:${sub}`)}>
                                   <div className="flex items-center justify-center h-full min-h-[100px]">
                                      <span className="text-2xl font-black">{score > 0 ? score : '-'}</span>
                                   </div>
                                </td>
                              );
                           }

                           // --- STANDARD MODE CELL (EXPANDED) ---
                           if(!session) return <td key={sub} className="p-3 border-r border-slate-200 text-center text-gray-400 text-xs">NA</td>;
                           
                           const pct = session.targetCompetency ? Math.round((session.actualCompetency / session.targetCompetency) * 100) : 0;

                           return (
                             <td key={sub} className="p-3 border-r border-slate-200 align-top text-[#475569]">
                                <div className="space-y-1 mb-3">
                                  {session.attended ? (
                                    <>
                                      <div className="text-[11px] font-bold">
                                        Attended: <span className="text-slate-900 font-black">{new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                      </div>
                                      <div className="text-[10px] font-black text-emerald-600">(Attended)</div>
                                      <div className="text-[10px] font-bold mt-2">
                                        Hours: <span className="text-slate-900 font-black">{convertDecimalToHMS(session.actualHours)}</span> <span className="text-slate-300 mx-1">|</span> Sess: <span className="text-blue-600 font-black">1</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">(Not Attended)</div>
                                  )}
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100">
                                   <div className="text-[11px] font-black text-slate-700 uppercase mb-2">Competency</div>
                                   <div className="flex items-center justify-between gap-4 mb-3">
                                      <div className="flex items-center gap-1.5">
                                         <span className="text-[10px] font-bold text-slate-400">Should:</span>
                                         <span className="text-sm font-black text-slate-800">{session.targetCompetency}</span>
                                         <button onClick={()=>setActiveModal('rubric')} className="text-blue-400 hover:text-blue-600 transition-colors">
                                            <Info size={12} strokeWidth={2.5}/>
                                         </button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         <span className="text-[10px] font-bold text-slate-400">Actual:</span>
                                         <button 
                                            onClick={() => openCompetencyManager(emp, `${topic}:${sub}`)}
                                            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-xs font-black text-slate-800 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                                         >
                                            {session.actualCompetency || 0}
                                         </button>
                                      </div>
                                   </div>

                                   {/* Progress Bar with Internal Percentage */}
                                   <div className="relative w-full h-5 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                                      <div 
                                        className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-1000 flex items-center justify-center" 
                                        style={{width: `${pct}%`}}
                                      >
                                      </div>
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[10px] font-black text-white mix-blend-difference drop-shadow-sm">{pct}%</span>
                                      </div>
                                   </div>
                                </div>
                             </td>
                           );
                         });
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        <div className="mt-6 flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
           <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Rows per page:</span>
              <select 
                 className="border rounded p-1" 
                 value={pagination.rowsPerPage}
                 onChange={(e) => setPagination({ ...pagination, rowsPerPage: Number(e.target.value), currentPage: 1 })}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
           </div>
           <div className="flex items-center gap-4">
              <button 
                disabled={pagination.currentPage === 1}
                onClick={() => setPagination(p => ({...p, currentPage: p.currentPage - 1}))}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              ><ChevronLeft size={16}/></button>
              <span className="text-sm font-medium">Page {pagination.currentPage} of {totalPages}</span>
              <button 
                disabled={pagination.currentPage === totalPages}
                onClick={() => setPagination(p => ({...p, currentPage: p.currentPage + 1}))}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50"
              ><ChevronRight size={16}/></button>
           </div>
        </div>

      </div>

      {/* --- MODALS --- */}
      
      {activeModal === 'competency' && <CompetencyManager />}
      {activeModal === 'card' && <TrainingCard />}

      {activeModal === 'download' && (
         <Modal title="Download Options" onClose={() => setActiveModal(null)} maxWidth="max-w-md">
            <div className="space-y-3">
               <button onClick={() => { exportAttendanceExcel(); setActiveModal(null); }} className="w-full text-left p-4 border rounded hover:bg-slate-50 flex items-center gap-3">
                  <FileText className="text-green-600"/> 
                  <div><div className="font-semibold">Attendance Dates Report</div><div className="text-xs text-gray-500">Single sheet with attendance dates per module</div></div>
               </button>
               <button onClick={() => { exportSummaryExcel(); setActiveModal(null); }} className="w-full text-left p-4 border rounded hover:bg-slate-50 flex items-center gap-3">
                  <Briefcase className="text-blue-600"/> 
                  <div><div className="font-semibold">Competency Summary</div><div className="text-xs text-gray-500">Single sheet with competency scores by topic</div></div>
               </button>
               <div className="border-t pt-3 mt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Multi-Sheet Reports</p>
                  <div className="space-y-2">
                     <button onClick={() => { exportUnitWiseExcel(); setActiveModal(null); }} className="w-full text-left p-4 border rounded hover:bg-slate-50 flex items-center gap-3">
                        <Building className="text-emerald-600"/> 
                        <div><div className="font-semibold">Unit Wise</div><div className="text-xs text-gray-500">Multiple sheets — one per unit name</div></div>
                     </button>
                     <button onClick={() => { exportDepartmentWiseExcel(); setActiveModal(null); }} className="w-full text-left p-4 border rounded hover:bg-slate-50 flex items-center gap-3">
                        <MapPin className="text-purple-600"/> 
                        <div><div className="font-semibold">Department Wise</div><div className="text-xs text-gray-500">Multiple sheets — one per department name</div></div>
                     </button>
                     <button onClick={() => { exportTopicWiseExcel(); setActiveModal(null); }} className="w-full text-left p-4 border rounded hover:bg-slate-50 flex items-center gap-3">
                        <Award className="text-amber-600"/> 
                        <div><div className="font-semibold">Training Topic Wise</div><div className="text-xs text-gray-500">Multiple sheets — one per training topic name</div></div>
                     </button>
                  </div>
               </div>
            </div>
         </Modal>
      )}

      {activeModal === 'hierarchyFilter' && (
         <Modal title="Hierarchy Filters" onClose={() => setActiveModal(null)} maxWidth="max-w-2xl">
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MultiSelectDropdown label="Region" options={hierarchyOptions.regions} selected={filters.hierarchy.region} onChange={(vals) => setFilters(prev => ({ ...prev, hierarchy: { ...prev.hierarchy, region: vals } }))} />
                  <MultiSelectDropdown label="Unit" options={hierarchyOptions.units} selected={filters.hierarchy.unit} onChange={(vals) => setFilters(prev => ({ ...prev, hierarchy: { ...prev.hierarchy, unit: vals } }))} />
                  <MultiSelectDropdown label="Department" options={hierarchyOptions.departments} selected={filters.hierarchy.department} onChange={(vals) => setFilters(prev => ({ ...prev, hierarchy: { ...prev.hierarchy, department: vals } }))} />
                  <MultiSelectDropdown label="Role" options={hierarchyOptions.roles} selected={filters.hierarchy.role} onChange={(vals) => setFilters(prev => ({ ...prev, hierarchy: { ...prev.hierarchy, role: vals } }))} />
               </div>

               <MultiSelectDropdown label="Staff Category" options={hierarchyOptions.categories} selected={filters.hierarchy.category} onChange={(vals) => setFilters(prev => ({ ...prev, hierarchy: { ...prev.hierarchy, category: vals } }))} />
               
               <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                     onClick={() => setFilters(prev => ({ ...prev, hierarchy: { region: [], unit: [], department: [], role: [], category: [] } }))}
                     className="px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
                  >
                     Clear
                  </button>
                  <button 
                     onClick={() => setActiveModal(null)}
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                     Apply & Close
                  </button>
               </div>
            </div>
         </Modal>
      )}

      {/* NEW TOPIC FILTER MODAL */}
      {activeModal === 'topicFilter' && (
         <Modal title="Topic Filters" onClose={() => setActiveModal(null)} maxWidth="max-w-2xl">
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MultiSelectDropdown
                    label="Topic"
                    options={Object.keys(trainingCatalog)}
                    selected={filters.topics.topic}
                    onChange={(vals) => setFilters(prev => ({ ...prev, topics: { ...prev.topics, topic: vals, subtopic: prev.topics.subtopic.filter(s => vals.some(t => trainingCatalog[t]?.includes(s))) } }))}
                    placeholder="All Topics"
                  />
                  <MultiSelectDropdown
                    label="Sub-Topic"
                    options={filters.topics.topic.length > 0 ? filters.topics.topic.flatMap(t => trainingCatalog[t] || []) : Object.values(trainingCatalog).flat()}
                    selected={filters.topics.subtopic}
                    onChange={(vals) => setFilters(prev => ({ ...prev, topics: { ...prev.topics, subtopic: vals } }))}
                    placeholder="All Sub-Topics"
                  />
               </div>

               <div className="space-y-1">
                   <label className="text-sm font-medium text-slate-700 mb-1">Proficiency Target:</label>
                   <select 
                      className="w-full border-slate-200 rounded-lg p-2.5 text-sm bg-white"
                      value={filters.topics.proficiency}
                      onChange={(e) => setFilters(prev => ({ 
                         ...prev, 
                         topics: { ...prev.topics, proficiency: e.target.value }
                      }))}
                   >
                      <option value="">-- Select --</option>
                      <option value="1">Level 1 - Beginner</option>
                      <option value="2">Level 2 - Intermediate</option>
                      <option value="3">Level 3 - Advanced</option>
                      <option value="4">Level 4 - Expert</option>
                      <option value="5">Level 5 - Master</option>
                   </select>
               </div>
               
               <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button 
                     onClick={() => setFilters(prev => ({ ...prev, topics: { topic: [], subtopic: [], proficiency: '' } }))}
                     className="px-4 py-2 bg-slate-500 text-white rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"
                  >
                     Clear
                  </button>
                  <button 
                     onClick={() => setActiveModal(null)}
                     className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                     Apply & Close
                  </button>
               </div>
            </div>
         </Modal>
      )}

      {/* NEW PERIOD FILTER MODAL */}
      {activeModal === 'periodFilter' && <PeriodFilterModal />}

    </div>
  );
}
