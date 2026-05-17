'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface RecordData {
    rec: string;
    vendor: string;
    date: string;
    time: string;
    invoiceNo: string;
    poNumber?: string;
    materialName: string;
    brand: string;
    batchNo: string;
    mfgDate: string;
    expDate: string;
    orderedQty: string;
    receivedQty: string;
    unit: string;
    temperature: string;
    condition?: string;
    qcStatus?: string;
    vendorEval?: string;
    status: string;
    receiver?: string;
    verified: boolean;
    verifiedBy?: string;
    verificationComments?: string;
    verificationDate?: string;
    correctiveAction?: string;
    rejectionRemarks?: string;
}

function RecordContent() {
    const searchParams = useSearchParams();
    const [record, setRecord] = useState<RecordData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        try {
            const d = searchParams.get('d');
            if (d) {
                const raw = JSON.parse(decodeURIComponent(escape(atob(d))));
                const decoded: RecordData = {
                    rec: raw.r || raw.rec || '', vendor: raw.v || raw.vendor || '',
                    date: raw.d || raw.date || '', time: raw.t || raw.time || '',
                    invoiceNo: raw.i || raw.invoiceNo || '',
                    poNumber: raw.po || raw.poNumber,
                    materialName: raw.m || raw.materialName || '',
                    brand: raw.br || raw.brand || '', batchNo: raw.b || raw.batchNo || '',
                    mfgDate: raw.md || raw.mfgDate || '', expDate: raw.ed || raw.expDate || '',
                    orderedQty: raw.oq || raw.orderedQty || '',
                    receivedQty: raw.rq || raw.receivedQty || '',
                    unit: raw.u || raw.unit || '',
                    temperature: raw.tp || raw.temperature || '',
                    condition: raw.cn || raw.condition,
                    qcStatus: raw.qc || raw.qcStatus,
                    vendorEval: raw.ve || raw.vendorEval,
                    status: raw.s || raw.status || '',
                    receiver: raw.rc || raw.receiver,
                    verified: raw.vf === 1 || raw.verified === true,
                    verifiedBy: raw.vb || raw.verifiedBy,
                    verificationComments: raw.vc || raw.verificationComments,
                    verificationDate: raw.vd || raw.verificationDate,
                    correctiveAction: raw.ca || raw.correctiveAction,
                    rejectionRemarks: raw.rr || raw.rejectionRemarks,
                };
                setRecord(decoded);
            } else {
                setError(true);
            }
        } catch {
            setError(true);
        }
    }, [searchParams]);

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Record</h2>
                    <p className="text-slate-500">This QR code does not contain valid record data. Please scan a valid HACCP PRO receiving record QR code.</p>
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const statusColor: Record<string, string> = {
        'Approved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Rejected': 'bg-rose-100 text-rose-700 border-rose-200',
        'Partial': 'bg-amber-100 text-amber-700 border-amber-200',
    };

    const expDt = new Date(record.expDate);
    const now = new Date();
    const diffDays = Math.ceil((expDt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 mb-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            </div>
                            <div>
                                <h1 className="text-white font-black text-sm tracking-wider uppercase">HACCP PRO</h1>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Receiving Record Verification</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColor[record.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {record.status?.toUpperCase()}
                        </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-white/60 text-xs">Record <span className="text-white font-bold">#{record.rec}</span></p>
                        <p className="text-white/40 text-xs">{record.date} | {record.time}</p>
                    </div>
                </div>

                <Section title="Unit Details">
                    <Row label="Department" value="Receiving" />
                    <Row label="Unit Name" value="Central Kitchen" />
                    <Row label="Regional" value="Manhattan Hub" />
                    <Row label="Corporate" value="HACCP PRO" valueClass="text-indigo-600 font-black" />
                </Section>

                <Section title="Registry Identity & Vendor Information">
                    <Row label="Vendor" value={record.vendor} />
                    <Row label="Invoice No" value={record.invoiceNo} />
                    <Row label="PO Number" value={record.poNumber || 'N/A'} />
                    <Row label="Date / Time" value={`${record.date} | ${record.time}`} />
                </Section>

                <Section title="Product Analysis & Batch Details">
                    <Row label="Material Name" value={record.materialName} valueClass="text-indigo-600 font-black" />
                    <Row label="Brand" value={record.brand} />
                    <Row label="Batch No" value={record.batchNo} />
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Mfg Date" value={record.mfgDate} valueClass="text-emerald-600" />
                        <Row label="Exp Date" value={record.expDate} valueClass="text-rose-600" />
                    </div>
                    <Row label="Remaining Shelf Life" value={diffDays > 0 ? `${Math.floor(diffDays / 30)} months ${diffDays % 30} days` : 'Expired'} valueClass={diffDays <= 30 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'} />
                </Section>

                <Section title="Quantities & Discrepancy">
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Ordered Qty" value={`${record.orderedQty} ${record.unit}`} />
                        <Row label="Received Qty" value={`${record.receivedQty} ${record.unit}`} />
                    </div>
                    {record.rejectionRemarks && <Row label="Rejection Remarks" value={record.rejectionRemarks} valueClass="text-rose-600" />}
                    {record.correctiveAction && <Row label="Corrective Action" value={record.correctiveAction} valueClass="text-amber-600" />}
                </Section>

                <Section title="Temperature & Quality Control">
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Temperature" value={`${record.temperature}°C`} valueClass="text-blue-600 font-black text-lg" />
                        <Row label="Condition" value={record.condition || 'Good'} />
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="QC Status" value={record.qcStatus || 'Verified'} valueClass={record.qcStatus === 'Rejected' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'} />
                        <Row label="Vendor Evaluation" value={`${record.vendorEval || 0}%`} />
                    </div>
                </Section>

                <Section title="Authorization & Verification">
                    <Row label="Receiver / Operator" value={record.receiver || 'N/A'} />
                    <Row label="Verified By" value={record.verified ? (record.verifiedBy || 'N/A') : 'PENDING'} valueClass={record.verified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    <Row label="Verification Status" value={record.verified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION'} valueClass={record.verified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    {record.verificationComments && <Row label="Comments" value={record.verificationComments} />}
                    {record.verificationDate && <Row label="Verification Date" value={new Date(record.verificationDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} />}
                </Section>

                <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">HACCP PRO Verified Document</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Generated by HACCP PRO Enterprise Systems | ISO 22000:2018 Compliant</p>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-4">
            <div className="bg-slate-800 rounded-t-xl px-4 py-2.5">
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest">{title}</h3>
            </div>
            <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl overflow-hidden divide-y divide-slate-100">
                {children}
            </div>
        </div>
    );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-slate-500 font-medium">{label}</span>
            <span className={`text-sm font-semibold text-slate-900 text-right max-w-[60%] ${valueClass || ''}`}>{value}</span>
        </div>
    );
}

export default function RecordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        }>
            <RecordContent />
        </Suspense>
    );
}
