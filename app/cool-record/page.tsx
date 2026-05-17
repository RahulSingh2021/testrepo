'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

interface CoolRecordData {
    pn: string;
    bn: string;
    md: string;
    ed: string;
    loc: string;
    dept: string;
    unit: string;
    reg: string;
    corp: string;
    ct: number;
    cet: string;
    ctl: string;
    thm: string;
    tst: number;
    tft: number;
    mt: string;
    vid: string;
    qty: number;
    su: string;
    st: string;
    it: number;
    s1t: string;
    s1tp: number;
    ft: string;
    ftp: number;
    sle: string;
    ib: string;
    s1b: string;
    fb: string;
    oc: string;
    al: string;
    vf: number;
    status: string;
    vn: string;
    vc: string;
    vd: string;
}

function CoolRecordContent() {
    const searchParams = useSearchParams();
    const [record, setRecord] = useState<CoolRecordData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        try {
            const d = searchParams.get('d');
            if (d) {
                const raw = JSON.parse(decodeURIComponent(escape(atob(d))));
                setRecord(raw as CoolRecordData);
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
                    <p className="text-slate-500">This QR code does not contain valid cooling record data. Please scan a valid HACCP PRO cooling record QR code.</p>
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const isVerified = record.vf === 1;
    const statusLabel = isVerified ? 'VERIFIED' : record.status || 'PENDING';
    const statusColors: Record<string, string> = {
        'VERIFIED': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'COMPLETED': 'bg-cyan-100 text-cyan-700 border-cyan-200',
        'STAGE_1': 'bg-blue-100 text-blue-700 border-blue-200',
        'INITIAL': 'bg-amber-100 text-amber-700 border-amber-200',
        'NOT_STARTED': 'bg-slate-100 text-slate-700 border-slate-200',
    };

    const fmtTime = (t: string) => t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '---';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-5 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Cooling Record</span>
                                </div>
                                <h1 className="text-xl font-black uppercase tracking-tight">{record.pn || 'Unknown Product'}</h1>
                                <p className="text-cyan-200 text-xs font-mono font-bold mt-1">BATCH: {record.bn || '---'}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${statusColors[statusLabel] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Location Details</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-slate-400 text-xs font-bold">Location</span><p className="font-bold text-slate-800">{record.loc || '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Department</span><p className="font-bold text-slate-800">{record.dept || '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Unit</span><p className="font-bold text-slate-800">{record.unit || '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Region</span><p className="font-bold text-slate-800">{record.reg || '---'}</p></div>
                                <div className="col-span-2"><span className="text-slate-400 text-xs font-bold">Corporate</span><p className="font-bold text-indigo-600">{record.corp || '---'}</p></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Product Details</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-slate-400 text-xs font-bold">MFG Date</span><p className="font-bold text-emerald-600">{record.md || 'N/A'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">EXP Date</span><p className="font-bold text-rose-600">{record.ed || 'N/A'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Quantity</span><p className="font-bold text-slate-800">{record.qty || '---'} {record.su || ''}</p></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cooking & Thawing Trace</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-slate-400 text-xs font-bold">Cook Temp</span><p className="font-bold text-rose-600">{record.ct != null ? `${record.ct}°C` : '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Cook End</span><p className="font-bold text-slate-800">{fmtTime(record.cet)}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Cook Lapse</span><p className="font-bold text-slate-800">{record.ctl || '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Thaw Method</span><p className="font-bold text-blue-600">{record.thm || 'N/A'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Thaw Start Temp</span><p className="font-bold text-slate-800">{record.tst != null ? `${record.tst}°C` : '---'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Thaw Final Temp</span><p className="font-bold text-slate-800">{record.tft != null ? `${record.tft}°C` : '---'}</p></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cooling Telemetry</h3>
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="bg-white rounded-xl p-3 border border-rose-100 text-center">
                                    <span className="text-slate-400 text-xs font-bold block">Initial</span>
                                    <p className="text-xl font-black text-rose-600">{record.it != null ? `${record.it}°C` : '---'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{fmtTime(record.st)}</p>
                                    <p className="text-[10px] text-slate-500">By: {record.ib || 'N/A'}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-blue-100 text-center">
                                    <span className="text-slate-400 text-xs font-bold block">Stage 1</span>
                                    <p className="text-xl font-black text-blue-600">{record.s1tp != null ? `${record.s1tp}°C` : '---'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{fmtTime(record.s1t)}</p>
                                    <p className="text-[10px] text-slate-500">By: {record.s1b || 'N/A'}</p>
                                </div>
                                <div className="bg-white rounded-xl p-3 border border-emerald-100 text-center">
                                    <span className="text-slate-400 text-xs font-bold block">Final</span>
                                    <p className="text-xl font-black text-emerald-600">{record.ftp != null ? `${record.ftp}°C` : '---'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{fmtTime(record.ft)}</p>
                                    <p className="text-[10px] text-slate-500">By: {record.fb || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                <div><span className="text-slate-400 text-xs font-bold">Method</span><p className="font-bold text-slate-800">{record.mt || 'Pending'}</p></div>
                                <div><span className="text-slate-400 text-xs font-bold">Vessel</span><p className="font-bold text-slate-800">{record.vid || '---'}</p></div>
                                {record.sle && <div className="col-span-2"><span className="text-slate-400 text-xs font-bold">Shelf Life Expiry</span><p className="font-bold text-rose-600">{record.sle}</p></div>}
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Additional Details</h3>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                {record.oc && <div className="col-span-2"><span className="text-slate-400 text-xs font-bold">Operator Comments</span><p className="font-bold text-slate-700">{record.oc}</p></div>}
                                {record.al && <div><span className="text-slate-400 text-xs font-bold">Ambient Lapse</span><p className="font-bold text-amber-600">{record.al}</p></div>}
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Status</p>
                                    <p className={`text-lg font-black uppercase ${isVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {isVerified ? 'QA AUTHORIZED' : 'AWAITING VERIFICATION'}
                                    </p>
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isVerified ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                                    {isVerified ? (
                                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                </div>
                            </div>
                            {isVerified && (
                                <div className="border-t border-slate-700 pt-3 space-y-2">
                                    {record.vn && <div><span className="text-slate-500 text-xs font-bold">Verifier</span><p className="text-sm font-bold text-white">{record.vn}</p></div>}
                                    {record.vc && <div><span className="text-slate-500 text-xs font-bold">Comments</span><p className="text-sm text-slate-300">{record.vc}</p></div>}
                                    {record.vd && <div><span className="text-slate-500 text-xs font-bold">Verified On</span><p className="text-sm font-mono text-slate-300">{fmtTime(record.vd)}</p></div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">HACCP PRO Enterprise Systems</p>
                        <p className="text-[9px] text-slate-300 mt-1">Cooling Control Registry &bull; ISO 22000:2018</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function CoolRecordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" /></div>}>
            <CoolRecordContent />
        </Suspense>
    );
}
