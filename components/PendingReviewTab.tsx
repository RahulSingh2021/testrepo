"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Clock, CheckCircle2, XCircle, Eye, X,
  Thermometer, Camera, MessageSquare, Truck,
  Package, FileText, Calendar, Hash, Loader2,
  ChevronDown, ChevronRight, AlertTriangle,
  Check, Shield, FileSearch, Tag, Layers
} from 'lucide-react';
import { SupplierSubmission, ReceivingEntry, Supplier, RawMaterial, Entity, HierarchyScope } from '../types';
import { compressImage } from '@/utils/imageCompression';

interface PendingReviewTabProps {
  suppliers: Supplier[];
  rawMaterials: RawMaterial[];
  currentScope: HierarchyScope;
  userRootId?: string | null;
  entities: Entity[];
  onPromoteToRegister: (entry: ReceivingEntry) => void;
}

const isDescendant = (ancestorId: string, potentialDescendantId: string, allEntities: Entity[]): boolean => {
  let current = allEntities.find(e => e.id === potentialDescendantId);
  while (current) {
    if (current.id === ancestorId) return true;
    current = allEntities.find(parent => parent.id === current?.parentId);
  }
  return false;
};

const PendingReviewTab: React.FC<PendingReviewTabProps> = ({
  suppliers,
  rawMaterials,
  currentScope,
  userRootId,
  entities,
  onPromoteToRegister,
}) => {
  const [submissions, setSubmissions] = useState<SupplierSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'rejected'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<SupplierSubmission | null>(null);
  const [reviewData, setReviewData] = useState({
    comments: '',
    temperature: '',
    tempImage: null as string | null,
    correctiveAction: '',
  });

  const scopedUnitIds = useMemo(() => {
    if (!userRootId) return currentScope === 'super-admin' ? null : [];
    if (currentScope === 'unit' || currentScope === 'department') {
      const parentId = entities.find(e => e.id === userRootId)?.parentId;
      const ids = [userRootId];
      if (parentId) ids.push(parentId);
      return ids;
    }
    if (currentScope === 'corporate' || currentScope === 'regional') {
      return entities.filter(e => isDescendant(userRootId, e.id, entities)).map(e => e.id);
    }
    return [];
  }, [userRootId, currentScope, entities]);

  const loadSubmissions = async () => {
    try {
      if (scopedUnitIds !== null && scopedUnitIds.length === 0) {
        setSubmissions([]);
        setIsLoading(false);
        return;
      }

      const url = scopedUnitIds === null
        ? `/api/supplier-submissions?unitIds=__all__`
        : `/api/supplier-submissions?unitIds=${scopedUnitIds.map(encodeURIComponent).join(',')}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const records: SupplierSubmission[] = await res.json();
      setSubmissions(records);
    } catch (err) {
      console.error('Failed to load supplier submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [userRootId, currentScope]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (statusFilter === 'all' && sub.status === 'approved') return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          sub.supplierName.toLowerCase().includes(term) ||
          sub.materialName.toLowerCase().includes(term) ||
          sub.batchNo?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [submissions, statusFilter, searchTerm]);

  const handleApprove = async (sub: SupplierSubmission) => {
    const now = new Date();
    const newRecordId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const updatedSub: SupplierSubmission = {
      ...sub,
      status: 'approved',
      reviewerComments: reviewData.comments,
      temperature: reviewData.temperature ? Number(reviewData.temperature) : undefined,
      tempImageSrc: reviewData.tempImage,
      correctiveAction: reviewData.correctiveAction,
      reviewedAt: now.toISOString(),
      reviewedBy: 'QA Manager',
      promotedRecordId: newRecordId,
    };

    try {
      const patchRes = await fetch('/api/supplier-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSub),
      });
      if (!patchRes.ok) throw new Error('Failed to update submission status');

      const receivingEntry: ReceivingEntry = {
        id: newRecordId,
        rec: `REC-${Math.floor(Math.random() * 90000) + 10000}`,
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        materialName: sub.materialName,
        brand: sub.brand,
        vendor: sub.supplierName,
        invoiceNo: sub.invoiceFile ? 'Supplier Upload' : 'N/A',
        batchNo: sub.batchNo || '',
        orderedQty: sub.quantity,
        receivedQty: sub.quantity,
        unit: sub.unit,
        mfgDate: '',
        expDate: '',
        temperature: reviewData.temperature ? Number(reviewData.temperature) : undefined,
        tempImageSrc: reviewData.tempImage,
        condition: 'Good',
        qcStatus: 'Verified',
        status: 'Approved',
        correctiveAction: reviewData.correctiveAction,
        receiver: 'QA Manager',
        verified: false,
        vendorEval: 85,
        unitId: sub.unitId,
        attachments: {
          invoice: !!sub.invoiceFile,
          formE: !!sub.formEFile,
          coa: !!sub.coaFile,
        },
      };

      const recRes = await fetch('/api/receiving-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receivingEntry),
      });
      if (!recRes.ok) throw new Error('Failed to create receiving record');

      onPromoteToRegister(receivingEntry);

      setSubmissions(prev => prev.map(s => s.id === sub.id ? updatedSub : s));
      setSelectedSubmission(null);
      setReviewData({ comments: '', temperature: '', tempImage: null, correctiveAction: '' });
    } catch (err) {
      console.error('Failed to approve submission:', err);
      alert('Failed to approve submission. Please try again.');
    }
  };

  const handleReject = async (sub: SupplierSubmission) => {
    if (!reviewData.comments) {
      alert('Please add a comment explaining the rejection reason.');
      return;
    }

    const updatedSub: SupplierSubmission = {
      ...sub,
      status: 'rejected',
      reviewerComments: reviewData.comments,
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'QA Manager',
    };

    try {
      const patchRes = await fetch('/api/supplier-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSub),
      });
      if (!patchRes.ok) throw new Error('Failed to update submission status');

      setSubmissions(prev => prev.map(s => s.id === sub.id ? updatedSub : s));
      setSelectedSubmission(null);
      setReviewData({ comments: '', temperature: '', tempImage: null, correctiveAction: '' });
    } catch (err) {
      console.error('Failed to reject submission:', err);
      alert('Failed to reject submission. Please try again.');
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const compressed = await compressImage(event.target?.result as string);
        setReviewData(prev => ({ ...prev, tempImage: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {[
              { key: 'all', label: `All (${pendingCount + rejectedCount})` },
              { key: 'pending', label: `Pending (${pendingCount})` },
              { key: 'rejected', label: `Rejected (${rejectedCount})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 shadow-sm"
            placeholder="Search submissions..."
          />
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No Submissions</p>
          <p className="text-[10px] text-slate-400 mt-1">No supplier submissions match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubmissions.map(sub => (
            <div
              key={sub.id}
              onClick={() => {
                setSelectedSubmission(sub);
                setReviewData({ comments: '', temperature: '', tempImage: null, correctiveAction: '' });
              }}
              className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                selectedSubmission?.id === sub.id ? 'border-indigo-400 shadow-lg' : 'border-slate-100 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    sub.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                    sub.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {sub.status === 'pending' ? <Clock size={18} /> :
                     sub.status === 'rejected' ? <XCircle size={18} /> :
                     <CheckCircle2 size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{sub.materialName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{sub.supplierName}</span>
                      <span className="text-[9px] font-bold text-slate-300">•</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{sub.brand}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right hidden md:block">
                    <p className="text-[9px] font-black text-slate-600 uppercase">{sub.quantity} {sub.unit}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">ETA: {sub.expectedDeliveryDate}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${
                    sub.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    sub.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                    'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    {sub.status}
                  </span>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
              {sub.status === 'rejected' && sub.reviewerComments && (
                <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl">
                  <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">Rejection Reason</p>
                  <p className="text-[9px] font-semibold text-rose-700">{sub.reviewerComments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSubmission(null)} />
          <div className="relative w-full md:max-w-2xl bg-white md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[90dvh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Review Submission</h3>
                <p className="text-[9px] font-bold text-white/50 mt-1 uppercase tracking-wider">
                  {selectedSubmission.supplierName} • {selectedSubmission.materialName}
                </p>
              </div>
              <button onClick={() => setSelectedSubmission(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Material</p>
                  <p className="text-xs font-black text-slate-800 uppercase">{selectedSubmission.materialName}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Brand</p>
                  <p className="text-xs font-black text-slate-800 uppercase">{selectedSubmission.brand}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                  <p className="text-xs font-black text-slate-800 uppercase">{selectedSubmission.supplierName}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Quantity</p>
                  <p className="text-xs font-black text-slate-800">{selectedSubmission.quantity} {selectedSubmission.unit}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch / Lot</p>
                  <p className="text-xs font-black text-slate-800 uppercase">{selectedSubmission.batchNo || 'N/A'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                  <p className="text-xs font-black text-slate-800">{selectedSubmission.expectedDeliveryDate}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uploaded Documents</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'COA', file: selectedSubmission.coaFile },
                    { label: 'Invoice', file: selectedSubmission.invoiceFile },
                    { label: 'Form E', file: selectedSubmission.formEFile },
                  ].map(doc => (
                    <div key={doc.label} className={`p-3 rounded-xl border text-center ${
                      doc.file ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <FileText size={16} className={`mx-auto mb-1 ${doc.file ? 'text-blue-500' : 'text-slate-300'}`} />
                      <p className={`text-[9px] font-black uppercase ${doc.file ? 'text-blue-700' : 'text-slate-400'}`}>
                        {doc.label}
                      </p>
                      <p className={`text-[8px] font-bold uppercase mt-0.5 ${doc.file ? 'text-blue-500' : 'text-slate-300'}`}>
                        {doc.file ? 'Uploaded' : 'Not Provided'}
                      </p>
                      {doc.file && typeof doc.file === 'string' && doc.file.startsWith('data:') && (
                        <button
                          onClick={() => {
                            const w = window.open('');
                            if (w) {
                              if (doc.file!.startsWith('data:image')) {
                                w.document.write(`<img src="${doc.file}" style="max-width:100%" />`);
                              } else {
                                w.document.write(`<iframe src="${doc.file}" style="width:100%;height:100vh;border:none"></iframe>`);
                              }
                            }
                          }}
                          className="mt-1 px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-[8px] font-black uppercase hover:bg-blue-200 transition-colors"
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedSubmission.status === 'pending' && (
                <div className="space-y-5 pt-2 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-800 uppercase tracking-widest pt-2">Receiving Team Actions</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Arrival Temperature °C</label>
                      <input
                        type="number"
                        step="0.1"
                        value={reviewData.temperature}
                        onChange={e => setReviewData(prev => ({ ...prev, temperature: e.target.value }))}
                        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-blue-500 shadow-inner"
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Thermometer Photo</label>
                      <div className="flex items-center gap-2">
                        <label className="shrink-0 w-12 h-12 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all">
                          <Camera size={16} className="text-blue-500" />
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
                        </label>
                        {reviewData.tempImage && (
                          <div className="relative">
                            <img src={reviewData.tempImage} className="w-12 h-12 object-cover rounded-xl border border-blue-100" />
                            <button
                              onClick={() => setReviewData(prev => ({ ...prev, tempImage: null }))}
                              className="absolute -top-1 -right-1 p-0.5 bg-white rounded-full shadow border border-slate-200 text-slate-400 hover:text-rose-500"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                      <MessageSquare size={12} /> Review Comments
                    </label>
                    <textarea
                      value={reviewData.comments}
                      onChange={e => setReviewData(prev => ({ ...prev, comments: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 shadow-inner resize-none"
                      rows={3}
                      placeholder="Add review comments..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Corrective Action</label>
                    <textarea
                      value={reviewData.correctiveAction}
                      onChange={e => setReviewData(prev => ({ ...prev, correctiveAction: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 shadow-inner resize-none"
                      rows={2}
                      placeholder="Describe corrective action (if any)..."
                    />
                  </div>
                </div>
              )}
            </div>

            {selectedSubmission.status === 'pending' && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4">
                <button
                  onClick={() => handleReject(selectedSubmission)}
                  className="px-6 py-3 bg-rose-50 text-rose-700 border-2 border-rose-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedSubmission)}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 size={14} /> Approve & Register
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingReviewTab;
