'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface ThawRecordData {
    pn: string;
    bn: string;
    md: string;
    ed: string;
    vn: string;
    loc: string;
    unit: string;
    reg: string;
    dept: string;
    tm: string;
    st: string;
    tst: string;
    tet: string;
    it: string;
    ft: string;
    wt: string;
    ib: string;
    cb: string;
    ic: string;
    cc: string;
    tq: string;
    rq: string;
    sl: string;
    se: string;
    iss: string;
    vf: number;
    vrn: string;
    vrc: string;
    vrd: string;
}

function ThawRecordContent() {
    const searchParams = useSearchParams();
    const [record, setRecord] = useState<ThawRecordData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        try {
            const d = searchParams.get('d');
            if (d) {
                const raw = JSON.parse(decodeURIComponent(escape(atob(d))));
                setRecord({
                    pn: raw.pn || '', bn: raw.bn || '', md: raw.md || '', ed: raw.ed || '',
                    vn: raw.vn || '', loc: raw.loc || '', unit: raw.unit || '',
                    reg: raw.reg || '', dept: raw.dept || '', tm: raw.tm || '',
                    st: raw.st || '', tst: raw.tst || '', tet: raw.tet || '',
                    it: raw.it || '', ft: raw.ft || '', wt: raw.wt || '',
                    ib: raw.ib || '', cb: raw.cb || '', ic: raw.ic || '', cc: raw.cc || '',
                    tq: raw.tq || '', rq: raw.rq || '', sl: raw.sl || '', se: raw.se || '',
                    iss: raw.iss || '', vf: raw.vf || 0, vrn: raw.vrn || '',
                    vrc: raw.vrc || '', vrd: raw.vrd || '',
                });
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
                    <p className="text-slate-500">This QR code does not contain valid thawing record data. Please scan a valid HACCP PRO thawing record QR code.</p>
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const isVerified = record.vf === 1;
    const statusLabel = isVerified ? 'VERIFIED' : record.st || 'PENDING';
    const statusColors: Record<string, string> = {
        'VERIFIED': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'COMPLETED': 'bg-amber-100 text-amber-700 border-amber-200',
        'IN_PROGRESS': 'bg-blue-100 text-blue-700 border-blue-200',
        'PENDING': 'bg-slate-100 text-slate-600 border-slate-200',
    };

    const issuedItems = record.iss ? record.iss.split('|').filter(Boolean).map(i => {
        const [location, qty] = i.split(':');
        return { location, qty };
    }) : [];

    const formatDate = (iso: string) => {
        if (!iso) return '---';
        try { return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return iso; }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="max-w-3xl mx-auto p-4 md:p-8">
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 mb-6 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            </div>
                            <div>
                                <h1 className="text-white font-black text-sm tracking-wider uppercase">HACCP PRO</h1>
                                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Thawing Record Verification</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusColors[statusLabel] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {statusLabel}
                        </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-white/60 text-xs">Batch <span className="text-white font-bold">{record.bn}</span></p>
                        <p className="text-white/40 text-xs">{record.tst ? formatDate(record.tst) : '---'}</p>
                    </div>
                </div>

                <Section title="Unit Details">
                    <Row label="Location" value={record.loc} />
                    <Row label="Department" value={record.dept} />
                    <Row label="Unit Name" value={record.unit} />
                    <Row label="Region" value={record.reg} />
                </Section>

                <Section title="Product Information">
                    <Row label="Product Name" value={record.pn} valueClass="text-indigo-600 font-black" />
                    <Row label="Vendor" value={record.vn} />
                    <div className="grid grid-cols-2 gap-0">
                        <Row label="Mfg Date" value={record.md} valueClass="text-emerald-600" />
                        <Row label="Exp Date" value={record.ed} valueClass="text-rose-600" />
                    </div>
                    <Row label="Batch Number" value={record.bn} />
                    <Row label="Total Quantity" value={record.tq ? `${record.tq} KG` : '---'} />
                </Section>

                <Section title="Thawing Initiation">
                    <Row label="Thaw Method" value={record.tm} />
                    <Row label="Start Time" value={record.tst ? formatDate(record.tst) : '---'} />
                    <Row label="Initial Temp" value={record.it ? `${record.it}°C` : '---'} valueClass="text-rose-600 font-bold" />
                    {record.wt && <Row label="Water Temp" value={`${record.wt}°C`} valueClass="text-cyan-600 font-bold" />}
                    <Row label="Initiated By" value={record.ib || '---'} />
                    {record.ic && <Row label="Comments" value={record.ic} />}
                </Section>

                <Section title="Thawing Termination">
                    <Row label="End Time" value={record.tet ? formatDate(record.tet) : '---'} />
                    <Row label="Final Temp" value={record.ft ? `${record.ft}°C` : '---'} valueClass="text-emerald-600 font-bold" />
                    <Row label="Secondary Shelf Life" value={record.sl || '---'} />
                    <Row label="Secondary Expiry" value={record.se ? formatDate(record.se) : '---'} />
                    <Row label="Completed By" value={record.cb || '---'} />
                    {record.cc && <Row label="Comments" value={record.cc} />}
                    <Row label="Remaining Quantity" value={record.rq ? `${record.rq} KG` : '---'} valueClass="text-rose-600 font-bold" />
                </Section>

                {issuedItems.length > 0 && (
                    <Section title="Distribution Registry">
                        {issuedItems.map((item, idx) => (
                            <Row key={idx} label={item.location} value={`${item.qty} KG`} valueClass="text-indigo-600 font-bold" />
                        ))}
                    </Section>
                )}

                <Section title="Authorization & Verification">
                    <Row label="Verified By" value={isVerified ? (record.vrn || 'N/A') : 'PENDING'} valueClass={isVerified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    <Row label="Verification Status" value={isVerified ? 'QA AUTHORIZED' : 'AWAITING AUTHORIZATION'} valueClass={isVerified ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'} />
                    {record.vrc && <Row label="Comments" value={record.vrc} />}
                    {record.vrd && <Row label="Verification Date" value={formatDate(record.vrd)} />}
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

export default function ThawRecordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
        }>
            <ThawRecordContent />
        </Suspense>
    );
}
