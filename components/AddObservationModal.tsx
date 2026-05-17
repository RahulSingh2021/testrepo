"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, X, Search, ChevronDown, MapPin, MessageSquare, Camera,
  Image as ImageLucide, Upload, Trash2, Edit3, Check, CheckCircle2,
  Target, Save, Send, History, Lock, Unlock, Images, AlertTriangle, Clipboard, RotateCcw,
  BookOpen, Layers, Clock, FileText
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { PhotoEditor, CollageStudio, AuditQuestionOption } from './ComplaintFormModal';
import { compressImage } from '@/utils/imageCompression';
import InlineRewriteButton from './InlineRewriteButton';

import { handlePasteImages, pasteFromClipboard } from '@/utils/clipboardImages';

const questionStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  compliant: { label: 'PASS', bg: '#10b981', text: '#ffffff' },
  'non-compliant': { label: 'FAIL', bg: '#ef4444', text: '#ffffff' },
  partial: { label: 'PART', bg: '#f59e0b', text: '#ffffff' },
  na: { label: 'N/A', bg: '#9ca3af', text: '#ffffff' },
};

const getColorStyle = (hex: string): { bg: string; text: string; border: string } => {
  if (!hex) return { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' };
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { bg: `rgba(${r},${g},${b},0.12)`, text: hex, border: `rgba(${r},${g},${b},0.35)` };
};

const getSelectedColorStyle = (hex: string): { bg: string; text: string; border: string } => {
  if (!hex) return { bg: '#664DE5', text: '#ffffff', border: '#664DE5' };
  return { bg: hex, text: '#ffffff', border: hex };
};

type PopupEntry = {
  id: string;
  questionId: string;
  questionText: string;
  sectionTitle: string;
  location: string;
  answer: string;
  answerColor: string;
  commentText: string;
  commentImages: string[];
  selectedResponseIndex?: number;
  responses?: { text: string; score: string; color: string }[];
  isRepeat?: boolean;
  fromMultiSelect?: boolean;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
};

type LiveDraft = {
  id: string;
  commentText: string;
  commentImages: string[];
  imageSyncStatus?: Record<string, boolean>;
  location: string;
  questionId: string;
  questionText: string;
  sectionTitle: string;
  createdAt: number;
  isOfflineQueued?: boolean;
  unitId?: string;
  checklistId?: string;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
};

export interface ObservationPayload {
  id: string;
  questionId: string;
  title: string;
  questionText: string;
  selectedAnswer: string;
  observationText: string;
  sop: string;
  severity: 'MINOR';
  level: 'L1';
  mainKitchen: string;
  area: string;
  hierarchy: string;
  closureComments: null;
  status: 'OPEN';
  duration: string;
  followUpStatus: 'NOT DONE';
  followUpCount: number;
  followUpDate: string;
  reportedBy: string;
  lastUpdate: string;
  createdDate: string;
  thumbnail: string;
  allEvidence: string[];
  isStarred: boolean;
  people: { name: string; impact: number }[];
  assets: { name: string; impact: number }[];
  categories: { name: string; impact: number }[];
  tracking: { id: string; label: string; user: string; timestamp: string; comments: string }[];
  isAuditSourced: boolean;
  departmentName: string;
  unitName: string;
  location: string;
  sectionTitle?: string;
  checklistName?: string;
  responsibility?: string[];
  isRepeat?: boolean;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
  resourceRequired?: boolean;
  repeatOriginalDate?: string;
  repeatTrail?: { date: string; comment: string }[];
  repeatSourceId?: string;
  selectedResponseIndex?: number | null;
}

export interface DraftObservationPayload {
  questionId: string;
  questionText: string;
  sectionTitle: string;
  selectedAnswer: string;
  observationText: string;
  images: string[];
  location: string;
  isRepeat?: boolean;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
}

export interface EditObservationData {
  questionId: string;
  location: string;
  commentText: string;
  commentImages: string[];
  selectedAnswerIndex: number | null;
  entryId: string;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
  sop?: string;
  subSop?: string;
  responsibility?: string;
}

export interface RepeatObservationData {
  questionId: string;
  questionText: string;
  sectionTitle: string;
  location: string;
  comment: string;
  images: string[];
  originalDate: string;
  repeatTrail: { date: string; comment: string }[];
  sourceEntryId?: string;
  checklistName?: string;
  selectedAnswer?: string;
  selectedAnswerIndex?: number | null;
}

export interface AddObservationModalProps {
  questions: AuditQuestionOption[];
  locationOptions?: string[];
  auditLocationName?: string;
  auditUnitId?: string;
  auditUnitName?: string;
  checklistId?: string;
  lockedLocation?: string | null;
  onLockLocation?: (loc: string) => void;
  onUnlockLocation?: () => void;
  departmentLocations?: Record<string, string[]>;
  combinedLocations?: string[];
  onClose: () => void;
  onSave: (observations: ObservationPayload[]) => void;
  onSaveAsDraft?: (observations: DraftObservationPayload[]) => void;
  onAnswerSelect?: (questionId: string, responseIndex: number, response: { text: string; score: string; color: string }) => void;
  questionHistoryMap?: Record<string, { date: string; status: 'compliant' | 'non-compliant' | 'partial' | 'na' }[]>;
  currentAnswers?: Record<string, { selectedIndex: number | null; marks: number | null }>;
  hideAnswerSet?: boolean;
  editMode?: boolean;
  editData?: EditObservationData;
  hideSaveAsDraft?: boolean;
  repeatData?: RepeatObservationData;
}

export default function AddObservationModal({
  questions,
  locationOptions,
  auditLocationName,
  auditUnitId,
  auditUnitName,
  checklistId,
  lockedLocation,
  onLockLocation,
  onUnlockLocation,
  departmentLocations,
  combinedLocations,
  onClose,
  onSave,
  onSaveAsDraft,
  onAnswerSelect,
  questionHistoryMap,
  currentAnswers,
  hideAnswerSet,
  editMode,
  editData,
  hideSaveAsDraft,
  repeatData,
}: AddObservationModalProps) {
  const isRepeatMode = !!repeatData;
  const [selectedLocation, setSelectedLocation] = useState(repeatData?.location || editData?.location || lockedLocation || auditLocationName || '');
  const [selectedSop, setSelectedSop] = useState(() => {
    if (editMode) return editData?.sop || '';
    try { const v = localStorage.getItem('haccp_modal_sop_val'); return (localStorage.getItem('haccp_modal_sop_locked') === '1' && v) ? v : ''; } catch { return ''; }
  });
  const [selectedSubSop, setSelectedSubSop] = useState(() => {
    if (editMode) return editData?.subSop || '';
    try { const v = localStorage.getItem('haccp_modal_subsop_val'); return (localStorage.getItem('haccp_modal_subsop_locked') === '1' && v) ? v : ''; } catch { return ''; }
  });
  const [sopLocked, setSopLocked] = useState(() => {
    if (editMode) return false;
    try { return localStorage.getItem('haccp_modal_sop_locked') === '1'; } catch { return false; }
  });
  const [subSopLocked, setSubSopLocked] = useState(() => {
    if (editMode) return false;
    try { return localStorage.getItem('haccp_modal_subsop_locked') === '1'; } catch { return false; }
  });
  const [selectedResponsibility, setSelectedResponsibility] = useState(() => {
    if (editMode) return editData?.responsibility || '';
    try { const v = localStorage.getItem('haccp_modal_resp_val'); return (localStorage.getItem('haccp_modal_resp_locked') === '1' && v) ? v : ''; } catch { return ''; }
  });
  const [responsibilityLocked, setResponsibilityLocked] = useState(() => {
    if (editMode) return false;
    try { return localStorage.getItem('haccp_modal_resp_locked') === '1'; } catch { return false; }
  });
  const [showSopDropdown, setShowSopDropdown] = useState(false);
  const [showSubSopDropdown, setShowSubSopDropdown] = useState(false);
  const [sopSearch, setSopSearch] = useState('');
  const [subSopSearch, setSubSopSearch] = useState('');
  const isLocationLocked = !!lockedLocation && !editMode;
  const [searchQ, setSearchQ] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(() => {
    if (repeatData?.questionId) return [repeatData.questionId];
    if (editData?.questionId) return [editData.questionId];
    if (!editMode) {
      try {
        const locked = localStorage.getItem('haccp_modal_q_locked') === '1';
        if (locked) return JSON.parse(localStorage.getItem('haccp_modal_q_ids') || '[]');
      } catch {}
    }
    return [];
  });
  const [commentText, setCommentText] = useState(repeatData?.comment || editData?.commentText || '');
  const [commentImages, setCommentImages] = useState<string[]>(repeatData?.images ? [...repeatData.images] : editData?.commentImages ? [...editData.commentImages] : []);
  const repeatImageCount = useRef(repeatData?.images?.length || 0);
  const [editingImage, setEditingImage] = useState<{ url: string; callback: (edited: string) => void } | null>(null);
  const [collageData, setCollageData] = useState<{ images: string[]; callback: (collageUrl: string, finalImgs: string[]) => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedManagementTag, setSelectedManagementTag] = useState<'management-focus' | 'easy-impactful' | 'ongoing' | undefined>(editData?.managementTag || undefined);
  const [resourceRequired, setResourceRequired] = useState<boolean>((editData as any)?.resourceRequired || false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLocDropdown, setShowLocDropdown] = useState(false);
  const [locSearch, setLocSearch] = useState('');
  const [showRespDropdown, setShowRespDropdown] = useState(false);
  const [respSearch, setRespSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [questionLocked, setQuestionLocked] = useState<boolean>(() => {
    if (editMode) return false;
    try { return localStorage.getItem('haccp_modal_q_locked') === '1'; } catch { return false; }
  });
  const [completedEntries, setCompletedEntries] = useState<PopupEntry[]>([]);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [uploadingForEntryId, setUploadingForEntryId] = useState<string | null>(null);
  const [entryLocDropOpen, setEntryLocDropOpen] = useState<string | null>(null);
  const [entryLocSearch, setEntryLocSearch] = useState('');
  const [entryQDropOpen, setEntryQDropOpen] = useState<string | null>(null);
  const [entryQSearch, setEntryQSearch] = useState('');
  const [isMainDragging, setIsMainDragging] = useState(false);
  const [isDragEntryId, setIsDragEntryId] = useState<string | null>(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(repeatData?.selectedAnswerIndex ?? editData?.selectedAnswerIndex ?? null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [localAnswerOverrides, setLocalAnswerOverrides] = useState<Record<string, { selectedIndex: number | null; marks: number | null }>>({});
  const isInScope = useCallback((d: LiveDraft): boolean => {
    const cMatch = checklistId ? (d.checklistId === checklistId) : !d.checklistId;
    const uMatch = auditUnitId ? (d.unitId === auditUnitId) : !d.unitId;
    return cMatch && uMatch;
  }, [checklistId, auditUnitId]);

  const readScopedDrafts = useCallback((): LiveDraft[] => {
    try {
      const all: LiveDraft[] = JSON.parse(localStorage.getItem('haccp_obs_live_drafts') || '[]');
      return all.filter(isInScope);
    } catch { return []; }
  }, [isInScope]);

  const writeScopedDrafts = useCallback((scopedDrafts: LiveDraft[]) => {
    try {
      const all: LiveDraft[] = JSON.parse(localStorage.getItem('haccp_obs_live_drafts') || '[]');
      const otherScope = all.filter(d => !isInScope(d));
      const tagged = scopedDrafts.map(d => ({
        ...d,
        checklistId: checklistId || d.checklistId,
        unitId: auditUnitId || d.unitId,
      }));
      localStorage.setItem('haccp_obs_live_drafts', JSON.stringify([...otherScope, ...tagged]));
    } catch {}
  }, [checklistId, auditUnitId, isInScope]);
  const mergedAnswers = useMemo(() => ({ ...currentAnswers, ...localAnswerOverrides }), [currentAnswers, localAnswerOverrides]);
  React.useEffect(() => {
    if (!editMode || !editData) return;
    if (selectedQuestionIds.length === 0) return;
    const qId = selectedQuestionIds[0];
    const q = questions.find(qq => qq.id === qId);
    if (!q) return;
    if (!editData.sop && !editData.subSop) {
      const sec = (q.sectionTitle || '').trim();
      if (sec) {
        const parts = sec.split(' > ');
        const sopName = parts[0].trim();
        const subSopName = parts.slice(1).join(' > ').trim();
        if (sopName && !selectedSop) setSelectedSop(sopName);
        if (subSopName && !selectedSubSop) setSelectedSubSop(subSopName);
      }
    }
    if (!editData.responsibility && !selectedResponsibility) {
      if (q.responsibility && Array.isArray(q.responsibility) && q.responsibility.length > 0) {
        setSelectedResponsibility(q.responsibility[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (editMode) return;
    try {
      if (questionLocked && selectedQuestionIds.length > 0) {
        localStorage.setItem('haccp_modal_q_locked', '1');
        localStorage.setItem('haccp_modal_q_ids', JSON.stringify(selectedQuestionIds));
      } else {
        localStorage.removeItem('haccp_modal_q_locked');
        localStorage.removeItem('haccp_modal_q_ids');
      }
    } catch {}
  }, [questionLocked, selectedQuestionIds, editMode]);
  React.useEffect(() => {
    if (editMode) return;
    try {
      if (sopLocked && selectedSop) {
        localStorage.setItem('haccp_modal_sop_locked', '1');
        localStorage.setItem('haccp_modal_sop_val', selectedSop);
      } else {
        localStorage.removeItem('haccp_modal_sop_locked');
        localStorage.removeItem('haccp_modal_sop_val');
      }
      if (subSopLocked && selectedSubSop) {
        localStorage.setItem('haccp_modal_subsop_locked', '1');
        localStorage.setItem('haccp_modal_subsop_val', selectedSubSop);
      } else {
        localStorage.removeItem('haccp_modal_subsop_locked');
        localStorage.removeItem('haccp_modal_subsop_val');
      }
      if (responsibilityLocked && selectedResponsibility) {
        localStorage.setItem('haccp_modal_resp_locked', '1');
        localStorage.setItem('haccp_modal_resp_val', selectedResponsibility);
      } else {
        localStorage.removeItem('haccp_modal_resp_locked');
        localStorage.removeItem('haccp_modal_resp_val');
      }
    } catch {}
  }, [sopLocked, selectedSop, subSopLocked, selectedSubSop, responsibilityLocked, selectedResponsibility, editMode]);
  const mainDragCounter = useRef(0);
  const entryDragCounter = useRef(0);
  const updateEntry = (id: string, updates: Partial<PopupEntry>) => setCompletedEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const entryCameraRef = useRef<HTMLInputElement>(null);
  const entryGalleryRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locDropdownRef = useRef<HTMLDivElement>(null);
  const respDropdownRef = useRef<HTMLDivElement>(null);
  const sopDropdownRef = useRef<HTMLDivElement>(null);
  const subSopDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (locDropdownRef.current && !locDropdownRef.current.contains(e.target as Node)) setShowLocDropdown(false);
      if (respDropdownRef.current && !respDropdownRef.current.contains(e.target as Node)) setShowRespDropdown(false);
      if (sopDropdownRef.current && !sopDropdownRef.current.contains(e.target as Node)) setShowSopDropdown(false);
      if (subSopDropdownRef.current && !subSopDropdownRef.current.contains(e.target as Node)) setShowSubSopDropdown(false);
    };
    if (showDropdown || showLocDropdown || showRespDropdown || showSopDropdown || showSubSopDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown, showLocDropdown, showRespDropdown, showSopDropdown, showSubSopDropdown]);

  const ownerDepts = useMemo(() => {
    if (!selectedLocation) return null;
    const selLower = selectedLocation.toLowerCase().trim();
    const depts = new Set<string>();
    if (combinedLocations && combinedLocations.length > 0) {
      combinedLocations.forEach(loc => {
        if (loc.includes(' › ')) {
          const parts = loc.split(' › ');
          const dept = parts[0].trim();
          const locName = parts.slice(1).join(' › ').trim();
          if (locName.toLowerCase().trim() === selLower) depts.add(dept);
        }
      });
    }
    if (depts.size === 0 && departmentLocations) {
      Object.entries(departmentLocations).forEach(([dept, locs]) => {
        if ((locs || []).some(l => l.toLowerCase().trim() === selLower)) depts.add(dept);
      });
    }
    return depts.size > 0 ? [...depts] : null;
  }, [selectedLocation, combinedLocations, departmentLocations]);

  useEffect(() => {
    if (responsibilityLocked) return;
    if (!selectedLocation) {
      setSelectedResponsibility('');
      return;
    }
  }, [selectedLocation, responsibilityLocked]);

  const availableResponsibilities = useMemo(() => {
    const respSet = new Set<string>();
    questions.forEach(q => {
      if (q.responsibility && Array.isArray(q.responsibility)) {
        q.responsibility.forEach(r => { if (r) respSet.add(r); });
      }
    });
    return Array.from(respSet).sort();
  }, [questions]);

  const availableSops = useMemo(() => {
    const sopSet = new Set<string>();
    questions.forEach(q => {
      const sec = (q.sectionTitle || '').trim();
      if (!sec) return;
      const sopName = sec.includes(' > ') ? sec.split(' > ')[0].trim() : sec;
      if (sopName) sopSet.add(sopName);
    });
    return Array.from(sopSet).sort();
  }, [questions]);

  const availableSubSops = useMemo(() => {
    const subSet = new Set<string>();
    const sopFilter = selectedSop ? selectedSop.toLowerCase().trim() : '';
    questions.forEach(q => {
      const sec = (q.sectionTitle || '').trim();
      if (!sec || !sec.includes(' > ')) return;
      const parts = sec.split(' > ');
      const sopPart = parts[0].trim();
      const subPart = parts.slice(1).join(' > ').trim();
      if (sopFilter && sopPart.toLowerCase() !== sopFilter) return;
      if (subPart) subSet.add(subPart);
    });
    return Array.from(subSet).sort();
  }, [questions, selectedSop]);

  const scopedQuestions = useMemo(() => {
    const hasLocation = !!selectedLocation;
    const hasResponsibility = !!selectedResponsibility;
    const hasSop = !!selectedSop;
    const hasSubSop = !!selectedSubSop;
    
    if (!hasLocation && !hasResponsibility && !hasSop && !hasSubSop) return questions;
    
    const filtered = questions.filter(q => {
      let locationMatch = true;
      let responsibilityMatch = true;
      let sopMatch = true;
      let subSopMatch = true;
      
      if (hasSop) {
        const sec = (q.sectionTitle || '').trim();
        const sopPart = sec.includes(' > ') ? sec.split(' > ')[0].trim() : sec;
        sopMatch = sopPart.toLowerCase() === selectedSop.toLowerCase().trim();
      }
      
      if (hasSubSop) {
        const sec = (q.sectionTitle || '').trim();
        if (!sec.includes(' > ')) {
          subSopMatch = false;
        } else {
          const subPart = sec.split(' > ').slice(1).join(' > ').trim();
          subSopMatch = subPart.toLowerCase() === selectedSubSop.toLowerCase().trim();
        }
      }
      
      if (hasLocation) {
        const selLower = selectedLocation.toLowerCase().trim();
        const hasVirtualPages = (q.pageTitle || '').includes('::') || (q.id || '').includes('::');
        if (hasVirtualPages) {
          const extractLocName = (prefix: string) => {
            if (prefix.includes('___')) return prefix.split('___').pop()!.replace(/_/g, ' ');
            return prefix.replace(/_/g, ' ');
          };
          let prefixLocName = '';
          const pt = q.pageTitle || '';
          if (pt.includes('::')) {
            const prefix = pt.split('::')[0];
            prefixLocName = extractLocName(prefix);
          } else {
            const qId = q.id || '';
            if (qId.includes('::')) {
              const prefix = qId.split('::')[0];
              prefixLocName = extractLocName(prefix);
            }
          }
          locationMatch = prefixLocName.toLowerCase().trim() === selLower;
        } else {
          if (ownerDepts && ownerDepts.length > 0) {
            const qDept = (q.department || '').toLowerCase().trim();
            locationMatch = ownerDepts.some(d => d.toLowerCase().trim() === qDept);
          } else {
            const hasMappings = departmentLocations && Object.keys(departmentLocations).length > 0;
            if (!hasMappings) {
              locationMatch = true;
            } else {
              const qDept = (q.department || '').toLowerCase().trim();
              let deptOwnsLocation = false;
              Object.entries(departmentLocations!).forEach(([dept, locs]) => {
                if (dept.toLowerCase().trim() === qDept) {
                  if ((locs || []).some(l => l.toLowerCase().trim() === selLower)) {
                    deptOwnsLocation = true;
                  }
                }
              });
              if (!deptOwnsLocation && qDept === selLower) {
                deptOwnsLocation = true;
              }
              locationMatch = deptOwnsLocation;
            }
          }
        }
      }
      
      if (hasResponsibility) {
        responsibilityMatch = false;
        if (q.responsibility && Array.isArray(q.responsibility)) {
          responsibilityMatch = q.responsibility.some(r => r.toLowerCase().trim() === selectedResponsibility.toLowerCase().trim());
        }
      }
      
      return locationMatch && responsibilityMatch && sopMatch && subSopMatch;
    });
    
    const seen = new Map<string, number>();
    const deduped: typeof filtered = [];
    for (const q of filtered) {
      const key = (q.text || '').trim().toLowerCase();
      if (!key) { deduped.push(q); continue; }
      if (!seen.has(key)) {
        seen.set(key, deduped.length);
        deduped.push(q);
      }
    }
    return deduped;
  }, [questions, selectedLocation, selectedResponsibility, selectedSop, selectedSubSop, ownerDepts, departmentLocations]);

  const filteredQuestions = useMemo(() => {
    if (!searchQ.trim()) return [...scopedQuestions];
    const tokens = searchQ.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return [...scopedQuestions];
    const synonymMap: Record<string, string[]> = {
      'clean': ['cleaning', 'cleanliness', 'sanitize', 'sanitized', 'hygiene', 'hygienic', 'wash', 'washed'],
      'temp': ['temperature', 'thermometer', 'heating', 'cooling', 'hot', 'cold', 'chiller', 'freezer'],
      'food': ['foods', 'meal', 'meals', 'dish', 'dishes', 'cuisine'],
      'store': ['storage', 'stored', 'storing', 'stores', 'storeroom'],
      'dry': ['drying', 'dried', 'dry storage'],
      'pest': ['pests', 'rodent', 'rodents', 'insect', 'insects', 'cockroach', 'vermin'],
      'equip': ['equipment', 'equipments', 'utensil', 'utensils', 'appliance', 'appliances'],
      'maintain': ['maintenance', 'maintained', 'maintaining', 'repair', 'servicing'],
      'label': ['labelling', 'labeling', 'labelled', 'labeled', 'labels'],
      'expire': ['expiry', 'expired', 'expiration', 'shelf life', 'best before'],
      'waste': ['wastes', 'garbage', 'rubbish', 'disposal', 'discard'],
      'water': ['drinking water', 'potable', 'water supply'],
      'fire': ['fire safety', 'extinguisher', 'fire exit'],
      'ppe': ['gloves', 'hairnet', 'apron', 'uniform', 'protective'],
      'cross': ['cross contamination', 'cross-contamination', 'contamination'],
      'safe': ['safety', 'safeguard', 'secure', 'secured'],
      'check': ['checked', 'checking', 'checklist', 'inspection', 'inspected'],
      'record': ['records', 'recorded', 'recording', 'log', 'logged', 'documentation'],
      'train': ['training', 'trained', 'trainer'],
      'receive': ['receiving', 'received', 'reception', 'delivery', 'delivered'],
      'cool': ['cooling', 'cooled', 'refrigeration', 'chilled'],
      'cook': ['cooking', 'cooked', 'preparation'],
      'reheat': ['reheating', 'reheated'],
      'thaw': ['thawing', 'thawed', 'defrost', 'defrosted'],
      'allergen': ['allergens', 'allergy', 'allergic', 'allergies'],
      'calibr': ['calibration', 'calibrated', 'calibrating'],
    };
    const normalize = (t: string) => t.replace(/[^a-z0-9]/g, '');
    const normalizedTokens = tokens.map(normalize).filter(t => t.length > 0);
    if (normalizedTokens.length === 0) return [...scopedQuestions];
    const expandToken = (token: string): string[] => {
      const expanded = [token];
      if (token.length < 3) return expanded;
      for (const [root, syns] of Object.entries(synonymMap)) {
        if (token.startsWith(root) || root.startsWith(token)) {
          expanded.push(root, ...syns);
        }
      }
      return [...new Set(expanded)];
    };
    const expandedTokens = normalizedTokens.map(t => expandToken(t));
    const scoreItem = (item: typeof scopedQuestions[0]): number => {
      const textLower = item.text.toLowerCase();
      const sectionLower = item.sectionTitle.toLowerCase();
      const pageLower = item.pageTitle.toLowerCase();
      const textWords = textLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const sectionWords = sectionLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      const pageWords = pageLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
      let totalScore = 0;
      for (const tokenGroup of expandedTokens) {
        let bestTokenScore = 0;
        for (const tok of tokenGroup) {
          let s = 0;
          if (textWords.some(w => w === tok)) s = Math.max(s, 100);
          else if (textWords.some(w => w.startsWith(tok))) s = Math.max(s, 80);
          else if (textLower.includes(tok)) s = Math.max(s, 60);
          if (sectionWords.some(w => w === tok)) s = Math.max(s, 40);
          else if (sectionWords.some(w => w.startsWith(tok))) s = Math.max(s, 30);
          else if (sectionLower.includes(tok)) s = Math.max(s, 20);
          if (pageWords.some(w => w === tok)) s = Math.max(s, 15);
          else if (pageWords.some(w => w.startsWith(tok))) s = Math.max(s, 10);
          else if (pageLower.includes(tok)) s = Math.max(s, 5);
          bestTokenScore = Math.max(bestTokenScore, s);
        }
        if (bestTokenScore === 0) return 0;
        totalScore += bestTokenScore;
      }
      return totalScore;
    };
    const scored = scopedQuestions.map(item => ({ item, score: scoreItem(item) })).filter(s => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }, [scopedQuestions, searchQ]);

  const selectedQuestionId = selectedQuestionIds.length === 1 ? selectedQuestionIds[0] : '';
  const selectedQuestion = selectedQuestionIds.length === 1 ? questions.find(q => q.id === selectedQuestionIds[0]) : null;
  const selectedQuestions = useMemo(() => selectedQuestionIds.map(id => questions.find(q => q.id === id)).filter(Boolean) as AuditQuestionOption[], [selectedQuestionIds, questions]);
  const isMultiSelect = selectedQuestionIds.length > 1;

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setCommentImages(prev => [...prev, compressed]);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setCommentImages(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, []);

  const handleEntryFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const entryId = uploadingForEntryId;
    if (!files?.length || !entryId) return;
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setCompletedEntries(prev => prev.map(e => e.id === entryId ? { ...e, commentImages: [...e.commentImages, compressed] } : e));
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setCompletedEntries(prev => prev.map(e => e.id === entryId ? { ...e, commentImages: [...e.commentImages, raw] } : e));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
    setUploadingForEntryId(null);
  }, [uploadingForEntryId]);

  const processDroppedFiles = useCallback(async (files: FileList | File[], targetEntryId?: string) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          if (targetEntryId) {
            setCompletedEntries(prev => prev.map(e => e.id === targetEntryId ? { ...e, commentImages: [...e.commentImages, compressed] } : e));
          } else {
            setCommentImages(prev => [...prev, compressed]);
          }
        } catch {
          const raw = ev.target?.result as string;
          if (!raw) return;
          if (targetEntryId) {
            setCompletedEntries(prev => prev.map(e => e.id === targetEntryId ? { ...e, commentImages: [...e.commentImages, raw] } : e));
          } else {
            setCommentImages(prev => [...prev, raw]);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const [isRepeat, setIsRepeat] = useState(isRepeatMode);

  const resetFormFields = () => {
    setCommentText('');
    setCommentImages([]);
    if (!editMode && !questionLocked) setSelectedQuestionIds([]);
    if (!isLocationLocked) setSelectedLocation('');
    setSearchQ('');
    setLocSearch('');
    setShowDropdown(false);
    setShowLocDropdown(false);
    setCompletedEntries([]);
    setSelectedAnswerIndex(null);
    setIsRepeat(false);
    if (!editMode && !sopLocked) setSelectedSop('');
    if (!editMode && !subSopLocked) setSelectedSubSop('');
    setShowSopDropdown(false);
    setShowSubSopDropdown(false);
    setSopSearch('');
    setSubSopSearch('');
    if (!editMode && !responsibilityLocked) setSelectedResponsibility('');
    setShowRespDropdown(false);
    setRespSearch('');
  };

  const resetAndClose = () => {
    resetFormFields();
    onClose();
  };

  const handleAddMore = () => {
    const hasContent = !!(commentText.trim() || commentImages.length > 0);
    const hasQuestion = selectedQuestionIds.length > 0;
    const hasLocation = !!selectedLocation;

    if (!hasQuestion || !hasLocation) {
      if (!hasContent) return;
      if (onSaveAsDraft) {
        const draftPayload: DraftObservationPayload = {
          questionId: hasQuestion ? (selectedQuestionIds[0] || '') : '',
          questionText: hasQuestion && selectedQuestion ? selectedQuestion.text : '',
          sectionTitle: hasQuestion && selectedQuestion ? selectedQuestion.sectionTitle : '',
          selectedAnswer: '',
          observationText: commentText.trim(),
          images: [...commentImages],
          location: selectedLocation,
          managementTag: selectedManagementTag,
        };
        onSaveAsDraft([draftPayload]);
        showToast('Saved as draft');
        setCommentText('');
        setCommentImages([]);
        setSelectedAnswerIndex(null);
        setIsRepeat(false);
        return;
      }
      const newDraft: LiveDraft = {
        id: `ld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        commentText,
        commentImages: [...commentImages],
        location: selectedLocation,
        questionId: hasQuestion ? (selectedQuestionIds[0] || '') : '',
        questionText: hasQuestion && selectedQuestion ? selectedQuestion.text : '',
        sectionTitle: hasQuestion && selectedQuestion ? selectedQuestion.sectionTitle : '',
        createdAt: Date.now(),
        managementTag: selectedManagementTag,
      };
      const currentDrafts = readScopedDrafts();
      writeScopedDrafts([...currentDrafts, newDraft]);
      setCommentText('');
      setCommentImages([]);
      setSelectedAnswerIndex(null);
      setIsRepeat(false);
      showToast('Saved to live drafts — add location & question to submit');
      return;
    }

    const newEntries: PopupEntry[] = [];
    if (isMultiSelect) {
      for (const sq of selectedQuestions) {
        newEntries.push({
          id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${sq.id.slice(-4)}`,
          questionId: sq.id,
          questionText: sq.text,
          sectionTitle: sq.sectionTitle,
          location: selectedLocation,
          answer: '',
          answerColor: '',
          commentText,
          commentImages: [...commentImages],
          responses: [...sq.responses],
          isRepeat,
          fromMultiSelect: true,
          managementTag: selectedManagementTag,
        });
      }
    } else if (selectedQuestion) {
      const selIdx = selectedAnswerIndex;
      const answerText = selIdx !== null && selIdx >= 0 && selectedQuestion.responses[selIdx] ? selectedQuestion.responses[selIdx].text : '';
      const answerColor = selIdx !== null && selIdx >= 0 && selectedQuestion.responses[selIdx] ? (selectedQuestion.responses[selIdx].color || '') : '';
      newEntries.push({
        id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        questionId: selectedQuestionId,
        questionText: selectedQuestion.text,
        sectionTitle: selectedQuestion.sectionTitle,
        location: selectedLocation,
        answer: answerText,
        answerColor,
        commentText,
        commentImages: [...commentImages],
        selectedResponseIndex: selIdx !== null && selIdx >= 0 ? selIdx : undefined,
        responses: [...selectedQuestion.responses],
        isRepeat,
        managementTag: selectedManagementTag,
      });
    }
    if (newEntries.length > 0) {
      setCompletedEntries(prev => [...prev, ...newEntries]);
    }
    setCommentText('');
    setCommentImages([]);
    setSelectedAnswerIndex(null);
    setIsRepeat(false);
    if (!questionLocked) { setSelectedQuestionIds([]); setSearchQ(''); }
    setExpandedEntryId(null);
  };

  const buildObservation = (qId: string, qText: string, sTitle: string, selAnswer: string, obsText: string, images: string[], loc: string, checklistName?: string, repeat?: boolean, entryTag?: 'management-focus' | 'easy-impactful' | 'ongoing', respIndex?: number | null, entryResourceRequired?: boolean): ObservationPayload => {
    const ts = new Date().toLocaleString();
    const matchedQ = questions.find(q => q.id === qId);
    return {
      id: `OBS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: qId,
      title: qText || 'Observation',
      questionText: qText || '',
      selectedAnswer: selAnswer,
      observationText: obsText,
      sop: sTitle || '',
      severity: 'MINOR' as const,
      level: 'L1' as const,
      mainKitchen: auditLocationName || '',
      area: loc || auditLocationName || '',
      hierarchy: auditUnitName || '',
      closureComments: null,
      status: 'OPEN' as const,
      duration: '0d 0h',
      followUpStatus: 'NOT DONE' as const,
      followUpCount: 0,
      followUpDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      reportedBy: 'Auditor',
      lastUpdate: ts,
      createdDate: new Date().toISOString(),
      thumbnail: images[0] || '',
      allEvidence: [...images],
      isStarred: false,
      people: [],
      assets: [],
      categories: [],
      tracking: [{ id: `t-${Date.now()}`, label: 'Reported', user: 'Auditor', timestamp: ts, comments: obsText }],
      isAuditSourced: true,
      departmentName: auditLocationName || '',
      unitId: auditUnitId || undefined,
      unitName: auditUnitName || auditLocationName || '',
      location: loc || auditLocationName || '',
      sectionTitle: sTitle || undefined,
      checklistName: checklistName || undefined,
      responsibility: matchedQ?.responsibility || [],
      isRepeat: repeat || undefined,
      managementTag: entryTag || selectedManagementTag,
      resourceRequired: entryResourceRequired !== undefined ? entryResourceRequired : resourceRequired || undefined,
      ...(repeat && repeatData ? {
        repeatOriginalDate: repeatData.originalDate,
        repeatTrail: [
          ...repeatData.repeatTrail,
          { date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), comment: obsText }
        ],
        repeatSourceId: repeatData.sourceEntryId,
      } : {}),
      selectedResponseIndex: respIndex !== undefined && respIndex !== null && respIndex >= 0 ? respIndex : undefined,
    } as ObservationPayload;
  };

  const handleSaveAsDraft = () => {
    const hasCurrentContent = !!(commentText.trim() || commentImages.length > 0);
    const hasCurrentEntry = selectedQuestionIds.length > 0 && hasCurrentContent;
    const hasAnyContent = hasCurrentContent || completedEntries.length > 0;
    if (!hasAnyContent) return;
    setSaving(true);

    if (onSaveAsDraft) {
      const draftObs: DraftObservationPayload[] = [];
      for (const entry of completedEntries) {
        draftObs.push({
          questionId: entry.questionId,
          questionText: entry.questionText,
          sectionTitle: entry.sectionTitle,
          selectedAnswer: entry.answer,
          observationText: entry.commentText,
          images: entry.commentImages,
          location: entry.location,
          isRepeat: entry.isRepeat || undefined,
          managementTag: entry.managementTag || selectedManagementTag,
        });
      }
      if (hasCurrentContent) {
        if (isMultiSelect && hasCurrentEntry) {
          for (const sq of selectedQuestions) {
            draftObs.push({
              questionId: sq.id,
              questionText: sq.text,
              sectionTitle: sq.sectionTitle,
              selectedAnswer: '',
              observationText: commentText.trim(),
              images: [...commentImages],
              location: selectedLocation,
              isRepeat: isRepeat || undefined,
              managementTag: selectedManagementTag,
            });
          }
        } else if (selectedQuestion && hasCurrentEntry) {
          const selAnswer = selectedAnswerIndex !== null && selectedAnswerIndex >= 0 ? (selectedQuestion.responses[selectedAnswerIndex]?.text || '') : '';
          draftObs.push({
            questionId: selectedQuestionId,
            questionText: selectedQuestion.text,
            sectionTitle: selectedQuestion.sectionTitle,
            selectedAnswer: selAnswer,
            observationText: commentText.trim(),
            images: [...commentImages],
            location: selectedLocation,
            isRepeat: isRepeat || undefined,
            managementTag: selectedManagementTag,
          });
        } else {
          draftObs.push({
            questionId: '',
            questionText: '',
            sectionTitle: '',
            selectedAnswer: '',
            observationText: commentText.trim(),
            images: [...commentImages],
            location: selectedLocation,
            managementTag: selectedManagementTag,
          });
        }
      }
      onSaveAsDraft(draftObs);
    }

    const currentCount = hasCurrentEntry ? (isMultiSelect ? selectedQuestionIds.length : 1) : 0;
    const total = completedEntries.length + currentCount;
    showToast(total === 1 ? 'Observation saved as draft' : `${total} observations saved as drafts`);
    resetFormFields();
    setSaving(false);
  };

  const handleSend = async () => {
    const hasCurrentEntry = !!(selectedQuestionIds.length > 0 && (commentText.trim() || commentImages.length > 0));
    if (!hasCurrentEntry && completedEntries.length === 0) {
      if (editData && (commentText.trim() || commentImages.length > 0)) {
        setWarningMsg('Please select a question before sending.');
        setTimeout(() => setWarningMsg(null), 4000);
      }
      return;
    }

    if (!hideAnswerSet) {
      const missingAnswerEntries = completedEntries.filter(e => e.questionId && !e.answer && !e.fromMultiSelect);
      const currentMissingAnswer = hasCurrentEntry && !isMultiSelect && selectedQuestion && (selectedAnswerIndex === null || selectedAnswerIndex < 0);
      if (missingAnswerEntries.length > 0 || currentMissingAnswer) {
        const count = missingAnswerEntries.length + (currentMissingAnswer ? 1 : 0);
        setWarningMsg(`Please select an answer for ${count === 1 ? 'the observation' : `${count} observations`} before sending.`);
        setTimeout(() => setWarningMsg(null), 4000);
        return;
      }
    }

    setSaving(true);
    const allObs: ObservationPayload[] = [];
    try {
      for (const entry of completedEntries) {
        const q = questions.find(qq => qq.id === entry.questionId);
        allObs.push(buildObservation(entry.questionId, entry.questionText, entry.sectionTitle, entry.answer, entry.commentText, entry.commentImages, entry.location, q?.checklistName, entry.isRepeat, entry.managementTag, entry.selectedResponseIndex, (entry as any).resourceRequired));
      }
      if (hasCurrentEntry) {
        if (isMultiSelect) {
          for (const sq of selectedQuestions) {
            allObs.push(buildObservation(sq.id, sq.text, sq.sectionTitle, '', commentText.trim(), commentImages, selectedLocation, sq.checklistName, isRepeat, selectedManagementTag, undefined, resourceRequired || undefined));
          }
        } else if (selectedQuestion) {
          const selAnswer = selectedAnswerIndex !== null && selectedAnswerIndex >= 0 ? (selectedQuestion.responses[selectedAnswerIndex]?.text || '') : '';
          allObs.push(buildObservation(selectedQuestion.id, selectedQuestion.text, selectedQuestion.sectionTitle, selAnswer, commentText.trim(), commentImages, selectedLocation, selectedQuestion.checklistName, isRepeat, selectedManagementTag, selectedAnswerIndex, resourceRequired || undefined));
        }
      }

      if (!editMode && !navigator.onLine) {
        const offlineDrafts: LiveDraft[] = allObs.map(obs => ({
          id: `draft-offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          commentText: obs.observationText,
          commentImages: [...obs.allEvidence],
          location: obs.location || '',
          questionId: obs.questionId,
          questionText: obs.title,
          sectionTitle: obs.sectionTitle || '',
          createdAt: Date.now(),
          isOfflineQueued: true,
          managementTag: obs.managementTag,
        }));
        const currentDrafts = readScopedDrafts();
        const updated = [...currentDrafts, ...offlineDrafts];
        const metaOnly = updated.map(d => ({ ...d, commentImages: [] as string[] }));
        writeScopedDrafts(metaOnly);
        (async () => {
          try {
            const { saveImageToStore, generateImageId } = await import('@/utils/draftImageStore');
            for (const d of offlineDrafts) {
              for (const img of d.commentImages) {
                await saveImageToStore(d.id, generateImageId(d.id), img);
              }
            }
          } catch {}
        })();
        showToast('You\'re offline — saved to drafts, will auto-submit when connected');
        setTimeout(() => resetAndClose(), 800);
        return;
      }

      let sendFailed = false;
      if (!editMode && !hideAnswerSet) {
        const results = await Promise.allSettled(allObs.map(obs =>
          fetch('/api/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obs) })
        ));
        sendFailed = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));
      }

      if (sendFailed && !editMode) {
        const draftObs: DraftObservationPayload[] = allObs.map(obs => ({
          questionId: obs.questionId,
          questionText: obs.title,
          sectionTitle: obs.sectionTitle || '',
          selectedAnswer: obs.selectedAnswer || '',
          observationText: obs.observationText,
          images: obs.allEvidence || [],
          location: obs.location || '',
          managementTag: obs.managementTag,
        }));
        if (onSaveAsDraft) {
          onSaveAsDraft(draftObs);
          showToast('Network error — saved to drafts. Will retry when connected.');
        } else {
          onSave(allObs);
          showToast('Network error — saved locally');
        }
      } else {
        onSave(allObs);
        const total = allObs.length;
        showToast(editMode ? 'Observation updated' : (total === 1 ? 'Observation sent to registry' : `${total} observations sent to registry`));
        // WhatsApp share popup removed — alerts now fire silently via the
        // Cloud API auto-send hooked into the registry's create handler
        // (Escalation Matrix + static "always-CC" rules).
      }
    } catch (err) {
      console.error('Failed to send observation:', err);
      if (!editMode && onSaveAsDraft) {
        const draftObs: DraftObservationPayload[] = allObs.map(obs => ({
          questionId: obs.questionId,
          questionText: obs.title,
          sectionTitle: obs.sectionTitle || '',
          selectedAnswer: obs.selectedAnswer || '',
          observationText: obs.observationText,
          images: obs.allEvidence || [],
          location: obs.location || '',
          managementTag: obs.managementTag,
        }));
        onSaveAsDraft(draftObs);
        showToast('Network error — saved to drafts');
      } else {
        onSave(allObs);
        showToast('Failed to send — saved locally');
      }
    }
    setTimeout(() => resetAndClose(), 800);
  };

  const filteredLocations = useMemo(() => {
    if (!locationOptions || locationOptions.length === 0) return [];
    if (!locSearch.trim()) return locationOptions;
    const q = locSearch.toLowerCase();
    return locationOptions.filter(l => l.toLowerCase().includes(q));
  }, [locationOptions, locSearch]);

  if (editingImage) {
    return createPortal(
      <div className="fixed inset-0 z-[10020]">
        <PhotoEditor
          imageUrl={editingImage.url}
          onSave={(edited) => { editingImage.callback(edited); setEditingImage(null); }}
          onCancel={() => setEditingImage(null)}
        />
      </div>,
      document.body
    );
  }

  if (collageData) {
    return createPortal(
      <div className="fixed inset-0 z-[10020]">
        <CollageStudio
          initialImages={collageData.images}
          onSave={(collageUrl, finalImgs) => { collageData.callback(collageUrl, finalImgs); setCollageData(null); }}
          onClose={() => setCollageData(null)}
        />
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[10012] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetAndClose}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>

          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 ${isRepeatMode ? 'bg-orange-500' : editMode ? 'bg-amber-500' : 'bg-violet-600'} text-white rounded-xl shadow-lg`}>{isRepeatMode ? <RotateCcw size={18} strokeWidth={2.5} /> : editMode ? <Edit3 size={18} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.5} />}</div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">{isRepeatMode ? 'Repeat Observation' : editMode ? 'Edit Observation' : 'New Observation'}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{isRepeatMode ? 'Follow-up on a previous finding' : editMode ? 'Update observation details' : 'Add comment to any question'}</p>
              </div>
            </div>
            <button onClick={resetAndClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">

            {isRepeatMode && repeatData && (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-3 space-y-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-orange-100 rounded-lg"><RotateCcw size={14} className="text-orange-600" /></div>
                  <div>
                    <span className="text-[9px] font-black text-orange-700 uppercase tracking-widest">Repeat Observation</span>
                    <p className="text-[9px] text-orange-500 font-medium">Original finding from {repeatData.originalDate}</p>
                  </div>
                </div>
                <div className="bg-white/70 rounded-lg border border-orange-100 p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <FileText size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Original Observation</p>
                      <p className="text-[10px] text-slate-700 leading-relaxed">{repeatData.comment || '—'}</p>
                    </div>
                  </div>
                  {repeatData.images.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-orange-100">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Evidence:</span>
                      {repeatData.images.map((img, i) => (
                        <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-orange-200 flex-shrink-0">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {repeatData.repeatTrail.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1"><Clock size={9} /> Follow-Up Trail</p>
                    <div className="relative pl-3 border-l-2 border-orange-200 space-y-1.5">
                      {repeatData.repeatTrail.map((trail, i) => (
                        <div key={i} className="bg-white/60 rounded-lg px-2.5 py-1.5 border border-orange-100 relative">
                          <div className="absolute -left-[calc(0.75rem+5px)] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 border-2 border-orange-100" />
                          <p className="text-[9px] font-bold text-orange-700">{trail.date}</p>
                          {trail.comment && <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-2">{trail.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-1 border-t border-orange-200">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <p className="text-[9px] font-bold text-orange-600">New follow-up — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
            )}

            {completedEntries.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle2 size={9} className="text-emerald-500" /> Added ({completedEntries.length}) — will save on submit
                </p>
                {completedEntries.map((entry, idx) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const chipStyle = entry.answerColor ? getColorStyle(entry.answerColor) : null;
                  return (
                    <div key={entry.id} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-indigo-300 bg-white shadow-md' : 'border-emerald-200 bg-emerald-50'}`}>
                      <div
                        className="px-3 py-2 flex items-start gap-2 cursor-pointer select-none"
                        onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-[8px] font-bold uppercase tracking-wider truncate ${isExpanded ? 'text-indigo-500' : 'text-emerald-600'}`}>{entry.sectionTitle}</p>
                          <p className="text-[11px] font-bold text-gray-800 leading-snug truncate mt-0.5">{entry.questionText}</p>
                          {!isExpanded && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {entry.isRepeat && (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border border-orange-300 bg-orange-50 text-orange-600 shrink-0 flex items-center gap-0.5"><RotateCcw size={8} /> Repeat</span>
                              )}
                              {entry.answer && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shrink-0" style={chipStyle ? { backgroundColor: chipStyle.bg, color: chipStyle.text, borderColor: chipStyle.border } : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }}>{entry.answer}</span>
                              )}
                              {entry.commentText && <p className="text-[10px] text-gray-500 truncate flex-1 italic">"{entry.commentText}"</p>}
                              {entry.commentImages.length > 0 && <span className="text-[8px] text-gray-400 shrink-0">{entry.commentImages.length} photo{entry.commentImages.length > 1 ? 's' : ''}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setExpandedEntryId(isExpanded ? null : entry.id); }}
                            className={`p-1 rounded-lg transition-colors ${isExpanded ? 'text-indigo-500 bg-indigo-50' : 'text-gray-400 hover:text-indigo-500'}`}
                            title={isExpanded ? 'Collapse' : 'Edit'}
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setCompletedEntries(prev => prev.filter((_, i) => i !== idx)); if (expandedEntryId === entry.id) setExpandedEntryId(null); }}
                            className="p-1 text-gray-300 hover:text-rose-500 rounded-lg transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (() => {
                        const entryLoc = entry.location || selectedLocation || '';
                        const entryScopedQs = (() => {
                          if (!entryLoc) return questions;
                          const entryLocLower = entryLoc.toLowerCase().trim();
                          const extractLoc = (prefix: string) => {
                            if (prefix.includes('___')) return prefix.split('___').pop()!.replace(/_/g, ' ');
                            return prefix.replace(/_/g, ' ');
                          };
                          const entryOwnerDepts: string[] = [];
                          if (combinedLocations && combinedLocations.length > 0) {
                            combinedLocations.forEach(loc => {
                              if (loc.includes(' › ')) {
                                const dept = loc.split(' › ')[0].trim();
                                const locName = loc.split(' › ').slice(1).join(' › ').trim();
                                if (locName.toLowerCase().trim() === entryLocLower) entryOwnerDepts.push(dept);
                              }
                            });
                          }
                          if (entryOwnerDepts.length === 0 && departmentLocations) {
                            Object.entries(departmentLocations).forEach(([dept, locs]) => {
                              if ((locs || []).some(l => l.toLowerCase().trim() === entryLocLower)) entryOwnerDepts.push(dept);
                            });
                          }
                          const hasVP = questions.some(q => (q.pageTitle || '').includes('::') || (q.id || '').includes('::'));
                          if (hasVP) {
                            const locMatch = questions.filter(q => {
                              const pt = q.pageTitle || ''; if (!pt.includes('::')) return false;
                              const prefix = pt.split('::')[0];
                              if (extractLoc(prefix).toLowerCase().trim() !== entryLocLower) return false;
                              if (entryOwnerDepts.length > 0 && q.department) {
                                if (!entryOwnerDepts.some(d => d.toLowerCase().trim() === q.department!.toLowerCase().trim())) return false;
                              }
                              return true;
                            });
                            if (locMatch.length > 0) return locMatch;
                            const idMatch = questions.filter(q => {
                              const qId = q.id || ''; if (!qId.includes('::')) return false;
                              const prefix = qId.split('::')[0];
                              if (extractLoc(prefix).toLowerCase().trim() !== entryLocLower) return false;
                              if (entryOwnerDepts.length > 0 && q.department) {
                                if (!entryOwnerDepts.some(d => d.toLowerCase().trim() === q.department!.toLowerCase().trim())) return false;
                              }
                              return true;
                            });
                            if (idMatch.length > 0) return idMatch;
                          }
                          if (entryOwnerDepts.length > 0) {
                            const deptFiltered = questions.filter(q => {
                              if (q.department) return entryOwnerDepts.some(d => d.toLowerCase().trim() === q.department!.toLowerCase().trim());
                              const pt = q.pageTitle || '';
                              const rawPt = pt.includes('::') ? pt.split('::').slice(1).join('::') : pt;
                              return entryOwnerDepts.some(d => d.toLowerCase().trim() === rawPt.toLowerCase().trim());
                            });
                            if (deptFiltered.length > 0) return deptFiltered;
                          }
                          const deptMatch = questions.filter(q => { const pt = q.pageTitle || ''; const rawPt = pt.includes('::') ? pt.split('::').slice(1).join('::') : pt; return rawPt.toLowerCase() === entryLocLower; });
                          if (deptMatch.length > 0) return deptMatch;
                          return questions;
                        })();
                        const entryQFiltered = entryScopedQs.filter(q =>
                          !entryQSearch.trim() ||
                          q.text.toLowerCase().includes(entryQSearch.toLowerCase()) ||
                          q.sectionTitle.toLowerCase().includes(entryQSearch.toLowerCase()) ||
                          (q.pageTitle || '').toLowerCase().includes(entryQSearch.toLowerCase())
                        );
                        return (
                        <div className="border-t border-indigo-100 bg-indigo-50/30 rounded-b-xl space-y-3 p-3">

                          <div>
                            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                              <Target size={9} /> Question *
                            </label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setEntryQDropOpen(entryQDropOpen === entry.id ? null : entry.id); setEntryQSearch(''); }}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-left ${entry.questionText ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-gray-200 bg-white text-gray-400'}`}
                              >
                                <Search size={12} className={entry.questionText ? 'text-violet-400 shrink-0' : 'text-gray-300 shrink-0'} />
                                <span className="flex-1 truncate">{entry.questionText || 'Search questions...'}</span>
                                <ChevronDown size={12} className={`text-gray-300 transition-transform shrink-0 ${entryQDropOpen === entry.id ? 'rotate-180' : ''}`} />
                              </button>
                              {entry.questionText && (() => { const mq = questions.find(qq => qq.id === entry.questionId); const pm = mq?.pageTitle?.match(/^(.+?)::(.+)$/); const dept = pm ? pm[2] : mq?.pageTitle; const loc = pm ? (pm[1].includes('___') ? pm[1].split('___').pop()!.replace(/_/g, ' ') : pm[1].replace(/_/g, ' ')) : null; return (
                                <div className="mt-1 bg-violet-50 border border-violet-100 rounded-xl px-3 py-1.5">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {dept && <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[45%]">{dept}</span>}
                                    {loc && <><span className="text-[7px] text-gray-300">|</span><span className="text-[7px] font-bold text-emerald-500 uppercase tracking-wider truncate max-w-[45%]">{loc}</span></>}
                                  </div>
                                  <p className="text-[7.5px] text-violet-400 font-bold uppercase tracking-wider truncate">{entry.sectionTitle}</p>
                                  <p className="text-[10px] font-bold text-violet-800 leading-snug mt-0.5 line-clamp-2">{entry.questionText}</p>
                                </div>
                              ); })()}
                              {entryQDropOpen === entry.id && (
                                <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                                  <div className="p-2 border-b border-gray-100 shrink-0">
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                      <Search size={11} className="text-gray-400" />
                                      <input type="text" value={entryQSearch} onChange={e => setEntryQSearch(e.target.value)}
                                        placeholder="Search questions..."
                                        className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-gray-400" autoFocus />
                                    </div>
                                  </div>
                                  <div className="overflow-y-auto">
                                    {entryQFiltered.length === 0
                                      ? <div className="px-4 py-3 text-xs text-gray-400 italic">No questions found</div>
                                      : entryQFiltered.map((q, qi) => (
                                        <button key={q.id || `eq-${qi}`} type="button"
                                          onClick={() => {
                                            const eAns = mergedAnswers?.[q.id];
                                            const eIdx = eAns?.selectedIndex ?? undefined;
                                            const eResp = eIdx != null && eIdx >= 0 ? q.responses[eIdx] : null;
                                            updateEntry(entry.id, { questionId: q.id, questionText: q.text, sectionTitle: q.sectionTitle, responses: q.responses, selectedResponseIndex: eIdx, answer: eResp?.text || '', answerColor: eResp?.color || '' });
                                            setEntryQDropOpen(null); setEntryQSearch('');
                                          }}
                                          className={`w-full text-left px-3 py-2.5 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-b-0 ${entry.questionId === q.id ? 'bg-violet-50' : ''}`}
                                        >
                                          {(() => { const pm = q.pageTitle?.match(/^(.+?)::(.+)$/); const dept = pm ? pm[2] : q.pageTitle; const loc = pm ? (pm[1].includes('___') ? pm[1].split('___').pop()!.replace(/_/g, ' ') : pm[1].replace(/_/g, ' ')) : null; const ca = mergedAnswers?.[q.id]; const ansResp = ca?.selectedIndex != null && ca.selectedIndex >= 0 ? q.responses[ca.selectedIndex] : null; return (
                                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                              {dept && <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[35%]">{dept}</span>}
                                              {loc && <><span className="text-[7px] text-gray-300">|</span><span className="text-[7px] font-bold text-emerald-500 uppercase tracking-wider truncate max-w-[35%]">{loc}</span></>}
                                              {ansResp && <span className="ml-auto px-1.5 py-0.5 rounded text-[6.5px] font-black uppercase shrink-0" style={{ backgroundColor: ansResp.color ? ansResp.color + '22' : '#e5e7eb', color: ansResp.color || '#6b7280', border: `1px solid ${ansResp.color || '#d1d5db'}` }}>{ansResp.text}</span>}
                                            </div>
                                          ); })()}
                                          <p className="text-[7px] font-black text-gray-300 uppercase tracking-widest truncate">{q.sectionTitle}</p>
                                          <p className="text-[11px] font-bold text-gray-700 leading-snug mt-0.5 line-clamp-2">{q.text}</p>
                                        </button>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {(entry.responses || []).length > 0 && !hideAnswerSet && (
                            <div>
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Answer</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(entry.responses || []).map((resp, respIdx) => {
                                  const isSelected = entry.selectedResponseIndex === respIdx;
                                  const cStyle = resp.color ? getColorStyle(resp.color) : null;
                                  const sStyle = resp.color ? getSelectedColorStyle(resp.color) : null;
                                  return (
                                    <button key={respIdx} type="button"
                                      onClick={() => { updateEntry(entry.id, { selectedResponseIndex: respIdx, answer: resp.text, answerColor: resp.color || '' }); if (entry.questionId) { setLocalAnswerOverrides(prev => ({ ...prev, [entry.questionId]: { selectedIndex: respIdx, marks: resp.score !== undefined ? parseFloat(resp.score) || 0 : null } })); if (onAnswerSelect) onAnswerSelect(entry.questionId, respIdx, resp); } }}
                                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all ${isSelected ? 'ring-2 ring-offset-1 shadow-sm' : 'hover:shadow-sm'}`}
                                      style={isSelected && sStyle ? { backgroundColor: sStyle.bg, color: sStyle.text, borderColor: sStyle.border } : cStyle ? { backgroundColor: cStyle.bg, color: cStyle.text, borderColor: cStyle.border } : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }}
                                    >
                                      {resp.text}{isSelected && <Check size={8} className="inline ml-1" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row gap-2.5">
                              <div className="flex-1 min-w-0">
                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                  <MessageSquare size={9} /> Observation
                                </label>
                                <textarea
                                  value={entry.commentText}
                                  onChange={e => updateEntry(entry.id, { commentText: e.target.value })}
                                  onPaste={e => handlePasteImages(e, (img) => updateEntry(entry.id, { commentImages: [...entry.commentImages, img] }))}
                                  placeholder="Describe observation..."
                                  rows={3}
                                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-violet-400 bg-white transition-all"
                                  onClick={e => e.stopPropagation()}
                                />
                                <div className="flex justify-end mt-0.5">
                                  <InlineRewriteButton
                                    text={entry.commentText}
                                    onSelect={(rewritten) => updateEntry(entry.id, { commentText: rewritten })}
                                  />
                                </div>
                              </div>

                            <div
                              className={`sm:w-[140px] flex-shrink-0 relative rounded-xl border-2 border-dashed transition-all ${isDragEntryId === entry.id ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : entry.commentImages.length > 0 ? 'border-gray-200 bg-gray-50/40' : 'border-gray-200 bg-gray-50/30 hover:border-violet-200'}`}
                              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); entryDragCounter.current++; if (e.dataTransfer.types.includes('Files')) setIsDragEntryId(entry.id); }}
                              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); entryDragCounter.current = Math.max(0, entryDragCounter.current - 1); if (entryDragCounter.current === 0) setIsDragEntryId(null); }}
                              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                              onDrop={e => { e.preventDefault(); e.stopPropagation(); entryDragCounter.current = 0; setIsDragEntryId(null); if (e.dataTransfer.files?.length) processDroppedFiles(e.dataTransfer.files, entry.id); }}
                            >
                              {isDragEntryId === entry.id && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-violet-50/90 rounded-xl pointer-events-none">
                                  <Upload size={20} className="text-violet-500 mb-0.5" />
                                  <span className="text-[8px] font-black text-violet-600 uppercase">Drop here</span>
                                </div>
                              )}
                              {entry.commentImages.length > 0 ? (
                                <div className={`grid gap-1.5 p-1.5 ${entry.commentImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                  {entry.commentImages.map((img, imgIdx) => (
                                    <div key={imgIdx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                                      <img src={img} alt="" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <button type="button"
                                          onClick={e => { e.stopPropagation(); updateEntry(entry.id, { commentImages: entry.commentImages.filter((_, i) => i !== imgIdx) }); }}
                                          className="p-1 bg-white/90 rounded-md text-rose-500"><Trash2 size={10} /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-3 sm:py-4 gap-1 select-none cursor-pointer"
                                  onClick={e => { e.stopPropagation(); setUploadingForEntryId(entry.id); setTimeout(() => entryGalleryRef.current?.click(), 50); }}>
                                  <Camera size={16} className="text-gray-300" />
                                  <p className="text-[8px] text-gray-400 font-semibold text-center">Add Evidence</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {locationOptions && locationOptions.length > 0 && (
                            <div className="relative">
                              <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <MapPin size={9} /> Location
                              </label>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); setEntryLocDropOpen(entryLocDropOpen === entry.id ? null : entry.id); setEntryLocSearch(''); }}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${entry.location ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-400'}`}
                              >
                                <MapPin size={14} className={entry.location ? 'text-indigo-500 shrink-0' : 'text-gray-300 shrink-0'} />
                                <span className="flex-1 text-left truncate">{entry.location || 'Select Location...'}</span>
                                {entry.location && (
                                  <button type="button" onClick={e => { e.stopPropagation(); updateEntry(entry.id, { location: '' }); }} className="p-0.5 text-gray-400 hover:text-rose-500"><X size={13} /></button>
                                )}
                                <ChevronDown size={13} className={`text-gray-300 shrink-0 transition-transform ${entryLocDropOpen === entry.id ? 'rotate-180' : ''}`} />
                              </button>
                              {entryLocDropOpen === entry.id && (
                                <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-44 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                                  <div className="p-2 border-b border-gray-100">
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                      <Search size={11} className="text-gray-400" />
                                      <input type="text" value={entryLocSearch} onChange={e => setEntryLocSearch(e.target.value)} placeholder="Search locations..."
                                        className="flex-1 bg-transparent text-xs font-medium outline-none placeholder:text-gray-400" autoFocus />
                                    </div>
                                  </div>
                                  <div className="overflow-y-auto max-h-36">
                                    {locationOptions.filter(l => !entryLocSearch || l.toLowerCase().includes(entryLocSearch.toLowerCase())).map(loc => (
                                      <button key={loc} type="button" onClick={() => { updateEntry(entry.id, { location: loc }); setEntryLocDropOpen(null); setEntryLocSearch(''); }}
                                        className={`w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0 ${entry.location === loc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 font-medium'}`}>
                                        <div className="flex items-center gap-2"><MapPin size={10} className={entry.location === loc ? 'text-indigo-500' : 'text-gray-300'} />{loc}</div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setUploadingForEntryId(entry.id); setTimeout(() => entryCameraRef.current?.click(), 50); }}
                              className="flex-1 py-2 border-2 border-dashed border-violet-200 text-violet-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-violet-50 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Camera size={12} /> Camera
                            </button>
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setUploadingForEntryId(entry.id); setTimeout(() => entryGalleryRef.current?.click(), 50); }}
                              className="flex-1 py-2 border-2 border-dashed border-emerald-200 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center justify-center gap-1.5"
                            >
                              <ImageLucide size={12} /> Gallery
                            </button>
                            <button type="button"
                              onClick={e => { e.stopPropagation(); pasteFromClipboard((img) => updateEntry(entry.id, { commentImages: [...entry.commentImages, img] })); }}
                              className="flex-1 py-2 border-2 border-dashed border-sky-200 text-sky-600 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-sky-50 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Clipboard size={12} /> Paste
                            </button>
                            {entry.commentImages.length >= 2 && (
                              <button type="button"
                                onClick={e => { e.stopPropagation(); const eid = entry.id; const imgs = entry.commentImages; setCollageData({ images: imgs, callback: (collageUrl) => { setCompletedEntries(prev => prev.map(en => en.id === eid ? { ...en, commentImages: [collageUrl] } : en)); } }); }}
                                className="flex-1 py-2.5 border-2 border-dashed border-amber-200 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-50 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Images size={14} /> Collage
                              </button>
                            )}
                          </div>

                          <button type="button"
                            onClick={() => { setExpandedEntryId(null); setEntryQDropOpen(null); setEntryLocDropOpen(null); }}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Check size={12} /> Done
                          </button>
                        </div>
                        );
                      })()}
                    </div>
                  );
                })}
                <div className="border-b border-dashed border-gray-200 pt-1" />
              </div>
            )}

            {(() => {
              const hasLocation = (locationOptions && locationOptions.length > 0) || isLocationLocked || !!auditLocationName;
              const hasSops = availableSops.length > 0;
              const hasSubSops = availableSubSops.length > 0;
              const hasResp = availableResponsibilities && availableResponsibilities.length > 0;
              const activeFilterCount = (selectedLocation ? 1 : 0) + (selectedSop ? 1 : 0) + (selectedSubSop ? 1 : 0) + (selectedResponsibility ? 1 : 0);
              if (!hasLocation && !hasSops && !hasSubSops && !hasResp) return null;
              return (
                <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Search size={8} /> Filters
                    </span>
                    <div className="flex items-center gap-1.5">
                      {activeFilterCount > 0 && (
                        <span className="text-[8px] font-black text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">{activeFilterCount} active</span>
                      )}
                      {(selectedSop || selectedSubSop || selectedResponsibility) && !sopLocked && !subSopLocked && !responsibilityLocked && (
                        <button
                          type="button"
                          onClick={() => { setSelectedSop(''); setSelectedSubSop(''); setSelectedResponsibility(''); setSubSopLocked(false); }}
                          className="text-[8px] font-bold text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded-full transition-colors"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {hasLocation && (
                      <div ref={locDropdownRef} className="relative">
                        <div
                          className={`border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold cursor-pointer ${isLocationLocked ? 'border-indigo-300 bg-indigo-50' : selectedLocation ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          onClick={() => { if (!isLocationLocked) { setShowLocDropdown(!showLocDropdown); setLocSearch(''); } }}
                        >
                          <MapPin size={11} className={`shrink-0 ${selectedLocation ? 'text-indigo-500' : 'text-gray-300'}`} />
                          <span className={`flex-1 truncate ${selectedLocation ? 'text-indigo-700' : 'text-gray-400'}`}>
                            {selectedLocation ? (<>{selectedLocation}{ownerDepts && ownerDepts.length > 0 && <span className="text-[8px] text-indigo-400 font-bold ml-1">({ownerDepts[0]})</span>}</>) : 'Location'}
                          </span>
                          {selectedLocation && !isLocationLocked ? (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedLocation(''); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                          ) : isLocationLocked ? (
                            <Lock size={9} className="text-indigo-400 shrink-0" />
                          ) : (
                            <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${showLocDropdown ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                        {!isLocationLocked && selectedLocation && onLockLocation && (
                          <button type="button" onClick={() => onLockLocation(selectedLocation)} title="Lock location" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-indigo-100 text-indigo-500 hover:bg-indigo-200 transition-all border border-indigo-200 z-10">
                            <Lock size={7} />
                          </button>
                        )}
                        {isLocationLocked && onUnlockLocation && (
                          <button type="button" onClick={onUnlockLocation} title="Unlock location" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all border border-amber-200 z-10">
                            <Unlock size={7} />
                          </button>
                        )}
                        {showLocDropdown && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-hidden flex flex-col min-w-[220px]">
                            <div className="p-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                <Search size={10} className="text-gray-400 flex-shrink-0" />
                                <input type="text" value={locSearch} onChange={e => setLocSearch(e.target.value)} placeholder="Search..." className="w-full bg-transparent text-[11px] font-medium outline-none placeholder:text-gray-400" autoFocus />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-40">
                              {selectedLocation && (
                                <button type="button" onClick={() => { setSelectedLocation(''); setShowLocDropdown(false); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-50 flex items-center gap-1.5 border-b border-gray-50">
                                  <X size={9} /> Clear
                                </button>
                              )}
                              {filteredLocations.length === 0 ? (
                                <div className="px-3 py-2 text-[10px] text-gray-400 italic">No locations</div>
                              ) : departmentLocations && Object.keys(departmentLocations).length > 0 ? (
                                (() => {
                                  const grouped: Record<string, string[]> = {};
                                  const ungrouped: string[] = [];
                                  filteredLocations.forEach(loc => {
                                    const dept = Object.entries(departmentLocations).find(([, locs]) => (locs || []).some(l => l.toLowerCase().trim() === loc.toLowerCase().trim()))?.[0];
                                    if (dept) { if (!grouped[dept]) grouped[dept] = []; grouped[dept].push(loc); } else { ungrouped.push(loc); }
                                  });
                                  return (<>
                                    {Object.entries(grouped).map(([dept, locs]) => (
                                      <div key={dept}>
                                        <div className="px-2.5 py-1 bg-slate-50 border-b border-gray-100 sticky top-0">
                                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{dept}</span>
                                        </div>
                                        {locs.map(loc => (
                                          <button key={loc} type="button" onClick={() => { setSelectedLocation(loc); setShowLocDropdown(false); setLocSearch(''); }}
                                            className={`w-full text-left px-3.5 py-1.5 text-[11px] hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedLocation === loc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 font-medium'}`}>
                                            <div className="flex items-center gap-1.5">
                                              <MapPin size={9} className={selectedLocation === loc ? 'text-indigo-500' : 'text-gray-300'} />
                                              <span className="truncate">{loc}</span>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    ))}
                                    {ungrouped.map(loc => (
                                      <button key={loc} type="button" onClick={() => { setSelectedLocation(loc); setShowLocDropdown(false); setLocSearch(''); }}
                                        className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedLocation === loc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 font-medium'}`}>
                                        <div className="flex items-center gap-1.5">
                                          <MapPin size={9} className={selectedLocation === loc ? 'text-indigo-500' : 'text-gray-300'} />
                                          <span className="truncate">{loc}</span>
                                        </div>
                                      </button>
                                    ))}
                                  </>);
                                })()
                              ) : (
                                filteredLocations.map(loc => (
                                  <button key={loc} type="button" onClick={() => { setSelectedLocation(loc); setShowLocDropdown(false); setLocSearch(''); }}
                                    className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-b-0 ${selectedLocation === loc ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700 font-medium'}`}>
                                    <div className="flex items-center gap-1.5">
                                      <MapPin size={9} className={selectedLocation === loc ? 'text-indigo-500' : 'text-gray-300'} />
                                      <span className="truncate">{loc}</span>
                                    </div>
                                  </button>
                                )))
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {hasSops && (
                      <div ref={sopDropdownRef} className="relative">
                        <div
                          className={`border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold cursor-pointer ${sopLocked ? 'border-teal-300 bg-teal-50' : selectedSop ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          onClick={() => { if (!sopLocked) { setShowSopDropdown(!showSopDropdown); setSopSearch(''); } }}
                        >
                          <BookOpen size={11} className={`shrink-0 ${selectedSop ? 'text-teal-500' : 'text-gray-300'}`} />
                          <span className={`flex-1 truncate ${selectedSop ? 'text-teal-700' : 'text-gray-400'}`}>
                            {selectedSop || 'SOP'}
                          </span>
                          {selectedSop && !sopLocked ? (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSop(''); setSelectedSubSop(''); setSubSopLocked(false); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                          ) : sopLocked ? (
                            <Lock size={9} className="text-teal-400 shrink-0" />
                          ) : (
                            <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${showSopDropdown ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                        {!sopLocked && selectedSop && (
                          <button type="button" onClick={() => setSopLocked(true)} title="Lock SOP" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-teal-100 text-teal-500 hover:bg-teal-200 transition-all border border-teal-200 z-10">
                            <Lock size={7} />
                          </button>
                        )}
                        {sopLocked && (
                          <button type="button" onClick={() => setSopLocked(false)} title="Unlock SOP" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all border border-amber-200 z-10">
                            <Unlock size={7} />
                          </button>
                        )}
                        {showSopDropdown && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-hidden flex flex-col min-w-[220px]">
                            <div className="p-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                <Search size={10} className="text-gray-400 flex-shrink-0" />
                                <input type="text" value={sopSearch} onChange={e => setSopSearch(e.target.value)} placeholder="Search SOPs..." className="w-full bg-transparent text-[11px] font-medium outline-none placeholder:text-gray-400" autoFocus />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-40">
                              {selectedSop && (
                                <button type="button" onClick={() => { setSelectedSop(''); setSelectedSubSop(''); setSubSopLocked(false); setShowSopDropdown(false); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-50 flex items-center gap-1.5 border-b border-gray-50">
                                  <X size={9} /> Clear
                                </button>
                              )}
                              {availableSops.filter(s => !sopSearch.trim() || s.toLowerCase().includes(sopSearch.toLowerCase())).map((sop, idx) => (
                                <button key={idx} type="button" onClick={() => { setSelectedSop(sop); setSelectedSubSop(''); setSubSopLocked(false); setShowSopDropdown(false); }}
                                  className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-teal-50 flex items-center gap-1.5 border-b border-gray-50 last:border-b-0 transition-colors ${selectedSop === sop ? 'bg-teal-50 text-teal-700' : 'text-gray-700'}`}>
                                  {selectedSop === sop && <Check size={10} className="text-teal-500 shrink-0" />}
                                  <span className="flex-1 truncate">{sop}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(hasSops || hasSubSops) && (
                      <div ref={subSopDropdownRef} className="relative">
                        <div
                          className={`border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold cursor-pointer ${subSopLocked ? 'border-cyan-300 bg-cyan-50' : selectedSubSop ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          onClick={() => { if (!subSopLocked) { setShowSubSopDropdown(!showSubSopDropdown); setSubSopSearch(''); } }}
                        >
                          <Layers size={11} className={`shrink-0 ${selectedSubSop ? 'text-cyan-500' : 'text-gray-300'}`} />
                          <span className={`flex-1 truncate ${selectedSubSop ? 'text-cyan-700' : 'text-gray-400'}`}>
                            {selectedSubSop || 'Sub SOP'}
                          </span>
                          {selectedSubSop && !subSopLocked ? (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedSubSop(''); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                          ) : subSopLocked ? (
                            <Lock size={9} className="text-cyan-400 shrink-0" />
                          ) : (
                            <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${showSubSopDropdown ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                        {!subSopLocked && selectedSubSop && (
                          <button type="button" onClick={() => setSubSopLocked(true)} title="Lock Sub SOP" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-cyan-100 text-cyan-500 hover:bg-cyan-200 transition-all border border-cyan-200 z-10">
                            <Lock size={7} />
                          </button>
                        )}
                        {subSopLocked && (
                          <button type="button" onClick={() => setSubSopLocked(false)} title="Unlock Sub SOP" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all border border-amber-200 z-10">
                            <Unlock size={7} />
                          </button>
                        )}
                        {showSubSopDropdown && (
                          <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-hidden flex flex-col min-w-[220px]">
                            <div className="p-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                <Search size={10} className="text-gray-400 flex-shrink-0" />
                                <input type="text" value={subSopSearch} onChange={e => setSubSopSearch(e.target.value)} placeholder="Search Sub SOPs..." className="w-full bg-transparent text-[11px] font-medium outline-none placeholder:text-gray-400" autoFocus />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-40">
                              {selectedSubSop && (
                                <button type="button" onClick={() => { setSelectedSubSop(''); setShowSubSopDropdown(false); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-50 flex items-center gap-1.5 border-b border-gray-50">
                                  <X size={9} /> Clear
                                </button>
                              )}
                              {availableSubSops.filter(s => !subSopSearch.trim() || s.toLowerCase().includes(subSopSearch.toLowerCase())).length === 0 ? (
                                <div className="px-3 py-2 text-[10px] text-gray-400 italic">{selectedSop ? 'No sub SOPs for this SOP' : 'Select a SOP first'}</div>
                              ) : availableSubSops.filter(s => !subSopSearch.trim() || s.toLowerCase().includes(subSopSearch.toLowerCase())).map((sub, idx) => (
                                <button key={idx} type="button" onClick={() => { setSelectedSubSop(sub); setShowSubSopDropdown(false); }}
                                  className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-cyan-50 flex items-center gap-1.5 border-b border-gray-50 last:border-b-0 transition-colors ${selectedSubSop === sub ? 'bg-cyan-50 text-cyan-700' : 'text-gray-700'}`}>
                                  {selectedSubSop === sub && <Check size={10} className="text-cyan-500 shrink-0" />}
                                  <span className="flex-1 truncate">{sub}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {hasResp && (
                      <div ref={respDropdownRef} className="relative">
                        <div
                          className={`border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold cursor-pointer ${responsibilityLocked ? 'border-orange-300 bg-orange-50' : selectedResponsibility ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          onClick={() => { if (!responsibilityLocked) { setShowRespDropdown(!showRespDropdown); setRespSearch(''); } }}
                        >
                          <Target size={11} className={`shrink-0 ${selectedResponsibility ? 'text-orange-500' : 'text-gray-300'}`} />
                          <span className={`flex-1 truncate ${selectedResponsibility ? 'text-orange-700' : 'text-gray-400'}`}>
                            Responsibility
                          </span>
                          {selectedResponsibility && !responsibilityLocked ? (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedResponsibility(''); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                          ) : responsibilityLocked ? (
                            <Lock size={9} className="text-orange-400 shrink-0" />
                          ) : (
                            <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${showRespDropdown ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                        {!responsibilityLocked && selectedResponsibility && (
                          <button type="button" onClick={() => setResponsibilityLocked(true)} title="Lock Responsibility" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-orange-100 text-orange-500 hover:bg-orange-200 transition-all border border-orange-200 z-10">
                            <Lock size={7} />
                          </button>
                        )}
                        {responsibilityLocked && (
                          <button type="button" onClick={() => setResponsibilityLocked(false)} title="Unlock Responsibility" className="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all border border-amber-200 z-10">
                            <Unlock size={7} />
                          </button>
                        )}
                        {showRespDropdown && (
                          <div className="absolute z-50 top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-52 overflow-hidden flex flex-col min-w-[220px]">
                            <div className="p-1.5 border-b border-gray-100">
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                <Search size={10} className="text-gray-400 flex-shrink-0" />
                                <input type="text" value={respSearch} onChange={e => setRespSearch(e.target.value)} placeholder="Search..." className="w-full bg-transparent text-[11px] font-medium outline-none placeholder:text-gray-400" autoFocus />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-40">
                              {selectedResponsibility && (
                                <button type="button" onClick={() => { setSelectedResponsibility(''); setShowRespDropdown(false); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-50 flex items-center gap-1.5 border-b border-gray-50">
                                  <X size={9} /> Clear
                                </button>
                              )}
                              {availableResponsibilities
                                .filter(r => !respSearch.trim() || r.toLowerCase().includes(respSearch.toLowerCase()))
                                .map((resp, idx) => (
                                  <button key={idx} type="button" onClick={() => { setSelectedResponsibility(resp); setShowRespDropdown(false); }}
                                    className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-orange-50 flex items-center gap-1.5 border-b border-gray-50 last:border-b-0 transition-colors ${selectedResponsibility === resp ? 'bg-orange-50 text-orange-700' : 'text-gray-700'}`}>
                                    {selectedResponsibility === resp && <Check size={10} className="text-orange-500 shrink-0" />}
                                    <span className="flex-1 truncate">{resp}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div ref={dropdownRef}>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block flex items-center gap-1.5">
                <Target size={10} /> Question{isMultiSelect ? 's' : ''} *
                {selectedQuestionIds.length > 0 && <span className="ml-auto text-[8px] font-black text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full">{selectedQuestionIds.length} sel.</span>}
              </label>
              <div className="relative">
                <div
                  className={`border-2 rounded-xl px-2.5 py-2 flex items-center gap-2 transition-all ${questionLocked ? 'cursor-default border-violet-200 bg-violet-50/60' : 'cursor-pointer'} ${selectedQuestionIds.length > 0 ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  onClick={() => { if (!questionLocked) setShowDropdown(!showDropdown); }}
                >
                  <Search size={13} className="text-gray-300 shrink-0" />
                  <input
                    type="text"
                    className="flex-1 outline-none bg-transparent text-[12px] font-bold placeholder:text-gray-300"
                    placeholder={selectedQuestionIds.length > 0 ? 'Search more...' : 'Search questions...'}
                    value={searchQ}
                    onChange={e => { if (!questionLocked) { setSearchQ(e.target.value); setShowDropdown(true); } }}
                    onClick={e => { e.stopPropagation(); if (!questionLocked) setShowDropdown(true); }}
                  />
                  {questionLocked ? <Lock size={12} className="text-indigo-400 shrink-0" /> : <ChevronDown size={13} className={`text-gray-300 shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />}
                </div>
                {isMultiSelect && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedQuestions.map(sq => (
                      <div key={sq.id} className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 max-w-full">
                        <span className="text-[9px] font-bold text-violet-700 truncate max-w-[180px]">{sq.text}</span>
                        <button type="button" onClick={() => {
                          const remaining = selectedQuestionIds.filter(id => id !== sq.id);
                          setSelectedQuestionIds(remaining);
                          if (remaining.length === 1) {
                            const existingAns = mergedAnswers?.[remaining[0]];
                            setSelectedAnswerIndex(existingAns?.selectedIndex ?? null);
                          }
                        }} className="p-0.5 text-violet-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => { setSelectedQuestionIds([]); setSearchQ(''); setSelectedAnswerIndex(null); }} className="text-[8px] font-bold text-rose-400 hover:text-rose-600 px-1.5 py-1">Clear All</button>
                  </div>
                )}
                {selectedQuestion && !isMultiSelect && (
                  <div className="mt-1.5 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {(() => { const pm = selectedQuestion.pageTitle?.match(/^(.+?)::(.+)$/); const dept = pm ? pm[2] : selectedQuestion.pageTitle; const loc = pm ? (pm[1].includes('___') ? pm[1].split('___').pop()!.replace(/_/g, ' ') : pm[1].replace(/_/g, ' ')) : null; return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {dept && <span className="text-[7.5px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[45%]">{dept}</span>}
                          {loc && <><span className="text-[7.5px] text-gray-300">|</span><span className="text-[7.5px] font-bold text-emerald-500 uppercase tracking-wider truncate max-w-[45%]">{loc}</span></>}
                        </div>
                      ); })()}
                      <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wider truncate">{selectedQuestion.sectionTitle}</p>
                      <p className="text-xs font-bold text-violet-800 leading-snug mt-0.5">{selectedQuestion.text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQuestionLocked(prev => !prev)}
                        className={`p-1.5 rounded-lg border transition-all ${questionLocked ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-indigo-500'}`}
                        title={questionLocked ? 'Unlock question' : 'Lock question for all entries'}
                      >
                        {questionLocked ? <Lock size={12} /> : <Unlock size={12} />}
                      </button>
                      {!questionLocked && <button onClick={() => { setSelectedQuestionIds([]); setSearchQ(''); setSelectedAnswerIndex(null); }} className="p-1 text-violet-400 hover:text-rose-500"><X size={14} /></button>}
                    </div>
                  </div>
                )}
                {selectedQuestion && !isMultiSelect && questionHistoryMap && questionHistoryMap[selectedQuestionId] && questionHistoryMap[selectedQuestionId].length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-1">
                    <History size={9} className="text-gray-400 shrink-0" />
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest shrink-0">Last 5 Audit Status</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {questionHistoryMap[selectedQuestionId].slice(0, 5).map((rec, idx) => {
                        const cfg = questionStatusConfig[rec.status] || questionStatusConfig.na;
                        return (
                          <div key={idx} className="flex items-center gap-0.5">
                            <span
                              className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider"
                              style={{ backgroundColor: cfg.bg, color: cfg.text }}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[7px] text-gray-400 font-medium">{rec.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {showDropdown && !questionLocked && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                    {searchQ.trim() && filteredQuestions.length > 0 && (
                      <div className="px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100 flex items-center justify-between">
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''}</span>
                        <span className="text-[7px] font-medium text-indigo-400">Sorted by relevance</span>
                      </div>
                    )}
                    {filteredQuestions.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Search size={20} className="mx-auto text-gray-200 mb-2" />
                        <p className="text-sm text-gray-400 font-bold">No matching questions</p>
                        <p className="text-[9px] text-gray-300 mt-1">Try shorter keywords or different terms</p>
                      </div>
                    ) : (
                      filteredQuestions.map((q, qi) => {
                        const isChecked = selectedQuestionIds.includes(q.id);
                        return (
                        <button
                          key={q.id || `fq-${qi}`}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              const remaining = selectedQuestionIds.filter(id => id !== q.id);
                              setSelectedQuestionIds(remaining);
                              if (remaining.length === 1) {
                                const existingAns = mergedAnswers?.[remaining[0]];
                                setSelectedAnswerIndex(existingAns?.selectedIndex ?? null);
                              } else {
                                setSelectedAnswerIndex(null);
                              }
                            } else if (editMode) {
                              setSelectedQuestionIds([q.id]);
                              const existingAns = mergedAnswers?.[q.id];
                              setSelectedAnswerIndex(existingAns?.selectedIndex ?? null);
                              
                              // Auto-select SOP, Sub SOP, and Responsibility from question
                              const sec = (q.sectionTitle || '').trim();
                              if (sec) {
                                const parts = sec.split(' > ');
                                const sopName = parts[0].trim();
                                const subSopName = parts.slice(1).join(' > ').trim();
                                
                                if (sopName && !sopLocked) setSelectedSop(sopName);
                                if (subSopName && !subSopLocked) setSelectedSubSop(subSopName);
                              }
                              
                              if (q.responsibility && Array.isArray(q.responsibility) && q.responsibility.length > 0 && !responsibilityLocked) {
                                setSelectedResponsibility(q.responsibility[0]);
                              }
                            } else {
                              setSelectedQuestionIds(prev => [...prev, q.id]);
                              if (selectedQuestionIds.length === 0) {
                                const existingAns = mergedAnswers?.[q.id];
                                setSelectedAnswerIndex(existingAns?.selectedIndex ?? null);
                                
                                // Auto-select SOP, Sub SOP, and Responsibility from question
                                const sec = (q.sectionTitle || '').trim();
                                if (sec) {
                                  const parts = sec.split(' > ');
                                  const sopName = parts[0].trim();
                                  const subSopName = parts.slice(1).join(' > ').trim();
                                  
                                  if (sopName && !sopLocked) setSelectedSop(sopName);
                                  if (subSopName && !subSopLocked) setSelectedSubSop(subSopName);
                                }
                                
                                if (q.responsibility && Array.isArray(q.responsibility) && q.responsibility.length > 0 && !responsibilityLocked) {
                                  setSelectedResponsibility(q.responsibility[0]);
                                }
                              } else {
                                setSelectedAnswerIndex(null);
                              }
                            }
                            setSearchQ('');
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-b-0 ${isChecked ? 'bg-violet-50' : ''}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-violet-600 border-violet-600' : 'border-gray-300 bg-white'}`}>
                              {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="min-w-0 flex-1">
                          {(() => { const pm = q.pageTitle?.match(/^(.+?)::(.+)$/); const dept = pm ? pm[2] : q.pageTitle; const loc = pm ? (pm[1].includes('___') ? pm[1].split('___').pop()!.replace(/_/g, ' ') : pm[1].replace(/_/g, ' ')) : null; const ca = mergedAnswers?.[q.id]; const ansResp = ca?.selectedIndex != null && ca.selectedIndex >= 0 ? q.responses[ca.selectedIndex] : null; return (
                            <>
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                {dept && <span className="text-[7.5px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[40%]">{dept}</span>}
                                {loc && <><span className="text-[7.5px] text-gray-300">|</span><span className="text-[7.5px] font-bold text-emerald-500 uppercase tracking-wider truncate max-w-[40%]">{loc}</span></>}
                                {ansResp && <span className="ml-auto px-1.5 py-0.5 rounded text-[7px] font-black uppercase shrink-0" style={{ backgroundColor: ansResp.color ? ansResp.color + '22' : '#e5e7eb', color: ansResp.color || '#6b7280', border: `1px solid ${ansResp.color || '#d1d5db'}` }}>{ansResp.text}</span>}
                              </div>
                            </>
                          ); })()}
                          <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest truncate">{q.sectionTitle}</p>
                          <p className="text-xs font-bold text-gray-700 leading-snug mt-0.5 line-clamp-2">{searchQ.trim() ? (() => {
                            const toks = searchQ.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                            if (toks.length === 0) return q.text;
                            const pattern = toks.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                            const splitRegex = new RegExp(`(${pattern})`, 'gi');
                            const parts = q.text.split(splitRegex);
                            const testRegex = new RegExp(`^(?:${pattern})$`, 'i');
                            return parts.map((part, pi) => testRegex.test(part) ? <mark key={pi} className="bg-amber-200 text-amber-900 rounded-sm px-0.5 font-black">{part}</mark> : part);
                          })() : q.text}</p>
                            </div>
                          </div>
                        </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedQuestion && !isMultiSelect && !hideAnswerSet && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Answer Set</label>
                  <button
                    type="button"
                    onClick={() => setIsRepeat(prev => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[9px] font-black uppercase tracking-wider transition-all ${isRepeat ? 'border-orange-400 bg-orange-50 text-orange-600 shadow-sm' : 'border-gray-200 bg-white text-gray-400 hover:border-orange-300 hover:text-orange-500'}`}
                  >
                    <RotateCcw size={11} className={isRepeat ? 'text-orange-500' : ''} />
                    Repeat
                    {isRepeat && <CheckCircle2 size={10} className="text-orange-500" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedQuestion.responses.map((resp, rIdx) => {
                    const isSelected = selectedAnswerIndex === rIdx;
                    const colorStyle = resp.color ? getColorStyle(resp.color) : null;
                    const selStyle = resp.color ? getSelectedColorStyle(resp.color) : null;
                    return (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => { setSelectedAnswerIndex(rIdx); setLocalAnswerOverrides(prev => ({ ...prev, [selectedQuestionId]: { selectedIndex: rIdx, marks: resp.score !== undefined ? parseFloat(resp.score) || 0 : null } })); if (onAnswerSelect && selectedQuestionId) onAnswerSelect(selectedQuestionId, rIdx, resp); }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer active:scale-95 ${isSelected ? 'ring-2 ring-offset-1 shadow-md' : 'hover:shadow-sm'}`}
                        style={isSelected && selStyle
                          ? { backgroundColor: selStyle.bg, color: selStyle.text, borderColor: selStyle.border }
                          : colorStyle
                            ? { backgroundColor: colorStyle.bg, color: colorStyle.text, borderColor: colorStyle.border }
                            : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }
                        }
                      >
                        {resp.text} {resp.score !== undefined && resp.score !== '/' ? `(${resp.score})` : ''}
                        {isSelected && <CheckCircle2 size={10} className="inline ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex-1 min-w-0">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 block flex items-center gap-1.5">
                  <MessageSquare size={10} /> Observation
                </label>
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onPaste={e => handlePasteImages(e, (img) => setCommentImages(prev => [...prev, img]))}
                  rows={3}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:border-violet-400 outline-none transition-all resize-none placeholder:text-gray-300"
                  placeholder="Describe observation..."
                />
                <div className="flex justify-end mt-0.5">
                  <InlineRewriteButton
                    text={commentText}
                    onSelect={(rewritten) => setCommentText(rewritten)}
                  />
                </div>
              </div>
              <div
                className={`sm:w-[160px] flex-shrink-0 relative rounded-xl border-2 border-dashed transition-all ${isMainDragging ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : commentImages.length > 0 ? 'border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-gray-50/30 hover:border-violet-200 hover:bg-violet-50/20'}`}
                onDragEnter={e => { e.preventDefault(); e.stopPropagation(); mainDragCounter.current++; if (e.dataTransfer.types.includes('Files')) setIsMainDragging(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); mainDragCounter.current = Math.max(0, mainDragCounter.current - 1); if (mainDragCounter.current === 0) setIsMainDragging(false); }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); mainDragCounter.current = 0; setIsMainDragging(false); if (e.dataTransfer.files?.length) processDroppedFiles(e.dataTransfer.files); }}
              >
                {isMainDragging && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-violet-50/90 rounded-xl pointer-events-none">
                    <Upload size={22} className="text-violet-500 mb-1" />
                    <span className="text-[9px] font-black text-violet-600 uppercase">Drop here</span>
                  </div>
                )}
                {commentImages.length > 0 ? (
                  <div className={`grid gap-1.5 p-1.5 ${commentImages.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {commentImages.map((img, i) => {
                      const isRepeatedImg = isRepeatMode && i < repeatImageCount.current;
                      const isCurrentImg = isRepeatMode && i >= repeatImageCount.current;
                      return (
                      <div key={i} className={`relative group rounded-lg overflow-hidden aspect-square ${isRepeatedImg ? 'border-2 border-orange-300' : isCurrentImg ? 'border-2 border-emerald-300' : 'border border-gray-200'}`}>
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        {isRepeatedImg && (
                          <span className="absolute top-0.5 left-0.5 text-[6px] font-black bg-orange-500 text-white px-1 py-0.5 rounded leading-none uppercase tracking-wider">Repeated</span>
                        )}
                        {isCurrentImg && (
                          <span className="absolute top-0.5 left-0.5 text-[6px] font-black bg-emerald-500 text-white px-1 py-0.5 rounded leading-none uppercase tracking-wider">Current</span>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => setEditingImage({ url: img, callback: (edited) => setCommentImages(prev => prev.map((p, idx) => idx === i ? edited : p)) })} className="p-1 bg-white/90 rounded-md text-violet-600"><Edit3 size={10} /></button>
                          {!isRepeatedImg && <button onClick={() => { setCommentImages(prev => prev.filter((_, idx) => idx !== i)); }} className="p-1 bg-white/90 rounded-md text-rose-500"><Trash2 size={10} /></button>}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 gap-1 select-none cursor-pointer"
                    onClick={() => galleryRef.current?.click()}>
                    <Camera size={18} className="text-gray-300" />
                    <p className="text-[8px] font-semibold text-gray-400">Add Evidence</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={() => cameraRef.current?.click()} className="flex-1 py-1.5 border border-dashed border-violet-200 text-violet-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-violet-50 transition-all flex items-center justify-center gap-1">
                <Camera size={12} /> Camera
              </button>
              <button onClick={() => galleryRef.current?.click()} className="flex-1 py-1.5 border border-dashed border-emerald-200 text-emerald-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center justify-center gap-1">
                <ImageLucide size={12} /> Gallery
              </button>
              <button onClick={() => pasteFromClipboard((img) => setCommentImages(prev => [...prev, img]))} className="flex-1 py-1.5 border border-dashed border-sky-200 text-sky-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-sky-50 transition-all flex items-center justify-center gap-1">
                <Clipboard size={12} /> Paste
              </button>
              {commentImages.length >= 2 && (
                <button
                  onClick={() => setCollageData({
                    images: commentImages,
                    callback: (collageUrl, finalImgs) => { repeatImageCount.current = 0; setCommentImages([collageUrl]); }
                  })}
                  className="flex-1 py-1.5 border border-dashed border-amber-200 text-amber-600 rounded-lg text-[8px] font-black uppercase tracking-wider hover:bg-amber-50 transition-all flex items-center justify-center gap-1"
                >
                  <Images size={12} /> Collage
                </button>
              )}
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            <input ref={entryCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEntryFileUpload} />
            <input ref={entryGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleEntryFileUpload} />

            {!editMode && (commentText.trim() || commentImages.length > 0) && (
              <button
                type="button"
                onClick={handleAddMore}
                className={`w-full py-2.5 border-2 border-dashed rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${selectedQuestionIds.length > 0 && selectedLocation ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}
              >
                <Plus size={14} /> {selectedQuestionIds.length > 0 && selectedLocation ? `Add More Observation${isMultiSelect ? ` (${selectedQuestionIds.length} questions)` : ''}` : (onSaveAsDraft ? 'Save as Draft' : 'Save to Live Draft')}
              </button>
            )}
          </div>


          {warningMsg && (
            <div className="mx-5 sm:mx-6 mb-1 mt-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <p className="text-[11px] font-semibold text-amber-700">{warningMsg}</p>
            </div>
          )}

          <div className="px-3 sm:px-4 pt-2 pb-1">
            <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Tag Category</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { value: 'management-focus' as const, label: '🔴 Mgmt Focus', active: 'bg-red-100 text-red-700 border-red-300 ring-1 ring-red-200', inactive: 'bg-white text-slate-400 border-slate-200 hover:border-red-200' },
                { value: 'easy-impactful' as const, label: '🟢 Easy Impact', active: 'bg-emerald-100 text-emerald-700 border-emerald-300 ring-1 ring-emerald-200', inactive: 'bg-white text-slate-400 border-slate-200 hover:border-emerald-200' },
                { value: 'ongoing' as const, label: '🔵 Ongoing', active: 'bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-200', inactive: 'bg-white text-slate-400 border-slate-200 hover:border-blue-200' },
              ]).map(tag => (
                <button key={tag.value} type="button" onClick={() => setSelectedManagementTag(prev => prev === tag.value ? undefined : tag.value)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-all active:scale-95 ${selectedManagementTag === tag.value ? tag.active : tag.inactive}`}>{tag.label}</button>
              ))}
              {selectedManagementTag && <button type="button" onClick={() => setSelectedManagementTag(undefined)} className="px-2 py-1.5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors">Clear</button>}
            </div>
            <label className={`mt-2 flex items-center gap-2 cursor-pointer select-none w-fit px-2.5 py-1.5 rounded-lg border transition-all ${resourceRequired ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200' : 'bg-white border-slate-200 hover:border-rose-200'}`}>
              <input
                type="checkbox"
                checked={resourceRequired}
                onChange={e => {
                  const checked = e.target.checked;
                  setResourceRequired(checked);
                  if (checked) setSelectedManagementTag('management-focus');
                }}
                className="w-3.5 h-3.5 rounded accent-rose-600 cursor-pointer"
              />
              <span className={`text-[10px] font-black ${resourceRequired ? 'text-rose-700' : 'text-slate-400'}`}>🔧 Resource Required</span>
            </label>
          </div>

          <div className="flex gap-2 px-3 sm:px-4 py-3 border-t border-gray-100 bg-white shrink-0">
            <button onClick={resetAndClose} className="py-2.5 sm:py-2 px-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            {!hideSaveAsDraft && (
            <button
              onClick={handleSaveAsDraft}
              disabled={saving || (completedEntries.length === 0 && !commentText.trim() && commentImages.length === 0)}
              className="flex-1 py-2.5 sm:py-2 rounded-xl border-2 border-violet-300 bg-violet-50 text-violet-700 font-semibold text-xs hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={13} /> Draft{(() => { const currentCount = (commentText.trim() || commentImages.length > 0) ? (isMultiSelect && selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1) : 0; const total = completedEntries.length + currentCount; return total > 1 ? ` (${total})` : ''; })()}
            </button>
            )}
            <button
              onClick={handleSend}
              disabled={saving || (completedEntries.length === 0 && (selectedQuestionIds.length === 0 || (!commentText.trim() && commentImages.length === 0)))}
              className={`flex-1 py-2.5 sm:py-2 rounded-xl ${editMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'} text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {editMode ? <><Check size={13} /> Update</> : <><Send size={13} /> Send{(() => { const currentCount = selectedQuestionIds.length > 0 && (commentText.trim() || commentImages.length > 0) ? (isMultiSelect ? selectedQuestionIds.length : 1) : 0; const total = completedEntries.length + currentCount; return total > 1 ? ` (${total})` : ''; })()}</>}
            </button>
          </div>
        </div>
      </div>

      {toastMsg && createPortal(
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10050] animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="bg-gray-900 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            {toastMsg}
          </div>
        </div>,
        document.body
      )}

    </>,
    document.body
  );
}
