"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    Camera, 
    Plus, 
    Loader2,
    SendHorizonal,
    MapPin,
    BookOpen,
    Briefcase,
    Wrench,
    Users,
    Tag,
    Info,
    ImageIcon,
    Upload,
    ChevronRight,
    LayoutTemplate,
    Edit2,
    Trash2,
    Columns,
    Rows,
    Layout,
    Grid,
    Maximize,
    StretchHorizontal,
    StretchVertical,
    ShieldCheck,
    ArrowLeft,
    ArrowRight,
    PlusCircle,
    ArrowUpDown,
    LayoutGrid,
    Move,
    Download,
    Highlighter,
    Type,
    Smile,
    RotateCw,
    GripVertical,
    GripHorizontal,
    Crop,
    Square,
    Circle,
    ArrowUp,
    Check,
    ChevronDown,
    Undo2,
    Redo2,
    Search,
    Wand2,
    Lock,
    Unlock,
    Filter
} from 'lucide-react';
import html2canvas from 'html2canvas';
import Cropper from 'cropperjs';
import { compressImage } from '@/utils/imageCompression';

// --- Advanced Photo Editor Component ---

type EditorElement = {
    id: string;
    type: 'text' | 'rect' | 'circle' | 'arrow' | 'sticker';
    x: number;
    y: number;
    width?: number;
    height?: number;
    content?: string;
    color: string;
    fontSize?: number;
};

interface HistoryState {
    elements: EditorElement[];
    canvasData: string;
}

const EMOJIS = ['⚠️', '🔴', '📍', '✅', '❌', '🔥', '💧', '🪰', '❄️'];

const PhotoEditor: React.FC<{ 
    imageUrl: string, 
    onSave: (editedUrl: string) => void, 
    onCancel: () => void 
}> = ({ imageUrl, onSave, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const cropperRef = useRef<Cropper | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [activeColor, setActiveColor] = useState('#ff0000');
    const [isRendering, setIsRendering] = useState(false);
    const [elements, setElements] = useState<EditorElement[]>([]);
    const [tool, setTool] = useState<'pen' | 'text' | 'rect' | 'circle' | 'arrow' | 'sticker'>('pen');
    const [isCropping, setIsCropping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeElementId, setActiveElementId] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);

    // History state
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);

    const pushToHistory = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const newState: HistoryState = {
            elements: JSON.parse(JSON.stringify(elements)),
            canvasData: canvas.toDataURL()
        };

        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newState);
        
        // Limit history to 20 steps for memory
        if (newHistory.length > 20) newHistory.shift();
        
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
    }, [elements, history, historyStep]);

    // Initialize Canvas with Image
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const maxWidth = window.innerWidth * 0.9;
            const maxHeight = window.innerHeight * 0.6;
            let scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Initial history entry
            pushToHistory();
        };
    }, [imageUrl]);

    const handleUndo = () => {
        if (historyStep <= 0) return;
        
        const prevStep = historyStep - 1;
        const state = history[prevStep];
        
        setElements(JSON.parse(JSON.stringify(state.elements)));
        setHistoryStep(prevStep);
        
        // Restore canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
                img.src = state.canvasData;
            }
        }
    };

    const handleRedo = () => {
        if (historyStep >= history.length - 1) return;
        
        const nextStep = historyStep + 1;
        const state = history[nextStep];
        
        setElements(JSON.parse(JSON.stringify(state.elements)));
        setHistoryStep(nextStep);

        // Restore canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
                img.src = state.canvasData;
            }
        }
    };

    // Cropper Logic
    const startCropping = () => {
        if (!imgRef.current) return;
        setIsCropping(true);
        cropperRef.current = new Cropper(imgRef.current, {
            viewMode: 1,
            autoCropArea: 1,
            responsive: true,
            restore: false,
        });
    };

    const applyCrop = () => {
        if (!cropperRef.current) return;
        const croppedCanvas = cropperRef.current.getCroppedCanvas();
        
        // To integrate crop with history, we essentially start over with a new base image
        onSave(croppedCanvas.toDataURL('image/jpeg', 0.9)); 
        cropperRef.current.destroy();
        setIsCropping(false);
    };

    const cancelCrop = () => {
        if (cropperRef.current) {
            cropperRef.current.destroy();
            setIsCropping(false);
        }
    };

    // Drawing Logic (Pen)
    const handleCanvasAction = (e: React.MouseEvent | React.TouchEvent, type: 'start' | 'move' | 'end') => {
        if (isCropping || tool !== 'pen') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        if (type === 'start') {
            setIsDrawing(true);
            ctx.beginPath();
            ctx.moveTo(x, y);
        } else if (type === 'move' && isDrawing) {
            ctx.lineTo(x, y);
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        } else if (type === 'end' && isDrawing) {
            setIsDrawing(false);
            pushToHistory();
        }
    };

    // Active Element Interaction
    const addElement = (e: React.MouseEvent) => {
        if (isCropping || tool === 'pen') return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newEl: EditorElement = {
            id: `el-${Date.now()}`,
            type: tool,
            x: x - (tool === 'text' ? 50 : 25),
            y: y - (tool === 'text' ? 15 : 25),
            color: activeColor,
            content: tool === 'text' ? 'TAP TO EDIT' : undefined,
            width: tool === 'text' ? undefined : 60,
            height: tool === 'text' ? undefined : 60,
            fontSize: tool === 'text' ? 24 : undefined
        };

        const nextElements = [...elements, newEl];
        setElements(nextElements);
        setTool('pen'); 
        
        // Push history after setting state
        // elements state won't be updated until next render, so we pass explicit value if possible
        // but pushToHistory uses elements from closure, so we need a slight delay or manual pass
        setTimeout(() => pushToHistory(), 10);
    };

    const handleElementDragStart = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setActiveElementId(id);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleElementDrag = (e: React.MouseEvent) => {
        if (!activeElementId || !dragStart) return;
        
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        setElements(prev => prev.map(el => 
            el.id === activeElementId 
                ? { ...el, x: el.x + dx, y: el.y + dy }
                : el
        ));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleElementDragEnd = () => {
        if (activeElementId) {
            pushToHistory();
        }
        setDragStart(null);
        setActiveElementId(null);
    };

    const updateElementContent = (id: string, content: string) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, content } : el));
        pushToHistory();
    };

    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleCommit = async () => {
        if (!containerRef.current) return;
        setIsRendering(true);
        
        try {
            const canvas = await html2canvas(containerRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                logging: false,
            });
            onSave(canvas.toDataURL('image/jpeg', 0.9));
        } catch (err) {
            console.error("Editor commit failed", err);
        } finally {
            setIsRendering(false);
        }
    };

    const toolButtons: { id: typeof tool | 'crop' | 'rotate', icon: React.ReactNode, label: string, action?: () => void }[] = [
        { id: 'crop' as any, icon: <Crop size={20} />, label: 'Crop', action: startCropping },
        { id: 'rotate' as any, icon: <RotateCw size={20} />, label: 'Rotate', action: handleRotate },
        { id: 'pen', icon: <Highlighter size={20} />, label: 'Pen' },
        { id: 'text', icon: <Type size={20} />, label: 'Text' },
        { id: 'sticker' as any, icon: <Smile size={20} />, label: 'Sticker', action: () => setShowEmojiPicker(!showEmojiPicker) },
        { id: 'rect', icon: <Square size={18} />, label: 'Box' },
        { id: 'circle', icon: <Circle size={18} />, label: 'Circle' },
        { id: 'arrow', icon: <ArrowUp size={18} className="rotate-45" />, label: 'Arrow' },
    ];

    const colorPalette = ['#ff0000', '#ffff00', '#00ff00', '#ffffff', '#000000'];

    return (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col animate-in fade-in select-none overflow-hidden">
            {/* Top Bar — Compact: Cancel + Undo/Redo */}
            <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 text-white shrink-0 z-30">
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-90">
                    <X size={24} strokeWidth={2.5} />
                </button>
                
                {!isCropping ? (
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleUndo} 
                            disabled={historyStep <= 0}
                            className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-20 active:scale-90"
                            title="Undo"
                        >
                            <Undo2 size={20} />
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={historyStep >= history.length - 1}
                            className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-20 active:scale-90"
                            title="Redo"
                        >
                            <Redo2 size={20} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 animate-in slide-in-from-top-2">
                        <button onClick={cancelCrop} className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase active:scale-95">Cancel</button>
                        <button onClick={applyCrop} className="px-5 py-2 bg-indigo-600 rounded-full text-[10px] font-black uppercase shadow-lg active:scale-95">Apply</button>
                    </div>
                )}
            </div>

            {/* Emoji Picker Overlay */}
            {showEmojiPicker && (
                <div className="absolute top-14 md:top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-2xl shadow-2xl flex gap-3 animate-in zoom-in-95">
                    {EMOJIS.map(e => (
                        <button 
                            key={e} 
                            onClick={() => {
                                setElements([...elements, { id: `st-${Date.now()}`, type: 'sticker', x: 100, y: 100, content: e, color: '' }]);
                                setShowEmojiPicker(false);
                                pushToHistory();
                            }}
                            className="text-3xl hover:scale-125 active:scale-90 transition-transform"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Editor Canvas Area — Maximum space */}
            <div className="flex-1 flex items-center justify-center px-2 py-1 md:p-8 overflow-hidden min-h-0">
                <div 
                    ref={containerRef}
                    className="relative shadow-2xl transition-transform duration-300 origin-center max-w-full max-h-full"
                    style={{ 
                        transform: `rotate(${rotation}deg)`,
                        cursor: tool === 'pen' ? 'crosshair' : 'default'
                    }}
                    onMouseMove={handleElementDrag}
                    onMouseUp={handleElementDragEnd}
                    onMouseLeave={handleElementDragEnd}
                >
                    <img 
                        ref={imgRef}
                        src={imageUrl} 
                        className={`max-w-full max-h-[65vh] md:max-h-[60vh] rounded-xl pointer-events-none ${isCropping ? 'opacity-0' : 'opacity-100'}`}
                        alt="Editor Base" 
                    />

                    {!isCropping && (
                        <canvas 
                            ref={canvasRef}
                            className="absolute inset-0 z-10 touch-none rounded-xl"
                            onMouseDown={(e) => handleCanvasAction(e, 'start')}
                            onMouseMove={(e) => handleCanvasAction(e, 'move')}
                            onMouseUp={(e) => handleCanvasAction(e, 'end')}
                            onTouchStart={(e) => handleCanvasAction(e, 'start')}
                            onTouchMove={(e) => handleCanvasAction(e, 'move')}
                            onTouchEnd={(e) => handleCanvasAction(e, 'end')}
                            onClick={(e) => tool !== 'pen' && addElement(e)}
                        />
                    )}

                    {!isCropping && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            {elements.map((el) => {
                                const isFocused = activeElementId === el.id;
                                return (
                                    <div
                                        key={el.id}
                                        style={{ left: el.x, top: el.y, position: 'absolute', pointerEvents: 'auto', cursor: isFocused ? 'grabbing' : 'grab' }}
                                        onMouseDown={(e) => handleElementDragStart(e, el.id)}
                                        className={`group/el ${isFocused ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-black rounded-lg' : ''}`}
                                    >
                                        {el.type === 'text' && (
                                            <div contentEditable suppressContentEditableWarning
                                                onBlur={(e) => updateElementContent(el.id, e.currentTarget.textContent || '')}
                                                style={{ color: el.color, fontSize: el.fontSize, fontWeight: '900' }}
                                                className="outline-none whitespace-nowrap bg-black/20 px-3 py-1 rounded backdrop-blur-sm shadow-xl uppercase tracking-tight"
                                            >{el.content}</div>
                                        )}
                                        {el.type === 'sticker' && <div className="text-6xl drop-shadow-2xl">{el.content}</div>}
                                        {el.type === 'rect' && <div style={{ width: el.width, height: el.height, borderColor: el.color, borderWidth: 4, borderStyle: 'solid' }} className="rounded-lg shadow-xl" />}
                                        {el.type === 'circle' && <div style={{ width: el.width, height: el.height, borderColor: el.color, borderWidth: 4, borderStyle: 'solid' }} className="rounded-full shadow-xl" />}
                                        {el.type === 'arrow' && <div style={{ color: el.color }} className="relative"><ArrowUp size={48} strokeWidth={4} className="rotate-45" /></div>}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setElements(elements.filter(x => x.id !== el.id)); pushToHistory(); }}
                                            className="absolute -top-6 -right-6 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover/el:opacity-100 transition-all hover:scale-110 shadow-lg pointer-events-auto"
                                        ><X size={12} strokeWidth={4} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Toolbar — WhatsApp-style single bar */}
            {!isCropping && (
                <div className="shrink-0 bg-black/90 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
                    {/* Color Palette Row */}
                    <div className="flex items-center justify-center gap-3 px-4 pt-3 pb-1">
                        {colorPalette.map(c => (
                            <button 
                                key={c} 
                                onClick={() => setActiveColor(c)} 
                                className={`rounded-full transition-all duration-200 ${activeColor === c ? 'w-8 h-8 ring-2 ring-white ring-offset-2 ring-offset-black shadow-lg shadow-white/20' : 'w-6 h-6 border border-white/20 hover:scale-110'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    {/* Tools Row + Send Button */}
                    <div className="flex items-center px-2 py-2 md:px-4 md:py-3 gap-1">
                        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto hide-scrollbar">
                            {toolButtons.map(({ id, icon, label, action }) => {
                                const isActive = (id === 'pen' || id === 'text' || id === 'rect' || id === 'circle' || id === 'arrow') && tool === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => {
                                            if (action) { action(); return; }
                                            setTool(id as typeof tool);
                                        }}
                                        className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-2 py-2 rounded-xl transition-all active:scale-90 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        {icon}
                                        <span className="text-[7px] font-bold uppercase tracking-wider leading-none mt-0.5">{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Commit / Send Button */}
                        <button 
                            onClick={handleCommit}
                            disabled={isRendering}
                            className="ml-2 w-12 h-12 md:w-14 md:h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/40 hover:bg-indigo-500 active:scale-90 transition-all disabled:opacity-30 disabled:scale-100 shrink-0"
                        >
                            {isRendering ? <Loader2 size={22} className="animate-spin" /> : <Check size={26} strokeWidth={3} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface StaffOption {
  id: string;
  name: string;
  unit: string;
  department: string;
  ticketId: string;
}

export interface AuditQuestionOption {
  id: string;
  text: string;
  sectionTitle: string;
  pageTitle: string;
  responses: { text: string; score: string; color: string }[];
  checklistName: string;
  checklistId: string;
  responsibility?: string[];
  department?: string;
  isFollowUp?: boolean;
  category?: string;
}

export interface ChecklistOption {
  id: string;
  title: string;
  scope: string;
  questionCount: number;
}

interface ComplaintFormModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
  onViewImage?: (url: string, label: string) => void;
  availableSops?: string[];
  availableDepartments?: string[];
  availableLocations?: string[];
  availableStaff?: StaffOption[];
  usageFrequencies?: Record<string, Record<string, number>>;
  initialPersistence?: {
      selections: Record<string, string[]>;
      locks: Record<string, boolean>;
  };
  userId?: string | null;
  initialData?: any;
  auditQuestions?: AuditQuestionOption[];
  checklistOptions?: ChecklistOption[];
  locationDepartmentMap?: Record<string, string>;
}

type MentionType = 'location' | 'sop' | 'asset' | 'staff' | 'category' | 'responsibility';

const MOCK_ASSETS = ["Walk-in Chiller 01", "Deep Freezer Alpha-9", "Oven-01", "Blast Chiller XT-500", "Dishwasher H-200"];
const MOCK_STAFF = ["Chef Alex Johnson", "Sous Chef Maria Garcia", "Operator Sam Wilson", "Manager John Miller", "QA Sarah Thompson"];
const FALLBACK_SOPS = ["Storage Control", "Supplier Approval & Receiving Control", "Food Processing & Handling", "Temperature Control", "Cooking Oil Management", "Cleaning, Sanitation & Chemical Control", "Waste Management", "Facility & Infrastructure Control", "Personnel Health & Hygiene", "Service & Distribution"];
const FALLBACK_LOCATIONS = ["Rambagh Palace", "Jai Mahal Palace", "Ramgarh Lodge", "Taj Devi Ratn", "Taj Amer", "Taj Sawai", "Taj Maharaja Lodge", "Others"];
const FALLBACK_DEPARTMENTS = ["Food Production", "Engineering", "F&B Service", "Kitchen Stewarding"];

// --- Collage Studio Types ---
type CollageLayout = 
    | '2-v' | '2-h' | '2-inset' | '2-persp' | '2-cine'
    | '3-anchor' | '3-header' | '3-pillar' | '3-focus' | '3-stair'
    | '4-grid' | '4-hero' | '4-ribbon' | '4-mosaic' | '4-window';

const CropModal: React.FC<{ 
    imageUrl: string, 
    onSave: (croppedUrl: string) => void, 
    onCancel: () => void 
}> = ({ imageUrl, onSave, onCancel }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const cropperRef = useRef<Cropper | null>(null);

    useEffect(() => {
        if (imgRef.current) {
            cropperRef.current = new Cropper(imgRef.current, {
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 1,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        }
        return () => {
            if (cropperRef.current) {
                cropperRef.current.destroy();
            }
        };
    }, []);

    const handleSave = () => {
        if (cropperRef.current) {
            onSave(cropperRef.current.getCroppedCanvas().toDataURL('image/jpeg', 0.9));
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="relative max-w-full max-h-[70vh]">
                <img ref={imgRef} src={imageUrl} alt="To crop" className="max-w-full max-h-[70vh] block" />
            </div>
            <div className="mt-8 flex gap-4">
                <button onClick={onCancel} className="px-8 py-3 bg-white/10 text-white rounded-xl text-sm font-bold">Cancel</button>
                <button onClick={handleSave} className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg">Save Crop</button>
            </div>
        </div>
    );
};

const CollageStudio: React.FC<{ 
    initialImages: string[], 
    onSave: (dataUrl: string, finalImages: string[]) => void, 
    onClose: () => void 
}> = ({ initialImages, onSave, onClose }) => {
    const [images, setImages] = useState<string[]>(initialImages);
    const [rotations, setRotations] = useState<number[]>(new Array(initialImages.length).fill(0));
    const [croppingIndex, setCroppingIndex] = useState<number | null>(null);

    const count = images.length;
    const [layout, setLayout] = useState<CollageLayout>(
        count === 2 ? '2-v' : count === 3 ? '3-anchor' : '4-grid'
    );
    const [rounding, setRounding] = useState<'none' | 'soft' | 'full'>('none');
    const [border, setBorder] = useState<'none' | 'thin' | 'thick'>('thin');
    const [isRendering, setIsRendering] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    
    // Split Ratios for Resizing (Value from 10 to 90)
    const [mainSplitRatio, setMainSplitRatio] = useState(50);
    const [subSplitRatio, setSubSplitRatio] = useState(50);
    const [isResizing, setIsResizing] = useState<'main' | 'sub' | null>(null);

    const collageRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Re-calculate default layout if count changes significantly
    useEffect(() => {
        if (count === 2 && !layout.startsWith('2-')) setLayout('2-v');
        else if (count === 3 && !layout.startsWith('3-')) setLayout('3-anchor');
        else if (count >= 4 && !layout.startsWith('4-')) setLayout('4-grid');
    }, [count, layout]);

    const handleGenerate = async () => {
        if (!collageRef.current) return;
        setIsRendering(true);
        try {
            const canvas = await html2canvas(collageRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff'
            });
            onSave(canvas.toDataURL('image/jpeg', 0.9), images);
        } catch (err) {
            console.error("Collage generation failed", err);
        } finally {
            setIsRendering(false);
        }
    };

    const handleAddMore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const compressed = await compressImage(ev.target?.result as string);
                setImages(prev => [...prev, compressed]);
                setRotations(prev => [...prev, 0]);
            };
            reader.readAsDataURL(file as Blob);
        });
        e.target.value = '';
    };

    const handleRemoveImage = (idx: number) => {
        if (images.length <= 2) {
            alert("A collage requires at least 2 images.");
            return;
        }
        setImages(prev => prev.filter((_, i) => i !== idx));
        setRotations(prev => prev.filter((_, i) => i !== idx));
    };

    const handleMove = (idx: number, direction: 'left' | 'right') => {
        const nextIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (nextIdx < 0 || nextIdx >= images.length) return;
        
        const newImages = [...images];
        const newRots = [...rotations];
        
        [newImages[idx], newImages[nextIdx]] = [newImages[nextIdx], newImages[idx]];
        [newRots[idx], newRots[nextIdx]] = [newRots[nextIdx], newRots[idx]];
        
        setImages(newImages);
        setRotations(newRots);
    };

    const handleDragStart = (idx: number) => {
        if (isResizing) return;
        setDraggedIndex(idx);
    };

    const handleDragOver = (e: React.DragEvent, idx: number) => {
        if (isResizing) return;
        e.preventDefault();
        setDragOverIndex(idx);
    };

    const handleDrop = (targetIdx: number) => {
        if (draggedIndex === null || draggedIndex === targetIdx) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }
        const newImages = [...images];
        const newRots = [...rotations];

        [newImages[draggedIndex], newImages[targetIdx]] = [newImages[targetIdx], newImages[draggedIndex]];
        [newRots[draggedIndex], newRots[targetIdx]] = [newRots[targetIdx], newRots[draggedIndex]];

        setImages(newImages);
        setRotations(newRots);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleRotateTile = (idx: number) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = img.height;
            canvas.height = img.width;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            const rotatedUrl = canvas.toDataURL('image/jpeg', 0.92);
            setImages(prev => prev.map((im, i) => i === idx ? rotatedUrl : im));
        };
        img.src = images[idx];
    };

    const handleCropSave = (idx: number, croppedUrl: string) => {
        setImages(prev => prev.map((img, i) => i === idx ? croppedUrl : img));
        setCroppingIndex(null);
    };

    // --- Resizing Logic ---
    const handleResizeStart = (type: 'main' | 'sub') => (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        setIsResizing(type);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isResizing || !collageRef.current) return;
            
            const rect = collageRef.current.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            if (isResizing === 'main') {
                const isHorizontal = layout === '2-h' || layout === '3-header';
                if (isHorizontal) {
                    const ratio = ((clientY - rect.top) / rect.height) * 100;
                    setMainSplitRatio(Math.min(90, Math.max(10, ratio)));
                } else {
                    const ratio = ((clientX - rect.left) / rect.width) * 100;
                    setMainSplitRatio(Math.min(90, Math.max(10, ratio)));
                }
            } else if (isResizing === 'sub') {
                const ratio = ((clientY - rect.top) / rect.height) * 100;
                setSubSplitRatio(Math.min(90, Math.max(10, ratio)));
            }
        };

        const handleMouseUp = () => setIsResizing(null);

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove);
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isResizing, layout]);

    const getRoundingClass = () => {
        if (rounding === 'soft') return 'rounded-xl';
        if (rounding === 'full') return 'rounded-[2rem]';
        return 'rounded-none';
    };

    const getBorderClass = () => {
        if (border === 'thin') return 'p-1';
        if (border === 'thick') return 'p-3';
        return 'p-0';
    };

    const renderDraggableImage = (idx: number, containerClass: string) => {
        const rnd = getRoundingClass();
        const url = images[idx] || images[0];
        const rot = rotations[idx] || 0;
        const isDragging = draggedIndex === idx;
        const isDragOver = dragOverIndex === idx && !isDragging;

        return (
            <div 
                className={`relative group/tile overflow-hidden ${containerClass} ${rnd} ${isDragging ? 'opacity-30' : 'opacity-100'} ${isDragOver ? 'ring-4 ring-indigo-500 ring-inset scale-[0.98]' : ''} transition-all cursor-move`}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                draggable={!isResizing}
            >
                <img 
                    src={url} 
                    className="w-full h-full object-cover pointer-events-none" 
                    alt={`Collage element ${idx}`}
                />
                
                {/* Tile Action Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 group-hover/tile:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRotateTile(idx); }}
                        className="p-2 bg-white rounded-lg text-indigo-600 hover:scale-110 transition-transform shadow-lg"
                        title="Rotate 90°"
                    >
                        <RotateCw size={18} strokeWidth={2.5} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setCroppingIndex(idx); }}
                        className="p-2 bg-white rounded-lg text-indigo-600 hover:scale-110 transition-transform shadow-lg"
                        title="Crop Image"
                    >
                        <Crop size={18} strokeWidth={2.5} />
                    </button>
                    <div className="p-2 bg-slate-900 rounded-lg text-white opacity-50 cursor-grab active:cursor-grabbing">
                        <Move size={18} />
                    </div>
                </div>
            </div>
        );
    };

    const renderLayout = () => {
        const brd = getBorderClass();
        const main = mainSplitRatio;
        const sub = subSplitRatio;

        // --- 2 IMAGES ---
        if (count === 2 || layout.startsWith('2-')) {
            if (layout === '2-h') return (
                <div className={`grid w-full h-full bg-white relative ${brd}`} style={{ gridTemplateRows: `${main}% ${100-main}%`, gap: '8px' }}>
                    {renderDraggableImage(0, "h-full")}
                    <div 
                        onMouseDown={handleResizeStart('main')}
                        className="absolute left-0 right-0 h-4 -translate-y-1/2 cursor-ns-resize z-20 flex items-center justify-center group/resize"
                        style={{ top: `${main}%` }}
                    >
                        <div className="w-12 h-1.5 bg-slate-300 rounded-full group-hover/resize:bg-indigo-500 transition-colors flex items-center justify-center">
                            <GripHorizontal size={10} className="text-white" />
                        </div>
                    </div>
                    {renderDraggableImage(1, "h-full")}
                </div>
            );
            
            if (layout === '2-v' || layout === '2-persp') {
                return (
                    <div className={`grid w-full h-full bg-white relative ${brd}`} style={{ gridTemplateColumns: `${main}% ${100-main}%`, gap: '8px' }}>
                        {renderDraggableImage(0, "h-full")}
                        <div 
                            onMouseDown={handleResizeStart('main')}
                            className="absolute top-0 bottom-0 w-4 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group/resize"
                            style={{ left: `${main}%` }}
                        >
                            <div className="h-12 w-1.5 bg-slate-300 rounded-full group-hover/resize:bg-indigo-500 transition-colors flex items-center justify-center">
                                <GripVertical size={10} className="text-white" />
                            </div>
                        </div>
                        {renderDraggableImage(1, "h-full")}
                    </div>
                );
            }

            if (layout === '2-inset') return (
                <div className={`relative w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(0, "w-full h-full")}
                    <div className="absolute bottom-4 right-4 w-1/3 h-1/3 shadow-2xl border-4 border-white rounded-xl overflow-hidden">
                        {renderDraggableImage(1, "w-full h-full")}
                    </div>
                </div>
            );
            if (layout === '2-cine') return (
                <div className={`flex flex-col justify-center gap-4 w-full h-full bg-slate-900 ${brd}`}>
                    {renderDraggableImage(0, "h-[35%]")}
                    {renderDraggableImage(1, "h-[35%]")}
                </div>
            );
            return null;
        }

        // --- 3 IMAGES ---
        if (count === 3 || layout.startsWith('3-')) {
            if (layout === '3-anchor') return (
                <div className={`grid w-full h-full bg-white relative ${brd}`} style={{ gridTemplateColumns: `${main}% ${100-main}%`, gap: '8px' }}>
                    {renderDraggableImage(0, "h-full")}
                    <div 
                        onMouseDown={handleResizeStart('main')}
                        className="absolute top-0 bottom-0 w-4 -translate-x-1/2 cursor-ew-resize z-20 flex items-center justify-center group/resize"
                        style={{ left: `${main}%` }}
                    >
                        <div className="h-12 w-1.5 bg-slate-300 rounded-full group-hover/resize:bg-indigo-500 transition-colors flex items-center justify-center">
                            <GripVertical size={10} className="text-white" />
                        </div>
                    </div>
                    <div className="grid h-full relative" style={{ gridTemplateRows: `${sub}% ${100-sub}%`, gap: '8px' }}>
                        {renderDraggableImage(1, "h-full")}
                        <div 
                            onMouseDown={handleResizeStart('sub')}
                            className="absolute left-0 right-0 h-4 -translate-y-1/2 cursor-ns-resize z-20 flex items-center justify-center group/resize"
                            style={{ top: `${sub}%` }}
                        >
                            <div className="w-10 h-1 bg-slate-200 rounded-full group-hover/resize:bg-indigo-400 transition-colors" />
                        </div>
                        {renderDraggableImage(2, "h-full")}
                    </div>
                </div>
            );

            if (layout === '3-header') return (
                <div className={`grid w-full h-full bg-white relative ${brd}`} style={{ gridTemplateRows: `${main}% ${100-main}%`, gap: '8px' }}>
                    <div className="h-full">{renderDraggableImage(0, "h-full")}</div>
                    <div 
                        onMouseDown={handleResizeStart('main')}
                        className="absolute left-0 right-0 h-4 -translate-y-1/2 cursor-ns-resize z-20 flex items-center justify-center group/resize"
                        style={{ top: `${main}%` }}
                    >
                        <div className="w-12 h-1.5 bg-slate-300 rounded-full group-hover/resize:bg-indigo-500 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 h-full">
                        {renderDraggableImage(1, "h-full")}
                        {renderDraggableImage(2, "h-full")}
                    </div>
                </div>
            );

            if (layout === '3-pillar') return (
                <div className={`grid grid-cols-3 gap-2 w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(0, "h-full")}
                    {renderDraggableImage(1, "h-full")}
                    {renderDraggableImage(2, "h-full")}
                </div>
            );
            if (layout === '3-focus') return (
                <div className={`grid grid-cols-12 gap-2 w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(1, "col-span-3 h-full")}
                    {renderDraggableImage(0, "col-span-6 h-full")}
                    {renderDraggableImage(2, "col-span-3 h-full")}
                </div>
            );
            if (layout === '3-stair') return (
                <div className={`grid grid-cols-3 grid-rows-3 gap-2 w-full h-full bg-white ${brd}`}>
                    <div className="col-span-2 row-span-2">{renderDraggableImage(0, "h-full")}</div>
                    <div className="col-span-1 row-span-1">{renderDraggableImage(1, "h-full")}</div>
                    <div className="col-span-1 row-span-2">{renderDraggableImage(2, "h-full")}</div>
                </div>
            );
            return null;
        }

        // --- 4+ IMAGES ---
        if (count >= 4 || layout.startsWith('4-')) {
            if (layout === '4-hero') return (
                <div className={`grid grid-rows-4 gap-2 w-full h-full bg-white ${brd}`}>
                    <div className="row-span-3 h-full">{renderDraggableImage(0, "h-full")}</div>
                    <div className="row-span-1 grid grid-cols-3 gap-2 h-full">
                        {renderDraggableImage(1, "h-full")}
                        {renderDraggableImage(2, "h-full")}
                        {renderDraggableImage(3, "h-full")}
                    </div>
                </div>
            );
            if (layout === '4-ribbon') return (
                <div className={`grid grid-rows-4 gap-2 w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(0, "h-full")}
                    {renderDraggableImage(1, "h-full")}
                    {renderDraggableImage(2, "h-full")}
                    {renderDraggableImage(3, "h-full")}
                </div>
            );
            if (layout === '4-mosaic') return (
                <div className={`grid grid-cols-10 grid-rows-10 gap-2 w-full h-full bg-white ${brd}`}>
                    <div className="col-span-6 row-span-6">{renderDraggableImage(0, "h-full")}</div>
                    <div className="col-span-4 row-span-4">{renderDraggableImage(1, "h-full")}</div>
                    <div className="col-span-4 row-span-6">{renderDraggableImage(2, "h-full")}</div>
                    <div className="col-span-6 row-span-4">{renderDraggableImage(3, "h-full")}</div>
                </div>
            );
            if (layout === '4-window') return (
                <div className={`grid grid-cols-4 gap-2 w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(0, "h-full")}
                    {renderDraggableImage(1, "h-full")}
                    {renderDraggableImage(2, "h-full")}
                    {renderDraggableImage(3, "h-full")}
                </div>
            );
            return ( // 4-grid (Default)
                <div className={`grid grid-cols-2 grid-rows-2 gap-2 w-full h-full bg-white ${brd}`}>
                    {renderDraggableImage(0, "h-full")}
                    {renderDraggableImage(1, "h-full")}
                    {renderDraggableImage(2, "h-full")}
                    {renderDraggableImage(3, "h-full")}
                </div>
            );
        }
    };

    const layoutOptions = count === 2
        ? [{ id: '2-v', icon: Columns }, { id: '2-h', icon: Rows }, { id: '2-inset', icon: Layout }, { id: '2-persp', icon: StretchHorizontal }, { id: '2-cine', icon: Maximize }]
        : count === 3
        ? [{ id: '3-anchor', icon: Grid }, { id: '3-header', icon: Rows }, { id: '3-pillar', icon: Columns }, { id: '3-focus', icon: LayoutTemplate }, { id: '3-stair', icon: Layout }]
        : [{ id: '4-grid', icon: Grid }, { id: '4-hero', icon: Layout }, { id: '4-ribbon', icon: Rows }, { id: '4-mosaic', icon: LayoutTemplate }, { id: '4-window', icon: Columns }];

    return (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col animate-in fade-in select-none overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 text-white shrink-0 bg-[#1a1a2e] border-b border-white/5 z-10">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="p-2 md:p-2.5 bg-indigo-600 rounded-xl md:rounded-2xl shadow-lg"><LayoutTemplate size={18} /></div>
                    <div>
                        <h3 className="text-sm md:text-base font-black uppercase tracking-tight leading-none">Collage Studio</h3>
                        <p className="text-[8px] md:text-[9px] font-bold text-indigo-300 uppercase mt-0.5 tracking-widest">{count} Photos</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-white active:scale-90"><X size={22} /></button>
            </div>

            {/* Main Content — Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                <div className="flex flex-col items-center px-3 py-4 md:px-8 md:py-6 gap-4 md:gap-6">
                    {/* Collage Preview */}
                    <div 
                        ref={collageRef}
                        className="w-full max-w-[320px] md:max-w-[400px] aspect-square border-4 md:border-8 border-white/10 shadow-2xl bg-slate-900 relative overflow-hidden rounded-2xl md:rounded-3xl"
                    >
                        {renderLayout()}
                    </div>

                    {/* Source Thumbnails */}
                    <div className="w-full max-w-[480px]">
                        <div className="flex items-center justify-between px-1 mb-2">
                            <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Photos ({count})</h4>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 text-indigo-300 rounded-lg text-[9px] font-black uppercase hover:bg-white/20 transition-all active:scale-95"
                            >
                                <PlusCircle size={12}/> Add
                            </button>
                            <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAddMore} />
                        </div>
                        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 px-1 hide-scrollbar snap-x">
                            {images.map((img, i) => (
                                <div key={i} className="relative group shrink-0 snap-start">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden border-2 border-white/10 shadow-lg transition-all group-hover:border-indigo-400">
                                        <img src={img} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl md:rounded-2xl flex flex-col items-center justify-center gap-1.5">
                                        <div className="flex gap-1">
                                            <button onClick={() => handleMove(i, 'left')} disabled={i === 0} className="p-1 bg-white rounded text-indigo-600 disabled:opacity-30 active:scale-90 transition-transform"><ArrowLeft size={12}/></button>
                                            <button onClick={() => handleMove(i, 'right')} disabled={i === images.length - 1} className="p-1 bg-white rounded text-indigo-600 disabled:opacity-30 active:scale-90 transition-transform"><ArrowRight size={12}/></button>
                                        </div>
                                        <button onClick={() => handleRemoveImage(i)} className="p-1 bg-rose-500 rounded text-white active:scale-90 transition-transform"><Trash2 size={12}/></button>
                                    </div>
                                    <div className="absolute -top-1 -left-1 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px] font-black border-2 border-black shadow-sm">{i+1}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Layout Options */}
                    <div className="w-full max-w-[480px]">
                        <h4 className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-2">Layout</h4>
                        <div className="flex gap-2 md:gap-3 justify-center items-center overflow-x-auto hide-scrollbar px-1 py-1">
                            {layoutOptions.map(lt => (
                                <button 
                                    key={lt.id}
                                    onClick={() => { setLayout(lt.id as any); setMainSplitRatio(50); }}
                                    className={`w-11 h-11 md:w-12 md:h-12 rounded-xl md:rounded-2xl border-2 flex items-center justify-center transition-all shrink-0 active:scale-90 ${layout === lt.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105' : 'bg-white/5 border-white/10 text-slate-400 hover:border-indigo-400 hover:text-white'}`}
                                >
                                    <lt.icon size={20} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Style Controls */}
                    <div className="w-full max-w-[480px] grid grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Edges</label>
                            <select 
                                value={rounding} 
                                onChange={e => setRounding(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none focus:border-indigo-400 transition-all appearance-none"
                            >
                                <option value="none" className="bg-slate-900">Sharp</option>
                                <option value="soft" className="bg-slate-900">Rounded</option>
                                <option value="full" className="bg-slate-900">Full Round</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Spacing</label>
                            <select 
                                value={border} 
                                onChange={e => setBorder(e.target.value as any)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-bold text-white outline-none focus:border-indigo-400 transition-all appearance-none"
                            >
                                <option value="none" className="bg-slate-900">None</option>
                                <option value="thin" className="bg-slate-900">Thin</option>
                                <option value="thick" className="bg-slate-900">Wide</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar — Fixed */}
            <div className="shrink-0 bg-[#1a1a2e] border-t border-white/5 px-3 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3 safe-area-bottom">
                <button onClick={onClose} className="px-4 py-2.5 md:px-6 md:py-3 text-[10px] md:text-xs font-black uppercase text-slate-400 hover:text-white tracking-widest transition-all active:scale-95">Discard</button>
                <button 
                    onClick={handleGenerate}
                    disabled={isRendering}
                    className="flex-1 max-w-[280px] py-3 md:py-3.5 bg-indigo-600 text-white rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-wider shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    {isRendering ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} strokeWidth={3} />}
                    Save Collage
                </button>
            </div>

            {croppingIndex !== null && (
                <CropModal 
                    imageUrl={images[croppingIndex]} 
                    onSave={(url) => handleCropSave(croppingIndex, url)} 
                    onCancel={() => setCroppingIndex(null)} 
                />
            )}
        </div>
    );
};

// --- ComplaintFormModal ---

const SPELLING_MAP: Record<string, string> = {
    'teh': 'the', 'thier': 'their', 'recieve': 'receive', 'occured': 'occurred',
    'occuring': 'occurring', 'seperate': 'separate', 'definately': 'definitely',
    'accomodate': 'accommodate', 'occurence': 'occurrence', 'maintainence': 'maintenance',
    'temprature': 'temperature', 'temperture': 'temperature', 'tempature': 'temperature',
    'hygeine': 'hygiene', 'hygene': 'hygiene', 'hyigene': 'hygiene',
    'sanitisation': 'sanitization', 'contamiation': 'contamination', 'contaminaton': 'contamination',
    'refridgerator': 'refrigerator', 'fridg': 'fridge',
    'equipement': 'equipment', 'equpiment': 'equipment', 'equipments': 'equipment',
    'cleanlyness': 'cleanliness', 'cleaniness': 'cleanliness', 'clenliness': 'cleanliness',
    'complience': 'compliance', 'compliane': 'compliance', 'compliace': 'compliance',
    'insepction': 'inspection', 'inspecton': 'inspection', 'inspction': 'inspection',
    'obervation': 'observation', 'observaton': 'observation', 'obsrvation': 'observation',
    'proceedure': 'procedure', 'procedue': 'procedure', 'procedre': 'procedure',
    'identifed': 'identified', 'identifyed': 'identified',
    'immediatly': 'immediately', 'imediately': 'immediately', 'immedietly': 'immediately',
    'neccessary': 'necessary', 'neccesary': 'necessary', 'necesary': 'necessary',
    'restarant': 'restaurant', 'resturant': 'restaurant', 'restaraunt': 'restaurant',
    'enviroment': 'environment', 'envirnoment': 'environment', 'enviorment': 'environment',
    'expiraton': 'expiration', 'expiray': 'expiry',
    'allergan': 'allergen', 'alegen': 'allergen',
    'saftey': 'safety', 'safty': 'safety',
    'hazrad': 'hazard', 'hazzard': 'hazard',
    'stoarge': 'storage', 'storge': 'storage',
    'ventilaton': 'ventilation',
    'calibartion': 'calibration', 'calibraton': 'calibration',
    'documentaion': 'documentation', 'documention': 'documentation',
    'traning': 'training', 'trainning': 'training',
    'reccomend': 'recommend', 'recomend': 'recommend',
    'managment': 'management', 'managemnt': 'management',
    'requirment': 'requirement', 'requiremnt': 'requirement',
    'corective': 'corrective',
    'preventative': 'preventive',
    'recieved': 'received', 'recived': 'received',
    'appropirate': 'appropriate', 'apropriate': 'appropriate',
    'sufficent': 'sufficient', 'sufficiant': 'sufficient',
    'inadquate': 'inadequate', 'inadequte': 'inadequate',
    'wich': 'which', 'whcih': 'which',
    'becuase': 'because', 'beacuse': 'because', 'becasue': 'because',
    'thru': 'through', 'thrugh': 'through',
    'untill': 'until', 'untl': 'until',
    'excesive': 'excessive', 'exessive': 'excessive',
    'acheive': 'achieve', 'achive': 'achieve',
    'acess': 'access', 'acccess': 'access',
    'brekage': 'breakage', 'breakge': 'breakage',
    'approvel': 'approval', 'aproval': 'approval',
    'dont': "don't", 'doesnt': "doesn't", 'cant': "can't", 'wont': "won't",
    'isnt': "isn't", 'wasnt': "wasn't", 'havent': "haven't", 'hasnt': "hasn't",
    'didnt': "didn't", 'shouldnt': "shouldn't", 'wouldnt': "wouldn't", 'couldnt': "couldn't",
    'alot': 'a lot', 'aswell': 'as well', 'incase': 'in case',
    'noone': 'no one', 'infact': 'in fact', 'neverthless': 'nevertheless',
    'irregardless': 'regardless', 'supposably': 'supposedly',
    'basicly': 'basically', 'prolly': 'probably', 'probly': 'probably',
    'goverment': 'government', 'govermnet': 'government',
    'personel': 'personnel', 'personell': 'personnel',
    'waranty': 'warranty', 'warrantee': 'warranty',
    'priviledge': 'privilege', 'privelege': 'privilege',
    'recomendation': 'recommendation', 'reccommendation': 'recommendation',
    'successfull': 'successful', 'succesfull': 'successful',
    'immediat': 'immediate', 'imediate': 'immediate',
    'excelent': 'excellent', 'excellant': 'excellent',
    'efficent': 'efficient', 'efficiant': 'efficient',
    'consistant': 'consistent', 'consistnet': 'consistent',
    'polution': 'pollution', 'polluton': 'pollution',
    'infomation': 'information', 'informaton': 'information',
    'adress': 'address', 'adres': 'address',
    'develope': 'develop', 'devlop': 'develop',
    'responsable': 'responsible', 'responsibile': 'responsible',
    'availble': 'available', 'avaliable': 'available',
    'diferent': 'different', 'diffrent': 'different',
    'comittee': 'committee', 'commitee': 'committee',
    'unnecesary': 'unnecessary', 'unneccessary': 'unnecessary',
    'beleive': 'believe', 'belive': 'believe',
    'foriegn': 'foreign', 'forein': 'foreign',
    'gaurd': 'guard', 'gard': 'guard',
    'lisence': 'license', 'licence': 'license',
    'paralel': 'parallel', 'parrallel': 'parallel',
    'pharmaseutical': 'pharmaceutical', 'pharmacutical': 'pharmaceutical',
    'posession': 'possession', 'possesion': 'possession',
    'restaraunt': 'restaurant', 'restuarant': 'restaurant',
    'tommorow': 'tomorrow', 'tommorrow': 'tomorrow',
    'wierd': 'weird', 'wired': 'weird',
};

const GRAMMAR_REPLACEMENTS: [RegExp, string][] = [
    [/\btheir is\b/gi, 'there is'],
    [/\btheir are\b/gi, 'there are'],
    [/\btheir was\b/gi, 'there was'],
    [/\btheir were\b/gi, 'there were'],
    [/\bthere ([a-z]+ing)\b/gi, 'their $1'],
    [/\byour ([a-z]+ing)\b/gi, "you're $1"],
    [/\bits a\b/gi, "it's a"],
    [/\bits the\b/gi, "it's the"],
    [/\bits not\b/gi, "it's not"],
    [/\bits been\b/gi, "it's been"],
    [/\bshould of\b/gi, 'should have'],
    [/\bcould of\b/gi, 'could have'],
    [/\bwould of\b/gi, 'would have'],
    [/\bmust of\b/gi, 'must have'],
    [/\bmight of\b/gi, 'might have'],
    [/\ba lot of\b/gi, 'numerous'],
    [/\ba lots of\b/gi, 'numerous'],
    [/\bgonna\b/gi, 'going to'],
    [/\bwanna\b/gi, 'want to'],
    [/\bgotta\b/gi, 'got to'],
    [/\bkinda\b/gi, 'kind of'],
    [/\bsorta\b/gi, 'sort of'],
    [/\bdunno\b/gi, 'do not know'],
    [/\bcuz\b/gi, 'because'],
    [/\bcoz\b/gi, 'because'],
    [/\bbtw\b/gi, 'by the way'],
    [/\basap\b/gi, 'as soon as possible'],
    [/\bpls\b/gi, 'please'],
    [/\bplz\b/gi, 'please'],
    [/\bthx\b/gi, 'thanks'],
    [/\bthnx\b/gi, 'thanks'],
    [/\bu\b/gi, 'you'],
    [/\br\b/gi, 'are'],
    [/\bur\b/gi, 'your'],
    [/\bw\/\b/g, 'with'],
    [/\bw\/o\b/g, 'without'],
    [/\bn\/a\b/gi, 'not applicable'],
    [/\btemp\b/gi, 'temperature'],
    [/\bfridge\b/gi, 'refrigerator'],
    [/\bfood is not\b/gi, 'food items are not'],
    [/\bfoods is\b/gi, 'food items are'],
    [/\bstaffs\b/gi, 'staff members'],
    [/\bwas found that\b/gi, 'has been identified that'],
    [/\bnot good\b/gi, 'unsatisfactory'],
    [/\bvery bad\b/gi, 'critically deficient'],
    [/\breally bad\b/gi, 'severely non-compliant'],
    [/\bpretty bad\b/gi, 'substantially deficient'],
    [/\bnot clean\b/gi, 'inadequately sanitized'],
    [/\bnot working\b/gi, 'non-functional'],
    [/\bnot done\b/gi, 'not completed'],
    [/\bneed to fix\b/gi, 'requires corrective action'],
    [/\bneeds to be fixed\b/gi, 'requires corrective action'],
    [/\bneeds fixing\b/gi, 'requires corrective action'],
    [/\bgot to\b/gi, 'needs to'],
    [/\bhave to\b/gi, 'is required to'],
    [/\bmake sure\b/gi, 'ensure'],
    [/\bget rid of\b/gi, 'eliminate'],
    [/\blook into\b/gi, 'investigate'],
    [/\bcheck out\b/gi, 'inspect'],
    [/\bfind out\b/gi, 'determine'],
    [/\bset up\b/gi, 'establish'],
    [/\bcut down on\b/gi, 'reduce'],
    [/\bgo up\b/gi, 'increase'],
    [/\bgo down\b/gi, 'decrease'],
    [/\bkeep up\b/gi, 'maintain'],
    [/\bput off\b/gi, 'postpone'],
    [/\bcarry out\b/gi, 'execute'],
    [/\bbring up\b/gi, 'raise'],
    [/\bpoint out\b/gi, 'highlight'],
    [/\brun out of\b/gi, 'deplete'],
    [/\bback up\b/gi, 'support'],
    [/\btake care of\b/gi, 'address'],
    [/\bfollow up\b/gi, 'monitor'],
];

const PROFESSIONAL_UPGRADES: [RegExp, string][] = [
    [/\bokay\b/gi, 'acceptable'],
    [/\bok\b/gi, 'acceptable'],
    [/\bgood\b/gi, 'satisfactory'],
    [/\bbig\b/gi, 'significant'],
    [/\bsmall\b/gi, 'minor'],
    [/\bbad\b/gi, 'non-compliant'],
    [/\bdirty\b/gi, 'contaminated'],
    [/\bbroken\b/gi, 'damaged'],
    [/\bold\b/gi, 'expired'],
    [/\bwet\b/gi, 'moisture-affected'],
    [/\brusty\b/gi, 'corroded'],
    [/\bsmelly\b/gi, 'odorous'],
    [/\brotten\b/gi, 'decomposed'],
    [/\bleaking\b/gi, 'compromised'],
    [/\bmissing\b/gi, 'absent'],
    [/\bwrong\b/gi, 'incorrect'],
    [/\bfast\b/gi, 'prompt'],
    [/\bslow\b/gi, 'delayed'],
    [/\blazy\b/gi, 'non-diligent'],
    [/\bworker\b/gi, 'staff member'],
    [/\bworkers\b/gi, 'staff members'],
    [/\bguy\b/gi, 'individual'],
    [/\bguys\b/gi, 'personnel'],
    [/\bboss\b/gi, 'supervisor'],
    [/\bjob\b/gi, 'task'],
    [/\bstuff\b/gi, 'items'],
    [/\bthing\b/gi, 'item'],
    [/\bthings\b/gi, 'items'],
    [/\bplace\b/gi, 'area'],
    [/\bspot\b/gi, 'location'],
    [/\bused\b/gi, 'utilized'],
    [/\bhelp\b/gi, 'assist'],
    [/\bshow\b/gi, 'demonstrate'],
    [/\btry\b/gi, 'attempt'],
    [/\bfix\b/gi, 'rectify'],
    [/\bstop\b/gi, 'cease'],
    [/\bstart\b/gi, 'initiate'],
    [/\bchange\b/gi, 'modify'],
    [/\bbuy\b/gi, 'procure'],
    [/\bget\b/gi, 'obtain'],
    [/\bgive\b/gi, 'provide'],
    [/\btell\b/gi, 'inform'],
    [/\bask\b/gi, 'request'],
    [/\bwatch\b/gi, 'monitor'],
    [/\buse\b/gi, 'utilize'],
    [/\bneed\b/gi, 'require'],
    [/\black\b/gi, 'absence'],
    [/\blacks\b/gi, 'is deficient in'],
    [/\benough\b/gi, 'sufficient'],
    [/\bdue to\b/gi, 'attributed to'],
    [/\bright away\b/gi, 'immediately'],
    [/\bright now\b/gi, 'at this time'],
    [/\ba while ago\b/gi, 'previously'],
    [/\bin the end\b/gi, 'ultimately'],
    [/\bin spite of\b/gi, 'despite'],
    [/\bin order to\b/gi, 'to'],
    [/\bat this point\b/gi, 'currently'],
    [/\bon top of that\b/gi, 'additionally'],
    [/\bas well as\b/gi, 'in addition to'],
];

function preserveMentions(text: string): { cleaned: string; mentions: { ph: string; orig: string }[] } {
    const mentionPattern = /(@\S+|#\S+|\$\S+|\+\S+|\*\S+|!\S+)/g;
    const mentions: { ph: string; orig: string }[] = [];
    const cleaned = text.replace(mentionPattern, (match) => {
        const ph = `__M${mentions.length}__`;
        mentions.push({ ph, orig: match });
        return ph;
    });
    return { cleaned, mentions };
}

function restoreMentions(text: string, mentions: { ph: string; orig: string }[]): string {
    let r = text;
    for (const { ph, orig } of mentions) r = r.replace(ph, orig);
    return r;
}

function fixSpelling(text: string): string {
    return text.replace(/\b(\w+)\b/g, (word) => {
        const lower = word.toLowerCase();
        const fix = SPELLING_MAP[lower];
        if (!fix) return word;
        if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
            return fix.charAt(0).toUpperCase() + fix.slice(1);
        }
        return fix;
    });
}

function applyReplacements(text: string, rules: [RegExp, string][]): string {
    let r = text;
    for (const [pat, rep] of rules) r = r.replace(pat, rep);
    return r;
}

function normalizePunctuation(text: string): string {
    let r = text;
    r = r.replace(/\s{2,}/g, ' ');
    r = r.replace(/\s+([.,;:!?])/g, '$1');
    r = r.replace(/([.,;:!?])(?=[A-Za-z])/g, '$1 ');
    r = r.replace(/\bi\b/g, 'I');
    r = r.replace(/\.{2,}/g, '.');
    r = r.replace(/,,+/g, ',');
    r = r.replace(/;;+/g, ';');
    return r;
}

function capitalizeSentences(text: string): string {
    return text.replace(/(^|[.!?]\s+)([a-z_])/g, (match, pre, letter) => {
        if (letter === '_') return match;
        return pre + letter.toUpperCase();
    });
}

function ensureEndPunctuation(text: string): string {
    const t = text.trim();
    if (!t) return t;
    if (['.', '!', '?'].includes(t.slice(-1))) return t;
    return t + '.';
}

function splitSentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

function rebuildSentences(text: string): string {
    const sents = splitSentences(text);
    if (sents.length === 0) {
        let r = text.trim();
        if (!r) return r;
        r = r.charAt(0).toUpperCase() + r.slice(1);
        return ensureEndPunctuation(r);
    }
    return sents.map(s => {
        let t = s.trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (!['.', '!', '?'].includes(t.slice(-1))) t += '.';
        return t;
    }).join(' ');
}

function buildCorrected(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    return rebuildSentences(r);
}

function buildProfessional(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = applyReplacements(r, PROFESSIONAL_UPGRADES);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    return rebuildSentences(r);
}

function buildConcise(text: string): string {
    let r = fixSpelling(text);
    r = applyReplacements(r, GRAMMAR_REPLACEMENTS);
    r = normalizePunctuation(r);
    r = capitalizeSentences(r);
    const sents = splitSentences(r);
    if (sents.length <= 1) return rebuildSentences(r);
    return sents.map(s => {
        let t = s.trim();
        t = t.replace(/\s*(however|therefore|additionally|furthermore|moreover|consequently)\s*/gi, ' ');
        t = t.replace(/\s{2,}/g, ' ').trim();
        t = t.charAt(0).toUpperCase() + t.slice(1);
        if (!['.', '!', '?'].includes(t.slice(-1))) t += '.';
        return t;
    }).join(' ');
}

function offlineRewriteMulti(text: string): { label: string; text: string; icon: string }[] {
    if (!text.trim()) return [];
    const { cleaned, mentions } = preserveMentions(text);

    const corrected = restoreMentions(buildCorrected(cleaned), mentions);
    const professional = restoreMentions(buildProfessional(cleaned), mentions);
    const concise = restoreMentions(buildConcise(cleaned), mentions);

    return [
        { label: 'Corrected', text: corrected, icon: '✅' },
        { label: 'Professional', text: professional, icon: '✨' },
        { label: 'Concise', text: concise, icon: '⚡' },
    ];
}

const ComplaintFormModal: React.FC<ComplaintFormModalProps> = ({ 
    onClose, 
    onSave, 
    onViewImage,
    availableSops = [], 
    availableLocations = [],
    availableDepartments = [],
    availableStaff = [],
    usageFrequencies = {},
    initialPersistence,
    userId,
    initialData,
    auditQuestions,
    checklistOptions,
    locationDepartmentMap = {}
}) => {
    // Correctly initialize evidenceItems from initialData.allEvidence
    const [evidenceItems, setEvidenceItems] = useState<{file: File | null, url: string, isCompressing?: boolean}[]>(
        initialData?.allEvidence 
            ? initialData.allEvidence.map((ev: any) => ({ file: ev.file || null, url: ev.url, isCompressing: false }))
            : []
    );

    // Identify if the thumbnail is a generated collage to re-hydrate state
    const [collageImage, setCollageImage] = useState<string | null>(
        initialData?.thumbnail?.startsWith('data:image/') ? initialData.thumbnail : null
    );

    const [concern, setConcern] = useState(initialData?.title || '');
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);

    // Standard mode dropdown state
    const [stdLocOpen, setStdLocOpen] = useState(false);
    const [stdLocSearch, setStdLocSearch] = useState('');
    const [stdSopOpen, setStdSopOpen] = useState(false);
    const [stdSopSearch, setStdSopSearch] = useState('');
    const [isStdImgDragging, setIsStdImgDragging] = useState(false);
    const stdImgDragCounter = useRef(0);
    
    const [mentionType, setMentionType] = useState<MentionType | null>(null);
    const [mentionSearch, setMentionSearch] = useState("");
    const [cursorPos, setCursorPos] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const observationContainerRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{top: number, left: number, width: number} | null>(null);
    const cameraCaptureRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const [showMediaMenu, setShowMediaMenu] = useState(false);
    const [isCollageStudioOpen, setIsCollageStudioOpen] = useState(false);
    const [showRewritePanel, setShowRewritePanel] = useState(false);
    const [rewriteOptions, setRewriteOptions] = useState<{label: string, text: string, icon: string}[]>([]);
    const [isGeneratingRewrites, setIsGeneratingRewrites] = useState(false);
    const rewritePanelRef = useRef<HTMLDivElement>(null);
    const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
    const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
    const mediaMenuRef = useRef<HTMLDivElement>(null);

    const isAuditMode = !!(auditQuestions && auditQuestions.length > 0);
    const [aqSearchQ, setAqSearchQ] = useState('');
    const [aqSelectedId, setAqSelectedId] = useState('');
    const [aqShowDropdown, setAqShowDropdown] = useState(false);
    const [aqSelectedResponse, setAqSelectedResponse] = useState<number | null>(null);
    const [aqLocSearch, setAqLocSearch] = useState('');
    const [aqShowLocDropdown, setAqShowLocDropdown] = useState(false);
    const [aqSelectedLocation, setAqSelectedLocation] = useState('');
    const [aqSelectedChecklists, setAqSelectedChecklists] = useState<Set<string>>(new Set());
    const [aqShowChecklistDropdown, setAqShowChecklistDropdown] = useState(false);
    const aqDropdownRef = useRef<HTMLDivElement>(null);
    const aqLocDropdownRef = useRef<HTMLDivElement>(null);
    const aqChecklistDropdownRef = useRef<HTMLDivElement>(null);
    const [aqQuestionLocked, setAqQuestionLocked] = useState(false);
    const [aqLocationLocked, setAqLocationLocked] = useState(false);
    const [expandedAuditEntryId, setExpandedAuditEntryId] = useState<string | null>(null);
    type AuditPopupEntry = { id: string; questionId: string; questionText: string; sectionTitle: string; pageTitle: string; checklistName: string; responsibility: string[]; location: string; selectedResponse: number | null; selectedResponseText: string; concern: string; evidenceItems: { file: File | null; url: string }[] };
    const [completedAuditEntries, setCompletedAuditEntries] = useState<AuditPopupEntry[]>([]);
    const updateAuditEntry = (id: string, updates: Partial<AuditPopupEntry>) => setCompletedAuditEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));

    const aqGroupedChecklists = useMemo(() => {
        if (!checklistOptions || checklistOptions.length === 0) return {};
        const groups: Record<string, ChecklistOption[]> = {};
        checklistOptions.forEach(cl => {
            const scope = cl.scope || 'Other';
            if (!groups[scope]) groups[scope] = [];
            groups[scope].push(cl);
        });
        return groups;
    }, [checklistOptions]);

    const aqScopeOrder = ['Corporate', 'Regional', 'Unit', 'Other'];
    const aqScopeColors: Record<string, string> = {
        Corporate: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        Regional: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        Unit: 'bg-amber-100 text-amber-700 border-amber-200',
        Other: 'bg-gray-100 text-gray-600 border-gray-200',
    };

    const toggleChecklist = (id: string) => {
        setAqSelectedChecklists(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
        setAqSelectedId('');
        setAqSelectedResponse(null);
    };

    const aqSelectedDepartment = useMemo(() => {
        if (!aqSelectedLocation || !locationDepartmentMap) return null;
        return locationDepartmentMap[aqSelectedLocation] || null;
    }, [aqSelectedLocation, locationDepartmentMap]);

    const aqQuestionsForSelectedChecklists = useMemo(() => {
        if (!auditQuestions) return [];
        let base = auditQuestions;
        if (checklistOptions && checklistOptions.length > 0) {
            if (aqSelectedChecklists.size === 0) return [];
            base = base.filter(q => aqSelectedChecklists.has(q.checklistId));
        }
        if (aqSelectedDepartment) {
            const deptLower = aqSelectedDepartment.toLowerCase();
            const deptFiltered = base.filter(q => q.department && q.department.toLowerCase() === deptLower);
            if (deptFiltered.length > 0) return deptFiltered;
        }
        return base;
    }, [auditQuestions, aqSelectedChecklists, checklistOptions, aqSelectedDepartment]);

    const aqFilteredQuestions = useMemo(() => {
        const base = aqQuestionsForSelectedChecklists;
        if (!aqSearchQ.trim()) return base;
        const q = aqSearchQ.toLowerCase();
        return base.filter(item =>
            item.text.toLowerCase().includes(q) ||
            item.sectionTitle.toLowerCase().includes(q) ||
            item.pageTitle.toLowerCase().includes(q) ||
            item.checklistName.toLowerCase().includes(q)
        );
    }, [aqQuestionsForSelectedChecklists, aqSearchQ]);

    const aqSelectedQuestion = useMemo(() => auditQuestions?.find(q => q.id === aqSelectedId), [auditQuestions, aqSelectedId]);

    const aqFilteredLocations = useMemo(() => {
        if (!aqLocSearch.trim()) return availableLocations;
        const q = aqLocSearch.toLowerCase();
        return availableLocations.filter(l => l.toLowerCase().includes(q));
    }, [availableLocations, aqLocSearch]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (aqDropdownRef.current && !aqDropdownRef.current.contains(e.target as Node)) setAqShowDropdown(false);
            if (aqLocDropdownRef.current && !aqLocDropdownRef.current.contains(e.target as Node)) setAqShowLocDropdown(false);
            if (aqChecklistDropdownRef.current && !aqChecklistDropdownRef.current.contains(e.target as Node)) setAqShowChecklistDropdown(false);
        };
        if (aqShowDropdown || aqShowLocDropdown || aqShowChecklistDropdown) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [aqShowDropdown, aqShowLocDropdown, aqShowChecklistDropdown]);

    const handleAqAddMore = () => {
        if (!aqSelectedQuestion) return;
        const selectedResp = aqSelectedResponse !== null && aqSelectedQuestion.responses[aqSelectedResponse]
            ? aqSelectedQuestion.responses[aqSelectedResponse] : null;
        setCompletedAuditEntries(prev => [...prev, {
            id: `ape-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            questionId: aqSelectedQuestion.id,
            questionText: aqSelectedQuestion.text,
            sectionTitle: aqSelectedQuestion.sectionTitle,
            pageTitle: aqSelectedQuestion.pageTitle,
            checklistName: aqSelectedQuestion.checklistName,
            responsibility: aqSelectedQuestion.responsibility || [],
            location: aqSelectedLocation,
            selectedResponse: aqSelectedResponse,
            selectedResponseText: selectedResp?.text || '',
            concern,
            evidenceItems: [...evidenceItems],
        }]);
        setConcern('');
        setEvidenceItems([]);
        if (!aqQuestionLocked) { setAqSelectedId(''); setAqSelectedResponse(null); }
        if (!aqLocationLocked) { setAqSelectedLocation(''); }
        setExpandedAuditEntryId(null);
    };

    const handleAuditModeSave = () => {
        const hasCurrentEntry = aqSelectedQuestion && (concern.trim() || evidenceItems.length > 0 || collageImage);
        if (!hasCurrentEntry && completedAuditEntries.length === 0) return;
        const saveEntry = (q: NonNullable<typeof aqSelectedQuestion>, entryLocation: string, entryResponse: number | null, entryConcern: string, entryEvidence: typeof evidenceItems, entryCollage?: string | null) => {
            const thumbnail = entryCollage || (entryEvidence.length > 0 ? entryEvidence[0].url : null);
            const selectedResp = entryResponse !== null && q.responses[entryResponse] ? q.responses[entryResponse] : null;
            onSave({
                id: undefined,
                title: entryConcern || 'New Observation',
                sop: q.checklistName || 'Audit',
                location: { area: entryLocation || 'Unit' },
                responsibility: (q.responsibility || []).join(', ') || 'General',
                allEvidence: entryEvidence.map(item => ({ file: item.file, url: item.url, type: item.file?.type.startsWith('video/') ? 'video' : 'image' })),
                thumbnail,
                questionId: q.id,
                questionText: q.text,
                sectionTitle: q.sectionTitle,
                pageTitle: q.pageTitle,
                selectedResponse: selectedResp?.text || '',
                checklistName: q.checklistName,
                staffInvolved: [],
                assetId: [],
                foodCategory: [],
            });
        };
        for (const entry of completedAuditEntries) {
            const q = auditQuestions?.find(aq => aq.id === entry.questionId);
            if (!q) continue;
            saveEntry(q, entry.location, entry.selectedResponse, entry.concern, entry.evidenceItems);
        }
        if (hasCurrentEntry && aqSelectedQuestion) {
            saveEntry(aqSelectedQuestion, aqSelectedLocation, aqSelectedResponse, concern, evidenceItems, collageImage);
        }
        setCompletedAuditEntries([]);
        onClose();
    };

    const initialSelections = useMemo(() => {
        if (initialData) {
            return {
                location: initialData.area ? [initialData.area] : [],
                sop: initialData.sop ? [initialData.sop] : [],
                asset: initialData.assets?.map((a: any) => a.name) || [],
                staff: initialData.people?.map((p: any) => p.name) || [],
                category: initialData.categories?.map((c: any) => c.name) || [],
                responsibility: initialData.mainKitchen ? [initialData.mainKitchen] : []
            };
        }
        return initialPersistence?.selections || { location: [], sop: [], asset: [], staff: [], category: [], responsibility: [] };
    }, [initialData, initialPersistence]);

    const [locks, setLocks] = useState<Record<string, boolean>>(initialPersistence?.locks || {
        location: false, sop: false, asset: false, staff: false, category: false, responsibility: false
    });
    const [selections, setSelections] = useState<Record<string, string[]>>(initialSelections);

    // --- Handlers ---

    const processFiles = (fileArray: File[], isCamera: boolean = false) => {
        const imageFiles = (isCamera || fileArray.length === 1) 
            ? (fileArray[0]?.type.startsWith('image/') ? [fileArray[0]] : [])
            : fileArray.filter(f => f.type.startsWith('image/'));
        imageFiles.forEach(file => {
            const placeholderId = `compressing-${Date.now()}-${Math.random()}`;
            setEvidenceItems(prev => [...prev, { file: null, url: '', isCompressing: true, _pid: placeholderId } as any]);
            const reader = new FileReader();
            reader.onload = async (e) => {
                const compressed = await compressImage(e.target?.result as string);
                setEvidenceItems(prev => prev.map(item => (item as any)._pid === placeholderId ? { file: null, url: compressed, isCompressing: false } : item));
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isCamera = e.target.getAttribute('capture') !== null;
        if (e.target.files?.length) processFiles(Array.from(e.target.files), isCamera);
        e.target.value = '';
        setShowMediaMenu(false);
    };

    const handleSaveEditedPhoto = async (editedUrl: string) => {
        const compressed = await compressImage(editedUrl);
        if (editingPhotoIndex !== null) {
            setEvidenceItems(prev => prev.map((item, i) => i === editingPhotoIndex ? { ...item, url: compressed } : item));
        } else {
            setEvidenceItems(prev => [...prev, { file: null, url: compressed, isCompressing: false }]);
        }
        setEditingPhoto(null);
        setEditingPhotoIndex(null);
    };

    const autoResizeTextarea = useCallback(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    }, []);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const pos = e.target.selectionStart || 0;
        setConcern(text);
        setCursorPos(pos);
        autoResizeTextarea();
        const textBeforeCursor = text.slice(0, pos);
        const lastSymbolMatch = textBeforeCursor.match(/([@#$+!*])(\w*)$/);
        if (lastSymbolMatch) {
            const sym = lastSymbolMatch[1];
            const types: Record<string, MentionType> = {
                '@': 'location', 
                '#': 'sop', 
                '$': 'asset', 
                '+': 'staff', 
                '!': 'category', 
                '*': 'responsibility'
            };
            setMentionType(types[sym]);
            setMentionSearch(lastSymbolMatch[2] || "");
        } else {
            setMentionType(null);
        }
    };

    useEffect(() => { autoResizeTextarea(); }, [concern, autoResizeTextarea]);

    const removeSymbolFromText = () => {
        const textBeforeCursor = concern.slice(0, cursorPos);
        const textAfterCursor = concern.slice(cursorPos);
        const symbolMatch = textBeforeCursor.match(/([@#$+!*])\w*$/);
        if (symbolMatch) {
            const prefix = textBeforeCursor.slice(0, symbolMatch.index);
            const cleaned = `${prefix}${textAfterCursor}`.trim();
            const finalPos = prefix.length;
            setConcern(cleaned);
            setCursorPos(finalPos);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(finalPos, finalPos);
                }
            }, 0);
        }
    };

    const applyMention = (value: string, type: string) => {
        const textBeforeCursor = concern.slice(0, cursorPos);
        const textAfterCursor = concern.slice(cursorPos);
        const symbolMatch = textBeforeCursor.match(/([@#$+!*])\w*$/);
        let newText = concern;
        let finalPos = cursorPos;
        if (symbolMatch) {
            const prefix = textBeforeCursor.slice(0, symbolMatch.index);
            newText = `${prefix}${textAfterCursor}`.trim();
            finalPos = prefix.length;
        }
        setConcern(newText);
        setSelections(prev => ({ ...prev, [type]: [...new Set([...prev[type], value])] }));
        setMentionType(null);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(finalPos, finalPos);
                setCursorPos(finalPos);
            }
        }, 0);
    };

    const handleSaveReport = () => {
        const thumbnail = collageImage || (evidenceItems.length > 0 ? evidenceItems[0].url : null);
        onSave({
            id: initialData?.id,
            title: concern || 'New Observation',
            sop: selections.sop.join(', ') || 'General',
            location: { area: selections.location.join(', ') || 'Unit' },
            responsibility: selections.responsibility.join(', ') || 'General',
            allEvidence: evidenceItems.map(item => ({ file: item.file, url: item.url, type: item.file?.type.startsWith('video/') ? 'video' : 'image' })),
            thumbnail,
            staffInvolved: selections.staff,
            assetId: selections.asset,
            foodCategory: selections.category,
            persistence: {
                selections: Object.fromEntries(
                    Object.entries(selections).map(([k, v]) => [k, locks[k] ? v : []])
                ) as typeof selections,
                locks
            }
        });
        onClose();
    };

    const handleSaveCollage = async (dataUrl: string, finalImages: string[]) => {
        const compressed = await compressImage(dataUrl);
        setCollageImage(compressed);
        const compressedImages = await Promise.all(finalImages.map(url => compressImage(url)));
        setEvidenceItems(compressedImages.map(url => ({ file: null, url, isCompressing: false })));
        setIsCollageStudioOpen(false);
        setShowMediaMenu(false);
    };

    const puterLoadPromise = useRef<Promise<void> | null>(null);

    const loadPuterJs = useCallback((): Promise<void> => {
        if (puterLoadPromise.current) return puterLoadPromise.current;
        puterLoadPromise.current = new Promise((resolve, reject) => {
            if ((window as any).puter?.ai) { resolve(); return; }
            const waitForReady = () => {
                let interval: ReturnType<typeof setInterval>;
                let timeout: ReturnType<typeof setTimeout>;
                timeout = setTimeout(() => { clearInterval(interval); puterLoadPromise.current = null; reject(new Error('timeout')); }, 8000);
                interval = setInterval(() => {
                    if ((window as any).puter?.ai) { clearInterval(interval); clearTimeout(timeout); resolve(); }
                }, 200);
            };
            const existing = document.querySelector('script[src*="js.puter.com"]');
            if (existing) { waitForReady(); return; }
            const script = document.createElement('script');
            script.src = 'https://js.puter.com/v2/';
            script.onload = () => waitForReady();
            script.onerror = () => { puterLoadPromise.current = null; reject(new Error('load_failed')); };
            document.head.appendChild(script);
        });
        return puterLoadPromise.current;
    }, []);

    const tryPuterRewrite = useCallback(async (text: string): Promise<{label: string, text: string, icon: string}[] | null> => {
        try {
            await loadPuterJs();
            const puter = (window as any).puter;
            if (!puter?.ai?.chat) return null;

            const prompt = `You are a spelling and grammar corrector for food safety observation reports.

Rewrite the following text in 3 ways. Rules:
- Fix ALL spelling and grammar errors
- Do NOT add any new sentences, details, recommendations, or extra information
- Do NOT add conclusions like "this poses a risk" or "corrective action needed"
- Keep the SAME number of sentences as the original — just correct and rephrase them
- Keep it simple and clear

Return EXACTLY this JSON (no markdown, no code blocks):
{"options":[{"label":"Corrected","text":"..."},{"label":"Professional","text":"..."},{"label":"Concise","text":"..."}]}

The 3 styles:
1. "Corrected" — same text with spelling and grammar fixed, nothing else changed
2. "Professional" — same meaning rewritten in formal professional language, no extra sentences added
3. "Concise" — same meaning in fewer words, tight and direct

Original text:
${text}`;

            const chatPromise = puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
            const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('puter_timeout')), 20000));
            const response = await Promise.race([chatPromise, timeoutPromise]) as any;
            const raw = typeof response === 'string' ? response : response?.message?.content || response?.text || '';
            if (!raw) return null;

            let cleaned = raw.trim();
            if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            const jsonMatch = cleaned.match(/\{[\s\S]*"options"[\s\S]*\}/);
            if (jsonMatch) cleaned = jsonMatch[0];

            const parsed = JSON.parse(cleaned);
            if (parsed.options?.length) {
                const icons = ['✅', '✨', '⚡'];
                return parsed.options.map((opt: any, i: number) => ({
                    label: opt.label || `Option ${i + 1}`,
                    text: opt.text,
                    icon: icons[i] || '📝',
                }));
            }
        } catch (e) {
            console.warn('Puter AI rewrite failed:', e);
        }
        return null;
    }, [loadPuterJs]);

    const generateRewriteOptions = () => {
        if (!concern.trim()) return;
        const options = offlineRewriteMulti(concern);
        setRewriteOptions(options.length > 0 ? options : [{ label: 'Corrected', text: concern.trim(), icon: '✅' }]);
        setShowRewritePanel(true);
        setIsGeneratingRewrites(false);
    };

    const selectRewriteOption = (text: string) => {
        setConcern(text);
        setShowRewritePanel(false);
        setRewriteOptions([]);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const evt = new Event('input', { bubbles: true });
                textareaRef.current.dispatchEvent(evt);
            }
        }, 50);
    };

    const handleRemoveCollage = () => {
        if(confirm("Remove collage? This will restore individual photos for editing.")) {
            setCollageImage(null);
        }
    };

    const staffOptions = useMemo(() => {
        if (availableStaff.length > 0) return availableStaff;
        return MOCK_STAFF.map((name, i) => ({ id: `mock-${i}`, name, unit: '', department: '', ticketId: '' }));
    }, [availableStaff]);

    const filteredStaff = useMemo(() => {
        if (mentionType !== 'staff') return [];
        const s = mentionSearch.toLowerCase();
        return staffOptions.filter(st => 
            st.name.toLowerCase().includes(s) || 
            st.ticketId.toLowerCase().includes(s) || 
            st.unit.toLowerCase().includes(s) || 
            st.department.toLowerCase().includes(s)
        );
    }, [mentionType, mentionSearch, staffOptions]);

    const mentionOptions = useMemo(() => {
        let options: string[] = [];
        if (mentionType === 'location') options = availableLocations;
        else if (mentionType === 'sop') options = availableSops.length ? availableSops : FALLBACK_SOPS;
        else if (mentionType === 'asset') options = MOCK_ASSETS;
        else if (mentionType === 'staff') return [];
        else if (mentionType === 'category') options = ["Poultry", "Vegetables", "Dairy", "Frozen", "RTE"];
        else if (mentionType === 'responsibility') options = availableDepartments.length ? availableDepartments : FALLBACK_DEPARTMENTS;
        return options.filter(o => o.toLowerCase().includes(mentionSearch.toLowerCase()));
    }, [mentionType, mentionSearch, availableLocations, availableSops, availableDepartments]);

    useEffect(() => {
        if (mentionType && observationContainerRef.current) {
            const rect = observationContainerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.top + 60,
                left: rect.left + 8,
                width: rect.width - 16,
            });
        } else {
            setDropdownPos(null);
        }
    }, [mentionType]);

    return (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm sm:p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col relative animate-in slide-in-from-bottom sm:zoom-in-95 border border-slate-200/60 overflow-hidden max-h-[92vh] sm:max-h-[88vh]">
                {/* Drag Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-[170] bg-indigo-600/80 flex items-center justify-center text-white m-2 rounded-[2.5rem] pointer-events-none">
                        <div className="flex items-center gap-3 bg-white/20 px-6 py-3 rounded-2xl"><Upload size={24} /><span className="text-base font-black uppercase">Drop Images Here</span></div>
                    </div>
                )}
                
                {/* Handle bar for mobile bottom-sheet */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
                    <div className="w-10 h-1 bg-slate-200 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-violet-600 text-white rounded-xl shadow-lg"><Plus size={18} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{initialData ? 'Update Observation' : 'New Observation'}</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">{isAuditMode ? 'Link to any audit question' : 'Record a food safety observation'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
                </div>

                {isAuditMode ? (
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current++; if (dragCounterRef.current === 1) setIsDragging(true); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current--; if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setIsDragging(false); } }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); dragCounterRef.current = 0; setIsDragging(false); if (e.dataTransfer.files?.length) { const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (imageFiles.length > 0) processFiles(imageFiles, false); } }}
                    >
                        {completedAuditEntries.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Check size={9} className="text-emerald-500" /> Added ({completedAuditEntries.length}) — will save on submit
                                </p>
                                {completedAuditEntries.map((entry, idx) => {
                                    const isExpanded = expandedAuditEntryId === entry.id;
                                    const entryQuestion = auditQuestions?.find(q => q.id === entry.questionId);
                                    return (
                                        <div key={entry.id} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-indigo-300 bg-white shadow-md' : 'border-emerald-200 bg-emerald-50'}`}>
                                            {/* Collapsed header — always visible */}
                                            <div
                                                className="px-3 py-2 flex items-start gap-2 cursor-pointer select-none"
                                                onClick={() => setExpandedAuditEntryId(isExpanded ? null : entry.id)}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-[8px] font-bold uppercase tracking-wider truncate ${isExpanded ? 'text-indigo-500' : 'text-emerald-600'}`}>{entry.sectionTitle}</p>
                                                    <p className="text-[11px] font-bold text-gray-800 leading-snug truncate mt-0.5">{entry.questionText}</p>
                                                    {!isExpanded && (
                                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                            {entry.selectedResponseText && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border bg-gray-100 text-gray-600 border-gray-200 shrink-0">{entry.selectedResponseText}</span>}
                                                            {entry.concern && <p className="text-[10px] text-gray-500 truncate flex-1 italic">"{entry.concern}"</p>}
                                                            {entry.evidenceItems.length > 0 && <span className="text-[8px] text-gray-400 shrink-0">{entry.evidenceItems.length} photo{entry.evidenceItems.length > 1 ? 's' : ''}</span>}
                                                            {entry.location && <span className="text-[8px] text-gray-400 shrink-0 flex items-center gap-0.5"><MapPin size={8} />{entry.location}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); setExpandedAuditEntryId(isExpanded ? null : entry.id); }}
                                                        className={`p-1 rounded-lg transition-colors ${isExpanded ? 'text-indigo-500 bg-indigo-50' : 'text-gray-400 hover:text-indigo-500'}`}
                                                        title={isExpanded ? 'Collapse' : 'Edit'}
                                                    >
                                                        <Edit2 size={11} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); setCompletedAuditEntries(prev => prev.filter((_, i) => i !== idx)); if (expandedAuditEntryId === entry.id) setExpandedAuditEntryId(null); }}
                                                        className="p-1 text-gray-300 hover:text-rose-500 rounded-lg transition-colors"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded edit form */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 pt-0.5 border-t border-indigo-100 space-y-2.5">
                                                    {/* Response buttons */}
                                                    {entryQuestion && entryQuestion.responses.length > 0 && (
                                                        <div>
                                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1.5 mt-2">Answer</p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {entryQuestion.responses.map((resp, respIdx) => {
                                                                    const isSelected = entry.selectedResponse === respIdx;
                                                                    const colorMap: Record<string, string> = { green: isSelected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300', red: isSelected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-300', orange: isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-300', yellow: isSelected ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-300', gray: isSelected ? 'bg-gray-500 text-white border-gray-500' : 'bg-white text-gray-600 border-gray-300' };
                                                                    const cls = colorMap[resp.color] || (isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300');
                                                                    return (
                                                                        <button
                                                                            key={respIdx}
                                                                            type="button"
                                                                            onClick={() => updateAuditEntry(entry.id, { selectedResponse: respIdx, selectedResponseText: resp.text })}
                                                                            className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all ${cls} ${isSelected ? 'ring-1 ring-offset-1 shadow-sm' : 'hover:shadow-sm'}`}
                                                                        >
                                                                            {resp.text}{isSelected && <Check size={8} className="inline ml-1" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Observation text */}
                                                    <textarea
                                                        value={entry.concern}
                                                        onChange={e => updateAuditEntry(entry.id, { concern: e.target.value })}
                                                        placeholder="Observation..."
                                                        rows={2}
                                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-indigo-300 bg-gray-50"
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                    {/* Photo thumbnails */}
                                                    {entry.evidenceItems.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {entry.evidenceItems.map((item, imgIdx) => (
                                                                <div key={imgIdx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-200 group shrink-0">
                                                                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                                                                    <button
                                                                        type="button"
                                                                        onClick={e => { e.stopPropagation(); updateAuditEntry(entry.id, { evidenceItems: entry.evidenceItems.filter((_, i) => i !== imgIdx) }); }}
                                                                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <X size={10} className="text-white" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedAuditEntryId(null)}
                                                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors"
                                                    >
                                                        <Check size={10} className="inline mr-1" />Done
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="border-b border-dashed border-gray-200 pt-1" />
                            </div>
                        )}

                        {checklistOptions && checklistOptions.length > 0 && (
                            <div ref={aqChecklistDropdownRef}>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <ShieldCheck size={10} /> Select Checklist <span className="text-rose-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setAqShowChecklistDropdown(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left transition-colors hover:border-violet-300"
                                >
                                    <span className="flex items-center gap-2 text-gray-500">
                                        <ShieldCheck size={14} className="text-gray-400" />
                                        {aqSelectedChecklists.size > 0
                                            ? `${aqSelectedChecklists.size} checklist${aqSelectedChecklists.size > 1 ? 's' : ''} selected`
                                            : 'Select checklist(s)...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${aqShowChecklistDropdown ? 'rotate-180' : ''}`} />
                                </button>

                                {aqSelectedChecklists.size > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {checklistOptions.filter(cl => aqSelectedChecklists.has(cl.id)).map(cl => {
                                            const colorCls = aqScopeColors[cl.scope] || aqScopeColors.Other;
                                            return (
                                                <span key={cl.id} className={`inline-flex items-center gap-1 px-2.5 py-1 border rounded-lg text-[9px] font-bold uppercase ${colorCls}`}>
                                                    {cl.title}
                                                    <button type="button" onClick={() => toggleChecklist(cl.id)} className="ml-0.5 hover:opacity-70"><X size={10} strokeWidth={3} /></button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {aqShowChecklistDropdown && (
                                    <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto z-10 relative">
                                        {aqScopeOrder.filter(scope => aqGroupedChecklists[scope]?.length > 0).map(scope => (
                                            <div key={scope}>
                                                <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-[1]">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${aqScopeColors[scope] || aqScopeColors.Other}`}>{scope}</span>
                                                </div>
                                                {aqGroupedChecklists[scope].map(cl => {
                                                    const isChecked = aqSelectedChecklists.has(cl.id);
                                                    return (
                                                        <button
                                                            key={cl.id}
                                                            type="button"
                                                            onClick={() => toggleChecklist(cl.id)}
                                                            className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-3 ${isChecked ? 'bg-violet-50 text-violet-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
                                                                {isChecked && <Check size={10} className="text-white" strokeWidth={3} />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold truncate">{cl.title}</p>
                                                                <p className="text-[9px] text-gray-400">{cl.questionCount} questions</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                        {Object.keys(aqGroupedChecklists).length === 0 && (
                                            <div className="p-4 text-center text-gray-400 text-xs italic">No checklists available</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {availableLocations.length > 0 && (
                            <div ref={aqLocDropdownRef}>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <MapPin size={10} /> Location
                                    {aqLocationLocked && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5"><Lock size={7} /> Locked</span>}
                                </label>
                                <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => { if (!aqLocationLocked) setAqShowLocDropdown(v => !v); }}
                                    className={`flex-1 flex items-center justify-between px-4 py-3 border rounded-xl text-sm text-left transition-colors ${aqLocationLocked ? 'bg-indigo-50 border-indigo-300 cursor-default' : 'bg-gray-50 border-gray-200 hover:border-violet-300'}`}
                                >
                                    <span className="flex items-center gap-2 text-gray-500">
                                        <MapPin size={14} className={aqSelectedLocation ? 'text-indigo-500' : 'text-gray-400'} />
                                        <span className={aqSelectedLocation ? 'text-indigo-700 font-bold' : ''}>{aqSelectedLocation || 'Select Location...'}</span>
                                    </span>
                                    {!aqLocationLocked && <ChevronDown size={16} className={`text-gray-400 transition-transform ${aqShowLocDropdown ? 'rotate-180' : ''}`} />}
                                    {aqLocationLocked && <Lock size={14} className="text-indigo-400 shrink-0" />}
                                </button>
                                {aqSelectedLocation && (
                                    <button
                                        type="button"
                                        onClick={() => setAqLocationLocked(prev => !prev)}
                                        className={`p-2.5 rounded-xl border-2 transition-all shrink-0 ${aqLocationLocked ? 'bg-indigo-100 border-indigo-300 text-indigo-600 hover:bg-red-50 hover:border-red-300 hover:text-red-500' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                        title={aqLocationLocked ? 'Unlock location' : 'Lock location for all entries'}
                                    >
                                        {aqLocationLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                )}
                                </div>
                                {aqShowLocDropdown && !aqLocationLocked && (
                                    <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-hidden z-10 relative">
                                        <div className="p-2 border-b border-gray-100">
                                            <div className="relative">
                                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={aqLocSearch}
                                                    onChange={e => setAqLocSearch(e.target.value)}
                                                    placeholder="Search location..."
                                                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-gray-50"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-36 overflow-y-auto">
                                            {aqFilteredLocations.length > 0 ? aqFilteredLocations.map(loc => (
                                                <button
                                                    key={loc}
                                                    type="button"
                                                    onClick={() => { setAqSelectedLocation(loc); setAqShowLocDropdown(false); setAqLocSearch(''); setAqSelectedId(''); setAqSelectedResponse(null); }}
                                                    className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${aqSelectedLocation === loc ? 'bg-violet-50 text-violet-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                                >
                                                    {loc}
                                                </button>
                                            )) : (
                                                <div className="p-4 text-center text-gray-400 text-xs italic">No locations found</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div ref={aqDropdownRef}>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <BookOpen size={10} /> Select Question <span className="text-rose-500">*</span>
                            </label>
                            {checklistOptions && checklistOptions.length > 0 && aqSelectedChecklists.size === 0 ? (
                                <div className="px-4 py-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 italic text-center">
                                    Select a checklist above to see questions
                                </div>
                            ) : (
                            <>
                            {aqSelectedDepartment && (
                                <div className="mb-1.5 flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                        <Filter size={9} />
                                        {aqSelectedDepartment}
                                    </span>
                                    <span className="text-[9px] text-gray-400">{aqQuestionsForSelectedChecklists.length} questions</span>
                                </div>
                            )}
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-[1]" />
                                <input
                                    type="text"
                                    value={aqSearchQ}
                                    onChange={e => { setAqSearchQ(e.target.value); setAqShowDropdown(true); }}
                                    onFocus={() => setAqShowDropdown(true)}
                                    placeholder={aqSelectedDepartment ? `Search ${aqQuestionsForSelectedChecklists.length} ${aqSelectedDepartment} questions...` : `Search ${aqQuestionsForSelectedChecklists.length} questions...`}
                                    className="w-full pl-9 pr-4 py-3 bg-violet-50 border-2 border-violet-200 rounded-xl text-sm focus:outline-none focus:border-violet-400 transition-colors"
                                />
                                <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${aqShowDropdown ? 'rotate-180' : ''}`} />
                            </div>
                            {aqShowDropdown && (
                                <div className="mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-hidden z-10 relative">
                                    <div className="max-h-52 overflow-y-auto">
                                        {aqFilteredQuestions.length > 0 ? aqFilteredQuestions.map(q => (
                                            <button
                                                key={q.id}
                                                type="button"
                                                onClick={() => { setAqSelectedId(q.id); setAqShowDropdown(false); setAqSearchQ(''); setAqSelectedResponse(null); }}
                                                className={`w-full text-left px-4 py-2.5 transition-colors border-b border-gray-50 last:border-b-0 ${aqSelectedId === q.id ? 'bg-violet-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">{q.sectionTitle}</p>
                                                <p className="text-xs font-medium text-gray-800 mt-0.5 line-clamp-2">{q.text}</p>
                                                {q.checklistName && <p className="text-[8px] text-gray-400 mt-0.5">{q.checklistName}</p>}
                                            </button>
                                        )) : (
                                            <div className="p-4 text-center text-gray-400 text-xs italic">No questions found</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {aqSelectedQuestion && (
                                <div className="mt-2 bg-white border border-violet-200 rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-bold text-violet-500 uppercase tracking-wider">{aqSelectedQuestion.sectionTitle}</p>
                                        <p className="text-xs font-medium text-gray-800 mt-0.5">{aqSelectedQuestion.text}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setAqQuestionLocked(prev => !prev)}
                                            className={`p-1.5 rounded-lg border transition-all ${aqQuestionLocked ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-indigo-500'}`}
                                            title={aqQuestionLocked ? 'Unlock question' : 'Lock question for all entries'}
                                        >
                                            {aqQuestionLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                        </button>
                                        {!aqQuestionLocked && <button type="button" onClick={() => { setAqSelectedId(''); setAqSelectedResponse(null); }} className="p-1 hover:bg-gray-100 rounded-full"><X size={14} className="text-gray-400" /></button>}
                                    </div>
                                </div>
                            )}
                            </>
                            )}
                        </div>

                        {aqSelectedQuestion && aqSelectedQuestion.responses.length > 0 && (
                            <div>
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Answer Set</label>
                                <div className="flex flex-wrap gap-2">
                                    {aqSelectedQuestion.responses.map((resp, idx) => {
                                        const isSelected = aqSelectedResponse === idx;
                                        const score = resp.score ? ` (${resp.score})` : '';
                                        const bgColors: Record<string, string> = {
                                            green: isSelected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300',
                                            red: isSelected ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-300',
                                            orange: isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-300',
                                            yellow: isSelected ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-300',
                                            gray: isSelected ? 'bg-gray-500 text-white border-gray-500' : 'bg-white text-gray-500 border-gray-300',
                                        };
                                        const colorKey = resp.color?.toLowerCase() || 'gray';
                                        const colorClass = bgColors[colorKey] || bgColors.gray;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setAqSelectedResponse(isSelected ? null : idx)}
                                                className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 ${colorClass}`}
                                            >
                                                {resp.text}{score}
                                                {isSelected && <Check size={12} strokeWidth={3} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                <BookOpen size={10} /> Observation
                            </label>
                            <textarea
                                value={concern}
                                onChange={e => setConcern(e.target.value)}
                                rows={3}
                                placeholder="Describe observation..."
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent resize-none"
                            />
                        </div>

                        {(collageImage || evidenceItems.length > 0) && (
                            <div className="flex flex-wrap gap-2">
                                {collageImage ? (
                                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-indigo-400 group cursor-pointer" onClick={() => onViewImage?.(collageImage, 'Collage')}>
                                        <img src={collageImage} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setIsCollageStudioOpen(true); }} className="p-1 bg-white rounded text-indigo-600"><Edit2 size={10} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); if (confirm('Remove collage?')) setCollageImage(null); }} className="p-1 bg-rose-500 rounded text-white"><Trash2 size={10} /></button>
                                        </div>
                                    </div>
                                ) : evidenceItems.filter(item => item.url).map((item, i) => (
                                    <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border-2 border-indigo-200 group cursor-pointer">
                                        <img src={item.url} className="w-full h-full object-cover" onClick={() => onViewImage?.(item.url, 'Evidence')} />
                                        {item.isCompressing && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={14} className="text-white animate-spin" /></div>}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setEditingPhotoIndex(i); setEditingPhoto(item.url); }} className="p-1 bg-white rounded text-indigo-600"><Edit2 size={10} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setEvidenceItems(p => p.filter((_, idx) => idx !== i)); }} className="p-1 bg-rose-500 rounded text-white"><X size={10} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!collageImage && evidenceItems.length >= 2 && (
                            <button type="button" onClick={() => setIsCollageStudioOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all w-fit">
                                <LayoutTemplate size={12} /> Create Collage
                            </button>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                            <button type="button" onClick={() => cameraCaptureRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 text-xs font-bold uppercase hover:bg-emerald-50 transition-colors">
                                <Camera size={16} /> Camera
                            </button>
                            <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-emerald-300 rounded-xl text-emerald-600 text-xs font-bold uppercase hover:bg-emerald-50 transition-colors">
                                <ImageIcon size={16} /> Gallery
                            </button>
                        </div>

                        {aqSelectedQuestion && (
                            <button
                                type="button"
                                onClick={handleAqAddMore}
                                className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} /> Add More Observation
                            </button>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                            <button
                                type="button"
                                onClick={handleAuditModeSave}
                                disabled={evidenceItems.some(i => i.isCompressing) || (completedAuditEntries.length === 0 && (!aqSelectedId || (!concern.trim() && evidenceItems.length === 0 && !collageImage)))}
                                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                <SendHorizonal size={16} /> Save{completedAuditEntries.length > 0 ? ` (${completedAuditEntries.length + (aqSelectedId && (concern.trim() || evidenceItems.length > 0 || collageImage) ? 1 : 0)})` : ''}
                            </button>
                        </div>

                        <input ref={cameraCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                        <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />

                        {isCollageStudioOpen && <CollageStudio initialImages={evidenceItems.map(item => item.url)} onSave={handleSaveCollage} onClose={() => setIsCollageStudioOpen(false)} />}
                        {editingPhoto && <PhotoEditor imageUrl={editingPhoto} onSave={handleSaveEditedPhoto} onCancel={() => { setEditingPhoto(null); setEditingPhotoIndex(null); }} />}
                    </div>
                ) : (
                <>
                {/* Body - Standard Observation Form */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-4 pb-2 space-y-3.5"
                >
                    <div className="bg-gray-50/80 rounded-xl border border-gray-100 p-2.5 space-y-2">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Search size={8} /> Filters
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setStdLocOpen(v => !v); setStdLocSearch(''); setStdSopOpen(false); }}
                                    className={`w-full border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold text-left ${selections.location.length > 0 ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}
                                >
                                    <MapPin size={11} className={selections.location.length > 0 ? 'text-violet-500' : 'text-gray-300'} />
                                    <span className="flex-1 truncate">{selections.location.length > 0 ? selections.location[0] : 'Location'}</span>
                                    {selections.location.length > 0 ? (
                                        <button type="button" onClick={e => { e.stopPropagation(); setSelections(p => ({ ...p, location: [] })); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                                    ) : (
                                        <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${stdLocOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </button>
                                {stdLocOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[220px] max-h-52 flex flex-col">
                                        <div className="p-1.5 border-b border-gray-100">
                                            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                                <Search size={10} className="text-gray-400" />
                                                <input autoFocus value={stdLocSearch} onChange={e => setStdLocSearch(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent text-[11px] font-medium text-gray-700 placeholder:text-gray-400 outline-none" />
                                            </div>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                            {(availableLocations.length > 0 ? availableLocations : FALLBACK_LOCATIONS).filter(l => l.toLowerCase().includes(stdLocSearch.toLowerCase())).map(loc => (
                                                <button key={loc} type="button" onClick={() => { setSelections(p => ({ ...p, location: [loc] })); setStdLocOpen(false); }} className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-violet-50 transition-colors flex items-center gap-1.5 border-b border-gray-50 last:border-b-0 ${selections.location[0] === loc ? 'bg-violet-50 text-violet-700' : 'text-gray-700'}`}>
                                                    <MapPin size={9} className={selections.location[0] === loc ? 'text-violet-500' : 'text-gray-300'} />
                                                    {loc}
                                                    {selections.location[0] === loc && <Check size={9} className="ml-auto text-violet-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => { setStdSopOpen(v => !v); setStdSopSearch(''); setStdLocOpen(false); }}
                                    className={`w-full border rounded-lg px-2 py-1.5 flex items-center gap-1.5 transition-all text-[11px] font-semibold text-left ${selections.sop.length > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'}`}
                                >
                                    <BookOpen size={11} className={selections.sop.length > 0 ? 'text-emerald-500' : 'text-gray-300'} />
                                    <span className="flex-1 truncate">{selections.sop.length > 0 ? selections.sop[0] : 'SOP'}</span>
                                    {selections.sop.length > 0 ? (
                                        <button type="button" onClick={e => { e.stopPropagation(); setSelections(p => ({ ...p, sop: [] })); }} className="p-0.5 text-gray-400 hover:text-rose-500 shrink-0"><X size={10} /></button>
                                    ) : (
                                        <ChevronDown size={10} className={`text-gray-300 shrink-0 transition-transform ${stdSopOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </button>
                                {stdSopOpen && (
                                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[220px] max-h-52 flex flex-col">
                                        <div className="p-1.5 border-b border-gray-100">
                                            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1">
                                                <Search size={10} className="text-gray-400" />
                                                <input autoFocus value={stdSopSearch} onChange={e => setStdSopSearch(e.target.value)} placeholder="Search SOPs..." className="flex-1 bg-transparent text-[11px] font-medium text-gray-700 placeholder:text-gray-400 outline-none" />
                                            </div>
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                            {(availableSops.length > 0 ? availableSops : FALLBACK_SOPS).filter(s => s.toLowerCase().includes(stdSopSearch.toLowerCase())).map(sop => (
                                                <button key={sop} type="button" onClick={() => { setSelections(p => ({ ...p, sop: [sop] })); setStdSopOpen(false); }} className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-1.5 border-b border-gray-50 last:border-b-0 ${selections.sop[0] === sop ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}`}>
                                                    <BookOpen size={9} className={selections.sop[0] === sop ? 'text-emerald-500' : 'text-gray-300'} />
                                                    {sop}
                                                    {selections.sop[0] === sop && <Check size={9} className="ml-auto text-emerald-500" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── OBSERVATION textarea ── */}
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                            <Info size={10} /> Observation
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={concern}
                            onChange={e => setConcern(e.target.value)}
                            rows={3}
                            placeholder="Describe observation..."
                            className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-3 text-sm font-medium text-gray-700 focus:border-violet-400 focus:outline-none transition-all resize-none placeholder:text-gray-300"
                        />
                    </div>

                    {/* ── Image drag-and-drop zone ── */}
                    <div
                        className={`relative rounded-xl border-2 border-dashed transition-all ${isStdImgDragging ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200' : (collageImage || evidenceItems.length > 0) ? 'border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-gray-50/30 hover:border-violet-200 hover:bg-violet-50/20'}`}
                        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); stdImgDragCounter.current++; if (e.dataTransfer.types.includes('Files')) setIsStdImgDragging(true); }}
                        onDragLeave={e => { e.preventDefault(); e.stopPropagation(); stdImgDragCounter.current = Math.max(0, stdImgDragCounter.current - 1); if (stdImgDragCounter.current === 0) setIsStdImgDragging(false); }}
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => { e.preventDefault(); e.stopPropagation(); stdImgDragCounter.current = 0; setIsStdImgDragging(false); if (e.dataTransfer.files?.length) { const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (imageFiles.length > 0) processFiles(imageFiles, false); } }}
                    >
                        {isStdImgDragging && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-violet-50/90 rounded-xl pointer-events-none">
                                <Upload size={28} className="text-violet-500 mb-1.5" />
                                <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Drop images here</span>
                            </div>
                        )}
                        {collageImage ? (
                            <div className="p-2">
                                <div className="relative group rounded-xl overflow-hidden border-4 border-violet-400 shadow-lg cursor-zoom-in" onClick={() => onViewImage?.(collageImage, 'Collage')}>
                                    <img src={collageImage} className="w-full h-40 object-cover" alt="Collage" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button type="button" onClick={e => { e.stopPropagation(); setIsCollageStudioOpen(true); }} className="p-2 bg-white/90 rounded-lg text-violet-600"><Edit2 size={14} /></button>
                                        <button type="button" onClick={e => { e.stopPropagation(); handleRemoveCollage(); }} className="p-2 bg-rose-500 rounded-lg text-white"><Trash2 size={14} /></button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-violet-600/90 text-white text-[8px] font-black text-center py-0.5 uppercase tracking-tighter">Collage Active</div>
                                </div>
                            </div>
                        ) : evidenceItems.length > 0 ? (
                            <div className="grid grid-cols-4 gap-2 p-2">
                                {evidenceItems.map((item, i) => (
                                    <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square cursor-zoom-in" onClick={() => item.url && onViewImage?.(item.url, 'Evidence')}>
                                        <img src={item.url || undefined} alt="" className="w-full h-full object-cover" />
                                        {item.isCompressing && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 size={14} className="text-white animate-spin" /></div>}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button type="button" onClick={e => { e.stopPropagation(); setEditingPhotoIndex(i); setEditingPhoto(item.url); }} className="p-1.5 bg-white/90 rounded-lg text-violet-600"><Edit2 size={11} /></button>
                                            <button type="button" onClick={e => { e.stopPropagation(); setEvidenceItems(p => p.filter((_, idx) => idx !== i)); }} className="p-1.5 bg-rose-500 rounded-lg text-white"><X size={11} /></button>
                                        </div>
                                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[7px] px-1 py-0.5 rounded font-bold">{i + 1}/{evidenceItems.length}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 gap-1.5 select-none">
                                <Upload size={22} className="text-gray-300" />
                                <p className="text-[9px] font-semibold text-gray-400">Drag & drop images here</p>
                                <p className="text-[8px] text-gray-300">or use Camera / Gallery buttons below</p>
                            </div>
                        )}
                    </div>

                    {/* ── Camera / Gallery / Collage buttons ── */}
                    <div className="flex items-center gap-2 pb-1">
                        <button type="button" onClick={() => { setStdLocOpen(false); setStdSopOpen(false); cameraCaptureRef.current?.click(); }} className="flex-1 py-3 border-2 border-dashed border-violet-200 text-violet-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-violet-50 transition-all flex items-center justify-center gap-2">
                            <Camera size={15} /> Camera
                        </button>
                        <button type="button" onClick={() => { setStdLocOpen(false); setStdSopOpen(false); galleryInputRef.current?.click(); }} className="flex-1 py-3 border-2 border-dashed border-emerald-200 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                            <ImageIcon size={15} /> Gallery
                        </button>
                        {!collageImage && evidenceItems.length >= 2 && (
                            <button type="button" onClick={() => setIsCollageStudioOpen(true)} className="flex-1 py-3 border-2 border-dashed border-amber-200 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-50 transition-all flex items-center justify-center gap-2">
                                <LayoutTemplate size={15} /> Collage
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex items-center gap-2">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveReport}
                        disabled={evidenceItems.some(i => i.isCompressing) || (!concern.trim() && !evidenceItems.length && !collageImage)}
                        className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {evidenceItems.some(i => i.isCompressing) ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
                        {initialData ? 'Update' : 'Send'}
                    </button>
                </div>

                {/* Input refs */}
                <input ref={cameraCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
                <input ref={galleryInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />

                {/* Collage Studio Integration */}
                {isCollageStudioOpen && (
                    <CollageStudio 
                        initialImages={evidenceItems.map(item => item.url)} 
                        onSave={handleSaveCollage} 
                        onClose={() => setIsCollageStudioOpen(false)} 
                    />
                )}

                {/* Advanced Photo Editor Integration */}
                {editingPhoto && (
                    <PhotoEditor 
                        imageUrl={editingPhoto}
                        onSave={handleSaveEditedPhoto}
                        onCancel={() => { setEditingPhoto(null); setEditingPhotoIndex(null); }}
                    />
                )}
                </>
                )}
            </div>
        </div>
    );
};

export default ComplaintFormModal;
export { PhotoEditor, CollageStudio };