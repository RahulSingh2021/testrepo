"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, ChevronUp, Info, MessageSquare,
  Play, Pause, CheckCircle, MapPin, Clock, X, ArrowRight, ArrowLeft, BookOpen,
  Building2, User, Mail, Phone, CalendarDays, Target, Timer, AlertTriangle, Camera,
  ImageIcon, Upload, Trash2, Send, Plus, Image as ImageLucide, Eye, Edit3,
  Pencil, RotateCcw, Layers, ShieldCheck, History, XCircle, CheckCircle2, Lock, Unlock, HardDrive,
  Check, MessageCircle, Images, ChevronLeft, FileDown, Eraser, PenTool, Save, Repeat2,
  Loader2, Maximize2, FileSpreadsheet, Search, ArrowRightLeft, WifiOff, CloudOff, Users, UploadCloud,
  Settings, Hash, Tag, FileText, ClipboardList, SlidersHorizontal, RefreshCw, CheckSquare, Square,
  FileCheck
} from 'lucide-react';
import type { ChecklistTemplate, PageNode, SectionNode, QuestionNode, ResponseOption } from './AuditChecklistCreator';
import { compressImage, compressSignature } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { PhotoEditor, CollageStudio, type AuditQuestionOption as AddObsQuestionOption } from './ComplaintFormModal';
import AddObservationModal, { type ObservationPayload, type DraftObservationPayload } from './AddObservationModal';
import ExcelJS from 'exceljs';
import { ChecklistObservationView, type ObservationItem as RegistryObsItem } from './ObservationRegistry';
import InlineRewriteButton from './InlineRewriteButton';
import ExcelAuditImporter from './ExcelAuditImporter';
import { handlePasteImages } from '@/utils/clipboardImages';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false });

const stripHtmlToText = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

interface UnitDetailsForm {
  companyName: string; repName: string; address: string; contact: string; email: string;
  manday: string; scope: string; dateFrom: string; dateTo: string; geotag: string; startTime: string;
}

interface AnswerState {
  [questionId: string]: { selectedIndex: number | null; marks: number | null; };
}

interface CorrectionLog {
  id: string;
  correctedAt: string;
  correctedBy: string;
  reason: string;
  explanation: string;
  originalText: string;
  originalImages: string[];
  supervisorAuthorized: boolean;
}

const CORRECTION_TIME_WINDOW_MS = 30 * 60 * 1000;
const MAX_CORRECTIONS = 2;

interface CommentEntry {
  id: string;
  text: string;
  images: string[];
  closureEvidence: string[];
  closureComments: string;
  timestamp: string;
  createdAtMs?: number;
  corrections?: CorrectionLog[];
  location?: string;
  isDraft?: boolean;
  savedToDb?: boolean;
  reassignedFrom?: string;
  reassignNote?: string;
  isReassignNote?: boolean;
  isRepeat?: boolean;
  repeatOriginalDate?: string;
  repeatTrail?: { date: string; comment: string }[];
  repeatSourceId?: string;
  managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing';
  resourceRequired?: boolean;
  selectedResponseIndex?: number | null;
}

interface QuestionComment {
  entries: CommentEntry[];
}

interface CommentState { [questionId: string]: QuestionComment; }
interface CollapsedState { [id: string]: boolean; }
interface ApplicabilityState { [id: string]: boolean; }

function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  seconds = seconds % 60; minutes = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getRiskLabel(risk: string): { label: string; color: string; bg: string } {
  if (risk === 'High') return { label: 'HIGH', color: '#dc2626', bg: '#fef2f2' };
  if (risk === 'Medium' || risk === 'Med') return { label: 'MED', color: '#d97706', bg: '#fffbeb' };
  if (risk === 'Low') return { label: 'LOW', color: '#16a34a', bg: '#f0fdf4' };
  return { label: '', color: '', bg: '' };
}

function getRiskBorderColor(risk: string): string {
  if (risk === 'High') return '#ef4444';
  if (risk === 'Medium' || risk === 'Med') return '#f59e0b';
  if (risk === 'Low') return '#22c55e';
  return 'transparent';
}

function determineSectionRisk(questions: QuestionNode[]): string {
  const risks = questions.map(q => q.risk).filter(Boolean);
  if (risks.length === 0) return '';
  const unique = [...new Set(risks)];
  if (unique.length === 1) return unique[0];
  return 'mixed';
}

function getSectionRiskBorderColor(risk: string): string {
  if (risk === 'High') return '#ef4444';
  if (risk === 'Medium' || risk === 'Med') return '#f59e0b';
  if (risk === 'Low') return '#22c55e';
  if (risk === 'mixed') return '#8b5cf6';
  return 'transparent';
}

interface ScoreInfo { obtained: number; max: number; unanswered: number; }

interface AuditHistoryRecord {
  auditId: string;
  date: string;
  answer: string;
  score: number;
  maxScore: number;
  status: 'compliant' | 'non-compliant' | 'partial' | 'na';
  closureStatus?: 'Open' | 'Closed';
  auditor: string;
  image?: string;
  comments: { text: string; author: string; timestamp: string; images: string[] }[];
  images: string[];
}

const statusConfig = {
  compliant: { label: 'PASS', bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-white', icon: CheckCircle2 },
  'non-compliant': { label: 'FAIL', bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-white', icon: XCircle },
  partial: { label: 'PART', bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-white', icon: AlertTriangle },
  na: { label: 'N/A', bg: 'bg-gray-400', ring: 'ring-gray-200', text: 'text-white', icon: Info },
};

const ComplianceHistoryStrip = ({ questionId, history: historyProp }: { questionId: string; history: AuditHistoryRecord[] }) => {
  const [localComments, setLocalComments] = useState<Record<number, { text: string; author: string; timestamp: string; images: string[] }[]>>({});
  const history = useMemo(() => historyProp.map((rec, idx) => ({
    ...rec,
    comments: [...rec.comments, ...(localComments[idx] || [])],
  })), [historyProp, localComments]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [addingCommentIdx, setAddingCommentIdx] = useState<number | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentImages, setNewCommentImages] = useState<string[]>([]);
  const [isHistoryDragging, setIsHistoryDragging] = useState(false);
  const historyDragCounter = useRef(0);
  const newCommentCameraRef = useRef<HTMLInputElement>(null);
  const newCommentGalleryRef = useRef<HTMLInputElement>(null);

  const handleNewCommentImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setNewCommentImages(prev => [...prev, compressed]);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setNewCommentImages(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, []);

  const handleHistoryDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    historyDragCounter.current = 0;
    setIsHistoryDragging(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    for (const file of Array.from(files).filter(f => f.type.startsWith('image/'))) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setNewCommentImages(prev => [...prev, compressed]);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setNewCommentImages(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const submitNewComment = (recIdx: number) => {
    if (!newCommentText.trim() && newCommentImages.length === 0) return;
    setLocalComments(prev => ({
      ...prev,
      [recIdx]: [...(prev[recIdx] || []), {
        text: newCommentText.trim(),
        author: 'You',
        timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        images: [...newCommentImages],
      }],
    }));
    setNewCommentText('');
    setNewCommentImages([]);
    setAddingCommentIdx(null);
  };

  const cancelNewComment = () => {
    setNewCommentText('');
    setNewCommentImages([]);
    setAddingCommentIdx(null);
  };

  if (history.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-2">
        <History size={12} className="text-indigo-500" />
        <span className="text-[9px] sm:text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Last {history.length} Audit{history.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-1.5 sm:gap-2 flex-wrap">
        {history.map((rec, idx) => {
          const cfg = statusConfig[rec.status];
          const IconComp = cfg.icon;
          const isExpanded = expandedIdx === idx;
          const allImgSet = new Set(rec.images);
          rec.comments.forEach(c => c.images.forEach(ci => allImgSet.add(ci)));
          const totalImages = allImgSet.size;
          const statusColor = rec.status === 'compliant' ? 'text-emerald-600' : rec.status === 'non-compliant' ? 'text-red-600' : rec.status === 'partial' ? 'text-amber-600' : 'text-gray-500';
          return (
            <div key={rec.auditId} className="flex-shrink-0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedIdx(isExpanded ? null : idx); }}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all relative cursor-pointer ${isExpanded ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 shadow-sm'}`}
              >
                {rec.images.length > 0 ? (
                  <>
                    <img src={rec.images[0]} alt={`Audit ${rec.date}`} className="w-full h-full object-cover" />
                    <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-0.5`}>
                      <span className={`text-[6px] sm:text-[7px] font-black uppercase px-1 py-px ${cfg.bg} ${cfg.text} rounded-b-md shadow-sm`}>{cfg.label}</span>
                      {rec.closureStatus && (
                        <span className={`text-[5px] sm:text-[6px] font-black uppercase px-1 py-px rounded-b-md shadow-sm ${rec.closureStatus === 'Closed' ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'}`}>{rec.closureStatus === 'Closed' ? 'Closed' : 'Open'}</span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between">
                      {totalImages > 1 ? (
                        <div className="bg-black/70 text-white text-[6px] font-bold px-1 py-px rounded-tr-md flex items-center gap-0.5">
                          <Images size={6} />{totalImages}
                        </div>
                      ) : <div />}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setLightboxImg(rec.images[0]); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setLightboxImg(rec.images[0]); } }}
                        className="bg-black/60 hover:bg-black/80 text-white p-0.5 rounded-tl-md transition-colors cursor-pointer"
                        title="Enlarge image"
                      >
                        <Maximize2 size={7} />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-0.5 ${rec.status === 'compliant' ? 'bg-emerald-50' : rec.status === 'non-compliant' ? 'bg-red-50' : rec.status === 'partial' ? 'bg-amber-50' : 'bg-gray-50'}`}>
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 ${cfg.bg} rounded-full flex items-center justify-center`}>
                      <IconComp size={11} className={cfg.text} />
                    </div>
                    <span className={`text-[6px] sm:text-[7px] font-black uppercase ${statusColor}`}>{cfg.label}</span>
                    {rec.closureStatus && (
                      <span className={`text-[5px] sm:text-[6px] font-black uppercase px-1 py-px rounded-full ${rec.closureStatus === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>{rec.closureStatus === 'Closed' ? 'Closed' : 'Open'}</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[6px] sm:text-[7px] font-semibold text-gray-400 text-center mt-0.5 truncate w-14 sm:w-16">{rec.date}</p>
            </div>
          );
        })}
      </div>

      {expandedIdx !== null && (() => {
        const rec = history[expandedIdx];
        const cfg = statusConfig[rec.status];
        return (
          <div className="mt-1.5 bg-indigo-50/80 border border-indigo-200 rounded-xl p-2 sm:p-3 text-left space-y-2">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                <span className="text-[9px] font-semibold text-gray-500">{rec.score}/{rec.maxScore}</span>
                <span className="text-[8px] text-gray-400">{rec.auditor}</span>
              </div>
              <span className="text-[7px] text-gray-400 truncate max-w-[140px]">{rec.auditId}</span>
            </div>

            {rec.comments.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {rec.comments.map((comment, cIdx) => {
                  const obsImages = comment.images || [];
                  const closed = rec.closureStatus === 'Closed';
                  return (
                    <div key={cIdx} className={`rounded-xl border shadow-sm ${closed ? 'border-emerald-200' : 'border-violet-200'}`}>
                      <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-t-xl gap-1 flex-wrap ${closed ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-violet-50 to-purple-50'}`}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold flex-shrink-0 ${closed ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white'}`}>{cIdx + 1}</div>
                          <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${closed ? 'text-emerald-700' : 'text-violet-700'}`}>
                            Obs {rec.comments.length > 1 ? `#${cIdx + 1}` : ''}
                          </span>
                          {closed && (
                            <span className="text-[7px] font-bold bg-emerald-500 text-white px-1 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                              <Lock size={6} /> CLOSED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[6px] sm:text-[7px] text-gray-400 flex items-center gap-0.5">
                            <CalendarDays size={8} className="text-amber-400" />
                            {comment.timestamp}
                          </span>
                        </div>
                      </div>

                      <div className="flex min-h-0">
                        <div className="flex-1 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 border-r border-gray-100">
                          <div className="flex items-center gap-1 mb-1">
                            <div className="w-0.5 h-2.5 rounded-full bg-violet-400" />
                            <span className="text-[7px] sm:text-[8px] font-bold text-violet-500 uppercase tracking-wider">Observation</span>
                          </div>
                          {comment.text && <p className="text-[9px] sm:text-[10px] text-gray-700 leading-relaxed mb-1 line-clamp-3">{comment.text}</p>}
                          {obsImages.length > 0 && (
                            <div className="flex gap-0.5 flex-wrap">
                              {obsImages.map((img, imgIdx) => (
                                <button key={imgIdx} onClick={() => setLightboxImg(img)} className="w-7 h-7 sm:w-9 sm:h-9 rounded-md overflow-hidden border border-gray-200 hover:border-violet-400 transition-all flex-shrink-0 hover:shadow-md">
                                  <img src={img} alt={`Evidence ${imgIdx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                          {!comment.text && obsImages.length === 0 && (
                            <p className="text-[8px] text-gray-300 italic">No observation</p>
                          )}
                        </div>

                        <div className={`flex-1 px-2 sm:px-2.5 py-1.5 sm:py-2 ${closed ? 'bg-emerald-50/40' : 'bg-gray-50/50'}`}>
                          <div className="flex items-center gap-1 mb-1">
                            <div className={`w-0.5 h-2.5 rounded-full ${closed ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider ${closed ? 'text-emerald-600' : 'text-gray-400'}`}>Closure</span>
                          </div>
                          {closed ? (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                              <CheckCircle size={8} />Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                              <ShieldCheck size={9} /> Open
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {rec.comments.length === 0 && rec.images.length > 0 && (
              <div className="rounded-xl border shadow-sm border-violet-200">
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-t-xl gap-1 flex-wrap bg-gradient-to-r from-violet-50 to-purple-50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-violet-500 text-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold flex-shrink-0">1</div>
                    <span className="text-[8px] sm:text-[9px] font-bold text-violet-700 uppercase tracking-wider">Obs</span>
                  </div>
                  <span className="text-[6px] sm:text-[7px] text-gray-400 flex items-center gap-0.5">
                    <CalendarDays size={8} className="text-amber-400" />
                    {rec.date}
                  </span>
                </div>

                <div className="flex min-h-0">
                  <div className="flex-1 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 border-r border-gray-100">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-0.5 h-2.5 rounded-full bg-violet-400" />
                      <span className="text-[7px] sm:text-[8px] font-bold text-violet-500 uppercase tracking-wider">Observation</span>
                    </div>
                    <div className="flex gap-0.5 flex-wrap">
                      {rec.images.map((img, imgIdx) => (
                        <button key={imgIdx} onClick={() => setLightboxImg(img)} className="w-7 h-7 sm:w-9 sm:h-9 rounded-md overflow-hidden border border-gray-200 hover:border-violet-400 transition-all flex-shrink-0 hover:shadow-md">
                          <img src={img} alt={`Evidence ${imgIdx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 px-2 sm:px-2.5 py-1.5 sm:py-2 bg-gray-50/50">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-0.5 h-2.5 rounded-full bg-gray-300" />
                      <span className="text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-wider">Closure</span>
                    </div>
                    {rec.closureStatus === 'Closed' ? (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        <CheckCircle size={8} />Closed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                        <ShieldCheck size={9} /> Open
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {addingCommentIdx === expandedIdx ? (
              <div
                className={`bg-white border rounded-xl p-2 sm:p-2.5 space-y-1.5 transition-all ${isHistoryDragging ? 'border-violet-400 ring-2 ring-violet-200 bg-violet-50/30' : 'border-violet-200'}`}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); historyDragCounter.current++; if (e.dataTransfer.types.includes('Files')) setIsHistoryDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); historyDragCounter.current = Math.max(0, historyDragCounter.current - 1); if (historyDragCounter.current === 0) setIsHistoryDragging(false); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={handleHistoryDrop}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Plus size={9} className="text-violet-500" />
                  <span className="text-[8px] font-bold text-violet-600 uppercase tracking-wider">New Comment</span>
                </div>
                {isHistoryDragging && (
                  <div className="flex items-center justify-center gap-1.5 py-3 bg-violet-50 border border-dashed border-violet-300 rounded-lg">
                    <Upload size={14} className="text-violet-500" />
                    <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wider">Drop images here</span>
                  </div>
                )}
                <textarea
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  onPaste={e => handlePasteImages(e, (img) => setNewCommentImages(prev => [...prev, img]))}
                  placeholder="Write your comment, paste or drop images..."
                  className="w-full min-h-[44px] p-2 bg-gray-50 border border-gray-200 rounded-lg text-[9px] sm:text-[10px] resize-none outline-none placeholder:text-gray-400 focus:border-violet-300 focus:ring-1 focus:ring-violet-200 transition-all"
                  rows={2}
                  autoFocus
                />
                {newCommentImages.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {newCommentImages.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-lg overflow-hidden border border-violet-200 group">
                        <img src={img} alt={`New ${imgIdx + 1}`} className="w-full h-full object-cover" />
                        <button onClick={() => setNewCommentImages(prev => prev.filter((_, i) => i !== imgIdx))} className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Trash2 size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button onClick={() => newCommentCameraRef.current?.click()} className="p-1.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg text-violet-600 transition-colors" title="Camera">
                      <Camera size={11} />
                    </button>
                    <button onClick={() => newCommentGalleryRef.current?.click()} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-600 transition-colors" title="Gallery">
                      <ImageLucide size={11} />
                    </button>
                    {newCommentImages.length > 0 && <span className="text-[7px] text-gray-400 font-medium self-center ml-1">{newCommentImages.length}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={cancelNewComment} className="px-2 py-1 text-[8px] font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => submitNewComment(expandedIdx)} disabled={!newCommentText.trim() && newCommentImages.length === 0}
                      className="px-2 py-1 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-[8px] font-bold rounded-lg transition-colors flex items-center gap-0.5">
                      <Send size={8} /> Post
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAddingCommentIdx(expandedIdx); setNewCommentText(''); setNewCommentImages([]); }}
                className="w-full py-1.5 border border-dashed border-indigo-200 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-1">
                <Plus size={10} />
                <span className="text-[8px] sm:text-[9px] font-semibold">Add Comment</span>
              </button>
            )}
          </div>
        );
      })()}

      <input ref={newCommentCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleNewCommentImageUpload} />
      <input ref={newCommentGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleNewCommentImageUpload} />

      {lightboxImg && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <div className="relative max-w-lg max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Evidence detail" className="w-full h-full object-contain rounded-xl shadow-2xl" />
            <button onClick={() => setLightboxImg(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <X size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const CORRECTION_REASONS = [
  'Wrong image uploaded',
  'Incorrect observation text',
  'Wrong question answered',
  'Duplicate entry',
  'Other',
];

const SupervisorPinDialog = ({
  entry,
  supervisorPin,
  onAuthorized,
  onClose,
}: {
  entry: CommentEntry;
  supervisorPin: string;
  onAuthorized: () => void;
  onClose: () => void;
}) => {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) { setLockedUntil(null); setAttempts(0); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const timeAgo = () => {
    if (!entry.createdAtMs) return 'some time ago';
    const diff = Date.now() - entry.createdAtMs;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  };

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingSeconds = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const remainingMins = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;

  const handleAttempt = () => {
    if (isLocked) return;
    if (pin === supervisorPin) {
      onAuthorized();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setErrorMsg('Too many attempts. Locked for 5 minutes.');
      } else {
        setErrorMsg(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining.`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Lock size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">Supervisor Authorization</h3>
            <p className="text-[10px] text-amber-100">Required to proceed</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[11px] text-amber-800 leading-relaxed">
              This entry was saved <strong>{timeAgo()}</strong>. The 30‑minute self‑correction window has passed. A supervisor must authorize this correction.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Supervisor PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && pin.length === 4 && !isLocked) handleAttempt(); }}
              disabled={isLocked}
              placeholder="••••"
              className="w-full text-center text-2xl font-bold tracking-[0.5em] py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-50"
            />
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-semibold">
                <AlertTriangle size={12} />
                {isLocked ? `Locked — ${remainingMins}:${remainingSecs.toString().padStart(2, '0')} remaining` : errorMsg}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleAttempt} disabled={pin.length !== 4 || isLocked}
            className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2">
            <ShieldCheck size={14} /> Authorize & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

const CorrectionModal = ({
  entry,
  supervisorAuthorized,
  onSave,
  onClose,
}: {
  entry: CommentEntry;
  supervisorAuthorized: boolean;
  onSave: (updatedEntry: CommentEntry) => void;
  onClose: () => void;
}) => {
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [newText, setNewText] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave = reason && explanation.trim().length >= 10 && (newText.trim() || newImages.length > 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    for (const file of Array.from(e.target.files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setNewImages(prev => [...prev, compressed]);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setNewImages(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSave = () => {
    const log: CorrectionLog = {
      id: `corr-${Date.now()}`,
      correctedAt: new Date().toISOString(),
      correctedBy: 'Current User',
      reason,
      explanation: explanation.trim(),
      originalText: entry.text,
      originalImages: [...entry.images],
      supervisorAuthorized,
    };
    onSave({ ...entry, text: newText.trim(), images: newImages, corrections: [...(entry.corrections || []), log] });
  };

  return (
    <div className="fixed inset-0 z-[10025] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
            <Pencil size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Correct Observation Entry</h3>
            <p className="text-[10px] text-amber-600 font-medium">Original content is preserved — nothing is deleted.</p>
          </div>
          {supervisorAuthorized && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full shrink-0">
              <ShieldCheck size={10} /> Supervisor authorized
            </div>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 ml-1 shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">You are replacing</p>
            {entry.text && <p className="text-[11px] text-gray-500 italic leading-relaxed">{entry.text}</p>}
            {entry.images.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {entry.images.map((img, i) => (
                  <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-300 flex-shrink-0">
                    <img src={img} alt={`Original ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-red-500/20" />
                    <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[7px] font-bold text-center py-0.5">ORIG</div>
                  </div>
                ))}
              </div>
            )}
            {!entry.text && entry.images.length === 0 && <p className="text-[10px] text-gray-400 italic">No content</p>}
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reason <span className="text-red-500">*</span></label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white transition-all">
                <option value="">Select reason…</option>
                {CORRECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Explanation <span className="text-red-500">*</span>
                <span className="text-gray-400 normal-case font-normal ml-1">(min. 10 characters)</span>
              </label>
              <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
                placeholder="Briefly describe why this correction is needed…"
                className="w-full min-h-[72px] px-3 py-2.5 border border-gray-200 rounded-xl text-xs resize-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-400"
                rows={3} />
              {explanation.length > 0 && explanation.length < 10 && (
                <p className="text-[10px] text-amber-600">{10 - explanation.length} more character{10 - explanation.length !== 1 ? 's' : ''} needed</p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Replacement content <span className="text-red-500">*</span></p>
            <textarea value={newText} onChange={e => setNewText(e.target.value)}
              onPaste={e => handlePasteImages(e, (img) => setNewImages(prev => [...prev, img]))}
              placeholder="Enter corrected observation text… (paste images here)"
              className="w-full min-h-[64px] px-3 py-2.5 border border-gray-200 rounded-xl text-xs resize-none outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all placeholder:text-gray-400"
              rows={3} />
            {newImages.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {newImages.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={img} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white">
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-[11px] font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg border border-violet-200 transition-all">
              <Camera size={13} /> Upload replacement image
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
            {!newText.trim() && newImages.length === 0 && (
              <p className="text-[10px] text-amber-600">At least replacement text or image required</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2">
            <RotateCcw size={13} /> Save Correction
          </button>
        </div>
      </div>
    </div>
  );
};


const CommentEntryCard = ({
  entry,
  index,
  onUpdate,
  onAppendImage,
  onDelete,
  onEditImage,
  onMakeCollage,
  locationOptions,
  lockedLocation,
  onLockLocation,
  onUnlockLocation,
}: {
  entry: CommentEntry;
  index: number;
  onUpdate: (updated: CommentEntry) => void;
  onAppendImage: (target: 'images' | 'closureEvidence', dataUrl: string) => void;
  onDelete: () => void;
  onEditImage: (img: string, cb: (edited: string) => void) => void;
  onMakeCollage: (imgs: string[], cb: (collageUrl: string, finalImgs: string[]) => void) => void;
  locationOptions?: string[];
  lockedLocation?: string | null;
  onLockLocation?: (loc: string) => void;
  onUnlockLocation?: () => void;
}) => {
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [locSearch, setLocSearch] = useState('');
  const [locDropOpen, setLocDropOpen] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const locDropRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const processFilesRef = useRef<(files: FileList | File[], target: 'images' | 'closureEvidence') => void>(() => {});

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) setShowMediaMenu(false);
      if (locDropRef.current && !locDropRef.current.contains(e.target as Node)) setLocDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFilesRef.current(e.dataTransfer.files, 'images');
  }, []);

  const processFiles = useCallback(async (files: FileList | File[], target: 'images' | 'closureEvidence') => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const compressed = await compressImage(e.target?.result as string);
          onAppendImage(target, compressed);
        } catch {
          const raw = e.target?.result as string;
          if (raw) onAppendImage(target, raw);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [onAppendImage]);

  processFilesRef.current = processFiles;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'images' | 'closureEvidence') => {
    if (e.target.files?.length) processFiles(e.target.files, target);
    e.target.value = '';
    setShowMediaMenu(false);
  };

  const removeImage = (idx: number, target: 'images' | 'closureEvidence') => {
    if (target === 'images') onUpdate({ ...entry, images: entry.images.filter((_, i) => i !== idx) });
    else onUpdate({ ...entry, closureEvidence: entry.closureEvidence.filter((_, i) => i !== idx) });
  };

  const MediaMenuPopup = ({ show, target, camRef, galRef }: { show: boolean; target: 'images' | 'closureEvidence'; camRef: React.RefObject<HTMLInputElement | null>; galRef: React.RefObject<HTMLInputElement | null> }) => {
    if (!show) return null;
    const imgs = target === 'images' ? entry.images : entry.closureEvidence;
    return (
      <div className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-52 z-[100]">
        <button onClick={() => { camRef.current?.click(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
          <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center"><Camera size={16} className="text-violet-600" /></div>
          <div><p className="text-xs font-semibold text-gray-800">Camera</p><p className="text-[10px] text-gray-400">Take a photo</p></div>
        </button>
        <button onClick={() => { galRef.current?.click(); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-50">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"><ImageLucide size={16} className="text-emerald-600" /></div>
          <div><p className="text-xs font-semibold text-gray-800">Gallery</p><p className="text-[10px] text-gray-400">Choose from files</p></div>
        </button>
        {imgs.length >= 2 && (
          <button onClick={() => {
            onMakeCollage(imgs, (collageUrl) => {
              if (target === 'images') onUpdate({ ...entry, images: [collageUrl] });
              else onUpdate({ ...entry, closureEvidence: [collageUrl] });
            });
            setShowMediaMenu(false);
          }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-50">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Layers size={16} className="text-amber-600" /></div>
            <div><p className="text-xs font-semibold text-gray-800">Collage</p><p className="text-[10px] text-gray-400">Combine photos</p></div>
          </button>
        )}
      </div>
    );
  };

  const ImageGrid = ({ imgs, target }: { imgs: string[]; target: 'images' | 'closureEvidence' }) => {
    if (imgs.length === 0) return null;
    return (
      <div className={`grid gap-2 ${imgs.length === 1 ? 'grid-cols-1' : imgs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {imgs.map((img, idx) => (
          <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square">
            <img src={img} alt={`${target} ${idx + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
              <button onClick={() => onEditImage(img, (edited) => {
                const newImgs = [...imgs];
                newImgs[idx] = edited;
                if (target === 'images') onUpdate({ ...entry, images: newImgs });
                else onUpdate({ ...entry, closureEvidence: newImgs });
              })} className="p-1.5 bg-white rounded-lg shadow-md text-violet-600 hover:bg-violet-50">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeImage(idx, target)} className="p-1.5 bg-white rounded-lg shadow-md text-red-500 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">{idx + 1}/{imgs.length}</div>
          </div>
        ))}
      </div>
    );
  };

  if (entry.isReassignNote) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center"><ArrowRightLeft size={10} /></div>
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Reassigned</span>
            <span className="text-[9px] text-amber-400">{entry.timestamp}</span>
          </div>
          <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-amber-700 leading-snug italic">{entry.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">{index + 1}</div>
          <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Comment</span>
          <span className="text-[9px] text-gray-400">{entry.timestamp}</span>
        </div>
        <button onClick={onDelete} className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {entry.reassignNote && (
        <div className="mx-4 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-[9px] text-amber-600 font-medium flex items-center gap-1"><ArrowRightLeft size={9} /> {entry.reassignNote}</p>
        </div>
      )}

      <div className="p-4 space-y-3">
        {locationOptions && locationOptions.length > 0 && (
          <div className="relative" ref={locDropRef}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { if (!lockedLocation) { setLocDropOpen(!locDropOpen); setLocSearch(''); } }}
                className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${lockedLocation ? 'bg-indigo-50 border-indigo-300 text-indigo-700 cursor-default' : entry.location ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-indigo-300'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={13} className={entry.location ? 'text-indigo-500' : 'text-gray-400'} />
                  <span className="truncate font-medium">{entry.location || 'Select Location'}</span>
                </div>
                {!lockedLocation && <ChevronDown size={13} className={`transition-transform ${locDropOpen ? 'rotate-180' : ''}`} />}
              </button>
              {entry.location && !lockedLocation && onLockLocation && (
                <button
                  type="button"
                  onClick={() => onLockLocation(entry.location!)}
                  className="p-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  title="Lock location for all comments"
                >
                  <Unlock size={14} />
                </button>
              )}
              {lockedLocation && onUnlockLocation && (
                <button
                  type="button"
                  onClick={() => { onUnlockLocation(); onUpdate({ ...entry, location: undefined }); }}
                  className="p-2 rounded-xl border border-indigo-300 bg-indigo-100 text-indigo-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all"
                  title="Unlock location"
                >
                  <Lock size={14} />
                </button>
              )}
            </div>
            {locDropOpen && !lockedLocation && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-[110] max-h-48 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <Search size={12} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={locSearch}
                      onChange={e => setLocSearch(e.target.value)}
                      placeholder="Search locations..."
                      className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-36">
                  {entry.location && (
                    <button
                      type="button"
                      onClick={() => { onUpdate({ ...entry, location: undefined }); setLocDropOpen(false); }}
                      className="w-full text-left px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 flex items-center gap-2 border-b border-gray-50"
                    >
                      <X size={11} /> Clear Location
                    </button>
                  )}
                  {locationOptions
                    .filter(l => l.toLowerCase().includes(locSearch.toLowerCase()))
                    .map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => { onUpdate({ ...entry, location: loc }); setLocDropOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50 transition-colors ${entry.location === loc ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}
                      >
                        {loc}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div
          className={`relative bg-gray-50 border rounded-xl transition-all ${isDragging ? 'border-violet-400 bg-violet-50/50 ring-2 ring-violet-200' : 'border-gray-100'}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-violet-50/80 backdrop-blur-[2px] rounded-xl pointer-events-none">
              <Upload size={28} className="text-violet-500 mb-1.5" />
              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Drop images here</span>
            </div>
          )}
          <textarea
            value={entry.text}
            onChange={e => onUpdate({ ...entry, text: e.target.value })}
            onPaste={e => handlePasteImages(e, (img) => onAppendImage('images', img))}
            placeholder="Type your comment or observation... (paste, drag & drop images here)"
            className="w-full min-h-[80px] p-3 bg-transparent text-sm resize-none outline-none placeholder:text-gray-400"
            rows={3}
          />
          {entry.images.length > 0 && (
            <div className="px-3 pb-3 space-y-2">
              <ImageGrid imgs={entry.images} target="images" />
              {entry.images.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    onMakeCollage(entry.images, (collageUrl) => {
                      onUpdate({ ...entry, images: [collageUrl] });
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-100 transition-all w-fit shadow-sm"
                >
                  <Layers size={13} />
                  Create Collage ({entry.images.length} photos)
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-white/60 relative">
            <div className="flex items-center gap-2">
              <InlineRewriteButton text={entry.text} onSelect={(rewritten) => onUpdate({ ...entry, text: rewritten })} />
              <div className="relative" ref={mediaMenuRef}>
                <button
                  onClick={() => { setShowMediaMenu(!showMediaMenu); }}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${showMediaMenu ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-violet-400 hover:text-violet-500'}`}
                >
                  <Camera size={16} />
                </button>
                <MediaMenuPopup show={showMediaMenu} target="images" camRef={cameraRef} galRef={galleryRef} />
              </div>
            </div>
            {entry.images.length > 0 && <span className="text-[10px] text-gray-400 font-medium">{entry.images.length} photo{entry.images.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileUpload(e, 'images')} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileUpload(e, 'images')} />
    </div>
  );
};

const CommentModal = ({
  questionId,
  questionText,
  selectedAnswer,
  existingComment,
  addNew,
  onSave,
  onClose,
  locationOptions,
  lockedLocation,
  onLockLocation,
  onUnlockLocation,
  allQuestions,
  onReassign,
}: {
  questionId: string;
  questionText: string;
  selectedAnswer: string;
  existingComment?: QuestionComment;
  addNew?: boolean;
  onSave: (questionId: string, comment: QuestionComment) => void;
  onClose: () => void;
  locationOptions?: string[];
  lockedLocation?: string | null;
  onLockLocation?: (loc: string) => void;
  onUnlockLocation?: () => void;
  allQuestions?: { id: string; text: string; sectionTitle: string; pageTitle?: string }[];
  onReassign?: (fromQuestionId: string, toQuestionId: string, entryId: string, reason: string, newLocation?: string) => void;
}) => {
  const makeEntry = (): CommentEntry => ({
    id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: '', images: [], closureEvidence: [], closureComments: '',
    timestamp: new Date().toLocaleString(),
    createdAtMs: Date.now(),
    ...(lockedLocation ? { location: lockedLocation } : {}),
  });

  const initEntries = (): CommentEntry[] => {
    if (addNew) return [makeEntry()];
    if (existingComment?.entries?.length) return existingComment.entries;
    const legacy = existingComment as any;
    if (legacy && (legacy.text || legacy.images?.length)) {
      return [{
        id: `ce-legacy-${Date.now()}`,
        text: legacy.text || '',
        images: legacy.images || [],
        closureEvidence: [],
        closureComments: '',
        timestamp: legacy.timestamp || new Date().toLocaleString(),
      }];
    }
    return [makeEntry()];
  };

  const existingEntries = (() => {
    if (existingComment?.entries?.length) return existingComment.entries;
    const legacy = existingComment as any;
    if (legacy && (legacy.text || legacy.images?.length)) {
      return [{
        id: `ce-legacy-${Date.now()}`,
        text: legacy.text || '',
        images: legacy.images || [],
        closureEvidence: [],
        closureComments: '',
        timestamp: legacy.timestamp || new Date().toLocaleString(),
      }];
    }
    return [];
  })();

  const [entries, setEntries] = useState<CommentEntry[]>(initEntries);
  const [editingImage, setEditingImage] = useState<{ url: string; callback: (edited: string) => void } | null>(null);
  const [collageData, setCollageData] = useState<{ images: string[]; callback: (collageUrl: string, finalImgs: string[]) => void } | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [reassignEntry, setReassignEntry] = useState<{ entryId: string; entryIdx: number } | null>(null);
  const [reassignQId, setReassignQId] = useState('');
  const [reassignLoc, setReassignLoc] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignQSearch, setReassignQSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  const updateEntry = (idx: number, updated: CommentEntry) => {
    setEntries(prev => prev.map((e, i) => i === idx ? updated : e));
  };

  const appendImageToEntry = (idx: number, target: 'images' | 'closureEvidence', dataUrl: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      return target === 'images'
        ? { ...e, images: [...e.images, dataUrl] }
        : { ...e, closureEvidence: [...e.closureEvidence, dataUrl] };
    }));
  };

  const deleteEntry = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    setEntries(prev => [...prev, makeEntry()]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const handleSave = () => {
    const validEntries = entries.filter(e => e.text.trim() || e.images.length > 0 || e.closureEvidence.length > 0 || e.closureComments.trim());
    if (validEntries.length === 0) { onClose(); return; }
    if (addNew) {
      onSave(questionId, { entries: [...existingEntries, ...validEntries] });
    } else {
      onSave(questionId, { entries: validEntries });
    }
  };

  const hasContent = entries.some(e => e.text.trim() || e.images.length > 0 || e.closureEvidence.length > 0 || e.closureComments.trim());

  const handleOverlayClick = () => {
    if (hasContent && !existingComment) {
      if (!confirm('Discard unsaved comments?')) return;
    }
    onClose();
  };

  if (editingImage) {
    return (
      <div className="fixed inset-0 z-[10015]">
        <PhotoEditor
          imageUrl={editingImage.url}
          onSave={(edited) => { editingImage.callback(edited); setEditingImage(null); }}
          onCancel={() => setEditingImage(null)}
        />
      </div>
    );
  }

  if (collageData) {
    return (
      <div className="fixed inset-0 z-[10015]">
        <CollageStudio
          initialImages={collageData.images}
          onSave={(collageUrl, finalImgs) => { collageData.callback(collageUrl, finalImgs); setCollageData(null); }}
          onClose={() => setCollageData(null)}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleOverlayClick}>
      <div className="bg-white w-full sm:max-w-xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[88vh] border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-violet-600 text-white rounded-xl shadow-lg flex-shrink-0">
              <MessageSquare size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Comments</h3>
              <p className="text-[10px] text-gray-400 truncate mt-0.5">Answer: {selectedAnswer}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-violet-100 text-violet-700 font-bold px-2 py-0.5 rounded-full">{entries.length}</span>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" ref={scrollRef}>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
            <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wider mb-0.5">Question</p>
            <p className="text-xs sm:text-sm text-violet-800 font-medium leading-snug">{questionText}</p>
          </div>

          {entries.map((entry, idx) => (
            <div key={entry.id}>
              <CommentEntryCard
                entry={entry}
                index={idx}
                onUpdate={(updated) => updateEntry(idx, updated)}
                onAppendImage={(target, dataUrl) => appendImageToEntry(idx, target, dataUrl)}
                onDelete={() => deleteEntry(idx)}
                onEditImage={(img, cb) => setEditingImage({ url: img, callback: cb })}
                onMakeCollage={(imgs, cb) => setCollageData({ images: imgs, callback: cb })}
                locationOptions={locationOptions}
                lockedLocation={lockedLocation}
                onLockLocation={onLockLocation}
                onUnlockLocation={onUnlockLocation}
              />
              {onReassign && allQuestions && !addNew && (entry.text.trim() || entry.images.length > 0) && (
                <div className="flex justify-end mt-1 px-1">
                  <button
                    type="button"
                    onClick={() => { setReassignEntry({ entryId: entry.id, entryIdx: idx }); setReassignQId(''); setReassignLoc(entry.location || ''); setReassignReason(''); setReassignQSearch(''); }}
                    className="text-[9px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowRightLeft size={10} /> Reassign Question / Location
                  </button>
                </div>
              )}
            </div>
          ))}

          <button onClick={addEntry}
            className="w-full py-3 rounded-xl border-2 border-dashed border-violet-200 text-violet-600 font-semibold text-sm hover:bg-violet-50 hover:border-violet-400 transition-all flex items-center justify-center gap-2">
            <Plus size={16} /> Add More Comment
          </button>
        </div>

        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 bg-white shrink-0">
          <button onClick={onClose} className="flex-1 py-3 sm:py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
            Skip
          </button>
          <button onClick={handleSave} className="flex-1 py-3 sm:py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
            <Send size={14} /> Save {entries.length > 1 ? `(${entries.length})` : ''}
          </button>
        </div>
      </div>

      {reassignEntry && onReassign && allQuestions && (() => {
        const filteredQs = allQuestions.filter(q => {
          if (q.id === questionId) return false;
          if (!reassignQSearch.trim()) return true;
          const t = reassignQSearch.toLowerCase();
          return q.text.toLowerCase().includes(t) || q.sectionTitle.toLowerCase().includes(t);
        });
        const selectedQ = allQuestions.find(q => q.id === reassignQId);
        return (
          <div className="fixed inset-0 z-[10018] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setReassignEntry(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-amber-200 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500 text-white rounded-lg"><ArrowRightLeft size={14} /></div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-800">Reassign Observation</h4>
                    <p className="text-[9px] text-amber-500">Move comment #{reassignEntry.entryIdx + 1} to a different question</p>
                  </div>
                </div>
                <button onClick={() => setReassignEntry(null)} className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-400"><X size={16} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Current Question</p>
                  <p className="text-[11px] text-gray-600 leading-snug">{questionText}</p>
                </div>

                <div>
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">New Question *</p>
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-white border-2 border-amber-200 rounded-xl px-3 py-2 focus-within:border-amber-400 transition-colors">
                      <Search size={12} className="text-amber-400 shrink-0" />
                      <input
                        type="text"
                        value={reassignQSearch}
                        onChange={e => { setReassignQSearch(e.target.value); setReassignQId(''); }}
                        placeholder="Search questions..."
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-gray-400"
                        autoFocus
                      />
                    </div>
                    {selectedQ && (
                      <div className="mt-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wider">{selectedQ.sectionTitle}</p>
                        <p className="text-[11px] text-amber-800 font-medium leading-snug mt-0.5">{selectedQ.text}</p>
                      </div>
                    )}
                    {!selectedQ && reassignQSearch.trim() && (
                      <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {filteredQs.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400 italic">No matching questions</p>
                        ) : filteredQs.slice(0, 30).map(q => (
                          <button key={q.id} type="button"
                            onClick={() => { setReassignQId(q.id); setReassignQSearch(q.text.slice(0, 60)); }}
                            className="w-full text-left px-3 py-2 hover:bg-amber-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider truncate">{q.sectionTitle}</p>
                            <p className="text-[11px] text-gray-700 leading-snug truncate">{q.text}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {locationOptions && locationOptions.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">New Location (optional)</p>
                    <select
                      value={reassignLoc}
                      onChange={e => setReassignLoc(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs focus:border-amber-400 outline-none transition-colors bg-white"
                    >
                      <option value="">— Keep current —</option>
                      {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Reason for Reassignment *</p>
                  <textarea
                    value={reassignReason}
                    onChange={e => setReassignReason(e.target.value)}
                    placeholder="Explain why this observation is being moved..."
                    rows={2}
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-xs resize-none focus:border-amber-400 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 px-4 py-3 border-t border-amber-100 bg-amber-50/50 shrink-0">
                <button onClick={() => setReassignEntry(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  disabled={!reassignQId || !reassignReason.trim()}
                  onClick={() => {
                    if (!reassignQId || !reassignReason.trim()) return;
                    onReassign(questionId, reassignQId, reassignEntry.entryId, reassignReason.trim(), reassignLoc || undefined);
                    setEntries(prev => prev.filter(e => e.id !== reassignEntry.entryId));
                    setReassignEntry(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  <ArrowRightLeft size={12} /> Reassign
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {viewingImage && (
        <div className="fixed inset-0 z-[10020] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <button onClick={() => setViewingImage(null)} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/30"><X size={24} /></button>
          <img src={viewingImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

const ClosureModal = ({
  entry,
  onSave,
  onClose,
}: {
  entry: CommentEntry;
  onSave: (closureEvidence: string[], closureComments: string) => void;
  onClose: () => void;
}) => {
  const [closureEvidence, setClosureEvidence] = useState<string[]>(entry.closureEvidence || []);
  const [closureComments, setClosureComments] = useState(entry.closureComments || '');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const compressed = await compressImage(e.target?.result as string);
          setClosureEvidence(prev => [...prev, compressed]);
        } catch {
          const raw = e.target?.result as string;
          if (raw) setClosureEvidence(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[75vh] border border-gray-200 overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-teal-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg flex-shrink-0">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-tight">Close Observation</h3>
              <p className="text-[10px] text-emerald-600 truncate mt-0.5">Add closure evidence & comments</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {entry.text && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
              <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wider mb-0.5">Original Observation</p>
              <p className="text-xs sm:text-sm text-violet-800 font-medium leading-snug">{entry.text}</p>
            </div>
          )}

          {entry.images.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Observation Evidence</p>
              <div className={`grid gap-1.5 ${entry.images.length === 1 ? 'grid-cols-1 max-w-[180px]' : entry.images.length === 2 ? 'grid-cols-2 max-w-[280px]' : 'grid-cols-3 max-w-[360px]'}`}>
                {entry.images.map((img, i) => (
                  <div key={i} className="rounded-lg overflow-hidden border border-gray-200 aspect-square">
                    <img src={img} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-dashed border-gray-200 pt-3">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Closure Evidence Images</p>
            {closureEvidence.length > 0 && (
              <div className="mb-3">
                <div className={`grid gap-2 ${closureEvidence.length === 1 ? 'grid-cols-1' : closureEvidence.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {closureEvidence.map((img, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-emerald-200 aspect-square">
                      <img src={img} alt={`Closure ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button onClick={() => setClosureEvidence(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 bg-white rounded-lg shadow-md text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">{idx + 1}/{closureEvidence.length}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold transition-colors">
                <Camera size={15} /> Camera
              </button>
              <button onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-violet-700 text-xs font-semibold transition-colors">
                <ImageLucide size={15} /> Gallery
              </button>
              {closureEvidence.length > 0 && <span className="text-[10px] text-gray-400 font-medium self-center ml-auto">{closureEvidence.length} photo{closureEvidence.length > 1 ? 's' : ''}</span>}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Closure Comments</p>
            <textarea
              value={closureComments}
              onChange={e => setClosureComments(e.target.value)}
              onPaste={e => handlePasteImages(e, (img) => setClosureEvidence(prev => [...prev, img]))}
              placeholder="Describe the corrective actions taken... (paste images here)"
              className="w-full min-h-[90px] p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none outline-none placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              rows={4}
            />
          </div>
        </div>

        <div className="flex gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 bg-white shrink-0">
          <button onClick={onClose} className="flex-1 py-3 sm:py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(closureEvidence, closureComments.trim())}
            disabled={closureEvidence.length === 0 && !closureComments.trim()}
            className="flex-1 py-3 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
            <ShieldCheck size={14} /> Close Observation
          </button>
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
      </div>
    </div>
  );
};

interface AuditDraft {
  templateId: string;
  checklistId?: string;
  currentStep: 'unit-details' | 'checklist';
  unitForm: UnitDetailsForm;
  answers: AnswerState;
  comments: CommentState;
  applicability: ApplicabilityState;
  pageApplicability?: ApplicabilityState;
  savedNotes: { bestPractice: string; opportunity: string; bestPracticeImages?: string[]; opportunityImages?: string[] };
  notesBestPractice: string;
  notesOpportunity: string;
  notesBPImages?: string[];
  notesOFIImages?: string[];
  auditState: 'idle' | 'running' | 'paused' | 'completed' | 'draft' | 'submitted';
  auditStartTime: number | null;
  totalPauseDuration: number;
  savedAt: number;
  auditSignature?: string;
  reviewerSignature?: string;
  reviewerName?: string;
  locationTags?: Record<string, string>;
  scrollY?: number;
  activeHeaderId?: string | null;
  lockedLocation?: string | null;
  activeLocationTab?: string | null;
  locationApplicability?: Record<string, boolean>;
  checklistName?: string;
  unitName?: string;
  equipmentId?: string;
  scanType?: 'cleaning' | 'maintenance';
}

const DRAFT_PREFIX = 'haccp_audit_draft_';
const REPORT_PREFIX = 'haccp_audit_report_';

let _dbSaveQueue: Array<{ id: string; type: string; data: any }> = [];
let _dbSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _syncListeners: Array<(status: 'syncing' | 'synced' | 'offline' | 'pending') => void> = [];
const PENDING_SYNC_KEY = 'haccp_audit_pending_sync';

const _dbSyncListeners: Array<() => void> = [];
function _notifyDbSynced() { _dbSyncListeners.forEach(fn => fn()); }
function _notifySyncStatus(status: 'syncing' | 'synced' | 'offline' | 'pending') {
  _syncListeners.forEach(fn => fn(status));
}

function _savePendingToLocal(batch: Array<{ id: string; type: string; data: any }>) {
  try {
    const existing = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
    batch.forEach(item => {
      const idx = existing.findIndex((e: any) => e.id === item.id && e.type === item.type);
      if (idx >= 0) existing[idx] = item;
      else existing.push(item);
    });
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(existing));
  } catch {}
}

function _clearPendingFromLocal(ids: Array<{ id: string; type: string }>) {
  try {
    const existing = JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]');
    const filtered = existing.filter((e: any) => !ids.some(i => i.id === e.id && i.type === e.type));
    if (filtered.length > 0) localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
    else localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {}
}

function _getPendingFromLocal(): Array<{ id: string; type: string; data: any }> {
  try { return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || '[]'); } catch { return []; }
}

let _syncInProgress = false;

function _flushDbSaveQueue() {
  if (_dbSaveQueue.length === 0) return;
  const batch = [..._dbSaveQueue];
  _dbSaveQueue = [];
  _dbSaveTimer = null;

  _savePendingToLocal(batch);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    _notifySyncStatus('pending');
    return;
  }

  _attemptSync(batch);
}

let _syncRetryQueue: Array<{ id: string; type: string; data: any }> = [];

async function _attemptSync(batch: Array<{ id: string; type: string; data: any }>) {
  if (_syncInProgress) {
    batch.forEach(item => {
      const idx = _syncRetryQueue.findIndex(q => q.id === item.id && q.type === item.type);
      if (idx >= 0) _syncRetryQueue[idx] = item;
      else _syncRetryQueue.push(item);
    });
    return;
  }
  _syncInProgress = true;
  _notifySyncStatus('syncing');
  const slimBatch = batch.map(item => ({ ...item, data: _stripImagesFromData(item.data) }));
  const payload = JSON.stringify(slimBatch);
  try {
    const res = await fetch('/api/audit-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    if (res.ok) {
      _clearPendingFromLocal(batch.map(b => ({ id: b.id, type: b.type })));
      _notifyDbSynced();
      _notifySyncStatus('synced');
    } else {
      _notifySyncStatus('pending');
    }
  } catch {
    _notifySyncStatus('pending');
  } finally {
    _syncInProgress = false;
    if (_syncRetryQueue.length > 0) {
      const retry = [..._syncRetryQueue];
      _syncRetryQueue = [];
      _savePendingToLocal(retry);
      setTimeout(() => _attemptSync(retry), 500);
    }
  }
}

async function _syncPendingQueue() {
  const pending = _getPendingFromLocal();
  if (pending.length === 0) { _notifySyncStatus('synced'); return; }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (_syncInProgress) return;

  _syncInProgress = true;
  _notifySyncStatus('syncing');
  try {
    const slimPending = pending.map(item => ({ ...item, data: _stripImagesFromData(item.data) }));
    const res = await fetch('/api/audit-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slimPending),
    });
    if (res.ok) {
      localStorage.removeItem(PENDING_SYNC_KEY);
      _notifyDbSynced();
      _notifySyncStatus('synced');
    } else {
      _notifySyncStatus('pending');
    }
  } catch {
    _notifySyncStatus('pending');
  } finally {
    _syncInProgress = false;
  }
}

const _draftAnswerHwm: Record<string, number> = {};

function _queueDbSave(id: string, type: string, data: any) {
  if (type === 'draft' && data?.answers) {
    const answeredCount = Object.keys(data.answers).filter((k: string) => {
      const a = data.answers[k];
      return a && a.selectedIndex !== null && a.selectedIndex !== undefined;
    }).length;
    const prev = _draftAnswerHwm[id] || 0;
    if (answeredCount > prev) {
      _draftAnswerHwm[id] = answeredCount;
    }
    if (prev > 10 && answeredCount < prev * 0.5) {
      console.warn(`[client] BLOCKED db save: incoming=${answeredCount}, hwm=${prev} for ${id}`);
      return;
    }
  }
  const existing = _dbSaveQueue.findIndex(q => q.id === id && q.type === type);
  if (existing >= 0) _dbSaveQueue[existing] = { id, type, data };
  else _dbSaveQueue.push({ id, type, data });
  if (_dbSaveTimer) clearTimeout(_dbSaveTimer);
  _dbSaveTimer = setTimeout(_flushDbSaveQueue, 500);
}

function saveDraftToStorage(key: string, draft: AuditDraft) {
  try { localStorage.setItem(key, JSON.stringify(draft)); } catch {}
  const draftId = key.replace(DRAFT_PREFIX, '');
  _queueDbSave(draftId, 'draft', draft);
}

function loadDraftFromStorage(key: string): AuditDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as AuditDraft;
  } catch { return null; }
}

function clearDraftFromStorage(key: string) {
  try { localStorage.removeItem(key); } catch {}
  const draftId = key.replace(DRAFT_PREFIX, '');
  _clearPendingFromLocal([{ id: draftId, type: 'draft' }]);
  const doDelete = () => fetch('/api/audit-reports', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draftId, type: 'draft' }),
  }).catch(() => {});
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const retryOnOnline = () => { doDelete(); window.removeEventListener('online', retryOnOnline); };
    window.addEventListener('online', retryOnOnline);
  } else {
    doDelete();
  }
}

function saveReportToStorage(taskId: string, draft: AuditDraft) {
  try { localStorage.setItem(REPORT_PREFIX + taskId, JSON.stringify(draft)); } catch {}
  _queueDbSave(taskId, 'report', draft);
}

function loadReportFromStorage(taskId: string): AuditDraft | null {
  try {
    const raw = localStorage.getItem(REPORT_PREFIX + taskId);
    if (!raw) return null;
    return JSON.parse(raw) as AuditDraft;
  } catch { return null; }
}

async function loadReportFromDb(taskId: string): Promise<AuditDraft | null> {
  try {
    const resp = await fetch(`/api/audit-reports?ids=${encodeURIComponent(taskId)}&type=report`);
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows.find((r: any) => r.id === taskId);
    if (!row || !row.data) return null;
    try { localStorage.setItem(REPORT_PREFIX + taskId, JSON.stringify(row.data)); } catch {}
    return row.data as AuditDraft;
  } catch { return null; }
}

async function loadDraftFromDb(key: string): Promise<AuditDraft | null> {
  const draftId = key.replace(DRAFT_PREFIX, '');
  try {
    const resp = await fetch(`/api/audit-reports?ids=${encodeURIComponent(draftId)}&type=draft`);
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows.find((r: any) => r.id === draftId);
    if (!row || !row.data) return null;
    try { localStorage.setItem(key, JSON.stringify(row.data)); } catch {}
    return row.data as AuditDraft;
  } catch { return null; }
}

const DB_IMAGE_MAX = 100000;
function _stripImagesFromData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(_stripImagesFromData);
  const out: any = {};
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (typeof val === 'string' && val.startsWith('data:image')) {
      if (val.length <= DB_IMAGE_MAX) {
        out[key] = val;
      } else {
        out[key] = '__image_in_localstorage__';
      }
    } else {
      out[key] = _stripImagesFromData(val);
    }
  }
  return out;
}

function flushAuditReportsToDb() {
  const queuedItems = [..._dbSaveQueue];
  _dbSaveQueue = [];
  if (_dbSaveTimer) { clearTimeout(_dbSaveTimer); _dbSaveTimer = null; }

  const pending = _getPendingFromLocal();
  const allItems = [...pending];
  queuedItems.forEach(item => {
    const idx = allItems.findIndex(a => a.id === item.id && a.type === item.type);
    if (idx >= 0) allItems[idx] = item;
    else allItems.push(item);
  });

  const safeItems = allItems.filter(item => {
    if (item.type !== 'draft' || !item.data?.answers) return true;
    const cnt = Object.keys(item.data.answers).filter((k: string) => {
      const a = item.data.answers[k];
      return a && a.selectedIndex !== null && a.selectedIndex !== undefined;
    }).length;
    const prev = _draftAnswerHwm[item.id] || 0;
    if (cnt > prev) _draftAnswerHwm[item.id] = cnt;
    if (prev > 10 && cnt < prev * 0.5) {
      console.warn(`[client-flush] BLOCKED: incoming=${cnt}, hwm=${prev} for ${item.id}`);
      return false;
    }
    return true;
  });

  if (safeItems.length === 0) return;

  _savePendingToLocal(safeItems);

  const slimItems = safeItems.map(item => ({ ...item, data: _stripImagesFromData(item.data) }));

  const sendItems = (items: any[]) => {
    const payload = JSON.stringify(items);
    const blob = new Blob([payload], { type: 'application/json' });
    if (blob.size <= 62000) {
      const sent = navigator.sendBeacon('/api/audit-reports', blob);
      if (!sent) {
        fetch('/api/audit-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).then(r => { if (r.ok) _clearPendingFromLocal(items.map(b => ({ id: b.id, type: b.type }))); }).catch(() => {});
      }
    } else {
      fetch('/api/audit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).then(r => { if (r.ok) _clearPendingFromLocal(items.map(b => ({ id: b.id, type: b.type }))); }).catch(() => {});
    }
  };
  try {
    if (slimItems.length <= 1) {
      sendItems(slimItems);
    } else {
      slimItems.forEach(item => sendItems([item]));
    }
  } catch {
    try {
      fetch('/api/audit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slimItems),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

export async function forceSyncAllAuditData(onProgress?: (synced: number, total: number) => void): Promise<{ synced: number; failed: number }> {
  const pending = _getPendingFromLocal();
  const inQueue = [..._dbSaveQueue];
  const allItems = [...pending];
  inQueue.forEach(item => {
    const idx = allItems.findIndex(a => a.id === item.id && a.type === item.type);
    if (idx >= 0) allItems[idx] = item;
    else allItems.push(item);
  });

  if (allItems.length === 0) {
    const allKeys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('haccp_audit_draft_') || k.startsWith('haccp_audit_report_'))) allKeys.push(k!);
      }
    } catch {}
    for (const key of allKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        const isDraft = key.startsWith('haccp_audit_draft_');
        const id = key.replace('haccp_audit_draft_', '').replace('haccp_audit_report_', '');
        const type = isDraft ? 'draft' : 'report';
        const idx = allItems.findIndex(a => a.id === id && a.type === type);
        if (idx >= 0) allItems[idx] = { id, type, data };
        else allItems.push({ id, type, data });
      } catch {}
    }
  }

  if (allItems.length === 0) return { synced: 0, failed: 0 };

  const slimItems = allItems.map(item => ({ ...item, data: _stripImagesFromData(item.data) }));
  const CHUNK = 5;
  const total = slimItems.length;
  let synced = 0; let failed = 0;
  if (onProgress) onProgress(0, total);
  for (let i = 0; i < slimItems.length; i += CHUNK) {
    const chunk = slimItems.slice(i, i + CHUNK);
    try {
      const res = await fetch('/api/audit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        _clearPendingFromLocal(chunk.map(b => ({ id: b.id, type: b.type })));
        synced += chunk.length;
        if (onProgress) onProgress(synced + failed, total);
      } else { failed += chunk.length; if (onProgress) onProgress(synced + failed, total); }
    } catch { failed += chunk.length; if (onProgress) onProgress(synced + failed, total); }
  }
  if (_dbSaveTimer) { clearTimeout(_dbSaveTimer); _dbSaveTimer = null; }
  _dbSaveQueue = [];
  return { synced, failed };
}

export { loadReportFromStorage, saveReportToStorage, loadReportFromDb, loadDraftFromDb, flushAuditReportsToDb, REPORT_PREFIX };

export function hasDraftInStorage(templateId: string): boolean {
  try { return localStorage.getItem(DRAFT_PREFIX + templateId) !== null; } catch { return false; }
}

export function getDraftInfo(templateId: string): { savedAt: number; answeredCount: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + templateId);
    if (!raw) return null;
    const d = JSON.parse(raw) as AuditDraft;
    const answeredCount = Object.values(d.answers).filter(a => a.selectedIndex !== null).length;
    return { savedAt: d.savedAt, answeredCount };
  } catch { return null; }
}

export interface AuditCloseResult {
  submitted: boolean;
  scoreObtained: number;
  scoreMax: number;
  scorePercent: number;
  observations?: import('../types').AuditObservation[];
  questions?: import('../types').AuditQuestion[];
}

const FloatingCommentButton = ({
  template,
  answers,
  comments,
  locationOptions,
  lockedLocation,
  onLockLocation,
  onUnlockLocation,
  departmentLocations,
  combinedLocations,
  onSaveComment,
  onSaveAsDraftCb,
  onObsSaveCb,
  onAnswerSelect,
  auditLocationName,
  auditUnitId,
  auditUnitName,
  questionHistoryMap,
  effectivePages,
  onTagUpdate,
  externalOpen,
  onExternalOpenHandled,
}: {
  template: ChecklistTemplate;
  answers: AnswerState;
  comments: CommentState;
  locationOptions?: string[];
  lockedLocation?: string | null;
  onLockLocation?: (loc: string) => void;
  onUnlockLocation?: () => void;
  departmentLocations?: Record<string, string[]>;
  combinedLocations?: string[];
  onSaveComment: (questionId: string, comment: QuestionComment) => void;
  onSaveAsDraftCb?: (drafts: DraftObservationPayload[]) => void;
  onObsSaveCb?: (observations: ObservationPayload[]) => void;
  onAnswerSelect?: (questionId: string, responseIndex: number, response: ResponseOption) => void;
  auditLocationName?: string;
  auditUnitId?: string;
  auditUnitName?: string;
  questionHistoryMap?: Record<string, AuditHistoryRecord[]>;
  effectivePages?: PageNode[];
  onTagUpdate?: (tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'>) => void;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (externalOpen) {
      setOpen(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen, onExternalOpenHandled]);

  const allQuestions = useMemo((): AddObsQuestionOption[] => {
    const qs: AddObsQuestionOption[] = [];
    const pages = effectivePages || template.pages;
    pages.forEach(page => {
      const pageId = page.id || '';
      const hasVirtualPrefix = pageId.includes('::');
      const virtualRawPrefix = hasVirtualPrefix ? pageId.split('::')[0] : '';
      const dept = page.title || 'Page';
      page.sections.forEach(sec => {
        const addQ = (q: QuestionNode, secTitle: string) => {
          qs.push({
            id: q.id,
            text: q.text || 'Untitled',
            pageTitle: hasVirtualPrefix ? `${virtualRawPrefix}::${page.title || 'Page'}` : (page.title || 'Page'),
            sectionTitle: secTitle,
            responses: q.responses.map(r => ({ text: r.text || '', score: r.score !== undefined ? String(r.score) : '0', color: r.color || '' })),
            checklistName: template.title || 'Checklist',
            checklistId: template.id || '',
            responsibility: q.responsibility || [],
            department: dept,
          });
        };
        sec.questions.forEach(q => addQ(q, sec.title || 'Section'));
        (sec.subSections || []).forEach(sub => {
          sub.questions.forEach(q => addQ(q, `${sec.title || 'Section'} > ${sub.title || 'Sub'}`));
        });
      });
    });
    return qs;
  }, [template, effectivePages]);



  const handleModalSave = (observations: ObservationPayload[]) => {
    const ts = new Date().toLocaleString();
    const grouped: Record<string, CommentEntry[]> = {};
    const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
    for (const obs of observations) {
      const matchedQ = allQuestions.find(q => q.id === obs.questionId);
      if (matchedQ) {
        const entryId = obs.id || `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const respIdx = obs.selectedAnswer ? matchedQ.responses.findIndex(r => r.text === obs.selectedAnswer) : -1;
        const newEntry: CommentEntry = {
          id: entryId,
          text: obs.observationText,
          images: [...obs.allEvidence],
          closureEvidence: [],
          closureComments: '',
          timestamp: ts,
          createdAtMs: Date.now(),
          ...(obs.location ? { location: obs.location } : {}),
          savedToDb: true,
          managementTag: obs.managementTag,
          resourceRequired: obs.resourceRequired || undefined,
          selectedResponseIndex: respIdx >= 0 ? respIdx : undefined,
        };
        if (!grouped[matchedQ.id]) grouped[matchedQ.id] = [];
        grouped[matchedQ.id].push(newEntry);
        if (obs.managementTag) tagUpdates[entryId] = obs.managementTag;
      }
    }
    for (const [qId, newEntries] of Object.entries(grouped)) {
      const existing = comments[qId];
      onSaveComment(qId, { entries: [...(existing?.entries || []), ...newEntries] });
    }
    if (Object.keys(tagUpdates).length > 0 && onTagUpdate) {
      onTagUpdate(tagUpdates);
    }
    if (onObsSaveCb) onObsSaveCb(observations);
    setOpen(false);
  };

  const handleModalDraft = async (drafts: DraftObservationPayload[]) => {
    if (onSaveAsDraftCb) onSaveAsDraftCb(drafts);
    setOpen(false);
  };

  const handleAnswerSelect = (questionId: string, responseIndex: number, response: { text: string; score: string; color: string }) => {
    if (onAnswerSelect) {
      const q = allQuestions.find(aq => aq.id === questionId);
      if (q && q.responses[responseIndex]) {
        const resp = q.responses[responseIndex];
        onAnswerSelect(questionId, responseIndex, { text: resp.text, score: resp.score, color: resp.color } as ResponseOption);
      }
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg border-2 border-violet-400 flex items-center justify-center transition-all active:scale-90"
        title="Add Observation"
      >
        <Plus size={20} strokeWidth={3} />
      </button>

      {open && (
        <AddObservationModal
          questions={allQuestions}
          locationOptions={locationOptions}
          auditLocationName={auditLocationName}
          auditUnitId={auditUnitId}
          auditUnitName={auditUnitName}
          checklistId={template.id}
          lockedLocation={lockedLocation}
          onLockLocation={onLockLocation}
          onUnlockLocation={onUnlockLocation}
          departmentLocations={departmentLocations}
          combinedLocations={combinedLocations}
          onClose={() => setOpen(false)}
          onSave={handleModalSave}
          onSaveAsDraft={handleModalDraft}
          onAnswerSelect={handleAnswerSelect}
          questionHistoryMap={questionHistoryMap ? Object.fromEntries(Object.entries(questionHistoryMap).map(([qId, recs]) => [qId, recs.map(r => ({ date: r.date, status: r.status }))])) : undefined}
          currentAnswers={answers}
        />
      )}
    </>
  );
};



class AuditPreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AuditPreview] RENDER CRASH:', error.message, error.stack);
    console.error('[AuditPreview] Component stack:', errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col items-center justify-center gap-4 p-8">
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6 max-w-lg w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-red-800">Audit Preview Error</h2>
                <p className="text-xs text-red-600">Something went wrong while rendering the audit.</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 max-h-40 overflow-auto">
              <p className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
              <p className="text-[10px] font-mono text-red-400 mt-2 whitespace-pre-wrap break-all">
                {this.state.error?.stack?.split('\n').slice(0, 5).join('\n') || ''}
              </p>
            </div>
            <button
              onClick={() => this.props.onClose?.()}
              className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Close Audit
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export type FacilityEquipmentInfo = {
  name: string;
  idNumber: string;
  location: string;
  department: string;
  make: string;
  model: string;
  type: 'cleaning' | 'maintenance';
  frequency: string;
  day?: string;
  startDate?: string;
  responsibility?: string[];
  equipmentId?: string;
};

type AuditChecklistPreviewProps = {
  template: ChecklistTemplate;
  onClose: (result?: AuditCloseResult) => void;
  autoTriggerDownload?: boolean;
  autoDownloadMode?: 'combined' | 'per-department' | 'per-section' | 'per-location';
  autoTriggerExcelDownload?: boolean;
  autoTriggerExcelLocationDownload?: boolean;
  draftKey?: string;
  reviewRequired?: boolean;
  auditUnitId?: string;
  auditUnitName?: string;
  auditLocationName?: string;
  isCombinedAudit?: boolean;
  combinedLocations?: string[];
  trialMode?: boolean;
  departmentLocations?: Record<string, string[]>;
  onObservationsChange?: (observations: import('../types').AuditObservation[]) => void;
  equipmentInfo?: FacilityEquipmentInfo;
};

export default function AuditChecklistPreviewWrapper(props: AuditChecklistPreviewProps) {
  return (
    <AuditPreviewErrorBoundary onClose={() => props.onClose()}>
      <AuditChecklistPreviewInner {...props} />
    </AuditPreviewErrorBoundary>
  );
}

function AuditChecklistPreviewInner({
  template,
  onClose,
  autoTriggerDownload,
  autoDownloadMode,
  autoTriggerExcelDownload,
  autoTriggerExcelLocationDownload,
  draftKey,
  reviewRequired = true,
  auditUnitId,
  auditUnitName,
  auditLocationName,
  isCombinedAudit = false,
  combinedLocations,
  trialMode = false,
  departmentLocations = {},
  onObservationsChange,
  equipmentInfo,
}: AuditChecklistPreviewProps) {
  const storageKey = DRAFT_PREFIX + (draftKey || template.id);
  const reportKey = draftKey || template.id;
  const existingDraft = useRef<AuditDraft | null>(
    trialMode ? null : (loadDraftFromStorage(storageKey) || loadReportFromStorage(reportKey) || null)
  );
  const draft = existingDraft.current;
  const [draftRestored, setDraftRestored] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(!!draft);
  const [showImportBanner, setShowImportBanner] = useState<{ count: number } | null>(null);
  const [loadingFromDb, setLoadingFromDb] = useState(!draft && !trialMode);
  const dbSyncCheckDone = React.useRef(!draft);

  const [currentStep, setCurrentStep] = useState<'unit-details' | 'checklist'>(draft ? (draft.currentStep === 'questions' ? 'checklist' : (draft.currentStep || 'unit-details')) as 'unit-details' | 'checklist' : 'unit-details');

  const [unitForm, setUnitForm] = useState<UnitDetailsForm>(draft ? draft.unitForm : {
    companyName: template.unitDetails?.companyName || '', repName: template.unitDetails?.repName || '',
    address: template.unitDetails?.address || '', contact: template.unitDetails?.contact || '',
    email: template.unitDetails?.email || '', manday: template.unitDetails?.manday || '',
    scope: template.unitDetails?.scope || '', dateFrom: template.unitDetails?.dateFrom || '',
    dateTo: template.unitDetails?.dateTo || '', geotag: template.unitDetails?.geotag || '',
    startTime: template.unitDetails?.startTime || '',
  });

  const [answers, setAnswers] = useState<AnswerState>(draft ? draft.answers : {});
  const [comments, setComments] = useState<CommentState>(draft ? draft.comments : {});
  const [collapsed, setCollapsed] = useState<CollapsedState>(() => {
    const init: CollapsedState = {};
    template.pages.forEach(page => {
      init[page.id] = true;
      page.sections.forEach(sec => {
        init[sec.id] = true;
        (sec.subSections || []).forEach(sub => { init[sub.id] = true; });
      });
    });
    return init;
  });
  const [applicability, setApplicability] = useState<ApplicabilityState>(draft ? draft.applicability : {});
  const [pageApplicability, setPageApplicability] = useState<ApplicabilityState>(draft?.pageApplicability || {});
  const [activeHeaderId, setActiveHeaderId] = useState<string | null>(draft?.activeHeaderId ?? null);
  const [commentModal, setCommentModal] = useState<{ questionId: string; questionText: string; selectedAnswer: string; addNew?: boolean } | null>(null);
  const [commentsExpanded, setCommentsExpanded] = useState<Record<string, boolean>>({});
  const [obsInputs, setObsInputs] = useState<Record<string, string>>({});
  const [repeats, setRepeats] = useState<Record<string, boolean>>({});

  const _answerKeys = useMemo(() => Object.keys(answers), [answers]);
  const resolveAnswer = (qId: string) => {
    if (!qId) return undefined;
    const direct = answers[qId];
    if (direct && direct.selectedIndex !== null && direct.selectedIndex !== undefined) return direct;
    if (!qId.includes('::')) {
      const suffixKey = _answerKeys.find(k => k.endsWith('::' + qId) && answers[k]?.selectedIndex !== null && answers[k]?.selectedIndex !== undefined);
      if (suffixKey) return answers[suffixKey];
    }
    return direct;
  };

  const resolveComment = (qId: string) => {
    if (!qId) return undefined;
    const direct = comments[qId];
    if (direct) return direct;
    if (!qId.includes('::')) {
      const suffixKey = Object.keys(comments).find(k => k.endsWith('::' + qId) && comments[k]);
      if (suffixKey) return comments[suffixKey];
    } else {
      const baseId = qId.split('::').slice(1).join('::');
      if (baseId && comments[baseId]) return comments[baseId];
    }
    return direct;
  };

  const resolveRepeat = (qId: string): boolean => {
    if (!qId) return false;
    if (repeats[qId]) return true;
    if (!qId.includes('::')) {
      return Object.keys(repeats).some(k => k.endsWith('::' + qId) && repeats[k]);
    }
    return false;
  };

  const [closureTarget, setClosureTarget] = useState<{ questionId: string; entryId: string } | null>(null);
  const [supervisorPin] = useState('1234');
  const [correctionTarget, setCorrectionTarget] = useState<{ questionId: string; entryId: string; supervisorAuthorized: boolean } | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showObservationPanel, setShowObservationPanel] = useState(false);
  const [triggerAddObs, setTriggerAddObs] = useState(false);
  const [showPanelAddObs, setShowPanelAddObs] = useState(false);
  const [obsPanelTab, setObsPanelTab] = useState<'all' | 'checklist' | 'top-concerns' | 'drafts' | 'management-focus' | 'easy-impactful' | 'ongoing' | 'untagged'>('all');
  const [checklistSubTab, setChecklistSubTab] = useState<'hierarchy' | 'live'>('hierarchy');
  const [liveObsShowFilters, setLiveObsShowFilters] = useState(false);
  const [liveObsExcelExporting, setLiveObsExcelExporting] = useState(false);
  const [deleteObsConfirm, setDeleteObsConfirm] = useState<{ questionId: string; entryId: string; savedToDb: boolean } | null>(null);
  const [obsMultiSelectMode, setObsMultiSelectMode] = useState(false);
  const [selectedObsEntryIds, setSelectedObsEntryIds] = useState<Set<string>>(new Set());
  const [deletingSelectedObs, setDeletingSelectedObs] = useState(false);
  const handleLiveObsExcelExport = async (observations: RegistryObsItem[]) => {
    setLiveObsExcelExporting(true);
    try {
      const exportData = observations.filter(obs => (obs.observationText || obs.title || '').trim() !== '');
      if (exportData.length === 0) { alert('No observations to export.'); setLiveObsExcelExporting(false); return; }
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Live Observations');
      worksheet.columns = [
        { header: 'Report ID', key: 'id', width: 15 },
        { header: 'Severity', key: 'severity', width: 12 },
        { header: 'Level', key: 'level', width: 10 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Question', key: 'question', width: 45 },
        { header: 'Observation', key: 'title', width: 45 },
        { header: 'SOP', key: 'sop', width: 25 },
        { header: 'Sub SOP', key: 'subSop', width: 25 },
        { header: 'Checklist', key: 'checklist', width: 25 },
        { header: 'Location', key: 'area', width: 20 },
        { header: 'Unit', key: 'unit', width: 20 },
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Responsibility', key: 'responsibility', width: 25 },
        { header: 'Created Date', key: 'date', width: 14 },
        { header: 'Closure Date', key: 'closureDate', width: 14 },
        { header: 'Closure Comments', key: 'closure', width: 40 },
        { header: 'Management Tag', key: 'managementTag', width: 18 },
        { header: 'Repeat', key: 'isRepeat', width: 10 },
        { header: 'Evidence (Before)', key: 'evidence_before', width: 20 },
        { header: 'Evidence (After)', key: 'evidence_after', width: 20 },
      ];
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 30;
      const imgPadding = 30000; const rowH = 90; const imgW = 100; const imgH = 80;
      const fetchImg = async (url: string): Promise<ArrayBuffer | null> => {
        try { const r = await fetch(url); const b = await r.blob(); return await b.arrayBuffer(); } catch { return null; }
      };
      const deptLocsMap = (departmentLocations || {}) as Record<string, string[]>;
      const resolveDept = (obs: any): string => {
        const raw = (obs.departmentName || '').trim();
        if (!raw.includes(',')) return raw;
        const area = (obs.area || obs.location || '').trim().toLowerCase();
        if (area) {
          for (const [dept, locs] of Object.entries(deptLocsMap)) {
            if ((locs || []).some(l => l.trim().toLowerCase() === area)) return dept;
          }
        }
        const sopParts = (obs.sop || obs.sectionTitle || '').split(' > ');
        const sopRoot = (sopParts[0] || '').trim();
        if (sopRoot) {
          const parts = raw.split(',').map((s: string) => s.trim());
          const match = parts.find((p: string) => p.toLowerCase() === sopRoot.toLowerCase());
          if (match) return match;
        }
        return raw.split(',')[0]?.trim() || raw;
      };
      for (let i = 0; i < exportData.length; i++) {
        const obs = exportData[i];
        const tagLabel = obs.managementTag === 'management-focus' ? 'Mgmt Focus' : obs.managementTag === 'easy-impactful' ? 'Easy Impact' : obs.managementTag === 'ongoing' ? 'Ongoing' : '';
        const resolvedDept = resolveDept(obs);
        const row = worksheet.addRow({
          id: obs.id, severity: obs.severity, level: obs.level, status: obs.status,
          question: obs.questionText || '', title: obs.observationText || obs.title,
          sop: (() => { const s = (obs.sop || obs.sectionTitle || '').trim(); const parts = s.split(' > '); return parts[0]?.trim() || ''; })(),
          subSop: (() => { const s = (obs.sop || obs.sectionTitle || '').trim(); const parts = s.split(' > '); return parts.length > 1 ? parts.slice(1).join(' > ').trim() : ''; })(),
          checklist: obs.checklistName || '', area: obs.area,
          unit: obs.unitName || '', department: resolvedDept,
          responsibility: obs.people?.length > 0 ? obs.people.map(p => p.name).join(', ') : resolvedDept,
          date: obs.createdDate, closureDate: obs.closureDate || '',
          closure: obs.closureComments || 'N/A', managementTag: tagLabel,
          isRepeat: obs.isRepeat ? 'Yes' : '', evidence_before: '', evidence_after: '',
        });
        row.height = rowH;
        row.alignment = { vertical: 'middle', wrapText: true };
        const excelRow = row.number - 1;
        if (obs.thumbnail) {
          const buffer = await fetchImg(obs.thumbnail);
          if (buffer) { try { const imageId = workbook.addImage({ buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { nativeCol: 18, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch (e) { console.error('Img error', e); } }
        }
        if (obs.afterImage) {
          const buffer = await fetchImg(obs.afterImage);
          if (buffer) { try { const imageId = workbook.addImage({ buffer, extension: 'jpeg' }); worksheet.addImage(imageId, { tl: { nativeCol: 19, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch (e) { console.error('Img error', e); } }
        }
      }
      const outBuffer = await workbook.xlsx.writeBuffer();
      const fileName = `Live_Observations_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (isPWA || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const w = window.open(url, '_blank');
        if (!w) { const a = document.createElement('a'); a.href = url; a.download = fileName; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000); }
        else { setTimeout(() => URL.revokeObjectURL(url), 5000); }
      } else {
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
      }
    } catch (err) { console.error('Live observations Excel export failed', err); } finally { setLiveObsExcelExporting(false); }
  };
  const [liveObsDateFrom, setLiveObsDateFrom] = useState('');
  const [liveObsDateTo, setLiveObsDateTo] = useState('');
  const [liveObsFilters, setLiveObsFilters] = useState<{ category: string; department: string; location: string; sop: string; subSop: string; responsibility: string }>({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' });
  const [fullRegistryObs, setFullRegistryObs] = useState<RegistryObsItem[]>([]);
  const fullRegistryObsFetchedRef = useRef(false);
  const [fullRegistryRefreshKey, setFullRegistryRefreshKey] = useState(0);
  const liveObsFilteredRef = useRef<RegistryObsItem[]>([]);
  const [clTabAuditTasks, setClTabAuditTasks] = useState<import('../types').AuditTask[]>([]);
  const [registryObservations, setRegistryObservations] = useState<any[]>([]);
  const registryObsFetchedRef = useRef(false);
  useEffect(() => {
    if (!showObservationPanel || registryObsFetchedRef.current) return;
    registryObsFetchedRef.current = true;
    const fetchRegistryObs = async () => {
      try {
        const unitParam = auditUnitId ? `&unitId=${encodeURIComponent(auditUnitId)}` : '';
        const res = await fetch(`/api/observations?slim=1${unitParam}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setRegistryObservations(data.filter((o: any) => o.status !== 'DRAFT'));
          } else {
            registryObsFetchedRef.current = false;
          }
        } else {
          registryObsFetchedRef.current = false;
        }
      } catch {
        registryObsFetchedRef.current = false;
      }
    };
    fetchRegistryObs();
  }, [showObservationPanel]);
  useEffect(() => {
    if (obsPanelTab !== 'checklist' || fullRegistryObsFetchedRef.current) return;
    fullRegistryObsFetchedRef.current = true;
    const fetchFullObs = async () => {
      try {
        const unitParam = auditUnitId ? `?unitId=${encodeURIComponent(auditUnitId)}` : '';
        const [obsRes, tasksRes] = await Promise.all([
          fetch(`/api/observations${unitParam}`),
          fetch('/api/audit-tasks?slim=1'),
        ]);
        if (obsRes.ok) {
          const data = await obsRes.json();
          if (Array.isArray(data) && data.length > 0) {
            setFullRegistryObs(data.filter((o: any) => o.status !== 'DRAFT') as RegistryObsItem[]);
          } else {
            fullRegistryObsFetchedRef.current = false;
          }
        } else {
          fullRegistryObsFetchedRef.current = false;
        }
        if (tasksRes.ok) {
          const tasks = await tasksRes.json();
          if (Array.isArray(tasks)) setClTabAuditTasks(tasks);
        }
      } catch {
        fullRegistryObsFetchedRef.current = false;
      }
    };
    fetchFullObs();
  }, [obsPanelTab, fullRegistryRefreshKey]);

  const aliasedOldTexts = useMemo(() => {
    const old = new Set<string>();
    const txtAliases: Record<string, string[]> = (template as any).questionTextAliases || {};
    Object.values(txtAliases).forEach(oldTexts => {
      (oldTexts as string[]).forEach(t => { if (t) old.add(t.toLowerCase().trim()); });
    });
    return old;
  }, [template]);

  const aliasedOldIds = useMemo(() => {
    const old = new Set<string>();
    const idAliases: Record<string, string[]> = (template as any).questionIdAliases || {};
    Object.values(idAliases).forEach(oldIds => {
      (oldIds as string[]).forEach(id => { if (id) old.add(id); });
    });
    return old;
  }, [template]);

  const aliasedSurvivorIds = useMemo(() => {
    const ids = new Set<string>();
    const idAliases: Record<string, string[]> = (template as any).questionIdAliases || {};
    Object.keys(idAliases).forEach(survivorId => { if (survivorId) ids.add(survivorId); });
    return ids;
  }, [template]);

  const isOldMergedQuestion = useCallback((question: { id: string; text?: string }) => {
    if (aliasedOldIds.has(question.id)) return true;
    if (aliasedSurvivorIds.has(question.id)) return false;
    if (question.text && aliasedOldTexts.has(question.text.toLowerCase().trim())) return true;
    return false;
  }, [aliasedOldIds, aliasedOldTexts, aliasedSurvivorIds]);

  const clTabAuditQuestions = useMemo((): AddObsQuestionOption[] => {
    if (!template?.pages) return [];
    const templates = [template];
    const qs: AddObsQuestionOption[] = [];
    const seen = new Set<string>();
    const deptLocs = (departmentLocations || {}) as Record<string, string[]>;
    const allLocs: { dept: string; loc: string }[] = [];
    Object.entries(deptLocs).forEach(([dept, locs]) => {
      (locs || []).forEach(loc => allLocs.push({ dept, loc }));
    });
    const hasLocs = allLocs.length > 0;
    templates.forEach((tmpl: any) => {
      if (!tmpl.pages) return;
      const clId = tmpl.id || tmpl.title || '';
      const clName = tmpl.title || 'Checklist';
      tmpl.pages.forEach((page: any) => {
        const pageDept = page.title || 'Page';
        (page.sections || []).forEach((sec: any) => {
          const addQ = (q: any, secTitle: string) => {
            if (!q.id) return;
            if (isOldMergedQuestion(q)) return;
            const pageDeptLower = pageDept.toLowerCase().trim();
            const matchingPageLocs = allLocs.filter(al => al.dept.toLowerCase().trim() === pageDeptLower);
            let addedVirtual = false;
            if (hasLocs && matchingPageLocs.length > 0) {
              matchingPageLocs.forEach(({ dept, loc }) => {
                const locKey = loc.replace(/\s/g, '_');
                const virtualPrefix = `${dept.replace(/\s/g, '_')}___${locKey}`;
                const virtualId = `${virtualPrefix}::${q.id}`;
                if (seen.has(virtualId)) return;
                seen.add(virtualId);
                addedVirtual = true;
                qs.push({ id: virtualId, text: q.text || 'Untitled', sectionTitle: secTitle, pageTitle: `${virtualPrefix}::${pageDept}`, responses: (q.responses || []).map((r: any) => ({ text: r.text || '', score: r.score || '0', color: r.color || 'gray' })), checklistName: clName, responsibility: q.responsibility || [], checklistId: clId, department: pageDept, isFollowUp: q.isFollowUp || false, category: q.category || sec.category || '' });
              });
            }
            if (!addedVirtual && !seen.has(q.id)) {
              seen.add(q.id);
              qs.push({ id: q.id, text: q.text || 'Untitled', sectionTitle: secTitle, pageTitle: pageDept, responses: (q.responses || []).map((r: any) => ({ text: r.text || '', score: r.score || '0', color: r.color || 'gray' })), checklistName: clName, responsibility: q.responsibility || [], checklistId: clId, department: q.department || pageDept, isFollowUp: q.isFollowUp || false, category: q.category || sec.category || '' });
            }
          };
          (sec.questions || []).forEach((q: any) => addQ(q, sec.title || 'Section'));
          (sec.subSections || []).forEach((sub: any) => {
            (sub.questions || []).forEach((q: any) => addQ(q, `${sec.title || 'Section'} > ${sub.title || 'Sub'}`));
          });
        });
      });
    });
    return qs;
  }, [template, departmentLocations, isOldMergedQuestion]);

  const clTabQuestionTextRemap = useMemo<Record<string, string>>(() => {
    const remap: Record<string, string> = {};
    const textAliases: Record<string, string[]> = (template as any)?.questionTextAliases || {};
    Object.entries(textAliases).forEach(([newText, oldTexts]) => {
      const hasMultipleChildrenForSameParent = (oldTexts as string[]).some(oldText =>
        Object.entries(textAliases).filter(([k]) => k !== newText).some(([, v]) => (v as string[]).includes(oldText))
      );
      if (!hasMultipleChildrenForSameParent) {
        (oldTexts as string[]).forEach(oldText => {
          if (oldText && oldText !== newText) remap[oldText] = newText;
        });
      }
    });
    return remap;
  }, [template]);

  const clTabQuestionTextAliases = useMemo<Record<string, string[]>>(() => {
    const combined: Record<string, string[]> = {};
    const textAliases: Record<string, string[]> = (template as any)?.questionTextAliases || {};
    Object.entries(textAliases).forEach(([newText, oldTexts]) => {
      if (!combined[newText]) combined[newText] = [];
      (oldTexts as string[]).forEach(t => {
        if (t && t !== newText && !combined[newText].includes(t)) combined[newText].push(t);
      });
    });
    return combined;
  }, [template]);

  const remapKeysWithAliases = React.useCallback((data: Record<string, any>, idAliases?: Record<string, string[]>): Record<string, any> => {
    if (!idAliases || Object.keys(idAliases).length === 0) return data;
    const oldToNew: Record<string, string> = {};
    for (const [currentId, oldIds] of Object.entries(idAliases)) {
      for (const oldId of oldIds) {
        oldToNew[oldId] = currentId;
      }
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = oldToNew[key] || key;
      if (result[mappedKey] && typeof result[mappedKey] === 'object' && typeof value === 'object' && !Array.isArray(value)) {
        result[mappedKey] = { ...result[mappedKey], ...value };
      } else if (!result[mappedKey]) {
        result[mappedKey] = value;
      }
    }
    return result;
  }, []);

  useEffect(() => {
    if (registryObservations.length === 0) return;
    const regTags: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
    registryObservations.forEach(ro => {
      if (ro.managementTag && ['management-focus', 'easy-impactful', 'ongoing'].includes(ro.managementTag)) {
        regTags[ro.id] = ro.managementTag;
      }
    });
    if (Object.keys(regTags).length > 0) {
      setObsTags(prev => ({ ...prev, ...regTags }));
    }
  }, [registryObservations]);
  const [panelLiveDrafts, setPanelLiveDrafts] = useState<DraftEntry[]>([]);
  const [obsTags, setObsTags] = useState<Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'>>(() => {
    const initial: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
    if (comments) {
      for (const qComment of Object.values(comments)) {
        for (const entry of (qComment?.entries || [])) {
          if (entry.managementTag) initial[entry.id] = entry.managementTag;
        }
      }
    }
    return initial;
  });

  useEffect(() => {
    const commentTags: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
    for (const qComment of Object.values(comments)) {
      for (const entry of (qComment?.entries || [])) {
        if (entry.managementTag) commentTags[entry.id] = entry.managementTag;
      }
    }
    if (Object.keys(commentTags).length > 0) {
      setObsTags(prev => {
        const merged = { ...prev };
        let changed = false;
        for (const [id, tag] of Object.entries(commentTags)) {
          if (merged[id] !== tag) { merged[id] = tag; changed = true; }
        }
        return changed ? merged : prev;
      });
    }
  }, [comments]);

  useEffect(() => {
    if (panelLiveDrafts.length === 0) return;
    const draftTags: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
    for (const d of panelLiveDrafts) {
      if (d.managementTag) draftTags['DFT_' + d.id] = d.managementTag;
    }
    if (Object.keys(draftTags).length > 0) {
      setObsTags(prev => {
        const merged = { ...prev };
        let changed = false;
        for (const [id, tag] of Object.entries(draftTags)) {
          if (merged[id] !== tag) { merged[id] = tag; changed = true; }
        }
        return changed ? merged : prev;
      });
    }
  }, [panelLiveDrafts]);

  const toggleObsTag = (key: string, tag: 'management-focus' | 'easy-impactful' | 'ongoing') => {
    const isRemoving = obsTags[key] === tag;
    const newTag = isRemoving ? undefined : tag;
    setObsTags(prev => { const n = { ...prev }; if (n[key] === tag) { delete n[key]; } else { n[key] = tag; } return n; });
    let foundInComments = false;
    setComments(prev => {
      const next = { ...prev };
      for (const [qId, qComment] of Object.entries(next)) {
        const match = qComment?.entries?.find(e => e.id === key);
        if (match) {
          foundInComments = true;
          next[qId] = { entries: qComment.entries.map(e => e.id === key ? { ...e, managementTag: newTag } : e) };
          break;
        }
      }
      return next;
    });
    const isRegistryObs = registryObservations.some(ro => ro.id === key);
    if (isRegistryObs) {
      fetch('/api/observations/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, managementTag: newTag || null }),
      }).then(res => {
        if (res.ok) {
          setRegistryObservations(prev => prev.map(ro => ro.id === key ? { ...ro, managementTag: newTag } : ro));
        }
      }).catch(() => {});
    }
    const isDraftKey = key.startsWith('DFT_');
    if (isDraftKey) {
      const draftId = key.slice(4);
      setPanelLiveDrafts(prev => prev.map(d => d.id === draftId ? { ...d, managementTag: newTag } : d));
      try {
        const allLocal: DraftEntry[] = JSON.parse(localStorage.getItem('haccp_obs_live_drafts') || '[]');
        const updated = allLocal.map(d => d.id === draftId ? { ...d, managementTag: newTag } : d);
        localStorage.setItem('haccp_obs_live_drafts', JSON.stringify(updated));
      } catch {}
      if (navigator.onLine) {
        fetch('/api/draft-observations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draftId, checklistId: effectiveDraftChecklistId, unitId: auditUnitId || null, managementTag: newTag || null, createdAt: Date.now() }),
        }).catch(() => {});
      }
    }
  };
  const handleDeleteObs = async (questionId: string, entryId: string, savedToDb: boolean) => {
    const existing = comments[questionId];
    const newComments: CommentState = existing
      ? { ...comments, [questionId]: { entries: existing.entries.filter(e => e.id !== entryId) } }
      : comments;
    setComments(prev => {
      const latest = prev[questionId];
      if (!latest) return prev;
      return { ...prev, [questionId]: { entries: latest.entries.filter(e => e.id !== entryId) } };
    });
    setDeleteObsConfirm(null);
    try { saveDraftToStorage(storageKey, { ...draftSnapshotRef.current(), comments: newComments }); } catch {}
    try { await fetch(`/api/observations?id=${encodeURIComponent(entryId)}`, { method: 'DELETE' }); } catch {}
    fullRegistryObsFetchedRef.current = false;
    setFullRegistryRefreshKey(prev => prev + 1);
  };

  const handleDeleteSelectedObs = async (selectedIds: Set<string>) => {
    if (selectedIds.size === 0) return;
    setDeletingSelectedObs(true);
    const toDelete = liveObservations.filter(o => o.entryId && selectedIds.has(o.entryId));
    const newComments: CommentState = { ...comments };
    for (const obs of toDelete) {
      const existing = newComments[obs.questionId];
      if (existing) {
        newComments[obs.questionId] = { entries: existing.entries.filter(e => e.id !== obs.entryId) };
      }
    }
    setComments(prev => {
      const next = { ...prev };
      for (const obs of toDelete) {
        const existing = next[obs.questionId];
        if (existing) next[obs.questionId] = { entries: existing.entries.filter(e => e.id !== obs.entryId) };
      }
      return next;
    });
    setSelectedObsEntryIds(new Set());
    setObsMultiSelectMode(false);
    try { saveDraftToStorage(storageKey, { ...draftSnapshotRef.current(), comments: newComments }); } catch {}
    const dbIds = toDelete.map(o => o.entryId!).filter(Boolean);
    for (const id of dbIds) {
      try { await fetch(`/api/observations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
    }
    setDeletingSelectedObs(false);
    fullRegistryObsFetchedRef.current = false;
    setFullRegistryRefreshKey(prev => prev + 1);
  };

  const [obsTagFilter, setObsTagFilter] = useState<'all' | 'management-focus' | 'easy-impactful' | 'ongoing' | 'untagged'>('all');
  const [mgmtFocusResourceFilter, setMgmtFocusResourceFilter] = useState(false);
  const [editingDraftData, setEditingDraftData] = useState<{ id: string; commentText: string; commentImages: string[]; location: string; questionId: string; questionText: string; sectionTitle: string } | null>(null);
  const [draftBulkUploading, setDraftBulkUploading] = useState(false);
  const [syncingDraftIds, setSyncingDraftIds] = useState<Set<string>>(new Set());
  const [syncedImageDraftIds, setSyncedImageDraftIds] = useState<Set<string>>(new Set());
  const draftBulkInputRef = useRef<HTMLInputElement>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());

  const [facilityEvidence, setFacilityEvidence] = useState<Record<string, { id: string; data: string }[]>>({});
  const [facilityEvidencePreview, setFacilityEvidencePreview] = useState<string | null>(null);
  const [showFacilitySummary, setShowFacilitySummary] = useState<boolean | null>(null);
  const facilityCameraRef = useRef<HTMLInputElement>(null);
  const facilityGalleryRef = useRef<HTMLInputElement>(null);
  const [activeFacilityQId, setActiveFacilityQId] = useState<string | null>(null);

  const handleFacilityImageCapture = useCallback(async (questionId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          const imgId = `fev-${questionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          try {
            const { saveImageToStore } = await import('@/utils/draftImageStore');
            await saveImageToStore(`facility-${template.id}-${questionId}`, imgId, compressed);
          } catch {}
          setFacilityEvidence(prev => ({
            ...prev,
            [questionId]: [...(prev[questionId] || []), { id: imgId, data: compressed }],
          }));
        } catch {
          const raw = ev.target?.result as string;
          if (raw) {
            const fallbackId = `fev-${questionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            try {
              const { saveImageToStore } = await import('@/utils/draftImageStore');
              await saveImageToStore(`facility-${template.id}-${questionId}`, fallbackId, raw);
            } catch {}
            setFacilityEvidence(prev => ({
              ...prev,
              [questionId]: [...(prev[questionId] || []), { id: fallbackId, data: raw }],
            }));
          }
        }
      };
      reader.readAsDataURL(file);
    }
  }, [template.id]);

  const removeFacilityImage = useCallback((questionId: string, index: number) => {
    setFacilityEvidence(prev => {
      const imgs = [...(prev[questionId] || [])];
      const removed = imgs[index];
      if (removed?.id) {
        import('@/utils/draftImageStore').then(({ removeImageFromStore }) => {
          removeImageFromStore(removed.id).catch(() => {});
        }).catch(() => {});
      }
      imgs.splice(index, 1);
      return { ...prev, [questionId]: imgs };
    });
  }, []);

  useEffect(() => {
    if (!equipmentInfo) return;
    const allQIds: string[] = [];
    template.pages.forEach(page => page.sections?.forEach(sec => {
      sec.questions?.forEach(q => allQIds.push(q.id));
      sec.subSections?.forEach(ss => ss.questions?.forEach(q => allQIds.push(q.id)));
    }));
    if (allQIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { getImagesForDraft } = await import('@/utils/draftImageStore');
        const hydrated: Record<string, { id: string; data: string }[]> = {};
        for (const qId of allQIds) {
          const records = await getImagesForDraft(`facility-${template.id}-${qId}`);
          if (records.length > 0) {
            hydrated[qId] = records.map(r => ({ id: r.imageId, data: r.base64 }));
          }
        }
        if (!cancelled && Object.keys(hydrated).length > 0) {
          setFacilityEvidence(prev => {
            const merged = { ...prev };
            for (const [qId, imgs] of Object.entries(hydrated)) {
              if (!merged[qId] || merged[qId].length === 0) merged[qId] = imgs;
            }
            return merged;
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [equipmentInfo, template.id, template.pages]);

  type DraftEntry = { id: string; commentText: string; commentImages: string[]; location: string; questionId: string; questionText: string; sectionTitle: string; createdAt: number; isOfflineQueued?: boolean; unitId?: string; checklistId?: string; managementTag?: 'management-focus' | 'easy-impactful' | 'ongoing' };

  const effectiveDraftChecklistId = draftKey || template.id;

  const isDraftInScope = useCallback((d: DraftEntry): boolean => {
    const cMatch = effectiveDraftChecklistId ? (d.checklistId === effectiveDraftChecklistId) : !d.checklistId;
    const uMatch = auditUnitId ? (d.unitId === auditUnitId) : !d.unitId;
    return cMatch && uMatch;
  }, [effectiveDraftChecklistId, auditUnitId]);

  const readScopedLocalDrafts = useCallback((): DraftEntry[] => {
    try {
      const all: DraftEntry[] = JSON.parse(localStorage.getItem('haccp_obs_live_drafts') || '[]');
      return all.filter(isDraftInScope);
    } catch { return []; }
  }, [isDraftInScope]);

  const writeScopedLocalDrafts = useCallback((scopedDrafts: DraftEntry[]) => {
    try {
      const all: DraftEntry[] = JSON.parse(localStorage.getItem('haccp_obs_live_drafts') || '[]');
      const otherScope = all.filter(d => !isDraftInScope(d));
      const tagged = scopedDrafts.map(d => ({
        ...d,
        checklistId: effectiveDraftChecklistId || d.checklistId,
        unitId: auditUnitId || d.unitId,
      }));
      localStorage.setItem('haccp_obs_live_drafts', JSON.stringify([...otherScope, ...tagged]));
    } catch {}
  }, [effectiveDraftChecklistId, auditUnitId, isDraftInScope]);

  const hydrateDraftImages = useCallback(async (drafts: DraftEntry[]): Promise<DraftEntry[]> => {
    const { getImagesForDraft } = await import('@/utils/draftImageStore');
    const dedup = (arr: string[]) => {
      const seen = new Set<string>();
      return arr.filter(s => {
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });
    };
    return Promise.all(drafts.map(async d => {
      if (d.commentImages && d.commentImages.length > 0) return d;
      let hydrated = false;
      try {
        const imgs = await getImagesForDraft(d.id);
        if (imgs && imgs.length > 0) {
          const base64Array = imgs.map((img: any) => img.base64 || img.data || (typeof img === 'string' ? img : '')).filter((s: string) => s.length > 0);
          if (base64Array.length > 0) {
            hydrated = true;
            return { ...d, commentImages: dedup(base64Array) };
          }
        }
      } catch (e) {
        console.debug('IndexedDB hydration failed for draft', d.id, e);
      }
      if (!hydrated && navigator.onLine) {
        try {
          const res = await fetch(`/api/draft-images?draftId=${encodeURIComponent(d.id)}`);
          if (res.ok) {
            const images: { id: string; data: string }[] = await res.json();
            if (images && images.length > 0) {
              return { ...d, commentImages: dedup(images.map(img => img.data)) };
            }
          }
        } catch (e) {
          console.debug('API hydration failed for draft', d.id, e);
        }
      }
      return d;
    }));
  }, []);

  const loadAndMergeDrafts = useCallback(async (): Promise<DraftEntry[]> => {
    let localDrafts: DraftEntry[] = readScopedLocalDrafts();

    const draftsWithLocalImages = localDrafts.filter(d => d.commentImages && d.commentImages.length > 0);
    if (draftsWithLocalImages.length > 0) {
      try {
        const { saveImageToStore, generateImageId, getImagesForDraft } = await import('@/utils/draftImageStore');
        for (const d of draftsWithLocalImages) {
          const existing = await getImagesForDraft(d.id);
          if (existing.length === 0) {
            for (const img of d.commentImages) {
              await saveImageToStore(d.id, generateImageId(d.id), img);
            }
          }
        }
      } catch {}
    }

    let dbDrafts: DraftEntry[] = [];
    if (navigator.onLine) {
      try {
        const res = await fetch(`/api/draft-observations?checklistId=${encodeURIComponent(effectiveDraftChecklistId)}${auditUnitId ? `&unitId=${encodeURIComponent(auditUnitId)}` : ''}`);
        if (res.ok) {
          const raw: DraftEntry[] = await res.json();
          dbDrafts = raw.filter(isDraftInScope);
        }
      } catch {}
    }

    const dbIds = new Set(dbDrafts.map(d => d.id));
    const localOnly = localDrafts.filter(d => !dbIds.has(d.id));
    const allMerged = [...dbDrafts, ...localOnly];
    const hydratedAll = await hydrateDraftImages(allMerged);
    const merged = hydratedAll.filter(d => d.commentText || d.questionId || d.location || (d.commentImages && d.commentImages.length > 0));
    const blankIds = hydratedAll.filter(d => !d.commentText && !d.questionId && !d.location && (!d.commentImages || d.commentImages.length === 0)).map(d => d.id);
    if (blankIds.length > 0) {
      try { await deleteDraftFromDb(blankIds); } catch {}
    }

    const hydrated = merged;

    const metaOnly = hydrated.map(d => ({ ...d, commentImages: [] as string[] }));
    writeScopedLocalDrafts(metaOnly);

    if (navigator.onLine && localOnly.length > 0) {
      try {
        await fetch('/api/draft-observations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localOnly.map(d => ({
            id: d.id, checklistId: effectiveDraftChecklistId, unitId: auditUnitId || null,
            commentText: d.commentText, location: d.location,
            questionId: d.questionId, questionText: d.questionText,
            sectionTitle: d.sectionTitle, isOfflineQueued: d.isOfflineQueued || false,
            createdAt: d.createdAt, managementTag: d.managementTag || null,
          }))),
        });
      } catch {}
    }

    return hydrated;
  }, [effectiveDraftChecklistId, auditUnitId, hydrateDraftImages, readScopedLocalDrafts, writeScopedLocalDrafts, isDraftInScope]);

  const syncDraftToDb = useCallback(async (drafts: DraftEntry[]) => {
    if (!navigator.onLine || drafts.length === 0) return;
    try {
      await fetch('/api/draft-observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drafts.map(d => ({
          id: d.id, checklistId: effectiveDraftChecklistId, unitId: auditUnitId || null,
          commentText: d.commentText, location: d.location,
          questionId: d.questionId, questionText: d.questionText,
          sectionTitle: d.sectionTitle, isOfflineQueued: d.isOfflineQueued || false,
          createdAt: d.createdAt, managementTag: d.managementTag || null,
        }))),
      });
    } catch {}
  }, [template.id, auditUnitId]);

  const handleFloatingDraftSave = useCallback(async (drafts: DraftObservationPayload[]) => {
    const isOnline = navigator.onLine;
    const completeDrafts = drafts.filter(d => d.questionId && d.location);
    const incompleteDrafts = drafts.filter(d => !d.questionId || !d.location);

    const saveDraftBatch = async (entries: { id: string; commentText: string; commentImages: string[]; location: string; questionId: string; questionText: string; sectionTitle: string; createdAt: number; isOfflineQueued?: boolean }[], sourceObs: DraftObservationPayload[]) => {
      setPanelLiveDrafts(prev => {
        const draftKeys = new Set(entries.map(d => `${d.location}-${d.questionId}-${d.questionText}`));
        const otherDrafts = prev.filter(p => !draftKeys.has(`${p.location}-${p.questionId}-${p.questionText}`));
        const updated = [...otherDrafts, ...entries];
        const metaOnly = updated.map(d => ({ ...d, commentImages: [] as string[] }));
        writeScopedLocalDrafts(metaOnly);
        return updated;
      });
      try {
        const { saveImageToStore, generateImageId } = await import('@/utils/draftImageStore');
        for (let i = 0; i < sourceObs.length; i++) {
          const draft = sourceObs[i];
          const draftId = entries[i].id;
          for (const img of draft.images) {
            await saveImageToStore(draftId, generateImageId(draftId), img);
          }
        }
      } catch {}
      syncDraftToDb(entries);
    };

    const syncTagsForDrafts = (entries: { id: string; managementTag?: string }[]) => {
      const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
      for (const e of entries) {
        if (e.managementTag === 'management-focus' || e.managementTag === 'easy-impactful' || e.managementTag === 'ongoing') {
          tagUpdates['DFT_' + e.id] = e.managementTag;
        }
      }
      if (Object.keys(tagUpdates).length > 0) {
        setObsTags(prev => ({ ...prev, ...tagUpdates }));
      }
    };

    if (incompleteDrafts.length > 0) {
      const newPanelDrafts = incompleteDrafts.map(d => ({
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        commentText: d.observationText,
        commentImages: d.images,
        location: d.location || '',
        questionId: d.questionId || '',
        questionText: d.questionText || '',
        sectionTitle: d.sectionTitle || '',
        createdAt: Date.now(),
        managementTag: d.managementTag || undefined,
      }));
      syncTagsForDrafts(newPanelDrafts);
      await saveDraftBatch(newPanelDrafts, incompleteDrafts);
    }

    if (completeDrafts.length > 0 && !isOnline) {
      const offlineDrafts = completeDrafts.map(d => ({
        id: `draft-offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        commentText: d.observationText,
        commentImages: d.images,
        location: d.location,
        questionId: d.questionId,
        questionText: d.questionText || '',
        sectionTitle: d.sectionTitle || '',
        createdAt: Date.now(),
        isOfflineQueued: true as const,
        managementTag: d.managementTag || undefined,
      }));
      syncTagsForDrafts(offlineDrafts);
      await saveDraftBatch(offlineDrafts, completeDrafts);
    }

    if (completeDrafts.length > 0 && isOnline) {
      const completeDraftEntries = completeDrafts.map(d => ({
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        commentText: d.observationText,
        commentImages: d.images,
        location: d.location,
        questionId: d.questionId,
        questionText: d.questionText || '',
        sectionTitle: d.sectionTitle || '',
        createdAt: Date.now(),
        managementTag: d.managementTag || undefined,
      }));
      syncTagsForDrafts(completeDraftEntries);
      await saveDraftBatch(completeDraftEntries, completeDrafts);
    }
  }, [setPanelLiveDrafts, writeScopedLocalDrafts, syncDraftToDb, setObsTags]);

  const handleFloatingObsSave = useCallback((observations: ObservationPayload[]) => {
    setPanelLiveDrafts(prev => {
      const remaining = prev.filter(draft => {
        return !observations.some(obs =>
          obs.questionId === draft.questionId &&
          obs.location === draft.location
        );
      });
      const metaOnly = remaining.map(d => ({ ...d, commentImages: [] as string[] }));
      writeScopedLocalDrafts(metaOnly);
      return remaining;
    });
  }, [setPanelLiveDrafts, writeScopedLocalDrafts]);

  const deleteDraftFromDb = useCallback(async (draftIds: string[]) => {
    if (!navigator.onLine || draftIds.length === 0) return;
    try {
      await fetch('/api/draft-observations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: draftIds }),
      });
    } catch {}
  }, []);

  React.useEffect(() => {
    if (!showObservationPanel) return;
    const load = async () => {
      try {
        const hydrated = await loadAndMergeDrafts();
        setPanelLiveDrafts(hydrated);
        const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
        for (const d of hydrated) {
          if (d.managementTag === 'management-focus' || d.managementTag === 'easy-impactful' || d.managementTag === 'ongoing') {
            tagUpdates['DFT_' + d.id] = d.managementTag;
          }
        }
        if (Object.keys(tagUpdates).length > 0) {
          setObsTags(prev => ({ ...prev, ...tagUpdates }));
        }
      } catch { setPanelLiveDrafts([]); }
    };
    load();
  }, [showObservationPanel, loadAndMergeDrafts]);

  const [forceSyncing, setForceSyncing] = React.useState(false);
  const syncRunningRef = React.useRef(false);
  const syncDraftsAndImages = React.useCallback(async (isManual?: boolean) => {
    if (!navigator.onLine || syncRunningRef.current) return;
    syncRunningRef.current = true;
    if (isManual) setForceSyncing(true);
    try {
      const localDrafts: DraftEntry[] = readScopedLocalDrafts();
      if (localDrafts.length > 0) {
        try {
          await fetch('/api/draft-observations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localDrafts.map(d => ({
              id: d.id, checklistId: d.checklistId || effectiveDraftChecklistId, unitId: d.unitId || auditUnitId || null,
              commentText: d.commentText, location: d.location,
              questionId: d.questionId, questionText: d.questionText,
              sectionTitle: d.sectionTitle, isOfflineQueued: d.isOfflineQueued || false,
              createdAt: d.createdAt, managementTag: d.managementTag || null,
            }))),
          });
        } catch {}
      }
      const { getAllUnsyncedImages, removeImageFromStore } = await import('@/utils/draftImageStore');
      const unsynced = await getAllUnsyncedImages();
      if (unsynced.length > 0) {
        const syncedDraftSet = new Set<string>();
        for (const img of unsynced) {
          setSyncingDraftIds(prev => new Set([...prev, img.draftId]));
          try {
            const res = await fetch('/api/draft-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ draftId: img.draftId, imageBase64: img.base64 }),
            });
            if (res.ok) {
              await removeImageFromStore(img.imageId);
              syncedDraftSet.add(img.draftId);
            }
          } catch {}
        }
        const { getAllUnsyncedImages: checkRemaining } = await import('@/utils/draftImageStore');
        const remaining = await checkRemaining();
        const stillSyncingDrafts = new Set(remaining.map((r: { draftId: string }) => r.draftId));
        setSyncingDraftIds(new Set());
        setSyncedImageDraftIds(prev => {
          const n = new Set(prev);
          syncedDraftSet.forEach(draftId => { if (!stillSyncingDrafts.has(draftId)) n.add(draftId); });
          return n;
        });
      }
    } catch {}
    syncRunningRef.current = false;
    if (isManual) setForceSyncing(false);
  }, [template.id, auditUnitId, readScopedLocalDrafts]);

  React.useEffect(() => {
    const interval = setInterval(() => syncDraftsAndImages(), 5000);
    window.addEventListener('online', () => syncDraftsAndImages());
    return () => { clearInterval(interval); window.removeEventListener('online', () => syncDraftsAndImages()); };
  }, [syncDraftsAndImages]);

  React.useEffect(() => {
    const flushOfflineQueue = async () => {
      try {
        const stored = readScopedLocalDrafts();
        const queued = stored.filter(d => d.isOfflineQueued && d.location && d.questionId);
        if (queued.length === 0) return;
        const ts = new Date().toLocaleString();

        const { getImagesForDraft, clearDraftImages } = await import('@/utils/draftImageStore');

        const dedupArr = (arr: string[]) => [...new Set(arr)];
        const hydratedQueued = await Promise.all(queued.map(async d => {
          if (d.commentImages && d.commentImages.length > 0) return d;
          try {
            const imgs = await getImagesForDraft(d.id);
            if (imgs && imgs.length > 0) {
              return { ...d, commentImages: dedupArr(imgs.map((img: { base64: string }) => img.base64)) };
            }
          } catch {}
          return d;
        }));

        const grouped: Record<string, { text: string; images: string[]; location: string }[]> = {};
        for (const d of hydratedQueued) {
          if (!grouped[d.questionId]) grouped[d.questionId] = [];
          grouped[d.questionId].push({ text: d.commentText, images: d.commentImages, location: d.location });
        }
        setComments(prev => {
          const next = { ...prev };
          for (const [qId, entries] of Object.entries(grouped)) {
            const newEntries = entries.map(e => ({
              id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              text: e.text,
              images: [...e.images],
              closureEvidence: [] as string[],
              closureComments: '',
              timestamp: ts,
              createdAtMs: Date.now(),
              location: e.location || undefined,
              savedToDb: true,
            }));
            next[qId] = { entries: [...(next[qId]?.entries || []), ...newEntries] };
          }
          return next;
        });
        const remaining = stored.filter(d => !d.isOfflineQueued || !d.location || !d.questionId);
        const metaOnly = remaining.map(d => ({ ...d, commentImages: [] as string[] }));
        writeScopedLocalDrafts(metaOnly);
        const hydratedRemaining = await Promise.all(remaining.map(async d => {
          if (d.commentImages && d.commentImages.length > 0) return d;
          try { const imgs = await getImagesForDraft(d.id); return { ...d, commentImages: dedupArr(imgs.map((img: { base64: string }) => img.base64)) }; } catch { return d; }
        }));
        setPanelLiveDrafts(hydratedRemaining);
        try {
          await Promise.all(queued.map((d: { id: string }) => clearDraftImages(d.id)));
        } catch {}
        await deleteDraftFromDb(queued.map((d: { id: string }) => d.id));
      } catch {}
    };
    window.addEventListener('online', flushOfflineQueue);
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [deleteDraftFromDb, readScopedLocalDrafts, writeScopedLocalDrafts]);

  const [obsImagePreview, setObsImagePreview] = useState<string | null>(null);
  React.useEffect(() => {
    if (!obsImagePreview) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setObsImagePreview(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [obsImagePreview]);
  const [editingObservation, setEditingObservation] = useState<import('./AddObservationModal').EditObservationData | null>(null);
  const [repeatObsData, setRepeatObsData] = useState<import('./AddObservationModal').RepeatObservationData | null>(null);
  const fetchObsImages = useCallback(async (obsId: string, fallbackEvidence?: any[], fallbackThumb?: string): Promise<string[]> => {
    const extractImgs = (evidence: any[] | undefined, fallback?: string): string[] => {
      if (evidence && evidence.length > 0) {
        const urls = evidence.map((e: any) => typeof e === 'string' ? e : (e?.url || '')).filter((u: string) => u && u.length > 10);
        if (urls.length > 0) return urls;
      }
      return fallback && fallback.length > 10 ? [fallback] : [];
    };
    try {
      const res = await fetch(`/api/observations/${encodeURIComponent(obsId)}`);
      if (res.ok) {
        const full = await res.json();
        const imgs = extractImgs(full.allEvidence, full.thumbnail);
        if (imgs.length > 0) return imgs;
      }
    } catch {}
    return extractImgs(fallbackEvidence, fallbackThumb);
  }, []);

  const [locationTags, setLocationTags] = useState<Record<string, string>>(draft?.locationTags || {});
  const [lockedLocation, setLockedLocation] = useState<string | null>(draft?.lockedLocation ?? null);
  const [activeLocationTab, setActiveLocationTab] = useState<string | null>(draft?.activeLocationTab ?? null);
  const [locationApplicability, setLocationApplicability] = useState<Record<string, boolean>>(draft?.locationApplicability || {});
  const [openDeptKey, setOpenDeptKey] = useState<string | null>(null);
  const [openLocationKey, setOpenLocationKey] = useState<string | null>(null);
  const [openSectionKey, setOpenSectionKey] = useState<string | null>(null);
  const [openSubSectionKey, setOpenSubSectionKey] = useState<string | null>(null);
  const isLocationMode = useMemo(() => {
    if (!combinedLocations || combinedLocations.length === 0) return false;
    if (combinedLocations.some(loc => loc.includes(' › '))) return true;
    const templateDeptNames = template.pages.map(p => (p.title || '').trim().toLowerCase());
    if (combinedLocations.every(loc => templateDeptNames.includes(loc.trim().toLowerCase()))) return false;
    const deptKeys = Object.keys(departmentLocations || {});
    if (deptKeys.length > 0) {
      return combinedLocations.some(loc => !deptKeys.includes(loc.trim()));
    }
    return true;
  }, [combinedLocations, departmentLocations, template.pages]);

  const deptLocationOptions = useMemo(() => {
    const deptKeys = Object.keys(departmentLocations || {});
    if (combinedLocations && combinedLocations.length > 0) {
      const locs: string[] = [];
      const seen = new Set<string>();
      combinedLocations.forEach(loc => {
        if (loc.includes(' › ')) {
          // "Dept › Location" → extract the location part only
          const locPart = loc.split(' › ').slice(1).join(' › ').trim();
          if (locPart && !seen.has(locPart)) { seen.add(locPart); locs.push(locPart); }
        } else {
          const base = loc.trim();
          if (deptKeys.includes(base)) {
            (departmentLocations[base] || []).forEach((l: string) => { if (!seen.has(l)) { seen.add(l); locs.push(l); } });
          } else {
            if (!seen.has(base)) { seen.add(base); locs.push(base); }
          }
        }
      });
      if (locs.length > 0) return locs;
    }
    if (!departmentLocations || deptKeys.length === 0) return [];
    const allDeptNames = new Set<string>();
    if (auditLocationName) {
      auditLocationName.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((d: string) => allDeptNames.add(d));
    }
    if (allDeptNames.size === 0) {
      deptKeys.forEach(d => allDeptNames.add(d));
    }
    if (allDeptNames.size === 0) return [];
    const locs: string[] = [];
    const seen = new Set<string>();
    allDeptNames.forEach(dept => {
      (departmentLocations[dept] || []).forEach((loc: string) => { if (!seen.has(loc)) { seen.add(loc); locs.push(loc); } });
    });
    return locs;
  }, [auditLocationName, combinedLocations, departmentLocations]);
  const isDeptLevelAudit = useMemo(() => deptLocationOptions.length > 0, [deptLocationOptions]);

  const locationVirtualPages = useMemo(() => {
    if (!isLocationMode || !combinedLocations || combinedLocations.length === 0) return null;
    return combinedLocations.map(loc => {
      const locationName = loc.includes(' › ') ? loc.split(' › ').slice(1).join(' › ').trim() : loc;
      const deptName = loc.includes(' › ') ? loc.split(' › ')[0].trim() : loc.trim();
      const prefix = loc.replace(/[^a-zA-Z0-9]/g, '_') + '::';
      const deptPages = template.pages.filter(page =>
        (page.title || '').trim().toLowerCase() === deptName.toLowerCase()
      );
      const pagesToUse = deptPages.length > 0 ? deptPages : template.pages;
      return {
        locationName,
        pages: pagesToUse.map(page => ({
          ...page,
          id: `${prefix}${page.id}`,
          sections: page.sections.map(sec => ({
            ...sec,
            id: `${prefix}${sec.id}`,
            subSections: (sec.subSections || []).map(ss => ({
              ...ss,
              id: `${prefix}${ss.id}`,
              questions: (ss.questions || []).map(q => ({ ...q, id: `${prefix}${q.id}` }))
            })),
            questions: sec.questions.map(q => ({ ...q, id: `${prefix}${q.id}` }))
          }))
        }))
      };
    });
  }, [isLocationMode, combinedLocations, template.pages]);

  const locationGroupedByDept = useMemo(() => {
    if (!locationVirtualPages || !combinedLocations) return null;
    const groups: { deptName: string; items: { locationName: string; pages: any[] }[] }[] = [];
    const seen = new Map<string, number>();
    combinedLocations.forEach((loc, idx) => {
      const item = locationVirtualPages[idx];
      if (!item) return;
      const deptName = loc.includes(' › ') ? loc.split(' › ')[0].trim() : loc.trim();
      if (seen.has(deptName)) {
        groups[seen.get(deptName)!].items.push(item);
      } else {
        seen.set(deptName, groups.length);
        groups.push({ deptName, items: [item] });
      }
    });
    return groups.length > 0 ? groups : null;
  }, [locationVirtualPages, combinedLocations, auditLocationName]);

  const [notesOpen, setNotesOpen] = useState(false);
  const [notesBestPractice, setNotesBestPractice] = useState(draft ? draft.notesBestPractice : '');
  const [notesOpportunity, setNotesOpportunity] = useState(draft ? draft.notesOpportunity : '');
  const [notesBPImages, setNotesBPImages] = useState<string[]>(draft?.notesBPImages || draft?.savedNotes?.bestPracticeImages || []);
  const [notesOFIImages, setNotesOFIImages] = useState<string[]>(draft?.notesOFIImages || draft?.savedNotes?.opportunityImages || []);
  const [notesBPCollapsed, setNotesBPCollapsed] = useState(false);
  const [notesOFICollapsed, setNotesOFICollapsed] = useState(false);
  const [savedNotes, setSavedNotes] = useState<{ bestPractice: string; opportunity: string; bestPracticeImages?: string[]; opportunityImages?: string[] }>(draft ? draft.savedNotes : { bestPractice: '', opportunity: '', bestPracticeImages: [], opportunityImages: [] });
  const notesBPCameraRef = useRef<HTMLInputElement>(null);
  const notesBPGalleryRef = useRef<HTMLInputElement>(null);
  const notesOFICameraRef = useRef<HTMLInputElement>(null);
  const notesOFIGalleryRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline' | 'pending' | 'idle'>('idle');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastDbSyncAt, setLastDbSyncAt] = useState<number | null>(null);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [showUnsyncWarning, setShowUnsyncWarning] = useState<null | 'close' | 'save' | 'sign'>(null);

  const [auditSignature, setAuditSignature] = useState<string>(draft?.auditSignature || '');
  const [reviewerSignature, setReviewerSignature] = useState<string>(draft?.reviewerSignature || '');
  const [reviewerName, setReviewerName] = useState<string>(draft?.reviewerName || '');
  const hadReviewerSignature = useRef(!!draft?.reviewerSignature);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showExcelImporter, setShowExcelImporter] = useState(false);
  const [showPreviousReports, setShowPreviousReports] = useState(false);
  const [previousReports, setPreviousReports] = useState<{ id: string; data: AuditDraft; updatedAt?: string }[]>([]);
  const [loadingPreviousReports, setLoadingPreviousReports] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [prevReportDownloading, setPrevReportDownloading] = useState<string | null>(null);
  const _savedStateRef = useRef<{ answers: AnswerState; comments: CommentState; applicability: ApplicabilityState; unitForm: UnitDetailsForm; savedNotes: typeof savedNotes; auditSig: string; reviewerSig: string; reviewerNm: string } | null>(null);
  const _pendingPrevPdfRef = useRef<{ type: 'consolidated' | 'department'; deptName?: string } | null>(null);

  const [_prevPdfTrigger, _setPrevPdfTrigger] = useState(0);

  const downloadPreviousReport = useCallback((reportData: AuditDraft, mode: 'consolidated' | 'department' = 'consolidated', deptName?: string) => {
    _savedStateRef.current = {
      answers: { ...answers },
      comments: { ...comments },
      applicability: { ...applicability },
      unitForm: { ...unitForm },
      savedNotes: { ...savedNotes },
      auditSig: auditSignature,
      reviewerSig: reviewerSignature,
      reviewerNm: reviewerName,
    };
    const idAliases = (template as any).questionIdAliases as Record<string, string[]> | undefined;
    setAnswers(remapKeysWithAliases(reportData.answers || {}, idAliases));
    setComments(remapKeysWithAliases(reportData.comments || {}, idAliases));
    setApplicability(remapKeysWithAliases(reportData.applicability || {}, idAliases));
    setUnitForm(reportData.unitForm || unitForm);
    setSavedNotes(reportData.savedNotes || { bestPractice: '', opportunity: '' });
    setAuditSignature(reportData.auditSignature || '');
    setReviewerSignature(reportData.reviewerSignature || '');
    setReviewerName(reportData.reviewerName || '');
    _pendingPrevPdfRef.current = { type: mode, deptName };
    _setPrevPdfTrigger(t => t + 1);
  }, [answers, comments, applicability, unitForm, savedNotes, auditSignature, reviewerSignature, reviewerName, template, remapKeysWithAliases]);

  useEffect(() => {
    if (_prevPdfTrigger === 0 || !_pendingPrevPdfRef.current) return;
    const pending = _pendingPrevPdfRef.current;
    _pendingPrevPdfRef.current = null;
    const timer = setTimeout(async () => {
      try {
        if (pending.type === 'department' && pending.deptName) {
          const safeDeptName = pending.deptName.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeDeptName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
          await generateAuditReport({ filterPageTitles: [pending.deptName], fileNameOverride: fileName, reportSubtitle: `Department: ${pending.deptName}` });
        } else {
          await generateAuditReport();
        }
      } finally {
        if (_savedStateRef.current) {
          const savedComments = _savedStateRef.current.comments;
          setAnswers(_savedStateRef.current.answers);
          setComments(prev => {
            const merged = { ...savedComments };
            for (const [qId, qComment] of Object.entries(prev)) {
              if (!qComment?.entries?.length) continue;
              const savedEntries = merged[qId]?.entries || [];
              const savedIds = new Set(savedEntries.map(e => e.id));
              const newEntries = qComment.entries.filter(e => !savedIds.has(e.id));
              if (newEntries.length > 0) {
                merged[qId] = { entries: [...savedEntries, ...newEntries] };
              } else if (!merged[qId]) {
                merged[qId] = qComment;
              }
            }
            return merged;
          });
          setApplicability(_savedStateRef.current.applicability);
          setUnitForm(_savedStateRef.current.unitForm);
          setSavedNotes(_savedStateRef.current.savedNotes);
          setAuditSignature(_savedStateRef.current.auditSig);
          setReviewerSignature(_savedStateRef.current.reviewerSig);
          setReviewerName(_savedStateRef.current.reviewerNm);
          _savedStateRef.current = null;
        }
        setPrevReportDownloading(null);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [_prevPdfTrigger]);

  const auditorSigCanvasRef = useRef<HTMLCanvasElement>(null);
  const reviewerSigCanvasRef = useRef<HTMLCanvasElement>(null);

  const [auditState, setAuditState] = useState<'idle' | 'running' | 'paused' | 'completed' | 'draft' | 'submitted'>(draft ? 'draft' : 'idle');
  const [auditStartTime, setAuditStartTime] = useState<number | null>(draft ? draft.auditStartTime : null);
  const [totalPauseDuration, setTotalPauseDuration] = useState(draft ? draft.totalPauseDuration : 0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [timerDisplay, setTimerDisplay] = useState({ active: '00:00:00', pause: '00:00:00', total: '00:00:00' });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasRestoredScroll = useRef(false);
  const submittedResultRef = useRef<AuditCloseResult | null>(null);

  const [questionHistoryMap, setQuestionHistoryMap] = useState<Record<string, AuditHistoryRecord[]>>({});
  useEffect(() => {
    let cancelled = false;
    const deferredId = setTimeout(() => {
    const extractBaseQId = (qId: string) => qId.includes('::') ? qId.split('::').pop()! : qId;
    const addRecord = (map: Record<string, AuditHistoryRecord[]>, qId: string, record: AuditHistoryRecord) => {
      if (!map[qId]) map[qId] = [];
      const isDup = map[qId].some(r => r.auditId === record.auditId && r.answer === record.answer);
      if (!isDup) map[qId].push(record);
      const baseId = extractBaseQId(qId);
      if (baseId !== qId) {
        if (!map[baseId]) map[baseId] = [];
        const isDupBase = map[baseId].some(r => r.auditId === record.auditId && r.answer === record.answer);
        if (!isDupBase) map[baseId].push(record);
      }
    };
    (async () => {
      try {
        const [tasksRes, reportsRes] = await Promise.all([
          fetch('/api/audit-tasks'),
          fetch(`/api/audit-reports?checklist=${encodeURIComponent(template.id)}&type=report&limit=10${auditUnitName ? `&unit=${encodeURIComponent(auditUnitName)}` : ''}`),
        ]);
        if (cancelled) return;
        const tasks: import('../types').AuditTask[] = tasksRes.ok ? await tasksRes.json() : [];
        const reportRows: { id: string; type: string; data: any }[] = reportsRes.ok ? await reportsRes.json() : [];
        const deptParts = auditLocationName ? auditLocationName.split(/[,›]/).map(s => s.trim().toLowerCase()).filter(Boolean) : [];
        const deptMatches = (taskDept: string) => {
          if (!auditLocationName || !taskDept) return true;
          const td = taskDept.toLowerCase();
          return deptParts.some(dp => td.includes(dp));
        };
        const completed = tasks.filter(t => {
          if ((t.status !== 'Completed' && t.status !== 'Released') || t.checklistId !== template.id) return false;
          if (auditUnitId && t.unitId && t.unitId !== auditUnitId) return false;
          if (!deptMatches(t.department || '')) return false;
          return true;
        }).sort((a, b) => new Date(b.scheduledDate || b.endTime || 0).getTime() - new Date(a.scheduledDate || a.endTime || 0).getTime()).slice(0, 10);
        if (cancelled) return;
        const map: Record<string, AuditHistoryRecord[]> = {};
        const processedTaskIds = new Set<string>();
        completed.forEach(task => {
          processedTaskIds.add(task.id);
          const taskDate = new Date(task.endTime || task.scheduledDate);
          const dateStr = taskDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
          const obsMap = new Map<string, import('../types').AuditObservation>();
          task.observations?.forEach(obs => obsMap.set(obs.questionId, obs));
          const hasTaskData = (task.questions && task.questions.length > 0) || (task.observations && task.observations.length > 0);
          if (hasTaskData) {
            const questionItems = task.questions && task.questions.length > 0
              ? task.questions
              : task.observations?.map(obs => ({ id: obs.questionId, text: obs.questionText, clause: '', response: obs.selectedResponse, findings: obs.comment, evidenceUrls: obs.images })) || [];
            questionItems.forEach(q => {
              const obs = obsMap.get(q.id) || obsMap.get(extractBaseQId(q.id));
              const response = obs?.selectedResponse || q.response || '';
              const rLower = response.toLowerCase().trim();
              const isNA = rLower === 'na' || rLower === 'n/a' || rLower === 'not applicable';
              const isYes = !isNA && (rLower === 'yes' || rLower.includes('yes') || rLower === 'compliant');
              const isNo = !isNA && (rLower === 'no' || rLower.includes('no') || rLower === 'non-compliant');
              const status: AuditHistoryRecord['status'] = isNA ? 'na' : isNo ? 'non-compliant' : isYes ? 'compliant' : (response ? 'partial' : 'na');
              const score = obs ? obs.marksObtained : 0;
              const maxScore = obs ? obs.marksMax : 0;
              const images: string[] = [...(q.evidenceUrls || []), ...(obs?.images || [])];
              const uniqueImages = [...new Set(images)];
              const commentEntries: { text: string; author: string; timestamp: string; images: string[] }[] = [];
              if (obs?.comment) {
                commentEntries.push({ text: obs.comment, author: task.auditorName || 'Auditor', timestamp: dateStr, images: obs.images || [] });
              } else if (q.findings) {
                commentEntries.push({ text: q.findings, author: task.auditorName || 'Auditor', timestamp: dateStr, images: q.evidenceUrls || [] });
              }
              const record: AuditHistoryRecord = {
                auditId: task.id, date: dateStr, answer: response || '--', score, maxScore, status,
                closureStatus: obs?.closureStatus || undefined, auditor: task.auditorName || 'Unknown',
                image: uniqueImages[0], comments: commentEntries, images: uniqueImages,
              };
              addRecord(map, q.id, record);
            });
          }
        });
        reportRows.forEach(row => {
          if (processedTaskIds.has(row.id) && completed.find(t => t.id === row.id && ((t.questions?.length || 0) > 0 || (t.observations?.length || 0) > 0))) return;
          const d = row.data;
          if (!d || !d.answers) return;
          if (auditUnitId && d.unitId && d.unitId !== auditUnitId) return;
          if (auditUnitName && d.unitName && d.unitName !== auditUnitName) return;
          const matchedTask = completed.find(t => t.id === row.id);
          const taskDate = matchedTask ? new Date(matchedTask.endTime || matchedTask.scheduledDate) : new Date(d.timestamp || Date.now());
          const dateStr = taskDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
          const auditorName = matchedTask?.auditorName || d.unitForm?.repName || 'Auditor';
          Object.entries(d.answers as Record<string, any>).forEach(([qId, ans]: [string, any]) => {
            if (!ans || ans.selectedIndex == null || ans.selectedIndex < 0) return;
            const response = ans.selectedLabel || '';
            const rLower = response.toLowerCase().trim();
            const isNA = rLower === 'na' || rLower === 'n/a' || rLower === 'not applicable';
            const isYes = !isNA && (rLower === 'yes' || rLower.includes('yes') || rLower === 'compliant');
            const isNo = !isNA && (rLower === 'no' || rLower.includes('no') || rLower === 'non-compliant');
            const status: AuditHistoryRecord['status'] = isNA ? 'na' : isNo ? 'non-compliant' : isYes ? 'compliant' : (response ? 'partial' : 'na');
            const commentState = d.comments?.[qId];
            const commentEntries: { text: string; author: string; timestamp: string; images: string[] }[] = [];
            const images: string[] = [];
            if (commentState?.entries) {
              commentState.entries.forEach((e: any) => {
                if (e.text) commentEntries.push({ text: e.text, author: auditorName, timestamp: dateStr, images: e.images || [] });
                if (e.images) images.push(...e.images);
              });
            }
            const record: AuditHistoryRecord = {
              auditId: row.id, date: dateStr, answer: response || '--', score: ans.marks || 0, maxScore: ans.maxMarks || 0,
              status, auditor: auditorName, image: images[0], comments: commentEntries, images: [...new Set(images)],
            };
            addRecord(map, qId, record);
          });
        });
        if (!cancelled) {
          if (template.questionIdAliases) {
            const aliases = template.questionIdAliases;
            for (const [currentId, oldIds] of Object.entries(aliases)) {
              if (!map[currentId]) map[currentId] = [];
              for (const oldId of oldIds) {
                if (map[oldId]) {
                  map[currentId].push(...map[oldId]);
                }
              }
            }
          }
          const txtAliases: Record<string, string[]> = (template as any).questionTextAliases || {};
          if (Object.keys(txtAliases).length > 0) {
            const allCurrentQIds = new Map<string, string>();
            template.pages.forEach(pg => {
              pg.sections.forEach(sec => {
                (sec.questions || []).forEach(q => allCurrentQIds.set(q.text.toLowerCase().trim(), q.id));
                (sec.subSections || []).forEach(ss => {
                  (ss.questions || []).forEach(q => allCurrentQIds.set(q.text.toLowerCase().trim(), q.id));
                });
              });
            });
            const textToQIdMap = new Map<string, string>();
            Object.entries(txtAliases).forEach(([newText, oldTexts]) => {
              const currentQId = allCurrentQIds.get(newText.toLowerCase().trim());
              if (currentQId) {
                (oldTexts as string[]).forEach(oldText => {
                  textToQIdMap.set(oldText.toLowerCase().trim(), currentQId);
                });
              }
            });
            completed.forEach(task => {
              const questionItems = (task.questions && task.questions.length > 0)
                ? task.questions
                : (task.observations || []).map(obs => ({ id: obs.questionId, text: obs.questionText, clause: '', response: obs.selectedResponse, findings: obs.comment, evidenceUrls: obs.images }));
              questionItems.forEach(q => {
                const qTextKey = (q.text || '').toLowerCase().trim();
                const mappedQId = textToQIdMap.get(qTextKey);
                if (mappedQId && map[q.id] && !map[mappedQId]?.some(r => map[q.id].some(qr => qr.auditId === r.auditId))) {
                  if (!map[mappedQId]) map[mappedQId] = [];
                  map[mappedQId].push(...map[q.id]);
                }
              });
            });
          }
          const parseDateStr = (d: string) => {
            const parts = d.split(' ');
            if (parts.length === 3) {
              const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
              return new Date(2000 + parseInt(parts[2]), months[parts[1]] || 0, parseInt(parts[0])).getTime();
            }
            return 0;
          };
          for (const qId of Object.keys(map)) {
            map[qId].sort((a, b) => parseDateStr(b.date) - parseDateStr(a.date));
            map[qId] = map[qId].slice(0, 5);
          }
          setQuestionHistoryMap(map);
        }
      } catch {}
    })();
    }, 2000);
    return () => { cancelled = true; clearTimeout(deferredId); };
  }, [template.id, auditUnitId, auditLocationName]);

  const buildDraftSnapshot = useCallback((): AuditDraft => ({
    templateId: template.id,
    checklistId: template.id,
    currentStep,
    unitForm,
    answers,
    comments,
    applicability,
    pageApplicability,
    savedNotes,
    notesBestPractice,
    notesOpportunity,
    notesBPImages,
    notesOFIImages,
    auditState: auditState === 'running' || auditState === 'paused' ? 'draft' : auditState,
    auditStartTime,
    totalPauseDuration,
    savedAt: Date.now(),
    auditSignature,
    reviewerSignature,
    reviewerName,
    locationTags,
    scrollY: scrollRef.current?.scrollTop ?? 0,
    activeHeaderId,
    lockedLocation,
    activeLocationTab,
    locationApplicability,
    checklistName: template.title || '',
    unitName: auditUnitName || '',
    ...(equipmentInfo?.equipmentId ? {
      equipmentId: equipmentInfo.equipmentId,
      scanType: equipmentInfo.type,
    } : {}),
  }), [template.id, template.title, currentStep, unitForm, answers, comments, applicability, pageApplicability, savedNotes, notesBestPractice, notesOpportunity, notesBPImages, notesOFIImages, auditState, auditStartTime, totalPauseDuration, auditSignature, reviewerSignature, reviewerName, locationTags, activeHeaderId, lockedLocation, activeLocationTab, locationApplicability, auditUnitName, equipmentInfo]);

  const draftSnapshotRef = useRef(buildDraftSnapshot);
  useEffect(() => { draftSnapshotRef.current = buildDraftSnapshot; }, [buildDraftSnapshot]);

  useEffect(() => {
    if (trialMode || loadingFromDb) return;
    if (auditState === 'submitted') return;
    const hasProgress = Object.keys(answers).some(k => answers[k].selectedIndex !== null);
    const hasComments = Object.values(comments).some(c => c?.entries && c.entries.length > 0);
    if (!hasProgress && !hasComments && auditState === 'idle') return;
    const timer = setTimeout(() => {
      saveDraftToStorage(storageKey, buildDraftSnapshot());
      setLastSavedAt(Date.now());
    }, 500);
    return () => clearTimeout(timer);
  }, [answers, comments, unitForm, applicability, pageApplicability, savedNotes, notesBestPractice, notesOpportunity, notesBPImages, notesOFIImages, auditState, storageKey, buildDraftSnapshot, trialMode, locationTags, loadingFromDb]);

  useEffect(() => {
    if (trialMode) return;
    const emergencySave = () => {
      if (auditState !== 'submitted') {
        const snap = draftSnapshotRef.current();
        const hasProgress = Object.keys(snap.answers).some(k => snap.answers[k].selectedIndex !== null);
        const hasComments = Object.values(snap.comments || {}).some((c: any) => c?.entries && c.entries.length > 0);
        if (hasProgress || hasComments || snap.auditState !== 'idle') {
          saveDraftToStorage(storageKey, snap);
        }
      }
      flushAuditReportsToDb();
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      emergencySave();
      if (auditState === 'running' || auditState === 'paused' || showSignatureModal) {
        e.preventDefault();
        e.returnValue = 'You have an active audit in progress. Are you sure you want to leave?';
      }
    };
    const handleVisibilityChange = () => { if (document.visibilityState === 'hidden') emergencySave(); };
    const handlePageHide = () => emergencySave();
    const handlePopState = () => emergencySave();
    const periodicSync = setInterval(() => {
      if (auditState !== 'submitted') {
        const snap = draftSnapshotRef.current();
        const hasProgress = Object.keys(snap.answers).some(k => snap.answers[k].selectedIndex !== null);
        const hasComments = Object.values(snap.comments || {}).some((c: any) => c?.entries && c.entries.length > 0);
        if (hasProgress || hasComments || snap.auditState !== 'idle') {
          saveDraftToStorage(storageKey, snap);
          if (_dbSaveQueue.length > 0) _flushDbSaveQueue();
        }
      }
    }, 30000);
    const handleOnline = () => { _syncPendingQueue(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('popstate', handlePopState);
    return () => {
      emergencySave();
      clearInterval(periodicSync);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [storageKey, auditState, trialMode, showSignatureModal]);

  useEffect(() => {
    if (hasRestoredScroll.current) return;
    if (!draft?.scrollY || draft.scrollY <= 0) { hasRestoredScroll.current = true; return; }
    const savedY = draft.scrollY;
    const tryRestore = (attempts: number) => {
      if (!scrollRef.current || attempts <= 0) { hasRestoredScroll.current = true; return; }
      const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
      if (maxScroll > 0) {
        scrollRef.current.scrollTo({ top: Math.min(savedY, maxScroll), behavior: 'auto' });
        hasRestoredScroll.current = true;
      } else {
        setTimeout(() => tryRestore(attempts - 1), 300);
      }
    };
    setTimeout(() => tryRestore(15), 400);
  }, [draft]);

  useEffect(() => {
    if (trialMode) return;
    const el = scrollRef.current;
    if (!el) return;
    let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        if (auditState === 'submitted') return;
        if (!hasRestoredScroll.current) return;
        const snap = draftSnapshotRef.current();
        const hasProgress = Object.keys(snap.answers).some(k => snap.answers[k].selectedIndex !== null);
        if (hasProgress || snap.auditState !== 'idle') {
          saveDraftToStorage(storageKey, snap);
        }
      }, 3000);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
    };
  }, [storageKey, auditState, trialMode]);


  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      _syncPendingQueue();
      if (_dbSaveQueue.length > 0) _flushDbSaveQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };
    const syncListener = (status: 'syncing' | 'synced' | 'offline' | 'pending') => {
      setSyncStatus(status);
      if (status === 'synced') setLastSavedAt(Date.now());
    };
    const dbSyncListener = () => { setLastDbSyncAt(Date.now()); };
    _syncListeners.push(syncListener);
    _dbSyncListeners.push(dbSyncListener);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) {
      const pending = _getPendingFromLocal();
      if (pending.length > 0) _syncPendingQueue();
    } else {
      setSyncStatus('offline');
    }
    return () => {
      _syncListeners = _syncListeners.filter(fn => fn !== syncListener);
      const idx = _dbSyncListeners.indexOf(dbSyncListener);
      if (idx >= 0) _dbSyncListeners.splice(idx, 1);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const restoreFromDraft = React.useCallback((dbDraft: AuditDraft) => {
    const step = dbDraft.currentStep === 'questions' ? 'checklist' : (dbDraft.currentStep || 'unit-details');
    setCurrentStep(step as 'unit-details' | 'checklist');
    setUnitForm(dbDraft.unitForm || {
      companyName: '', repName: '', address: '', contact: '',
      email: '', manday: '', scope: '', dateFrom: '', dateTo: '', geotag: '', startTime: '',
    });
    const idAliases = (template as any).questionIdAliases as Record<string, string[]> | undefined;
    setAnswers(remapKeysWithAliases(dbDraft.answers || {}, idAliases));
    setComments(remapKeysWithAliases(dbDraft.comments || {}, idAliases));
    setApplicability(remapKeysWithAliases(dbDraft.applicability || {}, idAliases));
    setPageApplicability(dbDraft.pageApplicability || {});
    setActiveHeaderId(dbDraft.activeHeaderId ?? null);
    setLocationTags(dbDraft.locationTags || {});
    setLockedLocation(dbDraft.lockedLocation ?? null);
    setActiveLocationTab(dbDraft.activeLocationTab ?? null);
    setLocationApplicability(dbDraft.locationApplicability || {});
    setNotesBestPractice(dbDraft.notesBestPractice || '');
    setNotesOpportunity(dbDraft.notesOpportunity || '');
    setNotesBPImages(dbDraft.notesBPImages || dbDraft.savedNotes?.bestPracticeImages || []);
    setNotesOFIImages(dbDraft.notesOFIImages || dbDraft.savedNotes?.opportunityImages || []);
    setSavedNotes(dbDraft.savedNotes || { bestPractice: '', opportunity: '', bestPracticeImages: [], opportunityImages: [] });
    setAuditSignature(dbDraft.auditSignature || '');
    setReviewerSignature(dbDraft.reviewerSignature || '');
    setReviewerName(dbDraft.reviewerName || '');
    const restoredState = dbDraft.auditState === 'running' || dbDraft.auditState === 'paused' ? 'draft' : dbDraft.auditState;
    setAuditState(restoredState || 'idle');
    setAuditStartTime(dbDraft.auditStartTime ?? null);
    setTotalPauseDuration(dbDraft.totalPauseDuration || 0);
    existingDraft.current = dbDraft;
    hasRestoredScroll.current = false;
  }, [template, remapKeysWithAliases]);

  useEffect(() => {
    if (draft) {
      setDraftRestored(true);
      setLoadingFromDb(false);
      const timer = setTimeout(() => setShowDraftBanner(false), 5000);
      (async () => {
        try {
          let dbDraft = await loadDraftFromDb(storageKey);
          if (!dbDraft) dbDraft = await loadReportFromDb(reportKey);
          if (!dbDraft) return;
          const localSavedAt = draft.savedAt || 0;
          const dbSavedAt = dbDraft.savedAt || 0;
          const localAnswerCount = Object.keys(draft.answers || {}).length;
          const dbAnswerCount = Object.keys(dbDraft.answers || {}).length;
          if (dbAnswerCount > localAnswerCount && (dbSavedAt >= localSavedAt || dbAnswerCount > localAnswerCount * 1.5)) {
            restoreFromDraft(dbDraft);
            saveDraftToStorage(storageKey, dbDraft);
          }
        } catch (err) {
          console.error('[audit] DB sync-check failed:', err);
        } finally {
          dbSyncCheckDone.current = true;
        }
      })();
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (draft || trialMode) { setLoadingFromDb(false); return; }
    let cancelled = false;
    let bannerTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        let dbDraft = await loadDraftFromDb(storageKey);
        if (!dbDraft) dbDraft = await loadReportFromDb(reportKey);
        if (cancelled || !dbDraft) { if (!cancelled) setLoadingFromDb(false); return; }
        restoreFromDraft(dbDraft);
        setDraftRestored(true);
        setShowDraftBanner(true);
        bannerTimer = setTimeout(() => setShowDraftBanner(false), 5000);
      } catch (err) {
        console.error('[audit] DB fallback load failed:', err);
      } finally {
        if (!cancelled) setLoadingFromDb(false);
      }
    })();
    return () => { cancelled = true; if (bannerTimer) clearTimeout(bannerTimer); };
  }, []);

  useEffect(() => {
    if (!draft && !loadingFromDb) {
      const initApplicability: ApplicabilityState = {};
      template.pages.forEach(page => {
        page.sections.forEach(section => {
          initApplicability[section.id] = section.isApplicable !== false;
          (section.subSections || []).forEach(ss => {
            initApplicability[ss.id] = true;
          });
        });
      });
      if (Object.keys(applicability).length === 0) setApplicability(initApplicability);
    }
  }, [template, loadingFromDb]);

  useEffect(() => {
    if (auditState === 'running' || auditState === 'paused') {
      timerRef.current = setInterval(() => {
        if (!auditStartTime) return;
        const now = Date.now();
        const totalDuration = now - auditStartTime;
        let currentPauseDur = 0;
        if (auditState === 'paused' && pauseStartTime) currentPauseDur = now - pauseStartTime;
        const currentTotalPause = totalPauseDuration + currentPauseDur;
        const activeDuration = totalDuration - currentTotalPause;
        setTimerDisplay({ active: formatTime(activeDuration), pause: formatTime(currentTotalPause), total: formatTime(totalDuration) });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auditState, auditStartTime, totalPauseDuration, pauseStartTime]);

  useEffect(() => {
    if (autoTriggerExcelDownload && !loadingFromDb) {
      const timer = setTimeout(() => {
        exportQuestionsToExcel('department').finally(() => onClose());
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerExcelDownload, loadingFromDb]);

  useEffect(() => {
    if (autoTriggerExcelLocationDownload && !loadingFromDb) {
      const timer = setTimeout(() => {
        exportQuestionsToExcel('location').finally(() => onClose());
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerExcelLocationDownload, loadingFromDb]);

  const updateUnit = (field: keyof UnitDetailsForm, value: string) => setUnitForm(prev => ({ ...prev, [field]: value }));

  const handleStartAudit = () => {
    const now = Date.now();
    setAuditStartTime(now);
    updateUnit('startTime', new Date(now).toLocaleString());
    setAuditState('running');
  };

  const handlePauseAudit = () => { setPauseStartTime(Date.now()); setAuditState('paused'); };
  const handleResumeAudit = () => {
    if (pauseStartTime) setTotalPauseDuration(prev => prev + (Date.now() - pauseStartTime));
    setPauseStartTime(null); setAuditState('running');
  };
  const isDataUnsynced = () => {
    if (!isOnline) return true;
    if (syncStatus === 'pending' || syncStatus === 'syncing') return true;
    if (_dbSaveQueue.length > 0) return true;
    const pending = _getPendingFromLocal();
    if (pending.length > 0) return true;
    return false;
  };
  const _doSaveAsDraft = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (auditState === 'paused' && pauseStartTime) setTotalPauseDuration(prev => prev + (Date.now() - pauseStartTime));
    setAuditState('draft');
    if (!trialMode) {
      const snap = { ...buildDraftSnapshot(), auditState: 'draft' as const };
      saveDraftToStorage(storageKey, snap);
      const draftId = storageKey.replace(DRAFT_PREFIX, '');
      fetch('/api/audit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: draftId, type: 'draft', data: _stripImagesFromData(snap) }]),
      }).catch(() => {});
    }
  };
  const _doCloseWithDraft = () => {
    if (auditState !== 'submitted') {
      const snap = buildDraftSnapshot();
      const hasProgress = Object.keys(snap.answers).some(k => snap.answers[k].selectedIndex !== null);
      if (hasProgress || (auditState !== 'idle')) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!trialMode) {
          const draftSnap = { ...snap, auditState: 'draft' as const };
          saveDraftToStorage(storageKey, draftSnap);
          const draftId = storageKey.replace(DRAFT_PREFIX, '');
          fetch('/api/audit-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([{ id: draftId, type: 'draft', data: _stripImagesFromData(draftSnap) }]),
          }).catch(() => {});
        }
      }
    }
    onClose(submittedResultRef.current || undefined);
  };
  const _doSignAndSend = () => {
    if (totalAnswered < totalQuestions) return;
    setShowSignatureModal(true);
  };
  const handleSaveAsDraft = () => {
    if (isDataUnsynced()) { setShowUnsyncWarning('save'); return; }
    _doSaveAsDraft();
  };
  const handleResumeFromDraft = () => {
    setAuditStartTime(prev => prev ?? Date.now());
    setPauseStartTime(null);
    setAuditState('running');
    setCurrentStep('checklist');
    setTimeout(() => scrollRef.current?.scrollTo(0, 0), 0);
  };
  const handleEditSubmittedReport = () => {
    setAuditSignature('');
    setReviewerSignature('');
    setAuditState('running');
    setCurrentStep('checklist');
    setTimeout(() => scrollRef.current?.scrollTo(0, 0), 0);
  };
  const handleCloseWithDraft = () => {
    if (isDataUnsynced()) { setShowUnsyncWarning('close'); return; }
    _doCloseWithDraft();
  };
  const handleSignAndSend = () => {
    if (isDataUnsynced()) { setShowUnsyncWarning('sign'); return; }
    _doSignAndSend();
  };
  const isAnswerNA = (q: QuestionNode, ans: { selectedIndex: number | null; marks: number | null } | undefined): boolean => {
    if (!ans || ans.selectedIndex === null) return false;
    const response = q.responses[ans.selectedIndex];
    if (!response) return false;
    return response.text.toLowerCase() === 'n/a' || response.text.toLowerCase() === 'na' || response.score === '/';
  };

  const _allSecQs = (sec: SectionNode) => [...(sec.questions || []), ...((sec.subSections || []).flatMap(ss => ss.questions || []))];

  const _applicableSecQs = (section: SectionNode): QuestionNode[] => {
    const qs = [...(section.questions || [])];
    (section.subSections || []).forEach(ss => {
      if (applicability[ss.id] !== false) qs.push(...(ss.questions || []));
    });
    return qs;
  };

  const getOverallScore = () => {
    let obtained = 0, max = 0;
    const effectivePages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    effectivePages.forEach(page => {
      if (pageApplicability[page.id] === false) return;
      page.sections.forEach(section => {
        if (!applicability[section.id]) return;
        _applicableSecQs(section).forEach(q => {
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) return;
          max += getQuestionMaxScore(q);
          if (ans && ans.selectedIndex !== null) obtained += ans.marks || 0;
        });
      });
    });
    const pct = max > 0 ? Math.round((obtained / max) * 100) : 0;
    return { obtained, max, pct };
  };

  const extractObservations = (): import('../types').AuditObservation[] => {
    const obs: import('../types').AuditObservation[] = [];
    const effectivePagesForObs = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    effectivePagesForObs.forEach(page => {
      if (pageApplicability[page.id] === false) return;
      const rawPgTitle = page.title || '';
      const pgDept = rawPgTitle.includes('::') ? rawPgTitle.split('::').pop()!.trim() : rawPgTitle;
      page.sections.forEach(section => {
        if (!applicability[section.id]) return;
        _applicableSecQs(section).forEach(q => {
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) return;
          const maxScore = getQuestionMaxScore(q);
          const obtained = (ans && ans.selectedIndex !== null) ? (ans.marks || 0) : 0;
          if (obtained < maxScore) {
            const qComment = resolveComment(q.id);
            const selectedLabel = (ans && ans.selectedIndex !== null && q.responses[ans.selectedIndex])
              ? q.responses[ans.selectedIndex].text : '';
            const entries = qComment?.entries?.filter(e =>
              (e.text && e.text.trim()) || (e.images && e.images.length > 0) ||
              (e.closureComments && e.closureComments.trim()) || (e.closureEvidence && e.closureEvidence.length > 0)
            ) || [];
            const qLocationTag = locationTags[q.id] || '';
            const deptVal = template.department || pgDept || auditLocationName || '';
            if (entries.length === 0) {
              obs.push({
                questionId: q.id,
                questionText: q.text,
                sectionTitle: section.title,
                pageTitle: page.title,
                marksObtained: obtained,
                marksMax: maxScore,
                selectedResponse: selectedLabel,
                comment: '',
                images: [],
                location: qLocationTag,
                department: deptVal,
                risk: q.risk || section.risk || '',
                category: q.category || section.category || '',
                closureStatus: 'Open',
                responsibility: q.responsibility || [],
                checklistName: template.title || '',
                managementTag: obsTags[q.id] || undefined,
              });
            } else {
              entries.forEach((entry) => {
                const hasClosure = (entry.closureComments && entry.closureComments.trim().length > 0) || (entry.closureEvidence && entry.closureEvidence.length > 0);
                obs.push({
                  questionId: q.id,
                  questionText: q.text,
                  sectionTitle: section.title,
                  pageTitle: page.title,
                  marksObtained: obtained,
                  marksMax: maxScore,
                  selectedResponse: selectedLabel,
                  comment: entry.text || '',
                  images: entry.images || [],
                  location: entry.location || qLocationTag,
                  department: deptVal,
                  risk: q.risk || section.risk || '',
                  category: q.category || section.category || '',
                  managementTag: entry.managementTag || obsTags[entry.id] || obsTags[q.id] || undefined,
                  closureStatus: hasClosure ? 'Closed' : 'Open',
                  closureComments: entry.closureComments || undefined,
                  closureEvidence: entry.closureEvidence && entry.closureEvidence.length > 0 ? entry.closureEvidence : undefined,
                  responsibility: q.responsibility || [],
                  checklistName: template.title || '',
                });
              });
            }
          }
        });
      });
    });
    return obs;
  };

  const handleSubmitWithSignature = () => {
    if (!auditSignature) return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (auditState === 'paused' && pauseStartTime) setTotalPauseDuration(prev => prev + (Date.now() - pauseStartTime));
    setShowSignatureModal(false);
    setAuditState('submitted');
    const reportSnapshot = buildDraftSnapshot();
    reportSnapshot.auditState = 'submitted';
    const reportKey = draftKey || template.id;
    if (!trialMode) {
      saveReportToStorage(reportKey, reportSnapshot);
      clearDraftFromStorage(storageKey);
      fetch('/api/audit-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: reportKey, type: 'report', data: _stripImagesFromData(reportSnapshot) }]),
      }).catch(() => {});
    }
    const s = getOverallScore();
    const observationsList = extractObservations();
    const allQuestions: import('../types').AuditQuestion[] = [];
    template.pages.forEach(page => {
      if (pageApplicability[page.id] === false) return;
      page.sections.forEach(section => {
        if (!applicability[section.id]) return;
        _applicableSecQs(section).forEach(q => {
          const ans = resolveAnswer(q.id);
          const selectedLabel = ans?.selectedIndex !== null && ans?.selectedIndex !== undefined ? q.responses[ans.selectedIndex]?.text || '' : '';
          const commentEntry = resolveComment(q.id);
          const commentText = commentEntry?.entries?.map(e => e.text).filter(Boolean).join('; ') || '';
          const commentImages = commentEntry?.entries?.flatMap(e => e.images || []) || [];
          allQuestions.push({
            id: q.id,
            text: q.text,
            clause: q.clause || '',
            response: selectedLabel as any,
            findings: commentText || undefined,
            evidenceUrls: commentImages.length > 0 ? commentImages : undefined,
          });
        });
      });
    });
    const closeResult: AuditCloseResult = { submitted: true, scoreObtained: s.obtained, scoreMax: s.max, scorePercent: s.pct, observations: observationsList, questions: allQuestions };
    submittedResultRef.current = closeResult;

    const effectivePages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    const allQsFlat: { id: string; text: string; sectionTitle: string; checklistName: string; maxScore: number; responses: { text: string; score: string; color: string }[]; pageTitle: string }[] = [];
    effectivePages.forEach(page => {
      if (pageApplicability[page.id] === false) return;
      const rawPageTitle = page.title || '';
      const pageDept = rawPageTitle.includes('::') ? rawPageTitle.split('::').pop()!.trim() : rawPageTitle;
      page.sections.forEach(sec => {
        if (!applicability[sec.id]) return;
        const secTitle = sec.title || '';
        const addQ = (q: QuestionNode) => {
          const maxScore = Math.max(...q.responses.map(r => parseFloat(r.score) || 0), 0);
          allQsFlat.push({ id: q.id, text: q.text, sectionTitle: secTitle, checklistName: template.title || '', maxScore, responses: q.responses, pageTitle: pageDept });
        };
        _applicableSecQs(sec).forEach(addQ);
      });
    });

    const sentObsIds = new Set<string>();
    Object.entries(comments).forEach(([qId, qComment]) => {
      qComment?.entries?.forEach(entry => {
        if (entry.savedToDb) sentObsIds.add(qId);
      });
    });

    const obsToFlush: any[] = [];
    const ts = new Date().toLocaleString();
    const isoNow = new Date().toISOString();
    const followUpDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    for (const qInfo of allQsFlat) {
      if (sentObsIds.has(qInfo.id)) continue;
      const ans = answers[qInfo.id];
      const selectedIdx = ans?.selectedIndex;
      const selectedScore = (selectedIdx !== null && selectedIdx !== undefined && qInfo.responses[selectedIdx])
        ? (parseFloat(qInfo.responses[selectedIdx].score) || 0) : 0;
      const hasFullMarks = selectedScore >= qInfo.maxScore && qInfo.maxScore > 0;

      const qComment = comments[qInfo.id];
      const allEntries = qComment?.entries || [];
      const nonDraftEntries = allEntries.filter(e => !e.isDraft);
      const draftEntries = allEntries.filter(e => e.isDraft);
      const entriesToProcess = [...nonDraftEntries, ...draftEntries];

      if (hasFullMarks) continue;

      const answerText = (selectedIdx !== null && selectedIdx !== undefined && qInfo.responses[selectedIdx]) ? qInfo.responses[selectedIdx].text : '';

      const validEntries = entriesToProcess.filter(e => e.text?.trim() || (e.images && e.images.length > 0));
      if (validEntries.length === 0) continue;

      for (let ei = 0; ei < validEntries.length; ei++) {
        const entry = validEntries[ei];
        const entryText = entry.text?.trim() || '';
        const entryImages = entry.images || [];
        const entryLocation = entry.location || auditLocationName || '';
        const obsDept = qInfo.pageTitle || auditLocationName || '';

        const obsId = (entry.id && entry.id.startsWith('import-')) ? entry.id : `OBS-${Date.now()}-${ei}-${Math.random().toString(36).slice(2, 6)}`;
        obsToFlush.push({
          id: obsId,
          questionId: qInfo.id,
          title: qInfo.text || 'Observation',
          questionText: qInfo.text || '',
          selectedAnswer: answerText,
          observationText: entryText,
          sop: qInfo.sectionTitle || '',
          sectionTitle: qInfo.sectionTitle || undefined,
          checklistName: qInfo.checklistName || undefined,
          severity: 'MINOR' as const,
          level: 'L1' as const,
          mainKitchen: obsDept,
          area: entryLocation,
          location: entryLocation,
          hierarchy: auditUnitName || '',
          closureComments: null,
          status: 'OPEN' as const,
          duration: '0d 0h',
          followUpStatus: 'NOT DONE' as const,
          followUpCount: 0,
          followUpDate,
          reportedBy: 'Auditor',
          lastUpdate: ts,
          createdDate: isoNow,
          thumbnail: entryImages[0] || '',
          allEvidence: entryImages,
          isStarred: false,
          people: [],
          assets: [],
          categories: [],
          tracking: [{ id: `t-${Date.now()}-${ei}`, label: 'Reported', user: 'Auditor', timestamp: ts, comments: entryText }],
          isAuditSourced: true,
          departmentName: obsDept,
          unitId: auditUnitId || undefined,
          unitName: auditUnitName || auditLocationName || '',
          ...(entry.isRepeat ? {
            isRepeat: true,
            repeatOriginalDate: entry.repeatOriginalDate,
            repeatTrail: entry.repeatTrail,
            repeatSourceId: entry.repeatSourceId,
          } : {}),
          managementTag: entry.managementTag || obsTags[entry.id] || undefined,
        });
      }
    }

    if (obsToFlush.length > 0) {
      fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obsToFlush),
      }).catch(err => console.error('Failed to flush observations to registry:', err));
    }

    setTimeout(async () => {
      try {
        await generateAuditReport();
      } catch (err) {
        console.error('[audit] Auto-download after sign failed:', err);
      }
      onClose(closeResult);
    }, 600);
  };

  const initSigCanvas = (canvas: HTMLCanvasElement | null, existingData?: string) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (existingData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = existingData;
    }
  };
  const sigStartDrawing = (e: any, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const yy = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x * (canvas.width / rect.width), yy * (canvas.height / rect.height));
    (canvas as any)._drawing = true;
  };
  const sigDraw = (e: any, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !(canvas as any)._drawing) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0]?.clientX)) - rect.left;
    const yy = (e.clientY || (e.touches && e.touches[0]?.clientY)) - rect.top;
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineTo(x * (canvas.width / rect.width), yy * (canvas.height / rect.height)); ctx.stroke();
  };
  const sigStopDrawing = (canvas: HTMLCanvasElement | null, setter: (v: string) => void) => {
    if (!canvas) return;
    (canvas as any)._drawing = false;
    compressSignature(canvas.toDataURL('image/png')).then(compressed => setter(compressed));
  };
  const sigClear = (canvas: HTMLCanvasElement | null, setter: (v: string) => void) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); setter(''); }
  };

  const fetchPreviousReports = async () => {
    if (!template.title) return;
    setLoadingPreviousReports(true);
    try {
      const params = new URLSearchParams({ checklist: template.title, limit: '5' });
      if (auditUnitName) params.set('unit', auditUnitName);
      const res = await fetch(`/api/audit-reports?${params.toString()}`);
      const rows = await res.json();
      const currentReportKey = draftKey || template.id;
      const filtered = (rows || [])
        .filter((r: any) => r.id !== currentReportKey && r.data?.auditState === 'submitted')
        .slice(0, 5);
      setPreviousReports(filtered.map((r: any) => ({ id: r.id, data: r.data as AuditDraft, updatedAt: r.data?.savedAt ? new Date(r.data.savedAt).toLocaleDateString() : '' })));
    } catch (err) {
      console.error('Failed to fetch previous reports:', err);
      setPreviousReports([]);
    } finally {
      setLoadingPreviousReports(false);
    }
  };

  const generateAuditReport = async (options?: { filterPageTitles?: string[]; fileNameOverride?: string; overridePages?: any[]; reportSubtitle?: string }) => {
   try {
    const reportPages = options?.filterPageTitles
      ? template.pages.filter(p => options.filterPageTitles!.some(t => p.title === t))
      : template.pages;

    const allCandidatePages = options?.overridePages
      ? options.overridePages
      : (isLocationMode && locationVirtualPages)
        ? (() => {
            const allVPages = locationVirtualPages.flatMap(lv => lv.pages);
            if (options?.filterPageTitles) {
              return allVPages.filter(p => options.filterPageTitles!.some(t => p.title === t));
            }
            return allVPages;
          })()
        : reportPages;
    const pdfEffectivePages = allCandidatePages.filter(p => pageApplicability[p.id] !== false);
    if (pdfEffectivePages.length === 0) {
      alert('No applicable pages/departments to include in the report. Please check page applicability settings.');
      return;
    }

    const rptOverallScore = pdfEffectivePages.reduce((acc, p) => {
      const ps = calculatePageScore(p);
      return { obtained: acc.obtained + ps.obtained, max: acc.max + ps.max, unanswered: acc.unanswered + ps.unanswered };
    }, { obtained: 0, max: 0, unanswered: 0 });
    const rptOverallPct = rptOverallScore.max > 0 ? Math.round((rptOverallScore.obtained / rptOverallScore.max) * 100) : 0;
    const rptTotalQuestions = pdfEffectivePages.reduce((sum, p) => sum + p.sections.reduce((s2, sec) => {
      if (applicability[sec.id] === false) return s2;
      let count = (sec.questions || []).length;
      (sec.subSections || []).forEach(ss => {
        if (applicability[ss.id] !== false) count += (ss.questions || []).length;
      });
      return s2 + count;
    }, 0), 0);

    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const ml = 40, mr = 40, mt = 40, mb = 50;
    const cw = pw - ml - mr;
    let y = mt;
    let pageNum = 1;

    const getRating = (pct: number) => pct >= 90 ? 'Green' : pct >= 70 ? 'Yellow' : 'Red';
    const getRatingColor = (pct: number): [number, number, number] => pct >= 90 ? [22, 163, 74] : pct >= 70 ? [217, 119, 6] : [220, 38, 38];
    const fmtPct = (obtained: number, max: number): string => {
      if (max <= 0) return '0.0';
      return ((obtained / max) * 100).toFixed(1);
    };

    const checkPage = (needed: number) => {
      if (y + needed > ph - mb) { pdf.addPage(); pageNum++; y = mt; addFooter(pageNum - 1); return true; }
      return false;
    };

    const addFooter = (pn: number) => {
      const totalPages = '##TOTAL##';
      pdf.setFontSize(7); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'normal');
      pdf.text(`${pn}/${totalPages}`, pw / 2, ph - 20, { align: 'center' });
    };

    const drawSectionHeader = (title: string, scorePct?: number, scoreObtained?: number, scoreMax?: number) => {
      checkPage(26);
      pdf.setFillColor(30, 41, 59); pdf.rect(ml, y, cw, 22, 'F');
      pdf.setFontSize(9); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
      pdf.text(title.toUpperCase(), ml + 10, y + 14);
      if (scorePct !== undefined) {
        pdf.setFontSize(8);
        const scoreLabel = scoreObtained !== undefined && scoreMax !== undefined
          ? `${scoreObtained}/${scoreMax} pts  (${scorePct}%)`
          : `${scorePct}%`;
        pdf.text(scoreLabel, ml + cw - 10, y + 14, { align: 'right' });
      }
      y += 26;
    };

    const drawTableHeader = (cols: { label: string; x: number; w: number; align?: string }[]) => {
      checkPage(18);
      pdf.setFillColor(241, 245, 249); pdf.rect(ml, y, cw, 16, 'F');
      pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5);
      pdf.rect(ml, y, cw, 16);
      pdf.setFontSize(7); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'bold');
      cols.forEach(col => {
        pdf.text(col.label, col.x, y + 11, { align: (col.align as any) || 'left' });
      });
      y += 16;
    };

    const drawTableRow = (cells: { text: string; x: number; w: number; align?: string; bold?: boolean; color?: [number, number, number] }[], rowH: number = 14, fillAlt?: boolean) => {
      const lineH = 8;
      let maxLines = 1;
      const cellLines: string[][] = [];
      cells.forEach(cell => {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal');
        const align = (cell.align as any) || 'left';
        const maxW = cell.w - 4;
        if (maxW > 0 && align === 'left' && pdf.getTextWidth(cell.text) > maxW) {
          const wrapped = pdf.splitTextToSize(cell.text, maxW) as string[];
          cellLines.push(wrapped);
          if (wrapped.length > maxLines) maxLines = wrapped.length;
        } else {
          cellLines.push([cell.text]);
        }
      });
      const actualRowH = Math.max(rowH, maxLines * lineH + 6);
      checkPage(actualRowH);
      if (fillAlt) { pdf.setFillColor(248, 250, 252); pdf.rect(ml, y, cw, actualRowH, 'F'); }
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
      pdf.line(ml, y + actualRowH, ml + cw, y + actualRowH);
      cells.forEach((cell, ci) => {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal');
        pdf.setTextColor(...(cell.color || [30, 41, 59]));
        const align = (cell.align as any) || 'left';
        const lines = cellLines[ci];
        if (lines.length > 1) {
          const startY = y + lineH + 1;
          lines.forEach((line, li) => {
            pdf.text(line, cell.x, startY + li * lineH, { align });
          });
        } else {
          pdf.text(lines[0], cell.x, y + actualRowH / 2 + 3, { align });
        }
      });
      y += actualRowH;
    };

    // --- PROFESSIONAL HEADER ---
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pw, 100, 'F');
    
    pdf.setFontSize(24); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
    pdf.text('HACCP PRO', ml, 45);
    
    pdf.setFontSize(9); pdf.setTextColor(148, 163, 184); pdf.setFont('helvetica', 'normal');
    pdf.text('FOOD SAFETY MANAGEMENT SYSTEM', ml, 60);
    
    pdf.setDrawColor(51, 65, 85); pdf.setLineWidth(1);
    pdf.line(ml, 75, pw - mr, 75);
    
    const isDraftReport = reviewRequired ? !reviewerSignature : false;
    pdf.setFontSize(8); pdf.setTextColor(203, 213, 225);
    pdf.text(isDraftReport ? 'DRAFT AUDIT REPORT' : 'FINAL AUDIT REPORT', ml, 88);
    pdf.text(`REPORT ID: AUD-${Date.now().toString().slice(-8)}`, pw - mr, 88, { align: 'right' });
    if (options?.reportSubtitle) {
      pdf.setFontSize(7); pdf.setTextColor(148, 163, 184);
      pdf.text(options.reportSubtitle, ml, 97);
    }
    if (isDraftReport) {
      pdf.setFontSize(11); pdf.setTextColor(245, 158, 11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DRAFT', pw - mr - 60, 45);
      pdf.setDrawColor(245, 158, 11); pdf.setLineWidth(1);
      pdf.roundedRect(pw - mr - 72, 32, 52, 18, 3, 3, 'S');
    }
    
    y = 120;

    // --- COMPANY INFORMATION (CARDS) ---
    const drawInfoCard = (title: string, data: [string, string][], x: number, w: number) => {
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      const cardH = data.length * 15 + 25;
      pdf.roundedRect(x, y, w, cardH, 3, 3, 'FD');
      
      pdf.setFontSize(9); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'bold');
      pdf.text(title.toUpperCase(), x + 10, y + 15);
      
      let iy = y + 30;
      data.forEach(([label, val]) => {
        pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 116, 139);
        pdf.text(label + ':', x + 10, iy);
        
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
        const valW = w - 85;
        const lines = pdf.splitTextToSize(val || '—', valW);
        lines.forEach((line: string, li: number) => {
          pdf.text(line, x + 75, iy + li * 9);
        });
        iy += Math.max(15, lines.length * 9 + 2);
      });
      return cardH;
    };

    const infoLeft: [string, string][] = [
      ['Template', template.title || 'Untitled Audit'],
      ['Company', unitForm.companyName || '—'],
      ['Representative', unitForm.repName || '—'],
      ['Location', unitForm.address || '—'],
      ['Scope', unitForm.scope || '—'],
    ];

    const infoRight: [string, string][] = [
      ['Status', auditState === 'submitted' ? 'Submitted' : 'In Progress'],
      ['Assessor', unitForm.repName || '—'],
      ['Audit Date', unitForm.dateFrom || unitForm.startTime || '—'],
      ['Duration', timerDisplay.active],
      ['Geolocation', unitForm.geotag || '—'],
    ];

    const cardW = (cw - 15) / 2;
    const hL = drawInfoCard('General Information', infoLeft, ml, cardW);
    const hR = drawInfoCard('Audit Details', infoRight, ml + cardW + 15, cardW);
    y += Math.max(hL, hR) + 25;

    // --- OVERALL SUMMARY (BEAUTIFIED) ---
    checkPage(80);
    const summaryX = ml;
    const summaryW = cw;
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(summaryX, y, summaryW, 70, 4, 4, 'FD');
    
    // Left Score Circle
    const circleX = summaryX + 45;
    const circleY = y + 35;
    const [rc, gc, bc] = getRatingColor(rptOverallPct);
    pdf.setDrawColor(rc, gc, bc);
    pdf.setLineWidth(3);
    pdf.circle(circleX, circleY, 25, 'S');
    
    pdf.setFontSize(14); pdf.setTextColor(rc, gc, bc); pdf.setFont('helvetica', 'bold');
    pdf.text(`${fmtPct(rptOverallScore.obtained, rptOverallScore.max)}%`, circleX, circleY + 5, { align: 'center' });
    
    // Right Stats
    pdf.setFontSize(11); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'bold');
    pdf.text('OVERALL AUDIT COMPLIANCE', summaryX + 90, y + 25);
    
    pdf.setFontSize(9); pdf.setTextColor(71, 85, 105); pdf.setFont('helvetica', 'normal');
    pdf.text(`Total Score: ${rptOverallScore.obtained} / ${rptOverallScore.max} points`, summaryX + 90, y + 42);
    
    const rating = getRating(rptOverallPct);
    pdf.setFillColor(rc, gc, bc);
    pdf.roundedRect(summaryX + 90, y + 48, 60, 14, 2, 2, 'F');
    pdf.setFontSize(8); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
    pdf.text(rating.toUpperCase(), summaryX + 120, y + 58, { align: 'center' });
    
    y += 95;

    // --- EXECUTIVE SUMMARY ---
    const bpText = stripHtmlToText(savedNotes.bestPractice);
    const ofiText = stripHtmlToText(savedNotes.opportunity);
    const bpImgs = savedNotes.bestPracticeImages || [];
    const ofiImgs = savedNotes.opportunityImages || [];
    if (bpText || ofiText || bpImgs.length > 0 || ofiImgs.length > 0) {
      checkPage(100);
      pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.setFont('helvetica', 'bold');
      pdf.text('EXECUTIVE SUMMARY', ml, y);
      y += 15;
      
      if (bpText || bpImgs.length > 0) {
        const bpLines = bpText ? pdf.splitTextToSize(bpText, cw - 30) : [];
        const textBoxH = bpLines.length * 10 + 25;
        checkPage(textBoxH);
        pdf.setFillColor(240, 253, 244); pdf.setDrawColor(187, 247, 208);
        pdf.roundedRect(ml, y, cw, textBoxH, 2, 2, 'FD');
        pdf.setFontSize(8.5); pdf.setTextColor(21, 128, 61); pdf.setFont('helvetica', 'bold');
        pdf.text('KEY STRENGTHS & BEST PRACTICES', ml + 10, y + 15);
        if (bpText) {
          pdf.setFontSize(8); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal');
          bpLines.forEach((l: string, i: number) => pdf.text(l, ml + 10, y + 28 + i * 10));
        }
        y += textBoxH + 5;
        if (bpImgs.length > 0) {
          const imgSize = 65;
          const imgGap = 8;
          const maxPerRow = Math.min(3, Math.floor((cw - 20) / (imgSize + imgGap)));
          for (let idx = 0; idx < bpImgs.length; idx++) {
            const col = idx % maxPerRow;
            if (col === 0) checkPage(imgSize + imgGap);
            const imgX = ml + 10 + col * (imgSize + imgGap);
            try { pdf.addImage(bpImgs[idx], 'JPEG', imgX, y, imgSize, imgSize); } catch {}
            if (col === maxPerRow - 1 || idx === bpImgs.length - 1) { y += imgSize + imgGap; }
          }
        }
        y += 5;
      }
      
      if (ofiText || ofiImgs.length > 0) {
        const ofiLines = ofiText ? pdf.splitTextToSize(ofiText, cw - 30) : [];
        const textBoxH = ofiLines.length * 10 + 25;
        checkPage(textBoxH);
        pdf.setFillColor(255, 251, 235); pdf.setDrawColor(253, 230, 138);
        pdf.roundedRect(ml, y, cw, textBoxH, 2, 2, 'FD');
        pdf.setFontSize(8.5); pdf.setTextColor(180, 83, 9); pdf.setFont('helvetica', 'bold');
        pdf.text('AREAS FOR IMPROVEMENT', ml + 10, y + 15);
        if (ofiText) {
          pdf.setFontSize(8); pdf.setTextColor(30, 41, 59); pdf.setFont('helvetica', 'normal');
          ofiLines.forEach((l: string, i: number) => pdf.text(l, ml + 10, y + 28 + i * 10));
        }
        y += textBoxH + 5;
        if (ofiImgs.length > 0) {
          const imgSize = 65;
          const imgGap = 8;
          const maxPerRow = Math.min(3, Math.floor((cw - 20) / (imgSize + imgGap)));
          for (let idx = 0; idx < ofiImgs.length; idx++) {
            const col = idx % maxPerRow;
            if (col === 0) checkPage(imgSize + imgGap);
            const imgX = ml + 10 + col * (imgSize + imgGap);
            try { pdf.addImage(ofiImgs[idx], 'JPEG', imgX, y, imgSize, imgSize); } catch {}
            if (col === maxPerRow - 1 || idx === ofiImgs.length - 1) { y += imgSize + imgGap; }
          }
        }
        y += 10;
      }
    }

    const summCols = [
      { label: 'Name', x: ml + 8, w: 155 },
      { label: 'Questions', x: ml + 170, w: 42, align: 'center' },
      { label: 'N/A', x: ml + 218, w: 30, align: 'center' },
      { label: 'Findings', x: ml + 253, w: 42, align: 'center' },
      { label: 'Repeat', x: ml + 300, w: 35, align: 'center' },
      { label: 'Repeat %', x: ml + 340, w: 35, align: 'center' },
      { label: 'Earned', x: ml + 385, w: 40, align: 'center' },
      { label: 'Possible', x: ml + 430, w: 40, align: 'center' },
      { label: 'Score', x: ml + cw - 8, w: 50, align: 'right' },
    ];

    type SummGrp = { questions: number; findings: number; repeats: number; earned: number; possible: number; na: number };
    const _isAllNA = (g: SummGrp) => g.questions === 0 && g.na > 0;
    const _scoreAsc = (groups: Record<string, SummGrp>) => {
      return Object.keys(groups).sort((a, b) => {
        const ga = groups[a], gb = groups[b];
        const aNA = _isAllNA(ga), bNA = _isAllNA(gb);
        if (aNA && !bNA) return -1;
        if (!aNA && bNA) return 1;
        if (aNA && bNA) return a.localeCompare(b);
        const sa = ga.possible > 0 ? (ga.earned / ga.possible) * 100 : 0;
        const sb = gb.possible > 0 ? (gb.earned / gb.possible) * 100 : 0;
        return sa - sb;
      });
    };
    const _drawSummaryTable = (title: string, colLabel: string, groups: Record<string, SummGrp>, sortedKeys: string[], rowLabelFn?: (key: string) => string) => {
      if (Object.keys(groups).length === 0) return;
      drawSectionHeader(title);
      summCols[0] = { label: colLabel, x: ml + 8, w: 155 };
      drawTableHeader(summCols);
      let tQ = 0, tF = 0, tR = 0, tE = 0, tP = 0, tNA = 0;
      let idx = 0;
      sortedKeys.forEach(key => {
        const g = groups[key];
        if (!g) return;
        const allNA = _isAllNA(g);
        const rPctNum = g.possible > 0 ? (g.earned / g.possible) * 100 : 0;
        tQ += g.questions; tF += g.findings; tR += g.repeats;
        tE += g.earned; tP += g.possible; tNA += g.na;
        checkPage(16);
        drawTableRow([
          { text: rowLabelFn ? rowLabelFn(key) : key, x: ml + 8, w: 155, bold: true },
          { text: allNA ? '—' : String(g.questions), x: ml + 170, w: 42, align: 'center', color: allNA ? [148, 163, 184] : [30, 41, 59] },
          { text: g.na > 0 ? String(g.na) : '—', x: ml + 218, w: 30, align: 'center', color: g.na > 0 ? [148, 163, 184] : [200, 200, 200] },
          { text: allNA ? '—' : String(g.findings), x: ml + 253, w: 42, align: 'center', color: allNA ? [148, 163, 184] : [30, 41, 59] },
          { text: allNA ? '—' : String(g.repeats), x: ml + 300, w: 35, align: 'center', color: allNA ? [148, 163, 184] : [30, 41, 59] },
          { text: allNA ? '—' : (g.repeats > 0 ? `${fmtPct(g.repeats, g.questions)}%` : '—'), x: ml + 340, w: 35, align: 'center', color: allNA ? [148, 163, 184] : (g.repeats > 0 ? [225, 29, 72] : [150, 150, 150]) },
          { text: allNA ? '—' : String(g.earned), x: ml + 385, w: 40, align: 'center', color: allNA ? [148, 163, 184] : [30, 41, 59] },
          { text: allNA ? '—' : String(g.possible), x: ml + 430, w: 40, align: 'center', color: allNA ? [148, 163, 184] : [30, 41, 59] },
          { text: allNA ? 'N/A' : `${fmtPct(g.earned, g.possible)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: allNA ? [148, 163, 184] : getRatingColor(rPctNum) },
        ], 16, idx % 2 === 0);
        idx++;
      });
      const overPctNum = tP > 0 ? (tE / tP) * 100 : 0;
      pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.8); pdf.line(ml, y, ml + cw, y);
      drawTableRow([
        { text: 'OVERALL', x: ml + 8, w: 155, bold: true },
        { text: String(tQ), x: ml + 170, w: 42, align: 'center', bold: true },
        { text: tNA > 0 ? String(tNA) : '—', x: ml + 218, w: 30, align: 'center', bold: true, color: [148, 163, 184] },
        { text: String(tF), x: ml + 253, w: 42, align: 'center', bold: true },
        { text: String(tR), x: ml + 300, w: 35, align: 'center', bold: true },
        { text: tR > 0 ? `${fmtPct(tR, tQ)}%` : '—', x: ml + 340, w: 35, align: 'center', bold: true, color: tR > 0 ? [225, 29, 72] : [150, 150, 150] },
        { text: String(tE), x: ml + 385, w: 40, align: 'center', bold: true },
        { text: String(tP), x: ml + 430, w: 40, align: 'center', bold: true },
        { text: `${fmtPct(tE, tP)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: getRatingColor(overPctNum) },
      ], 18);
      y += 8;
    };

    const respGroups: Record<string, SummGrp> = {};
    pdfEffectivePages.forEach(page => {
      page.sections.forEach(section => {
        if (applicability[section.id] === false) return;
        _applicableSecQs(section).forEach(q => {
          const respList = (q.responsibility && q.responsibility.length > 0) ? q.responsibility : ['Unassigned'];
          respList.forEach(resp => {
            if (!respGroups[resp]) respGroups[resp] = { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0 };
            const ans = resolveAnswer(q.id);
            if (isAnswerNA(q, ans)) { respGroups[resp].na++; return; }
            respGroups[resp].questions++;
            respGroups[resp].possible += getQuestionMaxScore(q);
            if (resolveRepeat(q.id)) respGroups[resp].repeats++;
            if (ans && ans.selectedIndex !== null) {
              respGroups[resp].earned += ans.marks || 0;
              if ((ans.marks || 0) < getQuestionMaxScore(q)) respGroups[resp].findings++;
            }
          });
        });
      });
    });
    _drawSummaryTable('Summary by Responsibility', 'Responsibility', respGroups, _scoreAsc(respGroups));

    const categoryGroups: Record<string, SummGrp> = {};
    pdfEffectivePages.forEach(page => {
      page.sections.forEach(section => {
        if (applicability[section.id] === false) return;
        _applicableSecQs(section).forEach(q => {
          const cat = q.category || 'Uncategorized';
          if (!categoryGroups[cat]) categoryGroups[cat] = { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0 };
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) { categoryGroups[cat].na++; return; }
          categoryGroups[cat].questions++;
          categoryGroups[cat].possible += getQuestionMaxScore(q);
          if (resolveRepeat(q.id)) categoryGroups[cat].repeats++;
          if (ans && ans.selectedIndex !== null) {
            categoryGroups[cat].earned += ans.marks || 0;
            if ((ans.marks || 0) < getQuestionMaxScore(q)) categoryGroups[cat].findings++;
          }
        });
      });
    });
    _drawSummaryTable('Summary by Category', 'Category', categoryGroups, _scoreAsc(categoryGroups));

    const _calcPageMetrics = (page: any) => {
      let qCount = 0, naCount = 0, findings = 0, reps = 0;
      const score = calculatePageScore(page);
      page.sections.forEach((section: any) => {
        if (applicability[section.id] === false) return;
        _applicableSecQs(section).forEach((q: any) => {
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) { naCount++; return; }
          qCount++;
          if (ans && ans.selectedIndex !== null && (ans.marks || 0) < getQuestionMaxScore(q)) findings++;
          if (resolveRepeat(q.id)) reps++;
        });
      });
      return { qCount, naCount, findings, reps, score };
    };

    drawSectionHeader('Summary by Location');
    const secCols = [
      { label: 'Department / Location', x: ml + 8, w: 155 },
      { label: 'Questions', x: ml + 170, w: 42, align: 'center' },
      { label: 'N/A', x: ml + 218, w: 30, align: 'center' },
      { label: 'Findings', x: ml + 253, w: 42, align: 'center' },
      { label: 'Repeat', x: ml + 300, w: 35, align: 'center' },
      { label: 'Repeat %', x: ml + 340, w: 35, align: 'center' },
      { label: 'Earned', x: ml + 385, w: 40, align: 'center' },
      { label: 'Possible', x: ml + 430, w: 40, align: 'center' },
      { label: 'Score', x: ml + cw - 8, w: 50, align: 'right' },
    ];
    drawTableHeader(secCols);

    let overallFindings = 0;
    let overallRepeats = 0;
    let overallNACount = 0;

    if (locationGroupedByDept && isLocationMode) {
      const deptAggArr: { name: string; q: number; na: number; findings: number; repeats: number; obtained: number; max: number; locRows: { name: string; qCount: number; naCount: number; findings: number; reps: number; obtained: number; max: number }[] }[] = [];
      locationGroupedByDept.forEach(({ deptName, items }) => {
        let deptQ = 0, deptNA = 0, deptFindings = 0, deptRepeats = 0;
        let deptObtained = 0, deptMax = 0;
        const locRows: { name: string; qCount: number; naCount: number; findings: number; reps: number; obtained: number; max: number }[] = [];
        items.forEach(({ locationName, pages: locPages }: any) => {
          let locQ = 0, locNA = 0, locFindings = 0, locReps = 0, locObtained = 0, locMax = 0;
          locPages.forEach((p: any) => {
            const m = _calcPageMetrics(p);
            locQ += m.qCount; locNA += m.naCount; locFindings += m.findings; locReps += m.reps;
            locObtained += m.score.obtained; locMax += m.score.max;
          });
          deptQ += locQ; deptNA += locNA; deptFindings += locFindings; deptRepeats += locReps;
          deptObtained += locObtained; deptMax += locMax;
          locRows.push({ name: locationName, qCount: locQ, naCount: locNA, findings: locFindings, reps: locReps, obtained: locObtained, max: locMax });
        });
        overallFindings += deptFindings; overallRepeats += deptRepeats; overallNACount += deptNA;
        deptAggArr.push({ name: deptName, q: deptQ, na: deptNA, findings: deptFindings, repeats: deptRepeats, obtained: deptObtained, max: deptMax, locRows });
      });
      deptAggArr.sort((a, b) => {
        const aNA = a.q === 0 && a.na > 0, bNA = b.q === 0 && b.na > 0;
        if (aNA && !bNA) return -1; if (!aNA && bNA) return 1;
        if (aNA && bNA) return a.name.localeCompare(b.name);
        const sa = a.max > 0 ? (a.obtained / a.max) * 100 : 0; const sb = b.max > 0 ? (b.obtained / b.max) * 100 : 0; return sa - sb;
      });
      deptAggArr.forEach(dept => {
        const deptAllNA = dept.q === 0 && dept.na > 0;
        const deptPct = dept.max > 0 ? (dept.obtained / dept.max) * 100 : 0;
        const deptRepeatPct = dept.q > 0 ? fmtPct(dept.repeats, dept.q) : '0.0';
        const naClr: [number, number, number] = [148, 163, 184];
        checkPage(16);
        pdf.setFillColor(226, 232, 240); pdf.rect(ml, y, cw, 16, 'F');
        pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.rect(ml, y, cw, 16);
        drawTableRow([
          { text: dept.name.toUpperCase(), x: ml + 8, w: 155, bold: true },
          { text: deptAllNA ? '—' : String(dept.q), x: ml + 170, w: 42, align: 'center', bold: true, color: deptAllNA ? naClr : [30, 41, 59] },
          { text: dept.na > 0 ? String(dept.na) : '—', x: ml + 218, w: 30, align: 'center', bold: true, color: dept.na > 0 ? naClr : [200, 200, 200] },
          { text: deptAllNA ? '—' : String(dept.findings), x: ml + 253, w: 42, align: 'center', bold: true, color: deptAllNA ? naClr : [30, 41, 59] },
          { text: deptAllNA ? '—' : String(dept.repeats), x: ml + 300, w: 35, align: 'center', bold: true, color: deptAllNA ? naClr : [30, 41, 59] },
          { text: deptAllNA ? '—' : (dept.repeats > 0 ? `${deptRepeatPct}%` : '—'), x: ml + 340, w: 35, align: 'center', bold: true, color: deptAllNA ? naClr : (dept.repeats > 0 ? [225, 29, 72] : [150, 150, 150]) },
          { text: deptAllNA ? '—' : String(dept.obtained), x: ml + 385, w: 40, align: 'center', bold: true, color: deptAllNA ? naClr : [30, 41, 59] },
          { text: deptAllNA ? '—' : String(dept.max), x: ml + 430, w: 40, align: 'center', bold: true, color: deptAllNA ? naClr : [30, 41, 59] },
          { text: deptAllNA ? 'N/A' : `${fmtPct(dept.obtained, dept.max)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: deptAllNA ? naClr : getRatingColor(deptPct) },
        ], 16);
        dept.locRows.sort((a, b) => {
          const aNA2 = a.qCount === 0 && a.naCount > 0, bNA2 = b.qCount === 0 && b.naCount > 0;
          if (aNA2 && !bNA2) return -1; if (!aNA2 && bNA2) return 1;
          if (aNA2 && bNA2) return a.name.localeCompare(b.name);
          const sa = a.max > 0 ? (a.obtained / a.max) * 100 : 0; const sb = b.max > 0 ? (b.obtained / b.max) * 100 : 0; return sa - sb;
        });
        dept.locRows.forEach(loc => {
          const locAllNA = loc.qCount === 0 && loc.naCount > 0;
          const locPct = loc.max > 0 ? (loc.obtained / loc.max) * 100 : 0;
          const locRepeatPct = loc.qCount > 0 ? fmtPct(loc.reps, loc.qCount) : '0.0';
          const locClr: [number, number, number] = locAllNA ? naClr : [100, 116, 139];
          checkPage(14);
          drawTableRow([
            { text: `  ${loc.name}`, x: ml + 8, w: 155, color: locClr },
            { text: locAllNA ? '—' : String(loc.qCount), x: ml + 170, w: 42, align: 'center', color: locClr },
            { text: loc.naCount > 0 ? String(loc.naCount) : '—', x: ml + 218, w: 30, align: 'center', color: loc.naCount > 0 ? naClr : [200, 200, 200] },
            { text: locAllNA ? '—' : String(loc.findings), x: ml + 253, w: 42, align: 'center', color: locClr },
            { text: locAllNA ? '—' : String(loc.reps), x: ml + 300, w: 35, align: 'center', color: locClr },
            { text: locAllNA ? '—' : (loc.reps > 0 ? `${locRepeatPct}%` : '—'), x: ml + 340, w: 35, align: 'center', color: locAllNA ? naClr : (loc.reps > 0 ? [225, 29, 72] : [150, 150, 150]) },
            { text: locAllNA ? '—' : String(loc.obtained), x: ml + 385, w: 40, align: 'center', color: locClr },
            { text: locAllNA ? '—' : String(loc.max), x: ml + 430, w: 40, align: 'center', color: locClr },
            { text: locAllNA ? 'N/A' : `${fmtPct(loc.obtained, loc.max)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: locAllNA ? naClr : getRatingColor(locPct) },
          ], 14);
        });
      });
    } else {
      const pageAggArr: { name: string; m: ReturnType<typeof _calcPageMetrics> }[] = [];
      pdfEffectivePages.forEach((page, pgIdx) => {
        const m = _calcPageMetrics(page);
        overallFindings += m.findings; overallRepeats += m.reps; overallNACount += m.naCount;
        pageAggArr.push({ name: (page.title || `Department ${pgIdx + 1}`).toUpperCase(), m });
      });
      pageAggArr.sort((a, b) => {
        const aNA = a.m.qCount === 0 && a.m.naCount > 0, bNA = b.m.qCount === 0 && b.m.naCount > 0;
        if (aNA && !bNA) return -1; if (!aNA && bNA) return 1;
        if (aNA && bNA) return a.name.localeCompare(b.name);
        const sa = a.m.score.max > 0 ? (a.m.score.obtained / a.m.score.max) * 100 : 0; const sb = b.m.score.max > 0 ? (b.m.score.obtained / b.m.score.max) * 100 : 0; return sa - sb;
      });
      pageAggArr.forEach(({ name, m }) => {
        const pageAllNA = m.qCount === 0 && m.naCount > 0;
        const pagePctNum = m.score.max > 0 ? (m.score.obtained / m.score.max) * 100 : 0;
        const repeatPctStr = m.qCount > 0 ? fmtPct(m.reps, m.qCount) : '0.0';
        const naClr2: [number, number, number] = [148, 163, 184];
        checkPage(16);
        pdf.setFillColor(226, 232, 240); pdf.rect(ml, y, cw, 16, 'F');
        pdf.setDrawColor(203, 213, 225); pdf.setLineWidth(0.5); pdf.rect(ml, y, cw, 16);
        drawTableRow([
          { text: name, x: ml + 8, w: 155, bold: true },
          { text: pageAllNA ? '—' : String(m.qCount), x: ml + 170, w: 42, align: 'center', bold: true, color: pageAllNA ? naClr2 : [30, 41, 59] },
          { text: m.naCount > 0 ? String(m.naCount) : '—', x: ml + 218, w: 30, align: 'center', bold: true, color: m.naCount > 0 ? naClr2 : [200, 200, 200] },
          { text: pageAllNA ? '—' : String(m.findings), x: ml + 253, w: 42, align: 'center', bold: true, color: pageAllNA ? naClr2 : [30, 41, 59] },
          { text: pageAllNA ? '—' : String(m.reps), x: ml + 300, w: 35, align: 'center', bold: true, color: pageAllNA ? naClr2 : [30, 41, 59] },
          { text: pageAllNA ? '—' : (m.reps > 0 ? `${repeatPctStr}%` : '—'), x: ml + 340, w: 35, align: 'center', bold: true, color: pageAllNA ? naClr2 : (m.reps > 0 ? [225, 29, 72] : [150, 150, 150]) },
          { text: pageAllNA ? '—' : String(m.score.obtained), x: ml + 385, w: 40, align: 'center', bold: true, color: pageAllNA ? naClr2 : [30, 41, 59] },
          { text: pageAllNA ? '—' : String(m.score.max), x: ml + 430, w: 40, align: 'center', bold: true, color: pageAllNA ? naClr2 : [30, 41, 59] },
          { text: pageAllNA ? 'N/A' : `${fmtPct(m.score.obtained, m.score.max)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: pageAllNA ? naClr2 : getRatingColor(pagePctNum) },
        ], 16);
      });
    }

    const applicableQCount = rptTotalQuestions - overallNACount;
    const overallRepeatPctStr = applicableQCount > 0 ? fmtPct(overallRepeats, applicableQCount) : '0.0';

    pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.8); pdf.line(ml, y, ml + cw, y);
    drawTableRow([
      { text: 'OVERALL', x: ml + 8, w: 155, bold: true },
      { text: String(applicableQCount), x: ml + 170, w: 42, align: 'center', bold: true },
      { text: overallNACount > 0 ? String(overallNACount) : '—', x: ml + 218, w: 30, align: 'center', bold: true, color: [148, 163, 184] },
      { text: String(overallFindings), x: ml + 253, w: 42, align: 'center', bold: true },
      { text: String(overallRepeats), x: ml + 300, w: 35, align: 'center', bold: true },
      { text: overallRepeats > 0 ? `${overallRepeatPctStr}%` : '—', x: ml + 340, w: 35, align: 'center', bold: true, color: overallRepeats > 0 ? [225, 29, 72] : [150, 150, 150] },
      { text: String(rptOverallScore.obtained), x: ml + 385, w: 40, align: 'center', bold: true },
      { text: String(rptOverallScore.max), x: ml + 430, w: 40, align: 'center', bold: true },
      { text: `${fmtPct(rptOverallScore.obtained, rptOverallScore.max)}%`, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: getRatingColor(rptOverallPct) },
    ], 18);
    y += 8;

    const sopMainGroups: Record<string, SummGrp> = {};
    const subSopGroups: Record<string, SummGrp & { parentSop: string }> = {};
    pdfEffectivePages.forEach(page => {
      page.sections.forEach(section => {
        if (applicability[section.id] === false) return;
        const sopName = section.title || 'Untitled Policy';
        if (!sopMainGroups[sopName]) sopMainGroups[sopName] = { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0 };
        const agg = sopMainGroups[sopName];

        section.questions.forEach(q => {
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) { agg.na++; return; }
          agg.questions++;
          agg.possible += getQuestionMaxScore(q);
          if (ans && ans.selectedIndex !== null) {
            agg.earned += ans.marks || 0;
            if ((ans.marks || 0) < getQuestionMaxScore(q)) agg.findings++;
          }
          if (resolveRepeat(q.id)) agg.repeats++;
        });

        (section.subSections || []).forEach(sub => {
          const subName = sub.title || sub.subCategory || 'Untitled Sub-SOP';
          const subKey = `${subName}|||${sopName}`;
          if (!subSopGroups[subKey]) subSopGroups[subKey] = { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0, parentSop: sopName };
          const subAgg = subSopGroups[subKey];
          sub.questions.forEach(q => {
            const ans = resolveAnswer(q.id);
            if (isAnswerNA(q, ans)) { agg.na++; subAgg.na++; return; }
            agg.questions++; subAgg.questions++;
            const mx = getQuestionMaxScore(q);
            agg.possible += mx; subAgg.possible += mx;
            if (ans && ans.selectedIndex !== null) {
              const mk = ans.marks || 0;
              agg.earned += mk; subAgg.earned += mk;
              if (mk < mx) { agg.findings++; subAgg.findings++; }
            }
            if (resolveRepeat(q.id)) { agg.repeats++; subAgg.repeats++; }
          });
        });
      });
    });

    _drawSummaryTable('Summary by Main SOPs', 'SOP Name', sopMainGroups, _scoreAsc(sopMainGroups));

    const subSopFlat: Record<string, SummGrp> = {};
    const subSopParentMap: Record<string, string> = {};
    Object.keys(subSopGroups).forEach(key => {
      const entry = subSopGroups[key];
      subSopFlat[key] = { questions: entry.questions, findings: entry.findings, repeats: entry.repeats, earned: entry.earned, possible: entry.possible, na: entry.na };
      subSopParentMap[key] = entry.parentSop;
    });
    _drawSummaryTable('Summary by Sub SOPs', 'Sub-SOP Name', subSopFlat, _scoreAsc(subSopFlat), (key) => {
      const parts = key.split('|||');
      const subName = parts[0];
      const parentSop = subSopParentMap[key] || parts[1] || '';
      return parentSop ? `${subName} (${parentSop.toUpperCase()})` : subName;
    });

    const riskGroups: Record<string, SummGrp> = {};
    pdfEffectivePages.forEach(page => {
      page.sections.forEach(section => {
        if (applicability[section.id] === false) return;
        _applicableSecQs(section).forEach(q => {
          const risk = q.risk || 'Untagged';
          if (!riskGroups[risk]) riskGroups[risk] = { questions: 0, findings: 0, repeats: 0, earned: 0, possible: 0, na: 0 };
          const ans = resolveAnswer(q.id);
          if (isAnswerNA(q, ans)) { riskGroups[risk].na++; return; }
          riskGroups[risk].questions++;
          riskGroups[risk].possible += getQuestionMaxScore(q);
          if (resolveRepeat(q.id)) riskGroups[risk].repeats++;
          if (ans && ans.selectedIndex !== null) {
            riskGroups[risk].earned += ans.marks || 0;
            if ((ans.marks || 0) < getQuestionMaxScore(q)) riskGroups[risk].findings++;
          }
        });
      });
    });
    _drawSummaryTable('Summary by Risk Level', 'Risk Level', riskGroups, _scoreAsc(riskGroups), (key) => key === 'Untagged' ? 'Untagged' : `${key} Risk`);

    // --- TOP 5 / BOTTOM 5 PERFORMERS ---
    {
      const allSectionScores: { name: string; pct: number; earned: number; possible: number }[] = [];
      const allSectionGroups = { ...subSopFlat, ...sopMainGroups };
      Object.keys(allSectionGroups).forEach(key => {
        const g = allSectionGroups[key];
        if (_isAllNA(g) || g.possible === 0) return;
        const pct = (g.earned / g.possible) * 100;
        const label = key.includes('|||') ? (() => { const p = key.split('|||'); return subSopParentMap[key] ? `${p[0]} (${subSopParentMap[key]})` : p[0]; })() : key;
        allSectionScores.push({ name: label, pct, earned: g.earned, possible: g.possible });
      });
      allSectionScores.sort((a, b) => a.pct - b.pct);

      if (allSectionScores.length >= 1) {
        checkPage(160);
        drawSectionHeader('Key Performers');
        const halfLen = Math.ceil(allSectionScores.length / 2);
        const bottomCount = Math.min(5, halfLen);
        const topCount = Math.min(5, allSectionScores.length - bottomCount);
        const bottom5 = allSectionScores.slice(0, bottomCount);
        const top5 = allSectionScores.slice(-topCount).reverse();
        const colW2 = (cw - 20) / 2;

        pdf.setFillColor(254, 242, 242); pdf.setDrawColor(252, 165, 165);
        pdf.roundedRect(ml, y, colW2, bottom5.length * 22 + 30, 3, 3, 'FD');
        pdf.setFontSize(8.5); pdf.setTextColor(185, 28, 28); pdf.setFont('helvetica', 'bold');
        pdf.text('BOTTOM PERFORMERS', ml + 10, y + 16);
        let by = y + 28;
        bottom5.forEach((item, i) => {
          const barW = colW2 - 80;
          const fillW = Math.max(2, (item.pct / 100) * barW);
          pdf.setFillColor(254, 226, 226); pdf.roundedRect(ml + 10, by, barW, 14, 2, 2, 'F');
          pdf.setFillColor(220, 38, 38); pdf.roundedRect(ml + 10, by, fillW, 14, 2, 2, 'F');
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(220, 38, 38);
          pdf.text(`${item.pct.toFixed(1)}%`, ml + barW + 16, by + 10);
          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
          const nameLines = pdf.splitTextToSize(item.name, barW - 8);
          pdf.text(nameLines[0], ml + 14, by + 10);
          by += 22;
        });

        if (top5.length > 0) {
          const topStartX = ml + colW2 + 20;
          pdf.setFillColor(240, 253, 244); pdf.setDrawColor(134, 239, 172);
          pdf.roundedRect(topStartX, y, colW2, top5.length * 22 + 30, 3, 3, 'FD');
          pdf.setFontSize(8.5); pdf.setTextColor(21, 128, 61); pdf.setFont('helvetica', 'bold');
          pdf.text('TOP PERFORMERS', topStartX + 10, y + 16);
          let ty = y + 28;
          top5.forEach((item, i) => {
            const barW = colW2 - 80;
            const fillW = Math.max(2, (item.pct / 100) * barW);
            pdf.setFillColor(220, 252, 231); pdf.roundedRect(topStartX + 10, ty, barW, 14, 2, 2, 'F');
            pdf.setFillColor(22, 163, 74); pdf.roundedRect(topStartX + 10, ty, fillW, 14, 2, 2, 'F');
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(22, 163, 74);
            pdf.text(`${item.pct.toFixed(1)}%`, topStartX + barW + 16, ty + 10);
            pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
            const nameLines = pdf.splitTextToSize(item.name, barW - 8);
            pdf.text(nameLines[0], topStartX + 14, ty + 10);
            ty += 22;
          });
        }

        y += Math.max(bottom5.length, top5.length) * 22 + 38;
      }
    }

    // --- COMPLIANCE DISTRIBUTION CHART ---
    {
      const buckets = [
        { label: '0%', min: 0, max: 0, color: [220, 38, 38] as [number, number, number], count: 0 },
        { label: '1-50%', min: 0.01, max: 50, color: [234, 88, 12] as [number, number, number], count: 0 },
        { label: '51-75%', min: 50.01, max: 75, color: [217, 119, 6] as [number, number, number], count: 0 },
        { label: '76-99%', min: 75.01, max: 99.99, color: [101, 163, 13] as [number, number, number], count: 0 },
        { label: '100%', min: 100, max: 100, color: [22, 163, 74] as [number, number, number], count: 0 },
      ];

      pdfEffectivePages.forEach(page => {
        page.sections.forEach((section: any) => {
          if (applicability[section.id] === false) return;
          _applicableSecQs(section).forEach((q: any) => {
            const ans = resolveAnswer(q.id);
            if (isAnswerNA(q, ans)) return;
            const mx = getQuestionMaxScore(q);
            if (mx <= 0) return;
            const earned = ans?.selectedIndex !== null ? (ans?.marks || 0) : 0;
            const pct = (earned / mx) * 100;
            if (pct === 0) buckets[0].count++;
            else if (pct <= 50) buckets[1].count++;
            else if (pct <= 75) buckets[2].count++;
            else if (pct < 100) buckets[3].count++;
            else buckets[4].count++;
          });
        });
      });

      const totalBucketQ = buckets.reduce((s, b) => s + b.count, 0);
      if (totalBucketQ > 0) {
        checkPage(140);
        drawSectionHeader('Compliance Distribution');
        const chartH = 110;
        pdf.setFillColor(248, 250, 252); pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(ml, y, cw, chartH, 3, 3, 'FD');

        const barAreaX = ml + 80;
        const barAreaW = cw - 120;
        const barH = 14;
        const barGap = 6;
        let cy = y + 12;

        buckets.forEach(bucket => {
          const fillW = totalBucketQ > 0 ? Math.max(0, (bucket.count / totalBucketQ) * barAreaW) : 0;
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(71, 85, 105);
          pdf.text(bucket.label, barAreaX - 8, cy + barH / 2 + 3, { align: 'right' });
          pdf.setFillColor(226, 232, 240); pdf.roundedRect(barAreaX, cy, barAreaW, barH, 2, 2, 'F');
          if (fillW > 0) {
            pdf.setFillColor(...bucket.color); pdf.roundedRect(barAreaX, cy, Math.max(4, fillW), barH, 2, 2, 'F');
          }
          pdf.setFontSize(7); pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(fillW > barAreaW * 0.4 ? 255 : bucket.color[0], fillW > barAreaW * 0.4 ? 255 : bucket.color[1], fillW > barAreaW * 0.4 ? 255 : bucket.color[2]);
          const countLabel = `${bucket.count} (${((bucket.count / totalBucketQ) * 100).toFixed(0)}%)`;
          if (fillW > barAreaW * 0.4) {
            pdf.text(countLabel, barAreaX + fillW / 2, cy + barH / 2 + 3, { align: 'center' });
          } else {
            pdf.text(countLabel, barAreaX + Math.max(4, fillW) + 6, cy + barH / 2 + 3);
          }
          cy += barH + barGap;
        });

        y += chartH + 12;
      }
    }

    // --- DEPARTMENT COMPARISON ---
    {
      const deptScores: { name: string; pct: number; obtained: number; max: number }[] = [];
      pdfEffectivePages.forEach((page, pgIdx) => {
        const ps = calculatePageScore(page);
        if (ps.max > 0) {
          deptScores.push({ name: page.title || `Department ${pgIdx + 1}`, pct: (ps.obtained / ps.max) * 100, obtained: ps.obtained, max: ps.max });
        }
      });
      deptScores.sort((a, b) => a.pct - b.pct);

      if (deptScores.length >= 1) {
        checkPage(60);
        drawSectionHeader('Department Comparison');

        const barAreaX = ml + 140;
        const barAreaW = cw - 200;
        const rowH2 = 22;

        deptScores.forEach((dept, dIdx) => {
          checkPage(rowH2 + 4);
          const fillW = Math.max(2, (dept.pct / 100) * barAreaW);
          const [rc2, gc2, bc2] = getRatingColor(dept.pct);

          if (dIdx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(ml, y, cw, rowH2, 'F'); }
          pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59);
          const nameLines = pdf.splitTextToSize(dept.name, 120);
          pdf.text(nameLines[0], ml + 10, y + rowH2 / 2 + 3);

          pdf.setFillColor(226, 232, 240); pdf.roundedRect(barAreaX, y + 3, barAreaW, rowH2 - 6, 2, 2, 'F');
          pdf.setFillColor(rc2, gc2, bc2); pdf.roundedRect(barAreaX, y + 3, fillW, rowH2 - 6, 2, 2, 'F');

          pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59);
          pdf.text(`${dept.pct.toFixed(1)}%  (${dept.obtained}/${dept.max})`, barAreaX + barAreaW + 8, y + rowH2 / 2 + 3);

          pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
          pdf.line(ml, y + rowH2, ml + cw, y + rowH2);
          y += rowH2;
        });
        y += 12;
      }
    }

    // --- REPEAT FINDINGS ANALYSIS ---
    {
      const repeatFindings: { question: string; department: string; responsibility: string; score: string; pct: number }[] = [];
      pdfEffectivePages.forEach((page, pgIdx) => {
        const deptName = page.title || `Department ${pgIdx + 1}`;
        page.sections.forEach((section: any) => {
          if (applicability[section.id] === false) return;
          _applicableSecQs(section).forEach((q: any) => {
            if (!resolveRepeat(q.id)) return;
            const ans = resolveAnswer(q.id);
            if (isAnswerNA(q, ans)) return;
            const mx = getQuestionMaxScore(q);
            const earned = ans?.selectedIndex !== null ? (ans?.marks || 0) : 0;
            const pct = mx > 0 ? (earned / mx) * 100 : 0;
            repeatFindings.push({
              question: q.text || 'Untitled',
              department: deptName,
              responsibility: (q.responsibility && q.responsibility.length > 0) ? q.responsibility.join(', ') : '—',
              score: `${earned}/${mx}`,
              pct,
            });
          });
        });
      });

      if (repeatFindings.length > 0) {
        repeatFindings.sort((a, b) => a.pct - b.pct);
        checkPage(60);
        drawSectionHeader(`Repeat Findings Analysis (${repeatFindings.length} items)`);

        const rfCols = [
          { label: 'Question', x: ml + 8, w: 220 },
          { label: 'Department', x: ml + 228, w: 100 },
          { label: 'Responsibility', x: ml + 328, w: 100 },
          { label: 'Score', x: ml + cw - 8, w: 50, align: 'right' },
        ];
        drawTableHeader(rfCols);

        repeatFindings.forEach((rf, idx) => {
          checkPage(18);
          const scoreColor: [number, number, number] = rf.pct >= 75 ? [22, 163, 74] : rf.pct >= 50 ? [217, 119, 6] : [220, 38, 38];
          drawTableRow([
            { text: rf.question, x: ml + 8, w: 220 },
            { text: rf.department, x: ml + 228, w: 100, color: [71, 85, 105] },
            { text: rf.responsibility, x: ml + 328, w: 100, color: [71, 85, 105] },
            { text: rf.score, x: ml + cw - 8, w: 50, align: 'right', bold: true, color: scoreColor },
          ], 16, idx % 2 === 0);
        });
        y += 8;
      }
    }

    pdfEffectivePages.forEach((page, pgIdx) => {
      const pgScore = calculatePageScore(page);
      const pgPctNum = pgScore.max > 0 ? (pgScore.obtained / pgScore.max) * 100 : 0;
      checkPage(30);
      pdf.setFillColor(71, 85, 105); pdf.rect(ml, y, cw, 24, 'F');
      pdf.setFontSize(10.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
      const locationLabel = `${(page.title || `Department ${pgIdx + 1}`).toUpperCase()}`;
      pdf.text(locationLabel, ml + 10, y + 16);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text(`${pgScore.obtained}/${pgScore.max} pts (${fmtPct(pgScore.obtained, pgScore.max)}%)`, ml + cw - 10, y + 16, { align: 'right' });
      y += 28;

      page.sections.forEach(section => {
        const isNA = applicability[section.id] === false;
        const score = calculateSectionScore(section);
        const secPctNum = score.max > 0 ? (score.obtained / score.max) * 100 : 0;

        checkPage(40);
        const sectionLabel = section.subCategory ? `${section.title || 'Untitled Policy'} › ${section.subCategory}` : `${section.title || 'Untitled Policy'}`;
        drawSectionHeader(sectionLabel, isNA ? undefined : parseFloat(fmtPct(score.obtained, score.max)), isNA ? undefined : score.obtained, isNA ? undefined : score.max);

        if (isNA) {
          checkPage(20);
          pdf.setFontSize(8); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'italic');
          pdf.text('This policy is marked as Not Applicable', ml + 8, y + 10);
          y += 20;
          return;
        }

        // --- Column layout for question table ---
        const QC1 = 185, QC_RESP = 60, QC_CAT = 55, QC2 = 110, QC3 = 52, QC4 = cw - 185 - 60 - 55 - 110 - 52;
        const QX1 = ml, QX_RESP = ml + QC1, QX_CAT = QX_RESP + QC_RESP, QX2 = QX_CAT + QC_CAT, QX3 = QX2 + QC2, QX4 = QX3 + QC3;
        const ROW_GAP = 4;
        const LINE_H = 11;
        const CELL_PAD_X = 7, CELL_PAD_TOP = 9;

        const drawQTableHeader = () => {
          checkPage(20);
          pdf.setFillColor(15, 23, 42); pdf.setDrawColor(15, 23, 42); pdf.setLineWidth(0.5);
          pdf.rect(QX1, y, QC1, 20, 'FD');
          pdf.rect(QX_RESP, y, QC_RESP, 20, 'FD');
          pdf.rect(QX_CAT, y, QC_CAT, 20, 'FD');
          pdf.rect(QX2, y, QC2, 20, 'FD');
          pdf.rect(QX3, y, QC3, 20, 'FD');
          pdf.rect(QX4, y, QC4, 20, 'FD');
          pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
          pdf.text('Question', QX1 + CELL_PAD_X, y + 13);
          pdf.text('Responsibility', QX_RESP + CELL_PAD_X, y + 13);
          pdf.text('Category', QX_CAT + CELL_PAD_X, y + 13);
          pdf.text('Observation', QX2 + CELL_PAD_X, y + 13);
          pdf.text('Earned', QX3 + QC3 / 2, y + 13, { align: 'center' });
          pdf.text('Possible', QX4 + QC4 / 2, y + 13, { align: 'center' });
          y += 20;
        };

        const sectionTitle = section.title || 'Untitled Policy';
        const redrawHeadersOnBreak = (needed: number) => {
          if (y + needed > ph - mb) {
            pdf.addPage(); pageNum++; y = mt;
            drawSectionHeader(`${sectionTitle} (cont.)`, isNA ? undefined : parseFloat(fmtPct(score.obtained, score.max)), isNA ? undefined : score.obtained, isNA ? undefined : score.max);
            drawQTableHeader();
          }
        };

        const _drawQuestionsInPdf = (qs: QuestionNode[]) => {
          if (qs.length === 0) return;
          qs.forEach((q) => {
          const ans = resolveAnswer(q.id);
          const qComment = resolveComment(q.id);
          const selectedResp = ans?.selectedIndex !== null && ans?.selectedIndex !== undefined ? q.responses[ans.selectedIndex] : null;
          const qNA = isAnswerNA(q, ans);
          const earned = qNA ? 0 : (ans?.marks || 0);
          const avail = qNA ? 0 : getQuestionMaxScore(q);

          let obsLabel = '—';
          let obsColor: [number, number, number] = [150, 150, 150];
          const isFullMarks = selectedResp && !qNA && earned >= avail && avail > 0;
          if (selectedResp) {
            obsLabel = selectedResp.text || 'Answered';
            if (qNA) obsColor = [148, 163, 184];
            else if (earned >= avail && avail > 0) obsColor = [22, 163, 74];
            else if (earned > 0 && earned < avail) obsColor = [217, 119, 6];
            else if (earned === 0 && avail > 0) obsColor = [220, 38, 38];
            else obsColor = [30, 41, 59];
          }

          const allEntries = (qComment?.entries || []).map(e => ({
            ...e,
            text: e.text || '',
            images: e.images || [],
            closureEvidence: e.closureEvidence || [],
            closureComments: e.closureComments || '',
            timestamp: e.timestamp || '',
          })).filter(e => e.text.trim() || e.images.length > 0 || e.closureComments.trim() || e.closureEvidence.length > 0);

          const boldPart = `(${q.risk} Risk) - `;
          const questionText = q.text || 'Untitled Question';
          const respText = (q.responsibility && q.responsibility.length > 0) ? q.responsibility.join(', ') : '—';
          const catText = q.category || '—';
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold');
          const prefW = pdf.getTextWidth(boldPart);
          const avail1stLine = QC1 - CELL_PAD_X * 2 - prefW;
          const fullLineW = QC1 - CELL_PAD_X * 2;
          pdf.setFont('helvetica', 'normal');
          const line1chunks = avail1stLine > 20 ? pdf.splitTextToSize(questionText, avail1stLine) : [];
          const firstLineQ = line1chunks.length > 0 ? line1chunks[0] : '';
          const remainingText = firstLineQ ? questionText.substring(firstLineQ.length).trim() : questionText;
          const remainingLines = remainingText ? pdf.splitTextToSize(remainingText, fullLineW) : [];
          const qTotalLines = avail1stLine > 20 ? (firstLineQ ? 1 + remainingLines.length : 1) : pdf.splitTextToSize(questionText, fullLineW).length + 1;

          const respLines = pdf.splitTextToSize(respText, QC_RESP - CELL_PAD_X * 2);
          const catLines = pdf.splitTextToSize(catText, QC_CAT - CELL_PAD_X * 2);
          const ansLines = pdf.splitTextToSize(obsLabel, QC2 - CELL_PAD_X * 2);
          const maxLines = Math.max(qTotalLines, ansLines.length, respLines.length, catLines.length);
          const rowH = Math.max(28, maxLines * LINE_H + CELL_PAD_TOP + 8);

          redrawHeadersOnBreak(rowH + ROW_GAP);

          pdf.setFillColor(255, 255, 255);
          pdf.setDrawColor(20, 24, 35);
          pdf.setLineWidth(1.1);
          pdf.rect(QX1, y, QC1, rowH, 'FD');
          pdf.rect(QX_RESP, y, QC_RESP, rowH, 'FD');
          pdf.rect(QX_CAT, y, QC_CAT, rowH, 'FD');
          pdf.rect(QX2, y, QC2, rowH, 'FD');
          pdf.rect(QX3, y, QC3, rowH, 'FD');
          pdf.rect(QX4, y, QC4, rowH, 'FD');

          const textY = y + CELL_PAD_TOP;
          pdf.setFontSize(7.5); pdf.setTextColor(30, 41, 59);
          pdf.setFont('helvetica', 'bold');
          pdf.text(boldPart, QX1 + CELL_PAD_X, textY);

          pdf.setFont('helvetica', 'normal');
          if (avail1stLine > 20 && firstLineQ) {
            pdf.text(firstLineQ, QX1 + CELL_PAD_X + prefW, textY);
            remainingLines.forEach((l: string, li: number) => {
              pdf.text(l, QX1 + CELL_PAD_X, textY + (li + 1) * LINE_H);
            });
          } else {
            const fallbackLines = pdf.splitTextToSize(questionText, fullLineW);
            fallbackLines.forEach((l: string, li: number) => {
              pdf.text(l, QX1 + CELL_PAD_X, textY + LINE_H + li * LINE_H);
            });
          }

          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(71, 85, 105);
          respLines.forEach((l: string, li: number) => {
            pdf.text(l, QX_RESP + CELL_PAD_X, textY + li * LINE_H);
          });

          pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(71, 85, 105);
          catLines.forEach((l: string, li: number) => {
            pdf.text(l, QX_CAT + CELL_PAD_X, textY + li * LINE_H);
          });

          // --- REPEAT badge inside question cell (bottom-left) ---
          if (resolveRepeat(q.id)) {
            pdf.setFillColor(225, 29, 72);
            pdf.roundedRect(QX1 + CELL_PAD_X, y + rowH - 13, 32, 9, 1, 1, 'F');
            pdf.setFontSize(5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
            pdf.text('REPEAT', QX1 + CELL_PAD_X + 16, y + rowH - 6, { align: 'center' });
          }

          // --- Observation column: colored dot indicator + vertically centred text ---
          const numY = y + rowH / 2 + 3;
          const dotR = 3.5;
          const dotX = QX2 + CELL_PAD_X + dotR + 1;
          const dotY = numY - 1;
          pdf.setFillColor(...obsColor);
          pdf.circle(dotX, dotY, dotR, 'F');
          pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...obsColor);
          if (ansLines.length === 1) {
            pdf.text(ansLines[0], dotX + dotR + 4, numY);
          } else {
            const blockH = (ansLines.length - 1) * LINE_H;
            ansLines.forEach((l: string, li: number) => {
              pdf.text(l, dotX + dotR + 4, numY - blockH / 2 + li * LINE_H);
            });
          }

          // --- Earned & Avail columns (vertically centered) ---
          pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
          if (qNA) {
            pdf.setTextColor(148, 163, 184);
            pdf.text('NA', QX3 + QC3 / 2, numY, { align: 'center' });
            pdf.text('NA', QX4 + QC4 / 2, numY, { align: 'center' });
          } else {
            pdf.setTextColor(30, 41, 59);
            pdf.text(String(earned), QX3 + QC3 / 2, numY, { align: 'center' });
            pdf.text(String(avail), QX4 + QC4 / 2, numY, { align: 'center' });
          }

          y += rowH + ROW_GAP;

          if (allEntries.length > 0) {
            const colCount = Math.min(allEntries.length, 2);
            const colW = cw / colCount;
            const colGap = 0;

            for (let rowStart = 0; rowStart < allEntries.length; rowStart += colCount) {
              const rowEntries = allEntries.slice(rowStart, rowStart + colCount);

              const commentLabel = isFullMarks ? 'Compliance Evidence:' : 'Opportunity for Improvement:';
              const commentLabelColor: [number, number, number] = isFullMarks ? [22, 163, 74] : [217, 119, 6];

              const colHeights: number[] = [];
              const colData = rowEntries.map((entry, ci) => {
                const textW = colW - 16;
                const corrNote = (entry.corrections?.length ?? 0) > 0
                  ? `\n[Corrected: ${entry.corrections![entry.corrections!.length - 1].reason}]`
                  : '';
                const displayText = entry.text.trim() ? entry.text.trim() + corrNote : (corrNote ? corrNote.trim() : '');
                const textLines = displayText ? pdf.splitTextToSize(displayText, textW) : [];
                const closureLines = entry.closureComments?.trim() ? pdf.splitTextToSize(entry.closureComments.trim(), textW) : [];
                const obsImgs = entry.images || [];
                const closureImgs = entry.closureEvidence || [];
                const hasObs = textLines.length > 0 || obsImgs.length > 0;
                const hasClosure = closureLines.length > 0 || closureImgs.length > 0;

                const thumbSize = Math.min(90, (colW - 24) / 2);
                const thumbGap = 6;

                let h = 18;
                if (entry.location) h += 10;
                if (entry.isRepeat) {
                  h += 16;
                  if (entry.repeatTrail && entry.repeatTrail.length > 0) h += 10;
                }
                if (hasObs) {
                  h += 12;
                  h += textLines.length * 9;
                  if (obsImgs.length > 0) {
                    const imgRows = Math.ceil(obsImgs.length / 2);
                    h += imgRows * (thumbSize + thumbGap) + 4;
                  }
                }
                if (hasClosure) {
                  h += 12;
                  h += closureLines.length * 9;
                  if (closureImgs.length > 0) {
                    const imgRows = Math.ceil(closureImgs.length / 2);
                    h += imgRows * (thumbSize + thumbGap) + 4;
                  }
                }
                h += 4;
                colHeights.push(h);
                return { entry, textLines, closureLines, obsImgs, closureImgs, hasObs, hasClosure };
              });

              const rowH = Math.max(...colHeights);
              checkPage(Math.min(rowH, ph - mb - mt - 20));

              y += 3;
              colData.forEach((col, ci) => {
                const xBase = ml + ci * colW;

                pdf.setFillColor(250, 251, 253);
                pdf.setDrawColor(20, 24, 35); pdf.setLineWidth(1.1);
                pdf.rect(xBase, y, colW, rowH, 'FD');

                let cy = y + 4;

                pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(100, 116, 139);
                const tsLabel = col.entry.timestamp ? new Date(col.entry.timestamp).toLocaleString() : '';
                pdf.text(`#${rowStart + ci + 1}${tsLabel ? ` — ${tsLabel}` : ''}`, xBase + 6, cy + 5);
                cy += 10;
                if (col.entry.location) {
                  pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(99, 102, 241);
                  pdf.text(`Location: ${col.entry.location}`, xBase + 6, cy + 4);
                  cy += 10;
                } else {
                  cy += 2;
                }

                if (col.entry.isRepeat) {
                  pdf.setFillColor(255, 237, 213);
                  pdf.setDrawColor(251, 146, 60);
                  pdf.setLineWidth(0.5);
                  const repeatBoxW = colW - 12;
                  let repeatH = 12;
                  const trailEntries = col.entry.repeatTrail || [];
                  if (trailEntries.length > 0) repeatH += 10;
                  pdf.roundedRect(xBase + 6, cy, repeatBoxW, repeatH, 1, 1, 'FD');
                  pdf.setFillColor(225, 29, 72);
                  pdf.roundedRect(xBase + 8, cy + 2, 30, 8, 1, 1, 'F');
                  pdf.setFontSize(5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
                  pdf.text('REPEAT', xBase + 23, cy + 7.5, { align: 'center' });
                  if (col.entry.repeatOriginalDate) {
                    pdf.setFontSize(5.5); pdf.setTextColor(194, 65, 12); pdf.setFont('helvetica', 'bold');
                    pdf.text(`Since ${col.entry.repeatOriginalDate}`, xBase + 42, cy + 7.5);
                  }
                  if (trailEntries.length > 0) {
                    pdf.setFontSize(5); pdf.setTextColor(154, 52, 18); pdf.setFont('helvetica', 'normal');
                    const trailText = trailEntries.map((t: any) => t.date).join(' → ');
                    const trailLines = pdf.splitTextToSize(`Trail: ${trailText}`, repeatBoxW - 8);
                    trailLines.forEach((line: string, li: number) => {
                      pdf.text(line, xBase + 8, cy + 17 + li * 7);
                    });
                  }
                  cy += repeatH + 4;
                }

                const tSz = Math.min(90, (colW - 24) / 2);
                const tGap = 6;

                if (col.hasObs) {
                  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...commentLabelColor);
                  pdf.text(commentLabel, xBase + 6, cy + 4);
                  cy += 10;

                  if (col.textLines.length > 0) {
                    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
                    col.textLines.forEach((line: string) => {
                      pdf.text(line, xBase + 6, cy + 3);
                      cy += 9;
                    });
                  }

                  if (col.obsImgs.length > 0) {
                    cy += 2;
                    col.obsImgs.forEach((img: string, imgIdx: number) => {
                      const imgCol = imgIdx % 2;
                      if (imgCol === 0 && imgIdx > 0) cy += tSz + tGap;
                      const imgX = xBase + 6 + imgCol * (tSz + tGap);
                      try { pdf.addImage(img, 'JPEG', imgX, cy, tSz, tSz); } catch { }
                    });
                    cy += tSz + 4;
                  }
                }

                if (col.hasClosure) {
                  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(22, 163, 74);
                  pdf.text('Closure:', xBase + 6, cy + 4);
                  cy += 10;

                  if (col.closureLines.length > 0) {
                    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(30, 41, 59);
                    col.closureLines.forEach((line: string) => {
                      pdf.text(line, xBase + 6, cy + 3);
                      cy += 9;
                    });
                  }

                  if (col.closureImgs.length > 0) {
                    cy += 2;
                    col.closureImgs.forEach((img: string, imgIdx: number) => {
                      const imgCol = imgIdx % 2;
                      if (imgCol === 0 && imgIdx > 0) cy += tSz + tGap;
                      const imgX = xBase + 6 + imgCol * (tSz + tGap);
                      try { pdf.addImage(img, 'JPEG', imgX, cy, tSz, tSz); } catch { }
                    });
                    cy += tSz + 4;
                  }
                }
              });

              y += rowH + 4;
            }
          }
        });
        };

        if (section.questions.length > 0) {
          drawQTableHeader();
          _drawQuestionsInPdf(section.questions);
        }

        (section.subSections || []).forEach(subSec => {
          checkPage(22);
          pdf.setFillColor(139, 92, 246); pdf.rect(ml + 8, y, cw - 16, 18, 'F');
          pdf.setFontSize(8); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
          pdf.text(`Sub-Category: ${subSec.title || 'Untitled'}${subSec.subCategory ? ` › ${subSec.subCategory}` : ''}`, ml + 16, y + 12);
          const subScore = { obtained: 0, max: 0 };
          subSec.questions.forEach(sq => {
            const sa = answers[sq.id]; const sqNA = isAnswerNA(sq, sa);
            if (!sqNA) { subScore.max += getQuestionMaxScore(sq); if (sa?.selectedIndex !== null) subScore.obtained += sa?.marks || 0; }
          });
          if (subScore.max > 0) {
            pdf.setFontSize(7.5);
            pdf.text(`${subScore.obtained}/${subScore.max} pts (${fmtPct(subScore.obtained, subScore.max)}%)`, ml + cw - 16, y + 12, { align: 'right' });
          }
          y += 22;
          drawQTableHeader();
          _drawQuestionsInPdf(subSec.questions);
        });

        y += 6;
      });
    });

    if (auditSignature || reviewerSignature) {
      checkPage(180);
      drawSectionHeader('Signatures');
      const sigBlockW = (cw - 30) / 2;

      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(30, 41, 59);
      pdf.text('Audited By', ml + 8, y + 12);
      pdf.text('Reviewed By', ml + 18 + sigBlockW, y + 12);
      y += 20;

      if (auditSignature) {
        try {
          const sigFmt = auditSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(auditSignature, sigFmt, ml + 8, y, 160, 55);
        } catch { }
      }
      if (reviewerSignature) {
        try {
          const sigFmt = reviewerSignature.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(reviewerSignature, sigFmt, ml + 18 + sigBlockW, y, 160, 55);
        } catch { }
      }
      y += 62;

      pdf.setDrawColor(30, 41, 59); pdf.setLineWidth(0.5);
      pdf.line(ml + 8, y, ml + 8 + sigBlockW - 10, y);
      pdf.line(ml + 18 + sigBlockW, y, ml + 18 + sigBlockW + sigBlockW - 10, y);
      y += 12;

      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(71, 85, 105);
      pdf.text(`Name: ${unitForm.repName || '—'}`, ml + 8, y);
      pdf.text(`Name: ${reviewerName || '—'}`, ml + 18 + sigBlockW, y);
      y += 12;
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, ml + 8, y);
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, ml + 18 + sigBlockW, y);
      y += 16;
    }

    const totalPagesCount = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPagesCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7); pdf.setTextColor(150, 150, 150); pdf.setFont('helvetica', 'normal');
      pdf.text(`${i}/${totalPagesCount}`, pw / 2, ph - 20, { align: 'center' });
      pdf.setDrawColor(226, 232, 240); pdf.setLineWidth(0.3);
      pdf.line(ml, ph - 30, pw - mr, ph - 30);
      if (isDraftReport) {
        pdf.saveGraphicsState();
        const gState = new (pdf as any).GState({ opacity: 0.06 });
        pdf.setGState(gState);
        pdf.setFontSize(72); pdf.setTextColor(245, 158, 11); pdf.setFont('helvetica', 'bold');
        pdf.text('DRAFT', pw / 2, ph / 2, { align: 'center', angle: 45 });
        pdf.restoreGraphicsState();
      }
    }

    const reportLabel = isDraftReport ? 'Draft' : 'Final';
    const fileName = options?.fileNameOverride
      || `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${reportLabel}_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    savePdfForPWA(pdf, fileName);
   } catch (err) {
    console.error('PDF generation failed:', err);
    alert('PDF generation failed. Please try again. If the issue persists, try using Force Sync first, then download.');
   }
  };

  const generatePerDepartmentReports = async () => {
    if (isCombinedAudit && combinedLocations && combinedLocations.length > 1) {
      if (isLocationMode && locationGroupedByDept) {
        for (const { deptName, items } of locationGroupedByDept) {
          const deptPages = items.flatMap(item => item.pages);
          const safeDeptName = deptName.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeDeptName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
          const locNames = items.map(i => i.locationName).join(', ');
          await generateAuditReport({
            overridePages: deptPages,
            fileNameOverride: fileName,
            reportSubtitle: `Department: ${deptName} | Locations: ${locNames}`,
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        const uniqueDepts = Array.from(new Set(
          combinedLocations.map(loc => loc.includes(' › ') ? loc.split(' › ')[0] : loc)
        ));
        const pageTitleSet = new Set(template.pages.map(p => p.title));
        const matchedDepts = uniqueDepts.filter(d => pageTitleSet.has(d));
        if (matchedDepts.length === 0) {
          generateAuditReport();
          return;
        }
        for (const deptName of matchedDepts) {
          const safeDeptName = deptName.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeDeptName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
          await generateAuditReport({
            filterPageTitles: [deptName],
            fileNameOverride: fileName,
            reportSubtitle: `Department: ${deptName}`,
          });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else if (template.pages.length > 1) {
      const applicablePages = template.pages.filter(p => pageApplicability[p.id] !== false);
      for (const page of applicablePages) {
        const deptName = page.title;
        const safeDeptName = deptName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeDeptName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
        await generateAuditReport({
          filterPageTitles: [deptName],
          fileNameOverride: fileName,
          reportSubtitle: `Department: ${deptName}`,
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } else {
      generateAuditReport();
    }
  };

  const generatePerLocationReports = async () => {
    if (!isLocationMode || !locationVirtualPages || locationVirtualPages.length === 0) {
      generateAuditReport();
      return;
    }
    for (const { locationName, pages: locPages } of locationVirtualPages) {
      const safeLocName = locationName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeLocName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      await generateAuditReport({
        overridePages: locPages,
        fileNameOverride: fileName,
        reportSubtitle: `Location: ${locationName}`,
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const downloadableDepts = useMemo(() => {
    if (isCombinedAudit && combinedLocations && combinedLocations.length > 1) {
      if (isLocationMode && locationGroupedByDept) {
        return locationGroupedByDept.map(g => g.deptName);
      }
      const uniqueDepts = Array.from(new Set(
        combinedLocations.map(loc => loc.includes(' › ') ? loc.split(' › ')[0] : loc)
      ));
      const pageTitleSet = new Set(template.pages.map(p => p.title));
      return uniqueDepts.filter(d => pageTitleSet.has(d));
    }
    if (template.pages.length > 1) {
      return template.pages.filter(p => pageApplicability[p.id] !== false).map(p => p.title);
    }
    return [];
  }, [isCombinedAudit, combinedLocations, isLocationMode, locationGroupedByDept, template.pages, pageApplicability]);

  const downloadableSections = useMemo(() => {
    if (downloadableDepts.length > 0) return [];
    if (template.pages.length === 1 && pageApplicability[template.pages[0].id] !== false) {
      const page = template.pages[0];
      const secs = page.sections.filter(s => applicability[s.id] !== false);
      if (secs.length > 1) return secs.map(s => s.title || 'Untitled');
    }
    return [];
  }, [downloadableDepts, template.pages, applicability, pageApplicability]);

  useEffect(() => {
    if (autoTriggerDownload && !loadingFromDb) {
      const hasMultipleDownloads = downloadableDepts.length > 1 || downloadableSections.length > 1;
      if (hasMultipleDownloads && !autoDownloadMode) {
        setAutoTriggerPaused(true);
        return;
      }
      const waitForSync = () => {
        if (!dbSyncCheckDone.current) {
          return new Promise<void>(resolve => {
            const iv = setInterval(() => {
              if (dbSyncCheckDone.current) { clearInterval(iv); resolve(); }
            }, 50);
            setTimeout(() => { clearInterval(iv); dbSyncCheckDone.current = true; resolve(); }, 8000);
          });
        }
        return Promise.resolve();
      };
      const runDownload = async () => {
        if (autoDownloadMode === 'per-department') {
          await generatePerDepartmentReports();
        } else if (autoDownloadMode === 'per-section') {
          await generatePerSectionReports();
        } else if (autoDownloadMode === 'per-location') {
          await generatePerLocationReports();
        } else {
          await generateAuditReport();
        }
      };
      const timer = setTimeout(() => {
        waitForSync().then(() => runDownload()).then(() => onClose()).catch((err) => {
          console.error('[audit] Auto-download report failed:', err);
          onClose();
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerDownload, loadingFromDb, downloadableDepts.length, downloadableSections.length]);

  const generatePerSectionReports = async () => {
    if (template.pages.length !== 1) { generateAuditReport(); return; }
    const page = template.pages[0];
    const secs = page.sections.filter(s => applicability[s.id] !== false);
    for (const sec of secs) {
      const secName = sec.title || 'Untitled';
      const safeName = secName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${safeName}_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      const virtualPage = { ...page, sections: [sec], title: secName };
      await generateAuditReport({ overridePages: [virtualPage], fileNameOverride: fileName, reportSubtitle: `Section: ${secName}` });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [autoTriggerPaused, setAutoTriggerPaused] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handle = (e: MouseEvent) => { if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) setDownloadMenuOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [downloadMenuOpen]);
  useEffect(() => {
    if (autoTriggerPaused) {
      setDownloadMenuOpen(true);
    }
  }, [autoTriggerPaused]);

  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMatches = useMemo(() => {
    if (!searchTerm.trim()) return [] as { questionId: string; pageId: string; sectionId: string; subSectionId?: string; text: string; context: string; deptName?: string; locationName?: string }[];
    const term = searchTerm.toLowerCase();
    const results: { questionId: string; pageId: string; sectionId: string; subSectionId?: string; text: string; context: string; deptName?: string; locationName?: string }[] = [];
    const isOldAlias = (qText: string) => aliasedOldTexts.has(qText.toLowerCase().trim());
    if (isLocationMode && locationVirtualPages && locationVirtualPages.length > 0 && locationGroupedByDept) {
      for (const { deptName, items } of locationGroupedByDept) {
        for (const { locationName, pages: locPages } of items) {
          (locPages as any[]).forEach((page: any) => {
            (page.sections || []).forEach((section: any) => {
              const addMatch = (q: any, subId?: string) => {
                if (isOldAlias(q.text || '')) return;
                if (q.text.toLowerCase().includes(term) || (q.requirement || '').toLowerCase().includes(term) || (q.category || '').toLowerCase().includes(term)) {
                  const baseTitle = page.title?.includes('::') ? page.title.split('::').pop() : page.title;
                  results.push({ questionId: q.id, pageId: page.id, sectionId: section.id, subSectionId: subId, text: q.text, context: `${baseTitle} > ${section.title}`, deptName, locationName });
                }
              };
              (section.questions || []).forEach((q: any) => addMatch(q));
              (section.subSections || []).forEach((ss: any) => {
                (ss.questions || []).forEach((q: any) => addMatch(q, ss.id));
              });
            });
          });
        }
      }
    } else {
      template.pages.forEach(page => {
        page.sections.forEach(section => {
          const addMatch = (q: QuestionNode, subId?: string) => {
            if (isOldAlias(q.text || '')) return;
            if (q.text.toLowerCase().includes(term) || (q.requirement || '').toLowerCase().includes(term) || (q.category || '').toLowerCase().includes(term)) {
              results.push({ questionId: q.id, pageId: page.id, sectionId: section.id, subSectionId: subId, text: q.text, context: `${page.title} > ${section.title}` });
            }
          };
          (section.questions || []).forEach(q => addMatch(q));
          (section.subSections || []).forEach(ss => {
            (ss.questions || []).forEach(q => addMatch(q, ss.id));
          });
        });
      });
    }
    return results;
  }, [searchTerm, template.pages, isLocationMode, locationVirtualPages, locationGroupedByDept, aliasedOldTexts]);

  const navigateToMatch = useCallback((idx: number) => {
    const match = searchMatches[idx];
    if (!match) return;
    setSearchMatchIdx(idx);
    if (match.deptName && match.locationName) {
      setOpenDeptKey(match.deptName);
      const locKey = `${match.deptName}::${match.locationName}`;
      setOpenLocationKey(locKey);
      setOpenSectionKey(match.sectionId);
      if (match.subSectionId) setOpenSubSectionKey(match.subSectionId);
    } else {
      setCollapsed(prev => {
        const next = { ...prev };
        next[match.pageId] = false;
        return next;
      });
      setOpenSectionKey(match.sectionId);
      if (match.subSectionId) setOpenSubSectionKey(match.subSectionId);
    }
    setTimeout(() => {
      const el = document.querySelector(`[data-question-id="${match.questionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-cyan-400', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400', 'ring-offset-2'), 2000);
      }
    }, 250);
  }, [searchMatches]);
  const excelMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!excelMenuOpen) return;
    const handle = (e: MouseEvent) => { if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) setExcelMenuOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [excelMenuOpen]);

  const exportQuestionsToExcel = async (groupBy: 'department' | 'responsibility' | 'location') => {
    setExcelMenuOpen(false);
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();

    type RowData = { page: string; section: string; subSection: string; question: string; requirement: string; risk: string; category: string; responsibility: string; maxMarks: number };
    const allRows: RowData[] = [];

    template.pages.forEach(page => {
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
      { header: 'SectionTitle', key: 'section', width: 25 },
      { header: 'SubSectionTitle', key: 'subSection', width: 22 },
      { header: 'QuestionText', key: 'question', width: 40 },
      { header: 'StandardRequirement', key: 'requirement', width: 35 },
      { header: 'QuestionRisk', key: 'risk', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Responsibility', key: 'responsibility', width: 28 },
      { header: 'MaximumMarks', key: 'maxMarks', width: 14 },
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
    const label = groupBy === 'location' ? 'Location' : groupBy === 'department' ? 'Department' : 'Responsibility';
    link.href = URL.createObjectURL(blob);
    link.download = `${(template.title || 'Audit_Checklist').replace(/[^a-zA-Z0-9]/g, '_')}_By_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleGetLocation = () => {
    updateUnit('geotag', 'Fetching...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => updateUnit('geotag', `Lat: ${pos.coords.latitude.toFixed(5)}, Lon: ${pos.coords.longitude.toFixed(5)}`),
        () => updateUnit('geotag', 'Error fetching location.')
      );
    } else updateUnit('geotag', 'Geolocation not supported.');
  };

  const handleOpenNotes = () => {
    setNotesBestPractice(savedNotes.bestPractice); setNotesOpportunity(savedNotes.opportunity);
    setNotesBPImages(savedNotes.bestPracticeImages || []); setNotesOFIImages(savedNotes.opportunityImages || []);
    setNotesBPCollapsed(false); setNotesOFICollapsed(false); setNotesOpen(true);
  };
  const handleSaveNotes = () => { setSavedNotes({ bestPractice: notesBestPractice, opportunity: notesOpportunity, bestPracticeImages: notesBPImages, opportunityImages: notesOFIImages }); setNotesOpen(false); };

  const handleNotesImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'bp' | 'ofi') => {
    const files = e.target.files;
    if (!files) return;
    const setter = target === 'bp' ? setNotesBPImages : setNotesOFIImages;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          setter(prev => [...prev, compressed]);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) setter(prev => [...prev, raw]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  const handleCancelNotes = () => setNotesOpen(false);

  const handleProceedToChecklist = () => { setCurrentStep('checklist'); setTimeout(() => scrollRef.current?.scrollTo(0, 0), 0); };
  const handleBackToUnitDetails = () => { setCurrentStep('unit-details'); setTimeout(() => scrollRef.current?.scrollTo(0, 0), 0); };

  const handleHeaderClick = (id: string) => {
    const isPage = template.pages.some(p => p.id === id);
    setCollapsed(prev => {
      const next = { ...prev };
      if (isPage) {
        const willExpand = prev[id];
        template.pages.forEach(p => {
          next[p.id] = true;
          p.sections.forEach(s => {
            next[s.id] = true;
            (s.subSections || []).forEach(sub => { next[sub.id] = true; });
          });
        });
        if (willExpand) next[id] = false;
      } else {
        const parentPage = template.pages.find(p => p.sections.some(s => s.id === id));
        if (parentPage) {
          const willExpand = prev[id];
          parentPage.sections.forEach(s => {
            next[s.id] = true;
            (s.subSections || []).forEach(sub => { next[sub.id] = true; });
          });
          if (willExpand) next[id] = false;
        } else {
          const parentSec = template.pages.flatMap(p => p.sections).find(s => (s.subSections || []).some(sub => sub.id === id));
          if (parentSec) {
            const willExpand = prev[id];
            (parentSec.subSections || []).forEach(sub => { next[sub.id] = true; });
            if (willExpand) next[id] = false;
          } else {
            next[id] = !prev[id];
          }
        }
      }
      return next;
    });
    setActiveHeaderId(prev => prev === id ? null : id);
    const willExpand = collapsed[id] !== false;
    if (willExpand) {
      setTimeout(() => {
        const el = document.querySelector(`[data-accordion-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const scrollToAccordion = (id: string) => {
    setTimeout(() => {
      const el = document.querySelector(`[data-accordion-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const getQuestionMaxScore = (q: QuestionNode): number => {
    let best = 0;
    q.responses.forEach(r => {
      const isNA = r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/';
      if (!isNA) {
        const v = parseFloat(r.score) || 0;
        if (v > best) best = v;
      }
    });
    return best;
  };

  const liveObservations = React.useMemo((): import('../types').AuditObservation[] => {
    const obs: import('../types').AuditObservation[] = [];
    const effectivePages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    effectivePages.forEach(page => {
      if (pageApplicability[page.id] === false) return;
      page.sections.forEach(section => {
        if (applicability[section.id] === false) return;
        const buildObsForQ = (q: QuestionNode, secTitle: string) => {
          const ans = resolveAnswer(q.id);
          const qComment = resolveComment(q.id);
          const entries = qComment?.entries?.filter(e =>
            (e.text && e.text.trim()) || (e.images && e.images.length > 0) ||
            (e.closureComments && e.closureComments.trim()) || (e.closureEvidence && e.closureEvidence.length > 0)
          ) || [];
          if (entries.length === 0) return;
          const maxScore = getQuestionMaxScore(q);
          const obtained = (ans && ans.selectedIndex !== null) ? (ans.marks || 0) : 0;
          const selectedLabel = (ans && ans.selectedIndex !== null && q.responses[ans.selectedIndex])
            ? q.responses[ans.selectedIndex].text : '';
          entries.forEach((entry) => {
            const hasClosure = (entry.closureComments && entry.closureComments.trim().length > 0) || (entry.closureEvidence && entry.closureEvidence.length > 0);
            obs.push({
              questionId: q.id,
              questionText: q.text,
              sectionTitle: secTitle,
              pageTitle: page.title,
              marksObtained: obtained,
              marksMax: maxScore,
              selectedResponse: selectedLabel,
              comment: entry.text || '',
              images: entry.images || [],
              location: entry.location || locationTags[q.id] || '',
              department: template.department || auditLocationName || '',
              risk: q.risk || section.risk || '',
              category: q.category || section.category || '',
              closureStatus: hasClosure ? 'Closed' : 'Open',
              closureComments: entry.closureComments || undefined,
              closureEvidence: entry.closureEvidence && entry.closureEvidence.length > 0 ? entry.closureEvidence : undefined,
              responsibility: q.responsibility || [],
              checklistName: template.title || '',
              entryId: entry.id,
              selectedResponseIndex: entry.selectedResponseIndex ?? ans?.selectedIndex ?? null,
              createdAtMs: (entry as any).createdAtMs || 0,
              isRepeat: entry.isRepeat || undefined,
              repeatOriginalDate: entry.repeatOriginalDate || undefined,
              repeatTrail: entry.repeatTrail || undefined,
              repeatSourceId: entry.repeatSourceId || undefined,
              managementTag: entry.managementTag || obsTags[entry.id] || undefined,
              resourceRequired: (entry as any).resourceRequired || undefined,
              savedToDb: (entry as any).savedToDb || false,
            } as any);
          });
        };
        (section.questions || []).forEach(q => buildObsForQ(q, section.title || 'Section'));
        (section.subSections || []).forEach(sub => {
          if (applicability[sub.id] === false) return;
          (sub.questions || []).forEach(q => buildObsForQ(q, `${section.title || 'Section'} > ${sub.title || 'Sub'}`));
        });
      });
    });
    const seenEntryIds = new Set<string>();
    return obs.filter(o => {
      if (!o.entryId) return true;
      if (seenEntryIds.has(o.entryId)) return false;
      seenEntryIds.add(o.entryId);
      return true;
    });
  }, [answers, comments, applicability, pageApplicability, template, locationTags, auditLocationName, isLocationMode, locationVirtualPages, obsTags]);

  const liveObsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onObsChangeRef = useRef(onObservationsChange);
  onObsChangeRef.current = onObservationsChange;
  useEffect(() => {
    if (!onObsChangeRef.current) return;
    if (liveObsDebounceRef.current) clearTimeout(liveObsDebounceRef.current);
    liveObsDebounceRef.current = setTimeout(() => {
      onObsChangeRef.current?.(liveObservations);
    }, 1500);
    return () => { if (liveObsDebounceRef.current) clearTimeout(liveObsDebounceRef.current); };
  }, [liveObservations]);

  type ObsDetail = { comment: string; dept: string; location: string; response: string; images: string[] };
  type ConcernItem = { questionId: string; questionText: string; sectionTitle: string; count: number; risk: string; category: string; selectedResponses: string[]; details: ObsDetail[] };
  type ConcernScope = { scopeKey: string; dept: string; location: string; concerns: ConcernItem[] };
  type DeptLocationGroup = { dept: string; totalObs: number; deptConcerns: ConcernItem[]; locations: ConcernScope[] };

  const [concernSectionOpen, setConcernSectionOpen] = useState<Record<string, boolean>>({ hotel: true, responsibility: false, department: false, deptLocation: false });
  const [concernQExpanded, setConcernQExpanded] = useState<Record<string, boolean>>({});
  const [concernLocExpanded, setConcernLocExpanded] = useState<Record<string, boolean>>({});

  const { topConcernsByScope, hotelTopConcerns, responsibilityTopConcerns, deptTopConcerns, deptLocationGroups } = React.useMemo(() => {
    const isNA = (resp: string) => { const r = (resp || '').toLowerCase().trim(); return r === 'n/a' || r === 'na' || r === 'not applicable'; };
    const isConcern = (obs: import('../types').AuditObservation) => {
      if (isNA(obs.selectedResponse)) return false;
      if (obs.marksMax > 0 && obs.marksObtained >= obs.marksMax) return false;
      return true;
    };
    const concernObs = liveObservations.filter(isConcern);
    const scopeMap: Record<string, Record<string, ConcernItem>> = {};
    const hotelMap: Record<string, ConcernItem & { dept: string; location: string }> = {};
    const respMap: Record<string, Record<string, ConcernItem>> = {};
    const deptMap: Record<string, Record<string, ConcernItem>> = {};
    const addToConcernMap = (map: Record<string, Record<string, ConcernItem>>, key: string, baseQId: string, obs: import('../types').AuditObservation) => {
      if (!map[key]) map[key] = {};
      if (!map[key][baseQId]) {
        map[key][baseQId] = { questionId: obs.questionId, questionText: clTabQuestionTextRemap[obs.questionText] || obs.questionText, sectionTitle: obs.sectionTitle, count: 0, risk: obs.risk, category: obs.category, selectedResponses: [], details: [] };
      }
      map[key][baseQId].count += 1;
      if (obs.selectedResponse && !map[key][baseQId].selectedResponses.includes(obs.selectedResponse)) {
        map[key][baseQId].selectedResponses.push(obs.selectedResponse);
      }
      map[key][baseQId].details.push({ comment: obs.comment || '', dept: obs.pageTitle || obs.department || '', location: obs.location || '', response: obs.selectedResponse || '', images: obs.images || [] });
    };
    concernObs.forEach(obs => {
      const dept = obs.pageTitle || 'General';
      const loc = obs.location || '';
      const baseQId = obs.questionId.includes('::') ? obs.questionId.split('::').pop()! : obs.questionId;
      const scopeKey = loc ? `${dept}|||${loc}` : dept;
      addToConcernMap(scopeMap, scopeKey, baseQId, obs);
      if (!hotelMap[baseQId]) {
        hotelMap[baseQId] = { questionId: obs.questionId, questionText: clTabQuestionTextRemap[obs.questionText] || obs.questionText, sectionTitle: obs.sectionTitle, count: 0, risk: obs.risk, category: obs.category, selectedResponses: [], details: [], dept, location: loc };
      }
      hotelMap[baseQId].count += 1;
      if (obs.selectedResponse && !hotelMap[baseQId].selectedResponses.includes(obs.selectedResponse)) {
        hotelMap[baseQId].selectedResponses.push(obs.selectedResponse);
      }
      hotelMap[baseQId].details.push({ comment: obs.comment || '', dept, location: loc, response: obs.selectedResponse || '', images: obs.images || [] });
      const respList = obs.responsibility && obs.responsibility.length > 0 ? obs.responsibility : ['Unassigned'];
      respList.forEach(r => addToConcernMap(respMap, r, baseQId, obs));
      addToConcernMap(deptMap, dept, baseQId, obs);
    });
    const buildScopes = (map: Record<string, Record<string, ConcernItem>>, hasSplit: boolean): ConcernScope[] => {
      const result: ConcernScope[] = [];
      Object.entries(map).forEach(([key, qMap]) => {
        const [d, l] = hasSplit && key.includes('|||') ? key.split('|||') : [key, ''];
        const sorted = Object.values(qMap).sort((a, b) => b.count - a.count).slice(0, 5);
        if (sorted.length > 0) result.push({ scopeKey: key, dept: d, location: l, concerns: sorted });
      });
      result.sort((a, b) => a.dept.localeCompare(b.dept) || a.location.localeCompare(b.location));
      return result;
    };
    const allScopes = buildScopes(scopeMap, true);
    const locScopes = allScopes.filter(s => s.location);
    const deptGroups: DeptLocationGroup[] = [];
    const deptGroupMap: Record<string, DeptLocationGroup> = {};
    locScopes.forEach(scope => {
      if (!deptGroupMap[scope.dept]) {
        const deptData = buildScopes(deptMap, false).find(d => d.dept === scope.dept);
        deptGroupMap[scope.dept] = { dept: scope.dept, totalObs: deptData ? deptData.concerns.reduce((s, c) => s + c.count, 0) : 0, deptConcerns: deptData ? deptData.concerns : [], locations: [] };
        deptGroups.push(deptGroupMap[scope.dept]);
      }
      deptGroupMap[scope.dept].locations.push(scope);
    });
    deptGroups.sort((a, b) => a.dept.localeCompare(b.dept));
    return {
      topConcernsByScope: allScopes,
      hotelTopConcerns: Object.values(hotelMap).sort((a, b) => b.count - a.count).slice(0, 5),
      responsibilityTopConcerns: buildScopes(respMap, false),
      deptTopConcerns: buildScopes(deptMap, false),
      deptLocationGroups: deptGroups,
    };
  }, [liveObservations]);

  const handleAnswerSelect = (questionId: string, responseIndex: number, response: ResponseOption, questionText: string, question: QuestionNode) => {
    const isDeselecting = answers[questionId]?.selectedIndex === responseIndex;
    const isNA = response.text.toLowerCase() === 'n/a' || response.text.toLowerCase() === 'na' || response.score === '/';
    const marks = isNA ? 0 : (response.score !== '' ? parseFloat(response.score) : 0);
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        selectedIndex: isDeselecting ? null : responseIndex,
        marks: isDeselecting ? null : marks,
      }
    }));
    if (auditState === 'paused' && !isDeselecting) {
      if (pauseStartTime) setTotalPauseDuration(prev => prev + (Date.now() - pauseStartTime));
      setPauseStartTime(null);
      setAuditState('running');
    }
  };

  const handleSaveComment = (questionId: string, comment: QuestionComment) => {
    setComments(prev => ({ ...prev, [questionId]: comment }));
    setCommentModal(null);
    setCommentsExpanded(prev => ({ ...prev, [questionId]: false }));
  };

  const handleEditObservationSave = (observations: ObservationPayload[]) => {
    if (!editingObservation || observations.length === 0) {
      setEditingObservation(null);
      return;
    }
    const obs = observations[observations.length - 1];
    const originalQId = editingObservation.questionId;
    const originalEntryId = editingObservation.entryId;
    const newQId = obs.questionId;
    const ts = new Date().toLocaleString();

    const editQ = allQuestionsForEdit.find(aq => aq.id === newQId);
    const rawEditRespIdx = (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null && obs.selectedResponseIndex >= 0)
      ? obs.selectedResponseIndex
      : (obs.selectedAnswer && editQ ? editQ.responses.findIndex(r => r.text === obs.selectedAnswer) : -1);
    const editRespIdx = (rawEditRespIdx >= 0 && editQ && rawEditRespIdx < editQ.responses.length) ? rawEditRespIdx : -1;
    if (newQId === originalQId) {
      setComments(prev => {
        const existing = prev[originalQId];
        if (!existing?.entries) return prev;
        return {
          ...prev,
          [originalQId]: {
            entries: existing.entries.map(e =>
              e.id === originalEntryId
                ? { ...e, text: obs.observationText, images: [...obs.allEvidence], location: obs.location || '', timestamp: ts, managementTag: obs.managementTag, selectedResponseIndex: editRespIdx >= 0 ? editRespIdx : e.selectedResponseIndex }
                : e
            ),
          },
        };
      });
    } else {
      setComments(prev => {
        const next = { ...prev };
        const oldComment = next[originalQId];
        if (oldComment?.entries) {
          const filtered = oldComment.entries.filter(e => e.id !== originalEntryId);
          if (filtered.length === 0) {
            delete next[originalQId];
          } else {
            next[originalQId] = { entries: filtered };
          }
        }
        const oldEntry = prev[originalQId]?.entries?.find(e => e.id === originalEntryId);
        const newEntry: CommentEntry = {
          id: oldEntry?.id || `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: obs.observationText,
          images: [...obs.allEvidence],
          closureEvidence: oldEntry?.closureEvidence || [],
          closureComments: oldEntry?.closureComments || '',
          timestamp: ts,
          createdAtMs: oldEntry?.createdAtMs || Date.now(),
          location: obs.location || '',
          savedToDb: true,
          managementTag: obs.managementTag,
          selectedResponseIndex: editRespIdx >= 0 ? editRespIdx : (oldEntry?.selectedResponseIndex ?? undefined),
        };
        const targetComment = next[newQId] || { entries: [] };
        next[newQId] = { entries: [...targetComment.entries, newEntry] };
        return next;
      });
    }

    if (obs.managementTag) {
      setObsTags(prev => ({ ...prev, [originalEntryId]: obs.managementTag! }));
    } else {
      setObsTags(prev => {
        const next = { ...prev };
        delete next[originalEntryId];
        return next;
      });
    }

    const q = allQuestionsForEdit.find(aq => aq.id === newQId);
    if (q) {
      let respIdx = -1;
      if (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null && obs.selectedResponseIndex >= 0) {
        respIdx = obs.selectedResponseIndex;
      } else if (obs.selectedAnswer) {
        respIdx = q.responses.findIndex(r => r.text === obs.selectedAnswer);
      }
      if (respIdx >= 0 && respIdx < q.responses.length) {
        const marks = parseFloat(q.responses[respIdx].score) || 0;
        setAnswers(prev => ({ ...prev, [newQId]: { selectedIndex: respIdx, marks } }));
      }
    }

    setEditingObservation(null);
  };

  const handleDraftBulkUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setDraftBulkUploading(true);
    try {
      const newDrafts: { id: string; commentText: string; commentImages: string[]; location: string; questionId: string; questionText: string; sectionTitle: string; createdAt: number; isOfflineQueued?: boolean }[] = [];
      const { saveImageToStore, generateImageId } = await import('@/utils/draftImageStore');
      await Promise.allSettled(Array.from(files).map(file => new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const compressed = await compressImage(ev.target?.result as string);
            const draftId = `draft-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const imageId = generateImageId(draftId);
            // Save image to IndexedDB (unlimited, survives app close)
            await saveImageToStore(draftId, imageId, compressed);
            newDrafts.push({
              id: draftId,
              commentText: '',
              commentImages: [compressed], // keep in memory for display
              location: '',
              questionId: '',
              questionText: '',
              sectionTitle: '',
              createdAt: Date.now(),
            });
          } catch {}
          resolve();
        };
        reader.readAsDataURL(file);
      })));
      if (newDrafts.length > 0) {
        setPanelLiveDrafts(prev => {
          const updated = [...prev, ...newDrafts];
          const withoutImages = updated.map(d => ({ ...d, commentImages: [] as string[] }));
          writeScopedLocalDrafts(withoutImages);
          return updated;
        });
        syncDraftToDb(newDrafts);
      }
    } finally {
      setDraftBulkUploading(false);
      if (draftBulkInputRef.current) draftBulkInputRef.current.value = '';
    }
  };

  const commentModalQuestions = useMemo(() => {
    const qs: { id: string; text: string; sectionTitle: string; pageTitle?: string }[] = [];
    const _pages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    _pages.forEach((page: any) => {
      (page.sections || []).forEach((sec: any) => {
        const addQ = (q: any) => { qs.push({ id: q.id, text: q.text || '', sectionTitle: sec.title || '', pageTitle: page.title || '' }); };
        (sec.questions || []).forEach(addQ);
        (sec.subSections || []).forEach((ss: any) => (ss.questions || []).forEach(addQ));
      });
    });
    return qs;
  }, [template.pages, isLocationMode, locationVirtualPages]);

  const allQuestionsForEdit = useMemo((): AddObsQuestionOption[] => {
    const qs: AddObsQuestionOption[] = [];
    const pages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
    pages.forEach(page => {
      const pageId = page.id || '';
      const hasVirtualPrefix = pageId.includes('::');
      const virtualRawPrefix = hasVirtualPrefix ? pageId.split('::')[0] : '';
      const dept = page.title || 'Page';
      page.sections.forEach(sec => {
        const addQ = (q: QuestionNode, secTitle: string) => {
          if (isOldMergedQuestion(q)) return;
          qs.push({
            id: q.id,
            text: q.text || 'Untitled',
            pageTitle: hasVirtualPrefix ? `${virtualRawPrefix}::${page.title || 'Page'}` : (page.title || 'Page'),
            sectionTitle: secTitle,
            responses: q.responses.map(r => ({ text: r.text || '', score: r.score !== undefined ? String(r.score) : '0', color: r.color || '' })),
            checklistName: template.title || 'Checklist',
            checklistId: template.id || '',
            responsibility: q.responsibility || [],
            department: dept,
          });
        };
        sec.questions.forEach(q => addQ(q, sec.title || 'Section'));
        (sec.subSections || []).forEach(sub => {
          sub.questions.forEach(q => addQ(q, `${sec.title || 'Section'} > ${sub.title || 'Sub'}`));
        });
      });
    });
    return qs;
  }, [template, isLocationMode, locationVirtualPages, isOldMergedQuestion]);

  const handleReassignComment = (fromQId: string, toQId: string, entryId: string, reason: string, newLocation?: string) => {
    const fromComment = comments[fromQId];
    if (!fromComment?.entries) return;
    const entry = fromComment.entries.find(e => e.id === entryId);
    if (!entry) return;
    const ts = new Date().toLocaleString();
    const fromQ = commentModalQuestions.find(q => q.id === fromQId);
    const toQ = commentModalQuestions.find(q => q.id === toQId);
    const movedEntry: CommentEntry = {
      ...entry,
      ...(newLocation ? { location: newLocation } : {}),
      reassignedFrom: fromQId,
      reassignNote: `Moved from "${fromQ?.text || fromQId}" — Reason: ${reason}`,
    };
    const fromNote: CommentEntry = {
      id: `ce-note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: `[Reassigned] Observation moved to "${toQ?.text || toQId}" — Reason: ${reason}`,
      images: [],
      closureEvidence: [],
      closureComments: '',
      timestamp: ts,
      createdAtMs: Date.now(),
      isReassignNote: true,
    };
    setComments(prev => {
      const next = { ...prev };
      const fromEntries = (next[fromQId]?.entries || []).filter(e => e.id !== entryId);
      next[fromQId] = { entries: [...fromEntries, fromNote] };
      const toEntries = next[toQId]?.entries || [];
      next[toQId] = { entries: [...toEntries, movedEntry] };
      return next;
    });
  };

  const handleCorrectEntry = (questionId: string, entryId: string) => {
    const entry = comments[questionId]?.entries?.find(e => e.id === entryId);
    if (!entry) return;
    const withinWindow = entry.createdAtMs ? (Date.now() - entry.createdAtMs) <= CORRECTION_TIME_WINDOW_MS : false;
    setCorrectionTarget({ questionId, entryId, supervisorAuthorized: false });
    setShowPinDialog(!withinWindow);
  };

  const handlePinAuthorized = () => {
    if (correctionTarget) {
      setCorrectionTarget({ ...correctionTarget, supervisorAuthorized: true });
      setShowPinDialog(false);
    }
  };

  const handleSaveCorrection = (updatedEntry: CommentEntry) => {
    if (!correctionTarget) return;
    setComments(prev => {
      const existing = prev[correctionTarget.questionId];
      if (!existing) return prev;
      return { ...prev, [correctionTarget.questionId]: { entries: existing.entries.map(e => e.id === correctionTarget.entryId ? updatedEntry : e) } };
    });
    setCorrectionTarget(null);
    setShowPinDialog(false);
  };

  const handleDeleteCommentEntry = (questionId: string, entryId: string) => {
    setComments(prev => {
      const existing = prev[questionId];
      if (!existing?.entries) return prev;
      const filtered = existing.entries.filter(e => e.id !== entryId);
      if (filtered.length === 0) {
        const { [questionId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [questionId]: { entries: filtered } };
    });
  };

  const [moveTarget, setMoveTarget] = useState<{ sourceQuestionId: string; entryId: string; entry: CommentEntry } | null>(null);
  const [moveSearchTerm, setMoveSearchTerm] = useState('');
  const [moveExpandedIds, setMoveExpandedIds] = useState<Set<string>>(new Set());

  const handleMoveEntry = (targetQuestionId: string) => {
    if (!moveTarget || targetQuestionId === moveTarget.sourceQuestionId) return;
    setComments(prev => {
      const next = { ...prev };
      const sourceComment = next[moveTarget.sourceQuestionId];
      if (sourceComment?.entries) {
        const filtered = sourceComment.entries.filter(e => e.id !== moveTarget.entryId);
        if (filtered.length === 0) {
          const { [moveTarget.sourceQuestionId]: _, ...rest } = next;
          Object.assign(next, rest);
          delete next[moveTarget.sourceQuestionId];
        } else {
          next[moveTarget.sourceQuestionId] = { entries: filtered };
        }
      }
      const targetComment = next[targetQuestionId] || { entries: [] };
      next[targetQuestionId] = { entries: [...targetComment.entries, moveTarget.entry] };
      return next;
    });
    setCommentsExpanded(prev => ({ ...prev, [targetQuestionId]: true }));
    setMoveTarget(null);
    setMoveSearchTerm('');
    setMoveExpandedIds(new Set());
  };

  const selectNAForQuestions = (questions: QuestionNode[], currentAnswers: Record<string, { selectedIndex: number | null; marks: number | null }>) => {
    questions.forEach(q => {
      const naIdx = q.responses.findIndex(r => r.text.toLowerCase() === 'n/a' || r.text.toLowerCase() === 'na' || r.score === '/');
      if (naIdx !== -1) {
        currentAnswers[q.id] = { selectedIndex: naIdx, marks: 0 };
      }
    });
  };

  const clearNAForQuestions = (questions: QuestionNode[], currentAnswers: Record<string, { selectedIndex: number | null; marks: number | null }>) => {
    questions.forEach(q => {
      const ans = currentAnswers[q.id];
      if (ans && ans.selectedIndex !== null) {
        const resp = q.responses[ans.selectedIndex];
        if (resp && (resp.text.toLowerCase() === 'n/a' || resp.text.toLowerCase() === 'na' || resp.score === '/')) {
          delete currentAnswers[q.id];
        }
      }
    });
  };

  const renderFacilityQuestionCard = (question: QuestionNode, qAnswer: any, qIdx: number, totalQ: number) => {
    const isAnswered = qAnswer?.selectedIndex !== null && qAnswer?.selectedIndex !== undefined;
    const evidenceImages = facilityEvidence[question.id] || [];
    const themeColor = equipmentInfo?.type === 'maintenance' ? 'orange' : 'blue';
    const themeGradient = themeColor === 'orange' ? 'from-orange-500 to-amber-500' : 'from-blue-500 to-cyan-500';
    const themeBg = themeColor === 'orange' ? 'bg-orange-50' : 'bg-blue-50';
    const themeText = themeColor === 'orange' ? 'text-orange-700' : 'text-blue-700';
    const themeBorder = themeColor === 'orange' ? 'border-orange-200' : 'border-blue-200';

    return (
      <div data-question-id={question.id} key={question.id}
        className={`bg-white rounded-2xl overflow-hidden transition-all duration-200 border ${isAnswered ? 'border-emerald-200 shadow-lg shadow-emerald-100' : 'border-slate-200 shadow-md'}`}>
        <div className={`px-4 sm:px-6 py-3.5 sm:py-4 flex items-center gap-3 border-b ${isAnswered ? 'bg-gradient-to-r from-emerald-50 to-emerald-50/50 border-emerald-200' : `bg-gradient-to-r ${themeBg} border-slate-200`}`}>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${isAnswered ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : `bg-gradient-to-br ${themeGradient}`}`}>
            {isAnswered ? <Check className="w-4 h-4" /> : qIdx + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm sm:text-base font-semibold leading-snug flex-1 min-w-0 ${isAnswered ? 'text-emerald-900' : 'text-slate-900'}`}>
              {question.text || 'Untitled Question'}
            </p>
          </div>
          {question.isRequired && <span className="text-[8px] sm:text-[9px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">REQ</span>}
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(question.responses.length, 4)}, 1fr)` }}>
            {question.responses.map((resp, rIdx) => {
              const isSelected = qAnswer?.selectedIndex === rIdx;
              const selectedStyle = getSelectedColorStyle(resp.color);
              const unselectedStyle = getColorStyle(resp.color);
              return (
                <button key={resp.id}
                  onClick={() => handleAnswerSelect(question.id, rIdx, resp, question.text || 'Untitled Question', question)}
                  className="relative px-2.5 sm:px-3 py-3 sm:py-4 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 hover:shadow-md"
                  style={{
                    backgroundColor: isSelected ? selectedStyle.bg : unselectedStyle.bg,
                    color: isSelected ? selectedStyle.text : unselectedStyle.text,
                    border: `2px solid ${isSelected ? selectedStyle.border : unselectedStyle.border}`,
                    boxShadow: isSelected ? `0 4px 16px ${unselectedStyle.border}40` : '0 1px 3px rgba(0,0,0,0.05)',
                  }}>
                  {isSelected && <CheckCircle className="w-4 h-4 absolute top-1.5 right-1.5" />}
                  {resp.text}
                </button>
              );
            })}
          </div>

          <div className={`flex items-center gap-2 pt-3 border-t ${isAnswered ? 'border-emerald-100' : 'border-slate-100'}`}>
            <button
              onClick={() => { setActiveFacilityQId(question.id); setTimeout(() => facilityCameraRef.current?.click(), 50); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${themeBg} ${themeText} border ${themeBorder} hover:shadow-sm hover:bg-opacity-75`}
            >
              <Camera className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Camera</span>
            </button>
            <button
              onClick={() => { setActiveFacilityQId(question.id); setTimeout(() => facilityGalleryRef.current?.click(), 50); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${themeBg} ${themeText} border ${themeBorder} hover:shadow-sm hover:bg-opacity-75`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Gallery</span>
            </button>
            {evidenceImages.length > 0 && (
              <span className={`ml-auto text-[11px] font-bold ${themeText} ${themeBg} px-3 py-1.5 rounded-full border ${themeBorder}`}>
                {evidenceImages.length} {evidenceImages.length === 1 ? 'photo' : 'photos'}
              </span>
            )}
          </div>

          {evidenceImages.length > 0 && (
            <div className="flex gap-1.5 sm:gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
              {evidenceImages.map((img, imgIdx) => (
                <div key={imgIdx} className="relative flex-shrink-0 group">
                  <img
                    src={img.data}
                    alt={`Evidence ${imgIdx + 1}`}
                    className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded-lg sm:rounded-xl border-2 border-slate-200 cursor-pointer hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md"
                    onClick={() => setFacilityEvidencePreview(img.data)}
                  />
                  <button
                    onClick={() => removeFacilityImage(question.id, imgIdx)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity shadow-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderQuestionCard = (question: QuestionNode, qAnswer: any, qComment: any, qIsNA: boolean, obtainedMarks: number | null | undefined, maxMarks: number, qPct: number | null) => {
    const riskInfo = getRiskLabel(question.risk);
    const qRiskBorder = getRiskBorderColor(question.risk);
    return (
      <div data-question-id={question.id}
        className="bg-white border border-gray-200 rounded-lg sm:rounded-xl overflow-hidden shadow-sm mb-4 transition-shadow"
        style={{ borderLeftWidth: 4, borderLeftColor: qRiskBorder !== 'transparent' ? qRiskBorder : '#e5e7eb' }}>
        <div className="px-3 sm:px-5 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {riskInfo.label && (
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: riskInfo.bg, color: riskInfo.color }}>{riskInfo.label} RISK</span>
                )}
                {question.category && (
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
                    {question.category}
                  </span>
                )}
                {question.isRequired && <span className="text-[9px] sm:text-[10px] font-bold text-red-500">REQUIRED</span>}
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-800 leading-relaxed">{question.text || 'Untitled Question'}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              {qIsNA ? (
                <>
                  <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 italic">N/A</span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 italic">NA / NA</span>
                </>
              ) : (
                <>
                  <span className={`text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full ${qPct !== null ? qPct >= 80 ? 'bg-emerald-50 text-emerald-600' : qPct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'}`}>
                    {qPct !== null ? `${qPct}%` : '--'}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400">{obtainedMarks !== null && obtainedMarks !== undefined ? obtainedMarks : '--'}/{maxMarks}</span>
                </>
              )}
            </div>
          </div>

          <ComplianceHistoryStrip questionId={question.id} history={questionHistoryMap[question.id] || questionHistoryMap[question.id.includes('::') ? question.id.split('::').pop()! : question.id] || []} />

          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            {question.responses.map((resp, rIdx) => {
              const isSelected = qAnswer?.selectedIndex === rIdx;
              const unselectedStyle = getColorStyle(resp.color);
              const selectedStyle = getSelectedColorStyle(resp.color);
              return (
                <button key={resp.id}
                  onClick={() => handleAnswerSelect(question.id, rIdx, resp, question.text || 'Untitled Question', question)}
                  className="flex-1 min-w-[60px] sm:min-w-[80px] px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-lg transition-all text-center"
                  style={{
                    backgroundColor: isSelected ? selectedStyle.bg : unselectedStyle.bg,
                    color: isSelected ? selectedStyle.text : unselectedStyle.text,
                    border: `2px solid ${isSelected ? selectedStyle.border : unselectedStyle.border}`,
                    boxShadow: isSelected ? `0 2px 8px ${unselectedStyle.border}` : 'none',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  {resp.text}
                  {isSelected && <span className="ml-1 inline-flex"><CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></span>}
                </button>
              );
            })}
          </div>

          {qComment && qComment.entries?.length > 0 && (
            <div className="mt-2">
              <button 
                onClick={() => setCommentsExpanded(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                className="flex items-center gap-1.5 text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100 transition-all mb-2"
              >
                {commentsExpanded[question.id] ? (
                  <><ChevronUp size={12} /> Hide Comments ({qComment.entries.length})</>
                ) : (
                  <><ChevronDown size={12} /> View Comments ({qComment.entries.length})</>
                )}
              </button>
              {commentsExpanded[question.id] && (
                <InlineComment 
                  comment={qComment} 
                  questionId={question.id} 
                  onEdit={() => setCommentModal({ 
                    questionId: question.id, 
                    questionText: question.text || 'Untitled Question', 
                    selectedAnswer: qAnswer?.selectedIndex !== null && qAnswer?.selectedIndex !== undefined ? question.responses[qAnswer.selectedIndex]?.text || '' : '' 
                  })} 
                  onEditEntry={(entryId, entry) => {
                    const sectionTitle = (() => {
                      const effPages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
                      for (const p of effPages) for (const s of p.sections) {
                        if ((s.questions || []).some(q => q.id === question.id)) return s.title || '';
                        for (const ss of (s.subSections || [])) if ((ss.questions || []).some(q => q.id === question.id)) return `${s.title || ''} > ${ss.title || ''}`;
                      }
                      return '';
                    })();
                    setEditingObservation({
                      questionId: question.id,
                      location: entry.location || '',
                      commentText: entry.text || '',
                      commentImages: entry.images ? [...entry.images] : [],
                      selectedAnswerIndex: entry.selectedResponseIndex ?? null,
                      entryId,
                      managementTag: entry.managementTag,
                      sop: (() => { if (!sectionTitle) return ''; const parts = sectionTitle.split(' > '); return parts[0].trim(); })(),
                      subSop: (() => { if (!sectionTitle || !sectionTitle.includes(' > ')) return ''; return sectionTitle.split(' > ').slice(1).join(' > ').trim(); })(),
                      responsibility: entry.location || '',
                    });
                  }}
                  onDelete={(entryId) => handleDeleteCommentEntry(question.id, entryId)}
                  onCorrect={(entryId) => handleCorrectEntry(question.id, entryId)}
                  onMove={(entryId, entry) => setMoveTarget({ sourceQuestionId: question.id, entryId, entry })}
                  onImageClick={(src) => setObsImagePreview(src)}
                />
              )}
            </div>
          )}


          <div className="flex flex-wrap gap-3 sm:gap-4 pt-2.5 sm:pt-3 border-t border-gray-100 mt-3 items-center">
            <button onClick={() => setCommentModal({ questionId: question.id, questionText: question.text || 'Untitled Question', selectedAnswer: qAnswer?.selectedIndex !== null && qAnswer?.selectedIndex !== undefined ? question.responses[qAnswer.selectedIndex]?.text || '' : '', addNew: true })}
              className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium transition-colors text-violet-600 hover:text-violet-700">
              <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Add Comment
            </button>
            <button
              onClick={() => setRepeats(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
              className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${repeats[question.id] ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600'}`}
            >
              <Repeat2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Repeat
              {repeats[question.id] && <CheckCircle2 className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const toggleApplicability = (id: string, value: boolean) => {
    setApplicability(prev => ({ ...prev, [id]: value }));
    const section = template.pages.flatMap(p => p.sections).find(s => s.id === id);
    if (section) {
      const allQs = _allSecQs(section);
      const newAnswers = { ...answers };
      if (!value) {
        selectNAForQuestions(allQs, newAnswers);
      } else {
        clearNAForQuestions(allQs, newAnswers);
      }
      setAnswers(newAnswers);
      return;
    }
    const subSec = template.pages.flatMap(p => p.sections).flatMap(s => s.subSections || []).find(ss => ss.id === id);
    if (subSec) {
      const newAnswers = { ...answers };
      if (!value) {
        selectNAForQuestions(subSec.questions || [], newAnswers);
      } else {
        clearNAForQuestions(subSec.questions || [], newAnswers);
      }
      setAnswers(newAnswers);
      return;
    }
    const prefixMatch = id.match(/^(.+::)(.+)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const originalId = prefixMatch[2];
      const origSection = template.pages.flatMap(p => p.sections).find(s => s.id === originalId);
      if (origSection) {
        const allQs = _allSecQs(origSection).map(q => ({ ...q, id: `${prefix}${q.id}` }));
        const newAnswers = { ...answers };
        if (!value) { selectNAForQuestions(allQs, newAnswers); } else { clearNAForQuestions(allQs, newAnswers); }
        setAnswers(newAnswers);
        return;
      }
      const origSubSec = template.pages.flatMap(p => p.sections).flatMap(s => s.subSections || []).find(ss => ss.id === originalId);
      if (origSubSec) {
        const qs = (origSubSec.questions || []).map(q => ({ ...q, id: `${prefix}${q.id}` }));
        const newAnswers = { ...answers };
        if (!value) { selectNAForQuestions(qs, newAnswers); } else { clearNAForQuestions(qs, newAnswers); }
        setAnswers(newAnswers);
      }
    }
  };

  const togglePageApplicability = (pageId: string, value: boolean) => {
    setPageApplicability(prev => ({ ...prev, [pageId]: value }));
    let page = template.pages.find(p => p.id === pageId);
    let prefix = '';
    if (!page && isLocationMode && locationVirtualPages) {
      const prefixMatch = pageId.match(/^(.+::)(.+)$/);
      if (prefixMatch) {
        prefix = prefixMatch[1];
        page = template.pages.find(p => p.id === prefixMatch[2]);
      }
    }
    if (page) {
      const newApplicability = { ...applicability };
      const newAnswers = { ...answers };
      page.sections.forEach(section => {
        const secId = prefix ? `${prefix}${section.id}` : section.id;
        newApplicability[secId] = value;
        (section.subSections || []).forEach(ss => { newApplicability[prefix ? `${prefix}${ss.id}` : ss.id] = value; });
        const allQs = _allSecQs(section).map(q => prefix ? { ...q, id: `${prefix}${q.id}` } : q);
        if (!value) {
          selectNAForQuestions(allQs, newAnswers);
        } else {
          clearNAForQuestions(allQs, newAnswers);
        }
      });
      setApplicability(newApplicability);
      setAnswers(newAnswers);
    }
  };

  const dedupQuestions = useCallback((qs: any[]) => {
    const seen = new Set<string>();
    return qs.filter(q => {
      if (isOldMergedQuestion(q)) return false;
      const tk = (q.text || '').toLowerCase().trim();
      if (seen.has(tk)) return false;
      seen.add(tk);
      return true;
    });
  }, [isOldMergedQuestion]);

  const calculateSectionScore = (section: SectionNode): ScoreInfo => {
    if (applicability[section.id] === false) return { obtained: 0, max: 0, unanswered: 0 };
    let obtained = 0, max = 0, unanswered = 0;
    dedupQuestions(section.questions || []).forEach(q => {
      const ans = resolveAnswer(q.id);
      if (isAnswerNA(q, ans)) return;
      max += getQuestionMaxScore(q);
      if (ans && ans.selectedIndex !== null) obtained += ans.marks || 0;
      else unanswered++;
    });
    (section.subSections || []).forEach(ss => {
      if (applicability[ss.id] === false) return;
      dedupQuestions(ss.questions || []).forEach(q => {
        const ans = resolveAnswer(q.id);
        if (isAnswerNA(q, ans)) return;
        max += getQuestionMaxScore(q);
        if (ans && ans.selectedIndex !== null) obtained += ans.marks || 0;
        else unanswered++;
      });
    });
    return { obtained, max, unanswered };
  };

  const calculatePageScore = (page: PageNode): ScoreInfo => {
    let obtained = 0, max = 0, unanswered = 0;
    page.sections.forEach(section => {
      const s = calculateSectionScore(section);
      obtained += s.obtained; max += s.max; unanswered += s.unanswered;
    });
    return { obtained, max, unanswered };
  };

  const _effectivePages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
  const totalQuestionsAll = _effectivePages.reduce((sum, p) => sum + p.sections.reduce((s2, sec) => s2 + dedupQuestions(_allSecQs(sec)).length, 0), 0);
  const totalQuestions = _effectivePages.reduce((sum, p) => sum + p.sections.reduce((s2, sec) => {
    if (applicability[sec.id] === false) return s2;
    let count = dedupQuestions(sec.questions || []).length;
    (sec.subSections || []).forEach(ss => {
      if (applicability[ss.id] !== false) count += dedupQuestions(ss.questions || []).length;
    });
    return s2 + count;
  }, 0), 0);
  const totalNAQuestions = totalQuestionsAll - totalQuestions;
  const totalSections = _effectivePages.reduce((s, p) => s + p.sections.length, 0);
  const overallScore = _effectivePages.reduce((acc, p) => {
    const ps = calculatePageScore(p);
    return { obtained: acc.obtained + ps.obtained, max: acc.max + ps.max, unanswered: acc.unanswered + ps.unanswered };
  }, { obtained: 0, max: 0, unanswered: 0 });
  const overallPct = overallScore.max > 0 ? Math.round((overallScore.obtained / overallScore.max) * 100) : 0;
  const totalAnswered = totalQuestions - overallScore.unanswered;

  const ScoreBadge = ({ score, isNA }: { score: ScoreInfo; isNA?: boolean }) => {
    if (isNA) return <span className="text-[10px] sm:text-xs text-gray-400 italic font-medium">N/A</span>;
    const pct = score.max > 0 ? Math.round((score.obtained / score.max) * 100) : 0;
    const color = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
    const bg = pct >= 80 ? 'bg-emerald-50' : pct >= 50 ? 'bg-amber-50' : 'bg-red-50';
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className={`text-xs sm:text-sm font-bold ${color} ${bg} px-2 py-0.5 rounded-full`}>{pct}%</span>
        <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium">{score.obtained}/{score.max}</span>
      </div>
    );
  };

  const InlineComment = ({ comment, questionId, onEdit, onEditEntry, onDelete, onCorrect, onMove, onImageClick }: {
    comment: QuestionComment;
    questionId: string;
    onEdit: () => void;
    onEditEntry: (entryId: string, entry: CommentEntry) => void;
    onDelete: (entryId: string) => void;
    onCorrect: (entryId: string) => void;
    onMove: (entryId: string, entry: CommentEntry) => void;
    onImageClick?: (src: string) => void;
  }) => {
    const entries = comment.entries || [];
    const isClosed = (e: CommentEntry) => e.closureEvidence.length > 0 || !!e.closureComments.trim();
    const [expandedCorrHistory, setExpandedCorrHistory] = useState<Set<string>>(new Set());
    const toggleCorrHistory = (id: string) => setExpandedCorrHistory(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

    return (
      <div className="mt-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {entries.map((entry, idx) => {
            const closed = isClosed(entry);
            const corrCount = entry.corrections?.length ?? 0;
            const maxReached = corrCount >= MAX_CORRECTIONS;
            const withinWindow = entry.createdAtMs ? (Date.now() - entry.createdAtMs) <= CORRECTION_TIME_WINDOW_MS : false;
            const isCorrected = corrCount > 0;
            const histExpanded = expandedCorrHistory.has(entry.id);

            return (
              <div key={entry.id || idx} className={`rounded-xl border shadow-sm ${isCorrected ? 'border-amber-300' : closed ? 'border-emerald-200' : 'border-violet-200'}`}>
                <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-t-xl gap-1 flex-wrap ${isCorrected ? 'bg-gradient-to-r from-amber-50 to-orange-50' : closed ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-violet-50 to-purple-50'}`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[8px] sm:text-[9px] font-bold flex-shrink-0 ${isCorrected ? 'bg-amber-500 text-white' : closed ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white'}`}>{idx + 1}</div>
                    <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${isCorrected ? 'text-amber-700' : closed ? 'text-emerald-700' : 'text-violet-700'}`}>
                      Obs {entries.length > 1 ? `#${idx + 1}` : ''}
                    </span>
                    {closed && !isCorrected && (
                      <span className="text-[7px] font-bold bg-emerald-500 text-white px-1 py-0.5 rounded-full flex items-center gap-0.5 flex-shrink-0">
                        <Lock size={6} /> CLOSED
                      </span>
                    )}
                    {entry.isRepeat && (
                      <span className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-black text-orange-600 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <Repeat2 size={7} /> REPEAT
                      </span>
                    )}
                    {isCorrected && (
                      <button onClick={() => toggleCorrHistory(entry.id)}
                        className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition-all flex-shrink-0">
                        <RotateCcw size={7} /> Corrected ({corrCount})
                      </button>
                    )}
                    {entry.location && (
                      <span className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <MapPin size={7} /> {entry.location}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {auditState !== 'submitted' && auditState !== 'completed' && (
                      <button
                        onClick={() => !maxReached && onCorrect(entry.id)}
                        disabled={maxReached}
                        title={maxReached ? 'Max corrections reached — contact admin' : withinWindow ? 'Self-correct (within 30-min window)' : 'Requires supervisor PIN'}
                        className={`flex items-center gap-0.5 text-[7px] sm:text-[8px] font-semibold px-1.5 py-0.5 rounded-md border transition-all ${maxReached ? 'text-gray-300 border-gray-200 bg-gray-50 cursor-not-allowed' : 'text-amber-600 bg-white/80 hover:bg-amber-50 border-amber-200 cursor-pointer'}`}
                      >
                        {maxReached
                          ? <Lock size={7} />
                          : withinWindow
                          ? <Clock size={7} className="text-emerald-500" />
                          : <Lock size={7} className="text-red-400" />}
                        {!maxReached && <span>Correct</span>}
                      </button>
                    )}
                    <button onClick={() => onMove(entry.id, entry)}
                      className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-semibold text-cyan-500 hover:text-cyan-700 bg-white/80 hover:bg-cyan-50 px-1.5 py-0.5 rounded-md border border-cyan-200 transition-all"
                      title="Move to another question">
                      <ArrowRightLeft size={8} /> Move
                    </button>
                    <button onClick={() => onEditEntry(entry.id, entry)}
                      className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-semibold text-violet-500 hover:text-violet-700 bg-white/80 hover:bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-200 transition-all">
                      <Edit3 size={8} /> Edit
                    </button>
                    <button onClick={() => onDelete(entry.id)}
                      className="flex items-center gap-0.5 text-[7px] sm:text-[8px] font-semibold text-red-400 hover:text-red-600 bg-white/80 hover:bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200 transition-all">
                      <Trash2 size={8} />
                    </button>
                    <span className="text-[6px] sm:text-[7px] text-gray-400">{entry.timestamp}</span>
                  </div>
                </div>

                <div className="flex min-h-0">
                  <div className="flex-1 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 border-r border-gray-100">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-0.5 h-2.5 rounded-full bg-violet-400" />
                      <span className="text-[7px] sm:text-[8px] font-bold text-violet-500 uppercase tracking-wider">Observation</span>
                    </div>
                    {entry.text && <p className="text-[9px] sm:text-[10px] text-gray-700 leading-relaxed mb-1 line-clamp-3">{entry.text}</p>}
                    {entry.images.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {entry.images.map((img, i) => (
                          <button key={i} onClick={() => onImageClick?.(img)} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors flex-shrink-0 cursor-pointer">
                            <img src={img} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    {!entry.text && entry.images.length === 0 && (
                      <p className="text-[8px] text-gray-300 italic">No observation</p>
                    )}
                  </div>

                  <div className={`flex-1 px-2 sm:px-2.5 py-1.5 sm:py-2 ${closed ? 'bg-emerald-50/40' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className={`w-0.5 h-2.5 rounded-full ${closed ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      <span className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider ${closed ? 'text-emerald-600' : 'text-gray-400'}`}>Closure</span>
                    </div>
                    {closed ? (
                      <>
                        {entry.closureEvidence.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-1">
                            {entry.closureEvidence.map((img, i) => (
                              <button key={i} onClick={() => onImageClick?.(img)} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors flex-shrink-0 cursor-pointer">
                                <img src={img} alt={`Closure ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                        {entry.closureComments && <p className="text-[9px] sm:text-[10px] text-emerald-800 leading-relaxed line-clamp-3">{entry.closureComments}</p>}
                      </>
                    ) : (
                      <button onClick={() => setClosureTarget({ questionId, entryId: entry.id })}
                        className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-1 rounded-md border border-amber-200 transition-all">
                        <ShieldCheck size={9} /> Close
                      </button>
                    )}
                  </div>
                </div>

                {entry.isRepeat && entry.repeatTrail && entry.repeatTrail.length > 0 && (
                  <div className="border-t border-orange-200 bg-orange-50/60 px-2.5 py-2">
                    <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Repeat2 size={8} /> Repeat Trail · Since {entry.repeatOriginalDate}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {entry.repeatTrail.map((t, ti) => (
                        <span key={ti} className="text-[8px] font-bold text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-md">{t.date}{t.comment ? ` — ${t.comment.slice(0, 40)}${t.comment.length > 40 ? '…' : ''}` : ''}</span>
                      ))}
                    </div>
                  </div>
                )}

                {isCorrected && histExpanded && (
                  <div className="border-t border-amber-200 bg-amber-50/60 px-2.5 py-2 rounded-b-xl">
                    <p className="text-[8px] font-bold text-amber-700 uppercase tracking-widest mb-1.5">
                      Correction History ({corrCount})
                    </p>
                    <div className="space-y-1.5">
                      {entry.corrections!.map((corr) => {
                        const corrDate = new Date(corr.correctedAt);
                        const diff = Date.now() - corrDate.getTime();
                        const diffMins = Math.floor(diff / 60000);
                        const timeAgoStr = diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins / 60)}h ago`;
                        return (
                          <div key={corr.id} className="bg-white border border-amber-200 rounded-lg p-2 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8px] text-gray-500">{timeAgoStr} by <strong>{corr.correctedBy}</strong></span>
                              <span className="text-[7px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">{corr.reason}</span>
                              {corr.supervisorAuthorized && (
                                <span className="flex items-center gap-0.5 text-[7px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-full">
                                  <ShieldCheck size={7} /> Supervisor
                                </span>
                              )}
                            </div>
                            {corr.explanation && <p className="text-[9px] text-gray-600 italic">{corr.explanation}</p>}
                            <div>
                              <p className="text-[7px] font-bold text-gray-400 uppercase mb-0.5">Original Content</p>
                              {corr.originalText && <p className="text-[9px] text-gray-500 line-through leading-relaxed">{corr.originalText}</p>}
                              {corr.originalImages.length > 0 && (
                                <div className="flex gap-1 flex-wrap mt-1">
                                  {corr.originalImages.map((img, i) => (
                                    <div key={i} className="relative w-10 h-10 rounded overflow-hidden border border-gray-300 flex-shrink-0">
                                      <img src={img} alt={`Orig ${i + 1}`} className="w-full h-full object-cover" />
                                      <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[5px] font-bold text-center leading-tight py-px">ORIGINAL</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSinglePage = (page: any, pIdx: number, hidePageHeader = false) => {
    const isPageApplicable = pageApplicability[page.id] !== false;
    const pageScore = calculatePageScore(page);
    const isPageCollapsed = collapsed[page.id];
    const pageQTotal = page.sections.reduce((s: number, sec: any) => {
      if (applicability[sec.id] === false) return s;
      return s + dedupQuestions(_applicableSecQs(sec)).length;
    }, 0);
    const pageQAnswered = page.sections.reduce((s: number, sec: any) => {
      if (applicability[sec.id] === false) return s;
      return s + dedupQuestions(_applicableSecQs(sec)).filter((q: any) => resolveAnswer(q.id)?.selectedIndex !== null && resolveAnswer(q.id)?.selectedIndex !== undefined).length;
    }, 0);
    const pageUncategorized = page.sections.reduce((s: number, sec: any) => {
      if (applicability[sec.id] === false) return s;
      return s + ((sec.subSections && sec.subSections.length > 0) ? dedupQuestions(sec.questions || []).length : 0);
    }, 0);

    return (
      <div key={page.id} className="mb-4 sm:mb-5" data-accordion-id={page.id}>
        {!hidePageHeader && (
          <div>
            <button onClick={() => handleHeaderClick(page.id)}
              className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all border ${!isPageCollapsed ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200' : 'bg-white text-gray-800 border-gray-200 hover:border-violet-200 shadow-sm'}`}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0 ${!isPageCollapsed ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'}`}>{pIdx + 1}</div>
                <div className="text-left min-w-0 flex-1">
                  <div className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${!isPageCollapsed ? 'text-violet-200' : 'text-gray-400'}`}>Section {pIdx + 1}</div>
                  <div className={`text-sm sm:text-base font-semibold truncate ${!isPageCollapsed ? 'text-white' : 'text-gray-800'}`}>{page.title}</div>
                </div>
                {!isPageApplicable && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${!isPageCollapsed ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-400'}`}>N/A</span>}
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {isPageApplicable && (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${!isPageCollapsed ? 'bg-white/15 text-white/90' : 'bg-gray-100 text-gray-500'}`}>{pageQAnswered}/{pageQTotal} Q</span>
                    {(pageQTotal - pageQAnswered) > 0 && (
                      <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${!isPageCollapsed ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-50 text-amber-600'}`}>{pageQTotal - pageQAnswered} unchecked</span>
                    )}
                    <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${!isPageCollapsed ? 'bg-white/15 text-white/90' : 'bg-violet-50 text-violet-600'}`}>{pageScore.obtained}/{pageScore.max} marks</span>
                    {pageUncategorized > 0 && (
                      <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${!isPageCollapsed ? 'bg-orange-400/20 text-orange-200' : 'bg-orange-50 text-orange-600'}`}>{pageUncategorized} Uncategorized</span>
                    )}
                  </div>
                )}
                {isPageApplicable ? <ScoreBadge score={pageScore} /> : <ScoreBadge score={{ obtained: 0, max: 0, unanswered: 0 }} isNA={true} />}
                <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isPageCollapsed ? '-rotate-90' : ''} ${!isPageCollapsed ? 'text-violet-200' : 'text-gray-400'}`} />
              </div>
            </button>
          </div>
        )}

        {(hidePageHeader || !isPageCollapsed) && (
          <div className={hidePageHeader ? 'space-y-2 sm:space-y-3' : 'mt-2 sm:mt-3 space-y-2 sm:space-y-3 pl-2 sm:pl-3 border-l-2 border-violet-100'}>
            {!hidePageHeader && (
              <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 ml-1 sm:ml-2">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Is this page applicable?</p>
                <div className="flex gap-3 sm:gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name={`page-applicable-${page.id}`} checked={isPageApplicable} onChange={() => togglePageApplicability(page.id, true)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name={`page-applicable-${page.id}`} checked={!isPageApplicable} onChange={() => togglePageApplicability(page.id, false)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">Not Applicable</span>
                  </label>
                </div>
              </div>
            )}
            <div className={`space-y-2 sm:space-y-3 ${!isPageApplicable ? 'opacity-40 pointer-events-none' : ''}`}>
            {page.sections.map((section: any) => {
              const sectionScore = calculateSectionScore(section);
              const isSectionCollapsed = openSectionKey !== section.id;
              const isApplicable = applicability[section.id] !== false;
              const allSectionQs = _allSecQs(section);
              const sectionRisk = determineSectionRisk(allSectionQs);
              const riskBorderColor = getSectionRiskBorderColor(sectionRisk);

              return (
                <div key={section.id} className="ml-1 sm:ml-2" data-accordion-id={section.id}>
                  <button onClick={() => { const isOpen = openSectionKey === section.id; setOpenSectionKey(isOpen ? null : section.id); if (!isOpen) { setOpenSubSectionKey(null); scrollToAccordion(section.id); } }}
                    className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all shadow-sm text-left"
                    style={{ borderLeftWidth: 4, borderLeftColor: riskBorderColor !== 'transparent' ? riskBorderColor : '#e5e7eb' }}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform flex-shrink-0 ${!isSectionCollapsed ? 'rotate-90' : ''}`} />
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">{section.title}</span>
                      {section.subCategory && <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 flex-shrink-0">{section.subCategory}</span>}
                      {!isApplicable && <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">N/A</span>}
                      {isApplicable && (() => {
                        const applicableQs = dedupQuestions(_applicableSecQs(section));
                        const secAnswered = applicableQs.filter((q: any) => resolveAnswer(q.id)?.selectedIndex !== null && resolveAnswer(q.id)?.selectedIndex !== undefined).length;
                        const secUnchecked = applicableQs.length - secAnswered;
                        const secUncategorized = (section.subSections && section.subSections.length > 0) ? dedupQuestions(section.questions || []).length : 0;
                        return <>
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md flex-shrink-0">{secAnswered}/{applicableQs.length} Q</span>
                          {secUnchecked > 0 && <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">{secUnchecked} unchecked</span>}
                          {secUncategorized > 0 && <span className="text-[8px] sm:text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-md border border-orange-200 flex-shrink-0">{secUncategorized} Uncategorized</span>}
                        </>;
                      })()}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isApplicable && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md">{sectionScore.obtained}/{sectionScore.max}</span>
                      )}
                      <ScoreBadge score={sectionScore} isNA={!isApplicable} />
                    </div>
                  </button>

                  {!isSectionCollapsed && (
                    <div className="mt-1.5 sm:mt-2">
                      {(!section.subSections || section.subSections.length === 0) && allSectionQs.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 mb-2 sm:mb-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Is this policy applicable?</p>
                          <div className="flex gap-3 sm:gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`applicable-${section.id}`} checked={isApplicable} onChange={() => toggleApplicability(section.id, true)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="text-xs sm:text-sm text-gray-700 font-medium">Yes</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="radio" name={`applicable-${section.id}`} checked={!isApplicable} onChange={() => toggleApplicability(section.id, false)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="text-xs sm:text-sm text-gray-700 font-medium">No</span>
                            </label>
                          </div>
                        </div>
                      )}
                      <div className={`space-y-2 sm:space-y-3 ${(!section.subSections || section.subSections.length === 0) && !isApplicable ? 'opacity-40 pointer-events-none' : ''}`}>
                        {(() => { const seen = new Set<string>(); return [...section.questions].sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')).filter((q: any) => { if (isOldMergedQuestion(q)) return false; const tk = (q.text || '').toLowerCase().trim(); if (seen.has(tk)) return false; seen.add(tk); return true; }); })().map((question: any, qIdx: number) => {
                          const qAnswer = resolveAnswer(question.id);
                          const qComment = resolveComment(question.id);
                          const qIsNA = isAnswerNA(question, qAnswer);
                          const obtainedMarks = qIsNA ? 0 : qAnswer?.marks;
                          const maxMarks = qIsNA ? 0 : getQuestionMaxScore(question);
                          const qPct = qIsNA ? null : (obtainedMarks !== null && obtainedMarks !== undefined && maxMarks > 0
                            ? Math.round((obtainedMarks / maxMarks) * 100) : null);
                          return <React.Fragment key={question.id || `sq-${qIdx}`}>{renderQuestionCard(question, qAnswer, qComment, qIsNA, obtainedMarks, maxMarks, qPct)}</React.Fragment>;
                        })}
                      </div>

                      {(section.subSections || []).map((subSec: any) => {
                        const isSubCollapsed = openSubSectionKey !== subSec.id;
                        const isSubApplicable = applicability[subSec.id] !== false;
                        const subSecScore: ScoreInfo = (() => {
                          if (!isSubApplicable) return { obtained: 0, max: 0, unanswered: 0 };
                          let obtained = 0, max = 0, unanswered = 0;
                          dedupQuestions(subSec.questions || []).forEach((q: any) => {
                            const ans = resolveAnswer(q.id);
                            if (isAnswerNA(q, ans)) return;
                            max += getQuestionMaxScore(q);
                            if (ans && ans.selectedIndex !== null) obtained += ans.marks || 0;
                            else unanswered++;
                          });
                          return { obtained, max, unanswered };
                        })();
                        const visibleSubQs = dedupQuestions(subSec.questions || []);
                        const subAnswered = visibleSubQs.filter((q: any) => resolveAnswer(q.id)?.selectedIndex !== null && resolveAnswer(q.id)?.selectedIndex !== undefined).length;
                        const subUnchecked = visibleSubQs.length - subAnswered;
                        const subRisk = determineSectionRisk(subSec.questions);
                        const subRiskBorder = getSectionRiskBorderColor(subRisk);
                        return (
                          <div key={subSec.id} className="ml-3 sm:ml-4" data-accordion-id={subSec.id}>
                            <button onClick={() => { const isOpen = openSubSectionKey === subSec.id; setOpenSubSectionKey(isOpen ? null : subSec.id); if (!isOpen) scrollToAccordion(subSec.id); }}
                              className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white border border-gray-200 hover:border-gray-300 transition-all shadow-sm text-left"
                              style={{ borderLeftWidth: 4, borderLeftColor: subRiskBorder !== 'transparent' ? subRiskBorder : '#8b5cf6' }}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 transition-transform flex-shrink-0 ${!isSubCollapsed ? 'rotate-90' : ''}`} />
                                <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">{subSec.title || 'Untitled Sub-Category'}</span>
                                <span className="text-[8px] sm:text-[9px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-md border border-violet-200 flex-shrink-0">Sub-Category</span>
                                {subSec.subCategory && <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 flex-shrink-0">{subSec.subCategory}</span>}
                                {!isSubApplicable && <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">N/A</span>}
                                {isSubApplicable && <>
                                  <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md flex-shrink-0">{subAnswered}/{visibleSubQs.length} Q</span>
                                  {subUnchecked > 0 && <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0">{subUnchecked} unchecked</span>}
                                </>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isSubApplicable && (
                                  <span className="text-[8px] sm:text-[9px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md">{subSecScore.obtained}/{subSecScore.max}</span>
                                )}
                                <ScoreBadge score={subSecScore} isNA={!isSubApplicable} />
                              </div>
                            </button>
                            {!isSubCollapsed && (
                              <div className="mt-1.5 sm:mt-2">
                                <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 mb-2 sm:mb-3">
                                  <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Is this policy applicable?</p>
                                  <div className="flex gap-3 sm:gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="radio" name={`applicable-${subSec.id}`} checked={isSubApplicable} onChange={() => toggleApplicability(subSec.id, true)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      <span className="text-xs sm:text-sm text-gray-700 font-medium">Yes</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input type="radio" name={`applicable-${subSec.id}`} checked={!isSubApplicable} onChange={() => toggleApplicability(subSec.id, false)} className="accent-violet-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                      <span className="text-xs sm:text-sm text-gray-700 font-medium">No</span>
                                    </label>
                                  </div>
                                </div>
                                <div className={`space-y-2 sm:space-y-3 ${!isSubApplicable ? 'opacity-40 pointer-events-none' : ''}`}>
                                  {(() => { const seen = new Set<string>(); return [...subSec.questions].sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')).filter((q: any) => { if (isOldMergedQuestion(q)) return false; const tk = (q.text || '').toLowerCase().trim(); if (seen.has(tk)) return false; seen.add(tk); return true; }); })().map((question: any, qIdx: number) => {
                                    const qAnswer = resolveAnswer(question.id);
                                    const qComment = resolveComment(question.id);
                                    const qIsNA = isAnswerNA(question, qAnswer);
                                    const obtainedMarks = qIsNA ? 0 : qAnswer?.marks;
                                    const maxMarks = qIsNA ? 0 : getQuestionMaxScore(question);
                                    const qPct = qIsNA ? null : (obtainedMarks !== null && obtainedMarks !== undefined && maxMarks > 0
                                      ? Math.round(((obtainedMarks || 0) / maxMarks) * 100) : null);
                                    return <React.Fragment key={question.id || `ssq-${qIdx}`}>{renderQuestionCard(question, qAnswer, qComment, qIsNA, obtainedMarks, maxMarks, qPct)}</React.Fragment>;
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if ((autoTriggerDownload && !autoTriggerPaused) || autoTriggerExcelDownload || autoTriggerExcelLocationDownload) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[260px]">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center">
            <svg className="animate-spin w-6 h-6 text-cyan-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-700">{(autoTriggerExcelDownload || autoTriggerExcelLocationDownload) ? 'Generating Excel Spreadsheet…' : 'Generating Checklist PDF…'}</p>
            <p className="text-xs text-slate-400 mt-1">Your download will start shortly</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadingFromDb) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
          <svg className="animate-spin w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-700">Loading Audit Data…</p>
          <p className="text-xs text-slate-400 mt-1">Restoring your progress from the server</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-50 flex flex-col overflow-hidden">

      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {currentStep === 'checklist' && (
              <button onClick={handleBackToUnitDetails} className="p-1.5 sm:p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0">
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-semibold text-gray-800 truncate">{template.title}</h1>
              <p className="text-[10px] sm:text-xs text-gray-400 font-medium hidden sm:block">Audit Preview</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 mx-2 sm:mx-4 flex-shrink-0">
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${currentStep === 'checklist' ? 'bg-emerald-500 text-white' : 'bg-violet-600 text-white ring-2 ring-violet-200'}`}>
              {currentStep === 'checklist' ? <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : '1'}
            </div>
            <div className={`w-6 sm:w-8 h-0.5 rounded-full transition-colors ${currentStep === 'checklist' ? 'bg-violet-400' : 'bg-gray-200'}`} />
            <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ${currentStep === 'checklist' ? 'bg-violet-600 text-white ring-2 ring-violet-200' : 'bg-gray-200 text-gray-400'}`}>2</div>
          </div>
          <button onClick={handleCloseWithDraft} className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500 text-xs sm:text-sm font-medium flex-shrink-0">
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">

          {showDraftBanner && draftRestored && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Save className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Draft Restored</p>
                  <p className="text-[11px] text-amber-600">Your previous progress has been loaded. Click &quot;Resume&quot; in the timer to continue.</p>
                </div>
              </div>
              <button onClick={() => setShowDraftBanner(false)} className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-400 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {showImportBanner && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Excel Imported — Audit Draft Saved</p>
                  <p className="text-[11px] text-emerald-600">
                    {showImportBanner.count} answer{showImportBanner.count !== 1 ? 's' : ''} loaded. Review the checklist below, then submit to finalise observations.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowImportBanner(null)} className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-400 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isOnline && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-orange-800">You are offline</p>
                <p className="text-[11px] text-orange-600">Your progress is saved locally and will sync automatically when the connection is restored.</p>
              </div>
            </div>
          )}

          {currentStep === 'unit-details' && (
            <>
              {equipmentInfo ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 sm:mb-5">
                  {/* Gradient Header */}
                  <div className={`relative overflow-hidden ${equipmentInfo.type === 'maintenance' ? 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-700'}`}>
                    <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-black/10 rounded-full pointer-events-none" />
                    <div className="relative z-10 px-5 py-5">
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-white/30 shrink-0 ${equipmentInfo.type === 'maintenance' ? 'bg-orange-400/40' : 'bg-blue-400/40'}`}>
                          <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20 mb-1.5">
                            {equipmentInfo.type === 'maintenance' ? 'Preventive Maintenance' : 'Cleaning & Hygiene'}
                          </span>
                          <h2 className="text-base font-black text-white leading-tight uppercase tracking-tight">{equipmentInfo.name}</h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full border border-white/20">
                          <Hash className="w-3 h-3 text-white/80" />
                          <span className="text-[10px] font-black text-white font-mono">{equipmentInfo.idNumber || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full border border-white/20">
                          <Clock className="w-3 h-3 text-white/80" />
                          <span className="text-[10px] font-black text-white">{equipmentInfo.frequency || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    {/* Location + Department */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex">
                        <div className="flex-1 px-3.5 py-3 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.location || '—'}</p>
                        </div>
                        <div className="flex-1 px-3.5 py-3">
                          <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dept</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.department || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Make + Brand */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex">
                        <div className="flex-1 px-3.5 py-3 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 mb-1"><Tag className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Make</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.make || '—'}</p>
                        </div>
                        <div className="flex-1 px-3.5 py-3">
                          <div className="flex items-center gap-1.5 mb-1"><Tag className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.model || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Schedule highlight */}
                    <div className={`rounded-xl border p-3.5 ${equipmentInfo.type === 'maintenance' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-2.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-500' : 'text-blue-500'}`}>Schedule</p>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div>
                          <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Frequency</p>
                          <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.frequency || '—'}</p>
                        </div>
                        {equipmentInfo.day && (<>
                          <div className={`w-px self-stretch ${equipmentInfo.type === 'maintenance' ? 'bg-amber-200' : 'bg-blue-200'}`} />
                          <div>
                            <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Day</p>
                            <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.day}</p>
                          </div>
                        </>)}
                        {equipmentInfo.startDate && (<>
                          <div className={`w-px self-stretch ${equipmentInfo.type === 'maintenance' ? 'bg-amber-200' : 'bg-blue-200'}`} />
                          <div>
                            <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Start</p>
                            <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.startDate}</p>
                          </div>
                        </>)}
                      </div>
                    </div>

                    {/* Responsibility */}
                    {equipmentInfo.responsibility && equipmentInfo.responsibility.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><User className="w-3 h-3" /> Assigned To</p>
                        <div className="flex flex-wrap gap-1.5">
                          {equipmentInfo.responsibility.map(r => (
                            <span key={r} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${equipmentInfo.type === 'maintenance' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 sm:mb-5">
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold text-white">Unit Details</h2>
                      <p className="text-[10px] sm:text-xs text-white/70">Fill in audit information</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Building2 className="w-3 h-3" /> Company Name</label>
                      <input value={unitForm.companyName} onChange={e => updateUnit('companyName', e.target.value)} placeholder="Enter company name" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><User className="w-3 h-3" /> Representative</label>
                      <input value={unitForm.repName} onChange={e => updateUnit('repName', e.target.value)} placeholder="Enter representative's name" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><MapPin className="w-3 h-3" /> Complete Address</label>
                    <input value={unitForm.address} onChange={e => updateUnit('address', e.target.value)} placeholder="Enter full address" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Phone className="w-3 h-3" /> Contact Number</label>
                      <input value={unitForm.contact} onChange={e => updateUnit('contact', e.target.value)} placeholder="Enter contact number" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Mail className="w-3 h-3" /> Email</label>
                      <input value={unitForm.email} onChange={e => updateUnit('email', e.target.value)} placeholder="Enter email address" type="email" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Timer className="w-3 h-3" /> Scheduled Manday</label>
                      <input value={unitForm.manday} onChange={e => updateUnit('manday', e.target.value)} placeholder="e.g., 1.5" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Target className="w-3 h-3" /> Audit Scope</label>
                      <input value={unitForm.scope} onChange={e => updateUnit('scope', e.target.value)} placeholder="Define the scope" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><CalendarDays className="w-3 h-3" /> Audit Date (From)</label>
                      <input value={unitForm.dateFrom} onChange={e => updateUnit('dateFrom', e.target.value)} type="date" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><CalendarDays className="w-3 h-3" /> Audit Date (To)</label>
                      <input value={unitForm.dateTo} onChange={e => updateUnit('dateTo', e.target.value)} type="date" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><MapPin className="w-3 h-3" /> Geotag Location</label>
                      <div className="flex">
                        <input readOnly value={unitForm.geotag} placeholder="Click to fetch location" className="flex-1 px-3 py-2.5 sm:py-2 border border-gray-200 rounded-l-lg text-sm bg-gray-50 outline-none" />
                        <button onClick={handleGetLocation} className="px-3 sm:px-4 py-2 border border-l-0 border-gray-200 rounded-r-lg bg-white hover:bg-gray-50 transition-colors text-sm text-gray-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
                          <MapPin className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Get</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"><Clock className="w-3 h-3" /> Start Time</label>
                      <input readOnly value={unitForm.startTime} placeholder="Auto-filled on Start" className="w-full px-3 py-2.5 sm:py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
              )}

              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 sm:mb-5">
                <div className="p-4 sm:p-5">
                  <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-3 sm:p-4 border border-violet-100 mb-3">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                      {[
                        { label: 'Active', value: timerDisplay.active, color: 'text-emerald-600' },
                        { label: 'Paused', value: timerDisplay.pause, color: 'text-amber-600' },
                        { label: 'Total', value: timerDisplay.total, color: 'text-violet-700' },
                      ].map(t => (
                        <div key={t.label}>
                          <div className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{t.label}</div>
                          <div className={`text-base sm:text-xl font-bold font-mono ${t.color}`}>{t.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        {template.pages.length} location{template.pages.length !== 1 ? 's' : ''} · {totalSections} polic{totalSections !== 1 ? 'ies' : 'y'} · {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
                      </p>
                      {isCombinedAudit && combinedLocations && combinedLocations.length > 1 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            <Layers className="w-3 h-3" /> Combined Audit — {combinedLocations.length} Departments
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {auditState === 'idle' && (
                        <>
                          <button onClick={() => { handleStartAudit(); handleProceedToChecklist(); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-emerald-200">
                            <Play className="w-4 h-4" /> {equipmentInfo ? 'Start Checklist' : 'Start Audit'}
                          </button>
                          {!equipmentInfo && (
                            <button onClick={() => setShowExcelImporter(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-md shadow-indigo-200">
                              <FileSpreadsheet className="w-4 h-4" /> Import Excel
                            </button>
                          )}
                        </>
                      )}
                      {auditState === 'running' && (
                        <>
                          <button onClick={handlePauseAudit} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Pause className="w-4 h-4" /> Pause
                          </button>
                          <button onClick={handleSaveAsDraft} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Save className="w-4 h-4" /> Save as Draft
                          </button>
                          <button onClick={handleSignAndSend} disabled={totalAnswered < totalQuestions} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <PenTool className="w-4 h-4" /> Sign & Send for Review
                          </button>
                          <button onClick={() => setShowExcelImporter(true)} className="flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-xs transition-colors" title="Import from Excel">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Import
                          </button>
                        </>
                      )}
                      {auditState === 'paused' && (
                        <>
                          <button onClick={handleResumeAudit} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Play className="w-4 h-4" /> Resume
                          </button>
                          <button onClick={handleSaveAsDraft} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Save className="w-4 h-4" /> Save as Draft
                          </button>
                          <button onClick={handleSignAndSend} disabled={totalAnswered < totalQuestions} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <PenTool className="w-4 h-4" /> Sign & Send for Review
                          </button>
                          <button onClick={() => setShowExcelImporter(true)} className="flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-xs transition-colors" title="Import from Excel">
                            <FileSpreadsheet className="w-3.5 h-3.5" /> Import
                          </button>
                        </>
                      )}
                      {auditState === 'draft' && (
                        <>
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-semibold text-sm">
                            <Save className="w-4 h-4" /> Draft Saved
                          </div>
                          <button onClick={handleResumeFromDraft} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Play className="w-4 h-4" /> Resume Audit
                          </button>
                          <button onClick={handleSignAndSend} disabled={totalAnswered < totalQuestions} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <PenTool className="w-4 h-4" /> Sign & Send for Review
                          </button>
                        </>
                      )}
                      {auditState === 'submitted' && (
                        <>
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-semibold text-sm">
                            <CheckCircle className="w-4 h-4" /> Sent for Review
                          </div>
                          <button onClick={handleEditSubmittedReport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                            <Edit3 className="w-4 h-4" /> Edit Report
                          </button>
                          <button onClick={() => { setShowPreviousReports(true); fetchPreviousReports(); }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors shadow-sm border border-slate-200">
                            <History className="w-4 h-4" /> Previous Reports
                          </button>
                          {(downloadableDepts.length > 1 || downloadableSections.length > 1) ? (
                            <div ref={downloadMenuRef} className="relative">
                              <button onClick={() => setDownloadMenuOpen(v => !v)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                                <FileDown className="w-4 h-4" /> Download Report <ChevronDown className="w-3 h-3" />
                              </button>
                              {downloadMenuOpen && (
                                <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[280px] py-1 overflow-hidden max-h-[60vh] overflow-y-auto">
                                  <button onClick={() => { setDownloadMenuOpen(false); generateAuditReport(); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2.5 transition-colors">
                                    <Layers className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                    <span><span className="font-semibold">Download Consolidated</span><br/><span className="text-[11px] text-slate-400">All {downloadableDepts.length > 1 ? 'departments' : 'sections'} in one report</span></span>
                                  </button>
                                  {downloadableDepts.length > 1 && (
                                    <>
                                      <button onClick={() => { setDownloadMenuOpen(false); generatePerDepartmentReports(); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                        <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span><span className="font-semibold">Download All Departments</span><br/><span className="text-[11px] text-slate-400">{downloadableDepts.length} separate PDF reports</span></span>
                                      </button>
                                      <div className="border-t border-slate-100 mx-3 my-1" />
                                      <div className="px-3 py-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Individual Department</span></div>
                                      {downloadableDepts.map((deptName, di) => (
                                        <button key={di} onClick={() => { setDownloadMenuOpen(false); generateAuditReport({ filterPageTitles: [deptName], fileNameOverride: `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${deptName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`, reportSubtitle: `Department: ${deptName}` }); }} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                          <FileDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                          <span className="font-semibold truncate">{deptName}</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {downloadableSections.length > 1 && (
                                    <>
                                      <button onClick={() => { setDownloadMenuOpen(false); generatePerSectionReports(); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                        <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                        <span><span className="font-semibold">Download All Sections</span><br/><span className="text-[11px] text-slate-400">{downloadableSections.length} separate PDF reports</span></span>
                                      </button>
                                      <div className="border-t border-slate-100 mx-3 my-1" />
                                      <div className="px-3 py-1"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Individual Section</span></div>
                                      {downloadableSections.map((secName, si) => (
                                        <button key={si} onClick={() => {
                                          setDownloadMenuOpen(false);
                                          const page = template.pages[0];
                                          const sec = page.sections.find(s => (s.title || 'Untitled') === secName);
                                          if (sec) {
                                            const virtualPage = { ...page, sections: [sec], title: secName };
                                            generateAuditReport({ overridePages: [virtualPage], fileNameOverride: `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${secName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`, reportSubtitle: `Section: ${secName}` });
                                          }
                                        }} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors">
                                          <FileDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                          <span className="font-semibold truncate">{secName}</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {isLocationMode && locationVirtualPages && locationVirtualPages.length > 1 && (
                                    <>
                                      <div className="border-t border-slate-100 mx-3 my-1" />
                                      <button onClick={() => { setDownloadMenuOpen(false); generatePerLocationReports(); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors">
                                        <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                        <span><span className="font-semibold">Download by Location</span><br/><span className="text-[11px] text-slate-400">Separate report for each location ({locationVirtualPages.length} reports)</span></span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button onClick={() => generateAuditReport()} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                              <FileDown className="w-4 h-4" /> Download Report
                            </button>
                          )}
                          <div ref={excelMenuRef} className="relative">
                            <button onClick={() => setExcelMenuOpen(v => !v)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
                              <FileSpreadsheet className="w-4 h-4" /> Export Excel
                            </button>
                            {excelMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[220px] py-1 overflow-hidden">
                                <button onClick={() => exportQuestionsToExcel('department')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors">
                                  <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                  <span><span className="font-semibold">By Department</span><br/><span className="text-[11px] text-slate-400">Sheet per department + consolidated</span></span>
                                </button>
                                <button onClick={() => exportQuestionsToExcel('responsibility')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2.5 transition-colors">
                                  <User className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                  <span><span className="font-semibold">By Responsibility</span><br/><span className="text-[11px] text-slate-400">Sheet per responsibility + consolidated</span></span>
                                </button>
                                <button onClick={() => exportQuestionsToExcel('location')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 transition-colors">
                                  <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  <span><span className="font-semibold">By Location</span><br/><span className="text-[11px] text-slate-400">Sheet per location/area + consolidated</span></span>
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {(auditState === 'running' || auditState === 'paused') && totalAnswered < totalQuestions && (
                    <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Answer all {totalQuestions - totalAnswered} remaining question{totalQuestions - totalAnswered !== 1 ? 's' : ''} to end the audit
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 'checklist' && (
            <>
              {equipmentInfo && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 sm:mb-5">
                  {/* Gradient Header */}
                  <div className={`relative overflow-hidden ${equipmentInfo.type === 'maintenance' ? 'bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-700'}`}>
                    <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />
                    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-black/10 rounded-full pointer-events-none" />
                    <div className="relative z-10 px-5 py-5">
                      <div className="flex items-start gap-3.5 mb-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-white/30 shrink-0 ${equipmentInfo.type === 'maintenance' ? 'bg-orange-400/40' : 'bg-blue-400/40'}`}>
                          <Settings className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="inline-flex items-center px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest border border-white/20 mb-1.5">
                            {equipmentInfo.type === 'maintenance' ? 'Preventive Maintenance' : 'Cleaning & Hygiene'}
                          </span>
                          <h2 className="text-base font-black text-white leading-tight uppercase tracking-tight">{equipmentInfo.name}</h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full border border-white/20">
                          <Hash className="w-3 h-3 text-white/80" />
                          <span className="text-[10px] font-black text-white font-mono">{equipmentInfo.idNumber || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-full border border-white/20">
                          <Clock className="w-3 h-3 text-white/80" />
                          <span className="text-[10px] font-black text-white">{equipmentInfo.frequency || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    {/* Location + Department */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex">
                        <div className="flex-1 px-3.5 py-3 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.location || '—'}</p>
                        </div>
                        <div className="flex-1 px-3.5 py-3">
                          <div className="flex items-center gap-1.5 mb-1"><Building2 className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dept</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.department || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Make + Brand */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="flex">
                        <div className="flex-1 px-3.5 py-3 border-r border-slate-100">
                          <div className="flex items-center gap-1.5 mb-1"><Tag className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Make</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.make || '—'}</p>
                        </div>
                        <div className="flex-1 px-3.5 py-3">
                          <div className="flex items-center gap-1.5 mb-1"><Tag className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Brand</span></div>
                          <p className="text-sm font-bold text-slate-800 truncate">{equipmentInfo.model || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Schedule highlight */}
                    <div className={`rounded-xl border p-3.5 ${equipmentInfo.type === 'maintenance' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-2.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-500' : 'text-blue-500'}`}>Schedule</p>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div>
                          <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Frequency</p>
                          <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.frequency || '—'}</p>
                        </div>
                        {equipmentInfo.day && (<>
                          <div className={`w-px self-stretch ${equipmentInfo.type === 'maintenance' ? 'bg-amber-200' : 'bg-blue-200'}`} />
                          <div>
                            <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Day</p>
                            <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.day}</p>
                          </div>
                        </>)}
                        {equipmentInfo.startDate && (<>
                          <div className={`w-px self-stretch ${equipmentInfo.type === 'maintenance' ? 'bg-amber-200' : 'bg-blue-200'}`} />
                          <div>
                            <p className={`text-[8px] font-bold uppercase tracking-widest mb-0.5 ${equipmentInfo.type === 'maintenance' ? 'text-amber-400' : 'text-blue-400'}`}>Start</p>
                            <p className={`text-sm font-black ${equipmentInfo.type === 'maintenance' ? 'text-amber-900' : 'text-blue-900'}`}>{equipmentInfo.startDate}</p>
                          </div>
                        </>)}
                      </div>
                    </div>

                    {/* Status + Next Due */}
                    {equipmentInfo.startDate && (() => {
                      const calcNextDue = () => {
                        const freqMatch = equipmentInfo.frequency?.match(/Every (\d+) (\w+)/);
                        if (!freqMatch) return '—';
                        const value = parseInt(freqMatch[1]);
                        const unit = freqMatch[2].toLowerCase();
                        const start = new Date(equipmentInfo.startDate);
                        const today = new Date();
                        let next = new Date(start);
                        while (next <= today) {
                          if (unit.includes('day')) next.setDate(next.getDate() + value);
                          else if (unit.includes('week')) next.setDate(next.getDate() + (value * 7));
                          else if (unit.includes('month')) next.setMonth(next.getMonth() + value);
                          else if (unit.includes('year')) next.setFullYear(next.getFullYear() + value);
                        }
                        return next.toISOString().split('T')[0];
                      };
                      const nextDue = calcNextDue();
                      const isOverdue = new Date(nextDue) < new Date();
                      return (
                        <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                          <div className="flex">
                            <div className="flex-1 px-3.5 py-3 border-r border-slate-100">
                              <div className="flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span></div>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border ${isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{isOverdue ? 'OVERDUE' : 'ON SCHEDULE'}</span>
                            </div>
                            <div className="flex-1 px-3.5 py-3">
                              <div className="flex items-center gap-1.5 mb-1"><CalendarDays className="w-3 h-3 text-slate-400" /><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Due</span></div>
                              <p className="text-sm font-black text-slate-800">{nextDue}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Responsibility */}
                    {equipmentInfo.responsibility && equipmentInfo.responsibility.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><User className="w-3 h-3" /> Assigned To</p>
                        <div className="flex flex-wrap gap-1.5">
                          {equipmentInfo.responsibility.map(r => (
                            <span key={r} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${equipmentInfo.type === 'maintenance' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{r}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {equipmentInfo && (() => {
                const allFacilityQs = template.pages.flatMap(p => p.sections.flatMap(s => [...(s.questions || []), ...(s.subSections || []).flatMap(ss => ss.questions || [])]));
                const totalFQ = allFacilityQs.length;
                const answeredFQ = allFacilityQs.filter(q => { const a = resolveAnswer(q.id); return a?.selectedIndex !== null && a?.selectedIndex !== undefined; }).length;
                const progressPct = totalFQ > 0 ? Math.round((answeredFQ / totalFQ) * 100) : 0;
                const allDone = answeredFQ === totalFQ && totalFQ > 0;
                const fThemeColor = equipmentInfo.type === 'maintenance' ? 'orange' : 'blue';
                const fThemeGrad = fThemeColor === 'orange' ? 'from-orange-500 to-amber-500' : 'from-blue-500 to-cyan-500';
                const fThemeBg = fThemeColor === 'orange' ? 'bg-orange-50' : 'bg-blue-50';
                const fThemeText = fThemeColor === 'orange' ? 'text-orange-700' : 'text-blue-700';
                const fThemeBorder = fThemeColor === 'orange' ? 'border-orange-200' : 'border-blue-200';

                if (allDone && showFacilitySummary !== false) {
                  const compliantCount = allFacilityQs.filter(q => { const a = resolveAnswer(q.id); if (!a || a.selectedIndex === null) return false; const resp = q.responses[a.selectedIndex]; return resp && !isAnswerNA(q, a) && (a.marks || 0) >= getQuestionMaxScore(q); }).length;
                  const nonCompliantCount = allFacilityQs.filter(q => { const a = resolveAnswer(q.id); if (!a || a.selectedIndex === null) return false; const resp = q.responses[a.selectedIndex]; return resp && !isAnswerNA(q, a) && (a.marks || 0) < getQuestionMaxScore(q); }).length;
                  const naCount = allFacilityQs.filter(q => isAnswerNA(q, resolveAnswer(q.id))).length;
                  const compPct = totalFQ - naCount > 0 ? Math.round((compliantCount / (totalFQ - naCount)) * 100) : 100;
                  const allEvidence = allFacilityQs.flatMap(q => facilityEvidence[q.id] || []);
                  return (
                    <div className="space-y-5">
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 px-6 sm:px-8 py-8 sm:py-10 text-center relative overflow-hidden">
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl transform translate-x-32 -translate-y-32" />
                          </div>
                          <div className="relative z-10">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                              <CheckCircle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-white mb-1">Checklist Complete</h3>
                            <p className="text-emerald-100 text-sm sm:text-base">{equipmentInfo.name} — <span className="font-semibold">{equipmentInfo.type === 'maintenance' ? 'Preventive Maintenance' : 'Cleaning Check'}</span></p>
                          </div>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className={`text-center p-5 rounded-2xl border-2 transition-all ${compPct >= 80 ? 'bg-gradient-to-br from-emerald-50 to-emerald-50/50 border-emerald-300' : compPct >= 50 ? 'bg-gradient-to-br from-amber-50 to-amber-50/50 border-amber-300' : 'bg-gradient-to-br from-red-50 to-red-50/50 border-red-300'}`}>
                              <p className={`text-xs font-bold uppercase tracking-wider mb-2 opacity-70 ${compPct >= 80 ? 'text-emerald-700' : compPct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>Compliance Score</p>
                              <div className="mb-1">
                                <span className={`text-4xl sm:text-5xl font-black ${compPct >= 80 ? 'text-emerald-600' : compPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{compPct}%</span>
                              </div>
                              <p className={`text-xs font-semibold ${compPct >= 80 ? 'text-emerald-600' : compPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {compPct >= 80 ? 'Excellent' : compPct >= 50 ? 'Acceptable' : 'Needs Improvement'}
                              </p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-5 rounded-2xl border-2 border-emerald-300">
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2 opacity-70">Compliant</p>
                              <p className="text-3xl sm:text-4xl font-black text-emerald-600 mb-1">{compliantCount}</p>
                              <p className="text-xs text-emerald-600 font-semibold">{compliantCount === 1 ? 'item' : 'items'} passed</p>
                            </div>
                            <div className="bg-gradient-to-br from-slate-50 to-slate-50/50 p-5 rounded-2xl border-2 border-slate-300">
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 opacity-70">Not Applicable</p>
                              <p className="text-3xl sm:text-4xl font-black text-slate-600 mb-1">{naCount}</p>
                              <p className="text-xs text-slate-600 font-semibold">{nonCompliantCount === 1 ? 'item' : 'items'} flagged</p>
                            </div>
                          </div>
                          {allEvidence.length > 0 && (
                            <div className="border-t border-slate-200 pt-6">
                              <div className="flex items-center gap-2 mb-4">
                                <div className="p-2.5 bg-blue-100 rounded-lg">
                                  <Camera className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">Evidence Collected</p>
                                  <p className="text-xs text-slate-500">{allEvidence.length} {allEvidence.length === 1 ? 'photo' : 'photos'}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {allEvidence.map((img, i) => (
                                  <button key={i} onClick={() => setFacilityEvidencePreview(img.data)} className="group relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                                    <img src={img.data} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Search className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setShowFacilitySummary(false)} className={`w-full py-4 px-4 rounded-xl text-base font-bold text-white bg-gradient-to-r ${fThemeGrad} active:scale-95 transition-all duration-200 shadow-lg hover:shadow-xl`}>
                        ← Back to Questions
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    <div className={`sticky top-0 z-30 rounded-2xl p-4 sm:p-5 mb-5 shadow-lg border border-slate-200 bg-gradient-to-r ${fThemeBg}`}>
                      <div className="flex items-center justify-between gap-2 sm:gap-4 mb-3 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5">
                            <p className={`text-xs font-medium uppercase tracking-wider opacity-70 ${fThemeText}`}>
                              Completion
                            </p>
                            <p className={`text-lg sm:text-xl font-bold ${fThemeText}`}>
                              {answeredFQ}/{totalFQ}
                            </p>
                          </div>
                          {allDone && (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-emerald-300 flex-shrink-0 flex items-center gap-1.5 whitespace-nowrap">
                              <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> <span className="hidden sm:inline">ALL DONE</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 ${auditState === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-white/40 text-slate-700'}`}>
                            <Clock size={12} className="hidden sm:block" />
                            <span>{timerDisplay.active}</span>
                          </div>
                          {auditState === 'running' && (
                            <button
                              onClick={() => setShowSignatureModal(true)}
                              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
                              title="Submit Checklist"
                            >
                              <CheckCircle size={13} />
                              <span className="hidden sm:inline">Submit</span>
                            </button>
                          )}
                          {allDone && (
                            <button onClick={() => setShowFacilitySummary(true)} className="px-2 sm:px-4 py-1.5 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                              <CheckCircle className="w-3 sm:w-4 h-3 sm:h-4" /><span className="hidden sm:inline">View Summary</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${allDone ? 'from-emerald-400 via-teal-400 to-emerald-500' : fThemeGrad}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold ${fThemeText} opacity-75`}>
                            {progressPct}% Complete
                          </p>
                          <p className="text-xs font-medium text-slate-500">
                            {totalFQ - answeredFQ} remaining
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {allFacilityQs.map((question, qIdx) => {
                        const qAnswer = resolveAnswer(question.id);
                        return renderFacilityQuestionCard(question, qAnswer, qIdx, totalFQ);
                      })}
                    </div>
                    <input ref={facilityCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { if (activeFacilityQId) { handleFacilityImageCapture(activeFacilityQId, e.target.files); e.target.value = ''; } }} />
                    <input ref={facilityGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (activeFacilityQId) { handleFacilityImageCapture(activeFacilityQId, e.target.files); e.target.value = ''; } }} />
                  </>
                );
              })()}

              {!equipmentInfo && (<>
              <div className="sticky top-0 z-30 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 shadow-md">
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-violet-800 truncate min-w-0">
                      {unitForm.companyName || 'Company'}{unitForm.repName ? ` — ${unitForm.repName}` : ''}
                    </p>
                    {isCombinedAudit && combinedLocations && combinedLocations.length > 1 && (
                      <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        <Layers className="w-2.5 h-2.5" /> {combinedLocations.length} Depts
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {auditState === 'running' && (
                      <button onClick={handlePauseAudit} className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors" title="Pause">
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {auditState === 'paused' && (
                      <button onClick={handleResumeAudit} className="p-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors" title="Resume">
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(auditState === 'running' || auditState === 'paused') && (
                      <>
                        <button onClick={handleSaveAsDraft} className="p-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors" title="Save as Draft">
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setShowExcelImporter(true)} className="p-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors" title="Import from Excel">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleSignAndSend} disabled={totalAnswered < totalQuestions} className="p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={totalAnswered < totalQuestions ? `Answer all questions (${totalQuestions - totalAnswered} remaining)` : 'Sign & Send for Review'}>
                          <PenTool className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {auditState === 'draft' && (
                      <>
                        <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg" title="Draft Saved">
                          <Save className="w-3.5 h-3.5" />
                        </div>
                        <button onClick={handleResumeFromDraft} className="p-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-colors" title="Resume Audit">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={handleSignAndSend} disabled={totalAnswered < totalQuestions} className="p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Sign & Send for Review">
                          <PenTool className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {auditState === 'submitted' && (
                      <>
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </div>
                        <button onClick={handleEditSubmittedReport} className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors" title="Edit Report">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setShowPreviousReports(true); fetchPreviousReports(); }} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors border border-slate-200" title="Previous Reports">
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {(downloadableDepts.length > 1 || downloadableSections.length > 1) ? (
                          <div ref={downloadMenuRef} className="relative">
                            <button onClick={() => setDownloadMenuOpen(v => !v)} className="p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors" title="Download Report">
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            {downloadMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[250px] py-1 overflow-hidden max-h-[60vh] overflow-y-auto">
                                <button onClick={() => { setDownloadMenuOpen(false); generateAuditReport(); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2 transition-colors">
                                  <Layers className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                                  <span>
                                    <span className="font-semibold">Download Consolidated</span><br/>
                                    <span className="text-[10px] text-slate-400">All {downloadableDepts.length > 1 ? 'departments' : 'sections'} in one report</span>
                                  </span>
                                </button>
                                {downloadableDepts.length > 1 && (
                                  <>
                                    <button onClick={() => { setDownloadMenuOpen(false); generatePerDepartmentReports(); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                      <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                      <span><span className="font-semibold">All Departments (Separate PDFs)</span><br/><span className="text-[10px] text-slate-400">{downloadableDepts.length} individual reports</span></span>
                                    </button>
                                    <div className="border-t border-slate-100 mx-3 my-1" />
                                    <div className="px-3 py-0.5"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Individual Department</span></div>
                                    {downloadableDepts.map((deptName, di) => (
                                      <button key={di} onClick={() => { setDownloadMenuOpen(false); generateAuditReport({ filterPageTitles: [deptName], fileNameOverride: `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${deptName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`, reportSubtitle: `Department: ${deptName}` }); }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                        <FileDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="font-semibold truncate">{deptName}</span>
                                      </button>
                                    ))}
                                  </>
                                )}
                                {downloadableSections.length > 1 && (
                                  <>
                                    <button onClick={() => { setDownloadMenuOpen(false); generatePerSectionReports(); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                      <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                      <span><span className="font-semibold">All Sections (Separate PDFs)</span><br/><span className="text-[10px] text-slate-400">{downloadableSections.length} individual reports</span></span>
                                    </button>
                                    <div className="border-t border-slate-100 mx-3 my-1" />
                                    <div className="px-3 py-0.5"><span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Individual Section</span></div>
                                    {downloadableSections.map((secName, si) => (
                                      <button key={si} onClick={() => {
                                        setDownloadMenuOpen(false);
                                        const page = template.pages[0];
                                        const sec = page.sections.find(s => (s.title || 'Untitled') === secName);
                                        if (sec) {
                                          const virtualPage = { ...page, sections: [sec], title: secName };
                                          generateAuditReport({ overridePages: [virtualPage], fileNameOverride: `${(unitForm.companyName || template.title || 'Audit').replace(/[^a-zA-Z0-9]/g, '_')}_${secName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`, reportSubtitle: `Section: ${secName}` });
                                        }
                                      }} className="w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                                        <FileDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        <span className="font-semibold truncate">{secName}</span>
                                      </button>
                                    ))}
                                  </>
                                )}
                                {isLocationMode && locationVirtualPages && locationVirtualPages.length > 1 && (
                                  <>
                                    <div className="border-t border-slate-100 mx-3 my-1" />
                                    <button onClick={() => { setDownloadMenuOpen(false); generatePerLocationReports(); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors">
                                      <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                      <span><span className="font-semibold">By Location</span><br/><span className="text-[10px] text-slate-400">Separate report per location ({locationVirtualPages.length})</span></span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button onClick={() => generateAuditReport()} className="p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors" title="Download Report">
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div ref={excelMenuRef} className="relative">
                          <button onClick={() => setExcelMenuOpen(v => !v)} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors" title="Export Excel">
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                          {excelMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[210px] py-1 overflow-hidden">
                              <button onClick={() => exportQuestionsToExcel('department')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                                <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                <span><span className="font-semibold">By Department</span><br/><span className="text-[10px] text-slate-400">Sheet per dept + consolidated</span></span>
                              </button>
                              <button onClick={() => exportQuestionsToExcel('responsibility')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700 flex items-center gap-2 transition-colors">
                                <User className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                                <span><span className="font-semibold">By Responsibility</span><br/><span className="text-[10px] text-slate-400">Sheet per resp + consolidated</span></span>
                              </button>
                              <button onClick={() => exportQuestionsToExcel('location')} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors">
                                <MapPin className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                <span><span className="font-semibold">By Location</span><br/><span className="text-[10px] text-slate-400">Sheet per location + consolidated</span></span>
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <div className={`bg-white/80 backdrop-blur-sm border text-violet-700 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-bold font-mono ${auditState === 'paused' ? 'border-amber-300 text-amber-600 animate-pulse' : 'border-violet-200'}`}>{timerDisplay.active}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {unitForm.scope && <p className="text-[10px] sm:text-xs text-gray-500 truncate min-w-0 flex-1">Scope: {unitForm.scope}</p>}
                  {!unitForm.scope && <div className="flex-1" />}
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap justify-end">
                    <span className="text-[8px] sm:text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">{totalAnswered} checked</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">{totalQuestions - totalAnswered} unchecked</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">{overallScore.obtained}/{overallScore.max} marks</span>
                    <div className="w-10 sm:w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {locationGroupedByDept ? (
                locationGroupedByDept.map(({ deptName, items }, deptIdx) => {
                  const deptKey = `dept::${deptName}`;
                  const isDeptExpanded = openDeptKey === deptName;
                  const deptTotalQ = items.reduce((dt: number, { pages: lp }: any) => dt + lp.reduce((t: number, p: any) => t + p.sections.reduce((s: number, sec: any) => applicability[sec.id] === false ? s : s + dedupQuestions(_applicableSecQs(sec)).length, 0), 0), 0);
                  const deptAnsweredQ = items.reduce((dt: number, { pages: lp }: any) => dt + lp.reduce((t: number, p: any) => t + p.sections.reduce((s: number, sec: any) => applicability[sec.id] === false ? s : s + dedupQuestions(_applicableSecQs(sec)).filter((q: any) => resolveAnswer(q.id)?.selectedIndex !== null && resolveAnswer(q.id)?.selectedIndex !== undefined).length, 0), 0), 0);
                  const deptScore: ScoreInfo = items.reduce((acc: ScoreInfo, { pages: lp }: any) => {
                    const s = lp.reduce((a2: ScoreInfo, p: any) => { const ps = calculatePageScore(p); return { obtained: a2.obtained + ps.obtained, max: a2.max + ps.max, unanswered: a2.unanswered + ps.unanswered }; }, { obtained: 0, max: 0, unanswered: 0 });
                    return { obtained: acc.obtained + s.obtained, max: acc.max + s.max, unanswered: acc.unanswered + s.unanswered };
                  }, { obtained: 0, max: 0, unanswered: 0 });
                  return (
                    <div key={deptName} className="mb-4 sm:mb-5" data-accordion-id={`dept-${deptName}`}>
                      {/* Department header */}
                      <button
                        onClick={() => { const isOpen = openDeptKey === deptName; setOpenDeptKey(isOpen ? null : deptName); if (!isOpen) { setOpenLocationKey(null); setOpenSectionKey(null); setOpenSubSectionKey(null); scrollToAccordion(`dept-${deptName}`); } }}
                        className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all border ${isDeptExpanded ? 'bg-violet-700 text-white border-violet-700 shadow-lg shadow-violet-100' : 'bg-white text-gray-800 border-gray-200 hover:border-violet-200 shadow-sm'}`}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0 ${isDeptExpanded ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-600'}`}>{deptIdx + 1}</div>
                          <div className="text-left min-w-0 flex-1">
                            <div className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${isDeptExpanded ? 'text-violet-200' : 'text-gray-400'}`}>Department</div>
                            <div className={`text-sm sm:text-base font-bold truncate ${isDeptExpanded ? 'text-white' : 'text-gray-800'}`}>{deptName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDeptExpanded ? 'bg-white/15 text-white/90' : 'bg-gray-100 text-gray-500'}`}>{items.length} location{items.length !== 1 ? 's' : ''}</span>
                            <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDeptExpanded ? 'bg-white/15 text-white/90' : 'bg-gray-100 text-gray-500'}`}>{deptAnsweredQ}/{deptTotalQ} Q</span>
                            {(deptTotalQ - deptAnsweredQ) > 0 && <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDeptExpanded ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-50 text-amber-600'}`}>{deptTotalQ - deptAnsweredQ} unchecked</span>}
                          </div>
                          <ScoreBadge score={deptScore} />
                          <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${!isDeptExpanded ? '-rotate-90' : ''} ${isDeptExpanded ? 'text-violet-200' : 'text-gray-400'}`} />
                        </div>
                      </button>

                      {/* Locations inside this department */}
                      {isDeptExpanded && (
                        <div className="mt-2 sm:mt-3 pl-2 sm:pl-3 space-y-2 sm:space-y-2.5 border-l-2 border-violet-100">
                          {items.map(({ locationName, pages: locPages }: any, locIdx: number) => {
                            const locKey = `${deptName}::${locationName}`;
                            const isLocOpen = openLocationKey === locKey;
                            const isLocApplicable = locationApplicability[locationName] !== false;
                            const locTotalQ = locPages.reduce((t: number, p: any) => t + p.sections.reduce((s: number, sec: any) => applicability[sec.id] === false ? s : s + dedupQuestions(_applicableSecQs(sec)).length, 0), 0);
                            const locAnsweredQ = locPages.reduce((t: number, p: any) => t + p.sections.reduce((s: number, sec: any) => applicability[sec.id] === false ? s : s + dedupQuestions(_applicableSecQs(sec)).filter((q: any) => resolveAnswer(q.id)?.selectedIndex !== null && resolveAnswer(q.id)?.selectedIndex !== undefined).length, 0), 0);
                            const locScoreInfo: ScoreInfo = locPages.reduce((acc: ScoreInfo, p: any) => { const ps = calculatePageScore(p); return { obtained: acc.obtained + ps.obtained, max: acc.max + ps.max, unanswered: acc.unanswered + ps.unanswered }; }, { obtained: 0, max: 0, unanswered: 0 });
                            return (
                              <div key={locationName} className="ml-1 sm:ml-2" data-accordion-id={`loc-${locKey}`}>
                                {/* Location row — accordion */}
                                <button
                                  onClick={() => {
                                    const newKey = isLocOpen ? null : locKey;
                                    setOpenLocationKey(newKey);
                                    setOpenSectionKey(null);
                                    setOpenSubSectionKey(null);
                                    if (newKey) { setLockedLocation(locationName); scrollToAccordion(`loc-${locKey}`); }
                                  }}
                                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border transition-all ${isLocOpen ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-200 shadow-sm'}`}>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-[9px] sm:text-[10px] font-bold flex-shrink-0 ${isLocOpen ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'}`}>{locIdx + 1}</div>
                                    <div className="text-left min-w-0 flex-1">
                                      <div className={`text-xs sm:text-sm font-semibold truncate ${isLocOpen ? 'text-white' : 'text-gray-800'}`}>{locationName}</div>
                                    </div>
                                    {!isLocApplicable && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isLocOpen ? 'bg-white/20 text-white/80' : 'bg-gray-100 text-gray-400'}`}>N/A</span>}
                                  </div>
                                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                                    {isLocApplicable && (
                                      <div className="flex flex-col items-end gap-0.5">
                                        <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isLocOpen ? 'bg-white/15 text-white/90' : 'bg-gray-100 text-gray-500'}`}>{locAnsweredQ}/{locTotalQ} Q</span>
                                        {(locTotalQ - locAnsweredQ) > 0 && <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isLocOpen ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-50 text-amber-600'}`}>{locTotalQ - locAnsweredQ} unchecked</span>}
                                        <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isLocOpen ? 'bg-white/15 text-white/90' : 'bg-violet-50 text-violet-600'}`}>{locScoreInfo.obtained}/{locScoreInfo.max} marks</span>
                                      </div>
                                    )}
                                    {isLocApplicable ? <ScoreBadge score={locScoreInfo} /> : <ScoreBadge score={{ obtained: 0, max: 0, unanswered: 0 }} isNA={true} />}
                                    <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${!isLocOpen ? '-rotate-90' : ''} ${isLocOpen ? 'text-indigo-200' : 'text-gray-400'}`} />
                                  </div>
                                </button>

                                {/* Checklist for this location */}
                                {isLocOpen && (
                                  <div className="mt-2 sm:mt-2.5 pl-2 sm:pl-3 space-y-2 sm:space-y-3 border-l-2 border-indigo-100">
                                    <div className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 ml-1 sm:ml-2">
                                      <p className="text-xs sm:text-sm font-medium text-gray-600 mb-2">Is this location applicable?</p>
                                      <div className="flex gap-3 sm:gap-4">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="radio" name={`loc-applicable-${locationName}`}
                                            checked={locationApplicability[locationName] !== false}
                                            onChange={() => setLocationApplicability(prev => ({ ...prev, [locationName]: true }))}
                                            className="accent-indigo-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                          <span className="text-xs sm:text-sm text-gray-700 font-medium">Yes</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input type="radio" name={`loc-applicable-${locationName}`}
                                            checked={locationApplicability[locationName] === false}
                                            onChange={() => setLocationApplicability(prev => ({ ...prev, [locationName]: false }))}
                                            className="accent-indigo-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                          <span className="text-xs sm:text-sm text-gray-700 font-medium">Not Applicable</span>
                                        </label>
                                      </div>
                                    </div>
                                    <div className={!isLocApplicable ? 'opacity-40 pointer-events-none' : ''}>
                                      {locPages.map((page: any, pIdx: number) => renderSinglePage(page, pIdx, true))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                template.pages.map((page, pIdx) => renderSinglePage(page, pIdx))
              )}
              </>)}

            </>
          )}
        </div>
      </div>

      {currentStep === 'checklist' && searchOpen && (
        <div className="fixed bottom-4 sm:bottom-5 right-4 z-[10002]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 w-[280px] sm:w-[320px] animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setSearchMatchIdx(0); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchMatches.length > 0) {
                      navigateToMatch(e.shiftKey ? (searchMatchIdx - 1 + searchMatches.length) % searchMatches.length : (searchMatchIdx + 1) % searchMatches.length);
                    }
                    if (e.key === 'Escape') { setSearchOpen(false); setSearchTerm(''); }
                  }}
                  placeholder="Search questions..."
                  className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-slate-50"
                  autoFocus
                />
              </div>
              <button onClick={() => { setSearchOpen(false); setSearchTerm(''); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {searchTerm.trim() && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  {searchMatches.length > 0 ? `${searchMatchIdx + 1} of ${searchMatches.length} match${searchMatches.length !== 1 ? 'es' : ''}` : 'No matches found'}
                </span>
                {searchMatches.length > 0 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigateToMatch((searchMatchIdx - 1 + searchMatches.length) % searchMatches.length)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors" title="Previous">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => navigateToMatch((searchMatchIdx + 1) % searchMatches.length)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700 transition-colors" title="Next">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
            {searchMatches.length > 0 && searchTerm.trim() && (
              <div className="mt-2 max-h-[140px] overflow-y-auto border-t border-slate-100 pt-2 space-y-1">
                {searchMatches.map((m, i) => (
                  <button key={`${m.questionId}-${i}`} onClick={() => navigateToMatch(i)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${i === searchMatchIdx ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' : 'hover:bg-slate-50 text-slate-600'}`}>
                    <p className="font-medium truncate leading-snug">{m.text || 'Untitled Question'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{m.deptName && m.locationName ? `${m.deptName} > ${m.locationName} > ${m.context}` : m.context}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showObservationPanel && !equipmentInfo && (
        <div className="fixed inset-0 z-[10002] bg-black/40 backdrop-blur-sm flex flex-col" onClick={() => setShowObservationPanel(false)}>
          <div className="bg-white shadow-2xl flex flex-col animate-in slide-in-from-bottom h-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">Live Observations</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400">{liveObservations.length} observation{liveObservations.length !== 1 ? 's' : ''} · {liveObservations.filter(o => o.closureStatus === 'Closed').length} closed · {liveObservations.filter(o => o.closureStatus === 'Open').length} open{panelLiveDrafts.length > 0 ? ` · ${panelLiveDrafts.length} draft${panelLiveDrafts.length !== 1 ? 's' : ''}` : ''}</p>
                </div>
              </div>
              <button onClick={() => setShowObservationPanel(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <button
              onClick={() => setShowPanelAddObs(true)}
              className="absolute bottom-6 right-6 w-14 h-14 bg-violet-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 hover:bg-violet-700 transition-all z-[10004] border-4 border-white"
              title="Add New Observation"
            >
              <Plus className="w-7 h-7" strokeWidth={3} />
            </button>
            <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 pb-1 flex-shrink-0 overflow-x-auto scrollbar-none">
              <button onClick={() => setObsPanelTab('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${obsPanelTab === 'all' ? 'bg-violet-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                All Observations
              </button>
              <button onClick={() => setObsPanelTab('checklist')}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${obsPanelTab === 'checklist' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                <ClipboardList className="w-3 h-3" /> Checklist
              </button>
              <button onClick={() => setObsPanelTab('top-concerns')}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${obsPanelTab === 'top-concerns' ? 'bg-rose-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                <Target className="w-3 h-3" /> Top 5
              </button>
              <button onClick={async () => { setObsPanelTab('drafts'); try { const hydrated = await loadAndMergeDrafts(); setPanelLiveDrafts(hydrated); const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {}; for (const d of hydrated) { if (d.managementTag === 'management-focus' || d.managementTag === 'easy-impactful' || d.managementTag === 'ongoing') { tagUpdates['DFT_' + d.id] = d.managementTag; } } if (Object.keys(tagUpdates).length > 0) { setObsTags(prev => ({ ...prev, ...tagUpdates })); } } catch { setPanelLiveDrafts([]); } }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 relative whitespace-nowrap shrink-0 ${obsPanelTab === 'drafts' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                <AlertTriangle className="w-3 h-3" /> Drafts
                {panelLiveDrafts.length > 0 && obsPanelTab !== 'drafts' && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[7px] font-black flex items-center justify-center border border-white">{panelLiveDrafts.length}</span>
                )}
              </button>
              {(() => {
                const regMfCount = registryObservations.filter(ro => obsTags[ro.id] === 'management-focus').length;
                const regEiCount = registryObservations.filter(ro => obsTags[ro.id] === 'easy-impactful').length;
                const regOgCount = registryObservations.filter(ro => obsTags[ro.id] === 'ongoing').length;
                const mfCount = [...liveObservations, ...panelLiveDrafts].filter(o => obsTags[('entryId' in o ? o.entryId || o.questionId : 'DFT_' + (o as any).id) as string] === 'management-focus').length + regMfCount;
                const eiCount = [...liveObservations, ...panelLiveDrafts].filter(o => obsTags[('entryId' in o ? o.entryId || o.questionId : 'DFT_' + (o as any).id) as string] === 'easy-impactful').length + regEiCount;
                const ogCount = [...liveObservations, ...panelLiveDrafts].filter(o => obsTags[('entryId' in o ? o.entryId || o.questionId : 'DFT_' + (o as any).id) as string] === 'ongoing').length + regOgCount;
                return (<>
                  <button onClick={() => setObsPanelTab('management-focus')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 relative whitespace-nowrap shrink-0 ${obsPanelTab === 'management-focus' ? 'bg-rose-700 text-white shadow-sm' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'}`}>
                    🔴 Mgmt Focus
                    {mfCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[7px] font-black flex items-center justify-center">{mfCount}</span>}
                  </button>
                  <button onClick={() => setObsPanelTab('easy-impactful')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 relative whitespace-nowrap shrink-0 ${obsPanelTab === 'easy-impactful' ? 'bg-emerald-700 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'}`}>
                    🟢 Easy Impact
                    {eiCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-emerald-600 text-white text-[7px] font-black flex items-center justify-center">{eiCount}</span>}
                  </button>
                  <button onClick={() => setObsPanelTab('ongoing')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 relative whitespace-nowrap shrink-0 ${obsPanelTab === 'ongoing' ? 'bg-blue-700 text-white shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}>
                    🔵 Ongoing
                    {ogCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-blue-600 text-white text-[7px] font-black flex items-center justify-center">{ogCount}</span>}
                  </button>
                  {(() => {
                    const utCount = [...liveObservations, ...panelLiveDrafts].filter(o => !obsTags[('entryId' in o ? o.entryId || o.questionId : 'DFT_' + (o as any).id) as string]).length;
                    return (
                      <button onClick={() => setObsPanelTab('untagged')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 relative whitespace-nowrap shrink-0 ${obsPanelTab === 'untagged' ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>
                        ⬜ Untagged
                        {utCount > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-slate-500 text-white text-[7px] font-black flex items-center justify-center">{utCount}</span>}
                      </button>
                    );
                  })()}
                </>);
              })()}
              <div className="ml-auto shrink-0">
                <button
                  onClick={async () => {
                    try {
                      const ExcelJS = (await import('exceljs')).default;
                      const wb = new ExcelJS.Workbook();
                      const isDrafts = obsPanelTab === 'drafts';
                      const ws = wb.addWorksheet(isDrafts ? 'Draft Observations' : 'All Observations');
                      const fetchImg = async (url: string): Promise<ArrayBuffer | null> => {
                        try { const r = await fetch(url); const b = await r.blob(); return await b.arrayBuffer(); } catch { return null; }
                      };
                      const imgPadding = 30000; const rowH = 90; const imgW = 100; const imgH = 80;
                      if (isDrafts) {
                        ws.columns = [
                          { header: 'Question', key: 'question', width: 40 },
                          { header: 'Observation', key: 'comment', width: 45 },
                          { header: 'Evidence', key: 'evidence', width: 20 },
                          { header: 'Location', key: 'location', width: 20 },
                          { header: 'Section', key: 'section', width: 25 },
                          { header: 'Management Tag', key: 'managementTag', width: 18 },
                          { header: 'Date', key: 'date', width: 18 },
                        ];
                      } else {
                        ws.columns = [
                          { header: 'Question', key: 'question', width: 40 },
                          { header: 'Observation', key: 'comment', width: 45 },
                          { header: 'Evidence (Before)', key: 'evidence_before', width: 20 },
                          { header: 'Location', key: 'location', width: 20 },
                          { header: 'Section', key: 'section', width: 25 },
                          { header: 'Risk', key: 'risk', width: 10 },
                          { header: 'Status', key: 'status', width: 12 },
                          { header: 'Marks Max', key: 'marksMax', width: 12 },
                          { header: 'Marks Obtained', key: 'marksObtained', width: 14 },
                          { header: 'Evidence (After)', key: 'evidence_after', width: 20 },
                          { header: 'Management Tag', key: 'managementTag', width: 18 },
                          { header: 'Repeat', key: 'isRepeat', width: 10 },
                          { header: 'Repeat Since', key: 'repeatSince', width: 14 },
                          { header: 'Repeat Trail', key: 'repeatTrail', width: 30 },
                          { header: 'Date', key: 'date', width: 18 },
                        ];
                      }
                      const hr = ws.getRow(1);
                      hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                      hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                      hr.alignment = { vertical: 'middle', horizontal: 'center' };
                      hr.height = 28;
                      if (isDrafts) {
                        for (let i = 0; i < panelLiveDrafts.length; i++) {
                          const d = panelLiveDrafts[i];
                          const draftTagKey = 'DFT_' + d.id;
                          const draftTag = obsTags[draftTagKey] || d.managementTag;
                          const draftTagLabel = draftTag === 'management-focus' ? 'Mgmt Focus' : draftTag === 'easy-impactful' ? 'Easy Impact' : draftTag === 'ongoing' ? 'Ongoing' : '';
                          const row = ws.addRow({ question: d.questionText || '', comment: d.commentText || '', evidence: '', location: d.location || '', section: d.sectionTitle || '', managementTag: draftTagLabel, date: d.createdAt ? new Date(d.createdAt).toLocaleString() : '' });
                          row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
                          const excelRow = row.number - 1;
                          const firstImg = d.commentImages?.[0];
                          if (firstImg) {
                            const buf = firstImg.startsWith('data:') ? Uint8Array.from(atob(firstImg.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(firstImg);
                            if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 2, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch(e) { console.error('Draft img err', e); } }
                          }
                        }
                      } else {
                        const sorted = [...liveObservations].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
                        for (let i = 0; i < sorted.length; i++) {
                          const obs = sorted[i];
                          const obsTagKey = obs.entryId || obs.questionId;
                          const obsTag = obsTags[obsTagKey] || obs.managementTag;
                          const obsTagLabel = obsTag === 'management-focus' ? 'Mgmt Focus' : obsTag === 'easy-impactful' ? 'Easy Impact' : obsTag === 'ongoing' ? 'Ongoing' : '';
                          const obsTrailStr = obs.repeatTrail && obs.repeatTrail.length > 0 ? obs.repeatTrail.map((t: any) => t.date + (t.comment ? ': ' + t.comment : '')).join(' → ') : '';
                          const row = ws.addRow({ question: clTabQuestionTextRemap[obs.questionText] || obs.questionText || '', comment: obs.comment || '', evidence_before: '', location: obs.location || '', section: obs.sectionTitle || '', risk: obs.risk || '', status: obs.closureStatus || 'Open', marksMax: obs.marksMax, marksObtained: obs.marksObtained, evidence_after: '', managementTag: obsTagLabel, isRepeat: obs.isRepeat ? 'Yes' : '', repeatSince: obs.repeatOriginalDate || '', repeatTrail: obsTrailStr, date: obs.createdAtMs ? new Date(obs.createdAtMs).toLocaleString() : '' });
                          row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
                          const excelRow = row.number - 1;
                          const beforeImg = obs.images?.[0];
                          if (beforeImg) {
                            const buf = beforeImg.startsWith('data:') ? Uint8Array.from(atob(beforeImg.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(beforeImg);
                            if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 2, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch(e) { console.error('Before img err', e); } }
                          }
                          const afterImg = obs.closureEvidence?.[0];
                          if (afterImg) {
                            const buf = afterImg.startsWith('data:') ? Uint8Array.from(atob(afterImg.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(afterImg);
                            if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 9, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch(e) { console.error('After img err', e); } }
                          }
                        }
                      }
                      const buf = await wb.xlsx.writeBuffer();
                      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = URL.createObjectURL(blob);
                      const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
                      if (isPWA || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                        const w = window.open(url, '_blank');
                        if (!w) { const a = document.createElement('a'); a.href = url; a.download = `${isDrafts ? 'Draft' : 'All'}_Observations_${new Date().toISOString().split('T')[0]}.xlsx`; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000); }
                        else { setTimeout(() => URL.revokeObjectURL(url), 5000); }
                      } else {
                        const a = document.createElement('a'); a.href = url; a.download = `${isDrafts ? 'Draft' : 'All'}_Observations_${new Date().toISOString().split('T')[0]}.xlsx`; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
                      }
                    } catch (err) { console.error('Excel export failed', err); }
                  }}
                  className="p-1.5 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 active:scale-95 transition-all"
                  title={`Export ${obsPanelTab === 'drafts' ? 'Drafts' : 'All Observations'} to Excel`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {(obsPanelTab === 'all' || obsPanelTab === 'drafts' || obsPanelTab === 'checklist') && (
              <div className="flex items-center gap-1 px-4 sm:px-6 pb-2 pt-1 flex-shrink-0 overflow-x-auto scrollbar-none border-b border-gray-100">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Filter:</span>
                {([
                  ['all', 'All', 'bg-slate-700 text-white', 'bg-slate-100 text-slate-500 hover:bg-slate-200'],
                  ['management-focus', '🔴 Mgmt Focus', 'bg-rose-600 text-white', 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'],
                  ['easy-impactful', '🟢 Easy Impact', 'bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'],
                  ['ongoing', '🔵 Ongoing', 'bg-blue-600 text-white', 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'],
                  ['untagged', '⬜ Untagged', 'bg-gray-600 text-white', 'bg-gray-100 text-gray-500 hover:bg-gray-200'],
                ] as const).map(([f, label, activeClass, inactiveClass]) => (
                  <button key={f} onClick={() => setObsTagFilter(f as typeof obsTagFilter)}
                    className={`px-2.5 py-1 rounded-md text-[8px] sm:text-[9px] font-bold whitespace-nowrap shrink-0 transition-all ${obsTagFilter === f ? activeClass : inactiveClass}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {obsPanelTab === 'checklist' ? (
              <>
              <div className="flex items-center gap-1.5 mb-3 border-b border-slate-200 pb-2">
                <button onClick={() => setChecklistSubTab('hierarchy')}
                  className={`px-3 py-1 rounded-t-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all ${checklistSubTab === 'hierarchy' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  <ClipboardList className="w-3 h-3 inline mr-1" />Checklist View
                </button>
                <button onClick={() => setChecklistSubTab('live')}
                  className={`px-3 py-1 rounded-t-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${checklistSubTab === 'live' ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  <Eye className="w-3 h-3" /> Live Observations
                  {fullRegistryObs.length > 0 && (
                    <span className={`ml-0.5 min-w-[16px] h-4 rounded-full text-[8px] font-black flex items-center justify-center px-1 ${checklistSubTab === 'live' ? 'bg-white/30 text-white' : 'bg-violet-100 text-violet-600'}`}>{fullRegistryObs.length}</span>
                  )}
                </button>
                {checklistSubTab === 'live' && (
                  <button
                    onClick={() => handleLiveObsExcelExport(liveObsFilteredRef.current)}
                    disabled={liveObsExcelExporting || fullRegistryObs.length === 0}
                    className="ml-auto px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export Live Observations to Excel"
                  >
                    {liveObsExcelExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
                    <span className="hidden sm:inline">{liveObsExcelExporting ? 'Exporting...' : 'Excel'}</span>
                  </button>
                )}
              </div>
              {checklistSubTab === 'hierarchy' ? (
              <ChecklistObservationView
                data={fullRegistryObs}
                auditQuestions={clTabAuditQuestions}
                auditTasks={clTabAuditTasks}
                onViewImage={(img) => setObsImagePreview(img.url)}
                questionTextRemap={clTabQuestionTextRemap}
                questionTextAliases={clTabQuestionTextAliases}
                fabZIndex="z-[10006]"
                modalZIndex="z-[10007]"
                fabBottom="bottom-24"
                onMarkRepeat={async (obs) => {
                  const origDate = obs.createdDate ? new Date(obs.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                  const images = await fetchObsImages(obs.id, obs.allEvidence, obs.thumbnail);
                  setRepeatObsData({
                    questionId: obs.questionText || '',
                    questionText: obs.questionText || '',
                    sectionTitle: obs.sectionTitle || obs.sop || '',
                    location: obs.area || '',
                    comment: obs.observationText || obs.title || '',
                    images,
                    originalDate: obs.repeatOriginalDate || origDate,
                    repeatTrail: [
                      ...(obs.repeatTrail || []),
                      ...(obs.repeatOriginalDate ? [] : [{ date: origDate, comment: obs.observationText || obs.title || '' }]),
                    ],
                    sourceEntryId: obs.id,
                    checklistName: obs.checklistName || '',
                    selectedAnswer: undefined,
                    selectedAnswerIndex: null,
                  });
                }}
              />
              ) : (
              <>
              {(() => {
                const liveFilterCount = Object.values(liveObsFilters).filter(v => v).length + (liveObsDateFrom ? 1 : 0) + (liveObsDateTo ? 1 : 0);
                const liveFilterOptions = (() => {
                  const cats = new Set<string>(), depts = new Set<string>(), locs = new Set<string>(), sops = new Set<string>(), subSopsSet = new Set<string>(), resps = new Set<string>();
                  fullRegistryObs.forEach(o => {
                    if (o.categories) o.categories.forEach(c => cats.add(c.name));
                    if (o.area) locs.add(o.area);
                    if (o.sop) sops.add(o.sop);
                    if (o.sectionTitle) subSopsSet.add(o.sectionTitle);
                    if (o.people) o.people.forEach(p => resps.add(p.name));
                    if (o.unitName) depts.add(o.unitName);
                    if (o.departmentName) depts.add(o.departmentName);
                  });
                  return { categories: [...cats].sort(), departments: [...depts].sort(), locations: [...locs].sort(), sops: [...sops].sort(), subSops: [...subSopsSet].sort(), responsibilities: [...resps].sort() };
                })();
                const _filteredObs = fullRegistryObs.filter(obs => {
                  if (obsTagFilter !== 'all') {
                    if (obsTagFilter === 'untagged' && obs.managementTag) return false;
                    if (obsTagFilter !== 'untagged' && obs.managementTag !== obsTagFilter) return false;
                  }
                  if (liveObsDateFrom || liveObsDateTo) {
                    if (!obs.createdDate) return false;
                    try {
                      const d = new Date(obs.createdDate).getTime();
                      if (isNaN(d)) return false;
                      if (liveObsDateFrom) { const from = new Date(liveObsDateFrom); from.setHours(0,0,0,0); if (d < from.getTime()) return false; }
                      if (liveObsDateTo) { const to = new Date(liveObsDateTo); to.setHours(23,59,59,999); if (d > to.getTime()) return false; }
                    } catch { return false; }
                  }
                  if (liveObsFilters.category && (!obs.categories || !obs.categories.some(c => c.name === liveObsFilters.category))) return false;
                  if (liveObsFilters.department) {
                    if (obs.unitName !== liveObsFilters.department && obs.departmentName !== liveObsFilters.department) return false;
                  }
                  if (liveObsFilters.location && obs.area !== liveObsFilters.location) return false;
                  if (liveObsFilters.sop && obs.sop !== liveObsFilters.sop) return false;
                  if (liveObsFilters.subSop && obs.sectionTitle !== liveObsFilters.subSop) return false;
                  if (liveObsFilters.responsibility && (!obs.people || !obs.people.some(p => p.name === liveObsFilters.responsibility))) return false;
                  return true;
                });
                liveObsFilteredRef.current = _filteredObs;

                const LiveObsFilterSelect = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">{label}</label>
                    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all appearance-none">
                      <option value="">All</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                );

                if (_filteredObs.length === 0) return (
                  <>
                  <button onClick={() => setLiveObsShowFilters(true)} className={`fixed bottom-24 right-6 z-[10006] p-3.5 rounded-2xl shadow-2xl border-2 transition-all active:scale-90 ${liveFilterCount > 0 ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`} title="Open Filters">
                    <SlidersHorizontal className="w-5 h-5" />
                    {liveFilterCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">{liveFilterCount}</span>}
                  </button>
                  {liveObsShowFilters && (
                    <div className="fixed inset-0 z-[10007] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setLiveObsShowFilters(false)}>
                      <div className="bg-white w-full sm:w-[480px] sm:max-w-[95vw] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><SlidersHorizontal className="w-[18px] h-[18px]" /></div>
                            <div>
                              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Filters</h3>
                              <p className="text-[10px] text-slate-400 font-bold">{liveFilterCount > 0 ? `${liveFilterCount} active` : 'No filters applied'}</p>
                            </div>
                          </div>
                          <button onClick={() => setLiveObsShowFilters(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-[18px] h-[18px] text-slate-400" /></button>
                        </div>
                        <div className="px-5 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">From Date</label>
                              <input type="date" value={liveObsDateFrom} onChange={e => setLiveObsDateFrom(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">To Date</label>
                              <input type="date" value={liveObsDateTo} onChange={e => setLiveObsDateTo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                            </div>
                          </div>
                          <div className="space-y-3">
                            <LiveObsFilterSelect label="Observation Category" value={liveObsFilters.category} options={liveFilterOptions.categories} onChange={v => setLiveObsFilters(f => ({ ...f, category: v }))} />
                            <LiveObsFilterSelect label="Department" value={liveObsFilters.department} options={liveFilterOptions.departments} onChange={v => setLiveObsFilters(f => ({ ...f, department: v }))} />
                            <LiveObsFilterSelect label="Location" value={liveObsFilters.location} options={liveFilterOptions.locations} onChange={v => setLiveObsFilters(f => ({ ...f, location: v }))} />
                            <LiveObsFilterSelect label="SOP" value={liveObsFilters.sop} options={liveFilterOptions.sops} onChange={v => setLiveObsFilters(f => ({ ...f, sop: v }))} />
                            <LiveObsFilterSelect label="Sub SOP" value={liveObsFilters.subSop} options={liveFilterOptions.subSops} onChange={v => setLiveObsFilters(f => ({ ...f, subSop: v }))} />
                            <LiveObsFilterSelect label="Responsibility" value={liveObsFilters.responsibility} options={liveFilterOptions.responsibilities} onChange={v => setLiveObsFilters(f => ({ ...f, responsibility: v }))} />
                          </div>
                        </div>
                        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
                          {liveFilterCount > 0 && (
                            <button onClick={() => { setLiveObsFilters({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' }); setLiveObsDateFrom(''); setLiveObsDateTo(''); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
                              <RotateCcw className="w-3 h-3" /> Clear All
                            </button>
                          )}
                          <button onClick={() => setLiveObsShowFilters(false)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {liveFilterCount > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active:</span>
                      {liveObsFilters.category && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[9px] font-bold border border-violet-100"><span className="truncate max-w-[80px]">{liveObsFilters.category}</span><button onClick={() => setLiveObsFilters(f => ({...f, category: ''}))} className="hover:text-violet-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsFilters.department && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold border border-blue-100"><span className="truncate max-w-[80px]">{liveObsFilters.department}</span><button onClick={() => setLiveObsFilters(f => ({...f, department: ''}))} className="hover:text-blue-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsFilters.location && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold border border-emerald-100"><span className="truncate max-w-[80px]">{liveObsFilters.location}</span><button onClick={() => setLiveObsFilters(f => ({...f, location: ''}))} className="hover:text-emerald-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsFilters.sop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-bold border border-amber-100"><span className="truncate max-w-[80px]">{liveObsFilters.sop}</span><button onClick={() => setLiveObsFilters(f => ({...f, sop: ''}))} className="hover:text-amber-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsFilters.subSop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-600 rounded-full text-[9px] font-bold border border-sky-100"><span className="truncate max-w-[80px]">{liveObsFilters.subSop}</span><button onClick={() => setLiveObsFilters(f => ({...f, subSop: ''}))} className="hover:text-sky-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsFilters.responsibility && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-bold border border-rose-100"><span className="truncate max-w-[80px]">{liveObsFilters.responsibility}</span><button onClick={() => setLiveObsFilters(f => ({...f, responsibility: ''}))} className="hover:text-rose-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsDateFrom && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">From: {liveObsDateFrom}<button onClick={() => setLiveObsDateFrom('')} className="hover:text-slate-800"><X className="w-2.5 h-2.5" /></button></span>}
                      {liveObsDateTo && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">To: {liveObsDateTo}<button onClick={() => setLiveObsDateTo('')} className="hover:text-slate-800"><X className="w-2.5 h-2.5" /></button></span>}
                    </div>
                  )}
                  <div className="text-center py-12">
                    <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">{fullRegistryObs.length === 0 ? 'No observations yet' : 'No items match this filter'}</p>
                    <p className="text-xs text-gray-300 mt-1">{fullRegistryObs.length === 0 ? 'Observations from the registry will appear here' : 'Try a different filter above'}</p>
                  </div>
                  </>
                );
                return (
                <>
                <button onClick={() => setLiveObsShowFilters(true)} className={`fixed bottom-24 right-6 z-[10006] p-3.5 rounded-2xl shadow-2xl border-2 transition-all active:scale-90 ${liveFilterCount > 0 ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`} title="Open Filters">
                  <SlidersHorizontal className="w-5 h-5" />
                  {liveFilterCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">{liveFilterCount}</span>}
                </button>
                {liveObsShowFilters && (
                  <div className="fixed inset-0 z-[10007] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setLiveObsShowFilters(false)}>
                    <div className="bg-white w-full sm:w-[480px] sm:max-w-[95vw] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
                      <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><SlidersHorizontal className="w-[18px] h-[18px]" /></div>
                          <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Filters</h3>
                            <p className="text-[10px] text-slate-400 font-bold">{liveFilterCount > 0 ? `${liveFilterCount} active` : 'No filters applied'}</p>
                          </div>
                        </div>
                        <button onClick={() => setLiveObsShowFilters(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="w-[18px] h-[18px] text-slate-400" /></button>
                      </div>
                      <div className="px-5 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">From Date</label>
                            <input type="date" value={liveObsDateFrom} onChange={e => setLiveObsDateFrom(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">To Date</label>
                            <input type="date" value={liveObsDateTo} onChange={e => setLiveObsDateTo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 transition-all" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <LiveObsFilterSelect label="Observation Category" value={liveObsFilters.category} options={liveFilterOptions.categories} onChange={v => setLiveObsFilters(f => ({ ...f, category: v }))} />
                          <LiveObsFilterSelect label="Department" value={liveObsFilters.department} options={liveFilterOptions.departments} onChange={v => setLiveObsFilters(f => ({ ...f, department: v }))} />
                          <LiveObsFilterSelect label="Location" value={liveObsFilters.location} options={liveFilterOptions.locations} onChange={v => setLiveObsFilters(f => ({ ...f, location: v }))} />
                          <LiveObsFilterSelect label="SOP" value={liveObsFilters.sop} options={liveFilterOptions.sops} onChange={v => setLiveObsFilters(f => ({ ...f, sop: v }))} />
                          <LiveObsFilterSelect label="Sub SOP" value={liveObsFilters.subSop} options={liveFilterOptions.subSops} onChange={v => setLiveObsFilters(f => ({ ...f, subSop: v }))} />
                          <LiveObsFilterSelect label="Responsibility" value={liveObsFilters.responsibility} options={liveFilterOptions.responsibilities} onChange={v => setLiveObsFilters(f => ({ ...f, responsibility: v }))} />
                        </div>
                      </div>
                      <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 flex-shrink-0">
                        {liveFilterCount > 0 && (
                          <button onClick={() => { setLiveObsFilters({ category: '', department: '', location: '', sop: '', subSop: '', responsibility: '' }); setLiveObsDateFrom(''); setLiveObsDateTo(''); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5">
                            <RotateCcw className="w-3 h-3" /> Clear All
                          </button>
                        )}
                        <button onClick={() => setLiveObsShowFilters(false)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {liveFilterCount > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Active:</span>
                    {liveObsFilters.category && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[9px] font-bold border border-violet-100"><span className="truncate max-w-[80px]">{liveObsFilters.category}</span><button onClick={() => setLiveObsFilters(f => ({...f, category: ''}))} className="hover:text-violet-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsFilters.department && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold border border-blue-100"><span className="truncate max-w-[80px]">{liveObsFilters.department}</span><button onClick={() => setLiveObsFilters(f => ({...f, department: ''}))} className="hover:text-blue-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsFilters.location && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold border border-emerald-100"><span className="truncate max-w-[80px]">{liveObsFilters.location}</span><button onClick={() => setLiveObsFilters(f => ({...f, location: ''}))} className="hover:text-emerald-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsFilters.sop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[9px] font-bold border border-amber-100"><span className="truncate max-w-[80px]">{liveObsFilters.sop}</span><button onClick={() => setLiveObsFilters(f => ({...f, sop: ''}))} className="hover:text-amber-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsFilters.subSop && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-600 rounded-full text-[9px] font-bold border border-sky-100"><span className="truncate max-w-[80px]">{liveObsFilters.subSop}</span><button onClick={() => setLiveObsFilters(f => ({...f, subSop: ''}))} className="hover:text-sky-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsFilters.responsibility && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-bold border border-rose-100"><span className="truncate max-w-[80px]">{liveObsFilters.responsibility}</span><button onClick={() => setLiveObsFilters(f => ({...f, responsibility: ''}))} className="hover:text-rose-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsDateFrom && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">From: {liveObsDateFrom}<button onClick={() => setLiveObsDateFrom('')} className="hover:text-slate-800"><X className="w-2.5 h-2.5" /></button></span>}
                    {liveObsDateTo && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full text-[9px] font-bold border border-slate-200">To: {liveObsDateTo}<button onClick={() => setLiveObsDateTo('')} className="hover:text-slate-800"><X className="w-2.5 h-2.5" /></button></span>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {_filteredObs.map((obs) => {
                  const sevColor = obs.severity === 'CRITICAL' ? 'rose' : obs.severity === 'MAJOR' ? 'amber' : 'slate';
                  const statusBg = obs.status === 'OPEN' ? 'bg-rose-50 text-rose-700 border-rose-200' : obs.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : obs.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200';
                  return (
                    <div key={obs.id} className={`rounded-xl border p-3 sm:p-4 transition-all flex flex-col ${obs.status === 'RESOLVED' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className="bg-slate-800 text-slate-200 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded tracking-wider">{obs.id}</span>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${sevColor === 'rose' ? 'bg-rose-100 text-rose-600' : sevColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{obs.severity}</span>
                        <span className="bg-slate-100 text-slate-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{obs.level}</span>
                        {obs.isRepeat && (
                          <span className="text-[7px] font-black text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200 flex items-center gap-0.5">
                            <RotateCcw className="w-2.5 h-2.5" /> REPEAT
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const origDate = obs.createdDate ? new Date(obs.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                              const images = await fetchObsImages(obs.id, obs.allEvidence, obs.thumbnail);
                              setRepeatObsData({
                                questionId: obs.questionText || '',
                                questionText: obs.questionText || '',
                                sectionTitle: obs.sectionTitle || obs.sop || '',
                                location: obs.area || '',
                                comment: obs.observationText || obs.title || '',
                                images,
                                originalDate: obs.repeatOriginalDate || origDate,
                                repeatTrail: [
                                  ...(obs.repeatTrail || []),
                                  ...(obs.repeatOriginalDate ? [] : [{ date: origDate, comment: obs.observationText || obs.title || '' }]),
                                ],
                                sourceEntryId: obs.id,
                                checklistName: obs.checklistName || '',
                                selectedAnswer: undefined,
                                selectedAnswerIndex: null,
                              });
                            }}
                            className="p-1 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Mark as Repeat"
                          >
                            <Repeat2 className="w-3 h-3 text-orange-500" />
                          </button>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${statusBg}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${obs.status === 'OPEN' ? 'bg-rose-500 animate-pulse' : obs.status === 'RESOLVED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-[8px] font-black uppercase tracking-wider">{obs.status}</span>
                          </div>
                        </div>
                      </div>
                      {obs.isRepeat && obs.repeatTrail && obs.repeatTrail.length > 0 && (
                        <div className="mb-2 bg-orange-50 rounded-lg border border-orange-100 p-2">
                          <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1"><RotateCcw className="w-2.5 h-2.5" /> Repeat Trail · Since {obs.repeatOriginalDate}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {obs.repeatTrail.map((t, ti) => (
                              <span key={ti} className="text-[8px] font-bold text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-md">{t.date}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {obs.questionText && <p className="text-[9px] text-slate-400 font-semibold mb-0.5 truncate">Q: {obs.questionText}</p>}
                      <h3 className="text-slate-800 text-xs sm:text-sm font-extrabold tracking-tight leading-snug mb-1.5">{obs.observationText || obs.title}</h3>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400 font-semibold mb-2 flex-wrap">
                        {obs.sop && (
                          <span className="flex items-center gap-1 truncate">
                            <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                            {obs.isAuditSourced ? (
                              <span className="truncate">
                                {obs.sectionTitle || obs.sop}
                                {obs.checklistName && obs.sectionTitle && obs.checklistName !== obs.sectionTitle ? <span className="opacity-60 ml-0.5">({obs.checklistName})</span> : null}
                              </span>
                            ) : obs.sop}
                          </span>
                        )}
                        {obs.area && (
                          <>
                            <span className="text-slate-200">|</span>
                            <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {obs.area}</span>
                          </>
                        )}
                        {obs.unitName && (
                          <>
                            <span className="text-slate-200">|</span>
                            <span className="flex items-center gap-1 truncate"><Building2 className="w-3 h-3 text-blue-400 shrink-0" /> {obs.unitName}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {obs.people && obs.people.slice(0, 3).map((p, i) => (
                          <span key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50/80 text-indigo-600 rounded-md text-[8px] font-bold uppercase">
                            <User className="w-2.5 h-2.5" /> {p.name}
                          </span>
                        ))}
                        {obs.people && obs.people.length > 3 && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-md text-[8px] font-bold">+{obs.people.length - 3}</span>}
                      </div>
                      {obs.observationText && obs.observationText !== obs.title && (
                        <div className="flex items-start gap-1.5 mb-2">
                          <MessageSquare className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed line-clamp-3">{obs.observationText}</p>
                        </div>
                      )}
                      {obs.closureComments && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 mb-2">
                          <p className="text-[8.5px] text-slate-500 leading-relaxed line-clamp-2">{obs.closureComments}</p>
                        </div>
                      )}
                      {(obs.thumbnail || (obs.allEvidence && obs.allEvidence.length > 0)) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
                          {obs.thumbnail && (
                            <button onClick={() => setObsImagePreview(obs.thumbnail)} className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors flex-shrink-0">
                              <img src={obs.thumbnail} alt="" className="w-full h-full object-cover" />
                            </button>
                          )}
                          {obs.afterImage && (
                            <button onClick={() => setObsImagePreview(obs.afterImage!)} className="w-40 h-40 sm:w-48 sm:h-48 rounded-lg overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors flex-shrink-0 relative">
                              <img src={obs.afterImage} alt="" className="w-full h-full object-cover" />
                              <span className="absolute bottom-0.5 left-0.5 text-[7px] font-black bg-emerald-600 text-white px-1 rounded">AFTER</span>
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[8px] text-slate-400 flex-wrap">
                        {obs.createdDate && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {new Date(obs.createdDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        {obs.duration && <span>· {obs.duration}</span>}
                        {obs.reportedBy && <span className="ml-auto flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {obs.reportedBy}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {(['management-focus', 'easy-impactful', 'ongoing'] as const).map(tag => {
                          const cfg = tag === 'management-focus' ? { label: '🔴 Mgmt Focus', active: 'bg-rose-600 text-white border-rose-600', inactive: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' } : tag === 'easy-impactful' ? { label: '🟢 Easy Impact', active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' } : { label: '🔵 Ongoing', active: 'bg-blue-600 text-white border-blue-600', inactive: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' };
                          const isActive = obs.managementTag === tag;
                          return <button key={tag} className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${isActive ? cfg.active : cfg.inactive}`}>{cfg.label}</button>;
                        })}
                      </div>
                    </div>
                  );
                })}
                </div>
                </>
                );
              })()}
              </>
              )}
              </>
              ) : obsPanelTab === 'all' ? (
              <>
              {(() => {
                const _allObs = [...liveObservations].filter(obs => {
                  const k = obs.entryId || obs.questionId;
                  if (obsTagFilter === 'all') return true;
                  if (obsTagFilter === 'untagged') return !obsTags[k];
                  return obsTags[k] === obsTagFilter;
                }).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
                if (_allObs.length === 0) return (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">{liveObservations.length === 0 ? 'No observations yet' : 'No items match this filter'}</p>
                    <p className="text-xs text-gray-300 mt-1">{liveObservations.length === 0 ? 'Observations appear here when you save comments on questions' : 'Try a different filter above'}</p>
                  </div>
                );
                return (
                <>
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <span className="text-[9px] font-bold text-slate-400">{_allObs.length} observation{_allObs.length !== 1 ? 's' : ''}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                  {obsMultiSelectMode ? (
                    <>
                      <button
                        onClick={() => {
                          const allIds = new Set(_allObs.map(o => o.entryId).filter(Boolean) as string[]);
                          const allSelected = allIds.size > 0 && [...allIds].every(id => selectedObsEntryIds.has(id));
                          setSelectedObsEntryIds(allSelected ? new Set() : allIds);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold transition-colors"
                      >
                        {(() => {
                          const allIds = _allObs.map(o => o.entryId).filter(Boolean) as string[];
                          const allSelected = allIds.length > 0 && allIds.every(id => selectedObsEntryIds.has(id));
                          return allSelected ? <><CheckSquare className="w-3 h-3" /> Deselect All</> : <><Square className="w-3 h-3" /> Select All</>;
                        })()}
                      </button>
                      {selectedObsEntryIds.size > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${selectedObsEntryIds.size} observation${selectedObsEntryIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
                              handleDeleteSelectedObs(selectedObsEntryIds);
                            }
                          }}
                          disabled={deletingSelectedObs}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-[10px] font-bold transition-colors"
                        >
                          {deletingSelectedObs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Delete {selectedObsEntryIds.size}
                        </button>
                      )}
                      <button
                        onClick={() => { setObsMultiSelectMode(false); setSelectedObsEntryIds(new Set()); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 text-[10px] font-bold transition-colors"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { setObsMultiSelectMode(true); setSelectedObsEntryIds(new Set()); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold transition-colors"
                      title="Select multiple observations"
                    >
                      <CheckSquare className="w-3 h-3" /> Select
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const ExcelJS = (await import('exceljs')).default;
                        const wb = new ExcelJS.Workbook();
                        const fetchImg = async (url: string): Promise<ArrayBuffer | null> => {
                          try { const r = await fetch(url); const b = await r.blob(); return await b.arrayBuffer(); } catch { return null; }
                        };
                        const imgPadding = 30000; const rowH = 90; const imgW = 100; const imgH = 80;
                        const ws = wb.addWorksheet('All Observations');
                        ws.columns = [
                          { header: 'Question', key: 'question', width: 40 },
                          { header: 'Observation', key: 'comment', width: 45 },
                          { header: 'Evidence', key: 'evidence', width: 20 },
                          { header: 'Location', key: 'location', width: 20 },
                          { header: 'Section', key: 'section', width: 25 },
                          { header: 'Risk', key: 'risk', width: 10 },
                          { header: 'Score', key: 'score', width: 12 },
                          { header: 'Response', key: 'response', width: 15 },
                          { header: 'Status', key: 'status', width: 12 },
                          { header: 'Category', key: 'category', width: 15 },
                          { header: 'Checklist', key: 'checklist', width: 25 },
                          { header: 'Date', key: 'date', width: 18 },
                        ];
                        const hr = ws.getRow(1);
                        hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                        hr.alignment = { vertical: 'middle', horizontal: 'center' };
                        hr.height = 28;
                        for (let i = 0; i < _allObs.length; i++) {
                          const obs = _allObs[i];
                          const deducted = obs.marksMax - obs.marksObtained;
                          const row = ws.addRow({
                            question: clTabQuestionTextRemap[obs.questionText] || obs.questionText || '',
                            comment: obs.comment || '',
                            evidence: '',
                            location: obs.location || '',
                            section: `${obs.pageTitle || ''} > ${obs.sectionTitle || ''}`.replace(/^ > | > $/g, ''),
                            risk: obs.risk || '',
                            score: deducted > 0 ? `${obs.marksObtained}/${obs.marksMax} (−${deducted})` : `${obs.marksObtained}/${obs.marksMax}`,
                            response: obs.selectedResponse || '',
                            status: obs.closureStatus || 'Open',
                            category: obs.category || '',
                            checklist: obs.checklistName || '',
                            date: obs.createdAtMs ? new Date(obs.createdAtMs).toLocaleString() : '',
                          });
                          row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
                          const excelRow = row.number - 1;
                          const img = obs.images?.[0];
                          if (img) {
                            const buf = img.startsWith('data:') ? Uint8Array.from(atob(img.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(img);
                            if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 2, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch {} }
                          }
                        }
                        const buf = await wb.xlsx.writeBuffer();
                        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
                        const fname = `All_Observations_${new Date().toISOString().split('T')[0]}.xlsx`;
                        if (isPWA || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                          const w = window.open(url, '_blank');
                          if (!w) { const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
                        } else {
                          const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        }
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                      } catch (e) { console.error('Excel export error:', e); }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition-colors"
                    title="Export All Observations to Excel"
                  >
                    <FileDown className="w-3 h-3" /> Excel
                  </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {_allObs.map((obs, idx) => {
                  const riskColor = obs.risk === 'High' ? 'rose' : obs.risk === 'Medium' ? 'amber' : 'slate';
                  const deducted = obs.marksMax - obs.marksObtained;
                  const isSelected = !!(obs.entryId && selectedObsEntryIds.has(obs.entryId));
                  return (
                    <div
                      key={obs.questionId + '-' + idx}
                      className={`rounded-xl border p-3 sm:p-4 transition-all flex flex-col relative ${
                        obsMultiSelectMode
                          ? isSelected
                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300 cursor-pointer'
                            : 'bg-white border-slate-200 shadow-sm cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30'
                          : obs.closureStatus === 'Closed'
                            ? 'bg-emerald-50/60 border-emerald-200'
                            : 'bg-white border-slate-200 shadow-sm'
                      }`}
                      onClick={() => {
                        if (obsMultiSelectMode && obs.entryId) {
                          setSelectedObsEntryIds(prev => {
                            const next = new Set(prev);
                            next.has(obs.entryId!) ? next.delete(obs.entryId!) : next.add(obs.entryId!);
                            return next;
                          });
                        }
                      }}
                    >
                      {obsMultiSelectMode && (
                        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-indigo-600 drop-shadow-sm" />
                            : <Square className="w-4 h-4 text-slate-300" />}
                        </div>
                      )}
                      <div className={`flex items-start justify-between gap-2 mb-2 ${obsMultiSelectMode ? 'pl-6' : ''}`}>
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug flex-1">{clTabQuestionTextRemap[obs.questionText] || obs.questionText}</p>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {obs.entryId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingObservation({
                                  questionId: obs.questionId,
                                  location: obs.location || '',
                                  commentText: obs.comment || '',
                                  commentImages: obs.images ? [...obs.images] : [],
                                  selectedAnswerIndex: obs.selectedResponseIndex ?? null,
                                  entryId: obs.entryId!,
                                  managementTag: obsTags[obs.entryId!] || undefined,
                                  sop: (() => { const sec = (obs.sectionTitle || '').trim(); if (!sec) return ''; const parts = sec.split(' > '); return parts[0].trim(); })(),
                                  subSop: (() => { const sec = (obs.sectionTitle || '').trim(); if (!sec || !sec.includes(' > ')) return ''; return sec.split(' > ').slice(1).join(' > ').trim(); })(),
                                  responsibility: obs.responsibility && obs.responsibility.length > 0 ? obs.responsibility[0] : '',
                                });
                              }}
                              className="p-1 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Observation"
                            >
                              <Edit3 className="w-3 h-3 text-amber-500" />
                            </button>
                          )}
                          {obs.entryId && deleteObsConfirm?.entryId === obs.entryId ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] text-rose-600 font-bold">Delete?</span>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteObs(obs.questionId, obs.entryId!, (obs as any).savedToDb || false); }} className="p-1 bg-rose-600 hover:bg-rose-700 rounded text-white transition-colors"><Trash2 className="w-2.5 h-2.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteObsConfirm(null); }} className="p-1 bg-slate-200 hover:bg-slate-300 rounded transition-colors"><X className="w-2.5 h-2.5 text-slate-600" /></button>
                            </div>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); if (obs.entryId) setDeleteObsConfirm({ questionId: obs.questionId, entryId: obs.entryId, savedToDb: (obs as any).savedToDb || false }); }} className="p-1 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Observation"><Trash2 className="w-3 h-3 text-rose-400 hover:text-rose-600" /></button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const origDate = obs.createdAtMs ? new Date(obs.createdAtMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                              setRepeatObsData({
                                questionId: obs.questionId,
                                questionText: obs.questionText,
                                sectionTitle: obs.sectionTitle,
                                location: obs.location || '',
                                comment: obs.comment || '',
                                images: obs.images ? [...obs.images] : [],
                                originalDate: obs.repeatOriginalDate || origDate,
                                repeatTrail: [
                                  ...(obs.repeatTrail || []),
                                  ...(obs.repeatOriginalDate ? [] : [{ date: origDate, comment: obs.comment || '' }]),
                                ],
                                sourceEntryId: obs.entryId || obs.questionId,
                                checklistName: obs.checklistName,
                                selectedAnswer: obs.selectedResponse,
                                selectedAnswerIndex: obs.selectedResponseIndex ?? null,
                              });
                            }}
                            className="p-1 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Mark as Repeat"
                          >
                            <Repeat2 className="w-3 h-3 text-orange-500" />
                          </button>
                          {obs.isRepeat && <span className="text-[7px] font-black text-orange-600 bg-orange-100 px-1 py-0.5 rounded border border-orange-200">REPEAT</span>}
                          <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${obs.closureStatus === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                            {obs.closureStatus === 'Closed' ? <><CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />Closed</> : 'Open'}
                          </span>
                        </div>
                      </div>
                      {obs.repeatTrail && obs.repeatTrail.length > 0 && (
                        <div className="mb-2 bg-orange-50 rounded-lg border border-orange-100 p-2">
                          <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Repeat2 size={9} /> Repeat Trail · Since {obs.repeatOriginalDate}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            {obs.repeatTrail.map((t, ti) => (
                              <span key={ti} className="text-[8px] font-bold text-orange-700 bg-white border border-orange-200 px-1.5 py-0.5 rounded-md">{t.date}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        {obs.checklistName && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />{obs.checklistName}
                          </span>
                        )}
                        {obs.location && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{obs.location}
                          </span>
                        )}
                        <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium">{obs.pageTitle} › {obs.sectionTitle}</span>
                        {obs.risk && (
                          <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${riskColor === 'rose' ? 'bg-rose-100 text-rose-600' : riskColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{obs.risk}</span>
                        )}
                        {obs.category && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{obs.category}</span>
                        )}
                        {deducted > 0 && (
                          <span className="text-[8px] sm:text-[9px] font-bold text-rose-500">−{deducted} pts</span>
                        )}
                        {obs.selectedResponse && (
                          <span className="text-[8px] sm:text-[9px] text-slate-500 font-medium">Ans: {obs.selectedResponse}</span>
                        )}
                      </div>
                      {auditUnitName && (
                        <div className="flex items-center gap-1 flex-wrap mb-2">
                          <Building2 className="w-3 h-3 text-blue-500 flex-shrink-0" />
                          <span className="text-[8px] sm:text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">{auditUnitName}</span>
                        </div>
                      )}
                      {obs.comment && (
                        <div className="flex items-start gap-1.5 mb-2">
                          <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-slate-600 leading-relaxed">{obs.comment}</p>
                        </div>
                      )}
                      {obs.images && obs.images.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-auto pt-1">
                          {obs.images.map((img, imgIdx) => (
                            <button key={imgIdx} onClick={() => setObsImagePreview(img)} className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors flex-shrink-0">
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const obsKey = obs.entryId || obs.questionId;
                        const currentTag = obsTags[obsKey];
                        return (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, color]) => (
                              <button key={tag} onClick={() => toggleObsTag(obsKey, tag)}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all border ${currentTag === tag ? (color === 'rose' ? 'bg-rose-600 text-white border-rose-600' : color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100')}`}>
                                {emoji} {label}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                </div>
                </>
                );
              })()}
              </>
              ) : obsPanelTab === 'drafts' ? (
              <>
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {panelLiveDrafts.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox"
                        checked={selectedDraftIds.size === panelLiveDrafts.length && panelLiveDrafts.length > 0}
                        onChange={e => setSelectedDraftIds(e.target.checked ? new Set(panelLiveDrafts.map(d => d.id)) : new Set())}
                        className="w-3.5 h-3.5 accent-amber-500 rounded" />
                      <span className="text-[10px] text-slate-400">Select all</span>
                    </label>
                  )}
                  {selectedDraftIds.size > 0 && (
                    <button
                      onClick={async () => {
                        const toDelete = panelLiveDrafts.filter(d => selectedDraftIds.has(d.id));
                        const updated = panelLiveDrafts.filter(d => !selectedDraftIds.has(d.id));
                        setPanelLiveDrafts(updated);
                        const metaOnly = updated.map(d => ({ ...d, commentImages: [] as string[] }));
                        writeScopedLocalDrafts(metaOnly);
                        setSelectedDraftIds(new Set());
                        try {
                          const { clearDraftImages } = await import('@/utils/draftImageStore');
                          await Promise.all(toDelete.map(d => clearDraftImages(d.id)));
                        } catch {}
                        await deleteDraftFromDb(toDelete.map(d => d.id));
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-bold transition-colors">
                      <Trash2 className="w-2.5 h-2.5" /> Delete {selectedDraftIds.size}
                    </button>
                  )}
                  {selectedDraftIds.size === 0 && <p className="text-[10px] text-slate-400">{panelLiveDrafts.filter(d => d.isOfflineQueued).length > 0 ? `${panelLiveDrafts.filter(d => d.isOfflineQueued).length} queued offline` : 'Complete missing fields to submit'}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {draftBulkUploading && <span className="text-[9px] text-amber-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Compressing…</span>}
                  <button
                    onClick={() => syncDraftsAndImages(true)}
                    disabled={forceSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[10px] font-bold transition-colors disabled:opacity-50">
                    {forceSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {forceSyncing ? 'Syncing...' : 'Force Sync'}
                  </button>
                  <button
                    onClick={() => draftBulkInputRef.current?.click()}
                    disabled={draftBulkUploading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold transition-colors disabled:opacity-50">
                    <UploadCloud className="w-3 h-3" /> Bulk Upload
                  </button>
                  <input ref={draftBulkInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => e.target.files && handleDraftBulkUpload(e.target.files)} />
                </div>
              </div>
              {(() => {
                const _drafts = [...panelLiveDrafts].filter(d => {
                  const k = 'DFT_' + d.id;
                  if (obsTagFilter === 'all') return true;
                  if (obsTagFilter === 'untagged') return !obsTags[k];
                  return obsTags[k] === obsTagFilter;
                }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                if (_drafts.length === 0) return (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-400">{panelLiveDrafts.length === 0 ? 'No draft observations' : 'No items match this filter'}</p>
                    <p className="text-xs text-gray-300 mt-1">{panelLiveDrafts.length === 0 ? 'Drafts appear here when you add a note or photo without selecting a location or question' : 'Try a different filter above'}</p>
                  </div>
                );
                return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {_drafts.map((draft) => {
                    const isSelected = selectedDraftIds.has(draft.id);
                    const draftDate = draft.createdAt ? new Date(draft.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                    <div key={draft.id} className={`rounded-xl border p-3 sm:p-4 flex flex-col gap-2 transition-all ${isSelected ? 'border-amber-400 bg-amber-100/60 ring-1 ring-amber-300' : draft.isOfflineQueued ? 'border-sky-200 bg-sky-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <input type="checkbox" checked={isSelected}
                            onChange={e => setSelectedDraftIds(prev => { const n = new Set(prev); e.target.checked ? n.add(draft.id) : n.delete(draft.id); return n; })}
                            className="w-3.5 h-3.5 mt-0.5 accent-amber-500 rounded shrink-0 cursor-pointer" />
                          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            {draft.isOfflineQueued && <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-sky-300 bg-sky-100 text-sky-700 shrink-0 flex items-center gap-0.5"><WifiOff className="w-2.5 h-2.5" /> Offline Queued</span>}
                            {syncingDraftIds.has(draft.id) ? (
                              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 border border-purple-300 bg-purple-100 text-purple-700" title="Images uploading to database...">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Syncing Images...
                              </span>
                            ) : syncedImageDraftIds.has(draft.id) ? (
                              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 border border-emerald-300 bg-emerald-100 text-emerald-700" title="Images saved to database. Draft stays here until you fill location & question.">
                                <UploadCloud className="w-2.5 h-2.5" /> Images Synced
                              </span>
                            ) : (
                              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 border border-slate-300 bg-slate-100 text-slate-700" title="Stored locally in your device. Images will upload to database when internet is available.">
                                <HardDrive className="w-2.5 h-2.5" /> Local
                              </span>
                            )}
                            {!draft.location && <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-amber-300 bg-amber-100 text-amber-700 shrink-0">No Location</span>}
                            {!draft.questionId && <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border border-orange-300 bg-orange-50 text-orange-600 shrink-0">No Question</span>}
                            {draft.location && <span className="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 truncate max-w-[140px]"><MapPin className="w-2.5 h-2.5 shrink-0" />{draft.location}</span>}
                            {draft.questionText && <span className="text-[8px] sm:text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md truncate max-w-[180px]">{draft.questionText}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingDraftData({ id: draft.id, commentText: draft.commentText, commentImages: draft.commentImages, location: draft.location, questionId: draft.questionId, questionText: draft.questionText, sectionTitle: draft.sectionTitle });
                            }}
                            className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors" title="Edit draft">
                            <Pencil className="w-3.5 h-3.5 text-amber-500" />
                          </button>
                          <button
                            onClick={async () => {
                              const updated = panelLiveDrafts.filter(d => d.id !== draft.id);
                              setPanelLiveDrafts(updated);
                              setSelectedDraftIds(prev => { const n = new Set(prev); n.delete(draft.id); return n; });
                              const metaOnly = updated.map(d => ({ ...d, commentImages: [] as string[] }));
                              writeScopedLocalDrafts(metaOnly);
                              try { const { clearDraftImages } = await import('@/utils/draftImageStore'); await clearDraftImages(draft.id); } catch {}
                              await deleteDraftFromDb([draft.id]);
                            }}
                            className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors" title="Delete draft">
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        </div>
                      </div>
                      {draftDate && <p className="text-[8px] text-slate-400 ml-5 -mt-1"><Clock className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />{draftDate}</p>}
                      {draft.commentText && (
                        <div className="flex items-start gap-1.5 ml-5">
                          <MessageSquare className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-[11px] sm:text-xs text-slate-600 italic">"{draft.commentText}"</p>
                        </div>
                      )}
                      {draft.commentImages && draft.commentImages.length > 0 && (
                        <div className="flex gap-2 flex-wrap ml-5">
                          {draft.commentImages.map((img, i) => (
                            <div key={i} className="relative">
                              <img src={img} alt="" className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setObsImagePreview(img)} />
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border border-white bg-slate-400 text-white" title="Local draft image (not synced)">
                                <HardDrive size={9} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!draft.isOfflineQueued && <p className="text-[9px] text-amber-600 ml-5">Tap the pencil icon to complete missing fields and submit</p>}
                      {draft.isOfflineQueued && <p className="text-[9px] text-sky-600 ml-5">Will auto-submit when connection is restored</p>}
                      {(() => {
                        const draftKey = 'DFT_' + draft.id;
                        const currentTag = obsTags[draftKey];
                        return (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-amber-100 flex-wrap ml-5">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, color]) => (
                              <button key={tag} onClick={() => toggleObsTag(draftKey, tag)}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold transition-all border ${currentTag === tag ? (color === 'rose' ? 'bg-rose-600 text-white border-rose-600' : color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' : color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100')}`}>
                                {emoji} {label}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })}
                </div>
                );
              })()}
              </>
              ) : obsPanelTab === 'untagged' ? (
              (() => {
                const untaggedObs = liveObservations.filter(o => !obsTags[o.entryId || o.questionId]);
                const untaggedDrafts = panelLiveDrafts.filter(d => !obsTags['DFT_' + d.id]);
                const total = untaggedObs.length + untaggedDrafts.length;
                if (total === 0) return (
                  <div className="text-center py-12">
                    <span className="text-5xl">⬜</span>
                    <p className="text-sm font-semibold text-gray-400 mt-4">All items are tagged</p>
                    <p className="text-xs text-gray-300 mt-1">Great job! Every observation and draft has been categorized.</p>
                  </div>
                );
                return (
                  <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⬜</span>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-600">Untagged</h4>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">{total} item{total !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[...untaggedObs].sort((a,b) => (b.createdAtMs||0) - (a.createdAtMs||0)).map(obs => {
                      const obsKey = obs.entryId || obs.questionId;
                      const riskColor = obs.risk === 'High' ? 'rose' : obs.risk === 'Medium' ? 'amber' : 'slate';
                      const deducted = (obs.marksMax || 0) - (obs.marksObtained || 0);
                      return (
                        <div key={obs.entryId || obs.questionId} className={`rounded-xl border p-3 flex flex-col ${obs.closureStatus === 'Closed' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-slate-800 leading-snug flex-1">{clTabQuestionTextRemap[obs.questionText] || obs.questionText || obs.title || '—'}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${obs.closureStatus === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{obs.closureStatus === 'Closed' ? 'Closed' : 'Open'}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mb-1.5">
                            {obs.location && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><MapPin className="w-2 h-2"/>{obs.location}</span>}
                            {obs.risk && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${riskColor === 'rose' ? 'bg-rose-100 text-rose-600' : riskColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{obs.risk}</span>}
                            {deducted > 0 && <span className="text-[8px] font-bold text-rose-500">−{deducted} pts</span>}
                            <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">⬜ Untagged</span>
                          </div>
                          {obs.comment && <p className="text-[10px] text-slate-600 italic mb-1.5 line-clamp-2">"{obs.comment}"</p>}
                          {obs.images && obs.images.length > 0 && <button onClick={()=>setObsImagePreview(obs.images[0])} className="w-40 h-40 rounded-lg overflow-hidden border border-gray-200 mt-auto"><img src={obs.images[0]} alt="" className="w-full h-full object-cover"/></button>}
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, c]) => (
                              <button key={tag} onClick={() => toggleObsTag(obsKey, tag)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold transition-all border ${obsTags[obsKey] === tag ? (c === 'rose' ? 'bg-rose-600 text-white border-rose-600' : c === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (c === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200' : c === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200')}`}>{emoji} {label}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {[...untaggedDrafts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(draft => {
                      const draftKey = 'DFT_' + draft.id;
                      return (
                        <div key={draft.id+'-ut'} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-slate-800 leading-snug flex-1">{draft.questionText || '—'}</p>
                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700">Draft</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mb-1.5">
                            {draft.location && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><MapPin className="w-2 h-2"/>{draft.location}</span>}
                            <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">⬜ Untagged</span>
                          </div>
                          {draft.commentText && <p className="text-[10px] text-slate-600 italic mb-1.5 line-clamp-2">"{draft.commentText}"</p>}
                          {draft.commentImages && draft.commentImages.length > 0 && <button onClick={()=>setObsImagePreview(draft.commentImages[0])} className="w-40 h-40 rounded-lg overflow-hidden border border-amber-200 mt-auto"><img src={draft.commentImages[0]} alt="" className="w-full h-full object-cover"/></button>}
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-amber-100 flex-wrap">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, c]) => (
                              <button key={tag} onClick={() => toggleObsTag(draftKey, tag)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold transition-all border ${obsTags[draftKey] === tag ? (c === 'rose' ? 'bg-rose-600 text-white border-rose-600' : c === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (c === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200' : c === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200')}`}>{emoji} {label}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                );
              })()
              ) : obsPanelTab === 'management-focus' || obsPanelTab === 'easy-impactful' || obsPanelTab === 'ongoing' ? (
              (() => {
                const tagLabel = obsPanelTab === 'management-focus' ? 'Management Focus' : obsPanelTab === 'easy-impactful' ? 'Easy but Impactful' : 'Ongoing';
                const tagEmoji = obsPanelTab === 'management-focus' ? '🔴' : obsPanelTab === 'easy-impactful' ? '🟢' : '🔵';
                const tagColor = obsPanelTab === 'management-focus' ? 'rose' : obsPanelTab === 'easy-impactful' ? 'emerald' : 'blue';
                const taggedObsAll = liveObservations.filter(o => obsTags[o.entryId || o.questionId] === obsPanelTab);
                const taggedObs = obsPanelTab === 'management-focus' && mgmtFocusResourceFilter
                  ? taggedObsAll.filter(o => (o as any).resourceRequired)
                  : taggedObsAll;
                const taggedDrafts = panelLiveDrafts.filter(d => obsTags['DFT_' + d.id] === obsPanelTab);
                const total = taggedObs.length + taggedDrafts.length;
                if (total === 0) return (
                  <div className="text-center py-12">
                    <span className="text-5xl">{tagEmoji}</span>
                    <p className="text-sm font-semibold text-gray-400 mt-4">No {tagLabel} items yet</p>
                    <p className="text-xs text-gray-300 mt-1">Flag observations using the tag buttons on each observation card</p>
                  </div>
                );
                const colorClasses = {
                  rose: { badge: 'bg-rose-100 text-rose-700 border-rose-200', header: 'text-rose-700' },
                  emerald: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', header: 'text-emerald-700' },
                  blue: { badge: 'bg-blue-100 text-blue-700 border-blue-200', header: 'text-blue-700' },
                }[tagColor];
                return (
                  <>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-lg">{tagEmoji}</span>
                    <h4 className={`text-xs font-black uppercase tracking-widest ${colorClasses.header}`}>{tagLabel}</h4>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClasses.badge}`}>{total} item{total !== 1 ? 's' : ''}</span>
                    {obsPanelTab === 'management-focus' && (
                      <button
                        onClick={() => setMgmtFocusResourceFilter(v => !v)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border transition-all ${mgmtFocusResourceFilter ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'}`}
                        title="Filter: Resource Required only"
                      >
                        🔧 Resource Required {mgmtFocusResourceFilter ? `(${taggedObs.length})` : `(${taggedObsAll.filter(o => (o as any).resourceRequired).length})`}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const ExcelJS = (await import('exceljs')).default;
                          const wb = new ExcelJS.Workbook();
                          const fetchImg = async (url: string): Promise<ArrayBuffer | null> => {
                            try { const r = await fetch(url); const b = await r.blob(); return await b.arrayBuffer(); } catch { return null; }
                          };
                          const imgPadding = 30000; const rowH = 90; const imgW = 100; const imgH = 80;
                          const ws = wb.addWorksheet(tagLabel.slice(0, 31));
                          ws.columns = [
                            { header: 'Type', key: 'type', width: 10 },
                            { header: 'Question', key: 'question', width: 40 },
                            { header: 'Observation', key: 'comment', width: 45 },
                            { header: 'Evidence', key: 'evidence', width: 20 },
                            { header: 'Location', key: 'location', width: 20 },
                            { header: 'Section', key: 'section', width: 25 },
                            { header: 'Risk', key: 'risk', width: 10 },
                            { header: 'Status', key: 'status', width: 12 },
                            { header: 'Date', key: 'date', width: 18 },
                          ];
                          const hr = ws.getRow(1);
                          hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                          hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                          hr.alignment = { vertical: 'middle', horizontal: 'center' };
                          hr.height = 28;
                          const sortedObs = [...taggedObs].sort((a,b) => (b.createdAtMs||0) - (a.createdAtMs||0));
                          for (let i = 0; i < sortedObs.length; i++) {
                            const obs = sortedObs[i];
                            const row = ws.addRow({ type: 'Observation', question: clTabQuestionTextRemap[obs.questionText] || obs.questionText || '', comment: obs.comment || '', evidence: '', location: obs.location || '', section: obs.sectionTitle || '', risk: obs.risk || '', status: obs.closureStatus || 'Open', date: obs.createdAtMs ? new Date(obs.createdAtMs).toLocaleString() : '' });
                            row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
                            const excelRow = row.number - 1;
                            const img = obs.images?.[0];
                            if (img) {
                              const buf = img.startsWith('data:') ? Uint8Array.from(atob(img.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(img);
                              if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 3, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch(e) {} }
                            }
                          }
                          const sortedDrafts = [...taggedDrafts].sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
                          for (let i = 0; i < sortedDrafts.length; i++) {
                            const d = sortedDrafts[i];
                            const row = ws.addRow({ type: 'Draft', question: d.questionText || '', comment: d.commentText || '', evidence: '', location: d.location || '', section: d.sectionTitle || '', risk: '', status: 'Draft', date: d.createdAt ? new Date(d.createdAt).toLocaleString() : '' });
                            row.height = rowH; row.alignment = { vertical: 'middle', wrapText: true };
                            const excelRow = row.number - 1;
                            const img = d.commentImages?.[0];
                            if (img) {
                              const buf = img.startsWith('data:') ? Uint8Array.from(atob(img.split(',')[1]), c => c.charCodeAt(0)).buffer : await fetchImg(img);
                              if (buf) { try { const imgId = wb.addImage({ buffer: buf, extension: 'jpeg' }); ws.addImage(imgId, { tl: { nativeCol: 3, nativeColOff: imgPadding, nativeRow: excelRow, nativeRowOff: imgPadding } as any, ext: { width: imgW, height: imgH }, editAs: 'oneCell' }); } catch(e) {} }
                            }
                          }
                          const buf = await wb.xlsx.writeBuffer();
                          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                          const url = URL.createObjectURL(blob);
                          const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
                          const fname = `${tagLabel.replace(/\s+/g,'_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
                          if (isPWA || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                            const w = window.open(url, '_blank');
                            if (!w) { const a = document.createElement('a'); a.href = url; a.download = fname; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000); }
                            else { setTimeout(() => URL.revokeObjectURL(url), 5000); }
                          } else {
                            const a = document.createElement('a'); a.href = url; a.download = fname; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
                          }
                        } catch (err) { console.error('Category Excel export failed', err); }
                      }}
                      className="ml-auto p-1.5 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 active:scale-95 transition-all"
                      title={`Export ${tagLabel} to Excel`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[...taggedObs].sort((a,b)=>(b.createdAtMs||0)-(a.createdAtMs||0)).map((obs, idx) => {
                      const riskColor = obs.risk === 'High' ? 'rose' : obs.risk === 'Medium' ? 'amber' : 'slate';
                      const deducted = obs.marksMax - obs.marksObtained;
                      const obsKey = obs.entryId || obs.questionId;
                      return (
                        <div key={obs.questionId+'-tag-'+idx} className={`rounded-xl border p-3 flex flex-col ${obs.closureStatus === 'Closed' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-xs font-semibold text-slate-800 leading-snug flex-1">{clTabQuestionTextRemap[obs.questionText] || obs.questionText}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${obs.closureStatus === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{obs.closureStatus === 'Closed' ? 'Closed' : 'Open'}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap mb-1.5">
                            {obs.location && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><MapPin className="w-2 h-2"/>{obs.location}</span>}
                            {obs.risk && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${riskColor === 'rose' ? 'bg-rose-100 text-rose-600' : riskColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{obs.risk}</span>}
                            {deducted > 0 && <span className="text-[8px] font-bold text-rose-500">−{deducted} pts</span>}
                            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded border ${colorClasses.badge}`}>{tagEmoji} {tagLabel}</span>
                          </div>
                          {(obs as any).resourceRequired && (
                            <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md mb-1.5">🔧 Resource Required</span>
                          )}
                          {obs.comment && <p className="text-[10px] text-slate-600 italic mb-1.5 line-clamp-2">"{obs.comment}"</p>}
                          {obs.images && obs.images.length > 0 && <button onClick={()=>setObsImagePreview(obs.images[0])} className="w-40 h-40 rounded-lg overflow-hidden border border-gray-200 mt-auto"><img src={obs.images[0]} alt="" className="w-full h-full object-cover"/></button>}
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, c]) => (
                              <button key={tag} onClick={() => toggleObsTag(obsKey, tag)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold transition-all border ${obsTags[obsKey] === tag ? (c === 'rose' ? 'bg-rose-600 text-white border-rose-600' : c === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (c === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200' : c === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200')}`}>{emoji} {label}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {[...taggedDrafts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(draft => {
                      const draftKey = 'DFT_' + draft.id;
                      return (
                        <div key={draft.id+'-tag'} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                              <span className={`text-[8px] font-black uppercase px-1 py-0.5 rounded border ${colorClasses.badge}`}>{tagEmoji} {tagLabel}</span>
                              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300">Draft</span>
                              {draft.location && <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 truncate max-w-[120px]"><MapPin className="w-2 h-2 shrink-0"/>{draft.location}</span>}
                              {draft.questionText && <span className="text-[8px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md truncate max-w-[160px]">{draft.questionText}</span>}
                            </div>
                          </div>
                          {draft.commentText && <p className="text-[10px] text-slate-600 italic line-clamp-2">"{draft.commentText}"</p>}
                          {draft.commentImages && draft.commentImages.length > 0 && <button onClick={()=>setObsImagePreview(draft.commentImages[0])} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200"><img src={draft.commentImages[0]} alt="" className="w-full h-full object-cover"/></button>}
                          <div className="flex items-center gap-1 mt-1 pt-2 border-t border-amber-100 flex-wrap">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mr-0.5">Flag:</span>
                            {([['management-focus','🔴','Mgmt Focus','rose'], ['easy-impactful','🟢','Easy Impact','emerald'], ['ongoing','🔵','Ongoing','blue']] as const).map(([tag, emoji, label, c]) => (
                              <button key={tag} onClick={() => toggleObsTag(draftKey, tag)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold transition-all border ${obsTags[draftKey] === tag ? (c === 'rose' ? 'bg-rose-600 text-white border-rose-600' : c === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-blue-600 text-white border-blue-600') : (c === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-200' : c === 'emerald' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200')}`}>{emoji} {label}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                );
              })()
              ) : (
              <>
              {topConcernsByScope.length === 0 && hotelTopConcerns.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">No concerns yet</p>
                  <p className="text-xs text-gray-300 mt-1">Top concerns appear here once observations are recorded</p>
                </div>
              ) : (
                <>
                <div className="flex items-center justify-end mb-1">
                  <button onClick={async () => {
                    try {
                      const ExcelJS = (await import('exceljs')).default;
                      const wb = new ExcelJS.Workbook();
                      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E293B' } };
                      const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                      const rankColors = ['FFEF4444', 'FFF97316', 'FFF59E0B', 'FF94A3B8', 'FF94A3B8'];
                      const usedNames = new Set<string>();
                      const safeName = (raw: string) => {
                        let s = raw.replace(/[:\\/?*\[\]]/g, '-').replace(/\s+/g, ' ').trim() || 'Sheet';
                        s = s.substring(0, 31);
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
                      const addSheet = (name: string, concerns: typeof hotelTopConcerns, subtitle?: string) => {
                        const ws = wb.addWorksheet(safeName(name));
                        if (subtitle) { const titleRow = ws.addRow([subtitle]); titleRow.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } }; ws.mergeCells(ws.rowCount, 1, ws.rowCount, 10); ws.addRow([]); }
                        const hdr = ws.addRow(['Rank', 'Question', 'Section', 'Risk', 'Category', 'Observations', 'Responses', 'Department', 'Comments', 'Images']);
                        hdr.eachCell(c => { c.fill = headerFill; c.font = headerFont; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }; });
                        ws.getColumn(1).width = 7; ws.getColumn(2).width = 55; ws.getColumn(3).width = 30; ws.getColumn(4).width = 12; ws.getColumn(5).width = 18; ws.getColumn(6).width = 14; ws.getColumn(7).width = 25; ws.getColumn(8).width = 25; ws.getColumn(9).width = 50; ws.getColumn(10).width = 35;
                        concerns.forEach((c, i) => {
                          const comments = c.details.filter(d => d.comment).map(d => `[${d.dept}${d.location ? ' › ' + d.location : ''}] ${d.comment}`).join('\n');
                          const depts = [...new Set(c.details.map(d => d.dept).filter(Boolean))].join(', ');
                          const allImages = c.details.flatMap(d => d.images || []).filter(Boolean);
                          const row = ws.addRow([i + 1, c.questionText, c.sectionTitle, c.risk || '-', c.category || '-', c.count, c.selectedResponses.join(', ') || '-', depts || '-', comments || '-', allImages.length > 0 ? `${allImages.length} image(s)` : '-']);
                          row.getCell(1).font = { bold: true, size: 12, color: { argb: rankColors[i] || 'FF64748B' } }; row.getCell(1).alignment = { horizontal: 'center' };
                          row.getCell(6).font = { bold: true, size: 12 }; row.getCell(6).alignment = { horizontal: 'center' };
                          row.getCell(9).alignment = { wrapText: true, vertical: 'top' };
                          row.getCell(10).alignment = { vertical: 'top' };
                          const imgLimit = allImages.slice(0, 6);
                          if (imgLimit.length > 0) {
                            const imgW = 80; const imgH = 60; const gap = 4;
                            const rowHeight = Math.ceil(imgLimit.length / 3) * (imgH + gap) + gap;
                            row.height = Math.max(rowHeight * 0.75, 50);
                            imgLimit.forEach((imgSrc, imgIdx) => {
                              const isBase64 = imgSrc.startsWith('data:');
                              if (!isBase64) return;
                              const base64Data = imgSrc.split(',')[1];
                              if (!base64Data) return;
                              const ext: 'png' | 'jpeg' = imgSrc.includes('image/png') ? 'png' : 'jpeg';
                              const imageId = wb.addImage({ base64: base64Data, extension: ext });
                              const colOffset = (imgIdx % 3) * (imgW + gap) + gap;
                              const rowOffset = Math.floor(imgIdx / 3) * (imgH + gap) + gap;
                              ws.addImage(imageId, {
                                tl: { col: 9 + colOffset / (35 * 7.5), row: row.number - 1 + rowOffset / (row.height || 50) },
                                ext: { width: imgW, height: imgH },
                              });
                            });
                          }
                          row.eachCell(c => { c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }; });
                          if (i % 2 === 0) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
                        });
                      };
                      if (hotelTopConcerns.length > 0) addSheet('Hotel - Overall', hotelTopConcerns, `Hotel Top 5 Concerns (${auditUnitName || auditLocationName || 'Unit'})`);
                      responsibilityTopConcerns.forEach(scope => {
                        addSheet(`Resp - ${scope.dept}`, scope.concerns, `Responsibility: ${scope.dept} — Top 5 Common Findings`);
                      });
                      deptTopConcerns.forEach(scope => {
                        addSheet(`Dept - ${scope.dept}`, scope.concerns, `Department: ${scope.dept} — Top 5 Common Findings`);
                      });
                      topConcernsByScope.filter(s => s.location).forEach(scope => {
                        addSheet(`${scope.dept} - ${scope.location}`, scope.concerns, `${scope.dept} › ${scope.location} — Top 5 Common Findings`);
                      });
                      const buf = await wb.xlsx.writeBuffer();
                      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `Common_Findings_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
                    } catch (e) { console.error('Excel export error:', e); }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Download Excel
                  </button>
                </div>
                {(() => {
                  const renderConcernRow = (concern: ConcernItem, ci: number, sectionKey: string) => {
                    const riskColor = concern.risk === 'High' ? 'rose' : concern.risk === 'Medium' ? 'amber' : 'slate';
                    const qKey = `${sectionKey}::${concern.questionId}`;
                    const isExpanded = concernQExpanded[qKey];
                    const detailsWithComments = concern.details.filter(d => d.comment || (d.images && d.images.length > 0));
                    return (
                      <div key={concern.questionId}>
                        <div
                          className="px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2.5 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => detailsWithComments.length > 0 && setConcernQExpanded(prev => ({ ...prev, [qKey]: !prev[qKey] }))}
                        >
                          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0 ${ci === 0 ? 'bg-rose-500 text-white' : ci === 1 ? 'bg-orange-400 text-white' : ci === 2 ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {ci + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug mb-1">{concern.questionText}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8px] sm:text-[9px] text-slate-400 font-medium">{concern.sectionTitle}</span>
                              {concern.risk && <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${riskColor === 'rose' ? 'bg-rose-100 text-rose-600' : riskColor === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{concern.risk}</span>}
                              {concern.category && <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{concern.category}</span>}
                              {concern.selectedResponses.length > 0 && concern.selectedResponses.map((r, ri) => (
                                <span key={ri} className="text-[8px] sm:text-[9px] text-slate-500 font-medium bg-slate-50 px-1 py-0.5 rounded">{r}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="flex flex-col items-center">
                              <span className={`text-base sm:text-lg font-black ${ci === 0 ? 'text-rose-600' : ci === 1 ? 'text-orange-500' : ci === 2 ? 'text-amber-500' : 'text-slate-500'}`}>{concern.count}</span>
                              <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider">obs</span>
                            </div>
                            {detailsWithComments.length > 0 && (
                              isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>
                        {isExpanded && detailsWithComments.length > 0 && (
                          <div className="bg-slate-50 border-t border-slate-100 px-4 sm:px-5 py-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {detailsWithComments.map((d, di) => (
                              <div key={di} className="flex items-start gap-2 py-1.5 px-2 bg-white rounded-lg border border-slate-100">
                                <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] sm:text-xs text-slate-700 leading-snug">{d.comment}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {d.dept && <span className="text-[8px] sm:text-[9px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{d.dept}</span>}
                                    {d.location && <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{d.location}</span>}
                                    {d.response && <span className="text-[8px] sm:text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{d.response}</span>}
                                  </div>
                                  {d.images && d.images.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1.5">
                                      {d.images.map((img, imgI) => (
                                        <button key={imgI} onClick={() => setObsImagePreview(img)} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-violet-400 transition-colors flex-shrink-0">
                                          <img src={img} alt="" className="w-full h-full object-cover" />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };
                  const toggleSection = (key: string) => setConcernSectionOpen(prev => ({ ...prev, [key]: !prev[key] }));
                  return (
                    <>
                    {hotelTopConcerns.length > 0 && (
                      <div className="rounded-xl border border-indigo-300 shadow-md overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-indigo-700 to-violet-700 px-3.5 sm:px-4 py-3 flex items-center gap-2 flex-wrap cursor-pointer select-none"
                          onClick={() => toggleSection('hotel')}
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center"><Building2 className="w-3.5 h-3.5 text-white" /></div>
                          <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">{auditUnitName || auditLocationName || 'Hotel'} — Overall Top 5</span>
                          <span className="ml-auto text-[9px] sm:text-[10px] text-indigo-200 font-semibold mr-1">{hotelTopConcerns.reduce((s, c) => s + c.count, 0)} concerns</span>
                          {concernSectionOpen.hotel ? <ChevronUp className="w-4 h-4 text-indigo-200" /> : <ChevronDown className="w-4 h-4 text-indigo-200" />}
                        </div>
                        {concernSectionOpen.hotel && (
                          <div className="divide-y divide-indigo-50">
                            {hotelTopConcerns.map((concern, ci) => renderConcernRow(concern, ci, 'hotel'))}
                          </div>
                        )}
                      </div>
                    )}
                    {responsibilityTopConcerns.length > 0 && (
                      <div className="rounded-xl border border-teal-300 shadow-md overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-teal-600 to-teal-700 px-3.5 sm:px-4 py-3 flex items-center gap-2 flex-wrap cursor-pointer select-none"
                          onClick={() => toggleSection('responsibility')}
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-white" /></div>
                          <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Common Findings by Responsibility</span>
                          <span className="ml-auto text-[9px] sm:text-[10px] text-teal-200 font-semibold mr-1">{responsibilityTopConcerns.reduce((s, sc) => s + sc.concerns.reduce((ss, c) => ss + c.count, 0), 0)} obs</span>
                          {concernSectionOpen.responsibility ? <ChevronUp className="w-4 h-4 text-teal-200" /> : <ChevronDown className="w-4 h-4 text-teal-200" />}
                        </div>
                        {concernSectionOpen.responsibility && (
                          <div className="bg-white">
                            {responsibilityTopConcerns.map((scope) => {
                              const respKey = `resp-${scope.scopeKey}`;
                              const isRespOpen = concernLocExpanded[respKey] ?? false;
                              return (
                              <div key={respKey} className="border-b border-teal-100 last:border-b-0">
                                <div className="bg-teal-50/50 px-3.5 sm:px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-teal-50 transition-colors"
                                  onClick={() => setConcernLocExpanded(prev => ({ ...prev, [respKey]: !prev[respKey] }))}>
                                  <Users className="w-3 h-3 text-teal-600 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs font-bold text-teal-800 uppercase tracking-wider">{scope.dept}</span>
                                  <span className="ml-auto text-[9px] text-teal-600 font-semibold">{scope.concerns.reduce((s, c) => s + c.count, 0)} obs</span>
                                  {isRespOpen ? <ChevronUp className="w-3.5 h-3.5 text-teal-500" /> : <ChevronDown className="w-3.5 h-3.5 text-teal-500" />}
                                </div>
                                {isRespOpen && (
                                  <div className="divide-y divide-teal-50">
                                    {scope.concerns.map((concern, ci) => renderConcernRow(concern, ci, `resp-${scope.scopeKey}`))}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {deptTopConcerns.length > 0 && (
                      <div className="rounded-xl border border-violet-300 shadow-md overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-violet-700 px-3.5 sm:px-4 py-3 flex items-center gap-2 flex-wrap cursor-pointer select-none"
                          onClick={() => toggleSection('department')}
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center"><Layers className="w-3.5 h-3.5 text-white" /></div>
                          <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Common Findings by Department</span>
                          <span className="ml-auto text-[9px] sm:text-[10px] text-violet-200 font-semibold mr-1">{deptTopConcerns.reduce((s, sc) => s + sc.concerns.reduce((ss, c) => ss + c.count, 0), 0)} obs</span>
                          {concernSectionOpen.department ? <ChevronUp className="w-4 h-4 text-violet-200" /> : <ChevronDown className="w-4 h-4 text-violet-200" />}
                        </div>
                        {concernSectionOpen.department && (
                          <div className="bg-white">
                            {deptTopConcerns.map((scope) => {
                              const deptKey = `dept-${scope.scopeKey}`;
                              const isDeptOpen = concernLocExpanded[deptKey] ?? false;
                              return (
                              <div key={deptKey} className="border-b border-violet-100 last:border-b-0">
                                <div className="bg-violet-50/50 px-3.5 sm:px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-violet-50 transition-colors"
                                  onClick={() => setConcernLocExpanded(prev => ({ ...prev, [deptKey]: !prev[deptKey] }))}>
                                  <Layers className="w-3 h-3 text-violet-600 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs font-bold text-violet-800 uppercase tracking-wider">{scope.dept}</span>
                                  <span className="ml-auto text-[9px] text-violet-600 font-semibold">{scope.concerns.reduce((s, c) => s + c.count, 0)} obs</span>
                                  {isDeptOpen ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />}
                                </div>
                                {isDeptOpen && (
                                  <div className="divide-y divide-violet-50">
                                    {scope.concerns.map((concern, ci) => renderConcernRow(concern, ci, `dept-${scope.scopeKey}`))}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {deptLocationGroups.length > 0 && (
                      <div className="rounded-xl border border-slate-300 shadow-md overflow-hidden mb-3">
                        <div
                          className="bg-gradient-to-r from-slate-700 to-slate-800 px-3.5 sm:px-4 py-3 flex items-center gap-2 flex-wrap cursor-pointer select-none"
                          onClick={() => toggleSection('deptLocation')}
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center"><MapPin className="w-3.5 h-3.5 text-white" /></div>
                          <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Common Findings by Department &amp; Location</span>
                          <span className="ml-auto text-[9px] sm:text-[10px] text-slate-300 font-semibold mr-1">{deptLocationGroups.reduce((s, g) => s + g.totalObs, 0)} obs</span>
                          {concernSectionOpen.deptLocation ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                        </div>
                        {concernSectionOpen.deptLocation && (
                          <div className="bg-white">
                            {deptLocationGroups.map((group) => {
                              const dlgDeptKey = `dlg-dept-${group.dept}`;
                              const isDlgDeptOpen = concernLocExpanded[dlgDeptKey] ?? false;
                              return (
                              <div key={`dlg-${group.dept}`} className="border-b border-slate-200 last:border-b-0">
                                <div className="bg-slate-100 px-3.5 sm:px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-slate-200/60 transition-colors"
                                  onClick={() => setConcernLocExpanded(prev => ({ ...prev, [dlgDeptKey]: !prev[dlgDeptKey] }))}>
                                  <Building2 className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                  <span className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">{group.dept}</span>
                                  <span className="ml-auto text-[9px] text-slate-500 font-semibold">{group.totalObs} obs</span>
                                  {isDlgDeptOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                                </div>
                                {isDlgDeptOpen && (
                                  <>
                                <div className="divide-y divide-slate-50">
                                  {group.deptConcerns.map((concern, ci) => renderConcernRow(concern, ci, `dlg-dept-${group.dept}`))}
                                </div>
                                {group.locations.map((loc) => {
                                  const locKey = `dlg-loc-${group.dept}::${loc.location}`;
                                  const isLocOpen = concernLocExpanded[locKey] ?? false;
                                  return (
                                    <div key={locKey}>
                                      <div
                                        className="bg-emerald-50/60 px-4 sm:px-5 py-2 flex items-center gap-2 cursor-pointer hover:bg-emerald-50 transition-colors border-t border-slate-100"
                                        onClick={() => setConcernLocExpanded(prev => ({ ...prev, [locKey]: !prev[locKey] }))}
                                      >
                                        <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                        <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{loc.location}</span>
                                        <span className="ml-auto text-[8px] sm:text-[9px] text-emerald-600 font-semibold">{loc.concerns.reduce((s, c) => s + c.count, 0)} obs</span>
                                        {isLocOpen ? <ChevronUp className="w-3.5 h-3.5 text-emerald-500" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />}
                                      </div>
                                      {isLocOpen && (
                                        <div className="divide-y divide-emerald-50 bg-white">
                                          {loc.concerns.map((concern, ci) => renderConcernRow(concern, ci, `dlg-${loc.scopeKey}`))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                  </>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    </>
                  );
                })()}
                </>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {obsImagePreview && (
        <div className="fixed inset-0 z-[10003] bg-black/90 flex items-center justify-center p-4" onClick={() => setObsImagePreview(null)}>
          <button onClick={() => setObsImagePreview(null)} className="absolute top-4 right-4 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors z-10">
            <X className="w-6 h-6" />
          </button>
          <img src={obsImagePreview} alt="" className="max-w-[95vw] max-h-[95vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {facilityEvidencePreview && (
        <div className="fixed inset-0 z-[10003] bg-black/90 flex items-center justify-center p-4" onClick={() => setFacilityEvidencePreview(null)}>
          <button onClick={() => setFacilityEvidencePreview(null)} className="absolute top-4 right-4 p-3 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors z-10">
            <X className="w-6 h-6" />
          </button>
          <img src={facilityEvidencePreview} alt="" className="max-w-[95vw] max-h-[95vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {editingObservation && (
        <AddObservationModal
          questions={allQuestionsForEdit}
          locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
          auditLocationName={auditLocationName}
          auditUnitId={auditUnitId}
          auditUnitName={auditUnitName}
          checklistId={template.id}
          departmentLocations={departmentLocations}
          combinedLocations={combinedLocations}
          onClose={() => setEditingObservation(null)}
          onSave={handleEditObservationSave}
          onAnswerSelect={(qId, rIdx, resp) => {
            const effPages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
            const allQs: QuestionNode[] = [];
            effPages.forEach(p => p.sections.forEach(s => {
              allQs.push(...(s.questions || []));
              (s.subSections || []).forEach(ss => allQs.push(...(ss.questions || [])));
            }));
            const q = allQs.find(qq => qq.id === qId);
            if (q) handleAnswerSelect(qId, rIdx, resp, q.text || '', q);
          }}
          currentAnswers={answers}
          editMode={true}
          editData={editingObservation}
        />
      )}

      {repeatObsData && (
        <AddObservationModal
          questions={allQuestionsForEdit}
          locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
          auditLocationName={auditLocationName}
          auditUnitId={auditUnitId}
          auditUnitName={auditUnitName}
          checklistId={template.id}
          departmentLocations={departmentLocations}
          combinedLocations={combinedLocations}
          onClose={() => setRepeatObsData(null)}
          onSave={(observations) => {
            const ts = new Date().toLocaleString();
            const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
            setComments(prev => {
              const next = { ...prev };
              for (const obs of observations) {
                const entryId = `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const matchedQ = allQuestionsForEdit.find(q => q.id === obs.questionId);
                const respIdx = (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null && obs.selectedResponseIndex >= 0)
                  ? obs.selectedResponseIndex
                  : (obs.selectedAnswer && matchedQ ? matchedQ.responses.findIndex(r => r.text === obs.selectedAnswer) : -1);
                const newEntry: CommentEntry = {
                  id: entryId,
                  text: obs.observationText,
                  images: [...obs.allEvidence],
                  closureEvidence: [],
                  closureComments: '',
                  timestamp: ts,
                  createdAtMs: Date.now(),
                  ...(obs.location ? { location: obs.location } : {}),
                  savedToDb: true,
                  isRepeat: true,
                  repeatOriginalDate: obs.repeatOriginalDate,
                  repeatTrail: obs.repeatTrail,
                  repeatSourceId: obs.repeatSourceId,
                  managementTag: obs.managementTag,
                  selectedResponseIndex: respIdx >= 0 ? respIdx : undefined,
                };
                next[obs.questionId] = { entries: [...(next[obs.questionId]?.entries || []), newEntry] };
                if (obs.managementTag) tagUpdates[entryId] = obs.managementTag;
              }
              return next;
            });
            if (Object.keys(tagUpdates).length > 0) {
              setObsTags(prev => ({ ...prev, ...tagUpdates }));
            }
            fullRegistryObsFetchedRef.current = false;
            setRepeatObsData(null);
          }}
          onSaveAsDraft={(draftObs) => {
            const now = Date.now();
            const newDrafts: typeof panelLiveDrafts = draftObs.map((d, i) => ({
              id: `draft-repeat-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
              commentText: d.observationText,
              commentImages: [...(d.images || [])],
              location: d.location || '',
              questionId: d.questionId || '',
              questionText: d.questionText || '',
              sectionTitle: d.sectionTitle || '',
              checklistId: effectiveDraftChecklistId,
              unitId: auditUnitId || undefined,
              createdAt: now,
              isOfflineQueued: false,
              managementTag: d.managementTag,
            }));
            setPanelLiveDrafts(prev => {
              const updated = [...prev, ...newDrafts];
              const metaOnly = updated.map(dd => ({ ...dd, commentImages: [] as string[] }));
              writeScopedLocalDrafts(metaOnly);
              return updated;
            });
            (async () => {
              try {
                const { saveImageToStore, generateImageId } = await import('@/utils/draftImageStore');
                for (const d of newDrafts) {
                  for (const img of d.commentImages) {
                    await saveImageToStore(d.id, generateImageId(d.id), img);
                  }
                }
              } catch {}
            })();
            syncDraftsAndImages();
            setRepeatObsData(null);
          }}
          currentAnswers={answers}
          repeatData={repeatObsData}
          hideSaveAsDraft={false}
        />
      )}

      {editingDraftData && (
        <AddObservationModal
          questions={allQuestionsForEdit}
          locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
          auditLocationName={auditLocationName}
          auditUnitId={auditUnitId}
          auditUnitName={auditUnitName}
          checklistId={template.id}
          lockedLocation={lockedLocation}
          onLockLocation={(loc) => setLockedLocation(loc)}
          onUnlockLocation={() => setLockedLocation(null)}
          departmentLocations={departmentLocations}
          combinedLocations={combinedLocations}
          onClose={() => setEditingDraftData(null)}
          onSave={async (observations) => {
            const ts = new Date().toLocaleString();
            const draftIdToDelete = editingDraftData.id;
            const draftTagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
            const grouped: Record<string, any[]> = {};
            for (const obs of observations) {
              const entryId = `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              const matchedQ = allQuestionsForEdit.find(q => q.id === obs.questionId);
              const respIdx = (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null && obs.selectedResponseIndex >= 0)
                ? obs.selectedResponseIndex
                : (obs.selectedAnswer && matchedQ ? matchedQ.responses.findIndex(r => r.text === obs.selectedAnswer) : -1);
              const newEntry = {
                id: entryId,
                text: obs.observationText,
                images: [...obs.allEvidence],
                closureEvidence: [] as string[],
                closureComments: '',
                timestamp: ts,
                createdAtMs: Date.now(),
                ...(obs.location ? { location: obs.location } : {}),
                savedToDb: true,
                managementTag: obs.managementTag,
                selectedResponseIndex: respIdx >= 0 ? respIdx : undefined,
              };
              if (!grouped[obs.questionId]) grouped[obs.questionId] = [];
              grouped[obs.questionId].push(newEntry);
              if (obs.managementTag) draftTagUpdates[entryId] = obs.managementTag;
            }
            setComments(prev => {
              const next = { ...prev };
              for (const [qId, newEntries] of Object.entries(grouped)) {
                next[qId] = { entries: [...(next[qId]?.entries || []), ...newEntries] };
              }
              return next;
            });
            const updated = panelLiveDrafts.filter(d => d.id !== draftIdToDelete);
            if (Object.keys(draftTagUpdates).length > 0) {
              setObsTags(prev => ({ ...prev, ...draftTagUpdates }));
            }
            setPanelLiveDrafts(updated);
            const metaOnlyRemaining = updated.map(d => ({ ...d, commentImages: [] as string[] }));
            writeScopedLocalDrafts(metaOnlyRemaining);
            try { const { clearDraftImages } = await import('@/utils/draftImageStore'); await clearDraftImages(draftIdToDelete); } catch {}
            await deleteDraftFromDb([draftIdToDelete]);
            fullRegistryObsFetchedRef.current = false;
            setFullRegistryRefreshKey(prev => prev + 1);
            setEditingDraftData(null);
          }}
          onSaveAsDraft={async (draftObservations) => {
            const draftObs = draftObservations[0];
            const updated = panelLiveDrafts.map(d => {
              if (d.id !== editingDraftData.id) return d;
              if (!draftObs) return d;
              return {
                ...d,
                commentText: draftObs.observationText,
                commentImages: draftObs.images,
                location: draftObs.location || d.location,
                questionId: draftObs.questionId || d.questionId,
                questionText: draftObs.questionText || d.questionText,
                sectionTitle: draftObs.sectionTitle || d.sectionTitle,
                managementTag: draftObs.managementTag || d.managementTag,
              };
            });
            if (draftObs?.managementTag) {
              setObsTags(prev => ({ ...prev, ['DFT_' + editingDraftData.id]: draftObs.managementTag! }));
            }
            setPanelLiveDrafts(updated);
            if (draftObs?.images?.length) {
              try {
                const { saveImageToStore, clearDraftImages, generateImageId } = await import('@/utils/draftImageStore');
                await clearDraftImages(editingDraftData.id);
                try { await fetch('/api/draft-images', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: editingDraftData.id }) }); } catch {}
                for (const img of draftObs.images) {
                  await saveImageToStore(editingDraftData.id, generateImageId(editingDraftData.id), img);
                }
              } catch {}
            }
            const metaOnly = updated.map(d => ({ ...d, commentImages: [] as string[] }));
            writeScopedLocalDrafts(metaOnly);
            const editedDraft = updated.find(d => d.id === editingDraftData.id);
            if (editedDraft) syncDraftToDb([editedDraft]);
            setEditingDraftData(null);
          }}
          currentAnswers={answers}
          editData={{
            questionId: editingDraftData.questionId,
            location: editingDraftData.location,
            commentText: editingDraftData.commentText,
            commentImages: editingDraftData.commentImages,
            selectedAnswerIndex: answers[editingDraftData.questionId]?.selectedIndex ?? null,
            entryId: '',
            managementTag: editingDraftData.managementTag,
            sop: (() => { const sec = (editingDraftData.sectionTitle || '').trim(); if (!sec) return ''; return sec.split(' > ')[0].trim(); })(),
            subSop: (() => { const sec = (editingDraftData.sectionTitle || '').trim(); if (!sec || !sec.includes(' > ')) return ''; return sec.split(' > ').slice(1).join(' > ').trim(); })(),
          }}
        />
      )}

      {moveTarget && (() => {
        const srcQ = template.pages.flatMap(p => p.sections.flatMap(s => [...(s.questions || []), ...(s.subSections || []).flatMap(ss => ss.questions || [])])).find(q => q.id === moveTarget.sourceQuestionId);
        const term = moveSearchTerm.toLowerCase();
        const toggleExpand = (prefix: string, id: string) => { const key = `${prefix}:${id}`; setMoveExpandedIds(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; }); };
        return (
          <div className="fixed inset-0 z-[10010] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setMoveTarget(null); setMoveSearchTerm(''); setMoveExpandedIds(new Set()); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-white" />
                    <h3 className="text-sm font-bold text-white">Move Observation</h3>
                  </div>
                  <p className="text-[11px] text-cyan-100 mt-1 line-clamp-1">From: {srcQ?.text || 'Question'}</p>
                </div>
                <button onClick={() => { setMoveTarget(null); setMoveSearchTerm(''); setMoveExpandedIds(new Set()); }} className="p-1.5 bg-white/20 rounded-lg text-white hover:bg-white/30 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input value={moveSearchTerm} onChange={e => setMoveSearchTerm(e.target.value)} placeholder="Search questions..." autoFocus
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent bg-gray-50" />
                </div>
                {moveTarget.entry.text && (
                  <div className="mt-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider mb-0.5">Observation to move</p>
                    <p className="text-xs text-cyan-900 line-clamp-2">{moveTarget.entry.text}</p>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {template.pages.map(page => {
                  const pageQuestions: { q: QuestionNode; sectionTitle: string; subTitle?: string }[] = [];
                  page.sections.forEach(sec => {
                    (sec.questions || []).forEach(q => pageQuestions.push({ q, sectionTitle: sec.title }));
                    (sec.subSections || []).forEach(ss => {
                      (ss.questions || []).forEach(q => pageQuestions.push({ q, sectionTitle: sec.title, subTitle: ss.title }));
                    });
                  });
                  const filteredQs = term ? pageQuestions.filter(pq => pq.q.text.toLowerCase().includes(term) || pq.sectionTitle.toLowerCase().includes(term) || (pq.subTitle || '').toLowerCase().includes(term)) : pageQuestions;
                  if (filteredQs.length === 0) return null;
                  const isPageExpanded = moveExpandedIds.has(`page:${page.id}`) || !!term;
                  return (
                    <div key={page.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => toggleExpand('page', page.id)} className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isPageExpanded ? 'rotate-90' : ''}`} />
                          <span className="text-xs font-bold text-gray-700 truncate">{page.title || 'Untitled Page'}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{filteredQs.length}Q</span>
                        </div>
                      </button>
                      {isPageExpanded && (
                        <div className="border-t border-gray-100">
                          {page.sections.map(sec => {
                            const secQs = filteredQs.filter(pq => pq.sectionTitle === sec.title);
                            if (secQs.length === 0) return null;
                            const isSecExpanded = moveExpandedIds.has(`sec:${sec.id}`) || !!term;
                            return (
                              <div key={sec.id}>
                                <button onClick={() => toggleExpand('sec', sec.id)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-left border-b border-gray-50">
                                  <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isSecExpanded ? 'rotate-90' : ''}`} />
                                  <span className="text-[11px] font-semibold text-violet-700 truncate">{sec.title || 'Untitled Section'}</span>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{secQs.length}Q</span>
                                </button>
                                {isSecExpanded && (
                                  <div className="pl-6 pr-3 pb-1">
                                    {secQs.map(({ q, subTitle }) => {
                                      const isSrc = q.id === moveTarget.sourceQuestionId;
                                      return (
                                        <button key={q.id} onClick={() => !isSrc && handleMoveEntry(q.id)} disabled={isSrc}
                                          className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-xs transition-all ${isSrc ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-dashed border-gray-300' : 'hover:bg-cyan-50 hover:border-cyan-300 text-gray-700 border border-transparent hover:shadow-sm cursor-pointer'}`}>
                                          <p className={`font-medium leading-snug ${isSrc ? 'line-through' : ''}`}>{q.text || 'Untitled Question'}</p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            {subTitle && <span className="text-[9px] text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">{subTitle}</span>}
                                            {isSrc && <span className="text-[9px] text-gray-400 italic">Current question</span>}
                                            {q.risk && <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${q.risk === 'High' ? 'bg-red-50 text-red-600' : q.risk === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>{q.risk}</span>}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {term && template.pages.every(page => {
                  let hasMatch = false;
                  page.sections.forEach(sec => {
                    const secMatch = sec.title.toLowerCase().includes(term);
                    (sec.questions || []).forEach(q => { if (q.text.toLowerCase().includes(term) || secMatch) hasMatch = true; });
                    (sec.subSections || []).forEach(ss => { const ssMatch = ss.title.toLowerCase().includes(term); (ss.questions || []).forEach(q => { if (q.text.toLowerCase().includes(term) || secMatch || ssMatch) hasMatch = true; }); });
                  });
                  return !hasMatch;
                }) && (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400">No matching questions found</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 bg-gray-50">
                <p className="text-[10px] text-gray-400 text-center">Select a question to move the observation to</p>
              </div>
            </div>
          </div>
        );
      })()}

      {commentModal && (
        <CommentModal
          questionId={commentModal.questionId}
          questionText={commentModal.questionText}
          selectedAnswer={commentModal.selectedAnswer}
          existingComment={resolveComment(commentModal.questionId)}
          addNew={commentModal.addNew}
          onSave={handleSaveComment}
          onClose={() => setCommentModal(null)}
          locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
          lockedLocation={lockedLocation}
          onLockLocation={(loc) => setLockedLocation(loc)}
          onUnlockLocation={() => setLockedLocation(null)}
          allQuestions={commentModalQuestions}
          onReassign={handleReassignComment}
        />
      )}

      {correctionTarget && showPinDialog && (() => {
        const entry = comments[correctionTarget.questionId]?.entries?.find(e => e.id === correctionTarget.entryId);
        if (!entry) return null;
        return (
          <SupervisorPinDialog
            entry={entry}
            supervisorPin={supervisorPin}
            onAuthorized={handlePinAuthorized}
            onClose={() => { setCorrectionTarget(null); setShowPinDialog(false); }}
          />
        );
      })()}

      {correctionTarget && !showPinDialog && (() => {
        const entry = comments[correctionTarget.questionId]?.entries?.find(e => e.id === correctionTarget.entryId);
        if (!entry) return null;
        return (
          <CorrectionModal
            entry={entry}
            supervisorAuthorized={correctionTarget.supervisorAuthorized}
            onSave={handleSaveCorrection}
            onClose={() => setCorrectionTarget(null)}
          />
        );
      })()}

      {closureTarget && (() => {
        const qComment = comments[closureTarget.questionId];
        const entry = qComment?.entries?.find(e => e.id === closureTarget.entryId);
        if (!entry) return null;
        return (
          <ClosureModal
            entry={entry}
            onSave={(closureEvidence, closureComments) => {
              setComments(prev => {
                const existing = prev[closureTarget.questionId];
                if (!existing) return prev;
                return {
                  ...prev,
                  [closureTarget.questionId]: {
                    entries: existing.entries.map(e =>
                      e.id === closureTarget.entryId
                        ? { ...e, closureEvidence, closureComments }
                        : e
                    ),
                  },
                };
              });
              setClosureTarget(null);
            }}
            onClose={() => setClosureTarget(null)}
          />
        );
      })()}

      {notesOpen && (
        <div className="fixed inset-0 z-[10002] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={handleCancelNotes}>
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h4 className="text-base font-semibold text-gray-800">Checklist Notes</h4>
              <button onClick={handleCancelNotes} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <button onClick={() => setNotesBPCollapsed(prev => !prev)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors">
                  <span className="text-sm font-semibold text-gray-700">Best Practice / Improvement</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${notesBPCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!notesBPCollapsed && (
                  <div className="px-4 pb-4 space-y-3">
                    <RichTextEditor value={notesBestPractice} onChange={setNotesBestPractice} placeholder="Enter best practices or improvements..." minHeight="100px" />
                    {notesBPImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {notesBPImages.map((img, i) => (
                          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                            <img src={img} alt={`BP ${i + 1}`} className="w-full h-full object-cover" />
                            <button onClick={() => setNotesBPImages(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => notesBPCameraRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">
                        <Camera className="w-3.5 h-3.5" /> Camera
                      </button>
                      <button type="button" onClick={() => notesBPGalleryRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5" /> Gallery
                      </button>
                      {notesBPImages.length > 0 && <span className="text-[10px] text-gray-400 ml-auto">{notesBPImages.length} photo{notesBPImages.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <input ref={notesBPCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleNotesImageUpload(e, 'bp')} />
                    <input ref={notesBPGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleNotesImageUpload(e, 'bp')} />
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <button onClick={() => setNotesOFICollapsed(prev => !prev)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors">
                  <span className="text-sm font-semibold text-gray-700">Opportunity for Improvement</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${notesOFICollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!notesOFICollapsed && (
                  <div className="px-4 pb-4 space-y-3">
                    <RichTextEditor value={notesOpportunity} onChange={setNotesOpportunity} placeholder="Enter opportunities for improvement..." minHeight="100px" />
                    {notesOFIImages.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {notesOFIImages.map((img, i) => (
                          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                            <img src={img} alt={`OFI ${i + 1}`} className="w-full h-full object-cover" />
                            <button onClick={() => setNotesOFIImages(prev => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => notesOFICameraRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
                        <Camera className="w-3.5 h-3.5" /> Camera
                      </button>
                      <button type="button" onClick={() => notesOFIGalleryRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                        <ImageIcon className="w-3.5 h-3.5" /> Gallery
                      </button>
                      {notesOFIImages.length > 0 && <span className="text-[10px] text-gray-400 ml-auto">{notesOFIImages.length} photo{notesOFIImages.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <input ref={notesOFICameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleNotesImageUpload(e, 'ofi')} />
                    <input ref={notesOFIGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleNotesImageUpload(e, 'ofi')} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={handleCancelNotes} className="flex-1 py-2.5 sm:py-2 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSaveNotes} className="flex-1 py-2.5 sm:py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors shadow-sm">Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {showUnsyncWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-5 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl"><CloudOff className="w-5 h-5 text-amber-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Data Not Synced</h3>
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Your changes haven't been saved to the server yet</p>
              </div>
            </div>
            <div className="px-6 py-4 text-xs text-slate-600 leading-relaxed">
              <p>Some of your audit data is still pending sync to the database. {!isOnline ? 'You are currently offline.' : 'Sync is in progress.'}</p>
              {lastDbSyncAt && <p className="mt-2 text-[10px] text-slate-400">Last synced: {new Date(lastDbSyncAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
              {isForceSyncing && syncProgress && syncProgress.total > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-blue-700">Syncing to server...</span>
                    <span className="text-[10px] font-bold text-blue-700">{Math.round((syncProgress.done / syncProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{syncProgress.done} / {syncProgress.total} items synced</p>
                </div>
              )}
              <p className="mt-2 font-semibold text-slate-700">Do you want to proceed anyway or wait for sync to complete?</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowUnsyncWarning(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">Wait</button>
              <button onClick={async () => {
                setIsForceSyncing(true);
                setSyncProgress(null);
                try {
                  const snap = draftSnapshotRef.current();
                  saveDraftToStorage(storageKey, snap);
                  const result = await forceSyncAllAuditData((done, total) => setSyncProgress({ done, total }));
                  if (result.failed === 0 && result.synced > 0) { setSyncStatus('synced'); setLastSavedAt(Date.now()); setLastDbSyncAt(Date.now()); }
                  else if (result.failed > 0) { setSyncStatus('pending'); }
                } finally { setIsForceSyncing(false); setSyncProgress(null); }
                if (!isDataUnsynced()) setShowUnsyncWarning(null);
              }} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">{isForceSyncing && syncProgress ? <><Loader2 size={14} className="animate-spin" /> {Math.round((syncProgress.done / Math.max(syncProgress.total, 1)) * 100)}%</> : isForceSyncing ? <><Loader2 size={14} className="animate-spin" /> Syncing...</> : <><RotateCcw size={14} /> Sync Now</>}</button>
              <button onClick={() => {
                const action = showUnsyncWarning;
                setShowUnsyncWarning(null);
                if (action === 'close') _doCloseWithDraft();
                else if (action === 'save') _doSaveAsDraft();
                else if (action === 'sign') _doSignAndSend();
              }} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors">Proceed Anyway</button>
            </div>
          </div>
        </div>
      )}
      {showExcelImporter && (
        <ExcelAuditImporter
          template={template}
          existingAnswers={answers}
          existingComments={comments}
          onImport={(newAnswers, newComments, summary) => {
            // Merge imported data with existing state values (state is still pre-update here)
            const mergedAnswers = { ...answers, ...newAnswers };
            const mergedComments = { ...comments, ...newComments };
            setAnswers(mergedAnswers);
            setComments(mergedComments);

            // Always land in DRAFT state so the user can review before submitting
            const importNow = Date.now();
            const importStartTime = auditStartTime || importNow;
            if (!auditStartTime) {
              setAuditStartTime(importNow);
              updateUnit('startTime', new Date(importNow).toLocaleString());
            }
            setAuditState('draft');
            if (currentStep !== 'checklist') setCurrentStep('checklist');

            // Immediately persist the draft with the merged data so it shows up in
            // the Audit Registry drafts list (bypass stale-closure by using mergedAnswers/Comments)
            if (!trialMode) {
              const importSnap = {
                ...draftSnapshotRef.current(),
                answers: mergedAnswers,
                comments: mergedComments,
                auditState: 'draft' as const,
                auditStartTime: importStartTime,
                savedAt: importNow,
              };
              saveDraftToStorage(storageKey, importSnap);
              const draftId = storageKey.replace(DRAFT_PREFIX, '');
              fetch('/api/audit-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{ id: draftId, type: 'draft', data: _stripImagesFromData(importSnap) }]),
              }).catch(() => {});
            }

            // Close importer and show confirmation banner
            setShowExcelImporter(false);
            setShowImportBanner({ count: Object.keys(newAnswers).length });
            const allQFlat: { id: string; text: string; sectionTitle: string; pageTitle: string; responses: any[]; checklistName?: string }[] = [];
            template.pages.forEach(page => {
              page.sections.forEach(sec => {
                (sec.questions || []).forEach(q => allQFlat.push({ id: q.id, text: q.text, sectionTitle: sec.title || '', pageTitle: page.title || '', responses: q.responses || [], checklistName: template.name || '' }));
                (sec.subSections || []).forEach(ss => {
                  (ss.questions || []).forEach(q => allQFlat.push({ id: q.id, text: q.text, sectionTitle: `${sec.title || ''} > ${ss.title || ''}`, pageTitle: page.title || '', responses: q.responses || [], checklistName: template.name || '' }));
                });
              });
            });
            const importedObs: RegistryObsItem[] = [];
            const isoNow = new Date().toISOString();
            const ts = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            for (const qInfo of allQFlat) {
              const qComment = newComments[qInfo.id];
              if (!qComment?.entries?.length) continue;
              const ansInfo = newAnswers[qInfo.id];
              const answerText = (ansInfo?.selectedIndex !== null && ansInfo?.selectedIndex !== undefined && qInfo.responses[ansInfo.selectedIndex]) ? qInfo.responses[ansInfo.selectedIndex].text : '';
              for (let ei = 0; ei < qComment.entries.length; ei++) {
                const entry = qComment.entries[ei];
                if (!entry.text?.trim() && !(entry.images?.length)) continue;
                const obsDept = qInfo.pageTitle || auditLocationName || '';
                importedObs.push({
                  id: entry.id || `import-obs-${Date.now()}-${ei}-${Math.random().toString(36).slice(2, 6)}`,
                  title: qInfo.text || 'Observation',
                  questionText: qInfo.text || '',
                  selectedAnswer: answerText,
                  observationText: entry.text || '',
                  sop: qInfo.sectionTitle || '',
                  sectionTitle: qInfo.sectionTitle || undefined,
                  checklistName: qInfo.checklistName || undefined,
                  severity: 'MINOR',
                  level: 'L1',
                  mainKitchen: obsDept,
                  area: entry.location || auditLocationName || '',
                  hierarchy: auditUnitName || '',
                  closureComments: null,
                  status: 'OPEN',
                  duration: '0d 0h',
                  followUpStatus: 'NOT DONE',
                  followUpCount: 0,
                  followUpDate: '',
                  reportedBy: 'Auditor',
                  lastUpdate: ts,
                  createdDate: isoNow,
                  thumbnail: (entry.images || [])[0] || '',
                  allEvidence: entry.images || [],
                  isStarred: false,
                  people: [],
                  assets: [],
                  categories: [],
                  tracking: [{ id: `t-${Date.now()}-${ei}`, label: 'Reported', user: 'Auditor', timestamp: ts, comments: entry.text || '' }],
                  isAuditSourced: true,
                  departmentName: obsDept,
                  unitId: auditUnitId || undefined,
                  unitName: auditUnitName || auditLocationName || '',
                });
              }
            }
            if (importedObs.length > 0) {
              // Keep imported observations in the audit session only.
              // Do NOT push to the Observation Registry as drafts — they
              // will be saved there only when the audit is submitted.
              setFullRegistryObs(prev => {
                const existingIds = new Set(prev.map(o => o.id));
                const newObs = importedObs.filter(o => !existingIds.has(o.id));
                return [...prev, ...newObs];
              });
              fullRegistryObsFetchedRef.current = true;
            } else {
              fullRegistryObsFetchedRef.current = false;
              setFullRegistryRefreshKey(prev => prev + 1);
            }
          }}
          onClose={() => setShowExcelImporter(false)}
        />
      )}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-violet-100 rounded-xl">
                  <PenTool className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Sign & Submit Audit</h3>
                  <p className="text-[10px] text-slate-400">Sign below to finalize the audit report</p>
                </div>
              </div>
              <button onClick={() => setShowSignatureModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditor Signature <span className="text-rose-500">*</span></label>
                  <button onClick={() => sigClear(auditorSigCanvasRef.current, setAuditSignature)} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                  </button>
                </div>
                <div className="w-full h-28 bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl relative overflow-hidden shadow-inner cursor-crosshair">
                  <canvas
                    ref={auditorSigCanvasRef}
                    width={500} height={112}
                    className="w-full h-full"
                    onMouseDown={(e) => sigStartDrawing(e, auditorSigCanvasRef.current)}
                    onMouseMove={(e) => sigDraw(e, auditorSigCanvasRef.current)}
                    onMouseUp={() => sigStopDrawing(auditorSigCanvasRef.current, setAuditSignature)}
                    onMouseLeave={() => sigStopDrawing(auditorSigCanvasRef.current, setAuditSignature)}
                    onTouchStart={(e) => sigStartDrawing(e, auditorSigCanvasRef.current)}
                    onTouchMove={(e) => sigDraw(e, auditorSigCanvasRef.current)}
                    onTouchEnd={() => sigStopDrawing(auditorSigCanvasRef.current, setAuditSignature)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Name: <span className="font-semibold text-slate-600">{unitForm.repName || '—'}</span></p>
              </div>

              {hadReviewerSignature.current && (
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reviewer Signature</label>
                  <button onClick={() => sigClear(reviewerSigCanvasRef.current, setReviewerSignature)} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                  </button>
                </div>
                <div className="w-full h-28 bg-slate-50 border-2 border-slate-200 border-dashed rounded-xl relative overflow-hidden shadow-inner cursor-crosshair">
                  <canvas
                    ref={reviewerSigCanvasRef}
                    width={500} height={112}
                    className="w-full h-full"
                    onMouseDown={(e) => sigStartDrawing(e, reviewerSigCanvasRef.current)}
                    onMouseMove={(e) => sigDraw(e, reviewerSigCanvasRef.current)}
                    onMouseUp={() => sigStopDrawing(reviewerSigCanvasRef.current, setReviewerSignature)}
                    onMouseLeave={() => sigStopDrawing(reviewerSigCanvasRef.current, setReviewerSignature)}
                    onTouchStart={(e) => sigStartDrawing(e, reviewerSigCanvasRef.current)}
                    onTouchMove={(e) => sigDraw(e, reviewerSigCanvasRef.current)}
                    onTouchEnd={() => sigStopDrawing(reviewerSigCanvasRef.current, setReviewerSignature)}
                  />
                </div>
                <div className="mt-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reviewer Name</label>
                  <input type="text" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="Enter reviewer's name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 outline-none transition-all" />
                </div>
              </div>
              )}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowSignatureModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmitWithSignature}
                disabled={!auditSignature}
                className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviousReports && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <History className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Previous Audit Reports</h3>
                  <p className="text-[10px] text-slate-400">Last 5 submitted reports for {template.title}</p>
                </div>
              </div>
              <button onClick={() => setShowPreviousReports(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingPreviousReports ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-600 border-t-transparent" />
                </div>
              ) : previousReports.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">No previous reports found for this checklist.</div>
              ) : (
                previousReports.map((report, idx) => {
                  const rd = report.data;
                  const savedDate = rd.savedAt ? new Date(rd.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                  const savedTime = rd.savedAt ? new Date(rd.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
                  const isExpanded = expandedReportId === report.id;
                  const rdAnswerKeys = Object.keys(rd.answers || {});
                  const findAnswer = (baseId: string) => {
                    const direct = rd.answers?.[baseId];
                    if (direct && direct.selectedIndex !== null && direct.selectedIndex !== undefined) return direct;
                    const suffixed = rdAnswerKeys.filter(k => k.endsWith('::' + baseId));
                    if (suffixed.length > 0) return rd.answers?.[suffixed[0]];
                    return direct;
                  };
                  const findAllAnswers = (baseId: string) => {
                    const results: typeof rd.answers[string][] = [];
                    const direct = rd.answers?.[baseId];
                    if (direct && direct.selectedIndex !== null && direct.selectedIndex !== undefined) results.push(direct);
                    const suffixed = rdAnswerKeys.filter(k => k.endsWith('::' + baseId));
                    suffixed.forEach(k => {
                      const a = rd.answers?.[k];
                      if (a && a.selectedIndex !== null && a.selectedIndex !== undefined) results.push(a);
                    });
                    if (results.length === 0 && direct) results.push(direct);
                    return results;
                  };
                  let totalObtained = 0, totalMax = 0;
                  template.pages.forEach(page => {
                    page.sections.forEach(sec => {
                      const allQs = [...(sec.questions || []), ...(sec.subSections || []).flatMap(ss => ss.questions || [])];
                      allQs.forEach(q => {
                        const allAns = findAllAnswers(q.id);
                        if (allAns.length === 0) return;
                        const maxS = Math.max(...q.responses.map(r => parseFloat(r.score) || 0), 0);
                        allAns.forEach(ans => {
                          if (isAnswerNA(q, ans)) return;
                          totalMax += maxS;
                          if (ans && ans.selectedIndex !== null && ans.selectedIndex !== undefined) {
                            totalObtained += (ans.marks || 0);
                          }
                        });
                      });
                    });
                  });
                  const totalPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
                  const ratingColor = totalPct >= 90 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : totalPct >= 70 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';

                  return (
                    <div key={report.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-8 h-8 bg-slate-100 rounded-lg">
                            <span className="text-xs font-bold text-slate-600">#{idx + 1}</span>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-slate-700">{savedDate} {savedTime}</p>
                            <p className="text-[11px] text-slate-400">{rd.unitName || rd.checklistName || report.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${ratingColor}`}>
                            {totalPct}%
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 max-h-[40vh] overflow-y-auto">
                          {template.pages.map(page => {
                            let pageObtained = 0, pageMax = 0;
                            page.sections.forEach(sec => {
                              const allQs = [...(sec.questions || []), ...(sec.subSections || []).flatMap(ss => ss.questions || [])];
                              allQs.forEach(q => {
                                const allAns = findAllAnswers(q.id);
                                if (allAns.length === 0) return;
                                const maxS = Math.max(...q.responses.map(r => parseFloat(r.score) || 0), 0);
                                allAns.forEach(ans => {
                                  if (isAnswerNA(q, ans)) return;
                                  pageMax += maxS;
                                  if (ans && ans.selectedIndex !== null && ans.selectedIndex !== undefined) {
                                    pageObtained += (ans.marks || 0);
                                  }
                                });
                              });
                            });
                            const pagePct = pageMax > 0 ? Math.round((pageObtained / pageMax) * 100) : 0;
                            return (
                              <div key={page.id} className="mb-3 last:mb-0">
                                <div className="flex items-center justify-between mb-1.5">
                                  <h4 className="text-xs font-bold text-slate-600 uppercase">{page.title}</h4>
                                  <span className="text-[11px] font-semibold text-slate-500">{pageObtained}/{pageMax} ({pagePct}%)</span>
                                </div>
                                <div className="space-y-1">
                                  {page.sections.map(sec => {
                                    const allQs = [...(sec.questions || []), ...(sec.subSections || []).flatMap(ss => ss.questions || [])];
                                    return allQs.map((q, qIdx) => {
                                      const ans = findAnswer(q.id);
                                      const isNA = isAnswerNA(q, ans);
                                      const maxS = Math.max(...q.responses.map(r => parseFloat(r.score) || 0), 0);
                                      const scored = (ans && ans.selectedIndex !== null && ans.selectedIndex !== undefined) ? (ans.marks || 0) : 0;
                                      const selectedLabel = (ans?.selectedIndex !== null && ans?.selectedIndex !== undefined && q.responses[ans.selectedIndex]) ? q.responses[ans.selectedIndex].text : '—';
                                      const isLowScore = !isNA && maxS > 0 && scored < maxS;
                                      return (
                                        <div key={q.id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${isLowScore ? 'bg-red-50/50 border border-red-100' : 'bg-white border border-slate-100'}`}>
                                          <span className="text-slate-400 font-mono w-5 flex-shrink-0 text-right">{qIdx + 1}.</span>
                                          <span className="flex-1 text-slate-600 leading-snug">{q.text}</span>
                                          <span className="flex-shrink-0 font-semibold whitespace-nowrap">
                                            {isNA ? <span className="text-slate-400">NA</span> : (
                                              <span className={isLowScore ? 'text-red-500' : 'text-emerald-600'}>{scored}/{maxS}</span>
                                            )}
                                          </span>
                                          <span className={`flex-shrink-0 w-16 text-right truncate ${isNA ? 'text-slate-300' : isLowScore ? 'text-red-400' : 'text-slate-400'}`}>
                                            {selectedLabel}
                                          </span>
                                        </div>
                                      );
                                    });
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-600">Overall Score</span>
                            <span className={`text-sm font-bold ${totalPct >= 90 ? 'text-emerald-600' : totalPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                              {totalObtained}/{totalMax} ({totalPct}%)
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="flex items-center gap-1.5 mb-2">
                              <FileDown className="w-3.5 h-3.5 text-violet-600" />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Download This Report</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                disabled={!!prevReportDownloading}
                                onClick={() => { setPrevReportDownloading(report.id + '_all'); downloadPreviousReport(rd, 'consolidated'); }}
                                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {prevReportDownloading === report.id + '_all' ? <><div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" /> Generating...</> : <><Layers className="w-3 h-3" /> Consolidated PDF</>}
                              </button>
                              {template.pages.length > 1 && template.pages.map((page, pi) => (
                                <button
                                  key={pi}
                                  disabled={!!prevReportDownloading}
                                  onClick={() => { setPrevReportDownloading(report.id + '_' + pi); downloadPreviousReport(rd, 'department', page.title); }}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {prevReportDownloading === report.id + '_' + pi ? <><div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-600 border-t-transparent" /> ...</> : <><FileDown className="w-3 h-3" /> {page.title}</>}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowPreviousReports(false)} className="w-full py-2 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {auditState !== 'idle' && auditState !== 'submitted' && (
        <div className="fixed bottom-[4.5rem] sm:bottom-3 left-3 right-3 z-[10001] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/80 px-3 py-2 flex items-center justify-between gap-1.5 pointer-events-auto">
            {currentStep === 'checklist' && (
              <FloatingCommentButton
                template={template}
                answers={answers}
                comments={comments}
                locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
                lockedLocation={lockedLocation}
                onLockLocation={(loc) => setLockedLocation(loc)}
                onUnlockLocation={() => setLockedLocation(null)}
                departmentLocations={departmentLocations}
                combinedLocations={combinedLocations}
                onSaveComment={handleSaveComment}
                onSaveAsDraftCb={handleFloatingDraftSave}
                onObsSaveCb={handleFloatingObsSave}
                onAnswerSelect={(qId, rIdx, resp) => {
                  const effPages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
                  const allQs: QuestionNode[] = [];
                  effPages.forEach(p => p.sections.forEach(s => {
                    allQs.push(...(s.questions || []));
                    (s.subSections || []).forEach(ss => allQs.push(...(ss.questions || [])));
                  }));
                  const q = allQs.find(qq => qq.id === qId);
                  if (q) handleAnswerSelect(qId, rIdx, resp, q.text || '', q);
                }}
                auditLocationName={auditLocationName}
                auditUnitId={auditUnitId}
                auditUnitName={auditUnitName}
                questionHistoryMap={questionHistoryMap}
                effectivePages={(isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : undefined}
                onTagUpdate={(tagUpdates) => setObsTags(prev => ({ ...prev, ...tagUpdates }))}
                externalOpen={triggerAddObs}
                onExternalOpenHandled={() => setTriggerAddObs(false)}
              />
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <div className="flex items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    !isOnline ? 'bg-orange-100 text-orange-600' :
                    isForceSyncing || syncStatus === 'syncing' ? 'bg-blue-100 text-blue-600' :
                    syncStatus === 'pending' ? 'bg-amber-100 text-amber-600' :
                    syncStatus === 'synced' || lastSavedAt ? 'bg-emerald-100 text-emerald-600' :
                    'bg-gray-100 text-gray-500'
                  }`}
                  title={
                    !isOnline ? 'Offline — saved locally' :
                    isForceSyncing && syncProgress ? `Syncing ${Math.round((syncProgress.done / Math.max(syncProgress.total, 1)) * 100)}%` :
                    isForceSyncing ? 'Syncing to database...' :
                    syncStatus === 'syncing' ? 'Syncing...' :
                    syncStatus === 'pending' ? 'Pending sync' :
                    syncStatus === 'synced' || lastSavedAt ? `Auto-saved${lastSavedAt ? ` ${Math.round((Date.now() - lastSavedAt) / 1000)}s ago` : ''}` :
                    'Auto-save active'
                  }
                >
                  {!isOnline ? (
                    <WifiOff size={16} />
                  ) : isForceSyncing || syncStatus === 'syncing' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : syncStatus === 'pending' ? (
                    <CloudOff size={16} />
                  ) : syncStatus === 'synced' || lastSavedAt ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                </div>
                {isForceSyncing && syncProgress && syncProgress.total > 0 ? (
                  <div className="hidden sm:flex flex-col leading-none">
                    <span className="text-[7px] font-black uppercase tracking-wider text-blue-500">Syncing</span>
                    <span className="text-[9px] font-bold text-blue-600">{syncProgress.done}/{syncProgress.total} ({Math.round((syncProgress.done / syncProgress.total) * 100)}%)</span>
                  </div>
                ) : lastDbSyncAt ? (
                  <div className="hidden sm:flex flex-col leading-none">
                    <span className={`text-[7px] font-black uppercase tracking-wider ${syncStatus === 'synced' ? 'text-emerald-500' : syncStatus === 'pending' ? 'text-amber-500' : 'text-slate-400'}`}>{syncStatus === 'synced' ? 'Synced' : syncStatus === 'pending' ? 'Pending' : syncStatus === 'syncing' ? 'Syncing' : 'Last sync'}</span>
                    <span className="text-[9px] font-semibold text-slate-500">{new Date(lastDbSyncAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                ) : null}
              </div>
              {isOnline && !isForceSyncing && (syncStatus === 'pending' || syncStatus === 'idle' || lastSavedAt) && (
                <button
                  onClick={async () => {
                    setIsForceSyncing(true);
                    setSyncProgress(null);
                    try {
                      const snap = draftSnapshotRef.current();
                      saveDraftToStorage(storageKey, snap);
                      const result = await forceSyncAllAuditData((done, total) => setSyncProgress({ done, total }));
                      if (result.failed === 0 && result.synced > 0) {
                        setSyncStatus('synced');
                        setLastSavedAt(Date.now());
                        setLastDbSyncAt(Date.now());
                      } else if (result.failed > 0) {
                        setSyncStatus('pending');
                      }
                    } finally {
                      setIsForceSyncing(false);
                      setSyncProgress(null);
                    }
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-violet-100 text-violet-600 hover:bg-violet-200 transition-colors active:scale-90"
                  title="Force Sync"
                >
                  <RotateCcw size={16} />
                </button>
              )}

              {currentStep === 'checklist' && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-0.5" />
                  <button
                    onClick={() => { setSearchOpen(v => !v); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${searchOpen ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    title="Search Questions"
                  >
                    <Search size={16} />
                  </button>
                  {(() => {
                    const anythingOpen = !!(openDeptKey || openLocationKey || openSectionKey || openSubSectionKey);
                    return (
                      <button
                        onClick={() => { setOpenDeptKey(null); setOpenLocationKey(null); setOpenSectionKey(null); setOpenSubSectionKey(null); }}
                        disabled={!anythingOpen}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 ${anythingOpen ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                        title="Collapse All"
                      >
                        <ChevronUp size={16} />
                      </button>
                    );
                  })()}
                  <button onClick={() => setShowObservationPanel(true)}
                    className="relative w-9 h-9 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 flex items-center justify-center transition-all active:scale-90"
                    title="Observation List"
                  >
                    <AlertTriangle size={16} />
                    {liveObservations.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center border border-white">{liveObservations.length}</span>
                    )}
                  </button>
                  <button onClick={handleOpenNotes}
                    className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 hover:bg-violet-200 flex items-center justify-center transition-all active:scale-90"
                    title="Best Practices & Notes"
                  >
                    <BookOpen size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showPanelAddObs && (() => {
        const effPages = (isLocationMode && locationVirtualPages) ? locationVirtualPages.flatMap(lv => lv.pages) : template.pages;
        const qs: { id: string; text: string; pageTitle: string; sectionTitle: string; responses: { text: string; score: string; color: string }[]; checklistName: string; checklistId: string; responsibility: string[]; department: string }[] = [];
        effPages.forEach(page => {
          const pageId = page.id || '';
          const hasVP = pageId.includes('::');
          const vpPrefix = hasVP ? pageId.split('::')[0] : '';
          const dept = page.title || 'Page';
          page.sections.forEach(sec => {
            const addQ = (q: QuestionNode) => {
              qs.push({ id: q.id, text: q.text || 'Untitled', pageTitle: hasVP ? `${vpPrefix}::${page.title || 'Page'}` : (page.title || 'Page'), sectionTitle: sec.title || 'Section', responses: q.responses.map(r => ({ text: r.text || '', score: r.score !== undefined ? String(r.score) : '0', color: r.color || '' })), checklistName: template.title || 'Checklist', checklistId: template.id || '', responsibility: q.responsibility || [], department: dept });
            };
            (sec.questions || []).forEach(addQ);
            (sec.subSections || []).forEach(sub => (sub.questions || []).forEach(addQ));
          });
        });
        return (
          <div className="fixed inset-0 z-[10005]">
            <AddObservationModal
              questions={qs}
              locationOptions={isDeptLevelAudit ? deptLocationOptions : undefined}
              auditLocationName={auditLocationName}
              auditUnitId={auditUnitId}
              auditUnitName={auditUnitName}
              checklistId={template.id}
              lockedLocation={lockedLocation}
              onLockLocation={(loc) => setLockedLocation(loc)}
              onUnlockLocation={() => setLockedLocation(null)}
              departmentLocations={departmentLocations}
              combinedLocations={combinedLocations}
              onClose={() => setShowPanelAddObs(false)}
              onSave={(observations) => {
                const ts = new Date().toLocaleString();
                const grouped: Record<string, import('./AddObservationModal').CommentEntry[]> = {};
                const tagUpdates: Record<string, 'management-focus' | 'easy-impactful' | 'ongoing'> = {};
                for (const obs of observations) {
                  const matchedQ = qs.find(q => q.id === obs.questionId);
                  if (matchedQ) {
                    const entryId = obs.id || `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const respIdx = (obs.selectedResponseIndex !== undefined && obs.selectedResponseIndex !== null && obs.selectedResponseIndex >= 0)
                      ? obs.selectedResponseIndex
                      : (obs.selectedAnswer ? matchedQ.responses.findIndex(r => r.text === obs.selectedAnswer) : -1);
                    const newEntry: import('./AddObservationModal').CommentEntry = { id: entryId, text: obs.observationText, images: [...obs.allEvidence], closureEvidence: [], closureComments: '', timestamp: ts, createdAtMs: Date.now(), ...(obs.location ? { location: obs.location } : {}), savedToDb: true, managementTag: obs.managementTag, resourceRequired: obs.resourceRequired || undefined, selectedResponseIndex: respIdx >= 0 ? respIdx : undefined };
                    if (!grouped[matchedQ.id]) grouped[matchedQ.id] = [];
                    grouped[matchedQ.id].push(newEntry);
                    if (obs.managementTag) tagUpdates[entryId] = obs.managementTag;
                  }
                }
                for (const [qId, newEntries] of Object.entries(grouped)) {
                  setComments(prev => {
                    const existing = prev[qId];
                    return { ...prev, [qId]: { entries: [...(existing?.entries || []), ...newEntries] } };
                  });
                }
                if (Object.keys(tagUpdates).length > 0) setObsTags(prev => ({ ...prev, ...tagUpdates }));
                handleFloatingObsSave(observations);
                fullRegistryObsFetchedRef.current = false;
                setFullRegistryRefreshKey(prev => prev + 1);
                setShowPanelAddObs(false);
              }}
              onSaveAsDraft={(drafts) => { handleFloatingDraftSave(drafts); setShowPanelAddObs(false); }}
              onAnswerSelect={(qId, rIdx, resp) => {
                const allQNodes: QuestionNode[] = [];
                effPages.forEach(p => p.sections.forEach(s => { allQNodes.push(...(s.questions || [])); (s.subSections || []).forEach(ss => allQNodes.push(...(ss.questions || []))); }));
                const q = allQNodes.find(qq => qq.id === qId);
                if (q) handleAnswerSelect(qId, rIdx, resp, q.text || '', q);
              }}
              questionHistoryMap={questionHistoryMap ? Object.fromEntries(Object.entries(questionHistoryMap).map(([qId, recs]) => [qId, recs.map(r => ({ date: r.date, status: r.status }))])) : undefined}
              currentAnswers={answers}
            />
          </div>
        );
      })()}
    </div>
  );
}
