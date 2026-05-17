'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface ReheatRecordData {
    pn: string;
    src: string;
    cat: string;
    bn: string;
    sr: string;
    md: string;
    ed: string;
    lo: string;
    dp: string;
    ut: string;
    rg: string;
    co: string;
    rv: string;
    rq: string;
    mt: string;
    rs: string;
    rc: string;
    it: string;
    ft: string;
    du: string;
    cb: string;
    rp: string;
    ca: string;
    tt: string;
    ct: string;
    ck: string;
    cl: string;
    cp: string;
    st: string;
    vf: number;
    vn: string;
    vc: string;
    iss: string;
}

function ReheatRecordContent() {
    const searchParams = useSearchParams();
    const [record, setRecord] = useState<ReheatRecordData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        try {
            const d = searchParams.get('d');
            if (d) {
                const raw = JSON.parse(decodeURIComponent(escape(atob(d))));
                const decoded: ReheatRecordData = {
                    pn: raw.pn || '',
                    src: raw.src || '',
                    cat: raw.cat || '',
                    bn: raw.bn || '',
                    sr: raw.sr || '',
                    md: raw.md || '',
                    ed: raw.ed || '',
                    lo: raw.lo || '',
                    dp: raw.dp || '',
                    ut: raw.ut || '',
                    rg: raw.rg || '',
                    co: raw.co || '',
                    rv: raw.rv || '',
                    rq: raw.rq || '',
                    mt: raw.mt || '',
                    rs: raw.rs || '',
                    rc: raw.rc || '',
                    it: raw.it || '',
                    ft: raw.ft || '',
                    du: raw.du || '',
                    cb: raw.cb || '',
                    rp: raw.rp || '',
                    ca: raw.ca || '',
                    tt: raw.tt || '',
                    ct: raw.ct || '',
                    ck: raw.ck || '',
                    cl: raw.cl || '',
                    cp: raw.cp || '',
                    st: raw.st || '',
                    vf: raw.vf || 0,
                    vn: raw.vn || '',
                    vc: raw.vc || '',
                    iss: raw.iss || '',
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
                    <p className="text-slate-500">This QR code does not contain valid reheating record data. Please scan a valid HACCP PRO reheating record QR code.</p>
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

    const isVerified = record.vf === 1;
    const statusLabel = isVerified ? 'VERIFIED' : record.st || 'PENDING';
    const statusColors: Record<string, string> = {
        'VERIFIED': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'COMPLETED': 'bg-amber-100 text-amber-700 border-amber-200',
        'IN_PROGRESS': 'bg-orange-100 text-orange-700 border-orange-200',
        'DUE_VERIFICATION': 'bg-blue-100 text-blue-700 border-blue-200',
        'READY': 'bg-slate-100 text-slate-600 border-slate-200',
    };

    const issuedItems = record.iss ? record.iss.split('|').filter(Boolean).map(i => {
        const [purpose, qty] = i.split(':');
        return { purpose, qty };
    }) : [];

    const formatDate = (iso: string) => {
        if (!iso) return '---';
        try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return iso; }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 mb-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/></svg>
                            </div>
                            <div>
                                <h1 className="text-white font-black text-sm tracking-wider uppercase">HACCP PRO</h1>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Reheating Record Verification</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColors[statusLabel] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {statusLabel}
                        </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-white/60 text-xs">Batch <span className="text-white font-bold">{record.bn}</span></p>
                        <p className="text-white/40 text-xs">{record.rs ? formatDate(record.rs) : '---'}</p>
                    </div>
                </div>

                <Section title="Unit Details">
                    <Row label="Corporate" value={record.co} />
                    <Row label="Location" value={record.lo} />
                    <Row label="Department" value={record.dp} />
                    <Row label="Unit Name" value={record.ut} />
                    <Row label="Region" value={record.rg} />
                </Section>

                <Section title="Product Information">
                    <Row label="Product Name" value={record.pn} valueClass="text-indigo-600 font-black" />
                    <Row label="Source Material" value={record.src} />
                    <Row label="Category" value={record.cat} />
                    <Row label="Standard Recipe" value={record.sr} />
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Mfg Date" value={record.md} valueClass="text-emerald-600" />
                        <Row label="Exp Date" value={record.ed} valueClass="text-rose-600" />
                    </div>
                    <Row label="Batch Number" value={record.bn} />
                </Section>

                <Section title="Process Ancestry">
                    <Row label="Thaw Time" value={record.tt || '---'} />
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Cook Time" value={record.ct || '---'} />
                        <Row label="Cook Temp" value={record.ck ? `${record.ck}°C` : '---'} valueClass="text-rose-600 font-bold" />
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Cool Time" value={record.cl || '---'} />
                        <Row label="Cool Temp" value={record.cp ? `${record.cp}°C` : '---'} valueClass="text-blue-600 font-bold" />
                    </div>
                </Section>

                <Section title="Reheating Telemetry">
                    <Row label="Reheating Vessel" value={record.rv} />
                    <Row label="Method" value={record.mt} />
                    <Row label="Reheating Purpose" value={record.rp} />
                    <Row label="Quantity" value={record.rq || '---'} />
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Reheat Start" value={record.rs ? formatDate(record.rs) : '---'} />
                        <Row label="Reheat Completed" value={record.rc ? formatDate(record.rc) : '---'} />
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Initial Temp" value={record.it ? `${record.it}°C` : '---'} valueClass="text-rose-600 font-bold" />
                        <Row label="Final Temp" value={record.ft ? `${record.ft}°C` : '---'} valueClass="text-emerald-600 font-bold" />
                    </div>
                    <Row label="Cycle Duration" value={record.du || '---'} />
                    {record.ca && <Row label="Corrective Action" value={record.ca} valueClass="text-amber-600 font-bold" />}
                </Section>

                {issuedItems.length > 0 && (
                    <Section title="Distribution Registry">
                        {issuedItems.map((item, idx) => (
                            <Row key={idx} label={item.purpose} value={item.qty} valueClass="text-indigo-600 font-bold" />
                        ))}
                    </Section>
                )}

                <Section title="Authorization & Verification">
                    <Row label="Completed By" value={record.cb || '---'} />
                    <Row label="Verified By" value={isVerified ? (record.vn || 'N/A') : 'PENDING'} valueClass={isVerified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    <Row label="Verification Status" value={isVerified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION'} valueClass={isVerified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    {record.vc && <Row label="Comments" value={record.vc} />}
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
            <span className={`text-sm font-semibold text-slate-900 text-right max-w-[60%] ${valueClass || ''}`}>{value || '---'}</span>
        </div>
    );
}

export default function ReheatRecordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        }>
            <ReheatRecordContent />
        </Suspense>
    );
}
