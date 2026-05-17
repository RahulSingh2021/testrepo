'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MousePointerClick, Send, AlertTriangle, ChevronLeft, RefreshCw, Copy, Check } from 'lucide-react';

type BlastListItem = {
  id: number;
  sent_at: string;
  training_ids: string[];
  attempted: number;
  succeeded: number;
  failed: number;
  token: string | null;
  audience: string | null;
  mode: string | null;
  named_template: string | null;
  unnamed_template: string | null;
  registration_url: string | null;
  tracked_url: string | null;
  click_count: number;
};

type Recipient = {
  phone: string;
  name: string;
  source: 'lms' | 'imported';
  templateUsed: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  wamid: string | null;
};

type ClickRow = {
  id: number;
  clicked_at: string;
  ip: string | null;
  ua: string | null;
  referer: string | null;
};

type BlastDetail = {
  blast: BlastListItem & {
    data: {
      recipients?: Recipient[];
      trainingsList?: string;
      headerImageUrl?: string;
      messagePreview?: string;
    };
    click_count: number;
    unique_ip_clicks: number;
  };
  clicks: ClickRow[];
};

const fmtDateTime = (s: string) => {
  try { return new Date(s).toLocaleString(); } catch { return s; }
};

const fmtPhone = (p: string) => {
  if (!p) return '';
  const d = String(p).replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
};

export default function PromoBlasts() {
  const [list, setList] = useState<BlastListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BlastDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadList = async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const r = await fetch('/api/whatsapp/promo-blasts');
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to load');
      setList(Array.isArray(j.blasts) ? j.blasts : []);
    } catch (err: any) {
      setListError(err?.message || 'Failed to load history');
    } finally {
      setLoadingList(false);
    }
  };

  const loadDetail = async (id: number) => {
    setLoadingDetail(true);
    setDetailError(null);
    setDetail(null);
    try {
      const r = await fetch(`/api/whatsapp/promo-blasts?id=${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Failed to load detail');
      setDetail(j);
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to load detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => { loadList(); }, []);
  useEffect(() => { if (selectedId != null) loadDetail(selectedId); }, [selectedId]);

  const totals = useMemo(() => {
    const blasts = list.length;
    const sent = list.reduce((s, b) => s + (b.succeeded || 0), 0);
    const failed = list.reduce((s, b) => s + (b.failed || 0), 0);
    const clicks = list.reduce((s, b) => s + (b.click_count || 0), 0);
    return { blasts, sent, failed, clicks };
  }, [list]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  // ── Detail view ───────────────────────────────────────────────────────
  if (selectedId != null) {
    return (
      <div className="p-4 md:p-6">
        <button
          onClick={() => { setSelectedId(null); setDetail(null); }}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 mb-3"
        >
          <ChevronLeft size={14} /> Back to all blasts
        </button>

        {loadingDetail && (
          <div className="p-8 text-center text-xs text-slate-400">
            <Loader2 size={18} className="animate-spin inline mr-2" /> Loading blast detail…
          </div>
        )}
        {detailError && (
          <div className="p-3 rounded-lg border-2 border-rose-200 bg-rose-50 text-xs font-bold text-rose-700">
            {detailError}
          </div>
        )}

        {detail && (
          <>
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blast #{detail.blast.id}</div>
                  <div className="text-base font-extrabold text-slate-800">{fmtDateTime(detail.blast.sent_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">{detail.blast.succeeded} sent</span>
                  {detail.blast.failed > 0 && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-rose-100 text-rose-800">{detail.blast.failed} failed</span>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                    <MousePointerClick size={11} /> {detail.blast.click_count} clicks · {detail.blast.unique_ip_clicks} unique
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="space-y-1">
                  <div><span className="font-black uppercase tracking-wider text-slate-400">Audience</span> <span className="font-bold text-slate-700">{detail.blast.audience || '—'}</span></div>
                  <div><span className="font-black uppercase tracking-wider text-slate-400">Mode</span> <span className="font-bold text-slate-700">{detail.blast.mode || '—'}</span></div>
                  <div><span className="font-black uppercase tracking-wider text-slate-400">Named template</span> <span className="font-mono text-slate-700">{detail.blast.named_template || '—'}</span></div>
                  <div><span className="font-black uppercase tracking-wider text-slate-400">Unnamed template</span> <span className="font-mono text-slate-700">{detail.blast.unnamed_template || '—'}</span></div>
                </div>
                <div className="space-y-1">
                  {detail.blast.tracked_url && (
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-wider text-slate-400">Tracking link</span>
                      <code className="font-mono text-[10px] text-slate-700 truncate max-w-[260px]">{detail.blast.tracked_url}</code>
                      <button onClick={() => copy(detail.blast.tracked_url!)} className="text-slate-400 hover:text-slate-700">
                        {copied === detail.blast.tracked_url ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                  {detail.blast.registration_url && (
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-wider text-slate-400">Redirects to</span>
                      <code className="font-mono text-[10px] text-slate-700 truncate max-w-[260px]">{detail.blast.registration_url}</code>
                    </div>
                  )}
                  {detail.blast.data?.headerImageUrl && (
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-wider text-slate-400">Header image</span>
                      <a href={detail.blast.data.headerImageUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-blue-700 hover:underline truncate max-w-[260px]">{detail.blast.data.headerImageUrl}</a>
                    </div>
                  )}
                </div>
              </div>

              {detail.blast.data?.trainingsList && (
                <details className="mt-4">
                  <summary className="text-[10px] font-black uppercase tracking-widest text-slate-500 cursor-pointer hover:text-slate-800">Message body sent</summary>
                  <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono whitespace-pre-wrap leading-relaxed text-slate-700">{detail.blast.data.trainingsList}</pre>
                </details>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border-2 border-slate-200 rounded-2xl p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-700 mb-2">
                  Recipients ({detail.blast.data?.recipients?.length || 0})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-left text-[9px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-2">Phone</th>
                        <th className="py-2 pr-2">Name</th>
                        <th className="py-2 pr-2">Template</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.blast.data?.recipients || []).map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 align-top">
                          <td className="py-1.5 pr-2 font-mono">{fmtPhone(r.phone)}</td>
                          <td className="py-1.5 pr-2 text-slate-700">{r.name || <span className="italic text-slate-400">—</span>}</td>
                          <td className="py-1.5 pr-2 font-mono text-[10px] text-slate-600">{r.templateUsed || '—'}</td>
                          <td className="py-1.5 pr-2">
                            {r.status === 'sent'
                              ? <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">sent</span>
                              : <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">failed</span>}
                          </td>
                          <td className="py-1.5 text-[10px] text-rose-700">{r.error || ''}</td>
                        </tr>
                      ))}
                      {(!detail.blast.data?.recipients || detail.blast.data.recipients.length === 0) && (
                        <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs italic">No per-recipient data captured for this blast.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-700 mb-2 flex items-center gap-1">
                  <MousePointerClick size={13} /> Clicks ({detail.clicks.length})
                </div>
                {detail.clicks.length === 0 ? (
                  <div className="text-[11px] italic text-slate-400 py-6 text-center">No clicks yet.</div>
                ) : (
                  <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                    {detail.clicks.map(c => (
                      <li key={c.id} className="text-[10px] border-b border-slate-100 pb-1.5">
                        <div className="font-bold text-slate-700">{fmtDateTime(c.clicked_at)}</div>
                        <div className="font-mono text-slate-500 truncate">{c.ip || '—'}</div>
                        {c.ua && <div className="text-slate-400 truncate" title={c.ua}>{c.ua}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">WhatsApp Promo Blasts</h2>
          <p className="text-xs text-slate-500">History of every multi-training WhatsApp send, with delivery counts and link clicks.</p>
        </div>
        <button
          onClick={loadList}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loadingList ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white border-2 border-slate-200 rounded-xl p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Blasts</div>
          <div className="text-2xl font-black text-slate-800">{totals.blasts}</div>
        </div>
        <div className="bg-white border-2 border-emerald-200 rounded-xl p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-emerald-600 inline-flex items-center gap-1"><Send size={10} /> Sent</div>
          <div className="text-2xl font-black text-emerald-700">{totals.sent}</div>
        </div>
        <div className="bg-white border-2 border-rose-200 rounded-xl p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-rose-600 inline-flex items-center gap-1"><AlertTriangle size={10} /> Failed</div>
          <div className="text-2xl font-black text-rose-700">{totals.failed}</div>
        </div>
        <div className="bg-white border-2 border-blue-200 rounded-xl p-3">
          <div className="text-[9px] font-black uppercase tracking-widest text-blue-600 inline-flex items-center gap-1"><MousePointerClick size={10} /> Clicks</div>
          <div className="text-2xl font-black text-blue-700">{totals.clicks}</div>
        </div>
      </div>

      {listError && (
        <div className="p-3 rounded-lg border-2 border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 mb-3">
          {listError}
        </div>
      )}

      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Sent at</th>
                <th className="py-2.5 px-3">Audience</th>
                <th className="py-2.5 px-3">Trainings</th>
                <th className="py-2.5 px-3">Templates</th>
                <th className="py-2.5 px-3 text-right">Attempted</th>
                <th className="py-2.5 px-3 text-right">Sent</th>
                <th className="py-2.5 px-3 text-right">Failed</th>
                <th className="py-2.5 px-3 text-right">Clicks</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {loadingList && list.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">
                  <Loader2 size={16} className="animate-spin inline mr-2" /> Loading…
                </td></tr>
              )}
              {!loadingList && list.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400 italic">No blasts sent yet.</td></tr>
              )}
              {list.map(b => (
                <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-700">{fmtDateTime(b.sent_at)}</td>
                  <td className="py-2 px-3"><span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">{b.audience || '—'}</span></td>
                  <td className="py-2 px-3 text-slate-600">{b.training_ids?.length || 0}</td>
                  <td className="py-2 px-3 font-mono text-[10px] text-slate-600">
                    <div className="truncate max-w-[180px]" title={`${b.named_template || ''} / ${b.unnamed_template || ''}`}>
                      {b.named_template || '—'}{b.unnamed_template && b.unnamed_template !== b.named_template ? ` / ${b.unnamed_template}` : ''}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-700">{b.attempted}</td>
                  <td className="py-2 px-3 text-right font-bold text-emerald-700">{b.succeeded}</td>
                  <td className="py-2 px-3 text-right font-bold text-rose-700">{b.failed || ''}</td>
                  <td className="py-2 px-3 text-right font-bold text-blue-700">{b.click_count}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => setSelectedId(b.id)}
                      className="text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:text-emerald-900"
                    >View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
