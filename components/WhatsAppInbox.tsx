"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle, RefreshCw, Send, Search, Loader2, AlertCircle, CheckCircle2, User as UserIcon,
  Wifi, WifiOff, Copy, Check, FileText, Download,
} from 'lucide-react';

// Two-pane WhatsApp Inbox for the admin area.
//
// Left:  list of conversations (one per phone) with unread badge.
// Right: chronological message thread + reply box.
//
// The reply box sends a free-form text message via the inbox API, which
// only works inside Meta's 24-hour customer service window. Outside that
// window the server returns an error and we surface it so the admin
// knows to send an approved template instead.
//
// Auto-refresh: we re-poll the conversation list every 8s and the open
// thread every 5s. That's more than enough for a low-volume support
// inbox without putting any meaningful load on the DB.

interface Conversation {
  phone: string;
  last_at: string;
  last_body: string | null;
  last_direction: 'in' | 'out';
  contact_name: string | null;
  unread: number;
}

interface Message {
  id: number;
  wamid: string | null;
  direction: 'in' | 'out';
  phone: string;
  contact_name: string | null;
  message_type: string | null;
  body: string | null;
  template_name: string | null;
  status: string | null;
  error: string | null;
  created_at: string;
  read_by_admin: boolean;
}

function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('admin_session_token') || '';
}

function fmtPhone(p: string): string {
  // E.164-ish for display: +91 82390 08202
  if (!p) return '';
  if (p.length === 12 && p.startsWith('91')) {
    return `+91 ${p.slice(2, 7)} ${p.slice(7)}`;
  }
  return `+${p}`;
}

// Inline media renderer for incoming WhatsApp images / videos / audio /
// documents / stickers. The media-proxy endpoint is admin-gated and
// only accepts the `x-admin-token` header (no cookie path), so we
// can't just point a plain <img src> at it. Instead we fetch the
// bytes once with auth, convert to a blob URL, and render the right
// element. The blob URL is revoked on unmount to avoid leaking memory.
function WhatsAppMedia({ messageId, type, body }: {
  messageId: number;
  type: string;
  body: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filename, setFilename] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/whatsapp/media/${messageId}`, {
          headers: { 'x-admin-token': getAdminToken() },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          let msg = `HTTP ${res.status}`;
          try { const j = JSON.parse(txt); if (j?.error) msg = j.error; } catch {}
          if (!cancelled) setErr(msg);
          return;
        }
        // Pull filename from Content-Disposition for documents.
        const cd = res.headers.get('content-disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        if (m && !cancelled) setFilename(m[1]);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
        <Loader2 size={12} className="animate-spin" />
        Loading {type}…
      </div>
    );
  }
  if (err || !url) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 py-1">
        <AlertCircle size={12} />
        Failed to load {type}: {err || 'no data'}
      </div>
    );
  }
  if (type === 'image' || type === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={body || type}
          className={`rounded-md ${type === 'sticker' ? 'max-h-32' : 'max-h-72'} max-w-full object-contain bg-slate-100`}
        />
      </a>
    );
  }
  if (type === 'video') {
    return <video src={url} controls className="rounded-md max-h-72 max-w-full bg-black" />;
  }
  if (type === 'audio') {
    return <audio src={url} controls className="w-full max-w-[280px]" />;
  }
  if (type === 'document') {
    const name = filename || body || 'document';
    return (
      <a
        href={url}
        download={name}
        className="inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 max-w-full"
      >
        <FileText size={14} className="flex-shrink-0 text-emerald-600" />
        <span className="truncate flex-1">{name}</span>
        <Download size={12} className="flex-shrink-0 text-slate-400" />
      </a>
    );
  }
  // Fallback: generic download link.
  return (
    <a href={url} download className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 underline">
      <Download size={12} /> Download {type}
    </a>
  );
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('');
  const [templates, setTemplates] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [convsError, setConvsError] = useState<string | null>(null);
  const [health, setHealth] = useState<{
    webhookUrl: string | null;
    configured: { phoneNumberId: boolean; accessToken: boolean; verifyToken: boolean; appSecret: boolean };
    stats: { inboundCount: number; outboundCount: number; lastInbound: string | null; lastOutbound: string | null };
  } | null>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastMsgIdRef = useRef<number | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/inbox?action=health', {
        headers: { 'x-admin-token': getAdminToken() },
      });
      if (!res.ok) return;
      const data = await res.json();
      setHealth(data);
    } catch {}
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ action: 'conversations' });
      if (templateFilter) qs.set('templateName', templateFilter);
      const res = await fetch(`/api/whatsapp/inbox?${qs.toString()}`, {
        headers: { 'x-admin-token': getAdminToken() },
      });
      if (!res.ok) {
        const txt = await res.text();
        setConvsError(`Failed to load (${res.status}): ${txt.slice(0, 200)}`);
        setLoadingConvs(false);
        return;
      }
      const data = await res.json();
      setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
      if (Array.isArray(data?.templates)) setTemplates(data.templates);
      setConvsError(null);
    } catch (e: any) {
      setConvsError(`Network error: ${e?.message || e}`);
    } finally {
      setLoadingConvs(false);
    }
  }, [templateFilter]);

  // Track which phone the user currently has open so a slow in-flight
  // fetch from a previously-selected conversation can't clobber the
  // active thread when its response finally arrives.
  const activePhoneRef = useRef<string | null>(null);
  const loadMessages = useCallback(async (phone: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/whatsapp/inbox?phone=${encodeURIComponent(phone)}&limit=300`, {
        headers: { 'x-admin-token': getAdminToken() },
      });
      if (!res.ok) {
        if (!silent) setLoadingMsgs(false);
        return;
      }
      const data = await res.json();
      const msgs: Message[] = Array.isArray(data?.messages) ? data.messages : [];
      // Discard if the user has switched conversations since this
      // request was issued.
      if (activePhoneRef.current !== phone) return;
      setMessages(msgs);
      // After marking read on the server, refresh the conv list so the badge clears.
      const last = msgs.length ? msgs[msgs.length - 1].id : null;
      if (last !== lastMsgIdRef.current) {
        lastMsgIdRef.current = last;
        // Scroll to bottom on new messages.
        setTimeout(() => {
          if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }, 50);
      }
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  // Initial load + interval polling.
  useEffect(() => { loadConversations(); loadHealth(); }, [loadConversations, loadHealth]);
  useEffect(() => {
    const id = setInterval(() => { loadConversations(); loadHealth(); }, 8000);
    return () => clearInterval(id);
  }, [loadConversations, loadHealth]);
  useEffect(() => {
    activePhoneRef.current = selectedPhone;
    if (!selectedPhone) {
      setMessages([]);
      lastMsgIdRef.current = null;
      return;
    }
    // Clear stale messages immediately on switch so the user never sees
    // the previous thread bleed into the new one while the fetch runs.
    setMessages([]);
    lastMsgIdRef.current = null;
    loadMessages(selectedPhone);
    const id = setInterval(() => loadMessages(selectedPhone, true), 5000);
    return () => clearInterval(id);
  }, [selectedPhone, loadMessages]);

  // Refresh conv list once after opening a thread to clear unread badge.
  useEffect(() => {
    if (selectedPhone) {
      const t = setTimeout(loadConversations, 800);
      return () => clearTimeout(t);
    }
  }, [selectedPhone, loadConversations]);

  const unreadCount = useMemo(
    () => conversations.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = conversations;
    if (filterMode === 'unread') list = list.filter(c => c.unread > 0);
    if (!q) return list;
    return list.filter(c =>
      c.phone.includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.last_body || '').toLowerCase().includes(q),
    );
  }, [conversations, search, filterMode]);

  const selectedConv = useMemo(
    () => conversations.find(c => c.phone === selectedPhone) || null,
    [conversations, selectedPhone],
  );

  const sendReply = async () => {
    if (!selectedPhone || !draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/whatsapp/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
        body: JSON.stringify({ phone: selectedPhone, text: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        const msg = data?.error || `Send failed (${res.status})`;
        const hint = data?.hint ? `\n\n${data.hint}` : '';
        setSendError(msg + hint);
        // Still refresh so the failed-send entry shows in the thread.
        loadMessages(selectedPhone, true);
      } else {
        setDraft('');
        loadMessages(selectedPhone, true);
      }
    } catch (e: any) {
      setSendError(`Network error: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-220px)] min-h-[500px] flex bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
      {/* ── Conversation list ───────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r-2 border-slate-200 flex flex-col bg-slate-50">
        <div className="p-3 border-b-2 border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extrabold text-slate-700 flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-600" />
              WhatsApp Inbox
            </h2>
            <div className="flex items-center gap-1">
              {health && (
                <button
                  onClick={() => setShowHealth(s => !s)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${
                    health.configured.phoneNumberId && health.configured.accessToken && health.configured.verifyToken
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                  }`}
                  title="Webhook & connection status"
                >
                  {health.configured.phoneNumberId && health.configured.accessToken && health.configured.verifyToken
                    ? <Wifi size={10} /> : <WifiOff size={10} />}
                  {showHealth ? 'Hide' : 'Status'}
                </button>
              )}
              <button
                onClick={() => { loadConversations(); loadHealth(); }}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
          {showHealth && health && (
            <div className="mb-2 p-2 rounded-lg border-2 border-slate-200 bg-slate-50 text-[10px] space-y-1.5">
              <div>
                <div className="font-extrabold text-slate-600 uppercase tracking-wider mb-0.5">Webhook URL</div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-1">
                  <code className="flex-1 truncate text-slate-700 font-mono text-[9px]">
                    {health.webhookUrl || '—'}
                  </code>
                  {health.webhookUrl && (
                    <button
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(health.webhookUrl!);
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 1500);
                        } catch {}
                      }}
                      className="text-slate-400 hover:text-emerald-600 flex-shrink-0"
                      title="Copy"
                    >
                      {copiedUrl ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                    </button>
                  )}
                </div>
                <div className="text-slate-400 mt-0.5">Paste this into Meta App dashboard → WhatsApp → Configuration.</div>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200">
                {[
                  ['Phone ID', health.configured.phoneNumberId],
                  ['Access Token', health.configured.accessToken],
                  ['Verify Token', health.configured.verifyToken],
                  ['App Secret', health.configured.appSecret],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className={`font-bold ${ok ? 'text-slate-700' : 'text-rose-700'}`}>{label as string}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200 text-slate-600">
                <div><span className="font-extrabold text-emerald-700">{health.stats.inboundCount}</span> inbound</div>
                <div><span className="font-extrabold text-slate-700">{health.stats.outboundCount}</span> outbound</div>
                <div className="col-span-2 text-slate-500">
                  Last incoming: {health.stats.lastInbound ? fmtTime(health.stats.lastInbound) : <span className="text-rose-600 font-bold">never</span>}
                </div>
              </div>
              {!health.stats.lastInbound && (
                <div className="pt-1 border-t border-slate-200 text-[9px] text-amber-700 font-bold leading-snug">
                  No customer messages received yet. Check that the webhook URL above is registered in the Meta dashboard and the verify token matches.
                </div>
              )}
            </div>
          )}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or name…"
              className="w-full pl-7 pr-2 py-1.5 text-xs border-2 border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
          </div>
          {templates.length > 0 && (
            <div className="mb-2">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Filter by template</label>
              <select
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="w-full px-2 py-1 text-[11px] border-2 border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:border-emerald-400"
              >
                <option value="">All templates</option>
                {templates.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={`flex-1 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition ${
                filterMode === 'all'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setFilterMode('unread')}
              className={`flex-1 px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition ${
                filterMode === 'unread'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConvs && conversations.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400">
              <Loader2 size={16} className="animate-spin inline mr-2" />
              Loading…
            </div>
          )}
          {convsError && (
            <div className="p-3 m-3 rounded-lg border-2 border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700">
              {convsError}
            </div>
          )}
          {!loadingConvs && filtered.length === 0 && !convsError && (
            <div className="p-6 text-center text-xs text-slate-400">
              {conversations.length === 0
                ? 'No conversations yet. Inbound replies and outbound sends will appear here.'
                : 'No matches.'}
            </div>
          )}
          {filtered.map((c) => {
            const active = c.phone === selectedPhone;
            return (
              <button
                key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-200 transition ${
                  active ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-slate-800 truncate">
                        {c.contact_name || fmtPhone(c.phone)}
                      </span>
                      {c.unread > 0 && (
                        <span className="text-[9px] font-extrabold bg-emerald-600 text-white rounded-full px-1.5 py-0.5 min-w-[16px] text-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    {c.contact_name && (
                      <div className="text-[10px] font-bold text-slate-400 truncate">
                        {fmtPhone(c.phone)}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.last_direction === 'out' && (
                        <span className="text-slate-400">You: </span>
                      )}
                      {c.last_body || '—'}
                    </div>
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                    {fmtTime(c.last_at)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Message thread ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#efe7dd]">
        {!selectedPhone ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto mb-3 text-slate-300" />
              <p className="font-bold">Select a conversation to view messages</p>
              <p className="text-xs mt-1">Replies from customers and your sent messages will appear here.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b-2 border-slate-200 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                <UserIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-slate-800 truncate">
                  {selectedConv?.contact_name || fmtPhone(selectedPhone)}
                </div>
                <div className="text-[10px] font-bold text-slate-500">
                  {fmtPhone(selectedPhone)}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingMsgs && messages.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">
                  <Loader2 size={16} className="animate-spin inline mr-2" />
                  Loading messages…
                </div>
              )}
              {messages.map((m) => {
                const isOut = m.direction === 'out';
                const failed = m.status === 'failed';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                        failed
                          ? 'bg-rose-50 border-2 border-rose-200 text-rose-900'
                          : isOut
                            ? 'bg-[#dcf8c6] text-slate-900'
                            : 'bg-white text-slate-900'
                      }`}
                    >
                      {m.template_name && (
                        <div className="text-[9px] font-extrabold text-emerald-700 mb-1 uppercase">
                          Template · {m.template_name}
                        </div>
                      )}
                      {(() => {
                        const t = String(m.message_type || '').toLowerCase();
                        const isMedia = t === 'image' || t === 'video' || t === 'audio' || t === 'document' || t === 'sticker';
                        // Render the actual asset via the auth-gated
                        // media proxy for both inbound AND outbound
                        // media — outgoing PDF certificates are logged
                        // with the Meta media id under raw.document, so
                        // the same proxy can retrieve them.
                        if (isMedia) {
                          // Only show body as caption if it's not the
                          // bracket placeholder we stamped at ingest.
                          const placeholder = `[${t}]`;
                          const caption = m.body && m.body.trim() && m.body.trim() !== placeholder ? m.body : null;
                          return (
                            <div className="space-y-1.5">
                              <WhatsAppMedia messageId={m.id} type={t} body={m.body} />
                              {caption && (
                                <div className="text-xs whitespace-pre-wrap break-words">{caption}</div>
                              )}
                            </div>
                          );
                        }
                        if (t === 'location' && !isOut) {
                          return (
                            <div className="text-xs italic text-slate-500">[location pin received]</div>
                          );
                        }
                        if (t === 'unsupported' && !isOut) {
                          return (
                            <div className="text-xs italic text-slate-500">[unsupported message — open WhatsApp on your phone to view it]</div>
                          );
                        }
                        // `unknown` outbound rows are status-receipt
                        // placeholders whose corresponding outbound
                        // INSERT was lost (e.g. server restart between
                        // Meta accepting the send and our DB write).
                        // Show a neutral label instead of the literal
                        // word "[unknown]".
                        if (t === 'unknown' && isOut) {
                          return (
                            <div className="text-xs italic text-slate-400">[message — details unavailable]</div>
                          );
                        }
                        return (
                          <div className="text-xs whitespace-pre-wrap break-words">
                            {m.body || <span className="italic text-slate-400">[{m.message_type || 'message'}]</span>}
                          </div>
                        );
                      })()}
                      {failed && m.error && (
                        <div className="mt-1 text-[10px] font-bold text-rose-700 flex items-start gap-1">
                          <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
                          <span>{m.error}</span>
                        </div>
                      )}
                      <div className={`flex items-center gap-1 justify-end mt-0.5 text-[9px] font-bold ${failed ? 'text-rose-500' : 'text-slate-400'}`}>
                        <span>{fmtTime(m.created_at)}</span>
                        {isOut && !failed && m.status === 'read' && (
                          <CheckCircle2 size={10} className="text-emerald-600" />
                        )}
                        {isOut && !failed && m.status === 'delivered' && (
                          <CheckCircle2 size={10} className="text-slate-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!loadingMsgs && messages.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">
                  No messages yet.
                </div>
              )}
            </div>

            {/* Reply box */}
            <div className="border-t-2 border-slate-200 bg-white p-3">
              {sendError && (
                <div className="mb-2 p-2 rounded-lg border-2 border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 whitespace-pre-wrap">
                  {sendError}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  className="flex-1 px-3 py-2 text-xs border-2 border-slate-200 rounded-lg resize-none focus:outline-none focus:border-emerald-400"
                  disabled={sending}
                />
                <button
                  onClick={sendReply}
                  disabled={!draft.trim() || sending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-extrabold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </button>
              </div>
              <div className="mt-1 text-[9px] font-bold text-slate-400">
                Free-form replies only work within 24 hours of the customer's last message. Outside that window, send an approved template.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
