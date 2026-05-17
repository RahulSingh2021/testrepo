"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, X, Copy, Trash2, ChevronDown, ChevronUp, Search, Check,
  Link2, GripVertical, FileSpreadsheet, Download, Type,
  Pencil, ArrowLeft,
  Save, FileText, Upload, FileDown, Bell, ClipboardCheck,
  MessageSquare, AlertCircle, ChevronRight,
  ChevronLeft, Eye, ArrowRightLeft, Layers, ListTree, BookOpen, Users, History,
  Table2
} from 'lucide-react';
import AuditChecklistPreview from './AuditChecklistPreview';
import MasterChecklistTable from './MasterChecklistTable';

export interface ResponseOption {
  id: string;
  text: string;
  color: string;
  isFlagged: boolean;
  score: string;
}

export interface ResponseSet {
  id: string;
  label: string;
  responses: ResponseOption[];
}

type RiskLevel = 'Low' | 'Medium' | 'High';
type SectionRisk = 'Indiv.' | 'Low' | 'Med' | 'High';

interface LogicTrigger {
  id: string;
  actionType: 'require-action' | 'require-evidence' | 'notify' | 'ask-questions';
  label: string;
  requireNotes?: boolean;
  requireMedia?: boolean;
  notifyRecipientsData?: { groups: string[]; users: string[]; directSelection: string };
  notifyTiming?: 'immediately' | 'on-completion';
}

interface LogicRule {
  id: string;
  answer: string;
  triggers: LogicTrigger[];
}

export interface QuestionNode {
  id: string;
  text: string;
  responseType: string;
  responses: ResponseOption[];
  responseSetId?: string;
  risk: RiskLevel;
  category: string;
  requirement: string;
  isRequired: boolean;
  isMultipleSelection: boolean;
  isFlagged: boolean;
  flaggedValue: string;
  maxScore: number;
  logicRules: LogicRule[];
  responsibility?: string[];
  isFollowUp?: boolean;
}

export interface SubSectionNode {
  id: string;
  title: string;
  subCategory?: string;
  isApplicable: boolean;
  risk: SectionRisk;
  questions: QuestionNode[];
}

export interface SectionNode {
  id: string;
  title: string;
  isApplicable: boolean;
  risk: SectionRisk;
  category: string;
  subCategory?: string;
  subSections?: SubSectionNode[];
  questions: QuestionNode[];
}

export function getAllSectionQuestions(section: SectionNode): QuestionNode[] {
  const direct = section.questions || [];
  const fromSubs = (section.subSections || []).flatMap(ss => ss.questions || []);
  return [...direct, ...fromSubs];
}

export interface PageNode {
  id: string;
  title: string;
  sections: SectionNode[];
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  department: string;
  frequency: string;
  questionCount: number;
  lastUpdated: string;
  status: 'Active' | 'Draft' | 'Archived' | 'Inactive' | 'Published';
  history: any[];
  pages: PageNode[];
  createdByScope?: string;
  createdByEntityId?: string | null;
  createdByName?: string;
  unitDetails: {
    companyName: string;
    repName: string;
    address: string;
    contact: string;
    email: string;
    manday: string;
    scope: string;
    dateFrom: string;
    dateTo: string;
    geotag: string;
    startTime: string;
  };
  customResponseSets?: ResponseSet[];
  attachedEquipmentIds?: string[];
  attachedEquipmentNames?: string[];
  facilitySections?: string[];
  cleaningResponsibility?: string[];
  cleaningFrequency?: { value: number; unit: 'Days' | 'Months' | 'Years' };
  pmResponsibility?: string[];
  pmFrequency?: { value: number; unit: 'Days' | 'Months' | 'Years' };
  createdDate?: string;
  modifiedDate?: string;
  questionIdAliases?: Record<string, string[]>;
  questionTextAliases?: Record<string, string[]>;
  observationLinked?: boolean;
  scheduledChecklist?: boolean;
  directAssigned?: boolean;
}

const V = {
  purple: '#6e42ff',
  lightPurpleBg: '#f0eefe',
  containerBg: '#f8f9fc',
  white: '#ffffff',
  border: '#e0e0e0',
  text: '#333333',
  placeholder: '#aaaaaa',
  label: '#555555',
  yesBg: '#e6f4ea', yesText: '#006400',
  noBg: '#fdecea', noText: '#a00000',
  naBg: '#f0f0f0', naText: '#666666',
  fairBg: '#fef3c7', fairText: '#92400e',
  pageHeaderBg: '#e9ecef',
  sectionHeaderBg: '#f0f2f5',
  dangerRed: '#dc3545',
  dangerRedHover: '#c82333',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const PREDEFINED_COLORS = [
  '#13855f', '#ef4444', '#a0aec0', '#f59e0b', '#6e42ff', '#f0eefe',
  '#ffedd5', '#fef9c3', '#dbeafe', '#dcfce7', '#ccfbf1', '#e0f2fe',
];

const getClassForColor = (hex: string) => {
  const map: Record<string, string> = {
    '#13855f': 'yes', '#ef4444': 'no', '#a0aec0': 'na',
    '#f59e0b': 'fair', '#006400': 'yes', '#a00000': 'no',
  };
  return map[hex?.toLowerCase()] || 'custom';
};

const getResponseBtnStyle = (color: string) => {
  const cls = getClassForColor(color);
  const map: Record<string, { bg: string; text: string }> = {
    yes: { bg: V.yesBg, text: V.yesText },
    no: { bg: V.noBg, text: V.noText },
    na: { bg: V.naBg, text: V.naText },
    fair: { bg: V.fairBg, text: V.fairText },
  };
  const s = map[cls] || { bg: V.naBg, text: V.naText };
  return { backgroundColor: s.bg, color: s.text };
};

const NEW_QUESTION_DEFAULT_RESPONSES: ResponseOption[] = [
  { id: '1', text: 'Option 1', color: '#a0aec0', isFlagged: false, score: '' },
  { id: '2', text: 'Option 2', color: '#a0aec0', isFlagged: false, score: '' },
  { id: '3', text: 'N/A', color: '#a0aec0', isFlagged: false, score: '' },
];


const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: `1px solid ${V.border}`,
  borderRadius: '6px', fontSize: '0.95rem', backgroundColor: V.white,
  fontFamily: V.font, boxSizing: 'border-box', outline: 'none',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 500,
  color: V.label, marginBottom: '6px',
};

const formGroupStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', minWidth: '200px',
};

const formRowStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '20px',
};

const ColorPickerPopup = ({ activeColor, onSelect, onClose, position }: {
  activeColor: string; onSelect: (c: string) => void; onClose: () => void;
  position: { top: number; left: number };
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed', zIndex: 1200, backgroundColor: V.white,
      border: `1px solid ${V.border}`, borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '15px',
      width: '230px', top: position.top, left: position.left,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${V.border}`, marginRight: 10, backgroundColor: activeColor }} />
        <input style={{ ...inputStyle, flexGrow: 1, fontSize: '0.85rem' }} value={activeColor} readOnly />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
        {PREDEFINED_COLORS.map(c => (
          <button key={c} onClick={() => { onSelect(c); onClose(); }}
            style={{
              width: 26, height: 26, borderRadius: 4, cursor: 'pointer',
              border: activeColor === c ? `2px solid ${V.purple}` : '2px solid transparent',
              backgroundColor: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {activeColor === c && <Check size={12} color={V.purple} />}
          </button>
        ))}
      </div>
    </div>
  );
};

const MCEditorModal = ({ responses: initialResponses, onSave, onClose }: {
  responses: ResponseOption[];
  onSave: (r: ResponseOption[]) => void;
  onClose: () => void;
}) => {
  const [responses, setResponses] = useState<ResponseOption[]>(() => {
    if (initialResponses.length > 0) {
      const hasNA = initialResponses.some(r => r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na');
      if (!hasNA) {
        return [...initialResponses, { id: `na-${Date.now()}`, text: 'N/A', color: '#a0aec0', isFlagged: false, score: '' }];
      }
      return initialResponses;
    }
    return [
      { id: '1', text: 'Option 1', color: '#a0aec0', isFlagged: false, score: '' },
      { id: '2', text: 'Option 2', color: '#a0aec0', isFlagged: false, score: '' },
      { id: '3', text: 'N/A', color: '#a0aec0', isFlagged: false, score: '' },
    ];
  });
  const [scoringEnabled, setScoringEnabled] = useState(true);
  const [colorPicker, setColorPicker] = useState<{ id: string; top: number; left: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const addResponse = () => {
    setResponses(prev => [...prev, {
      id: `opt-${Date.now()}`, text: `Option ${prev.length + 1}`,
      color: '#a0aec0', isFlagged: false, score: '',
    }]);
  };

  const updateResponse = (id: string, field: keyof ResponseOption, value: any) => {
    setResponses(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeResponse = (id: string) => {
    if (responses.length <= 1) return;
    const target = responses.find(r => r.id === id);
    if (target && (target.text.toLowerCase() === 'n/a' || target.text.toLowerCase() === 'na')) return;
    setResponses(prev => prev.filter(r => r.id !== id));
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) return;
    const fromIdx = responses.findIndex(r => r.id === dragId);
    const toIdx = responses.findIndex(r => r.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const updated = [...responses];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setResponses(updated);
  };
  const handleDragEnd = () => setDragId(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: V.white, borderRadius: '10px',
        boxShadow: '0 5px 20px rgba(0,0,0,0.2)', width: '100%',
        maxWidth: '550px', maxHeight: '80vh', display: 'flex',
        flexDirection: 'column', fontFamily: V.font,
      }}>
        <div style={{
          padding: '20px 25px', borderBottom: `1px solid ${V.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#2d3748' }}>
              Multiple choice responses
            </h2>
            <span style={{ fontSize: '0.85rem', color: V.label }}>
              e.g. {responses.slice(0, 3).map(r => r.text).join(', ')}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" checked={scoringEnabled}
              onChange={e => setScoringEnabled(e.target.checked)}
              style={{ accentColor: V.purple, width: 16, height: 16 }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: V.label }}>Scoring</span>
          </label>
        </div>

        <div style={{ padding: '15px 25px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 500, color: V.label, marginBottom: 10, paddingLeft: 30 }}>
            Response
          </div>

          {responses.map((opt) => (
            <div key={opt.id}
              draggable
              onDragStart={() => handleDragStart(opt.id)}
              onDragOver={(e) => handleDragOver(e, opt.id)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '10px 0', borderBottom: `1px solid #f0f2f5`,
                opacity: dragId === opt.id ? 0.5 : 1,
                cursor: 'grab',
              }}
            >
              <div style={{ paddingTop: 8, color: '#cbd5e0' }}>
                <GripVertical size={16} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    style={{ ...inputStyle, border: `1px solid ${V.purple}`, flex: 1 }}
                    value={opt.text}
                    onChange={e => updateResponse(opt.id, 'text', e.target.value)}
                  />
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setColorPicker({ id: opt.id, top: rect.bottom + 5, left: rect.left });
                    }}
                    style={{
                      width: 22, height: 22, borderRadius: '50%',
                      backgroundColor: opt.color, border: `1px solid ${V.border}`,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#4a5568' }}>
                    <input type="checkbox" checked={opt.isFlagged}
                      onChange={e => updateResponse(opt.id, 'isFlagged', e.target.checked)}
                      style={{ accentColor: V.purple }}
                    />
                    Mark as flagged
                  </label>
                  {scoringEnabled && (
                    <>
                      <span style={{ color: '#cbd5e0' }}>|</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4a5568' }}>
                        Score:
                        <input type="text" value={opt.score}
                          onChange={e => updateResponse(opt.id, 'score', e.target.value)}
                          style={{ ...inputStyle, width: 40, padding: '4px 6px', textAlign: 'center', fontSize: '0.85rem' }}
                        />
                      </label>
                    </>
                  )}
                  {(opt.text.toLowerCase() === 'n/a' || opt.text.toLowerCase() === 'na') ? (
                    <span style={{ marginLeft: 'auto', padding: 4, color: '#cbd5e1', cursor: 'default' }} title="N/A cannot be removed">
                      <Trash2 size={14} />
                    </span>
                  ) : (
                    <button onClick={() => removeResponse(opt.id)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: V.dangerRed, cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button onClick={addResponse} style={{
            background: 'none', border: 'none', color: V.purple,
            fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
            padding: '10px 0', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Plus size={16} /> Add Response
          </button>
        </div>

        <div style={{
          padding: '15px 25px', borderTop: `1px solid ${V.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={() => onSave(responses)} style={{
            padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem',
            fontWeight: 500, cursor: 'pointer', border: 'none',
            backgroundColor: V.purple, color: 'white',
          }}>Save and apply</button>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem',
            fontWeight: 500, cursor: 'pointer', border: `1px solid #e2e8f0`,
            backgroundColor: '#f7fafc', color: '#4a5568',
          }}>Cancel</button>
        </div>
      </div>

      {colorPicker && (
        <div onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          <ColorPickerPopup
            activeColor={responses.find(r => r.id === colorPicker.id)?.color || '#a0aec0'}
            position={{ top: colorPicker.top, left: colorPicker.left }}
            onSelect={(c) => updateResponse(colorPicker.id, 'color', c)}
            onClose={() => setColorPicker(null)}
          />
        </div>
      )}
    </div>
  );
};

const ResponseTypeDropdown = ({ onSelect, onOpenEditor, onDeleteSet, responseSets, onClose }: {
  onSelect: (type: string, responses: ResponseOption[], setId?: string) => void;
  onOpenEditor: (responses?: ResponseOption[], setId?: string) => void;
  onDeleteSet?: (setId: string) => void;
  responseSets: ResponseSet[];
  onClose: () => void;
}) => {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const technicalInputs = [
    { id: 'text', label: 'Text answer', icon: '📝' },
    { id: 'number', label: 'Number', icon: '🔢' },
    { id: 'checkbox', label: 'Checkbox', icon: '☑️' },
    { id: 'datetime', label: 'Date & Time', icon: '📅' },
    { id: 'media', label: 'Media', icon: '📷' },
    { id: 'slider', label: 'Slider', icon: '🎚️' },
    { id: 'annotation', label: 'Annotation', icon: '✏️' },
  ];

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 1000, backgroundColor: '#f0f2f5',
      boxShadow: '0 5px 15px rgba(0,0,0,0.2)', borderRadius: 8,
      overflow: 'hidden', maxWidth: 840, display: 'flex',
      top: '100%', left: 0, marginTop: 5,
    }}>
      <div style={{ flex: 1.5, padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
        <div style={{
          display: 'flex', alignItems: 'center', border: `1px solid #d1d5db`,
          borderRadius: 6, padding: '8px 12px', backgroundColor: V.white,
        }}>
          <Search size={16} color="#6b7280" style={{ marginRight: 8 }} />
          <input
            style={{ border: 'none', outline: 'none', fontSize: 14, flexGrow: 1, color: V.text, background: 'transparent' }}
            placeholder="Search responses" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, color: '#4b5563', margin: 0 }}>Multiple choice</h2>
          <button onClick={() => onOpenEditor()} style={{
            color: V.purple, fontSize: 14, fontWeight: 500, background: 'none',
            border: 'none', cursor: 'pointer',
          }}>Add responses</button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' }}>
          {responseSets.filter(s => s.label.toLowerCase().includes(search.toLowerCase())).map(opt => (
            <li key={opt.id} onClick={() => onSelect('multiple', opt.responses, opt.id)}
              style={{
                display: 'flex', alignItems: 'center', padding: '12px 0',
                borderBottom: '1px solid #e5e7eb', cursor: 'pointer',
              }}
            >
              {opt.responses.map(r => (
                <span key={r.id} style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 13,
                  fontWeight: 500, marginRight: 8, ...getResponseBtnStyle(r.color),
                }}>{r.text}</span>
              ))}
              <button onClick={(e) => { e.stopPropagation(); onOpenEditor(opt.responses, opt.id); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: V.purple, cursor: 'pointer', padding: 5 }}>
                <Pencil size={14} />
              </button>
              {onDeleteSet && (
                <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this response set?')) onDeleteSet(opt.id); }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 5 }}>
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: '#4b5563', marginTop: 0, marginBottom: 8 }}>Global response sets</h3>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            Create global response sets to use them across multiple templates.
          </p>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, backgroundColor: V.white, borderRadius: '0 8px 8px 0' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {technicalInputs.map(t => (
            <li key={t.id} onClick={() => onSelect(t.id, [])}
              style={{
                display: 'flex', alignItems: 'center', padding: '10px 0',
                fontSize: 14, color: '#374151', cursor: 'pointer',
              }}
            >
              <span style={{ marginRight: 12, fontSize: 18 }}>{t.icon}</span>
              <span>{t.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const ScoringPanel = ({ question, onClose, onEditResponseSet }: {
  question: QuestionNode;
  onClose: () => void;
  onEditResponseSet: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const derivedMax = Math.max(0, ...question.responses.map(r => {
    const isNA = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
    return isNA ? 0 : (parseFloat(r.score) || 0);
  }));

  return (
    <div ref={ref} style={{
      position: 'absolute', backgroundColor: V.white, border: `1px solid ${V.border}`,
      borderRadius: 8, boxShadow: '0 5px 15px rgba(0,0,0,0.15)', padding: 20,
      zIndex: 1060, width: 320, top: '100%', right: 0, marginTop: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 15, borderBottom: `1px solid ${V.border}`,
      }}>
        <span style={{ color: V.label, fontWeight: 500, fontSize: '0.9rem' }}>Score calculation</span>
        <div style={{
          display: 'flex', alignItems: 'center', border: `1px solid ${V.border}`,
          borderRadius: 6, padding: '4px 12px', background: '#f8fafc',
        }}>
          <span style={{ fontSize: '0.8rem', color: V.label, marginRight: 4 }}>Max:</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: V.text }}>{derivedMax}</span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: V.label, fontSize: '0.8rem', fontWeight: 500, marginBottom: 8, padding: '0 5px' }}>
          <span>Response</span><span>Marks</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {question.responses.map(r => {
            const isNA = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
            const score = isNA ? 0 : (parseFloat(r.score) || 0);
            const isMax = !isNA && score === derivedMax && derivedMax > 0;
            return (
              <li key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 5px', borderBottom: '1px solid #f0f2f5',
              }}>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 500, ...getResponseBtnStyle(r.color) }}>
                  {r.text}
                </span>
                <span style={{ fontWeight: 600, color: isMax ? '#16a34a' : V.text, fontSize: '0.9rem' }}>
                  {isNA ? '/' : score}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ marginTop: 20, paddingTop: 15, borderTop: `1px solid ${V.border}`, display: 'flex', alignItems: 'center' }}>
        <AlertCircle size={16} color={V.label} style={{ marginRight: 8 }} />
        <button onClick={onEditResponseSet} style={{
          color: V.purple, background: 'none', border: 'none', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'none',
        }}>Edit response set</button>
      </div>
    </div>
  );
};

const RequireEvidencePanel = ({ answer, onSave, onClose }: {
  answer: string;
  onSave: (notes: boolean, media: boolean) => void;
  onClose: () => void;
}) => {
  const [notes, setNotes] = useState(false);
  const [media, setMedia] = useState(false);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 450, height: '100%',
      backgroundColor: V.white, boxShadow: '-2px 0 15px rgba(0,0,0,0.1)',
      zIndex: 1150, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '25px 30px 15px', borderBottom: `1px solid ${V.border}` }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#2d3748', margin: 0 }}>Require evidence</h2>
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 30px', fontSize: '0.95rem', color: '#4a5568' }}>
        <p>Choose the evidence that'll be required when this answer is selected.</p>
        <div style={{
          backgroundColor: V.lightPurpleBg, padding: '10px 15px', borderRadius: 6,
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>If answer is</span>
          <span style={{ padding: '3px 8px', borderRadius: 4, fontWeight: 500, backgroundColor: V.noBg, color: V.noText }}>{answer}</span>
          <span>require</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={notes} onChange={e => setNotes(e.target.checked)} style={{ accentColor: V.purple }} />
            Notes
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={media} onChange={e => setMedia(e.target.checked)} style={{ accentColor: V.purple }} />
            Media
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '20px 30px', borderTop: `1px solid ${V.border}` }}>
        <button onClick={() => onSave(notes, media)} style={{
          padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
          cursor: 'pointer', border: 'none', backgroundColor: V.purple, color: 'white',
        }}>Save and apply</button>
        <button onClick={onClose} style={{
          padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
          cursor: 'pointer', border: `1px solid #e2e8f0`, backgroundColor: '#f7fafc', color: '#4a5568',
        }}>Cancel</button>
      </div>
    </div>
  );
};

const NotifyPanel = ({ answer, onSave, onClose }: {
  answer: string;
  onSave: (data: any) => void;
  onClose: () => void;
}) => {
  const [timing, setTiming] = useState<'immediately' | 'on-completion'>('immediately');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showRecipientPopup, setShowRecipientPopup] = useState(false);
  const [showGroupPopup, setShowGroupPopup] = useState(false);
  const [showUserPopup, setShowUserPopup] = useState(false);

  const groups = ['All users (HACCP)', 'Kitchen Staff', 'Managers', 'Front of House'];
  const users = ['HACCP PRO (you)', 'John Doe', 'Jane Smith', 'Alex Manager'];

  const displayText = () => {
    const parts = [];
    if (selectedGroups.length > 0) parts.push('Groups: ' + selectedGroups.join(', '));
    if (selectedUsers.length > 0) parts.push('Users: ' + selectedUsers.join(', '));
    return parts.length > 0 ? parts.join('; ') : 'Select users, groups or dynamic notifications';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 450, height: '100%',
      backgroundColor: V.white, boxShadow: '-2px 0 15px rgba(0,0,0,0.1)',
      zIndex: 1150, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '25px 30px 15px', borderBottom: `1px solid ${V.border}` }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#2d3748', margin: 0 }}>Notify</h2>
      </div>
      <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 30px', fontSize: '0.95rem', color: '#4a5568', position: 'relative' }}>
        <div style={{
          backgroundColor: '#f3f0ff', padding: '12px 16px', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 14, color: '#555',
        }}>
          <span>🔄</span>
          <span>If answer is</span>
          <span style={{ padding: '2px 8px', borderRadius: 12, fontWeight: 500, fontSize: 12, backgroundColor: '#ffebee', color: '#d32f2f', border: '1px solid #ef9a9a' }}>{answer}</span>
          <span>notify</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: V.text, marginBottom: 8 }}>Send a notification to</label>
          <div style={{ position: 'relative' }}>
            <div onClick={() => setShowRecipientPopup(!showRecipientPopup)}
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid #ced4da`,
                borderRadius: 6, backgroundColor: V.white, fontSize: 14,
                color: selectedGroups.length > 0 || selectedUsers.length > 0 ? V.text : '#777',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', boxSizing: 'border-box',
              }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayText()}</span>
              <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>▾</span>
            </div>

            {showRecipientPopup && !showGroupPopup && !showUserPopup && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1200,
              }}>
                <div style={{ padding: '8px 0', maxHeight: 250, overflowY: 'auto' }}>
                  <div onClick={() => setShowGroupPopup(true)}
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: V.text }}>
                    <span style={{ marginRight: 12 }}>👥</span>
                    <span style={{ flexGrow: 1 }}>Groups</span>
                    {selectedGroups.length > 0 && <span style={{ fontSize: 14, color: '#777', marginRight: 8 }}>({selectedGroups.length})</span>}
                    <ChevronRight size={16} color={V.purple} />
                  </div>
                  <div onClick={() => setShowUserPopup(true)}
                    style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: V.text }}>
                    <span style={{ marginRight: 12 }}>👤</span>
                    <span style={{ flexGrow: 1 }}>Users</span>
                    {selectedUsers.length > 0 && <span style={{ fontSize: 14, color: '#777', marginRight: 8 }}>({selectedUsers.length})</span>}
                    <ChevronRight size={16} color={V.purple} />
                  </div>
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowRecipientPopup(false)} style={{
                    backgroundColor: V.purple, color: V.white, border: 'none',
                    padding: '8px 16px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}>Done</button>
                </div>
              </div>
            )}

            {showGroupPopup && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1300, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e9ecef' }}>
                  <button onClick={() => setShowGroupPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.purple, display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={20} /> Back
                  </button>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: V.purple, marginLeft: 16 }}>Select group</h3>
                </div>
                <div style={{ padding: 16, flexGrow: 1 }}>
                  {groups.map(g => (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
                      <input type="checkbox" checked={selectedGroups.includes(g)}
                        onChange={e => {
                          if (e.target.checked) setSelectedGroups(prev => [...prev, g]);
                          else setSelectedGroups(prev => prev.filter(x => x !== g));
                        }}
                        style={{ marginRight: 12, width: 18, height: 18, accentColor: V.purple }}
                      />
                      <label style={{ cursor: 'pointer' }}>{g}</label>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowGroupPopup(false)} style={{
                    backgroundColor: V.purple, color: V.white, border: 'none',
                    padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}>Done</button>
                </div>
              </div>
            )}

            {showUserPopup && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1300, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e9ecef' }}>
                  <button onClick={() => setShowUserPopup(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.purple, display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={20} /> Back
                  </button>
                  <h3 style={{ fontSize: 18, fontWeight: 600, color: V.purple, marginLeft: 16 }}>Select user</h3>
                </div>
                <div style={{ padding: 16, flexGrow: 1 }}>
                  {users.map(u => (
                    <div key={u} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
                      <input type="checkbox" checked={selectedUsers.includes(u)}
                        onChange={e => {
                          if (e.target.checked) setSelectedUsers(prev => [...prev, u]);
                          else setSelectedUsers(prev => prev.filter(x => x !== u));
                        }}
                        style={{ marginRight: 12, width: 18, height: 18, accentColor: V.purple }}
                      />
                      <label style={{ cursor: 'pointer' }}>{u}</label>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '16px', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowUserPopup(false)} style={{
                    backgroundColor: V.purple, color: V.white, border: 'none',
                    padding: '10px 20px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  }}>Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: V.text, marginBottom: 8 }}>When should the notification be sent?</p>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: V.text, cursor: 'pointer' }}>
              <input type="radio" name="notifyTiming" value="immediately" checked={timing === 'immediately'}
                onChange={() => setTiming('immediately')} style={{ marginRight: 8, accentColor: V.purple }} />
              Immediately
            </label>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: V.text, cursor: 'pointer' }}>
              <input type="radio" name="notifyTiming" value="on-completion" checked={timing === 'on-completion'}
                onChange={() => setTiming('on-completion')} style={{ marginRight: 8, accentColor: V.purple }} />
              On inspection completion
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 20, marginBottom: 16, fontSize: 13, color: '#555' }}>
          <span style={{ fontSize: 16, color: '#555', marginTop: 2, backgroundColor: '#e0e0e0', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>ℹ</span>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Notification recipients will need access to an inspection to view the results. To receive alerts, recipients must have notifications turned on in their settings.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '20px 30px', borderTop: `1px solid ${V.border}` }}>
        <button onClick={() => onSave({ groups: selectedGroups, users: selectedUsers, timing })} style={{
          padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
          cursor: 'pointer', border: 'none', backgroundColor: V.purple, color: 'white',
        }}>Save and apply</button>
        <button onClick={onClose} style={{
          padding: '10px 20px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
          cursor: 'pointer', border: `1px solid #e2e8f0`, backgroundColor: '#f7fafc', color: '#4a5568',
        }}>Cancel</button>
      </div>
    </div>
  );
};

const QuickAddPanel = ({ onAddQuestion, onAddSection, onAddSubSection, onAddPage, visible, hideAddQuestion }: {
  onAddQuestion: () => void;
  onAddSection: () => void;
  onAddSubSection?: () => void;
  onAddPage?: () => void;
  visible: boolean;
  hideAddQuestion?: boolean;
}) => {
  if (!visible) return null;
  const items: { label: string; icon: React.ReactNode; onClick: () => void }[] = [];
  if (!hideAddQuestion) items.push({ label: 'Question', icon: <Plus size={22} color={V.yesText} strokeWidth={2.5} />, onClick: onAddQuestion });
  items.push({ label: 'Section', icon: <FileText size={22} color={V.purple} strokeWidth={2} />, onClick: onAddSection });
  if (onAddSubSection) items.push({ label: 'Sub Section', icon: <ListTree size={22} color="#8b5cf6" strokeWidth={2} />, onClick: onAddSubSection });
  if (onAddPage) items.push({ label: 'Page', icon: <Layers size={22} color="#6366f1" strokeWidth={2} />, onClick: onAddPage });
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 15,
        left: -120,
        width: 100,
        backgroundColor: V.white,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 30,
        border: `1px solid ${V.border}`,
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <div style={{ height: 1, backgroundColor: '#eee', margin: '0 4px' }} />}
          <div
            onClick={e => { e.stopPropagation(); item.onClick(); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 5px', cursor: 'pointer', borderRadius: 6, textAlign: 'center',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.lightPurpleBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {item.icon}
            <span style={{ fontSize: '0.8rem', color: V.label, fontWeight: 600, marginTop: 2 }}>{item.label}</span>
          </div>
        </React.Fragment>
      ))}
      <div style={{
        position: 'absolute',
        top: 28,
        right: -10,
        width: 0, height: 0,
        borderTop: '10px solid transparent',
        borderBottom: '10px solid transparent',
        borderLeft: `10px solid ${V.white}`,
        filter: 'drop-shadow(2px 0 1px rgba(0,0,0,0.08))',
      }} />
    </div>
  );
};

interface AuditChecklistCreatorProps {
  checklist: ChecklistTemplate;
  onSave: (c: ChecklistTemplate, silent?: boolean) => void;
  onSaveNow?: (c: ChecklistTemplate) => void;
  onCancel: () => void;
  sopNames?: string[];
  sopSubTopics?: Record<string, string[]>;
  locationNames?: string[];
  departmentNames?: string[];
  fixedPages?: { title: string }[];
  entities?: Entity[];
  currentScope?: HierarchyScope;
  userRootId?: string | null;
  userName?: string;
}

const SearchableSelectDropdown = ({ options, value, onChange, placeholder, excludeValues = [] }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  excludeValues?: string[];
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => {
    const matchSearch = o.toLowerCase().includes(search.toLowerCase());
    const notExcluded = !excludeValues.includes(o) || o === value;
    return matchSearch && notExcluded;
  });

  return (
    <div ref={ref} style={{ position: 'relative', flexGrow: 1, minWidth: 150 }}>
      <div
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '4px 8px', borderRadius: 6, minHeight: 32,
          border: open ? '1.5px solid #7c3aed' : '1px solid transparent',
          background: open ? '#faf5ff' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <span style={{
          flexGrow: 1, fontSize: value ? '1.1rem' : '0.95rem',
          fontWeight: value ? 600 : 400,
          color: value ? '#6d28d9' : '#9ca3af',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} style={{
          color: '#6d28d9', transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
        }} />
      </div>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
          maxHeight: 260, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
              borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb',
            }}>
              <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search or type custom..."
                autoFocus
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: '0.85rem', width: '100%', color: '#1f2937',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={12} style={{ color: '#9ca3af' }} />
                </button>
              )}
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 200, padding: '4px 0' }}>
            {search.trim() && !filtered.some(o => o.toLowerCase() === search.trim().toLowerCase()) && (
              <div
                onClick={() => { onChange(search.trim()); setOpen(false); setSearch(''); }}
                style={{
                  padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#7c3aed', fontWeight: 600,
                  backgroundColor: '#f5f3ff', borderBottom: '1px solid #ede9fe',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ede9fe'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f5f3ff'; }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} />
                <span>Use &ldquo;{search.trim()}&rdquo;</span>
              </div>
            )}
            {filtered.length === 0 && !search.trim() ? (
              <div style={{ padding: '12px 16px', fontSize: '0.82rem', color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>
                Type to add a custom entry
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = opt === value;
                return (
                  <div
                    key={opt}
                    onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      color: isSelected ? '#7c3aed' : '#374151',
                      fontWeight: isSelected ? 600 : 400,
                      backgroundColor: isSelected ? '#f5f3ff' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                    {isSelected && <Check size={14} style={{ color: '#7c3aed', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AuditChecklistCreator: React.FC<AuditChecklistCreatorProps> = ({ checklist, onSave, onSaveNow, onCancel, sopNames = [], sopSubTopics = {}, locationNames = [], departmentNames = [], fixedPages, entities = [], currentScope, userRootId, userName }) => {
  const [responseSets, setResponseSets] = useState<ResponseSet[]>(() => {
    return [...(checklist.customResponseSets || [])];
  });

  const [workingDoc, setWorkingDoc] = useState<ChecklistTemplate>(() => ({
    ...checklist,
    pages: checklist.pages.length > 0 ? checklist.pages.map(p => ({
      ...p,
      sections: p.sections.map(s => ({
        ...s,
        category: (s as any).category || '',
        questions: s.questions.map(q => ({
          ...q,
          maxScore: (q as any).maxScore || 0,
          logicRules: (q as any).logicRules || [],
          responsibility: (q as any).responsibility || [],
        })),
      })),
    })) : [{
      id: 'p1', title: '',
      sections: [
        { id: 's1', title: 'New Section', isApplicable: true, risk: 'Indiv.' as SectionRisk, category: '', questions: [{ id: 'q1', text: '', responseType: 'multiple', responses: [...NEW_QUESTION_DEFAULT_RESPONSES], risk: 'Low' as RiskLevel, category: '', requirement: '', isRequired: false, isMultipleSelection: false, isFlagged: true, flaggedValue: 'No', maxScore: 0, logicRules: [] }] },
      ],
    }],
  }));

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    checklist.pages.forEach(p => p.sections.forEach(s => {
      ids.add(s.id);
      (s.subSections || []).forEach(ss => ids.add(ss.id));
    }));
    return ids;
  });
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [scoringPanelId, setScoringPanelId] = useState<string | null>(null);
  const [mcEditor, setMcEditor] = useState<{ pIdx: number; sIdx: number; qIdx: number; responses: ResponseOption[]; editingSetId?: string } | null>(null);
  const [addItemPopup, setAddItemPopup] = useState(false);
  const [downloadPopup, setDownloadPopup] = useState(false);
  const [evidencePanel, setEvidencePanel] = useState<{ qId: string; ruleId: string; triggerId: string; answer: string } | null>(null);
  const [notifyPanel, setNotifyPanel] = useState<{ qId: string; ruleId: string; triggerId: string; answer: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const DEFAULT_CATEGORIES = ['Process', 'Hygiene', 'Maintenance', 'Training', 'Documentation'];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const [categoryDropdownId, setCategoryDropdownId] = useState<string | null>(null);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [dragSection, setDragSection] = useState<{ pIdx: number; sIdx: number } | null>(null);
  const [dragQuestion, setDragQuestion] = useState<{ pIdx: number; sIdx: number; qIdx: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'section' | 'question'; pIdx: number; sIdx: number; qIdx?: number; position: 'before' | 'after' } | null>(null);
  const [moveModal, setMoveModal] = useState<{ pIdx: number; sIdx: number; qIdx: number; questionText: string; subIdx?: number } | null>(null);
  const [bulkMoveIds, setBulkMoveIds] = useState<Set<string>>(new Set());
  const [bulkMoveModal, setBulkMoveModal] = useState(false);
  const [moveSubSectionModal, setMoveSubSectionModal] = useState<{ pIdx: number; sIdx: number; subIdx: number; title: string } | null>(null);
  const [deleteQuestionConfirm, setDeleteQuestionConfirm] = useState<{
    type: 'question' | 'subsection_question';
    pIdx: number; sIdx: number; qIdx: number; subIdx?: number;
    questionText: string;
  } | null>(null);
  const [moveSectionModal, setMoveSectionModal] = useState<{ pIdx: number; sIdx: number; title: string } | null>(null);
  const [movePageModal, setMovePageModal] = useState<{ pIdx: number; title: string } | null>(null);
  const [moveModalExpanded, setMoveModalExpanded] = useState<Set<string>>(new Set());

  type DeletedQuestion = { id: string; text: string; page: string; section: string };
  const [deletedQuestions, setDeletedQuestions] = useState<DeletedQuestion[]>([]);
  const [historyMappingModal, setHistoryMappingModal] = useState(false);
  const [historyMappings, setHistoryMappings] = useState<Record<string, string>>({});

  const csvFileRef = useRef<HTMLInputElement>(null);
  const bulkCsvRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [activeCreatorTab, setActiveCreatorTab] = useState<'editor' | 'master'>('editor');

  const mergeFromMasterChecklist = (generated: ChecklistTemplate, navigate = true) => {
    setWorkingDoc(prev => {
      const incomingQIds = new Set<string>();
      generated.pages.forEach(p => {
        p.sections.forEach(s => {
          (s.questions || []).forEach(q => incomingQIds.add(q.id));
          (s.subSections || []).forEach(ss => (ss.questions || []).forEach(q => incomingQIds.add(q.id)));
        });
      });

      const removedPrefixes: string[] = (generated as any)._removedQuestionPrefixes || [];

      const aliasOldIds = new Set<string>();
      const idAliases = generated.questionIdAliases || {};
      Object.values(idAliases).forEach((arr: string[]) => {
        if (Array.isArray(arr)) arr.forEach(id => { if (id) aliasOldIds.add(id); });
      });

      const shouldRemove = (q: QuestionNode) =>
        incomingQIds.has(q.id) ||
        aliasOldIds.has(q.id) ||
        (removedPrefixes.length > 0 && removedPrefixes.some(pfx => q.id.startsWith(pfx)));

      const evict = (questions: QuestionNode[]) => questions.filter(q => !shouldRemove(q));
      const evictedPrev = {
        ...prev,
        pages: prev.pages.map(pg => ({
          ...pg,
          sections: pg.sections.map(sec => ({
            ...sec,
            questions: evict(sec.questions || []),
            subSections: (sec.subSections || []).map(ss => ({
              ...ss,
              questions: evict(ss.questions || []),
            })),
          })),
        })),
      };

      const existingPageTitles = new Set(evictedPrev.pages.map(p => p.title));
      const newPages = generated.pages.filter(p => !existingPageTitles.has(p.title));
      const updatedPages = evictedPrev.pages.map(existing => {
        const match = generated.pages.find(gp => gp.title === existing.title);
        if (!match) return existing;
        const existingSecTitles = new Set(existing.sections.map(s => s.title));
        const newSections = match.sections.filter(s => !existingSecTitles.has(s.title));
        const updatedSections = existing.sections.map(sec => {
          const matchSec = match.sections.find(ms => ms.title === sec.title);
          if (!matchSec) return sec;
          // After eviction, existingQIds is clean — no need to re-deduplicate,
          // but keep the guard for safety against any edge case
          const existingQIds = new Set((sec.questions || []).map(q => q.id));
          const newTopQs = (matchSec.questions || []).filter(q => !existingQIds.has(q.id));
          const existingSubTitles = new Set((sec.subSections || []).map(ss => ss.title));
          const newSubSections = (matchSec.subSections || []).filter(ss => !existingSubTitles.has(ss.title));
          const updatedSubSections = (sec.subSections || []).map(existingSS => {
            const matchSS = (matchSec.subSections || []).find(mss => mss.title === existingSS.title);
            if (!matchSS) return existingSS;
            const existingSSQIds = new Set((existingSS.questions || []).map(q => q.id));
            const newSSQs = (matchSS.questions || []).filter(q => !existingSSQIds.has(q.id));
            return { ...existingSS, questions: [...(existingSS.questions || []), ...newSSQs] };
          });
          return {
            ...sec,
            questions: [...(sec.questions || []), ...newTopQs],
            subSections: [...updatedSubSections, ...newSubSections],
          };
        });
        return { ...existing, sections: [...updatedSections, ...newSections] };
      });
      const merged: any = { ...evictedPrev, status: evictedPrev.status === 'Active' ? 'Active' : 'Draft', pages: [...updatedPages, ...newPages] };
      if (generated.questionIdAliases) {
        const existingIdAliases: Record<string, string[]> = evictedPrev.questionIdAliases || {};
        const accIdAliases: Record<string, string[]> = {};
        Object.entries(existingIdAliases).forEach(([k, v]) => { accIdAliases[k] = [...v]; });
        Object.entries(generated.questionIdAliases as Record<string, string[]>).forEach(([newId, oldIds]) => {
          if (!accIdAliases[newId]) accIdAliases[newId] = [];
          (oldIds || []).forEach((oid: string) => { if (oid && !accIdAliases[newId].includes(oid)) accIdAliases[newId].push(oid); });
        });
        merged.questionIdAliases = Object.keys(accIdAliases).length > 0 ? accIdAliases : undefined;
      }
      if (generated.questionTextAliases) {
        const existingTextAliases: Record<string, string[]> = evictedPrev.questionTextAliases || {};
        const accTextAliases: Record<string, string[]> = {};
        Object.entries(existingTextAliases).forEach(([k, v]) => { accTextAliases[k] = [...(v as string[])]; });
        Object.entries(generated.questionTextAliases as Record<string, string[]>).forEach(([newText, oldTexts]) => {
          if (!accTextAliases[newText]) accTextAliases[newText] = [];
          (oldTexts || []).forEach((ot: string) => { if (ot && !accTextAliases[newText].includes(ot)) accTextAliases[newText].push(ot); });
        });
        merged.questionTextAliases = Object.keys(accTextAliases).length > 0 ? accTextAliases : undefined;
      }
      return merged;
    });
    if (navigate) setActiveCreatorTab('editor');
    triggerAutosave();
  };

  // --- BULK UPLOAD STATE ---
  type BulkPreviewRow = {
    sectionTitle: string;
    sectionRisk: SectionRisk;
    subSectionTitle: string;
    subSectionRisk: SectionRisk;
    questionText: string;
    requirement: string;
    questionRisk: RiskLevel;
    category: string;
    responsibility: string[];
    maxMarks: number;
    isExistingSection: boolean;
  };
  const [bulkUploadModal, setBulkUploadModal] = useState<{ pIdx: number; pageName: string } | null>(null);
  const [bulkPreviewRows, setBulkPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [bulkParseError, setBulkParseError] = useState('');
  const [bulkRefOpen, setBulkRefOpen] = useState<Record<string, boolean>>({});

  const updateBulkRow = (rowIndex: number, field: keyof BulkPreviewRow, value: any) => {
    setBulkPreviewRows(prev => prev.map((r, i) => i === rowIndex ? { ...r, [field]: value } : r));
  };

  const maxMarksOptions = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

  const downloadRefCsv = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportChecklistToExcel = async (groupBy: 'department' | 'location' = 'department') => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    type RowData = { page: string; section: string; subSection: string; question: string; requirement: string; risk: string; category: string; responsibility: string; maxMarks: number; responseOptions: string };
    const allRows: RowData[] = [];

    workingDoc.pages.forEach(page => {
      page.sections.forEach(section => {
        const addQ = (q: QuestionNode, subTitle: string) => {
          allRows.push({
            page: page.title || '',
            section: section.title || '',
            subSection: subTitle,
            question: q.text || '',
            requirement: q.requirement || '',
            risk: q.risk || 'Low',
            category: q.category || '',
            responsibility: (q.responsibility || []).join(' | '),
            maxMarks: q.maxScore || 0,
            responseOptions: (q.responses || []).map(r => `${r.text} (${r.score})`).join(', '),
          });
        };
        (section.questions || []).forEach(q => addQ(q, ''));
        (section.subSections || []).forEach(ss => {
          (ss.questions || []).forEach(q => addQ(q, ss.title || ''));
        });
      });
    });

    const colDefs = [
      { header: 'Page', key: 'page', width: 18 },
      { header: 'Section', key: 'section', width: 25 },
      { header: 'Sub-Section', key: 'subSection', width: 22 },
      { header: 'Question', key: 'question', width: 45 },
      { header: 'Standard / Requirement', key: 'requirement', width: 35 },
      { header: 'Risk', key: 'risk', width: 12 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Responsibility', key: 'responsibility', width: 28 },
      { header: 'Max Marks', key: 'maxMarks', width: 12 },
      { header: 'Response Options', key: 'responseOptions', width: 35 },
    ];

    const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0891B2' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    const styleSheet = (ws: ExcelJS.Worksheet) => {
      const hRow = ws.getRow(1);
      hRow.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderStyle;
      });
      hRow.height = 24;
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const stripe: ExcelJS.FillPattern = r % 2 === 0 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } } : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        row.eachCell(cell => {
          cell.fill = stripe;
          cell.border = borderStyle;
          cell.alignment = { vertical: 'top', wrapText: true };
          cell.font = { size: 10 };
        });
      }
    };

    const addRowsToSheet = (ws: ExcelJS.Worksheet, rows: RowData[]) => {
      ws.columns = colDefs;
      rows.forEach(r => ws.addRow(r));
      styleSheet(ws);
    };

    const consolidatedWs = workbook.addWorksheet('All Questions');
    addRowsToSheet(consolidatedWs, allRows);

    const groupMap = new Map<string, RowData[]>();
    allRows.forEach(row => {
      if (groupBy === 'location') {
        const key = row.page || 'Unassigned';
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(row);
      } else {
        const depts = row.responsibility.split('|').map(d => d.trim()).filter(Boolean);
        if (depts.length === 0) {
          const key = 'Unassigned';
          if (!groupMap.has(key)) groupMap.set(key, []);
          groupMap.get(key)!.push(row);
        } else {
          depts.forEach(dept => {
            if (!groupMap.has(dept)) groupMap.set(dept, []);
            groupMap.get(dept)!.push(row);
          });
        }
      }
    });

    const sortedKeys = [...groupMap.keys()].sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b));
    const usedNames = new Set<string>(['All Questions']);
    sortedKeys.forEach(key => {
      let safeName = key.replace(/[\\/*?:\[\]]/g, '_').slice(0, 31) || 'Group';
      if (usedNames.has(safeName)) {
        let counter = 2;
        while (usedNames.has(`${safeName.slice(0, 28)}_${counter}`)) counter++;
        safeName = `${safeName.slice(0, 28)}_${counter}`;
      }
      usedNames.add(safeName);
      const ws = workbook.addWorksheet(safeName);
      addRowsToSheet(ws, groupMap.get(key)!);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const labelStr = groupBy === 'location' ? 'Location_wise' : 'Department_wise';
    link.download = `${(workingDoc.title || 'Audit_Checklist').replace(/[^a-zA-Z0-9]/g, '_')}_${labelStr}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadBulkSampleCsv = (pageName: string) => {
    const csv = `SectionTitle,SubSectionTitle,QuestionText,StandardRequirement,QuestionRisk,Category,Responsibility,MaximumMarks\n"Storage Control","Chilled & Frozen Storage","Are food opened from original packaging stored in food grade containers?","Check container labels and dates.","High","Process","Main Kitchen","6"\n"Storage Control","Chilled & Frozen Storage","Is the cold room temperature maintained at 0-5°C?","Check temperature logs daily.","High","Process","Main Kitchen","6"\n"Storage Control","Dry Storage","Are all items stored 6 inches above floor?","Inspect storage racks monthly.","Medium","Hygiene","Housekeeping","4"\n"Opening Procedures","","Is the front door unlocked?","Ensure door is fully unlocked and accessible.","Low","Process","Front Office|Housekeeping","6"\n"Opening Procedures","","Are all lights working?","Check all public and staff area lights.","Medium","Maintenance","Engineering","4"\n"Sanitation","Floor Cleaning","Has the floor been mopped?","Refer to cleaning SOP C-01.","Low","Hygiene","Housekeeping|Main Kitchen","6"`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `bulk_questions_${(pageName || 'page').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>, pIdx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkParseError('');
    setBulkPreviewRows([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseBulkCsv(text, pIdx);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseBulkCsv = (csvString: string, pIdx: number) => {
    const rows = csvString.split(/\r\n|\n/).filter(r => r.trim());
    if (rows.length < 2) { setBulkParseError('CSV must have at least a header row and one data row.'); return; }

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let inQuote = false, cur = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseRow(rows[0]).map(h => h.toLowerCase().replace(/\s/g, ''));
    const req = ['sectiontitle', 'questiontext'];
    const missing = req.filter(r => !headers.includes(r));
    if (missing.length > 0) { setBulkParseError(`Missing required columns: ${missing.join(', ')}. Required: SectionTitle, QuestionText`); return; }

    const idx = {
      section: headers.indexOf('sectiontitle'),
      sectionRisk: headers.indexOf('sectionrisk'),
      subSection: headers.indexOf('subsectiontitle'),
      subSectionRisk: headers.indexOf('subsectionrisk'),
      question: headers.indexOf('questiontext'),
      requirement: headers.indexOf('standardrequirement'),
      questionRisk: headers.indexOf('questionrisk'),
      category: headers.indexOf('category'),
      responsibility: headers.indexOf('responsibility'),
      maxMarks: headers.indexOf('maximummarks'),
    };

    const existingSectionTitles = new Set(workingDoc.pages[pIdx]?.sections.map(s => s.title.trim().toLowerCase()) || []);
    const riskMap: Record<string, SectionRisk> = { individual: 'Indiv.', indiv: 'Indiv.', low: 'Low', medium: 'Med', med: 'Med', high: 'High' };
    const qRiskMap: Record<string, RiskLevel> = { low: 'Low', medium: 'Medium', med: 'Medium', high: 'High' };

    const preview: BulkPreviewRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = parseRow(rows[i]);
      const sectionTitle = (idx.section >= 0 ? cells[idx.section] : '') || '';
      const questionText = (idx.question >= 0 ? cells[idx.question] : '') || '';
      if (!sectionTitle || !questionText) continue;
      const sRiskRaw = (idx.sectionRisk >= 0 ? cells[idx.sectionRisk] : '') || 'Individual';
      const subSectionTitle = (idx.subSection >= 0 ? cells[idx.subSection] : '') || '';
      const ssRiskRaw = (idx.subSectionRisk >= 0 ? cells[idx.subSectionRisk] : '') || 'Individual';
      const qRiskRaw = (idx.questionRisk >= 0 ? cells[idx.questionRisk] : '') || 'Low';
      const catRaw = (idx.category >= 0 ? cells[idx.category] : '') || '';
      const respRaw = (idx.responsibility >= 0 ? cells[idx.responsibility] : '') || '';
      const maxMarksRaw = (idx.maxMarks >= 0 ? cells[idx.maxMarks] : '') || '';
      preview.push({
        sectionTitle,
        sectionRisk: riskMap[sRiskRaw.toLowerCase()] || 'Indiv.',
        subSectionTitle,
        subSectionRisk: riskMap[ssRiskRaw.toLowerCase()] || 'Indiv.',
        questionText,
        requirement: (idx.requirement >= 0 ? cells[idx.requirement] : '') || '',
        questionRisk: qRiskMap[qRiskRaw.toLowerCase()] || 'Low',
        category: catRaw,
        responsibility: respRaw ? respRaw.split('|').map(r => r.trim()).filter(Boolean) : [],
        maxMarks: parseInt(maxMarksRaw) || 0,
        isExistingSection: existingSectionTitles.has(sectionTitle.trim().toLowerCase()),
      });
    }

    if (preview.length === 0) { setBulkParseError('No valid question rows found. Ensure SectionTitle and QuestionText columns are filled.'); return; }
    setBulkPreviewRows(preview);
  };

  const findResponseSetByMaxScore = useCallback((maxMarks: number): { set: ResponseSet; responses: ResponseOption[] } | null => {
    if (maxMarks <= 0) return null;
    for (const set of responseSets) {
      const maxInSet = Math.max(...set.responses.map(r => parseFloat(r.score) || 0));
      if (maxInSet === maxMarks) {
        return { set, responses: set.responses };
      }
    }
    return null;
  }, [responseSets]);

  const availableAutoMarks = useMemo(() => {
    const marks = new Set<number>();
    for (const set of responseSets) {
      const max = Math.max(0, ...set.responses.map(r => parseFloat(r.score) || 0));
      if (max > 0) marks.add(max);
    }
    return Array.from(marks).sort((a, b) => a - b);
  }, [responseSets]);

  const applyMaxMarksToQuestion = useCallback((pIdx: number, sIdx: number, qIdx: number, marks: number) => {
    const matched = findResponseSetByMaxScore(marks);
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const questions = [...sections[sIdx].questions];
      questions[qIdx] = {
        ...questions[qIdx],
        ...(matched ? {
          responses: matched.responses,
          responseType: 'multiple',
          responseSetId: matched.set.id,
          maxScore: marks,
        } : { maxScore: 0 }),
      };
      sections[sIdx] = { ...sections[sIdx], questions };
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  }, [findResponseSetByMaxScore]);

  const applyMaxMarksToSubQuestion = useCallback((pIdx: number, sIdx: number, subIdx: number, qIdx: number, marks: number) => {
    const matched = findResponseSetByMaxScore(marks);
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      const sub = { ...subs[subIdx], questions: [...subs[subIdx].questions] };
      sub.questions[qIdx] = {
        ...sub.questions[qIdx],
        ...(matched ? {
          responses: matched.responses,
          responseType: 'multiple',
          responseSetId: matched.set.id,
          maxScore: marks,
        } : { maxScore: 0 }),
      };
      subs[subIdx] = sub;
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  }, [findResponseSetByMaxScore]);

  const commitBulkUpload = (pIdx: number) => {
    if (bulkPreviewRows.length === 0) return;

    setWorkingDoc(prev => {
      const pages = prev.pages.map((page, pi) => {
        if (pi !== pIdx) return page;
        const sections = [...page.sections.map(s => ({
          ...s, questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        }))];

        bulkPreviewRows.forEach(row => {
          const matchedSet = findResponseSetByMaxScore(row.maxMarks);
          const newQuestion: QuestionNode = {
            id: `q-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            text: row.questionText,
            responseType: 'multiple',
            responses: matchedSet ? [...matchedSet.responses] : [...NEW_QUESTION_DEFAULT_RESPONSES],
            responseSetId: matchedSet ? matchedSet.set.id : undefined,
            risk: row.questionRisk,
            requirement: row.requirement,
            isRequired: false,
            isMultipleSelection: false,
            isFlagged: true,
            flaggedValue: 'No',
            maxScore: matchedSet ? row.maxMarks : 0,
            logicRules: [],
            category: row.category || '',
            responsibility: row.responsibility || [],
          };

          let existingIdx = sections.findIndex(s => s.title.trim().toLowerCase() === row.sectionTitle.trim().toLowerCase());
          if (existingIdx < 0) {
            sections.push({
              id: `s-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: row.sectionTitle,
              isApplicable: true,
              risk: row.sectionRisk,
              category: '',
              questions: [],
              subSections: [],
            });
            existingIdx = sections.length - 1;
          }

          const section = sections[existingIdx];
          if (row.subSectionTitle.trim()) {
            if (!section.subSections) section.subSections = [];
            let ssIdx = section.subSections.findIndex(ss => ss.title.trim().toLowerCase() === row.subSectionTitle.trim().toLowerCase());
            if (ssIdx < 0) {
              section.subSections.push({
                id: `ss-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                title: row.subSectionTitle,
                isApplicable: true,
                risk: row.subSectionRisk,
                questions: [],
              });
              ssIdx = section.subSections.length - 1;
            }
            section.subSections[ssIdx].questions.push(newQuestion);
          } else {
            section.questions.push(newQuestion);
          }
        });

        return { ...page, sections };
      });
      return { ...prev, pages };
    });

    triggerAutosave();
    setBulkUploadModal(null);
    setBulkPreviewRows([]);
    setBulkParseError('');
    setBulkRefOpen({});
  };

  const workingDocRef = useRef(workingDoc);
  useEffect(() => { workingDocRef.current = workingDoc; }, [workingDoc]);

  const triggerAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      onSave(workingDocRef.current, true);
    }, 1500);
  }, [onSave]);

  const handleUpdateUnit = (field: keyof ChecklistTemplate['unitDetails'], value: string) => {
    setWorkingDoc(prev => ({ ...prev, unitDetails: { ...prev.unitDetails, [field]: value } }));
    triggerAutosave();
  };

  const handleUpdateQuestion = (pIdx: number, sIdx: number, qIdx: number, field: keyof QuestionNode, value: any) => {
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const questions = [...sections[sIdx].questions];
      questions[qIdx] = { ...questions[qIdx], [field]: value };
      sections[sIdx] = { ...sections[sIdx], questions };
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const handleUpdateSection = (pIdx: number, sIdx: number, field: keyof SectionNode, value: any) => {
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      sections[sIdx] = { ...sections[sIdx], [field]: value };
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const handleUpdatePage = (pIdx: number, field: keyof PageNode, value: any) => {
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      pages[pIdx] = { ...pages[pIdx], [field]: value };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const addQuestion = (pIdx: number, sIdx: number, afterIdx: number) => {
    const newId = `q-${Date.now()}`;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const questions = [...sections[sIdx].questions];
      questions.splice(afterIdx + 1, 0, {
        id: newId, text: '', responseType: 'multiple',
        responses: [...NEW_QUESTION_DEFAULT_RESPONSES],
        risk: 'Low', requirement: '', isRequired: false,
        isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
        maxScore: 0, logicRules: [],
      });
      sections[sIdx] = { ...sections[sIdx], questions };
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    setSelectedBlockId(newId);
    triggerAutosave();
  };

  const addSection = (pIdx: number, afterIdx: number) => {
    const newSId = `s-${Date.now()}`;
    const newQId = `q-${Date.now() + 1}`;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      sections.splice(afterIdx + 1, 0, {
        id: newSId, title: 'New Section', isApplicable: true, risk: 'Indiv.', category: '',
        questions: [{
          id: newQId, text: '', responseType: 'multiple',
          responses: [...NEW_QUESTION_DEFAULT_RESPONSES],
          risk: 'Low', requirement: '', isRequired: false,
          isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
          maxScore: 0, logicRules: [],
        }],
      });
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    setSelectedBlockId(newSId);
    triggerAutosave();
  };

  const addPage = () => {
    const ts = Date.now();
    setWorkingDoc(prev => ({
      ...prev,
      pages: [...prev.pages, {
        id: `p-${ts}`, title: '',
        sections: [{
          id: `s-${ts}-0`, title: 'New Section', isApplicable: true, risk: 'Indiv.' as SectionRisk, category: '',
          questions: [{
            id: `q-${ts}-0`, text: '', responseType: 'multiple',
            responses: [...NEW_QUESTION_DEFAULT_RESPONSES],
            risk: 'Low' as RiskLevel, requirement: '', isRequired: false,
            isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
            maxScore: 0, logicRules: [],
          }],
        }],
      }],
    }));
    triggerAutosave();
  };

  const deleteQuestion = (pIdx: number, sIdx: number, qIdx: number) => {
    const q = workingDoc.pages[pIdx]?.sections[sIdx]?.questions[qIdx];
    setDeleteQuestionConfirm({ type: 'question', pIdx, sIdx, qIdx, questionText: q?.text?.trim() || '' });
  };

  const confirmDeleteQuestion = () => {
    if (!deleteQuestionConfirm) return;
    const { type, pIdx, sIdx, qIdx, subIdx } = deleteQuestionConfirm;
    if (type === 'question') {
      const q = workingDoc.pages[pIdx]?.sections[sIdx]?.questions[qIdx];
      const pages = workingDoc.pages.map((p, pi) => {
        if (pi !== pIdx) return p;
        const sections = p.sections.map((s, si) => {
          if (si !== sIdx) return s;
          const questions = [...s.questions];
          questions.splice(qIdx, 1);
          return { ...s, questions };
        });
        return { ...p, sections };
      });
      const newDoc = { ...workingDoc, pages };
      if (q && q.text.trim()) {
        setDeletedQuestions(prev => [...prev, { id: q.id, text: q.text, page: workingDoc.pages[pIdx]?.title || '', section: workingDoc.pages[pIdx]?.sections[sIdx]?.title || '' }]);
      }
      setWorkingDoc(newDoc);
      if (onSaveNow) onSaveNow(newDoc);
      else triggerAutosave();
    } else if (type === 'subsection_question' && subIdx !== undefined) {
      const q = workingDoc.pages[pIdx]?.sections[sIdx]?.subSections?.[subIdx]?.questions[qIdx];
      const pages = workingDoc.pages.map((p, pi) => {
        if (pi !== pIdx) return p;
        const sections = p.sections.map((s, si) => {
          if (si !== sIdx) return s;
          const subs = (s.subSections || []).map((ss, ssI) => {
            if (ssI !== subIdx) return ss;
            const questions = [...ss.questions];
            questions.splice(qIdx, 1);
            return { ...ss, questions };
          });
          return { ...s, subSections: subs };
        });
        return { ...p, sections };
      });
      const newDoc = { ...workingDoc, pages };
      if (q && q.text.trim()) {
        setDeletedQuestions(prev => [...prev, { id: q.id, text: q.text, page: workingDoc.pages[pIdx]?.title || '', section: workingDoc.pages[pIdx]?.sections[sIdx]?.title || '' }]);
      }
      setWorkingDoc(newDoc);
      if (onSaveNow) onSaveNow(newDoc);
      else triggerAutosave();
    }
    setDeleteQuestionConfirm(null);
  };

  const moveQuestionToSection = (fromPIdx: number, fromSIdx: number, fromQIdx: number, toPIdx: number, toSIdx: number, toSubIdx?: number) => {
    setWorkingDoc(prev => {
      const pages = prev.pages.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        })),
      }));
      const [moved] = pages[fromPIdx].sections[fromSIdx].questions.splice(fromQIdx, 1);
      if (toSubIdx !== undefined && pages[toPIdx].sections[toSIdx].subSections) {
        pages[toPIdx].sections[toSIdx].subSections![toSubIdx].questions.push(moved);
      } else {
        pages[toPIdx].sections[toSIdx].questions.push(moved);
      }
      return { ...prev, pages };
    });
    setMoveModal(null);
    triggerAutosave();
  };

  const moveQuestionFromSubSection = (fromPIdx: number, fromSIdx: number, fromSubIdx: number, fromQIdx: number, toPIdx: number, toSIdx: number, toSubIdx?: number) => {
    setWorkingDoc(prev => {
      const pages = prev.pages.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        })),
      }));
      const [moved] = pages[fromPIdx].sections[fromSIdx].subSections![fromSubIdx].questions.splice(fromQIdx, 1);
      if (toSubIdx !== undefined && pages[toPIdx].sections[toSIdx].subSections) {
        pages[toPIdx].sections[toSIdx].subSections![toSubIdx].questions.push(moved);
      } else {
        pages[toPIdx].sections[toSIdx].questions.push(moved);
      }
      return { ...prev, pages };
    });
    setMoveModal(null);
    triggerAutosave();
  };

  const moveSubSection = (fromPIdx: number, fromSIdx: number, fromSubIdx: number, toPIdx: number, toSIdx: number) => {
    if (fromPIdx === toPIdx && fromSIdx === toSIdx) { setMoveSubSectionModal(null); return; }
    setWorkingDoc(prev => {
      const pages = prev.pages.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        })),
      }));
      const [moved] = pages[fromPIdx].sections[fromSIdx].subSections!.splice(fromSubIdx, 1);
      if (!pages[toPIdx].sections[toSIdx].subSections) pages[toPIdx].sections[toSIdx].subSections = [];
      pages[toPIdx].sections[toSIdx].subSections!.push(moved);
      return { ...prev, pages };
    });
    setMoveSubSectionModal(null);
    triggerAutosave();
  };

  const moveSectionToPage = (fromPIdx: number, fromSIdx: number, toPIdx: number) => {
    if (fromPIdx === toPIdx) { setMoveSectionModal(null); return; }
    setWorkingDoc(prev => {
      const pages = prev.pages.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        })),
      }));
      const [moved] = pages[fromPIdx].sections.splice(fromSIdx, 1);
      pages[toPIdx].sections.push(moved);
      return { ...prev, pages };
    });
    setMoveSectionModal(null);
    triggerAutosave();
  };

  const movePageToPosition = (fromPIdx: number, toPIdx: number) => {
    if (fromPIdx === toPIdx) { setMovePageModal(null); return; }
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const [moved] = pages.splice(fromPIdx, 1);
      pages.splice(toPIdx, 0, moved);
      return { ...prev, pages };
    });
    setMovePageModal(null);
    triggerAutosave();
  };

  const toggleBulkSelect = (qId: string) => {
    setBulkMoveIds(prev => {
      const next = new Set(prev);
      next.has(qId) ? next.delete(qId) : next.add(qId);
      return next;
    });
  };

  const bulkMoveQuestions = (toPIdx: number, toSIdx: number, toSubIdx?: number) => {
    if (bulkMoveIds.size === 0) return;
    setWorkingDoc(prev => {
      const pages = prev.pages.map(p => ({
        ...p,
        sections: p.sections.map(s => ({
          ...s,
          questions: [...s.questions],
          subSections: (s.subSections || []).map(ss => ({ ...ss, questions: [...ss.questions] })),
        })),
      }));
      const collected: QuestionNode[] = [];
      for (const pg of pages) {
        for (const sec of pg.sections) {
          const removed = sec.questions.filter(q => bulkMoveIds.has(q.id));
          sec.questions = sec.questions.filter(q => !bulkMoveIds.has(q.id));
          collected.push(...removed);
          for (const ss of (sec.subSections || [])) {
            const removedSub = ss.questions.filter(q => bulkMoveIds.has(q.id));
            ss.questions = ss.questions.filter(q => !bulkMoveIds.has(q.id));
            collected.push(...removedSub);
          }
        }
      }
      if (toSubIdx !== undefined && pages[toPIdx].sections[toSIdx].subSections) {
        pages[toPIdx].sections[toSIdx].subSections![toSubIdx].questions.push(...collected);
      } else {
        pages[toPIdx].sections[toSIdx].questions.push(...collected);
      }
      return { ...prev, pages };
    });
    setBulkMoveIds(new Set());
    setBulkMoveModal(false);
    triggerAutosave();
  };

  const addSubSection = (pIdx: number, sIdx: number) => {
    const ssId = `ss-${Date.now()}`;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      subs.push({
        id: ssId, title: '', isApplicable: true, risk: 'Indiv.' as SectionRisk,
        questions: [],
      });
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    setSelectedBlockId(ssId);
    triggerAutosave();
  };

  const deleteSubSection = (pIdx: number, sIdx: number, subIdx: number, title: string) => {
    if (!confirm(`Delete sub-category "${title || 'Untitled'}" and all its questions?`)) return;
    const page = workingDoc.pages[pIdx];
    const section = page?.sections[sIdx];
    const sub = section?.subSections?.[subIdx];
    if (sub) {
      const collected: DeletedQuestion[] = [];
      sub.questions.forEach(q => {
        if (q.text.trim()) collected.push({ id: q.id, text: q.text, page: page.title || '', section: `${section.title || ''} > ${sub.title || ''}` });
      });
      if (collected.length > 0) setDeletedQuestions(prev => [...prev, ...collected]);
    }
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const sec = { ...sections[sIdx] };
      const subs = [...(sec.subSections || [])];
      subs.splice(subIdx, 1);
      sec.subSections = subs;
      sections[sIdx] = sec;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const duplicateSubSection = (pIdx: number, sIdx: number, subIdx: number) => {
    const sub = workingDoc.pages[pIdx].sections[sIdx].subSections?.[subIdx];
    if (!sub) return;
    if (!confirm(`Duplicate sub-category "${sub.title || 'Untitled'}" and all its questions?`)) return;
    const ts = Date.now();
    const dupQ = (q: QuestionNode, qi: number) => ({
      ...q,
      id: `q-${ts}-${qi}-${Math.random().toString(36).slice(2, 6)}`,
      responses: (q.responses || []).map(r => ({ ...r, id: `r-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
      logicRules: (q.logicRules || []).map(lr => ({
        ...lr,
        id: `lr-${ts}-${Math.random().toString(36).slice(2, 6)}`,
        triggers: (lr.triggers || []).map(t => ({ ...t, id: `t-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
      })),
    });
    const newSub: SubSectionNode = {
      ...sub,
      id: `ss-${ts}`,
      title: `${sub.title} (Copy)`,
      questions: sub.questions.map((q, qi) => dupQ(q, qi)),
    };
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      subs.splice(subIdx + 1, 0, newSub);
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const handleUpdateSubSection = (pIdx: number, sIdx: number, subIdx: number, field: keyof SubSectionNode, value: any) => {
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      subs[subIdx] = { ...subs[subIdx], [field]: value };
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const addQuestionToSubSection = (pIdx: number, sIdx: number, subIdx: number, afterIdx: number) => {
    const newId = `q-${Date.now()}`;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      const sub = { ...subs[subIdx], questions: [...subs[subIdx].questions] };
      sub.questions.splice(afterIdx + 1, 0, {
        id: newId, text: '', responseType: 'multiple',
        responses: [...NEW_QUESTION_DEFAULT_RESPONSES],
        risk: 'Low', requirement: '', isRequired: false,
        isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
        maxScore: 0, logicRules: [],
      });
      subs[subIdx] = sub;
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    setSelectedBlockId(newId);
    triggerAutosave();
  };

  const deleteQuestionFromSubSection = (pIdx: number, sIdx: number, subIdx: number, qIdx: number) => {
    const q = workingDoc.pages[pIdx]?.sections[sIdx]?.subSections?.[subIdx]?.questions[qIdx];
    setDeleteQuestionConfirm({ type: 'subsection_question', pIdx, sIdx, qIdx, subIdx, questionText: q?.text?.trim() || '' });
  };

  const handleUpdateSubSectionQuestion = (pIdx: number, sIdx: number, subIdx: number, qIdx: number, field: keyof QuestionNode, value: any) => {
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const section = { ...sections[sIdx] };
      const subs = [...(section.subSections || [])];
      const sub = { ...subs[subIdx], questions: [...subs[subIdx].questions] };
      sub.questions[qIdx] = { ...sub.questions[qIdx], [field]: value };
      subs[subIdx] = sub;
      section.subSections = subs;
      sections[sIdx] = section;
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const addLogicRuleToSubSection = (pIdx: number, sIdx: number, subIdx: number, qIdx: number) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].subSections?.[subIdx]?.questions[qIdx];
    if (!q) return;
    if (!(q.responses?.length)) { alert('Please define responses before adding logic.'); return; }
    const newRule: LogicRule = { id: `lr-${Date.now()}`, answer: q.responses?.[0]?.text || '', triggers: [] };
    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'logicRules', [...q.logicRules, newRule]);
  };

  const deleteLogicRuleFromSubSection = (pIdx: number, sIdx: number, subIdx: number, qIdx: number, ruleId: string) => {
    if (!confirm('Delete this logic rule?')) return;
    const q = workingDoc.pages[pIdx].sections[sIdx].subSections?.[subIdx]?.questions[qIdx];
    if (!q) return;
    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'logicRules', (q.logicRules || []).filter(r => r.id !== ruleId));
  };

  const addTriggerToRuleInSubSection = (pIdx: number, sIdx: number, subIdx: number, qIdx: number, ruleId: string, actionType: LogicTrigger['actionType'], label: string) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].subSections?.[subIdx]?.questions[qIdx];
    if (!q) return;
    const rule = (q.logicRules || []).find(r => r.id === ruleId);
    if (!rule) return;
    if ((rule.triggers || []).some(t => t.actionType === actionType)) { alert(`'${label}' trigger already added.`); return; }
    const newTrigger: LogicTrigger = { id: `t-${Date.now()}`, actionType, label };
    const updatedRules = (q.logicRules || []).map(r => r.id === ruleId ? { ...r, triggers: [...(r.triggers || []), newTrigger] } : r);
    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'logicRules', updatedRules);
    if (actionType === 'require-evidence') setEvidencePanel({ qId: q.id, ruleId, triggerId: newTrigger.id, answer: rule.answer });
    else if (actionType === 'notify') setNotifyPanel({ qId: q.id, ruleId, triggerId: newTrigger.id, answer: rule.answer });
  };

  const removeTriggerFromSubSection = (pIdx: number, sIdx: number, subIdx: number, qIdx: number, ruleId: string, triggerId: string) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].subSections?.[subIdx]?.questions[qIdx];
    if (!q) return;
    const updatedRules = (q.logicRules || []).map(r => r.id === ruleId ? { ...r, triggers: (r.triggers || []).filter(t => t.id !== triggerId) } : r);
    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'logicRules', updatedRules);
  };

  const collectQuestionsFromSection = (pIdx: number, sIdx: number): DeletedQuestion[] => {
    const page = workingDoc.pages[pIdx];
    const section = page?.sections[sIdx];
    if (!section) return [];
    const result: DeletedQuestion[] = [];
    section.questions.forEach(q => {
      if (q.text.trim()) result.push({ id: q.id, text: q.text, page: page.title || '', section: section.title || '' });
    });
    (section.subSections || []).forEach(ss => {
      ss.questions.forEach(q => {
        if (q.text.trim()) result.push({ id: q.id, text: q.text, page: page.title || '', section: `${section.title || ''} > ${ss.title || ''}` });
      });
    });
    return result;
  };

  const deleteSection = (pIdx: number, sIdx: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" and all its questions?`)) return;
    const collected = collectQuestionsFromSection(pIdx, sIdx);
    if (collected.length > 0) setDeletedQuestions(prev => [...prev, ...collected]);
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      sections.splice(sIdx, 1);
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const deletePage = (pIdx: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}" and all its content?`)) return;
    const page = workingDoc.pages[pIdx];
    const collected: DeletedQuestion[] = [];
    page?.sections.forEach((_, sIdx) => {
      collected.push(...collectQuestionsFromSection(pIdx, sIdx));
    });
    if (collected.length > 0) setDeletedQuestions(prev => [...prev, ...collected]);
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      pages.splice(pIdx, 1);
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const duplicatePage = (pIdx: number) => {
    const page = workingDoc.pages[pIdx];
    if (!confirm(`Duplicate page "${page.title}" and all its content?`)) return;
    const ts = Date.now();
    const newPage: PageNode = {
      id: `p-${ts}`,
      title: `${page.title} (Copy)`,
      sections: page.sections.map((s, si) => ({
        ...s,
        id: `s-${ts}-${si}-${Math.random().toString(36).slice(2, 6)}`,
        questions: s.questions.map((q, qi) => ({
          ...q,
          id: `q-${ts}-${si}-${qi}-${Math.random().toString(36).slice(2, 6)}`,
          responses: (q.responses || []).map(r => ({ ...r, id: `r-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
          logicRules: (q.logicRules || []).map(lr => ({
            ...lr,
            id: `lr-${ts}-${Math.random().toString(36).slice(2, 6)}`,
            triggers: (lr.triggers || []).map(t => ({ ...t, id: `t-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
          })),
        })),
      })),
    };
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      pages.splice(pIdx + 1, 0, newPage);
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const duplicateSection = (pIdx: number, sIdx: number) => {
    const section = workingDoc.pages[pIdx].sections[sIdx];
    if (!confirm(`Duplicate section "${section.title}" and all its questions?`)) return;
    const ts = Date.now();
    const dupQ = (q: QuestionNode, qi: number) => ({
      ...q,
      id: `q-${ts}-${qi}-${Math.random().toString(36).slice(2, 6)}`,
      responses: (q.responses || []).map(r => ({ ...r, id: `r-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
      logicRules: (q.logicRules || []).map(lr => ({
        ...lr,
        id: `lr-${ts}-${Math.random().toString(36).slice(2, 6)}`,
        triggers: (lr.triggers || []).map(t => ({ ...t, id: `t-${ts}-${Math.random().toString(36).slice(2, 6)}` })),
      })),
    });
    const newSection: SectionNode = {
      ...section,
      id: `s-${ts}`,
      title: `${section.title} (Copy)`,
      questions: section.questions.map((q, qi) => dupQ(q, qi)),
      subSections: (section.subSections || []).map((ss, si) => ({
        ...ss,
        id: `ss-${ts}-${si}`,
        questions: ss.questions.map((q, qi) => dupQ(q, qi + 1000 + si * 100)),
      })),
    };
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      sections.splice(sIdx + 1, 0, newSection);
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const handleSectionDrop = (pIdx: number, fromSIdx: number, toSIdx: number) => {
    if (fromSIdx === toSIdx) return;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = [...pages[pIdx].sections];
      const [moved] = sections.splice(fromSIdx, 1);
      sections.splice(toSIdx > fromSIdx ? toSIdx - 1 : toSIdx, 0, moved);
      pages[pIdx] = { ...pages[pIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const handleQuestionDrop = (fromPIdx: number, fromSIdx: number, fromQIdx: number, toPIdx: number, toSIdx: number, toQIdx: number, position: 'before' | 'after') => {
    if (fromPIdx !== toPIdx) return;
    setWorkingDoc(prev => {
      const pages = [...prev.pages];
      const sections = pages[fromPIdx].sections.map(s => ({ ...s, questions: [...s.questions] }));
      const [moved] = sections[fromSIdx].questions.splice(fromQIdx, 1);
      const adjustedToQIdx = (fromSIdx === toSIdx && fromQIdx < toQIdx) ? toQIdx - 1 : toQIdx;
      const insertIdx = position === 'after' ? adjustedToQIdx + 1 : adjustedToQIdx;
      sections[toSIdx].questions.splice(insertIdx, 0, moved);
      pages[fromPIdx] = { ...pages[fromPIdx], sections };
      return { ...prev, pages };
    });
    triggerAutosave();
  };

  const persistCustomSets = useCallback((sets: ResponseSet[]) => {
    setWorkingDoc(prev => ({ ...prev, customResponseSets: [...sets] }));
  }, []);

  const handleResponseSelect = (pIdx: number, sIdx: number, qIdx: number, type: string, responses: ResponseOption[], applyToAll?: boolean, editingSetId?: string) => {
    let assignedSetId: string | undefined;

    if (type === 'multiple' && responses.length > 0) {
      if (editingSetId) {
        const existingSet = responseSets.find(s => s.id === editingSetId);
        if (existingSet) {
          const updatedSets = responseSets.map(s => s.id === editingSetId ? { ...s, label: responses.map(r => r.text).join(' / '), responses } : s);
          setResponseSets(updatedSets);
          persistCustomSets(updatedSets);
          assignedSetId = editingSetId;
        }
      } else {
        const newHash = responses.map(r => r.text).join('|');
        const existingByNew = responseSets.find(s => s.responses.map(r => r.text).join('|') === newHash);
        if (!existingByNew) {
          const newSetId = `custom-${Date.now()}`;
          const newSet: ResponseSet = { id: newSetId, label: responses.map(r => r.text).join(' / '), responses };
          const updated = [...responseSets, newSet];
          setResponseSets(updated);
          persistCustomSets(updated);
          assignedSetId = newSetId;
        } else {
          assignedSetId = existingByNew.id;
        }
      }
    }

    if (applyToAll && editingSetId) {
      setWorkingDoc(prev => ({
        ...prev,
        pages: prev.pages.map(page => ({
          ...page,
          sections: page.sections.map(section => ({
            ...section,
            questions: section.questions.map(q => {
              if (q.responseSetId === editingSetId) {
                return { ...q, responseType: type, responses, responseSetId: assignedSetId };
              }
              return q;
            }),
          })),
        })),
      }));
    } else {
      handleUpdateQuestion(pIdx, sIdx, qIdx, 'responseType', type);
      handleUpdateQuestion(pIdx, sIdx, qIdx, 'responses', responses);
      if (assignedSetId) {
        handleUpdateQuestion(pIdx, sIdx, qIdx, 'responseSetId', assignedSetId);
      }
    }
    setActiveDropdownId(null);
    setMcEditor(null);
    triggerAutosave();
  };

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const togglePageCollapse = (pageId: string) => {
    setCollapsedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const addLogicRule = (pIdx: number, sIdx: number, qIdx: number) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].questions[qIdx];
    if (!(q.responses?.length)) { alert('Please define responses before adding logic.'); return; }
    const newRule: LogicRule = {
      id: `lr-${Date.now()}`,
      answer: q.responses?.[0]?.text || '',
      triggers: [],
    };
    handleUpdateQuestion(pIdx, sIdx, qIdx, 'logicRules', [...q.logicRules, newRule]);
  };

  const deleteLogicRule = (pIdx: number, sIdx: number, qIdx: number, ruleId: string) => {
    if (!confirm('Delete this logic rule?')) return;
    const q = workingDoc.pages[pIdx].sections[sIdx].questions[qIdx];
    handleUpdateQuestion(pIdx, sIdx, qIdx, 'logicRules', (q.logicRules || []).filter(r => r.id !== ruleId));
  };

  const addTriggerToRule = (pIdx: number, sIdx: number, qIdx: number, ruleId: string, actionType: LogicTrigger['actionType'], label: string) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].questions[qIdx];
    const rule = (q.logicRules || []).find(r => r.id === ruleId);
    if (!rule) return;
    if ((rule.triggers || []).some(t => t.actionType === actionType)) {
      alert(`'${label}' trigger already added.`);
      return;
    }
    const newTrigger: LogicTrigger = { id: `t-${Date.now()}`, actionType, label };
    const updatedRules = (q.logicRules || []).map(r =>
      r.id === ruleId ? { ...r, triggers: [...(r.triggers || []), newTrigger] } : r
    );
    handleUpdateQuestion(pIdx, sIdx, qIdx, 'logicRules', updatedRules);

    if (actionType === 'require-evidence') {
      setEvidencePanel({ qId: q.id, ruleId, triggerId: newTrigger.id, answer: rule.answer });
    } else if (actionType === 'notify') {
      setNotifyPanel({ qId: q.id, ruleId, triggerId: newTrigger.id, answer: rule.answer });
    }
  };

  const removeTrigger = (pIdx: number, sIdx: number, qIdx: number, ruleId: string, triggerId: string) => {
    const q = workingDoc.pages[pIdx].sections[sIdx].questions[qIdx];
    const updatedRules = (q.logicRules || []).map(r =>
      r.id === ruleId ? { ...r, triggers: (r.triggers || []).filter(t => t.id !== triggerId) } : r
    );
    handleUpdateQuestion(pIdx, sIdx, qIdx, 'logicRules', updatedRules);
  };

  const handleGetGeotag = () => {
    if (navigator.geolocation) {
      handleUpdateUnit('geotag', 'Fetching...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handleUpdateUnit('geotag', `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        },
        (err) => { handleUpdateUnit('geotag', `Error: ${err.message}`); }
      );
    } else {
      handleUpdateUnit('geotag', 'Geolocation not supported');
    }
  };

  const handleStartAudit = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString();
    handleUpdateUnit('startTime', `${dateStr} ${timeStr}`);
  };

  const downloadSampleCsv = () => {
    const csv = `PageTitle,SectionTitle,SubSectionTitle,QuestionText,StandardRequirement,QuestionRisk,Category,Responsibility,MaximumMarks
"Food Production","Storage Control","Chilled & Frozen Storage","Are food opened from original packaging stored in food grade containers?","Check container labels and dates.","High","Process","Main Kitchen","6"
"Food Production","Storage Control","Chilled & Frozen Storage","Is the cold room temperature maintained at 0-5°C?","Check temperature logs daily.","High","Process","Main Kitchen","6"
"Food Production","Storage Control","Dry Storage","Are all items stored 6 inches above floor?","Inspect storage racks monthly.","Medium","Hygiene","Housekeeping","4"
"Food Production","Opening Procedures","","Is the front door unlocked?","Ensure door is fully unlocked and accessible.","Low","Process","Front Office|Housekeeping","6"
"Food Production","Opening Procedures","","Are all lights working?","Check all public and staff area lights.","Medium","Maintenance","Engineering","4"
"Weekly Tasks","Maintenance","Floor Cleaning","Has the floor been mopped?","Refer to cleaning SOP C-01.","Low","Hygiene","Housekeeping|Main Kitchen","6"`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'sample_questions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      processCsvData(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const processCsvData = (csvString: string) => {
    const rows = csvString.split(/\r\n|\n/).filter(r => r.trim());
    if (rows.length < 2) { alert('CSV must have at least a header and one data row.'); return; }

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let inQuote = false, cur = '';
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseRow(rows[0]).map(h => h.toLowerCase().replace(/\s/g, ''));
    const idx = {
      page: headers.indexOf('pagetitle'),
      section: headers.indexOf('sectiontitle'),
      sectionRisk: headers.indexOf('sectionrisk'),
      subSection: headers.indexOf('subsectiontitle'),
      subSectionRisk: headers.indexOf('subsectionrisk'),
      question: headers.indexOf('questiontext'),
      requirement: headers.indexOf('standardrequirement'),
      questionRisk: headers.indexOf('questionrisk'),
      category: headers.indexOf('category'),
      responsibility: headers.indexOf('responsibility'),
      maxMarks: headers.indexOf('maximummarks'),
    };

    const requiredCols = ['pagetitle', 'sectiontitle', 'questiontext', 'standardrequirement', 'questionrisk'];
    if (requiredCols.some(c => !headers.includes(c))) {
      alert('CSV must contain: PageTitle, SectionTitle, QuestionText, StandardRequirement, QuestionRisk');
      return;
    }

    const riskMap: Record<string, SectionRisk> = { 'individual': 'Indiv.', 'indiv': 'Indiv.', 'low': 'Low', 'medium': 'Med', 'med': 'Med', 'high': 'High' };
    const newPages: PageNode[] = [];
    let currentPage: PageNode | null = null;
    let currentSection: SectionNode | null = null;

    for (let i = 1; i < rows.length; i++) {
      const cells = parseRow(rows[i]);
      const pageTitle = (idx.page >= 0 ? cells[idx.page] : '') || 'Default Page';
      const sectionTitle = (idx.section >= 0 ? cells[idx.section] : '') || 'Default Section';
      const sectionRisk = (idx.sectionRisk >= 0 ? cells[idx.sectionRisk] : '') || 'Individual';
      const subSectionTitle = (idx.subSection >= 0 ? cells[idx.subSection] : '') || '';
      const subSectionRisk = (idx.subSectionRisk >= 0 ? cells[idx.subSectionRisk] : '') || 'Individual';
      const questionText = (idx.question >= 0 ? cells[idx.question] : '') || '';
      const requirement = (idx.requirement >= 0 ? cells[idx.requirement] : '') || '';
      const questionRisk = (idx.questionRisk >= 0 ? cells[idx.questionRisk] : '') || 'Low';
      const category = (idx.category >= 0 ? cells[idx.category] : '') || '';
      const respRaw = (idx.responsibility >= 0 ? cells[idx.responsibility] : '') || '';

      if (!currentPage || currentPage.title !== pageTitle) {
        currentSection = null;
        currentPage = { id: `p-csv-${Date.now()}-${i}`, title: pageTitle, sections: [] };
        newPages.push(currentPage);
      }

      if (!currentSection || currentSection.title !== sectionTitle) {
        currentSection = {
          id: `s-csv-${Date.now()}-${i}`, title: sectionTitle,
          isApplicable: true, risk: riskMap[sectionRisk.toLowerCase()] || 'Indiv.', category: '',
          questions: [], subSections: [],
        };
        currentPage.sections.push(currentSection);
      }

      if (questionText) {
        const maxMarksRaw = (idx.maxMarks >= 0 ? cells[idx.maxMarks] : '') || '';
        const maxMarks = parseInt(maxMarksRaw) || 0;
        const matchedSet = findResponseSetByMaxScore(maxMarks);
        const newQ: QuestionNode = {
          id: `q-csv-${Date.now()}-${i}`, text: questionText, responseType: 'multiple',
          responses: matchedSet ? [...matchedSet.responses] : [...NEW_QUESTION_DEFAULT_RESPONSES],
          responseSetId: matchedSet ? matchedSet.set.id : undefined,
          risk: (questionRisk as RiskLevel) || 'Low', requirement,
          isRequired: false, isMultipleSelection: false, isFlagged: true, flaggedValue: 'No',
          maxScore: matchedSet ? maxMarks : 0, logicRules: [], category,
          responsibility: respRaw ? respRaw.split('|').map(r => r.trim()).filter(Boolean) : [],
        };

        if (subSectionTitle.trim()) {
          if (!currentSection.subSections) currentSection.subSections = [];
          let ssIdx = currentSection.subSections.findIndex(ss => ss.title.trim().toLowerCase() === subSectionTitle.trim().toLowerCase());
          if (ssIdx < 0) {
            currentSection.subSections.push({
              id: `ss-csv-${Date.now()}-${i}`,
              title: subSectionTitle,
              isApplicable: true,
              risk: riskMap[subSectionRisk.toLowerCase()] || 'Indiv.',
              questions: [],
            });
            ssIdx = currentSection.subSections.length - 1;
          }
          currentSection.subSections[ssIdx].questions.push(newQ);
        } else {
          currentSection.questions.push(newQ);
        }
      }
    }

    setWorkingDoc(prev => ({ ...prev, pages: [...prev.pages, ...newPages] }));
    alert('CSV data processed. Please review the editor.');
    triggerAutosave();
  };

  const btnStyle: React.CSSProperties = {
    backgroundColor: V.white, border: `1px solid ${V.border}`, color: V.purple,
    padding: '8px 15px', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 150, backgroundColor: '#e0e0e0',
      fontFamily: V.font, color: V.text, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        backgroundColor: V.white, borderBottom: `1px solid ${V.border}`,
        padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, zIndex: 100, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <button onClick={onCancel} style={{
            background: 'none', border: `1px solid ${V.border}`, borderRadius: 8,
            padding: 6, cursor: 'pointer', color: V.label, display: 'flex', flexShrink: 0,
          }}>
            <ArrowLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: V.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {workingDoc.title || 'Untitled Template'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setShowPreview(true)} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', border: `1px solid ${V.purple}`, backgroundColor: V.white, color: V.purple,
            whiteSpace: 'nowrap',
          }}>
            <Eye size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Preview
          </button>
          <button onClick={() => {
            const warnings: string[] = [];
            workingDoc.pages.forEach(page => {
              page.sections.forEach(section => {
                const secLabel = `${page.title || 'Untitled Page'} → ${section.title || 'Untitled Section'}`;
                section.questions.forEach((q, qi) => {
                  const qLabel = q.text ? (q.text.length > 50 ? q.text.slice(0, 50) + '…' : q.text) : `Question ${qi + 1}`;
                  if (!q.category) warnings.push(`[Uncategorized] ${secLabel}: "${qLabel}"`);
                  if (!q.responsibility || q.responsibility.length === 0) warnings.push(`[Unassigned] ${secLabel}: "${qLabel}"`);
                });
                (section.subSections || []).forEach(sub => {
                  const subLabel = `${secLabel} → ${sub.title || 'Untitled Sub-Category'}`;
                  sub.questions.forEach((q, qi) => {
                    const qLabel = q.text ? (q.text.length > 50 ? q.text.slice(0, 50) + '…' : q.text) : `Question ${qi + 1}`;
                    if (!q.category) warnings.push(`[Uncategorized] ${subLabel}: "${qLabel}"`);
                    if (!q.responsibility || q.responsibility.length === 0) warnings.push(`[Unassigned] ${subLabel}: "${qLabel}"`);
                  });
                });
              });
            });
            if (warnings.length > 0) {
              const maxShow = 15;
              const display = warnings.slice(0, maxShow).join('\n');
              const extra = warnings.length > maxShow ? `\n... and ${warnings.length - maxShow} more` : '';
              const proceed = confirm(`${warnings.length} question(s) have missing category or responsibility:\n\n${display}${extra}\n\nDo you want to save anyway?`);
              if (!proceed) return;
            }
            onSave(workingDoc);
          }} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', border: 'none', backgroundColor: V.purple, color: 'white',
            whiteSpace: 'nowrap',
          }}>
            <Save size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Save
          </button>
          {deletedQuestions.length > 0 && (
            <button onClick={() => { setHistoryMappings({}); setHistoryMappingModal(true); }} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', border: '2px solid #f59e0b', backgroundColor: '#fffbeb', color: '#b45309',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4,
              animation: 'pulse 2s infinite',
            }}>
              <History size={14} />
              Map History ({deletedQuestions.length})
            </button>
          )}
        </div>
      </div>

      {showPreview && (
        <AuditChecklistPreview template={workingDoc} onClose={() => setShowPreview(false)} />
      )}

      {/* BULK UPLOAD MODAL */}
      {bulkUploadModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: V.white, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 1050, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ background: 'linear-gradient(135deg, #0891b2, #0e7490)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={18} color="white" />
                  <h3 style={{ margin: 0, color: 'white', fontSize: '1rem', fontWeight: 700 }}>Bulk Question Upload</h3>
                </div>
                <p style={{ margin: '4px 0 0', color: '#bae6fd', fontSize: '0.78rem' }}>
                  Page: <strong style={{ color: 'white' }}>{bulkUploadModal.pageName}</strong>
                </p>
              </div>
              <button onClick={() => { setBulkUploadModal(null); setBulkPreviewRows([]); setBulkParseError(''); setBulkRefOpen({}); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'white', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* Instructions */}
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#0c4a6e', fontWeight: 600 }}>How it works</p>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.8rem', color: '#075985', lineHeight: 1.7 }}>
                  <li>Prepare a CSV with columns: <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>SectionTitle</code>, <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>SubSectionTitle</code> (optional), <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>QuestionText</code>, <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>StandardRequirement</code>, <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>QuestionRisk</code>, <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>Category</code>, <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>Responsibility</code></li>
                  <li>Questions with a <strong>matching SectionTitle</strong> will be added to that existing section. Use <strong>SubSectionTitle</strong> to group questions into sub-categories within a section.</li>
                  <li>Questions with a <strong>new SectionTitle</strong> will create a new section automatically. Leave <strong>SubSectionTitle</strong> empty for section-level questions.</li>
                  <li>QuestionRisk values: Low, Medium, High &nbsp;|&nbsp; Category values: Process, Hygiene, Maintenance, Training, Documentation &nbsp;|&nbsp; Responsibility: use <code style={{ background: '#e0f2fe', padding: '1px 4px', borderRadius: 3 }}>|</code> to separate multiple departments</li>
                </ul>
              </div>

              {/* Reference Data Panels */}
              {(() => {
                const toggleRef = (key: string) => setBulkRefOpen(prev => ({ ...prev, [key]: !prev[key] }));
                const refPanelHeader = (key: string, label: string, icon: React.ReactNode, count: number, color: string, borderColor: string, bgColor: string) => (
                  <button key={key} onClick={() => toggleRef(key)} type="button" style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', border: `1px solid ${borderColor}`, borderRadius: bulkRefOpen[key] ? '8px 8px 0 0' : 8,
                    background: bgColor, cursor: 'pointer', gap: 8, fontSize: '0.8rem', fontWeight: 600, color,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label} <span style={{ background: color, color: 'white', padding: '1px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700 }}>{count}</span></span>
                    <ChevronDown size={14} style={{ transform: bulkRefOpen[key] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                );
                const currentPageSections = workingDoc.pages[bulkUploadModal.pIdx]?.sections || [];
                const sopEntries = sopNames.filter(s => s.trim());
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div>
                      {refPanelHeader('sops', 'SOPs / Sub-SOPs', <BookOpen size={13} />, sopEntries.length, '#7c3aed', '#ede9fe', '#faf5ff')}
                      {bulkRefOpen['sops'] && (
                        <div style={{ border: '1px solid #ede9fe', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white', maxHeight: 220, overflowY: 'auto', padding: '6px 0' }}>
                          {sopEntries.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 10px 4px' }}>
                                <button type="button" onClick={() => {
                                  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
                                  let rows = 'SOP,Sub-SOP\n';
                                  sopEntries.forEach(sop => {
                                    const subs = sopSubTopics[sop] || [];
                                    if (subs.length === 0) { rows += `${esc(sop)},\n`; }
                                    else { subs.forEach(sub => { rows += `${esc(sop)},${esc(sub)}\n`; }); }
                                  });
                                  downloadRefCsv('sops_sub_sops.csv', rows);
                                }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, border: '1px solid #ede9fe', background: '#faf5ff', color: '#7c3aed', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
                                  <Download size={11} /> Download CSV
                                </button>
                              </div>
                              {sopEntries.map((sop, i) => {
                                const subs = sopSubTopics[sop] || [];
                                return (
                                  <div key={i} style={{ padding: '4px 14px' }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#7c3aed' }}>{sop}</div>
                                    {subs.length > 0 && subs.map((sub, si) => (
                                      <div key={si} style={{ fontSize: '0.72rem', color: '#64748b', paddingLeft: 14, lineHeight: 1.6 }}>↳ {sub}</div>
                                    ))}
                                  </div>
                                );
                              })}
                            </>
                          ) : <p style={{ margin: 0, padding: '8px 14px', fontSize: '0.75rem', color: '#94a3b8' }}>No SOPs configured</p>}
                        </div>
                      )}
                    </div>

                    <div>
                      {refPanelHeader('sections', 'Existing Sections', <Layers size={13} />, currentPageSections.length, '#0891b2', '#bae6fd', '#f0f9ff')}
                      {bulkRefOpen['sections'] && (
                        <div style={{ border: '1px solid #bae6fd', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white', maxHeight: 200, overflowY: 'auto', padding: '6px 0' }}>
                          {currentPageSections.length > 0 ? currentPageSections.map((sec, i) => {
                            const subs = sec.subSections || [];
                            return (
                              <div key={i} style={{ padding: '4px 14px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0891b2' }}>{sec.title || `Section ${i + 1}`}</div>
                                {subs.length > 0 && subs.map((sub, si) => (
                                  <div key={si} style={{ fontSize: '0.72rem', color: '#64748b', paddingLeft: 14, lineHeight: 1.6 }}>↳ {sub.title || `Sub-section ${si + 1}`}</div>
                                ))}
                              </div>
                            );
                          }) : <p style={{ margin: 0, padding: '8px 14px', fontSize: '0.75rem', color: '#94a3b8' }}>No sections on this page yet</p>}
                        </div>
                      )}
                    </div>

                    <div>
                      {refPanelHeader('resp', 'Responsibility (Departments)', <Users size={13} />, departmentNames.length, '#059669', '#d1fae5', '#f0fdf4')}
                      {bulkRefOpen['resp'] && (
                        <div style={{ border: '1px solid #d1fae5', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white', padding: '10px 14px' }}>
                          {departmentNames.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                                  {departmentNames.map((d, i) => (
                                    <span key={i} style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0' }}>{d}</span>
                                  ))}
                                </div>
                                <button type="button" onClick={() => {
                                  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
                                  let rows = 'Department\n';
                                  departmentNames.forEach(d => { rows += `${esc(d)}\n`; });
                                  downloadRefCsv('responsibility_departments.csv', rows);
                                }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, border: '1px solid #d1fae5', background: '#f0fdf4', color: '#059669', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
                                  <Download size={11} /> CSV
                                </button>
                              </div>
                            </>
                          ) : <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>No departments configured</p>}
                          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>In CSV, separate multiple with <code style={{ background: '#e0f2fe', padding: '0 3px', borderRadius: 3 }}>|</code> — e.g. Main Kitchen|Housekeeping</p>
                        </div>
                      )}
                    </div>

                    <div>
                      {refPanelHeader('riskcat', 'Risk & Category Values', <AlertCircle size={13} />, 3 + allCategories.length, '#d97706', '#fef3c7', '#fffbeb')}
                      {bulkRefOpen['riskcat'] && (
                        <div style={{ border: '1px solid #fef3c7', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'white', padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>QuestionRisk</p>
                            <button type="button" onClick={() => {
                              const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
                              let rows = 'Type,Value\n';
                              ['Low', 'Medium', 'High'].forEach(r => { rows += `Risk,${esc(r)}\n`; });
                              allCategories.forEach(c => { rows += `Category,${esc(c)}\n`; });
                              downloadRefCsv('risk_and_categories.csv', rows);
                            }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, border: '1px solid #fef3c7', background: '#fffbeb', color: '#d97706', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <Download size={11} /> CSV
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                            {(['Low', 'Medium', 'High'] as const).map(r => (
                              <span key={r} style={{
                                padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, border: '1px solid',
                                background: r === 'Low' ? '#dcfce7' : r === 'Medium' ? '#fef9c3' : '#fee2e2',
                                color: r === 'Low' ? '#166534' : r === 'Medium' ? '#854d0e' : '#991b1b',
                                borderColor: r === 'Low' ? '#bbf7d0' : r === 'Medium' ? '#fde68a' : '#fecaca',
                              }}>{r}</span>
                            ))}
                          </div>
                          <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>Category</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {allCategories.map((c, i) => (
                              <span key={i} style={{ padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => downloadBulkSampleCsv(bulkUploadModal.pageName)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: '1px solid #0891b2', background: 'white', color: '#0891b2', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={14} /> Download Sample CSV
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: 'none', background: '#0891b2', color: 'white', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  <Upload size={14} /> Choose CSV File
                  <input ref={bulkCsvRef} type="file" accept=".csv" style={{ display: 'none' }}
                    onChange={e => handleBulkCsvUpload(e, bulkUploadModal.pIdx)} />
                </label>
              </div>

              {/* Parse Error */}
              {bulkParseError && (
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, color: '#dc2626', fontSize: '0.82rem' }}>{bulkParseError}</p>
                </div>
              )}

              {/* Preview Table */}
              {bulkPreviewRows.length > 0 && (() => {
                type SubGroup = { subTitle: string; rows: { row: BulkPreviewRow; globalIdx: number }[] };
                type SecGroup = { sectionRows: { row: BulkPreviewRow; globalIdx: number }[]; subGroups: SubGroup[]; isExisting: boolean };
                const sections: Record<string, SecGroup> = {};
                bulkPreviewRows.forEach((r, gi) => {
                  if (!sections[r.sectionTitle]) sections[r.sectionTitle] = { sectionRows: [], subGroups: [], isExisting: r.isExistingSection };
                  const sec = sections[r.sectionTitle];
                  if (r.subSectionTitle.trim()) {
                    let sg = sec.subGroups.find(s => s.subTitle.trim().toLowerCase() === r.subSectionTitle.trim().toLowerCase());
                    if (!sg) { sg = { subTitle: r.subSectionTitle, rows: [] }; sec.subGroups.push(sg); }
                    sg.rows.push({ row: r, globalIdx: gi });
                  } else {
                    sec.sectionRows.push({ row: r, globalIdx: gi });
                  }
                });
                const bulkDropdownStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: 'white', color: '#1e293b', cursor: 'pointer', width: '100%' };
                const bulkInputStyle: React.CSSProperties = { padding: '4px 8px', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: '0.75rem', background: 'white', color: '#1e293b', width: '100%', resize: 'vertical' as const };
                return (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: V.text }}>
                        Preview — {bulkPreviewRows.length} question{bulkPreviewRows.length !== 1 ? 's' : ''} across {Object.keys(sections).length} section{Object.keys(sections).length !== 1 ? 's' : ''}
                        {Object.values(sections).some(s => s.subGroups.length > 0) && (() => {
                          const totalSubs = Object.values(sections).reduce((a, s) => a + s.subGroups.length, 0);
                          return `, ${totalSubs} sub-section${totalSubs !== 1 ? 's' : ''}`;
                        })()}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>● Existing section</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>● New section</span>
                      </div>
                    </div>
                    {Object.entries(sections).map(([secTitle, { sectionRows, subGroups, isExisting }]) => {
                      const totalQs = sectionRows.length + subGroups.reduce((a, sg) => a + sg.rows.length, 0);
                      return (
                      <div key={secTitle} style={{ marginBottom: 16, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ background: isExisting ? '#f0fdf4' : '#eff6ff', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.72rem', background: isExisting ? '#dcfce7' : '#dbeafe', color: isExisting ? '#166534' : '#1d4ed8', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                            {isExisting ? 'EXISTING' : 'NEW'}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isExisting ? '#166534' : '#1d4ed8' }}>{secTitle}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>
                            {totalQs} question{totalQs !== 1 ? 's' : ''}
                            {subGroups.length > 0 && `, ${subGroups.length} sub-section${subGroups.length !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, width: '24%' }}>Question</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, width: '20%' }}>Requirement</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600, width: '11%' }}>Risk</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600, width: '13%' }}>Category</th>
                                <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b', fontWeight: 600, width: '10%' }}>Max Marks</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600, width: '22%' }}>Responsibility</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectionRows.map(({ row, globalIdx }, ri) => (
                                <tr key={`s-${ri}`} style={{ borderTop: '1px solid #f1f5f9', background: ri % 2 === 0 ? 'white' : '#f8fafc', verticalAlign: 'top' }}>
                                  <td style={{ padding: '6px 8px' }}>
                                    <textarea value={row.questionText} rows={2} style={bulkInputStyle}
                                      onChange={e => updateBulkRow(globalIdx, 'questionText', e.target.value)} />
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <textarea value={row.requirement} rows={2} style={bulkInputStyle}
                                      onChange={e => updateBulkRow(globalIdx, 'requirement', e.target.value)} />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <select value={row.questionRisk} style={bulkDropdownStyle}
                                      onChange={e => updateBulkRow(globalIdx, 'questionRisk', e.target.value as RiskLevel)}>
                                      <option value="Low">Low</option>
                                      <option value="Medium">Medium</option>
                                      <option value="High">High</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <select value={row.category} style={bulkDropdownStyle}
                                      onChange={e => updateBulkRow(globalIdx, 'category', e.target.value)}>
                                      <option value="">— Select —</option>
                                      {allCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <select value={row.maxMarks} style={bulkDropdownStyle}
                                      onChange={e => updateBulkRow(globalIdx, 'maxMarks', parseInt(e.target.value) || 0)}>
                                      {maxMarksOptions.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {departmentNames.length > 0 ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                        {departmentNames.map(dept => {
                                          const isSelected = (row.responsibility || []).includes(dept);
                                          return (
                                            <button key={dept} type="button"
                                              onClick={() => {
                                                const current = row.responsibility || [];
                                                const updated = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
                                                updateBulkRow(globalIdx, 'responsibility', updated);
                                              }}
                                              style={{
                                                padding: '2px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                                                background: isSelected ? '#0891b2' : 'white',
                                                color: isSelected ? 'white' : '#64748b',
                                                borderColor: isSelected ? '#0891b2' : '#e2e8f0',
                                              }}>
                                              {dept}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{(row.responsibility || []).join(', ') || '—'}</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {subGroups.map((sg, sgIdx) => (
                                <React.Fragment key={`sg-${sgIdx}`}>
                                  <tr>
                                    <td colSpan={6} style={{ padding: '6px 12px', background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#7c3aed' }}>Sub-Section: {sg.subTitle}</span>
                                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 8 }}>{sg.rows.length} question{sg.rows.length !== 1 ? 's' : ''}</span>
                                    </td>
                                  </tr>
                                  {sg.rows.map(({ row, globalIdx }, ri) => (
                                    <tr key={`ss-${sgIdx}-${ri}`} style={{ borderTop: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#faf5ff' : '#f5f3ff', verticalAlign: 'top' }}>
                                      <td style={{ padding: '6px 8px' }}>
                                        <textarea value={row.questionText} rows={2} style={bulkInputStyle}
                                          onChange={e => updateBulkRow(globalIdx, 'questionText', e.target.value)} />
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <textarea value={row.requirement} rows={2} style={bulkInputStyle}
                                          onChange={e => updateBulkRow(globalIdx, 'requirement', e.target.value)} />
                                      </td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <select value={row.questionRisk} style={bulkDropdownStyle}
                                          onChange={e => updateBulkRow(globalIdx, 'questionRisk', e.target.value as RiskLevel)}>
                                          <option value="Low">Low</option>
                                          <option value="Medium">Medium</option>
                                          <option value="High">High</option>
                                        </select>
                                      </td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <select value={row.category} style={bulkDropdownStyle}
                                          onChange={e => updateBulkRow(globalIdx, 'category', e.target.value)}>
                                          <option value="">— Select —</option>
                                          {allCategories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <select value={row.maxMarks} style={bulkDropdownStyle}
                                          onChange={e => updateBulkRow(globalIdx, 'maxMarks', parseInt(e.target.value) || 0)}>
                                          {maxMarksOptions.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        {departmentNames.length > 0 ? (
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                            {departmentNames.map(dept => {
                                              const isSelected = (row.responsibility || []).includes(dept);
                                              return (
                                                <button key={dept} type="button"
                                                  onClick={() => {
                                                    const current = row.responsibility || [];
                                                    const updated = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
                                                    updateBulkRow(globalIdx, 'responsibility', updated);
                                                  }}
                                                  style={{
                                                    padding: '2px 7px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                                                    background: isSelected ? '#0891b2' : 'white',
                                                    color: isSelected ? 'white' : '#64748b',
                                                    borderColor: isSelected ? '#0891b2' : '#e2e8f0',
                                                  }}>
                                                  {dept}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{(row.responsibility || []).join(', ') || '—'}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#f8fafc', gap: 10 }}>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {bulkPreviewRows.length > 0 ? `Ready to import ${bulkPreviewRows.length} questions` : 'Upload a CSV file to preview questions before importing.'}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setBulkUploadModal(null); setBulkPreviewRows([]); setBulkParseError(''); setBulkRefOpen({}); }}
                  style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #cbd5e1', background: 'white', color: '#64748b', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => commitBulkUpload(bulkUploadModal.pIdx)}
                  disabled={bulkPreviewRows.length === 0}
                  style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: bulkPreviewRows.length > 0 ? '#0891b2' : '#94a3b8', color: 'white', fontSize: '0.82rem', fontWeight: 700, cursor: bulkPreviewRows.length > 0 ? 'pointer' : 'not-allowed' }}>
                  Import {bulkPreviewRows.length > 0 ? `${bulkPreviewRows.length} Questions` : 'Questions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab bar: Editor | Master Checklist */}
      <div style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0 20px', display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => setActiveCreatorTab('editor')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            border: 'none', borderBottom: activeCreatorTab === 'editor' ? '2px solid #7c3aed' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeCreatorTab === 'editor' ? '#7c3aed' : '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s',
          }}
        >
          <FileText size={13} /> Editor
        </button>
        <button
          onClick={() => setActiveCreatorTab('master')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
            border: 'none', borderBottom: activeCreatorTab === 'master' ? '2px solid #6366f1' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: activeCreatorTab === 'master' ? '#6366f1' : '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.15s',
          }}
        >
          <Table2 size={13} /> Master Checklist
        </button>
      </div>

      {/* Master Checklist Tab */}
      {activeCreatorTab === 'master' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <MasterChecklistTable
            sopNames={sopNames}
            sopSubTopics={sopSubTopics}
            departmentNames={departmentNames}
            allCategories={[...new Set(workingDoc.pages.flatMap(p => p.sections.flatMap(s => [...(s.questions || []), ...((s.subSections || []).flatMap(ss => ss.questions || []))].map(q => q.category || '').filter(Boolean))))]}
            linkedChecklistId={workingDoc.id}
            linkedChecklistTitle={workingDoc.title || 'Untitled Checklist'}
            linkedChecklist={workingDoc}
            responseSets={responseSets}
            onChecklistGenerated={mergeFromMasterChecklist}
            onRowSynced={(c) => mergeFromMasterChecklist(c, false)}
            entities={entities}
            currentScope={currentScope}
            userRootId={userRootId}
            userName={userName}
            fixedPages={fixedPages}
          />
        </div>
      )}

      {activeCreatorTab === 'editor' && <div onClick={() => setSelectedBlockId(null)} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 600, maxWidth: 1400, width: '100%', paddingBottom: 50 }}>

          {!fixedPages && <div style={{
            backgroundColor: V.white, border: '1px solid #ced4da', borderRadius: 10,
            marginBottom: 30, boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
          }}>
            <div style={{
              backgroundColor: V.pageHeaderBg, padding: '15px 25px', borderBottom: '1px solid #ced4da',
              borderTopLeftRadius: 9, borderTopRightRadius: 9, cursor: 'default',
            }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: V.purple }}>Unit Details</h2>
            </div>
            <div style={{ padding: '20px 25px', display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={formRowStyle}>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Company Name</label>
                  <input style={inputStyle} value={workingDoc.unitDetails.companyName}
                    onChange={e => handleUpdateUnit('companyName', e.target.value)} placeholder="Enter company name" />
                </div>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Representative Name</label>
                  <input style={inputStyle} value={workingDoc.unitDetails.repName}
                    onChange={e => handleUpdateUnit('repName', e.target.value)} placeholder="Enter representative's name" />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={{ ...formGroupStyle, flexBasis: '100%' }}>
                  <label style={fieldLabelStyle}>Complete Address</label>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 40 }} rows={2}
                    value={workingDoc.unitDetails.address}
                    onChange={e => handleUpdateUnit('address', e.target.value)} placeholder="Enter full address" />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Contact Number</label>
                  <input style={inputStyle} value={workingDoc.unitDetails.contact}
                    onChange={e => handleUpdateUnit('contact', e.target.value)} placeholder="Enter contact number" />
                </div>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Email ID</label>
                  <input style={inputStyle} type="email" value={workingDoc.unitDetails.email}
                    onChange={e => handleUpdateUnit('email', e.target.value)} placeholder="Enter email address" />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Scheduled Manday</label>
                  <input style={inputStyle} value={workingDoc.unitDetails.manday}
                    onChange={e => handleUpdateUnit('manday', e.target.value)} placeholder="e.g., 1.5" />
                </div>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Audit Scope</label>
                  <input style={inputStyle} value={workingDoc.unitDetails.scope}
                    onChange={e => handleUpdateUnit('scope', e.target.value)} placeholder="Define the scope of the audit" />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Audit Date (From)</label>
                  <input style={inputStyle} type="date" value={workingDoc.unitDetails.dateFrom}
                    onChange={e => handleUpdateUnit('dateFrom', e.target.value)} />
                </div>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Audit Date (To)</label>
                  <input style={inputStyle} type="date" value={workingDoc.unitDetails.dateTo}
                    onChange={e => handleUpdateUnit('dateTo', e.target.value)} />
                </div>
              </div>
              <div style={formRowStyle}>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Geotag Location</label>
                  <div style={{ display: 'flex' }}>
                    <input style={{ ...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none', backgroundColor: V.containerBg }}
                      value={workingDoc.unitDetails.geotag} readOnly placeholder="Click to fetch location" />
                    <button onClick={handleGetGeotag} style={{
                      padding: '8px 15px', border: `1px solid ${V.border}`, backgroundColor: V.sectionHeaderBg,
                      cursor: 'pointer', borderTopRightRadius: 6, borderBottomRightRadius: 6,
                      fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.9rem',
                    }}>Get Location</button>
                  </div>
                </div>
                <div style={formGroupStyle}>
                  <label style={fieldLabelStyle}>Audit Start Time</label>
                  <div style={{ display: 'flex' }}>
                    <input style={{ ...inputStyle, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none', backgroundColor: V.containerBg }}
                      value={workingDoc.unitDetails.startTime} readOnly placeholder="Click 'Start Audit'" />
                    <button onClick={handleStartAudit} disabled={!!workingDoc.unitDetails.startTime} style={{
                      padding: '8px 15px', border: `1px solid ${V.purple}`,
                      backgroundColor: workingDoc.unitDetails.startTime ? V.naBg : V.purple,
                      color: workingDoc.unitDetails.startTime ? V.naText : 'white',
                      cursor: workingDoc.unitDetails.startTime ? 'not-allowed' : 'pointer',
                      borderTopRightRadius: 6, borderBottomRightRadius: 6,
                      fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.9rem',
                    }}>{workingDoc.unitDetails.startTime ? 'Started' : 'Start Audit'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>}

          {workingDoc.pages.map((page, pIdx) => (
            <div key={page.id} onClick={e => e.stopPropagation()} style={{
              backgroundColor: V.white, border: '1px solid #ced4da', borderRadius: 10,
              marginBottom: 30, boxShadow: '0 5px 15px rgba(0,0,0,0.1)', position: 'relative',
            }}>
              <div style={{
                backgroundColor: V.pageHeaderBg, padding: '15px 25px',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: collapsedPages.has(page.id) ? 'none' : '1px solid #ced4da', borderTopLeftRadius: 9, borderTopRightRadius: 9,
                cursor: 'grab',
              }}>
                <span
                  onClick={(e) => { e.stopPropagation(); togglePageCollapse(page.id); }}
                  style={{
                    fontSize: '1em', color: V.purple, padding: 5,
                    transition: 'transform 0.2s', transform: collapsedPages.has(page.id) ? 'rotate(-90deg)' : 'rotate(0)',
                    display: 'inline-block', cursor: 'pointer', flexShrink: 0,
                  }}
                  title={collapsedPages.has(page.id) ? 'Expand page' : 'Collapse page'}
                >▼</span>
                {fixedPages ? (
                  <span style={{ flexGrow: 1, fontSize: '1.3rem', fontWeight: 700, color: V.purple, padding: 8 }}>
                    {page.title}
                  </span>
                ) : departmentNames.length > 0 ? (
                  <SearchableSelectDropdown
                    options={departmentNames}
                    value={page.title}
                    onChange={v => handleUpdatePage(pIdx, 'title', v)}
                    placeholder="Select department..."
                    excludeValues={workingDoc.pages.map(p => p.title).filter(Boolean)}
                  />
                ) : locationNames.length > 0 ? (
                  <SearchableSelectDropdown
                    options={locationNames}
                    value={page.title}
                    onChange={v => handleUpdatePage(pIdx, 'title', v)}
                    placeholder="Select department..."
                    excludeValues={workingDoc.pages.map(p => p.title).filter(Boolean)}
                  />
                ) : (
                  <input type="text" value={page.title}
                    onChange={e => handleUpdatePage(pIdx, 'title', e.target.value)}
                    placeholder="Enter department name"
                    style={{
                      flexGrow: 1, border: 'none', background: 'transparent',
                      fontSize: '1.3rem', fontWeight: 700, color: V.purple, padding: 8, outline: 'none',
                    }}
                  />
                )}
                <span style={{ fontSize: '0.75rem', color: V.label, backgroundColor: V.white, padding: '2px 8px', borderRadius: 4, border: `1px solid ${V.border}`, flexShrink: 0 }}>
                  {page.sections.length} {page.sections.length === 1 ? 'section' : 'sections'}, {page.sections.reduce((sum, s) => sum + getAllSectionQuestions(s).length, 0)} questions
                </span>
                {(() => {
                  const allQs = page.sections.flatMap(s => getAllSectionQuestions(s));
                  const noResp = allQs.filter(q => !q.responsibility || q.responsibility.length === 0).length;
                  const noCat = allQs.filter(q => !q.category).length;
                  return (noResp > 0 || noCat > 0) ? (
                    <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                      {noResp > 0 && <span style={{ fontSize: '0.7rem', color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 7px', borderRadius: 4, border: '1px solid #fecaca', fontWeight: 600 }}>
                        {noResp} unassigned
                      </span>}
                      {noCat > 0 && <span style={{ fontSize: '0.7rem', color: '#d97706', backgroundColor: '#fffbeb', padding: '2px 7px', borderRadius: 4, border: '1px solid #fde68a', fontWeight: 600 }}>
                        {noCat} uncategorized
                      </span>}
                    </span>
                  ) : null;
                })()}
                {!fixedPages && <span style={{ fontSize: '0.8rem', color: V.label, fontStyle: 'italic', userSelect: 'none' }}>
                  (Drag to Reorder Page)
                </span>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setBulkPreviewRows([]); setBulkParseError(''); setBulkUploadModal({ pIdx, pageName: page.title || `Page ${pIdx + 1}` }); }}
                    title="Bulk upload questions to this page"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: V.white, border: '1px solid #0891b2', borderRadius: 6,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      padding: '5px 12px', color: '#0891b2', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0891b2'; e.currentTarget.style.color = V.white; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.color = '#0891b2'; }}
                  >
                    <Upload size={14} /> Bulk Upload
                  </button>
                  {!fixedPages && <>
                  {workingDoc.pages.length > 1 && <button onClick={() => setMovePageModal({ pIdx, title: page.title || `Page ${pIdx + 1}` })} title="Reorder page position"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: V.white, border: '1px solid #0891b2', borderRadius: 6,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      padding: '5px 12px', color: '#0891b2', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0891b2'; e.currentTarget.style.color = V.white; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.color = '#0891b2'; }}
                  >
                    <ArrowRightLeft size={14} /> Move Page
                  </button>}
                  <button onClick={() => duplicatePage(pIdx)} title="Duplicate page"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: V.white, border: `1px solid ${V.purple}`, borderRadius: 6,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      padding: '5px 12px', color: V.purple, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = V.purple; e.currentTarget.style.color = V.white; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.color = V.purple; }}
                  >
                    <Copy size={14} /> Duplicate Page
                  </button>
                  <button onClick={() => deletePage(pIdx, page.title)} title="Delete page"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: V.white, border: `1px solid ${V.dangerRed}`, borderRadius: 6,
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      padding: '5px 12px', color: V.dangerRed, transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = V.dangerRed; e.currentTarget.style.color = V.white; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.color = V.dangerRed; }}
                  >
                    <X size={14} /> Delete
                  </button>
                  </>}
                </div>
              </div>

              {!collapsedPages.has(page.id) && (
              <div style={{ padding: '20px 25px 10px 25px', minHeight: 30 }}>
                {page.sections.map((section, sIdx) => {
                  const isCollapsed = collapsedSections.has(section.id);
                  const isSelected = selectedBlockId === section.id;
                  const isSectionDropTarget = dropTarget?.type === 'section' && dropTarget.pIdx === pIdx && dropTarget.sIdx === sIdx;
                  return (
                    <div key={section.id}
                      draggable={!!dragSection && dragSection.pIdx === pIdx && dragSection.sIdx === sIdx}
                      onDragOver={(e) => {
                        if (!dragSection && !dragQuestion) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragSection && dragSection.pIdx === pIdx) {
                          setDropTarget({ type: 'section', pIdx, sIdx, position: 'before' });
                        }
                        if (dragQuestion && dragQuestion.pIdx === pIdx) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const midY = rect.top + rect.height / 2;
                          setDropTarget({ type: 'question', pIdx, sIdx, qIdx: e.clientY < midY ? 0 : section.questions.length - 1, position: e.clientY < midY ? 'before' : 'after' });
                        }
                      }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragSection && dragSection.pIdx === pIdx) {
                          handleSectionDrop(pIdx, dragSection.sIdx, sIdx);
                        }
                        if (dragQuestion && dragQuestion.pIdx === pIdx && dropTarget) {
                          handleQuestionDrop(dragQuestion.pIdx, dragQuestion.sIdx, dragQuestion.qIdx, pIdx, sIdx, dropTarget.qIdx ?? 0, dropTarget.position);
                        }
                        setDragSection(null); setDragQuestion(null); setDropTarget(null);
                      }}
                      onDragEnd={() => { setDragSection(null); setDragQuestion(null); setDropTarget(null); }}
                      style={{
                      backgroundColor: V.white,
                      border: isSectionDropTarget && dragSection ? `2px dashed ${V.purple}` : isSelected ? `2px solid ${V.purple}` : `1px solid ${V.border}`,
                      borderRadius: 8, marginBottom: 25, boxShadow: isSelected ? '0 4px 10px rgba(0,0,0,0.1)' : '0 3px 6px rgba(0,0,0,0.07)',
                      position: 'relative', transition: 'all 0.2s',
                      opacity: dragSection?.pIdx === pIdx && dragSection?.sIdx === sIdx ? 0.4 : 1,
                    }}>
                      <div onClick={(e) => { e.stopPropagation(); setSelectedBlockId(section.id); toggleSectionCollapse(section.id); }}
                        style={{
                          backgroundColor: V.sectionHeaderBg, padding: '12px 20px',
                          display: 'flex', alignItems: 'center', gap: 8,
                          borderBottom: `1px solid ${V.border}`,
                          borderTopLeftRadius: 7, borderTopRightRadius: 7,
                          cursor: 'pointer', flexWrap: 'wrap',
                        }}
                      >
                        <span
                          onMouseDown={(e) => { e.stopPropagation(); setDragSection({ pIdx, sIdx }); }}
                          onMouseUp={() => setDragSection(null)}
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDragSection({ pIdx, sIdx });
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', '');
                          }}
                          onClick={e => e.stopPropagation()}
                          title="Drag to reorder section"
                          style={{ cursor: 'grab', padding: '4px 2px', color: V.label, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                        >
                          <GripVertical size={16} />
                        </span>
                        <span style={{
                          fontSize: '0.9em', color: V.purple, padding: 5,
                          transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                          display: 'inline-block',
                        }}>▼</span>

                        {sopNames.length > 0 ? (
                          <div onClick={e => e.stopPropagation()} style={{ flexGrow: 1, minWidth: 150 }}>
                            <SearchableSelectDropdown
                              options={sopNames}
                              value={section.title}
                              onChange={v => handleUpdateSection(pIdx, sIdx, 'title', v)}
                              placeholder="Select SOP..."
                              excludeValues={workingDoc.pages[pIdx].sections.map(s => s.title).filter(Boolean)}
                            />
                          </div>
                        ) : (
                          <input type="text" value={section.title}
                            onClick={e => e.stopPropagation()}
                            onChange={e => handleUpdateSection(pIdx, sIdx, 'title', e.target.value)}
                            placeholder="Enter section title"
                            style={{
                              flexGrow: 1, border: 'none', background: 'transparent',
                              fontSize: '1.1rem', fontWeight: 600, color: V.purple,
                              padding: 5, minWidth: 150, outline: 'none',
                            }}
                          />
                        )}

                        <span style={{ fontSize: '0.75rem', color: V.label, fontStyle: 'italic', marginLeft: 5, userSelect: 'none', flexShrink: 0 }}>
                          (Drag Header to Reorder Section)
                        </span>

                        <span style={{
                          fontSize: '0.8rem', color: V.label, marginLeft: 10,
                          backgroundColor: V.white, padding: '2px 6px', borderRadius: 4,
                          border: `1px solid ${V.border}`, flexShrink: 0,
                        }}>
                          {getAllSectionQuestions(section).length}
                        </span>

                        {(() => {
                          const secQs = getAllSectionQuestions(section);
                          const noResp = secQs.filter(q => !q.responsibility || q.responsibility.length === 0).length;
                          const noCat = secQs.filter(q => !q.category).length;
                          return (noResp > 0 || noCat > 0) ? (
                            <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: 4, marginLeft: 4, flexShrink: 0 }}>
                              {noResp > 0 && <span style={{ fontSize: '0.68rem', color: '#dc2626', backgroundColor: '#fef2f2', padding: '1px 6px', borderRadius: 4, border: '1px solid #fecaca', fontWeight: 600 }}>
                                {noResp} unassigned
                              </span>}
                              {noCat > 0 && <span style={{ fontSize: '0.68rem', color: '#d97706', backgroundColor: '#fffbeb', padding: '1px 6px', borderRadius: 4, border: '1px solid #fde68a', fontWeight: 600 }}>
                                {noCat} uncategorized
                              </span>}
                            </span>
                          ) : null;
                        })()}

                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: V.label, marginLeft: 10, flexShrink: 0 }}>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <input type="radio" name={`${section.id}-app`} checked={section.isApplicable}
                              onChange={() => handleUpdateSection(pIdx, sIdx, 'isApplicable', true)}
                              style={{ marginRight: 4, accentColor: V.purple }} />
                            Applicable
                          </label>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            <input type="radio" name={`${section.id}-app`} checked={!section.isApplicable}
                              onChange={() => handleUpdateSection(pIdx, sIdx, 'isApplicable', false)}
                              style={{ marginRight: 4, accentColor: V.purple }} />
                            Not Applicable
                          </label>
                        </div>

                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: V.label, marginLeft: 10, flexShrink: 0 }}>
                          <span style={{ marginRight: 5 }}>Risk:</span>
                          {(['Indiv.', 'Low', 'Med', 'High'] as SectionRisk[]).map(r => (
                            <label key={r} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                              <input type="radio" name={`${section.id}-risk`} checked={section.risk === r}
                                onChange={() => handleUpdateSection(pIdx, sIdx, 'risk', r)}
                                style={{ marginRight: 4, accentColor: V.purple }} />
                              {r}
                            </label>
                          ))}
                        </div>


                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                          {workingDoc.pages.length > 1 && <button onClick={(e) => { e.stopPropagation(); setMoveSectionModal({ pIdx, sIdx, title: section.title || `Section ${sIdx + 1}` }); }} title="Move section to another page"
                            style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 5, color: '#0891b2' }}>
                            <ArrowRightLeft size={16} />
                          </button>}
                          <button onClick={(e) => { e.stopPropagation(); duplicateSection(pIdx, sIdx); }} title="Duplicate section"
                            style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 5, color: V.purple }}>
                            <Copy size={16} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteSection(pIdx, sIdx, section.title); }} title="Delete section"
                            style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 5, color: V.dangerRed }}>
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div onClick={() => setSelectedBlockId(null)} style={{ padding: '0px 20px 5px 20px', minHeight: 20 }}>
                          {section.questions.map((q, qIdx) => {
                            const isQSelected = selectedBlockId === q.id;
                            const isEditing = editingQuestionId === q.id;
                            const showDropdown = activeDropdownId === q.id;
                            const showScoring = scoringPanelId === q.id;
                            const derivedMax = Math.max(0, ...(q.responses || []).map(r => {
                              const isNA2 = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
                              return isNA2 ? 0 : (parseFloat(r.score) || 0);
                            }));
                            const showMaxScore = derivedMax > 0;

                            const isQDropTarget = dropTarget?.type === 'question' && dropTarget.pIdx === pIdx && dropTarget.sIdx === sIdx && dropTarget.qIdx === qIdx;
                            return (
                              <div key={q.id}
                                onClick={(e) => { e.stopPropagation(); setSelectedBlockId(q.id); }}
                                draggable={!!dragQuestion && dragQuestion.pIdx === pIdx && dragQuestion.sIdx === sIdx && dragQuestion.qIdx === qIdx}
                                onDragOver={(e) => {
                                  if (!dragQuestion) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.dataTransfer.dropEffect = 'move';
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const midY = rect.top + rect.height / 2;
                                  setDropTarget({ type: 'question', pIdx, sIdx, qIdx, position: e.clientY < midY ? 'before' : 'after' });
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (dragQuestion && dropTarget) {
                                    handleQuestionDrop(dragQuestion.pIdx, dragQuestion.sIdx, dragQuestion.qIdx, pIdx, sIdx, qIdx, dropTarget.position);
                                  }
                                  setDragQuestion(null); setDropTarget(null);
                                }}
                                onDragEnd={() => { setDragQuestion(null); setDropTarget(null); }}
                                style={{
                                  backgroundColor: isQSelected ? '#e9ecef' : V.containerBg,
                                  borderLeft: isQSelected ? `2px solid ${V.purple}` : '1px solid transparent',
                                  borderRight: isQSelected ? `2px solid ${V.purple}` : '1px solid transparent',
                                  borderTop: isQDropTarget && dropTarget?.position === 'before' ? `3px solid ${V.purple}` : qIdx === 0 ? (isQSelected ? `2px solid ${V.purple}` : '1px solid transparent') : `1px dashed #e2e8f0`,
                                  borderBottom: isQDropTarget && dropTarget?.position === 'after' ? `3px solid ${V.purple}` : (isQSelected ? `2px solid ${V.purple}` : '1px solid transparent'),
                                  borderRadius: 0, marginBottom: 0, position: 'relative',
                                  cursor: 'default', transition: 'border-color 0.15s', paddingRight: 35,
                                  opacity: dragQuestion?.pIdx === pIdx && dragQuestion?.sIdx === sIdx && dragQuestion?.qIdx === qIdx ? 0.4 : 1,
                                }}
                              >
                                <QuickAddPanel
                                  visible={isQSelected}
                                  onAddQuestion={() => {}}
                                  onAddSection={() => addSection(pIdx, sIdx)}
                                  onAddSubSection={() => addSubSection(pIdx, sIdx)}
                                  onAddPage={() => addPage()}
                                  hideAddQuestion
                                />

                                <span
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDragQuestion({ pIdx, sIdx, qIdx });
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', '');
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  title="Drag to reorder question"
                                  style={{
                                    position: 'absolute', top: 10, right: 30,
                                    cursor: 'grab', padding: '4px 2px', color: V.label, zIndex: 10,
                                    opacity: isQSelected ? 0.7 : 0, transition: 'opacity 0.2s',
                                    display: 'inline-flex', alignItems: 'center',
                                  }}
                                >
                                  <GripVertical size={14} />
                                </span>

                                <button onClick={(e) => { e.stopPropagation(); setMoveModalExpanded(new Set()); setMoveModal({ pIdx, sIdx, qIdx, questionText: q.text || `Question ${qIdx + 1}` }); }}
                                  title="Move to another section"
                                  style={{
                                    position: 'absolute', top: 10, right: 55,
                                    background: 'none', border: 'none', color: V.purple,
                                    fontSize: '1.1rem', cursor: 'pointer', padding: 5, zIndex: 10,
                                    opacity: isQSelected ? 0.7 : 0, pointerEvents: isQSelected ? 'auto' : 'none',
                                    transition: 'opacity 0.2s',
                                  }}>
                                  <ArrowRightLeft size={14} />
                                </button>

                                <button onClick={(e) => { e.stopPropagation(); deleteQuestion(pIdx, sIdx, qIdx); }}
                                  title="Delete question"
                                  style={{
                                    position: 'absolute', top: 10, right: 5,
                                    background: 'none', border: 'none', color: V.dangerRed,
                                    fontSize: '1.1rem', cursor: 'pointer', padding: 5, zIndex: 10,
                                    opacity: isQSelected ? 0.7 : 0, transition: 'opacity 0.2s',
                                  }}>
                                  <Trash2 size={16} />
                                </button>

                                <div style={{ padding: '15px 0px 10px 0px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                  <div onClick={e => e.stopPropagation()} style={{ paddingTop: 22, flexShrink: 0 }}>
                                    <input type="checkbox" checked={bulkMoveIds.has(q.id)}
                                      onChange={() => toggleBulkSelect(q.id)}
                                      title="Select for bulk move"
                                      style={{ width: 16, height: 16, accentColor: V.purple, cursor: 'pointer' }} />
                                  </div>
                                  <div style={{ flexGrow: 1 }}>
                                    <label style={fieldLabelStyle}>Question</label>
                                    <div
                                      onDoubleClick={() => setEditingQuestionId(q.id)}
                                      style={{
                                        position: 'relative', display: 'flex', alignItems: 'center',
                                        border: `2px solid ${V.purple}`, backgroundColor: isEditing ? V.white : V.lightPurpleBg,
                                        borderRadius: 6, cursor: 'text',
                                        boxShadow: isEditing ? `0 0 0 3px rgba(110,66,255,0.25)` : 'none',
                                      }}
                                    >
                                      <span style={{
                                        width: 10, height: 10, backgroundColor: V.purple, borderRadius: '50%',
                                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                        cursor: 'grab', left: -5,
                                      }} />
                                      <input type="text"
                                        readOnly={!isEditing}
                                        value={q.text}
                                        onChange={e => handleUpdateQuestion(pIdx, sIdx, qIdx, 'text', e.target.value)}
                                        onBlur={() => setEditingQuestionId(null)}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingQuestionId(null); }}
                                        placeholder="Type question (Drag handles to reorder)"
                                        style={{
                                          width: '100%', padding: '10px 12px', border: 'none',
                                          backgroundColor: 'transparent', fontSize: '1rem',
                                          color: V.text, outline: 'none', cursor: isEditing ? 'text' : 'default',
                                        }}
                                      />
                                      <span style={{
                                        width: 10, height: 10, backgroundColor: V.purple, borderRadius: '50%',
                                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                        cursor: 'grab', right: -5,
                                      }} />
                                    </div>
                                  </div>

                                  {availableAutoMarks.length > 0 && (
                                    <div style={{ minWidth: 80 }} onClick={e => e.stopPropagation()}>
                                      <label style={fieldLabelStyle}>Max marks</label>
                                      <select
                                        value={derivedMax > 0 ? derivedMax : (q.maxScore || 0)}
                                        onChange={e => applyMaxMarksToQuestion(pIdx, sIdx, qIdx, parseInt(e.target.value) || 0)}
                                        style={{
                                          width: '100%', height: 38, border: `1px solid ${V.border}`,
                                          borderRadius: 6, backgroundColor: derivedMax > 0 ? '#f0fdf4' : '#f8fafc',
                                          color: V.text, fontSize: '0.9rem', padding: '0 8px', cursor: 'pointer',
                                          fontWeight: derivedMax > 0 ? 600 : 400,
                                        }}
                                      >
                                        <option value={0}>—</option>
                                        {availableAutoMarks.map(m => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <div style={{ minWidth: 220, position: 'relative' }}>
                                    <label style={fieldLabelStyle}>Type of response</label>
                                    <div style={{
                                      display: 'flex', alignItems: 'center',
                                      backgroundColor: V.lightPurpleBg, borderRadius: 6, padding: 4, minHeight: 34,
                                    }}>
                                      <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
                                        {q.responseType === 'multiple' && (q.responses || []).length > 0 ? (
                                          (q.responses || []).slice(0, 3).map(r => (
                                            <span key={r.id} style={{
                                              padding: '6px 12px', border: 'none', borderRadius: 4,
                                              fontSize: '0.85rem', fontWeight: 500, cursor: 'default',
                                              whiteSpace: 'nowrap', ...getResponseBtnStyle(r.color),
                                            }}>{r.text}</span>
                                          ))
                                        ) : (
                                          <span style={{
                                            padding: '6px 12px', borderRadius: 4, fontSize: '0.85rem',
                                            fontWeight: 500, backgroundColor: V.lightPurpleBg, color: V.purple,
                                            border: `1px solid ${V.purple}`,
                                          }}>{q.responseType}</span>
                                        )}
                                        {(q.responses || []).length > 3 && (
                                          <span style={{ fontSize: '0.8rem', color: V.label, marginLeft: -2 }}>+{(q.responses || []).length - 3}</span>
                                        )}
                                      </div>
                                      <span onClick={(e) => { e.stopPropagation(); setActiveDropdownId(showDropdown ? null : q.id); }}
                                        style={{
                                          fontSize: '0.9rem', color: V.label, marginLeft: 'auto',
                                          padding: '5px 8px', cursor: 'pointer', userSelect: 'none',
                                        }}>
                                        {showDropdown ? '▲' : '▼'}
                                      </span>
                                    </div>

                                    {showDropdown && (
                                      <ResponseTypeDropdown
                                        responseSets={responseSets}
                                        onSelect={(type, resps, setId) => {
                                          handleUpdateQuestion(pIdx, sIdx, qIdx, 'responseType', type);
                                          handleUpdateQuestion(pIdx, sIdx, qIdx, 'responses', resps);
                                          if (setId) handleUpdateQuestion(pIdx, sIdx, qIdx, 'responseSetId', setId);
                                          setActiveDropdownId(null);
                                          triggerAutosave();
                                        }}
                                        onOpenEditor={(resps, setId) => {
                                          setMcEditor({
                                            pIdx, sIdx, qIdx,
                                            responses: resps || [{ id: `na-${Date.now()}`, text: 'N/A', color: '#a0aec0', isFlagged: false, score: '' }],
                                            editingSetId: setId,
                                          });
                                          setActiveDropdownId(null);
                                        }}
                                        onDeleteSet={(setId) => {
                                          const updated = responseSets.filter(s => s.id !== setId);
                                          setResponseSets(updated);
                                          persistCustomSets(updated);
                                          setWorkingDoc(prev => ({
                                            ...prev,
                                            pages: prev.pages.map(page => ({
                                              ...page,
                                              sections: page.sections.map(section => ({
                                                ...section,
                                                questions: section.questions.map(qq => {
                                                  if (qq.responseSetId === setId) {
                                                    return { ...qq, responses: [...NEW_QUESTION_DEFAULT_RESPONSES], responseSetId: undefined };
                                                  }
                                                  return qq;
                                                }),
                                              })),
                                            })),
                                          }));
                                          triggerAutosave();
                                        }}
                                        onClose={() => setActiveDropdownId(null)}
                                      />
                                    )}
                                  </div>

                                  <div style={{ position: 'relative' }}>
                                    {!showMaxScore ? (
                                      <div>
                                        <div style={{ height: 22 }} />
                                        <button onClick={(e) => { e.stopPropagation(); setScoringPanelId(showScoring ? null : q.id); }}
                                          style={{
                                            backgroundColor: 'transparent', border: `1px solid ${V.border}`,
                                            color: V.label, width: 30, height: 30, borderRadius: '50%',
                                            fontSize: '0.7rem', cursor: 'pointer', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', padding: 0,
                                          }}>0</button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 85 }}>
                                        <label style={fieldLabelStyle}>Max score</label>
                                        <div style={{
                                          display: 'flex', alignItems: 'center',
                                          border: `1px solid ${V.border}`, borderRadius: 6,
                                          backgroundColor: '#f8fafc', height: 38, boxSizing: 'border-box',
                                        }}>
                                          <span style={{
                                            width: 40, padding: '0 8px', fontSize: '0.95rem',
                                            textAlign: 'center', color: V.text, lineHeight: '38px',
                                          }}>{derivedMax}</span>
                                          <button onClick={(e) => { e.stopPropagation(); setScoringPanelId(showScoring ? null : q.id); }}
                                            style={{
                                              background: 'none', border: 'none',
                                              borderLeft: `1px solid ${V.border}`, fontSize: '1.2rem',
                                              color: V.label, cursor: 'pointer', padding: '0 8px',
                                              alignSelf: 'stretch', display: 'flex', alignItems: 'center',
                                            }}>⋮</button>
                                        </div>
                                      </div>
                                    )}

                                    {showScoring && (
                                      <ScoringPanel
                                        question={q}
                                        onClose={() => setScoringPanelId(null)}
                                        onEditResponseSet={() => {
                                          setMcEditor({ pIdx, sIdx, qIdx, responses: q.responses || [], editingSetId: q.responseSetId });
                                          setScoringPanelId(null);
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>

                                <div style={{
                                  padding: '10px 0px', borderTop: `1px solid ${V.border}`, marginTop: 0,
                                  display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={fieldLabelStyle}>Risk</label>
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      ...(section.risk !== 'Indiv.' ? { opacity: 0.6 } : {}),
                                    }}>
                                      {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => (
                                        <label key={r} style={{ fontSize: '0.9rem', color: V.label, marginRight: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                          <input type="radio" name={`${q.id}-risk`}
                                            checked={section.risk !== 'Indiv.' ? (section.risk === (r === 'Medium' ? 'Med' : r)) : q.risk === r}
                                            disabled={section.risk !== 'Indiv.'}
                                            onChange={() => handleUpdateQuestion(pIdx, sIdx, qIdx, 'risk', r)}
                                            style={{ marginRight: 4, accentColor: V.purple }}
                                          />
                                          {r}
                                        </label>
                                      ))}
                                      {section.risk !== 'Indiv.' && (
                                        <span style={{ fontSize: '0.75em', color: V.placeholder, marginLeft: 5, fontStyle: 'italic' }}>(Section Override)</span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem', color: V.label }}>
                                    <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>SOP / Category:</label>
                                    {allCategories.map(cat => (
                                      <label key={cat} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                        <input type="radio" name={`${q.id}-cat`} checked={(q.category || '') === cat}
                                          onChange={() => handleUpdateQuestion(pIdx, sIdx, qIdx, 'category', cat)}
                                          style={{ marginRight: 4, accentColor: V.purple }} />
                                        {cat}
                                      </label>
                                    ))}
                                    {categoryDropdownId === q.id ? (
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <input
                                          type="text"
                                          value={newCategoryInput}
                                          onChange={e => setNewCategoryInput(e.target.value)}
                                          placeholder="New category"
                                          autoFocus
                                          onKeyDown={e => {
                                            if (e.key === 'Enter' && newCategoryInput.trim()) {
                                              const val = newCategoryInput.trim();
                                              if (!allCategories.includes(val)) setCustomCategories(prev => [...prev, val]);
                                              handleUpdateQuestion(pIdx, sIdx, qIdx, 'category', val);
                                              setNewCategoryInput('');
                                              setCategoryDropdownId(null);
                                            }
                                            if (e.key === 'Escape') { setNewCategoryInput(''); setCategoryDropdownId(null); }
                                          }}
                                          style={{
                                            border: `1px solid ${V.purple}`, borderRadius: 5, padding: '3px 8px',
                                            fontSize: '0.8rem', outline: 'none', width: 120, background: '#faf5ff',
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            if (newCategoryInput.trim()) {
                                              const val = newCategoryInput.trim();
                                              if (!allCategories.includes(val)) setCustomCategories(prev => [...prev, val]);
                                              handleUpdateQuestion(pIdx, sIdx, qIdx, 'category', val);
                                              setNewCategoryInput('');
                                            }
                                            setCategoryDropdownId(null);
                                          }}
                                          style={{
                                            background: V.purple, color: '#fff', border: 'none', borderRadius: 5,
                                            padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center',
                                          }}
                                        >
                                          <Check size={12} />
                                        </button>
                                        <button
                                          onClick={() => { setNewCategoryInput(''); setCategoryDropdownId(null); }}
                                          style={{
                                            background: 'none', color: V.label, border: `1px solid #d1d5db`, borderRadius: 5,
                                            padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer',
                                            display: 'inline-flex', alignItems: 'center',
                                          }}
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setCategoryDropdownId(q.id)}
                                        style={{
                                          background: 'none', border: `1px dashed ${V.purple}`, borderRadius: 5,
                                          padding: '2px 8px', fontSize: '0.75rem', color: V.purple,
                                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
                                          fontWeight: 500, whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <Plus size={11} /> Add
                                      </button>
                                    )}
                                  </div>

                                  {departmentNames.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem', color: V.label, marginTop: 6 }}>
                                      <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>Responsibility:</label>
                                      {departmentNames.map(dept => (
                                        <label key={dept} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                          <input type="checkbox" checked={(q.responsibility || []).includes(dept)}
                                            onChange={() => {
                                              const current = q.responsibility || [];
                                              const updated = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
                                              handleUpdateQuestion(pIdx, sIdx, qIdx, 'responsibility', updated);
                                            }}
                                            style={{ marginRight: 4, accentColor: V.purple }} />
                                          {dept}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div style={{ padding: '10px 0px', borderTop: `1px solid ${V.border}`, margin: 0 }}>
                                  <label style={{ ...fieldLabelStyle, marginBottom: 6 }}>Standard Requirement</label>
                                  <textarea value={q.requirement}
                                    onChange={e => handleUpdateQuestion(pIdx, sIdx, qIdx, 'requirement', e.target.value)}
                                    placeholder="Enter standard requirement..."
                                    style={{
                                      ...inputStyle, minHeight: 60, resize: 'vertical', fontSize: '0.95rem',
                                    }}
                                  />
                                </div>

                                <div style={{
                                  backgroundColor: V.white, borderTop: `1px solid ${V.border}`,
                                  padding: '10px 0px', display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', fontSize: '0.9rem', flexWrap: 'wrap',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                                      <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addLogicRule(pIdx, sIdx, qIdx); }}
                                        style={{ color: V.purple, textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                        <Link2 size={16} /> Add logic
                                      </a>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                        <input type="checkbox" checked={q.isRequired}
                                          onChange={e => handleUpdateQuestion(pIdx, sIdx, qIdx, 'isRequired', e.target.checked)}
                                          style={{ accentColor: V.purple, width: 16, height: 16 }}
                                        />
                                        Required
                                      </label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                        <input type="checkbox" checked={q.isMultipleSelection}
                                          onChange={e => handleUpdateQuestion(pIdx, sIdx, qIdx, 'isMultipleSelection', e.target.checked)}
                                          style={{ accentColor: V.purple, width: 16, height: 16 }}
                                        />
                                        Multiple selection
                                      </label>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                        <input type="checkbox" checked={q.isFlagged}
                                          onChange={e => handleUpdateQuestion(pIdx, sIdx, qIdx, 'isFlagged', e.target.checked)}
                                          style={{ accentColor: V.purple, width: 16, height: 16 }}
                                        />
                                        Flagged responses
                                        <span style={{
                                          backgroundColor: V.noBg, color: V.noText,
                                          padding: '2px 6px', borderRadius: 10, fontSize: '0.75rem',
                                          fontWeight: 'bold', marginLeft: 8,
                                        }}>{q.flaggedValue || 'No'}</span>
                                      </label>
                                    </div>
                                  </div>
                                  <button style={{
                                    background: 'none', border: 'none', fontSize: '1.5rem',
                                    color: V.label, cursor: 'pointer', padding: 5, lineHeight: 1,
                                  }}>⋮</button>
                                </div>

                                {(q.logicRules || []).length > 0 && (
                                  <div style={{
                                    padding: '15px 20px', backgroundColor: V.white,
                                    borderTop: `1px solid #e2e8f0`,
                                  }}>
                                    {(q.logicRules || []).map(rule => (
                                      <div key={rule.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '10px 0', fontSize: '0.9rem', color: '#4a5568',
                                        borderBottom: '1px dashed #e2e8f0', flexWrap: 'wrap',
                                      }}>
                                        <span style={{ width: 4, height: 20, backgroundColor: V.purple, borderRadius: 2, opacity: 0.5, cursor: 'grab' }} />
                                        <span>If answer is</span>
                                        <select value={rule.answer}
                                          onChange={e => {
                                            const updated = (q.logicRules || []).map(r => r.id === rule.id ? { ...r, answer: e.target.value } : r);
                                            handleUpdateQuestion(pIdx, sIdx, qIdx, 'logicRules', updated);
                                          }}
                                          style={{
                                            padding: '6px 10px', border: `1px solid ${V.border}`, borderRadius: 6,
                                            backgroundColor: V.white, fontSize: '0.9rem', color: V.text, minWidth: 80,
                                          }}
                                        >
                                          {(q.responses || []).map(r => (
                                            <option key={r.id} value={r.text}>{r.text}</option>
                                          ))}
                                        </select>
                                        <span>then</span>

                                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                          {(rule.triggers || []).map(trigger => (
                                            <span key={trigger.id} style={{
                                              backgroundColor: '#e0f2fe', color: '#0284c7',
                                              padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem',
                                              fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5,
                                            }}>
                                              {trigger.label}
                                              <button onClick={(e) => { e.stopPropagation(); removeTrigger(pIdx, sIdx, qIdx, rule.id, trigger.id); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>
                                                ×
                                              </button>
                                            </span>
                                          ))}
                                        </div>

                                        <div style={{ position: 'relative' }}>
                                          <TriggerMenu
                                            onSelect={(actionType, label) => addTriggerToRule(pIdx, sIdx, qIdx, rule.id, actionType, label)}
                                          />
                                        </div>

                                        <button onClick={(e) => { e.stopPropagation(); deleteLogicRule(pIdx, sIdx, qIdx, rule.id); }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, fontSize: '1rem', padding: 5 }}>
                                          ⋮
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {(section.subSections || []).map((subSec, subIdx) => {
                            const isSubCollapsed = collapsedSections.has(subSec.id);
                            const parentSopTitle = section.title || '';
                            const subSopOptions = (parentSopTitle && sopSubTopics[parentSopTitle]) ? sopSubTopics[parentSopTitle] : [];
                            return (
                              <div key={subSec.id} style={{ margin: '8px 0 4px 0', borderLeft: `3px solid #a78bfa`, borderRadius: 8, backgroundColor: '#faf5ff' }}>
                                <div
                                  onClick={() => setCollapsedSections(prev => {
                                    const next = new Set(prev);
                                    next.has(subSec.id) ? next.delete(subSec.id) : next.add(subSec.id);
                                    return next;
                                  })}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                    cursor: 'pointer', borderRadius: '8px 8px 0 0', userSelect: 'none',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span onClick={e => e.stopPropagation()} title="Drag to reorder sub-section"
                                    style={{ cursor: 'grab', padding: '4px 2px', color: V.label, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                                    <GripVertical size={14} />
                                  </span>
                                  <span style={{
                                    fontSize: '0.85em', color: V.purple, padding: 3,
                                    transition: 'transform 0.2s', transform: isSubCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                                    display: 'inline-block',
                                  }}>▼</span>

                                  {subSopOptions.length > 0 ? (
                                    <select
                                      value={subSec.title || ''}
                                      onChange={e => {
                                        e.stopPropagation();
                                        const val = e.target.value;
                                        handleUpdateSubSection(pIdx, sIdx, subIdx, 'title', val);
                                        handleUpdateSubSection(pIdx, sIdx, subIdx, 'subCategory', val);
                                      }}
                                      onClick={e => e.stopPropagation()}
                                      style={{
                                        background: subSec.title ? '#f0fdf4' : V.white,
                                        border: `1px solid ${subSec.title ? '#86efac' : V.border}`,
                                        borderRadius: 6, padding: '4px 10px',
                                        fontSize: '0.88rem', fontWeight: 600,
                                        color: subSec.title ? '#15803d' : V.label,
                                        cursor: 'pointer', outline: 'none', flex: 1, minWidth: 0,
                                      }}
                                    >
                                      <option value="">Sub-Category title...</option>
                                      {subSopOptions.map(st => (
                                        <option key={st} value={st}>{st}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={subSec.title}
                                      onChange={e => handleUpdateSubSection(pIdx, sIdx, subIdx, 'title', e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      placeholder="Sub-Category title..."
                                      style={{
                                        border: 'none', background: 'transparent',
                                        fontSize: '1rem', fontWeight: 600, color: V.purple, flex: 1,
                                        padding: 5, minWidth: 120, outline: 'none',
                                      }}
                                    />
                                  )}

                                  <span style={{ fontSize: '0.75rem', color: V.label, fontStyle: 'italic', userSelect: 'none', flexShrink: 0 }}>
                                    (Drag Header to Reorder)
                                  </span>

                                  <span style={{
                                    fontSize: '0.8rem', color: V.label,
                                    backgroundColor: V.white, padding: '2px 6px', borderRadius: 4,
                                    border: `1px solid ${V.border}`, flexShrink: 0,
                                  }}>
                                    {subSec.questions.length}
                                  </span>

                                  {(() => {
                                    const subQs = subSec.questions || [];
                                    const noResp = subQs.filter(q => !q.responsibility || q.responsibility.length === 0).length;
                                    const noCat = subQs.filter(q => !q.category).length;
                                    return (noResp > 0 || noCat > 0) ? (
                                      <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                                        {noResp > 0 && <span style={{ fontSize: '0.65rem', color: '#dc2626', backgroundColor: '#fef2f2', padding: '1px 5px', borderRadius: 4, border: '1px solid #fecaca', fontWeight: 600 }}>
                                          {noResp} unassigned
                                        </span>}
                                        {noCat > 0 && <span style={{ fontSize: '0.65rem', color: '#d97706', backgroundColor: '#fffbeb', padding: '1px 5px', borderRadius: 4, border: '1px solid #fde68a', fontWeight: 600 }}>
                                          {noCat} uncategorized
                                        </span>}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>

                                <div
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 8px 36px',
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: V.label, flexShrink: 0 }}>
                                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                      <input type="radio" name={`${subSec.id}-app`} checked={subSec.isApplicable !== false}
                                        onChange={() => handleUpdateSubSection(pIdx, sIdx, subIdx, 'isApplicable', true)}
                                        style={{ marginRight: 4, accentColor: V.purple }} />
                                      Applicable
                                    </label>
                                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                      <input type="radio" name={`${subSec.id}-app`} checked={subSec.isApplicable === false}
                                        onChange={() => handleUpdateSubSection(pIdx, sIdx, subIdx, 'isApplicable', false)}
                                        style={{ marginRight: 4, accentColor: V.purple }} />
                                      Not Applicable
                                    </label>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: V.label, marginLeft: 10, flexShrink: 0 }}>
                                    <span style={{ marginRight: 5 }}>Risk:</span>
                                    {(['Indiv.', 'Low', 'Med', 'High'] as SectionRisk[]).map(r => (
                                      <label key={r} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                        <input type="radio" name={`${subSec.id}-risk`} checked={(subSec.risk || 'Indiv.') === r}
                                          onChange={() => handleUpdateSubSection(pIdx, sIdx, subIdx, 'risk', r)}
                                          style={{ marginRight: 4, accentColor: V.purple }} />
                                        {r}
                                      </label>
                                    ))}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setMoveSubSectionModal({ pIdx, sIdx, subIdx, title: subSec.title || `Sub-section ${subIdx + 1}` }); }} title="Move sub-section"
                                      style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 5, color: '#0891b2' }}>
                                      <ArrowRightLeft size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); duplicateSubSection(pIdx, sIdx, subIdx); }} title="Duplicate sub-section"
                                      style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: 5, color: V.purple }}>
                                      <Copy size={14} />
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); deleteSubSection(pIdx, sIdx, subIdx, subSec.title); }}
                                      title="Delete sub-category"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5, color: V.dangerRed }}>
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>

                                {!isSubCollapsed && (
                                  <div style={{ padding: '4px 8px 8px 8px' }}>
                                    {subSec.questions.map((q, qIdx) => {
                                      const isQSelected = selectedBlockId === q.id;
                                      const isEditing = editingQuestionId === q.id;
                                      const showDropdownSub = activeDropdownId === q.id;
                                      const showScoringSub = scoringPanelId === q.id;
                                      const derivedMaxSub = (q.responses || []).reduce((mx, r) => {
                                        const n = parseFloat(r.score || '0');
                                        return isNaN(n) ? mx : Math.max(mx, n);
                                      }, 0);
                                      const showMaxScoreSub = derivedMaxSub > 0 || q.maxScore > 0;
                                      return (
                                        <div key={q.id}
                                          onClick={(e) => { e.stopPropagation(); setSelectedBlockId(q.id); }}
                                          style={{
                                            backgroundColor: isQSelected ? '#ede9fe' : V.white,
                                            borderLeft: isQSelected ? `2px solid ${V.purple}` : '1px solid transparent',
                                            borderRight: isQSelected ? `2px solid ${V.purple}` : '1px solid transparent',
                                            borderTop: qIdx === 0 ? (isQSelected ? `2px solid ${V.purple}` : '1px solid transparent') : `1px dashed #e2e8f0`,
                                            borderBottom: isQSelected ? `2px solid ${V.purple}` : '1px solid transparent',
                                            borderRadius: 0, position: 'relative', cursor: 'default',
                                            transition: 'border-color 0.15s', paddingRight: 35,
                                          }}
                                        >
                                          <QuickAddPanel
                                            visible={isQSelected}
                                            onAddQuestion={() => addQuestionToSubSection(pIdx, sIdx, subIdx, qIdx)}
                                            onAddSection={() => addSection(pIdx, sIdx)}
                                            onAddSubSection={() => addSubSection(pIdx, sIdx)}
                                            onAddPage={() => addPage()}
                                          />
                                          <button onClick={(e) => { e.stopPropagation(); setMoveModalExpanded(new Set()); setMoveModal({ pIdx, sIdx, qIdx, questionText: q.text || `Question ${qIdx + 1}`, subIdx }); }}
                                            title="Move to another section"
                                            style={{
                                              position: 'absolute', top: 8, right: 30,
                                              background: 'none', border: 'none', color: V.purple,
                                              cursor: 'pointer', padding: 4, zIndex: 10,
                                              opacity: isQSelected ? 0.7 : 0, pointerEvents: isQSelected ? 'auto' : 'none',
                                              transition: 'opacity 0.2s',
                                            }}>
                                            <ArrowRightLeft size={12} />
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); deleteQuestionFromSubSection(pIdx, sIdx, subIdx, qIdx); }}
                                            title="Delete question"
                                            style={{
                                              position: 'absolute', top: 8, right: 5,
                                              background: 'none', border: 'none', color: V.dangerRed,
                                              cursor: 'pointer', padding: 4, zIndex: 10,
                                              opacity: isQSelected ? 0.7 : 0, pointerEvents: isQSelected ? 'auto' : 'none',
                                              transition: 'opacity 0.2s',
                                            }}>
                                            <Trash2 size={14} />
                                          </button>

                                          <div style={{ padding: '15px 0px 10px 0px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div onClick={e => e.stopPropagation()} style={{ paddingTop: 22, flexShrink: 0 }}>
                                              <input type="checkbox" checked={bulkMoveIds.has(q.id)}
                                                onChange={() => toggleBulkSelect(q.id)}
                                                title="Select for bulk move"
                                                style={{ width: 16, height: 16, accentColor: V.purple, cursor: 'pointer' }} />
                                            </div>
                                            <div style={{ flexGrow: 1 }}>
                                              <label style={fieldLabelStyle}>Question</label>
                                              <div
                                                onDoubleClick={() => setEditingQuestionId(q.id)}
                                                style={{
                                                  position: 'relative', display: 'flex', alignItems: 'center',
                                                  border: `2px solid ${V.purple}`, backgroundColor: isEditing ? V.white : V.lightPurpleBg,
                                                  borderRadius: 6, cursor: 'text',
                                                  boxShadow: isEditing ? `0 0 0 3px rgba(110,66,255,0.25)` : 'none',
                                                }}
                                              >
                                                <span style={{ width: 10, height: 10, backgroundColor: V.purple, borderRadius: '50%', position: 'absolute', top: '50%', transform: 'translateY(-50%)', cursor: 'grab', left: -5 }} />
                                                <input type="text"
                                                  readOnly={!isEditing}
                                                  value={q.text}
                                                  onChange={e => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'text', e.target.value)}
                                                  onBlur={() => setEditingQuestionId(null)}
                                                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingQuestionId(null); }}
                                                  placeholder="Type question..."
                                                  style={{
                                                    width: '100%', padding: '10px 12px', border: 'none',
                                                    backgroundColor: 'transparent', fontSize: '1rem',
                                                    color: V.text, outline: 'none', cursor: isEditing ? 'text' : 'default',
                                                  }}
                                                />
                                                <span style={{ width: 10, height: 10, backgroundColor: V.purple, borderRadius: '50%', position: 'absolute', top: '50%', transform: 'translateY(-50%)', cursor: 'grab', right: -5 }} />
                                              </div>
                                            </div>

                                            {availableAutoMarks.length > 0 && (
                                              <div style={{ minWidth: 80 }} onClick={e => e.stopPropagation()}>
                                                <label style={fieldLabelStyle}>Max marks</label>
                                                <select
                                                  value={derivedMaxSub > 0 ? derivedMaxSub : (q.maxScore || 0)}
                                                  onChange={e => applyMaxMarksToSubQuestion(pIdx, sIdx, subIdx, qIdx, parseInt(e.target.value) || 0)}
                                                  style={{
                                                    width: '100%', height: 38, border: `1px solid ${V.border}`,
                                                    borderRadius: 6, backgroundColor: derivedMaxSub > 0 ? '#f0fdf4' : '#f8fafc',
                                                    color: V.text, fontSize: '0.9rem', padding: '0 8px', cursor: 'pointer',
                                                    fontWeight: derivedMaxSub > 0 ? 600 : 400,
                                                  }}
                                                >
                                                  <option value={0}>—</option>
                                                  {availableAutoMarks.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                  ))}
                                                </select>
                                              </div>
                                            )}

                                            <div style={{ minWidth: 220, position: 'relative' }}>
                                              <label style={fieldLabelStyle}>Type of response</label>
                                              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: V.lightPurpleBg, borderRadius: 6, padding: 4, minHeight: 34 }}>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap', overflow: 'hidden', alignItems: 'center' }}>
                                                  {q.responseType === 'multiple' && (q.responses || []).length > 0 ? (
                                                    (q.responses || []).slice(0, 3).map(r => (
                                                      <span key={r.id} style={{ padding: '6px 12px', border: 'none', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500, cursor: 'default', whiteSpace: 'nowrap', ...getResponseBtnStyle(r.color) }}>{r.text}</span>
                                                    ))
                                                  ) : (
                                                    <span style={{ padding: '6px 12px', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500, backgroundColor: V.lightPurpleBg, color: V.purple, border: `1px solid ${V.purple}` }}>{q.responseType}</span>
                                                  )}
                                                  {(q.responses || []).length > 3 && <span style={{ fontSize: '0.8rem', color: V.label, marginLeft: -2 }}>+{(q.responses || []).length - 3}</span>}
                                                </div>
                                                <span onClick={(e) => { e.stopPropagation(); setActiveDropdownId(showDropdownSub ? null : q.id); }}
                                                  style={{ fontSize: '0.9rem', color: V.label, marginLeft: 'auto', padding: '5px 8px', cursor: 'pointer', userSelect: 'none' }}>
                                                  {showDropdownSub ? '▲' : '▼'}
                                                </span>
                                              </div>
                                              {showDropdownSub && (
                                                <ResponseTypeDropdown
                                                  responseSets={responseSets}
                                                  onSelect={(type, resps, setId) => {
                                                    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'responseType', type);
                                                    handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'responses', resps);
                                                    if (setId) handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'responseSetId', setId);
                                                    setActiveDropdownId(null);
                                                    triggerAutosave();
                                                  }}
                                                  onOpenEditor={(resps, setId) => {
                                                    setMcEditor({ pIdx, sIdx, qIdx, responses: resps || [{ id: `na-${Date.now()}`, text: 'N/A', color: '#a0aec0', isFlagged: false, score: '' }], editingSetId: setId });
                                                    setActiveDropdownId(null);
                                                  }}
                                                  onDeleteSet={(setId) => {
                                                    const updated = responseSets.filter(s => s.id !== setId);
                                                    setResponseSets(updated);
                                                    persistCustomSets(updated);
                                                  }}
                                                  onClose={() => setActiveDropdownId(null)}
                                                />
                                              )}
                                            </div>

                                            <div style={{ position: 'relative' }}>
                                              {!showMaxScoreSub ? (
                                                <div>
                                                  <div style={{ height: 22 }} />
                                                  <button onClick={(e) => { e.stopPropagation(); setScoringPanelId(showScoringSub ? null : q.id); }}
                                                    style={{ backgroundColor: 'transparent', border: `1px solid ${V.border}`, color: V.label, width: 30, height: 30, borderRadius: '50%', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>0</button>
                                                </div>
                                              ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 85 }}>
                                                  <label style={fieldLabelStyle}>Max score</label>
                                                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${V.border}`, borderRadius: 6, backgroundColor: '#f8fafc', height: 38, boxSizing: 'border-box' }}>
                                                    <span style={{ width: 40, padding: '0 8px', fontSize: '0.95rem', textAlign: 'center', color: V.text, lineHeight: '38px' }}>{derivedMaxSub}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setScoringPanelId(showScoringSub ? null : q.id); }}
                                                      style={{ background: 'none', border: 'none', borderLeft: `1px solid ${V.border}`, fontSize: '1.2rem', color: V.label, cursor: 'pointer', padding: '0 8px', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>⋮</button>
                                                  </div>
                                                </div>
                                              )}
                                              {showScoringSub && (
                                                <ScoringPanel question={q} onClose={() => setScoringPanelId(null)}
                                                  onEditResponseSet={() => { setMcEditor({ pIdx, sIdx, qIdx, responses: q.responses || [], editingSetId: q.responseSetId }); setScoringPanelId(null); }} />
                                              )}
                                            </div>
                                          </div>

                                          <div style={{ padding: '10px 0px', borderTop: `1px solid ${V.border}`, marginTop: 0, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                              <label style={fieldLabelStyle}>Risk</label>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...((subSec.risk || 'Indiv.') !== 'Indiv.' ? { opacity: 0.6 } : {}) }}>
                                                {(['Low', 'Medium', 'High'] as RiskLevel[]).map(r => (
                                                  <label key={r} style={{ fontSize: '0.9rem', color: V.label, marginRight: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                                    <input type="radio" name={`${q.id}-risk-sub`}
                                                      checked={(subSec.risk || 'Indiv.') !== 'Indiv.' ? ((subSec.risk || 'Indiv.') === (r === 'Medium' ? 'Med' : r)) : q.risk === r}
                                                      disabled={(subSec.risk || 'Indiv.') !== 'Indiv.'}
                                                      onChange={() => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'risk', r)}
                                                      style={{ marginRight: 4, accentColor: V.purple }} />
                                                    {r}
                                                  </label>
                                                ))}
                                                {(subSec.risk || 'Indiv.') !== 'Indiv.' && <span style={{ fontSize: '0.75em', color: V.placeholder, marginLeft: 5, fontStyle: 'italic' }}>(Sub-Section Override)</span>}
                                              </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem', color: V.label }}>
                                              <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>SOP / Category:</label>
                                              {allCategories.map(cat => (
                                                <label key={cat} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                                  <input type="radio" name={`${q.id}-cat-sub`} checked={(q.category || '') === cat}
                                                    onChange={() => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'category', cat)}
                                                    style={{ marginRight: 4, accentColor: V.purple }} />
                                                  {cat}
                                                </label>
                                              ))}
                                              {categoryDropdownId === q.id ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                  <input type="text" value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} placeholder="New category" autoFocus
                                                    onKeyDown={e => {
                                                      if (e.key === 'Enter' && newCategoryInput.trim()) {
                                                        const val = newCategoryInput.trim();
                                                        if (!allCategories.includes(val)) setCustomCategories(prev => [...prev, val]);
                                                        handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'category', val);
                                                        setNewCategoryInput(''); setCategoryDropdownId(null);
                                                      }
                                                      if (e.key === 'Escape') { setNewCategoryInput(''); setCategoryDropdownId(null); }
                                                    }}
                                                    style={{ border: `1px solid ${V.purple}`, borderRadius: 5, padding: '3px 8px', fontSize: '0.8rem', outline: 'none', width: 120, background: '#faf5ff' }}
                                                  />
                                                  <button onClick={() => { if (newCategoryInput.trim()) { const val = newCategoryInput.trim(); if (!allCategories.includes(val)) setCustomCategories(prev => [...prev, val]); handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'category', val); setNewCategoryInput(''); } setCategoryDropdownId(null); }}
                                                    style={{ background: V.purple, color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><Check size={12} /></button>
                                                  <button onClick={() => { setNewCategoryInput(''); setCategoryDropdownId(null); }}
                                                    style={{ background: 'none', color: V.label, border: `1px solid #d1d5db`, borderRadius: 5, padding: '3px 6px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><X size={12} /></button>
                                                </div>
                                              ) : (
                                                <button onClick={() => setCategoryDropdownId(q.id)}
                                                  style={{ background: 'none', border: `1px dashed ${V.purple}`, borderRadius: 5, padding: '2px 8px', fontSize: '0.75rem', color: V.purple, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                  <Plus size={11} /> Add
                                                </button>
                                              )}
                                            </div>

                                            {departmentNames.length > 0 && (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.85rem', color: V.label, marginTop: 6 }}>
                                                <label style={{ ...fieldLabelStyle, marginBottom: 0 }}>Responsibility:</label>
                                                {departmentNames.map(dept => (
                                                  <label key={dept} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                                    <input type="checkbox" checked={(q.responsibility || []).includes(dept)}
                                                      onChange={() => {
                                                        const current = q.responsibility || [];
                                                        const updated = current.includes(dept) ? current.filter(d => d !== dept) : [...current, dept];
                                                        handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'responsibility', updated);
                                                      }}
                                                      style={{ marginRight: 4, accentColor: V.purple }} />
                                                    {dept}
                                                  </label>
                                                ))}
                                              </div>
                                            )}
                                          </div>

                                          <div style={{ padding: '10px 0px', borderTop: `1px solid ${V.border}`, margin: 0 }}>
                                            <label style={{ ...fieldLabelStyle, marginBottom: 6 }}>Standard Requirement</label>
                                            <textarea value={q.requirement}
                                              onChange={e => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'requirement', e.target.value)}
                                              placeholder="Enter standard requirement..."
                                              style={{ ...inputStyle, minHeight: 60, resize: 'vertical', fontSize: '0.95rem' }}
                                            />
                                          </div>

                                          <div style={{ backgroundColor: V.white, borderTop: `1px solid ${V.border}`, padding: '10px 0px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                                                <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addLogicRuleToSubSection(pIdx, sIdx, subIdx, qIdx); }}
                                                  style={{ color: V.purple, textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                                                  <Link2 size={16} /> Add logic
                                                </a>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                                  <input type="checkbox" checked={q.isRequired}
                                                    onChange={e => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'isRequired', e.target.checked)}
                                                    style={{ accentColor: V.purple, width: 16, height: 16 }} />
                                                  Required
                                                </label>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                                  <input type="checkbox" checked={q.isMultipleSelection}
                                                    onChange={e => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'isMultipleSelection', e.target.checked)}
                                                    style={{ accentColor: V.purple, width: 16, height: 16 }} />
                                                  Multiple selection
                                                </label>
                                              </div>
                                              <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', borderLeft: `1px solid ${V.border}` }}>
                                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: V.label, fontWeight: 500, gap: 6 }}>
                                                  <input type="checkbox" checked={q.isFlagged}
                                                    onChange={e => handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'isFlagged', e.target.checked)}
                                                    style={{ accentColor: V.purple, width: 16, height: 16 }} />
                                                  Flagged responses
                                                  <span style={{ backgroundColor: V.noBg, color: V.noText, padding: '2px 6px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 'bold', marginLeft: 8 }}>{q.flaggedValue || 'No'}</span>
                                                </label>
                                              </div>
                                            </div>
                                            <button style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: V.label, cursor: 'pointer', padding: 5, lineHeight: 1 }}>⋮</button>
                                          </div>

                                          {(q.logicRules || []).length > 0 && (
                                            <div style={{ padding: '15px 20px', backgroundColor: V.white, borderTop: `1px solid #e2e8f0` }}>
                                              {(q.logicRules || []).map(rule => (
                                                <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', fontSize: '0.9rem', color: '#4a5568', borderBottom: '1px dashed #e2e8f0', flexWrap: 'wrap' }}>
                                                  <span style={{ width: 4, height: 20, backgroundColor: V.purple, borderRadius: 2, opacity: 0.5, cursor: 'grab' }} />
                                                  <span>If answer is</span>
                                                  <select value={rule.answer}
                                                    onChange={e => {
                                                      const updated = (q.logicRules || []).map(r => r.id === rule.id ? { ...r, answer: e.target.value } : r);
                                                      handleUpdateSubSectionQuestion(pIdx, sIdx, subIdx, qIdx, 'logicRules', updated);
                                                    }}
                                                    style={{ padding: '6px 10px', border: `1px solid ${V.border}`, borderRadius: 6, backgroundColor: V.white, fontSize: '0.9rem', color: V.text, minWidth: 80 }}>
                                                    {(q.responses || []).map(r => (<option key={r.id} value={r.text}>{r.text}</option>))}
                                                  </select>
                                                  <span>then</span>
                                                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                    {(rule.triggers || []).map(trigger => (
                                                      <span key={trigger.id} style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                        {trigger.label}
                                                        <button onClick={(e) => { e.stopPropagation(); removeTriggerFromSubSection(pIdx, sIdx, subIdx, qIdx, rule.id, trigger.id); }}
                                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0284c7', fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>×</button>
                                                      </span>
                                                    ))}
                                                  </div>
                                                  <div style={{ position: 'relative' }}>
                                                    <TriggerMenu onSelect={(actionType, label) => addTriggerToRuleInSubSection(pIdx, sIdx, subIdx, qIdx, rule.id, actionType, label)} />
                                                  </div>
                                                  <button onClick={(e) => { e.stopPropagation(); deleteLogicRuleFromSubSection(pIdx, sIdx, subIdx, qIdx, rule.id); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, fontSize: '1rem', padding: 5 }}>⋮</button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    <button
                                      onClick={e => { e.stopPropagation(); addQuestionToSubSection(pIdx, sIdx, subIdx, subSec.questions.length - 1); }}
                                      style={{
                                        width: '100%', padding: '8px', marginTop: 4,
                                        background: 'none', border: `1px dashed #c4b5fd`,
                                        borderRadius: 6, fontSize: '0.82rem', fontWeight: 600,
                                        color: '#7c3aed', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: 5,
                                      }}>
                                      <Plus size={13} /> Add Question
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button
                            onClick={e => { e.stopPropagation(); addSubSection(pIdx, sIdx); }}
                            style={{
                              width: '100%', padding: '10px', marginTop: 6, marginBottom: 4,
                              background: 'none', border: `2px dashed #c4b5fd`,
                              borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                              color: '#7c3aed', cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}>
                            <Plus size={14} /> Add Sub-Category
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          ))}

          {!fixedPages && <button onClick={addPage} style={{
            width: '100%', padding: '16px 20px', marginTop: 10, marginBottom: 10,
            backgroundColor: V.white, border: `2px dashed ${V.purple}`,
            borderRadius: 10, fontSize: '1rem', fontWeight: 600,
            color: V.purple, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = V.lightPurpleBg; e.currentTarget.style.borderColor = V.purple; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.borderColor = V.purple; }}
          >
            <Plus size={20} strokeWidth={2.5} /> Add New Department
          </button>}

          <div style={{ position: 'relative', marginTop: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAddItemPopup(!addItemPopup)} style={btnStyle}>
                <Plus size={16} strokeWidth={2.5} /> Add new
              </button>
              {addItemPopup && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 100,
                  backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 8,
                  boxShadow: '0 5px 15px rgba(0,0,0,0.15)', width: 280, overflow: 'hidden',
                }}>
                  {[
                    { type: 'question', icon: '❓', title: 'Question', desc: 'Select a response type to capture information' },
                    { type: 'section', icon: '📋', title: 'Section', desc: 'Group related questions together within a section' },
                    ...(!fixedPages ? [{ type: 'page', icon: '📄', title: 'Department', desc: 'Add a new department with default sections' }] : []),
                  ].map(opt => (
                    <div key={opt.type} onClick={() => {
                      setAddItemPopup(false);
                      if (opt.type === 'page') addPage();
                      else if (opt.type === 'section' && workingDoc.pages.length > 0) {
                        const lastPIdx = workingDoc.pages.length - 1;
                        addSection(lastPIdx, workingDoc.pages[lastPIdx].sections.length - 1);
                      }
                      else if (opt.type === 'question' && workingDoc.pages.length > 0) {
                        const lastPIdx = workingDoc.pages.length - 1;
                        const lastSIdx = workingDoc.pages[lastPIdx].sections.length - 1;
                        if (lastSIdx >= 0) addQuestion(lastPIdx, lastSIdx, workingDoc.pages[lastPIdx].sections[lastSIdx].questions.length - 1);
                      }
                    }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        cursor: 'pointer', borderBottom: `1px solid #f0f2f5`, transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.containerBg)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.95rem', color: V.text }}>{opt.title}</strong>
                        <span style={{ fontSize: '0.8rem', color: V.label }}>{opt.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => csvFileRef.current?.click()} style={btnStyle}>
              <Upload size={16} /> Upload CSV
            </button>
            <input ref={csvFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} />

            <button onClick={downloadSampleCsv} style={btnStyle}>
              <FileDown size={16} /> Download Sample CSV
            </button>

            <div style={{ position: 'relative' }}>
              <button onClick={() => setDownloadPopup(!downloadPopup)} style={btnStyle}>
                <Download size={16} /> Download Checklist
              </button>
              {downloadPopup && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 100,
                  backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 8,
                  boxShadow: '0 5px 15px rgba(0,0,0,0.15)', width: 260, overflow: 'hidden',
                }}>
                  <div onClick={async () => { setDownloadPopup(false); await exportChecklistToExcel('department'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.containerBg)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📊</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>Excel (Department-wise)</strong>
                      <span style={{ fontSize: '0.8rem', color: V.label }}>Sheet per department + consolidated.</span>
                    </div>
                  </div>
                  <div style={{ height: 1, background: V.border }} />
                  <div onClick={async () => { setDownloadPopup(false); await exportChecklistToExcel('location'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.containerBg)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📍</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.95rem' }}>Excel (Location-wise)</strong>
                      <span style={{ fontSize: '0.8rem', color: V.label }}>Sheet per location/area + consolidated.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>}

      {moveModal && (() => {
        const handleMoveClick = (toPIdx: number, toSIdx: number, toSubIdx?: number) => {
          if (moveModal.subIdx !== undefined) {
            moveQuestionFromSubSection(moveModal.pIdx, moveModal.sIdx, moveModal.subIdx, moveModal.qIdx, toPIdx, toSIdx, toSubIdx);
          } else {
            moveQuestionToSection(moveModal.pIdx, moveModal.sIdx, moveModal.qIdx, toPIdx, toSIdx, toSubIdx);
          }
        };
        const toggleExp = (key: string) => setMoveModalExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
        const multiPages = workingDoc.pages.length > 1;
        return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMoveModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: V.white, borderRadius: 16, width: '90%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Move Question</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: V.label, lineHeight: 1.4 }}>
                  {moveModal.questionText.length > 60 ? moveModal.questionText.slice(0, 60) + '…' : moveModal.questionText}
                </p>
              </div>
              <button onClick={() => setMoveModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '8px 16px', background: '#fef3c7', borderBottom: `1px solid #fde68a`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color="#92400e" />
              <span style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 500 }}>
                Last 5 audit history records will move with this question
              </span>
            </div>
            <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(80vh - 140px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: '0.78rem', color: V.label, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Select destination
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { const all = new Set<string>(); workingDoc.pages.forEach((p, pi) => { all.add(`p-${pi}`); p.sections.forEach((_, si) => all.add(`s-${pi}-${si}`)); }); setMoveModalExpanded(all); }}
                    style={{ fontSize: '0.7rem', fontWeight: 600, color: V.purple, background: 'none', border: `1px solid ${V.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                    Expand All
                  </button>
                  <button onClick={() => setMoveModalExpanded(new Set())}
                    style={{ fontSize: '0.7rem', fontWeight: 600, color: V.label, background: 'none', border: `1px solid ${V.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                    Collapse All
                  </button>
                </div>
              </div>
              {workingDoc.pages.map((page, pIdx) => {
                const pageKey = `p-${pIdx}`;
                const pageExpanded = !multiPages || moveModalExpanded.has(pageKey);
                return (
                <div key={page.id} style={{ marginBottom: 8 }}>
                  {multiPages && (
                    <button onClick={() => toggleExp(pageKey)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                      background: '#f1f5f9', border: `1px solid ${V.border}`, borderRadius: pageExpanded ? '10px 10px 0 0' : 10,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <span style={{ transition: 'transform 0.2s', transform: pageExpanded ? 'rotate(90deg)' : 'rotate(0)', fontSize: '0.75rem', color: V.purple }}>▶</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: V.purple, flex: 1 }}>{page.title || `Page ${pIdx + 1}`}</span>
                      <span style={{ fontSize: '0.7rem', color: V.label }}>{page.sections.length} section{page.sections.length !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                  {pageExpanded && page.sections.map((section, sIdx) => {
                    const isSectionCurrent = pIdx === moveModal.pIdx && sIdx === moveModal.sIdx && moveModal.subIdx === undefined;
                    const hasSubSections = (section.subSections || []).length > 0;
                    const secKey = `s-${pIdx}-${sIdx}`;
                    const secExpanded = moveModalExpanded.has(secKey);
                    return (
                      <div key={section.id} style={{ marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${isSectionCurrent ? '#e2e8f0' : V.border}`,
                          borderRadius: (hasSubSections && secExpanded) ? '10px 10px 0 0' : 10, overflow: 'hidden', marginTop: 2,
                          backgroundColor: isSectionCurrent ? '#f8fafc' : V.white, opacity: isSectionCurrent ? 0.5 : 1, transition: 'all 0.15s',
                        }}>
                          <button
                            disabled={isSectionCurrent}
                            onClick={() => handleMoveClick(pIdx, sIdx)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                              padding: '10px 14px', border: 'none', background: 'transparent',
                              cursor: isSectionCurrent ? 'not-allowed' : 'pointer', textAlign: 'left',
                            }}
                            onMouseEnter={e => { if (!isSectionCurrent) e.currentTarget.parentElement!.style.backgroundColor = V.lightPurpleBg; }}
                            onMouseLeave={e => { if (!isSectionCurrent) e.currentTarget.parentElement!.style.backgroundColor = V.white; }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: isSectionCurrent ? '#e2e8f0' : V.lightPurpleBg, flexShrink: 0,
                            }}>
                              <FileText size={15} color={isSectionCurrent ? V.label : V.purple} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isSectionCurrent ? V.label : V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {section.title || 'Untitled Section'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: V.label }}>
                                {section.questions.length} direct question{section.questions.length !== 1 ? 's' : ''}
                                {hasSubSections && `, ${section.subSections!.length} sub-categor${section.subSections!.length !== 1 ? 'ies' : 'y'}`}
                                {isSectionCurrent && <span style={{ marginLeft: 6, color: '#6366f1', fontWeight: 600 }}>(current)</span>}
                              </div>
                            </div>
                            {!isSectionCurrent && <ArrowRightLeft size={14} color={V.label} />}
                          </button>
                          {hasSubSections && (
                            <button onClick={() => toggleExp(secKey)} style={{
                              background: 'none', border: 'none', borderLeft: `1px solid ${V.border}`,
                              padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                              color: V.purple, transition: 'background 0.15s',
                            }}
                              title={secExpanded ? 'Hide sub-categories' : 'Show sub-categories'}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = V.lightPurpleBg; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <span style={{ transition: 'transform 0.2s', transform: secExpanded ? 'rotate(90deg)' : 'rotate(0)', fontSize: '0.7rem' }}>▶</span>
                            </button>
                          )}
                        </div>
                        {hasSubSections && secExpanded && (section.subSections || []).map((ss, subIdx) => {
                          const isSubCurrent = pIdx === moveModal.pIdx && sIdx === moveModal.sIdx && moveModal.subIdx === subIdx;
                          return (
                            <button
                              key={ss.id}
                              disabled={isSubCurrent}
                              onClick={() => handleMoveClick(pIdx, sIdx, subIdx)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '8px 14px 8px 32px', borderRadius: 0, border: `1px solid ${isSubCurrent ? '#e2e8f0' : '#ede9fe'}`,
                                borderTop: 'none',
                                backgroundColor: isSubCurrent ? '#f8fafc' : '#faf5ff', cursor: isSubCurrent ? 'not-allowed' : 'pointer',
                                textAlign: 'left', transition: 'all 0.15s', opacity: isSubCurrent ? 0.5 : 1,
                              }}
                              onMouseEnter={e => { if (!isSubCurrent) { e.currentTarget.style.backgroundColor = '#ede9fe'; } }}
                              onMouseLeave={e => { if (!isSubCurrent) { e.currentTarget.style.backgroundColor = isSubCurrent ? '#f8fafc' : '#faf5ff'; } }}
                            >
                              <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe', flexShrink: 0 }}>
                                <ChevronRight size={12} color="#7c3aed" />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: isSubCurrent ? V.label : '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {ss.title || 'Untitled Sub-Category'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: V.label }}>
                                  {ss.questions.length} question{ss.questions.length !== 1 ? 's' : ''}
                                  {isSubCurrent && <span style={{ marginLeft: 4, color: '#6366f1', fontWeight: 600 }}>(current)</span>}
                                </div>
                              </div>
                              {!isSubCurrent && <ArrowRightLeft size={12} color={V.label} />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
              })}
            </div>
          </div>
        </div>
        );
      })()}

      {bulkMoveIds.size > 0 && !bulkMoveModal && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100,
          backgroundColor: V.purple, color: V.white, borderRadius: 12,
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 8px 32px rgba(110,66,255,0.4)', fontSize: '0.9rem', fontWeight: 600,
        }}>
          <span>{bulkMoveIds.size} question{bulkMoveIds.size !== 1 ? 's' : ''} selected</span>
          <button onClick={() => { setMoveModalExpanded(new Set()); setBulkMoveModal(true); }}
            style={{ backgroundColor: V.white, color: V.purple, border: 'none', borderRadius: 8, padding: '6px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ArrowRightLeft size={14} /> Move Selected
          </button>
          <button onClick={() => setBulkMoveIds(new Set())}
            style={{ background: 'none', border: `1px solid rgba(255,255,255,0.4)`, color: V.white, borderRadius: 8, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
            Clear
          </button>
        </div>
      )}

      {bulkMoveModal && (() => {
        const toggleExp = (key: string) => setMoveModalExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
        const multiPages = workingDoc.pages.length > 1;
        return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBulkMoveModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: V.white, borderRadius: 16, width: '90%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Move {bulkMoveIds.size} Question{bulkMoveIds.size !== 1 ? 's' : ''}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: V.label }}>Select destination for all selected questions</p>
              </div>
              <button onClick={() => setBulkMoveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: '0.78rem', color: V.label, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Select destination
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { const all = new Set<string>(); workingDoc.pages.forEach((p, pi) => { all.add(`p-${pi}`); p.sections.forEach((_, si) => all.add(`s-${pi}-${si}`)); }); setMoveModalExpanded(all); }}
                    style={{ fontSize: '0.7rem', fontWeight: 600, color: V.purple, background: 'none', border: `1px solid ${V.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                    Expand All
                  </button>
                  <button onClick={() => setMoveModalExpanded(new Set())}
                    style={{ fontSize: '0.7rem', fontWeight: 600, color: V.label, background: 'none', border: `1px solid ${V.border}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                    Collapse All
                  </button>
                </div>
              </div>
              {workingDoc.pages.map((page, pIdx) => {
                const pageKey = `p-${pIdx}`;
                const pageExpanded = !multiPages || moveModalExpanded.has(pageKey);
                return (
                <div key={page.id} style={{ marginBottom: 8 }}>
                  {multiPages && (
                    <button onClick={() => toggleExp(pageKey)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                      background: '#f1f5f9', border: `1px solid ${V.border}`, borderRadius: pageExpanded ? '10px 10px 0 0' : 10,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                      <span style={{ transition: 'transform 0.2s', transform: pageExpanded ? 'rotate(90deg)' : 'rotate(0)', fontSize: '0.75rem', color: V.purple }}>▶</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: V.purple, flex: 1 }}>{page.title || `Page ${pIdx + 1}`}</span>
                      <span style={{ fontSize: '0.7rem', color: V.label }}>{page.sections.length} section{page.sections.length !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                  {pageExpanded && page.sections.map((section, sIdx) => {
                    const hasSubSections = (section.subSections || []).length > 0;
                    const secKey = `s-${pIdx}-${sIdx}`;
                    const secExpanded = moveModalExpanded.has(secKey);
                    return (
                      <div key={section.id} style={{ marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'stretch', border: `1.5px solid ${V.border}`,
                          borderRadius: (hasSubSections && secExpanded) ? '10px 10px 0 0' : 10, overflow: 'hidden', marginTop: 2,
                          backgroundColor: V.white, transition: 'all 0.15s',
                        }}>
                          <button
                            onClick={() => bulkMoveQuestions(pIdx, sIdx)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                              padding: '10px 14px', border: 'none', background: 'transparent',
                              cursor: 'pointer', textAlign: 'left',
                            }}
                            onMouseEnter={e => { e.currentTarget.parentElement!.style.backgroundColor = V.lightPurpleBg; }}
                            onMouseLeave={e => { e.currentTarget.parentElement!.style.backgroundColor = V.white; }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: V.lightPurpleBg, flexShrink: 0 }}>
                              <FileText size={15} color={V.purple} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {section.title || 'Untitled Section'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: V.label }}>
                                {section.questions.length} question{section.questions.length !== 1 ? 's' : ''}
                                {hasSubSections && `, ${section.subSections!.length} sub-categor${section.subSections!.length !== 1 ? 'ies' : 'y'}`}
                              </div>
                            </div>
                            <ArrowRightLeft size={14} color={V.label} />
                          </button>
                          {hasSubSections && (
                            <button onClick={() => toggleExp(secKey)} style={{
                              background: 'none', border: 'none', borderLeft: `1px solid ${V.border}`,
                              padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                              color: V.purple, transition: 'background 0.15s',
                            }}
                              title={secExpanded ? 'Hide sub-categories' : 'Show sub-categories'}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = V.lightPurpleBg; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              <span style={{ transition: 'transform 0.2s', transform: secExpanded ? 'rotate(90deg)' : 'rotate(0)', fontSize: '0.7rem' }}>▶</span>
                            </button>
                          )}
                        </div>
                        {hasSubSections && secExpanded && (section.subSections || []).map((ss, subIdx) => (
                          <button
                            key={ss.id}
                            onClick={() => bulkMoveQuestions(pIdx, sIdx, subIdx)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                              padding: '8px 14px 8px 32px', borderRadius: 0, border: `1px solid #ede9fe`,
                              borderTop: 'none',
                              backgroundColor: '#faf5ff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ede9fe'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#faf5ff'; }}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ede9fe', flexShrink: 0 }}>
                              <ChevronRight size={12} color="#7c3aed" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ss.title || 'Untitled Sub-Category'}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: V.label }}>{ss.questions.length} question{ss.questions.length !== 1 ? 's' : ''}</div>
                            </div>
                            <ArrowRightLeft size={12} color={V.label} />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
              })}
            </div>
          </div>
        </div>
      );
      })()}

      {deleteQuestionConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteQuestionConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
          }}>
            <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Delete Question</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.55 }}>
                  Are you sure you want to permanently delete this question? This cannot be undone.
                </p>
                {deleteQuestionConfirm.questionText && (
                  <div style={{ margin: '10px 0 0', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                      &ldquo;{deleteQuestionConfirm.questionText.length > 120 ? deleteQuestionConfirm.questionText.slice(0, 120) + '…' : deleteQuestionConfirm.questionText}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '18px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteQuestionConfirm(null)} style={{
                padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff',
                fontSize: '0.82rem', fontWeight: 600, color: '#475569', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={confirmDeleteQuestion} style={{
                padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ef4444',
                fontSize: '0.82rem', fontWeight: 700, color: '#fff', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
              }}>Delete Question</button>
            </div>
          </div>
        </div>
      )}

      {moveSubSectionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMoveSubSectionModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: V.white, borderRadius: 16, width: '90%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Move Sub-Section</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: V.label, lineHeight: 1.4 }}>
                  &ldquo;{moveSubSectionModal.title.length > 50 ? moveSubSectionModal.title.slice(0, 50) + '…' : moveSubSectionModal.title}&rdquo;
                </p>
              </div>
              <button onClick={() => setMoveSubSectionModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <p style={{ fontSize: '0.78rem', color: V.label, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select destination section
              </p>
              {workingDoc.pages.map((page, pIdx) => (
                <div key={page.id} style={{ marginBottom: 12 }}>
                  {workingDoc.pages.length > 1 && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: V.purple, marginBottom: 6, padding: '4px 0' }}>
                      {page.title || `Page ${pIdx + 1}`}
                    </div>
                  )}
                  {page.sections.map((section, sIdx) => {
                    const isCurrent = pIdx === moveSubSectionModal.pIdx && sIdx === moveSubSectionModal.sIdx;
                    return (
                      <button
                        key={section.id}
                        disabled={isCurrent}
                        onClick={() => moveSubSection(moveSubSectionModal.pIdx, moveSubSectionModal.sIdx, moveSubSectionModal.subIdx, pIdx, sIdx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 4,
                          padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${isCurrent ? '#e2e8f0' : V.border}`,
                          backgroundColor: isCurrent ? '#f8fafc' : V.white, cursor: isCurrent ? 'not-allowed' : 'pointer',
                          textAlign: 'left', transition: 'all 0.15s', opacity: isCurrent ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = V.lightPurpleBg; e.currentTarget.style.borderColor = V.purple; } }}
                        onMouseLeave={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.borderColor = V.border; } }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isCurrent ? '#e2e8f0' : V.lightPurpleBg, flexShrink: 0,
                        }}>
                          <FileText size={15} color={isCurrent ? V.label : V.purple} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: isCurrent ? V.label : V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {section.title || 'Untitled Section'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: V.label }}>
                            {(section.subSections || []).length} sub-section{(section.subSections || []).length !== 1 ? 's' : ''}
                            {isCurrent && <span style={{ marginLeft: 6, color: '#6366f1', fontWeight: 600 }}>(current)</span>}
                          </div>
                        </div>
                        {!isCurrent && <ArrowRightLeft size={14} color={V.label} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {moveSectionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMoveSectionModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: V.white, borderRadius: 16, width: '90%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Move Section to Another Page</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: V.label, lineHeight: 1.4 }}>
                  &ldquo;{moveSectionModal.title.length > 50 ? moveSectionModal.title.slice(0, 50) + '…' : moveSectionModal.title}&rdquo;
                </p>
              </div>
              <button onClick={() => setMoveSectionModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <p style={{ fontSize: '0.78rem', color: V.label, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select destination page
              </p>
              {workingDoc.pages.map((page, pIdx) => {
                const isCurrent = pIdx === moveSectionModal.pIdx;
                return (
                  <button
                    key={page.id}
                    disabled={isCurrent}
                    onClick={() => moveSectionToPage(moveSectionModal.pIdx, moveSectionModal.sIdx, pIdx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 6,
                      padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${isCurrent ? '#e2e8f0' : V.border}`,
                      backgroundColor: isCurrent ? '#f8fafc' : V.white, cursor: isCurrent ? 'not-allowed' : 'pointer',
                      textAlign: 'left', transition: 'all 0.15s', opacity: isCurrent ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = V.lightPurpleBg; e.currentTarget.style.borderColor = V.purple; } }}
                    onMouseLeave={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = V.white; e.currentTarget.style.borderColor = V.border; } }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isCurrent ? '#e2e8f0' : V.lightPurpleBg, flexShrink: 0,
                    }}>
                      <Layers size={17} color={isCurrent ? V.label : V.purple} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: isCurrent ? V.label : V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {page.title || `Page ${pIdx + 1}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: V.label }}>
                        {page.sections.length} section{page.sections.length !== 1 ? 's' : ''}
                        {isCurrent && <span style={{ marginLeft: 6, color: '#6366f1', fontWeight: 600 }}>(current page)</span>}
                      </div>
                    </div>
                    {!isCurrent && <ArrowRightLeft size={14} color={V.label} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {movePageModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setMovePageModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            backgroundColor: V.white, borderRadius: 16, width: '90%', maxWidth: 480,
            maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${V.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: V.text }}>Reorder Page Position</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: V.label, lineHeight: 1.4 }}>
                  Move &ldquo;{movePageModal.title.length > 40 ? movePageModal.title.slice(0, 40) + '…' : movePageModal.title}&rdquo; to a new position
                </p>
              </div>
              <button onClick={() => setMovePageModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.label, padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <p style={{ fontSize: '0.78rem', color: V.label, fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select new position
              </p>
              {workingDoc.pages.map((page, pIdx) => {
                const isCurrent = pIdx === movePageModal.pIdx;
                return (
                  <button
                    key={page.id}
                    disabled={isCurrent}
                    onClick={() => movePageToPosition(movePageModal.pIdx, pIdx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', marginBottom: 6,
                      padding: '12px 16px', borderRadius: 10, border: `1.5px solid ${isCurrent ? '#6366f1' : V.border}`,
                      backgroundColor: isCurrent ? '#eef2ff' : V.white, cursor: isCurrent ? 'default' : 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = V.lightPurpleBg; e.currentTarget.style.borderColor = V.purple; } }}
                    onMouseLeave={e => { if (!isCurrent) { e.currentTarget.style.backgroundColor = isCurrent ? '#eef2ff' : V.white; e.currentTarget.style.borderColor = isCurrent ? '#6366f1' : V.border; } }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isCurrent ? '#c7d2fe' : V.lightPurpleBg, flexShrink: 0,
                      fontWeight: 700, fontSize: '0.9rem', color: isCurrent ? '#4338ca' : V.purple,
                    }}>
                      {pIdx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600, color: isCurrent ? '#4338ca' : V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {page.title || `Page ${pIdx + 1}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: V.label }}>
                        {page.sections.length} section{page.sections.length !== 1 ? 's' : ''}
                        {isCurrent && <span style={{ marginLeft: 6, color: '#4338ca', fontWeight: 600 }}>(current position)</span>}
                      </div>
                    </div>
                    {!isCurrent && <span style={{ fontSize: '0.75rem', color: V.label, fontWeight: 500 }}>
                      Move {movePageModal.pIdx < pIdx ? 'after' : 'before'}
                    </span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {mcEditor && (
        <MCEditorModal
          responses={mcEditor.responses}
          onSave={(resps) => handleResponseSelect(mcEditor.pIdx, mcEditor.sIdx, mcEditor.qIdx, 'multiple', resps, true, mcEditor.editingSetId)}
          onClose={() => setMcEditor(null)}
        />
      )}

      {evidencePanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1140, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setEvidencePanel(null)}>
          <div onClick={e => e.stopPropagation()}>
            <RequireEvidencePanel
              answer={evidencePanel.answer}
              onSave={(notes, media) => { setEvidencePanel(null); triggerAutosave(); }}
              onClose={() => setEvidencePanel(null)}
            />
          </div>
        </div>
      )}

      {notifyPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1140, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setNotifyPanel(null)}>
          <div onClick={e => e.stopPropagation()}>
            <NotifyPanel
              answer={notifyPanel.answer}
              onSave={(data) => { setNotifyPanel(null); triggerAutosave(); }}
              onClose={() => setNotifyPanel(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const TriggerMenu = ({ onSelect }: {
  onSelect: (actionType: LogicTrigger['actionType'], label: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const triggers = [
    { action: 'require-action' as const, label: 'Require action', icon: <ClipboardCheck size={14} /> },
    { action: 'require-evidence' as const, label: 'Require evidence', icon: <FileText size={14} /> },
    { action: 'notify' as const, label: 'Notify', icon: <Bell size={14} /> },
    { action: 'ask-questions' as const, label: 'Ask questions', icon: <MessageSquare size={14} /> },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: 'none', color: V.purple, fontWeight: 500, cursor: 'pointer', padding: 5, fontSize: '0.9rem' }}>
        + trigger
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 1050,
          backgroundColor: V.white, border: `1px solid ${V.border}`, borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden', minWidth: 200,
        }}>
          {triggers.map(t => (
            <button key={t.action} onClick={(e) => { e.stopPropagation(); onSelect(t.action, t.label); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '8px 15px', fontSize: '0.9rem', color: V.text,
                backgroundColor: 'transparent', border: 'none', textAlign: 'left',
                cursor: 'pointer', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = V.containerBg)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {historyMappingModal && (() => {
        const currentQuestions: { id: string; text: string; page: string; section: string }[] = [];
        workingDoc.pages.forEach(page => {
          page.sections.forEach(section => {
            section.questions.forEach(q => {
              if (q.text.trim()) currentQuestions.push({ id: q.id, text: q.text, page: page.title || '', section: section.title || '' });
            });
            (section.subSections || []).forEach(ss => {
              ss.questions.forEach(q => {
                if (q.text.trim()) currentQuestions.push({ id: q.id, text: q.text, page: page.title || '', section: `${section.title || ''} > ${ss.title || ''}` });
              });
            });
          });
        });
        const existingAliases = workingDoc.questionIdAliases || {};
        const reverseMap: Record<string, string> = {};
        Object.entries(existingAliases).forEach(([targetId, oldIds]) => {
          oldIds.forEach(oldId => { reverseMap[oldId] = targetId; });
        });
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: 'white', borderRadius: 16, width: '90%', maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>Map Question History</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>Assign deleted questions' audit history to current questions</p>
                </div>
                <button onClick={() => setHistoryMappingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8' }}><X size={20} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {deletedQuestions.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>No deleted questions to map.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {deletedQuestions.map((dq, idx) => (
                      <div key={dq.id + idx} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, backgroundColor: historyMappings[dq.id] ? '#f0fdf4' : '#fefce8' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>Deleted</span>
                              {dq.page && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{dq.page}</span>}
                              {dq.section && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{' > '}{dq.section}</span>}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{dq.text}</p>
                          </div>
                          <button onClick={() => {
                            setDeletedQuestions(prev => prev.filter((_, i) => i !== idx));
                            setHistoryMappings(prev => { const next = { ...prev }; delete next[dq.id]; return next; });
                          }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8', flexShrink: 0 }} title="Remove from list"><Trash2 size={14} /></button>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }}>Transfer history to:</label>
                          <select
                            value={historyMappings[dq.id] || reverseMap[dq.id] || ''}
                            onChange={e => setHistoryMappings(prev => ({ ...prev, [dq.id]: e.target.value }))}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', color: '#334155', backgroundColor: 'white' }}
                          >
                            <option value="">-- Do not transfer --</option>
                            {currentQuestions.map(cq => (
                              <option key={cq.id} value={cq.id}>
                                [{cq.page}{cq.section ? ` > ${cq.section}` : ''}] {cq.text.slice(0, 80)}{cq.text.length > 80 ? '...' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => { setDeletedQuestions([]); setHistoryMappings({}); setHistoryMappingModal(false); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                  Dismiss All
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setHistoryMappingModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={() => {
                    const newAliases: Record<string, string[]> = {};
                    Object.entries(workingDoc.questionIdAliases || {}).forEach(([k, v]) => {
                      newAliases[k] = [...v];
                    });
                    const newTextAliases: Record<string, string[]> = {};
                    Object.entries(workingDoc.questionTextAliases || {}).forEach(([k, v]) => {
                      newTextAliases[k] = [...(v as string[])];
                    });
                    const allCurrentQs = workingDoc.pages.flatMap(p =>
                      p.sections.flatMap(s => [
                        ...(s.questions || []),
                        ...(s.subSections || []).flatMap(ss => ss.questions || []),
                      ])
                    );
                    Object.entries(historyMappings).forEach(([deletedId, targetId]) => {
                      Object.keys(newAliases).forEach(key => {
                        newAliases[key] = newAliases[key].filter(id => id !== deletedId);
                        if (newAliases[key].length === 0) delete newAliases[key];
                      });
                      if (!targetId) return;
                      if (!newAliases[targetId]) newAliases[targetId] = [];
                      if (!newAliases[targetId].includes(deletedId)) newAliases[targetId].push(deletedId);
                      const deletedQ = deletedQuestions.find(dq => dq.id === deletedId);
                      const targetQ = allCurrentQs.find(q => q.id === targetId);
                      if (deletedQ?.text && targetQ?.text && deletedQ.text !== targetQ.text) {
                        const newText = targetQ.text;
                        const oldText = deletedQ.text;
                        if (!newTextAliases[newText]) newTextAliases[newText] = [];
                        if (!newTextAliases[newText].includes(oldText)) newTextAliases[newText].push(oldText);
                        Object.keys(newTextAliases).forEach(key => {
                          if (key !== newText) {
                            newTextAliases[key] = newTextAliases[key].filter(t => t !== oldText);
                            if (newTextAliases[key].length === 0) delete newTextAliases[key];
                          }
                        });
                      }
                    });
                    const processedIds = new Set(Object.keys(historyMappings));
                    setWorkingDoc(prev => ({
                      ...prev,
                      questionIdAliases: Object.keys(newAliases).length > 0 ? newAliases : undefined,
                      questionTextAliases: Object.keys(newTextAliases).length > 0 ? newTextAliases : undefined,
                    }));
                    setDeletedQuestions(prev => prev.filter(dq => !processedIds.has(dq.id)));
                    setHistoryMappings({});
                    setHistoryMappingModal(false);
                    triggerAutosave();
                  }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', backgroundColor: '#059669', color: 'white', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <Check size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Apply Mappings
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AuditChecklistCreator;
