"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    Tag, 
    Plus, 
    Search, 
    Edit, 
    Trash2, 
    CheckCircle2, 
    XCircle, 
    X, 
    Upload, 
    Download, 
    FileText,
    ShieldCheck, 
    Globe, 
    Building2,
    RefreshCw,
    AlertTriangle,
    MapPin,
    Building,
    Check,
    MessageSquare,
    ChevronRight,
    ArrowRight,
    FileUp,
    History,
    AlertCircle,
    CheckCircle,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    GitMerge,
    Link,
    Zap,
    Database,
    Fingerprint,
    Copy,
    ArrowDownToLine,
    Anchor,
    Edit3,
    Save,
    Power,
    ZapOff,
    Settings2,
    FileCheck,
    Boxes,
    FileSearch
} from 'lucide-react';
import { Entity, Brand, HierarchyScope, Supplier } from '../types';
import UnifiedPagination from './UnifiedPagination';
import { postRegistry } from '../utils/registrySave';
import RegistrySaveBadge from './RegistrySaveBadge';

// --- Utility: Jaro-Winkler Fuzzy Matching ---
function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  let m = 0;
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1.length === 0 || str2.length === 0) return 0;
  if (str1 === str2) return 1;
  let r = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  let rOrder = Math.max(str1.length, str2.length);
  let s1M = new Array(str1.length).fill(false);
  let s2M = new Array(str2.length).fill(false);
  for (let i = 0; i < str1.length; i++) {
    let low = i >= r ? i - r : 0;
    let high = i + r <= str2.length ? i + r : str2.length - 1;
    for (let j = low; j <= high; j++) {
      if (!s2M[j] && str1[i] === str2[j]) {
        s1M[i] = true;
        s2M[j] = true;
        m++;
        break;
      }
    }
  }
  if (m === 0) return 0;
  let k = 0, t = 0;
  for (let i = 0; i < str1.length; i++) {
    if (s1M[i]) {
      while (!s2M[k]) k++;
      if (str1[i] !== s2[k]) t++;
      k++;
    }
  }
  t /= 2;
  let jaro = (m / str1.length + m / str2.length + (m - t) / m) / 3;
  let p = 0.1, l = 0;
  if (jaro > 0.7) {
    while (str1[l] === str2[l] && l < 4) l++;
    jaro = jaro + l * p * (1 - jaro);
  }
  return jaro;
}

interface BrandManagementProps {
    entities: Entity[];
    onUpdateEntity: (e: Entity) => void;
    currentScope: HierarchyScope;
    userRootId?: string | null;
    brands: Brand[];
    onBrandsChange: (brands: Brand[]) => void;
    suppliers?: Supplier[];
}

const BrandManagement: React.FC<BrandManagementProps> = ({ entities, onUpdateEntity, currentScope, userRootId, brands, onBrandsChange, suppliers = [] }) => {
    // Determine Corporate Context
    const corporateEntity = useMemo(() => {
        let curr = entities.find(e => e.id === userRootId);
        while (curr) {
            if (curr.type === 'corporate') return curr;
            curr = entities.find(e => e.id === curr?.parentId);
        }
        return entities.find(e => e.type === 'corporate');
    }, [entities, userRootId]);

    const masterBrands = brands;

    const [view, setView] = useState<'dashboard' | 'review' | 'browse'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Provisional' | 'Rejected' | 'Flagged'>('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [newBrandName, setNewBrandName] = useState("");
    const [similarBrands, setSimilarBrands] = useState<Brand[]>([]);
    const [reviewData, setReviewData] = useState<{ matched: Brand[], unique: Brand[] }>({ matched: [], unique: [] });
    
    // Merge State
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergeSource, setMergeSource] = useState<Brand | null>(null);
    const [mergeTargetSearch, setMergeTargetSearch] = useState("");

    const [isBulkMergeModalOpen, setIsBulkMergeModalOpen] = useState(false);
    const [bulkMergeSearch, setBulkMergeSearch] = useState('');

    // Supplier Link State
    const [linkingBrand, setLinkingBrand] = useState<Brand | null>(null);
    const [supplierSearch, setSupplierSearch] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [browseSearch, setBrowseSearch] = useState('');
    const [selectedForAdopt, setSelectedForAdopt] = useState<Set<string>>(new Set());

    // Multi-select state
    const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelectedBrands(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedBrands.size === filteredBrands.length && filteredBrands.length > 0) {
            setSelectedBrands(new Set());
        } else {
            setSelectedBrands(new Set(filteredBrands.map(b => b.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedBrands.size === 0) return;
        if (!confirm(`Delete ${selectedBrands.size} selected brand${selectedBrands.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
        const ids = Array.from(selectedBrands);
        const updated = masterBrands.filter(b => !selectedBrands.has(b.id));
        onBrandsChange(updated);
        setSelectedBrands(new Set());
        try {
            await fetch('/api/brands', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
        } catch {}
    };

    const handleBulkApprove = async () => {
        if (selectedBrands.size === 0) return;
        const updated = masterBrands.map(b => selectedBrands.has(b.id) ? { ...b, status: 'Active' as const } : b);
        persistBrands(updated);
        setSelectedBrands(new Set());
    };

    const bulkMergeCandidates = useMemo(() => {
        if (!isBulkMergeModalOpen || selectedBrands.size < 2) return [];
        const selected = masterBrands.filter(b => selectedBrands.has(b.id));
        if (!bulkMergeSearch) return selected;
        return selected.filter(b => b.name.toLowerCase().includes(bulkMergeSearch.toLowerCase()));
    }, [isBulkMergeModalOpen, selectedBrands, masterBrands, bulkMergeSearch]);

    const handleBulkMerge = async (masterId: string) => {
        const sourceBrands = masterBrands.filter(b => selectedBrands.has(b.id) && b.id !== masterId);
        const master = masterBrands.find(b => b.id === masterId);
        if (!master || sourceBrands.length === 0) return;
        if (!confirm(`Merge ${sourceBrands.length} brand${sourceBrands.length > 1 ? 's' : ''} into "${master.name}"?\n\nAll supplier links and unit associations will be transferred to the master brand. The duplicates will be removed.`)) return;

        let mergedSupplierIds = [...(master.supplierIds || [])];
        let mergedAdoptedIds = [...(master.adoptedByUnitIds || [])];
        const sourceIds: string[] = [];

        for (const src of sourceBrands) {
            mergedSupplierIds.push(...(src.supplierIds || []));
            mergedAdoptedIds.push(...(src.adoptedByUnitIds || []), src.addedByUnitId);
            sourceIds.push(src.id);
        }

        mergedSupplierIds = Array.from(new Set(mergedSupplierIds));
        mergedAdoptedIds = Array.from(new Set(mergedAdoptedIds.filter(id => id && id !== master.addedByUnitId)));

        const updated = masterBrands
            .filter(b => !sourceIds.includes(b.id))
            .map(b => b.id === masterId ? { ...b, supplierIds: mergedSupplierIds, adoptedByUnitIds: mergedAdoptedIds, status: 'Active' as const } : b);

        persistBrands(updated);
        for (const id of sourceIds) {
            fetch('/api/brands', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
        }

        setSelectedBrands(new Set());
        setIsBulkMergeModalOpen(false);
        setBulkMergeSearch('');
    };

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number | 'All'>(10);

    const isCorporateAdmin = ['super-admin', 'corporate'].includes(currentScope);

    const currentUnitId = useMemo(() => {
        const ue = entities.find(e => e.id === userRootId);
        return ue?.id || 'System';
    }, [entities, userRootId]);

    // Fuzzy Search for Duplicity Control (Single Item)
    useEffect(() => {
        if (newBrandName.length < 2) { setSimilarBrands([]); return; }
        const matches = masterBrands.filter(b => {
            const score = jaroWinkler(b.name, newBrandName);
            return score > 0.80;
        });
        setSimilarBrands(matches);
    }, [newBrandName, masterBrands]);

    const scopedBrands = useMemo(() => {
        if (isCorporateAdmin) return masterBrands;
        return masterBrands.filter(b => {
            if (b.addedByUnitId === currentUnitId) return true;
            if ((b.adoptedByUnitIds || []).includes(currentUnitId)) return true;
            if (b.status === 'Active') return true;
            return false;
        });
    }, [masterBrands, isCorporateAdmin, currentUnitId]);

    const filteredBrands = useMemo(() => {
        return scopedBrands.filter(b => {
            const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                b.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                b.addedByUnitName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [scopedBrands, searchTerm, statusFilter]);

    // Paginated Data
    const totalItems = filteredBrands.length;
    const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(totalItems / (itemsPerPage as number));
    
    const paginatedBrands = useMemo(() => {
        if (itemsPerPage === 'All') return filteredBrands;
        const start = (currentPage - 1) * (itemsPerPage as number);
        return filteredBrands.slice(start, start + (itemsPerPage as number));
    }, [filteredBrands, currentPage, itemsPerPage]);

    // Handle page reset on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, itemsPerPage]);


    const persistBrands = async (updated: Brand[]) => {
        onBrandsChange(updated);
        const changedBrands = updated.filter(b => {
            const old = masterBrands.find(o => o.id === b.id);
            return !old || JSON.stringify(old) !== JSON.stringify(b);
        });
        if (changedBrands.length > 0) {
            const toSave = changedBrands.map(b => ({ ...b, corporateId: corporateEntity?.id }));
            // Routed through the shared registry-save manager so the badge
            // surfaces Saving/Saved/Save failed/Newer-server-version state
            // and the optimistic-conflict guard kicks in.
            await postRegistry('brands', '/api/brands', toSave);
        }
    };

    const handleAction = (id: string, action: 'Active' | 'Flagged' | 'Delete' | 'Rejected') => {
        if (action === 'Delete') {
            if (confirm('Remove this brand identity permanently?')) {
                persistBrands(masterBrands.filter(b => b.id !== id));
                fetch('/api/brands', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
            }
            return;
        }
        persistBrands(masterBrands.map(b => b.id === id ? { ...b, status: action } : b));
    };

    const mergeSuggestions = useMemo(() => {
        if (!mergeSource) return [];
        return masterBrands
            .filter(b => b.id !== mergeSource.id) 
            .map(b => ({
                brand: b,
                score: jaroWinkler(mergeSource.name, b.name)
            }))
            .filter(item => {
                if (mergeTargetSearch) {
                    return item.brand.name.toLowerCase().includes(mergeTargetSearch.toLowerCase());
                }
                return item.score > 0.6; 
            })
            .sort((a, b) => b.score - a.score);
    }, [mergeSource, masterBrands, mergeTargetSearch]);

    const handleMerge = (officialBrand: Brand) => {
        if (!mergeSource) return;
        
        if (!confirm(`Merge "${mergeSource.name}" into "${officialBrand.name}"?\n\nThis will transfer all supplier links and unit associations to the master brand and remove the duplicate.`)) return;

        const mergedSupplierIds = Array.from(new Set([...(officialBrand.supplierIds || []), ...(mergeSource.supplierIds || [])]));
        const mergedAdoptedIds = Array.from(new Set([...(officialBrand.adoptedByUnitIds || []), ...(mergeSource.adoptedByUnitIds || []), mergeSource.addedByUnitId].filter(id => id && id !== officialBrand.addedByUnitId)));

        const updated = masterBrands
            .filter(b => b.id !== mergeSource.id)
            .map(b => b.id === officialBrand.id ? { ...b, supplierIds: mergedSupplierIds, adoptedByUnitIds: mergedAdoptedIds } : b);

        persistBrands(updated);
        fetch('/api/brands', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mergeSource.id }) }).catch(() => {});

        setIsMergeModalOpen(false);
        setMergeSource(null);
        setMergeTargetSearch("");
    };

    const handleDownloadSample = () => {
        const headers = "Name,Description\n";
        const sampleRows = "Coca-Cola,Premium carbonated beverages\nNestlé,Global food and beverage processing\nUnilever,Consumer goods and nutrition";
        const blob = new Blob([headers + sampleRows], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brand_upload_sample.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const _isDuplicateBrand = (name: string, excludeId?: string): { isDup: boolean; matchedBrand?: Brand; score: number; reason?: string } => {
        const normalizedName = name.toLowerCase().trim();
        if (!normalizedName) return { isDup: false, score: 0 };
        const userEntity = entities.find(ent => ent.id === userRootId);
        for (const existing of masterBrands) {
            if (excludeId && existing.id === excludeId) continue;
            const exactMatch = existing.name.toLowerCase().trim() === normalizedName;
            if (exactMatch) {
                const sameUnit = existing.addedByUnitId === (userEntity?.id || 'System');
                return { isDup: true, matchedBrand: existing, score: 1, reason: sameUnit ? 'Exact duplicate in your unit' : `Already exists (added by ${existing.addedByUnitName})` };
            }
            const score = jaroWinkler(name, existing.name);
            if (score > 0.85) {
                return { isDup: true, matchedBrand: existing, score, reason: `Very similar to "${existing.name}" (${Math.round(score * 100)}% match)` };
            }
        }
        return { isDup: false, score: 0 };
    };

    const browsableBrands = useMemo(() => {
        return masterBrands.filter(b => {
            if (b.status !== 'Active') return false;
            if (b.addedByUnitId === currentUnitId) return false;
            if ((b.adoptedByUnitIds || []).includes(currentUnitId)) return false;
            const q = browseSearch.toLowerCase().trim();
            if (q && !b.name.toLowerCase().includes(q) && !b.addedByUnitName.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [masterBrands, currentUnitId, browseSearch]);

    const myBrandCount = useMemo(() => {
        return masterBrands.filter(b => b.addedByUnitId === currentUnitId || (b.adoptedByUnitIds || []).includes(currentUnitId)).length;
    }, [masterBrands, currentUnitId]);

    const handleAdoptSelected = () => {
        if (selectedForAdopt.size === 0) return;
        const updated = masterBrands.map(b => {
            if (!selectedForAdopt.has(b.id)) return b;
            const existing = b.adoptedByUnitIds || [];
            if (existing.includes(currentUnitId)) return b;
            return { ...b, adoptedByUnitIds: [...existing, currentUnitId] };
        });
        persistBrands(updated);
        setSelectedForAdopt(new Set());
        setView('dashboard');
    };

    const handleAdoptSingle = (brandId: string) => {
        const updated = masterBrands.map(b => {
            if (b.id !== brandId) return b;
            const existing = b.adoptedByUnitIds || [];
            if (existing.includes(currentUnitId)) return b;
            return { ...b, adoptedByUnitIds: [...existing, currentUnitId] };
        });
        persistBrands(updated);
    };

    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !corporateEntity) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csv = event.target?.result as string;
            const lines = csv.split('\n');
            const newRecords: Brand[] = [];
            const userEntity = entities.find(ent => ent.id === userRootId);
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const [name, description] = line.split(',').map(s => s.trim());
                if (!name) continue;

                newRecords.push({
                    id: `temp-${Date.now()}-${i}`,
                    name,
                    description: description || 'Bulk imported identity',
                    status: isCorporateAdmin ? 'Active' : 'Provisional', 
                    addedByUnitId: userEntity?.id || 'System',
                    addedByUnitName: userEntity?.name || 'Central Auth',
                    addedByUserName: userEntity?.contactPerson || 'Operator',
                    createdAt: new Date().toISOString().split('T')[0]
                });
            }

            const matched: Brand[] = [];
            const unique: Brand[] = [];
            const acceptedNames: string[] = [];

            newRecords.forEach(newBrand => {
                const normalizedName = newBrand.name.toLowerCase().trim();
                const batchDup = acceptedNames.find(n => {
                    if (n === normalizedName) return true;
                    return jaroWinkler(n, normalizedName) > 0.85;
                });
                if (batchDup) {
                    matched.push({
                        ...newBrand,
                        similarityScore: batchDup === normalizedName ? 1 : jaroWinkler(batchDup, normalizedName),
                        addedByUserName: newBrand.name,
                        description: 'Duplicate within this upload batch',
                    });
                    return;
                }

                const dupCheck = _isDuplicateBrand(newBrand.name);
                if (dupCheck.isDup && dupCheck.matchedBrand) {
                    matched.push({
                        ...newBrand,
                        similarityScore: dupCheck.score,
                        addedByUserName: dupCheck.matchedBrand.name,
                        description: dupCheck.reason || 'Duplicate',
                    });
                } else {
                    unique.push(newBrand);
                    acceptedNames.push(normalizedName);
                }
            });

            setReviewData({ matched, unique });
            if (matched.length > 0 || unique.length > 0) {
                setView('review');
            } else {
                alert("The file appears to be empty or contains invalid data.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const commitReview = () => {
        const totalToUpload = [...reviewData.unique]; 
        const sunkCount = reviewData.matched.length;

        if (totalToUpload.length === 0 && sunkCount === 0) {
            setView('dashboard');
            return;
        }

        const updated = [...totalToUpload.map(b => ({ ...b, corporateId: corporateEntity?.id })), ...masterBrands];
        persistBrands(updated);

        alert(`Commit Complete:\n- Finalized ${totalToUpload.length} new unique identities.\n- Sunk ${sunkCount} duplicate requests into the existing master registry.`);
        setView('dashboard');
        setReviewData({ matched: [], unique: [] });
    };

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData.entries());
        const brandName = (data.name as string).trim();

        if (!editingBrand) {
            const dupCheck = _isDuplicateBrand(brandName);
            if (dupCheck.isDup) {
                alert(`Cannot add "${brandName}": ${dupCheck.reason}`);
                return;
            }
        } else if (editingBrand.name.toLowerCase().trim() !== brandName.toLowerCase().trim()) {
            const dupCheck = _isDuplicateBrand(brandName, editingBrand.id);
            if (dupCheck.isDup) {
                alert(`Cannot rename to "${brandName}": ${dupCheck.reason}`);
                return;
            }
        }

        const userEntity = entities.find(e => e.id === userRootId);

        const brandPayload: Brand = {
            id: editingBrand?.id || `B-${Date.now()}`,
            name: brandName,
            description: data.description as string,
            status: editingBrand?.status || (isCorporateAdmin ? 'Active' : 'Provisional'),
            addedByUnitId: userEntity?.id || 'System',
            addedByUnitName: userEntity?.name || 'Central Auth',
            addedByUserName: userEntity?.contactPerson || 'Operator',
            createdAt: editingBrand?.createdAt || new Date().toISOString().split('T')[0],
            corporateId: corporateEntity?.id,
            supplierIds: editingBrand?.supplierIds || [],
        };

        const updatedBrands = editingBrand 
            ? masterBrands.map(b => b.id === editingBrand.id ? brandPayload : b)
            : [brandPayload, ...masterBrands];

        persistBrands(updatedBrands);
        setIsModalOpen(false);
        setEditingBrand(null);
        setNewBrandName("");
    };

    const handleLinkSupplier = (brandId: string, supplierId: string) => {
        const updated = masterBrands.map(b => {
            if (b.id !== brandId) return b;
            const existing = b.supplierIds || [];
            const newIds = existing.includes(supplierId)
                ? existing.filter(id => id !== supplierId)
                : [...existing, supplierId];
            return { ...b, supplierIds: newIds };
        });
        persistBrands(updated);
    };

    if (view === 'review') {
        return (
            <div className="space-y-4 animate-in fade-in duration-500 pb-20 px-0">
                <div className="bg-indigo-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <FileUp size={20} className="text-indigo-400 shrink-0" />
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Bulk Import Review</p>
                                <h2 className="text-sm font-bold uppercase">Verify & Commit Imported Brands</h2>
                            </div>
                        </div>
                        <button onClick={() => { setView('dashboard'); setReviewData({ matched: [], unique: [] }); }} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-3 sm:gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold">{reviewData.unique.length} New</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="text-xs font-bold">{reviewData.matched.length} Duplicates (skipped)</span>
                        </div>
                    </div>
                </div>

                {reviewData.unique.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
                            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2"><Check size={14} /> New Brands to Add ({reviewData.unique.length})</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {reviewData.unique.map((brand, i) => (
                                <div key={brand.id} className="px-6 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{brand.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{brand.description}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded-lg">{brand.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {reviewData.matched.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-amber-50/50">
                            <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 flex items-center gap-2"><AlertTriangle size={14} /> Duplicate Matches — Will Be Skipped ({reviewData.matched.length})</h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {reviewData.matched.map((brand, i) => (
                                <div key={brand.id} className="px-6 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{brand.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{brand.description === 'Duplicate within this upload batch' ? <span className="text-amber-600 font-bold">Duplicate within this upload batch</span> : <>Matched to: <span className="text-amber-600 font-bold">{brand.addedByUserName}</span> ({Math.round((brand.similarityScore || 0) * 100)}% match)</>}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[8px] font-black uppercase rounded-lg">Skipped</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button onClick={() => { setView('dashboard'); setReviewData({ matched: [], unique: [] }); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                        Cancel
                    </button>
                    <button onClick={commitReview} disabled={reviewData.unique.length === 0} className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <Check size={14} /> Commit {reviewData.unique.length} Brand{reviewData.unique.length !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'browse') {
        const allSelected = browsableBrands.length > 0 && browsableBrands.every(b => selectedForAdopt.has(b.id));
        return (
            <div className="space-y-4 animate-in fade-in duration-500 pb-20 px-0">
                <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-4 sm:p-6 rounded-2xl shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/10 rounded-xl"><Boxes size={22} /></div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Browse & Adopt</p>
                                <h2 className="text-sm font-bold uppercase">Corporate Brand Catalog</h2>
                                <p className="text-[9px] text-emerald-200 mt-0.5">Select brands from the master registry to adopt for your unit</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 sm:flex-none bg-white/10 rounded-xl px-3 py-2 text-center">
                                <p className="text-[9px] font-black uppercase text-emerald-300">Available</p>
                                <p className="text-lg font-black">{browsableBrands.length}</p>
                            </div>
                            <div className="flex-1 sm:flex-none bg-white/10 rounded-xl px-3 py-2 text-center">
                                <p className="text-[9px] font-black uppercase text-emerald-300">My Brands</p>
                                <p className="text-lg font-black">{myBrandCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-[112px] z-20">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={15} />
                            <input type="text" placeholder="Search available brands..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-slate-50 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-400 focus:bg-white transition-all shadow-inner" value={browseSearch} onChange={e => setBrowseSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            {browsableBrands.length > 0 && (
                                <button onClick={() => { if (allSelected) { setSelectedForAdopt(new Set()); } else { setSelectedForAdopt(new Set(browsableBrands.map(b => b.id))); } }} className="flex-1 sm:flex-none px-3 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm whitespace-nowrap">
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            )}
                            <button onClick={handleAdoptSelected} disabled={selectedForAdopt.size === 0} className="flex-1 sm:flex-none px-4 py-2.5 bg-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-teal-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap">
                                <Check size={13} /> Adopt ({selectedForAdopt.size})
                            </button>
                            <button onClick={() => { setView('dashboard'); setSelectedForAdopt(new Set()); setBrowseSearch(''); }} className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all shadow-sm" title="Back">
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {browsableBrands.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center">
                        <CheckCircle className="mx-auto text-emerald-300 mb-4" size={48} />
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">All Caught Up</p>
                        <p className="text-xs text-slate-400 mt-2">Your unit already has access to all available brands in the registry.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-teal-800 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="p-4 pl-6 w-12">
                                            <input type="checkbox" checked={allSelected} onChange={() => { if (allSelected) setSelectedForAdopt(new Set()); else setSelectedForAdopt(new Set(browsableBrands.map(b => b.id))); }} className="w-4 h-4 rounded border-white/30 accent-emerald-400" />
                                        </th>
                                        <th className="p-4">Brand Name</th>
                                        <th className="p-4 hidden md:table-cell">Description</th>
                                        <th className="p-4">Added By</th>
                                        <th className="p-4 hidden md:table-cell">Used By</th>
                                        <th className="p-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {browsableBrands.map(brand => {
                                        const isSelected = selectedForAdopt.has(brand.id);
                                        const adoptCount = (brand.adoptedByUnitIds || []).length;
                                        return (
                                            <tr key={brand.id} className={`group hover:bg-teal-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-teal-50' : ''}`} onClick={() => { setSelectedForAdopt(prev => { const next = new Set(prev); if (next.has(brand.id)) next.delete(brand.id); else next.add(brand.id); return next; }); }}>
                                                <td className="p-4 pl-6">
                                                    <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-4 h-4 rounded accent-teal-600" />
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-slate-50 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                                                            {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover" alt={brand.name} /> : <span className="font-black text-slate-300 text-sm">{brand.name.charAt(0)}</span>}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-800 uppercase tracking-tight">{brand.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase md:hidden">{brand.description?.substring(0, 40)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <p className="text-xs text-slate-500 max-w-xs truncate">{brand.description}</p>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <Building size={12} className="text-slate-400" />
                                                        <span className="text-xs font-bold text-slate-600 uppercase">{brand.addedByUnitName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-lg">{adoptCount + 1} unit{adoptCount + 1 !== 1 ? 's' : ''}</span>
                                                </td>
                                                <td className="p-4 text-center" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => handleAdoptSingle(brand.id)} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-teal-700 active:scale-95 transition-all shadow-sm">
                                                        Adopt
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3 sm:space-y-5 animate-in fade-in duration-500 pb-28 px-0">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/10 rounded-lg"><Globe size={18} className="text-indigo-300" /></div>
                    <div>
                        <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wide">Brand Registry</p>
                        <h2 className="text-base font-bold">{corporateEntity?.name || 'Global'}</h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[11px] font-medium text-white/60 mb-0.5">{isCorporateAdmin ? 'Total' : 'My Brands'}</p>
                        <p className="text-2xl font-extrabold leading-none">{scopedBrands.length}</p>
                    </div>
                    <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[11px] font-medium text-emerald-300 mb-0.5">Active</p>
                        <p className="text-2xl font-extrabold leading-none text-emerald-400">{scopedBrands.filter(b => b.status === 'Active').length}</p>
                    </div>
                    {isCorporateAdmin && (
                        <div className="flex-1 bg-amber-500/15 rounded-xl px-3 py-2.5 text-center">
                            <p className="text-[11px] font-medium text-amber-300 mb-0.5">Pending</p>
                            <p className="text-2xl font-extrabold leading-none text-amber-400">{masterBrands.filter(b => ['Provisional', 'Pending'].includes(b.status)).length}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Search & Actions Bar */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm sticky top-[112px] z-20 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search brands..."
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all shrink-0"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="All">All</option>
                        <option value="Active">Active</option>
                        <option value="Provisional">Prov.</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Flagged">Flagged</option>
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadSample} title="Download Sample CSV" className="p-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 transition-all active:scale-95"><Download size={16} /></button>
                    <input type="file" ref={fileInputRef} onChange={handleBulkUpload} accept=".csv" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} title="Bulk Import" className="p-2.5 bg-slate-50 border border-slate-200 text-indigo-500 rounded-xl hover:bg-indigo-50 transition-all active:scale-95"><FileUp size={16} /></button>
                    {!isCorporateAdmin && browsableBrands.length > 0 && (
                        <button onClick={() => { setView('browse'); setBrowseSearch(''); setSelectedForAdopt(new Set()); }} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold hover:bg-teal-700 transition-all active:scale-95 whitespace-nowrap">
                            <Boxes size={14} /> Browse
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold">{browsableBrands.length}</span>
                        </button>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => { setEditingBrand(null); setIsModalOpen(true); }} className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap shadow-sm">
                        <Plus size={16} strokeWidth={2.5} /> Add Brand
                    </button>
                </div>
                {/* Background-save badge — surfaces the debounced /api/brands
                    save lifecycle (Saving / Saved / Save failed / Newer
                    server version), mirrors the recipes/ingredients pattern. */}
                <RegistrySaveBadge registryKey="brands" hideWhenIdle label="brands" />
            </div>

            {/* Selection Action Banner — appears when items are checked */}
            {selectedBrands.size > 0 && (
                <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="text-sm font-bold">{selectedBrands.size}</span>
                        </div>
                        <span className="text-sm font-semibold">
                            {selectedBrands.size === filteredBrands.length ? 'All brands selected' : `${selectedBrands.size} brand${selectedBrands.size > 1 ? 's' : ''} selected`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedBrands(new Set())} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-all">
                            Deselect
                        </button>
                        <button onClick={handleBulkApprove} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95">
                            <CheckCircle size={14} /> Approve {selectedBrands.size}
                        </button>
                        {selectedBrands.size >= 2 && (
                            <button onClick={() => { setIsBulkMergeModalOpen(true); setBulkMergeSearch(''); }} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95">
                                <GitMerge size={14} /> Merge {selectedBrands.size}
                            </button>
                        )}
                        <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95">
                            <Trash2 size={14} /> Delete {selectedBrands.size}
                        </button>
                    </div>
                </div>
            )}

            {/* Tabular Layout for Desktop */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-col hidden md:flex">
                <div className="overflow-x-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900 text-white text-xs font-semibold uppercase tracking-wide border-b border-white/5">
                            <tr>
                                <th className="px-4 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={filteredBrands.length > 0 && selectedBrands.size === filteredBrands.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                                        title="Select all"
                                    />
                                </th>
                                <th className="px-4 py-4 w-[30%]">Brand</th>
                                <th className="px-6 py-4 w-[20%]">Added By</th>
                                <th className="px-6 py-4 w-[20%]">Suppliers</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {paginatedBrands.map((brand) => (
                                <tr key={brand.id} className={`group hover:bg-slate-50/80 transition-colors ${selectedBrands.has(brand.id) ? 'bg-indigo-50/60' : ['Pending', 'Provisional'].includes(brand.status) ? 'bg-amber-50/20' : brand.status === 'Rejected' ? 'bg-rose-50/20 opacity-80' : ''}`}>
                                    <td className="px-4 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedBrands.has(brand.id)}
                                            onChange={() => toggleSelect(brand.id)}
                                            onClick={e => e.stopPropagation()}
                                            className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                                                {brand.logo ? <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover" /> : <span className="font-bold text-xl text-slate-300">{brand.name.charAt(0)}</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors">{brand.name}</span>
                                                    {brand.status === 'Provisional' && (
                                                        <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-semibold rounded-full flex items-center gap-1"><Zap size={9} /> Emergency</span>
                                                    )}
                                                    {!isCorporateAdmin && brand.addedByUnitId !== currentUnitId && (brand.adoptedByUnitIds || []).includes(currentUnitId) && (
                                                        <span className="px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] font-semibold rounded-full flex items-center gap-1"><CheckCircle size={9} /> Adopted</span>
                                                    )}
                                                </div>
                                                {brand.description && <p className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{brand.description}</p>}
                                                <p className="text-[11px] text-slate-400 mt-1">{brand.createdAt}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400"><Building size={14} /></div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700">{brand.addedByUnitName}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">{brand.addedByUserName}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {(brand.supplierIds || []).slice(0, 3).map(sid => {
                                                const sup = suppliers.find(s => s.id === sid);
                                                return sup ? (
                                                    <span key={sid} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-medium truncate max-w-[100px]" title={sup.name}>{sup.name}</span>
                                                ) : null;
                                            })}
                                            {(brand.supplierIds || []).length > 3 && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px] font-medium">+{(brand.supplierIds || []).length - 3}</span>
                                            )}
                                            <button
                                                onClick={() => { setLinkingBrand(brand); setSupplierSearch(''); }}
                                                className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors"
                                                title="Link/unlink suppliers"
                                            >
                                                <Link size={13} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${brand.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : ['Pending', 'Provisional'].includes(brand.status) ? 'bg-amber-50 text-amber-600' : brand.status === 'Rejected' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${brand.status === 'Active' ? 'bg-emerald-500' : ['Pending', 'Provisional'].includes(brand.status) ? 'bg-amber-500' : 'bg-rose-400'}`} />
                                                {brand.status}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {isCorporateAdmin && ['Pending', 'Provisional'].includes(brand.status) ? (
                                                <>
                                                    <button onClick={() => handleAction(brand.id, 'Active')} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 transition-all" title="Approve"><Check size={16} strokeWidth={2.5} /></button>
                                                    <button onClick={() => { setMergeSource(brand); setIsMergeModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all" title="Sink"><Anchor size={16} /></button>
                                                    <button onClick={() => handleAction(brand.id, 'Rejected')} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Reject"><X size={16} strokeWidth={2.5} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => { setEditingBrand(brand); setNewBrandName(brand.name); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Edit"><Edit size={16} /></button>
                                                    <button onClick={() => handleAction(brand.id, 'Delete')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <UnifiedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    rowsPerPage={typeof itemsPerPage === 'number' ? itemsPerPage : totalItems}
                    onPageChange={setCurrentPage}
                    onRowsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {paginatedBrands.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center">
                        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Tag size={24} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">No brands found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    paginatedBrands.map(brand => {
                        const isPending = ['Pending', 'Provisional'].includes(brand.status);
                        const isAdopted = !isCorporateAdmin && brand.addedByUnitId !== currentUnitId && (brand.adoptedByUnitIds || []).includes(currentUnitId);
                        const supplierCount = (brand.supplierIds || []).length;
                        const isSelected = selectedBrands.has(brand.id);
                        return (
                            <div key={brand.id} className={`rounded-2xl border overflow-hidden transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50/40 shadow-sm shadow-indigo-100' : isPending ? 'border-amber-200 bg-amber-50/30' : brand.status === 'Rejected' ? 'border-rose-100 opacity-70 bg-white' : 'bg-white border-slate-200'}`}>
                                {/* Brand Info */}
                                <div className="p-4 flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelect(brand.id)}
                                        className="w-5 h-5 rounded accent-indigo-500 cursor-pointer shrink-0"
                                    />
                                    <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                                        {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover" alt={brand.name} /> : <span className="font-bold text-lg text-slate-300">{brand.name.charAt(0)}</span>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-slate-800 text-[15px] leading-snug truncate">{brand.name}</h4>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${brand.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : isPending ? 'bg-amber-50 text-amber-600' : brand.status === 'Rejected' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${brand.status === 'Active' ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-rose-400'}`} />
                                                {brand.status}
                                            </span>
                                        </div>
                                        {brand.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{brand.description}</p>}
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            {brand.status === 'Provisional' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-semibold rounded-full"><Zap size={9} /> Emergency</span>
                                            )}
                                            {isAdopted && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] font-semibold rounded-full"><CheckCircle size={9} /> Adopted</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Meta Row */}
                                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Building size={12} className="text-slate-400" /> {brand.addedByUnitName}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="flex items-center gap-1"><History size={12} className="text-slate-400" /> {brand.createdAt}</span>
                                    {supplierCount > 0 && (
                                        <>
                                            <span className="text-slate-300">|</span>
                                            <span className="flex items-center gap-1 text-indigo-500 font-medium"><Link size={12} /> {supplierCount}</span>
                                        </>
                                    )}
                                </div>

                                {/* Supplier Chips */}
                                {supplierCount > 0 && (
                                    <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-slate-50">
                                        {(brand.supplierIds || []).slice(0, 3).map(sid => {
                                            const sup = suppliers.find(s => s.id === sid);
                                            return sup ? <span key={sid} className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[11px] font-medium">{sup.name}</span> : null;
                                        })}
                                        {supplierCount > 3 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[11px] font-medium">+{supplierCount - 3}</span>}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="px-4 py-3 border-t border-slate-100">
                                    {isCorporateAdmin && isPending ? (
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleAction(brand.id, 'Active')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all">
                                                <Check size={15} strokeWidth={2.5} /> Approve
                                            </button>
                                            <button onClick={() => { setMergeSource(brand); setIsMergeModalOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold active:scale-95 transition-all border border-blue-100">
                                                <Anchor size={15} /> Sink
                                            </button>
                                            <button onClick={() => handleAction(brand.id, 'Rejected')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold active:scale-95 transition-all border border-rose-100">
                                                <X size={15} strokeWidth={2.5} /> Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <button onClick={() => { setLinkingBrand(brand); setSupplierSearch(''); }} className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-indigo-600 rounded-lg text-xs font-medium transition-all">
                                                <Link size={14} /> Suppliers
                                            </button>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => { setEditingBrand(brand); setNewBrandName(brand.name); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => handleAction(brand.id, 'Delete')} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Mobile Pagination */}
                {totalPages > 1 && (
                    <UnifiedPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        rowsPerPage={typeof itemsPerPage === 'number' ? itemsPerPage : totalItems}
                        onPageChange={setCurrentPage}
                        onRowsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                    />
                )}

                {/* Mobile FAB */}
                <button
                    onClick={() => { setEditingBrand(null); setNewBrandName(''); setIsModalOpen(true); }}
                    className="sm:hidden fixed bottom-6 right-5 z-[100] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 flex items-center justify-center active:scale-90 transition-all"
                    aria-label="Add new brand"
                >
                    <Plus size={26} strokeWidth={2.5} />
                </button>
            </div>

            {/* Add/Edit Modal — native bottom sheet on mobile, centered dialog on desktop */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200 sm:p-6"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300 sm:zoom-in-95 sm:slide-in-from-bottom-0"
                        style={{ maxHeight: '90dvh' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Native drag handle — mobile only */}
                        <div className="sm:hidden flex justify-center pt-3 pb-0 shrink-0">
                            <div className="w-10 h-1 bg-slate-300 rounded-full" />
                        </div>

                        {/* Header — compact, white */}
                        <div className="px-5 pt-4 pb-1 sm:pt-5 sm:px-6 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                                    <Tag size={17} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">{editingBrand ? 'Edit Brand' : 'New Brand'}</h3>
                                    <p className="text-[11px] text-slate-400">Enter brand details below</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all shrink-0"
                            ><X size={17} /></button>
                        </div>

                        {/* Divider */}
                        <div className="mx-5 sm:mx-6 mt-3 border-t border-slate-100" />

                        {/* Form body — scrollable */}
                        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
                            <div className="flex-1 overflow-y-auto px-5 sm:px-6 pt-4 pb-2 space-y-4">
                                {/* Brand Name */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Brand Name <span className="text-rose-400">*</span></label>
                                    <input
                                        required
                                        name="name"
                                        value={newBrandName}
                                        onChange={e => setNewBrandName(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[15px] font-bold text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all uppercase placeholder:font-normal placeholder:text-slate-400 placeholder:normal-case"
                                        placeholder="e.g. UNILEVER, NESTLE..."
                                        autoFocus
                                    />
                                </div>

                                {/* Duplicate warning */}
                                {similarBrands.length > 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                                            <span className="text-xs font-semibold text-amber-700">Similar brands already exist</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {similarBrands.map(b => (
                                                <div key={b.id} className="bg-white px-3 py-2 rounded-lg border border-amber-100 flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-slate-700">{b.name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{b.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-amber-600">You can still add if this is a different brand.</p>
                                    </div>
                                )}

                                {/* Description */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Description <span className="text-slate-300 font-normal normal-case">(optional)</span></label>
                                    <textarea
                                        name="description"
                                        defaultValue={editingBrand?.description}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-indigo-400 focus:bg-white resize-none transition-all placeholder:text-slate-400"
                                        placeholder="Category, product type, or notes..."
                                    />
                                </div>
                            </div>

                            {/* Sticky footer CTA */}
                            <div className="px-5 sm:px-6 pt-3 pb-6 sm:pb-5 space-y-2.5 border-t border-slate-100 shrink-0 bg-white">
                                <button
                                    type="submit"
                                    className="w-full py-4 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[15px] sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm"
                                >
                                    <Save size={16} /> {editingBrand ? 'Save Changes' : 'Add Brand'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-2.5 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors text-center"
                                >
                                    Discard
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Merge/Sink Modal */}
            {isMergeModalOpen && mergeSource && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl sm:max-w-4xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95">
                        <div className="px-5 sm:px-8 py-4 sm:py-6 bg-blue-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Anchor size={24} />
                                <div><h3 className="text-base sm:text-lg font-bold">Merge Brands</h3><p className="text-xs text-blue-200 mt-0.5">Consolidate duplicate brands into a master record</p></div>
                            </div>
                            <button onClick={() => setIsMergeModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white"><X size={22}/></button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                            <div className="p-4 sm:p-6 border-b border-slate-100 bg-white">
                                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                                    <div className="w-full sm:flex-1 bg-rose-50 border border-rose-200 p-4 rounded-xl">
                                        <p className="text-[11px] font-semibold text-rose-500 mb-1">Source (Duplicate)</p>
                                        <h4 className="text-base font-bold text-slate-800">{mergeSource.name}</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">{mergeSource.addedByUnitName}</p>
                                    </div>
                                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white shrink-0 rotate-90 sm:rotate-0"><ArrowRight size={16} strokeWidth={2.5} /></div>
                                    <div className="w-full sm:flex-1 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                        <p className="text-[11px] font-semibold text-emerald-600 mb-1">Destination (Master)</p>
                                        <h4 className="text-base font-bold text-slate-400 italic">Choose below...</h4>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 space-y-3">
                                <div className="relative shrink-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input type="text" placeholder="Search master brands..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" value={mergeTargetSearch} onChange={e => setMergeTargetSearch(e.target.value)} />
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                    {mergeSuggestions.map(item => (
                                        <button key={item.brand.id} onClick={() => handleMerge(item.brand)} className="w-full text-left p-3 sm:p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all font-bold text-sm shrink-0">{item.brand.name.charAt(0)}</div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{item.brand.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.brand.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{item.brand.status}</span>
                                                        <span className="text-xs font-medium text-blue-500">{Math.round(item.score * 100)}% match</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-1.5 text-slate-300 group-hover:text-blue-500 transition-all shrink-0 ml-2"><ChevronRight size={18} /></div>
                                        </button>
                                    ))}
                                    {mergeSuggestions.length === 0 && <div className="p-10 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No matching brands found</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isBulkMergeModalOpen && selectedBrands.size >= 2 && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
                        <div className="px-5 py-4 bg-blue-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <GitMerge size={22} />
                                <div><h3 className="text-base font-bold">Bulk Merge</h3><p className="text-xs text-blue-200 mt-0.5">Pick the master brand — all others merge into it</p></div>
                            </div>
                            <button onClick={() => setIsBulkMergeModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-4 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle size={14} className="shrink-0" />
                            {selectedBrands.size} brands selected — {selectedBrands.size - 1} will be merged into the master you choose below
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-3">
                            {bulkMergeCandidates.length > 4 && (
                                <div className="relative shrink-0">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                    <input type="text" placeholder="Filter selected brands..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" value={bulkMergeSearch} onChange={e => setBulkMergeSearch(e.target.value)} />
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                {bulkMergeCandidates.map(brand => (
                                    <button key={brand.id} onClick={() => handleBulkMerge(brand.id)} className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-md transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all font-bold text-sm shrink-0">{brand.name.charAt(0)}</div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 text-sm truncate">{brand.name}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">{brand.addedByUnitName} · {brand.status}</p>
                                            </div>
                                        </div>
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase shrink-0 ml-2 group-hover:bg-blue-600 group-hover:text-white transition-all">Use as Master</span>
                                    </button>
                                ))}
                                {bulkMergeCandidates.length === 0 && <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No matching brands</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Supplier Link Modal */}
            {linkingBrand && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setLinkingBrand(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-semibold text-indigo-300">Link Suppliers</p>
                                <h3 className="text-base font-bold">{linkingBrand.name}</h3>
                            </div>
                            <button onClick={() => setLinkingBrand(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"><X size={18} /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                                <input
                                    autoFocus
                                    value={supplierSearch}
                                    onChange={e => setSupplierSearch(e.target.value)}
                                    placeholder="Search suppliers..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                                {suppliers
                                    .filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
                                    .map(sup => {
                                        const linked = (linkingBrand.supplierIds || []).includes(sup.id);
                                        return (
                                            <button
                                                key={sup.id}
                                                onClick={() => {
                                                    handleLinkSupplier(linkingBrand.id, sup.id);
                                                    setLinkingBrand(prev => prev ? {
                                                        ...prev,
                                                        supplierIds: linked
                                                            ? (prev.supplierIds || []).filter(id => id !== sup.id)
                                                            : [...(prev.supplierIds || []), sup.id]
                                                    } : null);
                                                }}
                                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${linked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50'}`}
                                            >
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-700">{sup.name}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{sup.type} · {sup.status}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${linked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                    {linked && <Check size={10} className="text-white" strokeWidth={3} />}
                                                </div>
                                            </button>
                                        );
                                    })
                                }
                                {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                                    <p className="text-center text-sm text-slate-400 py-8">No suppliers found</p>
                                )}
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase">
                                    {(linkingBrand.supplierIds || []).length} supplier(s) linked
                                </span>
                                <button onClick={() => setLinkingBrand(null)} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors">Done</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrandManagement;