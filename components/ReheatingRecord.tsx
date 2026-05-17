
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    RefreshCw, 
    Search, 
    Filter, 
    Plus, 
    Clock, 
    Thermometer, 
    CheckCircle2, 
    User, 
    ArrowRight, 
    AlertTriangle, 
    Building2, 
    MapPin, 
    Package, 
    Utensils, 
    ChevronRight, 
    Trash2, 
    Edit, 
    ShieldCheck, 
    History,
    Activity,
    ClipboardCheck,
    Hourglass,
    FileSpreadsheet,
    Zap,
    Play,
    CheckCheck,
    Globe,
    Flame,
    Check,
    Snowflake,
    Droplets,
    X,
    PenTool,
    Eraser,
    MessageSquare,
    UserCheck,
    Timer,
    Camera,
    Info,
    Download,
    Loader2,
    ChevronsLeft,
    ChevronLeft,
    ChevronsRight,
    TrendingUp,
    XCircle,
    QrCode,
    Save,
    ChevronDown,
    BarChart3,
    AlertCircle,
    Square,
    CheckSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToString } from 'react-dom/server';
import Logo from './Logo';
import { compressImage, compressForPdf, compressSignatureForPdf } from '@/utils/imageCompression';
import { savePdfForPWA } from '@/utils/pdfDownload';
import { drawPdfHeader, resolveEntityLogoSrc } from '@/utils/pdfHeader';
import UnifiedPagination from './UnifiedPagination';

interface ReheatedItem {
    purpose: string;
    quantity: number;
}

interface ReheatingEntry {
    uuid: string;
    status: 'READY' | 'IN_PROGRESS' | 'DUE_VERIFICATION' | 'COMPLETED';
    corporate: string;
    regional: string;
    unit: string;
    department: string;
    location: string;
    productName: string;
    category: string;
    sourceProductName: string;
    batchNumber: string;
    standardRecipe: string;
    reheatingVessel: string;
    reheatingQuantity: number;
    method: string;
    reheatStart: string;
    reheatCompleted: string;
    initialTemp: number;
    duration: string;
    completedBy: string;
    reheatingPurpose: string;
    correctiveAction?: string;
    verifierName?: string;
    verificationComments?: string;
    verifierSignature?: string;
    issued: ReheatedItem[];
    thawTime: string;
    cookTime: string;
    cookTemp: number;
    coolTime: string;
    coolTemp: number;
    completedBySign?: string;
    mfgDate?: string;
    expDate?: string;
    tempImageSrc?: string;
}

// --- ISO 22000 Types ---
interface DocControlInfo {
    docRef: string;
    version: string;
    effectiveDate: string;
    approvedBy: string;
}

const SignaturePad: React.FC<{ onSave: (data: string) => void, initialData?: string, label?: string }> = ({ onSave, initialData, label = "Authorized Signature" }) => {
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
                <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={96} 
                    className="w-full h-full"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchEnd={stopDrawing}
                    onTouchMove={draw}
                />
                {!initialData && !isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                        <span className="text-3xl font-black uppercase -rotate-6 select-none tracking-tighter">Sign to Authenticate</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const PURPOSES = ["Hold and Serve", "Direct issue for cooking", "Chill and store"];
const OVEN_NUMBERS = ["OVEN-01", "OVEN-02", "OVEN-03", "OVEN-04", "RANGE-01", "GRILL-01"];

const MOCK_REHEATING_DATA: ReheatingEntry[] = Array.from({ length: 50 }).map((_, i) => {
    const statuses: ReheatingEntry['status'][] = ['READY', 'IN_PROGRESS', 'DUE_VERIFICATION', 'COMPLETED'];
    const status = statuses[i % 4];
    const isCompleted = status === 'COMPLETED';
    const isNotStarted = status === 'READY';
    
    return {
        uuid: `reheat-${100 + i}`,
        status,
        corporate: "FoodCorp",
        regional: "North America",
        unit: "NYC Central Kitchen",
        department: "Main Kitchen",
        location: `Station ${i % 5 + 1}`,
        productName: i % 2 === 0 ? "GRILLED CHICKEN BREAST" : "BLACK ANGUS BEEF PATTIES",
        category: i % 2 === 0 ? "Poultry" : "Beef",
        sourceProductName: i % 2 === 0 ? "Raw Chicken Breast" : "Raw Beef",
        batchNumber: `BT-RE-00${i + 1}-X`,
        standardRecipe: i % 2 === 0 ? "SOP-P-001" : "SOP-B-005",
        reheatingVessel: isNotStarted ? "" : "OVEN-01",
        reheatingQuantity: 5.5 + i,
        method: isNotStarted ? "" : "Blast Oven Reheat",
        reheatStart: isNotStarted ? "" : new Date(Date.now() - (4 * 3600000)).toISOString(),
        reheatCompleted: isCompleted || status === 'DUE_VERIFICATION' ? new Date(Date.now() - (3 * 3600000)).toISOString() : "",
        initialTemp: isNotStarted ? 0 : 4.2,
        duration: isNotStarted ? "" : "18m 30s",
        completedBy: isNotStarted ? "" : "Chef Alex",
        reheatingPurpose: "Hold and Serve",
        correctiveAction: i === 4 ? "Temperature threshold low, extended cycle by 5m." : "",
        verifierName: isCompleted ? "Jane Smith (QA)" : "",
        verificationComments: isCompleted ? "Temperature verified. Critical limits met." : "",
        issued: isCompleted ? [{ purpose: "Main Service", quantity: 5 }] : [],
        thawTime: "2025-08-11 09:00 AM",
        cookTime: "2025-08-11 02:00 PM",
        cookTemp: 92,
        coolTime: "2025-08-11 05:00 PM",
        coolTemp: 3.5,
        mfgDate: '2025-01-10',
        expDate: '2025-06-10'
    };
});

const buildReheatingQRUrl = (e: ReheatingEntry): string => {
    const data: Record<string, unknown> = {
        pn: e.productName, src: e.sourceProductName, cat: e.category, bn: e.batchNumber,
        sr: e.standardRecipe, rv: e.reheatingVessel, rq: e.reheatingQuantity, mt: e.method,
        rs: e.reheatStart, rc: e.reheatCompleted, it: e.initialTemp,
        du: e.duration, cb: e.completedBy, rp: e.reheatingPurpose, ca: e.correctiveAction,
        ut: e.unit, dp: e.department, lo: e.location, co: e.corporate, rg: e.regional,
        tt: e.thawTime, ct: e.cookTime, ck: e.cookTemp, cl: e.coolTime, cp: e.coolTemp,
        md: e.mfgDate, ed: e.expDate, st: e.status,
        vf: e.verifierName ? 1 : 0,
    };
    if (e.verifierName) data.vn = e.verifierName;
    if (e.verificationComments) data.vc = e.verificationComments;
    if (e.issued && e.issued.length > 0) data.iss = e.issued.map(i => `${i.purpose}:${i.quantity}`).join('|');
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/reheat-record?d=${encoded}`;
};

const renderQRToCanvas = (qrString: string): Promise<string> => {
    return new Promise((resolve) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '-9999px';
        document.body.appendChild(container);
        container.innerHTML = renderToString(<QRCodeSVG value={qrString} size={100} level="L" />);
        const svgEl = container.querySelector('svg');
        if (!svgEl) { document.body.removeChild(container); resolve(''); return; }
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement('canvas');
        canvas.width = 100; canvas.height = 100;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx?.drawImage(img, 0, 0, 100, 100);
            const dataUrl = canvas.toDataURL('image/png');
            document.body.removeChild(container);
            resolve(dataUrl);
        };
        img.onerror = () => { document.body.removeChild(container); resolve(''); };
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        img.src = URL.createObjectURL(svgBlob);
    });
};

interface ReheatingRecordProps {
    entities?: any[];
    userRootId?: string | null;
}

const ReheatingRecord: React.FC<ReheatingRecordProps> = ({ entities = [], userRootId }) => {
    const [entries, setEntries] = useState<ReheatingEntry[]>(MOCK_REHEATING_DATA);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<ReheatingEntry['status'] | 'all'>('all');
    const [now, setNow] = useState(Date.now());
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    
    // ISO 22000 Doc Control State
    const [docControlData] = useState<DocControlInfo>({
        docRef: 'REH-RGST-01',
        version: '1.2',
        effectiveDate: new Date().toISOString().split('T')[0],
        approvedBy: 'Quality Assurance Director'
    });

    const unitName = useMemo(() => {
        if (!entities?.length || !userRootId) return 'HACCP PRO ENTERPRISE SYSTEMS';
        const unit = entities.find((e: any) => e.id === userRootId);
        return unit?.name?.toUpperCase() || 'HACCP PRO ENTERPRISE SYSTEMS';
    }, [entities, userRootId]);

    const unitSubtitle = useMemo(() => {
        if (!entities?.length || !userRootId) return '';
        const unit = entities.find((e: any) => e.id === userRootId);
        if (!unit) return '';
        const parts: string[] = [];
        if (unit.address) parts.push(unit.address);
        else if (unit.location) parts.push(unit.location);
        const parent = unit.parentId ? entities.find((e: any) => e.id === unit.parentId) : null;
        if (parent?.name) parts.push(parent.name);
        return parts.join('  |  ');
    }, [entities, userRootId]);

    const logoSrc = useMemo(() => resolveEntityLogoSrc(entities, userRootId), [entities, userRootId]);

    // Date Filters
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    
    const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<ReheatingEntry | null>(null);
    const [tempInput, setTempInput] = useState("");
    const [vesselInput, setVesselInput] = useState("OVEN-01");
    const [signature, setSignature] = useState("");
    const [tempImage, setTempImage] = useState<string>("");
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [verifyEntry, setVerifyEntry] = useState<ReheatingEntry | null>(null);
    const [verifyComments, setVerifyComments] = useState("");
    const [verifySignature, setVerifySignature] = useState("");

    const [selectedForVerify, setSelectedForVerify] = useState<Set<string>>(new Set());
    const [isBulkVerify, setIsBulkVerify] = useState(false);
    const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => ({
        total: entries.length,
        ready: entries.filter(r => r.status === 'READY').length,
        inProgress: entries.filter(r => r.status === 'IN_PROGRESS').length,
        dueVerify: entries.filter(r => r.status === 'DUE_VERIFICATION').length,
        completed: entries.filter(r => r.status === 'COMPLETED').length,
        avgPerDay: (entries.length / 7).toFixed(1),
    }), [entries]);

    const filteredData = useMemo(() => {
        return entries.filter(r => {
            const matchesSearch = r.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                r.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter = activeFilter === 'all' || r.status === activeFilter;

            let matchesDate = true;
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                fromDate.setHours(0,0,0,0);
                if (!r.reheatStart) matchesDate = false;
                else if (new Date(r.reheatStart) < fromDate) matchesDate = false;
            }
            if (dateTo && matchesDate) {
                const toDate = new Date(dateTo);
                toDate.setHours(23,59,59,999);
                if (!r.reheatStart) matchesDate = false;
                else if (new Date(r.reheatStart) > toDate) matchesDate = false;
            }

            return matchesSearch && matchesFilter && matchesDate;
        });
    }, [searchTerm, activeFilter, entries, dateFrom, dateTo]);

    // Pagination Logic
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    const formatTimeDisplay = (iso?: string) => {
        if (!iso) return "---";
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatLapse = (start: string, end?: string) => {
        if (!start) return "--:--";
        const sTime = new Date(start).getTime();
        const eTime = end ? new Date(end).getTime() : now;
        const diff = Math.max(0, eTime - sTime);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const hStr = hours > 0 ? `${hours}h ` : '';
        return `${hStr}${mins}m ${secs}s`;
    };

    const handleInitiateClick = (entry: ReheatingEntry) => {
        setSelectedEntry(entry);
        setTempInput("");
        setSignature("");
        setTempImage("");
        setIsInitiateModalOpen(true);
    };

    const handleTempCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const compressed = await compressImage(event.target?.result as string);
                setTempImage(compressed);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const commitInitiation = () => {
        if (!selectedEntry || !tempInput || !signature) return;
        setEntries(prev => prev.map(e => {
            if (e.uuid !== selectedEntry.uuid) return e;
            return {
                ...e,
                status: 'IN_PROGRESS',
                reheatStart: new Date().toISOString(),
                initialTemp: parseFloat(tempInput),
                reheatingVessel: vesselInput,
                completedBy: "Staff Operator",
                tempImageSrc: tempImage || undefined,
                completedBySign: signature
            };
        }));
        setIsInitiateModalOpen(false);
        setSelectedEntry(null);
    };

    const hasElapsed15Seconds = (reheatStart: string) => {
        if (!reheatStart) return false;
        const elapsed = now - new Date(reheatStart).getTime();
        return elapsed >= 15000;
    };

    const handleEndProcessClick = (entry: ReheatingEntry) => {
        const endTime = Date.now();
        const startTime = new Date(entry.reheatStart).getTime();
        const diff = Math.max(0, endTime - startTime);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const hStr = hours > 0 ? `${hours}h ` : '';
        setEntries(prev => prev.map(e => {
            if (e.uuid !== entry.uuid) return e;
            return {
                ...e,
                status: 'DUE_VERIFICATION' as const,
                reheatCompleted: new Date().toISOString(),
                duration: `${hStr}${mins}m ${secs}s`
            };
        }));
    };

    const handleVerifyClick = (entry: ReheatingEntry) => {
        setVerifyEntry(entry);
        setIsBulkVerify(false);
        setVerifyComments("");
        setVerifySignature("");
        setIsVerifyModalOpen(true);
    };

    const handleBulkVerifyClick = () => {
        setVerifyEntry(null);
        setIsBulkVerify(true);
        setVerifyComments("");
        setVerifySignature("");
        setIsVerifyModalOpen(true);
    };

    const toggleVerifySelection = (uuid: string) => {
        setSelectedForVerify(prev => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const selectAllDueVerification = () => {
        const dueIds = paginatedData.filter(e => e.status === 'DUE_VERIFICATION').map(e => e.uuid);
        setSelectedForVerify(prev => {
            const allSelected = dueIds.every(id => prev.has(id));
            const next = new Set(prev);
            if (allSelected) {
                dueIds.forEach(id => next.delete(id));
            } else {
                dueIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const commitVerification = () => {
        if (!verifySignature) return;
        if (isBulkVerify && selectedForVerify.size === 0) return;
        if (isBulkVerify) {
            setEntries(prev => prev.map(e => {
                if (!selectedForVerify.has(e.uuid)) return e;
                return {
                    ...e,
                    status: 'COMPLETED' as const,
                    verifierName: 'QA Officer',
                    verificationComments: verifyComments,
                    verifierSignature: verifySignature
                };
            }));
            setSelectedForVerify(new Set());
        } else if (verifyEntry) {
            setEntries(prev => prev.map(e => {
                if (e.uuid !== verifyEntry.uuid) return e;
                return {
                    ...e,
                    status: 'COMPLETED' as const,
                    verifierName: 'QA Officer',
                    verificationComments: verifyComments,
                    verifierSignature: verifySignature
                };
            }));
        }
        setIsVerifyModalOpen(false);
        setVerifyEntry(null);
        setIsBulkVerify(false);
    };

    const generatePDFForEntries = async (targetEntries: ReheatingEntry[], filename: string) => {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ml = 30, mr = 30, mt = 30, mb = 40;
        const cw = pw - ml - mr;
        const securityId = `CERT-REH-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        const colFractions = [0.12, 0.14, 0.14, 0.12, 0.12, 0.16, 0.20];
        const colWidths = colFractions.map(f => cw * f);
        const colHeaders = ['REGISTRY\nIDENTITY', 'PROCESS\nTELEMETRY', 'PROCESS\nANCESTRY', 'CORRECTIVE\nACTION', 'QR\nPASSPORT', 'DISTRIBUTION', 'AUTHORIZATION'];

        const cx = (i: number) => ml + colWidths.slice(0, i).reduce((a, b) => a + b, 0);

        const drawWatermark = () => {
            pdf.saveGraphicsState();
            pdf.setTextColor(226, 232, 240);
            pdf.setFontSize(60);
            pdf.setFont('helvetica', 'bold');
            const wt = 'CONTROLLED RECORD';
            const tw2 = pdf.getTextWidth(wt);
            const cx2 = pw / 2, cy = ph / 2;
            pdf.text(wt, cx2 - tw2 / 2, cy, { angle: 35 });
            pdf.restoreGraphicsState();
        };

        const drawFooter = (pageNum: number, totalPages: number) => {
            pdf.setDrawColor(203, 213, 225);
            pdf.line(ml, ph - mb + 10, pw - mr, ph - mb + 10);
            pdf.setFontSize(6);
            pdf.setTextColor(148, 163, 184);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`HACCP PRO | ${docControlData.docRef} v${docControlData.version} | ${securityId}`, ml, ph - mb + 22);
            pdf.text(`Page ${pageNum} of ${totalPages}`, pw - mr - 50, ph - mb + 22);
            pdf.text(new Date().toLocaleString(), pw / 2 - 30, ph - mb + 22);
        };

        drawWatermark();

        let y = mt;
        y = drawPdfHeader(pdf, y, ml, mr, pw, { unitName, registryTitle: 'REHEATING CONTROL REGISTRY', subtitle: unitSubtitle || undefined, logoSrc, docControlData, compact: true });

        const drawTableHeader = (startY: number) => {
            pdf.setFillColor(30, 41, 59);
            pdf.rect(ml, startY, cw, 22, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'bold');
            colHeaders.forEach((h, i) => {
                const lines = h.split('\n');
                lines.forEach((line, li) => {
                    pdf.text(line, cx(i) + 4, startY + 9 + li * 7);
                });
            });
            return startY + 22;
        };

        y = drawTableHeader(y);
        let pageCount = 1;
        const baseRowH = 70;

        for (let ei = 0; ei < targetEntries.length; ei++) {
            const e = targetEntries[ei];
            const rowH = e.verifierName ? 85 : baseRowH;

            if (y + rowH > ph - mb) {
                drawFooter(pageCount, Math.ceil(targetEntries.length / 6) + 1);
                pdf.addPage();
                pageCount++;
                drawWatermark();
                y = mt;
                y = drawTableHeader(y);
            }

            const ry = y;
            pdf.setFillColor(ei % 2 === 0 ? 255 : 248, ei % 2 === 0 ? 255 : 250, ei % 2 === 0 ? 255 : 252);
            pdf.rect(ml, ry, cw, rowH, 'F');
            pdf.setDrawColor(226, 232, 240);
            pdf.rect(ml, ry, cw, rowH, 'S');
            colWidths.forEach((_, i) => { if (i > 0) { pdf.line(cx(i), ry, cx(i), ry + rowH); } });

            pdf.setTextColor(15, 23, 42);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text(e.productName.substring(0, 22), cx(0) + 4, ry + 14);
            pdf.setFontSize(5.5);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`BATCH: ${e.batchNumber}`, cx(0) + 4, ry + 24);
            pdf.text(`MFG: ${e.mfgDate || 'N/A'}`, cx(0) + 4, ry + 34);
            pdf.text(`EXP: ${e.expDate || 'N/A'}`, cx(0) + 4, ry + 44);
            pdf.text(`Unit: ${e.unit}`, cx(0) + 4, ry + 54);

            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            pdf.text(`Vessel: ${e.reheatingVessel || 'Pending'}`, cx(1) + 4, ry + 14);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`Temp: ${e.initialTemp || '---'}°C`, cx(1) + 4, ry + 26);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Lapse: ${formatLapse(e.reheatStart, e.reheatCompleted)}`, cx(1) + 4, ry + 38);
            pdf.text(`Method: ${e.method || 'N/A'}`, cx(1) + 4, ry + 50);

            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(59, 130, 246);
            pdf.text(`Thaw: ${e.thawTime}`, cx(2) + 4, ry + 14);
            pdf.setTextColor(225, 29, 72);
            pdf.text(`Cook: ${e.cookTime}`, cx(2) + 4, ry + 26);
            pdf.setTextColor(15, 23, 42);
            pdf.text(`Cook Temp: ${e.cookTemp}°C`, cx(2) + 4, ry + 38);
            pdf.setTextColor(6, 182, 212);
            pdf.text(`Cool: ${e.coolTime}`, cx(2) + 4, ry + 50);
            pdf.setTextColor(15, 23, 42);
            pdf.text(`Cool Temp: ${e.coolTemp}°C`, cx(2) + 4, ry + 62);

            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            if (e.correctiveAction) {
                const caLines = pdf.splitTextToSize(e.correctiveAction, colWidths[3] - 8);
                pdf.setTextColor(225, 29, 72);
                pdf.setFont('helvetica', 'bold');
                pdf.text('CORRECTIVE ACTION:', cx(3) + 4, ry + 14);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(100, 116, 139);
                caLines.slice(0, 5).forEach((line: string, li: number) => {
                    pdf.text(line, cx(3) + 4, ry + 24 + li * 8);
                });
            } else {
                pdf.text('None', cx(3) + 4, ry + 14);
            }

            const qrString = buildReheatingQRUrl(e);
            try {
                const qrDataUrl = await renderQRToCanvas(qrString);
                if (qrDataUrl) {
                    const qrSize = 36;
                    const qrX = cx(4) + (colWidths[4]) / 2 - qrSize / 2;
                    pdf.addImage(qrDataUrl, 'PNG', qrX, ry + 6, qrSize, qrSize);
                    pdf.setFontSize(4.5);
                    pdf.setTextColor(100, 116, 139);
                    const scanText = 'SCAN FOR RECORD';
                    pdf.text(scanText, cx(4) + (colWidths[4]) / 2 - pdf.getTextWidth(scanText) / 2, ry + qrSize + 12);
                }
            } catch {}

            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Purpose: ${e.reheatingPurpose || 'N/A'}`, cx(5) + 4, ry + 14);
            pdf.text(`Qty: ${e.reheatingQuantity || 'N/A'}`, cx(5) + 4, ry + 26);
            if (e.issued && e.issued.length > 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.text('Issued:', cx(5) + 4, ry + 38);
                pdf.setFont('helvetica', 'normal');
                e.issued.slice(0, 3).forEach((iss, ii) => {
                    pdf.text(`${iss.purpose}: ${iss.quantity}`, cx(5) + 4, ry + 48 + ii * 9);
                });
            }

            pdf.setFontSize(5.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            pdf.text('OPERATOR', cx(6) + 4, ry + 12);
            pdf.setTextColor(15, 23, 42);
            pdf.setFontSize(6.5);
            pdf.text(e.completedBy || 'N/A', cx(6) + 4, ry + 22);

            if (e.completedBySign) {
                try { pdf.addImage(e.completedBySign, 'PNG', cx(6) + 4, ry + 26, 50, 18); } catch {}
            }

            if (e.verifierName) {
                const vyOff = e.completedBySign ? 48 : 34;
                pdf.setFillColor(240, 253, 244);
                pdf.roundedRect(cx(6) + 4, ry + vyOff, colWidths[6] - 12, 28, 2, 2, 'F');
                pdf.setDrawColor(187, 247, 208);
                pdf.roundedRect(cx(6) + 4, ry + vyOff, colWidths[6] - 12, 28, 2, 2, 'S');
                pdf.setFontSize(5);
                pdf.setTextColor(5, 150, 105);
                pdf.setFont('helvetica', 'bold');
                pdf.text('QA AUTHORIZED', cx(6) + 8, ry + vyOff + 10);
                pdf.setTextColor(6, 78, 59);
                pdf.setFontSize(6.5);
                pdf.text(e.verifierName, cx(6) + 8, ry + vyOff + 20);
                if (e.verifierSignature) {
                    try { pdf.addImage(e.verifierSignature, 'PNG', cx(6) + 60, ry + vyOff + 4, 40, 16); } catch {}
                }
            } else {
                pdf.setFontSize(5.5);
                pdf.setTextColor(245, 158, 11);
                pdf.setFont('helvetica', 'bold');
                pdf.text('AWAITING AUTH', cx(6) + 4, ry + 36);
            }

            y += rowH;
        }

        drawFooter(pageCount, pageCount);
        savePdfForPWA(pdf, filename);
    };

    const handleExportGlobalPDF = async () => {
        setIsGeneratingPDF(true);
        const filename = `Complete_Reheating_Registry_${new Date().toISOString().split('T')[0]}.pdf`;
        await generatePDFForEntries(filteredData, filename);
        setIsGeneratingPDF(false);
    };

    const handleExportSinglePDF = async (entry: ReheatingEntry) => {
        setIsGeneratingPDF(true);
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pw = pdf.internal.pageSize.getWidth();
        const ml = 40, mr = 40;
        const cw2 = pw - ml - mr;
        const securityId = `CERT-REH-${Math.random().toString(36).substring(7).toUpperCase()}-${Date.now().toString().slice(-4)}`;
        let y = 40;

        pdf.setFillColor(30, 41, 59);
        pdf.rect(0, 0, pw, 70, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('HACCP PRO', ml, 28);
        pdf.setFontSize(8);
        pdf.setTextColor(165, 180, 252);
        pdf.text('REHEATING CONTROL RECORD', ml, 42);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Doc Ref: ${docControlData.docRef} | Rev: v${docControlData.version} | ${docControlData.effectiveDate}`, ml, 56);
        const statusLabel = entry.verifierName ? 'VERIFIED' : entry.status === 'DUE_VERIFICATION' ? 'DUE VERIFY' : entry.status;
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        const slW = pdf.getTextWidth(statusLabel) + 16;
        const sColor = entry.verifierName ? [16, 185, 129] : [245, 158, 11];
        pdf.setFillColor(sColor[0], sColor[1], sColor[2]);
        pdf.roundedRect(pw - mr - slW, 20, slW, 20, 4, 4, 'F');
        pdf.text(statusLabel, pw - mr - slW + 8, 34);
        y = 90;

        const sectionHeader = (title: string) => {
            if (y > 720) { pdf.addPage(); y = 40; }
            pdf.setFillColor(30, 41, 59);
            pdf.roundedRect(ml, y, cw2, 20, 3, 3, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'bold');
            pdf.text(title, ml + 10, y + 13);
            y += 24;
        };

        const row = (label: string, value: string, color?: number[]) => {
            if (y > 760) { pdf.addPage(); y = 40; }
            pdf.setDrawColor(241, 245, 249);
            pdf.line(ml, y + 16, ml + cw2, y + 16);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            pdf.setFont('helvetica', 'normal');
            pdf.text(label, ml + 8, y + 11);
            pdf.setFont('helvetica', 'bold');
            if (color) pdf.setTextColor(color[0], color[1], color[2]);
            else pdf.setTextColor(15, 23, 42);
            pdf.text(value || '---', ml + cw2 / 2, y + 11);
            y += 18;
        };

        sectionHeader('UNIT DETAILS');
        row('Corporate', entry.corporate);
        row('Region', entry.regional);
        row('Unit', entry.unit);
        row('Department', entry.department);
        row('Location', entry.location);

        sectionHeader('PRODUCT INFORMATION');
        row('Product Name', entry.productName, [79, 70, 229]);
        row('Source Material', entry.sourceProductName);
        row('Category', entry.category);
        row('Batch Number', entry.batchNumber);
        row('Standard Recipe', entry.standardRecipe);
        row('MFG Date', entry.mfgDate || 'N/A');
        row('EXP Date', entry.expDate || 'N/A');

        sectionHeader('PROCESS ANCESTRY');
        row('Thawing Time', entry.thawTime, [59, 130, 246]);
        row('Cooking Time', entry.cookTime, [225, 29, 72]);
        row('Cooking Temp', `${entry.cookTemp}°C`);
        row('Cooling Time', entry.coolTime, [6, 182, 212]);
        row('Cooling Temp', `${entry.coolTemp}°C`);

        sectionHeader('REHEATING TELEMETRY');
        row('Vessel', entry.reheatingVessel || 'N/A');
        row('Method', entry.method || 'N/A');
        row('Reheat Start', entry.reheatStart ? new Date(entry.reheatStart).toLocaleString() : '---');
        row('Reheat Completed', entry.reheatCompleted ? new Date(entry.reheatCompleted).toLocaleString() : '---');
        row('Reheating Temp', `${entry.initialTemp || '---'}°C`, [225, 29, 72]);
        row('Duration', entry.duration || formatLapse(entry.reheatStart, entry.reheatCompleted));
        row('Quantity', `${entry.reheatingQuantity}`);
        row('Purpose', entry.reheatingPurpose);
        if (entry.correctiveAction) row('Corrective Action', entry.correctiveAction, [225, 29, 72]);

        if (entry.issued && entry.issued.length > 0) {
            sectionHeader('DISTRIBUTION REGISTRY');
            entry.issued.forEach(iss => { row(iss.purpose, `${iss.quantity}`); });
        }

        sectionHeader('AUTHORIZATION & VERIFICATION');
        row('Operator', entry.completedBy || 'N/A');
        if (entry.completedBySign) {
            try { pdf.addImage(entry.completedBySign, 'PNG', ml + 8, y, 80, 30); y += 34; } catch {}
        }
        row('Verified By', entry.verifierName || 'PENDING', entry.verifierName ? [5, 150, 105] : [245, 158, 11]);
        if (entry.verificationComments) row('Comments', entry.verificationComments);
        if (entry.verifierSignature) {
            try { pdf.addImage(entry.verifierSignature, 'PNG', ml + 8, y, 80, 30); y += 34; } catch {}
        }

        sectionHeader('DIGITAL IDENTITY PASSPORT (QR CODE)');
        const qrString = buildReheatingQRUrl(entry);
        try {
            const qrDataUrl = await renderQRToCanvas(qrString);
            if (qrDataUrl) {
                const qrS = 80;
                pdf.addImage(qrDataUrl, 'PNG', ml + 10, y + 6, qrS, qrS);
                pdf.setFontSize(8);
                pdf.setTextColor(15, 23, 42);
                pdf.setFont('helvetica', 'bold');
                pdf.text('SCAN FOR COMPLETE', ml + qrS + 24, y + 30);
                pdf.text('DIGITAL RECORD', ml + qrS + 24, y + 42);
                pdf.setFontSize(6);
                pdf.setTextColor(100, 116, 139);
                pdf.text(`Record Hash: ${securityId}`, ml + qrS + 24, y + 56);
            }
        } catch {}

        y += 100;
        pdf.setDrawColor(203, 213, 225);
        pdf.line(ml, y, ml + cw2, y);
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`HACCP PRO | ${securityId} | Generated: ${new Date().toLocaleString()}`, ml, y + 14);
        pdf.text('ISO 22000:2018 Compliant', pw - mr - 80, y + 14);

        const filename2 = `Reheating_Record_${entry.batchNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
        savePdfForPWA(pdf, filename2);
        setIsGeneratingPDF(false);
    };

    return (
        <div className="flex flex-col h-full gap-6 p-4 md:p-0">
            {/* ═══ MOBILE DASHBOARD (lg:hidden) ═══ */}
            <div className="lg:hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-3xl p-5 mb-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/20 flex items-center justify-center">
                        <Flame size={20} className="text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-white leading-tight">Reheating Registry</h2>
                        <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">{stats.total} Records</p>
                    </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                        { label: 'Ready', val: stats.ready, id: 'READY', color: 'text-indigo-400', icon: Play },
                        { label: 'Active', val: stats.inProgress, id: 'IN_PROGRESS', color: 'text-orange-400', icon: Flame },
                        { label: 'Due', val: stats.dueVerify, id: 'DUE_VERIFICATION', color: 'text-blue-400', icon: ClipboardCheck },
                        { label: 'Done', val: stats.completed, id: 'COMPLETED', color: 'text-emerald-400', icon: CheckCircle2 },
                    ].map((s, i) => (
                        <button
                            key={i}
                            onClick={() => { setActiveFilter(s.id as any); setCurrentPage(1); }}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl transition-all active:scale-95 ${activeFilter === s.id ? 'bg-white/20 ring-2 ring-white/30' : 'bg-white/10'}`}
                        >
                            <s.icon size={14} className={s.color} />
                            <span className={`text-lg font-semibold ${s.color}`}>{s.val}</span>
                            <span className="text-[7px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</span>
                        </button>
                    ))}
                </div>
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search batch or product..."
                        className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-[11px] font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-all"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setActiveFilter('all'); setCurrentPage(1); }}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all active:scale-95 ${activeFilter === 'all' ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300'}`}
                    >
                        All
                    </button>
                    <button className="p-2.5 bg-white/10 rounded-xl text-slate-400 active:scale-95 transition-all">
                        <Filter size={16} />
                    </button>
                    <button onClick={() => {}} className="p-2.5 bg-white/10 rounded-xl text-slate-400 active:scale-95 transition-all">
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* ═══ DESKTOP DASHBOARD (hidden lg:flex) ═══ */}
            <div className="hidden lg:flex bg-white p-4 lg:p-6 rounded-[2.5rem] border border-slate-200 shadow-xl mb-8 flex-col lg:flex-row gap-6 items-stretch lg:items-center overflow-hidden">
                
                {/* Metrics Group: Responsive horizontally on small screens */}
                <div className="flex-1 flex overflow-x-auto hide-scrollbar snap-x pb-1 lg:pb-0">
                    <div className="flex gap-3 min-w-max">
                        {[
                            { label: 'Total Trace', val: stats.total, color: 'bg-slate-900', id: 'all', icon: DatabaseIcon },
                            { label: 'Ready Pool', val: stats.ready, color: 'bg-indigo-600', id: 'READY', icon: Play },
                            { label: 'Reheating', val: stats.inProgress, color: 'bg-amber-500', id: 'IN_PROGRESS', icon: Flame },
                            { label: 'Pending Auth', val: stats.dueVerify, color: 'bg-blue-600', id: 'DUE_VERIFICATION', icon: ClipboardCheck },
                            { label: 'Verified Flow', val: stats.completed, color: 'bg-emerald-600', id: 'COMPLETED', icon: CheckCircle2 },
                            { label: 'Avg Record/Day', val: stats.avgPerDay, color: 'bg-rose-500', id: 'AvgPerDay', icon: TrendingUp }
                        ].map((c, i) => (
                            <button 
                                key={i} 
                                onClick={() => { if(c.id !== 'AvgPerDay') setActiveFilter(c.id as any); setCurrentPage(1); }}
                                className={`p-3 lg:p-4 rounded-2xl border-2 transition-all flex flex-col justify-center text-left relative group active:scale-95 snap-center w-36 lg:w-40 ${activeFilter === c.id ? 'bg-white border-indigo-600 shadow-lg ring-4 ring-indigo-50' : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'}`}
                            >
                                <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{c.label}</p>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg lg:text-xl font-black text-slate-900 tracking-tighter leading-none">{c.val}</p>
                                    <div className={`w-2 h-2 rounded-full ${c.color}`} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Global Action Terminal */}
                <div className="flex flex-wrap items-center gap-3 shrink-0 lg:pl-6 lg:border-l border-slate-100 justify-center sm:justify-start">
                    
                    {/* Date Filters */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 shadow-inner">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 hidden sm:inline">Range:</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-20 sm:w-24 uppercase cursor-pointer"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <span className="text-slate-300 font-bold">-</span>
                        <input 
                            type="date" 
                            className="bg-transparent text-[10px] font-bold text-slate-700 outline-none w-20 sm:w-24 uppercase cursor-pointer"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="ml-1 text-slate-400 hover:text-rose-500 transition-colors">
                                <XCircle size={14} />
                            </button>
                        )}
                    </div>

                    <div className="relative group w-full sm:w-48 lg:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                            type="text" 
                            placeholder="Locate batch SKU..." 
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner uppercase tracking-wider"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95"><Filter size={20} /></button>
                        <button 
                            onClick={handleExportGlobalPDF}
                            disabled={isGeneratingPDF}
                            className="p-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            {isGeneratingPDF ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                        </button>
                        <button onClick={() => {}} className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                            <Plus size={18} strokeWidth={3} /> <span className="hidden sm:inline">New Entry</span>
                        </button>
                    </div>
                </div>
            </div>

            {selectedForVerify.size > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-lg">{selectedForVerify.size}</div>
                        <div>
                            <p className="text-sm font-black text-amber-800 uppercase tracking-tight">Records Selected for Verification</p>
                            <p className="text-[10px] font-bold text-amber-600">Select records and verify them all at once</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={selectAllDueVerification} className="px-4 py-2.5 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all active:scale-95">
                            Select All on Page
                        </button>
                        <button onClick={() => setSelectedForVerify(new Set())} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">
                            Clear
                        </button>
                        <button onClick={handleBulkVerifyClick} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-amber-100 transition-all active:scale-95 flex items-center gap-2">
                            <ShieldCheck size={16} strokeWidth={3} /> Bulk Verify ({selectedForVerify.size})
                        </button>
                    </div>
                </div>
            )}

            {/* List Data */}
            <div className="flex flex-col gap-6">
                {paginatedData.map((row, idx) => {
                    const isReady = row.status === 'READY';
                    const isInProgress = row.status === 'IN_PROGRESS';
                    const isDue = row.status === 'DUE_VERIFICATION';
                    const isCompleted = row.status === 'COMPLETED';
                    const isVerified = !!row.verifierName;

                    const entryQrData = buildReheatingQRUrl(row);

                    const isMobileExpanded = expandedMobileId === row.uuid;
                    const borderColorMobile = isCompleted ? 'border-l-emerald-500' : isInProgress ? 'border-l-orange-500' : isDue ? 'border-l-blue-500' : isReady ? 'border-l-indigo-500' : 'border-l-slate-300';

                    return (
                        <div key={row.uuid}>
                            {/* ═══ MOBILE CARD (lg:hidden) ═══ */}
                            <div className={`lg:hidden bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${selectedForVerify.has(row.uuid) ? 'ring-2 ring-amber-400 border-amber-300' : 'border-slate-200'}`}>
                                <div className={`border-l-4 ${borderColorMobile}`}>
                                    <div className="p-4 pb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-semibold text-[10px] shrink-0 ${isCompleted ? 'bg-emerald-600' : isInProgress ? 'bg-orange-600' : isDue ? 'bg-blue-600' : 'bg-indigo-600'}`}>
                                                {((currentPage - 1) * rowsPerPage + idx + 1).toString().padStart(2, '0')}
                                            </div>
                                            <h3 className="text-[13px] font-semibold text-slate-800 truncate flex-1 leading-tight">{row.productName}</h3>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase shrink-0 ${isVerified ? 'bg-emerald-50 text-emerald-700' : isDue ? 'bg-blue-50 text-blue-700' : isInProgress ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700'}`}>
                                                {isVerified ? 'Verified' : isDue ? 'Due' : isInProgress ? 'Active' : 'Ready'}
                                            </span>
                                            {isDue && (
                                                <button onClick={(e) => { e.stopPropagation(); toggleVerifySelection(row.uuid); }} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${selectedForVerify.has(row.uuid) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>
                                                    {selectedForVerify.has(row.uuid) && <Check size={10} strokeWidth={4} />}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                            <span className="text-[9px] font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-mono">{row.batchNumber}</span>
                                            <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{row.reheatingQuantity} qty</span>
                                            {!isReady && <span className="text-[9px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">{row.initialTemp}°C</span>}
                                        </div>
                                    </div>

                                    <div className="px-4">
                                        <button
                                            onClick={() => setExpandedMobileId(isMobileExpanded ? null : row.uuid)}
                                            className="w-full flex items-center justify-center gap-1 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider active:text-indigo-500 transition-colors"
                                        >
                                            {isMobileExpanded ? 'Hide Details' : 'Show Details'}
                                            <ChevronDown size={14} className={`transition-transform duration-200 ${isMobileExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {isMobileExpanded && (
                                        <div className="px-4 pb-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <History size={12} className="text-indigo-500" />
                                                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Process Ancestry</span>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Snowflake size={12} className="text-blue-500 shrink-0" />
                                                        <span className="text-[10px] font-semibold text-slate-600 flex-1">Thaw: {row.thawTime}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Flame size={12} className="text-rose-500 shrink-0" />
                                                        <span className="text-[10px] font-semibold text-slate-600 flex-1">Cook: {row.cookTime} · <span className="text-rose-600">{row.cookTemp}°C</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Droplets size={12} className="text-cyan-500 shrink-0" />
                                                        <span className="text-[10px] font-semibold text-slate-600 flex-1">Cool: {row.coolTime} · <span className="text-cyan-600">{row.coolTemp}°C</span></span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Activity size={12} className="text-indigo-500" />
                                                    <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Reheating Details</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">Start</span>
                                                        <span className="text-[10px] font-semibold text-slate-700">{isReady ? '---' : formatTimeDisplay(row.reheatStart)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">End</span>
                                                        <span className="text-[10px] font-semibold text-slate-700">{(isCompleted || isDue) ? formatTimeDisplay(row.reheatCompleted) : '---'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">Vessel</span>
                                                        <span className="text-[10px] font-semibold text-slate-700">{row.reheatingVessel || '---'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">Operator</span>
                                                        <span className="text-[10px] font-semibold text-slate-700">{row.completedBy || '---'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">Duration</span>
                                                        <span className="text-[10px] font-semibold text-indigo-600 font-mono">{isReady ? '---' : formatLapse(row.reheatStart, row.reheatCompleted)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] text-slate-400 uppercase block">Purpose</span>
                                                        <span className="text-[10px] font-semibold text-slate-700">{row.reheatingPurpose}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {row.correctiveAction && (
                                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start gap-2">
                                                    <AlertTriangle size={12} className="text-rose-500 shrink-0 mt-0.5" />
                                                    <p className="text-[10px] text-rose-700 font-semibold italic leading-snug">"{row.correctiveAction}"</p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3">
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 flex items-center justify-center">
                                                    <QRCodeSVG value={entryQrData} size={48} level="H" includeMargin={false} />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Digital Passport</p>
                                                    <p className="text-[9px] font-mono text-slate-500 truncate">{row.uuid}</p>
                                                </div>
                                            </div>

                                            {isVerified && (
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                                                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                                                    <div>
                                                        <p className="text-[8px] font-semibold text-emerald-500 uppercase tracking-wider">Verified By</p>
                                                        <p className="text-[10px] font-semibold text-emerald-800">{row.verifierName}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="px-4 pb-4 pt-1">
                                        {isReady ? (
                                            <button onClick={() => handleInitiateClick(row)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <Play size={16} fill="currentColor" /> Start Reheating
                                            </button>
                                        ) : isInProgress ? (
                                            hasElapsed15Seconds(row.reheatStart) ? (
                                                <button onClick={() => handleEndProcessClick(row)} className="w-full py-3 bg-rose-600 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                                    <CheckCircle2 size={16} /> End Process
                                                </button>
                                            ) : (
                                                <div className="w-full py-3 flex items-center justify-center gap-2 text-orange-500">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Reheating Active...</span>
                                                </div>
                                            )
                                        ) : isDue ? (
                                            <button onClick={() => handleVerifyClick(row)} className="w-full py-3 bg-amber-500 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <ShieldCheck size={16} /> Verify
                                            </button>
                                        ) : isCompleted ? (
                                            <button onClick={() => handleExportSinglePDF(row)} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-semibold uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <Download size={14} /> Export PDF
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            {/* ═══ DESKTOP CARD (hidden lg:flex) ═══ */}
                            <div className={`hidden lg:flex bg-white rounded-3xl border-2 transition-all duration-500 lg:flex-row group ${selectedForVerify.has(row.uuid) ? 'border-amber-400 shadow-lg ring-2 ring-amber-100' : isInProgress ? 'border-orange-400 shadow-2xl scale-[1.01]' : 'border-slate-100 shadow-sm hover:border-orange-200'}`}>
                                {/* 1. IDENTITY BLOCK */}
                                <div className="p-6 md:p-8 border-b lg:border-b-0 lg:border-r border-slate-50 lg:w-[20%] shrink-0">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            {isDue && (
                                                <button onClick={() => toggleVerifySelection(row.uuid)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${selectedForVerify.has(row.uuid) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 hover:border-amber-400'}`}>
                                                    {selectedForVerify.has(row.uuid) && <Check size={14} strokeWidth={3} />}
                                                </button>
                                            )}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg ${isCompleted ? 'bg-emerald-600' : isInProgress ? 'bg-orange-600 animate-pulse' : isReady ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                                                {((currentPage - 1) * rowsPerPage + idx + 1).toString().padStart(2, '0')}
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-wider ${isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isDue ? 'bg-blue-50 text-blue-700 border-blue-100' : isInProgress ? 'bg-orange-50 text-orange-700 border-orange-100' : isReady ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600'}`}>
                                                {isVerified ? 'Verified' : isDue ? 'Due Verify' : isInProgress ? 'In Progress' : isReady ? 'Ready' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight mb-2 group-hover:text-indigo-600 transition-colors truncate">{row.productName}</h3>
                                    <div className="flex items-center gap-2 text-slate-400 text-[9px] font-black uppercase tracking-widest mb-6">
                                        <Globe size={12} className="text-indigo-400" /> {row.unit} <ChevronRight size={8} /> {row.location}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col gap-1 shadow-inner">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Registry ID</span>
                                            <span className="text-[10px] font-black text-slate-800 font-mono tracking-tighter truncate">{row.batchNumber}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col gap-1 shadow-inner">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Recipe Node</span>
                                            <span className="text-[10px] font-black text-indigo-600 truncate">{row.standardRecipe}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. ANCESTRY BLOCK */}
                                <div className="px-8 py-6 lg:py-8 bg-slate-50/40 border-b lg:border-b-0 lg:border-r border-slate-50 lg:w-[20%] shrink-0">
                                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
                                        <History size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Process Ancestry</span>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0"><Snowflake size={14} className="text-blue-500" /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-baseline mb-0.5"><span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Thawing Entry</span><span className="text-[9px] font-bold text-slate-400">{row.thawTime.split(' ')[0]}</span></div>
                                                <div className="flex justify-between items-baseline"><span className="text-[10px] font-black text-slate-700">{row.thawTime.split(' ')[1]} {row.thawTime.split(' ')[2]}</span><span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded">Cold Stable</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0"><Flame size={14} className="text-rose-500" /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-baseline mb-0.5"><span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Cooking Final</span><span className="text-[9px] font-bold text-slate-400">{row.cookTime.split(' ')[0]}</span></div>
                                                <div className="flex justify-between items-baseline"><span className="text-[10px] font-black text-slate-700">{row.cookTime.split(' ')[1]} {row.cookTime.split(' ')[2]}</span><span className="text-[9px] font-black text-rose-600">{row.cookTemp}°C</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0"><Droplets size={14} className="text-cyan-500" /></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex justify-between items-baseline mb-0.5"><span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Cooling End</span><span className="text-[9px] font-bold text-slate-400">{row.coolTime.split(' ')[0]}</span></div>
                                                <div className="flex justify-between items-baseline"><span className="text-[10px] font-black text-slate-700">{row.coolTime.split(' ')[1]} {row.coolTime.split(' ')[2]}</span><span className="text-[9px] font-black text-cyan-600">{row.coolTemp}°C</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. QR CODE / DIGITAL ID */}
                                <div className="p-6 md:p-8 lg:w-[12%] border-b lg:border-b-0 lg:border-r border-slate-50 flex flex-col justify-center items-center bg-white shrink-0">
                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-4 flex flex-col items-center gap-3 shadow-inner group/qr transition-all hover:bg-indigo-50 hover:border-indigo-200">
                                        <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
                                            <QRCodeSVG value={entryQrData} size={64} level="H" includeMargin={false} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover/qr:text-indigo-600 transition-colors">Registry ID</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. REHEATING DETAILS */}
                                <div className="p-5 flex flex-col flex-1 gap-4 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 border-b border-slate-100 pb-2">
                                        <Flame size={14} className="text-orange-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reheating Telemetry</span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 items-stretch">
                                        <div className="flex flex-col gap-3 min-w-[120px]">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><Play size={10} fill="currentColor" /> Intake</span>
                                                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 shadow-inner">
                                                    <span className={`text-xs font-black ${isReady ? 'text-slate-300 italic' : 'text-slate-800'}`}>{isReady ? '--:--' : formatTimeDisplay(row.reheatStart)}</span>
                                                    <span className={`text-xs font-black font-mono ml-2 ${isReady ? 'text-slate-300' : 'text-rose-500'}`}>{isReady ? '--' : row.initialTemp}°C</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5"><CheckCheck size={10} /> Completed</span>
                                                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 shadow-inner">
                                                    <span className={`text-xs font-black ${!isCompleted ? 'text-slate-300 italic' : 'text-slate-800'}`}>{!isCompleted ? '--:--' : formatTimeDisplay(row.reheatCompleted)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl text-white shadow-xl relative overflow-hidden min-w-[110px]">
                                            <Clock size={18} className="text-indigo-400 mb-1" />
                                            <span className="text-[8px] font-black text-indigo-200 uppercase tracking-[0.15em] mb-1">Cycle Lapse</span>
                                            <span className={`text-lg font-black tracking-tighter font-mono ${isReady ? 'text-slate-700' : 'text-white'}`}>{isReady ? '00:00' : formatLapse(row.reheatStart, row.reheatCompleted)}</span>
                                        </div>
                                        <div className="flex-1 min-w-[160px] flex flex-col gap-3">
                                            <div className="flex items-center gap-4 px-3 py-2 bg-white border border-slate-100 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <User size={14} className="text-slate-400 shrink-0" />
                                                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase leading-none">Operator</p><p className={`text-[11px] font-black uppercase truncate ${isReady ? 'text-slate-300 italic' : 'text-slate-800'}`}>{isReady ? 'Unassigned' : row.completedBy}</p></div>
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0 flex-1 border-l border-slate-100 pl-3">
                                                    <Utensils size={14} className="text-slate-400 shrink-0" />
                                                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase leading-none">Vessel</p><p className={`text-[11px] font-black uppercase truncate ${isReady ? 'text-slate-300 italic' : 'text-slate-800'}`}>{isReady ? 'TBD' : row.reheatingVessel}</p></div>
                                                </div>
                                            </div>
                                            {row.correctiveAction && (<div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2"><AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" /><p className="text-[11px] text-rose-800 font-bold italic leading-relaxed truncate">"{row.correctiveAction}"</p></div>)}
                                        </div>
                                    </div>
                                </div>

                                {/* 5. VERIFICATION BLOCK */}
                                <div className="mt-auto lg:mt-0 p-6 md:p-8 bg-slate-50/50 border-t lg:border-t-0 lg:border-l border-slate-100 lg:w-[18%] flex flex-col justify-center">
                                    {isVerified ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg ring-4 ring-white shrink-0"><ShieldCheck size={24} strokeWidth={3} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Authorization Node</p>
                                                    <p className="text-xs font-black text-slate-800 uppercase truncate">{row.verifierName}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleExportSinglePDF(row)} className="w-full py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-indigo-600 hover:border-indigo-100 transition-all">
                                                <Download size={12}/> Export PDF
                                            </button>
                                        </div>
                                    ) : isDue ? (
                                        <button onClick={() => handleVerifyClick(row)} className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"><ShieldCheck size={20} strokeWidth={3} /> Execute Verification</button>
                                    ) : isInProgress ? (
                                        hasElapsed15Seconds(row.reheatStart) ? (
                                            <button onClick={() => handleEndProcessClick(row)} className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-rose-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"><CheckCircle2 size={20} /> End Process Cycle</button>
                                        ) : (
                                            <div className="w-full py-4 flex flex-col items-center gap-2">
                                                <div className="flex items-center gap-2 text-orange-500">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Reheating Active</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400">End process available shortly...</span>
                                            </div>
                                        )
                                    ) : isReady ? (
                                        <button onClick={() => handleInitiateClick(row)} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-2"><Play size={24} fill="currentColor" /><span>Initiate Reheating</span></button>
                                    ) : (
                                        <div className="py-4 text-center text-[10px] font-black uppercase text-slate-300 italic tracking-[0.3em]">Locked Node</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ═══ MOBILE FAB (lg:hidden) ═══ */}
            <div className="lg:hidden flex items-center gap-3 sticky bottom-4 z-40 px-2">
                <button
                    onClick={handleExportGlobalPDF}
                    disabled={isGeneratingPDF}
                    className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isGeneratingPDF ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Download PDF
                </button>
                {selectedForVerify.size > 0 && (
                    <button
                        onClick={handleBulkVerifyClick}
                        className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-[11px] font-semibold uppercase tracking-wider shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <ShieldCheck size={16} /> Bulk Verify ({selectedForVerify.size})
                    </button>
                )}
            </div>

            <div className="bg-white border border-slate-200 shadow-sm rounded-[2.5rem] mb-10 overflow-hidden">
                <UnifiedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    rowsPerPage={rowsPerPage}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={(val) => { setRowsPerPage(val); setCurrentPage(1); }}
                />
            </div>

            {isInitiateModalOpen && selectedEntry && (
                <div className="fixed inset-0 z-150 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300 h-[85vh] md:h-auto md:max-h-[94vh]">
                        <div className="px-10 py-10 bg-indigo-600 text-white flex justify-between items-center shrink-0 shadow-lg"><div className="flex items-center gap-5"><Play size={32}/><div><h3 className="text-2xl font-black uppercase tracking-tight leading-none">Process Initiation</h3><p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mt-2">Critical Regeneration Point (CCP)</p></div></div><button onClick={() => setIsInitiateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"><X size={28}/></button></div>
                        <div className="p-10 space-y-8 bg-slate-50/20 overflow-y-auto custom-scrollbar flex-1">
                            <div className="bg-white border-2 border-indigo-100 p-6 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm"><div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Product Node</p><h4 className="text-xl font-black text-slate-800 uppercase leading-none">{selectedEntry.productName}</h4><p className="text-[10px] font-mono font-bold text-indigo-500 mt-2">{selectedEntry.batchNumber}</p></div><div className="sm:text-right flex flex-col items-end"><div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-blue-200 mb-2">Ancestry Verified</div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cooling End Temp</p><p className="text-2xl font-black text-indigo-600 tracking-tighter">{selectedEntry.coolTemp}°C</p></div></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Thermometer size={14} className="text-rose-500" /> Intake Temperature (°C)</label>
                                    <div className="relative group">
                                        <input type="number" step="0.1" autoFocus value={tempInput} onChange={e => setTempInput(e.target.value)} className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-[1.75rem] text-2xl font-black text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-inner pr-16" placeholder="0.0" />
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (cameraInputRef.current) { cameraInputRef.current.value = ''; cameraInputRef.current.click(); } }} className={`p-3 rounded-xl transition-all active:scale-90 ${tempImage ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}><Camera size={20}/></button>
                                        </div>
                                    </div>
                                    {tempImage && (
                                        <div className="relative mt-2 rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-sm">
                                            <img src={tempImage} alt="Temperature capture" className="w-full h-32 object-cover" />
                                            <button type="button" onClick={() => setTempImage("")} className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 active:scale-90 transition-all"><X size={14} /></button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
                                                <p className="text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1"><Camera size={10} /> Temperature Evidence Captured</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Utensils size={14} className="text-indigo-500" /> Reheating Vessel</label>
                                    <select value={vesselInput} onChange={e => setVesselInput(e.target.value)} className="w-full h-[64px] px-5 bg-white border-2 border-slate-100 rounded-[1.75rem] text-sm font-black uppercase text-slate-800 outline-none focus:border-indigo-500 transition-all shadow-inner appearance-none cursor-pointer">
                                        <option value="OVEN-01">OVEN-01 (REAR)</option>
                                        <option value="OVEN-02">OVEN-02 (FRONT)</option>
                                        <option value="COMBI-01">COMBI-MASTER</option>
                                        <option value="RANGE-01">RANGE-01</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-4"><div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex items-start gap-4"><Info className="text-blue-500 mt-0.5" size={18} /><p className="text-[11px] font-medium text-blue-700 leading-relaxed uppercase tracking-tight"><span className="font-black">Critical Limit:</span> Reheating must reach a minimum core temperature of <span className="font-black text-blue-900">75°C within 90 minutes</span> to maintain process integrity.</p></div><SignaturePad onSave={setSignature} initialData={signature} label="Operator Authority Commitment" /></div>
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 pb-safe"><button onClick={() => setIsInitiateModalOpen(false)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest order-2 sm:order-1">Discard</button><button disabled={!tempInput || !signature} onClick={commitInitiation} className={`px-16 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 order-1 sm:order-2 ${tempInput && signature ? 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}><CheckCheck size={20} /> Commit Initiation</button></div>
                    </div>
                </div>
            )}

            {isVerifyModalOpen && (
                <div className="fixed inset-0 z-150 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-300 max-h-[85vh]">
                        <div className="px-10 py-8 bg-amber-500 text-white flex justify-between items-center shrink-0 shadow-lg">
                            <div className="flex items-center gap-5">
                                <ShieldCheck size={32} strokeWidth={3} />
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight leading-none">QA Verification</h3>
                                    <p className="text-[10px] font-bold text-amber-100 uppercase tracking-widest mt-2">
                                        {isBulkVerify ? `Bulk Verify ${selectedForVerify.size} Records` : 'Authorization & Compliance'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsVerifyModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90"><X size={28}/></button>
                        </div>
                        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <MessageSquare size={14} className="text-amber-500" /> Verification Comments
                                </label>
                                <textarea value={verifyComments} onChange={e => setVerifyComments(e.target.value)} rows={3} className="w-full px-5 py-4 bg-white border-2 border-slate-100 rounded-[1.75rem] text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 transition-all shadow-inner resize-none" placeholder="Optional verification notes..." />
                            </div>

                            <SignaturePad onSave={setVerifySignature} initialData={verifySignature} label="Verifier Authorization Signature" />
                        </div>
                        <div className="px-10 py-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3 shrink-0 pb-safe">
                            <button onClick={() => setIsVerifyModalOpen(false)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest order-2 sm:order-1">Cancel</button>
                            <button disabled={!verifySignature} onClick={commitVerification} className={`px-16 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 order-1 sm:order-2 ${verifySignature ? 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                                <ShieldCheck size={20} strokeWidth={3} /> {isBulkVerify ? `Verify All (${selectedForVerify.size})` : 'Authorize & Complete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DatabaseIcon = ({ size, className }: any) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
);

export default ReheatingRecord;
