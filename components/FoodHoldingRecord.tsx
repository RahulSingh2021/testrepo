"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Flame, Snowflake, X, Search, Thermometer, Clock, Camera, Building2,
  CheckCheck, Zap, Calendar, ShieldCheck, PenTool,
  Plus, Database, RefreshCw, Download, 
  CheckCircle2, Globe, MapPin, Package, History,
  Info, ChevronRight, ChevronDown, ChevronUp,
  Trash2, Edit3, UserCheck, Loader2, Play,
  SlidersHorizontal, BarChart3, Activity, 
  CheckSquare, Square, Timer, ArrowRight,
  MoreVertical, FileText, Split, Eraser,
  ShieldAlert, ImageIcon, Check, ChevronsLeft, ChevronLeft, ChevronsRight, ClipboardCheck, MessageSquare,
  XCircle, ListChecks, Leaf, Beef,
  TimerOff,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import Logo from './Logo';
import { resolveEntityLogoSrc } from '@/utils/pdfHeader';
import { FoodHoldingEntry, HierarchyScope, Entity } from '../types';
import { compressImage } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import UnifiedPagination from './UnifiedPagination';

// --- UPDATED TYPES ---
interface MonitoringLog {
    id: string;
    time: string;
    temp: number;
    user: string;
    tempImg?: string;
    signature?: string;
    comments?: string;
}

interface ExtendedFoodHoldingEntry extends Omit<FoodHoldingEntry, 'monitoringTime' | 'monitoringTemp'> {
    monitoringLogs: MonitoringLog[];
    dietaryType?: 'Veg' | 'Non-Veg';
}

// --- ISO 22000 Types ---
interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

const isEntrySelectable = (e: ExtendedFoodHoldingEntry) => 
    e.status === 'COMPLETED' && !e.isVerified;

// --- MOCK DATA ---
const generateMockData = (): ExtendedFoodHoldingEntry[] => {
  return Array.from({ length: 15 }).map((_, i) => {
    const status = i % 4 === 0 ? 'READY' : i % 4 === 1 ? 'INITIATED' : i % 4 === 2 ? 'MONITORED' : 'COMPLETED';
    const logs: MonitoringLog[] = [];
    
    if (status === 'MONITORED' || status === 'COMPLETED') {
        logs.push({
            id: `log-${i}-1`,
            time: '01:00 PM',
            temp: i % 2 === 0 ? 65 : 4.5,
            user: 'Chef Alex',
            comments: 'Temp stable.',
            signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII=",
            tempImg: "https://images.unsplash.com/photo-1584269656462-2334cb2823c1?q=80&w=200&auto=format&fit=crop"
        });
        if (i % 3 === 0) {
             logs.push({
                id: `log-${i}-2`,
                time: '03:00 PM',
                temp: i % 2 === 0 ? 63 : 4.8,
                user: 'Chef Alex',
                comments: 'Slight fluctuation observed.',
                signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAYCAYAAAA9O98vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAbUlEQVR4nO3SQRGAQAwEwbV/Z6YCPvSABmRBDpCExL1mZp7OnNnu7p6ZeTpzZru7e2bm6cyZ7e7umZmnM2e2u7tnZp7OnNnu7v4Bq89Xv7O5v28AAAAASUVORK5CYII="
            });
        }
    }

    return {
        uuid: `hold-${100 + i}`,
        status: status,
        type: i % 2 === 0 ? 'HOT' : 'COLD',
        date: '2025-05-20',
        locationName: `Buffet Line ${i % 3 + 1}`,
        departmentName: 'F&B Service',
        unitName: 'NYC Central Kitchen',
        regionName: 'North America',
        productName: i % 3 === 0 ? "ROAST CHICKEN" : i % 3 === 1 ? "GREEK SALAD" : "STEAMED RICE",
        batchNumber: `BT-H-${100 + i}`,
        isVerified: i % 5 === 0,
        startTime: status !== 'READY' ? '11:00 AM' : undefined,
        startTemp: status !== 'READY' ? (i % 2 === 0 ? 72 : 4) : undefined,
        monitoringLogs: logs,
        terminalTime: status === 'COMPLETED' ? '05:00 PM' : undefined,
        terminalTemp: status === 'COMPLETED' ? (i % 2 === 0 ? 60 : 5.0) : undefined,
        operatorName: status === 'COMPLETED' ? 'Chef Alex' : undefined,
        operatorComments: status === 'COMPLETED' ? 'Held at optimal levels.' : undefined,
        verifierName: i % 5 === 0 ? 'QA Inspector' : undefined,
        verificationDate: i % 5 === 0 ? '2025-05-20 06:00 PM' : undefined,
        dietaryType: i % 3 === 0 ? 'Non-Veg' : 'Veg'
    };
  });
};

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Staff Auth" }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        if (initialData && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0);
                img.src = initialData;
            }
        }
    }, [initialData]);

    const startDrawing = (e: any) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) { compressImage(canvas.toDataURL()).then(compressed => onSave(compressed)); }
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onSave('');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                <button type="button" onClick={clear} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                    <Eraser size={10} /> Reset
                </button>
            </div>
            <div className="w-full h-24 bg-slate-50 border-2 border-slate-100 border-dashed rounded-2xl relative overflow-hidden shadow-inner cursor-crosshair">
                <canvas ref={canvasRef} width={500} height={96} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchEnd={stopDrawing} onTouchMove={draw} />
                {!initialData && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <span className="text-3xl font-black uppercase -rotate-6 select-none tracking-tighter">Sign to Authenticate</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface FoodHoldingRecordProps {
  currentScope?: HierarchyScope;
  activeEntity?: Entity | null;
  entities?: any[];
  userRootId?: string | null;
}

const FoodHoldingRecord: React.FC<FoodHoldingRecordProps> = ({ 
    currentScope = 'unit', 
    activeEntity,
    entities = [],
    userRootId
}) => {
  const [entries, setEntries] = useState<ExtendedFoodHoldingEntry[]>(generateMockData());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HOT' | 'COLD' | 'MONITOR' | 'VERIFY' | 'HISTORY'>('ALL');
  const [now, setNow] = useState(Date.now());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ExtendedFoodHoldingEntry | null>(null);
  const [actionStage, setActionStage] = useState<'INITIATE' | 'MONITOR' | 'COMPLETE' | 'VERIFY' | null>(null);
  const [verificationMode, setVerificationMode] = useState<'SINGLE' | 'BULK'>('SINGLE');
  const [tempInput, setTempInput] = useState("");
  const [signature, setSignature] = useState("");
  const [comments, setComments] = useState("");
  const [tempImg, setTempImg] = useState<string | null>(null);
  const [newBatchForm, setNewBatchForm] = useState({
      productName: '',
      batchNumber: '',
      type: 'HOT' as 'HOT' | 'COLD',
      dietaryType: 'Veg' as 'Veg' | 'Non-Veg',
      comments: '',
      signature: ''
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ISO 22000 Doc Control State
  const [docControlData] = useState<DocControlInfo>({
      docRef: 'HOLD-RGST-09',
      version: '3.2',
      effectiveDate: new Date().toISOString().split('T')[0],
      approvedBy: 'Quality Assurance Director'
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: entries.length,
    hot: entries.filter(e => e.type === 'HOT').length,
    cold: entries.filter(e => e.type === 'COLD').length,
    dueVerify: entries.filter(e => e.status === 'COMPLETED' && !e.isVerified).length,
    inFlow: entries.filter(e => e.status === 'INITIATED' || e.status === 'MONITORED').length,
    verified: entries.filter(e => e.isVerified).length
  }), [entries]);

  const filteredData = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = e.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchType = true;
      if (activeFilter === 'HOT') matchType = e.type === 'HOT';
      else if (activeFilter === 'COLD') matchType = e.type === 'COLD';
      else if (activeFilter === 'MONITOR') matchType = (e.status === 'INITIATED' || e.status === 'MONITORED');
      else if (activeFilter === 'VERIFY') matchType = (e.status === 'COMPLETED' && !e.isVerified);
      else if (activeFilter === 'HISTORY') matchType = e.isVerified;

      let matchDate = true;
      if (dateFrom) {
          const d = new Date(dateFrom);
          d.setHours(0,0,0,0);
          matchDate = matchDate && new Date(e.date) >= d;
      }
      if (dateTo) {
          const d = new Date(dateTo);
          d.setHours(23,59,59,999);
          matchDate = matchDate && new Date(e.date) <= d;
      }

      return matchSearch && matchType && matchDate;
    }).sort((a,b) => (a.status === 'COMPLETED' ? 1 : -1));
  }, [entries, searchTerm, activeFilter, dateFrom, dateTo]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const selectableEntries = useMemo(() => {
    return filteredData.filter(e => e.status === 'COMPLETED' && !e.isVerified);
  }, [filteredData]);

  const logoSrc = useMemo(() => resolveEntityLogoSrc(entities, userRootId), [entities, userRootId]);

  const areAllSelectableSelected = selectableEntries.length > 0 && selectableEntries.every(e => selectedIds.has(e.uuid));

  const handleSelectAll = () => {
    if (areAllSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEntries.map(e => e.uuid)));
    }
  };

  const handleAction = (entry: ExtendedFoodHoldingEntry, stage: typeof actionStage) => {
    setSelectedEntry(entry);
    setActionStage(stage);
    setVerificationMode('SINGLE');
    setTempInput("");
    setSignature("");
    setComments("");
    setTempImg(null);
    setIsActionModalOpen(true);
  };

  const handleBulkVerifyClick = () => {
    if (selectedIds.size === 0) return;
    setActionStage('VERIFY');
    setVerificationMode('BULK');
    setSignature("");
    setComments("");
    setIsActionModalOpen(true);
  };

  const handleNewBatch = () => {
    setNewBatchForm({
        productName: '',
        batchNumber: '',
        type: 'HOT',
        dietaryType: 'Veg',
        comments: '',
        signature: ''
    });
    setIsNewBatchModalOpen(true);
  };

  const confirmNewBatch = () => {
    if (!newBatchForm.productName || !newBatchForm.batchNumber) {
        alert("Please fill in Product Name and Batch Number.");
        return;
    }

    const newId = Date.now();
    const newEntry: ExtendedFoodHoldingEntry = {
        uuid: `hold-${newId}`,
        status: 'READY',
        type: newBatchForm.type,
        dietaryType: newBatchForm.dietaryType,
        date: new Date().toISOString().split('T')[0],
        locationName: 'Prep Station',
        departmentName: 'Main Kitchen',
        unitName: 'NYC Central Kitchen',
        regionName: 'North America',
        productName: newBatchForm.productName.toUpperCase(),
        batchNumber: newBatchForm.batchNumber,
        isVerified: false,
        monitoringLogs: [],
        operatorComments: newBatchForm.comments,
        operatorSignature: newBatchForm.signature
    };

    setEntries([newEntry, ...entries]);
    setIsNewBatchModalOpen(false);
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const commitAction = () => {
    if (!actionStage) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempNum = parseFloat(tempInput);

    if (actionStage === 'VERIFY' && verificationMode === 'BULK') {
        if (!signature) return;
        const verificationTime = new Date().toLocaleString();
        
        setEntries(prev => prev.map(e => {
            if (selectedIds.has(e.uuid) && e.status === 'COMPLETED' && !e.isVerified) {
                return { 
                    ...e, 
                    isVerified: true, 
                    verifierName: 'QA Auditor', 
                    verifierSignature: signature, 
                    verifierComments: comments, 
                    verificationDate: verificationTime 
                };
            }
            return e;
        }));
        setSelectedIds(new Set());
    } else {
        if (!selectedEntry) return;

        setEntries(prev => prev.map(e => {
            if (e.uuid !== selectedEntry.uuid) return e;
            if (actionStage === 'INITIATE') {
                return { ...e, status: 'INITIATED', startTime: timeStr, startTemp: tempNum, startTempImg: tempImg || undefined };
            }
            if (actionStage === 'MONITOR') {
                const newLog: MonitoringLog = {
                    id: `log-${Date.now()}`,
                    time: timeStr,
                    temp: tempNum,
                    user: 'Staff User',
                    tempImg: tempImg || undefined,
                    signature: signature || undefined,
                    comments: comments || undefined
                };
                return { ...e, status: 'MONITORED', monitoringLogs: [...(e.monitoringLogs || []), newLog] };
            }
            if (actionStage === 'COMPLETE') {
                return { ...e, status: 'COMPLETED', terminalTime: timeStr, terminalTemp: tempNum, terminalTempImg: tempImg || undefined, operatorName: 'Staff Operator', operatorSignature: signature, operatorComments: comments };
            }
            if (actionStage === 'VERIFY') {
                return { ...e, isVerified: true, verifierName: 'QA Auditor', verifierSignature: signature, verifierComments: comments, verificationDate: new Date().toLocaleString() };
            }
            return e;
        }));
    }

    setIsActionModalOpen(false);
    setSelectedEntry(null);
    setActionStage(null);
  };

  // --- ISO 22000 PDF EXPORT ENGINE (ULTRA-CRISP DESIGN) ---
  const generatePDFForEntries = async (targetEntries: ExtendedFoodHoldingEntry[], filename: string) => {
    setIsGeneratingPDF(true);
    
    const printArea = document.createElement('div');
    printArea.style.position = 'fixed';
    printArea.style.top = '-9999px';
    printArea.style.left = '0';
    printArea.style.width = '1200px'; 
    printArea.style.backgroundColor = 'white';
    printArea.style.padding = '0';
    printArea.style.fontFamily = 'Arial, Helvetica, sans-serif';
    printArea.style.color = '#1e293b';

    const securityId = `CERT-HOLD-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const downloadTimestamp = new Date().toLocaleString();

    let htmlContent = `
        <div style="padding: 50px; background: #fff; min-height: 1200px; display: flex; flex-direction: column; position: relative;">
            <!-- WATERMARK -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 120px; font-weight: 900; color: rgba(226, 232, 240, 0.4); pointer-events: none; text-transform: uppercase; z-index: 0; white-space: nowrap;">Controlled Record</div>

            <!-- CONTROLLED HEADER -->
            <div style="border: 2px solid #1e293b; margin-bottom: 25px; position: relative; z-index: 10; background: #fff;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 15%; padding: 15px; border-right: 2px solid #1e293b; text-align: center;">
                            <div style="width: 60px; height: 60px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                                ${logoSrc ? `<img src="${logoSrc}" style="max-width: 60px; max-height: 60px; object-fit: contain;" />` : renderToString(<Logo className="w-16 h-16" />)}
                            </div>
                        </td>
                        <td style="width: 55%; padding: 15px; border-right: 2px solid #1e293b;">
                            <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; color: #0f172a;">${(activeEntity?.name || 'HACCP PRO ENTERPRISE SYSTEMS').toUpperCase()}</div>
                            <div style="font-size: 14px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 1px;">Food Holding Control Registry</div>
                            <div style="font-size: 11px; margin-top: 8px; font-weight: 600; color: #64748b;">${[activeEntity?.address || activeEntity?.location, entities.find((e: any) => e.id === activeEntity?.parentId)?.name].filter(Boolean).join('  |  ') || ''}</div>
                        </td>
                        <td style="width: 30%; padding: 0;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-weight: 700;">
                                    <tr><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; background: #f8fafc; color: #64748b;">Doc Ref:</td><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b;">${docControlData.docRef}</td></tr>
                                    <tr><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b; background: #f8fafc; color: #64748b;">Revision:</td><td style="padding: 6px 12px; border-bottom: 1px solid #1e293b;">v${docControlData.version}</td></tr>
                                    <tr><td style="padding: 6px 12px; background: #f8fafc; color: #64748b;">Effective:</td><td style="padding: 6px 12px;">${docControlData.effectiveDate}</td></tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- TABLE SECTION -->
            <div style="flex: 1; position: relative; z-index: 10;">
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px;">
                    <thead>
                        <tr style="background: #1e293b; color: white; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;">
                            <th style="padding: 12px; text-align: left;">Registry Identity</th>
                            <th style="padding: 12px; text-align: left;">Process Telemetry</th>
                            <th style="padding: 12px; text-align: left;">Ancestry & Path</th>
                            <th style="padding: 12px; text-align: center;">Identity Passport (QR)</th>
                            <th style="padding: 12px; text-align: left;">Authorization</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${targetEntries.map(e => {
                            const qrPayload = `HOLDING_VERIFIED_RECORD\nID:${e.uuid}\nPRODUCT:${e.productName}\nBATCH:${e.batchNumber}\nTYPE:${e.type}\nSTART:${e.startTime || 'N/A'}\nEND:${e.terminalTime || 'N/A'}\nVERIFIER:${e.verifierName || 'PENDING'}`;
                            
                            return `
                            <tr style="font-size: 10px; border-bottom: 1px solid #e2e8f0; background: #fff;">
                                <td style="padding: 12px; border-right: 1px solid #e2e8f0;">
                                    <div style="font-weight: 800; color: #0f172a;">${e.productName}</div>
                                    <div style="font-size: 8px; color: #64748b; margin-top: 4px; font-weight: 700;">BATCH: ${e.batchNumber}</div>
                                    <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">TYPE: ${e.type} HOLD | DATE: ${e.date}</div>
                                </td>
                                <td style="padding: 12px; border-right: 1px solid #e2e8f0;">
                                    <div style="font-weight: 700;">Status: ${e.status}</div>
                                    <div style="font-size: 8px; color: #4f46e5; margin-top: 4px; font-weight: 800;">Initial Temp: ${e.startTemp || '---'}°C</div>
                                    <div style="font-size: 8px; color: #10b981; margin-top: 2px; font-weight: 800;">Terminal Temp: ${e.terminalTemp || '---'}°C</div>
                                    <div style="font-size: 8px; color: #64748b; margin-top: 4px; font-weight: 700;">Monitoring Logs: ${e.monitoringLogs?.length || 0} checks</div>
                                </td>
                                <td style="padding: 12px; border-right: 1px solid #e2e8f0;">
                                    <div style="font-weight: 700;">Unit: ${e.unitName}</div>
                                    <div style="font-weight: 900; color: #4f46e5; margin-top: 2px;">Location: ${e.locationName}</div>
                                    <div style="font-size: 8px; color: #94a3b8; margin-top: 4px;">Dept: ${e.departmentName}</div>
                                </td>
                                <td style="padding: 12px; border-right: 1px solid #e2e8f0; text-align: center; vertical-align: middle;">
                                    <div style="display: inline-block; background: #fff; padding: 8px; border: 1px solid #e2e8f0; border-radius: 10px;">
                                        <div style="width: 80px; height: 80px;">
                                            ${renderToString(<QRCodeSVG value={qrPayload} size={80} level="H" includeMargin={false} />)}
                                        </div>
                                    </div>
                                    <div style="font-size: 6px; color: #94a3b8; margin-top: 6px; font-weight: 900; text-transform: uppercase;">Scan for Process Genealogy</div>
                                </td>
                                <td style="padding: 12px;">
                                    <div style="margin-bottom: 8px;">
                                        <div style="font-weight: 800; color: #64748b; font-size: 8px;">OPERATOR</div>
                                        <div style="font-weight: 800; color: #0f172a;">${e.operatorName || 'System'}</div>
                                    </div>
                                    ${e.isVerified ? `
                                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px; border-radius: 4px;">
                                            <div style="font-weight: 800; color: #059669; font-size: 8px;">QA AUTHORIZED</div>
                                            <div style="font-weight: 900; color: #064e3b;">${e.verifierName}</div>
                                        </div>
                                    ` : `
                                        <div style="font-size: 8px; color: #f59e0b; font-weight: 900;">AWAITING AUTH</div>
                                    `}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>

            <!-- FOOTER -->
            <div style="margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 20px;">
                <div style="display: flex; gap: 30px; margin-bottom: 25px;">
                    <div style="flex: 1; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #f8fafc;">
                        <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Registry Intake Signature</div>
                        <div style="border-bottom: 1px solid #cbd5e1; height: 30px;"></div>
                    </div>
                    <div style="flex: 1; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #f8fafc;">
                        <div style="font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Audit Verification Node</div>
                        <div style="border-bottom: 1px solid #cbd5e1; height: 30px;"></div>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">
                    <div>System Timestamp: ${downloadTimestamp}</div>
                    <div>Electronic Integrity Hash: ${securityId}</div>
                </div>
            </div>
        </div>
    `;

    printArea.innerHTML = htmlContent;
    document.body.appendChild(printArea);

    try {
        const canvas = await html2canvas(printArea, { 
            scale: 3.5, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false
        });
        
        // Added missing dynamic import for jsPDF to fix "Cannot find name 'jsPDF'" error.
        const { jsPDF } = await import('jspdf');

        const pdf = new jsPDF('l', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
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

        savePdfForPWA(pdf, filename);
    } catch (err) {
        console.error("Registry Export failed", err);
    } finally {
        document.body.removeChild(printArea);
        setIsGeneratingPDF(false);
    }
  };

  const handleExportSinglePDF = async (entry: ExtendedFoodHoldingEntry) => {
    const filename = `Food_Holding_Record_${entry.uuid}_${new Date().toISOString().split('T')[0]}.pdf`;
    await generatePDFForEntries([entry], filename);
  };

  const handleGlobalExportPDF = async () => {
    if (filteredData.length === 0) return;
    const filename = `Complete_Holding_Registry_${new Date().toISOString().split('T')[0]}.pdf`;
    await generatePDFForEntries(filteredData, filename);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 p-4 md:p-0">
      {/* Dashboard Section */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col lg:flex-row gap-6 items-stretch lg:items-center overflow-hidden">
        <div className="flex-1 flex overflow-x-auto hide-scrollbar snap-x gap-4">
            {[
                { label: 'Holding Matrix', val: stats.total, color: 'bg-slate-900', id: 'ALL', icon: Database },
                { label: 'Hot Flow', val: stats.hot, color: 'bg-orange-600', id: 'HOT', icon: Flame },
                { label: 'Cold Flow', val: stats.cold, color: 'bg-blue-600', id: 'COLD', icon: Snowflake },
                { label: 'Active Monitor', val: stats.inFlow, color: 'bg-indigo-600', id: 'MONITOR', icon: Timer },
                { label: 'Verification Due', val: stats.dueVerify, color: 'bg-rose-50', id: 'VERIFY', icon: ShieldAlert },
                { label: 'Verified History', val: stats.verified, color: 'bg-emerald-500', id: 'HISTORY', icon: CheckCircle2 }
            ].map((c, i) => (
                <button 
                    key={i} 
                    onClick={() => setActiveFilter(c.id as any)}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-center text-left min-w-[140px] snap-center ${activeFilter === c.id ? 'bg-white border-indigo-600 shadow-lg ring-4 ring-indigo-50' : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'}`}
                >
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{c.label}</p>
                    <div className="flex items-center gap-3">
                        <p className="text-xl font-black text-slate-900">{c.val}</p>
                        <div className={`w-2 h-2 rounded-full ${c.color}`} />
                    </div>
                </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 lg:pl-6 lg:border-l border-slate-200 justify-center sm:justify-end">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 shadow-inner">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 hidden sm:inline">Range:</span>
                <input type="date" className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-20 sm:w-24 uppercase cursor-pointer" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span className="text-slate-300 font-bold">-</span>
                <input type="date" className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-20 sm:w-24 uppercase cursor-pointer" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="ml-1 text-slate-400 hover:text-rose-500 transition-colors"><XCircle size={14} /></button>}
            </div>
            <div className="relative group w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input type="text" placeholder="Search registry..." className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 transition-all shadow-inner uppercase tracking-wider" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={handleSelectAll} disabled={selectableEntries.length === 0} className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all shadow-sm active:scale-95 ${areAllSelectableSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'} ${selectableEntries.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`} title="Select All Eligible for Verification">
                 {areAllSelectableSelected ? <CheckSquare size={20} /> : <Square size={20} />}
            </button>
            <div className="flex gap-2">
                {selectedIds.size > 0 && (
                    <button onClick={handleBulkVerifyClick} className="px-5 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 animate-in zoom-in">
                        <ShieldCheck size={18} /> Verify ({selectedIds.size})
                    </button>
                )}
                <button onClick={handleGlobalExportPDF} disabled={isGeneratingPDF} className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 transition-all shadow-sm active:scale-95">
                    {isGeneratingPDF ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                </button>
                <button onClick={handleNewBatch} className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center gap-2">
                    <Plus size={18} strokeWidth={3} /> <span className="hidden sm:inline">New Batch</span>
                </button>
            </div>
        </div>
      </div>

      {/* Main Registry Data */}
      <div className="flex flex-col gap-6">
        {paginatedData.map((row) => {
            const isReady = row.status === 'READY';
            const isInitiated = row.status === 'INITIATED';
            const isMonitored = row.status === 'MONITORED';
            const isCompleted = row.status === 'COMPLETED';
            const isVerified = row.isVerified;
            const hasLogs = row.monitoringLogs && row.monitoringLogs.length > 0;
            const isSelected = selectedIds.has(row.uuid);
            const isExpanded = expandedMobileId === row.uuid;
            const canSelect = isEntrySelectable(row);

            // Digital Passport Data
            const qrData = JSON.stringify({
                id: row.uuid,
                product: row.productName,
                batch: row.batchNumber,
                status: row.status,
                type: row.type,
                start: row.startTime,
                temp: row.startTemp,
                verified: row.isVerified
            });

            return (
                <div key={row.uuid} className={`relative bg-white rounded-[1.5rem] md:rounded-[3.5rem] border-2 transition-all duration-500 flex flex-col lg:flex-row group overflow-hidden ${row.status === 'INITIATED' ? 'border-indigo-400 shadow-2xl scale-[1.01]' : isSelected ? 'border-indigo-600 bg-indigo-50/10 shadow-md' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
                    <div className="flex flex-col lg:flex-row items-stretch divide-y lg:divide-y-0 lg:divide-x divide-slate-100 w-full">
                        
                        {/* 1. Identity & Location Hub */}
                        <div className="p-6 md:p-8 lg:w-[22%] flex flex-col justify-center bg-slate-50/20 shrink-0 relative">
                            {canSelect && (
                                <div className="absolute top-6 left-6 z-10">
                                    <button onClick={() => toggleSelectOne(row.uuid)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 hover:border-indigo-400'}`}>
                                        {isSelected && <Check size={12} strokeWidth={4} />}
                                    </button>
                                </div>
                            )}
                            <div className={`flex items-center gap-3 mb-6 ${canSelect ? 'pl-10' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg ${row.type === 'HOT' ? 'bg-orange-600' : 'bg-blue-600'}`}>
                                    {row.type === 'HOT' ? <Flame size={18} /> : <Snowflake size={18} />}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${row.type === 'HOT' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                    {row.type} HOLD
                                </span>
                            </div>
                            <div className={`space-y-1 ${canSelect ? 'pl-10' : ''}`}>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-800"><Calendar size={12} className="text-indigo-400" /> {row.date}</div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-2"><MapPin size={12} className="text-indigo-400" /> {row.locationName}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-5">{row.departmentName}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-5 pt-1 border-t border-slate-100 mt-2">{row.unitName} • {row.regionName}</div>
                            </div>
                        </div>

                        {/* 2. Initiation Node */}
                        <div className="p-6 md:p-8 lg:w-[20%] flex flex-col justify-center shrink-0">
                            <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                                <Play size={14} fill="currentColor" className="text-indigo-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Start</span>
                            </div>
                            <h4 className="text-base font-black text-slate-800 uppercase tracking-tight mb-4 truncate">{row.productName}</h4>
                            {isReady ? (
                                <button onClick={() => handleAction(row, 'INITIATE')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                    <Play size={14} fill="currentColor" /> Initiate Holding
                                </button>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Start</span>
                                            <span className="text-11px font-black text-slate-800">{row.startTime}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Temp</span>
                                            <span className={`text-12px font-black ${row.type === 'HOT' ? 'text-orange-600' : 'text-blue-600'}`}>{row.startTemp}°C</span>
                                        </div>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                                        {row.startTempImg ? <img src={row.startTempImg} className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-slate-200" />}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* QR Code Identification Column */}
                        <div className="hidden lg:flex p-6 md:p-8 lg:w-[12%] flex flex-col justify-center items-center bg-white shrink-0">
                            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col items-center gap-3 shadow-inner group/qr transition-all hover:bg-indigo-50 hover:border-indigo-200">
                                <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                                    <QRCodeSVG value={qrData} size={56} level="H" includeMargin={false} />
                                </div>
                                <div className="text-center">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/qr:text-indigo-600 transition-colors">Digital ID</p>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Action Hub */}
                        <div className="lg:hidden p-4 bg-slate-50 border-t border-b border-slate-100 flex items-center justify-between">
                            <div className="flex-1 pr-4 flex gap-2 overflow-x-auto hide-scrollbar">
                                {(isInitiated || isMonitored) && (
                                    <button onClick={() => handleAction(row, 'MONITOR')} className="flex-1 py-3 px-4 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                                        <Timer size={14} /> Log Check
                                    </button>
                                )}
                                {(isMonitored || (hasLogs && !isCompleted)) && (
                                    <button onClick={() => handleAction(row, 'COMPLETE')} className="flex-1 py-3 px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                                        <Zap size={14} fill="currentColor" /> Finalize
                                    </button>
                                )}
                                {isCompleted && !isVerified && (
                                    <button onClick={() => handleAction(row, 'VERIFY')} className="flex-1 py-3 px-4 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                                        <ShieldCheck size={14} /> Authorize
                                    </button>
                                )}
                                {isVerified && (
                                    <div className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 whitespace-nowrap">
                                        <CheckCircle2 size={14} /> Verified
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setExpandedMobileId(isExpanded ? null : row.uuid)} className={`w-10 h-10 flex shrink-0 items-center justify-center rounded-xl border transition-all ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>
                                <ChevronDown size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Collapsible Content Hub */}
                        <div className={`${isExpanded ? 'block' : 'hidden lg:flex'} lg:contents`}>
                            {/* Monitoring Node */}
                            <div className="p-6 md:p-8 lg:w-[22%] flex flex-col justify-center bg-slate-50/10 shrink-0">
                                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                                    <Clock size={14} className="text-indigo-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodic Checks</span>
                                </div>
                                <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                    {hasLogs ? row.monitoringLogs.map((log) => (
                                        <div key={log.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-800">{log.time}</span>
                                                <span className={`text-12px font-black ${row.type === 'HOT' ? 'text-orange-600' : 'text-blue-600'}`}>{log.temp}°C</span>
                                            </div>
                                            {log.comments && <p className="text-[9px] text-slate-500 italic bg-slate-50 p-1 rounded leading-tight">"{log.comments}"</p>}
                                        </div>
                                    )) : <div className="py-4 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Monitoring Void</div>}
                                </div>
                            </div>

                            {/* Terminal Hub */}
                            <div className="p-6 md:p-8 lg:w-[15%] flex flex-col justify-center shrink-0">
                                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                                    <CheckCheck size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terminal Final</span>
                                </div>
                                {isCompleted ? (
                                    <div className="space-y-3">
                                        <div className="bg-slate-900 rounded-2xl p-3 text-white shadow-lg">
                                            <div className="flex justify-between text-[7px] font-black uppercase mb-0.5"><span>Final</span><span>{row.terminalTime}</span></div>
                                            <div className="text-lg font-black tracking-tighter">{row.terminalTemp}°C</div>
                                        </div>
                                        <div className="text-[10px] font-black text-slate-800 uppercase truncate">By: {row.operatorName}</div>
                                    </div>
                                ) : <div className="py-6 text-center opacity-10 grayscale scale-90"><ShieldAlert size={32} className="mx-auto" /></div>}
                            </div>

                            {/* Verification Hub */}
                            <div className="p-8 flex flex-col justify-center lg:flex-1 bg-slate-50/30">
                                {isVerified ? (
                                    <div className="space-y-4 animate-in zoom-in-95 duration-300 flex flex-col items-center lg:items-end">
                                        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-[2.5rem] p-5 shadow-xl relative overflow-hidden w-full max-w-[280px]">
                                             <div className="flex justify-between items-center mb-4 border-b border-emerald-200/50 pb-2">
                                                 <div className="flex items-center gap-2">
                                                     <ShieldCheck size={16} className="text-emerald-600" />
                                                     <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Audit Pass</span>
                                                 </div>
                                                 <span className="text-[9px] font-black text-emerald-700">{row.verificationDate?.split(' ')[0]}</span>
                                             </div>
                                             <p className="text-xs font-black text-emerald-900 uppercase truncate">{row.verifierName}</p>
                                             <p className="text-[9px] text-emerald-700 italic mt-1">"{row.verifierComments || 'Log Synchronized'}"</p>
                                        </div>
                                        <button onClick={() => handleExportSinglePDF(row)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-white transition-all shadow-sm active:scale-95"><Download size={14}/> Export PDF</button>
                                    </div>
                                ) : isCompleted ? (
                                    <div className="p-5 text-center space-y-4 bg-amber-50/50 border-2 border-dashed border-amber-200 rounded-[2rem] w-full shadow-inner">
                                        <ShieldAlert size={32} className="text-amber-500 mx-auto animate-pulse" />
                                        <button onClick={() => handleAction(row, 'VERIFY')} className="w-full py-3.5 bg-amber-400 text-amber-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-amber-500 active:scale-95 transition-all">Authorize Log</button>
                                    </div>
                                ) : <div className="h-full flex items-center justify-center opacity-10 grayscale pointer-events-none scale-110"><ShieldAlert size={48} /></div>}
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      <UnifiedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredData.length}
        rowsPerPage={rowsPerPage}
        onPageChange={setCurrentPage}
        onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
      />

      {/* BOTTOM SHEET MODAL ARCHITECTURE FOR MOBILE */}
      {isActionModalOpen && (selectedEntry || (verificationMode === 'BULK' && selectedIds.size > 0)) && actionStage && (
          <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-xl rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in slide-in-from-bottom duration-300 md:zoom-in-95 h-[85vh] md:h-auto max-h-[90vh]">
                
                {/* Visual Handle for Mobile */}
                <div className="md:hidden w-full flex justify-center pt-3 pb-1 bg-white shrink-0"><div className="w-16 h-1.5 bg-slate-200 rounded-full" /></div>
                
                {/* Header Context */}
                <div className={`px-10 py-8 text-white flex justify-between items-center shrink-0 shadow-lg ${actionStage === 'VERIFY' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-white/20 rounded-2xl">{actionStage === 'INITIATE' ? <Play size={28} fill="currentColor" strokeWidth={3} /> : <ClipboardCheck size={28} />}</div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tight">{actionStage === 'INITIATE' ? 'Initiate Holding' : actionStage === 'MONITOR' ? 'Log Monitoring Check' : actionStage === 'COMPLETE' ? 'Terminal Completion' : verificationMode === 'BULK' ? 'Bulk Authorization' : 'Authority Verification'}</h3>
                            <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1.5">{verificationMode === 'BULK' ? `Approving ${selectedIds.size} Records` : 'Cycle Synchronization Point'}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsActionModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white"><X size={28} /></button>
                </div>

                {/* Form Body */}
                <div className="p-8 space-y-8 bg-slate-50/20 overflow-y-auto custom-scrollbar text-left flex-1 pb-safe">
                    {verificationMode === 'SINGLE' && selectedEntry && (
                        <div className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Material Node</p>
                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none truncate">{selectedEntry.productName}</h4>
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-50"><span className="text-[10px] font-mono font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">#{selectedEntry.batchNumber}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${selectedEntry.type === 'HOT' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>{selectedEntry.type} HOLD</span></div>
                        </div>
                    )}
                    <div className="space-y-6">
                        {actionStage !== 'VERIFY' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Thermometer size={14} className="text-rose-500" /> Temperature Reading (°C) <span className="text-red-500">*</span></label>
                                <div className="flex gap-2">
                                    <input autoFocus type="number" step="0.1" className="w-full h-16 md:h-18 p-4 bg-white border-2 border-slate-100 rounded-2xl text-2xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner text-center" placeholder="0.0" value={tempInput} onChange={e => setTempInput(e.target.value)} />
                                    <button type="button" onClick={() => cameraInputRef.current?.click()} className={`p-4 rounded-2xl transition-all border-2 shrink-0 ${tempImg ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}><Camera size={24}/></button>
                                    <input type="file" ref={cameraInputRef} capture="environment" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = async (event) => { const compressed = await compressImage(event.target?.result as string); setTempImg(compressed); }; reader.readAsDataURL(file); } }} />
                                </div>
                                {tempImg && <div className="mt-2 relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-sm animate-in zoom-in-95"><img src={tempImg} className="w-full h-full object-cover" /><button type="button" onClick={() => setTempImg(null)} className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1"><X size={10} strokeWidth={4} /></button></div>}
                            </div>
                        )}
                        {(actionStage === 'COMPLETE' || actionStage === 'VERIFY' || actionStage === 'MONITOR') && (
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><MessageSquare size={14} className="text-indigo-500" /> Remarks & Observations</label><textarea className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:border-indigo-400 outline-none resize-none h-24 shadow-inner" placeholder="Enter findings..." value={comments} onChange={e => setComments(e.target.value)} /></div>
                        )}
                        {(actionStage === 'COMPLETE' || actionStage === 'VERIFY' || actionStage === 'MONITOR') && (
                            <SignaturePad onSave={setSignature} label={actionStage === 'VERIFY' ? "Authority Signature" : "Operator Signature"} />
                        )}
                    </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3 shrink-0 pb-safe">
                    <button onClick={() => setIsActionModalOpen(false)} className="px-10 py-4 text-[11px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all tracking-widest order-2 sm:order-1">Discard</button>
                    <button disabled={(actionStage === 'INITIATE' || actionStage === 'MONITOR') ? !tempInput : (actionStage === 'COMPLETE' || actionStage === 'VERIFY') ? !signature : false} onClick={commitAction} className={`px-16 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 order-1 sm:order-2 ${((actionStage === 'INITIATE' || actionStage === 'MONITOR') && tempInput) || ((actionStage === 'COMPLETE' || actionStage === 'VERIFY') && signature) ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}><CheckCheck size={20} strokeWidth={3} /> {actionStage === 'VERIFY' ? 'Authorize Registry' : 'Commit Telemetry'}</button>
                </div>
            </div>
          </div>
      )}

      {/* NEW BATCH MODAL */}
      {isNewBatchModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100 h-[92vh] md:h-auto md:max-h-[85vh] animate-in slide-in-from-bottom duration-300 md:zoom-in-95">
                <div className="md:hidden w-full flex justify-center pt-3 pb-1 bg-white shrink-0"><div className="w-16 h-1.5 bg-slate-200 rounded-full" /></div>
                <div className="px-6 md:px-8 py-5 md:py-6 bg-white border-b border-slate-50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4"><div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><Plus size={24} /></div><div><h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900">New Holding Batch</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Initiate Tracking</p></div></div>
                    <button onClick={() => setIsNewBatchModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6 bg-slate-50/30 text-left">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Name</label><input autoFocus value={newBatchForm.productName} onChange={(e) => setNewBatchForm({...newBatchForm, productName: e.target.value})} className="w-full h-14 px-5 bg-white border-2 border-slate-100 rounded-2xl text-sm font-black uppercase outline-none focus:border-indigo-500 shadow-sm transition-all" placeholder="ENTER ITEM NAME..." /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number</label><input value={newBatchForm.batchNumber} onChange={(e) => setNewBatchForm({...newBatchForm, batchNumber: e.target.value})} className="w-full h-14 px-5 bg-white border-2 border-slate-100 rounded-2xl text-sm font-mono font-bold text-slate-600 outline-none focus:border-indigo-500 shadow-sm uppercase transition-all" placeholder="E.G. B-001" /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Process Type</label><div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setNewBatchForm({...newBatchForm, type: 'HOT'})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${newBatchForm.type === 'HOT' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-50 hover:text-slate-800'}`}>Hot</button><button onClick={() => setNewBatchForm({...newBatchForm, type: 'COLD'})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${newBatchForm.type === 'COLD' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-50 hover:text-slate-800'}`}>Cold</button></div></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dietary Class</label><div className="flex bg-slate-100 p-1 rounded-xl"><button onClick={() => setNewBatchForm({...newBatchForm, dietaryType: 'Veg'})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${newBatchForm.dietaryType === 'Veg' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-50 hover:text-slate-800'}`}>Veg</button><button onClick={() => setNewBatchForm({...newBatchForm, dietaryType: 'Non-Veg'})} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${newBatchForm.dietaryType === 'Non-Veg' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-50 hover:text-slate-800'}`}>Non-Veg</button></div></div></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks</label><textarea className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none resize-none h-24 shadow-sm focus:border-indigo-400 transition-all" placeholder="Initial comments..." value={newBatchForm.comments} onChange={e => setNewBatchForm({...newBatchForm, comments: e.target.value})} /></div>
                    <SignaturePad onSave={(s) => setNewBatchForm({...newBatchForm, signature: s})} label="Start Authorization" />
                </div>
                <div className="px-6 md:px-8 py-5 md:py-6 border-t border-slate-100 bg-white flex flex-col-reverse md:flex-row justify-end gap-3 shrink-0 pb-8 md:pb-6">
                    <button onClick={() => setIsNewBatchModalOpen(false)} className="w-full md:w-auto px-8 py-3.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all rounded-xl hover:bg-slate-50">Cancel</button>
                    <button onClick={confirmNewBatch} disabled={!newBatchForm.productName || !newBatchForm.signature} className="w-full md:w-auto px-10 py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Check size={16} strokeWidth={3} /> Create Record</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FoodHoldingRecord;